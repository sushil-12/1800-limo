import { Component, OnInit, AfterViewChecked } from '@angular/core';
import { AffiliateService } from '../../../services/affiliate.service';
import { HttpClient } from "@angular/common/http";
import { FormGroup, FormBuilder, Validators, FormArray, FormControl } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { StateManagementService } from '../../../services/statemanagement.service';
import { NgxSpinnerService } from "ngx-spinner";
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
declare var $: any;

@Component({
	selector: 'app-add-vehicle-rates-from-affiliate',
	templateUrl: './add-vehicle-rates-from-affiliate.component.html',
	styleUrls: ['./add-vehicle-rates-from-affiliate.component.scss']
})
export class AddVehicleRatesFromAffiliateComponent implements OnInit
{

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

	constructor(
		private affiliateService: AffiliateService,
		private router: Router,
		private spinner: NgxSpinnerService,
		private stateManagementService: StateManagementService,
		private formBuilder: FormBuilder,
		private activatedroute: ActivatedRoute,
		private httpClient: HttpClient) { }

	// ngAfterViewChecked()
	// {
	// 	$(".backbutton").tooltip({
	// 		trigger: 'hover'
	// 	});
	// 	$(".backbutton").on('mouseleave', function ()
	// 	{
	// 		$(this).tooltip('dispose');
	// 	});
	// 	$(".backbutton").on('click', function ()
	// 	{
	// 		$(this).tooltip('dispose');
	// 	});
	// }

