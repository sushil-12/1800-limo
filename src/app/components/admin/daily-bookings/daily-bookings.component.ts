import { Component, ElementRef, OnInit, ViewChild, AfterViewInit, OnDestroy } from "@angular/core";
import { BookingTabCounts } from "../../shared/bookings-header/bookings-header.component";
import { AdminService } from "../../../services/admin.service";
import { ActivatedRoute, Router } from "@angular/router";
import { NgxSpinnerService } from "ngx-spinner";
import { catchError } from "rxjs/operators";
import { throwError } from "rxjs";
import {
	DateAdapter,
	MAT_DATE_LOCALE,
	ThemePalette,
} from "@angular/material/core";
import { FormGroup, FormBuilder, Validators } from "@angular/forms";
import { HttpClient } from "@angular/common/http";
declare var $: any;
import * as moment from "moment";
import * as dayjs from 'dayjs';
import { ErrorDialogService } from "../../../services/error-dialog/errordialog.service";
import { MatSelect } from "@angular/material/select";
// import { DatePickerComponent } from "../../shared/date-picker/date-picker.component"; // Remove if custom header is not needed
import { UploadService } from "../../../services/upload.service";
import { GoogleMap } from '@angular/google-maps';
import { BsDatepickerConfig } from 'ngx-bootstrap/datepicker'; // Import for config if needed
import { MapUtils } from '../../../utils/map-utils';
import { ToastrService } from "ngx-toastr";
import Quill from "quill";
import { BookingFilterOption } from "../../shared/bookings-header/bookings-header.component";


@Component({
	selector: "app-daily-bookings",
	templateUrl: "./daily-bookings.component.html",
	styleUrls: ["./daily-bookings.component.scss"],
	providers: [BsDatepickerConfig], // Optional: Provide config if customizing globally
})
export class DailyBookingsComponent implements OnInit, AfterViewInit, OnDestroy {
	@ViewChild('bookingPreviewModal') bookingPreviewModal: any;
	@ViewChild(GoogleMap, { static: false }) map!: GoogleMap;

	// exampleHeader = DatePickerComponent; // Remove if not using Material
	@ViewChild("inputmsg", { static: false }) message: ElementRef;
	@ViewChild('fileInput') fileInput!: ElementRef;
	@ViewChild("select") select: MatSelect;
	@ViewChild("sendEmailModalFocus") sendEmailModalFocus: any;

	pinnedBookingIds: string[] = [];
	pinnedBookings: any[] = [];

	// Booking ids whose extra stops are currently expanded in the Trip Route column
	expandedStopsBookingIds: any[] = [];

	outputDateFormat = "YYYY-MM-DD";
	color: ThemePalette = "primary";
	public firstPage: Number;
	public lastPage: Number;
	public totalPage: Number;
	public totalRecords: any;
	public currentPage: any;
	public from: Number;
	public to: Number;
	public path: string;
	public firstPageUrl: string;
	public lastPageUrl: string;
	public prevPageUrl: string;
	public nextPageUrl: string;
	public sendMessageField: any = null;
	public bookingsRes: any;
	public bookings: any = [];
	public bookingStatusColor: string;
	public startDate: Date | null; // Changed to Date
	public endDate: Date | null; // Changed to Date
	public selectedDateRange: any;
	public orderBy: string = "pickup_date_desc";
	// public returnRepeatForm: FormGroup;
	public changeStatusForm: FormGroup;
	public sendEmailForm: FormGroup;
	public submitted: boolean = false;
	searchText: string = "";
	filtertype: string = "";

	passengerDetails: any;
	senderValue: string;
	sendInformation: any;
	reciptentName: any;
	notification_msg: any;
	status_list: any = [];
	statusFilterOptions: BookingFilterOption[] = [];
	selectedStatus: any = null;
	bookings_Original: any = [];
	audit_Trail: any = [];
	currentUser: any = JSON.parse(localStorage.getItem("currentUser")) || "";
	subModules: any = localStorage.getItem("sub_modules") || "";
	useDateFilter: boolean = false;
	// Upcoming / Past / Custom tabs (Custom = the date-range pickers).
	listTab: string = 'upcoming';
	tabCounts: BookingTabCounts | null = null;
	use_created_at: boolean = false;
	rates_preview: any;
	quotebotNewData: any;
	shareArray: any;
	adminSharePercent: any;
	previewCopyData: any;
	accept_charge_id: any;
	public is_stripe_added: any;
	public stripeResp: any;
	public stripeErroMsg: string = '';
	subs_end_date: any;
	isCancelled: boolean = false;
	fileUrl: String;
	fileName: String;
	fileType: String;
	uploadedFile: any;
	deducted_stripe_fee: any;
	total_amount: any;
	admin_total: any;
	successMessage: any;
	zoom = 7;
	mapCenter: google.maps.LatLngLiteral = { lat: 41.850033, lng: -87.6500523 };
	directionsRenderer!: google.maps.DirectionsRenderer;
	markers: google.maps.Marker[] = [];
	showCopyIcon: boolean = false
	selectedEmailBookingShowChangedFields: boolean = false;
	selectedEmailBookingStatus: string = '';
	private afterPrintHandler?: () => void;
	editorContent: string = '';

	@ViewChild('messageEditor') messageEditor: any;
    private quillMessageInstance: Quill;

	quillModules = {
		toolbar: [
			['bold', 'italic', 'underline', 'strike'],
			[{ 'list': 'ordered' }, { 'list': 'bullet' }],
			[{ 'color': [] }, { 'background': [] }],
			['link'],
			['clean']
		]
	};

	isStopsExpanded(bookingId: any): boolean {
		return this.expandedStopsBookingIds.includes(bookingId);
	}

	toggleStops(bookingId: any, event?: Event): void {
		event?.stopPropagation();
		const index = this.expandedStopsBookingIds.indexOf(bookingId);
		if (index > -1) {
			this.expandedStopsBookingIds.splice(index, 1);
		} else {
			this.expandedStopsBookingIds.push(bookingId);
		}
	}

	constructor(
		private adminService: AdminService,
		private router: Router,
		private spinner: NgxSpinnerService,
		private formBuilder: FormBuilder,
		private $errorDialog: ErrorDialogService,
		private uploadService: UploadService,
		private toastr: ToastrService,
		private bsConfig: BsDatepickerConfig // Optional: Inject for custom config
	) {
		// Optional: Set global config for datepicker
		this.bsConfig.dateInputFormat = this.outputDateFormat;
		this.bsConfig.containerClass = 'theme-default';
		this.bsConfig.showWeekNumbers = false;
	}

	ngOnInit(): void {
		let date = new Date();
		let timestamp = date.getTime();
		// Set Search Filters According to cookies or the intial state
		this.startDate = localStorage.getItem("admin_startDate")
			? dayjs(localStorage.getItem("admin_startDate")).toDate() // Convert string to Date
			: dayjs(timestamp).toDate();

		date.setDate(date.getDate() + 7);
		timestamp = date.getTime();
		this.endDate = localStorage.getItem("admin_endDate")
			? dayjs(localStorage.getItem("admin_endDate")).toDate() // Convert string to Date
			: dayjs(timestamp).toDate();

		this.selectedDateRange = {
			startDate: dayjs(this.startDate),
			endDate: dayjs(this.endDate)
		};

		this.searchText = localStorage.getItem("DBSearch")
			? localStorage.getItem("DBSearch")
			: "";
		console.log(
			"usedatefilter---->>>>>>>",
			localStorage.getItem("useDateFilter")
		);
		this.useDateFilter = localStorage.getItem('useDateFilter') ?
			(localStorage.getItem('useDateFilter') == 'true' ? true : false)
			: false;
		console.log("useDateFilter-->", this.useDateFilter);
		this.listTab = this.useDateFilter ? 'custom' :
			(localStorage.getItem('DBListTab') == 'past' ? 'past' : 'upcoming');
		this.orderBy = localStorage.getItem("orderByCreatedAt") ? localStorage.getItem("orderByCreatedAt") :
			(this.listTab == 'past' ? "pickup_date_desc" : "pickup_date_asc")
		this.use_created_at = localStorage.getItem("orderByCreatedAt") ? true : false


		this.adminService
			.getStatusList()
			.pipe(
				catchError((err) => {
					this.spinner.hide(); //hide spinner
					return throwError(err);
				})
			)
			.subscribe(({ data }: any) => {
				this.status_list = data;
				this.statusFilterOptions = (data || []).map((item: any) => ({ label: item.status, value: item.value }));
			});

		this.selectedStatus = localStorage.getItem("DBS_Status") ? localStorage.getItem("DBS_Status") : null;

		this.loadBookings(null, this.startDate, this.endDate, this.searchText, this.selectedStatus, true);

		//change status booking form validation
		this.changeStatusForm = this.formBuilder.group({
			reservation_id: ["", Validators.required],
			booking_status: ["", Validators.required],
		});

		//send email booking form validation
		this.sendEmailForm = this.formBuilder.group({
			reservation_id: ["", Validators.required],
			emailTarget: ["", Validators.required],
			 text_message: [""] 
		});

		if (this.currentUser?.created_by_role == 'subscriber') {
			this.stripeDetailsCheck()
			this.subs_end_date = localStorage.getItem('current_period_end_date')
			this.isCancelled = JSON.parse(localStorage.getItem('is_subscription_cancelled'))
		}

		const storedPins = localStorage.getItem('pinnedBookingIds');
		if (storedPins) {
			try {
				this.pinnedBookingIds = JSON.parse(storedPins);
			} catch (e) { this.pinnedBookingIds = []; }
		}
		const storedPinnedBookings = localStorage.getItem('pinnedBookings');
		if (storedPinnedBookings) {
			try {
				this.pinnedBookings = JSON.parse(storedPinnedBookings);
			} catch (e) { this.pinnedBookings = []; }
		}

	}

