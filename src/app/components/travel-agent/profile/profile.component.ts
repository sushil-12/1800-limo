import { Component, ElementRef, EventEmitter, Input, NgZone, OnInit, ViewChild } from '@angular/core';
import { TravelAgentService } from '../../../services/travel-agent.service';
import { StateManagementService } from '../../../services/statemanagement.service';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { FormValidators } from 'src/app/utils/form-validators';
import { CustomvalidationService } from '../../../services/customvalidation.service';
import { NgxSpinnerService } from 'ngx-spinner';
import { ActivatedRoute, Router } from '@angular/router';
import { AffiliateService } from '../../../services/affiliate.service';
import { AuthService } from '../../../services/auth.service';
import { ErrorDialogService } from '../../../services/error-dialog/errordialog.service';
import { CommonService } from '../../../services/common.service';
import * as intlTelInput from 'intl-tel-input';
import * as moment from "moment";
import { MomentDateAdapter, MAT_MOMENT_DATE_ADAPTER_OPTIONS } from '@angular/material-moment-adapter';
import { DateAdapter, MAT_DATE_FORMATS, MAT_DATE_LOCALE } from '@angular/material/core';

declare var $: any;

export const MY_FORMATS = {
  parse: {
    dateInput: 'MM/YYYY',
  },
  display: {
    dateInput: 'MM/YYYY',
    monthYearLabel: 'MMM YYYY',
    dateA11yLabel: 'LL',
    monthYearA11yLabel: 'MMMM YYYY',
  },
};


@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
  providers: [
    {
      provide: DateAdapter,
      useClass: MomentDateAdapter,
      deps: [MAT_DATE_LOCALE, MAT_MOMENT_DATE_ADAPTER_OPTIONS],
    },
    { provide: MAT_DATE_FORMATS, useValue: MY_FORMATS },
  ],
})
export class ProfileComponent implements OnInit {
  @ViewChild('search1') search1!: ElementRef;
  geoCoder!: google.maps.Geocoder;
  @ViewChild('cellInput') cellInput!: ElementRef;
  @ViewChild('mobileInput') mobileInput!: ElementRef;
  @ViewChild('faxInput') faxInput!: ElementRef;
  @ViewChild('officeNumberInput') officeNumberInput!: ElementRef;

  // timezone=new FormControl('')
  public profile_pic: any;
  public modalImage: string;
  public imageSrc: string;
  public phoneObject: any;
  public profileForm: FormGroup;
  @Input() closeTab: EventEmitter<any> = new EventEmitter();
  public submittedForm: boolean; public yearOptions: any = [];
  confirmedAddress = ''; // last address picked from suggestions or loaded from the server
  public OfficeObject: any;
  public MobileObject: any;
  public FaxObject: any;
  public OfficePhoneObject: any;
  public currentUser: any = JSON.parse(localStorage.getItem('currentUser'))

  //google map autocomplete
  title: string = 'AGM project';
  latitude: number;
  longitude: number;
  zoom: number;
  address: string;
  response: any;
  defaultCountryCode: string;
  lastSegment: string;
  accountStatus: any;
  activeAddressDropdown: boolean = false;
  addressOptions: any[] = [];
  addressSearchLoading: boolean = false;
  private customPlacesService: google.maps.places.PlacesService | null = null;
  private addressSearchVersion = 0;

  constructor(
    private affiliateService: AffiliateService,
    private stateManagementService: StateManagementService,
    private formBuilder: FormBuilder,
    private customValidator: CustomvalidationService,
    private ngZone: NgZone,
    private spinner: NgxSpinnerService,
    private router: Router,
    private commonServices: CommonService,
    private route: ActivatedRoute,
    private travelAgentService: TravelAgentService,
    private authService: AuthService,
    private errorDialog: ErrorDialogService,
  ) { }

