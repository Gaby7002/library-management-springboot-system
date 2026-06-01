// ─────────────────────────────────────────────────────────────
//  fines.js  —  Fines module
//  Entry point: window.loadFinesModule(user, container)
//
//  ADMIN:     view all fines + detail
//  LIBRARIAN: view all + mark as paid + calculate penalty
//  MEMBER:    view own fines + pay
// ─────────────────────────────────────────────────────────────

// ─── State ────────────────────────────────────────────────────
let _allFines = [];
let _finesUser = null;

// ─── Helpers ──────────────────────────────────────────────────
function escF(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

function paidBadge(isPaid) {
  return isPaid
    ? `<span class="badge badge-paid">Paid</span>`
    : `<span class="badge badge-unpaid">Unpaid</span>`;
}

function formatDateF(ds) {
  if (!ds) return '—';
  return new Date(ds).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

function amountDisplay(amount) {
  return `<span style="
    font-family:'DM Mono',monospace;
    font-size:13px;
    font-weight:600;
    color:var(--rust);
  ">$${Number(amount ?? 0).toFixed(2)}</span>`;
}

// ─── Filter ───────────────────────────────────────────────────
function filterFines(query, paidFilter) {
  const q = query.toLowerCase();
  return _allFines.filter(f => {
    const matchQ = !q
      || (f.memberName    ?? '').toLowerCase().includes(q)
      || (f.resourceTitle ?? '').toLowerCase().includes(q)
      || String(f.fineId  ?? '').includes(q);
    const matchP = paidFilter === ''      ? true
                 : paidFilter === 'paid'  ? f.isPaid
                 : paidFilter === 'unpaid'? !f.isPaid
                 : true;
    return matchQ && matchP;
  });
}

// ─── Re-render ────────────────────────────────────────────────
function rerenderFines() {
  const query = document.getElementById('fineSearch')?.value      ?? '';
  const paid  = document.getElementById('finePaidFilter')?.value  ?? '';
  const items = filterFines(query, paid);
  const list  = document.getElementById('fineList');
  if (!list) return;
  list.innerHTML = renderFineTable(items);
  document.getElementById('fineCount').textContent =
    `${items.length} fine${items.length !== 1 ? 's' : ''}`;
}

// ─── Table row ────────────────────────────────────────────────
function buildFineRow(fine, role) {
  const isMember  = role === 'MEMBER';
  const canEdit   = role === 'LIBRARIAN';

  const libActions = `
    <div class="td-actions">
      <button class="btn-icon" title="Details"
        onclick="openFineDetail(${fine.fineId})">👁️</button>
      ${!fine.isPaid
        ? `<button class="btn-icon" title="Mark as Paid"
             onclick="markFineAsPaid(${fine.fineId})"
             style="color:var(--green)">✅</button>
           <button class="btn-icon" title="Recalculate Penalty"
             onclick="recalcPenalty(${fine.fineId})">🔄</button>`
        : ''}
    </div>`;

  const memberActions = `
    <div class="td-actions">
      <button class="btn-icon" title="Details"
        onclick="openFineDetail(${fine.fineId})">👁️</button>
      ${!fine.isPaid
        ? `<button class="btn-primary" style="font-size:13px;padding:6px 12px"
             onclick="payFine(${fine.fineId},'${escF(fine.resourceTitle)}')">
             Pay Now
           </button>`
        : ''}
    </div>`;

  const adminActions = `
    <div class="td-actions">
      <button class="btn-icon" title="Details"
        onclick="openFineDetail(${fine.fineId})">👁️</button>
    </div>`;

  const actions = canEdit ? libActions : isMember ? memberActions : adminActions;

  return `
    <tr data-id="${fine.fineId}"
      style="${!fine.isPaid ? 'background:rgba(139,58,26,0.03)' : ''}">
      <td><code style="font-size:12px">#${fine.fineId ?? '—'}</code></td>
      ${!isMember ? `<td>${escF(fine.memberName ?? '—')}</td>` : ''}
      <td>${escF(fine.resourceTitle ?? '—')}</td>
      <td>${amountDisplay(fine.amount)}</td>
      <td>${formatDateF(fine.issueDate)}</td>
      <td>${paidBadge(fine.isPaid)}</td>
      <td>${actions}</td>
    </tr>`;
}

function renderFineTable(items) {
  const isMember = _finesUser?.role === 'MEMBER';
  if (!items.length) return `
    <div class="empty-state" style="padding:60px">
      <span class="empty-state-icon">💰</span>
      <p class="empty-state-text">No fines found</p>
    </div>`;
  return `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>#ID</th>
            ${!isMember ? '<th>Member</th>' : ''}
            <th>Resource</th><th>Amount</th>
            <th>Issued</th><th>Status</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(f => buildFineRow(f, _finesUser?.role)).join('')}
        </tbody>
      </table>
    </div>`;
}

// ─── Mark as paid (Librarian) ─────────────────────────────────
window.markFineAsPaid = function(fineId) {
  const modal = document.getElementById('finePayModal');
  const fine  = _allFines.find(f => f.fineId === fineId);
  document.getElementById('finePayMsg').innerHTML = `
    Confirm payment received for fine <strong>#${fineId}</strong>?
    <div style="
      margin-top:12px;text-align:center;
      font-family:'Playfair Display',serif;
      font-size:28px;font-weight:700;color:var(--rust);
    ">
      ${amountDisplay(fine?.amount)}
    </div>`;
  modal.dataset.fineId = fineId;
  modal.classList.add('open');
};

window.closeFinePayModal = function() {
  document.getElementById('finePayModal').classList.remove('open');
};

window.confirmFinePaid = async function() {
  const modal  = document.getElementById('finePayModal');
  const fineId = parseInt(modal.dataset.fineId);
  const btn    = document.getElementById('finePayBtn');
  btn.disabled = true; btn.textContent = 'Saving…';

  try {
    await api.markFinePaid(fineId);
    const idx = _allFines.findIndex(f => f.fineId === fineId);
    if (idx !== -1) _allFines[idx].isPaid = true;
    showToast('Fine marked as paid.', 'success');
    closeFinePayModal();
    rerenderFines();
    // Refresh totals
    buildFinesSummary(_allFines);
  } catch (err) {
    showToast(err.message || 'Failed to update fine.', 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Confirm Payment';
  }
};

// ─── Recalculate penalty (Librarian) ──────────────────────────
window.recalcPenalty = async function(fineId) {
  const btn = document.querySelector(`[onclick="recalcPenalty(${fineId})"]`);
  if (btn) { btn.disabled = true; }

  try {
    const result = await api.calculatePenalty(fineId);
    const amount = result?.amount ?? result?.penalty ?? 0;
    const idx    = _allFines.findIndex(f => f.fineId === fineId);
    if (idx !== -1) _allFines[idx].amount = amount;

    document.getElementById('penaltyResult').innerHTML = `
      <div style="text-align:center;padding:8px 0">
        <div style="font-size:36px;margin-bottom:8px">🔄</div>
        <div style="font-family:'DM Mono',monospace;font-size:11px;
          color:var(--ink-muted);letter-spacing:0.1em;margin-bottom:6px">
          RECALCULATED PENALTY — Fine #${fineId}
        </div>
        <div style="font-family:'Playfair Display',serif;font-size:36px;
          font-weight:700;color:var(--rust)">
          $${Number(amount).toFixed(2)}
        </div>
      </div>`;
    document.getElementById('penaltyModal').classList.add('open');
    rerenderFines();
  } catch (err) {
    showToast(err.message || 'Failed to recalculate penalty.', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
};

window.closePenaltyModal = function() {
  document.getElementById('penaltyModal').classList.remove('open');
};

// ─── Pay fine (Member) ────────────────────────────────────────
window.payFine = function(fineId, resourceTitle) {
  const fine  = _allFines.find(f => f.fineId === fineId);
  const modal = document.getElementById('finePayModal');
  document.getElementById('finePayMsg').innerHTML = `
    Pay fine for <strong>${escF(resourceTitle)}</strong>?
    <div style="
      margin-top:12px;text-align:center;
      font-family:'Playfair Display',serif;
      font-size:28px;font-weight:700;color:var(--rust);
    ">
      ${amountDisplay(fine?.amount)}
    </div>
    <p style="font-size:13px;color:var(--ink-muted);
      text-align:center;margin-top:8px;font-style:italic;">
      Payment will be processed at the front desk or via your institution's payment portal.
    </p>`;
  modal.dataset.fineId = fineId;
  document.getElementById('finePayBtn').textContent = 'Mark as Paid';
  modal.classList.add('open');
};

// ─── Detail modal ─────────────────────────────────────────────
window.openFineDetail = function(fineId) {
  const f = _allFines.find(x => x.fineId === fineId);
  if (!f) return;

  document.getElementById('fineDetailBody').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;font-size:15px">
      ${[
        ['Fine ID',     `#${f.fineId}`],
        ['Member',      f.memberName],
        ['Resource',    f.resourceTitle],
        ['Amount',      amountDisplay(f.amount)],
        ['Issued',      formatDateF(f.issueDate)],
        ['Status',      paidBadge(f.isPaid)],
      ].map(([label, val]) => `
        <div>
          <div style="font-family:'DM Mono',monospace;font-size:10px;
            letter-spacing:0.14em;text-transform:uppercase;
            color:var(--brown);margin-bottom:4px">${label}</div>
          <div style="color:var(--ink)">${val ?? '—'}</div>
        </div>`).join('')}
    </div>

    ${!f.isPaid ? `
      <div style="
        margin-top:20px;padding:14px 18px;
        background:rgba(139,58,26,0.06);
        border-radius:6px;border-left:3px solid var(--rust);
        font-size:14px;color:var(--rust);
      ">
        ⚠️ This fine is unpaid. Please settle the amount at the library front desk
        or through your institution's payment system.
      </div>` : `
      <div style="
        margin-top:20px;padding:14px 18px;
        background:rgba(45,74,45,0.06);
        border-radius:6px;border-left:3px solid var(--green);
        font-size:14px;color:var(--green);
      ">
        ✅ This fine has been paid. No further action required.
      </div>`}
  `;

  document.getElementById('fineDetailModal').classList.add('open');
};

window.closeFineDetail = function() {
  document.getElementById('fineDetailModal').classList.remove('open');
};

// ─── Summary stats ────────────────────────────────────────────
function buildFinesSummary(fines) {
  const total      = fines.length;
  const unpaid     = fines.filter(f => !f.isPaid).length;
  const paid       = fines.filter(f =>  f.isPaid).length;
  const totalAmt   = fines.reduce((s, f) => s + Number(f.amount ?? 0), 0);
  const unpaidAmt  = fines.filter(f => !f.isPaid)
                         .reduce((s, f) => s + Number(f.amount ?? 0), 0);

  const el = document.getElementById('fineSummary');
  if (!el) return;

  el.innerHTML = `
    <div style="
      display:grid;
      grid-template-columns:repeat(auto-fill,minmax(150px,1fr));
      gap:12px;margin-bottom:24px;
    ">
      ${[
        { label: 'Total Fines',   value: total,                                    icon: '💰', color: 'var(--ink)'   },
        { label: 'Unpaid',        value: unpaid,                                   icon: '⚠️', color: 'var(--rust)'  },
        { label: 'Paid',          value: paid,                                     icon: '✅', color: 'var(--green)' },
        { label: 'Total Amount',  value: `$${totalAmt.toFixed(2)}`,                icon: '📊', color: 'var(--brown)' },
        { label: 'Unpaid Amount', value: `$${unpaidAmt.toFixed(2)}`,               icon: '🔴', color: 'var(--rust)'  },
      ].map(s => `
        <div style="
          background:var(--cream);
          border:1px solid var(--parchment-dark);
          border-radius:8px;padding:14px 16px;
          box-shadow:var(--shadow-sm);
          border-top:3px solid ${s.color};
        ">
          <div style="font-size:18px;margin-bottom:4px">${s.icon}</div>
          <div style="font-family:'Playfair Display',serif;font-size:22px;
            font-weight:700;color:${s.color}">${s.value}</div>
          <div style="font-family:'DM Mono',monospace;font-size:10px;
            letter-spacing:0.12em;text-transform:uppercase;
            color:var(--ink-muted)">${s.label}</div>
        </div>`).join('')}
    </div>`;
}

// ─── Main entry ───────────────────────────────────────────────
window.loadFinesModule = async function(user, container) {
  _finesUser = user;
  const role     = user.role;
  const isMember = role === 'MEMBER';
  const canEdit  = role === 'LIBRARIAN';

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">💰 ${isMember ? 'My Fines' : 'Fines'}</h1>
        <p class="page-subtitle">
          ${isMember
            ? 'Your outstanding and settled fines.'
            : 'Track, manage, and process all library fines.'}
        </p>
      </div>
    </div>

    <div class="page-body">

      <!-- Summary stats -->
      <div id="fineSummary"></div>

      <!-- Toolbar -->
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:20px">
        <div class="search-bar" style="max-width:300px;flex:1">
          <input type="text" id="fineSearch"
            placeholder="${isMember
              ? 'Search by resource…'
              : 'Search by member, resource, ID…'}"
            oninput="rerenderFines()"/>
        </div>
        <select id="finePaidFilter" onchange="rerenderFines()" style="
          padding:9px 12px;font-family:'EB Garamond',serif;font-size:15px;
          border:1.5px solid var(--parchment-dark);border-radius:var(--radius);
          background:var(--cream);color:var(--ink);outline:none;cursor:pointer;
        ">
          <option value="">All</option>
          <option value="unpaid">Unpaid Only</option>
          <option value="paid">Paid Only</option>
        </select>
        <span id="fineCount" style="
          font-family:'DM Mono',monospace;font-size:12px;
          color:var(--ink-muted);letter-spacing:0.08em;white-space:nowrap;
        ">— fines</span>
      </div>

      <!-- Table -->
      <div id="fineList">
        <div class="loading-state">
          <span class="spinner"></span><span>Loading fines…</span>
        </div>
      </div>
    </div>

    <!-- ── Pay / Mark Paid Modal ──────────────────────────── -->
    <div class="modal-overlay" id="finePayModal">
      <div class="modal-box" style="width:420px">
        <p class="modal-title">
          ${canEdit ? 'Confirm Payment Received' : 'Pay Fine'}
        </p>
        <div class="modal-body" id="finePayMsg"></div>
        <div class="modal-actions">
          <button class="btn-secondary" onclick="closeFinePayModal()">Cancel</button>
          <button class="btn-primary" id="finePayBtn"
            onclick="confirmFinePaid()">Confirm Payment</button>
        </div>
      </div>
    </div>

    <!-- ── Recalculate Penalty Modal (Librarian) ──────────── -->
    <div class="modal-overlay" id="penaltyModal">
      <div class="modal-box" style="width:360px">
        <p class="modal-title">Penalty Recalculated</p>
        <div id="penaltyResult" style="margin:20px 0"></div>
        <div class="modal-actions">
          <button class="btn-secondary" onclick="closePenaltyModal()">Close</button>
        </div>
      </div>
    </div>

    <!-- ── Detail Modal ───────────────────────────────────── -->
    <div class="modal-overlay" id="fineDetailModal">
      <div class="modal-box" style="width:520px">
        <p class="modal-title">Fine Details</p>
        <div id="fineDetailBody" style="margin-top:16px"></div>
        <div class="modal-actions">
          <button class="btn-secondary" onclick="closeFineDetail()">Close</button>
        </div>
      </div>
    </div>
  `;

  // Close on overlay click
  ['finePayModal', 'penaltyModal', 'fineDetailModal'].forEach(id => {
    document.getElementById(id).addEventListener('click', function(e) {
      if (e.target === this) this.classList.remove('open');
    });
  });

  // Fetch
  try {
    const result = isMember
      ? await api.getMemberFines(user.id)
      : await api.getFines();
    _allFines = Array.isArray(result) ? result : [];
  } catch {
    _allFines = [];
  }

  buildFinesSummary(_allFines);
  rerenderFines();
};

window.rerenderFines = rerenderFines;