	ngAfterViewInit(): void {
		this.subModules = localStorage.getItem("sub_modules");
		$("#search-field").addClass("box-outline");
		// $('#layoutSidenav_content').addClass("layout_shadow")
		this.sendEmailModalFocus.nativeElement
			.querySelector("textarea")
			.focus();
		// this.MapController();
	}
	

	ngOnDestroy(): void {
		if (this.afterPrintHandler) {
			window.removeEventListener('afterprint', this.afterPrintHandler);
		}
		document.body.classList.remove('printing-daily-bookings');
	}

	onMessageEditorCreated(quill: Quill) {
		this.quillMessageInstance = quill;
		
		const selectAllText = () => {
		setTimeout(() => {
			const textLength = quill.getText().trim().length;
			if (textLength > 0) {
			quill.setSelection(0, quill.getLength());
			}
		}, 10);
		};
		
		quill.root.addEventListener('focus', selectAllText);
	}

	getEditorContent(): string {
		if (this.sendMessageField) {
			// SMS: directly from textarea DOM element (no form control needed)
			return this.message?.nativeElement?.value || '';
		} else {
			// Email: from Quill editor
			return this.editorContent;
		}
	}

	get printGeneratedAt(): string {
		return moment().format('MM/DD/YYYY, HH:mm');
	}

	togglePin(bookingId: string): void {
		const index = this.pinnedBookingIds.indexOf(bookingId);
		let action: 'pinned' | 'unpinned';

		if (index === -1) {
			this.pinnedBookingIds.push(bookingId);
			const bookingObj = this.bookings_Original.find((b: any) => b.booking_id === bookingId)
				|| this.bookings.find((b: any) => b.booking_id === bookingId);
			if (bookingObj) {
				this.pinnedBookings.push(bookingObj);
			}
			action = 'pinned';
		} else {
			this.pinnedBookingIds.splice(index, 1);
			this.pinnedBookings = this.pinnedBookings.filter((b: any) => b.booking_id !== bookingId);
			action = 'unpinned';
		}

		localStorage.setItem('pinnedBookingIds', JSON.stringify(this.pinnedBookingIds));
		localStorage.setItem('pinnedBookings', JSON.stringify(this.pinnedBookings));

		this.filterBookingsByStatus();
		if (action === 'pinned') {
			this.toastr.success(`Booking #${bookingId} pinned`);
		} else {
			this.toastr.error(`Booking #${bookingId} unpinned`);
		}
	}

	printDailyBookings(): void {
		document.body.classList.add('printing-daily-bookings');

		if (this.afterPrintHandler) {
			window.removeEventListener('afterprint', this.afterPrintHandler);
		}

		this.afterPrintHandler = () => {
			document.body.classList.remove('printing-daily-bookings');
			if (this.afterPrintHandler) {
				window.removeEventListener('afterprint', this.afterPrintHandler);
				this.afterPrintHandler = undefined;
			}
		};

		window.addEventListener('afterprint', this.afterPrintHandler);
		setTimeout(() => window.print(), 50);
	}

	stripeDetailsCheck() {
		this.is_stripe_added = localStorage.getItem('is_stripe_account_added') ? JSON.parse(localStorage.getItem('is_stripe_account_added')) : '';
		console.log("is stripe", this.is_stripe_added)
		this.spinner.show()
		this.adminService.getSubsriberBank(this.currentUser?.account_id)
			.pipe(
				catchError(err => {
					// this.stateManagementService.setprogressBar(false);
					this.spinner.hide()
					return throwError(err);
				})
			).subscribe(result => {
				this.spinner.hide()
				this.stripeResp = result
				console.log(this.stripeResp)
				console.log(this.stripeResp?.data?.stripe_account_status == 'unverified')
				if (this.stripeResp?.data?.stripe_account_status == 'unverified' && this.is_stripe_added) {
					console.log("in if")
					this.stripeErroMsg = 'Your Stripe/Bank account is currently unverified. Please check for any issues or wait for 24 hours.'
				}
				else if (!this.is_stripe_added) {
					this.stripeErroMsg = 'Please fill out the bank details to activate payments.'
				}
				else {
					this.stripeErroMsg = ''
				}

				console.log('Error msg:', this.stripeErroMsg)
			})
	}

	MapController() {
		console.log('Map has been initialised.')
		let origin: google.maps.LatLng;
		let destination: google.maps.LatLng;
		const waypoints: google.maps.DirectionsWaypoint[] = [];

		// Base values
		origin = new google.maps.LatLng(this.bookingPreview.pickup_latitude, this.bookingPreview.pickup_longitude);
		destination = new google.maps.LatLng(this.bookingPreview.dropoff_latitude, this.bookingPreview.dropoff_longitude);


		// Override based on transfer_type
		if (this.bookingPreview.transfer_type?.includes('airport_')) {
			origin = new google.maps.LatLng(this.bookingPreview.pickup_airport_latitude, this.bookingPreview.pickup_airport_longitude);
		}

		if (this.bookingPreview.transfer_type?.includes('_airport')) {
			destination = new google.maps.LatLng(this.bookingPreview.dropoff_airport_latitude, this.bookingPreview.dropoff_airport_longitude);
		}

		// Handle Extra Stops
		if (this.bookingPreview?.extra_stops?.length > 0) {
			console.log("Processing extra stops", this.bookingPreview.extra_stops);
			for (let i = 0; i < this.bookingPreview.extra_stops.length; i++) {
				const stop = this.bookingPreview.extra_stops[i];
				if (stop.latitude && stop.longitude) {
					console.log("Adding waypoint:", stop);
					waypoints.push({
						location: new google.maps.LatLng(
							Number(stop.latitude),
							Number(stop.longitude)
						),
						stopover: true
					});
				}
			}
		}

		// Clear previous markers
		if (this.markers) {
			this.markers.forEach(m => m.setMap(null));
		}
		this.markers = [];

		// Clear previous renderer
		if (this.directionsRenderer) {
			this.directionsRenderer.setMap(null);
		}

		setTimeout(() => {
			this.drawMap({
				origin,
				destination,
				waypoints,
				optimizeWaypoints: false, // DO NOT optimize so order is preserved for A,B,C labels
				travelMode: google.maps.TravelMode.DRIVING
			})
		}, 100)


	}

	drawMap(request: google.maps.DirectionsRequest) {
		const directionsService = new google.maps.DirectionsService();
		this.directionsRenderer = new google.maps.DirectionsRenderer({ suppressMarkers: true });

		const mapInstance = this.map.googleMap;
		if (!mapInstance) {
			console.error('Map is not initialized yet');
			return;
		}

		this.directionsRenderer.setMap(mapInstance);

		directionsService.route(request, (response, status) => {
			if (status === google.maps.DirectionsStatus.OK) {
				console.log('Directions loaded:', response);
				this.directionsRenderer.setDirections(response);
				this.renderCustomMarkers(mapInstance, response);
			} else {
				console.error('Directions request failed due to ' + status);
			}
		});
	}

