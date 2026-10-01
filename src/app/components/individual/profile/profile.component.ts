import { Component, OnInit, ViewChild, ElementRef, NgZone, AfterViewInit } from '@angular/core';
import { AdminService } from '../../../services/admin.service';
import { IndividualService } from '../../../services/individual.service';
import { FormGroup, FormBuilder, Validators, FormArray, FormControl } from '@angular/forms';
import { FormValidators } from 'src/app/utils/form-validators';
import { Router, ActivatedRoute } from '@angular/router';
import { NgxSpinnerService } from "ngx-spinner";
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { CustomvalidationService } from '../../../services/customvalidation.service';
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
	selector: 'app-profile',
	templateUrl: './profile.component.html',
	styleUrls: ['./profile.component.scss'],
	providers: [
		{
			provide: DateAdapter,
			useClass: MomentDateAdapter,
			deps: [MAT_DATE_LOCALE, MAT_MOMENT_DATE_ADAPTER_OPTIONS],
		},
		{ provide: MAT_DATE_FORMATS, useValue: MY_FORMATS },
	],
})
export class ProfileComponent implements OnInit, AfterViewInit {
	@ViewChild('search1') search1!: ElementRef;
	geoCoder!: google.maps.Geocoder;
	@ViewChild('mobileInput') mobileInput!: ElementRef;
	@ViewChild('workInput') workInput!: ElementRef;

	public addIndividualAccountForm: FormGroup;
	public submittedForm: boolean;
	confirmedAddress = ''; // last address picked from suggestions or loaded from the server
	public disableSubmitButton: boolean = false;
	public response: any;
	public cardDetails: any;
	public yearOptions: any = [];
	public MobileObject: any;
	public WorkObject: any;
	cardToDelete: any;
	alertMessage: string;
	currentUser: any;
	defaultCountryCode: string;
	is_family_member: any = false;

	constructor(
		private adminService: AdminService,
		private router: Router,
		private spinner: NgxSpinnerService,
		private formBuilder: FormBuilder,
		private activatedroute: ActivatedRoute,
		private ngZone: NgZone,
		private customValidator: CustomvalidationService,
		private individualService: IndividualService,
		private errors: ErrorDialogService,
		private commonServices: CommonService
	) { }


	//google map autocomplete
	title: string = 'AGM project';
	latitude: number;
	longitude: number;
	zoom: number;
	address: string;
	activeAddressDropdown: boolean = false;
	addressOptions: any[] = [];
	addressSearchLoading: boolean = false;
	private customPlacesService: google.maps.places.PlacesService | null = null;
	private addressSearchVersion = 0;

	ngOnInit(): void {
		this.currentUser = JSON.parse(localStorage.getItem('currentUser'))
		this.buildAddIndividualForm();

		const currentYear = (new Date()).getFullYear();
		for (let i = 0; i < 40; i++) {
			this.yearOptions.push(currentYear + i);
		}
		if (this.currentUser?.is_profile_complete) {
			this.getProfile()
		}
		else {
			this.addIndividualAccountForm.patchValue({
				mobile: this.currentUser?.phone,
				mobileIsd: this.currentUser?.isd,
				mobileCountry: this.currentUser?.phoneCountry
			})
			this.defaultCountryCode = this.currentUser?.phoneCountry
		}

		this.is_family_member = localStorage.getItem("is_family_member") ? localStorage.getItem("is_family_member") : false
		console.log("is_family_member", this.is_family_member)



		//add amenity form validation

		/* Card Number Spacing */

		$('#card-number').on('keypress change blur', function () {
			$(this).val(function (index, value) {
				return value.replace(/[^a-z0-9]+/gi, '')
				// .replace(/(.{4})/g, '$1 ')
			});
		});

		$('#card-number').on('copy cut paste', function () {
			setTimeout(function () {
				$('#card-number').trigger("change");
			});
		});
	}


	ngAfterViewInit() {

		this.initallphonefields()

		//google map autocomplete
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

		const lat = place.geometry.location.lat();
		const lng = place.geometry.location.lng();
		const formattedAddress = place.formatted_address ?? '';
		const placeName = place.name ?? '';
		const displayAddress = placeName ? `${placeName} - ${formattedAddress}` : formattedAddress;
		this.confirmedAddress = displayAddress;
		const patch: any = {
			address: displayAddress,
			latitude: lat,
			longitude: lng,
			city: '',
			state: '',
			country: '',
			zipCode: ''
		};

		place.address_components?.forEach((component) => {
			const types = component.types || [];
			if (types.includes('locality') || types.includes('postal_town') || types.includes('administrative_area_level_3')) {
				if (!patch.city) patch.city = component.long_name;
			}
			if (types.includes('administrative_area_level_1')) {
				patch.state = component.long_name;
			}
			if (types.includes('country')) {
				patch.country = component.long_name;
			}
			if (types.includes('postal_code')) {
				patch.zipCode = component.long_name;
			}
		});

		this.addIndividualAccountForm.patchValue(patch);
		this.addIndividualAccountForm.updateValueAndValidity();
	}