	ngOnInit(): void
	{

		this.spinner.show() //show spinner
		//pick vehicle id from query params
		this.activatedroute.queryParamMap
			.subscribe((params) =>
			{
				this.paramResponse = { ...params.keys, ...params };
				this.vehicle_id = this.paramResponse.params.vehicleId;
			}
			);
		const currentUser = JSON.parse(localStorage.getItem("currentUser"));
		this.affiliateId = currentUser.account_id;

		//load list of currencies and show selected currency
		this.httpClient.get("assets/json/currencyOptions.json").subscribe(data =>
		{
			this.currencyOptions = data;
			for (const key of Object.keys(this.currencyOptions))
			{
				if (key.toLowerCase() == currentUser.phoneCountry.toLowerCase())
				{
					this.addVehicleRatesForm.patchValue({
						currency: key
					});
					this.changeCurrency(this.currencyOptions[key].symbol);
				}
			}
		})

		//add addVehicleRates form validation
		this.addVehicleRatesForm = this.formBuilder.group({
			acc_id: [''],
			vehicle_id: ['', [Validators.required, Validators.pattern("^[0-9+]*$")]],
			currency: ['$', Validators.required],
			hourly_rate: ['', [Validators.required, Validators.pattern("^[0-9]*(\.[0-9]+)?$")]],
			minimum_charter_hours:['2', [Validators.required, Validators.pattern("^[0-9]*(\.[0-9]+)?$")]],
			hourly_rate_after_five_hours: ['', [Validators.required, Validators.pattern("^[0-9]*(\.[0-9]+)?$")]],
			hours_day_rate: [8, [Validators.pattern("^[0-9]*(\.[0-9]+)?$")]],
			day_rate: ['', [Validators.pattern("^[0-9]*(\.[0-9]+)?$")]],
			km_mile: ['mile', Validators.required],
			milage_rate: ['', [Validators.pattern("^[0-9]*(\.[0-9]+)?$")]],
			kilometer_rate: ['', [Validators.pattern("^[0-9]*(\.[0-9]+)?$")]],
			minimum_airport_departure_rate: ['', [Validators.required, Validators.pattern("^[0-9]*(\.[0-9]+)?$")]],
			minimum_airport_arrival_rate: ['', [Validators.required, Validators.pattern("^[0-9]*(\.[0-9]+)?$")]],
			minimum_city_rate: ['', [Validators.required, Validators.pattern("^[0-9]*(\.[0-9]+)?$")]],
			minimum_cruise_port_arrival_rate: ['', [Validators.required, Validators.pattern("^[0-9]*(\.[0-9]+)?$")]],
			minimum_on_demand_rate: ['', [Validators.pattern("^[0-9]*(\.[0-9]+)?$")]],
			per_person_group_ride_rate: ['', [Validators.pattern("^[0-9]*(\.[0-9]+)?$")]],
			airport_city_percentage_booking_cancel_charges: ['', [Validators.pattern("^[0-9]*(\.[0-9]+)?$")]],
			early_late_charges: ['', [Validators.pattern("^[0-9]*(\.[0-9]+)?$")]],
			friday_saturday_charges: ['', [Validators.pattern("^[0-9]*(\.[0-9]+)?$")]],
			charter_percentage_booking_cancel_charges: ['', [Validators.pattern("^[0-9]*(\.[0-9]+)?$")]],
			rate_range: ['0'],
			gratuity: ['20', [Validators.required, Validators.pattern("^[0-9+]*$")]],
			is_gratuity: ['yes', Validators.required],
			amenities_rates: new FormGroup({}),
			airport_arrival_tax_per_us: ['', [Validators.pattern("^[0-9]*(\.[0-9]+)?$")]],
			airport_departure_tax_per_us: ['', [Validators.pattern("^[0-9]*(\.[0-9]+)?$")]],
			sea_port_tax_per_us: ['', [Validators.pattern("^[0-9]*(\.[0-9]+)?$")]],
			city_congestion_tax_per_us: ['', [Validators.pattern("^[0-9]*(\.[0-9]+)?$")]],
			rate_range_percent_flat: ['flat'],
			city_tax_percent_flat: ['flat'],
			state_tax_percent_flat: ['flat'],
			vat_percent_flat: ['flat'],
			workman_comp_percent_flat: ['flat'],
			other_transportation_tax_percent_flat: ['flat'],
			city_tax: ['', [Validators.pattern("^[0-9]*(\.[0-9]+)?$")]],
			state_tax: ['', [Validators.pattern("^[0-9]*(\.[0-9]+)?$")]],
			vat: ['', [Validators.pattern("^[0-9]*(\.[0-9]+)?$")]],
			workmans_comp: ['', [Validators.pattern("^[0-9]*(\.[0-9]+)?$")]],
			other_transportation_tax: ['', [Validators.pattern("^[0-9]*(\.[0-9]+)?$")]]
		});

		this.initRateRangeObject()

		//autopopulate values of departure in arrival
		this.addVehicleRatesForm.get('minimum_airport_departure_rate').valueChanges.subscribe(
			value =>
			{
				this.addVehicleRatesForm.patchValue({ minimum_airport_arrival_rate: value });
			}
		);
		this.addVehicleRatesForm.get('hourly_rate').valueChanges.subscribe(
			value =>
			{
				this.addVehicleRatesForm.patchValue({ hourly_rate_after_five_hours: value });
			}
		);

		this.addVehicleRatesForm.get('hourly_rate').valueChanges.subscribe(
			value =>
			{
				this.dayRateCalculations();
			}
		);
		this.addVehicleRatesForm.get('hourly_rate_after_five_hours').valueChanges.subscribe(
			value =>
			{
				this.dayRateCalculations();
			}
		);
		this.addVehicleRatesForm.get('hours_day_rate').valueChanges.subscribe(
			value =>
			{
				this.dayRateCalculations();
			}
		);

		//get selected amenities to show fields
		this.affiliateService.getVehicleInfo(this.vehicle_id)
			.pipe(
				catchError(err =>
				{
					this.spinner.hide() //hide spinner
					return throwError(err);
				})
			).subscribe(({ data }: any) =>
			{
				if (data.amenities)
				{
					Object.entries(data.amenities).forEach(
						([key, value]) =>
						{
							this.amenities_rates.addControl(key, this.createItem(value))
						}
					);
				}
				this.vehicleType = data.vehicleType;
				this.vehicleColor = data.vehicleColor;
				this.vehicleMake = data.vehicleMake;
				this.vehicleModel = data.vehicleModel;
				this.vehicleYear = data.vehicleYear;
				this.vehicle_image = data.vehicle_image;
				this.spinner.hide() //hide spinner
			});
		this.km_mile_switch('mile');
	}
	// ngOnInit ends

	changeGraruity(e)
	{
		if (e.checked)
		{
			this.addVehicleRatesForm.patchValue({
				is_gratuity: 'yes'
			});
		} else
		{
			this.addVehicleRatesForm.patchValue({
				is_gratuity: 'no'
			});
		}
	}

