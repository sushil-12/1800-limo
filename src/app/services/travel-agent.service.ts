import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { AuthService } from './auth.service';
import { ErrorDialogService } from './error-dialog/errordialog.service';
import * as moment from 'moment';

@Injectable({
	providedIn: 'root'
})

export class TravelAgentService {
	current_date: any;
	current_time: any;

	private environmentServerUrl = environment.serverUrl;
	private serverUrl = environment.serverUrl + 'travel-planner/';
	constructor(private httpClient: HttpClient,
		private $errors: ErrorDialogService,
		private authService: AuthService) {
		let date = new Date();
		let timestamp = date.getTime();

		const hours = String(date.getHours()).padStart(2, '0');
		const minutes = String(date.getMinutes()).padStart(2, '0');
		const seconds = String(date.getSeconds()).padStart(2, '0');

		this.current_date = moment(timestamp).format("YYYY-MM-DD");
		this.current_time = `${hours}:${minutes}:${seconds}`;
	}

	checkIsProfileCompleted() {
		let loggedInUserData = JSON.parse(localStorage.getItem('currentUser'))
		let role = JSON.parse(localStorage.getItem('userData'))?.RoleName
		if (role == 'travel_agent') {
			return loggedInUserData?.is_profile_complete
		}
		else {
			return false
		}
	}

	getStepCompletedObj() {
		let step_completed_obj = JSON.parse(sessionStorage.getItem('step_completed_obj'))
		return step_completed_obj;
	}

	getProfileDetail() {
		return this.httpClient.get(`${this.serverUrl}get-profile-data`)
	}

	updateProfile(data, updateBasicInfo) {
		if (updateBasicInfo) {
			return this.httpClient.post(this.serverUrl + 'update-travel-planner-account', data);
		}
		else {
			return this.httpClient.post(this.serverUrl + 'create-travel-planner-account', data);
		}
	}
	uploadProfilePicture(image) {
		return this.httpClient.post(this.serverUrl + 'profile-detail/upload-image', { 'image': image });
	}

	deleteClient(id) {
		return this.httpClient.get(this.serverUrl + `delete-client/${id}`);
	}

	cardsList(id = null) {
		if (id) {
			return this.httpClient.get(`${this.serverUrl}client-credit-cards/${id}`)
		}
		else {
			return this.httpClient.get(`${this.serverUrl}view-credit-card`)
		}
	}
	deleteCard(card_id) {
		return this.httpClient.delete(this.serverUrl + `delete-credit-card/${card_id}`);
	}
	addCard(data) {
		return this.httpClient.post(this.serverUrl + 'add-credit-card', data);
	}

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
	createBooking(data: any, update_type: string) {
		if (update_type == 'return' || update_type == 'repeat' || update_type == 'round') {
			return this.httpClient.post(`${this.serverUrl}duplicate-reservation`, data)
		}
		if (data.reservation_id) {
			return this.httpClient.put(this.serverUrl + 'edit-reservation', data);
		}
		else {
			return this.httpClient.post(this.serverUrl + 'create-reservation', data);
		}
	}

	//get invoice list
	invoiceList(url, startDate, endDate, useDateFilter, keyword = '') {
		var path;
		if (url) {
			path = url + '&from=' + startDate + '&to=' + endDate + '&search=' + keyword + '&useDateFilter=' + useDateFilter;

		}
		else {
			path = this.serverUrl + 'invoices' + '?from=' + startDate + '&to=' + endDate + '&search=' + keyword + '&useDateFilter=' + useDateFilter;
		}
		return this.httpClient.get(path).toPromise();
	}

	//invoice summary
	getInvoiceData(id) {
		return this.httpClient.get(this.serverUrl + 'invoice-summary/' + id);
	}

	//audit trail info 
	auditTrailInfoInvoice(bookingId) {
		return this.httpClient.get(this.serverUrl + `booking-audit-records/${bookingId}/invoice`)
	}

	//get location map
	getLocationPoints(booking_id: number) {
		return this.httpClient.get(`${this.serverUrl}booking-location/${booking_id}`)
	}

	//get details of the booking
	getBookingPreview(reservation_id: number) {
		return this.httpClient.get(`${this.serverUrl}get-booking-preview/${reservation_id}`);
	}
	//send invite code for sub ta
	sendTravelAgentInviteCode(data: any) {
		// return this.httpClient.post(this.serverUrl + 'send-an-invite-code', data);
		let resp: any
		const accessToken = this.authService.getAccessToken();
		resp = fetch(this.serverUrl + 'send-an-invite-code', {
			method: 'POST',
			body: data,
			headers: {
				Authorization: `Bearer ${accessToken}`
			}
		})

		return resp;
	}

