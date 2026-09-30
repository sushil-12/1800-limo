import { Component, EventEmitter, Input, OnInit, Output, SimpleChanges, ViewChild, OnChanges, OnDestroy } from "@angular/core";
import { FormBuilder, FormGroup } from "@angular/forms";
import { AdminService } from "src/app/services/admin.service";
import { AffiliateService } from "src/app/services/affiliate.service";

import { BehaviorSubject, combineLatest, Observable, Subject, Subscription } from "rxjs";
import { ActivatedRoute } from "@angular/router";
import { AmenitiesService } from "src/app/services/amenities.service";
import { param } from "jquery";

@Component({
	selector: "app-rates-form",
	templateUrl: "./rates-form.component.html",
	styleUrls: ["./rates-form.component.scss"],
})
export class RatesFormComponent implements OnInit, OnChanges, OnDestroy {
	// Capture Events.
	@Input("preventRateOverride") preventRateOverride: boolean = false;
	@Input("initRates") init_rates: boolean = false;
	@Input("initReturnRates") init_r_rates: boolean = false;
	@Input("affiliate_type") affiliate_type: string = "";
	@Input("return_affiliate_type") return_affiliate_type: string = "";
	@Input("distance") distance: string = "";
	@Input("reservation_id") bookingId: number = 0;
	@Input("vehicles") vehs: number = 0;
	@Input("hours") nums: number = 0;
	@Input("vehicle_id") QB_vehicle_id: any = 0;
	@Input('reset') reset: boolean = false;
	@Input('isTravelShare') isTravelShare: boolean = false;
	@Input('book_data') book_data: any = {};
	@Input('isCreatedByAdmin') isCreatedByAdmin: boolean = true;
	@Input('isFarmoutBooking') isFarmoutBooking: boolean = false;
	@Input("service_type") service_type: string = "";
	@Input("currencyObject") currencyObject: any;
	@Input("booking_created_from") booking_created_from: any;
	@Input() parentError: boolean = false;
	/** Individual portal: hide the editable rate buckets and share rows, show totals only. */
	@Input() hideBuckets: boolean = false;
	@Input() isAffiliateMode: boolean = false;
	@Input() userRole: string = "";


	// Throw Events.
	@Output("formvalue") formvalue = new EventEmitter<Record<string, any>>();
	@Output("returnformvalue") returnformvalue = new EventEmitter<Record<string, any>>();
	@Output("returnNumberOfHr") returnNumberOfHr = new EventEmitter<number>();
	@Output() hoursErrorChange = new EventEmitter<boolean>();
	RatesForm: FormGroup;
	ReturnRatesForm: FormGroup;

	ratesdata = new BehaviorSubject<any>({});
	returnRatesdata = new BehaviorSubject<any>({});

	temp: any;

	ratesform: boolean = false;
	returnratesform: boolean = false;

    isDaysMode: boolean = false;
	charterDays: number = 0;

	rate_params: any = {
		chevrons: {
			section: true,
			all_inclusive_rates: true,
			others: false,
			direct_taxes: false,
			taxes: false,
			amenities: false,
			misc: false,
			r_section: true,
			r_all_inclusive_rates: true,
			r_others: false,
			r_direct_taxes: false,
			r_taxes: false,
			r_amenities: false,
			r_misc: false,
		},
	};

	minimum_rate: Record<string, any>;

	total: Record<string, any> = {};
	r_total: Record<string, any> = {};

	subtotal: number = 0;
	r_subtotal: number = 0;
	grandtotal: number = 0;
	r_grandtotal: number = 0;
	admin_share: number = 25;
	travel_share: number = 10
	calc_admin_share: number = 0;
	r_calc_admin_share: number = 0;

	vehicles: number = 1;
	hours: number = 0;
	newBooking: boolean = false;
	is_readonly_min_rate: boolean = false;
	bookingType: any = 'new';
	master_vehicle_id: any = null;
	travel_agent_share: any = 0;
	r_travel_agent_share: any = 0;
	emptyRateArray: any;
	farmoutShare: any = 0;
	r_farmoutShare: any = 0;
	currencySymbol: any = '$';
	currentUser: any;
	previousBookingData: any = null;
	numberOfHoursError: boolean = false;
	private hasCapturedInitialBookingDataBaseline: boolean = false;
	private numsChangeDebounce: ReturnType<typeof setTimeout> | null = null;
	private readonly NUMS_DEBOUNCE_MS = 600; // enough time to type up to 3 digits

	constructor(
		private $form: FormBuilder,
		private $api: AdminService,
		private $routeurl: ActivatedRoute,
		private amenitiesService: AmenitiesService,
		private affiliateService: AffiliateService
	) { }

	ngOnInit(): void {
		this.$routeurl.queryParams.subscribe((params: any) => {
			console.log("DEBUGRATES - NO VEHICLE ID FROM PARAMS", JSON.stringify(params))
			if (!params?.vehicle_id) {
				console.log("DEBUGRATES - GOT VEHICLE ID FROM PARAMS")
				this.fetchRates('');
			}
			if (params && params.new == 'true') {
				this.newBooking = params.new == 'true'
			}
			if (params && params.updateType) {
				this.bookingType = params.updateType
			}
			if (params && params.is_master_vehicle == 'true') {
				this.master_vehicle_id = params.vehicle_id
			}
		})

		this.currentUser = JSON.parse(localStorage.getItem("currentUser"))
	}

	ngOnDestroy(): void {
		if (this.numsChangeDebounce) {
			clearTimeout(this.numsChangeDebounce);
		}
	}

	handleSubHeading(items: string) {
		this.rate_params["chevrons"][items] = !this.rate_params["chevrons"][items];
	}
	getTabIndex(item: any) {
		return this.rate_params["chevrons"][item] ? 0 : 1
	}


