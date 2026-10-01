import { Component, ElementRef, NgZone, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { FormValidators } from 'src/app/utils/form-validators';
import { ActivatedRoute, Router } from '@angular/router';
import { NgxSpinnerService } from 'ngx-spinner';
import { throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { IndividualService } from '../../../services/individual.service';
import { TravelAgentService } from '../../../services/travel-agent.service';
import * as intlTelInput from 'intl-tel-input';
import { ErrorDialogService } from 'src/app/services/error-dialog/errordialog.service';
import { CommonService } from '../../../services/common.service';
import { attachPlaceAutocompleteElement } from '../../../utils/google-place-autocomplete';

@Component({
  selector: 'app-family-member-account',
  templateUrl: './family-member-account.component.html',
  styleUrls: ['./family-member-account.component.scss']
})
export class FamilyMemberAccountComponent implements OnInit {
  @ViewChild('phoneInput') phoneInput!: ElementRef;
  @ViewChild('search1') search1!: ElementRef;
  geoCoder!: google.maps.Geocoder;

  public addFamilyMemberAccountForm: FormGroup;
  public submittedForm: boolean;
  public disableSubmitButton: boolean = false;
  public response: any;
  public yearOptions: any = [];
  public MobileObject: any;
  clientId: any = null;
  type: any = null;
  // uselogin: boolean = false;

  constructor(
    private individualService: IndividualService,
    private router: Router,
    private spinner: NgxSpinnerService,
    private formBuilder: FormBuilder,
    private $routeurl: ActivatedRoute,
    private ngZone: NgZone,
    private errors: ErrorDialogService,
    private commonServices: CommonService
  ) { }


  //google map autocomplete
  title: string = 'AGM project';
  latitude: number;
  longitude: number;
  zoom: number;
  address: string;
  currentUser: any;

  ngOnInit(): void {
    this.currentUser = JSON.parse(localStorage.getItem('currentUser'))
    this.buildAddIndividualForm();
    this.$routeurl.queryParams.subscribe((params: any) => {
      console.log('params---->>>>>', params)
      this.clientId = params?.id
      if (params && params.type) {
        this.type = params.type
      }
    })
    const currentYear = (new Date()).getFullYear();
    for (let i = 0; i < 40; i++) {
      this.yearOptions.push(currentYear + i);
    }

    if (this.clientId) {
      this.individualService.getAccount(this.clientId)
        .pipe(
          catchError(err => {
            this.spinner.hide();//hide spinner
            return throwError(err);
          })
        ).subscribe(result => {
          this.response = result;

          this.addFamilyMemberAccountForm.patchValue({
            id: this.clientId,
            first_name: this.response.data?.first_name,
            last_name: this.response.data?.last_name,
            phone_number: this.response.data?.phone_number,
            phone_isd: this.response.data?.phone_isd,
            email: this.response.data?.email,
            // address: this.response.data?.address,
            // city: this.response.data?.city,
            // state: this.response.data?.state,
            // country: this.response.data?.country,
            // zipCode: this.response.data.zip,
            // latitude: this.response.data?.latitude,
            // longitude: this.response.data?.longitude,
            // use_for_login: this.response.data?.use_for_login,
            // age: this.response.data?.age,
            // relationship: this.response.data?.relationship,

          });
          // this.uselogin = this.response.data?.use_for_login
          this.spinner.hide();//hide spinner
          this.MobileObject.setCountry(this.response.data.mobileCountry);
        });
    }


  }

  ngAfterViewInit() {
    this.initphonefield()


    this.initautoComplete()


  }

  initphonefield() {

    if (this.phoneInput) {
      const userCountry = this.currentUser?.phoneCountry || this.currentUser?.country || 'auto';
      const telOptions: any = this.commonServices.getTelInputOptions(userCountry);
      this.MobileObject = intlTelInput(this.phoneInput.nativeElement, telOptions);

      this.addCustomCountrySearch(this.phoneInput.nativeElement);

      this.phoneInput.nativeElement.addEventListener('countrychange', () => {
        const countryData = this.MobileObject.getSelectedCountryData();
        console.log("in country chnage", countryData)
        this.onCountryChange(countryData, 'mobile')
        this.validatePhoneNumber();
      });
    }

  }

  initautoComplete() {
    //google map autocomplete
    this.geoCoder = new google.maps.Geocoder();

    void attachPlaceAutocompleteElement(
      this.search1.nativeElement,
      {
        types: ['geocode', 'establishment'],
        fields: ['formatted_address', 'geometry', 'place_id', 'name', 'address_components', 'types'],
        syncControl: this.addFamilyMemberAccountForm.get('address')!,
      },
      (place) => {
        this.ngZone.run(() => {
          if (!place.geometry || !place.geometry.location) return;
          const formattedAddress = place.formatted_address ?? '';
          const placeName = place.name ?? '';
          const displayAddress = placeName ? `${placeName} - ${formattedAddress}` : formattedAddress;

          this.addFamilyMemberAccountForm.patchValue({
            address: displayAddress,
            latitude: place.geometry.location.lat(),
            longitude: place.geometry.location.lng()
          });

          place.address_components?.forEach((component) => {
            const types = component.types;
            if (types.includes('country')) {
              this.addFamilyMemberAccountForm.patchValue({
                country: component.long_name
              });
            } else if (types.includes('administrative_area_level_1')) {
              this.addFamilyMemberAccountForm.patchValue({
                state: component.long_name
              });
            } else if (types.includes('administrative_area_level_3')) {
              this.addFamilyMemberAccountForm.patchValue({
                city: component.long_name
              });
            } else if (types.includes('postal_code')) {
              this.addFamilyMemberAccountForm.patchValue({
                zipCode: component.long_name
              });
            }
          });
        });
      }
    );
  }


  buildAddIndividualForm() {
    this.addFamilyMemberAccountForm = this.formBuilder.group({
      id: [''],
      first_name: ['', [Validators.required, FormValidators.name()]],
      last_name: ['', [Validators.required, FormValidators.name()]],
      phone_number: ['', [Validators.required, Validators.pattern("^[0-9+]*$"), Validators.minLength(4), Validators.maxLength(15), FormValidators.phone()]],
      phone_isd: ['+1', Validators.required],
      mobileCountry: ['us'],
      email: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i), Validators.maxLength(100)]],
      // address: ['', Validators.required],
      // city: [''],
      // state: [''],
      // country: ['', Validators.required],
      // zipCode: ['', Validators.required],
      // latitude: [''],
      // longitude: [''],
      // use_for_login: [false],
      // age: ['', [Validators.required, Validators.pattern("^[0-9+]*$")]],
      // relationship: ['', Validators.required]
    });
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

      // Only validate if the number has at least minimum length to avoid premature validation
      const cleanValue = String(value).replace(/\D/g, ''); // Remove non-digits
      if (cleanValue.length < 4) {
        // Too short to validate with intl-tel-input, let Angular validators handle it
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

  validatePhoneNumber() {
    this.validatePhoneGeneric(this.addFamilyMemberAccountForm.get('phone_number'), this.MobileObject);
  }


  onCountryChange(event, type) {
    console.log("in mobile", event.dialCode, event.iso2)
    this.addFamilyMemberAccountForm.patchValue({
      phone_isd: '+' + event.dialCode,
      mobileCountry: event.iso2
    });

  }

  telInputObjectMobile(obj) {
    this.MobileObject = obj;
  }

  get f() {
    return this.addFamilyMemberAccountForm.controls;
  }

  getFormValidationErrors() {
    const result = [];
    Object.keys(this.addFamilyMemberAccountForm.controls).forEach(key => {
      const controlErrors = this.addFamilyMemberAccountForm.get(key)?.errors;
      if (controlErrors) {
        result.push({
          control: key,
          errors: controlErrors
        });
      }
    });
    return result;
  }

  // handleChangeCheckbox(event) {
  //   this.uselogin = event
  //   this.addFamilyMemberAccountForm.patchValue({
  //     use_for_login: this.uselogin
  //   })
  // }

  submitForm() {
    console.log('=== SUBMIT FORM CALLED ===');
    console.log('Form:', this.addFamilyMemberAccountForm);
    console.log('Form value:', this.addFamilyMemberAccountForm.value);
    console.log('Form valid:', this.addFamilyMemberAccountForm.valid);
    console.log('Form errors:', this.addFamilyMemberAccountForm.errors);

    this.submittedForm = true;

    // Sync Phone Country Data
    if (this.MobileObject) {
      const countryData = this.MobileObject.getSelectedCountryData();
      if (countryData && countryData.dialCode) {
        this.addFamilyMemberAccountForm.patchValue({
          phone_isd: '+' + countryData.dialCode,
          mobileCountry: countryData.iso2
        });
      }
    }

    // Sanitize phone_number (remove Country Code if present)
    const phone = this.addFamilyMemberAccountForm.get('phone_number');
    const phoneIsd = this.addFamilyMemberAccountForm.get('phone_isd');

    console.log('Phone control:', phone);
    console.log('Phone value:', phone?.value);
    console.log('Phone errors:', phone?.errors);
    console.log('Phone valid:', phone?.valid);

    if (phone && phone.value && phoneIsd && phoneIsd.value) {
      const val = String(phone.value);
      const isd = String(phoneIsd.value);
      if (val.startsWith(isd)) {
        phone.setValue(val.substring(isd.length));
      }
    }



    console.log('After clearing - Phone errors:', phone?.errors);
    console.log('After clearing - Form valid:', this.addFamilyMemberAccountForm.valid);
    console.log('After clearing - Form errors:', this.addFamilyMemberAccountForm.errors);

    // stop here if form is invalid
    if (this.addFamilyMemberAccountForm.invalid) {
      console.log('FORM IS INVALID - RETURNING');
      console.log('Invalid controls:', this.getFormValidationErrors());
      return;
    }

    console.log('FORM IS VALID - PROCEEDING TO API CALL');

    // Address validation commented out because address fields are not in use
    // if (this.addFamilyMemberAccountForm.get('address').value != '' && this.addFamilyMemberAccountForm.get('latitude').value == '') {
    //   this.errors.openDialog({
    //     errors: {
    //       error: `<spanclass="text-danger font-weight-bolder text-xl">Please choose the correct address from the dropdown.</span>`
    //     }
    //   })
    //   return;
    // }

    console.log(this.addFamilyMemberAccountForm.value);
    // console.log(JSON.stringify(this.addVehicleRatesForm.value));
    this.spinner.show();
    this.disableSubmitButton = true; //disable submit button
    console.log(this.addFamilyMemberAccountForm.value)
    this.individualService.addAccount(this.addFamilyMemberAccountForm.value, this.clientId)
      .pipe(
        catchError(err => {
          this.spinner.hide();//hide spinner
          this.disableSubmitButton = false; //enable submit button
          return throwError(err);
        })
      )
      .subscribe(result => {
        this.response = result;
        this.spinner.hide();//hide spinner
        this.disableSubmitButton = false; //enable submit button

        this.router.navigate([`/individual/family-members`]);
      });
  }

  resetForm() {
    const keepValues = [
      this.addFamilyMemberAccountForm.controls.phone_number.value,
      this.addFamilyMemberAccountForm.controls.id.value,
      this.addFamilyMemberAccountForm.controls.phone_isd.value,
      this.addFamilyMemberAccountForm.controls.mobileCountry.value,

    ];

    this.buildAddIndividualForm()
    this.addFamilyMemberAccountForm.controls.phone_number.patchValue(keepValues[0]);
    this.addFamilyMemberAccountForm.controls.id.patchValue(keepValues[1]);
    this.addFamilyMemberAccountForm.controls.phone_isd.patchValue(keepValues[2]);
    this.addFamilyMemberAccountForm.controls.mobileCountry.patchValue(keepValues[3]);

    console.log(this.addFamilyMemberAccountForm.value)
  }
  backButton() {
    this.router.navigate([`/individual/family-members`]);
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
