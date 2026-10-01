import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Shared text-field validators for account / profile forms.
 *
 * Every validator returns `{ invalidText: '<message>' }` so templates can render
 * `{{ f.<control>.errors?.invalidText }}` (same idea as the existing `invalidIntl` errors).
 * Empty values are always valid here - combine with Validators.required where needed.
 */

// Latin letters incl. accented (Latin-1 Supplement, Latin Extended-A/B, Latin Extended Additional).
// Emoji, CJK, zero-width, "fancy" math letters etc. are rejected.
const L = 'A-Za-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u024F\\u1E00-\\u1EFF';

export const FIELD_MAX_LENGTH = {
	name: 50,
	organization: 100,
	email: 100,
	address: 255,
	country: 60,
	zip: 10,
	iata: 15,
};

const HTML_PATTERN = /<[^>]*>|<\/?[a-z!]|[<>]|javascript\s*:|\bon[a-z]+\s*=|&#|&[a-z]+;/i;
const SQL_PATTERN = /--|\/\*|\*\/|;|\b(select|insert|update|delete|drop|union|alter|exec|truncate)\b[\s\S]*\b(from|into|table|set|where|select)\b|'\s*(or|and)\s+['\d]|\b(or|and)\s+\d+\s*=\s*\d+/i;

interface TextRule {
	max: number;
	allowed: RegExp;
	allowedLabel: string;
	extra?: (value: string) => string | null;
}

const RULES: { [kind: string]: TextRule } = {
	name: {
		max: FIELD_MAX_LENGTH.name,
		allowed: new RegExp(`^[${L}][${L} '.-]*$`),
		allowedLabel: 'letters, spaces, apostrophes (\'), hyphens (-) and periods (.) are allowed',
		extra: (v) => /['-][ '.-]|[ .]['-]|\.\./.test(v) || /[ '-]$/.test(v)
			? 'Please enter a valid name' : null,
	},
	organization: {
		max: FIELD_MAX_LENGTH.organization,
		allowed: new RegExp(`^[${L}0-9][${L}0-9 &'.,()-]*$`),
		allowedLabel: 'letters, numbers, spaces and & \' . , ( ) - are allowed',
		extra: (v) => new RegExp(`[${L}]`).test(v) ? null : 'Must contain at least one letter',
	},
	address: {
		max: FIELD_MAX_LENGTH.address,
		allowed: new RegExp(`^[${L}0-9][${L}0-9 ,.#'/()&+-]*$`),
		allowedLabel: 'letters, numbers, spaces and , . # \' / ( ) & + - are allowed',
	},
	country: {
		max: FIELD_MAX_LENGTH.country,
		allowed: new RegExp(`^[${L}][${L} .'()-]*$`),
		allowedLabel: 'letters, spaces and . \' ( ) - are allowed',
	},
	zip: {
		max: FIELD_MAX_LENGTH.zip,
		allowed: /^[A-Za-z0-9]+(?:[ -][A-Za-z0-9]+)*$/,
		allowedLabel: 'letters and numbers (with a single space or hyphen between groups) are allowed',
	},
	iata: {
		max: FIELD_MAX_LENGTH.iata,
		allowed: /^[A-Za-z0-9]+$/,
		allowedLabel: 'letters and numbers are allowed (no spaces or special characters)',
	},
};

function textValidator(kind: keyof typeof RULES): ValidatorFn {
	const rule = RULES[kind];
	return (control: AbstractControl): ValidationErrors | null => {
		const value = control.value;
		if (value === null || value === undefined || value === '' || typeof value !== 'string') {
			return null;
		}
		const fail = (message: string) => ({ invalidText: message });

		if (value.trim() === '') {
			return fail('This field cannot contain only spaces');
		}
		if (value !== value.trim()) {
			return fail('Leading or trailing spaces are not allowed');
		}
		if (/\s{2,}/.test(value)) {
			return fail('Multiple consecutive spaces are not allowed');
		}
		if (HTML_PATTERN.test(value)) {
			return fail('HTML tags or scripts are not allowed');
		}
		if (SQL_PATTERN.test(value)) {
			return fail('Invalid characters or keywords detected');
		}
		if (value.length > rule.max) {
			return fail(`Maximum ${rule.max} characters allowed`);
		}
		if (!rule.allowed.test(value)) {
			return fail(`Only ${rule.allowedLabel}`);
		}
		const extraError = rule.extra ? rule.extra(value) : null;
		return extraError ? fail(extraError) : null;
	};
}

export const FormValidators = {
	/** First / middle / last name, card holder name */
	name: () => textValidator('name'),
	/** Agency name, payee name */
	organization: () => textValidator('organization'),
	address: () => textValidator('address'),
	country: () => textValidator('country'),
	zip: () => textValidator('zip'),
	iata: () => textValidator('iata'),

	/**
	 * Address must be one picked from the suggestions (or the one loaded from the server).
	 * `getConfirmed` returns that address; typing anything else gives `addressNotSelected`.
	 */
	addressSelected: (getConfirmed: () => string): ValidatorFn => (control: AbstractControl): ValidationErrors | null => {
		const value = String(control.value || '').trim();
		if (!value) {
			return null;
		}
		return value === String(getConfirmed() || '').trim() ? null : { addressNotSelected: true };
	},

	/** Phone / fax: digits with an optional leading + (no negatives, spaces, letters) */
	phone: (): ValidatorFn => (control: AbstractControl): ValidationErrors | null => {
		const value = control.value;
		if (value === null || value === undefined || value === '') {
			return null;
		}
		return /^\+?[0-9]+$/.test(String(value))
			? null
			: { invalidText: 'Only digits are allowed (no spaces, dashes or negative values)' };
	},
};
