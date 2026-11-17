import { Injectable, InjectionToken, Inject, NgZone, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subscription } from 'rxjs';
import { environment } from 'src/environments/environment';
import { AiAssistantService, AiVoiceTurn, NGROK_HEADERS } from '../ai-assistant.service';
import { AuthService } from '../auth.service';
import { MicError, MicProcessing, requestMicPermission, verifyMic, voiceSupported } from './voice-mic';

/**
 * Voice conversations with the assistant (limoagent docs/VOICE.md).
 *
 * The browser talks to ElevenLabs over WebRTC with a short-lived token from limoagent; ElevenLabs
 * hears and speaks, limoagent's own agent answers. This service never sees an ElevenLabs API key.
 *
 * limoagent stays the source of truth for what was said: the SDK's messages are only shown as
 * live captions, and the chat's messages come from the session's turns (GET .../turns), merged by
 * turn id. Ending the session (also by typing or tapping, see AiAssistantService.afterVoice)
 * merges the final turns before anything else is sent, under the same conversation id.
 */

export type VoicePhase =
	| 'idle' | 'requesting-mic' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'reconnecting' | 'ending';

export interface VoiceProblem {
	code: string;
	message: string;
	/** Offer "Try again". */
	canRetry: boolean;
}

export interface VoiceState {
	phase: VoicePhase;
	muted: boolean;
	problem: VoiceProblem | null;
	/** Why the last session ended, when it was not the user. */
	notice: string;
	/** Live captions: the last thing heard and the reply being spoken. */
	userCaption: string;
	agentCaption: string;
	/** What the browser does to the microphone track that is sent; null until checked. */
	processing: MicProcessing | null;
	secondsLeft: number | null;
}

export interface VoiceUsage {
	daily_limit_seconds: number;
	daily_used_seconds: number;
	monthly_limit_seconds: number;
	monthly_used_seconds: number;
	remaining_seconds: number;
	/** Unix seconds. */
	resets_at: number;
}

/** The part of the ElevenLabs conversation object this service uses. */
export interface VoiceConversationHandle {
	endSession(): Promise<void>;
	setMicMuted(muted: boolean): void;
	getInputByteFrequencyData(): Uint8Array;
	getOutputByteFrequencyData(): Uint8Array;
}

export interface VoiceSdkCallbacks {
	onDisconnect?: (details: any) => void;
	onError?: (message: string, context?: any) => void;
	onMessage?: (props: { message: string; role: 'user' | 'agent' }) => void;
	onModeChange?: (props: { mode: 'speaking' | 'listening' }) => void;
	onInterruption?: (props: any) => void;
}

export interface VoiceSdk {
	startSession(options: VoiceSdkCallbacks & { conversationToken: string; connectionType: 'webrtc' }): Promise<VoiceConversationHandle>;
}

/** Loads the ElevenLabs browser SDK on first use, so pages that never talk don't download it. */
export const VOICE_SDK_LOADER = new InjectionToken<() => Promise<VoiceSdk>>('VOICE_SDK_LOADER', {
	providedIn: 'root',
	factory: () => () => import('@elevenlabs/client').then(sdk => sdk.Conversation as unknown as VoiceSdk)
});

/** Timings, replaceable in tests. */
export interface VoiceTimings {
	pollMs: number;
	pollSoonMs: number;
	/** Waits before each automatic reconnect; when used up, the user is asked. */
	reconnectDelaysMs: number[];
	settleAttempts: number;
	settleDelayMs: number;
	micAttempts: number;
	micDelayMs: number;
}

export const VOICE_TIMINGS = new InjectionToken<VoiceTimings>('VOICE_TIMINGS', {
	providedIn: 'root',
	factory: () => ({
		pollMs: 1500,
		pollSoonMs: 250,
		reconnectDelaysMs: [1000, 3000],
		settleAttempts: 5,
		settleDelayMs: 1000,
		micAttempts: 8,
		micDelayMs: 250
	})
});

