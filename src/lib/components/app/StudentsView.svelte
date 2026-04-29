<script lang="ts">
	import type { AppRole } from '$lib/app/academic';
	import type { ViewId } from '$lib/app/navigation';
	import type { SelectStudentsResult, SelectStudyProgramsResult } from '$lib/server/sql';
	import CollectionPagination from '$lib/components/app/CollectionPagination.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Search, X } from '@lucide/svelte';
	import './crud-view.css';

	type FieldAccessor = {
		as: (...args: unknown[]) => Record<string, unknown>;
	};

	type FormState = {
		fields: {
			id?: FieldAccessor;
			name: FieldAccessor;
			email: FieldAccessor;
			phone: FieldAccessor;
			address: FieldAccessor;
			yearAdmitted: FieldAccessor;
			studyProgramId: FieldAccessor;
		};
		pending?: number;
	};

	type EnhancedAction = {
		action: string;
		method: 'POST';
		[key: symbol]: (node: HTMLFormElement) => void;
	};

	type PendingDelete = {
		kind: string;
		id: string;
		label: string;
		message: string;
		confirmLabel: string;
	} | null;

	type PaginationState = {
		pageNumber: number;
		history: Array<string | null>;
		limit: number;
		itemCount: number;
		hasMore: boolean;
		loading: boolean;
	};

	let {
		currentRole,
		studentSearch = $bindable(''),
		filteredStudents,
		selectedStudentId,
		selectedStudent,
		bulkSelectedIds,
		bulkCount,
		studentDraft = $bindable({
			name: '',
			email: '',
			phone: '',
			address: '',
			yearAdmitted: 2024,
			studyProgramId: ''
		}),
		bulkEditStudentStudyProgramId = $bindable(''),
		bulkEditStudentYearAdmitted = $bindable(new Date().getFullYear()),
		editorView,
		pendingDelete,
		collectionPagination,
		createStudent,
		updateStudent,
		bulkUpdateStudents,
		createStudentEnhance,
		updateStudentEnhance,
		bulkUpdateStudentsEnhance,
		studyPrograms,
		studyProgramsIssue,
		studentEditorBlocked,
		onSearchInput,
		onClearSearch,
		onBeginCreate,
		onBulkClear,
		onOpenBulkEdit,
		onOpenBulkDelete,
		onBulkToggleAll,
		onBulkToggleId,
		onPickStudent,
		handleKeyboardClick,
		onNavigateToEntity,
		onBeginEdit,
		onStopEditing,
		onRequestDelete,
		onConfirmDelete,
		onCancelDelete,
		onPagePrevious,
		onPageNext
	}: {
		currentRole: AppRole;
		studentSearch: string;
		filteredStudents: SelectStudentsResult[];
		selectedStudentId: string | null;
		selectedStudent: SelectStudentsResult | null;
		bulkSelectedIds: Set<string>;
		bulkCount: number;
		studentDraft: {
			name: string;
			email: string;
			phone: string;
			address: string;
			yearAdmitted: number;
			studyProgramId: string;
		};
		bulkEditStudentStudyProgramId: string;
		bulkEditStudentYearAdmitted: number;
		editorView: string | null;
		pendingDelete: PendingDelete;
		collectionPagination: PaginationState;
		createStudent: unknown;
		updateStudent: unknown;
		bulkUpdateStudents: unknown;
		createStudentEnhance: EnhancedAction;
		updateStudentEnhance: EnhancedAction;
		bulkUpdateStudentsEnhance: EnhancedAction;
		studyPrograms: SelectStudyProgramsResult[];
		studyProgramsIssue: string | undefined;
		studentEditorBlocked: boolean;
		onSearchInput: () => void;
		onClearSearch: () => void;
		onBeginCreate: () => void;
		onBulkClear: () => void;
		onOpenBulkEdit: () => void;
		onOpenBulkDelete: () => void;
		onBulkToggleAll: (ids: string[]) => void;
		onBulkToggleId: (id: string) => void;
		onPickStudent: (item: SelectStudentsResult) => void;
		handleKeyboardClick: (event: KeyboardEvent) => void;
		onNavigateToEntity: (view: ViewId, id: string | null | undefined, name?: string) => void;
		onBeginEdit: () => void;
		onStopEditing: () => void;
		onRequestDelete: () => void;
		onConfirmDelete: () => void;
		onCancelDelete: () => void;
		onPagePrevious: () => void;
		onPageNext: () => void;
	} = $props();

	function createStudentForm() {
		return createStudent as FormState;
	}

	function updateStudentForm() {
		return updateStudent as FormState;
	}

	function bulkUpdateStudentsForm() {
		return bulkUpdateStudents as FormState;
	}
