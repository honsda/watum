<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<div class="flex items-center gap-3">
	<a href={resolve('/demo/playwright')}>Buka demo Playwright</a>
	<button type="button" onclick={() => window.location.reload()}>Refresh</button>
</div>
