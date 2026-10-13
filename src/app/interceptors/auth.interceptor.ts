import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  private serverUrl = environment.serverUrl;

  constructor(private authService: AuthService) { }

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    // add auth header with jwt if user is logged in and request is to the api url
    const currentUser = this.authService.currentUserValue;
    const accessToken = this.authService.getAccessToken();
    const isLoggedIn = currentUser && accessToken;
    const isApiUrl = request.url.startsWith(this.serverUrl);
    // Keep an explicitly provided Authorization header (e.g. public token links)
    const hasAuthHeader = request.headers.has('Authorization');
    if (isLoggedIn && isApiUrl && !hasAuthHeader) {
      request = request.clone({
        setHeaders: {
          Authorization: `Bearer ${accessToken}`
        }
      });
    }

    return next.handle(request);
  }
}
