import { Component, OnInit } from '@angular/core';
import { AdminService } from '../../../services/admin.service';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { NgxSpinnerService } from "ngx-spinner";
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { ThemePalette } from '@angular/material/core';
import { CommonService } from '../../../services/common.service';
declare var $: any;


@Component({
	selector: 'app-master-vehicle-types',
	templateUrl: './master-vehicle-types.component.html',
	styleUrls: ['./master-vehicle-types.component.scss']
})
export class MasterVehicleTypesComponent implements OnInit {

	vehicles: any[] = [];
	allVehicles: any[] = [];
	vehiclesRes: any;

	// Vehicle types available to link the currently edited vehicle type to (excludes itself)
	linkedCatOptions: any[] = [];

	public addVehicleTypeForm: FormGroup;
	public editVehicleTypeForm: FormGroup;

	public galleryImagesArr: string[] = [];
	public galleryImagesArrEdit: string[] = [];
	public homepageImageSrc: string = '';
	public homepageImageSrcEdit: string = '';

	public submitted = false;
	public submittedEditForm = false;
	public file: any;
	public response: any;
	public imageSrc: string;
	public disableAddButton: boolean = false;
	public disableEditButton: boolean = false;
	public showProgressBar: boolean = false;
	public showProgressBarEdit: boolean = false;
	public editVehiclePic: string;
	vehicleId: any;
	currentUser: any;
	color: ThemePalette = 'accent';
	disabled = false;
	convertCurrenyResp: any
	searchTerm: string = '';

	constructor(
		private adminService: AdminService,
		private router: Router,
		private spinner: NgxSpinnerService,
		private formBuilder: FormBuilder,
		private commonServices: CommonService) { }

	ngOnInit(): void {

		// this.drop;
		/** spinner starts on init */
		this.spinner.show();

		// Load Our vehicles using API
		this.adminService.getOurVehicles().then(result => {
			this.vehiclesRes = result;
			this.allVehicles = Array.isArray(this.vehiclesRes.data) ? [...this.vehiclesRes.data] : [];
			this.vehicles = [...this.allVehicles];
			sessionStorage.setItem('vehiclesTypes', JSON.stringify(this.allVehicles));
			this.spinner.hide();//hide spinner
		})
			.catch(err => {
				this.spinner.hide();//hide spinner
			});

		this.currentUser = JSON.parse(localStorage.getItem("currentUser") || '{}');

		this.convertCurrenyResp = this.currentUser.convert_currency == 0 ? false : true

		//add vehicle type form validation
		this.addVehicleTypeForm = this.formBuilder.group({
			vehicleType: ['', Validators.required],
			vehicleImage: [''],
			vehicleImageInput: [''],
			vehicle_homepage_img: ['', Validators.required],
			vehicleHomepageImageInput: [''],
			gallery_images: [[]],
			galleryImagesInput: [''],
			tagline: [''],
			badge_text: [''],
			features: [''],
			descriptions: [''],
			status: ['enable'],
			sort_order: [1],
			seats: [1, Validators.required],
			luggage: [0, Validators.required]
		});

		// edit vehicle type form validation
		this.editVehicleTypeForm = this.formBuilder.group({
			vehicleId: ['', Validators.required],
			vehicleType: ['', Validators.required],
			vehicleImageInput: '',
			vehicleImage: '',
			vehicle_homepage_img: [''],
			vehicleHomepageImageInput: [''],
			gallery_images: [[]],
			galleryImagesInput: [''],
			tagline: [''],
			badge_text: [''],
			features: [''],
			descriptions: [''],
			linked_cat: [''],
			status: ['enable'],
			sort_order: [1],
			seats: [1, Validators.required],
			luggage: [0, Validators.required]
		});
	}

