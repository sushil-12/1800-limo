import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { environment } from 'src/environments/environment';
import { AuthService } from './auth.service';
import { CardDetails } from '../components/shared/new-card-form/new-card-form.component';

/** One category / vehicle option of a booking step. Picking it sends `number`. */
export interface AiBookingCard {
	number: number;
	title: string;
	subtitle: string | null;
	details: string[];
	price: string;
	/** Absolute photo URLs, main photo first; may be empty. */
	images: string[];
}

/** One option of any other numbered booking menu (places, airports, terminals, customers...).
 * Picking it sends `number`. */
export interface AiBookingOption {
	number: number;
	label: string;
}

/**
 * A changed booking for a new customer, waiting for their card (limoagent EDIT_BOOKING_FLOW.md).
 * The card form adds the card to `payload.loose_customer.card_details` and this service sends it
 * to the 1800limo API itself, so the card never goes to the assistant.
 */
export interface AiCardRequest {
	method: 'PUT' | 'POST';
	/** Relative to `environment.serverUrl`. */
	path: string;
	payload: any;
	card_holder: string;
}

export interface AiLabelValue {
	label: string;
	value: string;
}

/** One leg of the booking to confirm: pickup, stops and drop-off in order, then its details. */
export interface AiPreviewLeg {
	title: string;
	when: string;
	points: { type: 'pickup' | 'stop' | 'dropoff'; label: string }[];
	distance: string | null;
	/** Flights, cruise, meet & greet, special instructions. */
	details: AiLabelValue[];
}

/** The booking to confirm, shown as a preview card with "Confirm booking?". */
export interface AiBookingPreview {
	service: string;
	legs: AiPreviewLeg[];
	vehicle: { title: string; subtitle: string | null; size: string | null; image: string | null } | null;
	/** Passengers, operator, driver, customer, passenger. */
	rows: AiLabelValue[];
	prices: { label: string; amount: string; lines: AiLabelValue[] }[];
	total: string | null;
	notes: string[];
}

/** The booking just created, shown as a success card. */
export interface AiBooked {
	reservation_id: string;
	return_reservation_id: string | null;
	service: string;
	legs: { title: string; when: string; from: string; to: string; stops: number }[];
	vehicle: string | null;
	passenger: string | null;
	total: string | null;
	message: string;
}

/** The booking step behind a `reply_type: "booking"` answer (the `booking` SSE event). */
export interface AiBooking {
	/** The next message in this conversation goes to the booking. */
	active: boolean;
	cards_kind: 'category' | 'vehicle' | null;
	cards: AiBookingCard[];
	/** Every other numbered menu, as buttons (in place of the "1. ..." lines). */
	options?: AiBookingOption[];
	/** Suggested answers, shown as buttons. */
	replies: string[];
	/** Show the card form; see AiCardRequest. */
	card_request?: AiCardRequest | null;
	preview?: AiBookingPreview | null;
	booked?: AiBooked | null;
	/** Registration: the question wants a photo (see uploadPhoto). */
	upload?: AiUploadRequest | null;
	/** Registration: `options` are toggles, sent together as "1, 3". */
	multi?: boolean;
	/** Registration: a step was just saved in the chat; see applyPortalSync. */
	portal?: AiPortalSync | null;
}

/**
 * What the driver portal keeps in localStorage, sent after a registration step is saved in the chat
 * (limoagent registration_flow.py). The step pages read it, e.g. Step 1 loads the saved details only
 * when `currentUser.account_id` is set.
 */
export interface AiPortalSync {
	step_completed: string[];
	/** After Affiliate Settings: the fields its response sets on `currentUser` (incl. account_id). */
	user?: Record<string, unknown> | null;
}

/** A registration question answered with a photo (limoagent registration_flow.py). */
export interface AiUploadRequest {
	/** What to photograph, e.g. "Driver license". */
	label: string;
	optional: boolean;
}

/** The answer limoagent expects once a photo is uploaded: the encrypted image id. */
const PHOTO_PREFIX = '📎 photo:';
/** Laravel's base64 upload accepts jpeg/png/gif data URIs; big phone photos are scaled down first. */
const PHOTO_MAX_SIDE = 1600;
/** The preview kept in the user's bubble (and sessionStorage): small enough to stay a few KB. */
const PREVIEW_MAX_SIDE = 320;

