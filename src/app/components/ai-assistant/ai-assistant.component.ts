import {
	AfterViewChecked, Component, ElementRef, HostListener, NgZone, OnDestroy, OnInit, ViewChild
} from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AiAssistantService, AiBookingCard, AiBookingOption, AiCardRequest, AiChatMessage } from 'src/app/services/ai-assistant.service';
import { AuthService } from 'src/app/services/auth.service';
import { processingSummary } from 'src/app/services/voice/voice-mic';
import { VoicePhase, VoiceSessionService, VoiceState } from 'src/app/services/voice/voice-session.service';
import { CardDetails } from '../shared/new-card-form/new-card-form.component';

/** Routes that already have their own chat panel in the same corner. */
const HIDDEN_ROUTE_PREFIXES = ['/live-ride-tracking'];
const TEASER_DISMISSED_KEY = 'ai_assistant_teaser_dismissed';
const TEASER_DELAY_MS = 3000;
/** The booking's pickup button (limoagent booking/flow.py CURRENT_LOCATION_REPLY). */
const CURRENT_LOCATION_REPLY = '📍 Use my current location';
const VOICE_LABELS: Record<VoicePhase, string> = {
	'idle': '',
	'requesting-mic': 'Allow the microphone to start…',
	'connecting': 'Connecting…',
	'listening': 'Listening',
	'thinking': 'Thinking…',
	'speaking': 'Speaking · talk to interrupt',
	'reconnecting': 'Reconnecting…',
	'ending': 'Saving the conversation…'
};
const WAVE_BARS = 32;

/**
 * Site-wide AI assistant: a floating launcher plus chat panel mounted once in AppComponent,
 * so it is available on every page to logged-in and anonymous visitors alike.
 */
@Component({
	selector: 'app-ai-assistant',
	templateUrl: './ai-assistant.component.html',
	styleUrls: ['./ai-assistant.component.scss']
})
export class AiAssistantComponent implements OnInit, AfterViewChecked, OnDestroy {
	@ViewChild('messagesList') messagesList?: ElementRef<HTMLElement>;
	@ViewChild('inputBox') inputBox?: ElementRef<HTMLTextAreaElement>;
	@ViewChild('waveform') waveform?: ElementRef<HTMLCanvasElement>;

	/** Voice conversation: phase, captions and what the browser does to the microphone. */
	voiceState: VoiceState = this.voice.state;
	voiceAvailable = false;
	micNote = { ok: true, text: '' };
	/** User messages whose own words (before they were tidied) are shown. */
	originalShown = new Set<string>();

	messages: AiChatMessage[] = [];
	isOpen = false;
	isStreaming = false;
	locating = false; // waiting for the browser's location (the booking's pickup button)
	locationError = '';
	uploading = false; // a registration photo on its way to the 1800limo API
	uploadError = '';
	hidden = false;
	/** A text field elsewhere on the page has focus (on phones: the keyboard is up). */
	pageFieldFocused = false;
	newMessageText = '';
	showTeaser = false;

	private readonly defaultQuickReplies = [
		'Get a quote',
		'Book a ride',
		'Track my ride',
		'Airport transfers',
		'Talk to support'
	];
	/** limoagent registration.py answers this with the affiliate's progress and offers to continue. */
	private readonly registrationQuickReplies = ['Need help with registration'];

	/** An affiliate who hasn't been approved yet only gets registration help in the menu. */
	get quickReplies(): string[] {
		return this.isRegisteringAffiliate() ? this.registrationQuickReplies : this.defaultQuickReplies;
	}

	private shouldScroll = false;
	private subs = new Subscription();
	/** Which photo each booking card shows, keyed by message id + card number. */
	private photoIndexes = new Map<string, number>();
	private brokenPhotos = new Set<string>();
	private teaserTimer?: ReturnType<typeof setTimeout>;
	private waveFrame = 0;

	constructor(
		public assistant: AiAssistantService,
		private authService: AuthService,
		private router: Router,
		public voice: VoiceSessionService,
		private zone: NgZone,
		private host: ElementRef<HTMLElement>
	) { }

