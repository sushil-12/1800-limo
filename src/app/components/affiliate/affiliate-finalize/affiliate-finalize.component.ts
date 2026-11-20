import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import * as moment from 'moment';
import { NgxSpinnerService } from 'ngx-spinner';
import { throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AdminService } from 'src/app/services/admin.service';
import { AffiliateService } from 'src/app/services/affiliate.service';
import { ErrorDialogService } from 'src/app/services/error-dialog/errordialog.service';
import { StateManagementService } from 'src/app/services/statemanagement.service';
declare var $: any;

@Component({
	selector: 'app-affiliate-finalize',
	templateUrl: './affiliate-finalize.component.html',
	styleUrls: ['./affiliate-finalize.component.scss']
})
export class AffiliateFinalizeComponent implements OnInit {

	public bookingId: any;
	public BookingDetail: any;
	public transferType: any;
	public deleteCardForm: FormGroup;
	cardForm: FormGroup
	init_rates: boolean = false;
	edit_rates_value: any;
	finalize_btn: any = 'Finalize'
	isCardFormOpen: boolean = false
	paymentMethod: string = 'card';
	CardsInformation: any = [];
	primaryCards: any = []
	selectedCard: any;
	paymentSection: boolean = true;
	chevron: boolean = true
	card_params = {
		years: (() => {
			let arr = []
			let i = 0;
			let year = new Date().getFullYear();
			while (i <= 15) {
				arr.push(year + i);
				i++;
			}
			return arr
		})(),
	}

	finalize_params = {
		distance: 0,
		number_of_hours: 0,
		number_of_vehicles: 0,
		booking_id: 0
	}
	quoteAmount: any;
	hours: any;
	main_receipt_url: any;
	paymentDetailByCard: any;
	isTravelShare: boolean;
	editRate: any;
	isCreatedByAdmin: boolean = true;
	shareArray: any;
	r_shareArray: any;
	adminSharePercent: number = 25;
	service_type: any;
	isFarmoutBooking: boolean = false;
	isFinalizeButton: boolean = false;
	bookdataresp: any;
	currencySymbol: any;
	paidAmount: any;
	currentUser: any;
	is_readonly_min_rate: boolean = false;
	paymentSuccessMessage: String = '';
	finalizeDataForm: FormGroup;
	submittedForm: boolean;
	wait_time_cost: any;
	showAlert: boolean = false;

	constructor(
		private $api: AdminService,
		private affiliateService: AffiliateService,
		private $form: FormBuilder,
		private router: Router,
		private spinner: NgxSpinnerService,
		private $errors: ErrorDialogService,
		private fb: FormBuilder,
		private activatedroute: ActivatedRoute,
		private stateManagementService: StateManagementService,
	) { }

	ngOnInit(): void {

		this.currentUser = JSON.parse(localStorage.getItem('currentUser'))
		// this.spinner.show()
		this.buildingCardForm();
		this.activatedroute.queryParams
			.subscribe((params) => {
				this.bookingId = params?.bookingId
				this.editRate = params?.editRate
				console.log("booking id---->>>>>>", this.bookingId,)

				if (!this.bookingId) {
					this.router.navigate([this.portalBasePath + '/my-bookings']);
				}
				else {
					// this.buildChargesFormGroup()
					// this.chargesForm.get('reservation_id').setValue(this.bookingId)
					this.getBookingData()
					this.paymentDetail(this.bookingId)
					this.scroll('submitForm')
				}
			});
		this.deleteCardForm = this.$form.group({
			cardId: ["", Validators.required],
			accId: ["", Validators.required],
		});

		this.finalizeDataForm = this.$form.group({
			waiting_time_in_mins: [0, [Validators.pattern("^[0-9+]*$")]],
		})

		//save currency symbol
		this.currencySymbol = this.stateManagementService.getCurrencySymbol();
	}

	scroll(id) {
		let el = document.getElementById(id);
		console.log(`scrolling to ${id}`, el);
		el?.scrollIntoView({ behavior: 'smooth' });
	}

	get canCharge(): boolean {
		return this.BookingDetail?.payment_status == 'unpaid'
	}

	get f() {
		return this.finalizeDataForm.controls;
	}


