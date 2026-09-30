import { AdminNotification, AdminNotificationChange } from 'src/app/services/admin-notification.service';

export const EVENT_LABELS: Record<string, string> = {
	created: 'New booking',
	updated: 'Edited',
	cancelled: 'Cancelled',
	status_changed: 'Status changed',
	payment: 'Payment',
};

const ROLE_LABELS: Record<number, string> = {
	3: 'Travel planner',
	5: 'Customer',
};

export function eventLabel(event: string): string {
	return EVENT_LABELS[event] || event;
}

/** Short headline without the actor — the actor is shown on its own line. */
export function headline(n: AdminNotification): string {
	const id = `#${n.reservation_id}`;
	switch (n.event) {
		case 'created': return `New booking ${id}`;
		case 'cancelled': return `Booking ${id} cancelled`;
		case 'status_changed': return `Booking ${id} status changed`;
		case 'payment': return `Payment on booking ${id}`;
		default: return `Booking ${id} edited`;
	}
}

export function actorName(n: AdminNotification): string {
	return (n.actor_name || '').trim() || 'Unknown user';
}

export function actorRole(n: AdminNotification): string {
	return (n.actor_role && ROLE_LABELS[n.actor_role]) || '';
}

export function sourceLabel(n: AdminNotification): string {
	return n.source === 'app' ? 'Mobile app' : 'Website';
}

export function initials(name: string): string {
	const parts = name.split(/\s+/).filter(Boolean);
	if (!parts.length) {
		return '?';
	}
	return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

/** "just now", "5m ago", "3h ago", "2d ago", then a date. */
export function timeAgo(iso: string): string {
	const then = new Date(iso).getTime();
	if (isNaN(then)) {
		return '';
	}
	const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
	if (seconds < 45) return 'just now';
	const minutes = Math.round(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.round(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.round(hours / 24);
	if (days < 7) return `${days}d ago`;
	return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function isNewBooking(n: AdminNotification): boolean {
	return n.event === 'created';
}

export function changesOf(n: AdminNotification): AdminNotificationChange[] {
	return n.changes || [];
}

/** One-line summary of the first few changes (toasts). */
export function changeSummary(n: AdminNotification, max = 2): string {
	const changes = changesOf(n);
	if (!changes.length) {
		return '';
	}
	const parts = changes.slice(0, max).map((c: AdminNotificationChange) =>
		isNewBooking(n) || c.old === null
			? `${c.label}: ${truncate(c.new)}`
			: `${c.label}: ${truncate(c.old) || '—'} → ${truncate(c.new) || '—'}`
	);
	const more = changes.length - max;
	return `${actorName(n)} · ` + parts.join(' · ') + (more > 0 ? ` · +${more} more` : '');
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