	ngOnChanges(changes: SimpleChanges) {
		console.warn("Change has been detected: ", changes);
		this.currencySymbol = this.currencyObject ? this.currencyObject?.symbol : "$"
		this.ratesform = true;

		this.isDaysMode = this.hours >= 24;
		this.charterDays = this.hours >= 24 ? this.hours/24 : this.hours;
		
		const shouldShowReturnRates =
			!!this.init_r_rates ||
			this.service_type === 'round_trip' ||
			this.book_data?.service_type === 'round_trip' ||
			changes?.book_data?.currentValue?.service_type === 'round_trip';
		this.returnratesform = shouldShowReturnRates;

		// if(changes?.distance.currentValue){
		// 	console.log('<><><>><><><><><><><><><><><><><><>' ,changes?.distance.currentValue , changes?.book_data?.currentValue)
		// 	this.fetchRatesArrayByAffiliateVehicle(changes?.book_data?.currentValue)
		// }
		if (changes?.book_data?.currentValue) {
			this.fetchRatesArrayByAffiliateVehicle(changes?.book_data?.currentValue)
		}
		// if (changes?.QB_vehicle_id?.currentValue) {
		// 		console.log('got QB_vehicle_id------->>>>>>>>>', changes.QB_vehicle_id)
		// 		this.QB_vehicle_id = changes?.QB_vehicle_id?.currentValue
		// 		let QB: any = JSON.parse(localStorage.getItem('quotebot_form'))
		// 		let no_of_hours = null
		// 		if (QB?.service_type == 'charter_tour') {
		// 			no_of_hours = QB?.booking_hour
		// 		}
		// 		let location_info = QB?.location_info[0]
		// 		let transfer_type_value = QB?.pickup_type + '_to_' + QB?.dropoff_type
		// 		let return_transfer_type_value = QB?.dropoff_type + '_to_' + QB?.pickup_type
		// 		let data = {
		// 			vehicle_id : this.QB_vehicle_id,
		// 			service_type: QB?.service_type,
		// 			transfer_type: transfer_type_value,
		// 			numberOfVehicles: 1,
		// 			no_of_hours: no_of_hours,
		// 			distance: location_info.distance.value,
		// 			is_master_vehicle: JSON.parse(sessionStorage.getItem('selected_vehicle'))?.is_master_vehicle 
		// 		}
		// 		this.fetchRatesArrayByAffiliateVehicle(data)
		// }

		// if asked to initialise the rates
		if (changes.init_rates?.currentValue) {
			if (!this.QB_vehicle_id) {
				this.initRates();
			}
		}

		// Unchecking "Prevent System Rate Override" hands control back to the system,
		// so pull the current system rates immediately instead of waiting for the
		// next booking-data change to trigger a recalculation.
		if (changes.preventRateOverride
			&& !changes.preventRateOverride.firstChange
			&& changes.preventRateOverride.previousValue === true
			&& changes.preventRateOverride.currentValue === false) {
			// book_data can be a stale snapshot at this point. Overlay the live
			// booking-form values (bound to this component's own inputs) so the
			// rate request carries the actual current form state.
			const payload = {
				...this.book_data,
				vehicle_id: this.QB_vehicle_id || this.book_data?.vehicle_id,
				service_type: this.service_type || this.book_data?.service_type,
				affiliate_type: this.affiliate_type || this.book_data?.affiliate_type,
				return_affiliate_type: this.return_affiliate_type || this.book_data?.return_affiliate_type,
				distance: this.distance || this.book_data?.distance,
				numberOfVehicles: this.vehs || this.book_data?.numberOfVehicles,
				no_of_hours: this.nums || this.book_data?.no_of_hours
			};
			this.fetchRatesArrayByAffiliateVehicle(payload);
		}

		if (shouldShowReturnRates && !this.ReturnRatesForm) {
			const seededReturnRates = this.resolveReturnRateArray({
				data: {
					retrunRateArray: this.returnRatesdata.getValue(),
					rateArray: this.ratesdata.getValue()
				}
			});
			if (this.hasRateArrayContent(seededReturnRates)) {
				this.returnRatesdata.next(seededReturnRates);
				this.initReturnRates();
			}
		}


		// if (changes.init_r_rates?.currentValue || this.returnratesform) {
		// 	this.hours = 0;
		// 	// if (!changes.vehs) {
		// 	// 	this.initReturnRates();
		// 	// }
		// 		let data = {
		// 			vehicle_id : this.master_vehicle_id ? this.master_vehicle_id : this.book_data?.vehicle_id,
		// 			service_type: this.book_data?.service_type,
		// 			transfer_type: this.book_data?.transfer_type,
		// 			numberOfVehicles: this.book_data?.numberOfVehicles,
		// 			no_of_hours: this.book_data?.no_of_hours,
		// 			distance: this.book_data?.distance,
		// 			is_master_vehicle:this.book_data?.is_master_vehicle,
		// 			extra_stops:this.book_data?.extra_stops,
		// 			return_extra_stops:this.book_data?.return_extra_stops
		// 		}
		// 			this.fillReturnRateForm(data)
		// }


		if (changes.nums) {
				const newHours = Number(changes.nums.currentValue);

				// Echo guard: same value bounced back — ignore it
				const isEchoOfSameDays = newHours === this.hours;

				if (isEchoOfSameDays) {
				} else {
					// Debounce: wait till user finishes typing (up to 3 digits) before reacting
					if (this.numsChangeDebounce) {
						clearTimeout(this.numsChangeDebounce);
					}

					    this.numsChangeDebounce = setTimeout(() => {
						this.hours = newHours;
						this.isDaysMode = this.hours >= 24;
						this.charterDays = this.isDaysMode ? this.hours / 24 : this.hours;
						// Recompute the error from the settled value so a stale
						// flag (set while this.hours was still 0/old) can't stick
						if (this.service_type === 'charter_tour') {
							this.numberOfHoursError = isNaN(this.hours) || this.hours < 2;
						} else {
							this.numberOfHoursError = false;
						}
						this.hoursErrorChange.emit(this.numberOfHoursError);
						this.RatesForm && this.calculateAmount('RatesForm', 'all_inclusive_rates', 'Base_Rate');
						this.numsChangeDebounce = null;
					}, this.NUMS_DEBOUNCE_MS);
				}
		}

		if (changes.affiliate_type || changes.return_affiliate_type || changes.booking_created_from) {
			this.RatesForm && this.calculateAmount('RatesForm', 'all_inclusive_rates', 'Base_Rate');
			this.ReturnRatesForm && this.calculateAmount('ReturnRatesForm', 'all_inclusive_rates', 'Base_Rate');
		}
		if (changes.isTravelShare) {
			this.initRates();
			if (this.ReturnRatesForm) {
				this.initReturnRates
			}
		}
		// if(changes.affiliate_type?.currentValue){
		// 	this.initRates();
		// 	if (this.ReturnRatesForm) {
		// 		this.initReturnRates
		// 	}
		// }

		this.vehicles = changes.vehs ? changes.vehs.currentValue : this.vehicles;
		if (this.vehicles) {
			this.calculateGrandTotal('RatesForm');
			if (this.ReturnRatesForm) {
				this.calculateGrandTotal('ReturnRatesForm');
			}
		} else {
			this.vehicles = 1;
		}

		if (changes.bookingId) {
			console.log('DEBUGRATES - RATESFORM GOT bookingId CHANGE | previous:', changes.bookingId.previousValue, '| current:', changes.bookingId.currentValue, '| type:', typeof changes.bookingId.currentValue);
		}
		if (changes.bookingId && changes.bookingId.currentValue !== 0) {
			this.fetchRates("", changes.bookingId?.currentValue)

			// this.getRatesData().subscribe((response: any) => {
			// 	if (response && Object.keys(response).length > 0) {
			// 		for (let item in this.RateForm) {
			// 			for (let key in (<FormGroup>this.RatesForm.get(item)).controls) {
			// 				console.log(item, key);
			// 				let baserate = response[item][key]["baserate"];
			// 				let type = response[item][key]["type"] ?? "flat";
			// 				(<FormGroup>((<FormGroup>this.RatesForm.get(item)).get(key))).get("baserate").setValue(baserate);
			// 				if ((<FormGroup>((<FormGroup>this.RatesForm.get(item)).get(key))).get("type")) {
			// 					(<FormGroup>((<FormGroup>this.RatesForm.get(item)).get(key))).get("type").setValue(type);
			// 				}
			// 			}
			// 		}
			// 	}
			// })
		}

		if (changes.parentError) {
			this.numberOfHoursError = changes.parentError.currentValue;
		}

		if (changes.reset && changes.reset.currentValue) {
			this.RatesForm = null
			this.ReturnRatesForm = null
			this.total = {}
			this.r_total = {}
			this.previousBookingData = null
			this.hasCapturedInitialBookingDataBaseline = false
			this.initRates()
			this.calculateTotal('RatesForm')
			this.calculateGrandTotal('RatesForm')
			if (this.ReturnRatesForm) {
				this.initReturnRates()
				this.calculateTotal('ReturnRatesForm')
				this.calculateGrandTotal('ReturnRatesForm')
			}
		}

		if (changes?.book_data?.currentValue) {
			this.fetchRatesArrayByAffiliateVehicle(changes?.book_data?.currentValue);
        }
		
		this.isDaysMode = this.hours >= 24;
		this.charterDays = this.hours >= 24 ? this.hours/24 : this.hours;

	}

