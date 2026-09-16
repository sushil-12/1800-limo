import { Component, OnInit, ViewChild, ElementRef, NgZone, EventEmitter, Input } from '@angular/core';
import { AdminService } from '../../../services/admin.service';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { StateManagementService } from '../../../services/statemanagement.service';
import { Router, ActivatedRoute } from '@angular/router';
import { catchError } from 'rxjs/operators';
import { NgxSpinnerService } from "ngx-spinner";
import { throwError, of } from 'rxjs';
import { HttpClient, HttpHeaders } from "@angular/common/http";
import { CustomvalidationService } from '../../../services/customvalidation.service';
import { SharedModule } from '../../shared/shared.module';
import { CommonService } from '../../../services/common.service';
import { ThemePalette } from '@angular/material/core';
import { ErrorDialogService } from 'src/app/services/error-dialog/errordialog.service';
declare var $: any;

@Component({
	selector: 'app-affiliate-step2',
	templateUrl: './affiliate-step2.component.html',
	styleUrls: ['./affiliate-step2.component.scss']
})
export class AffiliateStep2Component implements OnInit {
	@ViewChild('search1') search1!: ElementRef;

	geoCoder!: google.maps.Geocoder;

	public addBankForm: FormGroup;
	public requestAddressChangeForm: FormGroup;
	public submittedForm: boolean;
	public disableSubmitButton: boolean = false;
	public response: any;
	public affiliateId: string;
	public stepCompleted: any;
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
	public id_back_image_id: string;
	public imageSrc: string;
	public cardToDelete: number;
	public date25YearsBack: string;
	public stripeErrors: Array<Object>;
	public modalImage: string;
	public dobDay: Array<number> = [];
	public dobYear: Array<number> = [];
	public canChangeDocument: Boolean = false;
	public displayMsg: string;
	public alertMessage: string;
	public submittedRequestAddressChangeForm: boolean;
	public disableSubmitRequestAddressChangeButton: boolean = false;
	public showProgressBar: boolean = false;
	public haveEinNo: boolean = true;
	public cardsRes: any;
	enableSsnField: boolean = false;
	ssn_copy: any;
	ssnErrorMessage: string;
	addressErrorMessage: string;
	routingErrorMessage: string;
	dobErrorMessage: string;
	public AddressCheckStripe = ['address', 'street', 'city', 'country'];
	isSsnSelected: boolean = false;
	isAddressSelected: boolean = false;
	isRoutingSelected: boolean = false;
	disabled = false;
	color: ThemePalette = 'accent';

	@Input() closeTab: EventEmitter<any> = new EventEmitter();
	stepsObj: any;
	filteredOptions: any;
	badgeOptions: any;
	cards: any;
	TaxIdMatch: string;
	activeAddressDropdown: boolean = false;
	addressOptions: any[] = [];
	addressSearchLoading: boolean = false;
	private customPlacesService: google.maps.places.PlacesService | null = null;
	private addressSearchVersion = 0;

	// License OCR scan (limortservice) - reads the uploaded ID photo and prefills the business address.
	private readonly scanLicenseUrl = "http://10.20.10.135:3000/api/scan-license";
	private readonly scanLicenseHeaders = new HttpHeaders({
		"x-secret": "limoapi_admin_secret_2024_xyz789",
		"x-api-key": "limoapi_notifications_secret_2024_xyz789",
	});

	constructor(
		private adminService: AdminService,
		private router: Router,
		private formBuilder: FormBuilder,
		private httpClient: HttpClient,
		private spinner: NgxSpinnerService,
		private activatedroute: ActivatedRoute,
		private stateManagementService: StateManagementService,
		private ngZone: NgZone,
		private el: ElementRef,
		private customValidator: CustomvalidationService,
		private commonServices: CommonService,
		private globalFunctions: SharedModule,
		private errors: ErrorDialogService
	) { }


