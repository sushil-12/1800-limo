import { BrowserModule } from '@angular/platform-browser';
import { ErrorHandler, NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { HttpConfigInterceptor } from './interceptors/http-config.interceptor';
import { AuthInterceptor } from './interceptors/auth.interceptor';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { HeaderComponent } from './components/website/includes--website/header/header.component';
import { FooterComponent } from './components/website/includes--website/footer/footer.component';
import { HomeComponent } from './components/website/home/home.component';
import { ContactUsComponent } from './components/website/contact-us/contact-us.component';
import { AboutUsComponent } from './components/website/about-us/about-us.component';
import { FleetComponent } from './components/website/fleet/fleet.component';
import { SafetyComponent } from './components/website/safety/safety.component';
import { CustomerFaqComponent } from './components/website/customer-faq/customer-faq.component';
import { DriverFaqComponent } from './components/website/driver-faq/driver-faq.component';
import { GroupTravelPlannerComponent } from './components/website/group-travel-planner/group-travel-planner.component';
import { CancellationPolicyComponent } from './components/website/cancellation-policy/cancellation-policy.component';
import { PageNotFoundComponent } from './components/website/includes--website/page-not-found/page-not-found.component';
// import { HeaderComponent as QuotebotHeaderComponent } from './components/quotebot/includes--quotebot/header/header.component';
// import { FooterComponent as QuotebotFooterComponent } from './components/quotebot/includes--quotebot/footer/footer.component';

//material components
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatDialogModule } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { SharedModule } from './components/shared/shared.module';


//
//spinner
import { NgxSpinnerModule } from "ngx-spinner";
//

//maps
// import { NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { GoogleMapsModule } from '@angular/google-maps';
import { QuotebotModule } from './components/quotebot/quotebot.module';
import { WebsiteTemplateComponent } from './components/website/website-template/website-template.component';
import { QuotebotTemplateComponent } from './components/quotebot/quotebot-template/quotebot-template.component';
import { UserTemplateComponent } from './components/user/user-template/user-template.component';
import { InsuranceLicensingComponent } from './components/website/insurance-licensing/insurance-licensing.component';
import { ClientEmailConfirmationComponent } from './components/email_templates/client-email-confirmation/client-email-confirmation.component';
import { DriverEmailConfirmationComponent } from './components/email_templates/driver-email-confirmation/driver-email-confirmation.component';
import { ReservationCancellationComponent } from './components/email_templates/reservation-cancellation/reservation-cancellation.component';
import { LoginComponent } from './components/website/login/login.component';
import { OtpComponent } from './components/website/otp/otp.component';
import { ErrorDialogService } from './services/error-dialog/errordialog.service';
import { GloabalErrorHandlerService } from './services/gloabal-error-handler.service'
//

//admin
import { AdminTemplateComponent } from './components/admin/admin-template/admin-template.component';
import { CustomUrlPipePipe } from './pipes/custom-url-pipe.pipe';
import { AffiliateEmailConfirmationComponent } from './components/email-pages/affiliate-email-confirmation/affiliate-email-confirmation.component';
import { DispatchEmailConfirmationComponent } from './components/email-pages/dispatch-email-confirmation/dispatch-email-confirmation.component';
import { ScrollToSectionDirective } from './directives/scroll-to-section.directive';
import { PageUnderConstructionComponent } from './components/page-under-construction/page-under-construction.component';
import { HtmlToTextPipe } from './pipes/html-to-text.pipe';
import { BookingStatusVerificationComponent } from './components/email-pages/booking-status-verification/booking-status-verification.component';
import { TransactionHistoryComponent } from './components/website/transaction-history/transaction-history.component';
import { NgOtpInputModule } from 'ng-otp-input';
import { AutoDetectOtpDirective } from './auto-detect-otp.directive';
import { LongPressDirective } from './directives/long-press.directive';
import { AutoFocusDirective } from './directives/auto-focus.directive';
import { IndividualConfirmationComponent } from './components/email-pages/individual-confirmation/individual-confirmation.component';
import { MatRadioModule } from '@angular/material/radio';
import { ModifyBookingComponent } from './components/email-pages/modify-booking/modify-booking.component';
import { PartnerRegistrationComponent } from './components/subscription/partner-registration/partner-registration.component';
import { SubscriptionPlansComponent } from './components/subscription/subscription-plans/subscription-plans.component';
import { PaymentDetailsComponent } from './components/subscription/payment-details/payment-details.component';
import { AddBankComponent } from './components/subscription/add-bank/add-bank.component';
import { AddVehicleSubscriberComponent } from './components/subscription/add-vehicle-subscriber/add-vehicle-subscriber.component';
import { NgSelectModule } from '@ng-select/ng-select';
import { VehicleDetailsComponent } from './components/subscription/vehicle-details/vehicle-details.component';
import { VehicleRatesSubscriberComponent } from './components/subscription/vehicle-rates-subscriber/vehicle-rates-subscriber.component';
import { EditVehicleSubscriberComponent } from './components/subscription/edit-vehicle-subscriber/edit-vehicle-subscriber.component';
import { DriverDetailsComponent } from './components/subscription/driver-details/driver-details.component';
import { AddDriverSubscriberComponent } from './components/subscription/add-driver-subscriber/add-driver-subscriber.component';
import { FarmOutBookingsComponent } from './components/subscription/farm-out-bookings/farm-out-bookings.component';
import { TutorialsComponent } from './components/website/tutorials/tutorials.component';
import { LiveRideTrackingComponent } from './components/public/live-ride-tracking/live-ride-tracking.component';
import { RideChatComponent } from './components/public/live-ride-tracking/ride-chat/ride-chat.component';
import { StatesTestComponent } from './components/public/states-test/states-test.component';
import { AppLinkFallbackComponent } from './components/public/app-link-fallback/app-link-fallback.component';
import { NgxChartsModule } from '@swimlane/ngx-charts';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import { BsDatepickerModule } from 'ngx-bootstrap/datepicker';
import { NgxDaterangepickerMd } from 'ngx-daterangepicker-material';
import { PrivacyPolicyComponent } from './components/website/privacy-policy/privacy-policy.component';
import { DeliveryMembershipTCComponent } from './components/website/delivery-membership-t-c/delivery-membership-t-c.component';
import { ClientTCComponent } from './components/website/client-t-c/client-t-c.component';
import { InvestorsComponent } from './components/website/investors/investors.component';
import { BlogComponent } from './components/website/blog/blog.component';
import { BlogDetailComponent } from './components/website/blog-detail/blog-detail.component';
import { ToastrModule } from 'ngx-toastr';
import { NotificationBellComponent } from './components/admin/admin-notifications/notification-bell/notification-bell.component';

