import { Component, ElementRef, EventEmitter, OnInit, Output, ViewChild } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
// @ts-ignore - html2pdf.js ships no type definitions
import html2pdf from 'html2pdf.js';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { NgxSpinnerService } from 'ngx-spinner';
import { AdminService } from '../../../services/admin.service';
import { AffiliateService } from '../../../services/affiliate.service';
import { StateManagementService } from 'src/app/services/statemanagement.service';
import { GoogleMap } from '@angular/google-maps';
import { IndividualService } from 'src/app/services/individual.service';
import { TravelAgentService } from 'src/app/services/travel-agent.service';
import moment from 'moment';
import { Router } from '@angular/router';

declare var $: any;

@Component({
  selector: 'app-booking-trip-preview',
  templateUrl: './booking-trip-preview.component.html',
  styleUrls: ['./booking-trip-preview.component.scss']
})
export class BookingTripPreviewComponent implements OnInit {
  @ViewChild(GoogleMap, { static: false }) map!: GoogleMap;
  @ViewChild('specialInstructionBox') specialInstructionBox!: ElementRef;
  @ViewChild('receiptContent') receiptContent!: ElementRef;

  isScrollable = false;

  mapOptions: google.maps.MapOptions = {
    disableDefaultUI: true,
    draggable: false,
    zoomControl: false,
    scrollwheel: false,
    disableDoubleClickZoom: true,
    streetViewControl: false,
    fullscreenControl: false,
    keyboardShortcuts: false,
    gestureHandling: 'none',
  };

  zoom = 7;
  mapCenter: google.maps.LatLngLiteral = { lat: 41.850033, lng: -87.6500523 };
  directionsRenderer!: google.maps.DirectionsRenderer;

  bookingPreview: any;
  adminSharePercent: number;
  rates_preview: any;
  shareArray: any;
  currencySymbol: any;
  isAffiliate: boolean = false;
  isLooseAffiliate: boolean = false;
  showRateDistribution: boolean = false;
  deducted_stripe_fee: number;
  userRole: string;
  isAdminView: boolean = false;
  /**
   * How the receipt was opened.
   * 'view'   — from a bookings list: full header with Edit/Copy/Download.
   * 'edit'   — from the booking form while editing: booking id only, no actions.
   * 'create' — from the booking form before saving: no header at all.
   */
  previewMode: 'view' | 'edit' | 'create' = 'view';

  /**
   * One complete receipt per leg — [outbound] for a one-way, [outbound, return] for a
   * round trip. `bookingPreview` always points at the leg whose tab is open, so every
   * section below (route, driver, affiliate, rates, total) belongs to that leg alone.
   */
  legs: Array<{ label: string; caption: string; data: any }> = [];
  activeLegIndex: number = 0;

  get isRoundTrip(): boolean {
    return this.legs.length > 1;
  }

  @Output() editBooking = new EventEmitter<any>();
  @Output() shareBooking = new EventEmitter<any>();
  @Output() saveBooking = new EventEmitter<void>();

  shareEditorContent: string = '';
  shareSmsContent: string = '';
  shareActiveTab: 'email' | 'sms' = 'email';

