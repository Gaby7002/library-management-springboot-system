// ─────────────────────────────────────────────────────────────
//  transactions.js  —  Transactions module
//  Entry point: window.loadTransactionsModule(user, container)
//
//  ADMIN:     view all transactions + detail
//  LIBRARIAN: view all + complete transaction + calculate fine
//  MEMBER:    view own borrow history only
// ─────────────────────────────────────────────────────────────

// ─── State ────────────────────────────────────────────────────
let _allTransactions = [];
let _txUser          = null;

// ─── Helpers ──────────────────────────────────────────────────
function escT(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

function txStatusBadge(status) {
  const s = (status ?? '').toLowerCase();
  let cls = 'badge-pending';
  if (s === 'completed' || s === 'returned') cls = 'badge-completed';
  else if (s === 'active' || s === 'borrowed') cls = 'badge-borrowed';
  else if (s === 'overdue') cls = 'badge-lost';
  return `<span class="badge ${cls}">${escT(status ?? '—')}</span>`;
}

function formatDateT(ds) {
  if (!ds) return '—';
  return new Date(ds).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

function isOverdue(dueDate, returnDate) {
  if (returnDate) return false;
  return dueDate && new Date(dueDate) < new Date();
}

function dueDateDisplay(dueDate, returnDate) {
  if (!dueDate) return '—';
  const overdue = isOverdue(dueDate, returnDate);
  const formatted = formatDateT(dueDate);
  return overdue
    ? `<span style="color:var(--rust);font-weight:600">⏰ ${formatted}</span>`
    : formatted;
}

function daysDiff(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2 ?? new Date());
  return Math.max(0, Math.ceil((d2 - d1) / 86400000));
}

// ─── Filter ───────────────────────────────────────────────────
function filterTransactions(query, statusFilter, overdueOnly) {
  const q = query.toLowerCase();
  return _allTransactions.filter(t => {
    const matchQ = !q
      || (t.memberName    ?? '').toLowerCase().includes(q)
      || (t.resourceTitle ?? '').toLowerCase().includes(q)
      || String(t.transactionId ?? '').includes(q);
    const matchS = !statusFilter || t.transactionStatus === statusFilter;
    const matchO = !overdueOnly  || isOverdue(t.dueDate, t.returnDate);
    return matchQ && matchS && matchO;
  });
}

// ─── Re-render ────────────────────────────────────────────────
function rerenderTransactions() {
  const query    = document.getElementById('txSearch')?.value         ?? '';
  const status   = document.getElementById('txStatusFilter')?.value   ?? '';
  const overdue  = document.getElementById('txOverdueFilter')?.checked ?? false;
  const items    = filterTransactions(query, status, overdue);
  const list     = document.getElementById('txList');
  if (!list) return;
  list.innerHTML = renderTxTable(items);
  document.getElementById('txCount').textContent =
    `${items.length} transaction${items.length !== 1 ? 's' : ''}`;
}

// ─── Table row ────────────────────────────────────────────────
function buildTxRow(tx, role) {
  const overdue   = isOverdue(tx.dueDate, tx.returnDate);
  const canEdit   = role === 'LIBRARIAN';
  const isMember  = role === 'MEMBER';
  const isActive  = !tx.returnDate && tx.transactionStatus !== 'Completed';

  const actions = isMember
    ? `<div class="td-actions">
        <button class="btn-icon" title="Details"
          onclick="openTxDetail(${tx.transactionId})">👁️</button>
       </div>`
    : canEdit
    ? `<div class="td-actions">
        <button class="btn-icon" title="Details"
          onclick="openTxDetail(${tx.transactionId})">👁️</button>
        ${isActive
          ? `<button class="btn-icon" title="Complete / Return"
               onclick="completeTransaction(${tx.transactionId})">✅</button>
             <button class="btn-icon" title="Calculate Fine"
               onclick="calcFine(${tx.transactionId})">💰</button>`
          : ''}
       </div>`
    : `<div class="td-actions">
        <button class="btn-icon" title="Details"
          onclick="openTxDetail(${tx.transactionId})">👁️</button>
       </div>`;

  return `
    <tr data-id="${tx.transactionId}"
      style="${overdue ? 'background:rgba(139,58,26,0.04)' : ''}">
      <td><code style="font-size:12px">#${tx.transactionId ?? '—'}</code></td>
      ${!isMember ? `<td>${escT(tx.memberName ?? '—')}</td>` : ''}
      <td><strong>${escT(tx.resourceTitle ?? '—')}</strong></td>
      <td>${formatDateT(tx.borrowDate)}</td>
      <td>${dueDateDisplay(tx.dueDate, tx.returnDate)}</td>
      <td>${tx.returnDate ? formatDateT(tx.returnDate) : '<em style="color:var(--ink-muted)">Pending</em>'}</td>
      <td>${txStatusBadge(overdue && isActive ? 'Overdue' : tx.transactionStatus)}</td>
      <td>${tx.fine
        ? `<span style="font-family:'DM Mono',monospace;font-size:12px;color:var(--rust)">
             $${Number(tx.fine.amount ?? 0).toFixed(2)}
           </span>`
        : '<span style="color:var(--ink-muted);font-size:13px">—</span>'}</td>
      <td>${actions}</td>
    </tr>`;
}

function renderTxTable(items) {
  const isMember = _txUser?.role === 'MEMBER';
  if (!items.length) return `
    <div class="empty-state" style="padding:60px">
      <span class="empty-state-icon">📋</span>
      <p class="empty-state-text">No transactions found</p>
    </div>`;
  return `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>#ID</th>
            ${!isMember ? '<th>Member</th>' : ''}
            <th>Resource</th><th>Borrowed</th><th>Due</th>
            <th>Returned</th><th>Status</th><th>Fine</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(tx => buildTxRow(tx, _txUser?.role)).join('')}
        </tbody>
      </table>
    </div>`;
}

// ─── Complete transaction (Librarian) ─────────────────────────
window.completeTransaction = async function(txId) {
  const modal = document.getElementById('txCompleteModal');
  document.getElementById('txCompleteId').textContent = `#${txId}`;
  modal.dataset.txId = txId;
  modal.classList.add('open');
};

window.closeTxCompleteModal = function() {
  document.getElementById('txCompleteModal').classList.remove('open');
};

window.confirmComplete = async function() {
  const modal = document.getElementById('txCompleteModal');
  const txId  = parseInt(modal.dataset.txId);
  const btn   = document.getElementById('txCompleteBtn');
  btn.disabled = true; btn.textContent = 'Processing…';

  try {
    const updated = await api.completeTransaction(txId);
    const idx = _allTransactions.findIndex(t => t.transactionId === txId);
    if (idx !== -1) {
      _allTransactions[idx] = { ..._allTransactions[idx], ...updated,
        transactionStatus: 'Completed',
        returnDate: updated?.returnDate ?? new Date().toISOString()
      };
    }
    showToast('Transaction completed — resource returned.', 'success');
    closeTxCompleteModal();
    rerenderTransactions();
  } catch (err) {
    showToast(err.message || 'Failed to complete transaction.', 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Confirm Return';
  }
};

// ─── Calculate fine (Librarian) ───────────────────────────────
window.calcFine = async function(txId) {
  const btn = document.querySelector(`[onclick="calcFine(${txId})"]`);
  if (btn) { btn.disabled = true; btn.textContent = '…'; }

  try {
    const result = await api.calculateFine(txId);
    const amount = result?.amount ?? result?.fine ?? 0;

    const tx = _allTransactions.find(t => t.transactionId === txId);
    const title = tx?.resourceTitle ?? `Transaction #${txId}`;

    document.getElementById('fineCalcResult').innerHTML = `
      <div style="text-align:center;padding:8px 0">
        <div style="font-size:36px;margin-bottom:8px">💰</div>
        <div style="font-family:'Playfair Display',serif;font-size:15px;
          color:var(--ink-muted);margin-bottom:4px">${escT(title)}</div>
        <div style="font-family:'Playfair Display',serif;font-size:32px;
          font-weight:700;color:var(--rust)">
          $${Number(amount).toFixed(2)}
        </div>
        <div style="font-family:'DM Mono',monospace;font-size:11px;
          color:var(--ink-muted);letter-spacing:0.1em;margin-top:6px">
          CALCULATED FINE
        </div>
      </div>`;
    document.getElementById('fineCalcModal').classList.add('open');
  } catch (err) {
    showToast(err.message || 'Failed to calculate fine.', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '💰'; }
  }
};

window.closeFineCalcModal = function() {
  document.getElementById('fineCalcModal').classList.remove('open');
};

// ─── Detail modal ─────────────────────────────────────────────
window.openTxDetail = function(txId) {
  const tx = _allTransactions.find(t => t.transactionId === txId);
  if (!tx) return;
  const overdue = isOverdue(tx.dueDate, tx.returnDate);

  document.getElementById('txDetailBody').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;font-size:15px">
      ${[
        ['Transaction ID',  `#${tx.transactionId}`],
        ['Member',          tx.memberName],
        ['Resource',        tx.resourceTitle],
        ['Borrow Date',     formatDateT(tx.borrowDate)],
        ['Due Date',        dueDateDisplay(tx.dueDate, tx.returnDate)],
        ['Return Date',     tx.returnDate ? formatDateT(tx.returnDate) : '<em>Not returned</em>'],
        ['Status',          txStatusBadge(overdue && !tx.returnDate ? 'Overdue' : tx.transactionStatus)],
        ['Days Overdue',    overdue && !tx.returnDate
          ? `<span style="color:var(--rust);font-weight:600">
               ${daysDiff(tx.dueDate)} day${daysDiff(tx.dueDate) !== 1 ? 's' : ''}
             </span>`
          : '—'],
        ['Fine Amount',     tx.fine
          ? `<span style="font-family:'DM Mono',monospace;color:var(--rust)">
               $${Number(tx.fine.amount ?? 0).toFixed(2)}
             </span>`
          : '—'],
        ['Fine Paid',       tx.fine
          ? `<span class="badge ${tx.fine.isPaid ? 'badge-paid' : 'badge-unpaid'}">
               ${tx.fine.isPaid ? 'Paid' : 'Unpaid'}
             </span>`
          : '—'],
      ].map(([label, val]) => `
        <div>
          <div style="font-family:'DM Mono',monospace;font-size:10px;
            letter-spacing:0.14em;text-transform:uppercase;
            color:var(--brown);margin-bottom:4px">${label}</div>
          <div style="color:var(--ink)">${val ?? '—'}</div>
        </div>`).join('')}
    </div>`;

  document.getElementById('txDetailModal').classList.add('open');
};

window.closeTxDetail = function() {
  document.getElementById('txDetailModal').classList.remove('open');
};

// ─── Summary stats bar ────────────────────────────────────────
function buildTxStats(transactions) {
  const total    = transactions.length;
  const active   = transactions.filter(t => !t.returnDate && t.transactionStatus !== 'Completed').length;
  const overdue  = transactions.filter(t => isOverdue(t.dueDate, t.returnDate)).length;
  const completed= transactions.filter(t => t.transactionStatus === 'Completed' || t.returnDate).length;

  return `
    <div style="
      display:grid;
      grid-template-columns:repeat(auto-fill,minmax(140px,1fr));
      gap:12px;margin-bottom:24px;
    ">
      ${[
        { label: 'Total',     value: total,     icon: '📋', color: 'var(--ink)'          },
        { label: 'Active',    value: active,    icon: '📖', color: 'var(--green)'        },
        { label: 'Overdue',   value: overdue,   icon: '⏰', color: 'var(--rust)'         },
        { label: 'Completed', value: completed, icon: '✅', color: 'var(--green-light)'  },
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
window.loadTransactionsModule = async function(user, container) {
  _txUser = user;
  const role     = user.role;
  const isMember = role === 'MEMBER';
  const canEdit  = role === 'LIBRARIAN';

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">📋 ${isMember ? 'My Borrowings' : 'Transactions'}</h1>
        <p class="page-subtitle">
          ${isMember
            ? 'Your full borrowing history.'
            : 'All resource borrow and return transactions.'}
        </p>
      </div>
    </div>

    <div class="page-body">

      <!-- Stats bar -->
      <div id="txStats"></div>

      <!-- Toolbar -->
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:20px">
        <div class="search-bar" style="max-width:300px;flex:1">
          <input type="text" id="txSearch"
            placeholder="${isMember ? 'Search by resource…' : 'Search by member, resource, ID…'}"
            oninput="rerenderTransactions()"/>
        </div>
        <select id="txStatusFilter" onchange="rerenderTransactions()" style="
          padding:9px 12px;font-family:'EB Garamond',serif;font-size:15px;
          border:1.5px solid var(--parchment-dark);border-radius:var(--radius);
          background:var(--cream);color:var(--ink);outline:none;cursor:pointer;
        ">
          <option value="">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Completed">Completed</option>
          <option value="Overdue">Overdue</option>
        </select>
        <label style="
          display:flex;align-items:center;gap:6px;
          font-family:'DM Mono',monospace;font-size:12px;
          color:var(--ink-muted);letter-spacing:0.08em;
          cursor:pointer;white-space:nowrap;
        ">
          <input type="checkbox" id="txOverdueFilter"
            onchange="rerenderTransactions()"
            style="accent-color:var(--rust);width:14px;height:14px"/>
          Overdue only
        </label>
        <span id="txCount" style="
          font-family:'DM Mono',monospace;font-size:12px;
          color:var(--ink-muted);letter-spacing:0.08em;white-space:nowrap;
        ">— transactions</span>
      </div>

      <!-- Table -->
      <div id="txList">
        <div class="loading-state">
          <span class="spinner"></span><span>Loading transactions…</span>
        </div>
      </div>
    </div>

    <!-- ── Complete Transaction Modal (Librarian) ─────────── -->
    <div class="modal-overlay" id="txCompleteModal">
      <div class="modal-box" style="width:420px">
        <p class="modal-title">Confirm Resource Return</p>
        <p class="modal-body">
          Mark transaction <strong id="txCompleteId"></strong> as completed?
          The resource will be marked as returned and any applicable fine calculated.
        </p>
        <div class="modal-actions">
          <button class="btn-secondary" onclick="closeTxCompleteModal()">Cancel</button>
          <button class="btn-primary" id="txCompleteBtn"
            onclick="confirmComplete()">Confirm Return</button>
        </div>
      </div>
    </div>

    <!-- ── Fine Calculation Modal (Librarian) ─────────────── -->
    <div class="modal-overlay" id="fineCalcModal">
      <div class="modal-box" style="width:360px">
        <p class="modal-title">Fine Calculation</p>
        <div id="fineCalcResult" style="margin:20px 0"></div>
        <div class="modal-actions">
          <button class="btn-secondary" onclick="closeFineCalcModal()">Close</button>
        </div>
      </div>
    </div>

    <!-- ── Detail Modal ───────────────────────────────────── -->
    <div class="modal-overlay" id="txDetailModal">
      <div class="modal-box" style="width:560px">
        <p class="modal-title">Transaction Details</p>
        <div id="txDetailBody" style="margin-top:16px"></div>
        <div class="modal-actions">
          <button class="btn-secondary" onclick="closeTxDetail()">Close</button>
        </div>
      </div>
    </div>
  `;

  // Close on overlay click
  ['txCompleteModal','fineCalcModal','txDetailModal'].forEach(id => {
    document.getElementById(id).addEventListener('click', function(e) {
      if (e.target === this) this.classList.remove('open');
    });
  });

  // Fetch
  try {
    const result = isMember
      ? await api.getMemberTransactions(user.id)
      : await api.getTransactions();
    _allTransactions = Array.isArray(result) ? result : [];
  } catch {
    _allTransactions = [];
  }

  // Render stats
  document.getElementById('txStats').innerHTML = buildTxStats(_allTransactions);

  rerenderTransactions();
};

window.rerenderTransactions = rerenderTransactions;
