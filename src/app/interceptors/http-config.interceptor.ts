import { Injectable } from '@angular/core';
import {
	HttpInterceptor,
	HttpRequest,
	HttpResponse,
	HttpHandler,
	HttpEvent,
	HttpErrorResponse
} from '@angular/common/http';
import { StateManagementService } from '../services/statemanagement.service';
import { Observable, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { ErrorDialogService } from '../services/error-dialog/errordialog.service';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';
import { NgxSpinnerService } from 'ngx-spinner';

export const SILENT_ERRORS_HEADER = 'X-Silent-Errors';

@Injectable()
export class HttpConfigInterceptor implements HttpInterceptor {
	public errors: any;
	constructor(
		public errorDialogService: ErrorDialogService,
		private authService: AuthService,
		private router: Router,
		private spinner: NgxSpinnerService,
		private stateManagementService: StateManagementService
	) { }

	intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
		const token: string = localStorage.getItem('token');

		// Background requests (e.g. notification polling) opt out of the error dialog.
		const silent = request.headers.has(SILENT_ERRORS_HEADER);
		if (silent) {
			request = request.clone({ headers: request.headers.delete(SILENT_ERRORS_HEADER) });
		}

		if (token) {
			request = request.clone({ headers: request.headers.set('Authorization', 'Bearer ' + token) });
		}

		if (!request.headers.has('Content-Type') && !(request.body instanceof FormData)) {
			request = request.clone({ headers: request.headers.set('Content-Type', 'application/json') });
		}

		request = request.clone({ headers: request.headers.set('Accept', 'application/json') });

		return next.handle(request).pipe(
			map((event: HttpEvent<any>) => {
				if (event instanceof HttpResponse) {
					console.log('\n\nevent--->>>', event, '\n\n');
				}
				return event;
			}),
			catchError((errorData: HttpErrorResponse) => {
				if (silent) {
					return throwError(() => errorData);
				}
				this.spinner.hide()
				if (errorData.status == 401) {
					this.errors = {
						errors: {
							error: 'Session Expired. Please reload the screen.'
						}
					}
					localStorage.clear()
					sessionStorage.clear()
				}
				else if (errorData.status == 440) {
					this.errors = {
						errors: {
							'error': 'Session Expired. Please re-login to continue. You will be navigated to homepage after 1 second.'
						}
					};
					localStorage.clear();
					sessionStorage.clear();
					setTimeout(() => {
						location.reload()
					}, 2800)
				}
				else if (errorData.status == 488) {
					this.errors = {
						errors: {
							'error': "You are not authorized to access this resource"
						}
					};
					setTimeout(() => {
						this.router.navigate(['/home'])
					}, 2800)
				}
				else if (errorData.status == 500) {
					this.errors = {
						errors: {
							error: "Server Error"
						}
					}
				}
				else if (errorData.status == 404) {
					this.errors = {
						errors: {
							error: 'Server Error. Request Not Found. '
						}
					}
				}
				else {
					this.errors = { errors: { error: Object.values(errorData.error.data.errors).join('\n') } };
					if (this.errors.errors.error.includes('account not found')) {
						localStorage.clear()
						sessionStorage.clear()
						location.reload()
					}
				}
				this.spinner.hide()
				this.errorDialogService.openDialog(this.errors);
				return throwError(this.errors);
			}));
	}
}