	/** Travel Advisor Share row: only admin and the travel agent see it, and only when a TA is on the booking. */
	get showTravelAdvisorShare(): boolean {
		return ['admin', 'travel_agent'].includes(this.userRole) && this.isTravelShare && !this.isCreatedByAdmin;
	}

	returnZero() {
		return 0;
	}

	vehicleBaseRateOrder = [
		'Base_Rate',
		'Stops',
		'Wait',
		'ELH_Charges',
		'Holiday_Charge',
	];

	sortVehicleBaseRates = (a: any, b: any) => {
		const getPriority = (item: any) => {
			const key = item?.key;
			const rateLabel = item?.value?.controls?.rate_label?.value;
			const normalizedLabel = typeof rateLabel === 'string' ? rateLabel.toLowerCase() : '';

			if (key === 'Holiday_Charge' || normalizedLabel.includes('holiday charge')) {
				return this.vehicleBaseRateOrder.indexOf('Holiday_Charge');
			}

			const index = this.vehicleBaseRateOrder.indexOf(key);
			return index === -1 ? Number.MAX_SAFE_INTEGER : index;
		};

		return getPriority(a) - getPriority(b);
	}

	handleNegtiveValue(formgroup, subform, formcontrol, value) {
		let v = parseFloat((Math.abs(Number(value))).toFixed(2));
		(<FormGroup>(<FormGroup>this.RatesForm.get(formgroup)).get(subform)).get(formcontrol).setValue(v);
		this.RatesForm.updateValueAndValidity();
	}
	handleNegtiveValuReturn(formgroup, subform, formcontrol, value) {
		let v = parseFloat((Math.abs(Number(value))).toFixed(2));
		(<FormGroup>(<FormGroup>this.ReturnRatesForm.get(formgroup)).get(subform)).get(formcontrol).setValue(v);
		this.ReturnRatesForm.updateValueAndValidity();
	}
	textFormatter(text: string) {
		try {
			return text.replace(/[\\\_$]+/g, " ");
		} catch {
			return text;
		}
	}

	handleSubHeadingScroll(items: string, id: any) {
		this.rate_params["chevrons"][items] = !this.rate_params["chevrons"][items];
		let el = document.getElementById(id);
		setTimeout(() => {
			el.scrollIntoView();
		}, 600)
	}
	scroll(id) {
		let el = document.getElementById(id);
		let elementRect = el.getBoundingClientRect();
		let absoluteElementTop = elementRect.top + window.pageYOffset;
		let topElement = absoluteElementTop - 150;

		window.scrollTo({
			top: topElement,
			behavior: 'smooth'
		});
		// console.log(`scrolling to ${id}`, el);
		// el.scrollIntoView();
	}
	closeAllChevrons() {
		this.rate_params["chevrons"]['section'] = false
		this.rate_params["chevrons"]['all_inclusive_rates'] = false
		this.rate_params["chevrons"]['others'] = false
		this.rate_params["chevrons"]['direct_taxes'] = false
		this.rate_params["chevrons"]['taxes'] = false
		this.rate_params["chevrons"]['amenities'] = false
		this.rate_params["chevrons"]['misc'] = false
		setTimeout(() => {
			this.scroll('rate-heading')
		}, 300)
	}
	closeReturnAllChevrons() {
		this.rate_params["chevrons"]['r_section'] = false
		this.rate_params["chevrons"]['r_all_inclusive_rates'] = false
		this.rate_params["chevrons"]['r_others'] = false
		this.rate_params["chevrons"]['r_direct_taxes'] = false
		this.rate_params["chevrons"]['r_taxes'] = false
		this.rate_params["chevrons"]['r_amenities'] = false
		this.rate_params["chevrons"]['r_misc'] = false
		setTimeout(() => {
			this.scroll('rate-heading')
		}, 300)
	}

	private recalculateAllRates(form: "RatesForm" | "ReturnRatesForm"): void {
		const targetForm = form === 'RatesForm' ? this.RateForm : this.ReturnRateForm;
		if (!targetForm) {
			return;
		}

		for (let formgroup in targetForm) {
			for (let subform in targetForm[formgroup]?.controls) {
				this.calculateAmount(form, formgroup, subform);
			}
		}

		this.calculateTotal(form);
		this.calculateGrandTotal(form);
	}

	initRates() {
		try {


			this.RatesForm = this.$form.group({});
			// build form
			this.RatesForm = this.$form.group({
				all_inclusive_rates: this.$form.group({}),
				direct_taxes: this.$form.group({}),
				taxes: this.$form.group({}),
				amenities: this.$form.group({}),
				misc: this.$form.group({}),
				// others: this.$form.group({}), // As discussed we don't need gratuity bucket
			});

			// fetch the data from backend
			this.getRatesData().subscribe((response) => {
				if (response && Object.keys(response).length > 0) {
					this.buildRatesForm('RatesForm', response);
					this.recalculateAllRates('RatesForm');
				}
			})

			//calculating totals of rates form if data auto fill by quote bot 

			for (let formgroup in this.RateForm) {
				for (let subform in this.RateForm[formgroup].controls) {
					this.calculateAmount('RatesForm', formgroup, subform)
					if (this.init_r_rates) {
						this.calculateAmount('ReturnRatesForm', formgroup, subform)
					}
				}
			}

			this.calculateTotal("RatesForm");
			this.calculateGrandTotal("RatesForm");

			// will send the rates form value to the booking component on any change in the whole form
			this.RatesForm.valueChanges.subscribe((value: any) => {
				this.calculateTotal("RatesForm");
				this.calculateGrandTotal("RatesForm");
			});
			(<FormGroup>this.RatesForm.get('all_inclusive_rates')).valueChanges.subscribe(() => {
				for (let formgroup in this.RateForm) {
					for (let subform in this.RateForm[formgroup]?.controls) {
						if (formgroup != 'all_inclusive_rates') {
							this.calculateAmount('RatesForm', formgroup, subform)
						}
					}
				}
			});
		} catch (error) {
		}
	}


	async initReturnRates() {

		this.ReturnRatesForm = this.$form.group({
			all_inclusive_rates: this.$form.group({}),
			direct_taxes: this.$form.group({}),
			taxes: this.$form.group({}),
			amenities: this.$form.group({}),
			misc: this.$form.group({}),
			// others: this.$form.group({}), // As discussed we don't need gratuity bucket
		});

		if (this.newBooking || this.distance) {
			this.getReturnRatesData().subscribe((response: any) => {
				if (response && Object.keys(response).length > 0) {
					this.buildRatesForm('ReturnRatesForm', response);
					this.recalculateAllRates('ReturnRatesForm');
				}
			});
			for (let formgroup in this.ReturnRateForm) {
				for (let subform in this.ReturnRateForm[formgroup].controls) {
					this.calculateAmount('ReturnRatesForm', formgroup, subform)
				}
			}

		}
		else {
			this.getReturnRatesData().subscribe((response: any) => {
				if (response && Object.keys(response).length > 0) {
					this.buildRatesForm('ReturnRatesForm', response);
					this.recalculateAllRates('ReturnRatesForm');
				}
			});
		}

		this.ReturnRatesForm.valueChanges.subscribe((value: any) => {
			this.calculateTotal("ReturnRatesForm");
			this.calculateGrandTotal('ReturnRatesForm');
		});

		(<FormGroup>this.ReturnRatesForm.get('all_inclusive_rates')).valueChanges.subscribe(() => {
			for (let formgroup in this.ReturnRateForm) {
				for (let subform in this.ReturnRateForm[formgroup].controls) {
					if (formgroup != 'all_inclusive_rates') {
						this.calculateAmount('ReturnRatesForm', formgroup, subform)
					}
				}
			}
		})
	}

	get RateForm(): Record<string, any> {
		if (!this.RatesForm) {
			return;
		}
		return this.RatesForm.controls;
	}