</script>

<div class="workspace-shell">
	<section class="workspace-list">
		<div class="pane-head">
			<div>
				<h3>Daftar mahasiswa aktif</h3>
			</div>
			<Button variant="ghost" size="sm" class="ghost-button" onclick={onBeginCreate}>Tambah</Button>
		</div>
		<label class="search-box"
			><Search size={16} /><input
				bind:value={studentSearch}
				oninput={onSearchInput}
				aria-label="Cari data mahasiswa"
				placeholder="Cari NRP, nama, atau program studi"
			/>{#if studentSearch}<button type="button" class="search-clear" onclick={onClearSearch}
					><X size={14} /></button
				>{/if}</label
		>
		{#if bulkCount > 0}
			<div class="bulk-bar">
				<span class="bulk-count">{bulkCount} mahasiswa dipilih</span>
				<div class="bulk-actions">
					<Button variant="ghost" size="sm" class="ghost-button" onclick={onBulkClear}>Batal</Button
					>
					<Button variant="ghost" size="sm" class="ghost-button" onclick={onOpenBulkEdit}
						>Ubah</Button
					>
					<Button variant="destructive" size="sm" class="danger-button" onclick={onOpenBulkDelete}
						>Hapus</Button
					>
				</div>
			</div>
		{/if}
		<div class="list-stack">
			{#if filteredStudents.length > 1}
				<label class="list-row select-all-row">
					<input
						type="checkbox"
						checked={bulkCount === filteredStudents.length && filteredStudents.length > 0}
						onchange={() =>
							onBulkToggleAll(filteredStudents.map((i) => i.id).filter(Boolean) as string[])}
					/>
					<span>Pilih semua ({filteredStudents.length})</span>
				</label>
			{/if}
			{#each filteredStudents as item (item.id)}
				<div
					class="list-row user-row"
					class:selected={selectedStudentId === item.id}
					class:checked={item.id != null && bulkSelectedIds.has(item.id)}
				>
					<label class="row-checkbox"
						><input
							type="checkbox"
							checked={item.id != null && bulkSelectedIds.has(item.id)}
							onchange={() => item.id && onBulkToggleId(item.id)}
							onclick={(e) => e.stopPropagation()}
						/></label
					>
					<div
						role="button"
						tabindex="0"
						class="row-content"
						onkeydown={handleKeyboardClick}
						onclick={() => onPickStudent(item)}
					>
						<div>
							<span
								role="button"
								tabindex="0"
								class="entity-link"
								onkeydown={handleKeyboardClick}
								onclick={(e) => {
									e.stopPropagation();
									onNavigateToEntity('students', item.id, item.name ?? undefined);
								}}><strong>{item.name}</strong></span
							><span
								>{item.id} •
								<span
									role="button"
									tabindex="0"
									class="entity-link"
									onkeydown={handleKeyboardClick}
									onclick={(e) => {
										e.stopPropagation();
										onNavigateToEntity(
											'studyPrograms',
											item.study_program_id,
											item.study_program_name ?? undefined
										);
									}}>{item.study_program_name}</span
								>
							</span>
						</div>
						<small>{item.year_admitted}</small>
					</div>
				</div>
			{/each}
		</div>
		<CollectionPagination
			label="mahasiswa"
			pageNumber={collectionPagination.pageNumber}
			canPrevious={collectionPagination.history.length > 0}
			limit={collectionPagination.limit}
			itemCount={collectionPagination.itemCount}
			hasMore={collectionPagination.hasMore}
			loading={collectionPagination.loading}
			onPrevious={onPagePrevious}
			onNext={onPageNext}
		/>
	</section>
	<section class="workspace-detail">
		<div class="pane-head compact">
			<div>
				<h3>
					{editorView === 'students-bulk'
						? 'Ubah massal mahasiswa'
						: selectedStudent
							? selectedStudent.name
							: 'Tambah mahasiswa'}
				</h3>
			</div>
			{#if currentRole === 'ADMIN'}
				<div class="detail-actions">
					{#if editorView === 'students'}
						<Button variant="ghost" size="sm" class="ghost-button" onclick={onStopEditing}
							>Tutup form</Button
						>
					{:else if selectedStudent}
						<Button variant="ghost" size="sm" class="ghost-button" onclick={onBeginEdit}
							>Edit</Button
						>
					{/if}
					{#if selectedStudentId}
						<Button variant="destructive" size="sm" class="danger-button" onclick={onRequestDelete}
							>Hapus</Button
						>
					{/if}
				</div>
			{/if}
		</div>
		{#if pendingDelete?.kind === 'student' && pendingDelete.id === selectedStudentId}
			<section class="warning-panel">
				<p class="warning-title">Hapus {pendingDelete.label}?</p>
				<p>{pendingDelete.message}</p>
				<div class="warning-actions">
					<Button class="danger-button" variant="destructive" size="sm" onclick={onConfirmDelete}
						>{pendingDelete.confirmLabel}</Button
					>
					<Button class="ghost-button" variant="ghost" size="sm" onclick={onCancelDelete}
						>Batal</Button
					>
				</div>
			</section>
		{/if}
		{#if selectedStudent && editorView !== 'students' && editorView !== 'students-bulk'}
			<div class="detail-stack">
				<div class="detail-lines">
					<div><span>Email</span><strong>{selectedStudent.email}</strong></div>
					<div>
						<span>Program studi</span><span
							role="button"
							tabindex="0"
							class="entity-link"
							onkeydown={handleKeyboardClick}
							onclick={(e) => {
								e.stopPropagation();
								onNavigateToEntity(
									'studyPrograms',
									selectedStudent.study_program_id,
									selectedStudent.study_program_name ?? undefined
								);
							}}><strong>{selectedStudent.study_program_name}</strong></span
						>
					</div>
					<div>
						<span>Fakultas</span><span
							role="button"
							tabindex="0"
							class="entity-link"
							onkeydown={handleKeyboardClick}
							onclick={(e) => {
								e.stopPropagation();
								onNavigateToEntity(
									'faculties',
									selectedStudent.faculty_id,
									selectedStudent.faculty_name ?? undefined
								);
							}}><strong>{selectedStudent.faculty_name}</strong></span
						>
					</div>
					<div><span>Angkatan</span><strong>{selectedStudent.year_admitted}</strong></div>
				</div>
				<p class="detail-hint">
					Tinjau identitas mahasiswa lebih dulu agar perubahan data tidak bercampur dengan proses
					baca cepat.
				</p>
			</div>
		{:else if currentRole === 'ADMIN' && editorView === 'students'}
			<form
				class="editor-grid"
				{...selectedStudentId ? updateStudentEnhance : createStudentEnhance}
			>
				{#if selectedStudentId}
					<input
						type="hidden"
						{...updateStudentForm().fields.id!.as('text')}
						value={selectedStudentId}
					/>
				{/if}
				<label
					><span>Nama</span><input
						{...selectedStudentId
							? updateStudentForm().fields.name.as('text')
							: createStudentForm().fields.name.as('text')}
						bind:value={studentDraft.name}
					/></label
				>
				<label
					><span>Email</span><input
						{...selectedStudentId
							? updateStudentForm().fields.email.as('email')
							: createStudentForm().fields.email.as('email')}
						bind:value={studentDraft.email}
					/></label
				>
				<label
					><span>Telepon</span><input
						{...selectedStudentId
							? updateStudentForm().fields.phone.as('text')
							: createStudentForm().fields.phone.as('text')}
						bind:value={studentDraft.phone}
					/></label
				>
				<label
					><span>Alamat</span><input
						{...selectedStudentId
							? updateStudentForm().fields.address.as('text')
							: createStudentForm().fields.address.as('text')}
						bind:value={studentDraft.address}
					/></label
				>
				<label
					><span>Angkatan</span><input
						{...selectedStudentId
							? updateStudentForm().fields.yearAdmitted.as('number')
							: createStudentForm().fields.yearAdmitted.as('number')}
						bind:value={studentDraft.yearAdmitted}
					/></label
				>
				<label
					><span>Program studi</span><select
						{...selectedStudentId
							? updateStudentForm().fields.studyProgramId.as('select')
							: createStudentForm().fields.studyProgramId.as('select')}
						bind:value={studentDraft.studyProgramId}
						><option value="">Pilih program studi</option
						>{#if studyProgramsIssue && !studyPrograms.length}<option value="" disabled
								>{studyProgramsIssue}</option
							>{/if}{#each studyPrograms as item (item.id)}<option value={item.id}
								>{item.name}</option
							>{/each}</select
					>{#if studentDraft.studyProgramId}<span
							role="button"
							tabindex="0"
							class="editor-entity-link"
							onkeydown={handleKeyboardClick}
							onclick={(e) => {
								e.stopPropagation();
								onNavigateToEntity('studyPrograms', studentDraft.studyProgramId);
							}}>Lihat prodi</span
						>{/if}</label
				>
				{#if studentEditorBlocked}<p class="editor-note">
						Program studi harus tersedia sebelum data mahasiswa bisa disimpan.
					</p>{/if}
				<div class="editor-submit">
					<Button type="submit" class="primary-button" disabled={studentEditorBlocked}
						>{selectedStudentId ? 'Simpan perubahan' : 'Tambah mahasiswa'}</Button
					>
				</div>
			</form>
		{:else if editorView === 'students-bulk'}
			<form class="editor-grid" {...bulkUpdateStudentsEnhance}>
				<p class="editor-note">
					Ubah prodi dan angkatan {bulkCount} mahasiswa terpilih sekaligus. Kosongkan field yang tidak
					ingin diubah.
				</p>
				<input type="hidden" name="ids" value={[...bulkSelectedIds].join(',')} />
				<label
					><span>Program studi</span><select
						name="studyProgramId"
						bind:value={bulkEditStudentStudyProgramId}
						><option value="">Pilih program studi</option
						>{#each studyPrograms as item (item.id)}<option value={item.id}>{item.name}</option
							>{/each}</select
					>{#if bulkEditStudentStudyProgramId}<span
							role="button"
							tabindex="0"
							class="editor-entity-link"
							onkeydown={handleKeyboardClick}
							onclick={(e) => {
								e.stopPropagation();
								onNavigateToEntity('studyPrograms', bulkEditStudentStudyProgramId);
							}}>Lihat prodi</span
						>{/if}</label
				>
				<label
					><span>Angkatan</span><input
						type="number"
						name="yearAdmitted"
						min="1900"
						bind:value={bulkEditStudentYearAdmitted}
					/></label
				>
				<div class="builder-inline-actions">
					<Button
						type="button"
						variant="ghost"
						class="ghost-button"
						onclick={() => {
							onBulkClear();
							onStopEditing();
						}}>Batal</Button
					>
					<Button
						type="submit"
						class="primary-button"
						disabled={(bulkUpdateStudentsForm().pending ?? 0) > 0}
						>Simpan perubahan {bulkCount} mahasiswa</Button
					>
				</div>
			</form>
		{:else}
			<p class="empty-copy">
				Pilih satu mahasiswa untuk melihat profil, atau tambahkan mahasiswa baru saat data aktif
				berubah.
			</p>
		{/if}
	</section>
</div>
