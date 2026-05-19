# IT-HR Operational Intelligence Platform — Developer Prompt

## Core Feature Requirements

### 1. Employee Lifecycle Management
- Create, update, and soft-delete employees via `PATCH /api/v1/employees/:id` (sets `status: inactive`)
- Onboarding: send welcome email + Slack/Teams notification on `POST /api/v1/employees`
- Offboarding: fire webhook alert when `status` transitions to `offboarding`
- All mutations write an entry to `audit_logs`
- Supported statuses: `active`, `inactive`, `offboarding`

### 2. Asset Inventory & Assignment
- Track hardware with types: `laptop`, `desktop`, `monitor`, `phone`, `tablet`, `server`, `network`, `other`
- Asset statuses: `available`, `assigned`, `maintenance`, `retired`
- Assign to an employee via `POST /api/v1/assets/:id/assign`; fires a webhook notification
- Return via `POST /api/v1/assets/:id/return` (sets `returned_date`, status back to `available`)
- Warranty expiry query: `GET /api/v1/assets/expiring-warranty?days=30`

### 3. Support Ticket System with SLA
- Tickets have priority-based SLA deadlines (computed at creation):

  | Priority | SLA Hours |
  |----------|-----------|
  | critical | 4         |
  | high     | 8         |
  | medium   | 24        |
  | low      | 72        |

- Critical tickets trigger an immediate webhook alert
- Confirmation email sent to `requester_email` on ticket creation
- Comments supported via `POST /api/v1/tickets/:id/comments` (internal or public)
- Overdue tickets: `GET /api/v1/tickets/overdue`

### 4. Software License Tracking
- License types: `per_user`, `per_device`, `site`, `concurrent`
- Unused license detection: `GET /api/v1/licenses/unused?days=45`
- Deactivation is a soft delete (`status: inactive`)

### 5. Security Risk Assessment
- Five-factor scoring model (max 100):

  | Factor                     | Deduction |
  |----------------------------|-----------|
  | MFA not enabled            | -25       |
  | Password age > 90 days     | -20       |
  | Password age > 60 days     | -10       |
  | Phishing failures > 2      | -25       |
  | Phishing failures > 0      | -10       |
  | Device not compliant       | -20       |
  | Training incomplete        | -10       |

- Risk levels: `low` (80–100), `medium` (60–79), `high` (40–59), `critical` (0–39)
- `high` or `critical` scores fire an immediate Slack + Teams alert
- Training records tracked separately via `/api/v1/security/training`

### 6. Background Workers (BullMQ + Redis)
- **license-check**: daily at 09:00 — flags licenses unused for >45 days
- **warranty-check**: daily at 08:00 — alerts on warranties expiring within 30 days
- **sla-check**: every 30 minutes — alerts on SLA-breached open tickets

---

## Integration Code Examples

### Authentication (Supabase JWT)
All API requests require `Authorization: Bearer <supabase_jwt>` header.

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;

const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/employees`, {
  headers: { Authorization: `Bearer ${token}` },
});
```

### Create an Employee
```typescript
const res = await fetch('/api/v1/employees', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({
    full_name: 'Jane Smith',
    email: 'jane.smith@example.com',
    job_title: 'Software Engineer',
    hire_date: '2026-06-01',
    department_id: '<uuid>',
    status: 'active',
  }),
});
const employee = await res.json(); // { id, full_name, email, ... }
```

### Run a Security Risk Assessment
```typescript
const res = await fetch(`/api/v1/security/assess/${employeeId}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({
    mfa_enabled: true,
    password_age_days: 45,
    phishing_failures: 0,
    device_compliant: true,
    security_training_complete: true,
  }),
});
const { score, risk_level } = await res.json(); // { score: 100, risk_level: 'low' }
```

### Webhook Notification (Slack/Teams)
Configured in `backend/src/lib/webhooks.ts`. Set environment variables:

```bash
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
TEAMS_WEBHOOK_URL=https://outlook.office.com/webhook/...
```

Both `SLACK_WEBHOOK_URL` and `TEAMS_WEBHOOK_URL` are optional; the `notify()` helper sends to whichever are configured.

### Realtime Subscription (Frontend)
```typescript
import { supabase } from '@/lib/supabase';

