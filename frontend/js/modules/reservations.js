// ─────────────────────────────────────────────────────────────
//  reservations.js  —  Reservations module
//  Entry point: window.loadReservationsModule(user, container)
//
//  ADMIN:     view all reservations + detail
//  LIBRARIAN: view all + confirm + cancel + manage queue
//  MEMBER:    view own reservations + cancel own
// ─────────────────────────────────────────────────────────────

// ─── State ────────────────────────────────────────────────────
let _allReservations = [];
let _resUser         = null;

// ─── Helpers ──────────────────────────────────────────────────
function escR(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

function resBadge(status) {
  const map = {
    Pending:   'badge-pending',
    Approved:  'badge-approved',
    Cancelled: 'badge-cancelled',
    Completed: 'badge-completed',
  };
  return `<span class="badge ${map[status] ?? 'badge-pending'}">${escR(status ?? '—')}</span>`;
}

function formatDateR(ds) {
  if (!ds) return '—';
  return new Date(ds).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

function isExpired(expiryDate) {
  return expiryDate && new Date(expiryDate) < new Date();
}

function expiryDisplay(expiryDate, status) {
  if (!expiryDate) return '—';
  const expired = isExpired(expiryDate) && status !== 'Completed' && status !== 'Cancelled';
  return expired
    ? `<span style="color:var(--rust);font-weight:600">⚠️ ${formatDateR(expiryDate)}</span>`
    : formatDateR(expiryDate);
}

function queueDisplay(pos) {
  if (!pos && pos !== 0) return '—';
  const colors = ['var(--rust)', 'var(--gold)', 'var(--green)', 'var(--ink-muted)'];
  const color  = colors[Math.min(pos - 1, colors.length - 1)];
  return `<span style="
    font-family:'DM Mono',monospace;font-size:13px;
    font-weight:700;color:${color}
  ">#${pos}</span>`;
}

// ─── Filter ───────────────────────────────────────────────────
function filterReservations(query, statusFilter, expiredOnly) {
  const q = query.toLowerCase();
  return _allReservations.filter(r => {
    const matchQ = !q
      || (r.memberName    ?? '').toLowerCase().includes(q)
      || (r.resourceTitle ?? '').toLowerCase().includes(q)
      || String(r.reservationId ?? '').includes(q);
    const matchS = !statusFilter || r.status === statusFilter;
    const matchE = !expiredOnly  ||
      (isExpired(r.expiryDate) && r.status !== 'Completed' && r.status !== 'Cancelled');
    return matchQ && matchS && matchE;
  });
}

// ─── Re-render ────────────────────────────────────────────────
function rerenderReservations() {
  const query   = document.getElementById('resSearch')?.value        ?? '';
  const status  = document.getElementById('resStatusFilter')?.value  ?? '';
  const expired = document.getElementById('resExpiredFilter')?.checked ?? false;
  const items   = filterReservations(query, status, expired);
  const list    = document.getElementById('resList');
  if (!list) return;
  list.innerHTML = renderResTable(items);
  document.getElementById('resCount').textContent =
    `${items.length} reservation${items.length !== 1 ? 's' : ''}`;
}

// ─── Table row ────────────────────────────────────────────────
function buildResRow(res, role) {
  const isMember  = role === 'MEMBER';
  const canEdit   = role === 'LIBRARIAN';
  const isPending = res.status === 'Pending';
  const isActive  = res.status === 'Pending' || res.status === 'Approved';

  const libActions = canEdit
    ? `<div class="td-actions">
        <button class="btn-icon" title="Details"
          onclick="openResDetail(${res.reservationId})">👁️</button>
        ${isPending
          ? `<button class="btn-icon" title="Confirm Reservation"
               onclick="confirmReservation(${res.reservationId})"
               style="color:var(--green)">✅</button>`
          : ''}
        ${isActive
          ? `<button class="btn-icon danger" title="Cancel Reservation"
               onclick="cancelReservation(${res.reservationId},'${escR(res.resourceTitle)}')">✖️</button>`
          : ''}
       </div>`
    : isMember
    ? `<div class="td-actions">
        <button class="btn-icon" title="Details"
          onclick="openResDetail(${res.reservationId})">👁️</button>
        ${isActive
          ? `<button class="btn-icon danger" title="Cancel"
               onclick="cancelReservation(${res.reservationId},'${escR(res.resourceTitle)}')">✖️</button>`
          : ''}
       </div>`
    : `<div class="td-actions">
        <button class="btn-icon" title="Details"
          onclick="openResDetail(${res.reservationId})">👁️</button>
       </div>`;

  return `
    <tr data-id="${res.reservationId}"
      style="${isExpired(res.expiryDate) && isActive
        ? 'background:rgba(139,58,26,0.04)' : ''}">
      <td><code style="font-size:12px">#${res.reservationId ?? '—'}</code></td>
      ${!isMember ? `<td>${escR(res.memberName ?? '—')}</td>` : ''}
      <td><strong>${escR(res.resourceTitle ?? '—')}</strong></td>
      <td>${formatDateR(res.requestDate)}</td>
      <td>${expiryDisplay(res.expiryDate, res.status)}</td>
      <td>${queueDisplay(res.queuePosition)}</td>
      <td>${resBadge(res.status)}</td>
      <td>${actions}</td>
    </tr>`.replace('${actions}', actions);
}

function renderResTable(items) {
  const isMember = _resUser?.role === 'MEMBER';
  if (!items.length) return `
    <div class="empty-state" style="padding:60px">
      <span class="empty-state-icon">🔖</span>
      <p class="empty-state-text">No reservations found</p>
    </div>`;
  return `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>#ID</th>
            ${!isMember ? '<th>Member</th>' : ''}
            <th>Resource</th><th>Requested</th>
            <th>Expires</th><th>Queue</th><th>Status</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(r => buildResRow(r, _resUser?.role)).join('')}
        </tbody>
      </table>
    </div>`;
}

// ─── Confirm reservation (Librarian) ──────────────────────────
window.confirmReservation = async function(resId) {
  const btn = document.querySelector(`[onclick="confirmReservation(${resId})"]`);
  if (btn) { btn.disabled = true; }

  try {
    const updated = await api.confirmReservation(resId);
    const idx = _allReservations.findIndex(r => r.reservationId === resId);
    if (idx !== -1) {
      _allReservations[idx] = {
        ..._allReservations[idx],
        ...updated,
        status: 'Approved'
      };
    }
    showToast('Reservation approved.', 'success');
    rerenderReservations();
  } catch (err) {
    showToast(err.message || 'Failed to confirm reservation.', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
};

// ─── Cancel reservation (Librarian + Member) ──────────────────
window.cancelReservation = function(resId, resourceTitle) {
  const modal = document.getElementById('resCancelModal');
  document.getElementById('resCancelMsg').textContent =
    `Cancel the reservation for "${resourceTitle}"? This cannot be undone.`;
  modal.dataset.resId = resId;
  modal.classList.add('open');
};

window.closeResCancelModal = function() {
  document.getElementById('resCancelModal').classList.remove('open');
};

window.confirmCancel = async function() {
  const modal = document.getElementById('resCancelModal');
  const resId = parseInt(modal.dataset.resId);
  const btn   = document.getElementById('resCancelBtn');
  btn.disabled = true; btn.textContent = 'Cancelling…';

  try {
    await api.cancelReservation(resId);
    const idx = _allReservations.findIndex(r => r.reservationId === resId);
    if (idx !== -1) _allReservations[idx].status = 'Cancelled';
    showToast('Reservation cancelled.', 'success');
    closeResCancelModal();
    rerenderReservations();
  } catch (err) {
    showToast(err.message || 'Failed to cancel reservation.', 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Yes, Cancel It';
  }
};

// ─── Detail modal ─────────────────────────────────────────────
window.openResDetail = function(resId) {
  const r = _allReservations.find(x => x.reservationId === resId);
  if (!r) return;

  document.getElementById('resDetailBody').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;font-size:15px">
      ${[
        ['Reservation ID', `#${r.reservationId}`],
        ['Member',         r.memberName],
        ['Resource',       r.resourceTitle],
        ['Requested',      formatDateR(r.requestDate)],
        ['Expires',        expiryDisplay(r.expiryDate, r.status)],
        ['Queue Position', queueDisplay(r.queuePosition)],
        ['Status',         resBadge(r.status)],
        ['Expired',        isExpired(r.expiryDate) && r.status !== 'Completed' && r.status !== 'Cancelled'
          ? '<span style="color:var(--rust)">Yes</span>' : 'No'],
      ].map(([label, val]) => `
        <div>
          <div style="font-family:'DM Mono',monospace;font-size:10px;
            letter-spacing:0.14em;text-transform:uppercase;
            color:var(--brown);margin-bottom:4px">${label}</div>
          <div style="color:var(--ink)">${val ?? '—'}</div>
        </div>`).join('')}
    </div>

    <!-- Queue context bar -->
    ${r.queuePosition
      ? `<div style="
          margin-top:20px;
          padding:14px 18px;
          background:var(--parchment);
          border-radius:6px;
          border-left:3px solid var(--gold);
          font-size:14px;color:var(--ink-light);
        ">
          <strong>Queue Position ${r.queuePosition}:</strong>
          ${r.queuePosition === 1
            ? ' This member is next in line — resource will be available soon.'
            : ` ${r.queuePosition - 1} member${r.queuePosition > 2 ? 's' : ''} ahead in queue.`}
        </div>`
      : ''}
  `;

  document.getElementById('resDetailModal').classList.add('open');
};

window.closeResDetail = function() {
  document.getElementById('resDetailModal').classList.remove('open');
};

// ─── Summary stats bar ────────────────────────────────────────
function buildResStats(reservations) {
  const total     = reservations.length;
  const pending   = reservations.filter(r => r.status === 'Pending').length;
  const approved  = reservations.filter(r => r.status === 'Approved').length;
  const cancelled = reservations.filter(r => r.status === 'Cancelled').length;
  const completed = reservations.filter(r => r.status === 'Completed').length;

  return `
    <div style="
      display:grid;
      grid-template-columns:repeat(auto-fill,minmax(130px,1fr));
      gap:12px;margin-bottom:24px;
    ">
      ${[
        { label: 'Total',     value: total,     icon: '🔖', color: 'var(--ink)'         },
        { label: 'Pending',   value: pending,   icon: '⏳', color: 'var(--gold)'        },
        { label: 'Approved',  value: approved,  icon: '✅', color: 'var(--green)'       },
        { label: 'Cancelled', value: cancelled, icon: '✖️', color: 'var(--rust)'        },
        { label: 'Completed', value: completed, icon: '🏁', color: 'var(--green-light)' },
      ].map(s => `
        <div style="
          background:var(--cream);
          border:1px solid var(--parchment-dark);
          border-radius:8px;padding:14px 16px;
          box-shadow:var(--shadow-sm);
          border-top:3px solid ${s.color};
        ">
          <div style="font-size:18px;margin-bottom:4px">${s.icon}</div>
          <div style="font-family:'Playfair Display',serif;font-size:24px;
            font-weight:700;color:${s.color}">${s.value}</div>
          <div style="font-family:'DM Mono',monospace;font-size:10px;
            letter-spacing:0.12em;text-transform:uppercase;
            color:var(--ink-muted)">${s.label}</div>
        </div>`).join('')}
    </div>`;
}

// ─── Main entry ───────────────────────────────────────────────
window.loadReservationsModule = async function(user, container) {
  _resUser = user;
  const role     = user.role;
  const isMember = role === 'MEMBER';

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">🔖 ${isMember ? 'My Reservations' : 'Reservations'}</h1>
        <p class="page-subtitle">
          ${isMember
            ? 'Your active and past resource holds.'
            : 'Manage all resource reservation requests and queues.'}
        </p>
      </div>
    </div>

    <div class="page-body">

      <!-- Stats -->
      <div id="resStats"></div>

      <!-- Toolbar -->
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:20px">
        <div class="search-bar" style="max-width:300px;flex:1">
          <input type="text" id="resSearch"
            placeholder="${isMember
              ? 'Search by resource…'
              : 'Search by member, resource, ID…'}"
            oninput="rerenderReservations()"/>
        </div>
        <select id="resStatusFilter" onchange="rerenderReservations()" style="
          padding:9px 12px;font-family:'EB Garamond',serif;font-size:15px;
          border:1.5px solid var(--parchment-dark);border-radius:var(--radius);
          background:var(--cream);color:var(--ink);outline:none;cursor:pointer;
        ">
          <option value="">All Statuses</option>
          <option value="Pending">Pending</option>
          <option value="Approved">Approved</option>
          <option value="Cancelled">Cancelled</option>
          <option value="Completed">Completed</option>
        </select>
        <label style="
          display:flex;align-items:center;gap:6px;
          font-family:'DM Mono',monospace;font-size:12px;
          color:var(--ink-muted);letter-spacing:0.08em;
          cursor:pointer;white-space:nowrap;
        ">
          <input type="checkbox" id="resExpiredFilter"
            onchange="rerenderReservations()"
            style="accent-color:var(--rust);width:14px;height:14px"/>
          Expired only
        </label>
        <span id="resCount" style="
          font-family:'DM Mono',monospace;font-size:12px;
          color:var(--ink-muted);letter-spacing:0.08em;white-space:nowrap;
        ">— reservations</span>
      </div>

      <!-- Table -->
      <div id="resList">
        <div class="loading-state">
          <span class="spinner"></span><span>Loading reservations…</span>
        </div>
      </div>
    </div>

    <!-- ── Cancel Confirmation Modal ──────────────────────── -->
    <div class="modal-overlay" id="resCancelModal">
      <div class="modal-box" style="width:420px">
        <p class="modal-title">Cancel Reservation</p>
        <p class="modal-body" id="resCancelMsg"></p>
        <div class="modal-actions">
          <button class="btn-secondary" onclick="closeResCancelModal()">Keep It</button>
          <button class="btn-danger" id="resCancelBtn"
            onclick="confirmCancel()">Yes, Cancel It</button>
        </div>
      </div>
    </div>

    <!-- ── Detail Modal ───────────────────────────────────── -->
    <div class="modal-overlay" id="resDetailModal">
      <div class="modal-box" style="width:540px">
        <p class="modal-title">Reservation Details</p>
        <div id="resDetailBody" style="margin-top:16px"></div>
        <div class="modal-actions">
          <button class="btn-secondary" onclick="closeResDetail()">Close</button>
        </div>
      </div>
    </div>
  `;

  // Close on overlay click
  ['resCancelModal', 'resDetailModal'].forEach(id => {
    document.getElementById(id).addEventListener('click', function(e) {
      if (e.target === this) this.classList.remove('open');
    });
  });

  // Fetch
  try {
    const result = isMember
      ? await api.getMemberReservations(user.id)
      : await api.getReservations();
    _allReservations = Array.isArray(result) ? result : [];
  } catch {
    _allReservations = [];
  }

  document.getElementById('resStats').innerHTML = buildResStats(_allReservations);
  rerenderReservations();
};

window.rerenderReservations = rerenderReservations;
