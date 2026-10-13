import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { environment } from 'src/environments/environment';
import { AuthService } from './auth.service';

export interface AiChatMessage {
	id: string;
	role: 'user' | 'assistant';
	content: string;
	timestamp: Date;
	/** Assistant reply still receiving tokens. */
	streaming?: boolean;
	failed?: boolean;
}

const AI_CHAT_URL = `${environment['openAIUrl']}/v1/chat`;
const STORAGE_KEY = 'ai_assistant_chat';
const FAILED_TEXT = 'Sorry, I couldn\'t reach the assistant right now.';

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

	constructor(private authService: AuthService, private zone: NgZone) { }

	get messages(): AiChatMessage[] {
		return this.messages$.value;
	}

	open(): void { this.isOpen$.next(true); }
	close(): void { this.isOpen$.next(false); }
	toggle(): void { this.isOpen$.next(!this.isOpen$.value); }

	/** Start a new conversation, cancelling any reply in flight. */
	clear(): void {
		this.stop();
		this.messages$.next([]);
		this.persist();
	}

	/** Stop the in-flight reply, keeping whatever text has already arrived. */
	stop(): void {
		this.abortController?.abort();
		this.abortController = null;
	}

	send(text: string): void {
		const content = text.trim();
		if (!content || this.isStreaming$.value) return;

		const user: AiChatMessage = { id: this.newId(), role: 'user', content, timestamp: new Date() };
		this.messages$.next([...this.messages, user]);
		this.requestReply();
	}

	/** Re-ask the last user message after a failed reply. */
	retry(): void {
		if (this.isStreaming$.value) return;
		const msgs = [...this.messages];
		while (msgs.length && msgs[msgs.length - 1].role === 'assistant') msgs.pop();
		if (!msgs.length) return;
		this.messages$.next(msgs);
		this.requestReply();
	}

	/**
	 * Plain fetch rather than HttpClient on purpose: HttpConfigInterceptor clears localStorage
	 * and pops the global error dialog on a 401, and a chatbot hiccup must never log a user out.
	 */
	private async requestReply(): Promise<void> {
		const history = this.messages
			.filter(m => !m.failed && m.content.trim())
			.map(m => ({ role: m.role, content: m.content }));

		const reply: AiChatMessage = { id: this.newId(), role: 'assistant', content: '', timestamp: new Date(), streaming: true };
		this.messages$.next([...this.messages, reply]);
		this.isStreaming$.next(true);

		const controller = new AbortController();
		this.abortController = controller;

		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
			'Accept': 'text/event-stream'
		};
		const token = this.authService.getAccessToken();
		if (token) headers['Authorization'] = `Bearer ${token}`;

		try {
			const res = await fetch(AI_CHAT_URL, {
				method: 'POST',
				headers,
				body: JSON.stringify({ stream: true, messages: history }),
				signal: controller.signal
			});
			if (!res.ok) throw new Error(`AI chat request failed (${res.status})`);

			if (res.body && !(res.headers.get('content-type') || '').includes('application/json')) {
				await this.readStream(res.body, reply);
			} else {
				// Server ignored stream:true and answered with a single JSON body.
				const body = await res.json();
				reply.content = body?.content ?? body?.choices?.[0]?.message?.content ?? body?.choices?.[0]?.delta?.content ?? '';
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

	/** Coalesce token updates to one change-detection pass per frame. */
	private scheduleEmit(): void {
		if (this.emitScheduled) return;
		this.emitScheduled = true;
		requestAnimationFrame(() => {
			this.emitScheduled = false;
			this.zone.run(() => this.messages$.next([...this.messages]));
		});
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

	private newId(): string {
		return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
	}
}
