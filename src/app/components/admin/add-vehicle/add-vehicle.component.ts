import { AfterViewChecked, Component, ElementRef, EventEmitter, Input, OnInit, ViewChild } from '@angular/core';
import { AdminService } from '../../../services/admin.service';
import { StateManagementService } from '../../../services/statemanagement.service';
import { FormGroup, FormBuilder, Validators, FormArray, FormControl } from '@angular/forms';
import { NgxSpinnerService } from "ngx-spinner";
import { Router, ActivatedRoute } from '@angular/router';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { HttpClient } from "@angular/common/http";
import { ErrorDialogService } from 'src/app/services/error-dialog/errordialog.service';
import { CommonService } from 'src/app/services/common.service';
import { PHOTO_GUIDES, PhotoGuide } from '../../affiliate/add-vehicle-from-affiliate/photo-guide.config';

declare var $: any;

@Component({
	selector: 'app-add-vehicle',
	templateUrl: './add-vehicle.component.html',
	styleUrls: ['./add-vehicle.component.scss']
})
export class AddVehicleComponent implements OnInit {

	public tree: any;
	public affiliateId: string;
	public affiliateType: string;
	public paramResponse: any;
	public vehicleTypeId: string;
	public imageSrc: string;
	public vehicleImageArray: Array<object> = [];
	public stepCompleted: string;
	public selectedDefaultModel: String;

	public addVehicleForm: FormGroup;
	public submittedForm: boolean;
	public disableSubmitButton: boolean = false;
	public vehicleSettingProgressBar: boolean = false;
	public response: any;
	public year: Array<object>;
	public filteredYear: Array<object>;
	public make: Array<any>;
	public filteredMake: Array<object>;
	public model: Array<any>;
	public filteredModel: Array<any>;
	public vehicleTypes: Array<object>;
	public filteredVehicleTypes: Array<object>;
	public color: Array<object>;
	public filteredColor: Array<object>;
	public chargableAmenities: object;
	public nonChargableAmenities: object;
	public specialAmenities: object;
	public interiors: object;
	public allModels = JSON.parse(sessionStorage.getItem('models'));

	public vehicleImage1: string;
	public vehicleImage2: string;
	public vehicleImage3: string;
	public vehicleImage4: string;
	public vehicleImage5: string;
	public vehicleImage6: string;
	public vehicleImage7: string;
	public vehicleImage8: string;
	public vehicleImage9: string;

	public oldvehicleImage: any = [];

	public vehicleImageId1: string;
	public vehicleImageId2: string;
	public vehicleImageId3: string;
	public vehicleImageId4: string;
	public vehicleImageId5: string;
	public vehicleImageId6: string;
	public vehicleImageId7: string;
	public vehicleImageId8: string;
	public vehicleImageId9: string;

	public rearPlateImage: string;
	public windowPermitImage: string;
	public windowPermit2Image: string;
	public usdotPermitImage: string;
	public mcImage: string;


	public rearPlateId: string;
	public windowPermitId: string;
	public windowPermit2Id: string;
	public usdotPermitId: string;
	public mcId: string;
	public modalImage: string;
	public luggageOptions: any = [];
	public seatOptions: any = [];
	public charterCancelOptions: Array<Object>;
	public nonCharterCancelOptions: Array<Object>;
	public serviceType: string;
	isVehicleTypeSelected: boolean = false

	public vehicleId: string;
	public isEditMode: boolean = false;
	public isDuplicateMode: boolean = false;
	public response2: any;
	public originalNumberOfVehicles: number = 0;

	public selectedChargableAmenities = new Set<number>();
	public selectedNonChargableAmenities = new Set<number>();
	public selectedSpecialAmenities = new Set<number>();
	public selectedInteriors = new Set<number>();

	@Input() closeTab: EventEmitter<any> = new EventEmitter();
	@ViewChild('sharedFileInput') sharedFileInput!: ElementRef<HTMLInputElement>;

	isGuideVisible = false;
	currentGuide: PhotoGuide | null = null;
	pendingSlot = '';

	errorMsg: boolean;
	errorMsg1: boolean;
	errorMsg2: boolean;
	errorMsg3: boolean;
	errorMsg4: boolean;

	public driverRes: any;
    public driverList: any[] = [];

	constructor(
		private adminService: AdminService,
		private router: Router,
		private stateManagementService: StateManagementService,
		private formBuilder: FormBuilder,
		private spinner: NgxSpinnerService,
		private activatedroute: ActivatedRoute,
		private httpClient: HttpClient,
		private commonServices: CommonService,
		private errorModal: ErrorDialogService) { }

	ngAfterViewChecked() {
		$(".camera-svg").tooltip({
			trigger: 'hover'
		});
		$(".camera-svg").on('mouseleave', function () {
			$(this).tooltip('dispose');
		});
		$(".camera-svg").on('click', function () {
			$(this).tooltip('dispose');
		});
		$(".backbutton").tooltip({
			trigger: 'hover'
		});
		$(".backbutton").on('mouseleave', function () {
			$(this).tooltip('dispose');
		});
		$(".backbutton").on('click', function () {
			$(this).tooltip('dispose');
		});
	}

