import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { MasterVehicleTypesComponent } from './master-vehicle-types/master-vehicle-types.component';
import { DailyBookingsComponent } from './daily-bookings/daily-bookings.component';
import { QuoteComponent } from './quote/quote.component';
import { InvoiceComponent } from './invoice/invoice.component';
import { IndividualComponent } from './individual/individual.component';
import { CorporateComponent } from './corporate/corporate.component';
import { TravelPlannerComponent } from './travel-planner/travel-planner.component';
import { TourGuideComponent } from './tour-guide/tour-guide.component';
import { AffiliateAccountsComponent } from './affiliate-accounts/affiliate-accounts.component';
import { TravelPlannerReportComponent } from './travel-planner-report/travel-planner-report.component';
import { DriverCommissionReportComponent } from './driver-commission-report/driver-commission-report.component';
import { AmenitiesComponent } from './amenities/amenities.component';
import { AddVehicleComponent } from './add-vehicle/add-vehicle.component';
import { AddVehicleRatesComponent } from './add-vehicle-rates/add-vehicle-rates.component';
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
import { MeetAndGreetComponent } from './meet-and-greet/meet-and-greet.component';
import { InvoiceSummaryComponent } from './invoice-summary/invoice-summary.component';
import { SubAdminComponent } from './sub-admin/sub-admin.component';
import { AddSubAdminComponent } from './add-sub-admin/add-sub-admin.component';
import { AdminGuardGuard } from '../../../app/guards/admin-guard.guard';
import { AdminNotificationsComponent } from './admin-notifications/admin-notifications.component';
import { SubAdminGuard } from '../../../app/guards/sub-admin.guard';
import { CreateDebitCcCardComponent } from './create-debit-cc-card/create-debit-cc-card.component';
import { HomePageComponent } from './cms/home-page/home-page.component';
import { HomePageEditComponent } from './cms/home-page-edit/home-page-edit.component';
import { Step0Component } from './cms/step0/step0.component';
import { EditStep0Component } from './cms/edit-step0/edit-step0.component';
import { AboutUsComponent } from './cms/about-us/about-us.component';
import { AboutUsEditComponent } from './cms/about-us-edit/about-us-edit.component';
import { Step6Component } from './cms/step6/step6.component';
import { EditStep6Component } from './cms/edit-step6/edit-step6.component';
import { AmenitiesSpecialComponent } from './amenities-special/amenities-special.component';
import { AmenitiesInteriorComponent } from './amenities-interior/amenities-interior.component';
import { MasterVehicleFareComponent } from './master-vehicle-fare/master-vehicle-fare.component';
import { NewBookingComponent } from './new-booking/new-booking.component';
import { AdminBookingHostComponent } from './new-booking-v2/admin-booking-host.component';
import { FinalizeBookingComponent } from './finalize-booking/finalize-booking.component';
import { BadgeCitiesComponent } from './badge-cities/badge-cities.component';
import { CustomInvoiceComponent } from './custom-invoice/custom-invoice.component';
import { StaffPermissionsComponent } from './staff-permissions/staff-permissions.component';
import { StaffRolesListComponent } from './staff-roles-list/staff-roles-list.component';
import { BookingLogsComponent } from './booking-logs/booking-logs.component';
import { AffiliateBookingComponent } from './affiliate-booking/affiliate-booking.component';
import { TravelAgentStepsComponent } from './travel-agent-steps/travel-agent-steps.component';
import { TravelAgentStripeFormComponent } from './travel-agent-stripe-form/travel-agent-stripe-form.component';
import { RecoverAccountsComponent } from './recover-accounts/recover-accounts.component';
import { SubTravelPlannerAccountComponent } from './sub-travel-planner-account/sub-travel-planner-account.component';
import { LooseAffiliateAccountsComponent } from './loose-affiliate-accounts/loose-affiliate-accounts.component';
import { LooseAffiliateAccountDetailsComponent } from './loose-affiliate-account-details/loose-affiliate-account-details.component';
import { FleetComponent } from './cms/fleet/fleet.component';
import { FleetPageEditComponent } from './cms/fleet-page-edit/fleet-page-edit.component';
import { AddBankComponent } from '../subscription/add-bank/add-bank.component';
import { AddVehicleSubscriberComponent } from '../subscription/add-vehicle-subscriber/add-vehicle-subscriber.component';
import { VehicleDetailsComponent } from '../subscription/vehicle-details/vehicle-details.component';
import { VehicleRatesSubscriberComponent } from '../subscription/vehicle-rates-subscriber/vehicle-rates-subscriber.component';
import { EditVehicleSubscriberComponent } from '../subscription/edit-vehicle-subscriber/edit-vehicle-subscriber.component';
import { SubscribersListComponent } from './subscribers-list/subscribers-list.component';
import { DriverDetailsComponent } from '../subscription/driver-details/driver-details.component';
import { AddDriverSubscriberComponent } from '../subscription/add-driver-subscriber/add-driver-subscriber.component';
import { FarmOutBookingsComponent } from '../subscription/farm-out-bookings/farm-out-bookings.component';
import { AffiliateMapPinsComponent } from './affiliate-map-pins/affiliate-map-pins.component';
import { ReportsAdminComponent } from './reports-admin/reports-admin.component';
import { ReportsAdminVehiclesComponent } from './reports-admin-vehicles/reports-admin-vehicles.component';
import { ReportsAdminVehicleAverageComponent } from './reports-admin-vehicle-average/reports-admin-vehicle-average.component';
import { ReportsAdminUsersComponent } from './reports-admin-users/reports-admin-users.component';
import { LooseAffiliateVehiclesComponent } from './loose-affiliate-vehicles/loose-affiliate-vehicles.component';
import { CcoAccountsComponent } from './cco-accounts/cco-accounts.component'
import { BookingDetailsComponent } from './booking-details/booking-details.component';


