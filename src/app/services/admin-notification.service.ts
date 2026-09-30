import { Injectable, NgZone } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, Subscription, of, timer } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { SILENT_ERRORS_HEADER } from '../interceptors/http-config.interceptor';

export type AdminNotificationEvent = 'created' | 'updated' | 'cancelled' | 'status_changed' | 'payment';

export interface AdminNotificationChange {
	field: string;
	label: string;
	old: string | null;
	new: string;
}

export interface AdminNotification {
	id: number;
	reservation_id: number;
	event: AdminNotificationEvent;
	actor_id: number | null;
	actor_role: number | null;
	actor_name: string | null;
	source: 'web' | 'app';
	title: string;
	changes: AdminNotificationChange[] | null;
	read_at: string | null;
	created_at: string;
}

export interface AdminNotificationPage {
	data: AdminNotification[];
	current_page: number;
	last_page: number;
	per_page: number;
	total: number;
}

export interface AdminNotificationFilters {
	page?: number;
	per_page?: number;
	event?: string;
	from?: string;
	to?: string;
	search?: string;
	unread?: boolean;
}

const POLL_INTERVAL_MS = 20000;
const SOUND_KEY = 'adminNotifications:sound';
const DESKTOP_KEY = 'adminNotifications:desktop';

/** Background calls must never pop the global error dialog. */
const SILENT = { headers: new HttpHeaders({ [SILENT_ERRORS_HEADER]: '1' }) };

/**
 * Booking-activity notifications for the admin dashboard.
 *
 * Polls the unread count every 20s while the admin layout is open. When a
 * newer notification than the last one seen arrives, it refreshes `recent$`
 * and (if enabled) plays a chime and shows a browser notification.
 */
@Injectable({
	providedIn: 'root'
})
export class AdminNotificationService {
	readonly unreadCount$ = new BehaviorSubject<number>(0);
	readonly recent$ = new BehaviorSubject<AdminNotification[]>([]);

	private serverUrl = environment.serverUrl + 'admin/notifications';
	private pollSub: Subscription | null = null;
	private lastSeenId: number | null = null;
	private audioCtx: AudioContext | null = null;

	constructor(private http: HttpClient, private zone: NgZone) { }

	// ---- API ----

	list(filters: AdminNotificationFilters = {}, silent = false): Observable<AdminNotificationPage> {
		let params = new HttpParams();
		Object.entries(filters).forEach(([key, value]) => {
			if (value !== undefined && value !== null && value !== '' && value !== false) {
				params = params.set(key, value === true ? '1' : String(value));
			}
		});
		return this.http.get<any>(this.serverUrl, { params, ...(silent ? SILENT : {}) }).pipe(map(res => res.data as AdminNotificationPage));
	}

	markRead(id: number): Observable<any> {
		return this.http.post(`${this.serverUrl}/${id}/read`, {}).pipe(
			map(res => {
				this.recent$.next(this.recent$.value.map(n => n.id === id ? { ...n, read_at: n.read_at || new Date().toISOString() } : n));
				this.refreshCount();
				return res;
			})
		);
	}

	markAllRead(): Observable<any> {
		return this.http.post(`${this.serverUrl}/read-all`, {}).pipe(
			map(res => {
				const now = new Date().toISOString();
				this.recent$.next(this.recent$.value.map(n => ({ ...n, read_at: n.read_at || now })));
				this.unreadCount$.next(0);
				return res;
			})
		);
	}

	// ---- Polling ----

	startPolling(): void {
		if (this.pollSub) {
			return;
		}
		this.pollSub = timer(0, POLL_INTERVAL_MS).pipe(
			switchMap(() => this.http.get<any>(`${this.serverUrl}/unread-count`, SILENT).pipe(catchError(() => of(null))))
		).subscribe(res => {
			if (!res?.data) {
				return;
			}
			this.unreadCount$.next(res.data.count || 0);
			const latestId: number = res.data.latest_id || 0;

			if (this.lastSeenId === null) {
				// First poll: load the dropdown, but don't alert for old items.
				this.lastSeenId = latestId;
				this.loadRecent();
			} else if (latestId > this.lastSeenId) {
				const previous = this.lastSeenId;
				this.lastSeenId = latestId;
				this.loadRecent(previous);
			}
		});
	}

