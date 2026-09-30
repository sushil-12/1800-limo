import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface RecentLocationAirport {
	id: string;
	name: string;
	latitude: number;
	longitude: number;
}

export interface RecentLocation {
	/** Full text written into the address field on selection. */
	address: string;
	latitude: number;
	longitude: number;
	/** Set when the location is an airport; replayed through the airport selection flow. */
	airport?: RecentLocationAirport | null;
	/** Epoch ms of last use; newest first. */
	lastUsed: number;
}

const STORAGE_KEY = 'qb_recent_locations_v1';
const MAX_STORED = 10;

/**
 * Recent pickup/dropoff locations for the address dropdown.
 *  - Everyone: selections made on this device (localStorage).
 *  - Logged-in individuals: merged with past booking locations from the API.
 */
@Injectable({
	providedIn: 'root'
})
export class RecentLocationsService {
	private serverUrl = environment.serverUrl;
	private serverRecents: RecentLocation[] = [];
	private serverRecentsUserKey: string | null = null;
	private serverRecentsPromise: Promise<void> | null = null;
	private localRecents: RecentLocation[] | null = null;
	private lastSeenUserKey: string | null = null;
	/** Bumped on every data change; lets getRecent() return stable arrays between changes (cheap for templates). */
	private version = 0;
	private memo: { key: string; result: RecentLocation[] } | null = null;

	constructor(
		private httpClient: HttpClient,
		private authService: AuthService,
	) { }

	/**
	 * Recent locations matching `query` (all of them when empty), newest first,
	 * de-duplicated across device and account history.
	 */
	getRecent(query: string = '', limit: number = 5): RecentLocation[] {
		const normalizedQuery = this.normalize(query);
		const currentUserKey = this.authService.getAccessToken() ? JSON.stringify(this.authService.currentUserValue?.id ?? null) : 'guest';
		if (currentUserKey !== this.lastSeenUserKey) {
			// Login/logout (logout clears localStorage) — drop the in-memory copy.
			this.lastSeenUserKey = currentUserKey;
			this.localRecents = null;
			this.version++;
		}
		const memoKey = `${this.version}|${this.serverRecentsUserKey}|${this.getIndividualUserKey()}|${limit}|${normalizedQuery}`;
		if (this.memo?.key === memoKey) {
			return this.memo.result;
		}

		const merged = [...this.readLocal(), ...this.getServerRecentsForCurrentUser()]
			.sort((a, b) => b.lastUsed - a.lastUsed);

		const seen = new Set<string>();
		const results: RecentLocation[] = [];
		for (const location of merged) {
			const key = this.normalize(location.address);
			if (!key || seen.has(key)) {
				continue;
			}
			seen.add(key);
			if (normalizedQuery && !key.includes(normalizedQuery)) {
				continue;
			}
			results.push(location);
			if (results.length >= limit) {
				break;
			}
		}
		this.memo = { key: memoKey, result: results };
		return results;
	}

	/** Saves a selection on this device (moves it to the top if it already exists). */
	add(location: Omit<RecentLocation, 'lastUsed'>): void {
		const address = String(location?.address || '').trim();
		if (!address || !this.isValidCoordinate(location.latitude) || !this.isValidCoordinate(location.longitude)) {
			return;
		}

		const key = this.normalize(address);
		const entry: RecentLocation = { ...location, address, lastUsed: Date.now() };
		const next = [entry, ...this.readLocal().filter((item) => this.normalize(item.address) !== key)]
			.slice(0, MAX_STORED);
		this.writeLocal(next);
	}

	/** Fetches past booking locations once per logged-in individual user. Safe to call repeatedly. */
	loadServerRecents(): Promise<void> {
		const userKey = this.getIndividualUserKey();
		if (!userKey) {
			return Promise.resolve();
		}
		if (this.serverRecentsUserKey === userKey && this.serverRecentsPromise) {
			return this.serverRecentsPromise;
		}

		this.serverRecentsUserKey = userKey;
		this.serverRecents = [];
		this.version++;
		this.serverRecentsPromise = this.httpClient
			.get<any>(`${this.serverUrl}individual/recent-locations`, { params: { limit: '10' } })
			.toPromise()
			.then((response) => {
				const locations: any[] = Array.isArray(response?.data?.locations) ? response.data.locations : [];
				this.serverRecents = locations
					.map((item) => this.fromServer(item))
					.filter((item): item is RecentLocation => !!item);
				this.version++;
			})
			.catch(() => {
				// Non-critical: fall back to device-only recents; allow a retry later.
				this.serverRecentsPromise = null;
			});

		return this.serverRecentsPromise;
	}

	private getServerRecentsForCurrentUser(): RecentLocation[] {
		const userKey = this.getIndividualUserKey();
		return userKey && userKey === this.serverRecentsUserKey ? this.serverRecents : [];
	}

	private getIndividualUserKey(): string | null {
		const user = this.authService.currentUserValue;
		if (!user || !this.authService.getAccessToken() || user.roleName !== 'individual') {
			return null;
		}
		return String(user.id ?? user.email ?? 'individual');
	}

	private fromServer(item: any): RecentLocation | null {
		const address = String(item?.address || '').trim();
		const latitude = Number(item?.latitude);
		const longitude = Number(item?.longitude);
		if (!address || !this.isValidCoordinate(latitude) || !this.isValidCoordinate(longitude)) {
			return null;
		}

		const lastUsed = Date.parse(item?.last_used);
		return {
			address,
			latitude,
			longitude,
			airport: item?.is_airport && item?.airport_id
				? { id: String(item.airport_id), name: address, latitude, longitude }
				: null,
			lastUsed: Number.isFinite(lastUsed) ? lastUsed : 0,
		};
	}

	private readLocal(): RecentLocation[] {
		if (this.localRecents) {
			return this.localRecents;
		}
		try {
			const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
			this.localRecents = Array.isArray(parsed) ? parsed.filter((item) => !!item?.address) : [];
		} catch {
			this.localRecents = [];
		}
		return this.localRecents;
	}

	private writeLocal(items: RecentLocation[]): void {
		this.localRecents = items;
		this.version++;
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
		} catch {
			// storage full/blocked — recents are best-effort
		}
	}

	private isValidCoordinate(value: any): boolean {
		const numeric = Number(value);
		return value !== '' && value !== null && value !== undefined && Number.isFinite(numeric) && numeric !== 0;
	}

	private normalize(value: string): string {
		return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
	}
}
