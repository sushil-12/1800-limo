import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { Router } from '@angular/router';
import { NgxSpinnerService } from 'ngx-spinner';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';

import { AffiliateService } from '../../../services/affiliate.service';
import { ThemePalette } from '@angular/material/core';
import * as moment from 'moment';
import { ErrorDialogService } from 'src/app/services/error-dialog/errordialog.service';
import { StateManagementService } from 'src/app/services/statemanagement.service';


declare var $: any


@Component({
	selector: 'app-farm-out',
	templateUrl: './farm-out.component.html',
	styleUrls: ['./farm-out.component.scss']
})
export class FarmOutComponent implements OnInit {
	@ViewChild('inputmsg', { static: false }) message: ElementRef;

	color: ThemePalette = 'accent';
	outputDateFormat = 'YYYY-MM-DD';
	public totalRecords: any;
	public firstPage: Number;
	public lastPage: Number;
	public totalPage: Number;
	public currentPage: Number;
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
	public startDateModel: moment.Moment;
	public endDateModel: moment.Moment;
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
	isAffiliate: boolean = false
	isLooseAffiliate: boolean = false;
	audit_Trail: any;
	// OUTPUTDATEFORMAT = 'YYYY-MM-DD' // Removed duplicate
	show: boolean = false;
	farmout_modal_body: string
	cancelBookingId: any = null;
	start_date: string
	end_date: string
	useDateFilter: boolean = false;
	// Upcoming / Past / Custom tabs (Custom = the date-range pickers).
	listTab: string = 'upcoming';
	currencySymbol: any;
	currentUser: any;

	constructor(
		private $affiliateService: AffiliateService,
		private $spinner: NgxSpinnerService,
		private $router: Router,
		private formBuilder: FormBuilder,
		private stateManagementService: StateManagementService,
		private $errors: ErrorDialogService,
	) { }

