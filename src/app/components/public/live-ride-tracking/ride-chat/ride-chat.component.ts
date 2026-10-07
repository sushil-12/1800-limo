import {
  Component, Input, Output, EventEmitter, OnChanges, OnDestroy, SimpleChanges,
  ViewChild, ElementRef, AfterViewChecked
} from '@angular/core';
import { Socket } from 'socket.io-client';

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

  /** Chime + read the driver's message aloud. Remembered per browser. */
  voiceEnabled = true;

  private unread = 0;
  private shouldScroll = false;
  private boundSocket: Socket | null = null;
  private audioCtx: AudioContext | null = null;
  private static readonly VOICE_PREF_KEY = 'rideChatVoiceEnabled';

  /**
   * Browsers refuse to play audio or speech until the page has had a user gesture. The
   * tracking page is usually opened from an SMS link and then just watched, so unlock on
   * the first tap/keypress anywhere rather than waiting for the chat to be touched.
   */
  private readonly unlockAudio = () => {
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (Ctx && !this.audioCtx) this.audioCtx = new Ctx();
      this.audioCtx?.resume();
      // Priming with an empty utterance lets later, gesture-less speak() calls through.
      if ('speechSynthesis' in window) window.speechSynthesis.speak(new SpeechSynthesisUtterance(''));
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
    this.unbindSocket();
    document.removeEventListener('pointerdown', this.unlockAudio);
    document.removeEventListener('keydown', this.unlockAudio);
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
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
    if (!this.voiceEnabled && 'speechSynthesis' in window) window.speechSynthesis.cancel();
  }

  sendMessage(text: string = this.newMessageText): void {
    const message = text.trim();
    if (!message || !this.canSendMessages || !this.bookingId) return;

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
  private async loadHistory(): Promise<void> {
    if (!this.bookingId || !this.serverUrl) return;
    const bookingId = this.bookingId;

    this.isLoading = this.messages.length === 0;
    try {
      const res = await fetch(`${this.serverUrl}/api/messages/${bookingId}?page=1&limit=100`, {
        headers: { 'x-secret': this.secret, 'Content-Type': 'application/json' }
      });
      const body = await res.json();
      if (String(bookingId) !== String(this.bookingId)) return; // booking changed mid-flight
      if (!res.ok || !body?.success || !Array.isArray(body.data)) {
        throw new Error(body?.error || 'Failed to load chat history');
      }
      this.mergeHistory(body.data as ServerChatMessage[]);
    } catch (error: any) {
      console.error('RideChat: failed to load history', error);
      this.errorMessage = 'Couldn\'t load earlier messages';
    } finally {
      this.isLoading = false;
    }
  }

  private mergeHistory(rows: ServerChatMessage[]): void {
    const known = new Set(this.messages.map(m => m.id));
    const added = rows
      .filter(r => String(r.bookingId) === String(this.bookingId) && !known.has(r._id))
      .map(r => this.toBubble(r));
    if (!added.length) return;

    // Server ordering for this endpoint isn't documented, so always sort by createdAt.
    this.messages = [...this.messages, ...added].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    this.shouldScroll = true;
  }

  private handleIncoming(row: ServerChatMessage | null, clientMessageId?: string): void {
    if (!row?._id || String(row.bookingId) !== String(this.bookingId)) return;
    if (this.messages.some(m => m.id === row._id)) return;

    const bubble = this.toBubble(row);

    // Our own send coming back (as the ack or the room broadcast): replace the optimistic copy.
    const optimisticIdx = clientMessageId
      ? this.messages.findIndex(m => m.clientMessageId === clientMessageId)
      : -1;
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
      this.announce(bubble.text);
      this.incoming.emit();
    }
  }

  /** Short two-note chime, then the message read aloud in the browser's own voice. */
  private announce(text: string): void {
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

    if (!('speechSynthesis' in window)) return;
    const utterance = new SpeechSynthesisUtterance(`Message from ${this.driverName || 'your driver'}. ${text}`);
    utterance.rate = 1;
    utterance.lang = 'en-US';
    // Let the chime finish first; drop anything still queued so a burst doesn't pile up.
    setTimeout(() => {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    }, 400);
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
