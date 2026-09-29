import { Component, OnInit, AfterViewInit, Input, EventEmitter, ViewChild, ElementRef, NgZone } from '@angular/core';
import { AuthService } from '../../../services/auth.service';
import { StateManagementService } from '../../../services/statemanagement.service';
import { FormGroup, FormBuilder, Validators, FormArray, FormControl, AbstractControl, ValidatorFn } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NgxSpinnerService } from "ngx-spinner";
import { catchError, map, startWith } from 'rxjs/operators';
import { throwError, from, Observable } from 'rxjs';
import { CustomvalidationService } from '../../../services/customvalidation.service';
import { data } from 'jquery';
import { AdminService } from '../../../services/admin.service';
import { HttpClient } from '@angular/common/http';
import { ErrorDialogService } from '../../../services/error-dialog/errordialog.service';
import { CommonService } from '../../../services/common.service'
import * as intlTelInput from 'intl-tel-input';
declare var $: any;

@Component({
	selector: 'app-affiliate-step1',
	templateUrl: './affiliate-step1.component.html',
	styleUrls: ['./affiliate-step1.component.scss']
})

export class AffiliateStep1Component implements OnInit, AfterViewInit {
	@ViewChild('search1') search1!: ElementRef;
	@ViewChild('cellInput') cellInput!: ElementRef;
	@ViewChild('dispatchInput') dispatchInput!: ElementRef;
	@ViewChild('companyCellNumberInput') companyCellNumberInput!: ElementRef;
	@ViewChild('FaxInput') FaxInput!: ElementRef;

	public addAffiliateAccountForm: FormGroup;
	public submittedForm: boolean;
	public disableSubmitButton: boolean = false;
	public response: any;
	public response2: any;
	public languages: any;
	public associations: any;
	public languagesFormControl: any;
	public AssociationsFormControl: any;
	public affiliateId: string;
	public imageSrc: string;
	public affiliateType: string;
	CellNumberObject: any;
	BusinessFrontPhoto: any;
	BusinessBackPhoto: any;
	BusinessFrontPhotoId: any;
	BusinessBackPhotoId: any;
	CompanyCellNumberObject: any;
	DispatchObject: any;
	FaxObject: any;
	showCompanyInformation: boolean;
	selectedAffiliate: string;
	affiliateInstructionHeading: string;
	affiliateInstruction: string;
	currentUser: any;
	modalAlertMessage: string;
	public modalImage: string;

	/*
	 * "Confirm E-mail" fields shown next to the affiliate / dispatch e-mail.
	 * Kept outside addAffiliateAccountForm so they are never sent to the API.
	 */
	public confirmEmailControl = new FormControl('', this.confirmEmailValidator('Email', () => this.showConfirmEmail));
	public confirmDispatchEmailControl = new FormControl('', this.confirmEmailValidator('dispatchEmail', () => this.showConfirmDispatchEmail));
	/** E-mails as last saved; a saved address was already confirmed, so its confirm field stays hidden. */
	private savedEmail: string = '';
	private savedDispatchEmail: string = '';
	public notify_sms: boolean;
	public notify_email: boolean;
	badgeOptions: string[] = [];
	filteredOptions: any;
	public startBusinessYears: Array<Object>;
	// stateManagementService: any;

	constructor(
		private adminService: AdminService,
		private router: Router,
		private spinner: NgxSpinnerService,
		private formBuilder: FormBuilder,
		private authService: AuthService,
		private activatedroute: ActivatedRoute,
		private stateManagementService: StateManagementService,
		private ngZone: NgZone,
		private httpClient: HttpClient,
		private customValidator: CustomvalidationService,
		private errorModal: ErrorDialogService,
		private commonServices: CommonService,
	) { }
	@Input() closeTab: EventEmitter<any> = new EventEmitter();
	// @ViewChild('targetDiv', { static: false }) targetDiv: ElementRef;

	//google map autocomplete
	latitude: number;
	longitude: number;
	zoom: number;
	address: string;
	geoCoder!: google.maps.Geocoder;

