import { Component, OnInit, ViewChild, ElementRef, NgZone, EventEmitter, Input, AfterViewInit } from '@angular/core';
import { AffiliateService } from '../../../services/affiliate.service';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { StateManagementService } from '../../../services/statemanagement.service';
import { Router, ActivatedRoute } from '@angular/router';
import { catchError } from 'rxjs/operators';
import { throwError, of } from 'rxjs';
import { HttpClient, HttpHeaders } from "@angular/common/http";
import { CustomvalidationService } from '../../../services/customvalidation.service';
import { SharedModule } from '../../shared/shared.module';
import { NgxSpinnerService } from 'ngx-spinner';
import { AdminService } from 'src/app/services/admin.service';
import { CommonService } from 'src/app/services/common.service';
import { ErrorDialogService } from 'src/app/services/error-dialog/errordialog.service';
import * as moment from "moment";
import { MomentDateAdapter, MAT_MOMENT_DATE_ADAPTER_OPTIONS } from '@angular/material-moment-adapter';
import { DateAdapter, MAT_DATE_FORMATS, MAT_DATE_LOCALE } from '@angular/material/core';
import { FormControl } from '@angular/forms';

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
	selector: 'app-step2',
	templateUrl: './step2.component.html',
	styleUrls: ['../affiliate-registration-style.css', './step2.component.scss'],
	providers: [
		{
			provide: DateAdapter,
			useClass: MomentDateAdapter,
			deps: [MAT_DATE_LOCALE, MAT_MOMENT_DATE_ADAPTER_OPTIONS],
		},
		{ provide: MAT_DATE_FORMATS, useValue: MY_FORMATS },
	],
})
export class Step2Component implements OnInit, AfterViewInit {
	@ViewChild('search1') search1!: ElementRef;
	geoCoder!: google.maps.Geocoder;

	public addBankForm: FormGroup;
	public requestAddressChangeForm: FormGroup;
	public submittedForm: boolean;
	public disableSubmitButton: boolean = false;
	public response: any;
	public affiliateId: string;
	public stepCompleted: any;
	public getCountryName: any;
	public postCountryName: any;
	public isStep2Completed: boolean = false;
	public countryDocumentsArray: any = [];
	public countryOptions: any = [];
	public stateOptions: any = [];
	public stateOptionsAddressChange: any = [];
	public currencyOptions: any = [];
	public currencyOptions_copy: any = [];
	public yearOptions: any = [];
	public id_front_image: string;
	public id_back_image: string;
	public id_front_image_id: string;
	public id_front_image_degree: number = 0
	public id_back_image_id: string;
	public id_back_image_degree: number = 0
	public imageSrc: string;
	public cardToDelete: number;
	public date25YearsBack: string;
	public stripeErrors: Array<Object>;
	public modalImage: string;
	public dobDay: Array<number> = [];
	public dobYear: Array<number> = [];
	public canChangeDocument: Boolean = false;
	public canChangeAddress: Boolean = false;
	public displayMsg: string;
	public alertMessage: string;
	public submittedRequestAddressChangeForm: boolean;
	public disableSubmitRequestAddressChangeButton: boolean = false;
	public showProgressBar: boolean = false;
	public haveEinNo: boolean = true;
	public isBadgeCity: boolean = false;
	enableSsnField: boolean = false;
	routingErrorMessage: string;
	ssn_copy: any;
	ssnErrorMessage: string;
	addressErrorMessage: string;
	dobErrorMessage: string;
	public AddressCheckStripe = ['address', 'street', 'city', 'country'];
	isSsnSelected: boolean = false;
	isAddressSelected: boolean = false;
	isRoutingSelected: boolean = false;

	// Month-Year Picker Logic
	expiryDateControl = new FormControl(moment());
	minExpiryDate = moment().startOf('month');


	@Input() closeTab: EventEmitter<any> = new EventEmitter();
	selectedCountryName: any;
	badgeOptions: any;
	filteredOptions: any;
	rotateDriverLicence: boolean = false;
	rotateDriverLicenceBack: boolean = false;
	TaxIdMatch: string;
	private addressAutocompleteAttached = false;
	activeAddressDropdown: boolean = false;
	addressOptions: any[] = [];
	addressSearchLoading: boolean = false;
	private customPlacesService: google.maps.places.PlacesService | null = null;
	private addressSearchVersion = 0;

	private syncAddressControlState(): void {
		const addressControlNames = ['country', 'state'];
		addressControlNames.forEach((controlName) => {
			const control = this.addBankForm?.get(controlName);
			if (!control) {
				return;
			}
			control.enable({ emitEvent: false });
		});
	}

	constructor(
		private affiliateService: AffiliateService,
		private adminService: AdminService,
		private router: Router,
		private formBuilder: FormBuilder,
		private httpClient: HttpClient,
		private activatedroute: ActivatedRoute,
		private stateManagementService: StateManagementService,
		private ngZone: NgZone,
		private el: ElementRef,
		private spinner: NgxSpinnerService,
		private commonServices: CommonService,
		private customValidator: CustomvalidationService,
		private globalFunctions: SharedModule,
		private errors: ErrorDialogService
	) { }

	public tutorialVideoUrl = "https://1800limo.s3.us-east-2.amazonaws.com/tutorials/How+to+complete+step+2+to+register+as+affiliate.mp4";

	// License OCR scan (limortservice) - reads the uploaded ID photo and prefills the business address.
	private readonly scanLicenseUrl = "http://10.20.10.135:3000/api/scan-license";
	private readonly scanLicenseHeaders = new HttpHeaders({
		"x-secret": "limoapi_admin_secret_2024_xyz789",
		"x-api-key": "limoapi_notifications_secret_2024_xyz789",
	});

	openTutorial(): void {
		window.open(this.tutorialVideoUrl, "_blank");
	}

