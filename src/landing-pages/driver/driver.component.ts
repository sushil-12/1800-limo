import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { NgClass, NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';

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

const ICON_TONE = {
  purple: 'tw-bg-[#EFEDFE] tw-text-[#635BFF]',
  orange: 'tw-bg-[#FFF1E6] tw-text-[#F08A2C]',
  green: 'tw-bg-[#E9F7EF] tw-text-[#16A34A]',
  blue: 'tw-bg-[#EAF0FE] tw-text-[#3B6FE0]',
  teal: 'tw-bg-[#E6F2EF] tw-text-[#0F4C45]',
  red: 'tw-bg-[#FDECEC] tw-text-[#D63A3A]'
};

// Showcase timeline (ms). Motion uses transform/opacity only; see the template.
const PHONE_LEAD_IN = 700;
const CALLOUT_STEP = 650;
const HOLD_AFTER_REVEAL = 3500;
const HIDE_DURATION = 450;

@Component({
  selector: 'app-driver',
  standalone: true,
  imports: [NgIf, NgFor, NgClass, FormsModule],
  templateUrl: './driver.component.html',
  styleUrl: './driver.component.scss'
})
export class DriverComponent implements AfterViewInit, OnDestroy {
  @ViewChild('showcase') private showcaseRef?: ElementRef<HTMLElement>;

  readonly playStoreUrl = 'https://play.google.com/store/apps/details?id=com.limo1800driver.app';
  readonly appStoreUrl = 'https://apps.apple.com/app/1800limo-chauffeur/id6748669445';

  readonly benefits: Benefit[] = [
    {
      title: 'Flexible Schedule, Your Rules',
      description: 'You decide when you drive, which rides you accept, and the rates you set. No mandatory shifts, no surge caps.',
      image: 'assets/images/driver-landing/clock.png',
      imageAlt: 'Driver racing a stopwatch while working on a laptop'
    },
    {
      title: 'Transparent Pay, Keep Your Tips',
      description: 'Keep 100% of your tips. 1800-LIMO.COM adds a 25% platform premium - taxes, tolls, and expenses are paid directly to you by the client.',
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
      title: 'Gig Drivers (Rideshare)',
      requirements: [
        'All chauffeur requirements above',
        '4.5-5 star Uber or Lyft rating',
        'Minimum 3 months Uber/Lyft experience',
        'Fingerprint documentation',
        'City license'
      ]
    },
    {
      title: 'Fleet & Coach Operators',
      requirements: [
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
      question: 'Does 1800-LIMO.COM control my schedule or rates?',
      answer: 'No. You set your own availability and rates. You choose which booking opportunities to accept or decline. There are no mandatory hours or surge-pricing controls.'
    },
    {
      question: 'When and how do I get paid?',
      answer: 'Earnings are deposited directly to your account within 3 business days from the date client funds are received. Tips are 100% yours. Taxes, tolls, and other expenses are collected directly from the client.'
    },
    {
      question: 'Is this available outside the US?',
      answer: '1800-LIMO.COM is a global platform with 900+ affiliates worldwide. Availability may vary by region. Check the platform during registration for coverage in your area.'
    }
  ];

  readonly showcaseScreens: ShowcaseScreen[] = [
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
      label: 'My Bookings',
      image: 'assets/images/driver-landing/phone-4.webp',
      imageAlt: 'Driver app bookings list with pending, finalized and paid trips',
      hotspots: true,
      callouts: [
        { side: 'left', y: 18.85, title: 'Push alerts for new bookings', text: 'Every request reaches the driver the moment it lands.', icon: ['M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9', 'M10.3 21a1.94 1.94 0 0 0 3.4 0'], iconClass: ICON_TONE.orange },
        { side: 'right', y: 32.46, title: 'Full trip details', text: 'Passenger, flight number, pickup and drop-off in one card.', icon: ['M21 6H3', 'M15 12H3', 'M17 18H3'], iconClass: ICON_TONE.blue },
        { side: 'left', y: 52.38, title: 'Distance and fare upfront', text: 'Trip total and mileage shown before anyone commits.', icon: ['M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z', 'M12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'], iconClass: ICON_TONE.red },
        { side: 'right', y: 74.41, title: 'Accept, finalize, invoice', text: 'Accept or reject, finalize and pay, then view the invoice.', icon: ['M20 6 9 17l-5-5'], iconClass: ICON_TONE.green }
      ]
    }
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

  ngAfterViewInit(): void {
    const el = this.showcaseRef?.nativeElement;
    if (!el || typeof window === 'undefined') return;

    this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

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

  applyToDrive(): void {
    const digits = this.mobile.replace(/\D/g, '');
    if (digits.length < 7 || digits.length > 15) {
      this.error = 'Please enter a valid mobile number.';
      return;
    }
    this.error = '';
    // TODO: send the app link via SMS once the API endpoint is available.
  }
}
