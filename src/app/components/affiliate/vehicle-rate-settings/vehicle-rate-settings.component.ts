import { Component, OnInit, AfterViewChecked } from '@angular/core';
import { AffiliateService } from '../../../services/affiliate.service';
import { FormGroup, FormBuilder, Validators, FormArray, FormControl } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { NgxSpinnerService } from "ngx-spinner";
import { StateManagementService } from '../../../services/statemanagement.service';
import { catchError, debounceTime, finalize } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { AiRateScoreService } from '../../../services/ai-rate-score.service';

declare var $: any;



@Component({
	selector: 'app-vehicle-rate-settings',
	templateUrl: './vehicle-rate-settings.component.html',
	styleUrls: [
		'../affiliate-registration-style.css',
		'./vehicle-rate-settings.component.scss'
	]
})
export class VehicleRateSettingsComponent implements OnInit {

	VehicleRateSettingsForm: FormGroup

	is_form_submitted: boolean = false
	currency_symbol: string

	vehicle_info: any
	currency_options: any
	rate_range_object: any = {}
	thumb_value: number = 0
	duplicateVehicleId: any;
	vehcileId: any;
	public ratesArrayValues = [0, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100]


	constructor(
		private $api: AffiliateService,
		private $router: Router,
		private $form: FormBuilder,
		private $route: ActivatedRoute,
		private $spinner: NgxSpinnerService,
		private dialog: MatDialog,
		private aiRateScoreService: AiRateScoreService
	) { }

	ngOnInit(): void {
		console.warn('Inside New Vehicle Rate Settings Page. ')
		if (this.buildVehicleRateSettingsForm()) {
			this.$route.queryParams.subscribe((params: any) => {
				// fetch vehicle info and amenities
				this.SetFormValue('vehicle_id', params.vehicleId)
				if (params.duplicateVehicleId) {
					this.fetchVehicleInfoDuplicate(params.vehicleId, params.duplicateVehicleId)
					this.prefillTheFormForDuplicateVehicle(params.duplicateVehicleId)
					this.vehcileId = params.vehicleId
					this.duplicateVehicleId = params.duplicateVehicleId
				}
				else {
					this.fetchVehicleInfo(params.vehicleId)
					this.prefillTheForm(params.vehicleId)
				}
			})

			// fetch currencies
			this.currencies.then((data: any) => {
				this.currency_options = data
				for (let key in this.currency_options) {
					const currentUser = JSON.parse(localStorage.getItem('currentUser'))
					if (key.toLowerCase() == currentUser.phoneCountry.toLowerCase()) {
						this.SetFormValue('currency', this.currency_options[key]['currencyCountry'])
						this.currency_symbol = this.currency_options[key]['symbol']
					}
				}
			}, (error: string) => {
				console.error(error)
			})

		}

	}
	// NGONINIT ENDS


	get form() {
		return this.VehicleRateSettingsForm.controls
	}

	/** Both cruise port rates cannot be 0 — at least one must have a value > 0 */
	bothCruisePortRatesZero(): boolean {
		const arrival = this.VehicleRateSettingsForm?.get('minimum_cruise_port_arrival_rate')?.value;
		const departure = this.VehicleRateSettingsForm?.get('minimum_cruise_port_departure_rate')?.value;
		const a = parseFloat(arrival);
		const d = parseFloat(departure);
		return (isNaN(a) || a === 0) && (isNaN(d) || d === 0);
	}

	/** AI rate suggestions shown inline under each field + an accept bar. */
	aiLoading = false;
	aiError: string | null = null;
	aiSuggestions: Record<string, number> | null = null;
	aiNotes: Record<string, string> | null = null;
	aiScore: number | null = null;
	aiSummary = '';

	/** Fetch AI-suggested rates for the current form values. */
	getAiRates(): void {
		if (!this.VehicleRateSettingsForm) return;
		this.aiLoading = true;
		this.aiError = null;
		this.aiSuggestions = null;
		this.aiNotes = null;
		this.aiScore = null;
		this.aiSummary = '';

		const kmMile = this.VehicleRateSettingsForm.get('km_mile')?.value;
		const payload = {
			rates: this.aiRateScoreService.sanitizeRates(this.VehicleRateSettingsForm.value),
			vehicleType: this.vehicle_info?.vehicleType || 'Vehicle',
			currency: this.VehicleRateSettingsForm.get('currency')?.value || 'USD',
			unit: (kmMile === 'kilometer' ? 'kilometer' : 'mile') as 'mile' | 'kilometer',
		};

		this.aiRateScoreService.calculateScore(payload)
			.pipe(finalize(() => (this.aiLoading = false)))
			.subscribe({
				next: (res) => {
					this.aiScore = res.score;
					this.aiSummary = res.summary || '';
					this.aiSuggestions = res.suggestedRates || {};
					this.aiNotes = res.rateNotes || {};
					if (!Object.keys(this.aiSuggestions).length) {
						this.aiError = 'Your rates look competitive — no changes suggested.';
					}
				},
				error: (err) => {
					this.aiError = err?.message || 'Could not get AI suggestions. Please try again.';
				},
			});
	}

	/** Apply every AI-suggested rate to the form, then clear the bar. */
	acceptAiRates(): void {
		if (this.aiSuggestions && Object.keys(this.aiSuggestions).length) {
			this.VehicleRateSettingsForm.patchValue(this.aiSuggestions);
			this.VehicleRateSettingsForm.updateValueAndValidity();
		}
		this.dismissAiRates();
	}

