<script lang="ts">
	import type { ViewId } from '$lib/app/navigation';
	import type { SelectUsersResult } from '$lib/server/sql';
	import CollectionPagination from '$lib/components/app/CollectionPagination.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Search, X } from '@lucide/svelte';
	import './crud-view.css';

	type EnhancedAction = {
		action: string;
		method: 'POST';
		[key: symbol]: (node: HTMLFormElement) => void;
	};

	type PaginationState = {
		pageNumber: number;
		history: Array<string | null>;
		limit: number;
		itemCount: number;
		hasMore: boolean;
		loading: boolean;
	};

	let {
		userSearch = $bindable(''),
		filteredUsers,
		selectedUserId,
		selectedUser,
		selectedUserIds,
		bulkUserRole = $bindable<'ADMIN' | 'STUDENT' | 'LECTURER'>('STUDENT'),
		bulkUserPassword = $bindable(''),
		userDraft = $bindable({
			id: '',
			email: '',
			password: '',
			role: 'ADMIN',
			studentId: '',
			lecturerId: ''
		}),
		editorView,
		collectionPagination,
		updateUserEnhance,
		bulkUpdateUserRoleEnhance,
		bulkResetPasswordEnhance,
		bulkResetPasswordsPending = false,
		onSearchInput,
		onClearSearch,
		onClearSelection,
		onOpenBulkRole,
		onOpenBulkPassword,
		onOpenBulkDelete,
		onToggleAllUsers,
		onToggleUser,
		onPickUser,
		handleKeyboardClick,
		onNavigateToEntity,
		onBeginEdit,
		onStopEditing,
		onPagePrevious,
		onPageNext
	}: {
		userSearch: string;
		filteredUsers: SelectUsersResult[];
		selectedUserId: string | null;
		selectedUser: SelectUsersResult | null;
		selectedUserIds: Set<string>;
		bulkUserRole: 'ADMIN' | 'STUDENT' | 'LECTURER';
		bulkUserPassword: string;
		userDraft: {
			id: string;
			email: string;
			password: string;
			role: string;
			studentId: string;
			lecturerId: string;
		};
		editorView: string | null;
		collectionPagination: PaginationState;
		updateUserEnhance: EnhancedAction;
		bulkUpdateUserRoleEnhance: EnhancedAction;
		bulkResetPasswordEnhance: EnhancedAction;
		bulkResetPasswordsPending: boolean;
		onSearchInput: () => void;
		onClearSearch: () => void;
		onClearSelection: () => void;
		onOpenBulkRole: () => void;
		onOpenBulkPassword: () => void;
		onOpenBulkDelete: () => void;
		onToggleAllUsers: () => void;
		onToggleUser: (id: string) => void;
		onPickUser: (item: SelectUsersResult) => void;
		handleKeyboardClick: (event: KeyboardEvent) => void;
		onNavigateToEntity: (view: ViewId, id: string | null | undefined, name?: string) => void;
		onBeginEdit: () => void;
		onStopEditing: () => void;
		onPagePrevious: () => void;
		onPageNext: () => void;
	} = $props();
</script>

