import { MapUtils } from '../../../utils/map-utils';
import { attachPlaceAutocompleteElement, clearPlaceAutocompleteDisplay, getBookingAddressSyncControl, syncPlaceAutocompleteDisplay } from '../../../utils/google-place-autocomplete';
import { Component, EventEmitter, Input, OnInit, OnDestroy, Output, ViewChild, isDevMode, ElementRef, ViewChildren, QueryList, viewChild, NgZone, HostListener } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormControl, FormArray, ValidationErrors, ValidatorFn, AbstractControl } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { pluck, distinctUntilChanged, takeUntil, debounceTime, map } from 'rxjs/operators';

import { AdminService } from '../../../services/admin.service';
import { IndividualService } from '../../../services/individual.service';
import { TravelAgentService } from '../../../services/travel-agent.service';
import { SharedModule } from '../shared.module'
import { NgxSpinnerService } from 'ngx-spinner';
import { ErrorDialogService } from '../../../services/error-dialog/errordialog.service';
import moment from 'moment';
import { Observable, of, Subject, Subscription } from 'rxjs';
import { CustomvalidationService } from '../../../services/customvalidation.service';
import { param } from 'jquery';
import { CommonService } from '../../../services/common.service';
import { HttpClient } from '@angular/common/http';
import { constant_data } from '../../../../assets/js/data';
import { GoogleMap } from '@angular/google-maps';
import * as intlTelInput from 'intl-tel-input';
import { P } from '@angular/cdk/keycodes';
import { NgIf } from '@angular/common';
import { AffiliateService } from '../../../services/affiliate.service';
import { QuotebotService } from '../../../services/quotebot.service';
import { InvalidControlScrollDirective } from '../../../directives/scroll-to-invalid.directive';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { BookingTripPreviewComponent } from '../booking-trip-preview/booking-trip-preview.component';
import {
	AffiliateLookupParams,
	AffiliateLookupState,
	RankedAffiliate,
	affiliateRankBadge,
	affiliateRankModifier,
	affiliateStepBadge,
	affiliateStepModifier,
	buildRankedAffiliateLabel,
	createAffiliateLookupState,
	formatAffiliateDistance,
	readAffiliateLookupResponse
} from '../../../utils/affiliate-lookup';

declare var $: any
console.log('BookingComponent new version form ,,,loaded');

export type BookingComponentMode = 'admin' | 'individual' | 'travel-agent' | 'affiliate' | 'guest';

@Component({
	selector: 'app-booking',
	templateUrl: './booking.component.html',
	styleUrls: ['./booking.component.scss'],
})
export class BookingComponent implements OnInit, OnDestroy {
	/** Which portal is hosting this component. Drives accounts/affiliate visibility and API selection. */
	@Input() mode: BookingComponentMode = 'admin';

	get isAdminMode(): boolean {
		return this.mode === 'admin';
	}

	get shouldBlockAdminApi(): boolean {
		return this.mode !== 'admin';
	}

	get isIndividualMode(): boolean {
		return this.mode === 'individual';
	}

	get isTravelAgentMode(): boolean {
		return this.mode === 'travel-agent';
	}

	get isAffiliateMode(): boolean {
		return this.mode === 'affiliate';
	}

	/** Unauthenticated quotebot visitor. No currentUser, no portal APIs. */
	get isGuestMode(): boolean {
		return this.mode === 'guest';
	}

	get userRole(): string {
		if (this.isAffiliateMode || this.currentUser?.roleName === 'affiliate' || this.currentUser?.role === 'affiliate') {
			return 'affiliate';
		}
		if (this.isAdminMode || this.currentUser?.roleName === 'admin' || this.currentUser?.role === 'admin') {
			return 'admin';
		}
		if (this.isTravelAgentMode || this.currentUser?.roleName === 'travel_agent' || this.currentUser?.role === 'travel_agent') {
			return 'travel_agent';
		}
		if (this.isGuestMode) {
			return 'guest';
		}
		return 'individual';
	}

	/**
	 * loose_customer controls that must never be auto-marked required.
	 * country/state/city/zipCode have no input in the template — they are only
	 * ever filled as a side effect of picking a Google Places suggestion for the
	 * address — so requiring them makes the form permanently invalid with no
	 * visible error to correct.
	 */
	private readonly looseCustomerOptionalFields = ['middle_name', 'address', 'country', 'state', 'city', 'zipCode'];

	/**
	 * Modes that pick a vehicle through the embedded quote instead of assigning an
	 * affiliate/vehicle/driver manually. These have no access to the admin account
	 * lookups and never see affiliate internals or the rate distribution.
	 */
	get usesQuoteFlow(): boolean {
		return this.isIndividualMode || this.isTravelAgentMode || this.isGuestMode;
	}

	// @ViewChildren('autoInput') autoInputs!: QueryList<ElementRef>;
	/** Owns "scroll to the first invalid field"; also triggers itself on ngSubmit. */
	@ViewChild(InvalidControlScrollDirective) invalidControlScroll!: InvalidControlScrollDirective;
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
	@ViewChild('in_progress_phoneInput') in_progress_phoneInput!: ElementRef;
	inProgressPhoneTelInput: any;
	/** Shared receipt modal reused by the Preview button instead of the inline #previewBooking markup. */
	@ViewChild('bookingPreviewModal') bookingPreviewModal!: BookingTripPreviewComponent;

	/* ---------- Section navigator (fixed "On this page" panel) ---------- */
	sectionNavOpen = false;
	visibleSections: { key: string; label: string }[] = [];
	activeSectionIndex = 0;
	/** Ignores scroll-spy active updates until this time (ms, performance.now). */
	private sectionNavClickLockUntil = 0;

	private readonly sectionNavDefs: { key: string; label: () => string }[] = [
		{ key: 'client-accounts', label: () => this.isAdminMode || this.isAffiliateMode ? 'Client Accounts' : 'Accounts Information' },
		{ key: 'passenger-information', label: () => 'Passenger Information' },
		{ key: 'booking-details', label: () => 'Booking Details' },
		{ key: 'vehicle-affiliate', label: () => 'Vehicle & Affiliate' },
		{ key: 'transportation-details', label: () => 'Transportation Details' },
		{ key: 'return-booking', label: () => 'Return Booking' },
		{ key: 'return-affiliate-details', label: () => 'Return Vehicle & Affiliate' },
		{ key: 'rates', label: () => 'Rates' },
	];
	private sectionNavRafId: number | null = null;
	private sectionNavScrollListener = () => this.scheduleSectionNavUpdate();

	todays_date: string = moment().format('YYYY-MM-DD');
	time_values: Array<any> = constant_data.time_values

    hour_values: Array<any> = constant_data.hour_values   // ADD THIS

