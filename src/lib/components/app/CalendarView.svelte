<script lang="ts">
	import type { Component } from 'svelte';
	import type { ViewId } from '$lib/app/navigation';
	import type { ScheduleCard } from '$lib/app/academic';
	import type { SelectCoursesResult, SelectClassRoomsResult, SelectLecturersResult } from '$lib/server/sql';
	import { DAY_LABELS, conflictToneVariables, beautifyRoomType } from '$lib/app/academic';
	import { days } from '$lib/validations/enrollment';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Search } from '@lucide/svelte';

	let {
		enrollmentSearch = $bindable(''),
		scheduleDayFilter = $bindable(''),
		scheduleCourseFilter = $bindable(''),
		scheduleRoomFilter = $bindable(''),
		scheduleLecturerFilter = $bindable(''),
		scheduleSemesterFilter = $bindable(''),
		scheduleAcademicYearFilter = $bindable(''),
		scheduleRoomFilterSearch = $bindable(''),
		scheduleRoomFilterOpen = $bindable(false),
		selectedConflictGroupId = $bindable(null),
		calendarWeekLabel,
		courses,
		lecturers,
		scheduleSemesterOptions,
		scheduleAcademicYearOptions,
		filteredScheduleCards,
		scheduleActiveFilterCount,
		calendarConflictLegend,
		calendarNeedsFilters,
		calendarExceedsVisibleLimit,
		calendarMaxVisibleSchedules,
		EventCalendarComponent,
		calendarPlugins,
		calendarOptions,
		calendarDetailSchedule,
		selectedScheduleConflictSummary,
		selectedScheduleConflictGroup,
		selectedScheduleConflictPeers,
		selectedScheduleOverlapPeers,
		selectedScheduleId,
		scheduleRoomFilterOptions,
		filteredScheduleRoomFilterOptions,
		scheduleRoomFilterIssue,
		scheduleRoomFilterLoading,
		scheduleRoomFilterHasMore,
		selectedScheduleRoomFilterLabel,
		queueCollectionRefresh,
		queueScheduleRoomFilterRefresh,
		loadMoreScheduleRoomFilterOptions,
		resetScheduleFilters,
		toggleConflictGroup,
		navigateToEntity,
		openBuilderForSchedule,
		focusSchedule,
		handleKeyboardClick
	}: {
		enrollmentSearch: string;
		scheduleDayFilter: string;
		scheduleCourseFilter: string;
		scheduleRoomFilter: string;
		scheduleLecturerFilter: string;
		scheduleSemesterFilter: string;
		scheduleAcademicYearFilter: string;
		scheduleRoomFilterSearch: string;
		scheduleRoomFilterOpen: boolean;
		selectedConflictGroupId: string | null;
		calendarWeekLabel: string;
		courses: SelectCoursesResult[];
		lecturers: SelectLecturersResult[];
		scheduleSemesterOptions: string[];
		scheduleAcademicYearOptions: string[];
		filteredScheduleCards: ScheduleCard[];
		scheduleActiveFilterCount: number;
		calendarConflictLegend: Array<{
			id: string;
			selected: boolean;
			label: string;
			course: string;
			tone: number;
			details: { count: number; lecturers: string; rooms: string } | null;
			representative: ScheduleCard;
		}>;
		calendarNeedsFilters: boolean;
		calendarExceedsVisibleLimit: boolean;
		calendarMaxVisibleSchedules: number;
		EventCalendarComponent: Component<{ plugins?: unknown[]; options?: unknown }> | null;
		calendarPlugins: unknown[];
		calendarOptions: unknown;
		calendarDetailSchedule: ScheduleCard | null;
		selectedScheduleConflictSummary: string | null;
		selectedScheduleConflictGroup: { rooms: string; lecturers: string } | null;
		selectedScheduleConflictPeers: ScheduleCard[];
		selectedScheduleOverlapPeers: ScheduleCard[];
		selectedScheduleId: string | null;
		scheduleRoomFilterOptions: SelectClassRoomsResult[];
		filteredScheduleRoomFilterOptions: SelectClassRoomsResult[];
		scheduleRoomFilterIssue: string | null;
		scheduleRoomFilterLoading: boolean;
		scheduleRoomFilterHasMore: boolean;
		selectedScheduleRoomFilterLabel: string;
		queueCollectionRefresh: (key: 'enrollments', delay?: number) => void;
		queueScheduleRoomFilterRefresh: (delay?: number) => void;
		loadMoreScheduleRoomFilterOptions: () => void;
		resetScheduleFilters: () => void;
		toggleConflictGroup: (groupId: string, representative: ScheduleCard) => void;
		navigateToEntity: (view: ViewId, id: string | null | undefined, name?: string) => void;
		openBuilderForSchedule: (card: ScheduleCard) => void;
		focusSchedule: (card: ScheduleCard) => void;
		handleKeyboardClick: (event: KeyboardEvent) => void;
	} = $props();

	function conflictGroupMetaCopy(
		details: { count: number; lecturers: string; rooms: string } | null
	) {
		if (!details) return null;
		return `${details.count} jadwal • Ruang: ${details.rooms} • Dosen: ${details.lecturers}`;
	}