	private renderCustomMarkers(
		map: google.maps.Map,
		response: google.maps.DirectionsResult
	) {
		const locations: google.maps.LatLngLiteral[] = [];
		const route = response.routes[0];

		if (!route || !route.legs) return;

		const legs = route.legs;

		// Pickup (Start of first leg)
		locations.push(legs[0].start_location.toJSON());

		// Waypoints (End of all legs except the last one)
		for (let i = 0; i < legs.length - 1; i++) {
			locations.push(legs[i].end_location.toJSON());
		}

		// Dropoff (End of last leg)
		locations.push(legs[legs.length - 1].end_location.toJSON());

		// Use Utility to offset overlapping points
		const adjusted = MapUtils.getOffsetMarkers(locations, 100);

		// Labels: A, B, C, D...
		adjusted.forEach((item, index) => {
			const labelChar = String.fromCharCode(65 + index);

			const marker = new google.maps.Marker({
				position: item.position,
				map: map,
				zIndex: 1000 + index,
				title: `Stop ${labelChar}`,
				icon: {
					path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z",
					fillColor: "#EA4335",
					fillOpacity: 1,
					strokeColor: "#B31412",
					strokeWeight: 1,
					scale: 1.5,
					anchor: new google.maps.Point(12 - (item.pixelOffset / 1.5), 22),
					labelOrigin: new google.maps.Point(12, 9)
				},
				label: {
					text: labelChar,
					color: 'white',
					fontSize: '14px',
					fontWeight: 'bold'
				}
			});
			this.markers.push(marker);
		});
	}


	/** The `filter` sent to the API: '' while on Custom, which uses the date range instead. */
	listFilter(): string {
		return this.listTab == 'custom' ? '' : this.listTab;
	}

	selectTab(tab: string) {
		this.listTab = tab;
		localStorage.setItem('DBListTab', tab);
		this.useDateFilter = tab == 'custom';
		this.saveCookie("useDateFilter", this.useDateFilter);

		if (!this.startDate || !this.endDate) {
			const date = new Date();
			this.startDate = dayjs(date).startOf('day').toDate();
			date.setDate(date.getDate() + 7);
			this.endDate = dayjs(date).startOf('day').toDate();
			this.saveCookie("admin_startDate", this.startDate);
			this.saveCookie("admin_endDate", this.endDate);
		}

		this.selectedDateRange = {
			startDate: dayjs(this.startDate),
			endDate: dayjs(this.endDate)
		};

		this.runBookingsSearch();
	}

	handleCheckboxSort(value: any) {
		if (value) {
			this.orderBy = "pickup_date_asc";
			localStorage.setItem('orderByCreatedAt', 'created_at_desc')
		}
		else {
			this.orderBy = "pickup_date_desc";
			localStorage.removeItem('orderByCreatedAt')
		}
		this.loadBookings(null, this.startDate, this.endDate, this.searchText, this.selectedStatus);
	}

	handleSort(field: string) {
		if (this.orderBy.startsWith(field)) {
			if (this.orderBy.endsWith('_asc')) {
				this.orderBy = field + '_desc';
			} else {
				this.orderBy = field + '_asc';
			}
		} else {
			this.orderBy = field + '_asc';
		}

		if (field === 'created_at') {
			localStorage.setItem('orderByCreatedAt', this.orderBy);
			this.use_created_at = true;
		} else {
			localStorage.removeItem('orderByCreatedAt');
			this.use_created_at = false;
		}

		this.sortBookings();
		this.filterBookingsByStatus();
	}

	sortBookings() {
		if (!this.bookings_Original || this.bookings_Original.length === 0) return;

		const [field, direction] = this.orderBy.split('_asc').length > 1 ? [this.orderBy.replace('_asc', ''), 'asc'] : [this.orderBy.replace('_desc', ''), 'desc'];

		this.bookings_Original.sort((a: any, b: any) => {
			let valA = a[field];
			let valB = b[field];

			// Specialized handling for booking_id (numeric)
			if (field === 'booking_id') {
				valA = parseInt(valA);
				valB = parseInt(valB);
			}
			// Specialized handling for pickup_date (date comparison)
			else if (field === 'pickup_date') {
				valA = new Date(valA).getTime();
				valB = new Date(valB).getTime();
			}

			if (valA < valB) return direction === 'asc' ? -1 : 1;
			if (valA > valB) return direction === 'asc' ? 1 : -1;
			return 0;
		});
		// this.useDateFilter = value
		// this.saveCookie('useDateFilter',value)
		// this.loadBookings(null, this.startDate, this.endDate, this.searchText);
	}
	/**
	 * Configure date as per todays date and the future +7 days
	 */
	reset() {
		let date = new Date();
		this.startDate = date;

		let endDate = new Date();
		endDate.setDate(date.getDate() + 7);
		this.endDate = endDate;

		this.saveCookie('admin_startDate', '');
		this.saveCookie('admin_endDate', '');
		localStorage.removeItem("admin_startDate");
		localStorage.removeItem("admin_endDate");
		// this.adminService.deleteCookie('search')
		localStorage.removeItem("DBSearch");
		localStorage.removeItem("useDateFilter");
		localStorage.removeItem("DBListTab");
		localStorage.removeItem("DBS_Status");
		// Clear pinned bookings
		this.pinnedBookingIds = [];
		this.pinnedBookings = [];
		localStorage.removeItem('pinnedBookingIds');
		localStorage.removeItem('pinnedBookings');
		this.useDateFilter = false;
		this.listTab = 'upcoming';
		// this.adminService.deleteCookie('filtertype')
		this.searchText = "";
		this.selectedStatus = null;
		// this.filtertype = 'bookingid';

		console.log("Reset Successfully. ");
		this.saveCookie("admin_startDate", this.startDate);
		this.saveCookie("admin_endDate", this.endDate);
		localStorage.setItem("DBSearch", this.searchText);
		this.applySearchOrdering();
		this.loadBookings(
			null,
			this.startDate,
			this.endDate,
			this.searchText,
			this.selectedStatus,
			true
		);

	}

	applyStatusFilter(status: any) {
		this.selectedStatus = status;
		if (status) {
			localStorage.setItem("DBS_Status", status);
		} else {
			localStorage.removeItem("DBS_Status");
		}
		this.filterBookingsByStatus();
	}


	filterBookingsByStatus() {
		let filtered = [...this.bookings_Original];

		if (this.selectedStatus && this.selectedStatus !== "") {
			filtered = filtered.filter((b: any) => b.booking_status == this.selectedStatus);
		}

		// Refresh pinned booking objects from fresh API data when available,
		// fall back to stored copy only when the booking isn't in the current result set
		const freshPinnedBookings = this.pinnedBookingIds.map(id => {
			const fresh = this.bookings_Original.find((b: any) => b.booking_id === id);
			if (fresh) {
				return fresh;
			}
			return this.pinnedBookings.find((b: any) => b.booking_id === id);
		}).filter(Boolean);

		// Keep pinnedBookings in sync so localStorage stays up to date
		this.pinnedBookings = freshPinnedBookings;
		localStorage.setItem('pinnedBookings', JSON.stringify(this.pinnedBookings));

		const unpinned = filtered.filter((b: any) => !this.pinnedBookingIds.includes(b.booking_id));
		this.bookings = [...freshPinnedBookings, ...unpinned];
	}



	choosedDate(event) {
		if (event.startDate && event.endDate) {
			this.startDate = dayjs(event.startDate).hour(12).minute(0).second(0).toDate();
			this.endDate = dayjs(event.endDate).hour(12).minute(0).second(0).toDate();
			// this.loadBookings(null, this.startDate, this.endDate, this.searchText);
			this.saveCookie('admin_startDate', this.startDate);
			this.saveCookie('admin_endDate', this.endDate);
		}
	}

	messageField(format: string) {
		this.show = true;
		this.sendMessageField = format === "Phone";

		// Wait for Angular to render the new input (SMS textarea or Email editor)
		setTimeout(() => {
			if (this.sendMessageField) {
				// SMS mode
				const defaultSms = 'Hi, Please check your email for new bookings. Click Accept/Reject. Thanks, Text Joe at 7082056607 with any questions.';
				if (this.message?.nativeElement) {
					this.message.nativeElement.value = defaultSms;
					this.sendEmailForm.patchValue({ text_message: defaultSms });
					this.message.nativeElement.focus();
				}
			} else {
				// Email mode
				this.editorContent = 'Hi, Please check your email for new bookings. Click Accept/Reject. Thanks, Text Joe at 7082056607 with any questions.';
				const quillEditor = document.querySelector('.ql-editor') as HTMLElement;
				if (quillEditor) quillEditor.focus();
			}
		}, 50);
	}

