import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScrollToTopComponent } from './scroll-to-top/scroll-to-top.component';
import { FloatIconsComponent } from './float-icons/float-icons.component';
import { InvalidControlScrollDirective } from 'src/app/directives/scroll-to-invalid.directive';
import { ImageModalComponent } from '../affiliate/modals/image-modal/image-modal.component';
import { DeleteConfirmationComponent } from '../affiliate/modals/delete-confirmation/delete-confirmation.component';
import { PhotoInstructionsComponent } from '../affiliate/modals/photo-instructions/photo-instructions.component';
import { PhotoGuideModalComponent } from '../affiliate/modals/photo-guide-modal/photo-guide-modal.component';
import { CameraAngleDiagramComponent } from '../affiliate/modals/photo-guide-modal/camera-angle-diagram.component';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatNativeDateModule } from '@angular/material/core';
import { MatMomentDateModule } from "@angular/material-moment-adapter";
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_MOMENT_DATE_ADAPTER_OPTIONS, MomentDateAdapter } from '@angular/material-moment-adapter';
import { DateAdapter, MAT_DATE_FORMATS, MAT_DATE_LOCALE } from '@angular/material/core';

import { NgxMaterialTimepickerModule } from 'ngx-material-timepicker';

import { DragDropModule } from '@angular/cdk/drag-drop';
import { SignatureDirectiveDirective } from '../../directives/signature-directive.directive';
import { DateFormatDirective } from '../../directives/date-format.directive';
import { MatSliderModule } from '@angular/material/slider';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { DatePickerComponent } from './date-picker/date-picker.component';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatMenuModule } from '@angular/material/menu';
import { EmbeddedQuoteComponent } from './embedded-quote/embedded-quote.component';
import { BookingsHeaderComponent } from './bookings-header/bookings-header.component';
import { NewCardFormComponent } from './new-card-form/new-card-form.component';


export const DATE_FORMATS = {
	parse: {
		dateInput: ['DD/MM/YYYY']
	},
	display: {
		dateInput: 'MMM DD, YYYY',
		monthYearLabel: 'MMM yyyy',
		dateA11yLabel: 'LL',
		monthYearA11yLabel: 'MMMM yyyy',
	},
};


@NgModule({
	declarations: [ScrollToTopComponent, FloatIconsComponent, SignatureDirectiveDirective, InvalidControlScrollDirective, ImageModalComponent, DeleteConfirmationComponent, PhotoInstructionsComponent, DateFormatDirective, DatePickerComponent, PhotoGuideModalComponent, CameraAngleDiagramComponent, EmbeddedQuoteComponent, BookingsHeaderComponent, NewCardFormComponent],
	imports: [
		CommonModule,
		MatAutocompleteModule,
		MatIconModule,
		MatButtonModule,
		MatDatepickerModule,
		MatNativeDateModule,
		MatMomentDateModule,
		MatInputModule,
		DragDropModule,
		NgxMaterialTimepickerModule,
		MatSliderModule,
		MatCheckboxModule,
		MatSlideToggleModule,
		FormsModule,
		ReactiveFormsModule,
		MatFormFieldModule,
		MatMenuModule

	],
	exports: [
		ScrollToTopComponent,
		FloatIconsComponent,
		InvalidControlScrollDirective,
		ImageModalComponent,
		DeleteConfirmationComponent,
		PhotoInstructionsComponent,
		PhotoGuideModalComponent,
		CameraAngleDiagramComponent,
		EmbeddedQuoteComponent,
		BookingsHeaderComponent,
		NewCardFormComponent,
		MatAutocompleteModule,
		MatDatepickerModule,
		MatNativeDateModule,
		MatMomentDateModule,
		MatInputModule,
		DragDropModule,
		DateFormatDirective,
		SignatureDirectiveDirective,
		NgxMaterialTimepickerModule,
		MatSliderModule,
		MatCheckboxModule,
		MatSlideToggleModule,
		FormsModule,
		MatIconModule,
		MatButtonModule,
		MatFormFieldModule
	],
	providers: [
		{ provide: DateAdapter, useClass: MomentDateAdapter, deps: [MAT_DATE_LOCALE, MAT_MOMENT_DATE_ADAPTER_OPTIONS] },
		{ provide: MAT_DATE_FORMATS, useValue: DATE_FORMATS }
	]
})
export class SharedModule {
	/**
	 * Search a particular object key with the specified value to search
	 * @params type: String [Required] filter/find
	 * @params list: Array [Required] the list to search in
	 * @params value_to_search: string | number [Required] value to search
	 * @params comparison_key: string [Required] key to match with the object in list
	 * @params return_key: string [Required] key to get the return value
	 */
	ListSearch(type: string, list: Array<any>, value_to_search: string | number, comparison_key: string) {
		// console.warn(`${type} for ${value_to_search} with comparison key - ${comparison_key} `)

		if (list && value_to_search && comparison_key) {
			let object: any
			if (type == 'find') {
				object = list.find((item: any) => {
					if (typeof value_to_search == 'number') {
						return item[comparison_key] == value_to_search
					}
					return item[comparison_key].toLowerCase().includes(value_to_search.toLowerCase())
				})
			}

			if (type == 'filter') {
				object = list.filter((item: any) => {
					if (typeof value_to_search == 'number') {
						return item[comparison_key] == value_to_search
					}
					return item[comparison_key].toLowerCase().includes(value_to_search.toLowerCase())
				})
			}

			if (object) {
				return object
			}
			else {
				return ['No object found. ']
			}
		}
		else {
			if (list == null) {
				console.error('Required List parameter. Got NULL')
			}
			if (value_to_search == null) {
				console.error('Required value to search parameter. Got NULL')
			}
			if (comparison_key == null) {
				console.error('Required comparison key parameter . Got NULL')
			}
			return null
		}
	}


	scrollIntoView(element: HTMLElement) {
		if (element) {
			setTimeout(() => {
				console.log('Scrolling ....')
				element.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" })
			}, 150)
		} else {
			console.error('No Element Reference provided. \nConsider giving an element to scroll. ')
		}
	}

	/**
	 * Fetches the cookies
	 * 
	 * @params cookie: string [Required] cookie name
	 * @returns string | Array<string>
	 */
	fetchCookies(cookie: string): string | Array<string> {
		let name = cookie + '='
		let all_cookies = decodeURIComponent(document.cookie).split(';')
		if (cookie = 'all') {
			return all_cookies
		}
		if (all_cookies.length > 0) {
			all_cookies.forEach((item: any) => {
				if (item.charAt(0) == ' ') {
					item = item.substring(1)
				}
				// if cookie is found
				if (item.indexOf(name) !== -1) {
					// return only the value
					console.info('Item: ', item)
					return item.substring(name.length, item.length)
				}
			})
		}
		return ""
	}
}
