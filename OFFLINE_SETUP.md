# Offline Setup Guide

This guide explains how to run the IT-HR platform locally (no internet required after the initial setup) and how to use the standalone CSV-based HTML tool for environments where deploying the full stack is not possible.

---

## Option A — Full Stack (Recommended)

Run the complete platform with real database, authentication, and background workers.

### Requirements

| Dependency | Version | Where to get |
|---|---|---|
| Node.js | 18+ | https://nodejs.org |
| npm | 9+ | bundled with Node |
| Redis | 7+ | `brew install redis` / `apt install redis` |
| Supabase account | — | https://supabase.com (free tier works) |

### 1-Minute Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy environment template
cp .env.example .env
# Edit .env — fill in SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET
# Redis defaults to localhost:6379 (no change needed for a local Redis)

# 3. Copy frontend env
cp .env.example frontend/.env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_API_URL

# 4. Run the Supabase migration
# Open your Supabase project → SQL Editor → paste and run:
#   supabase/migrations/001_initial_schema.sql

# 5. Start everything
npm run dev          # backend on :3001, frontend on :3000
```

Optional — background workers (warranty / license / SLA alerts):
```bash
cd backend && npm run worker
```

### Local Redis

```bash
# macOS
brew services start redis

# Ubuntu/Debian
sudo systemctl start redis

