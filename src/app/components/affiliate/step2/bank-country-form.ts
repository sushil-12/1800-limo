import { AbstractControl, FormGroup, ValidatorFn, Validators } from '@angular/forms';
import { Observable, of, Subscription } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { BankRules, bankRules, StripeCountryFields, withStripeFields } from './bank-country-rules';

/**
 * The bank-country behaviour of the Stripe bank forms that don't have their own (travel agent, the
 * admin's travel-agent form, subscriber): it watches the form's `country` control and, for that country,
 * asks Stripe (through limoapi) what it needs up front, then makes Routing, ssn, the date of birth and
 * id_front_image required or not to match, the same way as the affiliate's step 2 and limoapi's
 * StripeBankCountryRules. Templates read `rules` to show only those fields.
 */
export class BankCountryForm {
	rules: BankRules = bankRules('US');
	private readonly fieldsByCountry: Record<string, StripeCountryFields | null> = {};
	private subscription?: Subscription;
	private form?: FormGroup;

	/**
	 * @param fetchFields  the limoapi country-fields call for this user type
	 * @param idValidators extra validators for a required ID number (e.g. no dashes / no "+")
	 */
	constructor(
		private readonly fetchFields: (country: string) => Observable<any>,
		private readonly idValidators: () => ValidatorFn[] = () => [],
	) { }

	get country(): string {
		return String(this.form?.get('country')?.value || '').toUpperCase();
	}

	get isUs(): boolean {
		return this.country === 'US';
	}

	/** Start following the form's country (call once the form is built). */
	attach(form: FormGroup): void {
		this.detach();
		this.form = form;
		const control = form.get('country');
		if (!control) return;
		this.subscription = control.valueChanges.subscribe((value) => this.apply(value));
		this.apply(control.value);
	}

	detach(): void {
		this.subscription?.unsubscribe();
		this.subscription = undefined;
	}

	/** Apply the country's rules now, and again once Stripe's answer for it arrives. */
	apply(country: string): void {
		const code = String(country || '').toUpperCase();
		this.rules = withStripeFields(bankRules(code), this.fieldsByCountry[code] ?? null);
		this.applyValidators();
		if (code.length !== 2 || code in this.fieldsByCountry) return;
		this.fieldsByCountry[code] = null;
		this.fetchFields(code)
			.pipe(catchError(() => of(null)))
			.subscribe((res: any) => {
				const fields: StripeCountryFields | null = res?.data ?? null;
				this.fieldsByCountry[code] = fields;
				if (this.country !== code) return;
				this.rules = withStripeFields(bankRules(code), fields);
				this.applyValidators();
			});
	}

	private applyValidators(): void {
		const form = this.form;
		if (!form) return;
		const set = (name: string, validators: ValidatorFn[], clearWhenHidden: boolean) => {
			const control: AbstractControl | null = form.get(name);
			if (!control) return;
			control.setValidators(validators);
			if (clearWhenHidden && !validators.length && control.value) control.setValue('', { emitEvent: false });
			control.updateValueAndValidity({ emitEvent: false });
		};
		const required = (needed: boolean) => (needed ? [Validators.required] : []);

		set('Routing', required(this.rules.showRouting), !this.rules.showRouting);

		// The SSN is digits only; other countries' ID numbers can have letters (e.g. an NRIC or a PAN).
		const idPattern = Validators.pattern(this.isUs ? '^[0-9*]*$' : '^[A-Za-z0-9*]*$');
		set('ssn', this.rules.idRequired ? [Validators.required, idPattern, ...this.idValidators()] : [idPattern], !this.rules.showId);

		if (!this.rules.showEin) {
			form.get('haveEin')?.setValue(false, { emitEvent: false });
			set('ein', [], true);
		}

		for (const name of ['dobDay', 'dobMonth', 'dobYear']) set(name, required(this.rules.showDob), !this.rules.showDob);
		// A photo already uploaded stays attached; it just isn't required.
		set('id_front_image', required(this.rules.showIdDocument), false);
	}
}
