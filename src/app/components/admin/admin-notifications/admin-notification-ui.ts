import { AdminNotification, AdminNotificationChange } from 'src/app/services/admin-notification.service';

export const EVENT_LABELS: Record<string, string> = {
	created: 'New booking',
	updated: 'Edited',
	cancelled: 'Cancelled',
	status_changed: 'Status changed',
	payment: 'Payment',
};

export function eventLabel(event: string): string {
	return EVENT_LABELS[event] || event;
}

/** One-line summary of the first few changes, for the bell dropdown. */
export function changeSummary(n: AdminNotification, max = 2): string {
	const changes = n.changes || [];
	if (!changes.length) {
		return '';
	}
	const parts = changes.slice(0, max).map((c: AdminNotificationChange) =>
		n.event === 'created' || c.old === null
			? `${c.label}: ${truncate(c.new)}`
			: `${c.label}: ${truncate(c.old) || '—'} → ${truncate(c.new) || '—'}`
	);
	const more = changes.length - max;
	return parts.join(' · ') + (more > 0 ? ` · +${more} more` : '');
}

/** Admin screen that opens a single booking. */
export function bookingLink(n: AdminNotification): { commands: any[]; queryParams: any } {
	return { commands: ['/admin/new-booking-v2'], queryParams: { bookingId: n.reservation_id, updateType: 'edit' } };
}

function truncate(value: string | null, len = 40): string {
	if (!value) {
		return '';
	}
	return value.length > len ? value.slice(0, len - 1) + '…' : value;
}
