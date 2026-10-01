import { Component, OnInit, ViewChild, ElementRef, NgZone, AfterViewInit } from '@angular/core';
import { AdminService } from '../../../services/admin.service';
import { FormGroup, FormBuilder, Validators, FormArray, FormControl } from '@angular/forms';
import { FormValidators } from 'src/app/utils/form-validators';
import { Router, ActivatedRoute } from '@angular/router';
import { NgxSpinnerService } from "ngx-spinner";
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import * as intlTelInput from 'intl-tel-input';
import { ErrorDialogService } from 'src/app/services/error-dialog/errordialog.service';
import { attachPlaceAutocompleteElement } from '../../../utils/google-place-autocomplete';

@Component({
	selector: 'app-edit-travel-planner-account',
	templateUrl: './edit-travel-planner-account.component.html',
	styleUrls: ['./edit-travel-planner-account.component.scss']
})
export class EditTravelPlannerAccountComponent implements OnInit, AfterViewInit {

	@ViewChild('search1') search1!: ElementRef;
	geoCoder!: google.maps.Geocoder;
	@ViewChild('officeInput') officeInput!: ElementRef;
	@ViewChild('mobileInput') mobileInput!: ElementRef;
	@ViewChild('faxInput') faxInput!: ElementRef;
	@ViewChild('officeNumberInput') officeNumberInput!: ElementRef;

	public editTravelPlannerAccountForm: FormGroup;
	public submittedForm: boolean;
	confirmedAddress = ''; // last address picked from suggestions or loaded from the server
	addressFocused = false;
	private addressBlurTimer: any;
	public disableSubmitButton: boolean = false;
	public response: any;
	public travelPlannerId: string;
	public paramResponse: any;
	public OfficeObject: any;
	public MobileObject: any;
	public FaxObject: any;
	public OfficePhoneObject: any;

	constructor(
		private adminService: AdminService,
		private router: Router,
		private spinner: NgxSpinnerService,
		private formBuilder: FormBuilder,
		private activatedroute: ActivatedRoute,
		private ngZone: NgZone,
		private errors: ErrorDialogService
	) { }


	//google map autocomplete
	title: string = 'AGM project';
	latitude: number;
	longitude: number;
	zoom: number;
	address: string;