	initallphonefields() {
		let countryCode = 'auto';
		if (this.defaultCountryCode) {
			countryCode = this.defaultCountryCode;
		} else if (this.currentUser && (this.currentUser.phoneCountry || this.currentUser.country)) {
			countryCode = this.currentUser.phoneCountry || this.currentUser.country;
		}

		const telOptions: any = this.commonServices.getTelInputOptions(countryCode);

		if (this.mobileInput) {
			console.log('onput', this.mobileInput, this.mobileInput.nativeElement)
			this.MobileObject = intlTelInput(this.mobileInput.nativeElement, telOptions);

			this.addCustomCountrySearch(this.mobileInput.nativeElement);

			this.mobileInput.nativeElement.addEventListener('countrychange', () => {
				const countryData = this.MobileObject.getSelectedCountryData();
				console.log("in change", countryData)
				this.onCountryChange(countryData, 'mobile')
				this.validateMobile();
			});
		}

		if (this.workInput) {
			console.log('onput', this.workInput, this.workInput.nativeElement)
			this.WorkObject = intlTelInput(this.workInput.nativeElement, telOptions);

			this.addCustomCountrySearch(this.workInput.nativeElement);

			this.workInput.nativeElement.addEventListener('countrychange', () => {
				const countryData = this.WorkObject.getSelectedCountryData();
				console.log("in change", countryData)
				this.onCountryChange(countryData, 'work');
				this.validateWork();
			});
		}

		// this.MobileObject.setCountry(this.defaultCountryCode)
		// this.WorkObject.setCountry(this.defaultCountryCode)

	}

	getProfile() {
		this.individualService.getIndividualAccountDetails()
			.pipe(
				catchError(err => {
					this.spinner.hide();//hide spinner
					return throwError(err);
				})
			).subscribe(result => {
				this.response = result;
				this.cardDetails = this.response?.data?.cards
				this.confirmedAddress = this.response?.data?.address || '';
				this.addIndividualAccountForm.patchValue({
					smsOptIn: this.response?.data?.sms_optin == 1 ? true : false,
					firstName: this.response?.data?.first_name,
					middleName: this.response?.data?.middle_name,
					lastName: this.response?.data?.last_name,
					mobile: this.response?.data?.mobile,
					mobileIsd: this.response?.data?.mobileIsd,
					mobileCountry: this.response?.data?.mobileCountry,
					work: this.response?.data?.work_contact_number,
					workCountry: this.response?.data?.workCountry,
					workIsd: this.response?.data?.workIsd,
					email: this.response?.data?.email,
					address: this.response?.data?.address,
					city: this.response?.data?.city,
					state: this.response?.data?.state,
					country: this.response?.data?.country,
					zipCode: this.response?.data?.zip,
					latitude: this.response?.data?.latitude,
					longitude: this.response?.data?.longitude,
				});
				this.spinner.hide();//hide spinner
				this.MobileObject.setCountry(this.response?.data?.mobileCountry);
				this.WorkObject.setCountry(this.response?.data?.workCountry);

			});
	}

