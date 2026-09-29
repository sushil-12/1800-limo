import { Component, OnInit, AfterViewInit, Input, EventEmitter, ViewChild, ElementRef } from "@angular/core";
import { animate, style, transition, trigger } from "@angular/animations";
import { AuthService } from "../../../services/auth.service";
import { AffiliateService } from "../../../services/affiliate.service";
import { AffiliateAiService } from "../../../services/affiliate-ai.service";
import { StateManagementService } from "../../../services/statemanagement.service";
import { FormGroup, FormBuilder, Validators, FormArray, FormControl, AbstractControl, ValidatorFn } from "@angular/forms";
import { Router } from "@angular/router";
import { NgxSpinnerService } from "ngx-spinner";
import { catchError } from "rxjs/operators";
import { throwError, from, Subscription } from "rxjs";
import { CustomvalidationService } from "../../../services/customvalidation.service";
import { HttpClient } from "@angular/common/http";
import { AdminService } from "src/app/services/admin.service";
import { CommonService } from "src/app/services/common.service";
import {
	AffiliateTypeKey,
	ExtractedFieldSuggestion,
} from "../../../interfaces/affiliate-ai.interface";
import * as intlTelInput from "intl-tel-input";
declare var $: any;

/** Which of the four intl-tel-input fields a country code applies to. */
type PhoneFieldKey = "CellNumber" | "Dispatch" | "CompanyCellNumber" | "Fax";

/** Answer to "What best describes your business?" (step 1 card question). */
type OperatorAnswer = "own_vehicle" | "company" | "taxi";

/** Answer to the follow-up "How do you operate?" card question. */
type DriverStyle = "black_car" | "gig";

@Component({
	selector: "app-step1",
	templateUrl: "./step1.component.html",
	styleUrls: ["../affiliate-registration-style.css", "./step1.component.scss"],
	animations: [
		// Sections are revealed progressively as the user answers the card
		// questions. Height animates from 0 so nothing jumps on screen.
		trigger("expandSection", [
			transition(":enter", [
				style({ height: 0, opacity: 0, transform: "translateY(-8px)", overflow: "hidden" }),
				animate(
					"260ms cubic-bezier(.4, 0, .2, 1)",
					style({ height: "*", opacity: 1, transform: "translateY(0)" })
				),
			]),
			transition(":leave", [
				style({ overflow: "hidden" }),
				animate(
					"180ms cubic-bezier(.4, 0, .2, 1)",
					style({ height: 0, opacity: 0, transform: "translateY(-8px)" })
				),
			]),
		]),
	],
})
export class Step1Component implements OnInit, AfterViewInit {
	@ViewChild("resetImages")
	imagesVariable: ElementRef;

	/*
	 * Phone inputs live inside sections that are added/removed by *ngIf as the
	 * user answers the card questions, so they cannot be grabbed once in
	 * ngAfterViewInit. These setters initialize intl-tel-input the moment the
	 * element enters the DOM and drop the instance when it leaves, so the field
	 * re-initializes cleanly if the section comes back.
	 */
	@ViewChild("cellInput") set cellInputRef(el: ElementRef) {
		this.bindPhoneInput(el, "CellNumber");
	}
	@ViewChild("dispatchInput") set dispatchInputRef(el: ElementRef) {
		this.bindPhoneInput(el, "Dispatch");
	}
	@ViewChild("companyCellNumberInput") set companyCellNumberInputRef(el: ElementRef) {
		this.bindPhoneInput(el, "CompanyCellNumber");
	}
	@ViewChild("FaxInput") set faxInputRef(el: ElementRef) {
		this.bindPhoneInput(el, "Fax");
	}

	/* --- Progressive disclosure: card question answers --- */

	/** "What best describes your business?" — null until the user picks a card. */
	public operatorAnswer: OperatorAnswer | null = null;
	/** "How do you operate?" — only asked on the own_vehicle branch. */
	public driverStyle: DriverStyle | null = null;

	/* --- Business card scanning --- */

	public scanInProgress: boolean = false;
	public scanError: string = "";
	/** Extracted values awaiting the user's review; empty hides the panel. */
	public scanSuggestions: ExtractedFieldSuggestion[] = [];
	public scanConfidence: number = 0;
	public scanNotes: string = "";
	/** True once a scan returned but had nothing new to offer. */
	public scanFoundNothing: boolean = false;

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
	public affiliateType: string;
	public currentUser: any;
	public showCompanyInformation: boolean = true;
	public BusinessFrontPhoto: string;
	public BusinessBackPhoto: string;
	public BusinessFrontPhotoId: string;
	public BusinessBackPhotoId: string;
	public imageSrc: string;
	public CellNumberObject: any;
	public CompanyCellNumberObject: any;
	public FaxObject: any;
	public DispatchObject: any;
	public showOwnerInfoProgressBar: boolean = false;
	public snackbarMsg: string;
	public affiliateInstructionHeading: string;
	public affiliateInstruction: string;
	public modalAlertMessage: string;
	public selectedAffiliate: string;
	public modalImage: string;
	public startBusinessYears: Array<Object>;
	public filterGender: Array<Object>;
	errorMsg2: boolean;
	public filteredGender: Array<any>;
	public isBadgeCity: boolean = false;

	/*
	 * "Confirm E-mail" fields shown next to the owner / dispatch e-mail.
	 * Kept outside addAffiliateAccountForm so they are never sent to the API.
	 */
	public confirmEmailControl = new FormControl("", this.confirmEmailValidator("Email", () => this.showConfirmEmail));
	public confirmDispatchEmailControl = new FormControl("", this.confirmEmailValidator("dispatchEmail", () => this.showConfirmDispatchEmail));
	/** E-mails as last saved; a saved address was already confirmed, so its confirm field stays hidden. */
	private savedEmail: string = "";
	private savedDispatchEmail: string = "";




	private subs: Subscription = new Subscription()
	/**
	 * Country flags requested for phone fields that have not been rendered yet
	 * (their section is still collapsed). Drained by bindPhoneInput on init.
	 */
	private pendingCountry: Partial<Record<PhoneFieldKey, string>> = {};
	affiliateDetail: any;
	badgeOptions: any;
	filteredOptions: any;
	badge_cities_data: any;

	constructor(
		private affiliateService: AffiliateService,
		private affiliateAiService: AffiliateAiService,
		private adminService: AdminService,
		private stateManagementService: StateManagementService,
		private authService: AuthService,
		private httpClient: HttpClient,
		private router: Router,
		private spinner: NgxSpinnerService,
		private formBuilder: FormBuilder,
		private commonServices: CommonService,
		private customValidator: CustomvalidationService
	) { }
	@Input() closeTab: EventEmitter<any> = new EventEmitter();

	public tutorialVideoUrl = "https://1800limo.s3.us-east-2.amazonaws.com/tutorials/How+to+complete+step+1+to+register+as+affiliate.mp4";

