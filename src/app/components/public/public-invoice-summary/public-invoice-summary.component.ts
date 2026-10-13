import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AdminService } from '../../../services/admin.service';
import { NgxSpinnerModule, NgxSpinnerService } from 'ngx-spinner';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { CommonService } from '../../../services/common.service';
import { ErrorDialogService } from '../../../services/error-dialog/errordialog.service';

@Component({
	selector: 'app-public-invoice-summary',
	templateUrl: './public-invoice-summary.component.html',
	styleUrls: ['./public-invoice-summary.component.scss'],
	standalone: true,
	imports:[CommonModule,NgxSpinnerModule,FormsModule,ReactiveFormsModule,   
		MatFormFieldModule,    
		MatInputModule,        
		MatChipsModule   ]
})
export class PublicInvoiceSummaryComponent implements OnInit {

	bookingId: string | null = null;
	userType: string | null = null;
	token: string | null = null;
	invoiceData: any;
	currencySymbol: string = '';
	errorMessage: string = '';

	constructor(
		private route: ActivatedRoute,
		private router: Router,
		private adminService: AdminService,
		private spinner: NgxSpinnerService,
		private commonService: CommonService,
		private errorDialogService: ErrorDialogService
	) { }

	ngOnInit(): void {
		this.spinner.show();
		this.route.queryParamMap.subscribe((params) => {
			this.bookingId = params.get('bookingId');
			this.userType = params.get('userType');
			this.token = params.get('token');

			// Token must come from the URL only, never from localStorage
			if (!this.token) {
				this.showUnauthorized();
				return;
			}

			if (!this.bookingId) {
				this.errorMessage = 'Missing bookingId.';
				this.spinner.hide();
				return;
			}

			this.commonService.getInvoiceDataWithToken(this.bookingId,this.userType, this.token)
				.pipe(
					catchError(err => {
						if ([401, 403, 440, 488].includes(err?.status)) {
							this.showUnauthorized();
						} else {
							this.errorMessage = err?.error?.message || 'Unable to load invoice. The link may be invalid or expired.';
							this.spinner.hide();
						}
						return throwError(err);
					})
				)
				.subscribe(({ data }: any) => {
					this.invoiceData = data;
					console.log(data,"Rechecking whyyyyyy")
					this.currencySymbol = this.invoiceData?.currency_symbol || '';
					this.spinner.hide();
				});
		});
	}

	private showUnauthorized(): void {
		this.errorMessage = 'Unauthorized. The link is invalid or has expired.';
		this.spinner.hide();
		this.errorDialogService.openDialog({
			errors: { error: 'Unauthorized. The link is invalid or has expired.' }
		});
	}

	printInvoice(): void {
		const printContent = document.getElementById('print-section');
		if (!printContent) {
			alert('Invoice content not found');
			return;
		}

		const windowPrt = window.open('', '', 'left=0,top=0,width=800,height=900,toolbar=0,scrollbars=0,status=0');
		if (!windowPrt) {
			alert('Unable to open print window. Please check your pop-up blocker settings.');
			return;
		}

		windowPrt.document.write('<html><head><title>Invoice</title>');
		windowPrt.document.write('<link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/4.6.0/css/bootstrap.min.css">');
		windowPrt.document.write('<style>body { margin: 0; padding: 20px; }</style>');
		windowPrt.document.write('</head><body>');
		windowPrt.document.write(printContent.innerHTML);
		windowPrt.document.write('</body></html>');
		windowPrt.document.close();
		windowPrt.focus();
		setTimeout(() => {
			windowPrt.print();
		}, 500);
	}

	sendInvoiceToCustomer(): void {
		// Generate a shareable link
		const shareableLink = `${window.location.origin}/public/invoice-summary?bookingId=${this.bookingId}&token=${this.token}`;
		
		// Copy to clipboard
		if (navigator.clipboard) {
			navigator.clipboard.writeText(shareableLink).then(() => {
				alert('Invoice link copied to clipboard!');
			}).catch(err => {
				console.error('Failed to copy link:', err);
				this.fallbackCopyTextToClipboard(shareableLink);
			});
		} else {
			this.fallbackCopyTextToClipboard(shareableLink);
		}
	}

	private fallbackCopyTextToClipboard(text: string): void {
		const textArea = document.createElement('textarea');
		textArea.value = text;
		textArea.style.top = '0';
		textArea.style.left = '0';
		textArea.style.position = 'fixed';
		document.body.appendChild(textArea);
		textArea.focus();
		textArea.select();
		try {
			document.execCommand('copy');
			alert('Invoice link copied to clipboard!');
		} catch (err) {
			console.error('Fallback: Could not copy text', err);
		}
		document.body.removeChild(textArea);
	}
}