	buildAddIndividualForm() {
		this.addIndividualAccountForm = this.formBuilder.group({
			role: ['5', [Validators.required, Validators.pattern("^[0-9].*$")]],//individual
			firstName: ['', [Validators.required, FormValidators.name()]],
			middleName: ['', [FormValidators.name()]],
			lastName: ['', [Validators.required, FormValidators.name()]],
			mobile: ['', [Validators.required, Validators.pattern("^[0-9+]*$"), Validators.minLength(4), Validators.maxLength(15), FormValidators.phone()]],
			mobileIsd: ['+1', Validators.required],
			mobileCountry: ['us'],
			work: ['', [FormValidators.phone()]],
			workIsd: ['+1'],
			workCountry: ['us'],
			email: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i), Validators.maxLength(100)]],
			address: ['', [Validators.required, FormValidators.address(), FormValidators.addressSelected(() => this.confirmedAddress)]],
			city: [''],
			state: [''],
			country: ['', [Validators.required, FormValidators.country()]],
			zipCode: ['', [Validators.required, FormValidators.zip()]],
			latitude: [''],
			longitude: [''],
			card_type: ['personal', Validators.required],
			number: ['', [Validators.required, Validators.pattern("^[0-9\\s]*$"), Validators.minLength(14), Validators.maxLength(20), this.customValidator.dashValidator(), this.customValidator.plusValidator()]],
			cvc: ['', [Validators.required, Validators.pattern("^[0-9]*$"), Validators.minLength(3), Validators.maxLength(5), this.customValidator.dashValidator(), this.customValidator.plusValidator()]],
			exp_month: ['', Validators.required],
			exp_year: ['', Validators.required],
			name: ['', [Validators.required, FormValidators.name()]],
			smsOptIn: [false, Validators.requiredTrue]  // Ensures the checkbox must be checked

		});
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

	validateMobile() {
		this.validatePhoneGeneric(this.addIndividualAccountForm.get('mobile'), this.MobileObject);
	}

	validateWork() {
		this.validatePhoneGeneric(this.addIndividualAccountForm.get('work'), this.WorkObject);
	}

	clearAddressField(): void {
		if (this.is_family_member) {
			return;
		}

		this.addIndividualAccountForm.patchValue({
			address: '',
			city: '',
			state: '',
			country: '',
			zipCode: '',
			latitude: '',
			longitude: ''
		});
		this.addIndividualAccountForm.updateValueAndValidity();
		this.addressOptions = [];
		this.addressSearchLoading = false;
		this.activeAddressDropdown = false;
	}

	onAddressFocus(input?: HTMLInputElement): void {
		if (this.is_family_member) {
			return;
		}
		input?.select();
		this.activeAddressDropdown = true;
		void this.searchAddressOptions(this.addIndividualAccountForm.get('address')?.value || '');
	}

	onAddressBlur(): void {
		setTimeout(() => {
			this.activeAddressDropdown = false;
		}, 150);
	}

	onAddressInput(value: string): void {
		if (this.is_family_member) {
			return;
		}
		this.addIndividualAccountForm.patchValue({
			address: value || '',
			latitude: '',
			longitude: ''
		}, { emitEvent: false });
		this.addIndividualAccountForm.get('latitude')?.updateValueAndValidity({ emitEvent: false });
		this.addIndividualAccountForm.get('longitude')?.updateValueAndValidity({ emitEvent: false });
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
		return this.activeAddressDropdown && !String(this.addIndividualAccountForm.get('address')?.value || '').trim() && !this.addressSearchLoading;
	}

	shouldShowAddressEmpty(): boolean {
		return this.activeAddressDropdown && !!String(this.addIndividualAccountForm.get('address')?.value || '').trim() && !this.addressSearchLoading && !this.addressOptions.length;
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


	onCountryChange(event, type) {
		if (type == 'mobile') {
			this.addIndividualAccountForm.patchValue({
				mobileIsd: '+' + event.dialCode,
				mobileCountry: event.iso2
			});
		}
		else {
			this.addIndividualAccountForm.patchValue({
				workIsd: '+' + event.dialCode,
				workCountry: event.iso2
			});
		}
		// console.log(this.countryCode);
	}
	telInputObjectMobile(obj) {
		this.MobileObject = obj;
	}
	telInputObjectWork(obj) {
		this.WorkObject = obj;
	}
	get f() {
		return this.addIndividualAccountForm.controls;
	}

	submitForm() {
		if (this.MobileObject) {
			const countryData = this.MobileObject.getSelectedCountryData();
			this.addIndividualAccountForm.patchValue({
				mobileIsd: '+' + countryData.dialCode,
				mobileCountry: countryData.iso2
			});
		}
		if (this.WorkObject) {
			const countryData = this.WorkObject.getSelectedCountryData();
			this.addIndividualAccountForm.patchValue({
				workIsd: '+' + countryData.dialCode,
				workCountry: countryData.iso2
			});
		}

		if (this.response?.data?.cards?.length > 0) {
			console.log("in check if cards list to clear validators")
			this.addIndividualAccountForm.controls['card_type'].clearValidators();
			this.addIndividualAccountForm.controls['card_type'].updateValueAndValidity()
			this.addIndividualAccountForm.controls['number'].clearValidators();
			this.addIndividualAccountForm.controls['number'].updateValueAndValidity()
			this.addIndividualAccountForm.controls['cvc'].clearValidators();
			this.addIndividualAccountForm.controls['cvc'].updateValueAndValidity()
			this.addIndividualAccountForm.controls['name'].clearValidators();
			this.addIndividualAccountForm.controls['name'].updateValueAndValidity()
			this.addIndividualAccountForm.controls['exp_year'].clearValidators();
			this.addIndividualAccountForm.controls['exp_year'].updateValueAndValidity()
			this.addIndividualAccountForm.controls['exp_month'].clearValidators();
			this.addIndividualAccountForm.controls['exp_month'].updateValueAndValidity()

		}
		console.log(this.addIndividualAccountForm);
		// console.log(JSON.stringify(this.addVehicleRatesForm.value));
		// Sanitize work
		const work = this.addIndividualAccountForm.get('work');
		const workIsd = this.addIndividualAccountForm.get('workIsd');
		if (work && work.value && workIsd && workIsd.value) {
			const val = String(work.value);
			const isd = String(workIsd.value);
			if (val.startsWith(isd)) {
				work.setValue(val.substring(isd.length));
			}
		}

		// Sanitize mobile
		const mobile = this.addIndividualAccountForm.get('mobile');
		const mobileIsd = this.addIndividualAccountForm.get('mobileIsd');
		if (mobile && mobile.value && mobileIsd && mobileIsd.value) {
			const val = String(mobile.value);
			const isd = String(mobileIsd.value);
			if (val.startsWith(isd)) {
				mobile.setValue(val.substring(isd.length));
			}
		}

		this.submittedForm = true;
		// stop here if form is invalid
		if (this.addIndividualAccountForm.invalid) {
			return;
		}


		if (this.addIndividualAccountForm.get('address').value != '' && this.addIndividualAccountForm.get('latitude').value == '') {
			this.errors.openDialog({
				errors: {
					error: `<spanclass="text-danger font-weight-bolder text-xl">Please choose the correct address from the dropdown.</span>`
				}
			})
			return;
		}

		console.log(this.addIndividualAccountForm.value);
		// console.log(JSON.stringify(this.addVehicleRatesForm.value));
		this.spinner.show();
		this.disableSubmitButton = true; //disable submit button
		console.log(this.addIndividualAccountForm.value)
		this.individualService.createIndividualAccount(this.addIndividualAccountForm.value, this.currentUser?.is_profile_complete)
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
				if (this.response?.data?.is_profile_complete) {
					this.currentUser['is_profile_complete'] = 1
					this.currentUser['name'] = this.response?.data?.first_name + ' ' + this.response?.data?.last_name
					// this.currentUser['account_id'] = this.response?.data?.acc_id
					localStorage.setItem('currentUser', JSON.stringify(this.currentUser))
				}
				this.router.navigate(['/individual/bookings']);
			});
	}

	resetForm() {
		console.log("reset clicked")
		const keepValues = [
			this.addIndividualAccountForm.controls.mobile.value,
			this.addIndividualAccountForm.controls.mobileIsd.value,
			this.addIndividualAccountForm.controls.mobileCountry.value

		];

		this.buildAddIndividualForm();
		this.addIndividualAccountForm.controls.mobile.patchValue(keepValues[0]);
		this.addIndividualAccountForm.controls.mobileIsd.patchValue(keepValues[1]);
		this.addIndividualAccountForm.controls.mobileCountry.patchValue(keepValues[2]);
	}
	// backButton()
	// {
	// 	this.router.navigate(['/admin/individual-account-admin']);
	// }

	enableDisableClicked(id) {
		this.cardToDelete = id;
		this.alertMessage = "Are you sure you want to delete this Card?"
	}

	addCardClick() {
		this.router.navigate(['/individual/add-card'])
	}

	deleteCard() {
		this.spinner.show();
		this.individualService.deleteIndividualCreditCard(this.cardToDelete)
			.pipe(
				catchError(err => {
					this.spinner.hide();//hide spinner
					return throwError(err);
				})
			)
			.subscribe(result => {
				this.spinner.hide()
				$('#deleteConfirmationModal').modal('hide');
				this.getProfile()
			});
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

		this.addIndividualAccountForm.patchValue({
			exp_month: monthStr,
			exp_year: yearStr
		});

		// Mark as dirty/touched for validation display
		this.addIndividualAccountForm.get('exp_month').markAsDirty();
		this.addIndividualAccountForm.get('exp_year').markAsDirty();

		datepicker.close();
	}
}
