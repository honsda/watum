<script lang="ts">
	import {
		conflictToneVariables,
		DAY_ORDER,
		DAY_LABELS,
		type ScheduleCard
	} from '$lib/app/academic';

	const DAY_START = 7 * 60;
	const DAY_END = 20 * 60;
	const PIXELS_PER_MINUTE = 1.12;

	let {
		title = 'Kalender mingguan',
		subtitle = 'Membaca ritme kelas sepanjang minggu.',
		cards = [],
		onSelect,
		selectedId = null
	}: {
		title?: string;
		subtitle?: string;
		cards?: ScheduleCard[];
		onSelect?: (card: ScheduleCard) => void;
		selectedId?: string | null;
	} = $props();

	const hourMarkers = Array.from({ length: 14 }, (_, index) => 7 + index);
	const halfHourMarkers = Array.from({ length: 13 }, (_, index) => 7.5 + index);

	function topOffset(startMinutes: number) {
		return Math.max(startMinutes - DAY_START, 0) * PIXELS_PER_MINUTE;
	}

	function blockHeight(durationMinutes: number) {
		return Math.max(durationMinutes * PIXELS_PER_MINUTE, 44);
	}

	function layoutDayItems(items: ScheduleCard[]) {
		const positioned: Array<{ card: ScheduleCard; column: number; columns: number }> = [];
		let cluster: ScheduleCard[] = [];
		let clusterEnd = 0;

		function pushCluster(clusterItems: ScheduleCard[]) {
			if (!clusterItems.length) return;
			const columnEndTimes: number[] = [];
			const assigned = clusterItems.map((card) => {
				let column = columnEndTimes.findIndex((end) => end <= card.startMinutes);
				if (column === -1) {
					column = columnEndTimes.length;
					columnEndTimes.push(card.endMinutes);
				} else {
					columnEndTimes[column] = card.endMinutes;
				}
				return { card, column };
			});

			const totalColumns = columnEndTimes.length;
			for (const item of assigned) {
				positioned.push({ ...item, columns: totalColumns });
			}
		}

		for (const card of items) {
			if (!cluster.length) {
				cluster = [card];
				clusterEnd = card.endMinutes;
				continue;
			}

			if (card.startMinutes < clusterEnd) {
				cluster.push(card);
				clusterEnd = Math.max(clusterEnd, card.endMinutes);
				continue;
			}

			pushCluster(cluster);
			cluster = [card];
			clusterEnd = card.endMinutes;
		}

		pushCluster(cluster);
		return positioned;
	}

	function cardPosition(column: number, columns: number) {
		const outerPaddingRem = 0.45;
		const columnGapRem = 0.35;
		const totalGapRem = Math.max(columns - 1, 0) * columnGapRem;
		const columnOffsetRem = column * columnGapRem;
		return `left:calc(${outerPaddingRem}rem + (${column} * ((100% - ${outerPaddingRem * 2}rem - ${totalGapRem}rem) / ${columns})) + ${columnOffsetRem}rem);width:calc((100% - ${outerPaddingRem * 2}rem - ${totalGapRem}rem) / ${columns});`;
	}

	const groups = $derived(
		DAY_ORDER.map((day) => ({
			day,
			label: DAY_LABELS[day],
			items: layoutDayItems(
				cards
					.filter((card) => card.day === day)
					.sort((left, right) => left.startMinutes - right.startMinutes)
			)
		}))
	);
</script>