	ngOnInit(): void {

		this.currentUser = this.authService.currentUserValue;
		//add amenity form validation
		this.buildAffiliateAccountForm();


		this.addAffiliateAccountForm.patchValue({ AffiliateType: 'black_limo_operator' })
		this.affiliateTypeSwitch("black_limo_operator");

		this.spinner.show()
		// this.stateManagementService.setprogressBar(true);
		// Load Our languages using API
		// this.adminService.getAllEnableBadgeCities().pipe(
		// 	catchError(err => {
		// 		return throwError(err)
		// 	})
		// ).subscribe((res: any) => {
		// 	this.badgeOptions = res?.data
		// 	this.filteredOptions = res?.data
		// })

		this.httpClient
			.get("assets/json/businessYear.json")
			.subscribe((data: any) => {
				this.startBusinessYears = data;
			});
		window.scrollTo({
			top: 0
		})
		this.adminService.getAssicationsLanguages()
			.pipe(
				catchError(err => {
					// this.stateManagementService.setprogressBar(false);
					return throwError(err);
				})
			).subscribe(result => {
				this.response = result;
				let languagesData = this.response.data.languages;
				this.languages = languagesData.sort((a, b) => a.name.localeCompare(b.name));
				this.associations = this.response.data.associations;

				this.affiliateId = sessionStorage.getItem("affiliateId");
				this.affiliateType = sessionStorage.getItem("affiliateType") != 'all-operators' ? sessionStorage.getItem("affiliateType") : 'black_limo_operator';
				this.addAffiliateAccountForm.patchValue({
					AffiliateType: this.affiliateType
				});
				if (this.affiliateId) {
					this.adminService.getAffiliateAccount(this.affiliateId)
						.pipe(
							catchError(err => {
								// this.stateManagementService.setprogressBar(false);
								return throwError(err);
							})
						).subscribe(result2 => {
							this.response2 = result2;
							// this.badgeOptions?.map((i: any) => {
							// 	if (i.id == this.response2.data.badge_city) {
							// 		this.addAffiliateAccountForm.patchValue({
							// 			badge_city: i.id,
							// 			badge_city_name: i.name
							// 		})
							// 	}
							// })
							this.addAffiliateAccountForm.patchValue({
								id: this.response2.data.id,
								FirstName: this.response2.data.FirstName,
								LastName: this.response2.data.LastName,
								MiddleName: this.response2.data.MiddleName,
								Email: this.response2.data.Email,
								CellNumber: this.response2.data.CellNumber,
								Gender: this.response2.data.Gender,
								AffiliateType: this.response2.data.AffiliateType,
								FirstYearBusiness: this.response2.data.FirstYearBusiness,
							});
							this.affiliateTypeSwitch(this.response2.data.AffiliateType)

							//saved e-mails are already confirmed; only a changed address needs retyping
							this.savedEmail = this.response2.data.Email || '';
							this.savedDispatchEmail = this.response2.data.dispatchEmail || '';

							sessionStorage.setItem("affiliateUserData", JSON.stringify(this.response2.data));
							sessionStorage.setItem("affiliateType", this.response2.data.AffiliateType)

							console.log(this.response2.data.CellNumberCountry, "cellnumbercountry")
							//set country flag in phone number fields
							this.CellNumberObject.setCountry(this.response2.data.CellNumberCountry);
							console.log(this.response2.data.AffiliateType, "response not cominng")
							if (this.response2.data.AffiliateType != 'gig_operator') {
								//set images and their ID
								this.BusinessFrontPhoto = this.response2.data.BusinessFrontPhoto.image;
								this.BusinessBackPhoto = this.response2.data.BusinessBackPhoto.image;
								this.BusinessFrontPhotoId = this.response2.data.BusinessFrontPhoto.ID;
								this.BusinessBackPhotoId = this.response2.data.BusinessBackPhoto.ID;
								this.addAffiliateAccountForm.patchValue({
									CompanyName: this.response2.data.CompanyName,
									DBA: this.response2.data.DBA,
									Dispatch: this.response2.data.Dispatch,
									dispatchEmail: this.response2.data.dispatchEmail,
									CompanyCellNumber: this.response2.data.CompanyCellNumber,
									Fax: this.response2.data.Fax,
									cpcn_tpc: this.response2.data.cpcn_tpc,
									BusinessFrontPhoto: this.response2.data.BusinessFrontPhoto.ID,
									BusinessBackPhoto: this.response2.data.BusinessBackPhoto.ID,
								});

								this.CompanyCellNumberObject.setCountry(this.response2.data.CompanyCellNumberCountry);
								this.DispatchObject.setCountry(this.response2.data.DispatchCountry);
								this.FaxObject.setCountry(this.response2.data.FaxCountry);
							}

							const languagesGet: FormArray = this.addAffiliateAccountForm.get('LanguagesGet') as FormArray;
							const languageSpoken: FormArray = this.addAffiliateAccountForm.get('LanguagesSpoken') as FormArray;
							var i;
							const totalLanguages: any = this.languages;
							const selectedLanguages = this.response2.data.LanguagesSpoken;
							for (i = 0; i < totalLanguages.length; i++) {
								// console.log(totalLanguages[i]);
								var checkedLanguage = selectedLanguages.findIndex(function (post) {
									if (post == totalLanguages[i].id)
										return true;
								});
								// console.log(checkedLanguage);
								if (checkedLanguage >= 0) {
									var checkBool = true;
								}
								else {
									var checkBool = false;
								}
								languagesGet.push(new FormControl(checkBool));
							}
							this.languagesFormControl = languagesGet.controls;
							var j;
							for (j = 0; j < selectedLanguages.length; j++) {
								languageSpoken.push(new FormControl(selectedLanguages[j]));
							}
							// console.log(languageSpoken);
							//get and set languages ends

							//get and set associations
							const AssociationsGet: FormArray = this.addAffiliateAccountForm.get('AssociationsGet') as FormArray;
							const associations: FormArray = this.addAffiliateAccountForm.get('Associations') as FormArray;
							var i;
							const totalAssociations: any = this.associations;
							const selectedAssociations = this.response2.data.Associations;
							for (i = 0; i < totalAssociations.length; i++) {
								var checkedAssociation = selectedAssociations.findIndex(function (post) {
									if (post == totalAssociations[i].id)
										return true;
								});
								if (checkedAssociation >= 0) {
									var checkBool = true;
								}
								else {
									var checkBool = false;
								}
								AssociationsGet.push(new FormControl(checkBool));
							}
							this.AssociationsFormControl = AssociationsGet.controls;
							var j;
							for (j = 0; j < selectedAssociations.length; j++) {
								associations.push(new FormControl(selectedAssociations[j]));
							}
							console.log('associations');
							//
							// this.stateManagementService.setprogressBar(false);

						});
				} else {
					this.addAffiliateAccountForm.patchValue({
						AffiliateType: (this.affiliateType ? this.affiliateType : 'black_limo_operator')
					});
					// this.stateManagementService.setprogressBar(false);

					this.onLanguageChange('1', true);//set english as default language

				}

				this.spinner.hide()
				// this.stateManagementService.setprogressBar(false);
			});

		if (sessionStorage.getItem("affiliateType") != "all-operators") {
			this.affiliateTypeSwitch(sessionStorage.getItem("affiliateType"))
		}
		window.scrollTo(0, 0);
	}


