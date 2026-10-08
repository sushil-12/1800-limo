import { Component, OnInit, AfterViewChecked } from '@angular/core';
import { AdminService } from '../../../services/admin.service';
import { HttpClient } from "@angular/common/http";
import { FormGroup, FormBuilder, Validators, FormArray, FormControl } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { NgxSpinnerService } from "ngx-spinner";
import { StateManagementService } from '../../../services/statemanagement.service';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
declare var $: any;

@Component({
	selector: 'app-master-vehicle-fare',
	templateUrl: './master-vehicle-fare.component.html',
	styleUrls: ['./master-vehicle-fare.component.scss']
})
export class MasterVehicleFareComponent implements OnInit {
	VehicleRateSettingsForm: FormGroup

	is_form_submitted: boolean = false
	currency_symbol: string

	vehicle_info: any
	currency_options: any
	rate_range_object: any = {}
	thumb_value: number = 0
	public ratesArrayValues = [0, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100]

	constructor(
		private $api: AdminService,
		private $router: Router,
		private $form: FormBuilder,
		private $route: ActivatedRoute,
		private $spinner: NgxSpinnerService
	) { }

	ngOnInit(): void {
		if (this.buildVehicleRateSettingsForm()) {
			this.$route.queryParams.subscribe((params: any) => {
				// fetch vehicle info and amenities
				this.SetFormValue('vehicle_id', params.vehicleTypeId)
				this.fetchVehicleInfo(params.vehicleTypeId)
				this.prefillTheForm(params.vehicleTypeId)
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

	/**
	 * Set the specified value into form
	 * 
	 * @params form_control: String [Required] Form Control name
	 * @params value: String [Required] value to be saved in form
	 */
	SetFormValue(form_control: string, value: any) {
		console.log('Setting Value of ', form_control, ': ', value)
		this.VehicleRateSettingsForm.get(form_control).setValue(value)
		this.VehicleRateSettingsForm.updateValueAndValidity()

	}


	/**
	 * Change Detection Functions with minimum functionality 
	 * like saving a form value or assigning a variable
	 */
	changeDetection = {
		radioButton: (value: string, form_control: string) => {
			this.SetFormValue(form_control, value)
			this.applyDistanceValidators(value)
		},
		currencySymbol: (value: any) => {
			for (let key in this.currency_options) {
				if (key == value.currencyCountry) {
					this.currency_symbol = this.currency_options[key]['currency']
				}
			}
		},
		gratuity: (new_value: any, form_control: string) => {
			this.SetFormValue(form_control, new_value ? 'yes' : 'no')
		}
	}

	changeCurrencySymbol(value: any) {
		this.changeDetection.currencySymbol(value)
	}

	km_mile_switch(value: string) {
		this.changeDetection.radioButton(value, 'km_mile');
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
			hourly_rate: [0, [Validators.required, Validators.pattern("^[0-9]*(\.[0-9]+)?$")]],
			hourly_rate_after_five_hours: [0, [Validators.required, Validators.pattern("^[0-9]*(\.[0-9]+)?$")]],
			hours_day_rate: [8, [Validators.pattern("^[0-9]*(\.[0-9]+)?$")]],
			day_rate: [0, [Validators.pattern("^[0-9]*(\.[0-9]+)?$")]],
			km_mile: ['mile', Validators.required],
			milage_rate: ['', [Validators.required, , Validators.pattern(/^\d+(\.\d+)?$/)]],
			upto_miles: ['', [Validators.required, , Validators.pattern(/^\d+(\.\d+)?$/)]],
			after_mileage_rate: ['', [Validators.required, , Validators.pattern(/^\d+(\.\d+)?$/)]],
			kilometer_rate: ['', [Validators.pattern(/^\d+(\.\d+)?$/)]],
			upto_km: ['', [Validators.pattern(/^\d+(\.\d+)?$/)]],
			after_kilometer_rate: ['', [Validators.pattern(/^\d+(\.\d+)?$/)]],
			minimum_airport_departure_rate: [0, [Validators.required, Validators.pattern("^[0-9]*(\.[0-9]+)?$")]],
			minimum_airport_arrival_rate: [0, [Validators.required, Validators.pattern("^[0-9]*(\.[0-9]+)?$")]],
			minimum_city_rate: [0, [Validators.required, Validators.pattern("^[0-9]*(\.[0-9]+)?$")]],
			minimum_cruise_port_arrival_rate: [0, [Validators.required, Validators.pattern("^[0-9]*(\.[0-9]+)?$")]],
			minimum_cruise_port_departure_rate: [0, [Validators.required, Validators.pattern("^[0-9]*(\.[0-9]+)?$")]],
			minimum_on_demand_rate: [0, [Validators.pattern("^[0-9]*(\.[0-9]+)?$")]],
			per_person_group_ride_rate: [0, [Validators.pattern("^[0-9]*(\.[0-9]+)?$")]],
			in_town_extra_stop: [0, [Validators.pattern("^[0-9]*(\.[0-9]+)?$")]],
			outside_town_extra_stop: [0, [Validators.pattern("^[0-9]*(\.[0-9]+)?$")]],
			minimum_charter_hours: [2, [Validators.pattern(/^\d+(\.\d+)?$/)]],
			airport_city_percentage_booking_cancel_charges: [0, [Validators.pattern("^[0-9]*(\.[0-9]+)?$")]],
			early_late_charges: [0, [Validators.pattern("^[0-9]*(\.[0-9]+)?$")]],
			friday_saturday_charges: [0, [Validators.pattern("^[0-9]*(\.[0-9]+)?$")]],
			charter_percentage_booking_cancel_charges: [0, [Validators.pattern("^[0-9]*(\.[0-9]+)?$")]],
			rate_range: ['0'],
			gratuity: ['20', [Validators.required, Validators.pattern("^[0-9+]*$")]],
			is_gratuity: ['yes', Validators.required],
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
			wait_time_cost: [0, [Validators.required, Validators.pattern(/^\d+(\.\d+)?$/)]],
			wait_time_unit: ['minute'],
			wait_time_value: ['15']
		})

		if (this.VehicleRateSettingsForm) {
			this.applyDistanceValidators(this.VehicleRateSettingsForm.get('km_mile')?.value || 'mile')
			return true
		}
		else {
			return false
		}
	}

	prefillTheForm(current_selected_vehicle: number = 0) {
		this.VehicleRateSettingsForm.get('minimum_airport_departure_rate').valueChanges.pipe(
			debounceTime(500) 
			).subscribe(value => {
				console.log('minimum_airport_departure_rate value:', value);

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
		});
		
		// Add this subscription for minimum_cruise_port_arrival_rate
		this.VehicleRateSettingsForm.get('minimum_cruise_port_arrival_rate').valueChanges.pipe(
			debounceTime(500)
		).subscribe(value => {
			console.log('minimum_cruise_port_arrival_rate value:', value);
			
			const departureRate = this.VehicleRateSettingsForm.get('minimum_cruise_port_departure_rate').value;
			
			// Only update departure if it's 0 or null/undefined
			if (departureRate === 0 || departureRate === undefined || departureRate === null) {
				this.VehicleRateSettingsForm.patchValue({ 
					minimum_cruise_port_departure_rate: value 
				});
			}
			// If departure already has a value, do nothing
		});

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

		// fetch previous vehicle rates on edit case
		(current_selected_vehicle != 0 || current_selected_vehicle != null) && this.$api.getMasterVehicleRates(current_selected_vehicle).pipe(
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
				vehicle_id: response.data.vehicle_id,
				hourly_rate: response.data.hourly_rate,
				hourly_rate_after_five_hours: response.data.hourly_rate_after_five_hours,
				hours_day_rate: this.toNumericSelectValue(response.data.hours_day_rate),
				day_rate: response.data.day_rate,
				milage_rate: this.toNumericSelectValue(response.data.milage_rate),
				upto_miles: this.toNumericSelectValue(response.data.upto_miles),
				after_mileage_rate: this.toNumericSelectValue(response.data.after_mileage_rate),
				km_mile: response.data.km_mile,
				kilometer_rate: this.toNumericSelectValue(response.data.kilometer_rate),
				upto_km: this.toNumericSelectValue(response.data.upto_km),
				after_kilometer_rate: this.toNumericSelectValue(response.data.after_kilometer_rate),
				minimum_airport_departure_rate: response.data.minimum_airport_departure_rate,
				minimum_airport_arrival_rate: response.data.minimum_airport_arrival_rate,
				minimum_city_rate: response.data.minimum_city_rate,
				minimum_cruise_port_arrival_rate: response.data.minimum_cruise_port_arrival_rate,
				minimum_cruise_port_departure_rate: response.data.minimum_cruise_port_departure_rate,
				minimum_on_demand_rate: response.data.minimum_on_demand_rate,
				per_person_group_ride_rate: this.toNumericSelectValue(response.data.per_person_group_ride_rate),
				minimum_charter_hours: Number(response.data?.minimum_charter_hours),
				airport_city_percentage_booking_cancel_charges: response.data.airport_city_percentage_booking_cancel_charges,
				early_late_charges: this.toNumericSelectValue(response.data.early_late_charges),
				friday_saturday_charges: this.toNumericSelectValue(response.data.friday_saturday_charges),
				charter_percentage_booking_cancel_charges: response.data.charter_percentage_booking_cancel_charges,
				rate_range_percent_flat: response.data.rate_range_percent_flat,
				gratuity: response.data.gratuity,
				is_gratuity: response.data.is_gratuity,
				airport_arrival_tax_per_us: response.data.airport_arrival_tax_per_us,
				airport_departure_tax_per_us: response.data.airport_departure_tax_per_us,
				sea_port_tax_per_us: response.data.sea_port_tax_per_us,
				city_congestion_tax_per_us: response.data.city_congestion_tax_per_us,
				city_tax: response.data.city_tax,
				city_tax_percent_flat: response.data.city_tax_percent_flat,
				state_tax: response.data.state_tax,
				state_tax_percent_flat: response.data.state_tax_percent_flat,
				vat: response.data.vat,
				vat_percent_flat: response.data.vat_percent_flat,
				workmans_comp: response.data.workmans_comp,
				workman_comp_percent_flat: response.data.workman_comp_percent_flat,
				other_transportation_tax: response.data.other_transportation_tax,
				other_transportation_tax_percent_flat: response.data.other_transportation_tax_percent_flat,
				body_guard_security: response.data.body_guard_security,
				tour_guide: response.data.tour_guide,
				baggage_meet: response.data.baggage_meet,
				lei_greeting_hi: response.data.lei_greeting_hi,
				baby_seat: response.data.baby_seat,
				booster_seat: response.data.booster_seat,
				bike_rack: response.data.bike_rack,
				per_diem: response.data.per_diem,
				in_town_extra_stop: this.toNumericSelectValue(response.data?.in_town_extra_stop),
				outside_town_extra_stop: this.toNumericSelectValue(response.data?.outside_town_extra_stop),
				wait_time_cost: response.data?.wait_time_cost || 0
			});
			this.changeDetection.radioButton(response.data.km_mile ?? 'mile', 'km_mile')
			this.updateRateRangeObject();
		})
		this.initRateRangeObject();
	}

	fetchVehicleInfo(vehicle_id: number = 0): boolean {
		if (vehicle_id == 0 || vehicle_id == null) {
			console.log('Vehicle Not selected. ')
			this.$router.navigate(['/admin/master-vehicle-types'])
			return false
		}
		this.$spinner.show()
		this.$api.getMasterVehicleInfo(vehicle_id).pipe(
			catchError(err => {
				this.$spinner.hide()
				console.error('Error: ', err)
				return throwError(err)
			})
		).subscribe((response: any) => {
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
					if (value.label == 'Booster_Seat' || value.label == 'Baggage_Meet_Dom_' || value.label == 'Baggage_Meet_Int_') {
						(this.AmenitiesRates.get(key) as FormGroup).setValue({ ...value, price: babySeatValue.price });
					}
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
		console.log(this.VehicleRateSettingsForm.value);

		this.normalizeDistancePayload();


		let tree = this.$router.parseUrl(this.$router.url);
		if (tree.root.children.primary.segments[2]) {
			var lastPartUrl = tree.root.children.primary.segments[2].path;
			if (lastPartUrl == 'step5') {
				let currentUser = JSON.parse(localStorage.getItem('currentUser'))
				let stepCompleted = JSON.parse(localStorage.getItem('stepCompleted'))
				if (currentUser.account_id) {
					if (parseInt(stepCompleted) >= 4) {
						this.VehicleRateSettingsForm.patchValue({
							acc_id: currentUser.account_id
						});
					}
				}
			}
		}

		this.is_form_submitted = true;

		// stop here if form is invalid
		console.log(this.VehicleRateSettingsForm)
		if (this.VehicleRateSettingsForm.invalid) {
			this.is_form_submitted = false
			return;
		}

		this.$spinner.show();

		this.$api.editMasterVehicleRates(this.VehicleRateSettingsForm.value)
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


				this.$router.navigate(['/admin/master-vehicle-types'])
			});
	}

	private applyDistanceValidators(distanceType: string) {
		const mileValidators = [Validators.required, Validators.pattern("^[0-9]*(\\.[0-9]+)?$"), Validators.min(2.1), Validators.max(15)];
		const mileDistanceValidators = [Validators.required, Validators.pattern("^[0-9]*(\\.[0-9]+)?$")];
		const kilometerValidators = [Validators.required, Validators.pattern("^[0-9]*(\\.[0-9]+)?$"), Validators.min(1.72), Validators.max(15)];
		const kilometerDistanceValidators = [Validators.required, Validators.pattern("^[0-9]*(\\.[0-9]+)?$")];

		if (distanceType === 'kilometer') {
			this.VehicleRateSettingsForm.get('kilometer_rate')?.setValidators(kilometerValidators);
			this.VehicleRateSettingsForm.get('upto_km')?.setValidators(kilometerDistanceValidators);
			this.VehicleRateSettingsForm.get('after_kilometer_rate')?.setValidators(kilometerValidators);
			this.VehicleRateSettingsForm.get('milage_rate')?.clearValidators();
			this.VehicleRateSettingsForm.get('upto_miles')?.clearValidators();
			this.VehicleRateSettingsForm.get('after_mileage_rate')?.clearValidators();
		} else {
			this.VehicleRateSettingsForm.get('milage_rate')?.setValidators(mileValidators);
			this.VehicleRateSettingsForm.get('upto_miles')?.setValidators(mileDistanceValidators);
			this.VehicleRateSettingsForm.get('after_mileage_rate')?.setValidators(mileValidators);
			this.VehicleRateSettingsForm.get('kilometer_rate')?.clearValidators();
			this.VehicleRateSettingsForm.get('upto_km')?.clearValidators();
			this.VehicleRateSettingsForm.get('after_kilometer_rate')?.clearValidators();
		}

		['milage_rate', 'upto_miles', 'after_mileage_rate', 'kilometer_rate', 'upto_km', 'after_kilometer_rate']
			.forEach((controlName: string) => {
				this.VehicleRateSettingsForm.get(controlName)?.updateValueAndValidity({ emitEvent: false });
			});
	}

	private normalizeDistancePayload() {
		if (this.form.km_mile.value === 'mile') {
			this.VehicleRateSettingsForm.patchValue({
				kilometer_rate: 0,
				upto_km: 0,
				after_kilometer_rate: 0
			}, { emitEvent: false });
			return;
		}

		this.VehicleRateSettingsForm.patchValue({
			milage_rate: 0,
			upto_miles: 0,
			after_mileage_rate: 0
		}, { emitEvent: false });
	}

	private toNumericSelectValue(value: any) {
		if (value === null || value === undefined || value === '') {
			return value;
		}

		const numericValue = Number(value);
		return Number.isNaN(numericValue) ? value : numericValue;
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
		let form_control_names = ['milage_rate', 'upto_miles', 'after_mileage_rate', 'upto_km', 'after_kilometer_rate', 'kilometer_rate', 'hourly_rate', 'hourly_rate_after_five_hours', 'day_rate', 'minimum_city_rate', 'minimum_airport_departure_rate', 'minimum_airport_arrival_rate', 'minimum_cruise_port_arrival_rate', 'minimum_cruise_port_departure_rate', 'airport_city_percentage_booking_cancel_charges', 'early_late_charges', 'friday_saturday_charges', 'per_person_group_ride_rate', 'wait_time_cost']
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
			// console.log(form_name, typeof this.VehicleRateSettingsForm.get(form_name).value)
			this.rate_range_object[form_name] = parseFloat(this.VehicleRateSettingsForm.get(form_name).value.toFixed(2))
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
		const keepValues = [
			this.VehicleRateSettingsForm.controls.acc_id.value,
			this.VehicleRateSettingsForm.controls.id.value,
		]
		const amenitiesSnapshot = JSON.parse(JSON.stringify(this.AmenitiesRates.value));

		this.VehicleRateSettingsForm.reset();

		this.VehicleRateSettingsForm.controls.acc_id.patchValue(keepValues[0]);
		this.VehicleRateSettingsForm.controls.id.patchValue(keepValues[1]);

		// restore name/label for each amenity control (keep price reset if desired)
		Object.keys(amenitiesSnapshot).forEach(key => {
			this.AmenitiesRates.get(key)?.patchValue({
				...amenitiesSnapshot[key],
				price: null 
			});
		});
    }
}