	openTutorial(): void {
		window.open(this.tutorialVideoUrl, "_blank");
	}

	ngOnInit(): void {


		$('.HeadingH1').css({ display: "block" })
		this.filterGender = [
			{
				label: "Male",
				value: "Male",
			},
			{
				label: "Female",
				value: "Female",
			},
		];
		$("#genderField").focusout(() => {
			this.errorMsg2 = true;
		});
		this.currentUser = this.authService.currentUserValue;
		// no modal unless uncompleted
		if (this.affiliateService.getLocalStepCompleted().findIndex((item) => item == "1") === -1) {
			$("#instructionsModal").modal("show");
		}
		this.buildAffiliateAccountForm()


		// this.adminService.getAllEnableBadgeCities().pipe(
		// 	catchError(err => {
		// 		return throwError(err)
		// 	})
		// ).subscribe((res: any) => {
		// 	console.log("badge options", res)
		// 	this.badgeOptions = res?.data
		// 	this.filteredOptions = res?.data
		// })

		this.httpClient
			.get("assets/json/businessYear.json")
			.subscribe((data: any) => {
				this.startBusinessYears = data;
			});

		this.spinner.show(); //show spinner
		// Load Our languages using API

		this.affiliateService
			.getAssicationsLanguages()
			.pipe(
				catchError((err) => {
					this.spinner.hide(); //hide spinner
					return throwError(err);
				})
			)
			.subscribe(({ data }: any) => {
				let languagesData = data.languages;
				this.languages = languagesData.sort((a, b) => a.name.localeCompare(b.name));
				this.associations = data.associations;
				this.affiliateType = this.currentUser.affiliate_type;
				this.affiliateId = this.currentUser.account_id;
				const AffiliateType = this.currentUser.affiliate_type;
				if (this.affiliateId) {
					this.affiliateService
						.getAffiliateAccount(this.affiliateId)
						.pipe(
							catchError((err) => {
								this.spinner.hide(); //hide spinner
								return throwError(err);
							})
						)
						.subscribe(({ data }: any) => {
							this.affiliateDetail = data
							this.addAffiliateAccountForm.patchValue({
								acc_id: data.id,
								FirstName: data.FirstName,
								LastName: data.LastName,
								MiddleName: data.MiddleName,
								Email: data.Email,
								CellNumber: data.CellNumber,
								Gender: data.Gender,
								AffiliateType: data.AffiliateType,
								FirstYearBusiness: data.FirstYearBusiness,
							});
							// this.adminService.getAllEnableBadgeCities().toPromise()
							// 	.then((res: any) => {
							// 		this.badgeOptions = res?.data;
							// 		this.filteredOptions = res?.data;
							// 		res?.data?.map((i: any) => {
							// 			if (i.id == data?.badge_city) {
							// 				this.addAffiliateAccountForm.patchValue({
							// 					badge_city: i.id,
							// 					badge_city_name: i.name
							// 				})
							// 			}
							// 			this.isBadgeCity = true
							// 		})


							// 	})
							// 	.catch((err) => {
							// 		throw err; // Re-throwing the error if needed
							// 	});
							//saved e-mails are already confirmed; only a changed address needs retyping
							this.savedEmail = data.Email || "";
							this.savedDispatchEmail = data.dispatchEmail || "";

							//set country flag in phone number fields
							this.setPhoneCountry(
								"CellNumber",
								data.CellNumberCountry
							);
							if (data.AffiliateType != "gig_operator") {
								//set images and their ID
								this.BusinessFrontPhoto =
									data.BusinessFrontPhoto.image;
								this.BusinessBackPhoto =
									data.BusinessBackPhoto.image;
								this.BusinessFrontPhotoId =
									data.BusinessFrontPhoto.ID;
								this.BusinessBackPhotoId =
									data.BusinessBackPhoto.ID;
								this.addAffiliateAccountForm.patchValue({
									CompanyName: data.CompanyName,
									DBA: data.DBA,
									Dispatch: data.Dispatch,
									dispatchEmail: data.dispatchEmail,
									CompanyCellNumber: data.CompanyCellNumber,
									Fax: data.Fax,
									cpcn_tpc: data.cpcn_tpc,
									BusinessFrontPhoto:
										data.BusinessFrontPhoto.ID,
									BusinessBackPhoto:
										data.BusinessBackPhoto.ID,
								});
								this.setPhoneCountry(
									"CompanyCellNumber",
									data.CompanyCellNumberCountry
								);
								this.setPhoneCountry(
									"Dispatch",
									data.DispatchCountry
								);
								this.setPhoneCountry("Fax", data.FaxCountry);
							}

							//preselect the card questions from the saved type
							this.deriveAnswersFromType(data.AffiliateType);
							this.affiliateTypeSwitch(
								data.AffiliateType,
								"onRefresh"
							); //to show/hide company information block

							//get and set languages
							const languagesGet: FormArray =
								this.addAffiliateAccountForm.get(
									"LanguagesGet"
								) as FormArray;
							const languageSpoken: FormArray =
								this.addAffiliateAccountForm.get(
									"LanguagesSpoken"
								) as FormArray;
							var i;
							const totalLanguages: any = this.languages;
							const selectedLanguages = data.LanguagesSpoken;
							for (i = 0; i < totalLanguages.length; i++) {
								// console.log(totalLanguages[i]);
								var checkedLanguage =
									selectedLanguages.findIndex(function (
										post
									) {
										if (post == totalLanguages[i].id)
											return true;
									});
								// console.log(checkedLanguage);
								if (checkedLanguage >= 0) {
									var checkBool = true;
								} else {
									var checkBool = false;
								}
								languagesGet.push(new FormControl(checkBool));
							}
							this.languagesFormControl = languagesGet.controls;
							var j;
							for (j = 0; j < selectedLanguages.length; j++) {
								languageSpoken.push(
									new FormControl(selectedLanguages[j])
								);
							}
							// console.log(languageSpoken);
							//get and set languages ends

							//get and set associations
							const AssociationsGet: FormArray =
								this.addAffiliateAccountForm.get(
									"AssociationsGet"
								) as FormArray;
							const associations: FormArray =
								this.addAffiliateAccountForm.get(
									"Associations"
								) as FormArray;
							var i;
							const totalAssociations: any = this.associations;
							const selectedAssociations = data.Associations;
							for (i = 0; i < totalAssociations.length; i++) {
								var checkedAssociation =
									selectedAssociations.findIndex(function (
										post
									) {
										if (post == totalAssociations[i].id)
											return true;
									});
								if (checkedAssociation >= 0) {
									var checkBool = true;
								} else {
									var checkBool = false;
								}
								AssociationsGet.push(
									new FormControl(checkBool)
								);
							}
							this.AssociationsFormControl =
								AssociationsGet.controls;
							var j;
							for (j = 0; j < selectedAssociations.length; j++) {
								associations.push(
									new FormControl(selectedAssociations[j])
								);
							}
							console.log("associations");
							//
							this.spinner.hide(); //hide spinner
						});
				} else {
					// A brand new affiliate answers the card questions first —
					// no type is preselected, so nothing below them is rendered.
					// If step 0 already recorded a type, honour it and open up.
					if (AffiliateType) {
						this.deriveAnswersFromType(AffiliateType);
						this.affiliateTypeSwitch(AffiliateType, "onRefresh");
					}
					this.stateManagementService.setprogressBar(false);
					$("#instructionsModal").modal("show");

					this.onLanguageChange("1", true); //set english as default language
				}
				this.spinner.hide(); //hide spinner
			});

	}