	ngOnInit(): void {
		this.spinner.show();//hide spinner

		//pick vehicle type id from query params
		this.activatedroute.queryParamMap
			.subscribe((params) => {
				this.paramResponse = { ...params.keys, ...params };
				// console.log(this.paramResponse.params.vehicleTypeId);
				this.travelPlannerId = this.paramResponse.params.travelPlannerId;
				// console.log(this.vehicleId);
			}
			);

		//fetch data to display on edit screen
		this.adminService.getTravelPlannerAccount(this.travelPlannerId)
			.pipe(
				catchError(err => {
					this.spinner.hide();//hide spinner
					return throwError(err);
				})
			).subscribe(result => {
				this.response = result;

				this.confirmedAddress = this.response?.data?.Address || '';
				this.editTravelPlannerAccountForm.patchValue({
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
					// latitude:this.response.data.latitude,
					// longitude:this.response.data.longitude,
				});
				this.spinner.hide();//hide spinner
				this.MobileObject.setCountry(this.response?.data?.mobileCountry);
				this.OfficeObject.setCountry(this.response?.data?.officeCountry);
				this.OfficePhoneObject.setCountry(this.response?.data?.office_country_code);
				this.FaxObject.setCountry(this.response?.data?.faxCountry);
			});






		//add amenity form validation
		this.editTravelPlannerAccountForm = this.formBuilder.group({
			id: ['', [Validators.required, Validators.pattern("^[0-9].*$")]],//travelPlanner
			role: ['3', [Validators.required, Validators.pattern("^[0-9].*$")]],//travelPlanner
			firstName: ['', [Validators.required, FormValidators.name()]],
			middleName: ['', [FormValidators.name()]],
			lastName: ['', [Validators.required, FormValidators.name()]],
			office: ['', [Validators.required, Validators.pattern("^[0-9+]*$"), Validators.minLength(4), Validators.maxLength(15), FormValidators.phone()]],
			officeIsd: ['+1', Validators.required],
			officeCountry: ['us'],
			mobile: ['', [Validators.required, Validators.pattern("^[0-9+]*$"), Validators.minLength(4), Validators.maxLength(15), FormValidators.phone()]],
			mobileIsd: ['+1', Validators.required],
			mobileCountry: ['us'],
			email: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i), Validators.maxLength(100)]],
			address: ['', [Validators.required, FormValidators.address(), FormValidators.addressSelected(() => this.confirmedAddress)]],
			city: [''],
			state: [''],
			country: ['', [Validators.required, FormValidators.country()]],
			zipCode: ['', [Validators.required, FormValidators.zip()]],
			agencyName: ['', [Validators.required, FormValidators.organization()]],
			payee: ['', [Validators.required, FormValidators.organization()]],
			iata: ['', [Validators.required, FormValidators.iata()]],
			fax: ['', [Validators.required, Validators.pattern("^[0-9+]*$"), Validators.minLength(4), Validators.maxLength(15), FormValidators.phone()]],
			faxIsd: ['+1', Validators.required],
			faxCountry: ['us'],
			officeNumber: ['', [Validators.required, Validators.pattern("^[0-9+]*$"), Validators.minLength(4), Validators.maxLength(15), FormValidators.phone()]],
			isd_office_number: ['+1', Validators.required],
			office_country_code: ['us'],
			latitude: [''],
			longitude: [''],
		});
	}


	ngAfterViewInit(): void {

		this.initallphonefields()


		//google map autocomplete
		this.geoCoder = new google.maps.Geocoder();

		void attachPlaceAutocompleteElement(
			this.search1.nativeElement,
			{
				types: ['geocode', 'establishment'],
				fields: ['formatted_address', 'geometry', 'place_id', 'name', 'address_components', 'types'],
				syncControl: this.editTravelPlannerAccountForm.get('address')!,
			},
			(place) => {
				this.ngZone.run(() => {
					if (!place.geometry || !place.geometry.location) return;
					const formattedAddress = place.formatted_address ?? '';
					const placeName = place.name ?? '';
					const displayAddress = placeName ? `${placeName} - ${formattedAddress}` : formattedAddress;

					this.confirmedAddress = displayAddress;
					this.editTravelPlannerAccountForm.patchValue({
						address: displayAddress,
						latitude: place.geometry.location.lat(),
						longitude: place.geometry.location.lng()
					});

					place.address_components?.forEach((component) => {
						const types = component.types;
						if (types.includes('country')) {
							this.editTravelPlannerAccountForm.patchValue({
								country: component.long_name
							});
						} else if (types.includes('administrative_area_level_1')) {
							this.editTravelPlannerAccountForm.patchValue({
								state: component.long_name
							});
						} else if (types.includes('administrative_area_level_3')) {
							this.editTravelPlannerAccountForm.patchValue({
								city: component.long_name
							});
						} else if (types.includes('postal_code')) {
							this.editTravelPlannerAccountForm.patchValue({
								zipCode: component.long_name
							});
						}
					});
				});
			}
		);

		// #search1 is hidden behind the Google widget, so track focus on the widget to mark the address touched
		const addressHost: HTMLElement = this.search1.nativeElement.parentElement;
		addressHost?.addEventListener('focusin', () => {
			clearTimeout(this.addressBlurTimer);
			this.ngZone.run(() => this.addressFocused = true);
		});
		addressHost?.addEventListener('focusout', () => {
			clearTimeout(this.addressBlurTimer);
			this.addressBlurTimer = setTimeout(() => this.ngZone.run(() => {
				this.addressFocused = false;
				this.editTravelPlannerAccountForm.get('address')?.markAsTouched();
			}), 300);
		});
	}


	initallphonefields() {

		const telOptions = {
			initialCountry: 'us',
			preferredCountries: ['us', 'ca', 'mx', 'gb'],
			separateDialCode: true,
			nationalMode: true,
			// autoPlaceholder: 'aggressive',
			utilsScript:
				'https://cdn.jsdelivr.net/npm/intl-tel-input@18.2.1/build/js/utils.js'
		}



		if (this.officeInput) {
			console.log('onput', this.officeInput, this.officeInput.nativeElement)
			this.OfficeObject = intlTelInput(this.officeInput.nativeElement, telOptions);

			this.addCustomCountrySearch(this.officeInput.nativeElement);
			this.officeInput.nativeElement.addEventListener('countrychange', () => {
				const countryData = this.OfficeObject.getSelectedCountryData();
				console.log("in change", countryData)
				this.onCountryChange(countryData, 'office')
				this.validatePhone('office', this.OfficeObject);
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
				this.validatePhone('mobile', this.MobileObject);
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
				this.validatePhone('fax', this.FaxObject);
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
				this.validatePhone('officeNumber', this.OfficePhoneObject);
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

	validatePhone(controlName: string, telInputObject: any) {
		const control = this.editTravelPlannerAccountForm.get(controlName);
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

	onCountryChange(event, type) {
		if (type == 'mobile') {
			this.editTravelPlannerAccountForm.patchValue({
				mobileIsd: '+' + event.dialCode,
				mobileCountry: event.iso2
			});
		}
		else if (type == 'office') {
			this.editTravelPlannerAccountForm.patchValue({
				officeIsd: '+' + event.dialCode,
				officeCountry: event.iso2
			});
		}
		else if (type == 'officeNumber') {
			this.editTravelPlannerAccountForm.patchValue({
				isd_office_number: '+' + event.dialCode,
				office_country_code: event.iso2
			});
		}
		else {
			this.editTravelPlannerAccountForm.patchValue({
				faxIsd: '+' + event.dialCode,
				faxCountry: event.iso2
			});
		}
		// console.log(this.countryCode);
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
	get f() {
		return this.editTravelPlannerAccountForm.controls;
	}

	submitForm() {
		console.log(this.editTravelPlannerAccountForm);
		// console.log(JSON.stringify(this.addVehicleRatesForm.value));
		this.submittedForm = true;

		// Sync Mobile Country Data
		if (this.MobileObject) {
			const countryData = this.MobileObject.getSelectedCountryData();
			if (countryData && countryData.dialCode) {
				this.editTravelPlannerAccountForm.patchValue({
					mobileIsd: '+' + countryData.dialCode,
					mobileCountry: countryData.iso2
				});
			}
		}

		// Sync Office Country Data
		if (this.OfficeObject) {
			const countryData = this.OfficeObject.getSelectedCountryData();
			if (countryData && countryData.dialCode) {
				this.editTravelPlannerAccountForm.patchValue({
					officeIsd: '+' + countryData.dialCode,
					officeCountry: countryData.iso2
				});
			}
		}

		// Sync Fax Country Data
		if (this.FaxObject) {
			const countryData = this.FaxObject.getSelectedCountryData();
			if (countryData && countryData.dialCode) {
				this.editTravelPlannerAccountForm.patchValue({
					faxIsd: '+' + countryData.dialCode,
					faxCountry: countryData.iso2
				});
			}
		}

		// Sync OfficeNumber Country Data
		if (this.OfficePhoneObject) {
			const countryData = this.OfficePhoneObject.getSelectedCountryData();
			if (countryData && countryData.dialCode) {
				this.editTravelPlannerAccountForm.patchValue({
					isd_office_number: '+' + countryData.dialCode,
					office_country_code: countryData.iso2
				});
			}
		}

		// stop here if form is invalid
		if (this.editTravelPlannerAccountForm.invalid) {
			return;
		}

		// Sanitize office (remove Country Code if present)
		if (this.editTravelPlannerAccountForm.value.office && this.editTravelPlannerAccountForm.value.officeIsd && this.editTravelPlannerAccountForm.value.office.startsWith(this.editTravelPlannerAccountForm.value.officeIsd)) {
			this.editTravelPlannerAccountForm.value.office = this.editTravelPlannerAccountForm.value.office.substring(this.editTravelPlannerAccountForm.value.officeIsd.length);
		}

		// Sanitize fax (remove Country Code if present)
		if (this.editTravelPlannerAccountForm.value.fax && this.editTravelPlannerAccountForm.value.faxIsd && this.editTravelPlannerAccountForm.value.fax.startsWith(this.editTravelPlannerAccountForm.value.faxIsd)) {
			this.editTravelPlannerAccountForm.value.fax = this.editTravelPlannerAccountForm.value.fax.substring(this.editTravelPlannerAccountForm.value.faxIsd.length);
		}

		// Sanitize mobile (remove Country Code if present)
		if (this.editTravelPlannerAccountForm.value.mobile && this.editTravelPlannerAccountForm.value.mobileIsd && this.editTravelPlannerAccountForm.value.mobile.startsWith(this.editTravelPlannerAccountForm.value.mobileIsd)) {
			this.editTravelPlannerAccountForm.value.mobile = this.editTravelPlannerAccountForm.value.mobile.substring(this.editTravelPlannerAccountForm.value.mobileIsd.length);
		}


		if (this.editTravelPlannerAccountForm.get('address').value != '' && this.editTravelPlannerAccountForm.get('latitude').value == '') {
			this.errors.openDialog({
				errors: {
					error: `<spanclass="text-danger font-weight-bolder text-xl">Please choose the correct address from the dropdown.</span>`
				}
			})
			return;
		}

		console.log(this.editTravelPlannerAccountForm.value);
		// console.log(JSON.stringify(this.addVehicleRatesForm.value));
		this.spinner.show();
		this.disableSubmitButton = true; //disable submit button

		this.adminService.updateTravelPlannerAccount(this.editTravelPlannerAccountForm.value)
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

				this.router.navigate(['/admin/travel-planner-account-admin']);
			});
	}

	resetForm() {
		this.editTravelPlannerAccountForm.reset();
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
}
