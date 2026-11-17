import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild, isDevMode } from '@angular/core';
import { AdminService } from '../../../services/admin.service';
import { Router, ActivatedRoute } from '@angular/router';
import { NgxSpinnerService } from "ngx-spinner";
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { ThemePalette } from '@angular/material/core';
import { FormGroup, FormBuilder, Validators, FormControl } from '@angular/forms';
import { ErrorDialogService } from 'src/app/services/error-dialog/errordialog.service';
import { AffiliateService } from 'src/app/services/affiliate.service';
import { UploadService } from 'src/app/services/upload.service';
import Quill from 'quill';
import { attachPlaceAutocompleteElement, clearPlaceAutocompleteDisplay } from 'src/app/utils/google-place-autocomplete';
declare var $: any;

@Component({
	selector: 'app-affiliate-accounts',
	templateUrl: './affiliate-accounts.component.html',
	styleUrls: ['./affiliate-accounts.component.scss'],
	
})
export class AffiliateAccountsComponent implements OnInit, AfterViewInit, OnDestroy {
	private readonly affiliateSearchStorageKey = 'affiliateSearch';
	private readonly affiliateFilterStorageKey = 'affiliateFilterType';
	private readonly affiliateOperatorStorageKey = 'affiliateOperatorSelect';
	@ViewChild('fileInput') fileInput!: ElementRef;
	@ViewChild('fileInput1') fileInput1!: ElementRef;
	@ViewChild('message') message!: ElementRef;
	@ViewChild('geoNearInput') geoNearInput!: ElementRef<HTMLInputElement>;

	/** Geo ("Near") search: place picked from Google Places + radius in miles. */
	readonly geoRadiusOptions = [25, 50, 100, 250];
	geoRadius = 50;
	geoPlace: {
		label: string;
		lat: number;
		lng: number;
		type: 'state' | 'city' | 'address';
		state: string | null;
		bounds: { ne_lat: number; ne_lng: number; sw_lat: number; sw_lng: number } | null;
	} | null = null;
	/** geo_meta from the API: fallback flag, region / nearby / missing-coordinate counts. */
	geoMeta: any = null;
	emails = new FormControl();
	phone_numbers = new FormControl();
	color: ThemePalette = 'accent';
	checked = false;
	disabled = false;
	show: boolean;
	public paramResponse: any;
	public affiliate_accounts: any;
	public affiliate_accounts_emails: any = [];
	public affiliate_accounts_numbers: any = [];
	public affiliateType: string;
	public heading: string;
	public addButton: string;
	public tree: any;
	public submitted: boolean = false;
	public lastPartUrl: any;
	public rejectCauseForm: FormGroup;
	sendEmailForm: FormGroup;
	public firstPage: Number;
	public lastPage: Number;
	public totalPage: Number;
	public currentPage: any;
	public from: Number;
	public to: Number;
	public path: string;
	public firstPageUrl: string;
	public lastPageUrl: string;
	public prevPageUrl: string;
	public nextPageUrl: string;
	operatorSelect: string;
	filter_type: string
	affiliateName: string;
	stepCompleted: string = '';
	stepCompletedObj: any = <Object>{
		step0: "uncompleted",
		step1: "uncompleted",
		step2: "uncompleted",
		step3: "uncompleted",
		step4: "uncompleted",
		step5: "uncompleted",
		step6: "uncompleted"
	}
	affiliateId: string = '';
	searchText: any = '';
	affiliate_count: any;
	loginAsUserResponse: any;
	allSelected = false;
	audit_Trail: any = [];
	fileUrl: String;
	fileName: String;
	fileType: String;
	uploadedFile: any;
	successMessage: any;
	pages: number[] = [];

    @ViewChild('messageEditor') messageEditor: any;
    private quillMessageInstance: Quill;

	quillModules = {
		toolbar: [
			['bold', 'italic', 'underline', 'strike'],
			[{ 'list': 'ordered' }, { 'list': 'bullet' }],
			[{ 'color': [] }, { 'background': [] }],
			['link'],
			['clean']
		]
	};

	constructor(
		private adminService: AdminService,
		private router: Router,
		private $form: FormBuilder,
		private spinner: NgxSpinnerService,
		private $errors: ErrorDialogService,
		private formBuilder: FormBuilder,
		private uploadService: UploadService,
		private affiliateService: AffiliateService,
		private zone: NgZone,
		private activatedRoute: ActivatedRoute) { }

	ngOnInit(): void {

		this.buildSendEmailForm();
		this.operatorSelect = localStorage.getItem(this.affiliateOperatorStorageKey) || 'all';
		this.filter_type = localStorage.getItem(this.affiliateFilterStorageKey) || 'all';
		this.searchText = localStorage.getItem(this.affiliateSearchStorageKey) || '';

		this.affiliateTypeSwitch(this.operatorSelect)
		sessionStorage.clear()

		this.rejectCauseForm = this.formBuilder.group({
			acc_id: ['', Validators.required],
			reject_cause: ['', Validators.required],
		});

		this.zone.runOutsideAngular(() => {
			document.addEventListener('touchend', this.dismissDropdownsOnTouch, true);
		});

		// this.getEmailList()


	}

	ngAfterViewInit(): void {
		if (typeof google === 'undefined' || !this.geoNearInput?.nativeElement) {
			return;
		}
		void attachPlaceAutocompleteElement(
			this.geoNearInput.nativeElement,
			{},
			(place) => this.zone.run(() => this.onGeoPlaceSelected(place))
		);
	}

