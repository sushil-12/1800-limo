import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { BookingTabCounts } from '../../shared/bookings-header/bookings-header.component';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ThemePalette } from '@angular/material/core';
import { Router } from '@angular/router';
import * as moment from 'moment';
import { NgxSpinnerService } from 'ngx-spinner';
import * as dayjs from 'dayjs';
import { throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AffiliateService } from 'src/app/services/affiliate.service';
import { ErrorDialogService } from 'src/app/services/error-dialog/errordialog.service';
import { TravelAgentService } from 'src/app/services/travel-agent.service';
import { DatePickerComponent } from '../../shared/date-picker/date-picker.component';
import { HttpClient } from '@angular/common/http';
import { IndividualService } from 'src/app/services/individual.service';
import { StateManagementService } from 'src/app/services/statemanagement.service';
import { AdminService } from 'src/app/services/admin.service';
import { GoogleMap } from '@angular/google-maps';
declare var $: any;

@Component({
	selector: 'app-bookings',
	templateUrl: './bookings.component.html',
	styleUrls: ['./bookings.component.scss']
})
export class BookingsComponent implements OnInit {
	@ViewChild(GoogleMap, { static: false }) map!: GoogleMap;
	@ViewChild('bookingPreviewModal') bookingPreviewModal: any;

	@ViewChild('inputmsg', { static: false }) message: ElementRef;
	@ViewChild('sendEmailModalFocus') sendEmailModalFocus: any;



	exampleHeader = DatePickerComponent

	color: ThemePalette = 'accent';
	outputDateFormat = 'YYYY-MM-DD';
	public totalRecords: any;
	public firstPage: Number;
	public lastPage: Number;
	public totalPage: Number;
	public currentPage: any;
	submittedForm: boolean;
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
	public startDate: any;
	public endDate: any;
	public selectedDateRange: any;
	public date: Date;
	public changeStatusForm: FormGroup;
	inviteAgentForm: FormGroup;
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
	company_name: any = JSON.parse(localStorage.getItem('currentUser'))?.affiliate_company || ''
	cancelBookingId: any = null
	useDateFilter: boolean = false;

	currentUser: any;
	cardDetails: any;
	response: any;
	paymentMethod: string = 'card';
	selectedCard: any;
	bookingId: any;
	responseRate: any;
	rateArray: any;
	cancelMessage: any;
	currencySymbol: any;
	is_family_member: any = false;
	// Upcoming / Past / Custom tabs (Custom = the date-range pickers).
	listTab: string = 'upcoming';
	tabCounts: BookingTabCounts | null = null;

	constructor(
		private affiliateService: AffiliateService,
		private adminService: AdminService,
		private travelAgentService: TravelAgentService,
		private router: Router,
		private spinner: NgxSpinnerService,
		private $errors: ErrorDialogService,
		private formBuilder: FormBuilder,
		private stateManagementService: StateManagementService,
		private individualService: IndividualService,
		private http: HttpClient) { }

	ngOnInit(): void {

		this.currentUser = JSON.parse(localStorage.getItem('currentUser'))
		this.is_family_member = localStorage.getItem("is_family_member") ? localStorage.getItem("is_family_member") : false
		let date = new Date();
		// Set Search Filters According to cookies or the intial state
		// this.startDate = this.affiliateService.checkCookie('indv_startDate') ?
		// 	this.affiliateService.getCookie('indv_startDate') :
		// 	date.toISOString().substring(0, 10);

		// date.setDate(date.getDate() + 7);
		// this.endDate = this.affiliateService.checkCookie('indv_endDate') ?
		// 	this.affiliateService.getCookie('indv_endDate') :
		// 	date.toISOString().substring(0, 10);

		this.startDate = this.affiliateService.checkCookie('indv_startDate') ?
			moment(this.affiliateService.getCookie('indv_startDate'), 'YYYY-MM-DD').toDate() :
			date;

		date.setDate(date.getDate() + 7);

		this.endDate = this.affiliateService.checkCookie('indv_endDate') ?
			moment(this.affiliateService.getCookie('indv_endDate'), 'YYYY-MM-DD').toDate() :
			new Date(date);

		this.selectedDateRange = {
			startDate: dayjs(this.startDate),
			endDate: dayjs(this.endDate)
		};

		this.searchText = this.affiliateService.checkCookie('indv_search') ?
			(this.affiliateService.getCookie('indv_search') || '')
			: "";

		this.useDateFilter = localStorage.getItem('indvUseDateFilter') ?
			(localStorage.getItem('indvUseDateFilter') == 'true' ? true : false)
			: false;
		console.log('indvUseDateFilter-->', this.useDateFilter)
		this.listTab = this.useDateFilter ? 'custom' :
			(localStorage.getItem('indvBookingsTab') == 'past' ? 'past' : 'upcoming');

		//save currency symbol
		this.currencySymbol = this.stateManagementService.getCurrencySymbol();

		this.loadBookings(null, true);


		this.changeStatusForm = this.formBuilder.group({
			reservation_id: ['', Validators.required],
			booking_status: ['', Validators.required]
		});

		//send email booking form validation
		this.sendEmailForm = this.formBuilder.group({
			reservation_id: ['', Validators.required],
			emailTarget: ["", [Validators.required, Validators.pattern(/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i)]],
		});

		$("#search-field-my-booking").addClass("box-outline")

		// this.MapController()
	}