	get ReturnRateForm(): Record<string, any> {
		if (!this.ReturnRatesForm) {
			return;
		}
		return this.ReturnRatesForm.controls;
	}

	changeValue(form: string, formgroup: string, subform: string, formcontrol: string, value: any) {
		if (form === "RatesForm") {
			(<FormGroup>(<FormGroup>this.RatesForm.get(formgroup)).get(subform)).get(formcontrol).setValue(value);
			this.RatesForm.updateValueAndValidity();
		}
		if (form === "ReturnRatesForm") {
			(<FormGroup>((<FormGroup>this.ReturnRatesForm.get(formgroup)).get(subform))).get(formcontrol).setValue(value);
			this.ReturnRatesForm.updateValueAndValidity();
		}
	}

	fetchRates(affiliate: string, bookingId: number = 0) {
		console.log("DEBUGRATES - UNDER FETCHRATES METHOD --- ", affiliate, bookingId)
		// Without a bookingId this hits GET admin/booking-rates (blank rate template),
		// which the individual portal is not permitted to call. Individual mode
		// (hideBuckets) gets its rates from booking-rates-vehicle / reservation-rates instead.
		if (!bookingId && this.hideBuckets) {
			return;
		}

		const handleResponse = (response: any) => {
			console.log('DEBUGRATES - FETCHRATES RESPONSE | bookingId:', bookingId, '| success:', response?.success, '| has rateArray:', !!response?.data?.rateArray);
			if (response?.success && response?.data?.rateArray) {
				this.emptyRateArray = response?.data?.rateArray
				this.ratesdata.next({})
				this.is_readonly_min_rate = response?.data?.min_rate_involved ? true : false
				this.ratesdata.next(response.data.rateArray);
				this.initRates();

				// Instant error check on prefill
				if (this.service_type === 'charter_tour' && this.isHoursBelowMinimum()) {
					this.numberOfHoursError = true;
				} else {
					this.numberOfHoursError = false;
				}
			}
		};

		if (this.isAffiliateMode) {
			console.log("DEBUGRATES - AFFILIATE MODE -  Fetch REservation rates | calling reservation-rates/" + bookingId)
			this.affiliateService.fetchBookingRates(bookingId).subscribe(handleResponse, (error: any) => {
				console.log('DEBUGRATES - FETCHRATES API ERROR | reservation-rates/' + bookingId + ' | status:', error?.status, '| error:', error);
			});
		} else {
			this.$api.fetchAdminNewBookingRates(affiliate, bookingId).subscribe(handleResponse, (error: any) => {
				console.log('DEBUGRATES - FETCHRATES API ERROR | booking-rates | status:', error?.status, '| error:', error);
			});
		}
	}

	fillReturnRateForm(data) {
		this.returnRatesdata.next({})
		if(!this.preventRateOverride){    
			this.$api.fetchRatesByAffiliateVeh(data.vehicle_id, data).subscribe((response: any) => {
				this.is_readonly_min_rate = response?.data?.min_rate_involved ? true : false
				this.returnRatesdata.next(this.resolveReturnRateArray(response))
				this.initReturnRates()
			});
	    }
	}

	private getBaseRateValue(rateArray: any): number {
		const baseRate = rateArray?.all_inclusive_rates?.Base_Rate;
		const amount = Number(baseRate?.amount);
		const baserate = Number(baseRate?.baserate);
		if (!isNaN(amount) && amount > 0) {
			return amount;
		}
		if (!isNaN(baserate) && baserate > 0) {
			return baserate;
		}
		return 0;
	}

	private shouldUseDedicatedReturnRateFetch(data: any, response: any): boolean {
		if (data?.service_type !== 'round_trip') {
			return false;
		}

		if (data?.affiliate_type !== 'loose_affiliate') {
			return false;
		}

		if (data?.return_affiliate_type !== 'affiliate') {
			return false;
		}

		if (!data?.return_vehicle_id || !data?.return_affiliate_id) {
			return false;
		}

		const returnBaseRate = this.getBaseRateValue(response?.data?.retrunRateArray);
		const outboundBaseRate = this.getBaseRateValue(response?.data?.rateArray);
		const shouldFallback = returnBaseRate === 0 && outboundBaseRate === 0;
		if (shouldFallback) {
		}
		return shouldFallback;
	}

	private buildDedicatedReturnBookingData(data: any): any {
		const returnDistance = data?.return_distance || data?.distance;
		return {
			...data,
			service_type: 'one_way',
			affiliate_id: data?.return_affiliate_id,
			return_affiliate_id: data?.return_affiliate_id,
			vehicle_id: data?.return_vehicle_id,
			return_vehicle_id: data?.return_vehicle_id,
			transfer_type: data?.return_transfer_type || data?.transfer_type,
			return_transfer_type: data?.return_transfer_type || data?.transfer_type,
			distance: returnDistance,
			return_distance: returnDistance,
			extra_stops: Array.isArray(data?.return_extra_stops) ? data.return_extra_stops : [],
			return_extra_stops: Array.isArray(data?.return_extra_stops) ? data.return_extra_stops : [],
			pickup_time: data?.return_pickup_time || data?.pickup_time,
			return_pickup_time: data?.return_pickup_time || data?.pickup_time,
			affiliate_type: data?.return_affiliate_type || data?.affiliate_type,
			return_affiliate_type: data?.return_affiliate_type || data?.affiliate_type,
			is_master_vehicle: false
		};
	}

	private buildDedicatedOutboundBookingData(data: any): any {
		return {
			...data,
			service_type: 'one_way',
			return_affiliate_id: null,
			return_vehicle_id: null,
			return_transfer_type: null,
			return_distance: null,
			return_extra_stops: [],
			return_pickup_time: null,
			return_affiliate_type: null
		};
	}

	private fetchDedicatedReturnRates(data: any): void {
		const returnBookingData = this.buildDedicatedReturnBookingData(data);
		this.$api.fetchRatesByAffiliateVeh(returnBookingData.vehicle_id, returnBookingData).subscribe((response: any) => {
			const dedicatedReturnRates = response?.data?.rateArray || {};
			this.returnRatesdata.next(dedicatedReturnRates);
			this.initReturnRates();
		}, (error: any) => {
			console.error('admin/rates-form dedicated return-rate error', error);
		});
	}

	private fetchDedicatedOutboundRates(data: any): void {
		const outboundBookingData = this.buildDedicatedOutboundBookingData(data);
		if(!this.preventRateOverride){    
			this.$api.fetchRatesByAffiliateVeh(outboundBookingData.vehicle_id, outboundBookingData).subscribe((response: any) => {
				const dedicatedOutboundRates = response?.data?.rateArray || {};
				this.ratesdata.next({});
				this.is_readonly_min_rate = response?.data?.min_rate_involved ? true : false;
				this.ratesdata.next(dedicatedOutboundRates);
				this.initRates();
			}, (error: any) => {
				console.error('admin/rates-form dedicated outbound-rate error', error);
			});
	    }
	}