	ngOnInit(): void {
		this.subs.add(this.voice.available$.subscribe(available => this.voiceAvailable = available));
		this.subs.add(this.voice.state$.subscribe(state => {
			this.voiceState = state;
			this.micNote = processingSummary(state.processing);
			this.shouldScroll = true;
			if (state.phase !== 'idle') this.startWave();
		}));

		this.updateVisibility(this.router.url);
		this.subs.add(this.router.events
			.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
			.subscribe(e => this.updateVisibility(e.urlAfterRedirects)));

		this.subs.add(this.assistant.messages$.subscribe(msgs => {
			this.messages = msgs;
			this.shouldScroll = true;
		}));
		this.subs.add(this.assistant.isStreaming$.subscribe(v => this.isStreaming = v));
		this.subs.add(this.assistant.isOpen$.subscribe(open => {
			this.isOpen = open;
			if (open) {
				this.shouldScroll = true;
				setTimeout(() => this.inputBox?.nativeElement.focus(), 200);
			}
		}));

		if (!this.isAdmin && !this.teaserDismissed() && !this.assistant.messages.length) {
			this.teaserTimer = setTimeout(() => this.showTeaser = true, TEASER_DELAY_MS);
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
		this.subs.unsubscribe();
		clearTimeout(this.teaserTimer);
		cancelAnimationFrame(this.waveFrame);
		this.waveFrame = 0;
		void this.voice.stop();
	}

	// --- Voice ------------------------------------------------------------------------

	get voiceLabel(): string {
		if (this.voiceState.phase === 'listening' && this.voiceState.muted) return 'Muted';
		return VOICE_LABELS[this.voiceState.phase];
	}

	/** "4:05" of this voice session left. */
	get voiceTimeLeft(): string {
		const seconds = this.voiceState.secondsLeft;
		if (seconds === null) return '';
		return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
	}

	get voiceButtonTitle(): string {
		if (!this.voice.hasTime) return 'You have used your voice time for now';
		return this.isStreaming ? 'Wait for the reply to finish' : 'Talk to the assistant';
	}

	startVoice(): void {
		this.locationError = '';
		this.uploadError = '';
		void this.voice.start();
	}

	toggleOriginal(m: AiChatMessage): void {
		if (!this.originalShown.delete(m.id)) this.originalShown.add(m.id);
	}

	/** The waveform is drawn outside Angular: sixty frames a second must not run change detection. */
	private startWave(): void {
		if (this.waveFrame) return;
		this.zone.runOutsideAngular(() => {
			const frame = () => {
				if (this.voice.state.phase === 'idle') {
					this.waveFrame = 0;
					return;
				}
				this.drawWave();
				this.waveFrame = requestAnimationFrame(frame);
			};
			this.waveFrame = requestAnimationFrame(frame);
		});
	}

	private drawWave(): void {
		const canvas = this.waveform?.nativeElement;
		const context = canvas?.getContext('2d');
		if (!canvas || !context) return;
		const ratio = window.devicePixelRatio || 1;
		const width = Math.round(canvas.clientWidth * ratio);
		const height = Math.round(canvas.clientHeight * ratio);
		if (!width || !height) return;
		if (canvas.width !== width || canvas.height !== height) {
			canvas.width = width;
			canvas.height = height;
		}
		context.clearRect(0, 0, width, height);
		const levels = this.voice.levels();
		const speaking = this.voice.state.phase === 'speaking';
		context.fillStyle = speaking ? '#111827' : '#f97316';
		const slot = width / WAVE_BARS;
		const bar = Math.max(2 * ratio, slot * 0.55);
		for (let i = 0; i < WAVE_BARS; i++) {
			// Mirror the spectrum around the middle so the loudest (low) bands are in the centre.
			const distance = Math.abs(i - (WAVE_BARS - 1) / 2) / (WAVE_BARS / 2);
			const level = levels?.length ? levels[Math.min(levels.length - 1, Math.floor(distance * levels.length))] / 255 : 0;
			const barHeight = Math.max(2 * ratio, level * height);
			context.fillRect(i * slot + (slot - bar) / 2, (height - barHeight) / 2, bar, barHeight);
		}
	}

	toggle(): void {
		if (!this.isOpen) this.dismissTeaser();
		this.assistant.toggle();
	}

	openFromTeaser(): void {
		this.dismissTeaser();
		this.assistant.open();
	}

	/** Teaser shows at most once per browser session. */
	dismissTeaser(): void {
		clearTimeout(this.teaserTimer);
		this.showTeaser = false;
		try { sessionStorage.setItem(TEASER_DISMISSED_KEY, '1'); } catch { }
	}

	private teaserDismissed(): boolean {
		try { return sessionStorage.getItem(TEASER_DISMISSED_KEY) === '1'; } catch { return false; }
	}

	/* Hide the launcher while the user types in a page field, so it doesn't
	   float on top of the on-screen keyboard. Fields inside the assistant
	   itself don't count. */
	@HostListener('document:focusin', ['$event'])
	onDocFocusIn(e: FocusEvent): void {
		this.pageFieldFocused = this.isPageTextField(e.target);
	}

	@HostListener('document:focusout', ['$event'])
	onDocFocusOut(e: FocusEvent): void {
		// relatedTarget is the element receiving focus (null when focus leaves to nothing)
		this.pageFieldFocused = this.isPageTextField(e.relatedTarget);
	}

	private isPageTextField(target: EventTarget | null): boolean {
		const el = target as HTMLElement | null;
		if (!el || !el.tagName || this.host.nativeElement.contains(el)) return false;
		if (el.isContentEditable || el.tagName === 'TEXTAREA') return true;
		if (el.tagName !== 'INPUT') return false;
		const type = ((el as HTMLInputElement).type || 'text').toLowerCase();
		return !['button', 'submit', 'reset', 'checkbox', 'radio', 'file', 'range', 'color', 'image', 'hidden'].includes(type);
	}

	@HostListener('document:keydown.escape')
	onEscape(): void {
		if (this.isOpen) this.assistant.close();
	}

	sendMessage(text?: string): void {
		const content = (text ?? this.newMessageText).trim();
		if (!content || this.isStreaming) return;
		this.locationError = '';
		this.uploadError = '';
		this.assistant.send(content);
		if (text === undefined) {
			this.newMessageText = '';
			this.resizeInput();
		}
	}

	onInputKeydown(event: KeyboardEvent): void {
		if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
			event.preventDefault();
			this.sendMessage();
		}
	}

