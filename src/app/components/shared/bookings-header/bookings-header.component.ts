import { Component, EventEmitter, Input, Output, ViewEncapsulation } from '@angular/core';

export interface BookingFilterOption {
	label: string;
	value: any;
}

export interface BookingTabCounts {
	upcoming?: number | null;
	past?: number | null;
}

/**
 * Header card shared by the bookings dashboards (admin, affiliate, individual,
 * travel agent): title, search bar, Upcoming / Past / Custom tabs and, for the
 * driver side, the "needs your response" banner.
 *
 * Filters: pass `filterOptions` and the Filters button opens them as a
 * dropdown; picking one emits `filterChange` (null for "All").
 *
 * Slots: [bhActions] role buttons beside the title, [bhToolbar] buttons beside
 * the tabs, and [bhCustomRange] the date pickers shown under the Custom tab.
 */
@Component({
	selector: 'app-bookings-header',
	templateUrl: './bookings-header.component.html',
	styleUrls: ['./bookings-header.component.scss'],
	// Projected buttons and fields use the bh-* classes defined here.
	encapsulation: ViewEncapsulation.None,
})
export class BookingsHeaderComponent {
	@Input() title: string = 'Bookings';
	@Input() subtitle: string = 'Manage and track all bookings in one place';
	@Input() searchText: string = '';
	@Input() searchPlaceholder: string = 'Search by booking number, status, name, cell phone, vehicle type…';
	@Input() listTab: string = 'upcoming';
	@Input() tabCounts: BookingTabCounts | null = null;
	@Input() needsActionCount: number = 0;
	@Input() showNeedsAction: boolean = false;
	@Input() filterOptions: BookingFilterOption[] | null = null;
	@Input() filterValue: any = null;
	@Input() filterAllLabel: string = 'All Statuses';

	/** Every keystroke; the page debounces it. */
	@Output() searchInput = new EventEmitter<string>();
	/** Search button or Enter: search right away. */
	@Output() searchSubmit = new EventEmitter<string>();
	@Output() tabChange = new EventEmitter<string>();
	@Output() needsActionToggle = new EventEmitter<void>();
	@Output() filterChange = new EventEmitter<any>();

	filtersOpen: boolean = false;

	readonly tabs = [
		{ key: 'upcoming', label: 'Upcoming' },
		{ key: 'past', label: 'Past' },
		{ key: 'custom', label: 'Custom' },
	];

	/** Label of the chosen filter, shown on the button in place of "Filters". */
	get selectedFilterLabel(): string | null {
		if (this.filterValue == null) return null;
		return this.filterOptions?.find(option => option.value == this.filterValue)?.label ?? null;
	}

	countFor(key: string): number | null {
		const count = this.tabCounts?.[key];
		return typeof count === 'number' ? count : null;
	}

	/** No tab is highlighted while a search is in progress. */
	isActive(key: string): boolean {
		return this.listTab == key && !this.showNeedsAction && !this.searchText?.trim();
	}
}