@NgModule({
	declarations: [
		AppComponent,
		HeaderComponent,
		FooterComponent,
		HomeComponent,
		ContactUsComponent,
		AboutUsComponent,
		FleetComponent,
		SafetyComponent,
		CustomerFaqComponent,
		DriverFaqComponent,
		GroupTravelPlannerComponent,
		CancellationPolicyComponent,
		PageNotFoundComponent,
		WebsiteTemplateComponent,
		QuotebotTemplateComponent,
		UserTemplateComponent,
		// QuotebotHeaderComponent,
		InsuranceLicensingComponent,
		// QuotebotFooterComponent,
		ClientEmailConfirmationComponent,
		DriverEmailConfirmationComponent,
		ReservationCancellationComponent,
		LoginComponent,
		OtpComponent,
		AdminTemplateComponent,
		CustomUrlPipePipe,
		AffiliateEmailConfirmationComponent,
		DispatchEmailConfirmationComponent,
		ScrollToSectionDirective,
		PageUnderConstructionComponent,
		HtmlToTextPipe,
		BookingStatusVerificationComponent,
		TransactionHistoryComponent,
		AutoDetectOtpDirective,
		LongPressDirective,
		AutoFocusDirective,
		IndividualConfirmationComponent,
		ModifyBookingComponent,
		PartnerRegistrationComponent,
		SubscriptionPlansComponent,
		PaymentDetailsComponent,
		AddBankComponent,
		AddVehicleSubscriberComponent,
		VehicleDetailsComponent,
		VehicleRatesSubscriberComponent,
		EditVehicleSubscriberComponent,
		DriverDetailsComponent,
		AddDriverSubscriberComponent,
		FarmOutBookingsComponent,
		TutorialsComponent,
		LiveRideTrackingComponent,
		RideChatComponent,
		StatesTestComponent,
		AppLinkFallbackComponent,
		PrivacyPolicyComponent,
		DeliveryMembershipTCComponent,
		ClientTCComponent,
		InvestorsComponent,
		BlogComponent,
		BlogDetailComponent
	],
	imports: [
		BrowserModule,
		AppRoutingModule,
		FormsModule,
		BrowserAnimationsModule,
		ReactiveFormsModule,
		MatSidenavModule,
		QuotebotModule,
		HttpClientModule,
		GoogleMapsModule,
		MatDialogModule,
		MatProgressBarModule,
		MatFormFieldModule,
		MatSelectModule,
		NgxSpinnerModule,
		SharedModule,
		NgOtpInputModule,
		MatRadioModule,
		NgSelectModule,
		NgxChartsModule,
		BsDatepickerModule,
		NgxDaterangepickerMd.forRoot(),
		NotificationBellComponent,
		ToastrModule.forRoot({
			positionClass: 'toast-top-right',
			timeOut: 3000,
			closeButton: true,
			progressBar: true,
		})
	],
	providers: [
		{ provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
		{ provide: HTTP_INTERCEPTORS, useClass: HttpConfigInterceptor, multi: true },
		{ provide: MAT_FORM_FIELD_DEFAULT_OPTIONS, useValue: { hideRequiredMarker: true } },
		ErrorDialogService,
		{ provide: ErrorHandler, useClass: GloabalErrorHandlerService }
	],
	bootstrap: [AppComponent]
})
export class AppModule { }