	ngOnInit(): void {
		$('#vehicleTypeField').focusout(() => {
			this.errorMsg = true;
		})
		$('#makeField').focusout(() => {
			this.errorMsg1 = true;
		})
		$('#modelField').focusout(() => {
			this.errorMsg2 = true;
		})
		$('#yearField').focusout(() => {
			this.errorMsg3 = true;
		})
		$('#colorField').focusout(() => {
			this.errorMsg4 = true;
		})
		//pick vehicle type id from query params
		this.activatedroute.queryParamMap.subscribe((params) => {
			console.log('params--->>>', params)
			this.paramResponse = { ...params.keys, ...params };
			this.vehicleTypeId = this.paramResponse.params.vehicleTypeId;
			this.vehicleId = this.paramResponse.params.vehicleId;
			this.isDuplicateMode = this.paramResponse.params.new === 'true';
			this.isEditMode = !!this.vehicleId && !this.isDuplicateMode;
		});
		this.httpClient.get("assets/json/charterOptions.json").subscribe((data: any) => {
			this.nonCharterCancelOptions = data;
			this.charterCancelOptions = data;
		});

		//data for dropdown of seats and luggage
		for (let i = 0; i <= 75; i++) {
			this.luggageOptions.push(i);
		}
		for (let i = 4; i <= 75; i++) {
			this.seatOptions.push(i);
		}

		this.affiliateId = sessionStorage.getItem("affiliateId");
		// this.stepCompleted = sessionStorage.getItem("stepCompleted");

		sessionStorage.setItem('vehicleTypeId', this.vehicleTypeId);

		//add amenity form validation
		this.addVehicleForm = this.formBuilder.group({
			id: [''],
			acc_id: [''],
			vehicleType: ['', Validators.required],
			make: ['', Validators.required],
			model: ['', Validators.required],
			year: ['', Validators.required],
			color: ['', Validators.required],
			licensePlate: ['', Validators.required],
			numberOfVehicles: [1],
			seats: [4, [Validators.required, Validators.pattern("^[0-9]*$")]],
			luggage: [2, [Validators.required, Validators.pattern("^[0-9]*$")]],
			charterCancelPolicy: ['24', Validators.required],
			nonCharterCancelPolicy: ['24', Validators.required],
			typeOfService: this.formBuilder.array([], [Validators.required]),
			amenities: this.formBuilder.array([]),
			specialAmenities: this.formBuilder.array([]),
			vehicleInterior: this.formBuilder.array([], [Validators.required]),
			vehicle_image_1: ['', Validators.required],
			vehicle_image_2: [''],
			vehicle_image_3: [''],
			vehicle_image_4: [''],
			vehicle_image_5: [''],
			vehicle_image_6: [''],
			vehicle_image_7: [''],
			vehicle_image_8: [''],
			vehicle_image_9: [''],
			rearPlateImage: [''],
			windowPermitImage: [''],
			windowPermit2Image: [''],
			usdotPermitImage: [''],
			mcImage: [''],
			associatedDriver: [null],
		});
		//Put Black color value by default in Color
		let colorField: any = document.getElementById('colorField');
		colorField.value = "Black";
		this.addVehicleForm.patchValue({
			color: 1,
		});

		this.affiliateType = sessionStorage.getItem("affiliateType");
		if (this.affiliateType != 'fleet_operator') {
			console.log("in if setting lecesne plate")
			// this.addVehicleForm.controls['licensePlate'].setValidators([Validators.required]);
			// this.addVehicleForm.controls['licensePlate'].updateValueAndValidity();
			// this.addVehicleForm.controls['rearPlateImage'].setValidators([Validators.required]);
			// this.addVehicleForm.controls['rearPlateImage'].updateValueAndValidity();
		}

		this.stateManagementService.getNumberOfVehicles().subscribe(numberOfVehicles => {
			let numberOfVehiclesCanBeAdded;
			if (this.affiliateType == 'fleet_operator') {
				this.addVehicleForm.controls['numberOfVehicles'].setValidators([Validators.required, Validators.pattern("^[0-9]*$")]);
			}
			else if (this.affiliateType == 'black_limo_operator') {
				numberOfVehiclesCanBeAdded = 2 - numberOfVehicles;
				this.addVehicleForm.controls['numberOfVehicles'].setValidators([Validators.required, Validators.pattern("^[0-9]*$"), Validators.min(1), Validators.max(numberOfVehiclesCanBeAdded)]);
			}
			else {
				numberOfVehiclesCanBeAdded = 1 - numberOfVehicles;
				this.addVehicleForm.controls['numberOfVehicles'].setValidators([Validators.required, Validators.pattern("^[0-9]*$"), Validators.min(1), Validators.max(numberOfVehiclesCanBeAdded)]);
			}
			this.addVehicleForm.controls['numberOfVehicles'].updateValueAndValidity();
		});

		/** spinner starts on init */
		this.spinner.show();
		// Load Our amenities using API
		this.adminService.adminAffiliateGetFieldsData()
			.pipe(
				catchError(err => {
					this.spinner.hide();
					return throwError(err);
				})
			).subscribe(result => {
				this.response = result;
				this.filteredYear = this.year = this.response.data.years;
				this.filteredMake = this.make = this.response.data.make;
				this.filteredModel = this.model = this.response.data.model;
				this.filteredVehicleTypes = this.vehicleTypes = this.response.data.vehicle_types;
				this.filteredColor = this.color = this.response.data.color;
				this.chargableAmenities = this.response.data.chargableAmenities;
				this.nonChargableAmenities = this.response.data.nonChargableAmenities;
				this.specialAmenities = this.response.data.specialAmenities;
				this.interiors = this.response.data.vehicleInterior;
				const vehicleInterior: FormArray = this.addVehicleForm.get('vehicleInterior') as FormArray;
				vehicleInterior.push(new FormControl('1'));
				sessionStorage.setItem('models', JSON.stringify(this.model));
				console.log("<><><><><><><><><><><><><><><><><><>", this.response.data)

				this.vehicleImage1 = this.oldvehicleImage[0] = null;
				this.vehicleImage2 = this.oldvehicleImage[1] = null;
				this.vehicleImage3 = this.oldvehicleImage[2] = null;
				this.vehicleImage4 = this.oldvehicleImage[3] = null;
				this.vehicleImage5 = this.oldvehicleImage[4] = null;
				this.vehicleImage6 = this.oldvehicleImage[5] = null;
				this.vehicleImage7 = this.oldvehicleImage[6] = null;
				this.vehicleImage8 = this.oldvehicleImage[7] = null;
				this.vehicleImage9 = this.oldvehicleImage[8] = null;

				this.vehicleImageId1 = this.response.data.vehicleImage1.id;
				this.vehicleImageId2 = this.response.data.vehicleImage2.id;
				this.vehicleImageId3 = this.response.data.vehicleImage3.id;
				this.vehicleImageId4 = this.response.data.vehicleImage4.id;
				this.vehicleImageId5 = this.response.data.vehicleImage5.id;
				this.vehicleImageId6 = this.response.data.vehicleImage6.id;
				this.vehicleImageId7 = this.response.data.vehicleImage7.id;
				this.vehicleImageId8 = this.response.data.vehicleImage8.id;
				this.vehicleImageId9 = this.response.data.vehicleImage9.id;

				this.rearPlateImage = this.oldvehicleImage[9] = '';
				this.windowPermitImage = this.oldvehicleImage[10] = '';
				this.windowPermit2Image = this.oldvehicleImage[11] = '';
				this.usdotPermitImage = this.oldvehicleImage[12] = '';
				this.mcImage = this.oldvehicleImage[13] = '';

				this.rearPlateId = this.response.data.rear_plate.id;
				this.windowPermitId = this.response.data.window_permit.id;
				this.windowPermit2Id = this.response.data.window_permit_1.id;
				this.usdotPermitId = this.response.data.USDOT_permit.id;
				this.mcId = this.response.data.mc.id;

				//get models as per make
				let models = JSON.parse(sessionStorage.getItem('models'));
				let selectedMake = this.make[0].ID;
				let resmodels = models.filter(function (model) {
					if (model.make_id == selectedMake) {
						return true;
					}
				});
				this.model = resmodels;

				this.addVehicleForm.patchValue({
					vehicle_image_1: this.vehicleImageId1,
					vehicle_image_2: this.vehicleImageId2,
					vehicle_image_3: this.vehicleImageId3,
					vehicle_image_4: this.vehicleImageId4,
					vehicle_image_5: this.vehicleImageId5,
					vehicle_image_6: this.vehicleImageId6,
					vehicle_image_7: this.vehicleImageId7,
					vehicle_image_8: this.vehicleImageId8,
					vehicle_image_9: this.vehicleImageId9,
					rearPlateImage: this.rearPlateId,
					windowPermitImage: this.windowPermitId,
					windowPermit2Image: this.windowPermit2Id,
					usdotPermitImage: this.usdotPermitId,
					mcImage: this.mcId,
				});
				this.spinner.hide();
				if (this.isDuplicateMode || this.isEditMode) {
				this.loadVehicleData();
				} else {
				this.pushValuesTypeOfService(['local']);
				}
			});
		this.Subscriptions()
        this.loadDriver();
	}