	onGeoPlaceSelected(place: google.maps.places.PlaceResult): void {
		const location = place?.geometry?.location;
		if (!location) {
			// Cleared with the widget's own "x" button.
			if (this.geoPlace) {
				this.clearGeoSearch();
			}
			return;
		}

		const types = place.types || [];
		const stateComponent = (place.address_components || []).find((c) =>
			c.types?.includes('administrative_area_level_1')
		);
		const cityTypes = ['locality', 'sublocality', 'postal_town', 'postal_code', 'neighborhood',
			'administrative_area_level_2', 'administrative_area_level_3', 'colloquial_area'];
		let type: 'state' | 'city' | 'address' = 'address';
		if (types.includes('administrative_area_level_1')) {
			type = 'state';
		} else if (types.some((t) => cityTypes.includes(t))) {
			type = 'city';
		}

		const viewport = place.geometry.viewport;
		this.geoPlace = {
			label: place.formatted_address || place.name || '',
			lat: location.lat(),
			lng: location.lng(),
			type,
			state: stateComponent?.short_name || null,
			bounds: viewport
				? {
					ne_lat: viewport.getNorthEast().lat(),
					ne_lng: viewport.getNorthEast().lng(),
					sw_lat: viewport.getSouthWest().lat(),
					sw_lng: viewport.getSouthWest().lng(),
				}
				: null,
		};
		this.loadAffiliateOperators();
	}

	setGeoRadius(radius: number): void {
		this.geoRadius = radius;
		if (this.geoPlace) {
			this.loadAffiliateOperators();
		}
	}

	clearGeoSearch(reload = true): void {
		this.geoPlace = null;
		this.geoMeta = null;
		if (this.geoNearInput?.nativeElement) {
			clearPlaceAutocompleteDisplay(this.geoNearInput.nativeElement);
		}
		if (reload) {
			this.loadAffiliateOperators();
		}
	}

	private geoQueryParams(): Record<string, string | number | null> | undefined {
		if (!this.geoPlace) {
			return undefined;
		}
		const g = this.geoPlace;
		return {
			geo_lat: g.lat,
			geo_lng: g.lng,
			geo_radius: this.geoRadius,
			geo_type: g.type,
			geo_state: g.state,
			geo_ne_lat: g.bounds?.ne_lat ?? null,
			geo_ne_lng: g.bounds?.ne_lng ?? null,
			geo_sw_lat: g.bounds?.sw_lat ?? null,
			geo_sw_lng: g.bounds?.sw_lng ?? null,
		};
	}

	ngOnDestroy(): void {
		clearTimeout(this.timer);
		document.removeEventListener('touchend', this.dismissDropdownsOnTouch, true);
		this.closeTransientPopups();
	}

	/**
	 * Why the row menu eats the first tap.
	 *
	 * Bootstrap only detaches its iOS `mouseover` shims from inside
	 * `_clearMenus`, which is a handler delegated on `document`. Dismissing a
	 * dropdown by tapping empty space on the page does not reach `document` on
	 * iOS — Safari refuses to bubble a click from a <td>, a <div> or whitespace,
	 * none of which it treats as clickable — so `_clearMenus` never runs and the
	 * shims stay attached to <body>'s children for as long as you sit on the
	 * page.
	 *
	 * Those shims are what costs you the first tap: once an ancestor of the
	 * whole app carries a `mouseover` handler, Safari treats the next tap as a
	 * hover-reveal and withholds the click. Tap again and it works. That is why
	 * the symptom is "first click sometimes does nothing" and why "sometimes"
	 * means "any time after you have opened a View menu".
	 *
	 * `touchend` fires no matter what Safari decides to do about the click, so
	 * this closes the menu and strips the shims on the dismissal tap itself.
	 * Bound outside the Angular zone: it runs on every tap and must not drag a
	 * change-detection pass along with it.
	 */
	private dismissDropdownsOnTouch = (event: Event): void => {
		const target = event.target as HTMLElement;
		if (!target || !target.closest) {
			return;
		}
		// Taps on the toggle or inside the menu are Bootstrap's to handle.
		if (target.closest('.dropdown-menu, [data-toggle="dropdown"]')) {
			return;
		}
		if (!document.querySelector('.dropdown-menu.show')) {
			return;
		}
		this.closeActionsDropdown();
	}

	/**
	 * While a dropdown is open on a touch device, Bootstrap 4 attaches no-op
	 * `mouseover` handlers to every direct child of <body> so that taps bubble to
	 * its document-level handlers. It only detaches them from inside
	 * `_clearMenus`, which walks `[data-toggle="dropdown"]` elements that are
	 * still in the DOM. Every action in the row menu navigates away, so Angular
	 * has already destroyed those toggles by then and the handlers are orphaned —
	 * one more set per dropdown used, accumulating for the whole session. iOS
	 * treats an element carrying a `mouseover` handler as hover-first, so taps
	 * inside the app start getting swallowed as hover taps and links stop
	 * responding. Desktop never sees this: the Bootstrap branch is gated on
	 * `'ontouchstart' in document.documentElement`.
	 *
	 * Modal backdrops get the same treatment — a leftover `.modal-backdrop`
	 * without `.show` is transparent but still covers the viewport at z-index
	 * 1040, which kills every link on the page with no visual clue.
	 */
	private closeTransientPopups(): void {
		$('.dropdown-menu.show').removeClass('show').parent().removeClass('show');
		$('[data-toggle="dropdown"]').attr('aria-expanded', 'false');
		$(document.body).children().off('mouseover', null, $.noop);

		$('#rejectCauseModal, #messageModal, #sendEmailModal, #sendsmsModal, #AuditTrailModal, #successModal')
			.modal('hide');
		$('.modal-backdrop').remove();
		$('body').removeClass('modal-open').css('padding-right', '');
	}