	enableDisableClicked(event) {
		this.spinner.show();//show spinner
		console.log(event.checked);
		if (event.checked) {
			var status = 1;
		}
		else {
			var status = 0;
		}
		this.adminService.converCurrenyEnableDisable(status)
			.pipe(
				catchError(err => {
					this.spinner.hide();//hide spinner
					return throwError(err);
				})
			).subscribe((result: any) => {
				this.spinner.hide(); // Hide spinner when successful
				this.convertCurrenyResp = result.data.convert_currency == 0 ? false : true
				this.currentUser.convert_currency = result.data.convert_currency;
				localStorage.setItem("currentUser", JSON.stringify(this.currentUser));

			});

	}

	vehicleStatusToggled(vehicle: any, event) {
		const previousStatus = vehicle.status || 'enable';
		const newStatus = event.checked ? 'enable' : 'disable';
		vehicle.status = newStatus;
		vehicle.statusUpdating = true;
		this.spinner.show();

		const revert = (err) => {
			vehicle.status = previousStatus;
			event.source.checked = previousStatus == 'enable';
			vehicle.statusUpdating = false;
			this.spinner.hide();
			return throwError(err);
		};

		// edit-vehicle-types expects the full record, so load it and resend with only the status changed
		this.adminService.getVehicleType(vehicle.id || vehicle.ID)
			.pipe(catchError(revert))
			.subscribe((result: any) => {
				const data = result.data;
				const payload = {
					vehicleId: data.id,
					vehicleType: data.vehicle_cat_name,
					vehicleImage: '',
					vehicle_homepage_img: data.vehicle_homepage_img || '',
					gallery_images: data.gallery_images || [],
					tagline: data.tagline || '',
					badge_text: data.badge_text || '',
					features: data.features || [],
					descriptions: data.descriptions || '',
					linked_cat: data.linked_cat || '',
					status: newStatus,
					sort_order: data.sort_order !== undefined && data.sort_order !== null ? data.sort_order : 1,
					seats: data.seats,
					luggage: data.luggage
				};

				this.adminService.updateVehicleType(payload)
					.pipe(catchError(revert))
					.subscribe(() => {
						vehicle.statusUpdating = false;
						sessionStorage.setItem('vehiclesTypes', JSON.stringify(this.allVehicles));
						this.spinner.hide();
					});
			});
	}

	drop(event: CdkDragDrop<any[]>) {
		if (event.previousIndex === event.currentIndex) {
			return;
		}

		const previousVehicles = [...this.vehicles];
		const previousAllVehicles = [...this.allVehicles];

		moveItemInArray(this.vehicles, event.previousIndex, event.currentIndex);
		this.syncAllVehiclesAfterVisibleReorder();
		this.applySequentialSortOrders();
		sessionStorage.setItem('vehiclesTypes', JSON.stringify(this.allVehicles));

		this.spinner.show();

			const payload = {
				sort_orders: this.allVehicles.map((vehicle: any, index: number) => ({
					id: vehicle.ID || vehicle.id,
					sort_order: index + 1
				}))
			};

		this.adminService.updateVehicleSortOrders(payload).pipe(
			catchError(err => {
				this.vehicles = previousVehicles;
				this.allVehicles = previousAllVehicles;
				this.applySequentialSortOrders();
				this.refreshVehicleCollections();
				sessionStorage.setItem('vehiclesTypes', JSON.stringify(this.allVehicles));
				this.spinner.hide();//hide spinner
				return throwError(err);
			})
		).subscribe(() => {
			this.refreshVehicleCollections();
			sessionStorage.setItem('vehiclesTypes', JSON.stringify(this.allVehicles));
			this.spinner.hide();//hide spinner
		});
	}
	serach(val) {
		this.searchTerm = (val || '').toLowerCase().trim();
		let searchVehicles = this.allVehicles.filter((vehicleType) => {
			if ((vehicleType.vehicle_name || '').toLowerCase().search(this.searchTerm) != -1) {
				return true;
			}
		});
		this.vehicles = this.searchTerm ? searchVehicles : [...this.allVehicles];
	}