	/** Clear the AI suggestions without applying them. */
	dismissAiRates(): void {
		this.aiSuggestions = null;
		this.aiNotes = null;
		this.aiScore = null;
		this.aiSummary = '';
		this.aiError = null;
	}

	/**
	 * Fetch the currencies from static JSON files
	 */
	get currencies() {
		return new Promise((resolve, reject) => {
			this.$api.getCurrencies().subscribe((response: any) => {
				if (!response || Object.keys(response).length == 0 || response.length == 0) {
					reject("Could not fetch Currencies. ")
					return // end the function
				}
				resolve(response)
			})
		})
	}
	Subscriptions() {
		this.VehicleRateSettingsForm.get('km_mile').valueChanges.subscribe((value: string) => {
			console.log('value for km_mile-->', value)
		})
	}


	/**
	 * Set the specified value into form
	 * 
	 * @params form_control: String [Required] Form Control name
	 * @params value: String [Required] value to be saved in form
	 */
	SetFormValue(form_control: string, value: any) {
		console.info('Setting Value of ', form_control, ': ', value)
		this.VehicleRateSettingsForm.get(form_control).setValue(value)
		this.VehicleRateSettingsForm.updateValueAndValidity()
	}


	/**
	 * Change Detection Functions with minimum functionality 
	 * like saving a form value or assigning a variable
	 */
	changeDetection = {
		radioButton: (form_control: string, value: any) => {
			this.SetFormValue(form_control, value)
			if (value == "kilometer") {
				console.log('set validator for km')
				this.VehicleRateSettingsForm.get('kilometer_rate')?.setValidators([Validators.required, Validators.pattern("^[0-9]*(\.[0-9]+)?$"), Validators.min(1.72), Validators.max(15)]); // Set back the validator
				this.VehicleRateSettingsForm.get('upto_km')?.setValidators([Validators.required, Validators.pattern("^[0-9]*(\.[0-9]+)?$")]); // Set back the validator
				this.VehicleRateSettingsForm.get('after_kilometer_rate')?.setValidators([Validators.required, Validators.pattern("^[0-9]*(\.[0-9]+)?$"), Validators.min(1.72), Validators.max(15)]); // Set back the validator	
				this.VehicleRateSettingsForm.get('milage_rate')?.clearValidators(); // Clear the validator
				this.VehicleRateSettingsForm.get('upto_miles')?.clearValidators(); // Clear the validator
				this.VehicleRateSettingsForm.get('after_mileage_rate')?.clearValidators(); // Clear the validator
				this.VehicleRateSettingsForm.get('kilometer_rate')?.updateValueAndValidity();
				this.VehicleRateSettingsForm.get('upto_km')?.updateValueAndValidity();
				this.VehicleRateSettingsForm.get('after_kilometer_rate')?.updateValueAndValidity();
				this.VehicleRateSettingsForm.get('milage_rate')?.updateValueAndValidity();
				this.VehicleRateSettingsForm.get('upto_miles')?.updateValueAndValidity();
				this.VehicleRateSettingsForm.get('after_mileage_rate')?.updateValueAndValidity();
			}
			else if (value == "mile") {
				console.log('set validator for mile')
				this.VehicleRateSettingsForm.get('milage_rate')?.setValidators([Validators.required, Validators.pattern("^[0-9]*(\.[0-9]+)?$"), Validators.min(2.1), Validators.max(15)]); // Set back the validator
				this.VehicleRateSettingsForm.get('upto_miles')?.setValidators([Validators.required, Validators.pattern("^[0-9]*(\.[0-9]+)?$")]); // Set back the validator
				this.VehicleRateSettingsForm.get('after_mileage_rate')?.setValidators([Validators.required, Validators.pattern("^[0-9]*(\.[0-9]+)?$"), Validators.min(2.1), Validators.max(15)]); // Set back the validator
				this.VehicleRateSettingsForm.get('kilometer_rate')?.clearValidators();
				this.VehicleRateSettingsForm.get('upto_km')?.clearValidators();
				this.VehicleRateSettingsForm.get('after_kilometer_rate')?.clearValidators();
				this.VehicleRateSettingsForm.get('milage_rate')?.updateValueAndValidity();
				this.VehicleRateSettingsForm.get('upto_miles')?.updateValueAndValidity();
				this.VehicleRateSettingsForm.get('after_mileage_rate')?.updateValueAndValidity();
				this.VehicleRateSettingsForm.get('kilometer_rate')?.updateValueAndValidity();
				this.VehicleRateSettingsForm.get('upto_km')?.updateValueAndValidity();
				this.VehicleRateSettingsForm.get('after_kilometer_rate')?.updateValueAndValidity();
			}
		},
		currencySymbol: (value: any) => {
			console.log(value)
			for (let key in this.currency_options) {
				if (key.toLowerCase() == this.currency_options[value]['currencyCountry'].toLowerCase()) {
					this.currency_symbol = this.currency_options[key]['symbol']
					this.SetFormValue('currency', this.currency_options[key]['currencyCountry'])
				}
			}
		},
		gratuity: (new_value: any, form_control: string) => {
			this.SetFormValue(form_control, new_value ? 'yes' : 'no')
		}
	}