	highlighText(args: string) {
		if (!this.searchText) {
			return args;
		}
		if (args) {
			args = args.toString();
			const escapedSearchText = this.searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			var re = new RegExp(escapedSearchText, "gi"); //'gi' for case insensitive and can use 'g' if you want the search to be case sensitive.
			return args.replace(re, '<mark class="font-weight-bold">$&</mark>');
		}
	}
	updatedEmailAll(sourceModal: string = 'updatedEmailAll') {
		console.log(
			"In function updatedEmailAll all",
			this.sendEmailForm.value.reservation_id,
			this.sendEmailForm.value.emailTarget
		);
		let data = {
			reservation_id: this.sendEmailForm.value.reservation_id,
		};
		this.spinner.show();
		this.adminService
			.bookingEmailAllUpdated(this.sendEmailForm.value.reservation_id)
			.pipe(
				catchError((err) => {
					this.spinner.hide();
					return throwError(err);
				})
			)
			.subscribe((response: any) => {
				console.log("response--------->>>>>>>>", response);
				this.spinner.hide();
				$(`#${sourceModal}`).modal("hide");
				$('#successModal').modal('show')
				this.successMessage = 'Updated email has been sent successfully'
				this.loadBookings(
					null,
					this.startDate,
					this.endDate,
					this.searchText,
					this.selectedStatus
				);
				setTimeout(() => {
					$('#successModal').modal('hide')
				}, 2000)
			});
	}

	updatedEmailIndividual(sourceModal: string = 'emailAll') {
		this.spinner.show();
		this.adminService
			.bookingUpdatedEmailByTarget(this.sendEmailForm.value.reservation_id, 'customer')
			.pipe(
				catchError((err) => {
					this.spinner.hide();
					return throwError(err);
				})
			)
			.subscribe((response: any) => {
				console.log("response--------->>>>>>>>", response);
				this.spinner.hide();
				$(`#${sourceModal}`).modal("hide");
				$('#successModal').modal('show')
				this.successMessage = 'Updated email has been sent successfully'
				this.loadBookings(
					null,
					this.startDate,
					this.endDate,
					this.searchText,
					this.selectedStatus
				);
				setTimeout(() => {
					$('#successModal').modal('hide')
				}, 2000)
			});
	}

	updatedEmailAffiliate(sourceModal: string = 'emailAll') {
		this.spinner.show();
		this.adminService
			.bookingUpdatedEmailByTarget(this.sendEmailForm.value.reservation_id, 'affiliate')
			.pipe(
				catchError((err) => {
					this.spinner.hide();
					return throwError(err);
				})
			)
			.subscribe((response: any) => {
				console.log("response--------->>>>>>>>", response);
				this.spinner.hide();
				$(`#${sourceModal}`).modal("hide");
				$('#successModal').modal('show')
				this.successMessage = 'Updated email has been sent successfully'
				this.loadBookings(
					null,
					this.startDate,
					this.endDate,
					this.searchText,
					this.selectedStatus
				);
				setTimeout(() => {
					$('#successModal').modal('hide')
				}, 2000)
			});
	}

	sendEmailAll() {
		if (this.selectedEmailBookingShowChangedFields) {
			this.updatedEmailAll('emailAll');
		} else {
			this.emailAll();
		}
	}

	emailAll() {
		console.log(
			"In function email all",
			this.sendEmailForm.value.reservation_id,
			this.sendEmailForm.value.emailTarget
		);
		let data = {
			reservation_id: this.sendEmailForm.value.reservation_id,
		};
		this.spinner.show();
		this.adminService
			.bookingEmailAll(data)
			.pipe(
				catchError((err) => {
					return throwError(err);
				})
			)
			.subscribe((response: any) => {
				console.log("response--------->>>>>>>>", response);
				this.spinner.hide();
				$("#emailAll").modal("hide");
			});
	}

	emailPassenger() {
		console.log(
			"In function email passenger",
			this.sendEmailForm.value.reservation_id
		);
		let data = {
			reservation_id: this.sendEmailForm.value.reservation_id,
		};
		this.spinner.show();
		this.adminService
			.passengerBooking(data)
			.pipe(
				catchError((err) => {
					return throwError(err);
				})
			)
			.subscribe((response: any) => {
				console.log("response--------->>>>>>>>", response);
				this.spinner.hide();
				$("#emailPassenger").modal("hide");
			});
	}
	auditTrail(bookingId: any) {
		console.log("In function audit trail", bookingId);
		this.spinner.show();
		this.adminService
			.auditTrailInfo(bookingId)
			.pipe(
				catchError((err) => {
					return throwError(err);
				})
			)
			.subscribe((response: any) => {
				this.spinner.hide();
				console.log("audit trail --->>>>>>>>", response);
				this.audit_Trail = response.data;
				$("#AuditTrailModal").modal("show");
				setTimeout(() => {
					const modalBody = document.querySelector('#AuditTrailModal .modal-body');
					if (modalBody) {
						modalBody.scrollTo({ top: modalBody.scrollHeight, behavior: 'smooth' });
					}
					// Also try the modal container itself if the body isn't the scroller
					const modal = document.querySelector('#AuditTrailModal');
					if (modal) {
						modal.scrollTo({ top: modal.scrollHeight, behavior: 'smooth' });
					}
				}, 500);
				// $("#AuditTrailModal").modal("hide");
			});
	}

	navigateToAffiliates(companyName: string) {
		if (companyName) {
			$('#previewBookingOnID').modal('hide');
			$('#sendEmailModal').modal('hide');
			localStorage.setItem('affiliateSearch', companyName);
			this.router.navigate(['/admin/affiliates/all-operators']);
		}
	}

	navigateToIndividualAccounts(passengerName: string) {
		if (this.currentUser?.roleName !== 'admin') return;
		if (passengerName) {
			$('#previewBookingOnID').modal('hide');
			$('#sendEmailModal').modal('hide');
			localStorage.setItem('individualSearch', passengerName);
			this.router.navigate(['/admin/individual-account-admin']);
		}
	}

	navigateToTravelAgentAccounts(taName: string) {
		if (this.currentUser?.roleName !== 'admin') return;
		console.log("tA", taName)
		if (taName) {
			$('#previewBookingOnID').modal('hide');
			$('#sendEmailModal').modal('hide');
			localStorage.setItem('TravelAgentSearch', taName);
			this.router.navigate(['/admin/travel-planner-account-admin']);
		}
	}

	navigateToLooseAffiliates(companyName: string) {
		if (companyName) {
			$('#previewBookingOnID').modal('hide');
			$('#sendEmailModal').modal('hide');
			localStorage.setItem('looseAffiliateSearch', companyName);
			this.router.navigate(['/admin/loose-affiliate-accounts']);
		}
	}


	async submit(message, format) {
		console.log("format", format)
		if (this.passengerDetails.selection_button == "Passenger") {
			this.sendInformation = format
				? this.passengerDetails.passenger_cell_isd +
				this.passengerDetails.passenger_cell
				: this.passengerDetails.passenger_email;
			this.reciptentName = this.passengerDetails.passenger_name;
		} else if (this.passengerDetails.selection_button == "Affiliate") {
			this.sendInformation = format
				? this.passengerDetails.affiliate_dispatch_isd +
				this.passengerDetails.affiliate_dispatch_number
				: this.passengerDetails.dispatchEmail;
			this.reciptentName =
				this.passengerDetails.driver_first_name +
				this.passengerDetails.driver_last_name;
		}
		else if (this.passengerDetails.selection_button == "created_by") {
			this.sendInformation = format ? this.passengerDetails.created_by_phone : this.passengerDetails.created_by_email
			this.reciptentName = this.passengerDetails.created_by_name
		}
		else {
			this.sendInformation = format
				? (this.passengerDetails.loose_affiliate_phone_isd ? this.passengerDetails.loose_affiliate_phone_isd : '+1') +
				(this.passengerDetails.loose_affiliate_phone ? this.passengerDetails.loose_affiliate_phone : '8005466266')
				: (this.passengerDetails.loose_affiliate_email ? this.passengerDetails.loose_affiliate_email : 'info@1800limo.com');
			this.reciptentName = (this.passengerDetails.loose_affiliate_name ? this.passengerDetails.loose_affiliate_name : '1800Limo Chauffeurs');
		}
		let fileData = []
		if (this.uploadedFile) {
			for (let file of this.uploadedFile) {
				let dataS = await this.uploadService.uploadFile(file);
				fileData.push({
					fileUrl: dataS.Location,
					fileType: file.type
				});
			}
		}

		let obj = {
			bookingId: this.passengerDetails.booking_id,
			reciptentName: this.reciptentName,
			sendTo: this.passengerDetails.selection_button,
			sendThrough: format ? "Phone" : "Email",
			sendValue: this.sendInformation,
			sendContent: message,
			fileData: fileData
		};
		this.adminService
			.adminNotification(obj)
			.pipe(
				catchError((err) => {
					this.spinner.hide();
					return throwError(err);
				})
			)
			.subscribe(({ message }: any) => {
				this.spinner.hide();
				this.notification_msg = message;
				$('#successModal').modal('show')
				this.successMessage = message
				setTimeout(() => {
					$('#successModal').modal('hide')
				}, 2000)
				console.log(message);
				$("textarea").val("");
				this.editorContent = '';
			});

		// Clear file input after success
		this.uploadedFile = null;
		this.fileUrl = null;
		this.fileType = null;
		if (this.fileInput) {
			this.fileInput.nativeElement.value = ''; // Reset file input
		}

		$("#closeModal").click(() => {
			this.fileInput.nativeElement.value = '';
			this.uploadedFile = null;
			this.fileType = null;
			this.fileUrl = null;
			$("#notificationModal").modal("hide");
		});
		$("#closeModal1").click(() => {
			$("#notificationModal").modal("hide");
		});
		$("#sendEmailModal").modal("hide");
		this.message.nativeElement.value = "";
		this.show = false;
	}

