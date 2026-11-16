import { AiAssistantService, AiVoiceTurn } from '../ai-assistant.service';
import { VoiceSdkCallbacks, VoiceSessionService, VoiceTimings } from './voice-session.service';

/**
 * Voice sessions against a fake limoagent (fetch) and a fake ElevenLabs SDK: switching between
 * typing and talking, one conversation throughout, interruptions, the microphone and recovery.
 */

const TIMINGS: VoiceTimings = {
	pollMs: 20, pollSoonMs: 1, reconnectDelaysMs: [1, 1], settleAttempts: 3, settleDelayMs: 1, micAttempts: 2, micDelayMs: 1
};
const USAGE = {
	daily_limit_seconds: 900, daily_used_seconds: 0, monthly_limit_seconds: 3600, monthly_used_seconds: 0,
	remaining_seconds: 900, resets_at: 1900000000
};

function json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function failure(status: number, code: string, message: string): Response {
	return json({ error: { code, message, request_id: 'r' } }, status);
}

interface FakeSession {
	id: string;
	conversationId: string;
	status: 'active' | 'ended';
	endReason: string | null;
	turns: AiVoiceTurn[];
	/** The history the widget sent when it started the session. */
	messages: { role: string; content: string }[];
}

/** limoagent's /v1/voice and /v1/chat, as far as the widget uses them. */
class Backend {
	calls: string[] = [];
	sessions: FakeSession[] = [];
	chats: any[] = [];
	voiceOn = true;
	offline = false;
	maxSeconds = 600;
	/** Answers the next POST /v1/voice/sessions instead of starting one. */
	refuseStart: Response | null = null;
	chatReply: () => Response = () => json({ content: 'Typed reply.' });
	keepalive: string[] = [];

	turn(session: FakeSession, turn: Partial<AiVoiceTurn>): AiVoiceTurn {
		const seq = session.turns.length + 1;
		const full: AiVoiceTurn = {
			id: `vt_${session.id}_${seq}`, seq, status: 'completed', user_text: '', user_original: '', assistant_text: '',
			reply_type: null, booking: null, error_code: null, created_at: 1700000000 + seq, ...turn
		};
		if (!full.user_original) full.user_original = full.user_text;
		session.turns.push(full);
		return full;
	}

	async handle(input: any, init: any = {}): Promise<Response> {
		const url = new URL(String(input));
		const method = init.method || 'GET';
		const path = url.pathname + url.search;
		this.calls.push(`${method} ${path}`);
		if (init.keepalive) this.keepalive.push(path);
		if (this.offline) throw new TypeError('Failed to fetch');
		const body = init.body ? JSON.parse(init.body) : undefined;
		const signedIn = !!init.headers?.['Authorization'];

		if (url.pathname === '/v1/chat') {
			this.chats.push(body);
			return this.chatReply();
		}
		if (!this.voiceOn) return failure(404, 'not_found', 'Not found.');
		if (!signedIn) return failure(401, 'unauthorized', 'Sign in.');
		if (url.pathname === '/v1/voice/usage') return json(USAGE);
		if (url.pathname === '/v1/voice/sessions') {
			if (this.refuseStart) {
				const refused = this.refuseStart;
				this.refuseStart = null;
				return refused;
			}
			const session: FakeSession = {
				id: `vs_${this.sessions.length + 1}`, conversationId: body.conversation_id, status: 'active', endReason: null,
				turns: [], messages: body.messages
			};
			this.sessions.push(session);
			return json({
				session_id: session.id, conversation_id: session.conversationId, token: `token-${this.sessions.length}`,
				max_seconds: this.maxSeconds, connect_within_seconds: 90, usage: USAGE
			});
		}
		const match = /^\/v1\/voice\/sessions\/([^/]+)\/(turns|end)$/.exec(url.pathname);
		const session = this.sessions.find(s => s.id === match?.[1]);
		if (!match || !session) return failure(404, 'not_found', 'Not found.');
		if (match[2] === 'end') {
			session.status = 'ended';
			session.endReason = session.endReason || 'user';
			session.turns.forEach(t => { if (t.status === 'running') t.status = 'interrupted'; });
		}
		const after = Number(url.searchParams.get('after') || 0);
		return json({
			session_id: session.id, conversation_id: session.conversationId, status: session.status, end_reason: session.endReason,
			turns: session.turns.filter(t => match[2] === 'end' || t.seq > after),
			usage: match[2] === 'end' ? USAGE : null
		});
	}
}