	/**
	 * Build the form and applies the validations
	 */
	buildVehicleRateSettingsForm(): boolean {
		this.VehicleRateSettingsForm = this.$form.group({
			id: [''],
			acc_id: [''],
			vehicle_id: ['', [Validators.required, Validators.pattern("^[0-9+]*$")]],
			currency: ['$', Validators.required],
			hourly_rate: [0, [Validators.required, Validators.min(0.1), Validators.pattern("^[0-9]*(\.[0-9]+)?$")]],
			minimum_charter_hours: [2, [Validators.pattern("^[0-9]*(\.[0-9]+)?$")]],
			hourly_rate_after_five_hours: [0, [Validators.required, Validators.min(0.1), Validators.pattern("^[0-9]*(\.[0-9]+)?$")]],
			hours_day_rate: [8, [Validators.pattern("^[0-9]*(\.[0-9]+)?$")]],
			day_rate: [0, [Validators.pattern("^[0-9]*(\.[0-9]+)?$")]],
			km_mile: ['mile', Validators.required],
			milage_rate: ['', [Validators.required, , Validators.pattern(/^\d+(\.\d+)?$/)]],
			upto_miles: ['', [Validators.required, , Validators.pattern(/^\d+(\.\d+)?$/)]],
			after_mileage_rate: ['', [Validators.required, , Validators.pattern(/^\d+(\.\d+)?$/)]],
			kilometer_rate: ['', [Validators.pattern(/^\d+(\.\d+)?$/)]],
			upto_km: ['', [Validators.required, , Validators.pattern(/^\d+(\.\d+)?$/)]],
			after_kilometer_rate: ['', [Validators.required, , Validators.pattern(/^\d+(\.\d+)?$/)]],
			minimum_airport_departure_rate: [0, [Validators.required, Validators.min(0.1), Validators.pattern("^[0-9]*(\.[0-9]+)?$")]],
			minimum_airport_arrival_rate: [0, [Validators.required, Validators.min(0.1), Validators.pattern("^[0-9]*(\.[0-9]+)?$")]],
			minimum_city_rate: [0, [Validators.required, Validators.min(0.1), Validators.pattern("^[0-9]*(\.[0-9]+)?$")]],
			minimum_cruise_port_arrival_rate: [0, [Validators.pattern("^[0-9]*(\.[0-9]+)?$")]],
			minimum_cruise_port_departure_rate: [0, [Validators.pattern("^[0-9]*(\.[0-9]+)?$")]],
			minimum_on_demand_rate: [0, [Validators.pattern("^[0-9]*(\.[0-9]+)?$")]],
			in_town_extra_stop: [0, [Validators.pattern(/^\d+(\.\d+)?$/)]],
			outside_town_extra_stop: [0, [Validators.pattern(/^\d+(\.\d+)?$/)]],
			per_person_group_ride_rate: [0, [Validators.pattern("^[0-9]*(\.[0-9]+)?$")]],
			airport_city_percentage_booking_cancel_charges: [0, [Validators.pattern("^[0-9]*(\.[0-9]+)?$")]],
			charter_percentage_booking_cancel_charges: [0, [Validators.pattern("^[0-9]*(\.[0-9]+)?$")]],
			rate_range: ['0'],
			gratuity: ['20', [Validators.required, Validators.pattern("^[0-9+]*$")]],
			is_gratuity: ['no', Validators.required],
			amenities_rates: new FormGroup({}),
			airport_arrival_tax_per_us: [0, [Validators.pattern("^[0-9]*(\.[0-9]+)?$")]],
			airport_departure_tax_per_us: [0, [Validators.pattern("^[0-9]*(\.[0-9]+)?$")]],
			sea_port_tax_per_us: [0, [Validators.pattern("^[0-9]*(\.[0-9]+)?$")]],
			city_congestion_tax_per_us: [0, [Validators.pattern("^[0-9]*(\.[0-9]+)?$")]],
			rate_range_percent_flat: ['flat'],
			city_tax_percent_flat: ['flat'],
			state_tax_percent_flat: ['flat'],
			vat_percent_flat: ['flat'],
			workman_comp_percent_flat: ['flat'],
			other_transportation_tax_percent_flat: ['flat'],
			city_tax: [0, [Validators.pattern("^[0-9]*(\.[0-9]+)?$")]],
			state_tax: [0, [Validators.pattern("^[0-9]*(\.[0-9]+)?$")]],
			vat: [0, [Validators.pattern("^[0-9]*(\.[0-9]+)?$")]],
			workmans_comp: [0, [Validators.pattern("^[0-9]*(\.[0-9]+)?$")]],
			other_transportation_tax: [0, [Validators.pattern("^[0-9]*(\.[0-9]+)?$")]],
			early_late_charges: [0, [Validators.pattern("^[0-9]*(\.[0-9]+)?$")]],
			friday_saturday_charges: [0, [Validators.pattern("^[0-9]*(\.[0-9]+)?$")]],
			wait_time_cost: [0, [Validators.required, Validators.pattern(/^\d+(\.\d+)?$/)]],
			wait_time_unit: ['minute'],
			wait_time_value: ['15']
		})
		this.changeDetection.radioButton('km_mile', 'mile')

		if (this.VehicleRateSettingsForm) {
			return true
		}
		else {
			return false
		}
	}