	loadVehicleData() {
		if (!this.vehicleId) return;
		this.spinner.show();
		this.adminService.adminAffiliateGetVehicleData(this.vehicleId)
		.pipe(catchError(err => { this.spinner.hide(); return throwError(err); }))
		.subscribe(result2 => {
		this.response2 = result2;
		const data = this.response2.data;

		// ✅ Fixed helper: only update if data exists; never blank out in edit mode
		const loadImg = (key: string, num: string) => {
			if (data[key]) {
			this[`vehicleImage${num}`] = data[key].image;
			this[`vehicleImageId${num}`] = data[key].ID;
			this.addVehicleForm.patchValue({ [`vehicle_image_${num}`]: data[key].ID });
			}
			// ✅ If data[key] is missing, leave the field as-is (don't blank it)
		};

		// Vehicle image 1 — always load for both edit and duplicate
		if (data.vehicle_image_1) {
			this.vehicleImage1 = data.vehicle_image_1.image;
			this.vehicleImageId1 = data.vehicle_image_1.ID;
			this.addVehicleForm.patchValue({ vehicle_image_1: this.vehicleImageId1 });
		}

		// ✅ Images 2–9: load for BOTH edit and duplicate (removed isDuplicateMode exclusion)
		loadImg('vehicle_image_2', '2');
		loadImg('vehicle_image_3', '3');
		loadImg('vehicle_image_4', '4');
		loadImg('vehicle_image_5', '5');
		loadImg('vehicle_image_6', '6');
		loadImg('vehicle_image_7', '7');
		loadImg('vehicle_image_8', '8');
		loadImg('vehicle_image_9', '9');

		// Official permit images — load for both modes if present
		if (data.rear_plate_image?.image) {
			this.rearPlateImage = data.rear_plate_image.image;
			this.rearPlateId = data.rear_plate_image.ID;
			this.addVehicleForm.patchValue({ rearPlateImage: this.rearPlateId });
		}
		if (data.window_permitImage?.image) {
			this.windowPermitImage = data.window_permitImage.image;
			this.windowPermitId = data.window_permitImage.ID;
			this.addVehicleForm.patchValue({ windowPermitImage: this.windowPermitId });
		}
		if (data.window_permitImage2?.image) {
			this.windowPermit2Image = data.window_permitImage2.image;
			this.windowPermit2Id = data.window_permitImage2.ID;
			this.addVehicleForm.patchValue({ windowPermit2Image: this.windowPermit2Id });
		}
		if (data.usdot_permitImage?.image) {
			this.usdotPermitImage = data.usdot_permitImage.image;
			this.usdotPermitId = data.usdot_permitImage.ID;
			this.addVehicleForm.patchValue({ usdotPermitImage: this.usdotPermitId });
		}
		if (data.mc_image?.image) {
			this.mcImage = data.mc_image.image;
			this.mcId = data.mc_image.ID;
			this.addVehicleForm.patchValue({ mcImage: this.mcId });
		}

		this.chargableAmenities = data.chargableAmenities;
		this.nonChargableAmenities = data.nonChargableAmenities;

		// Models for selected make
		let models = JSON.parse(sessionStorage.getItem('models'));
		this.filteredModel = this.model = models.filter(m => m.make_id == data.make);

		this.addVehicleForm.patchValue({
			vehicleType: parseInt(data.vehicle_type),
			make: data.make,
			model: data.model,
			year: data.year,
			color: data.color,
			numberOfVehicles: data.numberOfVehicles,
			licensePlate: data.license_plate,
			seats: data.seats,
			luggage: data.luggage,
			charterCancelPolicy: data.charterCancelPolicy,
			nonCharterCancelPolicy: data.nonCharterCancelPolicy,
			associatedDriver: (data.associatedDriver !== undefined && data.associatedDriver !== null) ? Number(data.associatedDriver) : (data.driver ? Number(data.driver) : null),
		});

		// Only set id for edit, not duplicate
		if (this.isEditMode) {
			this.addVehicleForm.patchValue({ id: this.vehicleId });
			this.originalNumberOfVehicles = data.numberOfVehicles || 0;
		}

		// Autocomplete display fields
		const vehicleTypeField: any = document.getElementById('vehicleTypeField');
		if (vehicleTypeField) vehicleTypeField.value = data.vehicle_typeName || '';
		const makeField: any = document.getElementById('makeField');
		if (makeField) makeField.value = data.makeName || '';
		const modelField: any = document.getElementById('modelField');
		if (modelField) modelField.value = data.modelName || '';
		const yearField: any = document.getElementById('yearField');
		if (yearField) yearField.value = data.yearName || '';
		const colorField: any = document.getElementById('colorField');
		if (colorField) colorField.value = data.colorName || '';

		this.pushValuesTypeOfService(data.typeOfService || []);

		this.chargableAmenities = data.chargableAmenities;
		this.nonChargableAmenities = data.nonChargableAmenities;
		this.initializeSelectedAmenities();
		this.initializeSelectedSpecialAmenities(data.specialAmenities || []);
		this.initializeSelectedInteriors(data.vehicleInterior || []);

		this.stateManagementService.getNumberOfVehicles().subscribe(numberOfVehicles => {
			let numberOfVehiclesCanBeAdded;
			if (this.affiliateType == 'fleet_operator') {
			this.addVehicleForm.controls['numberOfVehicles'].setValidators([Validators.required, Validators.pattern("^[0-9]*$")]);
			} else if (this.affiliateType == 'black_limo_operator') {
			const subtract = this.isEditMode ? data.numberOfVehicles : 0;
			numberOfVehiclesCanBeAdded = 2 - (numberOfVehicles - subtract);
			this.addVehicleForm.controls['numberOfVehicles'].setValidators([Validators.required, Validators.pattern("^[0-9]*$"), Validators.min(1), Validators.max(numberOfVehiclesCanBeAdded)]);
			} else {
			const subtract = this.isEditMode ? data.numberOfVehicles : 0;
			numberOfVehiclesCanBeAdded = 1 - (numberOfVehicles - subtract);
			this.addVehicleForm.controls['numberOfVehicles'].setValidators([Validators.required, Validators.pattern("^[0-9]*$"), Validators.min(1), Validators.max(numberOfVehiclesCanBeAdded)]);
			}
			this.addVehicleForm.controls['numberOfVehicles'].updateValueAndValidity();
		});

		this.spinner.hide();
		});
    }

