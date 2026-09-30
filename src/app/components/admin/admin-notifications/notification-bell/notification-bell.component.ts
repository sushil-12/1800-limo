import { Component, ElementRef, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { AdminNotification, AdminNotificationService } from 'src/app/services/admin-notification.service';
import {
	actorName, actorRole, bookingLink, changeSummary, changesOf, eventLabel, headline, initials, isNewBooking, sourceLabel, timeAgo,
} from '../admin-notification-ui';

/** Toasts stay up this long unless closed; hovering pauses the countdown. */
const TOAST_TIMEOUT_MS = 15000;
/** Beyond this many new items in one poll, the rest collapse into one summary toast. */
const MAX_TOASTS_PER_POLL = 3;
/** Changes listed per item before "Show all". */
export const COLLAPSED_CHANGES = 3;

/**
 * Header bell for the admin layout: unread badge, latest 10 booking-activity
 * items, toasts for new activity, and the sound / desktop-alert toggles.
 * Owns the polling lifecycle.
 */
@Component({
	selector: 'app-notification-bell',
	standalone: true,
	imports: [CommonModule, RouterModule],
	templateUrl: './notification-bell.component.html',
	styleUrls: ['./notification-bell.component.scss']
})
export class NotificationBellComponent implements OnInit, OnDestroy {
	open = false;
	readonly eventLabel = eventLabel;
	readonly headline = headline;
	readonly actorName = actorName;
	readonly actorRole = actorRole;
	readonly sourceLabel = sourceLabel;
	readonly initials = initials;
	readonly timeAgo = timeAgo;
	readonly changesOf = changesOf;
	readonly isNewBooking = isNewBooking;
	readonly collapsedChanges = COLLAPSED_CHANGES;
	expanded = new Set<number>();

	private activitySub: Subscription | null = null;

	constructor(
		public notifications: AdminNotificationService,
		private router: Router,
		private elementRef: ElementRef,
		private toastr: ToastrService,
	) { }

	ngOnInit(): void {
		this.activitySub = this.notifications.newActivity$.subscribe(fresh => this.showToasts(fresh));
		this.notifications.startPolling();
	}

	ngOnDestroy(): void {
		this.activitySub?.unsubscribe();
		this.notifications.stopPolling();
	}

	private showToasts(fresh: AdminNotification[]): void {
		const options = {
			timeOut: TOAST_TIMEOUT_MS,
			extendedTimeOut: TOAST_TIMEOUT_MS,
			closeButton: true,
			progressBar: true,
			tapToDismiss: true,
		};

		// Oldest first so the newest ends up on top of the stack.
		const shown = fresh.slice(0, MAX_TOASTS_PER_POLL).reverse();
		shown.forEach(n => {
			const toast = this.toastr.info(changeSummary(n, 3) || 'Click to open the booking.', headline(n), options);
			toast.onTap.subscribe(() => this.openItem(n));
		});

		const hidden = fresh.length - shown.length;
		if (hidden > 0) {
			const toast = this.toastr.info('Click to see all booking activity.', `+${hidden} more booking update${hidden === 1 ? '' : 's'}`, options);
			toast.onTap.subscribe(() => this.viewAll());
		}
	}

	toggle(event: MouseEvent): void {
		event.stopPropagation();
		this.open = !this.open;
	}

	@HostListener('document:click', ['$event'])
	onDocumentClick(event: MouseEvent): void {
		if (this.open && !this.elementRef.nativeElement.contains(event.target)) {
			this.open = false;
		}
	}

	@HostListener('document:keydown.escape')
	onEscape(): void {
		this.open = false;
	}

	openItem(n: AdminNotification): void {
		if (!n.read_at) {
			this.notifications.markRead(n.id).subscribe();
		}
		this.open = false;
		const link = bookingLink(n);
		this.router.navigate(link.commands, { queryParams: link.queryParams });
	}

	toggleExpanded(n: AdminNotification, event: MouseEvent): void {
		event.stopPropagation();
		this.expanded.has(n.id) ? this.expanded.delete(n.id) : this.expanded.add(n.id);
	}

	markAllRead(): void {
		this.notifications.markAllRead().subscribe();
	}

	viewAll(): void {
		this.open = false;
		this.router.navigate(['/admin/notifications']);
	}

	toggleSound(): void {
		this.notifications.soundEnabled = !this.notifications.soundEnabled;
	}

	async toggleDesktop(): Promise<void> {
		await this.notifications.setDesktopEnabled(!this.notifications.desktopEnabled);
	}

	trackById(_: number, n: AdminNotification): number {
		return n.id;
	}
}
