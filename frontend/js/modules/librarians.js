// ─────────────────────────────────────────────────────────────
//  librarians.js  —  Librarians module
//  Entry point: window.loadLibrariansModule(user, container)
//
//  ADMIN:     full CRUD + assign supervised librarians
//  LIBRARIAN: view & edit own profile only
// ─────────────────────────────────────────────────────────────

// ─── State ────────────────────────────────────────────────────
let _allLibrarians = [];
let _libUser       = null;

// ─── Helpers ──────────────────────────────────────────────────
function escL(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

function libInitials(name) {
  return (name ?? '—').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function libAvatarColor(name) {
  const colors = [
    { bg: '#e8f0e8', text: '#2d4a2d' },
    { bg: '#fdf3d0', text: '#7a5c00' },
    { bg: '#f3ebe0', text: '#5c3d1e' },
    { bg: '#e8edf5', text: '#2a3f6b' },
    { bg: '#fdecea', text: '#8b3a1a' },
    { bg: '#f0e8f0', text: '#4a2a6b' },
  ];
  let hash = 0;
  for (const c of (name ?? '')) hash += c.charCodeAt(0);
  return colors[hash % colors.length];
}

function formatDateL(ds) {
  if (!ds) return '—';
  return new Date(ds).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

// ─── Filter ───────────────────────────────────────────────────
function filterLibrarians(query, deskFilter) {
  const q = query.toLowerCase();
  return _allLibrarians.filter(l => {
    const matchQ = !q
      || (l.name         ?? '').toLowerCase().includes(q)
      || (l.email        ?? '').toLowerCase().includes(q)
      || (l.deskLocation ?? '').toLowerCase().includes(q)
      || String(l.employeeId ?? '').includes(q);
    const matchD = !deskFilter
      || (l.deskLocation ?? '').toLowerCase().includes(deskFilter.toLowerCase());
    return matchQ && matchD;
  });
}

// ─── Re-render ────────────────────────────────────────────────
function rerenderLibrarians() {
  const query = document.getElementById('libSearch')?.value     ?? '';
  const desk  = document.getElementById('libDeskFilter')?.value ?? '';
  const items = filterLibrarians(query, desk);
  const list  = document.getElementById('libList');
  if (!list) return;
  list.innerHTML = renderLibrarianTable(items);
  document.getElementById('libCount').textContent =
    `${items.length} librarian${items.length !== 1 ? 's' : ''}`;

  // Populate desk filter dynamically
  const deskSel = document.getElementById('libDeskFilter');
  const current = deskSel.value;
  const desks   = [...new Set(
    _allLibrarians.map(l => l.deskLocation).filter(Boolean)
  )].sort();
  deskSel.innerHTML =
    `<option value="">All Desks</option>` +
    desks.map(d =>
      `<option value="${escL(d)}" ${d === current ? 'selected' : ''}>${escL(d)}</option>`
    ).join('');
}

// ─── Table row (Admin) ────────────────────────────────────────
function buildLibRow(lib) {
  const color = libAvatarColor(lib.name);
  const ini   = libInitials(lib.name);

  return `
    <tr data-id="${lib.employeeId}">
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <div style="
            width:32px;height:32px;border-radius:50%;flex-shrink:0;
            background:${color.bg};color:${color.text};
            font-family:'Playfair Display',serif;font-size:12px;font-weight:700;
            display:flex;align-items:center;justify-content:center;
          ">${ini}</div>
          <div>
            <div style="font-weight:600;color:var(--ink)">${escL(lib.name)}</div>
            <div style="font-size:12px;color:var(--ink-muted)">${escL(lib.email ?? '—')}</div>
          </div>
        </div>
      </td>
      <td><code style="font-size:12px">#${lib.employeeId ?? '—'}</code></td>
      <td>${escL(lib.deskLocation ?? '—')}</td>
      <td>${escL(lib.phone ?? '—')}</td>
      <td>
        <span style="
          font-family:'DM Mono',monospace;font-size:11px;
          color:var(--ink-muted);
        ">
          ${Array.isArray(lib.managedFines) ? lib.managedFines.length : 0} fines managed
        </span>
      </td>
      <td>
        <div class="td-actions">
          <button class="btn-icon" title="View Profile"
            onclick="openLibDetail(${lib.employeeId})">👁️</button>
          <button class="btn-icon" title="Edit"
            onclick="openLibModal(${lib.employeeId})">✏️</button>
          <button class="btn-icon danger" title="Remove"
            onclick="deleteLibrarian(${lib.employeeId},'${escL(lib.name)}')">🗑️</button>
        </div>
      </td>
    </tr>`;
}

function renderLibrarianTable(items) {
  if (!items.length) return `
    <div class="empty-state" style="padding:60px">
      <span class="empty-state-icon">🗝️</span>
      <p class="empty-state-text">No librarians found</p>
    </div>`;
  return `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Librarian</th><th>Employee ID</th><th>Desk</th>
            <th>Phone</th><th>Activity</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>${items.map(buildLibRow).join('')}</tbody>
      </table>
    </div>`;
}

// ─── Own profile (Librarian role) ─────────────────────────────
function renderOwnLibProfile(lib) {
  const color = libAvatarColor(lib.name);
  const ini   = libInitials(lib.name);
  const fines = Array.isArray(lib.managedFines) ? lib.managedFines : [];

  return `
    <div style="max-width:680px;margin:0 auto;display:flex;flex-direction:column;gap:24px">

      <!-- Profile card -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">My Librarian Profile</span>
          <button class="btn-secondary" style="font-size:14px;padding:7px 16px"
            onclick="openLibModal(${lib.employeeId})">✏️ Edit Profile</button>
        </div>
        <div class="card-body">
          <div style="display:flex;align-items:center;gap:20px;margin-bottom:24px">
            <div style="
              width:72px;height:72px;border-radius:50%;flex-shrink:0;
              background:${color.bg};color:${color.text};
              font-family:'Playfair Display',serif;font-size:26px;font-weight:700;
              display:flex;align-items:center;justify-content:center;
              border:3px solid ${color.text}33;
            ">${ini}</div>
            <div>
              <div style="
                font-family:'Playfair Display',serif;
                font-size:24px;font-weight:700;color:var(--ink);
              ">${escL(lib.name)}</div>
              <div style="
                font-family:'DM Mono',monospace;font-size:12px;
                color:var(--ink-muted);letter-spacing:0.08em;margin-top:4px;
              ">${escL(lib.email ?? '—')} &nbsp;·&nbsp; Employee #${lib.employeeId}</div>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
            ${[
              ['Desk Location', lib.deskLocation],
              ['Phone',         lib.phone],
              ['Address',       lib.address],
              ['Fines Managed', fines.length],
            ].map(([label, val]) => `
              <div>
                <div style="font-family:'DM Mono',monospace;font-size:10px;
                  letter-spacing:0.14em;text-transform:uppercase;
                  color:var(--brown);margin-bottom:4px">${label}</div>
                <div style="color:var(--ink);font-size:15px">${escL(val) || '—'}</div>
              </div>`).join('')}
          </div>
        </div>
      </div>

      <!-- Managed fines -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">💰 Managed Fines (${fines.length})</span>
        </div>
        ${fines.length
          ? `<div class="table-wrapper"><table>
              <thead><tr>
                <th>Fine ID</th><th>Amount</th><th>Issued</th><th>Status</th>
              </tr></thead>
              <tbody>
                ${fines.slice(0, 8).map(f => `
                  <tr>
                    <td>#${f.fineId ?? '—'}</td>
                    <td style="font-family:'DM Mono',monospace">
                      $${Number(f.amount ?? 0).toFixed(2)}
                    </td>
                    <td>${formatDateL(f.issueDate)}</td>
                    <td>
                      <span class="badge ${f.isPaid ? 'badge-paid' : 'badge-unpaid'}">
                        ${f.isPaid ? 'Paid' : 'Unpaid'}
                      </span>
                    </td>
                  </tr>`).join('')}
              </tbody>
            </table></div>`
          : `<div class="empty-state" style="padding:32px">
              <span class="empty-state-icon">💰</span>
              <p class="empty-state-text">No fines managed yet</p>
             </div>`}
      </div>
    </div>`;
}

// ─── Add / Edit modal ─────────────────────────────────────────
window.openLibModal = function(employeeId = null) {
  const lib    = employeeId ? _allLibrarians.find(l => l.employeeId === employeeId) : null;
  const isEdit = !!lib;

  document.getElementById('libModalTitle').textContent =
    isEdit ? 'Edit Librarian' : 'Add Librarian';

  const f = document.getElementById('libForm');
  f.querySelector('[name=name]').value         = lib?.name         ?? '';
  f.querySelector('[name=email]').value        = lib?.email        ?? '';
  f.querySelector('[name=phone]').value        = lib?.phone        ?? '';
  f.querySelector('[name=address]').value      = lib?.address      ?? '';
  f.querySelector('[name=deskLocation]').value = lib?.deskLocation ?? '';
  f.dataset.employeeId = employeeId ?? '';

  // Password only on create
  document.getElementById('libPwField').style.display = isEdit ? 'none' : 'block';

  document.getElementById('libModal').classList.add('open');
};

window.closeLibModal = function() {
  document.getElementById('libModal').classList.remove('open');
};

window.submitLibForm = async function() {
  const f    = document.getElementById('libForm');
  const eid  = f.dataset.employeeId ? parseInt(f.dataset.employeeId) : null;

  const payload = {
    name:         f.querySelector('[name=name]').value.trim(),
    email:        f.querySelector('[name=email]').value.trim(),
    phone:        f.querySelector('[name=phone]').value.trim(),
    address:      f.querySelector('[name=address]').value.trim(),
    deskLocation: f.querySelector('[name=deskLocation]').value.trim(),
    ...(!eid && { password: f.querySelector('[name=password]')?.value ?? '' }),
  };

  if (!payload.name)  { showToast('Name is required.',  'error'); return; }
  if (!payload.email) { showToast('Email is required.', 'error'); return; }

  const btn = document.getElementById('libSaveBtn');
  btn.disabled = true; btn.textContent = 'Saving…';

  try {
    if (eid) {
      const updated = await api.updateLibrarian(eid, payload);
      const idx = _allLibrarians.findIndex(l => l.employeeId === eid);
      if (idx !== -1) _allLibrarians[idx] = { ..._allLibrarians[idx], ...updated };
      showToast('Librarian updated.', 'success');
    } else {
      const created = await api.createLibrarian(payload);
      _allLibrarians.unshift(created);
      showToast('Librarian added.', 'success');
    }
    closeLibModal();
    if (_libUser?.role === 'LIBRARIAN') {
      loadLibrariansModule(_libUser, document.getElementById('mainContent'));
    } else {
      rerenderLibrarians();
    }
  } catch (err) {
    showToast(err.message || 'Failed to save librarian.', 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Save';
  }
};

// ─── Delete (Admin only) ──────────────────────────────────────
window.deleteLibrarian = function(employeeId, name) {
  const modal = document.getElementById('libConfirmModal');
  document.getElementById('libConfirmMsg').textContent =
    `Remove librarian "${name}" from the system? This cannot be undone.`;
  modal.classList.add('open');

  document.getElementById('libConfirmOk').onclick = async () => {
    modal.classList.remove('open');
    try {
      await api.deleteLibrarian(employeeId);
      _allLibrarians = _allLibrarians.filter(l => l.employeeId !== employeeId);
      showToast('Librarian removed.', 'success');
      rerenderLibrarians();
    } catch (err) {
      showToast(err.message || 'Failed to delete.', 'error');
    }
  };
};

// ─── Detail modal (Admin) ─────────────────────────────────────
window.openLibDetail = function(employeeId) {
  const lib = _allLibrarians.find(l => l.employeeId === employeeId);
  if (!lib) return;

  const color = libAvatarColor(lib.name);
  const ini   = libInitials(lib.name);
  const fines = Array.isArray(lib.managedFines) ? lib.managedFines : [];

  document.getElementById('libDetailBody').innerHTML = `
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:22px">
      <div style="
        width:56px;height:56px;border-radius:50%;flex-shrink:0;
        background:${color.bg};color:${color.text};
        font-family:'Playfair Display',serif;font-size:20px;font-weight:700;
        display:flex;align-items:center;justify-content:center;
        border:2px solid ${color.text}33;
      ">${ini}</div>
      <div>
        <div style="font-family:'Playfair Display',serif;font-size:20px;
          font-weight:700;color:var(--ink)">${escL(lib.name)}</div>
        <div style="font-family:'DM Mono',monospace;font-size:11px;
          color:var(--ink-muted);letter-spacing:0.08em;margin-top:3px">
          ${escL(lib.email ?? '—')} &nbsp;·&nbsp; Employee #${lib.employeeId}
        </div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;
      margin-bottom:20px;font-size:15px">
      ${[
        ['Desk Location', lib.deskLocation],
        ['Phone',         lib.phone],
        ['Address',       lib.address],
        ['Fines Managed', fines.length],
      ].map(([label, val]) => `
        <div>
          <div style="font-family:'DM Mono',monospace;font-size:10px;
            letter-spacing:0.14em;text-transform:uppercase;
            color:var(--brown);margin-bottom:4px">${label}</div>
          <div style="color:var(--ink)">${escL(val) || '—'}</div>
        </div>`).join('')}
    </div>

    <div style="font-family:'DM Mono',monospace;font-size:10px;
      letter-spacing:0.18em;text-transform:uppercase;
      color:var(--brown);margin-bottom:10px">
      Recent Fines Managed (${fines.length})
    </div>
    ${fines.length
      ? `<div class="table-wrapper"><table>
          <thead><tr>
            <th>Fine ID</th><th>Amount</th><th>Issued</th><th>Status</th>
          </tr></thead>
          <tbody>
            ${fines.slice(0, 5).map(f => `
              <tr>
                <td>#${f.fineId ?? '—'}</td>
                <td style="font-family:'DM Mono',monospace">
                  $${Number(f.amount ?? 0).toFixed(2)}
                </td>
                <td>${formatDateL(f.issueDate)}</td>
                <td>
                  <span class="badge ${f.isPaid ? 'badge-paid' : 'badge-unpaid'}">
                    ${f.isPaid ? 'Paid' : 'Unpaid'}
                  </span>
                </td>
              </tr>`).join('')}
          </tbody>
        </table></div>`
      : `<div class="empty-state" style="padding:24px">
          <span class="empty-state-icon">💰</span>
          <p class="empty-state-text">No fines managed yet</p>
         </div>`}
  `;

  document.getElementById('libDetailModal').classList.add('open');
};

window.closeLibDetail = function() {
  document.getElementById('libDetailModal').classList.remove('open');
};

// ─── Main entry ───────────────────────────────────────────────
window.loadLibrariansModule = async function(user, container) {
  _libUser = user;
  const role    = user.role;
  const isAdmin = role === 'ADMIN';

  // Librarian: own profile only
  if (role === 'LIBRARIAN') {
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">🗝️ My Profile</h1>
          <p class="page-subtitle">Your librarian account and managed fines.</p>
        </div>
      </div>
      <div class="page-body">
        <div class="loading-state">
          <span class="spinner"></span><span>Loading your profile…</span>
        </div>
      </div>`;

    try {
      const lib = await api.getLibrarian(user.id);
      _allLibrarians = [lib];
      container.querySelector('.page-body').innerHTML = renderOwnLibProfile(lib);
    } catch (err) {
      container.querySelector('.page-body').innerHTML = `
        <div class="empty-state"><p class="empty-state-text">
          Could not load profile. ${err.message}
        </p></div>`;
    }

    container.insertAdjacentHTML('beforeend', libModalHTML());
    document.getElementById('libModal').addEventListener('click', function(e) {
      if (e.target === this) this.classList.remove('open');
    });
    return;
  }

  // Admin: full list
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">🗝️ Librarians</h1>
        <p class="page-subtitle">Manage librarian accounts and desk assignments.</p>
      </div>
      <div class="page-actions">
        <button class="btn-primary" onclick="openLibModal()">＋ Add Librarian</button>
      </div>
    </div>

    <div class="page-body">

      <!-- Toolbar -->
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:20px">
        <div class="search-bar" style="max-width:300px;flex:1">
          <input type="text" id="libSearch"
            placeholder="Search by name, email, desk, ID…"
            oninput="rerenderLibrarians()"/>
        </div>
        <select id="libDeskFilter" onchange="rerenderLibrarians()" style="
          padding:9px 12px;font-family:'EB Garamond',serif;font-size:15px;
          border:1.5px solid var(--parchment-dark);border-radius:var(--radius);
          background:var(--cream);color:var(--ink);outline:none;cursor:pointer;
        ">
          <option value="">All Desks</option>
        </select>
        <span id="libCount" style="
          font-family:'DM Mono',monospace;font-size:12px;
          color:var(--ink-muted);letter-spacing:0.08em;white-space:nowrap;
        ">— librarians</span>
      </div>

      <!-- Table -->
      <div id="libList">
        <div class="loading-state">
          <span class="spinner"></span><span>Loading librarians…</span>
        </div>
      </div>
    </div>

    ${libModalHTML()}

    <!-- ── Detail Modal ───────────────────────────────────── -->
    <div class="modal-overlay" id="libDetailModal">
      <div class="modal-box" style="width:580px">
        <div id="libDetailBody"></div>
        <div class="modal-actions" style="margin-top:16px">
          <button class="btn-secondary" onclick="closeLibDetail()">Close</button>
        </div>
      </div>
    </div>

    <!-- ── Confirm Delete ─────────────────────────────────── -->
    <div class="modal-overlay" id="libConfirmModal">
      <div class="modal-box" style="width:440px">
        <p class="modal-title">Confirm Removal</p>
        <p class="modal-body" id="libConfirmMsg"></p>
        <div class="modal-actions">
          <button class="btn-secondary"
            onclick="document.getElementById('libConfirmModal').classList.remove('open')">
            Cancel
          </button>
          <button class="btn-danger" id="libConfirmOk">Remove</button>
        </div>
      </div>
    </div>
  `;

  ['libModal','libDetailModal','libConfirmModal'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', function(e) {
      if (e.target === this) this.classList.remove('open');
    });
  });

  try {
    const result = await api.getLibrarians();
    _allLibrarians = Array.isArray(result) ? result : [];
  } catch {
    _allLibrarians = [];
  }

  rerenderLibrarians();
};

// ─── Shared modal HTML ────────────────────────────────────────
function libModalHTML() {
  return `
    <div class="modal-overlay" id="libModal">
      <div class="modal-box" style="width:540px">
        <h2 class="modal-title" id="libModalTitle">Add Librarian</h2>
        <form id="libForm" onsubmit="return false">
          <div class="form-grid">
            <div class="form-field full">
              <label>Full Name *</label>
              <input type="text" name="name" placeholder="e.g. John Librarian"/>
            </div>
            <div class="form-field">
              <label>Email *</label>
              <input type="email" name="email" placeholder="john@library.edu"/>
            </div>
            <div class="form-field">
              <label>Phone</label>
              <input type="tel" name="phone" placeholder="+237 6XX XXX XXX"/>
            </div>
            <div class="form-field full">
              <label>Address</label>
              <input type="text" name="address" placeholder="e.g. Molyko, Buea"/>
            </div>
            <div class="form-field full">
              <label>Desk Location</label>
              <input type="text" name="deskLocation"
                placeholder="e.g. Main Desk — Ground Floor"/>
            </div>
            <div class="form-field full" id="libPwField">
              <label>Password (new accounts only)</label>
              <input type="password" name="password" placeholder="Temporary password"/>
            </div>
          </div>
          <div class="modal-actions">
            <button class="btn-secondary" type="button"
              onclick="closeLibModal()">Cancel</button>
            <button class="btn-primary" type="button" id="libSaveBtn"
              onclick="submitLibForm()">Save</button>
          </div>
        </form>
      </div>
    </div>`;
}

window.rerenderLibrarians    = rerenderLibrarians;
window.loadLibrariansModule  = window.loadLibrariansModule;