	/**
	 * Called before any row-menu action navigates away, so the menu is closed
	 * while its toggle still exists and Bootstrap's own bookkeeping stays sane.
	 */
	private closeActionsDropdown(): void {
		$('.dropdown-menu.show').removeClass('show').parent().removeClass('show');
		$('[data-toggle="dropdown"]').attr('aria-expanded', 'false');
		$(document.body).children().off('mouseover', null, $.noop);
	}

	onMessageEditorCreated(quill: Quill) {
		this.quillMessageInstance = quill;
		
		const selectAllText = () => {
		setTimeout(() => {
			const textLength = quill.getText().trim().length;
			if (textLength > 0) {
			quill.setSelection(0, quill.getLength());
			}
		}, 10);
		};
		
		quill.root.addEventListener('focus', selectAllText);
	}

	adjustTextareaHeight(textarea: HTMLTextAreaElement) {
		textarea.style.height = 'auto';
		textarea.style.height = textarea.scrollHeight + 'px';
	}


	onChangeFilterType(value: string) {
		console.log('Changing Filter Type: ', value)
		this.filter_type = value
		localStorage.setItem(this.affiliateFilterStorageKey, value);
		this.loadAffiliateOperators()
	}
	affiliateTypeSwitch(_affiliateType: string) {
		this.operatorSelect = _affiliateType;
		localStorage.setItem(this.affiliateOperatorStorageKey, _affiliateType);
		switch (_affiliateType) {
			case 'black-limo-operator': {
				this.heading = "Black Car / Limo Accounts";
				this.addButton = "Add Black Car / Limo Account";
				this.affiliateType = 'black_limo_operator';
				this.affiliateName = "Black Car / Limo";
				this.loadAffiliateOperators()
				break;
			}
			case 'fleet-operator': {
				this.heading = "Fleet/Coach Accounts";
				this.addButton = "Add Fleet/Coach Account";
				this.affiliateType = 'fleet_operator';
				this.affiliateName = "Fleet/Coach";
				this.loadAffiliateOperators()
				break;
			}
			case 'taxi-operator': {
				this.heading = "Taxi Accounts";
				this.addButton = "Add Taxi Account";
				this.affiliateType = 'taxi_operator';
				this.affiliateName = "Taxi";
				this.loadAffiliateOperators()
				break;
			}
			case 'gig-operator': {
				this.heading = "Gig Accounts";
				this.addButton = "Add Gig Account";
				this.affiliateType = 'gig_operator';
				this.affiliateName = "Gig";
				this.loadAffiliateOperators()
				break;
			}
			default: {
				this.heading = "All Accounts";
				this.addButton = "Add Affiliate Account";
				this.affiliateType = 'all-operators';
				this.affiliateName = "Affiliate";
				this.loadAffiliateOperators()
				break;
			}
		}
	}

	timer: any
	handleSearchKeyword(text: any) {
		console.log('on change search text-->>', text)
		this.searchText = text || ''
		clearTimeout(this.timer);
		this.timer = setTimeout(() => {
			localStorage.setItem(this.affiliateSearchStorageKey, this.searchText || '')
			// Highlights depend on searchText, so refresh the cached markup here
			// rather than letting the template recompute it every CD pass.
			this.applyRowProjections()
			// this.loadAffiliateOperators()
			// this.getEmailList()
		}, 700)
	}
	handleKeypressEvents() {
		clearTimeout(this.timer)
	}

	reset() {
		clearTimeout(this.timer);
		this.searchText = '';
		this.filter_type = 'all';
		this.operatorSelect = 'all';
		localStorage.removeItem(this.affiliateSearchStorageKey);
		localStorage.removeItem(this.affiliateFilterStorageKey);
		localStorage.removeItem(this.affiliateOperatorStorageKey);
		this.clearGeoSearch(false);
		this.affiliateTypeSwitch('all');
	}

