# IT-HR Operational Intelligence Platform

A full-stack platform for managing IT assets, employee lifecycle, support tickets, software licenses, and security risk — with real-time alerts, SLA enforcement, and automated background workers.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js, Express, TypeScript |
| Frontend | Next.js 14 (App Router), React 18, Tailwind CSS |
| Database | Supabase (PostgreSQL + Auth + Realtime) |
| Queue / Jobs | BullMQ + Redis |
| Notifications | Nodemailer (SMTP), Slack Webhooks, MS Teams Webhooks |
| Auth | Supabase Auth + JWT middleware |

---

## Project Structure

```
/
├── backend/          Express API + BullMQ workers
├── frontend/         Next.js dashboard
└── supabase/
    └── migrations/   SQL schema + RLS policies
```

---

## Prerequisites

- Node.js 18+
- npm 9+ (workspaces support)
- A [Supabase](https://supabase.com) project
- Redis 7+ (local or cloud — e.g. Upstash)
- (Optional) SMTP credentials, Slack/Teams webhook URLs

---

## Quick Start

### 1. Clone and install

```bash
git clone <repo-url>
cd inventory
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your Supabase URL/keys, JWT secret, Redis host, SMTP, and webhook URLs
```

> For the frontend, also create `frontend/.env.local` and set the `NEXT_PUBLIC_*` variables from `.env.example`.

### 3. Run the database migration

In your Supabase project, open the **SQL Editor** and run:

```
supabase/migrations/001_initial_schema.sql
```

This creates all tables, types, indexes, triggers, and RLS policies.

### 4. Start development servers

```bash
# Run both backend (port 3001) and frontend (port 3000) concurrently
npm run dev
```

Or start them individually:

```bash
npm run dev:backend    # Express API on :3001
npm run dev:frontend   # Next.js on :3000
```

### 5. Start background workers (optional)

```bash
cd backend
npm run worker
```

Workers run three BullMQ cron jobs:
- **license-check** — daily at 09:00: flags unused licenses (>45 days)
- **warranty-check** — daily at 08:00: alerts on warranties expiring within 30 days
- **sla-check** — every 30 minutes: alerts on overdue tickets

---

## API Reference

All endpoints are prefixed with `/api/v1` and require a `Bearer <token>` header (Supabase JWT).

### Health
```
GET /health
```

### Employees
| Method | Path | Description |
|---|---|---|
| GET | `/employees` | List all (supports `?status=`, `?department_id=`, `?search=`) |
| GET | `/employees/:id` | Get employee by ID |
| POST | `/employees` | Create employee (triggers onboarding email + notification) |
| PATCH | `/employees/:id` | Update employee (triggers offboarding alert if status changes) |
| DELETE | `/employees/:id` | Soft-deactivate |

### Assets
| Method | Path | Description |
|---|---|---|
| GET | `/assets` | List all (supports `?status=`, `?asset_type=`) |
| GET | `/assets/expiring-warranty` | Assets with warranty expiring within `?days=30` |
| GET | `/assets/:id` | Get asset |
| POST | `/assets` | Create asset |
| PATCH | `/assets/:id` | Update asset |
| DELETE | `/assets/:id` | Retire asset |
| POST | `/assets/:id/assign` | Assign to employee |
| POST | `/assets/:id/return` | Return asset |

### Tickets
| Method | Path | Description |
|---|---|---|
| GET | `/tickets` | List (supports `?status=`, `?priority=`, `?assignee_id=`) |
| GET | `/tickets/overdue` | SLA-breached open tickets |
| GET | `/tickets/:id` | Get ticket with comments |
| POST | `/tickets` | Create ticket (sets SLA, sends confirmation email) |
| PATCH | `/tickets/:id` | Update status/assignee/priority |
| POST | `/tickets/:id/comments` | Add comment |

### Licenses
| Method | Path | Description |
|---|---|---|
| GET | `/licenses` | List all |
| GET | `/licenses/unused` | Unused for `?days=45` |
| POST | `/licenses` | Create |
| PATCH | `/licenses/:id` | Update |
| DELETE | `/licenses/:id` | Deactivate |

### Security
| Method | Path | Description |
|---|---|---|
| GET | `/security/risk-scores` | All risk scores (with employee data) |
| GET | `/security/risk-scores/:employeeId` | History for one employee |
| POST | `/security/assess/:employeeId` | Run risk assessment (5-factor scoring) |
| GET | `/security/training` | All training records |
| POST | `/security/training` | Create training record |

### Dashboard
| Method | Path | Description |
|---|---|---|
| GET | `/dashboard/summary` | KPI counts for all modules |
| GET | `/dashboard/activity` | Last 50 audit log entries |
| GET | `/dashboard/tickets/by-priority` | Open ticket counts grouped by priority |
| GET | `/dashboard/security/trend` | Last 100 risk score entries |

---

## Security Risk Scoring

The `POST /security/assess/:employeeId` endpoint accepts:

```json
{
  "mfa_enabled": true,
  "password_age_days": 45,
  "phishing_failures": 0,
  "device_compliant": true,
  "security_training_complete": true
}
```

Scoring deductions:
- MFA not enabled: -25
- Password > 90 days: -20 / > 60 days: -10
- Phishing failures > 2: -25 / > 0: -10
- Device not compliant: -20
- Training incomplete: -10

| Score | Risk Level |
|---|---|
| 80–100 | low |
| 60–79 | medium |
| 40–59 | high |
| 0–39 | critical |

High/critical scores trigger immediate Slack + Teams alerts.

---

## SLA Matrix

| Priority | SLA Hours |
|---|---|
| Critical | 4 |
| High | 8 |
| Medium | 24 |
| Low | 72 |

---

## Frontend Pages

| Route | Description |
|---|---|
| `/login` | Supabase auth sign-in |
| `/dashboard` | Executive summary: KPI cards, risk distribution, recent tickets |
| `/dashboard/employees` | Searchable employee table with status badges |
| `/dashboard/assets` | Asset inventory with warranty expiry warnings |
| `/dashboard/tickets` | Ticket list with status/priority filters and SLA breach indicators |
| `/dashboard/security` | Risk score table with inline score bar visualization |

---

## Environment Variables

See `.env.example` for a full list. Key variables:

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (backend only — never expose to browser) |
| `JWT_SECRET` | Secret for verifying Supabase JWTs (32+ chars) |
| `REDIS_HOST` / `REDIS_PORT` | Redis connection for BullMQ |
| `SMTP_*` | Email delivery settings |
| `SLACK_WEBHOOK_URL` | Incoming webhook for Slack notifications |
| `TEAMS_WEBHOOK_URL` | Incoming webhook for MS Teams notifications |
| `NEXT_PUBLIC_API_URL` | Frontend → backend base URL |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL (exposed to browser) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (exposed to browser) |

---

## Database Schema Overview

- **departments** — organisational units
- **employees** — staff records with self-referencing manager FK and department FK
- **assets** — hardware/device inventory with warranty tracking
- **asset_assignments** — asset-to-employee assignment history
- **tickets** — support tickets with SLA deadlines and priority
- **ticket_comments** — internal and public comments on tickets
- **licenses** — software license pool with seat counts and expiry
- **security_training** — training assignments and completion
- **risk_scores** — point-in-time security risk assessments with JSONB factor breakdown
- **audit_logs** — immutable action log for all mutations

All tables have RLS enabled. The backend uses `service_role` (bypasses RLS). Authenticated browser users get read-only access.

---

## Production Checklist

- [ ] Set `NODE_ENV=production` and use a strong `JWT_SECRET`
- [ ] Restrict `CORS_ORIGIN` to your frontend domain
- [ ] Use a managed Redis (e.g. Upstash) in production
- [ ] Enable Supabase email confirmation for new users
- [ ] Review and tighten RLS policies for write operations
- [ ] Set up log aggregation (e.g. Datadog, Logtail)
- [ ] Configure rate limiting thresholds for production load
- [ ] Add a process manager (PM2 or systemd) for the worker process