	ngOnInit(): void {
		$('.HeadingH1').css({ display: "block" })
		//code related to autocomplete and ma

		//show Email verification modal on first time completing step 1
		const showEmailVerificationAlert = sessionStorage.getItem("showEmailVerificationAlert");
		if (showEmailVerificationAlert == 'yes') {
			$('#showEmailVerificationAlert').modal('show');
			sessionStorage.removeItem("showEmailVerificationAlert");
		}
		//prepare list of years for add card
		const currentYear = (new Date()).getFullYear();
		for (let i = 0; i < 40; i++) {
			this.yearOptions.push(currentYear + i);
		}
		//prepare list of days for DOB
		for (let i = 1; i <= 31; i++) {
			this.dobDay.push(i);
		}
		//prepare list of year for DOB
		let year = currentYear - 18;
		let temp = 0;
		while (temp < 60)//max 80 year age
		{
			this.dobYear.push(year);
			year--;
			temp++;
		}

		const currentUser = JSON.parse(localStorage.getItem("currentUser"));
		this.affiliateId = currentUser.account_id;
		this.stepCompleted = this.affiliateService.getLocalStepCompleted();

		this.adminService.getAllEnableBadgeCities().pipe(
			catchError(err => {
				return throwError(err)
			})
		).subscribe((res: any) => {
			this.badgeOptions = res?.data
			this.filteredOptions = res?.data
		})

		//add bank form validation
		this.addBankForm = this.formBuilder.group({
			id: [''],//bank id for edit purpose
			acc_id: [this.affiliateId, [Validators.required, Validators.pattern("^[0-9].*$")]],//affiliate account id
			BankName: [''],
			BankAddress: [''],
			AccountHolderFirstName: ['', Validators.required],
			AccountHolderMiddleName: [''],
			AccountHolderLastName: ['', Validators.required],
			AccountNumber: ['', [Validators.required, this.customValidator.dashValidator(), this.customValidator.plusValidator()]],
			Routing: ['', Validators.required],
			AccountType: ['company', Validators.required],
			ssn: ['', [Validators.required, Validators.pattern("^[0-9*]*$"), this.customValidator.dashValidator(), this.customValidator.plusValidator()]],
			haveEin: ['yesEin'],
			ein: [''],
			currency: ['', Validators.required],
			dobDay: ['', Validators.required],
			dobMonth: ['', Validators.required],
			dobYear: ['', Validators.required],
			id_front_image: ['', Validators.required],
			id_back_image: [''],
			address: ['', Validators.required],
			latitude: ['', Validators.required],
			longitude: ['', Validators.required],
			street: [''],
			city: [''],
			state: ['', Validators.required],
			badge_city: [''],
			badge_city_name: [''],
			country: ['', Validators.required],
			zipCode: ['', Validators.required],
			unit: [''],
			primaryCardType: ['personal'],
			primaryCardNumber: ['', [Validators.pattern("^[0-9+]*$"), Validators.minLength(14), Validators.maxLength(20), this.customValidator.dashValidator(), this.customValidator.plusValidator()]],
			primaryCSC: ['', [Validators.pattern("^[0-9+]*$"), Validators.minLength(3), Validators.maxLength(3), this.customValidator.dashValidator(), this.customValidator.plusValidator()]],
			primaryMM: [''],
			primaryYY: [''],
			primaryCardHolderName: ['']
		});
		this.syncAddressControlState();

		//load list of currencies
		this.httpClient.get("assets/json/currencyOptions.json").subscribe(data => {
			// convert currency options into an array of objects
			for (const key in data) {
				this.currencyOptions.push(data[key])
				this.currencyOptions_copy.push(data[key])
			}
			this.currencyOptions.sort((a: any, b: any) => {
				if (a.countryName.toLowerCase() > b.countryName.toLowerCase()) {
					return 1
				}
				else if (a.countryName.toLowerCase() < b.countryName.toLowerCase()) {
					return -1
				}
				else {
					return 0
				}

			})

			this.fillGlobalValue('', 'currency', true)


			// this.postCountryName = this.currencyOptions.countryName;
			// for (const key of Object.keys(this.currencyOptions))
			// {
			// 	if (key.toLowerCase() == currentUser.phoneCountry.toLowerCase())
			// 	{
			// 		this.addBankForm.patchValue({
			// 			currency: this.currcopy
			// 		});
			// 	}
			// }
		})

		//request address change form validation
		this.requestAddressChangeForm = this.formBuilder.group({
			requestAddress: ['', Validators.required],
			requestLatitude: ['', Validators.required],
			requestLongitude: ['', Validators.required],
			requestStreet: ['', Validators.required],
			requestCity: ['', Validators.required],
			requestState: ['', Validators.required],
			requestCountry: ['', Validators.required],
			requestZipCode: ['', [Validators.required, Validators.pattern("^[0-9+]*$"), this.customValidator.dashValidator(), this.customValidator.plusValidator()]],
			requestUnit: [''],
		});
		this.spinner.show(); //show spinner
		this.httpClient.get("assets/json/countryStateList.json").subscribe(data => {
			this.countryOptions = data;
			this.spinner.hide();
			if (this.affiliateId) {
				if (this.stepCompleted.includes('2')) {
					this.isStep2Completed = true;

					this.affiliateService.getBankOfAffiliate(this.affiliateId)
						.pipe(
							catchError(err => {
								this.spinner.hide(); //hide spinner
								return throwError(err);
							})
						).subscribe(result => {
							console.log('response--->>>>', result)
							this.response = result;
							this.spinner.hide(); //hide spinner
							this.getCountryName = this.response?.data?.bankinfo?.countryName;
							//to show stripe errors at the top
							if (this.response.data?.stripeDetail?.stripe_errors) {
								this.stripeErrors = this.response.data?.stripeDetail?.stripe_errors;
							}
							//set images and their ID
							this.id_front_image = this.response.data?.bankinfo?.id_front_image?.image;
							this.id_back_image = this.response.data?.bankinfo?.id_back_image?.image;
							this.id_front_image_degree = this.response.data?.bankinfo?.id_front_image?.orientation || 0;
							this.id_back_image_degree = this.response.data?.bankinfo?.id_back_image?.orientation || 0;

							this.id_front_image_id = this.response.data.bankinfo?.id_front_image?.ID;
							this.id_back_image_id = this.response.data?.bankinfo?.id_back_image?.ID;
							//Documents changable or not.
							// if (this.response?.data?.stripeDetail?.additional_doc_verification_status == 'unverified') {
							// 	this.canChangeDocument = true;
							// }
							// else {
							// 	this.canChangeDocument = false;
							// }
							//Documents changable or not
							if (this.response.data?.stripeDetail?.stripe_address_status == 'invalid') {
								this.canChangeAddress = true;
							}
							else {
								this.canChangeAddress = true;
							}
							this.syncAddressControlState();
							setTimeout(() => this.mapFunction());

							this.addBankForm.patchValue({
								id: this.response.data?.bankinfo?.id,
								BankName: this.response.data?.bankinfo?.BankName,
								BankAddress: this.response.data?.bankinfo?.BankAddress,
								AccountHolderFirstName: this.response.data?.bankinfo?.AccountHolderFirstName,
								AccountHolderMiddleName: this.response.data?.bankinfo?.AccountHolderMiddleName,
								AccountHolderLastName: this.response.data?.bankinfo?.AccountHolderLastName,
								AccountNumber: this.response.data?.bankinfo?.AccountNumber,
								Routing: this.response.data?.bankinfo?.Routing,
								AccountType: this.response.data?.bankinfo?.AccountType,
								currency: this.response.data?.bankinfo?.currency,
								ssn: this.showOnlyLast4Digit(this.response.data.bankinfo.ssn),
								haveEin: this.response.data?.bankinfo?.ein,
								ein: this.response.data?.bankinfo?.ein,
								address: this.response.data?.bankinfo?.address,
								latitude: this.response.data?.bankinfo?.latitude,
								longitude: this.response.data?.bankinfo?.longitude,
								street: this.response.data?.bankinfo?.street,
								unit: this.response.data?.bankinfo?.unit,
								city: this.response.data?.bankinfo?.city,
								state: this.response.data?.bankinfo?.state,
								country: this.response.data?.bankinfo?.country,
								zipCode: this.response.data?.bankinfo?.zipCode,
								dobDay: this.response.data?.bankinfo?.dobDay,
								dobMonth: this.response.data?.bankinfo?.dobMonth,
								dobYear: this.response.data?.bankinfo?.dobYear,
								id_front_image: this.response.data?.bankinfo?.id_front_image?.ID,
								id_back_image: this.response.data?.bankinfo?.id_back_image?.ID,
							});
							this.ssn_copy = this.response?.data?.bankinfo?.ssn
							this.isSsnSelected = true
							this.isAddressSelected = true
							this.isRoutingSelected = true
							// if(this.response?.data?.error_fields?.find(val => val?.field == 'ssn')){
							// 	this.ssnErrorMessage = this.response?.data?.error_fields?.find(val => val?.field == 'ssn')?.message
							// 	this.enableSsnField=false
							//             console.log("in if ssn error",this.enableSsnField)
							// }
							// else{
							// 	this.enableSsnField=true
							// }
							//to check ssn error
							// if (this.response?.data?.error_fields?.find(val => val?.field == 'ssn')) {
							// 	this.ssnErrorMessage = this.response?.data?.error_fields?.find(val => val?.field == 'ssn')?.message
							// 	this.enableSsnField = false
							// 	console.log("in if ssn error", this.response?.data?.error_fields?.find(val => val?.field == 'ssn')?.message)
							// }
							// else {
							// 	this.enableSsnField = true
							// }

							if (this.response?.data?.error_fields?.length > 0) {
								const hasNonEmptyObjects = this.response?.data?.error_fields?.filter(obj => Object.keys(obj).length > 0).length > 0;
								console.log(hasNonEmptyObjects, "hasnonnonono")
								if (!hasNonEmptyObjects) {
									this.enableSsnField = true
								}
								else {

									this.response?.data?.error_fields?.forEach(item => {
										if (item.field == 'ssn') {
											this.enableSsnField = false
											this.ssnErrorMessage = 'PLEASE ENTER A VALID SSN / GOVERNMENT ID'
											console.log('error mesage---->', this.ssnErrorMessage)
										}
										else {
											this.enableSsnField = true
										}
										if (this.AddressCheckStripe?.includes(item?.field)) {
											this.addressErrorMessage = 'Please enter a valid address'
											console.log('error mesage---->', this.addressErrorMessage)
											// this.enableSsnField = true

										}
										if (item?.field == 'dob') {
											this.dobErrorMessage = 'Please enter a valid dob'
											console.log('error mesage---->', this.dobErrorMessage)
											// this.enableSsnField = true
										}

									})
								}
							}
							else {
								this.enableSsnField = true

							}
							console.log("trueeee===>", this.enableSsnField)

							//to check varificatiom failed tax id error only
							if (this.response?.data?.stripeDetail?.stripe_errors?.find(err => err?.error_code == 'verification_failed_tax_id_match')) {
								this.enableSsnField = false
								this.TaxIdMatch = 'NOTE - Please verify your SSN  number and Buisness/Tax ID number'
							}

							this.changeCountry(this.response.data?.bankinfo?.country);//for selected country
							this.adminService.getAllEnableBadgeCities().pipe(
								catchError(err => {
									return throwError(err)
								})
							).subscribe((res: any) => {
								this.badgeOptions = res?.data
								this.filteredOptions = res?.data
								res?.data?.map((i: any) => {
									if (i.id == this.response?.data?.bankinfo?.badge_city) {
										this.addBankForm.patchValue({
											badge_city: i.id,
											badge_city_name: i.name
										})
										this.isBadgeCity = true
									}
								})
							})
							// if (this.postCountryName == this.getCountryName)
							// {
							// 	this.addBankForm.value.currency = this.response.data.bankinfo.currency;
							// 	console.log(this.addBankForm.value.currency, "jhjhjgufytfhguhgjgfjjvj")
							// }
						});
					this.spinner.hide(); //hide spinner

				}
				else {
					this.canChangeDocument = true;//can add or change documents
					this.canChangeAddress = true;//can add or change address
					this.syncAddressControlState();
					setTimeout(() => this.mapFunction());

					//for selected country
					this.changeCountry(currentUser?.phoneCountry.toUpperCase());
					this.addBankForm.patchValue({
						country: currentUser?.phoneCountry.toUpperCase(),
						AccountHolderFirstName: currentUser?.FirstName,
						AccountHolderMiddleName: currentUser?.MiddleName,
						AccountHolderLastName: currentUser?.LastName
					});
				}
			}
			else {
				//for selected country
				this.spinner.hide();
				this.syncAddressControlState();
				setTimeout(() => this.mapFunction());
				this.changeCountry(currentUser?.phoneCountry.toUpperCase());
				this.addBankForm.patchValue({
					country: currentUser?.phoneCountry.toUpperCase()
				});
			}
		})

	}
	// ngOnInit Ends 