	getBookingData(booking_id: number = 0) {
		this.affiliateService.getBookingData(this.bookingId)
			.pipe(
				catchError(err => {
					this.spinner.hide();//hide spinner
					return throwError(err);
				})
			).subscribe(({ data }: any) => {
				console.log('response getBookingData Affiliate--->>>>', data)
				this.bookdataresp = data
				this.BookingDetail = data?.booking_detail
				this.finalizeDataForm.patchValue({
					waiting_time_in_mins: this.BookingDetail?.waiting_time_in_mins ?? 0
				})
				this.wait_time_cost = this.BookingDetail?.wait_time_cost
				this.isFinalizeButton = this.BookingDetail?.booking_status == 'finalized' ? true : false,
					this.transferType = this.BookingDetail?.transfer_type
				this.paidAmount = this.BookingDetail?.charged_amount
				this.isTravelShare = data?.booking_detail?.account_type == 'travel_planner' ? true : false
				this.isFarmoutBooking = data?.booking_detail?.reservation_type == 'farmout' ? true : false
				this.finalize_params.number_of_vehicles = data?.booking_detail?.number_of_vehicles
				this.is_readonly_min_rate = data?.booking_detail?.min_rate_involved ? true : false
				this.init_rates = true;
				this.hours = data?.booking_detail?.number_of_hours
				this.finalize_params['number_of_hours'] = this.BookingDetail.number_of_hours
				this.isCreatedByAdmin = data?.booking_detail?.created_by == 1 ? true : false
				this.service_type = data?.booking_detail?.service_type
				this.quoteAmount = data?.grand_total
				this.CardsInformation = data?.CreditCardsDetail
				this.primaryCards = this.CardsInformation
				console.log('primary cards--->>>>', this.primaryCards, this.primaryCards.length)
				this.selectedCard = this.primaryCards[this.primaryCards.length - 1]
				console.log('selected cards ----->>>', this.selectedCard)
				setTimeout(() => {
					this.scroll('submitForm')

				}, 600)
			})
	}


	textFormatter(text: string) {
		try {
			return text?.replace(/[\\\_$]+/g, ' ')
		}
		catch {
			return text
		}
	}

	HandleReturnNumberOfHr(data: any) {
		console.log('____<><><><><><><><>', data)
		this.finalize_params['number_of_hours'] = data
	}
	dateFormat(value: any) {
		if (value) {
			return moment(value, 'YYYY-MM-DD').format('ll')
		}
	}

	dateFormat2(value: any) {
		if (value) {
			return moment(value, 'YYYY-MM-DD').format('L')
		}
	}