  ngOnInit(): void {
    this.accountStatus = localStorage.getItem('agentAccountStatus')
    if (this.accountStatus == 'rejected') {
      this.errorDialog.openDialog({
        errors: {
          error: `Your account is being rejected by admin. Currently we are logging you out. Please contact admin!`
        }
      })
      setTimeout(() => {
        console.log("in timeout")
        // this.spinner.show('logoutspinner')
        this.authService.logout()
          .pipe(
            catchError(err => {
              // this.spinner.hide('logoutspinner');//hide spinner
              return throwError(err);
            })
          ).subscribe(({ success }: any) => {
            // this.spinner.hide('logoutspinner');//hide spinner
            if (success == true) {
              this.stateManagementService.removeUser();
            }
            this.router.navigate(['/']);
          });
      }, 15000)
    }
    //  else if(this.accountStatus == 'pending'){
    //     this.errorDialog.openDialog({
    //       errors: {
    //         error: `Please wait! As your account status is ${this.accountStatus} from admin.`
    //       }
    //     }) 
    //   }
    this.route.url.subscribe(segments => {
      // The "step" part is in the last segment
      const lastSegment = segments[segments.length - 1];
      this.lastSegment = lastSegment.path;
      console.log(`Step: ${this.lastSegment}`);
    });
    const currentYear = (new Date()).getFullYear();
    for (let i = 0; i < 40; i++) {
      this.yearOptions.push(currentYear + i);
    }
    this.buildProfileForm();



    this.stateManagementService.setprogressBar(false);//hide progressbar
    if (this.currentUser?.is_profile_complete) {
      this.getProfileData()
    }
    else {
      // this.profileForm.get('name')?.setValidators([Validators.required]);
      // this.profileForm.get('number')?.setValidators([Validators.required, Validators.pattern("^[0-9\\s]*$"), Validators.minLength(14), Validators.maxLength(20), this.customValidator.dashValidator(), this.customValidator.plusValidator()]);
      // this.profileForm.get('exp_month')?.setValidators([Validators.required]);
      // this.profileForm.get('exp_year')?.setValidators([Validators.required]);
      // this.profileForm.get('cvc')?.setValidators([Validators.required, Validators.pattern("^[0-9+]*$"), Validators.minLength(3), Validators.maxLength(4), this.customValidator.dashValidator(), this.customValidator.plusValidator()]);

      // this.profileForm.get('name')?.updateValueAndValidity();
      // this.profileForm.get('number')?.updateValueAndValidity();
      // this.profileForm.get('exp_year')?.updateValueAndValidity();
      // this.profileForm.get('exp_month')?.updateValueAndValidity();
      // this.profileForm.get('cvc')?.updateValueAndValidity();
      this.profileForm.patchValue({
        mobile: this.currentUser?.phone,
        mobileIsd: this.currentUser?.isd,
        mobileCountry: this.currentUser?.phoneCountry,
        workIsd: this.currentUser?.isd,
        workCountry: this.currentUser?.phoneCountry,
        faxIsd: this.currentUser?.isd,
        faxCountry: this.currentUser?.phoneCountry,
        isd_office_number: this.currentUser?.isd,
        office_country_code: this.currentUser?.phoneCountry
      })
      this.defaultCountryCode = this.currentUser?.phoneCountry;
    }

  }



  ngAfterViewInit() {

    this.ngZone.runOutsideAngular(() => {
      setTimeout(() => {
        this.initallphonefields()
        this.geoCoder = new google.maps.Geocoder();
      }, 500);
    });


  }

  private getGoogleMapsApiKey(): string {
    const script = Array.from(document.querySelectorAll('script[src]')).find((item) =>
      item.getAttribute('src')?.includes('maps.googleapis.com/maps/api/js')
    );
    const src = script?.getAttribute('src') || '';
    try {
      return new URL(src).searchParams.get('key') || '';
    } catch {
      return '';
    }
  }

  private getCustomPlacesService(): google.maps.places.PlacesService | null {
    if (this.customPlacesService) {
      return this.customPlacesService;
    }
    if (!(window as any)?.google?.maps?.places?.PlacesService) {
      return null;
    }
    const container = document.createElement('div');
    container.style.display = 'none';
    document.body.appendChild(container);
    this.customPlacesService = new google.maps.places.PlacesService(container);
    return this.customPlacesService;
  }

  private getPredictionTextValue(value: any): string {
    if (!value) return '';
    if (typeof value === 'string') return value;
    return value?.text || value?.plainText || value?.stringValue || value?.text?.text || '';
  }