	ngOnInit(): void {

		this.currentUser = JSON.parse(localStorage.getItem('currentUser'))

		// check for selected vehicle and logged in affiliate
		console.log(this.$affiliateService.initialiseFarmout())
		if (!this.$affiliateService.initialiseFarmout()) {
			sessionStorage.removeItem('selected_vehicle')
			this.farmout_modal_body = `
			You cannot create a booking of this vehicle. <br/><br/>
			<h6>Create a new Farm Out Booking ?</h6>
			`
			// $('#farmout-modal').modal('show')
		}
		$('.HeadingH1').css({ display: "none" })

		let date = new Date();
		// Set Search Filters According to cookies or the intial state
		// logic aligned with my-bookings: string initialization
		this.startDate = localStorage.getItem('farmout_startDate') ?
			localStorage.getItem('farmout_startDate') :
			date.toISOString().substring(0, 10);

		date.setDate(date.getDate() + 7);
		this.endDate = localStorage.getItem('farmout_endDate') ?
			localStorage.getItem('farmout_endDate') :
			date.toISOString().substring(0, 10);

		// Initialize Moment date models for datepicker
		this.startDateModel = moment(this.startDate, 'YYYY-MM-DD');
		this.endDateModel = moment(this.endDate, 'YYYY-MM-DD');

		this.searchText = this.$affiliateService.checkCookie('farmout_search') ?
			this.$affiliateService.getCookie('farmout_search')
			: "";

		this.useDateFilter = localStorage.getItem('farmOutuseDateFilter') ?
			(localStorage.getItem('farmOutuseDateFilter') == 'true' ? true : false)
			: false;
		console.log('farmOutuseDateFilter-->', this.useDateFilter)
		this.listTab = this.useDateFilter ? 'custom' :
			(localStorage.getItem('farmOutBookingsTab') == 'past' ? 'past' : 'upcoming');

		this.changeStatusForm = this.formBuilder.group({
			reservation_id: ['', Validators.required],
			booking_status: ['', Validators.required]
		});

		//send email booking form validation
		this.sendEmailForm = this.formBuilder.group({
			reservation_id: ['', Validators.required],
			emailTarget: ['', Validators.required]
		});

		//save currency symbol
		this.currencySymbol = this.stateManagementService.getCurrencySymbol();
		this.loadBookings(null, true)

		$("#search-field-farmout").addClass("box-outline")
		// this.MapController()

	}
	ngAfterViewInit(): void {
		$("#search-field-farmout").addClass("box-outline")
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
		/** spinner starts on init */
		// this.$spinner.show();
		if (pageUrl) {
			console.log("pageurl", pageUrl)
			this.scroll('farmout_bookings')
		}

		// var keyword = ((document.getElementById("keyword") as HTMLInputElement).value);
		// Load Our bookings using API
		const fallbackStartDate = this.startDate || moment().format('YYYY-MM-DD');
		const fallbackEndDate = this.endDate || moment().add(7, 'day').format('YYYY-MM-DD');
		const shouldSendDates = includeDatesInPayload || this.useDateFilter || !!this.searchText?.trim();
		let start = shouldSendDates ? moment(fallbackStartDate).format('YYYY-MM-DD') : moment(fallbackStartDate).format('YYYY-MM-DD');
		let end = shouldSendDates ? moment(fallbackEndDate).format('YYYY-MM-DD') : moment(fallbackEndDate).format('YYYY-MM-DD');
		this.$affiliateService.loadFarmoutBookings(pageUrl, this.searchText, start, end, this.useDateFilter, this.listFilter()).then(result => {
			this.$spinner.hide();//hide spinner
			console.log('result---->>>', result)
			this.bookingsRes = result;
			this.bookings = this.bookingsRes?.data?.data;
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
			if (this.bookingsRes?.data?.data.length == 0) {
				this.noError = true
			}
		})
			.catch(err => {
				this.$spinner.hide();//hide spinner
			});
	}
	FormatTime(time: string) {
		return moment(time, "HH:mm:ss").format("LT");
	}
	handleKeypressEvents() {
		clearTimeout(this.timer)
	}
	searchInBookings(search_value: string) {
		this.searchText = search_value ?? ""
		console.log('--->>>>>', search_value)
		clearTimeout(this.timer);
		this.timer = setTimeout(() => {
			if (this.startDate) {
				localStorage.setItem('farmout_startDate', this.startDate);
				this.saveCookie('farmout_startDate', this.startDate);
			}
			if (this.endDate) {
				localStorage.setItem('farmout_endDate', this.endDate);
				this.saveCookie('farmout_endDate', this.endDate);
			}
			this.saveCookie('farmout_search', this.searchText ?? "");
			this.loadBookings();
		}, 400)
	}
	/** Search button / Enter: skip the typing debounce. */
	submitSearch(search_value: string) {
		clearTimeout(this.timer);
		this.searchText = search_value ?? "";
		this.saveCookie('farmout_search', this.searchText);
		this.loadBookings(null, true);
	}

	/** The `filter` sent to the API: '' while on Custom, which uses the date range instead. */
	listFilter(): string {
		return this.listTab == 'custom' ? '' : this.listTab;
	}

	selectTab(tab: string) {
		this.listTab = tab;
		localStorage.setItem('farmOutBookingsTab', tab);
		this.handleChangeCheckbox(tab == 'custom');
		if (!this.useDateFilter) {
			this.loadBookings(null, true);
		}
	}