	ngAfterViewInit() {
		// Phone fields bind themselves via the @ViewChild setters above, because
		// their sections are revealed progressively and may not exist yet.
	}

	/**
	 * Attach (or detach) intl-tel-input for one phone field as its element enters
	 * or leaves the DOM. Called from the @ViewChild setters, so it must be cheap
	 * and must not write to form state synchronously.
	 */
	private bindPhoneInput(el: ElementRef, key: PhoneFieldKey) {
		if (!el || !el.nativeElement) {
			// Section was collapsed — drop the instance so it rebuilds next time.
			this.setPhoneObject(key, null);
			return;
		}

		if (this.getPhoneObject(key)) {
			return; // already initialized for this element
		}

		const userCountry = this.currentUser?.phoneCountry || this.currentUser?.country || 'auto';
		const telOptions: any = this.commonServices.getTelInputOptions(userCountry);
		const instance = (intlTelInput as any)(el.nativeElement, telOptions);
		this.setPhoneObject(key, instance);

		this.addCustomCountrySearch(el.nativeElement);
		el.nativeElement.addEventListener('countrychange', () => {
			const countryData = instance.getSelectedCountryData();
			this.onCountryChange(countryData, key);
		});

		// Apply the country this field was asked for before it existed (saved
		// account data, or the current user's default). Deferred a microtask so
		// we never mutate state in the middle of change detection.
		const pending = this.pendingCountry[key] || this.currentUser?.phoneCountry;
		delete this.pendingCountry[key];
		if (pending) {
			Promise.resolve().then(() => instance.setCountry(pending));
		}
	}

	/**
	 * Set the country flag on a phone field, queueing it when the field has not
	 * been rendered yet (its section is still collapsed).
	 */
	private setPhoneCountry(key: PhoneFieldKey, iso2: string) {
		if (!iso2) {
			return;
		}
		const instance = this.getPhoneObject(key);
		if (instance) {
			instance.setCountry(iso2);
		} else {
			this.pendingCountry[key] = iso2;
		}
	}

	private getPhoneObject(key: PhoneFieldKey): any {
		switch (key) {
			case 'CellNumber': return this.CellNumberObject;
			case 'Dispatch': return this.DispatchObject;
			case 'CompanyCellNumber': return this.CompanyCellNumberObject;
			case 'Fax': return this.FaxObject;
		}
	}

	private setPhoneObject(key: PhoneFieldKey, value: any) {
		switch (key) {
			case 'CellNumber': this.CellNumberObject = value; break;
			case 'Dispatch': this.DispatchObject = value; break;
			case 'CompanyCellNumber': this.CompanyCellNumberObject = value; break;
			case 'Fax': this.FaxObject = value; break;
		}
	}


	buildAffiliateAccountForm() {
		this.addAffiliateAccountForm = this.formBuilder.group({
			acc_id: [""],
			AffiliateType: ["", Validators.required],
			FirstName: ["", Validators.required],
			MiddleName: [""],
			LastName: ["", Validators.required],
			Gender: ["male", Validators.required],
			// badge_city: [''],
			// badge_city_name: [''],
			CellNumber: [
				this.currentUser.phone,
				[
					Validators.required,
					Validators.pattern("^[0-9+]*$"),
					Validators.minLength(4),
					Validators.maxLength(15),
					this.customValidator.dashValidator(),
					this.customValidator.plusValidator(),
				],
			],
			CellIsd: ["+1", Validators.required],
			CellNumberCountry: ["us", Validators.required],
			Email: [
				"",
				[
					Validators.required,
					Validators.pattern(/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i),
				],
			],
			FirstYearBusiness: ["2022", [Validators.required]],
			CompanyName: [""],
			DBA: [""],
			Dispatch: [
				"",
				[
					Validators.pattern("^[0-9+]*$"),
					Validators.minLength(4),
					Validators.maxLength(15),
					this.customValidator.dashValidator(),
					this.customValidator.plusValidator(),
				],
			],
			DispatchIsd: ["+1"],
			DispatchCountry: ["us"],
			dispatchEmail: [
				"",
				[
					Validators.pattern(
						/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i
					),
				],
			],
			CompanyCellNumber: [
				"",
				[
					Validators.pattern("^[0-9+]*$"),
					Validators.minLength(4),
					Validators.maxLength(15),
					this.customValidator.dashValidator(),
					this.customValidator.plusValidator(),
				],
			],
			CompanyCellIsd: ["+1"],
			CompanyCellNumberCountry: ["us"],
			Fax: [
				"",
				[
					Validators.pattern("^[0-9+]*$"),
					Validators.minLength(4),
					Validators.maxLength(15),
					this.customValidator.dashValidator(),
					this.customValidator.plusValidator(),
				],
			],
			cpcn_tpc: [
				"",
				[
					this.customValidator.plusValidator(),
				],
			],
			FaxIsd: ["+1"],
			FaxCountry: ["us"],
			BusinessFrontPhoto: [""],
			BusinessBackPhoto: [""],
			LanguagesSpoken: this.formBuilder.array([], [Validators.required]),
			LanguagesGet: this.formBuilder.array([]),
			Associations: this.formBuilder.array([]),
			AssociationsGet: this.formBuilder.array([]),
		});
	}


	SetFormValue(form_control: string, value: any) {
		this.addAffiliateAccountForm.get(form_control).setValue(value)
		this.addAffiliateAccountForm.updateValueAndValidity()
	}

	/* ------------------------------------------------------------------ *
	 * Card questions -> affiliate type
	 *
	 * Two plain-language questions replace the old affiliate-type tiles. The
	 * mapping is pure conditional logic (no AI), and the resolved type is fed
	 * to the existing affiliateTypeSwitch(), which owns the guard modals,
	 * instruction modals and conditional validators.
	 * ------------------------------------------------------------------ */

