import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../../environments/environment';
import { LimoRtShareClient, RideEta, SharedRide, decodePolyline, isShareToken } from './limo-rt-share-client';

declare var google: any;

/** Directions API is billed per request: re-ask at most this often (status changes force it). */
const ROUTE_REFRESH_MS = 30_000;
/** No location for this long on a moving leg: tell the viewer the position may be old. */
const STALE_FIX_MS = 15_000;
const TERMINAL_STATUSES = ['ended', 'finalized', 'cancelled', 'rejected'];

interface EtaView {
  /** "4 min" or "Arriving now". */
  text: string;
  arriveAt: Date;
  /** "to pickup", "to stop 2 of 3", "to destination". */
  label: string;
  finalText: string | null;
  finalArriveAt: Date | null;
}


@Component({
  selector: 'app-live-ride-tracking',
  templateUrl: './live-ride-tracking.component.html',
  styleUrls: ['./live-ride-tracking.component.scss']
})
export class LiveRideTrackingComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef;

  status = 'Connecting...';
  rideData: any = null;
  pathHistory: any[] = [];
  error: string | null = null;
  estimatedTimeToPickup: string | null = null;
  estimatedDistanceToPickup: string | null = null;
  chatOpen = false;
  chatUnread = 0;

  readonly socketUrl = environment.production ? 'https://limortservice.1800limo.com' : 'http://10.20.10.132:9100';
  readonly socketSecret = 'limoapi_notifications_secret_2024_xyz789';

  socket: Socket | null = null;
  /** True for a signed share link (limo-rt): view only, no chat. */
  viewerMode = false;
  private shareClient: LimoRtShareClient | null = null;
  /** Share mode: extra stops in booking order, and the last one served (0-based, or null). */
  stops: SharedRide['stops'] = [];
  private currentStopIndex: number | null = null;
  /** Share mode: what the viewer should know about the connection, shown as a chip. */
  connectionNote: string | null = null;
  eta: EtaView | null = null;
  private socketConnected = false;
  private driverOnline = true;
  private lastFixAt = 0;
  /** Latest ETA and when it arrived; the countdown runs from the local receipt time, so a
   * skewed device clock doesn't shift it. `fromServer` = limo-rt's traffic-aware ride.eta. */
  private etaBase: { eta: RideEta; receivedAt: number; fromServer: boolean } | null = null;
  private etaRoute: any = null;
  private stopMarkers: any[] = [];
  private stopMarkersKey = '';
  private tickTimer: any = null;
  private mapUpdateTimer: any = null;
  currentUserId: number | null = null;
  private googleMap: any = null;
  private markers: { driver: any; pickup: any; dropoff: any } = { driver: null, pickup: null, dropoff: null };
  private directionsRenderer: any = null;
  private directionsRendererPickupToDropoff: any = null;
  private historyPolyline: any = null;
  private lastRouteUpdate = 0;
  private routeCalculated = false;
  private pickupToDropoffRouteCalculated = false;
  private currentBookingId: string | number | null = null;
  private currentCustomerId: string | number | null = null;
  private connectionCheckInterval: any = null;
  private readonly SECRET = 'LIMO_LIVE_TRACK_SECRET_2026'; // keep same everywhere
  private readonly TOKEN_LENGTH = 32;

  private attachSocketDebugger(socket: any): void {
    const originalOn = socket.on.bind(socket);
  
    socket.on = (event: string, callback: Function) => {
      return originalOn(event, (...args: any[]) => {
        console.log('[SOCKET EVENT SUSHIL]', event, args);
        callback(...args);
      });
    };
  }

  // ID Decoding Logic
  private readonly PREFIX = "LXSH";
  private readonly SUFFIX = "ZXSL";

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    const trackingId = this.route.snapshot.paramMap.get('tracking_id');
    if (isShareToken(trackingId)) {
      this.initializeShareTracking(trackingId as string);
    } else {
      // Legacy links (/live-ride-tracking/<customer id>) on the Node service. Remove after
      // the limo-rt cutover, together with initializeSocket() and the chat wiring.
      this.initializeSocket();
    }
  }

  ngAfterViewInit(): void {
    this.initializeMap();
  }

  ngOnDestroy(): void {
    this.shareClient?.stop();
    this.shareClient = null;
    clearInterval(this.tickTimer);
    clearTimeout(this.mapUpdateTimer);

    // Clear connection check interval
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
      this.connectionCheckInterval = null;
    }
    
    // Disconnect socket and remove all listeners
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
  }

  private initializeMap(): void {
    const defaultCenter = { lat: 40.7128, lng: -74.0060 };

    this.googleMap = new google.maps.Map(this.mapContainer.nativeElement, {
      zoom: 13,
      center: defaultCenter,
      disableDefaultUI: true,
      zoomControl: false,
      styles: [
        { featureType: "poi", stylers: [{ visibility: "off" }] },
        { featureType: "transit", stylers: [{ visibility: "off" }] }
      ]
    });

    // Route Line (Black) - Driver to destination
    this.directionsRenderer = new google.maps.DirectionsRenderer({
      map: this.googleMap,
      suppressMarkers: true,
      preserveViewport: true,
      polylineOptions: { strokeColor: '#111827', strokeWeight: 5, strokeOpacity: 0.9 }
    });

    // Same look, drawn from limo-rt's ride.eta polyline (share links) instead of Directions.
    this.etaRoute = new google.maps.Polyline({
      map: this.googleMap,
      path: [],
      strokeColor: '#111827',
      strokeWeight: 5,
      strokeOpacity: 0.9,
      zIndex: 10
    });

    // Route Line (Blue) - Pickup to Dropoff (always visible)
    this.directionsRendererPickupToDropoff = new google.maps.DirectionsRenderer({
      map: this.googleMap,
      suppressMarkers: true,
      preserveViewport: true,
      polylineOptions: { strokeColor: '#3b82f6', strokeWeight: 4, strokeOpacity: 0.7 }
    });

    // History Trail (Gray)
    this.historyPolyline = new google.maps.Polyline({
      map: this.googleMap,
      path: [],
      geodesic: true,
      strokeColor: '#9ca3af',
      strokeOpacity: 0.8,
      strokeWeight: 4
    });
  }

  /**
   * Initialize Socket.IO connection with backend
   * 
   * BACKEND FLOW (MUST MATCH):
   * 1. Client connects with auth: { userId, userType: 'customer', secret }
   * 2. Client MUST emit 'join-room' with { room: customerId } to receive events
   * 3. Backend emits 'active_ride' on connection
   * 4. Client extracts bookingId/customerId from active_ride
   * 5. Client ensures room membership (customerId preferred, bookingId fallback)
   * 6. Backend emits 'driver.location.update' ONLY to joined rooms
   * 7. On reconnect, client MUST rejoin all rooms
   */
  private initializeSocket(): void {
    // Get tracking_id from route parameter (encoded customerId)
    const encodedUserId = this.route.snapshot.paramMap.get('tracking_id');
    const userId = encodedUserId;

    console.log('Initializing socket with tracking_id:', encodedUserId, 'decoded userId:', userId);

    if (!userId) {
      this.error = 'Invalid or Missing Tracking ID';
      console.error('Invalid tracking_id:', encodedUserId);
      return;
    }

    // Store userId for room joining (this is the customerId)
    //@ts-ignore
    this.currentUserId = userId;

    const socketUrl = this.socketUrl;
    console.log('Connecting to socket URL:', socketUrl);

    try {
      // Connect with authentication (backend validates secret & userId)
      this.socket = io(socketUrl, {
        transports: ['polling', 'websocket'],
        auth: { 
          userId: userId, 
          userType: 'customer', 
          secret: this.socketSecret
        },
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 20000
      });

      // STEP 1: On socket connect, join customerId room (primary room for receiving events)
      this.socket.on('connect', () => {
        console.log('Socket connected successfully', {
          id: this.socket?.id,
          transport: (this.socket as any)?.io?.engine?.transport?.name
        });
        this.status = 'Connected';
        this.error = null;
        
        // Join customerId room immediately on connect (backend requirement)
        // This ensures we receive driver.location.update events
        this.joinRoom(this.currentUserId?.toString() || null, 'customerId');

        // 'connect' also fires after every automatic reconnect (socket.io v4 emits
        // 'reconnect' on the Manager, not the socket), so rejoin the booking room here too —
        // otherwise location updates and chat messages stop after the first network blip.
        if (this.currentBookingId) {
          this.joinRoom(this.currentBookingId.toString(), 'bookingId');
        }
      });

      this.socket.on('disconnect', (reason: any) => {
        console.log('Socket disconnected:', reason);
        this.status = 'Disconnected';
        if (reason === 'io server disconnect') {
          // Server disconnected the socket, need to reconnect manually
          this.socket?.connect();
        }
      });

      this.socket.on('connect_error', (error: any) => {
        console.error('Socket connection error:', error);
        this.status = 'Connection Error';
        this.error = `Connection failed: ${error.message || 'Unable to connect to server'}`;
      });

      // STEP 2: On reconnect, rejoin all necessary rooms
      this.socket.on('reconnect', (attemptNumber: number) => {
        console.log('Socket reconnected after', attemptNumber, 'attempts');
        this.status = 'Connected';
        this.error = null;
        
        // Rejoin customerId room (always rejoin on reconnect)
        this.joinRoom(this.currentUserId?.toString() || null, 'customerId');
        
        // Rejoin bookingId room if we have an active booking
        if (this.currentBookingId) {
          this.joinRoom(this.currentBookingId.toString(), 'bookingId');
        }
      });

      this.socket.on('reconnect_attempt', (attemptNumber: number) => {
        console.log('Reconnection attempt', attemptNumber);
        this.status = `Reconnecting... (${attemptNumber})`;
      });

      this.socket.on('reconnect_error', (error: any) => {
        console.error('Reconnection error:', error);
        this.status = 'Reconnection Failed';
      });

      this.socket.on('reconnect_failed', () => {
        console.error('Reconnection failed after all attempts');
        this.status = 'Connection Failed';
        this.error = 'Unable to connect to server. Please refresh the page.';
      });

      // STEP 3: Setup event handlers for backend events
      const handleData = (data: any, type: string) => this.processRideData(data, type);

      // STEP 3a: active_ride - Backend sends this on connection to provide ride context
      // After receiving this, we extract bookingId and customerId, then ensure correct room membership
      this.socket.on('active_ride', (d: any) => {
        console.log('Received active_ride event:', d);
        handleData(d, 'active_ride');
        
        // Extract bookingId and customerId from active_ride to ensure room membership
        const rideData = d.data || d;
        const bookingId = rideData.booking_id || rideData.bookingId;
        const customerId = rideData.customer_id || rideData.customerId || 
                          (rideData.customer?.id) || this.currentUserId?.toString();
        
        if (bookingId) {
          this.currentBookingId = bookingId;
          // Join bookingId room as fallback (backend uses bookingId room if customerId unavailable)
          this.joinRoom(bookingId.toString(), 'bookingId');
        }
        
        if (customerId && customerId !== this.currentUserId?.toString()) {
          this.currentCustomerId = customerId;
          // Ensure customerId room is joined (preferred room)
          this.joinRoom(customerId.toString(), 'customerId');
        }
      });

      // STEP 3b: driver.location.update - EXACT backend event name (NOT driver_location_update)
      // Backend emits: io.to(customerId).emit('driver.location.update', payload)
      // Only process if bookingId matches current active ride
      this.socket.on('driver.location.update', (d: any) => {
        // Validate bookingId matches before processing
        const locationBookingId = d.bookingId || d.booking_id;
        if (this.currentBookingId && locationBookingId && 
            locationBookingId.toString() !== this.currentBookingId.toString()) {
          console.log('Ignoring driver.location.update - bookingId mismatch:', {
            received: locationBookingId,
            expected: this.currentBookingId
          });
          return;
        }
        
        console.log('Received driver.location.update event:', d);
        handleData(d, 'driver_loc');
      });

      // STEP 3c: user.notifications - Backend sends ride status updates
      this.socket.on('user.notifications', (d: any) => {
        console.log('Received user.notifications event:', d);
        handleData(d, 'notification');
      });

      // STEP 3d: chat — handled by <app-ride-chat>, which listens for 'chat.message' on this
      // same socket. (A chat payload must not go through processRideData: it would rebuild
      // rideData from the message and blank out the ride panel.)

      // Production-safe connection monitoring (only log warnings, not every status check)
      this.connectionCheckInterval = setInterval(() => {
        if (!this.socket?.connected) {
          console.warn('Socket connection lost - will attempt reconnection');
        }
      }, 10000);
    } catch (error: any) {
      console.error('Error initializing socket:', error);
      this.error = `Failed to initialize connection: ${error.message || 'Unknown error'}`;
      this.status = 'Initialization Error';
    }
  }

  /**
   * Signed share link: read-only tracking over limo-rt. The ride summary and live frames are
   * mapped onto the same `rideData` / `pathHistory` the legacy path fills, so the map and the
   * panel are unchanged.
   */
  private initializeShareTracking(token: string): void {
    this.viewerMode = true;
    const socketUrl = (environment as any).rtSocketUrl as string | undefined;
    if (!socketUrl) {
      this.error = 'Live tracking is not available right now.';
      return;
    }
    this.shareClient = new LimoRtShareClient(socketUrl, token, {
      onRide: (ride) => {
        const statusChanged = this.rideData?.status !== ride.status;
        this.currentBookingId = ride.ride_id;
        this.stops = ride.stops || [];
        this.currentStopIndex = ride.current_stop_index;
        this.rideData = {
          booking_id: ride.ride_id,
          status: ride.status,
          driver_id: null,
          driver_name: ride.driver_first_name || 'Your chauffeur',
          driver_phone: null,
          vehicle_info: null,
          vehicle_plate: '',
          pickup: { address: ride.pickup.address, lat: ride.pickup.lat ?? NaN, lng: ride.pickup.lng ?? NaN },
          dropoff: { address: ride.dropoff.address, lat: ride.dropoff.lat ?? NaN, lng: ride.dropoff.lng ?? NaN },
          // A resync reloads the summary: keep the car where it is.
          driver_lat: this.rideData?.driver_lat ?? NaN,
          driver_lng: this.rideData?.driver_lng ?? NaN,
          pickup_time: null
        };
        if (statusChanged) this.targetChanged();
        this.scheduleMapUpdate();
      },
      onLocation: (lat, lng) => {
        this.lastFixAt = Date.now();
        this.processRideData({ latitude: lat, longitude: lng, bookingId: this.currentBookingId }, 'driver_loc');
        this.updateConnectionNote();
      },
      onStatus: (status, _cancelledBy, stop) => {
        if (!this.rideData) return;
        if (stop !== undefined) {
          // passenger_drop / passenger_pick carry the stop; any other status leaves the stops.
          if (stop) this.currentStopIndex = stop.index;
          else if (status === 'start_ride' || status === 'en_route_pu' || status === 'on_location') this.currentStopIndex = null;
        }
        if (this.rideData.status === status && stop === undefined) return; // `subscribed` repeating it
        this.rideData = { ...this.rideData, status };
        this.targetChanged();
        if (TERMINAL_STATUSES.includes(status)) {
          this.etaBase = null;
          this.eta = null;
        }
        this.updateConnectionNote();
        this.scheduleMapUpdate();
      },
      onEta: (eta) => {
        this.etaBase = { eta, receivedAt: Date.now(), fromServer: true };
        this.refreshEta();
        if (eta.polyline && this.etaRoute) {
          const path = decodePolyline(eta.polyline);
          const first = this.etaRoute.getPath().getLength() === 0;
          this.etaRoute.setPath(path);
          this.directionsRenderer?.setDirections({ routes: [] });
          this.routeCalculated = true;
          if (first && path.length > 1) {
            const bounds = new google.maps.LatLngBounds();
            path.forEach((p) => bounds.extend(p));
            this.fitMapToBounds(bounds);
          }
        }
      },
      onPresence: (online) => {
        this.driverOnline = online;
        this.updateConnectionNote();
      },
      onConnection: (state) => {
        this.socketConnected = state === 'connected';
        this.status = state === 'connected' ? 'Connected' : state === 'connecting' ? 'Connecting...' : 'Reconnecting...';
        if (state === 'connected') this.error = null;
        this.updateConnectionNote();
      },
      onExpired: (reason) => {
        const over = this.rideData && TERMINAL_STATUSES.includes(this.rideData.status);
        if (!over) {
          this.error = reason === 'expired'
            ? 'This tracking link has expired.'
            : 'This tracking link is not valid.';
        }
        this.status = 'Disconnected';
        this.socketConnected = false;
        this.connectionNote = null;
        clearInterval(this.tickTimer);
      }
    });
    this.shareClient.start();
    // Counts the ETA down between server refreshes and notices a location that stopped coming.
    this.tickTimer = setInterval(() => {
      this.refreshEta();
      this.updateConnectionNote();
    }, 5000);
  }

  /** The leg changed (status or stop): the old ETA and route belong to the previous target. */
  private targetChanged(): void {
    this.etaBase = null;
    this.eta = null;
    this.etaRoute?.setPath([]);
    this.lastRouteUpdate = 0;
    this.routeCalculated = false;
  }

  /** Where the driver is heading now; mirrors limo-rt's `target_for` (eta.py). */
  private routeTarget(): { kind: 'pickup' | 'stop' | 'dropoff'; point: any; number?: number } | null {
    const d = this.rideData;
    if (!d?.status) return null;
    const status: string = d.status;
    const valid = (p: any) => p && typeof p.lat === 'number' && !isNaN(p.lat) && typeof p.lng === 'number' && !isNaN(p.lng);
    const pickup = valid(d.pickup) ? { kind: 'pickup' as const, point: d.pickup } : null;
    const dropoff = valid(d.dropoff) ? { kind: 'dropoff' as const, point: d.dropoff } : null;

    if (status === 'en_route_pu' || status === 'en_route' || (!this.viewerMode && status.includes('pu'))) return pickup;
    if (status === 'on_location' || TERMINAL_STATUSES.includes(status)) return null;
    if (!this.viewerMode || !this.stops.length) return dropoff; // legacy path: no stop data
    if (status === 'en_route_do') return dropoff;
    if (status !== 'start_ride' && status !== 'passenger_pick') return null; // assigned, or at a stop
    const index = status === 'start_ride' || this.currentStopIndex === null ? 0 : this.currentStopIndex + 1;
    // A stop without coordinates can't be routed to: head for the next one that has them.
    for (let i = index; i < this.stops.length; i++) {
      const stop = this.stops[i];
      if (valid(stop)) return { kind: 'stop', point: { lat: stop.lat, lng: stop.lng }, number: stop.number };
    }
    return dropoff;
  }

  /** Rebuild the displayed ETA from the latest one, counted down by the time since it came. */
  private refreshEta(): void {
    if (!this.etaBase) return;
    const { eta, receivedAt } = this.etaBase;
    const elapsed = Date.now() - receivedAt;
    const minutes = (seconds: number) => Math.max(0, Math.round((seconds * 1000 - elapsed) / 60000));
    const text = (seconds: number) => (minutes(seconds) < 1 ? 'Arriving now' : `${minutes(seconds)} min`);
    const target = eta.target;
    const label = eta.leg === 'pickup'
      ? 'to pickup'
      : eta.leg === 'stop' && target?.number
        ? `to stop ${target.number}${target.total ? ` of ${target.total}` : ''}`
        : 'to destination';
    this.eta = {
      text: text(eta.duration_s),
      arriveAt: new Date(receivedAt + eta.duration_s * 1000),
      label,
      finalText: eta.final ? text(eta.final.duration_s) : null,
      finalArriveAt: eta.final ? new Date(receivedAt + eta.final.duration_s * 1000) : null
    };
  }

  /** Share mode: one short line about the connection, or null when everything is live. */
  private updateConnectionNote(): void {
    if (!this.viewerMode) return;
    const status = this.rideData?.status;
    let note: string | null = null;
    if (status && TERMINAL_STATUSES.includes(status)) {
      note = null;
    } else if (!this.socketConnected) {
      note = 'Reconnecting…';
    } else if (!this.driverOnline) {
      note = 'Driver connection lost, showing last known location';
    } else if (this.lastFixAt && Date.now() - this.lastFixAt > STALE_FIX_MS && this.routeTarget()) {
      note = 'Updating location…';
    }
    this.connectionNote = note;
    // A position that may be old is drawn faded.
    this.markers.driver?.setOpacity(note ? 0.5 : 1);
  }

  private scheduleMapUpdate(): void {
    if (this.mapUpdateTimer) return;
    this.mapUpdateTimer = setTimeout(() => {
      this.mapUpdateTimer = null;
      this.updateMapVisuals();
    }, 100);
  }

  private processRideData(incomingData: any, type: string): void {
    let lat: number, lng: number, bookingId: any;

    // Extract Driver Location from driver.location.update event
    // Backend payload structure: { latitude, longitude, bookingId, customerId, ... }
    if (type === 'driver_loc') {
      lat = parseFloat(incomingData.latitude);
      lng = parseFloat(incomingData.longitude);
      bookingId = incomingData.bookingId || incomingData.booking_id;
      
      // Additional validation: only process if bookingId matches current ride
      if (this.currentBookingId && bookingId && 
          bookingId.toString() !== this.currentBookingId.toString()) {
        return;
      }
    } else {
      // Extract from active_ride or user.notifications payload
      const d = incomingData.data || incomingData;
      lat = parseFloat(d.driver_latitude || d.driver_lat || d.location?.latitude);
      lng = parseFloat(d.driver_longitude || d.driver_lng || d.location?.longitude);
      bookingId = d.booking_id || d.bookingId;
      
      // Store bookingId and customerId for room management
      if (bookingId && !this.currentBookingId) {
        this.currentBookingId = bookingId;
      }
      const customerId = d.customer_id || d.customerId || (d.customer?.id);
      if (customerId && !this.currentCustomerId) {
        this.currentCustomerId = customerId;
      }
    }

    // Update Path History
    if (!isNaN(lat) && !isNaN(lng)) {
      const last = this.pathHistory[this.pathHistory.length - 1];
      if (!last || Math.abs(last.lat - lat) > 0.0001 || Math.abs(last.lng - lng) > 0.0001) {
        this.pathHistory = [...this.pathHistory, { lat, lng }];
      }
    }

    if (type === 'driver_loc') {
      this.rideData = {
        ...this.rideData,
        driver_lat: lat,
        driver_lng: lng
      };
      // The route (and ETA) refresh on their own timer: a Directions request per fix
      // would be one a second with limo-rt.
      this.scheduleMapUpdate();
      return;
    }

    let data = incomingData.data || incomingData;
    if (type === 'notification') {
      if (!['live_ride', 'live_ride_do', 'on_location', 'ended'].includes(incomingData.type)) return;
      data = incomingData.data || {};
    }

    const locations = data.locations || {};
    const driver = data.driver || {};
    const vehicle = data.vehicle || driver.vehicle || {};

    this.rideData = {
      booking_id: data.booking_id || data.bookingId,
      status: data.status || incomingData.type || 'In Progress',
      // Keep the last known id: status notifications don't always carry the driver block,
      // and losing it would flip the chat to read-only mid-ride.
      driver_id: driver.id ?? data.driver_id ?? data.driverId ?? this.rideData?.driver_id ?? null,
      driver_name: driver.name || `${driver.first_name || ''} ${driver.last_name || ''}`.trim() || 'Assigned Driver',
      driver_phone: driver.phone || driver.mobile,
      vehicle_info: vehicle.vehicle_type || vehicle.type || data.vehicle_info || 'Vehicle',
      vehicle_plate: vehicle.plate_number || vehicle.plate || '',
      pickup: {
        address: locations.pickup?.address || data.pickup_address,
        lat: parseFloat(locations.pickup?.latitude || data.pickup_latitude || data.pickup_lat),
        lng: parseFloat(locations.pickup?.longitude || data.pickup_longitude || data.pickup_lng)
      },
      dropoff: {
        address: locations.dropoff?.address || data.dropoff_address,
        lat: parseFloat(locations.dropoff?.latitude || data.dropoff_latitude || data.dropoff_lat),
        lng: parseFloat(locations.dropoff?.longitude || data.dropoff_longitude || data.dropoff_lng)
      },
      driver_lat: lat,
      driver_lng: lng,
      pickup_time: (data.timestamps && data.timestamps.pickup_time) || data.pickup_datetime || data.pickupDateTime
    };

    this.lastRouteUpdate = 0; // status may have changed the leg
    this.scheduleMapUpdate();
  }

  private updateMapVisuals(): void {
    if (!this.rideData || !this.googleMap) return;

    // Car Icon - Using custom car logo image
    const carIcon = {
      url: 'assets/images/car_logo.png',
      scaledSize: new google.maps.Size(48, 48),
      anchor: new google.maps.Point(24, 24),
      optimized: false // Prevent Google Maps from optimizing the image
    };

    const getPin = (color: string) => ({
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="${color}" stroke="white" stroke-width="3"/><circle cx="12" cy="12" r="3" fill="white"/></svg>`)}`,
      scaledSize: new google.maps.Size(24, 24),
      anchor: new google.maps.Point(12, 12)
    });

    // Update Driver Marker (Car Icon) - Always update position if driver location exists
    if (this.rideData.driver_lat && !isNaN(this.rideData.driver_lat) && 
        this.rideData.driver_lng && !isNaN(this.rideData.driver_lng)) {
      const pos = { lat: this.rideData.driver_lat, lng: this.rideData.driver_lng };
      if (!this.markers.driver) {
        this.markers.driver = new google.maps.Marker({
          position: pos,
          map: this.googleMap,
          icon: carIcon,
          zIndex: 100,
          title: 'Driver Location'
        });
      } else {
        this.markers.driver.setPosition(pos);
        this.markers.driver.setVisible(true);
      }
    } else if (this.markers.driver) {
      // Hide driver marker if no location
      this.markers.driver.setVisible(false);
    }

    // Update Pickup Marker - Always create/update if coordinates exist
    if (this.rideData.pickup && this.rideData.pickup.lat && !isNaN(this.rideData.pickup.lat) && 
        this.rideData.pickup.lng && !isNaN(this.rideData.pickup.lng)) {
      const pickupPos = { lat: this.rideData.pickup.lat, lng: this.rideData.pickup.lng };
      if (!this.markers.pickup) {
        this.markers.pickup = new google.maps.Marker({
          position: pickupPos,
          map: this.googleMap,
          icon: getPin('#10b981'),
          title: 'Pickup Location',
          zIndex: 50
        });
      } else {
        this.markers.pickup.setPosition(pickupPos);
        this.markers.pickup.setVisible(true);
      }
    } else if (this.markers.pickup) {
      this.markers.pickup.setVisible(false);
    }

    // Update Dropoff Marker - Always create/update if coordinates exist
    if (this.rideData.dropoff && this.rideData.dropoff.lat && !isNaN(this.rideData.dropoff.lat) && 
        this.rideData.dropoff.lng && !isNaN(this.rideData.dropoff.lng)) {
      const dropoffPos = { lat: this.rideData.dropoff.lat, lng: this.rideData.dropoff.lng };
      if (!this.markers.dropoff) {
        this.markers.dropoff = new google.maps.Marker({
          position: dropoffPos,
          map: this.googleMap,
          icon: getPin('#111827'),
          title: 'Dropoff Location',
          zIndex: 50
        });
      } else {
        this.markers.dropoff.setPosition(dropoffPos);
        this.markers.dropoff.setVisible(true);
      }
    } else if (this.markers.dropoff) {
      this.markers.dropoff.setVisible(false);
    }

    this.updateStopMarkers();

    // Update Path History
    if (this.historyPolyline) {
      this.historyPolyline.setPath(this.pathHistory);
    }

    // Route Logic - Calculate routes
    const now = Date.now();
    const target = this.routeTarget();
    // limo-rt already sends a traffic-aware route + ETA for this leg: no Directions call.
    const serverRoute = !!this.etaBase?.fromServer && !!target;
    const shouldUpdateDriverRoute = !serverRoute && (!this.routeCalculated || (now - this.lastRouteUpdate > ROUTE_REFRESH_MS));
    const directionsService = new google.maps.DirectionsService();
    const hasDriver = this.rideData.driver_lat && !isNaN(this.rideData.driver_lat);
    if (!target) {
      // Nobody is driving towards anything (arrived, at a stop, over): no route line.
      this.directionsRenderer?.setDirections({ routes: [] });
      this.etaRoute?.setPath([]);
    }

    // ALWAYS show pickup to dropoff route if both locations are available
    // This route is static and only needs to be calculated once when coordinates are available
    if (this.rideData.pickup && this.rideData.pickup.lat && !isNaN(this.rideData.pickup.lat) && 
        this.rideData.pickup.lng && !isNaN(this.rideData.pickup.lng) &&
        this.rideData.dropoff && this.rideData.dropoff.lat && !isNaN(this.rideData.dropoff.lat) && 
        this.rideData.dropoff.lng && !isNaN(this.rideData.dropoff.lng)) {
      
      // Calculate pickup-to-dropoff route if not already calculated
      if (!this.pickupToDropoffRouteCalculated && this.directionsRendererPickupToDropoff) {
        this.pickupToDropoffRouteCalculated = true; // one request in flight, not one per update
        directionsService.route({
          origin: this.rideData.pickup,
          destination: this.rideData.dropoff,
          // Through the extra stops (share links know them); Directions allows 25.
          waypoints: this.stops
            .filter((s) => typeof s.lat === 'number' && typeof s.lng === 'number')
            .slice(0, 25)
            .map((s) => ({ location: { lat: s.lat, lng: s.lng }, stopover: true })),
          travelMode: google.maps.TravelMode.DRIVING
        }, (response: any, status: any) => {
          if (status === 'OK') {
            this.directionsRendererPickupToDropoff.setDirections(response);
          } else {
            // Not retried: with location updates every second a failing route would be
            // requested every second. The trip line just stays off.
            console.error('Failed to calculate pickup-to-dropoff route:', status);
          }
        });
      }
    }

    // Calculate driver route (to pickup or dropoff based on status)
    // This route updates frequently as driver moves
    if (shouldUpdateDriverRoute && hasDriver && target) {
      const origin = { lat: this.rideData.driver_lat, lng: this.rideData.driver_lng };
      const destination = target.point;
      // Set before the answer comes back, so the next location update doesn't ask again.
      this.lastRouteUpdate = now;
      const sameTarget = () => {
        const current = this.routeTarget()?.point;
        return !!current && current.lat === destination.lat && current.lng === destination.lng;
      };

      {
        directionsService.route({
          origin: origin,
          destination: destination,
          travelMode: google.maps.TravelMode.DRIVING
        }, (response: any, status: any) => {
          // A server ETA (or a new leg) arrived while this was in flight: it's out of date.
          if (this.etaBase?.fromServer || !sameTarget()) return;
          if (status === 'OK') {
            const isFirstCalculation = !this.routeCalculated;
            this.directionsRenderer.setDirections(response);
            this.routeCalculated = true;

            const leg = response.routes?.[0]?.legs?.[0];
            if (leg && target.kind === 'pickup') {
              this.estimatedTimeToPickup = leg.duration?.text || null;
              this.estimatedDistanceToPickup = leg.distance?.text || null;
            }
            // Share links without a server ETA (no Routes key on limo-rt): same panel, from here.
            if (leg && this.viewerMode && typeof leg.duration?.value === 'number') {
              this.etaBase = {
                eta: {
                  leg: target.kind,
                  target: { kind: target.kind, index: null, number: target.number ?? null, total: this.stops.length || null, lat: destination.lat, lng: destination.lng },
                  duration_s: leg.duration.value,
                  distance_m: leg.distance?.value ?? 0,
                  polyline: null,
                  final: null
                },
                receivedAt: Date.now(),
                fromServer: false
              };
              this.refreshEta();
            }
            
            // On first calculation, zoom to the leg the driver is actually on (its full
            // polyline, not just the endpoints) — fitting the whole trip left the active
            // route tiny on longer rides.
            if (isFirstCalculation) {
              const bounds = response.routes[0]?.bounds || new google.maps.LatLngBounds();
              bounds.extend(origin);
              bounds.extend(destination);
              this.fitMapToBounds(bounds);
            }
          } else {
            console.error('Directions request failed:', status);
          }
        });
      }
    } else if (!this.routeCalculated && !hasDriver) {
      // If no driver location, center on pickup/dropoff
      const bounds = new google.maps.LatLngBounds();
      if (this.rideData.pickup && this.rideData.pickup.lat && !isNaN(this.rideData.pickup.lat)) {
        bounds.extend(this.rideData.pickup);
      }
      if (this.rideData.dropoff && this.rideData.dropoff.lat && !isNaN(this.rideData.dropoff.lat)) {
        bounds.extend(this.rideData.dropoff);
      }
      if (!bounds.isEmpty()) {
        this.fitMapToBounds(bounds);
      } else if (this.rideData.pickup && this.rideData.pickup.lat && !isNaN(this.rideData.pickup.lat)) {
        this.googleMap.setCenter(this.rideData.pickup);
        this.googleMap.setZoom(13);
      }
    }
  }

  handleRecenter(): void {
    if (!this.googleMap || !this.rideData) return;

    const bounds = new google.maps.LatLngBounds();
    let hasPoints = false;

    // Add Driver
    if (this.rideData.driver_lat && !isNaN(this.rideData.driver_lat)) {
      bounds.extend({ lat: this.rideData.driver_lat, lng: this.rideData.driver_lng });
      hasPoints = true;
    }

    // Add Destination Context: where the driver is heading (pickup, next stop or dropoff)
    const target = this.routeTarget();
    if (target) {
      bounds.extend(target.point);
      hasPoints = true;
    } else if (this.rideData.status.includes('pu') && this.rideData.pickup.lat) {
      bounds.extend(this.rideData.pickup);
      hasPoints = true;
    } else if (this.rideData.dropoff.lat) {
      bounds.extend(this.rideData.dropoff);
      hasPoints = true;
    }

    if (hasPoints) {
      this.fitMapToBounds(bounds);
    } else if (this.rideData.pickup.lat) {
      this.googleMap.setCenter(this.rideData.pickup);
      this.googleMap.setZoom(15);
    }
  }

  /**
   * Fit the map tightly around `bounds`, padding only the side the info panel covers (left
   * on desktop, the bottom sheet on mobile) so the route sits in the visible part of the map
   * instead of underneath the card. Zoom is capped so two nearby points (driver already at
   * pickup) don't zoom in to street-number level.
   */
  private fitMapToBounds(bounds: any): void {
    if (!this.googleMap || !bounds || bounds.isEmpty()) return;

    const container: HTMLElement | null = this.mapContainer.nativeElement.parentElement;
    const panel = container?.querySelector('.info-panel') as HTMLElement | null;
    const isMobile = window.innerWidth <= 640;
    const edge = 40;
    const padding = { top: edge + 40, right: edge + 40, bottom: edge, left: edge }; // 40 = recenter button

    if (panel) {
      if (isMobile) {
        padding.bottom = Math.min(panel.offsetHeight + edge, window.innerHeight * 0.65);
        padding.top = edge + 20;
      } else {
        // On mid-size windows the panel can be most of the width; padding past half the
        // map makes fitBounds zoom far *out*, the opposite of what we want.
        padding.left = Math.min(panel.offsetLeft + panel.offsetWidth + edge, window.innerWidth * 0.5);
      }
    }

    this.googleMap.fitBounds(bounds, padding);

    const MAX_ZOOM = 16;
    google.maps.event.addListenerOnce(this.googleMap, 'idle', () => {
      if (this.googleMap.getZoom() > MAX_ZOOM) this.googleMap.setZoom(MAX_ZOOM);
    });
  }

  /** Numbered markers for the extra stops (share links); rebuilt only when the stops change. */
  private updateStopMarkers(): void {
    const key = JSON.stringify(this.stops.map((s) => [s.number, s.lat, s.lng]));
    if (key === this.stopMarkersKey) return;
    this.stopMarkersKey = key;
    this.stopMarkers.forEach((m) => m.setMap(null));
    this.stopMarkers = this.stops
      .filter((s) => typeof s.lat === 'number' && typeof s.lng === 'number')
      .map((s) => new google.maps.Marker({
        position: { lat: s.lat, lng: s.lng },
        map: this.googleMap,
        title: `Stop ${s.number}${s.address ? `: ${s.address}` : ''}`,
        zIndex: 60,
        icon: {
          url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26"><circle cx="13" cy="13" r="11" fill="#f97316" stroke="white" stroke-width="2.5"/><text x="13" y="17.5" text-anchor="middle" font-family="Arial,sans-serif" font-size="12" font-weight="700" fill="white">${s.number}</text></svg>`)}`,
          scaledSize: new google.maps.Size(26, 26),
          anchor: new google.maps.Point(13, 13)
        }
      }));
  }

  /** Status title, with the stop on a multi-stop ride ("At stop 2 of 3"). */
  statusTitle(): string {
    const status: string = this.rideData?.status;
    const total = this.stops.length;
    if (this.viewerMode && total && this.currentStopIndex !== null) {
      const number = this.currentStopIndex + 1;
      if (status === 'passenger_drop') return `At stop ${number} of ${total}`;
    }
    if (this.viewerMode && total && (status === 'start_ride' || status === 'passenger_pick')) {
      const target = this.routeTarget();
      if (target?.kind === 'stop' && target.number) return `On the way to stop ${target.number} of ${total}`;
    }
    return this.getStatusText(status);
  }

  getStatusText(status: string): string {
    const map: { [key: string]: string } = {
      'assigned': 'Driver Assigned',
      'en_route_pu': 'Driver Arriving',
      'on_location': 'Driver Arrived',
      'start_ride': 'Ride In Progress',
      'passenger_drop': 'At a Stop',
      'passenger_pick': 'Ride In Progress',
      'en_route_do': 'Heading to Destination',
      'ended': 'Trip Completed',
      'finalized': 'Trip Completed',
      'cancelled': 'Ride Cancelled'
    };
    return map[status] || status || 'In Progress';
  }

  encodeId(id) {
    const SECRET = 'LIMO_LIVE_TRACK_SECRET_2026';
    const ts = Math.floor(Date.now() / 1000);
    const raw = `${id}:${ts}:${SECRET}`;
  
    let hash = 2166136261;
    for (let i = 0; i < raw.length; i++) {
      hash ^= raw.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
  
    const hashPart = Math.abs(hash).toString(36);
    const idPart = id.toString(36);
  
    // IMPORTANT: "|" is the separator
    return `${hashPart}|${idPart}`
      .padEnd(32, 'x')
      .slice(0, 32);
  }
  
  decodeId(token) {
    if (!token || token.length !== 32) return null;
  
    const core = token.replace(/x+$/, '');
    const parts = core.split('|');
  
    if (parts.length !== 2) return null;
  
    const userId = parseInt(parts[1], 36);
    return isNaN(userId) ? null : userId;
  }

  /**
   * Join a specific room (matching backend requirements)
   * Backend emits events ONLY to rooms that clients have explicitly joined
   * 
   * @param roomId - The room identifier (customerId preferred, bookingId as fallback)
   * @param roomType - Type of room for logging purposes
   */
  private joinRoom(roomId: string | null, roomType: 'customerId' | 'bookingId'): void {
    if (!this.socket || !this.socket.connected) {
      console.warn(`Cannot join ${roomType} room - socket not connected`);
      return;
    }

    if (!roomId) {
      console.warn(`Cannot join ${roomType} room - room ID is not available`);
      return;
    }

    const roomData = {
      room: roomId
    };

    console.log(`Joining ${roomType} room:`, roomId);
    
    // Emit join-room event (backend requirement)
    // Backend will add this socket to the specified room
    this.socket.emit('join-room', roomData, (response: any) => {
      if (response && response.error) {
        console.error(`Failed to join ${roomType} room:`, response.error);
      } else {
        console.log(`Successfully joined ${roomType} room:`, roomId);
      }
    });
  }
}
