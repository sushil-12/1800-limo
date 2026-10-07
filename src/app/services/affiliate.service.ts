import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import * as moment from 'moment';
import { AffiliateLookupParams, buildAffiliateLookupParams } from '../utils/affiliate-lookup';

@Injectable({
	providedIn: 'root'
})
export class AffiliateService {
	adminNotification(obj: { bookingId: any; reciptentName: any; sendTo: any; sendThrough: string; sendValue: any; sendContent: any; }) {
		throw new Error('Method not implemented.');
	}
	big_data_list: any
	current_date: any;
	current_time: any;

	private environmentServerUrl = environment.serverUrl;
	private serverUrl = environment.serverUrl + 'affiliate/';

	constructor(private httpClient: HttpClient) {
		if (this.big_data_list == undefined) {
			this.createBookingGetData().subscribe((response: any) => {
				this.big_data_list = response?.data
			})
		}

		let date = new Date();
		let timestamp = date.getTime();

		const hours = String(date.getHours()).padStart(2, '0');
		const minutes = String(date.getMinutes()).padStart(2, '0');
		const seconds = String(date.getSeconds()).padStart(2, '0');

		this.current_date = moment(timestamp).format("YYYY-MM-DD");
		this.current_time = `${hours}:${minutes}:${seconds}`;

	}


	getCookie(keyword: string): null | string {
		let ca = document.cookie.split(';');
		for (let i = 0; i < ca.length; i++) {
			if (ca[i].trim().indexOf(keyword) == 0) {
				return ca[i].substring(ca[i].indexOf('=') + 1, ca[i].length)
			}
		}
		return null
	}

	checkCookie(keyword: string): boolean {
		let required_cookie = this.getCookie(keyword)
		if (required_cookie && required_cookie != '') {
			return true
		}
		return false
	}

	setCookie(key: string, value: string, exdays: number): boolean {
		const date = new Date()

		date.setTime(date.getTime() + (exdays * 24 * 60 * 60 * 1000));
		document.cookie = `${key}=${value};expires=${date.toUTCString()};`;

		// check if the cookies is successfully set
		if (this.checkCookie(key)) {
			return true
		}
		return false
	}

	deleteCookie(key: string) {
		document.cookie = `${key}=' ';expires=Thu, 01 Jan 1970 00:00:00 UTC;`;
	}


	getBigData() {
		return this.big_data_list
	}


	fetchStep0Data() {
		return this.httpClient.get(`${this.environmentServerUrl}affiliate/cms/get-step0`)
	}

	fetchStepData(step_name: string) {
		return this.httpClient.get(`${this.serverUrl}cms/${step_name}`)
	}

	updateStepsArrayLocal(stepArray) {
		// update complete array
		localStorage.setItem('stepCompleted', stepArray.toString())
	}
	updateStepsLocal(step) {
		//add one step at a time
		let stepCompleted: any = localStorage.getItem('stepCompleted');
		if (stepCompleted) {
			stepCompleted = stepCompleted.split(',');
			if (!stepCompleted.includes(step)) {
				stepCompleted.push(step);
				localStorage.setItem('stepCompleted', stepCompleted.toString())
			}
		}
		else {
			stepCompleted = [step];
			localStorage.setItem('stepCompleted', stepCompleted.toString())
		}
	}
	getLocalStepCompleted() {
		//get step completed array
		return localStorage.getItem('stepCompleted').split(',');
	}
	getUpdatedStepsLocal(step) {
		//update step completed array and prepare array to send in backend
		let stepCompleted: any = localStorage.getItem('stepCompleted');
		if (stepCompleted) {
			stepCompleted = stepCompleted.split(',');
			if (!stepCompleted.includes(step)) {
				stepCompleted.push(step);
			}
		}
		else {
			stepCompleted = [step];
		}
		return stepCompleted;
	}
	// get/set step completed object
	updateStepsCompletedObject(stepObject: any) {
		// update complete object
		localStorage.setItem('step_completed_obj', JSON.stringify(stepObject))
	}
	getLocalStepCompletedObject() {
		//get step completed object
		return JSON.parse(localStorage.getItem('step_completed_obj'));
	}