function micTrack(settings: Record<string, unknown>): any {
	const track: any = {
		kind: 'audio', readyState: 'live', label: 'Test microphone', settings, applied: [],
		getSettings: () => ({ ...track.settings }),
		getConstraints: () => ({}),
		applyConstraints: async (wanted: any) => {
			track.applied.push(wanted);
			Object.keys(wanted).forEach(key => track.settings[key] = wanted[key]);
		}
	};
	return track;
}

class FakeConversation {
	muted = false;
	endSession = jasmine.createSpy('endSession').and.resolveTo(undefined);
	setMicMuted = jasmine.createSpy('setMicMuted').and.callFake((muted: boolean) => { this.muted = muted; });
	connection: any;

	constructor(public options: VoiceSdkCallbacks & { conversationToken: string; connectionType: string }, mic: any) {
		const publications = new Map([['sid', { track: { mediaStreamTrack: mic } }]]);
		this.connection = mic ? { getRoom: () => ({ localParticipant: { audioTrackPublications: publications } }) } : undefined;
	}

	getInputByteFrequencyData(): Uint8Array { return new Uint8Array([10, 20, 30]); }
	getOutputByteFrequencyData(): Uint8Array { return new Uint8Array([90, 80, 70]); }
}

class FakeSdk {
	conversations: FakeConversation[] = [];
	/** Thrown by startSession while set. */
	broken: any = null;
	/** The microphone track the next conversation publishes; null hides it (an SDK that changed). */
	mic: any = micTrack({ echoCancellation: true, noiseSuppression: true, autoGainControl: true });

	startSession = async (options: any): Promise<FakeConversation> => {
		if (this.broken) throw this.broken;
		const conversation = new FakeConversation(options, this.mic);
		this.conversations.push(conversation);
		return conversation;
	}

	get last(): FakeConversation {
		return this.conversations[this.conversations.length - 1];
	}
}

async function until(condition: () => boolean, what: string, ms = 3000): Promise<void> {
	const started = Date.now();
	while (!condition()) {
		if (Date.now() - started > ms) throw new Error(`Timed out waiting for ${what}`);
		await new Promise(resolve => setTimeout(resolve, 5));
	}
}

function named(name: string): Error {
	const error = new Error(name);
	error.name = name;
	return error;
}