	changeAmenityRate(babySeatKey, babySeatValue)
	{
		//changes in amenity rates formGroup
		if (babySeatValue.label == 'Baby_Seat')
		{
			Object.entries(this.addVehicleRatesForm.value.amenities_rates).forEach(
				([key, value]: any) =>
				{
					if (value.label == 'Booster_Seat' || value.label == 'Baggage_Meet_Dom_' || value.label == 'Baggage_Meet_Int_')
					{
						(this.amenities_rates.get(key) as FormGroup).setValue({ ...value, price: babySeatValue.price });
					}
				});
		}
	}

	get amenities_rates()
	{
		const amenities_rates = this.addVehicleRatesForm.get("amenities_rates") as FormGroup;
		return amenities_rates;
	}

	// show amenity rates only when the vehicle has chargeable amenities selected
	get hasChargeableAmenities(): boolean
	{
		return Object.keys(this.amenities_rates?.controls || {}).length > 0
	}
	createItem(e): FormGroup
	{
		return this.formBuilder.group({ ...e });
	}

	km_mile_switch(km_mile)
	{
		switch (km_mile)
		{
			case 'kilometer': {
				this.milage_rate_selected = false;
				this.addVehicleRatesForm.controls['kilometer_rate'].setValidators([Validators.required, Validators.pattern("^[0-9]*(\.[0-9]+)?$")]);
				this.addVehicleRatesForm.controls['milage_rate'].clearValidators();
				break;
			}
			case 'mile': {
				this.milage_rate_selected = true;
				this.addVehicleRatesForm.controls['milage_rate'].setValidators([Validators.required, Validators.pattern("^[0-9]*(\.[0-9]+)?$")]);
				this.addVehicleRatesForm.controls['kilometer_rate'].clearValidators();
				break;
			}
		}
		this.addVehicleRatesForm.controls['milage_rate'].updateValueAndValidity();
		this.addVehicleRatesForm.controls['kilometer_rate'].updateValueAndValidity();
	}

	dayRateCalculations()
	{
		let dayRateValue = (this.addVehicleRatesForm.get('hourly_rate').value * 5) + (this.addVehicleRatesForm.get('hourly_rate_after_five_hours').value * (this.addVehicleRatesForm.get('hours_day_rate').value - 5));
		this.addVehicleRatesForm.patchValue({
			day_rate: dayRateValue
		});
	}

	changeCurrencySymbol(selectedCountryCode)
	{
		for (const key of Object.keys(this.currencyOptions))
		{
			if (key == selectedCountryCode)
			{
				this.changeCurrency(this.currencyOptions[key].symbol);
			}
		}
	}
	changeCurrency(selectedCountrySymbol)
	{
		this.currencySymbol = selectedCountrySymbol;
	}

	get f()
	{
		return this.addVehicleRatesForm.controls;
	}

	submitForm()
	{
		this.submittedForm = true;
		this.addVehicleRatesForm.patchValue({
			vehicle_id: this.vehicle_id
		});
		// stop here if form is invalid
		if (this.addVehicleRatesForm.invalid)
		{
			return;
		}
		this.addVehicleRatesForm.value.stepCompleted = this.affiliateService.getUpdatedStepsLocal('5');

		this.spinner.show();
		this.disableSubmitButton = true; //disable submit button

		this.affiliateService.addVehicleRates(this.addVehicleRatesForm.value)
			.pipe(
				catchError(err =>
				{
					this.spinner.hide();//hide spinner
					this.disableSubmitButton = false; //disable submit button
					return throwError(err);
				})
			)
			.subscribe(({ success, data }: any) =>
			{
				this.spinner.hide();//hide spinner
				this.disableSubmitButton = true; //disable submit button

				if (success == true)
				{
					this.affiliateService.updateStepsLocal('5');
				}
				if (data.msg)
				{
					sessionStorage.setItem('msg', data.msg)
				}
				this.router.navigateByUrl('/', { skipLocationChange: true }).then(() =>
					this.router.navigate(['/affiliate/step6'])
				);
			});
	}
	// slider function
	// autoTicks = false;
	// disabled = false;
	// invert = false;
	// max = 100;
	// min = 0;
	// showTicks = false;
	// step = 1;
	// thumbLabel = false;
	// value = 0;
	// vertical = false;
	// tickInterval = 1;