	loadDriver() {
		this.adminService.driverList(this.affiliateId).then(result => {
			this.driverRes = result;
			this.driverList = this.driverRes.data.data;
		}).catch(err => {
			console.error(err);
		});
    }

	openGuide(slotKey: string) {
		this.currentGuide = PHOTO_GUIDES[slotKey] ?? null;
		this.pendingSlot = slotKey;
		this.isGuideVisible = true;
	}

	onGuideConfirmed() {
		this.isGuideVisible = false;
		this.sharedFileInput.nativeElement.click();
	}

	onGuideDismissed() {
		this.isGuideVisible = false;
	}

	handleSharedFileChange(event: Event) {
		const vehicleSlots = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
		const slot = this.pendingSlot;
		if (vehicleSlots.includes(slot)) {
			const imageId = (this as any)['vehicleImageId' + slot];
			this.onFileChange(event, imageId, slot);
		} else {
			const idMap: Record<string, string> = {
				rearPlate: this.rearPlateId,
				windowPermit: this.windowPermitId,
				windowPermit2: this.windowPermit2Id,
				usdotPermit: this.usdotPermitId,
				mc: this.mcId,
			};
			this.vehicleOfficialImagesChange(event, slot, idMap[slot]);
		}
	}

	closeButton() {
		this.closeTab.emit();
	}
	
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
	handleChangeVehicleType(value) {
		console.log('Selected Value:', value);

		this.isVehicleTypeSelected = value ? true : false
	}

