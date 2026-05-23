# Watum Product Requirements

## Product Overview

Watum is an academic management web application built with SvelteKit. It supports authenticated management of academic entities including faculties, study programs, courses, lecturers, students, classrooms, enrollments, grades, users, and scheduling conflicts.

## Primary Users

- Academic administrators who manage institutional data and users.
- Academic staff who inspect schedules, enrollments, rooms, and conflicts.
- Test users validating public app availability, login, demo routes, and production readiness.

## Public Experience

- Unauthenticated users opening `/` should see a login form with email and password fields and a submit action labelled with Indonesian login copy such as `Masuk`.
- `/health` should respond successfully when the server is alive.
- `/ready` should respond successfully when the app is ready.
- `/demo/playwright` should render a visible heading and remain available in production preview.
- `/test` is internal and should not be exposed in production preview.

## Authentication

- Users log in with email and password credentials.
- Invalid credentials should show a clear error and keep the user on the login experience.
- Authenticated users should see role-appropriate navigation and app content.
- The app should maintain auth state through refresh/access-token behavior.

## Authenticated App Capabilities

- Dashboard: show academic summaries, schedule information, and conflict indicators.
- Faculties: search, create, edit, delete, and paginate records.
- Study Programs: search, create, edit, delete, and associate programs with faculties.
- Courses: search, create, edit, delete, and paginate course records.
- Lecturers: search, create, edit, delete lecturer records.
- Students: search, create, edit, delete, and associate students with study programs.
- Classrooms: search, create, edit, delete, and manage room type/capacity data.
- Enrollments: search/filter, create, edit, delete, choose schedule fields, and review conflict or availability feedback.
- Grades: search, create, edit, delete, and display calculated grade outcomes.
- Users: search, create, edit, delete users and manage role/identity fields.
- Calendar and Conflict Audit: inspect weekly schedules, room availability, and conflict details.
- Navigation and Theme: open/close responsive navigation, switch light/dark theme, and navigate between sections.

## Test Constraints

- Full authenticated CRUD coverage requires a reachable MySQL database, seeded data, and valid user credentials.
- Without test credentials, automated frontend testing should prioritize public routes, login form rendering, invalid-login behavior, health/readiness endpoints, demo route rendering, and production-only route exposure expectations.