	getStepsCompleted() {
		return this.httpClient.get(this.serverUrl + 'get-affiliate-register-step-completed');
	}





	/**
	 * 
	 * --------------------------------------------------------------------------------------
	 *  
	 */
	agreementAcceptance(data) {
		return this.httpClient.post(this.serverUrl + 'agreement-acceptance', data);
	}
	getAssicationsLanguages() {
		return this.httpClient.get(this.serverUrl + 'get-associations-languages-array');
	}
	addAffiliateAccount(data) {
		if (data.acc_id)//edit affiliate
		{
			return this.httpClient.put(this.serverUrl + 'edit-affiliate-basic-info', data);
		}
		else//add affiliate
		{
			return this.httpClient.post(this.serverUrl + 'add-affiliate-basic-info', data);
		}
	}

	getAffiliateAccount(id) {
		return this.httpClient.get(this.serverUrl + 'get-affiliate-basic-info/' + id);
	}

	addBankOfAffiliate(data) {
		if (data.id)//edit affiliate
		{
			return this.httpClient.put(this.serverUrl + 'edit-affiliate-bank-ccdetail', data);
		}
		else//add affiliate
		{
			return this.httpClient.post(this.serverUrl + 'add-affiliate-bank-ccdetail', data);
		}
	}
	getBankOfAffiliate(id) {
		return this.httpClient.get(this.serverUrl + 'get-affiliate-bank-detail/' + id);
	}
	stripeRefreshAccountLink(accountID) {
		return this.httpClient.post(this.serverUrl + 'stripe-refresh-account-link', { 'accountID': accountID });
	}
	stripeUpdateUrl(accountID) {
		return this.httpClient.get(this.serverUrl + 'get-stripe-update-url/' + accountID);
	}
	requestAddressChange(data) {
		return this.httpClient.post(this.serverUrl + 'request-stripe-address-change', data);
	}
	addCard(data) {
		return this.httpClient.post(this.serverUrl + 'add-aff-credit-card', data);
	}
	getCard(id) {
		return this.httpClient.get(this.serverUrl + 'credit-card/' + id);
	}
	editCard(data) {
		return this.httpClient.put(this.serverUrl + 'edit-credit-card', data);
	}
	cardStatus(id) {
		return this.httpClient.delete(this.serverUrl + 'delete-aff-credit-card/' + id);
	}

	addInsuranceDetail(data) {
		if (data.id)//edit affiliate
		{
			return this.httpClient.put(this.serverUrl + 'edit-vehicle-insurance-detail', data);
		}
		else//add affiliate
		{
			return this.httpClient.post(this.serverUrl + 'add-vehicle-insurance-detail', data);
		}
	}
	getInsuranceDetail(id) {
		return this.httpClient.get(this.serverUrl + 'get-vehicle-insurance-detail/' + id);
	}
	uploadVehicleImage(image) {
		return this.httpClient.post(this.serverUrl + 'add-single-image', { 'image': image });
	}
	deleteImage(id) {
		return this.httpClient.delete(this.serverUrl + 'delete-image/' + id);
	}

	getSignatureImage() {
		return this.httpClient.get(this.serverUrl + 'getstep6');
	}

	//Driver
	async driverList(id) {
		const result = await this.httpClient.get(this.serverUrl + 'get-affiliate-drivers?affiliate_id=' + id).toPromise();
		return result;
	}
	async getAffiliateDriver(id) {
		const result = await this.httpClient.get(this.serverUrl + 'get-affiliate-driver/' + id).toPromise();
		return result;
	}
	addDriver(data) {
		if (data.id)//edit affiliate
		{
			return this.httpClient.put(this.serverUrl + 'edit-affiliate-driver', data);
		}
		else//add affiliate
		{
			return this.httpClient.post(this.serverUrl + 'add-affiliate-driver', data);
		}
	}
	getDriver(id) {
		return this.httpClient.get(this.serverUrl + 'get-affiliate-driver/' + id);
	}
	editDriver(data) {
		return this.httpClient.put(this.serverUrl + 'edit-driver', data);
	}
	driverStatus(id, status) {
		return this.httpClient.put(this.serverUrl + 'change-affiliate-driver-status', { 'id': id, 'status': status });
	}
	driverDressLanguage() {
		return this.httpClient.get(this.serverUrl + 'driver-dresses-languages-array');
	}