	searchVehicleType(keyword) {
		this.addVehicleForm.patchValue({
			vehicleType: '',
		});
		if (keyword == '') {
			this.filteredVehicleTypes = this.vehicleTypes;
		}
		else {
			this.filteredVehicleTypes = this.vehicleTypes.filter((vehicle_Type: any) => {
				if (vehicle_Type.name.toLowerCase() === keyword.toLowerCase()) {
					this.addVehicleForm.patchValue({
						vehicleType: vehicle_Type.ID,
					});
				}
				return vehicle_Type.name.toLowerCase().includes(keyword.toLowerCase());
			})
				.sort((a: any, b: any) => {
					return this.searchSorting(keyword, a, b)
				});
		}
	}

	selectVehicleType(val, isSelected) {
		if (isSelected)// ignore on deselection of the previous option 
		{
			this.addVehicleForm.patchValue({
				vehicleType: val,
			});
		}
	}

	searchMake(keyword) {
		this.addVehicleForm.patchValue({
			make: '',
		});
		if (keyword == '') {
			this.filteredMake = this.make;
		}
		else {
			this.filteredMake = this.make.filter((mk: any) => {
				if (mk.name.toLowerCase() === keyword.toLowerCase()) {
					this.addVehicleForm.patchValue({
						make: mk.ID,
					});
				}
				return mk.name.toLowerCase().includes(keyword.toLowerCase());
			})
				.sort((a: any, b: any) => {
					return this.searchSorting(keyword, a, b)
				});
		}
	}
	selectMake(val, isSelected) {
		console.log('make select is clicked-->>>', val)
		if (isSelected)// ignore on deselection of the previous option
		{
			this.addVehicleForm.patchValue({
				make: val,
			});
			let modelField: any = document.getElementById('modelField');
			modelField.value = '';
			// setTimeout(() => {
			// 	this.changeMake(val);
			// }, 200)
		}
	}
	Subscriptions() {
		this.addVehicleForm.get('make')?.valueChanges.subscribe((value: string) => {
			console.log('change value is--->>', value)
			// let models = this.allModels
			// this.filteredModel = this.model = models.filter(function (model) {
			// 	if (model.make_id == value) {
			// 		return true;
			// 	}
			// });
			this.changeMake(value);
			let modelField: any = document.getElementById('modelField');
			modelField.value = '';
		})

		// this.addVehicleForm.get('make').valueChanges.subscribe((value: string) => {
		// 	console.log('in function change make-->',value )
		// 	// let models = this.allModels
		// 	// this.filteredModel = this.model = models.filter(function (model) {
		// 	// 	if (model.make_id == value) {
		// 	// 		return true;
		// 	// 	}
		// 	// });
		// })
	}

	searchModel(keyword) {
		this.addVehicleForm.patchValue({
			model: '',
		});
		if (keyword.length) {
			this.filteredModel = this.model.filter((mdl: any) => {
				if (mdl.name.toLowerCase() === keyword.toLowerCase()) {
					this.addVehicleForm.patchValue({
						model: mdl.ID,
					});
				}
				return mdl.name.toLowerCase().includes(keyword.toLowerCase());
			})
				.sort((a: any, b: any) => {
					return this.searchSorting(keyword, a, b)
				});
		}
		else {
			this.filteredModel = this.model;
		}
	}
	selectModel(val, isSelected) {
		if (isSelected)// ignore on deselection of the previous option
		{
			this.addVehicleForm.patchValue({
				model: val,
			});
		}
	}

	searchYear(keyword) {
		this.addVehicleForm.patchValue({
			year: '',
		});
		if (keyword == '') {
			this.filteredYear = this.year;
		}
		else {
			this.filteredYear = this.year.filter((yr: any) => {
				if (yr.name.toLowerCase() === keyword.toLowerCase()) {
					this.addVehicleForm.patchValue({
						year: yr.ID,
					});
				}
				return yr.name.toLowerCase().includes(keyword.toLowerCase());
			})
				.sort((a: any, b: any) => {
					return this.searchSorting(keyword, a, b)
				});
		}
	}
	selectYear(val, isSelected) {
		if (isSelected)// ignore on deselection of the previous option
		{
			this.addVehicleForm.patchValue({
				year: val,
			});
		}
	}

	searchColor(keyword) {
		this.addVehicleForm.patchValue({
			color: '',
		});
		if (keyword == '') {
			this.filteredColor = this.color;
		}
		else {
			this.filteredColor = this.color.filter((cl: any) => {
				if (cl.name.toLowerCase() === keyword.toLowerCase()) {
					this.addVehicleForm.patchValue({
						color: cl.ID,
					});
				}
				return cl.name.toLowerCase().includes(keyword.toLowerCase());
			})
				.sort((a: any, b: any) => {
					return this.searchSorting(keyword, a, b)
				});
		}
	}
	selectColor(val, isSelected) {
		if (isSelected)// ignore on deselection of the previous option
		{
			this.addVehicleForm.patchValue({
				color: val,
			});
		}
	}
	//End of autocomplete search and selection
	// typeOfService(type) {
	// 	this.serviceType = type;
	// }

	get typeOfService(): FormArray {
		return this.addVehicleForm.get('typeOfService') as FormArray;
	}


	pushValuesTypeOfService(value: Array<any>) {
		this.typeOfService.clear()
		this.service = this.addVehicleForm.get('typeOfService').value
		value.forEach((item: string) => {
			!this.service.includes(item) && this.service.push(item)
			this.typeOfService.push(this.formBuilder.control(item))
		})
	}