export interface AiChatMessage {
	id: string;
	role: 'user' | 'assistant';
	content: string;
	timestamp: Date;
	/** Shown instead of `content` (a picked card's title while "2" is what is sent). */
	display?: string;
	/** Assistant reply still receiving tokens. */
	streaming?: boolean;
	failed?: boolean;
	booking?: AiBooking;
	/**
	 * What the user typed or said, when the assistant was given a tidied version (`content`).
	 * Shown on request; never sent back to the server.
	 */
	original?: string;
	/** Spoken in a voice session (see VoiceSessionService). */
	voice?: boolean;
	/** A sent registration photo, as a small data URI preview; never sent to the server. */
	image?: string;
}

/** One spoken exchange of a voice session (limoagent docs/VOICE.md, `VoiceTurnOut`). */
export interface AiVoiceTurn {
	id: string;
	seq: number;
	status: 'running' | 'completed' | 'interrupted' | 'failed';
	/** What the assistant was given. */
	user_text: string;
	/** The transcript as heard. */
	user_original: string;
	assistant_text: string;
	reply_type: string | null;
	booking: AiBooking | null;
	error_code: string | null;
	/** Unix seconds. */
	created_at: number;
}

/** The live voice session, as far as the chat needs it: typing or tapping ends it first. */
export interface AiVoiceControl {
	active(): boolean;
	/** Ends the session and merges its turns into the chat; never rejects. */
	end(): Promise<void>;
}

const AI_CHAT_URL = `${environment['openAIUrl']}/v1/chat`;
/** ngrok's free plan answers browser requests with a warning page unless this header is sent. */
export const NGROK_HEADERS: Record<string, string> =
	String(environment['openAIUrl']).includes('.ngrok') ? { 'ngrok-skip-browser-warning': '1' } : {};
const STORAGE_KEY = 'ai_assistant_chat';
const CONVERSATION_KEY = 'ai_assistant_conversation';
/** Whose chat is stored: a sign-in, sign-out or "login as user" in this tab starts a new one. */
const OWNER_KEY = 'ai_assistant_owner';
/** POST /v1/chat limits (limoagent docs/API.md): messages per request, characters per message. */
const MAX_HISTORY = 30;
const MAX_CHARS = 4000;
const FAILED_TEXT = 'Sorry, I couldn\'t reach the assistant right now.';
const VOICE_FAILED_TEXT = 'Sorry, something went wrong with that one. Please ask again.';

/**
 * Site-wide AI assistant chat. Talks to the OpenAI-style `/v1/chat` endpoint and streams
 * the reply over SSE. Works for anonymous visitors; the bearer token is sent when present.
 */
@Injectable({ providedIn: 'root' })
export class AiAssistantService {
	messages$ = new BehaviorSubject<AiChatMessage[]>(this.restore());
	isOpen$ = new BehaviorSubject<boolean>(false);
	isStreaming$ = new BehaviorSubject<boolean>(false);

	private abortController: AbortController | null = null;
	private emitScheduled = false;
	/** Keys a booking in progress on the server; a new chat starts a new one. */
	private conversationId = this.restoreConversationId();
	private voice: AiVoiceControl | null = null;
	/** A voice session is being ended so that a typed or tapped message can go out. */
	private switching = false;

	constructor(private authService: AuthService, private zone: NgZone) { }

	get messages(): AiChatMessage[] {
		return this.messages$.value;
	}

	open(): void { this.syncOwner(); this.isOpen$.next(true); }
	close(): void { this.isOpen$.next(false); }
	toggle(): void { this.syncOwner(); this.isOpen$.next(!this.isOpen$.value); }

	/** The application's conversation id: typed and spoken messages share it. */
	get conversation(): string {
		return this.conversationId;
	}

	/** Called once by VoiceSessionService. */
	registerVoice(voice: AiVoiceControl | null): void {
		this.voice = voice;
	}

