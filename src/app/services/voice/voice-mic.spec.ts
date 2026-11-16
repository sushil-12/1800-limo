import {
	ensureProcessing, MicError, micErrorCode, processingSummary, publishedMicTrack, readProcessing,
	requestMicPermission, unverifiedProcessing, verifyMic
} from './voice-mic';

const ALL = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };

/** A microphone track whose settings change only if the "browser" accepts the constraint. */
class FakeTrack {
	kind = 'audio';
	readyState = 'live';
	label = 'Built-in Microphone';
	applied: any[] = [];
	stop = jasmine.createSpy('stop');

	constructor(
		public settings: Record<string, unknown>,
		private constraints: Record<string, unknown> = { deviceId: 'mic-1' },
		/** Keys the browser refuses to turn on. */
		private refused: string[] = []
	) { }

	getSettings(): any { return { ...this.settings }; }
	getConstraints(): any { return { ...this.constraints }; }

	async applyConstraints(wanted: Record<string, unknown>): Promise<void> {
		this.applied.push(wanted);
		const asked = Object.keys(wanted).filter(key => key in ALL && wanted[key] === true && this.settings[key] === false);
		if (asked.some(key => this.refused.includes(key))) {
			const error = new Error('refused');
			error.name = 'OverconstrainedError';
			throw error;
		}
		this.constraints = { ...wanted };
		asked.forEach(key => this.settings[key] = true);
	}
}

/** The shape the SDK has today: conversation.connection.getRoom().localParticipant.audioTrackPublications. */
function conversationWith(...tracks: any[]): any {
	const publications = new Map(tracks.map((track, i) => [`sid-${i}`, { track: { mediaStreamTrack: track } }]));
	return { connection: { getRoom: () => ({ localParticipant: { audioTrackPublications: publications } }) } };
}

function track(settings: Record<string, unknown>, refused: string[] = []): MediaStreamTrack & FakeTrack {
	return new FakeTrack(settings, { deviceId: 'mic-1' }, refused) as any;
}