	//google map autocomplete
	latitude: number;
	longitude: number;
	requestLatitude: number;
	requestLongitude: number;
	@ViewChild('search2')
	public search2ElementRef: ElementRef;


	ngAfterViewInit(): void {
		this.mapFunction()
	}

	mapFunction() {
		if (!this.search1?.nativeElement || this.addressAutocompleteAttached) {
			return;
		}
		this.addressAutocompleteAttached = true;

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
		if (!place.geometry || !place.geometry.location) return;

		let countryCode = '';
		let stateCode = '';
		let cityName = '';
		let zipCode = '';
		let streetNumber = '';
		let routeName = '';

		place.address_components?.forEach((component) => {
			const types = component.types || [];
			if (types.includes('country')) {
				countryCode = component.short_name;
			} else if (types.includes('administrative_area_level_1')) {
				stateCode = component.short_name;
			} else if (
				types.includes('locality') ||
				types.includes('administrative_area_level_3') ||
				types.includes('postal_town')
			) {
				cityName = component.long_name;
			} else if (types.includes('postal_code')) {
				zipCode = component.long_name;
			} else if (types.includes('street_number')) {
				streetNumber = component.long_name;
			} else if (types.includes('route')) {
				routeName = component.long_name;
			}
		});

		if (countryCode) {
			this.changeCountry(countryCode);
		}
		const formattedAddress = place.formatted_address ?? '';
		const placeName = place.name ?? '';
		const displayAddress = placeName ? `${placeName} - ${formattedAddress}` : formattedAddress;

		this.addBankForm.patchValue({
			address: displayAddress,
			latitude: place.geometry.location.lat(),
			longitude: place.geometry.location.lng(),
			country: countryCode || this.addBankForm.get('country')?.value,
			state: stateCode,
			city: cityName,
			zipCode: zipCode,
			street: [streetNumber, routeName].filter(Boolean).join(' ')
		});
		this.isAddressSelected = true;
		this.addressErrorMessage = '';
	}