describe('VoiceSessionService', () => {
	let backend: Backend;
	let sdk: FakeSdk;
	let token: string | null;
	let assistant: AiAssistantService;
	let voice: VoiceSessionService;
	let getUserMedia: jasmine.Spy;

	const contents = () => assistant.messages.map(m => `${m.role}: ${m.content}`);
	const live = async () => {
		await voice.start();
		expect(voice.state.problem).toBeNull();
		expect(voice.state.phase).toBe('listening');
		return backend.sessions[backend.sessions.length - 1];
	};
	const idle = () => until(() => voice.state.phase === 'idle', 'the session to end');

	beforeEach(() => {
		sessionStorage.clear();
		backend = new Backend();
		sdk = new FakeSdk();
		token = 'user-token';
		spyOn(window, 'fetch').and.callFake((input: any, init?: any) => backend.handle(input, init));
		getUserMedia = spyOn(navigator.mediaDevices, 'getUserMedia').and.resolveTo({ getTracks: () => [] } as any);
		spyOn(console, 'warn');
		spyOn(console, 'error');

		const auth: any = { getAccessToken: () => token, currentUserValue: { id: 7 } };
		const zone: any = { run: (fn: () => unknown) => fn(), runOutsideAngular: (fn: () => unknown) => fn() };
		assistant = new AiAssistantService(auth, zone);
		voice = new VoiceSessionService(assistant, auth, zone, async () => sdk, TIMINGS);
	});

	afterEach(() => {
		voice.ngOnDestroy();
		sessionStorage.clear();
	});

	describe('availability', () => {
		it('offers voice to a signed-in user when limoagent has it on', async () => {
			assistant.open();
			await until(() => voice.available$.value, 'the mic button');

			expect(voice.usage$.value?.remaining_seconds).toBe(900);
			expect(voice.hasTime).toBeTrue();
		});

		it('does not offer it to guests, and asks nothing', async () => {
			token = null;
			await voice.refreshAvailability();

			expect(voice.available$.value).toBeFalse();
			expect(backend.calls).toEqual([]);
		});

		it('does not offer it when voice is off on the server', async () => {
			backend.voiceOn = false;
			await voice.refreshAvailability();

			expect(voice.available$.value).toBeFalse();
		});
	});

	describe('starting', () => {
		it('asks for the microphone, then for a token, then connects over WebRTC', async () => {
			const session = await live();

			expect(getUserMedia).toHaveBeenCalledBefore(window.fetch as jasmine.Spy);
			expect(backend.calls).toEqual(['POST /v1/voice/sessions']);
			expect(session.conversationId).toBe(assistant.conversation);
			expect(sdk.last.options.conversationToken).toBe('token-1');
			expect(sdk.last.options.connectionType).toBe('webrtc');
			// Only the server-minted token goes to the SDK: no agent id, no API key.
			expect(Object.keys(sdk.last.options).filter(key => !key.startsWith('on')).sort())
				.toEqual(['connectionType', 'conversationToken']);
		});

		it('does not create a session when the microphone is refused', async () => {
			getUserMedia.and.rejectWith(named('NotAllowedError'));

			await voice.start();

			expect(voice.state.phase).toBe('idle');
			expect(voice.state.problem?.code).toBe('mic-denied');
			expect(voice.state.problem?.canRetry).toBeTrue();
			expect(backend.calls).toEqual([]);
			expect(sdk.conversations.length).toBe(0);
		});

		it('reports a missing microphone', async () => {
			getUserMedia.and.rejectWith(named('NotFoundError'));

			await voice.start();

			expect(voice.state.problem?.code).toBe('mic-missing');
		});

		it('shows the server\'s sentence when the voice allowance is used up', async () => {
			backend.refuseStart = failure(429, 'voice_limit_reached', 'You have used your voice time for now. You can keep typing.');

			await voice.start();

			expect(voice.state.phase).toBe('idle');
			expect(voice.state.problem).toEqual({
				code: 'voice_limit_reached', message: 'You have used your voice time for now. You can keep typing.', canRetry: false
			});
			expect(sdk.conversations.length).toBe(0);
		});

		it('offers to try again when the voice provider is down or the network is', async () => {
			backend.refuseStart = failure(503, 'voice_unavailable', 'Voice is temporarily unavailable.');
			await voice.start();
			expect(voice.state.problem?.code).toBe('unavailable');
			expect(voice.state.problem?.canRetry).toBeTrue();

			backend.offline = true;
			await voice.start();
			expect(voice.state.problem?.code).toBe('offline');

			backend.offline = false;
			await live(); // and trying again works
		});

		it('ends the server session when the SDK cannot connect', async () => {
			sdk.broken = new Error('could not join');

			await voice.start();
			await until(() => backend.sessions[0]?.status === 'ended', 'the session to be ended');

			expect(voice.state.phase).toBe('idle');
			expect(voice.state.problem?.code).toBe('unavailable');
		});

		it('drops a start the user cancelled while the browser was still asking', async () => {
			let allow: (stream: any) => void = () => { };
			getUserMedia.and.returnValue(new Promise(resolve => allow = resolve));

			const starting = voice.start();
			expect(voice.state.phase).toBe('requesting-mic');
			await voice.stop();
			allow({ getTracks: () => [] });
			await starting;

			expect(voice.state.phase).toBe('idle');
			expect(backend.calls).toEqual([]);
		});

		it('asks guests to sign in', async () => {
			token = null;

			await voice.start();

			expect(voice.state.problem?.code).toBe('signed-out');
			expect(getUserMedia).not.toHaveBeenCalled();
		});
	});

	describe('a spoken conversation', () => {
		it('follows listening, thinking and speaking, with live captions', async () => {
			await live();
			const sdkEvents = sdk.last.options;

			sdkEvents.onMessage?.({ message: 'when is my next ride', role: 'user' });
			expect(voice.state.phase).toBe('thinking');
			expect(voice.state.userCaption).toBe('when is my next ride');

			sdkEvents.onModeChange?.({ mode: 'speaking' });
			sdkEvents.onMessage?.({ message: 'Tomorrow at nine.', role: 'agent' });
			expect(voice.state.phase).toBe('speaking');
			expect(voice.state.agentCaption).toBe('Tomorrow at nine.');

			sdkEvents.onModeChange?.({ mode: 'listening' });
			expect(voice.state.phase).toBe('listening');
		});

		it('puts each turn into the chat once, however often it is fetched', async () => {
			const session = await live();
			const turn = backend.turn(session, { status: 'running', user_text: 'When is my next ride?' });

			sdk.last.options.onMessage?.({ message: 'when is my next ride', role: 'user' });
			await until(() => assistant.messages.length === 2, 'the running turn');
			expect(assistant.messages[1].streaming).toBeTrue(); // shown as typing

			turn.assistant_text = 'Tomorrow at nine.';
			turn.status = 'completed';
			await until(() => assistant.messages[1]?.content === 'Tomorrow at nine.', 'the finished turn');
			backend.turn(session, { user_text: 'And the one after?', assistant_text: 'Friday at noon.' });
			await until(() => backend.calls.includes('GET /v1/voice/sessions/vs_1/turns?after=2'), 'a poll past both turns');
			const fetchedAgain = backend.calls.filter(call => call.endsWith('turns?after=0')).length;
			await voice.stop();

			expect(contents()).toEqual([
				'user: When is my next ride?', 'assistant: Tomorrow at nine.',
				'user: And the one after?', 'assistant: Friday at noon.'
			]);
			expect(new Set(assistant.messages.map(m => m.id)).size).toBe(4);
			expect(assistant.messages.every(m => !!m.voice && !m.streaming)).toBeTrue();
			// The running turn was fetched again until it finished (the same two messages each time).
			expect(fetchedAgain).toBeGreaterThan(1);
		});

		it('goes back to listening when the user talks over the reply', async () => {
			const session = await live();
			sdk.last.options.onModeChange?.({ mode: 'speaking' });

			sdk.last.options.onInterruption?.({ event_id: 3 });
			expect(voice.state.phase).toBe('listening');

			// limoagent cancelled the agent: what it had written stays, once, and is not "typing".
			backend.turn(session, { status: 'interrupted', user_text: 'Tell me about your fleet', assistant_text: 'We have sedans,' });
			backend.turn(session, { status: 'interrupted', user_text: 'Never mind' }); // cut off before a word
			await until(() => assistant.messages.length === 3, 'the interrupted turns');

			expect(contents()).toEqual(['user: Tell me about your fleet', 'assistant: We have sedans,', 'user: Never mind']);
			expect(assistant.messages.some(m => m.streaming || m.failed)).toBeFalse();
		});

		it('shows a turn that failed and leaves it out of what the assistant is told next', async () => {
			const session = await live();
			backend.turn(session, { status: 'failed', user_text: 'Book it', error_code: 'llm_timeout' });
			await until(() => assistant.messages.length === 2, 'the failed turn');

			expect(assistant.messages[1].failed).toBeTrue();
			expect(assistant.history()).toEqual([{ role: 'user', content: 'Book it' }]);
		});

		it('mutes and unmutes the SDK\'s microphone', async () => {
			await live();

			voice.toggleMute();
			expect(sdk.last.setMicMuted).toHaveBeenCalledOnceWith(true);
			expect(voice.state.muted).toBeTrue();
			expect(voice.levels()).toBeNull();

			voice.toggleMute();
			expect(sdk.last.setMicMuted).toHaveBeenCalledWith(false);
			expect(voice.state.muted).toBeFalse();
		});

		it('draws the microphone while listening and the assistant while it speaks', async () => {
			expect(voice.levels()).toBeNull();
			await live();
			expect(Array.from(voice.levels() || [])).toEqual([10, 20, 30]);

			sdk.last.options.onModeChange?.({ mode: 'speaking' });
			expect(Array.from(voice.levels() || [])).toEqual([90, 80, 70]);
		});

		it('ends the session when its time is up', async () => {
			backend.maxSeconds = 0;

			await voice.start();
			await idle();

			expect(voice.state.notice).toContain('time limit');
			expect(sdk.last.endSession).toHaveBeenCalled();
			expect(backend.sessions[0].status).toBe('ended');
		});
	});

	describe('microphone processing', () => {
		it('reports what the published track really applies', async () => {
			await live();
			await until(() => !!voice.state.processing, 'the microphone check');

			expect(voice.state.processing).toEqual(jasmine.objectContaining({
				verified: true, echoCancellation: 'on', noiseSuppression: 'on', autoGainControl: 'on', repaired: [], label: 'Test microphone'
			}));
		});

		it('turns on what the browser left off, on the same track', async () => {
			sdk.mic = micTrack({ echoCancellation: true, noiseSuppression: false, autoGainControl: true });

			await live();
			await until(() => !!voice.state.processing, 'the microphone check');

			expect(sdk.mic.applied).toEqual([{ noiseSuppression: true }]);
			expect(voice.state.processing?.noiseSuppression).toBe('on');
			expect(voice.state.processing?.repaired).toEqual(['noiseSuppression']);
		});

		it('says so when the SDK\'s track cannot be inspected, and keeps the session', async () => {
			sdk.mic = null;

			await live();
			await until(() => !!voice.state.processing, 'the microphone check');

			expect(voice.state.processing?.verified).toBeFalse();
			expect(voice.state.phase).toBe('listening');
		});
	});

	describe('switching between typing and talking', () => {
		it('ends voice before a typed message and sends everything under one conversation', async () => {
			assistant.send('hello');
			await until(() => !assistant.isStreaming$.value && backend.chats.length === 1, 'the typed reply');
			const conversation = assistant.conversation;

			// Text -> voice: the session continues the same conversation and is given its history.
			const session = await live();
			expect(session.conversationId).toBe(conversation);
			expect(session.messages).toEqual([{ role: 'user', content: 'hello' }, { role: 'assistant', content: 'Typed reply.' }]);
			backend.turn(session, { user_text: 'When is my next ride?', user_original: 'when is my next ride', assistant_text: 'Tomorrow at nine.' });
			await until(() => assistant.messages.length === 4, 'the spoken turn');

			// Voice -> text: typing ends the session first.
			assistant.send('and the one after?');
			await until(() => !assistant.isStreaming$.value && backend.chats.length === 2, 'the second typed reply');

			expect(sdk.last.endSession).toHaveBeenCalled();
			expect(session.status).toBe('ended');
			expect(voice.state.phase).toBe('idle');
			expect(backend.calls.indexOf('POST /v1/voice/sessions/vs_1/end')).toBeLessThan(backend.calls.lastIndexOf('POST /v1/chat'));
			expect(backend.chats[1].conversation_id).toBe(conversation);
			expect(backend.chats[1].messages).toEqual([
				{ role: 'user', content: 'hello' }, { role: 'assistant', content: 'Typed reply.' },
				{ role: 'user', content: 'When is my next ride?' }, { role: 'assistant', content: 'Tomorrow at nine.' },
				{ role: 'user', content: 'and the one after?' }
			]);
			expect(contents()).toEqual([
				'user: hello', 'assistant: Typed reply.', 'user: When is my next ride?', 'assistant: Tomorrow at nine.',
				'user: and the one after?', 'assistant: Typed reply.'
			]);

			// Text -> voice again: still the same conversation, with everything said so far.
			const again = await live();
			expect(again.conversationId).toBe(conversation);
			expect(again.messages.length).toBe(6);
			expect(again.messages[2]).toEqual({ role: 'user', content: 'When is my next ride?' });
		});

		it('picks up a turn that only shows when the session ends', async () => {
			const session = await live();
			backend.turn(session, { status: 'running', user_text: 'Book it', assistant_text: 'Booked for' });

			assistant.send('thanks');
			await until(() => backend.chats.length === 1, 'the typed message');

			// The half-written reply was taken as it was when the session closed, once.
			expect(backend.chats[0].messages).toEqual([
				{ role: 'user', content: 'Book it' }, { role: 'assistant', content: 'Booked for' }, { role: 'user', content: 'thanks' }
			]);
		});

		it('does not send a typed message twice while voice is being ended', async () => {
			await live();

			assistant.send('one');
			assistant.send('one');
			await until(() => !assistant.isStreaming$.value && backend.chats.length >= 1, 'the typed reply');

			expect(backend.chats.length).toBe(1);
			expect(contents()).toEqual(['user: one', 'assistant: Typed reply.']);
		});

		it('keeps a new chat free of the voice session it ended', async () => {
			const session = await live();
			backend.turn(session, { user_text: 'When is my next ride?', assistant_text: 'Tomorrow at nine.' });
			const before = assistant.conversation;

			assistant.clear();
			await idle();

			expect(session.status).toBe('ended');
			expect(assistant.conversation).not.toBe(before);
			expect(assistant.messages).toEqual([]);
		});

		it('closes the microphone when the chat panel is closed', async () => {
			assistant.open();
			await live();

			assistant.close();
			await idle();

			expect(sdk.last.endSession).toHaveBeenCalled();
			expect(backend.sessions[0].status).toBe('ended');
		});

		it('ends the session without waiting when the page goes away', async () => {
			await live();

			window.dispatchEvent(new Event('pagehide'));

			expect(sdk.last.endSession).toHaveBeenCalled();
			expect(backend.keepalive).toEqual(['/v1/voice/sessions/vs_1/end']);
			expect(voice.state.phase).toBe('idle');
		});

		it('does not start voice while a typed reply is still arriving', async () => {
			assistant.isStreaming$.next(true);

			await voice.start();

			expect(voice.state.phase).toBe('idle');
			expect(getUserMedia).not.toHaveBeenCalled();
		});
	});

	describe('recovery', () => {
		it('reconnects by itself after a dropped connection, in the same conversation', async () => {
			const first = await live();
			backend.turn(first, { user_text: 'When is my next ride?', assistant_text: 'Tomorrow at nine.' });

			sdk.last.options.onDisconnect?.({ reason: 'error', message: 'ice failed' });
			expect(voice.state.phase).toBe('reconnecting');
			await until(() => sdk.conversations.length === 2 && voice.state.phase === 'listening', 'the reconnect');

			const second = backend.sessions[1];
			expect(first.status).toBe('ended');
			expect(second.conversationId).toBe(first.conversationId);
			// What was said before the drop is in the chat once, and the new session is told it.
			expect(second.messages).toEqual([
				{ role: 'user', content: 'When is my next ride?' }, { role: 'assistant', content: 'Tomorrow at nine.' }
			]);
			expect(contents()).toEqual(['user: When is my next ride?', 'assistant: Tomorrow at nine.']);
			expect(sdk.last.options.conversationToken).toBe('token-2'); // a token is used once
			expect(getUserMedia).toHaveBeenCalledTimes(1); // permission is not asked again
		});

		it('ignores events of the connection it replaced', async () => {
			await live();
			const old = sdk.last.options;
			old.onDisconnect?.({ reason: 'error' });
			await until(() => sdk.conversations.length === 2 && voice.state.phase === 'listening', 'the reconnect');

			old.onModeChange?.({ mode: 'speaking' });
			old.onMessage?.({ message: 'stale', role: 'user' });
			old.onDisconnect?.({ reason: 'error' });

			expect(voice.state.phase).toBe('listening');
			expect(voice.state.userCaption).toBe('');
			expect(sdk.conversations.length).toBe(2);
		});

		it('gives up after a few tries and reconnects when asked', async () => {
			await live();
			sdk.broken = new Error('still down');

			sdk.last.options.onDisconnect?.({ reason: 'error' });
			await idle();

			expect(voice.state.problem?.code).toBe('connection-lost');
			expect(voice.state.problem?.canRetry).toBeTrue();
			expect(backend.sessions.length).toBe(3); // the dropped one and two tries
			await until(() => backend.sessions.every(s => s.status === 'ended'), 'every session to be ended');

			sdk.broken = null;
			await voice.reconnect();
			expect(voice.state.phase).toBe('listening');
			expect(voice.state.problem).toBeNull();
		});

		it('reconnects on request without losing the conversation', async () => {
			const first = await live();
			backend.turn(first, { user_text: 'Hi', assistant_text: 'Hello!' });

			await voice.reconnect();

			expect(voice.state.phase).toBe('listening');
			expect(sdk.conversations[0].endSession).toHaveBeenCalled();
			expect(first.status).toBe('ended');
			expect(backend.sessions[1].messages).toEqual([{ role: 'user', content: 'Hi' }, { role: 'assistant', content: 'Hello!' }]);
		});

		const finalReasons: [string, string][] = [
			['time_limit', 'time limit'], ['replaced', 'another tab'], ['signed_out', 'signed out']
		];
		finalReasons.forEach(([reason, words]) => {
			it(`does not reconnect when the server ended the session (${reason})`, async () => {
				const session = await live();
				session.status = 'ended';
				session.endReason = reason;

				await idle(); // noticed by the next poll

				expect(voice.state.notice).toContain(words);
				expect(voice.state.problem).toBeNull();
				expect(backend.sessions.length).toBe(1);
				expect(sdk.last.endSession).toHaveBeenCalled();
			});
		});

		it('stops when the user signed out in the meantime', async () => {
			await live();

			token = null;
			await idle();

			expect(voice.state.problem?.code).toBe('signed-out');
			expect(backend.sessions.length).toBe(1);
		});

		it('keeps going through a failed poll', async () => {
			const session = await live();
			backend.offline = true;
			await new Promise(resolve => setTimeout(resolve, 60));
			expect(voice.state.phase).toBe('listening');

			backend.offline = false;
			backend.turn(session, { user_text: 'Hi', assistant_text: 'Hello!' });
			await until(() => assistant.messages.length === 2, 'the turn after the outage');
		});

		it('still ends locally when the server cannot be reached', async () => {
			const session = await live();
			backend.turn(session, { status: 'running', user_text: 'Hi' });
			await until(() => assistant.messages.length === 2, 'the running turn');
			backend.offline = true;

			await voice.stop();

			expect(voice.state.phase).toBe('idle');
			expect(sdk.last.endSession).toHaveBeenCalled();
			expect(contents()).toEqual(['user: Hi']); // nothing is left "typing" for ever
		});
	});

	describe('grammar correction', () => {
		const sse = (...events: [string, unknown][]) => new Response(
			events.map(([name, data]) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`).join(''),
			{ headers: { 'content-type': 'text/event-stream' } }
		);

		it('keeps what was typed next to what the assistant was given', async () => {
			backend.chatReply = () => sse(
				['start', {}],
				['correction', { original: 'i wants to no my rides', corrected: 'I want to know my rides.' }],
				['delta', { content: 'You have two.' }],
				['done', {}]
			);

			assistant.send('i wants to no my rides');
			await until(() => !assistant.isStreaming$.value, 'the reply');

			const [user, reply] = assistant.messages;
			expect(user.content).toBe('I want to know my rides.');
			expect(user.original).toBe('i wants to no my rides');
			expect(reply.content).toBe('You have two.'); // the correction is not reply text

			// Later requests send the corrected text, so it is never corrected again.
			backend.chatReply = () => json({ content: 'Tomorrow.' });
			assistant.send('when is the first?');
			await until(() => !assistant.isStreaming$.value && backend.chats.length === 2, 'the second reply');
			expect(backend.chats[1].messages[0]).toEqual({ role: 'user', content: 'I want to know my rides.' });
			expect(JSON.stringify(backend.chats[1])).not.toContain('i wants');
		});

		it('reads the correction of a reply that was not streamed', async () => {
			backend.chatReply = () => json({ content: 'Sure.', correction: { original: 'helo ther', corrected: 'Hello there.' } });

			assistant.send('helo ther');
			await until(() => !assistant.isStreaming$.value, 'the reply');

			expect(assistant.messages[0].content).toBe('Hello there.');
			expect(assistant.messages[0].original).toBe('helo ther');
		});

		it('leaves a message alone when the correction is for something else', async () => {
			backend.chatReply = () => json({ content: 'Sure.', correction: { original: 'another message', corrected: 'Another message.' } });

			assistant.send('helo ther');
			await until(() => !assistant.isStreaming$.value, 'the reply');

			expect(assistant.messages[0].content).toBe('helo ther');
			expect(assistant.messages[0].original).toBeUndefined();
		});

		it('keeps what was heard next to what the assistant was given, for spoken messages', async () => {
			const session = await live();
			backend.turn(session, {
				user_text: 'I want to know when my next ride is.', user_original: 'i wants to know when my next ride are',
				assistant_text: 'Tomorrow at nine.'
			});
			backend.turn(session, { user_text: '2', user_original: 'the second one', assistant_text: 'The SUV it is.' });
			backend.turn(session, { user_text: 'Thanks', user_original: 'Thanks', assistant_text: 'You\'re welcome.' });
			await until(() => assistant.messages.length === 6, 'the spoken turns');

			const [first, , second, , third] = assistant.messages;
			expect(first.content).toBe('I want to know when my next ride is.');
			expect(first.original).toBe('i wants to know when my next ride are');
			// A spoken answer to a numbered menu: the number was sent, the words are shown, nothing was "edited".
			expect(second.content).toBe('2');
			expect(second.display).toBe('the second one');
			expect(second.original).toBeUndefined();
			expect(third.original).toBeUndefined();
		});
	});
});
