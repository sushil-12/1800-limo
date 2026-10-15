import { AfterViewInit, Component, ElementRef, HostListener, NgZone, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { NgClass, NgFor, NgIf, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from 'src/app/services/auth.service';
import { CommonService } from 'src/app/services/common.service';
import * as intlTelInput from 'intl-tel-input';
import { attachPlaceAutocompleteElement, getPlaceAutocompleteDisplayValue } from 'src/app/utils/google-place-autocomplete';

interface Benefit {
  title: string;
  description: string;
  image: string;
  imageAlt: string;
}

interface ApplicantType {
  title: string;
  requirements: string[];
}

interface Faq {
  question: string;
  answer: string;
}

interface ShowcaseCallout {
  side: 'left' | 'right';
  /** Vertical position of the connector line, in % of the desktop canvas height. */
  y: number;
  title: string;
  text: string;
  /** SVG path data (24x24 viewBox); omitted when `iconText` is used. */
  icon?: string[];
  iconText?: string;
  iconClass: string;
}

interface ShowcaseScreen {
  label: string;
  image: string;
  imageAlt: string;
  /** The phone artwork has orange hotspot dots baked in, so connectors run to them. */
  hotspots: boolean;
  /** Listed in reveal order: left, right, left, right. */
  callouts: ShowcaseCallout[];
}

interface PlatformChannel {
  eyebrow: string;
  title: string;
  description: string;
  points: string[];
}

/** A subscription product from `get-subscription-products`, trimmed for the pricing cards. */
interface PlanCard {
  id: number;
  name: string;
  price: number;
  tagline: string;
  features: { title: string; description: string }[];
  /** The API object as-is: partner registration and payment read it from sessionStorage. */
  raw: any;
}

interface HeroSlide {
  image: string;
  /** ~1200px wide copy for phones. */
  imageSmall: string;
  label: string;
  /** CSS object-position that keeps the subject in frame when the card crops the photo. */
  focus: string;
}

interface HeroStat {
  value: string;
  label: string;
}

/** Shown when a signed-in affiliate has more vehicles than the chosen plan covers. */
interface PlanNotice {
  message: string;
  /** Plan to subscribe to if the affiliate accepts the extra-vehicle charge. */
  proceedWith?: PlanCard;
}

/** Features listed per card before "Show all". */
const PLAN_FEATURE_LIMIT = 5;

/** Time each hero photo stays up; the zoom in the stylesheet runs a little longer so it never stalls. */
const HERO_SLIDE_MS = 6500;
/** Slides after the first wait this long so they don't compete with it for bandwidth. */
const HERO_PRELOAD_DELAY = 1500;

// Plan ids from get-subscription-products.
const FREE_PLAN_ID = 1;
const BASIC_PLAN_ID = 2;
const FLEET_PLAN_ID = 3;

const ICON_TONE = {
  purple: 'tw-bg-[#EFEDFE] tw-text-[#635BFF]',
  orange: 'tw-bg-[#FFF1E6] tw-text-[#F3933D]',
  green: 'tw-bg-[#E9F7EF] tw-text-[#16A34A]',
  blue: 'tw-bg-[#EAF0FE] tw-text-[#3B6FE0]',
  teal: 'tw-bg-[#E6F2EF] tw-text-[#0F4C45]',
  red: 'tw-bg-[#FDECEC] tw-text-[#D63A3A]'
};

// Apply CTA throttling. The server is the real rate limiter; these are a client-side
// courtesy guard so an idle visitor can't sit on the button and burn SMS credit.
/** localStorage log of app-link sends: { <hashed number>: [timestamps] }. */
const SEND_LOG_KEY = 'driverAppLinkSends';
/** One number can request the link this many times per window (they only need it once). */
const MAX_SENDS_PER_NUMBER = 2;
/** Any numbers together can be requested this many times per window from one browser. */
const MAX_SENDS_PER_BROWSER = 5;
/** Sends older than this drop out of the log, so the caps above reset after a day. */
const SEND_WINDOW_MS = 24 * 60 * 60 * 1000;
/** Minimum gap between two sends, so nobody can walk down a list of numbers. */
const SEND_COOLDOWN_MS = 30 * 1000;

// Service interest popup: opens on every visit to the page, after a random 4-8s delay.
const SERVICE_POPUP_MIN_DELAY = 3000;
const SERVICE_POPUP_MAX_DELAY = 5000;
/** The Maps script loads async; wait this long between checks for it (up to 20 tries). */
const MAPS_RETRY_MS = 250;

// Showcase timeline (ms). Motion uses transform/opacity only; see the template.
const PHONE_LEAD_IN = 700;
const CALLOUT_STEP = 650;
const HOLD_AFTER_REVEAL = 3500;
const HIDE_DURATION = 450;

@Component({
  selector: 'app-driver',
  standalone: true,
  imports: [NgIf, NgFor, NgClass, NgTemplateOutlet, FormsModule, RouterLink],
  templateUrl: './driver.component.html',
  styleUrl: './driver.component.scss'
})
export class DriverComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('showcase') private showcaseRef?: ElementRef<HTMLElement>;
  @ViewChild('mobileInput') private mobileInputRef?: ElementRef<HTMLInputElement>;

  readonly heroSlides: HeroSlide[] = [
    { image: 'assets/images/driver-landing/hero-booking.webp', imageSmall: 'assets/images/driver-landing/hero-booking-sm.webp', label: 'New booking, your rate', focus: '72% center' },
    { image: 'assets/images/driver-landing/hero-airport.webp', imageSmall: 'assets/images/driver-landing/hero-airport-sm.webp', label: 'Airport meet & greet', focus: '78% center' },
    { image: 'assets/images/driver-landing/hero-corporate.webp', imageSmall: 'assets/images/driver-landing/hero-corporate-sm.webp', label: 'Corporate travel', focus: '62% center' },
    { image: 'assets/images/driver-landing/hero-events.webp', imageSmall: 'assets/images/driver-landing/hero-events-sm.webp', label: 'Weddings & events', focus: '82% center' },
    { image: 'assets/images/driver-landing/hero-schedule.webp', imageSmall: 'assets/images/driver-landing/hero-schedule-sm.webp', label: 'On your schedule', focus: '78% center' }
  ];

  readonly heroStats: HeroStat[] = [
    { value: '100%', label: 'of your rate and tips' },
    { value: '900+', label: 'global affiliates' },
    { value: '3 days', label: 'to get paid' },
    { value: '24/7', label: 'dispatch & support' }
  ];

  activeHeroSlide = 0;
  /** Renders the slides after the first once the first has had a head start. */
  heroSlidesReady = false;
  /** Hovering the hero holds the current photo. */
  pauseHero = false;
  private heroTimer?: ReturnType<typeof setInterval>;

  readonly playStoreUrl = 'https://play.google.com/store/apps/details?id=com.limo1800driver.app';
  readonly appStoreUrl = 'https://apps.apple.com/app/1800limo-chauffeur/id6748669445';

  readonly channels: PlatformChannel[] = [
    {
      eyebrow: 'Driver App',
      title: 'Drive and get paid from your phone',
      description: 'For chauffeurs and gig drivers on the road. Everything you need between pickup and payout.',
      points: [
        'New booking alerts with full trip details',
        'Turn-by-turn navigation and live ETA',
        'Accept or reject rides in one tap',
        'Direct deposit within 3 business days'
      ]
    },
    {
      eyebrow: 'Web Portal',
      title: 'Run your limo business from any browser',
      description: 'For owner-operators and fleets. Manage your own clients and take 1-800-LIMO.COM bookings in one place.',
      points: [
        'Create and manage your own daily bookings',
        'Add vehicles, drivers and your own rates',
        'Farm in and farm out worldwide, earn 10% commission',
        'Invoices, split payments and accounting reports'
      ]
    }
  ];

  plans: PlanCard[] = [];
  plansFailed = false;
  /** Plan ids whose full feature list is expanded. */
  expandedPlans = new Set<number>();
  planNotice: PlanNotice | null = null;

  readonly benefits: Benefit[] = [
    {
      title: 'Flexible Schedule, Your Rules',
      description: 'You decide when you drive, which rides you accept, and the rates you set. No mandatory shifts, no surge caps.',
      image: 'assets/images/driver-landing/clock.png',
      imageAlt: 'Driver racing a stopwatch while working on a laptop'
    },
    {
      title: 'Transparent Pay, Keep Your Tips',
      description: 'You set your rate and Keep 100% of your all-inclusive rate and tip, and repeat clients. Our 25% booking fee is added on top of your rate and paid by the client, and taxes, tolls, and expenses are paid to you by the client too.',
      image: 'assets/images/driver-landing/money.png',
      imageAlt: 'Money bag with stacks of cash and gold coins'
    },
    {
      title: '24/7 Dispatch & Dedicated Support',
      description: 'Our 24/7 dispatch and support team is always ready to assist. With 900+ global affiliates and 30+ years of livery experience, we have the network and expertise to back you up on every run.',
      image: 'assets/images/driver-landing/microphones.png',
      imageAlt: 'Support agent with a headset working at a laptop'
    }
  ];

  readonly applicantTypes: ApplicantType[] = [
    {
      title: 'Professional Chauffeurs',
      requirements: [
        "Valid driver's license",
        'Professional headshot',
        'Interior & exterior vehicle photos',
        'Rear license plate photo',
        'Proof of insurance',
        'Local licenses & airport/seaport permits'
      ]
    },
    {
      title: 'Gig / Taxi / NEMT Drivers (Rideshare)',
      requirements: [
        'All professional chauffeur requirements',
        '4.5-5 star Uber or Lyft rating',
        'Minimum 3 months Uber/Lyft experience',
        'Fingerprint documentation',
        'City license'
      ]
    },
    {
      title: 'Fleet & Coach Operators',
      requirements: [
        'All professional chauffeur requirements',
        'Applicable permits',
        'ICC number (if applicable)',
        'Proof of insurance',
        'Vehicle photos (interior & exterior)',
        'Rear license plate photo'
      ]
    }
  ];

  readonly faqs: Faq[] = [
    {
      question: 'How long does the application process take?',
      answer: 'Applications are reviewed after all required documents are submitted. Processing times may vary; you will be contacted once your profile has been reviewed.'
    },
    {
      question: 'Does 1-800-LIMO.COM control my schedule or rates?',
      answer: 'No. You set your own availability and rates. You choose which booking opportunities to accept or decline. There are no mandatory hours or surge-pricing controls.'
    },
    {
      question: 'When and how do I get paid?',
      answer: 'Earnings are deposited directly to your account within 3 business days from the date client funds are received. Tips are 100% yours. Taxes, tolls, and other expenses are collected directly from the client.'
    },
    {
      question: 'Does 1-800-LIMO.COM take a cut of my rate?',
      answer: 'No. We quote your all-inclusive rate to the client and add our 25% booking fee on top of it. The client pays the fee, so you receive the full rate you set.'
    },
    {
      question: 'Do I need a paid plan to drive?',
      answer: 'No. Joining is free, and the Free plan lists your vehicles and drivers so you receive bookings from 1-800-LIMO.COM. The Basic and Fleet Operator plans add our web software for running your own daily bookings, farm-ins and farm-outs.'
    },
    {
      question: 'Is this available outside the US?',
      answer: '1-800-LIMO.COM is a global platform with 900+ affiliates worldwide. Availability may vary by region. Check the platform during registration for coverage in your area.'
    }
  ];

  readonly showcaseScreens: ShowcaseScreen[] = [
    {
      label: 'My Bookings',
      image: 'assets/images/driver-landing/Mybookings.png',
      imageAlt: 'Driver app bookings list with pending, finalized and paid trips',
      hotspots: true,
      callouts: [
        { side: 'left', y: 18.85, title: 'Push alerts for new bookings', text: 'Every request reaches the driver the moment it lands.', icon: ['M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9', 'M10.3 21a1.94 1.94 0 0 0 3.4 0'], iconClass: ICON_TONE.orange },
        { side: 'right', y: 32.46, title: 'Full trip details', text: 'Passenger, flight number, pickup and drop-off in one card.', icon: ['M21 6H3', 'M15 12H3', 'M17 18H3'], iconClass: ICON_TONE.blue },
        { side: 'left', y: 52.38, title: 'Distance and fare upfront', text: 'Trip total and mileage shown before anyone commits.', icon: ['M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z', 'M12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'], iconClass: ICON_TONE.red },
        { side: 'right', y: 74.41, title: 'Accept, finalize, invoice', text: 'Accept or reject, finalize and pay, then view the invoice.', icon: ['M20 6 9 17l-5-5'], iconClass: ICON_TONE.green }
      ]
    },
    {
      label: 'Booking Preview',
      image: 'assets/images/driver-landing/phone-3.webp',
      imageAlt: 'Driver app booking preview with trip details, route map and accept button',
      hotspots: true,
      callouts: [
        { side: 'left', y: 18.85, title: 'New booking alerts', text: 'Drivers get every request with the full trip details.', icon: ['M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9', 'M10.3 21a1.94 1.94 0 0 0 3.4 0'], iconClass: ICON_TONE.blue },
        { side: 'right', y: 34.75, title: 'Multi-stop routes', text: 'Pickup, extra stops and drop-off in one job.', icon: ['M6 16a3 3 0 1 0 0 6 3 3 0 0 0 0-6z', 'M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15', 'M18 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'], iconClass: ICON_TONE.orange },
        { side: 'left', y: 52.38, title: 'Live route preview', text: 'Distance and ETA before the driver commits.', icon: ['M9 3 3 6v15l6-3 6 3 6-3V3l-6 3-6-3z', 'M9 3v15', 'M15 6v15'], iconClass: ICON_TONE.green },
        { side: 'right', y: 87.44, title: 'Accept or reject in a tap', text: 'No calls, no back and forth with dispatch.', icon: ['M20 6 9 17l-5-5'], iconClass: ICON_TONE.green }
      ]
    },
    {
      label: 'Navigation',
      image: 'assets/images/driver-landing/phone-2.webp',
      imageAlt: 'Driver app turn-by-turn navigation screen for a ride in progress',
      hotspots: true,
      callouts: [
        { side: 'left', y: 18.85, title: 'Turn-by-turn navigation', text: 'Built-in guidance to the next stop.', icon: ['m3 11 19-9-9 19-2-8-8-2z'], iconClass: ICON_TONE.teal },
        { side: 'right', y: 58.51, title: 'Live GPS tracking', text: 'Passengers and dispatch see the car move.', icon: ['M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z', 'M12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'], iconClass: ICON_TONE.blue },
        { side: 'left', y: 77.67, title: 'Live distance and ETA', text: 'Arrival time updates as the ride progresses.', icon: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'M12 6v6l4 2'], iconClass: ICON_TONE.orange },
        { side: 'right', y: 86.38, title: 'One-tap ride completion', text: 'Finalize the trip and trigger the payout.', icon: ['M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z', 'M4 22v-7'], iconClass: ICON_TONE.red }
      ]
    },
    {
      label: 'Wallet',
      image: 'assets/images/driver-landing/phone-1.webp',
      imageAlt: 'Driver app wallet screen showing total earnings, deposits and transfers',
      hotspots: false,
      callouts: [
        { side: 'left', y: 21.73, title: 'Stripe Connect deposits', text: "Earnings land straight in the driver's bank account.", iconText: 'S', iconClass: ICON_TONE.purple },
        { side: 'right', y: 32.46, title: 'Instant payouts', text: 'Cash out anytime instead of waiting for the cycle.', icon: ['M13 2 3 14h9l-1 8 10-12h-9l1-8z'], iconClass: ICON_TONE.orange },
        { side: 'left', y: 60.62, title: 'Automatic affiliate splits', text: "Each reservation's share is calculated and paid out.", icon: ['m15 10 5 5-5 5', 'M4 4v7a4 4 0 0 0 4 4h12'], iconClass: ICON_TONE.green },
        { side: 'right', y: 71.73, title: 'Full transfer history', text: 'Every payout linked to its reservation, searchable.', icon: ['M21 6H3', 'M15 12H3', 'M17 18H3'], iconClass: ICON_TONE.blue }
      ]
    },
  ];

  /** Index of the phone screen currently shown. */
  activeScreen = 0;
  /** How many callouts of the active screen are revealed (0-4). */
  revealedCallouts = 0;
  /** Becomes true the first time the showcase scrolls into view. */
  showcaseStarted = false;
  reducedMotion = false;

  private showcaseObserver?: IntersectionObserver;
  private showcaseTimers: ReturnType<typeof setTimeout>[] = [];

  mobile = '';
  error = '';
  /** Confirmation shown under the Apply CTA once the link is on its way. */
  sent = '';
  /** True while `send-driver-app-link` is in flight; disables the form. */
  sending = false;
  /** Country flag + dial code picker on the Apply CTA's mobile field. */
  private phoneInput?: intlTelInput.Plugin;

  readonly serviceOptions = [
    'Chauffeur / Driver',
    'Limo Company / Fleet Operator',
    'Reservation & Dispatch Software',
    'Farm-in / Farm-out Bookings',
    'Other'
  ];
  servicePopupOpen = false;
  serviceForm = { email: '', phone: '', address: '', service: '' };
  serviceError = '';
  serviceSent = '';
  serviceSending = false;
  private servicePopupTimer?: ReturnType<typeof setTimeout>;
  private addressAutocompleteTimer?: ReturnType<typeof setTimeout>;

  /** The address field only exists while the popup is open, so attach Google Places when it appears. */
  @ViewChild('serviceAddressInput') set serviceAddressInput(ref: ElementRef<HTMLInputElement> | undefined) {
    this.serviceAddressEl = ref?.nativeElement;
    if (this.serviceAddressEl) this.attachAddressAutocomplete(this.serviceAddressEl);
    else clearTimeout(this.addressAutocompleteTimer);
  }
  private serviceAddressEl?: HTMLInputElement;

  /** Flag + dial-code picker on the popup's phone field; created and destroyed with the popup. */
  @ViewChild('servicePhoneInput') set servicePhoneInput(ref: ElementRef<HTMLInputElement> | undefined) {
    this.servicePhonePicker?.destroy();
    this.servicePhonePicker = undefined;
    if (ref) {
      this.servicePhonePicker = intlTelInput(ref.nativeElement, this.commonService.getTelInputOptions(this.phoneCountry()));
    }
  }
  private servicePhonePicker?: intlTelInput.Plugin;

  private plansSub?: Subscription;
  private appLinkSub?: Subscription;
  private serviceSub?: Subscription;

  constructor(
    private authService: AuthService,
    private commonService: CommonService,
    private router: Router,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    this.scheduleServicePopup();

    this.plansSub = this.authService.getSubsPlans().subscribe({
      next: (response: any) => {
        this.plans = (response?.data ?? []).map((plan: any): PlanCard => ({
          id: plan.id,
          name: plan.product_name,
          price: Number(plan.product_price) || 0,
          tagline: (plan.product_text ?? '').trim(),
          features: Object.entries<any>(plan.product_description?.features ?? {})
            .map(([key, value]) => ({ title: this.featureLabel(key), description: value?.description ?? '' })),
          raw: plan
        }));
        this.plansFailed = this.plans.length === 0;
      },
      error: () => (this.plansFailed = true)
    });
  }

  ngAfterViewInit(): void {
    if (this.mobileInputRef) {
      this.phoneInput = intlTelInput(this.mobileInputRef.nativeElement, this.commonService.getTelInputOptions(this.phoneCountry()));
      this.mobileInputRef.nativeElement.addEventListener('countrychange', () => this.onMobileChange());
    }

    const el = this.showcaseRef?.nativeElement;
    if (!el || typeof window === 'undefined') return;

    this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    this.startHero();

    if (!('IntersectionObserver' in window)) {
      setTimeout(() => this.onShowcaseVisible(true));
      return;
    }
    this.showcaseObserver = new IntersectionObserver(
      ([entry]) => this.onShowcaseVisible(entry.isIntersecting),
      { threshold: 0.35 }
    );
    this.showcaseObserver.observe(el);
  }

  ngOnDestroy(): void {
    this.showcaseObserver?.disconnect();
    this.clearShowcaseTimers();
    this.plansSub?.unsubscribe();
    this.appLinkSub?.unsubscribe();
    this.serviceSub?.unsubscribe();
    clearTimeout(this.servicePopupTimer);
    clearTimeout(this.addressAutocompleteTimer);
    clearInterval(this.heroTimer);
    this.phoneInput?.destroy();
    this.servicePhonePicker?.destroy();
  }

  /** Signed-in users start on their own country (as in affiliate step 1); everyone else by IP location. */
  private phoneCountry(): string {
    const user = this.authService.currentUserValue;
    return user?.phoneCountry || user?.country || 'auto';
  }

  showHeroSlide(index: number): void {
    this.heroSlidesReady = true;
    this.activeHeroSlide = index;
    // Restart the interval so a picked photo gets its full time.
    this.startHeroTimer();
  }

  private startHero(): void {
    setTimeout(() => (this.heroSlidesReady = true), HERO_PRELOAD_DELAY);
    // Reduced motion: the first photo stays; the dots still switch photos.
    if (!this.reducedMotion) this.startHeroTimer();
  }

  private startHeroTimer(): void {
    clearInterval(this.heroTimer);
    if (this.reducedMotion) return;
    this.heroTimer = setInterval(() => {
      if (this.pauseHero || document.hidden) return;
      this.activeHeroSlide = (this.activeHeroSlide + 1) % this.heroSlides.length;
    }, HERO_SLIDE_MS);
  }

  readonly planFeatureLimit = PLAN_FEATURE_LIMIT;

  visibleFeatures(plan: PlanCard): PlanCard['features'] {
    return this.expandedPlans.has(plan.id) ? plan.features : plan.features.slice(0, PLAN_FEATURE_LIMIT);
  }

  toggleFeatures(plan: PlanCard): void {
    if (!this.expandedPlans.delete(plan.id)) this.expandedPlans.add(plan.id);
  }

  /**
   * Mirrors SubscriptionPlansComponent.submitPlan: free plan -> driver login; signed-in affiliates
   * go to payment once their vehicle count fits the plan; everyone else registers as a partner.
   */
  choosePlan(plan: PlanCard): void {
    if (plan.id === FREE_PLAN_ID) {
      sessionStorage.setItem('clicked_login_role', 'driver');
      this.router.navigate(['/login']);
      return;
    }

    if (!localStorage.getItem('currentUser')) {
      this.startCheckout(plan, '/partner-registration');
      return;
    }

    const vehicles = Number(localStorage.getItem('affiliateVehicles')) || 0;
    if (plan.id === BASIC_PLAN_ID && vehicles > 1) {
      this.planNotice = {
        message: 'You currently have multiple vehicles associated with your account. To continue, please select the Fleet Operator plan or remove the additional vehicles from your account.'
      };
    } else if (plan.id === FLEET_PLAN_ID && vehicles > 2) {
      this.planNotice = {
        message: 'You currently have more than 2 vehicles associated with your account. A charge of $25 will apply for each additional vehicle. If you agree, please proceed. Otherwise, remove the extra vehicles from your account.',
        proceedWith: plan
      };
    } else {
      this.startCheckout(plan, '/payment-details');
    }
  }

  proceedWithNotice(): void {
    const plan = this.planNotice?.proceedWith;
    this.planNotice = null;
    if (plan) this.startCheckout(plan, '/payment-details');
  }

  openVehicleSettings(): void {
    this.planNotice = null;
    this.router.navigate(['/affiliate/step5']);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closePlanNotice();
    this.closeServicePopup();
  }

  closePlanNotice(): void {
    this.planNotice = null;
  }

  private scheduleServicePopup(): void {
    if (typeof window === 'undefined') return;
    // Signed-in users have already given us their details.
    try {
      if (localStorage.getItem('access_token')) return;
    } catch {
      // Storage blocked: treat the visitor as signed out.
    }
    const delay = SERVICE_POPUP_MIN_DELAY + Math.random() * (SERVICE_POPUP_MAX_DELAY - SERVICE_POPUP_MIN_DELAY);
    this.servicePopupTimer = setTimeout(() => {
      // Don't stack on top of the plan notice.
      if (!this.planNotice) this.servicePopupOpen = true;
    }, delay);
  }

  closeServicePopup(): void {
    this.servicePopupOpen = false;
  }

  /**
   * Digits plus one leading "+" for the country code (+1, +91...). Letters, spaces and other
   * symbols are stripped as they are typed or pasted.
   */
  onServicePhoneInput(event: Event): void {
    this.serviceForm.phone = this.sanitizePhoneInput(event.target as HTMLInputElement);
  }

  /** Strips a phone field down to digits plus one leading "+", and returns the cleaned value. */
  private sanitizePhoneInput(input: HTMLInputElement): string {
    const plus = input.value.trimStart().startsWith('+') ? '+' : '';
    const cleaned = plus + input.value.replace(/\D/g, '').slice(0, 15);
    // Write back to the field directly: if the model value didn't change, ngModel wouldn't repaint it.
    if (input.value !== cleaned) input.value = cleaned;
    return cleaned;
  }

  /** Same Google Places suggestions as the home page pickup/drop-off fields. */
  private attachAddressAutocomplete(input: HTMLInputElement, attemptsLeft = 20): void {
    clearTimeout(this.addressAutocompleteTimer);
    if (typeof google === 'undefined' || !google?.maps) {
      if (attemptsLeft > 1) {
        this.addressAutocompleteTimer = setTimeout(() => this.attachAddressAutocomplete(input, attemptsLeft - 1), MAPS_RETRY_MS);
      }
      return;
    }

    void attachPlaceAutocompleteElement(
      input,
      {
        types: ['geocode', 'establishment'],
        fields: ['formatted_address', 'geometry', 'place_id', 'name', 'address_components', 'types']
      },
      (place) => {
        this.ngZone.run(() => {
          const formattedAddress = place.formatted_address ?? '';
          const placeName = place.name ?? '';
          // Businesses read better with their name; plain addresses already start with it.
          this.serviceForm.address = placeName && !formattedAddress.startsWith(placeName)
            ? `${placeName} - ${formattedAddress}`
            : formattedAddress;
          input.value = this.serviceForm.address;
          if (this.serviceError) this.serviceError = '';
        });
      }
    );
  }

  submitServiceInterest(): void {
    if (this.serviceSending) return;

    const email = this.serviceForm.email.trim();
    // Sent in E.164 (+15551234567), with the dial code from the flag picker.
    const phone = this.e164Number(this.serviceForm.phone, this.servicePhonePicker);
    // Typed text that wasn't picked from the suggestions only lives in the Google widget.
    const typedAddress = this.serviceAddressEl ? getPlaceAutocompleteDisplayValue(this.serviceAddressEl) : '';
    const address = (typedAddress || this.serviceForm.address).trim();
    const service = this.serviceForm.service;

    this.serviceSent = '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.serviceError = 'Please enter a valid email address.';
    } else if (!phone) {
      this.serviceError = 'Please enter a valid phone number.';
    } else if (!address) {
      this.serviceError = 'Please enter your physical address.';
    } else if (!service) {
      this.serviceError = 'Please select the service you are interested in.';
    } else {
      this.serviceError = '';
    }
    if (this.serviceError) return;

    this.serviceSending = true;
    this.serviceSub = this.authService.submitServiceInterest({ email, phone, address, service }).subscribe({
      next: () => {
        this.serviceSending = false;
        this.serviceSent = 'Thank you! Our team will contact you shortly.';
        this.serviceForm = { email: '', phone: '', address: '', service: '' };
        setTimeout(() => this.closeServicePopup(), 2000);
      },
      error: (err: any) => {
        this.serviceSending = false;
        this.serviceError = err?.error?.message || "We couldn't submit your details right now. Please try again.";
      }
    });
  }

  private startCheckout(plan: PlanCard, route: string): void {
    sessionStorage.setItem('selectedPlan', JSON.stringify(plan.raw));
    this.router.navigate([route]);
  }

  scrollToPlans(): void {
    document.getElementById('plans')?.scrollIntoView({ behavior: this.reducedMotion ? 'auto' : 'smooth' });
  }

  /** `receive_farm-In_bookings_and_farm-Out` -> `Receive farm-in bookings and farm-out`. */
  private featureLabel(key: string): string {
    const text = key.replace(/_/g, ' ').toLowerCase().replace(/\bpc\b/g, 'PC');
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  readonly trackByIndex = (index: number) => index;

  /** Callouts slide in from their own side on desktop and rise up on smaller screens. */
  calloutStateClass(callout: ShowcaseCallout, index: number): string {
    if (index < this.revealedCallouts) {
      return 'tw-opacity-100 tw-translate-y-0 lg:tw-translate-x-0 lg:tw-delay-150';
    }
    return callout.side === 'left'
      ? 'tw-opacity-0 tw-translate-y-3 lg:tw-translate-y-0 lg:-tw-translate-x-4'
      : 'tw-opacity-0 tw-translate-y-3 lg:tw-translate-y-0 lg:tw-translate-x-4';
  }

  selectScreen(index: number): void {
    this.playScreen(index);
  }

  /** Connector geometry, in % of the desktop canvas (measured from the source artwork). */
  connectorLeft(screen: ShowcaseScreen, callout: ShowcaseCallout): number {
    if (callout.side === 'left') return 25.57;
    return screen.hotspots ? 67.09 : 68.81;
  }

  connectorWidth(screen: ShowcaseScreen, callout: ShowcaseCallout): number {
    if (callout.side === 'left') return (screen.hotspots ? 32.87 : 29.69) - 25.57;
    return 72.72 - this.connectorLeft(screen, callout);
  }

  private onShowcaseVisible(visible: boolean): void {
    if (visible) {
      this.showcaseStarted = true;
      this.playScreen(this.activeScreen);
    } else {
      // Pause off-screen; the current screen replays its reveal when it comes back.
      this.clearShowcaseTimers();
    }
  }

  /** Show the phone first, then reveal its callouts one by one, then move to the next screen. */
  private playScreen(index: number): void {
    this.clearShowcaseTimers();
    this.activeScreen = index;

    if (this.reducedMotion) {
      this.revealedCallouts = this.showcaseScreens[index].callouts.length;
      return;
    }

    this.revealedCallouts = 0;
    const count = this.showcaseScreens[index].callouts.length;
    for (let i = 1; i <= count; i++) {
      this.schedule(() => (this.revealedCallouts = i), PHONE_LEAD_IN + (i - 1) * CALLOUT_STEP);
    }

    const hideAt = PHONE_LEAD_IN + (count - 1) * CALLOUT_STEP + HOLD_AFTER_REVEAL;
    this.schedule(() => (this.revealedCallouts = 0), hideAt);
    this.schedule(() => this.playScreen((index + 1) % this.showcaseScreens.length), hideAt + HIDE_DURATION);
  }

  private schedule(fn: () => void, delay: number): void {
    this.showcaseTimers.push(setTimeout(fn, delay));
  }

  private clearShowcaseTimers(): void {
    this.showcaseTimers.forEach(clearTimeout);
    this.showcaseTimers = [];
  }

  onMobileInput(event: Event): void {
    this.mobile = this.sanitizePhoneInput(event.target as HTMLInputElement);
    this.onMobileChange();
  }

  /** Editing the number clears whatever the last attempt said. */
  onMobileChange(): void {
    this.error = '';
    this.sent = '';
  }

  applyToDrive(): void {
    if (this.sending) return;

    const phone = this.e164Number();
    if (!phone) {
      this.error = 'Please enter a valid mobile number.';
      return;
    }

    const blocked = this.throttleMessage(phone);
    if (blocked) {
      this.error = blocked;
      return;
    }

    this.error = '';
    this.sent = '';
    this.sending = true;
    this.appLinkSub = this.authService.sendDriverAppLink({ phone }).subscribe({
      next: () => {
        this.sending = false;
        this.sent = 'Sent! Check your texts for the download link.';
        this.mobile = '';
        this.recordSend(phone);
      },
      error: (err: any) => {
        this.sending = false;
        // A server-side 429 counts as a send here too, so a page refresh can't wipe the cooldown.
        if (err?.status === 429) this.recordSend(phone);
        this.error = err?.status === 429
          ? 'Too many requests. Please try again later.'
          : err?.error?.message || "We couldn't send the link right now. Please try again.";
      }
    });
  }

  /** The typed number in E.164 (`+15551234567`), or '' when it isn't a valid mobile number. */
  private e164Number(raw = this.mobile, picker = this.phoneInput): string {
    const digits = raw.replace(/\D/g, '');

    // isValidNumber()/getNumber() need the utils script; until it loads, fall back to a length
    // check and build the number from the picker's dial code.
    if (picker && (window as any).intlTelInputUtils) {
      return picker.isValidNumber() ? picker.getNumber() : '';
    }
    if (digits.length < 7 || digits.length > 15) return '';
    // separateDialCode is on, so the field holds a national number - unless one was pasted in.
    if (raw.trim().startsWith('+')) return `+${digits}`;
    const dialCode = picker?.getSelectedCountryData()?.dialCode;
    return dialCode ? `+${dialCode}${digits}` : '';
  }

  /** Why this send is being refused, or '' when it may go through. */
  private throttleMessage(phone: string): string {
    const log = this.readSendLog();
    const all = Object.values(log).flat();

    if ((log[this.numberKey(phone)]?.length ?? 0) >= MAX_SENDS_PER_NUMBER) {
      return 'We already texted the app link to this number. Please check your messages.';
    }
    if (all.length >= MAX_SENDS_PER_BROWSER) {
      return 'Too many requests. Please try again later.';
    }
    if (all.length && Date.now() - Math.max(...all) < SEND_COOLDOWN_MS) {
      return 'Please wait a moment before requesting another link.';
    }
    return '';
  }

  private recordSend(phone: string): void {
    const log = this.readSendLog();
    const key = this.numberKey(phone);
    log[key] = [...(log[key] ?? []), Date.now()];
    try {
      localStorage.setItem(SEND_LOG_KEY, JSON.stringify(log));
    } catch {
      // Storage full or blocked (private mode): the server-side limit still applies.
    }
  }

  /** Reads the log, dropping entries that have aged out of the window. */
  private readSendLog(): Record<string, number[]> {
    const log: Record<string, number[]> = {};
    let parsed: any;
    try {
      parsed = JSON.parse(localStorage.getItem(SEND_LOG_KEY) ?? 'null');
    } catch {
      return log; // Hand-edited or unreadable: treat it as no history.
    }
    if (!parsed || typeof parsed !== 'object') return log;

    const cutoff = Date.now() - SEND_WINDOW_MS;
    for (const [key, times] of Object.entries(parsed)) {
      // Only entries older than the window are dropped, so a tampered clock can never
      // hand out extra sends - at worst it holds the visitor to the cap for longer.
      const kept = (Array.isArray(times) ? times : [])
        .filter((time: any) => typeof time === 'number' && time > cutoff);
      if (kept.length) log[key] = kept;
    }
    return log;
  }

  /** Short non-reversible key, so the log doesn't keep phone numbers in readable form. */
  private numberKey(phone: string): string {
    let hash = 5381;
    for (const char of phone) hash = ((hash << 5) + hash + char.charCodeAt(0)) | 0;
    return (hash >>> 0).toString(36);
  }
}
