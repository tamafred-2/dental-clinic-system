# Dental Clinic System Operations Handbook

This private local handbook explains how the system runs during development, how its components communicate, which commands are safe in each environment, and how the planned demonstration deployment works.

The handbook describes the repository as it currently exists. A section marked **Planned** is not implemented merely because deployment instructions are documented here.

## Contents

1. [Purpose and safety boundary](#1-purpose-and-safety-boundary)
2. [System architecture](#2-system-architecture)
3. [Requirements](#3-requirements)
4. [Project directories](#4-project-directories)
5. [First local setup](#5-first-local-setup)
6. [Environment variables](#6-environment-variables)
7. [Docker services](#7-docker-services)
8. [Prisma and PostgreSQL](#8-prisma-and-postgresql)
9. [Starting the application](#9-starting-the-application)
10. [Local addresses](#10-local-addresses)
11. [Daily development workflow](#11-daily-development-workflow)
12. [Appointment request flow](#12-appointment-request-flow)
13. [Admin dashboard](#13-admin-dashboard)
14. [Authentication and security](#14-authentication-and-security)
15. [Testing and validation](#15-testing-and-validation)
16. [Database changes and migrations](#16-database-changes-and-migrations)
17. [Seed data](#17-seed-data)
18. [Resetting local data](#18-resetting-local-data)
19. [Demonstration deployment architecture](#19-demonstration-deployment-architecture)
20. [Deploying PostgreSQL](#20-deploying-postgresql)
21. [Deploying the API](#21-deploying-the-api)
22. [Deploying the website](#22-deploying-the-website)
23. [Redis deployment status](#23-redis-deployment-status)
24. [n8n deployment status](#24-n8n-deployment-status)
25. [Production domains and cookies](#25-production-domains-and-cookies)
26. [Production migrations and seed policy](#26-production-migrations-and-seed-policy)
27. [Deployment verification](#27-deployment-verification)
28. [Backups and recovery](#28-backups-and-recovery)
29. [Common errors](#29-common-errors)
30. [Command reference](#30-command-reference)
31. [Release checklist](#31-release-checklist)
32. [Git and private documentation](#32-git-and-private-documentation)

---

## 1. Purpose and safety boundary

This repository is currently suitable for local development and synthetic demonstrations.

Do not accept real patient information on a free demonstration deployment. Real clinic use requires reviewed hosting, HTTPS, backups, monitoring, access auditing, retention rules, incident procedures, and a privacy and security assessment.

Use these environment boundaries:

| Environment  | Data                          | Infrastructure                      |
| ------------ | ----------------------------- | ----------------------------------- |
| Development  | Synthetic only                | Local Docker and local applications |
| Staging/demo | Synthetic only                | Hosted preview services             |
| Production   | Real data only after approval | Paid and reviewed services          |

PostgreSQL is always the source of truth. Redis must never become the permanent store for patients or appointments.

---

## 2. System architecture

### Local development

```text
Browser
  |
  | http://localhost:3000
  v
Next.js website
  |
  | http://127.0.0.1:4000/api
  v
NestJS API
  |
  +---- Prisma ----> PostgreSQL 127.0.0.1:5432
  |
  +---- future ----> Redis 127.0.0.1:6379

n8n runs separately at 127.0.0.1:5678 for future automation work.
```

Responsibilities:

- Next.js renders the public website and staff dashboard.
- NestJS owns validation, authorization, scheduling rules, and database access.
- Prisma maps application operations to PostgreSQL queries and migrations.
- PostgreSQL stores clinic, user, patient, schedule, and appointment records.
- Redis is available locally but is not yet connected to application caching.
- n8n is available locally but production workflows are not yet enabled.

---

## 3. Requirements

Install:

- Node.js `20.9.0` or newer. The current machine uses Node.js 24.
- npm, included with Node.js.
- Docker Desktop with the Linux container engine running.
- Git.
- PowerShell on Windows.

Confirm the tools:

```powershell
node --version
npm --version
docker --version
docker compose version
git --version
```

If PowerShell blocks `npm.ps1`, either use the `npm.cmd` executable or configure an appropriate PowerShell execution policy for your own account. Normal project commands in this handbook use `npm`.

Run repository commands from:

```text
C:\Users\TUF\Projects\Client\dental-clinic-system
```

---

## 4. Project directories

```text
apps/
  api/                NestJS backend
  web/                Next.js website and admin dashboard
  worker/             Future background worker
prisma/
  migrations/         Committed database history
  schema.prisma       Database design
  seed.ts             Synthetic demonstration data
docker-compose.yml    Local PostgreSQL, Redis, and n8n
prisma.config.ts      Prisma schema, migration, seed, and datasource settings
.env.example          Safe environment-variable template
.env                  Local secrets; never committed
```

---

## 5. First local setup

Open PowerShell in the project root, then run each command separately:

```powershell
npm install
Copy-Item .env.example .env
docker compose up -d
npx prisma generate
npx prisma migrate dev
npx prisma db seed
```

What they do:

1. `npm install` installs all workspace dependencies using the root lockfile.
2. `Copy-Item` creates the private local environment file.
3. `docker compose up -d` starts PostgreSQL, Redis, and n8n in the background.
4. `prisma generate` creates the typed Prisma client from the schema.
5. `prisma migrate dev` applies committed migrations to the local database.
6. `prisma db seed` inserts synthetic clinic demonstration records.

Check Docker afterward:

```powershell
docker compose ps
```

PostgreSQL should say `healthy`.

---

## 6. Environment variables

The local `.env` should follow `.env.example`:

```dotenv
NODE_ENV=development

NEXT_PUBLIC_API_URL=http://localhost:4000
WEB_ORIGIN=http://localhost:3000

API_PORT=4000
API_HOST=127.0.0.1

DATABASE_URL=postgresql://postgres:postgres@localhost:5432/dental_clinic
SESSION_TTL_DAYS=7

REDIS_URL=redis://localhost:6379
```

Rules:

- `NEXT_PUBLIC_*` values are visible to browser JavaScript. Never put secrets in them.
- `WEB_ORIGIN` must be one exact origin without a trailing slash.
- Production `WEB_ORIGIN` must use HTTPS.
- Keep `API_HOST=127.0.0.1` locally.
- Do not define `PORT` locally unless testing hosting behavior.
- Never commit `.env`.
- Rotate any credential that appears in Git, logs, screenshots, or frontend code.

OpenAI, Gmail, Meta, n8n, Turnstile, and hosted Redis variables should remain empty until their corresponding integration is implemented and tested.

The knowledge index uses the free local embedding provider by default. Set `KNOWLEDGE_EMBEDDING_PROVIDER=openai` only when an OpenAI key is configured, then run the protected knowledge reindex endpoint so stored vectors match the selected model.

---

## 7. Docker services

Start or recreate local services:

```powershell
docker compose up -d
```

Show status:

```powershell
docker compose ps
```

Show logs:

```powershell
docker compose logs postgres
docker compose logs redis
docker compose logs n8n
```

Stop containers while keeping data:

```powershell
docker compose down
```

Stop containers and permanently delete their named volumes:

```powershell
docker compose down -v
```

`-v` is a destructive fresh-start operation. It deletes the local PostgreSQL database, Redis data, and n8n configuration stored in Docker volumes. Do not use it when local data must be preserved.

All Compose ports bind to `127.0.0.1`, preventing normal access from other devices on the network.

---

## 8. Prisma and PostgreSQL

Validate the schema:

```powershell
npx prisma validate
```

Check migration status:

```powershell
npx prisma migrate status
```

Generate the Prisma client:

```powershell
npx prisma generate
```

`generate` does not create tables or insert data. It only updates the generated application client.

Open the database viewer:

```powershell
npx prisma studio
```

Use the exact URL printed by Prisma Studio. Its port may change. Database tables can have multiple pages, so check the pagination controls before assuming a record is missing.

---

## 9. Starting the application

Use separate terminals.

Terminal 1 — API:

```powershell
npm run start:dev -w @dental/api
```

Terminal 2 — website:

```powershell
npm run dev -w @dental/web
```

The API watches TypeScript files and restarts after backend changes. The website uses Next.js fast refresh.

To test compiled production behavior locally:

```powershell
npm run build -w @dental/api
npm run start:prod -w @dental/api
```

Do not start a second API while port 4000 is already occupied.

---

## 10. Local addresses

| Component     | Address                             | Purpose                                 |
| ------------- | ----------------------------------- | --------------------------------------- |
| Website       | `http://localhost:3000`             | Public clinic website                   |
| Admin login   | `http://localhost:3000/admin/login` | Staff sign-in                           |
| API health    | `http://localhost:4000/api`         | API readiness check                     |
| PostgreSQL    | `localhost:5432`                    | Database connection, not a browser page |
| Redis         | `localhost:6379`                    | Cache endpoint, not a browser page      |
| n8n           | `http://localhost:5678`             | Local automation UI                     |
| Prisma Studio | Printed by `npx prisma studio`      | Local database viewer                   |

`localhost:3000` is the frontend. `localhost:4000` is the backend API. Prisma Studio is only a database administration viewer, not the backend itself.

---

## 11. Daily development workflow

Typical start:

```powershell
docker compose up -d
npm run start:dev -w @dental/api
```

In another terminal:

```powershell
npm run dev -w @dental/web
```

Before stopping work:

```powershell
npm run lint
npm run test -w @dental/api -- --runInBand
npm run test:e2e -w @dental/api -- --runInBand
npm run build -w @dental/api
npm run build -w @dental/web
git status --short
```

Do not use `git add .` until private files, `.env`, generated output, and unrelated changes have been checked.

---

## 12. Appointment request flow

```text
Browser appointment form
  |
  v
POST /api/appointments
  |
  v
DTO validation and anti-spam checks
  |
  v
Clinic hours, blocked date, dentist schedule, and service checks
  |
  v
Serializable Prisma transaction
  |
  +-- patient identity/contact verification
  +-- dentist overlap check
  +-- patient overlap check
  +-- pending-request limit
  |
  v
PENDING appointment in PostgreSQL
```

The browser submission is a request, not an automatic confirmation. The clinic confirms it through the staff dashboard.

Appointment creation can correctly return:

- `400` for invalid input.
- `409` for a conflict or unavailable slot.
- `413` for an oversized body.
- `415` for a non-JSON body.
- `429` for too many requests.
- `500` or `503` for an unexpected server or infrastructure problem.

The API returns generic server errors and does not expose database stack traces.

---

## 13. Admin dashboard

Open:

```text
http://localhost:3000/admin/login
```

Use the synthetic development administrator created by `prisma/seed.ts`. Never reuse its password in staging or production.

Current dashboard capabilities:

- Daily appointment statistics.
- Date, dentist, and status filters.
- Paginated appointment calendar.
- Deliberate single-record contact detail access.
- Confirm appointment.
- Cancel with a required reason.
- Mark completed or no-show.
- Find live availability and reschedule.
- Open the channel-independent conversation inbox.
- Filter WEBSITE and FACEBOOK_MESSENGER records by status or assignment.
- Claim, release, close, and store attributable staff responses.
- Generate a bounded AI response for an unanswered patient message.
- Generate bounded AI replies using verified knowledge and controlled live-information tools.
- Move AI requests requiring judgment, sensitive support, or unsupported information to the human queue.

The appointment list omits email and phone. The protected single-appointment endpoint returns contact details only after authorized staff open that appointment.

Patients, notifications, settings, knowledge management, and audit-log pages remain future modules. Conversation storage, the protected staff inbox, and staff-triggered AI response storage are implemented. Live website/Messenger delivery remains later work.

The lower-cost default uses `AI_PROVIDER=openai`, `OPENAI_API_KEY`, and `OPENAI_MODEL=gpt-4o-mini` in the root `.env`. For synthetic-data testing, set `AI_PROVIDER=groq`, `GROQ_API_KEY`, and optionally `GROQ_MODEL=openai/gpt-oss-20b`. Provider selection is explicit; an OpenAI failure never silently sends a conversation to Groq. Never place AI keys in a `NEXT_PUBLIC_*` variable. Automated tests mock both providers and consume no API usage.

---

## 14. Authentication and security

Current controls include:

- Argon2id password hashing.
- Random server-side sessions with hashed stored tokens.
- HTTP-only, host-only, `SameSite=Strict` cookies.
- Secure cookies automatically in production.
- Exact CORS origin allowlisting.
- CSRF-style origin rejection for cookie-authenticated mutations.
- DTO allowlists and unknown-property rejection.
- JSON-only write bodies.
- Request size limits and rate limiting.
- Helmet and browser security headers.
- `Cache-Control: no-store` on API responses.
- ADMIN/STAFF authorization on appointment operations.
- Minimal Prisma selections to reduce accidental data exposure.
- Server-only AI provider credentials with bounded conversation context.
- No selected patient contact fields in AI requests; OpenAI response storage is disabled, and Groq is an explicit test-only selection.
- Structured AI response decisions, guarded persistence, and automatic human handoff for unsupported requests.
- Deterministic pre-provider AI guardrails for clinical advice, urgent symptoms, patient-record requests, and prompt injection; matching requests are escalated without sending patient content to an external model.
- Allow-listed, schema-validated AI tools with bounded tool rounds and outputs; the model never receives Prisma or database access.
- A two-step appointment tool flow: a 15-minute server-side intent followed by exact patient confirmation and privacy consent before the existing appointment business rules write a request.

Still required before public real-data use:

- Cloudflare Turnstile with server-side verification.
- Redis-backed shared rate limiting for multiple API instances.
- MFA for administrators.
- Audit logs and access review.
- Monitoring, backups, retention, and incident procedures.
- A production privacy and security review.
- AI red-team cases, quality evaluations, cost alerts, and the expanded Section 26 guardrails.

---

## 15. Testing and validation

API unit tests:

```powershell
npm run test -w @dental/api -- --runInBand
```

API security and HTTP E2E tests:

```powershell
npm run test:e2e -w @dental/api -- --runInBand
```

Lint one workspace:

```powershell
npm run lint -w @dental/api
npm run lint -w @dental/web
```

Lint every workspace that defines lint:

```powershell
npm run lint
```

Production builds:

```powershell
npm run build -w @dental/api
npm run build -w @dental/web
```

Dependency vulnerability report:

```powershell
npm audit --omit=dev
```

An audit result of zero means no known published vulnerabilities were returned for the inspected dependency tree. It is not a guarantee that the application has no security bugs.

---

## 16. Database changes and migrations

After deliberately changing `prisma/schema.prisma` during development:

```powershell
npx prisma migrate dev --name describe_the_change
npx prisma generate
```

Use a short snake-case migration name, for example:

```powershell
npx prisma migrate dev --name add_appointment_audit_log
```

Review the generated SQL under `prisma/migrations/` before committing it.

Never edit an already-applied shared migration to change history. Create a new migration.

---

## 17. Seed data

Run only the seed:

```powershell
npx prisma db seed
```

This does not automatically erase the database. The seed is designed for synthetic demonstration data and should be safe to rerun according to its current upsert/delete logic, but always review `prisma/seed.ts` after changing it.

The seed currently creates a demonstration clinic, administrator, dentists, services, FAQs, patients, schedules, clinic hours, and blocked-date configuration.

Never automatically run the development seed during a real production deployment.

---

## 18. Resetting local data

Prisma reset:

```powershell
npx prisma migrate reset
```

This drops the local schema, recreates it from migrations, and may run the configured seed depending on Prisma behavior and prompts. To be explicit afterward:

```powershell
npx prisma db seed
```

Docker fresh reset:

```powershell
docker compose down -v
docker compose up -d
npx prisma migrate dev
npx prisma db seed
```

These are destructive local commands. Confirm `DATABASE_URL` points to the local `dental_clinic` database before running them.

---

## 19. Demonstration deployment architecture

**Planned demonstration deployment:**

```text
Internet
  |
  +---- Vercel: Next.js website
  |
  +---- Render: NestJS API
           |
           +---- Neon: PostgreSQL source of truth
           |
           +---- Upstash: future Redis cache/shared limits

Cloudflare Turnstile: future appointment bot verification
n8n: local until public automation is required
```

This is appropriate for synthetic demonstrations, not guaranteed real-clinic production. Hosting plans, quotas, and pricing change; verify provider documentation immediately before deployment.

Deployment order:

1. Run all local verification.
2. Create hosted PostgreSQL.
3. Deploy the API and apply migrations.
4. Deploy the website with the API URL.
5. Update the API's exact `WEB_ORIGIN`.
6. Configure final domains.
7. Add Turnstile before a public appointment form.
8. Add Redis only after its application integration exists.
9. Run smoke tests with synthetic data.

---

## 20. Deploying PostgreSQL

For the demonstration, create a hosted PostgreSQL database such as Neon in a region close to the API.

Requirements:

- TLS connection.
- Pooled connection URL when recommended by the provider.
- A separate database from development.
- A database user restricted to the application database.

Connection shape:

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require
```

Store the real value only in the API hosting secret manager. Never put it in Vercel browser variables or Git.

---

## 21. Deploying the API

Create a Render web service from the repository root.

Recommended settings:

```text
Runtime: Node
Repository root: repository root
Build command: npm install && npx prisma generate && npm run build -w @dental/api
Start command: npx prisma migrate deploy && npm run start:prod -w @dental/api
Health check: /api
```

API environment variables:

```dotenv
NODE_ENV=production
DATABASE_URL=<hosted PostgreSQL TLS URL>
WEB_ORIGIN=https://<exact website origin>
SESSION_TTL_DAYS=7
```

Later, after implementation:

```dotenv
REDIS_URL=<hosted TLS Redis URL>
TURNSTILE_SECRET_KEY=<server-only Turnstile secret>
```

Do not set `API_HOST` on Render. Do not manually set Render's injected `PORT`. The application binds to `0.0.0.0` automatically in production.

---

## 22. Deploying the website

Create a Vercel project from the same repository.

Recommended settings:

```text
Root Directory: apps/web
Framework: Next.js
Build Command: next build
```

Website environment variable:

```dotenv
NEXT_PUBLIC_API_URL=https://<api hostname>
```

Do not add `/api` at the end; the frontend helpers append it.

After the website gets its final hostname, set the API's `WEB_ORIGIN` to that exact HTTPS origin and redeploy the API.

---

## 23. Redis deployment status

**Current status:** Redis runs in Docker, but the application does not yet use it for caching or shared throttling.

Creating an Upstash database and setting `REDIS_URL` alone does not activate Redis behavior. A Redis client, cache service, failure policy, invalidation rules, and tests must be implemented first.

Good future uses:

- Shared rate-limit counters for multiple API instances.
- Short-lived cache entries for public clinic, dentist, service, and FAQ responses.
- A separate durable Redis instance for future BullMQ jobs.

Do not cache patient records, appointment details, password/session material, or permanent appointment state.

Hosted TLS URLs normally begin with:

```text
rediss://
```

---

## 24. n8n deployment status

**Current status:** n8n runs locally through Docker at `http://localhost:5678`.

The API can publish committed appointment events to `N8N_WEBHOOK_URL`. Keep the webhook URL empty until a workflow is created and tested. Set `N8N_WEBHOOK_SECRET` to a shared secret and validate the `x-n8n-webhook-secret` header in the workflow. n8n delivery is best-effort; an n8n outage does not undo a committed appointment.

For Gmail, configure OAuth directly in n8n and keep Gmail credentials out of the API environment. Use the production webhook URL only after activating the workflow. The test URL listens for one request after **Execute workflow** and then returns 404 by design. Key idempotency by the event `id`, monitor failed executions in n8n, and retry email there without changing the committed appointment.

Local n8n is useful for developing workflows, but it cannot reliably receive public webhooks when the computer is off or inaccessible.

Do not deploy n8n until a real workflow requires it. A deployed instance needs:

- HTTPS.
- Authentication.
- Persistent storage and backups.
- Secret management.
- Restricted webhook design.
- Monitoring and updates.

---

## 25. Production domains and cookies

The admin session uses a strict HTTP-only cookie. Unrelated provider domains, such as a Vercel preview URL and a Render URL, are different sites and can prevent the admin cookie from working.

For real use, configure one parent domain:

```text
https://www.example-clinic.com  -> Next.js
https://api.example-clinic.com  -> NestJS
```

Then configure:

```dotenv
WEB_ORIGIN=https://www.example-clinic.com
NEXT_PUBLIC_API_URL=https://api.example-clinic.com
```

Do not weaken secure cookie settings simply to support temporary unrelated preview domains.

---

## 26. Production migrations and seed policy

Run committed migrations in hosted environments:

```powershell
npx prisma migrate deploy
```

Never use this against production:

```powershell
npx prisma migrate dev
```

`migrate dev` is a development command that can create migrations and request resets. `migrate deploy` only applies committed pending migrations.

Do not automatically run `npx prisma db seed` for a real clinic database.

---

## 27. Deployment verification

Use synthetic records only.

Verify public endpoints:

```text
GET <API_URL>/api
GET <API_URL>/api/clinic
GET <API_URL>/api/services
GET <API_URL>/api/dentists
GET <API_URL>/api/faqs
```

Verify behavior:

- Website loads on desktop and mobile.
- Every browser request uses HTTPS.
- CORS accepts only the configured website origin.
- Public appointment creation validates bad input and rate limits abuse.
- No public patient or appointment-list endpoint exists.
- Admin login and cookies work on the final domain arrangement.
- Admin appointment details require an authorized session.
- Secrets do not appear in browser storage, client JavaScript, Git, or logs.
- Database migrations are up to date.
- Backups and restore procedures have been tested before real data.

---

## 28. Backups and recovery

A real deployment needs documented:

- Backup frequency.
- Retention duration.
- Encryption.
- Storage location.
- Restore commands.
- Recovery time and recovery point objectives.
- Person responsible for verification.

A backup is not proven until a restore test succeeds in an isolated environment.

Before risky database work:

1. Confirm the exact database hostname and database name.
2. Take or verify a recent backup.
3. Test the migration on staging.
4. Prepare a rollback or forward-fix procedure.
5. Monitor errors after release.

---

## 29. Common errors

### Docker API pipe not found

```text
failed to connect to the docker API ... dockerDesktopLinuxEngine
```

Open Docker Desktop, wait for the engine to finish starting, then run:

```powershell
docker compose up -d
```

### Prisma P1001

```text
Can't reach database server at localhost:5432
```

Check:

```powershell
docker compose ps
docker compose logs postgres
```

Confirm PostgreSQL is healthy and `.env` uses port 5432.

### Port 4000 already in use

```powershell
Get-NetTCPConnection -LocalPort 4000 -State Listen
Stop-Process -Id <OwningProcess>
```

Stop only the exact process that owns port 4000, then restart the API.

### Cannot GET `/api/auth/login`

Login is a `POST` endpoint, so opening it directly in a browser sends the wrong HTTP method. Use the admin login page or send a JSON `POST` request.

### Unable to connect to the remote server

Confirm the API terminal is running:

```powershell
npm run start:dev -w @dental/api
```

Then test:

```powershell
Invoke-RestMethod http://localhost:4000/api
```

### 401 Unauthorized

The session is absent or expired. Sign in again. Do not attempt to bypass the guard.

### 403 Forbidden

The account role or request origin is not allowed. Confirm the user is ADMIN/STAFF and `WEB_ORIGIN` exactly matches the browser origin.

### Appointment conflict

The slot may have been taken, blocked, outside clinic hours, or in conflict with the patient/dentist schedule. Refresh live availability and choose another time.

---

## 30. Command reference

| Command                                          | Meaning                                | Environment                          |
| ------------------------------------------------ | -------------------------------------- | ------------------------------------ |
| `npm install`                                    | Install workspace dependencies         | Local/build                          |
| `docker compose up -d`                           | Start local infrastructure             | Local                                |
| `docker compose down`                            | Stop containers, keep volumes          | Local                                |
| `docker compose down -v`                         | Stop and delete local volumes          | Local, destructive                   |
| `npx prisma generate`                            | Generate Prisma client                 | Local/build                          |
| `npx prisma validate`                            | Validate Prisma schema                 | Any safe environment                 |
| `npx prisma migrate status`                      | Show migration state                   | Any correctly configured environment |
| `npx prisma migrate dev --name NAME`             | Create/apply development migration     | Local only                           |
| `npx prisma migrate deploy`                      | Apply committed migrations             | Staging/production                   |
| `npx prisma db seed`                             | Insert synthetic seed data             | Local/demo only                      |
| `npx prisma migrate reset`                       | Recreate configured database           | Local, destructive                   |
| `npx prisma studio`                              | Open local database viewer             | Local                                |
| `npm run start:dev -w @dental/api`               | Start watched API                      | Local                                |
| `npm run dev -w @dental/web`                     | Start Next.js website                  | Local                                |
| `npm run lint`                                   | Lint workspaces                        | Before commit                        |
| `npm run test -w @dental/api -- --runInBand`     | Run API unit tests                     | Before commit                        |
| `npm run test:e2e -w @dental/api -- --runInBand` | Run API E2E tests                      | Before commit                        |
| `npm run build -w @dental/api`                   | Build the NestJS API                   | Before deployment                    |
| `npm run build -w @dental/web`                   | Build the Next.js website              | Before deployment                    |
| `npm audit --omit=dev`                           | Check production dependency advisories | Before release                       |

---

## 31. Release checklist

Before committing:

- [ ] `git status --short` contains no secrets or unexpected files.
- [ ] `.env` is ignored.
- [ ] Prisma migrations match intentional schema changes.
- [ ] Unit and E2E tests pass.
- [ ] API and web lint pass.
- [ ] API and web production builds pass.
- [ ] `git diff --check` passes.
- [ ] The public appointment flow works with synthetic data.
- [ ] Unauthorized admin requests return 401/403.
- [ ] Commit groups follow separation of concerns.

Before deployment:

- [ ] Hosted secrets are configured outside Git.
- [ ] `WEB_ORIGIN` is one exact HTTPS origin.
- [ ] `NEXT_PUBLIC_API_URL` contains the API origin without `/api`.
- [ ] `prisma migrate deploy` succeeds.
- [ ] Health endpoint returns success.
- [ ] CORS and admin cookies work on final domains.
- [ ] Turnstile is enabled before a public real-world form.
- [ ] Backups, monitoring, and restore tests exist before real data.

---

## 32. Git and private documentation

GitHub cannot make one tracked file private inside a public repository. A tracked file is visible to everyone who can read that repository.

This handbook and `guide.md` are listed in `.gitignore` so new versions remain local. Because `guide.md` was tracked previously, it must also be removed from the Git index once:

```powershell
git rm --cached -- guide.md
```

This preserves the local file but stages its deletion from the repository. Commit that deletion with the `.gitignore` change.

Important limitations:

- Ignoring a file does not erase older copies from Git history.
- If the document contains a real secret, rotate the secret immediately.
- To conceal old historical copies, make the repository private or perform a coordinated history rewrite.
- Do not casually rewrite history after other people have cloned the repository.

To verify the files are ignored:

```powershell
git check-ignore -v --no-index guide.md OPERATIONS.md
```

Keep this handbook backed up privately because Git will no longer store it.
