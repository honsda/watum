<script>
	import { Badge } from '$lib/components/ui/badge';
</script>

# Watum Documentation

<Badge>mdsvex</Badge>

This documentation is now rendered inside the app with **mdsvex**, so the guides can use Markdown, tables, fenced code blocks, and Svelte components in one place.

<div class="docs-callout">
	<strong>What changed</strong>
	<span>The docs are no longer only standalone repository files. The main guides now live under <code>/docs</code> and can evolve with the product UI.</span>
</div>

## Start Here

<div class="docs-grid">
	<a class="docs-card" href="/docs/frontend">
		<strong>Frontend Guide</strong>
		<p>Remote functions, extracted app views, shared styling, and client-side patterns.</p>
	</a>
	<a class="docs-card" href="/docs/backend">
		<strong>Backend Guide</strong>
		<p>Database architecture, auth, conflict audit design, and operations notes.</p>
	</a>
</div>

## Current Stack

| Area | Primary Tools |
| --- | --- |
| App framework | SvelteKit 2.x, Svelte 5 runes |
| Styling | Tailwind CSS v4, shadcn-svelte, shared app CSS |
| Runtime | Bun |
| Database | MariaDB / MySQL with `mysql2` |
| Validation | Valibot |
| Docs | `mdsvex` + `remark-gfm` |

## Current Database Snapshot

The currently configured development/stress database contains:

| Table | Rows |
| --- | ---: |
| `students` | 1,250,354 |
| `lecturers` | 251 |
| `courses` | 48 |
| `class_rooms` | 71,636 |
| `schedules` | 2,750,777 |
| `enrollments` | 2,750,777 |
| `grades` | 1,925,533 |
| `users` | 1,250,606 |
| `refresh_tokens` | 13 |

These values are environment-specific snapshots, not fixed schema constants.

## Development Commands

```bash
bun install
bun run dev
bun run check
bun run build
```

## Documentation Sources

The new mdsvex pages are based on the existing repository guides:

- `README.md`
- `docs/REMOTE_FUNCTIONS_GUIDE.md`
- `BACKEND_GUIDE.md`
- `DOCUMENTATION.md`

Those files can still exist as long-form references, but `/docs` is now the main in-app entry point.

## Why mdsvex

- Keeps engineering docs close to the app
- Supports rich Markdown tables and code fences
- Allows Svelte components inside docs pages
- Makes product-facing documentation routes possible without a separate site

## Quick Orientation

1. Read the frontend guide if you are working on route extraction, forms, or UI composition.
2. Read the backend guide if you are changing remote functions, schema design, audit logic, or stress seeding.
3. Use `bun run check` and `bun run build` after documentation-related app changes, because docs pages now compile as part of the app.