	private syncAllVehiclesAfterVisibleReorder() {
		if (!this.searchTerm) {
			this.allVehicles = [...this.vehicles];
			return;
		}

		const reorderedVisibleVehicles = [...this.vehicles];
		const reorderedVisibleVehicleIds = new Set(
			reorderedVisibleVehicles.map((vehicle: any) => String(vehicle.id || vehicle.ID))
		);
		let visibleVehicleIndex = 0;

		this.allVehicles = this.allVehicles.map((vehicle: any) => {
			const vehicleId = String(vehicle.id || vehicle.ID);
			if (!reorderedVisibleVehicleIds.has(vehicleId)) {
				return vehicle;
			}

			const reorderedVehicle = reorderedVisibleVehicles[visibleVehicleIndex];
			visibleVehicleIndex += 1;
			return reorderedVehicle;
		});
	}

	private refreshVehicleCollections() {
		this.vehicles = this.searchTerm
			? this.allVehicles.filter((vehicle: any) =>
				(vehicle.vehicle_name || '').toLowerCase().includes(this.searchTerm))
			: [...this.allVehicles];
	}

	private applySequentialSortOrders() {
		this.allVehicles = this.allVehicles.map((vehicle: any, index: number) => ({
			...vehicle,
			sort_order: index + 1
		}));
	}

	get f() {
		return this.addVehicleTypeForm.controls;
	}

	private uploadSingleImageForVehicleTypes(file: File, onSuccess: (response: any) => void) {
		const formData = new FormData();
		formData.append('image', file, file.name);

		this.adminService.uploadVehicleImageBinary(formData)
			.pipe(
				catchError(err => {
					this.spinner.hide();
					return throwError(err);
				})
			)
			.subscribe((response: any) => {
				onSuccess(response);
				this.spinner.hide();
			});
	}

	// async onFileChange(event) {
	// 	if (!await this.commonServices.handleFile(event)) {
	// 		return;
	// 	}

	// 	const reader = new FileReader();

	// 	if (event.target.files && event.target.files.length) {
	// 		const [file] = event.target.files;
	// 		reader.readAsDataURL(file);

	// 		reader.onload = () => {
	// 			this.imageSrc = reader.result as string;
	// 			this.spinner.show();

	// 			this.adminService.uploadVehicleImage(this.imageSrc)
	// 				.pipe(
	// 					catchError(err => {
	// 						this.spinner.hide();
	// 						return throwError(err);
	// 					})
	// 				)
	// 				.subscribe((response: any) => {
	// 					this.addVehicleTypeForm.patchValue({
	// 						vehicleImage: response.data.id
	// 					});
	// 					this.spinner.hide();
	// 				});
	// 		};
	// 	}
	// }

	async onHomepageImgChange(event) {
		if (!await this.commonServices.handleFile(event)) {
			return;
		}

		const reader = new FileReader();
		if (event.target.files && event.target.files.length) {
			const [file] = event.target.files;
			reader.readAsDataURL(file);

			reader.onload = () => {
				this.homepageImageSrc = reader.result as string;
				this.spinner.show();

				this.uploadSingleImageForVehicleTypes(file, (response: any) => {
					this.addVehicleTypeForm.patchValue({
						vehicle_homepage_img: response.data.image,
						vehicleImage: response.data.image,
					});
				});
			};
		}
	}

	async onGalleryChange(event) {
		if (event.target.files && event.target.files.length) {
			this.spinner.show();
			const files = Array.from(event.target.files);

			try {
				const formData = new FormData();
				files.forEach((file: any) => {
					formData.append('images[]', file, file.name);
				});

				this.adminService.uploadMultipleImages(formData)
					.subscribe((response: any) => {
						let ids = [];
						if (Array.isArray(response.data)) {
							ids = response.data.map((item: any) => item.imagepath ? item.imagepath : item?.imagepath);
						} else if (response.data && response.data.imagepath) {
							ids = [response.data.imagepath];
						} else if (Array.isArray(response)) {
							ids = response.map((item: any) => item.imagepath ? item.imagepath : item?.imagepath);
						}

						this.galleryImagesArr.push(...ids);
						this.addVehicleTypeForm.patchValue({ gallery_images: this.galleryImagesArr });
						this.spinner.hide();
					}, err => {
						this.spinner.hide();
					});
			} catch (err) {
				this.spinner.hide();
			}
		}
	}