	onAmenitiesCheckboxChange(encodedId: string, ischecked: boolean, numericId: number, type = 'chargable') {
		const amenities: FormArray = this.addVehicleForm.get('amenities') as FormArray;

		if (ischecked) {
			const exists = amenities.controls.findIndex(x => x.value === encodedId) !== -1;
			if (!exists) amenities.push(new FormControl(encodedId));
			if (type === 'chargable') this.selectedChargableAmenities.add(numericId);
			else this.selectedNonChargableAmenities.add(numericId);
		} else {
			const index = amenities.controls.findIndex(x => x.value === encodedId);
			if (index !== -1) amenities.removeAt(index);
			if (type === 'chargable') this.selectedChargableAmenities.delete(numericId);
			else this.selectedNonChargableAmenities.delete(numericId);
		}
	}

	onSpecialAmenitiesCheckboxChange(e) {
		const specialAmenities: FormArray = this.addVehicleForm.get('specialAmenities') as FormArray;
		const value = Number(e.target.value);
		if (e.target.checked) {
			specialAmenities.push(new FormControl(value));
			this.selectedSpecialAmenities.add(value);
		} else {
			const index = specialAmenities.controls.findIndex(x => x.value === value);
			specialAmenities.removeAt(index);
			this.selectedSpecialAmenities.delete(value);
		}
	}

