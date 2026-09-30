import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, skip } from 'rxjs/operators';
import {
	AdminNotification,
	AdminNotificationFilters,
	AdminNotificationService,
} from 'src/app/services/admin-notification.service';
import { bookingLink, EVENT_LABELS, eventLabel } from './admin-notification-ui';

/**
 * Full booking-activity history for the admin: filterable, paginated, with
 * the complete old → new diff for every change.
 */
@Component({
	selector: 'app-admin-notifications',
	standalone: true,
	imports: [CommonModule, FormsModule],
	templateUrl: './admin-notifications.component.html',
	styleUrls: ['./admin-notifications.component.scss']
})
export class AdminNotificationsComponent implements OnInit, OnDestroy {
	readonly eventOptions = Object.entries(EVENT_LABELS).map(([value, label]) => ({ value, label }));
	readonly eventLabel = eventLabel;

	filters: AdminNotificationFilters = { page: 1, per_page: 20, event: '', from: '', to: '', search: '', unread: false };
	items: AdminNotification[] = [];
	total = 0;
	lastPage = 1;
	loading = false;
	error = '';
	expanded = new Set<number>();

	private search$ = new Subject<string>();
	private subs = new Subscription();

	constructor(private notifications: AdminNotificationService, private router: Router) { }

	ngOnInit(): void {
		this.subs.add(
			this.search$.pipe(debounceTime(350), distinctUntilChanged()).subscribe(() => this.applyFilters())
		);
		// Refresh the list when the bell's poll sees new activity.
		this.subs.add(
			this.notifications.recent$.pipe(skip(1)).subscribe(() => {
				if (this.filters.page === 1 && !this.loading) {
					this.load(false);
				}
			})
		);
		this.load();
	}

	ngOnDestroy(): void {
		this.subs.unsubscribe();
	}

	onSearchInput(value: string): void {
		this.search$.next(value);
	}

	applyFilters(): void {
		this.filters.page = 1;
		this.load();
	}

	clearFilters(): void {
		this.filters = { page: 1, per_page: 20, event: '', from: '', to: '', search: '', unread: false };
		this.load();
	}

	goToPage(page: number): void {
		if (page < 1 || page > this.lastPage || page === this.filters.page) {
			return;
		}
		this.filters.page = page;
		this.load();
	}

	load(showLoading = true): void {
		this.loading = showLoading;
		this.error = '';
		this.notifications.list(this.filters).subscribe({
			next: page => {
				this.items = page.data;
				this.total = page.total;
				this.lastPage = page.last_page || 1;
				this.loading = false;
			},
			error: () => {
				this.error = 'Could not load booking activity. Please try again.';
				this.loading = false;
			},
		});
	}

	toggle(n: AdminNotification): void {
		this.expanded.has(n.id) ? this.expanded.delete(n.id) : this.expanded.add(n.id);
		if (!n.read_at) {
			this.markRead(n);
		}
	}

	markRead(n: AdminNotification): void {
		n.read_at = new Date().toISOString();
		this.notifications.markRead(n.id).subscribe();
	}

	markAllRead(): void {
		this.notifications.markAllRead().subscribe(() => {
			const now = new Date().toISOString();
			this.items.forEach(n => n.read_at = n.read_at || now);
		});
	}

	openBooking(n: AdminNotification, event: MouseEvent): void {
		event.stopPropagation();
		if (!n.read_at) {
			this.markRead(n);
		}
		const link = bookingLink(n);
		this.router.navigate(link.commands, { queryParams: link.queryParams });
	}

	actorRole(n: AdminNotification): string {
		return n.actor_role === 3 ? 'Travel planner' : n.actor_role === 5 ? 'Customer' : '';
	}

	trackById(_: number, n: AdminNotification): number {
		return n.id;
	}
}