	ngAfterViewInit(): void {
		$("#search-field-my-booking").addClass("box-outline")
	}

	scroll(id) {
		let el = document.getElementById(id);
		console.log(`scrolling to ${id}`, el);
		el.scrollIntoView({ behavior: 'smooth' });
	}

	loadBookings(pageUrl = null, includeDatesInPayload: boolean = false) {
		$('.HeadingH1').css({ display: "none" })
		/** spinner starts on init */
		if (pageUrl) {
			console.log("pageurl", pageUrl)
			this.scroll('indv_bookings_table')
		}
		this.spinner.show();

		// var keyword = ((document.getElementById("keyword") as HTMLInputElement).value);
		// Load Our bookings using API
		console.log("this.staert", this.startDate)
		const fallbackStartDate = this.startDate || moment().format('YYYY-MM-DD');
		const fallbackEndDate = this.endDate || moment().add(7, 'day').format('YYYY-MM-DD');
		const shouldSendDates = includeDatesInPayload || this.useDateFilter || !!this.searchText?.trim();
		let start = shouldSendDates
			? (fallbackStartDate instanceof Date ? moment(fallbackStartDate).format('YYYY-MM-DD') : fallbackStartDate)
			: fallbackStartDate;
		let end = shouldSendDates
			? (fallbackEndDate instanceof Date ? moment(fallbackEndDate).format('YYYY-MM-DD') : fallbackEndDate)
			: fallbackEndDate;

		console.log("start.start", start)

		// 🔒 FINAL NORMALIZATION — VERY IMPORTANT
		start = this.normalizeDate(start);
		end = this.normalizeDate(end);

		console.log("startstart.staert", start)


		this.individualService.loadBookings(pageUrl, this.searchText, start, end, this.useDateFilter, this.listFilter()).then(result => {
			this.cancelMessage = ''
			this.spinner.hide()
			this.bookingsRes = result;
			// Only sent for tab requests; keep the last badges while searching.
			this.tabCounts = this.bookingsRes?.data?.tab_counts ?? this.tabCounts;
			this.bookings = (this.bookingsRes?.data?.data || []).map((booking: any) => {

				return {
					...booking,

					affiliate_type:
						typeof booking?.affiliate_type === 'string'
							? booking.affiliate_type
							: '',

					company_name:
						typeof booking?.company_name === 'string'
							? booking.company_name
							: '',

					affiliate_dispatch_isd:
						typeof booking?.affiliate_dispatch_isd === 'string'
							? booking.affiliate_dispatch_isd
							: '',

					affiliate_dispatch_number:
						typeof booking?.affiliate_dispatch_number === 'string'
							? booking.affiliate_dispatch_number
							: '',

					dispatchEmail:
						typeof booking?.dispatchEmail === 'string'
							? booking.dispatchEmail
							: '',

					gig_cell_isd:
						typeof booking?.gig_cell_isd === 'string'
							? booking.gig_cell_isd
							: '',

					gig_cell_mobile:
						typeof booking?.gig_cell_mobile === 'string'
							? booking.gig_cell_mobile
							: '',

					gig_email:
						typeof booking?.gig_email === 'string'
							? booking.gig_email
							: '',

					driver_first_name:
						typeof booking?.driver_first_name === 'string'
							? booking.driver_first_name
							: '',

					driver_last_name:
						typeof booking?.driver_last_name === 'string'
							? booking.driver_last_name
							: '',

					driver_cell_isd:
						typeof booking?.driver_cell_isd === 'string'
							? booking.driver_cell_isd
							: '',

					driver_cell_number:
						typeof booking?.driver_cell_number === 'string'
							? booking.driver_cell_number
							: '',

					driver_name:
						typeof booking?.driver_name === 'string'
							? booking.driver_name
							: '',

					driver_tel:
						typeof booking?.driver_tel === 'string'
							? booking.driver_tel
							: '',

					loose_affiliate_name:
						typeof booking?.loose_affiliate_name === 'string'
							? booking.loose_affiliate_name
							: '',

					loose_affiliate_phone_isd:
						typeof booking?.loose_affiliate_phone_isd === 'string'
							? booking.loose_affiliate_phone_isd
							: '',

					loose_affiliate_phone:
						typeof booking?.loose_affiliate_phone === 'string'
							? booking.loose_affiliate_phone
							: '',

					loose_affiliate_email:
						typeof booking?.loose_affiliate_email === 'string'
							? booking.loose_affiliate_email
							: '',

					loose_aff_driver_name:
						typeof booking?.loose_aff_driver_name === 'string'
							? booking.loose_aff_driver_name
							: '',

					loose_aff_driver_cell:
						typeof booking?.loose_aff_driver_cell === 'string'
							? booking.loose_aff_driver_cell
							: '',

					loose_aff_driver_cell_isd:
						typeof booking?.loose_aff_driver_cell_isd === 'string'
							? booking.loose_aff_driver_cell_isd
							: '',

					payment_method:
						typeof booking?.payment_method === 'string'
							? booking.payment_method
							: '',

					currency:
						typeof booking?.currency === 'string'
							? booking.currency
							: '',

					currency_symbol:
						typeof booking?.currency_symbol === 'string'
							? booking.currency_symbol
							: '',

					grand_total:
						typeof booking?.grand_total === 'number'
							? booking.grand_total
							: 0
				};
			});
			this.totalRecords = this.bookingsRes?.data?.total;
			this.noError = false
			this.firstPage = 1;
			this.lastPage = this.bookingsRes?.data?.last_page;
			this.totalPage = this.bookingsRes?.data?.last_page;
			this.currentPage = this.bookingsRes?.data?.current_page;
			this.from = this.bookingsRes?.data?.from;
			this.to = this.bookingsRes?.data.to;
			this.path = this.bookingsRes?.data?.path;
			this.firstPageUrl = this.bookingsRes?.data?.first_page_url;
			this.lastPageUrl = this.bookingsRes?.data?.last_page_url;
			this.prevPageUrl = this.bookingsRes?.data?.prev_page_url;
			this.nextPageUrl = this.bookingsRes?.data?.next_page_url;
			console.log('result------------------------->>>', result)

		})
			.catch(err => {
				this.spinner.hide();//hide spinner
			});
	}