	/** Answer to question 1. Resolves immediately unless it needs question 2. */
	selectOperator(answer: OperatorAnswer) {
		if (this.operatorAnswer === answer) {
			return;
		}

		const previousOperator = this.operatorAnswer;
		const previousStyle = this.driverStyle;

		this.operatorAnswer = answer;
		// Question 2 only applies to the own-vehicle branch.
		this.driverStyle = answer === "own_vehicle" ? this.driverStyle : null;

		const resolved = this.resolveAffiliateType();
		if (!resolved) {
			return; // waiting on question 2
		}

		if (!this.applyAffiliateType(resolved)) {
			this.operatorAnswer = previousOperator;
			this.driverStyle = previousStyle;
		}
	}

	/** Answer to question 2 (own-vehicle branch only). */
	selectDriverStyle(style: DriverStyle) {
		if (this.driverStyle === style) {
			return;
		}

		const previousStyle = this.driverStyle;
		this.driverStyle = style;

		const resolved = this.resolveAffiliateType();
		if (resolved && !this.applyAffiliateType(resolved)) {
			this.driverStyle = previousStyle;
		}
	}

	/**
	 * Hand the resolved type to the existing switch. Returns false when that
	 * switch blocked the change (illegal type change on an existing account —
	 * it shows #affiliateAlertMessageModal), so the cards can snap back.
	 */
	private applyAffiliateType(type: AffiliateTypeKey): boolean {
		const accepted = this.affiliateTypeSwitch(type) !== false;
		if (accepted) {
			// A type change can invalidate what the card scan offered.
			this.dismissScanReview();
		}
		return accepted;
	}

	/** Pure mapping from the card answers to one of the four affiliate types. */
	private resolveAffiliateType(): AffiliateTypeKey | null {
		if (this.operatorAnswer === "company") {
			return "fleet_operator";
		}
		if (this.operatorAnswer === "taxi") {
			return "taxi_operator";
		}
		if (this.operatorAnswer === "own_vehicle") {
			if (this.driverStyle === "black_car") {
				return "black_limo_operator";
			}
			if (this.driverStyle === "gig") {
				return "gig_operator";
			}
		}
		return null;
	}

	/** Inverse mapping, so a returning affiliate sees their cards preselected. */
	private deriveAnswersFromType(affiliateType: string) {
		switch (affiliateType) {
			case "fleet_operator":
				this.operatorAnswer = "company";
				this.driverStyle = null;
				break;
			case "taxi_operator":
				this.operatorAnswer = "taxi";
				this.driverStyle = null;
				break;
			case "black_limo_operator":
				this.operatorAnswer = "own_vehicle";
				this.driverStyle = "black_car";
				break;
			case "gig_operator":
				this.operatorAnswer = "own_vehicle";
				this.driverStyle = "gig";
				break;
			default:
				this.operatorAnswer = null;
				this.driverStyle = null;
		}
	}

	/* --- Section visibility (single source of truth for the template) --- */

	/** True once the card answers resolve to an affiliate type. */
	get affiliateTypeChosen(): boolean {
		return !!this.addAffiliateAccountForm?.get("AffiliateType")?.value;
	}

	/**
	 * Company / dispatch / business-card sections. `showCompanyInformation` is
	 * the flag affiliateTypeSwitch already maintains (false only for gig), so
	 * visibility can never disagree with conditionalValidations().
	 */
	get showCompanySection(): boolean {
		return this.affiliateTypeChosen && this.showCompanyInformation;
	}

	/** Confirm the owner e-mail only while it is new or differs from the saved one. */
	get showConfirmEmail(): boolean {
		return this.emailNeedsConfirm("Email", this.savedEmail);
	}

	/** Same for the dispatch e-mail, which only applies with company information. */
	get showConfirmDispatchEmail(): boolean {
		return this.showCompanySection && this.emailNeedsConfirm("dispatchEmail", this.savedDispatchEmail);
	}

	/** True when there is no saved address yet, or the field no longer matches it. */
	private emailNeedsConfirm(controlName: "Email" | "dispatchEmail", saved: string): boolean {
		const current = (this.addAffiliateAccountForm?.get(controlName)?.value || "").trim().toLowerCase();
		return !saved || current !== saved.trim().toLowerCase();
	}

	/** Required + must match the given e-mail control, but only while the field is shown. */
	private confirmEmailValidator(source: "Email" | "dispatchEmail", visible: () => boolean): ValidatorFn {
		return (control: AbstractControl) => {
			if (!visible()) {
				return null;
			}
			const confirm = (control.value || "").trim().toLowerCase();
			if (!confirm) {
				return { required: true };
			}
			const original = (this.addAffiliateAccountForm?.get(source)?.value || "").trim().toLowerCase();
			return confirm === original ? null : { mismatch: true };
		};
	}

	closeButton() {
		this.closeTab.emit();
	}
	back() {
		this.router.navigate(['/affiliate/step0'])
	}
	handleBadgeCity(value: any) {
		console.log(value, this.filteredOptions)
		this.filteredOptions = this.badgeOptions.filter((i: any) => i.name.toLowerCase().startsWith(value.toLowerCase()))
		if (!value) {
			this.isBadgeCity = false
		}
	}
	selectBadgeCity(option: any, isUserInput) {
		console.log('in function selectBadgeCity-->>>', option, isUserInput)
		if (isUserInput) {
			this.addAffiliateAccountForm.patchValue({
				badge_city: option.id
			})
			// this.addAffiliateAccountForm.updateValueAndValidity()
			this.isBadgeCity = true
		}

	}

	showImageInModal(imageUrl) {
		this.modalImage = imageUrl;
		// console.log("11111",imageUrl)
		$("#imageModal").addClass("showImage");
		$("#imageModal").removeClass("d-none");
		// $("#imageModal").show();
	}
	onCountryChange(event, type) {
		console.log(event);
		if (type == "CellNumber") {
			this.addAffiliateAccountForm.patchValue({
				CellIsd: "+" + event.dialCode,
				CellNumberCountry: event.iso2,
			});
			// CellNumber is readonly, so maybe no need to validate on user input, but good to have if it becomes editable
		} else if (type == "CompanyCellNumber") {
			this.addAffiliateAccountForm.patchValue({
				CompanyCellIsd: "+" + event.dialCode,
				CompanyCellNumberCountry: event.iso2,
			});
			this.validateCompanyCellPhone();
		} else if (type == "Dispatch") {
			this.addAffiliateAccountForm.patchValue({
				DispatchIsd: "+" + event.dialCode,
				DispatchCountry: event.iso2,
			});
			this.validateDispatchPhone();
		} else {
			this.addAffiliateAccountForm.patchValue({
				FaxIsd: "+" + event.dialCode,
				FaxCountry: event.iso2,
			});
			this.validateFax();
		}
	}