	onInteriorsCheckboxChange(e) {
		const vehicleInterior: FormArray = this.addVehicleForm.get('vehicleInterior') as FormArray;
		const value = Number(e.target.value);
		if (e.target.checked) {
			vehicleInterior.push(new FormControl(value));
			this.selectedInteriors.add(value);
		} else {
			const index = vehicleInterior.controls.findIndex(x => x.value === value);
			if (index !== -1) vehicleInterior.removeAt(index);
			this.selectedInteriors.delete(value);
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
			isNaN(parseInt(key)) ? this.vehicleOfficialImagesChange1(dataUrl, key, id) : this.onFileChange1(dataUrl, key, id);
		};
	}
	async onFileChange1(dataUrl, imageNumber, imageId) {
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
			.subscribe(result => {
				this.response = result;
				this.addVehicleForm.patchValue({
					["vehicle_image_" + imageNumber]: this.response.data.id,
				});
				this["vehicleImage" + imageNumber] = this.response.data.image;

				this.stateManagementService.setprogressBar(false);
			});
	}
	async vehicleOfficialImagesChange1(url, imageType, imageId) {
		if (!await this.commonServices.handleFile(event)) {
			return;
		}
		this.stateManagementService.setprogressBar(true);
		this.imageSrc = url;
		this.adminService.uploadVehicleImage(this.imageSrc)
			.pipe(
				catchError(err => {
					this.stateManagementService.setprogressBar(false);
					return throwError(err);
				})
			)
			.subscribe(result => {
				this.response = result;

				switch (imageType) {
					case 'rearPlate': {
						this.addVehicleForm.patchValue({
							rearPlateImage: this.response.data.id,
						});
						// this.rearPlateUploaded=true;
						this.rearPlateImage = this.response.data.image;
						// this.deleteImage(imageId,'rearPlate');//delete previous image
						break;
					}
					case 'windowPermit': {
						this.addVehicleForm.patchValue({
							windowPermitImage: this.response.data.id,
						});
						// this.windowPermitUploaded=true;
						this.windowPermitImage = this.response.data.image;
						// this.deleteImage(imageId,'windowPermit');//delete previous image
						break;
					}
					case 'windowPermit2': {
						this.addVehicleForm.patchValue({
							windowPermit2Image: this.response.data.id,
						});
						// this.windowPermit2Uploaded=true;
						this.windowPermit2Image = this.response.data.image;
						// this.deleteImage(imageId,'windowPermit2');//delete previous image
						break;
					}
					case 'usdotPermit': {
						this.addVehicleForm.patchValue({
							usdotPermitImage: this.response.data.id,
						});
						// this.usdotPermitUploaded=true;
						this.usdotPermitImage = this.response.data.image;
						// this.deleteImage(imageId,'usdotPermit');//delete previous image
						break;
					}
					case 'mc': {
						// this.deleteImage(imageId,'mc');//delete previous image
						this.addVehicleForm.patchValue({
							mcImage: this.response.data.id,
						});
						// this.mcUploaded=true;
						this.mcImage = this.response.data.image;
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
			if (event.target) event.target.value = '';
			return;
		}
		// this.stateManagementService.setprogressBar(true);
		const reader = new FileReader();
		if (event.target.files && event.target.files.length) {
			const [file] = event.target.files;
			event.target.value = '';
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
					.subscribe(result => {
						this.response = result;

						switch (imageType) {
							case 'rearPlate': {
								this.addVehicleForm.patchValue({ rearPlateImage: this.response.data.id });
								this.rearPlateImage = this.response.data.image;
								this.rearPlateId = this.response.data.id;
								break;
							}
							case 'windowPermit': {
								this.addVehicleForm.patchValue({ windowPermitImage: this.response.data.id });
								this.windowPermitImage = this.response.data.image;
								this.windowPermitId = this.response.data.id;
								break;
							}
							case 'windowPermit2': {
								this.addVehicleForm.patchValue({ windowPermit2Image: this.response.data.id });
								this.windowPermit2Image = this.response.data.image;
								this.windowPermit2Id = this.response.data.id;
								break;
							}
							case 'usdotPermit': {
								this.addVehicleForm.patchValue({ usdotPermitImage: this.response.data.id });
								this.usdotPermitImage = this.response.data.image;
								this.usdotPermitId = this.response.data.id;
								break;
							}
							case 'mc': {
								this.addVehicleForm.patchValue({ mcImage: this.response.data.id });
								this.mcImage = this.response.data.image;
								this.mcId = this.response.data.id;
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

	async onFileChange(event, imageId, imageNumber) {
		if (!await this.commonServices.handleFile(event)) {
			if (event.target) event.target.value = '';
			return;
		}
		this.stateManagementService.setprogressBar(true);
		const reader = new FileReader();
		if (event.target.files && event.target.files.length) {
			const [file] = event.target.files;
			event.target.value = '';
			reader.readAsDataURL(file);
			reader.onload = () => {
				this.imageSrc = reader.result as string;
				this.adminService.uploadVehicleImage(this.imageSrc)
					.pipe(
						catchError(err => {
							this.stateManagementService.setprogressBar(false);
							return throwError(err);
						})
					)
					.subscribe(result => {
						this.response = result;
						this.addVehicleForm.patchValue({
							["vehicle_image_" + imageNumber]: this.response.data.id,
						});
						this["vehicleImage" + imageNumber] = this.response.data.image;
						(this as any)["vehicleImageId" + imageNumber] = this.response.data.id;

						this.stateManagementService.setprogressBar(false);
					});
			};
		}
	}

	showImageInModal(imageUrl) {
		this.modalImage = imageUrl;
		$("#imageModal").addClass("showImage");
		$("#imageModal").removeClass("d-none");
	}

	deleteImage(id, imageType, imageNumber = null) {
		switch (imageType) {
			case 'rearPlate': {
				this.addVehicleForm.patchValue({
					rearPlateImage: '',
				});
				this.rearPlateImage = '';
				break;
			}
			case 'windowPermit': {
				this.addVehicleForm.patchValue({
					windowPermitImage: '',
				});
				this.windowPermitImage = '';
				break;
			}
			case 'windowPermit2': {
				this.addVehicleForm.patchValue({
					windowPermit2Image: '',
				});
				this.windowPermit2Image = '';
				break;
			}
			case 'usdotPermit': {
				this.addVehicleForm.patchValue({
					usdotPermitImage: '',
				});
				this.usdotPermitImage = '';
				break;
			}
			case 'mc': {
				this.addVehicleForm.patchValue({
					mcImage: '',
				});
				this.mcImage = '';
				break;
			}
			case 'vehicleImage': {
				this.addVehicleForm.patchValue({
					["vehicle_image_" + imageNumber]: '',
				});
				this["vehicleImage" + imageNumber] = '';
				break;
			}
			default: {
				break;
			}
		}
	}


	get f() {
		return this.addVehicleForm.controls;
	}

	
	submitForm() {
		this.addVehicleForm.patchValue({ acc_id: this.affiliateId, associatedDriver: this.addVehicleForm.value.associatedDriver 
            ? Number(this.addVehicleForm.value.associatedDriver) 
            : null
		 });
		this.pushValuesTypeOfService(this.service);
		this.submittedForm = true;

		if (this.addVehicleForm.invalid || !this.vehicleImage1) {
			if (!this.vehicleImage1) {
				setTimeout(() => {
					document.getElementById('primaryAngleSection')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
				}, 50);
			}
			return;
		}
		
		this.spinner.show();
		this.disableSubmitButton = true;
		
		if (this.isDuplicateMode) {
			this.adminService.adminAffiliateSubmitVehicle(this.addVehicleForm.value)
			.pipe(catchError(err => { this.spinner.hide(); this.disableSubmitButton = false; return throwError(err); }))
			.subscribe(result => {
				this.response = result;
				this.spinner.hide();
				this.disableSubmitButton = true;
				this.stateManagementService.addNumberOfVehicles(this.addVehicleForm.value.numberOfVehicles);
				this.router.navigate(['admin/affiliate/step5/add-vehicle-rates'], {
				queryParams: { vehicleId: this.response.data.id, relativeVehicleId: this.vehicleId }
				});
			});
		} else if (this.isEditMode) {
			this.adminService.adminAffiliateEditVehicle(this.addVehicleForm.value)
			.pipe(catchError(err => { this.spinner.hide(); this.disableSubmitButton = false; return throwError(err); }))
			.subscribe(result => {
				this.response = result;
				this.spinner.hide();
				this.disableSubmitButton = true;
				this.stateManagementService.addNumberOfVehicles(
				this.addVehicleForm.value.numberOfVehicles - this.originalNumberOfVehicles
				);
				this.router.navigate(['/admin/affiliate/step5']);
			});
		} else {
			this.adminService.adminAffiliateSubmitVehicle(this.addVehicleForm.value)
			.pipe(catchError(err => { this.spinner.hide(); this.disableSubmitButton = false; return throwError(err); }))
			.subscribe(result => {
				this.response = result;
				this.spinner.hide();
				this.disableSubmitButton = true;
				this.stateManagementService.addNumberOfVehicles(this.addVehicleForm.value.numberOfVehicles);
				this.router.navigate(['admin/affiliate/step5/add-vehicle-rates'], {
				queryParams: { vehicleId: this.response.data.id }
				});
			});
		}
	}

	backButton() {
		this.router.navigate(['/admin/affiliate/step5']);
	}

	resetForm() {
		this.submittedForm = true;
		this.addVehicleForm.reset();
		this.vehicleImageArray = [];

		let vehicleTypeField: any = document.getElementById('vehicleTypeField');
		vehicleTypeField.value = "";
		let colorField: any = document.getElementById('colorField');
		colorField.value = "";
		let makeField: any = document.getElementById('makeField');
		makeField.value = "";
		let modelField: any = document.getElementById('modelField');
		modelField.value = "";
		let yearField: any = document.getElementById('yearField');
		yearField.value = "";
		this.vehicleImage1 = this.oldvehicleImage[0];
		this.vehicleImage2 = this.oldvehicleImage[1];
		this.vehicleImage3 = this.oldvehicleImage[2];
		this.vehicleImage4 = this.oldvehicleImage[3];
		this.vehicleImage5 = this.oldvehicleImage[4];
		this.vehicleImage6 = this.oldvehicleImage[5];
		this.vehicleImage7 = this.oldvehicleImage[6];
		this.vehicleImage8 = this.oldvehicleImage[7];
		this.vehicleImage9 = this.oldvehicleImage[8];
		this.rearPlateImage = this.oldvehicleImage[9];
		this.windowPermitImage = this.oldvehicleImage[10];
		this.windowPermit2Image = this.oldvehicleImage[11];
		this.usdotPermitImage = this.oldvehicleImage[12];
		this.mcImage = this.oldvehicleImage[13];
	}

	changeMake(selectedMake) {
		console.log('selectedMake-->>>>', selectedMake)
		if (!selectedMake) {
			this.addVehicleForm.patchValue({
				model: ''
			})
			this.filteredModel = []
			return false
		}

		let models = JSON.parse(sessionStorage.getItem('models'));
		this.filteredModel = models.filter(function (model) {
			if (model.make_id == selectedMake) {
				return true;
			}
		});
		this.addVehicleForm.patchValue({
			model: this.filteredModel[0]?.ID
		})
	}
	service: Array<any> = []
	onServiceChange(value: string) {
		console.log(value)
		const index = this.service.indexOf(value);
		if (index === -1) {
			// If the service type is not selected, add it to the array
			this.service.push(value);
		} else {
			// If the service type is already selected, remove it from the array
			this.service.splice(index, 1);
		}
		// if (this.service.includes(value)) {
		// 	// a never reaching code line
		// 	this.service = this.service.filter(val => val != value)
		// } else {
		// 	this.service = []
		// 	this.service.push(value)
		// }

		// // as per new update from client: he wants to make the whole thing work as a radio button
		// return
		// if (!is_service_valid(value, this.service)) {
		// 	this.errorModal.openDialog({
		// 		errors: {
		// 			error: 'Cannot choose Local and Over The Road service at the same time'
		// 		}
		// 	})
		// 	this.service = this.service.filter(val => val != value)
		// 	return
		// }
		// console.log('Inital Array: ', this.service)

		// /**
		//  * The Array Validation Check function
		//  * - make sure the array doesn't containe 'local' and 'over_the_road' values at a time.
		//  * 
		//  * @param value: String [Required] value to check
		//  */
		// function is_service_valid(value: string, service: Array<any>) {
		// 	if (value == 'local' && service.includes('over_the_road')) {
		// 		return false
		// 	} else if (value == 'over_the_road' && service.includes('local')) {
		// 		return false
		// 	}
		// 	else {
		// 		return true
		// 	}
		// }
	}

	handleNonCharterCancelPolicy(event) {
		console.log('in function handleNonCharterCancelPolicy--->>', event)
		this.addVehicleForm.patchValue({
			charterCancelPolicy: event.value
		})
	}

	isChargableAmenitySelected(id: number): boolean {
	 return this.selectedChargableAmenities.has(Number(id));
	}

	isNonChargableAmenitySelected(id: number): boolean {
	 return this.selectedNonChargableAmenities.has(Number(id));
	}

	isSpecialAmenitySelected(id: number): boolean {
	 return this.selectedSpecialAmenities.has(Number(id));
	}

	isInteriorSelected(id: number): boolean {
	 return this.selectedInteriors.has(Number(id));
	}

	private initializeSelectedAmenities() {
		this.selectedChargableAmenities.clear();
		this.selectedNonChargableAmenities.clear();
		const amenities: FormArray = this.addVehicleForm.get('amenities') as FormArray;
		while (amenities.length) amenities.removeAt(0);

		Object.values(this.chargableAmenities || {}).forEach((group: any) => {
			Object.values(group).forEach((amenity: any) => {
			if (amenity.isSelected) {
				this.onAmenitiesCheckboxChange(amenity.id, true, amenity.ID, 'chargable');
			}
			});
		});
		Object.values(this.nonChargableAmenities || {}).forEach((group: any) => {
			(Array.isArray(group) ? group : Object.values(group)).forEach((amenity: any) => {
			if (amenity.isSelected) {
				this.onAmenitiesCheckboxChange(amenity.id, true, amenity.ID, 'nonChargable');
			}
			});
		});
	}

	private initializeSelectedSpecialAmenities(selected: any[]) {
		const specialAmenities: FormArray = this.addVehicleForm.get('specialAmenities') as FormArray;
		while (specialAmenities.length) specialAmenities.removeAt(0);
		this.selectedSpecialAmenities.clear();
		(selected || []).forEach((id: any) => {
			const value = Number(id);
			specialAmenities.push(new FormControl(value));
			this.selectedSpecialAmenities.add(value);
		});
	}

	private initializeSelectedInteriors(selected: any[]) {
		const vehicleInterior: FormArray = this.addVehicleForm.get('vehicleInterior') as FormArray;
		while (vehicleInterior.length) vehicleInterior.removeAt(0);
		this.selectedInteriors.clear();
		(selected || []).forEach((id: any) => {
			const value = Number(id);
			vehicleInterior.push(new FormControl(value));
			this.selectedInteriors.add(value);
		});
	}
}
