import {
  Component, Input, Output, EventEmitter, OnChanges, OnDestroy, SimpleChanges,
  ViewChild, ElementRef, AfterViewChecked
} from '@angular/core';
import { Socket } from 'socket.io-client';
import { environment } from '../../../../../environments/environment';

/** A chat row as limo-rt returns it (GET /rt/v1/rides/{id}/messages). */
interface RtChatMessage {
  id: string;
  from: 'rider' | 'driver' | 'admin' | string;
  sender_id: string;
  receiver_id: string | null;
  body: string;
  client_msg_id: string | null;
  at: number; // epoch ms
  read_at: number | null;
}

/** A persisted chat row as limoRTService stores and broadcasts it. */
interface ServerChatMessage {
  _id: string;
  bookingId: number | string;
  senderId: string;
  receiverId: string;
  senderRole: string;
  message: string;
  createdAt: string;
}

interface ChatBubble {
  id: string;
  text: string;
  timestamp: Date;
  isFromUser: boolean;
  /** Optimistic copy awaiting the server's `chat.message.sent` ack / room echo. */
  pending?: boolean;
  failed?: boolean;
  /** Client-generated id the server echoes back so we can reconcile the optimistic bubble. */
  clientMessageId?: string;
}

/**
 * Passenger ↔ driver chat for the live ride tracking page — the web counterpart of the
 * iOS user app's ChatView. Rides on the tracking page's existing socket rather than
 * opening a second one, so it shares that connection's booking room membership.
 */
@Component({
  selector: 'app-ride-chat',
  templateUrl: './ride-chat.component.html',
  styleUrls: ['./ride-chat.component.scss']
})
export class RideChatComponent implements OnChanges, OnDestroy, AfterViewChecked {
  @Input() socket: Socket | null = null;
  @Input() serverUrl = '';
  @Input() secret = '';
  /** Bearer for limo-rt's chat REST: the passenger's Passport token (or the share token). */
  @Input() rtToken = '';
  @Input() bookingId: string | number | null = null;
  /** Null until a driver is assigned — the thread then opens read-only. */
  @Input() driverId: string | number | null = null;
  @Input() driverName = 'Driver';
  /** The socket's authenticated userId; the server stamps it as `senderId` on our sends. */
  @Input() customerId: string | number | null = null;
  @Input() open = false;

  @Output() closed = new EventEmitter<void>();
  @Output() unreadChange = new EventEmitter<number>();
  /** A live (not history) message from the driver just arrived. */
  @Output() incoming = new EventEmitter<void>();

  @ViewChild('messagesList') messagesList?: ElementRef<HTMLElement>;

  messages: ChatBubble[] = [];
  newMessageText = '';
  isLoading = false;
  errorMessage: string | null = null;

  readonly quickReplies = [
    'Please wait, I\'ll be there soon',
    'I\'m at the pickup point',
    'I\'m on the way',
    'Running a few minutes late',
    'Can you share your location?',
    'Thank you!'
  ];

  /** Chime on incoming driver messages. Remembered per browser. */
  voiceEnabled = true;