	openAddModal() {
		this.imageSrc = '';
		this.homepageImageSrc = '';
		this.galleryImagesArr = [];
		this.addVehicleTypeForm.reset({ seats: 1, luggage: 0, status: 'enable', sort_order: 1, gallery_images: [] });

		$('#addVehicleTypeModal').modal('show');
	}
	submitForm() {
		this.submitted = true;
		// stop here if form is invalid
		if (this.addVehicleTypeForm.invalid) {
			console.log('Form is invalid!', this.addVehicleTypeForm.value);
			Object.keys(this.addVehicleTypeForm.controls).forEach(key => {
				const controlErrors = this.addVehicleTypeForm.get(key).errors;
				if (controlErrors != null) {
					console.log('Key control: ' + key + ', key errors: ', controlErrors);
				}
			});
			return;
		}

		let payload = { ...this.addVehicleTypeForm.value };
		if (payload.features && typeof payload.features === 'string') {
			payload.features = payload.features.split(',').map(f => f.trim()).filter(f => f.length > 0);
		} else if (!payload.features) {
			payload.features = [];
		}

		this.spinner.show();
		this.disableAddButton = true; //disable submit button
		// this.showProgressBar=true; //show progressbar

		this.adminService.addVehicleType(payload)
			.pipe(
				catchError(err => {
					this.spinner.hide();
					this.disableAddButton = false;
					return throwError(err);
				})
			)
			.subscribe(result => {
				this.response = result;
				// this.router.navigateByUrl('/admin/master-vehicle-types');
				$('#addVehicleTypeModal').modal('hide');
				this.router.navigateByUrl('/RefreshComponent', { skipLocationChange: true }).then(() => {
					this.router.navigate(['/admin/master-vehicle-types']);
				});
			});

		// this.showProgressBar=false; //hide progressbar
	}

	editVehicleType(id) {
		this.spinner.show();

		this.adminService.getVehicleType(id)
			.pipe(
				catchError(err => {
					this.spinner.hide();//hide spinner
					return throwError(err);
				})
			)
			.subscribe(result => {
				this.response = result;
				this.vehicleId = this.response.data.ID

				// Build the linked category options from the vehicle types already loaded on the page,
				// excluding the vehicle type currently being edited.
				const currentVehicleIds = [
					id,
					this.response.data.id,
					this.response.data.ID
				]
					.filter(value => value !== undefined && value !== null && value !== '')
					.map(value => String(value));
				const currentVehicleName = (this.response.data.vehicle_cat_name || '').trim().toLowerCase();
				this.linkedCatOptions = this.allVehicles.filter((vehicle: any) => {
					const vehicleId = String(vehicle.id ?? vehicle.ID);
					const vehicleName = (vehicle.vehicle_name || '').trim().toLowerCase();
					return !currentVehicleIds.includes(vehicleId)
						&& !(currentVehicleName && vehicleName === currentVehicleName);
				});

				this.editVehicleTypeForm.patchValue({
					vehicleId: this.response.data.id,
					vehicleType: this.response.data.vehicle_cat_name,
					tagline: this.response.data.tagline || '',
					badge_text: this.response.data.badge_text || '',
					features: this.response.data.features ? this.response.data.features.join(', ') : '',
					descriptions: this.response.data.descriptions || '',
					linked_cat: this.response.data.linked_cat || '',
					sort_order: this.response.data.sort_order !== undefined && this.response.data.sort_order !== null ? this.response.data.sort_order : 1,
					status: this.response.data.status || 'enable',
					vehicle_homepage_img: this.response.data.vehicle_homepage_img || '',
					gallery_images: this.response.data.gallery_images || [],
					seats: this.response.data.seats,
					luggage: this.response.data.luggage
				});

				this.editVehiclePic = this.response.data.vehicle_cat_image;
				this.homepageImageSrcEdit = this.response.data.vehicle_homepage_img || '';
				this.galleryImagesArrEdit = this.response.data.gallery_images ? [...this.response.data.gallery_images] : [];

				$('#editVehicleTypeModal').modal('show');
				this.spinner.hide();//hide spinner
			});
	}