const VOICE_URL = `${environment['openAIUrl']}/v1/voice`;
/** The server refuses to start a session with less than this left (limoagent MIN_SESSION_SECONDS). */
const MIN_SECONDS = 15;
/** End reasons the server set on purpose: connecting again would be wrong. */
const FINAL_REASONS: Record<string, string> = {
	time_limit: 'Voice ended: this conversation reached its time limit. You can keep typing.',
	replaced: 'Voice continued in another tab or window.',
	signed_out: 'Voice ended because you signed out.'
};

const IDLE: VoiceState = {
	phase: 'idle', muted: false, problem: null, notice: '', userCaption: '', agentCaption: '', processing: null, secondsLeft: null
};

const PROBLEMS: Record<string, VoiceProblem> = {
	'mic-unsupported': { code: 'mic-unsupported', message: 'This browser can\'t use a microphone here. You can keep typing.', canRetry: false },
	'mic-denied': { code: 'mic-denied', message: 'Microphone access is blocked. Allow it in your browser\'s site settings, then try again.', canRetry: true },
	'mic-missing': { code: 'mic-missing', message: 'No microphone was found. Connect one and try again.', canRetry: true },
	'mic-busy': { code: 'mic-busy', message: 'The microphone is in use by another app. Close it and try again.', canRetry: true },
	'mic-error': { code: 'mic-error', message: 'The microphone couldn\'t be started. Please try again.', canRetry: true },
	'signed-out': { code: 'signed-out', message: 'Please sign in to talk to the assistant.', canRetry: false },
	'connection-lost': { code: 'connection-lost', message: 'The voice connection was lost. Your conversation is saved.', canRetry: true },
	'offline': { code: 'offline', message: 'The assistant could not be reached. Check your connection and try again.', canRetry: true },
	'unavailable': { code: 'unavailable', message: 'Voice is temporarily unavailable. You can keep typing.', canRetry: true }
};

const SDK_MIC_ERRORS: Record<string, string> = {
	NotAllowedError: 'mic-denied', NotFoundError: 'mic-missing', NotReadableError: 'mic-busy'
};

export class VoiceApiError extends Error {
	constructor(public status: number, public code: string, message: string) {
		super(message);
	}
}

interface Session {
	id: string;
	conversationId: string;
	/** Turns up to this seq are final and merged. */
	after: number;
	conversation: VoiceConversationHandle | null;
	endsAt: number;
}

interface TurnsResponse {
	status: 'pending' | 'active' | 'ended';
	end_reason: string | null;
	turns: AiVoiceTurn[];
	usage?: VoiceUsage | null;
}

@Injectable({ providedIn: 'root' })
export class VoiceSessionService implements OnDestroy {
	state$ = new BehaviorSubject<VoiceState>({ ...IDLE });
	/** The mic button is shown: signed in, voice is on in limoagent, and the browser can do it. */
	available$ = new BehaviorSubject<boolean>(false);
	usage$ = new BehaviorSubject<VoiceUsage | null>(null);

	private session: Session | null = null;
	/** Bumped whenever the session changes hands; async steps of an older run stop quietly. */
	private run = 0;
	private reconnects = 0;
	private stopping: Promise<void> | null = null;
	private polling = false;
	private pollTimer?: ReturnType<typeof setInterval>;
	private pollSoonTimer?: ReturnType<typeof setTimeout>;
	private clockTimer?: ReturnType<typeof setInterval>;
	private thinkingSince = 0;
	private subs = new Subscription();
	private readonly onPageHide = () => this.abandon();
	private readonly onDeviceChange = () => { void this.checkMic(this.run); };

