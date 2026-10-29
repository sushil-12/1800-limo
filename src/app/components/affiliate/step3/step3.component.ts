import {
	Component,
	EventEmitter,
	Input,
	OnInit,
	AfterViewInit,
	ViewChild,
	ElementRef,
} from "@angular/core";
import { AffiliateService } from "../../../services/affiliate.service";
import { FormGroup, FormBuilder, Validators } from "@angular/forms";
import { Router } from "@angular/router";
import { StateManagementService } from "../../../services/statemanagement.service";
import { NgxSpinnerService } from "ngx-spinner";
import { catchError } from "rxjs/operators";
import { throwError } from "rxjs";
import { formatDate } from "@angular/common";
import { CustomvalidationService } from "../../../services/customvalidation.service";
import { AdminService } from "src/app/services/admin.service";
import { CommonService } from "src/app/services/common.service";
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

export function pastDateValidator(): any {
	return (control: any): { [key: string]: any } | null => {
		if (!control.value) {
			return null;
		}
		const selectedDate = new Date(control.value).setHours(0, 0, 0, 0);
		const currentDate = new Date().setHours(0, 0, 0, 0);
		return selectedDate < currentDate ? { pastDate: true } : null;
	};
}

@Component({
	selector: "app-step3",
	templateUrl: "./step3.component.html",
	styleUrls: ["../affiliate-registration-style.css", "./step3.component.scss"],
	providers: [
		{
			provide: DateAdapter,
			useClass: MomentDateAdapter,
			deps: [MAT_DATE_LOCALE, MAT_MOMENT_DATE_ADAPTER_OPTIONS],
		},
		{ provide: MAT_DATE_FORMATS, useValue: MY_FORMATS },
	],
})
export class Step3Component implements OnInit, AfterViewInit {
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
	public affiliate_type: any;
	public policyExpiredDay: Array<number> = [];
	public policyExpiredYear: Array<number> = [];
	public minDate: Date = new Date();

	@Input() closeTab: EventEmitter<any> = new EventEmitter();

	constructor(
		private affiliateService: AffiliateService,
		private router: Router,
		private adminService: AdminService,
		private spinner: NgxSpinnerService,
		private stateManagementService: StateManagementService,
		private formBuilder: FormBuilder,
		private commonServices: CommonService,
		private customValidator: CustomvalidationService
	) { }

	public tutorialVideoUrl = "https://1800limo.s3.us-east-2.amazonaws.com/tutorials/How+to+complete+step+3+to+register+as+affiliate.mp4";

	openTutorial(): void {
		window.open(this.tutorialVideoUrl, "_blank");
	}

	ngAfterViewInit() {

		// init flag
		const telOptions: any = this.commonServices.getTelInputOptions();
		this.AgentTelephoneObject = intlTelInput(this.phoneInput.nativeElement, telOptions);

		this.addCustomCountrySearch(this.phoneInput.nativeElement);

		this.phoneInput.nativeElement.addEventListener('countrychange', () => {
			const countryData = this.AgentTelephoneObject.getSelectedCountryData();
			console.log("in country change", countryData)
			this.onCountryChange(countryData, 'AgentTelephone')
		});

		// 1. Robust Country Detection
		let countryCode = 'us';
		if (this.currentUser) {
			countryCode = this.currentUser.CellNumberCountry ||
				this.currentUser.phoneCountry ||
				this.currentUser.country ||
				this.currentUser.Country ||
				'us';
		}
		if (countryCode.toLowerCase() === 'auto') countryCode = 'us';

		// 2. Set Plugin Country
		this.AgentTelephoneObject.setCountry(countryCode.toLowerCase());

		// 3. Force Patch Form (Ensure payload is correct immediately)
		const countryData = this.AgentTelephoneObject.getSelectedCountryData();
		if (countryData) {
			this.addInsuranceForm.patchValue({
				AgentTelephoneIsd: '+' + countryData.dialCode,
				AgentTelephoneCountry: countryData.iso2
			});
			this.validatePhone();
		}

	}

	// ngAfterViewInit() {
	// 	//set current user country as default in phone number
	// 	this.AgentTelephoneObject.setCountry(this.currentUser.phoneCountry);
	// }

