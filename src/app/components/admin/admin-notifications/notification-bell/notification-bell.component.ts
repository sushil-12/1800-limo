import { Component, ElementRef, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AdminNotification, AdminNotificationService } from 'src/app/services/admin-notification.service';
import { bookingLink, changeSummary, eventLabel } from '../admin-notification-ui';

/**
 * Header bell for the admin layout: unread badge, latest 10 booking-activity
 * items, and the sound / desktop-alert toggles. Owns the polling lifecycle.
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
	readonly changeSummary = changeSummary;

	constructor(
		public notifications: AdminNotificationService,
		private router: Router,
		private elementRef: ElementRef,
	) { }

	ngOnInit(): void {
		this.notifications.startPolling();
	}

	ngOnDestroy(): void {
		this.notifications.stopPolling();
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
