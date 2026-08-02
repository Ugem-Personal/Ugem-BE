# UGem production runbook

## 1. Pre-deploy gate

Run from the backend repository:

```bash
npm ci
npm run verify
npm run test:e2e
npm audit --omit=dev --audit-level=high
```

Run from the frontend repository:

```bash
npm ci
npm run verify
npm audit --omit=dev --audit-level=high
```

Never deploy when migration, E2E, build, or audit fails. CI performs the same
checks and also builds both production images.

## 2. Local production simulation

From `D:/PersonalProjects/UGem`:

1. Copy `.env.example` to `.env` and set a strong PostgreSQL password plus the
   public frontend keys.
2. Ensure `Ugem_Backend/.env` contains valid JWT, SMTP, Cloudinary, Google,
   SePay, and bank settings. Docker Compose overrides only `DATABASE_URL`,
   `NODE_ENV`, `PORT`, and `FRONTEND_URL`.
3. Start the stack:

```bash
docker-compose up --build -d
docker-compose ps
```

If Docker Compose is installed as a Docker CLI plugin, use the equivalent
`docker compose` commands instead.

Open `http://localhost:3000`. API readiness is available at
`http://localhost:8080/api/v1/health/ready`.

The startup order is PostgreSQL health check, one-off migration job, API
readiness, then frontend. Migration failure prevents the new API from starting.

## 3. Production deploy order

1. Create and verify a database backup.
2. Build immutable images tagged with the Git commit SHA.
3. Run the backend Docker `migrate` target as a one-off release job.
4. Start the new API image and wait for `/api/v1/health/ready` to return 200.
5. Deploy the frontend with `VITE_API_BASE_URL` set to the public API origin.
6. Run smoke tests: login, merchant order list, create a low-risk test order,
   and verify the SePay webhook endpoint rejects an invalid key.

Do not run `prisma migrate dev` in production. Use only `prisma migrate deploy`.

## 4. Backup

The machine running these commands needs PostgreSQL client tools matching or
newer than the server version.

The project script automatically discovers PostgreSQL tools on Windows (or uses
`PG_BIN_DIR`) and verifies the custom-format archive:

```bash
npm run db:backup
```

Backups are written to the ignored `backups/` directory. The database password
is passed to PostgreSQL through the child-process environment, not command-line
arguments.

```bash
mkdir -p backups
pg_dump "$DATABASE_URL" --format=custom --no-owner --no-acl \
  --file "backups/ugem-$(date +%Y%m%d-%H%M%S).dump"
pg_restore --list backups/ugem-YYYYMMDD-HHMMSS.dump > /dev/null
```

Keep encrypted copies outside the application server. A backup is not accepted
until `pg_restore --list` succeeds and a restore drill has passed on a separate
database.

Suggested retention: 7 daily, 4 weekly, and 6 monthly backups. Adjust this to
business and legal requirements.

## 5. Restore drill

Never test a restore against the live database. Create a database whose name
ends in `_restore_test`:

```bash
npm run db:restore-drill
```

The script selects the latest local archive, recreates only
`<current_database>_restore_test`, restores it, and reports migration/user/order
counts. Set `RESTORE_TEST_DATABASE_URL` to use another target; its database name
must still end in `_restore_test`.

```bash
createdb "$RESTORE_TEST_DATABASE_URL"
pg_restore --dbname "$RESTORE_TEST_DATABASE_URL" --clean --if-exists \
  --no-owner --no-acl backups/ugem-YYYYMMDD-HHMMSS.dump
```

Then point a temporary API instance at the restored database and verify
readiness, admin login, order totals, latest orders, and audit logs.

## 6. Rollback

Application rollback means redeploying the previous immutable image. Database
migrations are forward-only by default: create a corrective migration instead
of manually deleting columns or migration records.

If a migration causes critical data corruption:

1. Stop writes by removing API traffic.
2. Preserve logs and take a snapshot of the failed database.
3. Restore the last verified backup into a new database.
4. Point the previous API image to that new database.
5. Verify readiness and smoke tests before restoring traffic.

## 7. Monitoring and alerts

At minimum alert on:

- readiness failing for 2 consecutive minutes;
- HTTP 5xx rate over 2% for 5 minutes;
- p95 API latency over 1 second for 10 minutes;
- database storage over 80%;
- failed migration/release job;
- repeated SePay webhook authentication failures;
- absence of a successful backup for 26 hours.

Use the response `X-Request-Id`/`traceId` to correlate incidents with structured
backend logs. Never log authorization headers, cookies, webhook keys, or bodies
containing passwords and tokens.
