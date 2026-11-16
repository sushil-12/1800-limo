/**
 * The microphone of a voice session: asking for it, and checking what the browser really does to
 * the track that is sent.
 *
 * The ElevenLabs SDK (1.36) publishes the microphone through LiveKit:
 * `room.localParticipant.setMicrophoneEnabled(true)`, whose defaults ask for echo cancellation,
 * noise suppression, automatic gain control and voice isolation. Asking is not getting, so after
 * connecting we read `getSettings()` of that very track. A step the browser supports but left off
 * is turned on with `applyConstraints` on the same track. Nothing else touches the audio: no
 * second noise-suppression engine runs next to the browser's.
 */

export const PROCESSING_KEYS = ['echoCancellation', 'noiseSuppression', 'autoGainControl'] as const;
export type ProcessingKey = typeof PROCESSING_KEYS[number];

/**
 * - `on` / `off`: what the track reports.
 * - `unsupported`: this browser cannot do it.
 * - `unknown`: asked for, but this browser does not say whether it is applied.
 */
export type ProcessingState = 'on' | 'off' | 'unsupported' | 'unknown';

export interface MicProcessing {
	/** False when the SDK's microphone track could not be reached, so nothing was read. */
	verified: boolean;
	echoCancellation: ProcessingState;
	noiseSuppression: ProcessingState;
	autoGainControl: ProcessingState;
	/** Steps that were off and were turned on with applyConstraints. */
	repaired: ProcessingKey[];
	/** The microphone's name, as the browser gives it. */
	label: string;
}

export type MicErrorCode = 'mic-unsupported' | 'mic-denied' | 'mic-missing' | 'mic-busy' | 'mic-error';

export class MicError extends Error {
	constructor(public code: MicErrorCode) {
		super(code);
	}
}

const WANTED: MediaTrackConstraints = { echoCancellation: true, noiseSuppression: true, autoGainControl: true };

export function unverifiedProcessing(): MicProcessing {
	return {
		verified: false,
		echoCancellation: 'unknown',
		noiseSuppression: 'unknown',
		autoGainControl: 'unknown',
		repaired: [],
		label: ''
	};
}

/** Whether this page can hold a voice conversation at all (needs https or localhost). */
export function voiceSupported(): boolean {
	try {
		return window.isSecureContext !== false
			&& typeof navigator.mediaDevices?.getUserMedia === 'function'
			&& typeof (window as any).RTCPeerConnection === 'function';
	} catch {
		return false;
	}
}

export function micErrorCode(error: any): MicErrorCode {
	switch (error?.name) {
		case 'NotAllowedError':
		case 'PermissionDeniedError':
		case 'SecurityError':
			return 'mic-denied';
		case 'NotFoundError':
		case 'DevicesNotFoundError':
		case 'OverconstrainedError':
			return 'mic-missing';
		case 'NotReadableError':
		case 'TrackStartError':
		case 'AbortError':
			return 'mic-busy';
		default:
			return 'mic-error';
	}
}

/**
 * Ask for the microphone before a session (and a token) is created, so a refusal costs nothing.
 * The stream is closed at once; the SDK opens its own.
 */
export async function requestMicPermission(devices: MediaDevices | undefined = navigator.mediaDevices): Promise<void> {
	if (typeof devices?.getUserMedia !== 'function') throw new MicError('mic-unsupported');
	let stream: MediaStream;
	try {
		stream = await devices.getUserMedia({ audio: { ...WANTED } });
	} catch (error) {
		throw new MicError(micErrorCode(error));
	}
	stream.getTracks().forEach(track => track.stop());
}

/**
 * The live microphone track the SDK publishes over WebRTC, or null when it cannot be reached.
 * `connection` is not part of the SDK's public typings (it is `protected`), `getRoom()` is public
 * on its WebRTC connection; if either changes this returns null and the UI says "not confirmed".
 */
export function publishedMicTrack(conversation: unknown): MediaStreamTrack | null {
	try {
		const room = (conversation as any)?.connection?.getRoom?.();
		const publications = room?.localParticipant?.audioTrackPublications;
		if (!publications || typeof publications.values !== 'function') return null;
		for (const publication of Array.from<any>(publications.values())) {
			const track = publication?.track?.mediaStreamTrack;
			if (track && track.kind === 'audio' && track.readyState === 'live') return track as MediaStreamTrack;
		}
	} catch { }
	return null;
}

function supportedConstraints(): MediaTrackSupportedConstraints {
	try {
		return navigator.mediaDevices?.getSupportedConstraints?.() ?? {};
	} catch {
		return {};
	}
}