const channel = supabase
  .channel('tickets-realtime')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, (payload) => {
    console.log('Ticket changed:', payload);
  })
  .subscribe();

return () => supabase.removeChannel(channel);
```

---

## CSV Format Specifications

Use these formats when bulk-importing data via scripts or future import endpoints.

### Employees CSV
```
full_name,email,job_title,hire_date,department_id,manager_id,phone,location,status
Jane Smith,jane.smith@example.com,Software Engineer,2026-06-01,<dept-uuid>,<mgr-uuid>,+1-555-0100,New York,active
John Doe,john.doe@example.com,IT Manager,2025-01-15,<dept-uuid>,,+1-555-0101,Remote,active
```

- `hire_date`: `YYYY-MM-DD`
- `department_id`, `manager_id`: UUID (or empty string)
- `status`: `active` | `inactive` | `offboarding`

### Assets CSV
```
name,asset_type,serial_number,model,manufacturer,purchase_date,warranty_expiry,status,cost,notes
MacBook Pro 16",laptop,C02XG2JHJGH7,MacBook Pro 16-inch M3,Apple,2024-03-01,2027-03-01,available,3499.00,
Dell 27" Monitor,monitor,SN-MON-00123,U2723D,Dell,2024-01-10,2027-01-10,available,650.00,
```

- `asset_type`: `laptop` | `desktop` | `monitor` | `phone` | `tablet` | `server` | `network` | `other`
- `purchase_date`, `warranty_expiry`: `YYYY-MM-DD`
- `status`: `available` | `assigned` | `maintenance` | `retired`
- `cost`: decimal number (no currency symbol)

### Licenses CSV
```
software_name,vendor,license_type,total_seats,expiry_date,cost_per_seat,owner_email
GitHub Enterprise,GitHub,per_user,100,2027-01-01,21.00,it-admin@example.com
Microsoft 365,Microsoft,per_user,250,2026-12-31,12.50,it-admin@example.com
Adobe Creative Cloud,Adobe,per_user,10,2026-06-30,55.99,design@example.com
```

- `license_type`: `per_user` | `per_device` | `site` | `concurrent`
- `expiry_date`: `YYYY-MM-DD`
- `cost_per_seat`: decimal number

---

## Acceptance Criteria

### Employee Management
- [ ] `POST /api/v1/employees` returns 201 with the created record
- [ ] Welcome email is sent to the new employee's email address
- [ ] A Slack/Teams webhook fires on creation
- [ ] `PATCH /api/v1/employees/:id` with `status: offboarding` fires an offboarding webhook
- [ ] `DELETE /api/v1/employees/:id` sets status to `inactive` (no hard delete)
- [ ] All mutations produce an `audit_logs` record with correct `action`, `entity_type`, and `entity_id`

### Asset Management
- [ ] `POST /api/v1/assets/:id/assign` sets asset status to `assigned` and creates an `asset_assignments` row
- [ ] `POST /api/v1/assets/:id/return` sets `returned_date` and resets asset status to `available`
- [ ] `GET /api/v1/assets/expiring-warranty?days=N` returns only assets with `warranty_expiry` within the next N days and status not `retired`

### Ticket System
- [ ] SLA `sla_due_at` is computed correctly from priority at ticket creation
- [ ] `critical` priority tickets trigger an immediate webhook
- [ ] Requester receives a confirmation email containing the ticket number and SLA deadline
- [ ] `GET /api/v1/tickets/overdue` returns only non-resolved/non-closed tickets past their SLA
- [ ] Resolving a ticket (`status: resolved`) sets `resolved_at` timestamp

### Security
- [ ] Risk score is computed deterministically from the five input factors
- [ ] `high` or `critical` risk level triggers a Slack + Teams alert immediately
- [ ] Risk score history is stored per employee (multiple assessments allowed)

### Background Workers
- [ ] Workers start without errors when `npm run worker` is executed in `backend/`
- [ ] License check runs at 09:00 daily and sends alerts for licenses unused >45 days
- [ ] Warranty check runs at 08:00 daily and alerts on assets expiring within 30 days
- [ ] SLA check runs every 30 minutes and alerts on overdue open tickets

---

## Troubleshooting Guide

### "Invalid JWT" / 401 Unauthorized
- Ensure the `Authorization: Bearer <token>` header is present on every request
- Verify `JWT_SECRET` in `.env` matches the Supabase JWT secret (Settings → API → JWT Secret)
- Supabase JWTs expire after 1 hour; refresh the session before making requests

### Workers not starting
- Confirm Redis is running: `redis-cli ping` should return `PONG`
- Check `REDIS_HOST` and `REDIS_PORT` in `.env` (defaults: `localhost`, `6379`)
- Run `cd backend && npm run worker` — inspect the console for BullMQ connection errors

### Emails not sending
- Verify all `SMTP_*` environment variables are set (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`)
- `Promise.allSettled` is used for notifications, so email failures will not break the API response — check backend logs for mailer errors
- Test SMTP connectivity: `telnet <SMTP_HOST> <SMTP_PORT>`

