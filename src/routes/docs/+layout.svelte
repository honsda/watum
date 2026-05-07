<script lang="ts">
	import { resolve } from '$app/paths';

	let { children } = $props();

	const sections = [
		{ href: '/docs', label: 'Overview', hint: 'Quickstart, structure, and key links.' },
		{
			href: '/docs/frontend',
			label: 'Frontend',
			hint: 'Remote functions, UI extraction, and client patterns.'
		},
		{
			href: '/docs/backend',
			label: 'Backend',
			hint: 'Database, auth, conflict audit, and operations.'
		}
	] as const;
</script>

<div class="docs-shell">
	<aside class="docs-sidebar">
		<p class="docs-kicker">Documentation</p>
		<h1>Watum Docs</h1>
		<p class="docs-copy">
			Product and engineering guides powered by mdsvex inside the SvelteKit app.
		</p>

		<nav class="docs-nav" aria-label="Documentation sections">
			{#each sections as section (section.href)}
				<a class="docs-link" href={resolve(section.href)}>
					<strong>{section.label}</strong>
					<span>{section.hint}</span>
				</a>
			{/each}
		</nav>
	</aside>

	<main class="docs-main">
		<article class="docs-prose">
			{@render children?.()}
		</article>
	</main>
</div>

<style>
	.docs-shell {
		display: grid;
		grid-template-columns: minmax(16rem, 20rem) minmax(0, 1fr);
		gap: 1.5rem;
		padding: 1.5rem;
		min-height: 100vh;
		background:
			radial-gradient(
				circle at top left,
				color-mix(in oklch, var(--color-accent-soft) 34%, transparent 66%),
				transparent 28%
			),
			var(--color-surface);
	}

	.docs-sidebar {
		display: grid;
		align-content: start;
		gap: 1rem;
		padding: 1.25rem;
		border: 1px solid var(--color-border);
		border-radius: 1rem;
		background: var(--color-panel);
		position: sticky;
		top: 1.5rem;
		height: fit-content;
	}

	.docs-kicker {
		margin: 0;
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--color-accent-strong);
	}

	.docs-sidebar h1,
	.docs-sidebar p {
		margin: 0;
	}

	.docs-sidebar h1 {
		font: 600 1.5rem/1.05 var(--font-display);
		letter-spacing: -0.04em;
	}

	.docs-copy {
		color: var(--color-muted-foreground);
		font-size: 0.95rem;
		line-height: 1.5;
	}

	.docs-nav {
		display: grid;
		gap: 0.65rem;
	}

	.docs-link {
		display: grid;
		gap: 0.18rem;
		padding: 0.8rem 0.9rem;
		border: 1px solid var(--color-border);
		border-radius: 0.85rem;
		background: var(--color-surface);
		color: inherit;
		text-decoration: none;
	}

	.docs-link:hover {
		border-color: color-mix(in oklch, var(--color-accent-strong) 28%, var(--color-border) 72%);
		background: color-mix(in oklch, var(--color-surface) 84%, var(--color-accent-soft) 16%);
	}

	.docs-link strong {
		font-size: 0.95rem;
	}

	.docs-link span {
		font-size: 0.84rem;
		line-height: 1.4;
		color: var(--color-muted-foreground);
	}

	.docs-main {
		min-width: 0;
	}

	.docs-prose {
		padding: 1.5rem clamp(1rem, 2vw, 2rem);
		border: 1px solid var(--color-border);
		border-radius: 1rem;
		background: var(--color-panel);
	}

	:global(.docs-prose > :first-child) {
		margin-top: 0;
	}

	:global(.docs-prose > :last-child) {
		margin-bottom: 0;
	}

	:global(.docs-prose h1),
	:global(.docs-prose h2),
	:global(.docs-prose h3) {
		font-family: var(--font-display);
		letter-spacing: -0.03em;
		line-height: 1.1;
	}

	:global(.docs-prose h1) {
		font-size: clamp(2rem, 3vw, 2.75rem);
		margin: 0 0 1rem;
	}

	:global(.docs-prose h2) {
		font-size: clamp(1.35rem, 2vw, 1.8rem);
		margin: 2rem 0 0.8rem;
	}

	:global(.docs-prose h3) {
		font-size: 1.1rem;
		margin: 1.4rem 0 0.6rem;
	}

	:global(.docs-prose p),
	:global(.docs-prose li),
	:global(.docs-prose blockquote) {
		font-size: 0.98rem;
		line-height: 1.65;
	}

	:global(.docs-prose p),
	:global(.docs-prose ul),
	:global(.docs-prose ol),
	:global(.docs-prose pre),
	:global(.docs-prose table),
	:global(.docs-prose blockquote) {
		margin: 0 0 1rem;
	}

	:global(.docs-prose ul),
	:global(.docs-prose ol) {
		padding-left: 1.25rem;
	}

	:global(.docs-prose a) {
		color: var(--color-accent-strong);
		text-underline-offset: 2px;
	}

	:global(.docs-prose code) {
		padding: 0.15rem 0.35rem;
		border-radius: 0.45rem;
		background: color-mix(in oklch, var(--color-surface) 76%, var(--color-border) 24%);
		font-size: 0.92em;
	}

	:global(.docs-prose pre) {
		overflow-x: auto;
		padding: 1rem;
		border: 1px solid var(--color-border);
		border-radius: 0.85rem;
		background: color-mix(in oklch, var(--color-panel) 82%, black 18%);
	}

	:global(.docs-prose pre code) {
		padding: 0;
		background: transparent;
	}

	:global(.docs-prose table) {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.95rem;
	}

	:global(.docs-prose th),
	:global(.docs-prose td) {
		padding: 0.7rem 0.8rem;
		border: 1px solid var(--color-border);
		text-align: left;
		vertical-align: top;
	}

	:global(.docs-prose th) {
		background: color-mix(in oklch, var(--color-surface) 82%, var(--color-border) 18%);
	}

	:global(.docs-prose blockquote) {
		padding: 0.85rem 1rem;
		border-left: 3px solid var(--color-accent-strong);
		border-radius: 0.75rem;
		background: color-mix(in oklch, var(--color-surface) 88%, var(--color-accent-soft) 12%);
		color: var(--color-muted-foreground);
	}

	:global(.docs-callout) {
		display: grid;
		gap: 0.35rem;
		padding: 1rem;
		margin: 1rem 0;
		border: 1px solid color-mix(in oklch, var(--color-accent-strong) 26%, var(--color-border) 74%);
		border-radius: 0.85rem;
		background: color-mix(in oklch, var(--color-surface) 86%, var(--color-accent-soft) 14%);
	}

	:global(.docs-callout strong) {
		font-size: 0.95rem;
	}

	:global(.docs-grid) {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
		gap: 0.85rem;
		margin: 1rem 0 1.25rem;
	}

	:global(.docs-card) {
		display: grid;
		gap: 0.35rem;
		padding: 1rem;
		border: 1px solid var(--color-border);
		border-radius: 0.85rem;
		background: var(--color-surface);
	}

	:global(.docs-card p) {
		margin: 0;
	}

	@media (max-width: 960px) {
		.docs-shell {
			grid-template-columns: minmax(0, 1fr);
		}

		.docs-sidebar {
			position: static;
		}
	}
</style>