	prefillTheFormForDuplicateVehicle(duplicateVehicleId: number = 0) {
		this.VehicleRateSettingsForm.get('hourly_rate').valueChanges.subscribe(
			value => {
				this.VehicleRateSettingsForm.patchValue({ hourly_rate_after_five_hours: value });
			}
		);
		this.VehicleRateSettingsForm.get('hourly_rate').valueChanges.subscribe(
			value => {
				this.dayRateCalculations()
			}
		);

	    this.VehicleRateSettingsForm.get('minimum_cruise_port_arrival_rate').valueChanges.pipe(
							debounceTime(500) 
							).subscribe(value => {
								const departureRate = this.VehicleRateSettingsForm.get('minimum_cruise_port_departure_rate').value
								if (departureRate === 0 || departureRate === undefined || departureRate === null) {
									this.SetFormValue('minimum_cruise_port_departure_rate', value)
								}
		})

		this.VehicleRateSettingsForm.get('hourly_rate_after_five_hours').valueChanges.subscribe(
			value => {
				this.dayRateCalculations()
			}
		);
		this.VehicleRateSettingsForm.get('hours_day_rate').valueChanges.subscribe(
			value => {
				this.dayRateCalculations()
			}
		);

		this.VehicleRateSettingsForm.get('minimum_airport_departure_rate').valueChanges.pipe(
					debounceTime(500) 
					).subscribe(
					value => {
						const arrivalRate = this.VehicleRateSettingsForm.get('minimum_airport_arrival_rate').value;
						const cityRate = this.VehicleRateSettingsForm.get('minimum_city_rate').value;
						const cruiseArrivalRate = this.VehicleRateSettingsForm.get('minimum_cruise_port_arrival_rate').value;
						const cruiseDepartureRate = this.VehicleRateSettingsForm.get('minimum_cruise_port_departure_rate').value;

						if (arrivalRate === 0 || arrivalRate === undefined || arrivalRate === null) {
							this.VehicleRateSettingsForm.patchValue({ minimum_airport_arrival_rate: value });
						}
						if (cityRate === 0 || cityRate === undefined || cityRate === null) {
							this.VehicleRateSettingsForm.patchValue({ minimum_city_rate: value });
						}
						if (cruiseArrivalRate === 0 || cruiseArrivalRate === undefined || cruiseArrivalRate === null) {
							this.VehicleRateSettingsForm.patchValue({ minimum_cruise_port_arrival_rate: value });
						}
						if (cruiseDepartureRate === 0 || cruiseDepartureRate === undefined || cruiseDepartureRate === null) {
							this.VehicleRateSettingsForm.patchValue({ minimum_cruise_port_departure_rate: value });
						}
					}
		);

		// fetch previous vehicle rates on edit case
		console.info('relative_vehicle_id', duplicateVehicleId);
		(duplicateVehicleId != 0 || duplicateVehicleId != null) && this.$api.getVehicleRates(duplicateVehicleId).pipe(
			catchError(err => {
				console.error('Error: ', err)
				return throwError(err)
			})
		).subscribe((response: any) => {
			if (response.data == null) return

			if (this.currency_options) {
				for (let key in this.currency_options) {
					if (key == response.data.currency) {
						this.SetFormValue('currency', this.currency_options[key]['currencyCountry'])
						this.currency_symbol = this.currency_options[key]['symbol']
					}
				}
			}
			this.VehicleRateSettingsForm.patchValue({
				id: response.data.id,
				// vehicle_id: response.data.vehicle_id,
				hourly_rate: response.data.hourly_rate ?? 0,
				minimum_charter_hours: Number(response.data?.minimum_charter_hours),
				hourly_rate_after_five_hours: response.data.hourly_rate_after_five_hours ?? 0,
				hours_day_rate: response.data.hours_day_rate ?? 0,
				day_rate: response.data.day_rate ?? 0,
				milage_rate: response.data.milage_rate ?? 0,
				km_mile: response.data.km_mile ?? 'mile',
				kilometer_rate: response.data.kilometer_rate ?? 0 ?? 0,
				upto_miles: response.data.upto_miles ?? 0 ?? 0,
				after_mileage_rate: response.data.after_mileage_rate ?? 0 ?? 0,
				upto_km: response.data.upto_km ?? 0 ?? 0,
				after_kilometer_rate: response.data.after_kilometer_rate ?? 0 ?? 0,
				minimum_airport_departure_rate: response.data.minimum_airport_departure_rate ?? 0,
				minimum_airport_arrival_rate: response.data.minimum_airport_arrival_rate ?? 0,
				minimum_city_rate: response.data.minimum_city_rate ?? 0,
				minimum_cruise_port_arrival_rate: response.data.minimum_cruise_port_arrival_rate ?? 0,
				minimum_cruise_port_departure_rate: response.data.minimum_cruise_port_departure_rate ?? 0,
				minimum_on_demand_rate: response.data.minimum_on_demand_rate ?? 0,
				per_person_group_ride_rate: response.data.per_person_group_ride_rate ?? 0,
				airport_city_percentage_booking_cancel_charges: response.data.airport_city_percentage_booking_cancel_charges ?? 0,
				charter_percentage_booking_cancel_charges: response.data.charter_percentage_booking_cancel_charges ?? 0,
				rate_range_percent_flat: response.data.rate_range_percent_flat ?? 'flat',
				gratuity: response.data.gratuity,
				is_gratuity: response.data.is_gratuity,
				airport_arrival_tax_per_us: response.data.airport_arrival_tax_per_us ?? 0,
				airport_departure_tax_per_us: response.data.airport_departure_tax_per_us ?? 0,
				sea_port_tax_per_us: response.data.sea_port_tax_per_us ?? 0,
				city_congestion_tax_per_us: response.data.city_congestion_tax_per_us ?? 0,
				city_tax: response.data.city_tax ?? 0,
				city_tax_percent_flat: response.data.city_tax_percent_flat ?? 0,
				state_tax: response.data.state_tax ?? 0,
				state_tax_percent_flat: response.data.state_tax_percent_flat ?? 0,
				vat: response.data.vat ?? 0,
				vat_percent_flat: response.data.vat_percent_flat ?? 0,
				workmans_comp: response.data.workmans_comp ?? 0,
				workman_comp_percent_flat: response.data.workman_comp_percent_flat,
				other_transportation_tax: response.data.other_transportation_tax ?? 0,
				other_transportation_tax_percent_flat: response.data.other_transportation_tax_percent_flat ?? 0,
				body_guard_security: response.data.body_guard_security,
				tour_guide: response.data.tour_guide,
				baggage_meet: response.data.baggage_meet,
				lei_greeting_hi: response.data.lei_greeting_hi,
				baby_seat: response.data.baby_seat ?? 0,
				booster_seat: response.data.booster_seat ?? 0,
				bike_rack: response.data.bike_rack ?? 0,
				per_diem: response.data.per_diem ?? 0,
				in_town_extra_stop: response.data.in_town_extra_stop,
				outside_town_extra_stop: response.data.outside_town_extra_stop,
				early_late_charges: response.data.early_late_charges,
				friday_saturday_charges: response.data.friday_saturday_charges,
				wait_time_cost: response.data.wait_time_cost ?? 0
			});
			console.group(this.VehicleRateSettingsForm)
			console.groupEnd()
			this.changeDetection.radioButton('km_mile', response.data.km_mile ?? 'mile')
			this.updateRateRangeObject();
		})
		this.initRateRangeObject();
	}

