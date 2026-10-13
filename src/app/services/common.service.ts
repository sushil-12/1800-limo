import { Injectable } from '@angular/core';
import { ErrorDialogService } from './error-dialog/errordialog.service';
import { Observable } from 'rxjs';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { SILENT_ERRORS_HEADER } from '../interceptors/http-config.interceptor';

@Injectable({
	providedIn: 'root'
})
export class CommonService {

	private serverUrl = environment.serverUrl;
	constructor(private errorModal: ErrorDialogService,private httpClient: HttpClient) { }
	handleFile(event) {
		console.log("in function handle file", event)
		const [file] = event.target.files
		const fileType = file.type // image/jpeg
		console.log("fileType", fileType)
		const acceptedFiles: any = ["image/jpeg", "image/png", "image/webp", "image/avif"];
		console.log(!acceptedFiles.includes(fileType))
		if (!acceptedFiles.includes(fileType)) {
			return this.errorModal.openDialog({
				errors: {
					error: 'Please upload only jpeg, png, webp, or avif file type!'
				}
			})
		} else {
			return true
		}
	}

	getTelInputOptions(initialCountry?: string) {
		const options: any = {
			initialCountry: initialCountry || 'auto',
			preferredCountries: ['us', 'ca', 'mx', 'gb'],
			separateDialCode: true,
			nationalMode: true,
			utilsScript: 'https://cdn.jsdelivr.net/npm/intl-tel-input@18.2.1/build/js/utils.js'
		};

		if (options.initialCountry === 'auto') {
			options.geoIpLookup = function (callback: (countryCode: string) => void) {
				// 1. Try GeoJS (Permissive, no key)
				fetch('https://get.geojs.io/v1/ip/country.json')
					.then(res => res.json())
					.then(data => {
						console.log('Country detection (GeoJS):', data.country);
						callback(data.country ? data.country.toLowerCase() : 'us');
					})
					.catch(err1 => {
						console.warn('GeoJS lookup failed, trying ipinfo...', err1);
						// 2. Fallback to ipinfo.io
						fetch('https://ipinfo.io/json')
							.then(res => res.json())
							.then(data => {
								console.log('Country detection (ipinfo):', data.country);
								callback(data.country ? data.country.toLowerCase() : 'us');
							})
							.catch(err2 => {
								console.warn('ipinfo lookup failed, trying ipapi...', err2);
								// 3. Fallback to ipapi.co
								fetch('https://ipapi.co/json')
									.then(res => res.json())
									.then(data => {
										console.log('Country detection (ipapi):', data.country_code);
										callback(data.country_code ? data.country_code.toLowerCase() : 'us');
									})
									.catch(err3 => {
										console.error('All IP lookups failed. Defaulting to US.', err3);
										callback('us');
									});
							});
					});
			};
		}

		return options;
	}

	getInvoiceDataWithToken(id: string,userType: string, token: string): Observable<any> {
		// Silent: the public page handles its own errors, so the interceptor
		// must not clear the visitor's localStorage on a 401.
		const headers = new HttpHeaders({
			'Authorization': `Bearer ${token}`,
			[SILENT_ERRORS_HEADER]: '1'
		});
		
		return this.httpClient.get(`${this.serverUrl}${userType}/invoice-summary/${id}`, {
			headers
		});
	}
}
