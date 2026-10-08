import { Component, OnInit } from '@angular/core';
import * as moment from 'moment';
import { AdminService } from 'src/app/services/admin.service';
import { TravelAgentService } from 'src/app/services/travel-agent.service';
import { DatePickerComponent } from '../../shared/date-picker/date-picker.component';
import { NgxSpinnerService } from "ngx-spinner";
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { Router } from '@angular/router';

@Component({
  selector: 'app-invoice-dash',
  templateUrl: './invoice-dash.component.html',
  styleUrls: ['./invoice-dash.component.scss']
})
export class InvoiceDashComponent implements OnInit {
  exampleHeader = DatePickerComponent;
  outputDateFormat = "YYYY-MM-DD";

  public invoices: any = [];
  public startDate: string;
  public endDate: string;
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
  public invoiceRes: any;
  audit_Trail: any;
  searchText: any = '';
  dateMode: 'all' | 'custom' = 'all';
  currentUser: any;

  constructor(private TravelService: TravelAgentService, private adminService: AdminService, private router: Router,
    private spinner: NgxSpinnerService) { }

  ngOnInit(): void {
    this.currentUser = JSON.parse(localStorage.getItem('currentUser'))
    let date = new Date();
    let timestamp = date.getTime()
    //     const options:any = {
    // 		year: 'numeric',
    // 		month: '2-digit',
    // 		day: '2-digit',
    // 	};
    // const localeDateString = date.toLocaleDateString(undefined, options).
    // replace(/(\d+)\/(\d+)\/(\d+)/,'$3-$1-$2');
    // Set Search Filters According to cookies or the intial state
    this.startDate = this.adminService.checkCookie('startDate_invoice') ?
      this.adminService.getCookie('startDate_invoice') :
      moment(timestamp).format('YYYY-MM-DD')

    date.setDate(date.getDate() + 7);
    timestamp = date.getTime()
    this.endDate = this.adminService.checkCookie('endDate_invoice') ?
      this.adminService.getCookie('endDate_invoice') :
      moment(timestamp).format('YYYY-MM-DD')

    this.dateMode = this.adminService.getCookie('date_mode_invoice_ta') == 'custom' ? 'custom' : 'all';
    this.searchText = this.adminService.checkCookie('search_invoice') ?
      this.adminService.getCookie('search_invoice')
      : "";
    this.spinner.show();
    this.loadInvoice();//load invoices

  }


  //set search text filter in invoices
  timer: any
  searchInBookings(search_value: string) {
    this.searchText = search_value
    console.log('--->>>>>', search_value)
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.saveCookie("search_invoice", this.searchText);
      this.loadInvoice()
    }, 700)
  }

  handleKeypressEvents() {
    clearTimeout(this.timer)
  }

  changeDate(dateType, date) {
    console.log('---------__>>>>>>', dateType, date)
    this[dateType] = date
  }

  saveCookie(key: string, value: string) {
    this.adminService.setCookie(key, value, 30);
  }

  textFormatter(text: string) {
    try {
      return text.replace(/[\\\_$]+/g, ' ')
    }
    catch {
      return text
    }
  }

  //view invoice summary
  clicViewInvoice(bookingId) {
    this.router.navigate([`/${this.currentUser?.roleName}/invoice-summary`], { queryParams: { bookingId: bookingId } });
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

  //get invoice list function
  loadInvoice(pageUrl = null) {
    /** spinner starts on init */
    if (pageUrl) {
      this.scroll('invoice_ta')
    }
    this.spinner.show()
    console.log('--->>> searchText--->>', this.searchText)
    var keyword = ((document.getElementById("keyword3") as HTMLInputElement).value);
    // console.log(keyword);
    // Load Our invoices using API
    this.TravelService.invoiceList(pageUrl, this.startDate, this.endDate, this.dateMode == 'custom', keyword).then(result => {
      this.spinner.hide()
      this.invoiceRes = result;
      this.invoices = this.invoiceRes.data.data;

      this.firstPage = 1;
      this.lastPage = this.invoiceRes.data.last_page;
      this.totalPage = this.invoiceRes.data.last_page;
      this.currentPage = this.invoiceRes.data.current_page;
      this.from = this.invoiceRes.data.from;
      this.to = this.invoiceRes.data.to;
      this.path = this.invoiceRes.data.path;
      this.firstPageUrl = this.invoiceRes.data.first_page_url;
      this.lastPageUrl = this.invoiceRes.data.last_page_url;
      this.prevPageUrl = this.invoiceRes.data.prev_page_url;
      this.nextPageUrl = this.invoiceRes.data.next_page_url;
      // sessionStorage.setItem('invoice',JSON.stringify(this.invoice));
      this.spinner.hide();//hide spinner
    })
      .catch(err => {
        this.spinner.hide();//hide spinner
      });
  }

  highlighText(args: string) {
    let searchText = ((document.getElementById("keyword3") as HTMLInputElement).value);

    if (!searchText) { return args; }
    if (args) {
      args = args.toString()
      const escapedSearchText = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      var re = new RegExp(escapedSearchText, 'gi'); //'gi' for case insensitive and can use 'g' if you want the search to be case sensitive.
      return args.replace(re, '<mark class="font-weight-bold">$&</mark>');
    }
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

  //reset the filters for the invoice list
  reset() {
    let date = new Date();
    let timestamp = date.getTime()
    this.startDate = moment(timestamp).format('YYYY-MM-DD')
    date.setDate(date.getDate() + 7);
    timestamp = date.getTime()
    this.endDate = moment(timestamp).format('YYYY-MM-DD')
    this.adminService.deleteCookie('startDate_invoice')
    this.adminService.deleteCookie('endDate_invoice')
    this.adminService.deleteCookie('search_invoice')
    this.adminService.deleteCookie('date_mode_invoice_ta')
    this.dateMode = 'all'
    this.searchText = "";

    console.log('Reset Successfully. ');
  }

  //switch between all invoices and a custom date range
  changeDateMode(mode: 'all' | 'custom') {
    this.dateMode = mode
    this.saveCookie('date_mode_invoice_ta', mode)
    this.loadInvoice();
  }

  auditTrail(bookingId: any) {
    console.log('In function audit trail', bookingId)
    this.spinner.show()
    this.TravelService.auditTrailInfoInvoice(bookingId)
      .pipe(
        catchError((err) => {
          return throwError(err);
        })
      )
      .subscribe((response: any) => {
        this.spinner.hide()
        console.log('audit trail --->>>>>>>>', response)
        this.audit_Trail = response.data
        setTimeout(() => {
          const modalBody = document.querySelector('#AuditTrailModal .modal-body');
          if (modalBody) {
            modalBody.scrollTo({ top: modalBody.scrollHeight, behavior: 'smooth' });
          }
          // Also try the modal container itself if the body isn't the scroller
          const modal = document.querySelector('#AuditTrailModal');
          if (modal) {
            modal.scrollTo({ top: modal.scrollHeight, behavior: 'smooth' });
          }
        }, 500);
        // $("#AuditTrailModal").modal("hide");
      });
  }
}