	prefillTheForm(current_selected_vehicle: number = 0) {
		this.VehicleRateSettingsForm.get('hourly_rate').valueChanges.subscribe(
			value => {
				this.VehicleRateSettingsForm.patchValue({ hourly_rate_after_five_hours: value });
			}
		);
		this.VehicleRateSettingsForm.get('hourly_rate').valueChanges.subscribe(
			value => {
				this.dayRateCalculations()
			}
		);

		this.VehicleRateSettingsForm.get('minimum_cruise_port_arrival_rate').valueChanges.pipe(
			debounceTime(500)
		)
		.subscribe(value => {
			const departureRate = this.VehicleRateSettingsForm.get('minimum_cruise_port_departure_rate').value
			if (departureRate === 0 || departureRate === undefined || departureRate === null) {
				this.SetFormValue('minimum_cruise_port_departure_rate', value)
			}
		})

		this.VehicleRateSettingsForm.get('hourly_rate_after_five_hours').valueChanges.subscribe(
			value => {
				this.dayRateCalculations()
			}
		);
		this.VehicleRateSettingsForm.get('hours_day_rate').valueChanges.subscribe(
			value => {
				this.dayRateCalculations()
			}
		);

		this.VehicleRateSettingsForm.get('minimum_airport_departure_rate').valueChanges.pipe(
			debounceTime(500)
		).subscribe(
			value => {
				const arrivalRate = this.VehicleRateSettingsForm.get('minimum_airport_arrival_rate').value;
				const cityRate = this.VehicleRateSettingsForm.get('minimum_city_rate').value;
				const cruiseArrivalRate = this.VehicleRateSettingsForm.get('minimum_cruise_port_arrival_rate').value;

				if (arrivalRate === 0 || arrivalRate === undefined || arrivalRate === null) {
					this.VehicleRateSettingsForm.patchValue({ minimum_airport_arrival_rate: value });
				}
				if (cityRate === 0 || cityRate === undefined || cityRate === null) {
					this.VehicleRateSettingsForm.patchValue({ minimum_city_rate: value });
				}
				if (cruiseArrivalRate === 0 || cruiseArrivalRate === undefined || cruiseArrivalRate === null) {
					this.VehicleRateSettingsForm.patchValue({ minimum_cruise_port_arrival_rate: value });
				}
			}
		);

		// fetch previous vehicle rates on edit case
		console.info('>>>>>>>>>>>>>>...........', current_selected_vehicle);
		(current_selected_vehicle != 0 || current_selected_vehicle != null) && this.$api.getVehicleRates(current_selected_vehicle).pipe(
			catchError(err => {
				console.error('Error: ', err)
				return throwError(err)
			})
		).subscribe((response: any) => {
			if (response.data == null) return

			if (this.currency_options) {
				for (let key in this.currency_options) {
					if (key == response.data.currency) {
						this.SetFormValue('currency', this.currency_options[key]['currencyCountry'])
						this.currency_symbol = this.currency_options[key]['symbol']
					}
				}
			}
			this.VehicleRateSettingsForm.patchValue({
				id: response.data.id,
				// vehicle_id: response.data.vehicle_id,
				hourly_rate: response.data.hourly_rate ?? 0,
				minimum_charter_hours: Number(response.data?.minimum_charter_hours),
				hourly_rate_after_five_hours: response.data.hourly_rate_after_five_hours ?? 0,
				hours_day_rate: response.data.hours_day_rate ?? 0,
				day_rate: response.data.day_rate ?? 0,
				milage_rate: response.data.milage_rate ?? 0,
				km_mile: response.data.km_mile ?? 'mile',
				kilometer_rate: response.data.kilometer_rate ?? 0 ?? 0,
				upto_miles: response.data.upto_miles ?? 0 ?? 0,
				after_mileage_rate: response.data.after_mileage_rate ?? 0 ?? 0,
				upto_km: response.data.upto_km ?? 0 ?? 0,
				after_kilometer_rate: response.data.after_kilometer_rate ?? 0 ?? 0,
				minimum_airport_departure_rate: response.data.minimum_airport_departure_rate ?? 0,
				minimum_airport_arrival_rate: response.data.minimum_airport_arrival_rate ?? 0,
				minimum_city_rate: response.data.minimum_city_rate ?? 0,
				minimum_cruise_port_arrival_rate: response.data.minimum_cruise_port_arrival_rate ?? 0,
				minimum_cruise_port_departure_rate: response.data.minimum_cruise_port_departure_rate ?? 0,
				minimum_on_demand_rate: response.data.minimum_on_demand_rate ?? 0,
				per_person_group_ride_rate: response.data.per_person_group_ride_rate ?? 0,
				airport_city_percentage_booking_cancel_charges: response.data.airport_city_percentage_booking_cancel_charges ?? 0,
				charter_percentage_booking_cancel_charges: response.data.charter_percentage_booking_cancel_charges ?? 0,
				rate_range_percent_flat: response.data.rate_range_percent_flat ?? 'flat',
				gratuity: response.data.gratuity,
				is_gratuity: response.data.is_gratuity,
				airport_arrival_tax_per_us: response.data.airport_arrival_tax_per_us ?? 0,
				airport_departure_tax_per_us: response.data.airport_departure_tax_per_us ?? 0,
				sea_port_tax_per_us: response.data.sea_port_tax_per_us ?? 0,
				city_congestion_tax_per_us: response.data.city_congestion_tax_per_us ?? 0,
				city_tax: response.data.city_tax ?? 0,
				city_tax_percent_flat: response.data.city_tax_percent_flat ?? 0,
				state_tax: response.data.state_tax ?? 0,
				state_tax_percent_flat: response.data.state_tax_percent_flat ?? 0,
				vat: response.data.vat ?? 0,
				vat_percent_flat: response.data.vat_percent_flat ?? 0,
				workmans_comp: response.data.workmans_comp ?? 0,
				workman_comp_percent_flat: response.data.workman_comp_percent_flat,
				other_transportation_tax: response.data.other_transportation_tax ?? 0,
				other_transportation_tax_percent_flat: response.data.other_transportation_tax_percent_flat ?? 0,
				body_guard_security: response.data.body_guard_security,
				tour_guide: response.data.tour_guide,
				baggage_meet: response.data.baggage_meet,
				lei_greeting_hi: response.data.lei_greeting_hi,
				baby_seat: response.data.baby_seat ?? 0,
				booster_seat: response.data.booster_seat ?? 0,
				bike_rack: response.data.bike_rack ?? 0,
				per_diem: response.data.per_diem ?? 0,
				in_town_extra_stop: response.data.in_town_extra_stop,
				outside_town_extra_stop: response.data.outside_town_extra_stop,
				early_late_charges: response.data.early_late_charges,
				friday_saturday_charges: response.data.friday_saturday_charges,
				wait_time_cost: response.data.wait_time_cost ?? 0
			});
			console.group(this.VehicleRateSettingsForm)
			console.groupEnd()
			this.changeDetection.radioButton('km_mile', response.data.km_mile ?? 'mile')
			this.updateRateRangeObject();
		})
		this.initRateRangeObject();
	}

