import { Component, ElementRef, NgZone, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { FormValidators } from 'src/app/utils/form-validators';
import { ActivatedRoute, Router } from '@angular/router';
import * as intlTelInput from 'intl-tel-input';
import { NgxSpinnerService } from 'ngx-spinner';
import { throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AdminService } from 'src/app/services/admin.service';
import { AuthService } from 'src/app/services/auth.service';
import { CustomvalidationService } from 'src/app/services/customvalidation.service';
import { ErrorDialogService } from 'src/app/services/error-dialog/errordialog.service';
import { StateManagementService } from 'src/app/services/statemanagement.service';
import { TravelAgentService } from 'src/app/services/travel-agent.service';
import { CommonService } from '../../../services/common.service';
declare var $: any;

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent implements OnInit, AfterViewInit {
  @ViewChild('search1') search1!: ElementRef;
  geoCoder!: google.maps.Geocoder;
  @ViewChild('mobileInput') mobileInput!: ElementRef;
  @ViewChild('workInput') workInput!: ElementRef;

  public profileForm: FormGroup;
  public submittedForm: boolean;
  confirmedAddress = ''; // last address picked from suggestions or loaded from the server
  public OfficeObject: any;
  public MobileObject: any;
  currentUser: any;
  agency_name: any;
  invite_code: any;
  timezoneForm: FormGroup;

  //google map autocomplete
  title: string = 'AGM project';
  latitude: number;
  longitude: number;
  zoom: number;
  address: string;
  response: any;
  defaultCountryCode: string;
  lastSegment: string;
  activeAddressDropdown: boolean = false;
  addressOptions: any[] = [];
  addressSearchLoading: boolean = false;
  private customPlacesService: google.maps.places.PlacesService | null = null;
  private addressSearchVersion = 0;

  constructor(
    private stateManagementService: StateManagementService,
    private formBuilder: FormBuilder,
    private customValidator: CustomvalidationService,
    private ngZone: NgZone,
    private spinner: NgxSpinnerService,
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService,
    private travelAgentService: TravelAgentService,
    private adminService: AdminService,
    private errors: ErrorDialogService,
    private commonServices: CommonService
  ) { }

  ngOnInit(): void {

    this.currentUser = JSON.parse(localStorage.getItem('currentUser'))
    console.log(this.currentUser)
    this.agency_name = localStorage.getItem('agency_name') ? localStorage.getItem('agency_name') : this.currentUser?.agency_name
    this.invite_code = localStorage.getItem('invite_code')
    this.buildProfileForm()
    this.timezoneForm = this.formBuilder.group({
      timezone: [''],
    });


    if (this.currentUser?.is_profile_complete) {
      this.getProfile()
    }
    else {
      this.profileForm.patchValue({
        mobile: this.currentUser?.phone,
        mobileIsd: this.currentUser?.isd,
        mobileCountry: this.currentUser?.phoneCountry,
        agency_name: this.agency_name
      })
      this.defaultCountryCode = this.currentUser?.phoneCountry;
    }


  }

  ngAfterViewInit() {
    this.initallphonefields()

    //google map autocomplete
    this.geoCoder = new google.maps.Geocoder();
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
    const userCountry = this.currentUser?.phoneCountry || this.currentUser?.country || 'auto';
    const telOptions: any = this.commonServices.getTelInputOptions(userCountry);

    if (this.mobileInput) {
      console.log('onput', this.mobileInput, this.mobileInput.nativeElement)
      this.MobileObject = intlTelInput(this.mobileInput.nativeElement, telOptions);

      this.addCustomCountrySearch(this.mobileInput.nativeElement);

      this.mobileInput.nativeElement.addEventListener('countrychange', () => {
        const countryData = this.MobileObject.getSelectedCountryData();
        console.log("in change", countryData)
        this.onCountryChange(countryData, 'mobile')
      });
      const countryData = this.MobileObject.getSelectedCountryData();
      if (countryData.dialCode) {
        this.profileForm.patchValue({
          mobileIsd: "+" + countryData.dialCode,
          mobileCountry: countryData.iso2
        });
      }
    }

    if (this.workInput) {
      console.log('onput', this.workInput, this.workInput.nativeElement)
      this.OfficeObject = intlTelInput(this.workInput.nativeElement, telOptions);

      this.addCustomCountrySearch(this.workInput.nativeElement);

      this.workInput.nativeElement.addEventListener('countrychange', () => {
        const countryData = this.OfficeObject.getSelectedCountryData();
        console.log("in change", countryData)
        this.onCountryChange(countryData, 'work_contact_number');
      });
      const countryData = this.OfficeObject.getSelectedCountryData();
      if (countryData.dialCode) {
        this.profileForm.patchValue({
          workIsd: "+" + countryData.dialCode,
          workCountry: countryData.iso2
        });
      }
    }

  }

  buildProfileForm() {
    this.profileForm = this.formBuilder.group({
      acc_id: [''],
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
      latitude: [''],
      longitude: [''],
      agency_name: ['', [FormValidators.organization()]],
      invite_code: [this.invite_code]

    });
  }

  get f() {
    return this.profileForm.controls;
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
      this.validateWorkContact();
    }
    // else if (type == 'office_number') {
    //   console.log("333333")
    //   this.profileForm.patchValue({
    //     isd_office_number: '+' + event.dialCode,
    //     office_country_code: event.iso2
    //   });
    // }
    // else {
    //   console.log("4444444")
    //   this.profileForm.patchValue({
    //     faxIsd: '+' + event.dialCode,
    //     faxCountry: event.iso2
    //   });
    // }
    // console.log(this.countryCode);
  }

  telInputObjectOffice(obj) {
    this.OfficeObject = obj;
  }
  telInputObjectMobile(obj) {
    console.log('telInputMobile', obj)
    this.MobileObject = obj;
  }



  getProfile() {
    this.spinner.show();
    this.travelAgentService.getProfileSubAgent()
      .then(({ data }: any) => {
        this.spinner.hide();//hide spinner
        this.timezoneForm.patchValue({
          timezone: data?.timezone
        })
        this.confirmedAddress = data?.address || '';
        this.profileForm.patchValue({
          acc_id: data?.acc_id,
          tp_id: data?.tp_id,
          firstName: data?.first_name,
          middleName: data?.middle_name,
          lastName: data?.last_name,
          work_contact_number: data?.work_contact_number,
          workIsd: data?.workIsd || '+1',
          workCountry: data?.workCountry || 'us',
          mobile: data?.mobile,
          mobileIsd: data?.mobileIsd || '+1',
          mobileCountry: data?.mobileCountry || 'us',
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
          faxIsd: data?.faxIsd || '+1',
          faxCountry: data?.faxCountry || 'us',
          office_number: data?.office_number,
          isd_office_number: data?.isd_office_number || '+1',
          office_country_code: data?.office_country_code || 'us',
          latitude: data?.latitude,
          longitude: data?.longitude,
        })
        console.log('profile data-->>>>', data)
        this.MobileObject.setCountry(data?.mobileCountry)
        this.OfficeObject.setCountry(data?.workCountry);
      }).catch((err) => {
        this.spinner.hide();//hide spinner
        console.log(err)
      })
  }

  submitForm() {
    console.log(this.profileForm);
    this.submittedForm = true;
    // stop here if form is invalid
    if (this.profileForm.invalid) {
      return;
    }

    if (this.MobileObject) {
      const countryData = this.MobileObject.getSelectedCountryData();
      if (countryData.dialCode) {
        this.profileForm.patchValue({
          mobileIsd: "+" + countryData.dialCode,
          mobileCountry: countryData.iso2
        });
      }
    }

    if (this.OfficeObject) {
      const countryData = this.OfficeObject.getSelectedCountryData();
      if (countryData.dialCode) {
        this.profileForm.patchValue({
          workIsd: "+" + countryData.dialCode,
          workCountry: countryData.iso2
        });
      }
    }

    // Sanitize mobile (remove Country Code if present)
    if (this.profileForm.value.mobile && this.profileForm.value.mobileIsd && this.profileForm.value.mobile.startsWith(this.profileForm.value.mobileIsd)) {
      this.profileForm.value.mobile = this.profileForm.value.mobile.substring(this.profileForm.value.mobileIsd.length);
    }


    if (this.profileForm.get('address').value != '' && this.profileForm.get('latitude').value == '') {
      this.errors.openDialog({
        errors: {
          error: `<spanclass="text-danger font-weight-bolder text-xl">Please choose the correct address from the dropdown.</span>`
        }
      })
      return;
    }

    console.log(this.profileForm.value);
    this.spinner.show();

    this.travelAgentService.createNewSubAgent(this.profileForm.value, this.currentUser?.is_profile_complete)
      .pipe(
        catchError(err => {
          this.spinner.hide();//hide spinner
          return throwError(err);
        })
      )
      .subscribe(result => {
        this.response = result;
        this.spinner.hide();//hide spinner
        console.log("profile created", this.response)
        if (!this.currentUser?.is_profile_complete) {
          $("#redirectModal").modal("show");
          setTimeout(() => {
            console.log("in timeout")
            this.spinner.show('logoutspinner')
            $("#redirectModal").modal("hide");
            this.authService.logout()
              .pipe(
                catchError(err => {
                  this.spinner.hide('logoutspinner');//hide spinner
                  return throwError(err);
                })
              ).subscribe(({ success }: any) => {
                this.spinner.hide('logoutspinner');//hide spinner
                if (success == true) {
                  this.stateManagementService.removeUser();
                }
                this.router.navigate(['/']);
              });
          }, 10000)
        }



      });


  }

  redirectToHome() {
    console.log("in function redirect home")
    $("#redirectModal").modal("hide");
    this.spinner.show('logoutspinner')
    this.authService.logout()
      .pipe(
        catchError(err => {
          this.spinner.hide('logoutspinner');//hide spinner
          return throwError(err);
        })
      ).subscribe(({ success }: any) => {
        console.log("in function redirect home")
        this.spinner.hide('logoutspinner');//hide spinner
        if (success == true) {
          this.stateManagementService.removeUser();
        }
        this.router.navigate(['/']);
      })
  }


  resetForm() {
    const keepValues = [
      this.profileForm.controls.mobile.value,
      this.profileForm.controls.id.value,
      this.profileForm.controls.mobileIsd.value,
      this.profileForm.controls.mobileCountry.value,
      this.profileForm.controls.agency_name.value

    ];

    this.buildProfileForm();
    this.profileForm.controls.mobile.patchValue(keepValues[0]);
    this.profileForm.controls.id.patchValue(keepValues[1]);
    this.profileForm.controls.mobileIsd.patchValue(keepValues[2]);
    this.profileForm.controls.mobileCountry.patchValue(keepValues[3]);
    this.profileForm.controls.agency_name.patchValue(keepValues[4])

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  onTimezoneChange(event: any): void {
    const selectedValue = event.value;
    console.log('Selected Timezone:', selectedValue);
    this.adminService
      .changeTimezone(selectedValue)
      .pipe()
      .subscribe((response: any) => {
        console.log(response, 'timezone changed success');
      });

  }
  // backButton()
  // {
  // 	this.router.navigate(['/login/sub_travel_agent']);
  // }

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

  validateWorkContact() {
    this.validatePhoneGeneric(this.profileForm.get('work_contact_number'), this.OfficeObject);
  }


  private addCustomCountrySearch(element: HTMLElement) {
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
  }
}
