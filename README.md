# Watum

**Watum (Website Akademik Terintegrasi untuk Mahasiswa)** is an academic scheduling and management system for Indonesian university workflows.

It covers:

- student, lecturer, faculty, and study program records
- course and classroom management
- enrollment / KRS scheduling
- grade management
- role-based access for admin, lecturer, and student users

## In-App Documentation

The project now ships with an mdsvex-powered documentation section inside the app:

- `/docs` - overview and quickstart
- `/docs/frontend` - frontend architecture and remote-function patterns
- `/docs/backend` - backend, database, and operations overview

Repository reference files still exist for long-form detail:

- `docs/REMOTE_FUNCTIONS_GUIDE.md`
- `BACKEND_GUIDE.md`
- `DOCUMENTATION.md`

## Development

```bash
bun install
bun run dev
```

## Verification

```bash
bun run check
bun run build
```

## Deployment

Production uses `svelte-adapter-bun`.

For infrastructure and backend runtime details, use:

- `/docs/backend`
- `BACKEND_GUIDE.md`

## Group 10

- Muhammad Abdullah
- Dharon Yusuf
- Hans Jovan