	fetchVehicleInfoDuplicate(vehicle_id: number = 0, relative_vehicle_id: number = 0) {
		console.info('Fetching duplicate Vehicle Info ....')
		// if (vehicle_id == 0 || vehicle_id == null) {
		// 	console.log('Vehicle Not selected. ')
		// 	this.$router.navigate(['/affiliate/step5'])
		// 	return false
		// }
		this.$spinner.show()
		this.$api.getVehicleInfo(vehicle_id, relative_vehicle_id).pipe(
			catchError(err => {
				this.$spinner.hide()
				console.error('Error: ', err)
				return throwError(err)
			})
		).subscribe((response: any) => {
			console.info('Vehicle Info has been fetched successfully !!!')
			this.$spinner.hide()
			this.vehicle_info = response.data
			if (response.data.amenities) {
				for (let key in response.data.amenities) {
					this.AmenitiesRates.addControl(key, this.$form.group({ ...response.data.amenities[key] }))
				}
			}
			return true
		})
	}

	fetchVehicleInfo(vehicle_id: number = 0): boolean {
		console.info('Fetching Vehicle Info ....')
		if (vehicle_id == 0 || vehicle_id == null) {
			console.log('Vehicle Not selected. ')
			this.$router.navigate(['/affiliate/step5'])
			return false
		}
		this.$spinner.show()
		this.$api.getVehicleInfo(vehicle_id).pipe(
			catchError(err => {
				this.$spinner.hide()
				console.error('Error: ', err)
				return throwError(err)
			})
		).subscribe((response: any) => {
			console.info('Vehicle Info has been fetched successfully !!!')
			this.$spinner.hide()
			this.vehicle_info = response.data
			if (response.data.amenities) {
				for (let key in response.data.amenities) {
					this.AmenitiesRates.addControl(key, this.$form.group({ ...response.data.amenities[key] }))
				}
			}
			return true
		})
	}

	/**
	 * Day Rate Calculations
	 */
	dayRateCalculations() {
		let dayRateValue = (this.VehicleRateSettingsForm.get('hourly_rate').value * 5) + (this.VehicleRateSettingsForm.get('hourly_rate_after_five_hours').value * (this.VehicleRateSettingsForm.get('hours_day_rate').value - 5));
		this.VehicleRateSettingsForm.patchValue({
			day_rate: dayRateValue
		});
	}


