<script>
	import { Badge } from '$lib/components/ui/badge';
</script>

# Backend Guide

<Badge variant="secondary">MariaDB</Badge>

This page condenses the backend architecture that powers Watum’s academic scheduling workflows.

## Core Stack

| Area | Tools |
| --- | --- |
| Runtime | Bun |
| Database | MariaDB / MySQL |
| Driver | `mysql2/promise` |
| Auth | `jose`, refresh-token table, access JWTs |
| Validation | Valibot |
| Data boundary | SvelteKit Remote Functions |

## Current Database Snapshot

The currently configured database contains the following live counts:

| Table | Rows |
| --- | ---: |
| `faculties` | 3 |
| `study_programs` | 6 |
| `students` | 1,250,354 |
| `lecturers` | 251 |
| `courses` | 48 |
| `class_rooms` | 71,636 |
| `schedules` | 2,750,777 |
| `enrollments` | 2,750,777 |
| `grades` | 1,925,533 |
| `users` | 1,250,606 |
| `refresh_tokens` | 13 |

These numbers are a snapshot of the current configured environment. They are not universal constants and will change if the stress seed is rerun with different targets or overrides.

## Data Access Model

Watum does not expose a separate REST layer for normal app operations. Instead, route folders expose server-backed remote functions in `data.remote.ts`.

### Remote function roles

| Type | Purpose |
| --- | --- |
| `query` | reactive reads |
| `form` | validated mutations with field bindings |
| `command` | direct action calls such as delete/reset flows |

## Database Strategy

The backend is optimized around two realities:

1. normal CRUD screens need straightforward relational reads
2. conflict audit scans need fast grouped access over very large enrollment data sets

### Important denormalization

`enrollments` stores audit-oriented fields such as:

- `student_audit_sk`
- `course_audit_sk`
- `lecturer_audit_sk`
- `class_room_audit_sk`
- `schedule_day`
- `schedule_start_time`
- `schedule_end_time`
- `academic_year_start`
- `semester_sort`

This avoids repeated large joins for room, student, and lecturer conflict detection.

<div class="docs-callout">
	<strong>Why this matters</strong>
	<span>The conflict audit path is intentionally read-optimized and should not be simplified back to a purely normalized query shape without benchmark proof.</span>
</div>

## Authentication & Authorization

The app uses role-aware server checks in remote functions.

Typical access control boundaries:

- `ADMIN` can manage all academic entities
- `LECTURER` gets operational visibility without full account management
- `STUDENT` sees limited scheduling and grade views

Refresh tokens are stored server-side and access tokens are short-lived.

## Conflict Audit System

The conflict audit groups schedules by resource and time slot to detect:

- room double-bookings
- student overlap
- lecturer overlap

The frontend builder and calendar consume those summaries, but the authoritative aggregation lives in backend/database indexing strategy.

## Stress Seed Behavior

The stress seed no longer corresponds to one hard-coded table-count snapshot. Its current behavior is formula-driven:

- default target: `10,000,000` total rows
- `enrollments = students * 2 + floor((students + 4) / 5)`
- `schedules = enrollments`
- grades are created for roughly 70% of eligible enrollments
- `lecturers = max(48, ceil(students / 5000))`

That is why historical documentation that listed fixed stress counts can diverge from the live database.

## Operational Commands

```bash
bun run check
bun run build
bun run seed
bun run typesql
```

## Deployment Notes

- production uses `svelte-adapter-bun`
- proxy/cookie correctness depends on origin and forwarded-header configuration
- readiness and health endpoints are available for orchestration

## Source References

- Long-form backend reference: `BACKEND_GUIDE.md`
- Comprehensive technical document: `DOCUMENTATION.md`
- Stress generator: `stress-seed.ts`
- SQL and generated accessors: `src/lib/server/sql/`
- Route server entrypoints: `src/routes/**/data.remote.ts`
