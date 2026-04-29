<script lang="ts">
	import type { AppRole, ScheduleCard, RoomMetric } from '$lib/app/academic';
	import type { ViewId } from '$lib/app/navigation';
	import type { SelectGradesResult } from '$lib/server/sql';
	import type { RoomDashboardSummary } from '../../../routes/classrooms/data.remote';
	import { DAY_LABELS } from '$lib/app/academic';
	import { Button } from '$lib/components/ui/button';
	import ClassroomDashboard from './ClassroomDashboard.svelte';

	let {
		role,
		nextSchedule,
		enrollments,
		grades,
		studentGradeHighlights,
		conflictCount,
		primaryConflict,
		additionalConflictCount,
		conflictGroupDetailsById,
		underusedRooms,
		classRoomDashboardSummary,
		classRoomDashboardMetrics,
		classRoomDashboardPagination,
		selectedRoomId,
		conflictedCount,
		onActivateView,
		onNavigateToEntity,
		onOpenBuilderForSchedule,
		onOpenCalendarForSchedule,
		onPickRoom,
		onPreviousPage,
		onNextPage,
		handleKeyboardClick
	}: {
		role: AppRole;
		nextSchedule: ScheduleCard | null;
		enrollments: { length: number };
		grades: { length: number };
		studentGradeHighlights: SelectGradesResult[];
		conflictCount: number;
		primaryConflict: ScheduleCard | null;
		additionalConflictCount: number;
		conflictGroupDetailsById: Record<
			string,
			{ count: number; courses: string; lecturers: string; rooms: string; students: string }
		>;
		underusedRooms: number;
		classRoomDashboardSummary: RoomDashboardSummary | null;
		classRoomDashboardMetrics: RoomMetric[];
		classRoomDashboardPagination: {
			pageNumber: number;
			limit: number;
			hasMore: boolean;
			loading: boolean;
			history: Array<string | null>;
		};
		selectedRoomId: string | null;
		conflictedCount: number;
		onActivateView: (view: ViewId) => void;
		onNavigateToEntity: (view: ViewId, id: string | null | undefined, name?: string) => void;
		onOpenBuilderForSchedule: (card: ScheduleCard) => void;
		onOpenCalendarForSchedule: (card: ScheduleCard) => void;
		onPickRoom: (id: string) => void;
		onPreviousPage: () => void;
		onNextPage: () => void;
		handleKeyboardClick: (event: KeyboardEvent) => void;
	} = $props();

	const emptyRoomDashboardSummary: RoomDashboardSummary = {
		totalRooms: 0,
		availableNowCount: 0,
		occupiedRoomCount: 0,
		lowUtilizationRoomCount: 0,
		averageUtilization: 0,
		conflictedCount: 0
	};

	function conflictGroupMetaCopy(
		details: { count: number; lecturers: string; rooms: string } | null
	) {
		if (!details) return null;
		return `${details.count} jadwal • Ruang: ${details.rooms} • Dosen: ${details.lecturers}`;
	}
</script>