	FormatDate(date: string) {
		const m = moment(date);
		if (m.isSame(moment(), 'day')) {
			return 'Today';
		}
		return m.format("ll");
	}

	/** Search button / Enter: skip the typing debounce. */
	submitSearch(search_value: string) {
		clearTimeout(this.timer);
		this.searchText = search_value ?? "";
		this.saveCookie('indv_search', this.searchText);
		this.loadBookings(null, true);
	}

	searchInBookings(search_value: string) {
		this.searchText = search_value ?? ""
		console.log('--->>>>>', search_value)
		clearTimeout(this.timer);
		this.timer = setTimeout(() => {
			this.saveCookie('indv_startDate', this.startDate);
			this.saveCookie('indv_endDate', this.endDate);
			this.saveCookie('indv_search', this.searchText ?? "");
			this.loadBookings();
		}, 1200)
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
	saveCookie(key: string, value: any) {
		console.log('in function set cookies for', key, value)
		const formattedValue = value instanceof Date ? moment(value).format('YYYY-MM-DD') : value;
		this.affiliateService.setCookie(key, formattedValue, 30);
	}
	formatPhoneNumber(ph: any) {
		if (!ph.includes('+')) {
			return '+' + ph
		}
		return ph;

	}

	reset() {
		let date = new Date();
		this.startDate = date;

		let endDate = new Date();
		endDate.setDate(date.getDate() + 7);
		this.endDate = endDate;

		this.selectedDateRange = {
			startDate: dayjs(this.startDate),
			endDate: dayjs(this.endDate)
		};
		this.affiliateService.deleteCookie('indv_startDate')
		this.affiliateService.deleteCookie('indv_endDate')
		this.affiliateService.deleteCookie('indv_search')
		// this.affiliateService.deleteCookie('filtertype')
		this.searchText = "";
		localStorage.removeItem('indvUseDateFilter')
		this.useDateFilter = false
		// this.filtertype = 'bookingid';

		console.log('Reset Successfully. ');
		this.saveCookie('indv_startDate', this.startDate);
		this.saveCookie('indv_endDate', this.endDate);
		this.saveCookie('indv_search', this.searchText ?? "");
		this.listTab = 'upcoming';
		localStorage.removeItem('indvBookingsTab');
		this.loadBookings(null, true);
	}


	/** The `filter` sent to the API: '' while on Custom, which uses the date range instead. */
	listFilter(): string {
		return this.listTab == 'custom' ? '' : this.listTab;
	}

	selectTab(tab: string) {
		this.listTab = tab;
		localStorage.setItem('indvBookingsTab', tab);
		this.useDateFilter = tab == 'custom';
		localStorage.setItem('indvUseDateFilter', String(this.useDateFilter));
		if (!this.startDate || !this.endDate) {
			this.startDate = new Date();
			this.endDate = moment().add(7, 'day').toDate();
		}
		this.selectedDateRange = {
			startDate: dayjs(this.startDate),
			endDate: dayjs(this.endDate)
		};
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
		this.travelAgentService.auditTrailInfo(bookingId)
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

	mToMi(distance: number): string {
		return (distance / 1609).toFixed(2);
	}

	mToKm(distance: number): string {
		return (distance / 1000).toFixed(2);
	}

	showBookingPreviewModal(booking_id: number) {
		this.bookingPreviewModal.openPreview(booking_id, 'individual');
	}


	handleKeypressEvents() {
		clearTimeout(this.timer)
	}


	closeModal() {
		this.message.nativeElement.value = ""
		this.show = false
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



	submit(message, format) {
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
				: this.passengerDetails?.driver_email ? this.passengerDetails?.driver_email : this.passengerDetails?.dispatchEmail;
			this.reciptentName = this.passengerDetails?.driver_name;
		}
		else {
			this.sendInformation = format
				? this.passengerDetails.loose_affiliate_phone_isd +
				this.passengerDetails.loose_affiliate_phone
				: this.passengerDetails.loose_affiliate_email;
			this.reciptentName = this.passengerDetails.loose_affiliate_name;
		}
		let obj = {
			bookingId: this.passengerDetails.booking_id,
			reciptentName: this.reciptentName,
			sendTo: this.passengerDetails.selection_button,
			sendThrough: format ? "Phone" : "Email",
			sendValue: this.sendInformation,
			sendContent: message,
		};
		console.log('submit modal values---->>', obj)
		this.travelAgentService.travelAgentNotification(obj)
			.pipe(
				catchError((err: any) => {
					console.log('err------->>>>>>>', err)
					return throwError(err)
				})
			).subscribe(({ message }: any) => {
				this.notification_msg = message;
				$("#notificationModal").modal("show");
				$("textarea").val("");
			})
		$("#closeModal").click(() => {
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

		const normalizedDate = date instanceof Date
			? dayjs(date).startOf('day').toDate()
			: dayjs(date, 'YYYY-MM-DD').startOf('day').toDate();

		if (dateType == 'startDate') {
			this.startDate = normalizedDate;
			if (this.endDate && moment(this.startDate).isAfter(moment(this.endDate), 'day')) {
				this.endDate = this.startDate;
				this.saveCookie('indv_endDate', this.endDate);
			}
		}
		else {
			this.endDate = normalizedDate;
			if (this.startDate && moment(this.endDate).isBefore(moment(this.startDate), 'day')) {
				this.endDate = this.startDate;
			}
		}

		this.selectedDateRange = {
			startDate: dayjs(this.startDate),
			endDate: dayjs(this.endDate)
		};

		if (this.useDateFilter) {
			this.runBookingsSearch();
		}
	}

	runBookingsSearch(pageUrl = null) {
		if (!this.useDateFilter) {
			return;
		}
		this.saveCookie('indv_startDate', this.startDate);
		this.saveCookie('indv_endDate', this.endDate);
		this.saveCookie('indv_search', this.searchText ?? "");
		this.loadBookings(pageUrl);
	}

	choosedDate(event) {
		this.startDate = event.startDate.toDate();
		this.endDate = event.endDate.toDate();
		console.log(this.startDate, this.endDate);
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
		try {
			setTimeout(() => {
				// $('textarea').attr('autofocus', 'autofocus');
				this.sendEmailModalFocus.nativeElement.querySelector('textarea').focus();
			}, 1000)
		} catch (error) {
			console.log('----------error------->>>>>> ', error)

		}
		console.log('open modal-->>>>>>>', booking, selection_button)
		this.passengerDetails = booking;
		this.passengerDetails['selection_button'] = selection_button
	}


	editAction(bookingId, updateType) {
		if (updateType == 'change') {
			this.router.navigate([`/${this.currentUser?.roleName}/create-new-booking-v2`], { queryParams: { bookingId: bookingId, updateType: updateType, nav: 'true' } });
		}
		else if (updateType == 'cancel') {
			this.bookingId = bookingId
		}
		else {
			this.router.navigate([`/${this.currentUser?.roleName}/create-new-booking-v2`], { queryParams: { bookingId: bookingId, updateType: updateType, nav: 'true' } });
		}
	}

	editActionCancelModal() {
		$("#cancel_booking_modal").modal("hide");
		this.router.navigate([`/${this.currentUser?.roleName}/create-new-booking-v2`], { queryParams: { bookingId: this.bookingId, updateType: 'edit', nav: 'true' } });
	}

	cancelBooking() {
		this.spinner.show()
		this.individualService.cancelBooking(this.bookingId)
			.pipe(
				catchError((err) => {
					this.spinner.hide()
					$("#cancel_booking_modal").modal("hide");
					return throwError(err);
				})
			)
			.subscribe((response: any) => {
				console.log('response--------->>>>>>>>', response)
				this.spinner.hide()
				this.cancelMessage = response?.message
				// this.loadBookings()
				$("#cancel_booking_modal").modal("hide");
				$("#success_modal").modal("show");

			});
	}

	emailPassenger() {
		console.log('In function email passenger', this.sendEmailForm.value.reservation_id)
		let data = {
			reservation_id: this.sendEmailForm.value.reservation_id
		}
		this.spinner.show()
		this.travelAgentService.passengerBooking(data)
			.pipe(
				catchError((err) => {
					this.spinner.hide()
					return throwError(err);
				})
			)
			.subscribe((response: any) => {
				console.log('response--------->>>>>>>>', response)
				this.spinner.hide()
				$("#emailPassenger").modal("hide");
			});
	}
	emailAll() {
		console.log('In function email all', this.sendEmailForm.value.reservation_id, this.sendEmailForm.value.emailTarget)
		let data = {
			reservation_id: this.sendEmailForm.value.reservation_id
		}
		this.spinner.show()
		this.travelAgentService.bookingEmailAll(data)
			.pipe(
				catchError((err) => {
					this.spinner.hide()
					return throwError(err);
				})
			)
			.subscribe((response: any) => {
				console.log('response--------->>>>>>>>', response)
				this.spinner.hide()
				$("#emailAll").modal("hide");
			});
	}

	returnRepeatAction(bookingId, actionType) {
		console.log(actionType, bookingId,);

		if (actionType == 'return') {
			this.router.navigate([`/${this.currentUser?.roleName}/create-new-booking-v2`], { queryParams: { bookingId: bookingId, updateType: 'return' } });
		}
		else if (actionType == 'repeat') {
			this.router.navigate([`/${this.currentUser?.roleName}/create-new-booking-v2`], { queryParams: { bookingId: bookingId, updateType: 'repeat' } });
		}
		else {
			this.router.navigate([`/${this.currentUser?.roleName}/create-new-booking-v2`], { queryParams: { bookingId: bookingId, updateType: 'round' } });
		}
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
				formattedText += `<br><span class="text-danger font-weight-bolder">${parts[i]}</span>`; // Numbered instruction part
			}
		}

		return formattedText;
	}

	get changeStatusF() {
		return this.changeStatusForm.controls;
	}


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
					this.router.navigateByUrl('/RefreshComponent', { skipLocationChange: true }).then(() => {
						this.router.navigate([`/${this.currentUser?.roleName}/bookings`]);
					});
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

		this.travelAgentService.sendEmail(this.sendEmailForm.value)
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
					this.router.navigateByUrl('/RefreshComponent', { skipLocationChange: true }).then(() => {
						this.router.navigate([`/${this.currentUser?.roleName}/bookings`]);
					});
				}
			});
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
		this.travelAgentService.getLocationPoints(booking_id).subscribe((response: any) => {
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

	normalizeDate(value: any): string {
		// Moment object
		if (moment.isMoment(value)) {
			return value.format('YYYY-MM-DD');
		}

		// Dayjs object
		if (dayjs.isDayjs && dayjs.isDayjs(value)) {
			return value.format('YYYY-MM-DD');
		}

		// Milliseconds timestamp
		if (typeof value === 'number' && value.toString().length === 13) {
			return moment(value).format('YYYY-MM-DD');
		}

		// Timestamp as string
		if (typeof value === 'string' && /^\d{13}$/.test(value)) {
			return moment(Number(value)).format('YYYY-MM-DD');
		}

		// Already in correct format
		return value;
	}


	getIndividualCardDetails() {
		this.spinner.show()
		this.individualService.getIndividualAccountDetails()
			.pipe(
				catchError(err => {
					this.spinner.hide();//hide spinner
					return throwError(err);
				})
			).subscribe(result => {
				this.response = result
				this.cardDetails = this.response?.data?.cards
				this.spinner.hide();//hide spinner

			});
	}
	payBooking(id) {
		this.bookingId = id
		this.showRatesArray()
		this.getIndividualCardDetails()
	}
	showRatesArray() {
		this.spinner.show()
		this.individualService.showRatesArray(this.bookingId)
			.pipe(
				catchError(err => {
					this.spinner.hide();//hide spinner
					return throwError(err);
				})
			).subscribe(result => {
				this.responseRate = result
				this.rateArray = this.responseRate?.data
				this.spinner.hide();//hide spinner

			});

	}

	handleChangeCard(card: any) {
		console.log("selected card", card)

		this.selectedCard = card
		console.log("selected card", this.selectedCard)
	}

	changeDetection(method: string) {
		this.paymentMethod = method
	}

	addFamilyMember() {
		this.router.navigate(['/individual/add-family-member']);
	}

	makePayment() {

		console.log('-----=====?>>>>>', this.cardDetails.length > 0)
		let dataToSend: any

		if (this.paymentMethod == 'card') {
			console.log('<<<<<----payment through card-->>>>', this.selectedCard?.ID, this.cardDetails[0]?.ID, this.bookingId, this.rateArray?.grandTotal)
			dataToSend = {
				isExistingCard: true,
				paymentMethod: 'credit_card',
				CreditCardsDetail: {
					cardID: this.selectedCard ? this.selectedCard?.ID : this.cardDetails[0]?.ID
				},
				reservation_id: this.bookingId,
				grand_total: this.rateArray?.grandTotal
			}
			console.log('selected card-->>>')
		}
		else {
			console.log('<<<<<----payment through cash-->>>>')
			dataToSend = {
				reservation_id: this.bookingId,
				grand_total: this.rateArray?.grandTotal,
				paymentMethod: 'cash'
			}
		}
		this.spinner.show()
		this.individualService.paymentProcessing(dataToSend).subscribe((response: any) => {
			$('#paymentModal').modal('hide')
			console.log(response)
			this.router.navigate([`/individual/invoice-summary`], { queryParams: { bookingId: this.bookingId } });

			console.log('response---------------------->>', response)
			this.spinner.hide()
		})
	}

	searchOnGoogle(query: string) {
		console.log("in search google", query)
		if (query) {
			const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
			window.open(url, '_blank'); // Opens the search in a new tab
		}
	}

	get EmailFormF() {
		return this.sendEmailForm.controls;
	}

	sendEmaiManuallClicked(bookingId) {
		console.log('in func send email click', bookingId)
		this.sendEmailForm.patchValue({
			reservation_id: bookingId,
		});
	}

	sendEmailToAnyone() {
		if (this.sendEmailForm.invalid) {
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
					this.$errors.openDialog({
						errors: {
							error: `<span class='text-success font-weight-bolder text-2xl' style="font-size: 24px;">Email have been sent successfully!</span>`
						}
					})
				}
			});

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
}