	async onFileUpdate(event) {
		if (!await this.commonServices.handleFile(event)) {
			return;
		}

		const reader = new FileReader();

		if (event.target.files && event.target.files.length) {
			const [file] = event.target.files;
			reader.readAsDataURL(file);

			reader.onload = () => {
				this.imageSrc = reader.result as string;
				this.spinner.show();

				this.uploadSingleImageForVehicleTypes(file, (response: any) => {
					this.editVehicleTypeForm.patchValue({
						vehicleImage: response.data.id
					});
				});
			};
		}
	}

	async onHomepageImgUpdate(event) {
		if (!await this.commonServices.handleFile(event)) {
			return;
		}

		const reader = new FileReader();
		if (event.target.files && event.target.files.length) {
			const [file] = event.target.files;
			reader.readAsDataURL(file);

			reader.onload = () => {
				this.homepageImageSrcEdit = reader.result as string;
				this.spinner.show();

				this.uploadSingleImageForVehicleTypes(file, (response: any) => {
					this.editVehicleTypeForm.patchValue({
						vehicle_homepage_img: response.data.image,
						vehicleImage: response.data.image,
					});
				});
			};
		}
	}

	async onGalleryUpdate(event) {
		if (event.target.files && event.target.files.length) {
			this.spinner.show();
			const files = Array.from(event.target.files);

			try {
				const formData = new FormData();
				files.forEach((file: any) => {
					formData.append('images[]', file, file.name);
				});

				this.adminService.uploadMultipleImages(formData)
					.subscribe((response: any) => {
						let ids = [];
						if (Array.isArray(response.data)) {
							ids = response.data.map((item: any) => item.imagepath ? item.imagepath : item);
						} else if (response.data && response.data.imagepath) {
							ids = [response.data.imagepath];
						} else if (Array.isArray(response)) {
							ids = response.map((item: any) => item.imagepath ? item.imagepath : item);
						}

						this.galleryImagesArrEdit.push(...ids);
						this.editVehicleTypeForm.patchValue({ gallery_images: this.galleryImagesArrEdit });
						this.spinner.hide();
					}, err => {
						this.spinner.hide();
					});
			} catch (err) {
				this.spinner.hide();
			}
		}
	}

	removeGalleryImage(index: number, isEdit: boolean) {
		if (isEdit) {
			this.galleryImagesArrEdit.splice(index, 1);
			this.editVehicleTypeForm.patchValue({ gallery_images: this.galleryImagesArrEdit });
		} else {
			this.galleryImagesArr.splice(index, 1);
			this.addVehicleTypeForm.patchValue({ gallery_images: this.galleryImagesArr });
		}
	}

	//increment/decrement in ONE WAY form
	if() {

	}
	change(changeType: 'i' | 'd', fieldName: 'l' | 'p') {
		let max_length = 75
		if (fieldName == 'p') {
			// for passenger
			if (changeType == 'i' && this.addVehicleTypeForm.value.seats < max_length) {
				this.f.seats.setValue(this.addVehicleTypeForm.value.seats + 1)
			} else if (changeType == 'd' && this.addVehicleTypeForm.value.seats > 1) {
				this.f.seats.setValue(this.addVehicleTypeForm.value.seats - 1)
			}
		} else {
			// for luggage
			if (changeType == 'i' && this.addVehicleTypeForm.value.luggage < max_length) {
				this.f.luggage.setValue(this.addVehicleTypeForm.value.luggage + 1)
			} else if (changeType == 'd' && this.addVehicleTypeForm.value.luggage >= 1) {
				this.f.luggage.setValue(this.addVehicleTypeForm.value.luggage - 1)
			}
		}
	}