	/**
	 * What the server is given as the conversation so far: POST /v1/chat and a new voice session
	 * get the same list. It rejects (422) more than MAX_HISTORY messages or any over MAX_CHARS.
	 */
	history(): { role: 'user' | 'assistant'; content: string }[] {
		return this.messages
			.filter(m => !m.failed && !m.streaming && m.content.trim())
			.slice(-MAX_HISTORY)
			.map(m => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));
	}

	/**
	 * Merge a voice session's turns into the chat. Each turn has a stable id, so applying the
	 * same turn again (a poll, then the session's end) updates its two messages and never adds
	 * them twice. Turns of another conversation (a "New chat" in between) are dropped.
	 * `final`: the session is over, so a turn still marked running will not change any more.
	 */
	applyVoiceTurns(conversationId: string, turns: AiVoiceTurn[], final = false): void {
		if (conversationId !== this.conversationId) return;
		const msgs = [...this.messages];
		const put = (message: AiChatMessage, after?: string): void => {
			const at = msgs.findIndex(m => m.id === message.id);
			if (at >= 0) { msgs[at] = message; return; }
			const anchor = after ? msgs.findIndex(m => m.id === after) : -1;
			if (anchor >= 0) msgs.splice(anchor + 1, 0, message); else msgs.push(message);
		};
		for (const turn of [...turns].sort((a, b) => a.seq - b.seq)) {
			const running = turn.status === 'running' && !final;
			const timestamp = new Date(turn.created_at * 1000);
			const heard = (turn.user_original || '').trim();
			const user: AiChatMessage = { id: `${turn.id}:u`, role: 'user', content: turn.user_text, timestamp, voice: true };
			if (heard && heard !== turn.user_text) {
				// "The second one" answered a numbered menu: the number is what was sent, the words are shown.
				if (/^\d+$/.test(turn.user_text)) user.display = heard; else user.original = heard;
			}
			put(user);

			const text = turn.assistant_text || '';
			const failed = turn.status === 'failed' && !text.trim();
			const replyId = `${turn.id}:a`;
			if (!text.trim() && !running && !failed) {
				// Interrupted before a word was written: only the question stays.
				const at = msgs.findIndex(m => m.id === replyId);
				if (at >= 0) msgs.splice(at, 1);
				continue;
			}
			const reply: AiChatMessage = {
				id: replyId, role: 'assistant', content: failed ? VOICE_FAILED_TEXT : text, timestamp, voice: true, streaming: running
			};
			if (failed) reply.failed = true;
			if (turn.booking) reply.booking = turn.booking;
			put(reply, user.id);
		}
		if (final) msgs.forEach(m => { if (m.voice && m.streaming) m.streaming = false; });
		this.zone.run(() => {
			this.messages$.next(msgs.filter(m => !(final && m.voice && m.role === 'assistant' && !m.content.trim())));
			this.persist();
		});
	}

	/** Start a new conversation, cancelling any reply in flight. */
	clear(): void {
		this.stop();
		// Its turns belong to the conversation that ends here; applyVoiceTurns drops them.
		if (this.voice?.active()) void this.voice.end();
		this.messages$.next([]);
		this.conversationId = this.newConversationId();
		this.persist();
	}

	/** Stop the in-flight reply, keeping whatever text has already arrived. */
	stop(): void {
		this.abortController?.abort();
		this.abortController = null;
	}

	/** `display` is shown in the bubble instead of `text` (e.g. the picked vehicle's name). */
	send(text: string, display?: string, image?: string): void {
		const content = text.trim();
		if (!content || this.isStreaming$.value || this.switching) return;
		this.syncOwner();
		this.afterVoice(() => {
			const user: AiChatMessage = { id: this.newId(), role: 'user', content, display, image, timestamp: new Date() };
			this.messages$.next([...this.messages, user]);
			this.requestReply();
		});
	}

	/**
	 * Run `action` once no voice session is live. Switching back to text ends the session first, so
	 * its turns are in the chat (and in the history sent along) before the typed message.
	 */
	private afterVoice(action: () => void): void {
		if (!this.voice?.active()) { action(); return; }
		this.switching = true;
		const conversation = this.conversationId;
		this.voice.end().catch(() => { }).then(() => this.zone.run(() => {
			this.switching = false;
			if (conversation === this.conversationId) action(); // not after a "New chat" in between
		}));
	}

	/**
	 * Send a new or changed booking with the new customer's card straight to the 1800limo API, then
	 * tell the assistant how it went ("card:ok [<reservation id> [<return id>]]" / "card:error <reason>");
	 * it checks the booking itself.
	 * Plain fetch for the same reason as requestReply: a 401 here must not log the user out.
	 */
	async submitCard(request: AiCardRequest, card: CardDetails): Promise<void> {
		if (this.isStreaming$.value || this.syncOwner()) return; // the form belonged to another user's chat
		const payload = JSON.parse(JSON.stringify(request.payload ?? {}));
		payload.loose_customer = { ...(payload.loose_customer || {}), card_details: { ...card } };
		const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
		const token = this.authService.getAccessToken();
		if (token) headers['Authorization'] = `Bearer ${token}`;
		const url = `${environment.serverUrl}${request.path.replace(/^\/+/, '')}`;
		// TEMP: trace duplicate edit-reservation calls; Laravel logs this id next to its call_id
		const submitId = `card_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
		headers['X-Submit-Id'] = submitId;
		console.trace('[ai-assistant] submitCard', submitId, request.method, request.path);

		let outcome: string;
		try {
			let body = await this.sendJson(url, request.method, headers, payload);
			if (body.ok && body.json?.data?.is_confirm === false) {
				// "Changing the affiliate sends a new accept email": the user already confirmed the changes.
				body = await this.sendJson(url, request.method, headers, { ...payload, proceed: false });
			}
			const ids = [body.json?.data?.reservation_id, body.json?.data?.return_reservation_id].filter(Boolean);
			outcome = body.ok ? ['card:ok', ...ids].join(' ') : `card:error ${this.apiErrorText(body.json, body.status)}`;
		} catch {
			outcome = 'card:error The card could not be sent. Check your connection and try again.';
		}
		this.send(outcome, outcome.startsWith('card:ok') ? 'Card details sent' : 'Card details not accepted');
	}

	/**
	 * Upload a registration photo straight to the 1800limo API (as the portal's own forms do), then
	 * answer the question with its encrypted id. The image never goes to the assistant.
	 * Resolves to an error message to show, or null once the answer is sent.
	 */
	async uploadPhoto(file: File): Promise<string | null> {
		if (this.isStreaming$.value || this.syncOwner()) return null;
		if (!file.type.startsWith('image/')) return 'Please choose a photo (JPG or PNG).';
		let image: string;
		let preview: string | undefined;
		try {
			image = await this.photoDataUrl(file);
			preview = await this.photoDataUrl(file, PREVIEW_MAX_SIDE, 0.7).catch(() => undefined);
		} catch {
			return 'That photo couldn\'t be read. Please try another one.';
		}
		const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
		const token = this.authService.getAccessToken();
		if (token) headers['Authorization'] = `Bearer ${token}`;
		try {
			const body = await this.sendJson(`${environment.serverUrl}affiliate/add-single-image`, 'POST', headers, { image });
			const id = body.json?.data?.id;
			if (!body.ok || typeof id !== 'string' || !id) return this.apiErrorText(body.json, body.status);
			this.send(`${PHOTO_PREFIX}${id}`, '📎 Photo added', preview);
			return null;
		} catch {
			return 'The photo could not be uploaded. Check your connection and try again.';
		}
	}

	/** The photo as a JPEG data URI, at most `maxSide` pixels on its longer side. */
	private photoDataUrl(file: File, maxSide = PHOTO_MAX_SIDE, quality = 0.85): Promise<string> {
		return new Promise((resolve, reject) => {
			const url = URL.createObjectURL(file);
			const img = new Image();
			img.onload = () => {
				URL.revokeObjectURL(url);
				const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
				const canvas = document.createElement('canvas');
				canvas.width = Math.round(img.width * scale);
				canvas.height = Math.round(img.height * scale);
				const ctx = canvas.getContext('2d');
				if (!ctx) { reject(new Error('no canvas')); return; }
				ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
				resolve(canvas.toDataURL('image/jpeg', quality));
			};
			img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('unreadable image')); };
			img.src = url;
		});
	}

	private async sendJson(url: string, method: string, headers: Record<string, string>, payload: any)
		: Promise<{ ok: boolean; status: number; json: any }> {
		const res = await fetch(url, { method, headers, body: JSON.stringify(payload) });
		const json = await res.json().catch(() => null);
		return { ok: res.ok && json?.success !== false, status: res.status, json };
	}

	/** Laravel's 422 `{message, data: {field: "msg"}}` as one line. */
	private apiErrorText(json: any, status: number): string {
		const fields = json?.data && typeof json.data === 'object'
			? Object.values(json.data).flat().filter((v: any) => typeof v === 'string')
			: [];
		const text = (fields.length ? fields.join(' ') : json?.message) || `The server answered ${status}.`;
		return String(text).replace(/\s+/g, ' ').slice(0, 300);
	}

	/** Re-ask the last user message after a failed reply. */
	retry(): void {
		if (this.isStreaming$.value || this.switching || this.syncOwner()) return;
		this.afterVoice(() => {
			const msgs = [...this.messages];
			while (msgs.length && msgs[msgs.length - 1].role === 'assistant') msgs.pop();
			if (!msgs.length) return;
			this.messages$.next(msgs);
			this.requestReply();
		});
	}

	/**
	 * Plain fetch rather than HttpClient on purpose: HttpConfigInterceptor clears localStorage
	 * and pops the global error dialog on a 401, and a chatbot hiccup must never log a user out.
	 */
	private async requestReply(): Promise<void> {
		// A booking keeps its own state on the server, so trimming old turns loses nothing.
		const history = this.history();

		const reply: AiChatMessage = { id: this.newId(), role: 'assistant', content: '', timestamp: new Date(), streaming: true };
		this.messages$.next([...this.messages, reply]);
		this.isStreaming$.next(true);

		const controller = new AbortController();
		this.abortController = controller;

		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
			'Accept': 'text/event-stream',
			...NGROK_HEADERS
		};
		const token = this.authService.getAccessToken();
		if (token) headers['Authorization'] = `Bearer ${token}`;

		try {
			const res = await fetch(AI_CHAT_URL, {
				method: 'POST',
				headers,
				body: JSON.stringify({ stream: true, messages: history, conversation_id: this.conversationId }),
				signal: controller.signal
			});
			if (!res.ok) throw new Error(`AI chat request failed (${res.status})`);

			if (res.body && !(res.headers.get('content-type') || '').includes('application/json')) {
				await this.readStream(res.body, reply);
			} else {
				// Server ignored stream:true and answered with a single JSON body.
				const body = await res.json();
				reply.content = body?.content ?? body?.choices?.[0]?.message?.content ?? body?.choices?.[0]?.delta?.content ?? '';
				if (body?.booking) {
					reply.booking = body.booking;
					this.applyPortalSync(body.booking.portal);
				}
				if (body?.correction) this.applyCorrection(reply, body.correction);
			}
			if (!reply.content.trim()) throw new Error('Empty reply from assistant');
		} catch (error: any) {
			if (error?.name === 'AbortError') {
				// User pressed Stop (or started a new chat) — keep partial text, drop an empty bubble.
			} else {
				console.error('AiAssistant: chat request failed', error);
				reply.failed = true;
				reply.content = reply.content || FAILED_TEXT;
			}
		} finally {
			if (this.abortController === controller) this.abortController = null;
			this.zone.run(() => {
				reply.streaming = false;
				// A "New chat" mid-stream already removed the reply; don't resurrect it.
				const msgs = this.messages.filter(m => m !== reply || m.content.trim());
				this.messages$.next([...msgs]);
				this.isStreaming$.next(false);
				this.persist();
			});
		}
	}

	/**
	 * Parse the SSE stream. The server sends named events:
	 *   event: correction → data: {"original":"...","corrected":"..."}  (the message was tidied)
	 *   event: booking → data: {"active":true,"cards":[...],"replies":[...]}  (booking steps only)
	 *   event: delta  →  data: {"content":"Hello"}
	 *   event: done   →  data: {"usage":{...}}
	 *   event: error  →  data: {"message":"..."}
	 * OpenAI-style `data: {choices:[{delta:{content}}]}` / `data: [DONE]` is also accepted.
	 */
	private async readStream(stream: ReadableStream<Uint8Array>, reply: AiChatMessage): Promise<void> {
		const reader = stream.getReader();
		const decoder = new TextDecoder();
		let buffer = '';
		let eventName = '';

		const handleLine = (line: string): boolean => {
			const trimmed = line.trim();
			if (!trimmed) { eventName = ''; return false; } // blank line ends an SSE event
			if (trimmed.startsWith('event:')) { eventName = trimmed.slice(6).trim(); return false; }
			if (!trimmed.startsWith('data:')) return false;
			return this.handleSseData(eventName, trimmed.slice(5).trim(), reply);
		};

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			buffer += decoder.decode(value, { stream: true });

			const lines = buffer.split(/\r?\n/);
			buffer = lines.pop() ?? '';
			for (const line of lines) {
				if (handleLine(line)) {
					reader.cancel().catch(() => { });
					return;
				}
			}
		}
		if (buffer) handleLine(buffer);
	}

	/** Returns true once the stream signals completion; throws on an `error` event. */
	private handleSseData(eventName: string, payload: string, reply: AiChatMessage): boolean {
		if (payload === '[DONE]' || eventName === 'done') return true;

		let json: any;
		try {
			json = JSON.parse(payload);
		} catch {
			return false; // keep-alives / non-JSON lines
		}

		if (eventName === 'error' || json?.error) {
			throw new Error(json?.error?.message || json?.message || 'Assistant stream error');
		}
		if (eventName === 'booking') {
			reply.booking = json as AiBooking;
			this.applyPortalSync(reply.booking.portal);
			this.scheduleEmit();
			return false;
		}
		if (eventName === 'correction') {
			this.applyCorrection(reply, json);
			return false;
		}
		if (eventName === 'start' || eventName === 'data') return false;

		const delta = json?.content
			?? json?.choices?.[0]?.delta?.content
			?? json?.choices?.[0]?.message?.content
			?? '';
		if (typeof delta === 'string' && delta) {
			reply.content += delta;
			this.scheduleEmit();
		}
		return false;
	}

	/**
	 * The server fixed the spelling and grammar of the message `reply` answers. The fixed text
	 * becomes its content (what later requests send, so it is never corrected twice); the user's
	 * own words stay in `original`, to look at.
	 */
	private applyCorrection(reply: AiChatMessage, correction: any): void {
		const original = typeof correction?.original === 'string' ? correction.original : '';
		const corrected = typeof correction?.corrected === 'string' ? correction.corrected.trim() : '';
		if (!original || !corrected) return;
		const at = this.messages.indexOf(reply);
		const user = at > 0 ? this.messages[at - 1] : undefined;
		if (!user || user.role !== 'user' || user.content.trim() !== original.trim() || corrected === user.content) return;
		user.original = user.content;
		user.content = corrected;
		this.scheduleEmit();
	}

	/** Coalesce token updates to one change-detection pass per frame. */
	private scheduleEmit(): void {
		if (this.emitScheduled) return;
		this.emitScheduled = true;
		requestAnimationFrame(() => {
			this.emitScheduled = false;
			this.zone.run(() => this.messages$.next([...this.messages]));
		});
	}

	/**
	 * Start a new chat when the signed-in user is not the one the stored chat belongs to, so one
	 * user's history (name, bookings) never goes to the assistant as another's. True if it reset.
	 */
	private syncOwner(): boolean {
		const owner = this.currentOwner();
		let saved: string | null = null;
		try { saved = sessionStorage.getItem(OWNER_KEY); } catch { }
		if (saved === owner) return false;
		try { sessionStorage.setItem(OWNER_KEY, owner); } catch { }
		if (saved === null && !this.messages.length) return false;
		this.clear();
		return true;
	}

	/**
	 * Do what the portal's step page does after its own submit (step1.component.ts submit): store the
	 * steps done and the updated user, so the pages show what was saved in the chat. The user's
	 * fields are merged into the stored one, which keeps its token and everything else; nothing is
	 * written for another user's chat.
	 */
	private applyPortalSync(portal?: AiPortalSync | null): void {
		if (!portal || !Array.isArray(portal.step_completed)) return;
		try {
			const stored = JSON.parse(localStorage.getItem('currentUser') || 'null');
			if (!stored || typeof stored !== 'object') return;
			const user = portal.user && typeof portal.user === 'object' ? portal.user : null;
			if (user && user['id'] != null && String(user['id']) !== String(stored.id)) return;
			localStorage.setItem('stepCompleted', portal.step_completed.map(String).toString());
			if (user) localStorage.setItem('currentUser', JSON.stringify({ ...stored, ...user }));
		} catch { }
	}

	private currentOwner(): string {
		try {
			const id = this.authService.currentUserValue?.id;
			if (id != null && this.authService.getAccessToken()) return `u${id}`;
		} catch { }
		return 'guest';
	}

	private persist(): void {
		try {
			const rows = this.messages.filter(m => !m.streaming);
			sessionStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
		} catch { }
	}

	private restore(): AiChatMessage[] {
		try {
			const rows = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]');
			if (!Array.isArray(rows)) return [];
			return rows.map((m: any) => ({ ...m, streaming: false, timestamp: new Date(m.timestamp) }));
		} catch {
			return [];
		}
	}

	private restoreConversationId(): string {
		try {
			const saved = sessionStorage.getItem(CONVERSATION_KEY);
			if (saved && /^[A-Za-z0-9_-]{1,64}$/.test(saved)) return saved;
		} catch { }
		return this.newConversationId();
	}

	private newConversationId(): string {
		const id = `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
		try { sessionStorage.setItem(CONVERSATION_KEY, id); } catch { }
		return id;
	}

	private newId(): string {
		return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
	}
}