<div class="dashboard-stack">
	{#if role === 'STUDENT'}
		<section class="student-dashboard">
			<article class="student-hero">
				<div class="student-hero-copy">
					<span>Kelas berikutnya</span>
					<strong
						>{#if nextSchedule}<span
								role="button"
								tabindex="0"
								class="entity-link"
								onkeydown={handleKeyboardClick}
								onclick={() => onActivateView('courses')}>{nextSchedule.course}</span
							>{:else}Belum ada kelas terjadwal{/if}</strong
					>
					{#if nextSchedule}
						<p>
							{DAY_LABELS[nextSchedule.day]} • {nextSchedule.startLabel} - {nextSchedule.endLabel}
							•
							<span
								role="button"
								tabindex="0"
								class="entity-link"
								onkeydown={handleKeyboardClick}
								onclick={() =>
									onNavigateToEntity(
										'classrooms',
										nextSchedule.original.class_room_id,
										nextSchedule.room
									)}>{nextSchedule.room}</span
							>
						</p>
					{/if}
				</div>
				<div class="decision-actions student-actions">
					<Button class="primary-button" onclick={() => onActivateView('calendar')}
						>Lihat kalender</Button
					>
					<Button
						class="ghost-button"
						variant="ghost"
						onclick={() => onActivateView('grades')}>Lihat nilai</Button
					>
				</div>
			</article>

			<section class="student-summary-row">
				<div>
					<span>KRS aktif</span>
					<strong>{enrollments.length} kelas tercatat</strong>
				</div>
				<div>
					<span>Nilai tersedia</span>
					<strong>{grades.length} hasil sudah masuk</strong>
				</div>
				<div>
					<span>Ruang yang dipakai</span>
					<strong
						>{#if nextSchedule}<span
								role="button"
								tabindex="0"
								class="entity-link"
								onkeydown={handleKeyboardClick}
								onclick={() =>
									onNavigateToEntity(
										'courses',
										nextSchedule.original.course_id,
										nextSchedule.course
									)}>{nextSchedule.course}</span
							>{:else}Belum ada kelas terjadwal{/if}</strong
					>
				</div>
			</section>

			{#if studentGradeHighlights.length}
				<section class="student-grade-list">
					<h3>Nilai terbaru</h3>
					<div class="student-grade-items">
						{#each studentGradeHighlights as item (item.id)}
							<div>
								<span>{item.course_name}</span>
								<strong>{item.letter_grade ?? '-'}</strong>
							</div>
						{/each}
					</div>
				</section>
			{/if}
		</section>
	{:else}
		<section class="decision-board">
			<article
				class="decision-lead"
				class:decision-alert={conflictCount > 0}
				class:decision-steady={conflictCount === 0}
			>
				<h3 class="decision-title">
					{#if conflictCount > 0}
						{conflictCount} bentrok perlu ditangani
					{:else if nextSchedule}
						Jadwal hari ini siap berjalan
					{:else}
						Belum ada kelas aktif yang perlu diatur
					{/if}
				</h3>
				{#if primaryConflict}
					<section class="decision-primary">
						<div class="decision-primary-copy">
							<span>Bentrok terdekat</span>
							<strong>{primaryConflict.course}</strong>
							<p>
								{DAY_LABELS[primaryConflict.day]} • {primaryConflict.startLabel} - {primaryConflict.endLabel}
							</p>
							{#if primaryConflict.conflictGroupId && conflictGroupDetailsById[primaryConflict.conflictGroupId]}
								<p>
									{conflictGroupMetaCopy(
										conflictGroupDetailsById[primaryConflict.conflictGroupId]
									)}
								</p>
							{/if}
						</div>
						{#if additionalConflictCount > 0}
							<p class="decision-secondary-count">
								+{additionalConflictCount} bentrok lain belum ditangani
							</p>
						{/if}
						<div class="decision-actions conflict-card-actions">
							<Button
								class="ghost-button"
								variant="ghost"
								size="sm"
								onclick={() => onOpenBuilderForSchedule(primaryConflict)}
							>
								Buka di penjadwalan
							</Button>
							<Button
								class="ghost-button"
								variant="ghost"
								size="sm"
								onclick={() => onOpenCalendarForSchedule(primaryConflict)}
							>
								Buka di kalender
							</Button>
						</div>
					</section>
				{:else if nextSchedule}
					<section class="decision-primary decision-primary-steady">
						<div class="decision-primary-copy">
							<span>Kelas berikutnya</span>
							<span
								role="button"
								tabindex="0"
								class="entity-link"
								onkeydown={handleKeyboardClick}
								onclick={() =>
									onNavigateToEntity(
										'courses',
										nextSchedule.original.course_id,
										nextSchedule.course
									)}><strong>{nextSchedule.course}</strong></span
							>
							<p>
								{DAY_LABELS[nextSchedule.day]} • {nextSchedule.startLabel} - {nextSchedule.endLabel}
								•
								<span
									role="button"
									tabindex="0"
									class="entity-link"
									onkeydown={handleKeyboardClick}
									onclick={() =>
										onNavigateToEntity(
											'classrooms',
											nextSchedule.original.class_room_id,
											nextSchedule.room
										)}>{nextSchedule.room}</span
								>
							</p>
						</div>
					</section>
				{/if}

				<div class="decision-actions">
					<Button class="primary-button" onclick={() => onActivateView('builder')}
						>Buka penjadwalan</Button
					>
					<Button
						class="ghost-button"
						variant="ghost"
						onclick={() => onActivateView('calendar')}>Lihat kalender</Button
					>
				</div>
			</article>

			<aside class="decision-notes">
				<div class="decision-note-row">
					<span>Ruang belum padat</span>
					<strong>{underusedRooms} ruang masih longgar</strong>
				</div>
				<div class="decision-note-row">
					<span>Kelas berikutnya</span>
					<strong
						>{#if nextSchedule}<span
								role="button"
								tabindex="0"
								class="entity-link"
								onkeydown={handleKeyboardClick}
								onclick={() => onActivateView('courses')}>{nextSchedule.course}</span
							>{:else}Belum ada kelas terjadwal{/if}</strong
					>
				</div>
			</aside>
		</section>

		<ClassroomDashboard
			{role}
			summary={{
				...(classRoomDashboardSummary ?? emptyRoomDashboardSummary),
				conflictedCount
			}}
			metrics={classRoomDashboardMetrics}
			page={classRoomDashboardPagination.pageNumber}
			pageSize={classRoomDashboardPagination.limit || 10}
			total={classRoomDashboardSummary?.totalRooms ?? 0}
			hasMore={classRoomDashboardPagination.hasMore}
			loading={classRoomDashboardPagination.loading}
			canPrevious={classRoomDashboardPagination.history.length > 0}
			{selectedRoomId}
			onPickRoom={onPickRoom}
			onPreviousPage={onPreviousPage}
			onNextPage={onNextPage}
		/>
	{/if}
</div>