	scroll(id) {
		// let el = document.getElementById(id);
		// let elementRect = el.getBoundingClientRect();
		// let absoluteElementTop = elementRect.top + window.pageYOffset;
		// let topElement = absoluteElementTop - 200;

		// console.log(`scrolling to ${id}`, el , absoluteElementTop ,window.innerHeight);
		// window.scrollTo({
		// 	top: topElement,
		// 	behavior: 'smooth'
		// });

		let el = document.getElementById(id);
		console.log(`scrolling to ${id}`, el);
		el.scrollIntoView({ behavior: 'smooth' });
	}
	handleSearch() {
		localStorage.setItem(this.affiliateSearchStorageKey, this.searchText || '');
		this.loadAffiliateOperators();
	}
	loadAffiliateOperators(pageUrl = null) {
		/** spinner starts on init */
		var keyword = this.searchText?.replace(/&/g, '%26')
		localStorage.setItem(this.affiliateSearchStorageKey, this.searchText || '');
		localStorage.setItem(this.affiliateFilterStorageKey, this.filter_type || 'all');
		localStorage.setItem(this.affiliateOperatorStorageKey, this.operatorSelect || 'all');

		if (pageUrl) {
			console.log("pageurl", pageUrl)
			this.scroll('affiliates_table')
		}
		this.spinner.show();
		// console.log(keyword);
		// Load Our blackCarLimoBus using API
		this.adminService.blackCarLimoBusAccounts(pageUrl, this.affiliateType, this.filter_type, keyword, this.geoQueryParams()).then((result: any) => {
			const affiliateAccounts = result.data.data.map(i => {
				if (i?.LanguagesSpoken) {
					console.log("in language iffff")
					i['readMore'] = (i?.LanguagesSpoken?.length) > 2 ? true : false
				}
				else {
					console.log("in language elase")
					i['readMore'] = false
				}
				return i
			})
			this.affiliate_accounts = this.filterAffiliateAccounts(affiliateAccounts);
			this.affiliate_accounts_emails = this.affiliate_accounts.filter(item => item.Email !== null)
			this.affiliate_accounts_numbers = this.affiliate_accounts.filter(item => item.CellNumber !== null)
			this.affiliate_count = result.data.account_counts;
			this.geoMeta = this.geoPlace ? (result.data.geo_meta || null) : null;
			this.firstPage = 1;
			this.lastPage = result.data.last_page;
			this.totalPage = result.data.last_page;
			this.currentPage = result.data.current_page;
			this.from = result.data.from;
			this.to = result.data.to;
			this.path = result.data.path;
			this.firstPageUrl = result.data.first_page_url;
			this.lastPageUrl = result.data.last_page_url;
			this.prevPageUrl = result.data.prev_page_url;
			this.nextPageUrl = result.data.next_page_url;
			this.applyRowProjections();
			this.pages = this.counter();
			// sessionStorage.setItem('blackCarLimoBus',JSON.stringify(this.blackCarLimoBus));
			this.spinner.hide();//hide spinner
		}).catch((err) => {
			// Without this the full-screen spinner stays up forever when the
			// request is aborted — routine on iPad, where Safari kills in-flight
			// XHRs as soon as the tab is backgrounded.
			console.log('Failed to load affiliate operators: ', err);
			this.spinner.hide();
		})
	}

	/**
	 * Caches everything the row template used to recompute on every change
	 * detection pass.
	 *
	 * `getDriverListItems()` and `counter()` each build a brand-new array (of
	 * brand-new objects) per call, and the template called them from inside
	 * *ngFor. With no stable identity and no trackBy, Angular tore down and
	 * rebuilt every driver button and every pagination link on *every* pass. On
	 * iOS a single tap fires touchstart, touchend, mouseover, mousemove,
	 * mousedown, mouseup and click — zone.js runs change detection after each —
	 * so one tap triggered that rebuild six or seven times. When the node you
	 * touched is replaced between touchstart and the synthesised click, Safari
	 * has nothing left to dispatch to and silently drops the click. That is the
	 * "link does nothing" symptom, and it gets worse the more rows are loaded.
	 *
	 * The highlight markup is cached in the same pass; it was compiling a fresh
	 * RegExp per cell (~12 per row) on every pass as well.
	 */
	private applyRowProjections(): void {
		if (!Array.isArray(this.affiliate_accounts)) {
			return;
		}

		for (const account of this.affiliate_accounts) {
			const cellCountry = account?.CellNumberCountry
				? ' (' + account.CellNumberCountry.toUpperCase() + ')'
				: '';
			account._cellHtml = this.highlighText(
				(account?.CellIsd || '') + (account?.CellNumber || '') + cellCountry
			);
			account._stepHtml = this.highlighTextSteps(account?.at_step_nmae);
			account._affiliateTypeHtml = this.highlighText(account?.AffiliateTypeName);
			account._nameHtml = this.highlighText(
				account?.FirstName + ' ' + (account?.MiddleName ? account?.MiddleName : '') + ' ' + account?.LastName
			);
			account._emailHtml = this.highlighText(account?.Email);
			account._badgeCityHtml = this.highlighText(account?.badge_city_name);
			account._companyHtml = this.highlighText(account?.CompanyName);
			account._dbaHtml = this.highlighText(account?.DBA);
			account._addressHtml = this.highlighText(account?.Address);
			account._languagesShortHtml = this.teset(account?.LanguagesSpoken?.toString().slice(0, 20));
			account._languagesHtml = this.teset(account?.LanguagesSpoken);
			account._vehicleHtml = Array.isArray(account?.vehicles)
				? account.vehicles.map((vehicle: any) => this.teset(vehicle))
				: [];
			account._editLabel = account?.AffiliateType ? this.formatter(account.AffiliateType) : '';
			// Was a hardcoded id repeated on every row (and on other screens) —
			// invalid HTML, and it pointed every menu's aria-labelledby at the
			// first row's toggle.
			account._toggleId = 'affiliateActions' + (account?.id ?? '');

			const drivers = this.getDriverListItems(account?.driver_list);
			drivers.forEach((driver: any) => {
				driver._displayNameHtml = this.highlighText(driver?.displayName);
			});
			account._driverItems = drivers;
		}
	}

	trackByAffiliate(index: number, account: any): any {
		return account?.id ?? index;
	}

	trackByDriver(index: number, driver: any): any {
		return driver?.id ?? index;
	}

	trackByIndex(index: number): number {
		return index;
	}

	private filterAffiliateAccounts(accounts: any[] = []) {
		const searchTerm = this.searchText?.toString().trim().toLowerCase();
		if (!searchTerm) {
			return accounts;
		}

		return accounts.filter((account) =>
			this.getAffiliateSearchValues(account).some((value) =>
				value.toLowerCase().includes(searchTerm)
			)
		);
	}

