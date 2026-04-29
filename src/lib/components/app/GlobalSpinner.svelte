<script lang="ts">
	import { getLoadingState } from '$lib/client/loading.svelte';
	import { Loader2 } from '@lucide/svelte';

	const loading = getLoadingState();
</script>

{#if loading.isLoading}
	<div
		class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/20 backdrop-blur-[1px] transition-opacity"
		role="status"
		aria-live="polite"
		aria-busy="true"
	>
		<div class="flex flex-col items-center gap-3 rounded-xl bg-white px-8 py-6 shadow-lg">
			<Loader2 class="h-8 w-8 animate-spin text-slate-700" />
			<span class="text-sm font-medium text-slate-600">Loading...</span>
		</div>
	</div>
{/if}