<div class="workspace-shell">
	<section class="workspace-list">
		<div class="pane-head">
			<div>
				<h3>Akun pengguna</h3>
			</div>
		</div>
		<label class="search-box"
			><Search size={16} /><input
				bind:value={userSearch}
				oninput={onSearchInput}
				aria-label="Cari akun pengguna"
				placeholder="Cari email atau pemilik akun"
			/>{#if userSearch}<button type="button" class="search-clear" onclick={onClearSearch}
					><X size={14} /></button
				>{/if}</label
		>
		{#if selectedUserIds.size > 0}
			<div class="bulk-bar">
				<span class="bulk-count">{selectedUserIds.size} akun dipilih</span>
				<div class="bulk-actions">
					<Button variant="ghost" size="sm" class="ghost-button" onclick={onClearSelection}
						>Batal</Button
					>
					<Button variant="ghost" size="sm" class="ghost-button" onclick={onOpenBulkRole}
						>Ubah peran</Button
					>
					<Button variant="ghost" size="sm" class="ghost-button" onclick={onOpenBulkPassword}
						>Reset password</Button
					>
					<Button variant="destructive" size="sm" class="danger-button" onclick={onOpenBulkDelete}
						>Hapus</Button
					>
				</div>
			</div>
		{/if}
		<div class="list-stack">
			{#if filteredUsers.length > 1}
				<label class="list-row select-all-row">
					<input
						type="checkbox"
						checked={selectedUserIds.size === filteredUsers.length && filteredUsers.length > 0}
						onchange={onToggleAllUsers}
					/>
					<span>Pilih semua ({filteredUsers.length})</span>
				</label>
			{/if}
			{#each filteredUsers as item (item.id)}
				<div
					class="list-row user-row"
					class:selected={selectedUserId === item.id}
					class:checked={item.id != null && selectedUserIds.has(item.id)}
				>
					<label class="row-checkbox"
						><input
							type="checkbox"
							checked={item.id != null && selectedUserIds.has(item.id)}
							onchange={() => item.id && onToggleUser(item.id)}
							onclick={(e) => e.stopPropagation()}
						/></label
					>
					<div
						role="button"
						tabindex="0"
						class="row-content"
						onkeydown={handleKeyboardClick}
						onclick={() => onPickUser(item)}
					>
						<div>
							<strong>{item.email}</strong>
							<span>
								{#if item.student_name}
									<span
										role="button"
										tabindex="0"
										class="entity-link"
										onkeydown={handleKeyboardClick}
										onclick={(e) => {
											e.stopPropagation();
											onNavigateToEntity(
												'students',
												item.student_id,
												item.student_name ?? undefined
											);
										}}>{item.student_name}</span
									>
								{:else if item.lecturer_name}
									<span
										role="button"
										tabindex="0"
										class="entity-link"
										onkeydown={handleKeyboardClick}
										onclick={(e) => {
											e.stopPropagation();
											onNavigateToEntity(
												'lecturers',
												item.lecturer_id,
												item.lecturer_name ?? undefined
											);
										}}>{item.lecturer_name}</span
									>
								{:else}
									Administrator sistem
								{/if}
							</span>
						</div>
						<small>{item.role}</small>
					</div>
				</div>
			{/each}
		</div>
		<CollectionPagination
			label="akun"
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
				<h3>{selectedUser ? selectedUser.email : 'Pilih akun'}</h3>
			</div>
			<div class="detail-actions">
				{#if editorView === 'users'}
					<Button variant="ghost" size="sm" class="ghost-button" onclick={onStopEditing}
						>Tutup form</Button
					>
				{:else if selectedUser}
					<Button variant="ghost" size="sm" class="ghost-button" onclick={onBeginEdit}
						>Ubah akun</Button
					>
				{/if}
			</div>
		</div>
		{#if selectedUser && editorView !== 'users'}
			<div class="detail-stack">
				<div class="detail-lines">
					<div><span>Peran</span><strong>{selectedUser.role}</strong></div>
					<div>
						<span>Mahasiswa</span><span
							role="button"
							tabindex="0"
							class="entity-link"
							onkeydown={handleKeyboardClick}
							onclick={(e) => {
								e.stopPropagation();
								onNavigateToEntity(
									'students',
									selectedUser.student_id,
									selectedUser.student_name ?? undefined
								);
							}}><strong>{selectedUser.student_name ?? '-'}</strong></span
						>
					</div>
					<div>
						<span>Dosen</span><span
							role="button"
							tabindex="0"
							class="entity-link"
							onkeydown={handleKeyboardClick}
							onclick={(e) => {
								e.stopPropagation();
								onNavigateToEntity(
									'lecturers',
									selectedUser.lecturer_id,
									selectedUser.lecturer_name ?? undefined
								);
							}}><strong>{selectedUser.lecturer_name ?? '-'}</strong></span
						>
					</div>
				</div>
				<p class="detail-hint">
					Tinjau relasi akun lebih dahulu agar perubahan akses dilakukan dengan konteks yang jelas.
				</p>
			</div>
		{:else if selectedUser && editorView === 'users'}
			<form class="editor-grid" {...updateUserEnhance}>
				<p class="editor-note">
					Perubahan akun memengaruhi akses login. Tinjau peran dan relasi identitas sebelum
					menyimpan.
				</p>
				<input type="hidden" name="id" bind:value={userDraft.id} />
				<label
					><span>Email</span><input
						name="email"
						type="email"
						autocomplete="email"
						bind:value={userDraft.email}
					/></label
				>
				<label
					><span>Password baru</span><input
						name="password"
						type="password"
						autocomplete="new-password"
						bind:value={userDraft.password}
						placeholder="Biarkan kosong jika password lama tetap dipakai"
					/></label
				>
				<label
					><span>Peran akses</span><select name="role" bind:value={userDraft.role}
						><option value="ADMIN">ADMIN</option><option value="STUDENT">STUDENT</option><option
							value="LECTURER">LECTURER</option
						></select
					></label
				>
				<label
					><span>ID mahasiswa terkait</span><input
						name="studentId"
						bind:value={userDraft.studentId}
					/></label
				>
				<label
					><span>ID dosen terkait</span><input
						name="lecturerId"
						bind:value={userDraft.lecturerId}
					/></label
				>
				<div class="editor-submit">
					<Button type="submit" class="primary-button">Simpan akun</Button>
				</div>
			</form>
		{:else if editorView === 'users-bulk-role'}
			<form class="editor-grid" {...bulkUpdateUserRoleEnhance}>
				<p class="editor-note">
					Ubah peran {selectedUserIds.size} akun terpilih sekaligus. Perubahan berlaku pada sesi berikutnya.
				</p>
				<input type="hidden" name="ids" value={[...selectedUserIds].join(',')} />
				<label
					><span>Peran baru</span><select name="role" bind:value={bulkUserRole}
						><option value="ADMIN">Admin</option><option value="STUDENT">Mahasiswa</option><option
							value="LECTURER">Dosen</option
						></select
					></label
				>
				<div class="builder-inline-actions">
					<Button type="button" variant="ghost" class="ghost-button" onclick={onClearSelection}
						>Batal</Button
					>
					<Button type="submit" class="primary-button"
						>Simpan peran {selectedUserIds.size} akun</Button
					>
				</div>
			</form>
		{:else if editorView === 'users-bulk-password'}
			<form class="editor-grid" {...bulkResetPasswordEnhance}>
				<p class="editor-note">
					Reset password {selectedUserIds.size} akun terpilih. Semua sesi aktif akan dibatalkan.
				</p>
				<input type="hidden" name="ids" value={[...selectedUserIds].join(',')} />
				<label
					><span>Password baru</span><input
						type="password"
						name="password"
						bind:value={bulkUserPassword}
						minlength="8"
						placeholder="Minimal 8 karakter"
					/></label
				>
				<div class="builder-inline-actions">
					<Button type="button" variant="ghost" class="ghost-button" onclick={onClearSelection}
						>Batal</Button
					>
					<Button
						type="submit"
						class="primary-button"
						disabled={bulkResetPasswordsPending || bulkUserPassword.length < 8}
						>Reset password {selectedUserIds.size} akun</Button
					>
				</div>
			</form>
		{:else}
			<p class="empty-copy">
				Pilih satu akun untuk memperbarui email, peran, atau relasi identitas.
			</p>
		{/if}
	</section>
</div>