	clearAddressField() {
		this.addBankForm.patchValue({
			address: '',
			latitude: '',
			longitude: '',
			street: '',
			city: '',
			zipCode: '',
		});
		this.addBankForm.updateValueAndValidity();
		this.addressErrorMessage = '';
		this.isAddressSelected = false;
		this.addressOptions = [];
		this.addressSearchLoading = false;
		this.activeAddressDropdown = false;
	}

	onAddressFocus(input?: HTMLInputElement): void {
		input?.select();
		this.activeAddressDropdown = true;
		void this.searchAddressOptions(this.addBankForm.get('address')?.value || '');
	}

	onAddressBlur(): void {
		setTimeout(() => {
			this.activeAddressDropdown = false;
		}, 150);
	}

	onAddressInput(value: string): void {
		this.addBankForm.patchValue({
			address: value || '',
			latitude: '',
			longitude: ''
		}, { emitEvent: false });
		this.addBankForm.get('latitude')?.updateValueAndValidity({ emitEvent: false });
		this.addBankForm.get('longitude')?.updateValueAndValidity({ emitEvent: false });
		this.addressErrorMessage = '';
		this.isAddressSelected = value ? true : false;
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
		return this.activeAddressDropdown && !String(this.addBankForm.get('address')?.value || '').trim() && !this.addressSearchLoading;
	}

