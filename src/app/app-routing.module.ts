import { DriverComponent } from '../landing-pages/driver/driver.component';
import { QuotebotTemplateComponent } from './components/quotebot/quotebot-template/quotebot-template.component';
import { WebsiteTemplateComponent } from './components/website/website-template/website-template.component';
import { ClientTCComponent } from './components/website/client-t-c/client-t-c.component';
import { DeliveryMembershipTCComponent } from './components/website/delivery-membership-t-c/delivery-membership-t-c.component';
import { PrivacyPolicyComponent } from './components/website/privacy-policy/privacy-policy.component';
import { SuggestionsComplaintsComponent } from './components/website/suggestions-complaints/suggestions-complaints.component';
import { TestimonialsComponent } from './components/website/testimonials/testimonials.component';
import { ContactUsComponent } from './components/website/contact-us/contact-us.component';
import { BlogComponent } from './components/website/blog/blog.component';
import { BlogDetailComponent } from './components/website/blog-detail/blog-detail.component';
import { InvestorsComponent } from './components/website/investors/investors.component';
import { GroupTravelPlannerComponent } from './components/website/group-travel-planner/group-travel-planner.component';
import { PageNotFoundComponent } from './components/website/includes--website/page-not-found/page-not-found.component';
import { CancellationPolicyComponent } from './components/website/cancellation-policy/cancellation-policy.component';
import { DriverFaqComponent } from './components/website/driver-faq/driver-faq.component';
import { CustomerFaqComponent } from './components/website/customer-faq/customer-faq.component';
import { SafetyComponent } from './components/website/safety/safety.component';
import { FleetComponent } from './components/website/fleet/fleet.component';
import { AboutUsComponent } from './components/website/about-us/about-us.component';
import { HomeComponent } from './components/website/home/home.component';
import { NgModule } from '@angular/core';
import { Routes, RouterModule, UrlSegment } from '@angular/router';
import { InsuranceLicensingComponent } from './components/website/insurance-licensing/insurance-licensing.component';
import { FailedQuoteRequestConfirmationComponent } from './components/email_templates/failed-quote-request-confirmation/failed-quote-request-confirmation.component';
import { ClientEmailConfirmationComponent } from './components/email_templates/client-email-confirmation/client-email-confirmation.component';
import { DriverEmailConfirmationComponent } from './components/email_templates/driver-email-confirmation/driver-email-confirmation.component';
import { ReservationCancellationComponent } from './components/email_templates/reservation-cancellation/reservation-cancellation.component';
import { UserTemplateComponent } from './components/user/user-template/user-template.component';
import { LoginComponent } from './components/website/login/login.component';
import { OtpComponent } from './components/website/otp/otp.component';
import { AdminTemplateComponent } from './components/admin/admin-template/admin-template.component';
import { AffiliateGuard } from '../app/guards/affiliate.guard';
import { AffiliateTemplateComponent } from './components/affiliate/affiliate-template/affiliate-template.component';
import { AffiliateEmailConfirmationComponent } from './components/email-pages/affiliate-email-confirmation/affiliate-email-confirmation.component';
import { DispatchEmailConfirmationComponent } from './components/email-pages/dispatch-email-confirmation/dispatch-email-confirmation.component';
import { BookingStatusVerificationComponent } from './components/email-pages/booking-status-verification/booking-status-verification.component';
import { TransactionHistoryComponent } from './components/website/transaction-history/transaction-history.component';
import { AgentTemplateComponent } from './components/travel-agent/agent-template/agent-template.component';
import { CheckProfileCompleteGuard } from './guards/check-profile-complete.guard';
import { CreateBookingComponent } from './components/travel-agent/create-booking/create-booking.component';
import { IndividualConfirmationComponent } from './components/email-pages/individual-confirmation/individual-confirmation.component';
import { ModifyBookingComponent } from './components/email-pages/modify-booking/modify-booking.component';
import { SubTravelAgentTemplateComponent } from './components/sub-travel-agent/sub-travel-agent-template/sub-travel-agent-template.component';
import { IndividualTemplateComponent } from './components/individual/individual-template/individual-template.component';
import { SubAffiliateTemplateComponent } from './components/sub-affiliate/sub-affiliate-template/sub-affiliate-template.component';
import { PartnerRegistrationComponent } from './components/subscription/partner-registration/partner-registration.component';
import { SubscriptionPlansComponent } from './components/subscription/subscription-plans/subscription-plans.component';
import { PaymentDetailsComponent } from './components/subscription/payment-details/payment-details.component';
import { AddDriverSubscriberComponent } from './components/subscription/add-driver-subscriber/add-driver-subscriber.component';
// import { AffiliateDriverTemplateComponent } from './components/affiliate-driver/affiliate-driver-template/affiliate-driver-template.component'
import { TutorialsComponent } from './components/website/tutorials/tutorials.component';
import { LiveRideTrackingComponent } from './components/public/live-ride-tracking/live-ride-tracking.component';
import { CountriesComponent } from './components/website/countries/countries.component';
import { PublicInvoiceSummaryComponent } from './components/public/public-invoice-summary/public-invoice-summary.component';
import { StatesTestComponent } from './components/public/states-test/states-test.component';
import { AppLinkFallbackComponent } from './components/public/app-link-fallback/app-link-fallback.component';


