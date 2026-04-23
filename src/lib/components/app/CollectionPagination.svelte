<script lang="ts">
	import { ChevronLeft, ChevronRight } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button/index.js';

	let {
		label = 'data',
		pageNumber = 1,
		canPrevious = false,
		limit = 0,
		itemCount = 0,
		hasMore = false,
		loading = false,
		onPrevious = () => {},
		onNext = () => {}
	}: {
		label?: string;
		pageNumber?: number;
		canPrevious?: boolean;
		limit?: number;
		itemCount?: number;
		hasMore?: boolean;
		loading?: boolean;
		onPrevious?: () => void;
		onNext?: () => void;
	} = $props();

	const visibleCount = $derived(itemCount > 0 ? `${itemCount}` : '0');
</script>

<div class="collection-pagination">
	<p class="collection-pagination-copy">
		{#if itemCount > 0}
			Menampilkan {visibleCount} {label} pada halaman ini
		{:else if canPrevious}
			Halaman ini kosong. Kembali ke halaman sebelumnya untuk melihat {label}.
		{:else}
			Belum ada {label} untuk ditampilkan.
		{/if}
	</p>
	<div class="collection-pagination-actions">
		<Button
			variant="ghost"
			size="sm"
			class="ghost-button"
			disabled={loading || !canPrevious}
			onclick={onPrevious}
		>
			<ChevronLeft size={14} />
			Sebelumnya
		</Button>
		<span class="collection-pagination-page">Halaman {pageNumber}</span>
		<Button
			variant="ghost"
			size="sm"
			class="ghost-button"
			disabled={loading || !hasMore}
			onclick={onNext}
		>
			Berikutnya
			<ChevronRight size={14} />
		</Button>
	</div>
</div>

<style>
	.collection-pagination {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding-top: 0.75rem;
		border-top: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
	}

	.collection-pagination-copy {
		margin: 0;
		font-size: 0.88rem;
		color: var(--muted-foreground);
	}

	.collection-pagination-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.collection-pagination-page {
		font-size: 0.82rem;
		font-weight: 600;
		color: var(--muted-foreground);
	}

	@media (max-width: 720px) {
		.collection-pagination {
			flex-direction: column;
			align-items: stretch;
		}

		.collection-pagination-actions {
			justify-content: space-between;
		}
	}
</style>