	//Vehicles 
	async affiliateVehicleList(show_all_vehicles) {
		const result = await this.httpClient.get(this.serverUrl + `get-affiliate-vehicles?show_all_vehicles=${show_all_vehicles}`).toPromise();
		return result;
	}
	async getVehicleDataByAffiliateId(affiliate_id) {
		const result = await this.httpClient.get(this.serverUrl + 'get-affiliate-vehicles/' + affiliate_id).toPromise();
		return result;
	}
	getFieldsData() {
		return this.httpClient.get(this.serverUrl + 'vehicle-data');
	}
	submitVehicle(data) {
		return this.httpClient.post(this.serverUrl + 'add-vehicle-by-affiliate', data);
	}
	getVehicleData(id) {
		return this.httpClient.get(this.serverUrl + 'get-vehicle-detail/' + id);
	}
	editVehicle(data) {
		return this.httpClient.put(this.serverUrl + 'edit-vehicle-by-affiliate', data);
	}
	updateVehicleSortOrders(data) {
		return this.httpClient.post(this.serverUrl + 'update-sort-order-for-vehicle', data);
	}
	duplicateVehicle(data) {
		return this.httpClient.post(this.serverUrl + 'duplicate-affiliate-vehicle', data);
	}
	vehicleStatus(id, status) {
		return this.httpClient.put(this.serverUrl + 'change-vehicle-status', { 'id': id, 'status': status });
	}
	//vehicle rates 
	getVehicleInfo(vehicleId, relative_vehicle_id: any = null) {
		if (relative_vehicle_id) {
			return this.httpClient.get(this.serverUrl + `get-vehicle-info/${vehicleId}?relative_vehicle_id=${relative_vehicle_id}`);

		}
		else {

			return this.httpClient.get(this.serverUrl + 'get-vehicle-info/' + vehicleId);
		}
	}
	addVehicleRates(data) {
		return this.httpClient.post(this.serverUrl + 'add-affiliate-vehicle-fare', data);
	}
	getVehicleRates(id) {
		return this.httpClient.get(this.serverUrl + 'get-affiliate-vehicle-fare/' + id);
	}
	editVehicleRates(data, duplicateVehicleId: any = null) {
		if (data.id && !duplicateVehicleId)//edit vehicle rate
		{
			console.log('Editing Rates')
			return this.httpClient.put(this.serverUrl + 'edit-affiliate-vehicle-fare', data);
		}
		else//add vehicle rate
		{
			console.log('Adding Rates')
			return this.httpClient.post(this.serverUrl + 'add-affiliate-vehicle-fare', data);
		}
	}

	affiliateTermsAccept(data) {
		return this.httpClient.put(this.serverUrl + 'affiliate-steps-completion', data);
	}
	checkAffiliateAccountStatus() {
		return this.httpClient.get(this.serverUrl + 'get-affiliate-approval-status');
	}
	getLocationPoints(booking_id: number) {
		return this.httpClient.get(`${this.serverUrl}booking-location/${booking_id}`)
	}
	getBookingPreview(reservation_id: number) {
		return this.httpClient.get(`${this.serverUrl}get-booking-preview/${reservation_id}`);
	}
	auditTrailInfo(bookingId) {
		return this.httpClient.get(this.serverUrl + `booking-audit-records/${bookingId}`)
	}
	affiliateNotification(data) {
		return this.httpClient.post(this.serverUrl + 'notification-daily-booking', data);
	}
	updateFinalizeRates(data) {
		return this.httpClient.post(`${this.serverUrl}finalize-rate-edit`, data)
	}
	async affiliateGetVehicleData() {
		const result = await this.httpClient.get(this.serverUrl + 'get-all-vehicles').toPromise();
		return result;
	}
	sendInvoiveToCustomer(bookingId: any) {
		return this.httpClient.get(`${this.serverUrl}send-invoice/${bookingId}`)
	}
	refund(body: any) {
		return this.httpClient.post(`${this.serverUrl}refund-request`, body)
	}

