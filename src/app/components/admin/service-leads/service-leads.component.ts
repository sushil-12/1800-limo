import { Component, OnInit } from '@angular/core';
import { AdminService } from '../../../services/admin.service';
import { NgxSpinnerService } from "ngx-spinner";

@Component({
	selector: 'app-service-leads',
	templateUrl: './service-leads.component.html',
	styleUrls: ['./service-leads.component.scss']
})
export class ServiceLeadsComponent implements OnInit {

	public leadsRes: any;
	public leads: any = [];
	public isLoading: boolean = false;

	public lastPage: number;
	public totalPage: number;
	public currentPage: any;
	public total: number;
	public path: string;
	public firstPageUrl: string;
	public lastPageUrl: string;
	public prevPageUrl: string;
	public nextPageUrl: string;

	constructor(
		private adminService: AdminService,
		private spinner: NgxSpinnerService) { }

	ngOnInit(): void {
		this.loadLeads();
	}

	loadLeads(pageUrl = null) {
		this.isLoading = true;
		this.spinner.show();
		if (pageUrl) {
			document.getElementById('leads_table')?.scrollIntoView({ behavior: 'smooth' });
		}
		this.adminService.serviceLeads(pageUrl).then(result => {
			this.leadsRes = result;
			this.leads = this.leadsRes?.data?.data || [];
			this.lastPage = this.leadsRes?.data?.last_page;
			this.totalPage = this.leadsRes?.data?.last_page;
			this.currentPage = this.leadsRes?.data?.current_page;
			this.total = this.leadsRes?.data?.total;
			this.path = this.leadsRes?.data?.path;
			this.firstPageUrl = this.leadsRes?.data?.first_page_url;
			this.lastPageUrl = this.leadsRes?.data?.last_page_url;
			this.prevPageUrl = this.leadsRes?.data?.prev_page_url;
			this.nextPageUrl = this.leadsRes?.data?.next_page_url;
			this.isLoading = false;
			this.spinner.hide();
		})
			.catch(err => {
				this.isLoading = false;
				this.spinner.hide();
			});
	}

	//for pagination
	counter() {
		var startFrom;
		var endTo;

		if (this.currentPage < 5) {
			startFrom = 0;
			endTo = this.totalPage;
		}
		else if (this.currentPage < this.totalPage) {
			endTo = this.currentPage + 1;
			startFrom = endTo - 5;
		}
		else {
			endTo = this.totalPage;
			startFrom = endTo - 5;
		}

		var udpArr = new Array();
		for (var i = startFrom; i < endTo; i++) {
			udpArr.push(i + 1);
		}
		return udpArr;
	}
}