	cancelSubscription() {
		this.spinner.show()
		let data = {
			account_id: this.currentUser?.account_id
		}
		this.adminService
			.cancelSubscription(data)
			.pipe(
				catchError((err) => {
					this.spinner.hide()
					return throwError(err);
				})
			)
			.subscribe((response: any) => {
				this.spinner.hide()
				$('#successModal').modal('show')
				this.successMessage = 'Your subscription have been cancelled successfully'
				setTimeout(() => {
					$('#successModal').modal('hide')
				}, 2000)
				this.isCancelled = true
				$("#cancelModal").modal("hide");
			});
	}


	closeModal() {
		// this.sendEmailModal.nativeElement.querySelector('textarea').blur();
		$("#sendEmailModal").modal("hide");
		this.message.nativeElement.value = "";
		this.fileInput.nativeElement.value = '';
		this.uploadedFile = null;
		this.fileType = null;
		this.editorContent = '';
		this.fileUrl = null;
		this.show = false;
		// this.sendEmailModal.nativeElement.querySelector('textarea').focus();
	}

	scroll(id) {
		// let el = document.getElementById(id);
		// let elementRect = el.getBoundingClientRect();
		// let absoluteElementTop = elementRect.top + window.pageYOffset;
		// let topElement = absoluteElementTop - 200;

		// console.log(`scrolling to ${id}`, el , absoluteElementTop ,window.innerHeight);
		// window.scrollTo({
		// 	top: topElement,
		// 	behavior: 'smooth'
		// });

		let el = document.getElementById(id);
		console.log(`scrolling to ${id}`, el);
		el.scrollIntoView({ behavior: 'smooth' });
	}

	noError: boolean = false;
	loadBookings(
		pageUrl = null,
		start_date: Date | null, // Changed to Date
		end_date: Date | null, // Changed to Date
		search_value: string = "",
		status: any = null,
		includeDatesInPayload: boolean = false
	) {
		if (pageUrl) {
			console.log("pageurl", pageUrl)
			this.scroll('daily_bookings_table')
		}

		const fallbackStartDate = start_date ? dayjs(start_date) : dayjs();
		const fallbackEndDate = end_date ? dayjs(end_date) : dayjs().add(7, "day");
		const shouldSendDates = includeDatesInPayload || this.useDateFilter || !!search_value?.trim();
		const startDateStr = shouldSendDates
			? fallbackStartDate.format('YYYY-MM-DD')
			: fallbackStartDate.format('YYYY-MM-DD');
		const endDateStr = shouldSendDates
			? fallbackEndDate.format('YYYY-MM-DD')
			: fallbackEndDate.format('YYYY-MM-DD');

		search_value == "" && this.spinner.show();
		this.noError = false;
		// Load Our bookings using API

		if (this.currentUser.created_by_role == 'admin') {
			this.adminService
				.loadBookings(
					pageUrl,
					startDateStr,
					endDateStr,
					this.useDateFilter,
					search_value ?? "",
					this.orderBy,
					'', // Don't pass status to backend
					this.listFilter(),
				)
				.then((result: any) => {
					if (result?.data?.reservations?.data == 0) {
						this.noError = true;
					}
					this.bookingsRes = result;
					// Only sent for tab requests; keep the last badges while searching.
					this.tabCounts = this.bookingsRes?.data?.tab_counts ?? this.tabCounts;
					this.bookings_Original = this.bookingsRes?.data?.reservations?.data || [];
					this.sortBookings();
					this.filterBookingsByStatus();
					this.total_amount = this.bookingsRes?.data?.total_amount
					this.admin_total = this.bookingsRes?.data?.admin_total
					this.totalRecords = this.bookingsRes.data?.reservations?.total;
					this.firstPage = 1;
					this.lastPage = this.bookingsRes.data?.reservations?.last_page;
					this.totalPage = this.bookingsRes.data?.reservations?.last_page;
					this.currentPage = this.bookingsRes.data?.reservations?.current_page;
					this.from = this.bookingsRes.data?.reservations?.from;
					this.to = this.bookingsRes.data?.reservations?.to;
					this.path = this.bookingsRes.data?.reservations?.path;
					this.firstPageUrl = this.bookingsRes.data?.reservations?.first_page_url;
					this.lastPageUrl = this.bookingsRes.data?.reservations?.last_page_url;
					this.prevPageUrl = this.bookingsRes.data?.reservations?.prev_page_url;
					this.nextPageUrl = this.bookingsRes.data?.reservations?.next_page_url;
					this.subModules = localStorage.getItem("sub_modules") || "";
					this.spinner.hide();
				});
		}
		else {
			this.adminService
				.loadFarmInBookings(
					pageUrl,
					startDateStr,
					endDateStr,
					this.useDateFilter,
					search_value ?? "",
					this.orderBy,
					'',
					this.listFilter(),
				)
				.then((result: any) => {
					if (result?.data?.reservations?.data == 0) {
						this.noError = true;
					}
					this.bookingsRes = result;
					// Only sent for tab requests; keep the last badges while searching.
					this.tabCounts = this.bookingsRes?.data?.tab_counts ?? this.tabCounts;
					this.bookings_Original = this.bookingsRes?.data?.reservations?.data || [];
					this.sortBookings();
					this.filterBookingsByStatus();
					this.totalRecords = this.bookingsRes.data?.reservations?.total;
					this.total_amount = this.bookingsRes?.data?.total_amount
					this.admin_total = this.bookingsRes?.data?.admin_total
					this.firstPage = 1;
					this.lastPage = this.bookingsRes.data?.reservations?.last_page;
					this.totalPage = this.bookingsRes.data?.reservations?.last_page;
					this.currentPage = this.bookingsRes.data?.reservations?.current_page;
					this.from = this.bookingsRes.data?.reservations?.from;
					this.to = this.bookingsRes.data?.reservations?.to;
					this.path = this.bookingsRes.data?.reservations?.path;
					this.firstPageUrl = this.bookingsRes.data?.reservations?.first_page_url;
					this.lastPageUrl = this.bookingsRes.data?.reservations?.last_page_url;
					this.prevPageUrl = this.bookingsRes.data?.reservations?.prev_page_url;
					this.nextPageUrl = this.bookingsRes.data?.reservations?.next_page_url;
					this.subModules = localStorage.getItem("sub_modules") || "";
					this.spinner.hide();
				});
		}


	}

	handleShowMore(
		pageUrl = null,
		start_date: Date | null, // Changed to Date
		end_date: Date | null, // Changed to Date
		search_value: string = "",
		status: any = null,
		includeDatesInPayload: boolean = false
	) {
		const fallbackStartDate = start_date ? dayjs(start_date) : dayjs();
		const fallbackEndDate = end_date ? dayjs(end_date) : dayjs().add(7, "day");
		const shouldSendDates = includeDatesInPayload || this.useDateFilter || !!search_value?.trim();
		const startDateStr = shouldSendDates
			? fallbackStartDate.format('YYYY-MM-DD')
			: fallbackStartDate.format('YYYY-MM-DD');
		const endDateStr = shouldSendDates
			? fallbackEndDate.format('YYYY-MM-DD')
			: fallbackEndDate.format('YYYY-MM-DD');

		search_value == "" && this.spinner.show();
		this.noError = false;
		// Load Our bookings using API
		this.adminService
			.loadBookings(
				pageUrl,
				startDateStr,
				endDateStr,
				this.useDateFilter,
				search_value ?? "",
				this.orderBy,
				'',
				this.listFilter(),
			)
			.then((result: any) => {
				if (result?.data?.reservations?.data == 0) {
					this.noError = true;
				}
				this.bookingsRes = result;
				this.bookings_Original = this.bookings_Original.concat(
					this.bookingsRes.data?.reservations?.data || []
				);
				this.sortBookings();
				this.filterBookingsByStatus();
				this.total_amount = this.bookingsRes?.data?.total_amount
				this.admin_total = this.bookingsRes?.data?.admin_total
				this.totalRecords = this.bookingsRes.data?.reservations?.total;
				this.firstPage = 1;
				this.lastPage = this.bookingsRes.data?.reservations?.last_page;
				this.totalPage = this.bookingsRes.data?.reservations?.last_page;
				this.currentPage = this.bookingsRes.data?.reservations?.current_page;
				this.from = this.bookingsRes.data?.reservations?.from;
				this.to = this.bookingsRes.data?.reservations?.to;
				this.path = this.bookingsRes.data?.reservations?.path;
				this.firstPageUrl = this.bookingsRes.data?.reservations?.first_page_url;
				this.lastPageUrl = this.bookingsRes.data?.reservations?.last_page_url;
				this.prevPageUrl = this.bookingsRes.data?.reservations?.prev_page_url;
				this.nextPageUrl = this.bookingsRes.data?.reservations?.next_page_url;
				this.spinner.hide();
			});
	}