	saveCookie(key: string, value: string) {
		console.log('in function set cookies for', key, value)
		this.$affiliateService.setCookie(key, value, 30);
	}
	reset() {
		let date = new Date();
		this.startDate = date.toISOString().substring(0, 10);
		date.setDate(date.getDate() + 7);
		this.endDate = date.toISOString().substring(0, 10);

		// Reset models for datepickers
		this.startDateModel = moment(this.startDate, 'YYYY-MM-DD');
		this.endDateModel = moment(this.endDate, 'YYYY-MM-DD');

		// Clear Cookies
		this.$affiliateService.deleteCookie('farmout_startDate')
		this.$affiliateService.deleteCookie('farmout_endDate')
		this.$affiliateService.deleteCookie('farmout_search')

		// Clear localStorage
		localStorage.removeItem('farmout_startDate')
		localStorage.removeItem('farmout_endDate')
		localStorage.removeItem('farmOutuseDateFilter')
		localStorage.removeItem('farmOutBookingsTab')

		this.searchText = "";
		this.useDateFilter = false
		this.listTab = 'upcoming';

		console.log('Reset Successfully. ');
		if (this.startDate) {
			localStorage.setItem('farmout_startDate', this.startDate);
			this.saveCookie('farmout_startDate', this.startDate);
		}
		if (this.endDate) {
			localStorage.setItem('farmout_endDate', this.endDate);
			this.saveCookie('farmout_endDate', this.endDate);
		}
		this.saveCookie('farmout_search', this.searchText ?? "");
		this.loadBookings(null, true);
	}