/** What the track itself reports. */
export function readProcessing(
	track: MediaStreamTrack,
	supported: MediaTrackSupportedConstraints = supportedConstraints()
): MicProcessing {
	let settings: MediaTrackSettings = {};
	try { settings = track.getSettings?.() ?? {}; } catch { }
	const state = (key: ProcessingKey): ProcessingState => {
		if (!(supported as any)[key]) return 'unsupported';
		const value: unknown = (settings as any)[key];
		if (value === undefined || value === null) return 'unknown';
		// echoCancellation may also be "all" / "remote-only" in newer browsers.
		return value === false ? 'off' : 'on';
	};
	return {
		verified: true,
		echoCancellation: state('echoCancellation'),
		noiseSuppression: state('noiseSuppression'),
		autoGainControl: state('autoGainControl'),
		repaired: [],
		label: track.label || ''
	};
}

/**
 * Read the track, and turn on what the browser supports but left off: first all at once, then
 * one by one, so one refused constraint does not cost the others. The answer is always what the
 * track reports afterwards, never what was asked for.
 */
export async function ensureProcessing(
	track: MediaStreamTrack,
	supported: MediaTrackSupportedConstraints = supportedConstraints()
): Promise<MicProcessing> {
	const before = readProcessing(track, supported);
	const off = PROCESSING_KEYS.filter(key => before[key] === 'off');
	if (!off.length || typeof track.applyConstraints !== 'function') return before;

	let current: MediaTrackConstraints = {};
	try { current = track.getConstraints?.() ?? {}; } catch { }
	const apply = async (keys: ProcessingKey[]): Promise<boolean> => {
		const wanted: MediaTrackConstraints = { ...current };
		keys.forEach(key => (wanted as any)[key] = true);
		try {
			await track.applyConstraints(wanted);
			current = wanted;
			return true;
		} catch {
			return false;
		}
	};
	if (!(await apply(off)) && off.length > 1) {
		for (const key of off) await apply([key]);
	}

	const after = readProcessing(track, supported);
	after.repaired = off.filter(key => after[key] === 'on');
	return after;
}

/** Wait for the SDK's track (it is published while connecting), then check it. */
export async function verifyMic(
	conversation: unknown,
	options: { attempts?: number; delayMs?: number; supported?: MediaTrackSupportedConstraints } = {}
): Promise<MicProcessing> {
	const attempts = options.attempts ?? 8;
	const delayMs = options.delayMs ?? 250;
	for (let attempt = 0; attempt < attempts; attempt++) {
		const track = publishedMicTrack(conversation);
		if (track) return ensureProcessing(track, options.supported);
		if (attempt < attempts - 1) await new Promise(resolve => setTimeout(resolve, delayMs));
	}
	return unverifiedProcessing();
}

const NAMES: Record<ProcessingKey, string> = {
	echoCancellation: 'echo cancellation',
	noiseSuppression: 'noise suppression',
	autoGainControl: 'automatic gain control'
};

function list(keys: ProcessingKey[]): string {
	const names = keys.map(key => NAMES[key]);
	return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0] ?? '';
}

function capital(text: string): string {
	return text.charAt(0).toUpperCase() + text.slice(1);
}

/** One line for the voice bar; `ok` is false when the user should know something is missing. */
export function processingSummary(processing: MicProcessing | null): { ok: boolean; text: string } {
	if (!processing) return { ok: true, text: '' };
	if (!processing.verified) {
		return { ok: false, text: 'Couldn\'t confirm this microphone\'s noise processing. Headphones give the best result.' };
	}
	const missing = PROCESSING_KEYS.filter(key => processing[key] === 'off' || processing[key] === 'unsupported');
	const unknown = PROCESSING_KEYS.filter(key => processing[key] === 'unknown');
	const on = PROCESSING_KEYS.filter(key => processing[key] === 'on');
	if (missing.length) {
		const advice = missing.includes('echoCancellation') ? ' Use headphones to avoid echo.' : ' A quiet place helps.';
		const verb = missing.length > 1 ? 'are' : 'is';
		return { ok: false, text: `${capital(list(missing))} ${verb} not available on this microphone.${advice}` };
	}
	if (unknown.length) {
		const text = on.length
			? `${capital(list(on))} on; this browser doesn't report ${list(unknown)}.`
			: `${capital(list(unknown))} requested; this browser doesn't report whether they are on.`;
		return { ok: true, text };
	}
	return { ok: true, text: `${capital(list(on))} on.` };
}
