# watum

**Watum (Website Akademik Terintegrasi untuk Mahasiswa)** is a website that integrates the KRS system with the university's class and schedule management framework, and end semester results.

Database assignment for [Studycase Group 10](https://github.com/partadox/praktikum-mysql-case/blob/main/kelompok10_akademik_b.md)

## Documentation

- Frontend guide: `docs/REMOTE_FUNCTIONS_GUIDE.md`
- Backend guide: `BACKEND_GUIDE.md`

## Group 10

- Muhammad Abdullah
- Dharon Yusuf
- Hans Jovan

# sv

**Watum (Website Akademik Terintegrasi untuk Mahasiswa)** is a website that integrates the KRS system with the university's class and schedule management framework, and end semester results.

Database assignment for [Studycase Group 10](https://github.com/partadox/praktikum-mysql-case/blob/main/kelompok10_akademik_b.md)

## Database Configuration

### Development Database

The project uses **MySQL/MariaDB** for development. The connection string is configured in `.env`:

```env
DATABASE_URL="mysql://mariadb:dharon1234@coolify.bumimas12.web.id:5432/"
```

### Database Migrations

```sh
# Generate migration from schema changes
npx prisma migrate dev --name <migration_name>

# Deploy migrations to database
npx prisma migrate deploy

# Open Prisma Studio (database GUI)
npx prisma studio
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```sh
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.

## Deploying To Coolify

This repository includes a production `Dockerfile` for Coolify deployment.

Use these settings in Coolify:

- Build method: `Dockerfile`
- Port: `3000`
- Start command: use Dockerfile default (`./docker-entrypoint.sh`)
- Health check path: `/health`

Optional readiness check:

- Readiness path: `/ready` (returns `503` if database is unavailable)

Required environment variables:

```env
NODE_ENV=production
PORT=3000
AUTO_APPLY_MIGRATIONS=true
DB_HOST=<mysql-host>
DB_PORT=3306
DB_USER=<mysql-user>
DB_PASSWORD=<mysql-password>
DB_NAME=<mysql-database>
JWT_SECRET=<long-random-secret>
ORIGIN=https://your-domain.example.com
PROTOCOL_HEADER=x-forwarded-proto
HOST_HEADER=x-forwarded-host
PORT_HEADER=x-forwarded-port
# Optional:
# JWT_ISSUER=watum
```

Alternative origin setup for Coolify:

```env
# Option 2 (Coolify magic variable)
# Leave ORIGIN empty and set COOLIFY_FQDN in Coolify. The container entrypoint
# will auto-derive ORIGIN as https://<first COOLIFY_FQDN value>.
COOLIFY_FQDN=your-domain.example.com
```

Notes:

- The app runtime DB connection uses `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, and `DB_PORT`.
- On container startup, `docker-entrypoint.sh` automatically runs pending SQL migrations before starting the app. Set `AUTO_APPLY_MIGRATIONS=false` to disable that behavior.
- `JWT_SECRET` is required to sign and verify short-lived access JWTs.
- `JWT_ISSUER` is optional and can be used to pin token issuer verification across environments.
- Refresh tokens are stored server-side in `refresh_tokens` and sent as secure `httpOnly` cookies on the `/auth` path.
- Automatic migration apply tracks executed files in `schema_migrations`, so container restarts only apply new SQL files.
- `ORIGIN` plus the forwarded-header variables are required so SvelteKit generates correct same-origin remote-function URLs behind Coolify's proxy.
- `DATABASE_URL` can still be used for Prisma CLI workflows, but runtime queries use the variables above.
- The runtime image includes `curl` for connectivity checks in Coolify terminal.
