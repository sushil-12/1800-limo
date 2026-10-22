import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { AuthService } from './auth.service';
import * as moment from 'moment';


import { BehaviorSubject, Observable } from 'rxjs';
import { AmenitiesService } from './amenities.service';
import { AffiliateLookupParams, buildAffiliateLookupParams } from '../utils/affiliate-lookup';

@Injectable({
	providedIn: 'root'
})


export class AdminService {
	big_data_list: any = undefined;
	public bigData$ = new BehaviorSubject<any>(null);
	current_date: any;
	current_time: any;


	private serverUrl = environment.serverUrl;
	constructor(private httpClient: HttpClient, private authService: AuthService,  private amenitiesService: AmenitiesService) {
		this.createBookingGetData().subscribe((response: any) => {
			if (response && response.data) {
				const data = response.data;
				// format the name of each airports/airlines data as 'code - name, city, country'
				if (data.airportsData) {
					data.airportsData.map((item: any) => {
						if (item.id === 3283) {
							item['formatted_name'] = `${item.code} - ${item.name}`;
						} else {
							item['formatted_name'] = `${item.code} - ${item.name}, ${item.city}, ${item.country}`;
						}
						return item;
					});
				}
				if (data.airlinesData) {
					data.airlinesData.map((item: any) => item['formatted_name'] = `${item.code} - ${item.name}, ${item.country}`);
				}

				this.big_data_list = data
				this.bigData$.next(data);
			}
		})

		let date = new Date();
		let timestamp = date.getTime();

		const hours = String(date.getHours()).padStart(2, '0');
		const minutes = String(date.getMinutes()).padStart(2, '0');
		const seconds = String(date.getSeconds()).padStart(2, '0');

		this.current_date = moment(timestamp).format("YYYY-MM-DD");
		this.current_time = `${hours}:${minutes}:${seconds}`;
	}

	getBigDataSubject() {
		return this.bigData$.asObservable();
	}