	changeAmenityRate(babySeatKey, babySeatValue) {
		//changes in amenity rates formGroup
		if (babySeatValue.label == 'Baby_Seat') {
			Object.entries(this.VehicleRateSettingsForm.value.amenities_rates).forEach(
				([key, value]: any) => {
					// if (value.label == 'Booster_Seat' || value.label == 'Baggage_Meet_Dom_' || value.label == 'Baggage_Meet_Int_') {
					// 	(this.AmenitiesRates.get(key) as FormGroup).setValue({ ...value, price: babySeatValue.price });
					// }
				});
		}
	}

	get AmenitiesRates() {
		return this.VehicleRateSettingsForm.get("amenities_rates") as FormGroup
	}

	// show amenity rates only when the vehicle has chargeable amenities selected
	get hasChargeableAmenities(): boolean {
		return Object.keys(this.AmenitiesRates?.controls || {}).length > 0
	}

	createItem(e): FormGroup {
		return this.$form.group({ ...e });
	}

	submitForm() {
		this.form.km_mile.value == 'mile' ? this.SetFormValue('kilometer_rate', 0) : this.SetFormValue('milage_rate', 0)
		let currentUser = JSON.parse(localStorage.getItem('currentUser'))
		this.VehicleRateSettingsForm.patchValue({
			acc_id:currentUser.account_id
		})


		let tree = this.$router.parseUrl(this.$router.url);
		if (tree.root.children.primary.segments[2]) {
			var lastPartUrl = tree.root.children.primary.segments[2].path;
			if (lastPartUrl == 'step5') {
				let currentUser = JSON.parse(localStorage.getItem('currentUser'))
				let stepCompleted = JSON.parse(localStorage.getItem('stepCompleted'))
				if (currentUser.account_id) {
					console.info('Filling Account ID')
					if (parseInt(stepCompleted) >= 4) {
						this.VehicleRateSettingsForm.patchValue({
							acc_id: currentUser.account_id
						});
					}
				}
			}
		}
		this.VehicleRateSettingsForm.value['stepCompleted'] = this.$api.getUpdatedStepsLocal('5');

		this.is_form_submitted = true;

		console.group(this.VehicleRateSettingsForm)
		console.log('\n\n\n')
		console.groupEnd()
		// stop here if form is invalid
		if (this.VehicleRateSettingsForm.invalid) {
			this.is_form_submitted = false
			return;
		}
		if (this.bothCruisePortRatesZero()) {
			return;
		}

		this.$spinner.show();

		if (this.duplicateVehicleId) {
			this.VehicleRateSettingsForm.patchValue({
				id: "",
				vehicle_id: this.vehcileId
			})
		}
		this.$api.editVehicleRates(this.VehicleRateSettingsForm.value, this.duplicateVehicleId)
			.pipe(
				catchError(err => {
					this.$spinner.hide();//hide spinner
					this.is_form_submitted = false; //disable submit button
					return throwError(err);
				})
			)
			.subscribe((response: any) => {
				this.$spinner.hide();//hide spinner
				this.is_form_submitted = true; //disable submit button

				this.$api.updateStepsLocal('5');
				let obj = this.$api.getLocalStepCompletedObject()
				obj['step5'] = 'completed'
				this.$api.updateStepsCompletedObject(obj)
				if (this.VehicleRateSettingsForm.value.id == '') {
					this.$router.navigateByUrl('/', { skipLocationChange: true }).then(() =>
						this.$router.navigate(['/affiliate/step5'])
					)
				}
				else {
					this.$router.navigateByUrl('/', { skipLocationChange: true }).then(() =>
						this.$router.navigate(['/affiliate/step5'])
					)
				}
			});
	}

	/**
	 * Clone the values of source into target
	 *
	 * @params form_control_source: Source string to copy the value from
	 * @params form_control_target: Target string to copy the value to
	 */
	cloneValue(form_control_source: string, form_control_target: string) {
		console.log('Cloning.')
		this.SetFormValue(form_control_target, this.VehicleRateSettingsForm.get(form_control_source).value)
	}

















	/**
	 * build a new object with keys as the form control names and and values as the value of those controls.
	 */
	initRateRangeObject(): boolean {
		let form_control_names = ['milage_rate', 'upto_miles', 'after_mileage_rate', 'upto_km', 'after_kilometer_rate', 'kilometer_rate', 'hourly_rate', 'hourly_rate_after_five_hours', 'day_rate', 'minimum_city_rate', 'minimum_airport_departure_rate', 'minimum_airport_arrival_rate', 'minimum_cruise_port_arrival_rate', 'minimum_cruise_port_departure_rate', 'airport_city_percentage_booking_cancel_charges', 'per_person_group_ride_rate', 'wait_time_cost']
		form_control_names.forEach((name: string) => {
			this.rate_range_object[name] = this.VehicleRateSettingsForm.get(name).value ?? 0
		})
		console.log('Rate Range Object Initialised ', this.rate_range_object)
		return true
	}

	/**
	 * Updates the rate range object with new value if touched
	 * @param form_name name of the form control
	 */
	updateRateRangeObject() {
		for (let form_name in this.rate_range_object) {
			try {
				// console.log(form_name, typeof this.VehicleRateSettingsForm.get(form_name).value)
				this.rate_range_object[form_name] = parseFloat(this.VehicleRateSettingsForm.get(form_name).value.toFixed(2))
			}
			catch (err) {
				console.log(form_name, typeof this.VehicleRateSettingsForm.get(form_name).value, err)
			}
		}
		console.log(this.rate_range_object)
	}