	timeFormat(value: any) {
		if (value?.toUpperCase() == '12:00 AM') {
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
		if (value) {
			return moment(value, 'HH:mm a').format('h:mm a');
		}
	}
	RateFormValue(form: any) {
		console.log('rate form value ------>>>>', form)
		this.edit_rates_value = form
		this.createReservationShareArray()
		if (this.BookingDetail?.booking_status == 'finalized') {
			if (this.edit_rates_value.grand_total != this.bookdataresp?.grand_total) {
				this.isFinalizeButton = false
			}
			else {
				this.isFinalizeButton = true
			}
		}
		else {
			this.isFinalizeButton = false
		}
	}
	paymentDetail(bookingId) {
		this.$api
			.getPaymentDetailFinalize(bookingId)
			.pipe()
			.subscribe((response: any) => {
				console.log(response.data, "check response paymentDetail");
				if (response.data) {
					this.main_receipt_url = response?.data?.main_receipt_url
					this.paymentDetailByCard = response?.data?.charges
				}
			});
	}
	acceptRejectButton(type: string) {
		console.log("in func accpe and reject", type)
		if (type == 'reject') {
			console.log('in function cancel booking', this.bookingId)
			this.spinner.show();

			this.affiliateService.cancelBooking(this.bookingId)
				.pipe(
					catchError(err => {
						this.spinner.hide();//hide spinner
						// $('#cancelBooking').modal('hide');
						return throwError(err);
					})
				)
				.subscribe(({ data, success, message }: any) => {
					this.spinner.hide();//hide spinner
					this.$errors.openDialog({
						errors: {
							error: `<span class='${success ? 'text-success' : 'text-danger'}'>${message}</span>`
						}
					});
					if (success == true) {
						this.router.navigate([this.portalBasePath + '/my-bookings']);
					}
				});

		}
		else {
			console.log('in function accept booking', this.bookingId)
			this.spinner.show();

			this.affiliateService.acceptBooking(this.bookingId)
				.pipe(
					catchError(err => {
						this.spinner.hide();//hide spinner
						// $('#acceptBooking').modal('hide');
						return throwError(err);
					})
				)
				.subscribe(({ data, success, message }: any) => {
					this.spinner.hide();//hide spinner
					if (success == true) {
						this.router.navigate([this.portalBasePath + '/my-bookings']);
					}
				});
		}
	}
	createReservationShareArray() {
		console.log('in function createReservationShareArray')
		if (this.edit_rates_value) {
			const vehiclesMultiplier = this.finalize_params.number_of_vehicles != 0 ? this.finalize_params.number_of_vehicles : 1;
			let base_rate = this.edit_rates_value?.all_inclusive_rates?.["Base_Rate"]?.amount
				?? this.edit_rates_value?.all_inclusive_rates?.["Base_Rate"]?.baserate
				?? 0;
			['ELH_Charges', 'Stops', 'Wait'].map((key) => {
				base_rate += this.edit_rates_value?.all_inclusive_rates?.[key]?.amount
					?? this.edit_rates_value?.all_inclusive_rates?.[key]?.baserate
					?? 0;
			});
			for (const key of Object.keys(this.edit_rates_value.amenities)) {
				base_rate += this.edit_rates_value?.amenities?.[key]?.amount
					?? this.edit_rates_value?.amenities?.[key]?.baserate
					?? 0;
			}
			base_rate *= vehiclesMultiplier

			const grandTotal = this.edit_rates_value.grand_total
			const stripeFee = grandTotal * 0.05 + 0.30
			const extraGratuityShare = ((this.edit_rates_value?.misc?.Extra_Gratuity?.amount ?? 0) * 0.25) * vehiclesMultiplier
			const isTravelBooking = this.BookingDetail?.account_type == 'travel_planner' && !this.isCreatedByAdmin;
			const adminSharePercent = isTravelBooking || this.isFarmoutBooking ? 15 : 25;
			const travelAgentShare = isTravelBooking ? base_rate * 0.10 : 0;
			const farmoutShare = this.isFarmoutBooking ? base_rate * 0.10 : 0;
			const adminShare = (base_rate * adminSharePercent) / 100 + extraGratuityShare;
			const deducted_admin_share = adminShare - stripeFee
			const shareArray: any = {
				baseRate: base_rate,
				grandTotal,
				stripeFee,
				adminShare,
				deducted_admin_share,
				affiliateShare: grandTotal - base_rate * 0.25

			}

			if (travelAgentShare) {
				shareArray['travelAgentShare'] = travelAgentShare
			}

			if (farmoutShare) {
				shareArray['farmoutShare'] = farmoutShare
			}
			this.shareArray = shareArray
			// console.log('in function createReservationShareArray-->>>' , base_rate, shareArray )
			return shareArray;
			// value['rateArray'] = JSON.parse(JSON.stringify(this.edit_rates_value))
		}
	}
	submitForm() {

		this.submittedForm = true;
		if (this.finalizeDataForm.invalid) {
			return;
		}

		this.spinner.show();

		let rateArray = JSON.parse(JSON.stringify(this.edit_rates_value))
		if (rateArray.all_inclusive_rates.Base_Rate.rate_label == "Minimum Rate") {
			rateArray.all_inclusive_rates.Base_Rate.rate_label = "Base Rate"
		}
		delete rateArray.sub_total
		delete rateArray.grand_total
		this.createReservationShareArray()
		let body = {
			reservation_id: this.bookingId,
			rateArray: rateArray,
			sub_total: this.edit_rates_value.sub_total,
			grand_total: this.edit_rates_value.grand_total,
			number_of_hours: this.finalize_params['number_of_hours'],
			shareArray: this.shareArray,
			waiting_time_in_mins: this.finalizeDataForm.get('waiting_time_in_mins').value
		}
		console.log('final obj -------------->>>>>>>', body)
		console.log('\n\n Submitting Form', body);
		this.affiliateService.updateFinalizeRates(body).subscribe((response: any) => {
			this.spinner.hide()
			// this.$errors.openDialog({
			// 	errors: {
			// 		error: `<span class='text-success'>${response.message}</span>`
			// 	}
			// })
			// this.$router.navigate(['/admin/daily-bookings-admin'])
			console.log('response-->>', response)
			this.finalize_btn = "Finalized"
			this.isFinalizeButton = true;
			this.getBookingData(this.bookingId)
			this.showAlert = true;
			setTimeout(() => {
				this.scroll('paymentOptionsDiv');
			}, 600);
		})


	}

	resetCardForm() {
		this.cardForm.reset()
	}
	deleteCardClicked(item: any) {
		this.deleteCardForm.patchValue({
			cardId: item.ID,
			accId: this.BookingDetail.acc_id,
		});
	}
	handleChangeCard(card: any) {
		this.selectedCard = card
	}
	handlePaymentSection() {
		this.chevron = !this.chevron
		this.paymentSection = !this.paymentSection
	}
	buildingCardForm() {
		this.cardForm = this.$form.group({
			name: ['', [Validators.required]],
			card_number: ['', [Validators.required, Validators.pattern("^[0-9+]*$"), Validators.minLength(12), Validators.maxLength(20)]],
			exp_month: ['', Validators.required],
			exp_year: ['', Validators.required],
			cvv: ['', [Validators.required, Validators.pattern("^[0-9+]*$")]],
			save_card_detail: [false]
		})
	}
	changeDetection(method: string) {
		if (method == 'new_card') {
			this.isCardFormOpen = true
			this.paymentMethod = 'card'
		} else {
			this.paymentMethod = method
			this.isCardFormOpen = false
		}
	}
	makePayment(method: string) {

		console.log('In function make payment', method)
		if (method == 'new_card') {
			this.isCardFormOpen = true
			this.paymentMethod = 'card'
		} else {
			this.paymentMethod = method
			this.isCardFormOpen = false
		}
		// /affiliate/finalize-rate-edit'
		console.log('<<<<-----handle valid---->>>>> ', this.cardForm.valid, 'is card form open--->>>>', this.isCardFormOpen)
		console.log('-----=====?>>>>>', this.isCardFormOpen ? this.cardForm.valid : (this.CardsInformation.length > 0))
		let dataToSend: any
		if (this.paymentMethod == 'cash') {
			console.log('<<<<<----payment through cash-->>>>')
			dataToSend = {
				reservation_id: this.bookingId,
				grand_total: this.edit_rates_value?.grand_total,
				paymentMethod: 'cash'
			}
			this.spinner.show()
			this.affiliateService.paymentProcessing(dataToSend).subscribe((response: any) => {
				// this.$errors.openDialog({
				// 	errors: {
				// 		error: `<span class='text-success'>${response.message}</span>`
				// 	}
				// })
				this.router.navigate([this.portalBasePath + '/invoice-summary'], { queryParams: { bookingId: this.bookingId } });
				console.log('response---------------------->>', response)
				this.spinner.hide()
			})
		}
		else {
			console.log('in else----->>>>>>>>..')
			if (this.isCardFormOpen ? this.cardForm.valid : (this.CardsInformation.length > 0)) {
				console.log('validation clear-_>>>>>>>>>>')
				if (this.paymentMethod == 'cash') {
					console.log('<<<<<----payment through cash-->>>>')
					dataToSend = {
						reservation_id: this.bookingId,
						grand_total: this.edit_rates_value.grand_total,
						paymentMethod: 'cash'
					}
				}
				else {
					if (this.isCardFormOpen) {
						dataToSend = {
							CreditCardsDetail: { ...this.cardForm.value },
							isExistingCard: false,
							paymentMethod: 'credit_card',
							reservation_id: this.bookingId,
							grand_total: this.edit_rates_value.grand_total
						}
						console.log('<<<<--card form detail-->>>')
					}
					else {
						dataToSend = {
							isExistingCard: true,
							paymentMethod: 'credit_card',
							CreditCardsDetail: {
								cardID: this.selectedCard?.ID
							},
							reservation_id: this.bookingId,
							grand_total: this.edit_rates_value.grand_total
						}
						console.log('selected card-->>>', this.selectedCard)
					}
				}
				console.log('<<<<<<<<---- data to send --->>>>>', dataToSend)
				this.spinner.show()
				this.affiliateService.paymentProcessing(dataToSend).subscribe((response: any) => {
					// this.$errors.openDialog({
					// 	errors: {
					// 		error: `<span class='text-success'>${response.message}</span>`
					// 	}
					// })
					this.spinner.hide()
					$('#paymentSuccessModal').modal('show')
					this.paymentSuccessMessage = response?.data?.message
					console.log('response---------------------->>', response)
					this.spinner.hide()
					setTimeout(() => {
						this.redirecttodailybooking()
					}, 2500)
				})
			}
			else {
				console.log('<<<<-----handle valid---->>>>> ', this.cardForm.valid)
				if (!this.CardsInformation.length && !this.isCardFormOpen) {
					this.$errors.openDialog({
						errors: {
							error: `<span class='text-danger'> No card selected</span>`
						}
					})
				}
				else {
					this.$errors.openDialog({
						errors: {
							error: `<span class='text-danger'>Please Enter correct card details</span>`
						}
					})
				}
			}
		}

	}

	/** Route prefix of the portal the current user belongs to (affiliate, sub-affiliate or affiliate driver). */
	get portalBasePath(): string {
		switch (this.currentUser?.roleName) {
			case 'sub_affiliate': return '/sub_affiliate';
			case 'affiliate_driver': return '/affiliate_driver';
			default: return '/affiliate';
		}
	}

	redirecttodailybooking() {
		$('#paymentSuccessModal').modal('hide')
		this.router.navigate([this.portalBasePath + '/invoice-summary'], { queryParams: { bookingId: this.bookingId } });
	}

	deleteCard() {
		// this.spinner.show()
		// this.api.deleteCardFinalize(this.deleteCardForm.value.cardId,this.deleteCardForm.value.accId).subscribe((response: any) => {
		// 	this.$errors.openDialog({
		// 		errors: {
		// 			error: `<span class='text-success'>${response.message}</span>`
		// 		}
		// 	})
		// 	// this.$router.navigate(['/admin/daily-bookings-admin'])
		// 	this.$spinner.hide()
		// 	this.getReservationDetails(this.bookingId)
		// })
		// $('#warnDeleteCard').modal('hide')		
	}
}
