import { Component, OnInit } from '@angular/core';
import { AdminService } from '../../../services/admin.service';
import { Router } from '@angular/router';
import { NgxSpinnerService } from "ngx-spinner";
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { ThemePalette } from '@angular/material/core';
import * as moment from 'moment';

@Component({
  selector: 'app-invoice',
  templateUrl: './invoice.component.html',
  styleUrls: ['./invoice.component.scss']
})
export class InvoiceComponent implements OnInit {

  color: ThemePalette = 'accent';
  checked = false;
  disabled = false;

  public paramResponse: any;
  public invoiceId: string;
  public invoiceRes: any;
  public invoices: any;

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
  public startDate: string;
  public endDate: string;
  outputDateFormat = "YYYY-MM-DD";
  searchText: any = '';
  dateMode: 'all' | 'custom' = 'all';
  audit_Trail: any;


  constructor(
    private adminService: AdminService,
    private router: Router,
    private spinner: NgxSpinnerService) { }

  ngOnInit(): void {

    let date = new Date();
    let timestamp = date.getTime()
    this.startDate = this.adminService.checkCookie('startDate_invoice') ?
      this.adminService.getCookie('startDate_invoice') :
      moment(timestamp).format('YYYY-MM-DD')

    date.setDate(date.getDate() + 7);
    timestamp = date.getTime()
    this.endDate = this.adminService.checkCookie('endDate_invoice') ?
      this.adminService.getCookie('endDate_invoice') :
      moment(timestamp).format('YYYY-MM-DD')

    this.dateMode = this.adminService.getCookie('admin_date_mode_invoice') == 'custom' ? 'custom' : 'all';
    this.searchText = this.adminService.checkCookie('search_invoice') ?
      this.adminService.getCookie('search_invoice')
      : "";
    this.spinner.show();
    this.loadInvoice();//load invoices
  }
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

  loadInvoice(pageUrl = null) {
    /** spinner starts on init */
    if (pageUrl) {
      this.scroll("invoice_admin")
    }
    this.spinner.show()
    console.log('--->>> searchText--->>', this.searchText)
    var keyword = ((document.getElementById("keyword2") as HTMLInputElement).value);
    // console.log(keyword);
    // Load Our invoices using API
    this.adminService.invoiceList(pageUrl, this.startDate, this.endDate, this.dateMode == 'custom', this.searchText).then(result => {
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
  saveCookie(key: string, value: string) {
    this.adminService.setCookie(key, value, 30);
  }

  clicViewInvoice(bookingId) {
    this.router.navigate(['/admin/invoice-summary'], { queryParams: { bookingId: bookingId } });
  }

  highlighText(args: string) {
    let searchText = ((document.getElementById("keyword2") as HTMLInputElement).value);

    if (!searchText) { return args; }
    if (args) {
      args = args.toString()
      const escapedSearchText = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      var re = new RegExp(escapedSearchText, 'gi'); //'gi' for case insensitive and can use 'g' if you want the search to be case sensitive.
      return args.replace(re, '<mark class="font-weight-bold">$&</mark>');
    }
  }

  changeDate(dateType, date) {
    console.log('---------__>>>>>>', dateType, date)
    this[dateType] = date
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
  changeDateMode(mode: 'all' | 'custom') {
    this.dateMode = mode
    this.saveCookie('admin_date_mode_invoice', mode)
    this.loadInvoice();
  }
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
    this.adminService.deleteCookie('admin_date_mode_invoice')
    this.dateMode = 'all'
    this.searchText = "";

    console.log('Reset Successfully. ');
  }

  auditTrail(bookingId: any) {
    console.log('In function audit trail', bookingId)
    this.spinner.show()
    this.adminService.auditTrailInfoInvoice(bookingId)
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
