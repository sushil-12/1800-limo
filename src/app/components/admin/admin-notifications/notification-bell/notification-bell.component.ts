import { Component, ElementRef, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { ToastrService } from 'ngx-toastr';
import { AdminNotification, AdminNotificationService } from 'src/app/services/admin-notification.service';
import {
	actorName, actorRole, bookingLink, changesOf, eventLabel, headline, initials, isNewBooking, sourceLabel, timeAgo,
} from '../admin-notification-ui';

/** Toasts stay up this long unless closed; hovering pauses the countdown. */
const TOAST_TIMEOUT_MS = 15000;
/** Beyond this many new items in one poll, the rest collapse into one summary toast. */
const MAX_TOASTS_PER_POLL = 3;
/** Changes shown inside one toast. */
const TOAST_CHANGES = 3;
/** Changes listed per item before "Show all". */
export const COLLAPSED_CHANGES = 3;
/** Panel width on wide screens, and the minimum gap kept to the viewport edges. */
const PANEL_MAX_WIDTH = 760;
const PANEL_GUTTER = 16;

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
	panelStyle: Record<string, string> = {};

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
		// Capture phase so the "+N more" click is handled before ngx-toastr's tap handler opens the booking.
		document.addEventListener('click', this.onToastMoreClick, true);
	}

	ngOnDestroy(): void {
		this.activitySub?.unsubscribe();
		this.notifications.stopPolling();
		document.removeEventListener('click', this.onToastMoreClick, true);
	}

	/** "+N more changes" in a toast expands it in place instead of navigating to the booking. */
	private onToastMoreClick = (event: MouseEvent): void => {
		const more = (event.target as HTMLElement | null)?.closest?.('.activity-toast .at-more');
		if (!more) {
			return;
		}
		event.stopPropagation();
		event.preventDefault();
		more.closest('.activity-toast')?.classList.toggle('at-expanded');
	};

	private showToasts(fresh: AdminNotification[]): void {
		const options = {
			timeOut: TOAST_TIMEOUT_MS,
			extendedTimeOut: TOAST_TIMEOUT_MS,
			closeButton: true,
			progressBar: true,
			tapToDismiss: true,
			enableHtml: true,
			toastClass: 'ngx-toastr activity-toast',
			titleClass: 'activity-toast-title',
			messageClass: 'activity-toast-message',
		};

		// Oldest first so the newest ends up on top of the stack.
		const shown = fresh.slice(0, MAX_TOASTS_PER_POLL).reverse();
		shown.forEach(n => {
			const toast = this.toastr.show(this.toastBody(n), escapeHtml(headline(n)), { ...options, toastClass: `${options.toastClass} ev-${n.event}` });
			toast.onTap.subscribe(() => this.openItem(n));
		});

		const hidden = fresh.length - shown.length;
		if (hidden > 0) {
			const toast = this.toastr.show(
				'<div class="at-hint">Click to see all booking activity.</div>',
				`+${hidden} more booking update${hidden === 1 ? '' : 's'}`,
				options,
			);
			toast.onTap.subscribe(() => this.viewAll());
		}
	}

	/** Toast body: who did it, then each change as Was / Now. All values escaped. */
	private toastBody(n: AdminNotification): string {
		const role = actorRole(n);
		const who = `<div class="at-actor">by <b>${escapeHtml(actorName(n))}</b>`
			+ (role ? ` <span class="at-chip">${escapeHtml(role)}</span>` : '')
			+ ` · ${escapeHtml(sourceLabel(n))}</div>`;

		const changes = changesOf(n);
		// Every change is rendered; the ones past TOAST_CHANGES stay hidden until "+N more" expands the toast.
		const rows = changes.map((c, i) => {
			const cls = i < TOAST_CHANGES ? 'at-change' : 'at-change at-extra';
			const label = `<div class="at-label">${escapeHtml(c.label)}</div>`;
			if (isNewBooking(n) || c.old === null) {
				return `<div class="${cls}">${label}<div class="at-value">${escapeHtml(clip(c.new))}</div></div>`;
			}
			return `<div class="${cls}">${label}`
				+ `<div class="at-line at-was"><span class="at-sign">Original</span><span>${escapeHtml(clip(c.old) || 'empty')}</span></div>`
				+ `<div class="at-line at-now"><span class="at-sign">Updated</span><span>${escapeHtml(clip(c.new) || 'empty')}</span></div>`
				+ `</div>`;
		}).join('');

		const more = changes.length - TOAST_CHANGES;
		const moreToggle = more > 0
			? `<span class="at-more"><span class="at-more-show">+${more} more change${more === 1 ? '' : 's'}</span>`
				+ `<span class="at-more-hide">Show less</span></span> · `
			: '';
		const footer = `<div class="at-hint">${moreToggle}Click to open booking</div>`;

		return who + (rows ? `<div class="at-changes">${rows}</div>` : '') + footer;
	}

	toggle(event: MouseEvent): void {
		event.stopPropagation();
		this.open = !this.open;
		if (this.open) {
			this.positionPanel();
		}
	}

	/**
	 * Pins the panel under the bell in viewport coordinates, right-aligned to the bell but
	 * shifted so it never runs off either edge (the bell sits mid-screen on tablets).
	 */
	@HostListener('window:resize')
	@HostListener('window:scroll')
	positionPanel(): void {
		if (!this.open) {
			return;
		}
		const trigger = this.elementRef.nativeElement.querySelector('.nb-trigger') as HTMLElement | null;
		if (!trigger) {
			return;
		}
		const rect = trigger.getBoundingClientRect();
		const viewport = document.documentElement.clientWidth || window.innerWidth;
		const width = Math.min(PANEL_MAX_WIDTH, viewport - 2 * PANEL_GUTTER);
		const right = Math.min(Math.max(PANEL_GUTTER, viewport - rect.right - 8), viewport - width - PANEL_GUTTER);
		this.panelStyle = {
			top: `${Math.max(PANEL_GUTTER, rect.bottom + 10)}px`,
			right: `${right}px`,
			width: `${width}px`,
		};
	}

	@HostListener('document:click', ['$event'])
	// iOS Safari doesn't fire click on non-interactive elements, so taps outside wouldn't close the panel.
	@HostListener('document:touchstart', ['$event'])
	onDocumentClick(event: Event): void {
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

	trackById(_: number, n: AdminNotification): number {
		return n.id;
	}
}

function escapeHtml(value: string | null | undefined): string {
	return String(value ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function clip(value: string | null, len = 160): string {
	if (!value) {
		return '';
	}
	return value.length > len ? value.slice(0, len - 1) + '…' : value;
}