	//Booking
	loadBookings(url, keyword, startDate, endDate, useDateFilter, filter = '') {
		// filter: 'upcoming' | 'past' | 'needs_action' tab; '' = date range (Custom tab).
		const now = moment();
		const query = 'from=' + startDate + '&to=' + endDate + '&search=' + encodeURIComponent(keyword ?? '') + '&useDateFilter=' + useDateFilter + '&filter=' + filter + '&current_date=' + now.format('YYYY-MM-DD') + '&current_time=' + now.format('HH:mm:ss') + '&v1=1';
		// Paginator links already carry `?page=N`.
		const path = url
			? url + (url.includes('?') ? '&' : '?') + query
			: this.serverUrl + 'get-bookings?' + query;
		return this.httpClient.get(path).toPromise();
	}
	loadFarmoutBookings(url, keyword, startDate, endDate, useDateFilter, filter = '') {
		// filter: 'upcoming' | 'past' tab; '' = date range (Custom tab).
		const query = 'from=' + startDate + '&to=' + endDate + '&search=' + encodeURIComponent(keyword ?? '') + '&useDateFilter=' + useDateFilter + '&filter=' + filter + '&current_date=' + this.current_date + '&current_time=' + this.current_time + '&v1=1';
		// Paginator links already carry `?page=N`.
		const path = url
			? url + (url.includes('?') ? '&' : '?') + query
			: this.serverUrl + 'get-farm-out-bookings?' + query;
		return this.httpClient.get(path).toPromise();
	}
	//change booking status such as accept/reject
	changeStatusBooking(data) {
		return this.httpClient.put(this.serverUrl + 'change-affiliate-booking-status', data);
	}
	//send email to affiliate, customer etc
	sendEmail(data) {
		return this.httpClient.post(this.serverUrl + 'reservation-detail-email', data);
	}
	rejectBooking(id) {
		return this.httpClient.get(this.serverUrl + 'change-booking-status/rejected/' + id)
	}
	acceptBooking(id) {
		return this.httpClient.get(this.serverUrl + 'change-booking-status/accepted/' + id)
	}

	cancelBooking(id) {
		return this.httpClient.get(this.serverUrl + 'cancel-booking/' + id)
	}



