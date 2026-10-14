import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { BookingTabCounts } from '../../shared/bookings-header/bookings-header.component';
import { AffiliateService } from '../../../services/affiliate.service';
import { Router } from '@angular/router';
import { NgxSpinnerService } from "ngx-spinner";
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { ThemePalette } from '@angular/material/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import * as moment from 'moment';
import { ErrorDialogService } from '../../../services/error-dialog/errordialog.service';
import { StateManagementService } from '../../../services/statemanagement.service';
import { GoogleMap } from '@angular/google-maps';
import { UploadService } from 'src/app/services/upload.service';
declare var $: any;

@Component({
	selector: 'app-my-bookings',
	templateUrl: './my-bookings.component.html',
	styleUrls: ['./my-bookings.component.scss']
})
export class MyBookingsComponent implements OnInit {
	@ViewChild('bookingPreviewModal') bookingPreviewModal: any;
	@ViewChild('inputmsg', { static: false }) message: ElementRef;
	@ViewChild('fileInput') fileInput!: ElementRef;


	color: ThemePalette = 'accent';
	outputDateFormat = 'YYYY-MM-DD';
	public totalRecords: any;
	public firstPage: Number;
	public lastPage: Number;
	public totalPage: Number;
	public currentPage: any;
	public from: Number;
	public to: Number;
	public path: string;
	public firstPageUrl: string;
	public lastPageUrl: string;
	public prevPageUrl: string;
	public nextPageUrl: string;
	public bookingsRes: any;
	public bookings: any;
	public bookingStatusColor: string;
	public startDate: string;
	public endDate: string;
	public date: Date;
	public changeStatusForm: FormGroup;
	public sendEmailForm: FormGroup;
	public submitted: boolean = false;
	passengerDetails: any;
	sendMessageField: boolean;
	sendInformation: any;
	reciptentName: any;
	notification_msg: any;
	noError: boolean = false;
	searchText: string = "";
	timer: any

	audit_Trail: any;
	current: any = JSON.parse(localStorage.getItem('currentUser'));
	company_name: string = this.current?.affiliate_company || this.current?.name || '';
	cancelBookingId: any = null
	useDateFilter: boolean = false;
	// Upcoming / Past / Custom tabs (Custom = the date-range pickers), plus the
	// driver-side "Needs action" queue of upcoming bookings awaiting accept/reject.
	listTab: string = 'upcoming';
	tabCounts: BookingTabCounts | null = null;
	showNeedsAction: boolean = false;
	needsActionCount: number = 0;
	currencySymbol: any;
	currentUser: any;
	vehiclesRes: any;
	numberOfVehicles: any;
	total_amount: any;
	net_total_amount: any;
	uploadedFile: any;
	fileUrl: String;
	fileName: String;
	fileType: String;

	constructor(
		private affiliateService: AffiliateService,
		private router: Router,
		private spinner: NgxSpinnerService,
		private $errors: ErrorDialogService,
		private stateManagementService: StateManagementService,
		private formBuilder: FormBuilder,
		private uploadService: UploadService,
	) { }

	ngOnInit(): void {

		this.currentUser = JSON.parse(localStorage.getItem('currentUser'))

		let date = new Date();
		// Set Search Filters According to cookies or the intial state
		// this.startDate = this.affiliateService.checkCookie('affiliate_startDate') ?
		// 	this.affiliateService.getCookie('affiliate_startDate') :
		// 	date.toISOString().substring(0, 10);

		// date.setDate(date.getDate() + 7);
		// this.endDate = this.affiliateService.checkCookie('affiliate_endDate') ?
		// 	this.affiliateService.getCookie('affiliate_endDate') :
		// 	date.toISOString().substring(0, 10);

		this.startDate = this.affiliateService.checkCookie('affiliate_startDate') ?
			this.affiliateService.getCookie('affiliate_startDate') :
			date.toISOString().substring(0, 10);

		date.setDate(date.getDate() + 7);

		this.endDate = this.affiliateService.checkCookie('affiliate_endDate') ?
			this.affiliateService.getCookie('affiliate_endDate') :
			date.toISOString().substring(0, 10);


		this.searchText = this.affiliateService.checkCookie('affiliate_search') ?
			(this.affiliateService.getCookie('affiliate_search') || '')
			: "";

		this.useDateFilter = localStorage.getItem('farmInuseDateFilter') ?
			(localStorage.getItem('farmInuseDateFilter') == 'true' ? true : false)
			: false;
		console.log('farmInuseDateFilter-->', this.useDateFilter)
		this.listTab = this.useDateFilter ? 'custom' :
			(localStorage.getItem('affiliateBookingsTab') == 'past' ? 'past' : 'upcoming');

		//save currency symbol
		this.currencySymbol = this.stateManagementService.getCurrencySymbol();

		this.loadBookings(null, true);
		this.loadVehicles();

		this.changeStatusForm = this.formBuilder.group({
			reservation_id: ['', Validators.required],
			booking_status: ['', Validators.required]
		});

		//send email booking form validation
		this.sendEmailForm = this.formBuilder.group({
			reservation_id: ['', Validators.required],
			emailTarget: ['', Validators.required]
		});

		$("#search-field-my-booking").addClass("box-outline")

		// this.MapController()
	}

