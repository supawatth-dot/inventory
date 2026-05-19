import { useState, useMemo } from 'react';

// ─── Column-name aliases for flexible CSV ingestion ───────────────────────────
const EMP_ALIASES = {
  full_name:         ['full_name', 'name', 'employee_name'],
  email:             ['email'],
  department:        ['department', 'dept'],
  license_status:    ['license_status', 'license'],
  licenses:          ['licenses', 'license_list'],
  user_created_date: ['user_created_date', 'created_date', 'date'],
};
const ASSET_ALIASES = {
  device_name:  ['device_name', 'computername', 'computer'],
  asset_type:   ['asset_type', 'type'],
  serial_number:['serial_number', 'sn_no', 'sn', 'serial'],
  assigned_to:  ['assigned_to', 'user_name', 'owner'],
  hat_asset_id: ['hat_asset_id', 'asset_id'],
  department:   ['department', 'dept'],
};

// ─── Demo data ────────────────────────────────────────────────────────────────
const DEMO_EMPLOYEES = [
  { full_name:'Phimthong Rattanaporn', email:'rattanaporn.p@company.com', department:'WORKSHOP MGM',  license_status:'Licensed',   licenses:'M365 E5',               user_created_date:'' },
  { full_name:'Adam Doyle',            email:'doyle.a@company.com',       department:'FS PERSONNEL',  license_status:'Licensed',   licenses:'M365 E5, PA Free',      user_created_date:'' },
  { full_name:'Insupang Dhanusri',     email:'dhanusri@company.com',      department:'ADMINISTRATION',license_status:'Licensed',   licenses:'M365 E5, D365 Sales',   user_created_date:'' },
  { full_name:'Sarah Johnson',         email:'sarah.j@company.com',       department:'WAREHOUSE',     license_status:'No License', licenses:'',                      user_created_date:'' },
];
const DEMO_ASSETS = [
  { device_name:'BKKDSK029', asset_type:'Desktop', serial_number:'DK-2019-001', assigned_to:'Phimthong Rattanaporn', hat_asset_id:'1000000050', department:'WORKSHOP MGM'  },
  { device_name:'BKKFPG003', asset_type:'Laptop',  serial_number:'LP-2019-003', assigned_to:'Adam Doyle',            hat_asset_id:'ITE-23-012',  department:'FS PERSONNEL'  },
  { device_name:'BKKCPY001', asset_type:'Printer', serial_number:'PR-2018-001', assigned_to:'',                      hat_asset_id:'1000000089', department:'FACILITIES'    },
  { device_name:'BKKMON005', asset_type:'Monitor', serial_number:'MN-2021-005', assigned_to:'Insupang Dhanusri',     hat_asset_id:'1000000200', department:'ADMINISTRATION'},
];

// ─── CSV helpers ──────────────────────────────────────────────────────────────
function colIndex(headers, aliases) {
  for (const a of aliases) {
    const i = headers.indexOf(a.toLowerCase().trim());
    if (i !== -1) return i;
  }
  return -1;
}

function parseCSV(text, aliases) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.toLowerCase().trim());
  const idx = Object.fromEntries(
    Object.entries(aliases).map(([field, alts]) => [field, colIndex(headers, alts)])
  );
  return lines.slice(1).map(line => {
    // handle quoted commas naively — split on comma, rejoin quoted segments
    const cells = line.split(',');
    const get = i => (i >= 0 ? (cells[i] || '').trim() : '');
    return Object.fromEntries(Object.keys(aliases).map(field => [field, get(idx[field])]));
  }).filter(row => Object.values(row).some(v => v));
}

// ─── Checklist text export ────────────────────────────────────────────────────
function buildChecklistText(emp, devices) {
  const eq = devices.length
    ? devices.map(d => `   [ ] ${d.device_name} (${d.asset_type}) — S/N: ${d.serial_number}`).join('\n')
    : '   [ ] Allocate device from pool';
  return [
    'ONBOARDING CHECKLIST',
    '====================',
    `Employee  : ${emp.full_name}`,
    `Email     : ${emp.email}`,
    `Department: ${emp.department}`,
    `Date      : ${new Date().toLocaleDateString()}`,
    '',
    '1. AD & EMAIL SETUP',
    '   [ ] Create Active Directory account',
    '   [ ] Setup email account',
    '   [ ] Add to department groups',
    '',
    '2. LICENSE & ACCESS',
    `   [ ] Assign license${emp.licenses ? ': ' + emp.licenses : ''}`,
    '   [ ] Configure VPN access',
    '   [ ] Setup WiFi / network access',
    '',
    '3. EQUIPMENT',
    eq,
    '',
    '4. TRAINING',
    '   [ ] Complete security awareness training',
    '   [ ] Review company policies',
    '   [ ] IT acceptable use policy sign-off',
  ].join('\n');
}

