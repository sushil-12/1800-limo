import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

/**
 * Small inline hint rendered directly under a rate input, showing the
 * AI-suggested value (and a short "why") for that specific form field.
 * Renders nothing when there is no suggestion for `field`. The Apply button
 * only shows when the parent listens to `(apply)`.
 */
@Component({
	selector: 'app-ai-rate-hint',
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<div class="ai-rate-hint" *ngIf="value !== null">
			<i class="bi bi-stars"></i>
			<span class="ai-rate-hint__value">AI suggests {{ symbol }}{{ value }}</span>
			<button
				type="button"
				class="ai-rate-hint__apply"
				*ngIf="apply.observed"
				[attr.aria-label]="'Apply AI suggested rate of ' + symbol + value"
				(click)="apply.emit(field)"
			>
				Apply
			</button>
			<span class="ai-rate-hint__note" *ngIf="note">· {{ note }}</span>
		</div>
	`,
	styles: [
		`
			.ai-rate-hint {
				display: flex;
				align-items: baseline;
				flex-wrap: wrap;
				gap: 0.35rem;
				margin: 0.25rem 0 0.15rem;
				font-size: 0.78rem;
				line-height: 1.3;
				color: #4f46e5;
			}
			.ai-rate-hint .bi-stars {
				font-size: 0.8rem;
			}
			.ai-rate-hint__value {
				font-weight: 600;
			}
			.ai-rate-hint__apply {
				padding: 0.05rem 0.55rem;
				background: transparent;
				color: #4f46e5;
				border: 1px solid #4f46e5;
				border-radius: 50px;
				font-size: 0.72rem;
				font-weight: 600;
				line-height: 1.4;
				cursor: pointer;
				transition: background 0.2s, color 0.2s;
			}
			.ai-rate-hint__apply:hover {
				background: #4f46e5;
				color: #fff;
			}
			.ai-rate-hint__note {
				color: #6b7280;
				font-weight: 400;
			}
		`,
	],
})
export class AiRateHintComponent {
	/** Form control name this hint belongs to. */
	@Input() field = '';
	/** AI-suggested values keyed by form control name. */
	@Input() suggestions: Record<string, number> | null = null;
	/** Optional per-field "why" notes keyed by form control name. */
	@Input() notes: Record<string, string> | null = null;
	/** Currency symbol for display. */
	@Input() symbol = '$';

	/** Apply this field's suggested rate; emits the form control name. */
	@Output() apply = new EventEmitter<string>();

	get value(): number | null {
		const v = this.suggestions?.[this.field];
		return v === undefined || v === null ? null : v;
	}

	get note(): string | null {
		return this.notes?.[this.field] ?? null;
	}
}