	validatePhoneGeneric(control: any, telInputObject: any) {
		if (control.value) {
			if (telInputObject.isValidNumber()) {
				control.setErrors(null);
			} else {
				const errorCode = telInputObject.getValidationError();
				let errorMsg = 'Invalid phone number';
				switch (errorCode) {
					case intlTelInputUtils.validationError.INVALID_COUNTRY_CODE:
						errorMsg = 'Invalid country code';
						break;
					case intlTelInputUtils.validationError.TOO_SHORT:
						errorMsg = 'Invalid phone number';
						break;
					case intlTelInputUtils.validationError.TOO_LONG:
						errorMsg = 'Invalid phone number';
						break;
					case intlTelInputUtils.validationError.NOT_A_NUMBER:
						errorMsg = 'Invalid phone number';
						break;
				}
				control.setErrors({ invalidIntl: errorMsg });
			}
		}
	}

	validateDispatchPhone() {
		this.validatePhoneGeneric(this.addAffiliateAccountForm.get('Dispatch'), this.DispatchObject);
	}

	validateCompanyCellPhone() {
		this.validatePhoneGeneric(this.addAffiliateAccountForm.get('CompanyCellNumber'), this.CompanyCellNumberObject);
	}

	validateFax() {
		this.validatePhoneGeneric(this.addAffiliateAccountForm.get('Fax'), this.FaxObject);
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
		const languageSpoken: FormArray = this.addAffiliateAccountForm.get(
			"LanguagesSpoken"
		) as FormArray;

		if (ischecked) {
			languageSpoken.push(new FormControl(val));
		} else {
			const index = languageSpoken.controls.findIndex(
				(x) => x.value === val
			);
			languageSpoken.removeAt(index);
		}
	}

	onAssociationChange(e) {
		const associations: FormArray = this.addAffiliateAccountForm.get(
			"Associations"
		) as FormArray;

		if (e.target.checked) {
			associations.push(new FormControl(e.target.value));
		} else {
			const index = associations.controls.findIndex(
				(x) => x.value === e.target.value
			);
			associations.removeAt(index);
		}
	}

	affiliateTypeSwitch(affiliateType: number | string, onRefresh: string | null = null) {
		const legend = {
			0: 'black_limo_operator',
			1: 'fleet_operator',
			2: 'taxi_operator',
			3: 'gig_operator'
		}
		if (typeof affiliateType == 'number') {
			affiliateType = legend[affiliateType]
		}


		switch (affiliateType) {
			case "fleet_operator": {
				this.showCompanyInformation = true;
				this.selectedAffiliate = "fleet_operator";
				this.affiliateInstructionHeading = "Fleet/Coach Operator";
				this.affiliateInstruction =
					"Fleet/Coach Operators must be fully licensed by city and state with a minimum $1,000,000 liability coverage. Fleet/Coach Operators may enter unlimited vehicles and drivers.";
				this.conditionalValidations("fleet_operator");
				this.subs = this.addAffiliateAccountForm.get('Email').valueChanges.subscribe((value) => {
					this.SetFormValue('dispatchEmail', value)
				})

				if (this.addAffiliateAccountForm.get('dispatchEmail').value == "") {
					this.addAffiliateAccountForm.patchValue({
						dispatchEmail: this.addAffiliateAccountForm.value.Email
					})
				}
				break;
			}
			case "black_limo_operator": {
				if (this.affiliateId) {
					if (this.currentUser.affiliate_type == "fleet_operator") {
						this.modalAlertMessage =
							"Fleet/Coach Operator can not change on Black Car / Owner Operators";
						$("#affiliateAlertMessageModal").modal("show");
						return false;
					}
				}
				if (!onRefresh) {
					$("#affiliateInstructionsModal").modal("show");
				}
				this.showCompanyInformation = true;
				this.selectedAffiliate = "black_limo_operator";
				this.affiliateInstructionHeading =
					"Black Car / Owner Operators";
				this.affiliateInstruction =
					"Black Car / Owner Operators need to be fully licensed by city and state with a $500k/$500k minimum insurance policy. Only 2 vehicle maximum with same driver.";
				this.conditionalValidations("black_limo_operator");
				if (this.addAffiliateAccountForm.get('dispatchEmail').value == "") {
					this.addAffiliateAccountForm.patchValue({
						dispatchEmail: this.addAffiliateAccountForm.value.Email
					})
				}
				try {
					this.subs.unsubscribe()
				}
				catch (err) {
					console.log('Subs is undefined. Returned with Error: ', err)
				}
				break;
			}
			case "taxi_operator": {
				if (this.affiliateId) {
					switch (this.currentUser.affiliate_type) {
						case "black_limo_operator": {
							this.modalAlertMessage =
								"Black Car / Owner Operators can not change on Taxi Operators";
							$("#affiliateAlertMessageModal").modal("show");
							return false;
						}
						case "fleet_operator": {
							this.modalAlertMessage =
								"Fleet/Coach Operators can not change on Taxi Operators";
							$("#affiliateAlertMessageModal").modal("show");
							return false;
						}
						case "gig_operator": {
							this.modalAlertMessage =
								"Gig Operators can not change on Taxi Operators";
							$("#affiliateAlertMessageModal").modal("show");
							return false;
						}
					}
					if (!onRefresh) {
						$("#affiliateInstructionsModal").modal("show");
					}
					if (this.addAffiliateAccountForm.get('dispatchEmail').value == "") {
						this.addAffiliateAccountForm.patchValue({
							dispatchEmail: this.addAffiliateAccountForm.value.Email
						})
					}
				}
				this.showCompanyInformation = true;
				this.selectedAffiliate = "taxi_operator";
				this.affiliateInstructionHeading = "Taxi Operators";
				this.affiliateInstruction =
					"Taxi Operators need to fully licensed by city and state with a minimum $500k/$500k insurance policy. 1 vehicle operation.";
				this.conditionalValidations("taxi_operator");
				try {
					this.subs.unsubscribe()
				}
				catch (err) {
					console.log('Subs is undefined. Returned with Error: ', err)
				}
				break;
			}
			case "gig_operator": {
				if (this.affiliateId) {
					if (this.currentUser.affiliate_type == "fleet_operator") {
						this.modalAlertMessage =
							"Fleet/Coach Operator can not change on Gig Operators";
						$("#affiliateAlertMessageModal").modal("show");
						return false;
					}
				}
				if (!onRefresh) {
					$("#affiliateInstructionsModal").modal("show");
				}
				this.showCompanyInformation = false;
				this.selectedAffiliate = "gig_operator";
				this.affiliateInstructionHeading = "Gig Operators";
				this.affiliateInstruction = `
				<ul>
				<li>Operate a new Mid-Size Sedan or Larger</li>
				<li>Operate any like new premium Mid-Size Sedan or Larger</li>
				<li>$ 500,000 Insurance</li>
				<li>6 months Driving Experience</li>
				<li><strong>4.5 Stars</strong> or better</li>
				</ul>`;
				this.conditionalValidations("gig_operator");
				try {
					this.subs.unsubscribe()
				}
				catch (err) {
					console.log('Subs is undefined. Returned with Error: ', err)
				}
				break;
			}
		}
		this.SetFormValue('AffiliateType', affiliateType)
		if (!onRefresh) {
			$("#affiliateInstructionsModal").modal("show");
		}
	}

