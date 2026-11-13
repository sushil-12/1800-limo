import {
	AfterViewChecked, Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild
} from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AiAssistantService, AiBookingCard, AiBookingOption, AiCardRequest, AiChatMessage } from 'src/app/services/ai-assistant.service';
import { CardDetails } from '../shared/new-card-form/new-card-form.component';

/** Routes that already have their own chat panel in the same corner. */
const HIDDEN_ROUTE_PREFIXES = ['/live-ride-tracking'];
const TEASER_DISMISSED_KEY = 'ai_assistant_teaser_dismissed';
const TEASER_DELAY_MS = 3000;
/** The booking's pickup button (limoagent booking/flow.py CURRENT_LOCATION_REPLY). */
const CURRENT_LOCATION_REPLY = '📍 Use my current location';

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

	messages: AiChatMessage[] = [];
	isOpen = false;
	isStreaming = false;
	locating = false; // waiting for the browser's location (the booking's pickup button)
	locationError = '';
	hidden = false;
	newMessageText = '';
	showTeaser = false;

	readonly quickReplies = [
		'Get a quote',
		'Book a ride',
		'Track my ride',
		'Airport transfers',
		'Talk to support'
	];

	private shouldScroll = false;
	private subs = new Subscription();
	/** Which photo each booking card shows, keyed by message id + card number. */
	private photoIndexes = new Map<string, number>();
	private brokenPhotos = new Set<string>();
	private teaserTimer?: ReturnType<typeof setTimeout>;

	constructor(public assistant: AiAssistantService, private router: Router) { }

	ngOnInit(): void {
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

		if (!this.teaserDismissed() && !this.assistant.messages.length) {
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

	@HostListener('document:keydown.escape')
	onEscape(): void {
		if (this.isOpen) this.assistant.close();
	}

	sendMessage(text?: string): void {
		const content = (text ?? this.newMessageText).trim();
		if (!content || this.isStreaming) return;
		this.locationError = '';
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

	private updateVisibility(url: string): void {
		this.hidden = HIDDEN_ROUTE_PREFIXES.some(p => url.startsWith(p));
		if (this.hidden && this.isOpen) this.assistant.close();
	}
}
