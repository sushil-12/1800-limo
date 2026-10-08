import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { AdminService } from '../../../services/admin.service';
import { HttpClient } from "@angular/common/http";
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { StateManagementService } from '../../../services/statemanagement.service';
import { NgxSpinnerService } from "ngx-spinner";
import { catchError, debounceTime, finalize } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { AiRateScoreService } from '../../../services/ai-rate-score.service';
declare var $: any;
@Component({
	selector: 'app-add-vehicle-rates',
	templateUrl: './add-vehicle-rates.component.html',
	styleUrls: ['./add-vehicle-rates.component.scss']
})
export class AddVehicleRatesComponent implements OnInit {

	public tree: any;
	public affiliateId: string;
	public paramResponse: any;
	public vehicle_id: string;
	public vehicleTypeId: string;
	public milage_rate_selected: boolean = true;
	public currencyOptions: any = [];
	public currencySymbol: string;
	public vehicleType: string;
	public vehicleColor: string;
	public vehicleMake: string;
	public vehicleModel: string;
	public vehicleYear: string;
	public vehicle_image: string;
	public is_gratuity: string = 'yes';


	public addVehicleRatesForm: FormGroup;
	public submittedForm: boolean;
	public disableSubmitButton: boolean = false;

	public response: any;
	rate_range_object: any = {}
	thumb_value: number = 0;
	relativeVehicleId: any;
	public ratesArrayValues = [0, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100]


	constructor(
		private adminService: AdminService,
		private router: Router,
		private spinner: NgxSpinnerService,
		private stateManagementService: StateManagementService,
		private formBuilder: FormBuilder,
		private activatedroute: ActivatedRoute,
		private httpClient: HttpClient,
		private dialog: MatDialog,
		private aiRateScoreService: AiRateScoreService
	) { }

	/** AI rate suggestions shown inline under each field + an accept bar. */
	aiLoading = false;
	aiError: string | null = null;
	aiSuggestions: Record<string, number> | null = null;
	aiNotes: Record<string, string> | null = null;
	aiScore: number | null = null;
	aiSummary = '';