	rate_range_object: any = {}
	initRateRangeObject()
	{
		let form_control_names = ['milage_rate', 'kilometer_rate', 'hourly_rate', 'hourly_rate_after_five_hours', 'day_rate', 'minimum_city_rate', 'minimum_airport_departure_rate', 'minimum_airport_arrival_rate', 'minimum_cruise_port_arrival_rate', 'airport_city_percentage_booking_cancel_charges', 'early_late_charges', 'friday_saturday_charges', 'per_person_group_ride_rate']
		form_control_names.forEach((name: string) =>
		{
			this.rate_range_object[name] = this.addVehicleRatesForm.get(name).value ?? 0
		})
		console.log(this.rate_range_object)
	}

	updateRateRangeObject(form_name: string)
	{
		this.rate_range_object[form_name] = parseInt(this.addVehicleRatesForm.get(form_name).value)
		console.log(this.rate_range_object)
	}

	getRateRange(range_value: number)
	{
		// console.log(range_value)
		this.setFormValue('rate_range', range_value)
		// --------- For Flat ------------------
		if (this.addVehicleRatesForm.get('rate_range_percent_flat').value == 'flat')
		{
			// for neutral
			if (range_value == 0)
			{
				for (const key in this.rate_range_object)
				{
					this.setFormValue(key, this.rate_range_object[key])
				}
			}

			// for negative side indicator
			if (range_value < 0)
			{
				for (const key in this.rate_range_object)
				{
					this.rate_range_object[key] == null && this.setFormValue(key, 0)	// set 0 if null

					// decrease by number and set value upto two decimal places and update
					let value = Math.round(Number.EPSILON + (this.rate_range_object[key] - Math.abs(range_value)) * 100) / 100
					this.setFormValue(key, value)
				}
			}

			// for positive side indicator
			if (range_value > 0)
			{
				for (const key in this.rate_range_object)
				{
					this.rate_range_object[key] == null && this.setFormValue(key, 0) 	// set 0 if null

					// increase by number and set value upto two decimal places and update
					let value = Math.round(Number.EPSILON + (this.rate_range_object[key] + Math.abs(range_value)) * 100) / 100
					this.setFormValue(key, value)
				}
			}
		}
		// -------------- For Percentage ------------------
		else
		{
			// for neutral
			if (range_value == 0)
			{
				for (const key in this.rate_range_object)
				{
					this.setFormValue(key, this.rate_range_object[key])
				}
			}
			// for negative side indicator
			if (range_value < 0)
			{
				console.log('Negative: ', range_value)
				for (const key in this.rate_range_object)
				{
					this.rate_range_object[key] == null && this.setFormValue(key, 0)	// set 0 if null

					// decrease by percentage and set value upto two decimal places and update
					let percentage_value = this.rate_range_object[key] - (this.rate_range_object[key] * Math.abs(range_value) / 100)
					let value = Math.round(Number.EPSILON + percentage_value * 100) / 100
					this.setFormValue(key, value)
				}
			}

			// for positive side indicator
			if (range_value > 0)
			{
				console.log('Positive: ', range_value)
				for (const key in this.rate_range_object)
				{
					this.rate_range_object[key] == null && this.setFormValue(key, 0)	// set 0 if null

					// decrease by percentage and set value upto two decimal places and update
					let percentage_value = this.rate_range_object[key] + (this.rate_range_object[key] * Math.abs(range_value) / 100)
					let value = Math.round(Number.EPSILON + percentage_value * 100) / 100
					this.setFormValue(key, value)
				}
			}
		}
	}
	setFormValue(form_control: string, value: any)
	{
		// if value exceeds limit, (0 > value > 1000000) do not assign into form
		if (typeof value == 'number' && (Math.round(value * 100) < 0 || Math.round(value * 100) > 1000000))
		{
			return
		}
		this.addVehicleRatesForm.get(form_control).setValue(value)
		this.addVehicleRatesForm.updateValueAndValidity()
	}

	resetThumb()
	{
		this.setFormValue('rate_range', 0)
		this.getRateRange(0)
	}

	// getSliderTickInterval(): number | 'auto'
	// {
	// 	if (this.showTicks)
	// 	{
	// 		return this.autoTicks ? 'auto' : this.tickInterval;
	// 	}

	// 	return 0;
	// }

	resetForm()
	{
		this.addVehicleRatesForm.reset();
	}

	// backButton()
	// {
	// 	this.router.navigate(['/affiliate/step5']);
	// }
}

