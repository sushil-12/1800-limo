import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

/**
 * Fixed bottom bar that surfaces the AI rate analysis: a compact score + summary
 * strip and an "Accept AI rates" action that applies all suggested values to the
 * form. Shows a loading state while the AI call is in flight and an error state
 * (with retry) on failure. Stays hidden when idle.
 */
@Component({
	selector: 'app-ai-rate-accept-bar',
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: ``,
	styles: [
		`
			.ai-accept-bar {
				position: fixed;
				left: 0;
				right: 0;
				bottom: 0;
				z-index: 1001;
				background: #1f2333;
				color: #fff;
				box-shadow: 0 -6px 20px rgba(17, 24, 39, 0.25);
			}
			.ai-accept-bar__inner {
				display: flex;
				align-items: center;
				gap: 0.75rem;
				max-width: 1100px;
				margin: 0 auto;
				padding: 0.85rem 1.25rem;
				flex-wrap: wrap;
			}
			.ai-accept-bar__spinner .bi-cpu-fill {
				animation: ai-pulse 1.1s ease-in-out infinite;
			}
			@keyframes ai-pulse {
				0%, 100% { opacity: 0.4; }
				50% { opacity: 1; }
			}
			.ai-accept-bar__score {
				font-weight: 700;
				font-size: 1.15rem;
				padding: 0.15rem 0.6rem;
				border-radius: 10px;
				background: rgba(255, 255, 255, 0.12);
			}
			.ai-accept-bar__score small {
				font-size: 0.7rem;
				opacity: 0.8;
			}
			.ai-accept-bar__score.score-high { color: #34d399; }
			.ai-accept-bar__score.score-mid { color: #fbbf24; }
			.ai-accept-bar__score.score-low { color: #f87171; }
			.ai-accept-bar__summary {
				flex: 1 1 240px;
				font-size: 0.85rem;
				opacity: 0.9;
			}
			.ai-accept-bar__msg {
				flex: 1 1 240px;
				font-size: 0.9rem;
			}
			.ai-accept-bar__actions {
				display: flex;
				align-items: center;
				gap: 0.5rem;
				margin-left: auto;
			}
			.btn-accept {
				display: flex;
				align-items: center;
				gap: 0.4rem;
				padding: 0.55rem 1.1rem;
				background: #6366f1;
				color: #fff;
				border: none;
				border-radius: 50px;
				font-weight: 600;
				font-size: 0.88rem;
				cursor: pointer;
				transition: background 0.2s;
			}
			.btn-accept:hover:not(:disabled) { background: #4f46e5; }
			.btn-accept:disabled { opacity: 0.5; cursor: default; }
			.btn-ghost {
				padding: 0.5rem 0.85rem;
				background: transparent;
				color: #cbd5e1;
				border: 1px solid rgba(255, 255, 255, 0.25);
				border-radius: 50px;
				font-size: 0.82rem;
				cursor: pointer;
			}
			.btn-ghost:hover { color: #fff; border-color: rgba(255, 255, 255, 0.5); }
		`,
	],
})
export class AiRateAcceptBarComponent {
	@Input() loading = false;
	@Input() error: string | null = null;
	/** AI-suggested values keyed by form control name (null while idle). */
	@Input() suggestions: Record<string, number> | null = null;
	@Input() notes: Record<string, string> | null = null;
	@Input() score: number | null = null;
	@Input() summary = '';
	@Input() symbol = '$';

	/** Apply all suggested rates to the form. */
	@Output() accept = new EventEmitter<void>();
	/** Clear the suggestions without applying. */
	@Output() dismiss = new EventEmitter<void>();
	/** Re-run the AI analysis. */
	@Output() retry = new EventEmitter<void>();

	get count(): number {
		return this.suggestions ? Object.keys(this.suggestions).length : 0;
	}

	get scoreClass(): string {
		const s = this.score ?? 0;
		if (s >= 75) return 'score-high';
		if (s >= 50) return 'score-mid';
		return 'score-low';
	}
}