	private getAffiliateSearchValues(account: any): string[] {
		const fullName = [
			account?.FirstName,
			account?.MiddleName,
			account?.LastName
		].filter(Boolean).join(' ').trim();
		const driverNames = this.getDriverNames(account?.driver_list);
		const phoneNumber = [
			account?.CellIsd,
			account?.CellNumber
		].filter(Boolean).join('');
		const phoneWithCountry = [
			phoneNumber,
			account?.CellNumberCountry ? `(${account.CellNumberCountry.toUpperCase()})` : ''
		].filter(Boolean).join(' ');
		const vehicleTypes = Array.isArray(account?.vehicles) ? account.vehicles.join(' ') : account?.vehicles;
		const languageValues = Array.isArray(account?.LanguagesSpoken)
			? account.LanguagesSpoken.join(' ')
			: account?.LanguagesSpoken;

		return [
			account?.account_approval,
			account?.account_approval?.replace(/[_-]/g, ' '),
			account?.CellIsd,
			account?.CellNumber,
			account?.CellNumberCountry,
			phoneNumber,
			phoneWithCountry,
			account?.at_step,
			account?.at_step_nmae,
			account?.at_step_nmae?.replace(/[_-]/g, ' '),
			account?.status ? 'enabled active true' : 'disabled inactive false',
			account?.AffiliateType,
			account?.AffiliateTypeName,
			fullName,
			driverNames,
			account?.Email,
			account?.badge_city_name,
			account?.CompanyName,
			account?.DBA,
			languageValues,
			account?.Address,
			account?.City,
			account?.State,
			account?.state_name,
			vehicleTypes,
			account?.number_of_vehicles?.toString()
		].filter(Boolean).map((value) => value.toString());
	}

	getDriverNames(driverList: any[] = []): string {
		if (!Array.isArray(driverList) || !driverList.length) {
			return 'N/A';
		}

		return driverList
			.map((driver: any) => [
				driver?.first_name,
				driver?.middle_name,
				driver?.last_name
			].filter(Boolean).join(' ').trim())
			.filter((name: string) => name.length > 0)
			.join(', ') || 'N/A';
	}

	getDriverListItems(driverList: any[] = []): any[] {
		if (!Array.isArray(driverList) || !driverList.length) {
			return [];
		}

		return driverList
			.map((driver: any) => ({
				...driver,
				displayName: [
					driver?.first_name,
					driver?.middle_name,
					driver?.last_name
				].filter(Boolean).join(' ').trim()
			}))
			.filter((driver: any) => driver?.displayName);
	}

	openDriverProfile(driver: any, affiliateAccount: any, event?: Event) {
		event?.preventDefault();
		event?.stopPropagation();

		if (!driver?.id || !affiliateAccount?.id) {
			return;
		}

		sessionStorage.setItem('affiliateId', JSON.stringify(affiliateAccount.id));
		sessionStorage.setItem('affiliateType', affiliateAccount.AffiliateType);
		sessionStorage.setItem('affiliateName', `${affiliateAccount.FirstName || ''} ${affiliateAccount.LastName || ''}`.trim());
		sessionStorage.setItem('affiliateUserData', JSON.stringify(affiliateAccount));
		this.router.navigateByUrl('/RefreshComponent', { skipLocationChange: true }).then(() => {
			this.router.navigate(['/admin/affiliate/step4/add-driver'], { queryParams: { driverId: driver.id } });
		});
	}

	private getSearchRegex() {
		const searchTerm = this.searchText?.toString();
		if (!searchTerm) {
			return null;
		}

		const escapedSearchText = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		return new RegExp(escapedSearchText, 'gi');
	}

	addAffiliateAccountClick() {
		sessionStorage.setItem("affiliateType", this.affiliateType);
		sessionStorage.setItem("stepCompleted", this.stepCompleted);
		sessionStorage.setItem("step_completed_obj", JSON.stringify(this.stepCompletedObj));
		sessionStorage.setItem("affiliateId", this.affiliateId);
		this.router.navigate(['/admin/affiliate/step0']);
	}

	editAffiliateAccount(affiliate_id: number, affiliate_type: string, affiliateUserData) {
		// this.affiliateService.updateStepsArrayLocal(this.response.data.affiliateParmas.step_completed);
		// this.affiliateService.updateStepsCompletedObject(this.response.data.affiliateParmas.step_completed_obj);
		this.closeActionsDropdown();
		sessionStorage.setItem('affiliateId', JSON.stringify(affiliate_id))
		sessionStorage.setItem("affiliateType", affiliate_type);
		sessionStorage.setItem('affiliateName', affiliateUserData.FirstName + ' ' + affiliateUserData.LastName)
		this.router.navigateByUrl('/RefreshComponent', { skipLocationChange: true }).then(() => {
			this.router.navigate(['/admin/affiliate/step1'], { queryParams: { affiliate: affiliate_id } });
		});

	}
	navigateToStep0Inprogress(affiliate_id: number, affiliate_type: string, affiliateUserData) {
		console.log('in function navigate to step 0 in case status in-progesas', affiliateUserData)
		if (affiliateUserData?.account_approval == "in-progress") {
			sessionStorage.setItem('affiliateId', JSON.stringify(affiliate_id))
			sessionStorage.setItem("affiliateType", affiliate_type);
			sessionStorage.setItem('affiliateName', affiliateUserData.FirstName + ' ' + affiliateUserData.LastName)
			this.router.navigateByUrl('/RefreshComponent', { skipLocationChange: true }).then(() => {
				this.router.navigate(['/admin/affiliate/step0'], { queryParams: { affiliate: affiliate_id } });
			});
		}
	}