	constructor(
		private assistant: AiAssistantService,
		private authService: AuthService,
		private zone: NgZone,
		@Inject(VOICE_SDK_LOADER) private loadSdk: () => Promise<VoiceSdk>,
		@Inject(VOICE_TIMINGS) private timings: VoiceTimings
	) {
		this.assistant.registerVoice({ active: () => this.active, end: () => this.stop() });
		this.subs.add(this.assistant.isOpen$.subscribe(open => {
			if (open) void this.refreshAvailability();
			else if (this.active) void this.stop(); // never leave a microphone open behind a closed panel
		}));
		try {
			window.addEventListener('pagehide', this.onPageHide);
			navigator.mediaDevices?.addEventListener?.('devicechange', this.onDeviceChange);
		} catch { }
	}

	ngOnDestroy(): void {
		this.subs.unsubscribe();
		this.assistant.registerVoice(null);
		try {
			window.removeEventListener('pagehide', this.onPageHide);
			navigator.mediaDevices?.removeEventListener?.('devicechange', this.onDeviceChange);
		} catch { }
		this.abandon();
	}

	get state(): VoiceState {
		return this.state$.value;
	}

	/** A session is starting, live or being wound up. */
	get active(): boolean {
		return this.state.phase !== 'idle';
	}

	/** The session is connected: mute, reconnect and the waveform make sense. */
	get connected(): boolean {
		return ['listening', 'thinking', 'speaking'].includes(this.state.phase);
	}

	/** Enough voice time is left to start. */
	get hasTime(): boolean {
		const usage = this.usage$.value;
		return !usage || usage.remaining_seconds >= MIN_SECONDS;
	}

	/**
	 * Whether voice is on for this visitor, signed in or not (limoagent answers guests with their
	 * own allowance); also refreshes the time left. Never throws.
	 */
	async refreshAvailability(): Promise<void> {
		if (!voiceSupported()) {
			this.available$.next(false);
			return;
		}
		try {
			const usage = await this.api<VoiceUsage>('GET', '/usage');
			this.zone.run(() => { this.usage$.next(usage); this.available$.next(true); });
		} catch {
			// 404: voice is off in limoagent. 401: guest voice is off, or the token was refused.
			// Either way there is no mic button.
			this.zone.run(() => this.available$.next(false));
		}
	}

	/** Switch to voice, continuing the chat's conversation. */
	async start(): Promise<void> {
		if (this.active || this.assistant.isStreaming$.value) return;
		this.reconnects = 0;
		await this.open('requesting-mic');
	}

	/** End the session and merge what was said into the chat. Safe to call at any time. */
	stop(notice = ''): Promise<void> {
		if (this.stopping) return this.stopping;
		if (!this.active) {
			if (this.state.problem || this.state.notice) this.patch({ ...IDLE });
			return Promise.resolve();
		}
		const done = () => { this.stopping = null; };
		this.stopping = this.wind(notice).then(done, done);
		return this.stopping;
	}

	toggleMute(): void {
		const conversation = this.session?.conversation;
		if (!conversation || !this.connected) return;
		const muted = !this.state.muted;
		try { conversation.setMicMuted(muted); } catch { return; }
		this.patch({ muted });
		if (!muted) void this.checkMic(this.run); // the track may have been reopened
	}

	/** Drop the connection and open a new one for the same conversation; nothing said is lost. */
	async reconnect(): Promise<void> {
		if (this.stopping) return;
		if (!this.active) { await this.start(); return; }
		if (this.state.phase === 'requesting-mic' || this.state.phase === 'ending') return;
		this.reconnects = 0;
		const run = ++this.run;
		const session = this.release();
		this.patch({ phase: 'reconnecting', problem: null, notice: '', muted: false });
		await this.hangUp(session);
		await this.finishOnServer(session);
		if (run !== this.run) return;
		await this.open('reconnecting');
	}

	/** Remove an error or notice from the bar. */
	dismiss(): void {
		if (!this.active) this.patch({ ...IDLE });
	}

