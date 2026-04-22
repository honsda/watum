<script lang="ts">
	import './layout.css';
	import '$lib/client/auth';
	import favicon from '$lib/assets/favicon.svg';
	import soraLatin from '@fontsource-variable/sora/files/sora-latin-wght-normal.woff2';
	import publicSansLatin from '@fontsource-variable/public-sans/files/public-sans-latin-wght-normal.woff2';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="preload" href={soraLatin} as="font" type="font/woff2" crossorigin="anonymous" />
	<link rel="preload" href={publicSansLatin} as="font" type="font/woff2" crossorigin="anonymous" />
</svelte:head>
{@render children()}
