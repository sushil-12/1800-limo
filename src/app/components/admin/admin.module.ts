import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
//material
import { NgxSpinnerModule } from "ngx-spinner";
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatDialogModule } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatRadioModule } from '@angular/material/radio';

//

import { AdminRoutingModule } from './admin-routing.module';
import { AdminComponent } from './admin.component';
import { MasterVehicleTypesComponent } from './master-vehicle-types/master-vehicle-types.component';
import { DailyBookingsComponent } from './daily-bookings/daily-bookings.component';
// import { CreateNewBookingComponent } from './create-new-booking-old/create-new-booking.component';
import { QuoteComponent } from './quote/quote.component';
import { InvoiceComponent } from './invoice/invoice.component';
import { CreateDebitCcCardComponent } from './create-debit-cc-card/create-debit-cc-card.component';
import { IndividualComponent } from './individual/individual.component';
import { CorporateComponent } from './corporate/corporate.component';
import { TravelPlannerComponent } from './travel-planner/travel-planner.component';
import { TourGuideComponent } from './tour-guide/tour-guide.component';
import { TravelPlannerReportComponent } from './travel-planner-report/travel-planner-report.component';
import { DriverCommissionReportComponent } from './driver-commission-report/driver-commission-report.component';
import { TourGuideReportComponent } from './tour-guide-report/tour-guide-report.component';
import { AddVehicleComponent } from './add-vehicle/add-vehicle.component';
import { AmenitiesComponent } from './amenities/amenities.component';
import { AddVehicleRatesComponent } from './add-vehicle-rates/add-vehicle-rates.component';
import { AiRateScoreCalculatorComponent } from './ai-rate-score-calculator/ai-rate-score-calculator.component';
import { AiRateHintComponent } from './ai-rate-suggestion/ai-rate-hint.component';
import { AiRateAcceptBarComponent } from './ai-rate-suggestion/ai-rate-accept-bar.component';
import { VehiclesComponent } from './vehicles/vehicles.component';
import { VehicleYearsComponent } from './vehicle-years/vehicle-years.component';
import { VehicleColorComponent } from './vehicle-color/vehicle-color.component';
import { VehicleMakeComponent } from './vehicle-make/vehicle-make.component';
import { VehicleModelComponent } from './vehicle-model/vehicle-model.component';
import { AffiliatePreferenceComponent } from './affiliate-preference/affiliate-preference.component';
import { DriverLanguageComponent } from './driver-language/driver-language.component';
import { DriverDressComponent } from './driver-dress/driver-dress.component';
import { EditVehicleComponent } from './edit-vehicle/edit-vehicle.component';
import { EditVehicleRatesComponent } from './edit-vehicle-rates/edit-vehicle-rates.component';
import { AddIndividualAccountComponent } from './add-individual-account/add-individual-account.component';
import { EditIndividualAccountComponent } from './edit-individual-account/edit-individual-account.component';
import { CardsComponent } from './cards/cards.component';
import { AddCardComponent } from './add-card/add-card.component';
import { EditCardComponent } from './edit-card/edit-card.component';
import { AddTravelPlannerAccountComponent } from './add-travel-planner-account/add-travel-planner-account.component';
import { EditTravelPlannerAccountComponent } from './edit-travel-planner-account/edit-travel-planner-account.component';
import { AffiliateStepsTemplateComponent } from './affiliate-steps-template/affiliate-steps-template.component';
import { AffiliateStep0Component } from './affiliate-step0/affiliate-step0.component';
import { AffiliateStep1Component } from './affiliate-step1/affiliate-step1.component';
import { AffiliateStep2Component } from './affiliate-step2/affiliate-step2.component';
import { AffiliateStep3Component } from './affiliate-step3/affiliate-step3.component';
import { AffiliateStep4Component } from './affiliate-step4/affiliate-step4.component';
import { AffiliateStep5Component } from './affiliate-step5/affiliate-step5.component';
import { AffiliateStep6Component } from './affiliate-step6/affiliate-step6.component';
import { AddDriverComponent } from './add-driver/add-driver.component';


