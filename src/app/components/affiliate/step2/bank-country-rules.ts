/**
 * What the Stripe Banking form asks for, by the bank's country (the form's `country` control).
 *
 * Stripe creates every affiliate as an *individual* account, so an EIN is never sent to Stripe,
 * and a personal ID number is only required up front in the US (SSN). Elsewhere it's optional:
 * Stripe asks for more only if it needs it. Keep IBAN_COUNTRIES in sync with
 * limoapi AccountResgisterController::BANK_WITHOUT_ROUTING.
 */
export interface BankRules {
	/** The account number field's label. */
	accountLabel: string;
	accountHint: string;
	/** False where the account number alone identifies the bank (IBAN, CLABE). */
	showRouting: boolean;
	routingLabel: string;
	routingHint: string;
	/** False where Stripe doesn't take a personal ID number (UK, IBAN countries, Australia...). */
	showId: boolean;
	idRequired: boolean;
	idLabel: string;
	idHint: string;
	/** EIN / Business ID: a US thing. */
	showEin: boolean;
}

/** Banks identified by the IBAN alone (SEPA, plus Stripe's other IBAN countries). */
export const IBAN_COUNTRIES = [
	'AT', 'BE', 'BG', 'CH', 'CR', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'HU', 'IE',
	'IL', 'IS', 'IT', 'LI', 'LT', 'LU', 'LV', 'MT', 'NL', 'NO', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK', 'AE',
];

const OPTIONAL_ID = 'Optional. Leave it empty if you don\'t have one: Stripe will ask if it needs it.';

const DEFAULT_RULES: BankRules = {
	accountLabel: 'Bank account number',
	accountHint: 'Numbers only, no spaces or dashes.',
	showRouting: true,
	routingLabel: 'Bank / branch code',
	routingHint: 'The code that identifies your bank and branch. Your bank app or statement shows it.',
	showId: true,
	idRequired: false,
	idLabel: 'National ID number',
	idHint: OPTIONAL_ID,
	showEin: false,
};

const RULES: Record<string, Partial<BankRules>> = {
	US: {
		accountLabel: 'Account number',
		routingLabel: 'Routing number',
		routingHint: '9 digits, at the bottom left of a check.',
		idRequired: true,
		idLabel: 'Social Security Number (SSN)',
		idHint: 'Only Stripe sees all the digits. It won\'t be visible after you save.',
		showEin: true,
	},
	GB: {
		accountLabel: 'Account number',
		accountHint: '8 digits.',
		routingLabel: 'Sort code',
		routingHint: '6 digits, without dashes. For example 108800.',
		showId: false,
	},
	CA: {
		routingLabel: 'Transit and institution number',
		routingHint: '5-digit transit number, a dash, then the 3-digit institution number. For example 11000-000.',
		idLabel: 'Social Insurance Number (SIN)',
	},
	AU: {
		routingLabel: 'BSB',
		routingHint: '6 digits, without the dash. For example 110000.',
		showId: false,
	},
	NZ: { showId: false },
	IN: {
		routingLabel: 'IFSC code',
		routingHint: '11 characters. For example HDFC0000261.',
		idLabel: 'PAN',
	},
	JP: {
		routingLabel: 'Bank code + branch code',
		routingHint: '7 digits: the 4-digit bank code, then the 3-digit branch code.',
		showId: false,
	},
	SG: {
		routingLabel: 'Bank code + branch code',
		routingHint: 'For example 1100-000.',
		idLabel: 'NRIC / FIN',
	},
	HK: {
		routingLabel: 'Clearing code + branch code',
		routingHint: 'For example 110-000.',
		idLabel: 'HKID',
	},
	MX: {
		accountLabel: 'CLABE',
		accountHint: '18 digits. It includes your bank, so no routing number is needed.',
		showRouting: false,
		idLabel: 'CURP or RFC',
	},
};

const IBAN_RULES: Partial<BankRules> = {
	accountLabel: 'IBAN',
	accountHint: 'Your full IBAN, starting with the country letters. No routing or sort code is needed.',
	showRouting: false,
	showId: false,
};

export function bankRules(country: string | null | undefined): BankRules {
	const code = (country || '').toUpperCase();
	const specific = IBAN_COUNTRIES.includes(code) ? IBAN_RULES : RULES[code] || {};
	return { ...DEFAULT_RULES, ...specific };
}