/**
 * Matches a Universal Link / App Link prefix and every path underneath it,
 * e.g. `/passenger`, `/passenger/booking/123`. Angular's `**` wildcard only
 * works as a whole path, so a custom matcher is needed to swallow the rest of
 * the segments while still keeping the route at the top level.
 */
export function appLinkMatcher(prefix: string) {
	return (segments: UrlSegment[]) =>
		segments.length > 0 && segments[0].path === prefix ? { consumed: segments } : null;
}

export const passengerAppLinkMatcher = appLinkMatcher('passenger');
export const driverAppLinkMatcher = appLinkMatcher('driver');

const routes: Routes = [
	{
		path: '',
		redirectTo: '/home',
		pathMatch: 'full'
	},
	{
		path: 'add-driver-details-from-invite',
		component: AddDriverSubscriberComponent,
	},
	{
		path: 'public-invoice-summary',
		component: PublicInvoiceSummaryComponent
	},
	{
		path: 'states-test',
		component: StatesTestComponent
	},
	// Universal Link / App Link web fallback. iOS and Android hand these URLs to
	// the native app when it is installed; this page only renders when it is not.
	{
		matcher: passengerAppLinkMatcher,
		component: AppLinkFallbackComponent,
		data: {
			title: 'Open in the 1800Limo app',
			appTarget: 'passenger'
		}
	},
	{
		matcher: driverAppLinkMatcher,
		component: AppLinkFallbackComponent,
		data: {
			title: 'Open in the 1800Limo Chauffeur app',
			appTarget: 'driver'
		}
	},
	{
		path: '',
		component: WebsiteTemplateComponent,
		data: {
			title: 'Home'
		},
		children: [
			{
				path: 'drive-with-us',
				component: DriverComponent
			},
			{
				path: 'home',
				component: HomeComponent
			},
			{
				path: 'services',
				component: HomeComponent
			},
			{
				path: 'quotebot_section',
				component: HomeComponent,
				canActivate: [CheckProfileCompleteGuard],
			},
			{
				path: 'about-us',
				component: AboutUsComponent
			},
			{
				path: 'fleet',
				component: FleetComponent
			},
			{
				path: 'tutorials',
				component: TutorialsComponent
			},
			{
				path: 'safety',
				component: SafetyComponent
			},
			{
				path: 'customer-faq',
				component: CustomerFaqComponent
			},
			{
				path: 'driver-faq',
				component: DriverFaqComponent
			},
			{
				path: 'countries',
				component: CountriesComponent
			},
			{
				path: 'cancellation-policy',
				component: CancellationPolicyComponent
			},
			{
				path: 'group-travel-planner',
				component: GroupTravelPlannerComponent
			},
			{
				path: 'investors',
				component: InvestorsComponent
			},
			{
				path: 'blog',
				component: BlogComponent
			},
			{
				path: 'blog/:id',
				component: BlogDetailComponent
			},
			{
				path: 'contact-us',
				component: ContactUsComponent
			},
			// {
			// 	path: 'testimonials',
			// 	component: TestimonialsComponent
			// },
			// {
			// 	path: 'suggestions-complaints',
			// 	component: SuggestionsComplaintsComponent
			// },
			{
				path: 'insurance-licensing',
				component: InsuranceLicensingComponent
			},
			{
				path: 'privacy-policy',
				component: PrivacyPolicyComponent
			},
			{
				path: 'delivery-membership-terms-condition',
				component: DeliveryMembershipTCComponent
			},
			{
				path: 'client-terms-condition',
				component: ClientTCComponent
			},
			{
				path: 'transaction-history',
				component: TransactionHistoryComponent
			},
			{
				path: 'subscription',
				component: SubscriptionPlansComponent
			},
			{
				path: 'partner-registration',
				component: PartnerRegistrationComponent
			},
			{
				path: 'payment-details',
				component: PaymentDetailsComponent
			},
			{
				path: 'email',
				children: [
					{
						path: 'affiliate-email-confirmation',
						component: AffiliateEmailConfirmationComponent
					},
					{
						path: 'dispatcher-email-confirmation',
						component: AffiliateEmailConfirmationComponent
					},
					{
						path: 'booking-email-confirmation',
						component: BookingStatusVerificationComponent
					},
					{
						path: 'cancel-requests',
						component: IndividualConfirmationComponent
					},
					{
						path: 'confirm-requests',
						component: ModifyBookingComponent
					}
				]
			}
		]
	},
	{
		path: 'admin-login',
		component: LoginComponent
	},
	{
		path: 'sub-admin-login',
		component: LoginComponent
	},
	{
		path: 'login/:role',
		component: LoginComponent,
	},
	{
		path: 'login',
		component: LoginComponent,
	},
	{
		path: 'otp',
		component: OtpComponent
	},
	{
		path: 'quotebot',
		component: QuotebotTemplateComponent,
		data: {
			title: 'Homeer'
		},
		children: [
			{
				path: '',
				// component:HomeComponent
				loadChildren: () => import('./components/quotebot/quotebot.module').then(m => m.QuotebotModule)
			}
		]
	},
	{
		path: 'email',
		data: {
			title: 'Emails'
		},
		children: [
			{
				path: 'failed-quote-request-confirmation',
				component: FailedQuoteRequestConfirmationComponent
			},
			{
				path: 'client-email-confirmation',
				component: ClientEmailConfirmationComponent
			},
			{
				path: 'driver-email-confirmation',
				component: DriverEmailConfirmationComponent
			},
			{
				path: 'reservation-cancellation',
				component: ReservationCancellationComponent
			}
		]
	},
	// {
	// 	path: 'user',
	// 	component: UserTemplateComponent,
	// 	data: {
	// 		title: 'user'
	// 	},
	// 	children: [
	// 		{
	// 			path: '',
	// 			loadChildren: () => import('./components/user/user.module').then(m => m.UserModule)
	// 		}
	// 	]
	// },
	{
		path: 'admin',
		component: AdminTemplateComponent,
		// canActivate: [AdminGuardGuard],
		data: {
			title: 'admin'
		},
		children: [
			{
				path: '',
				loadChildren: () => import('./components/admin/admin.module').then(m => m.AdminModule)
			}
		]
	},
	{
		path: 'payment-by-email/:accId/:bookingId',
		loadChildren: () => import('./components/payment-by-email/payment-by-email.module').then(m => m.PaymentByEmailModule)
	},
	{
		path: 'affiliate',
		component: AffiliateTemplateComponent,
		canActivate: [AffiliateGuard],
		data: {
			title: 'affiliate'
		},
		children: [
			{
				path: '',
				loadChildren: () => import('./components/affiliate/affiliate.module').then(m => m.AffiliateModule)
			}
		]
	},
	{
		path: 'sub_affiliate',
		component: SubAffiliateTemplateComponent,
		// canActivate: [AdminGuardGuard],
		data: {
			title: 'subaffiliate'
		},
		children: [
			{
				path: '',
				loadChildren: () => import('./components/sub-affiliate/sub-affiliate.module').then(m => m.SubAffiliateModule)
			}
		]
	},
	// {
	// 	path: 'affiliate_driver',
	// 	component: AffiliateDriverTemplateComponent,
	// 	data: {
	// 		title: 'affiliatedriver'
	// 	},
	// 	children: [
	// 		{
	// 			path: '',
	// 			loadChildren: () => import('./components/affiliate-driver/affiliate-driver.module').then(m => m.AffiliateDriverModule)
	// 		}
	// 	]
	// },
	{
		path: 'travel_agent',
		component: AgentTemplateComponent,
		// canActivate: [AdminGuardGuard],
		data: {
			title: 'agent'
		},
		children: [
			{
				path: '',
				loadChildren: () => import('./components/travel-agent/travel-agent.module').then(m => m.TravelAgentModule)
			}
		]
	},
	{
		path: 'sub_travel_agent',
		component: SubTravelAgentTemplateComponent,
		// canActivate: [AdminGuardGuard],
		data: {
			title: 'subagent'
		},
		children: [
			{
				path: '',
				loadChildren: () => import('./components/sub-travel-agent/sub-travel-agent.module').then(m => m.SubTravelAgentModule)
			}
		]
	},
	{
		path: 'individual',
		component: IndividualTemplateComponent,
		// canActivate: [AdminGuardGuard],
		data: {
			title: 'individual'
		},
		children: [
			{
				path: '',
				loadChildren: () => import('./components/individual/individual.module').then(m => m.IndividualModule)
			}
		]
	},
	{
		path: 'live-ride-tracking/:tracking_id',
		component: LiveRideTrackingComponent,
		data: {
			title: 'Live Ride Tracking'
		}
	},
	{
		path: '**',
		component: PageNotFoundComponent
	},

];

@NgModule({
	imports: [
		RouterModule.forRoot(routes, {
			scrollPositionRestoration: 'enabled',
			anchorScrolling: 'enabled',
		})
	],
	exports: [RouterModule]
})
export class AppRoutingModule { }