	show = false;
	openModal(booking: any, selection_button: string) {
		console.log('Double-click detected, opening modal for:', booking);
		$("#sendEmailModal").modal("show");
		// try {
		// 	setTimeout(() => {
		// 		// $('textarea').attr('autofocus', 'autofocus');
		// 		this.sendEmailModalFocus.nativeElement.querySelector("textarea").focus();
		// 		//add default message in the textarea
		// 		this.message.nativeElement.value = 'Hi, Please check your email for new bookings. Click Accept/Reject. Thanks, Text Joe at 7082056607 with any questions.';
		// 		this.sendEmailForm.patchValue({ text_message: this.message.nativeElement.value });
		// 		this.editorContent = 'Hi, Please check your email for new bookings. Click Accept/Reject. Thanks, Text Joe at 7082056607 with any questions.';
		// 	}, 1000);
		// } catch (error) {
		// 	console.log("----------error------->>>>>> ", error);
		// }
		console.log("passenger details", booking, selection_button)
		this.passengerDetails = booking;
		this.passengerDetails["selection_button"] = selection_button;
	}
	
	async copyPreviewText() {
		// 1) Prepare text: convert <br> to newlines, strip tags (or keep as needed)
		const plainText = (this.previewCopyData || '')
			.replace(/<br\s*\/?>/gi, '\n')   // convert <br> -> newline
			.replace(/<\/?b>/gi, '')        // remove <b> tags
			.replace(/&nbsp;/gi, ' ');      // optional: handle HTML entities

		// 2) Try navigator.clipboard first (works on secure contexts and modern browsers)
		try {
			if (navigator.clipboard && navigator.clipboard.writeText) {
				await navigator.clipboard.writeText(plainText);
				// this.showCopiedToast(); // or alert('Copied!');
				this.showCopyIcon = true
				console.log("in function copy link to clipboard")
				setTimeout(() => {
					this.showCopyIcon = false
				}, 2500)
				return;
			}
		} catch (err) {
			// ignore and fallback
			console.warn('navigator.clipboard.writeText failed:', err);
		}

	}


	showCopiedToast() {
		alert('Copied to clipboard!');
	}



	convertToMinutes(value) {
		const days = Math.floor(value / (24 * 60 * 60));
		const remainingSeconds = value % (24 * 60 * 60);
		const hours = Math.floor(remainingSeconds / (60 * 60));
		const remainingMinutes = Math.floor((remainingSeconds % (60 * 60)) / 60);

		let result = "";

		if (days > 0) {
			result += `${days} days, `;
		}

		if (hours > 0 || (days === 0 && hours === 0)) {
			result += `${hours} hours, `;
		}

		result += `${remainingMinutes} minutes`;

		return result;
	}
	mToMi(distance: number): string {
		return (distance / 1609).toFixed(2);
	}

	mToKm(distance: number): string {
		return (distance / 1000).toFixed(2);
	}
	//for pagination
	counter() {
		var currentPage;
		var startFrom;
		var endTo;

		if (this.currentPage as number < 5) {
			startFrom = 0;
			endTo = this.totalPage;
		} else if (this.currentPage < this.totalPage) {
			currentPage = this.currentPage;
			endTo = currentPage + 1;
			startFrom = endTo - 5;
		} else {
			endTo = this.totalPage;
			startFrom = endTo - 5;
		}

		var i;
		var udpArr = new Array();
		for (i = startFrom; i < endTo; i++) {
			udpArr.push(i + 1);
		}
		return udpArr;
	}

	changeDate(dateType, date: Date) { // $event is now Date
		console.log("---------__>>>>>>", dateType, date);
		if (!date) {
			return;
		}

		if (dateType == 'startDate') {
			this.startDate = dayjs(date).startOf('day').toDate();
			if (this.endDate && dayjs(this.startDate).isAfter(this.endDate, "day")) {
				this.endDate = dayjs(this.startDate).toDate();
				this.saveCookie('admin_endDate', this.endDate);
			}
			this.saveCookie('admin_startDate', this.startDate);
		} else {
			this.endDate = dayjs(date).startOf('day').toDate();
			if (this.startDate && dayjs(this.endDate).isBefore(this.startDate, "day")) {
				this.endDate = dayjs(this.startDate).toDate();
			}
			this.saveCookie('admin_endDate', this.endDate);
		}

		this.selectedDateRange = {
			startDate: dayjs(this.startDate),
			endDate: dayjs(this.endDate)
		};

		if (this.useDateFilter) {
			this.runBookingsSearch();
		}
	}
	fomatAffiliateType(type: any) {
		if (type == "taxi_operator") {
			return "T";
		} else if (type == "fleet_operator") {
			return "F";
		} else if (type == "black_limo_operator") {
			return "I/O";
		} else if (type == "gig_operator") {
			return "G";
		} else if (type == 'subscriber') {
			return "S";
		}
	}
	enableDisableClicked(event, id) {
		this.spinner.show(); //show spinner
		console.log(event.checked);
		if (event.checked) {
			var status = "enable";
		} else {
			var status = "disable";
		}
		this.adminService
			.reservationStatus(id, status)
			.pipe(
				catchError((err) => {
					this.spinner.hide(); //hide spinner
					return throwError(err);
				})
			)
			.subscribe((result) => {
				this.spinner.hide(); //hide spinner
			});
	}

	get changeStatusF() {
		return this.changeStatusForm.controls;
	}

	changeBookingStatus(bookingId, bookingStatus?: string) {
		// Booking status cannot be updated once it is Paid or Paid Cash.
		if (bookingStatus === "paid" || bookingStatus === "paid_cash") {
			return;
		}
		this.changeStatusForm.patchValue({
			reservation_id: bookingId,
		});
		setTimeout(() => {
			this.select.open();
		}, 600);
	}


	submitChangeStatusForm() {
		this.submitted = true;
		console.log(this.changeStatusForm);
		// stop here if form is invalid
		if (this.changeStatusForm.invalid) {
			return;
		}

		this.spinner.show();
		// this.disableSubmitButton=true; //disable submit button

		this.adminService
			.changeStatusBooking(this.changeStatusForm.value)
			.pipe(
				catchError((err) => {
					this.spinner.hide(); //hide spinner
					$("#change_status_booking_Modal").modal("hide");
					return throwError(err);
				})
			)
			.subscribe(({ data, success, message }: any) => {
				if (success == true) {
					$("#change_status_booking_Modal").modal("hide");
					this.loadBookings(
						null,
						this.startDate,
						this.endDate,
						this.searchText,
						this.selectedStatus
					);
					// this.router
					// 	.navigateByUrl("/RefreshComponent", {
					// 		skipLocationChange: true,
					// 	})
					// 	.then(() =>
					// 	{
					// 		this.router.navigate([
					// 			"/admin/daily-bookings-admin",
					// 		]);
					// 	});
				}
			});
	}

    sendEmailClicked(bookingId, emailTarget, showChangedFields = false, bookingStatus = '') {
        console.log('in func send email click', bookingId, emailTarget)
        this.selectedEmailBookingShowChangedFields = !!showChangedFields;
        this.selectedEmailBookingStatus = bookingStatus || '';
        this.sendEmailForm.patchValue({
            reservation_id: bookingId,
            emailTarget: emailTarget,
        });
        const modalMap = {
            affiliate: '#emailModal',
            emailPassenger: '#emailPassenger',
            emailAll: '#emailAll',
            updatedEmailAll: '#updatedEmailAll',

        };
        const modalId = modalMap[emailTarget];
        if (modalId) {
            $(modalId).modal('show');
        }
    }

	sendEmaiManuallClicked(bookingId) {
		console.log('in func send email click', bookingId)
		this.sendEmailForm.patchValue({
			reservation_id: bookingId,
		});
		const modalId = '#sendEmailToAnyone';
		$(modalId).modal('show');
	}

	get Form() {
		return this.sendEmailForm.controls;
	}