function downloadTxt(filename, text) {
  const blob = new Blob([text], { type: 'text/plain' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [employees,    setEmployees]    = useState(DEMO_EMPLOYEES);
  const [assets,       setAssets]       = useState(DEMO_ASSETS);
  const [empLoaded,    setEmpLoaded]    = useState(false);
  const [assetLoaded,  setAssetLoaded]  = useState(false);
  const [query,        setQuery]        = useState('');
  const [mode,         setMode]         = useState('employee'); // 'employee' | 'device'
  const [selected,     setSelected]     = useState(null);
  const [showModal,    setShowModal]    = useState(false);
  const [checks,       setChecks]       = useState({});

  // ── file handlers ──
  function handleEmpFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const parsed = parseCSV(ev.target.result, EMP_ALIASES);
      if (parsed.length) { setEmployees(parsed); setEmpLoaded(true); setSelected(null); }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function handleAssetFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const parsed = parseCSV(ev.target.result, ASSET_ALIASES);
      if (parsed.length) { setAssets(parsed); setAssetLoaded(true); setSelected(null); }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  // ── filtered lists ──
  const filteredEmployees = useMemo(() => {
    if (mode !== 'employee') return [];
    const q = query.toLowerCase();
    if (!q) return employees;
    return employees.filter(e =>
      e.full_name.toLowerCase().includes(q) ||
      e.email.toLowerCase().includes(q) ||
      e.department.toLowerCase().includes(q)
    );
  }, [employees, query, mode]);

  const filteredAssets = useMemo(() => {
    if (mode !== 'device') return [];
    const q = query.toLowerCase();
    if (!q) return assets;
    return assets.filter(a =>
      a.device_name.toLowerCase().includes(q) ||
      a.asset_type.toLowerCase().includes(q) ||
      a.serial_number.toLowerCase().includes(q) ||
      a.assigned_to.toLowerCase().includes(q)
    );
  }, [assets, query, mode]);

  const assignedAssets = useMemo(() => {
    if (!selected || mode !== 'employee') return [];
    return assets.filter(a =>
      a.assigned_to.toLowerCase() === selected.full_name.toLowerCase()
    );
  }, [assets, selected, mode]);

  const results = mode === 'employee' ? filteredEmployees : filteredAssets;

  function switchMode(m) {
    setMode(m);
    setQuery('');
    setSelected(null);
  }

  function toggleCheck(key) {
    setChecks(prev => ({ ...prev, [key]: !prev[key] }));
  }

  function openChecklist() {
    setChecks({});
    setShowModal(true);
  }

  // ── icons (inline SVG to stay dependency-free) ──
  const UploadIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
    </svg>
  );
  const SearchIcon = () => (
    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
    </svg>
  );

  return (
    // Outer wrapper is `relative` so the modal overlay can use `absolute inset-0`
    <div className="relative min-h-screen bg-gray-50 font-sans">

      {/* ── main content — blurred behind modal ── */}
      <div className={showModal ? 'pointer-events-none select-none opacity-30' : ''}>
        <div className="max-w-5xl mx-auto px-4 py-8">

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">IT Asset &amp; User Lookup</h1>
            <p className="text-sm text-gray-500 mt-1">Offline — all data stays in memory, nothing is sent anywhere.</p>
          </div>

          {/* ── Upload row ── */}
          <div className="flex flex-wrap items-center gap-3 mb-8 p-4 bg-white border border-gray-200 rounded">
            {/* Employee upload */}
            <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded text-sm font-medium text-gray-700 hover:bg-gray-50">
              <UploadIcon /> Upload Employees CSV
              <input type="file" accept=".csv" className="hidden" onChange={handleEmpFile} />
            </label>
            {empLoaded && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                ✓ {employees.length} users loaded
              </span>
            )}

            <span className="text-gray-300 hidden sm:inline">|</span>

            {/* Asset upload */}
            <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 rounded text-sm font-medium text-gray-700 hover:bg-gray-50">
              <UploadIcon /> Upload Assets CSV
              <input type="file" accept=".csv" className="hidden" onChange={handleAssetFile} />
            </label>
            {assetLoaded && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                ✓ {assets.length} assets loaded
              </span>
            )}

            {!empLoaded && !assetLoaded && (
              <span className="ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                Demo data active — upload CSV to replace
              </span>
            )}
          </div>

          {/* ── Search & toggle ── */}
          <div className="mb-6">
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => switchMode('employee')}
                className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                  mode === 'employee' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                Employee
              </button>
              <button
                onClick={() => switchMode('device')}
                className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                  mode === 'device' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                Device
              </button>
            </div>

            <div className="relative">
              <span className="absolute inset-y-0 left-3 flex items-center"><SearchIcon /></span>
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={mode === 'employee'
                  ? 'Search by name, email, or department…'
                  : 'Search by device name, type, or serial…'}
                className="w-full pl-9 pr-4 py-2 bg-white border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1.5">{results.length} result{results.length !== 1 ? 's' : ''}</p>
          </div>

          {/* ── Results grid ── */}
          {results.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-sm">
              {query ? 'No results match your search.' : 'Upload a CSV file to get started.'}
            </div>
          ) : (
            <div
              className="mb-8"
              style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '0.75rem' }}
            >
              {mode === 'employee' && filteredEmployees.map((emp, i) => (
                <div
                  key={i}
                  onClick={() => setSelected(emp)}
                  className={`bg-white border rounded p-4 cursor-pointer hover:shadow-sm transition-shadow ${
                    selected === emp ? 'border-l-4 border-l-blue-500 border-blue-200' : 'border-gray-200'
                  }`}
                >
                  <p className="font-semibold text-gray-900 text-sm truncate">{emp.full_name}</p>
                  <p className="text-xs text-gray-500 truncate mt-0.5">{emp.email}</p>
                  <p className="text-xs text-gray-600 mt-1">{emp.department}</p>
                  <span className={`inline-flex items-center mt-2 px-2 py-0.5 rounded-full text-xs font-medium ${
                    emp.license_status === 'Licensed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {emp.license_status || 'No License'}
                  </span>
                </div>
              ))}

              {mode === 'device' && filteredAssets.map((asset, i) => (
                <div
                  key={i}
                  onClick={() => setSelected(asset)}
                  className={`bg-white border rounded p-4 cursor-pointer hover:shadow-sm transition-shadow ${
                    selected === asset ? 'border-l-4 border-l-blue-500 border-blue-200' : 'border-gray-200'
                  }`}
                >
                  <p className="font-semibold text-gray-900 text-sm truncate">{asset.device_name}</p>
                  <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {asset.asset_type}
                  </span>
                  <p className="text-xs text-gray-500 mt-1.5">S/N: {asset.serial_number || '—'}</p>
                  <p className="text-xs text-gray-600 truncate mt-0.5">{asset.assigned_to || 'Unassigned'}</p>
                </div>
              ))}
            </div>
          )}

          {/* ── Detail panel ── */}
          {selected && (
            <div className="bg-white border border-gray-200 rounded p-6 mb-8">
              {mode === 'employee' ? (
                <>
                  <div className="flex items-start justify-between mb-5">
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">{selected.full_name}</h2>
                      <p className="text-sm text-gray-500 mt-0.5">{selected.email}</p>
                      <p className="text-sm text-gray-600">{selected.department}</p>
                    </div>
                    <button
                      onClick={() => setSelected(null)}
                      className="text-gray-400 hover:text-gray-700 text-xl leading-none ml-4"
                      aria-label="Close"
                    >×</button>
                  </div>

                  {/* License status */}
                  <section className="mb-5">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">License Status</p>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium ${
                      selected.license_status === 'Licensed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {selected.license_status || 'No License'}
                    </span>
                  </section>

                  {/* License list */}
                  {selected.licenses && (
                    <section className="mb-5">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Licenses</p>
                      <div className="flex flex-wrap gap-1.5">
                        {selected.licenses.split(',').map((lic, i) => (
                          <span key={i} className="px-2.5 py-0.5 bg-blue-50 text-blue-700 text-xs rounded border border-blue-200">
                            {lic.trim()}
                          </span>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Assigned equipment */}
                  <section className="mb-6">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Assigned Equipment</p>
                    {assignedAssets.length > 0 ? (
                      <div className="space-y-2">
                        {assignedAssets.map((a, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm text-gray-700">
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full">{a.asset_type}</span>
                            <span className="font-medium">{a.device_name}</span>
                            <span className="text-gray-400 text-xs">S/N: {a.serial_number}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400">No equipment assigned</p>
                    )}
                  </section>

                  <button
                    onClick={openChecklist}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors"
                  >
                    Generate Onboarding Checklist
                  </button>
                </>
              ) : (
                /* Device detail */
                <>
                  <div className="flex items-start justify-between mb-5">
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">{selected.device_name}</h2>
                      <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {selected.asset_type}
                      </span>
                    </div>
                    <button
                      onClick={() => setSelected(null)}
                      className="text-gray-400 hover:text-gray-700 text-xl leading-none ml-4"
                      aria-label="Close"
                    >×</button>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                    {[
                      ['Serial Number', selected.serial_number],
                      ['HAT Asset ID',  selected.hat_asset_id],
                      ['Assigned To',   selected.assigned_to || 'Unassigned'],
                      ['Department',    selected.department],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt className="text-xs font-semibold text-gray-400 uppercase tracking-widest">{label}</dt>
                        <dd className="mt-1 text-gray-800">{value || '—'}</dd>
                      </div>
                    ))}
                  </dl>
                </>
              )}
            </div>
          )}

        </div>
      </div>

      {/* ── Onboarding Checklist Modal (absolute, not fixed) ── */}
      {showModal && selected && mode === 'employee' && (
        <div className="absolute inset-0 bg-black bg-opacity-40 flex items-start justify-center px-4 pt-12 pb-12">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg overflow-y-auto" style={{ maxHeight: '85vh' }}>
            <div className="p-6">

              {/* Modal header */}
              <div className="flex items-start justify-between mb-5">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Onboarding Checklist</h2>
                  <p className="text-sm text-gray-500 mt-0.5">{selected.full_name} · {selected.department}</p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-700 text-2xl leading-none ml-4"
                  aria-label="Close"
                >×</button>
              </div>

              {/* 1 · AD & Email */}
              <CheckSection
                title="1. AD & Email Setup"
                items={[
                  'Create Active Directory account',
                  'Setup email account',
                  'Add to department groups',
                ]}
                prefix="ad"
                checks={checks}
                toggle={toggleCheck}
              />

              {/* 2 · License & Access */}
              <CheckSection
                title="2. License & Access"
                items={[
                  selected.licenses ? `Assign license: ${selected.licenses}` : 'Assign software license',
                  'Configure VPN access',
                  'Setup WiFi / network access',
                ]}
                prefix="lic"
                checks={checks}
                toggle={toggleCheck}
              />

              {/* 3 · Equipment */}
              <div className="mb-5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">3. Equipment</p>
                {assignedAssets.length > 0 ? (
                  assignedAssets.map((a, i) => (
                    <CheckItem
                      key={i}
                      id={`eq_${i}`}
                      label={`${a.device_name} (${a.asset_type}) — S/N: ${a.serial_number}`}
                      checks={checks}
                      toggle={toggleCheck}
                    />
                  ))
                ) : (
                  <CheckItem id="eq_pool" label="Allocate device from pool" checks={checks} toggle={toggleCheck} />
                )}
              </div>

              {/* 4 · Training */}
              <CheckSection
                title="4. Training"
                items={[
                  'Complete security awareness training',
                  'Review company policies',
                  'IT acceptable use policy sign-off',
                ]}
                prefix="tr"
                checks={checks}
                toggle={toggleCheck}
              />

              {/* Action buttons */}
              <div className="flex gap-2 mt-6">
                <button
                  onClick={() => downloadTxt(
                    `onboarding_${selected.full_name.replace(/\s+/g, '_')}.txt`,
                    buildChecklistText(selected, assignedAssets)
                  )}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors"
                >
                  Export Checklist
                </button>
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Small sub-components (stay in same file per requirement) ─────────────────
function CheckItem({ id, label, checks, toggle }) {
  return (
    <label className="flex items-start gap-2.5 py-1.5 cursor-pointer">
      <input
        type="checkbox"
        checked={!!checks[id]}
        onChange={() => toggle(id)}
        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 cursor-pointer"
      />
      <span className={`text-sm leading-snug ${checks[id] ? 'line-through text-gray-400' : 'text-gray-700'}`}>
        {label}
      </span>
    </label>
  );
}

function CheckSection({ title, items, prefix, checks, toggle }) {
  return (
    <div className="mb-5">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">{title}</p>
      {items.map((item, i) => (
        <CheckItem key={i} id={`${prefix}_${i}`} label={item} checks={checks} toggle={toggle} />
      ))}
    </div>
  );
}
