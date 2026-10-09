import { Component, OnInit, AfterViewInit, ElementRef } from '@angular/core';
import { AdminService } from '../../../services/admin.service';
import { ActivatedRoute, Router, NavigationEnd } from '@angular/router';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { ErrorDialogService } from 'src/app/services/error-dialog/errordialog.service';
import { NgxSpinnerService } from 'ngx-spinner';
declare var $: any;


@Component({
	selector: 'app-affiliate-steps-template',
	templateUrl: './affiliate-steps-template.component.html',
	styleUrls: ['./affiliate-steps-template.component.scss']
})
export class AffiliateStepsTemplateComponent implements OnInit {

	public currentUser: any;
	public stepCompleted: Array<any>;
	public stepCompletedObj: any;
	public affiliateAccountStatus: string;
	public currentStep: any;
	public secondPartUrl: string;
	public step0: string;
	public step1: string;
	public step2: string;
	public step3: string;
	public step4: string;
	public step5: string;
	public step6: string;
	tree: any;
	public errors: object;
	public response: any;
	affiliateId: string;
	stepsObj: string;
	affiliateName: any;
	// true when step statuses couldn't be loaded, so every step is shown red
	stepsLoadFailed = false;

	constructor(
		private router: Router,
		private adminService: AdminService,
		private errordialog: ErrorDialogService,
		private activatedRoute: ActivatedRoute,
	) { }

	ngOnInit() {
		this.currentStep = this.router.url.includes('step')
			? this.router.url.substring(this.router.url.indexOf('step')).split('?')[0]
			: 'step0';
		console.log('[affiliate-steps] ngOnInit initial currentStep', this.currentStep);
		this.stepCompletionTick();

		this.router.events.subscribe((event) => {
			if (event instanceof NavigationEnd) {
				this.currentStep = this.router.url.substring(this.router.url.indexOf('step')).split('?')[0];
				console.log('[affiliate-steps] NavigationEnd currentStep', this.currentStep, 'url', this.router.url);
				this.stepCompletionTick();
			}
		});

		this.activatedRoute.queryParams.subscribe(params => {
			this.currentStep = this.router.url.substring(this.router.url.indexOf('step')).split('?')[0];
			console.log('[affiliate-steps] queryParams', params, 'resolved currentStep', this.currentStep);

			if (params['affiliate']) {
				this.affiliateId = params['affiliate'];
				sessionStorage.setItem('affiliateId', this.affiliateId);
			} else {
				this.affiliateId = sessionStorage.getItem('affiliateId');
			}

			if (this.affiliateId) {
				this.adminService.getStepsCompleted(this.affiliateId)
					.pipe(
						catchError(err => {
							return throwError(err);
						})
					).subscribe({
						next: (response: any) => {
							const responseData = response?.data ?? response;
							this.stepsLoadFailed = !responseData;
							if (responseData) {
								const stepCompleted = Array.isArray(responseData.step_completed) ? responseData.step_completed : [];
								const stepCompletedObj = this.mergeWithCompletedSteps(responseData.step_completed_obj, stepCompleted);
								console.group('[affiliate-steps] API response');
								console.log('affiliateId', this.affiliateId);
								console.log('step_completed', stepCompleted);
								console.log('step_completed_obj raw', responseData.step_completed_obj);
								console.log('step_completed_obj merged', stepCompletedObj);
								console.groupEnd();
								this.affiliateAccountStatus = responseData.account_approval;
								this.stepCompleted = stepCompleted;
								this.stepCompletedObj = stepCompletedObj;
								this.adminService.updateStepsArrayLocal(stepCompleted);
								this.adminService.updateStepsCompletedObj(stepCompletedObj);
							}
							this.stepCompletionTick();
						},
						error: (error: any) => {
							console.error('[affiliate-steps] getStepsCompleted subscribe error', error);
							this.stepsLoadFailed = true;
							this.stepCompletionTick();
						}
					});
			} else {
				const stepsObjStr = sessionStorage.getItem('step_completed_obj');
				if (stepsObjStr) {
					try {
						this.stepsObj = JSON.parse(stepsObjStr);
						const localStepArray = JSON.parse(sessionStorage.getItem('steps-completed') || '[]');
						this.stepCompleted = Array.isArray(localStepArray) ? localStepArray : [];
						this.stepCompletedObj = this.mergeWithCompletedSteps(this.stepsObj, this.stepCompleted);
						this.stepsLoadFailed = false;
						console.group('[affiliate-steps] session fallback');
						console.log('step_completed from session', this.stepCompleted);
						console.log('step_completed_obj from session raw', this.stepsObj);
						console.log('step_completed_obj from session merged', this.stepCompletedObj);
						console.groupEnd();
					} catch (error) {
						console.error('[affiliate-steps] invalid step data in session', error);
						this.stepsLoadFailed = true;
					}
				}
				this.stepCompletionTick();
			}
		});
	}

