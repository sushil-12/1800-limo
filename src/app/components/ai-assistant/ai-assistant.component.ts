import {
	AfterViewChecked, Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild
} from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AiAssistantService, AiChatMessage } from 'src/app/services/ai-assistant.service';

/** Routes that already have their own chat panel in the same corner. */
const HIDDEN_ROUTE_PREFIXES = ['/live-ride-tracking'];
const TEASER_DISMISSED_KEY = 'ai_assistant_teaser_dismissed';
const TEASER_DELAY_MS = 3000;

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

	newChat(): void {
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
			.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>');

		const out: string[] = [];
		let inList = false;
		for (const line of escaped.split('\n')) {
			const bullet = /^\s*(?:[-*•]|\d+\.)\s+(.*)$/.exec(line);
			if (bullet) {
				if (!inList) { out.push('<ul>'); inList = true; }
				out.push(`<li>${inline(bullet[1])}</li>`);
				continue;
			}
			if (inList) { out.push('</ul>'); inList = false; }
			out.push(line.trim() ? `${inline(line)}<br>` : '<br>');
		}
		if (inList) out.push('</ul>');
		return out.join('').replace(/(<br>)+$/, '');
	}

	private updateVisibility(url: string): void {
		this.hidden = HIDDEN_ROUTE_PREFIXES.some(p => url.startsWith(p));
		if (this.hidden && this.isOpen) this.assistant.close();
	}
}