	fetchRatesArrayByAffiliateVehicle(data) {
		
		// Check if booking_data has changed
		const bookingDataChanged = this.hasBookingDataChanged(data);
		const isFirstTime = this.previousBookingData === null;
		const isDataComplete = this.isBookingDataComplete(data);


		// A round trip is built from a one-way booking, so its saved rates don't cover the
		// return leg - it must fetch fresh rates (booking-rates-vehicle) instead of preserving them.
		const shouldPreserveInitialReservationRates = ['edit', 'repeat', 'return'].includes(this.bookingType);

		// A bumped rate_refresh_token marks an explicit user pick (quote vehicle,
		// affiliate dropdown). Those must always recalculate — never swallow them
		// as the hydration baseline below.
		const currentRefreshToken = Number(data?.rate_refresh_token) || 0;
		const previousRefreshToken = Number(this.previousBookingData?.rate_refresh_token) || 0;
		const isExplicitSelection = currentRefreshToken > previousRefreshToken;

		// On edit/repeat/return/round screens, preserve saved reservation rates during initial hydration.
		// We only start live recalculation after a complete booking-data baseline has been captured.
		if (shouldPreserveInitialReservationRates && !this.hasCapturedInitialBookingDataBaseline && !isExplicitSelection) {
			this.previousBookingData = JSON.parse(JSON.stringify(data));
			if (isDataComplete) {
				this.hasCapturedInitialBookingDataBaseline = true;
			} else {
			}
			return;
		}

		// Round trip: hold off until the prefilled booking data is complete, then fetch once.
		if (this.bookingType === 'round' && !this.hasCapturedInitialBookingDataBaseline && !isExplicitSelection) {
			if (!isDataComplete) {
				this.previousBookingData = JSON.parse(JSON.stringify(data));
				return;
			}
			this.hasCapturedInitialBookingDataBaseline = true;
		}

		// An explicit pick ends the hydration-preserve phase: from here on,
		// implicit rebuilds are compared against the normal baseline.
		if (isExplicitSelection) {
			this.hasCapturedInitialBookingDataBaseline = true;
		}

		// If no changes detected (and not first time), skip processing
		if (!bookingDataChanged) {
			return;
		}
		
	
		let vehicle_id = ''
		const hasEmptyVehicleId =
			data?.vehicle_id === null ||
			data?.vehicle_id === undefined ||
			data?.vehicle_id === '';
		
		const hasAffiliateId =
			data?.affiliate_id !== null &&
			data?.affiliate_id !== undefined &&
			data?.affiliate_id !== '';

		const shouldUseMasterVehicle =
			!hasAffiliateId && (
				data?.is_master_vehicle === true ||
				data?.is_master_vehicle === 'true' ||
				data?.vehicle_id === 0 ||
				data?.vehicle_id === '0' ||
				hasEmptyVehicleId
			);

		if (data.vehicle_id !== undefined && data.vehicle_id !== null && data.vehicle_id !== '') {
			vehicle_id = data?.vehicle_id.toString().length ? data?.vehicle_id : this.master_vehicle_id
		} else if (shouldUseMasterVehicle) {
			// Individual/quote-flow bookings have no vehicle_id until a vehicle is
			// picked - fall back to the master vehicle id so the rate request still
			// carries vehicle context instead of going out empty.
			vehicle_id = this.master_vehicle_id
		}
		console.log('fetchRatesArrayByAffiliateVehicle data:', data, 'vehicle_id:', vehicle_id, 'shouldUseMasterVehicle:', shouldUseMasterVehicle);
		data['is_master_vehicle'] = shouldUseMasterVehicle;


		data['selected_amenities'] = this.amenitiesService.getCurrentValue();

		const previousServiceType = this.previousBookingData?.service_type;
		const currentServiceType = data?.service_type;
		// Only a service_type change (e.g. one_way -> round_trip) forces a refetch while
		// locked - it changes what rate structure even applies. Extra-stop edits must NOT
		// bypass the lock: "Prevent System Rate Override" means stops can't change rates.
		const isServiceTypeChanged = !!previousServiceType && previousServiceType !== currentServiceType;

		if (!this.preventRateOverride || isServiceTypeChanged) {
		// Stamp the baseline before the request goes out so the second
		// fetchRatesArrayByAffiliateVehicle call in the same ngOnChanges pass
		// dedupes instead of firing a duplicate request.
		this.previousBookingData = JSON.parse(JSON.stringify(data));
		this.$api.fetchRatesByAffiliateVeh(vehicle_id, data).subscribe((response: any) => {
			console.log('fetchRatesArrayByAffiliateVehicle date:', data, 'response:', response);
			// && this.affiliate_type != 'loose_affiliate'
			this.ratesdata.next({})
			this.calc_admin_share = 0
			this.travel_agent_share = 0
			this.is_readonly_min_rate = response?.data?.min_rate_involved ? true : false
			this.ratesdata.next(response?.data?.rateArray)
			this.initRates();

			if (data.service_type == 'round_trip') {
				if (this.shouldUseDedicatedReturnRateFetch(data, response)) {
					this.fetchDedicatedOutboundRates(data);
					this.fetchDedicatedReturnRates(data);
				} else {
					this.returnRatesdata.next(this.resolveReturnRateArray(response))
					this.initReturnRates()
				}
			}

			// Instant error check on prefill
			if (this.service_type === 'charter_tour' && this.isHoursBelowMinimum()) {
				this.numberOfHoursError = true;
			} else {
				this.numberOfHoursError = false;
			}
		}, (error: any) => {
			console.error('[buildBookingData] API error:', error);
		});
	  }
	}