	ngAfterViewInit() {

		this.initallphonefields()

	}

	initallphonefields() {

		const telOptions = {
			initialCountry: 'us',
			preferredCountries: ['us', 'ca', 'mx', 'gb'],
			separateDialCode: true,
			nationalMode: true,
			utilsScript: 'https://cdn.jsdelivr.net/npm/intl-tel-input@18.2.1/build/js/utils.js'
		};

		if (this.cellInput) {
			this.CellNumberObject = intlTelInput(this.cellInput.nativeElement, telOptions);

			this.addCustomCountrySearch(this.cellInput.nativeElement);
			this.cellInput.nativeElement.addEventListener('countrychange', () => {
				const countryData = this.CellNumberObject.getSelectedCountryData();
				console.log("in country chnage", countryData)
				this.onCountryChange(countryData, 'CellNumber');
			});
		}

		if (this.dispatchInput) {
			this.DispatchObject = intlTelInput(this.dispatchInput.nativeElement, telOptions);

			this.addCustomCountrySearch(this.dispatchInput.nativeElement);
			this.dispatchInput.nativeElement.addEventListener('countrychange', () => {
				const countryData = this.DispatchObject.getSelectedCountryData();
				console.log("in country chnage", countryData)
				this.onCountryChange(countryData, 'Dispatch');
			});
		}

		if (this.FaxInput) {
			this.FaxObject = intlTelInput(this.FaxInput.nativeElement, telOptions);

			this.addCustomCountrySearch(this.FaxInput.nativeElement);
			this.FaxInput.nativeElement.addEventListener('countrychange', () => {
				const countryData = this.FaxObject.getSelectedCountryData();
				console.log("in country chnage", countryData)
				this.onCountryChange(countryData, 'Fax');
			});
		}
		if (this.companyCellNumberInput) {
			this.CompanyCellNumberObject = intlTelInput(this.companyCellNumberInput.nativeElement, telOptions);

			this.addCustomCountrySearch(this.companyCellNumberInput.nativeElement);
			this.companyCellNumberInput.nativeElement.addEventListener('countrychange', () => {
				const countryData = this.CompanyCellNumberObject.getSelectedCountryData();
				console.log("in country chnage", countryData)
				this.onCountryChange(countryData, 'CompanyCellNumber');
			});
		}

		//set current user country as default in phone number
		this.CellNumberObject.setCountry(this.currentUser.phoneCountry);
		this.DispatchObject.setCountry(this.currentUser.phoneCountry);
		this.FaxObject.setCountry(this.currentUser.phoneCountry);
		this.CompanyCellNumberObject.setCountry(this.currentUser.phoneCountry);
	}