	/**
	 * Frequency levels (0-255) for the waveform: the assistant's voice while it speaks, the
	 * microphone otherwise. Null when there is nothing to draw.
	 */
	levels(): Uint8Array | null {
		const conversation = this.session?.conversation;
		if (!conversation || !this.connected) return null;
		try {
			if (this.state.phase === 'speaking') return conversation.getOutputByteFrequencyData();
			return this.state.muted ? null : conversation.getInputByteFrequencyData();
		} catch {
			return null;
		}
	}

	// --- one connection ---------------------------------------------------------------

	private async open(first: 'requesting-mic' | 'reconnecting'): Promise<void> {
		const run = ++this.run;
		this.patch({ ...IDLE, phase: first });
		let created: Session | null = null;
		try {
			if (first === 'requesting-mic') {
				await requestMicPermission();
				if (run !== this.run) return;
				this.patch({ phase: 'connecting' });
			}
			const started = await this.api<any>('POST', '/sessions', {
				conversation_id: this.assistant.conversation,
				messages: this.assistant.history()
			});
			created = {
				id: started.session_id,
				conversationId: started.conversation_id,
				after: 0,
				conversation: null,
				endsAt: Date.now() + Number(started.max_seconds) * 1000
			};
			if (started.usage) this.usage$.next(started.usage);
			if (run !== this.run) { void this.finishOnServer(created); return; }
			this.session = created;

			const sdk = await this.loadSdk();
			const conversation = await sdk.startSession({
				conversationToken: started.token,
				connectionType: 'webrtc',
				...this.callbacks(run)
			});
			if (run !== this.run) {
				await this.hangUp({ ...created, conversation });
				void this.finishOnServer(created);
				return;
			}
			created.conversation = conversation;
			if (!this.connected) this.patch({ phase: 'listening' });
			this.startTimers(run);
			void this.checkMic(run);
		} catch (error) {
			if (run !== this.run) return;
			this.release();
			if (created) void this.finishOnServer(created);
			const delay = this.timings.reconnectDelaysMs[this.reconnects];
			if (first === 'reconnecting' && delay !== undefined && this.transient(error)) {
				this.reconnects++;
				await this.sleep(delay);
				if (run === this.run) await this.open('reconnecting');
				return;
			}
			this.patch({ ...IDLE, problem: first === 'reconnecting' && this.transient(error) ? PROBLEMS['connection-lost'] : this.problemOf(error) });
		}
	}

	private callbacks(run: number): VoiceSdkCallbacks {
		const mine = (action: () => void) => this.zone.run(() => { if (run === this.run) action(); });
		return {
			onModeChange: ({ mode }) => mine(() => {
				if (mode === 'speaking') this.patch({ phase: 'speaking' });
				else if (this.state.phase === 'speaking') this.patch({ phase: 'listening' });
			}),
			onMessage: ({ message, role }) => mine(() => {
				if (role === 'user') {
					this.reconnects = 0; // the connection works
					this.thinkingSince = Date.now();
					this.patch({ userCaption: message, agentCaption: '', phase: this.connected ? 'thinking' : this.state.phase });
				} else {
					this.patch({ agentCaption: message });
				}
				this.pollSoon(run);
			}),
			// The user talked over the reply: ElevenLabs stops the audio, limoagent cancels the agent.
			onInterruption: () => mine(() => {
				if (this.state.phase === 'speaking') this.patch({ phase: 'listening' });
				this.pollSoon(run);
			}),
			onError: message => console.warn('Voice:', message),
			onDisconnect: () => mine(() => { void this.dropped(); })
		};
	}

	/** The connection ended and it was not us: find out why, then reconnect or stop. */
	private async dropped(): Promise<void> {
		if (!this.session) return; // already being handled
		const run = ++this.run;
		const session = this.release();
		this.patch({ phase: 'reconnecting', muted: false });
		await this.hangUp(session);
		const ended = await this.finishOnServer(session);
		if (run !== this.run) return;

		const final = ended?.end_reason ? FINAL_REASONS[ended.end_reason] : undefined;
		if (final) {
			this.patch({ ...IDLE, notice: final });
			return;
		}
		if (!this.authService.getAccessToken()) {
			this.patch({ ...IDLE, problem: PROBLEMS['signed-out'] });
			return;
		}
		const delay = this.timings.reconnectDelaysMs[this.reconnects];
		if (delay === undefined) {
			this.patch({ ...IDLE, problem: PROBLEMS['connection-lost'] });
			return;
		}
		this.reconnects++;
		await this.sleep(delay);
		if (run !== this.run) return;
		await this.open('reconnecting');
	}

