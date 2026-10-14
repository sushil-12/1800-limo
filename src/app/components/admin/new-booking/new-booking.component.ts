import { MapUtils } from '../../../utils/map-utils';
import { attachPlaceAutocompleteElement, clearPlaceAutocompleteDisplay, getBookingAddressSyncControl, syncPlaceAutocompleteDisplay } from '../../../utils/google-place-autocomplete';
import { Component, EventEmitter, OnInit, OnDestroy, Output, ViewChild, isDevMode, ElementRef, ViewChildren, QueryList, viewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormControl, FormArray, ValidationErrors, ValidatorFn, AbstractControl } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { pluck, distinctUntilChanged, debounceTime, map } from 'rxjs/operators';

import { AdminService } from '../../../services/admin.service';
import { SharedModule } from '../../shared/shared.module'
import { NgxSpinnerService } from 'ngx-spinner';
import { ErrorDialogService } from '../../../services/error-dialog/errordialog.service';
import * as moment from 'moment';
import { RatesFormComponent } from '../rates-form/rates-form.component';
import { Observable, of, Subject, Subscription } from 'rxjs';
import {
	AffiliateLookupParams,
	AffiliateLookupState,
	affiliateRankBadge,
	affiliateRankModifier,
	buildRankedAffiliateLabel,
	createAffiliateLookupState,
	formatAffiliateDistance,
	readAffiliateLookupResponse
} from '../../../utils/affiliate-lookup';
import { CustomvalidationService } from '../../../services/customvalidation.service';
import { param } from 'jquery';
import { CommonService } from '../../../services/common.service';
import { HttpClient } from '@angular/common/http';
import { constant_data } from '../../../../assets/js/data';
import { GoogleMap } from '@angular/google-maps';
import * as intlTelInput from 'intl-tel-input';
import { P } from '@angular/cdk/keycodes';
import { NgIf } from '@angular/common';

declare var $: any

@Component({
	selector: 'app-new-booking',
	templateUrl: './new-booking.component.html',
	styleUrls: ['./new-booking.component.scss'],
})
export class NewBookingComponent implements OnInit, OnDestroy {
	// @ViewChildren('autoInput') autoInputs!: QueryList<ElementRef>;
	@ViewChild('lose_aff_name_input') lose_aff_name_input: ElementRef;
	@Output("returnNumberOfHr") returnNumberOfHr = new EventEmitter<number>();
	@ViewChild('pickupInput') pickupInput!: ElementRef;
	@ViewChildren('hourField') hourFields!: QueryList<ElementRef>;
	@ViewChild('dropoffInput') dropoffInput!: ElementRef;
	@ViewChild('loosecustomerInput') loosecustomerInput!: ElementRef;
	@ViewChild('return_pickupInput') return_pickupInput!: ElementRef;
	@ViewChild('return_dropoffInput') return_dropoffInput!: ElementRef;
	@ViewChild('pickupAirportInput') pickupAirportInput!: ElementRef;
	@ViewChild('dropoffAirportInput') dropoffAirportInput!: ElementRef;
	@ViewChild('returnPickupAirportInput') returnPickupAirportInput!: ElementRef;
	@ViewChild('returnDropoffAirportInput') returnDropoffAirportInput!: ElementRef;
	@ViewChild('fboAddressInput') fboAddressInput!: ElementRef;
	@ViewChild('returnFboAddressInput') returnFboAddressInput!: ElementRef;
	@ViewChildren('extraStopInput') extraStopInputs!: QueryList<ElementRef>;
	@ViewChildren('returnExtraStopInput') returnExtraStopInputs!: QueryList<ElementRef>;


	@ViewChild('cellInput') cellInput!: ElementRef;
	@ViewChild('passenger_cellInput') passenger_cellInput!: ElementRef;
	@ViewChild('lose_affiliate_phoneInput') lose_affiliate_phoneInput!: ElementRef;
	@ViewChild('loose_driver_cellInput') loose_driver_cellInput!: ElementRef;
	@ViewChild('driver_cellInput') driver_cellInput!: ElementRef;
	@ViewChild('return_lose_affiliate_phoneInput') return_lose_affiliate_phoneInput!: ElementRef;
	@ViewChild('return_driver_cellInput') return_driver_cellInput!: ElementRef;
	@ViewChild('return_loose_driver_cellInput') return_loose_driver_cellInput!: ElementRef;

	todays_date: string = moment().format('YYYY-MM-DD');
	time_values: Array<any> = constant_data.time_values

    hour_values: Array<any> = constant_data.hour_values   // ADD THIS

	booking_params: any = {
		transfer_types: ["airport_to_city", "airport_to_airport", "airport_to_cruise", "city_to_city", "city_to_airport", "city_to_cruise", "cruise_to_airport", "cruise_to_city"],
		client_account_types: ['individual', 'travel_planner', 'loose_customer'],
		client_account_types_subscriber: ['individual', 'loose_customer'],
		affiliate_accounts: ['affiliate', 'loose_affiliate'],
		numbers: (() => {
			let arr = []
			for (let i = 0; i <= 1000; i++) {
				arr.push(i)
			}
			return arr
		})(),
		years: (() => {
			let arr = []
			let i = 0;
			let year = new Date().getFullYear();
			while (i <= 15) {
				arr.push(year + i);
				i++;
			}
			return arr
		})(),
		chevrons: {
			languages: false,
			dresses: false,
			amenities: false,
			images: false,
			taxnrates: false,
		}
	}

	months: any = [{ value: '01' }, { value: '02' }, { value: '03' }, { value: '04' }, { value: '05' }, { value: '06' }, { value: '07' }, { value: '08' }, { value: '09' }, { value: '10' }, { value: '11' }, { value: '12' }]
	monthOptions: any = [...this.months]
	numbers: any = [...this.booking_params.numbers];
	luggage_options: any = [...this.booking_params.numbers];

	//[{value:'01'},{value:'02'},{value:'03'},{value:'04'},{value:'05'},{value:'06'},{value:'07'},{value:'08'},{value:'09'},{value:'10'},{value:'11'},{value:'12'}]

	LCTelObject: any
	PaxTelObject: any
	driverCellTelInput: any
	returnDriverCellTelInput: any
	loseAffiliateTelInput: any
	returnLoseAffiliateTelInput: any

	BookingForm: FormGroup
	RatesForm: any
	ReturnRatesForm: any

	booking_id: number = 0

	driver_image: Record<string, any> = {}
	vehicle_image: Record<string, any> = {}

	quillModules = {
		toolbar: [
			['bold', 'italic', 'underline'],
			[{ list: 'ordered' }, { list: 'bullet' }],
			['clean']
		]
	};

	BigData: any
	BigData_COPY: any
	AffiliateInformation: Record<string, any> = {}
	activeCustomAddressDropdown: string | null = null;
	activeCustomAirportDropdown: string | null = null;
	private customAddressDropdownBlurTimeout?: ReturnType<typeof setTimeout>;
	private customAirportDropdownBlurTimeout?: ReturnType<typeof setTimeout>;
	private customPlacesService?: google.maps.places.PlacesService;
	private customAddressSearchVersion: Record<string, number> = {};
	private customAirportSearchVersion: Record<string, number> = {};
	private customAddressSearchLoading: Record<string, boolean> = {};
	private customAirportSearchLoading: Record<string, boolean> = {};
	private customAddressOptions: Record<string, Array<any>> = {};
	private customAirportOptions: Record<string, Array<any>> = {};
	private customAirportSearchDebounceTimers: Record<string, ReturnType<typeof setTimeout>> = {};
	private customAirportAutocompleteSessionTokens: Record<string, string> = {};
	ReturnAffiliateInformation: Record<string, any> = {}
	ClientAccounts: Array<Record<string, any>> = []
	AffiliateAccounts: Array<Record<string, any>> = []
	LooseAffiliateAccounts: Array<Record<string, any>> = []
	Return_AffiliateAccounts: Array<Record<string, any>> = []
	Return_LooseAffiliateAccounts: Array<Record<string, any>> = []
	VehicleList: Array<Record<string, any>> = []
	DriverList: Array<Record<string, any>> = []
	vehicleType_arr: any;
	vehicleMake_arr: any;
	vehicleModal_arr: any;
	vehicleYear_arr: any;
	vehicleColor_arr: any;
	return_VehicleList: Array<Record<string, any>> = []
	return_DriverList: Array<Record<string, any>> = []
	return_vehicleType_arr: any;
	return_vehicleMake_arr: any;
	return_vehicleModal_arr: any;
	return_vehicleYear_arr: any;
	return_vehicleColor_arr: any;
	firstLoadVehicleId: any;
	proceed: boolean = true
	chosen_user: Record<string, any>

	distance: number = 0
	return_distance: number = 0
	distance_for_rates: string = ''
	amenities: Array<string> = []

	init_rates: boolean = false
	init_return_rates: boolean = false
	is_loose_customer_unique: boolean = false
	is_booking_edit_case: boolean = false
	reset_button: boolean = false
	submitBookingForm: boolean;
	numberOfHoursError: boolean = false;
	affiliate_id: any;
	newBooking: boolean = false;
	QB_vehicle_id: any = null;
	route_vehicle_id: number | null = null;
	unique_key: any;
	return_unique_key: any;
	firstLoadAffiliateId: void;
	updateType: any = 'create';
	bookingResponse: any;
	service_type: any = 'one_way';
	transfer_type: any = 'city_to_city'
	return_transfer_type: any = 'city_to_city'
	number_of_hours: any = '2';
	// Embedded quote (Vehicle & Affiliate section): 'browse' uses the quotebot
	// drill-down, 'manual' uses the existing affiliate/vehicle/driver dropdowns.
	vehicleSelectionTab: 'browse' | 'manual' = 'browse';
	quotePayload: any = null;
	confirmMsg: any;
	booking_data: any;
	extraStops_rate: any = 0
	selectedVehicle: any;
	return_selectedVehicle: any;
	is_master_vehicle: boolean = JSON.parse(sessionStorage.getItem('selected_vehicle'))?.is_master_vehicle || false
	route_is_master_vehicle: boolean | null = null
	isTravelShare: boolean = false
	travelStaffAccounts: any;
	manual_change_aff_veh: boolean = false;
	isCreatedByAdmin: boolean = true;
	shareArray: any;
	r_shareArray: any;
	adminSharePercent: number = 25;
	isFarmoutBooking: boolean = false;
	private isPrefillingTransferTypes: boolean = false;
	/**
	 * Server-side affiliate lookup state, one set per leg. The list is
	 * searched, ranked by distance from the pickup and paged by the API.
	 */
	affiliateLookup: AffiliateLookupState = createAffiliateLookupState();
	returnAffiliateLookup: AffiliateLookupState = createAffiliateLookupState();
	affiliateTypeahead$ = new Subject<string>();
	returnAffiliateTypeahead$ = new Subject<string>();
	private readonly affiliatePageSize = 50;
	public canceloptions: Array<Object>;
	currencySymbol: any;
	currencyObj: any;
	currentUser: any;
	booking_created_from: string = 'admin';
	veh_created_by: any;
	minDate = new Date();
	waiting_time_in_mins: any = 0;
	bigDataSubscription: Subscription;
	userCreditCards: any[] = [];
	isLoadingSavedCards: boolean = false;
	private bookingAutocompleteRetryTimeout?: ReturnType<typeof setTimeout>;
	isPrefilling: boolean = false;

	constructor(
		private $form: FormBuilder,
		private $api: AdminService,
		private $shared: SharedModule,
		private $spinner: NgxSpinnerService,
		private $errors: ErrorDialogService,
		private $router: Router,
		private $routeurl: ActivatedRoute,
		private commonServices: CommonService,
		private customValidator: CustomvalidationService,
		private el: ElementRef,
		private httpClient: HttpClient,
	) { }

	ngOnInit(): void {


		this.currentUser = JSON.parse(localStorage.getItem("currentUser"))
		// build the form first 
		this.buildBookingForm()
		this.initAffiliateSearchStream()
		this.$routeurl.queryParams.subscribe((params: any) => {
			const isNewBookingFlow = params?.new === true || params?.new === 'true';
			const hasMasterVehicleParam = params?.is_master_vehicle !== undefined;
			const routeIsMasterVehicle = params?.is_master_vehicle === true || params?.is_master_vehicle === 'true';
			console.log('admin/new-booking queryParams', params, { isNewBookingFlow });
			if (params && params.bookingId && !this.booking_id) {
				this.is_booking_edit_case = true
				this.updateType = params.updateType
				this.SetFormValue('reservation_id', params.bookingId)
				params.updateType ? this.SetFormValue('updateType', params.updateType) : this.SetFormValue('updateType', 'edit')
				this.BookingForm.get('prevent_rate_override')?.setValue(this.updateType === 'edit');
				// arriving with an existing booking -> fields are prefilled, show manual tab
				this.vehicleSelectionTab = 'manual';
				this.checkAndPrefill();
			}
			else if (params && isNewBookingFlow) {
				this.newBooking = true
				this.affiliate_id = parseInt(params?.affiliate_id)
				const routeVehicleId = Number(params?.vehicle_id);
				this.route_vehicle_id = Number.isFinite(routeVehicleId) && routeVehicleId > 0 ? routeVehicleId : null;
				this.booking_created_from = params?.created_by
				if (hasMasterVehicleParam) {
					this.route_is_master_vehicle = routeIsMasterVehicle;
					this.is_master_vehicle = routeIsMasterVehicle;
				}
				// arrived from the standalone quotebot with a chosen vehicle -> show manual tab (prefilled)
				this.vehicleSelectionTab = 'manual';
			}
			else if (params?.reaffiliate_book_id) {
				this.updateType = params?.updateType
				this.newBooking = true
				console.log("in reaffiliate update type book id", params?.reaffiliate_book_id)
				this.SetFormValue('reservation_id', params.reaffiliate_book_id)
				this.vehicleSelectionTab = 'manual';
				this.checkAndPrefill();
			}
			else {
				// fresh booking -> default to the embedded quote browser
				this.vehicleSelectionTab = 'browse';
				this.resetFields()
			}
			// this.currencyObj = JSON.parse(sessionStorage.getItem('currencyData')) ? JSON.parse(sessionStorage.getItem('currencyData')) : null
			this.currencySymbol = JSON.parse(localStorage.getItem('currencySymbol'))
			console.log('admin/new-booking is_master_vehicle source', {
				routeValue: params?.is_master_vehicle,
				routeResolved: hasMasterVehicleParam ? routeIsMasterVehicle : 'no-param',
				sessionValue: JSON.parse(sessionStorage.getItem('selected_vehicle'))?.is_master_vehicle,
				finalValue: this.is_master_vehicle
			});

			// place in query params to reinitialise things when modes of new and edit are toggled
			// Subscriptions
			this.Subscriptions()
			this.fetchClientAccounts('individual')
			this.fetchAffiliates('affiliate')
			this.fetchReturnAffiliates('affiliate')
			this.select(true, 'driver_languages', 1)
		})
		// fetch the big data
		this.fetchAirportsAndBigData()

		this.httpClient.get("assets/json/charterOptions.json").subscribe((data: any) => {
			this.canceloptions = data;
		});

		// if susbcriber then add companmy name in read only field and call vehicles by their account id
		if (this.currentUser?.created_by_role == 'subscriber' && !this.newBooking) {
			this.BookingForm.patchValue({
				susbcriber_name: this.currentUser?.name,
				// driver_name: this.currentUser?.name,
				// driver_email: this.currentUser.email,
				// driver_cell_isd: this.currentUser?.isd,
				// driver_cell: this.currentUser?.phone,
				// driver_cell_country: this.currentUser?.phoneCountry
			})
			this.fetchAffiliateVehicles(this.currentUser?.account_id)
			this.fetchAffiliateDrivers(this.currentUser?.account_id)
			this.booking_created_from = 'subscriber'
		}

	}

	onInstructionsEditorCreated(editor: any): void {
	 // Optional: focus or configure editor instance
	 editor.focus();
	}

	ngOnDestroy(): void {
		if (this.bookingAutocompleteRetryTimeout) {
			clearTimeout(this.bookingAutocompleteRetryTimeout);
		}
		Object.values(this.customAirportSearchDebounceTimers).forEach((timer) => clearTimeout(timer));
		this.customAirportSearchDebounceTimers = {};
		this.customAirportAutocompleteSessionTokens = {};
		if (this.bigDataSubscription) {
			this.bigDataSubscription.unsubscribe();
		}
	}

	change2() {
		console.log("im heere")
	}

	buildBookingData() {
		console.log('rebuild booking data')
		const vehicleId = this.BookingForm.get('vehicle_id').value;
		const hasEmptyVehicleId =
			vehicleId === null ||
			vehicleId === undefined ||
			vehicleId === '';
		const isMasterVehiclePayload =
			vehicleId === 0 ||
			vehicleId === '0' ||
			hasEmptyVehicleId ||
			this.is_master_vehicle === true;
		const vehicleTypeId = this.BookingForm.get('vehicle_type').value;
		// master-vehicle bookings must not fall back to the vehicle-type id
		const effectiveVehicleId = vehicleId || this.QB_vehicle_id || this.route_vehicle_id || this.firstLoadVehicleId || (isMasterVehiclePayload ? '' : vehicleTypeId) || '';
		console.log('[buildBookingData] vehicle_id sources', {
			formVehicleId: vehicleId,
			QB_vehicle_id: this.QB_vehicle_id,
			route_vehicle_id: this.route_vehicle_id,
			firstLoadVehicleId: this.firstLoadVehicleId,
			vehicleTypeId,
			effectiveVehicleId,
			booking_id: this.booking_id
		});
		const returnVehicleId = this.BookingForm.get('return_vehicle_id').value;
		const returnVehicleTypeId = this.BookingForm.get('return_vehicle_type').value;
		const effectiveReturnVehicleId = returnVehicleId || returnVehicleTypeId || effectiveVehicleId;
		const affiliateId = this.BookingForm.get('affiliate_id').value;
		const returnAffiliateId = this.BookingForm.get('return_affiliate_id').value || affiliateId;
		const affiliateType = this.BookingForm.get('affiliate_type').value;
		const returnAffiliateType = this.BookingForm.get('return_affiliate_type').value || affiliateType;
		const transferType = this.BookingForm.get('transfer_type').value;
		const returnTransferType = this.BookingForm.get('return_transfer_type').value;
		const serviceType = this.BookingForm.get('service_type').value;
		this.booking_data = {
			affiliate_id: affiliateId,
			return_affiliate_id: returnAffiliateId,
			vehicle_id: effectiveVehicleId,
			return_vehicle_id: effectiveReturnVehicleId,
			transfer_type: transferType,
			return_transfer_type: returnTransferType,
			service_type: serviceType,
			numberOfVehicles: 1,
			distance: this.distance,
			return_distance: this.return_distance,
			no_of_hours: this.number_of_hours === 0 ? 2 : this.number_of_hours,
			is_master_vehicle: isMasterVehiclePayload,
			extra_stops: this.BookingForm.get('extra_stops').value,
			return_extra_stops: this.BookingForm.get('return_extra_stops').value,
			manual_change_aff_veh: this.manual_change_aff_veh,
			pickup_time: this.BookingForm.get('pickup_time').value,
			return_pickup_time: this.BookingForm.get('return_pickup_time').value,
			affiliate_type: affiliateType,
			return_affiliate_type: returnAffiliateType
		}
		console.log('admin/new-booking booking_data payload', this.booking_data)
	}

	// ---------------------------------------------------------------------------
	// Embedded quote ("Browse vehicles" tab)
	// ---------------------------------------------------------------------------

	/**
	 * Map the booking form's pickup/dropoff/service fields into the quotebot payload
	 * shape (the same object the standalone quotebot stores as `quotebot_form` and that
	 * the home page builds). Mirrors home.component's payload: pickup_type/dropoff_type
	 * come from the `<pickup>_to_<dropoff>` transfer_type, addresses are always carried,
	 * and `location_info` (distance/duration) is included because the rate API needs it.
	 */
	private buildQuotePayload(): any {
		const transferType = this.Form.transfer_type.value || '';
		const [pickupTypeRaw, dropoffTypeRaw] = transferType.split('_to_');
		const pickupType = pickupTypeRaw || 'city';
		const dropoffType = dropoffTypeRaw || 'city';

		const returnTransferType = this.Form.return_transfer_type.value || '';
		const [returnPickupTypeRaw, returnDropoffTypeRaw] = returnTransferType.split('_to_');

		const isAirportPickup = pickupType === 'airport';
		const isAirportDropoff = dropoffType === 'airport';
		const isRoundTrip = this.Form.service_type.value === 'round_trip';

		// distance/duration drives rate calculation on the backend
		const location_info: any[] = [];
		const dist = this.distance || 0;
		const time = Number(this.Form.journeyTime.value) || 0;
		if (dist > 0) {
			location_info.push({
				distance: { text: (dist / 1000).toFixed(1) + ' km', value: Math.round(dist) },
				duration: { text: time > 0 ? Math.round(time / 60) + ' mins' : '0 mins', value: Math.round(time) }
			});
		}
		if (isRoundTrip) {
			const retDist = this.return_distance || 0;
			const retTime = Number(this.Form.returnJourneyTime.value) || 0;
			if (retDist > 0) {
				location_info.push({
					distance: { text: (retDist / 1000).toFixed(1) + ' km', value: Math.round(retDist) },
					duration: { text: retTime > 0 ? Math.round(retTime / 60) + ' mins' : '0 mins', value: Math.round(retTime) }
				});
			}
		}

		const extraStops = this.Form.extra_stops.value || [];
		const returnExtraStops = this.Form.return_extra_stops.value || [];

		const payload: any = {
			service_type: this.Form.service_type.value,
			booking_hour: String(this.Form.number_of_hours.value ?? '2'),
			pickup_type: pickupType,
			dropoff_type: dropoffType,
			pickup_date: this.Form.pickup_date.value,
			pickup_time: this.Form.pickup_time.value,

			pickup_airport: isAirportPickup ? (this.Form.pickup_airport.value || null) : null,
			pickup_airport_name: isAirportPickup ? (this.Form.pickup_airport_option.value || this.Form.pickup_airport_name.value || '') : '',
			pickup_airport_lat: isAirportPickup ? (this.Form.pickup_airport_latitude.value || null) : null,
			pickup_airport_long: isAirportPickup ? (this.Form.pickup_airport_longitude.value || null) : null,

			pickup_address: this.Form.pickup.value || '',
			pickup_address_lat: this.Form.pickup_latitude.value || null,
			pickup_address_long: this.Form.pickup_longitude.value || null,

			dropoff_airport: isAirportDropoff ? (this.Form.dropoff_airport.value || null) : null,
			dropoff_airport_name: isAirportDropoff ? (this.Form.dropoff_airport_option.value || this.Form.dropoff_airport_name.value || '') : '',
			dropoff_airport_lat: isAirportDropoff ? (this.Form.dropoff_airport_latitude.value || null) : null,
			dropoff_airport_long: isAirportDropoff ? (this.Form.dropoff_airport_longitude.value || null) : null,

			dropoff_address: this.Form.dropoff.value || '',
			dropoff_address_lat: this.Form.dropoff_latitude.value || null,
			dropoff_address_long: this.Form.dropoff_longitude.value || null,

			return_pickup_date: this.Form.return_pickup_date.value || this.Form.pickup_date.value,
			return_pickup_time: this.Form.return_pickup_time.value,

			return_pickup_airport: isRoundTrip && returnPickupTypeRaw === 'airport' ? (this.Form.return_pickup_airport.value || '') : '',
			return_pickup_airport_name: isRoundTrip && returnPickupTypeRaw === 'airport' ? (this.Form.return_pickup_airport_option.value || '') : '',
			return_pickup_airport_lat: isRoundTrip && returnPickupTypeRaw === 'airport' ? (this.Form.return_pickup_airport_latitude.value || '') : '',
			return_pickup_airport_long: isRoundTrip && returnPickupTypeRaw === 'airport' ? (this.Form.return_pickup_airport_longitude.value || '') : '',

			return_pickup_address: isRoundTrip ? (this.Form.return_pickup.value || '') : '',
			return_pickup_address_lat: isRoundTrip ? (this.Form.return_pickup_latitude.value || '') : '',
			return_pickup_address_long: isRoundTrip ? (this.Form.return_pickup_longitude.value || '') : '',

			return_dropoff_airport: isRoundTrip && returnDropoffTypeRaw === 'airport' ? (this.Form.return_dropoff_airport.value || '') : '',
			return_dropoff_airport_name: isRoundTrip && returnDropoffTypeRaw === 'airport' ? (this.Form.return_dropoff_airport_option.value || '') : '',
			return_dropoff_airport_lat: isRoundTrip && returnDropoffTypeRaw === 'airport' ? (this.Form.return_dropoff_airport_latitude.value || '') : '',
			return_dropoff_airport_long: isRoundTrip && returnDropoffTypeRaw === 'airport' ? (this.Form.return_dropoff_airport_longitude.value || '') : '',

			return_dropoff_address: isRoundTrip ? (this.Form.return_dropoff.value || '') : '',
			return_dropoff_address_lat: isRoundTrip ? (this.Form.return_dropoff_latitude.value || '') : '',
			return_dropoff_address_long: isRoundTrip ? (this.Form.return_dropoff_longitude.value || '') : '',

			no_of_passenger: this.Form.total_passengers.value || 1,
			no_of_luggage: this.Form.luggage_count.value || 0,
			return_no_of_passenger: this.Form.total_passengers.value || 1,
			return_no_of_luggage: this.Form.luggage_count.value || 0,

			location_info: location_info,
			other_details: {},

			extra_stops: extraStops.map((stop: any) => ({
				address: stop.address || '',
				latitude: stop.latitude || '',
				longitude: stop.longitude || ''
			})),
			return_extra_stops: isRoundTrip
				? returnExtraStops.map((stop: any) => ({
					address: stop.address || '',
					latitude: stop.latitude || '',
					longitude: stop.longitude || ''
				}))
				: [],

			amenities: this.Form.amenities.value || [],
			chargedAmenities: this.Form.chargedAmenities.value || []
		};

		// keep the canonical quote store consistent for any code that reads it
		localStorage.setItem('quotebot_form', JSON.stringify(payload));
		return payload;
	}

	/** "Search vehicles" button: validate inputs and (re)build the quote payload. */
	runEmbeddedQuote(): void {
		const payload = this.buildQuotePayload();
		const hasPickup = !!(payload.pickup_airport_lat || payload.pickup_address_lat);
		const hasDropoff = !!(payload.dropoff_airport_lat || payload.dropoff_address_lat);

		if (!payload.service_type) {
			this.$errors.openDialog({ errors: { error: 'Please choose a service type first.' } });
			return;
		}
		if (!hasPickup || !hasDropoff) {
			this.$errors.openDialog({ errors: { error: 'Please enter pickup and drop-off locations before searching for vehicles.' } });
			return;
		}

		// fresh object reference so <app-embedded-quote> ngOnChanges fires
		this.quotePayload = { ...payload };
	}

	/**
	 * A vehicle was picked in the embedded quote. Reuse the same affiliate flow that
	 * powers the standalone-quotebot arrival: set the IDs, then let
	 * fetchQBAffiliateVehicles auto-select the matching vehicle (via QB_vehicle_id ->
	 * handleSelectVehicleType) and prefill the editable manual fields.
	 */
	onQuoteVehicleSelected(vehicle: any): void {
		if (!vehicle) {
			return;
		}
		sessionStorage.setItem('selected_vehicle', JSON.stringify(vehicle));
		this.affiliate_id = vehicle.affiliate_id;
		this.QB_vehicle_id = vehicle.id;
		this.is_master_vehicle = !!vehicle.is_master_vehicle;

		if (vehicle.is_master_vehicle) {
			// Master vehicles have no affiliate — mirror the direct quotebot flow:
			// use loose_affiliate type and prefill vehicle fields from master vehicle info.
			this.BookingForm.patchValue({
				affiliate_type: 'loose_affiliate',
				affiliate_id: '',
				loose_affiliate_id: ''
			});
			const masterVehicleId = Number(vehicle.id || vehicle.ID || 0);
			if (masterVehicleId > 0) {
				this.loadMasterVehicleInfoForQuoteBot(masterVehicleId);
			}
		} else {
			this.BookingForm.patchValue({
				affiliate_type: 'affiliate',
				affiliate_id: vehicle.affiliate_id
			});
			this.fetchAffiliateInformation(vehicle.affiliate_id);
			this.fetchQBAffiliateVehicles(vehicle.affiliate_id);
			this.fetchAffiliateDrivers(vehicle.affiliate_id);
		}

		// reveal the now-populated, still-editable manual fields
		this.vehicleSelectionTab = 'manual';
		this.buildBookingData();
	}

	ngAfterViewInit(): void {

		console.log('<<<<<<<<<<<<<<<<<<<<<-----------ng after view init--------------->>>>>>>>>>>>>')
		if (this.updateType == 'repeat' || this.updateType == 'return' || this.updateType == 'edit' || this.updateType == 'round') {
			this.scroll('pickup_adress')
			this.SetFormValue('pickup_date', moment().format('YYYY-MM-DD'))
		}

		this.retryGoogleAutocompleteInitialization()

		// Re-initialize when dynamic views update
		this.extraStopInputs.changes.subscribe(() => {
			setTimeout(() => this.retryGoogleAutocompleteInitialization(), 100);
		});

		this.returnExtraStopInputs.changes.subscribe(() => {
			setTimeout(() => this.retryGoogleAutocompleteInitialization(), 100);
		});

		this.initphonefield()

	}

	private retryGoogleAutocompleteInitialization(attempts = 10, delay = 250): void {
		if (this.bookingAutocompleteRetryTimeout) {
			clearTimeout(this.bookingAutocompleteRetryTimeout);
		}

		const tryAttach = (remainingAttempts: number) => {
			const googleReady = typeof google !== 'undefined' && !!google?.maps;
			const hasAnyInput =
				!!this.pickupInput?.nativeElement ||
				!!this.dropoffInput?.nativeElement ||
				!!this.loosecustomerInput?.nativeElement ||
				!!this.return_pickupInput?.nativeElement ||
				!!this.return_dropoffInput?.nativeElement ||
				!!this.pickupAirportInput?.nativeElement ||
				!!this.dropoffAirportInput?.nativeElement ||
				!!this.returnPickupAirportInput?.nativeElement ||
				!!this.returnDropoffAirportInput?.nativeElement ||
				!!this.fboAddressInput?.nativeElement ||
				!!this.returnFboAddressInput?.nativeElement ||
				(this.extraStopInputs?.length ?? 0) > 0 ||
				(this.returnExtraStopInputs?.length ?? 0) > 0;

			if (googleReady && hasAnyInput) {
				this.initAllAutocompletes();
				this.resyncAirportAutocompleteDisplays();
				return;
			}

			if (remainingAttempts > 1) {
				this.bookingAutocompleteRetryTimeout = setTimeout(() => {
					tryAttach(remainingAttempts - 1);
				}, delay);
			}
		};

		tryAttach(attempts);
	}

	initphonefield() {
		console.log("in init phone", this.cellInput, this.passenger_cellInput, this.driver_cellInput, this.lose_affiliate_phoneInput, this.return_driver_cellInput)

		let countryCode = 'auto';
		if (this.currentUser && (this.currentUser.phoneCountry || this.currentUser.country)) {
			countryCode = this.currentUser.phoneCountry || this.currentUser.country;
		}

		const telOptions: any = this.commonServices.getTelInputOptions(countryCode);

		const getInitCountry = (formControlName: string) => {
			const val = this.BookingForm.get(formControlName)?.value;
			return (val && val !== '') ? val : countryCode;
		};

		if (this.passenger_cellInput) {
			const existing = (window as any).intlTelInputGlobals?.getInstance(this.passenger_cellInput.nativeElement);
			if (existing) existing.destroy();
			const passengerCountry = getInitCountry('passenger_cell_country');
			this.PaxTelObject = intlTelInput(this.passenger_cellInput.nativeElement, this.commonServices.getTelInputOptions(passengerCountry));

			this.addCustomCountrySearch(this.passenger_cellInput.nativeElement);
			this.passenger_cellInput.nativeElement.addEventListener('countrychange', () => {
				const countryData = this.PaxTelObject.getSelectedCountryData();
				console.log("in country chnage", countryData)
				this.SetFormValue('passenger_cell_isd', '+' + countryData.dialCode); this.SetFormValue('passenger_cell_country', countryData.iso2)
				this.validatePassengerPhone();
			});
		}

		if (this.cellInput) {
			const existing = (window as any).intlTelInputGlobals?.getInstance(this.cellInput.nativeElement);
			if (existing) existing.destroy();
			const lcCountry = getInitCountry('cell_country');
			this.LCTelObject = intlTelInput(this.cellInput.nativeElement, this.commonServices.getTelInputOptions(lcCountry));

			this.addCustomCountrySearch(this.cellInput.nativeElement);
			this.cellInput.nativeElement.addEventListener('countrychange', () => {
				const countryData = this.LCTelObject.getSelectedCountryData();
				console.log("in country chnage", countryData)
				this.onLCTeleCountryChange(countryData);
				// Removed PaxTelObject cross-update to ensure isolation
				this.validateLooseCustomerPhone();
			});
		}

		if (this.driver_cellInput || this.loose_driver_cellInput) {
			const input = this.driver_cellInput || this.loose_driver_cellInput;
			const existing = (window as any).intlTelInputGlobals?.getInstance(input.nativeElement);
			if (existing) existing.destroy();
			const driverCountry = getInitCountry('driver_cell_country');
			this.driverCellTelInput = intlTelInput(input.nativeElement, this.commonServices.getTelInputOptions(driverCountry));

			this.addCustomCountrySearch(input.nativeElement);
			input.nativeElement.addEventListener('countrychange', () => {
				const countryData = this.driverCellTelInput.getSelectedCountryData();
				console.log("in country chnage", countryData)
				this.SetFormValue('driver_cell_isd', '+' + countryData.dialCode); this.SetFormValue('driver_cell_country', countryData.iso2)
				this.validateDriverCell();
			});
		}

		if (this.return_driver_cellInput || this.return_loose_driver_cellInput) {
			const input = this.return_driver_cellInput || this.return_loose_driver_cellInput;
			const existing = (window as any).intlTelInputGlobals?.getInstance(input.nativeElement);
			if (existing) existing.destroy();
			const returnDriverCountry = getInitCountry('return_driver_cell_country');
			this.returnDriverCellTelInput = intlTelInput(input.nativeElement, this.commonServices.getTelInputOptions(returnDriverCountry));

			this.addCustomCountrySearch(input.nativeElement);
			input.nativeElement.addEventListener('countrychange', () => {
				const countryData = this.returnDriverCellTelInput.getSelectedCountryData();
				console.log("in country chnage", countryData)
				this.SetFormValue('return_driver_cell_isd', '+' + countryData.dialCode); this.SetFormValue('return_driver_cell_country', countryData.iso2)
				this.validateReturnDriverCell();
			});
		}

		if (this.lose_affiliate_phoneInput) {
			const existing = (window as any).intlTelInputGlobals?.getInstance(this.lose_affiliate_phoneInput.nativeElement);
			if (existing) existing.destroy();
			const laCountry = getInitCountry('lose_affiliate_phone_country');
			this.loseAffiliateTelInput = intlTelInput(this.lose_affiliate_phoneInput.nativeElement, this.commonServices.getTelInputOptions(laCountry));

			this.addCustomCountrySearch(this.lose_affiliate_phoneInput.nativeElement);
			this.lose_affiliate_phoneInput.nativeElement.addEventListener('countrychange', () => {
				const countryData = this.loseAffiliateTelInput.getSelectedCountryData();
				console.log("in country chnage", countryData)
				this.handleCountryChangeLA(countryData);
				this.validateLooseAffiliatePhone();
			});
		}

		if (this.return_lose_affiliate_phoneInput) {
			const existing = (window as any).intlTelInputGlobals?.getInstance(this.return_lose_affiliate_phoneInput.nativeElement);
			if (existing) existing.destroy();
			const returnLACountry = getInitCountry('return_lose_affiliate_phone_country');
			this.returnLoseAffiliateTelInput = intlTelInput(this.return_lose_affiliate_phoneInput.nativeElement, this.commonServices.getTelInputOptions(returnLACountry));

			this.addCustomCountrySearch(this.return_lose_affiliate_phoneInput.nativeElement);
			this.return_lose_affiliate_phoneInput.nativeElement.addEventListener('countrychange', () => {
				const countryData = this.returnLoseAffiliateTelInput.getSelectedCountryData();
				console.log("in country chnage", countryData)
				this.SetFormValue('return_lose_affiliate_phone_isd', '+' + countryData.dialCode); this.SetFormValue('return_lose_affiliate_phone_country', countryData.iso2)
				this.handleReturnCountryChangeLA(countryData);
				// Removed return driver cross-updates to ensure isolation
				this.validateReturnLooseAffiliatePhone();
			});
		}


	}

	numberOnly(event: any): boolean {
		const charCode = (event.which) ? event.which : event.keyCode;
		// Allow: backspace, delete, tab, escape, enter, + symbol (43)
		if (charCode === 43) {
			return true;
		}
		if (charCode > 31 && (charCode < 48 || charCode > 57)) {
			return false;
		}
		return true;
	}

	validatePhoneGeneric(control: AbstractControl, telInputObject: any) {
		if (telInputObject) {
			const value = control.value;
			if (!value) {
				// If empty, let required validator handle it. Remove our intl error if present.
				if (control.errors) {
					const { invalidIntl, ...otherErrors } = control.errors;
					control.setErrors(Object.keys(otherErrors).length > 0 ? otherErrors : null);
				}
				return;
			}
			const isValid = telInputObject.isValidNumber();

			if (!isValid) {
				const errorCode = telInputObject.getValidationError();
				const errorMsg = ["Invalid phone number", "Invalid country code", "Invalid phone number", "Invalid phone number", "Invalid phone number"][errorCode] || "Invalid phone number";
				const currentErrors = control.errors || {};
				control.setErrors({ ...currentErrors, 'invalidIntl': errorMsg });
			} else {
				// Remove invalidIntl error if exists
				if (control.errors) {
					const { invalidIntl, ...otherErrors } = control.errors;
					control.setErrors(Object.keys(otherErrors).length > 0 ? otherErrors : null);
				}
			}
		}
	}

	validateLooseCustomerPhone() {
		this.validatePhoneGeneric(this.LooseCustomer.phone, this.LCTelObject);
	}

	validatePassengerPhone() {
		this.validatePhoneGeneric(this.Form.passenger_cell, this.PaxTelObject);
	}

	validateLooseAffiliatePhone() {
		this.validatePhoneGeneric(this.Form.lose_affiliate_phone, this.loseAffiliateTelInput);
	}

	validateDriverCell() {
		if (this.Form.affiliate_type.value == 'loose_affiliate') {
			this.validatePhoneGeneric(this.Form.driver_cell, this.driverCellTelInput);
		}
	}

	validateReturnDriverCell() {
		if (this.Form.return_affiliate_type.value == 'loose_affiliate') {
			this.validatePhoneGeneric(this.Form.return_driver_cell, this.returnDriverCellTelInput);
		}
	}

	validateReturnLooseAffiliatePhone() {
		this.validatePhoneGeneric(this.Form.return_lose_affiliate_phone, this.returnLoseAffiliateTelInput);
	}





	initAllAutocompletes() {
		setTimeout(() => {
		}, 200);
	}

	initAutocomplete(input: ElementRef | HTMLInputElement, control: string, index?: number, is_return: boolean = false) {
		const nativeInput = input instanceof ElementRef ? input.nativeElement : input;
		console.log("initautocomplete", nativeInput)

		void attachPlaceAutocompleteElement(
			nativeInput,
			{
				types: ['geocode', 'establishment'],
				fields: ['formatted_address', 'geometry', 'place_id', 'name', 'address_components', 'types'],
				syncControl: getBookingAddressSyncControl(this.BookingForm, control, index),
			},
			(place) => {
				if (!place.geometry || !place.geometry.location) return;

				const formattedAddress = place.formatted_address ?? '';
				const placeName = place.name ?? '';
				const displayAddress = placeName ? `${placeName} - ${formattedAddress}` : formattedAddress;
				const location = {
					latitude: place.geometry.location.lat(),
					longitude: place.geometry.location.lng()
				};

				if (control === 'loose_customer') {
					this.fillLooseCustomerAddress(place);
					nativeInput.value = displayAddress;
					return;
				}

				if (control === 'extra_stops' || control === 'return_extra_stops') {
					this.fillExtraStop(!!is_return, index!, { formatted_address: formattedAddress, display_address: displayAddress }, location);
					nativeInput.value = displayAddress;
				} else {
					this.fillAddress(control, { formatted_address: formattedAddress, display_address: displayAddress });
					this.fillLocationPoints(control, location);
					nativeInput.value = displayAddress;
				}
			}
		);
	}

	initAirportAutocomplete(input: ElementRef | HTMLInputElement, control: string) {
		const nativeInput = input instanceof ElementRef ? input.nativeElement : input;
		console.log("init airport autocomplete", nativeInput, control)
		const airportDisplayValue =
			this.BookingForm.get(`${control}_option`)?.value
			|| this.BookingForm.get(`${control}_name`)?.value
			|| '';

		nativeInput.value = airportDisplayValue;

		void attachPlaceAutocompleteElement(
			nativeInput,
			{
				airportField: true,
				primaryTypes: ['airport'],
				syncControl: this.BookingForm.get(`${control}_option`) ?? undefined,
			},
			(place) => {
				if (!place.geometry || !place.geometry.location) return;
				this.handleAirportPlaceSelection(control, place);
				nativeInput.value = this.getAirportSelectionLabel(place);
			}
		).then(() => {
			const latestAirportDisplayValue =
				this.BookingForm.get(`${control}_option`)?.value
				|| this.BookingForm.get(`${control}_name`)?.value
				|| '';
			nativeInput.value = latestAirportDisplayValue;
			syncPlaceAutocompleteDisplay(nativeInput);
			setTimeout(() => {
				nativeInput.value = latestAirportDisplayValue;
				syncPlaceAutocompleteDisplay(nativeInput);
			}, 150);
		});
	}

	private isTouchBookingInteraction(): boolean {
		if (typeof window === 'undefined') {
			return false;
		}

		return window.matchMedia('(pointer: coarse)').matches || window.innerWidth <= 1024;
	}

	private getGoogleMapsApiKey(): string {
		if (typeof document === 'undefined') {
			return '';
		}

		const script = Array.from(document.querySelectorAll('script[src]')).find((item) =>
			item.getAttribute('src')?.includes('maps.googleapis.com/maps/api/js')
		);

		if (!script) {
			return '';
		}

		try {
			const scriptUrl = new URL(script.getAttribute('src') || '', window.location.origin);
			return scriptUrl.searchParams.get('key') || '';
		} catch {
			return '';
		}
	}

	private getCustomPlacesService(): google.maps.places.PlacesService | null {
		if (typeof google === 'undefined' || !google?.maps?.places) {
			return null;
		}

		if (!this.customPlacesService) {
			this.customPlacesService = new google.maps.places.PlacesService(document.createElement('div'));
		}

		return this.customPlacesService;
	}

	getExtraStopFieldKey(isReturn: boolean, index: number): string {
		return `${isReturn ? 'return_extra_stops' : 'extra_stops'}:${index}`;
	}

	private parseExtraStopFieldKey(fieldName: string): { formArrayName: 'extra_stops' | 'return_extra_stops'; index: number } | null {
		const match = String(fieldName || '').match(/^(extra_stops|return_extra_stops):(\d+)$/);
		if (!match) {
			return null;
		}

		return {
			formArrayName: match[1] as 'extra_stops' | 'return_extra_stops',
			index: Number(match[2])
		};
	}

	private getExtraStopGroup(fieldName: string): FormGroup | null {
		const parsedField = this.parseExtraStopFieldKey(fieldName);
		if (!parsedField) {
			return null;
		}

		return ((this.BookingForm.get(parsedField.formArrayName) as FormArray)?.at(parsedField.index) as FormGroup) || null;
	}

	private getCustomAddressFieldValue(fieldName: string): string {
		if (fieldName === 'loose_customer_address') {
			return String(this.BookingForm.get('loose_customer.address')?.value || '').trim();
		}

		const extraStopGroup = this.getExtraStopGroup(fieldName);
		if (extraStopGroup) {
			return String(extraStopGroup.get('address')?.value || '').trim();
		}

		return String(this.BookingForm.get(fieldName)?.value || '').trim();
	}

	private setCustomAddressFieldValue(fieldName: string, value: string): void {
		if (fieldName === 'loose_customer_address') {
			this.BookingForm.get('loose_customer.address')?.setValue(value, { emitEvent: false });
			return;
		}

		const extraStopGroup = this.getExtraStopGroup(fieldName);
		if (extraStopGroup) {
			extraStopGroup.patchValue({
				address: value,
				latitude: '',
				longitude: ''
			}, { emitEvent: false });
		}
	}

	private getPredictionTextValue(value: any): string {
		if (!value) {
			return '';
		}
		if (typeof value === 'string') {
			return value.trim();
		}
		if (typeof value?.text === 'string') {
			return value.text.trim();
		}
		if (typeof value?.text?.text === 'string') {
			return value.text.text.trim();
		}
		return '';
	}

	private nextCustomSearchVersion(kind: 'address' | 'airport', fieldName: string): number {
		const versionMap = kind === 'address' ? this.customAddressSearchVersion : this.customAirportSearchVersion;
		const nextVersion = (versionMap[fieldName] || 0) + 1;
		versionMap[fieldName] = nextVersion;
		return nextVersion;
	}

	private isLatestCustomSearchVersion(kind: 'address' | 'airport', fieldName: string, version: number): boolean {
		const versionMap = kind === 'address' ? this.customAddressSearchVersion : this.customAirportSearchVersion;
		return (versionMap[fieldName] || 0) === version;
	}

	private setCustomSearchLoading(kind: 'address' | 'airport', fieldName: string, isLoading: boolean): void {
		const loadingMap = kind === 'address' ? this.customAddressSearchLoading : this.customAirportSearchLoading;
		loadingMap[fieldName] = isLoading;
	}

	isCustomSearchLoading(kind: 'address' | 'airport', fieldName: string): boolean {
		const loadingMap = kind === 'address' ? this.customAddressSearchLoading : this.customAirportSearchLoading;
		return !!loadingMap[fieldName];
	}

	private setCustomOptions(kind: 'address' | 'airport', fieldName: string, options: Array<any>): void {
		const optionsMap = kind === 'address' ? this.customAddressOptions : this.customAirportOptions;
		optionsMap[fieldName] = options;
	}

	getCustomAddressOptions(fieldName: string): Array<any> {
		return this.customAddressOptions[fieldName] || [];
	}

	getCustomAirportOptions(fieldName: string): Array<any> {
		return this.customAirportOptions[fieldName] || [];
	}

	private hasResolvedCustomAirportSelection(fieldName: string): boolean {
		const selectedId = this.BookingForm?.get(fieldName)?.value;
		const displayValue = String(this.BookingForm?.get(`${fieldName}_option`)?.value || '').trim();
		const latitude = this.BookingForm?.get(`${fieldName}_latitude`)?.value;
		const longitude = this.BookingForm?.get(`${fieldName}_longitude`)?.value;

		return !!selectedId
			&& !!displayValue
			&& latitude !== ''
			&& latitude !== null
			&& latitude !== undefined
			&& longitude !== ''
			&& longitude !== null
			&& longitude !== undefined;
	}

	private getResolvedCustomAirportOption(fieldName: string): any | null {
		if (!this.hasResolvedCustomAirportSelection(fieldName)) {
			return null;
		}

		const selectedId = this.BookingForm?.get(fieldName)?.value;
		const displayValue = String(this.BookingForm?.get(`${fieldName}_option`)?.value || '').trim();
		const latitude = this.BookingForm?.get(`${fieldName}_latitude`)?.value;
		const longitude = this.BookingForm?.get(`${fieldName}_longitude`)?.value;

		if (!displayValue) {
			return null;
		}

		return {
			placeId: selectedId,
			name: displayValue,
			description: displayValue,
			secondaryText: '',
			isTerminal: displayValue.toLowerCase().includes('terminal'),
			latitude,
			longitude
		};
	}

	getVisibleCustomAirportOptions(fieldName: string): Array<any> {
		const options = this.getCustomAirportOptions(fieldName);
		if (options?.length) {
			return options;
		}

		const selectedOption = this.getResolvedCustomAirportOption(fieldName);
		return selectedOption ? [selectedOption] : [];
	}

	isCustomAddressDropdownOpen(fieldName: string): boolean {
		return this.activeCustomAddressDropdown === fieldName;
	}

	isCustomAirportDropdownOpen(fieldName: string): boolean {
		return this.activeCustomAirportDropdown === fieldName;
	}

	shouldShowCustomPrompt(kind: 'address' | 'airport', fieldName: string): boolean {
		const value = kind === 'address'
			? this.getCustomAddressFieldValue(fieldName)
			: String(this.BookingForm?.get(`${fieldName}_option`)?.value || '').trim();
		const isOpen = kind === 'address' ? this.isCustomAddressDropdownOpen(fieldName) : this.isCustomAirportDropdownOpen(fieldName);
		return isOpen && !value && !this.isCustomSearchLoading(kind, fieldName);
	}

	shouldShowCustomEmpty(kind: 'address' | 'airport', fieldName: string): boolean {
		const value = kind === 'address'
			? this.getCustomAddressFieldValue(fieldName)
			: String(this.BookingForm?.get(`${fieldName}_option`)?.value || '').trim();
		const isOpen = kind === 'address' ? this.isCustomAddressDropdownOpen(fieldName) : this.isCustomAirportDropdownOpen(fieldName);
		const options = kind === 'address' ? this.getCustomAddressOptions(fieldName) : this.getVisibleCustomAirportOptions(fieldName);
		return isOpen && !!value && !this.isCustomSearchLoading(kind, fieldName) && !options.length;
	}

	private clearCustomAddressDropdownBlurTimer(): void {
		if (this.customAddressDropdownBlurTimeout) {
			clearTimeout(this.customAddressDropdownBlurTimeout);
			this.customAddressDropdownBlurTimeout = undefined;
		}
	}

	private clearCustomAirportDropdownBlurTimer(): void {
		if (this.customAirportDropdownBlurTimeout) {
			clearTimeout(this.customAirportDropdownBlurTimeout);
			this.customAirportDropdownBlurTimeout = undefined;
		}
	}

	openCustomAddressDropdown(fieldName: string): void {
		this.clearCustomAddressDropdownBlurTimer();
		this.closeCustomAirportDropdown();
		this.activeCustomAddressDropdown = fieldName;
		void this.searchCustomAddress(fieldName, this.getCustomAddressFieldValue(fieldName));
	}

	closeCustomAddressDropdown(fieldName?: string): void {
		this.clearCustomAddressDropdownBlurTimer();
		if (!fieldName || this.activeCustomAddressDropdown === fieldName) {
			this.activeCustomAddressDropdown = null;
		}
	}

	openCustomAirportDropdown(fieldName: string): void {
		this.clearCustomAirportDropdownBlurTimer();
		this.closeCustomAddressDropdown();
		this.activeCustomAirportDropdown = fieldName;
		const selectedOption = this.getResolvedCustomAirportOption(fieldName);
		if (selectedOption) {
			this.setCustomOptions('airport', fieldName, [selectedOption]);
			return;
		}
		void this.searchCustomAirport(fieldName, this.BookingForm.get(`${fieldName}_option`)?.value || '');
	}

	closeCustomAirportDropdown(fieldName?: string): void {
		this.clearCustomAirportDropdownBlurTimer();
		if (!fieldName || this.activeCustomAirportDropdown === fieldName) {
			this.activeCustomAirportDropdown = null;
		}
	}

	private clearCustomAirportSearchDebounceTimer(fieldName: string): void {
		if (this.customAirportSearchDebounceTimers[fieldName]) {
			clearTimeout(this.customAirportSearchDebounceTimers[fieldName]);
			delete this.customAirportSearchDebounceTimers[fieldName];
		}
	}

	private scheduleCustomAirportSearch(fieldName: string, value: string, delay = 300): void {
		this.clearCustomAirportSearchDebounceTimer(fieldName);
		this.customAirportSearchDebounceTimers[fieldName] = setTimeout(() => {
			void this.searchCustomAirport(fieldName, value || '');
		}, delay);
	}

	private getOrCreateCustomAirportSessionToken(fieldName: string): string {
		const existingToken = this.customAirportAutocompleteSessionTokens[fieldName];
		if (existingToken) {
			return existingToken;
		}

		const token = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
			? crypto.randomUUID()
			: `${fieldName}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

		this.customAirportAutocompleteSessionTokens[fieldName] = token;
		return token;
	}

	private resetCustomAirportSessionToken(fieldName: string): void {
		delete this.customAirportAutocompleteSessionTokens[fieldName];
	}

	onCustomAddressFocus(fieldName: string, input?: HTMLInputElement): void {
		if (!this.isTouchBookingInteraction()) {
			input?.select();
		}
		this.openCustomAddressDropdown(fieldName);
	}

	onCustomAddressBlur(fieldName: string): void {
		this.clearCustomAddressDropdownBlurTimer();
		this.customAddressDropdownBlurTimeout = setTimeout(() => this.closeCustomAddressDropdown(fieldName), 150);
	}

	onCustomAirportFocus(fieldName: string, input?: HTMLInputElement): void {
		if (!this.isTouchBookingInteraction()) {
			input?.select();
		}
		this.openCustomAirportDropdown(fieldName);
	}

	onCustomAirportBlur(fieldName: string): void {
		this.clearCustomAirportDropdownBlurTimer();
		this.customAirportDropdownBlurTimeout = setTimeout(() => this.closeCustomAirportDropdown(fieldName), 150);
	}

	onCustomAddressInput(fieldName: string, value: string): void {
		this.clearCustomAddressDropdownBlurTimer();
		if (fieldName === 'loose_customer_address') {
			this.setCustomAddressFieldValue(fieldName, value || '');
		} else {
			const extraStopGroup = this.getExtraStopGroup(fieldName);
			if (extraStopGroup) {
				this.setCustomAddressFieldValue(fieldName, value || '');
			} else {
				this.BookingForm.get(`${fieldName}_latitude`)?.setValue('', { emitEvent: false });
				this.BookingForm.get(`${fieldName}_longitude`)?.setValue('', { emitEvent: false });
			}
		}
		this.BookingForm.updateValueAndValidity();
		this.openCustomAddressDropdown(fieldName);
		void this.searchCustomAddress(fieldName, value || '');
	}

	onCustomAirportInput(fieldName: string, value: string): void {
		this.clearCustomAirportDropdownBlurTimer();
		this.BookingForm.get(fieldName)?.setValue('', { emitEvent: false });
		this.BookingForm.get(`${fieldName}_name`)?.setValue('', { emitEvent: false });
		this.BookingForm.get(`${fieldName}_latitude`)?.setValue('', { emitEvent: false });
		this.BookingForm.get(`${fieldName}_longitude`)?.setValue('', { emitEvent: false });
		this.BookingForm.updateValueAndValidity();
		this.activeCustomAirportDropdown = fieldName;
		this.scheduleCustomAirportSearch(fieldName, value || '', 300);
	}

	getCustomOptionLabel(option: any): string {
		return String(option?.name || option?.description || '').trim();
	}

	getCustomOptionSecondary(option: any): string {
		return String(option?.secondaryText || '').trim();
	}

	isCustomAirportTerminalOption(option: any): boolean {
		return !!option?.isTerminal;
	}

	private searchGooglePredictions(searchText: string, sessionToken?: string): Promise<Array<any>> {
		const apiKey = this.getGoogleMapsApiKey();
		if (!apiKey || !String(searchText || '').trim()) {
			return Promise.resolve([]);
		}

		return fetch('https://places.googleapis.com/v1/places:autocomplete', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-Goog-Api-Key': apiKey,
				'X-Goog-FieldMask': 'suggestions.placePrediction.placeId,suggestions.placePrediction.text.text,suggestions.placePrediction.structuredFormat.mainText.text,suggestions.placePrediction.structuredFormat.secondaryText.text,suggestions.placePrediction.types'
			},
			body: JSON.stringify({
				input: searchText,
				includeQueryPredictions: false,
				languageCode: 'en-US',
				...(sessionToken ? { sessionToken } : {})
			})
		})
			.then((response) => response.ok ? response.json() : Promise.resolve({ suggestions: [] }))
			.then((response: any) => {
				const suggestions = Array.isArray(response?.suggestions) ? response.suggestions : [];
				return suggestions
					.map((suggestion: any) => suggestion?.placePrediction)
					.filter((prediction: any) => !!prediction?.placeId)
					.map((prediction: any) => ({
						placeId: prediction.placeId,
						types: prediction.types || [],
						name: this.getPredictionTextValue(prediction?.structuredFormat?.mainText)
							|| this.getPredictionTextValue(prediction?.text)?.split(',')[0]?.trim()
							|| this.getPredictionTextValue(prediction?.text),
						secondaryText: this.getPredictionTextValue(prediction?.structuredFormat?.secondaryText),
						description: this.getPredictionTextValue(prediction?.text)
					}))
					.slice(0, 8);
			})
			.catch(() => []);
	}

	private isAirportPrediction(option: any): boolean {
		const combined = [option?.name, option?.secondaryText, option?.description, (option?.types || []).join(' ')].join(' ').toLowerCase();
		return ['airport', 'terminal', 'concourse', 'fbo', 'airfield', 'aerodrome', 'gate', 'parking', 'garage', 'departures', 'arrivals'].some((keyword) =>
			combined.includes(keyword)
		);
	}

	private getCustomAirportBaseQuery(searchText: string): string {
		const normalizedSearchText = String(searchText || '')
			.replace(/\s+/g, ' ')
			.trim();

		if (!normalizedSearchText) {
			return '';
		}

		const terminalPrefixes = ['t', 'te', 'ter', 'term', 'termi', 'termin', 'termina', 'terminal'];
		const parts = normalizedSearchText.split(' ').filter(Boolean);
		const lastToken = String(parts[parts.length - 1] || '').toLowerCase();

		if (terminalPrefixes.includes(lastToken)) {
			return parts.slice(0, -1).join(' ').trim();
		}

		return normalizedSearchText.replace(/\bterminal\b.*$/i, '').replace(/\s+/g, ' ').trim();
	}

	private getCustomAirportPredictionType(option: any): string {
		const types = Array.isArray(option?.types) ? option.types.map((type: string) => String(type || '').toLowerCase()) : [];
		return types.includes('airport') ? 'airport' : 'terminal';
	}

	private normalizeCustomAirportSearchText(value: string): string {
		return String(value || '')
			.toLowerCase()
			.replace(/[^a-z0-9\s]/g, ' ')
			.replace(/\s+/g, ' ')
			.trim();
	}

	private buildCustomAirportMatchTokens(airport: any, searchText: string): string[] {
		const codeMatches = [airport?.name, airport?.description, searchText]
			.flatMap((value: any) => String(value || '').match(/\b[A-Z]{3,4}\b/g) || [])
			.map((value: string) => value.toLowerCase());

		const phraseCandidates = [
			String(searchText || '').trim(),
			String(airport?.name || '').trim(),
			String(airport?.secondaryText || '').split(',')[0]?.trim() || '',
		]
			.map((value) => this.normalizeCustomAirportSearchText(value))
			.filter((value) => value.length >= 3);

		return Array.from(new Set([...codeMatches, ...phraseCandidates]));
	}

	private findMatchingCustomAirportForTerminal(terminal: any, airports: Array<any>, searchText: string): any | null {
		const normalizedDescription = this.normalizeCustomAirportSearchText(terminal?.description || terminal?.secondaryText || terminal?.name || '');
		if (!normalizedDescription.includes('terminal')) {
			return null;
		}

		for (const airport of airports) {
			const tokens = this.buildCustomAirportMatchTokens(airport, searchText);
			if (tokens.some((token) => token && normalizedDescription.includes(token))) {
				return airport;
			}
		}

		return null;
	}

	private dedupeCustomAirportOptions(options: Array<any>): Array<any> {
		const seen = new Set<string>();
		return options.filter((option: any) => {
			const key = String(option?.placeId || `${option?.name}__${option?.description}`).toLowerCase();
			if (!key || seen.has(key)) {
				return false;
			}
			seen.add(key);
			return true;
		});
	}

	private mergeCustomAirportAndTerminalPredictions(airports: Array<any>, terminals: Array<any>, searchText: string): Array<any> {
		const merged: Array<any> = [];
		const matchedTerminalIds = new Set<string>();
		const normalizedTerminals = this.dedupeCustomAirportOptions(terminals);

		for (const airport of this.dedupeCustomAirportOptions(airports)) {
			merged.push({
				...airport,
				isTerminal: false,
			});

			const airportTerminals = normalizedTerminals.filter((terminal: any) => {
				const matchingAirport = this.findMatchingCustomAirportForTerminal(terminal, [airport], searchText);
				if (!matchingAirport) {
					return false;
				}

				const terminalKey = String(terminal?.placeId || `${terminal?.name}__${terminal?.description}`).toLowerCase();
				if (matchedTerminalIds.has(terminalKey)) {
					return false;
				}

				matchedTerminalIds.add(terminalKey);
				return true;
			});

			if (airportTerminals.length) {
				merged.push(...airportTerminals.map((terminal: any) => ({
					...terminal,
					isTerminal: true,
					parentAirportPlaceId: airport.placeId,
					parentAirportName: airport.name,
				})));
			}
		}

		return merged;
	}

	private fetchPlaceDetails(placeId: string): Promise<google.maps.places.PlaceResult | null> {
		const service = this.getCustomPlacesService();
		if (!service || !placeId) {
			return Promise.resolve(null);
		}

		return new Promise((resolve) => {
			service.getDetails(
				{
					placeId,
					fields: ['place_id', 'name', 'formatted_address', 'geometry', 'address_components', 'types']
				},
				(place, status) => {
					if (status !== google.maps.places.PlacesServiceStatus.OK || !place) {
						resolve(null);
						return;
					}
					resolve(place);
				}
			);
		});
	}

	async searchCustomAddress(fieldName: string, value: string): Promise<void> {
		const requestVersion = this.nextCustomSearchVersion('address', fieldName);
		const searchText = String(value || '').trim();
		if (!searchText) {
			if (this.isLatestCustomSearchVersion('address', fieldName, requestVersion)) {
				this.setCustomSearchLoading('address', fieldName, false);
				this.setCustomOptions('address', fieldName, []);
			}
			return;
		}

		this.setCustomSearchLoading('address', fieldName, true);
		const options = await this.searchGooglePredictions(searchText);
		if (this.isLatestCustomSearchVersion('address', fieldName, requestVersion)) {
			this.setCustomOptions('address', fieldName, options);
			this.setCustomSearchLoading('address', fieldName, false);
		}
	}

	async searchCustomAirport(fieldName: string, value: string): Promise<void> {
		const requestVersion = this.nextCustomSearchVersion('airport', fieldName);
		const searchText = String(value || '').trim();
		const selectedOption = this.getResolvedCustomAirportOption(fieldName);
		if (!searchText) {
			if (this.isLatestCustomSearchVersion('airport', fieldName, requestVersion)) {
				this.setCustomSearchLoading('airport', fieldName, false);
				this.setCustomOptions('airport', fieldName, selectedOption ? [selectedOption] : []);
			}
			return;
		}

		this.setCustomSearchLoading('airport', fieldName, true);
		const baseSearchText = this.getCustomAirportBaseQuery(searchText) || searchText;
		const terminalSearchText = `${baseSearchText} terminal`.trim();
		const sessionToken = this.getOrCreateCustomAirportSessionToken(fieldName);
		const [airportOptions, terminalOptions] = await Promise.all([
			this.searchGooglePredictions(baseSearchText, sessionToken),
			this.searchGooglePredictions(terminalSearchText, sessionToken)
		]);

		const airportPredictions = airportOptions
			.filter((option) => this.isAirportPrediction(option) && this.getCustomAirportPredictionType(option) === 'airport')
			.map((option) => ({ ...option, isTerminal: false }));

		const terminalPredictions = terminalOptions
			.filter((option) =>
				this.isAirportPrediction(option)
				&& String(option?.description || '').toLowerCase().includes('terminal')
			)
			.map((option) => ({ ...option, isTerminal: true }));

		const options = terminalPredictions.length
			? this.mergeCustomAirportAndTerminalPredictions(airportPredictions, terminalPredictions, baseSearchText)
			: this.dedupeCustomAirportOptions(airportPredictions);

		if (this.isLatestCustomSearchVersion('airport', fieldName, requestVersion)) {
			this.setCustomOptions('airport', fieldName, options.length ? options : (selectedOption ? [selectedOption] : []));
			this.setCustomSearchLoading('airport', fieldName, false);
		}
	}

	async selectCustomAddressOption(fieldName: string, option: any): Promise<void> {
		this.clearCustomAddressDropdownBlurTimer();
		const place = await this.fetchPlaceDetails(option?.placeId);
		if (place?.geometry?.location) {
			const formattedAddress = place.formatted_address ?? '';
			const placeName = place.name ?? '';
			const displayAddress = placeName ? `${placeName} - ${formattedAddress}` : formattedAddress;
			const addressPayload = {
				...place,
				formatted_address: formattedAddress,
				display_address: displayAddress
			};
			const extraStopField = this.parseExtraStopFieldKey(fieldName);
			if (fieldName === 'loose_customer_address') {
				this.fillLooseCustomerAddress(addressPayload);
			} else if (extraStopField) {
				this.fillExtraStop(extraStopField.formArrayName === 'return_extra_stops', extraStopField.index, addressPayload, {
					latitude: place.geometry.location.lat(),
					longitude: place.geometry.location.lng()
				});
			} else {
				this.fillAddress(fieldName, addressPayload);
				this.fillLocationPoints(fieldName, {
					latitude: place.geometry.location.lat(),
					longitude: place.geometry.location.lng()
				});
			}
		}
		this.closeCustomAddressDropdown(fieldName);
	}

	async selectCustomAirportOption(fieldName: string, option: any): Promise<void> {
		this.clearCustomAirportDropdownBlurTimer();
		const place = await this.fetchPlaceDetails(option?.placeId);
		if (place?.geometry?.location) {
			this.handleAirportPlaceSelection(fieldName, place);
		}
		this.resetCustomAirportSessionToken(fieldName);
		this.closeCustomAirportDropdown(fieldName);
	}


	dateFormat(value: any) {
		return moment(value, 'YYYY-MM-DD').format('ll')
	}

	dateFormat2(value: any) {
		return moment(value, 'YYYY-MM-DD').format('L')
	}

	dateFormatToDay(value: any) {
		return moment(value, "YYYY-MM-DD").format('dddd');
	}

	timeFormat(value: any) {
		if (value.toUpperCase() == '12:00 AM') {
			return '0000 h'
		}
		let hours = moment(moment(value, 'hh:mm a').format('HH'), 'HH').hours();
		let mins = moment(value, 'hh:mm a').minutes().toString();
		if (Number(mins) == 0 || Number(mins) < 10) {
			mins = '0' + mins.toString();
		}

		return hours < 10 ? '0' + hours.toString() + mins.toString() + ' h' : hours.toString() + mins.toString() + ' h'
		//return value.replace(':', '').substring(0, 5) + 'h';
	}

	timeFormat2(value: string) {
		return moment(value, 'HH:mm a').format('h:mm a');
	}

	textFormatter(text: string) {
		try {
			return text.replace(/[\\\_$]+/g, ' ')
		}
		catch {
			return text
		}
	}

	// for showing details when client account is chosen
	getUserValue(key: string): string {
		if (!this.chosen_user) {
			return '';
		}
		const lowerKey = key.toLowerCase();

		// Create a mapping of normalized keys to possible variations
		const variations = {
			name: ['name', 'Name'],
			mobile: ['mobile', 'Mobile'],
			email: ['email', 'Email'],
			country: ['country', 'Country'],
			zip: ['zip', 'zipCode', 'Zip', 'ZipCode'],
			address: ['address', 'Address']
		};

		const possibleKeys = variations[lowerKey] || [key];

		for (const k of possibleKeys) {
			if (this.chosen_user[k] !== undefined && this.chosen_user[k] !== null) {
				return this.chosen_user[k];
			}
		}

		return ''; // default fallback if nothing found
	}


	textFormatterClientAccounts(text: string) {
		try {
			return text == 'travel_planner' ? 'Travel Advisor' : text.replace(/[\\\_$]+/g, ' ')
		}
		catch {
			return text
		}
	}

	mToMi(distance: number): string {
		return (distance / 1609).toFixed(2)
	}

	mToKm(distance: number): string {
		return (distance / 1000).toFixed(2)
	}

	/**
	* Returns true/false depending on the existence of search_string in text.
	* @param text [Required] text where to search ?
	* @param search_string [Required] text what to search ?
	* @param start [Optional] search starting point. Default 0
	* @returns boolean
	*/
	searchSubstring(text: string, search_string: string, start: number = 0): boolean {
		return text.indexOf(search_string, start) != -1
	}


	/**
	* Booking Form
	*/
	buildBookingForm() {
		this.BookingForm = this.$form.group({
			service_type: ['one_way', Validators.required],
			transfer_type: ['city_to_city', Validators.required],
			return_transfer_type: ['city_to_city', Validators.required],
			number_of_hours: ['2'],
			prevent_rate_override: this.updateType === "edit" ? [true] : [false],
			acc_id: [''],
			account_type: ['individual'],
			travel_client_id: [''],
			travel_client_acc: ['travel_individual'],
			change_individual_data: [false],
			loose_customer: this.$form.group({
				first_name: [''],
				middle_name: [''],
				last_name: [''],
				phone: [''],
				phone_isd: ['+1'],
				phone_country: ['us'],
				email: [''],
				address: [''],
				country: [''],
				state: [''],
				city: [''],
				zipCode: [''],
				card_details: this.$form.group({
					name: [''],
					card_number: [''],
					exp_month: [''],
					exp_year: [''],
					cvv: ['']
				})
			}),
			passenger_name: ['', [Validators.required, this.customValidator.whitespace()]],
			passenger_email: ['', [Validators.pattern(/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i)]],
			passenger_cell: ['', [Validators.required, Validators.pattern("^[0-9+]*$"), Validators.minLength(4), Validators.maxLength(15)]],
			passenger_cell_isd: ['+1'],
			passenger_cell_country: ['us'],
			total_passengers: [1],
			luggage_count: [0],
			booking_instructions: [''],
			return_booking_instructions: [''],
			affiliate_type: ['affiliate'],
			affiliate_id: [''],
			return_affiliate_type: ['affiliate'],
			return_affiliate_id: [''],
			loose_affiliate_id: [''],
			is_old_loose_affiliate: [false],
			return_loose_affiliate_id: [''],
			return_is_old_loose_affiliate: [false],
			lose_affiliate_name: ['', [this.customValidator.whitespace()]],
			lose_affiliate_phone: [''],
			lose_affiliate_phone_isd: ['+1'],
			lose_affiliate_phone_country: ['us'],
			lose_affiliate_email: [''],
			return_lose_affiliate_name: ['', [this.customValidator.whitespace()]],
			return_lose_affiliate_phone: [''],
			return_lose_affiliate_phone_isd: ['+1'],
			return_lose_affiliate_phone_country: ['us'],
			return_lose_affiliate_email: [''],
			cancellation_hours: ['24', [Validators.required]],
			return_cancellation_hours: ['24'],
			vehicle_type: ['', [Validators.required]],
			vehicle_type_name: [''],
			vehicle_id: [''],
			vehicle_make: [''],
			vehicle_make_name: [''],
			vehicle_model: [''],
			vehicle_model_name: [''],
			vehicle_year: [''],
			vehicle_year_name: [''],
			vehicle_color: [''],
			vehicle_color_name: [''],
			vehicle_license_plate: ['', this.customValidator.whitespace()],
			vehicle_seats: ['4', Validators.pattern("^[0-9+]*$")],
			driver_id: [''],
			driver_name: [''],
			driver_gender: [''],
			driver_cell: ['', [Validators.pattern("^[0-9+]*$"), Validators.minLength(4), Validators.maxLength(15)]],
			driver_cell_isd: ['+1'],
			driver_cell_country: ['us'],
			driver_email: ['', Validators.pattern(/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i)],
			return_vehicle_type: [''],
			return_vehicle_type_name: [''],
			return_vehicle_id: [''],
			return_vehicle_make: [''],
			return_vehicle_make_name: [''],
			return_vehicle_model: [''],
			return_vehicle_model_name: [''],
			return_vehicle_year: [''],
			return_vehicle_year_name: [''],
			return_vehicle_color: [''],
			return_vehicle_color_name: [''],
			return_vehicle_license_plate: ['', this.customValidator.whitespace()],
			return_vehicle_seats: ['4', Validators.pattern("^[0-9+]*$")],
			return_driver_id: [''],
			return_driver_name: [''],
			return_driver_gender: [''],
			return_driver_cell: ['', [Validators.pattern("^[0-9+]*$"), Validators.minLength(4), Validators.maxLength(15)]],
			return_driver_cell_isd: ['+1'],
			return_driver_cell_country: ['us'],
			return_driver_email: ['', Validators.pattern(/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i)],
			driver_phone_type: [''],
			return_driver_phone_type: [''],
			driver_image_id: [''],
			vehicle_image_id: [''],
			meet_greet_choices: [2],
			meet_greet_choices_name: ['Driver -  Airport - Text/call after plane lands with curbside meet location'],
			number_of_vehicles: [''],
			pickup_date: [''],
			pickup_time: ['12:00 am'],
			extra_stops: this.$form.array([]),
			pickup: [''],
			pickup_latitude: [''],
			pickup_longitude: [''],
			pickup_airport_option: [''],
			pickup_airport: [''],
			pickup_airport_name: [''],
			pickup_airport_latitude: [''],
			pickup_airport_longitude: [''],
			pickup_airline_option: [''],
			pickup_airline: [''],
			pickup_airline_name: [''],
			pickup_flight: [''],
			origin_airport_city: [''],
			departing_airport_city: [''],
			cruise_port: [''],
			cruise_name: [''],
			cruise_time: ['12:00 am'],
			dropoff: [''],
			dropoff_latitude: [''],
			dropoff_longitude: [''],
			dropoff_airport_option: [''],
			dropoff_airport: [''],
			dropoff_airport_name: [''],
			dropoff_airport_latitude: [''],
			dropoff_airport_longitude: [''],
			dropoff_airline_option: [''],
			dropoff_airline: [''],
			dropoff_airline_name: [''],
			dropoff_flight: [''],
			return_meet_greet_choices: [2],
			return_meet_greet_choices_name: ['Driver -  Airport - Text/call after plane lands with curbside meet location'],
			return_pickup_date: [''],
			return_pickup_time: ['12:00 pm'],
			return_extra_stops: this.$form.array([]),
			return_pickup: [''],
			return_pickup_latitude: [''],
			return_pickup_longitude: [''],
			return_pickup_airport_option: [''],
			return_pickup_airport: [''],
			return_pickup_airport_name: [''],
			return_pickup_airport_latitude: [''],
			return_pickup_airport_longitude: [''],
			return_pickup_airline_option: [''],
			return_pickup_airline: [''],
			return_pickup_airline_name: [''],
			return_pickup_flight: [''],
			return_cruise_port: [''],
			return_cruise_name: [''],
			return_cruise_time: ['12:00 pm'],
			return_dropoff: [''],
			return_dropoff_latitude: [''],
			return_dropoff_longitude: [''],
			return_dropoff_airport_option: [''],
			return_dropoff_airport: [''],
			return_dropoff_airport_name: [''],
			return_dropoff_airport_latitude: [''],
			return_dropoff_airport_longitude: [''],
			return_dropoff_airline_option: [''],
			return_dropoff_airline: [''],
			return_dropoff_airline_name: [''],
			return_dropoff_flight: [''],
			driver_languages: this.$form.array([]),
			driver_dresses: this.$form.array([]),
			amenities: this.$form.array([]),
			chargedAmenities: this.$form.array([]),
			journeyDistance: [''],
			journeyTime: [''],
			returnJourneyDistance: [''],
			returnJourneyTime: [''],
			reservation_id: [''],
			updateType: [''],
			susbcriber_name: [''],
			return_susbcriber_name: [''],
			fbo_address: [''],
			return_fbo_address: [''],
			fbo_name: [''],
			return_fbo_name: ['']
		})

		// let month = new Date().getMonth()
		// let date: string | number = new Date().getDate() + 1
		// let year = new Date().getFullYear()


		// let full_date = new Date(year, month, date).toISOString()
		// // 10 days later
		// let future_full_date = new Date(year, month, date).toISOString()
		// this.SetFormValue('pickup_date', full_date.slice(0, full_date.indexOf('T')))
		// this.SetFormValue('return_pickup_date', future_full_date.slice(0, future_full_date.indexOf('T')))

		let date = new Date();
		let timestamp = date.getTime();

		this.SetFormValue('pickup_date', moment(timestamp).format("YYYY-MM-DD"))
		this.SetFormValue('return_pickup_date', moment(timestamp).format("YYYY-MM-DD"))

		this.SetFormValue('number_of_vehicles', 1)
		this.SetFormValue('booking_instructions', '<ol><li>Driver - Text on location. Text the client a day before to confirm driver name , cell phone and booking details. Text client with ETA when en route</li></ol>');
		this.SetFormValue('return_booking_instructions', '<ol><li>Driver - Text on location. Text the client a day before to confirm driver name , cell phone and booking details. Text client with ETA when en route</li></ol>');

		if (this.BookingForm.value.transfer_type.includes('city_')) {
			this.SetFormValue('meet_greet_choices', 1)
			this.SetFormValue('meet_greet_choices_name', "Driver - Text/call when on location")
		} else {
			this.SetFormValue('meet_greet_choices', 2)
			this.SetFormValue('meet_greet_choices_name', "Driver -  Airport - Text/call after plane lands with curbside meet location")
		}

		if (this.BookingForm.value.transfer_type.includes('_city')) {
			this.SetFormValue('return_meet_greet_choices', 1)
			this.SetFormValue('return_meet_greet_choices_name', "Driver - Text/call when on location")
		} else {
			this.SetFormValue('return_meet_greet_choices', 2)
			this.SetFormValue('return_meet_greet_choices_name', "Driver -  Airport - Text/call after plane lands with curbside meet location")
		}
	}
	changeTransferType(type: string) {
		console.log("transfer type", type)
		this.retryGoogleAutocompleteInitialization()
		this.transfer_type = type
		if (type.includes('city_')) {
			this.SetFormValue('meet_greet_choices', 1)
			this.SetFormValue('meet_greet_choices_name', "Driver - Text/call when on location")
		} else {
			this.SetFormValue('meet_greet_choices', 2)
			this.SetFormValue('meet_greet_choices_name', "Driver -  Airport - Text/call after plane lands with curbside meet location")
		}

		if (type.includes('_city')) {
			this.SetFormValue('return_meet_greet_choices', 1)
			this.SetFormValue('return_meet_greet_choices_name', "Driver - Text/call when on location")
		} else {
			this.SetFormValue('return_meet_greet_choices', 2)
			this.SetFormValue('return_meet_greet_choices_name', "Driver -  Airport - Text/call after plane lands with curbside meet location")
		}

	}

	handleChangeMonth(value: any) {
		console.log('value', value)
		if (value) {
			this.monthOptions = this.months.filter(i => i.value.includes(value))
		}
	}
	handleChangeNoPasengers(value: any) {
		console.log('value', value)
		if (value) {
			this.booking_params.numbers = this.numbers.filter(i => i.toString().includes(value))
		}
		else {
			this.booking_params.numbers = this.numbers
		}
		console.log('passenger options---->', this.booking_params?.numbers)
	}
	handleChangeLuggaeCOunt(value: any) {
		console.log('value', value)
		if (value) {
			this.luggage_options = this.numbers.filter(i => i.toString().includes(value))
		}
		else {
			this.luggage_options = this.numbers
		}
		console.log('luggage options---->', this.booking_params?.numbers)
	}

	handleChangeMeetAndGreet(event: any, type: string) {
		console.log('in function meet and greet-->>>', event.source.triggerValue, type)
		if (type == 'return') {
			this.BookingForm.patchValue({
				return_meet_greet_choices_name: event.source.triggerValue
			})
		}
		else {
			this.BookingForm.patchValue({
				meet_greet_choices_name: event.source.triggerValue
			})
		}
	}

	handleChangePickupTime(event) {
		console.log("in pickupt time", event)
		this.BookingForm.patchValue({
			pickup_time: event.value
		})
	}

	handleNoOfHours(eventValue: any) {
		const value = Number(eventValue);
		this.number_of_hours = value;

		if (Number(this.BookingForm?.get('number_of_hours')?.value) !== value) {
			this.BookingForm?.get('number_of_hours')?.setValue(value);
		}

		// Reactive error flag update
		if (this.Form.service_type.value == 'charter_tour') {
			if (!isNaN(value) && value < 2) {
				this.numberOfHoursError = true;
			} else {
				this.numberOfHoursError = false;
			}
		} else {
			this.numberOfHoursError = false;
		}

		// Only emit when value is already valid (>= 2)
		if (!isNaN(value) && value >= 2) {
			this.returnNumberOfHr.emit(value);
		}
	}

	// Force minimum 2 when user clicks away (perfect for 0, 1, empty)
	enforceMinimumHours(event: any) {
		let value = Number(event.target.value || 0);

		if (this.Form.service_type.value == 'charter_tour' && (isNaN(value) || value < 2)) {
			// If it's less than 2, we force it to 2 and clear the error
			value = 2;
			this.number_of_hours = 2;
			this.SetFormValue('number_of_hours', 2);
			this.numberOfHoursError = false;
		}

		this.returnNumberOfHr.emit(value);
	}

	private syncNumberOfHoursValidation(serviceType: string): void {
		const numberOfHoursControl = this.BookingForm?.get('number_of_hours');
		if (!numberOfHoursControl) {
			return;
		}

		if (serviceType === 'charter_tour') {
			numberOfHoursControl.updateValueAndValidity({ emitEvent: false });
			this.numberOfHoursError = Number(numberOfHoursControl.value) < 2;
			return;
		}

		numberOfHoursControl.setValue(0, { emitEvent: false });
		numberOfHoursControl.setErrors(null);
		numberOfHoursControl.markAsPristine();
		numberOfHoursControl.markAsUntouched();
		numberOfHoursControl.updateValueAndValidity({ emitEvent: false });
		this.numberOfHoursError = false;
	}

	// Block negative sign while typing
	blockNegative(event: KeyboardEvent) {
		if (event.key === '-') {
			event.preventDefault();
		}
	}

	prefillViaBookingID(booking_id: number) {
		// console.warn('Prefilling via Booking Id')
		this.$spinner.show('normalspinner');
		if (this.updateType == 'reaffiliate') {
			this.BookingForm.patchValue({
				updateType: 'reaffiliate'
			})
		}
		this.$api.getBookingDataForEdit(booking_id, this.Form.updateType.value).subscribe((response: any) => {
			response.data.booking_instructions = response.data.booking_instructions.replaceAll('<br />', '')
			console.log('response <><><><><', response.data)
			let editing_data = response.data

			// Parse JSON strings if necessary
			if (typeof editing_data.extra_stops === 'string') {
				try {
					editing_data.extra_stops = JSON.parse(editing_data.extra_stops);
				} catch (e) {
					console.error('Error parsing extra_stops:', e);
					editing_data.extra_stops = [];
				}
			}
			if (typeof editing_data.return_extra_stops === 'string') {
				try {
					editing_data.return_extra_stops = JSON.parse(editing_data.return_extra_stops);
				} catch (e) {
					console.error('Error parsing return_extra_stops:', e);
					editing_data.return_extra_stops = [];
				}
			}
			if (typeof editing_data.share_array === 'string') {
				try {
					editing_data.share_array = JSON.parse(editing_data.share_array);
				} catch (e) {
					console.error('Error parsing share_array:', e);
					editing_data.share_array = {};
				}
			}

			let currency = editing_data?.currency
			this.httpClient.get("assets/json/currencyOptions.json").subscribe(data => {
				for (const key of Object.keys(data)) {
					if (data[key].currency === currency.toUpperCase()) {
						this.currencyObj = data[key]
						this.currencySymbol = data[key].symbol
					}
				}
			})
			console.log("this.currencyObj?.currency", this.currencyObj)
			this.bookingResponse = response.data
			this.waiting_time_in_mins = this.bookingResponse?.waiting_time_in_mins
			this.firstLoadVehicleId = response.data.vehicle_id
			this.firstLoadAffiliateId = response.data.affiliate_id
			this.number_of_hours = response?.data?.number_of_hours === 0 ? 2 : response?.data?.number_of_hours
			this.isTravelShare = response?.data?.account_type == 'travel_planner' ? true : false
			this.isFarmoutBooking = response?.data?.reservation_type == 'farmout' ? true : false
			this.isCreatedByAdmin = response?.data?.created_by == 1 ? true : false

			if (response?.data?.acc_id && response?.data?.account_type != 'loose_customer') {
				this.chooseUser(response.data.acc_id, false, response.data.account_type);
			}

			this.booking_created_from = ((response?.data?.affiliate_id != this.currentUser?.account_id) || response?.data?.created_by_role == 'admin') ? 'admin' : 'subscriber'

			if (response?.data?.account_type == 'travel_planner') {
				this.getTravelClientAccounts(response?.data?.acc_id)
			}
			// this.SetFormValue('affiliate_type', response.data.affiliate_type)
			this.autofillData('cruise', editing_data);
			console.log(editing_data, "check big data")
			for (let item in editing_data) {
				if (item.includes('extra_stops') || item.includes('languages') || item.includes('dresses') || item.toLowerCase().includes('amenities')) {
					// console.log('Skipping in the case of Extra Stops. ')
				}
				if (item == "passenger_cell_isd") {
					console.log('passenger_cell_isd-->>', item, editing_data[item])
					let value = editing_data[item].includes('+') ? editing_data[item] : '+'.concat(editing_data[item])
					this.SetFormValue(item, value);
				}
				if (editing_data[item] && item != "passenger_cell_isd" && typeof editing_data[item] !== 'object') {
					if (this.updateType == 'reaffiliate' && item == 'affiliate_id') continue;
					if (this.updateType == 'reaffiliate' && item == 'affiliate_type') continue;

					if (isNaN(Number(editing_data[item]))) {
						this.SetFormValue(item, editing_data[item]);
					} else {
						this.SetFormValue(item, Number(editing_data[item]));
					}
				}
			}
			// Handle field name mismatches
			if (editing_data.meet_greet_choice_name) {
				this.SetFormValue('meet_greet_choices_name', editing_data.meet_greet_choice_name);
			}
			const pickupLine = editing_data.pickup || editing_data.pickup_address;
			if (pickupLine) {
				this.SetFormValue('pickup', pickupLine);
			}
			const dropoffLine = editing_data.dropoff || editing_data.dropoff_address;
			if (dropoffLine) {
				this.SetFormValue('dropoff', dropoffLine);
			}
			const returnPickupLine = editing_data.return_pickup || editing_data.return_pickup_address;
			if (returnPickupLine) {
				this.SetFormValue('return_pickup', returnPickupLine);
			}
			const returnDropoffLine = editing_data.return_dropoff || editing_data.return_dropoff_address;
			if (returnDropoffLine) {
				this.SetFormValue('return_dropoff', returnDropoffLine);
			}
			// if (editing_data?.loose_customer) {
			//  console.log('n function fill loose customer data', editing_data?.loose_customer)
			//  try {
			//      for (let item in editing_data?.loose_customer) {
			//          if (editing_data?.loose_customer[item]) {
			//              console.log('LC set value for', item, editing_data?.loose_customer[item])
			//              this.SetLCFormValue(item, editing_data?.loose_customer[item])
			//          }
			//      }
			//      this.SetLCFormValue('phone' ,editing_data?.loose_customer?.mobile )
			//      this.fillLooseCustomerAddress(editing_data?.loose_customer?.address)
			//      const loose_customer = (this.BookingForm.get('loose_customer') as FormGroup)
			//      loose_customer.get('email').setValidators([Validators.required, Validators.pattern(/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i)])
			//      loose_customer.get('phone').setValidators([Validators.required, Validators.pattern("^[0-9+]*$"), Validators.minLength(4), Validators.maxLength(15)])
			//      loose_customer.get('first_name').setValidators([Validators.required])
			//      // loose_customer.get('middle_name').setValidators(this.customValidator.whitespace())
			//      loose_customer.get('last_name').setValidators([Validators.required])
			//      loose_customer.get('address').setValidators(this.customValidator.whitespace())
			//      loose_customer.updateValueAndValidity()
			//  }
			//  catch (error) {
			//      console.log('error--->>>>>>', error)
			//  }
			// }
			this.SetFormValue('pickup_airport_option', this.getEditAirportDisplayValue(this.Form.pickup_airport.value, editing_data.pickup_address));
			this.SetFormValue('pickup_airport_name', this.getEditAirportDisplayValue(this.Form.pickup_airport.value, editing_data.pickup_address));
			this.SetFormValue('pickup_airline_option', this.BigData.airlinesData.find((item: any) => item.id == this.Form.pickup_airline.value));
			this.SetFormValue('dropoff_airport_option', this.getEditAirportDisplayValue(this.Form.dropoff_airport.value, editing_data.dropoff_address));
			this.SetFormValue('dropoff_airport_name', this.getEditAirportDisplayValue(this.Form.dropoff_airport.value, editing_data.dropoff_address));
			this.SetFormValue('dropoff_airline_option', this.BigData.airlinesData.find((item: any) => item.id == this.Form.dropoff_airline.value));
			this.SetFormValue('return_pickup_airport_option', this.getEditAirportDisplayValue(this.Form.return_pickup_airport.value, editing_data.return_pickup_address));
			this.SetFormValue('return_pickup_airport_name', this.getEditAirportDisplayValue(this.Form.return_pickup_airport.value, editing_data.return_pickup_address));
			this.SetFormValue('return_pickup_airline_option', this.BigData.airlinesData.find((item: any) => item.id == this.Form.return_pickup_airline.value));
			this.SetFormValue('return_dropoff_airport_option', this.getEditAirportDisplayValue(this.Form.return_dropoff_airport.value, editing_data.return_dropoff_address));
			this.SetFormValue('return_dropoff_airport_name', this.getEditAirportDisplayValue(this.Form.return_dropoff_airport.value, editing_data.return_dropoff_address));
			this.SetFormValue('return_dropoff_airline_option', this.BigData.airlinesData.find((item: any) => item.id == this.Form.return_dropoff_airline.value));
			this.SetFormValue('origin_airport_city', editing_data?.origin_airport_city ? editing_data?.origin_airport_city : editing_data?.departing_airport_city)

			if (editing_data.driver_image) {
				this.SetFormValue('driver_image_id', editing_data.driver_image.id);
				this.driver_image['image'] = editing_data.driver_image.image;
			}
			if (editing_data.vehicle_image) {
				this.SetFormValue('vehicle_image_id', editing_data.vehicle_image.id);
				this.vehicle_image['image'] = editing_data.vehicle_image.image;
			}

			['driver_languages', 'driver_dresses', 'amenities', 'chargedAmenities'].forEach((item: string) => {
				if (editing_data[item] && editing_data[item].length > 0) {
					editing_data[item].forEach((id: number) => {
						this.select(true, item, id)
					})
				}
			})

			this.prefillExtraStops(editing_data.extra_stops);
			this.prefillExtraStops(editing_data.return_extra_stops, true);
			this.BookingForm.updateValueAndValidity()

			// override specific value
			this.BookingForm.patchValue({
				service_type: response.data.service_type == 'oneway' ? 'one_way' : response.data['service_type'] == 'roundtrip' ? 'round_trip' : 'charter_tour',
			})
			this.BookingForm.patchValue({
				cancellation_hours: response?.data?.cancellation_hours.toString()
			})

			// if (this.Form.updateType.value == 'edit') {
			//  this.booking_params.client_account_types.pop()
			// }
			this.booking_id = this.Form.reservation_id.value;
			this.Form.affiliate_id.value != 0 ? this.chooseAffiliate() : ''
			setTimeout(() => {
				this.PaxTelObject.setCountry(this.BookingForm.get('passenger_cell_country').value);
			}, 2000)
			if (this.Form.affiliate_type.value == 'loose_affiliate') {
				setTimeout(() => {
					this.loseAffiliateTelInput.setCountry(this.BookingForm.get('lose_affiliate_phone_country').value);
					this.driverCellTelInput.setCountry(this.BookingForm.get('driver_cell_country').value);
				}, 2000)
			}

			this.$spinner.hide('normalspinner')
			console.log('<<<<<<<<<<<-----------set pickup date------->>>>', moment().format('YYYY-MM-DD'), this.updateType)
			if (this.updateType == 'edit') {
				this.scroll('pickup_adress')
				// this.SetFormValue('pickup_date', moment().format('YYYY-MM-DD'))
				this.SetFormValue('pickup_date', this.bookingResponse?.pickup_date)
			}
			if (this.updateType == 'repeat' || this.updateType == 'return' || this.updateType == 'round' || this.updateType == 'edit') {
				this.scroll('pickup_adress')
				if (new Date(this.bookingResponse?.pickup_date).getTime() < new Date().getTime() && this.updateType != 'edit') {
					this.SetFormValue('pickup_date', moment().format('YYYY-MM-DD'))
				}
				else {
					this.SetFormValue('pickup_date', this.bookingResponse?.pickup_date)
				}
			}

			// Instant error display for prefilled values (day bookings arrive as 24/48/… hours)
			const prefilledHours = Number(this.Form.number_of_hours.value);
			if (this.Form.service_type.value == 'charter_tour' && (isNaN(prefilledHours) || prefilledHours < 2)) {
				this.numberOfHoursError = true;
			} else {
				this.numberOfHoursError = false;
			}

		})

	}

	scroll(id) {
		// let el = document.getElementById(id);
		// let elementRect = el.getBoundingClientRect();
		// let absoluteElementTop = elementRect.top + window.pageYOffset;
		// let topElement = absoluteElementTop - 200;

		// console.log(`scrolling to ${id}`, el , absoluteElementTop ,window.innerHeight);
		// window.scrollTo({
		// 	top: topElement,
		// 	behavior: 'smooth'
		// });

		let el = document.getElementById(id);
		console.log(`scrolling to ${id}`, el);
		el.scrollIntoView({ behavior: 'smooth' });
	}

	SetFormValue(form_control: string, value: any, emitEvent: boolean = true) {
		if (!value || !form_control) {
			console.info(`No Value to set for ${form_control}. Returning ...`)
			return
		}
		console.log('Setting Form Value for ', form_control, ' : ', value);
		try {

			this.BookingForm.get(form_control).setValue(value, { emitEvent: emitEvent })
			if (emitEvent) {
				this.BookingForm.updateValueAndValidity()
			}
		}
		catch (err) {
			console.error('NFC Error: ')
			return
		}
	}

	SetLCFormValue(form_control: string, value: any) {
		if (!value || !form_control) {
			console.info(`No Value to set for ${form_control}. Returning ...`)
			return
		}
		console.log('Setting Form Value for ', form_control, ' : ', value);
		try {

			(this.BookingForm.get('loose_customer')).get(form_control).setValue(value)
			this.BookingForm.updateValueAndValidity()
		}
		catch (err) {
			console.error('NFC Error: ')
			return
		}
	}

	convertToMinutes(value) {
		const days = Math.floor(value / (24 * 60 * 60));
		const remainingSeconds = value % (24 * 60 * 60);
		const hours = Math.floor(remainingSeconds / (60 * 60));
		const remainingMinutes = Math.floor((remainingSeconds % (60 * 60)) / 60);

		let result = "";

		if (days > 0) {
			result += `${days} days, `;
		}

		if (hours > 0 || (days === 0 && hours === 0)) {
			result += `${hours} hours, `;
		}

		result += `${remainingMinutes} minutes`;

		return result;
	}


	// MapController.ts

	mapDebounceTimer: any;
	returnMapDebounceTimer: any;
	pickupMarkers: google.maps.Marker[] = [];
	returnMarkers: google.maps.Marker[] = [];
	pickupDirectionsRenderer: google.maps.DirectionsRenderer | null = null;
	returnDirectionsRenderer: google.maps.DirectionsRenderer | null = null;

	async MapController(is_return: boolean = false) {
		if (is_return) {
			if (this.returnMapDebounceTimer) clearTimeout(this.returnMapDebounceTimer);
			this.returnMapDebounceTimer = setTimeout(async () => {
				await this._MapController(true);
			}, 300);
		} else {
			if (this.mapDebounceTimer) clearTimeout(this.mapDebounceTimer);
			this.mapDebounceTimer = setTimeout(async () => {
				await this._MapController(false);
			}, 300);
		}
	}

	async _MapController(is_return: boolean = false) {
		try {
			let waypoints: google.maps.DirectionsWaypoint[] = []
			let origin: google.maps.LatLng
			let destination: google.maps.LatLng
			let map: google.maps.Map;
			const legLabel = is_return ? 'return' : 'outbound';

			// Wait for Maps API to be ready (it should be ready when component loads if using @angular/google-maps properly)
			await this.mapsApiReady();

			if (is_return) {
				const element = document.getElementById('return_map');
				if (!element) throw new Error('Return map element not found');

				map = new google.maps.Map(element, {
					zoom: 7,
					center: { lat: 41.850033, lng: -87.6500523 },
					scaleControl: true
				});

				waypoints = this.buildRouteWaypoints('return_extra_stops');

				// defaults for Source/Target - City
				origin = new google.maps.LatLng(this.Form.return_pickup_latitude.value, this.Form.return_pickup_longitude.value)
				destination = new google.maps.LatLng(this.Form.return_dropoff_latitude.value, this.Form.return_dropoff_longitude.value)

				// Overrides
				if (this.Form.return_transfer_type.value.includes('airport_')) {
					// override for Source - Airport
					// console.log('Return Override for Source Airport')
					origin = new google.maps.LatLng(this.Form.return_pickup_airport_latitude.value, this.Form.return_pickup_airport_longitude.value)
				}
				if (this.Form.return_transfer_type.value.includes('_airport')) {
					// override for Target - Airport
					// console.log('Return Override for Target Airport')
					destination = new google.maps.LatLng(this.Form.return_dropoff_airport_latitude.value, this.Form.return_dropoff_airport_longitude.value)
				}

			} else {
				const element = document.getElementById('map');
				if (!element) throw new Error('Map element not found');

				map = new google.maps.Map(element, {
					zoom: 7,
					center: { lat: 41.850033, lng: -87.6500523 },
					scaleControl: true
				});

				waypoints = this.buildRouteWaypoints('extra_stops');

				//defaults for Source/Target - City
				origin = new google.maps.LatLng(this.Form.pickup_latitude.value, this.Form.pickup_longitude.value)
				destination = new google.maps.LatLng(this.Form.dropoff_latitude.value, this.Form.dropoff_longitude.value)


				// Overrides
				if (this.Form.transfer_type.value.includes('airport_')) {
					// override for Source - Airport
					// console.log('Override for Source Airport')
					origin = new google.maps.LatLng(this.Form.pickup_airport_latitude.value, this.Form.pickup_airport_longitude.value)
				}
				if (this.Form.transfer_type.value.includes('_airport')) {
					// override for Target - Airport
					// console.log('Override for Target Airport')
					destination = new google.maps.LatLng(this.Form.dropoff_airport_latitude.value, this.Form.dropoff_airport_longitude.value)
				}
			}

			console.group(`admin/new-booking _MapController ${legLabel}`);
			console.log('transfer_type', is_return ? this.Form.return_transfer_type.value : this.Form.transfer_type.value);
			console.log('origin', {
				lat: origin?.lat?.(),
				lng: origin?.lng?.()
			});
			console.log('destination', {
				lat: destination?.lat?.(),
				lng: destination?.lng?.()
			});
			console.log('waypoints_count', waypoints.length);
			console.log('waypoints', waypoints);
			console.groupEnd();

			const request: google.maps.DirectionsRequest = {
				origin,
				destination,
				waypoints,
				optimizeWaypoints: false,
				travelMode: google.maps.TravelMode.DRIVING
			};

			this.drawMap(map, request, is_return);
		} catch (error) {
			console.error('Error initializing MapController:', error);
		}
	}

	private hasValidRouteCoordinates(is_return: boolean = false): boolean {
		const transferType = is_return ? this.Form.return_transfer_type.value : this.Form.transfer_type.value;
		const prefix = is_return ? 'return_' : '';

		const pickupLatControl = transferType?.includes('airport_')
			? `${prefix}pickup_airport_latitude`
			: `${prefix}pickup_latitude`;
		const pickupLngControl = transferType?.includes('airport_')
			? `${prefix}pickup_airport_longitude`
			: `${prefix}pickup_longitude`;
		const dropoffLatControl = transferType?.includes('_airport')
			? `${prefix}dropoff_airport_latitude`
			: `${prefix}dropoff_latitude`;
		const dropoffLngControl = transferType?.includes('_airport')
			? `${prefix}dropoff_airport_longitude`
			: `${prefix}dropoff_longitude`;

		const pickupLat = this.parseRouteCoordinate(this.BookingForm.get(pickupLatControl)?.value);
		const pickupLng = this.parseRouteCoordinate(this.BookingForm.get(pickupLngControl)?.value);
		const dropoffLat = this.parseRouteCoordinate(this.BookingForm.get(dropoffLatControl)?.value);
		const dropoffLng = this.parseRouteCoordinate(this.BookingForm.get(dropoffLngControl)?.value);
		const isValid = [pickupLat, pickupLng, dropoffLat, dropoffLng].every((value) => value !== null && Number.isFinite(value));

		console.group(`admin/new-booking hasValidRouteCoordinates ${is_return ? 'return' : 'outbound'}`);
		console.log('transferType', transferType);
		console.log('pickup controls', pickupLatControl, pickupLngControl);
		console.log('dropoff controls', dropoffLatControl, dropoffLngControl);
		console.log('pickup values', { pickupLat, pickupLng });
		console.log('dropoff values', { dropoffLat, dropoffLng });
		console.log('isValid', isValid);
		console.groupEnd();

		return isValid;
	}

	private parseRouteCoordinate(value: any): number | null {
		if (value === '' || value === null || typeof value === 'undefined') {
			return null;
		}

		const parsedValue = Number(value);
		return Number.isFinite(parsedValue) ? parsedValue : null;
	}

	private buildRouteWaypoints(
		formArrayName: 'extra_stops' | 'return_extra_stops'
	): google.maps.DirectionsWaypoint[] {
		const formArray = this.BookingForm.get(formArrayName) as FormArray | null;
		if (!formArray) {
			return [];
		}

		return formArray.controls
			.map((control) => this.resolveRouteWaypointLocation((control as FormGroup).getRawValue()))
			.filter((location): location is google.maps.LatLng | string => !!location)
			.map((location) => ({
				location,
				stopover: true
			}));
	}

	private resolveRouteWaypointLocation(stop: Record<string, any>): google.maps.LatLng | string | null {
		const latitude = this.parseRouteCoordinate(stop?.latitude ?? stop?.lat ?? stop?.pickup_latitude);
		const longitude = this.parseRouteCoordinate(stop?.longitude ?? stop?.lng ?? stop?.long ?? stop?.pickup_longitude);

		if (latitude !== null && longitude !== null) {
			return new google.maps.LatLng(latitude, longitude);
		}

		const address = String(
			stop?.display_address
			|| stop?.formatted_address
			|| stop?.address
			|| ''
		).trim();

		return address || null;
	}

	private syncRouteCoordinatesForTransferType(is_return: boolean = false): void {
		const transferType = is_return ? this.Form.return_transfer_type.value : this.Form.transfer_type.value;
		const prefix = is_return ? 'return_' : '';

		if (!transferType) {
			return;
		}

		const syncEndpointCoordinates = (endpoint: 'pickup' | 'dropoff', endpointUsesAirportCoordinates: boolean) => {
			const addressControl = `${prefix}${endpoint}`;
			const addressLatControl = `${prefix}${endpoint}_latitude`;
			const addressLngControl = `${prefix}${endpoint}_longitude`;
			const airportOptionControl = `${prefix}${endpoint}_airport_option`;
			const airportNameControl = `${prefix}${endpoint}_airport_name`;
			const airportLatControl = `${prefix}${endpoint}_airport_latitude`;
			const airportLngControl = `${prefix}${endpoint}_airport_longitude`;

			const addressValue = this.BookingForm.get(addressControl)?.value;
			const airportDisplayValue = this.BookingForm.get(airportOptionControl)?.value || this.BookingForm.get(airportNameControl)?.value;
			const addressLat = this.parseRouteCoordinate(this.BookingForm.get(addressLatControl)?.value);
			const addressLng = this.parseRouteCoordinate(this.BookingForm.get(addressLngControl)?.value);
			const airportLat = this.parseRouteCoordinate(this.BookingForm.get(airportLatControl)?.value);
			const airportLng = this.parseRouteCoordinate(this.BookingForm.get(airportLngControl)?.value);
			const hasAddressCoordinates = addressLat !== null && addressLng !== null;
			const hasAirportCoordinates = airportLat !== null && airportLng !== null;
			const hasAddressValue = !!addressValue;
			const hasAirportValue = !!airportDisplayValue;

			console.group(`admin/new-booking syncRouteCoordinates ${is_return ? 'return' : 'outbound'} ${endpoint}`);
			console.log('transferType', transferType);
			console.log('endpointUsesAirportCoordinates', endpointUsesAirportCoordinates);
			console.log('addressValue', addressValue);
			console.log('airportDisplayValue', airportDisplayValue);
			console.log('addressCoordinates', { lat: addressLat, lng: addressLng, hasAddressCoordinates });
			console.log('airportCoordinates', { lat: airportLat, lng: airportLng, hasAirportCoordinates });

			if (!endpointUsesAirportCoordinates && hasAddressValue && !hasAddressCoordinates && hasAirportCoordinates) {
				console.log('action', 'copy airport coords -> address coords');
				this.SetFormValue(addressLatControl, airportLat, false);
				this.SetFormValue(addressLngControl, airportLng, false);
			}

			if (endpointUsesAirportCoordinates && hasAirportValue && !hasAirportCoordinates && hasAddressCoordinates) {
				console.log('action', 'copy address coords -> airport coords');
				this.SetFormValue(airportLatControl, addressLat, false);
				this.SetFormValue(airportLngControl, addressLng, false);
			}

			console.log('final address coords', {
				lat: this.BookingForm.get(addressLatControl)?.value,
				lng: this.BookingForm.get(addressLngControl)?.value
			});
			console.log('final airport coords', {
				lat: this.BookingForm.get(airportLatControl)?.value,
				lng: this.BookingForm.get(airportLngControl)?.value
			});
			console.groupEnd();
		};

		syncEndpointCoordinates('pickup', transferType.includes('airport_'));
		syncEndpointCoordinates('dropoff', transferType.includes('_airport'));
	}

	private refreshMapIfRouteReady(is_return: boolean = false): void {
		console.group(`admin/new-booking refreshMapIfRouteReady ${is_return ? 'return' : 'outbound'}`);
		console.log('transferType before sync', is_return ? this.Form.return_transfer_type.value : this.Form.transfer_type.value);
		this.syncRouteCoordinatesForTransferType(is_return);
		const routeReady = this.hasValidRouteCoordinates(is_return);
		console.log('routeReady', routeReady);
		if (routeReady) {
			console.log('action', 'calling MapController');
			this.MapController(is_return);
		} else {
			console.log('action', 'skipping MapController because route is not ready');
		}
		console.groupEnd();
	}




	// ... inside class ...

	private renderCustomMarkers(
		map: google.maps.Map,
		response: google.maps.DirectionsResult,
		is_return: boolean = false
	) {
		// Clear existing markers for this specific map
		if (is_return) {
			if (this.returnMarkers) {
				this.returnMarkers.forEach(marker => marker.setMap(null));
			}
			this.returnMarkers = [];
		} else {
			if (this.pickupMarkers) {
				this.pickupMarkers.forEach(marker => marker.setMap(null));
			}
			this.pickupMarkers = [];
		}

		const locations: google.maps.LatLngLiteral[] = [];
		const route = response.routes[0];

		if (!route || !route.legs) return;

		const legs = route.legs;

		// Pickup (Start of first leg)
		locations.push(legs[0].start_location.toJSON());

		// Waypoints (End of all legs except the last one)
		for (let i = 0; i < legs.length - 1; i++) {
			locations.push(legs[i].end_location.toJSON());
		}

		// Dropoff (End of last leg)
		locations.push(legs[legs.length - 1].end_location.toJSON());


		// Use Utility to offset overlapping points
		// Returns { position, pixelOffset } for pixel-based offsetting
		const adjusted = MapUtils.getOffsetMarkers(locations, 100);

		console.log(is_return ? 'Return Original Locations:' : 'Original Locations:', locations);
		console.log(is_return ? 'Return Adjusted Markers:' : 'Adjusted Markers:', adjusted);

		// Labels: A, B, C, D...
		adjusted.forEach((item, index) => {
			// ASCII 65 = 'A'
			const labelChar = String.fromCharCode(65 + index);

			const marker = new google.maps.Marker({
				position: item.position,
				map: map,
				zIndex: 1000 + index, // Ensure sequence stacking (later stops on top)
				title: `Stop ${labelChar}`,
				icon: {
					path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z",
					fillColor: "#EA4335", // Standard Google Red
					fillOpacity: 1,
					strokeColor: "#B31412", // Darker red border
					strokeWeight: 1,
					scale: 1.5,
					// Shift the anchor horizontally based on pixelOffset.
					// Path center is 12, bottom tip is 22.
					anchor: new google.maps.Point(12 - (item.pixelOffset / 1.5), 22),
					labelOrigin: new google.maps.Point(12, 9)
				},
				label: {
					text: labelChar,
					color: 'white',
					fontSize: '14px',
					fontWeight: 'bold'
				}
			});

			if (is_return) {
				this.returnMarkers.push(marker);
			} else {
				this.pickupMarkers.push(marker);
			}
		});
	}

	// drawMap.ts
    drawMap(map: google.maps.Map, request: google.maps.DirectionsRequest, is_return: boolean) {
		if (!request.origin || !request.destination) {
			console.error('Request object missing origin/destination');
			return;
		}

		// Ensure we get multiple route options so we can pick the shortest
		request.provideRouteAlternatives = true;

		// Clean up previous renderer for this specific journey
		if (is_return) {
			if (this.returnDirectionsRenderer) {
				this.returnDirectionsRenderer.setMap(null);
				this.returnDirectionsRenderer = null;
			}
			this.returnDirectionsRenderer = new google.maps.DirectionsRenderer({ suppressMarkers: true });
			this.returnDirectionsRenderer.setMap(map);
		} else {
			if (this.pickupDirectionsRenderer) {
				this.pickupDirectionsRenderer.setMap(null);
				this.pickupDirectionsRenderer = null;
			}
			this.pickupDirectionsRenderer = new google.maps.DirectionsRenderer({ suppressMarkers: true });
			this.pickupDirectionsRenderer.setMap(map);
		}

		const directionsService = new google.maps.DirectionsService();

		directionsService.route(request, (response, status) => {
			if (status === google.maps.DirectionsStatus.OK) {
				const renderer = is_return ? this.returnDirectionsRenderer : this.pickupDirectionsRenderer;

				// --- Pick the shortest route among the alternatives ---
				let shortestIndex = 0;
				let shortestDistanceMeters = this.getRouteDistanceMeters(response.routes[0]);

				for (let i = 1; i < response.routes.length; i++) {
					const distMeters = this.getRouteDistanceMeters(response.routes[i]);
					if (distMeters < shortestDistanceMeters) {
						shortestDistanceMeters = distMeters;
						shortestIndex = i;
					}
				}

				if (renderer) {
					renderer.setDirections(response);
					renderer.setRouteIndex(shortestIndex); // tell renderer to highlight the shortest one
				}

				this.renderCustomMarkers(map, response, is_return);

				// Pass only the chosen route's legs so distance/time matches what's drawn
				const chosenRoute = response.routes[shortestIndex];

				this.fetchDistanceAndTime(chosenRoute).then((res: { distance: number; time: number }) => {
					if (is_return) {
						this.return_distance = res.distance;
						if (!this.BookingForm.get('return_extra_stops')?.value?.length || this.BookingForm.get('return_extra_stops')?.value[0]['rate']?.length) {
							this.buildBookingData();
						}
						this.BookingForm.patchValue({
							returnJourneyDistance: res.distance,
							returnJourneyTime: res.time
						});
					} else {
						this.distance = res.distance;
						if (!this.BookingForm.get('extra_stops')?.value?.length || this.BookingForm.get('extra_stops')?.value[0]['rate']?.length) {
							this.buildBookingData();
						}
						this.BookingForm.patchValue({
							journeyDistance: res.distance,
							journeyTime: res.time
						});
					}
				});
			} else {
				console.error('Directions request failed due to', status);
			}
		});
	}

	// Helper: sum distance (in meters) across all legs of a route
	private getRouteDistanceMeters(route: google.maps.DirectionsRoute): number {
		return route.legs.reduce((sum, leg) => sum + (leg.distance?.value ?? 0), 0);
	}


	mapsApiReady(): Promise<void> {
		return new Promise((resolve, reject) => {
			if (window['google'] && window['google'].maps) {
				resolve();
			} else {
				const check = setInterval(() => {
					if (window['google'] && window['google'].maps) {
						clearInterval(check);
						resolve();
					}
				}, 100);
				setTimeout(() => {
					clearInterval(check);
					reject('Google Maps API not available');
				}, 5000); // Timeout after 5s
			}
		});
	}


	get Form() {
		return this.BookingForm.controls;
	}
	
	get LooseCustomer() {
		return (<FormGroup>this.BookingForm.get('loose_customer')).controls;
	}

	get ExtraStops(): FormArray {
		return (<FormArray>this.BookingForm.get('extra_stops'));
	}

	get ReturnExtraStops() {
		return (<FormArray>this.BookingForm.get('return_extra_stops'));
	}


	fillAddress(form_control: string, address: any) {
		console.log('Address: ', address)
		let address_components = address?.address_components
		// //setting currency based on pickup address country
		if (form_control == 'dropoff' || form_control == 'return_dropoff')
			this.httpClient.get("assets/json/currencyOptions.json").subscribe(data => {
				for (const key of Object.keys(data)) {
					if (address_components.find(component => component.long_name === data[key].countryName)) {
						console.log("Address:", data[key])
						this.currencyObj = data[key]
						this.currencySymbol = data[key].symbol
					}
				}
			})
		this.SetFormValue(form_control, address?.display_address ?? address?.formatted_address)
	}

	fillLocationPoints(form_control: string, location: any) {
		// console.log('Location Points', location)
		this.SetFormValue(form_control + '_latitude', location.latitude)
		this.SetFormValue(form_control + '_longitude', location.longitude)
		this.MapController()
		if (this.Form.service_type.value == 'round_trip') {
			this.MapController(true)
		}
	}

	getAirportDisplayValue(airport: any): string {
		if (!airport) {
			return '';
		}
		return airport?.formatted_name
			|| airport?.display_address
			|| airport?.formattedAddress
			|| airport?.formatted_address
			|| airport?.name
			|| airport?.displayName
			|| (typeof airport === 'string' ? airport : '');
	}

	getAirportSelectionLabel(airport: any): string {
		if (!airport) {
			return '';
		}

		const displayName = typeof airport?.displayName === 'string'
			? airport.displayName
			: airport?.displayName?.text;
		const primaryName = airport?.name || displayName || '';
		const displayValue = this.getAirportDisplayValue(airport);

		if (primaryName && displayValue) {
			if (displayValue === primaryName || displayValue.startsWith(`${primaryName} - `)) {
				return displayValue;
			}
			return `${primaryName} - ${displayValue}`;
		}

		return primaryName || displayValue;
	}

	normalizeAirportMatchText(value: any): string {
		return String(value || '')
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, ' ')
			.trim();
	}

	getNumericAirportCoordinate(value: any): number | null {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : null;
	}

	getAirportCoordinates(airport: any): { lat: number, lng: number } | null {
		const lat = this.getNumericAirportCoordinate(airport?.lat ?? airport?.latitude);
		const lng = this.getNumericAirportCoordinate(airport?.long ?? airport?.lng ?? airport?.longitude);
		return lat !== null && lng !== null ? { lat, lng } : null;
	}

	getAirportDistanceInKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
		const toRadians = (value: number) => value * Math.PI / 180;
		const earthRadiusKm = 6371;
		const deltaLat = toRadians(lat2 - lat1);
		const deltaLng = toRadians(lng2 - lng1);
		const a =
			Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
			Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
			Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
		const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
		return earthRadiusKm * c;
	}

	resolveInternalAirportRecord(placeLike: any, latitude?: number | null, longitude?: number | null): any {
		const airports = this.BigData?.airportsData || [];
		if (!airports.length) {
			return null;
		}

		const normalizedLat = this.getNumericAirportCoordinate(latitude);
		const normalizedLng = this.getNumericAirportCoordinate(longitude);

		if (normalizedLat !== null && normalizedLng !== null) {
			let nearestAirport: any = null;
			let nearestDistance = Number.POSITIVE_INFINITY;

			for (const airport of airports) {
				const coordinates = this.getAirportCoordinates(airport);
				if (!coordinates) {
					continue;
				}
				const distance = this.getAirportDistanceInKm(normalizedLat, normalizedLng, coordinates.lat, coordinates.lng);
				if (distance < nearestDistance) {
					nearestDistance = distance;
					nearestAirport = airport;
				}
			}

			if (nearestAirport) {
				console.log('admin/new-booking nearest internal airport match', {
					displayValue: this.getAirportDisplayValue(placeLike),
					latitude: normalizedLat,
					longitude: normalizedLng,
					nearestAirport,
					nearestDistanceKm: nearestDistance
				});
				return nearestAirport;
			}
		}

		const displayValue = this.getAirportDisplayValue(placeLike);
		const nameValue = placeLike?.name || placeLike?.displayName || '';
		const addressValue = placeLike?.formatted_address || placeLike?.formattedAddress || '';
		const searchBlob = this.normalizeAirportMatchText([displayValue, nameValue, addressValue].filter(Boolean).join(' '));

		if (!searchBlob) {
			return null;
		}

		const codeTokens = searchBlob.split(' ');
		let bestMatch: any = null;
		let bestScore = 0;

		for (const airport of airports) {
			const code = String(airport?.code || '').toLowerCase();
			const name = this.normalizeAirportMatchText(airport?.name);
			const formattedName = this.normalizeAirportMatchText(airport?.formatted_name);
			const city = this.normalizeAirportMatchText(airport?.city);
			const country = this.normalizeAirportMatchText(airport?.country);
			let score = 0;

			if (code && codeTokens.includes(code)) {
				score += 300;
			}
			if (name && searchBlob.includes(name)) {
				score += 220;
			}
			if (formattedName && searchBlob.includes(formattedName)) {
				score += 180;
			}
			if (city && searchBlob.includes(city)) {
				score += 40;
			}
			if (country && searchBlob.includes(country)) {
				score += 20;
			}

			if (score > bestScore) {
				bestScore = score;
				bestMatch = airport;
			}
		}

		return bestScore > 0 ? bestMatch : null;
	}

	updateCurrencyFromAirportPlace(place: google.maps.places.PlaceResult) {
		const addressComponents = place?.address_components || [];
		if (!addressComponents.length) {
			return;
		}
		this.httpClient.get("assets/json/currencyOptions.json").subscribe((data: any) => {
			for (const key of Object.keys(data)) {
				if (addressComponents.find(component => component.long_name === data[key].countryName)) {
					this.currencyObj = data[key]
					this.currencySymbol = data[key].symbol
				}
			}
		})
	}

	handleAirportPlaceSelection(formControl: string, place: google.maps.places.PlaceResult) {
		const displayValue = this.getAirportSelectionLabel(place);
		const location = place.geometry?.location;
		if (!location) {
			return;
		}
		const latitude = location.lat();
		const longitude = location.lng();
		const matchedAirport = this.resolveInternalAirportRecord(place, latitude, longitude);

		this.BookingForm.get(`${formControl}_option`)?.setValue(displayValue);
		this.BookingForm.get(`${formControl}_name`)?.setValue(displayValue);
		this.BookingForm.get(`${formControl}_latitude`)?.setValue(latitude);
		this.BookingForm.get(`${formControl}_longitude`)?.setValue(longitude);
		this.BookingForm.get(formControl)?.setValue(matchedAirport?.id ?? '');
		this.BookingForm.updateValueAndValidity();

		console.group(`admin/new-booking airport selection :: ${formControl}`);
		console.log('google place_id', place.place_id || '');
		console.log('matched internal airport', matchedAirport);
		console.log('latitude', latitude);
		console.log('longitude', longitude);
		console.groupEnd();

		if (formControl === 'dropoff_airport' || formControl === 'return_dropoff_airport') {
			this.updateCurrencyFromAirportPlace(place);
		}
	}

	clearAddressField(formControl: string) {
		this.closeCustomAddressDropdown(formControl);
		this.closeCustomAirportDropdown();
		this.BookingForm.get(formControl)?.setValue('');
		this.BookingForm.get(`${formControl}_latitude`)?.setValue('');
		this.BookingForm.get(`${formControl}_longitude`)?.setValue('');
		this.BookingForm.updateValueAndValidity();

		const inputMap: Record<string, ElementRef | undefined> = {
			pickup: this.pickupInput,
			dropoff: this.dropoffInput,
			return_pickup: this.return_pickupInput,
			return_dropoff: this.return_dropoffInput,
			fbo_address: this.fboAddressInput,
			return_fbo_address: this.returnFboAddressInput,
		};

		const nativeInput = inputMap[formControl]?.nativeElement as HTMLInputElement | undefined;
		if (nativeInput) {
			nativeInput.value = '';
			clearPlaceAutocompleteDisplay(nativeInput);
		}
	}

	clearLooseCustomerAddress(input?: HTMLInputElement) {
		this.closeCustomAddressDropdown('loose_customer_address');
		this.BookingForm.get('loose_customer.address')?.setValue('');
		this.BookingForm.updateValueAndValidity();

		if (input) {
			input.value = '';
			clearPlaceAutocompleteDisplay(input);
		}
	}

	clearAirportField(formControl: string) {
		this.resetCustomAirportSessionToken(formControl);
		this.clearCustomAirportSearchDebounceTimer(formControl);
		this.closeCustomAirportDropdown(formControl);
		this.closeCustomAddressDropdown();
		this.BookingForm.get(formControl)?.setValue('', { emitEvent: false });
		this.BookingForm.get(`${formControl}_option`)?.setValue('', { emitEvent: false });
		this.BookingForm.get(`${formControl}_name`)?.setValue('', { emitEvent: false });
		this.BookingForm.get(`${formControl}_latitude`)?.setValue('', { emitEvent: false });
		this.BookingForm.get(`${formControl}_longitude`)?.setValue('', { emitEvent: false });
		this.BookingForm.updateValueAndValidity();

		const inputMap: Record<string, ElementRef | undefined> = {
			pickup_airport: this.pickupAirportInput,
			dropoff_airport: this.dropoffAirportInput,
			return_pickup_airport: this.returnPickupAirportInput,
			return_dropoff_airport: this.returnDropoffAirportInput,
		};

		const nativeInput = inputMap[formControl]?.nativeElement as HTMLInputElement | undefined;
		if (nativeInput) {
			nativeInput.value = '';
			clearPlaceAutocompleteDisplay(nativeInput);
		}

		this.resyncAirportAutocompleteDisplays();
		requestAnimationFrame(() => this.resyncAirportAutocompleteDisplays());
		setTimeout(() => this.resyncAirportAutocompleteDisplays(), 0);
		setTimeout(() => this.resyncAirportAutocompleteDisplays(), 120);
	}

	clearExtraStopAddress(isReturn: boolean, stopIndex: number, input?: HTMLInputElement) {
		this.closeCustomAddressDropdown(this.getExtraStopFieldKey(isReturn, stopIndex));
		const formArrayName = isReturn ? 'return_extra_stops' : 'extra_stops';
		const stopGroup = (this.BookingForm.get(formArrayName) as FormArray)?.at(stopIndex);

		stopGroup?.get('address')?.setValue('');
		stopGroup?.get('latitude')?.setValue('');
		stopGroup?.get('longitude')?.setValue('');
		this.BookingForm.updateValueAndValidity();

		if (input) {
			input.value = '';
			syncPlaceAutocompleteDisplay(input);
		}

		if (isReturn) {
			this.MapController(true);
		} else {
			this.MapController();
		}
		this.buildBookingData();
	}

	private resyncAirportAutocompleteDisplays() {
		const syncMap: Array<{ formControl: string; inputRef?: ElementRef }> = [
			{ formControl: 'pickup_airport', inputRef: this.pickupAirportInput },
			{ formControl: 'dropoff_airport', inputRef: this.dropoffAirportInput },
			{ formControl: 'return_pickup_airport', inputRef: this.returnPickupAirportInput },
			{ formControl: 'return_dropoff_airport', inputRef: this.returnDropoffAirportInput },
		];

		syncMap.forEach(({ formControl, inputRef }) => {
			const nativeInput = inputRef?.nativeElement as HTMLInputElement | undefined;
			if (!nativeInput) {
				return;
			}

			nativeInput.value = this.BookingForm.get(`${formControl}_option`)?.value || '';
			syncPlaceAutocompleteDisplay(nativeInput);
		});
	}

	fetchAirportsAndBigData(): void {
		this.bigDataSubscription = this.$api.bigData$.subscribe((data: any) => {
			if (data) {
				this.$spinner.hide('fetchspinner');
				this.BigData = data;
				// Deep copy needed only if form mutates it independently (safeguard)
				this.BigData_COPY = JSON.parse(JSON.stringify(this.BigData));

				this.MapController();
				this.checkAndPrefill();
				this.newBooking ? this.setValueByBookNow() : "";
			} else {
				this.$spinner.show('fetchspinner');
			}
		});
	}

	checkAndPrefill() {
		if (this.BigData && this.Form.reservation_id.value) {
			this.prefillViaBookingID(this.Form.reservation_id.value);
		}
	}


	fetchClientAccounts(account_type: string) {
		const legend = {
			individual: 'individual',
			// corporate: 'corporate',
			travel_planner: 'travel'
		}

		// fail-safe
		if (!legend.hasOwnProperty(account_type)) {
			// console.error('Invalid Account type: ', account_type)
			return
		}
		else {
			this.$spinner.show()
			console.log("client acc", this.ClientAccounts)
			this.$api.getAccountBytype(legend[account_type]).subscribe((response: any) => {
				if (response.success && response.data.length > 0) {
					this.ClientAccounts = response.data;
				}
				else {
					this.ClientAccounts = []
				}
				console.log("client acc", this.ClientAccounts)
				this.$spinner.hide()
			})
		}
	}

	onSelectionChangeServiceType(event: any) {
		console.log("in service type change--->", event.value)
		this.service_type = event.value;
		// Patch to ensure all bound mat-select instances reflect the new value
		this.BookingForm.get('service_type')?.setValue(event.value, { emitEvent: false });
		this.buildBookingData();
	}

	changeReturnTransferType(event: any) {
		console.log("return transfer type", event)
		this.return_transfer_type = event
		this.retryGoogleAutocompleteInitialization()
	}

	handleMirroredTransferTypeChange(type: string) {
		if (!type) {
			return;
		}

		if (this.BookingForm?.get('transfer_type')?.value !== type) {
			this.BookingForm?.get('transfer_type')?.setValue(type);
			return;
		}

		this.changeTransferType(type);
	}

	handleMirroredReturnTransferTypeChange(type: string) {
		if (!type) {
			return;
		}

		if (this.BookingForm?.get('return_transfer_type')?.value !== type) {
			this.BookingForm?.get('return_transfer_type')?.setValue(type);
			return;
		}

		this.changeReturnTransferType(type);
	}

	logTransferTypeState(context: string) {
		console.group(`admin/new-booking transfer state :: ${context}`);
		console.log('component service_type', this.service_type);
		console.log('component transfer_type', this.transfer_type);
		console.log('component return_transfer_type', this.return_transfer_type);
		console.log('form service_type', this.BookingForm?.get('service_type')?.value);
		console.log('form transfer_type', this.BookingForm?.get('transfer_type')?.value);
		console.log('form return_transfer_type', this.BookingForm?.get('return_transfer_type')?.value);
		console.groupEnd();
	}

	chooseUser(account_id: number, autofill: boolean = true, account_type: string = '') {
		console.log("in affiliate info")
		this.$spinner.show()
		this.chosen_user = {}
		let accType = account_type ? account_type : this.Form.account_type.value;
		this.$api.chooseUser(account_id, accType).subscribe((response: any) => {
			if (response.success && Object.keys(response.data).length > 0) {
				this.chosen_user = response.data
				this.chosen_user['name'] = `${response.data.first_name} ${response.data.middle_name ?? ''} ${response.data.last_name}`
				if (autofill) {
					this.autofillData('passenger', this.chosen_user);
				}
				// this.fillLCDetails(this.chosen_user)
				if (!this.Form.reservation_id.value) {
					// this.autofillData('passenger', this.chosen_user);
				}
			}
			this.$spinner.hide();
		})
		this.loadSavedCards(account_id, accType === 'individual');
	}

	private loadSavedCards(accountId: number, shouldLoad: boolean) {
		const travelAdvisorId = this.Form?.account_type?.value === 'travel_planner'
			? (accountId || this.Form?.acc_id?.value)
			: null;
		this.loadCombinedSavedCards(accountId, shouldLoad, travelAdvisorId);
	}

	private normalizeSavedCards(cards: any[] = [], ownerType: 'TRAVEL ADVISOR' | 'INDIVIDUAL') {
		const ownerLabel = ownerType === 'TRAVEL ADVISOR' ? 'TRAVEL ADVISOR' : 'INDIVIDUAL';
		return cards.map((card: any) => ({
			...card,
			ownerType,
			ownerLabel
		}));
	}

	private loadCombinedSavedCards(accountId: number, shouldLoad: boolean, travelAdvisorId?: number) {
		if ((!shouldLoad || !accountId) && !travelAdvisorId) {
			this.userCreditCards = [];
			this.isLoadingSavedCards = false;
			return;
		}

		this.isLoadingSavedCards = true;
		this.userCreditCards = [];

		const requests: Promise<any>[] = [];
		const resultKeys: Array<'travelAdvisorCards' | 'clientCards'> = [];

		if (travelAdvisorId) {
			requests.push(this.$api.cardsList(travelAdvisorId));
			resultKeys.push('travelAdvisorCards');
		}

		if (shouldLoad && accountId) {
			requests.push(this.$api.cardsList(accountId));
			resultKeys.push('clientCards');
		}

		Promise.all(requests).then((responses: any[]) => {
			const cardsMap = responses.reduce((acc: any, response: any, index: number) => {
				acc[resultKeys[index]] = response?.data || [];
				return acc;
			}, {});

			const travelAdvisorCards = this.normalizeSavedCards(cardsMap.travelAdvisorCards || [], 'TRAVEL ADVISOR');
			const clientCards = this.normalizeSavedCards(cardsMap.clientCards || [], 'INDIVIDUAL');

			this.userCreditCards = [...travelAdvisorCards, ...clientCards];
		}).catch(() => {
			this.userCreditCards = [];
		}).finally(() => {
			this.isLoadingSavedCards = false;
		});
	}

	private shouldHandlePrefilledBookingAccount(): boolean {
		return ['repeat', 'return', 'edit', 'round'].includes(this.updateType);
	}

	shouldRenderSavedCardsSection(): boolean {
		const isDirectIndividual = this.Form?.account_type?.value === 'individual' && !!this.Form?.acc_id?.value;
		const isTravelAdvisor = this.Form?.account_type?.value === 'travel_planner' && !!this.Form?.acc_id?.value;
		const isTravelIndividual = this.Form?.account_type?.value === 'travel_planner'
			&& this.Form?.travel_client_acc?.value === 'travel_individual'
			&& !!this.Form?.travel_client_id?.value;

		return isDirectIndividual || isTravelAdvisor || isTravelIndividual;
	}

	fillLCDetails(choose_user: any) {
		this.SetLCFormValue('first_name', choose_user?.first_name)
		this.SetLCFormValue('middle_name', choose_user?.middle_name)
		this.SetLCFormValue('last_name', choose_user?.last_name)
		this.SetLCFormValue('email', choose_user?.email)
		this.SetLCFormValue('phone', choose_user?.mobile)
	}
	getTravelClientAccounts(id) {
		this.$api.getTravelClientAccount(id).subscribe((response: any) => {
			console.log("accounts->>>>>>>>>>", response)
			this.travelStaffAccounts = response?.data
		})
	}
	handleClientAccChange(selectedAcc) {
		this.isTravelShare = selectedAcc == 'travel_planner' ? true : false
		this.BookingForm.get('acc_id').setValue(null);
		this.chosen_user = null
		this.BookingForm.patchValue({
			passenger_name: '',
			passenger_email: '',
			passenger_cell: '',
			passenger_cell_isd: '+1',
			passenger_cell_country: 'us',
		})
		this.userCreditCards = [];
		this.isLoadingSavedCards = false;
		if (selectedAcc == 'travel_planner') {
			this.BookingForm.get('travel_client_id').setValidators([Validators.required]);
			this.BookingForm.get('travel_client_id').updateValueAndValidity();
		}
		else {
			this.BookingForm.get('travel_client_id').clearValidators();
			this.BookingForm.get('travel_client_id').updateValueAndValidity();
		}
	}

	handleClientAccount(value: any) {
		console.log('---------------------_>>>>>>>>>>>>>> client acc value', value)
		this.chooseUser(value.id)
		if (this.BookingForm.get('account_type').value == 'travel_planner') {
			this.BookingForm.patchValue({
				travel_client_id: ''
			})
			this.getTravelClientAccounts(value.id)
		}

	}

	handleChangeTravelAccounts(selectedAcc) {
		console.log('handleChangeTravelAccounts-->>', selectedAcc)
		const travel_client_id = this.BookingForm.get('travel_client_id');
		if (travel_client_id) {
			if (selectedAcc == 'travel_individual') {
				travel_client_id.setValidators([Validators.required]);
				travel_client_id.updateValueAndValidity();
			}
			else {
				travel_client_id.clearValidators();
				travel_client_id.updateValueAndValidity();
			}
		}

		const travelAdvisorId = this.Form?.acc_id?.value;
		const travelClientId = this.Form?.travel_client_id?.value;
		this.loadCombinedSavedCards(
			travelClientId,
			selectedAcc == 'travel_individual',
			travelAdvisorId
		);

	}
	handleTravelStaffAccounts(value: any) {
		console.log('handleTravelStaffAccounts--->>>', value)
		this.$api.getTravelClientDetailById(value.id).subscribe((response: any) => {
			console.log("detail ->>>>>>>", response)
			if (this.isPrefilling) {
				this.autofillData('passenger', response?.data);

			}
			this.isPrefilling = true;

		})
		this.loadCombinedSavedCards(value?.id, this.Form.travel_client_acc?.value === 'travel_individual', this.Form?.acc_id?.value);
	}

	handleLooseCustomerPhone(event: any) {
		console.log('handleLooseCustomerPhone->>', event, event.target.value)
		const loose_customer = this.BookingForm.get('loose_customer') as FormGroup
		if (loose_customer) {
			this.BookingForm.patchValue({
				passenger_cell: event.target.value,
				passenger_cell_isd: loose_customer.get('phone_isd')?.value,
				passenger_cell_country: loose_customer.get('phone_country')?.value
			})
		}
	}

	handlePassengerName(event: any) {
		let value = this.BookingForm.get('passenger_name').value || '';
		value = value.replace(/\b\w/g, (l: string) => l.toUpperCase());
		this.BookingForm.patchValue({
			passenger_name: value
		}, { emitEvent: false });
	}

	handleLooseCustomerName(event) {
		const loose_customer = (this.BookingForm.get('loose_customer') as FormGroup);
		let first_name = loose_customer.get('first_name').value || '';
		let last_name = loose_customer.get('last_name').value || '';

		// Capitalize first and last name
		first_name = first_name.replace(/\b\w/g, (l: string) => l.toUpperCase());
		last_name = last_name.replace(/\b\w/g, (l: string) => l.toUpperCase());

		loose_customer.patchValue({
			first_name: first_name,
			last_name: last_name
		}, { emitEvent: false });

		const fullName = (first_name + ' ' + last_name).trim();

		this.BookingForm.patchValue({
			passenger_name: fullName
		});

		// Prefill Card Holder Name
		const card_details = loose_customer.get('card_details') as FormGroup;
		if (card_details) {
			card_details.patchValue({
				name: fullName
			});
		}
	}

	handleLooseAffiliateName() {
		this.BookingForm.patchValue({
			driver_name: this.BookingForm.get('lose_affiliate_name').value
		})

	}

	handleLooseAffiliatePhone() {
		this.BookingForm.patchValue({
			driver_cell: this.BookingForm.get('lose_affiliate_phone').value
		})
	}

	private buildAffiliateDisplayName(item: any): string {
		return [item?.name, item?.driver_name, item?.badge_city_name]
			.map((value) => (value ?? '').toString().trim())
			.filter((value) => !!value)
			.join(' / ');
	}

	private appendOperatorToLooseAffiliates(data: any[]): any[] {
		return (data || []).map((item) => ({
			...item,
			name: item?.operator_name ? `${item.name} / ${item.operator_name}` : item.name
		}))
	}


	fetchAffiliates(affiliate_type: 'affiliate' | 'loose_affiliate') {
		if (affiliate_type == 'loose_affiliate') {
			this.$spinner.show()
			this.$api.getAccountBytype('loose_affiliate').subscribe((response: any) => {
				this.LooseAffiliateAccounts = this.appendOperatorToLooseAffiliates(response?.data)
				this.$spinner.hide()
			})
			return;
		}

		this.AffiliateAccounts = []
		this.loadAffiliates(false, { reset: true });
	}

	fetchReturnAffiliates(return_affiliate_type: 'affiliate' | 'loose_affiliate') {
		if (return_affiliate_type == 'loose_affiliate') {
			this.$spinner.show()
			this.$api.getAccountBytype('loose_affiliate').subscribe((response: any) => {
				this.Return_LooseAffiliateAccounts = this.appendOperatorToLooseAffiliates(response?.data)
				this.$spinner.hide()
			})
			return;
		}

		this.Return_AffiliateAccounts = []
		this.loadAffiliates(true, { reset: true });
	}

	/**
	 * Load a page of affiliates from the API.
	 *
	 * The list is searched, ranked by distance from the pickup and paged server
	 * side. `reset` starts a new list; without it the next page is appended for
	 * infinite scroll.
	 */
	private loadAffiliates(isReturn: boolean, opts: { reset?: boolean; term?: string } = {}) {
		const state = isReturn ? this.returnAffiliateLookup : this.affiliateLookup;

		if (state.loading) {
			return;
		}

		if (opts.reset) {
			state.page = 1;
			state.items = [];
			state.hasMore = false;
			state.total = 0;
			if (opts.term !== undefined) {
				state.term = opts.term;
			}
		} else {
			if (!state.hasMore) {
				return;
			}
			state.page += 1;
		}

		const requestId = ++state.requestId;
		state.loading = true;

		const coords = this.getPickupCoords(isReturn);
		state.ranked = !!coords;
		const selectedId = this.BookingForm.get(isReturn ? 'return_affiliate_id' : 'affiliate_id')?.value;

		const params: AffiliateLookupParams = {
			search: state.term,
			lat: coords?.lat ?? null,
			lng: coords?.lng ?? null,
			page: state.page,
			per_page: this.affiliatePageSize,
			// Keeps an already-selected affiliate in the payload even when it
			// falls outside the current page or search term.
			ids: selectedId ? [selectedId] : []
		};

		if (state.page === 1) {
			this.$spinner.show();
		}

		this.$api.getAccountBytype('driver', params).subscribe({
			next: (response: any) => {
				// A slower earlier request must not overwrite a newer one.
				if (requestId !== state.requestId) {
					return;
				}

				const { rows, meta } = readAffiliateLookupResponse(response);

				const mapped = rows.map((item) => {
					item.bindNameAffiliate = buildRankedAffiliateLabel(item);
					return item;
				});

				if (state.page === 1) {
					state.items = mapped;
				} else {
					const seen = new Set(state.items.map((existing) => existing.id));
					state.items = state.items.concat(mapped.filter((item) => !seen.has(item.id)));
				}

				state.hasMore = meta ? meta.has_more : false;
				state.total = meta ? meta.total : state.items.length;
				state.loading = false;

				if (isReturn) {
					this.Return_AffiliateAccounts = state.items;
				} else {
					this.AffiliateAccounts = state.items;
				}

				this.$spinner.hide();
			},
			error: () => {
				if (requestId === state.requestId) {
					state.loading = false;
					if (!opts.reset && state.page > 1) {
						state.page -= 1;
					}
				}
				this.$spinner.hide();
			}
		});
	}

	/**
	 * Pickup coordinates for the given leg, or null when none are set yet.
	 *
	 * Airport pickups keep their coordinates in a different pair of controls
	 * from address pickups, chosen by transfer type.
	 */
	getPickupCoords(isReturn: boolean = false): { lat: number; lng: number } | null {
		const transferType = isReturn ? this.Form.return_transfer_type.value : this.Form.transfer_type.value;
		const prefix = isReturn ? 'return_' : '';

		const latControl = transferType?.includes('airport_')
			? `${prefix}pickup_airport_latitude`
			: `${prefix}pickup_latitude`;
		const lngControl = transferType?.includes('airport_')
			? `${prefix}pickup_airport_longitude`
			: `${prefix}pickup_longitude`;

		const lat = Number(this.BookingForm.get(latControl)?.value);
		const lng = Number(this.BookingForm.get(lngControl)?.value);

		if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
			return null;
		}

		return { lat, lng };
	}

	/** ng-select `[typeahead]` - debounced, then re-queries the API. */
	private initAffiliateSearchStream() {
		const wire = (source: Subject<string>, isReturn: boolean) => {
			source
				.pipe(
					debounceTime(300),
					map((term: string) => (term || '').trim()),
					distinctUntilChanged()
				)
				.subscribe((term: string) => this.loadAffiliates(isReturn, { reset: true, term }));
		};

		wire(this.affiliateTypeahead$, false);
		wire(this.returnAffiliateTypeahead$, true);
	}

	/** ng-select `(scrollToEnd)` - pulls the next page. */
	loadMoreAffiliates(isReturn: boolean = false) {
		this.loadAffiliates(isReturn, {});
	}

	/** Whether this leg's list was ranked against a pickup. */
	affiliateShowRank(isReturn: boolean = false): boolean {
		return (isReturn ? this.returnAffiliateLookup : this.affiliateLookup).ranked;
	}

	/** Colour modifier for the rank badge. */
	affiliateRankClass(item: any): string {
		return affiliateRankModifier(item);
	}

	/** Badge text - the distance once ranked, otherwise the band name. */
	affiliateRankBadgeText(item: any): string {
		return affiliateRankBadge(item);
	}

	/** Full band name, used as the badge's tooltip. */
	affiliateRankTitle(item: any): string {
		return formatAffiliateDistance(item);
	}

	/** "Showing 50 of 190" hint for the dropdown footer. */
	affiliateLookupHint(isReturn: boolean = false): string {
		const state = isReturn ? this.returnAffiliateLookup : this.affiliateLookup;

		if (!state.total || state.items.length >= state.total) {
			return '';
		}

		return `Showing ${state.items.length} of ${state.total} — scroll for more`;
	}
	// custom search function
	airportSearchFunction(term: string, item: any) {
		term = term.toLowerCase();

		// Creating and array of space saperated term and removinf the empty values using filter
		let splitTerm = term.split(' ').filter(t => t);

		let isWordThere = [];

		// Pushing True/False if match is found
		splitTerm.forEach(arr_term => {
			if (arr_term.length <= 3) {
				let search = item['formatted_name'].toLowerCase();
				isWordThere.push(search.startsWith(arr_term));
			}
			if (arr_term.length > 3) {
				let search = item['formatted_name'].toLowerCase();
				isWordThere.push(search.indexOf(arr_term) != -1);
			}
		});
		const all_words = (this_word) => this_word;
		// Every method will return true if all values are true in isWordThere.
		return isWordThere.every(all_words);
	}

	// custom search function
	airlineSearchFunction(term: string, item: any) {
		term = term.toLowerCase();

		// Creating and array of space saperated term and removinf the empty values using filter
		let splitTerm = term.split(' ').filter(t => t);

		let isWordThere = [];

		// Pushing True/False if match is found
		splitTerm.forEach(arr_term => {
			if (arr_term.length <= 2) {
				let search = item['formatted_name'].toLowerCase();
				isWordThere.push(search.startsWith(arr_term));
			}
			if (arr_term.length > 2) {
				let search = item['formatted_name'].toLowerCase();
				isWordThere.push(search.indexOf(arr_term) != -1);
			}
		});



		const all_words = (this_word) => this_word;
		// Every method will return true if all values are true in isWordThere.
		return isWordThere.every(all_words);
	}
	handleAffiliateChange(value) {
		console.log('in function handleAffiliateChange-->>', value)
	}
	handleLooseAffiliateChange(looseAffData) {
		console.log('in function handlelooseAffiliateChange-->>', looseAffData)
		if (looseAffData) {
			this.BookingForm.patchValue({
				driver_name: looseAffData?.driver_name,
				driver_cell: looseAffData?.driver_phone,
				driver_email: looseAffData?.driver_email,
				loose_affiliate_id: looseAffData?.id,
				is_old_loose_affiliate: true,
				driver_cell_isd: looseAffData?.driver_isd,
				driver_cell_country: looseAffData?.driver_phone_country
			})
			this.SetFormValue('lose_affiliate_name', looseAffData?.driver_name)
			this.SetFormValue('lose_affiliate_phone', looseAffData?.driver_phone)
			this.SetFormValue('lose_affiliate_email', looseAffData?.driver_email)
			const isd = looseAffData?.driver_isd || '';
			const formattedISD = isd.startsWith('+') ? isd : `+${isd}`;
			this.SetFormValue('lose_affiliate_phone_isd', formattedISD);
			// this.SetFormValue('lose_affiliate_phone_isd', looseAffData?.driver_isd)
			this.SetFormValue('lose_affiliate_phone_country', looseAffData?.driver_phone_country)
			this.loseAffiliateTelInput.setCountry(looseAffData?.driver_phone_country);
		}
		else {
			this.BookingForm?.patchValue({
				is_old_loose_affiliate: false
			})
			this.SetFormValue('lose_affiliate_name', '')
			this.SetFormValue('lose_affiliate_phone', '')
			this.SetFormValue('lose_affiliate_email', '')
			this.SetFormValue('lose_affiliate_phone_isd', '')
			this.SetFormValue('lose_affiliate_phone_country', 'us')
		}
		console.log('booking form value after selecting loose aff--->', this.BookingForm.value)
	}
	handleReturnLooseAffiliateChange(looseAffData) {
		console.log('in function handleReturnlooseAffiliateChange-->>', looseAffData)
		if (looseAffData) {
			this.BookingForm.patchValue({
				return_driver_name: looseAffData?.driver_name,
				return_driver_cell: looseAffData?.driver_phone,
				return_driver_email: looseAffData?.driver_email,
				return_loose_affiliate_id: looseAffData?.id,
				return_is_old_loose_affiliate: true
			})
			this.SetFormValue('return_lose_affiliate_name', looseAffData?.driver_name)
			this.SetFormValue('return_lose_affiliate_phone', looseAffData?.driver_phone)
			this.SetFormValue('return_lose_affiliate_email', looseAffData?.driver_email)
			const isd = looseAffData?.driver_isd || '';
			const formattedISD = isd.startsWith('+') ? isd : `+${isd}`;
			this.SetFormValue('return_lose_affiliate_phone_isd', formattedISD);
			// this.SetFormValue('return_lose_affiliate_phone_isd', looseAffData?.driver_isd)
			this.SetFormValue('return_lose_affiliate_phone_country', looseAffData?.driver_phone_country)
		}
		else {
			this.BookingForm?.patchValue({
				return_is_old_loose_affiliate: false
			})
			this.SetFormValue('return_lose_affiliate_name', '')
			this.SetFormValue('return_lose_affiliate_phone', '')
			this.SetFormValue('return_lose_affiliate_email', '')
			this.SetFormValue('return_lose_affiliate_phone_isd', '')
			this.SetFormValue('return_lose_affiliate_phone_country', 'us')
		}
		console.log('booking form value after selecting loose aff--->', this.BookingForm.value)
	}
	chooseAffiliate() {
		// console.warn('Fetching Affiliate vehicles and drivers')
		this.fetchAffiliateVehicles(this.BookingForm.get('affiliate_id').value)
		this.fetchAffiliateDrivers(this.BookingForm.get('affiliate_id').value)
	}

	chooseLooseAffiliate() {
		// console.warn('Fetching Affiliate vehicles and drivers')
		this.fetchLooseAffiliateVehicles(this.BookingForm.get('loose_affiliate_id').value)
		// this.fetchAffiliateDrivers(this.BookingForm.get('affiliate_id').value)
	}

	chooseReturnAffiliate() {
		// console.warn('Fetching Affiliate vehicles and drivers')
		this.fetchReturnAffiliateVehicles(this.BookingForm.get('return_affiliate_id').value)
		this.fetchReturnAffiliateDrivers(this.BookingForm.get('return_affiliate_id').value)
	}

	chooseReturnLooseAffiliate() {
		// console.warn('Fetching Affiliate vehicles and drivers')
		this.fetchReturnLooseAffiliateVehicles(this.BookingForm.get('return_loose_affiliate_id').value)
		// this.fetchReturnAffiliateDrivers(this.BookingForm.get('return_affiliate_id').value)
	}

	fetchAffiliateInformation(affiliate_id: number) {
		if (!affiliate_id) {
			console.error('Invalid Parameter affiliate_id', affiliate_id);
			return;
		}
		console.log("in affiliate info")
		this.$spinner.show('normalspinner');
		this.$api.getAffiliateAccount(affiliate_id).pipe(pluck('data')).subscribe((response: any) => {
			isDevMode() && console.info('Affiliate Information', response);
			this.AffiliateInformation = response;
			if (this.booking_created_from == 'admin') {
				console.log("in affiliate info")
				this.BookingForm.patchValue({
					susbcriber_name: this.AffiliateInformation?.FirstName + ' ' + this.AffiliateInformation?.LastName
				})
			}
			this.$spinner.hide('normalspinner');
		})
	}
	fetchReturnAffiliateInformation(return_affiliate_id: number) {
		this.$spinner.show('normalspinner');
		this.$api.getAffiliateAccount(return_affiliate_id).pipe(pluck('data')).subscribe((response: any) => {
			isDevMode() && console.info('Affiliate Information', response);
			this.ReturnAffiliateInformation = response;
			this.$spinner.hide('normalspinner');
		})
	}
	handleSelectVehicleType(selectedVehicle: any) {
		this.selectedVehicle = selectedVehicle
		console.log('selectweed vehicle-->>>>', selectedVehicle, selectedVehicle.licensePlate === null)
		this.SetFormValue('vehicle_id', selectedVehicle.ID);
		this.SetFormValue('vehicle_type_name', selectedVehicle.vehicleType)
		const isEditMode = ['edit', 'repeat', 'return', 'round'].includes(this.updateType);
		const isOriginalVehicle = isEditMode && selectedVehicle.ID == this.firstLoadVehicleId;
		console.log('[handleSelectVehicleType] updateType:', this.updateType, '| isOriginalVehicle:', isOriginalVehicle, '| firstLoadVehicleId:', this.firstLoadVehicleId, '| selectedVehicle.ID:', selectedVehicle.ID, '| bookingResponse?.driver_id:', this.bookingResponse?.driver_id, '| selectedVehicle.associated_driver:', selectedVehicle.associated_driver);
		const driverValue = (isOriginalVehicle && this.bookingResponse?.driver_id)
			? this.bookingResponse.driver_id
			: (selectedVehicle.associated_driver || this.DriverList?.[0]?.id);
		console.log('[handleSelectVehicleType] resolved driverValue:', driverValue);
		if (this.Form.affiliate_type.value !== 'loose_affiliate') {
			this.SetFormValue('driver_id', driverValue);
			this.autofillData('driver', driverValue);
		}
		this.SetFormValue('vehicle_make', selectedVehicle.make_id);
		this.SetFormValue('vehicle_make_name', selectedVehicle.make);
		this.SetFormValue('vehicle_model', selectedVehicle.model_id);
		this.SetFormValue('vehicle_model_name', selectedVehicle.model);
		this.SetFormValue('vehicle_year', selectedVehicle.year_id);
		this.SetFormValue('vehicle_year_name', selectedVehicle.year);
		this.SetFormValue('vehicle_color', selectedVehicle.color_id);
		this.SetFormValue('vehicle_color_name', selectedVehicle.color);
		selectedVehicle.licensePlate === null ? this.BookingForm.get('vehicle_license_plate').setValue('') : this.SetFormValue('vehicle_license_plate', selectedVehicle.licensePlate)
		this.SetFormValue('vehicle_seats', selectedVehicle.seats)
		//set cancellation period
		if (!this.booking_id) {
			if (this.BookingForm.get('service_type').value == 'charter_tour') {
				this.BookingForm.patchValue({
					cancellation_hours: selectedVehicle?.charter_cancellation_hours.toString()
				})
			}
			else {
				this.BookingForm.patchValue({
					cancellation_hours: selectedVehicle?.non_charter_cancellation_hours.toString()
				})
			}
		}
		else if (this.updateType == 'repeat' || this.updateType == 'return' || this.updateType == 'round') {
			if (this.BookingForm.get('service_type').value == 'charter_tour') {
				this.BookingForm.patchValue({
					cancellation_hours: selectedVehicle?.charter_cancellation_hours.toString()
				})
			}
			else {
				this.BookingForm.patchValue({
					cancellation_hours: selectedVehicle?.non_charter_cancellation_hours.toString()
				})
			}
		}
		this.buildBookingData()
	}

	handleReturnSelectVehicleType(selectedVehicle: any) {
		this.return_selectedVehicle = selectedVehicle
		console.log('selectweed vehicle-->>>>', selectedVehicle, selectedVehicle.licensePlate === null)
		this.SetFormValue('return_vehicle_id', selectedVehicle.ID);
		this.SetFormValue('return_vehicle_type_name', selectedVehicle.vehicleType)
		const isReturnEditMode = ['edit', 'repeat', 'return', 'round'].includes(this.updateType);
		const isOriginalReturnVehicle = isReturnEditMode && selectedVehicle.ID == this.bookingResponse?.return_vehicle_id;
		console.log('[handleReturnSelectVehicleType] updateType:', this.updateType, '| isOriginalReturnVehicle:', isOriginalReturnVehicle, '| bookingResponse?.return_vehicle_id:', this.bookingResponse?.return_vehicle_id, '| selectedVehicle.ID:', selectedVehicle.ID, '| bookingResponse?.return_driver_id:', this.bookingResponse?.return_driver_id, '| selectedVehicle.associated_driver:', selectedVehicle.associated_driver);
		const returnDriverValue = (isOriginalReturnVehicle && this.bookingResponse?.return_driver_id)
			? this.bookingResponse.return_driver_id
			: selectedVehicle.associated_driver;
		console.log('[handleReturnSelectVehicleType] resolved returnDriverValue:', returnDriverValue);
		this.SetFormValue('return_driver_id', returnDriverValue);
		this.SetFormValue('return_driver', returnDriverValue);
		this.SetFormValue('return_vehicle_make', selectedVehicle.make_id);
		this.SetFormValue('return_vehicle_make_name', selectedVehicle.make);
		this.SetFormValue('return_vehicle_model', selectedVehicle.model_id);
		this.SetFormValue('return_vehicle_model_name', selectedVehicle.model);
		this.SetFormValue('return_vehicle_year', selectedVehicle.year_id);
		this.SetFormValue('return_vehicle_year_name', selectedVehicle.year);
		this.SetFormValue('return_vehicle_color', selectedVehicle.color_id);
		this.SetFormValue('return_vehicle_color_name', selectedVehicle.color);
		selectedVehicle.licensePlate === null ? this.BookingForm.get('return_vehicle_license_plate').setValue('') : this.SetFormValue('return_vehicle_license_plate', selectedVehicle.licensePlate)
		this.SetFormValue('return_vehicle_seats', selectedVehicle.seats)
		//set cancellation period
		if (!this.booking_id) {
			if (this.BookingForm.get('service_type').value == 'charter_tour') {
				this.BookingForm.patchValue({
					return_cancellation_hours: selectedVehicle?.charter_cancellation_hours.toString()
				})
			}
			else {
				this.BookingForm.patchValue({
					return_cancellation_hours: selectedVehicle?.non_charter_cancellation_hours.toString()
				})
			}
		}
		else if (this.updateType == 'repeat' || this.updateType == 'return' || this.updateType == 'round') {
			if (this.BookingForm.get('service_type').value == 'charter_tour') {
				this.BookingForm.patchValue({
					return_cancellation_hours: selectedVehicle?.charter_cancellation_hours.toString()
				})
			}
			else {
				this.BookingForm.patchValue({
					return_cancellation_hours: selectedVehicle?.non_charter_cancellation_hours.toString()
				})
			}
		}
		this.buildBookingData()
	}

	private prefillVehiclePreferencesFromMasterVehicle(selectedVehicle: any, isReturn: boolean = false) {
		if (!selectedVehicle) {
			return;
		}

		const prefix = isReturn ? 'return_' : '';
		const setVehicleValue = (controlName: string, value: any) => {
			if (value === undefined || value === null || value === '') {
				return;
			}
			this.BookingForm.get(`${prefix}${controlName}`)?.setValue(value, { emitEvent: false });
		};

		setVehicleValue('vehicle_id', selectedVehicle?.ID || selectedVehicle?.id);
		setVehicleValue('vehicle_type', selectedVehicle?.vehicleType_id);
		setVehicleValue('vehicle_type_name', selectedVehicle?.vehicleType);
		setVehicleValue('vehicle_make', selectedVehicle?.make_id);
		setVehicleValue('vehicle_make_name', selectedVehicle?.make);
		setVehicleValue('vehicle_model', selectedVehicle?.model_id);
		setVehicleValue('vehicle_model_name', selectedVehicle?.model);
		setVehicleValue('vehicle_year', selectedVehicle?.year_id);
		setVehicleValue('vehicle_year_name', selectedVehicle?.year);
		setVehicleValue('vehicle_color', selectedVehicle?.color_id);
		setVehicleValue('vehicle_color_name', selectedVehicle?.color);
		setVehicleValue('vehicle_license_plate', selectedVehicle?.licensePlate);
		setVehicleValue('vehicle_seats', selectedVehicle?.seats);
	}

	private resolveBigDataOptionId(items: any[] = [], candidates: any[] = []): any {
		const normalizedCandidates = candidates
			.map((candidate) => (candidate ?? '').toString().trim().toLowerCase())
			.filter((candidate) => !!candidate);

		if (!normalizedCandidates.length || !Array.isArray(items) || !items.length) {
			return null;
		}

		const matchedItem = items.find((item) => {
			const itemName = (item?.name ?? item?.formatted_name ?? '').toString().trim().toLowerCase();
			return normalizedCandidates.includes(itemName);
		});

		return matchedItem?.id ?? matchedItem?.vehicleType_id ?? matchedItem?.make_id ?? matchedItem?.model_id ?? matchedItem?.year_id ?? matchedItem?.color_id ?? null;
	}

	private normalizeMasterVehicleForPrefill(selectedVehicle: any): any {
		if (!selectedVehicle) {
			return null;
		}

		const vehicleDetails = selectedVehicle?.vehicle_details || {};
		const vehicleTypeName = selectedVehicle?.vehicleType ?? selectedVehicle?.vehicleTypeName ?? selectedVehicle?.name ?? vehicleDetails?.type ?? '';
		const vehicleMakeName = selectedVehicle?.make ?? selectedVehicle?.vehicleMake ?? vehicleDetails?.make ?? '';
		const vehicleModelName = selectedVehicle?.model ?? selectedVehicle?.vehicleModel ?? vehicleDetails?.model ?? '';
		const vehicleYearName = selectedVehicle?.year ?? selectedVehicle?.vehicleYear ?? vehicleDetails?.year ?? '';
		const vehicleColorName = selectedVehicle?.color ?? selectedVehicle?.vehicleColor ?? vehicleDetails?.color ?? '';

		return {
			id: selectedVehicle?.ID ?? selectedVehicle?.id ?? selectedVehicle?.vehicle_id ?? null,
			vehicleType_id: selectedVehicle?.vehicleType_id ?? selectedVehicle?.vehicle_type ?? this.resolveBigDataOptionId(this.BigData?.vehicleCategories, [vehicleTypeName]),
			vehicleType: vehicleTypeName,
			make_id: selectedVehicle?.make_id ?? selectedVehicle?.vehicle_make ?? this.resolveBigDataOptionId(this.BigData?.vehicleMakes, [vehicleMakeName]),
			make: vehicleMakeName,
			model_id: selectedVehicle?.model_id ?? selectedVehicle?.vehicle_model ?? this.resolveBigDataOptionId(this.BigData?.vehicleModels, [vehicleModelName]),
			model: vehicleModelName,
			year_id: selectedVehicle?.year_id ?? selectedVehicle?.vehicle_year ?? this.resolveBigDataOptionId(this.BigData?.vehicleYears, [vehicleYearName]),
			year: vehicleYearName,
			color_id: selectedVehicle?.color_id ?? selectedVehicle?.vehicle_color ?? this.resolveBigDataOptionId(this.BigData?.vehicleColors, [vehicleColorName]),
			color: vehicleColorName,
			licensePlate: selectedVehicle?.licensePlate ?? selectedVehicle?.vehicle_license_plate ?? vehicleDetails?.licensePlate ?? vehicleDetails?.license_plate ?? '',
			seats: selectedVehicle?.seats ?? vehicleDetails?.seats ?? selectedVehicle?.passenger ?? vehicleDetails?.passenger ?? '',
			number_of_vehicles: selectedVehicle?.number_of_vehicles,
			cancellation_policy: selectedVehicle?.cancellation_policy,
			non_charter_cancellation_hours: selectedVehicle?.non_charter_cancellation_hours,
			charter_cancellation_hours: selectedVehicle?.charter_cancellation_hours
		};
	}

	private loadMasterVehicleInfoForQuoteBot(vehicleId: number, isReturn: boolean = false): void {
		if (!vehicleId) {
			return;
		}

		this.$api.getMasterVehicleInfo(vehicleId).subscribe({
			next: (response: any) => {
				const normalizedVehicle = this.normalizeMasterVehicleForPrefill(response?.data);
				this.prefillVehiclePreferencesFromMasterVehicle(normalizedVehicle, isReturn);
			},
			error: (error: any) => {
				console.error('Failed to fetch master vehicle info for QB admin prefill', error);
			}
		});
	}

	fetchAffiliateVehicles(affiliate_id: any) {
		if (!affiliate_id) {
			console.error('Invalid Paramater affiliate_data', affiliate_id)
			return
		}
		this.$spinner.show()
		this.$api.adminAffiliateVehicleList(affiliate_id, false).then((response: any) => {
			console.log('get affiliate vehicle data----->>>>>>>>>', response.data)
			if (response.success && response.data.vehicleList.length > 0) {
				this.VehicleList = response.data.vehicleList
				// add a key with formatted name to every value
				this.VehicleList.map((item: any) => item['formatted_name'] = `${item.vehicleType} - ${item.make} (${item.model})`);
				// autofill data if isRatesCompleted:true
				this.vehicleType_arr = this.VehicleList = this.vehicleMake_arr = this.VehicleList = this.vehicleModal_arr = this.VehicleList = this.vehicleYear_arr = this.VehicleList = this.vehicleColor_arr = this.VehicleList
				for (let i = 0; i < this.VehicleList.length; i++) {
					if (this.VehicleList[i].isRatesCompleted) {
						// let vehicle_type_id = this.BigData['vehicleCategories'].find(item => item.name == this.VehicleList[i].vehicleType)['id']
						if (affiliate_id == this.firstLoadAffiliateId) {
							if (this.VehicleList[i].ID == this.firstLoadVehicleId) {
								console.log('selected vehicle on first load---------------------------------->>>>>', this.VehicleList[i])
								this.SetFormValue('vehicle_id', this.VehicleList[i].ID);
								this.SetFormValue('vehicle_type', this.VehicleList[i].vehicleType_id)
								this.SetFormValue('vehicle_type_name', this.VehicleList[i].vehicleType)
								this.unique_key = this.VehicleList[i].unique_key
								this.handleSelectVehicleType(this.VehicleList[i])
								// this.autofillData('vehicle', this.VehicleList[i]);
								break;
							}
						}
						else {
							console.log('new affiliate seleted')
							this.SetFormValue('vehicle_id', this.VehicleList[i].ID);
							this.SetFormValue('vehicle_type', this.VehicleList[i].vehicleType_id)
							this.SetFormValue('vehicle_type_name', this.VehicleList[i].vehicleType)
							this.unique_key = this.VehicleList[i].unique_key
							this.handleSelectVehicleType(this.VehicleList[i])
							// this.autofillData('vehicle', this.VehicleList[i]);
							break;
						}

					}
				}
				// if (this.VehicleList.length == 1) {
				// 	let vehicle_type_id = this.BigData['vehicleCategories'].find(item => item.name == this.VehicleList[0].vehicleType)['id']
				// 	this.SetFormValue('vehicle_type', vehicle_type_id)
				// 	this.SetFormValue('vehicle_id', this.VehicleList[0].ID);
				// 	this.autofillData('vehicle', this.VehicleList[0]);
				// }
				// else if(this.VehicleList.length){
				// 	// need to re-code this condition #just a patch
				// 	let vehicle_type_id = this.BigData['vehicleCategories'].find(item => item.name == this.VehicleList[0].vehicleType)['id']
				// 	this.SetFormValue('vehicle_type', vehicle_type_id)
				// 	this.SetFormValue('vehicle_id', this.VehicleList[0].ID);
				// 	this.autofillData('vehicle', this.VehicleList[0]);
				// }
			}
			this.$spinner.hide()
		})
	}

	fetchLooseAffiliateVehicles(affiliate_id: any) {
		if (!affiliate_id) {
			console.error('Invalid Paramater affiliate_data', affiliate_id)
			return
		}
		this.$spinner.show()
		this.$api.adminLooseAffVehList(affiliate_id, false).then((response: any) => {
			console.log('get affiliate vehicle data----->>>>>>>>>', response.data)
			if (response.success && response.data.vehicleList.length > 0) {
				this.VehicleList = response.data.vehicleList
				// add a key with formatted name to every value
				this.VehicleList.map((item: any) => item['formatted_name'] = `${item.vehicleType} - ${item.make} (${item.model})`);
				// autofill data if isRatesCompleted:true
				this.vehicleType_arr = this.VehicleList = this.vehicleMake_arr = this.VehicleList = this.vehicleModal_arr = this.VehicleList = this.vehicleYear_arr = this.VehicleList = this.vehicleColor_arr = this.VehicleList
				for (let i = 0; i < this.VehicleList.length; i++) {
					if (this.VehicleList[i].isRatesCompleted) {
						// let vehicle_type_id = this.BigData['vehicleCategories'].find(item => item.name == this.VehicleList[i].vehicleType)['id']
						if (affiliate_id == this.firstLoadAffiliateId) {
							if (this.VehicleList[i].ID == this.firstLoadVehicleId) {
								console.log('selected vehicle on first load---------------------------------->>>>>', this.VehicleList[i])
								this.SetFormValue('vehicle_id', this.VehicleList[i].ID);
								this.SetFormValue('vehicle_type', this.VehicleList[i].vehicleType_id)
								this.SetFormValue('vehicle_type_name', this.VehicleList[i].vehicleType)
								this.unique_key = this.VehicleList[i].unique_key
								this.handleSelectVehicleType(this.VehicleList[i])
								// this.autofillData('vehicle', this.VehicleList[i]);
								break;
							}
						}
						else {
							console.log('new affiliate seleted')
							this.SetFormValue('vehicle_id', this.VehicleList[i].ID);
							this.SetFormValue('vehicle_type', this.VehicleList[i].vehicleType_id)
							this.SetFormValue('vehicle_type_name', this.VehicleList[i].vehicleType)
							this.unique_key = this.VehicleList[i].unique_key
							this.handleSelectVehicleType(this.VehicleList[i])
							// this.autofillData('vehicle', this.VehicleList[i]);
							break;
						}

					}
				}
				// if (this.VehicleList.length == 1) {
				// 	let vehicle_type_id = this.BigData['vehicleCategories'].find(item => item.name == this.VehicleList[0].vehicleType)['id']
				// 	this.SetFormValue('vehicle_type', vehicle_type_id)
				// 	this.SetFormValue('vehicle_id', this.VehicleList[0].ID);
				// 	this.autofillData('vehicle', this.VehicleList[0]);
				// }
				// else if(this.VehicleList.length){
				// 	// need to re-code this condition #just a patch
				// 	let vehicle_type_id = this.BigData['vehicleCategories'].find(item => item.name == this.VehicleList[0].vehicleType)['id']
				// 	this.SetFormValue('vehicle_type', vehicle_type_id)
				// 	this.SetFormValue('vehicle_id', this.VehicleList[0].ID);
				// 	this.autofillData('vehicle', this.VehicleList[0]);
				// }
			}
			this.$spinner.hide()
		})
	}

	fetchReturnAffiliateVehicles(return_affiliate_id: any) {
		if (!return_affiliate_id) {
			console.error('Invalid Paramater affiliate_data', return_affiliate_id)
			return
		}
		this.$spinner.show()
		this.$api.adminAffiliateVehicleList(return_affiliate_id, false).then((response: any) => {
			console.log('get affiliate vehicle data----->>>>>>>>>', response.data)
			if (response.success && response.data.vehicleList.length > 0) {
				this.return_VehicleList = response.data.vehicleList
				// add a key with formatted name to every value
				this.return_VehicleList.map((item: any) => item['formatted_name'] = `${item.vehicleType} - ${item.make} (${item.model})`);
				// autofill data if isRatesCompleted:true
				this.return_vehicleType_arr = this.return_VehicleList = this.return_vehicleMake_arr = this.return_VehicleList = this.return_vehicleModal_arr = this.return_VehicleList = this.return_vehicleYear_arr = this.return_VehicleList = this.return_vehicleColor_arr = this.return_VehicleList
				for (let i = 0; i < this.return_VehicleList.length; i++) {
					if (this.return_VehicleList[i].isRatesCompleted) {
						// let vehicle_type_id = this.BigData['vehicleCategories'].find(item => item.name == this.return_VehicleList[i].vehicleType)['id']
						if (return_affiliate_id == this.firstLoadAffiliateId) {
							if (this.return_VehicleList[i].ID == this.firstLoadVehicleId) {
								console.log('selected vehicle on first load---------------------------------->>>>>', this.return_VehicleList[i])
								this.SetFormValue('return_vehicle_id', this.return_VehicleList[i].ID);
								this.SetFormValue('return_vehicle_type', this.return_VehicleList[i].vehicleType_id)
								this.SetFormValue('return_vehicle_type_name', this.return_VehicleList[i].vehicleType)
								this.return_unique_key = this.return_VehicleList[i].return_unique_key
								this.handleReturnSelectVehicleType(this.return_VehicleList[i])
								// this.autofillData('vehicle', this.return_VehicleList[i]);
								break;
							}
						}
						else {
							console.log('new affiliate seleted')
							this.SetFormValue('return_vehicle_id', this.return_VehicleList[i].ID);
							this.SetFormValue('return_vehicle_type', this.return_VehicleList[i].vehicleType_id)
							this.SetFormValue('return_vehicle_type_name', this.return_VehicleList[i].vehicleType)
							this.return_unique_key = this.return_VehicleList[i].return_unique_key
							this.handleReturnSelectVehicleType(this.return_VehicleList[i])
							// this.autofillData('vehicle', this.VehicleList[i]);
							break;
						}

					}
				}
				// if (this.VehicleList.length == 1) {
				// 	let vehicle_type_id = this.BigData['vehicleCategories'].find(item => item.name == this.VehicleList[0].vehicleType)['id']
				// 	this.SetFormValue('vehicle_type', vehicle_type_id)
				// 	this.SetFormValue('vehicle_id', this.VehicleList[0].ID);
				// 	this.autofillData('vehicle', this.VehicleList[0]);
				// }
				// else if(this.VehicleList.length){
				// 	// need to re-code this condition #just a patch
				// 	let vehicle_type_id = this.BigData['vehicleCategories'].find(item => item.name == this.VehicleList[0].vehicleType)['id']
				// 	this.SetFormValue('vehicle_type', vehicle_type_id)
				// 	this.SetFormValue('vehicle_id', this.VehicleList[0].ID);
				// 	this.autofillData('vehicle', this.VehicleList[0]);
				// }
			}
			this.$spinner.hide()
		})
	}

	fetchReturnLooseAffiliateVehicles(return_affiliate_id: any) {
		if (!return_affiliate_id) {
			console.error('Invalid Paramater affiliate_data', return_affiliate_id)
			return
		}
		this.$spinner.show()
		this.$api.adminLooseAffVehList(return_affiliate_id, false).then((response: any) => {
			console.log('get affiliate vehicle data----->>>>>>>>>', response.data)
			if (response.success && response.data.vehicleList.length > 0) {
				this.return_VehicleList = response.data.vehicleList
				// add a key with formatted name to every value
				this.return_VehicleList.map((item: any) => item['formatted_name'] = `${item.vehicleType} - ${item.make} (${item.model})`);
				// autofill data if isRatesCompleted:true
				this.return_vehicleType_arr = this.return_VehicleList = this.return_vehicleMake_arr = this.return_VehicleList = this.return_vehicleModal_arr = this.return_VehicleList = this.return_vehicleYear_arr = this.return_VehicleList = this.return_vehicleColor_arr = this.return_VehicleList
				for (let i = 0; i < this.return_VehicleList.length; i++) {
					if (this.return_VehicleList[i].isRatesCompleted) {
						// let vehicle_type_id = this.BigData['vehicleCategories'].find(item => item.name == this.return_VehicleList[i].vehicleType)['id']
						if (return_affiliate_id == this.firstLoadAffiliateId) {
							if (this.return_VehicleList[i].ID == this.firstLoadVehicleId) {
								console.log('selected vehicle on first load---------------------------------->>>>>', this.return_VehicleList[i])
								this.SetFormValue('return_vehicle_id', this.return_VehicleList[i].ID);
								this.SetFormValue('return_vehicle_type', this.return_VehicleList[i].vehicleType_id)
								this.SetFormValue('return_vehicle_type_name', this.return_VehicleList[i].vehicleType)
								this.return_unique_key = this.return_VehicleList[i].return_unique_key
								this.handleReturnSelectVehicleType(this.return_VehicleList[i])
								// this.autofillData('vehicle', this.return_VehicleList[i]);
								break;
							}
						}
						else {
							console.log('new affiliate seleted')
							this.SetFormValue('return_vehicle_id', this.return_VehicleList[i].ID);
							this.SetFormValue('return_vehicle_type', this.return_VehicleList[i].vehicleType_id)
							this.SetFormValue('return_vehicle_type_name', this.return_VehicleList[i].vehicleType)
							this.return_unique_key = this.return_VehicleList[i].return_unique_key
							this.handleReturnSelectVehicleType(this.return_VehicleList[i])
							// this.autofillData('vehicle', this.VehicleList[i]);
							break;
						}

					}
				}
				// if (this.VehicleList.length == 1) {
				// 	let vehicle_type_id = this.BigData['vehicleCategories'].find(item => item.name == this.VehicleList[0].vehicleType)['id']
				// 	this.SetFormValue('vehicle_type', vehicle_type_id)
				// 	this.SetFormValue('vehicle_id', this.VehicleList[0].ID);
				// 	this.autofillData('vehicle', this.VehicleList[0]);
				// }
				// else if(this.VehicleList.length){
				// 	// need to re-code this condition #just a patch
				// 	let vehicle_type_id = this.BigData['vehicleCategories'].find(item => item.name == this.VehicleList[0].vehicleType)['id']
				// 	this.SetFormValue('vehicle_type', vehicle_type_id)
				// 	this.SetFormValue('vehicle_id', this.VehicleList[0].ID);
				// 	this.autofillData('vehicle', this.VehicleList[0]);
				// }
			}
			this.$spinner.hide()
		})
	}

	fetchQBAffiliateVehicles(affiliate_id: number) {
		if (!affiliate_id) {
			console.error('Invalid Paramater affiliate_data', affiliate_id)
			return
		}
		this.$spinner.show()
		this.$api.adminAffiliateVehicleList(affiliate_id, false).then((response: any) => {
			console.log('get affiliate vehicle data----->>>>>>>>>', response.data)
			if (response.success && response.data.vehicleList.length > 0) {
				this.VehicleList = response.data.vehicleList
				// add a key with formatted name to every value
				this.VehicleList.map((item: any) => item['formatted_name'] = `${item.vehicleType} - ${item.make} (${item.model})`);

				// autofill data if isRatesCompleted:true
				this.vehicleType_arr = this.VehicleList = this.vehicleMake_arr = this.VehicleList = this.vehicleModal_arr = this.VehicleList = this.vehicleYear_arr = this.VehicleList = this.vehicleColor_arr = this.VehicleList
				for (let i = 0; i < this.VehicleList.length; i++) {
					if (this.VehicleList[i].isRatesCompleted) {
						if (this.QB_vehicle_id) {
							if (this.VehicleList[i].ID == this.QB_vehicle_id) {
								let vehicle_type_id = this.BigData['vehicleCategories'].find(item => item.name == this.VehicleList[i].vehicleType)['id']
								this.SetFormValue('vehicle_type', vehicle_type_id)
								// this.SetFormValue('vehicle_id', this.VehicleList[i].ID);
								// this.autofillData('vehicle', this.VehicleList[i]);
								this.handleSelectVehicleType(this.VehicleList[i])
								break;
							}
						}
					}
				}
			}
			this.$spinner.hide()
		})
	}
	fetchAffiliateDrivers(affiliate_id: number) {
		if (!affiliate_id) {
			console.error('Invalid Parameter affiliate_data', affiliate_id)
			return
		}

		this.$spinner.show()
		this.$api.driverList(affiliate_id).then((response: any) => {
			if (response.success && response.data?.data.length > 0) {
				setTimeout(() => {
					this.initphonefield()
				}, 200)
				this.DriverList = response.data.data
				console.log('driver list', this.DriverList)
				let isValueSet = false
				for (let i = 0; i < this.DriverList.length; i++) {
					if (this.bookingResponse?.driver_id && this.DriverList[i]?.id == this.bookingResponse?.driver_id) {
						this.SetFormValue('driver_id', this.DriverList[i]?.id)
						this.autofillData('driver', this.DriverList[i])
						isValueSet = true
						break;
					}
				}
				if (!isValueSet) {
					console.log('setting default driver')
					const sessionDriverId = JSON.parse(sessionStorage.getItem('selected_vehicle') || 'null')?.driverInformation?.id
					const matchedDriver = sessionDriverId ? this.DriverList.find(d => d.id == sessionDriverId) : null
					const fallbackDriver = matchedDriver || this.DriverList[0]
					this.autofillData('driver', fallbackDriver)
					setTimeout(() => { this.SetFormValue('driver_id', fallbackDriver.id) }, 0)
					console.log('setting default driver', fallbackDriver)
				}
			}
			
			this.$spinner.hide();
		})
	}

	fetchReturnAffiliateDrivers(return_affiliate_id: number) {
		if (!return_affiliate_id) {
			console.error('Invalid Paramater affiliate_data', return_affiliate_id)
			return
		}

		this.$spinner.show()
		this.$api.driverList(return_affiliate_id).then((response: any) => {
			if (response.success && response.data?.data.length > 0) {
				setTimeout(() => {
					this.initphonefield()
				}, 200)
				this.return_DriverList = response.data.data
				console.log('driver list', this.return_DriverList)
				let isValueSet = false
				for (let i = 0; i < this.return_DriverList.length; i++) {
					if (this.bookingResponse?.driver_id && this.return_DriverList[i]?.id == this.bookingResponse?.driver_id) {
						this.SetFormValue('return_driver_id', this.return_DriverList[i]?.id)
						this.autofillData('return_driver', this.return_DriverList[i])
						isValueSet = true
						break;
					}
				}
				if (!isValueSet) {
					const sessionDriverId = JSON.parse(sessionStorage.getItem('selected_vehicle') || 'null')?.driverInformation?.id
					const matchedDriver = sessionDriverId ? this.return_DriverList.find(d => d.id == sessionDriverId) : null
					const fallbackDriver = matchedDriver || this.return_DriverList[0]
					this.autofillData('return_driver', fallbackDriver)
					setTimeout(() => { this.SetFormValue('return_driver_id', fallbackDriver.id) }, 0)
				}

				// autofill data
				// if (this.DriverList.length == 1) {
				// 	this.SetFormValue('driver_id', this.DriverList[0].id)
				// 	this.autofillData('driver', this.DriverList[0])
				// }
			}
			this.$spinner.hide();
		})
	}

	chooseDriver(driver_data: any) {
		this.autofillData('driver', driver_data)
	}

	fetchVehiclesFromVehicleType(vehicleType_id: any) {
		// Todo: autofill data 
	}

	fetchModels(make_id: number) {
		this.BigData['vehicleModels'] = this.BigData['vehicleModels'].filter(item => item.make_id == make_id)
		return
	}

	searchValue(list_name: string, search_value: string, search_with: string, form_control?: string) {
		if (form_control) {
			this.BookingForm.get(form_control).reset()
			this.BookingForm.updateValueAndValidity()
		}
		if (!this.BigData) {
			return
		}
		if (list_name == 'vehicleModels') {
			this.BigData['vehicleModels'] = this.BigData_COPY['vehicleModels'].filter((item: any) => item.make_id == this.Form.vehicle_make.value)
		} else {
			this.BigData[list_name] = this.BigData_COPY[list_name]
		}
		if (search_value == '') {
			return
		}

		if (list_name === 'airportsData' || list_name === 'airlinesData') {
			// match with code
			this.BigData[list_name] = this.BigData[list_name].filter((item: any) => item['code'].toLowerCase().startsWith(search_value.toLowerCase()))
			// match with name 
			if (this.BigData[list_name].length == 0) {
				this.BigData[list_name] = this.BigData_COPY[list_name]
				this.BigData[list_name] = this.BigData[list_name].filter((item: any) => item['name'].toLowerCase().startsWith(search_value.toLowerCase()))
			}

			// match with country
			if (this.BigData[list_name].length == 0) {
				this.BigData[list_name] = this.BigData_COPY[list_name]
				this.BigData[list_name] = this.BigData[list_name].filter((item: any) => item['country'].toLowerCase().startsWith(search_value.toLowerCase()))
			}
			return	// for only airport/airlines data
		}

		// for other cases
		this.BigData[list_name] = this.BigData[list_name].filter((item: any) => item[search_with].toLowerCase().startsWith(search_value.toLowerCase()))
	}


	fillValue(list: Array<Record<string, any> | string> | null = null, form_control: string, return_key: string = null, sep?: string): string | number {
		// fail-safe
		if (!this.BigData) {
			return ''
		}

		if (list === null && return_key === null) {
			return this.BookingForm.get(form_control).value ?? ''
		}

		// fail-safes
		if (!list && !form_control && !return_key) {
			// console.trace('Invalid Parameters Passed. ')
			return ''
		}

		if (list && typeof list[0] === 'string') {
			return list.find((item: string) => item == this.Form[form_control].value)[return_key]
		}

		if (!this.BookingForm.get(form_control).value) {
			return null
		}

		let temp = list.find(item => item['id'] == this.BookingForm.get(form_control).value)
		if (return_key.includes('+') && temp) {
			let keys = return_key.split('+')
			let ret_str = ""
			for (let i = 0; i < keys.length; i++) {
				ret_str = ret_str + temp[keys[i].trim()] + sep
			}
			return ret_str.replace(/(\,)$/g, '').trim()
		}
		return temp ? temp[return_key] : ''

	}


	fetchStopValue(form_group_name: string, index: number) {
		try {
			return (<FormArray>this.BookingForm.get(form_group_name)).at(index).get('address').value
		}
		catch {
			return ''
		}
	}
	fetchSpecialInstruction(form_group_name: string, index: number) {
		try {
			return (<FormArray>this.BookingForm.get(form_group_name)).at(index).get('booking_instructions').value
		}
		catch {
			return ''
		}
	}

	autofillData(filling_for: string, data: any) {
		if (filling_for === 'passenger') {
			console.log('--->>>> filling passenger info', data)
			data.middle_name ?
				this.SetFormValue('passenger_name', `${data?.first_name} ${data?.middle_name} ${data?.last_name}`) : this.SetFormValue('passenger_name', `${data?.first_name} ${data?.last_name}`)
			this.SetFormValue('passenger_email', data.email)
			this.SetFormValue('passenger_cell', data.mobile)
			this.SetFormValue('passenger_cell_isd', data.mobileIsd)
			this.SetFormValue('passenger_cell_country', data.mobileCountry)
			this.SetFormValue('origin_airport_city', data?.origin_airport_city ? data?.origin_airport_city : data?.departing_airport_city)
			this.SetFormValue('pickup_flight', data.pickup_flight)
			this.SetFormValue('dropoff_flight', data.dropoff_flight)
			setTimeout(() => {
				if (this.PaxTelObject) {
					this.PaxTelObject.setCountry(data.mobileCountry);
				}
			}, 1000);
		}

		if (filling_for === 'cruise') {
			if (data?.cruise_port == null) {
				this.SetFormValue('cruise_port', data?.return_cruise_port);
			} else {
				this.SetFormValue('cruise_port', data?.cruise_port)
			}
			if (data?.cruise_name == null) {
				this.SetFormValue('cruise_name', data?.return_cruise_name)
			} else {
				this.SetFormValue('cruise_name', data?.cruise_name)
			}
			if (data?.cruise_time == null) {
				this.SetFormValue('cruise_time', data?.return_cruise_time)
			} else {
				this.SetFormValue('cruise_time', data?.cruise_time)
			}
		}

		// if (filling_for == 'vehicle') {
		// 	console.log('auto fill vehicle data is---->>>' , data)
		// 	this.SetFormValue('vehicle_license_plate', data.licensePlate)
		// 	this.SetFormValue('vehicle_seats', data.seats)

		// 	// fill values of make/model/year/color
		// 	let i = 0
		// 	let legend = ['make', 'model', 'year', 'color']
		// 	for (let item of ['vehicleMakes', 'vehicleModels', 'vehicleYears', 'vehicleColors']) {
		// 		let obj = this.BigData[item].find(j => j.name == data[legend[i]])
		// 		console.log('loop for -->>' , legend[i] , item , obj)
		// 		if(obj){
		// 			this.SetFormValue('vehicle_' + legend[i], obj?.id)
		// 			let name = obj['name']; // name
		// 			this.SetFormValue("vehicle_" + legend[i] + "_name", name);
		// 		}
		// 		i++;
		// 	}
		// }

		if (filling_for == 'driver') {
			console.log('autofill data driver info-->>>', data, this.DriverList)
			let info = data
			if (!isNaN(data)) {
				for (let i = 0; i < this.DriverList.length; i++) {
					if (this.DriverList[i].id == data) {
						info = { ...this.DriverList[i] }
					}
				}
			}
			const driverNameParts = [info?.FirstName, info?.MiddleName, info?.LastName].filter(Boolean);
			if (driverNameParts.length > 0) {
				this.SetFormValue('driver_name', driverNameParts.join(' '));
			}
			this.SetFormValue('driver_gender', info?.Gender)
			this.SetFormValue('driver_cell', info?.CellNumber)
			this.SetFormValue('driver_cell_isd', info?.CellIsd)
			this.SetFormValue('driver_cell_country', info?.CellNumberCountry)
			setTimeout(() => {
				this.driverCellTelInput.setCountry(info?.CellNumberCountry);
			}, 2000)
			this.SetFormValue('driver_email', info?.Email)
			this.SetFormValue('driver_phone_type', info?.PhoneType ?? '');
		}
		if (filling_for == 'return_driver') {
			console.log('autofill data driver info-->>>', data, this.return_DriverList)
			let info = data
			if (!isNaN(data)) {
				for (let i = 0; i < this.return_DriverList.length; i++) {
					if (this.return_DriverList[i].id == data) {
						info = { ...this.return_DriverList[i] }
					}
				}
			}
			const returnDriverNameParts = [info?.FirstName, info?.MiddleName, info?.LastName].filter(Boolean);
			if (returnDriverNameParts.length > 0) {
				this.SetFormValue('return_driver_name', returnDriverNameParts.join(' '));
			}
			this.SetFormValue('return_driver_gender', info?.Gender)
			this.SetFormValue('return_driver_cell', info?.CellNumber)
			this.SetFormValue('return_driver_cell_isd', info?.CellIsd)
			this.SetFormValue('return_driver_cell_country', info?.CellNumberCountry)
			setTimeout(() => {
				this.returnDriverCellTelInput.setCountry(info?.CellNumberCountry);
			}, 2000)
			this.SetFormValue('return_driver_email', info?.Email)
			this.SetFormValue('return_driver_phone_type', info?.PhoneType ?? '');
		}
	}



	addExtraStop(is_return: boolean = false) {
		// console.log('Adding Extra Stop ...')
		if (is_return) {
			let index = Object.keys(this.ReturnExtraStops).length + 1;
			(<FormArray>this.BookingForm.get('return_extra_stops')).push(new FormGroup({
				address: new FormControl(''),
				latitude: new FormControl(''),
				longitude: new FormControl(''),
				rate: new FormControl(''),
				booking_instructions: new FormControl('')
			}))
		}
		else {
			let index = Object.keys(this.ExtraStops).length + 1;
			(<FormArray>this.BookingForm.get('extra_stops')).push(new FormGroup({
				address: new FormControl(''),
				latitude: new FormControl(''),
				longitude: new FormControl(''),
				rate: new FormControl(''),
				booking_instructions: new FormControl('')
			}))
		}
	}

	deleteExtraStop(is_return: boolean, stop_index: number) {
		if (is_return) {
			(<FormArray>this.BookingForm.get('return_extra_stops')).removeAt(stop_index)
			this.MapController(true)
		}
		else {
			(<FormArray>this.BookingForm.get('extra_stops')).removeAt(stop_index)
			this.MapController()
		}
		this.buildBookingData()
	}

	private normalizeExtraStopsForPrefill(extraStops: any): Array<Record<string, any>> {
		let parsedStops = extraStops;
		if (typeof parsedStops === 'string') {
			try {
				parsedStops = JSON.parse(parsedStops);
			} catch (error) {
				console.error('Failed to parse extra stops for prefill', error);
				return [];
			}
		}

		if (!Array.isArray(parsedStops)) {
			return [];
		}

		return parsedStops
			.filter((item: any) => item && typeof item === 'object')
			.map((item: any) => {
				const address = String(
					item?.display_address
					|| item?.formatted_address
					|| item?.address
					|| ''
				).trim();

				return {
					...item,
					address,
					formatted_address: address,
					display_address: address,
					latitude: item?.latitude ?? item?.lat ?? item?.pickup_latitude ?? '',
					longitude: item?.longitude ?? item?.lng ?? item?.long ?? item?.pickup_longitude ?? ''
				};
			})
			.filter((item: Record<string, any>) =>
				!!item.address || (
					this.parseRouteCoordinate(item.latitude) !== null &&
					this.parseRouteCoordinate(item.longitude) !== null
				)
			);
	}

	private prefillExtraStops(extraStops: any, is_return: boolean = false): void {
		const normalizedStops = this.normalizeExtraStopsForPrefill(extraStops);
		const formArrayName = is_return ? 'return_extra_stops' : 'extra_stops';
		const formArray = this.BookingForm.get(formArrayName) as FormArray | null;

		if (!formArray) {
			return;
		}

		while (formArray.length > 0) {
			formArray.removeAt(formArray.length - 1);
		}

		normalizedStops.forEach((item: Record<string, any>, index: number) => {
			this.addExtraStop(is_return);
			this.fillExtraStop(is_return, index, item, {
				latitude: item.latitude,
				longitude: item.longitude
			});

			const stopGroup = formArray.at(index) as FormGroup | null;
			if (!stopGroup) {
				return;
			}

			const stopPatch: Record<string, any> = {};
			if (item.rate !== undefined && item.rate !== null && item.rate !== '') {
				stopPatch['rate'] = item.rate;
			}
			if (item.booking_instructions !== undefined && item.booking_instructions !== null) {
				stopPatch['booking_instructions'] = item.booking_instructions;
			}

			if (Object.keys(stopPatch).length > 0) {
				stopGroup.patchValue(stopPatch, { emitEvent: false });
			}
		});
	}



	fillExtraStop(is_return: boolean, index: number, address: any, location: any) {
		console.log(is_return, index, address, location);
		const displayAddress = address?.display_address ?? address?.formatted_address ?? address?.address ?? '';
		if (is_return) {
			if (address) {
				(<FormArray>this.BookingForm.get('return_extra_stops')).at(index).patchValue({
					address: displayAddress
				})
				let return_pickup_location = this.Form.return_pickup?.value
				if (this.Form.transfer_type.value.includes('_airport')) {
					return_pickup_location = this.Form.return_pickup_airport_name?.value
				}
				this.checkExtraStopInTown(return_pickup_location, address.formatted_address, 'return_extra_stops', index)
			}
			if (location) {
				(<FormArray>this.BookingForm.get('return_extra_stops')).at(index).patchValue({
					latitude: location.latitude,
					longitude: location.longitude
				})
			}
			this.BookingForm.updateValueAndValidity();
			this.MapController(true)
		}
		else {

			if (address) {
				(<FormArray>this.BookingForm.get('extra_stops')).at(index).patchValue({
					address: displayAddress,
				});
				let pickup_location = this.Form.pickup.value
				if (this.Form.transfer_type.value.includes('airport_')) {
					pickup_location = this.Form.pickup_airport_name.value
				}
				this.checkExtraStopInTown(pickup_location, address.formatted_address, 'extra_stops', index)
			}

			if (location) {
				(<FormArray>this.BookingForm.get('extra_stops')).at(index).patchValue({
					latitude: location.latitude,
					longitude: location.longitude,
				})
			}
			this.BookingForm.updateValueAndValidity();
			this.MapController()
		}
	}

	// recalculateExtraStopRates(){
	// 	this.extraStops_rate = 0
	// 	if (this.ExtraStops.length > 0) {
	// 		for (let i = 0; i < this.ExtraStops.length; i++) {
	// 			console.log('ExtraStops-->>' , i)
	// 			let stop = (<FormGroup>(<FormArray>this.BookingForm.get('extra_stops')).at(i))
	// 			let pickup_location = this.Form.pickup.value
	// 			if (this.Form.transfer_type.value.includes('airport_')) {
	// 				pickup_location = this.Form.pickup_airport.value
	// 			}
	// 			let extra_stop_location = stop.get('address').value 
	// 			this.checkExtraStopInTown(pickup_location,extra_stop_location)
	// 		}
	// 	}
	// }
	getTown(geocodeResult) {
		for (let i = 0; i < geocodeResult.length; i++) {
			const addressComponents = geocodeResult[i].address_components;
			for (let j = 0; j < addressComponents.length; j++) {
				const types = addressComponents[j].types;
				if (types.includes('locality')) {
					return addressComponents[j].long_name;
				}
			}
		}
		return null;
	}
	checkExtraStopInTown(location1: string, location2: string, formKey: string, index: any) {
		console.log('in function check extra stop in town', location1, location2)
		const geocoder = new google.maps.Geocoder();
		geocoder.geocode({ address: location1 }, (results1, status1) => {
			if (status1 === 'OK' && results1.length > 0) {
				const town1 = this.getTown(results1);
				geocoder.geocode({ address: location2 }, async (results2, status2) => {
					if (status2 === 'OK' && results2.length > 0) {
						const town2 = this.getTown(results2);

						if (town1 === town2) {
							console.log('Both locations are in the same town/city.', this.extraStops_rate);
							await (<FormArray>this.BookingForm.get([formKey])).at(index).patchValue({
								rate: 'in_town'
							});
						} else {
							console.log('Locations are in different towns/cities.', this.extraStops_rate);
							(<FormArray>this.BookingForm.get([formKey])).at(index).patchValue({
								rate: 'out_town'
							});
						}
						setTimeout(() => {
							this.buildBookingData()
						}, 300)
					} else {
						console.error('Geocoding for Location 2 failed:', status2);
					}
				});
			} else {
				console.error('Geocoding for Location 1 failed:', status1);
			}
		});
	}




	fillExtraStopInstruction(is_return: boolean, index: number, event: any) {
		console.log(is_return, index, event.target.value);
		if (is_return) {
			(<FormArray>this.BookingForm.get('return_extra_stops')).at(index).patchValue({
				booking_instructions: event.target.value
			})
		}
		else {
			(<FormArray>this.BookingForm.get('extra_stops')).at(index).patchValue({
				booking_instructions: event.target.value
			});
		}
	}

	select(is_checked: boolean, form_control: string, value: any) {
		let amenity_name: string = ''
		amenity_name = this.BigData?.amenity.find(item => item.id == value)['name']

		if (is_checked) {
			if (!this.BookingForm.get(form_control).value.includes(value)) {
				this.amenities.push(amenity_name);
				(<FormArray>this.BookingForm.get(form_control)).push(new FormControl(value));
			}
		} else {
			// remove from list
			let list_index = this.BookingForm.get(form_control).value.findIndex((item: number) => item == value);
			this.amenities = this.amenities.filter((item: any) => item != amenity_name);
			(<FormArray>this.BookingForm.get(form_control)).removeAt(list_index)
		}
	}


	navigateToDailyBooking() {
		this.$router.navigate(['/admin/daily-bookings-admin'])
	}


	isChecked(form_control: string, object: any) {
		let list = (<FormArray>this.BookingForm.get(form_control)).value
		return list.includes(object)
	}

	getTopOffset(controlEl: HTMLElement): number {
		// console.log(controlEl.getBoundingClientRect());
		const labelOffset = 90;
		return controlEl.getBoundingClientRect().top + window.scrollY - labelOffset;
	}
	createReservationShareArray() {
		const multiplyHours = this.number_of_hours >= 24 ? this.number_of_hours/24 : this.number_of_hours; 
		console.log('in function createReservationShareArray')
		if (this.RatesForm) {
			let base_rate = 0
			if (this.BookingForm.value?.service_type == 'charter_tour' && !this.RatesForm?.min_rate_involved) {
				base_rate += this.RatesForm.all_inclusive_rates["Base_Rate"].baserate * multiplyHours;
			}
			else {
				base_rate += this.RatesForm.all_inclusive_rates["Base_Rate"].baserate
			}
			['ELH_Charges', 'Stops', 'Wait'].map((key) => {
				base_rate += this.RatesForm.all_inclusive_rates[key].baserate
			});
			for (const key of Object.keys(this.RatesForm.amenities)) {
				base_rate += this.RatesForm.amenities[key].baserate;
			}
			if (this.BookingForm.value.number_of_vehicles != 0) {
				base_rate *= this.BookingForm.value.number_of_vehicles
			}
			console.log("extra gratutiy", this.RatesForm?.misc?.Extra_Gratuity?.amount, "min rate", this.RatesForm?.min_rate_involved)
			let grandTotal = this.RatesForm.grand_total
			let stripeFee = grandTotal * 0.05 + 0.30
			let adminShare = (base_rate * this.adminSharePercent) / 100
			adminShare = adminShare + (this.RatesForm?.misc?.Extra_Gratuity?.amount * 0.25)
			let deducted_admin_share = adminShare - stripeFee
			let shareArray = {
				baseRate: base_rate,
				grandTotal: grandTotal,
				stripeFee: stripeFee,
				adminShare: adminShare,
				deducted_admin_share: deducted_admin_share,  // Admin will get this amount only
				affiliateShare: grandTotal - base_rate * 0.25
			}
			// travelAgentShare : 
			if (this.BookingForm.value?.account_type == 'travel_planner' && !this.isCreatedByAdmin) {
				this.adminSharePercent = 15
				shareArray['adminShare'] = (base_rate * this.adminSharePercent) / 100
				shareArray['deducted_admin_share'] = shareArray['adminShare'] - shareArray['stripeFee']
				shareArray['travelAgentShare'] = base_rate * 0.10
			}
			else if (this.isFarmoutBooking) {
				this.adminSharePercent = 15
				shareArray['adminShare'] = (base_rate * this.adminSharePercent) / 100
				shareArray['deducted_admin_share'] = shareArray['adminShare'] - shareArray['stripeFee']
				shareArray['farmoutShare'] = base_rate * 0.10
				shareArray['affiliateShare'] = grandTotal - base_rate * 0.25
			}
			else if (this.booking_created_from == 'subscriber') {
				this.adminSharePercent = 0
				shareArray['adminShare'] = (base_rate * this.adminSharePercent) / 100
				shareArray['deducted_admin_share'] = 0
				shareArray['affiliateShare'] = grandTotal - stripeFee
			}
			this.shareArray = shareArray
			// console.log('in function createReservationShareArray-->>>' , base_rate, shareArray )
			return shareArray;
			// value['rateArray'] = JSON.parse(JSON.stringify(this.RatesForm))
		}
	}
	createReservationReturnShareArray() {
		console.log('createReservationReturnShareArray', this.BookingForm.value.return_grand_total)
		if (this.Form.service_type.value == 'round_trip' && this.ReturnRatesForm) {

			let base_rate = 0
			for (const key of Object.keys(this.ReturnRatesForm.all_inclusive_rates)) {
				base_rate += this.ReturnRatesForm.all_inclusive_rates[key].baserate;
			}
			for (const key of Object.keys(this.ReturnRatesForm.amenities)) {
				base_rate += this.ReturnRatesForm.amenities[key].baserate;
			}
			if (this.BookingForm.value.number_of_vehicles != 0) {
				base_rate *= this.BookingForm.value.number_of_vehicles
			}
			let returnGrandTotal = this.BookingForm.value.return_grand_total
			let stripeFee = returnGrandTotal * 0.05 + 0.30
			let adminShare = (base_rate * this.adminSharePercent) / 100
			adminShare = adminShare + (this.ReturnRatesForm?.misc?.Extra_Gratuity?.amount * 0.25)
			let deducted_admin_share = adminShare - stripeFee
			let returnShareArray = {
				baseRate: base_rate,
				returnGrandTotal: returnGrandTotal,
				deducted_admin_share: deducted_admin_share,  // Admin will get this amount only
				grandTotal: returnGrandTotal,
				stripeFee: stripeFee,
				adminShare: adminShare,
				affiliateShare: returnGrandTotal - adminShare
			}
			// travelAgentShare : 
			if (this.BookingForm.value?.account_type == 'travel_planner' && !this.isCreatedByAdmin) {
				returnShareArray['adminShare'] = (base_rate * this.adminSharePercent) / 100
				returnShareArray['deducted_admin_share'] = returnShareArray['adminShare'] - returnShareArray['stripeFee']
				returnShareArray['travelAgentShare'] = base_rate * 0.10
			}
			else if (this.isFarmoutBooking) {
				this.adminSharePercent = 15
				returnShareArray['adminShare'] = (base_rate * this.adminSharePercent) / 100
				returnShareArray['deducted_admin_share'] = returnShareArray['adminShare'] - returnShareArray['stripeFee']
				returnShareArray['farmoutShare'] = base_rate * 0.10
			}
			else if (this.booking_created_from == 'subscriber') {
				this.adminSharePercent = 0
				returnShareArray['adminShare'] = (base_rate * this.adminSharePercent) / 100
				returnShareArray['deducted_admin_share'] = 0
				returnShareArray['affiliateShare'] = returnGrandTotal - stripeFee
			}

			this.r_shareArray = returnShareArray
			// console.log('in function createReservationreturnShareArray-->>>' , base_rate, returnShareArray )
			return returnShareArray;
			// value['returnRateArray'] = JSON.parse(JSON.stringify(this.ReturnRatesForm))
		}
	}

	handleCountryChangeLA(event: any) {
		const dialCode = '+' + event.dialCode;

		this.BookingForm.patchValue({
			lose_affiliate_phone_isd: dialCode,
			lose_affiliate_phone_country: event.iso2,
			driver_cell_isd: dialCode, // Update primary driver_cell ISD
			driver_cell_country: event.iso2
		});
		this.loseAffiliateTelInput.setCountry(event.iso2); // Update flag in lose_affiliate_phone
		this.driverCellTelInput.setCountry(event.iso2); // Update flag in primary driver_cell
	}

	handleReturnCountryChangeLA(event: any) {
		const dialCode = '+' + event.dialCode;

		this.BookingForm.patchValue({
			return_lose_affiliate_phone_isd: dialCode,
			return_lose_affiliate_phone_country: event.iso2,
			return_driver_cell_isd: dialCode, // Update return driver_cell ISD
			return_driver_cell_country: event.iso2
		});
		this.returnLoseAffiliateTelInput.setCountry(event.iso2); // Update flag in return_lose_affiliate_phone
		this.returnDriverCellTelInput.setCountry(event.iso2); // Update flag in return driver_cell
	}

	// checks value if there is + in country code or not and if not it adds up the +
	ensurePlusPrefix(value: any): string {
		if (!value) return '';
		const str = value.toString().trim();
		return str.startsWith('+') ? str : '+' + str;
	}

	private syncMissingReturnVehicleFromOutbound(): void {
		if (this.service_type !== 'round_trip' || this.Form.return_vehicle_type.value) {
			return;
		}

		const outboundVehicleType = this.Form.vehicle_type.value;
		if (!outboundVehicleType) {
			return;
		}

		console.log('admin/new-booking syncMissingReturnVehicleFromOutbound', {
			return_affiliate_type: this.Form.return_affiliate_type.value,
			outbound_vehicle_type: this.Form.vehicle_type.value,
			outbound_vehicle_id: this.Form.vehicle_id.value
		});

		[
			'return_vehicle_type',
			'return_vehicle_type_name',
			'return_vehicle_id',
			'return_vehicle_make',
			'return_vehicle_make_name',
			'return_vehicle_model',
			'return_vehicle_model_name',
			'return_vehicle_year',
			'return_vehicle_year_name',
			'return_vehicle_color',
			'return_vehicle_color_name',
			'return_vehicle_license_plate',
			'return_vehicle_seats',
			'return_cancellation_hours'
		].forEach((controlName) => {
			const outboundControl = controlName.replace(/^return_/, '');
			this.SetFormValue(controlName, this.BookingForm.get(outboundControl)?.value, false);
		});

		if (!this.Form.return_driver_name.value && this.Form.driver_name.value) {
			[
				'return_driver_id',
				'return_driver_name',
				'return_driver_gender',
				'return_driver_cell',
				'return_driver_cell_isd',
				'return_driver_cell_country',
				'return_driver_email',
				'return_driver_phone_type'
			].forEach((controlName) => {
				const outboundControl = controlName.replace(/^return_/, '');
				this.SetFormValue(controlName, this.BookingForm.get(outboundControl)?.value, false);
			});
		}

		this.BookingForm.get('return_vehicle_type')?.updateValueAndValidity({ emitEvent: false });
	}


	submitForm(preview: boolean) {
		this.submitBookingForm = true

		// Sync Pax Country Data
		if (this.PaxTelObject) {
			const countryData = this.PaxTelObject.getSelectedCountryData();
			if (countryData && countryData.dialCode) {
				this.BookingForm.patchValue({
					passenger_cell_isd: '+' + countryData.dialCode,
					passenger_cell_country: countryData.iso2
				});
			}
		}

		// Sync LC Country Data
		if (this.LCTelObject) {
			const countryData = this.LCTelObject.getSelectedCountryData();
			if (countryData && countryData.dialCode) {
				const lcGroup = this.BookingForm.get('loose_customer') as FormGroup;
				if (lcGroup) {
					lcGroup.patchValue({
						phone_isd: '+' + countryData.dialCode,
						phone_country: countryData.iso2
					});
				}
			}
		}

		// Sync Driver Cell
		if (this.driverCellTelInput) {
			const countryData = this.driverCellTelInput.getSelectedCountryData();
			if (countryData && countryData.dialCode) {
				this.BookingForm.patchValue({
					driver_cell_isd: '+' + countryData.dialCode,
					driver_cell_country: countryData.iso2
				});
			}
		}

		// Sync Return Driver Cell
		if (this.returnDriverCellTelInput) {
			const countryData = this.returnDriverCellTelInput.getSelectedCountryData();
			if (countryData && countryData.dialCode) {
				this.BookingForm.patchValue({
					return_driver_cell_isd: '+' + countryData.dialCode,
					return_driver_cell_country: countryData.iso2
				});
			}
		}

		// Sync Lose Affiliate Phone
		if (this.loseAffiliateTelInput) {
			const countryData = this.loseAffiliateTelInput.getSelectedCountryData();
			if (countryData && countryData.dialCode) {
				this.BookingForm.patchValue({
					lose_affiliate_phone_isd: '+' + countryData.dialCode,
					lose_affiliate_phone_country: countryData.iso2
				});
			}
		}

		// Sync Return Lose Affiliate Phone
		if (this.returnLoseAffiliateTelInput) {
			const countryData = this.returnLoseAffiliateTelInput.getSelectedCountryData();
			if (countryData && countryData.dialCode) {
				this.BookingForm.patchValue({
					return_lose_affiliate_phone_isd: '+' + countryData.dialCode,
					return_lose_affiliate_phone_country: countryData.iso2
				});
			}
		}

		// to ensure driver_cell_isd and lose_affiliate_cell_isd be saved with + in code because on edit it is not saving on set form value
		this.BookingForm.patchValue({
			driver_cell_isd: this.ensurePlusPrefix(this.BookingForm?.get('driver_cell_isd')?.value),
			lose_affiliate_phone_isd: this.ensurePlusPrefix(this.BookingForm?.get('lose_affiliate_phone_isd')?.value)
		});

		this.syncMissingReturnVehicleFromOutbound();

		// this.BookingForm['currency'] = this.currencyObj?.currency
		if (this.service_type == 'round_trip') {
			this.BookingForm.get('return_vehicle_type')?.setValidators([Validators.required]);
			this.BookingForm.get('return_vehicle_type')?.updateValueAndValidity()

			this.BookingForm.patchValue({
				return_driver_cell_isd: this.ensurePlusPrefix(this.BookingForm?.get('return_driver_cell_isd')?.value),
				return_lose_affiliate_phone_isd: this.ensurePlusPrefix(this.BookingForm?.get('return_lose_affiliate_phone_isd')?.value)
			});

		}
		else {
			this.BookingForm.get('return_vehicle_type')?.clearValidators()
			this.BookingForm.get('return_vehicle_type')?.updateValueAndValidity()
		}
		console.log(this.BookingForm);
		console.log(this.BookingForm.status);
		// let EditedKeys = []
		// Object.keys(this.bookingResponse)?.map(i=>{
		// 	let value = this.bookingResponse[`${i}`] === null ? '' :this.bookingResponse[`${i}`]
		// 	let value1 = this.BookingForm.value[`${i}`] === undefined ? '' :this.BookingForm.value[`${i}`]
		// 	console.log('value',i,'--->>>',value1,'--->>>' , value )
		// 	if(value1 != value && this.BookingForm.value[`${i}`] !== undefined){
		// 		EditedKeys.push(i)
		// 	} 
		// })

		// console.log(' Edited keys  ---->>>>' , EditedKeys)



		// Sanitize return_driver_cell
		const rDrCell = this.BookingForm.get('return_driver_cell');
		const rDrIsd = this.BookingForm.get('return_driver_cell_isd');
		if (rDrCell && rDrCell.value && rDrIsd && rDrIsd.value) {
			const val = String(rDrCell.value);
			const isd = String(rDrIsd.value);
			if (val.startsWith(isd)) {
				rDrCell.setValue(val.substring(isd.length));
			}
		}

		// Sanitize lose_affiliate_phone
		const laPhone = this.BookingForm.get('lose_affiliate_phone');
		const laIsd = this.BookingForm.get('lose_affiliate_phone_isd');
		if (laPhone && laPhone.value && laIsd && laIsd.value) {
			const val = String(laPhone.value);
			const isd = String(laIsd.value);
			if (val.startsWith(isd)) {
				laPhone.setValue(val.substring(isd.length));
			}
		}

		// Sanitize phone
		const phone = this.BookingForm.get('phone');
		const phoneIsd = this.BookingForm.get('phone_isd');
		if (phone && phone.value && phoneIsd && phoneIsd.value) {
			const val = String(phone.value);
			const isd = String(phoneIsd.value);
			if (val.startsWith(isd)) {
				phone.setValue(val.substring(isd.length));
			}
		}

		// Sanitize passenger_cell
		const pCell = this.BookingForm.get('passenger_cell');
		const pIsd = this.BookingForm.get('passenger_cell_isd');
		if (pCell && pCell.value && pIsd && pIsd.value) {
			const val = String(pCell.value);
			const isd = String(pIsd.value);
			if (val.startsWith(isd)) {
				pCell.setValue(val.substring(isd.length));
			}
		}

		// Sanitize return_lose_affiliate_phone
		const rLaPhone = this.BookingForm.get('return_lose_affiliate_phone');
		const rLaIsd = this.BookingForm.get('return_lose_affiliate_phone_isd');
		if (rLaPhone && rLaPhone.value && rLaIsd && rLaIsd.value) {
			const val = String(rLaPhone.value);
			const isd = String(rLaIsd.value);
			if (val.startsWith(isd)) {
				rLaPhone.setValue(val.substring(isd.length));
			}
		}

		// Sanitize driver_cell
		const dCell = this.BookingForm.get('driver_cell');
		const dIsd = this.BookingForm.get('driver_cell_isd');
		if (dCell && dCell.value && dIsd && dIsd.value) {
			const val = String(dCell.value);
			const isd = String(dIsd.value);
			if (val.startsWith(isd)) {
				dCell.setValue(val.substring(isd.length));
			}
		}

		// Sanitize loose_customer.phone
		if (this.BookingForm.get('loose_customer.phone') && this.BookingForm.get('loose_customer.phone').value && this.BookingForm.get('loose_customer.phone_isd') && this.BookingForm.get('loose_customer.phone_isd').value && this.BookingForm.get('loose_customer.phone').value.startsWith(this.BookingForm.get('loose_customer.phone_isd').value)) {
			this.BookingForm.get('loose_customer.phone').setValue(this.BookingForm.get('loose_customer.phone').value.substring(this.BookingForm.get('loose_customer.phone_isd').value.length));
		}
		if (this.BookingForm.invalid) {
			console.log("Form is invalid. Invalid controls:");
			Object.keys(this.BookingForm.controls).forEach(key => {
				const controlErrors = this.BookingForm.get(key).errors;
				if (controlErrors != null) {
					console.log('Key: ' + key + ', Errors: ', controlErrors);
				}
			});
			// Check nested loose_customer group
			const lcGroup = this.BookingForm.get('loose_customer') as FormGroup;
			if (lcGroup && lcGroup.invalid) {
				console.log("Loose Customer group is invalid:");
				Object.keys(lcGroup.controls).forEach(key => {
					const controlErrors = lcGroup.get(key).errors;
					if (controlErrors != null) {
						console.log('LC Key: ' + key + ', Errors: ', controlErrors);
					}
				});
				// Check nested card_details
				const cdGroup = lcGroup.get('card_details') as FormGroup;
				if (cdGroup && cdGroup.invalid) {
					console.log("Card Details group is invalid:");
					Object.keys(cdGroup.controls).forEach(key => {
						const controlErrors = cdGroup.get(key).errors;
						if (controlErrors != null) {
							console.log('CD Key: ' + key + ', Errors: ', controlErrors);
						}
					});
				}
			}
			return;
		}
		// Validate minimum number of hours for charter_tour
		const submitHours = Number(this.Form.number_of_hours.value);
		if (this.Form.service_type.value == 'charter_tour' && (isNaN(submitHours) || submitHours < 2)) {
			this.numberOfHoursError = true;
			if (this.hourFields && this.hourFields.length > 0) {
				const activeField = this.hourFields.find(field => field.nativeElement.offsetParent !== null);
				if (activeField) {
					activeField.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
				} else {
					this.hourFields.first.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
				}
			}
			return;
		}

		if (this.booking_created_from == 'subscriber') {
			this.BookingForm.patchValue({
				affiliate_id: this.currentUser?.account_id
			})
			if (this.service_type == 'round_trip') {
				this.BookingForm.patchValue({
					return_affiliate_id: this.currentUser?.account_id
				})
			}
		}

		let value = this.BookingForm.value
		value = this.normalizeAirportCoordinatesInPayload(value)
		console.log("in reservation type", this.isFarmoutBooking, this.booking_created_from == 'admin', this.currentUser?.created_by_role == 'subscriber')
		if (this.isFarmoutBooking && this.booking_created_from == 'admin' && this.currentUser?.created_by_role == 'subscriber') {
			console.log("in reservation type")
			value["reservation_type"] = 'farmout'
		}
		value["booking_created_from"] = this.booking_created_from
		value['proceed'] = this.proceed
		value['currency'] = this.currencyObj?.currency
		value['platform_type'] = 'web'
		if (this.RatesForm) {
			value['rateArray'] = JSON.parse(JSON.stringify(this.RatesForm))
			value['grand_total'] = value['rateArray']['grand_total']
			value['sub_total'] = value['rateArray']['sub_total']
			value['min_rate_involved'] = value['rateArray']['min_rate_involved']
			value['shares_array'] = this.createReservationShareArray()
			delete value['rateArray']['grand_total']
			delete value['rateArray']['sub_total']
			delete value['rateArray']['min_rate_involved']
			// Return Rates Form
			if (this.Form.service_type.value == 'round_trip' && this.ReturnRatesForm) {
				value['returnRateArray'] = JSON.parse(JSON.stringify(this.ReturnRatesForm))
				value['return_grand_total'] = value['returnRateArray']['r_grandtotal']
				value['return_sub_total'] = value['returnRateArray']['r_subtotal']
				delete value['returnRateArray']['r_grandtotal']
				delete value['returnRateArray']['r_subtotal']
				value['return_shares_array'] = this.createReservationReturnShareArray()
			}
		}

		if (preview) {
			if (this.RatesForm.all_inclusive_rates["Base_Rate"].baserate <= 0) {
				console.log("in if base rate less than 0")
				this.$errors.openDialog({
					errors: {
						error: 'Base rate can not be empty.'
					}
				})
			}
			else {
				this.$spinner.show()
				this.$api.createBooking(value, this.Form.updateType.value).subscribe((response: any) => {
					// this.$errors.openDialog({
					// 	errors: {
					// 		error: `<span class='text-success'>${response.message}</span>`
					// 	}
					// })
					if (response.data?.is_confirm == false) {
						this.confirmMsg = response?.message
						this.$spinner.hide()
						$('#confirmationModal').modal('show')
					}
					else {
						this.$router.navigate(['/admin/daily-bookings-admin'])
					}
				})
			}

		}
		else {
			$('#previewBooking').modal('handleUpdate').modal('show')
		}
	}

	resetFields() {
		this.chosen_user = null
		this.buildBookingForm()
		this.MapController()
		this.driver_image = {}
		this.vehicle_image = {}

		if (!this.booking_params['client_account_types'].includes('loose_customer')) {
			this.booking_params['client_account_types'].push('loose_customer')
		}

		// if directly navigated to create new booking mode from edit booking mode
		if (this.BigData_COPY) {
			this.BigData = this.BigData_COPY
		}
		this.reset_button = !this.reset_button
	}

	returnZero() {
		return 0	// for keeping the order
	}

	/**
	* upload image with the specified name and set form value with its id.
	* @param event input event
	* @param image_type String [Required] type of the image being uploaded
	* @param image_id [Optional] id of the image to be edited
	*/
	async uploadImage(event: any, image_type: string) {
		if (!await this.commonServices.handleFile(event)) {
			return;
		}
		let image: any
		console.log(event.target.files)
		if (event.target.files && event.target.files.length > 0) {
			const reader = new FileReader()
			const file = event.target.files[0]
			reader.readAsDataURL(file)
			reader.onload = () => {
				image = reader.result as string
				this.$spinner.show();
				this.$api.uploadVehicleImage(image).subscribe((response: any) => {
					this[image_type] = { image: response.data.image, id: response.data.ID }
					this.SetFormValue(image_type + '_id', this[image_type]['id'])
					this.$spinner.hide();
				})
			}
		}
	}


	/**
	* Delete the image from the form. Basically sets the form value, empty.
	* @param image_type String [Required] type of the image to delete
	*/
	deleteImage(image_type: string) {
		this[image_type] = {};
		this.SetFormValue(image_type + '_id', 0);
	}


	modal_image: any
	showImageModal(image: string) {
		this.modal_image = image
		$("#imageModal").addClass("showImage");
		$("#imageModal").removeClass("d-none");
	}

	close_image_modal: EventEmitter<any> = new EventEmitter()
	closeImageModal() {
		this.close_image_modal.emit()
	}


	fetchDistanceAndTime(route: any): Promise<{ [key: string]: number }> {
		let total_distance = 0.0
		let total_time = 0
		return new Promise((resolve) => {
			route.legs.forEach((item: any) => {
				console.log('cal distance--->> this.BookingForm.get', this.BookingForm.get('service_type').value)
				if (item.distance.value == 0 && this.BookingForm.get('service_type').value != 'charter_tour') {
					this.$errors.openDialog({
						errors: {
							error: 'Please select a valid location point.'
						}
					})
					return
				}
				else {
					total_distance += item.distance.value
					total_time += item.duration.value
				}
			})
			resolve({
				distance: total_distance,
				time: total_time
			})
		})
	}


	toggleDropdown(type: string) {
		// console.log('Toggle Dropdown ', type)
		this.booking_params['chevrons'][type] = !this.booking_params['chevrons'][type]
	}
	handleChangeVehicleType(event) {
		console.log('in function handle change vehicle type', event.unique_key)
		this.VehicleList.map(i => (i.unique_key == event.unique_key) ? this.handleSelectVehicleType(i) : '')
	}
	handleReturnChangeVehicleType(event) {
		console.log('in function handle change vehicle type', event.unique_key)
		this.return_VehicleList.map(i => (i.unique_key == event.unique_key) ? this.handleReturnSelectVehicleType(i) : '')
	}

	updateReturnLegValidators(value: string) {
		console.log("in updateReturnLegValidators", value)
		if (this.BookingForm?.get('service_type')?.value == 'round_trip') {
			// return pickup address mandatory
			if (!value.startsWith('airport_')) {
				this.BookingForm.get('return_pickup')?.setValidators([Validators.required]);
			} else {
				this.BookingForm.get('return_pickup')?.clearValidators();
			}
			this.BookingForm.get('return_pickup')?.updateValueAndValidity();

			// return dropoff address mandatory
			if (!value.endsWith('_airport')) {
				this.BookingForm.get('return_dropoff')?.setValidators([Validators.required]);
			} else {
				this.BookingForm.get('return_dropoff')?.clearValidators();
			}
			this.BookingForm.get('return_dropoff')?.updateValueAndValidity();

			if (value.includes("city_")) {
				this.SetFormValue('return_booking_instructions', '<ol><li>Driver - Text on location. Text the client a day before to confirm driver name , cell phone and booking details. Text client with ETA when en route</li></ol>');
			}

			// set cruise ship name and cruise port mandatory
			if (value.includes('_cruise') || value.includes('cruise_')) {
				if (value.includes("cruise_")) {
					this.SetFormValue('return_booking_instructions', '<ol><li>Pax - Text driver when docked.</li><li>Driver - Text the client a day before to confirm driver name , cell phone and booking details. Text client with ETA when en route. Text pax with pickup instructions when ship has arrived.</li></ol>');
				}
				this.BookingForm.get('return_cruise_name').setValidators([Validators.required]);
				this.BookingForm.get('return_cruise_port').setValidators([Validators.required]);
				this.BookingForm.get('return_cruise_name').updateValueAndValidity();
				this.BookingForm.get('return_cruise_port').updateValueAndValidity();
			} else {
				this.BookingForm.get('return_cruise_name').clearValidators();
				this.BookingForm.get('return_cruise_port').clearValidators();
				this.BookingForm.get('return_cruise_name').updateValueAndValidity();
				this.BookingForm.get('return_cruise_port').updateValueAndValidity();
			}

			// set flight number mandatory
			if (value.includes('_airport')) {
				this.BookingForm.get('return_dropoff_airline_option').setValidators([Validators.required]);
				this.BookingForm.get('return_dropoff_airline_option').updateValueAndValidity();
				this.BookingForm.get('return_dropoff_airport_option').setValidators([Validators.required]);
				this.BookingForm.get('return_dropoff_airport_option').updateValueAndValidity();
			} else {
				this.BookingForm.get('return_dropoff_airline_option').clearValidators();
				this.BookingForm.get('return_dropoff_airline_option').updateValueAndValidity();
				this.BookingForm.get('return_dropoff_airport_option').clearValidators();
				this.BookingForm.get('return_dropoff_airport_option').updateValueAndValidity();
			}

			if (value.includes('airport_')) {
				this.SetFormValue('return_booking_instructions', '<ol><li>Pax - Text driver when landing.</li><li>Driver - Text the client a day before to confirm driver name , cell phone and booking details. Text client with ETA when en route. Text pax with pickup instructions when plane has arrived.</li></ol>');
				this.BookingForm.get('return_pickup_flight').setValidators([Validators.required]);
				this.BookingForm.get('return_pickup_flight').updateValueAndValidity();
				this.BookingForm.get('return_pickup_airline_option').setValidators([Validators.required]);
				this.BookingForm.get('return_pickup_airline_option').updateValueAndValidity();
				this.BookingForm.get('return_pickup_airport_option').setValidators([Validators.required]);
				this.BookingForm.get('return_pickup_airport_option').updateValueAndValidity();
				this.BookingForm.get('departing_airport_city').setValidators([Validators.required]);
				this.BookingForm.get('departing_airport_city').updateValueAndValidity();
			} else {
				this.BookingForm.get('return_pickup_flight').clearValidators();
				this.BookingForm.get('return_pickup_flight').updateValueAndValidity();
				this.BookingForm.get('return_pickup_airline_option').clearValidators();
				this.BookingForm.get('return_pickup_airline_option').updateValueAndValidity();
				this.BookingForm.get('return_pickup_airport_option').clearValidators();
				this.BookingForm.get('return_pickup_airport_option').updateValueAndValidity();
				this.BookingForm.get('departing_airport_city').clearValidators();
				this.BookingForm.get('departing_airport_city').updateValueAndValidity();
			}
		} else {
			this.BookingForm?.get('return_pickup')?.clearValidators();
			this.BookingForm?.get('return_dropoff')?.clearValidators();
			this.BookingForm?.get('return_pickup')?.updateValueAndValidity();
			this.BookingForm?.get('return_dropoff')?.updateValueAndValidity();
		}
	}

	Subscriptions() {
		if (this.updateType == 'edit') {
			this.BookingForm?.get('pickup_time')?.valueChanges.subscribe((value: string) => {
				if (!this.isManualRateEntered()) {
					this.buildBookingData();
				}
			})
			this.BookingForm?.get('return_pickup_time')?.valueChanges.subscribe((value: string) => {
				if (!this.isManualRateEntered()) {
					this.buildBookingData();
				}
			})
		} else {
			//pickup time change 
			this.BookingForm?.get('pickup_time')?.valueChanges.subscribe((value: string) => {
				this.buildBookingData()
			})
			this.BookingForm?.get('return_pickup_time')?.valueChanges.subscribe((value: string) => {
				this.buildBookingData()
			})
		}

		// Service Type
		this.BookingForm?.get('service_type')?.valueChanges.subscribe((value: string) => {
			this.service_type = value;
			// this.syncNumberOfHoursValidation(value);
			this.init_return_rates = false;
			if (value == 'round_trip') {
				setTimeout(() => {
					this.initphonefield()
				}, 200)
				this.retryGoogleAutocompleteInitialization()
				this.init_return_rates = true;
				setTimeout(() => {
					this.MapController(true)
				}, 2000)
				this.BookingForm.patchValue({
					cancellation_hours: this.selectedVehicle?.non_charter_cancellation_hours.toString(),
					return_cancellation_hours: this.return_selectedVehicle?.non_charter_cancellation_hours.toString(),
					return_affiliate_id: this.BookingForm?.get('affiliate_id')?.value
				})
				if (this.booking_created_from == 'subscriber') {
					this.BookingForm.patchValue({
						return_susbcriber_name: this.BookingForm?.get('susbcriber_name')?.value,
						// return_driver_name: this.currentUser?.name,
						// return_driver_email: this.currentUser.email,
						// return_driver_cell_isd: this.currentUser?.isd,
						// return_driver_cell: this.currentUser?.phone,
						// return_driver_cell_country: this.currentUser?.phoneCountry
					})
					this.fetchReturnAffiliateVehicles(this.currentUser?.account_id)
				}
				if (this.booking_created_from == 'admin' && this.currentUser?.created_by_role == 'subscriber') {
					this.BookingForm.patchValue({
						return_susbcriber_name: this.BookingForm?.get('susbcriber_name')?.value,
					})
				}
				this.SetFormValue('return_pickup_date', moment(this.BookingForm.get('return_pickup_date').value).format('YYYY-MM-DD'));
				this.SetFormValue('return_pickup_time', this.FormatTime(this.BookingForm.get('return_pickup_time').value));
				this.updateReturnLegValidators(this.BookingForm.get('return_transfer_type').value);
			}
			if (value != 'charter_tour') {
				this.BookingForm.updateValueAndValidity()
				console.log(this.BookingForm?.get('number_of_hours')?.value);
				this.BookingForm.patchValue({
					cancellation_hours: this.selectedVehicle?.charter_cancellation_hours.toString(),
					return_cancellation_hours: this.return_selectedVehicle?.charter_cancellation_hours.toString()
				})
			}
			if (value == 'one_way') {
				console.log("setting value of return cruise port and name not mandatory")
				this.BookingForm?.get('return_cruise_name')?.clearValidators();
				this.BookingForm?.get('return_cruise_port')?.clearValidators();
				// this.BookingForm.get('return_dropoff_flight').clearValidators();
				// this.BookingForm.get('return_dropoff_flight').updateValueAndValidity();
				this.BookingForm?.get('return_dropoff_airport_option')?.clearValidators();
				this.BookingForm?.get('return_dropoff_airport_option')?.updateValueAndValidity();
				this.BookingForm?.get('return_dropoff_airline_option')?.clearValidators();
				this.BookingForm?.get('return_dropoff_airline_option')?.updateValueAndValidity();
				this.BookingForm?.get('return_pickup_flight')?.clearValidators();
				this.BookingForm?.get('return_pickup_flight')?.updateValueAndValidity();
				this.BookingForm?.get('return_pickup_airline_option')?.clearValidators();
				this.BookingForm?.get('return_pickup_airline_option')?.updateValueAndValidity();
				this.BookingForm?.get('return_pickup_airport_option')?.clearValidators();
				this.BookingForm?.get('return_pickup_airport_option')?.updateValueAndValidity();
				this.BookingForm?.get('departing_airport_city')?.clearValidators();
				this.BookingForm?.get('departing_airport_city')?.updateValueAndValidity();
				this.BookingForm?.get('return_cruise_name')?.updateValueAndValidity();
				this.BookingForm?.get('return_cruise_port')?.updateValueAndValidity();
				this.BookingForm.patchValue({
					cancellation_hours: this.selectedVehicle?.non_charter_cancellation_hours.toString(),
					return_cancellation_hours: this.return_selectedVehicle?.non_charter_cancellation_hours.toString()
				})

				// Clear return leg address validators
				this.BookingForm?.get('return_pickup')?.clearValidators();
				this.BookingForm?.get('return_dropoff')?.clearValidators();
				this.BookingForm?.get('return_pickup')?.updateValueAndValidity();
				this.BookingForm?.get('return_dropoff')?.updateValueAndValidity();
			}
		})

		// Transfer Type
		this.BookingForm?.get('transfer_type')?.valueChanges.subscribe((value: string) => {
			console.group('admin/new-booking transfer_type valueChanges');
			console.log('incoming transfer_type value', value);
			console.log('current component service_type', this.service_type);
			console.log('current component transfer_type before update', this.transfer_type);
			console.log('current form return_transfer_type before sync', this.BookingForm?.get('return_transfer_type')?.value);
			console.log('isPrefillingTransferTypes', this.isPrefillingTransferTypes);
			console.log("in transfer_type value changes", value)

			// pickup address mandatory
			if (!value.startsWith('airport_')) {
				this.BookingForm?.get('pickup')?.setValidators([Validators.required]);
			} else {
				this.BookingForm?.get('pickup')?.clearValidators();
			}
			this.BookingForm?.get('pickup')?.updateValueAndValidity();

			// dropoff address mandatory
			if (!value.endsWith('_airport')) {
				this.BookingForm?.get('dropoff')?.setValidators([Validators.required]);
			} else {
				this.BookingForm?.get('dropoff')?.clearValidators();
			}
			this.BookingForm?.get('dropoff')?.updateValueAndValidity();

			// Store old value for comparison
			const oldValue = this.transfer_type;
			const newValue = value;

			// Flip addresses for round trip when changing between complementary transfer types
			if (this.BookingForm.get('service_type').value == 'round_trip') {
				if ((oldValue == 'city_to_airport' && newValue == 'airport_to_city') ||
					(oldValue == 'airport_to_city' && newValue == 'city_to_airport') ||
					(oldValue == 'city_to_cruise' && newValue == 'cruise_to_city') ||
					(oldValue == 'cruise_to_city' && newValue == 'city_to_cruise')) {

					console.log('Flipping outbound addresses for complementary transfer type change');

					// Capture outbound pickup values
					const pickup = this.Form.pickup.value;
					const pickupLat = this.Form.pickup_latitude.value;
					const pickupLng = this.Form.pickup_longitude.value;
					const pickupAirport = this.Form.pickup_airport.value;
					const pickupAirportOpt = this.BookingForm.get('pickup_airport_option').value;
					const pickupAirportName = this.Form.pickup_airport_name.value;
					const pickupAirportLat = this.Form.pickup_airport_latitude.value;
					const pickupAirportLng = this.Form.pickup_airport_longitude.value;
					const pickupAirline = this.Form.pickup_airline.value;
					const pickupAirlineOpt = this.BookingForm.get('pickup_airline_option').value;
					const pickupAirlineName = this.Form.pickup_airline_name.value;
					const pickupFlight = this.Form.pickup_flight.value;
					const originAirportCity = this.Form.origin_airport_city.value;

					// Capture outbound dropoff values
					const dropoff = this.Form.dropoff.value;
					const dropoffLat = this.Form.dropoff_latitude.value;
					const dropoffLng = this.Form.dropoff_longitude.value;
					const dropoffAirport = this.Form.dropoff_airport.value;
					const dropoffAirportOpt = this.BookingForm.get('dropoff_airport_option').value;
					const dropoffAirportName = this.Form.dropoff_airport_name.value;
					const dropoffAirportLat = this.Form.dropoff_airport_latitude.value;
					const dropoffAirportLng = this.Form.dropoff_airport_longitude.value;
					const dropoffAirline = this.Form.dropoff_airline.value;
					const dropoffAirlineOpt = this.BookingForm.get('dropoff_airline_option').value;
					const dropoffAirlineName = this.Form.dropoff_airline_name.value;
					const dropoffFlight = this.Form.dropoff_flight.value;

					// Swap outbound addresses
					this.SetFormValue('pickup', dropoff);
					this.SetFormValue('pickup_latitude', dropoffLat);
					this.SetFormValue('pickup_longitude', dropoffLng);
					this.SetFormValue('pickup_airport', dropoffAirport);
					this.SetFormValue('pickup_airport_option', dropoffAirportOpt);
					this.SetFormValue('pickup_airport_name', dropoffAirportName);
					this.SetFormValue('pickup_airport_latitude', dropoffAirportLat);
					this.SetFormValue('pickup_airport_longitude', dropoffAirportLng);
					this.SetFormValue('pickup_airline', dropoffAirline);
					this.SetFormValue('pickup_airline_option', dropoffAirlineOpt);
					this.SetFormValue('pickup_airline_name', dropoffAirlineName);
					this.SetFormValue('pickup_flight', dropoffFlight);

					this.SetFormValue('dropoff', pickup);
					this.SetFormValue('dropoff_latitude', pickupLat);
					this.SetFormValue('dropoff_longitude', pickupLng);
					this.SetFormValue('dropoff_airport', pickupAirport);
					this.SetFormValue('dropoff_airport_option', pickupAirportOpt);
					this.SetFormValue('dropoff_airport_name', pickupAirportName);
					this.SetFormValue('dropoff_airport_latitude', pickupAirportLat);
					this.SetFormValue('dropoff_airport_longitude', pickupAirportLng);
					this.SetFormValue('dropoff_airline', pickupAirline);
					this.SetFormValue('dropoff_airline_option', pickupAirlineOpt);
					this.SetFormValue('dropoff_airline_name', pickupAirlineName);
					this.SetFormValue('dropoff_flight', pickupFlight);

					// Also flip return leg addresses
					const r_pickup = this.Form.return_pickup.value;
					const r_pickupLat = this.Form.return_pickup_latitude.value;
					const r_pickupLng = this.Form.return_pickup_longitude.value;
					const r_pickupAirport = this.Form.return_pickup_airport.value;
					const r_pickupAirportOpt = this.BookingForm.get('return_pickup_airport_option').value;
					const r_pickupAirportName = this.Form.return_pickup_airport_name.value;
					const r_pickupAirportLat = this.Form.return_pickup_airport_latitude.value;
					const r_pickupAirportLng = this.Form.return_pickup_airport_longitude.value;
					const r_pickupAirline = this.Form.return_pickup_airline.value;
					const r_pickupAirlineOpt = this.BookingForm.get('return_pickup_airline_option').value;
					const r_pickupAirlineName = this.Form.return_pickup_airline_name.value;
					const r_pickupFlight = this.Form.return_pickup_flight.value;
					const departingAirportCity = this.Form.departing_airport_city.value;

					const r_dropoff = this.Form.return_dropoff.value;
					const r_dropoffLat = this.Form.return_dropoff_latitude.value;
					const r_dropoffLng = this.Form.return_dropoff_longitude.value;
					const r_dropoffAirport = this.Form.return_dropoff_airport.value;
					const r_dropoffAirportOpt = this.BookingForm.get('return_dropoff_airport_option').value;
					const r_dropoffAirportName = this.Form.return_dropoff_airport_name.value;
					const r_dropoffAirportLat = this.Form.return_dropoff_airport_latitude.value;
					const r_dropoffAirportLng = this.Form.return_dropoff_airport_longitude.value;
					const r_dropoffAirline = this.Form.return_dropoff_airline.value;
					const r_dropoffAirlineOpt = this.BookingForm.get('return_dropoff_airline_option').value;
					const r_dropoffAirlineName = this.Form.return_dropoff_airline_name.value;
					const r_dropoffFlight = this.Form.return_dropoff_flight.value;

					// Swap return addresses
					this.SetFormValue('return_pickup', r_dropoff);
					this.SetFormValue('return_pickup_latitude', r_dropoffLat);
					this.SetFormValue('return_pickup_longitude', r_dropoffLng);
					this.SetFormValue('return_pickup_airport', r_dropoffAirport);
					this.SetFormValue('return_pickup_airport_option', r_dropoffAirportOpt);
					this.SetFormValue('return_pickup_airport_name', r_dropoffAirportName);
					this.SetFormValue('return_pickup_airport_latitude', r_dropoffAirportLat);
					this.SetFormValue('return_pickup_airport_longitude', r_dropoffAirportLng);
					this.SetFormValue('return_pickup_airline', r_dropoffAirline);
					this.SetFormValue('return_pickup_airline_option', r_dropoffAirlineOpt);
					this.SetFormValue('return_pickup_airline_name', r_dropoffAirlineName);
					this.SetFormValue('return_pickup_flight', r_dropoffFlight);

					this.SetFormValue('return_dropoff', r_pickup);
					this.SetFormValue('return_dropoff_latitude', r_pickupLat);
					this.SetFormValue('return_dropoff_longitude', r_pickupLng);
					this.SetFormValue('return_dropoff_airport', r_pickupAirport);
					this.SetFormValue('return_dropoff_airport_option', r_pickupAirportOpt);
					this.SetFormValue('return_dropoff_airport_name', r_pickupAirportName);
					this.SetFormValue('return_dropoff_airport_latitude', r_pickupAirportLat);
					this.SetFormValue('return_dropoff_airport_longitude', r_pickupAirportLng);
					this.SetFormValue('return_dropoff_airline', r_pickupAirline);
					this.SetFormValue('return_dropoff_airline_option', r_pickupAirlineOpt);
					this.SetFormValue('return_dropoff_airline_name', r_pickupAirlineName);
					this.SetFormValue('return_dropoff_flight', r_pickupFlight);

					// Swap airport city fields
					this.SetFormValue('origin_airport_city', departingAirportCity);
					this.SetFormValue('departing_airport_city', originAirportCity);

					// Trigger map update
					setTimeout(() => this.MapController(true), 1000);
				}
			}

			// Update transfer_type property
			this.transfer_type = value;
			// this.initAllAutocompletes()
			if (value.includes("city_")) {
				this.SetFormValue('booking_instructions', '<ol><li>Driver - Text on location. Text the client a day before to confirm driver name , cell phone and booking details. Text client with ETA when en route</li></ol>');
			}

			// set cruise ship name and cruise port mandatory
			if (value.includes('_cruise') || value.includes('cruise_')) {
				if (value.includes("cruise_")) {
					this.SetFormValue('booking_instructions', '<ol><li>Pax - Text driver when docked.</li><li>Driver - Text the client a day before to confirm driver name , cell phone and booking details. Text client with ETA when en route. Text pax with pickup instructions when ship has arrived.</li></ol>');
				}
				console.log("setting value of cruise port and name mandatory")
				this.BookingForm.get('cruise_name').setValidators([Validators.required]);
				this.BookingForm.get('cruise_port').setValidators([Validators.required]);
				this.BookingForm.get('cruise_name').updateValueAndValidity();
				this.BookingForm.get('cruise_port').updateValueAndValidity();
			} else {
				console.log("setting value of cruise port and name not mandatory")
				this.BookingForm.get('cruise_name').clearValidators();
				this.BookingForm.get('cruise_port').clearValidators();
				this.BookingForm.get('cruise_name').updateValueAndValidity();
				this.BookingForm.get('cruise_port').updateValueAndValidity();
			}

			// set flight number mandatory
			if (value.includes('_airport')) {
				console.log("setting value of dropoff flight mandatory")
				// this.BookingForm.get('dropoff_flight').setValidators([Validators.required]);
				// this.BookingForm.get('dropoff_flight').updateValueAndValidity();
				this.BookingForm.get('dropoff_airline_option').setValidators([Validators.required]);
				this.BookingForm.get('dropoff_airline_option').updateValueAndValidity();
				this.BookingForm.get('dropoff_airport_option').setValidators([Validators.required]);
				this.BookingForm.get('dropoff_airport_option').updateValueAndValidity();
			} else {
				console.log("setting value of dropoff flight not mandatory")
				// this.BookingForm.get('dropoff_flight').clearValidators();
				// this.BookingForm.get('dropoff_flight').updateValueAndValidity();
				this.BookingForm.get('dropoff_airline_option').clearValidators();
				this.BookingForm.get('dropoff_airline_option').updateValueAndValidity();
				this.BookingForm.get('dropoff_airport_option').clearValidators();
				this.BookingForm.get('dropoff_airport_option').updateValueAndValidity();

			}

			if (value.includes('airport_')) {
				this.SetFormValue('booking_instructions', '<ol><li>Pax - Text driver when landing.</li><li>Driver - Text the client a day before to confirm driver name , cell phone and booking details. Text client with ETA when en route. Text pax with pickup instructions when plane has arrived.</li></ol>');
				console.log("setting value of pickup flight mandatory")
				this.BookingForm.get('pickup_flight').setValidators([Validators.required]);
				this.BookingForm.get('pickup_flight').updateValueAndValidity();
				this.BookingForm.get('pickup_airline_option').setValidators([Validators.required]);
				this.BookingForm.get('pickup_airline_option').updateValueAndValidity();
				this.BookingForm.get('pickup_airport_option').setValidators([Validators.required]);
				this.BookingForm.get('pickup_airport_option').updateValueAndValidity();
				this.BookingForm.get('origin_airport_city').setValidators([Validators.required]);
				this.BookingForm.get('origin_airport_city').updateValueAndValidity();
			} else {
				console.log("setting value of pickup flight not mandatory")
				this.BookingForm.get('pickup_flight').clearValidators();
				this.BookingForm.get('pickup_flight').updateValueAndValidity();
				this.BookingForm.get('pickup_airline_option').clearValidators();
				this.BookingForm.get('pickup_airline_option').updateValueAndValidity();
				this.BookingForm.get('pickup_airport_option').clearValidators();
				this.BookingForm.get('pickup_airport_option').updateValueAndValidity();
				this.BookingForm.get('origin_airport_city').clearValidators();
				this.BookingForm.get('origin_airport_city').updateValueAndValidity();

			}

			const reverseStringChars = (text: string) => {
				let temp = text.split('_')
				return temp.reverse().join('_')
			}
			if (!this.isPrefillingTransferTypes) {
				this.SetFormValue('return_transfer_type', reverseStringChars(value), false)
				this.return_transfer_type = reverseStringChars(value)
				this.updateReturnLegValidators(this.return_transfer_type);
			}
			this.refreshMapIfRouteReady(false);
			if (this.Form.service_type.value == 'round_trip') {
				this.refreshMapIfRouteReady(true);
			}
			console.log('component transfer_type after update', this.transfer_type);
			console.log('component return_transfer_type after sync', this.return_transfer_type);
			console.log('form return_transfer_type after sync', this.BookingForm?.get('return_transfer_type')?.value);
			console.groupEnd();
		})


		this.BookingForm?.get('return_transfer_type')?.valueChanges.subscribe((value: string) => {
			console.group('admin/new-booking return_transfer_type valueChanges');
			console.log('incoming return_transfer_type value', value);
			console.log('current component return_transfer_type before update', this.return_transfer_type);
			console.log('current form transfer_type before sync', this.BookingForm?.get('transfer_type')?.value);
			console.log('isPrefillingTransferTypes', this.isPrefillingTransferTypes);
			console.log("in return_transfer_type value changes", value)

			if (this.BookingForm?.get('service_type')?.value == 'round_trip') {
				// return pickup address mandatory
				if (!value.startsWith('airport_')) {
					this.BookingForm?.get('return_pickup')?.setValidators([Validators.required]);
				} else {
					this.BookingForm?.get('return_pickup')?.clearValidators();
				}
				this.BookingForm?.get('return_pickup')?.updateValueAndValidity();

				// return dropoff address mandatory
				if (!value.endsWith('_airport')) {
					this.BookingForm?.get('return_dropoff')?.setValidators([Validators.required]);
				} else {
					this.BookingForm?.get('return_dropoff')?.clearValidators();
				}
				this.BookingForm?.get('return_dropoff')?.updateValueAndValidity();
			} else {
				this.BookingForm?.get('return_pickup')?.clearValidators();
				this.BookingForm?.get('return_dropoff')?.clearValidators();
				this.BookingForm?.get('return_pickup')?.updateValueAndValidity();
				this.BookingForm?.get('return_dropoff')?.updateValueAndValidity();
				this.BookingForm?.get('return_cruise_name')?.clearValidators();
				this.BookingForm?.get('return_cruise_port')?.clearValidators();
				this.BookingForm?.get('return_cruise_name')?.updateValueAndValidity();
				this.BookingForm?.get('return_cruise_port')?.updateValueAndValidity();
				this.BookingForm?.get('return_dropoff_airline_option')?.clearValidators();
				this.BookingForm?.get('return_dropoff_airline_option')?.updateValueAndValidity();
				this.BookingForm?.get('return_dropoff_airport_option')?.clearValidators();
				this.BookingForm?.get('return_dropoff_airport_option')?.updateValueAndValidity();
				this.BookingForm?.get('return_pickup_flight')?.clearValidators();
				this.BookingForm?.get('return_pickup_flight')?.updateValueAndValidity();
				this.BookingForm?.get('return_pickup_airline_option')?.clearValidators();
				this.BookingForm?.get('return_pickup_airline_option')?.updateValueAndValidity();
				this.BookingForm?.get('return_pickup_airport_option')?.clearValidators();
				this.BookingForm?.get('return_pickup_airport_option')?.updateValueAndValidity();
				this.BookingForm?.get('departing_airport_city')?.clearValidators();
				this.BookingForm?.get('departing_airport_city')?.updateValueAndValidity();
			}

			// this.initAllAutocompletes()
			if (this.BookingForm.get('service_type').value == 'round_trip') {
				if (value.includes("city_")) {
					this.SetFormValue('return_booking_instructions', '<ol><li>Driver - Text on location. Text the client a day before to confirm driver name , cell phone and booking details. Text client with ETA when en route</li></ol>');
				}

				// set cruise ship name and cruise port mandatory
				if (value.includes('_cruise') || value.includes('cruise_')) {
					if (value.includes("cruise_")) {
						this.SetFormValue('return_booking_instructions', '<ol><li>Pax - Text driver when docked.</li><li>Driver - Text the client a day before to confirm driver name , cell phone and booking details. Text client with ETA when en route. Text pax with pickup instructions when ship has arrived.</li></ol>');
					}
					console.log("setting value of return cruise port and name mandatory")
					this.BookingForm.get('return_cruise_name').setValidators([Validators.required]);
					this.BookingForm.get('return_cruise_port').setValidators([Validators.required]);
					this.BookingForm.get('return_cruise_name').updateValueAndValidity();
					this.BookingForm.get('return_cruise_port').updateValueAndValidity();
				} else {
					console.log("setting value of return cruise port and name not mandatory")
					this.BookingForm.get('return_cruise_name').clearValidators();
					this.BookingForm.get('return_cruise_port').clearValidators();
					this.BookingForm.get('return_cruise_name').updateValueAndValidity();
					this.BookingForm.get('return_cruise_port').updateValueAndValidity();
				}

				// set flight number mandatory
				if (value.includes('_airport')) {
					console.log("setting value of return dropoff flight mandatory")
					// this.BookingForm.get('return_dropoff_flight').setValidators([Validators.required]);
					// this.BookingForm.get('return_dropoff_flight').updateValueAndValidity();
					this.BookingForm.get('return_dropoff_airline_option').setValidators([Validators.required]);
					this.BookingForm.get('return_dropoff_airline_option').updateValueAndValidity();
					this.BookingForm.get('return_dropoff_airport_option').setValidators([Validators.required]);
					this.BookingForm.get('return_dropoff_airport_option').updateValueAndValidity();

				} else {
					console.log("setting value of return dropoff flight not mandatory")
					// this.BookingForm.get('return_dropoff_flight').clearValidators();
					// this.BookingForm.get('return_dropoff_flight').updateValueAndValidity();
					this.BookingForm.get('return_dropoff_airline_option').clearValidators();
					this.BookingForm.get('return_dropoff_airline_option').updateValueAndValidity();
					this.BookingForm.get('return_dropoff_airport_option').clearValidators();
					this.BookingForm.get('return_dropoff_airport_option').updateValueAndValidity();
				}

				if (value.includes('airport_')) {
					this.SetFormValue('return_booking_instructions', '<ol><li>Pax - Text driver when landing.</li><li>Driver - Text the client a day before to confirm driver name , cell phone and booking details. Text client with ETA when en route. Text pax with pickup instructions when plane has arrived.</li></ol>');
					console.log("setting value of return pickup flight mandatory")
					this.BookingForm.get('return_pickup_flight').setValidators([Validators.required]);
					this.BookingForm.get('return_pickup_flight').updateValueAndValidity();
					this.BookingForm.get('return_pickup_airline_option').setValidators([Validators.required]);
					this.BookingForm.get('return_pickup_airline_option').updateValueAndValidity();
					this.BookingForm.get('return_pickup_airport_option').setValidators([Validators.required]);
					this.BookingForm.get('return_pickup_airport_option').updateValueAndValidity();
					this.BookingForm.get('departing_airport_city').setValidators([Validators.required]);
					this.BookingForm.get('departing_airport_city').updateValueAndValidity();
				} else {
					console.log("setting value of return pickup flight not mandatory")
					this.BookingForm.get('return_pickup_flight').clearValidators();
					this.BookingForm.get('return_pickup_flight').updateValueAndValidity();
					this.BookingForm.get('return_pickup_airline_option').clearValidators();
					this.BookingForm.get('return_pickup_airline_option').updateValueAndValidity();
					this.BookingForm.get('return_pickup_airport_option').clearValidators();
					this.BookingForm.get('return_pickup_airport_option').updateValueAndValidity();
					this.BookingForm.get('departing_airport_city').clearValidators();
					this.BookingForm.get('departing_airport_city').updateValueAndValidity();
				}
			}

			this.return_transfer_type = value
			if (this.Form.service_type.value == 'round_trip') {
				this.refreshMapIfRouteReady(true);
			}
			console.log('component return_transfer_type after update', this.return_transfer_type);
			console.log('component transfer_type remains', this.transfer_type);
			console.log('form transfer_type remains', this.BookingForm?.get('transfer_type')?.value);
			console.groupEnd();
		})


		// Account Type Subscription
		this.BookingForm?.get('account_type')?.valueChanges.subscribe((value: string) => {
			if (value == 'loose_customer') {
				setTimeout(() => {
					this.initphonefield()
				}, 200)
				this.retryGoogleAutocompleteInitialization()
				const loose_customer = (this.BookingForm.get('loose_customer') as FormGroup)
				// for every 'item' in loose_customer
				for (let item in loose_customer.controls) {
					// if 'item' in loose_customer is a formgroup, like card_details
					if ((<FormGroup>this.BookingForm.get('loose_customer')).get(item) instanceof FormGroup) {
						console.log(item)
						// for every 'key' in card_details formgroup
						for (let key in (loose_customer.get(item) as FormGroup).controls) {
							// set validators in card_details
							(<FormGroup>loose_customer.get(item)).get(key).setValidators([Validators.required]);
							(<FormGroup>loose_customer.get(item)).get(key).updateValueAndValidity();

						}
					}

					if (item != 'middle_name' && item != 'address') {
						loose_customer.get(item).setValidators([Validators.required]);
					}
				}

				(<FormGroup>loose_customer.get('card_details')).get('card_number').setValidators([Validators.pattern("^[0-9+]*$"), Validators.minLength(12), Validators.maxLength(20),]);
				(<FormGroup>loose_customer.get('card_details')).get('name').setValidators([]);
				(<FormGroup>loose_customer.get('card_details')).get('cvv').setValidators([Validators.pattern("^[0-9+]*$")]);
				(<FormGroup>loose_customer.get('card_details')).get('exp_month').setValidators([]);
				(<FormGroup>loose_customer.get('card_details')).get('exp_year').setValidators([]);
				loose_customer.get('email').setValidators([Validators.required, Validators.pattern(/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i)])
				loose_customer.get('phone').setValidators([Validators.required, Validators.pattern("^[0-9+]*$"), Validators.minLength(4), Validators.maxLength(15)])
				loose_customer.get('first_name').setValidators([Validators.required])
				// loose_customer.get('middle_name').setValidators(this.customValidator.whitespace())
				loose_customer.get('last_name').setValidators([Validators.required])
				loose_customer.get('address').setValidators(this.customValidator.whitespace())
				loose_customer.updateValueAndValidity()

			}
			else {
				const loose_customer = (this.BookingForm.get('loose_customer') as FormGroup)
				// for every 'item' in loose_customer
				for (let item in loose_customer.controls) {
					// if 'item' in loose_customer is a formgroup, like card_details
					if (loose_customer.get(item) instanceof FormGroup) {
						// for every 'key' in card_details formgroup
						for (let key in (loose_customer.get(item) as FormGroup).controls) {
							// clear validators in card_details
							loose_customer.get(item).get(key).clearValidators()
							loose_customer.get(item).get(key).updateValueAndValidity()
						}
					}
					loose_customer.get(item).clearValidators()
					loose_customer.get(item).updateValueAndValidity()
				}

				this.fetchClientAccounts(value)
			}
		})

		this.BookingForm.get('acc_id').valueChanges.subscribe((value: number) => {
			if (value && this.updateType == 'repeat' && this.updateType == 'return' && this.updateType == 'edit' && this.updateType == 'round') {
				this.chooseUser(value)
			}
		})

		this.BookingForm.get('travel_client_id').valueChanges.subscribe((value: number) => {
			if (value && this.shouldHandlePrefilledBookingAccount()) {
				this.handleTravelStaffAccounts({ id: value })
			}
		})
		this.BookingForm.get('travel_client_acc').valueChanges.subscribe((value: any) => {
			if (value == 'travel_loose_customer') {
				setTimeout(() => {
					this.initphonefield()
				}, 200)
				const loose_customer = (this.BookingForm.get('loose_customer') as FormGroup)
				// for every 'item' in loose_customer
				for (let item in loose_customer.controls) {
					// if 'item' in loose_customer is a formgroup, like card_details
					if ((<FormGroup>this.BookingForm.get('loose_customer')).get(item) instanceof FormGroup) {
						console.log(item)
						// for every 'key' in card_details formgroup
						for (let key in (loose_customer.get(item) as FormGroup).controls) {
							// set validators in card_details
							(<FormGroup>loose_customer.get(item)).get(key).setValidators([Validators.required]);
							(<FormGroup>loose_customer.get(item)).get(key).updateValueAndValidity();

						}
					}

					if (item != 'middle_name' && item != 'address') {
						loose_customer.get(item).setValidators([Validators.required]);
					}
				}

				(<FormGroup>loose_customer.get('card_details')).get('card_number').setValidators([Validators.pattern("^[0-9+]*$"), Validators.minLength(12), Validators.maxLength(20),]);
				(<FormGroup>loose_customer.get('card_details')).get('name').setValidators([]);
				(<FormGroup>loose_customer.get('card_details')).get('cvv').setValidators([Validators.pattern("^[0-9+]*$")]);
				(<FormGroup>loose_customer.get('card_details')).get('exp_month').setValidators([]);
				(<FormGroup>loose_customer.get('card_details')).get('exp_year').setValidators([]);
				loose_customer.get('email').setValidators([Validators.required, Validators.pattern(/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i)])
				loose_customer.get('phone').setValidators([Validators.required, Validators.pattern("^[0-9+]*$"), Validators.minLength(4), Validators.maxLength(15)])
				loose_customer.get('first_name').setValidators([Validators.required])
				// loose_customer.get('middle_name').setValidators(this.customValidator.whitespace())
				loose_customer.get('last_name').setValidators([Validators.required])
				loose_customer.get('address').setValidators(this.customValidator.whitespace())
				loose_customer.updateValueAndValidity()

			}
			else {
				const loose_customer = (this.BookingForm.get('loose_customer') as FormGroup)
				// for every 'item' in loose_customer
				for (let item in loose_customer.controls) {
					// if 'item' in loose_customer is a formgroup, like card_details
					if (loose_customer.get(item) instanceof FormGroup) {
						// for every 'key' in card_details formgroup
						for (let key in (loose_customer.get(item) as FormGroup).controls) {
							// clear validators in card_details
							loose_customer.get(item).get(key).clearValidators()
							loose_customer.get(item).get(key).updateValueAndValidity()
						}
					}
					loose_customer.get(item).clearValidators()
					loose_customer.get(item).updateValueAndValidity()
				}
			}
		})


		// Affiliate Type
		this.BookingForm.get('affiliate_type').valueChanges.subscribe((value: string) => {
			if (value == 'loose_affiliate' && this.currentUser?.created_by_role == 'subscriber') {
				this.isFarmoutBooking = false
				this.booking_created_from = 'subscriber'
			}
			else if (this.currentUser?.created_by_role == 'subscriber' && value == 'affiliate' && this.veh_created_by == 1) {
				this.isFarmoutBooking = true
				this.booking_created_from = 'admin'
			}
			if (value == 'loose_affiliate') {
				setTimeout(() => {
					this.initphonefield()
					if (this.lose_aff_name_input) {
						this.lose_aff_name_input.nativeElement.focus()
					}
				}, 200)
				this.fetchAffiliates('loose_affiliate')

				this.toggleDropdown(null)
				this.BookingForm.get('lose_affiliate_name').setValidators([Validators.required])
				this.BookingForm.get('lose_affiliate_phone').setValidators([Validators.required, Validators.pattern("^[0-9+]*$"), Validators.minLength(4), Validators.maxLength(15)])
				this.BookingForm.get('lose_affiliate_email').setValidators([Validators.required, Validators.pattern(/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i)])
				// this.BookingForm.get('cancellation_hours').setValidators([Validators.required])
				this.BookingForm.updateValueAndValidity()
				this.init_rates = true
				if (this.Form.service_type.value === 'round_trip') {
					this.init_return_rates = true;
				}
				if (this.Form.updateType.value != 'edit' && this.Form.updateType.value != 'repeat' && this.Form.updateType.value != 'return') {
					this.SetFormValue('vehicle_type_name', '');
					this.BookingForm.get('vehicle_make').setValue('')
					this.BookingForm.get('vehicle_make_name').setValue('')
					this.BookingForm.get('vehicle_model').setValue('')
					this.BookingForm.get('vehicle_model_name').setValue('')
					this.BookingForm.get('vehicle_year').setValue('')
					this.BookingForm.get('vehicle_year_name').setValue('')
					this.BookingForm.get('vehicle_color').setValue('')
					this.BookingForm.get('vehicle_color_name').setValue('')
					this.BookingForm.updateValueAndValidity();
				}
			}
			else {
				console.log('value--->> clearing validations for--> ', value)
				this.BookingForm.get('lose_affiliate_name').clearValidators()
				this.BookingForm.get('lose_affiliate_name').updateValueAndValidity()

				this.BookingForm.get('lose_affiliate_phone').clearValidators()
				this.BookingForm.get('lose_affiliate_phone').updateValueAndValidity()


				this.BookingForm.get('lose_affiliate_email').clearValidators()
				this.BookingForm.get('lose_affiliate_email').updateValueAndValidity()

				// this.BookingForm.get('cancellation_hours').clearValidators()
				// this.BookingForm.get('cancellation_hours').updateValueAndValidity()


				console.log('clear validation')
				this.init_rates = true;
				if (this.Form.service_type.value === 'round_trip') {
					this.init_return_rates = true;
				}
				this.fetchAffiliates('affiliate')
				this.chooseAffiliate()
			}
		})

		// Affiliate Type
		this.BookingForm.get('return_affiliate_type').valueChanges.subscribe((value: string) => {
			if (value == 'loose_affiliate' && this.currentUser?.created_by_role == 'subscriber') {
				this.booking_created_from = 'subscriber'
			}
			else if (this.currentUser?.created_by_role == 'subscriber' && value == 'affiliate' && this.veh_created_by == 1) {
				this.booking_created_from = 'admin'
				this.fetchReturnAffiliateVehicles((this.BookingForm.get('return_affiliate_id').value))
			}
			if (value == 'loose_affiliate') {
				setTimeout(() => {
					this.initphonefield()
				}, 200)
				this.BookingForm.patchValue({
					return_affiliate_id: ''
				})
				this.fetchReturnAffiliates('loose_affiliate')
				this.toggleDropdown(null)
				this.BookingForm.get('return_lose_affiliate_name').setValidators([Validators.required])
				this.BookingForm.get('return_lose_affiliate_phone').setValidators([Validators.required, Validators.pattern("^[0-9+]*$"), Validators.minLength(4), Validators.maxLength(15)])
				this.BookingForm.get('return_lose_affiliate_email').setValidators([Validators.required, Validators.pattern(/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i)])
				// this.BookingForm.get('cancellation_hours').setValidators([Validators.required])
				this.BookingForm.updateValueAndValidity()
				this.init_rates = true
				if (this.Form.service_type.value === 'round_trip') {
					this.init_return_rates = true;
				}
				if (this.Form.updateType.value != 'edit' && this.Form.updateType.value != 'repeat' && this.Form.updateType.value != 'return') {
					this.SetFormValue('return_vehicle_type_name', '');
					this.BookingForm.get('return_vehicle_make').setValue('')
					this.BookingForm.get('return_vehicle_make_name').setValue('')
					this.BookingForm.get('return_vehicle_model').setValue('')
					this.BookingForm.get('return_vehicle_model_name').setValue('')
					this.BookingForm.get('return_vehicle_year').setValue('')
					this.BookingForm.get('return_vehicle_year_name').setValue('')
					this.BookingForm.get('return_vehicle_color').setValue('')
					this.BookingForm.get('return_vehicle_color_name').setValue('')
					this.BookingForm.updateValueAndValidity();
				}
			}
			else {
				console.log('value--->> clearing validations for--> ', value)
				this.BookingForm.get('return_lose_affiliate_name').clearValidators()
				this.BookingForm.get('return_lose_affiliate_name').updateValueAndValidity()

				this.BookingForm.get('return_lose_affiliate_phone').clearValidators()
				this.BookingForm.get('return_lose_affiliate_phone').updateValueAndValidity()


				this.BookingForm.get('return_lose_affiliate_email').clearValidators()
				this.BookingForm.get('return_lose_affiliate_email').updateValueAndValidity()

				// this.BookingForm.get('cancellation_hours').clearValidators()
				// this.BookingForm.get('cancellation_hours').updateValueAndValidity()


				console.log('clear validation')
				this.init_rates = true;
				if (this.Form.service_type.value === 'round_trip') {
					this.init_return_rates = true;
				}
				this.fetchReturnAffiliates('affiliate')
				this.chooseReturnAffiliate()
			}
		})

		this.BookingForm.get('affiliate_id').valueChanges.pipe(distinctUntilChanged()).subscribe((value: number) => {
			console.log("in affiliate info", this.booking_created_from)
			if (value && this.booking_created_from == 'admin') {
				console.log("in affiliate info")
				this.chooseAffiliate()
				this.fetchAffiliateInformation(value)
				if (this.Form.updateType.value != 'edit' && this.Form.updateType.value != 'repeat' && this.Form.updateType.value != 'return') {
					this.scroll('booking_detail_section')
				}
				if (this.BookingForm.get('service_type').value == 'round_trip') {
					this.BookingForm.patchValue({
						return_affiliate_id: value
					})
				}
			}
		})

		this.BookingForm.get('loose_affiliate_id').valueChanges.subscribe((value: number) => {
			console.log("in affiliate info", this.booking_created_from)
			if (value && this.booking_created_from == 'admin') {
				console.log("in affiliate info")
				this.chooseLooseAffiliate()
				// this.fetchAffiliateInformation(value)
				// if (this.Form.updateType.value != 'edit' && this.Form.updateType.value != 'repeat' && this.Form.updateType.value != 'return') {
				// 	this.scroll('booking_detail_section')
				// }
				// if (this.BookingForm.get('service_type').value == 'round_trip') {
				// 	this.BookingForm.patchValue({
				// 		return_affiliate_id: value
				// 	})
				// }
			}
		})

		this.BookingForm.get('return_affiliate_id').valueChanges.pipe(distinctUntilChanged()).subscribe((value: number) => {
			if (value && this.booking_created_from == 'admin') {
				this.chooseReturnAffiliate()
				this.fetchReturnAffiliateInformation(value)
				if (this.Form.updateType.value != 'edit' && this.Form.updateType.value != 'repeat' && this.Form.updateType.value != 'return') {
					this.scroll('booking_detail_section')
				}
			}
		})

		this.BookingForm.get('return_loose_affiliate_id').valueChanges.subscribe((value: number) => {
			if (value && this.booking_created_from == 'admin') {
				this.chooseReturnLooseAffiliate()
				// this.fetchReturnAffiliateInformation(value)
				if (this.Form.updateType.value != 'edit' && this.Form.updateType.value != 'repeat' && this.Form.updateType.value != 'return') {
					this.scroll('booking_detail_section')
				}
			}
		})


		// this.BookingForm.get('vehicle_id').valueChanges.subscribe((value: any) =>
		// {
		// 	if (value && this.VehicleList)
		// 	{
		// 		let v = this.VehicleList.find(item => item.ID == value)
		// 		this.autofillData('vehicle', v);
		// 	}
		// })

		this.BookingForm.get('vehicle_type').valueChanges.subscribe((value: string) => {
			console.log('on change of vehicle type-->>> value', value)
			if (this.Form.affiliate_type.value == 'affiliate') {
				console.log('in function change value for affilliate vehicle_type', value)
				if (value) {
					this.VehicleList.map(i => (i.unique_key == this.unique_key) ? this.handleSelectVehicleType(i) : '')
				}
				else {
					this.SetFormValue('vehicle_type_name', '');
					this.BookingForm.get('vehicle_make').setValue('')
					this.BookingForm.get('vehicle_make_name').setValue('')
					this.BookingForm.get('vehicle_model').setValue('')
					this.BookingForm.get('vehicle_model_name').setValue('')
					this.BookingForm.get('vehicle_year').setValue('')
					this.BookingForm.get('vehicle_year_name').setValue('')
					this.BookingForm.get('vehicle_color').setValue('')
					this.BookingForm.get('vehicle_color_name').setValue('')
					this.BookingForm.updateValueAndValidity();
				}

			} else {
				if (value && this.BigData) {
					let name = this.BigData['vehicleCategories'].find(item => item.id == value)['name']
					this.SetFormValue('vehicle_type_name', name);
					this.BookingForm.get('vehicle_make').setValue('')
					this.BookingForm.get('vehicle_make_name').setValue('')
					this.BookingForm.get('vehicle_model').setValue('')
					this.BookingForm.get('vehicle_model_name').setValue('')
					this.BookingForm.get('vehicle_year').setValue('')
					this.BookingForm.get('vehicle_year_name').setValue('')
					this.BookingForm.get('vehicle_color').setValue('')
					this.BookingForm.get('vehicle_color_name').setValue('')
					this.BookingForm.updateValueAndValidity();
				}
			}
		})


		this.BookingForm.get('return_vehicle_type').valueChanges.subscribe((value: string) => {
			console.log('on change of vehicle type-->>> value', value)
			if (this.Form.return_affiliate_type.value == 'affiliate') {
				console.log('in function change value for affilliate vehicle_type', value)
				if (value) {
					this.return_VehicleList.map(i => (i.unique_key == this.return_unique_key) ? this.handleReturnSelectVehicleType(i) : '')
				}
				else {
					this.SetFormValue('return_vehicle_type_name', '');
					this.BookingForm.get('return_vehicle_make').setValue('')
					this.BookingForm.get('return_vehicle_make_name').setValue('')
					this.BookingForm.get('return_vehicle_model').setValue('')
					this.BookingForm.get('return_vehicle_model_name').setValue('')
					this.BookingForm.get('return_vehicle_year').setValue('')
					this.BookingForm.get('return_vehicle_year_name').setValue('')
					this.BookingForm.get('return_vehicle_color').setValue('')
					this.BookingForm.get('return_vehicle_color_name').setValue('')
					this.BookingForm.updateValueAndValidity();
				}

			} else {
				if (value && this.BigData) {
					let name = this.BigData['vehicleCategories'].find(item => item.id == value)['name']
					this.SetFormValue('return_vehicle_type_name', name);
					this.BookingForm.get('return_vehicle_make').setValue('')
					this.BookingForm.get('return_vehicle_make_name').setValue('')
					this.BookingForm.get('return_vehicle_model').setValue('')
					this.BookingForm.get('return_vehicle_model_name').setValue('')
					this.BookingForm.get('return_vehicle_year').setValue('')
					this.BookingForm.get('return_vehicle_year_name').setValue('')
					this.BookingForm.get('return_vehicle_color').setValue('')
					this.BookingForm.get('return_vehicle_color_name').setValue('')
					this.BookingForm.updateValueAndValidity();
				}
			}
		})

		this.BookingForm.get('vehicle_make').valueChanges.subscribe((value: string) => {
			if (this.Form.affiliate_type.value == 'affiliate') {
				console.log('in function change value for affilliate  vehicle_make')
			} else {
				if (value && this.BigData) {
					this.BigData['vehicleModels'] = this.BigData_COPY?.vehicleModels.filter(item => item.make_id == value)
					let name = this.BigData['vehicleMakes'].find(item => item.id == value)['name']
					this.SetFormValue('vehicle_model', this.BigData?.vehicleModels[0]['id'])
					this.SetFormValue('vehicle_make_name', name)
				}
				else {
					this.BookingForm.get('vehicle_make_name').setValue('')
					this.BookingForm.updateValueAndValidity();
				}
			}
		})

		this.BookingForm.get('return_vehicle_make').valueChanges.subscribe((value: string) => {
			if (this.Form.return_affiliate_type.value == 'affiliate') {
				console.log('in function change value for affilliate  vehicle_make')
			} else {
				if (value && this.BigData) {
					this.BigData['vehicleModels'] = this.BigData_COPY?.vehicleModels.filter(item => item.make_id == value)
					let name = this.BigData['vehicleMakes'].find(item => item.id == value)['name']
					this.SetFormValue('return_vehicle_model', this.BigData?.vehicleModels[0]['id'])
					this.SetFormValue('return_vehicle_make_name', name)
				}
				else {
					this.BookingForm.get('return_vehicle_make_name').setValue('')
					this.BookingForm.updateValueAndValidity();
				}
			}
		})

		this.BookingForm.get('vehicle_model').valueChanges.subscribe((value: string) => {
			if (this.Form.affiliate_type.value == 'affiliate') {
				console.log('in function change value for affilliate vehicle_model')

			} else {
				if (value && this.BigData) {
					let name = this.BigData['vehicleModels'].find(item => item.id == value)['name']
					this.SetFormValue('vehicle_model_name', name)
				}
				else {
					this.BookingForm.get('vehicle_model_name').setValue('')
					this.BookingForm.updateValueAndValidity();
				}
			}
		})

		this.BookingForm.get('return_vehicle_model').valueChanges.subscribe((value: string) => {
			if (this.Form.return_affiliate_type.value == 'affiliate') {
				console.log('in function change value for affilliate return_vehicle_model')

			} else {
				if (value && this.BigData) {
					let name = this.BigData['vehicleModels'].find(item => item.id == value)['name']
					this.SetFormValue('return_vehicle_model_name', name)
				}
				else {
					this.BookingForm.get('return_vehicle_model_name').setValue('')
					this.BookingForm.updateValueAndValidity();
				}
			}
		})

		this.BookingForm.get('vehicle_year').valueChanges.subscribe((value: string) => {
			if (this.Form.affiliate_type.value == 'affiliate') {
				console.log('in function change value for affilliate vehicle_year')
			} else {
				if (value && this.BigData) {
					let name = this.BigData['vehicleYears'].find(item => item.id == value)['name']
					this.SetFormValue('vehicle_year_name', name)
				}
				else {
					this.BookingForm.get('vehicle_year_name').setValue('')
					this.BookingForm.updateValueAndValidity();
				}
			}
		})

		this.BookingForm.get('return_vehicle_year').valueChanges.subscribe((value: string) => {
			if (this.Form.return_affiliate_type.value == 'affiliate') {
				console.log('in function change value for affilliate return_vehicle_year')
			} else {
				if (value && this.BigData) {
					let name = this.BigData['vehicleYears'].find(item => item.id == value)['name']
					this.SetFormValue('return_vehicle_year_name', name)
				}
				else {
					this.BookingForm.get('return_vehicle_year_name').setValue('')
					this.BookingForm.updateValueAndValidity();
				}
			}
		})

		this.BookingForm.get('vehicle_color').valueChanges.subscribe((value: string) => {
			if (this.Form.affiliate_type.value == 'affiliate') {
				console.log('in function change value for affilliate vehicle_color')

			} else {
				if (value && this.BigData) {
					let name = this.BigData['vehicleColors'].find(item => item.id == value)['name']
					this.SetFormValue('vehicle_color_name', name)
				}
				else {
					this.BookingForm.get('vehicle_color_name').setValue('')
					this.BookingForm.updateValueAndValidity();

				}
			}
		})

		this.BookingForm.get('return_vehicle_color').valueChanges.subscribe((value: string) => {
			if (this.Form.return_affiliate_type.value == 'affiliate') {
				console.log('in function change value for affilliate return_vehicle_color')

			} else {
				if (value && this.BigData) {
					let name = this.BigData['vehicleColors'].find(item => item.id == value)['name']
					this.SetFormValue('return_vehicle_color_name', name)
				}
				else {
					this.BookingForm.get('return_vehicle_color_name').setValue('')
					this.BookingForm.updateValueAndValidity();

				}
			}
		})

		// Pickup Airport
		this.BookingForm.get('pickup_airport').valueChanges.subscribe((value: number) => {
			console.log("value in pickup_airport--->", value)
			if (value == 3283) {
				this.BookingForm.get('pickup_airline_option').clearValidators();
				this.BookingForm.get('pickup_airline_option').updateValueAndValidity();
				setTimeout(() => this.retryGoogleAutocompleteInitialization(), 100);
			}
			if (value) {
				let airport_selected = this.BigData?.airportsData.find(item => item.id == value)
				const airport_display = this.Form.pickup_airport_option.value || this.getAirportDisplayValue(airport_selected);
				airport_selected && this.SetFormValue('pickup_airport_name', airport_display);
				airport_selected && this.SetFormValue('pickup_airport_latitude', this.Form.pickup_airport_latitude.value || airport_selected.lat);
				airport_selected && this.SetFormValue('pickup_airport_longitude', this.Form.pickup_airport_longitude.value || airport_selected.long);
				this.SetFormValue('return_dropoff_airport_option', airport_display);
				this.SetFormValue('return_dropoff_airport_name', this.Form.pickup_airport_name.value || airport_display);
				this.SetFormValue('return_dropoff_airport_latitude', this.Form.pickup_airport_latitude.value || airport_selected?.lat);
				this.SetFormValue('return_dropoff_airport_longitude', this.Form.pickup_airport_longitude.value || airport_selected?.long);
				this.SetFormValue('return_dropoff_airport', value);
				this.MapController();
				if (this.Form.service_type.value == 'round_trip') {
					setTimeout(() => {
						this.MapController(true);
					}, 2000);
				}
			}
		});

		// Pickup Airlines
		this.BookingForm.get('pickup_airline').valueChanges.subscribe((value: string) => {
			if (value) {
				let airline_selected = this.BigData?.airlinesData.find(item => item.id == value)
				this.SetFormValue('pickup_airline_name', airline_selected.formatted_name);
				this.SetFormValue('return_dropoff_airline_option', airline_selected);
				this.SetFormValue('return_dropoff_airline', value)
			}
		})

		// Dropoff Airport
		this.BookingForm.get('dropoff_airport').valueChanges.subscribe((value: string) => {
			if (value) {
				let airport_selected = this.BigData?.airportsData.find(item => item.id == value)
				const airport_display = this.Form.dropoff_airport_option.value || this.getAirportDisplayValue(airport_selected);
				airport_selected && this.SetFormValue('dropoff_airport_name', airport_display);
				airport_selected && this.SetFormValue('dropoff_airport_latitude', this.Form.dropoff_airport_latitude.value || airport_selected.lat)
				airport_selected && this.SetFormValue('dropoff_airport_longitude', this.Form.dropoff_airport_longitude.value || airport_selected.long)
				this.SetFormValue('return_pickup_airport_option', airport_display);
				this.SetFormValue('return_pickup_airport_name', this.Form.dropoff_airport_name.value || airport_display);
				this.SetFormValue('return_pickup_airport_latitude', this.Form.dropoff_airport_latitude.value || airport_selected?.lat);
				this.SetFormValue('return_pickup_airport_longitude', this.Form.dropoff_airport_longitude.value || airport_selected?.long);
				this.SetFormValue('return_pickup_airport', value)
				this.MapController()
				if (this.Form.service_type.value == 'round_trip') {
					setTimeout(() => {
						this.MapController(true)
					}, 2000)
				}
			}
		})

		// Dropoff Airlines
		this.BookingForm.get('dropoff_airline').valueChanges.subscribe((value: string) => {
			let airline_selected = this.BigData?.airlinesData.find(item => item.id == value)
			this.SetFormValue('dropoff_airline_name', airline_selected.formatted_name);
			this.SetFormValue('return_pickup_airline_option', airline_selected);
			this.SetFormValue('return_pickup_airline', value);
		})

		// Return Pickup Airport
		this.BookingForm.get('return_pickup_airport').valueChanges.subscribe((value: string) => {
			console.log("value in pickup_airport--->", value)
			if (value == '3283') {
				this.BookingForm.get('return_pickup_airline_option').clearValidators();
				this.BookingForm.get('return_pickup_airline_option').updateValueAndValidity();
				setTimeout(() => this.retryGoogleAutocompleteInitialization(), 100);
			}
			if (value) {
				let airport_selected = this.BigData?.airportsData.find(item => item.id == value)
				const airport_display = this.Form.return_pickup_airport_option.value || this.getAirportDisplayValue(airport_selected);
				airport_selected && this.SetFormValue('return_pickup_airport_name', airport_display);
				airport_selected && this.SetFormValue('return_pickup_airport_latitude', this.Form.return_pickup_airport_latitude.value || airport_selected.lat);
				airport_selected && this.SetFormValue('return_pickup_airport_longitude', this.Form.return_pickup_airport_longitude.value || airport_selected.long);
				setTimeout(() => this.MapController(), 2000)
				if (this.Form.service_type.value == 'round_trip') {
					setTimeout(() => {
						this.MapController(true)
					}, 2000)
				}
			}
		})

		// Return Pickup Airlines
		this.BookingForm.get('return_pickup_airline').valueChanges.subscribe((value: string) => {
			if (value) {
				let airline_selected = this.BigData?.airlinesData.find(item => item.id == value)
				this.SetFormValue('return_pickup_airline_name', airline_selected.formatted_name);
			}
		})

		// Return Dropoff Airport
		this.BookingForm.get('return_dropoff_airport').valueChanges.subscribe((value: string) => {
			if (value) {
				let airport_selected = this.BigData?.airportsData.find(item => item.id == value);
				const airport_display = this.Form.return_dropoff_airport_option.value || this.getAirportDisplayValue(airport_selected);
				airport_selected && this.SetFormValue('return_dropoff_airport_name', airport_display);
				airport_selected && this.SetFormValue('return_dropoff_airport_latitude', this.Form.return_dropoff_airport_latitude.value || airport_selected.lat);
				airport_selected && this.SetFormValue('return_dropoff_airport_longitude', this.Form.return_dropoff_airport_longitude.value || airport_selected.long);
				setTimeout(() => this.MapController(), 2000)
				if (this.Form.service_type.value == 'round_trip') {
					setTimeout(() => {
						this.MapController(true)
					}, 2000)
				}
			}
		})

		// Return Dropoff Airlines
		this.BookingForm.get('return_dropoff_airline').valueChanges.subscribe((value: string) => {
			if (value) {
				let airline_selected = this.BigData?.airlinesData.find(item => item.id == value)
				this.SetFormValue('return_dropoff_airline_name', airline_selected.formatted_name);
			}
		})

		// Pickup Address
		this.BookingForm.get('pickup').valueChanges.subscribe((value: string) => {
			setTimeout(() => {
				this.SetFormValue('return_dropoff', value)
				this.SetFormValue('return_dropoff_latitude', this.Form.pickup_latitude.value)
				this.SetFormValue('return_dropoff_longitude', this.Form.pickup_longitude.value)
				this.MapController()
			}, 1000)
			if (this.Form.service_type.value == 'round_trip') {
				setTimeout(() => {
					this.MapController(true)
				}, 2000)
			}
		})

		// Dropoff Address
		this.BookingForm.get('dropoff').valueChanges.subscribe((value: string) => {
			setTimeout(() => {
				this.SetFormValue('return_pickup', value)
				this.SetFormValue('return_pickup_latitude', this.Form.dropoff_latitude.value)
				this.SetFormValue('return_pickup_longitude', this.Form.dropoff_longitude.value)
				this.MapController()
			}, 1000)
			if (this.Form.service_type.value == 'round_trip') {
				setTimeout(() => {
					this.MapController(true)
				}, 2000)
			}
		})
		// this.BookingForm.get('driver_id').valueChanges.subscribe((value: string) => {
		// 	this.DriverList
		// 	this.SetFormValue('driver_name', `${data.FirstName} ${data.MiddleName ?? ''} ${data.LastName}`)
		// 	this.SetFormValue('driver_gender', data.Gender)
		// 	this.SetFormValue('driver_cell', data.CellNumber)
		// 	this.SetFormValue('driver_cell_isd', data.CellIsd)
		// 	this.SetFormValue('driver_cell_country', data.CellNumberCountry)
		// 	this.SetFormValue('driver_email', data.Email)
		// 	this.SetFormValue('driver_phone_type', data.PhoneType ?? '');
		// 	this.driverCellTelInput.setCountry(this.BookingForm.get('driver_cell_country').value);
		// })


	}

	private isManualRateEntered(): boolean {
		if (!this.RatesForm) return false;

		const baseRate = this.RatesForm?.all_inclusive_rates?.Base_Rate;
		const baseRateValue = Number(baseRate?.baserate ?? 0);
		const amountValue = Number(baseRate?.amount ?? 0);

		// If admin has manually typed a base rate value, consider it manual
		return baseRateValue > 0 || amountValue > 0;
	}

	resetDriverAndVehicle(affiliate_type: string) {
		if (affiliate_type == 'loose_affiliate') {
			['vehicle_type', 'vehicle_id', 'vehicle_make', 'vehicle_model', 'vehicle_color', 'vehicle_year', 'driver_name', 'driver_email', 'driver_gender', 'driver_cell', 'vehicle_license_plate'].forEach((item: any) => {
				this.BookingForm.get(item).reset();
				this.BookingForm.updateValueAndValidity();
			})
			this.SetFormValue('driver_cell_isd', '+1');
			this.SetFormValue('driver_cell_country', 'us');
		}
	}

	resetReturnDriverAndVehicle(return_affiliate_type: string) {
		if (return_affiliate_type == 'loose_affiliate') {
			['return_vehicle_type', 'return_vehicle_id', 'return_vehicle_make', 'return_vehicle_model', 'return_vehicle_color', 'return_vehicle_year', 'return_driver_name', 'return_driver_email', 'return_driver_gender', 'return_driver_cell', 'return_vehicle_license_plate'].forEach((item: any) => {
				this.BookingForm.get(item).reset();
				this.BookingForm.updateValueAndValidity();
			})
			this.SetFormValue('return_driver_cell_isd', '+1');
			this.SetFormValue('return_driver_cell_country', 'us');
		}
	}

	RateFormValue(data: any) {
		// console.log('Rates Form: ', data)
		this.RatesForm = data
	}
	ReturnRateFormValue(data: any) {
		// console.log('Return Rates Form: ', data)
		this.ReturnRatesForm = data
	}
	HandleReturnNumberOfHr(data: any) {
		console.log('____<><><><><><><><>', data)
		this.BookingForm.get('number_of_hours').setValue(data);
		this.numberOfHoursError = false;
	}

	checkUniqueness() {
		this.$api.checkUniquePhoneNumberForLooseCustomer({
			phoneISD: this.LooseCustomer.phone_isd.value,
			phoneNumber: this.LooseCustomer.phone.value
		}).pipe(
			pluck('data'),
			pluck('is_exist')
		).subscribe((is_exist: boolean) => {
			// console.log(is_exist)
			this.is_loose_customer_unique = is_exist;
			return
		})
	}

	// fillLooseCustomerAddress(value: any) {
	// 	console.log('Addresss-->>>', value);
	// 	(<FormGroup>this.BookingForm.get('loose_customer')).get('address').setValue(value?.formatted_address);
	// 	value.address_components.forEach(component => {
	// 		const types = component.types;
	// 		if (types.includes('postal_code')) {
	// 			(<FormGroup>this.BookingForm.get('loose_customer')).get('zipCode').setValue(component.long_name);
	// 		} else if (types.includes('locality')) {
	// 			(<FormGroup>this.BookingForm.get('loose_customer')).get('city').setValue(component.long_name);
	// 		} else if (types.includes('administrative_area_level_1')) {
	// 			(<FormGroup>this.BookingForm.get('loose_customer')).get('state').setValue(component.long_name);
	// 		} else if (types.includes('country')) {
	// 			(<FormGroup>this.BookingForm.get('loose_customer')).get('country').setValue(component.long_name);
	// 		}
	// 	});
	// 	(<FormGroup>this.BookingForm.get('loose_customer')).updateValueAndValidity();
	// 	this.BookingForm.updateValueAndValidity();
	// }

	fillLooseCustomerAddress(place: any) {
		console.log('Addresss-->>>', place);

		const looseCustomerGroup = <FormGroup>this.BookingForm.get('loose_customer');
		const formattedAddress = place?.formatted_address ?? '';
		const placeName = place?.name ?? '';
		const displayAddress = placeName ? `${placeName} - ${formattedAddress}` : formattedAddress;
		looseCustomerGroup.get('address').setValue(displayAddress);

		place.address_components.forEach(component => {
			const types = component.types;
			if (types.includes('postal_code')) {
				looseCustomerGroup.get('zipCode').setValue(component.long_name);
			} else if (types.includes('locality')) {
				looseCustomerGroup.get('city').setValue(component.long_name);
			} else if (types.includes('administrative_area_level_1')) {
				looseCustomerGroup.get('state').setValue(component.long_name);
			} else if (types.includes('country')) {
				looseCustomerGroup.get('country').setValue(component.long_name);
			}
		});

		looseCustomerGroup.updateValueAndValidity();
		this.BookingForm.updateValueAndValidity();
	}


	onLCTeleCountryChange(event: any) {

		(<FormGroup>this.BookingForm.get('loose_customer')).get('phone_country').setValue(event.iso2);
		(<FormGroup>this.BookingForm.get('loose_customer')).get('phone_isd').setValue('+' + event.dialCode);
		console.log("in mobile", event.dialCode, event.iso2)
		this.BookingForm.updateValueAndValidity()
	}

	// onCountryChange(event, type)
	// {
	// 	console.log(event)
	// 	if (type == 'mobile')
	// 	{
	// 		console.log("in mobile",event.dialCode,event.iso2)
	// 		this.addIndividualAccountForm.patchValue({
	// 			mobileIsd: '+' + event.dialCode,
	// 			mobileCountry: event.iso2
	// 		});
	// 	}
	// 	else
	// 	{
	// 		this.addIndividualAccountForm.patchValue({
	// 			workIsd: '+' + event.dialCode,
	// 			workCountry: event.iso2
	// 		});
	// 	}
	// 	// console.log(this.countryCode);
	// }


	// addLineBreak(){
	// 	console.log('add line break __>>' , this.BookingForm.get('booking_instructions').value)
	// 	// this.BookingForm.patchValue({
	// 	// 	booking_instructions: this.BookingForm.get('booking_instructions').value +'\n'
	// 	// })
	// }

	EmailDomainValidator(): ValidatorFn {
		return (control: AbstractControl): ValidationErrors | null => {
			let value = control.value;
			console.log(value)
			if (!value) {
				return null
			}
			value = value.split('@')[1]
			let domain = value?.substring(value.indexOf('.') + 1)
			console.log(domain)
			const domains = ['com', 'net', 'in', 'co', 'uk', 'br', 'us']
			if (domains.includes(domain)) {
				return null
			}
			else if (domain?.includes('.')) {
				console.log(domain)
				return domain.split('.').every(item => domains.includes(item)) ? null : { domain: true }
			}
			else {
				return { domain: true }
			}
		}
	}

	iOS() {
		return [
			'iPad Simulator',
			'iPhone Simulator',
			'iPod Simulator',
			'iPad',
			'iPhone',
			'iPod'
		].includes(navigator.platform)
			// iPad on iOS 13 detection
			|| (navigator.userAgent.includes("Mac") && "ontouchend" in document)
	}


	showLocationPointOnMap(address: any) {
		let isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
		console.log('isSafari', isSafari)
		if (address) {
			let googleDirectionUrl;
			let iosDirectionUrl;
			googleDirectionUrl = 'https://www.google.com/maps/dir/?api=1' + '&destination=' +
				encodeURIComponent(address) + '&travelmode=driving'
			iosDirectionUrl = 'http://maps.apple.com/?daddr=' +
				encodeURIComponent(address)
			if (this.iOS()) {
				setTimeout(() => {
					window.location.href = iosDirectionUrl;
				})
			}
			else {
				window.open(googleDirectionUrl, '_blank');
			}
		} else {
			throw new Error('Error: Location Points Not Specified Properly. ');
		}
	}

	textFormatterTransferType(text: any) {
		try {
			return text.replace(/[\\\_$]+/g, ' ') + '?'
		}
		catch {
			return text
		}
	}

	getPreviewAirportDisplay(name: any, option: any): string {
		return this.getAirportDisplayValue(name) || this.getAirportDisplayValue(option) || '';
	}

	private getEditAirportDisplayValue(
		airportId: any,
		savedAirportLine: any
	): string {
		const savedDisplay = String(savedAirportLine || '').trim();
		if (savedDisplay) {
			return savedDisplay;
		}

		return this.getAirportDisplayValue(
			this.BigData?.airportsData?.find((item: any) => item.id == airportId)
		);
	}

	normalizeAirportCoordinatesInPayload(value: any) {
		const airportCoordinateFields = [
			'pickup_airport_latitude',
			'pickup_airport_longitude',
			'dropoff_airport_latitude',
			'dropoff_airport_longitude',
			'return_pickup_airport_latitude',
			'return_pickup_airport_longitude',
			'return_dropoff_airport_latitude',
			'return_dropoff_airport_longitude',
		];

		airportCoordinateFields.forEach((field) => {
			value[field] = this.BookingForm.get(field)?.value ?? value[field];
		});

		console.group('admin/new-booking airport coordinates payload');
		airportCoordinateFields.forEach((field) => {
			console.log(field, value[field]);
		});
		console.groupEnd();

		return value;
	}

	change(event: any, form_control: string) {
		console.log(event, form_control)
		//setting currency based on airport country
		// form_control == 'pickup_airport' || form_control == 'return_pickup_airport' ||
		if (form_control == 'dropoff_airport' || form_control == 'return_dropoff_airport') {
			console.log("in if form control airport then change currwency")
			this.httpClient.get("assets/json/currencyOptions.json").subscribe(data => {
				for (const key of Object.keys(data)) {
					if (data[key].countryName === event.country) {
						this.currencyObj = data[key]
						this.currencySymbol = data[key].symbol
					}
				}
			})
		}
		event && this.SetFormValue(form_control, event.id);
	}
	FormatTime(time: string) {
		return moment(time, "HH:mm:ss").format("LT");
	}

	setValueByBookNow() {
		if (this.updateType == 'reaffiliate') {
			console.log("in reaffiliate update type")
			this.$api.getBookingDataForEdit(this.Form.reservation_id.value, this.updateType).subscribe((response: any) => {
				response.data.booking_instructions = response.data.booking_instructions.replaceAll('<br />', '')
				console.log('response <><><><><', response.data)
				let editing_data = response.data
				delete editing_data.affiliate_id
				this.number_of_hours = response?.data?.number_of_hours === 0 ? 2 : response?.data?.number_of_hours
				this.isTravelShare = response?.data?.account_type == 'travel_planner' ? true : false
				if (response?.data?.account_type == 'travel_planner') {
					this.getTravelClientAccounts(response?.data?.acc_id)
				}
				this.autofillData('cruise', editing_data);
				console.log(editing_data, "check big data")
				for (let item in editing_data) {
					if (item.includes('extra_stops') || item.includes('languages') || item.includes('dresses') || item.toLowerCase().includes('amenities')) {
						// console.log('Skipping in the case of Extra Stops. ')
					}
					if (item == "passenger_cell_isd") {
						console.log('passenger_cell_isd-->>', item, editing_data[item])
						let value = editing_data[item].includes('+') ? editing_data[item] : '+'.concat(editing_data[item])
						this.SetFormValue(item, value);
					}
					if (editing_data[item] && item != "passenger_cell_isd" && item != "affiliate_type") {
						if (isNaN(Number(editing_data[item]))) {
							this.SetFormValue(item, editing_data[item]);
						} else {
							this.SetFormValue(item, Number(editing_data[item]));
						}
					}
				}

				this.SetFormValue('pickup_airport_option', this.getAirportDisplayValue(this.BigData.airportsData.find((item: any) => item.id == this.Form.pickup_airport.value)));
				this.SetFormValue('pickup_airline_option', this.BigData.airlinesData.find((item: any) => item.id == this.Form.pickup_airline.value));
				this.SetFormValue('dropoff_airport_option', this.getAirportDisplayValue(this.BigData.airportsData.find((item: any) => item.id == this.Form.dropoff_airport.value)));
				this.SetFormValue('dropoff_airline_option', this.BigData.airlinesData.find((item: any) => item.id == this.Form.dropoff_airline.value));
				this.SetFormValue('return_pickup_airport_option', this.getAirportDisplayValue(this.BigData.airportsData.find((item: any) => item.id == this.Form.return_pickup_airport.value)));
				this.SetFormValue('return_pickup_airline_option', this.BigData.airlinesData.find((item: any) => item.id == this.Form.return_pickup_airline.value));
				this.SetFormValue('return_dropoff_airport_option', this.getAirportDisplayValue(this.BigData.airportsData.find((item: any) => item.id == this.Form.return_dropoff_airport.value)));
				this.SetFormValue('return_dropoff_airline_option', this.BigData.airlinesData.find((item: any) => item.id == this.Form.return_dropoff_airline.value));

				if (editing_data.driver_image) {
					this.SetFormValue('driver_image_id', editing_data.driver_image.id);
					this.driver_image['image'] = editing_data.driver_image.image;
				}
				if (editing_data.vehicle_image) {
					this.SetFormValue('vehicle_image_id', editing_data.vehicle_image.id);
					this.vehicle_image['image'] = editing_data.vehicle_image.image;
				}


				this.prefillExtraStops(editing_data.extra_stops);
				this.prefillExtraStops(editing_data.return_extra_stops, true);
				this.BookingForm.updateValueAndValidity()

				// override specific value
				this.BookingForm.patchValue({
					service_type: response.data.service_type == 'oneway' ? 'one_way' : response.data['service_type'] == 'roundtrip' ? 'round_trip' : 'charter_tour',
				})

				try {
					this.PaxTelObject.setCountry(this.BookingForm.get('passenger_cell_country').value);
				} catch {
					console.error('Set Country Value is null.')
				}

				this.$spinner.hide('normalspinner')
				console.log('<<<<<<<<<<<-----------set pickup date------->>>>', moment().format('YYYY-MM-DD'), this.updateType)
				if (this.updateType == 'edit') {
					this.scroll('pickup_adress')
					// this.SetFormValue('pickup_date', moment().format('YYYY-MM-DD'))
					this.SetFormValue('pickup_date', editing_data?.pickup_date)
				}
				if (this.updateType == 'repeat' || this.updateType == 'return' || this.updateType == 'round') {
					this.scroll('pickup_adress')
					if (new Date(editing_data?.pickup_date).getTime() < new Date().getTime()) {
						this.SetFormValue('pickup_date', moment().format('YYYY-MM-DD'))
					}
					else {
						this.SetFormValue('pickup_date', editing_data?.pickup_date)
					}
				}
			})
		}
		let QB: any = JSON.parse(localStorage.getItem('quotebot_form'))
		let selected_vehicle: any = JSON.parse(sessionStorage.getItem('selected_vehicle'))
		const isMasterVehicleQuoteFlow = this.route_is_master_vehicle === true || selected_vehicle?.is_master_vehicle === true;
		const resolvedMasterVehicleId = Number(selected_vehicle?.id || selected_vehicle?.ID || this.route_vehicle_id || 0);
		const normalizedSelectedVehicle = this.normalizeMasterVehicleForPrefill(selected_vehicle);
		// for (const key in QB) {
		//   console.log(`QB______${key}: ${QB[key]}`);
		//   this.SetFormValue(key ,QB[key])
		// }    
		this.affiliate_id = selected_vehicle?.affiliate_id
		this.veh_created_by = selected_vehicle?.created_by
		this.is_master_vehicle = this.route_is_master_vehicle ?? selected_vehicle?.is_master_vehicle ?? this.is_master_vehicle
		this.number_of_hours = QB?.booking_hour ? Number(QB?.booking_hour) : 2

		if (selected_vehicle?.created_by != 1) {
			console.log("in affiliate info")
			this.booking_created_from == 'subscriber'
			this.BookingForm.patchValue({
				susbcriber_name: selected_vehicle?.affiliate_name,
				// driver_name: this.currentUser?.name,
				// driver_email: this.currentUser.email,
				// driver_cell_isd: this.currentUser?.isd,
				// driver_cell: this.currentUser?.phone,
				// driver_cell_country: this.currentUser?.phoneCountry
			})

			if (this.service_type == 'round_trip') {
				this.BookingForm.patchValue({
					return_susbcriber_name: selected_vehicle?.affiliate_name,
				})
			}
		}
		else if (selected_vehicle?.created_by == 1 && this.currentUser?.created_by_role == 'subscriber') {
			this.isFarmoutBooking = true
			this.booking_created_from == 'admin'
			this.BookingForm.patchValue({
				susbcriber_name: selected_vehicle?.affiliate_name,
			})
			if (this.service_type == 'round_trip') {
				this.BookingForm.patchValue({
					return_susbcriber_name: selected_vehicle?.affiliate_name,
				})
			}
		}

		this.currencyObj = JSON.parse(sessionStorage.getItem('currencyData'))
		this.currencySymbol = this.currencyObj?.symbol
		//dropOFF
		this.service_type = QB?.service_type || 'one_way'
		this.SetFormValue('service_type', this.service_type, false)
		if (QB?.service_type == 'charter_tour') {
			this.SetFormValue('number_of_hours', QB?.booking_hour ? Number(QB?.booking_hour) : 2, false)
			this.number_of_hours = QB?.booking_hour ? Number(QB?.booking_hour) : 2
		}

		if (isMasterVehicleQuoteFlow) {
			this.BookingForm.patchValue({
				affiliate_type: 'loose_affiliate',
				affiliate_id: '',
				loose_affiliate_id: '',
				return_affiliate_type: 'loose_affiliate',
				return_affiliate_id: '',
				return_loose_affiliate_id: ''
			});
		} else {
			this.SetFormValue('affiliate_type', 'affiliate');
			this.SetFormValue('affiliate_id', this.affiliate_id);
			if (this.service_type === 'round_trip') {
				this.SetFormValue('return_affiliate_id', this.affiliate_id);
			}
		}

		//set no of vehicles
		this.SetFormValue('number_of_vehicles', normalizedSelectedVehicle?.number_of_vehicles ?? selected_vehicle?.number_of_vehicles)
		this.prefillVehiclePreferencesFromMasterVehicle(normalizedSelectedVehicle);
		if (this.service_type === 'round_trip') {
			this.prefillVehiclePreferencesFromMasterVehicle(normalizedSelectedVehicle, true);
		}
		if (isMasterVehicleQuoteFlow && resolvedMasterVehicleId > 0) {
			this.loadMasterVehicleInfoForQuoteBot(resolvedMasterVehicleId);
			if (this.service_type === 'round_trip') {
				this.loadMasterVehicleInfoForQuoteBot(resolvedMasterVehicleId, true);
			}
		}
		// set cancellation period without breaking master-vehicle prefill
		const fallbackCancellationHours =
			normalizedSelectedVehicle?.cancellation_policy ??
			normalizedSelectedVehicle?.non_charter_cancellation_hours ??
			normalizedSelectedVehicle?.charter_cancellation_hours ??
			selected_vehicle?.cancellation_policy ??
			selected_vehicle?.non_charter_cancellation_hours ??
			selected_vehicle?.charter_cancellation_hours ??
			this.BookingForm.get('cancellation_hours')?.value;
		if (fallbackCancellationHours !== undefined && fallbackCancellationHours !== null && fallbackCancellationHours !== '') {
			this.BookingForm.patchValue({
				cancellation_hours: fallbackCancellationHours.toString(),
				return_cancellation_hours: fallbackCancellationHours.toString()
			}, { emitEvent: false })
		} else {
			console.warn('QB -> admin/new-booking prefill missing cancellation policy on selected vehicle', selected_vehicle);
		}
		let transfer_type_value = QB?.pickup_type + '_to_' + QB?.dropoff_type
		let return_transfer_type_value = (QB?.return_pickup_type || QB?.dropoff_type) + '_to_' + (QB?.return_dropoff_type || QB?.pickup_type)
		this.isPrefillingTransferTypes = true;
		this.transfer_type = transfer_type_value
		this.return_transfer_type = return_transfer_type_value
		console.group('QB -> admin/new-booking prefill')
		console.log('quotebot_form snapshot', QB)
		console.log('selected_vehicle snapshot', selected_vehicle)
		console.log('selected_vehicle is_master_vehicle', selected_vehicle?.is_master_vehicle)
		console.log('route is_master_vehicle', this.route_is_master_vehicle)
		console.log('component is_master_vehicle before transfer apply', this.is_master_vehicle)
		console.log('derived service_type', this.service_type)
		console.log('derived transfer_type', transfer_type_value)
		console.log('derived return_transfer_type', return_transfer_type_value)
		console.log('isPrefillingTransferTypes before set', this.isPrefillingTransferTypes)
		this.SetFormValue('transfer_type', transfer_type_value, false)
		this.SetFormValue('return_transfer_type', return_transfer_type_value, false)
		this.changeTransferType(transfer_type_value)
		this.changeReturnTransferType(return_transfer_type_value)
		if (this.service_type === 'round_trip') {
			this.init_return_rates = false;
			this.retryGoogleAutocompleteInitialization();
			if (!isMasterVehicleQuoteFlow) {
				this.BookingForm.patchValue({
					return_affiliate_id: this.affiliate_id
				}, { emitEvent: false });
			}
			this.updateReturnLegValidators(return_transfer_type_value);
			setTimeout(() => {
				this.init_return_rates = true;
				this.buildBookingData();
				this.MapController(true);
			}, 0);
		}
		console.log('post-apply form service_type', this.BookingForm.get('service_type')?.value)
		console.log('post-apply form transfer_type', this.BookingForm.get('transfer_type')?.value)
		console.log('post-apply form return_transfer_type', this.BookingForm.get('return_transfer_type')?.value)
		console.log('post-apply component service_type', this.service_type)
		console.log('post-apply component transfer_type', this.transfer_type)
		console.log('post-apply component return_transfer_type', this.return_transfer_type)
		console.groupEnd()
		setTimeout(() => {
			this.isPrefillingTransferTypes = false;
			console.log('QB -> admin/new-booking prefill guard released', {
				form_transfer_type: this.BookingForm.get('transfer_type')?.value,
				form_return_transfer_type: this.BookingForm.get('return_transfer_type')?.value,
				component_transfer_type: this.transfer_type,
				component_return_transfer_type: this.return_transfer_type
			});
			this.logTransferTypeState('post-prefill-render');
		}, 0)
		this.SetFormValue('total_passengers', QB?.no_of_luggage)
		this.SetFormValue('luggage_count', QB?.no_of_passenger)
		//vehicle id when chossing vehicle from Quote bot screen
		this.QB_vehicle_id = normalizedSelectedVehicle?.id || this.route_vehicle_id || null
		//pickup
		const matchedPickupAirport = this.resolveInternalAirportRecord({
			name: QB?.other_details?.pickup_airport_name,
			formatted_address: QB?.other_details?.pickup_airport_name
		}, QB?.pickup_airport_lat, QB?.pickup_airport_long);
		const matchedDropoffAirport = this.resolveInternalAirportRecord({
			name: QB?.other_details?.dropoff_airport_name,
			formatted_address: QB?.other_details?.dropoff_airport_name
		}, QB?.dropoff_airport_lat, QB?.dropoff_airport_long);
		const matchedReturnPickupAirport = this.resolveInternalAirportRecord({
			name: QB?.return_pickup_airport_name || QB?.other_details?.return_pickup_airport_name,
			formatted_address: QB?.return_pickup_airport_name || QB?.other_details?.return_pickup_airport_name
		}, QB?.return_pickup_airport_lat, QB?.return_pickup_airport_long);
		const matchedReturnDropoffAirport = this.resolveInternalAirportRecord({
			name: QB?.return_dropoff_airport_name || QB?.other_details?.return_dropoff_airport_name,
			formatted_address: QB?.return_dropoff_airport_name || QB?.other_details?.return_dropoff_airport_name
		}, QB?.return_dropoff_airport_lat, QB?.return_dropoff_airport_long);

		this.SetFormValue('pickup_date', moment(QB?.pickup_date).format('YYYY-MM-DD'))
		this.SetFormValue('pickup', QB?.pickup_address)
		this.SetFormValue('pickup_latitude', QB?.pickup_address_lat)
		this.SetFormValue('pickup_longitude', QB?.pickup_address_long)
		this.SetFormValue('pickup_airport_option', QB?.other_details?.pickup_airport_name)
		this.SetFormValue('pickup_airport_name', QB?.other_details?.pickup_airport_name)
		this.SetFormValue('pickup_airport_latitude', QB?.pickup_airport_lat)
		this.SetFormValue('pickup_airport_longitude', QB?.pickup_airport_long)
		this.SetFormValue('pickup_airport', matchedPickupAirport?.id ?? QB?.pickup_airport)
		this.SetFormValue('dropoff', QB?.dropoff_address)
		this.SetFormValue('dropoff_latitude', QB?.dropoff_address_lat)
		this.SetFormValue('dropoff_longitude', QB?.dropoff_address_long)
		this.SetFormValue('dropoff_airport_option', QB?.other_details?.dropoff_airport_name)
		this.SetFormValue('dropoff_airport_name', QB?.other_details?.dropoff_airport_name)
		this.SetFormValue('dropoff_airport_latitude', QB?.dropoff_airport_lat)
		this.SetFormValue('dropoff_airport_longitude', QB?.dropoff_airport_long)
		this.SetFormValue('dropoff_airport', matchedDropoffAirport?.id ?? QB?.dropoff_airport)
		// this.SetFormValue('dropoff_airline_option', QB?.dropoff_airline);


		//return pickup
		this.SetFormValue('return_pickup_date', moment(QB?.return_pickup_date).format('YYYY-MM-DD'))
		this.SetFormValue('return_pickup', QB?.return_pickup_address)
		this.SetFormValue('return_pickup_latitude', QB?.return_pickup_address_lat)
		this.SetFormValue('return_pickup_longitude', QB?.return_pickup_address_long)
		this.SetFormValue('return_pickup_airport_option', QB?.return_pickup_airport_name || QB?.other_details?.return_pickup_airport_name)
		this.SetFormValue('return_pickup_airport_name', QB?.return_pickup_airport_name || QB?.other_details?.return_pickup_airport_name)
		this.SetFormValue('return_pickup_airport_latitude', QB?.return_pickup_airport_lat)
		this.SetFormValue('return_pickup_airport_longitude', QB?.return_pickup_airport_long)
		this.SetFormValue('return_pickup_airport', matchedReturnPickupAirport?.id ?? QB?.return_pickup_airport)

		//return dropOff
		this.SetFormValue('return_dropoff', QB?.return_dropoff_address)
		this.SetFormValue('return_dropoff_latitude', QB?.return_dropoff_address_lat)
		this.SetFormValue('return_dropoff_longitude', QB?.return_dropoff_address_long)
		this.SetFormValue('return_dropoff_airport_option', QB?.return_dropoff_airport_name || QB?.other_details?.return_dropoff_airport_name)
		this.SetFormValue('return_dropoff_airport_name', QB?.return_dropoff_airport_name || QB?.other_details?.return_dropoff_airport_name)
		this.SetFormValue('return_dropoff_airport_latitude', QB?.return_dropoff_airport_lat)
		this.SetFormValue('return_dropoff_airport_longitude', QB?.return_dropoff_airport_long)
		this.SetFormValue('return_dropoff_airport', matchedReturnDropoffAirport?.id ?? QB?.return_dropoff_airport)
		this.prefillExtraStops(QB?.extra_stops);
		this.prefillExtraStops(QB?.return_extra_stops, true);
		this.BookingForm.updateValueAndValidity();
		this.SetFormValue('pickup_time', this.FormatTime(QB?.pickup_time))
		this.SetFormValue('return_pickup_time', this.FormatTime(QB?.return_pickup_time))
		this.SetFormValue('cruise_time', this.FormatTime(QB?.pickup_time))
		this.SetFormValue('return_cruise_time', this.FormatTime(QB?.return_pickup_time))
		if (QB?.pickup_type == 'airport') {
			let location = {
				latitude: QB?.pickup_airport_lat,
				longitude: QB?.pickup_airport_long
			}
			this.fillLocationPoints('airport', location)
		}
		this.refreshMapIfRouteReady()
		if (this.service_type === 'round_trip') {
			this.refreshMapIfRouteReady(true)
		}
		if (this.service_type === 'round_trip') {
			setTimeout(() => {
				this.BookingForm.get('service_type')?.setValue('round_trip');
			}, 0);
		}
		setTimeout(() => {
			console.log('settimeout finction---------------------------------------------------------------')
			if (!isMasterVehicleQuoteFlow) {
				this.fetchQBAffiliateVehicles(selected_vehicle?.affiliate_id)
				this.fetchAffiliateDrivers(this.affiliate_id)
			}
		}, 5000)
	}

	// numbers in red and seperated to next line
	highlightNumbers(text: string): string {
		const parts = text.split(/\b(\d+\.\s)/); // Split by number followed by dot and space

		// Process parts and apply formatting
		let formattedText = '';
		for (let i = 0; i < parts.length; i++) {
			if (i % 2 === 0) {
				formattedText += parts[i]; // Regular text part
			} else {
				formattedText += `<br><span class="text-danger font-weight-bolder">${parts[i]}</span>`; // Numbered instruction part
			}
		}

		return formattedText;
	}

	// Method to convert hours to days and hours
	getCancellationTime(cancellationHours: number): string {
		if (cancellationHours > 24) {
			const days = Math.floor(cancellationHours / 24);
			const remainingHours = cancellationHours % 24;
			return `${days} days ${remainingHours} hours`;
		} else {
			return `${cancellationHours} hours`;
		}
	}

	onSearchLooseAffiliateId(term, item) {
		console.log("term", term, "item", item)
		return item.name.toLowerCase().includes(term.toLowerCase()) || item.driver_phone.toString().includes(term)
	}

	onSearchCancellation(term, item) {
		console.log("term", term, "item", item)
		return item.label.toLowerCase().startsWith(term.toLowerCase())
	}

	onSearchLooseAffId(term, item) {
		console.log("term", term, "item", item)
		return item.name.toLowerCase().startsWith(term.toLowerCase()) || item.driver_phone.startsWith(term)
	}


	private addCustomCountrySearch(element: HTMLElement) {
		element.addEventListener('open:countrydropdown', () => {
			const container = element.closest('.iti');
			const dropdown = container?.querySelector('.iti__country-list');
			if (!dropdown) return;

			// Check if search already exists
			if (dropdown.querySelector('.iti-search-input')) return;

			// Create search container
			const searchContainer = document.createElement('div');
			searchContainer.className = 'iti-search-container';

			// Create search input
			const searchInput = document.createElement('input');
			searchInput.type = 'text';
			searchInput.className = 'iti-search-input';
			searchInput.placeholder = 'Search country...';

			searchContainer.appendChild(searchInput);

			// Prevent dropdown from closing when interacting with search
			searchInput.addEventListener('click', (e) => e.stopPropagation());
			searchInput.addEventListener('keydown', (e) => e.stopPropagation());

			// Insert at top of dropdown
			dropdown.insertBefore(searchContainer, dropdown.firstChild);

			// Focus on search
			setTimeout(() => searchInput.focus(), 100);

			// Filter countries on input
			searchInput.addEventListener('input', (e: any) => {
				e.stopPropagation();
				const searchTerm = e.target.value.toLowerCase();
				const countries = dropdown.querySelectorAll('.iti__country');
				let hasVisible = false;

				countries.forEach((country: any) => {
					// Search in the full text (Name + Dial Code)
					const text = country.textContent?.toLowerCase() || '';

					if (text.includes(searchTerm)) {
						country.classList.remove('iti__hide');
						country.style.display = 'block'; // Force show
						hasVisible = true;
					} else {
						country.classList.add('iti__hide');
						country.style.display = 'none'; // Force hide
					}
				});

				// Handle No Results
				let noResults = dropdown.querySelector('.iti-no-results');
				if (!noResults) {
					noResults = document.createElement('div');
					noResults.className = 'iti-no-results';
					noResults.textContent = 'No results found';
					dropdown.appendChild(noResults);
				}

				if (!hasVisible && searchTerm) {
					(noResults as HTMLElement).style.display = 'block';
				} else {
					(noResults as HTMLElement).style.display = 'none';
				}

				// Show all if search is empty
				if (!searchTerm) {
					countries.forEach((country: any) => {
						country.classList.remove('iti__hide');
						country.style.display = 'block';
					});
					(noResults as HTMLElement).style.display = 'none';
				}
			});
		});
	}
}