	handleChangeCheckbox(value: any) {
		console.log('event---->> ', value)
		this.useDateFilter = value
		localStorage.setItem('farmOutuseDateFilter', value)
		if (!this.startDate || !this.endDate) {
			const date = new Date();
			this.startDate = date.toISOString().substring(0, 10);
			date.setDate(date.getDate() + 7);
			this.endDate = date.toISOString().substring(0, 10);
			this.startDateModel = moment(this.startDate, 'YYYY-MM-DD');
			this.endDateModel = moment(this.endDate, 'YYYY-MM-DD');
		}
		if (this.useDateFilter) {
			this.runBookingsSearch();
		}
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

	changeDate(dateType, date) {
		if (!date) {
			return;
		}

		if (dateType == 'startDate') {
			this.startDate = date;
			this.startDateModel = moment(this.startDate, 'YYYY-MM-DD');
			if (this.endDate && moment(this.startDate, 'YYYY-MM-DD').isAfter(moment(this.endDate, 'YYYY-MM-DD'), 'day')) {
				this.endDate = this.startDate;
				this.endDateModel = moment(this.endDate, 'YYYY-MM-DD');
				localStorage.setItem('farmout_endDate', this.endDate);
			}
			localStorage.setItem('farmout_startDate', date);
		}
		else {
			this.endDate = date;
			if (this.startDate && moment(this.endDate, 'YYYY-MM-DD').isBefore(moment(this.startDate, 'YYYY-MM-DD'), 'day')) {
				this.endDate = this.startDate;
			}
			this.endDateModel = moment(this.endDate, 'YYYY-MM-DD');
			localStorage.setItem('farmout_endDate', date);
		}
		if (this.useDateFilter) {
			this.runBookingsSearch();
		}
	}

	runBookingsSearch(pageUrl = null) {
		if (!this.useDateFilter) {
			return;
		}
		if (this.startDate) {
			localStorage.setItem('farmout_startDate', this.startDate);
			this.saveCookie('farmout_startDate', this.startDate);
		}
		if (this.endDate) {
			localStorage.setItem('farmout_endDate', this.endDate);
			this.saveCookie('farmout_endDate', this.endDate);
		}
		this.saveCookie('farmout_search', this.searchText ?? "");
		this.loadBookings(pageUrl);
	}
	FormatDate(date: string) {
		const m = moment(date);
		if (m.isSame(moment(), 'day')) {
			return 'Today';
		}
		return m.format("ll");
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
	cancelBooking() {
		console.log('in function cancel booking')
		this.$spinner.show();

		this.$affiliateService.cancelBooking(this.cancelBookingId)
			.pipe(
				catchError(err => {
					this.$spinner.hide();//hide spinner
					$('#cancelBooking').modal('hide');
					return throwError(err);
				})
			)
			.subscribe(({ data, success, message }: any) => {
				if (success == true) {
					this.loadBookings()
					$('#cancelBooking').modal('hide');
					// this.$errors.openDialog({
					// 	errors: {
					// 		error: `<span class='text-success'>${message}</span>`
					// 	}
					// })
				}
			});
	}

	openModal(booking: any, selection_button: string) {
		// Driver/affiliate contact stays closed until the booking is accepted.
		if (selection_button != 'Passenger' && selection_button != 'created_by' && !this.canShowContactInfo(booking?.booking_status)) return;
		console.log('open modal-->>>>>>>', selection_button)
		this.passengerDetails = booking;
		this.passengerDetails['selection_button'] = selection_button
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


	invoiceAction(bookingId) {
		console.log("in nivoice")
		if (this.currentUser.roleName == 'sub_affiliate') {
			this.$router.navigate(['/sub_affiliate/invoice-summary'], { queryParams: { bookingId: bookingId } });
		}
		else {
			this.$router.navigate(['/affiliate/invoice-summary'], { queryParams: { bookingId: bookingId } });
		}
	}

	editAction(bookingId, updateType) {
		if (this.currentUser.roleName == 'sub_affiliate') {
			this.$router.navigate(['/sub_affiliate/create-new-booking-v2'], { queryParams: { bookingId: bookingId, updateType: updateType, nav: 'false' } });
		}
		else {
			this.$router.navigate(['/affiliate/create-new-booking-v2'], { queryParams: { bookingId: bookingId, updateType: updateType, nav: 'false' } });
		}

	}
	finalizeAction(bookingId) {
		this.$router.navigate(['/affiliate/finalize-booking'], { queryParams: { bookingId: bookingId } });
	}
	previewRate(bookingId) {
		this.$router.navigate(['/affiliate/finalize-booking'], { queryParams: { bookingId: bookingId, editRate: true } });
	}
	sendEmailClicked(bookingId, emailTarget) {
		this.sendEmailForm.patchValue({
			reservation_id: bookingId,
			emailTarget: emailTarget
		});
	}
	auditTrail(bookingId: any) {
		console.log('In function audit trail', bookingId)
		this.$spinner.show()
		this.$affiliateService.auditTrailInfo(bookingId)
			.pipe(
				catchError((err) => {
					this.$spinner.hide()
					return throwError(err);
				})
			)
			.subscribe((response: any) => {
				this.$spinner.hide()
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

	@ViewChild('bookingPreviewModal') bookingPreviewModal: any;

	showBookingPreviewModal(booking_id: number) {
		if (this.bookingPreviewModal) {
			this.bookingPreviewModal.openPreview(booking_id);
		}
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
		// // this.spinner.show()
		this.$affiliateService.getLocationPoints(booking_id).subscribe((response: any) => {
			this.$spinner.hide();
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


	submit(message, format) {
		console.log('format', this.passengerDetails)
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
		} else {
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
		this.$affiliateService.affiliateNotification(obj)
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
	emailForm() {
		this.submitted = true;
		console.log(this.sendEmailForm);
		// stop here if form is invalid
		if (this.sendEmailForm.invalid) {
			return;
		}

		this.$spinner.show();

		this.$affiliateService.sendEmail(this.sendEmailForm.value)
			.pipe(
				catchError(err => {
					this.$spinner.hide();//hide spinner
					$('#emailModal').modal('hide');
					return throwError(err);
				})
			)
			.subscribe(({ data, success, message }: any) => {
				if (success == true) {
					this.$spinner.hide();//hide spinner
					$('#emailModal').modal('hide');
					if (this.currentUser.roleName == 'sub_affiliate') {
						this.$router.navigateByUrl('/RefreshComponent', { skipLocationChange: true }).then(() => {
							this.$router.navigate(['/sub_affiliate/my-bookings']);
						});
					}
					else {
						this.$router.navigateByUrl('/RefreshComponent', { skipLocationChange: true }).then(() => {
							this.$router.navigate(['/affiliate/my-bookings']);
						});
					}
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
