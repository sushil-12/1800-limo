import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { AffiliateDriverRoutingModule } from './affiliate-driver-routing.module';
import { AffiliateDriverComponent } from './affiliate-driver.component';
import { AffiliateDriverTemplateComponent } from './affiliate-driver-template/affiliate-driver-template.component';
import { MyBookingsComponent } from './my-bookings/my-bookings.component';
import { NgxSpinnerModule } from 'ngx-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatNativeDateModule } from '@angular/material/core';
import { MatMomentDateModule } from '@angular/material-moment-adapter';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { NgSelectModule } from '@ng-select/ng-select';
import { MatRadioModule } from '@angular/material/radio';
import { SharedModule } from '../shared/shared.module';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { GoogleMapsModule } from '@angular/google-maps';
import { AffiliateModule } from '../affiliate/affiliate.module';
import { BookingPreviewModule } from '../affiliate/booking-preview/booking-preview.module';
import { AffiliateBookingHostModule } from '../affiliate/create-new-booking-v2/affiliate-booking-host.module';


@NgModule({
  declarations: [AffiliateDriverComponent, AffiliateDriverTemplateComponent, MyBookingsComponent],
  imports: [
    CommonModule,
    AffiliateDriverRoutingModule,
    NgxSpinnerModule,
		MatProgressBarModule,
		FormsModule,
		ReactiveFormsModule,
		MatSlideToggleModule,
		GoogleMapsModule,
		MatNativeDateModule,
		MatMomentDateModule,
		MatInputModule,
		MatSelectModule,
		NgSelectModule,
		MatRadioModule,
		SharedModule,
		MatDialogModule,
		MatFormFieldModule,
		MatTabsModule,
		MatTableModule,
		MatExpansionModule,
		MatIconModule,
		// reuse the affiliate edit (shared booking) and finalize screens, same as sub_affiliate
		AffiliateModule,
		AffiliateBookingHostModule,
		BookingPreviewModule
  ]
})
export class AffiliateDriverModule { }