	shouldShowAddressEmpty(): boolean {
		return this.activeAddressDropdown && !!String(this.addBankForm.get('address')?.value || '').trim() && !this.addressSearchLoading && !this.addressOptions.length;
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
			this.spinner.hide();
		});
	}


	closeButton() {
		this.closeTab.emit();
	}

	// searchCurrency(keyword) {
	//   console.log(111)
	//   this.addBankForm.patchValue({
	//     currency: '',
	//   });
	//   if (keyword == '') {
	//     this.filteredCurrency = this.currencyOptions;
	//   }
	//   else {
	//     this.filteredCurrency = this.currencyOptions.filter((cr: any) => {
	//       if (cr.name.toLowerCase() === keyword.toLowerCase()) {
	//         this.addBankForm.patchValue({
	//           currency: cr.code,
	//         });
	//       }
	//       return cr.name.toLowerCase().includes(keyword.toLowerCase());
	//     })
	//       .sort((a: any, b: any) => {
	//         return this.searchSorting(keyword, a, b)
	//       });
	//   }
	// }
	// selectCurrency(val, isSelected) {
	//   if (isSelected)// ignore on deselection of the previous option
	//   {
	//     this.addBankForm.patchValue({
	//       currency: val,
	//     });
	//   }
	// }
	//Start of autocomplete search and selection
	searchSorting(keyword, a, b) {
		// Sort results by matching name with keyword position in name
		if (a.name.toLowerCase().indexOf(keyword.toLowerCase()) > b.name.toLowerCase().indexOf(keyword.toLowerCase())) {
			return 1;
		} else if (a.name.toLowerCase().indexOf(keyword.toLowerCase()) < b.name.toLowerCase().indexOf(keyword.toLowerCase())) {
			return -1;
		} else {
			if (a.name > b.name)
				return 1;
			else
				return -1;
		}
	}

	changeCountry(selectedCountryCode) {
		let selectedCountryData: any;

		selectedCountryData = this.countryOptions.filter(function (countryOption) {
			return countryOption.countryShortCode == selectedCountryCode;
		});
		if (selectedCountryData) {
			this.stateOptions = selectedCountryData[0]?.regions;
		}
	}

	changeRadio(form_control: string, value: any) {
		this.SetFormValue(form_control, value)
		if (value) {
			this.addBankForm.controls['ein'].setValidators([Validators.required])
			this.addBankForm.controls['ein'].updateValueAndValidity()
		}
		else {
			this.addBankForm.controls['ein'].setValidators([])
			this.addBankForm.controls['ein'].updateValueAndValidity()
		}
	}

	changeIdentityCountry(selectedCountryCode) {
		this.httpClient.get("assets/json/stripeDocumentData.json").subscribe((stripeDocumentData: any) => {
			const selectedCountryData = stripeDocumentData.filter(function (eachCountryObj) {
				return eachCountryObj.value[0].value === selectedCountryCode;
			});
			this.countryDocumentsArray = selectedCountryData[0].value[1].value.value;
		})
	}

	addCardClick(accountId) {
		this.router.navigate(['/affiliate/step2/add-card']);
	}

	enableDisableClicked(id) {
		this.cardToDelete = id;
		this.alertMessage = "Are you sure you want to delete this Card?"
	}

	delete() {
		this.stateManagementService.setprogressBar(true);
		$('#deleteConfirmationModal').modal('hide');
		this.affiliateService.cardStatus(this.cardToDelete)
			.pipe(
				catchError(err => {
					this.stateManagementService.setprogressBar(false);
					return throwError(err);
				})
			).subscribe(result => {
				this.router.navigateByUrl('/RefreshComponent', { skipLocationChange: true }).then(() => {
					this.router.navigate(['/affiliate/step2']);
				});
				this.stateManagementService.setprogressBar(false);
			});
	}

	async idCardImageChange1(imageUrl, imageType, imageId = null) {
		if (!await this.commonServices.handleFile(event)) {
			return;
		}
		this.stateManagementService.setprogressBar(true);
		this.imageSrc = imageUrl;
		this.affiliateService
			.uploadVehicleImage(this.imageSrc)
			.pipe(
				catchError((err) => {
					this.stateManagementService.setprogressBar(false);
					return throwError(err);
				})
			)
			.subscribe(({ data }: any) => {
				switch (imageType) {
					case "id_front_image": {
						this.addBankForm.patchValue({
							id_front_image: data.id,
						});
						this.id_front_image = data.image;
						this.id_front_image_id = data.id;
						break;
					}
					case "id_back_image": {
						this.addBankForm.patchValue({
							id_back_image: data.id,
						});
						this.id_back_image = data.image;
						this.id_back_image_id = data.id;
						break;
					}
					default: {
						break;
					}
				}
				this.stateManagementService.setprogressBar(false);
			});
	}




	async idCardImageChange(event, imageType, imageId = null) {
		if (!await this.commonServices.handleFile(event)) {
			return;
		}
		this.stateManagementService.setprogressBar(true);
		const reader = new FileReader();
		if (event.target.files && event.target.files.length) {
			const [file] = event.target.files;
			reader.readAsDataURL(file);
			reader.onload = () => {
				this.imageSrc = reader.result as string;
				this.affiliateService.uploadVehicleImage(this.imageSrc)
					.pipe(
						catchError(err => {
							this.stateManagementService.setprogressBar(false);
							return throwError(err);
						})
					)
					.subscribe(({ data }: any) => {

						switch (imageType) {
							case 'id_front_image': {
								this.addBankForm.patchValue({
									id_front_image: data.id,
								});
								this.id_front_image = data.image;
								this.id_front_image_id = data.id;
								break;
							}
							case 'id_back_image': {
								this.addBankForm.patchValue({
									id_back_image: data.id,
								});
								this.id_back_image = data.image;
								this.id_back_image_id = data.id;
								break;
							}
							default: {
								break;
							}
						}
						this.stateManagementService.setprogressBar(false);
					});
				// Scan the ID photo in parallel with the upload above and use it to prefill the address.
				this.scanLicenseImage(this.imageSrc);
			};
		}
	}

	/**
	 * Send the uploaded ID photo to the license-scan OCR service and prefill the
	 * business address from whatever address it can read off the document.
	 */
	private scanLicenseImage(imageDataUrl: string): void {
		const body: { base64: string; mimeType?: string } = { base64: imageDataUrl };
		const mimeType = this.extractMimeTypeFromDataUrl(imageDataUrl);
		if (mimeType) {
			body.mimeType = mimeType;
		}

		this.httpClient
			.post<any>(this.scanLicenseUrl, body, { headers: this.scanLicenseHeaders })
			.pipe(
				catchError((err) => {
					console.error('License scan failed', err);
					return of(null);
				})
			)
			.subscribe((response: any) => {
				const scanned = response?.data ?? response?.result ?? response;
				void this.prefillAddressFromScannedLicense(scanned);
			});
	}

	/** Pulls the mime type out of a `data:<mime>;base64,...` URL, e.g. "image/jpeg". */
	private extractMimeTypeFromDataUrl(dataUrl: string): string {
		const match = /^data:([^;]+);base64,/.exec(dataUrl || '');
		return match ? match[1] : '';
	}

	/**
	 * The scan-license response shape isn't geocoded, so the raw address text it reads
	 * is run back through the same Places autocomplete + details lookup used for manual
	 * address search, which is what actually fills in lat/lng, city, state, zip, country.
	 */
	private async prefillAddressFromScannedLicense(scanned: any): Promise<void> {
		const addressText = this.buildAddressTextFromScan(scanned);
		if (!addressText) {
			return;
		}

		const predictions = await this.searchGooglePredictions(addressText);
		const bestMatch = predictions[0];
		if (!bestMatch) {
			// Nothing matched on Places - offer the raw scanned text so the user can still confirm it.
			this.addBankForm.patchValue({ address: addressText });
			this.isAddressSelected = false;
			return;
		}

		const place = await this.fetchPlaceDetails(bestMatch.placeId);
		if (place) {
			this.ngZone.run(() => this.applySelectedAddress(place));
		}
	}

	/** Each OCR field comes back as `{ value, confidence }` rather than a bare string. */
	private unwrapScannedField(field: any): string {
		if (field === null || field === undefined) {
			return '';
		}
		if (typeof field === 'string') {
			return field.trim();
		}
		if (typeof field === 'object' && 'value' in field) {
			return String(field.value ?? '').trim();
		}
		return String(field).trim();
	}

	/** Best-effort mapping of the OCR response onto a single address string. */
	private buildAddressTextFromScan(scanned: any): string {
		if (!scanned) {
			return '';
		}
		if (typeof scanned === 'string') {
			return scanned.trim();
		}

		const direct = this.unwrapScannedField(scanned.address || scanned.full_address || scanned.formatted_address);
		if (direct) {
			return direct;
		}

		const parts = [
			this.unwrapScannedField(scanned.street || scanned.address_line1 || scanned.street_address),
			this.unwrapScannedField(scanned.city),
			this.unwrapScannedField(scanned.state),
			this.unwrapScannedField(scanned.zip || scanned.zip_code || scanned.zipCode || scanned.postal_code),
			this.unwrapScannedField(scanned.country),
		].filter(Boolean);

		return parts.join(', ');
	}

	deleteImage(id, imageType) {
		switch (imageType) {
			case 'id_front_image': {
				this.addBankForm.patchValue({
					id_front_image: '',
				});
				this.id_front_image = '';
				break;
			}
			case 'id_back_image': {
				this.addBankForm.patchValue({
					id_back_image: '',
				});
				this.id_back_image = '';
				break;
			}
			default: {
				break;
			}
		}
	}

	showImageInModal(imageUrl) {
		this.modalImage = imageUrl;
		$("#imageModal").addClass("showImage");
		$("#imageModal").removeClass("d-none");
	}
	handleRotateSec(key: string) {
		this[key] = !this[key]
	}
	// rotateImage(key:string): void {
	// 			console.log('rotating', key,'to ', this[key]);
	// 	this[key] += 180;
	// 	if (this[key] >= 360) {
	// 	  this[key] = 0;
	// 	}
	//   }
	updateImageOrentation(key) {
		this.stateManagementService.setprogressBar(true);
		let data = {
			id: this[key + '_id'],
			// id :  '',
			image: this[key],
			orientation: this[key + '_degree']
		}
		console.log('img date', key, data)
		this.adminService.updateOrientationImage(data)
			.pipe(
				catchError(err => {
					this.stateManagementService.setprogressBar(false);
					return throwError(err);
				})
			)
			.subscribe(({ data }: any) => {
				console.log('data-->>', data)
				this.stateManagementService.setprogressBar(false);
			})
	}
	fetchImageBlob(url, key, id) {
		this.stateManagementService.setprogressBar(true);

		this.adminService.fetchImageBlob(url)
			.pipe(
				catchError(err => {
					this.stateManagementService.setprogressBar(false);
					return throwError(err);
				})
			)
			.subscribe(async ({ data }: any) => {
				this.stateManagementService.setprogressBar(false);
				const response = await fetch(data);
				const imageBlob = await response.blob()
				console.log('imageBlob', imageBlob)
				const canvas = document.createElement("canvas");
				const ctx = canvas.getContext("2d");
				const img = new Image();
				img.src = URL.createObjectURL(imageBlob);
				console.log('img-->', img)
				img.onload = () => {
					// Rotate the image by 90 degrees (or your desired angle)
					canvas.width = img.width;
					canvas.height = img.height;
					ctx.translate(canvas.width / 2, canvas.height / 2);
					ctx.rotate(Math.PI); // Rotate by 180 degrees
					ctx.drawImage(img, -img.width / 2, -img.height / 2);
					// ctx.drawImage(img, 0, -canvas.width);

					// Convert the canvas to a Blob (JPEG format)
					canvas.toBlob((blob) => {
						console.log(blob);

						this.blobToDataURL(blob, key, id);
						// });
					}, "image/jpeg");
				}
			})
	}
	blobToDataURL(blob: Blob, key, id) {
		var reader = new FileReader();
		reader.readAsDataURL(blob);
		reader.onload = () => {
			let dataUrl = reader.result;
			console.log(dataUrl); //DataURL
			this.idCardImageChange1(dataUrl, key, id);
		};
	}

	handleBadgeCity(value: any) {
		console.log(value, this.filteredOptions)
		if (!value) {
			this.isBadgeCity = false
		}
		this.filteredOptions = this.badgeOptions.filter((i: any) => i.name.toLowerCase().startsWith(value.toLowerCase()))
	}
	selectBadgeCity(option: any, isUserInput) {
		console.log('in function selectBadgeCity-->>>', option, isUserInput)
		if (isUserInput) {
			this.addBankForm.patchValue({
				badge_city: option.id
			})
			this.isBadgeCity = true
			// this.addAffiliateAccountForm.updateValueAndValidity()
		}

	}

	stripeRefreshAccountLink() {
		this.affiliateService.stripeRefreshAccountLink(this.response.stripeDetail.stripe_conncet_account_id)
			.pipe(
				catchError(err => {
					this.stateManagementService.setprogressBar(false);
					return throwError(err);
				})
			).subscribe(({ data }: any) => {
				if (data.account_link.url) {
					window.open(data.account_link.url, "_self");
				}
			});
	}

	changeCountryRequestAddresschange(selectedCountryCode) {
		let selectedCountryData: any;
		selectedCountryData = this.countryOptions.filter(function (countryOption) {
			return countryOption.countryShortCode == selectedCountryCode;
		});
		if (selectedCountryData) {
			this.stateOptionsAddressChange = selectedCountryData[0].regions;
		}
	}
	get fRequestAddressChange() {
		return this.requestAddressChangeForm.controls;
	}
	requestAddressChange() {
		console.log(this.requestAddressChangeForm);
		this.submittedRequestAddressChangeForm = true;
		// stop here if form is invalid
		if (this.requestAddressChangeForm.invalid) {
			return;
		}
		this.showProgressBar = true; //show progressbar
		this.disableSubmitRequestAddressChangeButton = true; //disable submit button

		this.affiliateService.requestAddressChange(this.requestAddressChangeForm.value)
			.pipe(
				catchError(err => {
					this.showProgressBar = false; //hide progressbar
					this.disableSubmitRequestAddressChangeButton = false; //enable submit button
					return throwError(err);
				})
			)
			.subscribe(({ message, success }: any) => {
				this.showProgressBar = false; //hide progressbar
				this.disableSubmitRequestAddressChangeButton = false; //enable submit button
				if (success == true) {
					this.displayMsg = "Request Submitted successfully.";
				}
			});
	}

	private scrollToErrorFormControlName(formControlName) {
		console.log(formControlName)
		let firstInvalidControl: HTMLElement;
		firstInvalidControl = this.el.nativeElement.querySelector(
			"input[formControlName='" + formControlName + "']"
		);
		if (!firstInvalidControl) {
			firstInvalidControl = this.el.nativeElement.querySelector(
				"mat-select[formControlName='" + formControlName + "']"
			);
		}
		console.log("input[formControlName='" + formControlName + "']", firstInvalidControl)
		window.scroll({
			top: this.getTopOffset(firstInvalidControl),
			left: 0,
			behavior: "smooth"
		});
	}
	private getTopOffset(controlEl: HTMLElement): number {
		console.log(controlEl.getBoundingClientRect());
		const labelOffset = 110;
		return controlEl.getBoundingClientRect().top + window.scrollY - labelOffset;
	}
	get f() {
		return this.addBankForm.controls;
	}
	showOnlyLast4Digit(value) {
		if (value) {
			value = value.toString()
			return '*'.repeat(value.length - 4) + value.slice(-4)
		} else {
			return ''
		}
	}
	updateStripeURL() {
		this.spinner.show();
		this.affiliateService.stripeUpdateUrl(this.affiliateId)
			.pipe(
				catchError(err => {
					console.log(err);
					return throwError(err);
				})
			)
			.subscribe(({ data }: any) => {
				window.location.href = data.url;
				this.spinner.hide();
			})
	}
	handleSsnInput(value: any) {

		console.log("prev--->", this.ssn_copy, this.addBankForm.get('ssn').value)
		value.includes("*") ? "" : this.ssn_copy = value
		console.log("after--->", this.ssn_copy)


	}
	removeErrorSsn(value: any, type: string) {
		console.log("TYPE----->", type)
		if (type == 'ssn') {
			this.ssnErrorMessage = ""
			this.isSsnSelected = value ? true : false;
		}
		else if (type == 'address') {
			this.addressErrorMessage = ""
			this.isAddressSelected = value ? true : false;
		}
		else if (type == 'Routing') {
			this.isRoutingSelected = value ? true : false;
		}
		// else if(type == 'dob'){
		// 	console.log("in dobbbbhbbb")
		// 	this.dobErrorMessage = ""
		// }
	}
	removeDobError() {
		console.log("in dobbbbhbbb")
		this.dobErrorMessage = ""
	}
	submitForm() {
		console.log(this.addBankForm);
		this.submittedForm = true;
		// stop here if form is invalid
		if (this.addBankForm.invalid) {
			return;
		}


		if (this.addBankForm.get('address').value != '' && this.addBankForm.get('latitude').value == '') {
			this.errors.openDialog({
				errors: {
					error: `<spanclass="text-danger font-weight-bolder text-xl">Please choose the correct address from the dropdown.</span>`
				}
			})
			return;
		}

		this.addBankForm.value.stepCompleted = this.affiliateService.getUpdatedStepsLocal('2');
		this.addBankForm.patchValue({
			ssn: this.ssn_copy
		})
		let payload = this.addBankForm.value
		payload['stepCompleted'] = this.affiliateService.getUpdatedStepsLocal('2');
		console.log(this.addBankForm.value, payload);
		this.spinner.show();//show spinner
		// this.stateManagementService.setprogressBar(true);
		this.disableSubmitButton = true; //disable submit button
		localStorage.setItem("driverFrontLicense", this.id_front_image);
		this.isRoutingSelected = true;
		this.affiliateService.addBankOfAffiliate(payload)
			.pipe(
				catchError(err => {
					// this.addBankForm.patchValue({
					// 	ssn:this.showOnlyLast4Digit(this.ssn_copy)
					// })
					console.log(this.addBankForm?.get('ssn').value, "valueeeeee")
					console.log('error', err, err?.error_fields)
					if (err?.otherParams?.formcontrolname) {
						this.scrollToErrorFormControlName(err.otherParams.formcontrolname)
					}
					this.spinner.hide();//hide spinner
					// this.stateManagementService.setprogressBar(false);

					//check routing number error
					// err?.error_fields?.forEach(item => {
					if (err?.errors?.error.includes('Routing Number is invalid' || 'Invalid routing number')) {
						this.routingErrorMessage = 'Please enter correct routing number.'
						console.log('error mesage---->', this.ssnErrorMessage)
					}

					// })
					this.disableSubmitButton = false; //enable submit button

					return throwError(err);
				})
			)
			.subscribe(({ success, data }: any) => {
				this.spinner.hide();//hide spinner
				// this.stateManagementService.setprogressBar(false);
				if (success == true) {
					//save value in session storage to show "stripe can take upo 24 hours" message in modal on next step first time user omplete step 2
					if (!this.stepCompleted.includes('2')) {
						sessionStorage.setItem("showStripe24HourAlert", "yes");
					}

					this.disableSubmitButton = false; //enable submit button
					if (data.stripe_account_type == 'standard') {
						if (data.stripe_response.account_link) {
							window.open(data.stripe_response.account_link.url, "_self");
							// window.location.href=data.stripe_response.account_link.url;
						}
					}
					else {
						this.router.navigateByUrl('/', { skipLocationChange: true }).then(() =>
							this.router.navigate(['/affiliate/step3'])
						);
					}
					//save completed steps in local storage
					this.affiliateService.updateStepsLocal('2');
				}
			});
	}

	resetForm() {
		const keepValues = [
			this.addBankForm.controls.ssn.value,
		]

		this.addBankForm.patchValue({//affiliate account id
			BankName: '',
			BankAddress: '',
			AccountHolderFirstName: '',
			AccountHolderMiddleName: '',
			AccountHolderLastName: '',
			AccountNumber: '',
			Routing: '',
			AccountType: 'company',
			haveEin: 'yesEin',
			ein: '',
			currency: '',
			dobDay: '',
			dobMonth: '',
			dobYear: '',
			id_front_image: '',
			id_back_image: '',
		});
		this.addBankForm.controls.ssn.patchValue(keepValues[0]);
		this.expiryDateControl.reset();

		this.id_front_image = "";
		this.id_back_image = "";
		this.canChangeDocument = true;
	}

	/**
	 * Search a particular text value from list
	 * 
	 * @params type: String [Required] type of the calling field. Default ''
	 * @params text: String [Require] text to search for in the list
	 */
	searchGlobalValue(type: string = '', text: string) {
		if (text == '') {
			this.currencyOptions = this.currencyOptions_copy
		}
		else {
			// fetch the values matching the text
			let object_arr = this.globalFunctions.ListSearch('filter', this.currencyOptions, text, 'countryName')
			if (object_arr.length <= 0) {
				object_arr = this.globalFunctions.ListSearch('filter', this.currencyOptions, text, 'currency')
			}

			// assign the array
			if (object_arr.length > 0) {
				this.currencyOptions = object_arr
			} else {
				console.error('Could not find the specified value, ', text)
			}
		}
	}

	/**
	 * fill the value from form into the calling field
	 * 
	 * @params type: String [Required] type of the calling field. Default ''
	 * @params form_control: String [Required] Form key to Fill in/Pull off, the value from
	 */
	fillGlobalValue(type: string = '', form_control: string, autofill: boolean = false) {
		let object: any;
		if (autofill) {
			// fetch the phone country in current user logged in from local storage. Default is 'US'
			const current_user = localStorage.getItem('currentUser') ? JSON.parse(localStorage.getItem('currentUser')) : { phoneCountry: 'US' }
			object = this.globalFunctions.ListSearch('find', this.currencyOptions, current_user.phoneCountry, 'currencyCountry')
			console.log(object)
			this.selectedCountryName = object.currencyCountry
		}
		else {
			object = this.globalFunctions.ListSearch('filter', this.currencyOptions, this.f.currency.value, 'currency')
			object = this.globalFunctions.ListSearch('find', this.currencyOptions, 'us', 'currencyCountry')
		}

		this.SetFormValue(form_control, object['currency'] + '-' + object['currencyCountry'])

		// assign the object value
		if (object) {
			return `${object['countryName']} - ${object['symbol']}`
		}
		else {
			return ''
		}
	}

	SetFormValue(form_control: string, value: any) {
		this.addBankForm.get(form_control).setValue(value)
		this.addBankForm.updateValueAndValidity()
	}


	selectGlobalValue(type: string, selected_value: any, form_control: string, autofill: boolean = false) {
		const object = this.globalFunctions.ListSearch('find', this.currencyOptions, selected_value, 'currency')

		if (object) {
			this.SetFormValue(form_control, object['currency'])
		}
	}

	selectDropdownAccount() {
		$('.selectAccountLabel').removeClass('selectAccountLabel ').addClass('select-account-label');
	}

	selectDropdownDay() {
		$('.selectDayLabel').removeClass('selectDayLabel ').addClass('select-day-label');
		console.log("in dobbbbhbbb")
		this.dobErrorMessage = ""
	}
	selectDropdownMonth() {
		$('.selectMonthLabel').removeClass('selectMonthLabel ').addClass('select-month-label');
		console.log("in dobbbbhbbb")
		this.dobErrorMessage = ""
	}
	selectDropdownYear() {
		$('.selectYearLabel').removeClass('selectYearLabel ').addClass('select-year-label');
		console.log("in dobbbbhbbb")
		this.dobErrorMessage = ""
	}
	selectDropdownCurrency() {
		$('.selectCurrencyLabel').removeClass('selectCurrencyLabel ').addClass('select-currency-label');
	}
	selectDropdownCountry() {
		$('.selectCountryLabel').removeClass('selectCountryLabel ').addClass('select-country-label');
	}
	selectDropdownState() {
		$('.selectStateLabel').removeClass('selectStateLabel ').addClass('select-state-label');
	}
	selectDropdownExMonth() {
		$('.selectExMonthLabel').removeClass('selectExMonthLabel ').addClass('select-ex-month-label');
	}
	selectDropdownExYear() {
		$('.selectExYearLabel').removeClass('selectExYearLabel ').addClass('select-ex-year-label');
	}

	acceptRejectConsent(event) {
		this.spinner.show();//show spinner
		console.log(event.checked);
		if (event.checked) {
			var permission = 'yes';
		}
		else {
			var permission = 'no';
		}
		this.affiliateService.chargeBackPermission(this.affiliateId, permission)
			.pipe(
				catchError(err => {
					this.spinner.hide();//hide spinner
					return throwError(err);
				})
			).subscribe(result => {

				this.spinner.hide();//hide spinner
			});
	}

	chosenYearHandler(normalizedYear: moment.Moment) {
		const ctrlValue = (this.expiryDateControl.value || moment()).clone();
		const currentMonth = this.minExpiryDate.month();
		const selectedYear = Math.max(normalizedYear.year(), this.minExpiryDate.year());

		ctrlValue.year(selectedYear);
		if (selectedYear === this.minExpiryDate.year() && ctrlValue.month() < currentMonth) {
			ctrlValue.month(currentMonth);
		}

		this.expiryDateControl.setValue(ctrlValue);
	}

	chosenMonthHandler(normalizedMonth: moment.Moment, datepicker: any) {
		const ctrlValue = (this.expiryDateControl.value || moment()).clone();
		let selectedDate = normalizedMonth.clone().startOf('month');

		if (selectedDate.isBefore(this.minExpiryDate, 'month')) {
			selectedDate = this.minExpiryDate.clone();
		}

		ctrlValue.month(selectedDate.month());
		ctrlValue.year(selectedDate.year());
		this.expiryDateControl.setValue(ctrlValue);

		// Patch Form Values
		const monthStr = (selectedDate.month() + 1).toString();
		const yearStr = selectedDate.year().toString();

		this.addBankForm.patchValue({
			primaryMM: monthStr,
			primaryYY: yearStr
		});

		// Mark as dirty/touched for validation display
		this.addBankForm.get('primaryMM').markAsDirty();
		this.addBankForm.get('primaryYY').markAsDirty();

		datepicker.close();
	}
}
