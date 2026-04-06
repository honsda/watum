# watum
**Watum (Website Akademik Terintegrasi untuk Mahasiswa)** is a website that integrates the KRS system with the university's class and schedule management framework, and end semester results.

Database assignment for [Studycase Group 10](https://github.com/partadox/praktikum-mysql-case/blob/main/kelompok10_akademik_b.md)

## Group 10
* Muhammad Abdullah
* Dharon Yusuf
* Hans Jovan

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
