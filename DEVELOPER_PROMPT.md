# Developer Prompt — IT-HR Operational Intelligence Platform

This document is a copy-paste-ready reference for any developer picking up this codebase. It covers feature requirements, integration examples, CSV formats, acceptance criteria, troubleshooting, and a deployment checklist.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Core Feature Requirements](#2-core-feature-requirements)
3. [CSV Import — Format Specifications](#3-csv-import--format-specifications)
4. [Integration Code Examples](#4-integration-code-examples)
5. [Acceptance Criteria](#5-acceptance-criteria)
6. [Troubleshooting Guide](#6-troubleshooting-guide)
7. [Implementation Checklist](#7-implementation-checklist)

---

## 1. Architecture Overview

```
frontend/          Next.js 14 (App Router) · React 18 · Tailwind CSS
backend/           Express + TypeScript · Supabase client · BullMQ workers
supabase/          PostgreSQL schema · RLS policies · Realtime subscriptions
```

**Data flow:**
```
Browser → Next.js page → api.ts (fetch wrapper) → Express :3001 → Supabase
                                                          ↓
                                                   BullMQ / Redis
                                                          ↓
                                              Email / Slack / Teams alerts
```

Auth: Supabase JWT. The frontend stores the token in `localStorage` under the key `"token"`. All API calls include `Authorization: Bearer <token>`.

---

## 2. Core Feature Requirements

### 2.1 CSV Upload (bulk import)

**Goal:** Let IT admins import employees and assets in bulk from Excel exports (saved as CSV).

- Endpoint: `POST /api/v1/employees/import` and `POST /api/v1/assets/import`
- Accept `multipart/form-data` with field name `file`
- Parse CSV → validate each row with Zod → insert in batches of 50
- Return `{ imported: N, skipped: K, errors: [...] }`
- Duplicate emails (employees) and serial numbers (assets) are skipped, not errors
- UI: drag-and-drop zone on `/dashboard/employees` and `/dashboard/assets` pages

### 2.2 Real-time Search

**Goal:** Filter tables instantly as the user types (no full page reload).

- Already implemented for employees: `useEffect` re-fetches on `search` state change
- Add same pattern to Assets, Tickets, and Licenses pages
- Debounce input by 300 ms before sending the API request
- Assets search should match `name`, `serial_number`, and `model`

### 2.3 License Integration

**Goal:** Show which employees hold each software license and flag waste.

- `GET /api/v1/licenses` returns license pool
- `GET /api/v1/licenses/unused?days=45` returns licenses not used for 45+ days
- Frontend `/dashboard/licenses` page (not yet built): table with columns:
  `Software`, `Seats Total`, `Seats Used`, `Expiry`, `Monthly Cost`, `Status`
- Status badge: `active` → green, `expiring_soon` (≤30 days) → yellow, `expired` → red
- "Unused Licenses" tab uses the `/unused` endpoint and highlights savings

### 2.4 Asset Lookup

**Goal:** View the full history of an asset — who had it, when, current holder.

- `GET /api/v1/assets/:id` already returns `asset_assignments[]` with employee names
- Frontend: clicking an asset row opens a slide-over panel showing:
  - Asset details (model, serial, warranty)
  - Assignment timeline (most recent first)
  - Current assignee with "Return Asset" button

### 2.5 Onboarding Checklist

**Goal:** When a new employee is created, auto-generate an onboarding task list.

- On `POST /employees`, the backend already sends a welcome email and Slack/Teams notification
- Extend: insert rows into a new `onboarding_tasks` table (see schema below)
- Default tasks: Account Created, Laptop Assigned, Security Training Assigned, Badge Issued, Welcome Email Sent
- Frontend: `/dashboard/employees/:id` page shows checklist with toggle checkboxes

```sql
CREATE TABLE onboarding_tasks (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  task        TEXT NOT NULL,
  completed   BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 2.6 Export to TXT / CSV

**Goal:** Let users download any table as a file for offline use or reporting.

- Add a generic `exportToCSV(rows, filename)` utility in `frontend/src/lib/export.ts`
- Add an "Export CSV" button to Employees, Assets, Tickets, and Licenses pages
- For a plain-text summary report, add `exportToTxt(rows, filename)` that writes a pipe-delimited human-readable table

---

## 3. CSV Import — Format Specifications

### 3.1 Employees CSV

```csv
full_name,email,job_title,department,hire_date,status,phone,location,manager_email
Jane Smith,jane@company.com,Software Engineer,Engineering,2024-03-01,active,+1-555-0100,Bangkok,bob@company.com
```

| Column | Required | Format | Notes |
|---|---|---|---|
| `full_name` | Yes | Text | Min 2 chars |
| `email` | Yes | Valid email | Must be unique — duplicates are skipped |
| `job_title` | Yes | Text | |
| `department` | No | Department name | Resolved by name; created if missing |
| `hire_date` | Yes | `YYYY-MM-DD` | |
| `status` | No | `active` / `inactive` / `offboarding` | Defaults to `active` |
| `phone` | No | Text | |
| `location` | No | Text | |
| `manager_email` | No | Valid email | Resolved to `manager_id` by email lookup |

### 3.2 Assets CSV

```csv
name,asset_type,serial_number,model,manufacturer,purchase_date,warranty_expiry,status,cost,notes
MacBook Pro 14,laptop,C02XL0ABJGH5,MacBook Pro 14-inch,Apple,2023-01-15,2026-01-15,available,2499.00,
```

| Column | Required | Format | Notes |
|---|---|---|---|
| `name` | Yes | Text | |
| `asset_type` | Yes | `laptop` / `desktop` / `monitor` / `phone` / `tablet` / `server` / `network` / `other` | |
| `serial_number` | No | Text | Duplicates are skipped |
| `model` | No | Text | |
| `manufacturer` | No | Text | |
| `purchase_date` | No | `YYYY-MM-DD` | |
| `warranty_expiry` | No | `YYYY-MM-DD` | |
| `status` | No | `available` / `assigned` / `maintenance` / `retired` | Defaults to `available` |
| `cost` | No | Decimal | USD value, no currency symbol |
| `notes` | No | Text | |

---

## 4. Integration Code Examples

### 4.1 CSV import endpoint (backend)

```typescript
// backend/src/routes/employees.ts  — add after existing routes
import multer from 'multer';
import { parse } from 'csv-parse/sync';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.post('/import', authenticate, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) { res.status(400).json({ error: 'No file uploaded' }); return; }

    const rows = parse(req.file.buffer.toString('utf8'), {
      columns: true, skip_empty_lines: true, trim: true,
    }) as Record<string, string>[];

    let imported = 0, skipped = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i += 50) {
      const batch = rows.slice(i, i + 50);
      for (const row of batch) {
        const parsed = EmployeeSchema.safeParse({
          full_name: row.full_name,
          email: row.email,
          job_title: row.job_title,
          hire_date: row.hire_date,
          status: row.status || 'active',
          phone: row.phone || undefined,
          location: row.location || undefined,
        });
        if (!parsed.success) { errors.push(`Row ${rows.indexOf(row) + 2}: ${parsed.error.message}`); continue; }

        const { error } = await supabase.from('employees').insert(parsed.data).single();
        if (error?.code === '23505') { skipped++; } // unique violation
        else if (error) { errors.push(`Row ${rows.indexOf(row) + 2}: ${error.message}`); }
        else { imported++; }
      }
    }

    res.json({ imported, skipped, errors });
  } catch (err) { next(err); }
});
```

### 4.2 Debounced search hook (frontend)

```typescript
// frontend/src/lib/useDebounce.ts
import { useEffect, useState } from 'react';

export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
```

Usage in any page:

```tsx
const [search, setSearch] = useState('');
const debouncedSearch = useDebounce(search);

useEffect(() => {
  const q = debouncedSearch ? `?search=${encodeURIComponent(debouncedSearch)}` : '';
  api.get<Employee[]>(`/employees${q}`).then(setEmployees).catch(console.error);
}, [debouncedSearch]);
```

### 4.3 Export utility (frontend)

```typescript
// frontend/src/lib/export.ts
export function exportToCSV<T extends Record<string, unknown>>(rows: T[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(','),
    ...rows.map(r =>
      headers.map(h => {
        const v = String(r[h] ?? '').replace(/"/g, '""');
        return /[,"\n]/.test(v) ? `"${v}"` : v;
      }).join(',')
    ),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${filename}.csv`; a.click();
  URL.revokeObjectURL(url);
}

export function exportToTxt<T extends Record<string, unknown>>(rows: T[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(' | '), headers.map(() => '---').join(' | '), ...rows.map(r => headers.map(h => String(r[h] ?? '')).join(' | '))];
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${filename}.txt`; a.click();
  URL.revokeObjectURL(url);
}
```

### 4.4 Asset assignment slide-over (frontend skeleton)

```tsx
// frontend/src/components/assets/AssetDetail.tsx
'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Assignment = { id: string; assigned_date: string; returned_date: string | null; employee: { full_name: string; email: string } };
type AssetDetail = { id: string; name: string; model: string; serial_number: string; warranty_expiry: string; asset_assignments: Assignment[] };

export function AssetDetail({ assetId, onClose }: { assetId: string; onClose: () => void }) {
  const [asset, setAsset] = useState<AssetDetail | null>(null);

  useEffect(() => {
    api.get<AssetDetail>(`/assets/${assetId}`).then(setAsset);
  }, [assetId]);

  const handleReturn = () =>
    api.post(`/assets/${assetId}/return`, {}).then(() => api.get<AssetDetail>(`/assets/${assetId}`).then(setAsset));

  if (!asset) return <div className="p-6">Loading…</div>;

  const current = asset.asset_assignments.find(a => !a.returned_date);

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-xl p-6 overflow-y-auto z-50">
      <button onClick={onClose} className="mb-4 text-gray-500 hover:text-gray-900">✕ Close</button>
      <h2 className="text-lg font-semibold mb-1">{asset.name}</h2>
      <p className="text-sm text-gray-500 mb-4">{asset.model} · {asset.serial_number || 'No serial'}</p>
      {current && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-sm font-medium">Assigned to: {current.employee.full_name}</p>
          <p className="text-xs text-gray-500">Since {current.assigned_date}</p>
          <button onClick={handleReturn} className="mt-2 text-xs text-red-600 hover:underline">Return Asset</button>
        </div>
      )}
      <h3 className="text-sm font-semibold mb-2">Assignment History</h3>
      <ul className="space-y-2">
        {[...asset.asset_assignments].reverse().map(a => (
          <li key={a.id} className="text-sm border-l-2 border-gray-200 pl-3">
            <span className="font-medium">{a.employee.full_name}</span>
            <span className="text-gray-400"> · {a.assigned_date} → {a.returned_date || 'present'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

---

## 5. Acceptance Criteria

### CSV Upload
- [ ] Uploads a 500-row CSV in under 10 seconds
- [ ] Duplicate rows are skipped (not rejected) with a count returned
- [ ] Invalid rows return row-level error messages (not a global 500)
- [ ] File > 5 MB returns a 400 with a clear message

### Real-time Search
- [ ] Results update within 350 ms of the last keypress
- [ ] Searching an empty string returns all records
- [ ] Searches are case-insensitive

### License Integration
- [ ] License list page shows total vs. used seat counts
- [ ] Licenses expiring within 30 days show a yellow badge
- [ ] "Unused" tab correctly filters by the `?days=` threshold

### Asset Lookup
- [ ] Clicking an asset row opens the slide-over without a page reload
- [ ] Assignment history is sorted most-recent-first
- [ ] "Return Asset" button updates status to `available` immediately in the UI

### Onboarding Checklist
- [ ] Creating a new employee auto-creates 5 default tasks
- [ ] Toggling a task checkbox updates `completed` and `completed_at` in the DB
- [ ] Checklist is visible on the employee detail page

### Export
- [ ] CSV export includes all currently visible/filtered rows (not all rows in DB)
- [ ] TXT export is pipe-delimited and readable in a plain text editor
- [ ] File download triggers in all modern browsers (Chrome, Firefox, Safari)

---

## 6. Troubleshooting Guide

### "Cannot GET /api/v1/..." — 404 in browser

The frontend is calling the wrong base URL. Check:
```bash
# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:3001
```
Also confirm the backend is running: `curl http://localhost:3001/health`

### Supabase `JWTExpired` errors

The Supabase JWT has a default 1-hour expiry. On the frontend, refresh the session:
```typescript
const { data } = await supabase.auth.refreshSession();
if (data.session) localStorage.setItem('token', data.session.access_token);
```

### BullMQ workers not running

Redis must be reachable. Check:
```bash
redis-cli -h $REDIS_HOST -p $REDIS_PORT ping   # should return PONG
cd backend && npm run worker
```

### CSV parse errors — "Invalid Date"

All date columns must be `YYYY-MM-DD`. Excel often exports dates as `DD/MM/YYYY` or locale-specific formats. Normalise before upload or add a transform step in the parser.

### Realtime subscriptions not firing

Supabase Realtime requires the table to be added to the publication:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE employees, assets, tickets;
```
Run this in the Supabase SQL editor.

### `multer` not found

Install the dependency:
```bash
cd backend && npm install multer csv-parse
npm install --save-dev @types/multer
```

### Vercel build fails — "Module not found: @/lib/..."

Ensure `tsconfig.json` in `frontend/` has the path alias:
```json
{ "compilerOptions": { "paths": { "@/*": ["./src/*"] } } }
```

---

## 7. Implementation Checklist

### Backend
- [ ] `POST /employees/import` — CSV bulk import with multer + csv-parse
- [ ] `POST /assets/import` — CSV bulk import
- [ ] `onboarding_tasks` table migration added to `supabase/migrations/`
- [ ] `POST /employees` — inserts default onboarding tasks after employee creation
- [ ] `PATCH /onboarding-tasks/:id` — toggle task completion
- [ ] `GET /employees/:id/onboarding-tasks` — list tasks for an employee

### Frontend
- [ ] `frontend/src/lib/useDebounce.ts` created
- [ ] `frontend/src/lib/export.ts` created (CSV + TXT)
- [ ] Assets page: debounced search added
- [ ] Assets page: slide-over `AssetDetail` component wired up
- [ ] Assets page: "Export CSV" and drag-and-drop import UI
- [ ] Employees page: drag-and-drop import UI + debounced search
- [ ] Employees page: `/dashboard/employees/:id` detail route with onboarding checklist
- [ ] Licenses page: `/dashboard/licenses` created (list + unused tab)
- [ ] All table pages: "Export CSV" button

### Database
- [ ] `onboarding_tasks` table added + RLS enabled
- [ ] `supabase_realtime` publication includes `employees`, `assets`, `tickets`

### Testing
- [ ] Upload a 100-row employee CSV — verify counts match
- [ ] Upload a CSV with 5 duplicate emails — verify `skipped: 5`
- [ ] Upload a CSV with one malformed row — verify row-level error, others import
- [ ] Search "jane" on employees page — results update without full reload
- [ ] Export employees CSV in Chrome and Firefox
- [ ] Warranty expiry badge turns red when date ≤ today