	searchGender(keyword) {
		this.addAffiliateAccountForm.patchValue({
			Gender: "",
		});
		if (keyword == "") {
			this.filteredGender = this.filterGender;
		} else {
			this.filteredGender = this.filterGender
				.filter((gender: any) => {
					if (gender.label.toLowerCase() === keyword.toLowerCase()) {
						this.addAffiliateAccountForm.patchValue({
							Gender: gender.value,
						});
					}
					return gender.label
						.toLowerCase()
						.includes(keyword.toLowerCase());
				})
				.sort((a: any, b: any) => {
					return this.searchSorting(keyword, a, b);
				});
		}
	}
	selectGender(val, isSelected) {
		if (isSelected) {
			// ignore on deselection of the previous option
			this.addAffiliateAccountForm.patchValue({
				Gender: val,
			});
		}
	}

	searchSorting(keyword, a, b) {
		// Sort results by matching name with keyword position in name
		if (
			a.label.toLowerCase().indexOf(keyword.toLowerCase()) >
			b.label.toLowerCase().indexOf(keyword.toLowerCase())
		) {
			return 1;
		} else if (
			a.label.toLowerCase().indexOf(keyword.toLowerCase()) <
			b.label.toLowerCase().indexOf(keyword.toLowerCase())
		) {
			return -1;
		} else {
			if (a.label > b.label) return 1;
			else return -1;
		}
	}

	conditionalValidations(affiliateType) {
		if (affiliateType != "gig_operator") {
			this.addAffiliateAccountForm.controls["CompanyName"].setValidators([
				Validators.required,
			]);
			this.addAffiliateAccountForm.controls[
				"dispatchEmail"
			].setValidators([Validators.required]);
			this.addAffiliateAccountForm.controls["Dispatch"].setValidators([
				Validators.required,
				Validators.pattern("^[0-9+]*$"),
				Validators.minLength(4),
				Validators.maxLength(15),
				this.customValidator.dashValidator(),
				this.customValidator.plusValidator(),
			]);
			this.addAffiliateAccountForm.controls["DispatchIsd"].setValidators([
				Validators.required,
			]);
			this.addAffiliateAccountForm.controls[
				"DispatchCountry"
			].setValidators([Validators.required]);
			this.addAffiliateAccountForm.controls[
				"BusinessFrontPhoto"
			].setValidators([Validators.required]);
		} else {
			this.addAffiliateAccountForm.controls[
				"CompanyName"
			].clearValidators();
			this.addAffiliateAccountForm.controls[
				"dispatchEmail"
			].clearValidators();
			this.addAffiliateAccountForm.controls["Dispatch"].clearValidators();
			this.addAffiliateAccountForm.controls[
				"DispatchIsd"
			].clearValidators();
			this.addAffiliateAccountForm.controls[
				"DispatchCountry"
			].clearValidators();
			this.addAffiliateAccountForm.controls[
				"BusinessFrontPhoto"
			].clearValidators();
		}
		this.addAffiliateAccountForm.controls[
			"CompanyName"
		].updateValueAndValidity();
		this.addAffiliateAccountForm.controls[
			"dispatchEmail"
		].updateValueAndValidity();
		this.addAffiliateAccountForm.controls[
			"Dispatch"
		].updateValueAndValidity();
		this.addAffiliateAccountForm.controls[
			"DispatchIsd"
		].updateValueAndValidity();
		this.addAffiliateAccountForm.controls[
			"DispatchCountry"
		].updateValueAndValidity();
		this.addAffiliateAccountForm.controls[
			"BusinessFrontPhoto"
		].updateValueAndValidity();
	}

	openSnackbar() {
		var x = document.getElementById("snackbar");
		x.className = "show";
		setTimeout(function () {
			x.className = x.className.replace("show", "");
		}, 5000);
	}

	/* ------------------------------------------------------------------ *
	 * Scan Business Card
	 *
	 * One photo does two jobs: it is uploaded as the (required) Business Card
	 * Front Photo, and it is sent to the backend OpenAI Vision feature
	 * (document_extract) to pre-fill the company fields. Nothing is written to
	 * the form until the user reviews and confirms — every value stays editable.
	 * ------------------------------------------------------------------ */

	async onScanBusinessCard(event: any) {
		if (!await this.commonServices.handleFile(event)) {
			return;
		}
		if (!event.target.files || !event.target.files.length) {
			return;
		}

		this.scanError = "";
		this.scanFoundNothing = false;
		this.scanSuggestions = [];
		this.scanInProgress = true;

		const [file] = event.target.files;
		const reader = new FileReader();
		reader.readAsDataURL(file);
		reader.onload = () => {
			const dataUrl = reader.result as string;
			// Allow re-scanning the same file straight after a failure.
			event.target.value = "";
			this.uploadScannedCard(dataUrl);
			this.extractScannedCard(dataUrl);
		};
		reader.onerror = () => {
			this.scanInProgress = false;
			this.scanError = "We could not read that file. Please try another photo.";
		};
	}

	/** Store the scanned image as the Business Card Front Photo. */
	private uploadScannedCard(dataUrl: string) {
		this.imageSrc = dataUrl;
		this.affiliateService
			.uploadVehicleImage(dataUrl)
			.pipe(
				catchError((err) => {
					return throwError(err);
				})
			)
			.subscribe(({ data }: any) => {
				this.addAffiliateAccountForm.patchValue({
					BusinessFrontPhoto: data.id,
				});
				this.BusinessFrontPhoto = data.image;
				this.BusinessFrontPhotoId = data.id;
			});
	}

	/** Ask the backend vision feature to read the card, then build the review list. */
	private extractScannedCard(dataUrl: string) {
		this.affiliateAiService.extractBusinessCard(dataUrl).subscribe({
			next: (result) => {
				this.scanInProgress = false;
				this.scanConfidence = result.confidence;
				this.scanNotes = result.notes;
				this.scanSuggestions = this.buildScanSuggestions(result.fields);
				this.scanFoundNothing = this.scanSuggestions.length === 0;
			},
			error: (err: Error) => {
				this.scanInProgress = false;
				this.scanError = err.message;
			},
		});
	}

