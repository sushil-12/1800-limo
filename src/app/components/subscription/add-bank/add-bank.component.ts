import { HttpClient } from '@angular/common/http';
import { Component, ElementRef, EventEmitter, Input, NgZone, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NgxSpinnerService } from 'ngx-spinner';
import { throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { BankCountryForm } from '../../affiliate/step2/bank-country-form';
import { AdminService } from 'src/app/services/admin.service';
import { CustomvalidationService } from 'src/app/services/customvalidation.service';
import { StateManagementService } from 'src/app/services/statemanagement.service';
import { SharedModule } from '../../shared/shared.module';
import { ErrorDialogService } from 'src/app/services/error-dialog/errordialog.service';
import { CommonService } from 'src/app/services/common.service';
import { attachPlaceAutocompleteElement } from '../../../utils/google-place-autocomplete';

@Component({
  selector: 'app-add-bank',
  templateUrl: './add-bank.component.html',
  styleUrls: ['./add-bank.component.scss']
})
export class AddBankComponent implements OnInit {
  @ViewChild('search1') search1!: ElementRef;
  geoCoder!: google.maps.Geocoder;


  public addBankForm: FormGroup;
  public requestAddressChangeForm: FormGroup;
  public submittedForm: boolean;
  public disableSubmitButton: boolean = false;
  public response: any;
  public countryDocumentsArray: any = [];
  public countryOptions: any = [];
  public stateOptions: any = [];
  public stateOptionsAddressChange: any = [];
  public currencyOptions: any = [];
  public currencyOptions_copy: any = [];
  public yearOptions: any = [];
  public id_front_image: string = null;
  public id_back_image: string;
  public id_front_image_id: string;
  public id_back_image_id: string;
  public imageSrc: string;
  public cardToDelete: number;
  public date25YearsBack: string;
  public stripeErrors: Array<Object>;
  public modalImage: string;
  public dobDay: Array<number> = [];
  public dobYear: Array<number> = [];
  public canChangeDocument: Boolean = false;
  public displayMsg: string;
  public alertMessage: string;
  public submittedRequestAddressChangeForm: boolean;
  public disableSubmitRequestAddressChangeButton: boolean = false;
  public showProgressBar: boolean = false;
  public haveEinNo: boolean = true;
  enableSsnField: boolean = false;
  ssn_copy: any;
  ssnErrorMessage: string;
  addressErrorMessage: string;
  dobErrorMessage: string;
  public AddressCheckStripe = ['address', 'street', 'city', 'country']
  public updateType: any;

  @Input() closeTab: EventEmitter<any> = new EventEmitter();
  stepsObj: any;
  filteredOptions: any;
  badgeOptions: any;
  subsciberId: any;
  TaxIdMatch: string;
  is_stripe_added: any;

  /** Which bank fields this country needs (only what Stripe requires there; no SSN outside the US). */
  bank = new BankCountryForm(
    (country) => this.adminService.stripeCountryFields(country),
    () => [this.customValidator.dashValidator(), this.customValidator.plusValidator()],
  );

  constructor(
    private adminService: AdminService,
    private router: Router,
    private formBuilder: FormBuilder,
    private httpClient: HttpClient,
    private spinner: NgxSpinnerService,
    private activatedroute: ActivatedRoute,
    private stateManagementService: StateManagementService,
    private ngZone: NgZone,
    private el: ElementRef,
    private commonServices: CommonService,
    private customValidator: CustomvalidationService,
    private globalFunctions: SharedModule,
    private errordialog: ErrorDialogService,
  ) { }

  ngOnInit(): void {

    this.subsciberId = JSON.parse(localStorage.getItem("currentUser"))?.account_id
    this.is_stripe_added = JSON.parse(localStorage.getItem('is_stripe_account_added'))
    console.log("is stripe", this.is_stripe_added)


    const currentYear = (new Date()).getFullYear();
    //prepare list of days for DOB
    for (let i = 1; i <= 31; i++) {
      this.dobDay.push(i);
    }
    //prepare list of year for DOB
    let year = currentYear - 18;
    let temp = 0;
    while (temp < 60)//max 80 year age
    {
      this.dobYear.push(year);
      year--;
      temp++;
    }
    //add amenity form validation
    this.buildBankForm()

    this.httpClient.get("assets/json/currencyOptions.json").subscribe(data => {
      for (const key in data) {
        this.currencyOptions.push(data[key])
        this.currencyOptions_copy.push(data[key])
      }
      this.currencyOptions.sort((a: any, b: any) => {
        if (a.countryName.toLowerCase() > b.countryName.toLowerCase()) {
          return 1
        }
        else if (a.countryName.toLowerCase() < b.countryName.toLowerCase()) {
          return -1
        }
        else {
          return 0
        }

      })

      this.fillGlobalValue('', 'currency', true)
    })

    this.httpClient.get("assets/json/countryStateList.json").subscribe(data => {
      this.countryOptions = data;
    })
    if (this.subsciberId && this.is_stripe_added) {
      this.getFormData()
    }

  }

  buildBankForm() {
    this.addBankForm = this.formBuilder.group({
      id: [''],//bank id for edit purpose
      acc_id: [this.subsciberId, [Validators.pattern("^[0-9].*$")]],//affiliate account id
      BankName: [''],
      BankAddress: [''],
      AccountHolderFirstName: ['', Validators.required],
      AccountHolderLastName: ['', Validators.required],
      AccountNumber: ['', [Validators.required, this.customValidator.dashValidator(), this.customValidator.plusValidator()]],
      Routing: ['', [Validators.required]],
      AccountType: ['company', Validators.required],
      ssn: ['', [Validators.required, Validators.pattern("^[0-9*]*$"), this.customValidator.dashValidator(), this.customValidator.plusValidator()]],
      haveEin: ['yesEin'],
      ein: ['', []],
      currency: ['', Validators.required],
      currencyShow: [''],
      dobDay: ['', Validators.required],
      dobMonth: ['', Validators.required],
      dobYear: ['', Validators.required],
      id_front_image: ['', Validators.required],
      id_back_image: [''],
      address: ['', Validators.required],
      latitude: ['', Validators.required],
      longitude: ['', Validators.required],
      badge_city: [''],
      badge_city_name: [''],
      street: [''],
      city: [''],
      state: [''],
      country: ['', Validators.required],
      zipCode: [''],
      unit: [''],
      primaryCardType: ['personal'],
      // primaryCardNumber: ['', [Validators.pattern("^[0-9+]*$"), Validators.minLength(14), Validators.maxLength(20), this.customValidator.dashValidator(), this.customValidator.plusValidator()]],
      // primaryCSC: ['', [Validators.pattern("^[0-9+]*$"), Validators.minLength(3), Validators.maxLength(3), this.customValidator.dashValidator(), this.customValidator.plusValidator()]],
      primaryMM: [''],
      primaryYY: [''],
      primaryCardHolderName: ['']
    });
    this.bank.attach(this.addBankForm);
  }
  //google map autocomplete
  latitude: number;
  longitude: number;
  requestLatitude: number;
  requestLongitude: number;

  ngAfterViewInit(): void {
    this.mapFunction()
  }

  mapFunction() {

    //google map autocomplete
    this.geoCoder = new google.maps.Geocoder();

    void attachPlaceAutocompleteElement(
      this.search1.nativeElement,
      {
        types: ['geocode', 'establishment'],
        fields: ['formatted_address', 'geometry', 'place_id', 'name', 'address_components', 'types'],
        syncControl: this.addBankForm.get('address')!,
      },
      (place) => {
        this.ngZone.run(() => {
          if (!place.geometry || !place.geometry.location) return;
          const formattedAddress = place.formatted_address ?? '';
          const placeName = place.name ?? '';
          const displayAddress = placeName ? `${placeName} - ${formattedAddress}` : formattedAddress;

          this.addBankForm.patchValue({
            address: displayAddress,
            latitude: place.geometry.location.lat(),
            longitude: place.geometry.location.lng()
          });

          place.address_components?.forEach((component) => {
            const types = component.types;
            if (types.includes('country')) {
              this.addBankForm.patchValue({
                country: component.short_name
              });
            } else if (types.includes('administrative_area_level_1')) {
              this.addBankForm.patchValue({
                state: component.short_name
              });
            } else if (types.includes('administrative_area_level_3')) {
              this.addBankForm.patchValue({
                city: component.long_name
              });
            } else if (types.includes('postal_code')) {
              this.addBankForm.patchValue({
                zipCode: component.long_name
              });
            }
          });
        });
        this.spinner.hide();
      }
    );

  }

  getFormData() {
    console.log('in function get bank data  agent')
    // const currentUser = JSON.parse(sessionStorage.getItem("affiliateUserData"));
    if (true) {
      this.spinner.show()

      this.adminService.getSubsriberBank(this.subsciberId)
        .pipe(
          catchError(err => {
            // this.stateManagementService.setprogressBar(false);
            this.spinner.hide()
            return throwError(err);
          })
        ).subscribe(result => {
          this.spinner.hide()
          this.response = result;
          //to show stripe errors at the top
          if (this.response.data.stripeDetail.stripe_errors) {
            this.stripeErrors = this.response.data.stripeDetail.stripe_errors;
          }
          //set images and their ID

          this.id_front_image = this.response.data.bankinfo.id_front_image.image;
          this.id_back_image = this.response.data.bankinfo.id_back_image.image;
          this.id_front_image_id = this.response.data.bankinfo.id_front_image.ID;
          this.id_back_image_id = this.response.data.bankinfo.id_back_image.ID;
          //Documents changable or not.
          if (this.response.data.stripeDetail.additional_doc_verification_status == 'unverified') {
            this.canChangeDocument = true;
          }
          else {
            this.canChangeDocument = false;
          }

          this.addBankForm.patchValue({
            id: this.response.data.bankinfo.id,
            BankName: this.response.data.bankinfo.BankName,
            BankAddress: this.response.data.bankinfo.BankAddress,
            AccountHolderFirstName: this.response.data.bankinfo.AccountHolderFirstName,
            AccountHolderLastName: this.response.data.bankinfo.AccountHolderLastName,
            AccountNumber: this.response.data.bankinfo.AccountNumber,
            Routing: this.response.data.bankinfo.Routing,
            AccountType: this.response.data.bankinfo.AccountType,
            currency: this.response.data.bankinfo.currency,
            ssn: this.showOnlyLast4Digit(this.response.data.bankinfo.ssn),
            haveEin: this.response.data.bankinfo.ein ? 'yesEin' : 'noEin',
            ein: this.response.data.bankinfo.ein,
            address: this.response.data.bankinfo.address,
            latitude: this.response.data.bankinfo.latitude,
            longitude: this.response.data.bankinfo.longitude,
            street: this.response.data.bankinfo.street,
            unit: this.response.data.bankinfo.unit,
            city: this.response.data.bankinfo.city,
            state: this.response.data.bankinfo.state,
            country: this.response.data.bankinfo.country,
            zipCode: this.response.data.bankinfo.zipCode,
            dobDay: this.response.data.bankinfo.dobDay,
            dobMonth: this.response.data.bankinfo.dobMonth,
            dobYear: this.response.data.bankinfo.dobYear,
            id_front_image: this.response.data.bankinfo.id_front_image.ID,
            id_back_image: this.response.data.bankinfo.id_back_image.ID,
          });
          this.ssn_copy = this.response?.data?.bankinfo?.ssn
          // if(this.response?.data?.error_fields?.find(val => val?.field == 'ssn')){
          // 	this.ssnErrorMessage = this.response?.data?.error_fields?.find(val => val?.field == 'ssn')?.message
          // 	this.enableSsnField=false
          // 			console.log("in if ssn error",this.enableSsnField)
          // }
          if (this.response?.data?.error_fields?.length > 0) {
            const hasNonEmptyObjects = this.response?.data?.error_fields?.filter(obj => Object.keys(obj).length > 0).length > 0;
            console.log(hasNonEmptyObjects, "hasnonnonono")
            if (!hasNonEmptyObjects) {
              this.enableSsnField = true
            }
            else {

              this.response?.data?.error_fields?.forEach(item => {
                if (item.field == 'ssn') {
                  this.enableSsnField = false
                  this.ssnErrorMessage = 'PLEASE ENTER A VALID SSN / GOVERNMENT ID'
                  console.log('error mesage---->', this.ssnErrorMessage)
                }
                else {
                  this.enableSsnField = true
                }
                if (this.AddressCheckStripe?.includes(item?.field)) {
                  console.log("in if addressssssssss-->")
                  this.addressErrorMessage = 'Please enter a valid address'
                  console.log('error mesage---->', this.addressErrorMessage)
                  // this.enableSsnField = true

                }
                if (item?.field == 'dob') {
                  this.dobErrorMessage = 'Please enter a valid dob'
                  console.log('error mesage---->', this.dobErrorMessage)
                  // this.enableSsnField = true
                }
              })
            }

          }
          else {
            this.enableSsnField = true
          }
          console.log("trueeee===>", this.enableSsnField)
          //to check varificatiom failed tax id error only
          if (this.response?.data?.stripeDetail?.stripe_errors?.find(err => err?.error_code == 'verification_failed_tax_id_match')) {
            this.enableSsnField = false
            this.TaxIdMatch = 'NOTE - Please verify your SSN  number and Buisness/Tax ID number'
          }
          this.currencySelection(this.response.data.bankinfo.currency)
          this.haveEin(this.response.data.bankinfo.ein ? 'yesEin' : 'noEin');
          this.changeCountry(this.response.data.bankinfo.country);//for selected country
          this.stateManagementService.setprogressBar(false);
        });
    }
    else {
      this.canChangeDocument = true;//can add or change documents
      // this.canChangeAddress = true;//can add or change address

      //for selected country
      // this.changeCountry(currentUser.CellNumberCountry.toUpperCase());
      // this.addBankForm.patchValue({
      // 	country: currentUser.CellNumberCountry.toUpperCase(),AccountHolderFirstName: currentUser?.FirstName,
      // 	AccountHolderMiddleName: currentUser?.MiddleName,
      // 	AccountHolderLastName: currentUser?.LastName
      // });
    }

  }


  fillGlobalValue(type: string = '', form_control: string, autofill: boolean = false) {
    let object: any;
    if (autofill) {
      // fetch the phone country in current user logged in from local storage. Default is 'US'
      const current_user = localStorage.getItem('currentUser') ? JSON.parse(localStorage.getItem('currentUser')) : { phoneCountry: 'US' }
      object = this.globalFunctions.ListSearch('find', this.currencyOptions, current_user.phoneCountry, 'currencyCountry')
      console.log(object)
    }
    else {
      object = this.globalFunctions.ListSearch('filter', this.currencyOptions, this.f.currency.value, 'currency')
      object = this.globalFunctions.ListSearch('find', this.currencyOptions, 'us', 'currencyCountry')
    }

    this.SetFormValue(form_control, object['currency'] + '-' + object['currencyCountry'])

    // assign the object value
    if (object) {
      return `${object['countryName']} - ${object['symbol']}`
    }
    else {
      return ''
    }
  }


  changeCountry(selectedCountryCode) {
    let selectedCountryData: any;

    selectedCountryData = this.countryOptions.filter(function (countryOption) {
      return countryOption.countryShortCode == selectedCountryCode;
    });
    if (selectedCountryData) {
      this.stateOptions = selectedCountryData[0].regions;
    }
  }

  handleCurrency(value: any) {
    console.log(value, this.filteredOptions)
    this.currencyOptions = this.currencyOptions_copy.filter((i: any) => i.countryName.toLowerCase().includes(value.toLowerCase()))
  }

  selectCurrency(option: any, isUserInput) {
    console.log('in function selectBadgeCity-->>>', isUserInput)
    if (isUserInput) {
      this.addBankForm.patchValue({
        currency: option.countryName + '-' + option.symbol
      })
      // this.addAffiliateAccountForm.updateValueAndValidity()
    }
  }
  onSelectionChange(event) {
    console.log('event- onSelectionChange>>', event.option.value, event.option.viewValue)
    this.addBankForm.patchValue({
      currency: event.option.value,
      currencyShow: event.option.viewValue
    })
  }
  currencySelection(value) {
    this.currencyOptions_copy.map(i => {
      let concatValue = i.currency + '-' + i.currencyCountry
      if (value == concatValue) {
        console.log('select option-->>', value)
        this.addBankForm.patchValue({
          currencyShow: i.countryName + '-' + i.symbol
        })
      }
    })
  }

  haveEin(haveEinNo) {
    switch (haveEinNo) {
      case 'noEin': {
        this.haveEinNo = false;
        this.addBankForm.patchValue({
          haveEin: false
        })
        break;
      }
      case 'yesEin': {
        this.haveEinNo = true;
        console.log('validation updated')
        this.addBankForm.patchValue({
          haveEin: true
        })
        this.addBankForm.controls['ein'].setValidators([Validators.required])
        this.addBankForm.controls['ein'].updateValueAndValidity()
        break;
      }
    }
  }

  handleBadgeCity(value: any) {
    console.log(value, this.filteredOptions)
    this.filteredOptions = this.badgeOptions.filter((i: any) => i.name.toLowerCase().startsWith(value.toLowerCase()))
  }

  selectBadgeCity(option: any, isUserInput) {
    console.log('in function selectBadgeCity-->>>', isUserInput)
    if (isUserInput) {
      this.addBankForm.patchValue({
        badge_city: option.id
      })
      // this.addAffiliateAccountForm.updateValueAndValidity()
    }

  }
  showOnlyLast4Digit(value) {
    if (value) {
      value = value.toString()
      return '*'.repeat(value.length - 4) + value.slice(-4)
    } else {
      return ''
    }
  }
  get f() {
    return this.addBankForm.controls;
  }

  SetFormValue(form_control: string, value: any) {
    this.addBankForm.get(form_control).setValue(value)
    this.addBankForm.updateValueAndValidity()
  }

  changeRadio(form_control: string, value: any) {
    this.SetFormValue(form_control, value)
    if (value) {
      this.addBankForm.controls['ein'].setValidators([Validators.required])
      this.addBankForm.controls['ein'].updateValueAndValidity()
    }
    else {
      this.addBankForm.controls['ein'].setValidators([])
      this.addBankForm.controls['ein'].updateValueAndValidity()
    }
  }

  changeIdentityCountry(selectedCountryCode) {
    this.httpClient.get("assets/json/stripeDocumentData.json").subscribe((stripeDocumentData: any) => {
      const selectedCountryData = stripeDocumentData.filter(function (eachCountryObj) {
        return eachCountryObj.value[0].value === selectedCountryCode;
      });
      this.countryDocumentsArray = selectedCountryData[0].value[1].value.value;
    })
  }

  showImageInModal(imageUrl) {
    this.modalImage = imageUrl;
    $("#imageModal").addClass("showImage");
    $("#imageModal").removeClass("d-none");
  }

  fetchImageBlob(url, key, id) {
    this.stateManagementService.setprogressBar(true);

    this.adminService.fetchImageBlob(url)
      .pipe(
        catchError(err => {
          this.stateManagementService.setprogressBar(false);
          return throwError(err);
        })
      )
      .subscribe(async ({ data }: any) => {
        this.stateManagementService.setprogressBar(false);
        const response = await fetch(data);
        const imageBlob = await response.blob()
        console.log('imageBlob', imageBlob)
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const img = new Image();
        img.src = URL.createObjectURL(imageBlob);
        console.log('img-->', img)
        img.onload = () => {
          // Rotate the image by 90 degrees (or your desired angle)
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.translate(canvas.width / 2, canvas.height / 2);
          ctx.rotate(Math.PI); // Rotate by 180 degrees
          ctx.drawImage(img, -img.width / 2, -img.height / 2);
          // ctx.drawImage(img, 0, -canvas.width);

          // Convert the canvas to a Blob (JPEG format)
          canvas.toBlob((blob) => {
            console.log(blob);

            this.blobToDataURL(blob, key, id);
            // });
          }, "image/jpeg");
        }
      })
  }

  blobToDataURL(blob: Blob, key, id) {
    var reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onload = () => {
      let dataUrl = reader.result;
      console.log(dataUrl); //DataURL
      this.idCardImageChange1(dataUrl, key, id);
    };
  }

  async idCardImageChange1(dataUrl, imageType, imageId = null) {
    if (!await this.commonServices.handleFile(event)) {
      return;
    }
    this.stateManagementService.setprogressBar(true);
    this.imageSrc = dataUrl;
    this.adminService.uploadVehicleImage(this.imageSrc)
      .pipe(
        catchError(err => {
          this.stateManagementService.setprogressBar(false);
          return throwError(err);
        })
      )
      .subscribe(({ data }: any) => {

        switch (imageType) {
          case 'id_front_image': {
            this.addBankForm.patchValue({
              id_front_image: data.id,
            });
            this.id_front_image = data.image;
            this.id_front_image_id = data.id;
            break;
          }
          case 'id_back_image': {
            this.addBankForm.patchValue({
              id_back_image: data.id,
            });
            this.id_back_image = data.image;
            this.id_back_image_id = data.id;
            break;
          }
          default: {
            break;
          }
        }
        this.stateManagementService.setprogressBar(false);
      });
  }

  async idCardImageChange(event, imageType, imageId = null) {
    if (!await this.commonServices.handleFile(event)) {
      return;
    }
    this.stateManagementService.setprogressBar(true);
    const reader = new FileReader();
    if (event.target.files && event.target.files.length)
      console.log(event.target.files, ">>>>>>>>>>>><<<<<<<<<<", event.target.files.length)
    {
      const [file] = event.target.files;
      reader.readAsDataURL(file);
      reader.onload = () => {
        this.imageSrc = reader.result as string;
        this.adminService.uploadVehicleImage(this.imageSrc)
          .pipe(
            catchError(err => {
              this.stateManagementService.setprogressBar(false);
              return throwError(err);
            })
          )
          .subscribe(({ data }: any) => {
            this.stateManagementService.setprogressBar(false);

            switch (imageType) {
              case 'id_front_image': {
                this.addBankForm.patchValue({
                  id_front_image: data.id,
                });
                this.id_front_image = data.image;
                this.id_front_image_id = data.id;
                break;
              }
              case 'id_back_image': {
                this.addBankForm.patchValue({
                  id_back_image: data.id,
                });
                this.id_back_image = data.image;
                this.id_back_image_id = data.id;
                break;
              }
              default: {
                break;
              }
            }
            // this.stateManagementService.setprogressBar(false);
          });
      };
    }
  }

  deleteImage(id, imageType) {
    switch (imageType) {
      case 'id_front_image': {
        this.addBankForm.patchValue({
          id_front_image: '',
        });
        this.id_front_image = '';
        break;
      }
      case 'id_back_image': {
        this.addBankForm.patchValue({
          id_back_image: '',
        });
        this.id_back_image = '';
        break;
      }
      default: {
        break;
      }
    }
  }
  handleSsnInput(value: any) {

    console.log("prev--->", this.ssn_copy, this.addBankForm.get('ssn').value)
    value.includes("*") ? "" : this.ssn_copy = value
    console.log("after--->", this.ssn_copy)

  }
  removeErrorSsn(value: any, type: string) {
    console.log("TYPE----->", type)
    if (type == 'ssn') {
      this.ssnErrorMessage = ""
    }
    else if (type == 'address') {
      this.addressErrorMessage = ""
    }
    // else if(type == 'dob'){
    // 	console.log("in dobbbbhbbb")
    // 	this.dobErrorMessage = ""
    // }
  }
  removeDobError() {
    console.log("in dobbbbhbbb")
    this.dobErrorMessage = ""
  }
  submitForm() {
    console.log(this.addBankForm);
    // console.log(JSON.stringify(this.addVehicleRatesForm.value));
    this.submittedForm = true;
    // stop here if form is invalid
    if (this.addBankForm.invalid) {
      return;
    }


    if (this.addBankForm.get('address').value != '' && this.addBankForm.get('latitude').value == '') {
      this.errordialog.openDialog({
        errors: {
          error: `<spanclass="text-danger font-weight-bolder text-xl">Please choose the correct address from the dropdown.</span>`
        }
      })
      return;
    }

    this.addBankForm.patchValue({
      ssn: this.ssn_copy
    })
    console.log(this.addBankForm.value);
    // console.log(JSON.stringify(this.addVehicleRatesForm.value));
    this.disableSubmitButton = true;
    if (this.is_stripe_added) {
      this.updateType = 'edit'
    }
    this.spinner.show();
    this.adminService.addSubscriberBank(this.addBankForm.value, this.updateType)
      .pipe(
        catchError(err => {
          this.addBankForm.patchValue({
            ssn: this.showOnlyLast4Digit(this.ssn_copy)
          })
          this.spinner.hide();//hide spinner
          this.disableSubmitButton = false; //enable submit button

          return throwError(err);
        })
      )
      .subscribe(result => {
        this.spinner.hide();//hide spinner
        this.response = result;
        this.disableSubmitButton = false; //enable submit button
        localStorage.setItem("is_stripe_account_added", 'true')
        this.router.navigate(['/admin/vehicle-details'])
      });
  }
  closeButton() {
    this.closeTab.emit();
  }
  resetForm() {
    const keepValues = [
      this.addBankForm.controls.ssn.value,
    ]

    this.buildBankForm();
    this.addBankForm.controls.ssn.patchValue(keepValues[0]);

    this.id_front_image = "";
    this.id_back_image = "";
    window.scrollTo({ top: 0, behavior: 'smooth' });

  }
}
