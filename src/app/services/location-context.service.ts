import { Injectable } from '@angular/core';

declare const google: any;

export interface LatLngLiteral {
	latitude: number;
	longitude: number;
}

export interface NearMeInfo extends LatLngLiteral {
	/** Short label for the "Use current location (...)" row, e.g. "Joliet Rd". */
	label: string;
	formattedAddress: string;
	/** ISO 3166-1 alpha-2, lowercase (e.g. "us"). */
	countryCode: string;
}

/** Bias fields accepted by the Places API (New) `places:autocomplete` request body. */
export interface AutocompleteBias {
	locationBias?: { circle: { center: LatLngLiteral; radius: number } };
	origin?: LatLngLiteral;
	regionCode?: string;
}

const NEAR_ME_STORAGE_KEY = 'qb_near_me_v1';
/** Places API caps circle bias radius at 50 km. */
const BIAS_RADIUS_METERS = 50000;

/**
 * Knows where the user is — but only when the browser has already granted
 * geolocation. It never triggers a permission prompt itself; the prompt only
 * happens when the user explicitly taps "Use current location".
 *
 * When no position is known, callers send no bias and Google falls back to
 * IP-based biasing, which still ranks the user's own country first.
 */
@Injectable({
	providedIn: 'root'
})
export class LocationContextService {
	private position: LatLngLiteral | null = null;
	private positionPromise: Promise<LatLngLiteral | null> | null = null;
	private nearMe: NearMeInfo | null = this.readStoredNearMe();
	private nearMePromise: Promise<NearMeInfo | null> | null = null;

	/** Resolves the current position if permission is already granted; otherwise null. Never prompts. */
	getGrantedPosition(): Promise<LatLngLiteral | null> {
		if (this.position) {
			return Promise.resolve(this.position);
		}

		if (!this.positionPromise) {
			this.positionPromise = this.isPermissionGranted()
				.then((granted) => granted ? this.readPosition() : null)
				.then((position) => {
					if (position) {
						this.position = position;
					} else {
						// Allow a later retry (e.g. permission granted via "Use current location").
						this.positionPromise = null;
					}
					return position;
				});
		}

		return this.positionPromise;
	}

	/** Records a position the app obtained itself (e.g. after the user tapped "Use current location"). */
	rememberPosition(latitude: number, longitude: number): void {
		this.position = { latitude, longitude };
		if (this.nearMe && !this.isSameArea(this.nearMe, this.position)) {
			this.nearMe = null;
		}
	}

	/** Records a reverse-geocode result so the "Near Me" row can show the street without another lookup. */
	rememberGeocodeResult(latitude: number, longitude: number, result: any): void {
		this.rememberPosition(latitude, longitude);
		const info = this.toNearMeInfo(latitude, longitude, result);
		if (info) {
			this.setNearMe(info);
		}
	}

	/** Synchronous snapshot for rendering the "Near Me" row. */
	getNearMeSnapshot(): NearMeInfo | null {
		return this.nearMe;
	}

	/**
	 * Resolves the street label + country for the current position. Only runs when
	 * permission is already granted; reverse-geocodes at most once per area per session.
	 */
	resolveNearMe(): Promise<NearMeInfo | null> {
		if (this.nearMePromise) {
			return this.nearMePromise;
		}

		this.nearMePromise = this.getGrantedPosition()
			.then((position) => {
				if (!position) {
					return null;
				}
				if (this.nearMe && this.isSameArea(this.nearMe, position)) {
					return this.nearMe;
				}
				return this.reverseGeocode(position);
			})
			.finally(() => {
				this.nearMePromise = null;
			});

		return this.nearMePromise;
	}

	/** Bias for Places autocomplete requests. Empty when the location is unknown (Google then uses IP bias). */
	getAutocompleteBias(): AutocompleteBias {
		if (!this.position) {
			return {};
		}

		const center = { ...this.position };
		const bias: AutocompleteBias = {
			locationBias: { circle: { center, radius: BIAS_RADIUS_METERS } },
			origin: center,
		};

		if (this.nearMe?.countryCode) {
			bias.regionCode = this.nearMe.countryCode;
		}

		return bias;
	}

	/** Stable key describing the current bias, used to scope cached autocomplete results. */
	getBiasCacheKey(): string {
		if (!this.position) {
			return 'ip';
		}
		return `${this.position.latitude.toFixed(2)},${this.position.longitude.toFixed(2)}`;
	}

	private async isPermissionGranted(): Promise<boolean> {
		try {
			if (typeof navigator === 'undefined' || !navigator.geolocation || !navigator.permissions?.query) {
				return false;
			}
			const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
			return status.state === 'granted';
		} catch {
			return false;
		}
	}

	private readPosition(): Promise<LatLngLiteral | null> {
		return new Promise((resolve) => {
			navigator.geolocation.getCurrentPosition(
				(pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
				() => resolve(null),
				// Coarse, cached fix is plenty for ranking suggestions.
				{ enableHighAccuracy: false, timeout: 8000, maximumAge: 10 * 60 * 1000 }
			);
		});
	}

	private reverseGeocode(position: LatLngLiteral): Promise<NearMeInfo | null> {
		if (typeof google === 'undefined' || !google?.maps?.Geocoder) {
			return Promise.resolve(null);
		}

		return new Promise((resolve) => {
			new google.maps.Geocoder().geocode(
				{ location: { lat: position.latitude, lng: position.longitude } },
				(results: any[], status: string) => {
					const info = status === 'OK' && results?.[0]
						? this.toNearMeInfo(position.latitude, position.longitude, results[0])
						: null;
					if (info) {
						this.setNearMe(info);
					}
					resolve(info);
				}
			);
		});
	}

	private toNearMeInfo(latitude: number, longitude: number, result: any): NearMeInfo | null {
		const components: any[] = Array.isArray(result?.address_components) ? result.address_components : [];
		const find = (type: string) => components.find((c) => Array.isArray(c?.types) && c.types.includes(type));
		const formattedAddress = String(result?.formatted_address || '').trim();
		const label = find('route')?.short_name
			|| find('locality')?.long_name
			|| formattedAddress.split(',')[0]?.trim()
			|| '';

		if (!formattedAddress) {
			return null;
		}

		return {
			latitude,
			longitude,
			label,
			formattedAddress,
			countryCode: String(find('country')?.short_name || '').toLowerCase(),
		};
	}

	private setNearMe(info: NearMeInfo): void {
		this.nearMe = info;
		try {
			sessionStorage.setItem(NEAR_ME_STORAGE_KEY, JSON.stringify(info));
		} catch {
			// storage unavailable — keep in memory only
		}
	}

	private readStoredNearMe(): NearMeInfo | null {
		try {
			const raw = sessionStorage.getItem(NEAR_ME_STORAGE_KEY);
			return raw ? JSON.parse(raw) : null;
		} catch {
			return null;
		}
	}

	/** ~1 km tolerance so small GPS jitter doesn't trigger another reverse geocode. */
	private isSameArea(a: LatLngLiteral, b: LatLngLiteral): boolean {
		return Math.abs(a.latitude - b.latitude) < 0.01 && Math.abs(a.longitude - b.longitude) < 0.01;
	}
}