	emailForm() {
		this.submitted = true;
		console.log(this.sendEmailForm);
		// stop here if form is invalid
		if (this.sendEmailForm.invalid) {
			return;
		}

		this.spinner.show();
		// this.disableSubmitButton=true; //disable submit button

		this.adminService
			.sendEmail(this.sendEmailForm.value)
			.pipe(
				catchError((err) => {
					this.spinner.hide(); //hide spinner
					$("#emailModal").modal("hide");
					return throwError(err);
				})
			)
			.subscribe(({ data, success, message }: any) => {
				if (success == true) {
					this.spinner.hide(); //hide spinner
					$("#emailModal").modal("hide");
					$('#successModal').modal('show')
					this.successMessage = 'Email have been sent successfully'
					setTimeout(() => {
						$('#successModal').modal('hide')
					}, 2000)
					// this.router
					// 	.navigateByUrl("/RefreshComponent", {
					// 		skipLocationChange: true,
					// 	})
					// 	.then(() => {
					// 		this.router.navigate([
					// 			"/admin/daily-bookings-admin",
					// 		]);
					// 	});
				}
			});
	}

	FormatDate(date: string) {
		const m = moment(date);
		if (m.isSame(moment(), 'day')) {
			return 'Today';
		}
		return m.format("ll");
	}

	FormatTime(time: string) {
		return moment(time, "HH:mm:ss").format("LT");
	}

	showAccountType(value) {
		if (value == "individual") {
			return "(IN)";
		} else if (value == "travel_planner") {
			return "(TA)";
		}
	}

	dateFormat(value: any) {
		return moment(value).format("ll"); // Adjusted for Date input
	}

	dateFormat2(value: any) {
		return moment(value).format("L"); // Adjusted for Date input
	}

	dateFormatToDay(value: any) {
		return moment(value).format('dddd'); // Adjusted for Date input
	}


	timeFormat(value: any) {
		if (value.toUpperCase() == "12:00 AM") {
			return "0000 h";
		}
		let hours = moment(moment(value, "hh:mm a").format("HH"), "HH").hours();
		let mins = moment(value, "hh:mm a").minutes().toString();
		if (Number(mins) == 0 || Number(mins) < 10) {
			mins = "0" + mins.toString();
		}

		return hours < 10
			? "0" + hours.toString() + mins.toString() + " h"
			: hours.toString() + mins.toString() + " h";
		//return value.replace(':', '').substring(0, 5) + 'h';
	}

	timeFormat2(value: string) {
		return moment(value, "HH:mm a").format("h:mm a");
	}

	textFormatter(text: string) {
		try {
			// Convert to lowercase for consistent matching
			const normalized = text.toLowerCase();

			// Hardcoded replacements
			if (normalized === 'oneway') return 'One way';
			if (normalized === 'chartertour') return 'Charter tour';

			return text.replace(/[\\\_$]+/g, " ");
		} catch {
			return text;
		}
	}
	formatPhoneNumber(ph: any) {
		if (!ph.includes("+")) {
			return "+" + ph;
		}
		return ph;
	}
	formatText(text) {
		return text.replaceAll("_", " ");
	}

	extractTextFromHtml(html: string): string {
		const div = document.createElement('div');
		div.innerHTML = html;

		// Convert paragraph tags to newline
		const paragraphs = div.querySelectorAll('p');
		paragraphs.forEach(p => {
			p.innerHTML += '\n';
		});

		// Replace break tags with new lines
		const breaks = div.querySelectorAll('br');
		breaks.forEach(br => {
			br.outerHTML = '\n';
		});

		// Convert bold tags to uppercase text
		const bolds = div.querySelectorAll('b');
		bolds.forEach(b => {
			b.innerHTML = `${b.innerHTML}`;
		});

		// Return the inner HTML as plain text with preserved formatting
		return div.innerText || div.textContent || '';
	}

	closePreview() {
		$('#previewBookingOnID').modal('hide');
	}

	bookingPreview: any;
	showBookingPreviewModal(booking_id: number) {
		this.bookingPreviewModal.openPreview(booking_id, 'admin');
	}

	// numbers in red and seperated to next line
	highlightNumbers(text: string): string {
		const parts = text.split(/\b(\d+\.\s)/); // Split by number followed by dot and space

		// Process parts and apply formatting
		let formattedText = '';
		for (let i = 0; i < parts.length; i++) {
			if (i % 2 === 0) {
				formattedText += parts[i]; // Regular text part
			} else {
				formattedText += `<span class="text-danger font-weight-bolder">${parts[i]}</span>`; // Numbered instruction part
			}
		}

		return formattedText;
	}

	// Resolve the sort order based on the search box state.
	// Empty search box -> keep the previous behaviour (saved/default ordering).
	// Non-empty search box -> always show results in descending order by pickup date.
	applySearchOrdering() {
		if (this.searchText?.trim()) {
			this.orderBy = "pickup_date_desc";
		} else {
			// The table re-sorts client-side; keep Past newest-first like the API returns it.
			this.orderBy = localStorage.getItem("orderByCreatedAt") ||
				(this.listTab == 'past' ? "pickup_date_desc" : "pickup_date_asc");
		}
	}

	timer: any;
	runBookingsSearch(searchValue: string = this.searchText) {
		this.searchText = searchValue ?? "";
		localStorage.setItem("DBSearch", this.searchText);
		this.applySearchOrdering();
		if (this.startDate) {
			this.saveCookie("admin_startDate", this.startDate);
		}
		if (this.endDate) {
			this.saveCookie("admin_endDate", this.endDate);
		}
		this.loadBookings(
			null,
			this.startDate,
			this.endDate,
			this.searchText?.replace(/&/g, '%26'),
			this.selectedStatus
		);
   }

	/** Search button / Enter: skip the typing debounce. */
	submitSearch(search_value: string) {
		clearTimeout(this.timer);
		this.runBookingsSearch(search_value);
	}

	searchInBookings(search_value: string) {
		this.searchText = search_value ?? "";
		console.log("--->>>>>", search_value);
		clearTimeout(this.timer);
		this.timer = setTimeout(() => {
			localStorage.setItem("DBSearch", this.searchText);
			this.applySearchOrdering();
			if (this.startDate) {
				this.saveCookie("admin_startDate", this.startDate);
			}
			if (this.endDate) {
				this.saveCookie("admin_endDate", this.endDate);
			}
			this.loadBookings(
				null,
				this.startDate,
				this.endDate,
				this.searchText?.replace(/&/g, '%26'),
				this.selectedStatus
			);
		}, 1200);
	}

	handleKeypressEvents() {
		clearTimeout(this.timer);
	}

	formatBaseRate(baseRate: string | number): string {
		// Convert baseRate to a number if it is a string
		const numericValue = typeof baseRate === 'string' ? parseFloat(baseRate) : baseRate;

		// Check if numericValue is a valid number
		if (!isNaN(numericValue)) {
			return numericValue.toFixed(2);
		}

		// Return a default value or an empty string if baseRate is not a valid number
		return '0.00';
	}

	saveCookie(key: string, value: any) { // Adjusted to handle Date
		// Convert Date to string before saving
		const valueStr = value instanceof Date ? moment(value).format('YYYY-MM-DD') : value;
		// this.adminService.setCookie(key, value, 30);
		localStorage.setItem(key, valueStr);
	}

	// changeFilterType(value: string) {
	// 	console.log(value)
	// 	this.filtertype = value
	// 	this.saveCookie('filtertype', this.filtertype);
	// 	this.loadBookings(null, this.startDate, this.endDate, this.searchText, this.filtertype);
	// }
	iOS() {
		return (
			[
				"iPad Simulator",
				"iPhone Simulator",
				"iPod Simulator",
				"iPad",
				"iPhone",
				"iPod",
			].includes(navigator.platform) ||
			// iPad on iOS 13 detection
			(navigator.userAgent.includes("Mac") && "ontouchend" in document)
		);
	}

