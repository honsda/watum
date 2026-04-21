<script lang="ts">
	import {
		buildRoomMetrics,
		formatMinutes,
		occupancyCopy,
		sortRoomsForRole,
		type AppRole,
		type ScheduleCard
	} from '$lib/app/academic';
	import type { SelectClassRoomsResult } from '$lib/server/sql/select-class-rooms';

	let {
		role,
		classrooms = [],
		cards = [],
		timezone = 'Asia/Jakarta',
		onPickRoom,
		selectedRoomId = null
	}: {
		role: AppRole;
		classrooms?: SelectClassRoomsResult[];
		cards?: ScheduleCard[];
		timezone?: string;
		onPickRoom?: (id: string) => void;
		selectedRoomId?: string | null;
	} = $props();

	const copy = $derived(occupancyCopy(role));
	const metrics = $derived(sortRoomsForRole(buildRoomMetrics(classrooms, cards, timezone), role));
	const availableNow = $derived(metrics.filter((room) => room.isAvailableNow));
	const conflicted = $derived(metrics.filter((room) => room.conflictCount > 0));
	const selectedRoom = $derived(metrics.find((room) => room.id === selectedRoomId) ?? null);
	const averageUtilization = $derived(
		metrics.length
			? Math.round(
					metrics.reduce((total, room) => total + room.utilizationPercent, 0) / metrics.length
				)
			: 0
	);
</script>