</script>

<div class="calendar-layout">
	<section class="calendar-surface">
		<header class="surface-head">
			<div>
				<p class="surface-kicker">Kalender</p>
				<h2>Kalender kuliah mingguan</h2>
				<p class="calendar-week-label">{calendarWeekLabel}</p>
			</div>
		</header>

		<section class="schedule-filter-panel">
			<div class="editor-grid schedule-filter-grid">
				<label class="schedule-filter-search">
					<span>Cari jadwal</span>
					<div class="search-box compact">
						<Search size={16} />
						<input
							bind:value={enrollmentSearch}
							aria-label="Cari jadwal kalender"
							placeholder="Cari mahasiswa, mata kuliah, ruang, atau dosen"
							oninput={() => queueCollectionRefresh('enrollments')}
						/>
					</div>
				</label>
				<label>
					<span>Hari</span>
					<select
						bind:value={scheduleDayFilter}
						onchange={() => queueCollectionRefresh('enrollments', 0)}
					>
						<option value="">Semua hari</option>
						{#each days as day (day)}
							<option value={day}>{DAY_LABELS[day]}</option>
						{/each}
					</select>
				</label>
				<label>
					<span>Mata kuliah</span>
					<select
						bind:value={scheduleCourseFilter}
						onchange={() => queueCollectionRefresh('enrollments', 0)}
					>
						<option value="">Semua mata kuliah</option>
						{#each courses as item (item.id)}
							<option value={item.id}>{item.name}</option>
						{/each}
					</select>
				</label>
				<label>
					<span>Ruang</span>
					<div
						class="combobox-wrap"
						onfocusout={(e) => {
							if (!e.currentTarget.contains(e.relatedTarget as Node)) {
								scheduleRoomFilterOpen = false;
							}
						}}
					>
						<input
							type="text"
							class="combobox-input"
							placeholder="Cari ruang filter..."
							value={scheduleRoomFilter
								? selectedScheduleRoomFilterLabel
								: scheduleRoomFilterSearch}
							oninput={(e) => {
								scheduleRoomFilterSearch = (e.currentTarget as HTMLInputElement).value;
								if (scheduleRoomFilter) {
									scheduleRoomFilter = '';
									queueCollectionRefresh('enrollments', 0);
								}
								queueScheduleRoomFilterRefresh();
								scheduleRoomFilterOpen = true;
							}}
							onfocus={(e) => {
								if (scheduleRoomFilter) {
									(e.currentTarget as HTMLInputElement).select();
								}
								scheduleRoomFilterOpen = true;
								if (!scheduleRoomFilterOptions.length) {
									queueScheduleRoomFilterRefresh(0);
								}
							}}
						/>
						{#if scheduleRoomFilterIssue}
							<p class="combobox-error">{scheduleRoomFilterIssue}</p>
						{:else if scheduleRoomFilterOpen && scheduleRoomFilterLoading && !scheduleRoomFilterOptions.length}
							<p class="combobox-empty">Memuat ruang kelas...</p>
						{:else if scheduleRoomFilterOpen}
							<div class="combobox-dropdown" role="listbox">
								<button
									type="button"
									role="option"
									aria-selected={!scheduleRoomFilter}
									class="combobox-option"
									class:active={!scheduleRoomFilter}
									onmousedown={(e) => {
										e.preventDefault();
										scheduleRoomFilter = '';
										scheduleRoomFilterSearch = '';
										scheduleRoomFilterOpen = false;
										queueCollectionRefresh('enrollments', 0);
									}}
								>
									<strong>Semua ruang</strong>
									<span>Hapus filter ruang</span>
								</button>
								{#each filteredScheduleRoomFilterOptions as item (item.id)}
									<button
										type="button"
										role="option"
										aria-selected={scheduleRoomFilter === item.id}
										class="combobox-option"
										class:active={scheduleRoomFilter === item.id}
										onmousedown={(e) => {
											e.preventDefault();
											scheduleRoomFilter = item.id ?? '';
											scheduleRoomFilterSearch = '';
											scheduleRoomFilterOpen = false;
											queueCollectionRefresh('enrollments', 0);
										}}
									>
										<strong>{item.name}</strong>
										<span
											>{beautifyRoomType(item.class_room_type)} • kapasitas {item.capacity}</span
										>
									</button>
								{/each}
								{#if !filteredScheduleRoomFilterOptions.length && !scheduleRoomFilterLoading}
									<p class="combobox-empty">Ruang tidak ditemukan.</p>
								{/if}
								{#if scheduleRoomFilterHasMore || scheduleRoomFilterLoading}
									<div class="combobox-footer">
										<span class="combobox-meta">
											{scheduleRoomFilterOptions.length} opsi dimuat
										</span>
										<button
											type="button"
											class="combobox-more"
											disabled={!scheduleRoomFilterHasMore || scheduleRoomFilterLoading}
											onmousedown={(e) => {
												e.preventDefault();
												loadMoreScheduleRoomFilterOptions();
											}}
										>
											{scheduleRoomFilterLoading ? 'Memuat...' : 'Muat lebih banyak'}
										</button>
									</div>
								{/if}
							</div>
						{/if}
					</div>
				</label>
				<label>
					<span>Dosen</span>
					<select
						bind:value={scheduleLecturerFilter}
						onchange={() => queueCollectionRefresh('enrollments', 0)}
					>
						<option value="">Semua dosen</option>
						{#each lecturers as item (item.id)}
							<option value={item.id}>{item.name}</option>
						{/each}
					</select>
				</label>
				<label>
					<span>Semester</span>
					<select
						bind:value={scheduleSemesterFilter}
						onchange={() => queueCollectionRefresh('enrollments', 0)}
					>
						<option value="">Semua semester</option>
						{#each scheduleSemesterOptions as item (item)}
							<option value={item}>{item}</option>
						{/each}
					</select>
				</label>
				<label>
					<span>Tahun akademik</span>
					<select
						bind:value={scheduleAcademicYearFilter}
						onchange={() => queueCollectionRefresh('enrollments', 0)}
					>
						<option value="">Semua tahun</option>
						{#each scheduleAcademicYearOptions as item (item)}
							<option value={item}>{item}</option>
						{/each}
					</select>
				</label>
			</div>
			<div class="list-summary schedule-filter-summary">
				<span>{filteredScheduleCards.length} jadwal tampil</span>
				<div class="schedule-filter-actions">
					<Badge variant="secondary">{scheduleActiveFilterCount} filter aktif</Badge>
					<Button
						class="ghost-button"
						variant="ghost"
						size="sm"
						onclick={resetScheduleFilters}
						disabled={scheduleActiveFilterCount === 0}
					>
						Hapus filter
					</Button>
				</div>
			</div>
		</section>

		{#if calendarConflictLegend.length}
			<div class="calendar-conflict-toolbar">
				<div class="calendar-conflict-toolbar-head">
					<strong>{calendarConflictLegend.length} grup bentrok</strong>
					{#if selectedConflictGroupId}
						<Button
							class="ghost-button"
							variant="ghost"
							size="sm"
							onclick={() => (selectedConflictGroupId = null)}
						>
							Lihat semua
						</Button>
					{/if}
				</div>
				<div class="calendar-conflict-legend">
					{#each calendarConflictLegend as group (group.id)}
						<button
							type="button"
							class={`calendar-conflict-chip ${group.selected ? 'selected' : ''}`}
							style={conflictToneVariables(group.tone)}
							onclick={() => toggleConflictGroup(group.id, group.representative)}
						>
							<span class="calendar-conflict-chip-dot"></span>
							<span class="calendar-conflict-chip-copy">
								<strong>{group.label}</strong>
								<small>{group.course}</small>
								{#if group.details}
									<small>{conflictGroupMetaCopy(group.details)}</small>
								{/if}
							</span>
						</button>
					{/each}
				</div>
			</div>
		{/if}

		{#if calendarNeedsFilters}
			<section class="calendar-empty-state support-panel">
				<h3>Terapkan filter jadwal terlebih dahulu</h3>
				<p class="detail-hint">
					Kalender penuh disembunyikan. Pilih mata kuliah, ruang, dosen, hari, semester,
					atau tahun akademik untuk menampilkan jadwal yang ingin dilihat.
				</p>
			</section>
		{:else if calendarExceedsVisibleLimit}
			<section class="calendar-empty-state support-warning">
				<h3>Persempit hasil sebelum membuka kalender</h3>
				<p>
					{filteredScheduleCards.length} jadwal masih cocok dengan filter saat ini. Kurangi
					hasil hingga maksimal {calendarMaxVisibleSchedules} jadwal agar kalender tetap
					mudah dibaca.
				</p>
			</section>
		{:else if !filteredScheduleCards.length}
			<section class="calendar-empty-state support-panel">
				<h3>Tidak ada jadwal yang cocok</h3>
				<p class="detail-hint">
					Ubah kata kunci atau longgarkan filter untuk menampilkan jadwal pada kalender.
				</p>
			</section>
		{:else}
			<div class="event-calendar-host">
				{#if EventCalendarComponent}
					<EventCalendarComponent plugins={calendarPlugins} options={calendarOptions} />
				{:else}
					<div class="calendar-loading">Memuat kalender...</div>
				{/if}
			</div>
		{/if}
	</section>

	<section
		class="detail-card"
		class:calendar-conflict={calendarDetailSchedule?.hasConflict}
		style={conflictToneVariables(calendarDetailSchedule?.conflictTone ?? null)}
	>
		{#if calendarDetailSchedule}
			<div class="pane-head compact">
				<div>
					<h3>
						<span
							role="button"
							tabindex="0"
							class="entity-link"
							onkeydown={handleKeyboardClick}
							onclick={() =>
								navigateToEntity(
									'courses',
									calendarDetailSchedule.original.course_id,
									calendarDetailSchedule.course
								)}>{calendarDetailSchedule.course}</span
						>
					</h3>
					{#if calendarDetailSchedule.hasConflict && selectedScheduleConflictSummary}
						<p class="calendar-conflict-copy">
							Bentrok dengan {selectedScheduleConflictSummary}
						</p>
					{/if}
				</div>
				<Button
					class="ghost-button"
					variant="ghost"
					size="sm"
					onclick={() => openBuilderForSchedule(calendarDetailSchedule)}
				>
					Buka di penjadwalan
				</Button>
			</div>
			<div class="detail-lines">
				<div>
					<span>Hari</span><strong>{DAY_LABELS[calendarDetailSchedule.day]}</strong>
				</div>
				<div>
					<span>Jam</span><strong
						>{calendarDetailSchedule.startLabel} - {calendarDetailSchedule.endLabel}</strong
					>
				</div>
				<div>
					<span>Ruang</span><span
						role="button"
						tabindex="0"
						class="entity-link"
						onkeydown={handleKeyboardClick}
						onclick={() =>
							navigateToEntity(
								'classrooms',
								calendarDetailSchedule.original.class_room_id,
								calendarDetailSchedule.room
							)}><strong>{calendarDetailSchedule.room}</strong></span
					>
				</div>
				<div>
					<span>Dosen</span><span
						role="button"
						tabindex="0"
						class="entity-link"
						onkeydown={handleKeyboardClick}
						onclick={() =>
							navigateToEntity(
								'lecturers',
								calendarDetailSchedule.original.lecturer_id,
								calendarDetailSchedule.lecturer
							)}><strong>{calendarDetailSchedule.lecturer}</strong></span
					>
				</div>
				<div>
					<span>Semester</span><strong
						>{calendarDetailSchedule.semester} • {calendarDetailSchedule.academicYear}</strong
					>
				</div>
				<div>
					<span>Status</span><strong
						class:selected-danger={calendarDetailSchedule.hasConflict}
						class:selected-safe={!calendarDetailSchedule.hasConflict}
						>{calendarDetailSchedule.hasConflict ? 'Bentrok' : 'Aman'}</strong
					>
				</div>
				{#if selectedScheduleConflictGroup}
					<div>
						<span>Ruang bentrok</span><strong>{selectedScheduleConflictGroup.rooms}</strong>
					</div>
					<div>
						<span>Dosen terkait</span><strong>{selectedScheduleConflictGroup.lecturers}</strong>
					</div>
				{/if}
			</div>
			{#if calendarDetailSchedule.hasConflict && selectedScheduleConflictPeers.length}
				<section class="calendar-overlap-panel">
					<h4>Jadwal lain di grup bentrok ini</h4>
					<div class="calendar-overlap-list">
						{#each selectedScheduleConflictPeers as peer (peer.id)}
							<div
								class={`calendar-overlap-item ${peer.hasConflict ? 'conflict' : ''} ${selectedScheduleId === peer.id ? 'selected' : ''}`}
								style={conflictToneVariables(peer.conflictTone ?? null)}
							>
								<div class="calendar-overlap-copy">
									<span
										role="button"
										tabindex="0"
										class="entity-link"
										onkeydown={handleKeyboardClick}
										onclick={() =>
											navigateToEntity('courses', peer.original.course_id, peer.course)}
										><strong>{peer.course}</strong></span
									>
									<span
										><span
											role="button"
											tabindex="0"
											class="entity-link"
											onkeydown={handleKeyboardClick}
											onclick={() =>
												navigateToEntity(
													'students',
													peer.original.student_id,
													peer.student
												)}>{peer.student}</span
										>
										•
										<span
											role="button"
											tabindex="0"
											class="entity-link"
											onkeydown={handleKeyboardClick}
											onclick={() =>
												navigateToEntity(
													'lecturers',
													peer.original.lecturer_id,
													peer.lecturer
												)}>{peer.lecturer}</span
										>
										•
										<span
											role="button"
											tabindex="0"
											class="entity-link"
											onkeydown={handleKeyboardClick}
											onclick={() =>
												navigateToEntity(
													'classrooms',
													peer.original.class_room_id,
													peer.room
												)}>{peer.room}</span
										></span
									>
									<small
										>{DAY_LABELS[peer.day]} • {peer.startLabel} - {peer.endLabel}</small
									>
								</div>
								<div class="calendar-overlap-actions">
									<Button
										class="ghost-button"
										variant="ghost"
										size="sm"
										onclick={() => focusSchedule(peer)}
									>
										Lihat jadwal
									</Button>
									<Button
										class="ghost-button"
										variant="ghost"
										size="sm"
										onclick={() => openBuilderForSchedule(peer)}
									>
										Buka penjadwalan
									</Button>
								</div>
							</div>
						{/each}
					</div>
				</section>
			{:else if selectedScheduleOverlapPeers.length}
				<section class="calendar-overlap-panel">
					<h4>Jadwal lain pada slot ini</h4>
					<div class="calendar-overlap-list">
						{#each selectedScheduleOverlapPeers as peer (peer.id)}
							<div
								class={`calendar-overlap-item ${peer.hasConflict ? 'conflict' : ''} ${selectedScheduleId === peer.id ? 'selected' : ''}`}
								style={conflictToneVariables(peer.conflictTone ?? null)}
							>
								<div class="calendar-overlap-copy">
									<strong>{peer.course}</strong>
									<span>{peer.student} • {peer.lecturer} • {peer.room}</span>
									<small
										>{DAY_LABELS[peer.day]} • {peer.startLabel} - {peer.endLabel}</small
									>
								</div>
								<div class="calendar-overlap-actions">
									<Button
										class="ghost-button"
										variant="ghost"
										size="sm"
										onclick={() => focusSchedule(peer)}
									>
										Lihat jadwal
									</Button>
									<Button
										class="ghost-button"
										variant="ghost"
										size="sm"
										onclick={() => openBuilderForSchedule(peer)}
									>
										Buka penjadwalan
									</Button>
								</div>
							</div>
						{/each}
					</div>
				</section>
			{/if}
		{:else if calendarNeedsFilters}
			<p class="empty-copy">
				Kalender mingguan akan tampil setelah filter dipilih. Gunakan daftar bentrok di
				atas untuk mulai memeriksa jadwal yang bentrok.
			</p>
		{:else if calendarExceedsVisibleLimit}
			<p class="empty-copy">
				Terlalu banyak jadwal untuk ditampilkan sekaligus. Tambahkan filter sampai
				hasilnya maksimal {calendarMaxVisibleSchedules} jadwal, atau pilih salah satu grup
				bentrok di atas untuk melihat rinciannya lebih dulu.
			</p>
		{:else if !filteredScheduleCards.length}
			<p class="empty-copy">Belum ada jadwal yang cocok dengan filter saat ini.</p>
		{:else}
			<p class="empty-copy">Pilih satu blok jadwal untuk melihat detail kelas.</p>
		{/if}
	</section>
</div>