	stopPolling(): void {
		this.pollSub?.unsubscribe();
		this.pollSub = null;
		this.lastSeenId = null;
	}

	refreshCount(): void {
		this.http.get<any>(`${this.serverUrl}/unread-count`, SILENT).pipe(catchError(() => of(null))).subscribe(res => {
			if (res?.data) {
				this.unreadCount$.next(res.data.count || 0);
			}
		});
	}

	/** Reloads the latest 10; alerts for any with id > `alertAfterId`. */
	private loadRecent(alertAfterId?: number): void {
		this.list({ per_page: 10 }, true).pipe(catchError(() => of(null))).subscribe(page => {
			if (!page) {
				return;
			}
			this.recent$.next(page.data);
			if (alertAfterId !== undefined) {
				const fresh = page.data.filter(n => n.id > alertAfterId);
				if (fresh.length) {
					this.alert(fresh);
				}
			}
		});
	}

	// ---- Sound + desktop alerts ----

	get soundEnabled(): boolean {
		return this.readSetting(SOUND_KEY, true);
	}

	set soundEnabled(value: boolean) {
		this.writeSetting(SOUND_KEY, value);
	}

	get desktopEnabled(): boolean {
		return this.readSetting(DESKTOP_KEY, false) && this.desktopPermission === 'granted';
	}

	get desktopPermission(): NotificationPermission | 'unsupported' {
		return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
	}

	/** Must be called from a click so the browser shows the permission prompt. */
	async setDesktopEnabled(value: boolean): Promise<boolean> {
		if (!value) {
			this.writeSetting(DESKTOP_KEY, false);
			return false;
		}
		if (this.desktopPermission === 'unsupported') {
			return false;
		}
		const permission = Notification.permission === 'default'
			? await Notification.requestPermission()
			: Notification.permission;
		const granted = permission === 'granted';
		this.writeSetting(DESKTOP_KEY, granted);
		return granted;
	}

	private alert(fresh: AdminNotification[]): void {
		if (this.soundEnabled) {
			this.playChime();
		}
		if (this.desktopEnabled) {
			const newest = fresh[0];
			const body = fresh.length > 1 ? `${newest.title} (+${fresh.length - 1} more)` : newest.title;
			try {
				const n = new Notification('1800LIMO booking activity', { body, tag: 'admin-booking-activity' });
				n.onclick = () => {
					this.zone.run(() => window.focus());
					n.close();
				};
			} catch {
				// Some browsers only allow notifications from a service worker; the badge still updates.
			}
		}
	}

	/** Two short soft tones, generated so no audio asset is needed. */
	private playChime(): void {
		try {
			const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
			if (!Ctx) {
				return;
			}
			this.audioCtx = this.audioCtx || new Ctx();
			const ctx = this.audioCtx!;
			[0, 0.18].forEach((offset, i) => {
				const osc = ctx.createOscillator();
				const gain = ctx.createGain();
				osc.type = 'sine';
				osc.frequency.value = i === 0 ? 880 : 1175;
				const start = ctx.currentTime + offset;
				gain.gain.setValueAtTime(0.0001, start);
				gain.gain.exponentialRampToValueAtTime(0.15, start + 0.02);
				gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
				osc.connect(gain).connect(ctx.destination);
				osc.start(start);
				osc.stop(start + 0.4);
			});
		} catch {
			// Autoplay may be blocked until the admin interacts with the page.
		}
	}

	private readSetting(key: string, fallback: boolean): boolean {
		try {
			const value = localStorage.getItem(key);
			return value === null ? fallback : value === 'true';
		} catch {
			return fallback;
		}
	}

	private writeSetting(key: string, value: boolean): void {
		try {
			localStorage.setItem(key, String(value));
		} catch { }
	}
}
