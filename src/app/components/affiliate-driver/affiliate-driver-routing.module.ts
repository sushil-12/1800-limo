import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
// import { AffiliateDriverGuard } from '../../guards/affiliate-driver.guard'
import { MyBookingsComponent } from '../affiliate-driver/my-bookings/my-bookings.component'
import { AffiliateBookingHostComponent } from '../affiliate/create-new-booking-v2/affiliate-booking-host.component';
import { AffiliateFinalizeComponent } from '../affiliate/affiliate-finalize/affiliate-finalize.component';
import { InvoiceSummaryComponent } from '../affiliate/invoice-summary/invoice-summary.component';

const routes: Routes = [
	{
		path: '',
		redirectTo: '/home',
		pathMatch: 'full'
	},
	{
		path: 'my-bookings',
		// canActivate: [AffiliateDriverGuard],
		component: MyBookingsComponent
	},
	{
		// Edit/Rate — shared booking form in affiliate mode
		path: 'create-new-booking-v2',
		component: AffiliateBookingHostComponent
	},
	{
		path: 'finalize-booking',
		component: AffiliateFinalizeComponent
	},
	{
		// finalize redirects here after a successful payment
		path: 'invoice-summary',
		component: InvoiceSummaryComponent
	},
];

@NgModule({
	imports: [RouterModule.forChild(routes)],
	exports: [RouterModule]
})
export class AffiliateDriverRoutingModule { }