  private unread = 0;
  private shouldScroll = false;
  private boundSocket: Socket | null = null;
  private audioCtx: AudioContext | null = null;
  private static readonly VOICE_PREF_KEY = 'rideChatVoiceEnabled';
  /** Share links have no socket: limo-rt history is re-read on this interval instead. */
  private static readonly SHARE_POLL_MS = 10_000;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * Browsers refuse to play audio until the page has had a user gesture. The
   * tracking page is usually opened from an SMS link and then just watched, so unlock on
   * the first tap/keypress anywhere rather than waiting for the chat to be touched.
   */
  private readonly unlockAudio = () => {
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (Ctx && !this.audioCtx) this.audioCtx = new Ctx();
      this.audioCtx?.resume();
    } catch { /* audio unsupported — chat still works silently */ }
    document.removeEventListener('pointerdown', this.unlockAudio);
    document.removeEventListener('keydown', this.unlockAudio);
  };

  private readonly onChatMessage = (d: any) => this.handleIncoming(d?.message || d, d?.clientMessageId);
  private readonly onMessageSent = (d: any) => {
    if (d?.success && d.message) this.handleIncoming(d.message, d.clientMessageId);
  };
  private readonly onChatError = (d: any) => {
    const bubble = this.messages.find(m => m.clientMessageId && m.clientMessageId === d?.clientMessageId);
    if (bubble) {
      bubble.pending = false;
      bubble.failed = true;
    }
    this.errorMessage = d?.message || 'Message could not be sent';
  };
  // Fires on every (re)connect: refill anything missed while the socket was down.
  private readonly onConnect = () => this.loadHistory();

  constructor() {
    try {
      this.voiceEnabled = localStorage.getItem(RideChatComponent.VOICE_PREF_KEY) !== 'false';
    } catch { /* storage blocked — keep default */ }
    document.addEventListener('pointerdown', this.unlockAudio);
    document.addEventListener('keydown', this.unlockAudio);
  }

  get isConnected(): boolean {
    return !!this.socket?.connected;
  }

  /** Opened from a share link: limo-rt only, no socket. History is polled and sends go
   * over REST with the share token (limo-rt posts them as the ride's passenger). */
  get shareMode(): boolean {
    return !this.socket && !!this.rtToken;
  }

  get canSendMessages(): boolean {
    return this.driverId !== null && this.driverId !== undefined && String(this.driverId) !== '';
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['socket']) {
      this.bindSocket();
    }
    // Unread is reset silently here — emitting from inside the parent's change detection
    // would trip ExpressionChangedAfterItHasBeenChecked. The parent zeroes its own badge
    // when it opens the panel.
    if (changes['bookingId'] && this.bookingId) {
      this.messages = [];
      this.unread = 0;
      this.loadHistory();
    }
    if (changes['socket'] || changes['rtToken'] || changes['bookingId']) {
      this.syncPolling();
    }
    if (changes['open'] && this.open) {
      this.unread = 0;
      this.shouldScroll = true;
    }
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll && this.messagesList) {
      const el = this.messagesList.nativeElement;
      el.scrollTop = el.scrollHeight;
      this.shouldScroll = false;
    }
  }

  ngOnDestroy(): void {
    this.stopPolling();
    this.unbindSocket();
    document.removeEventListener('pointerdown', this.unlockAudio);
    document.removeEventListener('keydown', this.unlockAudio);
    this.audioCtx?.close();
  }

  close(): void {
    this.closed.emit();
  }

  toggleVoice(): void {
    this.voiceEnabled = !this.voiceEnabled;
    try {
      localStorage.setItem(RideChatComponent.VOICE_PREF_KEY, String(this.voiceEnabled));
    } catch { /* storage blocked — preference lasts for this page only */ }
  }

  sendMessage(text: string = this.newMessageText): void {
    const message = text.trim();
    if (!message || !this.canSendMessages || !this.bookingId) return;

    if (this.shareMode) {
      this.sendViaRt(message, text === this.newMessageText);
      return;
    }

    if (!this.socket?.connected) {
      this.errorMessage = 'Not connected to chat server';
      this.socket?.connect();
      return;
    }

    const clientMessageId = `web-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    this.messages = [...this.messages, {
      id: clientMessageId,
      clientMessageId,
      text: message,
      timestamp: new Date(),
      isFromUser: true,
      pending: true
    }];
    this.shouldScroll = true;
    this.errorMessage = null;
    if (text === this.newMessageText) this.newMessageText = '';

    this.socket.emit('chat.message', {
      bookingId: Number(this.bookingId),
      receiverId: String(this.driverId),
      message,
      clientMessageId
    });
  }

  retry(bubble: ChatBubble): void {
    this.messages = this.messages.filter(m => m !== bubble);
    this.sendMessage(bubble.text);
  }

  formatTime(date: Date): string {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).toLowerCase();
  }

  trackById(_: number, m: ChatBubble): string {
    return m.id;
  }

  /** Share link: POST /rt/v1/rides/{id}/messages with the share token; the saved row
   * replaces the optimistic bubble. A retry with the same client_msg_id is not stored twice. */
  private async sendViaRt(message: string, fromInput: boolean): Promise<void> {
    const base = RideChatComponent.rtRestBase();
    const bookingId = this.bookingId;
    if (!base || !bookingId) return;

    const clientMessageId = `web-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    this.messages = [...this.messages, {
      id: clientMessageId,
      clientMessageId,
      text: message,
      timestamp: new Date(),
      isFromUser: true,
      pending: true
    }];
    this.shouldScroll = true;
    this.errorMessage = null;
    if (fromInput) this.newMessageText = '';

    try {
      const res = await fetch(`${base}/rides/${bookingId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.rtToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({ body: message, client_msg_id: clientMessageId })
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.message) {
        throw new Error(body?.error?.message || `Message could not be sent (HTTP ${res.status})`);
      }
      const saved = this.toBubble(this.fromRt(body.message as RtChatMessage, bookingId));
      this.messages = this.messages.some(m => m.id === saved.id)
        ? this.messages.filter(m => m.clientMessageId !== clientMessageId) // a poll got it first
        : this.messages.map(m => (m.clientMessageId === clientMessageId ? saved : m));
    } catch (error: any) {
      console.error('RideChat: send failed', error);
      const bubble = this.messages.find(m => m.clientMessageId === clientMessageId);
      if (bubble) {
        bubble.pending = false;
        bubble.failed = true;
      }
      this.errorMessage = error?.message || 'Message could not be sent';
    }
  }

  private syncPolling(): void {
    const wanted = this.shareMode && !!this.bookingId;
    if (wanted && !this.pollTimer) {
      this.pollTimer = setInterval(() => this.loadHistory(true), RideChatComponent.SHARE_POLL_MS);
    } else if (!wanted) {
      this.stopPolling();
    }
  }

  private stopPolling(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
  }

  private bindSocket(): void {
    if (this.boundSocket === this.socket) return;
    this.unbindSocket();
    if (!this.socket) return;

    this.socket.on('chat.message', this.onChatMessage);
    this.socket.on('chat.message.sent', this.onMessageSent);
    this.socket.on('chat.error', this.onChatError);
    this.socket.on('connect', this.onConnect);
    this.boundSocket = this.socket;
  }

  private unbindSocket(): void {
    if (!this.boundSocket) return;
    this.boundSocket.off('chat.message', this.onChatMessage);
    this.boundSocket.off('chat.message.sent', this.onMessageSent);
    this.boundSocket.off('chat.error', this.onChatError);
    this.boundSocket.off('connect', this.onConnect);
    this.boundSocket = null;
  }

  /**
   * Plain fetch rather than HttpClient on purpose: the app's interceptors would attach the
   * API bearer token to this third-party origin, and on a 401 they clear localStorage and
   * pop the global error dialog — neither belongs on a public tracking page.
   */
  /** @param refresh a share-link poll: quiet on errors, and new driver messages count as live. */
  private async loadHistory(refresh = false): Promise<void> {
    const base = RideChatComponent.rtRestBase();
    if (!this.bookingId || !base || !this.rtToken) return;
    const bookingId = this.bookingId;

    this.isLoading = !refresh && this.messages.length === 0;
    try {
      // limo-rt: GET /rt/v1/rides/{id}/messages -> {messages: [...]}, oldest first.
      const res = await fetch(`${base}/rides/${bookingId}/messages?limit=200`, {
        headers: { Authorization: `Bearer ${this.rtToken}`, Accept: 'application/json' }
      });
      const body = await res.json().catch(() => null);
      if (String(bookingId) !== String(this.bookingId)) return; // booking changed mid-flight
      if (res.status === 401 || res.status === 403) {
        this.stopPolling(); // link expired (ride over) or not allowed: asking again won't help
      }
      if (!res.ok || !Array.isArray(body?.messages)) {
        throw new Error(body?.error?.message || `Failed to load chat history (HTTP ${res.status})`);
      }
      this.mergeHistory((body.messages as RtChatMessage[]).map(m => this.fromRt(m, bookingId)), refresh);
    } catch (error: any) {
      console.error('RideChat: failed to load history', error);
      if (!refresh) this.errorMessage = 'Couldn\'t load earlier messages';
    } finally {
      this.isLoading = false;
    }
  }

  private mergeHistory(rows: ServerChatMessage[], live = false): void {
    const known = new Set(this.messages.map(m => m.id));
    const added = rows
      .filter(r => String(r.bookingId) === String(this.bookingId) && !known.has(r._id))
      .map(r => this.toBubble(r));
    if (!added.length) return;

    // A pending send can land in history (reconnect) before its echo: the saved row replaces it.
    let current = this.messages;
    for (const row of added) {
      if (!row.isFromUser) continue;
      const idx = current.findIndex(m => m.pending && m.text === row.text);
      if (idx >= 0) current = current.filter((_, i) => i !== idx);
    }

    // Server ordering for this endpoint isn't documented, so always sort by createdAt.
    this.messages = [...current, ...added].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    this.shouldScroll = true;

    // Share-link poll: driver messages that just appeared behave like socket arrivals.
    const fromDriver = live ? added.filter(b => !b.isFromUser).length : 0;
    if (fromDriver) {
      if (!this.open) this.setUnread(this.unread + fromDriver);
      this.announce();
      this.incoming.emit();
    }
  }

  private handleIncoming(row: ServerChatMessage | null, clientMessageId?: string): void {
    if (!row?._id || String(row.bookingId) !== String(this.bookingId)) return;
    if (this.messages.some(m => m.id === row._id)) return;

    const bubble = this.toBubble(row);

    // Our own send coming back (as the ack or the room broadcast): replace the optimistic copy.
    // limoRTService doesn't echo clientMessageId, so fall back to the oldest pending bubble
    // with the same text — otherwise each send shows twice, one stuck on "Sending".
    let optimisticIdx = clientMessageId
      ? this.messages.findIndex(m => m.clientMessageId === clientMessageId)
      : -1;
    if (optimisticIdx < 0 && bubble.isFromUser) {
      optimisticIdx = this.messages.findIndex(m => m.pending && m.text === bubble.text);
    }
    if (optimisticIdx >= 0) {
      const next = [...this.messages];
      next[optimisticIdx] = bubble;
      this.messages = next;
      return;
    }

    this.messages = [...this.messages, bubble];
    this.shouldScroll = true;
    if (!bubble.isFromUser) {
      if (!this.open) this.setUnread(this.unread + 1);
      this.announce();
      this.incoming.emit();
    }
  }

  /** Short two-note notification chime. */
  private announce(): void {
    if (!this.voiceEnabled) return;

    try {
      const ctx = this.audioCtx;
      if (ctx && ctx.state === 'running') {
        [880, 1320].forEach((freq, i) => {
          const start = ctx.currentTime + i * 0.15;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0.0001, start);
          gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.3);
          osc.connect(gain).connect(ctx.destination);
          osc.start(start);
          osc.stop(start + 0.32);
        });
      }
    } catch { /* chime is best-effort */ }
  }

  /** limo-rt's REST base from the socket URL: `wss://host/rt/v1/ws` -> `https://host/rt/v1`. */
  private static rtRestBase(): string {
    const ws = String((environment as any).rtSocketUrl || '');
    if (!ws) return '';
    return ws.replace(/^ws(s?):/, 'http$1:').replace(/\/ws\/?$/, '').replace(/\/+$/, '');
  }

  /** A limo-rt message in the shape the rest of this component already handles. */
  private fromRt(m: RtChatMessage, bookingId: string | number): ServerChatMessage {
    return {
      _id: m.id,
      bookingId,
      senderId: m.sender_id,
      receiverId: m.receiver_id ?? '',
      senderRole: m.from === 'rider' ? 'customer' : m.from,
      message: m.body,
      createdAt: new Date(m.at).toISOString()
    };
  }

  private toBubble(row: ServerChatMessage): ChatBubble {
    const created = new Date(row.createdAt);
    return {
      id: row._id,
      text: row.message,
      timestamp: isNaN(created.getTime()) ? new Date() : created,
      isFromUser: this.customerId !== null
        ? String(row.senderId) === String(this.customerId)
        : row.senderRole === 'customer'
    };
  }

  private setUnread(count: number): void {
    this.unread = count;
    this.unreadChange.emit(count);
  }
}
