import { AbstractControl, FormArray, FormGroup } from '@angular/forms';
import { Subscription } from 'rxjs';

/**
 * Binds Google's recommended PlaceAutocompleteElement to an existing text input:
 * hides the input (keeps Angular/form bindings), inserts the web component after it,
 * and maps the new Place API result to legacy PlaceResult for existing handlers.
 */
const CLEANUP_KEY = '__gmpPlaceAutocompleteCleanup';
const GMP_ATTACH_SHADOW_PATCHED_KEY = '__gmpAttachShadowPatched';

export interface AttachPlaceAutocompleteOptions {
	types?: string[];
	primaryTypes?: string[];
	airportField?: boolean;
	/** Ignored for fetchFields; new API always loads id, displayName, formattedAddress, location, addressComponents, types, viewport */
	fields?: string[];
	/** When set, keeps the visible gmp widget in sync after patchValue/setValue (e.g. async API load). */
	syncControl?: AbstractControl;
}

type PacHelperMode = 'prompt' | 'loading' | 'empty' | 'hidden';

function isAirportSuggestionText(text: string): boolean {
	const normalized = (text || '').toLowerCase().trim();
	if (!normalized) {
		return false;
	}

	return ['airport', 'terminal', 'fbo', 'airfield', 'aerodrome', 'concourse'].some((keyword) =>
		normalized.includes(keyword)
	);
}

function isAirportCodeSearch(value: string): boolean {
	const normalized = (value || '').trim();
	if (!normalized || normalized !== normalized.toUpperCase()) {
		return false;
	}

	return /^[A-Z]{3,4}$/.test(normalized);
}

function installAirportSuggestionFilter(pac: HTMLElement): () => void {
	let observer: MutationObserver | undefined;

	const applyFilter = () => {
		try {
			const root = (pac as HTMLElement & { shadowRoot?: ShadowRoot | null }).shadowRoot;
			if (!root) {
				return;
			}

			const options = Array.from(root.querySelectorAll('[role="option"], .suggestion-item')) as HTMLElement[];
			options.forEach((option) => {
				const optionText = (option.textContent || '').replace(/\s+/g, ' ').trim();
				const shouldShow = isAirportSuggestionText(optionText);
				option.style.display = shouldShow ? '' : 'none';
				option.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
			});
		} catch {
			/* ignore */
		}
	};

	try {
		const root = (pac as HTMLElement & { shadowRoot?: ShadowRoot | null }).shadowRoot;
		if (root) {
			observer = new MutationObserver(() => applyFilter());
			observer.observe(root, { childList: true, subtree: true, characterData: true });
			applyFilter();
		}
	} catch {
		/* ignore */
	}

	[50, 150, 300, 600].forEach((delay) => setTimeout(() => applyFilter(), delay));

	return () => {
		observer?.disconnect();
		observer = undefined;
	};
}

