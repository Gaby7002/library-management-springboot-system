// ─────────────────────────────────────────────────────────────
//  equipment.js  —  Equipment module
//  Entry point: window.loadEquipmentModule(user, container)
//
//  ADMIN:     browse + view details
//  LIBRARIAN: full CRUD + check/update condition
//  MEMBER:    browse + borrow + reserve
// ─────────────────────────────────────────────────────────────

// ─── State ────────────────────────────────────────────────────
let _allEquipment = [];
let _equipUser    = null;

// ─── Helpers ──────────────────────────────────────────────────
function escE(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

function statusBadgeE(status) {
  const map = {
    Available: 'available', Borrowed: 'borrowed',
    Reserved:  'reserved',  Lost:     'lost',
  };
  return `<span class="badge badge-${map[status] ?? 'available'}">${escE(status)}</span>`;
}

function conditionBadge(condition) {
  const c = (condition ?? '').toLowerCase();
  let cls = 'badge';
  let style = '';
  if (c.includes('excellent') || c.includes('new')) {
    style = 'background:#d4edda;color:#155724';
  } else if (c.includes('good')) {
    style = 'background:#e8f0e8;color:#2d4a2d';
  } else if (c.includes('fair') || c.includes('used')) {
    style = 'background:#fff3cd;color:#856404';
  } else if (c.includes('poor') || c.includes('damaged')) {
    style = 'background:#fdecea;color:#8b3a1a';
  } else {
    style = 'background:var(--parchment);color:var(--ink-muted)';
  }
  return `<span class="${cls}" style="${style}">${escE(condition ?? '—')}</span>`;
}

function equipIcon(title) {
  const t = (title ?? '').toLowerCase();
  if (t.includes('laptop') || t.includes('computer')) return '💻';
  if (t.includes('projector'))                          return '📽️';
  if (t.includes('camera'))                             return '📷';
  if (t.includes('tablet') || t.includes('ipad'))       return '📱';
  if (t.includes('printer'))                            return '🖨️';
  if (t.includes('scanner'))                            return '🖹';
  if (t.includes('headphone') || t.includes('audio'))   return '🎧';
  if (t.includes('keyboard'))                           return '⌨️';
  if (t.includes('monitor') || t.includes('screen'))    return '🖥️';
  if (t.includes('cable') || t.includes('charger'))     return '🔌';
  return '🖥️';
}

// ─── Filter ───────────────────────────────────────────────────
function filterEquipment(query, statusFilter, condFilter) {
  const q = query.toLowerCase();
  return _allEquipment.filter(e => {
    const matchQ = !q
      || (e.title        ?? '').toLowerCase().includes(q)
      || (e.serialNumber ?? '').toLowerCase().includes(q)
      || (e.category     ?? '').toLowerCase().includes(q)
      || (e.condition    ?? '').toLowerCase().includes(q);
    const matchS = !statusFilter || e.status    === statusFilter;
    const matchC = !condFilter   ||
      (e.condition ?? '').toLowerCase().includes(condFilter.toLowerCase());
    return matchQ && matchS && matchC;
  });
}

// ─── Re-render ────────────────────────────────────────────────
function rerenderEquipment() {
  const query  = document.getElementById('equipSearch')?.value ?? '';
  const status = document.getElementById('equipStatusFilter')?.value ?? '';
  const cond   = document.getElementById('equipCondFilter')?.value ?? '';
  const items  = filterEquipment(query, status, cond);
  const list   = document.getElementById('equipList');
  if (!list) return;
  const role = _equipUser?.role;
  list.innerHTML = role === 'MEMBER'
    ? renderEquipGrid(items)
    : renderEquipTable(items, role);
  document.getElementById('equipCount').textContent =
    `${items.length} item${items.length !== 1 ? 's' : ''}`;
}

// ─── Table row (Admin / Librarian) ────────────────────────────
function buildEquipRow(item, role) {
  const actions = role === 'LIBRARIAN'
    ? `<div class="td-actions">
        <button class="btn-icon" title="Edit"
          onclick="openEquipModal(${item.resourceId})">✏️</button>
        <button class="btn-icon" title="Update Condition"
          onclick="openConditionModal(${item.resourceId})">🔧</button>
        <button class="btn-icon danger" title="Delete"
          onclick="deleteEquipment(${item.resourceId},'${escE(item.title)}')">🗑️</button>
       </div>`
    : `<div class="td-actions">
        <button class="btn-icon" title="Details"
          onclick="openEquipDetail(${item.resourceId})">👁️</button>
       </div>`;

  return `
    <tr data-id="${item.resourceId}">
      <td>
        <span style="font-size:18px;margin-right:6px">${equipIcon(item.title)}</span>
        <strong>${escE(item.title)}</strong>
      </td>
      <td><code style="font-size:12px">${escE(item.serialNumber ?? '—')}</code></td>
      <td>${conditionBadge(item.condition)}</td>
      <td>${escE(item.warrantyPeriod ?? '—')}</td>
      <td>${escE(item.category ?? '—')}</td>
      <td>${escE(item.location ?? '—')}</td>
      <td>${statusBadgeE(item.status)}</td>
      <td>${actions}</td>
    </tr>
  `;
}

function renderEquipTable(items, role) {
  if (!items.length) return `
    <div class="empty-state" style="padding:60px">
      <span class="empty-state-icon">🖥️</span>
      <p class="empty-state-text">No equipment found</p>
    </div>`;
  return `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Title</th><th>Serial No.</th><th>Condition</th>
            <th>Warranty</th><th>Category</th><th>Location</th>
            <th>Status</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>${items.map(i => buildEquipRow(i, role)).join('')}</tbody>
      </table>
    </div>`;
}

// ─── Member card grid ─────────────────────────────────────────
function buildEquipCard(item) {
  const available = item.status === 'Available';
  const canReserve = item.status === 'Borrowed' || item.status === 'Reserved';

  return `
    <div style="
      background:var(--cream);
      border:1px solid var(--parchment-dark);
      border-radius:8px;
      padding:20px;
      display:flex;
      flex-direction:column;
      gap:8px;
      box-shadow:var(--shadow-sm);
      transition:box-shadow 0.2s,transform 0.2s;
      animation:cardIn 0.3s ease both;
    "
    onmouseover="this.style.boxShadow='var(--shadow-md)';this.style.transform='translateY(-2px)'"
    onmouseout="this.style.boxShadow='var(--shadow-sm)';this.style.transform='none'">

      <div style="font-size:36px;text-align:center;padding:6px 0">
        ${equipIcon(item.title)}
      </div>

      <div style="
        font-family:'Playfair Display',serif;
        font-size:16px;font-weight:700;
        color:var(--ink);line-height:1.3;
      ">${escE(item.title)}</div>

      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:2px">
        ${statusBadgeE(item.status)}
        ${conditionBadge(item.condition)}
      </div>

      <div style="
        font-family:'DM Mono',monospace;
        font-size:11px;color:var(--ink-muted);
        letter-spacing:0.05em;
        display:flex;flex-direction:column;gap:2px;
      ">
        ${item.serialNumber  ? `<span>🔢 S/N: ${escE(item.serialNumber)}</span>` : ''}
        ${item.warrantyPeriod? `<span>🛡 Warranty: ${escE(item.warrantyPeriod)}</span>` : ''}
        ${item.category      ? `<span>📂 ${escE(item.category)}</span>` : ''}
        ${item.location      ? `<span>📍 ${escE(item.location)}</span>` : ''}
      </div>

      <div style="display:flex;gap:8px;margin-top:8px">
        ${available
          ? `<button class="btn-primary"
               style="flex:1;font-size:14px;padding:8px"
               onclick="borrowEquipment(${item.resourceId},'${escE(item.title)}')">
               Borrow
             </button>`
          : canReserve
          ? `<button class="btn-secondary"
               style="flex:1;font-size:14px;padding:8px"
               onclick="reserveEquipment(${item.resourceId},'${escE(item.title)}')">
               🔖 Reserve
             </button>`
          : `<button class="btn-secondary"
               style="flex:1;font-size:14px;padding:8px" disabled>
               Unavailable
             </button>`
        }
        <button class="btn-icon" title="Details"
          onclick="openEquipDetail(${item.resourceId})">👁️</button>
      </div>
    </div>
  `;
}

function renderEquipGrid(items) {
  if (!items.length) return `
    <div class="empty-state" style="padding:60px">
      <span class="empty-state-icon">🖥️</span>
      <p class="empty-state-text">No equipment found</p>
    </div>`;
  return `
    <div style="
      display:grid;
      grid-template-columns:repeat(auto-fill,minmax(230px,1fr));
      gap:20px;
    ">${items.map(buildEquipCard).join('')}</div>`;
}

// ─── Add / Edit modal ─────────────────────────────────────────
window.openEquipModal = function(itemId = null) {
  const item   = itemId ? _allEquipment.find(e => e.resourceId === itemId) : null;
  const isEdit = !!item;

  document.getElementById('equipModalTitle').textContent =
    isEdit ? 'Edit Equipment' : 'Add Equipment';

  const f = document.getElementById('equipForm');
  f.querySelector('[name=title]').value         = item?.title         ?? '';
  f.querySelector('[name=serialNumber]').value  = item?.serialNumber  ?? '';
  f.querySelector('[name=condition]').value     = item?.condition     ?? '';
  f.querySelector('[name=warrantyPeriod]').value= item?.warrantyPeriod?? '';
  f.querySelector('[name=category]').value      = item?.category      ?? '';
  f.querySelector('[name=location]').value      = item?.location      ?? '';
  f.querySelector('[name=publicationYear]').value = item?.publicationYear ?? '';
  f.querySelector('[name=status]').value        = item?.status        ?? 'Available';
  f.dataset.itemId = itemId ?? '';

  document.getElementById('equipModal').classList.add('open');
};

window.closeEquipModal = function() {
  document.getElementById('equipModal').classList.remove('open');
};

window.submitEquipForm = async function() {
  const f      = document.getElementById('equipForm');
  const itemId = f.dataset.itemId ? parseInt(f.dataset.itemId) : null;

  const payload = {
    title:           f.querySelector('[name=title]').value.trim(),
    serialNumber:    f.querySelector('[name=serialNumber]').value.trim(),
    condition:       f.querySelector('[name=condition]').value.trim(),
    warrantyPeriod:  f.querySelector('[name=warrantyPeriod]').value.trim(),
    category:        f.querySelector('[name=category]').value.trim(),
    location:        f.querySelector('[name=location]').value.trim(),
    publicationYear: parseInt(f.querySelector('[name=publicationYear]').value) || null,
    status:          f.querySelector('[name=status]').value,
  };

  if (!payload.title) { showToast('Title is required.', 'error'); return; }

  const btn = document.getElementById('equipSaveBtn');
  btn.disabled = true; btn.textContent = 'Saving…';

  try {
    if (itemId) {
      const updated = await api.updateEquipment(itemId, payload);
      const idx = _allEquipment.findIndex(e => e.resourceId === itemId);
      if (idx !== -1) _allEquipment[idx] = updated;
      showToast('Equipment updated.', 'success');
    } else {
      const created = await api.createEquipment(payload);
      _allEquipment.unshift(created);
      showToast('Equipment added.', 'success');
    }
    closeEquipModal();
    rerenderEquipment();
  } catch (err) {
    showToast(err.message || 'Failed to save equipment.', 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Save Equipment';
  }
};

// ─── Update condition modal (Librarian) ───────────────────────
window.openConditionModal = function(itemId) {
  const item = _allEquipment.find(e => e.resourceId === itemId);
  if (!item) return;
  document.getElementById('conditionModalTitle').textContent =
    `Update Condition — ${item.title}`;
  const sel = document.getElementById('conditionSelect');
  sel.value = item.condition ?? '';
  document.getElementById('conditionNotes').value = '';
  document.getElementById('conditionModal').dataset.itemId = itemId;
  document.getElementById('conditionModal').classList.add('open');
};

window.closeConditionModal = function() {
  document.getElementById('conditionModal').classList.remove('open');
};

window.submitCondition = async function() {
  const modal  = document.getElementById('conditionModal');
  const itemId = parseInt(modal.dataset.itemId);
  const condition = document.getElementById('conditionSelect').value;

  const btn = document.getElementById('conditionSaveBtn');
  btn.disabled = true; btn.textContent = 'Saving…';

  try {
    const updated = await api.updateEquipment(itemId, { condition });
    const idx = _allEquipment.findIndex(e => e.resourceId === itemId);
    if (idx !== -1) _allEquipment[idx] = { ..._allEquipment[idx], condition };
    showToast('Condition updated.', 'success');
    closeConditionModal();
    rerenderEquipment();
  } catch (err) {
    showToast(err.message || 'Failed to update condition.', 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Save';
  }
};

// ─── Delete ───────────────────────────────────────────────────
window.deleteEquipment = function(itemId, title) {
  const modal = document.getElementById('equipConfirmModal');
  document.getElementById('equipConfirmMsg').textContent =
    `Remove "${title}" from the catalogue?`;
  modal.classList.add('open');

  document.getElementById('equipConfirmOk').onclick = async () => {
    modal.classList.remove('open');
    try {
      await api.deleteEquipment(itemId);
      _allEquipment = _allEquipment.filter(e => e.resourceId !== itemId);
      showToast('Equipment removed.', 'success');
      rerenderEquipment();
    } catch (err) {
      showToast(err.message || 'Failed to delete.', 'error');
    }
  };
};

// ─── Detail modal ─────────────────────────────────────────────
window.openEquipDetail = function(itemId) {
  const e = _allEquipment.find(x => x.resourceId === itemId);
  if (!e) return;
  document.getElementById('equipDetailTitle').textContent = e.title;
  document.getElementById('equipDetailBody').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;font-size:15px">
      ${[
        ['Title',           e.title],
        ['Serial Number',   e.serialNumber],
        ['Condition',       conditionBadge(e.condition)],
        ['Warranty Period', e.warrantyPeriod],
        ['Category',        e.category],
        ['Location',        e.location],
        ['Year',            e.publicationYear],
        ['Status',          statusBadgeE(e.status)],
      ].map(([label, val]) => `
        <div>
          <div style="font-family:'DM Mono',monospace;font-size:10px;
            letter-spacing:0.12em;text-transform:uppercase;
            color:var(--brown);margin-bottom:4px">${label}</div>
          <div style="color:var(--ink)">${val ?? '—'}</div>
        </div>
      `).join('')}
    </div>`;
  document.getElementById('equipDetailModal').classList.add('open');
};

window.closeEquipDetail = function() {
  document.getElementById('equipDetailModal').classList.remove('open');
};

// ─── Member borrow / reserve ──────────────────────────────────
window.borrowEquipment = async function(itemId, title) {
  try {
    await api.createTransaction({ memberId: _equipUser.id, resourceId: itemId });
    const e = _allEquipment.find(x => x.resourceId === itemId);
    if (e) e.status = 'Borrowed';
    showToast(`"${title}" borrowed successfully!`, 'success');
    rerenderEquipment();
  } catch (err) {
    showToast(err.message || 'Borrow failed.', 'error');
  }
};

window.reserveEquipment = async function(itemId, title) {
  try {
    await api.createReservation({ memberId: _equipUser.id, resourceId: itemId });
    const e = _allEquipment.find(x => x.resourceId === itemId);
    if (e) e.status = 'Reserved';
    showToast(`"${title}" reserved.`, 'success');
    rerenderEquipment();
  } catch (err) {
    showToast(err.message || 'Reservation failed.', 'error');
  }
};

// ─── Main entry ───────────────────────────────────────────────
window.loadEquipmentModule = async function(user, container) {
  _equipUser = user;
  const role    = user.role;
  const canEdit = role === 'LIBRARIAN';

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">🖥️ Equipment</h1>
        <p class="page-subtitle">
          ${role === 'MEMBER'
            ? 'Browse available equipment to borrow or reserve.'
            : 'Manage library equipment, conditions, and warranties.'}
        </p>
      </div>
      <div class="page-actions">
        ${canEdit
          ? `<button class="btn-primary" onclick="openEquipModal()">＋ Add Equipment</button>`
          : ''}
      </div>
    </div>

    <div class="page-body">

      <!-- Toolbar -->
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:20px">
        <div class="search-bar" style="max-width:300px;flex:1">
          <input type="text" id="equipSearch"
            placeholder="Search by title, serial no., category…"
            oninput="rerenderEquipment()"/>
        </div>
        <select id="equipStatusFilter" onchange="rerenderEquipment()" style="
          padding:9px 12px;font-family:'EB Garamond',serif;font-size:15px;
          border:1.5px solid var(--parchment-dark);border-radius:var(--radius);
          background:var(--cream);color:var(--ink);outline:none;cursor:pointer;
        ">
          <option value="">All Statuses</option>
          <option value="Available">Available</option>
          <option value="Borrowed">Borrowed</option>
          <option value="Reserved">Reserved</option>
          <option value="Lost">Lost</option>
        </select>
        <select id="equipCondFilter" onchange="rerenderEquipment()" style="
          padding:9px 12px;font-family:'EB Garamond',serif;font-size:15px;
          border:1.5px solid var(--parchment-dark);border-radius:var(--radius);
          background:var(--cream);color:var(--ink);outline:none;cursor:pointer;
        ">
          <option value="">All Conditions</option>
          <option value="Excellent">Excellent</option>
          <option value="Good">Good</option>
          <option value="Fair">Fair</option>
          <option value="Poor">Poor</option>
          <option value="Damaged">Damaged</option>
        </select>
        <span id="equipCount" style="
          font-family:'DM Mono',monospace;font-size:12px;
          color:var(--ink-muted);letter-spacing:0.08em;white-space:nowrap;
        ">— items</span>
      </div>

      <!-- Equipment list -->
      <div id="equipList">
        <div class="loading-state">
          <span class="spinner"></span><span>Loading equipment…</span>
        </div>
      </div>
    </div>

    <!-- ── Add / Edit Modal ───────────────────────────────── -->
    <div class="modal-overlay" id="equipModal">
      <div class="modal-box" style="width:560px">
        <h2 class="modal-title" id="equipModalTitle">Add Equipment</h2>
        <form id="equipForm" onsubmit="return false">
          <div class="form-grid">
            <div class="form-field full">
              <label>Title *</label>
              <input type="text" name="title" placeholder="e.g. Dell Laptop — i7 16GB"/>
            </div>
            <div class="form-field">
              <label>Serial Number</label>
              <input type="text" name="serialNumber" placeholder="e.g. SN-2024-00142"/>
            </div>
            <div class="form-field">
              <label>Condition</label>
              <input type="text" name="condition" placeholder="e.g. Excellent, Good, Fair"/>
            </div>
            <div class="form-field">
              <label>Warranty Period</label>
              <input type="text" name="warrantyPeriod" placeholder="e.g. 2 Years (until Dec 2026)"/>
            </div>
            <div class="form-field">
              <label>Category</label>
              <input type="text" name="category" placeholder="e.g. Laptop, Projector"/>
            </div>
            <div class="form-field">
              <label>Location / Room</label>
              <input type="text" name="location" placeholder="e.g. IT Storage Room B"/>
            </div>
            <div class="form-field">
              <label>Year Acquired</label>
              <input type="number" name="publicationYear"
                placeholder="2023" min="2000" max="2099"/>
            </div>
            <div class="form-field">
              <label>Status</label>
              <select name="status">
                <option value="Available">Available</option>
                <option value="Borrowed">Borrowed</option>
                <option value="Reserved">Reserved</option>
                <option value="Lost">Lost</option>
              </select>
            </div>
          </div>
          <div class="modal-actions">
            <button class="btn-secondary" type="button"
              onclick="closeEquipModal()">Cancel</button>
            <button class="btn-primary" type="button" id="equipSaveBtn"
              onclick="submitEquipForm()">Save Equipment</button>
          </div>
        </form>
      </div>
    </div>

    <!-- ── Condition Modal (Librarian) ───────────────────── -->
    <div class="modal-overlay" id="conditionModal">
      <div class="modal-box" style="width:420px">
        <h2 class="modal-title" id="conditionModalTitle">Update Condition</h2>
        <div class="form-grid" style="margin-top:16px">
          <div class="form-field full">
            <label>New Condition</label>
            <select id="conditionSelect">
              <option value="Excellent">Excellent</option>
              <option value="Good">Good</option>
              <option value="Fair">Fair</option>
              <option value="Poor">Poor</option>
              <option value="Damaged">Damaged</option>
            </select>
          </div>
          <div class="form-field full">
            <label>Notes (optional)</label>
            <textarea id="conditionNotes"
              placeholder="Describe any damage or issues…"></textarea>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn-secondary" onclick="closeConditionModal()">Cancel</button>
          <button class="btn-primary" id="conditionSaveBtn"
            onclick="submitCondition()">Save</button>
        </div>
      </div>
    </div>

    <!-- ── Detail Modal ───────────────────────────────────── -->
    <div class="modal-overlay" id="equipDetailModal">
      <div class="modal-box" style="width:500px">
        <h2 class="modal-title" id="equipDetailTitle"></h2>
        <div id="equipDetailBody" style="margin-top:16px"></div>
        <div class="modal-actions">
          <button class="btn-secondary" onclick="closeEquipDetail()">Close</button>
        </div>
      </div>
    </div>

    <!-- ── Confirm Delete Modal ───────────────────────────── -->
    <div class="modal-overlay" id="equipConfirmModal">
      <div class="modal-box" style="width:420px">
        <p class="modal-title">Confirm Removal</p>
        <p class="modal-body" id="equipConfirmMsg"></p>
        <div class="modal-actions">
          <button class="btn-secondary"
            onclick="document.getElementById('equipConfirmModal').classList.remove('open')">
            Cancel
          </button>
          <button class="btn-danger" id="equipConfirmOk">Remove</button>
        </div>
      </div>
    </div>
  `;

  // Close modals on overlay click
  ['equipModal','conditionModal','equipDetailModal','equipConfirmModal'].forEach(id => {
    document.getElementById(id).addEventListener('click', function(e) {
      if (e.target === this) this.classList.remove('open');
    });
  });

  // Fetch
  try {
    const result = await api.getEquipment();
    _allEquipment = Array.isArray(result) ? result : [];
  } catch {
    _allEquipment = [];
  }

  rerenderEquipment();
};

window.rerenderEquipment = rerenderEquipment;