<section class="calendar-surface">
	<header class="surface-head">
		<div>
			<p class="surface-kicker">Kalender</p>
			<h2>{title}</h2>
		</div>
		{#if subtitle}<p>{subtitle}</p>{/if}
	</header>

	<div class="calendar-desktop">
		<div class="calendar-scroll">
			<div class="calendar-grid">
				<div class="time-column header-cell"></div>
				{#each groups as group (group.day)}
					<div class="day-head header-cell">
						<strong>{group.label}</strong>
						<span>{group.items.length} sesi</span>
					</div>
				{/each}

				<div class="time-column body-cell">
					{#each hourMarkers as hour}
						<div class="time-marker" style={`top:${(hour - 7) * 60 * PIXELS_PER_MINUTE}px`}>
							<span>{String(hour).padStart(2, '0')}:00</span>
						</div>
					{/each}
				</div>

				{#each groups as group (group.day)}
					<div class="day-column body-cell">
						{#each halfHourMarkers as hour}
							<div
								class="half-hour-line"
								style={`top:${(hour - 7) * 60 * PIXELS_PER_MINUTE}px`}
							></div>
						{/each}
						{#each hourMarkers as hour}
							<div class="hour-line" style={`top:${(hour - 7) * 60 * PIXELS_PER_MINUTE}px`}></div>
						{/each}

						{#each group.items as item (item.card.id)}
							<button
								type="button"
								class:selected={selectedId === item.card.id}
								class:conflict={item.card.hasConflict}
								class="calendar-card"
								style={`top:${topOffset(item.card.startMinutes)}px;height:${blockHeight(item.card.durationMinutes)}px;${cardPosition(item.column, item.columns)}${conflictToneVariables(item.card.conflictTone)}`}
								onclick={() => onSelect?.(item.card)}
							>
								{#if item.card.hasConflict}
									<span class="calendar-conflict-flag">Bentrok</span>
								{/if}
								<strong>{item.card.course}</strong>
								<span>{item.card.startLabel} - {item.card.endLabel}</span>
								<small>{item.card.room} • {item.card.lecturer}</small>
							</button>
						{/each}
					</div>
				{/each}
			</div>
		</div>
	</div>

	<div class="calendar-mobile">
		{#each groups as group (group.day)}
			<section class="mobile-day">
				<header>
					<strong>{group.label}</strong>
					<span>{group.items.length} sesi</span>
				</header>
				{#if group.items.length}
					<div class="mobile-list">
						{#each group.items as item (item.card.id)}
							<button
								type="button"
								class:selected={selectedId === item.card.id}
								class:conflict={item.card.hasConflict}
								class="mobile-card"
								style={conflictToneVariables(item.card.conflictTone)}
								onclick={() => onSelect?.(item.card)}
							>
								{#if item.card.hasConflict}
									<span class="calendar-conflict-flag">Bentrok</span>
								{/if}
								<strong>{item.card.course}</strong>
								<span>{item.card.startLabel} - {item.card.endLabel}</span>
								<small>{item.card.room} • {item.card.lecturer}</small>
							</button>
						{/each}
					</div>
				{:else}
					<p class="empty-copy">Belum ada sesi pada hari ini.</p>
				{/if}
			</section>
		{/each}
	</div>
</section>

<style>
	.calendar-surface {
		display: grid;
		gap: 1rem;
		--grid-line-strong: oklch(0.87 0.01 255 / 0.9);
		--grid-line-soft: oklch(0.91 0.008 255 / 0.9);
		--grid-line-vertical: oklch(0.89 0.009 255 / 0.75);
		--conflict-surface-0: color-mix(
			in oklch,
			var(--color-surface) 74%,
			var(--color-danger-soft) 26%
		);
		--conflict-border-0: color-mix(in oklch, var(--color-danger) 42%, var(--color-border) 58%);
		--conflict-ink-0: var(--color-danger);
		--conflict-surface-1: color-mix(
			in oklch,
			var(--color-surface) 74%,
			var(--color-accent-soft) 26%
		);
		--conflict-border-1: color-mix(
			in oklch,
			var(--color-accent-strong) 42%,
			var(--color-border) 58%
		);
		--conflict-ink-1: var(--color-accent-strong);
		--conflict-surface-2: color-mix(
			in oklch,
			var(--color-surface) 74%,
			var(--color-success-soft) 26%
		);
		--conflict-border-2: color-mix(in oklch, var(--color-success) 42%, var(--color-border) 58%);
		--conflict-ink-2: var(--color-success);
		--conflict-surface-3: color-mix(
			in oklch,
			var(--color-surface) 72%,
			color-mix(in oklch, var(--color-danger-soft) 55%, var(--color-accent-soft) 45%) 28%
		);
		--conflict-border-3: color-mix(
			in oklch,
			color-mix(in oklch, var(--color-danger) 52%, var(--color-accent-strong) 48%) 44%,
			var(--color-border) 56%
		);
		--conflict-ink-3: color-mix(in oklch, var(--color-danger) 60%, var(--color-accent-strong) 40%);
		--conflict-surface-4: color-mix(
			in oklch,
			var(--color-surface) 72%,
			color-mix(in oklch, var(--color-success-soft) 58%, var(--color-accent-soft) 42%) 28%
		);
		--conflict-border-4: color-mix(
			in oklch,
			color-mix(in oklch, var(--color-success) 56%, var(--color-accent-strong) 44%) 44%,
			var(--color-border) 56%
		);
		--conflict-ink-4: color-mix(in oklch, var(--color-success) 56%, var(--color-accent-strong) 44%);
	}

	:global(.dark) .calendar-surface {
		--grid-line-strong: oklch(0.34 0.016 252 / 0.95);
		--grid-line-soft: oklch(0.29 0.014 252 / 0.92);
		--grid-line-vertical: oklch(0.31 0.016 252 / 0.88);
	}

	.surface-head {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		align-items: end;
	}

	.surface-head h2 {
		font: 600 1.3rem/1.1 var(--font-display);
		letter-spacing: -0.03em;
	}

	.surface-head p {
		max-width: 48ch;
		color: var(--color-muted-foreground);
	}

	.surface-kicker {
		margin-bottom: 0.45rem;
		font-size: 0.75rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.14em;
		color: color-mix(in oklch, var(--color-accent-strong) 72%, var(--color-foreground) 28%);
	}

	.calendar-desktop {
		display: none;
	}

	.calendar-scroll {
		overflow-x: auto;
		overflow-y: hidden;
		padding-bottom: 0.2rem;
	}

	.calendar-grid {
		display: grid;
		grid-template-columns: 5.5rem repeat(6, minmax(0, 1fr));
		min-width: 60rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-xl);
		overflow: hidden;
		background: var(--color-panel);
	}

	.header-cell {
		padding: 1rem;
		border-bottom: 1px solid var(--color-border);
		background: color-mix(in oklch, var(--color-panel) 82%, var(--color-surface) 18%);
	}

	.day-head {
		display: grid;
		gap: 0.25rem;
	}

	.day-head strong {
		font-size: 0.92rem;
	}

	.day-head span,
	.time-marker span,
	.empty-copy,
	.mobile-day span {
		color: var(--color-muted-foreground);
	}

	.body-cell {
		position: relative;
		min-height: calc((20 - 7) * 60px * 1.12 / 1px);
		min-height: 873.6px;
	}

	.time-column {
		position: sticky;
		left: 0;
		z-index: 2;
		border-right: 1px solid var(--color-border);
		background: color-mix(in oklch, var(--color-panel) 88%, var(--color-surface) 12%);
	}

	.header-cell.time-column {
		z-index: 3;
	}

	.time-marker {
		position: absolute;
		left: 0.8rem;
		transform: translateY(-0.5rem);
		font-size: 0.78rem;
	}

	.day-column {
		border-right: 1px solid var(--color-border);
		background:
			linear-gradient(
				to right,
				transparent 0,
				transparent calc(50% - 0.5px),
				var(--grid-line-vertical) calc(50% - 0.5px),
				var(--grid-line-vertical) calc(50% + 0.5px),
				transparent calc(50% + 0.5px),
				transparent 100%
			),
			color-mix(in oklch, var(--color-panel) 94%, var(--color-surface) 6%);
	}

	.day-column:last-child {
		border-right: 0;
	}

	.hour-line {
		position: absolute;
		left: 0;
		right: 0;
		height: 1px;
		background: var(--grid-line-strong);
	}

	.half-hour-line {
		position: absolute;
		left: 0;
		right: 0;
		height: 1px;
		background: var(--grid-line-soft);
	}

	.calendar-card,
	.mobile-card {
		text-align: left;
		border: 1px solid transparent;
		background: var(--color-surface);
		color: inherit;
	}

	.calendar-card {
		position: absolute;
		left: 0.45rem;
		right: 0.45rem;
		display: grid;
		container-type: inline-size;
		align-content: start;
		gap: 0.28rem;
		padding: 0.7rem 0.8rem;
		border-radius: 0.9rem;
		box-shadow: 0 10px 24px color-mix(in oklch, var(--color-shadow) 12%, transparent 88%);
		overflow: hidden;
		min-width: 0;
	}

	.calendar-card strong,
	.mobile-card strong {
		font-size: 0.88rem;
		line-height: 1.2;
		overflow-wrap: anywhere;
		word-break: break-word;
	}

	.calendar-conflict-flag {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: fit-content;
		padding: 0.18rem 0.45rem;
		border-radius: 0.5rem;
		border: 1px solid
			color-mix(in oklch, var(--conflict-border, var(--color-danger)) 72%, transparent 28%);
		background: color-mix(
			in oklch,
			var(--conflict-surface, var(--color-danger-soft)) 82%,
			var(--color-panel) 18%
		);
		color: var(--conflict-ink, var(--color-danger));
		font-size: 0.72rem;
		font-weight: 700;
		line-height: 1;
	}

	.calendar-card span,
	.mobile-card span {
		font-size: 0.78rem;
		color: var(--color-muted-foreground);
		overflow-wrap: anywhere;
		word-break: break-word;
	}

	.calendar-card small,
	.mobile-card small {
		font-size: 0.76rem;
		color: var(--color-foreground-soft);
		overflow-wrap: anywhere;
		word-break: break-word;
	}

	.calendar-card.selected,
	.mobile-card.selected {
		border-color: var(--color-accent-strong);
		background: color-mix(in oklch, var(--color-surface) 78%, var(--color-accent-soft) 22%);
	}

	.calendar-card.conflict,
	.mobile-card.conflict {
		background: var(--conflict-surface);
		border-color: var(--conflict-border);
		box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--conflict-border) 22%, transparent 78%);
	}

	.calendar-card.conflict strong,
	.mobile-card.conflict strong {
		color: var(--conflict-ink);
	}

	.calendar-mobile {
		display: grid;
		gap: 0.9rem;
	}

	.mobile-day {
		display: grid;
		gap: 0.75rem;
		padding: 1rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-xl);
		background: var(--color-panel);
	}

	.mobile-day header {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
	}

	.mobile-list {
		display: grid;
		gap: 0.7rem;
	}

	.mobile-card {
		display: grid;
		gap: 0.28rem;
		padding: 0.85rem 0.95rem;
		border-radius: 1rem;
	}

	@container (max-width: 7rem) {
		.calendar-card {
			padding: 0.55rem 0.5rem;
			gap: 0.2rem;
		}

		.calendar-card small {
			display: none;
		}

		.calendar-card strong {
			font-size: 0.8rem;
			line-height: 1.1;
		}

		.calendar-card span {
			font-size: 0.72rem;
			line-height: 1.2;
		}

		.calendar-conflict-flag {
			padding-inline: 0.35rem;
			font-size: 0.66rem;
		}
	}

	@container (max-width: 4.75rem) {
		.calendar-card {
			padding: 0.45rem 0.4rem;
		}

		.calendar-card span,
		.calendar-conflict-flag {
			display: none;
		}

		.calendar-card strong {
			display: -webkit-box;
			-webkit-box-orient: vertical;
			-webkit-line-clamp: 5;
			line-clamp: 5;
			overflow: hidden;
			font-size: 0.74rem;
			line-height: 1.05;
		}
	}

	@media (min-width: 1080px) {
		.calendar-desktop {
			display: block;
		}

		.calendar-mobile {
			display: none;
		}
	}
</style>