	ngAfterViewInit(): void {
		$("#search-field-my-booking").addClass("box-outline")
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


	loadBookings(pageUrl = null, includeDatesInPayload: boolean = false) {
		$('.HeadingH1').css({ display: "none" })
		/** spinner starts on init */
		if (pageUrl) {
			console.log("pageurl", pageUrl)
			this.scroll('bookings_affiliate')
		}
		this.spinner.show();

		// var keyword = ((document.getElementById("keyword") as HTMLInputElement).value);
		// Load Our bookings using API
		const fallbackStartDate = this.startDate || moment().format('YYYY-MM-DD');
		const fallbackEndDate = this.endDate || moment().add(7, 'day').format('YYYY-MM-DD');
		const shouldSendDates = includeDatesInPayload || this.useDateFilter || !!this.searchText?.trim();
		const startDate = shouldSendDates ? fallbackStartDate : fallbackStartDate;
		const endDate = shouldSendDates ? fallbackEndDate : fallbackEndDate;
		this.affiliateService.loadBookings(pageUrl, this.searchText, startDate, endDate, this.useDateFilter, this.listFilter()).then(result => {
			console.log('result------------------------->>>', result)
			this.bookingsRes = result;
			this.needsActionCount = this.bookingsRes?.data?.needs_action_count ?? 0;
			// Only sent for tab requests; keep the last badges while searching.
			this.tabCounts = this.bookingsRes?.data?.tab_counts ?? this.tabCounts;
			// Leave "Needs action" once the last pending booking is answered.
			if (this.showNeedsAction && this.needsActionCount == 0) {
				this.showNeedsAction = false;
				this.loadBookings(null, true);
				return;
			}
			this.bookings = this.bookingsRes?.data?.reservations?.data;
			this.totalRecords = this.bookingsRes?.data?.reservations?.total;
			this.total_amount = this.bookingsRes?.data?.total_amount
			this.net_total_amount = this.bookingsRes?.data?.affiliate_total
			this.noError = false
			this.firstPage = 1;
			this.lastPage = this.bookingsRes?.data?.reservations?.last_page;
			this.totalPage = this.bookingsRes?.data?.reservations?.last_page;
			this.currentPage = this.bookingsRes?.data?.reservations?.current_page;
			this.from = this.bookingsRes?.data?.reservations?.from;
			this.to = this.bookingsRes?.data.reservations?.to;
			this.path = this.bookingsRes?.data?.reservations?.path;
			this.firstPageUrl = this.bookingsRes?.data?.reservations?.first_page_url;
			this.lastPageUrl = this.bookingsRes?.data?.reservations?.last_page_url;
			this.prevPageUrl = this.bookingsRes?.data?.reservations?.prev_page_url;
			this.nextPageUrl = this.bookingsRes?.data?.reservations?.next_page_url;
			this.spinner.hide();//hide spinner
			if (this.bookingsRes?.data?.reservations?.data.length == 0) {
				this.noError = true
			}
		})
			.catch(err => {
				this.spinner.hide();//hide spinner
			});
	}


	loadVehicles() {
		this.affiliateService.affiliateVehicleList(true).then(result => {
			this.vehiclesRes = result;
			this.numberOfVehicles = this.vehiclesRes?.data?.totalNumberOfVehicles;
			localStorage.setItem("affiliateVehicles", this.numberOfVehicles)
		});
	}

	FormatDate(date: string) {
		const m = moment(date);
		if (m.isSame(moment(), 'day')) {
			return 'Today';
		}
		return m.format("ll");
	}

	/** The `filter` sent to the API: '' while on Custom, which uses the date range instead. */
	listFilter(): string {
		if (this.listTab == 'custom') {
			return '';
		}
		return this.showNeedsAction ? 'needs_action' : this.listTab;
	}

	selectTab(tab: string) {
		this.showNeedsAction = false;
		this.listTab = tab;
		localStorage.setItem('affiliateBookingsTab', tab);
		this.useDateFilter = tab == 'custom';
		localStorage.setItem('farmInuseDateFilter', String(this.useDateFilter));
		if (!this.startDate || !this.endDate) {
			this.startDate = moment().format('YYYY-MM-DD');
			this.endDate = moment().add(7, 'day').format('YYYY-MM-DD');
		}
		this.loadBookings(null, true);
	}

	toggleNeedsAction() {
		this.showNeedsAction = !this.showNeedsAction;
		if (this.showNeedsAction) {
			// The queue spans every date; a search would override it server-side.
			this.searchText = "";
			this.saveCookie('affiliate_search', "");
			if (this.listTab == 'custom') {
				this.listTab = 'upcoming';
				this.useDateFilter = false;
				localStorage.setItem('farmInuseDateFilter', 'false');
			}
		}
		this.loadBookings(null, true);
	}

	/** Search button / Enter: skip the typing debounce. */
	submitSearch(search_value: string) {
		clearTimeout(this.timer);
		this.searchText = search_value ?? "";
		if (this.searchText) {
			this.showNeedsAction = false;
		}
		this.saveCookie('affiliate_search', this.searchText);
		this.loadBookings(null, true);
	}

	searchInBookings(search_value: string) {
		this.searchText = search_value ?? ""
		// Typing searches the normal list, so leave "Needs action".
		if (this.searchText) {
			this.showNeedsAction = false;
		}
		console.log('--->>>>>', search_value)
		clearTimeout(this.timer);
		this.timer = setTimeout(() => {
			this.saveCookie('affiliate_startDate', this.startDate);
			this.saveCookie('affiliate_endDate', this.endDate);
			this.saveCookie('affiliate_search', this.searchText ?? "");
			this.loadBookings();
		}, 1200)
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

	/** Driver/affiliate phone stays hidden until the booking is accepted. */
	canShowContactInfo(status: any): boolean {
		return !['pending', 'rejected', 'rejection'].includes(status);
	}

	highlighText(args: string) {
		if (!this.searchText) { return args; }
		if (args) {
			args = args.toString()
			const escapedSearchText = this.searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			var re = new RegExp(escapedSearchText, 'gi'); //'gi' for case insensitive and can use 'g' if you want the search to be case sensitive.
			return args.replace(re, '<mark class="font-weight-bold">$&</mark>');
		}
	}
	saveCookie(key: string, value: string) {
		console.log('in function set cookies for', key, value)
		this.affiliateService.setCookie(key, value, 30);
	}
	formatPhoneNumber(ph: any) {
		if (!ph.includes('+')) {
			return '+' + ph
		}
		return ph;
	}
	reset() {
		this.listTab = 'upcoming';
		this.showNeedsAction = false;
		localStorage.removeItem('affiliateBookingsTab');
		let date = new Date();
		this.startDate = date.toISOString().substring(0, 10);
		date.setDate(date.getDate() + 7);
		this.endDate = date.toISOString().substring(0, 10);
		this.affiliateService.deleteCookie('affiliate_startDate')
		this.affiliateService.deleteCookie('affiliate_endDate')
		this.affiliateService.deleteCookie('affiliate_search')
		// this.affiliateService.deleteCookie('filtertype')
		this.searchText = "";
		localStorage.removeItem('farmInuseDateFilter')
		this.useDateFilter = false
		// this.filtertype = 'bookingid';

		console.log('Reset Successfully. ');
		this.saveCookie('affiliate_startDate', this.startDate);
		this.saveCookie('affiliate_endDate', this.endDate);
		this.saveCookie('affiliate_search', this.searchText ?? "");
		this.loadBookings(null, true);
	}
	textFormatter(text: string) {
		try {
			return text.replace(/[\\\_$]+/g, ' ')
		}
		catch {
			return text
		}
	}
	auditTrail(bookingId: any) {
		console.log('In function audit trail', bookingId)
		this.spinner.show()
		this.affiliateService.auditTrailInfo(bookingId)
			.pipe(
				catchError((err) => {
					return throwError(err);
				})
			)
			.subscribe((response: any) => {
				this.spinner.hide()
				console.log('audit trail --->>>>>>>>', response)
				this.audit_Trail = response.data
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

	showBookingPreviewModal(booking_id: number) {
		this.bookingPreviewModal.openPreview(booking_id, 'affiliate');
	}


	handleKeypressEvents() {
		clearTimeout(this.timer)
	}


	closeModal() {
		this.message.nativeElement.value = ""
		this.fileInput.nativeElement.value = '';
		this.uploadedFile = null;
		this.fileType = null;
		this.fileUrl = null;
		this.show = false;
	}
	messageField(format) {
		this.show = true;
		switch (format) {
			case "Phone": {
				this.sendMessageField = true;
				break;
			}
			case "Email": {
				this.sendMessageField = false;
				break;
			}
		}
	}



	async submit(message, format) {
		console.log('format', format, this.passengerDetails)
		if (this.passengerDetails.selection_button == "Passenger") {
			this.sendInformation = format
				? this.passengerDetails.pax_tel
				: this.passengerDetails.passenger_email;
			this.reciptentName = this.passengerDetails.passenger_name;
		} else if (this.passengerDetails.selection_button == "Driver") {
			console.log('driver')
			this.sendInformation = format
				? this.passengerDetails?.driver_cell_isd +
				this.passengerDetails?.driver_cell_number
				: this.passengerDetails?.driver_email;
			this.reciptentName = this.passengerDetails?.driver_name;
		}
		else if (this.passengerDetails.selection_button == "created_by") {
			this.sendInformation = format ? this.passengerDetails.created_by_phone : this.passengerDetails.created_by_email
			this.reciptentName = this.passengerDetails.created_by_name
		}
		else {
			this.sendInformation = format
				? this.passengerDetails.loose_affiliate_phone_isd +
				this.passengerDetails.loose_affiliate_phone
				: this.passengerDetails.loose_affiliate_email;
			this.reciptentName = this.passengerDetails.loose_affiliate_name;
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

		console.log('submit modal values---->>', obj)
		this.affiliateService.affiliateNotification(obj)
			.pipe(
				catchError((err: any) => {
					console.log('err------->>>>>>>', err)
					return throwError(err)
				})
			).subscribe(({ message }: any) => {
				$('#successModal').modal('show')
				this.notification_msg = message
				setTimeout(() => {
					$('#successModal').modal('hide')
				}, 2000)
				console.log(message);
				$("textarea").val("");
			})


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
		this.message.nativeElement.value = ""
		this.show = false
	}


	//for pagination
	counter() {
		var currentPage;
		var startFrom;
		var endTo;

		if (this.currentPage as number < 5) {
			startFrom = 0;
			endTo = this.totalPage;
		}
		else if (this.currentPage < this.totalPage) {
			currentPage = this.currentPage
			endTo = currentPage + 1;
			startFrom = endTo - 5;
		}
		else {
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

	changeDate(dateType, date) {
		if (!date) {
			return;
		}

		if (dateType == 'startDate') {
			this.startDate = date;
			if (this.endDate && moment(this.startDate, 'YYYY-MM-DD').isAfter(moment(this.endDate, 'YYYY-MM-DD'), 'day')) {
				this.endDate = this.startDate;
				this.saveCookie('affiliate_endDate', this.endDate);
			}
		}
		else {
			this.endDate = date;
			if (this.startDate && moment(this.endDate, 'YYYY-MM-DD').isBefore(moment(this.startDate, 'YYYY-MM-DD'), 'day')) {
				this.endDate = this.startDate;
			}
		}
		this.saveCookie('affiliate_startDate', this.startDate);
		this.saveCookie('affiliate_endDate', this.endDate);
		if (this.useDateFilter) {
			this.runBookingsSearch();
		}
	}

	runBookingsSearch(pageUrl = null) {
		if (!this.useDateFilter) {
			return;
		}
		this.saveCookie('affiliate_startDate', this.startDate);
		this.saveCookie('affiliate_endDate', this.endDate);
		this.saveCookie('affiliate_search', this.searchText ?? "");
		this.loadBookings(pageUrl);
	}
	dateFormat(value: any) {
		return moment(value, 'YYYY-MM-DD').format('ll')
	}

	dateFormat2(value: any) {
		return moment(value, 'YYYY-MM-DD').format('L')
	}

	dateFormatToDay(value: any) {
		return moment(value, "YYYY-MM-DD").format('dddd');
	}

	FormatTime(time: string) {
		return moment(time, "HH:mm:ss").format("LT");
	}
	timeFormat(value: any) {
		if (value.toUpperCase() == '12:00 AM') {
			return '0000 h'
		}
		let hours = moment(moment(value, 'hh:mm a').format('HH'), 'HH').hours();
		let mins = moment(value, 'hh:mm a').minutes().toString();
		if (Number(mins) == 0 || Number(mins) < 10) {
			mins = '0' + mins.toString();
		}

		return hours < 10 ? '0' + hours.toString() + mins.toString() + ' h' : hours.toString() + mins.toString() + ' h'
		//return value.replace(':', '').substring(0, 5) + 'h';
	}

	timeFormat2(value: string) {
		return moment(value, 'HH:mm a').format('h:mm a');
	}

	show = false
	openModal(booking: any, selection_button: string) {
		// Driver/affiliate contact stays closed until the booking is accepted.
		if (selection_button != 'Passenger' && selection_button != 'created_by' && !this.canShowContactInfo(booking?.booking_status)) return;
		console.log('open modal-->>>>>>>', booking, selection_button)
		this.passengerDetails = booking;
		this.passengerDetails['selection_button'] = selection_button
	}
	cancelBooking() {
		console.log('in function cancel booking')
		this.spinner.show();

		this.affiliateService.cancelBooking(this.cancelBookingId)
			.pipe(
				catchError(err => {
					this.spinner.hide();//hide spinner
					$('#cancelBooking').modal('hide');
					return throwError(err);
				})
			)
			.subscribe(({ data, success, message }: any) => {
				this.spinner.hide();//hide spinner
				this.loadBookings()
				$('#cancelBooking').modal('hide');
				this.$errors.openDialog({
					errors: {
						error: `<span class='text-success'>Cancellation request have been successfully send to admin!</span>`
					}
				})

			});

		// this.affiliateService.rejectBooking(this.cancelBookingId)
		// 	.pipe(
		// 		catchError(err => {
		// 			this.spinner.hide();//hide spinner
		// 			$('#cancelBooking').modal('hide');
		// 			return throwError(err);
		// 		})
		// 	)
		// 	.subscribe(({ data, success, message }: any) => {
		// 		if (success == true) {
		// 			this.spinner.hide();//hide spinner
		// 			this.loadBookings()
		// 			$('#cancelBooking').modal('hide');
		// 			// this.$errors.openDialog({
		// 			// 	errors: {
		// 			// 		error: `<span class='text-success'>${message}</span>`
		// 			// 	}
		// 			// })
		// 		}
		// 	});
	}

	acceptBooking() {
		console.log('in function cancel booking')
		this.spinner.show();

		this.affiliateService.acceptBooking(this.cancelBookingId)
			.pipe(
				catchError(err => {
					this.spinner.hide();//hide spinner
					$('#acceptBooking').modal('hide');
					return throwError(err);
				})
			)
			.subscribe(({ data, success, message }: any) => {
				if (success == true) {
					this.spinner.hide();//hide spinner
					this.loadBookings()
					$('#acceptBooking').modal('hide');
					// this.$errors.openDialog({
					// 	errors: {
					// 		error: `<span class='text-success'>${message}</span>`
					// 	}
					// })
				}
			});
	}
	// messageField(format)
	// {
	// 	this.show = true;
	// 	switch (format)
	// 	{
	// 		case 'Phone': {
	// 			this.sendMessageField = true;
	// 			break;
	// 		}
	// 		case 'Email': {
	// 			this.sendMessageField = false;
	// 			break;
	// 		}
	// 	}
	// }



	editAction(bookingId, updateType) {
		if (this.currentUser.roleName == 'sub_affiliate') {
			this.router.navigate(['/sub_affiliate/create-new-booking-v2'], { queryParams: { bookingId: bookingId, updateType: updateType, nav: 'true' } });
		}
		else {
			this.router.navigate(['/affiliate/create-new-booking-v2'], { queryParams: { bookingId: bookingId, updateType: updateType, nav: 'true' } });
		}
	}

	finalizeAction(bookingId) {
		if (this.currentUser.roleName == 'sub_affiliate') {
			this.router.navigate(['/sub_affiliate/finalize-booking'], { queryParams: { bookingId: bookingId } });
		}
		else {
			this.router.navigate(['/affiliate/finalize-booking'], { queryParams: { bookingId: bookingId } });
		}
	}

	previewRate(bookingId) {
		if (this.currentUser.roleName == 'sub_affiliate') {
			this.router.navigate(['/sub_affiliate/finalize-booking'], { queryParams: { bookingId: bookingId, editRate: true } });
		}
		else {
			this.router.navigate(['/affiliate/finalize-booking'], { queryParams: { bookingId: bookingId, editRate: true } });
		}
	}
	returnRepeatAction(actionType, bookingId, serviceType) {
		console.log(actionType, bookingId, serviceType);

		if (actionType == 'return') {
			if (this.currentUser.roleName == 'sub_affiliate') {
				this.router.navigate(['/sub_affiliate/create-new-booking'], { queryParams: { bookingId: bookingId, bookingType: 'return' } });
			}
			else {
				this.router.navigate(['/affiliate/create-new-booking'], { queryParams: { bookingId: bookingId, bookingType: 'return' } });
			}
		}
		else {
			if (this.currentUser.roleName == 'sub_affiliate') {
				this.router.navigate(['/sub_affiliate/create-new-booking'], { queryParams: { bookingId: bookingId, bookingType: 'repeat' } });
			}
			else {
				this.router.navigate(['/affiliate/create-new-booking'], { queryParams: { bookingId: bookingId, bookingType: 'repeat' } });
			}
		}
	}

	invoiceAction(bookingId) {
		if (this.currentUser.roleName == 'sub_affiliate') {
			this.router.navigate(['/sub_affiliate/invoice-summary'], { queryParams: { bookingId: bookingId } });
		}
		else {
			this.router.navigate(['/affiliate/invoice-summary'], { queryParams: { bookingId: bookingId } });
		}
	}

	get changeStatusF() {
		return this.changeStatusForm.controls;
	}

	// changeBookingStatus(bookingId)
	// {
	// 	this.changeStatusForm.patchValue({
	// 		reservation_id: bookingId
	// 	});
	// }

	submitChangeStatusForm() {
		this.submitted = true;
		console.log(this.changeStatusForm);
		// stop here if form is invalid
		if (this.changeStatusForm.invalid) {
			return;
		}

		this.spinner.show();

		this.affiliateService.changeStatusBooking(this.changeStatusForm.value)
			.pipe(
				catchError(err => {
					this.spinner.hide();//hide spinner
					$('#change_status_booking_Modal').modal('hide');
					return throwError(err);
				})
			)
			.subscribe(({ data, success, message }: any) => {
				if (success == true) {
					this.spinner.hide();//hide spinner
					$('#change_status_booking_Modal').modal('hide');
					if (this.currentUser.roleName == 'sub_affiliate') {
						this.router.navigateByUrl('/RefreshComponent', { skipLocationChange: true }).then(() => {
							this.router.navigate(['/sub_affiliate/my-bookings']);
						});
					}
					else {
						this.router.navigateByUrl('/RefreshComponent', { skipLocationChange: true }).then(() => {
							this.router.navigate(['/affiliate/my-bookings']);
						});
					}
				}
			});
	}


	sendEmailClicked(bookingId, emailTarget) {
		this.sendEmailForm.patchValue({
			reservation_id: bookingId,
			emailTarget: emailTarget
		});
	}

	emailForm() {
		this.submitted = true;
		console.log(this.sendEmailForm);
		// stop here if form is invalid
		if (this.sendEmailForm.invalid) {
			return;
		}

		this.spinner.show();

		this.affiliateService.sendEmail(this.sendEmailForm.value)
			.pipe(
				catchError(err => {
					this.spinner.hide();//hide spinner
					$('#emailModal').modal('hide');
					return throwError(err);
				})
			)
			.subscribe(({ data, success, message }: any) => {
				if (success == true) {
					this.spinner.hide();//hide spinner
					$('#emailModal').modal('hide');
					if (this.currentUser.roleName == 'sub_affiliate') {
						this.router.navigateByUrl('/RefreshComponent', { skipLocationChange: true }).then(() => {
							this.router.navigate(['/sub_affiliate/my-bookings']);
						});
					}
					else {
						this.router.navigateByUrl('/RefreshComponent', { skipLocationChange: true }).then(() => {
							this.router.navigate(['/affiliate/my-bookings']);
						});
					}

				}
			});
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
		return (distance / 1609).toFixed(2)
	}

	mToKm(distance: number): string {
		return (distance / 1000).toFixed(2)
	}


	iOS() {
		return [
			'iPad Simulator',
			'iPhone Simulator',
			'iPod Simulator',
			'iPad',
			'iPhone',
			'iPod'
		].includes(navigator.platform)
			// iPad on iOS 13 detection
			|| (navigator.userAgent.includes("Mac") && "ontouchend" in document)
	}

	showLocationPointOnMap(booking_id: number, type: string) {

		let isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
		console.log('isSafari', isSafari)
		// this.spinner.show()
		this.affiliateService.getLocationPoints(booking_id).subscribe((response: any) => {
			this.spinner.hide();
			if ("lat" in response?.data?.pickupDetail && "long" in response?.data?.pickupDetail && "lat" in response?.data?.dropoffDetail && "long" in response?.data?.dropoffDetail) {
				sessionStorage.setItem('pickup', JSON.stringify(response?.data?.pickupDetail.address));
				sessionStorage.setItem('dropoff', JSON.stringify(response?.data?.dropoffDetail.address));
				if (type == 'pickup') {
					const googleDirectionUrl = 'https://www.google.com/maps/dir/?api=1' + '&destination=' +
						encodeURIComponent(response?.data?.pickupDetail.address) + '&travelmode=driving'
					const iosDirectionUrl = 'http://maps.apple.com/?daddr=' +
						encodeURIComponent(response?.data?.pickupDetail.address)
					if (this.iOS()) {
						setTimeout(() => {
							window.location.href = iosDirectionUrl;
						})
					}
					else {
						window.open(googleDirectionUrl, '_blank');
					}
				}
				else if (type == 'dropoff') {
					const googleDirectionUrl = 'https://www.google.com/maps/dir/?api=1' + '&destination=' +
						encodeURIComponent(response?.data?.dropoffDetail.address) + '&travelmode=driving'
					const iosDirectionUrl = 'http://maps.apple.com/?daddr=' +
						encodeURIComponent(response?.data?.dropoffDetail.address)
					if (this.iOS()) {
						setTimeout(() => {
							window.location.href = iosDirectionUrl;
						})
					}
					else {
						window.open(googleDirectionUrl, '_blank');
					}
				}

			} else {
				throw new Error('Error: Location Points Not Specified Properly. ');
			}
		})
	}
	showLocationPointOnMapByAddress(address: any) {
		let isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
		console.log('isSafari', isSafari)
		if (address) {
			let googleDirectionUrl;
			let iosDirectionUrl;
			googleDirectionUrl = 'https://www.google.com/maps/dir/?api=1' + '&destination=' +
				encodeURIComponent(address) + '&travelmode=driving'
			iosDirectionUrl = 'http://maps.apple.com/?daddr=' +
				encodeURIComponent(address)
			if (this.iOS()) {
				setTimeout(() => {
					window.location.href = iosDirectionUrl;
				})
			}
			else {
				window.open(googleDirectionUrl, '_blank');
			}
		} else {
			throw new Error('Error: Location Points Not Specified Properly. ');
		}
	}

	searchOnGoogle(query: string) {
		console.log("in search google", query)
		if (query) {
			const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
			window.open(url, '_blank'); // Opens the search in a new tab
		}
	}

	addSubAffiliate() {
		this.router.navigate(['/affiliate/add-sub-affiliate']);
	}

	upgradePlan() {
		this.router.navigate(['/subscription']);
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

	calculateConnectorHeight(address: string) {
		if (!address) return '30px';
		const len = address.length;
		if (len <= 30) return '30px'; // 1 line (aligned with 30ch width)
		if (len <= 60) return '50px'; // 2 lines
		if (len <= 90) return '72px'; // 3 lines
		if (len <= 120) return '94px'; // 4 lines
		if (len <= 150) return '116px'; // 5 lines
		return '138px'; // > 5 lines
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
}
