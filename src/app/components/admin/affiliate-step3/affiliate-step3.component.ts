import { Component, EventEmitter, Input, OnInit, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { AdminService } from '../../../services/admin.service';
import { AbstractControl, FormGroup, FormBuilder, Validators, ValidatorFn } from '@angular/forms';
import { Router } from '@angular/router';
import { StateManagementService } from '../../../services/statemanagement.service';
import { CommonService } from '../../../services/common.service';
import { NgxSpinnerService } from "ngx-spinner";
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { formatDate } from '@angular/common';
import { CustomvalidationService } from '../../../services/customvalidation.service';
import * as intlTelInput from 'intl-tel-input';
import * as moment from "moment";
import { MomentDateAdapter, MAT_MOMENT_DATE_ADAPTER_OPTIONS } from '@angular/material-moment-adapter';
import { DateAdapter, MAT_DATE_FORMATS, MAT_DATE_LOCALE } from '@angular/material/core';
import * as _moment from 'moment';

declare var $: any;

export const MY_FORMATS = {
	parse: {
		dateInput: 'MM/DD/YYYY',
	},
	display: {
		dateInput: 'MM/DD/YYYY',
		monthYearLabel: 'MMM YYYY',
		dateA11yLabel: 'LL',
		monthYearA11yLabel: 'MMMM YYYY',
	},
};

export function pastDateValidator(): ValidatorFn {
	return (control: AbstractControl): { [key: string]: any } | null => {
		if (!control.value) {
			return null; // Return null if the date is not provided
		}

		const selectedDate = new Date(control.value).setHours(0, 0, 0, 0);
		const currentDate = new Date().setHours(0, 0, 0, 0);

		return selectedDate < currentDate ? { pastDate: true } : null;
	};
}

@Component({
	selector: 'app-affiliate-step3',
	templateUrl: './affiliate-step3.component.html',
	styleUrls: ['./affiliate-step3.component.scss'],
	providers: [
		{
			provide: DateAdapter,
			useClass: MomentDateAdapter,
			deps: [MAT_DATE_LOCALE, MAT_MOMENT_DATE_ADAPTER_OPTIONS],
		},
		{ provide: MAT_DATE_FORMATS, useValue: MY_FORMATS },
	],
})
export class AffiliateStep3Component implements OnInit {
	@ViewChild('phoneInput') phoneInput!: ElementRef;

	public imageSrc: string;
	public addInsuranceForm: FormGroup;
	public submittedForm: boolean;
	public disableSubmitButton: boolean = false;
	public affiliateId: string;
	public AgentTelephoneObject: any;
	public currentUser: any;

	public insCertificateImage: string;
	public insuranceCardImage: string;
	public insCertificateId: string;
	public insuranceCardId: string;
	public currentDate: string;
	public modalImage: string;
	public affiliate_type: string;
	public policyExpiredDay: Array<number> = [];
	public policyExpiredYear: Array<number> = [];

	@Input() closeTab: EventEmitter<any> = new EventEmitter();
	stepsObj: any;
	constructor(
		private adminService: AdminService,
		private router: Router,
		private spinner: NgxSpinnerService,
		private stateManagementService: StateManagementService,
		private formBuilder: FormBuilder,
		private customValidator: CustomvalidationService,
		private commonServices: CommonService
	) { }

	ngAfterViewInit() {
		let countryCode = 'auto';
		if (this.currentUser && this.currentUser.CellNumberCountry) {
			countryCode = this.currentUser.CellNumberCountry;
		}

		// init flag
		const telOptions: any = this.commonServices.getTelInputOptions(countryCode);
		this.AgentTelephoneObject = intlTelInput(this.phoneInput.nativeElement, telOptions);

		this.addCustomCountrySearch(this.phoneInput.nativeElement);

		this.phoneInput.nativeElement.addEventListener('countrychange', () => {
			const countryData = this.AgentTelephoneObject.getSelectedCountryData();
			console.log("in country change", countryData)
			this.onCountryChange(countryData, 'AgentTelephone')
			this.validateAgentTelephone();
		});

		//set current user country as default in phone number
		// this.AgentTelephoneObject.setCountry(this.currentUser.CellNumberCountry);
	}


	ngOnInit(): void {
		this.stepsObj = JSON.parse(sessionStorage.getItem('step_completed_obj'));
		for (let [key, value] of Object.entries(this.stepsObj)) {
			if (key == 'step2' && value == 'uncompleted') {

				$('#errorModal').modal('show')
			}
		}
		//show "stripe can take upto 24 hours" modal on first time completing step 2
		const showStripe24HourAlert = sessionStorage.getItem("showStripe24HourAlert");
		if (showStripe24HourAlert == 'yes') {
			$('#showStripe24HourAlert').modal('show');
			sessionStorage.removeItem("showStripe24HourAlert");
		}

		this.currentDate = formatDate(new Date(), 'yyyy-MM-dd', 'en');

		this.currentUser = JSON.parse(sessionStorage.getItem("affiliateUserData"));
		this.affiliate_type = this.currentUser.AffiliateType;
		this.affiliateId = sessionStorage.getItem('affiliateId');
		const stepCompleted = this.adminService.getLocalStepsCompleted();

		let currentYear: number = (new Date()).getFullYear();
		//days
		for (let i = 1; i <= 31; i++) {
			this.policyExpiredDay.push(i);
		}
		//year
		let temp = 0;
		while (temp < 50)//max 50 year future
		{
			this.policyExpiredYear.push(currentYear);
			currentYear++;
			temp++;
		}

		//add insurance form validation
		this.addInsuranceForm = this.formBuilder.group({
			id: [''],//insurance id for edit purpose
			acc_id: [this.affiliateId, Validators.required],//affiliate account id
			CompanyName: ['', Validators.required],
			AgentName: [''],
			stepCompleted: [''],
			AgentTelephone: ['', [Validators.required, Validators.pattern("^[0-9+]*$"), Validators.minLength(4), Validators.maxLength(15), this.customValidator.dashValidator(), this.customValidator.plusValidator()]],
			AgentTelephoneIsd: ['+1', Validators.required],
			AgentTelephoneCountry: ['us', Validators.required],
			policyNumber: ['', [Validators.required, this.customValidator.plusValidator()]],
			policyExpiredDate: ['', [Validators.required, pastDateValidator()]],
			policyExpiredDay: [''],
			policyExpiredMonth: [''],
			policyExpiredYear: [''],
			insuranceLimits: ['', Validators.required],
			AgentEmail: ['', [Validators.pattern(/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i)]],
			insCertificate: ['', Validators.required],
			insuranceCard: [''],
		});

		// Sync policyExpiredDate with legacy fields
		const policyDateControl = this.addInsuranceForm.get('policyExpiredDate');
		if (policyDateControl) {
			policyDateControl.valueChanges.subscribe((date: any) => {
				if (date) {
					const d = new Date(date);
					this.addInsuranceForm.patchValue({
						policyExpiredDay: d.getDate().toString().padStart(2, '0'),
						policyExpiredMonth: (d.getMonth() + 1).toString().padStart(2, '0'),
						policyExpiredYear: d.getFullYear().toString()
					}, { emitEvent: false });
				}
			});
		}
		// , { validator: this.customValidationFunction }

		if (this.affiliateId) {
			if (stepCompleted.includes('3')) {
				// get data for editing using API
				// this.stateManagementService.setprogressBar(true);
				this.adminService.getInsuranceDetail(this.affiliateId)
					.pipe(
						catchError(err => {
							// this.stateManagementService.setprogressBar(false);
							return throwError(err);
						})
					).subscribe(({ data }: any) => {
						// this.stateManagementService.setprogressBar(false);
						this.insCertificateImage = data.insCertificate.image;
						this.insuranceCardImage = data.insuranceCard.image;

						this.insCertificateId = data.insCertificate.ID;
						this.insuranceCardId = data.insuranceCard.ID;

						this.addInsuranceForm.patchValue({
							id: data.id,
							insCertificate: data.insCertificate.ID,
							insuranceCard: data.insuranceCard.ID,
							CompanyName: data.CompanyName,
							AgentName: data.AgentName,
							AgentTelephone: data.AgentTelephone,
							AgentTelephoneIsd: data.AgentTelephoneIsd,
							policyNumber: data.policyNumber,
							policyExpiredDate: new Date(Number(data.policyExpiredYear), Number(data.policyExpiredMonth) - 1, Number(data.policyExpiredDay)),
							policyExpiredDay: data.policyExpiredDay,
							policyExpiredMonth: data.policyExpiredMonth,
							policyExpiredYear: data.policyExpiredYear,
							insuranceLimits: data.insuranceLimits,
							AgentEmail: data.AgentEmail,
						});
						this.addInsuranceForm.get('policyExpiredDate').markAsTouched();
						this.addInsuranceForm.get('policyExpiredDate').updateValueAndValidity();
						this.AgentTelephoneObject.setCountry(data.AgentTelephoneCountry);
					});
			}
			else {
				var dateobj = new Date();
				var month = dateobj.getMonth() + 1;
				var day = dateobj.getDate();
				var year = dateobj.getFullYear();
				console.log(month, day, year);
				this.addInsuranceForm.patchValue({
					policyExpiredDate: new Date(year, 11, 31),
					policyExpiredDay: '31',
					policyExpiredMonth: '12',
					policyExpiredYear: year.toString()
				});
			}
		}
	}

	closeButton() {
		this.closeTab.emit();
	}

	customValidationFunction(group): any {
		if (group) {
			var currentDate = formatDate(new Date(), 'yyyy-MM-dd', 'en');
			console.log(currentDate)
			if (!group.controls['policyExpiredDay'].value ||
				!group.controls['policyExpiredMonth'].value ||
				!group.controls['policyExpiredYear'].value) {
				return null;
			}
			const enteredDate = group.controls['policyExpiredYear'].value + '-' + group.controls['policyExpiredMonth'].value + '-' + group.controls['policyExpiredDay'].value;
			console.log(currentDate, enteredDate)
			if (!new Date(enteredDate).getTime()) {
				return { 'InvalidDate': true };
			}
			if (new Date(enteredDate).getTime() >= new Date(currentDate).getTime()) {
				return null;
			}

		}
		return { 'policyError': true };
	}

	onCountryChange(event, type) {
		if (type == 'AgentTelephone') {
			this.addInsuranceForm.patchValue({
				AgentTelephoneIsd: '+' + event.dialCode,
				AgentTelephoneCountry: event.iso2
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

	validateAgentTelephone() {
		this.validatePhoneGeneric(this.f.AgentTelephone, this.AgentTelephoneObject);
	}

	telInputObjectAgentTelephone(obj) {
		this.AgentTelephoneObject = obj;
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
			this.vehicleOfficialImagesChange1(dataUrl, key, id);
		};
	}


	vehicleOfficialImagesChange1(imageUrl, imageType, imageId) {
		this.stateManagementService.setprogressBar(true);

		this.imageSrc = imageUrl;
		this.adminService.uploadVehicleImage(this.imageSrc)
			.pipe(
				catchError(err => {
					this.stateManagementService.setprogressBar(false);
					return throwError(err);
				})
			)
			.subscribe(({ data }: any) => {

				switch (imageType) {
					case 'insCertificate': {
						this.addInsuranceForm.patchValue({
							insCertificate: data.id,
						});
						this.insCertificateImage = data.image;
						this.insCertificateId = data.id;
						break;
					}
					case 'insuranceCard': {
						this.addInsuranceForm.patchValue({
							insuranceCard: data.id,
						});
						this.insuranceCardImage = data.image;
						this.insuranceCardId = data.id;
						break;
					}
					default: {
						break;
					}
				}
				this.stateManagementService.setprogressBar(false);
			});
	}

	vehicleOfficialImagesChange(event, imageType, imageId) {
		// this.stateManagementService.setprogressBar(true);
		const reader = new FileReader();
		if (event.target.files && event.target.files.length) {
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
							case 'insCertificate': {
								this.addInsuranceForm.patchValue({
									insCertificate: data.id,
								});
								this.insCertificateImage = data.image;
								this.insCertificateId = data.id;
								break;
							}
							case 'insuranceCard': {
								this.addInsuranceForm.patchValue({
									insuranceCard: data.id,
								});
								this.insuranceCardImage = data.image;
								this.insuranceCardId = data.id;
								break;
							}
							default: {
								break;
							}
						}
						// this.stateManagementService.setprogressBar(false);
					});
			};
		}
	}

	deleteImage(id, imageType) {
		switch (imageType) {
			case 'insCertificate': {
				this.addInsuranceForm.patchValue({
					insCertificate: '',
				});
				this.insCertificateImage = '';
				break;
			}
			case 'insuranceCard': {
				this.addInsuranceForm.patchValue({
					insuranceCard: '',
				});
				this.insuranceCardImage = '';
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

	get f() {
		return this.addInsuranceForm.controls;
	}

	submitForm() {
		if (this.affiliate_type != 'fleet_operator') {
			console.log("set validation on field")
			// this.addInsuranceForm.get('insuranceCard').setValidators([Validators.required]);
		} else {
			console.log("enter in conditions")
			this.addInsuranceForm.get('insuranceCard').clearValidators();
			this.addInsuranceForm.get('insuranceCard').updateValueAndValidity();
		}
		console.log(this.addInsuranceForm);
		this.submittedForm = true;

		// Sync AgentTelephone Country Data
		if (this.AgentTelephoneObject) {
			const countryData = this.AgentTelephoneObject.getSelectedCountryData();
			if (countryData && countryData.dialCode) {
				this.addInsuranceForm.patchValue({
					AgentTelephoneIsd: '+' + countryData.dialCode,
					AgentTelephoneCountry: countryData.iso2
				});
			}
		}

		// stop here if form is invalid
		if (this.addInsuranceForm.invalid) {
			return;
		}

		let payload = { ...this.addInsuranceForm.value };

		// Sanitize AgentTelephone (remove Country Code if present)
		if (payload.AgentTelephone && payload.AgentTelephoneIsd && payload.AgentTelephone.startsWith(payload.AgentTelephoneIsd)) {
			payload.AgentTelephone = payload.AgentTelephone.substring(payload.AgentTelephoneIsd.length);
		}
		let expireDate = payload.policyExpiredDate;
		if (expireDate) {
			let d = new Date(expireDate);
			payload.policyExpiredYear = d.getFullYear().toString();
			payload.policyExpiredMonth = (d.getMonth() + 1).toString().padStart(2, '0');
			payload.policyExpiredDay = d.getDate().toString().padStart(2, '0');
		}
		delete payload.policyExpiredDate;

		payload.stepCompleted = this.adminService.getUpdatedStepsLocal("3");
		this.spinner.show();
		this.disableSubmitButton = true; //disable submit button

		this.adminService.addInsuranceDetail(payload)
			.pipe(
				catchError(err => {
					this.spinner.hide();//hide spinner
					this.disableSubmitButton = false; //enable submit button
					return throwError(err);
				})
			)
			.subscribe((success: any) => {
				this.spinner.hide();//hide spinner
				this.disableSubmitButton = false; //enable submit button

				if (success.success == true) {
					this.adminService.updateStepsLocal("3");
				}


				this.router.navigateByUrl('/', { skipLocationChange: true }).then(() =>
					this.router.navigate(['/admin/affiliate/step4'])
				);
			});
	}

	resetForm() {
		// this.addInsuranceForm.reset();
		this.addInsuranceForm.patchValue({
			CompanyName: '',
			AgentName: '',
			AgentTelephone: '',
			policyNumber: '',
			policyExpiredDate: '',
			policyExpiredDay: '',
			policyExpiredMonth: '',
			policyExpiredYear: '',
			insuranceLimits: '',
			AgentEmail: '',
		})
		this.insCertificateImage = "";
		this.insuranceCardImage = "";
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

	chosenYearHandler(normalizedYear: moment.Moment) {
		const ctrlValue = this.addInsuranceForm.get('policyExpiredDate').value ? moment(this.addInsuranceForm.get('policyExpiredDate').value) : moment();
		ctrlValue.year(normalizedYear.year());
		this.addInsuranceForm.get('policyExpiredDate').setValue(ctrlValue.toDate());
	}

	chosenMonthHandler(normalizedMonth: moment.Moment) {
		const ctrlValue = this.addInsuranceForm.get('policyExpiredDate').value ? moment(this.addInsuranceForm.get('policyExpiredDate').value) : moment();
		ctrlValue.month(normalizedMonth.month());
		this.addInsuranceForm.get('policyExpiredDate').setValue(ctrlValue.toDate());
	}

	chosenDateHandler() {
		// Final date selection handler
	}
}
