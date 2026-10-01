import { Component, OnInit, ViewChild, ElementRef, NgZone, AfterViewInit } from '@angular/core';
import { AdminService } from '../../../services/admin.service';
import { FormGroup, FormBuilder, Validators, FormArray, FormControl } from '@angular/forms';
import { FormValidators } from 'src/app/utils/form-validators';
import { Router, ActivatedRoute } from '@angular/router';
import { NgxSpinnerService } from "ngx-spinner";
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { CustomvalidationService } from '../../../services/customvalidation.service';
import { HttpClient } from '@angular/common/http';
import * as intlTelInput from 'intl-tel-input';
import { ErrorDialogService } from 'src/app/services/error-dialog/errordialog.service';
import { CommonService } from '../../../services/common.service';
import * as moment from "moment";
import { MomentDateAdapter, MAT_MOMENT_DATE_ADAPTER_OPTIONS } from '@angular/material-moment-adapter';
import { DateAdapter, MAT_DATE_FORMATS, MAT_DATE_LOCALE } from '@angular/material/core';

declare var $: any;

export const MY_FORMATS = {
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

@Component({
	selector: 'app-add-travel-planner-account',
	templateUrl: './add-travel-planner-account.component.html',
	styleUrls: ['./add-travel-planner-account.component.scss'],
	providers: [
		{
			provide: DateAdapter,
			useClass: MomentDateAdapter,
			deps: [MAT_DATE_LOCALE, MAT_MOMENT_DATE_ADAPTER_OPTIONS],
		},
		{ provide: MAT_DATE_FORMATS, useValue: MY_FORMATS },
	],
})
export class AddTravelPlannerAccountComponent implements OnInit, AfterViewInit {
	@ViewChild('search1') search1!: ElementRef;
	@ViewChild('officeInput') officeInput!: ElementRef;
	@ViewChild('mobileInput') mobileInput!: ElementRef;
	@ViewChild('faxInput') faxInput!: ElementRef;
	@ViewChild('officeNumberInput') officeNumberInput!: ElementRef;


	public addTravelPlannerAccountForm: FormGroup;
	public submittedForm: boolean;
	confirmedAddress = ''; // last address picked from suggestions or loaded from the server
	public disableSubmitButton: boolean = false;
	public response: any;
	public yearOptions: any = [];
	public OfficeObject: any;
	public MobileObject: any;
	public FaxObject: any;
	public OfficePhoneObject: any;
	travelPlannerId: any = null;
	public countryCodeName: any = "United States";
	countryOptions: any;
	stateOptions: any;
	currentUser: any;


	constructor(
		private adminService: AdminService,
		private router: Router,
		private spinner: NgxSpinnerService,
		private formBuilder: FormBuilder,
		private activatedroute: ActivatedRoute,
		private ngZone: NgZone,
		private customValidator: CustomvalidationService,
		private httpClient: HttpClient,
		private errors: ErrorDialogService,
		private commonServices: CommonService
	) { }


	//google map autocomplete
	title: string = 'AGM project';
	latitude: number;
	longitude: number;
	zoom: number;
	address: string;
	geoCoder!: google.maps.Geocoder;
	activeAddressDropdown: boolean = false;
	addressOptions: any[] = [];
	addressSearchLoading: boolean = false;
	private customPlacesService: google.maps.places.PlacesService | null = null;
	private addressSearchVersion = 0;
	private savedAddress: string = '';

	ngOnInit(): void {
		const currentYear = (new Date()).getFullYear();
		for (let i = 0; i < 40; i++) {
			this.yearOptions.push(currentYear + i);
		}
		this.httpClient.get("assets/json/countryStateList.json").subscribe(data => {
			this.countryOptions = data;
		})

		//add amenity form validation
		this.buildTravelAgentForm()
		/* Card Number Spacing */

		$('#card-number').on('keypress change blur', function () {
			$(this).val(function (index, value) {
				return value.replace(/[^a-z0-9]+/gi, '').replace(/(.{4})/g, '$1 ');
			});
		});

		$('#card-number').on('copy cut paste', function () {
			setTimeout(function () {
				$('#card-number').trigger("change");
			});
		});

		this.activatedroute.queryParams.subscribe((params: any) => {
			if (params.travelPlannerId) {
				this.travelPlannerId = params.travelPlannerId
				localStorage.setItem('travelAgent_id', this.travelPlannerId)
				this.addTravelPlannerAccountForm.patchValue({
					acc_id: this.travelPlannerId
				})
				this.getTravelAgentData()
			}
			else if (localStorage.getItem('travelAgent_id')) {
				this.travelPlannerId = localStorage.getItem('travelAgent_id')
				this.addTravelPlannerAccountForm.patchValue({
					acc_id: this.travelPlannerId
				})
				this.getTravelAgentData()
			}
		})

		this.currentUser = JSON.parse(localStorage.getItem('currentUser'));

	}

	buildTravelAgentForm() {
		this.addTravelPlannerAccountForm = this.formBuilder.group({
			id: [''],//travelPlanner
			acc_id: [''],
			role: ['3', [Validators.required, Validators.pattern("^[0-9].*$")]],//travelPlanner
			firstName: ['', [Validators.required, FormValidators.name()]],
			middleName: ['', [FormValidators.name()]],
			lastName: ['', [Validators.required, FormValidators.name()]],
			office: ['', [Validators.pattern("^[0-9+]*$"), Validators.minLength(4), Validators.maxLength(15), FormValidators.phone()]],
			officeIsd: ['+1', Validators.required],
			officeCountry: ['us'],
			mobile: ['', [Validators.required, Validators.pattern("^[0-9+]*$"), Validators.minLength(4), Validators.maxLength(15), FormValidators.phone()]],
			mobileIsd: ['+1', Validators.required],
			mobileCountry: ['us'],
			email: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i), Validators.maxLength(100)]],
			address: ['', [Validators.required, FormValidators.address(), FormValidators.addressSelected(() => this.confirmedAddress)]],
			city: [''],
			state: [''],
			country: ['', Validators.required],
			zipCode: ['', [Validators.required, FormValidators.zip()]],
			agencyName: ['', [Validators.required, FormValidators.organization()]],
			payee: ['', [Validators.required, FormValidators.organization()]],
			iata: ['', [Validators.required, FormValidators.iata()]],
			fax: ['', [Validators.pattern("^[0-9+]*$"), Validators.minLength(4), Validators.maxLength(15), FormValidators.phone()]],
			faxIsd: ['+1', Validators.required],
			faxCountry: ['us'],
			officeNumber: ['', [Validators.required, Validators.pattern("^[0-9+]*$"), Validators.minLength(4), Validators.maxLength(15), FormValidators.phone()]],
			isd_office_number: ['+1', Validators.required],
			office_country_code: ['us'],
			latitude: [''],
			longitude: [''],
			card_type: ['personal', Validators.required],
			number: ['', [Validators.pattern("^[0-9\\s]*$"), Validators.minLength(14), Validators.maxLength(20), this.customValidator.dashValidator(), this.customValidator.plusValidator()]],
			cvc: ['', [Validators.pattern("^[0-9]*$"), Validators.minLength(3), Validators.maxLength(4), this.customValidator.dashValidator(), this.customValidator.plusValidator()]],
			exp_month: [''],
			exp_year: [''],
			name: ['', [FormValidators.name()]],
		});
	}

	ngAfterViewInit(): void {

		this.initallphonefields()

		this.geoCoder = new google.maps.Geocoder();
	}

	private getGoogleMapsApiKey(): string {
		const script = Array.from(document.querySelectorAll('script[src]')).find((item) =>
			item.getAttribute('src')?.includes('maps.googleapis.com/maps/api/js')
		);
		const src = script?.getAttribute('src') || '';
		try {
			return new URL(src).searchParams.get('key') || '';
		} catch {
			return '';
		}
	}

	private getCustomPlacesService(): google.maps.places.PlacesService | null {
		if (this.customPlacesService) {
			return this.customPlacesService;
		}
		if (!(window as any)?.google?.maps?.places?.PlacesService) {
			return null;
		}
		const container = document.createElement('div');
		container.style.display = 'none';
		document.body.appendChild(container);
		this.customPlacesService = new google.maps.places.PlacesService(container);
		return this.customPlacesService;
	}

	private getPredictionTextValue(value: any): string {
		if (!value) return '';
		if (typeof value === 'string') return value;
		return value?.text || value?.plainText || value?.stringValue || value?.text?.text || '';
	}

	private searchGooglePredictions(searchText: string): Promise<Array<any>> {
		const apiKey = this.getGoogleMapsApiKey();
		if (!apiKey || !String(searchText || '').trim()) {
			return Promise.resolve([]);
		}

		return fetch('https://places.googleapis.com/v1/places:autocomplete', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-Goog-Api-Key': apiKey,
				'X-Goog-FieldMask': 'suggestions.placePrediction.placeId,suggestions.placePrediction.text.text,suggestions.placePrediction.structuredFormat.mainText.text,suggestions.placePrediction.structuredFormat.secondaryText.text'
			},
			body: JSON.stringify({
				input: searchText,
				includeQueryPredictions: false,
				languageCode: 'en-US'
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

	private fetchPlaceDetails(placeId: string): Promise<google.maps.places.PlaceResult | null> {
		const service = this.getCustomPlacesService();
		if (!service || !placeId) {
			return Promise.resolve(null);
		}
		return new Promise((resolve) => {
			service.getDetails({
				placeId,
				fields: ['formatted_address', 'geometry', 'place_id', 'name', 'address_components', 'types']
			}, (place, status) => {
				if (status !== google.maps.places.PlacesServiceStatus.OK || !place) {
					resolve(null);
					return;
				}
				resolve(place);
			});
		});
	}

	private applySelectedAddress(place: google.maps.places.PlaceResult): void {
		if (!place.geometry?.location) return;
		const formattedAddress = place.formatted_address ?? '';
		const placeName = place.name ?? '';
		const displayAddress = placeName ? `${placeName} - ${formattedAddress}` : formattedAddress;
		this.confirmedAddress = displayAddress;
		const patch: any = {
			latitude: place.geometry.location.lat(),
			longitude: place.geometry.location.lng(),
			address: displayAddress,
			country: '',
			state: '',
			city: '',
			zipCode: ''
		};

		place.address_components?.forEach((component) => {
			const types = component.types || [];
			if (types.includes('country')) {
				patch.country = component.short_name;
			} else if (types.includes('administrative_area_level_1')) {
				patch.state = component.short_name;
			} else if (types.includes('locality') || types.includes('postal_town') || types.includes('administrative_area_level_3')) {
				if (!patch.city) patch.city = component.long_name;
			} else if (types.includes('postal_code')) {
				patch.zipCode = component.long_name;
			}
		});

		this.addTravelPlannerAccountForm.patchValue(patch);
		if (patch.country) {
			this.changeCountry(patch.country);
		}
		this.addTravelPlannerAccountForm.updateValueAndValidity();
	}

	initallphonefields() {
		const userCountry = this.currentUser?.phoneCountry || this.currentUser?.country || 'auto';
		const telOptions: any = this.commonServices.getTelInputOptions(userCountry);



		if (this.officeInput) {
			console.log('onput', this.officeInput, this.officeInput.nativeElement)
			this.OfficeObject = intlTelInput(this.officeInput.nativeElement, telOptions);

			this.addCustomCountrySearch(this.officeInput.nativeElement);
			this.officeInput.nativeElement.addEventListener('countrychange', () => {
				const countryData = this.OfficeObject.getSelectedCountryData();
				console.log("in change", countryData)
				this.onCountryChange(countryData, 'office')
			});
		}

		if (this.mobileInput) {
			console.log('onput', this.mobileInput, this.mobileInput.nativeElement)
			this.MobileObject = intlTelInput(this.mobileInput.nativeElement, telOptions);

			this.addCustomCountrySearch(this.mobileInput.nativeElement);
			this.mobileInput.nativeElement.addEventListener('countrychange', () => {
				const countryData = this.MobileObject.getSelectedCountryData();
				console.log("in change", countryData)
				this.onCountryChange(countryData, 'mobile');
			});
		}

		if (this.faxInput) {
			console.log('onput', this.faxInput, this.faxInput.nativeElement)
			this.FaxObject = intlTelInput(this.faxInput.nativeElement, telOptions);

			this.addCustomCountrySearch(this.faxInput.nativeElement);
			this.faxInput.nativeElement.addEventListener('countrychange', () => {
				const countryData = this.FaxObject.getSelectedCountryData();
				console.log("in change", countryData)
				this.onCountryChange(countryData, 'fax')
			});
		}

		if (this.officeNumberInput) {
			console.log('onput', this.officeNumberInput, this.officeNumberInput.nativeElement)
			this.OfficePhoneObject = intlTelInput(this.officeNumberInput.nativeElement, telOptions);

			this.addCustomCountrySearch(this.officeNumberInput.nativeElement);
			this.officeNumberInput.nativeElement.addEventListener('countrychange', () => {
				const countryData = this.OfficePhoneObject.getSelectedCountryData();
				console.log("in change", countryData)
				this.onCountryChange(countryData, 'officeNumber')
			});
		}


	}


	changeCountry(selectedCountryCode) {
		let selectedCountryData: any;

		selectedCountryData = this.countryOptions.filter(function (countryOption) {
			return countryOption.countryShortCode == selectedCountryCode;
		});
		if (selectedCountryData) {
			this.stateOptions = selectedCountryData[0].regions;
		}
	}

	telInputObjectOffice(obj) {
		this.OfficeObject = obj;
	}
	telInputObjectMobile(obj) {
		this.MobileObject = obj;
	}
	telInputObjectFax(obj) {
		this.FaxObject = obj;
	}
	telInputObjectOfficePhone(obj) {
		this.OfficePhoneObject = obj;
	}
	onCountryChange(event, type) {
		if (type == 'mobile') {
			console.log("11111", event)
			this.addTravelPlannerAccountForm.patchValue({
				mobileIsd: '+' + event.dialCode,
				mobileCountry: event.iso2
			});
			this.countryCodeName = event.name?.split('(')[0].trim()
			this.validateMobile();
		}
		else if (type == 'office') {
			console.log("222222")
			this.addTravelPlannerAccountForm.patchValue({
				officeIsd: '+' + event.dialCode,
				officeCountry: event.iso2
			});
			this.validateOffice();
		}
		else if (type == 'officeNumber') {
			console.log("333333")
			this.addTravelPlannerAccountForm.patchValue({
				isd_office_number: '+' + event.dialCode,
				office_country_code: event.iso2
			});
			this.validateOfficeNumber();
		}
		else {
			console.log("4444444")
			this.addTravelPlannerAccountForm.patchValue({
				faxIsd: '+' + event.dialCode,
				faxCountry: event.iso2
			});
			this.validateFax();
		}
		// console.log(this.countryCode);
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
		}
	}

	clearAddressField(): void {
		this.addTravelPlannerAccountForm.patchValue({
			address: '',
			city: '',
			state: '',
			country: '',
			zipCode: '',
			latitude: '',
			longitude: ''
		});
		this.addTravelPlannerAccountForm.updateValueAndValidity();
		this.addressOptions = [];
		this.addressSearchLoading = false;
		this.activeAddressDropdown = false;
	}

	onAddressFocus(input?: HTMLInputElement): void {
		input?.select();
		this.activeAddressDropdown = true;
		void this.searchAddressOptions(this.addTravelPlannerAccountForm.get('address')?.value || '');
	}

	onAddressBlur(): void {
		setTimeout(() => {
			this.activeAddressDropdown = false;
		}, 150);
	}

	onAddressInput(value: string): void {
		this.addTravelPlannerAccountForm.patchValue({
			address: value || '',
			latitude: '',
			longitude: ''
		}, { emitEvent: false });
		this.addTravelPlannerAccountForm.get('latitude')?.updateValueAndValidity({ emitEvent: false });
		this.addTravelPlannerAccountForm.get('longitude')?.updateValueAndValidity({ emitEvent: false });
		this.activeAddressDropdown = true;
		void this.searchAddressOptions(value || '');
	}

	getAddressOptionLabel(option: any): string {
		return String(option?.name || option?.description || '').trim();
	}

	getAddressOptionSecondary(option: any): string {
		return String(option?.secondaryText || '').trim();
	}

	shouldShowAddressPrompt(): boolean {
		return this.activeAddressDropdown && !String(this.addTravelPlannerAccountForm.get('address')?.value || '').trim() && !this.addressSearchLoading;
	}

	shouldShowAddressEmpty(): boolean {
		return this.activeAddressDropdown && !!String(this.addTravelPlannerAccountForm.get('address')?.value || '').trim() && !this.addressSearchLoading && !this.addressOptions.length;
	}

	private async searchAddressOptions(value: string): Promise<void> {
		const requestVersion = ++this.addressSearchVersion;
		const searchText = String(value || '').trim();
		if (!searchText) {
			if (requestVersion === this.addressSearchVersion) {
				this.addressSearchLoading = false;
				this.addressOptions = [];
			}
			return;
		}

		this.addressSearchLoading = true;
		const options = await this.searchGooglePredictions(searchText);
		if (requestVersion === this.addressSearchVersion) {
			this.addressOptions = options;
			this.addressSearchLoading = false;
		}
	}

	async selectAddressOption(option: any): Promise<void> {
		const place = await this.fetchPlaceDetails(option?.placeId);
		this.ngZone.run(() => {
			if (place) {
				this.applySelectedAddress(place);
			}
			this.activeAddressDropdown = false;
		});
	}

	validateOffice() {
		this.validatePhoneGeneric(this.f.office, this.OfficeObject);
	}

	validateMobile() {
		this.validatePhoneGeneric(this.f.mobile, this.MobileObject);
	}

	validateFax() {
		this.validatePhoneGeneric(this.f.fax, this.FaxObject);
	}

	validateOfficeNumber() {
		this.validatePhoneGeneric(this.f.officeNumber, this.OfficePhoneObject);
	}

	get f() {
		return this.addTravelPlannerAccountForm.controls;
	}

	getTravelAgentData() {
		console.log("In GET travel planner details")
		this.adminService.getTravelPlannerAccount(this.travelPlannerId)
			.pipe(
				catchError(err => {
					this.spinner.hide();//hide spinner
					return throwError(err);
				})
			).subscribe(result => {
				this.response = result;

				this.confirmedAddress = this.response?.data?.Address || '';
				this.addTravelPlannerAccountForm.patchValue({
					id: this.travelPlannerId,
					firstName: this.response?.data?.first_name,
					middleName: this.response?.data?.middle_name,
					lastName: this.response?.data?.last_name,
					mobile: this.response?.data?.mobile,
					mobileIsd: '+1',
					office: this.response?.data?.office,
					officeIsd: '+1',
					officeNumber: this.response?.data?.officeNumber,
					isd_office_number: '+1',
					agencyName: this.response?.data?.agency_name,
					payee: this.response?.data?.payee,
					iata: this.response?.data?.iata,
					fax: this.response?.data?.fax,
					faxIsd: '+1',
					email: this.response?.data?.email,
					address: this.response?.data?.Address,
					city: this.response?.data?.city,
					state: this.response?.data?.state,
					country: this.response?.data?.country,
					zipCode: this.response?.data?.zipCode,
					companyName: this.response?.data?.company_name,
					department: this.response?.data?.department,
					businessDescription: this.response?.data?.zip,
					latitude: this.response?.data?.latitude ?? '',
					longitude: this.response?.data?.longitude ?? '',
				});
				// remember the stored address so an untouched one isn't asked to be re-picked from the dropdown
				this.savedAddress = String(this.response?.data?.Address || '').trim();
				this.spinner.hide();//hide spinner
				this.MobileObject.setCountry(this.response?.data?.mobileCountry);
				this.OfficeObject.setCountry(this.response?.data?.officeCountry);
				this.OfficePhoneObject.setCountry(this.response?.data?.office_country_code);
				this.FaxObject.setCountry(this.response?.data?.faxCountry);
				this.httpClient
					.get("assets/json/countryCodeWithIsd.json")
					.subscribe((data: any) => {
						// this.countryCodeName = data;
						console.log("country code--->", this.countryCodeName)
						let selectedCountryObj = data.find(i => i.code.toLowerCase() == this.response?.data?.mobileCountry)
						this.countryCodeName = selectedCountryObj.name
					});
			});
	}

	submitForm() {
		console.log(this.addTravelPlannerAccountForm);
		// console.log(JSON.stringify(this.addVehicleRatesForm.value));
		this.submittedForm = true;

		// Sync Mobile Country Data
		if (this.MobileObject) {
			const countryData = this.MobileObject.getSelectedCountryData();
			if (countryData && countryData.dialCode) {
				this.addTravelPlannerAccountForm.patchValue({
					mobileIsd: '+' + countryData.dialCode,
					mobileCountry: countryData.iso2
				});
			}
		}

		// Sync Office Country Data
		if (this.OfficeObject) {
			const countryData = this.OfficeObject.getSelectedCountryData();
			if (countryData && countryData.dialCode) {
				this.addTravelPlannerAccountForm.patchValue({
					officeIsd: '+' + countryData.dialCode,
					officeCountry: countryData.iso2
				});
			}
		}

		// Sync Fax Country Data
		if (this.FaxObject) {
			const countryData = this.FaxObject.getSelectedCountryData();
			if (countryData && countryData.dialCode) {
				this.addTravelPlannerAccountForm.patchValue({
					faxIsd: '+' + countryData.dialCode,
					faxCountry: countryData.iso2
				});
			}
		}

		// Sync OfficeNumber Country Data
		if (this.OfficePhoneObject) {
			const countryData = this.OfficePhoneObject.getSelectedCountryData();
			if (countryData && countryData.dialCode) {
				this.addTravelPlannerAccountForm.patchValue({
					isd_office_number: '+' + countryData.dialCode,
					office_country_code: countryData.iso2
				});
			}
		}

		// stop here if form is invalid
		if (this.addTravelPlannerAccountForm.invalid) {
			return;
		}

		// Sanitize office (remove Country Code if present)
		if (this.addTravelPlannerAccountForm.value.office && this.addTravelPlannerAccountForm.value.officeIsd && this.addTravelPlannerAccountForm.value.office.startsWith(this.addTravelPlannerAccountForm.value.officeIsd)) {
			this.addTravelPlannerAccountForm.value.office = this.addTravelPlannerAccountForm.value.office.substring(this.addTravelPlannerAccountForm.value.officeIsd.length);
		}

		// Sanitize fax (remove Country Code if present)
		if (this.addTravelPlannerAccountForm.value.fax && this.addTravelPlannerAccountForm.value.faxIsd && this.addTravelPlannerAccountForm.value.fax.startsWith(this.addTravelPlannerAccountForm.value.faxIsd)) {
			this.addTravelPlannerAccountForm.value.fax = this.addTravelPlannerAccountForm.value.fax.substring(this.addTravelPlannerAccountForm.value.faxIsd.length);
		}

		// Sanitize mobile (remove Country Code if present)
		if (this.addTravelPlannerAccountForm.value.mobile && this.addTravelPlannerAccountForm.value.mobileIsd && this.addTravelPlannerAccountForm.value.mobile.startsWith(this.addTravelPlannerAccountForm.value.mobileIsd)) {
			this.addTravelPlannerAccountForm.value.mobile = this.addTravelPlannerAccountForm.value.mobile.substring(this.addTravelPlannerAccountForm.value.mobileIsd.length);
		}


		const currentAddress = String(this.addTravelPlannerAccountForm.get('address').value || '').trim();
		const addressUnchanged = !!this.savedAddress && currentAddress === this.savedAddress;

		if (currentAddress != '' && !addressUnchanged && this.addTravelPlannerAccountForm.get('latitude').value == '') {
			this.errors.openDialog({
				errors: {
					error: `<spanclass="text-danger font-weight-bolder text-xl">Please choose the correct address from the dropdown.</span>`
				}
			})
			return;
		}

		console.log(this.addTravelPlannerAccountForm.value);
		// console.log(JSON.stringify(this.addVehicleRatesForm.value));
		this.spinner.show();
		this.disableSubmitButton = true; //disable submit button

		this.adminService.addTravelPlannerAccount(this.addTravelPlannerAccountForm.value, this.travelPlannerId)
			.pipe(
				catchError(err => {
					this.spinner.hide();//hide spinner
					this.disableSubmitButton = false; //enable submit button
					return throwError(err);
				})
			)
			.subscribe(result => {
				this.response = result;
				this.spinner.hide();//hide spinner
				this.disableSubmitButton = false; //enable submit button
				console.log("this.response?.data?.id", this.response)
				localStorage.setItem('travelAgent_id', this.response?.data?.id)
				this.router.navigateByUrl('/admin/travel-planner-account/step2').then(() => {
					window.location.reload();
				});
				// this.router.navigate(['/admin/travel-planner-account/step2']);
			});
	}

	resetForm() {
		const keepValues = [
			this.addTravelPlannerAccountForm.controls.mobile.value,
			this.addTravelPlannerAccountForm.controls.id.value,
			this.addTravelPlannerAccountForm.controls.acc_id.value,
			this.addTravelPlannerAccountForm.controls.mobileIsd.value,
			this.addTravelPlannerAccountForm.controls.mobileCountry.value

		];


		// this.addTravelPlannerAccountForm.reset();
		this.buildTravelAgentForm();
		this.addTravelPlannerAccountForm.controls.mobile.patchValue(keepValues[0]);
		this.addTravelPlannerAccountForm.controls.id.patchValue(keepValues[1]);
		this.addTravelPlannerAccountForm.controls.acc_id.patchValue(keepValues[2]);
		this.addTravelPlannerAccountForm.controls.mobileIsd.patchValue(keepValues[3]);
		this.addTravelPlannerAccountForm.controls.mobileCountry.patchValue(keepValues[4]);

		window.scrollTo({ top: 0, behavior: 'smooth' });
	}
	backButton() {
		this.router.navigate(['/admin/travel-planner-account-admin']);
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

	// Month-Year Picker Logic
	expiryDateControl = new FormControl(moment());

	chosenYearHandler(normalizedYear: moment.Moment) {
		const ctrlValue = this.expiryDateControl.value || moment();
		ctrlValue.year(normalizedYear.year());
		this.expiryDateControl.setValue(ctrlValue);
	}

	chosenMonthHandler(normalizedMonth: moment.Moment, datepicker: any) {
		const ctrlValue = this.expiryDateControl.value || moment();
		ctrlValue.month(normalizedMonth.month());
		ctrlValue.year(normalizedMonth.year());
		this.expiryDateControl.setValue(ctrlValue);

		// Patch Form Values
		const monthStr = (normalizedMonth.month() + 1).toString().padStart(2, '0');
		const yearStr = normalizedMonth.year();

		this.addTravelPlannerAccountForm.patchValue({
			exp_month: monthStr,
			exp_year: yearStr
		});

		// Mark as dirty/touched for validation display
		this.addTravelPlannerAccountForm.get('exp_month').markAsDirty();
		this.addTravelPlannerAccountForm.get('exp_year').markAsDirty();

		datepicker.close();
	}
}
