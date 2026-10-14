import { Component, ElementRef, OnDestroy, OnInit, QueryList, ViewChild, ViewChildren, isDevMode } from '@angular/core';
import { AbstractControl, FormArray, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import * as moment from 'moment';
import { AdminService } from '../../../services/admin.service';
import { SharedModule } from '../../shared/shared.module';
import { NgxSpinnerService } from 'ngx-spinner';
import { ErrorDialogService } from '../../../services/error-dialog/errordialog.service';
import { ActivatedRoute, Router } from '@angular/router';
import { CustomvalidationService } from '../../../services/customvalidation.service';
import { pluck } from 'rxjs/operators';
import { TravelAgentService } from '../../../services/travel-agent.service';
import { StateManagementService } from '../../../services/statemanagement.service';
import { CommonService } from '../../../services/common.service';
import { HttpClient } from '@angular/common/http';
import { GoogleMap } from '@angular/google-maps';
import * as intlTelInput from 'intl-tel-input';
import { attachPlaceAutocompleteElement, clearPlaceAutocompleteDisplay, getBookingAddressSyncControl, syncPlaceAutocompleteDisplay } from '../../../utils/google-place-autocomplete';

declare var $: any


@Component({
	selector: 'app-create-booking',
	templateUrl: './create-booking.component.html',
	styleUrls: ['./create-booking.component.scss'],
})
export class CreateBookingComponent implements OnInit, OnDestroy {
	// @ViewChildren('autoInput') autoInputs!: QueryList<ElementRef>;
	@ViewChild('pickupInput') pickupInput!: ElementRef;
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
	@ViewChild('passengercellInput') passengercellInput!: ElementRef;

	todays_date: string = moment().format('YYYY-MM-DD');
	months: any = [{ value: '01' }, { value: '02' }, { value: '03' }, { value: '04' }, { value: '05' }, { value: '06' }, { value: '07' }, { value: '08' }, { value: '09' }, { value: '10' }, { value: '11' }, { value: '12' }]
	monthOptions: any = [...this.months]
	updateType: any = 'create';
	minDate = new Date();

	booking_params: any = {
		transfer_types: ["airport_to_city", "airport_to_airport", "airport_to_cruise", "city_to_city", "city_to_airport", "city_to_cruise", "cruise_to_airport", "cruise_to_city"],
		client_account_types: ['individual', 'travel_planner', 'loose_customer'],
		affiliate_accounts: ['affiliate'],
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
	BigData: any
	BigData_COPY: any
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
	BookingForm: FormGroup
	service_type: any = 'one_way';
	transfer_type: any = 'city_to_city'
	return_transfer_type: any = 'city_to_city'
	PaxTelObject: any
	number_of_hours: any = 2;
	distance: number = 0
	return_distance: number = 0


	LCTelObject: any
	DrvTelObject: any
	LATelObject: any

	RatesForm: any
	ReturnRatesForm: any

	booking_id: number = 0

	driver_image: Record<string, any> = {}
	vehicle_image: Record<string, any> = {}

	AffiliateInformation: Record<string, any> = {}
	ClientAccounts: Array<Record<string, any>> = []
	AffiliateAccounts: Array<Record<string, any>> = []
	VehicleList: Array<Record<string, any>> = []
	DriverList: Array<Record<string, any>> = []
	vehicleType_arr: any;
	vehicleMake_arr: any;
	vehicleModal_arr: any;
	vehicleYear_arr: any;
	vehicleColor_arr: any;
	firstLoadVehicleId: any;
	proceed: boolean = true
	chosen_user: Record<string, any>

	distance_for_rates: string = ''
	amenities: Array<string> = []

	quillModules = {
		toolbar: [
			['bold', 'italic', 'underline'],
			[{ list: 'ordered' }, { list: 'bullet' }],
			['clean']
		]
	};

	init_rates: boolean = false
	init_return_rates: boolean = false
	is_loose_customer_unique: boolean = false
	is_booking_edit_case: boolean = false
	reset_button: boolean = false
	submitBookingForm: boolean;
	affiliate_id: any;
	newBooking: boolean = false;
	QB_vehicle_id: any = null;
	unique_key: any;
	firstLoadAffiliateId: void;
	confirmMsg: any;
	bookingResponse: any;
	booking_data: any;
	is_master_vehicle: boolean = JSON.parse(sessionStorage.getItem('selected_vehicle'))?.is_master_vehicle || false
	master_vehicle_id: any;
	bookingType: any;
	subtotal: any = 0
	agentShare: any = 0;
	grandtotal: any = 0
	vehicles: number = 1;
	driverImgUrl: any = '../../../../assets/images/driverImg.jpg';
	vehicleImgUrl: any = '';
	driver_info: any = {};
	r_subtotal: any = 0;
	r_agentShare: any = 0;
	r_grandtotal: any = 0;
	min_rate_involved: any;
	returnRateArray: any;
	rateArray: any;
	travelStaffAccounts: any;
	travelStaffAccounts_Original: any;
	subAgentAccounts: any;
	subAgentAccounts_Original: any;
	isCreatedByAdmin: boolean = false;
	shareArray: any;
	r_shareArray: any;
	adminSharePercent: number = 25;
	currentUser: any;
	currencySymbol: any;
	currencyObj: any;
	blockaddressfield: boolean = false;
	previousBookingData: any = null;
	numberOfHoursError: boolean = false;
	private isClearingSelection = false;

	constructor(
		private $form: FormBuilder,
		private $api: AdminService,
		private TravelAgentService: TravelAgentService,
		private $shared: SharedModule,
		private $spinner: NgxSpinnerService,
		private $errors: ErrorDialogService,
		private $router: Router,
		private $routeurl: ActivatedRoute,
		private stateManagementService: StateManagementService,
		private customValidator: CustomvalidationService,
		private httpClient: HttpClient,
		private commonServices: CommonService,
	) { }

	ngOnInit(): void {

		this.currentUser = JSON.parse(localStorage.getItem('currentUser'))

		this.buildBookingForm()
		// this.$spinner.show();
		this.$routeurl.queryParams.subscribe((params: any) => {
			console.log('params-->>>', params)
			if (params && params.bookingId && !this.booking_id) {
				this.is_booking_edit_case = true
				this.updateType = params.updateType
				console.log("update type", this.updateType)
				this.SetFormValue('reservation_id', params.bookingId)
				params.updateType ? this.SetFormValue('updateType', params.updateType) : this.SetFormValue('updateType', 'edit')
				if (params.updateType == 'round') {
					this.service_type = 'round_trip'
				}
			}
			if (params && params.new == 'true') {
				this.newBooking = params.new == 'true'
				this.affiliate_id = parseInt(params.affiliate_id)
			}
			if (params && params.is_master_vehicle == 'true') {
				this.master_vehicle_id = params.vehicle_id
				this.is_master_vehicle = true
				console.log('is master vehicle', this.is_master_vehicle)
			}
			if (params && params.updateType) {
				this.bookingType = params.updateType
			}

			//save currency symbol
			// this.currencySymbol = this.stateManagementService.getCurrencySymbol();
			this.currencyObj = JSON.parse(sessionStorage.getItem('currencyData'))
			this.currencySymbol = this.currencyObj?.symbol
			// else {
			// 	this.resetFields()
			// }
			// place in query params to reinitialise things when modes of new and edit are toggled
			// Subscriptions
			this.Subscriptions()
			// this.fetchClientAccounts('individual')
			// this.fetchAffiliates('affiliate')
			this.getTravelClientAccounts()
			this.select(true, 'driver_languages', 1)
		})
		this.fetchAirportsAndBigData()
	}

	ngOnDestroy(): void {
		Object.values(this.customAirportSearchDebounceTimers).forEach((timer) => clearTimeout(timer));
		this.customAirportSearchDebounceTimers = {};
		this.customAirportAutocompleteSessionTokens = {};
	}

	ngAfterViewInit() {

		this.initphonefield()
		this.initAllAutocompletes()

		// Re-initialize when dynamic views update
		this.extraStopInputs.changes.subscribe(() => {
			setTimeout(() => this.initAllAutocompletes(), 100);
		});

		this.returnExtraStopInputs.changes.subscribe(() => {
			setTimeout(() => this.initAllAutocompletes(), 100);
		});

	}

	initphonefield() {
		console.log("in init phone", this.cellInput, this.passengercellInput);

		const getInitCountry = (group: string, controlName: string) => {
			let val;
			if (group) {
				val = (<FormGroup>this.BookingForm.get(group)).get(controlName)?.value;
			} else {
				val = this.BookingForm.get(controlName)?.value;
			}
			if (val) return val;
			return this.currentUser?.phoneCountry || this.currentUser?.country || 'auto';
		};

		if (this.passengercellInput) {
			const existing = (window as any).intlTelInputGlobals?.getInstance(this.passengercellInput.nativeElement);
			if (existing) existing.destroy();
			const paxCountry = getInitCountry(null, 'passenger_cell_country');
			this.PaxTelObject = intlTelInput(this.passengercellInput.nativeElement, this.commonServices.getTelInputOptions(paxCountry));

			// Immediate sync for Passenger Cell
			const countryData = this.PaxTelObject.getSelectedCountryData();
			if (countryData?.dialCode) {
				this.SetFormValue('passenger_cell_isd', '+' + countryData.dialCode);
				this.SetFormValue('passenger_cell_country', countryData.iso2);
			}

			this.addCustomCountrySearch(this.passengercellInput.nativeElement);
			this.passengercellInput.nativeElement.addEventListener('countrychange', () => {
				const countryData = this.PaxTelObject.getSelectedCountryData();
				console.log("in country chnage", countryData)
				this.SetFormValue('passenger_cell_isd', '+' + countryData.dialCode); this.SetFormValue('passenger_cell_country', countryData.iso2)
				this.validatePassengerCell();
			});
		}

		if (this.cellInput) {
			const existing = (window as any).intlTelInputGlobals?.getInstance(this.cellInput.nativeElement);
			if (existing) existing.destroy();
			const lcCountry = getInitCountry('loose_customer', 'phone_country');
			this.LCTelObject = intlTelInput(this.cellInput.nativeElement, this.commonServices.getTelInputOptions(lcCountry));

			// Immediate sync for Personal Info (Loose Customer)
			const countryData = this.LCTelObject.getSelectedCountryData();
			if (countryData?.dialCode) {
				const lcGroup = this.BookingForm.get('loose_customer') as FormGroup;
				lcGroup.patchValue({
					phone_isd: '+' + countryData.dialCode,
					phone_country: countryData.iso2
				});
			}

			this.addCustomCountrySearch(this.cellInput.nativeElement);
			this.cellInput.nativeElement.addEventListener('countrychange', () => {
				const countryData = this.LCTelObject.getSelectedCountryData();
				console.log("in country chnage", countryData)
				this.onLCTeleCountryChange(countryData)
			});
		}

	}

	onInstructionsEditorCreated(editor: any): void {
		// Optional: focus or configure editor instance
		editor.focus();
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
		);
	}

	initAllAutocompletes() {
		this.BookingForm?.updateValueAndValidity({ emitEvent: false });
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
		const extraStopGroup = this.getExtraStopGroup(fieldName);
		if (extraStopGroup) {
			return String(extraStopGroup.get('address')?.value || '').trim();
		}

		return String(this.BookingForm.get(fieldName)?.value || '').trim();
	}

	private setCustomAddressFieldValue(fieldName: string, value: string): void {
		const extraStopGroup = this.getExtraStopGroup(fieldName);
		if (extraStopGroup) {
			extraStopGroup.patchValue({
				address: value,
				latitude: '',
				longitude: ''
			}, { emitEvent: false });
			return;
		}

		const control = this.BookingForm.get(fieldName);
		if (control) {
			control.setValue(value, { emitEvent: false });
			control.updateValueAndValidity({ emitEvent: false });
		}

		if (fieldName !== 'loose_customer.address') {
			this.BookingForm.get(`${fieldName}_latitude`)?.setValue('', { emitEvent: false });
			this.BookingForm.get(`${fieldName}_longitude`)?.setValue('', { emitEvent: false });
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
		if (typeof value?.plainText === 'string') {
			return value.plainText.trim();
		}
		if (typeof value?.stringValue === 'string') {
			return value.stringValue.trim();
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
		this.setCustomAddressFieldValue(fieldName, value || '');
		this.BookingForm.updateValueAndValidity({ emitEvent: false });
		this.openCustomAddressDropdown(fieldName);
		void this.searchCustomAddress(fieldName, value || '');
	}

	onCustomAirportInput(fieldName: string, value: string): void {
		this.clearCustomAirportDropdownBlurTimer();
		this.BookingForm.get(`${fieldName}_option`)?.setValue(value, { emitEvent: false });
		this.BookingForm.get(fieldName)?.setValue('', { emitEvent: false });
		this.BookingForm.get(`${fieldName}_name`)?.setValue('', { emitEvent: false });
		this.BookingForm.get(`${fieldName}_latitude`)?.setValue('', { emitEvent: false });
		this.BookingForm.get(`${fieldName}_longitude`)?.setValue('', { emitEvent: false });
		this.BookingForm.updateValueAndValidity({ emitEvent: false });
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
			if (fieldName === 'loose_customer.address') {
				this.fillLooseCustomerAddress(place);
			} else {
				const formattedAddress = place.formatted_address ?? '';
				const placeName = place.name ?? '';
				const displayAddress = placeName ? `${placeName} - ${formattedAddress}` : formattedAddress;
				const addressPayload = {
					...place,
					formatted_address: formattedAddress,
					display_address: displayAddress
				};
				const extraStopField = this.parseExtraStopFieldKey(fieldName);
				if (extraStopField) {
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

	buildBookingForm() {
		this.BookingForm = this.$form.group({
			service_type: ['one_way', Validators.required],
			transfer_type: ['city_to_city', Validators.required],
			return_transfer_type: ['city_to_city', Validators.required],
			number_of_hours: [2],
			acc_id: [''],
			account_type: ['travel_planner'],
			travel_client_id: ['', [Validators.required]],
			sub_account_id: [''],
			travel_client_acc: ['travel_individual'],
			sub_account_type: ['travel_agent'],
			change_individual_data: [false],
			loose_customer: this.$form.group({
				first_name: [''],
				middle_name: [''],
				last_name: [''],
				phone: [''],
				phone_isd: [this.currentUser?.isd || '+1'],
				phone_country: [this.currentUser?.phoneCountry || 'us'],
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
			passenger_cell_isd: [this.currentUser?.isd || '+1'],
			passenger_cell_country: [this.currentUser?.phoneCountry || 'us'],
			total_passengers: [1],
			luggage_count: [0],
			booking_instructions: [''],
			return_booking_instructions: [''],
			affiliate_type: ['affiliate'],
			affiliate_id: [''],
			lose_affiliate_name: ['', [this.customValidator.whitespace()]],
			lose_affiliate_phone: [''],
			lose_affiliate_phone_isd: ['+1'],
			lose_affiliate_phone_country: ['us'],
			lose_affiliate_email: [''],
			vehicle_type: [''],
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
			driver_name: ['', this.customValidator.whitespace()],
			driver_gender: [''],
			driver_cell: ['', [Validators.pattern("^[0-9+]*$"), Validators.minLength(4), Validators.maxLength(15)]],
			driver_cell_isd: [this.currentUser?.isd || '+1'],
			driver_cell_country: [this.currentUser?.phoneCountry || 'us'],
			driver_email: ['', Validators.pattern(/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i)],
			driver_phone_type: [''],
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
			departing_airport_city: [''],
			fbo_address: [''],
			return_fbo_address: [''],
			fbo_name: [''],
			return_fbo_name: ['']
		})
		let date = new Date();
		let timestamp = date.getTime();

		this.SetFormValue('pickup_date', moment(timestamp).format("YYYY-MM-DD"))
		this.SetFormValue('return_pickup_date', moment(timestamp).format("YYYY-MM-DD"))
		this.SetFormValue('number_of_vehicles', 1)
		this.updateNumberOfHoursValidators(this.BookingForm.get('service_type')?.value);
		this.SetFormValue('booking_instructions', "<ol><li>Driver - Text on location. Text the client a day before to confirm driver name , cell phone and booking details. Text client with ETA when en route</li> </ol>");
		this.SetFormValue('return_booking_instructions', "<ol><li>Driver - Text on location. Text the client a day before to confirm driver name , cell phone and booking details. Text client with ETA when en route</li> </ol>");

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
		console.log('booking form init completed--------------------_>>>>>>>>>><><><')
	}
	SetFormValue(form_control: string, value: any, emit: boolean = true) {
		if (!value || !form_control) {
			console.info(`No Value to set for ${form_control}. Returning ...`)
			return
		}
		console.log('Setting Form Value for ', form_control, ' : ', value);
		try {

			this.BookingForm.get(form_control).setValue(value, { emitEvent: emit })
			this.BookingForm.updateValueAndValidity()
		}
		catch (err) {
			console.error('NFC Error: ')
			return
		}
	}

	private setControlValue(form_control: string, value: any, emit: boolean = false) {
		const control = this.BookingForm?.get(form_control);
		if (!control) {
			return;
		}
		control.setValue(value, { emitEvent: emit });
		control.updateValueAndValidity({ emitEvent: emit });
	}

	private patchControls(values: Record<string, any>) {
		if (!this.BookingForm) {
			return;
		}
		Object.entries(values).forEach(([controlName, value]) => {
			const control = this.BookingForm.get(controlName);
			if (control) {
				control.setValue(value, { emitEvent: false });
				control.updateValueAndValidity({ emitEvent: false });
			}
		});
		this.BookingForm.updateValueAndValidity({ emitEvent: false });
	}

	private updateReturnLegValidators(value: string) {
		if (this.BookingForm?.get('service_type')?.value == 'round_trip') {
			if (!value.startsWith('airport_')) {
				this.BookingForm?.get('return_pickup')?.setValidators([Validators.required]);
			} else {
				this.BookingForm?.get('return_pickup')?.clearValidators();
			}
			this.BookingForm?.get('return_pickup')?.updateValueAndValidity();

			if (!value.endsWith('_airport')) {
				this.BookingForm?.get('return_dropoff')?.setValidators([Validators.required]);
			} else {
				this.BookingForm?.get('return_dropoff')?.clearValidators();
			}
			this.BookingForm?.get('return_dropoff')?.updateValueAndValidity();

			if (value.includes("city_")) {
				this.SetFormValue('return_booking_instructions', "<ol><li>Driver - Text on location. Text the client a day before to confirm driver name , cell phone and booking details. Text client with ETA when en route</li> </ol>");
			}

			if (value.includes('_cruise') || value.includes('cruise_')) {
				if (value.includes("cruise_")) {
					this.SetFormValue('return_booking_instructions', "<ol><li>Pax - Text driver when docked.</li> <li>Driver - Text the client a day before to confirm driver name , cell phone and booking details. Text client with ETA when en route. Text pax with pickup instructions when ship has arrived.</li> </ol>");
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
				this.SetFormValue('return_booking_instructions', "<ol><li>Pax - Text driver when landing.</li> <li>Driver - Text the client a day before to confirm driver name , cell phone and booking details. Text client with ETA when en route. Text pax with pickup instructions when plane has arrived.</li> </ol>");
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
			this.clearReturnOnlyValidators();
		}
	}

	private updateNumberOfHoursValidators(serviceType: string): void {
		const hoursControl = this.BookingForm?.get('number_of_hours');
		if (!hoursControl) {
			return;
		}

		if (serviceType == 'charter_tour' || serviceType == 'chartertour') {
			hoursControl.setValidators([Validators.min(2)]);
		} else {
			hoursControl.clearValidators();
			this.numberOfHoursError = false;
		}

		hoursControl.updateValueAndValidity({ emitEvent: false });
	}

	private clearReturnOnlyValidators(): void {
		[
			'return_pickup',
			'return_dropoff',
			'return_cruise_name',
			'return_cruise_port',
			'return_dropoff_airport_option',
			'return_dropoff_airline_option',
			'return_pickup_flight',
			'return_pickup_airline_option',
			'return_pickup_airport_option',
			'departing_airport_city'
		].forEach((controlName) => {
			this.BookingForm?.get(controlName)?.clearValidators();
			this.BookingForm?.get(controlName)?.updateValueAndValidity({ emitEvent: false });
		});
	}

	private logInvalidControls(control: AbstractControl, path: string = 'BookingForm'): void {
		if (control instanceof FormGroup) {
			Object.keys(control.controls).forEach((key) => {
				this.logInvalidControls(control.controls[key], `${path}.${key}`);
			});
			return;
		}

		if (control instanceof FormArray) {
			control.controls.forEach((childControl, index) => {
				this.logInvalidControls(childControl, `${path}[${index}]`);
			});
			return;
		}

		if (control.invalid) {
			console.log('[INVALID CONTROL]', path, {
				errors: control.errors,
				value: control.value
			});
		}
	}

	private clearAddressState(formControl: string) {
		const valuesToClear: Record<string, any> = {
			[formControl]: '',
			[`${formControl}_latitude`]: '',
			[`${formControl}_longitude`]: ''
		};
		this.patchControls(valuesToClear);
	}

	clearAddressField(formControl: string) {
		this.BookingForm.get(formControl)?.setValue('');
		if (formControl !== 'loose_customer.address') {
			this.BookingForm.get(`${formControl}_latitude`)?.setValue('');
			this.BookingForm.get(`${formControl}_longitude`)?.setValue('');
		}
		this.BookingForm.updateValueAndValidity();

		const inputMap: Record<string, ElementRef | undefined> = {
			pickup: this.pickupInput,
			dropoff: this.dropoffInput,
			return_pickup: this.return_pickupInput,
			return_dropoff: this.return_dropoffInput,
			fbo_address: this.fboAddressInput,
			return_fbo_address: this.returnFboAddressInput,
			'loose_customer.address': this.loosecustomerInput,
		};

		const nativeInput = inputMap[formControl]?.nativeElement as HTMLInputElement | undefined;
		if (nativeInput) {
			nativeInput.value = '';
			syncPlaceAutocompleteDisplay(nativeInput);
		}

		if (formControl !== 'loose_customer.address') {
			this.MapController();
			if (this.Form.service_type.value == 'round_trip') {
				this.MapController(true);
			}
			this.buildBookingData();
		}
	}

	clearAirportField(formControl: string) {
		this.resetCustomAirportSessionToken(formControl);
		this.clearCustomAirportSearchDebounceTimer(formControl);
		const clearFields = (controlName: string) => {
			this.BookingForm.get(controlName)?.setValue('', { emitEvent: false });
			this.BookingForm.get(`${controlName}_option`)?.setValue('', { emitEvent: false });
			this.BookingForm.get(`${controlName}_name`)?.setValue('', { emitEvent: false });
			this.BookingForm.get(`${controlName}_latitude`)?.setValue('', { emitEvent: false });
			this.BookingForm.get(`${controlName}_longitude`)?.setValue('', { emitEvent: false });
		};

		clearFields(formControl);
		if (formControl === 'pickup_airport') {
			clearFields('return_dropoff_airport');
		}
		if (formControl === 'dropoff_airport') {
			clearFields('return_pickup_airport');
		}
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

		this.MapController();
		if (this.Form.service_type.value == 'round_trip') {
			this.MapController(true);
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

	private addAirlineClearValues(valuesToClear: Record<string, any>, formControl: string) {
		const fieldPrefix = formControl.replace(/_airline$/, '');
		valuesToClear[`${fieldPrefix}_airline_option`] = null;
		valuesToClear[formControl] = '';
		valuesToClear[`${fieldPrefix}_airline_name`] = '';

		if (formControl === 'pickup_airline') {
			valuesToClear['return_dropoff_airline_option'] = null;
			valuesToClear['return_dropoff_airline'] = '';
			valuesToClear['return_dropoff_airline_name'] = '';
		}
		if (formControl === 'dropoff_airline') {
			valuesToClear['return_pickup_airline_option'] = null;
			valuesToClear['return_pickup_airline'] = '';
			valuesToClear['return_pickup_airline_name'] = '';
		}
	}

	private clearAirlineSelection(formControl: string) {
		if (this.isClearingSelection) {
			return;
		}
		this.isClearingSelection = true;
		try {
			const valuesToClear: Record<string, any> = {};
			this.addAirlineClearValues(valuesToClear, formControl);
			this.patchControls(valuesToClear);
		} finally {
			this.isClearingSelection = false;
		}
	}

	private clearAirportSelection(formControl: string) {
		if (this.isClearingSelection) {
			return;
		}
		this.isClearingSelection = true;
		try {
			const valuesToClear: Record<string, any> = {};
			const clearAirportFields = (controlName: string) => {
				const fieldPrefix = controlName.replace(/_airport$/, '');
				valuesToClear[`${fieldPrefix}_airport_option`] = '';
				valuesToClear[controlName] = '';
				valuesToClear[`${fieldPrefix}_airport_name`] = '';
				valuesToClear[`${fieldPrefix}_airport_latitude`] = '';
				valuesToClear[`${fieldPrefix}_airport_longitude`] = '';
				this.addAirlineClearValues(valuesToClear, `${fieldPrefix}_airline`);
			};

			clearAirportFields(formControl);

			if (formControl === 'pickup_airport') {
				clearAirportFields('return_dropoff_airport');
			}
			if (formControl === 'dropoff_airport') {
				clearAirportFields('return_pickup_airport');
			}

			this.patchControls(valuesToClear);
		} finally {
			this.isClearingSelection = false;
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

	syncAirportPayloadFields() {
		const airportFields = [
			'pickup_airport',
			'dropoff_airport',
			'return_pickup_airport',
			'return_dropoff_airport',
		];

		for (const field of airportFields) {
			const selectedAirportId = this.BookingForm.get(field)?.value;
			const optionControl = this.BookingForm.get(`${field}_option`);
			const nameControl = this.BookingForm.get(`${field}_name`);
			const latControl = this.BookingForm.get(`${field}_latitude`);
			const lngControl = this.BookingForm.get(`${field}_longitude`);
			const matchedAirport = this.resolveInternalAirportRecord({
				name: nameControl?.value || optionControl?.value,
				formatted_address: optionControl?.value || nameControl?.value
			}, latControl?.value, lngControl?.value);
			const airportSelected = matchedAirport || this.BigData?.airportsData?.find((item: any) => item.id == selectedAirportId);
			const airportDisplay = this.getPreviewAirportDisplay(nameControl?.value, optionControl?.value)
				|| this.getAirportDisplayValue(airportSelected);

			if (airportDisplay && nameControl && !nameControl.value) {
				nameControl.setValue(airportDisplay, { emitEvent: false });
			}

			if (airportDisplay && optionControl && !optionControl.value) {
				optionControl.setValue(airportDisplay, { emitEvent: false });
			}

			if (airportSelected) {
				if (this.BookingForm.get(field)?.value != airportSelected.id) {
					this.BookingForm.get(field)?.setValue(airportSelected.id, { emitEvent: false });
				}
				if (latControl && (latControl.value === '' || latControl.value === null || latControl.value === undefined)) {
					latControl.setValue(airportSelected.lat, { emitEvent: false });
				}
				if (lngControl && (lngControl.value === '' || lngControl.value === null || lngControl.value === undefined)) {
					lngControl.setValue(airportSelected.long, { emitEvent: false });
				}
				continue;
			}

			const currentControlValue = this.BookingForm.get(field)?.value;
			if ((currentControlValue === '' || currentControlValue === null || currentControlValue === undefined) && airportDisplay) {
				this.BookingForm.get(field)?.setValue(airportDisplay, { emitEvent: false });
			}
		}

		this.BookingForm.updateValueAndValidity({ emitEvent: false });
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

	handleAirportPlaceSelection(formControl: string, place: google.maps.places.PlaceResult) {
		const displayValue = this.getAirportSelectionLabel(place);
		const location = place.geometry?.location;
		if (!location) {
			return;
		}
		const latitude = location.lat();
		const longitude = location.lng();
		const matchedAirport = this.resolveInternalAirportRecord(place, latitude, longitude);
		const resolvedAirportValue = matchedAirport?.id ?? displayValue;

		this.BookingForm.get(`${formControl}_option`)?.setValue(displayValue);
		this.BookingForm.get(`${formControl}_name`)?.setValue(displayValue);
		this.BookingForm.get(`${formControl}_latitude`)?.setValue(latitude);
		this.BookingForm.get(`${formControl}_longitude`)?.setValue(longitude);
		this.BookingForm.get(formControl)?.setValue(resolvedAirportValue);
		this.BookingForm.updateValueAndValidity();
	}

	private syncVisibleFieldPayloads() {
		const addressInputs: Array<{ control: string; inputRef?: ElementRef<HTMLInputElement> }> = [
			{ control: 'pickup', inputRef: this.pickupInput },
			{ control: 'dropoff', inputRef: this.dropoffInput },
			{ control: 'return_pickup', inputRef: this.return_pickupInput },
			{ control: 'return_dropoff', inputRef: this.return_dropoffInput },
			{ control: 'fbo_address', inputRef: this.fboAddressInput },
			{ control: 'return_fbo_address', inputRef: this.returnFboAddressInput },
			{ control: 'loose_customer.address', inputRef: this.loosecustomerInput }
		];

		addressInputs.forEach(({ control, inputRef }) => {
			const nativeValue = String(inputRef?.nativeElement?.value || '').trim();
			const controlRef = this.BookingForm.get(control);
			const controlValue = String(controlRef?.value || '').trim();

			if (nativeValue && controlRef && !controlValue) {
				controlRef.setValue(nativeValue, { emitEvent: false });
				controlRef.updateValueAndValidity({ emitEvent: false });
			}
		});

		const airportInputs: Array<{ control: string; inputRef?: ElementRef<HTMLInputElement> }> = [
			{ control: 'pickup_airport', inputRef: this.pickupAirportInput },
			{ control: 'dropoff_airport', inputRef: this.dropoffAirportInput },
			{ control: 'return_pickup_airport', inputRef: this.returnPickupAirportInput },
			{ control: 'return_dropoff_airport', inputRef: this.returnDropoffAirportInput },
		];

		airportInputs.forEach(({ control, inputRef }) => {
			const nativeValue = String(inputRef?.nativeElement?.value || '').trim();
			const optionControl = this.BookingForm.get(`${control}_option`);
			const nameControl = this.BookingForm.get(`${control}_name`);
			const optionValue = String(optionControl?.value || '').trim();
			const nameValue = String(nameControl?.value || '').trim();

			if (nativeValue && optionControl && !optionValue) {
				optionControl.setValue(nativeValue, { emitEvent: false });
				optionControl.updateValueAndValidity({ emitEvent: false });
			}

			if (nativeValue && nameControl && !nameValue) {
				nameControl.setValue(nativeValue, { emitEvent: false });
				nameControl.updateValueAndValidity({ emitEvent: false });
			}
		});

		this.BookingForm.updateValueAndValidity({ emitEvent: false });
	}

	private applyQuoteBotAirportPrefill(
		fieldPrefix: 'pickup' | 'dropoff' | 'return_pickup' | 'return_dropoff',
		airportDisplay: any,
		airportLat: any,
		airportLng: any,
		rawAirportId: any,
		matchedAirport: any
	) {
		const resolvedDisplay = String(airportDisplay || '').trim();
		const resolvedAirportId = matchedAirport?.id ?? rawAirportId ?? resolvedDisplay ?? '';
		const valuesToPatch: Record<string, any> = {
			[`${fieldPrefix}_airport`]: resolvedAirportId,
			[`${fieldPrefix}_airport_option`]: resolvedDisplay,
			[`${fieldPrefix}_airport_name`]: resolvedDisplay,
			[`${fieldPrefix}_airport_latitude`]: airportLat ?? '',
			[`${fieldPrefix}_airport_longitude`]: airportLng ?? '',
		};

		this.patchControls(valuesToPatch);
	}
	get Form() {
		return this.BookingForm.controls;
	}
	get ExtraStops(): FormArray {
		return (<FormArray>this.BookingForm.get('extra_stops'));
	}
	get ReturnExtraStops() {
		return (<FormArray>this.BookingForm.get('return_extra_stops'));
	}
	searchSubstring(text: string, search_string: string, start: number = 0): boolean {
		return text.indexOf(search_string, start) != -1
	}
	fetchAirportsAndBigData(): void {
		let s = setInterval(() => {

			if (this.$api.getAirportsAndBigData()) {
				this.$spinner.hide('fetchspinner');
				this.BigData = JSON.parse(JSON.stringify(this.$api.getAirportsAndBigData()));
				this.BigData_COPY = JSON.parse(JSON.stringify(this.BigData));
				// format the name of each airports/airlines data as 'code - name, city, country'
				this.BigData.airportsData.map((item: any) => {
					if (item.id === 3283) {
						item['formatted_name'] = `${item.code} - ${item.name}`;
					} else {
						item['formatted_name'] = `${item.code} - ${item.name}, ${item.city}, ${item.country}`;
					}
					return item;
				});
				this.BigData.airlinesData.map((item: any) => item['formatted_name'] = `${item.code} - ${item.name}, ${item.country}`);
				this.BigData_COPY.airportsData.map((item: any) => {
					if (item.id === 3283) {
						item['formatted_name'] = `${item.code} - ${item.name}`;
					} else {
						item['formatted_name'] = `${item.code} - ${item.name}, ${item.city}, ${item.country}`;
					}
					return item;
				});
				this.BigData_COPY.airlinesData.map((item: any) => item['formatted_name'] = `${item.code} - ${item.name}, ${item.country}`);

				this.MapController();
				this.Form.reservation_id.value ? this.prefillViaBookingID(this.Form.reservation_id.value) : '';
				this.newBooking ? this.setValueByBookNow() : "";
				clearInterval(s);
			}
			else {
				this.$spinner.show('fetchspinner');
			}
		}, 2000);
	}

	prefillViaBookingID(booking_id: number) {
		// console.warn('Prefilling via Booking Id')
		this.$spinner.show('normalspinner');
		this.TravelAgentService.getBookingDataForEdit(booking_id, this.Form.updateType.value).subscribe((response: any) => {
			response.data.booking_instructions = response.data.booking_instructions.replaceAll('<br />', '')
			console.log('response <><><><><', response.data)
			let editing_data = response.data
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
			this.firstLoadVehicleId = response.data.vehicle_id
			this.firstLoadAffiliateId = response.data.affiliate_id
			this.number_of_hours = response?.data?.number_of_hours
			this.vehicleImgUrl = response?.data?.vehicle_images[0]
			this.driverImgUrl = response?.data?.driver_image
			this.isCreatedByAdmin = response?.data?.created_by == 1 ? true : false;
			this.SetFormValue('affiliate_type', response.data.affiliate_type)
			this.autofillData('cruise', editing_data);
			this.fillDriverInfo(editing_data);
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
				if (editing_data[item] && item != "passenger_cell_isd") {
					let val = editing_data[item];
					if (item == 'transfer_type' || item == 'return_transfer_type') {
						if (val == 'airport_to_cruise_port') val = 'airport_to_cruise';
					}
					if (isNaN(Number(val))) {
						this.SetFormValue(item, val);
					} else {
						this.SetFormValue(item, Number(val));
					}
				}
			}
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

			this.handleNoOfHours(this.number_of_hours)
			this.syncPrefilledTravelClientSelection();

			// if (this.Form.updateType.value == 'edit') {
			// 	this.booking_params.client_account_types.pop()
			// }
			this.booking_id = this.Form.reservation_id.value;
			// this.Form.affiliate_id.value != 0 ? this.chooseAffiliate() : ''
			try {
				this.PaxTelObject.setCountry(this.BookingForm.get('passenger_cell_country').value);
			} catch {
				console.error('Set Country Value is null.')
			}
			if (this.Form.affiliate_type.value == 'loose_affiliate') {
				setTimeout(() => {
					this.LATelObject.setCountry(this.BookingForm.get('lose_affiliate_phone_country').value);
					this.DrvTelObject.setCountry(this.BookingForm.get('driver_cell_country').value);
				}, 2000)
			}

			this.$spinner.hide('normalspinner')
			console.log('<<<<<<<<<<<-----------set pickup date------->>>>', moment().format('YYYY-MM-DD'), this.updateType)
			if (this.updateType == 'repeat' || this.updateType == 'return' || this.updateType == 'round') {
				this.scroll('pickup_address')
				this.SetFormValue('pickup_date', moment().format('YYYY-MM-DD'))
				// $("#repeatreturnmodal").modal("show");
				this.blockaddressfield = true
			}
		})
		this.fetchRates(booking_id)
	}

	handleNoOfHours(eventValue: any) {
		const value = Number(eventValue);

		// Update error flag reactively
		if (this.Form.service_type.value == 'charter_tour') {
			if (!isNaN(value) && value < 2) {
				this.numberOfHoursError = true;
			} else {
				this.numberOfHoursError = false;
			}
		} else {
			this.numberOfHoursError = false;
		}

		if (!isNaN(value) && value > 0) {
			this.number_of_hours = value;
			this.recalculateDisplayedRates();
		}
	}

	private recalculateDisplayedRates() {
		if (this.rateArray) {
			const rates = this.calculateRates(this.rateArray, this.min_rate_involved, false);
			this.subtotal = rates.subtotal;
			this.grandtotal = rates.subtotal;
			this.agentShare = rates.agentShare;
		}

		if (this.Form.service_type.value == 'round_trip' && this.returnRateArray) {
			const r_rates = this.calculateRates(this.returnRateArray, this.min_rate_involved, true);
			this.r_subtotal = r_rates.subtotal;
			this.r_grandtotal = r_rates.subtotal;
			this.r_agentShare = r_rates.agentShare;
		}
	}

	enforceMinimumHours(event: any) {
		let value = Number(event.target.value || 0);

		if (this.Form.service_type.value == 'charter_tour' && (isNaN(value) || value < 2)) {
			value = 2;
			this.number_of_hours = 2;
			this.SetFormValue('number_of_hours', 2);
			this.numberOfHoursError = false;
		}
		this.recalculateDisplayedRates();

	}

	blockNegative(event: any) {
		if (event.key == '-' || event.key == 'e' || event.key == 'E' || event.key == '+') {
			event.preventDefault();
		}
	}

	calculateRates(rateArray: any, min_rate_involved: boolean, isReturn: boolean = false) {
		let multiplyHours = 1;
		multiplyHours = this.number_of_hours >= 24 ? this.number_of_hours/24 : this.number_of_hours; 
		let subtotal = 0;
		let agentShare = 0;
		let base_rate = 0;
		let tax_base = 0;
		const extraGratuityAmount = rateArray?.misc?.Extra_Gratuity?.amount || 0;

		// 1. Calculate base_rate for shares, and tax_base like admin rates-form.
		const serviceType = this.BookingForm.value?.service_type;
		let baseRateObj = rateArray?.all_inclusive_rates?.["Base_Rate"];
		
		if (baseRateObj) {
			if (serviceType === 'charter_tour' && !min_rate_involved) {
				const multipliedBaseRate = (baseRateObj.baserate || 0) * multiplyHours;
				base_rate += multipliedBaseRate;
				tax_base += multipliedBaseRate;
			} else {
				base_rate += (baseRateObj.baserate || 0);
				tax_base += (baseRateObj.baserate || 0);
			}
		}

		['ELH_Charges', 'Stops', 'Wait'].forEach(key => {
			if (rateArray?.all_inclusive_rates?.[key]) {
				const inclusiveRate = (rateArray.all_inclusive_rates[key].baserate || 0);
				base_rate += inclusiveRate;
				tax_base += inclusiveRate;
			}
		});

		for (const key of Object.keys(rateArray?.amenities || {})) {
			base_rate += (rateArray.amenities[key].baserate || 0);
		}

		// 2. Calculate subtotal by iterating through all entries in rateArray
		for (let outerKey in rateArray) {
			if (rateArray.hasOwnProperty(outerKey)) {
				const innerObject = rateArray[outerKey];

				if (outerKey === 'all_inclusive_rates') {
					for (let innerKey in innerObject) {
						if (innerObject.hasOwnProperty(innerKey)) {
							if (innerKey === 'Base_Rate' && serviceType === 'charter_tour' && !min_rate_involved) {
								subtotal += (innerObject[innerKey].baserate || 0) * multiplyHours;
							} else {
								subtotal += (innerObject[innerKey].baserate || 0);
							}
						}
					}
				} else if (outerKey === 'taxes') {
					for (let innerKey in innerObject) {
						if (innerObject.hasOwnProperty(innerKey)) {
							const tax = innerObject[innerKey];
							if (tax.type === 'percent') {
								subtotal += (tax_base * parseFloat(tax.baserate || 0)) / 100;
							} else {
								subtotal += parseFloat(tax.baserate || 0);
							}
						}
					}
				} else {
					// amenities, misc, etc. - use 'amount'
					for (let innerKey in innerObject) {
						if (innerObject.hasOwnProperty(innerKey)) {
							subtotal += parseFloat(innerObject[innerKey].amount || 0);
						}
					}
				}
			}
		}

		// 3. Calculate shares
		const accountType = this.BookingForm.value?.account_type;
		if ((accountType === 'travel_planner' && !this.isCreatedByAdmin) ||
			['repeat', 'return', 'round', 'edit'].includes(this.updateType)) {
			let adminShare = (base_rate * 15) / 100;
			adminShare += extraGratuityAmount * 0.25;
			agentShare = base_rate * 0.10;
			subtotal += adminShare + agentShare;
		} else {
			let adminShare = (base_rate * 25) / 100;
			adminShare += extraGratuityAmount * 0.25;
			subtotal += adminShare;
		}

		return {
			subtotal: parseFloat(subtotal.toFixed(2)),
			agentShare: parseFloat(agentShare.toFixed(2))
		};
	}

	fetchRates(bookingId: number = 0) {
		this.$api.fetchAdminNewBookingRates(null, bookingId).subscribe((response: any) => {
			this.min_rate_involved = response?.data?.min_rate_involved
			this.rateArray = response?.data?.rateArray
			this.returnRateArray = response?.data?.retrunRateArray
			const prefilledHours = Number(this.BookingForm?.get('number_of_hours')?.value);
			if (!isNaN(prefilledHours) && prefilledHours > 0) {
				this.number_of_hours = prefilledHours;
			}
			this.recalculateDisplayedRates();
		});
	}
	autofillData(filling_for: string, data: any) {
		try {
			if (filling_for === 'passenger') {
				console.log('--->>>> filling passenger info', data)
				data.middle_name ?
					this.SetFormValue('passenger_name', `${data?.first_name} ${data?.middle_name} ${data?.last_name}`) : this.SetFormValue('passenger_name', `${data?.first_name} ${data?.last_name}`)
				this.SetFormValue('passenger_email', data?.email)
				this.SetFormValue('passenger_cell', data?.mobile)
				this.SetFormValue('passenger_cell_isd', data?.mobileIsd)
				this.SetFormValue('passenger_cell_country', data?.mobileCountry)
				this.SetFormValue('origin_airport_city', data?.origin_airport_city ? data?.origin_airport_city : data?.departing_airport_city)
				this.SetFormValue('pickup_flight', data?.pickup_flight)
				this.SetFormValue('dropoff_flight', data?.dropoff_flight)
				this.PaxTelObject.setCountry(data?.mobileCountry)
			}

		} catch (error) {
			console.log('error----->>>>>>', error)
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
			this.SetFormValue('driver_name', `${info?.FirstName} ${info?.MiddleName ?? ''} ${info?.LastName}`)
			this.SetFormValue('driver_gender', info?.Gender)
			this.SetFormValue('driver_cell', info?.CellNumber)
			let cellIsd = info?.CellIsd || '';
			let strCellIsd = String(cellIsd);
			if (strCellIsd && !strCellIsd.startsWith('+')) {
				strCellIsd = '+' + strCellIsd;
			}
			this.SetFormValue('driver_cell_isd', strCellIsd)
			this.SetFormValue('driver_cell_country', info?.CellNumberCountry)
			this.SetFormValue('driver_email', info?.Email)
			this.SetFormValue('driver_phone_type', info?.PhoneType ?? '');
			this.DrvTelObject.setCountry(this.BookingForm.get('driver_cell_country').value);
		}
	}

	fillDriverInfo(data) {
		this.SetFormValue('driver_name', `${data?.driver_name}`)
		this.SetFormValue('driver_gender', data?.driver_gender)
		this.SetFormValue('driver_cell', data?.driver_cell)
		let dIsd = data?.driver_cell_isd || '';
		let strDIsd = String(dIsd);
		if (strDIsd && !strDIsd.startsWith('+')) {
			strDIsd = '+' + strDIsd;
		}
		this.SetFormValue('driver_cell_isd', strDIsd)
		this.SetFormValue('driver_cell_country', data?.driver_cell_country)
		this.SetFormValue('driver_email', data?.driver_email)
		this.SetFormValue('driver_phone_type', data?.driver_phone_type ?? '');
		try {
			this.driver_info['name'] = data?.driver_name
			let infoPhoneIsd = data?.driver_cell_isd || '';
			let strInfoPhoneIsd = String(infoPhoneIsd);
			if (strInfoPhoneIsd && !strInfoPhoneIsd.startsWith('+')) {
				strInfoPhoneIsd = '+' + strInfoPhoneIsd;
			}
			this.driver_info["phone"] = strInfoPhoneIsd + data?.driver_cell
			this.driver_info["gender"] = data?.driver_gender
			this.driver_info["type"] = data?.vehicle_type_name
			this.driver_info["make"] = data?.vehicle_make_name
			this.driver_info["model"] = data?.vehicle_model_name
		} catch (error) {
			console.log('error-->', error)
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
	scroll(id) {
		let el = document.getElementById(id);
		console.log(`scrolling to ${id}`, el);
		el.scrollIntoView(true);
	}

	textFormatter(text: string) {
		try {
			return text.replace(/[\\\_$]+/g, ' ')
		}
		catch {
			return text
		}
	}
	onSelectionChangeServiceType(event: any) {
		this.service_type = event.value;
	}
	changeTransferType(type: string) {
		console.log('in function change transfer type', type)
		this.transfer_type = type
		this.initAllAutocompletes()
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
	changeReturnTransferType(event: any) {
		this.return_transfer_type = event
		this.initAllAutocompletes()
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
	// handleClientAccount(value: any) {
	// 	console.log('---------------------_>>>>>>>>>>>>>> client acc value', value)
	// 	this.chooseUser(value.id)
	// 	if (this.BookingForm.get('account_type').value == 'travel_planner') {
	// 		this.BookingForm.patchValue({
	// 			travel_client_id: ''
	// 		})
	// 		this.getTravelClientAccounts()
	// 	}

	// }

	handleChangeWithAgent(selectedAcc) {
		console.log('handleChangeWithAgent-->>', selectedAcc)
		// if (selectedAcc == 'travel_individual') {
		// 	this.BookingForm.get('sub_account_id').setValidators([Validators.required]);
		// 	this.BookingForm.get('sub_account_id').updateValueAndValidity();
		// }
		// else {
		// 	this.BookingForm.get('sub_account_id').clearValidators();
		// 	this.BookingForm.get('sub_account_id').updateValueAndValidity();
		// }
	}

	handleChangeTravelAccounts(selectedAcc) {
		console.log('handleChangeTravelAccounts-->>', selectedAcc)
		if (selectedAcc == 'travel_individual') {
			this.BookingForm.get('travel_client_id').setValidators([Validators.required]);
			this.BookingForm.get('travel_client_id').updateValueAndValidity();
		}
		else {
			setTimeout(() => {
				this.initphonefield()
				this.initAllAutocompletes()
			}, 200)
			this.BookingForm.get('travel_client_id').clearValidators();
			this.BookingForm.get('travel_client_id').updateValueAndValidity();
		}
	}
	handleTravelStaffAccounts(value: any) {
		try {
			console.log('handleTravelStaffAccounts--->>>', value)
			this.TravelAgentService.getTravelClientDetailById(value.id).subscribe((response: any) => {
				console.log("detail ->>>>>>>", response)
				this.autofillData('passenger', response?.data);

			})
		} catch (error) {
			console.log('error--->>>>', error)
		}

	}
	handleSubAgentAccounts(value: any) {

		console.log('handleSubAgentAccounts--->>>', value)
	}


	PaxTelInputObject(event: any) {
		this.PaxTelObject = event;
	}
	handleChangeMonth(value: any) {
		console.log('value', value)
		if (value) {
			this.monthOptions = this.months.filter(i => i.value.includes(value))
		}
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
			.filter((item: Record<string, any>) => !!item.address);
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

	clearExtraStopAddress(isReturn: boolean, stopIndex: number, input?: HTMLInputElement) {
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
	fillExtraStop(is_return: boolean, index: number, address: any, location: any) {
		console.log(is_return, index, address, location);
		const displayAddress = address?.display_address ?? address?.formatted_address ?? '';
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
							console.log('Both locations are in the same town/city.');
							await (<FormArray>this.BookingForm.get([formKey])).at(index).patchValue({
								rate: 'in_town'
							});
						} else {
							console.log('Locations are in different towns/cities.');
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

	mToMi(distance: number): string {
		return (distance / 1609).toFixed(2)
	}
	mToKm(distance: number): string {
		return (distance / 1000).toFixed(2)
	}
	textFormatterTransferType(text: any) {
		try {
			return text.replace(/[\\\_$]+/g, ' ') + '?'
		}
		catch {
			return text
		}
	}
	change(event: any, form_control: string) {
		console.log(event, form_control)
		if (event?.id) {
			this.SetFormValue(form_control, event.id);
			return;
		}

		if (form_control.endsWith('_airport')) {
			this.clearAirportSelection(form_control);
			return;
		}

		if (form_control.endsWith('_airline')) {
			this.clearAirlineSelection(form_control);
			return;
		}

		this.setControlValue(form_control, '');
	}
	FormatTime(time: string) {
		return moment(time, "HH:mm:ss").format("LT");
	}
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
	fillAddress(form_control: string, address: any) {
		// console.log('Address: ', address)
		this.SetFormValue(form_control, address?.display_address ?? address?.formatted_address ?? '')
	}

	async MapController(is_return: boolean = false) {
		try {
			let waypoints = []
			let origin: google.maps.LatLng
			let destination: google.maps.LatLng
			let map: google.maps.Map

			// Wait for Maps API to be ready (it should be ready when component loads if using @angular/google-maps properly)
			await this.mapsApiReady();

			// Set waypoints
			if (is_return) {
				const element = document.getElementById('return_map');
				if (!element) throw new Error('Return map element not found');

				map = new google.maps.Map(element, {
					zoom: 7,
					center: { lat: 41.850033, lng: -87.6500523 },
					scaleControl: true
				});

				if (this.ReturnExtraStops.length > 0) {
					for (let i = 0; i < this.ReturnExtraStops.length; i++) {
						const stop = (<FormGroup>(<FormArray>this.BookingForm.get('return_extra_stops')).at(i));
						waypoints.push({
							location: new google.maps.LatLng(
								stop.get('latitude').value,
								stop.get('longitude').value
							),
							stopover: true
						});
					}
				}

				origin = new google.maps.LatLng(this.Form.return_pickup_latitude.value, this.Form.return_pickup_longitude.value)
				destination = new google.maps.LatLng(this.Form.return_dropoff_latitude.value, this.Form.return_dropoff_longitude.value)

				if (this.Form.return_transfer_type.value.includes('airport_')) {
					origin = new google.maps.LatLng(this.Form.return_pickup_airport_latitude.value, this.Form.return_pickup_airport_longitude.value)
				}
				if (this.Form.return_transfer_type.value.includes('_airport')) {
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

				if (this.ExtraStops.length > 0) {
					for (let i = 0; i < this.ExtraStops.length; i++) {
						const stop = (<FormGroup>(<FormArray>this.BookingForm.get('extra_stops')).at(i));
						waypoints.push({
							location: new google.maps.LatLng(
								stop.get('latitude').value,
								stop.get('longitude').value
							),
							stopover: true
						});
					}
				}
				origin = new google.maps.LatLng(this.Form.pickup_latitude.value, this.Form.pickup_longitude.value)
				destination = new google.maps.LatLng(this.Form.dropoff_latitude.value, this.Form.dropoff_longitude.value)

				if (this.Form.transfer_type.value.includes('airport_')) {
					origin = new google.maps.LatLng(this.Form.pickup_airport_latitude.value, this.Form.pickup_airport_longitude.value)
				}
				if (this.Form.transfer_type.value.includes('_airport')) {
					destination = new google.maps.LatLng(this.Form.dropoff_airport_latitude.value, this.Form.dropoff_airport_longitude.value)
				}
			}

			// this.drawMap(map, {
			// 	origin,
			// 	destination,
			// 	waypoints,
			// 	optimizeWaypoints: true,
			// 	travelMode: google.maps.TravelMode.DRIVING
			// }, is_return)


			const request: google.maps.DirectionsRequest = {
				origin,
				destination,
				waypoints,
				optimizeWaypoints: true,
				travelMode: google.maps.TravelMode.DRIVING
			};

			this.drawMap(map, request, is_return);

		} catch (error) {
			console.error('Error initializing MapController:', error);
		}



	}

	private parseRouteCoordinate(value: any): number | null {
		if (value === '' || value === null || typeof value === 'undefined') {
			return null;
		}

		const parsedValue = Number(value);
		return Number.isFinite(parsedValue) ? parsedValue : null;
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

		return [pickupLat, pickupLng, dropoffLat, dropoffLng].every((value) => value !== null && Number.isFinite(value));
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

			if (!endpointUsesAirportCoordinates && addressValue && !hasAddressCoordinates && hasAirportCoordinates) {
				this.BookingForm.get(addressLatControl)?.setValue(airportLat, { emitEvent: false });
				this.BookingForm.get(addressLngControl)?.setValue(airportLng, { emitEvent: false });
			}

			if (endpointUsesAirportCoordinates && airportDisplayValue && !hasAirportCoordinates && hasAddressCoordinates) {
				this.BookingForm.get(airportLatControl)?.setValue(addressLat, { emitEvent: false });
				this.BookingForm.get(airportLngControl)?.setValue(addressLng, { emitEvent: false });
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

	drawMap(map: google.maps.Map, request: google.maps.DirectionsRequest, is_return: boolean) {
		if (!request.origin || !request.destination) {
			console.error('Request object missing origin/destination');
			return;
		}

		// Ensure we get multiple route options so we can pick the shortest
		request.provideRouteAlternatives = true;

		const directionsRenderer = new google.maps.DirectionsRenderer()
		const directionsService = new google.maps.DirectionsService()
		directionsRenderer.setMap(map)

		directionsService.route(request, (response: any, status: string) => {
			if (status === google.maps.DirectionsStatus.OK) {

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

				directionsRenderer.setDirections(response)
				directionsRenderer.setRouteIndex(shortestIndex); // highlight the shortest route

				const chosenRoute = response.routes[shortestIndex];

				this.fetchDistanceAndTime(chosenRoute).then((res: { distance: number, time: number }) => {
					if (is_return) {
						this.return_distance = res.distance
						if (!this.BookingForm.get('return_extra_stops')?.value?.length || this.BookingForm.get('return_extra_stops')?.value[0]['rate']?.length) {
							this.buildBookingData()
						}
						this.BookingForm.patchValue({
							returnJourneyDistance: res.distance,
							returnJourneyTime: res.time
						})
					} else {
						this.distance = res.distance
						if (!this.BookingForm.get('extra_stops')?.value?.length || this.BookingForm.get('extra_stops')?.value[0]['rate']?.length) {
							this.buildBookingData()
						}
						this.BookingForm.patchValue({
							journeyDistance: res.distance,
							journeyTime: res.time
						})
					}
				})
			}
		})
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
	
	fillLocationPoints(form_control: string, location: any) {
		// console.log('Location Points', location)
		this.SetFormValue(form_control + '_latitude', location.latitude)
		this.SetFormValue(form_control + '_longitude', location.longitude)
		this.MapController()
		if (this.Form.service_type.value == 'round_trip') {
			this.MapController(true)
		}
	}
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


	get LooseCustomer() {
		return (<FormGroup>this.BookingForm.get('loose_customer')).controls;
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
			this.$api.getAccountBytype(legend[account_type]).subscribe((response: any) => {
				if (response.success && response.data.length > 0) {
					this.ClientAccounts = response.data;
				}
				this.$spinner.hide()
			})
		}
	}


	chooseUser(account_id: number) {
		this.$spinner.show()
		this.chosen_user = {}
		this.$api.chooseUser(account_id, this.Form.account_type.value).subscribe((response: any) => {
			if (response.success && Object.keys(response.data).length > 0) {
				this.chosen_user = response.data
				this.chosen_user['name'] = `${response.data.first_name} ${response.data.middle_name ?? ''} ${response.data.last_name}`
				this.autofillData('passenger', this.chosen_user);
			}
			this.$spinner.hide();
		})
	}

	fillLCDetails(choose_user: any) {
		this.SetLCFormValue('first_name', choose_user?.first_name)
		this.SetLCFormValue('middle_name', choose_user?.middle_name)
		this.SetLCFormValue('last_name', choose_user?.last_name)
		this.SetLCFormValue('email', choose_user?.email)
		this.SetLCFormValue('phone', choose_user?.mobile)
	}

	// handleClientAccount(value: any) {
	// 	console.log('---------------------_>>>>>>>>>>>>>> client acc value', value)
	// 	this.chooseUser(value.id)
	// }

	/**
	 * No-op: this screen has no affiliate picker.
	 *
	 * It used to load the full affiliate list into `AffiliateAccounts`, but
	 * nothing in this template ever bound to it, so the request was pure
	 * overhead on a lookup that scans every affiliate.
	 */
	fetchAffiliates(affiliate_type: 'affiliate' | 'loose_affiliate') {
		return
	}


	chooseAffiliate() {
		// console.warn('Fetching Affiliate vehicles and drivers')
		this.fetchAffiliateVehicles(this.BookingForm.get('affiliate_id').value)
		this.fetchAffiliateDrivers(this.BookingForm.get('affiliate_id').value)
	}

	fetchAffiliateInformation(affiliate_id: number) {
		this.$spinner.show('normalspinner');
		this.$api.getAffiliateAccount(affiliate_id).pipe(pluck('data')).subscribe((response: any) => {
			isDevMode() && console.info('Affiliate Information', response);
			this.AffiliateInformation = response;
			this.$spinner.hide('normalspinner');
		})
	}
	handleSelectVehicleType(selectedVehicle: any) {
		console.log('selectweed vehicle-->>>>', selectedVehicle, selectedVehicle.licensePlate === null)
		this.SetFormValue('vehicle_id', selectedVehicle.ID);
		this.SetFormValue('vehicle_type_name', selectedVehicle.vehicleType)
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
			console.error('Invalid Paramater affiliate_data', affiliate_id)
			return
		}
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


	resetFields() {
		this.chosen_user = null
		// this.buildBookingForm()
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

	toggleDropdown(type: string) {
		// console.log('Toggle Dropdown ', type)
		this.booking_params['chevrons'][type] = !this.booking_params['chevrons'][type]
	}
	handleChangeVehicleType(event) {
		console.log('in function handle change vehicle type', event.unique_key)
		this.VehicleList.map(i => (i.unique_key == event.unique_key) ? this.handleSelectVehicleType(i) : '')

	}

	Subscriptions() {
		//pickup time change 
		this.BookingForm.get('pickup_time').valueChanges.subscribe((value: string) => {
			this.buildBookingData()
		})
		this.BookingForm.get('return_pickup_time').valueChanges.subscribe((value: string) => {
			this.buildBookingData()
		})
		this.BookingForm.get('number_of_hours').valueChanges.subscribe((value: any) => {
			const numericValue = Number(value);
			if (!isNaN(numericValue) && numericValue > 0) {
				this.number_of_hours = numericValue;
			}

			if (this.Form.service_type.value == 'charter_tour') {
				this.numberOfHoursError = !isNaN(numericValue) && numericValue < 2;
			} else {
				this.numberOfHoursError = false;
			}

			this.recalculateDisplayedRates();
			this.buildBookingData();
		})


		// Service Type
		this.BookingForm.get('service_type').valueChanges.subscribe((value: string) => {
			this.updateNumberOfHoursValidators(value);
			this.init_return_rates = false;
			if (value == 'round_trip') {
				this.initAllAutocompletes()
				this.init_return_rates = true;
				setTimeout(() => {
					this.MapController(true)
				}, 2000)
				this.updateReturnLegValidators(this.BookingForm.get('return_transfer_type').value);
			}
			if (value != 'charter_tour') {
				this.BookingForm.get('number_of_hours').setValue(2)
				this.BookingForm.updateValueAndValidity()
				console.log(this.BookingForm.get('number_of_hours').value);
			}
			if (value != 'round_trip') {
				this.clearReturnOnlyValidators();
			}
			this.recalculateDisplayedRates();
		})

		// Transfer Type
		this.BookingForm.get('transfer_type').valueChanges.subscribe((value: string) => {
			console.log("in transfer_type value changes", value)
			this.initAllAutocompletes();
			const oldValue = this.transfer_type;
			const newValue = value;

			if ((oldValue == 'city_to_airport' && newValue == 'airport_to_city') ||
				(oldValue == 'airport_to_city' && newValue == 'city_to_airport') ||
				(oldValue == 'city_to_cruise' && newValue == 'cruise_to_city') ||
				(oldValue == 'cruise_to_city' && newValue == 'city_to_cruise')) {
				console.log('Flipping outbound addresses and details');

				// Capture outbound values
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
				const fboAddress = this.Form.fbo_address.value;
				const fboName = this.Form.fbo_name.value;
				const originAirportCity = this.Form.origin_airport_city.value;

				const cruisePort = this.Form.cruise_port.value;
				const cruiseName = this.Form.cruise_name.value;
				const cruiseTime = this.Form.cruise_time.value;

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

				// Swap Outbound
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

				// If round trip, mirror the flip to return leg as well
				if (this.Form.service_type.value == 'round_trip') {
					console.log('NFC: Flipping return leg as well for round trip');
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
					const r_fboAddress = this.Form.return_fbo_address.value;
					const r_fboName = this.Form.return_fbo_name.value;
					const departingAirportCity = this.Form.departing_airport_city.value;

					const r_cruisePort = this.Form.return_cruise_port.value;
					const r_cruiseName = this.Form.return_cruise_name.value;
					const r_cruiseTime = this.Form.return_cruise_time.value;

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

					// Swap Return
					this.SetFormValue('return_pickup', r_dropoff, false);
					this.SetFormValue('return_pickup_latitude', r_dropoffLat, false);
					this.SetFormValue('return_pickup_longitude', r_dropoffLng, false);
					this.SetFormValue('return_pickup_airport', r_dropoffAirport, false);
					this.SetFormValue('return_pickup_airport_option', r_dropoffAirportOpt, false);
					this.SetFormValue('return_pickup_airport_name', r_dropoffAirportName, false);
					this.SetFormValue('return_pickup_airport_latitude', r_dropoffAirportLat, false);
					this.SetFormValue('return_pickup_airport_longitude', r_dropoffAirportLng, false);
					this.SetFormValue('return_pickup_airline', r_dropoffAirline, false);
					this.SetFormValue('return_pickup_airline_option', r_dropoffAirlineOpt, false);
					this.SetFormValue('return_pickup_airline_name', r_dropoffAirlineName, false);
					this.SetFormValue('return_pickup_flight', r_dropoffFlight, false);
					this.SetFormValue('return_fbo_address', r_fboAddress, false);
					this.SetFormValue('return_fbo_name', r_fboName, false);
					this.SetFormValue('return_cruise_port', r_cruisePort, false);
					this.SetFormValue('return_cruise_name', r_cruiseName, false);
					this.SetFormValue('return_cruise_time', r_cruiseTime, false);

					this.SetFormValue('return_dropoff', r_pickup, false);
					this.SetFormValue('return_dropoff_latitude', r_pickupLat, false);
					this.SetFormValue('return_dropoff_longitude', r_pickupLng, false);
					this.SetFormValue('return_dropoff_airport', r_pickupAirport, false);
					this.SetFormValue('return_dropoff_airport_option', r_pickupAirportOpt, false);
					this.SetFormValue('return_dropoff_airport_name', r_pickupAirportName, false);
					this.SetFormValue('return_dropoff_airport_latitude', r_pickupAirportLat, false);
					this.SetFormValue('return_dropoff_airport_longitude', r_pickupAirportLng, false);
					this.SetFormValue('return_dropoff_airline', r_pickupAirline, false);
					this.SetFormValue('return_dropoff_airline_option', r_pickupAirlineOpt, false);
					this.SetFormValue('return_dropoff_airline_name', r_pickupAirlineName, false);
					this.SetFormValue('return_dropoff_flight', r_pickupFlight, false);

					// Also swap cities
					this.SetFormValue('origin_airport_city', departingAirportCity, false);
					this.SetFormValue('departing_airport_city', originAirportCity, false);
				}

				setTimeout(() => this.MapController(true), 1000);
			}

			this.transfer_type = value;

			if (value.includes("city_")) {
				this.SetFormValue('booking_instructions', "<ol><li>Driver - Text on location. Text the client a day before to confirm driver name , cell phone and booking details. Text client with ETA when en route</li> </ol>");
			}

			// set cruise ship name and cruise port mandatory
			if (value.includes('_cruise') || value.includes('cruise_')) {
				if (value.includes("cruise_")) {
					this.SetFormValue('booking_instructions', "<ol><li>Pax - Text driver when docked.</li> <li>Driver - Text the client a day before to confirm driver name , cell phone and booking details. Text client with ETA when en route. Text pax with pickup instructions when ship has arrived.</li> </ol>");
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
				this.SetFormValue('booking_instructions', "<ol><li>Pax - Text driver when landing.</li> <li>Driver - Text the client a day before to confirm driver name , cell phone and booking details. Text client with ETA when en route. Text pax with pickup instructions when plane has arrived.</li> </ol>");
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
			this.SetFormValue('return_transfer_type', reverseStringChars(value), false)
			this.return_transfer_type = reverseStringChars(value)
			this.updateReturnLegValidators(this.BookingForm.get('return_transfer_type').value);

			// pickup address validation
			if (!value.startsWith('airport_')) {
				this.BookingForm.get('pickup')?.setValidators([Validators.required]);
			} else {
				this.BookingForm.get('pickup')?.clearValidators();
			}
			this.BookingForm.get('pickup')?.updateValueAndValidity();

			// dropoff address validation
			if (!value.endsWith('_airport')) {
				this.BookingForm.get('dropoff')?.setValidators([Validators.required]);
			} else {
				this.BookingForm.get('dropoff')?.clearValidators();
			}
			this.BookingForm.get('dropoff')?.updateValueAndValidity();

			this.refreshMapIfRouteReady(false);
			if (this.Form.service_type.value == 'round_trip') {
				this.refreshMapIfRouteReady(true);
			}
		})

		this.BookingForm.get('return_transfer_type').valueChanges.subscribe((value: string) => {
			console.log("in return_transfer_type value changes", value)
			this.initAllAutocompletes();
			const oldValue = this.return_transfer_type;
			const newValue = value;

			if ((oldValue == 'city_to_airport' && newValue == 'airport_to_city') ||
				(oldValue == 'airport_to_city' && newValue == 'city_to_airport') ||
				(oldValue == 'city_to_cruise' && newValue == 'cruise_to_city') ||
				(oldValue == 'cruise_to_city' && newValue == 'city_to_cruise')) {
				console.log('Flipping return addresses and details');

				// Capture return values
				const pickup = this.Form.return_pickup.value;
				const pickupLat = this.Form.return_pickup_latitude.value;
				const pickupLng = this.Form.return_pickup_longitude.value;
				const pickupAirport = this.Form.return_pickup_airport.value;
				const pickupAirportOpt = this.BookingForm.get('return_pickup_airport_option').value;
				const pickupAirportName = this.Form.return_pickup_airport_name.value;
				const pickupAirportLat = this.Form.return_pickup_airport_latitude.value;
				const pickupAirportLng = this.Form.return_pickup_airport_longitude.value;
				const pickupAirline = this.Form.return_pickup_airline.value;
				const pickupAirlineOpt = this.BookingForm.get('return_pickup_airline_option').value;
				const pickupAirlineName = this.Form.return_pickup_airline_name.value;
				const pickupFlight = this.Form.return_pickup_flight.value;
				const fboAddress = this.Form.return_fbo_address.value;
				const fboName = this.Form.return_fbo_name.value;
				const departingAirportCity = this.Form.departing_airport_city.value;

				const cruisePort = this.Form.return_cruise_port.value;
				const cruiseName = this.Form.return_cruise_name.value;
				const cruiseTime = this.Form.return_cruise_time.value;

				const dropoff = this.Form.return_dropoff.value;
				const dropoffLat = this.Form.return_dropoff_latitude.value;
				const dropoffLng = this.Form.return_dropoff_longitude.value;
				const dropoffAirport = this.Form.return_dropoff_airport.value;
				const dropoffAirportOpt = this.BookingForm.get('return_dropoff_airport_option').value;
				const dropoffAirportName = this.Form.return_dropoff_airport_name.value;
				const dropoffAirportLat = this.Form.return_dropoff_airport_latitude.value;
				const dropoffAirportLng = this.Form.return_dropoff_airport_longitude.value;
				const dropoffAirline = this.Form.return_dropoff_airline.value;
				const dropoffAirlineOpt = this.BookingForm.get('return_dropoff_airline_option').value;
				const dropoffAirlineName = this.Form.return_dropoff_airline_name.value;
				const dropoffFlight = this.Form.return_dropoff_flight.value;

				// Swap Return
				this.SetFormValue('return_pickup', dropoff);
				this.SetFormValue('return_pickup_latitude', dropoffLat);
				this.SetFormValue('return_pickup_longitude', dropoffLng);
				this.SetFormValue('return_pickup_airport', dropoffAirport);
				this.SetFormValue('return_pickup_airport_option', dropoffAirportOpt);
				this.SetFormValue('return_pickup_airport_name', dropoffAirportName);
				this.SetFormValue('return_pickup_airport_latitude', dropoffAirportLat);
				this.SetFormValue('return_pickup_airport_longitude', dropoffAirportLng);
				this.SetFormValue('return_pickup_airline', dropoffAirline);
				this.SetFormValue('return_pickup_airline_option', dropoffAirlineOpt);
				this.SetFormValue('return_pickup_airline_name', dropoffAirlineName);
				this.SetFormValue('return_pickup_flight', dropoffFlight);

				this.SetFormValue('return_dropoff', pickup);
				this.SetFormValue('return_dropoff_latitude', pickupLat);
				this.SetFormValue('return_dropoff_longitude', pickupLng);
				this.SetFormValue('return_dropoff_airport', pickupAirport);
				this.SetFormValue('return_dropoff_airport_option', pickupAirportOpt);
				this.SetFormValue('return_dropoff_airport_name', pickupAirportName);
				this.SetFormValue('return_dropoff_airport_latitude', pickupAirportLat);
				this.SetFormValue('return_dropoff_airport_longitude', pickupAirportLng);
				this.SetFormValue('return_dropoff_airline', pickupAirline);
				this.SetFormValue('return_dropoff_airline_option', pickupAirlineOpt);
				this.SetFormValue('return_dropoff_airline_name', pickupAirlineName);
				this.SetFormValue('return_dropoff_flight', pickupFlight);

				// If round trip, mirror the flip back to outbound leg as well
				if (this.Form.service_type.value == 'round_trip') {
					console.log('NFC: Flipping outbound leg as well for round trip');
					const o_pickup = this.Form.pickup.value;
					const o_pickupLat = this.Form.pickup_latitude.value;
					const o_pickupLng = this.Form.pickup_longitude.value;
					const o_pickupAirport = this.Form.pickup_airport.value;
					const o_pickupAirportOpt = this.BookingForm.get('pickup_airport_option').value;
					const o_pickupAirportName = this.Form.pickup_airport_name.value;
					const o_pickupAirportLat = this.Form.pickup_airport_latitude.value;
					const o_pickupAirportLng = this.Form.pickup_airport_longitude.value;
					const o_pickupAirline = this.Form.pickup_airline.value;
					const o_pickupAirlineOpt = this.BookingForm.get('pickup_airline_option').value;
					const o_pickupAirlineName = this.Form.pickup_airline_name.value;
					const o_pickupFlight = this.Form.pickup_flight.value;
					const o_fboAddress = this.Form.fbo_address.value;
					const o_fboName = this.Form.fbo_name.value;
					const originAirportCity = this.Form.origin_airport_city.value;

					const o_cruisePort = this.Form.cruise_port.value;
					const o_cruiseName = this.Form.cruise_name.value;
					const o_cruiseTime = this.Form.cruise_time.value;

					const o_dropoff = this.Form.dropoff.value;
					const o_dropoffLat = this.Form.dropoff_latitude.value;
					const o_dropoffLng = this.Form.dropoff_longitude.value;
					const o_dropoffAirport = this.Form.dropoff_airport.value;
					const o_dropoffAirportOpt = this.BookingForm.get('dropoff_airport_option').value;
					const o_dropoffAirportName = this.Form.dropoff_airport_name.value;
					const o_dropoffAirportLat = this.Form.dropoff_airport_latitude.value;
					const o_dropoffAirportLng = this.Form.dropoff_airport_longitude.value;
					const o_dropoffAirline = this.Form.dropoff_airline.value;
					const o_dropoffAirlineOpt = this.BookingForm.get('dropoff_airline_option').value;
					const o_dropoffAirlineName = this.Form.dropoff_airline_name.value;
					const o_dropoffFlight = this.Form.dropoff_flight.value;

					// Swap Outbound
					this.SetFormValue('pickup', o_dropoff, false);
					this.SetFormValue('pickup_latitude', o_dropoffLat, false);
					this.SetFormValue('pickup_longitude', o_dropoffLng, false);
					this.SetFormValue('pickup_airport', o_dropoffAirport, false);
					this.SetFormValue('pickup_airport_option', o_dropoffAirportOpt, false);
					this.SetFormValue('pickup_airport_name', o_dropoffAirportName, false);
					this.SetFormValue('pickup_airport_latitude', o_dropoffAirportLat, false);
					this.SetFormValue('pickup_airport_longitude', o_dropoffAirportLng, false);
					this.SetFormValue('pickup_airline', o_dropoffAirline, false);
					this.SetFormValue('pickup_airline_option', o_dropoffAirlineOpt, false);
					this.SetFormValue('pickup_airline_name', o_dropoffAirlineName, false);
					this.SetFormValue('pickup_flight', o_dropoffFlight, false);
					this.SetFormValue('fbo_address', o_fboAddress, false);
					this.SetFormValue('fbo_name', o_fboName, false);
					this.SetFormValue('cruise_port', o_cruisePort, false);
					this.SetFormValue('cruise_name', o_cruiseName, false);
					this.SetFormValue('cruise_time', o_cruiseTime, false);

					this.SetFormValue('dropoff', o_pickup, false);
					this.SetFormValue('dropoff_latitude', o_pickupLat, false);
					this.SetFormValue('dropoff_longitude', o_pickupLng, false);
					this.SetFormValue('dropoff_airport', o_pickupAirport, false);
					this.SetFormValue('dropoff_airport_option', o_pickupAirportOpt, false);
					this.SetFormValue('dropoff_airport_name', o_pickupAirportName, false);
					this.SetFormValue('dropoff_airport_latitude', o_pickupAirportLat, false);
					this.SetFormValue('dropoff_airport_longitude', o_pickupAirportLng, false);
					this.SetFormValue('dropoff_airline', o_pickupAirline, false);
					this.SetFormValue('dropoff_airline_option', o_pickupAirlineOpt, false);
					this.SetFormValue('dropoff_airline_name', o_pickupAirlineName, false);
					this.SetFormValue('dropoff_flight', o_pickupFlight, false);

					// Also swap cities
					this.SetFormValue('origin_airport_city', departingAirportCity, false);
					this.SetFormValue('departing_airport_city', originAirportCity, false);
				}

				setTimeout(() => this.MapController(true), 1000);
			}

			this.return_transfer_type = value;

			if (this.BookingForm.get('service_type').value == 'round_trip') {
				this.updateReturnLegValidators(value);
				this.refreshMapIfRouteReady(true);
			} else {
				this.clearReturnOnlyValidators();
			}
		})

		this.BookingForm.get('account_type').valueChanges.subscribe((value: string) => {
			this.initAllAutocompletes()
		})

		// Account Type Subscription
		// this.BookingForm.get('account_type').valueChanges.subscribe((value: string) => {
		// 	if (value == 'loose_customer') {
		// 		const loose_customer = (this.BookingForm.get('loose_customer') as FormGroup)
		// 		// for every 'item' in loose_customer
		// 		for (let item in loose_customer.controls) {
		// 			// if 'item' in loose_customer is a formgroup, like card_details
		// 			if ((<FormGroup>this.BookingForm.get('loose_customer')).get(item) instanceof FormGroup) {
		// 				console.log(item)
		// 				// for every 'key' in card_details formgroup
		// 				for (let key in (loose_customer.get(item) as FormGroup).controls) {
		// 					// set validators in card_details
		// 					(<FormGroup>loose_customer.get(item)).get(key).setValidators([Validators.required]);
		// 					(<FormGroup>loose_customer.get(item)).get(key).updateValueAndValidity();

		// 				}
		// 			}

		// 			if (item != 'middle_name' && item != 'address') {
		// 				loose_customer.get(item).setValidators([Validators.required]);
		// 			}
		// 		}

		// 		(<FormGroup>loose_customer.get('card_details')).get('card_number').setValidators([Validators.required, Validators.pattern("^[0-9+]*$"), , Validators.minLength(12), Validators.maxLength(20),]);
		// 		(<FormGroup>loose_customer.get('card_details')).get('name').setValidators([Validators.required]);
		// 		(<FormGroup>loose_customer.get('card_details')).get('cvv').setValidators([Validators.required, Validators.pattern("^[0-9+]*$")]);
		// 		loose_customer.get('email').setValidators([Validators.required, Validators.pattern(/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.]+\.[a-zA-Z]{2,}$/i)])
		// 		loose_customer.get('phone').setValidators([Validators.required, Validators.pattern("^[0-9+]*$"), Validators.minLength(4), Validators.maxLength(15)])
		// 		loose_customer.get('first_name').setValidators([Validators.required])
		// 		// loose_customer.get('middle_name').setValidators(this.customValidator.whitespace())
		// 		loose_customer.get('last_name').setValidators([Validators.required])
		// 		loose_customer.get('address').setValidators(this.customValidator.whitespace())
		// 		loose_customer.updateValueAndValidity()

		// 	}
		// 	else {
		// 		const loose_customer = (this.BookingForm.get('loose_customer') as FormGroup)
		// 		// for every 'item' in loose_customer
		// 		for (let item in loose_customer.controls) {
		// 			// if 'item' in loose_customer is a formgroup, like card_details
		// 			if (loose_customer.get(item) instanceof FormGroup) {
		// 				// for every 'key' in card_details formgroup
		// 				for (let key in (loose_customer.get(item) as FormGroup).controls) {
		// 					// clear validators in card_details
		// 					loose_customer.get(item).get(key).clearValidators()
		// 					loose_customer.get(item).get(key).updateValueAndValidity()
		// 				}
		// 			}
		// 			loose_customer.get(item).clearValidators()
		// 			loose_customer.get(item).updateValueAndValidity()
		// 		}

		// 		this.fetchClientAccounts(value)
		// 	}
		// })

		this.BookingForm.get('acc_id').valueChanges.subscribe((value: number) => {
			if (value && this.updateType == 'repeat' && this.updateType == 'return' && this.updateType == 'edit' && this.updateType == 'round') {
				this.chooseUser(value)
			}
		})

		// Affiliate Type
		// this.BookingForm.get('affiliate_type').valueChanges.subscribe((value: string) => {
		// 	if (value == 'loose_affiliate') {
		// 		this.toggleDropdown(null)
		// 		this.BookingForm.get('lose_affiliate_name').setValidators([Validators.required])
		// 		this.BookingForm.get('lose_affiliate_phone').setValidators([Validators.required, Validators.pattern("^[0-9+]*$"), Validators.minLength(4), Validators.maxLength(15)])
		// 		this.BookingForm.get('lose_affiliate_email').setValidators([Validators.required, Validators.pattern(/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.]+\.[a-zA-Z]{2,}$/i)])
		// 		this.BookingForm.updateValueAndValidity()
		// 		this.init_rates = true
		// 		if (this.Form.service_type.value === 'round_trip') {
		// 			this.init_return_rates = true;
		// 		}
		// 		if (this.Form.updateType.value != 'edit' && this.Form.updateType.value != 'repeat' && this.Form.updateType.value != 'return') {
		// 			this.SetFormValue('vehicle_type_name', '');
		// 			this.BookingForm.get('vehicle_make').setValue('')
		// 			this.BookingForm.get('vehicle_make_name').setValue('')
		// 			this.BookingForm.get('vehicle_model').setValue('')
		// 			this.BookingForm.get('vehicle_model_name').setValue('')
		// 			this.BookingForm.get('vehicle_year').setValue('')
		// 			this.BookingForm.get('vehicle_year_name').setValue('')
		// 			this.BookingForm.get('vehicle_color').setValue('')
		// 			this.BookingForm.get('vehicle_color_name').setValue('')
		// 			this.BookingForm.updateValueAndValidity();
		// 		}
		// 	}
		// 	else {
		// 		console.log('value--->> clearing validations for--> ', value)
		// 		this.BookingForm.get('lose_affiliate_name').clearValidators()
		// 		this.BookingForm.get('lose_affiliate_name').updateValueAndValidity()

		// 		this.BookingForm.get('lose_affiliate_phone').clearValidators()
		// 		this.BookingForm.get('lose_affiliate_phone').updateValueAndValidity()


		// 		this.BookingForm.get('lose_affiliate_email').clearValidators()
		// 		this.BookingForm.get('lose_affiliate_email').updateValueAndValidity()

		// 		console.log('clear validation')
		// 		this.init_rates = true;
		// 		if (this.Form.service_type.value === 'round_trip') {
		// 			this.init_return_rates = true;
		// 		}
		// 		this.fetchAffiliates('affiliate')
		// 		this.chooseAffiliate()
		// 	}
		// })

		// this.BookingForm.get('affiliate_id').valueChanges.subscribe((value: number) => {
		// 	if (value) {
		// 		this.chooseAffiliate()
		// 		this.fetchAffiliateInformation(value)
		// 		if (this.Form.updateType.value != 'edit' && this.Form.updateType.value != 'repeat' && this.Form.updateType.value != 'return') {
		// 			this.scroll('booking_detail_section')
		// 		}
		// 	}
		// })

		// this.BookingForm.get('vehicle_id').valueChanges.subscribe((value: any) =>
		// {
		// 	if (value && this.VehicleList)
		// 	{
		// 		let v = this.VehicleList.find(item => item.ID == value)
		// 		this.autofillData('vehicle', v);
		// 	}
		// })
		this.BookingForm.get('travel_client_id').valueChanges.subscribe((value: number) => {
			if (value && this.updateType == 'repeat' && this.updateType == 'return' && this.updateType == 'edit' && this.updateType == 'round') {
				this.handleTravelStaffAccounts({ id: value })
			}
		})
		this.BookingForm.get('travel_client_acc').valueChanges.subscribe((value: any) => {
			if (value == 'travel_loose_customer') {
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

				(<FormGroup>loose_customer.get('card_details')).get('card_number').setValidators([Validators.required, Validators.pattern("^[0-9+]*$"), , Validators.minLength(14), Validators.maxLength(20),]);
				(<FormGroup>loose_customer.get('card_details')).get('name').setValidators([Validators.required]);
				(<FormGroup>loose_customer.get('card_details')).get('cvv').setValidators([Validators.required, Validators.pattern("^[0-9+]*$")]);
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

		this.BookingForm.get('pickup_airport_option').valueChanges.subscribe((value: any) => {
			if (!value && this.BookingForm.get('pickup_airport')?.value) {
				this.clearAirportSelection('pickup_airport');
			}
		});

		this.BookingForm.get('dropoff_airport_option').valueChanges.subscribe((value: any) => {
			if (!value && this.BookingForm.get('dropoff_airport')?.value) {
				this.clearAirportSelection('dropoff_airport');
			}
		});

		this.BookingForm.get('return_pickup_airport_option').valueChanges.subscribe((value: any) => {
			if (!value && this.BookingForm.get('return_pickup_airport')?.value) {
				this.clearAirportSelection('return_pickup_airport');
			}
		});

		this.BookingForm.get('return_dropoff_airport_option').valueChanges.subscribe((value: any) => {
			if (!value && this.BookingForm.get('return_dropoff_airport')?.value) {
				this.clearAirportSelection('return_dropoff_airport');
			}
		});
		// Pickup Airport
		this.BookingForm.get('pickup_airport').valueChanges.subscribe((value: number) => {
			console.log("value in pickup_airport--->", value)
			if (value == 3283) {
				this.BookingForm.get('pickup_airline_option').clearValidators();
				this.BookingForm.get('pickup_airline_option').updateValueAndValidity();
				setTimeout(() => this.initAllAutocompletes(), 100);
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
				setTimeout(() => this.initAllAutocompletes(), 100);
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
			if (!value && (this.Form.pickup_latitude.value || this.Form.pickup_longitude.value)) {
				this.clearAddressState('pickup');
				return;
			}
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
			if (!value && (this.Form.dropoff_latitude.value || this.Form.dropoff_longitude.value)) {
				this.clearAddressState('dropoff');
				return;
			}
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

		this.BookingForm.get('return_pickup').valueChanges.subscribe((value: string) => {
			if (!value && (this.Form.return_pickup_latitude.value || this.Form.return_pickup_longitude.value)) {
				this.clearAddressState('return_pickup');
			}
		});

		this.BookingForm.get('return_dropoff').valueChanges.subscribe((value: string) => {
			if (!value && (this.Form.return_dropoff_latitude.value || this.Form.return_dropoff_longitude.value)) {
				this.clearAddressState('return_dropoff');
			}
		});

		this.BookingForm.get('sub_account_type').valueChanges.subscribe((value: string) => {
			if (value == 'sub_travel_agent') {
				this.BookingForm.get('sub_account_id').setValidators([Validators.required]);
				this.BookingForm.get('sub_account_id').updateValueAndValidity();
				this.TravelAgentService.getAllTravelClientAccountList('sub_travel').then((result: any) => {
					console.log("accounts->>>>>>>>>>", result)
					this.subAgentAccounts = result?.data
					this.subAgentAccounts_Original = result?.data ? [...result.data] : []
					console.log('in if sub ta----->', this.BookingForm?.get('sub_account_id').value == '')
					if (this.BookingForm?.get('sub_account_id').value == '') {
						this.BookingForm.patchValue({
							travel_client_id: ''
						})
					}
				})
					.catch(err => {
						this.$spinner.hide();//hide spinner
					});
				this.BookingForm.get('sub_account_id').valueChanges.subscribe((value: string) => {
					console.log('valueeeee->', value, this.newBooking)
					if (!this.newBooking) {
						if (value != this.bookingResponse?.sub_account_id) {
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
							this.$spinner.hide();//hide spinner
						});

				})
			}
			else {
				this.BookingForm.get('sub_account_id').clearValidators()
				this.BookingForm.get('sub_account_id').updateValueAndValidity();
				this.BookingForm.patchValue({
					sub_account_id: ''
				})
				this.getTravelClientAccounts()
			}

		})


	}
	getTravelClientAccounts() {
		this.TravelAgentService.getAllTravelClientAccountList('individual').then((result: any) => {
			console.log("accounts->>>>>>>>>>", result)
			this.travelStaffAccounts = result?.data
			this.travelStaffAccounts_Original = result?.data ? [...result.data] : []
			this.syncPrefilledTravelClientSelection();
		})
			.catch(err => {
				this.$spinner.hide();//hide spinner
			});
	}

	private syncPrefilledTravelClientSelection() {
		const currentTravelClientId = this.BookingForm?.get('travel_client_id')?.value;
		if (!currentTravelClientId || !this.travelStaffAccounts?.length) {
			return;
		}

		const matchedClient = this.travelStaffAccounts.find((client: any) => Number(client?.id) === Number(currentTravelClientId));
		if (matchedClient) {
			this.BookingForm.patchValue({
				travel_client_id: matchedClient.id
			}, { emitEvent: false });
		}
	}

	resetDriverAndVehicle(affiliate_type: string) {
		if (affiliate_type == 'loose_affiliate') {
			['vehicle_type', 'vehicle_id', 'vehicle_make', 'vehicle_model', 'vehicle_color', 'vehicle_year', 'driver_name', 'driver_email', 'driver_gender', 'driver_cell', 'vehicle_license_plate'].forEach((item: any) => {
				this.BookingForm.get(item).reset();
				this.BookingForm.updateValueAndValidity();
			})
			this.SetFormValue('driver_cell_isd', this.currentUser?.isd || '+1');
			this.SetFormValue('driver_cell_country', this.currentUser?.phoneCountry || 'us');
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
		this.number_of_hours = Number(data) || this.number_of_hours;
		this.BookingForm.get('number_of_hours').setValue(data)
		this.recalculateDisplayedRates();
	}


	createReservationShareArray() {
		const multiplyHours = this.number_of_hours >= 24 ? this.number_of_hours/24 : this.number_of_hours; 
		console.log('in function createReservationShareArray')
		if (this.rateArray) {
			console.log('in function createReservationShareArray iffffff', this.rateArray)
			let base_rate = 0
			if (this.BookingForm.value?.service_type == 'charter_tour' && !this.min_rate_involved) {
				base_rate += this.rateArray.all_inclusive_rates["Base_Rate"].baserate * multiplyHours;
			}
			else {
				base_rate += this.rateArray.all_inclusive_rates["Base_Rate"].baserate
			}
			['ELH_Charges', 'Stops', 'Wait'].map((key) => {
				base_rate += this.rateArray.all_inclusive_rates[key].baserate
			});
			for (const key of Object.keys(this.rateArray.amenities)) {
				base_rate += this.rateArray.amenities[key].baserate;
			}
			if (this.BookingForm?.get('number_of_vehicles').value > 1) {
				base_rate *= this.Form.number_of_vehicles.value
			}

			console.log("grand total", this.grandtotal)
			let grandTotal = this.grandtotal
			if (this.BookingForm?.get('number_of_vehicles').value > 1) {
				grandTotal = grandTotal * this.Form.number_of_vehicles.value
				console.log("changes in number of vehciles if ", grandTotal)
			}
			else {
				grandTotal = this.grandtotal
				console.log("changes in number of vehciles else ", grandTotal)
			}
			let stripeFee = grandTotal * 0.05 + 0.30
			let adminShare = (base_rate * this.adminSharePercent) / 100
			adminShare = adminShare + (this.BookingForm.value.rateArray.misc.Extra_Gratuity.amount * 0.25)
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
			if (this.updateType == 'repeat' || this.updateType == 'return' || this.updateType == 'round' || this.updateType == 'edit') {
				this.adminSharePercent = 15
				shareArray['adminShare'] = (base_rate * this.adminSharePercent) / 100
				shareArray['deducted_admin_share'] = shareArray['adminShare'] - shareArray['stripeFee']
				shareArray['travelAgentShare'] = base_rate * 0.10
			}
			this.shareArray = shareArray
			console.log('in function createReservationShareArray-->>>', base_rate, shareArray)

			return shareArray;

			// value['rateArray'] = JSON.parse(JSON.stringify(this.rateArray))
		}
	}


	createReservationReturnShareArray() {
		console.log('createReservationReturnShareArray', this.r_grandtotal)
		if (this.Form.service_type.value == 'round_trip' && this.returnRateArray) {

			let base_rate = 0
			for (const key of Object.keys(this.returnRateArray.all_inclusive_rates)) {
				base_rate += this.returnRateArray.all_inclusive_rates[key].baserate;
			}
			for (const key of Object.keys(this.returnRateArray.amenities)) {
				base_rate += this.returnRateArray.amenities[key].baserate;
			}
			if (this.BookingForm?.get('number_of_vehicles').value > 1) {
				base_rate *= this.Form.number_of_vehicles.value
			}

			let returnGrandTotal = this.r_grandtotal
			if (this.BookingForm?.get('number_of_vehicles').value > 1) {
				returnGrandTotal = returnGrandTotal * this.Form.number_of_vehicles.value
				console.log("changes in number of vehciles if ", returnGrandTotal)
			}
			else {
				returnGrandTotal = this.r_grandtotal
				console.log("changes in number of vehciles else ", returnGrandTotal)
			}
			let stripeFee = returnGrandTotal * 0.05 + 0.30
			let adminShare = (base_rate * this.adminSharePercent) / 100
			adminShare = adminShare + (this.BookingForm.value.returnRateArray.misc.Extra_Gratuity.amount * 0.25)
			let deducted_admin_share = adminShare - stripeFee
			let returnShareArray = {
				baseRate: base_rate,
				returnGrandTotal: returnGrandTotal,
				grandTotal: returnGrandTotal,
				deducted_admin_share: deducted_admin_share,
				stripeFee: stripeFee,
				adminShare: adminShare,
				affiliateShare: returnGrandTotal - adminShare
			}
			// travelAgentShare : 
			if (
				(this.BookingForm.value?.account_type == 'travel_planner' && this.BookingForm.value?.affiliate_type == 'affiliate')
				|| this.updateType == 'edit'
			) {
				returnShareArray['adminShare'] = (base_rate * this.adminSharePercent) / 100
				returnShareArray['deducted_admin_share'] = returnShareArray['adminShare'] - returnShareArray['stripeFee']
				returnShareArray['travelAgentShare'] = base_rate * 0.10
			}

			this.r_shareArray = returnShareArray
			// console.log('in function createReservationreturnShareArray-->>>' , base_rate, returnShareArray )
			return returnShareArray;
			// value['returnRateArray'] = JSON.parse(JSON.stringify(this.returnRateArray))
		}
	}

	submitForm(preview: boolean) {
		this.submitBookingForm = true
		console.log(this.BookingForm);
		console.log(this.BookingForm.status);

		// Force sync from visual widgets to ensure payload matches UI
		if (this.PaxTelObject) {
			const countryData = this.PaxTelObject.getSelectedCountryData();
			if (countryData?.dialCode) {
				this.SetFormValue('passenger_cell_isd', '+' + countryData.dialCode);
				this.SetFormValue('passenger_cell_country', countryData.iso2);
			}
		}

		if (this.LCTelObject) {
			const countryData = this.LCTelObject.getSelectedCountryData();
			if (countryData?.dialCode) {
				const lcGroup = this.BookingForm.get('loose_customer') as FormGroup;
				if (lcGroup) {
					lcGroup.patchValue({
						phone_isd: '+' + countryData.dialCode,
						phone_country: countryData.iso2
					});
				}
			}
		}

		if (this.DrvTelObject) {
			const countryData = this.DrvTelObject.getSelectedCountryData();
			if (countryData?.dialCode) {
				this.SetFormValue('driver_cell_isd', '+' + countryData.dialCode);
				this.SetFormValue('driver_cell_country', countryData.iso2);
			}
		} else {
			// Fallback if no widget exists (e.g. read-only driver cell)
			const dIsdCtrl = this.BookingForm.get('driver_cell_isd');
			if (dIsdCtrl && dIsdCtrl.value) {
				let val = String(dIsdCtrl.value);
				if (!val.startsWith('+')) {
					dIsdCtrl.setValue('+' + val);
				}
			}
		}

		// Sanitize loose_customer.phone
		const lcPhone = this.BookingForm.get('loose_customer.phone');
		const lcIsd = this.BookingForm.get('loose_customer.phone_isd');
		if (lcPhone && lcPhone.value && lcIsd && lcIsd.value) {
			const val = String(lcPhone.value);
			const isd = String(lcIsd.value);
			if (val.startsWith(isd)) {
				lcPhone.setValue(val.substring(isd.length));
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

		this.syncVisibleFieldPayloads();
		this.syncAirportPayloadFields();

		if (this.BookingForm.invalid) {
			console.log('[BOOKING FORM INVALID] Preview/submit blocked after validation.');
			this.logInvalidControls(this.BookingForm);
			return;
		}

		if (this.currentUser?.roleName == 'sub_travel_agent') {
			this.BookingForm.patchValue({
				acc_id: this.currentUser?.agency_id,
				sub_account_id: this.currentUser?.account_id,
				sub_account_type: 'sub_travel_agent'
			})
		}

		let value = this.BookingForm.value;
		['pickup_airport', 'dropoff_airport', 'return_pickup_airport', 'return_dropoff_airport'].forEach((field) => {
			if (!value[field]) {
				value[field] = value[`${field}_name`] || value[`${field}_option`] || '';
			}
		});
		value['currency'] = this.currencyObj?.currency
		value['platform_type'] = 'web'
		value['is_master_vehicle'] = this.is_master_vehicle
		value['proceed'] = this.proceed
		value['rateArray'] = this.rateArray
		value['grand_total'] = this.grandtotal * this.Form.number_of_vehicles.value
		value['sub_total'] = this.subtotal
		value['min_rate_involved'] = this.min_rate_involved
		value['shares_array'] = this.createReservationShareArray()
		delete value['rateArray']['grand_total']/*  */
		delete value['rateArray']['sub_total']
		delete value['rateArray']['min_rate_involved']
		// Return Rates Form
		if (this.Form.service_type.value == 'round_trip') {
			value['returnRateArray'] = this.returnRateArray
			value['return_grand_total'] = this.r_grandtotal * this.Form.number_of_vehicles.value
			value['return_sub_total'] = this.r_subtotal
			delete value['returnRateArray']['r_grandtotal']
			delete value['returnRateArray']['r_subtotal']
			value['return_shares_array'] = this.createReservationReturnShareArray()
		}

		if (preview) {
			this.$spinner.show()
			this.TravelAgentService.createBooking(value, this.Form.updateType.value).subscribe((response: any) => {
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
					this.$router.navigate([`/${this.currentUser?.roleName}/bookings`])
				}
			})
		}
		else {
			$('#previewBooking').modal('handleUpdate').modal('show')
		}
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
		this.BookingForm.updateValueAndValidity()
		this.validateLooseCustomerPhone();
	}
	LCTelInputObject(event: any) {
		this.LCTelObject = event;
	}
	LCTelInputObjectUSA(event: any) {
		event.setCountry('us');
	}

	LATelInputObject(event: any) {
		this.LATelObject = event;
	}
	DrvTelInputObject(event: any) {
		this.DrvTelObject = event;
		// Immediate sync for Driver Cell
		const countryData = this.DrvTelObject.getSelectedCountryData();
		if (countryData?.dialCode) {
			this.SetFormValue('driver_cell_isd', '+' + countryData.dialCode);
			this.SetFormValue('driver_cell_country', countryData.iso2);
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

	buildBookingData() {
		console.log('rebuild booking data --- Sushil', this.BookingForm.getRawValue())
		let booking_data = {
			vehicle_id: this.BookingForm.get('affiliate_type').value == "unassigned" ? this.BookingForm.get('vehicle_type').value : this.BookingForm.get('vehicle_id').value,
			transfer_type: this.BookingForm.get('transfer_type').value,
			service_type: this.BookingForm.get('service_type').value,
			numberOfVehicles: 1,
			distance: this.distance,
			return_distance: this.return_distance,
			no_of_hours: this.number_of_hours,
			is_master_vehicle: this.BookingForm.get('affiliate_type').value == "unassigned" ? true : this.is_master_vehicle,
			extra_stops: this.BookingForm.get('extra_stops').value,
			return_extra_stops: this.BookingForm.get('return_extra_stops').value,
			pickup_time: this.BookingForm.get('pickup_time').value,
			return_pickup_time: this.BookingForm.get('return_pickup_time').value,
			return_vehicle_id: this.BookingForm.get('vehicle_id').value,
			return_affiliate_type: this.BookingForm.get('affiliate_type').value,

		}

		// Check if booking_data has changed
		const bookingDataChanged = this.hasBookingDataChanged(booking_data);
		const isFirstTime = this.previousBookingData === null;
		const isDataComplete = this.isBookingDataComplete(booking_data);

		// On first time load: Only store data if it's complete, otherwise skip
		if (isFirstTime && (this.bookingType == 'edit' || this.bookingType == 'repeat')) {
			if (isDataComplete) {
				console.log('[buildBookingData] First time load with complete data - storing booking_data but NOT calculating rates');
				this.previousBookingData = JSON.parse(JSON.stringify(booking_data));
			} else {
				console.log('[buildBookingData] First time load with incomplete data - skipping (waiting for complete data)');
			}
			return;
		}

		// If no changes detected (and not first time), skip processing
		if (!bookingDataChanged) {
			console.log('[buildBookingData] No changes detected in booking_data. Skipping rate calculation.');
			return;
		}

		let vehicle_id = booking_data?.vehicle_id.toString().length ? booking_data?.vehicle_id : this.master_vehicle_id
		// booking_data['is_master_vehicle'] = booking_data?.vehicle_id.toString().length ? false : true
		this.$api.fetchRatesByAffiliateVeh(vehicle_id, booking_data).subscribe((response: any) => {
			if (this.Form.affiliate_type.value != 'loose_affiliate') {
				this.subtotal = 0
				this.r_subtotal = 0
				this.min_rate_involved = response?.data?.min_rate_involved
				this.rateArray = response?.data?.rateArray
				this.rateArray.all_inclusive_rates.Base_Rate.amount = response?.data?.rateArray?.all_inclusive_rates?.Base_Rate.amount
			}
			if (booking_data.service_type == 'round_trip') {
				this.returnRateArray = response?.data?.retrunRateArray
				this.returnRateArray.all_inclusive_rates.Base_Rate.amount = response?.data?.retrunRateArray?.all_inclusive_rates?.Base_Rate.amount
			}
			this.recalculateDisplayedRates();
			// Store current booking_data as previous for next comparison
			this.previousBookingData = JSON.parse(JSON.stringify(booking_data));
			console.log('[buildBookingData] Method completed successfully');
		}, (error: any) => {
			console.error('[buildBookingData] API error:', error);
		});
	}

	/**
	 * Compares current booking_data with previous booking_data to detect changes
	 * @param currentBookingData - The current booking data object
	 * @returns true if data has changed, false otherwise
	 */
	private hasBookingDataChanged(currentBookingData: any): boolean {
		// First call - no previous data, so consider it as changed
		if (this.previousBookingData === null) {
			console.log('[hasBookingDataChanged] First call - no previous data, considering as changed');
			return true;
		}

		// Deep comparison of booking_data objects
		const previous = this.previousBookingData;
		const current = currentBookingData;

		// Compare all properties
		const keysToCompare = [
			'vehicle_id',
			'transfer_type',
			'service_type',
			'numberOfVehicles',
			'distance',
			'return_distance',
			'no_of_hours',
			'is_master_vehicle',
			'extra_stops',
			'return_extra_stops',
			'return_vehicle_id',
			'return_affiliate_type'
		];

		for (const key of keysToCompare) {
			const previousValue = previous[key];
			const currentValue = current[key];

			// Deep comparison for arrays/objects (extra_stops, return_extra_stops)
			if (Array.isArray(previousValue) && Array.isArray(currentValue)) {
				if (JSON.stringify(previousValue) !== JSON.stringify(currentValue)) {
					console.log(`[hasBookingDataChanged] Change detected in ${key}:`, {
						previous: previousValue,
						current: currentValue
					});
					return true;
				}
			} else if (previousValue !== currentValue) {
				console.log(`[hasBookingDataChanged] Change detected in ${key}:`, {
					previous: previousValue,
					current: currentValue
				});
				return true;
			}
		}

		console.log('[hasBookingDataChanged] No changes detected');
		return false;
	}

	/**
	 * Checks if booking_data is complete/valid (not initial/incomplete state)
	 * @param bookingData - The booking data object to check
	 * @returns true if data is complete, false if incomplete/initial state
	 */
	private isBookingDataComplete(bookingData: any): boolean {
		// Check if vehicle_id is present and not empty
		const hasVehicleId = bookingData?.vehicle_id &&
			bookingData.vehicle_id !== '' &&
			bookingData.vehicle_id !== null &&
			bookingData.vehicle_id !== undefined;

		// Check if distance is set (greater than 0) - this indicates actual route calculation
		const hasDistance = bookingData?.distance !== undefined &&
			bookingData?.distance !== null &&
			bookingData?.distance > 0;

		// Check if service_type is valid (not empty or initial state)
		const hasServiceType = bookingData?.service_type &&
			bookingData.service_type !== '' &&
			bookingData.service_type !== null;

		const isComplete = hasVehicleId && hasDistance && hasServiceType;

		console.log('[isBookingDataComplete] Checking data completeness:', {
			hasVehicleId,
			hasDistance,
			hasDistanceValue: bookingData?.distance,
			hasServiceType,
			isComplete
		});

		return isComplete;
	}

	setValueByBookNow() {
		try {
			let QB: any = JSON.parse(localStorage.getItem('quotebot_form'))
			let selected_vehicle: any = JSON.parse(sessionStorage.getItem('selected_vehicle'))
			// for (const key in QB) {
			//   console.log(`QB______${key}: ${QB[key]}`);
			//   this.SetFormValue(key ,QB[key])
			// }    
			this.affiliate_id = selected_vehicle?.affiliate_id


			//dropOFF
			this.SetFormValue('service_type', QB?.service_type)
			this.service_type = QB?.service_type
			if (QB?.service_type == 'charter_tour') {
				this.SetFormValue('number_of_hours', QB?.booking_hour)
				this.number_of_hours = QB?.booking_hour
			}
			//set no of vehicles
			this.SetFormValue('number_of_vehicles', selected_vehicle?.number_of_vehicles)
			// this.vehicles = selected_vehicle?.number_of_vehicles
			let transfer_type_value = QB?.pickup_type + '_to_' + QB?.dropoff_type
			let return_transfer_type_value = (QB?.return_pickup_type || QB?.dropoff_type) + '_to_' + (QB?.return_dropoff_type || QB?.pickup_type)
			this.transfer_type = transfer_type_value
			this.return_transfer_type = return_transfer_type_value
			this.SetFormValue('transfer_type', transfer_type_value)
			this.SetFormValue('return_transfer_type', return_transfer_type_value)
			this.SetFormValue('total_passengers', QB?.no_of_luggage)
			this.SetFormValue('luggage_count', QB?.no_of_passenger)
			this.SetFormValue('affiliate_type', 'affiliate')
			this.SetFormValue('affiliate_id', this.affiliate_id)
			//vehicle id when chossing vehicle from Quote bot screen
			this.QB_vehicle_id = selected_vehicle?.id || null
			//pickup
			this.SetFormValue('pickup_date', moment(QB?.pickup_date).format('YYYY-MM-DD'))
			this.SetFormValue('pickup', QB?.pickup_address)
			this.SetFormValue('pickup_latitude', QB?.pickup_address_lat)
			this.SetFormValue('pickup_longitude', QB?.pickup_address_long)
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
			this.applyQuoteBotAirportPrefill(
				'pickup',
				QB?.other_details?.pickup_airport_name,
				QB?.pickup_airport_lat,
				QB?.pickup_airport_long,
				QB?.pickup_airport,
				matchedPickupAirport
			)
			this.SetFormValue('dropoff', QB?.dropoff_address)
			this.SetFormValue('dropoff_latitude', QB?.dropoff_address_lat)
			this.SetFormValue('dropoff_longitude', QB?.dropoff_address_long)
			this.applyQuoteBotAirportPrefill(
				'dropoff',
				QB?.other_details?.dropoff_airport_name,
				QB?.dropoff_airport_lat,
				QB?.dropoff_airport_long,
				QB?.dropoff_airport,
				matchedDropoffAirport
			)


			//return pickup
			this.SetFormValue('return_pickup_date', moment(QB?.return_pickup_date).format('YYYY-MM-DD'))
			this.SetFormValue('return_pickup', QB?.return_pickup_address ?? QB?.return_dropoff_address)
			this.SetFormValue('return_pickup_latitude', QB?.return_pickup_address_lat ?? QB?.return_dropoff_address_lat)
			this.SetFormValue('return_pickup_longitude', QB?.return_pickup_address_long ?? QB?.return_dropoff_address_long)
			this.applyQuoteBotAirportPrefill(
				'return_pickup',
				QB?.return_pickup_airport_name || QB?.other_details?.return_pickup_airport_name,
				QB?.return_pickup_airport_lat,
				QB?.return_pickup_airport_long,
				QB?.return_pickup_airport,
				matchedReturnPickupAirport
			)

			//return dropOff
			this.SetFormValue('return_dropoff', QB?.return_dropoff_address)
			this.SetFormValue('return_dropoff_latitude', QB?.return_dropoff_address_lat)
			this.SetFormValue('return_dropoff_longitude', QB?.return_dropoff_address_long)
			this.applyQuoteBotAirportPrefill(
				'return_dropoff',
				QB?.return_dropoff_airport_name || QB?.other_details?.return_dropoff_airport_name,
				QB?.return_dropoff_airport_lat,
				QB?.return_dropoff_airport_long,
				QB?.return_dropoff_airport,
				matchedReturnDropoffAirport
			)
			this.prefillExtraStops(QB?.extra_stops);
			this.prefillExtraStops(QB?.return_extra_stops, true);
			this.SetFormValue('pickup_time', this.FormatTime(QB?.pickup_time))
			this.SetFormValue('return_pickup_time', this.FormatTime(QB?.return_pickup_time))
			this.SetFormValue('cruise_time', this.FormatTime(QB?.pickup_time))
			this.SetFormValue('return_cruise_time', this.FormatTime(QB?.return_pickup_time))

			//driver information from selected vehicle
			this.SetFormValue('driver_id', selected_vehicle?.driverInformation?.id)
			this.SetFormValue('driver_name', selected_vehicle?.driverInformation?.name)
			this.SetFormValue('driver_email', selected_vehicle?.driverInformation?.email)
			this.SetFormValue('driver_cell', selected_vehicle?.driverInformation?.cell_number)
			let dIsd = selected_vehicle?.driverInformation?.cell_isd || '';
			let strDIsd = String(dIsd);
			if (strDIsd && !strDIsd.startsWith('+')) {
				strDIsd = '+' + strDIsd;
			}
			this.SetFormValue('driver_cell_isd', strDIsd)
			this.SetFormValue('driver_gender', selected_vehicle?.driverInformation?.gender)
			this.SetFormValue('vehicle_id', selected_vehicle?.id)

			// driver_cell_isd: ['+1'],
			// driver_cell_country: ['us'],

			if (QB?.pickup_type == 'airport') {
				let location = {
					latitude: QB?.pickup_airport_lat,
					longitude: QB?.pickup_airport_long
				}
				this.fillLocationPoints('airport', location)
			}
			this.syncAirportPayloadFields();
			this.MapController(this.transfer_type == 'round_trip' ? true : false)
			this.driverImgUrl = selected_vehicle?.driverInformation?.imageUrl || "../../../../assets/images/driverImg.jpg"
			this.vehicleImgUrl = selected_vehicle?.vehicle_images[0] || ""
			this.driver_info = selected_vehicle?.driverInformation || {}
			if (this.driver_info.cell_isd) {
				let val = String(this.driver_info.cell_isd);
				if (!val.startsWith('+')) {
					this.driver_info.cell_isd = '+' + val;
				}
			}
			this.driver_info['type'] = selected_vehicle?.name || ""
			this.driver_info['make'] = selected_vehicle?.vehicle_details?.make || ""
			this.driver_info['model'] = selected_vehicle?.vehicle_details?.model || ""
			this.driver_info['year'] = selected_vehicle?.vehicle_details?.year || ""
		} catch (error) {
			console.log('error---------->>>>>>>>>', error)
		}
		// setTimeout(() => {
		// 	console.log('settimeout finction---------------------------------------------------------------')
		// 	this.fetchQBAffiliateVehicles(selected_vehicle?.affiliate_id)
		// 	this.fetchAffiliateDrivers(this.affiliate_id)
		// }, 5000)
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

	navigatetoQuote() {
		// $("#repeatreturnmodal").modal("hide");
		this.$router.navigate(['/quotebot_section'])
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

	validatePhoneGeneric(control: any, telInputObject: any) {
		if (telInputObject) {
			const value = control.value;
			if (!value) {
				if (control.errors) {
					const { invalidIntl, ...otherErrors } = control.errors;
					control.setErrors(Object.keys(otherErrors).length > 0 ? otherErrors : null);
				}
				return;
			}
			// setTimeout(() => {
			const isValid = telInputObject.isValidNumber();
			if (!isValid) {
				const errorCode = telInputObject.getValidationError();
				const errorMsg = ["Invalid phone number", "Invalid country code", "Invalid phone number", "Invalid phone number", "Invalid phone number"][errorCode] || "Invalid phone number";
				const currentErrors = control.errors || {};
				control.setErrors({ ...currentErrors, 'invalidIntl': errorMsg });
			} else {
				if (control.errors) {
					const { invalidIntl, ...otherErrors } = control.errors;
					control.setErrors(Object.keys(otherErrors).length > 0 ? otherErrors : null);
				}
			}
			// }, 100);
		}
	}

	validateLooseCustomerPhone() {
		this.validatePhoneGeneric(this.BookingForm.get('loose_customer').get('phone'), this.LCTelObject);
	}

	validatePassengerCell() {
		this.validatePhoneGeneric(this.BookingForm.get('passenger_cell'), this.PaxTelObject);
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

	handleSubAgentSearch(event) {
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

	handleTravelStaffSearch(event) {
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
}