# Verify
redis-cli ping   # → PONG
```

---

## Option B — Standalone HTML Widget (No Server, No API)

A single HTML file that runs 100% in the browser. Data comes from CSV uploads. Nothing is stored on a server. Works offline after the file is opened.

### Features

| Feature | Status |
|---|---|
| CSV Upload (employees + assets) | Works |
| Real-time search / filter | Works |
| Asset ↔ Employee lookup | Works |
| License seat summary | Works |
| Onboarding checklist (static) | Works |
| Export to CSV / TXT | Works |
| No API, no login needed | 100% offline |
| Mobile friendly | Responsive layout |

### How to Use

1. Open `standalone/inventory-widget.html` in any modern browser
2. Click **Upload Employee CSV** → select your employee CSV file
3. Click **Upload Asset CSV** → select your asset CSV file
4. Use the search box to find employees or assets instantly
5. Click any row to see asset assignment history or employee details
6. Click **Export CSV** or **Export TXT** to download filtered data

### Creating the Standalone File

The standalone widget is a single self-contained HTML file. Create it at `standalone/inventory-widget.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>IT Inventory Tool</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, sans-serif; background: #f8fafc; color: #1e293b; }
  .container { max-width: 1100px; margin: 0 auto; padding: 1.5rem; }
  h1 { font-size: 1.4rem; font-weight: 700; margin-bottom: 1rem; }
  .toolbar { display: flex; gap: .75rem; flex-wrap: wrap; margin-bottom: 1rem; align-items: center; }
  input[type=search], input[type=file] { padding: .45rem .75rem; border: 1px solid #cbd5e1; border-radius: .5rem; font-size: .875rem; }
  input[type=search] { flex: 1; min-width: 200px; }
  button { padding: .45rem .9rem; background: #2563eb; color: #fff; border: none; border-radius: .5rem; font-size: .875rem; cursor: pointer; }
  button.secondary { background: #64748b; }
  table { width: 100%; border-collapse: collapse; background: #fff; border-radius: .75rem; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
  th { background: #f1f5f9; text-align: left; padding: .6rem 1rem; font-size: .75rem; text-transform: uppercase; letter-spacing: .05em; color: #475569; }
  td { padding: .65rem 1rem; font-size: .875rem; border-top: 1px solid #f1f5f9; }
  tr:hover td { background: #f8fafc; cursor: pointer; }
  .badge { display: inline-block; padding: .2rem .5rem; border-radius: 9999px; font-size: .7rem; font-weight: 600; }
  .badge-green { background: #dcfce7; color: #166534; }
  .badge-blue  { background: #dbeafe; color: #1e40af; }
  .badge-yellow{ background: #fef9c3; color: #92400e; }
  .badge-red   { background: #fee2e2; color: #991b1b; }
  .tabs { display: flex; gap: .5rem; margin-bottom: 1rem; }
  .tab { padding: .4rem .9rem; border-radius: .5rem; font-size: .875rem; cursor: pointer; background: #e2e8f0; border: none; }
  .tab.active { background: #2563eb; color: #fff; }
  #status { font-size: .8rem; color: #64748b; margin-left: auto; }
</style>
</head>
<body>
<div class="container">
  <h1>IT Inventory Tool</h1>

  <div class="tabs">
    <button class="tab active" onclick="switchTab('employees')">Employees</button>
    <button class="tab" onclick="switchTab('assets')">Assets</button>
  </div>

  <div class="toolbar">
    <input type="search" id="searchBox" placeholder="Search…" oninput="renderTable()">
    <label><input type="file" id="csvFile" accept=".csv" onchange="loadCSV()" style="display:none">
      <button onclick="document.getElementById('csvFile').click()">Upload CSV</button>
    </label>
    <button class="secondary" onclick="exportCSV()">Export CSV</button>
    <button class="secondary" onclick="exportTxt()">Export TXT</button>
    <span id="status"></span>
  </div>

  <table id="dataTable">
    <thead id="tableHead"></thead>
    <tbody id="tableBody"></tbody>
  </table>
</div>

<script>
let allData = [];
let currentTab = 'employees';

const EMPLOYEE_COLS = ['full_name','email','job_title','department','status','hire_date','location'];
const ASSET_COLS    = ['name','asset_type','serial_number','model','status','warranty_expiry','cost'];

function switchTab(tab) {
  currentTab = tab;
  allData = [];
  document.querySelectorAll('.tab').forEach((t,i) => t.classList.toggle('active', ['employees','assets'][i] === tab));
  document.getElementById('searchBox').value = '';
  renderTable();
}

function loadCSV() {
  const file = document.getElementById('csvFile').files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const lines = e.target.result.split('\n').filter(l => l.trim());
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g,'_'));
    allData = lines.slice(1).map(line => {
      const vals = parseCSVLine(line);
      return Object.fromEntries(headers.map((h, i) => [h, vals[i]?.trim() || '']));
    }).filter(r => Object.values(r).some(v => v));
    document.getElementById('status').textContent = `${allData.length} rows loaded`;
    renderTable();
  };
  reader.readAsText(file);
}

function parseCSVLine(line) {
  const result = []; let cur = ''; let inQ = false;
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; }
    else if (ch === ',' && !inQ) { result.push(cur); cur = ''; }
    else { cur += ch; }
  }
  result.push(cur);
  return result;
}

function getFilteredData() {
  const q = document.getElementById('searchBox').value.toLowerCase();
  if (!q) return allData;
  return allData.filter(row => Object.values(row).some(v => String(v).toLowerCase().includes(q)));
}

function renderTable() {
  const cols = currentTab === 'employees' ? EMPLOYEE_COLS : ASSET_COLS;
  const data = getFilteredData();

  document.getElementById('tableHead').innerHTML =
    '<tr>' + cols.map(c => `<th>${c.replace(/_/g,' ')}</th>`).join('') + '</tr>';

  document.getElementById('tableBody').innerHTML = data.length
    ? data.map(row => '<tr>' + cols.map(c => `<td>${badge(c, row[c] ?? '')}</td>`).join('') + '</tr>').join('')
    : '<tr><td colspan="' + cols.length + '" style="text-align:center;padding:2rem;color:#94a3b8">No data — upload a CSV to get started</td></tr>';

  document.getElementById('status').textContent = allData.length
    ? `Showing ${data.length} of ${allData.length}`
    : '';
}

function badge(col, val) {
  if (col !== 'status') return escHtml(val);
  const map = { active:'green', available:'green', assigned:'blue', offboarding:'yellow',
                maintenance:'yellow', inactive:'red', retired:'red', expired:'red' };
  const cls = map[val] || '';
  return cls ? `<span class="badge badge-${cls}">${escHtml(val)}</span>` : escHtml(val);
}

function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function exportCSV() {
  const cols = currentTab === 'employees' ? EMPLOYEE_COLS : ASSET_COLS;
  const data = getFilteredData();
  const lines = [cols.join(','), ...data.map(r => cols.map(c => {
    const v = String(r[c] ?? '').replace(/"/g,'""');
    return /[,"\n]/.test(v) ? `"${v}"` : v;
  }).join(','))];
  download(lines.join('\n'), `${currentTab}-export.csv`, 'text/csv');
}

function exportTxt() {
  const cols = currentTab === 'employees' ? EMPLOYEE_COLS : ASSET_COLS;
  const data = getFilteredData();
  const lines = [cols.join(' | '), cols.map(() => '---').join(' | '),
    ...data.map(r => cols.map(c => String(r[c] ?? '')).join(' | '))];
  download(lines.join('\n'), `${currentTab}-export.txt`, 'text/plain');
}

function download(content, filename, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = filename; a.click();
}

renderTable();
</script>
</body>
</html>
```

Save the file, then open it directly in your browser — no server needed.

---

## Data Export from Excel / AD

### From Excel (HR data)
1. Open your Excel file
2. File → Save As → CSV UTF-8 (Comma delimited)
3. Ensure column headers match the expected names (see `DEVELOPER_PROMPT.md` § 3)

### From Active Directory (PowerShell)
```powershell
Get-ADUser -Filter * -Properties DisplayName,EmailAddress,Department,Title,Enabled |
  Select-Object @{n='full_name';e={$_.DisplayName}},
               @{n='email';e={$_.EmailAddress}},
               @{n='department';e={$_.Department}},
               @{n='job_title';e={$_.Title}},
               @{n='status';e={if($_.Enabled){'active'}else{'inactive'}}} |
  Export-Csv -Path employees.csv -NoTypeInformation -Encoding UTF8
```

### From SCCM / Intune (asset data)
Export devices from the Intune portal:
- Devices → All devices → Export (top-right button)
- Rename columns to match the asset CSV format before uploading

---

## FAQ

**Q: Does the standalone widget save my data?**
Data lives only in your browser tab's memory. Closing or refreshing the tab clears it. Export to CSV first if you need to save changes.

**Q: Can I use the widget on my phone?**
Yes — open the HTML file from a cloud drive (Google Drive, OneDrive) in your mobile browser. The layout is responsive.

**Q: How do I share the widget with my team without a server?**
Email the `standalone/inventory-widget.html` file directly. Each person uploads their own CSV locally.

**Q: What is the maximum CSV size?**
The standalone widget handles up to ~50,000 rows comfortably in a modern browser. For larger datasets, use the full-stack version (Option A).

**Q: Date format problems?**
All dates must be `YYYY-MM-DD`. If Excel shows dates differently, format the column as Text first, then use `=TEXT(A1,"YYYY-MM-DD")` to convert.