	editChange(changeType: 'i' | 'd', fieldName: 'l' | 'p') {
		let max_length = 75
		if (fieldName == 'p') {
			// for passenger
			if (changeType == 'i' && this.editVehicleTypeForm.value.seats < max_length) {
				this.fEdit.seats.setValue(this.editVehicleTypeForm.value.seats + 1)
			} else if (changeType == 'd' && this.editVehicleTypeForm.value.seats > 1) {
				this.fEdit.seats.setValue(this.editVehicleTypeForm.value.seats - 1)
			}
		} else {
			// for luggage
			if (changeType == 'i' && this.editVehicleTypeForm.value.luggage < max_length) {
				this.fEdit.luggage.setValue(this.editVehicleTypeForm.value.luggage + 1)
			} else if (changeType == 'd' && this.editVehicleTypeForm.value.luggage >= 1) {
				this.fEdit.luggage.setValue(this.editVehicleTypeForm.value.luggage - 1)
			}
		}
	}

	get fEdit() {
		return this.editVehicleTypeForm.controls;
	}
	updateVehicleForm() {
		this.submitted = true;
		// stop here if form is invalid
		if (this.editVehicleTypeForm.invalid) {
			console.log('Edit Form is invalid!', this.editVehicleTypeForm.value);
			Object.keys(this.editVehicleTypeForm.controls).forEach(key => {
				const controlErrors = this.editVehicleTypeForm.get(key).errors;
				if (controlErrors != null) {
					console.log('Key control: ' + key + ', key errors: ', controlErrors);
				}
			});
			return;
		}

		let payload = { ...this.editVehicleTypeForm.value };
		if (payload.features && typeof payload.features === 'string') {
			payload.features = payload.features.split(',').map(f => f.trim()).filter(f => f.length > 0);
		} else if (!payload.features) {
			payload.features = [];
		}

		this.spinner.show();
		// this.showProgressBarEdit=true; //show progressbar
		this.disableEditButton = true; //disable submit button

		this.adminService.updateVehicleType(payload)
			.pipe(
				catchError(err => {
					this.spinner.hide();
					this.disableEditButton = false;
					return throwError(err);
				})
			)
			.subscribe(result => {
				this.response = result;
				// this.router.navigateByUrl('/admin/master-vehicle-types');
				$('#editVehicleTypeModal').modal('hide');
				this.router.navigateByUrl('/RefreshComponent', { skipLocationChange: true }).then(() => {
					this.router.navigate(['/admin/master-vehicle-types']);
				});
			});

		// this.showProgressBarEdit=false; //hide progressbar
	}

	/* addVehicleClick(vehicleTypeId)
	{
		this.router.navigate(['/admin/master-vehicle-types/add-vehicle'], { queryParams: { vehicleTypeId: vehicleTypeId } });
	}

	viewVehicleClick(vehicleTypeId)
	{
		this.router.navigate(['/admin/master-vehicle-types/vehicles'], { queryParams: { vehicleTypeId: vehicleTypeId } });
	} */

	/**
	 * Change Routing with provided configuration options
	 * @param type : String [Required] kind of response to make
	 * @param type_iden : Number [Required] vehicle type identification number
	 * @param vehicle_iden : Number [Required] vehicle identification number
	 */
	changeRouting(type_selected: any) {

		// * End Step: hit the api with all current configurations
		this.router.navigate([`/admin/master-vehicle-types/master-vehicle-fare`], {
			queryParams: {
				vehicleTypeId: type_selected.ID
			}
		})

	}
	resetForm() {
		this.imageSrc = '';
		this.homepageImageSrc = '';
		this.galleryImagesArr = [];
		this.homepageImageSrcEdit = '';
		this.galleryImagesArrEdit = [];

		this.addVehicleTypeForm.reset({ seats: 1, luggage: 0, status: 'enable', sort_order: 1, gallery_images: [] });
		this.editVehicleTypeForm.reset({ seats: 1, luggage: 0, status: 'enable', sort_order: 1, gallery_images: [], linked_cat: '' });
	}
}