import { BookingStatusTextReplacePipe } from 'src/app/pipes/booking-status-text-replace.pipe';
import { InvoiceSummaryComponent } from './invoice-summary/invoice-summary.component';
import { SubAdminComponent } from './sub-admin/sub-admin.component';
import { AddSubAdminComponent } from './add-sub-admin/add-sub-admin.component';
import { HomePageComponent } from './cms/home-page/home-page.component';
import { HomePageEditComponent } from './cms/home-page-edit/home-page-edit.component';
import { Step0Component } from './cms/step0/step0.component';
import { EditStep0Component } from './cms/edit-step0/edit-step0.component';
import { AboutUsComponent } from './cms/about-us/about-us.component';
import { AboutUsEditComponent } from './cms/about-us-edit/about-us-edit.component';
import { EditStep6Component } from './cms/edit-step6/edit-step6.component';
import { Step6Component } from './cms/step6/step6.component';
import { AffiliateAccountsComponent } from './affiliate-accounts/affiliate-accounts.component';
import { SharedModule } from '../shared/shared.module';
// import { InvalidControlScrollDirective } from 'src/app/directives/scroll-to-invalid.directive';
import { MeetAndGreetComponent } from './meet-and-greet/meet-and-greet.component';
import { AmenitiesInteriorComponent } from './amenities-interior/amenities-interior.component';
import { AmenitiesSpecialComponent } from './amenities-special/amenities-special.component';
import { MasterVehicleFareComponent } from './master-vehicle-fare/master-vehicle-fare.component';
import { BookingDetailsComponent } from './booking-details/booking-details.component';
import { NewBookingComponent } from './new-booking/new-booking.component';
import { AdminBookingHostComponent } from './new-booking-v2/admin-booking-host.component';
import { BookingSharedModule } from '../shared/booking/booking-shared.module';
import { FinalizeBookingComponent } from './finalize-booking/finalize-booking.component';
import { NgSelectModule } from '@ng-select/ng-select';
import { FinalizeRatesComponent } from './finalize-rates/finalize-rates.component';
import { BadgeCitiesComponent } from './badge-cities/badge-cities.component';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { CustomInvoiceComponent } from './custom-invoice/custom-invoice.component';
import { StaffPermissionsComponent } from './staff-permissions/staff-permissions.component';
import { MatTabsModule } from '@angular/material/tabs';
import { StaffRolesListComponent } from './staff-roles-list/staff-roles-list.component';
import { BookingLogsComponent } from './booking-logs/booking-logs.component';
import { MatTableModule } from '@angular/material/table';
import { MatExpansionModule } from '@angular/material/expansion';
import { AffiliateBookingComponent } from './affiliate-booking/affiliate-booking.component';
import { TravelAgentStepsComponent } from './travel-agent-steps/travel-agent-steps.component';
import { TravelAgentStripeFormComponent } from './travel-agent-stripe-form/travel-agent-stripe-form.component';
import { RecoverAccountsComponent } from './recover-accounts/recover-accounts.component';
import { ClipboardModule } from '@angular/cdk/clipboard';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { SubTravelPlannerAccountComponent } from './sub-travel-planner-account/sub-travel-planner-account.component';
import { LooseAffiliateAccountsComponent } from './loose-affiliate-accounts/loose-affiliate-accounts.component';
import { LooseAffiliateAccountDetailsComponent } from './loose-affiliate-account-details/loose-affiliate-account-details.component';
import { FleetComponent } from './cms/fleet/fleet.component';
import { FleetPageEditComponent } from './cms/fleet-page-edit/fleet-page-edit.component';
import { SubscribersListComponent } from './subscribers-list/subscribers-list.component';
import { ServiceLeadsComponent } from './service-leads/service-leads.component';
import { AffiliateMapPinsComponent } from './affiliate-map-pins/affiliate-map-pins.component';
import { NgxChartsModule } from '@swimlane/ngx-charts';
import { ReportsAdminComponent } from './reports-admin/reports-admin.component';
import { ReportsAdminVehiclesComponent } from './reports-admin-vehicles/reports-admin-vehicles.component';
import { ReportsAdminVehicleAverageComponent } from './reports-admin-vehicle-average/reports-admin-vehicle-average.component';
import { ReportsAdminUsersComponent } from './reports-admin-users/reports-admin-users.component';
import { LooseAffiliateVehiclesComponent } from './loose-affiliate-vehicles/loose-affiliate-vehicles.component';
import { GoogleMapsModule } from '@angular/google-maps';
import { BookingPreviewModule } from '../affiliate/booking-preview/booking-preview.module';
import { CcoAccountsComponent } from './cco-accounts/cco-accounts.component';
import { NgxDaterangepickerMd } from 'ngx-daterangepicker-material';
import { QuillModule } from 'ngx-quill';