	resizeInput(): void {
		const el = this.inputBox?.nativeElement;
		if (!el) return;
		el.style.height = 'auto';
		el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
	}

	/** Booking cards and replies only answer the latest message of a booking in progress. */
	isLive(m: AiChatMessage): boolean {
		return !!m.booking?.active && this.messages[this.messages.length - 1] === m;
	}

	/** Sends the card's number (what the booking expects) and shows its title in the bubble. */
	pickCard(card: AiBookingCard): void {
		if (this.isStreaming) return;
		this.assistant.send(String(card.number), card.title);
	}

	pickOption(option: AiBookingOption): void {
		if (this.isStreaming) return;
		this.assistant.send(String(option.number), option.label);
	}

	/** Suggested answers; the booking's location button sends the browser's coordinates instead. */
	pickReply(reply: string): void {
		if (reply === CURRENT_LOCATION_REPLY) {
			this.sendCurrentLocation();
			return;
		}
		this.sendMessage(reply);
	}

	/**
	 * The assistant turns "(lat, lng)" into the street address there (limoagent flow.py). Only the
	 * coordinates are sent, and only when the user taps the button and the browser allows it.
	 */
	private sendCurrentLocation(): void {
		this.locationError = '';
		if (!navigator.geolocation) {
			this.locationError = 'Your browser can\'t share a location. Please type the pickup address.';
			return;
		}
		this.locating = true;
		navigator.geolocation.getCurrentPosition(
			position => {
				this.locating = false;
				const lat = position.coords.latitude.toFixed(6);
				const lng = position.coords.longitude.toFixed(6);
				this.assistant.send(`📍 My current location (${lat}, ${lng})`, '📍 My current location');
			},
			error => {
				this.locating = false;
				this.locationError = error.code === error.PERMISSION_DENIED
					? 'Location access is blocked. Please type the pickup address.'
					: 'Couldn\'t get your location. Please type the pickup address.';
			},
			{ enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
		);
	}

	/** A registration photo goes straight to the 1800limo API; the chat only gets its id. */
	async pickPhoto(event: Event): Promise<void> {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		input.value = ''; // picking the same file again still fires (change)
		if (!file || this.isStreaming || this.uploading) return;
		this.uploading = true;
		this.uploadError = '';
		try {
			this.uploadError = (await this.assistant.uploadPhoto(file)) ?? '';
		} finally {
			this.uploading = false;
		}
	}

	/** The new customer's card goes straight to the 1800limo API, never to the assistant. */
	sendCard(request: AiCardRequest, card: CardDetails): void {
		if (this.isStreaming) return;
		this.assistant.submitCard(request, card);
	}

	trackByNumber(_: number, card: AiBookingCard): number {
		return card.number;
	}

	photoCount(card: AiBookingCard): number {
		return this.photos(card).length;
	}

	photoIndex(m: AiChatMessage, card: AiBookingCard): number {
		const count = this.photoCount(card);
		return count ? (this.photoIndexes.get(`${m.id}:${card.number}`) ?? 0) % count : 0;
	}

	photo(m: AiChatMessage, card: AiBookingCard): string | null {
		return this.photos(card)[this.photoIndex(m, card)] ?? null;
	}

	stepPhoto(m: AiChatMessage, card: AiBookingCard, step: number): void {
		const count = this.photoCount(card);
		if (count < 2) return;
		this.photoIndexes.set(`${m.id}:${card.number}`, (this.photoIndex(m, card) + step + count) % count);
	}

	/** A photo that fails to load is skipped; with none left the card shows a car icon. */
	photoFailed(src: string): void {
		this.brokenPhotos.add(src);
	}

	/** The booking preview's vehicle photo: shown while it is an http(s) URL that loads. */
	photoOk(src: string | null): boolean {
		return !!src && /^https?:\/\//.test(src) && !this.brokenPhotos.has(src);
	}

	private photos(card: AiBookingCard): string[] {
		return (card.images || []).filter(src => /^https?:\/\//.test(src) && !this.brokenPhotos.has(src));
	}

	newChat(): void {
		this.photoIndexes.clear();
		this.originalShown.clear();
		this.assistant.clear();
		this.newMessageText = '';
		this.resizeInput();
	}

	trackById(_: number, m: AiChatMessage): string {
		return m.id;
	}

	formatTime(date: Date): string {
		return new Date(date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
	}

	/**
	 * Minimal markdown for assistant replies. HTML is escaped first, so only the tags
	 * produced here reach [innerHTML] (which Angular sanitizes again).
	 */
	renderMarkdown(text: string): string {
		const escaped = text
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;');

		const inline = (s: string) => s
			.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
			.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
			// In-app pages (e.g. an account the admin looked up) open in this tab, see onMessageClick.
			.replace(/\[([^\]]+)\]\((\/(?!\/)[^\s)]*)\)/g, '<a href="$2" class="in-app-link">$1</a>')
			.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>');

		// Numbered items keep their numbers: booking menus are answered by typing the number.
		const out: string[] = [];
		let list: 'ul' | 'ol' | null = null;
		for (const line of escaped.split('\n')) {
			const item = /^\s*(?:([-*•])|(\d+)\.)\s+(.*)$/.exec(line);
			if (item) {
				const kind = item[2] ? 'ol' : 'ul';
				if (list !== kind) {
					if (list) out.push(`</${list}>`);
					out.push(`<${kind}>`);
					list = kind;
				}
				out.push(item[2] ? `<li value="${item[2]}">${inline(item[3])}</li>` : `<li>${inline(item[3])}</li>`);
				continue;
			}
			if (list) { out.push(`</${list}>`); list = null; }
			out.push(line.trim() ? `${inline(line)}<br>` : '<br>');
		}
		if (list) out.push(`</${list}>`);
		return out.join('').replace(/(<br>)+$/, '');
	}

	/** In-app links go through the router, so the page changes without reloading the app or the chat. */
	onMessageClick(event: MouseEvent): void {
		const link = (event.target as HTMLElement | null)?.closest('a');
		const href = link?.getAttribute('href');
		if (!href || !href.startsWith('/') || href.startsWith('//')) return;
		if (event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0) return; // new tab/window
		event.preventDefault();
		this.router.navigateByUrl(href);
	}

	/** Signed-in admin — they never get the teaser bubble. Checked live so a login after page load counts. */
	get isAdmin(): boolean {
		try {
			return !!this.authService.getAccessToken() && this.authService.currentUserValue?.roleName === 'admin';
		} catch {
			return false;
		}
	}

	/** Signed-in affiliate (role "driver", as otp.component sets it) whose account isn't accepted yet. */
	private isRegisteringAffiliate(): boolean {
		if (!this.authService.getAccessToken()) return false;
		try {
			const user = this.authService.currentUserValue;
			return user?.roleName === 'driver' && localStorage.getItem('account_approval') !== 'accepted';
		} catch {
			return false;
		}
	}

	private updateVisibility(url: string): void {
		this.hidden = HIDDEN_ROUTE_PREFIXES.some(p => url.startsWith(p));
		if (this.hidden && this.isOpen) this.assistant.close();
	}
}