describe('voice microphone', () => {
	describe('asking for the microphone', () => {
		it('asks for echo cancellation, noise suppression and gain control, then closes its stream', async () => {
			const probe = track({});
			const devices = { getUserMedia: jasmine.createSpy('getUserMedia').and.resolveTo({ getTracks: () => [probe] }) };

			await requestMicPermission(devices as any);

			expect(devices.getUserMedia).toHaveBeenCalledOnceWith({ audio: ALL });
			expect(probe.stop).toHaveBeenCalled(); // the SDK opens its own; two captures must not stay open
		});

		const refusals: [string, string][] = [
			['NotAllowedError', 'mic-denied'],
			['SecurityError', 'mic-denied'],
			['NotFoundError', 'mic-missing'],
			['OverconstrainedError', 'mic-missing'],
			['NotReadableError', 'mic-busy'],
			['AbortError', 'mic-busy'],
			['SomethingNew', 'mic-error']
		];
		refusals.forEach(([name, code]) => {
			it(`reports ${name} as ${code}`, async () => {
				const error = new Error('no');
				error.name = name;
				const devices = { getUserMedia: () => Promise.reject(error) };

				const thrown = await requestMicPermission(devices as any).then(() => null, e => e);

				expect(thrown instanceof MicError).toBeTrue();
				expect(thrown.code).toBe(code);
				expect(micErrorCode(error)).toBe(code as any);
			});
		});

		it('reports a browser without getUserMedia', async () => {
			const thrown = await requestMicPermission({} as any).then(() => null, e => e);

			expect(thrown.code).toBe('mic-unsupported');
		});
	});

	describe('finding the track that is sent', () => {
		it('returns the live audio track the SDK published', () => {
			const ended = track(ALL);
			ended.readyState = 'ended';
			const live = track(ALL);

			expect(publishedMicTrack(conversationWith(ended, live))).toBe(live);
		});

		it('returns null when the SDK does not expose it', () => {
			expect(publishedMicTrack(null)).toBeNull();
			expect(publishedMicTrack({})).toBeNull();
			expect(publishedMicTrack({ connection: {} })).toBeNull(); // a WebSocket connection has no room
			expect(publishedMicTrack({ connection: { getRoom: () => { throw new Error('gone'); } } })).toBeNull();
			expect(publishedMicTrack(conversationWith())).toBeNull();
		});
	});

	describe('reading what the browser applies', () => {
		it('reports each step from the track, not from what was asked', () => {
			const processing = readProcessing(track({ echoCancellation: true, noiseSuppression: false }), ALL);

			expect(processing.verified).toBeTrue();
			expect(processing.echoCancellation).toBe('on');
			expect(processing.noiseSuppression).toBe('off');
			expect(processing.autoGainControl).toBe('unknown'); // supported, but the browser does not say
			expect(processing.label).toBe('Built-in Microphone');
		});

		it('reports what the browser cannot do as unsupported', () => {
			const processing = readProcessing(track({ echoCancellation: true }), { echoCancellation: true });

			expect(processing.noiseSuppression).toBe('unsupported');
			expect(processing.autoGainControl).toBe('unsupported');
		});

		it('accepts the newer string values of echoCancellation', () => {
			expect(readProcessing(track({ echoCancellation: 'remote-only' }), ALL).echoCancellation).toBe('on');
		});
	});

	describe('turning on what was left off', () => {
		it('does not touch a track that already has everything', async () => {
			const mic = track({ ...ALL });

			const processing = await ensureProcessing(mic, ALL);

			expect(mic.applied).toEqual([]);
			expect(processing.repaired).toEqual([]);
			expect(processingSummary(processing)).toEqual({ ok: true, text: 'Echo cancellation, noise suppression and automatic gain control on.' });
		});

		it('applies the missing constraints to the same track, keeping its device', async () => {
			const mic = track({ echoCancellation: true, noiseSuppression: false, autoGainControl: false });

			const processing = await ensureProcessing(mic, ALL);

			expect(mic.applied).toEqual([{ deviceId: 'mic-1', noiseSuppression: true, autoGainControl: true }]);
			expect(processing.noiseSuppression).toBe('on');
			expect(processing.autoGainControl).toBe('on');
			expect(processing.repaired).toEqual(['noiseSuppression', 'autoGainControl']);
		});

		it('falls back to one constraint at a time when the browser refuses one', async () => {
			const mic = track({ echoCancellation: false, noiseSuppression: false, autoGainControl: true }, ['echoCancellation']);

			const processing = await ensureProcessing(mic, ALL);

			expect(mic.applied.length).toBe(3); // both together, then each alone
			expect(processing.echoCancellation).toBe('off');
			expect(processing.noiseSuppression).toBe('on');
			expect(processing.repaired).toEqual(['noiseSuppression']);
			const summary = processingSummary(processing);
			expect(summary.ok).toBeFalse();
			expect(summary.text).toBe('Echo cancellation is not available on this microphone. Use headphones to avoid echo.');
		});

		it('stays truthful when nothing can be turned on', async () => {
			const mic = track({ ...ALL, noiseSuppression: false }, ['noiseSuppression']);

			const processing = await ensureProcessing(mic, ALL);

			expect(processing.noiseSuppression).toBe('off');
			expect(processing.repaired).toEqual([]);
			expect(processingSummary(processing).text).toBe('Noise suppression is not available on this microphone. A quiet place helps.');
		});

		it('never asks for what the browser does not support', async () => {
			const mic = track({ echoCancellation: true, noiseSuppression: false });

			const processing = await ensureProcessing(mic, { echoCancellation: true });

			expect(mic.applied).toEqual([]);
			expect(processing.noiseSuppression).toBe('unsupported');
			expect(processingSummary(processing).ok).toBeFalse();
		});

		it('believes the track after applying, not the promise', async () => {
			const mic = track({ ...ALL, autoGainControl: false });
			mic.applyConstraints = async (wanted: any) => { mic.applied.push(wanted); }; // resolves, changes nothing

			const processing = await ensureProcessing(mic, ALL);

			expect(processing.autoGainControl).toBe('off');
			expect(processing.repaired).toEqual([]);
		});
	});

	describe('checking a session', () => {
		it('waits for the SDK to publish the microphone', async () => {
			const mic = track({ ...ALL });
			const publications = new Map<string, any>();
			const conversation = { connection: { getRoom: () => ({ localParticipant: { audioTrackPublications: publications } }) } };
			setTimeout(() => publications.set('sid', { track: { mediaStreamTrack: mic } }), 15);

			const processing = await verifyMic(conversation, { attempts: 40, delayMs: 5, supported: ALL });

			expect(processing.verified).toBeTrue();
			expect(processing.echoCancellation).toBe('on');
		});

		it('says so when the track cannot be reached', async () => {
			const processing = await verifyMic({}, { attempts: 2, delayMs: 1 });

			expect(processing).toEqual(unverifiedProcessing());
			const summary = processingSummary(processing);
			expect(summary.ok).toBeFalse();
			expect(summary.text).toContain('Couldn\'t confirm');
		});

		it('says what a browser does not report', () => {
			const processing = readProcessing(track({ echoCancellation: true }), ALL);

			expect(processingSummary(processing)).toEqual({
				ok: true,
				text: 'Echo cancellation on; this browser doesn\'t report noise suppression and automatic gain control.'
			});
			expect(processingSummary(null)).toEqual({ ok: true, text: '' });
		});
	});
});