	private mergeWithCompletedSteps(stepCompletedObj: any, stepCompleted: any[] = []) {
		const mergedSteps = { ...(stepCompletedObj || {}) };
		// keep 'error' from the API (unverified emails in step1, stripe issues in step2)
		const markCompleted = (step: string) => {
			if (step !== null && step !== undefined && step !== '' && !this.isErrorState(mergedSteps[`step${step}`])) {
				mergedSteps[`step${step}`] = 'completed';
			}
		};
		stepCompleted.forEach(markCompleted);
		const localStepValue = sessionStorage.getItem('stepCompleted');
		const localSteps = localStepValue ? localStepValue.split(',') : [];
		localSteps.forEach(markCompleted);
		console.log('[affiliate-steps] mergeWithCompletedSteps', {
			stepCompletedObj,
			stepCompleted,
			localSteps,
			mergedSteps
		});
		return mergedSteps;
	}

	private isErrorState(state: any): boolean {
		return !!state && !['completed', 'done', 'uncompleted'].includes(state);
	}

	private getStepState(stepKey: string): string {
		const rawStepState = this.stepCompletedObj?.[stepKey] || 'uncompleted';
		// anything other than a known good/pending state ('error', 'failed', 'rejected', ...) shows red
		if (this.isErrorState(rawStepState)) {
			return 'error';
		}
		return this.isStepCompleted(stepKey) ? 'completed' : 'uncompleted';
	}

	private isStepCompleted(stepKey: string): boolean {
		const rawState = this.stepCompletedObj?.[stepKey];
		if (rawState === 'completed' || rawState === 'done') {
			return true;
		}

		const stepIndex = stepKey.replace('step', '');
		return Array.isArray(this.stepCompleted) && this.stepCompleted.includes(stepIndex);
	}

	getAffiliateName() {
		this.affiliateName = sessionStorage.getItem('affiliateName') || ""
	}

	stepCompletionTick() {
		const steps = ['step0', 'step1', 'step2', 'step3', 'step4', 'step5', 'step6'];
		steps.forEach(step => {
			const stepState = this.stepsLoadFailed ? 'error' : this.getStepState(step);
			this[step] = `md-step ${stepState}${this.currentStep == step ? ' active' : ''}`;
		});
		console.group('[affiliate-steps] stepCompletionTick result');
		console.log('currentStep', this.currentStep);
		console.log('stepCompleted', this.stepCompleted);
		console.log('stepCompletedObj', this.stepCompletedObj);
		console.log('classes', {
			step0: this.step0,
			step1: this.step1,
			step2: this.step2,
			step3: this.step3,
			step4: this.step4,
			step5: this.step5,
			step6: this.step6
		});
		console.groupEnd();
		this.getAffiliateName()
	}

	stepClicked(step) {
		let steps_completed = sessionStorage.getItem('stepCompleted')
		let steps_completed_obj = {}
		try {
			steps_completed_obj = JSON.parse(sessionStorage.getItem('step_completed_obj')) || {}
		} catch (error) {
			console.error('[affiliate-steps] invalid step_completed_obj in session', error)
		}
		let first_incomplete_step = Object.keys(steps_completed_obj)[Object.values(steps_completed_obj).indexOf('uncompleted')]
		let first_step_error = Object.keys(steps_completed_obj)[Object.values(steps_completed_obj).indexOf('error')] || first_incomplete_step
		console.log(Object.values(steps_completed_obj).indexOf('error'), Object.values(steps_completed_obj).indexOf('uncompleted'))
		let nav_step = (Object.values(steps_completed_obj).indexOf('error') < Object.values(steps_completed_obj).indexOf('uncompleted'))
			? first_step_error :
			first_incomplete_step;
		let navigationExtras: any = {};
		if (this.affiliateId && this.affiliateId !== 'null' && this.affiliateId !== 'undefined') {
			navigationExtras = { queryParams: { affiliate: this.affiliateId.replace(/['"]+/g, '') } };
		}

		if (step == 0) {
			this.router.navigate(['/admin/affiliate/step0'], navigationExtras);
			return
		}

		console.log('Inside block')


		if (step >= 1 && steps_completed != null && steps_completed.includes((step - 1) + '')) {
			this.router.navigate(['/admin/affiliate/step' + step], navigationExtras);

		} else {
			console.log('Inside else')
			this.errordialog.openDialog({
				errors: {
					error: `Please complete previous steps first.`
				}
			})
			console.log('nav------step', nav_step)
			this.router.navigate(['/admin/affiliate/' + (nav_step)], navigationExtras)
		}
		this.getAffiliateName();

	}
}