	ngOnInit(): void {

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
		const currentUser = JSON.parse(sessionStorage.getItem("affiliateUserData"));
		this.affiliateId = sessionStorage.getItem("affiliateId");
		this.stepCompleted = this.adminService.getLocalStepsCompleted();
		//add amenity form validation
		this.addBankForm = this.formBuilder.group({
			id: [''],//bank id for edit purpose
			acc_id: [this.affiliateId, [Validators.required, Validators.pattern("^[0-9].*$")]],//affiliate account id
			BankName: [''],
			BankAddress: [''],
			AccountHolderFirstName: ['', Validators.required],
			AccountHolderLastName: ['', Validators.required],
			AccountNumber: ['', [Validators.required, this.customValidator.dashValidator(), this.customValidator.plusValidator()]],
			Routing: ['', [Validators.required]],
			AccountType: ['company', Validators.required],
			ssn: ['', [Validators.required, Validators.pattern("^[0-9*]*$"), this.customValidator.dashValidator(), this.customValidator.plusValidator()]],
			haveEin: ['yesEin'],
			ein: ['', []],
			currency: ['', Validators.required],
			currencyShow: [''],
			dobDay: ['', Validators.required],
			dobMonth: ['', Validators.required],
			dobYear: ['', Validators.required],
			id_front_image: ['', Validators.required],
			id_back_image: [''],
			address: ['', Validators.required],
			latitude: ['', Validators.required],
			longitude: ['', Validators.required],
			badge_city: [''],
			badge_city_name: [''],
			street: [''],
			city: [''],
			state: ['', Validators.required],
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
		//load list of currencies
		this.httpClient.get("assets/json/currencyOptions.json").subscribe(data => {
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
		})
		this.adminService.getAllEnableBadgeCities().pipe(
			catchError(err => {
				return throwError(err)
			})
		).subscribe((res: any) => {
			this.badgeOptions = res?.data
			this.filteredOptions = res?.data
		})
		this.spinner.show()
		this.httpClient.get("assets/json/countryStateList.json").subscribe(data => {
			this.spinner.hide()
			this.countryOptions = data;
			if (this.affiliateId) {
				if (this.stepCompleted.includes('2')) {
					this.isStep2Completed = true;
					// this.stateManagementService.setprogressBar(true);

					this.adminService.getBankOfAffiliate(this.affiliateId)
						.pipe(
							catchError(err => {
								// this.stateManagementService.setprogressBar(false);
								return throwError(err);
							})
						).subscribe(result => {
							this.response = result;
							//to show stripe errors at the top
							if (this.response.data.stripeDetail.stripe_errors) {
								this.stripeErrors = this.response.data.stripeDetail.stripe_errors;
							}
							//set images and their ID

							this.id_front_image = this.response.data.bankinfo.id_front_image.image;
							this.id_back_image = this.response.data.bankinfo.id_back_image.image;
							this.id_front_image_id = this.response.data.bankinfo.id_front_image.ID;
							this.id_back_image_id = this.response.data.bankinfo.id_back_image.ID;
							//Documents changable or not.
							if (this.response.data.stripeDetail.additional_doc_verification_status == 'unverified') {
								this.canChangeDocument = true;
							}
							else {
								this.canChangeDocument = false;
							}

							this.addBankForm.patchValue({
								id: this.response.data.bankinfo.id,
								BankName: this.response.data.bankinfo.BankName,
								BankAddress: this.response.data.bankinfo.BankAddress,
								AccountHolderFirstName: this.response.data.bankinfo.AccountHolderFirstName,
								AccountHolderLastName: this.response.data.bankinfo.AccountHolderLastName,
								AccountNumber: this.response.data.bankinfo.AccountNumber,
								Routing: this.response.data.bankinfo.Routing,
								AccountType: this.response.data.bankinfo.AccountType,
								currency: this.response.data.bankinfo.currency,
								ssn: this.showOnlyLast4Digit(this.response.data.bankinfo.ssn),
								haveEin: this.response.data.bankinfo.ein ? 'yesEin' : 'noEin',
								ein: this.response.data.bankinfo.ein,
								address: this.response.data.bankinfo.address,
								latitude: this.response.data.bankinfo.latitude,
								longitude: this.response.data.bankinfo.longitude,
								street: this.response.data.bankinfo.street,
								unit: this.response.data.bankinfo.unit,
								city: this.response.data.bankinfo.city,
								state: this.response.data.bankinfo.state,
								country: this.response.data.bankinfo.country,
								zipCode: this.response.data.bankinfo.zipCode,
								dobDay: this.response.data.bankinfo.dobDay,
								dobMonth: this.response.data.bankinfo.dobMonth,
								dobYear: this.response.data.bankinfo.dobYear,
								id_front_image: this.response.data.bankinfo.id_front_image.ID,
								id_back_image: this.response.data.bankinfo.id_back_image.ID,
							});
							this.ssn_copy = this.response?.data?.bankinfo?.ssn
							this.isSsnSelected = true
							this.isAddressSelected = true
							this.isRoutingSelected = true
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
											console.log("in if addressssssssss-->")
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
							console.log("enableSsnField", this.enableSsnField, this.ssn_copy)
							this.currencySelection(this.response.data.bankinfo.currency)
							this.haveEin(this.response.data.bankinfo.ein ? 'yesEin' : 'noEin');
							this.changeCountry(this.response.data.bankinfo.country);//for selected country
							// this.stateManagementService.setprogressBar(false);
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
											badge_city: i?.id,
											badge_city_name: i?.name
										})
									}
								})
							})


						});
				}
				else {

					this.canChangeDocument = true;//can add or change documents
					// this.canChangeAddress = true;//can add or change address

					//for selected country
					this.changeCountry(currentUser.CellNumberCountry.toUpperCase());
					this.addBankForm.patchValue({
						country: currentUser.CellNumberCountry.toUpperCase(), AccountHolderFirstName: currentUser?.FirstName,
						AccountHolderMiddleName: currentUser?.MiddleName,
						AccountHolderLastName: currentUser?.LastName
					});
				}
			}
			else {
				//for selected country
				this.changeCountry(currentUser.CellNumberCountry.toUpperCase());
				this.addBankForm.patchValue({
					country: currentUser.CellNumberCountry.toUpperCase()
				});
			}
		})

		this.loadCards(this.affiliateId)

	}

	ngAfterViewInit(): void {
		this.geoCoder = new google.maps.Geocoder;
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
		if (!value) {
			return '';
		}
		if (typeof value === 'string') {
			return value;
		}
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
			service.getDetails(
				{
					placeId,
					fields: ['formatted_address', 'geometry', 'place_id', 'name', 'address_components', 'types'],
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

	private applySelectedAddress(place: google.maps.places.PlaceResult): void {
		if (!place.geometry?.location) {
			return;
		}

		const formattedAddress = place.formatted_address ?? '';
		const placeName = place.name ?? '';
		const displayAddress = placeName ? `${placeName} - ${formattedAddress}` : formattedAddress;
		const valuesToPatch: any = {
			latitude: place.geometry.location.lat(),
			longitude: place.geometry.location.lng(),
			address: displayAddress,
			street: '',
			city: '',
			state: '',
			zipCode: '',
		};

		let countryCode = '';
		place.address_components?.forEach((component) => {
			const types = component.types || [];
			if (types.includes('country')) {
				countryCode = component.short_name;
				valuesToPatch.country = component.short_name;
			} else if (types.includes('administrative_area_level_1')) {
				valuesToPatch.state = component.short_name;
			} else if (types.includes('administrative_area_level_3') || types.includes('locality')) {
				if (!valuesToPatch.city) {
					valuesToPatch.city = component.long_name;
				}
			} else if (types.includes('route') || types.includes('street_number')) {
				valuesToPatch.street = valuesToPatch.street
					? `${valuesToPatch.street} ${component.long_name}`.trim()
					: component.long_name;
			} else if (types.includes('postal_code')) {
				valuesToPatch.zipCode = component.long_name;
			}
		});

		this.addBankForm.patchValue(valuesToPatch);
		if (countryCode) {
			this.changeCountry(countryCode);
			if (valuesToPatch.state) {
				this.addBankForm.get('state')?.setValue(valuesToPatch.state);
			}
		}
		this.addressErrorMessage = '';
		this.isAddressSelected = true;
		this.addBankForm.updateValueAndValidity();
	}


	showOnlyLast4Digit(value) {
		if (value) {
			value = value.toString()
			return '*'.repeat(value.length - 4) + value.slice(-4)
		} else {
			return ''
		}
	}

	get f() {
		return this.addBankForm.controls;
	}

	shouldShowAddressClear(): boolean {
		const controlValue = this.addBankForm?.get('address')?.value;
		const nativeValue = this.search1?.nativeElement?.value;
		return !!String(controlValue || nativeValue || '').trim();
	}

	clearAddressField(): void {
		this.addBankForm.patchValue({
			address: '',
			latitude: '',
			longitude: '',
			street: '',
			city: '',
			state: '',
			country: '',
			zipCode: '',
			unit: ''
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
		this.removeErrorSsn(value, 'address');
		this.addBankForm.patchValue({
			address: value || '',
			latitude: '',
			longitude: ''
		}, { emitEvent: false });
		this.addBankForm.get('latitude')?.updateValueAndValidity({ emitEvent: false });
		this.addBankForm.get('longitude')?.updateValueAndValidity({ emitEvent: false });
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
		});
	}
	haveEin(haveEinNo) {
		switch (haveEinNo) {
			case 'noEin': {
				this.haveEinNo = false;
				this.addBankForm.patchValue({
					haveEin: false
				})
				break;
			}
			case 'yesEin': {
				this.haveEinNo = true;
				console.log('validation updated')
				this.addBankForm.patchValue({
					haveEin: true
				})
				this.addBankForm.controls['ein'].setValidators([Validators.required])
				this.addBankForm.controls['ein'].updateValueAndValidity()
				break;
			}
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

	changeCountry(selectedCountryCode) {
		let selectedCountryData: any;

		selectedCountryData = this.countryOptions.filter(function (countryOption) {
			return countryOption.countryShortCode == selectedCountryCode;
		});
		if (selectedCountryData) {
			this.stateOptions = selectedCountryData[0].regions;
		}
	}

	handleBadgeCity(value: any) {
		this.filteredOptions = this.badgeOptions.filter((i: any) => i.name.toLowerCase().startsWith(value.toLowerCase()))
		console.log(value, this.filteredOptions)
	}
	selectBadgeCity(option: any, isUserInput) {
		console.log('in function selectBadgeCity-->>>', isUserInput)
		if (isUserInput) {
			this.addBankForm.patchValue({
				badge_city: option.id
			})
			// this.addAffiliateAccountForm.updateValueAndValidity()
		}
	}

	handleCurrency(value: any) {
		console.log(value, this.currencyOptions)
		this.currencyOptions = this.currencyOptions_copy.filter((i: any) => i.countryName.toLowerCase().includes(value.toLowerCase()))
	}
	selectCurrency(option: any, isUserInput) {
		console.log('in function selectBadgeCity-->>>', isUserInput, option)
		if (isUserInput) {
			this.addBankForm.patchValue({
				currency: option.currency + '-' + option.currencyCountry
			})
			// this.addAffiliateAccountForm.updateValueAndValidity()
		}
	}
	onSelectionChange(event) {
		console.log('event-sdfksjfsldkfhsdflkdshf>>', event.option, event.option.value, event.option.viewValue)
		this.addBankForm.patchValue({
			currency: event.option.value,
			currencyShow: event.option.viewValue
		})
	}
	currencySelection(value) {
		this.currencyOptions_copy.map(i => {
			let concatValue = i.currency + '-' + i.currencyCountry
			if (value == concatValue) {
				console.log('select option-->>', value)
				this.addBankForm.patchValue({
					currencyShow: i.countryName + '-' + i.symbol
				})
			}
		})
	}
	changeIdentityCountry(selectedCountryCode) {
		this.httpClient.get("assets/json/stripeDocumentData.json").subscribe((stripeDocumentData: any) => {
			const selectedCountryData = stripeDocumentData.filter(function (eachCountryObj) {
				return eachCountryObj.value[0].value === selectedCountryCode;
			});
			this.countryDocumentsArray = selectedCountryData[0].value[1].value.value;
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
	async idCardImageChange1(dataUrl, imageType, imageId = null) {
		if (!await this.commonServices.handleFile(event)) {
			return;
		}
		this.stateManagementService.setprogressBar(true);
		this.imageSrc = dataUrl;
		this.adminService.uploadVehicleImage(this.imageSrc)
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
	}
	async idCardImageChange(event, imageType, imageId = null) {
		if (!await this.commonServices.handleFile(event)) {
			return;
		}
		// this.stateManagementService.setprogressBar(true);
		const reader = new FileReader();
		if (event.target.files && event.target.files.length)
			console.log(event.target.files, ">>>>>>>>>>>><<<<<<<<<<", event.target.files.length)
		{
			const [file] = event.target.files;
			reader.readAsDataURL(file);
			reader.onload = () => {
				this.imageSrc = reader.result as string;
				this.adminService.uploadVehicleImage(this.imageSrc)
					.pipe(
						catchError(err => {
							// this.stateManagementService.setprogressBar(false);
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
						// this.stateManagementService.setprogressBar(false);
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

	addCardClick(accountId) {
		this.router.navigate(['/admin/add-card'], { queryParams: { accountType: 'blackCarLimoBus', accountId: this.affiliateId, for: 'affiliate' } })
	}
	enableDisableClicked(id) {
		this.cardToDelete = id;
		this.alertMessage = "Are you sure you want to delete this Card?"
	}
	delete() {
		// this.stateManagementService.setprogressBar(true);
		$('#deleteConfirmationModal').modal('hide');
		this.adminService.deleteCard(this.cardToDelete, this.affiliateId)
			.pipe(
				catchError(err => {
					// this.stateManagementService.setprogressBar(false);
					return throwError(err);
				})
			).subscribe(result => {
				this.router.navigateByUrl('/RefreshComponent', { skipLocationChange: true }).then(() => {
					this.router.navigate(['/admin/affiliate/step2']);
				});
				// this.stateManagementService.setprogressBar(false);
			});
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
		// console.log(JSON.stringify(this.addVehicleRatesForm.value));
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

		this.addBankForm.patchValue({
			ssn: this.ssn_copy
		})



		this.addBankForm.value.stepCompleted = this.adminService.getUpdatedStepsLocal('2');
		console.log(this.addBankForm.value);
		// console.log(JSON.stringify(this.addVehicleRatesForm.value));
		this.disableSubmitButton = true; //disable submit button
		this.isRoutingSelected = true;
		this.spinner.show();
		this.adminService.addBankOfAffiliate(this.addBankForm.value)
			.pipe(
				catchError(err => {
					this.addBankForm.patchValue({
						ssn: this.showOnlyLast4Digit(this.ssn_copy)
					})
					this.spinner.hide();//hide spinner
					this.disableSubmitButton = false; //enable submit button
					if (err?.errors?.error.includes('Routing Number is invalid' || 'Invalid routing number')) {
						this.routingErrorMessage = 'Please enter correct routing number.'
						console.log('error mesage---->', this.ssnErrorMessage)
					}
					return throwError(err);
				})
			)
			.subscribe(({ success, data }: any) => {
				// this.response = result;
				this.spinner.hide();//hide spinner
				this.disableSubmitButton = false; //enable submit button

				if (data.stripe_account_type == 'standard') {
					if (data.stripe_response.account_link) {
						window.open(data.stripe_response.account_link.url, "_self");
						// window.location.href=data.stripe_response.account_link.url;
					}
				}
				else {
					this.router.navigateByUrl('/', { skipLocationChange: true }).then(() =>
						this.router.navigate(['/admin/affiliate/step3'])
					);
				}
				// this.router.navigateByUrl('/', { skipLocationChange: true }).then(() =>
				// 	this.router.navigate(['/admin/affiliate/step3'])
				// );
			});
	}
	closeButton() {
		this.closeTab.emit();
	}

	loadCards(accountId) {
		// Load Our cards using API
		this.adminService.cardsList(accountId).then(result => {
			this.cardsRes = result;
			this.cards = this.cardsRes.data;
			console.log("<><><>><>><>><><><<><<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<", JSON.stringify(this.cards))

			this.stateManagementService.setprogressBar(false);
		});
	}


	resetForm() {
		const keepValues = [
			this.addBankForm.controls.ssn.value,
		]

		this.addBankForm.reset();
		this.addBankForm.controls.ssn.patchValue(keepValues[0]);
		this.id_front_image = "";
		this.id_back_image = "";
	}
	showImageInModal(imageUrl) {
		this.modalImage = imageUrl;
		$("#imageModal").addClass("showImage");
		$("#imageModal").removeClass("d-none");
	}
	fillGlobalValue(type: string = '', form_control: string, autofill: boolean = false) {
		let object: any;
		if (autofill) {
			// fetch the phone country in current user logged in from local storage. Default is 'US'
			const current_user = localStorage.getItem('currentUser') ? JSON.parse(localStorage.getItem('currentUser')) : { phoneCountry: 'US' }
			object = this.globalFunctions.ListSearch('find', this.currencyOptions, current_user.phoneCountry, 'currencyCountry')
			console.log(object)
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
	selectDropdownExMonth() {
		$('.selectExMonthLabel').removeClass('selectExMonthLabel ').addClass('select-ex-month-label');
	}

	selectDropdownExYear() {
		$('.selectExYearLabel').removeClass('selectExYearLabel ').addClass('select-ex-year-label');
	}

	selectDropdownCurrency() {
		$('.selectCurrencyLabel').removeClass('selectCurrencyLabel ').addClass('select-currency-label');
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
		this.adminService.chargeBackPermission(this.affiliateId, permission)
			.pipe(
				catchError(err => {
					this.spinner.hide();//hide spinner
					return throwError(err);
				})
			).subscribe(result => {

				this.spinner.hide();//hide spinner
			});
	}
}