	viewAffiliateCreditCards(affiliate_id: number) {
		this.closeActionsDropdown();
		this.router.navigate(['/admin/cards'], { queryParams: { accountType: 'blackCarLimoBus', accountId: affiliate_id } });
	}

	acceptAffiliate(acc_id) {
		this.spinner.show();
		// this.disableSubmitButton=true; //disable submit button
		console.log('acc_id', acc_id)

		this.adminService.acceptAffiliate(acc_id)
			.pipe(
				catchError(err => {
					this.spinner.hide();//hide spinner
					return throwError(err);
				})
			)
			.subscribe(({ data, success, message }: any) => {
				if (success == true) {
					this.spinner.hide();//hide spinner
					location.reload()
				}
			});
	}

	get rejectCauseF() {
		return this.rejectCauseForm.controls;
	}

	rejectAffiliateClick(acc_id) {
		this.rejectCauseForm.patchValue({
			acc_id: acc_id
		});
	}

	rejectAffiliate() {
		this.submitted = true;
		console.log(this.rejectCauseForm);
		// stop here if form is invalid
		if (this.rejectCauseForm.invalid) {
			return;
		}

		this.spinner.show();
		// this.disableSubmitButton=true; //disable submit button

		this.adminService.rejectAffiliate(this.rejectCauseForm.value)
			.pipe(
				catchError(err => {
					this.spinner.hide();//hide spinner
					$('#rejectCauseModal').modal('hide');
					return throwError(err);
				})
			)
			.subscribe(({ data, success, message }: any) => {
				if (success == true) {
					this.spinner.hide()
					$('#rejectCauseModal').modal('hide');
					location.reload()
				}
			});
	}
	highlighText(args: string) {
		if (!this.searchText) { return args ? args : "N/A"; }
		if (args) {
			args = args.toString()
			const re = this.getSearchRegex();
			return re ? args.replace(re, '<mark class="font-weight-bold">$&</mark>') : args;
		}

	}

	teset(args: any) {
		if (!this.searchText) { return args?.length > 0 ? args.toString().replaceAll(",", ", ") : "N/A"; }
		if (args) {
			args = args.toString().replaceAll(",", ", ")
			const re = this.getSearchRegex();
			return re ? args.replace(re, '<mark class="font-weight-bold">$&</mark>') : args;
		}

	}

	highlighTextSteps(args: string) {
		if (!this.searchText) { return args ? args.replace("_", " ").toUpperCase() : "N/A"; }
		if (args) {
			args = args.replace("_", " ").toUpperCase()
			const re = this.getSearchRegex();
			return re ? args.replace(re, '<mark class="font-weight-bold">$&</mark>') : args;
		}

	}


	enableDisableClicked(event, id) {
		this.spinner.show();//show spinner
		console.log(event.checked);
		if (event.checked) {
			var status = 'enable';
		}
		else {
			var status = 'disable';
		}
		this.adminService.blackCarLimoBusAccountStatus(id, status)
			.pipe(
				catchError(err => {
					this.spinner.hide();//hide spinner
					return throwError(err);
				})
			).subscribe(result => {

				this.spinner.hide();//hide spinner
			});
	}

	//for pagination
	counter() {
		var currentPage;
		var startFrom;
		var endTo;

		if (this.currentPage as number < 5) {
			startFrom = 0;
			endTo = this.totalPage;
		}
		else if (this.currentPage < this.totalPage) {
			currentPage = this.currentPage
			endTo = currentPage + 1;
			startFrom = endTo - 5;
		}
		else {
			endTo = this.totalPage;
			startFrom = endTo - 5;
		}

		var i;
		var udpArr = new Array();
		for (i = startFrom; i < endTo; i++) {
			udpArr.push(i + 1);
		}
		return udpArr;
	}

	formatter(text: string) {
		return text.replace(/[_|-]/g, ' ')
	}

	messagetype: Record<string, any>
	async sendMessage(type: 'email' | 'sms', affiliate: Object, message: string = null) {
		console.log('Request to send a Message to affiliate id: ', type, affiliate['id'])
		this.messagetype = { type, affiliate }
		$('#messageModal').modal('show')
		$('#messageModal').find('.modal-header').find('h4').text('Contact to Affiliate via ' + type.toUpperCase())
		$('#messageModal').find('.modal-body').find('p#affiliate-details').html(`Affiliate Name: ${affiliate['FirstName']} ${affiliate['LastName']}<br/>Affiliate Email: ${affiliate['Email']}`)
		if (message != null) {
			this.spinner.show()
			let fileData = []
			if (this.uploadedFile) {
				for (let file of this.uploadedFile) {
					let dataS = await this.uploadService.uploadFile(file);
					fileData.push({
						fileUrl: dataS.Location,
						fileType: file.type
					});
				}
			}
			let body = {
				sendContent: message,
				fileData: fileData
			}
			this.adminService.sendAffiliateMessage(type, affiliate['id'], body).subscribe((response: any) => {
				this.spinner.hide()
				this.showSuccessModal(response?.message)
				console.log("response-------->", response)
			}, (err) => {
				this.spinner.hide()
				console.log('Failed to send affiliate message: ', err)
			})

			// Clear file input after success
			this.uploadedFile = null;
			this.fileUrl = null;
			this.fileType = null;
			if (this.fileInput1) {
				this.fileInput1.nativeElement.value = ''; // Reset file input
			}
			if (this.message) {
				this.message.nativeElement.value = ''; // Reset message input
			}

			$("#messageModal").modal("hide");
		}
	}