@NgModule({
	declarations: [
		AdminComponent,
		MasterVehicleTypesComponent,
		DailyBookingsComponent,
		// CreateNewBookingComponent,
		QuoteComponent,
		InvoiceComponent,
		CreateDebitCcCardComponent,
		IndividualComponent,
		CorporateComponent,
		TravelPlannerComponent,
		TourGuideComponent,
		TravelPlannerReportComponent,
		DriverCommissionReportComponent,
		TourGuideReportComponent,
		AddVehicleComponent,
		AmenitiesComponent,
		AddVehicleRatesComponent,
		AiRateScoreCalculatorComponent,
		AiRateHintComponent,
		AiRateAcceptBarComponent,
		VehiclesComponent,
		VehicleYearsComponent,
		VehicleColorComponent,
		VehicleMakeComponent,
		VehicleModelComponent,
		AffiliatePreferenceComponent,
		DriverLanguageComponent,
		DriverDressComponent,
		EditVehicleComponent,
		EditVehicleRatesComponent,
		AddIndividualAccountComponent,
		EditIndividualAccountComponent,
		CardsComponent,
		AddCardComponent,
		EditCardComponent,
		AddTravelPlannerAccountComponent,
		EditTravelPlannerAccountComponent,
		AffiliateStepsTemplateComponent,
		AffiliateStep0Component,
		AffiliateStep1Component,
		AffiliateStep2Component,
		AffiliateStep3Component,
		AffiliateStep4Component,
		AffiliateStep5Component,
		AffiliateStep6Component,
		AddDriverComponent,
		BookingStatusTextReplacePipe,
		InvoiceSummaryComponent,
		SubAdminComponent,
		AddSubAdminComponent,
		HomePageComponent,
		HomePageEditComponent,
		Step0Component,
		EditStep0Component,
		AboutUsComponent,
		AboutUsEditComponent,
		EditStep6Component,
		Step6Component,
		AffiliateAccountsComponent,
		MeetAndGreetComponent,
		AmenitiesInteriorComponent,
		AmenitiesSpecialComponent,
		MasterVehicleFareComponent,
		BookingDetailsComponent,
		NewBookingComponent,
		AdminBookingHostComponent,
		FinalizeBookingComponent,
		FinalizeRatesComponent,
		BadgeCitiesComponent,
		CustomInvoiceComponent,
		StaffPermissionsComponent,
		StaffRolesListComponent,
		BookingLogsComponent,
		AffiliateBookingComponent,
		TravelAgentStepsComponent,
		TravelAgentStripeFormComponent,
		RecoverAccountsComponent,
		SubTravelPlannerAccountComponent,
		LooseAffiliateAccountsComponent,
		LooseAffiliateAccountDetailsComponent,
		FleetComponent,
		FleetPageEditComponent,
		SubscribersListComponent,
		ServiceLeadsComponent,
		AffiliateMapPinsComponent,
		ReportsAdminComponent,
		ReportsAdminVehiclesComponent,
		ReportsAdminVehicleAverageComponent,
		ReportsAdminUsersComponent,
		LooseAffiliateVehiclesComponent,
		CcoAccountsComponent
	],
	imports: [
		CommonModule,
		AdminRoutingModule,
		NgxSpinnerModule,
		FormsModule,
		ReactiveFormsModule,
		MatDialogModule,
		MatProgressBarModule,
		MatSlideToggleModule,
		GoogleMapsModule,
		MatNativeDateModule,
		MatDatepickerModule,
		MatFormFieldModule,
		MatInputModule,
		MatSelectModule,
		SharedModule,
		BookingSharedModule,
		MatRadioModule,
		NgSelectModule,
		MatChipsModule,
		MatTabsModule,
		MatTableModule,
		MatExpansionModule,
		MatIconModule,
		ClipboardModule,
		DragDropModule,
		NgxChartsModule,
		BookingPreviewModule,
		NgxDaterangepickerMd.forRoot({
			separator: ' - ',
			applyLabel: 'Okay',
		}),
		QuillModule,
	],
	exports: [BookingStatusTextReplacePipe, MatIconModule, AiRateHintComponent, AiRateAcceptBarComponent]
})
export class AdminModule { }