	/**
	 * Compares current booking_data with previous booking_data to detect changes
	 * @param currentBookingData - The current booking data object
	 * @returns true if data has changed, false otherwise
	 */
	private hasBookingDataChanged(currentBookingData: any): boolean {
		// First call - no previous data, so consider it as changed
		if (this.previousBookingData === null) {
			return true;
		}

		// Deep comparison of booking_data objects
		const previous = this.previousBookingData;
		const current = currentBookingData;

		// Compare all properties
		const keysToCompare = [
			'affiliate_id',
			'return_affiliate_id',
			'vehicle_id',
			'transfer_type',
			'return_transfer_type',
			'service_type',
			'numberOfVehicles',
			'distance',
			'return_distance',
			'no_of_hours',
			'is_master_vehicle',
			'extra_stops',
			'return_extra_stops',
			'pickup_time',
			'return_pickup_time',
			'return_vehicle_id',
			'return_affiliate_type',
			'rate_refresh_token'
		];

		for (const key of keysToCompare) {
			const previousValue = previous[key];
			const currentValue = current[key];

			// Deep comparison for arrays/objects (extra_stops, return_extra_stops)
			if (Array.isArray(previousValue) && Array.isArray(currentValue)) {
				if (JSON.stringify(previousValue) !== JSON.stringify(currentValue)) {
					return true;
				}
			} else if (previousValue !== currentValue) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Checks if booking_data is complete/valid (not initial/incomplete state)
	 * @param bookingData - The booking data object to check
	 * @returns true if data is complete, false if incomplete/initial state
	 */
	private isBookingDataComplete(bookingData: any): boolean {
		// Check if vehicle_id is present and not empty. Individual/quote-flow
		// bookings legitimately have no vehicle_id until a vehicle is picked -
		// an explicit master-vehicle booking is "complete" on distance/service_type
		// alone, otherwise this permanently blocks the rate refetch for them.
		const hasVehicleId = (bookingData?.vehicle_id &&
			bookingData.vehicle_id !== '' &&
			bookingData.vehicle_id !== null &&
			bookingData.vehicle_id !== undefined) ||
			bookingData?.is_master_vehicle === true;

		// Check if distance is set (greater than 0) - this indicates actual route calculation
		const hasDistance = bookingData?.distance !== undefined &&
			bookingData?.distance !== null &&
			bookingData?.distance > 0;

		// Check if service_type is valid (not empty or initial state)
		const hasServiceType = bookingData?.service_type &&
			bookingData.service_type !== '' &&
			bookingData.service_type !== null;

		const isComplete = hasVehicleId && hasDistance && hasServiceType;


		return isComplete;
	}

	getReturnRatesData() {
		return this.returnRatesdata.asObservable();
	}
	getRatesData() {
		return this.ratesdata.asObservable();
	}

	hasRateArrayContent(rateArray: any): boolean {
		if (!rateArray || typeof rateArray !== 'object') {
			return false;
		}

		return ['all_inclusive_rates', 'taxes', 'amenities', 'misc', 'direct_taxes'].some((key) => {
			const section = rateArray?.[key];
			return section && typeof section === 'object' && Object.keys(section).length > 0;
		});
	}

	resolveReturnRateArray(response: any): any {
		const returnRateArray = response?.data?.retrunRateArray;
		if (this.hasRateArrayContent(returnRateArray)) {
			return returnRateArray;
		}

		const outboundRateArray = response?.data?.rateArray;
		if (this.hasRateArrayContent(outboundRateArray)) {
			return JSON.parse(JSON.stringify(outboundRateArray));
		}

		return {};
	}
	// this.hours lags behind the parent value while the nums debounce is
	// pending (it starts at 0), so prefer the parent-supplied hours
	private isHoursBelowMinimum(): boolean {
		const parentHours = Number(this.nums);
		const effectiveHours = isNaN(parentHours) ? this.hours : parentHours;
		return effectiveHours < 2;
	}

	// Live update while typing (allows 10, 11, 12, 15 etc.)
	handleHourChange(event: any) {
		let value = Number(event.target.value);
		if (this.isDaysMode) {
			value = value * 24;
		}

		// Reactive error flag update (days mode can never be under 2 hours)
		if (this.service_type === 'charter_tour') {
			if (!isNaN(value) && value < 2 && !this.isDaysMode) {
				this.numberOfHoursError = true;
			} else {
				this.numberOfHoursError = false;
			}
			this.hoursErrorChange.emit(this.numberOfHoursError);
		} else {
			this.numberOfHoursError = false;
			this.hoursErrorChange.emit(false);
		}

		if (!isNaN(value) && value >= 2) {
			this.returnNumberOfHr.emit(value);
		}
	}

	// Force minimum 2 when user clicks away (perfect for 0, 1, empty)
	enforceMinimumHours(event: any) {
		const previousHours = this.hours;
		let value = Number(event.target.value || 0);
		if (this.isDaysMode) {
			value = value * 24;
			// Days mode: field holds days, so the floor is 1 day, not 2 hours
			if (this.service_type == 'charter_tour' && (isNaN(value) || value < 24)) {
				value = 24;
				this.hours = 24;
				event.target.value = 1;
			}
			this.numberOfHoursError = false;
			this.hoursErrorChange.emit(false);
			// Only notify the parent when the hours value actually changed
			if (value !== previousHours) {
				this.returnNumberOfHr.emit(value);
			}
			return;
		}

		if (this.service_type == 'charter_tour' && (isNaN(value) || value < 2)) {
			value = 2;
			this.hours = 2;
			event.target.value = 2;
			this.numberOfHoursError = false;
			this.hoursErrorChange.emit(false);
		}

		// Only notify the parent when the hours value actually changed
		if (value !== previousHours) {
			this.returnNumberOfHr.emit(value);
		}
	}

	// Block negative sign while typing
	blockNegative(event: KeyboardEvent) {
		if (event.key === '-') {
			event.preventDefault();
		}
	}

	buildRatesForm(form: string, data: Record<string, any>): FormGroup {
		// Base Value for foundation of the whole algorithm
		if (data.hasOwnProperty("rate_label")) {
			return this.$form.group({ ...data });
		}

		for (let key in data) {
			if (Array.isArray(data[key])) {
				// TODO do thing for array type
				return;
			}
			// if inner values contains object, ONLY
			else Object.values(data[key]).length > 0;
			{
				for (let item in data[key]) {
					if (form === "RatesForm") {
						(<FormGroup>this.RatesForm.get(key)).addControl(item, this.buildRatesForm(form, data[key][item]));
						(<FormGroup>((<FormGroup>this.RatesForm.get(key)).get(item))).get("baserate").valueChanges.subscribe((value: number) => {
							this.calculateAmount("RatesForm", key, item);
						});
					}
					if (form === "ReturnRatesForm") {
						(<FormGroup>this.ReturnRatesForm.get(key)).addControl(
							item,
							this.buildRatesForm(form, data[key][item])
						);
						(<FormGroup>(
							(<FormGroup>this.ReturnRatesForm.get(key)).get(item)
						))
							.get("baserate")
							.valueChanges.subscribe((value: number) => {
								this.calculateAmount(
									"ReturnRatesForm",
									key,
									item
								);
							});
					}
				}
			}
		}
	}


	calculateTotal(form: "RatesForm" | "ReturnRatesForm") {
		if (form === "RatesForm") {
			this.subtotal = 0;
			for (let item in this.total) {
				this.subtotal = Number(this.subtotal.toFixed(2)) + Number(this.total[item].toFixed(2));
			}
		}

		if (form === "ReturnRatesForm") {
			this.r_subtotal = 0;
			for (let item in this.r_total) {
				this.r_subtotal = Number(this.r_subtotal.toFixed(2)) + Number(this.r_total[item].toFixed(2));
			}
		}
	}

	calculateBaseRate(form: string): number {
		if (form === 'RatesForm') {
			let temp = 0
			for (let subform in this.RateForm.all_inclusive_rates.controls) {
				let amount = (<FormGroup>((<FormGroup>this.RatesForm.get('all_inclusive_rates')).get(subform))).get("amount").value
				temp += amount
			}
			return temp
		}
		if (form === 'ReturnRatesForm') {
			let temp = 0
			for (let subform in this.ReturnRateForm.all_inclusive_rates.controls) {
				let amount = (<FormGroup>((<FormGroup>this.ReturnRatesForm.get('all_inclusive_rates')).get(subform))).get("amount").value
				temp += amount
			}
			return temp
		}
	}

	calculateGrandTotal(form: "RatesForm" | "ReturnRatesForm") {
		if (form === "RatesForm" && this.RatesForm) {
			if (this.vehicles !== 0) {
				this.grandtotal = Number(this.subtotal.toFixed(2)) * this.vehicles;
			}
			let value = this.RatesForm.value;
			value["grand_total"] = this.grandtotal;
			value["sub_total"] = this.subtotal;
			value["min_rate_involved"] = this.is_readonly_min_rate

			this.formvalue.emit(value);
		}
		if (form == 'ReturnRatesForm' && this.ReturnRatesForm) {
			if (this.vehicles !== 0) {
				this.r_grandtotal = Number(this.r_subtotal.toFixed(2)) * this.vehicles;
			}
			let value = this.ReturnRatesForm.value;
			value["r_grandtotal"] = this.r_grandtotal;
			value["r_subtotal"] = this.r_subtotal

			this.returnformvalue.emit(value);
		}
	}

	toggleDropdown(section: string) {
		this.rate_params["chevrons"][section] = !this.rate_params["chevrons"][section];
	}

	calculateReturnBaseRateShare() {
		const multiplyHours = this.isDaysMode ? this.charterDays : this.hours; 
		try {
			let baseRate = 0;
			if (this.service_type == 'charter_tour') {
				baseRate += (<FormGroup>((<FormGroup>this.ReturnRatesForm.get('all_inclusive_rates'))?.get('Base_Rate')))?.get("baserate").value * multiplyHours
			}
			else {
				baseRate += (<FormGroup>((<FormGroup>this.ReturnRatesForm.get('all_inclusive_rates'))?.get('Base_Rate')))?.get("baserate").value || 0
			}
			['ELH_Charges', 'Stops', 'Wait'].map((i) => {
				baseRate += (<FormGroup>((<FormGroup>this.ReturnRatesForm.get('all_inclusive_rates'))?.get(i)))?.get("baserate").value || 0
			});
			['Baby_Seat', 'Baggage_Meet_(Dom)', 'Baggage_Meet_(Int)', 'Bike_Rack', 'Booster_Seat', 'Golf_Bags',
				'Lei_Greeting_–_Hawaii', 'Luggage_Trailer', 'Per_Diem', 'Red_Carpet', 'Security_/_Guard', 'Skis',
				'Tour_Guide', 'Wedding_Package'].map((j) => {
					baseRate += (<FormGroup>((<FormGroup>this.ReturnRatesForm.get('amenities'))?.get(j)))?.get("baserate").value || 0
				})
			return baseRate;
		} catch (error) {
		}
	}
	calculateReturnAdminShare() {
		let baseRate = this.calculateReturnBaseRateShare()
		const effectiveReturnAffiliateType = this.return_affiliate_type || this.affiliate_type;
		this.admin_share = (this.isTravelShare && !this.isCreatedByAdmin || this.isFarmoutBooking) ? 15 : (this.booking_created_from == 'subscriber') ? 0 : (this.currentUser?.created_by_role == 'subscriber' && effectiveReturnAffiliateType == 'loose_affiliate') ? 0 : 25
		this.r_calc_admin_share = baseRate * this.admin_share / 100 + (this.ReturnRatesForm.get('misc').get('Extra_Gratuity').get('amount').value * 0.25)
		this.isFarmoutBooking ? this.r_farmoutShare = baseRate * 0.10 : ''
	}
	calculateReturnTravelShare() {
		if (!this.isTravelShare && this.isCreatedByAdmin) {
			return 0
		}
		let baseRate = this.calculateReturnBaseRateShare()
		this.r_travel_agent_share = baseRate * this.travel_share / 100
	}

	calculateBaseRateShare() {
			const multiplyHours = this.isDaysMode ? this.charterDays : this.hours; 
		try {
			let baseRate = 0;

			if (this.service_type == 'charter_tour' && !this.is_readonly_min_rate) {
				baseRate += (<FormGroup>((<FormGroup>this.RatesForm.get('all_inclusive_rates'))?.get('Base_Rate')))?.get("baserate").value * multiplyHours;
			}
			else {
				baseRate += (<FormGroup>((<FormGroup>this.RatesForm.get('all_inclusive_rates'))?.get('Base_Rate')))?.get("baserate").value || 0
			}
			['ELH_Charges', 'Stops', 'Wait'].map((i) => {
				baseRate += (<FormGroup>((<FormGroup>this.RatesForm.get('all_inclusive_rates'))?.get(i)))?.get("baserate").value || 0
			});
			['Baby_Seat', 'Baggage_Meet_(Dom)', 'Baggage_Meet_(Int)', 'Bike_Rack', 'Booster_Seat', 'Golf_Bags',
				'Lei_Greeting_–_Hawaii', 'Luggage_Trailer', 'Per_Diem', 'Red_Carpet', 'Security_/_Guard', 'Skis',
				'Tour_Guide', 'Wedding_Package'].map((j) => {
					baseRate += (<FormGroup>((<FormGroup>this.RatesForm.get('amenities'))?.get(j)))?.get("baserate").value || 0
				})


			return baseRate;
		} catch (error) {
		}
	}
	calculateAdminShare() {

		let baseRate = this.calculateBaseRateShare()
		this.admin_share = (this.isTravelShare && !this.isCreatedByAdmin || this.isFarmoutBooking) ? 15 : 25
		this.calc_admin_share = baseRate * this.admin_share / 100 + (this.RatesForm.get('misc').get('Extra_Gratuity').get('amount').value * 0.25)
		// console.log("extra gratuity",this.RatesForm.get('misc').get('Extra_Gratuity').get('amount').value)
		this.isFarmoutBooking ? this.farmoutShare = baseRate * 0.10 : ''
	}
	calculateTravelShare() {
		if (!this.isTravelShare && this.isCreatedByAdmin) {
			return 0
		}
		let baseRate = this.calculateBaseRateShare()
		this.travel_agent_share = baseRate * this.travel_share / 100
	}

	async calculateAmount(form: string, formgroup: string, subform: string) {
		const multiplyHours = this.isDaysMode ? this.charterDays : this.hours; 
		await this.calculateAdminShare()
		await this.calculateTravelShare()
		if (form === "RatesForm") {
			let baserate = (<FormGroup>((<FormGroup>this.RatesForm.get(formgroup)).get(subform))).get("baserate").value;


			if (!baserate) {
				baserate = 0;
			}

			if (["direct_taxes", "amenities", "taxes", "misc"].includes(formgroup)) {
				// Flat Values
				this.RateForm[formgroup].controls[subform].controls.amount.setValue(baserate);
				// initially run for taxes also because default value will be flat
			}

			if (formgroup == "all_inclusive_rates") {
				let amount = 0;

				// Hourly Rate - only in case of charter_tour
				if (this.hours != 0 && subform == 'Base_Rate' && !this.is_readonly_min_rate && this.service_type === 'charter_tour') {
					amount = Number(Number(Number(multiplyHours) * baserate).toFixed(2))
					
				} else {
					amount = baserate;
				}

				// Admin Share Calculation
				if (subform == 'Base_Rate' && !this.is_readonly_min_rate) {
					// this.calc_admin_share = (amount * this.admin_share) / 100;
					// amount = parseFloat((amount + this.calc_admin_share).toFixed(2));
				}
				if (this.isTravelShare && subform == 'Base_Rate') {
					let min_rate = (<FormGroup>((<FormGroup>this.RatesForm.get(formgroup)).get(subform))).get("baserate").value;
					// this.travel_agent_share = (min_rate * this.travel_share) / 100
					// amount = amount + this.travel_agent_share;
				}
				if (this.is_readonly_min_rate && subform == 'Base_Rate') {
					let min_rate = (<FormGroup>((<FormGroup>this.RatesForm.get(formgroup)).get(subform))).get("baserate").value;
					// this.calc_admin_share = (min_rate * this.admin_share) / 100
					// amount = amount + this.calc_admin_share;   
				}

				(<FormGroup>((<FormGroup>this.RatesForm.get(formgroup)).get(subform))).get("amount").setValue(amount);
			}



			if (formgroup == "taxes") {
				let type = (<FormGroup>((<FormGroup>this.RatesForm.get(formgroup)).get(subform))).get("type").value;
				if (type === "flat" || type == null) {
					(<FormGroup>((<FormGroup>this.RatesForm.get(formgroup)).get(subform))).get("amount").setValue(baserate);
				}

				if (type === "percent") {
					// let kmrate = (<FormGroup>((<FormGroup>(this.RatesForm.get("all_inclusive_rates"))).get("Base_Rate"))).get("amount").value;
					// - this.calc_admin_share - this.travel_agent_share;
					let kmrate = await this.calculateBaseRate('RatesForm');
					let taxvalue = (<FormGroup>((<FormGroup>this.RatesForm.get("taxes")).get(subform))).get("baserate").value;

					let amount = Number(Number((taxvalue / 100) * kmrate).toFixed(2));

					(<FormGroup>((<FormGroup>this.RatesForm.get(formgroup)).get(subform))).get("amount").setValue(amount);
				}
				// On Change of Flat | Percentage - Taxes
				(<FormGroup>((<FormGroup>this.RatesForm.get("taxes")).get(subform))).get("type").valueChanges.subscribe((value: any) => {
					this.calculateAmount("RatesForm", formgroup, subform);
				});
			}

			let amount = (<FormGroup>((<FormGroup>this.RatesForm.get(formgroup)).get(subform))).get("amount").value;
			this.total[subform] = Number(Number(amount).toFixed(2));
			if (formgroup == 'amenities' || formgroup == "all_inclusive_rates") {
				let baseRateAmount = (<FormGroup>((<FormGroup>this.RatesForm.get('all_inclusive_rates')).get('Base_Rate'))).get("baserate").value;
				if (this.service_type == 'charter_tour' && !this.is_readonly_min_rate) {
					baseRateAmount = (<FormGroup>((<FormGroup>this.RatesForm.get('all_inclusive_rates')).get('Base_Rate'))).get("baserate").value * multiplyHours;
				}
				baseRateAmount += this.calc_admin_share
				if (this.isTravelShare && !this.isCreatedByAdmin) {
					baseRateAmount = baseRateAmount + this.travel_agent_share;
				}
				else if (this.isFarmoutBooking) {
					baseRateAmount = baseRateAmount + this.farmoutShare;
				}
				// (<FormGroup>((<FormGroup>this.RatesForm.get('all_inclusive_rates')).get('Base_Rate'))).get("amount").setValue(baseRateAmount);
				this.total['Base_Rate'] = Number(Number(baseRateAmount).toFixed(2));
			}
			this.RatesForm.updateValueAndValidity();
		}

		// --------------------- RETURN RATES FORM ------------------------
		if (form === "ReturnRatesForm") {
			await this.calculateReturnAdminShare()
			await this.calculateReturnTravelShare()
			let baserate = (<FormGroup>((<FormGroup>this.ReturnRatesForm.get(formgroup)).get(subform))).get("baserate").value;

			if (["direct_taxes", "amenities", "taxes", "misc"].includes(formgroup)) {
				// Flat Values
				this.ReturnRateForm[formgroup].controls[subform].controls.amount.setValue(baserate);
				// initially run for taxes also because default value will be flat
			}

			if (formgroup == "all_inclusive_rates") {
				let amount = baserate;
				if (subform == 'Base_Rate') {
					// this.r_calc_admin_share = (amount * this.admin_share) / 100;
					// amount = parseFloat((amount + this.r_calc_admin_share).toFixed(2));
					if (this.isTravelShare && subform == 'Base_Rate') {
						let min_rate = (<FormGroup>((<FormGroup>this.ReturnRatesForm.get(formgroup)).get(subform))).get("baserate").value;
						// this.r_travel_agent_share = (min_rate * this.travel_share) / 100
						// amount = amount + this.r_travel_agent_share;
					}
				}
				(<FormGroup>((<FormGroup>this.ReturnRatesForm.get(formgroup)).get(subform))).get("amount").setValue(amount);
			}

			if (formgroup == "others") {
				// Gratuity
				// let kmrate = (<FormGroup>((<FormGroup>(this.ReturnRatesForm.get("all_inclusive_rates"))).get("Base_Rate"))).get("amount").value;
				let type = (<FormGroup>((<FormGroup>this.ReturnRatesForm.get(formgroup)).get(subform))).get("type").value;
				if (type === "flat") {
					let kmrate = await this.calculateBaseRate('ReturnRatesForm') - this.r_calc_admin_share;
					let basevalue = (<FormGroup>((<FormGroup>this.ReturnRatesForm.get(formgroup)).get(subform))).get("baserate").value;

					let amount = Number(Number(basevalue)).toFixed(2);

					(<FormGroup>((<FormGroup>this.ReturnRatesForm.get(formgroup)).get(subform))).get("amount").setValue(amount);
					// set value of percentage same as gratuity
					(<FormGroup>((<FormGroup>this.ReturnRatesForm.get(formgroup)).get(subform))).get("percentage").setValue(basevalue);
				}

				if (type === "percent") {
					// let kmrate = (<FormGroup>((<FormGroup>(this.ReturnRatesForm.get("all_inclusive_rates"))).get("Base_Rate"))).get("amount").value;
					// let kmrate = await this.calculateBaseRate('ReturnRatesForm') - this.r_calc_admin_share - this.r_travel_agent_share;
					let kmrate = await this.calculateBaseRate('ReturnRatesForm');
					let basevalue = (<FormGroup>((<FormGroup>this.ReturnRatesForm.get(formgroup)).get(subform))).get("baserate").value;

					let amount = Number(Number((basevalue / 100) * kmrate).toFixed(2)
					);

					(<FormGroup>((<FormGroup>this.ReturnRatesForm.get(formgroup)).get(subform))).get("amount").setValue(amount);
					// set value of percentage same as gratuity
					(<FormGroup>((<FormGroup>this.ReturnRatesForm.get(formgroup)).get(subform))).get("percentage").setValue(basevalue);
				}

				// Flat | Percentage - Taxes
				(<FormGroup>((<FormGroup>this.ReturnRatesForm.get("others")).get(subform))).get("type").valueChanges.subscribe((value: any) => {
					this.calculateAmount("ReturnRatesForm", formgroup, subform);
				});

			}

			if (formgroup == "taxes") {
				let type = (<FormGroup>((<FormGroup>this.ReturnRatesForm.get(formgroup)).get(subform))).get("type").value;
				if (type === "flat") {
					(<FormGroup>((<FormGroup>this.ReturnRatesForm.get(formgroup)).get(subform))).get("amount").setValue(baserate);
				}

				if (type === "percent") {
					// let kmrate = (<FormGroup>((<FormGroup>(this.ReturnRatesForm.get("all_inclusive_rates"))).get("Base_Rate"))).get("amount").value;
					// let kmrate = await this.calculateBaseRate('ReturnRatesForm') - this.r_calc_admin_share - this.r_travel_agent_share;
					let kmrate = await this.calculateBaseRate('ReturnRatesForm');
					let taxvalue = (<FormGroup>((<FormGroup>this.ReturnRatesForm.get("taxes")).get(subform))).get("baserate").value;

					let amount = Number(Number((taxvalue / 100) * kmrate).toFixed(2));

					(<FormGroup>((<FormGroup>this.ReturnRatesForm.get(formgroup)).get(subform))).get("amount").setValue(amount);
				}

				// Flat | Percentage - Taxes
				(<FormGroup>((<FormGroup>this.ReturnRatesForm.get("taxes")).get(subform))).get("type").valueChanges.subscribe((value: any) => {
					this.calculateAmount("ReturnRatesForm", formgroup, subform);
				});
			}

			let amount = (<FormGroup>((<FormGroup>this.ReturnRatesForm.get(formgroup)).get(subform))).get("amount").value;
			this.r_total[subform] = Number(Number(amount).toFixed(2));
			if (formgroup == 'amenities' || formgroup == "all_inclusive_rates") {
				let baseRateAmount = (<FormGroup>((<FormGroup>this.ReturnRatesForm.get('all_inclusive_rates')).get('Base_Rate'))).get("baserate").value;
				if (this.service_type == 'charter_tour') {
					baseRateAmount = (<FormGroup>((<FormGroup>this.ReturnRatesForm.get('all_inclusive_rates')).get('Base_Rate'))).get("baserate").value * multiplyHours;
				}
				baseRateAmount += this.r_calc_admin_share
				if (this.isTravelShare && !this.isCreatedByAdmin) {
					baseRateAmount = baseRateAmount + this.r_travel_agent_share;
				}
				else if (this.isFarmoutBooking) {
					baseRateAmount = baseRateAmount + this.r_farmoutShare;
				}
				// (<FormGroup>((<FormGroup>this.RatesForm.get('all_inclusive_rates')).get('Base_Rate'))).get("amount").setValue(baseRateAmount);
				this.r_total['Base_Rate'] = Number(Number(baseRateAmount).toFixed(2));
			}
			this.ReturnRatesForm.updateValueAndValidity();
		}
		// console.log(this.total, this.r_total);
	}
}