	getAirportsAndBigData() {
		if (this.big_data_list) {
			return this.big_data_list;
		}
		else {
			return undefined;
		}
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

	deleteCookie(cookieName: string) {
		const cookies = document.cookie.split(';');
		console.log('cookies-->>>>>>>', cookies)
		document.cookie = cookieName + "=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";

		for (let i = 0; i < cookies.length; i++) {
			const cookie = cookies[i].trim();
			// Check if the cookie starts with the desired name
			if (cookie.indexOf(cookieName + '=') === 0) {
				console.log('selected cookies-->>', cookie)
				// Extract the cookie's name and value
				const [name, value] = cookie.split('=');

				// Split the cookie path and value
				const [path,] = value.split(';');

				// Set the Expiry date in the past to delete the cookie
				document.cookie = `${name}=${path}; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${path}`;

			}
		}
	}
	getMyPermissions() {
		return this.httpClient.get(this.serverUrl + 'my-permissions');
	}

	changeSortOrder(data: any) {
		return this.httpClient.put(this.serverUrl + 'vehicle-types-sorting', data);
	}

	changeSortingOrder(data: any) {
		return this.httpClient.put(this.serverUrl + 'admin/setting/meet-greet-sorting', data);
	}
	changeAmenitySortingOrder(data: any) {
		return this.httpClient.put(this.serverUrl + 'admin/setting/amenity-sorting', data);
	}
	changeSpecialAmenitySortingOrder(data: any) {
		return this.httpClient.put(this.serverUrl + 'admin/setting/special-amenities-sorting', data);
	}
	changeInteriorAmenitySortingOrder(data: any) {
		return this.httpClient.put(this.serverUrl + 'admin/setting/vehicle-interior-sorting', data);
	}

	logout() {
		return this.httpClient.post(this.serverUrl + 'logout', {});
	}

	async getOurVehicles() {
		const result = await this.httpClient.get(this.serverUrl + 'vehicle-types-listing').toPromise();
		return result;
	}

	addVehicleType(data) {
		return this.httpClient.post(this.serverUrl + 'add-vehicle-types', data);
	}
	chargeByCard(data) {
		return this.httpClient.post(this.serverUrl + 'charge-credit-card', data);
	}
	paymentLogs(id) {
		return this.httpClient.get(this.serverUrl + 'get-account-logs/' + id);
	}


	getVehicleType(id) {
		return this.httpClient.get(this.serverUrl + 'get-vehicle-types/' + id);
	}

	updateVehicleType(data) {
		return this.httpClient.post(this.serverUrl + 'edit-vehicle-types', data);
	}

	updateVehicleSortOrders(data) {
		return this.httpClient.post(this.serverUrl + 'update-vehicle-sort-orders', data);
	}

	//amenities
	async getAmenities() {
		const result = await this.httpClient.get(this.serverUrl + 'amenities').toPromise();
		return result;
	}
	addAmenity(data) {
		return this.httpClient.post(this.serverUrl + 'add-amenity', data);
	}
	getAmenity(id) {
		return this.httpClient.get(this.serverUrl + 'get-amenity/' + id);
	}
	updateAmenity(data) {
		return this.httpClient.put(this.serverUrl + 'edit-amenities', data);
	}
	amenityStatus(id, status) {
		return this.httpClient.put(this.serverUrl + 'amenity-status', { 'id': id, 'status': status });
	}

	// special Amenity
	async getSpecialAmenities() {
		const result = await this.httpClient.get(this.serverUrl + 'admin/special-amenities').toPromise();
		return result;
	}
	addSpecialAmenity(data) {
		return this.httpClient.post(this.serverUrl + 'admin/setting/add-special-amenities', data);
	}
	getSpecialAmenity(id) {
		return this.httpClient.get(this.serverUrl + 'admin/setting/get-special-amenities/' + id);
	}
	updateSpecialAmenity(data) {
		return this.httpClient.put(this.serverUrl + 'admin/setting/edit-special-amenities', data);
	}
	specialAmenityStatus(id, status) {
		return this.httpClient.put(this.serverUrl + 'admin/setting/special-amenities-status', { 'id': id, 'status': status });
	}

	// Interior Amenity
	async getInteriorAmenities() {
		const result = await this.httpClient.get(this.serverUrl + 'admin/vehicle-interior').toPromise();
		return result;
	}
	addInteriorAmenity(data) {
		return this.httpClient.post(this.serverUrl + 'admin/setting/add-vehicle-interior', data);
	}
	getInteriorAmenity(id) {
		return this.httpClient.get(this.serverUrl + 'admin/setting/get-vehicle-interior/' + id);
	}
	updateInteriorAmenity(data) {
		return this.httpClient.put(this.serverUrl + 'admin/setting/edit-vehicle-interior', data);
	}
	interiorAmenityStatus(id, status) {
		return this.httpClient.put(this.serverUrl + 'admin/setting/vehicle-interior-status', { 'id': id, 'status': status });
	}

	//
	// add / edit / update vehicle for admin-affiliate-step 5
	// Add / Edit / Get vehicle data for admin affliliate step 5
	async adminAffiliateVehicleList(id, flag = true) {
		const result = await this.httpClient.get(this.serverUrl + 'admin/get-affiliate-all-vehicles/' + id + `?show_all_vehicles=${flag}`).toPromise();
		return result;
	}

	async adminLooseAffVehList(id, flag = true) {
		const result = await this.httpClient.get(this.serverUrl + 'admin/get-loose-affiliate-all-vehicles/' + id + `?show_all_vehicles=${flag}`).toPromise();
		return result;
	}

	getLooseAffiliateVehicles(vehicle_type_id: number) {
		let data = {}
		data['filters'] = {}
		data['filters']['vehicle-type'] = [vehicle_type_id]
		return this.httpClient.post(`${this.serverUrl}quote/vehicle-listing`, data)
	}
	adminAffiliateSubmitVehicle(data) {
		return this.httpClient.post(this.serverUrl + 'admin/add-vehicle-for-affiliate', data);
	}
	adminAffiliateGetVehicleData(id) {
		return this.httpClient.get(this.serverUrl + 'admin/get-affiliate-vehicle-detail/' + id);
	}
	adminAffiliateEditVehicle(data) {
		return this.httpClient.put(this.serverUrl + 'admin/edit-vehicle-for-affiliate', data);
	}
	adminAffiliateUpdateVehicleSortOrders(data) {
		return this.httpClient.post(this.serverUrl + 'admin/update-sort-order-for-affiliate-vehicles', data);
	}
	adminAffiliateGetFieldsData() {
		return this.httpClient.get(this.serverUrl + 'admin/vehicle-data');
	}
	updateOrientationImage(data) {
		console.log('img data', data)
		return this.httpClient.put(this.serverUrl + 'edit-single-image', data);
	}
	fetchImageBlob(url) {
		return this.httpClient.get(this.serverUrl + 'return-blob-image?url=' + url);
	}
	// end

	//vehicle
	//vehicle rates 
	getMasterVehicleInfo(vehicleId) {
		return this.httpClient.get(this.serverUrl + 'get-master-vehicle-info/' + vehicleId);
	}
	addMasterVehicleRates(data) {
		return this.httpClient.post(this.serverUrl + 'add-vehicle-fare', data);
	}
	getMasterVehicleRates(id) {
		return this.httpClient.get(this.serverUrl + 'get-vehicle-fare/' + id);
	}
	editMasterVehicleRates(data) {
		return this.httpClient.post(this.serverUrl + 'update-master-vehicle-fare', data);
		// if (data.id)//edit vehicle rate
		// {
		// 	return this.httpClient.put(this.serverUrl + 'edit-vehicle-fare', data);
		// }
		// else//add vehicle rate
		// {
		// 	return this.httpClient.post(this.serverUrl + 'add-vehicle-fare', data);
		// }
	}
	//
	vehicles(id) {
		return this.httpClient.get(this.serverUrl + 'get-vehicle-type-vehicles/' + id).toPromise();
	}
	getFieldsData() {
		return this.httpClient.get(this.serverUrl + 'fields-data');
	}
	uploadVehicleImage(image) {
		return this.httpClient.post(this.serverUrl + 'add-single-image', { 'image': image });
	}
	uploadVehicleImageBinary(data: FormData) {
		return this.httpClient.post(this.serverUrl + 'add-single-image', data);
	}

	uploadMultipleImages(data: FormData) {
		return this.httpClient.post(this.serverUrl + 'add-multiple-images', data);
	}
	deleteImage(id) {
		return this.httpClient.delete(this.serverUrl + 'delete-image/' + id);
	}
	submitVehicle(data) {
		return this.httpClient.post(this.serverUrl + 'add-vehicle', data);
	}
	getVehicleData(id) {
		return this.httpClient.get(this.serverUrl + 'get-vehicle/' + id);
	}
	editVehicle(data) {
		return this.httpClient.put(this.serverUrl + 'edit-vehicle', data);
	}
	vehicleStatus(id, status) {
		return this.httpClient.put(this.serverUrl + 'vehicle-status', { 'id': id, 'status': status });
	}
	//
	//vehicle rates 
	getVehicleInfo(vehicleId, relative_vehicle_id: any = null) {
		if (relative_vehicle_id) {
			return this.httpClient.get(this.serverUrl + `admin/get-affililate-vehicle-info/${vehicleId}?relative_vehicle_id=${relative_vehicle_id}`);
		}
		else {
			return this.httpClient.get(this.serverUrl + 'admin/get-affililate-vehicle-info/' + vehicleId);
		}
	}
	addVehicleRates(data) {
		return this.httpClient.post(this.serverUrl + 'admin/add-affiliate-vehicle-fare', data);
	}
	getVehicleRates(id) {
		return this.httpClient.get(this.serverUrl + 'admin/get-affiliate-vehicle-fare-by-affiilate/' + id);
	}
	editVehicleRates(data) {
		if (data.id)//edit vehicle rate
		{
			return this.httpClient.put(this.serverUrl + 'admin/edit-affiliate-vehicle-fare', data);
		}
		else//add vehicle rate
		{
			return this.httpClient.post(this.serverUrl + 'admin/add-affiliate-vehicle-fare', data);
		}
	}
	//


	//vehicle year API's
	async getYears() {
		const result = await this.httpClient.get(this.serverUrl + 'years').toPromise();
		return result;
	}
	addYear(data) {
		return this.httpClient.post(this.serverUrl + 'add-year', data);
	}
	getYear(id) {
		return this.httpClient.get(this.serverUrl + 'get-year/' + id);
	}
	updateYear(data) {
		return this.httpClient.put(this.serverUrl + 'edit-year', data);
	}
	yearStatus(id, status) {
		return this.httpClient.put(this.serverUrl + 'vehicles-year-status', { 'id': id, 'status': status });
	}
	//

	//vehicle Color API's
	async getColors() {
		const result = await this.httpClient.get(this.serverUrl + 'vehicle-colors').toPromise();
		return result;
	}
	getAllEnableBadgeCities() {
		return this.httpClient.get(this.serverUrl + 'all-enabled-badge-cities');
	}
	getAllBadgeCities() {
		return this.httpClient.get(this.serverUrl + 'admin/all-badge-cities');
	}
	updateBadgeCity(body) {
		return this.httpClient.put(this.serverUrl + 'admin/edit-badge-city', body);
	}
	addBadgeCity(body) {
		return this.httpClient.post(this.serverUrl + 'admin/add-badge-city', body);
	}
	updateBadgeCityStatus(body) {
		return this.httpClient.put(this.serverUrl + 'admin/update-badge-city-status', body);
	}

	addColor(data) {
		return this.httpClient.post(this.serverUrl + 'add-vehicle-color', data);
	}
	getColor(id) {
		return this.httpClient.get(this.serverUrl + 'get-vehicle-color/' + id);
	}
	updateColor(data) {
		return this.httpClient.put(this.serverUrl + 'edit-vehicle-color', data);
	}
	colorStatus(id, status) {
		return this.httpClient.put(this.serverUrl + 'vehicle-color-status', { 'id': id, 'status': status });
	}
	//

	//vehicle make API's
	async getMakeList() {
		const result = await this.httpClient.get(this.serverUrl + 'vehicle-makes').toPromise();
		return result;
	}
	addMake(data) {
		return this.httpClient.post(this.serverUrl + 'add-vehicle-make', data);
	}
	getMake(id) {
		return this.httpClient.get(this.serverUrl + 'get-vehicle-make/' + id);
	}
	updateMake(data) {
		return this.httpClient.put(this.serverUrl + 'edit-vehicle-make', data);
	}
	makeStatus(id, status) {
		return this.httpClient.put(this.serverUrl + 'vehicle-make-status', { 'id': id, 'status': status });
	}
	//

	//vehicle model API's
	async getModelList() {
		const result = await this.httpClient.get(this.serverUrl + 'vehicle-models').toPromise();
		return result;
	}
	addModel(data) {
		return this.httpClient.post(this.serverUrl + 'add-vehicle-model', data);
	}
	getModel(id) {
		return this.httpClient.get(this.serverUrl + 'get-vehicle-model/' + id);
	}
	updateModel(data) {
		return this.httpClient.put(this.serverUrl + 'edit-vehicle-model', data);
	}
	modelStatus(id, status) {
		return this.httpClient.put(this.serverUrl + 'vehicle-model-status', { 'id': id, 'status': status });
	}
	//
	//vehicle model API's
	async getAffilatePreferenceList() {
		const result = await this.httpClient.get(this.serverUrl + 'affiliate-preferences').toPromise();
		return result;
	}
	addAffilatePreference(data) {
		return this.httpClient.post(this.serverUrl + 'add-affiliate-preference', data);
	}
	getAffilatePreference(id) {
		return this.httpClient.get(this.serverUrl + 'get-affiliate-preference/' + id);
	}
	updateAffilatePreference(data) {
		return this.httpClient.put(this.serverUrl + 'edit-affiliate-preference', data);
	}
	affilatePreferenceStatus(id, status) {
		return this.httpClient.put(this.serverUrl + 'affiliate-preference-status', { 'id': id, 'status': status });
	}
	//

	//vehicle model API's
	async getDriverLanguageList() {
		const result = await this.httpClient.get(this.serverUrl + 'driver-languages').toPromise();
		return result;
	}
	addDriverLanguage(data) {
		return this.httpClient.post(this.serverUrl + 'add-driver-language', data);
	}
	getDriverLanguage(id) {
		return this.httpClient.get(this.serverUrl + 'get-driver-language/' + id);
	}
	updateDriverLanguage(data) {
		return this.httpClient.put(this.serverUrl + 'edit-driver-language', data);
	}
	driverLanguageStatus(id, status) {
		return this.httpClient.put(this.serverUrl + 'driver-language-status', { 'id': id, 'status': status });
	}
	//

	//vehicle model API's
	async getDriverDressList() {
		const result = await this.httpClient.get(this.serverUrl + 'driver-dresses').toPromise();
		return result;
	}
	addDriverDress(data) {
		return this.httpClient.post(this.serverUrl + 'add-driver-dress', data);
	}
	getDriverDress(id) {
		return this.httpClient.get(this.serverUrl + 'get-driver-dress/' + id);
	}
	updateDriverDress(data) {
		return this.httpClient.put(this.serverUrl + 'edit-driver-dress', data);
	}
	driverDressStatus(id, status) {
		return this.httpClient.put(this.serverUrl + 'driver-dress-status', { 'id': id, 'status': status });
	}
	//
	//meet and greet model API's
	async getMeetAndGreetList() {
		const result = await this.httpClient.get(this.serverUrl + 'admin/setting/meet-greet').toPromise();
		return result;
	}
	addMeetAndGreet(data) {
		return this.httpClient.post(this.serverUrl + 'admin/setting/add-meet-greet', data);
	}
	getMeetAndGreet(id) {
		return this.httpClient.get(this.serverUrl + 'admin/setting/get-meet-greet/' + id);
	}
	updateMeetAndGreet(data) {
		return this.httpClient.put(this.serverUrl + 'admin/setting/edit-meet-greet', data);
	}
	MeetAndGreetStatus(id, status) {
		return this.httpClient.put(this.serverUrl + 'admin/setting/meet-greet-status', { 'id': id, 'status': status });
	}
	//

	//individual api
	addAccount(data) {
		return this.httpClient.post(this.serverUrl + 'add-account', data);
	}
	individualAccounts(url, keyword) {
		var path;
		if (url) {
			path = url + '&search=' + keyword;
		}
		else {
			path = this.serverUrl + 'accounts' + '?search=' + keyword;
		}
		return this.httpClient.get(path).toPromise();;
	}
	getIndividualAccount(id) {
		return this.httpClient.get(this.serverUrl + 'get-an-account/' + id);
	}
	updateIndividualAccount(data) {
		return this.httpClient.put(this.serverUrl + 'edit-account', data);
	}
	individualAccountStatus(id, status) {
		return this.httpClient.put(this.serverUrl + 'account-status', { 'id': id, 'status': status });
	}

	//corporate api
	addCorporateAccount(data) {
		return this.httpClient.post(this.serverUrl + 'add-corporate-account', data);
	}
	corporateAccounts(url, keyword) {
		var path;
		if (url) {
			path = url + '&search=' + keyword;
		}
		else {
			path = this.serverUrl + 'corporate-accounts' + '?search=' + keyword;
		}
		return this.httpClient.get(path).toPromise();;
	}
	getCorporateAccount(id) {
		return this.httpClient.get(this.serverUrl + 'get-corporate-account/' + id);
	}
	updateCorporateAccount(data) {
		return this.httpClient.put(this.serverUrl + 'edit-corporate-account', data);
	}
	corporateAccountStatus(id, status) {
		return this.httpClient.put(this.serverUrl + 'corporate-account-status', { 'id': id, 'status': status });
	}

	//corporate api
	addTravelPlannerAccount(data, id = null) {
		if (id) {
			return this.httpClient.put(this.serverUrl + 'edit-travel-planner-account', data);
		}
		else {
			return this.httpClient.post(this.serverUrl + 'add-travel-planner-account', data);
		}
	}
	travelPlannerAccounts(url, keyword) {
		var path;
		if (url) {
			path = url + '&search=' + keyword;
		}
		else {
			path = this.serverUrl + 'travel-planner' + '?search=' + keyword;
		}
		return this.httpClient.get(path).toPromise();;
	}

	subTravelPlannerAccountsbyId(url, keyword, id) {
		var path;
		if (url) {
			path = url + '&search=' + keyword;
		}
		else {
			path = this.serverUrl + `sub-agent-list/${id}` + '?search=' + keyword;
		}
		return this.httpClient.get(path).toPromise();;
	}

	loginAsUser(id) {
		return this.httpClient.get(this.serverUrl + 'admin/login-as-user/' + id);
	}

	getCcoAccounts(url, keyword, accountType, dataQuality) {
		var path;
		if (url) {
			path = url + '&account_type=' + accountType + '&data_quality=' + dataQuality + '&search=' + keyword;
		}
		else {
			path = this.serverUrl + 'cco-accounts' + '?account_type=' + accountType + '&data_quality=' + dataQuality + '&search=' + keyword;
		}
		return this.httpClient.get(path).toPromise();;
	}

	getAccounts(url, isDeletedAcc, keyword, accountType, unregistered) {
		var path;
		if (url) {
			path = url + '&deleted=' + isDeletedAcc + '&search=' + keyword + '&role=' + accountType + '&unregistered=' + unregistered;
		}
		else {
			path = this.serverUrl + 'admin/all-user' + '?deleted=' + isDeletedAcc + '&search=' + keyword + '&role=' + accountType + '&unregistered=' + unregistered;
		}
		return this.httpClient.get(path).toPromise();;
	}

	getTravelPlannerAccount(id) {
		return this.httpClient.get(this.serverUrl + 'get-travel-planner-account/' + id);
	}
	updateTravelPlannerAccount(data) {
		return this.httpClient.put(this.serverUrl + 'edit-travel-planner-account', data);
	}
	travelPlannerAccountStatus(id, status) {
		return this.httpClient.put(this.serverUrl + 'travel-planner-status', { 'id': id, 'status': status });
	}
	getTravelClientAccount(id) {
		return this.httpClient.get(this.serverUrl + 'get-account-for-travel-agent/' + id);
	}

	//cards
	async cardsList(id) {
		const result = await this.httpClient.get(this.serverUrl + 'credit-cards/' + id).toPromise();
		return result;
	}
	addCard(data) {
		return this.httpClient.post(this.serverUrl + 'add-credit-card', data);
	}
	getCard(id) {
		return this.httpClient.get(this.serverUrl + 'credit-card/' + id);
	}
	editCard(data) {
		return this.httpClient.put(this.serverUrl + 'edit-credit-card', data);
	}
	cardStatus(id, status) {
		return this.httpClient.put(this.serverUrl + 'credit-card-status', { 'id': id, 'status': status });
	}
	deleteCard(id, acc_id) {
		return this.httpClient.delete(this.serverUrl + 'delete-credit-card/' + acc_id + '/' + id);
	}

	deleteLooseAffAccount(id) {
		return this.httpClient.delete(this.serverUrl + `delete-loose-affiliate/${id}`);
	}

	deleteAccount(id) {
		return this.httpClient.delete(this.serverUrl + 'admin/delete-user/' + id);
	}

	deleteCcoAccount(data) {
		return this.httpClient.delete(this.serverUrl + 'cco-accounts/delete', { body: data });
	}


	//staff
	async staffList(id) {
		const result = await this.httpClient.get(this.serverUrl + 'staff/' + id).toPromise();
		return result;
	}
	addStaff(data) {
		return this.httpClient.post(this.serverUrl + 'add-staff', data);
	}
	staffLanguages() {
		return this.httpClient.get(this.serverUrl + 'staff-languages');
	}
	getStaff(id) {
		return this.httpClient.get(this.serverUrl + 'get-staff/' + id);
	}
	editStaff(data) {
		return this.httpClient.put(this.serverUrl + 'edit-staff', data);
	}
	staffStatus(id, status) {
		return this.httpClient.put(this.serverUrl + 'staff-status', { 'id': id, 'status': status });
	}

	//affiliate
	blackCarLimoBusAccounts(url: string, affiliateType: string, filter_type: string, keyword: string) {
		let path;
		if (url) {
			path = url + '&search=' + keyword;
		}
		else {
			path = `${this.serverUrl}affiliate-accounts/${affiliateType}/${filter_type}?search=${keyword}`;
		}
		return this.httpClient.get(path).toPromise()
	}
	blackCarLimoBusAccountStatus(id, status) {
		return this.httpClient.put(this.serverUrl + 'affiliate-account-status', { 'id': id, 'status': status });
	}

	acceptAffiliate(acc_id) {
		return this.httpClient.put(this.serverUrl + 'affiliate-account-approval', { 'acc_id': acc_id });
	}
	rejectAffiliate(data) {
		return this.httpClient.put(this.serverUrl + 'reject-affiliate-account', data);
	}

	// steps Code
	getSessionStepsCompleted() {
		return JSON.parse(sessionStorage.getItem('steps-completed'))
	}

	setSessionStepsCompleted(step: number | string) {
		step = step.toString()
		let temp_arr = this.getSessionStepsCompleted()
		if (temp_arr != null && temp_arr.length > 0) {
			if (!temp_arr.includes(step)) {
				temp_arr.push(step)
			}
		} else {
			temp_arr = [step]
		}
		sessionStorage.setItem('steps-completed', JSON.stringify(temp_arr))
	}

	unsetSessionStepsCompleted(step: number | string) {

		let temp_arr = this.getSessionStepsCompleted()



		if (temp_arr.length > 0 && temp_arr.includes(step.toString())) {

			temp_arr.splice(temp_arr.indexOf(step) != -1 ? temp_arr.indexOf(step) : 0)

		}

		sessionStorage.setItem('steps-completed', JSON.stringify(temp_arr))

	}

	getStepsCompleted(id) {
		return this.httpClient.get(this.serverUrl + 'admin/get-affiliate-step-completed/' + id);
	}

	updateStepsCompleted(stepArray) {
		sessionStorage.setItem('stepCompleted', stepArray.toString())
	}
	updateStepsCompletedObj(stepObject) {
		sessionStorage.setItem('step_completed_obj', JSON.stringify(stepObject))
	}
	getLocalStepsCompleted() {
		return sessionStorage.getItem('stepCompleted').split(',');
	}
	getLocalStepsCompletedObj() {
		return JSON.parse(sessionStorage.getItem('step_completed_obj'));
	}

	getUpdatedStepsLocal(step) {
		let stepCompleted: any = sessionStorage.getItem('stepCompleted');
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

	updateStepsArrayLocal(stepArray) {
		sessionStorage.setItem('stepCompleted', stepArray.toString())
	}
	updateStepsLocal(step) {
		let stepCompleted: any = sessionStorage.getItem('stepCompleted');
		if (stepCompleted) {
			stepCompleted = stepCompleted.split(',');
			if (!stepCompleted.includes(step)) {
				stepCompleted.push(step);
				sessionStorage.setItem('stepCompleted', stepCompleted.toString())
			}
		}
		else {
			stepCompleted = [step];
			sessionStorage.setItem('stepCompleted', stepCompleted.toString())
		}
	}

	// End Steps Code
	fetchStep0Data() {
		return this.httpClient.get(this.serverUrl + 'admin/cms/step0')
	}

	getAssicationsLanguages() {
		return this.httpClient.get(this.serverUrl + 'get-associations-languages');
	}
	addAffiliateAccount(data) {
		if (data.id)//edit affiliate
		{
			return this.httpClient.put(this.serverUrl + 'edit-affiliate-account', data);
		}
		else//add affiliate
		{
			return this.httpClient.post(this.serverUrl + 'add-affiliate-account', data);
		}
	}
	getAffiliateAccount(id) {
		return this.httpClient.get(this.serverUrl + 'get-affiliate-account/' + id);
	}


	getAffiliatesListFromCoords(lat: number, lng: number) {
		return this.httpClient.get(`${this.serverUrl}get-affiliates/${lat}/${lng}`).toPromise()
	}
	addBankOfAffiliate(data) {
		if (data.id)//edit affiliate
		{
			return this.httpClient.put(this.serverUrl + 'edit-a-bank', data);
		}
		else//add affiliate
		{
			return this.httpClient.post(this.serverUrl + 'add-a-bank', data);
		}
	}
	getBankOfAffiliate(id) {
		return this.httpClient.get(this.serverUrl + 'get-a-bank/' + id);
	}

	addInsuranceDetail(data) {
		if (data.id)//edit affiliate
		{
			return this.httpClient.put(this.serverUrl + 'edit-insurance-detail', data);
		}
		else//add affiliate
		{
			return this.httpClient.post(this.serverUrl + 'add-insurance-detail', data);
		}
	}
	getInsuranceDetail(id) {
		return this.httpClient.get(this.serverUrl + 'insurance-detail/' + id);
	}

	//Driver
	async driverList(id) {
		const result = await this.httpClient.get(this.serverUrl + 'affiliate-drivers/' + id).toPromise();
		return result;
	}
	addDriver(data) {
		if (data.id)//edit affiliate
		{
			return this.httpClient.put(this.serverUrl + 'edit-driver', data);
		}
		else//add affiliate
		{
			return this.httpClient.post(this.serverUrl + 'add-driver', data);
		}
	}
	getDriver(id) {
		return this.httpClient.get(this.serverUrl + 'affiliate-driver/' + id);
	}
	editDriver(data) {
		return this.httpClient.put(this.serverUrl + 'edit-driver', data);
	}
	driverStatus(id, status) {
		return this.httpClient.put(this.serverUrl + 'affiliate-driver-status', { 'id': id, 'status': status });
	}
	driverDressLanguage() {
		return this.httpClient.get(this.serverUrl + 'affiliate-driver-dresses-languages');
	}

	//Vehicles 
	affiliateVehicleList(affiliate_id: number | string) {
		return this.httpClient.get(this.serverUrl + 'get-vehicles/' + affiliate_id).toPromise();
	}

	// addAffiliateVehicle(data)
	// {
	//   if(data.id)//edit affiliate
	//   {
	//     return this.httpClient.put(this.serverUrl + 'edit-driver',data);
	//   }
	//   else//add affiliate
	//   {
	//     return this.httpClient.post(this.serverUrl + 'add-driver',data);
	//   }
	// }
	// getAffiliateVehicle(id)
	// {
	//   return this.httpClient.get(this.serverUrl + 'affiliate-driver/'+id);
	// }
	// editAffiliateVehicle(data)
	// {
	//   return this.httpClient.put(this.serverUrl + 'edit-driver',data);
	// }
	// affiliateVehicleStatus(id,status)
	// {
	//   return this.httpClient.put(this.serverUrl + 'affiliate-driver-status',{'id':id,'status':status});
	// }
	affiliateTermsAccept(data) {
		return this.httpClient.put(this.serverUrl + 'affiliate-step-completion', data);
	}

	//Create booking
	createBookingGetData() {
		return this.httpClient.get(this.serverUrl + 'amenities-languages-dresses');
	}

	getAccountBytype(accountType, params?: AffiliateLookupParams) {
		return this.httpClient.get(this.serverUrl + 'get-account-by-type/' + accountType, {
			params: buildAffiliateLookupParams(params)
		});
	}

	chooseUser(id: number, accountType: string) {
		console.log('choosen account-->>', accountType)
		switch (accountType) {
			case 'individual': {
				return this.httpClient.get(this.serverUrl + 'get-an-account/' + id);
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

	getTravelClientDetailById(id) {
		return this.httpClient.get(this.serverUrl + 'get-an-account/' + id);
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
	getReservationDetails(reservation_id: number) {

		return this.getBookingDataForEdit(reservation_id, 'detail');
		// return this.httpClient.get(`${this.serverUrl}get-reservation-detail/${reservation_id}`);

	}

	getBookingDataForEdit(reservation_id: number, updateType: string) {
		return this.httpClient.get(`${this.serverUrl}get-reservation/${reservation_id}/${updateType}`);
	}

	getBookingPreview(reservation_id: number) {
		return this.httpClient.get(`${this.serverUrl}admin/get-booking-preview/${reservation_id}`);
	}
	getFinalizeDetails(reservation_id: number) {
		return this.httpClient.get(`${this.serverUrl}admin/finalize-booking-detail/${reservation_id}`);
	}
	getPaymentDetailFinalize(reservation_id: number) {
		return this.httpClient.get(`${this.serverUrl}admin/booking-payment-log/${reservation_id}`);
	}
	// saveCard(data){
	// 	return this.httpClient.post(`${this.serverUrl}admin/finalize-rate-edit`, data)
	// }
	updateFinalizeRates(data) {
		return this.httpClient.post(`${this.serverUrl}admin/finalize-rate-edit`, data)
	}
	deleteCardFinalize(cardId, acc_id) {
		return this.httpClient.delete(`${this.serverUrl}admin/remove-card/${acc_id}/${cardId}`)
	}
	adminNotification(data) {
		return this.httpClient.post(this.serverUrl + 'admin-notification-daily-booking', data);
	}
	passengerBooking(data) {
		return this.httpClient.post(this.serverUrl + 'passenger-booking-confirmation-email', data)
	}
	bookingEmailAll(data) {
		return this.httpClient.post(this.serverUrl + 'send-reservation-detail-email-to-all', data)
	}
	bookingEmailAllUpdated(bookingId) {
		return this.httpClient.get(this.serverUrl + `send-updated-email/${bookingId}`)
	}
	bookingUpdatedEmailByTarget(bookingId, target: 'customer' | 'affiliate') {
		return this.httpClient.get(this.serverUrl + `send-updated-email/${bookingId}/${target}`)
	}
	auditTrailInfo(bookingId) {
		return this.httpClient.get(this.serverUrl + `admin/booking-audit-records/${bookingId}`)
	}
	auditTrailInfoInvoice(bookingId) {
		return this.httpClient.get(this.serverUrl + `admin/booking-audit-records/${bookingId}/invoice`)
	}
	loadPastFutureBookings(url, id, type, isAffiliate, keyword = '') {
		var path;
		if (url) {
			path = url + '&search=' + keyword;
		}
		else {
			path = this.serverUrl + 'reservations/' + id + '?past=' + type + '&affiliate_bookings=' + isAffiliate + '&search=' + keyword;
		}
		return this.httpClient.get(path).toPromise();
	}
	loadBookings(url, startDate, endDate, useDateFilter, keyword = '', orderBy, status = '', filter = '') {
		// filter: 'upcoming' | 'past' tab; '' = date range (Custom tab).
		const now = moment();
		const clock = '&current_date=' + now.format('YYYY-MM-DD') + '&current_time=' + now.format('HH:mm:ss');
		var path;
		if (url) {
			path = url + '&from=' + startDate + '&to=' + endDate + '&search=' + keyword + '&useDateFilter=' + useDateFilter + '&orderBy=' + orderBy + clock + '&booking_status=' + status + '&filter=' + filter + '&v1=1';
		}
		else {
			path = this.serverUrl + 'reservations' + '?from=' + startDate + '&to=' + endDate + '&search=' + keyword + '&useDateFilter=' + useDateFilter + '&order_by=' + orderBy + clock + '&booking_status=' + status + '&filter=' + filter + '&v1=1';
		}
		return this.httpClient.get(path).toPromise();
	}
	loadFarmInBookings(url, startDate, endDate, useDateFilter, keyword = '', orderBy, status = '', filter = '') {
		// filter: 'upcoming' | 'past' tab; '' = date range (Custom tab).
		const now = moment();
		const clock = '&current_date=' + now.format('YYYY-MM-DD') + '&current_time=' + now.format('HH:mm:ss');
		var path;
		if (url) {
			path = url + '&from=' + startDate + '&to=' + endDate + '&search=' + keyword + '&useDateFilter=' + useDateFilter + '&orderBy=' + orderBy + clock + '&booking_status=' + status + '&filter=' + filter;
		}
		else {
			path = this.serverUrl + 'subscribers/get-farmin-reservations' + '?from=' + startDate + '&to=' + endDate + '&search=' + keyword + '&useDateFilter=' + useDateFilter + '&order_by=' + orderBy + clock + '&booking_status=' + status + '&filter=' + filter;
		}
		return this.httpClient.get(path).toPromise();
	}
	loadFarmOutBookingSubscriber(url, startDate, endDate, useDateFilter, keyword = '', orderBy, status = '') {
		var path;
		if (url) {
			path = url + '&from=' + startDate + '&to=' + endDate + '&search=' + keyword + '&useDateFilter=' + useDateFilter + '&orderBy=' + orderBy + '&current_date=' + this.current_date + '&current_time=' + this.current_time + '&booking_status=' + status;
		}
		else {
			path = this.serverUrl + 'subscribers/get-farmout-reservations' + '?from=' + startDate + '&to=' + endDate + '&search=' + keyword + '&useDateFilter=' + useDateFilter + '&order_by=' + orderBy + '&current_date=' + this.current_date + '&current_time=' + this.current_time + '&booking_status=' + status;
		}
		return this.httpClient.get(path).toPromise();
	}
	reservationStatus(id, status) {
		return this.httpClient.put(this.serverUrl + 'reservation-status', { 'id': id, 'status': status });
	}
	getChargeRates(id) {
		return this.httpClient.get(`${this.serverUrl}get-rates/${id}`);
	}
	paymentProcessing(data) {
		return this.httpClient.post(this.serverUrl + 'payment-processing', data);
	}

	getQuoteData(id: any) {
		return this.httpClient.get(`${this.serverUrl}quote/copy/${id}`)
	}

	getFilterData(id: any) {
		return this.httpClient.get(`${this.serverUrl}quote/static_filter/${id}`)
	}


	//booking actions
	returnRepeatBooking(data) {
		return this.httpClient.post(this.serverUrl + 'repeat-return-reservation', data);
	}
	//change booking status such as accept/reject
	changeStatusBooking(data) {
		return this.httpClient.put(this.serverUrl + 'change-booking-status', data);
	}
	//send email to affiliate, customer etc
	sendEmail(data) {
		return this.httpClient.post(this.serverUrl + 'send-reservation-detail-email', data);
	}

	sendAffiliateMessage(type: 'email' | 'sms', affiliate_id: number, data: Object) {
		return this.httpClient.post(`${this.serverUrl}admin/notification/send-${type}/${affiliate_id}`, data)
	}

	sendNotificationAllAccounts(type: 'email' | 'sms', id: number, data: any) {
		return this.httpClient.post(`${this.serverUrl}admin-send-notification/${type}/${id}`, data)
		// let resp: any
		// const accessToken = this.authService.getAccessToken();
		// resp = fetch(`${this.serverUrl}admin-send-notification/${type}/${id}`, {
		// 	method: 'POST',
		// 	body: data,
		// 	headers: {
		// 		Authorization: `Bearer ${accessToken}`
		// 	}
		// })

		// return resp;
	}
	//invoices
	getInvoiceData(id) {
		return this.httpClient.get(this.serverUrl + 'invoice-summary/' + id);
	}
	getCustomInvoiceData(id) {
		return this.httpClient.get(this.serverUrl + 'get-invoice-data/' + id);
	}
	getInvoiceRefundHistory(id) {
		return this.httpClient.get(this.serverUrl + 'admin/get-refund-list/' + id);
	}
	getPaymentLogs(id) {
		return this.httpClient.get(this.serverUrl + 'get-payment-list/' + id);
	}
	getInvoiceRefundHistoryCommon(id) {
		return this.httpClient.get(this.serverUrl + 'get-refund-list/' + id);
	}
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
	getBookingLogs(url, keyword = '') {
		var path;
		if (url) {
			path = url + '&search=' + keyword;
		}
		else {
			path = this.serverUrl + 'admin/booking-payment-logs' + '?&search=' + keyword;
		}
		return this.httpClient.get(path);
		// return this.httpClient.get(this.serverUrl + 'admin/booking-payment-logs');
	}

	//sub Admin API
	addSubAdmin(data) {
		if (data.id)//edit affiliate
		{
			return this.httpClient.put(this.serverUrl + 'edit-sub-admin', data);
		}
		else {
			return this.httpClient.post(this.serverUrl + 'add-sub-admin', data);
		}
	}
	subAdminAccounts(url, keyword) {
		var path;
		if (url) {
			path = url + '&search=' + keyword;
		}
		else {
			path = this.serverUrl + 'get-sub-admins' + '?search=' + keyword;
		}
		return this.httpClient.get(path).toPromise();
	}
	getSubAdminAccount(id) {
		return this.httpClient.get(this.serverUrl + 'get-sub-admin-user/' + id);
	}
	subAdminAccountStatus(id, status) {
		return this.httpClient.put(this.serverUrl + 'sub-admin-status', { 'id': id, 'status': status });
	}

	//payment by email API
	getPaymentData(accId, bookingId) {
		return this.httpClient.get(this.serverUrl + 'payment-processing-by-email-page/' + accId + '/' + bookingId);
	}
	paymentProcessingByEmail(data) {
		return this.httpClient.post(this.serverUrl + 'payment-processing-by-email', data);
	}
	//

	//create debit cc card
	paymentProcessingCcDebit(data) {
		return this.httpClient.post(this.serverUrl + 'payment-processing-cc-debit', data);
	}
	//

	//admin cms pages
	getHomePagesSectionContent() {
		return this.httpClient.get(this.serverUrl + 'admin/cms/homepage-content');
	}
	getSingleSectionHomePage(ID) {
		return this.httpClient.get(this.serverUrl + 'admin/cms/homepage-content/section/' + ID);
	}

	saveDataHomePageSection(data) {
		console.log(data);
		return this.httpClient.put(this.serverUrl + 'admin/cms/homepage-content/section/update', data)
	}
	changeStauts(id, event) {
		return this.httpClient.put(this.serverUrl + 'admin/cms/homepage-content/section/status/update', { 'id': id, 'data': event })
	}
	changeStepOSectionStauts(id, event) {
		return this.httpClient.put(this.serverUrl + 'admin/cms/step0/section/status/update', { 'id': id, 'data': event })
	}
	changeFleetSectionStatus(id, event) {
		return this.httpClient.put(this.serverUrl + 'admin/cms/fleet/section/status/update', { 'id': id, 'data': event })
	}
	changeStep6SectionStatus(id, event) {
		return this.httpClient.put(`${this.serverUrl}admin/cms/step6/section/status/update`, { id: id, data: event })
	}
	getStepContentData(page: string) {
		return this.httpClient.get(`${this.serverUrl}admin/cms/${page}`)
	}
	getPageSectionData(section_id: number | string, page: string) {
		return this.httpClient.get(`${this.serverUrl}admin/cms/${page}/section/${section_id}`);
	}

	saveStepSectionData(page: string, data: any) {
		return this.httpClient.put(`${this.serverUrl}admin/cms/${page}/section/update`, data);
	}
	uploadAnlImage(image) {
		return this.httpClient.post(this.serverUrl + 'admin/cms/add-image', { 'image': image }).toPromise();
	}

	//aboutUs page
	getAboutUsPageContent() {
		return this.httpClient.get(this.serverUrl + 'admin/cms/about-us');
	}
	getAboutUsSectionDataByID(id) {
		return this.httpClient.get(this.serverUrl + 'admin/cms/about-us/section/' + id);
	}
	saveDataAboutUsSection(data) {
		return this.httpClient.put(this.serverUrl + 'admin/cms/about-us/section/update', data);
	}
	changeAboutUSSectionStauts(id, event) {
		return this.httpClient.put(this.serverUrl + 'admin/cms/about-us/section/status/update', { 'id': id, 'data': event })
	}

	getCurrencies() {
		return this.httpClient.get('assets/json/currencyOptions.json')
	}

	get charterOptions() {
		return this.httpClient.get('assets/json/charterOptions.json')
	}

	fetchAdminNewBookingRates(affiliate_type: string, bookingId: number) {
		if (bookingId) {
			return this.httpClient.get(`${this.serverUrl}admin/reservation-rates/${bookingId}`)
		}
		else {
			return this.httpClient.get(`${this.serverUrl}admin/booking-rates`)
		}
	}
	// const params = new HttpParams()
	// 	.set('vehicle_id', vehicle_id)
	// 	.set('transfer_type', data?.transfer_type)
	// 	.set('service_type', data?.service_type)
	// 	.set('numberOfVehicles', data?.numberOfVehicles)
	// 	.set('distance', data?.distance)
	// 	.set('no_of_hours', data?.no_of_hours)
	// 	.set('is_master_vehicle' , data?.is_master_vehicle);
	fetchRatesByAffiliateVeh(vehicle_id, data) {
		data['vehicle_id'] = vehicle_id
		data['selected_amenities'] = sessionStorage.getItem('filters') ? JSON.parse(sessionStorage.getItem('filters')).request.amenities : [];
		return this.httpClient.post(`${this.serverUrl}admin/booking-rates-vehicle`, data)
	}
	
	checkUniquePhoneNumberForLooseCustomer(customer_data: Record<string, any>) {
		return this.httpClient.post(`${this.serverUrl}admin/check-unique-user`, customer_data)
	}

	fetchStepData(step_name: string) {
		return this.httpClient.get(this.serverUrl + 'admin/cms/' + step_name)
	}

	getLocationPoints(booking_id: number) {
		return this.httpClient.get(`${this.serverUrl}admin/booking-location/${booking_id}`)
	}
	getStatusList() {
		return this.httpClient.get(this.serverUrl + 'admin/booking-status-list');
	}

	sendInvoiveToCustomer(bookingId: any) {
		return this.httpClient.get(`${this.serverUrl}admin/send-invoice/${bookingId}`)
	}
	sendCustomInvoiveToCustomer(id) {
		return this.httpClient.get(`${this.serverUrl}send-invoice-data-to-customer/${id}`)
	}

	sendInvoiveToAny(bookingId: any, data: any) {
		return this.httpClient.post(`${this.serverUrl}admin/send-invoice-to-anyone/${bookingId}`, data)
	}
	sendCustomInvoiceToAny(id, data) {
		return this.httpClient.post(`${this.serverUrl}send-invoice-data-to-anyone/${id}`, data)
	}
	cancellationBooking(url, data) {
		return this.httpClient.post(`${url}`, data)
	}

	refund(body: any) {
		return this.httpClient.post(`${this.serverUrl}admin/refund-request`, body)
	}
	getPermission(id: any) {
		return this.httpClient.get(`${this.serverUrl}admin/permissions/${id}`)
	}
	getRoles() {
		return this.httpClient.get(`${this.serverUrl}admin/roles`)
	}
	updartePermission(id, data) {
		return this.httpClient.post(`${this.serverUrl}admin/assign-permissions/${id}`, data)
	}
	addRole(data) {
		return this.httpClient.post(`${this.serverUrl}admin/create-role`, data)
	}

	//list of affilate accounts
	getEmailList(keyword) {
		return this.httpClient.get(`${this.serverUrl}affiliate-accountss/emails?search=${keyword}`)
	}

	//send email
	sendEmailAffiliate(body: any) {
		return this.httpClient.post(`${this.serverUrl}send-email-data-to-users`, body)
	}

	//send sms
	sendSmsAffiliate(body: any) {
		return this.httpClient.post(`${this.serverUrl}send-sms-to-users`, body)
	}

	changeTimezone(value) {
		return this.httpClient.put(`${this.serverUrl}update-timezone/${value}`, '')
	}

	// travel agent stripe add,edit,get api step2
	getBankOfTravelAgent(acc_id) {
		return this.httpClient.get(this.serverUrl + `get-travel-planner-bank/${acc_id}`);
	}
	addBankOfTravelAgent(data, id = null) {
		if (id) {
			return this.httpClient.put(this.serverUrl + 'edit-travel-planner-bank', data);
		}
		else {
			return this.httpClient.post(this.serverUrl + 'add-travel-planner-bank', data);
		}
	}
	updateBankOfTravelAgent(data) {
		return this.httpClient.put(this.serverUrl + 'edit-travel-planner-bank', data);
	}


	getStepsCompletedTravelAgent(acc_id = 0) {
		return this.httpClient.get(this.serverUrl + `get-travel-planner-step-completed/${acc_id}`);
	}

	updateStepsArrayLocalTravelAgent(stepArray) {
		sessionStorage.setItem('stepCompleted', stepArray.toString())
	}
	// accept or reject sub ta
	acceptRejectAffiliate(acc_id, status) {
		return this.httpClient.put(this.serverUrl + 'admin/travel-planner/account-approval', { 'acc_id': acc_id, 'status': status });
	}
	updateStepsCompletedObjTravelAgent(stepObject) {
		sessionStorage.setItem('step_completed_obj', JSON.stringify(stepObject))
	}

	getLooseAffiliaeAccounts(url, keyword) {
		var path;
		if (url) {
			path = url + '&search=' + keyword;
		}
		else {
			path = this.serverUrl + 'loose-affiliate-accounts' + '?search=' + keyword;
		}
		return this.httpClient.get(path).toPromise();;
	}

	createLooseAffAcc(data, id = null) {
		if (id) {
			//update api here
			data['id'] = id
			return this.httpClient.post(this.serverUrl + `add-new-loose-affiliate`, data);
		}
		else {
			return this.httpClient.post(this.serverUrl + 'add-new-loose-affiliate', data);
		}
	}

	getLooseAffAccDetails(id: any) {
		return this.httpClient.get(this.serverUrl + `get-loose-affiliate/${id}`);
	}
	communicationLogs(id, user_type: any = null) {
		return this.httpClient.get(this.serverUrl + `admin/communication-logs/${id}?user_type=${user_type}`)
	}

	acceptCharge(data) {
		return this.httpClient.post(this.serverUrl + `admin/charge-half-payment`, data)
	}

	chargeBack(data) {
		return this.httpClient.post(this.serverUrl + `admin/charge-back-affiliate`, data)
	}

	chargeBackPermission(acc_id, permission) {
		return this.httpClient.post(this.serverUrl + 'affiliate/charge-back-permission', { 'acc_id': acc_id, 'permission': permission });
	}

	addSubscriberBank(data, type = '') {
		console.log("type", type)
		if (type == 'edit') {
			return this.httpClient.put(this.serverUrl + 'edit-subscriber-bank', data);
		}
		else {
			return this.httpClient.post(this.serverUrl + 'add-subscriber-bank', data);
		}
	}

	getSubsriberBank(acc_id) {
		return this.httpClient.get(this.serverUrl + `get-subscriber-bank/${acc_id}`);
	}

	chargeSubscriberForVehicle(id) {
		return this.httpClient.post(this.serverUrl + `charge-subscriber-for-vehicle`, { 'account_id': id })
	}

	subscribersAccounts(url, keyword) {
		var path;
		if (url) {
			path = url + '&search=' + keyword;
		}
		else {
			path = this.serverUrl + 'admin/subscriber-accounts' + '?search=' + keyword;
		}
		return this.httpClient.get(path).toPromise();;
	}

	serviceLeads(url = null) {
		const path = url ? url : this.serverUrl + 'admin/leads';
		return this.httpClient.get(path).toPromise();
	}

	cancelSubscription(data) {
		return this.httpClient.post(this.serverUrl + 'cancel-subscription', data);
	}

	//get invoice list
	payouts(data) {
		return this.httpClient.post(this.serverUrl + `get-payouts`, data);
	}

	//get invoice list
	inviteDriver(data) {
		return this.httpClient.post(this.serverUrl + `send-an-invite-email`, data);
	}

	//Booking
	loadDriverBookings(url, keyword, startDate, endDate, useDateFilter) {
		var path;
		if (url) {
			path = url + '?from=' + startDate + '&to=' + endDate + '&search=' + keyword + '&useDateFilter=' + useDateFilter + '&current_date=' + this.current_date + '&current_time=' + this.current_time;
		}
		else {
			path = this.serverUrl + 'driver/get-all-reservations' + '?from=' + startDate + '&to=' + endDate + '&search=' + keyword + '&useDateFilter=' + useDateFilter + '&current_date=' + this.current_date + '&current_time=' + this.current_time;
		}
		return this.httpClient.get(path).toPromise();
	}

	//get invoice list
	mapsPin(id) {
		return this.httpClient.get(this.serverUrl + `affiliate-pincodes?vehicleId=${id}`);
	}

	//bookings reports
	getBookingsReport(year, status, vehType, serviceType, transferType) {
		return this.httpClient.get(this.serverUrl + 'get-monthly-booking-count' + '?year=' + year + '&status=' + status + '&vehicle_type=' + vehType + '&service_type=' + serviceType + '&transfer_type=' + transferType);
	}

	//bookings percent by veh type reports
	getVehPercentReport(year) {
		return this.httpClient.get(this.serverUrl + 'get-vehicle-booking-percentage' + '?year=' + year);
	}

	//average by veh type reports
	getVehAverageReport(year) {
		return this.httpClient.get(this.serverUrl + 'get-vehicle-booking-average' + '?year=' + year);
	}

	getUserBasedReport(url, acc_id, year, month) {
		var path;
		if (url) {
			path = url + '&acc_id=' + acc_id + '&year=' + year + '&month=' + month;
		}
		else {
			path = this.serverUrl + 'get-user-accounts-details' + '?acc_id=' + acc_id + '&year=' + year + '&month=' + month;
		}
		return this.httpClient.get(path).toPromise();;
	}

	getAccountBytypeforall(accountType) {
		return this.httpClient.get(this.serverUrl + 'get-account-by-type/' + accountType + '?get_report=all');
	}

	//send email to affiliate, customer etc
	sendEmailToanyone(data) {
		return this.httpClient.post(this.serverUrl + 'send-booking-details', data);
	}

	converCurrenyEnableDisable(status) {
		return this.httpClient.post(this.serverUrl + 'convert_currency', { 'convert_currency': status });
	}

}