	/** Fetch AI-suggested rates for the current form values. */
	getAiRates(): void {
		if (!this.addVehicleRatesForm) return;
		this.aiLoading = true;
		this.aiError = null;
		this.aiSuggestions = null;
		this.aiNotes = null;
		this.aiScore = null;
		this.aiSummary = '';

		const payload = {
			rates: this.aiRateScoreService.sanitizeRates(this.addVehicleRatesForm.value),
			vehicleType: this.vehicleType || 'Vehicle',
			currency: this.addVehicleRatesForm.get('currency')?.value || 'USD',
			unit: (this.milage_rate_selected ? 'mile' : 'kilometer') as 'mile' | 'kilometer',
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
			this.addVehicleRatesForm.patchValue(this.aiSuggestions);
			this.addVehicleRatesForm.updateValueAndValidity();
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

	ngOnInit(): void {

		// this.stateManagementService.setprogressBar(true);
		//pick vehicle id from query params
		this.activatedroute.queryParamMap
			.subscribe((params) => {
				this.paramResponse = { ...params.keys, ...params };
				if (this.paramResponse.params?.relativeVehicleId) {
					this.relativeVehicleId = this.paramResponse.params?.relativeVehicleId
				}
				this.vehicle_id = this.paramResponse.params.vehicleId;
			}
			);
		const currentUser = JSON.parse(sessionStorage.getItem("affiliateUserData"));
		this.affiliateId = sessionStorage.getItem("affiliateId");

		//load list of currencies and show selected currency
		this.httpClient.get("assets/json/currencyOptions.json").subscribe(data => {
			this.currencyOptions = data;
			for (const key of Object.keys(this.currencyOptions)) {
				if (key.toLowerCase() == currentUser.CellNumberCountry.toLowerCase()) {
					this.addVehicleRatesForm.patchValue({
						currency: key
					});
					this.changeCurrency(this.currencyOptions[key].symbol);
				}
			}
		})

		//add amenity form validation
		this.addVehicleRatesForm = this.formBuilder.group({
			acc_id: [''],
			affiliate_type: [''],
			vehicle_id: ['', [Validators.required, Validators.pattern("^[0-9+]*$")]],
			currency: ['$', Validators.required],
			hourly_rate: ['', [Validators.required, Validators.pattern(/^\d+(\.\d+)?$/)]],
			minimum_charter_hours: [2, [Validators.pattern(/^\d+(\.\d+)?$/)]],
			hourly_rate_after_five_hours: ['', [Validators.required, Validators.pattern(/^\d+(\.\d+)?$/)]],
			hours_day_rate: [8, [Validators.pattern(/^\d+(\.\d+)?$/)]],
			day_rate: ['', [Validators.pattern(/^\d+(\.\d+)?$/)]],
			km_mile: ['mile', Validators.required],
			milage_rate: [''],
			upto_miles: [''],
			after_mileage_rate: [''],
			kilometer_rate: [''],
			upto_km: [''],
			after_kilometer_rate: [''],
			minimum_airport_departure_rate: ['', [Validators.required, Validators.pattern(/^\d+(\.\d+)?$/)]],
			minimum_airport_arrival_rate: ['', [Validators.required, Validators.pattern(/^\d+(\.\d+)?$/)]],
			minimum_city_rate: ['', [Validators.required, Validators.pattern(/^\d+(\.\d+)?$/)]],
			minimum_cruise_port_arrival_rate: ['', [Validators.pattern(/^\d+(\.\d+)?$/)]],
			minimum_cruise_port_departure_rate: ['', [Validators.pattern(/^\d+(\.\d+)?$/)]],
			minimum_on_demand_rate: ['', [Validators.pattern(/^\d+(\.\d+)?$/)]],
			per_person_group_ride_rate: ['', [Validators.pattern(/^\d+(\.\d+)?$/)]],
			in_town_extra_stop: ['', [Validators.pattern(/^\d+(\.\d+)?$/)]],
			outside_town_extra_stop: ['', [Validators.pattern(/^\d+(\.\d+)?$/)]],
			airport_city_percentage_booking_cancel_charges: ['', [Validators.pattern(/^\d+(\.\d+)?$/)]],
			charter_percentage_booking_cancel_charges: ['', [Validators.pattern(/^\d+(\.\d+)?$/)]],
			gratuity: ['20', [Validators.required, Validators.pattern(/^\d+(\.\d+)?$/)]],
			rate_range: ['', [Validators.pattern(/^\d+(\.\d+)?$/)]],
			is_gratuity: ['yes', Validators.required],
			amenites_rates: new FormGroup({}),
			airport_arrival_tax_per_us: ['', [Validators.pattern(/^\d+(\.\d+)?$/)]],
			airport_departure_tax_per_us: ['', [Validators.pattern(/^\d+(\.\d+)?$/)]],
			sea_port_tax_per_us: ['', [Validators.pattern(/^\d+(\.\d+)?$/)]],
			city_congestion_tax_per_us: ['', [Validators.pattern(/^\d+(\.\d+)?$/)]],
			city_tax_percent_flat: ['flat'],
			state_tax_percent_flat: ['flat'],
			rate_range_percent_flat: ['flat'],
			vat_percent_flat: ['flat'],
			workman_comp_percent_flat: ['flat'],
			other_transportation_tax_percent_flat: ['flat'],
			city_tax: ['', [Validators.pattern(/^\d+(\.\d+)?$/)]],
			state_tax: ['', [Validators.pattern(/^\d+(\.\d+)?$/)]],
			vat: ['', [Validators.pattern(/^\d+(\.\d+)?$/)]],
			workmans_comp: ['', [Validators.pattern(/^\d+(\.\d+)?$/)]],
			other_transportation_tax: ['', [Validators.pattern("^[0-9+]*$")]],
			early_late_charges: [0, [Validators.pattern("^[0-9]*(\.[0-9]+)?$")]],

			friday_saturday_charges: [0, [Validators.pattern("^[0-9]*(\.[0-9]+)?$")]],
			wait_time_cost: [0, [Validators.required, Validators.pattern(/^\d+(\.\d+)?$/)]],
			wait_time_unit: ['minute'],
			wait_time_value: ['15']
		});
		//autopopulate values of departure in arrival
		this.addVehicleRatesForm.get('minimum_airport_departure_rate').valueChanges.pipe(
							debounceTime(500) 
							).subscribe(value => {
								console.log('minimum_airport_departure_rate value:', value);
				
								const arrivalRate = this.addVehicleRatesForm.get('minimum_airport_arrival_rate').value;
								const cityRate = this.addVehicleRatesForm.get('minimum_city_rate').value;
								const cruiseArrivalRate = this.addVehicleRatesForm.get('minimum_cruise_port_arrival_rate').value;
								const cruiseDepartureRate = this.addVehicleRatesForm.get('minimum_cruise_port_departure_rate').value;
				
								if (arrivalRate === 0 || arrivalRate === undefined || arrivalRate === null) {
									this.addVehicleRatesForm.patchValue({ minimum_airport_arrival_rate: value });
								}
								if (cityRate === 0 || cityRate === undefined || cityRate === null) {
									this.addVehicleRatesForm.patchValue({ minimum_city_rate: value });
								}
								if (cruiseArrivalRate === 0 || cruiseArrivalRate === undefined || cruiseArrivalRate === null) {
									this.addVehicleRatesForm.patchValue({ minimum_cruise_port_arrival_rate: value });
								}
								if (cruiseDepartureRate === 0 || cruiseDepartureRate === undefined || cruiseDepartureRate === null) {
									this.addVehicleRatesForm.patchValue({ minimum_cruise_port_departure_rate: value });
								}
	 });
		this.addVehicleRatesForm.get('hourly_rate').valueChanges.subscribe(
			value => {
				this.addVehicleRatesForm.patchValue({ hourly_rate_after_five_hours: value });
			}
		);


		this.addVehicleRatesForm.get('hourly_rate').valueChanges.subscribe(
			value => {
				this.dayRateCalculations();
			}
		);
		this.addVehicleRatesForm.get('hourly_rate_after_five_hours').valueChanges.subscribe(
			value => {
				this.dayRateCalculations();
			}
		);
		this.addVehicleRatesForm.get('hours_day_rate').valueChanges.subscribe(
			value => {
				this.dayRateCalculations();
			}
		);

		if (this.relativeVehicleId) {
			this.getVehicleRates(this.relativeVehicleId)
			this.adminService.getVehicleInfo(this.vehicle_id, this.relativeVehicleId)
				.pipe(
					catchError(err => {
						// this.stateManagementService.setprogressBar(false);
						return throwError(err);
					})
				).subscribe(({ data }: any) => {
					if (data.amenities) {
						Object.entries(data.amenities).forEach(
							([key, value]) => {
								console.log(key, value)
								this.amenites_rates.addControl(key, this.createItem(value))
							}
						);
					}
					console.log(this.amenites_rates.controls, "?????????????????????????????")
					this.vehicleType = data.vehicleType;
					this.vehicleColor = data.vehicleColor;
					this.vehicleMake = data.vehicleMake;
					this.vehicleModel = data.vehicleModel;
					this.vehicleYear = data.vehicleYear;
					this.vehicle_image = data.vehicle_image;
					// this.stateManagementService.setprogressBar(false);
				});
		}
		else {
			// fetch rates to fill based upon master vehicle
			this.adminService.getVehicleInfo(this.vehicle_id)
			.pipe(
				catchError(err => {
					// this.stateManagementService.setprogressBar(false);
					return throwError(err);
				})
			).subscribe(({ data }: any) => {
				if (data.amenities) {
					Object.entries(data.amenities).forEach(
						([key, value]) => {
							console.log(key, value)
							this.amenites_rates.addControl(key, this.createItem(value))
						}
					);
				}
				console.log(this.amenites_rates.controls, "?????????????????????????????")
				this.vehicleType = data.vehicleType;
				this.vehicleColor = data.vehicleColor;
				this.vehicleMake = data.vehicleMake;
				this.vehicleModel = data.vehicleModel;
				this.vehicleYear = data.vehicleYear;
				this.vehicle_image = data.vehicle_image;
				// this.stateManagementService.setprogressBar(false);
			});
			this.getVehicleRates(this.vehicle_id)
		}



		this.km_mile_switch('mile');
		this.initRateRangeObject();
		this.updateRateRangeObject()
	}

	getVehicleRates(id) {
		const currentUser = JSON.parse(localStorage.getItem("currentUser"));
		//get vehicle rates
		this.adminService.getVehicleRates(id)
			.pipe(
				catchError(err => {
					// this.stateManagementService.setprogressBar(false);
					return throwError(err);
				})
			).subscribe(result => {
				this.response = result;
				if (this.response.data == null) {
					//load list of currencies
					this.httpClient.get("assets/json/currencyOptions.json").subscribe(data => {
						this.currencyOptions = data;
						for (const key of Object.keys(this.currencyOptions)) {
							if (key.toLowerCase() == currentUser.CellNumberCountry.toLowerCase()) {
								this.addVehicleRatesForm.patchValue({
									currency: key
								});
								this.changeCurrency(this.currencyOptions[key].symbol);
							}
						}
					})
					// this.stateManagementService.setprogressBar(false);
					return false;
				}

				//load list of currencies and show selected currency
				this.httpClient.get("assets/json/currencyOptions.json").subscribe(data => {
					this.currencyOptions = data;
					//show selected currency symbol on all fields 
					for (const key of Object.keys(this.currencyOptions)) {
						if (key == this.response.data.currency) {
							this.changeCurrency(this.currencyOptions[key].symbol);
						}
					}
					//patch currency value to show currency selected
					this.addVehicleRatesForm.patchValue({
						currency: this.response.data.currency
					});
				})
				// set Gratutity
				this.is_gratuity = this.response.data.is_gratuity;

				this.addVehicleRatesForm.patchValue({
					id: this.response.data.id,
					vehicle_id: this.response.data.vehicle_id,
					hourly_rate: this.response.data.hourly_rate,
					minimum_charter_hours: Number(this.response.data?.minimum_charter_hours),
					hourly_rate_after_five_hours: this.response.data.hourly_rate_after_five_hours,
					hours_day_rate: this.response.data.hours_day_rate,
					day_rate: this.response.data.day_rate,
					milage_rate: this.response.data.milage_rate,
					upto_miles: this.response.data.upto_miles,
					after_mileage_rate: this.response.data.after_mileage_rate,
					km_mile: this.response.data.km_mile,
					kilometer_rate: this.response.data.kilometer_rate,
					upto_km: this.response.data.upto_km,
					after_kilometer_rate: this.response.data.after_kilometer_rate,
					minimum_airport_departure_rate: this.response.data.minimum_airport_departure_rate,
					minimum_airport_arrival_rate: this.response.data.minimum_airport_arrival_rate,
					minimum_city_rate: this.response.data.minimum_city_rate,
					minimum_cruise_port_arrival_rate: this.response.data.minimum_cruise_port_arrival_rate,
					minimum_cruise_port_departure_rate: this.response?.data?.minimum_cruise_port_departure_rate,
					minimum_on_demand_rate: this.response.data.minimum_on_demand_rate,
					per_person_group_ride_rate: this.response.data.per_person_group_ride_rate,
					airport_city_percentage_booking_cancel_charges: this.response.data.airport_city_percentage_booking_cancel_charges,
					charter_percentage_booking_cancel_charges: this.response.data.charter_percentage_booking_cancel_charges,
					gratuity: this.response.data.gratuity,
					is_gratuity: this.response.data.is_gratuity,
					rate_range_percent_flat: this.response.data.rate_range_percent_flat,
					rate_range: this.response.data.rate_range,
					airport_arrival_tax_per_us: this.response.data.airport_arrival_tax_per_us,
					airport_departure_tax_per_us: this.response.data.airport_departure_tax_per_us,
					sea_port_tax_per_us: this.response.data.sea_port_tax_per_us,
					city_congestion_tax_per_us: this.response.data.city_congestion_tax_per_us,
					city_tax: this.response.data.city_tax,
					city_tax_percent_flat: this.response.data.city_tax_percent_flat,
					state_tax: this.response.data.state_tax,
					state_tax_percent_flat: this.response.data.state_tax_percent_flat,
					vat: this.response.data.vat,
					vat_percent_flat: this.response.data.vat_percent_flat,
					workmans_comp: this.response.data.workmans_comp,
					workman_comp_percent_flat: this.response.data.workman_comp_percent_flat,
					other_transportation_tax: this.response.data.other_transportation_tax,
					other_transportation_tax_percent_flat: this.response.data.other_transportation_tax_percent_flat,
					body_guard_security: this.response.data.body_guard_security,
					tour_guide: this.response.data.tour_guide,
					baggage_meet: this.response.data.baggage_meet,
					lei_greeting_hi: this.response.data.lei_greeting_hi,
					baby_seat: this.response.data.baby_seat,
					booster_seat: this.response.data.booster_seat,
					bike_rack: this.response.data.bike_rack,
					per_diem: this.response.data.per_diem,
					early_late_charges: this.response.data.early_late_charges,
					friday_saturday_charges: this.response.data.friday_saturday_charges,
					in_town_extra_stop: this.response.data?.in_town_extra_stop,
					outside_town_extra_stop: this.response.data?.outside_town_extra_stop,
					wait_time_cost: this.response.data?.wait_time_cost || 0
				});
				this.km_mile_switch(this.response.data.km_mile);//show selected input field 
				// this.stateManagementService.setprogressBar(false);
				this.updateRateRangeObject()
			});
	}


	changeGraruity(e) {
		if (e.checked) {
			this.addVehicleRatesForm.patchValue({
				is_gratuity: 'yes'
			});
		} else {
			this.addVehicleRatesForm.patchValue({
				is_gratuity: 'no'
			});
		}
	}
	handleChangeMCPAR(value) {

		this.addVehicleRatesForm.patchValue({
			minimum_cruise_port_departure_rate: value ? value : null
		})
	}

	changeAmenityRate(babySeatKey, babySeatValue) {
		//changes in amenity rates formGroup
		if (babySeatValue.label == 'Baby_Seat') {
			Object.entries(this.addVehicleRatesForm.value.amenites_rates).forEach(
				([key, value]: any) => {
					if (value.label == 'Booster_Seat' || value.label == 'Baggage_Meet_Dom_' || value.label == 'Baggage_Meet_Int_') {
						(this.amenites_rates.get(key) as FormGroup).setValue({ ...value, price: babySeatValue.price });
					}
				});
		}
	}
	get form() {
		return this.addVehicleRatesForm.controls
	}
	changeThumb(value: number, style?: string) {
		if (style == '+') {
			this.getRateRange(this.thumb_value + value)
		}
		if (style == '-') {
			this.getRateRange(this.thumb_value - value)
		}
	}


	/**
	 * build a new object with keys as the form control names and and values as the value of those controls.
	 */
	initRateRangeObject(): boolean {
		let form_control_names = ['milage_rate', 'upto_miles', 'after_mileage_rate', 'upto_km', 'after_kilometer_rate', 'kilometer_rate', 'hourly_rate', 'hourly_rate_after_five_hours',
			'day_rate', 'minimum_city_rate', 'minimum_airport_departure_rate', 'minimum_airport_arrival_rate',
			'minimum_cruise_port_arrival_rate', 'minimum_cruise_port_departure_rate', 'in_town_extra_stop', 'outside_town_extra_stop',
			'airport_city_percentage_booking_cancel_charges', 'per_person_group_ride_rate', 'wait_time_cost']
		form_control_names.forEach((name: string) => {
			this.rate_range_object[name] = this.addVehicleRatesForm.get(name).value ?? 0
		})
		console.log('Rate Range Object Initialised ', this.rate_range_object)
		return true
	}
	updateRateRangeObject() {
		for (let form_name in this.rate_range_object) {
			try {
				// console.log(form_name,typeof this.addVehicleRatesForm.get(form_name).value)
				this.rate_range_object[form_name] = parseFloat(this.addVehicleRatesForm.get(form_name).value.toFixed(2))
			}
			catch (err) {
				console.log(form_name, typeof this.addVehicleRatesForm.get(form_name).value, err)
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
 * Set the specified value into form
 * 
 * @params form_control: String [Required] Form Control name
 * @params value: String [Required] value to be saved in form
 */
	SetFormValue(form_control: string, value: any) {
		console.info('Setting Value of ', form_control, ': ', value)
		this.addVehicleRatesForm.get(form_control).setValue(value)
		this.addVehicleRatesForm.updateValueAndValidity()
	}

	get amenites_rates() {
		const amenites_rates = this.addVehicleRatesForm.get("amenites_rates") as FormGroup;
		return amenites_rates;
	}

	// show amenity rates only when the vehicle has chargeable amenities selected
	get hasChargeableAmenities(): boolean {
		return Object.keys(this.amenites_rates?.controls || {}).length > 0
	}
	createItem(e): FormGroup {
		return this.formBuilder.group({ ...e });
	}

	km_mile_switch(km_mile) {
		switch (km_mile) {
			case 'kilometer': {
				this.milage_rate_selected = false;
				console.log('set validator for km')
				this.addVehicleRatesForm.get('kilometer_rate')?.setValidators([Validators.required, Validators.pattern("^[0-9]*(\.[0-9]+)?$"), Validators.min(1.72), Validators.max(15)]); // Set back the validator
				this.addVehicleRatesForm.get('upto_km')?.setValidators([Validators.required, Validators.pattern("^[0-9]*(\.[0-9]+)?$")]); // Set back the validator
				this.addVehicleRatesForm.get('after_kilometer_rate')?.setValidators([Validators.required, Validators.pattern("^[0-9]*(\.[0-9]+)?$"), Validators.min(1.72), Validators.max(15)]); // Set back the validator	
				this.addVehicleRatesForm.get('milage_rate')?.clearValidators(); // Clear the validator
				this.addVehicleRatesForm.get('upto_miles')?.clearValidators(); // Clear the validator
				this.addVehicleRatesForm.get('after_mileage_rate')?.clearValidators(); // Clear the validator
				this.addVehicleRatesForm.get('kilometer_rate')?.updateValueAndValidity();
				this.addVehicleRatesForm.get('upto_km')?.updateValueAndValidity();
				this.addVehicleRatesForm.get('after_kilometer_rate')?.updateValueAndValidity();
				this.addVehicleRatesForm.get('milage_rate')?.updateValueAndValidity();
				this.addVehicleRatesForm.get('upto_miles')?.updateValueAndValidity();
				this.addVehicleRatesForm.get('after_mileage_rate')?.updateValueAndValidity();
				break;
			}
			case 'mile': {
				this.milage_rate_selected = true;
				this.addVehicleRatesForm.get('milage_rate')?.setValidators([Validators.required, Validators.pattern("^[0-9]*(\.[0-9]+)?$"), Validators.min(2.1), Validators.max(15)]); // Set back the validator
				this.addVehicleRatesForm.get('upto_miles')?.setValidators([Validators.required, Validators.pattern("^[0-9]*(\.[0-9]+)?$")]); // Set back the validator
				this.addVehicleRatesForm.get('after_mileage_rate')?.setValidators([Validators.required, Validators.pattern("^[0-9]*(\.[0-9]+)?$"), Validators.min(2.1), Validators.max(15)]); // Set back the validator
				this.addVehicleRatesForm.get('kilometer_rate')?.clearValidators();
				this.addVehicleRatesForm.get('upto_km')?.clearValidators();
				this.addVehicleRatesForm.get('after_kilometer_rate')?.clearValidators();
				this.addVehicleRatesForm.get('milage_rate')?.updateValueAndValidity();
				this.addVehicleRatesForm.get('upto_miles')?.updateValueAndValidity();
				this.addVehicleRatesForm.get('after_mileage_rate')?.updateValueAndValidity();
				this.addVehicleRatesForm.get('kilometer_rate')?.updateValueAndValidity();
				this.addVehicleRatesForm.get('upto_km')?.updateValueAndValidity();
				this.addVehicleRatesForm.get('after_kilometer_rate')?.updateValueAndValidity();
				break;
			}
		}
		this.addVehicleRatesForm.controls['milage_rate'].updateValueAndValidity();
		this.addVehicleRatesForm.controls['kilometer_rate'].updateValueAndValidity();
	}

	dayRateCalculations() {
		let dayRateValue = (this.addVehicleRatesForm.get('hourly_rate').value * 5) + (this.addVehicleRatesForm.get('hourly_rate_after_five_hours').value * (this.addVehicleRatesForm.get('hours_day_rate').value - 5));
		this.addVehicleRatesForm.patchValue({
			day_rate: dayRateValue
		});
	}

	changeCurrencySymbol(selectedCountryCode) {
		for (const key of Object.keys(this.currencyOptions)) {
			if (key == selectedCountryCode) {
				this.changeCurrency(this.currencyOptions[key].symbol);
			}
		}
	}
	changeCurrency(selectedCountrySymbol) {
		this.currencySymbol = selectedCountrySymbol;
	}
	get f() {
		return this.addVehicleRatesForm.controls;
	}

	IsZeroValidator(value: any, form_control: string) {
		if (value == 0) {
			this.addVehicleRatesForm.get(form_control).setValue(null);
			this.addVehicleRatesForm.updateValueAndValidity();
			return true;
		}
		return false;
	}

	/** Both cruise port rates cannot be 0 — at least one must have a value > 0 */
	bothCruisePortRatesZero(): boolean {
		const arrival = this.addVehicleRatesForm?.get('minimum_cruise_port_arrival_rate')?.value;
		const departure = this.addVehicleRatesForm?.get('minimum_cruise_port_departure_rate')?.value;
		const a = parseFloat(arrival);
		const d = parseFloat(departure);
		return (isNaN(a) || a === 0) && (isNaN(d) || d === 0);
	}

	submitForm() {
		this.submittedForm = true;
		this.addVehicleRatesForm.patchValue({
			vehicle_id: this.vehicle_id
		});
		// stop here if form is invalid
		if (this.addVehicleRatesForm.invalid) {
			return;
		}
		if (this.bothCruisePortRatesZero()) {
			return;
		}
		this.addVehicleRatesForm.value.stepCompleted = this.adminService.getUpdatedStepsLocal('5');

		this.spinner.show();
		this.disableSubmitButton = true; //disable submit button 

		this.adminService.addVehicleRates(this.addVehicleRatesForm.value)
			.pipe(
				catchError(err => {
					this.spinner.hide();//hide spinner
					this.disableSubmitButton = false; //disable submit button
					return throwError(err);
				})
			)
			.subscribe(({ success, data }: any) => {
				this.spinner.hide();//hide spinner
				this.disableSubmitButton = true; //disable submit button

				if (success == true) {
					this.adminService.updateStepsLocal('5');
				}
				if (data.msg) {
					sessionStorage.setItem('msg', data.msg)
				}
				this.router.navigateByUrl('/', { skipLocationChange: true }).then(() =>
					this.router.navigate(['/admin/affiliate/step5'])
				);
			});
	}

	resetForm() {
		this.addVehicleRatesForm.reset();
	}
}