	booking_params: any = {
		transfer_types: ["airport_to_city", "airport_to_airport", "airport_to_cruise", "city_to_city", "city_to_airport", "city_to_cruise", "cruise_to_airport", "cruise_to_city"],
		client_account_types: ['individual', 'travel_planner', 'loose_customer'],
		client_account_types_subscriber: ['individual', 'loose_customer'],
		affiliate_accounts: ["affiliate", "loose_affiliate", "in_progress_affiliate"],
		
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
	driver_info: any = null;
	driverImgUrl: string = '';
	vehicleImgUrl: string = '';


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
	selectedPendingAffiliate: Record<string, any> = null
	selectedReturnPendingAffiliate: Record<string, any> = null
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
	ClientAccounts_Original: Array<Record<string, any>> = []
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
	isUserManualSelection: boolean = false;
	isUserManualReturnSelection: boolean = false;
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
	/** Set when the last outbound route contained a zero-distance leg on a non-charter booking. */
	hasInvalidRoutePoint: boolean = false;
	/** Set when the last return route contained a zero-distance leg on a non-charter booking. */
	hasInvalidReturnRoutePoint: boolean = false;
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
	number_of_hours: any = 2;
	// Embedded quote (Vehicle & Affiliate section): 'browse' uses the quotebot
	// drill-down, 'manual' uses the existing affiliate/vehicle/driver dropdowns.
	vehicleSelectionTab: 'browse' | 'manual' = 'manual';
	quotePayload: any = null;
	quoteLoading: boolean = false;
	confirmMsg: any;
	hasConfirmed24HourWarning: boolean = false;
	pendingSubmitPreview?: boolean;
	booking_data: any;
	// Bumped on explicit vehicle/affiliate picks so rates-form re-fetches even when
	// every other booking_data field is unchanged (e.g. re-selecting the same vehicle).
	rateRefreshToken: number = 0;
	extraStops_rate: any = 0
	/** Outbound stops beyond this count make the trip charter work rather than a transfer. */
	private readonly charterTourStopThreshold: number = 2;
	/** Set when the stop count promoted the service type on its own, so the UI can explain it. */
	autoConvertedToCharterTour: boolean = false;
	selectedVehicle: any;
	return_selectedVehicle: any;
	is_master_vehicle: boolean = JSON.parse(sessionStorage.getItem('selected_vehicle'))?.is_master_vehicle || false
	route_is_master_vehicle: boolean | null = null
	isTravelShare: boolean = false
	travelStaffAccounts: any;
	travelStaffAccounts_Original: any;
	subAgentAccounts: any;
	subAgentAccounts_Original: any;
	manual_change_aff_veh: boolean = false;
	isCreatedByAdmin: boolean = true;
	shareArray: any;
	r_shareArray: any;
	adminSharePercent: number = 25;
	isFarmoutBooking: boolean = false;
	private isPrefillingForm: boolean = false;
	private isPrefillingTransferTypes: boolean = false;
	/**
	 * Server-side affiliate lookup state, one set per leg.
	 *
	 * The list is searched, ranked by distance from the pickup and paged by the
	 * API, so the component holds only the pages it has actually loaded rather
	 * than the full affiliate table.
	 */
	affiliateLookup: AffiliateLookupState = createAffiliateLookupState();
	returnAffiliateLookup: AffiliateLookupState = createAffiliateLookupState();
	/**
	 * Bound to ng-select's `[typeahead]`, which both feeds us the term and
	 * switches the dropdown off its own client-side filtering - without that
	 * it would filter the server's results a second time and hide rows that
	 * matched on a field the label does not show (phone, driver name).
	 */
	affiliateTypeahead$ = new Subject<string>();
	returnAffiliateTypeahead$ = new Subject<string>();
	/** Rows per page for the affiliate dropdown's infinite scroll. */
	private readonly affiliatePageSize = 50;
	/** Debounce on affiliate search keystrokes, in ms. */
	private readonly affiliateSearchDebounceMs = 300;
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
	/** Emits whenever form valueChanges subscriptions are (re)wired, tearing down the previous set to avoid duplicates. */
	private formSubscriptionsReset$ = new Subject<void>();
	private queryParamsSubscription: Subscription;
	/** Tracks the countrychange handler per tel input so re-initialization replaces (not stacks) listeners. */
	private countryChangeHandlers = new Map<HTMLElement, () => void>();
	/** Route map panels start collapsed; the map only initializes when expanded. */
	isRouteMapVisible = true;
	isReturnRouteMapVisible = true;
	targetFocusElementId: string = null;

	constructor(
		private $form: FormBuilder,
		private $api: AdminService,
		private individualService: IndividualService,
		private TravelAgentService: TravelAgentService,
		private $shared: SharedModule,
		private $spinner: NgxSpinnerService,
		private $errors: ErrorDialogService,
		private $router: Router,
		private $routeurl: ActivatedRoute,
		private commonServices: CommonService,
		private customValidator: CustomvalidationService,
		private el: ElementRef,
		private httpClient: HttpClient,
		private affiliateService: AffiliateService,
		private $quotebot: QuotebotService,
		private zone: NgZone,
	) { }

	ngOnInit(): void {
		this.currentUser = JSON.parse(localStorage.getItem("currentUser"))
		if (this.isTravelAgentMode) {
			this.isTravelShare = true;
			this.isCreatedByAdmin = false;
		}
		if (this.isAffiliateMode) {
			this.isCreatedByAdmin = false;
			this.booking_params.client_account_types = ['individual', 'loose_customer'];
			this.booking_params.affiliate_accounts = ["affiliate"];
			this.isFarmoutBooking = true;
		}
		if (this.isGuestMode) {
			// an unregistered visitor has no account to book against — always a new
			// loose customer, and the backend creates the account from those details
			this.isCreatedByAdmin = false;
			this.booking_params.client_account_types = ['loose_customer'];
		}
		// build the form first
		this.buildBookingForm()
		this.queryParamsSubscription = this.$routeurl.queryParams.subscribe((params: any) => {
			if (params?.focus || this.$routeurl.snapshot.fragment) {
				this.targetFocusElementId = params?.focus || this.$routeurl.snapshot.fragment;
			}
			// Guests have no reservation-read endpoint, so edit/repeat/return/reaffiliate
			// can only half-load. Send them back to the quote instead of rendering a
			// form that silently drops the booking they think they are editing.
			if (this.isGuestMode && (params?.bookingId || params?.reaffiliate_book_id)) {
				this.$router.navigate(['/quotebot/select-vehicle']);
				return;
			}
			const isNewBookingFlow = params?.new === true || params?.new === 'true';
			const hasMasterVehicleParam = params?.is_master_vehicle !== undefined;
			const routeIsMasterVehicle = params?.is_master_vehicle === true || params?.is_master_vehicle === 'true';
			if (params && params.bookingId && !this.booking_id) {
				this.is_booking_edit_case = true
				this.updateType = params.updateType
				this.SetFormValue('reservation_id', params.bookingId)
				params.updateType ? this.SetFormValue('updateType', params.updateType) : this.SetFormValue('updateType', 'edit')
				this.isAdminMode && this.BookingForm.get('prevent_rate_override')?.setValue(this.updateType === 'edit');
				// arriving with an existing booking -> fields are prefilled, show manual tab
				this.vehicleSelectionTab = 'manual';
				this.checkAndPrefill();
			}
			else if (params && isNewBookingFlow) {
				// coming from edit -> create should not retain edit state
				this.updateType = 'create'
				this.SetFormValue('updateType', 'create')
				this.BookingForm.get('prevent_rate_override')?.setValue(false);
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
				this.SetFormValue('reservation_id', params.reaffiliate_book_id)
				this.vehicleSelectionTab = 'manual';
				this.checkAndPrefill();
			}
			else {
				// fresh booking -> default to the embedded quote browser
				this.updateType = 'create'
				this.SetFormValue('updateType', 'create')
				this.BookingForm.get('prevent_rate_override')?.setValue(false);
				this.vehicleSelectionTab = 'manual';
				this.resetFields()
			}
			// this.currencyObj = JSON.parse(sessionStorage.getItem('currencyData')) ? JSON.parse(sessionStorage.getItem('currencyData')) : null
			this.currencySymbol = JSON.parse(localStorage.getItem('currencySymbol'))

			// place in query params to reinitialise things when modes of new and edit are toggled
			// Subscriptions
			this.Subscriptions()
			if (this.isIndividualMode) {
				// individual portal: the booking is always for the logged-in user's own account
				this.loadIndividualAccount()
			}
			else if (this.isTravelAgentMode) {
				this.getTravelClientAccounts()
			}
			else if (this.isGuestMode) {
				// no account/affiliate lookups exist for an unauthenticated visitor;
				// the vehicle already came from the public quote flow
				this.SetFormValue('account_type', 'loose_customer')
			}
			else {
				this.fetchClientAccounts('individual')
				this.fetchAffiliates('affiliate')
				this.fetchReturnAffiliates('affiliate')
			}
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
		if (this.queryParamsSubscription) {
			this.queryParamsSubscription.unsubscribe();
		}
		this.formSubscriptionsReset$.next();
		this.formSubscriptionsReset$.complete();
		this.countryChangeHandlers.forEach((handler, element) => element.removeEventListener('countrychange', handler));
		this.countryChangeHandlers.clear();
		window.removeEventListener('scroll', this.sectionNavScrollListener, true);
		window.removeEventListener('resize', this.sectionNavScrollListener);
		if (this.sectionNavRafId !== null) {
			cancelAnimationFrame(this.sectionNavRafId);
		}
	}

	change2() {
	}

	/**
	 * Extra stops carry a `kind`/`airport_*` set purely so a drag-and-drop reorder can
	 * promote/demote them correctly (see readRoutePoints/writeRoutePoints) - the backend has
	 * never known about that shape, so it's stripped back down to what it already expects
	 * before the stop list goes out in the booking payload.
	 */
	private stripInternalStopFields(stops: any): Array<Record<string, any>> {
		if (!Array.isArray(stops)) {
			return [];
		}
		return stops.map((stop: any) => ({
			address: stop?.address ?? '',
			latitude: stop?.latitude ?? '',
			longitude: stop?.longitude ?? '',
			rate: stop?.rate ?? '',
			booking_instructions: stop?.booking_instructions ?? ''
		}));
	}

	buildBookingData() {
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
		const effectiveVehicleId = vehicleId || this.QB_vehicle_id || this.route_vehicle_id || this.firstLoadVehicleId || vehicleTypeId || '';
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
			extra_stops: this.stripInternalStopFields(this.BookingForm.get('extra_stops').value),
			return_extra_stops: this.stripInternalStopFields(this.BookingForm.get('return_extra_stops').value),
			manual_change_aff_veh: this.manual_change_aff_veh,
			pickup_time: this.BookingForm.get('pickup_time').value,
			return_pickup_time: this.BookingForm.get('return_pickup_time').value,
			affiliate_type: affiliateType,
			return_affiliate_type: returnAffiliateType,
			rate_refresh_token: this.rateRefreshToken
		}
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
			// carry the airport display names: home's prefill and setValueByBookNow
			// read them from other_details, so writing {} here loses the airports
			// when the user navigates back to the quotebot and books again
			other_details: {
				pickup_airport_name: isAirportPickup ? (this.Form.pickup_airport_option.value || this.Form.pickup_airport_name.value || '') : '',
				dropoff_airport_name: isAirportDropoff ? (this.Form.dropoff_airport_option.value || this.Form.dropoff_airport_name.value || '') : '',
				return_pickup_airport_name: isRoundTrip && returnPickupTypeRaw === 'airport' ? (this.Form.return_pickup_airport_option.value || this.Form.return_pickup_airport_name.value || '') : '',
				return_dropoff_airport_name: isRoundTrip && returnDropoffTypeRaw === 'airport' ? (this.Form.return_dropoff_airport_option.value || this.Form.return_dropoff_airport_name.value || '') : ''
			},

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
		if (!this.is_booking_edit_case) {
			localStorage.setItem('quotebot_form', JSON.stringify(payload));
		}
		return payload;
	}

	/** "Search vehicles" button: validate inputs and (re)build the quote payload. */
	async runEmbeddedQuote(): Promise<void> {
		let payload = this.buildQuotePayload();
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

		const isRoundTrip = payload.service_type === 'round_trip';
		if (this.distance <= 0 || (isRoundTrip && this.return_distance <= 0)) {
			this.quoteLoading = true;
			try {
				if (this.distance <= 0) {
					await this._MapController(false);
				}
				if (isRoundTrip && this.return_distance <= 0) {
					await this._MapController(true);
				}
			} finally {
				this.quoteLoading = false;
			}
			// rebuild so location_info reflects the distance/time we just resolved
			payload = this.buildQuotePayload();
		}

		this.quotePayload = { ...payload };
	}

	onQuoteVehicleSelected(vehicle: any): void {
		if (!vehicle) {
			return;
		}
		sessionStorage.setItem('selected_vehicle', JSON.stringify(vehicle));
		this.affiliate_id = vehicle.affiliate_id;
		this.QB_vehicle_id = vehicle.id;
		this.is_master_vehicle = !!vehicle.is_master_vehicle;

		const normalizedVehicle = this.normalizeMasterVehicleForPrefill(vehicle);
		const isRoundTrip = this.Form.service_type.value === 'round_trip';
		this.prefillVehiclePreferencesFromMasterVehicle(normalizedVehicle);
		if (isRoundTrip) {
			// round trip: the quote selection drives both legs — refresh the return
			// vehicle too, otherwise it keeps the edit response's stale vehicle id
			this.prefillVehiclePreferencesFromMasterVehicle(normalizedVehicle, true);
		}

		this.populateDriverAndVehicleDetails(vehicle);

		// NOTE: in these patchValue objects the affiliate ids must come BEFORE the
		// affiliate types: patching affiliate_type fires its valueChanges handler
		// (even when the value is unchanged), which calls chooseAffiliate() — if the
		// old affiliate_id is still in the form, that fetches the old vehicle list
		// and its auto-select re-applies the stale edit vehicle over this selection.
		if (vehicle.is_master_vehicle) {
			// Master vehicles have no affiliate — mirror the direct quotebot flow:
			// use loose_affiliate type and prefill vehicle fields from master vehicle info.
			this.BookingForm.patchValue({
				affiliate_id: '',
				loose_affiliate_id: '',
				...(isRoundTrip ? { return_affiliate_id: '', return_loose_affiliate_id: '' } : {}),
				affiliate_type: this.isAffiliateMode ? 'affiliate' : 'loose_affiliate',
				...(isRoundTrip ? { return_affiliate_type: this.isAffiliateMode ? 'affiliate' : 'loose_affiliate' } : {})
			});
			const masterVehicleId = Number(vehicle.id || vehicle.ID || 0);
			if (masterVehicleId > 0) {
				this.loadMasterVehicleInfoForQuoteBot(masterVehicleId);
				if (isRoundTrip) {
					this.loadMasterVehicleInfoForQuoteBot(masterVehicleId, true);
				}
			}
		} else {
			this.BookingForm.patchValue({
				affiliate_id: vehicle.affiliate_id,
				...(isRoundTrip ? { return_affiliate_id: vehicle.affiliate_id } : {}),
				affiliate_type: 'affiliate',
				...(isRoundTrip ? { return_affiliate_type: 'affiliate' } : {})
			});
			this.fetchAffiliateInformation(vehicle.affiliate_id);
			this.fetchQBAffiliateVehicles(vehicle.affiliate_id);
			this.fetchAffiliateDrivers(vehicle.affiliate_id);
		}

		// reveal the now-populated, still-editable manual fields
		this.vehicleSelectionTab = 'manual';
		this.rateRefreshToken++;
		this.buildBookingData();
	}

	populateDriverAndVehicleDetails(vehicle: any): void {
		if (!vehicle) {
			this.driver_info = null;
			this.driverImgUrl = '';
			this.vehicleImgUrl = '';
			return;
		}

		this.driverImgUrl = vehicle?.driverInformation?.imageUrl || vehicle?.driver_image || "../../../../assets/images/driverImg.jpg";
		this.vehicleImgUrl = vehicle?.vehicle_images?.[0] || vehicle?.vehicle_image?.image || "";
		this.driver_info = vehicle?.driverInformation || {};
		
		if (!this.driver_info.name && vehicle.driver_name) {
			this.driver_info.name = vehicle.driver_name;
			this.driver_info.phone = (vehicle.driver_cell_isd || '') + (vehicle.driver_cell || '');
			this.driver_info.gender = vehicle.driver_gender;
			this.driver_info.type = vehicle.vehicle_type_name;
			this.driver_info.make = vehicle.vehicle_make_name;
			this.driver_info.model = vehicle.vehicle_model_name;
		} else {
			this.driver_info['type'] = vehicle?.name || vehicle?.vehicle_type_name || "";
			this.driver_info['make'] = vehicle?.vehicle_details?.make || vehicle?.vehicle_make_name || "";
			this.driver_info['model'] = vehicle?.vehicle_details?.model || vehicle?.vehicle_model_name || "";
			this.driver_info['year'] = vehicle?.vehicle_details?.year || vehicle?.vehicle_year_name || "";
		}

		if (this.usesQuoteFlow) {
			let d_isd = vehicle?.driverInformation?.cell_isd || vehicle?.driver_cell_isd;
			if (d_isd && !String(d_isd).startsWith('+')) {
				d_isd = '+' + d_isd;
			}
			this.BookingForm.patchValue({
				driver_id: vehicle?.driverInformation?.id || vehicle?.driver_id || '',
				driver_name: vehicle?.driverInformation?.name || vehicle?.driver_name || '',
				driver_email: vehicle?.driverInformation?.email || vehicle?.driver_email || '',
				driver_cell: vehicle?.driverInformation?.cell_number || vehicle?.driver_cell || '',
				driver_cell_isd: d_isd || '+1',
				driver_cell_country: vehicle?.driverInformation?.cell_country || vehicle?.driver_cell_country || 'us',
				driver_gender: vehicle?.driverInformation?.gender || vehicle?.driver_gender || '',
				vehicle_id: vehicle?.id || vehicle?.vehicle_id || '',
				vehicle_type: vehicle?.vehicle_type_id || vehicle?.vehicle_type || '',
				vehicle_type_name: vehicle?.name || vehicle?.vehicle_type_name || '',
				vehicle_make: vehicle?.vehicle_details?.make_id || vehicle?.vehicle_make || '',
				vehicle_make_name: vehicle?.vehicle_details?.make || vehicle?.vehicle_make_name || '',
				vehicle_model: vehicle?.vehicle_details?.model_id || vehicle?.vehicle_model || '',
				vehicle_model_name: vehicle?.vehicle_details?.model || vehicle?.vehicle_model_name || '',
				vehicle_year: vehicle?.vehicle_details?.year_id || vehicle?.vehicle_year || '',
				vehicle_year_name: vehicle?.vehicle_details?.year || vehicle?.vehicle_year_name || '',
				vehicle_seats: vehicle?.vehicle_details?.seats || vehicle?.vehicle_seats || '4'
			}, { emitEvent: false });
			// emitEvent: false — emitting vehicle_type here re-enters its valueChanges
			// handler while affiliate_type is still the previous value, and on edit
			// bookings that handler re-selects the OLD vehicle (unique_key match on the
			// stale VehicleList), clobbering the vehicle_id we just set from the quote.
		}
	}

	// resetSelectedVehicle(): void {
	// 	this.driver_info = null;
	// 	this.driverImgUrl = '';
	// 	this.vehicleImgUrl = '';
	// 	sessionStorage.removeItem('selected_vehicle');

	// 	const fieldsToReset = [
	// 		'vehicle_type', 'vehicle_type_name', 'vehicle_id', 'vehicle_make', 'vehicle_make_name',
	// 		'vehicle_model', 'vehicle_model_name', 'vehicle_year', 'vehicle_year_name',
	// 		'vehicle_color', 'vehicle_color_name', 'vehicle_license_plate', 'vehicle_seats',
	// 		'driver_id', 'driver_name', 'driver_gender', 'driver_cell', 'driver_email'
	// 	];
	// 	fieldsToReset.forEach((item: string) => {
	// 		const control = this.BookingForm.get(item);
	// 		if (control) {
	// 			control.reset();
	// 		}
	// 	});
	// 	this.SetFormValue('driver_cell_isd', '+1');
	// 	this.SetFormValue('driver_cell_country', 'us');
	// 	this.BookingForm.updateValueAndValidity();
	// }

	handleChangeWithAgent(selectedAcc: any) {
		console.log('handleChangeWithAgent-->>', selectedAcc);
	}

	handleSubAgentAccounts(value: any) {
		console.log('handleSubAgentAccounts--->>>', value);
	}

	handleSubAgentSearch(event: any) {
		const term = event.term;
		if (!term) {
			this.subAgentAccounts = [...this.subAgentAccounts_Original];
			return;
		}
		const lowerTerm = term.toLowerCase();
		this.subAgentAccounts = [...this.subAgentAccounts_Original].sort((a, b) => {
			const aName = a.name.toLowerCase();
			const bName = b.name.toLowerCase();
			const aStarts = aName.startsWith(lowerTerm);
			const bStarts = bName.startsWith(lowerTerm);
			if (aStarts && !bStarts) return -1;
			if (!aStarts && bStarts) return 1;
			return 0;
		});
	}

	handleTravelStaffSearch(event: any) {
		const term = event.term;
		if (!term) {
			this.travelStaffAccounts = [...this.travelStaffAccounts_Original];
			return;
		}
		const lowerTerm = term.toLowerCase();
		this.travelStaffAccounts = [...this.travelStaffAccounts_Original].sort((a, b) => {
			const aName = a.name.toLowerCase();
			const bName = b.name.toLowerCase();
			const aStarts = aName.startsWith(lowerTerm);
			const bStarts = bName.startsWith(lowerTerm);
			if (aStarts && !bStarts) return -1;
			if (!aStarts && bStarts) return 1;
			return 0;
		});
	}

	private syncPrefilledTravelClientSelection() {
		const currentTravelClientId = this.BookingForm?.get('travel_client_id')?.value;
		console.log('[DEBUG] syncPrefilledTravelClientSelection currentTravelClientId:', currentTravelClientId, 'travelStaffAccounts length:', this.travelStaffAccounts?.length, 'ids:', this.travelStaffAccounts?.map((c: any) => c?.id));
		if (!currentTravelClientId || !this.travelStaffAccounts?.length) {
			return;
		}

		const matchedClient = this.travelStaffAccounts.find((client: any) => Number(client?.id) === Number(currentTravelClientId));
		console.log('[DEBUG] syncPrefilledTravelClientSelection matchedClient:', matchedClient);
		if (matchedClient) {
			this.BookingForm.patchValue({
				travel_client_id: matchedClient.id
			}, { emitEvent: false });
		}
	}

	private syncPrefilledSubAgentSelection() {
		const currentSubAccountId = this.BookingForm?.get('sub_account_id')?.value;
		if (!currentSubAccountId || !this.subAgentAccounts?.length) {
			return;
		}

		const matchedSub = this.subAgentAccounts.find((sub: any) => Number(sub?.id) === Number(currentSubAccountId));
		if (matchedSub) {
			this.BookingForm.patchValue({
				sub_account_id: matchedSub.id
			}, { emitEvent: false });
		}
	}


	ngAfterViewInit(): void {

		window.scrollTo({ top: 0 })

		// Keep whatever the prefill already put in. setValueByBookNow() runs
		// synchronously from the cached bigData$ when arriving from the quotebot,
		// so stamping today's date here used to wipe the pickup date carried over
		// from the quote (pickup time and the return leg were never touched, which
		// is why only the pickup date was lost). Fall back to today only when no
		// date has been set at all.
		if (!this.Form.pickup_date.value) {
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

		// Section navigator: capture-phase listener so scrolls on window or any
		// inner scroll container both drive the scroll-spy. Registered outside
		// the zone — change detection runs only when the nav state changes.
		this.zone.runOutsideAngular(() => {
			window.addEventListener('scroll', this.sectionNavScrollListener, true);
			window.addEventListener('resize', this.sectionNavScrollListener);
		});
		setTimeout(() => this.refreshSectionNav());
	}

	/* ---------- Section navigator ---------- */

	openSectionNav(): void {
		this.sectionNavOpen = true;
		this.refreshSectionNav();
	}

	scrollToSection(key: string): void {
		const idx = this.visibleSections.findIndex((s) => s.key === key);
		if (idx >= 0) {
			this.activeSectionIndex = idx;
			// Keep highlight on the clicked section while smooth-scroll runs.
			// Last sections (e.g. Rates with only totals) often can't reach the spy line.
			this.sectionNavClickLockUntil = performance.now() + 900;
		}
		const el = document.querySelector<HTMLElement>(`[data-bksec="${key}"]`);
		if (el) {
			el.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}
	}

	scrollToTargetElement(targetId: string): void {
		if (!targetId) return;
		const el = document.getElementById(targetId) || document.querySelector<HTMLElement>(`[data-bksec="${targetId}"]`);
		if (el) {
			el.scrollIntoView({ behavior: 'smooth', block: 'center' });
		}
	}

	/** Close the navigator when clicking anywhere outside of it. */
	@HostListener('document:click', ['$event'])
	onDocumentClickForSectionNav(event: MouseEvent): void {
		if (!this.sectionNavOpen) {
			return;
		}
		const target = event.target as HTMLElement;
		// Change detection can remove the clicked element (e.g. the "Sections"
		// tab, which has *ngIf) before this bubbled handler runs; a detached
		// target has no ancestors, so closest() would misreport an outside click.
		if (!target || !target.isConnected) {
			return;
		}
		if (!target.closest('.bk-secnav')) {
			this.sectionNavOpen = false;
		}
	}

	private scheduleSectionNavUpdate(): void {
		if (this.sectionNavRafId !== null) {
			return;
		}
		this.sectionNavRafId = requestAnimationFrame(() => {
			this.sectionNavRafId = null;
			this.refreshSectionNav();
		});
	}

	/** Rebuilds the visible-section list from the DOM and computes the active
	 *  section (last one whose top has crossed the spy line). */
	private refreshSectionNav(): void {
		const spyLine = 140; // px from viewport top; a section is "current" once its top passes this
		const sections: { key: string; label: string; top: number }[] = [];
		for (const def of this.sectionNavDefs) {
			const el = document.querySelector<HTMLElement>(`[data-bksec="${def.key}"]`);
			// offsetParent is null for hidden/removed elements; skip collapsed hosts.
			if (el && el.offsetParent !== null) {
				const rect = el.getBoundingClientRect();
				if (rect.height < 24) {
					continue;
				}
				sections.push({ key: def.key, label: def.label(), top: rect.top });
			}
		}

		const listChanged =
			sections.length !== this.visibleSections.length ||
			sections.some((s, i) => s.key !== this.visibleSections[i]?.key || s.label !== this.visibleSections[i]?.label);

		// During programmatic scroll, still refresh the list but keep the clicked active item.
		const clickLocked = performance.now() < this.sectionNavClickLockUntil;
		if (clickLocked) {
			if (!listChanged) {
				return;
			}
			this.zone.run(() => {
				this.visibleSections = sections.map(({ key, label }) => ({ key, label }));
			});
			return;
		}

		let active = 0;
		for (let i = 0; i < sections.length; i++) {
			if (sections[i].top <= spyLine) {
				active = i;
			}
		}

		// Last short sections (Rates totals with buckets hidden) often can't scroll
		// up to the spy line. If the previous section has left the viewport and the
		// last section is on screen, treat it as active.
		const lastIdx = sections.length - 1;
		if (lastIdx > 0) {
			const last = sections[lastIdx];
			const prev = sections[lastIdx - 1];
			if (last.top > spyLine && prev.top < 0 && last.top < window.innerHeight) {
				active = lastIdx;
			}
		}

		if (!listChanged && active === this.activeSectionIndex) {
			return;
		}
		this.zone.run(() => {
			if (listChanged) {
				this.visibleSections = sections.map(({ key, label }) => ({ key, label }));
			}
			this.activeSectionIndex = active;
		});
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

	private resolveCountryFromAffiliate(affiliate: any): string {
		if (!affiliate) return '';

		// 1. Check explicit country code properties
		const explicitCountry = affiliate.driver_phone_country || affiliate.phone_country || affiliate.country || affiliate.cell_country || affiliate.driver_country || affiliate.PhoneCountry || affiliate.phoneCountry || affiliate.mobileCountry;
		if (explicitCountry && typeof explicitCountry === 'string') {
			return explicitCountry.toLowerCase();
		}

		// 2. Check ISD / dial code against intlTelInputGlobals country data
		const rawIsd = (affiliate.driver_phone_isd || affiliate.driver_isd || affiliate.phone_isd || affiliate.isd || affiliate.cell_isd || affiliate.CellIsd || '').toString();
		const cleanIsd = rawIsd.replace(/[^0-9]/g, '');
		if (cleanIsd) {
			const countryData = (window as any).intlTelInputGlobals?.getCountryData?.();
			if (countryData && Array.isArray(countryData)) {
				const match = countryData.find((c: any) => c.dialCode === cleanIsd);
				if (match?.iso2) {
					return match.iso2.toLowerCase();
				}
			}
		}

		// 3. Check if phone number includes international dial code starting with +
		const phone = (affiliate.driver_phone || affiliate.phone || affiliate.cell || affiliate.driver_cell || '').toString().trim();
		if (phone.startsWith('+')) {
			const countryData = (window as any).intlTelInputGlobals?.getCountryData?.();
			if (countryData && Array.isArray(countryData)) {
				const sorted = [...countryData].sort((a: any, b: any) => b.dialCode.length - a.dialCode.length);
				const cleanPhone = phone.replace(/[^0-9]/g, '');
				const match = sorted.find((c: any) => cleanPhone.startsWith(c.dialCode));
				if (match?.iso2) {
					return match.iso2.toLowerCase();
				}
			}
		}

		return '';
	}

	initphonefield() {

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
			this.bindCountryChange(this.passenger_cellInput.nativeElement, () => {
				const countryData = this.PaxTelObject.getSelectedCountryData();
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
			this.bindCountryChange(this.cellInput.nativeElement, () => {
				const countryData = this.LCTelObject.getSelectedCountryData();
				this.onLCTeleCountryChange(countryData);
				// Removed PaxTelObject cross-update to ensure isolation
				this.validateLooseCustomerPhone();
			});
		}

		if (this.driver_cellInput || this.loose_driver_cellInput) {
			const input = this.driver_cellInput || this.loose_driver_cellInput;
			const existing = (window as any).intlTelInputGlobals?.getInstance(input.nativeElement);
			if (existing) existing.destroy();
			let driverCountry = getInitCountry('driver_cell_country');
			if (this.Form.affiliate_type.value === 'in_progress_affiliate' && this.selectedPendingAffiliate) {
				const affCountry = this.resolveCountryFromAffiliate(this.selectedPendingAffiliate);
				if (affCountry) {
					driverCountry = affCountry;
				}
			}
			const driverTelOpts = {
				...this.commonServices.getTelInputOptions(driverCountry),
				autoFormat: false,
				formatOnDisplay: false,
				autoPlaceholder: 'off'
			};
			this.driverCellTelInput = intlTelInput(input.nativeElement, driverTelOpts);
			if (driverCountry && driverCountry !== 'auto') {
				this.driverCellTelInput.setCountry(driverCountry);
			}

			this.addCustomCountrySearch(input.nativeElement);
			this.bindCountryChange(input.nativeElement, () => {
				const countryData = this.driverCellTelInput.getSelectedCountryData();
				this.SetFormValue('driver_cell_isd', '+' + countryData.dialCode); this.SetFormValue('driver_cell_country', countryData.iso2)
				this.validateDriverCell();
			});
		}

		if (this.return_driver_cellInput || this.return_loose_driver_cellInput) {
			const input = this.return_driver_cellInput || this.return_loose_driver_cellInput;
			const existing = (window as any).intlTelInputGlobals?.getInstance(input.nativeElement);
			if (existing) existing.destroy();
			let returnDriverCountry = getInitCountry('return_driver_cell_country');
			if (this.Form.return_affiliate_type.value === 'in_progress_affiliate' && this.selectedReturnPendingAffiliate) {
				const affCountry = this.resolveCountryFromAffiliate(this.selectedReturnPendingAffiliate);
				if (affCountry) {
					returnDriverCountry = affCountry;
				}
			}
			const returnDriverTelOpts = {
				...this.commonServices.getTelInputOptions(returnDriverCountry),
				autoFormat: false,
				formatOnDisplay: false,
				autoPlaceholder: 'off'
			};
			this.returnDriverCellTelInput = intlTelInput(input.nativeElement, returnDriverTelOpts);
			if (returnDriverCountry && returnDriverCountry !== 'auto') {
				this.returnDriverCellTelInput.setCountry(returnDriverCountry);
			}

			this.addCustomCountrySearch(input.nativeElement);
			this.bindCountryChange(input.nativeElement, () => {
				const countryData = this.returnDriverCellTelInput.getSelectedCountryData();
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
			this.bindCountryChange(this.lose_affiliate_phoneInput.nativeElement, () => {
				const countryData = this.loseAffiliateTelInput.getSelectedCountryData();
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
			this.bindCountryChange(this.return_lose_affiliate_phoneInput.nativeElement, () => {
				const countryData = this.returnLoseAffiliateTelInput.getSelectedCountryData();
				this.SetFormValue('return_lose_affiliate_phone_isd', '+' + countryData.dialCode); this.SetFormValue('return_lose_affiliate_phone_country', countryData.iso2)
				this.handleReturnCountryChangeLA(countryData);
				// Removed return driver cross-updates to ensure isolation
				this.validateReturnLooseAffiliatePhone();
			});
		}

		if (this.in_progress_phoneInput) {
			const existing = (window as any).intlTelInputGlobals?.getInstance(this.in_progress_phoneInput.nativeElement);
			if (existing) existing.destroy();
			const inProgressCountry = this.selectedPendingAffiliate?.phone_country || this.selectedPendingAffiliate?.driver_phone_country || this.selectedPendingAffiliate?.country || getInitCountry('driver_cell_country');
			this.inProgressPhoneTelInput = intlTelInput(this.in_progress_phoneInput.nativeElement, this.commonServices.getTelInputOptions(inProgressCountry));

			this.addCustomCountrySearch(this.in_progress_phoneInput.nativeElement);
		}

	}

	/**
	 * Attach a countrychange listener, replacing any previously bound handler for the
	 * same element. initphonefield() can run multiple times (view re-renders, account
	 * type switches); without this the handlers stack and each change fires N times.
	 */
	private bindCountryChange(element: HTMLElement, handler: () => void): void {
		const previous = this.countryChangeHandlers.get(element);
		if (previous) {
			element.removeEventListener('countrychange', previous);
		}
		element.addEventListener('countrychange', handler);
		this.countryChangeHandlers.set(element, handler);
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
				console.log(errorCode, "errorCode");
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
		this.validateAddressSuggestions();
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
		this.validateAddressSuggestions();
	}

	modalMissingField: string | null = null;
	modalFieldLabel: string = 'Airport Address';
	modalSelectedAirportName: string = '';
	modalTerminalOptions: Array<any> = [];
	modalSelectedTerminalOption: any | null = null;
	isModalTerminalLoading: boolean = false;

	/** Last popup open, so a second dialog within a few seconds can be flagged as the pair. */
	private lastPopupDebug: { popup: string; source: string; at: number } | null = null;

	/**
	 * Filter the browser console with `DUAL_POPUP`.
	 * A line tagged `[DUAL_POPUP][BOTH]` means the terminal modal and the
	 * "valid location point" error opened on top of each other.
	 */
	private logDualPopup(
		popup: 'selectTerminalModal' | 'locationErrorModal',
		source: string,
		detail: Record<string, unknown> = {}
	): void {
		const now = Date.now();
		const previous = this.lastPopupDebug;
		const terminalVisible = this.isBootstrapModalOpen('selectTerminalModal');
		const errorVisible = this.isBootstrapModalOpen('globalErrorModal');
		const otherRecently = !!previous && previous.popup !== popup && (now - previous.at) < 4000;
		const both = otherRecently
			|| (popup === 'selectTerminalModal' && errorVisible)
			|| (popup === 'locationErrorModal' && terminalVisible);
		const tag = both ? '[DUAL_POPUP][BOTH]' : '[DUAL_POPUP]';

		console.warn(tag, `${popup} opened from ${source}`, {
			popup,
			source,
			bothPopups: both,
			terminalModalOpen: terminalVisible,
			locationErrorModalOpen: errorVisible,
			previousPopup: previous,
			msSincePreviousPopup: previous ? now - previous.at : null,
			service_type: this.BookingForm?.get('service_type')?.value,
			transfer_type: this.BookingForm?.get('transfer_type')?.value,
			return_transfer_type: this.BookingForm?.get('return_transfer_type')?.value,
			hasInvalidRoutePoint: this.hasInvalidRoutePoint,
			hasInvalidReturnRoutePoint: this.hasInvalidReturnRoutePoint,
			...detail,
			stack: new Error(`[DUAL_POPUP] ${source}`).stack
		});

		this.lastPopupDebug = { popup, source, at: now };
	}

	private isBootstrapModalOpen(modalId: string): boolean {
		try {
			const modal = $(`#${modalId}`);
			return modal.hasClass('show') || modal.is(':visible');
		} catch {
			return false;
		}
	}

	getFieldDisplayName(fieldName: string): string {
		if (fieldName.includes('pickup') && !fieldName.includes('return')) return 'Pickup Address';
		if (fieldName.includes('dropoff') && !fieldName.includes('return')) return 'Dropoff Address';
		if (fieldName.includes('return_pickup')) return 'Return Pickup Address';
		if (fieldName.includes('return_dropoff')) return 'Return Dropoff Address';
		return 'Airport Address';
	}

	/** True only when this airport field is the active end of its leg. A city-to-city
	 * repeat still has street text in pickup_address, and that must not be treated
	 * as an airport that needs a terminal. */
	private isAirportEndpointField(controlName: string): boolean {
		const field = controlName.endsWith('_option') ? controlName.slice(0, -'_option'.length) : controlName;
		const isReturn = field.startsWith('return_');
		const transferType = String(
			(isReturn ? this.BookingForm?.get('return_transfer_type')?.value : this.BookingForm?.get('transfer_type')?.value) || ''
		);
		if (field.endsWith('pickup_airport')) {
			return transferType.startsWith('airport_');
		}
		if (field.endsWith('dropoff_airport')) {
			return transferType.endsWith('_airport');
		}
		return false;
	}

	async checkAndShowTerminalPopup(controlName: string, displayValue: string, airportId?: string): Promise<boolean> {
		if (!displayValue) return false;
		if (!this.isAirportEndpointField(controlName)) return false;
		const id = airportId || String(this.BookingForm.get(controlName.replace('_option', ''))?.value || '').trim();
		if (id === '3283') return false; // Skip FBO
		if (displayValue.toLowerCase().includes('terminal')) return false;

		const baseField = controlName.endsWith('_option') ? controlName.replace('_option', '') : controlName;
		// Needed up front so fetchTerminalOptionsRaw's base-query lookup and the session
		// token are scoped to this field while we check for terminals.
		this.modalMissingField = baseField;

		const terminalOptions = await this.fetchTerminalOptionsRaw(displayValue);
		if (!terminalOptions.length) {
			// This airport has no terminals to pick between - don't interrupt the user with
			// an empty "select a terminal" popup they'd just have to dismiss.
			this.modalMissingField = null;
			return false;
		}

		this.modalFieldLabel = this.getFieldDisplayName(controlName);
		this.modalSelectedAirportName = displayValue;
		this.modalTerminalOptions = terminalOptions;
		this.modalSelectedTerminalOption = null;
		this.isModalTerminalLoading = false;

		this.logDualPopup('selectTerminalModal', 'checkAndShowTerminalPopup', {
			controlName,
			displayValue,
			airportId: id,
			modalMissingField: this.modalMissingField,
			terminalCount: terminalOptions.length,
			terminalLabels: terminalOptions.slice(0, 8).map((option) => String(option?.description || option?.label || ''))
		});

		try {
			$('#selectTerminalModal').modal({ backdrop: 'static', keyboard: false });
		} catch (e) {
			console.error('Error opening terminal modal:', e);
		}

		return true;
	}

	private terminalPrefillCheckQueue: string[] = [];
	private isProcessingTerminalPrefillQueue = false;

	/** Prefill paths (repeat/return/round booking, quotebot "book now") write airport legs
	 * straight into the form instead of going through selectCustomAirportOption - the only
	 * other place checkAndShowTerminalPopup normally runs from - so without this, a
	 * prefilled airport leg would skip terminal validation until the customer re-touched
	 * the field. Called once after all four legs have been written to the form. */
	queuePrefillTerminalChecks(): void {
		['pickup_airport_option', 'dropoff_airport_option', 'return_pickup_airport_option', 'return_dropoff_airport_option']
			.filter((controlName) => this.isAirportEndpointField(controlName))
			.forEach((controlName) => this.terminalPrefillCheckQueue.push(controlName));
		void this.processTerminalPrefillQueue();
	}

	private async processTerminalPrefillQueue(): Promise<void> {
		if (this.isProcessingTerminalPrefillQueue) return;
		this.isProcessingTerminalPrefillQueue = true;
		try {
			while (this.terminalPrefillCheckQueue.length) {
				const controlName = this.terminalPrefillCheckQueue.shift()!;
				const displayValue = String(this.BookingForm.get(controlName)?.value || '').trim();
				const opened = await this.checkAndShowTerminalPopup(controlName, displayValue);
				if (opened) {
					// The modal is a single shared instance - only one leg can occupy it at a
					// time, so wait for the customer to resolve this one before checking the next.
					await this.waitForTerminalModalClose();
				}
			}
		} finally {
			this.isProcessingTerminalPrefillQueue = false;
		}
	}

	private waitForTerminalModalClose(): Promise<void> {
		return new Promise((resolve) => {
			try {
				$('#selectTerminalModal').one('hidden.bs.modal', () => resolve());
			} catch {
				resolve();
			}
		});
	}

	/** Coordinates of the airport currently being checked/searched for terminals, used to
	 * anchor the Google query so a bare code/word like "SEA" doesn't get read as the English
	 * word "sea" and match unrelated streets (e.g. "Sea Street, Quincy, MA"). */
	private getAirportCoordsForField(baseField: string | null): { latitude: number; longitude: number } | undefined {
		if (!baseField) return undefined;
		const latitude = Number(this.BookingForm.get(`${baseField}_latitude`)?.value);
		const longitude = Number(this.BookingForm.get(`${baseField}_longitude`)?.value);
		return Number.isFinite(latitude) && Number.isFinite(longitude) && (latitude !== 0 || longitude !== 0)
			? { latitude, longitude }
			: undefined;
	}

	/** A terminal/concourse candidate can never be a street or a bare geocode match - Google
	 * still returns those for a short/ambiguous query even with a location bias applied, so
	 * this is a hard filter on top of the keyword check below. */
	private isPlaceLikePrediction(option: any): boolean {
		const types: string[] = Array.isArray(option?.types) ? option.types : [];
		return !types.includes('route') && !(types.length === 1 && types[0] === 'geocode');
	}

	private async fetchTerminalOptionsRaw(airportSearchText: string): Promise<Array<any>> {
		try {
			const baseSearchText = this.getCustomAirportBaseQuery(airportSearchText, this.modalMissingField || undefined) || airportSearchText;
			const terminalSearchText = `${baseSearchText} terminal`.trim();
			const concourseSearchText = `${baseSearchText} concourse`.trim();
			const sessionToken = this.getOrCreateCustomAirportSessionToken(this.modalMissingField || 'pickup_airport');
			const coords = this.getAirportCoordsForField(this.modalMissingField);
			// Hard-restrict (not just bias) to a ~20km circle around the airport itself - a
			// same-named landmark elsewhere in the world (e.g. Isle of Man's "Sea Terminal"
			// matching a Seattle "SEA terminal" query) must not be able to outrank distance.
			const locationArea = coords ? { ...coords, radiusMeters: 20000, restrict: true } : undefined;

			const [airportOptions, terminalOptions, concourseOptions] = await Promise.all([
				this.searchGooglePredictions(baseSearchText, sessionToken, ['airport'], locationArea),
				this.searchGooglePredictions(terminalSearchText, sessionToken, undefined, locationArea),
				this.searchGooglePredictions(concourseSearchText, sessionToken, undefined, locationArea)
			]);

			const terminalPredictions = [...terminalOptions, ...concourseOptions]
				.filter((option) =>
					this.isPlaceLikePrediction(option)
					&& this.isAirportPrediction(option)
					&& String(option?.description || '').toLowerCase().includes('terminal')
				)
				.map((option) => ({ ...option, isTerminal: true }));

			const airportPredictions = airportOptions
				.filter((option) =>
					this.isPlaceLikePrediction(option)
					&& this.isAirportPrediction(option)
					&& String(option?.description || '').toLowerCase().includes('terminal')
				)
				.map((option) => ({ ...option, isTerminal: true }));

			// Deliberately no raw/unfiltered fallback here: this list also decides whether the
			// "select a terminal" popup opens at all, so anything that isn't a genuine
			// terminal/concourse match (an unrelated street, a city, a parking lot) must not
			// leak in and confuse the customer into thinking it's a real terminal choice.
			const terminals = [...terminalPredictions, ...airportPredictions];
			const deduped = this.dedupeCustomAirportOptions(terminals);
			// dedupeCustomAirportOptions only collapses exact placeId/description duplicates -
			// different places (e.g. two Google predictions for the same physical terminal) can
			// still share the short chip label ("Terminal 5") shown in the popup, so collapse
			// those too rather than showing the customer the same-looking button twice.
			return deduped.length ? this.dedupeByTerminalChipLabel(deduped) : [];
		} catch (err) {
			console.error('Error fetching terminal options:', err);
			return [];
		}
	}

	selectModalTerminalOption(option: any): void {
		this.modalSelectedTerminalOption = option;
	}

	/** Short chip label ("Terminal 5") instead of the full place text ("ORD Terminal 5,
	 * Chicago, IL, USA") so the options read like quick-pick buttons, not address rows. */
	getModalTerminalOptionLabel(option: any): string {
		const raw = this.getCustomOptionLabel(option);
		const match = raw.match(/\b(Terminal|Concourse)\s*[A-Za-z0-9]+\b/i);
		return match ? match[0] : raw;
	}

	/** Collapses terminal options that would render the same chip label in the popup (e.g. two
	 * distinct Google predictions that both shorten to "Terminal 5"), keeping the first match. */
	private dedupeByTerminalChipLabel(options: Array<any>): Array<any> {
		const seenLabels = new Set<string>();
		return options.filter((option) => {
			const label = this.getModalTerminalOptionLabel(option).trim().toLowerCase();
			if (!label || seenLabels.has(label)) return false;
			seenLabels.add(label);
			return true;
		});
	}

	isModalTerminalOptionSelected(option: any): boolean {
		if (!this.modalSelectedTerminalOption) return false;
		if (this.modalSelectedTerminalOption.placeId || option?.placeId) {
			return this.modalSelectedTerminalOption.placeId === option?.placeId;
		}
		return this.getCustomOptionLabel(this.modalSelectedTerminalOption) === this.getCustomOptionLabel(option);
	}

	async onTerminalModalProceed(): Promise<void> {
		try {
			$('#selectTerminalModal').modal('hide');
		} catch (e) {}

		if (this.modalSelectedTerminalOption && this.modalMissingField) {
			const targetField = this.modalMissingField;
			this.modalMissingField = null;
			await this.selectCustomAirportOption(targetField, this.modalSelectedTerminalOption, true);
		} else if (this.modalMissingField) {
			const optionControlName = this.modalMissingField.endsWith('_option') ? this.modalMissingField : `${this.modalMissingField}_option`;
			const inputRef = this.getSameLocationFieldInput(optionControlName);
			this.modalMissingField = null;
			if (inputRef?.nativeElement) {
				setTimeout(() => {
					inputRef.nativeElement.focus();
				}, 200);
			}
		}
	}

	validateAddressSuggestions(): void {
		if (!this.BookingForm) return;

		const checkField = (controlName: string, latControlName: string) => {
			const ctrl = this.BookingForm.get(controlName);
			if (ctrl) {
				const errors = ctrl.errors ? { ...ctrl.errors } : null;
				if (errors) {
					delete errors['suggestionRequired'];
				}
				ctrl.setErrors(errors && Object.keys(errors).length ? errors : null);

				const val = String(ctrl.value || '').trim();
				const latCtrl = this.BookingForm.get(latControlName);
				const latVal = latCtrl ? String(latCtrl.value || '').trim() : '';

				if (val && !latVal) {
					ctrl.setErrors({ ...(ctrl.errors || {}), suggestionRequired: true });
					ctrl.markAsTouched();
				}
			}
		};

		// 1. Pickup
		const transferType = this.Form?.transfer_type?.value || '';
		if (transferType.startsWith('airport_')) {
			checkField('pickup_airport_option', 'pickup_airport_latitude');
		} else {
			checkField('pickup', 'pickup_latitude');
		}

		// 2. Dropoff
		if (transferType.endsWith('_airport')) {
			checkField('dropoff_airport_option', 'dropoff_airport_latitude');
		} else {
			checkField('dropoff', 'dropoff_latitude');
		}

		// 3. Return Pickup & Dropoff
		if (this.Form?.service_type?.value === 'round_trip') {
			const returnTransferType = this.Form?.return_transfer_type?.value || '';
			if (returnTransferType.startsWith('airport_')) {
				checkField('return_pickup_airport_option', 'return_pickup_airport_latitude');
			} else {
				checkField('return_pickup', 'return_pickup_latitude');
			}

			if (returnTransferType.endsWith('_airport')) {
				checkField('return_dropoff_airport_option', 'return_dropoff_airport_latitude');
			} else {
				checkField('return_dropoff', 'return_dropoff_latitude');
			}
		}

		// 4. Extra stops
		const extraStops = this.BookingForm.get('extra_stops') as FormArray;
		if (extraStops) {
			extraStops.controls.forEach((group) => {
				const addrCtrl = group.get('address');
				if (addrCtrl) {
					const errors = addrCtrl.errors ? { ...addrCtrl.errors } : null;
					if (errors) {
						delete errors['suggestionRequired'];
					}
					addrCtrl.setErrors(errors && Object.keys(errors).length ? errors : null);

					const val = String(addrCtrl.value || '').trim();
					const latVal = String(group.get('latitude')?.value || '').trim();
					if (val && !latVal) {
						addrCtrl.setErrors({ ...(addrCtrl.errors || {}), suggestionRequired: true });
						addrCtrl.markAsTouched();
					}
				}
			});
		}

		// 5. Return Extra stops
		if (this.Form?.service_type?.value === 'round_trip') {
			const returnExtraStops = this.BookingForm.get('return_extra_stops') as FormArray;
			if (returnExtraStops) {
				returnExtraStops.controls.forEach((group) => {
					const addrCtrl = group.get('address');
					if (addrCtrl) {
						const errors = addrCtrl.errors ? { ...addrCtrl.errors } : null;
						if (errors) {
							delete errors['suggestionRequired'];
						}
						addrCtrl.setErrors(errors && Object.keys(errors).length ? errors : null);

						const val = String(addrCtrl.value || '').trim();
						const latVal = String(group.get('latitude')?.value || '').trim();
						if (val && !latVal) {
							addrCtrl.setErrors({ ...(addrCtrl.errors || {}), suggestionRequired: true });
							addrCtrl.markAsTouched();
						}
					}
				});
			}
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
		this.clearSameLocationErrors();
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
		this.clearSameLocationErrors();
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

	private searchGooglePredictions(
		searchText: string,
		sessionToken?: string,
		includedPrimaryTypes?: string[],
		locationArea?: { latitude: number; longitude: number; radiusMeters?: number; restrict?: boolean }
	): Promise<Array<any>> {
		const apiKey = this.getGoogleMapsApiKey();
		if (!apiKey || !String(searchText || '').trim()) {
			return Promise.resolve([]);
		}

		const hasValidArea = !!locationArea
			&& Number.isFinite(locationArea.latitude)
			&& Number.isFinite(locationArea.longitude);
		const circle = hasValidArea ? {
			circle: {
				center: { latitude: locationArea.latitude, longitude: locationArea.longitude },
				radius: locationArea.radiusMeters ?? 30000
			}
		} : null;

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
				...(sessionToken ? { sessionToken } : {}),
				...(includedPrimaryTypes?.length ? { includedPrimaryTypes } : {}),
				// `locationRestriction` hard-excludes anything outside the circle (needed for the
				// terminal-existence check - a plain `locationBias` only nudges ranking and still
				// let a same-named landmark on the other side of the world through, e.g. "Sea
				// Terminal" in the Isle of Man matching a Seattle "SEA terminal" query).
				...(circle ? (locationArea!.restrict ? { locationRestriction: circle } : { locationBias: circle }) : {})
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

	getAirportCodeOrCleanQuery(searchText: string, fieldName?: string): string {
		const rawText = String(searchText || '').trim();
		if (!rawText) return '';

		// 1. Check selected airport ID in form
		const targetControlName = fieldName ? (fieldName.replace('_option', '')) : (this.modalMissingField ? this.modalMissingField : null);
		const airportId = targetControlName ? this.BookingForm?.get(targetControlName)?.value : null;

		const airports: any[] = this.BigData?.airportsData || [];
		if (airportId && airports.length) {
			const record = airports.find(item => String(item.id) === String(airportId));
			if (record && record.code && record.code.trim().length >= 3) {
				return record.code.trim().toUpperCase();
			}
		}

		// 2. Extract 3-letter IATA code if present e.g. "(ORD)" or "ORD" or "(JFK)"
		const iataMatch = rawText.match(/\((?:airport\s*-\s*)?([A-Za-z]{3})\)/i) || rawText.match(/\b([A-Za-z]{3})\b/);
		if (iataMatch && iataMatch[1]) {
			const candidateCode = iataMatch[1].toUpperCase();
			if (airports.length) {
				const matchedByCode = airports.find(item => String(item.code || '').toUpperCase() === candidateCode);
				if (matchedByCode && matchedByCode.code) {
					return matchedByCode.code.trim().toUpperCase();
				}
			} else {
				return candidateCode;
			}
		}

		// 3. Match airport in airportsData by name/code
		if (airports.length) {
			const normSearch = rawText.toLowerCase();
			const matchedByName = airports.find(item => {
				const code = String(item.code || '').toLowerCase();
				const name = String(item.name || '').toLowerCase();
				const formattedName = String(item.formatted_name || '').toLowerCase();
				return (code && normSearch.includes(code)) || (name && normSearch.includes(name)) || (formattedName && normSearch.includes(formattedName));
			});
			if (matchedByName && matchedByName.code && matchedByName.code.trim().length >= 3) {
				return matchedByName.code.trim().toUpperCase();
			}
			if (matchedByName && matchedByName.name) {
				return matchedByName.name;
			}
		}

		// 4. Fallback: Take portion before hyphen / comma and clean out street address, state, zip
		let cleaned = rawText.split(/\s*[-–]\s*/)[0].split(',')[0].trim();
		cleaned = cleaned.replace(/\bterminal\b.*$/i, '').replace(/\s+/g, ' ').trim();
		return cleaned || rawText;
	}

	private getCustomAirportBaseQuery(searchText: string, fieldName?: string): string {
		return this.getAirportCodeOrCleanQuery(searchText, fieldName);
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

		// Terminals that didn't match any airport above (e.g. the airport itself wasn't in
		// `airports` - the base query missed it while the "<query> terminal" query still found
		// terminal/concourse results for it) are still relevant to the search and shouldn't be
		// silently discarded.
		const orphanTerminals = normalizedTerminals.filter((terminal: any) => {
			const terminalKey = String(terminal?.placeId || `${terminal?.name}__${terminal?.description}`).toLowerCase();
			return !!terminalKey && !matchedTerminalIds.has(terminalKey);
		});

		if (orphanTerminals.length) {
			merged.push(...orphanTerminals.map((terminal: any) => ({
				...terminal,
				isTerminal: true,
			})));
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
		const [airportOptions, terminalOptions, plainOptions] = await Promise.all([
			this.searchGooglePredictions(baseSearchText, sessionToken, ['airport']),
			this.searchGooglePredictions(terminalSearchText, sessionToken),
			// The two queries above are both airport-flavored (type-restricted, or biased by
			// appending "terminal") so neither can ever surface a plain city/address - run the
			// user's raw text unrestricted too, so a city typed here (e.g. switching this leg
			// from an airport back to a city) has something to select. `selectCustomAirportOption`
			// demotes the leg back to `city` for whichever of these the user actually picks.
			this.searchGooglePredictions(searchText, sessionToken)
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

		const airportAndTerminalOptions = terminalPredictions.length
			? this.mergeCustomAirportAndTerminalPredictions(airportPredictions, terminalPredictions, baseSearchText)
			: this.dedupeCustomAirportOptions(airportPredictions);

		const cityPredictions = this.dedupeCustomAirportOptions(plainOptions)
			.filter((option) => !this.isAirportPrediction(option))
			.map((option) => ({ ...option, isTerminal: false }));

		// City predictions go first - the airport-restricted queries above can turn up a long
		// tail of loosely-matching airports/terminals (e.g. every airport with "Oak" somewhere
		// in its name) that would otherwise push the plain city matches below the fold of the
		// scrollable dropdown, making them look missing entirely.
		const options = this.dedupeCustomAirportOptions([...cityPredictions, ...airportAndTerminalOptions]);

		if (this.isLatestCustomSearchVersion('airport', fieldName, requestVersion)) {
			this.setCustomOptions('airport', fieldName, options.length ? options : (selectedOption ? [selectedOption] : []));
			this.setCustomSearchLoading('airport', fieldName, false);
		}
	}

	/**
	 * Whether a place selected in the plain (non-airport) address field is actually an
	 * airport. Deliberately conservative - unlike `isAirportPrediction` (used for the
	 * dedicated airport search, where every candidate is already airport-related and loose
	 * keywords like "parking"/"garage"/"gate" are safe), this only trusts the place's own
	 * `types` or a terminal keyword paired with an IATA code / the word "airport", mirroring
	 * home.component.ts's `isAirportTerminalAddress`/`isTypedAsAirport` heuristic so an
	 * ordinary street address never gets misclassified.
	 */
	private isAirportAddressSelection(option: any, place: google.maps.places.PlaceResult): boolean {
		const types = [...(place?.types || []), ...(option?.types || [])].map((t) => String(t).toLowerCase());
		if (types.some((t) => t === 'airport' || t === 'aerodrome')) {
			return true;
		}

		const combined = [option?.name, option?.description, option?.secondaryText, place?.name, place?.formatted_address]
			.filter(Boolean)
			.join(' ')
			.toLowerCase();
		const hasTerminalKeyword = /\b(terminal|concourse)\b/.test(combined);
		if (!hasTerminalKeyword) {
			return false;
		}

		const hasIataCode = /\b[A-Z]{3}\b/.test([option?.name, option?.description, place?.name].filter(Boolean).join(' '));
		return hasIataCode || combined.includes('airport');
	}

	/**
	 * Flips one end of a leg's transfer type to `kind`, preserving whatever the other end
	 * currently is, so the existing `transfer_type`/`return_transfer_type` valueChanges
	 * pipeline (validators, return-leg mirroring, round-trip swap detection) takes over
	 * exactly as it would for a manual dropdown pick.
	 */
	private setLegEndpointKind(fieldName: 'pickup' | 'dropoff' | 'return_pickup' | 'return_dropoff', kind: 'airport' | 'city'): void {
		const controlName = fieldName.startsWith('return_') ? 'return_transfer_type' : 'transfer_type';
		const control = this.BookingForm.get(controlName);
		const [from, to] = String(control?.value || 'city_to_city').split('_to_');
		const isPickupEnd = fieldName === 'pickup' || fieldName === 'return_pickup';
		const nextType = isPickupEnd ? `${kind}_to_${to || 'city'}` : `${from || 'city'}_to_${kind}`;

		if (control && nextType !== control.value) {
			control.setValue(nextType);
		}
	}

	/** Called once a place typed into the plain address field is detected as an airport. */
	private promoteAddressFieldToAirport(fieldName: 'pickup' | 'dropoff' | 'return_pickup' | 'return_dropoff'): void {
		this.BookingForm.get(fieldName)?.setValue('');
		this.BookingForm.get(`${fieldName}_latitude`)?.setValue('');
		this.BookingForm.get(`${fieldName}_longitude`)?.setValue('');
		this.setLegEndpointKind(fieldName, 'airport');
	}

	/**
	 * The reverse: called once a place selected in the *airport-specific* field turns out to
	 * be an ordinary street address (the airport search falls back to plain predictions when
	 * nothing airport-like matches - see `searchCustomAirport`). Fills the plain address
	 * field instead and clears the airport identity so it doesn't linger.
	 */
	private demoteAirportFieldToCity(fieldName: 'pickup' | 'dropoff' | 'return_pickup' | 'return_dropoff', place: google.maps.places.PlaceResult): void {
		const location = place.geometry?.location;
		if (!location) {
			return;
		}
		const formattedAddress = place.formatted_address ?? '';
		const placeName = place.name ?? '';
		const displayAddress = placeName ? `${placeName} - ${formattedAddress}` : formattedAddress;
		this.fillAddress(fieldName, {
			...place,
			formatted_address: formattedAddress,
			display_address: displayAddress
		});
		this.fillLocationPoints(fieldName, {
			latitude: location.lat(),
			longitude: location.lng()
		});

		const airportField = `${fieldName}_airport`;
		this.BookingForm.get(airportField)?.setValue('');
		this.BookingForm.get(`${airportField}_option`)?.setValue('');
		this.BookingForm.get(`${airportField}_name`)?.setValue('');
		this.BookingForm.get(`${airportField}_latitude`)?.setValue('');
		this.BookingForm.get(`${airportField}_longitude`)?.setValue('');

		this.setLegEndpointKind(fieldName, 'city');
	}

	async selectCustomAddressOption(fieldName: string, option: any): Promise<void> {
		this.clearCustomAddressDropdownBlurTimer();
		this.clearSameLocationErrors();
		const place = await this.fetchPlaceDetails(option?.placeId);
		if (place?.geometry?.location) {
			const isRouteEndpoint = fieldName === 'pickup' || fieldName === 'dropoff'
				|| fieldName === 'return_pickup' || fieldName === 'return_dropoff';
			const extraStopField = this.parseExtraStopFieldKey(fieldName);
			const isAirport = this.isAirportAddressSelection(option, place);

			if (isRouteEndpoint && isAirport) {
				this.handleAirportPlaceSelection(`${fieldName}_airport`, place);
				this.promoteAddressFieldToAirport(fieldName as 'pickup' | 'dropoff' | 'return_pickup' | 'return_dropoff');
				this.closeCustomAddressDropdown(fieldName);
				const optionControlName = `${fieldName}_airport_option`;
				const displayVal = String(this.BookingForm.get(optionControlName)?.value || '').trim();
				this.checkAndShowTerminalPopup(optionControlName, displayVal);
				return;
			}

			const formattedAddress = place.formatted_address ?? '';
			const placeName = place.name ?? '';
			const displayAddress = placeName ? `${placeName} - ${formattedAddress}` : formattedAddress;
			const addressPayload = {
				...place,
				formatted_address: formattedAddress,
				display_address: displayAddress
			};
			if (fieldName === 'loose_customer_address') {
				this.fillLooseCustomerAddress(addressPayload);
			} else if (extraStopField) {
				this.fillExtraStop(extraStopField.formArrayName === 'return_extra_stops', extraStopField.index, addressPayload, {
					latitude: place.geometry.location.lat(),
					longitude: place.geometry.location.lng()
				});
				// A stop has no dedicated airport UI of its own, but it still needs to
				// remember whether the address it holds is an airport so a later drag into
				// Pickup/Dropoff can promote it correctly (see readRoutePoints/writeRoutePoints).
				const stopGroup = this.getExtraStopGroup(fieldName);
				if (stopGroup) {
					if (isAirport) {
						this.applyExtraStopAirportSelection(stopGroup, place);
					} else {
						this.clearExtraStopAirportSelection(stopGroup);
					}
				}
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

	async selectCustomAirportOption(fieldName: string, option: any, skipTerminalCheck: boolean = false): Promise<void> {
		this.clearCustomAirportDropdownBlurTimer();
		this.clearSameLocationErrors();
		const place = await this.fetchPlaceDetails(option?.placeId);
		if (place?.geometry?.location) {
			if (this.isAirportAddressSelection(option, place)) {
				this.handleAirportPlaceSelection(fieldName, place);
			} else {
				// The airport search falls back to plain address predictions when nothing
				// airport-like matches (see searchCustomAirport), so a pick here can turn out
				// to be an ordinary street address - demote the leg back to `city` instead of
				// storing it as an airport.
				const baseFieldName = fieldName.replace(/_airport$/, '') as 'pickup' | 'dropoff' | 'return_pickup' | 'return_dropoff';
				this.demoteAirportFieldToCity(baseFieldName, place);
			}
		}
		this.resetCustomAirportSessionToken(fieldName);
		this.closeCustomAirportDropdown(fieldName);

		if (!skipTerminalCheck) {
			const optionControlName = fieldName.endsWith('_option') ? fieldName : `${fieldName}_option`;
			const displayVal = String(this.BookingForm.get(optionControlName)?.value || '').trim();
			void this.checkAndShowTerminalPopup(optionControlName, displayVal);
		}
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
			number_of_hours: [2],
			prevent_rate_override: this.isAdminMode && this.updateType === "edit" ? [true] : [false],
			acc_id: [''],
			account_type: [this.isTravelAgentMode ? 'travel_planner' : this.isGuestMode ? 'loose_customer' : 'individual'],
			travel_client_id: [''],
			travel_client_acc: ['travel_individual'],
			sub_account_type: ['travel_agent'],
			sub_account_id: [''],
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
		if (value) {
			this.monthOptions = this.months.filter(i => i.value.includes(value))
		}
	}
	handleChangeNoPasengers(value: any) {
		if (value) {
			this.booking_params.numbers = this.numbers.filter(i => i.toString().includes(value))
		}
		else {
			this.booking_params.numbers = this.numbers
		}
	}
	handleChangeLuggaeCOunt(value: any) {
		if (value) {
			this.luggage_options = this.numbers.filter(i => i.toString().includes(value))
		}
		else {
			this.luggage_options = this.numbers
		}
	}

	handleChangeMeetAndGreet(event: any, type: string) {
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
		this.isPrefillingForm = true;
		// console.warn('Prefilling via Booking Id')
		this.$spinner.show('normalspinner');
		if (this.updateType == 'reaffiliate') {
			this.BookingForm.patchValue({
				updateType: 'reaffiliate'
			})
		}
		console.log('DEBUGRATES - PREFILL START | booking_id:', booking_id, '| updateType:', this.Form.updateType.value);
		this.fetchBookingDataForEdit(booking_id, this.Form.updateType.value).subscribe((response: any) => {
			try {
			console.log('DEBUGRATES - PREFILL RESPONSE ARRIVED | suspect field types:', {
				booking_instructions: typeof response?.data?.booking_instructions,
				booking_instructions_value: response?.data?.booking_instructions,
				currency: typeof response?.data?.currency,
				currency_value: response?.data?.currency,
				passenger_cell_isd: typeof response?.data?.passenger_cell_isd,
				passenger_cell_isd_value: response?.data?.passenger_cell_isd,
				extra_stops: typeof response?.data?.extra_stops,
				return_extra_stops: typeof response?.data?.return_extra_stops,
				share_array: typeof response?.data?.share_array,
				pickup_time: response?.data?.pickup_time,
				return_pickup_time: response?.data?.return_pickup_time,
				cruise_time: response?.data?.cruise_time,
				return_cruise_time: response?.data?.return_cruise_time,
				service_type: response?.data?.service_type,
				account_type: response?.data?.account_type,
				reservation_type: response?.data?.reservation_type,
				vehicle_id: response?.data?.vehicle_id,
				affiliate_id: response?.data?.affiliate_id
			});
			response.data.booking_instructions = response.data.booking_instructions.replaceAll('<br />', '')
			console.log('DEBUGRATES - PREFILL CP1 booking_instructions ok');
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

			console.log('DEBUGRATES - PREFILL CP2 json parses ok');
			let currency = editing_data?.currency
			this.httpClient.get("assets/json/currencyOptions.json").subscribe(data => {
				for (const key of Object.keys(data)) {
					if (data[key].currency === currency.toUpperCase()) {
						this.currencyObj = data[key]
						this.currencySymbol = data[key].symbol
					}
				}
			})
			this.bookingResponse = response.data
			this.waiting_time_in_mins = this.bookingResponse?.waiting_time_in_mins
			this.firstLoadVehicleId = response.data.vehicle_id
			this.isUserManualSelection = false;
			this.isUserManualReturnSelection = false;
			this.firstLoadAffiliateId = response.data.affiliate_id
			this.number_of_hours = response?.data?.number_of_hours === 0 ? 2 : response?.data?.number_of_hours
			this.isTravelShare = (this.isTravelAgentMode || response?.data?.account_type == 'travel_planner') && this.updateType != 'repeat' && this.updateType != 'return' && this.updateType != 'round' ? true : false
			this.isFarmoutBooking = (response?.data?.reservation_type == 'farmout' && this.updateType != 'repeat' && this.updateType != 'return' && this.updateType != 'round') ? true : false
			this.isCreatedByAdmin = response?.data?.created_by == 1 ? true : false

			// chooseUser is an admin API; individual mode shows the logged-in user's own card instead
			if (this.isAdminMode && response?.data?.acc_id && response?.data?.account_type != 'loose_customer') {
				this.chooseUser(response.data.acc_id, false, response.data.account_type);
			}

			this.booking_created_from = ((response?.data?.affiliate_id != this.currentUser?.account_id) || response?.data?.created_by_role == 'admin') ? 'admin' : 'subscriber'

			console.log('[DEBUG edit-load] account_type:', response?.data?.account_type, 'acc_id:', response?.data?.acc_id, 'travel_client_id (raw):', response?.data?.travel_client_id, 'typeof:', typeof response?.data?.travel_client_id);
			if (response?.data?.account_type == 'travel_planner') {
				this.getTravelClientAccounts(response?.data?.acc_id)
			}
			// this.SetFormValue('affiliate_type', response.data.affiliate_type)
			console.log('DEBUGRATES - PREFILL CP3 flags/chooseUser ok');
			this.autofillData('cruise', editing_data);
			console.log('DEBUGRATES - PREFILL CP4 autofillData ok');

			// The API signals a pending-driver booking via a standalone is_pending_affiliate
			// flag rather than affiliate_type itself. Resolve the radio button BEFORE the
			// generic SetFormValue loop below: the loop patches affiliate_id, and the
			// affiliate_id / affiliate_type valueChanges handlers branch on affiliate_type.
			// If we correct it only after the loop, those handlers have already run with
			// affiliate_type === 'affiliate' and fired fetchAffiliateDrivers() (the confirmed-
			// driver API) for what is really a pending-affiliate booking.
			const isPendingAffiliate = this.updateType != 'reaffiliate' && (editing_data.is_pending_affiliate === 1 || editing_data.is_pending_affiliate === true || editing_data.is_pending_affiliate === '1')
			const isReturnPendingAffiliate = this.updateType != 'reaffiliate' && (editing_data.return_is_pending_affiliate === 1 || editing_data.return_is_pending_affiliate === true || editing_data.return_is_pending_affiliate === '1')
			if (isPendingAffiliate) {
				this.SetFormValue('affiliate_type', 'in_progress_affiliate')
			}
			if (isReturnPendingAffiliate) {
				this.SetFormValue('return_affiliate_type', 'in_progress_affiliate')
			}

			const isOutboundNoVehicle = this.isAffiliateNoVehicle(
				editing_data.affiliate_type,
				editing_data.is_pending_affiliate,
				editing_data.vehicle_id
			);
			const isReturnNoVehicle = this.isAffiliateNoVehicle(
				editing_data.return_affiliate_type || editing_data.affiliate_type,
				editing_data.return_is_pending_affiliate ?? editing_data.is_pending_affiliate,
				editing_data.return_vehicle_id
			);
			const outboundVehicleFields = [
				'vehicle_type', 'vehicle_type_name', 'vehicle_make', 'vehicle_make_name',
				'vehicle_model', 'vehicle_model_name', 'vehicle_year', 'vehicle_year_name',
				'vehicle_color', 'vehicle_color_name', 'vehicle_license_plate', 'vehicle_seats', 'vehicle_id'
			];
			const returnVehicleFields = [
				'return_vehicle_type', 'return_vehicle_type_name', 'return_vehicle_make', 'return_vehicle_make_name',
				'return_vehicle_model', 'return_vehicle_model_name', 'return_vehicle_year', 'return_vehicle_year_name',
				'return_vehicle_color', 'return_vehicle_color_name', 'return_vehicle_license_plate', 'return_vehicle_seats', 'return_vehicle_id'
			];

			for (let item in editing_data) {
				if (item.includes('extra_stops') || item.includes('languages') || item.includes('dresses') || item.toLowerCase().includes('amenities')) {
					// console.log('Skipping in the case of Extra Stops. ')
				}
				if (item == "passenger_cell_isd") {
					// can come back null/numeric from the API — a raw .includes() here
					// threw and aborted the whole prefill, leaving booking_id unset
					const isd = editing_data[item] === null || editing_data[item] === undefined
						? ''
						: String(editing_data[item]);
					if (isd) {
						this.SetFormValue(item, isd.includes('+') ? isd : '+'.concat(isd));
					}
				}
				if (editing_data[item] && item != "passenger_cell_isd" && typeof editing_data[item] !== 'object') {
					if (this.updateType == 'reaffiliate' && item == 'affiliate_id') continue;
					if (this.updateType == 'reaffiliate' && item == 'affiliate_type') continue;
					// affiliate_type is already resolved above from the is_pending_affiliate
					// flag — don't let the API's raw affiliate_type ('affiliate') overwrite it.
					if (isPendingAffiliate && item == 'affiliate_type') continue;
					if (isReturnPendingAffiliate && item == 'return_affiliate_type') continue;
					if (isOutboundNoVehicle && outboundVehicleFields.includes(item)) continue;
					if (isReturnNoVehicle && returnVehicleFields.includes(item)) continue;

					if (item === 'travel_client_id') {
						console.log('[DEBUG edit-load] loop is about to SetFormValue travel_client_id ->', editing_data[item]);
					}
					if (isNaN(Number(editing_data[item]))) {
						this.SetFormValue(item, editing_data[item]);
					} else {
						this.SetFormValue(item, Number(editing_data[item]));
					}
				}
			}
			console.log('[DEBUG edit-load] after loop, travel_client_id control value:', this.BookingForm.get('travel_client_id')?.value);

			if (isOutboundNoVehicle) {
				this.clearVehiclePreferences(false);
			}
			if (isReturnNoVehicle) {
				this.clearVehiclePreferences(true);
			}

			// Safety net: affiliate_type for pending-driver bookings is resolved before the
			// loop above (and the loop skips the raw API value). Only re-apply here if
			// something in between left the control on the wrong value — avoids an extra
			// valueChanges cycle on the common path.
			if (isPendingAffiliate && this.Form.affiliate_type.value !== 'in_progress_affiliate') {
				this.SetFormValue('affiliate_type', 'in_progress_affiliate')
			}
			if (isReturnPendingAffiliate && this.Form.return_affiliate_type.value !== 'in_progress_affiliate') {
				this.SetFormValue('return_affiliate_type', 'in_progress_affiliate')
			}
			// Handle field name mismatches
			if (editing_data.meet_greet_choice_name) {
				this.SetFormValue('meet_greet_choices_name', editing_data.meet_greet_choice_name);
			}
			console.log('DEBUGRATES - PREFILL CP5 SetFormValue loop ok');
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
			console.log('DEBUGRATES - PREFILL CP6 address lines ok | BigData:', !!this.BigData, '| airlinesData:', Array.isArray(this.BigData?.airlinesData));
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

			console.log('DEBUGRATES - PREFILL CP7 airport/airline block ok');
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

			console.log('DEBUGRATES - PREFILL CP8 images/amenities ok');
			this.prefillExtraStops(editing_data.extra_stops);
			this.prefillExtraStops(editing_data.return_extra_stops, true);
			console.log('DEBUGRATES - PREFILL CP9 extra stops ok');
			this.BookingForm.updateValueAndValidity()

			// override specific value
			this.BookingForm.patchValue({
				service_type: response.data.service_type == 'oneway' ? 'one_way' : response.data['service_type'] == 'roundtrip' ? 'round_trip' : 'charter_tour',
			})
			this.BookingForm.patchValue({
				cancellation_hours: response?.data?.cancellation_hours?.toString() ?? '24'
			})

			console.log('DEBUGRATES - PREFILL CP10 patchValue ok');
			if (editing_data?.pickup_time) {
				this.SetFormValue('pickup_time', this.FormatTime(editing_data.pickup_time));
			}
			if (editing_data?.cruise_time) {
				this.SetFormValue('cruise_time', this.FormatTime(editing_data.cruise_time));
			}
			if (editing_data?.return_pickup_time) {
				this.SetFormValue('return_pickup_time', this.FormatTime(editing_data.return_pickup_time));
			}
			if (editing_data?.return_cruise_time) {
				this.SetFormValue('return_cruise_time', this.FormatTime(editing_data.return_cruise_time));
			}

			// if (this.Form.updateType.value == 'edit') {
			//  this.booking_params.client_account_types.pop()
			// }
			console.log('DEBUGRATES - PREFILL CP11 time formatting ok | about to set booking_id from reservation_id:', this.Form.reservation_id.value);
			this.booking_id = this.Form.reservation_id.value;
			console.log('DEBUGRATES - PREFILL BOOKING_ID SET ->', this.booking_id, '| this is what the rates form receives');
			if ((this.isIndividualMode || this.isTravelAgentMode) && (editing_data?.driver_name || editing_data?.driver_id)) {
				// editing_data is the reservation, so its `id` is the booking id —
				// remap it to the vehicle id before reusing the vehicle-shaped prefill
				this.populateDriverAndVehicleDetails({ ...editing_data, id: editing_data?.vehicle_id });
			}
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
			if (this.updateType == 'edit') {
				// this.SetFormValue('pickup_date', moment().format('YYYY-MM-DD'))
				this.SetFormValue('pickup_date', this.bookingResponse?.pickup_date)
			}
			if (this.updateType == 'repeat' || this.updateType == 'return' || this.updateType == 'round') {
				this.SetFormValue('pickup_date', this.bookingResponse?.pickup_date)
				this.resetPastPickupDateTimeToNow()
				this.queuePrefillTerminalChecks();
			}

			// Instant error display for prefilled values (day bookings arrive as 24/48/… hours)
			const prefilledHours = Number(this.Form.number_of_hours.value);
			if (this.Form.service_type.value == 'charter_tour' && (isNaN(prefilledHours) || prefilledHours < 2)) {
				this.numberOfHoursError = true;
			} else {
				this.numberOfHoursError = false;
			}
			this.isPrefillingForm = false;
			// The affiliate list is paged, so the saved affiliate may not be on
			// the page that loaded while the form was still being patched.
			// Pull it in explicitly or the dropdown renders blank on edit.
			this.ensureSelectedAffiliateLoaded(false);
			this.ensureSelectedAffiliateLoaded(true);
			// The loaded stop list is subject to the same rule as a manually added one, so a
			// booking that arrives with more than two stops opens as a Charter/Tour.
			this.enforceCharterTourForExtraStops();
			this.runEmbeddedQuote();
			console.log('DEBUGRATES - PREFILL CP12 COMPLETE (no throw)');
			if (this.targetFocusElementId) {
				setTimeout(() => {
					this.scrollToTargetElement(this.targetFocusElementId);
				}, 400);
			}
			} catch (e) {
				console.log('DEBUGRATES - PREFILL THREW | message:', e?.message);
				console.log('DEBUGRATES - PREFILL THREW | stack:', e?.stack);
				this.isPrefillingForm = false;
			}
		}, (error: any) => {
			console.log('DEBUGRATES - PREFILL API ERROR | status:', error?.status, '| error:', error);
			this.isPrefillingForm = false;
		});

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
		el.scrollIntoView({ behavior: 'smooth' });
	}

	SetFormValue(form_control: string, value: any, emitEvent: boolean = true) {
		if (!value || !form_control) {
			return
		}
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
			return
		}
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

	/** Expand/collapse the inline route map; the map itself only initializes on first expand. */
	toggleRouteMap(is_return: boolean = false): void {
		if (is_return) {
			this.isReturnRouteMapVisible = !this.isReturnRouteMapVisible;
		} else {
			this.isRouteMapVisible = !this.isRouteMapVisible;
		}
		const visible = is_return ? this.isReturnRouteMapVisible : this.isRouteMapVisible;
		if (visible) {
			// wait for *ngIf to render the map container before initializing
			setTimeout(() => this.MapController(is_return));
		}
	}

	private countryCache = new Map<string, string>();

	private async getCountryForCoordinates(lat: number, lng: number): Promise<string> {
		if (!lat || !lng || !Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
			return '';
		}
		const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
		if (this.countryCache.has(cacheKey)) {
			return this.countryCache.get(cacheKey)!;
		}

		try {
			await this.mapsApiReady();
			const geocoder = new google.maps.Geocoder();
			return await new Promise<string>((resolve) => {
				geocoder.geocode({ location: { lat, lng } }, (results, status) => {
					if (status === 'OK' && results && results.length > 0) {
						for (const result of results) {
							if (result.address_components) {
								for (const component of result.address_components) {
									if (component.types && component.types.includes('country')) {
										const countryCode = component.short_name || component.long_name || '';
										if (countryCode) {
											this.countryCache.set(cacheKey, countryCode);
											resolve(countryCode);
											return;
										}
									}
								}
							}
						}
					}
					resolve('');
				});
			});
		} catch (e) {
			console.error('Error fetching country for coordinates:', e);
			return '';
		}
	}

	private async getCountryForLocation(lat: number, lng: number, addressText?: string): Promise<string> {
		const countryFromCoords = await this.getCountryForCoordinates(lat, lng);
		if (countryFromCoords) {
			return countryFromCoords;
		}

		if (!addressText || typeof addressText !== 'string' || !addressText.trim()) {
			return '';
		}

		const cacheKey = `addr:${addressText.trim().toLowerCase()}`;
		if (this.countryCache.has(cacheKey)) {
			return this.countryCache.get(cacheKey)!;
		}

		try {
			await this.mapsApiReady();
			const geocoder = new google.maps.Geocoder();
			return await new Promise<string>((resolve) => {
				geocoder.geocode({ address: addressText }, (results, status) => {
					if (status === 'OK' && results && results.length > 0) {
						for (const result of results) {
							if (result.address_components) {
								for (const component of result.address_components) {
									if (component.types && component.types.includes('country')) {
										const countryCode = component.short_name || component.long_name || '';
										if (countryCode) {
											this.countryCache.set(cacheKey, countryCode);
											resolve(countryCode);
											return;
										}
									}
								}
							}
						}
					}
					resolve('');
				});
			});
		} catch (e) {
			console.error('Error fetching country for address text:', e);
			return '';
		}
	}

	async _MapController(is_return: boolean = false): Promise<{ distance: number; time: number } | null> {
		try {
			if (is_return) {
				this.hasInvalidReturnRoutePoint = false;
			} else {
				this.hasInvalidRoutePoint = false;
			}

			let waypoints: google.maps.DirectionsWaypoint[] = []
			let origin: google.maps.LatLng
			let destination: google.maps.LatLng
			let map: google.maps.Map | null = null;
			const legLabel = is_return ? 'return' : 'outbound';
			const renderMap = is_return ? this.isReturnRouteMapVisible : this.isRouteMapVisible;

			// Wait for Maps API to be ready (it should be ready when component loads if using @angular/google-maps properly)
			await this.mapsApiReady();

			if (is_return) {
				if (renderMap) {
					const element = document.getElementById('return_map');
					if (!element) throw new Error('Return map element not found');

					map = new google.maps.Map(element, {
						zoom: 7,
						center: { lat: 41.850033, lng: -87.6500523 },
						scaleControl: true
					});
				}

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
				if (renderMap) {
					const element = document.getElementById('map');
					if (!element) throw new Error('Map element not found');

					map = new google.maps.Map(element, {
						zoom: 7,
						center: { lat: 41.850033, lng: -87.6500523 },
						scaleControl: true
					});
				}

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

			// LatLng('', '') and unset form values collapse to (0, 0). Directions then fails
			// and the location-error dialog opens on top of the terminal modal during
			// prefill, before the customer has chosen a point. Wait until both ends exist.
			if (!this.isUsableRoutePoint(origin) || !this.isUsableRoutePoint(destination)) {
				console.warn('[DUAL_POPUP] skipped location error — route coordinates are not ready', {
					is_return,
					origin: { lat: origin?.lat(), lng: origin?.lng() },
					destination: { lat: destination?.lat(), lng: destination?.lng() },
					transfer_type: is_return ? this.Form.return_transfer_type.value : this.Form.transfer_type.value
				});
				return null;
			}

			const pickupAddress = is_return ? (this.Form.return_pickup?.value || '') : (this.Form.pickup?.value || '');
			const dropoffAddress = is_return ? (this.Form.return_dropoff?.value || '') : (this.Form.dropoff?.value || '');

			const pickupCountry = await this.getCountryForLocation(origin.lat(), origin.lng(), pickupAddress);
			const dropoffCountry = await this.getCountryForLocation(destination.lat(), destination.lng(), dropoffAddress);

			if (pickupCountry && dropoffCountry && pickupCountry.toUpperCase() !== dropoffCountry.toUpperCase()) {
				if (is_return) {
					this.hasInvalidReturnRoutePoint = true;
				} else {
					this.hasInvalidRoutePoint = true;
				}
				this.logDualPopup('locationErrorModal', '_MapController:countryMismatch', {
					is_return,
					pickupCountry,
					dropoffCountry,
					pickupAddress,
					dropoffAddress,
					origin: { lat: origin.lat(), lng: origin.lng() },
					destination: { lat: destination.lat(), lng: destination.lng() }
				});
				this.$errors.openDialog({
					errors: {
						error: 'Please select a valid location point.'
					}
				});
				return { distance: 0, time: 0 };
			}

			const request: google.maps.DirectionsRequest = {
				origin,
				destination,
				waypoints,
				optimizeWaypoints: false,
				travelMode: google.maps.TravelMode.DRIVING
			};

			return await this.drawMap(map, request, is_return);
		} catch (error) {
			console.error('Error initializing MapController:', error);
			return null;
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
		const isUsablePair = (lat: number | null, lng: number | null) =>
			lat !== null && lng !== null && Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);

		return isUsablePair(pickupLat, pickupLng) && isUsablePair(dropoffLat, dropoffLng);
	}

	/** (0, 0) is what `new google.maps.LatLng` produces from an empty form value. */
	private isUsableRoutePoint(point: google.maps.LatLng | null | undefined): boolean {
		if (!point || typeof point.lat !== 'function' || typeof point.lng !== 'function') {
			return false;
		}
		const lat = point.lat();
		const lng = point.lng();
		return Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);
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


			if (!endpointUsesAirportCoordinates && hasAddressValue && !hasAddressCoordinates && hasAirportCoordinates) {
				this.SetFormValue(addressLatControl, airportLat, false);
				this.SetFormValue(addressLngControl, airportLng, false);
			}

			if (endpointUsesAirportCoordinates && hasAirportValue && !hasAirportCoordinates && hasAddressCoordinates) {
				this.SetFormValue(airportLatControl, addressLat, false);
				this.SetFormValue(airportLngControl, addressLng, false);
			}

		};

		syncEndpointCoordinates('pickup', transferType.includes('airport_'));
		syncEndpointCoordinates('dropoff', transferType.includes('_airport'));
	}

	private refreshMapIfRouteReady(is_return: boolean = false): void {
		this.syncRouteCoordinatesForTransferType(is_return);
		if (this.hasValidRouteCoordinates(is_return)) {
			this.MapController(is_return);
		}
	}




	// ... inside class ...

	private renderCustomMarkers(
		map: google.maps.Map | null,
		response: google.maps.DirectionsResult,
		is_return: boolean = false
	) {
		if (!map) return;
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
	// `map` may be null when the route-map panel is collapsed: directions are still
	// requested (distance/time feed the rate calculation) but nothing is rendered.
    drawMap(map: google.maps.Map | null, request: google.maps.DirectionsRequest, is_return: boolean): Promise<{ distance: number; time: number } | null> {
		if (!request.origin || !request.destination) {
			console.error('Request object missing origin/destination');
			return Promise.resolve(null);
		}

		// Ensure we get multiple route options so we can pick the shortest
		request.provideRouteAlternatives = true;

		// Clean up previous renderer for this specific journey
		if (is_return) {
			if (this.returnDirectionsRenderer) {
				this.returnDirectionsRenderer.setMap(null);
				this.returnDirectionsRenderer = null;
			}
			if (map) {
				this.returnDirectionsRenderer = new google.maps.DirectionsRenderer({ suppressMarkers: true });
				this.returnDirectionsRenderer.setMap(map);
			}
		} else {
			if (this.pickupDirectionsRenderer) {
				this.pickupDirectionsRenderer.setMap(null);
				this.pickupDirectionsRenderer = null;
			}
			if (map) {
				this.pickupDirectionsRenderer = new google.maps.DirectionsRenderer({ suppressMarkers: true });
				this.pickupDirectionsRenderer.setMap(map);
			}
		}

		const directionsService = new google.maps.DirectionsService();

		return new Promise<{ distance: number; time: number } | null>((resolve) => {
			directionsService.route(request, (response, status) => {
				if (status === google.maps.DirectionsStatus.OK && response) {
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

					this.fetchDistanceAndTime(chosenRoute, is_return).then((res) => {
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
						resolve({ distance: res.distance, time: res.time });
					});
				} else {
					console.error('Directions request failed due to', status);
					const originPoint = request.origin instanceof google.maps.LatLng ? request.origin : null;
					const destinationPoint = request.destination instanceof google.maps.LatLng ? request.destination : null;
					if (!this.isUsableRoutePoint(originPoint) || !this.isUsableRoutePoint(destinationPoint)) {
						console.warn('[DUAL_POPUP] skipped location error — directions failed before coordinates were ready', {
							is_return,
							status,
							origin: originPoint ? { lat: originPoint.lat(), lng: originPoint.lng() } : request.origin,
							destination: destinationPoint ? { lat: destinationPoint.lat(), lng: destinationPoint.lng() } : request.destination
						});
						resolve({ distance: 0, time: 0 });
						return;
					}
					if (is_return) {
						this.hasInvalidReturnRoutePoint = true;
					} else {
						this.hasInvalidRoutePoint = true;
					}
					this.logDualPopup('locationErrorModal', 'drawMap:directionsFailed', {
						is_return,
						status,
						origin: originPoint ? { lat: originPoint.lat(), lng: originPoint.lng() } : request.origin,
						destination: destinationPoint ? { lat: destinationPoint.lat(), lng: destinationPoint.lng() } : request.destination
					});
					this.$errors.openDialog({
						errors: {
							error: 'Please select a valid location point.'
						}
					});
					resolve({ distance: 0, time: 0 });
				}
			});
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
		let address_components = address?.address_components
		// //setting currency based on pickup address country
		if (form_control == 'dropoff' || form_control == 'return_dropoff')
			this.httpClient.get("assets/json/currencyOptions.json").subscribe(data => {
				for (const key of Object.keys(data)) {
					if (address_components.find(component => component.long_name === data[key].countryName)) {
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

	/** Shared by any control that resolves a Google place into an airport identity - a
	 * dedicated airport field, a plain address field detected as an airport, or a stop. */
	private computeAirportFieldsFromPlace(place: google.maps.places.PlaceResult): { option: string; name: string; latitude: number; longitude: number; id: string } | null {
		const location = place.geometry?.location;
		if (!location) {
			return null;
		}
		const displayValue = this.getAirportSelectionLabel(place);
		const latitude = location.lat();
		const longitude = location.lng();
		const matchedAirport = this.resolveInternalAirportRecord(place, latitude, longitude);

		return {
			option: displayValue,
			name: displayValue,
			latitude,
			longitude,
			id: matchedAirport?.id ?? ''
		};
	}

	handleAirportPlaceSelection(formControl: string, place: google.maps.places.PlaceResult) {
		const airportFields = this.computeAirportFieldsFromPlace(place);
		if (!airportFields) {
			return;
		}

		this.BookingForm.get(`${formControl}_option`)?.setValue(airportFields.option);
		this.BookingForm.get(`${formControl}_name`)?.setValue(airportFields.name);
		this.BookingForm.get(`${formControl}_latitude`)?.setValue(airportFields.latitude);
		this.BookingForm.get(`${formControl}_longitude`)?.setValue(airportFields.longitude);
		this.BookingForm.get(formControl)?.setValue(airportFields.id);
		this.BookingForm.updateValueAndValidity();


		if (formControl === 'dropoff_airport' || formControl === 'return_dropoff_airport') {
			this.updateCurrencyFromAirportPlace(place);
		}
	}

	/** Flags an extra stop as an airport so a later reorder can promote it correctly. */
	private applyExtraStopAirportSelection(stopGroup: FormGroup, place: google.maps.places.PlaceResult): void {
		const airportFields = this.computeAirportFieldsFromPlace(place);
		if (!airportFields) {
			return;
		}
		stopGroup.patchValue({
			kind: 'airport',
			airport: airportFields.id,
			airport_option: airportFields.option,
			airport_name: airportFields.name,
			airport_latitude: airportFields.latitude,
			airport_longitude: airportFields.longitude
		});
	}

	/** Un-flags an extra stop's airport identity once a non-airport address replaces it. */
	private clearExtraStopAirportSelection(stopGroup: FormGroup): void {
		stopGroup.patchValue({
			kind: 'city',
			airport: '',
			airport_option: '',
			airport_name: '',
			airport_latitude: '',
			airport_longitude: ''
		});
	}

	clearAddressField(formControl: string) {
		this.clearSameLocationErrors();
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
		this.clearSameLocationErrors();
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
		console.log('DEBUGRATES - CHECKANDPREFILL | BigData loaded:', !!this.BigData, '| reservation_id:', this.Form.reservation_id.value, '| current booking_id:', this.booking_id);
		if (this.BigData && this.Form.reservation_id.value) {
			this.prefillViaBookingID(this.Form.reservation_id.value);
		} else {
			console.log('DEBUGRATES - CHECKANDPREFILL SKIPPED (no prefill will run from this call)');
		}
	}


	fetchClientAccounts(account_type: string) {
		const legend = {
			individual: 'individual',
			// corporate: 'corporate',
			travel_planner: 'travel'
		}
		console.log("fetchClientAccounts", account_type, legend[account_type])

		// fail-safe
		if (!legend.hasOwnProperty(account_type)) {
			console.error('Invalid Account type: ', account_type)
			return
		}
		else {
			if(this.usesQuoteFlow) {return;};
			this.$spinner.show()
			console.log("Fetching accounts for affiliate mode", this.isAffiliateMode);
			if (this.isAffiliateMode) {
				console.log("Fetching accounts for affiliate mode");
				this.affiliateService.getAccountBytype(legend[account_type]).subscribe((response: any) => {
					if (response.success && response.data.length > 0) {
						this.ClientAccounts = response.data;
						this.ClientAccounts_Original = [...this.ClientAccounts];
					}
					else {
						this.ClientAccounts = [];
						this.ClientAccounts_Original = [];
					}
					this.$spinner.hide()
				})
			} else {
				this.$api.getAccountBytype(legend[account_type]).subscribe((response: any) => {
					if (response.success && response.data.length > 0) {
						this.ClientAccounts = response.data;
						this.ClientAccounts_Original = [...this.ClientAccounts];
					}
					else {
						this.ClientAccounts = [];
						this.ClientAccounts_Original = [];
					}
					this.$spinner.hide()
				})
			}
		}
	}

	handleClientSearch(event: any) {
		const term = event.term;
		if (!term) {
			this.ClientAccounts = [...this.ClientAccounts_Original];
			return;
		}
		const lowerTerm = term.toLowerCase();
		this.ClientAccounts = [...this.ClientAccounts_Original].sort((a, b) => {
			const aName = a.name.toLowerCase();
			const bName = b.name.toLowerCase();
			const aStarts = aName.startsWith(lowerTerm);
			const bStarts = bName.startsWith(lowerTerm);
			if (aStarts && !bStarts) return -1;
			if (!aStarts && bStarts) return 1;
			return 0;
		});
	}

	onSelectionChangeServiceType(event: any) {
		this.service_type = event.value;
		// A manual pick owns the field from here on, so stop explaining the automatic switch.
		this.autoConvertedToCharterTour = false;
		// Patch to ensure all bound mat-select instances reflect the new value
		this.BookingForm.get('service_type')?.setValue(event.value, { emitEvent: false });
		this.buildBookingData();
	}

	selectBrowseTab() {
		this.vehicleSelectionTab = 'browse';
		const hasPickup = !!(this.BookingForm.get('pickup_latitude')?.value || this.BookingForm.get('pickup_airport_latitude')?.value);
		const hasDropoff = !!(this.BookingForm.get('dropoff_latitude')?.value || this.BookingForm.get('dropoff_airport_latitude')?.value);
		if (hasPickup && hasDropoff) {
			this.runEmbeddedQuote();
		}
	}

	changeReturnTransferType(event: any) {
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
	}

	chooseUser(account_id: number, autofill: boolean = true, account_type: string = '') {
		if (this.isGuestMode) {return;};
		this.$spinner.show()
		this.chosen_user = {}
		let accType = account_type ? account_type : this.Form.account_type.value;
		const handleResponse = (response: any) => {
			if (response.success && Object.keys(response.data).length > 0) {
				this.chosen_user = response.data
				this.chosen_user['name'] = `${response.data.first_name} ${response.data.middle_name ?? ''} ${response.data.last_name}`
				if (autofill) {
					this.autofillData('passenger', this.chosen_user);
				}
			}
			this.$spinner.hide();
		};
		if (this.isAffiliateMode) {
			this.affiliateService.chooseUser(account_id, accType).subscribe(handleResponse);
		} else {
			this.$api.chooseUser(account_id, accType).subscribe(handleResponse);
		}
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
		if(this.isAffiliateMode || this.isGuestMode) {return;};
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
		if (this.isIndividualMode || this.isAffiliateMode || this.isGuestMode) {
			return false;
		}
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
	getTravelClientAccounts(id?: any) {
		if (this.isTravelAgentMode) {
			this.TravelAgentService.getAllTravelClientAccountList('individual').then((result: any) => {
				console.log("accounts->>>>>>>>>>", result);
				this.travelStaffAccounts = result?.data;
				this.travelStaffAccounts_Original = result?.data ? [...result.data] : [];
				this.syncPrefilledTravelClientSelection();
			})
			.catch(err => {
				this.$spinner.hide();
			});
		} else {
			if(this.shouldBlockAdminApi) {return;};
			this.$api.getTravelClientAccount(id).subscribe((response: any) => {
				console.log("getTravelClientAccount response:", response);
				this.travelStaffAccounts = response?.data;
				this.travelStaffAccounts_Original = response?.data ? [...response.data] : [];
				this.syncPrefilledTravelClientSelection();
			})
		}
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
		console.log("handleClientAccount", value);
		this.chooseUser(value.id)
		if (this.BookingForm.get('account_type').value == 'travel_planner') {
				console.log("handleClientAccount travel_planner", value);
			this.BookingForm.patchValue({
				travel_client_id: ''
			})
			console.log("handleClientAccount travel_planner", value.id);
			this.getTravelClientAccounts(value.id)
		}

	}

	handleChangeTravelAccounts(selectedAcc) {
		const travel_client_id = this.BookingForm.get('travel_client_id');
		console.log("handleChangeTravelAccounts", selectedAcc, travel_client_id);
		if (travel_client_id) {
			if (selectedAcc == 'travel_individual') {
				travel_client_id.setValidators([Validators.required]);
				travel_client_id.updateValueAndValidity();
			}
			else {
				if (this.isTravelAgentMode) {
					setTimeout(() => {
						this.initphonefield();
						this.initAllAutocompletes();
					}, 200);
				}
				travel_client_id.clearValidators();
				travel_client_id.updateValueAndValidity();
			}
		}

		if (!this.isTravelAgentMode) {
			const travelAdvisorId = this.Form?.acc_id?.value;
			const travelClientId = this.Form?.travel_client_id?.value;
			this.loadCombinedSavedCards(
				travelClientId,
				selectedAcc == 'travel_individual',
				travelAdvisorId
			);
		}

	}
	handleTravelStaffAccounts(value: any) {
		if (this.isTravelAgentMode) {
			try {
				console.log('handleTravelStaffAccounts--->>>', value);
				this.TravelAgentService.getTravelClientDetailById(value.id).subscribe((response: any) => {
					console.log("detail ->>>>>>>", response);
					this.autofillData('passenger', response?.data);
				});
			} catch (error) {
				console.log('error--->>>>', error);
			}
		} else {
			if(this.shouldBlockAdminApi) {return;};
			this.$api.getTravelClientDetailById(value.id).subscribe((response: any) => {
				if (this.isPrefilling) {
					this.autofillData('passenger', response?.data);

				}
				this.isPrefilling = true;

			})
			this.loadCombinedSavedCards(value?.id, this.Form.travel_client_acc?.value === 'travel_individual', this.Form?.acc_id?.value);
		}
	}

	/**
	 * Individual mode: the booking always belongs to the logged-in user.
	 * Loads their account details, autofills passenger info and shows the
	 * read-only account card (mirrors individual/create-new-booking handleTravelStaffAccounts).
	 */
	loadIndividualAccount() {
		this.$spinner.show()
		this.individualService.getAccountDetails().subscribe((response: any) => {
			this.$spinner.hide();
			this.autofillData('passenger', response?.data);
			this.chosen_user = response?.data || {}
			if (response?.data) {
				this.chosen_user['name'] = `${response.data.first_name} ${response.data.middle_name ?? ''} ${response.data.last_name}`
			}
		})
	}

	handleLooseCustomerPhone(event: any) {
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

	fetchAffiliates(affiliate_type: 'affiliate' | 'loose_affiliate' | 'in_progress_affiliate') {
		if (affiliate_type == 'loose_affiliate') {
			if(this.shouldBlockAdminApi) {return;};
			this.$spinner.show()
			this.$api.getAccountBytype('loose_affiliate').subscribe((response: any) => {
				this.LooseAffiliateAccounts = this.appendOperatorToLooseAffiliates(response?.data)
				this.$spinner.hide()
			})
			return;
		}

		this.AffiliateAccounts = []
		if(this.usesQuoteFlow) {return;};

		this.loadAffiliates(false, { reset: true });
	}

	fetchReturnAffiliates(return_affiliate_type: 'affiliate' | 'loose_affiliate' | 'in_progress_affiliate') {
		if (return_affiliate_type == 'loose_affiliate') {
			if(this.shouldBlockAdminApi) {return;};
			this.$spinner.show()
			const handleResponse = (response: any) => {
				this.Return_LooseAffiliateAccounts = this.appendOperatorToLooseAffiliates(response?.data)
				this.$spinner.hide()
			};
			if (this.isAffiliateMode) {
				this.affiliateService.getAccountBytype('loose_affiliate').subscribe(handleResponse);
			} else {
				this.$api.getAccountBytype('loose_affiliate').subscribe(handleResponse);
			}
			return;
		}

		this.Return_AffiliateAccounts = []
		if(this.shouldBlockAdminApi) {return;};

		this.loadAffiliates(true, { reset: true });
	}

	/**
	 * Load a page of approved affiliates from the API.
	 *
	 * The list is searched, ranked and paged server side. `reset` starts a new
	 * list (affiliate type change, new search term, pickup moved); without it
	 * the next page is appended for infinite scroll.
	 */
	private loadAffiliates(isReturn: boolean, opts: { reset?: boolean; term?: string } = {}) {

		const state = isReturn ? this.returnAffiliateLookup : this.affiliateLookup;

		// No logged-in user (guest quotebot visitor) - the affiliate lookup is a
		// portal API, so skip it entirely.
		if (this.currentUser == null) {
			return;
		}

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
			// falls outside the current page or search term, so editing an
			// existing booking never renders a blank dropdown.
			ids: selectedId ? [selectedId] : []
		};

		if (state.page === 1) {
			this.$spinner.show();
		}

		const service = this.isAffiliateMode ? this.affiliateService : this.$api;
		
		const accountType = this.affiliateAccountType(isReturn);

		service.getAccountBytype(accountType, params).subscribe({
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

				state.items = state.page === 1 ? mapped : this.mergeAffiliates(state.items, mapped);
				state.hasMore = meta ? meta.has_more : false;
				state.total = meta ? meta.total : state.items.length;
				state.loading = false;

				this.setAffiliateItems(isReturn, state.items);

				if (accountType === 'pending_driver') {
					this.syncSelectedPendingAffiliate(isReturn, state.items);
				}

				this.$spinner.hide();
			},
			error: () => {
				if (requestId === state.requestId) {
					state.loading = false;
					// Undo the optimistic page bump so a retry re-requests the
					// page that failed rather than skipping it.
					if (!opts.reset && state.page > 1) {
						state.page -= 1;
					}
				}
				this.$spinner.hide();
			}
		});
	}

	/**
	 * Which account list backs the picker for this leg.
	 *
	 * Both lists come from the same endpoint and are searched, ranked and paged
	 * the same way; `pending_driver` just carries the extra onboarding fields.
	 */
	private affiliateAccountType(isReturn: boolean): 'driver' | 'pending_driver' {
		const affiliateType = isReturn
			? this.Form.return_affiliate_type.value
			: this.Form.affiliate_type.value;

		return affiliateType === 'in_progress_affiliate' ? 'pending_driver' : 'driver';
	}

	/**
	 * Keep the pending-affiliate detail panel in step with the loaded page.
	 *
	 * The panel reads off the selected row rather than the form, so it has to
	 * be re-resolved whenever the list is replaced by a search or a new page.
	 */
	private syncSelectedPendingAffiliate(isReturn: boolean, items: any[]) {
		const selectedId = this.BookingForm.get(isReturn ? 'return_affiliate_id' : 'affiliate_id')?.value;

		if (!selectedId) {
			return;
		}

		const selected = items.find((item: any) => item.id == selectedId) || null;

		// This runs on every list reload for the pending-affiliate picker, including
		// ones unrelated to the selection itself (e.g. ng-select clearing its search
		// box after a pick, which re-triggers an unsearched page-1 fetch). That page
		// may simply not include the already-selected row. Don't let a page that
		// doesn't happen to contain the selection clobber a selection we already
		// resolved correctly - only replace it when we either found a fresh match or
		// the current value doesn't match the selected id (i.e. it's genuinely stale).
		const current = isReturn ? this.selectedReturnPendingAffiliate : this.selectedPendingAffiliate;
		if (!selected && current?.id == selectedId) {
			return;
		}

		if (isReturn) {
			this.selectedReturnPendingAffiliate = selected;
		} else {
			this.selectedPendingAffiliate = selected;
		}

		if (selected) {
			setTimeout(() => { this.initphonefield(); }, 200);
		}
	}

	/**
	 * Make sure the affiliate currently selected on the form is present in the
	 * dropdown's items, fetching it on its own if the loaded pages missed it.
	 *
	 * Without this, opening an existing booking whose affiliate ranks below the
	 * first page shows an empty control and a save would silently clear it.
	 */
	private ensureSelectedAffiliateLoaded(isReturn: boolean) {
		const affiliateType = isReturn
			? this.Form.return_affiliate_type.value
			: this.Form.affiliate_type.value;

		if (affiliateType !== 'affiliate' && affiliateType !== 'in_progress_affiliate') {
			return;
		}

		const selectedId = this.BookingForm.get(isReturn ? 'return_affiliate_id' : 'affiliate_id')?.value;
		if (!selectedId) {
			return;
		}

		const state = isReturn ? this.returnAffiliateLookup : this.affiliateLookup;
		if (state.items.some((item: any) => item.id == selectedId)) {
			return;
		}

		const service = this.isAffiliateMode ? this.affiliateService : this.$api;
		const accountType = this.affiliateAccountType(isReturn);

		service.getAccountBytype(accountType, { ids: [selectedId], only_ids: true }).subscribe((response: any) => {
			const { rows } = readAffiliateLookupResponse(response);
			const match = rows.find((item: any) => item.id == selectedId);

			if (!match) {
				return;
			}

			match.bindNameAffiliate = buildRankedAffiliateLabel(match);
			state.items = this.mergeAffiliates([match], state.items);
			this.setAffiliateItems(isReturn, state.items);
		});
	}

	/** Append a page, dropping ids already present (the pinned `ids` row repeats). */
	private mergeAffiliates(existing: RankedAffiliate[], incoming: RankedAffiliate[]): RankedAffiliate[] {
		const seen = new Set(existing.map((item) => item.id));
		return existing.concat(incoming.filter((item) => !seen.has(item.id)));
	}

	/** Publish the loaded rows to whichever array the template binds for this leg. */
	private setAffiliateItems(isReturn: boolean, items: any[]) {
		if (isReturn) {
			this.Return_AffiliateAccounts = items;
		} else {
			this.AffiliateAccounts = items;
		}
	}

	/**
	 * Pickup coordinates for the given leg, or null when none are set yet.
	 *
	 * Airport pickups keep their coordinates in a different pair of controls
	 * from address pickups, chosen by transfer type - the same rule
	 * `hasValidRouteCoordinates` uses.
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

		const lat = this.parseRouteCoordinate(this.BookingForm.get(latControl)?.value);
		const lng = this.parseRouteCoordinate(this.BookingForm.get(lngControl)?.value);

		if (lat === null || lng === null || (lat === 0 && lng === 0)) {
			return null;
		}

		return { lat, lng };
	}

	/**
	 * Debounce affiliate search keystrokes into one request per leg.
	 *
	 * `distinctUntilChanged` on leg+term stops a re-render or a repeated
	 * keystroke from re-requesting a list that is already on screen.
	 */
	private initAffiliateSearchStream() {
		const wire = (source: Subject<string>, isReturn: boolean) => {
			source
				.pipe(
					debounceTime(this.affiliateSearchDebounceMs),
					map((term: string) => (term || '').trim()),
					distinctUntilChanged(),
					takeUntil(this.formSubscriptionsReset$)
				)
				.subscribe((term: string) => {
					const affiliateType = isReturn
						? this.Form.return_affiliate_type.value
						: this.Form.affiliate_type.value;

					// Loose affiliates are a different list with its own picker.
					if (affiliateType !== 'affiliate' && affiliateType !== 'in_progress_affiliate') {
						return;
					}

					this.loadAffiliates(isReturn, { reset: true, term });
				});
		};

		wire(this.affiliateTypeahead$, false);
		wire(this.returnAffiliateTypeahead$, true);

		this.initAffiliatePickupWatch();
	}

	/**
	 * Reload the affiliate list when the pickup moves.
	 *
	 * The ordering is relative to the pickup, so a list ranked against the old
	 * address is stale the moment the address changes. Coordinates are compared
	 * before refetching because these controls are rewritten with identical
	 * values on several paths (round-trip mirroring, quote hydration).
	 */
	private initAffiliatePickupWatch() {
		const legs: Array<{ isReturn: boolean; controls: string[] }> = [
			{
				isReturn: false,
				controls: ['pickup_latitude', 'pickup_longitude', 'pickup_airport_latitude', 'pickup_airport_longitude', 'transfer_type']
			},
			{
				isReturn: true,
				controls: ['return_pickup_latitude', 'return_pickup_longitude', 'return_pickup_airport_latitude', 'return_pickup_airport_longitude', 'return_transfer_type']
			}
		];

		legs.forEach(({ isReturn, controls }) => {
			const changes$ = new Subject<void>();

			controls.forEach((name) => {
				this.BookingForm.get(name)?.valueChanges
					.pipe(takeUntil(this.formSubscriptionsReset$))
					.subscribe(() => changes$.next());
			});

			changes$
				.pipe(
					debounceTime(this.affiliateSearchDebounceMs),
					map(() => {
						const coords = this.getPickupCoords(isReturn);
						return coords ? `${coords.lat},${coords.lng}` : '';
					}),
					distinctUntilChanged(),
					takeUntil(this.formSubscriptionsReset$)
				)
				.subscribe(() => {
					if (this.isPrefillingForm) {
						return;
					}

					const affiliateType = isReturn
						? this.Form.return_affiliate_type.value
						: this.Form.affiliate_type.value;

					if (affiliateType !== 'affiliate' && affiliateType !== 'in_progress_affiliate') {
						return;
					}

					this.loadAffiliates(isReturn, { reset: true });
				});
		});
	}

	/** ng-select `(scrollToEnd)` - pulls the next page. */
	loadMoreAffiliates(isReturn: boolean = false) {
		const affiliateType = isReturn ? this.Form.return_affiliate_type.value : this.Form.affiliate_type.value;

		if (affiliateType !== 'affiliate' && affiliateType !== 'in_progress_affiliate') {
			return;
		}

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

	/** Onboarding progress badge text for a pending affiliate, e.g. "Step 3/5". */
	affiliateStepBadgeText(item: any): string {
		return affiliateStepBadge(item);
	}

	/** Colour modifier for the onboarding badge, graded by progress. */
	affiliateStepClass(item: any): string {
		return affiliateStepModifier(item);
	}

	/** Tooltip spelling out which onboarding steps are done. */
	affiliateStepTitle(item: any): string {
		const steps = item?.step_completed;

		if (!Array.isArray(steps) || !steps.length) {
			return 'Onboarding not started';
		}

		const ordered = steps
			.map((step) => Number(step))
			.filter((step) => Number.isFinite(step))
			.sort((a, b) => a - b);

		return `Completed onboarding steps: ${ordered.join(', ')}`;
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
		// User picked an affiliate from the dropdown: rebuild booking_data so
		// rates-form recalculates. The token bump marks this as an explicit pick,
		// which bypasses rates-form's unchanged-data / hydration-baseline guards.
		if (value?.id) {
			this.rateRefreshToken++;
			this.buildBookingData();
		}
	}
	handleLooseAffiliateChange(looseAffData) {
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

			// Round trip: carry the picked loose affiliate over to the return journey,
			// same as the regular-affiliate flow mirrors affiliate_id to return_affiliate_id.
			if (this.BookingForm.get('service_type').value == 'round_trip') {
				if (this.BookingForm.get('return_affiliate_type').value != 'loose_affiliate') {
					this.BookingForm.patchValue({ return_affiliate_type: 'loose_affiliate' })
				}
				this.handleReturnLooseAffiliateChange(looseAffData)
			}
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
	}
	handleReturnLooseAffiliateChange(looseAffData) {
		if (looseAffData) {
			this.BookingForm.patchValue({
				return_driver_name: looseAffData?.driver_name,
				return_driver_cell: looseAffData?.driver_phone,
				return_driver_email: looseAffData?.driver_email,
				return_loose_affiliate_id: looseAffData?.id,
				return_is_old_loose_affiliate: true,
				return_driver_cell_isd: looseAffData?.driver_isd,
				return_driver_cell_country: looseAffData?.driver_phone_country
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
	}
	isAffiliateNoVehicle(affiliateType: any, isPendingAffiliateVal: any, vehicleIdVal: any): boolean {
		const isAffiliate = affiliateType === 'affiliate';
		const isPending = isPendingAffiliateVal === 1 || isPendingAffiliateVal === '1' || isPendingAffiliateVal === true;
		const isVehicleNull = vehicleIdVal === null || vehicleIdVal === undefined || vehicleIdVal === '' || vehicleIdVal === 0 || vehicleIdVal === '0';

		return isAffiliate && !isPending && isVehicleNull;
	}

	clearVehiclePreferences(isReturn: boolean = false): void {
		const prefix = isReturn ? 'return_' : '';
		const fieldsToReset = [
			`${prefix}vehicle_type`,
			`${prefix}vehicle_type_name`,
			`${prefix}vehicle_make`,
			`${prefix}vehicle_make_name`,
			`${prefix}vehicle_model`,
			`${prefix}vehicle_model_name`,
			`${prefix}vehicle_year`,
			`${prefix}vehicle_year_name`,
			`${prefix}vehicle_color`,
			`${prefix}vehicle_color_name`,
			`${prefix}vehicle_license_plate`,
			`${prefix}vehicle_seats`,
			`${prefix}vehicle_id`
		];

		fieldsToReset.forEach((field: string) => {
			if (this.BookingForm.get(field)) {
				this.BookingForm.get(field).setValue('', { emitEvent: false });
			}
		});

		if (isReturn) {
			this.return_selectedVehicle = null;
		} else {
			this.selectedVehicle = null;
		}
	}

	chooseAffiliate() {
		// console.warn('Fetching Affiliate vehicles and drivers')
		this.fetchAffiliateVehicles(this.BookingForm.get('affiliate_id').value)
		this.fetchAffiliateDrivers(this.BookingForm.get('affiliate_id').value)

		const affType = this.Form.affiliate_type.value;
		const isPending = this.selectedPendingAffiliate ? 1 : (this.bookingResponse?.is_pending_affiliate ?? 0);
		const vehId = this.Form.vehicle_id.value;
		if (this.isAffiliateNoVehicle(affType, isPending, vehId)) {
			this.clearVehiclePreferences(false);
		}
	}

	chooseLooseAffiliate() {
		// console.warn('Fetching Affiliate vehicles and drivers')
		this.fetchLooseAffiliateVehicles(this.BookingForm.get('loose_affiliate_id').value)
		// this.fetchAffiliateDrivers(this.BookingForm.get('affiliate_id').value)
	}

	choosePendingAffiliate(selectedAffiliate: any) {
		this.selectedPendingAffiliate = selectedAffiliate;

		const fieldsToReset = [
			'vehicle_type',
			'vehicle_type_name',
			'vehicle_id',
			'vehicle_make',
			'vehicle_make_name',
			'vehicle_model',
			'vehicle_model_name',
			'vehicle_color',
			'vehicle_color_name',
			'vehicle_year',
			'vehicle_year_name',
			'vehicle_license_plate',
			'driver_id',
			'driver_name',
			'driver_gender',
			'driver_cell',
			'driver_email'
		];

		fieldsToReset.forEach((item: string) => {
			if (this.BookingForm.get(item)) {
				this.BookingForm.get(item).reset();
			}
		});

		this.VehicleList = [];
		this.DriverList = [];

		if (selectedAffiliate) {
			const dName = selectedAffiliate.driver_name || selectedAffiliate.name || '';
			const dPhoneRaw = selectedAffiliate.driver_phone || selectedAffiliate.phone || '';
			const dPhone = dPhoneRaw ? dPhoneRaw.toString().replace(/[^0-9+]/g, '') : '';
			const dEmail = selectedAffiliate.driver_email || selectedAffiliate.email || '';
			const dCountry = this.resolveCountryFromAffiliate(selectedAffiliate) || 'us';
			const rawIsd = selectedAffiliate.driver_phone_isd || selectedAffiliate.driver_isd || selectedAffiliate.phone_isd || selectedAffiliate.isd || selectedAffiliate.cell_isd || '';
			const dIsd = rawIsd ? (rawIsd.startsWith('+') ? rawIsd : `+${rawIsd}`) : '';

			this.BookingForm.patchValue({
				...(dName ? { driver_name: dName } : {}),
				...(dPhone ? { driver_cell: dPhone } : {}),
				...(dEmail ? { driver_email: dEmail } : {}),
				driver_cell_country: dCountry,
				...(dIsd ? { driver_cell_isd: dIsd } : {})
			});
		}

		this.BookingForm.updateValueAndValidity();

		if (selectedAffiliate) {
			setTimeout(() => {
				this.initphonefield();
				if (this.driverCellTelInput && selectedAffiliate) {
					const dCountry = this.resolveCountryFromAffiliate(selectedAffiliate);
					if (dCountry) {
						this.driverCellTelInput.setCountry(dCountry);
					}
				}
			}, 200);
		}

		// has_vehicle comes from the get-account-by-type/pending_driver API response item
		if (this.BookingForm.get('affiliate_type')?.value == 'in_progress_affiliate' && selectedAffiliate?.has_vehicle) {
			this.fetchAffiliateVehicles(selectedAffiliate.id);
		}
		if (this.BookingForm.get('affiliate_type')?.value == 'in_progress_affiliate' && selectedAffiliate?.has_driver_info) {
			this.fetchAffiliateDrivers(selectedAffiliate?.id);
		}
	}

	chooseReturnPendingAffiliate(selectedAffiliate: any) {
		this.selectedReturnPendingAffiliate = selectedAffiliate;

		const fieldsToReset = [
			'return_vehicle_type',
			'return_vehicle_type_name',
			'return_vehicle_id',
			'return_vehicle_make',
			'return_vehicle_make_name',
			'return_vehicle_model',
			'return_vehicle_model_name',
			'return_vehicle_color',
			'return_vehicle_color_name',
			'return_vehicle_year',
			'return_vehicle_year_name',
			'return_vehicle_license_plate',
			'return_driver_id',
			'return_driver_name',
			'return_driver_gender',
			'return_driver_cell',
			'return_driver_email'
		];

		fieldsToReset.forEach((item: string) => {
			if (this.BookingForm.get(item)) {
				this.BookingForm.get(item).reset();
			}
		});

		this.return_VehicleList = [];
		this.return_DriverList = [];

		if (selectedAffiliate) {
			const dName = selectedAffiliate.driver_name || selectedAffiliate.name || '';
			const dPhoneRaw = selectedAffiliate.driver_phone || selectedAffiliate.phone || '';
			const dPhone = dPhoneRaw ? dPhoneRaw.toString().replace(/[^0-9+]/g, '') : '';
			const dEmail = selectedAffiliate.driver_email || selectedAffiliate.email || '';
			const dCountry = this.resolveCountryFromAffiliate(selectedAffiliate) || 'us';
			const rawIsd = selectedAffiliate.driver_phone_isd || selectedAffiliate.driver_isd || selectedAffiliate.phone_isd || selectedAffiliate.isd || selectedAffiliate.cell_isd || '';
			const dIsd = rawIsd ? (rawIsd.startsWith('+') ? rawIsd : `+${rawIsd}`) : '';

			this.BookingForm.patchValue({
				...(dName ? { return_driver_name: dName } : {}),
				...(dPhone ? { return_driver_cell: dPhone } : {}),
				...(dEmail ? { return_driver_email: dEmail } : {}),
				return_driver_cell_country: dCountry,
				...(dIsd ? { return_driver_cell_isd: dIsd } : {})
			});
		}

		this.BookingForm.updateValueAndValidity();

		if (selectedAffiliate) {
			setTimeout(() => {
				this.initphonefield();
				if (this.returnDriverCellTelInput && selectedAffiliate) {
					const dCountry = this.resolveCountryFromAffiliate(selectedAffiliate);
					if (dCountry) {
						this.returnDriverCellTelInput.setCountry(dCountry);
					}
				}
			}, 200);
		}

		if (this.BookingForm.get('return_affiliate_type')?.value == 'in_progress_affiliate' && selectedAffiliate?.has_vehicle) {
			this.fetchReturnAffiliateVehicles(selectedAffiliate.id);
			this.fetchReturnAffiliateDrivers(selectedAffiliate.id);
		}
	}

	chooseReturnAffiliate() {
		// console.warn('Fetching Affiliate vehicles and drivers')
		this.fetchReturnAffiliateVehicles(this.BookingForm.get('return_affiliate_id').value)
		this.fetchReturnAffiliateDrivers(this.BookingForm.get('return_affiliate_id').value)

		const returnAffType = this.Form.return_affiliate_type.value;
		const isReturnPending = this.selectedReturnPendingAffiliate ? 1 : (this.bookingResponse?.return_is_pending_affiliate ?? 0);
		const returnVehId = this.Form.return_vehicle_id.value;
		if (this.isAffiliateNoVehicle(returnAffType, isReturnPending, returnVehId)) {
			this.clearVehiclePreferences(true);
		}
	}

	chooseReturnLooseAffiliate() {
		// console.warn('Fetching Affiliate vehicles and drivers')
		this.fetchReturnLooseAffiliateVehicles(this.BookingForm.get('return_loose_affiliate_id').value)
		// this.fetchReturnAffiliateDrivers(this.BookingForm.get('return_affiliate_id').value)
	}

	fetchAffiliateInformation(affiliate_id: number) {
		if(this.usesQuoteFlow) {return;};
		if (!affiliate_id) {
			console.error('Invalid Parameter affiliate_id', affiliate_id);
			return;
		}
		this.$spinner.show('normalspinner');
		const handleResponse = (response: any) => {
			console.info('Affiliate Information', response);
			this.AffiliateInformation = response;
			console.log('AffiliateInformation', this.AffiliateInformation, this.affiliate_id);
			if (this.booking_created_from == 'admin') {
				this.BookingForm.patchValue({
					susbcriber_name: this.AffiliateInformation?.FirstName + ' ' + this.AffiliateInformation?.LastName
				})
			}
			this.$spinner.hide('normalspinner');
		};
		if (this.isAffiliateMode) {
			this.affiliateService.getAffiliateAccount(affiliate_id).pipe(pluck('data')).subscribe(handleResponse);
		} else {
			this.$api.getAffiliateAccount(affiliate_id).pipe(pluck('data')).subscribe(handleResponse);
		}
	}
	fetchReturnAffiliateInformation(return_affiliate_id: number) {
		if(this.shouldBlockAdminApi) {return;};
		this.$spinner.show('normalspinner');
		const handleResponse = (response: any) => {
			isDevMode() && console.info('Affiliate Information', response);
			this.ReturnAffiliateInformation = response;
			this.$spinner.hide('normalspinner');
		};
		if (this.isAffiliateMode) {
			this.affiliateService.getAffiliateAccount(return_affiliate_id).pipe(pluck('data')).subscribe(handleResponse);
		} else {
			this.$api.getAffiliateAccount(return_affiliate_id).pipe(pluck('data')).subscribe(handleResponse);
		}
	}
	handleSelectVehicleType(selectedVehicle: any) {
		this.selectedVehicle = selectedVehicle
		console.log("selecf", this.selectedVehicle)
		this.SetFormValue('vehicle_id', selectedVehicle.ID);
		this.SetFormValue('vehicle_type_name', selectedVehicle.vehicleType)
		const isEditMode = ['edit', 'repeat', 'return', 'round'].includes(this.updateType);
		const isOriginalVehicle = isEditMode && selectedVehicle.ID == (this.firstLoadVehicleId || this.bookingResponse?.vehicle_id);
		let driverValue;
		if (!this.isUserManualSelection && isOriginalVehicle && this.bookingResponse?.driver_id) {
			driverValue = this.bookingResponse.driver_id;
		} else {
			driverValue = (selectedVehicle.associated_driver || this.DriverList?.[0]?.id);
		}
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
					cancellation_hours: selectedVehicle?.charter_cancellation_hours?.toString() ?? '24'
				})
			}
			else {
				this.BookingForm.patchValue({
					cancellation_hours: selectedVehicle?.non_charter_cancellation_hours?.toString() ?? '24'
				})
			}
		}
		else if (this.updateType == 'repeat' || this.updateType == 'return' || this.updateType == 'round') {
			if (this.BookingForm.get('service_type').value == 'charter_tour') {
				this.BookingForm.patchValue({
					cancellation_hours: selectedVehicle?.charter_cancellation_hours?.toString() ?? '24'
				})
			}
			else {
				this.BookingForm.patchValue({
					cancellation_hours: selectedVehicle?.non_charter_cancellation_hours?.toString() ?? '24'
				})
			}
		}
		this.buildBookingData()
	}

	handleReturnSelectVehicleType(selectedVehicle: any) {
		this.return_selectedVehicle = selectedVehicle
		this.SetFormValue('return_vehicle_id', selectedVehicle.ID);
		this.SetFormValue('return_vehicle_type_name', selectedVehicle.vehicleType)
		const isReturnEditMode = ['edit', 'repeat', 'return', 'round'].includes(this.updateType);
		const isOriginalReturnVehicle = isReturnEditMode && selectedVehicle.ID == this.bookingResponse?.return_vehicle_id;
		let returnDriverValue;
		if (!this.isUserManualReturnSelection && isOriginalReturnVehicle && this.bookingResponse?.return_driver_id) {
			returnDriverValue = this.bookingResponse.return_driver_id;
		} else {
			returnDriverValue = (selectedVehicle.associated_driver || this.return_DriverList?.[0]?.id);
		}
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
					return_cancellation_hours: selectedVehicle?.charter_cancellation_hours?.toString() ?? '24'
				})
			}
			else {
				this.BookingForm.patchValue({
					return_cancellation_hours: selectedVehicle?.non_charter_cancellation_hours?.toString() ?? '24'
				})
			}
		}
		else if (this.updateType == 'repeat' || this.updateType == 'return' || this.updateType == 'round') {
			if (this.BookingForm.get('service_type').value == 'charter_tour') {
				this.BookingForm.patchValue({
					return_cancellation_hours: selectedVehicle?.charter_cancellation_hours?.toString() ?? '24'
				})
			}
			else {
				this.BookingForm.patchValue({
					return_cancellation_hours: selectedVehicle?.non_charter_cancellation_hours?.toString() ?? '24'
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
		if(this.shouldBlockAdminApi) {
			return;
		}
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
		// the manual affiliate/vehicle assignment UI these lists feed is never rendered
		// for a guest, and the endpoint is admin-only
		if (this.isGuestMode) {return;};
		if (!affiliate_id) {
			console.error('Invalid Paramater affiliate_data', affiliate_id)
			return
		}
		this.$spinner.show()
		const handleResponse = (response: any) => {
			if (response.success && response.data.vehicleList.length > 0) {
				this.VehicleList = response.data.vehicleList
				// add a key with formatted name to every value
				this.VehicleList.map((item: any) => {
					item['formatted_name'] = `${item.vehicleType} - ${item.make} (${item.model})`;
					item['name'] = item['formatted_name'] || item.vehicleType;
					item['id'] = item.vehicleType_id ?? item.id ?? item.ID;
				});
				// autofill data if isRatesCompleted:true
				this.vehicleType_arr = this.VehicleList = this.vehicleMake_arr = this.VehicleList = this.vehicleModal_arr = this.VehicleList = this.vehicleYear_arr = this.VehicleList = this.vehicleColor_arr = this.VehicleList
				for (let i = 0; i < this.VehicleList.length; i++) {
					if (this.VehicleList[i].isRatesCompleted) {
						// let vehicle_type_id = this.BigData['vehicleCategories'].find(item => item.name == this.VehicleList[i].vehicleType)['id']
						if (affiliate_id == this.firstLoadAffiliateId) {
							if (this.VehicleList[i].ID == this.firstLoadVehicleId) {
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
			}
			this.$spinner.hide()
		};
		if (this.isAffiliateMode) {
			this.affiliateService.getVehicleDataByAffiliateId(affiliate_id).then(handleResponse);
		} else {
			this.$api.adminAffiliateVehicleList(affiliate_id, true).then(handleResponse);
		}
	}

	fetchLooseAffiliateVehicles(affiliate_id: any) {
		// the manual affiliate/vehicle assignment UI these lists feed is never rendered
		// for a guest, and the endpoint is admin-only
		if (this.isGuestMode) {return;};
		if (!affiliate_id) {
			console.error('Invalid Paramater affiliate_data', affiliate_id)
			return
		}
		this.$spinner.show()
		this.$api.adminLooseAffVehList(affiliate_id, false).then((response: any) => {
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
			}
			this.$spinner.hide()
		})
	}

	fetchReturnAffiliateVehicles(return_affiliate_id: any) {
		// the manual affiliate/vehicle assignment UI these lists feed is never rendered
		// for a guest, and the endpoint is admin-only
		if (this.isGuestMode) {return;};
		if (!return_affiliate_id) {
			console.error('Invalid Paramater affiliate_data', return_affiliate_id)
			return
		}
		this.$spinner.show()
		const handleResponse = (response: any) => {
			if (response.success && response.data.vehicleList.length > 0) {
				this.return_VehicleList = response.data.vehicleList
				// add a key with formatted name to every value
				this.return_VehicleList.map((item: any) => {
					item['formatted_name'] = `${item.vehicleType} - ${item.make} (${item.model})`;
					item['name'] = item['formatted_name'] || item.vehicleType;
					item['id'] = item.vehicleType_id ?? item.id ?? item.ID;
				});
				// autofill data if isRatesCompleted:true
				this.return_vehicleType_arr = this.return_VehicleList = this.return_vehicleMake_arr = this.return_VehicleList = this.return_vehicleModal_arr = this.return_VehicleList = this.return_vehicleYear_arr = this.return_VehicleList = this.return_vehicleColor_arr = this.return_VehicleList
				for (let i = 0; i < this.return_VehicleList.length; i++) {
					if (this.return_VehicleList[i].isRatesCompleted) {
						// let vehicle_type_id = this.BigData['vehicleCategories'].find(item => item.name == this.return_VehicleList[i].vehicleType)['id']
						if (return_affiliate_id == this.firstLoadAffiliateId) {
							if (this.return_VehicleList[i].ID == this.firstLoadVehicleId) {
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
			}
			this.$spinner.hide()
		};
		if (this.isAffiliateMode) {
			this.affiliateService.getVehicleDataByAffiliateId(return_affiliate_id).then(handleResponse);
		} else {
			this.$api.adminAffiliateVehicleList(return_affiliate_id, false).then(handleResponse);
		}
	}

	fetchReturnLooseAffiliateVehicles(return_affiliate_id: any) {
		// the manual affiliate/vehicle assignment UI these lists feed is never rendered
		// for a guest, and the endpoint is admin-only
		if (this.isGuestMode) {return;};
		if (!return_affiliate_id) {
			console.error('Invalid Paramater affiliate_data', return_affiliate_id)
			return
		}
		this.$spinner.show()
		this.$api.adminLooseAffVehList(return_affiliate_id, false).then((response: any) => {
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
		if(this.updateType == 'edit' && this.Form.affiliate_type.value === 'in_progress_affiliate'){
			 return;
		}
		if(this.usesQuoteFlow) {return;};
		if (!affiliate_id) {
			console.error('Invalid Parameter affiliate_data', affiliate_id)
			return
		}

		this.$spinner.show()
		const handleResponse = (response: any) => {
			if (response.success && response.data?.data.length > 0) {
				setTimeout(() => {
					this.initphonefield()
				}, 200)
				this.DriverList = response.data.data
				let isValueSet = false
				const targetDriverId = this.bookingResponse?.driver_id || this.BookingForm?.get('driver_id')?.value
				for (let i = 0; i < this.DriverList.length; i++) {
					if (targetDriverId && this.DriverList[i]?.id == targetDriverId) {
						this.SetFormValue('driver_id', this.DriverList[i]?.id)
						this.autofillData('driver', this.DriverList[i])
						isValueSet = true
						break
					}
				}
				if (!isValueSet) {
					const sessionDriverId = JSON.parse(sessionStorage.getItem('selected_vehicle') || 'null')?.driverInformation?.id
					const matchedDriver = sessionDriverId ? this.DriverList.find(d => d.id == sessionDriverId) : null
					const fallbackDriver = matchedDriver || this.DriverList[0]
					this.autofillData('driver', fallbackDriver)
					setTimeout(() => { this.SetFormValue('driver_id', fallbackDriver.id) }, 0)
				}
			}
			
			this.$spinner.hide();
		};
		if (this.isAffiliateMode) {
			this.affiliateService.driverList(affiliate_id).then(handleResponse);
		} else {
			this.$api.driverList(affiliate_id).then(handleResponse);
		}
	}

	fetchReturnAffiliateDrivers(return_affiliate_id: number) {
		if (!return_affiliate_id) {
			console.error('Invalid Paramater affiliate_data', return_affiliate_id)
			return
		}
		if(this.usesQuoteFlow) {return;};
		this.$spinner.show()
		const handleResponse = (response: any) => {
			if (response.success && response.data?.data.length > 0) {
				setTimeout(() => {
					this.initphonefield()
				}, 200)
				this.return_DriverList = response.data.data
				let isValueSet = false
				const targetReturnDriverId = this.bookingResponse?.return_driver_id || this.BookingForm?.get('return_driver_id')?.value
				for (let i = 0; i < this.return_DriverList.length; i++) {
					if (targetReturnDriverId && this.return_DriverList[i]?.id == targetReturnDriverId) {
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
			}
			
			this.$spinner.hide();
		};
		if (this.isAffiliateMode) {
			this.affiliateService.driverList(return_affiliate_id).then(handleResponse);
		} else {
			this.$api.driverList(return_affiliate_id).then(handleResponse);
		}
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
				address: new FormControl('', [Validators.required, this.customValidator.whitespace()]),
				latitude: new FormControl(''),
				longitude: new FormControl(''),
				rate: new FormControl(''),
				booking_instructions: new FormControl(''),
				// Set when the selected address is itself an airport, so a drag/reorder that
				// promotes this stop to pickup/dropoff can restore it as an airport leg instead
				// of a plain address. Never sent to the backend - stripped before submission.
				kind: new FormControl('city'),
				airport: new FormControl(''),
				airport_option: new FormControl(''),
				airport_name: new FormControl(''),
				airport_latitude: new FormControl(''),
				airport_longitude: new FormControl('')
			}))
		}
		else {
			let index = Object.keys(this.ExtraStops).length + 1;
			(<FormArray>this.BookingForm.get('extra_stops')).push(new FormGroup({
				address: new FormControl('', [Validators.required, this.customValidator.whitespace()]),
				latitude: new FormControl(''),
				longitude: new FormControl(''),
				rate: new FormControl(''),
				booking_instructions: new FormControl(''),
				kind: new FormControl('city'),
				airport: new FormControl(''),
				airport_option: new FormControl(''),
				airport_name: new FormControl(''),
				airport_latitude: new FormControl(''),
				airport_longitude: new FormControl('')
			}))
		}
		this.enforceCharterTourForExtraStops();
	}

	deleteExtraStop(is_return: boolean, stop_index: number) {
		this.clearSameLocationErrors();
		if (is_return) {
			(<FormArray>this.BookingForm.get('return_extra_stops')).removeAt(stop_index)
			this.MapController(true)
		}
		else {
			(<FormArray>this.BookingForm.get('extra_stops')).removeAt(stop_index)
			this.MapController()
		}
		if (this.outboundExtraStopsCount() <= this.charterTourStopThreshold) {
			// The stop count no longer explains the service type, so drop the notice. The
			// service type itself stays put - reverting it would undo a deliberate choice.
			this.autoConvertedToCharterTour = false;
		}
		this.buildBookingData()
	}

	private outboundExtraStopsCount(): number {
		return (this.BookingForm?.get('extra_stops') as FormArray | null)?.length ?? 0;
	}

	/**
	 * Everything an endpoint owns, as `<prefix><leg><suffix>` control names. An airport
	 * transfer keeps its address in the `_airport_*` controls and leaves the plain address
	 * blank, so all of these have to travel together or an `airport_to_airport` reorder
	 * moves nothing but two empty strings.
	 */
	private static readonly ROUTE_ENDPOINT_FIELDS: Array<[string, string]> = [
		['', 'address'],
		['_latitude', 'latitude'],
		['_longitude', 'longitude'],
		['_airport', 'airport'],
		['_airport_option', 'airport_option'],
		['_airport_name', 'airport_name'],
		['_airport_latitude', 'airport_latitude'],
		['_airport_longitude', 'airport_longitude'],
		['_airline', 'airline'],
		['_airline_option', 'airline_option'],
		['_airline_name', 'airline_name'],
		['_flight', 'flight'],
	];

	/**
	 * Controls that only the pickup end of a leg has - the FBO details shown for private
	 * aviation and the originating city. They travel with whatever sits in the pickup
	 * slot; a pickup dragged to the drop-off has nowhere to put them.
	 */
	private routePickupOnlyFields(is_return: boolean): Array<[string, string]> {
		return is_return
			? [['return_fbo_address', 'fbo_address'], ['return_fbo_name', 'fbo_name'], ['departing_airport_city', 'origin_city']]
			: [['fbo_address', 'fbo_address'], ['fbo_name', 'fbo_name'], ['origin_airport_city', 'origin_city']];
	}

	/** What each end of a leg currently is, read off `<from>_to_<to>`. */
	private routeEndpointKinds(is_return: boolean): string[] {
		const transferType = String(this.BookingForm?.get(is_return ? 'return_transfer_type' : 'transfer_type')?.value || '');
		const [from, to] = transferType.split('_to_');
		return [from || 'city', to || 'city'];
	}

	/**
	 * The route points a leg exposes to drag and drop, in the order they appear on
	 * screen: the pickup, the drop-off, then every extra stop. Each point carries its
	 * `kind` (city / airport / cruise) so the transfer type can be rebuilt from wherever
	 * the points end up. `rate` and `booking_instructions` only exist on stops.
	 */
	private readRoutePoints(is_return: boolean): Array<Record<string, any>> {
		const prefix = is_return ? 'return_' : '';
		const stops = (this.BookingForm.get(`${prefix}extra_stops`) as FormArray | null)?.controls ?? [];
		const kinds = this.routeEndpointKinds(is_return);

		const endpoint = (leg: 'pickup' | 'dropoff', kind: string) => {
			const point: Record<string, any> = { kind, rate: '', booking_instructions: '' };
			BookingComponent.ROUTE_ENDPOINT_FIELDS.forEach(([suffix, key]) => {
				point[key] = this.BookingForm.get(`${prefix}${leg}${suffix}`)?.value ?? '';
			});
			if (leg === 'pickup') {
				this.routePickupOnlyFields(is_return).forEach(([control, key]) => {
					point[key] = this.BookingForm.get(control)?.value ?? '';
				});
			}
			return point;
		};

		return [
			endpoint('pickup', kinds[0]),
			endpoint('dropoff', kinds[1]),
			...stops.map((stop) => ({
				// A stop still has nowhere to put a flight/airline number or a ship name, but
				// it can carry the identity of an airport it was selected as, so promoting it
				// to an endpoint restores that instead of treating it as a plain address.
				kind: stop.get('kind')?.value || 'city',
				address: stop.get('address')?.value ?? '',
				latitude: stop.get('latitude')?.value ?? '',
				longitude: stop.get('longitude')?.value ?? '',
				airport: stop.get('airport')?.value ?? '',
				airport_option: stop.get('airport_option')?.value ?? '',
				airport_name: stop.get('airport_name')?.value ?? '',
				airport_latitude: stop.get('airport_latitude')?.value ?? '',
				airport_longitude: stop.get('airport_longitude')?.value ?? '',
				rate: stop.get('rate')?.value ?? '',
				booking_instructions: stop.get('booking_instructions')?.value ?? ''
			}))
		];
	}

	/**
	 * Write a reordered route back onto the form. The first two positions are the pickup
	 * and the drop-off, so a stop dragged over either one is promoted to that endpoint and
	 * whatever it displaced shifts down.
	 *
	 * The whole endpoint payload moves, airport details included, and `transfer_type` is
	 * rebuilt from where the two endpoint kinds land - swapping the ends of an
	 * `airport_to_city` booking makes it `city_to_airport`. A stop still has nowhere to put
	 * airline/flight/FBO details, so those are dropped when an endpoint becomes a stop, as
	 * are a promoted stop's rate and per-stop instructions - but the stop keeps the airport's
	 * identity so it can be promoted back correctly later.
	 *
	 * `SetFormValue` is deliberately not used here - it ignores empty values, and a swap
	 * with a blank endpoint has to be able to clear the other side.
	 */
	private writeRoutePoints(points: Array<Record<string, any>>, is_return: boolean): void {
		const prefix = is_return ? 'return_' : '';
		const setEndpoint = (leg: 'pickup' | 'dropoff', point: Record<string, any>) => {
			// An airport endpoint's plain address/lat/long controls stay blank by convention -
			// its location lives in `_airport_name`/`_airport_latitude` etc. A promoted stop
			// carries all three populated (that's how it displays and maps as a stop), so
			// that has to be suppressed here rather than at the source.
			const isAirportPoint = point?.kind === 'airport';
			const plainLocationKeys = ['address', 'latitude', 'longitude'];
			BookingComponent.ROUTE_ENDPOINT_FIELDS.forEach(([suffix, key]) => {
				const value = (isAirportPoint && plainLocationKeys.includes(key)) ? '' : (point?.[key] ?? '');
				this.BookingForm.get(`${prefix}${leg}${suffix}`)?.setValue(value, { emitEvent: false });
			});
			if (leg === 'pickup') {
				this.routePickupOnlyFields(is_return).forEach(([control, key]) => {
					this.BookingForm.get(control)?.setValue(point?.[key] ?? '', { emitEvent: false });
				});
			}
		};

		setEndpoint('pickup', points[0]);
		setEndpoint('dropoff', points[1]);

		// A move never changes how many points there are, so the stop array keeps its
		// length and every slot can be patched in place.
		const stops = this.BookingForm.get(`${prefix}extra_stops`) as FormArray | null;
		points.slice(2).forEach((point, index) => {
			// A demoted airport endpoint leaves its plain address/lat/long blank (see above),
			// so the stop - which has no separate airport display, and needs real coordinates
			// to map and rate regardless of kind - falls back to the airport's own location.
			const isAirportPoint = point?.kind === 'airport';
			const stopAddress = isAirportPoint
				? (point?.airport_name || point?.airport_option || point?.address || '')
				: (point?.address ?? '');
			const stopLatitude = isAirportPoint ? (point?.airport_latitude ?? point?.latitude ?? '') : (point?.latitude ?? '');
			const stopLongitude = isAirportPoint ? (point?.airport_longitude ?? point?.longitude ?? '') : (point?.longitude ?? '');
			stops?.at(index)?.patchValue({
				address: stopAddress,
				latitude: stopLatitude,
				longitude: stopLongitude,
				kind: point?.kind || 'city',
				airport: point?.airport ?? '',
				airport_option: point?.airport_option ?? '',
				airport_name: point?.airport_name ?? '',
				airport_latitude: point?.airport_latitude ?? '',
				airport_longitude: point?.airport_longitude ?? '',
				rate: point?.rate ?? '',
				booking_instructions: point?.booking_instructions ?? ''
			}, { emitEvent: false });
		});

		this.applyReorderedTransferType(points, is_return);
		this.BookingForm.updateValueAndValidity();
	}

	/**
	 * Point the transfer type at whatever now sits on each end of the leg.
	 *
	 * The value is set without emitting: the `transfer_type` subscription swaps pickup and
	 * drop-off itself whenever a round trip moves between complementary types, which would
	 * undo the reorder that just ran. The validators it would have refreshed are applied
	 * here instead. The opposite leg's transfer type is deliberately left alone - each leg
	 * is reordered on its own.
	 */
	private applyReorderedTransferType(points: Array<Record<string, any>>, is_return: boolean): void {
		const from = points[0]?.kind || 'city';
		let to = points[1]?.kind || 'city';

		// Only one end of a leg can be a cruise - there is a single set of cruise controls
		// per leg and no `cruise_to_cruise` transfer type - so treat the second as an address.
		if (from === 'cruise' && to === 'cruise') {
			to = 'city';
		}

		const transferType = `${from}_to_${to}`;
		const control = this.BookingForm.get(is_return ? 'return_transfer_type' : 'transfer_type');
		if (!control || control.value === transferType) {
			return;
		}

		control.setValue(transferType, { emitEvent: false });
		if (is_return) {
			this.return_transfer_type = transferType;
			this.updateReturnLegValidators(transferType);
		} else {
			this.transfer_type = transferType;
			this.updateOutboundLegValidators(transferType);
		}
	}

	/**
	 * The endpoint address inputs sit on top of a Google place autocomplete element, so a
	 * programmatic swap has to push the new text through the same sync helper
	 * `clearAddressField` uses or the overlay keeps showing the old address. Airport legs
	 * display through their own inputs, which `resyncAirportAutocompleteDisplays` owns.
	 */
	private syncRouteEndpointInputs(is_return: boolean): void {
		const prefix = is_return ? 'return_' : '';

		const sync = () => {
			const inputMap: Record<string, ElementRef | undefined> = {
				[`${prefix}pickup`]: is_return ? this.return_pickupInput : this.pickupInput,
				[`${prefix}dropoff`]: is_return ? this.return_dropoffInput : this.dropoffInput,
			};

			Object.entries(inputMap).forEach(([formControl, inputRef]) => {
				const nativeInput = inputRef?.nativeElement as HTMLInputElement | undefined;
				if (!nativeInput) {
					return;
				}

				nativeInput.value = this.BookingForm.get(formControl)?.value ?? '';
				syncPlaceAutocompleteDisplay(nativeInput);
			});

			this.resyncAirportAutocompleteDisplays();
		};

		// A reorder can flip which end is the airport, which swaps out the markup for both
		// endpoints. Run once now for the inputs that are already there, and again after the
		// re-render for the ones the new transfer type has just produced.
		sync();
		setTimeout(sync, 0);
	}

	/**
	 * The return leg is a mirror of the outbound one - it starts where the outbound ends and
	 * ends where it started - and is normally kept in step by the `pickup` / `dropoff` /
	 * `*_airport` subscriptions as the user fills the outbound in. A reorder writes those
	 * controls with `emitEvent: false`, so none of them run and the return leg keeps the
	 * route the user has just moved away from. Those mirrors also go through `SetFormValue`,
	 * which ignores empty values, so they can never blank the airport controls of an endpoint
	 * that is now a plain address - the return leg would show the old airport and the new
	 * address at once, and the two legs would resolve to the same point.
	 *
	 * So rebuild both return endpoints from the outbound here, writing the empty fields too,
	 * and point `return_transfer_type` back the other way.
	 *
	 * This runs whatever the service type is, exactly like the subscriptions it stands in for:
	 * the return leg is mirrored on a one-way booking as well, so that it is already correct
	 * if Round Trip is picked afterwards.
	 */
	private syncReturnLegFromOutbound(): void {
		if (this.isPrefillingForm || this.isPrefillingTransferTypes) {
			return;
		}

		const [outboundPickup, outboundDropoff] = this.readRoutePoints(false);

		const setReturnEndpoint = (leg: 'pickup' | 'dropoff', point: Record<string, any>) => {
			BookingComponent.ROUTE_ENDPOINT_FIELDS.forEach(([suffix, key]) => {
				this.BookingForm.get(`return_${leg}${suffix}`)?.setValue(point?.[key] ?? '', { emitEvent: false });
			});
		};

		// The return leg starts at the outbound drop-off and ends at the outbound pickup.
		setReturnEndpoint('pickup', outboundDropoff);
		setReturnEndpoint('dropoff', outboundPickup);

		// `<from>_to_<to>` read backwards. Set without emitting: the `return_transfer_type`
		// subscription would swap the two ends it has just been given. The validators it would
		// have refreshed are applied here instead.
		const returnTransferType = `${outboundDropoff?.kind || 'city'}_to_${outboundPickup?.kind || 'city'}`;
		const returnTransferTypeControl = this.BookingForm.get('return_transfer_type');
		if (returnTransferTypeControl && returnTransferTypeControl.value !== returnTransferType) {
			returnTransferTypeControl.setValue(returnTransferType, { emitEvent: false });
			this.return_transfer_type = returnTransferType;
			this.updateReturnLegValidators(returnTransferType);
		}

		this.BookingForm.updateValueAndValidity();
		this.syncRouteEndpointInputs(true);

		if (this.Form.service_type.value == 'round_trip') {
			this.MapController(true);
		}
	}

	/**
	 * The form stores a leg as `[pickup, dropoff, ...stops]`, but the screen lists it in
	 * travel order - pickup, then every stop, then the drop-off. These two convert between
	 * the two orderings so a drop index taken off the page means what it looks like it means.
	 */
	private toDisplayOrder(points: Array<Record<string, any>>): Array<Record<string, any>> {
		return [points[0], ...points.slice(2), points[1]];
	}

	private toDataOrder(display: Array<Record<string, any>>): Array<Record<string, any>> {
		return [display[0], display[display.length - 1], ...display.slice(1, -1)];
	}

	/** How many points the leg has on screen: the two endpoints plus every stop. */
	routePointCount(is_return: boolean = false): number {
		const stops = this.BookingForm?.get(is_return ? 'return_extra_stops' : 'extra_stops') as FormArray | null;
		return 2 + (stops?.length ?? 0);
	}

	/**
	 * The address to print on a route point's drag preview.
	 *
	 * An airport endpoint keeps its plain `pickup` / `dropoff` control blank by convention -
	 * its location lives in `<leg>_airport_option` / `<leg>_airport_name` (see
	 * `writeRoutePoints`) - so reading the plain control alone makes an airport leg's preview
	 * say "No address selected" while the field on screen clearly shows the airport. Read
	 * whichever control the endpoint actually stores its address in, and keep the other as a
	 * fallback so a leg caught mid-switch between kinds still shows what the user picked.
	 */
	routeEndpointAddress(leg: 'pickup' | 'dropoff', is_return: boolean = false): string {
		const control = `${is_return ? 'return_' : ''}${leg}`;
		const read = (name: string) => String(this.BookingForm?.get(name)?.value ?? '').trim();

		const plain = read(control);
		const airport = read(`${control}_airport_option`) || read(`${control}_airport_name`);
		const isAirport = this.routeEndpointKinds(is_return)[leg === 'pickup' ? 0 : 1] === 'airport';

		return isAirport ? (airport || plain) : (plain || airport);
	}

	/**
	 * The same for a stop. A stop selected as an airport does fill its plain `address`, so
	 * this is normally just that value, with the airport name as a fallback.
	 */
	routeStopAddress(index: number, is_return: boolean = false): string {
		const stop = (this.BookingForm?.get(is_return ? 'return_extra_stops' : 'extra_stops') as FormArray | null)?.at(index);
		const read = (name: string) => String(stop?.get(name)?.value ?? '').trim();
		return read('address') || read('airport_name') || read('airport_option');
	}

	/**
	 * Reordering the route is a data move, not a DOM move: the template renders from
	 * `pickup` / `extra_stops` / `dropoff`, so the new position is written back to those
	 * controls and the view re-renders from them. The map, the distance and the rate
	 * payload all follow the new order.
	 *
	 * `from` and `to` are positions in travel order, which is what both the drag and the
	 * move buttons work in. 
	 */
	private applyRouteMove(is_return: boolean, from: number, to: number): void {
		const count = this.routePointCount(is_return);
		if (from === to || from < 0 || to < 0 || from >= count || to >= count) {
			return;
		}

		this.clearSameLocationErrors();
		this.closeCustomAddressDropdown();

		const display = this.toDisplayOrder(this.readRoutePoints(is_return));
		const dragged = display[from];
		display[from] = display[to];
		display[to] = dragged;
		this.writeRoutePoints(this.toDataOrder(display), is_return);

		this.syncRouteEndpointInputs(is_return);

		// Reordering the outbound leg moves the return leg with it - the return is derived from
		// it, and the subscriptions that would normally carry the change across cannot see a
		// silent write. Reordering the return leg is the user arranging that leg on its own.
		if (!is_return) {
			this.syncReturnLegFromOutbound();
		}

		this.MapController(is_return);
		this.buildBookingData();
	}

	dropRoutePoint(event: CdkDragDrop<any[]>, is_return: boolean = false): void {
		this.applyRouteMove(is_return, event.previousIndex, event.currentIndex);
	}

	/** The move up / move down buttons - the same reorder without a pointer. */
	moveRoutePoint(is_return: boolean, displayIndex: number, delta: number): void {
		this.applyRouteMove(is_return, displayIndex, displayIndex + delta);
	}

	/**
	 * True while the outbound stop count forces charter/tour, so One Way and Round Trip are
	 * offered as not applicable. Applies to edit as well - the rule is about the trip itself,
	 * not about how the booking was reached.
	 */
	get isTransferServiceTypeBlocked(): boolean {
		return this.outboundExtraStopsCount() > this.charterTourStopThreshold;
	}

	/**
	 * True while the outbound leg sits exactly on the threshold, so the next stop is the one
	 * that promotes the booking to charter/tour. Says so on the Add stop button, so the switch
	 * is a choice the user makes rather than something that happens to them. A booking that is
	 * already charter/tour has nothing left to warn about.
	 */
	get willNextStopConvertToCharterTour(): boolean {
		return this.BookingForm?.get('service_type')?.value != 'charter_tour'
			&& this.outboundExtraStopsCount() == this.charterTourStopThreshold;
	}

	/**
	 * More than two stops on the outbound leg is charter work rather than a point-to-point
	 * transfer, so promote the service type as soon as the extra stop is added. Only the
	 * outbound leg is counted: return stops exist only while the booking is a round trip,
	 * and that leg is dropped the moment it becomes a charter/tour.
	 */
	private enforceCharterTourForExtraStops(): void {
		// Prefill pushes the stops one by one; wait for it to finish, then run once against
		// the settled list rather than flipping the service type mid-load.
		if (this.isPrefillingForm) {
			return;
		}

		const serviceTypeControl = this.BookingForm?.get('service_type');
		if (!serviceTypeControl || serviceTypeControl.value == 'charter_tour') {
			return;
		}

		if (this.outboundExtraStopsCount() <= this.charterTourStopThreshold) {
			return;
		}

		this.service_type = 'charter_tour';
		this.autoConvertedToCharterTour = true;
		// Emits, so the service_type subscription re-runs the charter validators and rates.
		serviceTypeControl.setValue('charter_tour');

		// Charter/Tour is priced by the hour and never accepts less than two.
		if (isNaN(Number(this.BookingForm.get('number_of_hours')?.value)) || Number(this.BookingForm.get('number_of_hours')?.value) < 2) {
			this.number_of_hours = 2;
			this.SetFormValue('number_of_hours', 2);
		}
		this.numberOfHoursError = false;

		this.buildBookingData();
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
		const geocoder = new google.maps.Geocoder();
		geocoder.geocode({ address: location1 }, (results1, status1) => {
			if (status1 === 'OK' && results1.length > 0) {
				const town1 = this.getTown(results1);
				geocoder.geocode({ address: location2 }, async (results2, status2) => {
					if (status2 === 'OK' && results2.length > 0) {
						const town2 = this.getTown(results2);

						if (town1 === town2) {
							await (<FormArray>this.BookingForm.get([formKey])).at(index).patchValue({
								rate: 'in_town'
							});
						} else {
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
		if (this.RatesForm) {
			this.adminSharePercent = 25;
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
			if (this.BookingForm.value?.account_type == 'travel_planner' && !this.isCreatedByAdmin && !['repeat', 'return', 'round'].includes(this.updateType) && !['repeat', 'return', 'round'].includes(this.Form?.updateType?.value)) {
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
			this.shareArray = shareArray
			// console.log('in function createReservationShareArray-->>>' , base_rate, shareArray )
			return shareArray;
			// value['rateArray'] = JSON.parse(JSON.stringify(this.RatesForm))
		}
	}
	createReservationReturnShareArray() {
		if (this.Form.service_type.value == 'round_trip' && this.ReturnRatesForm) {
			this.adminSharePercent = 25;
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
			// `return_grand_total` is not a form control - it only exists on the submit
			// payload, where it is copied off the return rates. Read it there directly.
			let returnGrandTotal = this.BookingForm.value.return_grand_total ?? this.ReturnRatesForm?.r_grandtotal
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
			if (this.BookingForm.value?.account_type == 'travel_planner' && !this.isCreatedByAdmin && !['repeat', 'return', 'round'].includes(this.updateType) && !['repeat', 'return', 'round'].includes(this.Form?.updateType?.value)) {
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

	/** Remove a manually-set error key from a control without clobbering its other errors. */
	private clearControlError(controlName: string, errorKey: string) {
		const ctrl = this.BookingForm?.get(controlName);
		if (ctrl?.hasError(errorKey)) {
			const { [errorKey]: _removed, ...rest } = ctrl.errors || {};
			ctrl.setErrors(Object.keys(rest).length ? rest : null);
		}
	}

	/** Clear the manual "past date"/"past time" errors from both the outbound and return pickup fields. */
	clearPastDateTimeError() {
		this.clearControlError('pickup_date', 'pastDate');
		this.clearControlError('pickup_time', 'pastTime');
		this.clearControlError('return_pickup_date', 'pastDate');
		this.clearControlError('return_pickup_time', 'pastTime');
	}

	/**
	 * Stamp "past date"/"past time" errors onto the pickup fields (outbound plus the
	 * return leg for round trips) so they surface alongside every other form error in
	 * a single validation pass, rather than only after the rest of the form is valid.
	 */
	private validatePastDateTime() {
		this.clearPastDateTimeError();
		if (this.isAdminMode) {
			return;
		}
		const now = moment();
		const startOfToday = moment().startOf('day');
		const timeFormats = ['YYYY-MM-DD hh:mm A', 'YYYY-MM-DD HH:mm', 'YYYY-MM-DD HH:mm:ss'];

		const flagLeg = (dateControl: string, timeControl: string) => {
			const dateValue = this.BookingForm.get(dateControl)?.value;
			const timeValue = this.BookingForm.get(timeControl)?.value;
			if (!dateValue) {
				return;
			}
			const day = moment(dateValue, 'YYYY-MM-DD').startOf('day');
			if (day.isValid() && day.isBefore(startOfToday)) {
				const ctrl = this.BookingForm.get(dateControl);
				ctrl?.setErrors({ ...(ctrl.errors || {}), pastDate: true });
				ctrl?.markAsTouched();
				return;
			}
			if (timeValue) {
				const dateTime = moment(`${dateValue} ${timeValue}`, timeFormats);
				if (dateTime.isValid() && dateTime.isBefore(now)) {
					const ctrl = this.BookingForm.get(timeControl);
					ctrl?.setErrors({ ...(ctrl.errors || {}), pastTime: true });
					ctrl?.markAsTouched();
				}
			}
		};

		flagLeg('pickup_date', 'pickup_time');
		if (this.Form.service_type.value == 'round_trip') {
			flagLeg('return_pickup_date', 'return_pickup_time');
		}
	}

	/** Check if the new booking pickup datetime (or return leg) is within 24 hours from system_time (current datetime). */
	isBookingWithin24Hours(): boolean {
		if (this.isAdminMode) return false;
		if (!this.BookingForm) return false;
		const now = moment();
		const timeFormats = ['YYYY-MM-DD hh:mm A', 'YYYY-MM-DD HH:mm', 'YYYY-MM-DD HH:mm:ss', 'YYYY-MM-DD h:mm A', 'YYYY-MM-DD h:mm a', 'YYYY-MM-DD hh:mm a'];

		const checkLegWithin24 = (dateControl: string, timeControl: string): boolean => {
			const dateValue = this.BookingForm.get(dateControl)?.value;
			const timeValue = this.BookingForm.get(timeControl)?.value;
			if (!dateValue) return false;

			const dateStr = typeof dateValue === 'string' ? dateValue : moment(dateValue).format('YYYY-MM-DD');
			const fullTimeStr = `${dateStr} ${timeValue || '12:00 am'}`;
			const bookingTime = moment(fullTimeStr, timeFormats);
			if (!bookingTime.isValid()) return false;

			const diffInHours = bookingTime.diff(now, 'hours', true);
			return diffInHours >= 0 && diffInHours <= 24;
		};

		if (checkLegWithin24('pickup_date', 'pickup_time')) {
			return true;
		}
		if (this.Form?.service_type?.value === 'round_trip' && checkLegWithin24('return_pickup_date', 'return_pickup_time')) {
			return true;
		}
		return false;
	}

	private check24HourTimeout: any;

	/** Schedule 24-hour warning check after form value changes settle (avoiding race conditions when multiple date/time fields update in sequence). */
	schedule24HourWarningCheck() {
		this.hasConfirmed24HourWarning = false;
		if (this.check24HourTimeout) {
			clearTimeout(this.check24HourTimeout);
		}
		this.check24HourTimeout = setTimeout(() => {
			this.checkAndShow24HourWarning();
		}, 100);
	}

	/** Check 24-hour warning and show modal if booking is scheduled within 24 hours. */
	checkAndShow24HourWarning(): boolean {
		if (this.isBookingWithin24Hours()) {
			$('#within24HoursModal').modal('show');
			return true;
		}
		return false;
	}

	/** Modal action handlers for 24 hour booking popup */
	onConfirm24HourBooking() {
		this.hasConfirmed24HourWarning = true;
		$('#within24HoursModal').modal('hide');
		if (this.pendingSubmitPreview !== undefined) {
			const previewMode = this.pendingSubmitPreview;
			this.pendingSubmitPreview = undefined;
			this.submitForm(previewMode);
		}
	}

	onCancel24HourBooking() {
		this.hasConfirmed24HourWarning = false;
		this.pendingSubmitPreview = undefined;
		$('#within24HoursModal').modal('hide');
	}


	/**
	 * Every reason the preview/submit can bail out, logged with the vehicle context.
	 * Master-vehicle quotes carry no concrete vehicle_id, so that state is included
	 * on every stop to make "preview does nothing" diagnosable from the console.
	 */
	private logPreviewBlocked(reason: string, extra: Record<string, any> = {}) {
		console.warn('[booking] preview blocked:', reason, {
			mode: this.mode,
			is_master_vehicle: this.is_master_vehicle,
			route_is_master_vehicle: this.route_is_master_vehicle,
			form_vehicle_id: this.BookingForm.get('vehicle_id')?.value,
			return_vehicle_id: this.BookingForm.get('return_vehicle_id')?.value,
			QB_vehicle_id: this.QB_vehicle_id,
			route_vehicle_id: this.route_vehicle_id,
			firstLoadVehicleId: this.firstLoadVehicleId,
			vehicle_type: this.BookingForm.get('vehicle_type')?.value,
			return_vehicle_type: this.BookingForm.get('return_vehicle_type')?.value,
			service_type: this.BookingForm.get('service_type')?.value,
			affiliate_id: this.BookingForm.get('affiliate_id')?.value,
			...extra
		});
		// flat lines so the paths are readable without expanding the console group
		if (Array.isArray(extra?.invalidControls)) {
			extra.invalidControls.forEach((c: any) => console.warn(
				`[booking]   invalid: ${c.path} -> ${Object.keys(c.errors || {}).join(', ')} (value: ${JSON.stringify(c.value)})`
			));
		}
	}

	/**
	 * Walks the form tree and returns the dotted path of every invalid leaf.
	 * A FormGroup/FormArray reports `errors === null` while its children are the
	 * ones failing, so iterating only the top level hides nested failures.
	 */
	private collectInvalidControlPaths(control: AbstractControl, path: string = ''): Array<{ path: string; errors: any; value: any }> {
		const found: Array<{ path: string; errors: any; value: any }> = [];
		if (!control || control.valid) {
			return found;
		}
		if (control instanceof FormGroup || control instanceof FormArray) {
			const children: Record<string, AbstractControl> = control instanceof FormGroup
				? control.controls
				: (control.controls as AbstractControl[]).reduce((acc, child, i) => {
					acc[String(i)] = child;
					return acc;
				}, {} as Record<string, AbstractControl>);
			Object.keys(children).forEach((key) => {
				found.push(...this.collectInvalidControlPaths(children[key], path ? `${path}.${key}` : key));
			});
			// a group can also fail its own cross-field validator with valid children
			if (control.errors) {
				found.push({ path: path || '<form>', errors: control.errors, value: '<group>' });
			}
			return found;
		}
		found.push({ path, errors: control.errors, value: control.value });
		return found;
	}

	submitForm(preview: boolean) {
		this.submitBookingForm = true

		// Drop the previous run's same-location flags so the check below re-evaluates
		// the current addresses instead of the form staying invalid from the last attempt.
		this.clearSameLocationErrors();

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
			this.BookingForm.get('return_vehicle_type')?.updateValueAndValidity({ emitEvent: false })

			this.BookingForm.patchValue({
				return_driver_cell_isd: this.ensurePlusPrefix(this.BookingForm?.get('return_driver_cell_isd')?.value),
				return_lose_affiliate_phone_isd: this.ensurePlusPrefix(this.BookingForm?.get('return_lose_affiliate_phone_isd')?.value)
			});

		}
		else {
			this.BookingForm.get('return_vehicle_type')?.clearValidators()
			this.BookingForm.get('return_vehicle_type')?.updateValueAndValidity({ emitEvent: false })
		}
		
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
		
		// Flag past pickup date/time before the invalid check so these errors are
		// reported together with any other form errors in the same pass.
		this.validatePastDateTime();
		this.validateAddressSuggestions();

		if (this.BookingForm.invalid) {
			this.BookingForm.markAllAsTouched();
			this.logPreviewBlocked('form invalid', {
				invalidControls: this.collectInvalidControlPaths(this.BookingForm)
			});
			// Deferred so the validation messages are rendered before we measure
			// which fields are actually on screen.
			setTimeout(() => this.invalidControlScroll?.scrollToFirstInvalidControl(), 100);
			return;
		}

		// Validate minimum number of hours for charter_tour
		const submitHours = Number(this.Form.number_of_hours.value);
		if (this.Form.service_type.value == 'charter_tour' && (isNaN(submitHours) || submitHours < 2)) {
			this.numberOfHoursError = true;
			this.logPreviewBlocked('charter tour needs at least 2 hours', { submitHours });
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

		// Same pickup / drop-off / stop locations are only valid for a charter tour. Re-check
		// here because the service type may have been switched away from charter after the
		// route was built, which would otherwise leave the charter allowance in place.
		const sameLocationError = this.getSameLocationError();
		if (sameLocationError) {
			this.logPreviewBlocked('duplicate pickup/drop-off location', { sameLocationError });
			this.reportSameLocationError(sameLocationError);
			return;
		}

		// A previously computed route flagged a zero-distance leg on a non-charter booking.
		if (this.Form.service_type.value != 'charter_tour'
			&& (this.hasInvalidRoutePoint || (this.Form.service_type.value == 'round_trip' && this.hasInvalidReturnRoutePoint))) {
			this.logPreviewBlocked('zero-distance leg on a non-charter booking', {
				hasInvalidRoutePoint: this.hasInvalidRoutePoint,
				hasInvalidReturnRoutePoint: this.hasInvalidReturnRoutePoint
			});
			this.logDualPopup('locationErrorModal', 'submitForm:invalidRoutePoint', {
				preview,
				hasInvalidRoutePoint: this.hasInvalidRoutePoint,
				hasInvalidReturnRoutePoint: this.hasInvalidReturnRoutePoint
			});
			this.$errors.openDialog({
				errors: {
					error: 'Please select a valid location point.'
				}
			})
			return;
		}

		// Master vehicles have no affiliate — keep affiliate_id empty (set by
		// onQuoteVehicleSelected/setValueByBookNow) instead of stamping the
		// subscriber's own account_id on the booking.
		if (this.isBookingWithin24Hours() && !this.hasConfirmed24HourWarning) {
			this.pendingSubmitPreview = preview;
			$('#within24HoursModal').modal('show');
			return;
		}

		if (this.booking_created_from == 'subscriber' && !this.is_master_vehicle) {
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
		if (this.isFarmoutBooking && this.booking_created_from == 'admin') {
			value["reservation_type"] = 'farmout'
		}
		value["booking_created_from"] = this.booking_created_from
		value['proceed'] = this.proceed
		value['currency'] = this.currencyObj?.currency
		value['platform_type'] = 'web'
		value['is_master_vehicle'] = this.is_master_vehicle
		value['is_pending_affiliate'] = this.Form.affiliate_type.value == 'in_progress_affiliate'
		value['return_is_pending_affiliate'] = this.Form.return_affiliate_type.value == 'in_progress_affiliate'
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
				this.logPreviewBlocked('base rate is empty — rates never resolved for this vehicle', {
					baserate: this.RatesForm.all_inclusive_rates["Base_Rate"].baserate
				});
				this.$errors.openDialog({
					errors: {
						error: 'Base rate can not be empty.'
					}
				})
			}
			else {
				this.$spinner.show()
				console.log('Booking Payload-->>' , value)
				this.createBookingByMode(value, this.Form.updateType.value).subscribe((response: any) => {
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
						this.navigatePostSave(response)
					}
				})
			}

		}
		else {
			console.log("DEBUG - BOOKING PREVIEW")
			this.openBookingReceiptPreview()
		}
	}

	/** Which receipt persona the shared preview should render for this portal. */
	private get previewUserRole(): 'admin' | 'affiliate' | 'individual' | 'travel_agent' {
		if (this.isAdminMode) {
			return 'admin'
		}
		if (this.isAffiliateMode) {
			return 'affiliate'
		}
		if (this.isTravelAgentMode) {
			return 'travel_agent'
		}
		return 'individual'
	}

	/**
	 * Shape the live form into the object the shared receipt component expects,
	 * so an unsaved booking renders through the same template as a saved one.
	 */
	/**
	 * The affiliate vehicle-type flow only fills `vehicle_type_name` when a VehicleList
	 * row matches by unique_key; on edit/repeat and some first loads it stays empty
	 * while `vehicle_type` (the category id) is set. Fall back to the BigData label so
	 * the preview's Vehicle Type row still renders.
	 */
	private resolveVehicleTypeName(name: any, typeId: any, isReturn = false): string {
		if (name && isNaN(Number(name))) return name
		if (!typeId) return name || ''
		const matchBig = (this.BigData?.vehicleCategories || []).find((c: any) => c?.id == typeId)
		if (matchBig?.name) return matchBig.name
		const arr = isReturn ? this.return_vehicleType_arr : this.vehicleType_arr
		const matchArr = (arr || []).find((c: any) => c?.vehicleType_id == typeId || c?.id == typeId)
		return matchArr?.vehicleType || matchArr?.name || name || ''
	}

	private resolveVehicleMakeName(name: any, val: any, isReturn = false): string {
		if (name && isNaN(Number(name))) return name;
		if (!val) return name || '';
		const arr = isReturn ? this.return_vehicleMake_arr : this.vehicleMake_arr;
		const matchArr = (arr || []).find((item: any) => item.make_id == val || item.id == val);
		if (matchArr?.make || matchArr?.name) return matchArr.make || matchArr.name;
		const matchBig = (this.BigData?.vehicleMakes || []).find((c: any) => c?.id == val);
		if (matchBig?.name || matchBig?.make) return matchBig.name || matchBig.make;
		if (isNaN(Number(val))) return val;
		return name || '';
	}

	private resolveVehicleModelName(name: any, val: any, isReturn = false): string {
		if (name && isNaN(Number(name))) return name;
		if (!val) return name || '';
		const arr = isReturn ? this.return_vehicleModal_arr : this.vehicleModal_arr;
		const matchArr = (arr || []).find((item: any) => item.model_id == val || item.id == val);
		if (matchArr?.model || matchArr?.name) return matchArr.model || matchArr.name;
		const matchBig = (this.BigData?.vehicleModels || []).find((c: any) => c?.id == val);
		if (matchBig?.name || matchBig?.model) return matchBig.name || matchBig.model;
		if (isNaN(Number(val))) return val;
		return name || '';
	}

	private resolveVehicleYearName(name: any, val: any, isReturn = false): string {
		if (name && isNaN(Number(name))) return name;
		if (!val) return name || '';
		const arr = isReturn ? this.return_vehicleYear_arr : this.vehicleYear_arr;
		const matchArr = (arr || []).find((item: any) => item.year_id == val || item.id == val);
		if (matchArr?.year || matchArr?.name) return matchArr.year || matchArr.name;
		const matchBig = (this.BigData?.vehicleYears || []).find((c: any) => c?.id == val);
		if (matchBig?.name || matchBig?.year) return matchBig.name || matchBig.year;
		if (typeof val === 'number' && val > 1900 && val < 2100) return String(val);
		if (typeof val === 'string' && !isNaN(Number(val)) && Number(val) > 1900 && Number(val) < 2100) return val;
		if (isNaN(Number(val))) return val;
		return name || '';
	}

	private resolveVehicleColorName(name: any, val: any, isReturn = false): string {
		if (name && isNaN(Number(name))) return name;
		if (!val) return name || '';
		const arr = isReturn ? this.return_vehicleColor_arr : this.vehicleColor_arr;
		const matchArr = (arr || []).find((item: any) => item.color_id == val || item.id == val);
		if (matchArr?.color || matchArr?.name) return matchArr.color || matchArr.name;
		const matchBig = (this.BigData?.vehicleColors || []).find((c: any) => c?.id == val);
		if (matchBig?.name || matchBig?.color) return matchBig.name || matchBig.color;
		if (isNaN(Number(val))) return val;
		return name || '';
	}

	private buildBookingPreviewPayload(): any {
		const v = this.BookingForm.value
		const isEdit = this.Form.updateType.value == 'edit' || this.updateType == 'edit'
		const isRoundTrip = v.service_type == 'round_trip'

		let share_array: any = null
		try {
			share_array = this.RatesForm ? this.createReservationShareArray() : null
		} catch (e) {
			console.error('[BookingPreview] Failed to build share array for preview', e)
		}

		let return_share_array: any = null
		try {
			return_share_array = isRoundTrip ? (this.createReservationReturnShareArray() || null) : null
		} catch (e) {
			console.error('[BookingPreview] Failed to build return share array for preview', e)
		}

		const affiliateName = [
			this.AffiliateInformation?.FirstName,
			this.AffiliateInformation?.MiddleName,
			this.AffiliateInformation?.LastName
		].filter(part => !!part).join(' ')

		const returnAffiliateName = [
			this.ReturnAffiliateInformation?.FirstName,
			this.ReturnAffiliateInformation?.MiddleName,
			this.ReturnAffiliateInformation?.LastName
		].filter(part => !!part).join(' ')

		const mapStops = (stops: any) => (stops || []).map((stop: any) => ({
			address: stop?.address,
			latitude: stop?.latitude,
			longitude: stop?.longitude
		}))

		const extra_stops = mapStops(v.extra_stops)

		return {
			reservation_id: isEdit ? (this.booking_id || v.reservation_id) : '',
			booking_status: isEdit
				? (this.bookingResponse?.booking_status || 'pending')
				: (v.driver_name ? 'pending' : 'driver_unassigned'),
			payment_status: this.bookingResponse?.payment_status || 'unpaid',
			reservation_type: this.isFarmoutBooking ? 'farmout' : (this.bookingResponse?.reservation_type || 'booking'),
			account_type: v.account_type,
			created_by: this.isCreatedByAdmin ? 1 : 0,

			// ── Trip basics ──
			service_type: v.service_type,
			transfer_type: v.transfer_type || '',
			return_transfer_type: v.return_transfer_type || '',
			cancellation_hours: v.cancellation_hours,
			number_of_hours: this.number_of_hours,
			pickup_date: v.pickup_date,
			pickup_time: v.pickup_time,
			total_passengers: v.total_passengers,
			luggage_count: v.luggage_count,

			// ── Vehicle ──
			vehicle_type_name: this.resolveVehicleTypeName(v.vehicle_type_name, v.vehicle_type, false),
			vehicle_make: this.resolveVehicleMakeName(v.vehicle_make_name, v.vehicle_make, false),
			vehicle_model: this.resolveVehicleModelName(v.vehicle_model_name, v.vehicle_model, false),
			vehicle_year: this.resolveVehicleYearName(v.vehicle_year_name, v.vehicle_year, false),
			vehicle_color: this.resolveVehicleColorName(v.vehicle_color_name, v.vehicle_color, false),

			// ── Route ──
			pickup: v.pickup,
			pickup_latitude: v.pickup_latitude,
			pickup_longitude: v.pickup_longitude,
			pickup_address: v.fbo_address,
			pickup_airport_name: this.getPreviewAirportDisplay(v.pickup_airport_name, v.pickup_airport_option),
			pickup_airport_latitude: v.pickup_airport_latitude,
			pickup_airport_longitude: v.pickup_airport_longitude,
			pickup_airline_name: v.pickup_airline_name,
			pickup_flight: v.pickup_flight,
			cruise_port: v.cruise_port,
			cruise_name: v.cruise_name,
			cruise_time: v.cruise_time,
			extra_stops: extra_stops,
			dropoff: v.dropoff,
			dropoff_latitude: v.dropoff_latitude,
			dropoff_longitude: v.dropoff_longitude,
			// FBO details are pickup-only (see routePickupOnlyFields), so a drop-off has none.
			dropoff_address: '',
			dropoff_airport_name: this.getPreviewAirportDisplay(v.dropoff_airport_name, v.dropoff_airport_option),
			dropoff_airport_latitude: v.dropoff_airport_latitude,
			dropoff_airport_longitude: v.dropoff_airport_longitude,
			dropoff_airline_name: v.dropoff_airline_name,
			dropoff_flight: v.dropoff_flight,
			distance: this.distance,
			duration: v.journeyTime,

			// ── Instructions ──
			booking_instructions: v.booking_instructions,
			meet_greet_choice_name: v.meet_greet_choices_name,

			// ── Passenger ──
			passenger_name: v.passenger_name,
			passenger_email: v.passenger_email,
			passenger_cell: v.passenger_cell,
			passenger_cell_isd: v.passenger_cell_isd,

			// ── Driver ──
			driver_name: v.driver_name,
			driver_email: v.driver_email,
			driver_cell: v.driver_cell,
			driver_cell_isd: v.driver_cell_isd,

			// ── Affiliate ──
			affiliate_type: v.affiliate_type,
			affiliate_name: affiliateName,
			affiliate_email: this.AffiliateInformation?.Email,
			affiliate_phone: this.AffiliateInformation?.CellNumber,
			affiliate_phone_isd: this.AffiliateInformation?.CellIsd,
			lose_affiliate_name: v.lose_affiliate_name,
			lose_affiliate_email: v.lose_affiliate_email,
			lose_affiliate_phone: v.lose_affiliate_phone,
			lose_affiliate_phone_isd: v.lose_affiliate_phone_isd,

			// ── Return leg ──
			// Emitted as empty strings on a one-way so the receipt's normaliser sees nothing.
			return_pickup_date: isRoundTrip ? v.return_pickup_date : '',
			return_pickup_time: isRoundTrip ? v.return_pickup_time : '',
			return_pickup: isRoundTrip ? v.return_pickup : '',
			return_pickup_latitude: isRoundTrip ? v.return_pickup_latitude : '',
			return_pickup_longitude: isRoundTrip ? v.return_pickup_longitude : '',
			return_fbo_address: isRoundTrip ? v.return_fbo_address : '',
			return_pickup_airport_name: isRoundTrip
				? this.getPreviewAirportDisplay(v.return_pickup_airport_name, v.return_pickup_airport_option)
				: '',
			return_pickup_latitude_airport: isRoundTrip ? v.return_pickup_airport_latitude : '',
			return_pickup_longitude_airport: isRoundTrip ? v.return_pickup_airport_longitude : '',
			return_pickup_airline_name: isRoundTrip ? v.return_pickup_airline_name : '',
			return_pickup_flight: isRoundTrip ? v.return_pickup_flight : '',
			return_extra_stops: isRoundTrip ? mapStops(v.return_extra_stops) : [],
			return_dropoff: isRoundTrip ? v.return_dropoff : '',
			return_dropoff_latitude: isRoundTrip ? v.return_dropoff_latitude : '',
			return_dropoff_longitude: isRoundTrip ? v.return_dropoff_longitude : '',
			return_dropoff_airport_name: isRoundTrip
				? this.getPreviewAirportDisplay(v.return_dropoff_airport_name, v.return_dropoff_airport_option)
				: '',
			return_dropoff_latitude_airport: isRoundTrip ? v.return_dropoff_airport_latitude : '',
			return_dropoff_longitude_airport: isRoundTrip ? v.return_dropoff_airport_longitude : '',
			return_dropoff_airline_name: isRoundTrip ? v.return_dropoff_airline_name : '',
			return_dropoff_flight: isRoundTrip ? v.return_dropoff_flight : '',
			return_cruise_port: isRoundTrip ? v.return_cruise_port : '',
			return_cruise_name: isRoundTrip ? v.return_cruise_name : '',
			return_cruise_time: isRoundTrip ? v.return_cruise_time : '',
			return_booking_instructions: isRoundTrip ? v.return_booking_instructions : '',
			return_meet_greet_choice_name: isRoundTrip ? v.return_meet_greet_choices_name : '',
			return_cancellation_hours: isRoundTrip ? v.return_cancellation_hours : '',
			return_distance: isRoundTrip ? this.return_distance : '',
			return_duration: isRoundTrip ? v.returnJourneyTime : '',

			return_vehicle_type_name: isRoundTrip ? this.resolveVehicleTypeName(v.return_vehicle_type_name, v.return_vehicle_type, true) : '',
			return_vehicle_make: isRoundTrip ? this.resolveVehicleMakeName(v.return_vehicle_make_name, v.return_vehicle_make, true) : '',
			return_vehicle_model: isRoundTrip ? this.resolveVehicleModelName(v.return_vehicle_model_name, v.return_vehicle_model, true) : '',
			return_vehicle_year: isRoundTrip ? this.resolveVehicleYearName(v.return_vehicle_year_name, v.return_vehicle_year, true) : '',
			return_vehicle_color: isRoundTrip ? this.resolveVehicleColorName(v.return_vehicle_color_name, v.return_vehicle_color, true) : '',

			return_driver_name: isRoundTrip ? v.return_driver_name : '',
			return_driver_email: isRoundTrip ? v.return_driver_email : '',
			return_driver_cell: isRoundTrip ? v.return_driver_cell : '',
			return_driver_cell_isd: isRoundTrip ? v.return_driver_cell_isd : '',

			return_affiliate_type: isRoundTrip ? v.return_affiliate_type : '',
			return_affiliate_name: isRoundTrip ? returnAffiliateName : '',
			return_affiliate_email: isRoundTrip ? this.ReturnAffiliateInformation?.Email : '',
			return_affiliate_phone: isRoundTrip ? this.ReturnAffiliateInformation?.CellNumber : '',
			return_affiliate_phone_isd: isRoundTrip ? this.ReturnAffiliateInformation?.CellIsd : '',
			return_lose_affiliate_name: isRoundTrip ? v.return_lose_affiliate_name : '',
			return_lose_affiliate_email: isRoundTrip ? v.return_lose_affiliate_email : '',
			return_lose_affiliate_phone: isRoundTrip ? v.return_lose_affiliate_phone : '',
			return_lose_affiliate_phone_isd: isRoundTrip ? v.return_lose_affiliate_phone_isd : '',

			// ── Money ──
			currency_symbol: this.currencySymbol,
			share_array: share_array,
			grand_total: this.RatesForm?.grand_total,
			return_share_array: return_share_array,
			return_grand_total: isRoundTrip ? this.ReturnRatesForm?.r_grandtotal : null
		}
	}

	/** Preview button: render the current form through the shared receipt modal. */
	openBookingReceiptPreview(): void {
		console.log("DEBUG - BOOKING PREVIEW")
		if (!this.bookingPreviewModal) {
			console.error('[BookingPreview] Preview modal component is not available')
			return
		}

		const isEdit = this.Form.updateType.value == 'edit' || this.updateType == 'edit'
		this.bookingPreviewModal.openLocalPreview(
			this.buildBookingPreviewPayload(),
			this.previewUserRole,
			isEdit ? 'edit' : 'create'
		)
	console.log("DEBUG - BOOKING PREVIEW")

	}

	/** Fetch booking data for edit from the portal-specific endpoint. */
	private fetchBookingDataForEdit(booking_id: any, updateType: string): Observable<any> {
		if (this.isIndividualMode) {
			return this.individualService.getBookingDataForEdit(booking_id, updateType) as Observable<any>
		}
		if (this.isTravelAgentMode) {
			return this.TravelAgentService.getBookingDataForEdit(booking_id, updateType) as Observable<any>
		}
		if(this.isAffiliateMode){
			return this.affiliateService.getBookingDataForEdit(booking_id) as Observable<any>
		}
		return this.$api.getBookingDataForEdit(booking_id, updateType) as Observable<any>
	}

	/** Create/edit the reservation through the portal-specific endpoint. */
	private createBookingByMode(payload: any, updateType: string): Observable<any> {
		if (this.isIndividualMode) {
			// mirror individual/create-new-booking payload: booking_created_from is only sent for subscribers
			if (this.currentUser?.created_by_role == 'subscriber') {
				payload['booking_created_from'] = 'subscriber'
			}
			else {
				delete payload['booking_created_from']
			}
			return this.individualService.createBooking(payload, updateType) as Observable<any>
		}
		if (this.isTravelAgentMode) {
			return this.TravelAgentService.createBooking(payload, updateType) as Observable<any>
		}
		if (this.isAffiliateMode) {
			return this.affiliateService.createBooking(payload) as Observable<any>
		}
		if (this.isGuestMode) {
			// public quotebot endpoint; there is no logged-in creator to attribute
			delete payload['booking_created_from']
			return this.$quotebot.createBooking(payload, updateType) as Observable<any>
		}
		return this.$api.createBooking(payload, updateType) as Observable<any>
	}

	/** Where to land after a successful save, per portal. */
	private navigatePostSave(response?: any) {
		// submitForm() shows the spinner before createBookingByMode(); only the
		// "needs confirmation" branch hides it, so the success path has to clear it
		// here or the destination page renders behind a stuck overlay.
		this.$spinner.hide()
		if (this.isGuestMode) {
			// guests have no bookings list to land on — carry the reference through
			// router state so the public confirmation page can show it
			this.$router.navigate(['/quotebot/booking-confirmation'], {
				state: {
					reservation_id: response?.data?.reservation_id ?? response?.data?.id ?? null,
					confirmation_number: response?.data?.confirmation_number ?? null,
					email: this.BookingForm.get('loose_customer.email')?.value ?? null,
					message: response?.message ?? null
				}
			})
			return
		}
		if (this.isAffiliateMode) {
			const targetPath = this.currentUser?.roleName == 'sub_affiliate' ? '/sub_affiliate/my-bookings' : '/affiliate/my-bookings';
			this.$router.navigate([targetPath]).then(() => {
				window.location.reload();
			});
			return;
		}
		if (this.isIndividualMode || this.isTravelAgentMode) {
			this.$router.navigate([`/${this.currentUser?.roleName}/bookings`])
			return
		}
		this.$router.navigate(['/admin/daily-bookings-admin'])
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


	fetchDistanceAndTime(route: any, is_return: boolean = false): Promise<{ [key: string]: number }> {
		let total_distance = 0.0
		let total_time = 0
		// A zero-length leg means two consecutive points resolve to the same place. That is
		// only acceptable on a charter tour; for one-way / round trip it is a hard error.
		const allowsSameLocations = this.BookingForm.get('service_type').value == 'charter_tour'
		const hasZeroDistanceLeg = (route?.legs || []).some((item: any) => Number(item?.distance?.value) === 0)
		const invalidRoute = hasZeroDistanceLeg && !allowsSameLocations

		if (is_return) {
			this.hasInvalidReturnRoutePoint = invalidRoute
		} else {
			this.hasInvalidRoutePoint = invalidRoute
		}

		return new Promise((resolve) => {
			if (invalidRoute) {
				this.logDualPopup('locationErrorModal', 'fetchDistanceAndTime:zeroDistanceLeg', {
					is_return,
					allowsSameLocations,
					legs: (route?.legs || []).map((item: any) => ({
						distanceMeters: item?.distance?.value,
						durationSeconds: item?.duration?.value,
						start: item?.start_address,
						end: item?.end_address
					}))
				});
				this.$errors.openDialog({
					errors: {
						error: 'Please select a valid location point.'
					}
				})
				// Resolve with zeroed totals so the caller never hangs, but keep the
				// invalid-route flag set so submitForm() can block the booking.
				resolve({
					distance: 0,
					time: 0
				})
				return
			}

			(route?.legs || []).forEach((item: any) => {
				total_distance += item.distance.value
				total_time += item.duration.value
			})
			resolve({
				distance: total_distance,
				time: total_time
			})
		})
	}

	/** Normalized text form of an address used when comparing two locations. */
	private normalizeLocationText(value: any): string {
		return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
	}

	/**
	 * Builds a comparable identity for a location. Coordinates win when both are
	 * resolved; otherwise the typed address text is used so unresolved duplicates
	 * are still caught.
	 */
	private getLocationIdentity(value: any, lat: any, long: any): string {
		const normalizedValue = this.normalizeLocationText(value);
		const latitude = Number(lat);
		const longitude = Number(long);

		if (lat !== '' && lat != null && long !== '' && long != null && Number.isFinite(latitude) && Number.isFinite(longitude)) {
			return `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
		}

		return normalizedValue;
	}

	/**
	 * Identity of a booking leg endpoint, honouring the airport override the map
	 * controller applies for `airport_*` / `*_airport` transfer types.
	 */
	private getBookingLegLocationIdentity(leg: 'pickup' | 'dropoff', is_return: boolean = false): string {
		const prefix = is_return ? 'return_' : '';

		if (this.isAirportLeg(leg, is_return)) {
			return this.getLocationIdentity(
				this.Form[`${prefix}${leg}_airport_name`]?.value || this.Form[`${prefix}${leg}_airport`]?.value,
				this.Form[`${prefix}${leg}_airport_latitude`]?.value,
				this.Form[`${prefix}${leg}_airport_longitude`]?.value
			);
		}

		return this.getLocationIdentity(
			this.Form[`${prefix}${leg}`]?.value,
			this.Form[`${prefix}${leg}_latitude`]?.value,
			this.Form[`${prefix}${leg}_longitude`]?.value
		);
	}

	/** True when the transfer type makes this endpoint an airport rather than a street address. */
	private isAirportLeg(leg: 'pickup' | 'dropoff', is_return: boolean = false): boolean {
		const transferType = String((is_return ? this.Form.return_transfer_type?.value : this.Form.transfer_type?.value) || '');
		return leg === 'pickup' ? transferType.includes('airport_') : transferType.includes('_airport');
	}

	/**
	 * Name of the *visible* control for a leg endpoint — the airport picker when the
	 * transfer type is airport-based, the address input otherwise. This is what gets
	 * the red border and the scroll.
	 */
	private getBookingLegFieldKey(leg: 'pickup' | 'dropoff', is_return: boolean = false): string {
		const prefix = is_return ? 'return_' : '';
		return this.isAirportLeg(leg, is_return)
			? `${prefix}${leg}_airport_option`
			: `${prefix}${leg}`;
	}

	/** Identities of every extra stop on a leg, in order (blank slots keep their index). */
	private getExtraStopIdentities(is_return: boolean = false): string[] {
		const formArray = this.BookingForm.get(is_return ? 'return_extra_stops' : 'extra_stops') as FormArray | null;
		if (!formArray) {
			return [];
		}

		return formArray.controls
			.map((control) => (control as FormGroup).getRawValue())
			.map((stop: any) => this.getLocationIdentity(stop?.address, stop?.latitude, stop?.longitude));
	}

	/**
	 * One-way and round trip bookings must visit distinct places. Only charter tours
	 * may reuse the same pickup / drop-off / stop location, so this re-runs on every
	 * submit — the service type can change after a charter route was already built.
	 *
	 * Returns the message to show plus the field keys to highlight, so the user is
	 * taken straight to the offending inputs when they dismiss the dialog.
	 */
	private getSameLocationError(): { message: string; fields: string[] } | null {
		const serviceType = this.Form.service_type?.value;
		if (serviceType != 'one_way' && serviceType != 'round_trip') {
			return null;
		}

		const legs: Array<boolean> = serviceType == 'round_trip' ? [false, true] : [false];

		for (const isReturn of legs) {
			const pickup = this.getBookingLegLocationIdentity('pickup', isReturn);
			const dropoff = this.getBookingLegLocationIdentity('dropoff', isReturn);

			if (pickup && dropoff && pickup === dropoff) {
				return {
					message: 'Pickup and drop-off locations must be different for One Way and Round Trip bookings.',
					fields: [
						this.getBookingLegFieldKey('pickup', isReturn),
						this.getBookingLegFieldKey('dropoff', isReturn)
					]
				};
			}

			// Walk pickup → stops → drop-off and flag the first point that repeats an earlier one.
			const points: Array<{ identity: string; field: string }> = [
				{ identity: pickup, field: this.getBookingLegFieldKey('pickup', isReturn) },
				...this.getExtraStopIdentities(isReturn).map((identity, index) => ({
					identity,
					field: this.getExtraStopFieldKey(isReturn, index)
				})),
				{ identity: dropoff, field: this.getBookingLegFieldKey('dropoff', isReturn) }
			].filter((point) => !!point.identity);

			for (let i = 0; i < points.length; i++) {
				const duplicateOf = points.findIndex((point, index) => index < i && point.identity === points[i].identity);
				if (duplicateOf !== -1) {
					return {
						message: 'Extra stop locations must be different from the pickup, drop-off and each other for One Way and Round Trip bookings.',
						fields: [points[duplicateOf].field, points[i].field]
					};
				}
			}
		}

		return null;
	}

	/** Field keys currently flagged by the same-location check, used for the red border. */
	sameLocationFields: string[] = [];

	/** Template helper: does this field carry the same-location error? */
	isSameLocationField(field: string): boolean {
		return this.sameLocationFields.includes(field);
	}

	/** Template helper: does this extra stop carry the same-location error? */
	isSameLocationStop(is_return: boolean, index: number): boolean {
		return this.isSameLocationField(this.getExtraStopFieldKey(is_return, index));
	}

	/**
	 * Mark the offending inputs so they render with a red border, and stamp a
	 * `sameLocation` error on the backing controls where one exists.
	 */
	private flagSameLocationFields(fields: string[]): void {
		this.sameLocationFields = [...fields];
		fields.forEach((field) => {
			const control = this.resolveSameLocationControl(field);
			if (!control) {
				return;
			}
			control.setErrors({ ...(control.errors || {}), sameLocation: true });
			control.markAsTouched();
		});
	}

	/** Drop the same-location flags so a corrected form can be resubmitted. */
	private clearSameLocationErrors(): void {
		this.sameLocationFields.forEach((field) => {
			const control = this.resolveSameLocationControl(field);
			if (control?.hasError('sameLocation')) {
				const { sameLocation: _removed, ...rest } = control.errors || {};
				control.setErrors(Object.keys(rest).length ? rest : null);
			}
		});
		this.sameLocationFields = [];
	}

	/** Backing control for a same-location field key (extra stops resolve to their address control). */
	private resolveSameLocationControl(field: string): AbstractControl | null {
		const extraStopField = this.parseExtraStopFieldKey(field);
		if (extraStopField) {
			const formArray = this.BookingForm.get(extraStopField.formArrayName) as FormArray | null;
			return (formArray?.at(extraStopField.index) as FormGroup | undefined)?.get('address') ?? null;
		}
		return this.BookingForm.get(field);
	}

	/** The input element rendering a same-location field key, if it is on screen. */
	private getSameLocationFieldInput(field: string): ElementRef | null {
		const extraStopField = this.parseExtraStopFieldKey(field);
		if (extraStopField) {
			const inputs = extraStopField.formArrayName === 'return_extra_stops'
				? this.returnExtraStopInputs
				: this.extraStopInputs;
			return inputs?.toArray()[extraStopField.index] ?? null;
		}

		const inputsByField: { [key: string]: ElementRef } = {
			pickup: this.pickupInput,
			dropoff: this.dropoffInput,
			return_pickup: this.return_pickupInput,
			return_dropoff: this.return_dropoffInput,
			pickup_airport_option: this.pickupAirportInput,
			dropoff_airport_option: this.dropoffAirportInput,
			return_pickup_airport_option: this.returnPickupAirportInput,
			return_dropoff_airport_option: this.returnDropoffAirportInput
		};
		return inputsByField[field] ?? null;
	}

	/**
	 * Bring the first flagged location field into view and focus it. Runs once the
	 * error dialog has closed so the modal backdrop is no longer covering the form.
	 */
	private scrollToSameLocationField(fields: string[]): void {
		for (const field of fields) {
			const input = this.getSameLocationFieldInput(field)?.nativeElement as HTMLElement | undefined;
			if (!input || !(input.offsetParent || input.getClientRects().length)) {
				continue;
			}
			input.scrollIntoView({ behavior: 'smooth', block: 'center' });
			setTimeout(() => input.focus({ preventScroll: true }), 350);
			return;
		}
	}

	/**
	 * Show the same-location error, highlight the offending inputs, and jump to the
	 * first of them as soon as the user dismisses the dialog.
	 */
	private reportSameLocationError(error: { message: string; fields: string[] }): void {
		this.flagSameLocationFields(error.fields);

		const opened = this.$errors.openDialog({
			errors: {
				error: error.message
			}
		}) !== false;

		if (!opened) {
			// Dialog was suppressed (already open) — jump to the field straight away.
			this.scrollToSameLocationField(error.fields);
			return;
		}

		// Wait for the modal to close so the backdrop isn't covering the field we scroll to.
		// Namespaced + `one` so repeated submits never stack handlers.
		$('#globalErrorModal')
			.off('hidden.bs.modal.sameLocationScroll')
			.one('hidden.bs.modal.sameLocationScroll', () => {
				this.zone.run(() => this.scrollToSameLocationField(error.fields));
			});
	}

	/**
	 * Re-runs the route/location validation after the service type changes so a
	 * charter route that was allowed to reuse locations is re-checked as soon as
	 * the booking becomes One Way or Round Trip.
	 */
	private revalidateRouteForServiceType(): void {
		this.hasInvalidRoutePoint = false;
		this.hasInvalidReturnRoutePoint = false;
		this.clearSameLocationErrors();
		if (this.hasValidRouteCoordinates(false)) {
			this.MapController();
		}
		if (this.Form.service_type.value == 'round_trip' && this.hasValidRouteCoordinates(true)) {
			this.MapController(true);
		}
	}


	toggleDropdown(type: string) {
		// console.log('Toggle Dropdown ', type)
		this.booking_params['chevrons'][type] = !this.booking_params['chevrons'][type]
	}
	handleChangeVehicleType(event) {
		this.isUserManualSelection = true;
		this.VehicleList.map(i => (i.unique_key == event.unique_key) ? this.handleSelectVehicleType(i) : '')
	}
	handleReturnChangeVehicleType(event) {
		this.isUserManualReturnSelection = true;
		this.return_VehicleList.map(i => (i.unique_key == event.unique_key) ? this.handleReturnSelectVehicleType(i) : '')
	}

	updateOutboundLegValidators(value: string) {
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

		if (value.includes("city_")) {
			this.SetFormValue('booking_instructions', '<ol><li>Driver - Text on location. Text the client a day before to confirm driver name , cell phone and booking details. Text client with ETA when en route</li></ol>');
		}

		// set cruise ship name and cruise port mandatory
		if (value.includes('_cruise') || value.includes('cruise_')) {
			if (value.includes("cruise_")) {
				this.SetFormValue('booking_instructions', '<ol><li>Pax - Text driver when docked.</li><li>Driver - Text the client a day before to confirm driver name , cell phone and booking details. Text client with ETA when en route. Text pax with pickup instructions when ship has arrived.</li></ol>');
			}
			this.BookingForm.get('cruise_name').setValidators([Validators.required]);
			this.BookingForm.get('cruise_port').setValidators([Validators.required]);
			this.BookingForm.get('cruise_name').updateValueAndValidity();
			this.BookingForm.get('cruise_port').updateValueAndValidity();
		} else {
			this.BookingForm.get('cruise_name').clearValidators();
			this.BookingForm.get('cruise_port').clearValidators();
			this.BookingForm.get('cruise_name').updateValueAndValidity();
			this.BookingForm.get('cruise_port').updateValueAndValidity();
		}

		// set flight number mandatory
		if (value.includes('_airport')) {
			this.BookingForm.get('dropoff_airline_option').setValidators([Validators.required]);
			this.BookingForm.get('dropoff_airline_option').updateValueAndValidity();
			this.BookingForm.get('dropoff_airport_option').setValidators([Validators.required]);
			this.BookingForm.get('dropoff_airport_option').updateValueAndValidity();
		} else {
			this.BookingForm.get('dropoff_airline_option').clearValidators();
			this.BookingForm.get('dropoff_airline_option').updateValueAndValidity();
			this.BookingForm.get('dropoff_airport_option').clearValidators();
			this.BookingForm.get('dropoff_airport_option').updateValueAndValidity();
		}

		if (value.includes('airport_')) {
			this.SetFormValue('booking_instructions', '<ol><li>Pax - Text driver when landing.</li><li>Driver - Text the client a day before to confirm driver name , cell phone and booking details. Text client with ETA when en route. Text pax with pickup instructions when plane has arrived.</li></ol>');
			this.BookingForm.get('pickup_flight').setValidators([Validators.required]);
			this.BookingForm.get('pickup_flight').updateValueAndValidity();
			this.BookingForm.get('pickup_airline_option').setValidators([Validators.required]);
			this.BookingForm.get('pickup_airline_option').updateValueAndValidity();
			this.BookingForm.get('pickup_airport_option').setValidators([Validators.required]);
			this.BookingForm.get('pickup_airport_option').updateValueAndValidity();
			this.BookingForm.get('origin_airport_city').setValidators([Validators.required]);
			this.BookingForm.get('origin_airport_city').updateValueAndValidity();
		} else {
			this.BookingForm.get('pickup_flight').clearValidators();
			this.BookingForm.get('pickup_flight').updateValueAndValidity();
			this.BookingForm.get('pickup_airline_option').clearValidators();
			this.BookingForm.get('pickup_airline_option').updateValueAndValidity();
			this.BookingForm.get('pickup_airport_option').clearValidators();
			this.BookingForm.get('pickup_airport_option').updateValueAndValidity();
			this.BookingForm.get('origin_airport_city').clearValidators();
			this.BookingForm.get('origin_airport_city').updateValueAndValidity();
		}
	}

	updateReturnLegValidators(value: string) {
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
		// Tear down any previously wired form subscriptions (queryParams can re-run this
		// on in-place navigation), otherwise every handler fires once per wiring pass.
		this.formSubscriptionsReset$.next();
		// Wired here rather than in ngOnInit because the reset above would
		// otherwise tear these streams down on the first re-wiring pass.
		this.initAffiliateSearchStream();
		if (this.updateType == 'edit') {
			this.BookingForm?.get('pickup_time')?.valueChanges.pipe(takeUntil(this.formSubscriptionsReset$)).subscribe((value: string) => {
				this.clearPastDateTimeError();
				this.schedule24HourWarningCheck();
				if (!this.isManualRateEntered()) {
					this.buildBookingData();
				}
			})
			this.BookingForm?.get('return_pickup_time')?.valueChanges.pipe(takeUntil(this.formSubscriptionsReset$)).subscribe((value: string) => {
				this.clearPastDateTimeError();
				this.schedule24HourWarningCheck();
				if (!this.isManualRateEntered()) {
					this.buildBookingData();
				}
			})
		} else {
			//pickup time change
			this.BookingForm?.get('pickup_time')?.valueChanges.pipe(takeUntil(this.formSubscriptionsReset$)).subscribe((value: string) => {
				this.clearPastDateTimeError();
				this.schedule24HourWarningCheck();
				this.buildBookingData()
			})
			this.BookingForm?.get('return_pickup_time')?.valueChanges.pipe(takeUntil(this.formSubscriptionsReset$)).subscribe((value: string) => {
				this.clearPastDateTimeError();
				this.schedule24HourWarningCheck();
				this.buildBookingData()
			})
		}
		// Clear the past date & time errors as soon as either pickup date is changed.
		this.BookingForm?.get('pickup_date')?.valueChanges.pipe(takeUntil(this.formSubscriptionsReset$)).subscribe(() => {
			this.clearPastDateTimeError();
			this.schedule24HourWarningCheck();
		})
		this.BookingForm?.get('return_pickup_date')?.valueChanges.pipe(takeUntil(this.formSubscriptionsReset$)).subscribe(() => {
			this.clearPastDateTimeError();
			this.schedule24HourWarningCheck();
		})

		// Service Type
		this.BookingForm?.get('service_type')?.valueChanges.pipe(takeUntil(this.formSubscriptionsReset$)).subscribe((value: string) => {
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
					cancellation_hours: this.selectedVehicle?.non_charter_cancellation_hours?.toString() ?? '24',
					return_cancellation_hours: this.return_selectedVehicle?.non_charter_cancellation_hours?.toString() ?? '24',
					return_affiliate_id: this.BookingForm?.get('affiliate_id')?.value
				})
				if (this.Form.affiliate_type.value === 'in_progress_affiliate') {
					this.BookingForm.patchValue({
						return_affiliate_type: 'in_progress_affiliate'
					});
					const firstAffId = this.BookingForm?.get('affiliate_id')?.value;
					if (firstAffId) {
						this.BookingForm.patchValue({
							return_affiliate_id: firstAffId
						});
						if (this.selectedPendingAffiliate) {
							this.chooseReturnPendingAffiliate(this.selectedPendingAffiliate);
						}
					}
				}
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
				this.BookingForm.patchValue({
					cancellation_hours: this.selectedVehicle?.charter_cancellation_hours?.toString() ?? '24',
					return_cancellation_hours: this.return_selectedVehicle?.charter_cancellation_hours?.toString() ?? '24'
				})
			}
			if (value == 'one_way' || value == 'charter_tour') {
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
				if (value == 'one_way') {
					this.BookingForm.patchValue({
						cancellation_hours: this.selectedVehicle?.non_charter_cancellation_hours?.toString() ?? '24',
						return_cancellation_hours: this.return_selectedVehicle?.non_charter_cancellation_hours?.toString() ?? '24'
					})
				} else {
					this.BookingForm.patchValue({
						cancellation_hours: this.selectedVehicle?.charter_cancellation_hours?.toString() ?? '24',
						return_cancellation_hours: this.return_selectedVehicle?.charter_cancellation_hours?.toString() ?? '24'
					})
				}

				// Clear return leg address validators
				this.BookingForm?.get('return_pickup')?.clearValidators();
				this.BookingForm?.get('return_dropoff')?.clearValidators();
				this.BookingForm?.get('return_pickup')?.updateValueAndValidity();
				this.BookingForm?.get('return_dropoff')?.updateValueAndValidity();
			}

			// The charter allowance for identical pickup / drop-off / stop locations must not
			// survive a switch to One Way or Round Trip, so re-run the route validation for the
			// new service type instead of relying on the route built under the previous one.
			this.revalidateRouteForServiceType();
		})

		// Transfer Type
		this.BookingForm?.get('transfer_type')?.valueChanges.pipe(takeUntil(this.formSubscriptionsReset$)).subscribe((value: string) => {

			this.updateOutboundLegValidators(value);

			// Store old value for comparison
			const oldValue = this.transfer_type;
			const newValue = value;

			// Flip addresses for round trip when changing between complementary transfer types
			if (this.BookingForm.get('service_type').value == 'round_trip') {
				if ((oldValue == 'city_to_airport' && newValue == 'airport_to_city') ||
					(oldValue == 'airport_to_city' && newValue == 'city_to_airport') ||
					(oldValue == 'city_to_cruise' && newValue == 'cruise_to_city') ||
					(oldValue == 'cruise_to_city' && newValue == 'city_to_cruise')) {


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
		})


		this.BookingForm?.get('return_transfer_type')?.valueChanges.pipe(takeUntil(this.formSubscriptionsReset$)).subscribe((value: string) => {

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
					// this.BookingForm.get('return_dropoff_flight').setValidators([Validators.required]);
					// this.BookingForm.get('return_dropoff_flight').updateValueAndValidity();
					this.BookingForm.get('return_dropoff_airline_option').setValidators([Validators.required]);
					this.BookingForm.get('return_dropoff_airline_option').updateValueAndValidity();
					this.BookingForm.get('return_dropoff_airport_option').setValidators([Validators.required]);
					this.BookingForm.get('return_dropoff_airport_option').updateValueAndValidity();

				} else {
					// this.BookingForm.get('return_dropoff_flight').clearValidators();
					// this.BookingForm.get('return_dropoff_flight').updateValueAndValidity();
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
			}

			this.return_transfer_type = value
			if (this.Form.service_type.value == 'round_trip') {
				this.refreshMapIfRouteReady(true);
			}
		})


		// Account Type Subscription
		this.BookingForm?.get('account_type')?.valueChanges.pipe(takeUntil(this.formSubscriptionsReset$)).subscribe((value: string) => {
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
						// for every 'key' in card_details formgroup
						for (let key in (loose_customer.get(item) as FormGroup).controls) {
							// set validators in card_details
							(<FormGroup>loose_customer.get(item)).get(key).setValidators([Validators.required]);
							(<FormGroup>loose_customer.get(item)).get(key).updateValueAndValidity();

						}
					}

					if (!this.looseCustomerOptionalFields.includes(item)) {
						loose_customer.get(item).setValidators([Validators.required]);
					}
				}

				(<FormGroup>loose_customer.get('card_details')).get('card_number').setValidators([Validators.required, Validators.pattern("^[0-9+]*$"), Validators.minLength(12), Validators.maxLength(20),]);
				(<FormGroup>loose_customer.get('card_details')).get('name').setValidators([Validators.required]);
				(<FormGroup>loose_customer.get('card_details')).get('cvv').setValidators([Validators.required, Validators.pattern("^[0-9+]*$"), Validators.minLength(3), Validators.maxLength(4),]);
				(<FormGroup>loose_customer.get('card_details')).get('exp_month').setValidators([Validators.required]);
				(<FormGroup>loose_customer.get('card_details')).get('exp_year').setValidators([Validators.required]);
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

		this.BookingForm.get('acc_id').valueChanges.pipe(takeUntil(this.formSubscriptionsReset$)).subscribe((value: number) => {
			if (value && this.updateType == 'repeat' && this.updateType == 'return' && this.updateType == 'edit' && this.updateType == 'round') {
				this.chooseUser(value)
			}
		})

		this.BookingForm.get('travel_client_id').valueChanges.pipe(takeUntil(this.formSubscriptionsReset$)).subscribe((value: number) => {
			console.log('[DEBUG] travel_client_id valueChanges fired ->', value, 'shouldHandlePrefilledBookingAccount:', this.shouldHandlePrefilledBookingAccount(), 'updateType:', this.updateType);
			if (value && this.shouldHandlePrefilledBookingAccount()) {
				this.handleTravelStaffAccounts({ id: value })
			}
		})
		this.BookingForm.get('travel_client_acc').valueChanges.pipe(takeUntil(this.formSubscriptionsReset$)).subscribe((value: any) => {
			if (value == 'travel_loose_customer') {
				setTimeout(() => {
					this.initphonefield()
				}, 200)
				const loose_customer = (this.BookingForm.get('loose_customer') as FormGroup)
				// for every 'item' in loose_customer
				for (let item in loose_customer.controls) {
					// if 'item' in loose_customer is a formgroup, like card_details
					if ((<FormGroup>this.BookingForm.get('loose_customer')).get(item) instanceof FormGroup) {
						// for every 'key' in card_details formgroup
						for (let key in (loose_customer.get(item) as FormGroup).controls) {
							// set validators in card_details
							(<FormGroup>loose_customer.get(item)).get(key).setValidators([Validators.required]);
							(<FormGroup>loose_customer.get(item)).get(key).updateValueAndValidity();

						}
					}

					if (!this.looseCustomerOptionalFields.includes(item)) {
						loose_customer.get(item).setValidators([Validators.required]);
					}
				}

				(<FormGroup>loose_customer.get('card_details')).get('card_number').setValidators([Validators.required, Validators.pattern("^[0-9+]*$"), Validators.minLength(12), Validators.maxLength(20),]);
				(<FormGroup>loose_customer.get('card_details')).get('name').setValidators([Validators.required]);
				(<FormGroup>loose_customer.get('card_details')).get('cvv').setValidators([Validators.required, Validators.pattern("^[0-9+]*$"), Validators.minLength(3), Validators.maxLength(4),]);
				(<FormGroup>loose_customer.get('card_details')).get('exp_month').setValidators([Validators.required]);
				(<FormGroup>loose_customer.get('card_details')).get('exp_year').setValidators([Validators.required]);
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
		this.BookingForm.get('affiliate_type').valueChanges.pipe(takeUntil(this.formSubscriptionsReset$)).subscribe((value: string) => {
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
					// if (this.lose_aff_name_input) {
					// 	this.lose_aff_name_input.nativeElement.focus()
					// }
				}, 200)
				this.fetchAffiliates('loose_affiliate')

				this.toggleDropdown(null)
				if (!this.usesQuoteFlow) {
					this.BookingForm.get('lose_affiliate_name').setValidators([Validators.required])
					this.BookingForm.get('lose_affiliate_phone').setValidators([Validators.required, Validators.pattern("^[0-9+]*$"), Validators.minLength(4), Validators.maxLength(15)])
					this.BookingForm.get('lose_affiliate_email').setValidators([Validators.required, Validators.pattern(/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i)])
				}
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
				this.BookingForm.get('lose_affiliate_name').clearValidators()
				this.BookingForm.get('lose_affiliate_name').updateValueAndValidity()

				this.BookingForm.get('lose_affiliate_phone').clearValidators()
				this.BookingForm.get('lose_affiliate_phone').updateValueAndValidity()


				this.BookingForm.get('lose_affiliate_email').clearValidators()
				this.BookingForm.get('lose_affiliate_email').updateValueAndValidity()

				// this.BookingForm.get('cancellation_hours').clearValidators()
				// this.BookingForm.get('cancellation_hours').updateValueAndValidity()


				this.init_rates = true;
				if (this.Form.service_type.value === 'round_trip') {
					this.init_return_rates = true;
				}
				this.fetchAffiliates(value == 'in_progress_affiliate' ? 'in_progress_affiliate' : 'affiliate')
				if (value === 'affiliate') {
					this.chooseAffiliate()
				}
				if (value === 'in_progress_affiliate' && this.Form.service_type.value === 'round_trip') {
					this.BookingForm.patchValue({
						return_affiliate_type: 'in_progress_affiliate'
					});
					const firstAffId = this.BookingForm.get('affiliate_id')?.value;
					if (firstAffId) {
						this.BookingForm.patchValue({
							return_affiliate_id: firstAffId
						});
						if (this.selectedPendingAffiliate) {
							this.chooseReturnPendingAffiliate(this.selectedPendingAffiliate);
						}
					}
				}
			}
		})

		// Affiliate Type
		this.BookingForm.get('return_affiliate_type').valueChanges.pipe(takeUntil(this.formSubscriptionsReset$)).subscribe((value: string) => {
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
				if (this.service_type == 'round_trip') {
					this.BookingForm.get('return_lose_affiliate_name')
					this.BookingForm.get('return_lose_affiliate_phone')
					this.BookingForm.get('return_lose_affiliate_email')
					// this.BookingForm.get('return_lose_affiliate_name').setValidators([Validators.required])
					// this.BookingForm.get('return_lose_affiliate_phone').setValidators([Validators.required, Validators.pattern("^[0-9+]*$"), Validators.minLength(4), Validators.maxLength(15)])
					// this.BookingForm.get('return_lose_affiliate_email').setValidators([Validators.required, Validators.pattern(/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i)])
				}
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
				this.BookingForm.get('return_lose_affiliate_name').clearValidators()
				this.BookingForm.get('return_lose_affiliate_name').updateValueAndValidity()

				this.BookingForm.get('return_lose_affiliate_phone').clearValidators()
				this.BookingForm.get('return_lose_affiliate_phone').updateValueAndValidity()


				this.BookingForm.get('return_lose_affiliate_email').clearValidators()
				this.BookingForm.get('return_lose_affiliate_email').updateValueAndValidity()

				// this.BookingForm.get('cancellation_hours').clearValidators()
				// this.BookingForm.get('cancellation_hours').updateValueAndValidity()


				this.init_rates = true;
				if (this.Form.service_type.value === 'round_trip') {
					this.init_return_rates = true;
				}
				this.fetchReturnAffiliates(value == 'in_progress_affiliate' ? 'in_progress_affiliate' : 'affiliate')
				if (value === 'affiliate') {
					this.chooseReturnAffiliate()
				}
			}
		})

		this.BookingForm.get('affiliate_id').valueChanges.pipe(distinctUntilChanged(), takeUntil(this.formSubscriptionsReset$)).subscribe((value: number) => {
			// Affiliate portal farm-outs are booking_created_from 'subscriber', but picking
			// an affiliate must still load that affiliate's vehicles/drivers.
			if (value && (this.booking_created_from == 'admin' || this.isAffiliateMode)) {
				if (this.Form.affiliate_type.value === 'in_progress_affiliate') {
					const pendingAff = this.AffiliateAccounts?.find((a: any) => a.id == value) || null;
					this.choosePendingAffiliate(pendingAff);
					if (this.BookingForm.get('service_type').value == 'round_trip') {
						if (this.Form.return_affiliate_type.value !== 'in_progress_affiliate') {
							this.BookingForm.patchValue({
								return_affiliate_type: 'in_progress_affiliate'
							});
						}
						this.BookingForm.patchValue({
							return_affiliate_id: value
						});
						if (pendingAff || this.selectedPendingAffiliate) {
							this.chooseReturnPendingAffiliate(pendingAff || this.selectedPendingAffiliate);
						}
					}
				} else {
					this.chooseAffiliate();
					this.fetchAffiliateInformation(value);
					if (this.BookingForm.get('service_type').value == 'round_trip' && this.Form.affiliate_type.value == 'affiliate' && this.Form.return_affiliate_type.value == 'affiliate') {
						this.BookingForm.patchValue({
							return_affiliate_id: value
						});
					}
				}
			}
		})

		this.BookingForm.get('loose_affiliate_id').valueChanges.pipe(takeUntil(this.formSubscriptionsReset$)).subscribe((value: number) => {
			if (value && this.booking_created_from == 'admin') {
				this.chooseLooseAffiliate()
			}
		})

		this.BookingForm.get('return_affiliate_id').valueChanges.pipe(distinctUntilChanged(), takeUntil(this.formSubscriptionsReset$)).subscribe((value: number) => {
			if (value && (this.booking_created_from == 'admin' || this.isAffiliateMode)) {
				if (this.Form.return_affiliate_type.value === 'in_progress_affiliate') {
					const pendingReturnAff = this.Return_AffiliateAccounts?.find((a: any) => a.id == value) || null;
					this.chooseReturnPendingAffiliate(pendingReturnAff);
				} else {
					this.chooseReturnAffiliate();
					this.fetchReturnAffiliateInformation(value);
				}
			}
		})

		this.BookingForm.get('return_loose_affiliate_id').valueChanges.pipe(takeUntil(this.formSubscriptionsReset$)).subscribe((value: number) => {
			if (value && this.booking_created_from == 'admin') {
				this.chooseReturnLooseAffiliate()
				// this.fetchReturnAffiliateInformation(value)
			}
		})


		// this.BookingForm.get('vehicle_id').valueChanges.pipe(takeUntil(this.formSubscriptionsReset$)).subscribe((value: any) =>
		// {
		// 	if (value && this.VehicleList)
		// 	{
		// 		let v = this.VehicleList.find(item => item.ID == value)
		// 		this.autofillData('vehicle', v);
		// 	}
		// })

		this.BookingForm.get('vehicle_type').valueChanges.pipe(distinctUntilChanged(), takeUntil(this.formSubscriptionsReset$)).subscribe((value: string) => {
			if (this.Form.affiliate_type.value == 'affiliate' || this.Form.affiliate_type.value == 'in_progress_affiliate') {
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
					let name = (this.BigData['vehicleCategories'] || []).find(item => item.id == value)?.['name'] || ''
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


		this.BookingForm.get('return_vehicle_type').valueChanges.pipe(distinctUntilChanged(), takeUntil(this.formSubscriptionsReset$)).subscribe((value: string) => {
			if (this.Form.return_affiliate_type.value == 'affiliate') {
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
					let name = (this.BigData['vehicleCategories'] || []).find(item => item.id == value)?.['name'] || ''
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

		this.BookingForm.get('vehicle_make').valueChanges.pipe(takeUntil(this.formSubscriptionsReset$)).subscribe((value: string) => {
			if (value) {
				if (this.BigData_COPY?.vehicleModels && this.BigData) {
					this.BigData['vehicleModels'] = this.BigData_COPY.vehicleModels.filter((item: any) => item.make_id == value || item.makeId == value);
				}
				let name = '';
				if (this.Form.affiliate_type.value == 'affiliate' || (this.Form.affiliate_type.value == 'in_progress_affiliate' && this.selectedPendingAffiliate?.has_vehicle)) {
					const match = (this.vehicleMake_arr || []).find((item: any) => item.make_id == value || item.id == value);
					if (match) {
						name = match.make || match.name || '';
					}
				}
				if (!name && this.BigData) {
					const match = (this.BigData['vehicleMakes'] || []).find((item: any) => item.id == value);
					if (match) {
						name = match.name || match.make || '';
					}
				}
				this.SetFormValue('vehicle_make_name', name);
			} else {
				if (this.BigData_COPY?.vehicleModels && this.BigData) {
					this.BigData['vehicleModels'] = this.BigData_COPY.vehicleModels;
				}
				this.BookingForm.get('vehicle_make_name').setValue('');
				this.BookingForm.updateValueAndValidity();
			}
		})

		this.BookingForm.get('return_vehicle_make').valueChanges.pipe(takeUntil(this.formSubscriptionsReset$)).subscribe((value: string) => {
			if (value) {
				if (this.BigData_COPY?.vehicleModels && this.BigData) {
					this.BigData['vehicleModels'] = this.BigData_COPY.vehicleModels.filter((item: any) => item.make_id == value || item.makeId == value);
				}
				let name = '';
				if (this.Form.return_affiliate_type.value == 'affiliate' || (this.Form.return_affiliate_type.value == 'in_progress_affiliate' && this.selectedReturnPendingAffiliate?.has_vehicle)) {
					const match = (this.return_vehicleMake_arr || []).find((item: any) => item.make_id == value || item.id == value);
					if (match) {
						name = match.make || match.name || '';
					}
				}
				if (!name && this.BigData) {
					const match = (this.BigData['vehicleMakes'] || []).find((item: any) => item.id == value);
					if (match) {
						name = match.name || match.make || '';
					}
				}
				this.SetFormValue('return_vehicle_make_name', name);
			} else {
				if (this.BigData_COPY?.vehicleModels && this.BigData) {
					this.BigData['vehicleModels'] = this.BigData_COPY.vehicleModels;
				}
				this.BookingForm.get('return_vehicle_make_name').setValue('');
				this.BookingForm.updateValueAndValidity();
			}
		})

		this.BookingForm.get('vehicle_model').valueChanges.pipe(takeUntil(this.formSubscriptionsReset$)).subscribe((value: string) => {
			if (value) {
				let name = '';
				if (this.Form.affiliate_type.value == 'affiliate' || this.Form.affiliate_type.value == 'in_progress_affiliate') {
					const match = (this.vehicleModal_arr || []).find((item: any) => item.model_id == value || item.id == value);
					if (match) {
						name = match.model || match.name || '';
					}
				}
				if (!name && this.BigData) {
					const match = (this.BigData['vehicleModels'] || []).find((item: any) => item.id == value);
					if (match) {
						name = match.name || match.model || '';
					}
				}
				this.SetFormValue('vehicle_model_name', name);
			} else {
				this.BookingForm.get('vehicle_model_name').setValue('');
				this.BookingForm.updateValueAndValidity();
			}
		})

		this.BookingForm.get('return_vehicle_model').valueChanges.pipe(takeUntil(this.formSubscriptionsReset$)).subscribe((value: string) => {
			if (value) {
				let name = '';
				if (this.Form.return_affiliate_type.value == 'affiliate' || this.Form.return_affiliate_type.value == 'in_progress_affiliate') {
					const match = (this.return_vehicleModal_arr || []).find((item: any) => item.model_id == value || item.id == value);
					if (match) {
						name = match.model || match.name || '';
					}
				}
				if (!name && this.BigData) {
					const match = (this.BigData['vehicleModels'] || []).find((item: any) => item.id == value);
					if (match) {
						name = match.name || match.model || '';
					}
				}
				this.SetFormValue('return_vehicle_model_name', name);
			} else {
				this.BookingForm.get('return_vehicle_model_name').setValue('');
				this.BookingForm.updateValueAndValidity();
			}
		})

		this.BookingForm.get('vehicle_year').valueChanges.pipe(takeUntil(this.formSubscriptionsReset$)).subscribe((value: string) => {
			if (value) {
				let name = '';
				if (this.Form.affiliate_type.value == 'affiliate' || this.Form.affiliate_type.value == 'in_progress_affiliate') {
					const match = (this.vehicleYear_arr || []).find((item: any) => item.year_id == value || item.id == value);
					if (match) {
						name = match.year || match.name || '';
					}
				}
				if (!name && this.BigData) {
					const match = (this.BigData['vehicleYears'] || []).find((item: any) => item.id == value);
					if (match) {
						name = match.name || match.year || '';
					}
				}
				if (!name && !isNaN(Number(value)) && Number(value) > 1900 && Number(value) < 2100) {
					name = String(value);
				}
				this.SetFormValue('vehicle_year_name', name);
			} else {
				this.BookingForm.get('vehicle_year_name').setValue('');
				this.BookingForm.updateValueAndValidity();
			}
		})

		this.BookingForm.get('return_vehicle_year').valueChanges.pipe(takeUntil(this.formSubscriptionsReset$)).subscribe((value: string) => {
			if (value) {
				let name = '';
				if (this.Form.return_affiliate_type.value == 'affiliate' || this.Form.return_affiliate_type.value == 'in_progress_affiliate') {
					const match = (this.return_vehicleYear_arr || []).find((item: any) => item.year_id == value || item.id == value);
					if (match) {
						name = match.year || match.name || '';
					}
				}
				if (!name && this.BigData) {
					const match = (this.BigData['vehicleYears'] || []).find((item: any) => item.id == value);
					if (match) {
						name = match.name || match.year || '';
					}
				}
				if (!name && !isNaN(Number(value)) && Number(value) > 1900 && Number(value) < 2100) {
					name = String(value);
				}
				this.SetFormValue('return_vehicle_year_name', name);
			} else {
				this.BookingForm.get('return_vehicle_year_name').setValue('');
				this.BookingForm.updateValueAndValidity();
			}
		})

		this.BookingForm.get('vehicle_color').valueChanges.pipe(takeUntil(this.formSubscriptionsReset$)).subscribe((value: string) => {
			if (value) {
				let name = '';
				if (this.Form.affiliate_type.value == 'affiliate' || this.Form.affiliate_type.value == 'in_progress_affiliate') {
					const match = (this.vehicleColor_arr || []).find((item: any) => item.color_id == value || item.id == value);
					if (match) {
						name = match.color || match.name || '';
					}
				}
				if (!name && this.BigData) {
					const match = (this.BigData['vehicleColors'] || []).find((item: any) => item.id == value);
					if (match) {
						name = match.name || match.color || '';
					}
				}
				this.SetFormValue('vehicle_color_name', name);
			} else {
				this.BookingForm.get('vehicle_color_name').setValue('');
				this.BookingForm.updateValueAndValidity();
			}
		})

		this.BookingForm.get('return_vehicle_color').valueChanges.pipe(takeUntil(this.formSubscriptionsReset$)).subscribe((value: string) => {
			if (value) {
				let name = '';
				if (this.Form.return_affiliate_type.value == 'affiliate' || this.Form.return_affiliate_type.value == 'in_progress_affiliate') {
					const match = (this.return_vehicleColor_arr || []).find((item: any) => item.color_id == value || item.id == value);
					if (match) {
						name = match.color || match.name || '';
					}
				}
				if (!name && this.BigData) {
					const match = (this.BigData['vehicleColors'] || []).find((item: any) => item.id == value);
					if (match) {
						name = match.name || match.color || '';
					}
				}
				this.SetFormValue('return_vehicle_color_name', name);
			} else {
				this.BookingForm.get('return_vehicle_color_name').setValue('');
				this.BookingForm.updateValueAndValidity();
			}
		})

		// Pickup Airport
		this.BookingForm.get('pickup_airport').valueChanges.pipe(takeUntil(this.formSubscriptionsReset$)).subscribe((value: number) => {
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
		this.BookingForm.get('pickup_airline').valueChanges.pipe(takeUntil(this.formSubscriptionsReset$)).subscribe((value: string) => {
			if (value) {
				let airline_selected = this.BigData?.airlinesData.find(item => item.id == value)
				this.SetFormValue('pickup_airline_name', airline_selected.formatted_name);
				this.SetFormValue('return_dropoff_airline_option', airline_selected);
				this.SetFormValue('return_dropoff_airline', value)
			}
		})

		// Dropoff Airport
		this.BookingForm.get('dropoff_airport').valueChanges.pipe(takeUntil(this.formSubscriptionsReset$)).subscribe((value: string) => {
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
		this.BookingForm.get('dropoff_airline').valueChanges.pipe(takeUntil(this.formSubscriptionsReset$)).subscribe((value: string) => {
			let airline_selected = this.BigData?.airlinesData.find(item => item.id == value)
			this.SetFormValue('dropoff_airline_name', airline_selected.formatted_name);
			this.SetFormValue('return_pickup_airline_option', airline_selected);
			this.SetFormValue('return_pickup_airline', value);
		})

		// Return Pickup Airport
		this.BookingForm.get('return_pickup_airport').valueChanges.pipe(takeUntil(this.formSubscriptionsReset$)).subscribe((value: string) => {
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
		this.BookingForm.get('return_pickup_airline').valueChanges.pipe(takeUntil(this.formSubscriptionsReset$)).subscribe((value: string) => {
			if (value) {
				let airline_selected = this.BigData?.airlinesData.find(item => item.id == value)
				this.SetFormValue('return_pickup_airline_name', airline_selected.formatted_name);
			}
		})

		// Return Dropoff Airport
		this.BookingForm.get('return_dropoff_airport').valueChanges.pipe(takeUntil(this.formSubscriptionsReset$)).subscribe((value: string) => {
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
		this.BookingForm.get('return_dropoff_airline').valueChanges.pipe(takeUntil(this.formSubscriptionsReset$)).subscribe((value: string) => {
			if (value) {
				let airline_selected = this.BigData?.airlinesData.find(item => item.id == value)
				this.SetFormValue('return_dropoff_airline_name', airline_selected.formatted_name);
			}
		})

		// Pickup Address
		this.BookingForm.get('pickup').valueChanges.pipe(takeUntil(this.formSubscriptionsReset$)).subscribe((value: string) => {
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
		this.BookingForm.get('dropoff').valueChanges.pipe(takeUntil(this.formSubscriptionsReset$)).subscribe((value: string) => {
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
		// this.BookingForm.get('driver_id').valueChanges.pipe(takeUntil(this.formSubscriptionsReset$)).subscribe((value: string) => {
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

		if (this.isTravelAgentMode) {
			this.BookingForm.get('sub_account_type').valueChanges.pipe(takeUntil(this.formSubscriptionsReset$)).subscribe((value: string) => {
				if (this.isPrefillingForm) {
					if (value === 'sub_travel_agent') {
						this.TravelAgentService.getAllTravelClientAccountList('sub_travel').then((result: any) => {
							this.subAgentAccounts = result?.data
							this.subAgentAccounts_Original = result?.data ? [...result.data] : []
							this.syncPrefilledSubAgentSelection();
						})
					}
					return;
				}
				if (value === 'sub_travel_agent') {
					this.BookingForm.get('sub_account_id').setValidators([Validators.required]);
					this.BookingForm.get('sub_account_id').updateValueAndValidity();
					this.TravelAgentService.getAllTravelClientAccountList('sub_travel').then((result: any) => {
						console.log("accounts->>>>>>>>>>", result)
						this.subAgentAccounts = result?.data
						this.subAgentAccounts_Original = result?.data ? [...result.data] : []
						if (this.BookingForm?.get('sub_account_id').value === '') {
							this.BookingForm.patchValue({
								travel_client_id: ''
							})
						}
					})
					.catch(err => {
						this.$spinner.hide();
					});
				} else {
					this.BookingForm.get('sub_account_id').clearValidators()
					this.BookingForm.get('sub_account_id').updateValueAndValidity();
					this.BookingForm.patchValue({
						sub_account_id: ''
					})
					this.getTravelClientAccounts()
				}
			})

			this.BookingForm.get('sub_account_id').valueChanges.pipe(takeUntil(this.formSubscriptionsReset$)).subscribe((value: string) => {
				if (this.isPrefillingForm) {
					if (value) {
						this.TravelAgentService.getAllTravelClientAccountList('individual', value).then((result: any) => {
							this.travelStaffAccounts = result?.data
							this.travelStaffAccounts_Original = result?.data ? [...result.data] : []
							this.syncPrefilledTravelClientSelection();
						})
					}
					return;
				}
				console.log('valueeeee->', value, this.newBooking)
				if (!this.newBooking) {
					if (value !== this.bookingResponse?.sub_account_id) {
						this.BookingForm.patchValue({
							travel_client_id: ''
						})
					}
				}
				this.TravelAgentService.getAllTravelClientAccountList('individual', value).then((result: any) => {
					console.log("accounts->>>>>>>>>>", result)
					this.travelStaffAccounts = result?.data
					this.travelStaffAccounts_Original = result?.data ? [...result.data] : []
					this.syncPrefilledTravelClientSelection();
				})
				.catch(err => {
					this.$spinner.hide();
				});
			})
		}

		// Trigger initial valueChanges to set validators on pickup/dropoff
		this.BookingForm.get('transfer_type')?.setValue(this.BookingForm.get('transfer_type')?.value, { emitEvent: true });
		if (this.BookingForm?.get('service_type')?.value === 'round_trip') {
			this.BookingForm.get('return_transfer_type')?.setValue(this.BookingForm.get('return_transfer_type')?.value, { emitEvent: true });
		}
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
		this.selectedPendingAffiliate = null;

		const fieldsToReset = [
			'affiliate_id',
			'loose_affiliate_id',
			'is_old_loose_affiliate',
			'lose_affiliate_name',
			'lose_affiliate_phone',
			'lose_affiliate_email',
			'vehicle_type',
			'vehicle_type_name',
			'vehicle_id',
			'vehicle_make',
			'vehicle_make_name',
			'vehicle_model',
			'vehicle_model_name',
			'vehicle_year',
			'vehicle_year_name',
			'vehicle_color',
			'vehicle_color_name',
			'vehicle_license_plate',
			'vehicle_seats',
			'driver_id',
			'driver_name',
			'driver_gender',
			'driver_cell',
			'driver_email'
		];

		fieldsToReset.forEach((item: string) => {
			if (this.BookingForm.get(item)) {
				this.BookingForm.get(item).reset();
			}
		});

		this.SetFormValue('lose_affiliate_phone_isd', '+1');
		this.SetFormValue('lose_affiliate_phone_country', 'us');
		this.SetFormValue('driver_cell_isd', '+1');
		this.SetFormValue('driver_cell_country', 'us');

		this.VehicleList = [];
		this.DriverList = [];

		this.BookingForm.updateValueAndValidity();
	}

	resetReturnDriverAndVehicle(return_affiliate_type: string) {
		this.selectedReturnPendingAffiliate = null;
		const fieldsToReset = [
			'return_affiliate_id',
			'return_loose_affiliate_id',
			'return_is_old_loose_affiliate',
			'return_lose_affiliate_name',
			'return_lose_affiliate_phone',
			'return_lose_affiliate_email',
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
			'return_driver_id',
			'return_driver_name',
			'return_driver_gender',
			'return_driver_cell',
			'return_driver_email'
		];

		fieldsToReset.forEach((item: string) => {
			if (this.BookingForm.get(item)) {
				this.BookingForm.get(item).reset();
			}
		});

		this.SetFormValue('return_lose_affiliate_phone_isd', '+1');
		this.SetFormValue('return_lose_affiliate_phone_country', 'us');
		this.SetFormValue('return_driver_cell_isd', '+1');
		this.SetFormValue('return_driver_cell_country', 'us');

		this.return_VehicleList = [];
		this.return_DriverList = [];

		this.BookingForm.updateValueAndValidity();

		if (return_affiliate_type === 'in_progress_affiliate' && this.Form.affiliate_type.value === 'in_progress_affiliate') {
			const firstAffId = this.BookingForm.get('affiliate_id')?.value;
			if (firstAffId) {
				this.BookingForm.patchValue({
					return_affiliate_id: firstAffId
				});
				if (this.selectedPendingAffiliate) {
					this.chooseReturnPendingAffiliate(this.selectedPendingAffiliate);
				}
			}
		} else if (return_affiliate_type === 'affiliate' && this.Form.affiliate_type.value === 'affiliate') {
			const firstAffId = this.BookingForm.get('affiliate_id')?.value;
			if (firstAffId) {
				this.BookingForm.patchValue({
					return_affiliate_id: firstAffId
				});
			}
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
			if (!value) {
				return null
			}
			value = value.split('@')[1]
			let domain = value?.substring(value.indexOf('.') + 1)
			const domains = ['com', 'net', 'in', 'co', 'uk', 'br', 'us']
			if (domains.includes(domain)) {
				return null
			}
			else if (domain?.includes('.')) {
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
		// pickup_address / dropoff_address hold the street on a city leg. Only an
		// airport id means that saved line is an airport display worth keeping.
		const hasAirportId = airportId !== null && airportId !== undefined && String(airportId).trim() !== '' && String(airportId) !== '0';
		if (!hasAirportId) {
			return '';
		}

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

		airportCoordinateFields.forEach((field) => {
		});

		return value;
	}

	change(event: any, form_control: string) {
		//setting currency based on airport country
		// form_control == 'pickup_airport' || form_control == 'return_pickup_airport' ||
		if (form_control == 'dropoff_airport' || form_control == 'return_dropoff_airport') {
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
		return moment(time, ["HH:mm:ss", "hh:mm A", "HH:mm"]).format("LT");
	}

	/**
	 * Repeat/return/round-trip actions carry the original reservation's date & time
	 * forward. When that source booking is already in the past, default the pickup
	 * (and the return leg for round trips) to today's date and the current time so
	 * the user starts from a valid, present-day slot instead of a stale one.
	 */
	private resetPastPickupDateTimeToNow() {
		const now = moment();
		const parseFormats = ['YYYY-MM-DD hh:mm A', 'YYYY-MM-DD HH:mm', 'YYYY-MM-DD HH:mm:ss'];

		// Outbound leg
		const pickupDate = this.Form.pickup_date.value;
		const pickupTime = this.Form.pickup_time.value;
		const pickupDateTime = moment(`${pickupDate} ${pickupTime}`, parseFormats);
		if (pickupDateTime.isValid() && pickupDateTime.isBefore(now)) {
			this.SetFormValue('pickup_date', now.format('YYYY-MM-DD'));
			this.SetFormValue('pickup_time', now.format('LT'));
		}

		// Return leg (round trip only)
		if (this.Form.service_type.value == 'round_trip') {
			const returnDate = this.Form.return_pickup_date.value;
			const returnTime = this.Form.return_pickup_time.value;
			const returnDateTime = moment(`${returnDate} ${returnTime}`, parseFormats);
			if (returnDateTime.isValid() && returnDateTime.isBefore(now)) {
				this.SetFormValue('return_pickup_date', now.format('YYYY-MM-DD'));
				this.SetFormValue('return_pickup_time', now.format('LT'));
			}
		}
	}

	setValueByBookNow() {
		if (this.updateType == 'reaffiliate') {
			this.fetchBookingDataForEdit(this.Form.reservation_id.value, this.updateType).subscribe((response: any) => {
				response.data.booking_instructions = response.data.booking_instructions.replaceAll('<br />', '')
				let editing_data = response.data
				delete editing_data.affiliate_id
				this.number_of_hours = response?.data?.number_of_hours === 0 ? 2 : response?.data?.number_of_hours
				this.isTravelShare = this.isTravelAgentMode || response?.data?.account_type == 'travel_planner' ? true : false
				if (response?.data?.account_type == 'travel_planner') {
					this.getTravelClientAccounts(response?.data?.acc_id)
				}
				this.autofillData('cruise', editing_data);
				for (let item in editing_data) {
					if (item.includes('extra_stops') || item.includes('languages') || item.includes('dresses') || item.toLowerCase().includes('amenities')) {
						// console.log('Skipping in the case of Extra Stops. ')
					}
					if (item == "passenger_cell_isd") {
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
				if (this.updateType == 'edit') {
					// this.SetFormValue('pickup_date', moment().format('YYYY-MM-DD'))
					this.SetFormValue('pickup_date', editing_data?.pickup_date)
				}
				if (this.updateType == 'repeat' || this.updateType == 'return' || this.updateType == 'round') {
					this.SetFormValue('pickup_date', editing_data?.pickup_date)
					this.resetPastPickupDateTimeToNow()
				}
			})
		}
		let QB: any = JSON.parse(localStorage.getItem('quotebot_form'))
		let selected_vehicle: any = JSON.parse(sessionStorage.getItem('selected_vehicle'))
		
		this.populateDriverAndVehicleDetails(selected_vehicle);

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
				affiliate_type: this.isAffiliateMode ? 'affiliate' : 'loose_affiliate',
				affiliate_id: '',
				loose_affiliate_id: '',
				return_affiliate_type: this.isAffiliateMode ? 'affiliate' : 'loose_affiliate',
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
		let return_transfer_type_value = QB?.dropoff_type + '_to_' + QB?.pickup_type
		this.isPrefillingTransferTypes = true;
		this.transfer_type = transfer_type_value
		this.return_transfer_type = return_transfer_type_value
		this.SetFormValue('transfer_type', transfer_type_value, false)
		this.SetFormValue('return_transfer_type', return_transfer_type_value, false)
		this.changeTransferType(transfer_type_value)
		this.changeReturnTransferType(return_transfer_type_value)
		this.updateOutboundLegValidators(transfer_type_value);
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
		setTimeout(() => {
			this.isPrefillingTransferTypes = false;
			this.logTransferTypeState('post-prefill-render');
		}, 0)
		this.SetFormValue('total_passengers', QB?.no_of_passenger)
		this.SetFormValue('luggage_count', QB?.no_of_luggage)
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
			name: QB?.other_details?.return_pickup_airport_name,
			formatted_address: QB?.other_details?.return_pickup_airport_name
		}, QB?.return_pickup_airport_lat, QB?.return_pickup_airport_long);
		const matchedReturnDropoffAirport = this.resolveInternalAirportRecord({
			name: QB?.other_details?.return_dropoff_airport_name,
			formatted_address: QB?.other_details?.return_dropoff_airport_name
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
		this.SetFormValue('return_pickup', QB?.return_dropoff_address)
		this.SetFormValue('return_pickup_latitude', QB?.return_dropoff_address_lat)
		this.SetFormValue('return_pickup_longitude', QB?.return_dropoff_address_long)
		this.SetFormValue('return_pickup_airport_option', QB?.other_details?.return_pickup_airport_name)
		this.SetFormValue('return_pickup_airport_name', QB?.other_details?.return_pickup_airport_name)
		this.SetFormValue('return_pickup_airport_latitude', QB?.return_pickup_airport_lat)
		this.SetFormValue('return_pickup_airport_longitude', QB?.return_pickup_airport_long)
		this.SetFormValue('return_pickup_airport', matchedReturnPickupAirport?.id ?? QB?.return_pickup_airport)

		//return dropOff
		this.SetFormValue('return_dropoff', QB?.return_dropoff_address)
		this.SetFormValue('return_dropoff_latitude', QB?.return_dropoff_address_lat)
		this.SetFormValue('return_dropoff_longitude', QB?.return_dropoff_address_long)
		this.SetFormValue('return_dropoff_airport_option', QB?.other_details?.return_dropoff_airport_name)
		this.SetFormValue('return_dropoff_airport_name', QB?.other_details?.return_dropoff_airport_name)
		this.SetFormValue('return_dropoff_airport_latitude', QB?.return_dropoff_airport_lat)
		this.SetFormValue('return_dropoff_airport_longitude', QB?.return_dropoff_airport_long)
		this.SetFormValue('return_dropoff_airport', matchedReturnDropoffAirport?.id ?? QB?.return_dropoff_airport)
		this.queuePrefillTerminalChecks();
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
			if (!isMasterVehicleQuoteFlow) {
				this.fetchQBAffiliateVehicles(selected_vehicle?.affiliate_id)
				this.fetchAffiliateDrivers(this.affiliate_id)
			}
		}, 5000)
			this.runEmbeddedQuote();
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
		return item.name.toLowerCase().includes(term.toLowerCase()) || item.driver_phone.toString().includes(term)
	}

	onSearchCancellation(term, item) {
		return item.label.toLowerCase().startsWith(term.toLowerCase())
	}

	onSearchLooseAffId(term, item) {
		return item.name.toLowerCase().startsWith(term.toLowerCase()) || item.driver_phone.startsWith(term)
	}


	private addCustomCountrySearch(element: HTMLElement) {
		// initphonefield() can run repeatedly; only wire the dropdown-search listener once per input
		if ((element as any).dataset?.countrySearchBound === 'true') return;
		(element as any).dataset.countrySearchBound = 'true';
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
