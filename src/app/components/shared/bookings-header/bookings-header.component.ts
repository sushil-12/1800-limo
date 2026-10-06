import { Component, EventEmitter, Input, Output, ViewEncapsulation } from '@angular/core';

export interface BookingTabCounts {
	upcoming?: number | null;
	past?: number | null;
}

/**
 * Header card shared by the bookings dashboards (admin, affiliate, individual,
 * travel agent): title, search bar, Upcoming / Past / Custom tabs and, for the
 * driver side, the "needs your response" banner.
 *
 * Slots: [bhActions] role buttons beside the title, [bhFilters] the Filters
 * panel (set `hasFilters`), [bhToolbar] buttons beside the tabs, and
 * [bhCustomRange] the date pickers shown under the Custom tab.
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
	@Input() hasFilters: boolean = false;

	/** Every keystroke; the page debounces it. */
	@Output() searchInput = new EventEmitter<string>();
	/** Search button or Enter: search right away. */
	@Output() searchSubmit = new EventEmitter<string>();
	@Output() tabChange = new EventEmitter<string>();
	@Output() needsActionToggle = new EventEmitter<void>();

	filtersOpen: boolean = false;

	readonly tabs = [
		{ key: 'upcoming', label: 'Upcoming' },
		{ key: 'past', label: 'Past' },
		{ key: 'custom', label: 'Custom' },
	];

	countFor(key: string): number | null {
		const count = this.tabCounts?.[key];
		return typeof count === 'number' ? count : null;
	}

	isActive(key: string): boolean {
		return this.listTab == key && !this.showNeedsAction;
	}
}