	travelAgentNotification(data) {
		return this.httpClient.post(this.serverUrl + 'notification-daily-booking', data);
	}
	auditTrailInfo(bookingId) {
		return this.httpClient.get(this.serverUrl + `booking-audit-records/${bookingId}`)
	}
	getBookingDataForEdit(id, updateType) {
		return this.httpClient.get(this.serverUrl + `get-reservation/${id}/${updateType}`);
	}

	getStepsCompleted(id) {
		return this.httpClient.get(this.serverUrl + 'get-step-completed');
	}

	updateStepsArrayLocal(stepArray) {
		sessionStorage.setItem('stepCompleted', stepArray.toString())
	}

	updateStepsCompletedObj(stepObject) {
		sessionStorage.setItem('step_completed_obj', JSON.stringify(stepObject))
	}

	getBankOfAffiliate(acc_id) {
		return this.httpClient.get(this.serverUrl + `get-a-bank/${acc_id}`);
	}
	addBankOfAffiliate(data, id = null) {
		if (id) {
			return this.httpClient.put(this.serverUrl + 'edit-a-bank', data);
		}
		else {
			return this.httpClient.post(this.serverUrl + 'add-a-bank', data);
		}
		// return this.httpClient.post(this.serverUrl + 'add-a-bank', data);
	}

	getTravelClientAccounts(url, keyword) {
		var path;
		if (url) {
			path = url + '&search=' + keyword;
		}
		else {
			path = this.serverUrl + 'accounts' + '?search=' + keyword;
		}
		return this.httpClient.get(path).toPromise();;
	}

	//get sub ta accounts list
	getSubAgentAccounts(url, keyword) {
		var path;
		if (url) {
			path = url + '&search=' + keyword;
		}
		else {
			path = this.serverUrl + 'sub-travel-agent-listing' + '?search=' + keyword;
		}
		return this.httpClient.get(path).toPromise();;
	}
	//get sub ta account details by id
	getSubAgentAccountDetails(id) {
		return this.httpClient.get(this.serverUrl + `sub-travel-agent-profile/${id}`).toPromise();
	}
	//chnage sub ta account status
	subTavelPlannerAccountStatus(id, status) {
		return this.httpClient.put(this.serverUrl + 'change-account-status', { 'acc_id': id, 'status': status });
	}
	// accept or reject sub ta
	acceptRejectAffiliate(acc_id, status) {
		return this.httpClient.put(this.serverUrl + 'account-approval', { 'acc_id': acc_id, 'status': status });
	}
	getProfileSubAgent() {
		return this.httpClient.get(environment.serverUrl + 'sub-travel-planner/' + 'get-profile').toPromise();
	}
	addAccount(data, id = null) {
		if (id) {
			//update api here
			return this.httpClient.put(this.serverUrl + `edit-account/${id}`, data);
		}
		else {
			return this.httpClient.post(this.serverUrl + 'add-account', data);
		}
	}
	getClientAccount(id) {
		return this.httpClient.get(this.serverUrl + `get-an-account/${id}`);
	}
	getAllTravelClientAccountList(type, value = null) {
		console.log("in api---->", value)
		if (value) {
			return this.httpClient.get(this.serverUrl + `get-account-by-type/${type}/` + value).toPromise();;

		}
		else {

			return this.httpClient.get(this.serverUrl + `get-account-by-type/${type}`).toPromise();;
		}
	}
	getTravelClientDetailById(id) {
		return this.httpClient.get(this.serverUrl + 'get-an-account/' + id);
	}

	sendEmail(data) {
		return this.httpClient.post(this.serverUrl + 'send-reservation-detail-email', data);
	}
	passengerBooking(data) {
		return this.httpClient.post(this.serverUrl + 'passenger-booking-confirmation-email', data)
	}
	bookingEmailAll(data) {
		return this.httpClient.post(this.serverUrl + 'send-reservation-detail-email-to-all', data)
	}

	createNewSubAgent(data, updateBasicInfo) {
		if (updateBasicInfo) {
			return this.httpClient.post(this.serverUrl + 'update-a-travel-agent', data);
		}
		else {
			return this.httpClient.post(this.serverUrl + 'create-a-new-travel-agent', data);
		}
	}

	updateSubAgentAccount(data) {
		return this.httpClient.post(this.serverUrl + 'update-sub-travel-agent', data);
	}

	cancelBooking(id) {
		return this.httpClient.get(this.serverUrl + `cancel-booking/${id}`);
	}


}