	private async wind(notice: string): Promise<void> {
		++this.run;
		const session = this.release();
		this.patch({ phase: 'ending', problem: null });
		await this.hangUp(session);
		await this.finishOnServer(session);
		this.patch({ ...IDLE, notice });
	}

	/** Forget the session locally: timers off, callbacks of its connection ignored from now on. */
	private release(): Session | null {
		const session = this.session;
		this.session = null;
		clearInterval(this.pollTimer);
		clearTimeout(this.pollSoonTimer);
		clearInterval(this.clockTimer);
		this.pollTimer = this.pollSoonTimer = this.clockTimer = undefined;
		return session;
	}

	private async hangUp(session: Session | null): Promise<void> {
		try { await session?.conversation?.endSession(); } catch { }
	}

	/**
	 * End the session in limoagent (safe to repeat) and merge its turns for good. A turn the agent
	 * is still writing is waited for briefly; then it is taken as it is.
	 */
	private async finishOnServer(session: Session | null): Promise<TurnsResponse | null> {
		if (!session) return null;
		let ended: TurnsResponse;
		try {
			ended = await this.api<TurnsResponse>('POST', `/sessions/${session.id}/end`);
		} catch {
			// Unreachable: limoagent closes the session itself once it stops hearing from it.
			this.assistant.applyVoiceTurns(session.conversationId, [], true);
			return null;
		}
		let turns = ended.turns || [];
		for (let attempt = 0; attempt < this.timings.settleAttempts && turns.some(t => t.status === 'running'); attempt++) {
			await this.sleep(this.timings.settleDelayMs);
			try {
				turns = (await this.api<TurnsResponse>('GET', `/sessions/${session.id}/turns?after=0`)).turns || turns;
			} catch {
				break;
			}
		}
		this.assistant.applyVoiceTurns(session.conversationId, turns, true);
		if (ended.usage) this.zone.run(() => this.usage$.next(ended.usage ?? null));
		return ended;
	}

	/** The tab is going away: end what can be ended without waiting. */
	private abandon(): void {
		const session = this.release();
		if (!session) return;
		++this.run;
		void this.hangUp(session);
		try {
			void fetch(`${VOICE_URL}/sessions/${session.id}/end`, { method: 'POST', headers: this.headers(), keepalive: true })
				.catch(() => { });
		} catch { }
		this.state$.next({ ...IDLE });
	}

	// --- while connected --------------------------------------------------------------

	private startTimers(run: number): void {
		this.zone.runOutsideAngular(() => {
			this.pollTimer = setInterval(() => { void this.poll(run); }, this.timings.pollMs);
			this.clockTimer = setInterval(() => this.tick(run), 1000);
		});
		this.tick(run);
	}

	private tick(run: number): void {
		const session = this.session;
		if (run !== this.run || !session) return;
		const secondsLeft = Math.max(0, Math.ceil((session.endsAt - Date.now()) / 1000));
		if (secondsLeft !== this.state.secondsLeft) this.patch({ secondsLeft });
		// limoagent ends it too; this only keeps the microphone from staying open if that is missed.
		if (secondsLeft <= 0) void this.stop(FINAL_REASONS['time_limit']);
	}

	private pollSoon(run: number): void {
		clearTimeout(this.pollSoonTimer);
		this.pollSoonTimer = setTimeout(() => { void this.poll(run); }, this.timings.pollSoonMs);
	}

