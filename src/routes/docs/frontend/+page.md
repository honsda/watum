<script>
	import { Badge } from '$lib/components/ui/badge';
</script>

# Frontend Guide

<Badge variant="secondary">Remote Functions</Badge>

This page summarizes the current frontend architecture for Watum after the view extraction work.

## App Shape

The main app still uses a single authenticated route entry at `src/routes/+page.svelte`, but large sections of UI have now been extracted into focused view components under `src/lib/components/app/`.

The extracted app currently exposes these role-aware surfaces from the root controller:

- dashboard
- weekly calendar
- scheduling builder
- classrooms
- courses
- students
- lecturers
- faculties
- study programs
- enrollments / KRS
- grades
- user accounts

Navigation metadata for those surfaces now lives in `src/lib/app/navigation.ts`.

### Extracted Views

- `DashboardView.svelte`
- `CalendarView.svelte`
- `BuilderView.svelte`
- `ClassroomsView.svelte`
- `CoursesView.svelte`
- `StudentsView.svelte`
- `LecturersView.svelte`
- `FacultiesView.svelte`
- `StudyProgramsView.svelte`
- `EnrollmentsView.svelte`
- `GradesView.svelte`
- `UsersView.svelte`

## Shared Client Patterns

### Remote reads

Use route-local `query(...)` functions from `data.remote.ts` files for reads.

```ts
const current = getCourse(id);
const result = await getCourse(id).run();
```

### Forms

Forms are built around remote function field accessors plus shared enhancers.

```svelte
<form {...createCourseEnhance}>
	<input {...createCourse.fields.name.as('text')} />
</form>
```

The helper module `src/lib/client/form-enhancers.ts` now centralizes common success/error handling for those remote forms.

### Navigation metadata

App navigation labels and role-based view grouping now live in:

```ts
src/lib/app/navigation.ts
```

That keeps route rendering concerns separate from navigation/catalog concerns.

## Styling Model

The application now uses two layers of app UI styling:

| Layer | Purpose |
| --- | --- |
| `crud-view.css` | shared CRUD panel/list/editor styles used by extracted views |
| `page-shell.css` | shell-level layout, dashboard, calendar, builder, login, and shared surface styles |

The login page is also styled through the shared shell CSS now, with login-specific overrides layered on top of the shared `Card` primitives.

<div class="docs-callout">
	<strong>Important</strong>
	<span>After extraction, route-scoped Svelte CSS was moved into shared imported CSS so child components keep consistent styles without triggering unused-selector warnings.</span>
</div>

## Builder / Calendar Coupling

The scheduling builder and weekly calendar intentionally share state in the parent route for:

- active schedule filters
- selected enrollment / selected schedule
- conflict summaries
- room availability previews
- refresh orchestration

That means the extracted `BuilderView` is still a view component, not an isolated feature module with its own data store.

## Recommended Workflow For UI Changes

1. Keep data loading and mutation ownership in `+page.svelte` unless the state is truly local.
2. Prefer extracted view components for markup-heavy changes.
3. Put reusable styling in shared CSS files, not giant route-local `<style>` blocks.
4. Re-run both checks after structural UI work:

```bash
bun run check
bun run build
```

## Source References

- Legacy long-form frontend guide: `docs/REMOTE_FUNCTIONS_GUIDE.md`
- Main route/controller: `src/routes/+page.svelte`
- Extracted views: `src/lib/components/app/*.svelte`
- Navigation catalog: `src/lib/app/navigation.ts`
- Shared form helpers: `src/lib/client/form-enhancers.ts`