<section class="dashboard-grid">
	<header class="overview-panel">
		<div class="overview-copy">
			<h2>{copy.title}</h2>
		</div>

		<div class="summary-stats">
			<article>
				<strong>{metrics.length}</strong>
				<span>ruang aktif</span>
			</article>
			<article class:stat-highlight={availableNow.length > 0}>
				<strong>{availableNow.length}</strong>
				<span>ruang kosong sekarang</span>
			</article>
			<article>
				<strong>{averageUtilization}%</strong>
				<span>rata-rata utilisasi</span>
			</article>
			<article class:stat-alert={conflicted.length > 0}>
				<strong>{conflicted.length}</strong>
				<span>ruang bentrok</span>
			</article>
		</div>
	</header>

	<div class="table-panel">
		<header>
			<div>
				<h3>Ringkasan utilisasi mingguan</h3>
			</div>
		</header>

		<div class="room-list" role="list">
			{#each metrics as room (room.id)}
				<button
					type="button"
					class:selected={selectedRoomId === room.id}
					class="room-row"
					onclick={() => onPickRoom?.(room.id)}
				>
					<div class="room-copy">
						<strong>{room.name}</strong>
						<span>{room.type} • kapasitas {room.capacity}</span>
					</div>
					<div class="room-meta">
						<span class:active={room.isAvailableNow} class="status-pill">
							{room.isAvailableNow ? 'Kosong' : 'Terpakai'}
						</span>
						<strong>{room.utilizationPercent}%</strong>
					</div>
				</button>
			{/each}
		</div>
	</div>

	<div class="detail-panel">
		{#if selectedRoom}
			<header>
				<h3>{selectedRoom.name}</h3>
				<p>{selectedRoom.type} • kapasitas {selectedRoom.capacity}</p>
			</header>

			<div class="detail-grid">
				<article>
					<span>Utilisasi</span>
					<strong>{selectedRoom.utilizationPercent}%</strong>
				</article>
				<article>
					<span>Blok terjadwal</span>
					<strong>{selectedRoom.scheduledBlocks}</strong>
				</article>
				<article>
					<span>Waktu terpakai</span>
					<strong>{formatMinutes(selectedRoom.occupiedMinutes)}</strong>
				</article>
				<article>
					<span>Konflik</span>
					<strong>{selectedRoom.conflictCount}</strong>
				</article>
			</div>

			<div class="feature-list">
				<div>
					<span>Fasilitas</span>
					<strong
						>{selectedRoom.hasProjector ? 'Proyektor' : 'Tanpa proyektor'} • {selectedRoom.hasAC
							? 'AC'
							: 'Non-AC'}</strong
					>
				</div>
				<div>
					<span>Status saat ini</span>
					<strong>{selectedRoom.currentCourse}</strong>
				</div>
				<div>
					<span>Pemakaian berikutnya</span>
					<strong>{selectedRoom.nextUse}</strong>
				</div>
			</div>
		{:else}
			<header>
				<h3>Pilih satu ruang</h3>
			</header>
		{/if}
	</div>
</section>

<style>
	.dashboard-grid {
		display: grid;
		gap: 1rem;
	}

	.overview-panel,
	.table-panel,
	.detail-panel {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-xl);
		background: var(--color-panel);
	}

	.overview-panel,
	.table-panel,
	.detail-panel {
		padding: 1.1rem;
	}

	.overview-panel h2,
	.table-panel h3,
	.detail-panel h3 {
		font: 600 1.18rem/1.1 var(--font-display);
		letter-spacing: -0.03em;
	}

	.detail-panel p {
		max-width: 58ch;
		color: var(--color-muted-foreground);
	}

	.overview-panel {
		display: grid;
		gap: 1rem;
	}

	.overview-copy {
		display: grid;
		gap: 0.45rem;
	}

	.summary-stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(148px, 1fr));
		gap: 0.8rem;
		margin-top: 1rem;
	}

	.summary-stats article,
	.detail-grid article {
		display: grid;
		gap: 0.25rem;
		padding: 0.9rem;
		border-radius: 0.8rem;
		background: var(--color-surface);
	}

	.summary-stats strong,
	.detail-grid strong {
		font: 600 1.3rem/1 var(--font-display);
	}

	.summary-stats span,
	.detail-grid span,
	.feature-list span {
		color: var(--color-muted-foreground);
	}

	.table-panel header,
	.detail-panel header {
		display: grid;
		gap: 0.4rem;
		margin-bottom: 1rem;
	}

	.room-list {
		display: grid;
		gap: 0.6rem;
		max-height: 24rem;
		overflow-y: auto;
	}

	.room-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		width: 100%;
		padding: 0.85rem 0.95rem;
		border: 1px solid var(--color-border);
		border-radius: 0.8rem;
		background: var(--color-surface);
		text-align: left;
		color: inherit;
	}

	.room-row:hover {
		border-color: color-mix(in oklch, var(--color-accent-strong) 16%, var(--color-border) 84%);
	}

	.room-row:focus-visible {
		outline: 2px solid color-mix(in oklch, var(--color-accent-strong) 42%, transparent 58%);
		outline-offset: 2px;
		border-color: color-mix(in oklch, var(--color-accent-strong) 40%, var(--color-border) 60%);
	}

	.room-row.selected {
		border-color: var(--color-accent-strong);
		background: color-mix(in oklch, var(--color-surface) 75%, var(--color-accent-soft) 25%);
	}

	.room-copy,
	.room-meta,
	.feature-list,
	.detail-grid {
		display: grid;
		gap: 0.25rem;
		min-width: 0;
	}

	.room-copy strong,
	.feature-list strong {
		font-size: 0.95rem;
	}

	.room-copy span,
	.room-meta span,
	.feature-list span {
		font-size: 0.82rem;
	}

	.room-meta {
		justify-items: end;
	}

	.room-meta strong {
		font: 600 1.08rem/1 var(--font-display);
	}

	.status-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0;
		background: transparent;
		font-size: 0.8rem;
		font-weight: 600;
		line-height: 1.3;
		color: var(--color-foreground-soft);
	}

	.status-pill::before {
		content: '';
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 999px;
		background: color-mix(in oklch, var(--color-border) 80%, var(--color-surface) 20%);
		flex: 0 0 auto;
	}

	.status-pill.active {
		color: var(--color-foreground);
	}

	.status-pill.active::before {
		background: color-mix(in oklch, var(--color-success) 84%, var(--color-foreground) 16%);
	}

	.detail-grid {
		grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
		margin-bottom: 1rem;
	}

	.feature-list div {
		display: grid;
		gap: 0.28rem;
		padding: 0.9rem 0;
		border-top: 1px solid var(--color-border);
	}

	.summary-stats article.stat-alert {
		border: 1px solid color-mix(in oklch, var(--color-danger) 24%, var(--color-border) 76%);
		background: color-mix(in oklch, var(--color-surface) 84%, var(--color-danger-soft) 16%);
	}

	.summary-stats article.stat-alert strong {
		color: var(--color-danger);
	}

	.summary-stats article.stat-highlight {
		border: 1px solid color-mix(in oklch, var(--color-success) 22%, var(--color-border) 78%);
		background: color-mix(in oklch, var(--color-surface) 86%, var(--color-success-soft) 14%);
	}

	.summary-stats article.stat-highlight strong {
		color: var(--color-success);
	}

	@media (min-width: 1100px) {
		.dashboard-grid {
			grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr);
		}

		.overview-panel {
			grid-column: 1 / -1;
			grid-template-columns: minmax(0, 1fr) minmax(0, 0.95fr);
			align-items: start;
		}

		.table-panel {
			grid-column: 1 / 2;
		}

		.detail-panel {
			grid-column: 2 / 3;
			grid-row: 2 / 3;
		}
	}
</style>