	/**
	 * Bootstrap 4 does not support two modals being open at once. Showing the
	 * success modal while the form modal is still transitioning out leaves a
	 * second `.modal-backdrop` behind, and a backdrop without `.show` is fully
	 * transparent while still covering the viewport at z-index 1040 — every link
	 * on the page goes dead with nothing on screen to explain it. iPad hits this
	 * far more often because Safari drops the `transitionend` that Bootstrap
	 * waits on before removing a backdrop whenever the tab is suspended.
	 */
	private showSuccessModal(message: string): void {
		this.successMessage = message;
		$('#messageModal, #sendEmailModal, #sendsmsModal').modal('hide');
		// 400ms clears Bootstrap's 300ms modal transition.
		setTimeout(() => {
			$('#successModal').modal('show');
			setTimeout(() => {
				$('#successModal').modal('hide');
				setTimeout(() => this.sweepOrphanedBackdrops(), 500);
			}, 1500);
		}, 400);
	}

	private sweepOrphanedBackdrops(): void {
		if ($('.modal.show').length) {
			return;
		}
		$('.modal-backdrop').remove();
		$('body').removeClass('modal-open').css('padding-right', '');
	}

	get Form() {
		return this.sendEmailForm.controls;
	}

	//build email modal
	buildSendEmailForm() {
		this.sendEmailForm = this.$form.group({
			subject: [''],
			text_message: ['']
		})
	}

	//close email modal
	closeModal() {
		this.fileInput.nativeElement.value = '';
		this.fileInput1.nativeElement.value = '';
		this.message.nativeElement.value = '';
		this.uploadedFile = null
		this.fileUrl = null
		this.fileType = null
		this.sendEmailForm.patchValue({
			subject: "",
			text_message: ''
		})
		this.emails.setValue('');
		this.phone_numbers.setValue('');
		this.show = false
		$("#sendEmailModal").modal("hide");
		$("#sendsmsModal").modal("hide");
	}

	selectAll() {
		if (this.allSelected) {
			this.emails.patchValue('');
		} else {
			const allValues = this.affiliate_accounts_emails.map(option => this.stringifyOption(option));
			this.emails.setValue(allValues);
		}
		this.allSelected = !this.allSelected;
	}

	stringifyOption(option: any): string {
		return JSON.stringify({ id: option.id, email: option.Email });
	}

	selectAllNumbers() {
		if (this.allSelected) {
			this.phone_numbers.patchValue('');
		} else {
			const allValues = this.affiliate_accounts_numbers.map(option => this.stringifyOptionNumber(option));
			this.phone_numbers.setValue(allValues);
		}
		this.allSelected = !this.allSelected;
	}

	stringifyOptionNumber(option: any): string {
		return JSON.stringify({ id: option.id, phoneNumber: (option?.CellIsd + option?.CellNumber) });
	}

	auditTrail(id: any) {
		console.log("In function audit trail", id);
		this.closeActionsDropdown();
		this.spinner.show();
		this.adminService
			.communicationLogs(id)
			.pipe(
				catchError((err) => {
					this.spinner.hide();//hide spinner
					return throwError(err);
				})
			)
			.subscribe((response: any) => {
				this.spinner.hide();
				console.log("audit trail --->>>>>>>>", response);
				this.audit_Trail = response?.data?.logs;
				// $("#AuditTrailModal").modal("hide");
			});
	}

	viewEmailContent(id: any) {
		console.log("In function view email content", id);
		const url = isDevMode() ? `https://1800limoapi.infodevbox.com/log-content/${id}` : `https://api.1800limo.com/log-content/${id}`;
		window.open(url, '_blank');
	}

	convertTextToHtml(text: string): string {
		// Basic conversion of text to HTML
		// Replace newlines with <br> tags
		const escapedText = text
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/\n/g, '<br>');