	//Create booking
	createBookingGetData() {
		// return this.httpClient.get(this.environmentServerUrl + 'pre-request-booking-data');
		return this.httpClient.get(this.environmentServerUrl + 'amenities-languages-dresses');

	}
	getAccountBytype(accountType, params?: AffiliateLookupParams) {
		return this.httpClient.get(this.serverUrl + 'get-account-by-type/' + accountType, {
			params: buildAffiliateLookupParams(params)
		});
	}
	getBookingDataForEdit(id) {
		return this.httpClient.get(this.serverUrl + 'get-reservation/' + id);
	}
	chooseUser(id, accountType) {
		switch (accountType) {
			case 'individual': {
				return this.httpClient.get(this.serverUrl + 'get-an-individual-account/' + id);
			}
			case 'corporate': {
				return this.httpClient.get(this.serverUrl + 'get-corporate-account/' + id);
			}
			case 'travel_planner': {
				return this.httpClient.get(this.serverUrl + 'get-travel-planner-account/' + id);
			}
			default: {
				return this.httpClient.get(this.serverUrl + 'get-affiliate-account/' + id);
			}
		}
	}
	createBooking(data) {
		if (data.reservation_id)//edit affiliate
		{
			return this.httpClient.put(this.serverUrl + 'edit-reservation', data);
		}
		else//add affiliate
		{
			return this.httpClient.post(this.serverUrl + 'create-reservation', data);
		}
	}
	getBookingData(id) {
		if (id)
			return this.httpClient.get(this.serverUrl + 'get-reservation-detail/' + id);
	}
	fetchBookingRates(id) {
		return this.httpClient.get(this.serverUrl + 'reservation-rates/' + id);
	}
	finalizeRates(id) {
		return this.httpClient.get(this.serverUrl + 'reservation-rates/' + id);
	}
	paymentProcessing(data) {
		return this.httpClient.post(this.serverUrl + 'affiliate-payment-processing', data);
	}
	finalizePayment(data) {
		return this.httpClient.post(this.serverUrl + 'finalize-rate-edit', data);
	}
	//invoices
	getInvoiceData(id) {
		return this.httpClient.get(this.serverUrl + 'invoice-summary/' + id);
	}
	//Profile related API
	getProfileDetail() {
		return this.httpClient.get(this.serverUrl + 'profile-detail');
	}
	uploadProfilePicture(image) {
		return this.httpClient.post(this.serverUrl + 'profile-detail/upload-image', { 'image': image });
	}
	deactivateAffiliateAccount() {
		return this.httpClient.put(this.serverUrl + 'deactivate-account', {});
	}
	getAllEnableBadgeCities() {
		return this.httpClient.get(this.serverUrl + 'all-enabled-badge-cities');
	}
	getCurrencies() {
		return this.httpClient.get('assets/json/currencyOptions.json')
	}

	get charterOptions() {
		return this.httpClient.get('assets/json/charterOptions.json')
	}

	get proDriverYears() {
		return this.httpClient.get('assets/json/proDriverYear.json')
	}



	affiliateVerificationStatus(user_account_id: number) {
		return this.httpClient.get(`${this.serverUrl}verification-status/${user_account_id}`)
	}



	// ------------------------ Farm Out Bookings -------------------------

	initialiseFarmout(): boolean {
		// check if the selected vehicle and logged in affiliate is same ?
		const sel_veh = JSON.parse(sessionStorage.getItem('selected_vehicle'))

		if (sel_veh != null && sel_veh.affiliate_id != "") {
			return sel_veh.affiliate_id
		}
		return false
	}

	createNewSubAgent(data, updateBasicInfo) {
		if (updateBasicInfo) {
			return this.httpClient.post(this.serverUrl + 'update-a-travel-agent', data);
		}
		else {
			return this.httpClient.post(this.serverUrl + 'create-a-new-travel-agent', data);
		}
	}

	//sub affiliate
	addSubAffiliate(data) {
		if (data?.acc_id) {
			return this.httpClient.put(this.serverUrl + 'update-sub-affiliate', data);
		}
		else {
			return this.httpClient.post(this.serverUrl + 'add-sub-affiliate', data);
		}
	}

	//get sub aff accounts list
	getsubAffAccounts(url, keyword) {
		var path;
		if (url) {
			path = url + '&search=' + keyword;
		}
		else {
			path = this.serverUrl + 'get-sub-affiliates' + '?search=' + keyword;
		}
		return this.httpClient.get(path).toPromise();;
	}

	//chnage sub aff account status
	subAffAccountStatus(id, status) {
		return this.httpClient.put(this.serverUrl + 'change-account-status', { 'acc_id': id, 'status': status });
	}

	getSubAddDetailsById(id) {
		return this.httpClient.get(this.serverUrl + `get-sub-affiliate-account/${id}`).toPromise();
	}

	subAffNotificationStatus(id, status) {
		return this.httpClient.put(this.serverUrl + 'change-notification-status', { 'acc_id': id, 'status': status });
	}

	chargeBackPermission(acc_id, permission) {
		return this.httpClient.post(this.serverUrl + 'charge-back-permission', { 'acc_id': acc_id, 'permission': permission });
	}


}