  private searchGooglePredictions(searchText: string): Promise<Array<any>> {
    const apiKey = this.getGoogleMapsApiKey();
    if (!apiKey || !String(searchText || '').trim()) {
      return Promise.resolve([]);
    }

    return fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'suggestions.placePrediction.placeId,suggestions.placePrediction.text.text,suggestions.placePrediction.structuredFormat.mainText.text,suggestions.placePrediction.structuredFormat.secondaryText.text'
      },
      body: JSON.stringify({
        input: searchText,
        includeQueryPredictions: false,
        languageCode: 'en-US'
      })
    })
      .then((response) => response.ok ? response.json() : Promise.resolve({ suggestions: [] }))
      .then((response: any) => {
        const suggestions = Array.isArray(response?.suggestions) ? response.suggestions : [];
        return suggestions
          .map((suggestion: any) => suggestion?.placePrediction)
          .filter((prediction: any) => !!prediction?.placeId)
          .map((prediction: any) => ({
            placeId: prediction.placeId,
            name: this.getPredictionTextValue(prediction?.structuredFormat?.mainText)
              || this.getPredictionTextValue(prediction?.text)?.split(',')[0]?.trim()
              || this.getPredictionTextValue(prediction?.text),
            secondaryText: this.getPredictionTextValue(prediction?.structuredFormat?.secondaryText),
            description: this.getPredictionTextValue(prediction?.text)
          }))
          .slice(0, 8);
      })
      .catch(() => []);
  }

  private fetchPlaceDetails(placeId: string): Promise<google.maps.places.PlaceResult | null> {
    const service = this.getCustomPlacesService();
    if (!service || !placeId) {
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      service.getDetails({
        placeId,
        fields: ['formatted_address', 'geometry', 'place_id', 'name', 'address_components', 'types']
      }, (place, status) => {
        if (status !== google.maps.places.PlacesServiceStatus.OK || !place) {
          resolve(null);
          return;
        }
        resolve(place);
      });
    });
  }

  private applySelectedAddress(place: google.maps.places.PlaceResult): void {
    if (!place.geometry?.location) return;

    const lat = place.geometry.location.lat();
    const lng = place.geometry.location.lng();
    const formattedAddress = place.formatted_address ?? '';
    const placeName = place.name ?? '';
    const displayAddress = placeName ? `${placeName} - ${formattedAddress}` : formattedAddress;
    this.confirmedAddress = displayAddress;
    const patch: any = {
      address: displayAddress,
      latitude: lat,
      longitude: lng,
      city: '',
      state: '',
      country: '',
      zip: ''
    };

    place.address_components?.forEach((component) => {
      const types = component.types || [];
      if (types.includes('locality') || types.includes('postal_town') || types.includes('administrative_area_level_3')) {
        if (!patch.city) patch.city = component.long_name;
      }
      if (types.includes('administrative_area_level_1')) {
        patch.state = component.long_name;
      }
      if (types.includes('country')) {
        patch.country = component.long_name;
      }
      if (types.includes('postal_code')) {
        patch.zip = component.long_name;
      }
    });

    this.profileForm.patchValue(patch);
    this.profileForm.updateValueAndValidity();
  }

  initallphonefields() {
    let countryCode = 'auto';
    if (this.defaultCountryCode) {
      countryCode = this.defaultCountryCode;
    } else if (this.currentUser && (this.currentUser.phoneCountry || this.currentUser.country)) {
      countryCode = this.currentUser.phoneCountry || this.currentUser.country;
    }

    console.log('---initallphonefields running outside angular---');
    const telOptions: any = this.commonServices.getTelInputOptions(countryCode);

    if (this.cellInput) {
      console.log('onput', this.cellInput, this.cellInput.nativeElement)
      this.OfficeObject = intlTelInput(this.cellInput.nativeElement, telOptions);

      // Check if form has value, set it
      const existingCountry = this.profileForm.get('workCountry')?.value;
      if (existingCountry) {
        this.OfficeObject.setCountry(existingCountry);
      }

      this.addCustomCountrySearch(this.cellInput.nativeElement);
      this.cellInput.nativeElement.addEventListener('countrychange', () => {
        this.ngZone.run(() => {
          const countryData = this.OfficeObject.getSelectedCountryData();
          console.log("in change", countryData)
          this.onCountryChange(countryData, 'work_contact_number')
        });
      });
    }

    if (this.mobileInput) {
      console.log('onput', this.mobileInput, this.mobileInput.nativeElement)
      this.MobileObject = intlTelInput(this.mobileInput.nativeElement, telOptions);

      const existingCountry = this.profileForm.get('mobileCountry')?.value;
      if (existingCountry) {
        this.MobileObject.setCountry(existingCountry);
      }

      this.addCustomCountrySearch(this.mobileInput.nativeElement);
      this.mobileInput.nativeElement.addEventListener('countrychange', () => {
        this.ngZone.run(() => {
          const countryData = this.MobileObject.getSelectedCountryData();
          console.log("in change", countryData)
          this.onCountryChange(countryData, 'mobile');
        });
      });
    }

    if (this.faxInput) {
      console.log('onput', this.faxInput, this.faxInput.nativeElement)
      this.FaxObject = intlTelInput(this.faxInput.nativeElement, telOptions);

      // Check if form has value for faxCountry
      const existingCountry = this.profileForm.get('faxCountry')?.value;
      const existingIsd = this.profileForm.get('faxIsd')?.value;

      if (existingCountry) {
        this.FaxObject.setCountry(existingCountry);
      } else if (!existingIsd) {
        // Only if NO country AND NO ISD, sync default
        const countryData = this.FaxObject.getSelectedCountryData();
        if (countryData?.dialCode) {
          this.profileForm.patchValue({ faxIsd: '+' + countryData.dialCode });
        }
      }

      this.addCustomCountrySearch(this.faxInput.nativeElement);
      this.faxInput.nativeElement.addEventListener('countrychange', () => {
        this.ngZone.run(() => {
          const countryData = this.FaxObject.getSelectedCountryData();
          console.log("in change", countryData)
          this.onCountryChange(countryData, 'fax')
        });
      });
    }

    if (this.officeNumberInput) {
      console.log('onput', this.officeNumberInput, this.officeNumberInput.nativeElement)
      this.OfficePhoneObject = intlTelInput(this.officeNumberInput.nativeElement, telOptions);

      // Check if form has value for office_country_code
      const existingCountry = this.profileForm.get('office_country_code')?.value;
      const existingIsd = this.profileForm.get('isd_office_number')?.value;

      if (existingCountry) {
        this.OfficePhoneObject.setCountry(existingCountry);
      } else if (!existingIsd) {
        // Only if NO country AND NO ISD, sync default
        const countryData = this.OfficePhoneObject.getSelectedCountryData();
        if (countryData?.dialCode) {
          this.profileForm.patchValue({ isd_office_number: '+' + countryData.dialCode });
        }
      }

      this.addCustomCountrySearch(this.officeNumberInput.nativeElement);
      this.officeNumberInput.nativeElement.addEventListener('countrychange', () => {
        this.ngZone.run(() => {
          const countryData = this.OfficePhoneObject.getSelectedCountryData();
          console.log("in change", countryData)
          this.onCountryChange(countryData, 'office_number')
        });
      });
    }
  }

  buildProfileForm() {
    this.profileForm = this.formBuilder.group({
      acc_id: [''],
      tp_id: [''],
      firstName: ['', [Validators.required, FormValidators.name()]],
      middleName: ['', [FormValidators.name()]],
      lastName: ['', [Validators.required, FormValidators.name()]],
      work_contact_number: ['', [FormValidators.phone()]],
      workIsd: [this.currentUser?.isd || '+1', Validators.required],
      workCountry: [this.currentUser?.phoneCountry || 'us'],
      mobile: ['', [Validators.required, Validators.pattern("^[0-9+]*$"), Validators.minLength(4), Validators.maxLength(15), FormValidators.phone()]],
      mobileIsd: [this.currentUser?.isd || '+1', Validators.required],
      mobileCountry: [this.currentUser?.phoneCountry || 'us'],
      email: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i), Validators.maxLength(100)]],
      address: ['', [Validators.required, FormValidators.address(), FormValidators.addressSelected(() => this.confirmedAddress)]],
      city: [''],
      state: [''],
      country: ['', [Validators.required, FormValidators.country()]],
      zip: ['', [Validators.required, FormValidators.zip()]],
      agency_name: ['', [Validators.required, FormValidators.organization()]],
      payee: ['', [Validators.required, FormValidators.organization()]],
      iata: ['', [Validators.required, FormValidators.iata()]],
      fax: ['', [Validators.pattern("^[0-9+]*$"), Validators.minLength(4), Validators.maxLength(15), FormValidators.phone()]],
      faxIsd: [this.currentUser?.isd || '+1', Validators.required],
      faxCountry: [this.currentUser?.phoneCountry || 'us'],
      office_number: ['', [Validators.required, Validators.pattern("^[0-9+]*$"), Validators.minLength(4), Validators.maxLength(15), FormValidators.phone()]],
      isd_office_number: [this.currentUser?.isd || '+1', Validators.required],
      office_country_code: [this.currentUser?.phoneCountry || 'us'],
      latitude: [''],
      longitude: [''],
      card_type: ['personal', Validators.required],
      number: ['', [Validators.pattern("^[0-9]*$"), Validators.minLength(14), Validators.maxLength(20), this.customValidator.dashValidator()]],
      cvc: ['', [Validators.pattern("^[0-9]*$"), Validators.minLength(3), Validators.maxLength(4), this.customValidator.dashValidator()]],
      exp_month: [''],
      exp_year: [''],
      name: ['', [FormValidators.name()]],
      timezone: ['']
    });
  }
  get f() {
    return this.profileForm.controls;
  }

  getProfileData() {
    this.travelAgentService.getProfileDetail()
      .pipe(
        catchError(err => {
          this.stateManagementService.setprogressBar(false);//hide progressbar
          return throwError(err);
        })
      ).subscribe(({ data }: any) => {
        this.stateManagementService.setprogressBar(false);//hide progressbar
        this.profile_pic = data?.profile_pic;
        this.confirmedAddress = data?.address || '';
        this.profileForm.patchValue({
          acc_id: data?.acc_id,
          tp_id: data?.tp_id,
          firstName: data?.first_name,
          middleName: data?.middle_name,
          lastName: data?.last_name,
          work_contact_number: data?.work_contact_number,
          workIsd: data?.workIsd || this.currentUser?.isd || '+1',
          workCountry: data?.workCountry || this.currentUser?.phoneCountry || 'us',
          mobile: data?.mobile,
          mobileIsd: data?.mobileIsd || this.currentUser?.isd || '+1',
          mobileCountry: data?.mobileCountry || this.currentUser?.phoneCountry || 'us',
          email: data?.email,
          address: data?.address,
          city: data?.city,
          state: data?.state,
          country: data?.country,
          zip: data?.zip,
          agency_name: data?.agency_name,
          payee: data?.payee,
          iata: data?.iata,
          fax: data?.fax,
          faxIsd: data?.faxIsd || this.currentUser?.isd || '+1',
          faxCountry: data?.faxCountry || this.currentUser?.phoneCountry || 'us',
          office_number: data?.office_number,
          isd_office_number: data?.isd_office_number || this.currentUser?.isd || '+1',
          office_country_code: data?.office_country_code || this.currentUser?.phoneCountry || 'us',
          latitude: data?.latitude,
          longitude: data?.longitude,
        })
        console.log('profile data-->>>>', data)
        if (this.MobileObject) {
          if (data?.mobileCountry) {
            this.MobileObject.setCountry(data.mobileCountry)
          } else if (data?.mobileIsd && data?.mobile) {
            this.MobileObject.setNumber(data.mobileIsd + data.mobile);
            // setNumber might update the input val to full Int format, reset to just number
            this.profileForm.patchValue({ mobile: data.mobile });
          }
        }
        if (this.OfficeObject) {
          if (data?.workCountry) {
            this.OfficeObject.setCountry(data.workCountry);
          } else if (data?.workIsd && data?.work_contact_number) {
            this.OfficeObject.setNumber(data.workIsd + data.work_contact_number);
            this.profileForm.patchValue({ work_contact_number: data.work_contact_number });
          }
        }
        if (this.FaxObject) {
          if (data?.faxCountry) {
            this.FaxObject.setCountry(data.faxCountry);
          } else if (data?.faxIsd && data?.fax) {
            // Deduce flag from ISD+Number
            this.FaxObject.setNumber(data.faxIsd + data.fax);
            // Reset input to just number (National format typically desired in form control)
            this.profileForm.patchValue({ fax: data.fax });
          }
        }
        if (this.OfficePhoneObject) {
          if (data?.office_country_code) {
            this.OfficePhoneObject.setCountry(data.office_country_code);
          } else if (data?.isd_office_number && data?.office_number) {
            this.OfficePhoneObject.setNumber(data.isd_office_number + data.office_number);
            this.profileForm.patchValue({ office_number: data.office_number });
          }
        }
      });
  }
  onCountryChange(event, type) {
    if (type == 'mobile') {
      console.log("11111", event)
      this.profileForm.patchValue({
        mobileIsd: '+' + event.dialCode,
        mobileCountry: event.iso2
      });
      this.profileForm.get('mobile').updateValueAndValidity();
      this.validateMobile();
    }
    else if (type == 'work_contact_number') {
      console.log("222222")
      this.profileForm.patchValue({
        workIsd: '+' + event.dialCode,
        workCountry: event.iso2
      });
      this.profileForm.get('work_contact_number').updateValueAndValidity();
      this.validateWork();
    }
    else if (type == 'office_number') {
      console.log("333333")
      this.profileForm.patchValue({
        isd_office_number: '+' + event.dialCode,
        office_country_code: event.iso2
      });
      this.profileForm.get('office_number').updateValueAndValidity();
      this.validateOfficeNumber();
    }
    else {
      console.log("4444444")
      this.profileForm.patchValue({
        faxIsd: '+' + event.dialCode,
        faxCountry: event.iso2
      });
    }
    // console.log(this.countryCode);
  }

  numberOnly(event: any): boolean {
    const charCode = (event.which) ? event.which : event.keyCode;
    // Allow: backspace, delete, tab, escape, enter, + symbol (43)
    if (charCode === 43) {
      return true;
    }
    if (charCode > 31 && (charCode < 48 || charCode > 57)) {
      return false;
    }
    return true;
  }

  validatePhoneGeneric(control: any, telInputObject: any) {
    if (telInputObject) {
      const value = control.value;
      if (!value) {
        if (control.errors) {
          const { invalidIntl, ...otherErrors } = control.errors;
          control.setErrors(Object.keys(otherErrors).length > 0 ? otherErrors : null);
        }
        return;
      }
      const isValid = telInputObject.isValidNumber();
      if (!isValid) {
        const errorCode = telInputObject.getValidationError();
        const errorMsg = ["Invalid phone number", "Invalid country code", "Invalid phone number", "Invalid phone number", "Invalid phone number"][errorCode] || "Invalid phone number";
        const currentErrors = control.errors || {};
        control.setErrors({ ...currentErrors, 'invalidIntl': errorMsg });
      } else {
        if (control.errors) {
          const { invalidIntl, ...otherErrors } = control.errors;
          control.setErrors(Object.keys(otherErrors).length > 0 ? otherErrors : null);
        }
      }
    }
  }

  validateMobile() {
    this.validatePhoneGeneric(this.profileForm.get('mobile'), this.MobileObject);
  }

  validateWork() {
    this.validatePhoneGeneric(this.profileForm.get('work_contact_number'), this.OfficeObject);
  }

  validateFax() {
    this.validatePhoneGeneric(this.profileForm.get('fax'), this.FaxObject);
  }

  validateOfficeNumber() {
    this.validatePhoneGeneric(this.profileForm.get('office_number'), this.OfficePhoneObject);
  }

  clearAddressField(): void {
    this.profileForm.patchValue({
      address: '',
      city: '',
      state: '',
      country: '',
      zip: '',
      latitude: '',
      longitude: ''
    });
    this.profileForm.updateValueAndValidity();
    this.addressOptions = [];
    this.addressSearchLoading = false;
    this.activeAddressDropdown = false;
  }

  onAddressFocus(input?: HTMLInputElement): void {
    input?.select();
    this.activeAddressDropdown = true;
    void this.searchAddressOptions(this.profileForm.get('address')?.value || '');
  }

  onAddressBlur(): void {
    setTimeout(() => {
      this.activeAddressDropdown = false;
    }, 150);
  }

  onAddressInput(value: string): void {
    this.profileForm.patchValue({
      address: value || '',
      latitude: '',
      longitude: ''
    }, { emitEvent: false });
    this.profileForm.get('latitude')?.updateValueAndValidity({ emitEvent: false });
    this.profileForm.get('longitude')?.updateValueAndValidity({ emitEvent: false });
    this.activeAddressDropdown = true;
    void this.searchAddressOptions(value || '');
  }

  getAddressOptionLabel(option: any): string {
    return String(option?.name || option?.description || '').trim();
  }

  getAddressOptionSecondary(option: any): string {
    return String(option?.secondaryText || '').trim();
  }

  shouldShowAddressPrompt(): boolean {
    return this.activeAddressDropdown && !String(this.profileForm.get('address')?.value || '').trim() && !this.addressSearchLoading;
  }

  shouldShowAddressEmpty(): boolean {
    return this.activeAddressDropdown && !!String(this.profileForm.get('address')?.value || '').trim() && !this.addressSearchLoading && !this.addressOptions.length;
  }

  private async searchAddressOptions(value: string): Promise<void> {
    const requestVersion = ++this.addressSearchVersion;
    const searchText = String(value || '').trim();
    if (!searchText) {
      if (requestVersion === this.addressSearchVersion) {
        this.addressSearchLoading = false;
        this.addressOptions = [];
      }
      return;
    }

    this.addressSearchLoading = true;
    const options = await this.searchGooglePredictions(searchText);
    if (requestVersion === this.addressSearchVersion) {
      this.addressOptions = options;
      this.addressSearchLoading = false;
    }
  }

  async selectAddressOption(option: any): Promise<void> {
    const place = await this.fetchPlaceDetails(option?.placeId);
    this.ngZone.run(() => {
      if (place) {
        this.applySelectedAddress(place);
      }
      this.activeAddressDropdown = false;
    });
  }

  telInputObjectOffice(obj) {
    this.OfficeObject = obj;
  }
  telInputObjectMobile(obj) {
    console.log('telInputMobile', obj)
    this.MobileObject = obj;
  }
  telInputObjectFax(obj) {
    this.FaxObject = obj;
  }
  telInputObjectOfficePhone(obj) {
    this.OfficePhoneObject = obj;
  }
  closeButton() {
    this.closeTab.emit();
  }
  showImageInModal(imageUrl) {
    this.modalImage = imageUrl;
    // console.log("11111",imageUrl)
    $("#imageModal").addClass("showImage");
    $("#imageModal").removeClass("d-none");
    // $("#imageModal").show();
  }
  fillAddress(form_control: string, address: any) {
    console.log('Address: ', address)
    this.profileForm.patchValue({
      address: address.formatted_address
    })
  }

  profile_pic_change(event) {
    console.log('in function upload profile pic')
    this.stateManagementService.setprogressBar(true);//show progressbar
    const reader = new FileReader();
    if (event.target.files && event.target.files.length) {
      const [file] = event.target.files;
      reader.readAsDataURL(file);
      reader.onload = () => {
        this.imageSrc = reader.result as string;
        this.travelAgentService.uploadProfilePicture(this.imageSrc)
          .pipe(
            catchError(err => {
              this.stateManagementService.setprogressBar(false);//hide progressbar
              return throwError(err);
            })
          )
          .subscribe(({ data, message }: any) => {
            this.profile_pic = data.image;
            let userInfo = JSON.parse(localStorage.getItem('userData'))
            if (userInfo) {
              userInfo['profile_picture'] = data?.image
              localStorage.setItem('userData', JSON.stringify(userInfo))
            }
            this.stateManagementService.setprogressBar(false);//hide progressbar
            // this.snackbarMsg = message;
            // this.openSnackbar();
            // window.location.reload()
          });
      };
    }
  }
  submit() {
    console.log(this.profileForm);
    // console.log(JSON.stringify(this.addVehicleRatesForm.value));
    this.submittedForm = true;
    // stop here if form is invalid
    if (this.profileForm.invalid) {
      return;
    }

    // Sanitize fax (remove Country Code if present)
    // Force sync from visual widgets to ensure payload matches UI
    if (this.FaxObject) {
      const countryData = this.FaxObject.getSelectedCountryData();
      if (countryData.dialCode) {
        this.profileForm.value.faxIsd = '+' + countryData.dialCode;
        this.profileForm.value.faxCountry = countryData.iso2;
      }
    }
    if (this.OfficeObject) { // work_contact_number
      const countryData = this.OfficeObject.getSelectedCountryData();
      if (countryData.dialCode) {
        this.profileForm.value.workIsd = '+' + countryData.dialCode;
        this.profileForm.value.workCountry = countryData.iso2;
      }
    }
    if (this.OfficePhoneObject) { // office_number
      const countryData = this.OfficePhoneObject.getSelectedCountryData();
      if (countryData.dialCode) {
        this.profileForm.value.isd_office_number = '+' + countryData.dialCode;
        this.profileForm.value.office_country_code = countryData.iso2;
      }
    }
    if (this.MobileObject) { // mobile
      const countryData = this.MobileObject.getSelectedCountryData();
      if (countryData.dialCode) {
        this.profileForm.value.mobileIsd = '+' + countryData.dialCode;
        this.profileForm.value.mobileCountry = countryData.iso2;
      }
    }

    if (this.profileForm.value.fax && this.profileForm.value.faxIsd && this.profileForm.value.fax.startsWith(this.profileForm.value.faxIsd)) {
      this.profileForm.value.fax = this.profileForm.value.fax.substring(this.profileForm.value.faxIsd.length);
    }

    // Sanitize mobile (remove Country Code if present)
    if (this.profileForm.value.mobile && this.profileForm.value.mobileIsd && this.profileForm.value.mobile.startsWith(this.profileForm.value.mobileIsd)) {
      this.profileForm.value.mobile = this.profileForm.value.mobile.substring(this.profileForm.value.mobileIsd.length);
    }


    if (this.profileForm.get('address').value != '' && this.profileForm.get('latitude').value == '') {
      this.errorDialog.openDialog({
        errors: {
          error: `<spanclass="text-danger font-weight-bolder text-xl">Please choose the correct address from the dropdown.</span>`
        }
      })
      return;
    }

    console.log(this.profileForm.value);
    // console.log(JSON.stringify(this.addVehicleRatesForm.value));
    this.spinner.show();

    this.travelAgentService.updateProfile(this.profileForm.value, this.currentUser?.is_profile_complete)
      .pipe(
        catchError(err => {
          this.spinner.hide();//hide spinner
          return throwError(err);
        })
      )
      .subscribe(result => {
        this.response = result;
        this.spinner.hide();//hide spinner
        const currentUser = JSON.parse(localStorage.getItem('currentUser'))
        if (this.response?.data?.is_profile_complete) {
          currentUser['is_profile_complete'] = true
          currentUser['name'] = this.response?.data?.first_name + ' ' + this.response?.data?.last_name
          currentUser['account_id'] = this.response?.data?.acc_id
          localStorage.setItem('currentUser', JSON.stringify(currentUser))
          if (this.lastSegment == 'step1') {
            this.router.navigateByUrl('/travel_agent/profile/step2').then(() => {
              window.location.reload();
            });

          }
          else {
            window.location.reload()
          }
        }

      });
  }



  private addCustomCountrySearch(element: HTMLElement) {
    this.ngZone.runOutsideAngular(() => {
      element.addEventListener('open:countrydropdown', () => {
        const container = element.closest('.iti');
        const dropdown = container?.querySelector('.iti__country-list');
        if (!dropdown) return;

        // Check if search already exists
        if (dropdown.querySelector('.iti-search-input')) return;

        // Create search container
        const searchContainer = document.createElement('div');
        searchContainer.className = 'iti-search-container';

        // Create search input
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.className = 'iti-search-input';
        searchInput.placeholder = 'Search country...';

        searchContainer.appendChild(searchInput);

        // Prevent dropdown from closing when interacting with search
        searchInput.addEventListener('click', (e) => e.stopPropagation());
        searchInput.addEventListener('keydown', (e) => e.stopPropagation());

        // Insert at top of dropdown
        dropdown.insertBefore(searchContainer, dropdown.firstChild);

        // Focus on search
        setTimeout(() => searchInput.focus(), 100);

        // Filter countries on input
        searchInput.addEventListener('input', (e: any) => {
          e.stopPropagation();
          const searchTerm = e.target.value.toLowerCase();
          const countries = dropdown.querySelectorAll('.iti__country');
          let hasVisible = false;

          countries.forEach((country: any) => {
            // Search in the full text (Name + Dial Code)
            const text = country.textContent?.toLowerCase() || '';

            if (text.includes(searchTerm)) {
              country.classList.remove('iti__hide');
              country.style.display = 'block'; // Force show
              hasVisible = true;
            } else {
              country.classList.add('iti__hide');
              country.style.display = 'none'; // Force hide
            }
          });

          // Handle No Results
          let noResults = dropdown.querySelector('.iti-no-results');
          if (!noResults) {
            noResults = document.createElement('div');
            noResults.className = 'iti-no-results';
            noResults.textContent = 'No results found';
            dropdown.appendChild(noResults);
          }

          if (!hasVisible && searchTerm) {
            (noResults as HTMLElement).style.display = 'block';
          } else {
            (noResults as HTMLElement).style.display = 'none';
          }

          // Show all if search is empty
          if (!searchTerm) {
            countries.forEach((country: any) => {
              country.classList.remove('iti__hide');
              country.style.display = 'block';
            });
            (noResults as HTMLElement).style.display = 'none';
          }
        });
      });
    });
  }

  // Month-Year Picker Logic
  expiryDateControl = new FormControl(moment());

  chosenYearHandler(normalizedYear: moment.Moment) {
    const ctrlValue = this.expiryDateControl.value || moment();
    ctrlValue.year(normalizedYear.year());
    this.expiryDateControl.setValue(ctrlValue);
  }

  chosenMonthHandler(normalizedMonth: moment.Moment, datepicker: any) {
    const ctrlValue = this.expiryDateControl.value || moment();
    ctrlValue.month(normalizedMonth.month());
    ctrlValue.year(normalizedMonth.year());
    this.expiryDateControl.setValue(ctrlValue);

    // Patch Form Values
    const monthStr = (normalizedMonth.month() + 1).toString().padStart(2, '0');
    const yearStr = normalizedMonth.year();

    this.profileForm.patchValue({
      exp_month: monthStr,
      exp_year: yearStr
    });

    // Mark as dirty/touched for validation display
    this.profileForm.get('exp_month').markAsDirty();
    this.profileForm.get('exp_year').markAsDirty();

    datepicker.close();
  }
}