		return `<p>${escapedText}</p>`;
	}

	//submit email modal
	async sendEmail() {
		this.spinner.show()
		let fileData = []
		if (this.uploadedFile) {
			for (let file of this.uploadedFile) {
				let dataS = await this.uploadService.uploadFile(file);
				fileData.push({
					fileUrl: dataS.Location,
					fileType: file.type
				});
			}
		}
		const textContent = this.sendEmailForm.get('text_message')?.value;
		const htmlContent = this.convertTextToHtml(textContent);
		let body = {
			subject: this.sendEmailForm.get('subject').value,
			message: htmlContent,
			recipents: this.emails.value,
			fileData: fileData
		}
		console.log("body-------->", body)
		this.adminService.sendEmailAffiliate(body).subscribe((response: any) => {
			// this.$errors.openDialog({
			// 	errors: {
			// 		error: `<span class='text-success'>${response.message}</span>`
			// 	}
			// })
			this.spinner.hide()
			this.showSuccessModal(response?.message)
			console.log("response-------->", response)
		}, (err) => {
			this.spinner.hide()
			console.log('Failed to send affiliate email: ', err)
		})

		this.show = false
		this.sendEmailForm.patchValue({
			subject: "",
			text_message: ''
		})
		this.emails.setValue('');

		// Clear file input after success
		this.uploadedFile = null;
		this.fileUrl = null;
		this.fileType = null;
		if (this.fileInput) {
			this.fileInput.nativeElement.value = ''; // Reset file input
		}

		$("#sendEmailModal").modal("hide");
	}

	toggleShowMore(vehinfo: any, check: boolean) {
		console.log('vehInfo', vehinfo, 'check', check)
		this.affiliate_accounts = this.affiliate_accounts.map(i => {
			if (i.id == vehinfo.id) {
				i['readMore'] = check
				console.log('readMore', i?.readMore)
			}
			return i;
		})

	}
	fetchHighestNumber(array: Array<number | string>): number {
		let highest = 0
		for (let i = 0; i < array.length; i++) {
			try {
				if (highest < parseInt((array[i]).toString())) {
					highest = parseInt((array[i]).toString())
				}
			} catch (err) {
				console.log('Error Fetching Highest Number: ', err)
				return
			}
		}
		console.log('Highest: ', highest)
		return highest
	}

	loginAsUser(id) {
		this.closeActionsDropdown();
		this.spinner.show()
		this.adminService.loginAsUser(id).pipe(
			catchError(err => {
				this.spinner.hide()
				return throwError(err);
			})
		).subscribe(response => {
			this.spinner.hide()
			let bkp_a_token = localStorage.getItem('access_token')
			let bkp_crnt_dt = localStorage.getItem('currentUser')
			let bkp_u_dt = localStorage.getItem('userData')
			let bkp_currency_symbol = localStorage.getItem('currencySymbol')
			localStorage.setItem('bkp_currency_symbol', bkp_currency_symbol)
			localStorage.setItem('bkp_a_token', bkp_a_token)
			localStorage.setItem('bkp_crnt_dt', bkp_crnt_dt)
			localStorage.setItem('bkp_u_dt', bkp_u_dt)
			console.log("response", response)
			this.loginAsUserResponse = response
			let QB_redirectUrl = localStorage.getItem('QB_redirectUrl') || ''
			let vehicle_selected = JSON.parse(sessionStorage.getItem('selected_vehicle'))
			localStorage.setItem('currencySymbol', JSON.stringify(this.loginAsUserResponse?.currency?.symbol))
			localStorage.setItem("account_approval", this.loginAsUserResponse.data.affiliateParmas.account_approval);
			localStorage.setItem("recject_cause_message", this.loginAsUserResponse.data.affiliateParmas.recject_cause_message);
			this.affiliateService.updateStepsArrayLocal(this.loginAsUserResponse.data.affiliateParmas.step_completed);
			this.affiliateService.updateStepsCompletedObject(this.loginAsUserResponse.data.affiliateParmas.step_completed_obj);
			localStorage.setItem('access_token', this.loginAsUserResponse.data?.access_token)
			localStorage.setItem('currentUser', JSON.stringify(this.loginAsUserResponse.data?.user))
			switch (this.loginAsUserResponse.data.affiliateParmas.account_approval) {
				case 'accepted': {
					if (QB_redirectUrl == 'true' && vehicle_selected) {
						this.router.navigate([
							'/affiliate/create-new-booking'
						],
							{ queryParams: { affiliate_id: vehicle_selected.affiliate_id, vehicle_id: vehicle_selected.id, new: true } })
					}
					else {
						this.router.navigateByUrl('/affiliate/my-bookings');
					}
					break;
				}
				case 'completed': {
					this.router.navigateByUrl('/affiliate/account-status');
					if (QB_redirectUrl.length) {
						this.$errors.openDialog({
							errors: {
								error: `<span class='text-danger'>Not able to create booking</span>`
							}
						})
					}
					break;
				}
				case 'rejected': {
					this.router.navigateByUrl('/affiliate/account-status');
					break;
				}
				case 'in-progress': {
					let nextStep: number;
					if (this.loginAsUserResponse.data.affiliateParmas.step_completed.length > 0) {//if step 0 is completed
						nextStep = this.fetchHighestNumber(this.loginAsUserResponse.data.affiliateParmas.step_completed);
						if (QB_redirectUrl.length) {
							this.$errors.openDialog({
								errors: {
									error: `<span class='text-danger'>You need to complete registration steps</span>`
								}
							})
						}
						this.router.navigateByUrl('/affiliate/step' + nextStep.toString());
						break;
					}
				}
				default: {
					this.router.navigateByUrl('/affiliate');
					break;
				}
			}
		});
	}

	myUploader(event) {
		// this.loader = true;

		this.uploadedFile = Array.from(event.target.files)
		console.log("file", this.uploadedFile)
		// if (this.uploadedFile) {
		// 	this.fileName = this.uploadedFile['name'];
		// 	this.fileType = this.uploadedFile['type'];
		// 	console.log("file", this.fileName, this.fileType)
		// }
	}

	sendEmailSms() {
		this.spinner.show()
		let body = {
			message: this.sendEmailForm.get('text_message')?.value,
			recipents: this.phone_numbers.value,
		}
		console.log("in sms", body)

		this.adminService.sendSmsAffiliate(body).subscribe((response: any) => {
			this.spinner.hide()
			this.showSuccessModal(response?.message)
			console.log("response-------->", response)
		}, (err) => {
			this.spinner.hide()
			console.log('Failed to send affiliate sms: ', err)
		})

		this.show = false
		this.sendEmailForm.patchValue({
			text_message: ''
		})
		this.phone_numbers.setValue('');

		$("#sendsmsModal").modal("hide");
	}
}