	showLocationPointOnMap(booking_id: number, type: string) {
		// const options = {
		// 	enableHighAccuracy: true,
		// 	timeout: 5000,
		// 	maximumAge: 0,
		// };
		// let q: any
		// function success(pos) {
		// 	const crd = pos.coords;
		// 	q = crd
		// 	console.log("Your current position is:");
		// 	console.log(`Latitude : ${crd.latitude}`);
		// 	console.log(`Longitude: ${crd.longitude}`);
		// 	console.log(`More or less ${crd.accuracy} meters.`);
		// }

		// function error(err) {
		// 	console.warn(`ERROR(${err.code}): ${err.message}`);
		// }

		// await navigator.geolocation.getCurrentPosition(success, error, options)

		// if (navigator.geolocation) {
		// 	navigator.geolocation.getCurrentPosition(function (position) {
		// 		var currentLocation =	CURRENT_LAT +","+CURRENT_LONG;
		// 	})
		// 	}

		let isSafari = /^((?!chrome|android).)*safari/i.test(
			navigator.userAgent
		);
		console.log("isSafari", isSafari);
		this.spinner.show();
		this.adminService
			.getLocationPoints(booking_id)
			.subscribe((response: any) => {
				this.spinner.hide();
				if (
					"lat" in response?.data?.pickupDetail &&
					"long" in response?.data?.pickupDetail &&
					"lat" in response?.data?.dropoffDetail &&
					"long" in response?.data?.dropoffDetail
				) {
					sessionStorage.setItem(
						"pickup",
						JSON.stringify(response?.data?.pickupDetail.address)
					);
					sessionStorage.setItem(
						"dropoff",
						JSON.stringify(response?.data?.dropoffDetail.address)
					);
					let googleDirectionUrl;
					let iosDirectionUrl;
					if (type == "pickup") {
						googleDirectionUrl =
							"https://www.google.com/maps/dir/?api=1" +
							"&destination=" +
							encodeURIComponent(
								response?.data?.pickupDetail.address
							) +
							"&travelmode=driving";
						iosDirectionUrl =
							"http://maps.apple.com/?daddr=" +
							encodeURIComponent(
								response?.data?.pickupDetail.address
							);
					} else {
						googleDirectionUrl =
							"https://www.google.com/maps/dir/?api=1" +
							"&destination=" +
							encodeURIComponent(
								response?.data?.dropoffDetail.address
							) +
							"&travelmode=driving";
						iosDirectionUrl =
							"http://maps.apple.com/?daddr=" +
							encodeURIComponent(
								response?.data?.dropoffDetail.address
							);
					}
					if (this.iOS()) {
						setTimeout(() => {
							window.location.href = iosDirectionUrl;
						});
					} else {
						window.open(googleDirectionUrl, "_blank");
					}
				} else {
					throw new Error(
						"Error: Location Points Not Specified Properly. "
					);
				}
			});
	}

	showLocationPointOnMapByAddress(address: any) {
		let isSafari = /^((?!chrome|android).)*safari/i.test(
			navigator.userAgent
		);
		console.log("isSafari", isSafari);
		if (address) {
			let googleDirectionUrl;
			let iosDirectionUrl;
			googleDirectionUrl =
				"https://www.google.com/maps/dir/?api=1" +
				"&destination=" +
				encodeURIComponent(address) +
				"&travelmode=driving";
			iosDirectionUrl =
				"http://maps.apple.com/?daddr=" + encodeURIComponent(address);
			if (this.iOS()) {
				setTimeout(() => {
					window.location.href = iosDirectionUrl;
				});
			} else {
				window.open(googleDirectionUrl, "_blank");
			}
		} else {
			throw new Error("Error: Location Points Not Specified Properly. ");
		}
	}
	async reAffiliate(booking_id) {
		console.log("in functiuon reaffiliate", booking_id);
		this.spinner.show();
		await this.getQuoteDetails(booking_id);
	}

	getQuoteDetails(id) {
		this.adminService.getQuoteData(id).subscribe((response: any) => {
			console.log("in function get quote data", response.data.quote.location_info);
			this.quotebotNewData = response.data?.quote;

			// let location_info = [];
			// let tempObj = {
			// 	distance: {
			// 		text: this.quotebotNewData?.distance / 1000 + "km",
			// 		value: Number(this.quotebotNewData?.distance),
			// 	},
			// 	duration: {
			// 		text: this.quotebotNewData?.duration / 60 + "mins",
			// 		value: Number(this.quotebotNewData?.duration),
			// 	},
			// };
			// location_info.push(tempObj);
			// this.quotebotNewData["location_info"] = location_info;
			console.log("in location->", response.data?.quote);
			localStorage.setItem(
				"quotebot_form",
				JSON.stringify(response.data?.quote)
			);
			// this.router.navigate(['quotebot/select-vehicle'], { queryParams: { id } });
			// this.Sort.LowToHigh() // default sort to Low-High
			// this.spinner.hide()
		});
		this.adminService.getFilterData(id).subscribe((response: any) => {
			console.log("in function get filter data", response);
			let filters = {
				original: response?.data?.original,
				copy: response?.data?.copy,
				request: response?.data?.request,
				selections: response?.data?.selections,
				vars: response?.data?.vars,
			};

			sessionStorage.setItem('filters', JSON.stringify(filters))
			this.router.navigate(['quotebot/select-vehicle'], { queryParams: { id } });
			// this.Sort.LowToHigh() // default sort to Low-High
			this.spinner.hide();
		});
	}

	searchOnGoogle(query: string) {
		console.log("in search google", query)
		if (query) {
			const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
			window.open(url, '_blank'); // Opens the search in a new tab
		}
	}

	acceptChargeClick(id) {
		this.accept_charge_id = id
		$("#accept_charge_modal").modal("show");
	}

	accpetChargeAction() {
		this.spinner.show()
		let data = { reservation_id: this.accept_charge_id }
		this.adminService
			.acceptCharge(data)
			.pipe(catchError(err => throwError(err)))
			.subscribe((response: any) => {
				this.spinner.hide();
				$("#accept_charge_modal").modal("hide");
				$('#successModal').modal('show')
				this.successMessage = 'Half payment have been charged successfully'
				setTimeout(() => { $('#successModal').modal('hide') }, 2000)

				// ✅ Just assign booking_status from API response
				const index = this.bookings_Original.findIndex(
					b => b.booking_id == this.accept_charge_id
				);
				if (index !== -1) {
					this.bookings_Original[index].booking_status = response?.data?.reservation_details?.booking_status;
					this.bookings_Original[index].charged_amount = response?.data?.reservation_details?.charged_amount;
				}
				this.filterBookingsByStatus();
			});
	}

	chargeBackAction() {
		this.spinner.show()
		let data = {
			reservation_id: this.accept_charge_id
		}
		this.adminService
			.chargeBack(data)
			.pipe(
				catchError((err) => {
					return throwError(err);
				})
			)
			.subscribe((response: any) => {
				this.spinner.hide();
				$("#charge_back_modal").modal("hide");
				$('#successModal').modal('show')
				this.successMessage = 'Payment have been charged back successfully'
				setTimeout(() => {
					$('#successModal').modal('hide')
				}, 2000)
				console.log("accept charge action", response);
			});

	}

	addBank() {
		this.router.navigate(['/admin/add-bank-details'])
	}

	// redirect to client cards page
	viewClientCardAction(id) {
		this.router.navigate([`/admin/cards`], { queryParams: { accountType: 'individual', accountId: id } });
	}

	// redirect to refund url
	refundAction(url) {
		window.open(url, '_blank'); // Opens the search in a new tab
	}

	myUploader(event) {
		// this.loader = true;

		this.uploadedFile = Array.from(event.target.files)
		console.log("file", this.uploadedFile)
		// if (this.uploadedFile) {
		// 	this.fileName = this.uploadedFile['name'];
		// 	this.fileType = this.uploadedFile['type'];
		// 	console.log("file", this.fileName, this.fileType)
		// }
	}

	sendEmailToAnyone() {
		const emailTargetControl = this.sendEmailForm.get('emailTarget')!;
		if (!emailTargetControl.value) {
			emailTargetControl.markAsTouched();
			return;
		}

		let body = {
			id: this.sendEmailForm.get('reservation_id').value,
			email: this.sendEmailForm.get('emailTarget').value

		}
		this.spinner.show()
		this.adminService
			.sendEmailToanyone(body)
			.pipe(
				catchError((err) => {
					this.spinner.hide(); //hide spinner
					$("#sendEmailToAnyone").modal("hide");
					return throwError(err);
				})
			)
			.subscribe(({ data, success, message }: any) => {
				if (success == true) {
					this.spinner.hide(); //hide spinner
					$("#sendEmailToAnyone").modal("hide");
					$('#successModal').modal('show')
					this.successMessage = 'Email have been sent successfully'
					setTimeout(() => {
						$('#successModal').modal('hide')
					}, 2000)
				}
			});

	}

	// Method to convert hours to days and hours
	getCancellationTime(cancellationHours: number): string {
		if (cancellationHours > 24) {
			const days = Math.floor(cancellationHours / 24);
			const remainingHours = cancellationHours % 24;
			return `${days} days ${remainingHours} hours`;
		} else {
			return `${cancellationHours} hours`;
		}
	}


	editAction(booking_id, booking_status, focusSection?: string) {
		if (booking_status != 'paid' && booking_status != 'paid_cash') {
			const queryParams: any = { bookingId: booking_id, updateType: 'edit' };
			if (focusSection) {
				queryParams.focus = focusSection;
			}
			this.router.navigate(['/admin/new-booking-v2'], { queryParams, fragment: focusSection });
		}
	}
}