const routes: Routes = [
	{
		path: 'cms/home-page',
		canActivate: [SubAdminGuard],
		component: HomePageComponent
	},
	{
		path: 'cms/home-page/edit/:id',
		canActivate: [SubAdminGuard],
		component: HomePageEditComponent
	},
	{
		path: 'cms/step0',
		canActivate: [SubAdminGuard],
		component: Step0Component
	},
	{
		path: 'cms/step0/edit/:id',
		canActivate: [SubAdminGuard],
		component: EditStep0Component
	},
	{
		path: 'cms/fleet/edit/:id',
		canActivate: [SubAdminGuard],
		component: FleetPageEditComponent
	},
	{
		path: 'cms/step6',
		canActivate: [SubAdminGuard],
		component: Step6Component
	},
	{
		path: 'cms/step6/edit/:id',
		canActivate: [SubAdminGuard],
		component: EditStep6Component
	},
	{
		path: 'cms/about-us',
		canActivate: [SubAdminGuard],
		component: AboutUsComponent
	},
	{
		path: 'cms/about-us/edit/:id',
		canActivate: [SubAdminGuard],
		component: AboutUsEditComponent
	},
	{
		path: 'cms/fleet',
		canActivate: [SubAdminGuard],
		component: FleetComponent
	},
	{
		path: '',
		redirectTo: 'daily-bookings-admin',
		pathMatch: 'full'
	},
	{
		path: 'master-vehicle-types',
		canActivate: [AdminGuardGuard],
		component: MasterVehicleTypesComponent
	},
	{
		path: 'master-vehicle-types/master-vehicle-fare',
		component: MasterVehicleFareComponent
	},
	{
		path: 'add-vehicle',
		canActivate: [AdminGuardGuard],
		component: AddVehicleComponent
	},
	{
		path: 'add-vehicle/:vehicleTypeId',
		canActivate: [AdminGuardGuard],
		component: AddVehicleComponent
	},
	{
		path: 'vehicles',
		canActivate: [AdminGuardGuard],
		component: VehiclesComponent
	},
	{
		path: 'add-vehicle-rates',
		canActivate: [AdminGuardGuard],
		component: AddVehicleRatesComponent
	},
	{
		path: 'edit-vehicle',
		canActivate: [AdminGuardGuard],
		component: EditVehicleComponent
	},
	{
		path: 'edit-vehicle-rates',
		canActivate: [AdminGuardGuard],
		component: EditVehicleRatesComponent
	},
	{
		path: 'daily-bookings-admin',
		canActivate: [SubAdminGuard],
		component: DailyBookingsComponent
	},
	{
		path: 'notifications',
		canActivate: [AdminGuardGuard],
		component: AdminNotificationsComponent
	},
	{
		path: 'booking-list',
		canActivate: [SubAdminGuard],
		component: AffiliateBookingComponent
	},
	{
		path: 'booking-details',
		canActivate: [SubAdminGuard],
		component: BookingDetailsComponent
	},
	{
		path: 'new-booking',
		canActivate: [SubAdminGuard],
		component: NewBookingComponent
	},
	{
		path: 'new-booking-v2',
		canActivate: [SubAdminGuard],
		component: AdminBookingHostComponent
	},
	{
		path: 'finalize-booking',
		canActivate: [SubAdminGuard],
		component: FinalizeBookingComponent
	},
	{
		path: 'quote-admin',
		canActivate: [SubAdminGuard],
		component: QuoteComponent
	},
	{
		path: 'invoices-admin',
		canActivate: [SubAdminGuard],
		component: InvoiceComponent
	},
	{
		path: 'create-debit-cc-card-admin',
		canActivate: [SubAdminGuard],
		component: CreateDebitCcCardComponent
	},
	{
		path: 'individual-account-admin',
		canActivate: [SubAdminGuard],
		component: IndividualComponent
	},
	// {
	// 	path: 'corporate-account-admin',
	// 	canActivate: [SubAdminGuard],
	// 	component: CorporateComponent
	// },
	{
		path: 'travel-planner-account-admin',
		canActivate: [SubAdminGuard],
		component: TravelPlannerComponent
	},
	{
		path: 'tour-guide-account-admin',
		canActivate: [SubAdminGuard],
		component: TourGuideComponent
	},
	{
		path: 'affiliates/:_affiliateType',
		canActivate: [SubAdminGuard],
		component: AffiliateAccountsComponent
	},
	{
		path: 'travel-planner-reports-admin',
		canActivate: [SubAdminGuard],
		component: TravelPlannerReportComponent
	},
	{
		path: 'driver-commission-reports-admin',
		canActivate: [SubAdminGuard],
		component: DriverCommissionReportComponent
	},
	{
		path: 'tour-guide-reports-admin',
		canActivate: [SubAdminGuard],
		component: TourGuideComponent
	},
	{
		path: 'amenities',
		canActivate: [AdminGuardGuard],
		component: AmenitiesComponent
	},
	{
		path: 'specialAmenity',
		canActivate: [AdminGuardGuard],
		component: AmenitiesSpecialComponent
	},
	{
		path: 'interiorAmenity',
		canActivate: [AdminGuardGuard],
		component: AmenitiesInteriorComponent
	},
	{
		path: 'vehicle-years',
		canActivate: [AdminGuardGuard],
		component: VehicleYearsComponent
	},
	{
		path: 'badge-cities',
		canActivate: [AdminGuardGuard],
		component: BadgeCitiesComponent
	},
	{
		path: 'vehicle-colors',
		canActivate: [AdminGuardGuard],
		component: VehicleColorComponent
	},
	{
		path: 'vehicle-make',
		canActivate: [AdminGuardGuard],
		component: VehicleMakeComponent
	},
	{
		path: 'vehicle-model',
		canActivate: [AdminGuardGuard],
		component: VehicleModelComponent
	},
	{
		path: 'affiliate-preference',
		canActivate: [AdminGuardGuard],
		component: AffiliatePreferenceComponent
	},
	{
		path: 'driver-language',
		canActivate: [AdminGuardGuard],
		component: DriverLanguageComponent
	},
	{
		path: 'driver-dress',
		canActivate: [AdminGuardGuard],
		component: DriverDressComponent
	},
	{
		path: 'meet-and-greet',
		canActivate: [AdminGuardGuard],
		component: MeetAndGreetComponent
	},
	{
		path: 'add-individual-account',
		canActivate: [SubAdminGuard],
		component: AddIndividualAccountComponent
	},
	// {
	// 	path: 'demo-add-individual-account',
	// 	canActivate: [SubAdminGuard],
	// 	component: DemoAddIndividualComponent
	// },
	{
		path: 'edit-individual-account',
		canActivate: [SubAdminGuard],
		component: EditIndividualAccountComponent
	},
	// {
	// 	path: 'add-corporate-account',
	// 	canActivate: [SubAdminGuard],
	// 	component: AddCorporateAccountComponent
	// },
	// {
	// 	path: 'edit-corporate-account',
	// 	canActivate: [SubAdminGuard],
	// 	component: EditCorporateAccountComponent
	// },
	{
		path: 'travel-planner-account',
		// canActivate: [],
		canActivate: [SubAdminGuard],
		component: TravelAgentStepsComponent,
		data: {
			title: 'TravelAgent'
		},
		children: [
			{
				path: 'step1',
				component: AddTravelPlannerAccountComponent
			},
			{
				path: 'step2',
				component: TravelAgentStripeFormComponent
			},
		]
	},
	{
		path: 'sub-travel-planner-account',
		canActivate: [SubAdminGuard],
		component: SubTravelPlannerAccountComponent
	},
	// {
	// 	path: 'add-travel-planner-account',
	// 	canActivate: [SubAdminGuard],
	// 	component: AddTravelPlannerAccountComponent
	// },
	// {
	// 	path: 'edit-travel-planner-account',
	// 	canActivate: [SubAdminGuard],
	// 	component: EditTravelPlannerAccountComponent
	// },
	{
		path: 'cards',
		canActivate: [SubAdminGuard],
		component: CardsComponent
	},
	{
		path: 'add-card',
		canActivate: [SubAdminGuard],
		component: AddCardComponent
	},
	{
		path: 'edit-card',
		canActivate: [SubAdminGuard],
		component: EditCardComponent
	},
	// {
	// 	path: 'staff',
	// 	canActivate: [SubAdminGuard],
	// 	component: StaffComponent
	// },
	// {
	// 	path: 'add-staff',
	// 	canActivate: [SubAdminGuard],
	// 	component: AddStaffComponent
	// },
	// {
	// 	path: 'edit-staff',
	// 	canActivate: [SubAdminGuard],
	// 	component: EditStaffComponent
	// },
	{
		path: 'invoice-summary',
		canActivate: [SubAdminGuard],
		component: InvoiceSummaryComponent
	},
	{
		path: 'custom-invoice-summary',
		canActivate: [SubAdminGuard],
		component: CustomInvoiceComponent
	},
	{
		path: 'sub-admins',
		canActivate: [AdminGuardGuard],
		component: SubAdminComponent
	},
	{
		path: 'add-sub-admin',
		canActivate: [AdminGuardGuard],
		component: AddSubAdminComponent
	},
	{
		path: 'edit-sub-admin',
		canActivate: [AdminGuardGuard],
		component: AddSubAdminComponent
	},
	{
		path: 'staff-roles-list',
		canActivate: [AdminGuardGuard],
		component: StaffRolesListComponent
	},

	{
		path: 'staff-permissions',
		canActivate: [AdminGuardGuard],
		component: StaffPermissionsComponent
	},
	{
		path: 'all-accounts',
		canActivate: [AdminGuardGuard],
		component: RecoverAccountsComponent
	},
	{
		path: 'cco-accounts',
		canActivate: [AdminGuardGuard],
		component: CcoAccountsComponent
	},
	{
		path: 'loose-affiliate-accounts',
		canActivate: [AdminGuardGuard],
		component: LooseAffiliateAccountsComponent
	},
	{
		path: 'add-loose-affiliate-account',
		canActivate: [AdminGuardGuard],
		component: LooseAffiliateAccountDetailsComponent
	},
	{
		path: 'edit-loose-affiliate-account',
		canActivate: [AdminGuardGuard],
		component: LooseAffiliateAccountDetailsComponent
	},
	{
		path: 'add-bank-details',
		canActivate: [AdminGuardGuard],
		component: AddBankComponent
	},
	{
		path: 'affiliate',
		canActivate: [SubAdminGuard],
		component: AffiliateStepsTemplateComponent,
		data: {
			title: 'Affiliate'
		},
		children: [
			{
				path: 'step0',
				component: AffiliateStep0Component
			},
			{
				path: 'step1',
				component: AffiliateStep1Component
			},
			{
				path: 'step2',
				component: AffiliateStep2Component
			},
			{
				path: 'step3',
				component: AffiliateStep3Component
			},
			{
				path: 'step4',
				component: AffiliateStep4Component
			},
			{
				path: 'step4/add-driver',
				component: AddDriverComponent
			},
			{
				path: 'step5',
				component: AffiliateStep5Component
			},
			{
				path: 'step5/add-vehicle',
				component: AddVehicleComponent
			},
			{
				path: 'step5/add-vehicle-rates',
				component: AddVehicleRatesComponent
			},
			{
				path: 'step5/edit-vehicle',
				component: AddVehicleComponent
			},
			{
				path: 'step5/edit-vehicle-rates',
				component: EditVehicleRatesComponent
			},
			{
				path: 'step5/duplicate-vehicle',
				component: AddVehicleComponent
			},
			{
				path: 'step6',
				component: AffiliateStep6Component
			}
		]
	},
	{
		path: 'vehicle-details',
		canActivate: [AdminGuardGuard],
		component: VehicleDetailsComponent
	},
	{
		path: 'driver-details',
		canActivate: [AdminGuardGuard],
		component: DriverDetailsComponent
	},
	{
		path: 'add-vehicle-subscriber',
		canActivate: [AdminGuardGuard],
		component: AddVehicleSubscriberComponent
	},
	{
		path: 'edit-vehicle-subscriber',
		canActivate: [AdminGuardGuard],
		component: EditVehicleSubscriberComponent
	},
	{
		path: 'add-vehicle-rates-subscriber',
		canActivate: [AdminGuardGuard],
		component: VehicleRatesSubscriberComponent
	},
	{
		path: 'edit-vehicle-rates-subscriber',
		canActivate: [AdminGuardGuard],
		component: VehicleRatesSubscriberComponent
	},
	{
		path: 'add-driver-subscriber',
		canActivate: [AdminGuardGuard],
		component: AddDriverSubscriberComponent
	},
	{
		path: 'edit-driver-subscriber',
		canActivate: [AdminGuardGuard],
		component: AddDriverSubscriberComponent
	},
	{
		path: 'subscribers-list',
		canActivate: [AdminGuardGuard],
		component: SubscribersListComponent
	},
	{
		path: 'farm-out-bookings',
		canActivate: [AdminGuardGuard],
		component: FarmOutBookingsComponent
	},
	{
		path: 'maps',
		canActivate: [AdminGuardGuard],
		component: AffiliateMapPinsComponent
	},
	{
		path: 'reports-admin-bookings',
		canActivate: [AdminGuardGuard],
		component: ReportsAdminComponent
	},
	{
		path: 'reports-admin-vehicles',
		canActivate: [AdminGuardGuard],
		component: ReportsAdminVehiclesComponent
	},
	{
		path: 'reports-admin-vehicles-share',
		canActivate: [AdminGuardGuard],
		component: ReportsAdminVehicleAverageComponent
	},
	{
		path: 'reports-admin-users',
		canActivate: [AdminGuardGuard],
		component: ReportsAdminUsersComponent
	},
	{
		path: 'loose-affliate-vehicles',
		canActivate: [AdminGuardGuard],
		component: LooseAffiliateVehiclesComponent
	},
	{
		path: 'add-vehicle-loose-affiliate',
		canActivate: [AdminGuardGuard],
		component: AddVehicleSubscriberComponent
	},
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class AdminRoutingModule { }