	/**
	 * Map extracted fields onto the form controls they would populate, dropping
	 * anything empty or identical to what the user already has.
	 */
	private buildScanSuggestions(fields: any): ExtractedFieldSuggestion[] {
		const candidates: Array<{ control: string; label: string; value: string }> = [
			{ control: "CompanyName", label: "Company name", value: fields.company_name },
			{ control: "DBA", label: "Doing business as", value: fields.dba },
			{ control: "FirstName", label: "First name", value: fields.first_name },
			{ control: "LastName", label: "Last name", value: fields.last_name },
			{ control: "Dispatch", label: "24 hr dispatch cell", value: this.toPhoneDigits(fields.phone) },
		];

		// Never overwrite an owner e-mail that is already filled in; offer the
		// card's e-mail as the dispatch e-mail instead.
		if (fields.email) {
			if (this.addAffiliateAccountForm.get("Email")?.value) {
				candidates.push({ control: "dispatchEmail", label: "24 hr dispatch e-mail", value: fields.email });
			} else {
				candidates.push({ control: "Email", label: "Owner / admin e-mail", value: fields.email });
			}
		}

		return candidates
			.filter((c) => {
				if (!c.value) {
					return false;
				}
				const control = this.addAffiliateAccountForm.get(c.control);
				return !!control && control.value !== c.value;
			})
			.map((c) => ({ ...c, apply: true }));
	}

	/** Keep only digits so the value satisfies the existing phone validators. */
	private toPhoneDigits(value: string): string {
		const digits = (value || "").replace(/\D/g, "");
		// The control allows 4-15 digits; anything longer is not a usable number.
		return digits.length >= 4 && digits.length <= 15 ? digits : "";
	}

	/** Write the checked (and possibly edited) values into the form. */
	applyScanSuggestions() {
		const patch: Record<string, string> = {};
		this.scanSuggestions
			.filter((s) => s.apply && (s.value || "").trim())
			.forEach((s) => {
				patch[s.control] = s.value.trim();
			});

		if (Object.keys(patch).length) {
			this.addAffiliateAccountForm.patchValue(patch);
			Object.keys(patch).forEach((control) => {
				this.addAffiliateAccountForm.get(control)?.markAsTouched();
			});
			// Re-run intl validation for any phone we just filled in.
			if (patch["Dispatch"]) {
				this.validateDispatchPhone();
			}
		}

		this.dismissScanReview();
	}

	/** Close the review panel without touching the form. */
	dismissScanReview() {
		this.scanSuggestions = [];
		this.scanError = "";
		this.scanFoundNothing = false;
		this.scanConfidence = 0;
		this.scanNotes = "";
	}