	/** Fetch the turns that are new or still changing and merge them into the chat. */
	private async poll(run: number): Promise<void> {
		const session = this.session;
		if (run !== this.run || !session || this.polling) return;
		this.polling = true;
		try {
			const page = await this.api<TurnsResponse>('GET', `/sessions/${session.id}/turns?after=${session.after}`);
			if (run !== this.run) return;
			const turns = (page.turns || []).sort((a, b) => a.seq - b.seq);
			this.assistant.applyVoiceTurns(session.conversationId, turns);
			// Only move past turns that will not change any more; a running one is fetched again.
			for (const turn of turns) {
				if (turn.status === 'running') break;
				session.after = Math.max(session.after, turn.seq);
			}
			const busy = turns.some(turn => turn.status === 'running');
			if (this.state.phase === 'thinking' && !busy && Date.now() - this.thinkingSince > 2 * this.timings.pollMs) {
				this.patch({ phase: 'listening' }); // nothing is being written and nothing is being said
			}
			if (page.status === 'ended') void this.dropped(); // limoagent closed it (time limit, signed out, ...)
		} catch (error) {
			if (run === this.run && error instanceof VoiceApiError && (error.status === 401 || error.status === 404)) {
				void this.dropped();
			}
			// Anything else: the next poll tries again.
		} finally {
			this.polling = false;
		}
	}

	private async checkMic(run: number): Promise<void> {
		const conversation = this.session?.conversation;
		if (!conversation) return;
		const processing = await verifyMic(conversation, { attempts: this.timings.micAttempts, delayMs: this.timings.micDelayMs });
		if (run === this.run && this.session?.conversation === conversation) this.patch({ processing });
	}

	// --- plumbing ---------------------------------------------------------------------

	private patch(change: Partial<VoiceState>): void {
		this.zone.run(() => this.state$.next({ ...this.state, ...change }));
	}

	private sleep(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	private headers(): Record<string, string> {
		const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Accept': 'application/json', ...NGROK_HEADERS };
		const token = this.authService.getAccessToken();
		if (token) headers['Authorization'] = `Bearer ${token}`;
		return headers;
	}

	/** Plain fetch, as AiAssistantService: a 401 from the assistant must never log the user out. */
	private async api<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
		let res: Response;
		try {
			res = await fetch(`${VOICE_URL}${path}`, {
				method,
				headers: this.headers(),
				body: body === undefined ? undefined : JSON.stringify(body)
			});
		} catch {
			throw new VoiceApiError(0, 'network', 'The assistant could not be reached.');
		}
		const json = await res.json().catch(() => null);
		if (!res.ok) throw new VoiceApiError(res.status, json?.error?.code || 'error', json?.error?.message || '');
		return json as T;
	}

	/** Worth trying again by itself: the network, the server or the SDK's connection, not a refusal. */
	private transient(error: unknown): boolean {
		if (error instanceof MicError) return false;
		if (error instanceof VoiceApiError) return error.status === 0 || error.status >= 500;
		return !SDK_MIC_ERRORS[(error as any)?.name];
	}

	private problemOf(error: unknown): VoiceProblem {
		if (error instanceof MicError) return PROBLEMS[error.code] ?? PROBLEMS['mic-error'];
		if (error instanceof VoiceApiError) {
			if (error.status === 401) return PROBLEMS['signed-out'];
			if (error.status === 429) {
				// rate_limited or voice_limit_reached: the server's sentence says which.
				void this.refreshAvailability();
				return { code: error.code, message: error.message || 'You have used your voice time for now. You can keep typing.', canRetry: false };
			}
			return error.status === 0 ? PROBLEMS['offline'] : PROBLEMS['unavailable'];
		}
		// The SDK could not connect; on some browsers a refused microphone surfaces here.
		const mic = SDK_MIC_ERRORS[(error as any)?.name];
		if (mic) return PROBLEMS[mic];
		console.error('Voice: could not connect', error);
		return PROBLEMS['unavailable'];
	}
}