### Webhooks not firing
- At least one of `SLACK_WEBHOOK_URL` or `TEAMS_WEBHOOK_URL` must be set; the `notify()` helper skips silently if both are missing
- Test a webhook URL with `curl -X POST -H 'Content-Type: application/json' -d '{"text":"test"}' <SLACK_WEBHOOK_URL>`

### Supabase RLS blocking reads
- The backend uses `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS) — never expose this key to the browser
- Frontend uses `NEXT_PUBLIC_SUPABASE_ANON_KEY` with authenticated-user RLS policies (read-only by default)
- If a browser query returns no rows, check the RLS policies in Supabase → Authentication → Policies

### Database migration errors
- Run `supabase/migrations/001_initial_schema.sql` exactly once in the Supabase SQL editor
- Re-running will fail on `CREATE TABLE` / `CREATE TYPE` statements; wrap in `IF NOT EXISTS` or drop the schema first in a dev environment
- UUID extension must be enabled: `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"` is included in the migration

### CORS errors in the browser
- Set `CORS_ORIGIN` in `backend/.env` to the exact frontend origin (e.g. `http://localhost:3000`)
- In production, restrict to your deployed frontend domain

---

## Implementation Checklist

### Environment Setup
- [ ] Copy `.env.example` to `.env` and fill in all required values
- [ ] Create `frontend/.env.local` with `NEXT_PUBLIC_*` variables
- [ ] Run database migration in Supabase SQL editor
- [ ] Verify Redis is reachable from the backend host

### Backend
- [ ] `npm install` from the repo root (workspaces install both backend and frontend deps)
- [ ] `npm run dev:backend` starts Express on port 3001 without errors
- [ ] `GET /health` returns 200
- [ ] All route modules registered in `backend/src/routes/index.ts`
- [ ] Auth middleware (`authenticate`) applied to every route
- [ ] Zod validation schemas match the DB column types
- [ ] `audit_logs` inserts present for employee create/update/delete and asset create

### Frontend
- [ ] `npm run dev:frontend` starts Next.js on port 3000 without errors
- [ ] `/login` page authenticates via Supabase and redirects to `/dashboard`
- [ ] Dashboard KPI cards populated from `GET /api/v1/dashboard/summary`
- [ ] Employee, asset, ticket, and security pages load data without console errors
- [ ] Supabase Realtime subscription active on the tickets page

### Workers
- [ ] `cd backend && npm run worker` registers all three BullMQ cron jobs
- [ ] Queue names match between `queue.ts` and `scheduler.ts` (`license-check`, `warranty-check`, `sla-check`)
- [ ] Worker processors (`licenseWorker`, `warrantyWorker`, `slaWorker`) export the correct handler function names

### Production Readiness
- [ ] `NODE_ENV=production` and strong `JWT_SECRET` set
- [ ] `CORS_ORIGIN` restricted to the production frontend domain
- [ ] Managed Redis (e.g. Upstash) configured
- [ ] Supabase email confirmation enabled for new users
- [ ] RLS write policies reviewed and tightened
- [ ] Log aggregation configured (Datadog, Logtail, etc.)
- [ ] Worker process managed by PM2 or systemd
- [ ] Rate limiting thresholds reviewed for expected production load