	ngOnInit(): void {
		$('.HeadingH1').css({ display: "block" })
		//show "stripe can take upto 24 hours" modal on first time completing step 2
		const showStripe24HourAlert = sessionStorage.getItem(
			"showStripe24HourAlert"
		);
		if (showStripe24HourAlert == "yes") {
			$("#showStripe24HourAlert").modal("show");
			sessionStorage.removeItem("showStripe24HourAlert");
		}

		this.currentDate = formatDate(new Date(), "yyyy-MM-dd", "en");

		this.currentUser = JSON.parse(localStorage.getItem("currentUser"));
		this.affiliateId = this.currentUser.account_id;
		console.log(this.affiliateId);
		this.affiliate_type = this.currentUser.affiliate_type;
		const stepCompleted = this.affiliateService.getLocalStepCompleted();

		let currentYear: number = new Date().getFullYear();
		//days
		for (let i = 1; i <= 31; i++) {
			this.policyExpiredDay.push(i);
		}
		//year
		let temp = 0;
		while (temp < 50) {
			//max 50 year future
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
			AgentTelephone: ['', [Validators.required, Validators.pattern("^[0-9+]*$"), Validators.minLength(4), Validators.maxLength(15), this.customValidator.dashValidator(), this.customValidator.plusValidator()]],
			AgentTelephoneIsd: ['+1', Validators.required],
			AgentTelephoneCountry: ['us', Validators.required],
			policyNumber: ['', [Validators.required, this.customValidator.plusValidator()]],
			policyExpiredDay: ['', Validators.required],
			policyExpiredMonth: ['', Validators.required],
			policyExpiredYear: ['', Validators.required],
			policyExpiredDate: ['', [Validators.required, pastDateValidator()]],
			insuranceLimits: ['500000', Validators.required],
			AgentEmail: ['', [Validators.pattern(/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i)]],
			insCertificate: ['', Validators.required],
			insuranceCard: [''],
		});
		// , { validator: this.customValidationFunction }
		if (this.affiliateId) {
			if (stepCompleted.includes("3")) {
				// get data for editing using API
				this.spinner.show(); //show spinner
				this.affiliateService
					.getInsuranceDetail(this.affiliateId)
					.pipe(
						catchError((err) => {
							this.spinner.hide(); //hide spinner
							return throwError(err);
						})
					)
					.subscribe(({ data }: any) => {
						this.spinner.hide(); //hide spinner
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
							policyExpiredDay: data.policyExpiredDay,
							policyExpiredMonth: data.policyExpiredMonth,
							policyExpiredYear: data.policyExpiredYear,
							policyExpiredDate: data.policyExpiredYear && data.policyExpiredMonth && data.policyExpiredDay ? new Date(`${data.policyExpiredYear}-${data.policyExpiredMonth}-${data.policyExpiredDay}`) : '',
							insuranceLimits: data.insuranceLimits,
							AgentEmail: data.AgentEmail,
						});
						this.AgentTelephoneObject.setCountry(
							data.AgentTelephoneCountry
						);
					});
			} else {
				var dateobj = new Date();
				var month = dateobj.getMonth() + 1;
				var day = dateobj.getDate();
				var year = dateobj.getFullYear();
				console.log(month, day, year);
				this.addInsuranceForm.patchValue({
					policyExpiredDay: "31",
					policyExpiredMonth: "12",
					policyExpiredYear: year.toString(),
					policyExpiredDate: new Date(`${year}-12-31`)
				});
			}
		}

		// Sync policyExpiredDate with legacy fields
		const policyDateControl = this.addInsuranceForm.get('policyExpiredDate');
		if (policyDateControl) {
			policyDateControl.valueChanges.subscribe((date: Date) => {
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
	}

	closeButton() {
		this.closeTab.emit();
	}

	customValidationFunction(group): any {
		if (group) {
			var currentDate = formatDate(new Date(), "yyyy-MM-dd", "en");
			console.log(currentDate);
			if (
				!group.controls["policyExpiredDay"].value ||
				!group.controls["policyExpiredMonth"].value ||
				!group.controls["policyExpiredYear"].value
			) {
				return null;
			}
			const enteredDate =
				group.controls["policyExpiredYear"].value +
				"-" +
				group.controls["policyExpiredMonth"].value +
				"-" +
				group.controls["policyExpiredDay"].value;
			console.log(currentDate, enteredDate);
			if (
				new Date(enteredDate).getTime() >=
				new Date(currentDate).getTime()
			) {
				return null;
			}
		}
		return { policyError: true };
	}

	onCountryChange(event, type) {
		if (type == "AgentTelephone") {
			this.addInsuranceForm.patchValue({
				AgentTelephoneIsd: "+" + event.dialCode,
				AgentTelephoneCountry: event.iso2,
			});
			this.validatePhone();
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

	validatePhone() {
		if (this.AgentTelephoneObject) {
			const value = this.addInsuranceForm.get('AgentTelephone').value;
			if (!value) {
				if (this.f.AgentTelephone.errors) {
					const { invalidIntl, ...otherErrors } = this.f.AgentTelephone.errors;
					this.f.AgentTelephone.setErrors(Object.keys(otherErrors).length > 0 ? otherErrors : null);
				}
				return;
			}
			const isValid = this.AgentTelephoneObject.isValidNumber();

			if (!isValid) {
				const errorCode = this.AgentTelephoneObject.getValidationError();
				const errorMsg = ["Invalid phone number", "Invalid country code", "Invalid phone number", "Invalid phone number", "Invalid phone number"][errorCode] || "Invalid phone number";

				const currentErrors = this.f.AgentTelephone.errors || {};
				this.f.AgentTelephone.setErrors({ ...currentErrors, 'invalidIntl': errorMsg });
			} else {
				if (this.f.AgentTelephone.errors) {
					const { invalidIntl, ...otherErrors } = this.f.AgentTelephone.errors;
					this.f.AgentTelephone.setErrors(Object.keys(otherErrors).length > 0 ? otherErrors : null);
				}
			}
		}
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
	blobToDataURL(blob: Blob, key: any, id: any) {
		var reader = new FileReader();
		reader.readAsDataURL(blob);
		reader.onload = () => {
			let dataUrl = reader.result as string;
			console.log(dataUrl); //DataURL
			this.vehicleOfficialImagesChange1(dataUrl, key, id);
		};
	}


	async vehicleOfficialImagesChange1(imageUrl: string, imageType: any, imageId: any) {
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
					case "insCertificate": {
						this.addInsuranceForm.patchValue({
							insCertificate: data.id,
						});
						this.insCertificateImage = data.image;
						this.insCertificateId = data.id;
						break;
					}
					case "insuranceCard": {
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

	async vehicleOfficialImagesChange(event, imageType, imageId) {
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
							case "insCertificate": {
								this.addInsuranceForm.patchValue({
									insCertificate: data.id,
								});
								this.insCertificateImage = data.image;
								this.insCertificateId = data.id;
								break;
							}
							case "insuranceCard": {
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
			};
		}
	}

	deleteImage(id, imageType) {
		switch (imageType) {
			case "insCertificate": {
				this.addInsuranceForm.patchValue({
					insCertificate: "",
				});
				this.insCertificateImage = "";
				break;
			}
			case "insuranceCard": {
				this.addInsuranceForm.patchValue({
					insuranceCard: "",
				});
				this.insuranceCardImage = "";
				break;
			}
			default: {
				break;
			}
		}
	}

	showImageInModal(imageUrl: string) {
		this.modalImage = imageUrl;
		$("#imageModal").addClass("showImage");
		$("#imageModal").removeClass("d-none");
	}

	get f() {
		return this.addInsuranceForm.controls;
	}

	submitForm() {
		if (this.affiliate_type != "fleet_operator") {
			console.log("set validation on field");
			// this.addInsuranceForm
			// 	.get("insuranceCard")
			// 	.setValidators([Validators.required]);
		} else {
			console.log("enter in conditions");
			this.addInsuranceForm.get("insuranceCard").clearValidators();
			this.addInsuranceForm.get("insuranceCard").updateValueAndValidity();
		}
		console.log('form->', this.addInsuranceForm);
		this.submittedForm = true;
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

		payload.stepCompleted = this.affiliateService.getUpdatedStepsLocal("3");

		this.spinner.show();
		this.disableSubmitButton = true; //disable submit button

		this.affiliateService
			.addInsuranceDetail(payload)
			.pipe(
				catchError((err) => {
					this.spinner.hide(); //hide spinner
					this.disableSubmitButton = false; //enable submit button
					return throwError(err);
				})
			)
			.subscribe(({ success }: any) => {
				this.spinner.hide(); //hide spinner
				this.disableSubmitButton = false; //enable submit button

				if (success == true) {
					this.affiliateService.updateStepsLocal("3");
				}
				this.router
					.navigateByUrl("/", { skipLocationChange: true })
					.then(() => this.router.navigate(["/affiliate/step4"]));
			});
	}

	resetForm() {
		// this.addInsuranceForm.reset();
		window.scroll({
			top: 0,
			left: 0,
			behavior: "smooth"
		});
		this.addInsuranceForm.patchValue({
			CompanyName: '',
			AgentName: '',
			AgentTelephone: '',
			policyNumber: '',
			policyExpiredDay: '',
			policyExpiredMonth: '',
			policyExpiredYear: '',
			insuranceLimits: '50000',
			AgentEmail: '',
			insCertificate: '',
			insuranceCard: ''
		})
		this.submittedForm = true
		this.insCertificateImage = "";
		this.insuranceCardImage = "";
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
		// Final date selection handler (triggered by dateChange)
		console.log("Full date selected:", this.addInsuranceForm.get('policyExpiredDate').value);
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