function setupPlaceAutocompleteHelper(
	pac: HTMLElement,
	nativeInput?: HTMLInputElement,
	syncControl?: AbstractControl
): () => void {
	const isAirportField = pac.getAttribute('data-airport-field') === 'true';
	let helperEl: HTMLDivElement | null = null;
	let emptyTimer: number | null = null;
	let delayedSyncTimers: number[] = [];
	let inputListener: (() => void) | null = null;
	let focusListener: (() => void) | null = null;
	let blurListener: (() => void) | null = null;
	let airportNameAssistTimer: number | null = null;
	let airportNameAssistActive = false;
	let airportCodeAssistTimer: number | null = null;
	let airportCodeAssistActive = false;

	const getRoot = () => (pac as HTMLElement & { shadowRoot?: ShadowRoot | null }).shadowRoot ?? null;

	const getInnerInput = (): HTMLInputElement | null => {
		try {
			const inner = getRoot()?.querySelector?.('input');
			return inner instanceof HTMLInputElement ? inner : null;
		} catch {
			return null;
		}
	};

	const isInputFocused = (inner: HTMLInputElement): boolean => {
		const root = getRoot();
		return document.activeElement === pac || document.activeElement === inner || root?.activeElement === inner;
	};

	const getDialog = (): HTMLElement | null => {
		const root = getRoot();
		if (!root) {
			return null;
		}
		return (root.querySelector('dialog.full-window-autocomplete-dialog[open]') as HTMLElement | null)
			?? (root.querySelector('dialog.full-window-autocomplete-dialog') as HTMLElement | null);
	};

	const ensureHelper = (): HTMLDivElement | null => {
		const root = getRoot();
		if (!root) {
			return null;
		}
		const dialog = getDialog();
		const helperHost = dialog ?? root;
		if (helperEl && root.contains(helperEl)) {
			if (helperEl.parentElement !== helperHost) {
				helperHost.appendChild(helperEl);
			}
			return helperEl;
		}
		helperEl = root.querySelector('.pac-helper-state') as HTMLDivElement | null;
		if (!helperEl) {
			helperEl = document.createElement('div');
			helperEl.className = 'pac-helper-state';
		}
		helperHost.appendChild(helperEl);
		return helperEl;
	};

	const setMode = (mode: PacHelperMode, text = '') => {
		const helper = ensureHelper();
		if (!helper) {
			return;
		}
		if (mode === 'hidden') {
			helper.classList.remove('visible');
			helper.textContent = '';
			helper.setAttribute('data-mode', mode);
			return;
		}
		helper.classList.add('visible');
		helper.textContent = text;
		helper.setAttribute('data-mode', mode);
	};

	const getPredictionCount = (): number => {
		const root = getRoot();
		if (!root) {
			return 0;
		}
		const options = Array.from(root.querySelectorAll('[role="option"], .suggestion-item')) as HTMLElement[];
		return options.filter((option) => {
			const style = window.getComputedStyle(option);
			return style.display !== 'none' && style.visibility !== 'hidden' && option.getAttribute('aria-hidden') !== 'true';
		}).length;
	};

	const clearEmptyTimer = () => {
		if (emptyTimer !== null) {
			window.clearTimeout(emptyTimer);
			emptyTimer = null;
		}
	};

	const clearDelayedSyncTimers = () => {
		delayedSyncTimers.forEach((timer) => window.clearTimeout(timer));
		delayedSyncTimers = [];
	};

	const clearAirportNameAssistTimer = () => {
		if (airportNameAssistTimer !== null) {
			window.clearTimeout(airportNameAssistTimer);
			airportNameAssistTimer = null;
		}
	};

	const clearAirportCodeAssistTimer = () => {
		if (airportCodeAssistTimer !== null) {
			window.clearTimeout(airportCodeAssistTimer);
			airportCodeAssistTimer = null;
		}
	};

	const hasVisibleTerminalPrediction = (): boolean => {
		const root = getRoot();
		if (!root) {
			return false;
		}
		const options = Array.from(root.querySelectorAll('[role="option"], .suggestion-item')) as HTMLElement[];
		return options.some((option) => {
			const style = window.getComputedStyle(option);
			if (
				style.display === 'none'
				|| style.visibility === 'hidden'
				|| option.getAttribute('aria-hidden') === 'true'
			) {
				return false;
			}
			const optionText = (option.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
			return ['terminal', 'concourse', 'fbo'].some((keyword) => optionText.includes(keyword));
		});
	};

	const hasVisibleAirportPrediction = (): boolean => {
		const root = getRoot();
		if (!root) {
			return false;
		}
		const options = Array.from(root.querySelectorAll('[role="option"], .suggestion-item')) as HTMLElement[];
		return options.some((option) => {
			const style = window.getComputedStyle(option);
			if (
				style.display === 'none'
				|| style.visibility === 'hidden'
				|| option.getAttribute('aria-hidden') === 'true'
			) {
				return false;
			}
			const optionText = (option.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
			if (!optionText.includes('airport')) {
				return false;
			}
			return !['terminal', 'concourse', 'fbo'].some((keyword) => optionText.includes(keyword));
		});
	};

	const syncDraftToField = (value: string) => {
		if (!nativeInput) {
			return;
		}
		nativeInput.value = value;
		if (syncControl && syncControl.value !== value) {
			syncControl.setValue(value, { emitEvent: false } as never);
			syncControl.updateValueAndValidity({ emitEvent: false });
		}
	};

	const maybeAssistAirportCodeSearch = (inner: HTMLInputElement) => {
		if (!isAirportField || airportCodeAssistActive) {
			return;
		}

		const rawValue = inner.value || '';
		const trimmedValue = rawValue.trim();
		const isCodeSearch = isAirportCodeSearch(trimmedValue);
		if (!isCodeSearch || rawValue.endsWith(' ')) {
			return;
		}
		const predictionCount = getPredictionCount();
		if (predictionCount > 0 && hasVisibleTerminalPrediction()) {
			return;
		}

		clearAirportCodeAssistTimer();
		airportCodeAssistTimer = window.setTimeout(() => {
			airportCodeAssistTimer = null;
			if (!isInputFocused(inner)) {
				return;
			}

			const latestValue = (inner.value || '').trim();
			if (!isAirportCodeSearch(latestValue)) {
				return;
			}
			const latestPredictionCount = getPredictionCount();
			if (latestPredictionCount > 0 && hasVisibleTerminalPrediction()) {
				return;
			}

			airportCodeAssistActive = true;
			try {
				inner.value = `${latestValue} `;
				inner.dispatchEvent(new Event('input', { bubbles: true }));
				inner.dispatchEvent(new Event('change', { bubbles: true }));
				syncDraftToField(latestValue);
				inner.value = latestValue;
				inner.setSelectionRange(latestValue.length, latestValue.length);
				inner.scrollLeft = 0;
				window.setTimeout(() => {
					inner.setSelectionRange(latestValue.length, latestValue.length);
					inner.scrollLeft = 0;
					airportCodeAssistActive = false;
					syncState();
				}, 120);
			} catch {
				airportCodeAssistActive = false;
			}
		}, 120);
	};

	const maybeAssistAirportNameSearch = (inner: HTMLInputElement) => {
		if (!isAirportField || airportNameAssistActive) {
			return;
		}

		const rawValue = inner.value || '';
		const trimmedValue = rawValue.trim();
		const isCodeSearch = isAirportCodeSearch(trimmedValue);
		const hasTerminalKeyword = /(terminal|concourse|fbo)\b/i.test(trimmedValue);
		const isAirportNameSearch = !isCodeSearch && trimmedValue.length >= 4 && !hasTerminalKeyword;

		if (!isAirportNameSearch) {
			return;
		}

		const predictionCount = getPredictionCount();
		if (predictionCount === 0 || hasVisibleAirportPrediction()) {
			return;
		}

		clearAirportNameAssistTimer();
		airportNameAssistTimer = window.setTimeout(() => {
			airportNameAssistTimer = null;
			if (!isInputFocused(inner)) {
				return;
			}

			const latestValue = (inner.value || '').trim();
			const latestIsCodeSearch = isAirportCodeSearch(latestValue);
			const latestHasTerminalKeyword = /(terminal|concourse|fbo)\b/i.test(latestValue);
			const latestIsAirportNameSearch = !latestIsCodeSearch && latestValue.length >= 4 && !latestHasTerminalKeyword;
			if (!latestIsAirportNameSearch || getPredictionCount() === 0 || hasVisibleAirportPrediction()) {
				return;
			}

			airportNameAssistActive = true;
			try {
				const expandedValue = `${latestValue} airport`;
				inner.value = expandedValue;
				inner.dispatchEvent(new Event('input', { bubbles: true }));
				inner.dispatchEvent(new Event('change', { bubbles: true }));
				syncDraftToField(latestValue);
				inner.value = latestValue;
				inner.setSelectionRange(latestValue.length, latestValue.length);
				inner.scrollLeft = 0;
				window.setTimeout(() => {
					inner.setSelectionRange(latestValue.length, latestValue.length);
					inner.scrollLeft = 0;
					airportNameAssistActive = false;
					syncState();
				}, 150);
			} catch {
				airportNameAssistActive = false;
			}
		}, 450);
	};

	const syncState = () => {
		const inner = getInnerInput();
		if (!inner) {
			return;
		}
		const value = inner.value.trim();
		const hasPredictions = getPredictionCount() > 0;
		const focused = isInputFocused(inner);

		if (!focused) {
			clearEmptyTimer();
			setMode('hidden');
			return;
		}
		if (!value) {
			clearEmptyTimer();
			setMode('prompt', isAirportField ? 'Search airport or terminal' : 'Search address');
			return;
		}
		if (hasPredictions) {
			clearEmptyTimer();
			setMode('hidden');
			return;
		}

		setMode('loading', isAirportField ? 'Loading airports...' : 'Loading addresses...');
		clearEmptyTimer();
		emptyTimer = window.setTimeout(() => {
			emptyTimer = null;
			const currentInput = getInnerInput();
			if (currentInput && isInputFocused(currentInput) && currentInput.value.trim() && getPredictionCount() === 0) {
				setMode('empty', 'No results found');
			}
		}, 700);
	};

	const attach = (retries = 20) => {
		const root = getRoot();
		const inner = getInnerInput();
		if (!root || !inner) {
			if (retries > 0) {
				window.setTimeout(() => attach(retries - 1), 100);
			}
			return;
		}

		ensureHelper();
		inputListener = () => {
			const currentValue = inner.value || '';
			if (isMobileAirportDialogOpen(pac)) {
				applyMobileAirportPopupInputAlignment(pac, inner);
			} else {
				applyClosedAirportFieldAlignment(pac, inner);
			}
			syncDraftToField(currentValue);
			clearEmptyTimer();
			clearDelayedSyncTimers();
			clearAirportCodeAssistTimer();
			clearAirportNameAssistTimer();
			syncState();
			maybeAssistAirportCodeSearch(inner);
			maybeAssistAirportNameSearch(inner);
			delayedSyncTimers = [250, 700, 1200].map((delay) =>
				window.setTimeout(() => syncState(), delay)
			);
		};
		focusListener = () => {
			const currentValue = inner.value || '';
			if (isMobileAirportDialogOpen(pac)) {
				applyMobileAirportPopupInputAlignment(pac, inner);
			} else {
				applyClosedAirportFieldAlignment(pac, inner);
			}
			if (currentValue) {
				syncDraftToField(currentValue);
			}
			syncState();
		};
		blurListener = () => window.setTimeout(() => syncState(), 0);

		inner.addEventListener('input', inputListener);
		inner.addEventListener('focus', focusListener);
		inner.addEventListener('blur', blurListener);
		syncState();
	};

	attach();

	return () => {
		clearEmptyTimer();
		clearDelayedSyncTimers();
		clearAirportCodeAssistTimer();
		clearAirportNameAssistTimer();
		const inner = getInnerInput();
		if (inner && inputListener) inner.removeEventListener('input', inputListener);
		if (inner && focusListener) inner.removeEventListener('focus', focusListener);
		if (inner && blurListener) inner.removeEventListener('blur', blurListener);
		helperEl?.remove();
	};
}

function toLatLngBounds(
	viewport: google.maps.LatLngBounds | google.maps.LatLngBoundsLiteral
): google.maps.LatLngBounds {
	return typeof (viewport as google.maps.LatLngBounds).getNorthEast === 'function'
		? (viewport as google.maps.LatLngBounds)
		: new google.maps.LatLngBounds(viewport as google.maps.LatLngBoundsLiteral);
}

function newPlaceToLegacyPlaceResult(place: {
	id?: string;
	displayName?: string;
	formattedAddress?: string;
	location?: google.maps.LatLng | google.maps.LatLngLiteral | null;
	addressComponents?: Array<{ longText: string; shortText: string; types: string[] }>;
	types?: string[];
	viewport?: google.maps.LatLngBounds | google.maps.LatLngBoundsLiteral | null;
}): google.maps.places.PlaceResult {
	let latLng: google.maps.LatLng | undefined;
	let latitude: number | undefined;
	let longitude: number | undefined;
	const loc = place.location;
	if (loc) {
		if (typeof (loc as google.maps.LatLng).lat === 'function') {
			latLng = loc as google.maps.LatLng;
			latitude = latLng.lat();
			longitude = latLng.lng();
		} else {
			const l = loc as google.maps.LatLngLiteral;
			latLng = new google.maps.LatLng(l.lat, l.lng);
			latitude = l.lat;
			longitude = l.lng;
		}
	}
	const address_components = (place.addressComponents || []).map((c) => ({
		long_name: c.longText,
		short_name: c.shortText,
		types: c.types,
	}));
	return {
		formatted_address: place.formattedAddress,
		name: place.displayName,
		geometry: latLng
			? (place.viewport ? { location: latLng, viewport: toLatLngBounds(place.viewport) } : { location: latLng })
			: undefined,
		address_components,
		place_id: place.id,
		types: place.types,
		location: latLng,
		latitude,
		longitude,
		lat: latitude,
		lng: longitude,
	} as google.maps.places.PlaceResult;
}

/**
 * Injects a one-time global <style> tag that suppresses the GMP focus ring
 * via CSS custom properties (these DO pierce closed shadow roots).
 */
function injectGmpFocusRingSuppressor(): void {
	const STYLE_ID = '__gmp-focus-ring-suppressor';
	if (document.getElementById(STYLE_ID)) {
		return; // Already injected
	}
	const style = document.createElement('style');
	style.id = STYLE_ID;
	style.textContent = `
		gmp-place-autocomplete {
			/* Suppress GMP's internal blue focus ring via its own CSS custom properties.
			   CSS custom properties DO pierce closed shadow roots unlike selectors. */
			--gmp-color-stroke-input-focus: transparent;
			--gmp-focus-ring-color: transparent;

			/* Suppress any host-level outline/border */
			outline: none !important;
			box-shadow: none !important;
		}

		gmp-place-autocomplete:focus,
		gmp-place-autocomplete:focus-within,
		gmp-place-autocomplete:focus-visible {
			outline: none !important;
			box-shadow: none !important;
			border-color: transparent !important;
		}

		html[data-mobile-place-dialog-open="true"],
		body[data-mobile-place-dialog-open="true"] {
			overflow: hidden !important;
			overscroll-behavior: none !important;
			touch-action: none !important;
		}
	`;
	document.head.appendChild(style);
}

/**
 * Optional GMP Shadow DOM patch:
 * forces gmp-place-autocomplete shadow root to open and injects custom styles.
 * This is intentionally guarded and applied once.
 */
function installGmpAttachShadowPatch(): void {
	if (typeof window === 'undefined' || typeof Element === 'undefined') {
		return;
	}
	const w = window as typeof window & { [GMP_ATTACH_SHADOW_PATCHED_KEY]?: boolean };
	if (w[GMP_ATTACH_SHADOW_PATCHED_KEY]) {
		return;
	}

	const originalAttachShadow = Element.prototype.attachShadow;

	Element.prototype.attachShadow = function (init: ShadowRootInit): ShadowRoot {
	if (this.localName === 'gmp-place-autocomplete') {
		const shadow = originalAttachShadow.call(this, { ...init, mode: 'open' });

		const style = document.createElement('style');
			style.textContent = `
			.widget-container { border: none !important; }
			.input-container {
				padding: 0 !important;
				color: #000 !important;
			}
			input{padding-right:18px !important;},
			[role="option"],
			.suggestion-item,
			.text-content,
			.primary-text,
			.secondary-text,
			.place-name,
			.place-address {
				text-align: left !important;
				color: #000 !important;
			}
			[role="listbox"],
			.suggestions-container,
			.suggestion-list,
			.list-container {
				background: #fff !important;
				color: #000 !important;
			}
			[role="option"] {
				border-bottom: 1px solid rgba(0,0,0,0.12) !important;
			}
			.pac-helper-state {
				display: none;
				position: absolute;
				top: 60px;
				left: 0;
				right: 0;
				z-index: 12;
				align-items: flex-start;
				gap: 10px;
				min-height: 58px;
				padding: 16px 18px 18px 20px;
				background: #fff !important;
				color: #6b7280 !important;
				font-size: 16px;
				line-height: 1.4;
				font-weight: 600;
				border-top: 1px solid rgba(0,0,0,0.08);
				pointer-events: none;
				box-sizing: border-box !important;
				white-space: normal !important;
				word-break: break-word !important;
			}
			.pac-helper-state.visible {
				display: flex;
			}
			.pac-helper-state::before {
				content: "⌕";
				font-size: 17px;
				line-height: 1.1;
				color: #9ca3af !important;
				flex: 0 0 auto;
				margin-top: 2px;
			}
			.pac-helper-state[data-mode="loading"]::before {
				content: "↻";
				animation: pac-helper-spin 0.9s linear infinite;
			}
			.pac-helper-state[data-mode="empty"]::before {
				content: "!";
				color: #ef4444 !important;
				font-weight: 700;
			}
			@keyframes pac-helper-spin {
				from { transform: rotate(0deg); }
				to { transform: rotate(360deg); }
			}
			[role="option"][aria-selected="true"],
			[role="option"]:hover,
			[role="option"]:focus,
			[role="option"]:focus-visible,
			.suggestion-item:hover,
			.suggestion-item:focus,
			.suggestion-item:focus-visible {
				background: #f3f4f6 !important;
				color: #000 !important;
			}
			svg,
			.location-icon,
			.leading-icon,
			.icon,
			[aria-hidden="true"] {
				color: #000 !important;
				fill: #000 !important;
				stroke: #000 !important;
				opacity: 1 !important;
				font-weight: 700 !important;
			}
			.place-autocomplete-element-row .place-autocomplete-element-prediction-item-icon {
				padding: 6px !important;
				position: relative !important;
				width: 30px !important;
				height: 30px !important;
				background-color: transparent !important;
				background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none'%3E%3Cpath d='M12 21.25c-.27 0-.53-.11-.72-.31-.86-.9-6.03-6.36-6.03-11.02C5.25 5.82 8.28 3 12 3s6.75 2.82 6.75 6.92c0 4.66-5.17 10.12-6.03 11.02-.19.2-.45.31-.72.31Z' stroke='%23000' stroke-width='1.9' stroke-linecap='round' stroke-linejoin='round'/%3E%3Ccircle cx='12' cy='9.92' r='2.65' stroke='%23000' stroke-width='1.9'/%3E%3C/svg%3E") !important;
				background-repeat: no-repeat !important;
				background-position: center !important;
				background-size: 0 !important;
				border-radius: 0 !important;
			}
			.place-autocomplete-element-row .place-autocomplete-element-prediction-item-icon svg,
			.place-autocomplete-element-row .place-autocomplete-element-prediction-item-icon [aria-hidden="true"] {
				opacity: 0 !important;
			}
			.place-autocomplete-element-row .place-autocomplete-element-prediction-item-icon svg,
			.location-icon svg,
			.leading-icon svg,
			.icon svg {
				display: block !important;
				width: 18px !important;
				height: 18px !important;
				overflow: visible !important;
				transform: translateZ(0) !important;
				-webkit-transform: translateZ(0) !important;
			}
			.place-autocomplete-element-row .place-autocomplete-element-prediction-item-icon path,
			.location-icon path,
			.leading-icon path,
			.icon path {
				fill: #000 !important;
				stroke: #000 !important;
				opacity: 1 !important;
			}
			.place-autocomplete-element-row .place-autocomplete-element-text-div{text-align:left !important;}
			input::placeholder,
			.input-container input::placeholder {
				color: #6b7280 !important;
				opacity: 1 !important;
			}
			.focus-ring { display: none !important; }
			button[aria-label*="Clear"],
			button[title*="Clear"],
			.clear-button,
			.clear-icon {
				display: none !important;
			}

		:host {
			display: block;
			min-height: 45px;
			position: relative;
			color: #000 !important;
		}

		:host([data-airport-field="true"]) .input-container {
			position: relative !important;
			overflow: hidden !important;
		}
		:host([data-airport-field="true"]) .input-container::before {
			content: "" !important;
			position: absolute !important;
			left: 10px !important;
			top: 50% !important;
			transform: translateY(-50%) !important;
			width: 30px !important;
			height: 30px !important;
			background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none'%3E%3Cpath d='M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9L2 14v2l8-2.5V19l-2 1.5V22l4-1 4 1v-1.5L14 19v-5.5L21 16Z' fill='%234a4a4a'/%3E%3C/svg%3E") !important;
			background-repeat: no-repeat !important;
			background-position: center !important;
			background-size: 18px 18px !important;
			background-color: #fff !important;
			border-radius: 999px !important;
			pointer-events: none !important;
			z-index: 8 !important;
		}
		:host([data-airport-field="true"]) .input-container > :not(input):not(button) {
			opacity: 0 !important;
			width: 0 !important;
			min-width: 0 !important;
			max-width: 0 !important;
			margin: 0 !important;
			padding: 0 !important;
			overflow: hidden !important;
			pointer-events: none !important;
			flex: 0 0 0 !important;
		}
		:host([data-airport-field="true"]) .input-container input {
			padding-left: 52px !important;
			padding-inline-start: 52px !important;
			position: relative !important;
			z-index: 1 !important;
			text-indent: 0 !important;
			text-align: left !important;
			direction: ltr !important;
		}

		:host *,
		:host input,
		:host button,
		:host [role="option"] {
			color: #000 !important;
		}

		/* 🔥 MAIN FIX: override full screen dialog */
		dialog.full-window-autocomplete-dialog[open] {
			position: fixed !important;
			inset: unset !important;
			top: var(--dialog-top, 100px) !important;
			left: var(--dialog-left, 0px) !important;
			width: var(--dialog-width, 100%) !important;
			max-height: 250px !important;
			border-radius: 5px !important;
			overflow-y: auto !important;
			box-shadow: 0 6px 16px rgba(0,0,0,0.2) !important;
			margin: 0 !important;
			transform: none !important;
			background: #fff !important;
			color: #000 !important;
		}
		dialog.full-window-autocomplete-dialog[open] * {
			background: transparent !important;
			color: #000 !important;
		}
		dialog.full-window-autocomplete-dialog[open] [role="listbox"],
		dialog.full-window-autocomplete-dialog[open] [role="option"],
		dialog.full-window-autocomplete-dialog[open] .suggestion-item,
		dialog.full-window-autocomplete-dialog[open] .text-content {
			background: #fff !important;
			color: #000 !important;
		}
			@media (max-width: 767px) {
				dialog.full-window-autocomplete-dialog[open] .input-container {
					display: flex !important;
					align-items: center !important;
					justify-content: flex-start !important;
					gap: 0 !important;
					padding-left: 0 !important;
					padding-right: 0 !important;
					text-align: left !important;
				}
				:host([data-airport-field="true"]) dialog.full-window-autocomplete-dialog[open] .input-container::before {
					display: none !important;
				}
				:host([data-airport-field="true"]) dialog.full-window-autocomplete-dialog[open] .input-container > :not(input):not(button) {
					opacity: 0 !important;
					width: 0 !important;
					min-width: 0 !important;
					max-width: 0 !important;
					margin: 0 !important;
					padding: 0 !important;
					overflow: hidden !important;
					pointer-events: none !important;
					flex: 0 0 0 !important;
				}
				:host([data-airport-field="true"]) dialog.full-window-autocomplete-dialog[open] .input-container input {
					flex: 1 1 auto !important;
					min-width: 0 !important;
					margin-left: 0 !important;
					padding-left: 0 !important;
					padding-right: 42px !important;
					text-indent: 0 !important;
					text-align: left !important;
				}
				dialog.full-window-autocomplete-dialog[open] .pac-helper-state {
					top: 86px !important;
					left: 10px !important;
					right: 10px !important;
					padding: 14px 16px 16px 18px !important;
					font-size: 16px !important;
					line-height: 1.45 !important;
					border-top: none !important;
					border-radius: 0 0 12px 12px !important;
					box-shadow: 0 8px 18px rgba(0, 0, 0, 0.1) !important;
				}
				dialog.full-window-autocomplete-dialog[open] .text-content,
				dialog.full-window-autocomplete-dialog[open] .primary-text,
				dialog.full-window-autocomplete-dialog[open] .secondary-text,
				dialog.full-window-autocomplete-dialog[open] .place-name,
			dialog.full-window-autocomplete-dialog[open] .place-address {
				width: 100% !important;
				text-align: left !important;
			}
		}
		`;

		shadow.appendChild(style);
		return shadow;
	}

	return originalAttachShadow.call(this, init);
	};

	w[GMP_ATTACH_SHADOW_PATCHED_KEY] = true;
}

function restoreMobileAutocompleteFocus(pac: HTMLElement): void {
	if (typeof window === 'undefined' || !window.matchMedia('(max-width: 767px)').matches) {
		return;
	}

	const focusInnerInput = (retries = 10) => {
		try {
			const root = (pac as HTMLElement & { shadowRoot?: ShadowRoot | null }).shadowRoot;
			const inner = root?.querySelector?.('input');
			if (inner instanceof HTMLInputElement) {
				const resetToStart = () => {
					applyMobileAirportPopupInputAlignment(pac, inner);
					inner.focus({ preventScroll: true });
					const end = inner.value?.length ?? 0;
					inner.setSelectionRange(end, end);
					inner.scrollLeft = 0;
				};
				resetToStart();
				requestAnimationFrame(resetToStart);
			} else if (retries > 0) {
				setTimeout(() => focusInnerInput(retries - 1), 50);
			}
		} catch {
			if (retries > 0) {
				setTimeout(() => focusInnerInput(retries - 1), 50);
			}
		}
	};

	setTimeout(() => focusInnerInput(), 0);
}

function isMobileAirportDialogOpen(pac: Element): boolean {
	if (typeof window === 'undefined' || !window.matchMedia('(max-width: 767px)').matches) {
		return false;
	}
	if ((pac as HTMLElement).getAttribute('data-airport-field') !== 'true') {
		return false;
	}

	try {
		const root = (pac as HTMLElement & { shadowRoot?: ShadowRoot | null }).shadowRoot;
		return Boolean(root?.querySelector?.('dialog.full-window-autocomplete-dialog[open]'));
	} catch {
		return false;
	}
}

function shouldPreserveInputViewport(
	pac: Element,
	inner: HTMLInputElement,
	root?: ShadowRoot | null
): boolean {
	return document.activeElement === pac || document.activeElement === inner || root?.activeElement === inner;
}

function applyMobileAirportPopupInputAlignment(
	pac: Element,
	innerInput?: HTMLInputElement | null
): void {
	if (!isMobileAirportDialogOpen(pac)) {
		return;
	}

	try {
		const root = (pac as HTMLElement & { shadowRoot?: ShadowRoot | null }).shadowRoot;
		const inner = innerInput ?? (root?.querySelector?.('input') instanceof HTMLInputElement
			? root.querySelector('input') as HTMLInputElement
			: null);
		if (!(inner instanceof HTMLInputElement)) {
			return;
		}
		const preserveViewport = shouldPreserveInputViewport(pac, inner, root);

		inner.style.setProperty('text-align', 'left', 'important');
		inner.style.setProperty('text-indent', '0', 'important');
		inner.style.setProperty('padding-left', '0', 'important');
		inner.style.setProperty('padding-right', '42px', 'important');
		inner.style.setProperty('margin', '0', 'important');
		inner.style.setProperty('width', '100%', 'important');
		inner.style.setProperty('box-sizing', 'border-box', 'important');
		inner.style.setProperty('justify-content', 'flex-start', 'important');
		if (!preserveViewport) {
			inner.scrollLeft = 0;
		}
	} catch {
		/* ignore */
	}
}

function applyClosedAirportFieldAlignment(
	pac: Element,
	innerInput?: HTMLInputElement | null
): void {
	if ((pac as HTMLElement).getAttribute('data-airport-field') !== 'true') {
		return;
	}
	if (isMobileAirportDialogOpen(pac)) {
		return;
	}

	try {
		const root = (pac as HTMLElement & { shadowRoot?: ShadowRoot | null }).shadowRoot;
		const inner = innerInput ?? (root?.querySelector?.('input') instanceof HTMLInputElement
			? root.querySelector('input') as HTMLInputElement
			: null);
		if (!(inner instanceof HTMLInputElement)) {
			return;
		}
		inner.style.setProperty('text-align', 'left', 'important');
		inner.style.setProperty('text-indent', '0', 'important');
		inner.style.setProperty('padding-left', '52px', 'important');
		inner.style.setProperty('padding-inline-start', '52px', 'important');
		inner.style.setProperty('padding-right', '42px', 'important');
		inner.style.setProperty('margin', '0', 'important');
		inner.style.setProperty('width', '100%', 'important');
		inner.style.setProperty('box-sizing', 'border-box', 'important');
		inner.style.setProperty('direction', 'ltr', 'important');
		inner.style.setProperty('justify-content', 'flex-start', 'important');
		inner.scrollLeft = 0;
	} catch {
		/* ignore */
	}
}

function syncPlaceAutocompleteElementValue(
	pac: Element,
	value: string,
	retries = 20
): void {
	const normalizedValue = value || '';
	const el = pac as HTMLElement & { value?: string };

	try {
		el.value = normalizedValue;
	} catch {
		/* ignore */
	}

	try {
		(pac as HTMLElement).setAttribute('value', normalizedValue);
	} catch {
		/* ignore */
	}

	try {
		const root = (pac as HTMLElement & { shadowRoot?: ShadowRoot | null }).shadowRoot;
		const inner = root?.querySelector?.('input');
		if (inner instanceof HTMLInputElement) {
			const isFocused = shouldPreserveInputViewport(pac, inner, root);
			if (isMobileAirportDialogOpen(pac)) {
				applyMobileAirportPopupInputAlignment(pac, inner);
			} else {
				applyClosedAirportFieldAlignment(pac, inner);
			}
			if (!isFocused && inner.value !== normalizedValue) {
				inner.value = normalizedValue;
			}
			if (!isFocused) {
				inner.scrollLeft = 0;
			}
		} else if (retries > 0) {
			setTimeout(() => syncPlaceAutocompleteElementValue(pac, normalizedValue, retries - 1), 75);
		}
	} catch {
		if (retries > 0) {
			setTimeout(() => syncPlaceAutocompleteElementValue(pac, normalizedValue, retries - 1), 75);
		}
	}
}

export async function attachPlaceAutocompleteElement(
	nativeInput: HTMLInputElement,
	_options: AttachPlaceAutocompleteOptions | undefined,
	onPlaceSelect: (place: google.maps.places.PlaceResult) => void
): Promise<void> {
	installGmpAttachShadowPatch();
	const prev = (nativeInput as unknown as Record<string, unknown>)[CLEANUP_KEY];
	if (typeof prev === 'function') {
		(prev as () => void)();
	}

	const gmaps = google.maps as unknown as {
		importLibrary?: (name: string) => Promise<Record<string, unknown>>;
	};

	let PlaceAutocompleteElement: (new () => HTMLElement) | undefined;

	if (gmaps.importLibrary) {
		const placesLib = await gmaps.importLibrary('places');
		PlaceAutocompleteElement = placesLib['PlaceAutocompleteElement'] as new () => HTMLElement;
	} else {
		PlaceAutocompleteElement = (
			google.maps.places as unknown as {
				PlaceAutocompleteElement?: new () => HTMLElement;
			}
		).PlaceAutocompleteElement;
	}

	if (!PlaceAutocompleteElement) {
		console.error(
			'PlaceAutocompleteElement is not available. Use a current Maps JavaScript API build with importLibrary("places").'
		);
		return;
	}

	// Inject global CSS suppressor once (no-op if already done)
	injectGmpFocusRingSuppressor();

	const pac = new PlaceAutocompleteElement();
	const pacAny = pac as HTMLElement & {
		includedPrimaryTypes?: string[];
		includedTypes?: string[];
	};
	pac.id = nativeInput.id;
	pac.className = nativeInput.className;
	const styleAttr = nativeInput.getAttribute('style');
	if (styleAttr) {
		pac.setAttribute('style', styleAttr);
	}
	const ph = nativeInput.getAttribute('placeholder');
	if (ph) {
		pac.setAttribute('placeholder', ph);
	}
	pac.setAttribute('tabindex', String(nativeInput.tabIndex));

	const isAirportField = Boolean(_options?.airportField || _options?.primaryTypes?.includes('airport'));
	if (isAirportField) {
		// Do not hard-restrict Google predictions to the "airport" primary type.
		// Terminal results like "ORD Terminal 3" can come back under other place types,
		// so we allow the broader result set and filter visible suggestions ourselves.
		if (_options?.types?.length) {
			pacAny.includedTypes = [..._options.types];
		}
	} else if (_options?.primaryTypes?.length) {
		pacAny.includedPrimaryTypes = [..._options.primaryTypes];
	} else if (_options?.types?.length) {
		pacAny.includedTypes = [..._options.types];
	}

	if (isAirportField) {
		pac.setAttribute('data-airport-field', 'true');
	}

	const prevDisplay = nativeInput.style.display;
	const prevPosition = nativeInput.style.position;
	const prevWidth = nativeInput.style.width;
	const prevHeight = nativeInput.style.height;
	const prevOpacity = nativeInput.style.opacity;
	const prevPointer = nativeInput.style.pointerEvents;

	nativeInput.style.display = 'none';
	nativeInput.style.position = 'absolute';
	nativeInput.style.width = '0';
	nativeInput.style.height = '0';
	nativeInput.style.opacity = '0';
	nativeInput.style.pointerEvents = 'none';

	nativeInput.after(pac);

	const cleanupHelper = setupPlaceAutocompleteHelper(pac, nativeInput, _options?.syncControl);
	const cleanupAirportSuggestionFilter = isAirportField ? installAirportSuggestionFilter(pac) : undefined;
	let outsidePointerListener: ((event: PointerEvent) => void) | undefined;

	const getOpenDialog = (): HTMLDialogElement | null => {
		try {
			const root = (pac as HTMLElement & { shadowRoot?: ShadowRoot | null }).shadowRoot;
			const dialog = root?.querySelector?.('dialog.full-window-autocomplete-dialog[open]');
			return dialog instanceof HTMLDialogElement ? dialog : null;
		} catch {
			return null;
		}
	};

	const closeMobileDialog = () => {
		const dialog = getOpenDialog();
		if (!dialog) {
			return;
		}

		try {
			const root = (pac as HTMLElement & { shadowRoot?: ShadowRoot | null }).shadowRoot;
			const inner = root?.querySelector?.('input');
			if (inner instanceof HTMLInputElement) {
				inner.blur();
			}
		} catch {
			/* ignore */
		}

		try {
			dialog.close();
		} catch {
			dialog.removeAttribute('open');
		}
	};

	const installOutsideTapClose = () => {
		if (outsidePointerListener || typeof document === 'undefined') {
			return;
		}

		outsidePointerListener = (event: PointerEvent) => {
			if (typeof window === 'undefined' || !window.matchMedia('(max-width: 767px)').matches) {
				return;
			}

			const dialog = getOpenDialog();
			if (!dialog) {
				return;
			}

			const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
			if (path.includes(pac) || path.includes(dialog)) {
				return;
			}

			closeMobileDialog();
		};

		document.addEventListener('pointerdown', outsidePointerListener, true);
	};

	const updatePlacement = () => {
		const rect = pac.getBoundingClientRect();
		// Avoid anchoring to negative (offscreen top) if weird scroll bounce occurs, though 
		// fixed positioning handles out of viewport cleanly.
		pac.style.setProperty('--dialog-top', `${rect.top}px`);
		pac.style.setProperty('--dialog-left', `${rect.left}px`);
		pac.style.setProperty('--dialog-width', `${rect.width}px`);
		applyMobileAirportPopupInputAlignment(pac);
	};

	pac.addEventListener('click', updatePlacement);
	pac.addEventListener('focusin', updatePlacement);
	window.addEventListener('resize', updatePlacement);
	window.addEventListener('scroll', updatePlacement, { capture: true, passive: true });
	installOutsideTapClose();

	// Force initial placement calculation slightly after attach
	setTimeout(updatePlacement, 50);

	const handler = async (ev: Event) => {
		const raw = ev as unknown as {
			placePrediction?: { toPlace: () => unknown };
		};
		const placePrediction =
			raw.placePrediction ??
			(ev as unknown as CustomEvent<{ placePrediction?: { toPlace: () => unknown } }>).detail
				?.placePrediction;
		if (!placePrediction) {
			// User cleared the input via the GMP internal 'x' button!
			onPlaceSelect({
				formatted_address: '',
				name: '',
				geometry: undefined,
				address_components: [],
				place_id: '',
				types: []
			} as unknown as google.maps.places.PlaceResult);
			return;
		}
		const place = placePrediction.toPlace() as {
			fetchFields: (o: { fields: string[] }) => Promise<void>;
			id?: string;
			displayName?: string;
			formattedAddress?: string;
			location?: google.maps.LatLng | google.maps.LatLngLiteral | null;
			addressComponents?: Array<{ longText: string; shortText: string; types: string[] }>;
			types?: string[];
			viewport?: google.maps.LatLngBounds | null;
		};
		await place.fetchFields({
			fields: ['id', 'displayName', 'formattedAddress', 'location', 'addressComponents', 'types', 'viewport'],
		});
		onPlaceSelect(newPlaceToLegacyPlaceResult(place));
		restoreMobileAutocompleteFocus(pac);
	};

	pac.addEventListener('gmp-select', handler as EventListener);

	let valueSub: Subscription | undefined;
	if (_options?.syncControl) {
		valueSub = _options.syncControl.valueChanges.subscribe(() => {
			queueMicrotask(() => syncPlaceAutocompleteDisplay(nativeInput));
		});
	}

	const cleanup = () => {
		cleanupHelper();
		cleanupAirportSuggestionFilter?.();
		valueSub?.unsubscribe();
		valueSub = undefined;
		pac.removeEventListener('gmp-select', handler as EventListener);
		pac.removeEventListener('click', updatePlacement);
		pac.removeEventListener('focusin', updatePlacement);
		window.removeEventListener('resize', updatePlacement);
		window.removeEventListener('scroll', updatePlacement, { capture: true } as EventListenerOptions);
		if (outsidePointerListener) {
			document.removeEventListener('pointerdown', outsidePointerListener, true);
			outsidePointerListener = undefined;
		}
		pac.remove();
		nativeInput.style.display = prevDisplay;
		nativeInput.style.position = prevPosition;
		nativeInput.style.width = prevWidth;
		nativeInput.style.height = prevHeight;
		nativeInput.style.opacity = prevOpacity;
		nativeInput.style.pointerEvents = prevPointer;
		delete (nativeInput as unknown as Record<string, unknown>)[CLEANUP_KEY];
	};

	(nativeInput as unknown as Record<string, unknown>)[CLEANUP_KEY] = cleanup;

	/** FormControl writes to the hidden input; the visible web component must be synced. */
	queueMicrotask(() => syncPlaceAutocompleteDisplay(nativeInput));
	queueMicrotask(() => syncRestoredPlaceAutocompleteValue(nativeInput, _options?.syncControl));
	[100, 250, 500, 900].forEach((delay) => {
		setTimeout(() => syncPlaceAutocompleteDisplay(nativeInput), delay);
	});
}

/**
 * Resolves the FormControl tied to a booking address field (pickup, dropoff,
 * loose_customer.address, extra_stops[].address, …)
 * for use as `syncControl` on `attachPlaceAutocompleteElement`.
 */
export function getBookingAddressSyncControl(
	bookingForm: FormGroup,
	control: string,
	index?: number
): AbstractControl | undefined {
	if (control === 'loose_customer') {
		const g = bookingForm.get('loose_customer') as FormGroup | null;
		return g?.get('address') ?? undefined;
	}
	if (control === 'extra_stops' && typeof index === 'number') {
		const arr = bookingForm.get('extra_stops') as FormArray | null;
		return arr?.at(index)?.get('address') ?? undefined;
	}
	if (control === 'return_extra_stops' && typeof index === 'number') {
		const arr = bookingForm.get('return_extra_stops') as FormArray | null;
		return arr?.at(index)?.get('address') ?? undefined;
	}
	return bookingForm.get(control) ?? undefined;
}

/**
 * Mirrors the hidden Angular-bound input value onto the sibling `gmp-place-autocomplete`
 * (and its shadow input when present) after programmatic patchValue/setValue.
 */
export function syncPlaceAutocompleteDisplay(nativeInput: HTMLInputElement): void {
	if (!nativeInput) {
		return;
	}
	const pac = nativeInput.nextElementSibling;
	if (!pac || pac.tagName.toLowerCase() !== 'gmp-place-autocomplete') {
		return;
	}
	const v = nativeInput.value || '';
	syncPlaceAutocompleteElementValue(pac, v);
}

export function clearPlaceAutocompleteDisplay(nativeInput: HTMLInputElement): void {
	if (!nativeInput) {
		return;
	}

	nativeInput.value = '';

	const pac = nativeInput.nextElementSibling;
	if (!pac || pac.tagName.toLowerCase() !== 'gmp-place-autocomplete') {
		return;
	}

	syncPlaceAutocompleteElementValue(pac, '');
}

export function getPlaceAutocompleteDisplayValue(
	nativeInput: HTMLInputElement | null | undefined
): string {
	if (!nativeInput) {
		return '';
	}

	if ((nativeInput.value || '').trim()) {
		return nativeInput.value;
	}

	const pac = nativeInput.nextElementSibling;
	if (!pac || pac.tagName.toLowerCase() !== 'gmp-place-autocomplete') {
		return '';
	}

	try {
		const root = (pac as HTMLElement & { shadowRoot?: ShadowRoot | null }).shadowRoot;
		const inner = root?.querySelector?.('input');
		if (inner instanceof HTMLInputElement) {
			return inner.value || '';
		}
	} catch {
		/* ignore */
	}

	try {
		return ((pac as HTMLElement & { value?: string }).value || '');
	} catch {
		return '';
	}
}

/**
 * If the visible GMP widget restores a value on page load before Angular's hidden input/control
 * knows about it, mirror that value back into the hidden input and optional FormControl.
 */
export function syncRestoredPlaceAutocompleteValue(
	nativeInput: HTMLInputElement,
	syncControl?: AbstractControl
): void {
	if (!nativeInput) {
		return;
	}

	const pac = nativeInput.nextElementSibling;
	if (!pac || pac.tagName.toLowerCase() !== 'gmp-place-autocomplete') {
		return;
	}

	const trySyncFromInner = (retries = 20) => {
		try {
			const root = (pac as HTMLElement & { shadowRoot?: ShadowRoot | null }).shadowRoot;
			const inner = root?.querySelector?.('input');

			if (inner instanceof HTMLInputElement) {
				const visibleValue = inner.value || '';
				if (!visibleValue.trim()) {
					if (retries > 0) {
						setTimeout(() => trySyncFromInner(retries - 1), 100);
					}
					return;
				}

				if (nativeInput.value !== visibleValue) {
					nativeInput.value = visibleValue;
				}

				if (syncControl && syncControl.value !== visibleValue) {
					syncControl.setValue(visibleValue);
					syncControl.updateValueAndValidity();
				}

				syncPlaceAutocompleteElementValue(pac, visibleValue);
			} else if (retries > 0) {
				setTimeout(() => trySyncFromInner(retries - 1), 100);
			}
		} catch {
			if (retries > 0) {
				setTimeout(() => trySyncFromInner(retries - 1), 100);
			}
		}
	};

	trySyncFromInner();
}
