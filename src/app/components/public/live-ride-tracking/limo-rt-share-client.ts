/**
 * Read-only limo-rt client for the public tracking page, driven by a signed share token
 * (`/live-ride-tracking/<token>`). Replaces the old Socket.IO path, which connected as the
 * customer id in the URL with a shared secret embedded in this page.
 *
 * Flow (contract v1):
 *   GET  {rest}/share/ride            (Bearer <token>) -> pickup, dropoff, stops, driver name
 *   WS   {socket}  hello {token, app: "web"} -> welcome {ride_id}
 *                  subscribe {ride_id, last_seq} -> replay, latest location, latest ETA, subscribed
 *                  then live `loc` / `ride.status` / `ride.eta` / `driver.presence`
 * Chat is never sent to share viewers, so this client has none.
 */

/** A stop as `ride.status` carries it (`data.stop`): the stop the driver is at or just left. */
export interface StatusStop {
  index: number;
  number: number;
  total: number;
}

/** `ride.eta` (eta_v 1): traffic-aware ETA computed by limo-rt for the leg the driver is on. */
export interface RideEta {
  leg: 'pickup' | 'stop' | 'dropoff';
  target: { kind: string; index: number | null; number: number | null; total: number | null; lat: number; lng: number };
  duration_s: number;
  distance_m: number;
  /** Encoded polyline of the current leg (Google format). */
  polyline: string | null;
  /** Total to the final dropoff on a multi-stop ride. */
  final: { duration_s: number; distance_m: number } | null;
}

export interface SharedRideEnd {
  address: string | null;
  lat: number | null;
  lng: number | null;
}

export interface SharedRide {
  ride_id: string;
  status: string;
  driver_first_name: string | null;
  pickup: SharedRideEnd;
  dropoff: SharedRideEnd;
  stops: Array<{ number: number; address: string | null; lat: number | null; lng: number | null }>;
  current_stop_index: number | null;
  expires_at: number;
}

export interface ShareClientHandlers {
  onRide(ride: SharedRide): void;
  onLocation(lat: number, lng: number, heading: number | null): void;
  /** `stop` is undefined when the frame says nothing about stops (keep the current one). */
  onStatus(status: string, cancelledBy: string | null, stop: StatusStop | null | undefined): void;
  onEta(eta: RideEta): void;
  onPresence(online: boolean): void;
  onConnection(state: 'connecting' | 'connected' | 'reconnecting'): void;
  /** Terminal: the link is invalid or the ride is over. No more reconnects. */
  onExpired(reason: 'expired' | 'invalid'): void;
}

const PING_MS = 20_000;
const DEAD_AFTER_MS = 30_000;
const TERMINAL = ['ended', 'finalized', 'cancelled', 'rejected'];

/** A share token is a JWT (three dot-separated parts); old links carry a numeric id. */
export function isShareToken(trackingId: string | null): boolean {
  return !!trackingId && trackingId.split('.').length === 3;
}

/** Google encoded polyline -> points (the Maps script here loads no geometry library). */
export function decodePolyline(encoded: string): Array<{ lat: number; lng: number }> {
  const points: Array<{ lat: number; lng: number }> = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    for (const axis of [0, 1]) {
      let result = 0, shift = 0, byte: number;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20 && index < encoded.length);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (axis === 0) lat += delta; else lng += delta;
    }
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

/** `wss://host/rt/v1/ws` -> `https://host/rt/v1`. */
export function restBaseFromSocketUrl(socketUrl: string): string {
  const url = new URL(socketUrl);
  url.protocol = url.protocol === 'ws:' ? 'http:' : 'https:';
  url.pathname = url.pathname.replace(/\/ws$/, '');
  url.search = '';
  return url.toString().replace(/\/$/, '');
}

export class LimoRtShareClient {
  private ws: WebSocket | null = null;
  private rideId: string | null = null;
  /** Highest durable seq applied, so a reconnect replays only what was missed. */
  private lastSeq = 0;
  private attempt = 0;
  private stopped = false;
  private lastReceivedAt = 0;
  private lastSentAt = 0;
  private heartbeat: any = null;
  private reconnectTimer: any = null;

  constructor(
    private readonly socketUrl: string,
    private readonly token: string,
    private readonly handlers: ShareClientHandlers,
  ) {}

  async start(): Promise<void> {
    const ride = await this.fetchRide();
    if (!ride) return;
    this.rideId = ride.ride_id;
    this.handlers.onRide(ride);
    this.open();
  }

  stop(): void {
    this.stopped = true;
    clearInterval(this.heartbeat);
    clearTimeout(this.reconnectTimer);
    this.ws?.close(1000, 'bye');
    this.ws = null;
  }

