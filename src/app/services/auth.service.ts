import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private serverUrl = environment.serverUrl;
  private errors = {};
  constructor(private httpClient: HttpClient) { }


  setError(value) {
    this.errors = value;
  }
  getError() {
    return this.errors;
  }

  public get currentUserValue() {
    return JSON.parse(localStorage.getItem('currentUser'));
  }

  login(data) {
    return this.httpClient.post(this.serverUrl + 'login-otp', data);
  }

  verifyOtp(data) {
    return this.httpClient.post(this.serverUrl + 'login', data);
  }

  resendOtp(data) {
    return this.httpClient.post(this.serverUrl + 'resend-otp', data);
  }

  logout() {
    return this.httpClient.post(this.serverUrl + 'logout', {});
  }

  getAccessToken() {
    return localStorage.getItem('access_token');
  }

  subscriberOtp(data) {
    return this.httpClient.post(this.serverUrl + 'subscriber-otp', data);
  }

  verifySubsciberOtp(data) {
    return this.httpClient.post(this.serverUrl + 'verify-otp', data);
  }

  registerSubscriber(data){
    return this.httpClient.post(this.serverUrl + 'register-subscriber', data);
  }

  validateSubsData(data){
    return this.httpClient.post(this.serverUrl + 'validate-subscriber-data', data);
  }
 

  getSubsPlans(){
    return this.httpClient.get(this.serverUrl + 'get-subscription-products');
  }

  /** Texts the driver app download link. `data.phone` must be in E.164 form (`+15551234567`). */
  sendDriverAppLink(data: { phone: string }) {
    // return this.httpClient.post(this.serverUrl + 'send-driver-app-link', data);
    return this.httpClient.post('https://api.1800limo.com/api/send-driver-app-link', data);
  }

  createPayment(data){
    return this.httpClient.post(this.serverUrl + 'create-subscription-plan', data);
  }

  upgradePlan(data){
    return this.httpClient.post(this.serverUrl + 'affiliate/upgrade-to-subscriber', data);
  }

}