	/**
	 * 
	 * @param range_value current value of the slider
	 */
	getRateRange(range_value: number) {
		console.log('range_value', range_value)
		this.thumb_value = range_value
		this.SetFormValue('rate_range', range_value)
		// --------- For Flat ------------------
		if (this.form.rate_range_percent_flat.value == 'flat') {
			// for neutral
			if (range_value == 0) {
				console.log('B')
				for (const key in this.rate_range_object) {
					this.SetFormValue('rate_range', '0')
					this.SetFormValue(key, this.rate_range_object[key])
				}
			}

			// for negative side indicator
			if (range_value < 0) {
				for (const key in this.rate_range_object) {
					this.rate_range_object[key] == null && this.SetFormValue(key, 0)	// set 0 if null
					// decrease by number and set value upto two decimal places and update
					// let value = Math.round(Number.EPSILON + (Math.abs(parseInt(this.rate_range_object[key])) - Math.abs(range_value)) * 100) / 100
					let value = parseFloat(Math.abs(this.rate_range_object[key] - Math.abs(range_value)).toFixed(2))
					this.SetFormValue(key, value)
				}
			}

			// for positive side indicator
			if (range_value > 0) {
				for (const key in this.rate_range_object) {
					this.rate_range_object[key] == null && this.SetFormValue(key, 0) 	// set 0 if null

					// let value = this.rate_range_object[key]
					// increase by number and set value upto two decimal places and update
					// let value = Math.round(Number.EPSILON + (Math.abs(parseInt(this.rate_range_object[key])) + Math.abs(range_value)) * 100) / 100
					let value = parseFloat(Math.abs(this.rate_range_object[key] + Math.abs(range_value)).toFixed(2))
					this.SetFormValue(key, value)
				}
			}
			console.log(this.rate_range_object)
		}
		// -------------- For Percentage ------------------
		else {
			// for neutral
			if (range_value == 0) {
				for (const key in this.rate_range_object) {
					this.SetFormValue('rate_range', '0')
					this.SetFormValue(key, this.rate_range_object[key])
				}
			}
			// for negative side indicator
			if (range_value < 0) {
				for (const key in this.rate_range_object) {
					this.rate_range_object[key] == null && this.SetFormValue(key, 0)	// set 0 if null

					// decrease by percentage and set value upto two decimal places and update
					let percentage_value = this.rate_range_object[key] - (this.rate_range_object[key] * Math.abs(range_value) / 100)
					let value = Math.round(Number.EPSILON + percentage_value * 100) / 100
					this.SetFormValue(key, value)
				}
			}

			// for positive side indicator
			if (range_value > 0) {
				for (const key in this.rate_range_object) {
					this.rate_range_object[key] == null && this.SetFormValue(key, 0)	// set 0 if null

					// decrease by percentage and set value upto two decimal places and update
					let percentage_value = this.rate_range_object[key] + (this.rate_range_object[key] * Math.abs(range_value) / 100)
					let value = Math.round(Number.EPSILON + percentage_value * 100) / 100
					this.SetFormValue(key, value)
				}
			}
		}
	}


	/**
	 * increment/decrement the thumb value based on the value provided.
	 * 
	 * @params value: Number [Required] expected values(1/-1)
	 */
	changeThumb(value: number, style?: string) {
		if (style == '+') {
			this.getRateRange(this.thumb_value + value)
		}
		if (style == '-') {
			this.getRateRange(this.thumb_value - value)
		}
	}


	/**
	 * Resets the whole form to initial values i.e. when the form is newly built
	 */
	resetForm() {
		// this.VehicleRateSettingsForm.reset();
		this.VehicleRateSettingsForm.patchValue({
			currency: '$',
			hourly_rate: 0,
			minimum_charter_hours: 2,
			hourly_rate_after_five_hours: 0,
			hours_day_rate: 8,
			day_rate: 0,
			km_mile: 'mile',
			milage_rate: '',
			after_mileage_rate: '',
			after_kilometer_rate: '',
			upto_miles: '',
			upto_km: '',
			kilometer_rate: '',
			minimum_airport_departure_rate: 0,
			minimum_airport_arrival_rate: 0,
			minimum_city_rate: 0,
			minimum_cruise_port_arrival_rate: 0,
			minimum_cruise_port_departure_rate: 0,
			minimum_on_demand_rate: 0,
			per_person_group_ride_rate: 0,
			airport_city_percentage_booking_cancel_charges: 0,
			charter_percentage_booking_cancel_charges: 0,
			rate_range: '0',
			gratuity: '20',
			is_gratuity: 'no',
			amenities_rates: new FormGroup({}),
			airport_arrival_tax_per_us: "",
			airport_departure_tax_per_us: "",
			sea_port_tax_per_us: "",
			city_congestion_tax_per_us: "",
			rate_range_percent_flat: 'flat',
			city_tax_percent_flat: 'flat',
			state_tax_percent_flat: 'flat',
			vat_percent_flat: 'flat',
			workman_comp_percent_flat: 'flat',
			other_transportation_tax_percent_flat: 'flat',
			city_tax: 0,
			state_tax: 0,
			vat: 0,
			workmans_comp: 0,
			other_transportation_tax: 0,
		})
		window.scrollTo({
			top: 0,
			behavior: 'smooth'
		})
	}
}