  private async fetchRide(): Promise<SharedRide | null> {
    try {
      const response = await fetch(`${restBaseFromSocketUrl(this.socketUrl)}/share/ride`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${this.token}` },
      });
      if (response.status === 401 || response.status === 403 || response.status === 404) {
        this.expire(response.status === 403 ? 'expired' : 'invalid');
        return null;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return (await response.json()) as SharedRide;
    } catch {
      // Network trouble: try again shortly rather than giving up on the page.
      this.reconnectTimer = setTimeout(() => this.start(), this.nextDelay());
      return null;
    }
  }

  private open(): void {
    if (this.stopped) return;
    this.handlers.onConnection(this.attempt === 0 ? 'connecting' : 'reconnecting');
    const ws = new WebSocket(this.socketUrl);
    this.ws = ws;
    this.lastReceivedAt = Date.now();

    ws.onopen = () => this.send({ type: 'hello', data: { token: this.token, app: 'web', platform: 'web' } });
    ws.onmessage = (event) => {
      this.lastReceivedAt = Date.now();
      this.onFrame(String(event.data));
    };
    ws.onclose = (event) => {
      if (ws !== this.ws) return;
      // 4410 = share link expired, 4401 = token rejected: both final for a viewer.
      if (event.code === 4410) return this.expire('expired');
      if (event.code === 4401) return this.expire('invalid');
      this.lost();
    };
    ws.onerror = () => { /* onclose follows */ };

    clearInterval(this.heartbeat);
    this.heartbeat = setInterval(() => {
      const now = Date.now();
      if (now - this.lastReceivedAt > DEAD_AFTER_MS) {
        this.lost();
      } else if (now - this.lastSentAt >= PING_MS || now - this.lastReceivedAt >= PING_MS) {
        this.send({ type: 'ping' });
      }
    }, 1000);
  }

  private onFrame(text: string): void {
    let frame: any;
    try { frame = JSON.parse(text); } catch { return; }
    const data = frame?.data || {};
    if (typeof frame?.seq === 'number') {
      if (frame.seq <= this.lastSeq) return; // already applied (replay overlap)
      this.lastSeq = frame.seq;
    }
    switch (frame?.type) {
      case 'welcome':
        this.attempt = 0;
        this.handlers.onConnection('connected');
        this.send({ type: 'subscribe', ride_id: this.rideId, data: { last_seq: this.lastSeq } });
        break;
      case 'resync.required':
        // Too much was missed to replay: reload the summary, then replay from scratch.
        this.lastSeq = 0;
        this.resync();
        break;
      case 'ride.eta':
        if (typeof data.duration_s === 'number') {
          this.handlers.onEta({
            leg: data.leg,
            target: data.target,
            duration_s: data.duration_s,
            distance_m: data.distance_m ?? 0,
            polyline: data.route?.polyline || null,
            final: data.final ? { duration_s: data.final.duration_s, distance_m: data.final.distance_m } : null,
          });
        }
        break;
      case 'loc':
        if (typeof data.lat === 'number' && typeof data.lng === 'number') {
          this.handlers.onLocation(data.lat, data.lng, typeof data.heading === 'number' && data.heading >= 0 ? data.heading : null);
        }
        break;
      case 'subscribed':
        // Carries the current status but no stop: keep the stop the replay left in place.
        if (data.status) {
          this.handlers.onStatus(data.status, null, undefined);
          if (TERMINAL.includes(data.status)) this.expire('expired');
        }
        break;
      case 'ride.status':
        if (data.status) {
          const stop = data.stop && typeof data.stop.index === 'number'
            ? { index: data.stop.index, number: data.stop.number, total: data.stop.total }
            : null;
          this.handlers.onStatus(data.status, data.cancelled_by ?? null, stop);
          if (TERMINAL.includes(data.status)) this.expire('expired');
        }
        break;
      case 'ride.cancelled': // servers from before ride.status carried cancellations
        this.handlers.onStatus('cancelled', data.by ?? null, null);
        this.expire('expired');
        break;
      case 'driver.presence':
        this.handlers.onPresence(data.online !== false);
        break;
      case 'error':
        if (data.code === 'share_expired') this.expire('expired');
        else if (data.code === 'unauthorized' || data.code === 'forbidden_ride') this.expire('invalid');
        break;
    }
  }

  /** Reload the ride summary over REST (stops, status) after a replay gap. */
  private async resync(): Promise<void> {
    try {
      const response = await fetch(`${restBaseFromSocketUrl(this.socketUrl)}/share/ride`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${this.token}` },
      });
      if (response.status === 403) return this.expire('expired');
      if (response.ok && !this.stopped) this.handlers.onRide((await response.json()) as SharedRide);
    } catch {
      // The socket keeps the live state; the next resync or reload fills the rest.
    }
  }

  private send(frame: Record<string, unknown>): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.lastSentAt = Date.now();
    this.ws.send(JSON.stringify({ v: 1, ...frame }));
  }

  private lost(): void {
    if (this.stopped) return;
    clearInterval(this.heartbeat);
    const ws = this.ws;
    this.ws = null;
    ws?.close();
    this.attempt += 1;
    this.handlers.onConnection('reconnecting');
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => this.open(), this.nextDelay());
  }

  /** Full jitter over 0.5, 1, 2, 4, 8 s, capped at 15 s (a live ride is on screen). */
  private nextDelay(): number {
    const ceiling = Math.min(15_000, 500 * 2 ** Math.max(0, this.attempt - 1));
    return Math.max(100, Math.random() * ceiling);
  }

  private expire(reason: 'expired' | 'invalid'): void {
    this.stop();
    this.handlers.onExpired(reason);
  }
}