	buildAffiliateAccountForm() {
		this.addAffiliateAccountForm = this.formBuilder.group({
			id: [''],
			AffiliateType: ['', Validators.required],
			Title: ['mr', Validators.required],
			FirstName: ['', Validators.required],
			MiddleName: [''],
			LastName: ['', Validators.required],
			Gender: ['male', Validators.required],
			CellNumber: ['', [Validators.required, Validators.pattern("^[0-9+]*$"), Validators.minLength(4), Validators.maxLength(15)]],
			CellIsd: ['+1', Validators.required],
			Email: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i)]],
			// badge_city: [''],
			// badge_city_name: [''],
			latitude: [''],
			longitude: [''],
			FirstYearBusiness: ['', [Validators.required, Validators.pattern("^[0-9+]*$")]],
			CellNumberCountry: ['us', Validators.required],
			CompanyName: ['', Validators.required],
			DBA: [''],
			dispatchEmail: ['', [Validators.pattern(/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i)]],
			Dispatch: [''],
			DispatchIsd: ['+1'],
			DispatchCountry: ['us'],
			BusinessFrontPhoto: [''],
			BusinessBackPhoto: [''],
			CompanyCellNumber: ['', [Validators.pattern("^[0-9+]*$"), Validators.minLength(4), Validators.maxLength(15)]],
			CompanyCellIsd: ['+1', Validators.required],
			CompanyCellNumberCountry: ['us'],
			FaxCountry: ['us'],
			Fax: ['', [Validators.pattern("^[0-9+]*$"), Validators.minLength(4), Validators.maxLength(15)]],
			cpcn_tpc: ['', [this.customValidator.plusValidator()]],
			FaxIsd: ['+1', Validators.required],
			LanguagesGet: this.formBuilder.array([]),
			Associations: this.formBuilder.array([]),
			AssociationsGet: this.formBuilder.array([]),
			LanguagesSpoken: this.formBuilder.array([], [Validators.required]),
			notify_sms: [true],
			notify_email: [true],
		});
	}

	affiliateTypeSwitch(affiliateType) {
		// $('#FirstName').focus();
		switch (affiliateType) {
			case 'fleet_operator': {
				this.showCompanyInformation = true;
				this.conditionalValidations('fleet_operator');
				break;
			}
			case 'black_limo_operator': {
				if (this.affiliateId) {
					if (this.f.AffiliateType.value == 'fleet_operator') {
						this.modalAlertMessage = "Fleet/Coach Operator can not change on Black Car / Owner Operators";
						$('#affiliateAlertMessageModal').modal('show');
						return false;
					}
				}
				this.showCompanyInformation = true;
				this.conditionalValidations('black_limo_operator');
				break;
			}
			case 'taxi_operator': {
				if (this.affiliateId) {
					switch (this.f.AffiliateType.value) {
						case 'black_limo_operator': {
							this.modalAlertMessage = "Black Car / Owner Operators can not change on Taxi Operators";
							$('#affiliateAlertMessageModal').modal('show');
							return false;
						}
						case 'fleet_operator': {
							this.modalAlertMessage = "Fleet/Coach Operators can not change on Taxi Operators";
							$('#affiliateAlertMessageModal').modal('show');
							return false;
						}
						case 'gig_operator': {
							this.modalAlertMessage = "Gig Operators can not change on Taxi Operators";
							$('#affiliateAlertMessageModal').modal('show');
							return false;
						}
					}
				}
				this.showCompanyInformation = true;
				this.conditionalValidations('taxi_operator');
				break;
			}
			case 'gig_operator': {
				if (this.affiliateId) {
					if (this.f.AffiliateType.value == 'fleet_operator') {
						this.modalAlertMessage = "Fleet/Coach Operator can not change on Gig Operators";
						$('#affiliateAlertMessageModal').modal('show');
						return false;
					}
				}
				this.showCompanyInformation = false;
				this.conditionalValidations('gig_operator');
				break;
			}
		}
	}

	/** Confirm the owner e-mail only while it is new or differs from the saved one. */
	get showConfirmEmail(): boolean {
		return this.emailNeedsConfirm('Email', this.savedEmail);
	}

	/** Same for the dispatch e-mail, which only applies with company information. */
	get showConfirmDispatchEmail(): boolean {
		return this.showCompanyInformation && this.emailNeedsConfirm('dispatchEmail', this.savedDispatchEmail);
	}

	/** True when there is no saved address yet, or the field no longer matches it. */
	private emailNeedsConfirm(controlName: 'Email' | 'dispatchEmail', saved: string): boolean {
		const current = (this.addAffiliateAccountForm?.get(controlName)?.value || '').trim().toLowerCase();
		return !saved || current !== saved.trim().toLowerCase();
	}

	/** Required + must match the given e-mail control, but only while the field is shown. */
	private confirmEmailValidator(source: 'Email' | 'dispatchEmail', visible: () => boolean): ValidatorFn {
		return (control: AbstractControl) => {
			if (!visible()) {
				return null;
			}
			const confirm = (control.value || '').trim().toLowerCase();
			if (!confirm) {
				return { required: true };
			}
			const original = (this.addAffiliateAccountForm?.get(source)?.value || '').trim().toLowerCase();
			return confirm === original ? null : { mismatch: true };
		};
	}

	handleBadgeCity(value: any) {
		console.log(value, this.filteredOptions)
		this.filteredOptions = this.badgeOptions.filter((i: any) => i.name.toLowerCase().startsWith(value.toLowerCase()))
	}
	selectBadgeCity(option: any, isUserInput) {
		console.log('in function selectBadgeCity-->>>', isUserInput)
		if (isUserInput) {
			this.addAffiliateAccountForm.patchValue({
				badge_city: option.id
			})
			// this.addAffiliateAccountForm.updateValueAndValidity()
		}

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
			this.businessCardImageChange1(dataUrl, key, id);
		};
	}

	async businessCardImageChange1(imageUrl, imageType, imageId = null) {
		if (!await this.commonServices.handleFile(event)) {
			return;
		}
		this.stateManagementService.setprogressBar(true); //show progressBar
		this.imageSrc = imageUrl;
		this.adminService.uploadVehicleImage(this.imageSrc)
			.pipe(
				catchError(err => {
					this.stateManagementService.setprogressBar(false); // hide progressBar
					return throwError(err);
				})
			)
			.subscribe(({ data }: any) => {
				switch (imageType) {
					case 'BusinessFrontPhoto': {
						this.addAffiliateAccountForm.patchValue({
							BusinessFrontPhoto: data.id,
						});
						this.BusinessFrontPhoto = data.image;
						this.BusinessFrontPhotoId = data.id;
						break;
					}
					case 'BusinessBackPhoto': {
						this.addAffiliateAccountForm.patchValue({
							BusinessBackPhoto: data.id,
						});
						this.BusinessBackPhoto = data.image;
						this.BusinessBackPhotoId = data.id;
						break;
					}
					default: {
						break;
					}
				}
				this.stateManagementService.setprogressBar(false); // hide progressBar
			});
		// console.log(this.addInsuranceForm.value);
	}

	// handleFile(event) {
	// 	const [file] = event.target.files
	// 	const fileType = file.type // image/jpeg
	// 	console.log("fileType", fileType)
	// 	const acceptedFiles: any = ["image/jpeg", "image/png"];
	// 	console.log(!acceptedFiles.includes(fileType))
	// 	if (!acceptedFiles.includes(fileType)) {
	// 		return this.errorModal.openDialog({
	// 			errors: {
	// 				error: 'Please upload only jpeg or png file type!'
	// 			}
	// 		})
	// 	} else {
	// 		return true
	// 	}
	// }
	async businessCardImageChange(event, imageType, imageId = null) {
		if (!await this.commonServices.handleFile(event)) {
			return;
		}
		// this.stateManagementService.setprogressBar(true); //show progressBar
		const reader = new FileReader();
		if (event.target.files && event.target.files.length) {
			const [file] = event.target.files;
			reader.readAsDataURL(file);
			reader.onload = () => {
				this.imageSrc = reader.result as string;
				this.adminService.uploadVehicleImage(this.imageSrc)
					.pipe(
						catchError(err => {
							// this.stateManagementService.setprogressBar(false); // hide progressBar
							return throwError(err);
						})
					)
					.subscribe(({ data }: any) => {
						switch (imageType) {
							case 'BusinessFrontPhoto': {
								this.addAffiliateAccountForm.patchValue({
									BusinessFrontPhoto: data.id,
								});
								this.BusinessFrontPhoto = data.image;
								this.BusinessFrontPhotoId = data.id;
								break;
							}
							case 'BusinessBackPhoto': {
								this.addAffiliateAccountForm.patchValue({
									BusinessBackPhoto: data.id,
								});
								this.BusinessBackPhoto = data.image;
								this.BusinessBackPhotoId = data.id;
								break;
							}
							default: {
								break;
							}
						}
						// this.stateManagementService.setprogressBar(false); // hide progressBar
					});
			};
		}



		// console.log(this.addInsuranceForm.value);
	}

	deleteImage(id, imageType) {
		switch (imageType) {
			case 'BusinessFrontPhoto': {
				this.addAffiliateAccountForm.patchValue({
					BusinessFrontPhoto: '',
				});
				this.BusinessFrontPhoto = '';
				break;
			}
			case 'BusinessBackPhoto': {
				this.addAffiliateAccountForm.patchValue({
					BusinessBackPhoto: '',
				});
				this.BusinessBackPhoto = '';
				break;
			}
			default: {
				break;
			}
		}
	}

	closeButton() {
		this.closeTab.emit();
	}

	showImageInModal(imageUrl) {
		this.modalImage = imageUrl;
		// console.log("11111",imageUrl)
		$("#imageModal").addClass("showImage");
		$("#imageModal").removeClass("d-none");
		// $("#imageModal").show();
	}

	conditionalValidations(affiliateType) {
		if (affiliateType != 'gig_operator') {
			this.addAffiliateAccountForm.controls['CompanyName'].setValidators([Validators.required]);
			this.addAffiliateAccountForm.controls['dispatchEmail'].setValidators([Validators.required, Validators.pattern(/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i)]);
			this.addAffiliateAccountForm.controls['Dispatch'].setValidators([Validators.required, Validators.pattern("^[0-9+]*$"), Validators.minLength(4), Validators.maxLength(15), this.customValidator.dashValidator(), this.customValidator.plusValidator()]);
			this.addAffiliateAccountForm.controls['DispatchIsd'].setValidators([Validators.required]);
			this.addAffiliateAccountForm.controls['DispatchCountry'].setValidators([Validators.required]);
			this.addAffiliateAccountForm.controls['BusinessFrontPhoto'].setValidators([Validators.required]);
		}
		else {
			this.addAffiliateAccountForm.controls['CompanyName'].clearValidators();
			this.addAffiliateAccountForm.controls['dispatchEmail'].setValidators([Validators.pattern(/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i)]);
			this.addAffiliateAccountForm.controls['Dispatch'].clearValidators();
			this.addAffiliateAccountForm.controls['DispatchIsd'].clearValidators();
			this.addAffiliateAccountForm.controls['DispatchCountry'].clearValidators();
			this.addAffiliateAccountForm.controls['BusinessFrontPhoto'].clearValidators();
		}
		this.addAffiliateAccountForm.controls['CompanyName'].updateValueAndValidity();
		this.addAffiliateAccountForm.controls['dispatchEmail'].updateValueAndValidity();
		this.addAffiliateAccountForm.controls['Dispatch'].updateValueAndValidity();
		this.addAffiliateAccountForm.controls['DispatchIsd'].updateValueAndValidity();
		this.addAffiliateAccountForm.controls['DispatchCountry'].updateValueAndValidity();
		this.addAffiliateAccountForm.controls['BusinessFrontPhoto'].updateValueAndValidity();
	}

	onCountryChange(event, type) {
		console.log(event)
		if (type == 'CellNumber') {
			this.addAffiliateAccountForm.patchValue({
				CellIsd: '+' + event.dialCode,
				CellNumberCountry: event.iso2
			});
		}
		else if (type == 'CompanyCellNumber') {
			this.addAffiliateAccountForm.patchValue({
				CompanyCellIsd: '+' + event.dialCode,
				CompanyCellNumberCountry: event.iso2
			});
		}
		else if (type == 'Dispatch') {
			this.addAffiliateAccountForm.patchValue({
				DispatchIsd: '+' + event.dialCode,
				DispatchCountry: event.iso2
			});
		}
		else {
			this.addAffiliateAccountForm.patchValue({
				FaxIsd: '+' + event.dialCode,
				FaxCountry: event.iso2
			});
		}
	}

	telInputObjectCell(obj) {
		this.CellNumberObject = obj;
	}
	telInputObjectCompanyCell(obj) {
		this.CompanyCellNumberObject = obj;
	}
	telInputObjectFax(obj) {
		this.FaxObject = obj;
	}
	telInputObjectDispatch(obj) {
		this.DispatchObject = obj;
	}

	onLanguageChange(val, ischecked) {
		const languageSpoken: FormArray = this.addAffiliateAccountForm.get('LanguagesSpoken') as FormArray;
		if (ischecked) {
			languageSpoken.push(new FormControl(val));
		} else {
			let index = languageSpoken.controls.findIndex(x => x.value == val)
			languageSpoken.removeAt(index);
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

	validateCellNumber() {
		this.validatePhoneGeneric(this.f.CellNumber, this.CellNumberObject);
	}

	validateDispatch() {
		this.validatePhoneGeneric(this.f.Dispatch, this.DispatchObject);
	}

	validateCompanyCellNumber() {
		this.validatePhoneGeneric(this.f.CompanyCellNumber, this.CompanyCellNumberObject);
	}

	validateFax() {
		this.validatePhoneGeneric(this.f.Fax, this.FaxObject);
	}



	onAssociationChange(e) {
		const associations: FormArray = this.addAffiliateAccountForm.get('Associations') as FormArray;

		if (e.target.checked) {
			associations.push(new FormControl(e.target.value));
		} else {
			const index = associations.controls.findIndex(x => x.value === e.target.value);
			associations.removeAt(index);
		}
	}

	onAffiliateTypeChange(e) {
		const AffiliateType: FormArray = this.addAffiliateAccountForm.get('AffiliateType') as FormArray;

		if (e.target.checked) {
			AffiliateType.push(new FormControl(e.target.value));
		} else {
			const index = AffiliateType.controls.findIndex(x => x.value === e.target.value);
			AffiliateType.removeAt(index);
		}
	}

	get f() {
		return this.addAffiliateAccountForm.controls;
	}


	submitForm() {
		console.log('submit button hited', this.addAffiliateAccountForm);
		// console.log(JSON.stringify(this.addVehicleRatesForm.value));
		this.submittedForm = true;
		// Re-check the confirm fields against the current e-mail values
		this.confirmEmailControl.updateValueAndValidity();
		this.confirmDispatchEmailControl.updateValueAndValidity();

		// stop here if form is invalid
		if (
			this.addAffiliateAccountForm.invalid ||
			this.confirmEmailControl.invalid ||
			this.confirmDispatchEmailControl.invalid
		) {
			return;
		}

		// Sanitize Dispatch (remove Country Code if present)
		if (this.addAffiliateAccountForm.value.Dispatch && this.addAffiliateAccountForm.value.DispatchIsd && this.addAffiliateAccountForm.value.Dispatch.startsWith(this.addAffiliateAccountForm.value.DispatchIsd)) {
			this.addAffiliateAccountForm.value.Dispatch = this.addAffiliateAccountForm.value.Dispatch.substring(this.addAffiliateAccountForm.value.DispatchIsd.length);
		}

		// Sanitize Fax (remove Country Code if present)
		if (this.addAffiliateAccountForm.value.Fax && this.addAffiliateAccountForm.value.FaxIsd && this.addAffiliateAccountForm.value.Fax.startsWith(this.addAffiliateAccountForm.value.FaxIsd)) {
			this.addAffiliateAccountForm.value.Fax = this.addAffiliateAccountForm.value.Fax.substring(this.addAffiliateAccountForm.value.FaxIsd.length);
		}

		this.addAffiliateAccountForm.value.stepCompleted = this.adminService.getUpdatedStepsLocal("1");;
		this.addAffiliateAccountForm.get('acc_id')
		// console.log(this.addAffiliateAccountForm.value);
		// console.log(JSON.stringify(this.addVehicleRatesForm.value));
		this.spinner.show();
		this.disableSubmitButton = true; //disable submit button
		this.adminService.addAffiliateAccount(this.addAffiliateAccountForm.value)
			.pipe(
				catchError(err => {
					this.spinner.hide();//hide spinner
					this.disableSubmitButton = false; //enable submit button
					return throwError(err);
				})
			)
			.subscribe(result => {
				console.log('response__>>>')
				this.response = result;
				this.spinner.hide();//hide spinner
				this.disableSubmitButton = false; //enable submit button
				sessionStorage.setItem("affiliateUserData", JSON.stringify(this.addAffiliateAccountForm.value));
				console.log("valueset", this.addAffiliateAccountForm.value.id)
				if (this.response.success == true) {
					this.adminService.updateStepsLocal("1");
					if (!this.addAffiliateAccountForm.value.id) {
						sessionStorage.setItem("affiliateId", this.response.data.acc_id);
						sessionStorage.setItem("affiliateType", this.addAffiliateAccountForm.value.AffiliateType);
						console.log("valueset", this.response.data.acc_id)

						console.log('routing to step 2 _-->>')

					}
					let affiliateName = this.addAffiliateAccountForm.value.FirstName + ' ' + this.addAffiliateAccountForm.value.LastName
					console.log('------_>>>>>>>>>>> affiliate name', affiliateName)
					sessionStorage.setItem("affiliateName", affiliateName)
					// done by Ishpreet
					this.router.navigateByUrl('/', { skipLocationChange: true }).then(() =>
						this.router.navigate(['/admin/affiliate/step2'])
					);
				}
			});
	}



	resetForm() {
		// this.addAffiliateAccountForm.reset();
		this.buildAffiliateAccountForm();
		this.addAffiliateAccountForm.patchValue({
			id: this.response2.data.id,
			Email: this.response2.data.Email,
			dispatchEmail: this.response2.data.dispatchEmail,
			Gender: ''
		});
		this.confirmEmailControl.reset('');
		this.confirmDispatchEmailControl.reset('');
		this.BusinessFrontPhoto = "";
		this.BusinessBackPhoto = "";
		this.onLanguageChange("1", true);
		if (this.response2.data.AffiliateType != "gig_operator") {
			this.addAffiliateAccountForm.patchValue({
				dispatchEmail: this.response2.data.dispatchEmail,
			});
		}
		this.addAffiliateAccountForm.updateValueAndValidity()
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
