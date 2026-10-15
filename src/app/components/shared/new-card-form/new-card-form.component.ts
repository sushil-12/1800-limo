import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { AbstractControl, FormBuilder, FormControl, FormGroup, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { MomentDateAdapter, MAT_MOMENT_DATE_ADAPTER_OPTIONS } from '@angular/material-moment-adapter';
import { DateAdapter, MAT_DATE_FORMATS, MAT_DATE_LOCALE } from '@angular/material/core';
import { NgxSpinnerService } from 'ngx-spinner';
import moment from 'moment';
import { AdminService } from '../../../services/admin.service';

export const CARD_EXPIRY_FORMATS = {
	parse: {
		dateInput: 'MM/YYYY',
	},
	display: {
		dateInput: 'MM/YYYY',
		monthYearLabel: 'MMM YYYY',
		dateA11yLabel: 'LL',
		monthYearA11yLabel: 'MMMM YYYY',
	},
};

/**
 * Inline "New card details" form (same layout as the finalize-booking screen)
 * that saves a debit/credit card against an account.
 */
@Component({
	selector: 'app-new-card-form',
	templateUrl: './new-card-form.component.html',
	styleUrls: ['./new-card-form.component.scss'],
	providers: [
		{
			provide: DateAdapter,
			useClass: MomentDateAdapter,
			deps: [MAT_DATE_LOCALE, MAT_MOMENT_DATE_ADAPTER_OPTIONS],
		},
		{ provide: MAT_DATE_FORMATS, useValue: CARD_EXPIRY_FORMATS },
	],
})
export class NewCardFormComponent implements OnInit {
	/** Account the card will be saved to */
	@Input() accountId: number;
	/** Prefill for the card holder field */
	@Input() defaultName: string = '';

	@Output() saved = new EventEmitter<any>();

	cardForm: FormGroup;
	expiryDateControl = new FormControl(moment());
	isSaving: boolean = false;

	constructor(
		private $form: FormBuilder,
		private $api: AdminService,
		private $spinner: NgxSpinnerService,
	) { }

	ngOnInit(): void {
		this.cardForm = this.$form.group({
			name: [this.defaultName || '', [Validators.required]],
			card_number: ['', [Validators.required, Validators.pattern("^[0-9+]*$"), Validators.minLength(12), Validators.maxLength(20)]],
			exp_month: ['', Validators.required],
			exp_year: ['', Validators.required],
			cvv: ['', [Validators.required, Validators.pattern("^[0-9+]*$"), Validators.maxLength(4)]],
		}, { validators: this.expiryDateValidator() });

		this.setExpiryDate(moment());
	}

	saveCardDetails() {
		if (this.cardForm.invalid) {
			this.cardForm.markAllAsTouched();
			this.expiryDateControl.markAsTouched();
			return;
		}
		if (!this.accountId || this.isSaving) {
			return;
		}

		const { name, card_number, exp_month, exp_year, cvv } = this.cardForm.value;
		const dataToSend = {
			id: '',
			acc_id: this.accountId,
			card_type: 'personal',
			name,
			number: card_number,
			cvc: cvv,
			exp_month,
			exp_year,
		};

		this.isSaving = true;
		this.$spinner.show();
		this.$api.addCard(dataToSend).subscribe({
			next: (response: any) => {
				this.isSaving = false;
				this.$spinner.hide();
				this.saved.emit(response);
			},
			error: () => {
				this.isSaving = false;
				this.$spinner.hide();
			}
		});
	}

	// Month-Year Picker Logic
	get minExpiryDate() {
		return moment().startOf('month');
	}

	private setExpiryDate(date: moment.Moment) {
		const selectedDate = date.clone().startOf('month');
		this.expiryDateControl.setValue(selectedDate);
		this.cardForm.patchValue({
			exp_month: selectedDate.format('MM'),
			exp_year: selectedDate.year()
		}, { emitEvent: false });
		this.cardForm.updateValueAndValidity({ emitEvent: false });
	}

	private expiryDateValidator(): ValidatorFn {
		return (control: AbstractControl): ValidationErrors | null => {
			const expMonth = control.get('exp_month')?.value;
			const expYear = control.get('exp_year')?.value;

			if (!expMonth || !expYear) {
				return null;
			}

			const selectedDate = moment(`${expYear}-${expMonth}-01`, 'YYYY-MM-DD', true);
			if (!selectedDate.isValid()) {
				return { invalidExpiryDate: true };
			}

			return selectedDate.isBefore(moment().startOf('month')) ? { invalidExpiryDate: true } : null;
		};
	}

	chosenYearHandler(normalizedYear: moment.Moment) {
		const ctrlValue = this.expiryDateControl.value || moment();
		ctrlValue.year(normalizedYear.year());
		this.expiryDateControl.setValue(ctrlValue);
	}

	chosenMonthHandler(normalizedMonth: moment.Moment, datepicker: any) {
		const selectedDate = normalizedMonth.clone().year(normalizedMonth.year()).month(normalizedMonth.month());
		this.setExpiryDate(selectedDate);

		this.cardForm.get('exp_month').markAsDirty();
		this.cardForm.get('exp_year').markAsDirty();
		this.cardForm.get('exp_month').markAsTouched();
		this.cardForm.get('exp_year').markAsTouched();
		this.expiryDateControl.markAsTouched();

		datepicker.close();
	}
}