	async businessCardImageChange(event, imageType, imageId = null) {
		if (!await this.commonServices.handleFile(event)) {
			return;
		}
		this.stateManagementService.setprogressBar(true); //show progressBar
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
							this.stateManagementService.setprogressBar(false); // hide progressBar
							return throwError(err);
						})
					)
					.subscribe(({ data }: any) => {
						switch (imageType) {
							case "BusinessFrontPhoto": {
								this.addAffiliateAccountForm.patchValue({
									BusinessFrontPhoto: data.id,
								});
								this.BusinessFrontPhoto = data.image;
								this.BusinessFrontPhotoId = data.id;
								break;
							}
							case "BusinessBackPhoto": {
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
			};
		}
		// console.log(this.addInsuranceForm.value);
	}

	deleteImage(id, imageType) {
		switch (imageType) {
			case "BusinessFrontPhoto": {
				this.addAffiliateAccountForm.patchValue({
					BusinessFrontPhoto: "",
				});
				this.BusinessFrontPhoto = "";
				break;
			}
			case "BusinessBackPhoto": {
				this.addAffiliateAccountForm.patchValue({
					BusinessBackPhoto: "",
				});
				this.BusinessBackPhoto = "";
				break;
			}
			default: {
				break;
			}
		}
	}
	// Focus on FirstName field
	FocusField() {
		$("#FirstName").focus();
	}

	get f() {
		return this.addAffiliateAccountForm.controls;
	}

	submitForm() {
		console.log(this.addAffiliateAccountForm);
		this.submittedForm = true;

		// Sync CellNumber Country Data
		if (this.CellNumberObject) {
			const countryData = this.CellNumberObject.getSelectedCountryData();
			if (countryData && countryData.dialCode) {
				this.addAffiliateAccountForm.patchValue({
					CellIsd: '+' + countryData.dialCode,
					CellNumberCountry: countryData.iso2
				});
			}
		}

		// Sync Dispatch Country Data
		if (this.DispatchObject) {
			const countryData = this.DispatchObject.getSelectedCountryData();
			if (countryData && countryData.dialCode) {
				this.addAffiliateAccountForm.patchValue({
					DispatchIsd: '+' + countryData.dialCode,
					DispatchCountry: countryData.iso2
				});
			}
		}

		// Sync CompanyCellNumber Country Data
		if (this.CompanyCellNumberObject) {
			const countryData = this.CompanyCellNumberObject.getSelectedCountryData();
			if (countryData && countryData.dialCode) {
				this.addAffiliateAccountForm.patchValue({
					CompanyCellIsd: '+' + countryData.dialCode,
					CompanyCellNumberCountry: countryData.iso2
				});
			}
		}

		// Sync Fax Country Data
		if (this.FaxObject) {
			const countryData = this.FaxObject.getSelectedCountryData();
			if (countryData && countryData.dialCode) {
				this.addAffiliateAccountForm.patchValue({
					FaxIsd: '+' + countryData.dialCode,
					FaxCountry: countryData.iso2
				});
			}
		}
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



		// Sanitize Fax (remove Country Code if present)
		if (this.addAffiliateAccountForm.value.Fax && this.addAffiliateAccountForm.value.FaxIsd && this.addAffiliateAccountForm.value.Fax.startsWith(this.addAffiliateAccountForm.value.FaxIsd)) {
			this.addAffiliateAccountForm.value.Fax = this.addAffiliateAccountForm.value.Fax.substring(this.addAffiliateAccountForm.value.FaxIsd.length);
		}

		// Sanitize CompanyCell (remove Country Code if present)
		if (this.addAffiliateAccountForm.value.CompanyCell && this.addAffiliateAccountForm.value.CompanyCellIsd && this.addAffiliateAccountForm.value.CompanyCell.startsWith(this.addAffiliateAccountForm.value.CompanyCellIsd)) {
			this.addAffiliateAccountForm.value.CompanyCell = this.addAffiliateAccountForm.value.CompanyCell.substring(this.addAffiliateAccountForm.value.CompanyCellIsd.length);
		}

		// Sanitize Dispatch (remove Country Code if present)
		if (this.addAffiliateAccountForm.value.Dispatch && this.addAffiliateAccountForm.value.DispatchIsd && this.addAffiliateAccountForm.value.Dispatch.startsWith(this.addAffiliateAccountForm.value.DispatchIsd)) {
			this.addAffiliateAccountForm.value.Dispatch = this.addAffiliateAccountForm.value.Dispatch.substring(this.addAffiliateAccountForm.value.DispatchIsd.length);
		}

		// Sanitize Cell (remove Country Code if present)
		if (this.addAffiliateAccountForm.value.Cell && this.addAffiliateAccountForm.value.CellIsd && this.addAffiliateAccountForm.value.Cell.startsWith(this.addAffiliateAccountForm.value.CellIsd)) {
			this.addAffiliateAccountForm.value.Cell = this.addAffiliateAccountForm.value.Cell.substring(this.addAffiliateAccountForm.value.CellIsd.length);
		}
		this.addAffiliateAccountForm.value.stepCompleted =
			this.affiliateService.getUpdatedStepsLocal("1");

		this.spinner.show();
		this.disableSubmitButton = true; //disable submit button

		this.affiliateService
			.addAffiliateAccount(this.addAffiliateAccountForm.value)
			.pipe(
				catchError((err) => {
					this.spinner.hide(); //hide spinner
					this.disableSubmitButton = false; //enable submit button
					return throwError(err);
				})
			)
			.subscribe(({ success, data }: any) => {
				this.spinner.hide(); //hide spinner
				this.disableSubmitButton = false; //enable submit button

				if (!this.addAffiliateAccountForm.value.id) {
					console.log(data, "check data");
					console.log(
						"Id not get",
						this.addAffiliateAccountForm.value.id
					);
					localStorage.setItem(
						"currentUser",
						JSON.stringify(data.user)
					);
					if (success == true) {
						this.affiliateService.updateStepsLocal("1");
					}
				} else {
					console.log("Id get");
				}

				this.goToNextStep();
			});
	}

	/**
	 * Moves on once step 1 is saved.
	 */
	goToNextStep() {
		if (!this.addAffiliateAccountForm.value.id) {
			this.router
				.navigateByUrl("/RefreshComponent", {
					skipLocationChange: true,
				})
				.then(() => {
					this.router.navigate(["/affiliate/step2"]);
				});
		} else {
			this.router.navigate(["/affiliate/step1"]);
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
		this.affiliateService
			.uploadVehicleImage(this.imageSrc)
			.pipe(
				catchError((err) => {
					this.stateManagementService.setprogressBar(false); // hide progressBar
					return throwError(err);
				})
			)
			.subscribe(({ data }: any) => {
				switch (imageType) {
					case "BusinessFrontPhoto": {
						this.addAffiliateAccountForm.patchValue({
							BusinessFrontPhoto: data.id,
						});
						this.BusinessFrontPhoto = data.image;
						this.BusinessFrontPhotoId = data.id;
						break;
					}
					case "BusinessBackPhoto": {
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

	changeLang(event) {
		console.log(event);

		var $frame = $(".goog-te-menu-frame:first");
		if (!$frame.size()) {
			alert("Error: Could not find Google translate frame.");
			return false;
		}
		$frame
			.contents()
			.find(".goog-te-menu2-item span.text:contains(" + event.value + ")")
			.get(0)
			.click();
		return false;
	}
	scroll(id) {
		let el = document.getElementById(id);
		let elementRect = el.getBoundingClientRect();
		let absoluteElementTop = elementRect.top + window.pageYOffset;
		let topElement = absoluteElementTop - 200;

		console.log(`scrolling to ${id}`, el, absoluteElementTop, window.innerHeight);
		window.scrollTo({
			top: topElement,
			behavior: 'smooth'
		});
	}
	resetForm() {
		console.log('this.affiliateDetail?.acc_id--->>', this.affiliateDetail)
		// this.addAffiliateAccountForm.reset();
		this.addAffiliateAccountForm = this.formBuilder.group({
			acc_id: [this.affiliateDetail?.id],
			AffiliateType: ["", Validators.required],
			FirstName: ["", Validators.required],
			MiddleName: [""],
			LastName: ["", Validators.required],
			Gender: ["", Validators.required],
			// badge_city: [''],
			// badge_city_name: [''],
			CellNumber: [
				this.currentUser.phone,
				[
					Validators.required,
					Validators.pattern("^[0-9+]*$"),
					Validators.minLength(4),
					Validators.maxLength(15),
					this.customValidator.dashValidator(),
					this.customValidator.plusValidator(),
				],
			],
			CellIsd: ["+1", Validators.required],
			CellNumberCountry: ["us", Validators.required],
			Email: [
				"",
				[
					Validators.required,
					Validators.pattern(/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i),
				],
			],
			FirstYearBusiness: ["", [Validators.required]],
			CompanyName: ["", [Validators.required]],
			DBA: [""],
			Dispatch: [
				"",
				[
					Validators.pattern("^[0-9+]*$"),
					Validators.minLength(4),
					Validators.maxLength(15),
					Validators.required,
					this.customValidator.dashValidator(),
					this.customValidator.plusValidator(),
				],
			],
			DispatchIsd: ["+1"],
			DispatchCountry: ["us"],
			dispatchEmail: [
				"",
				[
					Validators.pattern(
						/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i
					),
				],
			],
			CompanyCellNumber: [
				"",
				[
					Validators.pattern("^[0-9+]*$"),
					Validators.minLength(4),
					Validators.maxLength(15),
					this.customValidator.dashValidator(),
					this.customValidator.plusValidator(),
				],
			],
			CompanyCellIsd: ["+1"],
			CompanyCellNumberCountry: ["us"],
			Fax: [
				"",
				[
					Validators.pattern("^[0-9+]*$"),
					Validators.minLength(4),
					Validators.maxLength(15),
					this.customValidator.dashValidator(),
					this.customValidator.plusValidator(),
				],
			],
			cpcn_tpc: [
				"",
				[
					this.customValidator.plusValidator(),
				],
			],
			FaxIsd: ["+1"],
			FaxCountry: ["us"],
			BusinessFrontPhoto: ["", [Validators.required]],
			BusinessBackPhoto: [""],
			LanguagesSpoken: this.formBuilder.array([], [Validators.required]),
			LanguagesGet: this.formBuilder.array([]),
			Associations: this.formBuilder.array([]),
			AssociationsGet: this.formBuilder.array([]),
		});
		this.BusinessFrontPhoto = "";
		this.BusinessBackPhoto = "";
		this.onLanguageChange("1", true);
		this.addAffiliateAccountForm.patchValue({
			Email: this.affiliateDetail.Email,
			CellNumber: this.affiliateDetail.CellNumber,
			AffiliateType: this.affiliateDetail.AffiliateType
		});
		if (this.affiliateDetail.AffiliateType != "gig_operator") {
			this.addAffiliateAccountForm.patchValue({
				dispatchEmail: this.affiliateDetail.dispatchEmail,
			});
		}
		this.confirmEmailControl.reset("");
		this.confirmDispatchEmailControl.reset("");
		// Keep the card questions in step with the freshly rebuilt form.
		this.deriveAnswersFromType(this.affiliateDetail.AffiliateType);
		this.dismissScanReview();
		this.addAffiliateAccountForm.updateValueAndValidity()
		this.scroll('owner_info')
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