  quillModules = {
    toolbar: [
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }],
      [{ 'color': [] }, { 'background': [] }],
      ['link'],
      ['clean'],
    ],
  };
  markers: any;

  constructor(
    private $affiliateService: AffiliateService,
    private $adminService: AdminService,
    private $spinner: NgxSpinnerService,
    private stateManagementService: StateManagementService,
    private $individualService: IndividualService,
    private $travelAgentService: TravelAgentService,
    private toastr: ToastrService,
    private router: Router
  ) { }

  // ── Header actions ─────────────
  onEdit(): void {
    const bookingId = this.bookingPreview?.reservation_id || this.bookingPreview?.id;
    const updateType = 'edit';

    try {
      $('#previewBookingTrips').modal('hide');
    } catch (e) { }

    if (this.userRole === 'admin') {
      this.router.navigate(['/admin/new-booking-v2'], { queryParams: { bookingId: bookingId, updateType: updateType, nav: 'true' } });
    }
    else if (this.userRole === 'affiliate') {
      const currentUserStr = localStorage.getItem('currentUser');
      const currentUser = currentUserStr ? JSON.parse(currentUserStr) : {};

      if (currentUser?.roleName === 'sub_affiliate') {
        this.router.navigate(['/sub_affiliate/create-new-booking-v2'], { queryParams: { bookingId: bookingId, updateType: updateType, nav: 'true' } });
      } else {
        this.router.navigate(['/affiliate/create-new-booking-v2'], { queryParams: { bookingId: bookingId, updateType: updateType, nav: 'true' } });
      }
    }
    else if (this.userRole === 'travel_agent') {
      const currentUserStr = localStorage.getItem('currentUser');
      const currentUser = currentUserStr ? JSON.parse(currentUserStr) : {};

      this.router.navigate([`/${currentUser?.roleName}/create-new-booking-v2`], { queryParams: { bookingId: bookingId, updateType: updateType, nav: 'true' } });
    }
    else if (this.userRole === 'individual') {
      const currentUserStr = localStorage.getItem('currentUser');
      const currentUser = currentUserStr ? JSON.parse(currentUserStr) : {};

      this.router.navigate([`/${currentUser?.roleName}/create-new-booking-v2`], { queryParams: { bookingId: bookingId, updateType: updateType, nav: 'true' } });
    }
    else {
      this.editBooking.emit(this.bookingPreview);
    }
  }

  /**
   * Footer Save, only rendered for the booking form's own previews. The host form owns
   * the submit; here we just close the receipt and hand control back to it.
   */
  onSave(): void {
    try {
      $('#previewBookingTrips').modal('hide');
    } catch (e) { }
    this.saveBooking.emit();
  }

  onShare(): void {
    this.shareEditorContent = this.buildShareMessage();
    this.shareSmsContent = this.buildSmsMessage();
    this.shareActiveTab = 'email';
    this.shareBooking.emit(this.bookingPreview);
    try {
      $('#shareBookingTripsModal').modal('show');
    } catch (err) {
      console.error('[BookingTripPreview] onShare: failed to open share modal', err);
    }
  }

  copyShareHtml(): void {
    const html = this.shareEditorContent || '';
    // Plain-text version: strip tags, turn block ends into newlines.
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const plain = (tmp.innerText || tmp.textContent || '').trim();

    const closeModals = () => {
      try { $('#shareBookingTripsModal').modal('hide'); } catch (e) {}
      try { $('#previewBookingTrips').modal('hide'); } catch (e) {}
    };
    const done = () => { this.toastr.success('Copied to clipboard'); closeModals(); };
    const fail = () => this.toastr.error('Could not copy');

    const w = window as any;
    if (navigator?.clipboard && w.ClipboardItem) {
      // Rich copy: pasting into email/docs keeps the exact HTML formatting.
      const item = new w.ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([plain], { type: 'text/plain' }),
      });
      navigator.clipboard.write([item]).then(done).catch(() => {
        navigator.clipboard.writeText(html).then(done).catch(fail);
      });
    } else if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(html).then(done).catch(fail);
    } else {
      try {
        const ta = document.createElement('textarea');
        ta.value = html;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        done();
      } catch {
        fail();
      }
    }
  }
  private buildShareMessage(): string {
    const b = this.bookingPreview || {};

    const pickupAddress =
      b.pickup_address || b.pickup || b.pickup_airport_name || '';
    const dropoffAddress =
      b.dropoff_address || b.dropoff || b.dropoff_airport_name || '';

    const dateStr = b.pickup_date
      ? `${moment(b.pickup_date).format('MM/DD/YYYY')} | ${moment(b.pickup_date).format('MMM D, YYYY')}`
      : '';
    const timeM = b.pickup_time ? moment(b.pickup_time, [
      'hh:mm A', 'hh:mm a', 'h:mm A', 'h:mm a',
      'hh:mm:ss A', 'hh:mm:ss a', 'h:mm:ss A', 'h:mm:ss a',
      'HH:mm:ss', 'HH:mm', 'H:mm:ss', 'H:mm'
    ]) : null;
    const timeStr = timeM && timeM.isValid()
      ? `${timeM.format('h:mm a')} | ${timeM.format('HHmm')} h`
      : '';

    console.debug("BOKING", b)
    const bookingType = [
      this.textFormatter(b.service_type),
      this.textFormatter(b.transfer_type),
    ].filter(Boolean).join('/');

    const bookingHours = b.number_of_hours || null;

    const esc = (s: string) =>
      s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const bold = (s: string) => `<strong>${esc(s)}</strong>`;

    const lines: (string | null)[] = [
      'Hi, I need an all-inclusive rate, with tip, tax, and any tolls, for this booking.',
      '',
      bookingType ? `${bold('Booking Type:')} ${bookingType}` : null,
      b.service_type == "Charter Tour" && bookingHours ? `${bold('Booking Hours:')} ${bookingHours} hours` : null,
      b.cancellation_hours
        ? `${bold('Cancellation Period:')} ${this.getCancellationTime(b.cancellation_hours)}`
        : null,
      '',
      b.vehicle_type_name || null,
      b.total_passengers != null ? `${b.total_passengers} pax` : null,
      b.luggage_count != null ? `${b.luggage_count} luggage` : null,
      '',
      bold('Travel Information'),
      '',
      bold('Pickup Details:'),
      dateStr ? `Date: ${dateStr}` : null,
      timeStr ? `Time: ${timeStr}` : null,
      pickupAddress ? `Address: ${pickupAddress}` : null,
      '',
      bold('Drop Off Details:'),
      dropoffAddress ? `Address: ${dropoffAddress}` : null,
      '',
      b.distance != null
        ? `Total Distance: ${this.mToMi(b.distance)} Miles / ${this.mToKm(b.distance)} Km`
        : null,
      b.duration != null
        ? `Estimated Time: ${this.convertToMinutes(b.duration)}`
        : null,
    ];

    return lines
      .filter((l) => l !== null)
      .map((l) => (l ? `<p>${l.startsWith('<') ? l : esc(l as string)}</p>` : '<p><br></p>'))
      .join('');
  }

  private buildSmsMessage(): string {
    const b = this.bookingPreview || {};

    const pickupAddress = b.pickup_address || b.pickup || b.pickup_airport_name || '';
    const dropoffAddress = b.dropoff_address || b.dropoff || b.dropoff_airport_name || '';

    const dateStr = b.pickup_date
      ? `${moment(b.pickup_date).format('MM/DD/YYYY')} | ${moment(b.pickup_date).format('MMM D, YYYY')}`
      : '';
    const timeM = b.pickup_time ? moment(b.pickup_time, [
      'hh:mm A', 'hh:mm a', 'h:mm A', 'h:mm a',
      'hh:mm:ss A', 'hh:mm:ss a', 'h:mm:ss A', 'h:mm:ss a',
      'HH:mm:ss', 'HH:mm', 'H:mm:ss', 'H:mm'
    ]) : null;
    const timeStr = timeM && timeM.isValid()
      ? `${timeM.format('h:mm a')} | ${timeM.format('HHmm')} h`
      : '';

    const bookingType = [
      this.textFormatter(b.service_type),
      this.textFormatter(b.transfer_type),
    ].filter(Boolean).join('/');

    const bookingHours = b.number_of_hours || null;

    const lines: (string | null)[] = [
      'Hi, I need an all-inclusive rate, with tip, tax, and any tolls, for this booking.',
      '',
      bookingType ? `Booking Type: ${bookingType}` : null,
      b.service_type == 'Charter Tour' && bookingHours ? `Booking Hours: ${bookingHours} hours` : null,
      b.cancellation_hours ? `Cancellation Period: ${this.getCancellationTime(b.cancellation_hours)}` : null,
      '',
      b.vehicle_type_name || null,
      b.total_passengers != null ? `${b.total_passengers} pax` : null,
      b.luggage_count != null ? `${b.luggage_count} luggage` : null,
      '',
      'Travel Information',
      '',
      'Pickup Details:',
      dateStr ? `Date: ${dateStr}` : null,
      timeStr ? `Time: ${timeStr}` : null,
      pickupAddress ? `Address: ${pickupAddress}` : null,
      '',
      'Drop Off Details:',
      dropoffAddress ? `Address: ${dropoffAddress}` : null,
      '',
      b.distance != null
        ? `Total Distance: ${this.mToMi(b.distance)} Miles / ${this.mToKm(b.distance)} Km`
        : null,
      b.duration != null
        ? `Estimated Time: ${this.convertToMinutes(b.duration)}`
        : null,
    ];

    return lines
      .filter((l) => l !== null)
      .join('\n');
  }

  copySmsText(): void {
    const text = this.shareSmsContent || '';
    const closeModals = () => {
      try { $('#shareBookingTripsModal').modal('hide'); } catch (e) {}
      try { $('#previewBookingTrips').modal('hide'); } catch (e) {}
    };
    const done = () => { this.toastr.success('Copied to clipboard'); closeModals(); };
    const fail = () => this.toastr.error('Could not copy');

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(fail);
    } else {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        done();
      } catch {
        fail();
      }
    }
  }

  isGeneratingPdf = false;

  printReceipt(): void {
    const node = this.receiptContent?.nativeElement as HTMLElement;
    if (!node || this.isGeneratingPdf) return;

    // ✅ Set flag first — Angular renders the spinner on this tick
    this.isGeneratingPdf = true;

    // Defer the heavy work to the next tick so the button re-renders first
    setTimeout(() => {
      const clone = node.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('google-map, .rcpt-map, .rcpt-actions, .rcpt-close, .rcpt-trips, .rcpt-form-footer')
        .forEach((el) => el.remove());

      const fileName = `Booking-${this.bookingPreview?.reservation_id || 'receipt'}.pdf`;

      const opt = {
        margin: [8, 8, 8, 8],
        filename: fileName,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          windowWidth: node.scrollWidth,
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
      };

      html2pdf()
        .set(opt)
        .from(clone)
        .save()
        .then(() => {
          this.isGeneratingPdf = false;
          this.toastr.success('Receipt downloaded');
        })
        .catch((err: any) => {
          this.isGeneratingPdf = false;
          console.error('[BookingTripPreview] printReceipt: PDF generation failed', err);
          this.toastr.error('Could not generate PDF');
        });
    }, 0);
  }

  copyDetails(): void {
    const b = this.bookingPreview || {};
    const lines = [
      `Booking #${b.reservation_id ?? ''}`,
      b.pickup_date ? `Date: ${this.formatDate(b.pickup_date)}` : '',
      b.pickup_time ? `Pickup Time: ${this.formatTime(b.pickup_time)}` : '',
      b.passenger_name ? `Passenger: ${b.passenger_name}` : '',
      b.passenger_email ? `Email: ${b.passenger_email}` : '',
      b.passenger_cell ? `Phone: (${b.passenger_cell_isd ?? ''}) ${b.passenger_cell}` : '',
      b.pickup ? `Pickup: ${b.pickup}` : '',
      b.dropoff ? `Drop Off: ${b.dropoff}` : '',
      b.vehicle_type_name ? `Vehicle: ${b.vehicle_type_name}` : '',
      b.grand_total ? `Total: ${this.currencySymbol ?? ''}${b.grand_total}` : '',
    ].filter(Boolean);
    const text = lines.join('\n');

    const done = () => this.toastr.success('Booking details copied');
    const fail = () => this.toastr.error('Could not copy details');

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(fail);
    } else {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        done();
      } catch {
        fail();
      }
    }
  }

  ngOnInit(): void {
    try {
      this.currencySymbol = this.stateManagementService.getCurrencySymbol();
      console.debug('[BookingTripPreview] ngOnInit: currencySymbol =', this.currencySymbol);
    } catch (err) {
      console.error('[BookingTripPreview] ngOnInit: Failed to get currency symbol', err);
    }
  }

  ngAfterViewInit(): void {
    this.checkScrollable();
  }

  ngAfterViewChecked(): void {
    this.checkScrollable();
  }

  checkScrollable(): void {
    const el = this.specialInstructionBox?.nativeElement;
    if (el) {
      const scrollable = el.scrollHeight > el.clientHeight;
      if (scrollable !== this.isScrollable) {
        this.isScrollable = scrollable;
      }
    }
  }

  scrollInstruction(direction: 'up' | 'down'): void {
    const el = this.specialInstructionBox.nativeElement;
    el.scrollBy({ top: direction === 'down' ? 60 : -60, behavior: 'smooth' });
  }

  openPreview(booking_id: number, userRole: 'admin' | 'affiliate' | 'individual' | 'travel_agent' = 'affiliate') {
    console.debug(`[BookingTripPreview] openPreview called — booking_id=${booking_id}, userRole=${userRole}`);
    this.$spinner.show();
    this.userRole = userRole;
    this.isAdminView = userRole === 'admin';
    this.previewMode = 'view';


    const request = userRole === 'admin'
      ? this.$adminService.getBookingPreview(booking_id)
      : userRole === 'individual'
        ? this.$individualService.getBookingPreview(booking_id)
        : userRole === 'travel_agent'
          ? this.$travelAgentService.getBookingPreview(booking_id)
          : this.$affiliateService.getBookingPreview(booking_id);

    request
      .pipe(
        catchError((err) => {
          console.error('[BookingTripPreview] openPreview: API request failed', err);
          this.$spinner.hide();
          return throwError(err);
        })
      ).subscribe((response: any) => {
        try {
          console.debug('[BookingTripPreview] openPreview: API response received', response);

          if (!response?.data) {
            console.warn('[BookingTripPreview] openPreview: response.data is null or undefined', response);
          }

          this.setLegs(this.buildLegs(response.data));
          console.debug('[BookingTripPreview] openPreview: legs =', this.legs);

          $('#previewBookingTrips').modal('show');
          this.$spinner.hide();
          this.redrawMap();

        } catch (err) {
          console.error('[BookingTripPreview] openPreview: Unexpected error inside subscribe', err);
          this.$spinner.hide();
        }
      });
  }

  /**
   * Render the receipt from an in-memory booking object instead of fetching one.
   * The booking form uses this for its Preview button, where the booking may not
   * exist server-side yet. `mode` drives the header: 'create' hides it entirely,
   * 'edit' keeps the booking id but drops the Edit/Copy/Download actions.
   * A round-trip payload is split into two tabs, same as a saved booking.
   */
  openLocalPreview(
    data: any,
    userRole: 'admin' | 'affiliate' | 'individual' | 'travel_agent' = 'affiliate',
    mode: 'create' | 'edit' = 'create'
  ): void {
	    console.log("DEBUG - BOOKING PREVIEW", data)

    console.debug('[BookingTripPreview] openLocalPreview called — userRole=%s, mode=%s', userRole, mode, data);

    this.userRole = userRole;
    this.isAdminView = userRole === 'admin';
    this.previewMode = mode;

    this.setLegs(this.buildLegs(data || {}));

    $('#previewBookingTrips').modal('show');
    this.redrawMap();
  }

  /** Swap the whole receipt over to the leg behind a tab. */
  selectLeg(index: number): void {
    if (index < 0 || index >= this.legs.length || index === this.activeLegIndex) {
      return;
    }
    this.activeLegIndex = index;
    this.bookingPreview = this.legs[index]?.data || {};
    this.applyActiveLeg();
    this.redrawMap();

    try {
      document.querySelector('#previewBookingTrips .modal-body')?.scrollTo({ top: 0 });
    } catch (e) {
      console.error('[BookingTripPreview] selectLeg: could not reset scroll', e);
    }
  }

  /** Point the receipt at the first leg and reset the tab bar. */
  private setLegs(legs: Array<{ label: string; caption: string; data: any }>): void {
    this.legs = (legs || []).filter(leg => !!leg?.data);
    this.activeLegIndex = 0;
    this.bookingPreview = this.legs[0]?.data || {};
    this.applyActiveLeg();
  }

  /** Split a booking into one receipt per leg; the return tab only exists on round trips. */
  private buildLegs(src: any): Array<{ label: string; caption: string; data: any }> {
    const outbound = src || {};
    const legs = [{
      label: 'Trip 1',
      caption: this.legCaption('Outbound', outbound?.pickup_date, outbound?.transfer_type),
      data: outbound
    }];

    try {
      if (outbound?.service_type == 'round_trip') {
        const returnLeg = this.buildReturnLegPayload(outbound);
        if (returnLeg) {
          legs.push({
            label: 'Trip 2',
            caption: this.legCaption('Return', returnLeg?.pickup_date, returnLeg?.transfer_type),
            data: returnLeg
          });
        }
      }
    } catch (e) {
      console.error('[BookingTripPreview] buildLegs: failed to build the return leg', e);
    }

    return legs;
  }

  private legCaption(direction: string, date: any, transferType: any): string {
    const parts: string[] = [direction];
    if (date) {
      parts.push(this.formatDate(date));
    } else if (transferType) {
      parts.push(this.textFormatter(transferType));
    }
    return parts.join(' · ');
  }

  /**
   * Everything the template derives from the leg on screen. Runs on open and on every
   * tab switch, so the rates card, affiliate block and stripe fee follow the active leg.
   */
  private applyActiveLeg(): void {
    const b = this.bookingPreview || {};

    // Inside the booking form the affiliate is still pricing the trip, so the card
    // always shows; on saved bookings it is hidden once the booking is settled.
    // TA-involved bookings show it too — the template keeps the TA/admin rows
    // away from affiliates, so they only see payout, base rate and client total.
    const isSettled = ['paid', 'paid_cash', 'transfer_failed'].includes(b?.payment_status);
    this.showRateDistribution =
      this.userRole === 'admin' ||
      (this.userRole === 'affiliate' &&
        (this.previewMode !== 'view' || !isSettled));

    try {
      const grandTotal = b?.share_array?.grandTotal
        ? b?.share_array?.grandTotal
        : b?.share_array?.returnGrandTotal;
      this.deducted_stripe_fee = (grandTotal * 0.029) + 0.30;
    } catch (e) {
      console.error('[BookingTripPreview] applyActiveLeg: Failed to calc deducted_stripe_fee', e);
    }

    try {
      const hasTravelAgentShare =
        (b?.share_array?.travelAgentShare && b?.share_array?.travelAgentShare != '0' && b?.share_array?.travelAgentShare != 0) ||
        (b?.return_share_array?.travelAgentShare && b?.return_share_array?.travelAgentShare != '0' && b?.return_share_array?.travelAgentShare != 0) ||
        (b?.r_share_array?.travelAgentShare && b?.r_share_array?.travelAgentShare != '0' && b?.r_share_array?.travelAgentShare != 0);

      const isTravelAgentInvolved =
        hasTravelAgentShare ||
        this.userRole === 'travel_agent' ||
        b?.account_type === 'travel_planner' ||
        b?.account_type === 'travel_agent' ||
        b?.created_by_role === 'travel_agent' ||
        b?.created_by_role === 'travel_planner' ||
        !!b?.travel_agent_id;

      const isFarmoutShare = b?.share_array?.farmoutShare && b?.share_array?.farmoutShare != '0' && b?.share_array?.farmoutShare != 0;
      const isFarmoutType = b?.reservation_type === 'farmout';

      if (isTravelAgentInvolved || isFarmoutShare || isFarmoutType) {
        this.adminSharePercent = 15;
      } else {
        this.adminSharePercent = 25;
      }
    } catch (shareErr) {
      console.error('[BookingTripPreview] applyActiveLeg: Failed to calculate adminSharePercent', shareErr);
    }

    console.log("b?.share_array", b?.share_array)
    if (b?.payment_status == 'unpaid' || this.previewMode !== 'view') {
      this.shareArray = b?.share_array;
      this.rates_preview = b?.rates_preview;
    }

    this.isAffiliate = b?.affiliate_type == 'affiliate';
    this.isLooseAffiliate = b?.affiliate_type == 'loose_affiliate';

    if (b?.booking_instructions) {
      try {
        b.booking_instructions = String(b.booking_instructions).split('<br />').join('');
      } catch (instrErr) {
        console.error('[BookingTripPreview] applyActiveLeg: Failed to process booking_instructions', instrErr);
      }
    }
  }

  /** The map canvas only exists once the modal body renders, so draw after it opens. */
  private redrawMap(delay: number = 300): void {
    setTimeout(() => {
      try {
        this.MapController();
      } catch (mapErr) {
        console.error('[BookingTripPreview] redrawMap: MapController() threw an error', mapErr);
      }
    }, delay);
  }

  /**
   * Build the return leg as a complete receipt: the booking-level fields both legs share
   * plus every `return_*` field flattened onto the outbound names the template binds to.
   * The form payload and the API response spell these differently (`return_pickup` vs
   * `return_pickup_address`, stops as an array vs a JSON string), so fallbacks live here.
   */
  private buildReturnLegPayload(src: any): any {
    if (!src || src.service_type != 'round_trip') {
      return null;
    }

    return {
      // ── shared with the outbound leg ──
      reservation_id: src.reservation_id,
      booking_status: src.return_driver_name
        ? (src.return_booking_status || src.booking_status)
        : 'driver_unassigned',
      payment_status: src.payment_status,
      reservation_type: src.reservation_type,
      account_type: src.account_type,
      created_by: src.created_by,
      service_type: src.service_type,
      total_passengers: src.total_passengers,
      luggage_count: src.luggage_count,
      number_of_hours: src.number_of_hours,
      currency_symbol: src.currency_symbol,
      passenger_name: src.passenger_name,
      passenger_email: src.passenger_email,
      passenger_cell: src.passenger_cell,
      passenger_cell_isd: src.passenger_cell_isd,

      // ── trip ──
      transfer_type: String(src.return_transfer_type || ''),
      cancellation_hours: src.return_cancellation_hours ?? src.cancellation_hours,
      pickup_date: src.return_pickup_date,
      pickup_time: src.return_pickup_time,

      // ── pickup ──
      pickup: src.return_pickup || src.return_pickup_address || '',
      pickup_latitude: src.return_pickup_latitude ?? src.return_pickup_lat ?? src.return_pickup_address_lat ?? src.pickup_latitude,
      pickup_longitude: src.return_pickup_longitude ?? src.return_pickup_long ?? src.return_pickup_address_long ?? src.pickup_longitude,
      pickup_address: src.return_fbo_address || '',
      pickup_airport_name: src.return_pickup_airport_name || '',
      pickup_airport_latitude: src.return_pickup_airport_latitude ?? src.return_pickup_latitude_airport ?? src.return_pickup_airport_lat,
      pickup_airport_longitude: src.return_pickup_airport_longitude ?? src.return_pickup_longitude_airport ?? src.return_pickup_airport_long,
      pickup_airline_name: src.return_pickup_airline_name || '',
      pickup_flight: src.return_pickup_flight || '',
      cruise_port: src.return_cruise_port || '',
      cruise_name: src.return_cruise_name || '',
      cruise_time: src.return_cruise_time || '',

      extra_stops: this.normaliseReturnStops(src),

      // ── dropoff ──
      dropoff: src.return_dropoff || src.return_dropoff_address || '',
      dropoff_latitude: src.return_dropoff_latitude ?? src.return_dropoff_lat ?? src.return_dropoff_address_lat ?? src.dropoff_latitude,
      dropoff_longitude: src.return_dropoff_longitude ?? src.return_dropoff_long ?? src.return_dropoff_address_long ?? src.dropoff_longitude,
      dropoff_address: src.return_dropoff_fbo_address || '',
      dropoff_airport_name: src.return_dropoff_airport_name || '',
      dropoff_airport_latitude: src.return_dropoff_airport_latitude ?? src.return_dropoff_latitude_airport ?? src.return_dropoff_airport_lat,
      dropoff_airport_longitude: src.return_dropoff_airport_longitude ?? src.return_dropoff_longitude_airport ?? src.return_dropoff_airport_long,
      dropoff_airline_name: src.return_dropoff_airline_name || '',
      dropoff_flight: src.return_dropoff_flight || '',

      distance: src.return_distance ?? src.returnJourneyDistance,
      duration: src.return_duration ?? src.returnJourneyTime,

      // ── instructions ──
      booking_instructions: src.return_booking_instructions || '',
      meet_greet_choice_name: src.return_meet_greet_choice_name || src.return_meet_greet_choices_name || '',

      // ── vehicle ──
      vehicle_type_name: src.return_vehicle_type_name || '',
      vehicle_make: src.return_vehicle_make || src.return_vehicle_make_name || '',
      vehicle_model: src.return_vehicle_model || src.return_vehicle_model_name || '',
      vehicle_year: src.return_vehicle_year || src.return_vehicle_year_name || '',
      vehicle_color: src.return_vehicle_color || src.return_vehicle_color_name || '',

      // ── driver ──
      driver_name: src.return_driver_name || '',
      driver_email: src.return_driver_email || '',
      driver_cell: src.return_driver_cell || '',
      driver_cell_isd: src.return_driver_cell_isd || '',

      // ── affiliate ──
      affiliate_type: src.return_affiliate_type,
      affiliate_name: src.return_affiliate_name,
      affiliate_email: src.return_affiliate_email,
      affiliate_phone: src.return_affiliate_phone,
      affiliate_phone_isd: src.return_affiliate_phone_isd,
      lose_affiliate_name: src.return_lose_affiliate_name,
      lose_affiliate_email: src.return_lose_affiliate_email,
      lose_affiliate_phone: src.return_lose_affiliate_phone,
      lose_affiliate_phone_isd: src.return_lose_affiliate_phone_isd,

      // ── money ──
      share_array: src.return_share_array || src.r_share_array || null,
      rates_preview: src.return_rates_preview || src.rates_preview,
      grand_total: src.return_grand_total ?? null
    };
  }

  /**
   * Return stops arrive as an array (form), a JSON string (edit/preview API) or the
   * flat `return_stop_1` / `return_stop_2` pairs the finalize endpoint uses.
   */
  private normaliseReturnStops(src: any): any[] {
    let raw = src?.return_extra_stops;

    if (typeof raw === 'string') {
      try {
        raw = JSON.parse(raw);
      } catch (e) {
        console.error('[BookingTripPreview] normaliseReturnStops: could not parse return_extra_stops', e);
        raw = null;
      }
    }

    if (Array.isArray(raw) && raw.length) {
      return raw
        .filter((stop: any) => !!stop?.address)
        .map((stop: any) => ({
          address: stop?.address,
          latitude: stop?.latitude,
          longitude: stop?.longitude
        }));
    }

    const flatStops: any[] = [];
    for (let i = 1; i <= 5; i++) {
      const address = src?.[`return_stop_${i}`];
      if (address) {
        flatStops.push({
          address: address,
          latitude: src?.[`return_stop_${i}_latitude`],
          longitude: src?.[`return_stop_${i}_longitude`]
        });
      }
    }
    return flatStops;
  }

  private parseLatLng(lat: any, lng: any): google.maps.LatLng | null {
    const parsedLat = Number(lat);
    const parsedLng = Number(lng);
    if (lat !== null && lat !== undefined && lat !== '' &&
        lng !== null && lng !== undefined && lng !== '' &&
        Number.isFinite(parsedLat) && Number.isFinite(parsedLng) &&
        (parsedLat !== 0 || parsedLng !== 0)) {
      return new google.maps.LatLng(parsedLat, parsedLng);
    }
    return null;
  }

  MapController() {
    console.log('[BookingTripPreview] MapController initialised:', this.bookingPreview);
    if (!this.bookingPreview) return;

    const transferType = String(this.bookingPreview.transfer_type || '');
    let origin: google.maps.LatLng | null = null;
    let destination: google.maps.LatLng | null = null;
    const waypoints: google.maps.DirectionsWaypoint[] = [];

    // Resolve Origin (Airport override if transfer_type contains 'airport_')
    if (transferType.includes('airport_')) {
      origin = this.parseLatLng(
        this.bookingPreview.pickup_airport_latitude ?? this.bookingPreview.pickup_latitude_airport,
        this.bookingPreview.pickup_airport_longitude ?? this.bookingPreview.pickup_longitude_airport
      );
    }
    if (!origin) {
      origin = this.parseLatLng(
        this.bookingPreview.pickup_latitude,
        this.bookingPreview.pickup_longitude
      );
    }

    // Resolve Destination (Airport override if transfer_type contains '_airport')
    if (transferType.includes('_airport')) {
      destination = this.parseLatLng(
        this.bookingPreview.dropoff_airport_latitude ?? this.bookingPreview.dropoff_latitude_airport,
        this.bookingPreview.dropoff_airport_longitude ?? this.bookingPreview.dropoff_longitude_airport
      );
    }
    if (!destination) {
      destination = this.parseLatLng(
        this.bookingPreview.dropoff_latitude,
        this.bookingPreview.dropoff_longitude
      );
    }

    if (!origin || !destination) {
      console.warn('[BookingTripPreview] MapController: Invalid origin or destination coordinates', { origin, destination, bookingPreview: this.bookingPreview });
      return;
    }

    // Center map around origin
    this.mapCenter = { lat: origin.lat(), lng: origin.lng() };

    // Handle Extra Stops
    if (this.bookingPreview?.extra_stops?.length > 0) {
      for (let i = 0; i < this.bookingPreview.extra_stops.length; i++) {
        const stop = this.bookingPreview.extra_stops[i];
        const stopLatLng = this.parseLatLng(stop.latitude ?? stop.lat, stop.longitude ?? stop.lng);
        if (stopLatLng) {
          waypoints.push({
            location: stopLatLng,
            stopover: true
          });
        }
      }
    }

    // Clear previous markers
    if (this.markers) {
      this.markers.forEach((m: any) => m.setMap(null));
    }
    this.markers = [];

    // Clear previous renderer
    if (this.directionsRenderer) {
      this.directionsRenderer.setMap(null);
    }

    setTimeout(() => {
      this.drawMap({
        origin,
        destination,
        waypoints,
        optimizeWaypoints: false,
        travelMode: google.maps.TravelMode.DRIVING
      });
    }, 100);
  }

  // MapController() {
  //   console.debug('[BookingTripPreview] MapController: start — bookingPreview =', this.bookingPreview);

  //   const transferType = this.bookingPreview?.transfer_type || '';
  //   console.debug('[BookingTripPreview] MapController: transferType =', transferType);

  //   let originCoords: google.maps.LatLng | null;
  //   let destinationCoords: google.maps.LatLng | null;
  //   const waypoints: google.maps.DirectionsWaypoint[] = [];

  //   try {
  //     if (this.bookingPreview?.extra_stops && this.bookingPreview.extra_stops.length > 0) {
  //       console.log(this.bookingPreview, "extra_stops>>>>>>>>>")
  //       for (const stop of this.bookingPreview.extra_stops) {
  //         const lat = Number(stop.latitude || stop.lat);
  //         const lng = Number(stop.longitude || stop.lng);
  //         if (lat && lng && !isNaN(lat) && !isNaN(lng) && (lat !== 0 || lng !== 0)) {
  //           waypoints.push({
  //             location: new google.maps.LatLng(lat, lng),
  //             stopover: true
  //           });
  //         } else if (stop.address) {
  //           waypoints.push({
  //             location: stop.address,
  //             stopover: true
  //           });
  //         }
  //       }
  //     }
  //     console.debug('[BookingTripPreview] MapController: waypoints =', waypoints);
  //   } catch (err) {
  //     console.error('[BookingTripPreview] MapController: Failed to map extra_stops', err);
  //   }

  //   try {
  //     originCoords = this.resolveLatLng([
  //       ['pickup_latitude', 'pickup_longitude'],
  //       ['pickup_address_lat', 'pickup_address_long'],
  //       ['pickup_lat', 'pickup_long'],
  //     ]);
  //     console.debug('[BookingTripPreview] MapController: originCoords =', originCoords?.toString());

  //     destinationCoords = this.resolveLatLng([
  //       ['dropoff_latitude', 'dropoff_longitude'],
  //       ['dropoff_address_lat', 'dropoff_address_long'],
  //       ['dropoff_lat', 'dropoff_long'],
  //     ]);
  //     console.debug('[BookingTripPreview] MapController: destinationCoords =', destinationCoords?.toString());
  //   } catch (err) {
  //     console.error('[BookingTripPreview] MapController: Failed to resolve base coordinates', err);
  //     return;
  //   }

  //   try {
  //     if (transferType.includes('airport_')) {
  //       originCoords = this.resolveLatLng([
  //         ['pickup_airport_latitude', 'pickup_airport_longitude'],
  //         ['pickup_airport_lat', 'pickup_airport_long'],
  //       ]) || originCoords;
  //       console.debug('[BookingTripPreview] MapController: airport_ override — originCoords =', originCoords?.toString());
  //     }

  //     if (transferType.includes('_airport')) {
  //       destinationCoords = this.resolveLatLng([
  //         ['dropoff_airport_latitude', 'dropoff_airport_longitude'],
  //         ['dropoff_airport_lat', 'dropoff_airport_long'],
  //       ]) || destinationCoords;
  //       console.debug('[BookingTripPreview] MapController: _airport override — destinationCoords =', destinationCoords?.toString());
  //     }
  //   } catch (err) {
  //     console.error('[BookingTripPreview] MapController: Failed to resolve airport coordinate overrides', err);
  //   }

  //   let origin: string | google.maps.LatLng | null;
  //   let destination: string | google.maps.LatLng | null;

  //   try {
  //     origin = this.resolveRouteLocation(
  //       originCoords,
  //       transferType.includes('airport_')
  //         ? ['pickup_airport_name', 'pickup']
  //         : ['pickup', 'pickup_airport_name']
  //     );
  //     destination = this.resolveRouteLocation(
  //       destinationCoords,
  //       transferType.includes('_airport')
  //         ? ['dropoff_airport_name', 'dropoff']
  //         : ['dropoff', 'dropoff_airport_name']
  //     );
  //     console.debug('[BookingTripPreview] MapController: origin =', origin, ', destination =', destination);
  //   } catch (err) {
  //     console.error('[BookingTripPreview] MapController: Failed to resolve route locations', err);
  //     return;
  //   }

  //   if (!origin || !destination) {
  //     console.warn('[BookingTripPreview] MapController: origin or destination is null — skipping map draw', { origin, destination });
  //     return;
  //   }

  //   try {
  //     if (originCoords) {
  //       this.mapCenter = { lat: originCoords.lat(), lng: originCoords.lng() };
  //     } else if (destinationCoords) {
  //       this.mapCenter = { lat: destinationCoords.lat(), lng: destinationCoords.lng() };
  //     }
  //     console.debug('[BookingTripPreview] MapController: mapCenter =', this.mapCenter);
  //   } catch (err) {
  //     console.error('[BookingTripPreview] MapController: Failed to set mapCenter', err);
  //   }

  //   setTimeout(() => {
  //     try {
  //       console.debug('[BookingTripPreview] MapController: calling drawMap');
  //       this.drawMap({
  //         origin,
  //         destination,
  //         waypoints,
  //         optimizeWaypoints: true,
  //         travelMode: google.maps.TravelMode.DRIVING
  //       });
  //     } catch (err) {
  //       console.error('[BookingTripPreview] MapController: drawMap() threw inside setTimeout', err);
  //     }
  //   }, 100);
  // }

  drawMap(request: google.maps.DirectionsRequest) {
    console.debug('[BookingTripPreview] drawMap: request =', request);

    try {
      const directionsService = new google.maps.DirectionsService();
      this.directionsRenderer = new google.maps.DirectionsRenderer();

      const mapInstance = this.map?.googleMap;
      if (!mapInstance) {
        console.error('[BookingTripPreview] drawMap: mapInstance is null — GoogleMap ViewChild not ready');
        return;
      }

      google.maps.event.trigger(mapInstance, 'resize');
      mapInstance.setCenter(this.mapCenter);
      this.directionsRenderer.setMap(mapInstance);

      directionsService.route(request, (response, status) => {
        console.debug('[BookingTripPreview] drawMap: DirectionsService status =', status);
        if (status === google.maps.DirectionsStatus.OK) {
          this.directionsRenderer.setDirections(response);
          console.debug('[BookingTripPreview] drawMap: directions rendered successfully');
        } else {
          console.warn('[BookingTripPreview] drawMap: DirectionsService returned non-OK status', status, response);
        }
      });
    } catch (err) {
      console.error('[BookingTripPreview] drawMap: Unexpected error', err);
    }
  }

  private resolveCoordinate(...keys: string[]): number | null {
    for (const key of keys) {
      try {
        const rawValue = this.bookingPreview?.[key];
        const parsedValue = Number(rawValue);
        if (rawValue !== null && rawValue !== undefined && rawValue !== '' && Number.isFinite(parsedValue)) {
          return parsedValue;
        } else if (rawValue !== null && rawValue !== undefined && rawValue !== '') {
          console.warn(`[BookingTripPreview] resolveCoordinate: key="${key}" has non-finite value`, rawValue);
        }
      } catch (err) {
        console.error(`[BookingTripPreview] resolveCoordinate: Error processing key="${key}"`, err);
      }
    }
    return null;
  }

  // ── Utility methods (unchanged, debug added) ───────────────────────────────

  mToMi(distance: number): string {
    return (distance / 1609).toFixed(2);
  }

  mToKm(distance: number): string {
    return (distance / 1000).toFixed(2);
  }

  convertToMinutes(value): string {
    try {
      const days = Math.floor(value / (24 * 60 * 60));
      const remainingSeconds = value % (24 * 60 * 60);
      const hours = Math.floor(remainingSeconds / (60 * 60));
      const remainingMinutes = Math.floor((remainingSeconds % (60 * 60)) / 60);
      let result = '';
      if (days > 0) result += `${days} days, `;
      if (hours > 0 || (days === 0 && hours === 0)) result += `${hours} hours, `;
      result += `${remainingMinutes} minutes`;
      return result;
    } catch (err) {
      console.error('[BookingTripPreview] convertToMinutes: Failed', { value, err });
      return '';
    }
  }

  iOS(): boolean {
    return ['iPad Simulator', 'iPhone Simulator', 'iPod Simulator', 'iPad', 'iPhone', 'iPod']
      .includes(navigator.platform)
      || (navigator.userAgent.includes('Mac') && 'ontouchend' in document);
  }

  showLocationPointOnMapByAddress(address: any) {
    if (!address) {
      console.warn('[BookingTripPreview] showLocationPointOnMapByAddress: address is empty');
      return;
    }
    try {
      const googleDirectionUrl = 'https://www.google.com/maps/dir/?api=1&destination=' +
        encodeURIComponent(address) + '&travelmode=driving';
      const iosDirectionUrl = 'http://maps.apple.com/?daddr=' + encodeURIComponent(address);
      console.debug('[BookingTripPreview] showLocationPointOnMapByAddress: iOS =', this.iOS(), ', address =', address);
      if (this.iOS()) {
        setTimeout(() => { window.location.href = iosDirectionUrl; });
      } else {
        window.open(googleDirectionUrl, '_blank');
      }
    } catch (err) {
      console.error('[BookingTripPreview] showLocationPointOnMapByAddress: Error opening map', err);
    }
  }

  textFormatter(text: any): string {
    try {
      if (text === null || text === undefined) {
        return '';
      }
      return String(text).replace(/[\\\_$]+/g, ' ');
    } catch (err) {
      console.error('[BookingTripPreview] textFormatter: Failed', { text, err });
      return String(text || '');
    }
  }

  searchOnGoogle(query: string) {
    if (!query) {
      console.warn('[BookingTripPreview] searchOnGoogle: query is empty');
      return;
    }
    try {
      const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
      window.open(url, '_blank');
    } catch (err) {
      console.error('[BookingTripPreview] searchOnGoogle: Failed', { query, err });
    }
  }

  formatBaseRate(baseRate: string | number): string {
    try {
      const numericValue = typeof baseRate === 'string' ? parseFloat(baseRate) : baseRate;
      if (!isNaN(numericValue)) return numericValue.toFixed(2);
      console.warn('[BookingTripPreview] formatBaseRate: non-numeric value', baseRate);
      return '0.00';
    } catch (err) {
      console.error('[BookingTripPreview] formatBaseRate: Error', { baseRate, err });
      return '0.00';
    }
  }

  formatDate(date: string): string {
    const m = moment(date);
    const dateStr = `${m.format('MM/DD/YYYY')} | ${m.format('MMMM D, YYYY')} | ${m.format('dddd')}`;
    if (m.isSame(moment(), 'day')) {
      return `Today | ${dateStr}`;
    }
    return dateStr;
  }

  formatTime(time: string): string {
    if (!time) return '';
    const formats = [
      'hh:mm A', 'hh:mm a', 'h:mm A', 'h:mm a',
      'hh:mm:ss A', 'hh:mm:ss a', 'h:mm:ss A', 'h:mm:ss a',
      'HH:mm:ss', 'HH:mm', 'H:mm:ss', 'H:mm'
    ];
    const m = moment(time, formats);
    if (!m.isValid()) return time;
    return `${m.format('LT')} | ${m.format('HHmm')} h`;
  }

  getCancellationTime(cancellationHours: number): string {
    try {
      if (cancellationHours > 24) {
        const days = Math.floor(cancellationHours / 24);
        // const remainingHours = cancellationHours % 24;
        return `${days} days`;
      }
      return `${cancellationHours} hours`;
    } catch (err) {
      console.error('[BookingTripPreview] getCancellationTime: Error', { cancellationHours, err });
      return '';
    }
  }

  highlightNumbers(text: string): string {
    const parts = text.split(/\b(\d+\.\s)/);

    // Process parts and apply formatting
    let formattedText = '';
    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 0) {
        formattedText += parts[i];
      } else {
        formattedText += `<br><span class="text-danger font-weight-bolder">${parts[i]}</span>`;
      }
    }

    return formattedText;
  }
}