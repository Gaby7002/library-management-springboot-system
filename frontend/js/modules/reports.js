// ─────────────────────────────────────────────────────────────
//  reports.js  —  Reports module
//  Entry point: window.loadReportsModule(user, container)
//
//  ADMIN:     full system report
//  LIBRARIAN: operational report (inventory + activity)
// ─────────────────────────────────────────────────────────────

// ─── Helpers ──────────────────────────────────────────────────
function escRp(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

function formatDateRp(ds) {
  if (!ds) return '—';
  return new Date(ds).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

// ─── Section header ornament ──────────────────────────────────
function sectionHeader(title) {
  return `
    <div style="
      display:flex;align-items:center;gap:12px;
      margin:32px 0 16px;
    ">
      <span style="
        font-family:'DM Mono',monospace;font-size:10px;
        letter-spacing:0.2em;text-transform:uppercase;
        color:var(--ink-muted);white-space:nowrap;
      ">${title}</span>
      <div style="flex:1;height:1px;background:var(--parchment-dark)"></div>
      <span style="color:var(--gold);font-size:12px">❧</span>
    </div>`;
}

// ─── Stat row ─────────────────────────────────────────────────
function statRow(label, value, highlight = false) {
  return `
    <div style="
      display:flex;justify-content:space-between;align-items:center;
      padding:10px 0;
      border-bottom:1px solid var(--parchment);
    ">
      <span style="font-size:15px;color:var(--ink-light)">${escRp(label)}</span>
      <span style="
        font-family:'DM Mono',monospace;font-size:14px;font-weight:600;
        color:${highlight ? 'var(--rust)' : 'var(--ink)'};
      ">${escRp(String(value ?? '—'))}</span>
    </div>`;
}

// ─── Progress bar ─────────────────────────────────────────────
function progressBar(label, value, total, color = 'var(--green)') {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return `
    <div style="margin-bottom:14px">
      <div style="
        display:flex;justify-content:space-between;
        font-size:13px;margin-bottom:5px;
      ">
        <span style="color:var(--ink-light)">${escRp(label)}</span>
        <span style="
          font-family:'DM Mono',monospace;color:var(--ink-muted);font-size:12px;
        ">${value} / ${total} (${pct}%)</span>
      </div>
      <div style="
        height:8px;background:var(--parchment-dark);
        border-radius:4px;overflow:hidden;
      ">
        <div style="
          width:${pct}%;height:100%;background:${color};
          border-radius:4px;transition:width 0.6s ease;
        "></div>
      </div>
    </div>`;
}

// ─── Top items table ──────────────────────────────────────────
function topItemsTable(items, colLabel) {
  if (!Array.isArray(items) || !items.length) return `
    <div class="empty-state" style="padding:24px">
      <span class="empty-state-icon">📊</span>
      <p class="empty-state-text">No data available</p>
    </div>`;
  return `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>#</th><th>${escRp(colLabel)}</th><th>Count</th>
          </tr>
        </thead>
        <tbody>
          ${items.slice(0, 8).map((item, i) => `
            <tr>
              <td style="font-family:'DM Mono',monospace;color:var(--ink-muted)">
                ${i + 1}
              </td>
              <td><strong>${escRp(item.title ?? item.name ?? '—')}</strong></td>
              <td>
                <span style="
                  font-family:'DM Mono',monospace;font-size:13px;
                  color:var(--green);font-weight:600;
                ">${item.count ?? item.borrowCount ?? '—'}</span>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

// ─── Build report HTML ────────────────────────────────────────
function buildReportHTML(data, role) {
  const generatedAt = formatDateRp(new Date().toISOString());

  // Safely extract data sections
  const inventory    = data?.inventory    ?? {};
  const activity     = data?.activity     ?? {};
  const fines        = data?.fines        ?? {};
  const topBorrowed  = data?.topBorrowed  ?? [];
  const topMembers   = data?.topMembers   ?? [];
  const resourceBreakdown = data?.resourceBreakdown ?? {};

  return `
    <!-- Report header -->
    <div style="
      background:var(--green);
      background-image:linear-gradient(135deg, var(--green) 0%, #1e3a1e 100%);
      border-radius:8px;
      padding:28px 32px;
      margin-bottom:8px;
      color:var(--cream);
      display:flex;justify-content:space-between;align-items:flex-end;
      flex-wrap:wrap;gap:16px;
    ">
      <div>
        <div style="
          font-family:'DM Mono',monospace;font-size:10px;
          letter-spacing:0.2em;text-transform:uppercase;
          color:rgba(245,240,232,0.5);margin-bottom:6px;
        ">NEXUS LIBRARY MANAGEMENT SYSTEM</div>
        <div style="
          font-family:'Playfair Display',serif;
          font-size:26px;font-weight:700;
        ">
          ${role === 'ADMIN' ? 'Full System Report' : 'Operational Report'}
        </div>
        <div style="
          font-family:'EB Garamond',serif;font-size:15px;
          color:rgba(245,240,232,0.65);margin-top:4px;font-style:italic;
        ">
          ${role === 'ADMIN'
            ? 'Complete overview of all library operations and metrics.'
            : 'Inventory status, borrowing activity, and fine management.'}
        </div>
      </div>
      <div style="text-align:right">
        <div style="
          font-family:'DM Mono',monospace;font-size:10px;
          letter-spacing:0.14em;color:rgba(245,240,232,0.5);
          text-transform:uppercase;margin-bottom:4px;
        ">Generated</div>
        <div style="
          font-family:'DM Mono',monospace;font-size:13px;
        ">${generatedAt}</div>
      </div>
    </div>

    <!-- ── Inventory ─────────────────────────────────── -->
    ${sectionHeader('Inventory Overview')}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:8px">

      <div class="card">
        <div class="card-header">
          <span class="card-title">📦 Resource Counts</span>
        </div>
        <div class="card-body">
          ${statRow('Total Resources',   inventory.totalResources   ?? 0)}
          ${statRow('Books',             inventory.totalBooks       ?? 0)}
          ${statRow('Digital Assets',    inventory.totalDigital     ?? 0)}
          ${statRow('Equipment Items',   inventory.totalEquipment   ?? 0)}
          ${statRow('Total Authors',     inventory.totalAuthors     ?? 0)}
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <span class="card-title">📊 Resource Status</span>
        </div>
        <div class="card-body">
          ${progressBar('Available',
            resourceBreakdown.available ?? 0,
            inventory.totalResources    ?? 1,
            'var(--green)')}
          ${progressBar('Borrowed',
            resourceBreakdown.borrowed  ?? 0,
            inventory.totalResources    ?? 1,
            'var(--gold)')}
          ${progressBar('Reserved',
            resourceBreakdown.reserved  ?? 0,
            inventory.totalResources    ?? 1,
            'var(--blue)')}
          ${progressBar('Lost',
            resourceBreakdown.lost      ?? 0,
            inventory.totalResources    ?? 1,
            'var(--rust)')}
        </div>
      </div>
    </div>

    <!-- ── Activity ──────────────────────────────────── -->
    ${sectionHeader('Borrowing Activity')}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:8px">

      <div class="card">
        <div class="card-header">
          <span class="card-title">📋 Transaction Summary</span>
        </div>
        <div class="card-body">
          ${statRow('Total Transactions',  activity.totalTransactions  ?? 0)}
          ${statRow('Active Borrows',      activity.activeTransactions ?? 0)}
          ${statRow('Completed Returns',   activity.completedReturns   ?? 0)}
          ${statRow('Overdue Items',       activity.overdueItems       ?? 0, true)}
          ${statRow('Reservations Total',  activity.totalReservations  ?? 0)}
          ${statRow('Pending Holds',       activity.pendingReservations?? 0)}
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <span class="card-title">💰 Fines Summary</span>
        </div>
        <div class="card-body">
          ${statRow('Total Fines Issued',  fines.totalFines   ?? 0)}
          ${statRow('Unpaid Fines',        fines.unpaidFines  ?? 0, true)}
          ${statRow('Paid Fines',          fines.paidFines    ?? 0)}
          ${statRow('Total Amount',        `$${Number(fines.totalAmount  ?? 0).toFixed(2)}`)}
          ${statRow('Unpaid Amount',       `$${Number(fines.unpaidAmount ?? 0).toFixed(2)}`, true)}
          ${statRow('Collected Amount',    `$${Number(fines.paidAmount   ?? 0).toFixed(2)}`)}
        </div>
      </div>
    </div>

    <!-- ── Members (Admin only) ──────────────────────── -->
    ${role === 'ADMIN' ? `
      ${sectionHeader('Member Statistics')}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:8px">
        <div class="card">
          <div class="card-header">
            <span class="card-title">👥 Membership Overview</span>
          </div>
          <div class="card-body">
            ${statRow('Total Members',     data?.members?.total      ?? 0)}
            ${statRow('Active Members',    data?.members?.active     ?? 0)}
            ${statRow('Suspended Members', data?.members?.suspended  ?? 0, true)}
            ${statRow('Expired Members',   data?.members?.expired    ?? 0, true)}
            ${statRow('Total Librarians',  data?.members?.librarians ?? 0)}
          </div>
        </div>
        <div class="card">
          <div class="card-header">
            <span class="card-title">🏆 Top Borrowing Members</span>
          </div>
          ${topItemsTable(topMembers, 'Member')}
        </div>
      </div>` : ''}

    <!-- ── Top Resources ─────────────────────────────── -->
    ${sectionHeader('Most Borrowed Resources')}
    <div class="card" style="margin-bottom:8px">
      <div class="card-header">
        <span class="card-title">📚 Top Borrowed Items</span>
      </div>
      ${topItemsTable(topBorrowed, 'Resource Title')}
    </div>

    <!-- Print note -->
    <div style="
      margin-top:32px;padding:14px 18px;
      background:var(--parchment);
      border-radius:6px;
      font-family:'DM Mono',monospace;font-size:11px;
      letter-spacing:0.08em;color:var(--ink-muted);
      text-align:center;
    ">
      ❧ &nbsp; Report generated on ${generatedAt} &nbsp; · &nbsp;
      NEXUS Library Management System &nbsp; ❧
    </div>
  `;
}

// ─── Main entry ───────────────────────────────────────────────
window.loadReportsModule = async function(user, container) {
  const role = user.role;

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">📊 Reports</h1>
        <p class="page-subtitle">
          ${role === 'ADMIN'
            ? 'Full system-wide library report.'
            : 'Operational summary for inventory and activity.'}
        </p>
      </div>
      <div class="page-actions">
        <button class="btn-secondary" onclick="window.print()" style="font-size:14px">
          🖨️ Print Report
        </button>
        <button class="btn-primary" id="refreshReportBtn"
          onclick="refreshReport()">
          🔄 Refresh
        </button>
      </div>
    </div>

    <div class="page-body">
      <div id="reportBody">
        <div class="loading-state">
          <span class="spinner"></span><span>Generating report…</span>
        </div>
      </div>
    </div>
  `;

  async function fetchAndRender() {
    const btn = document.getElementById('refreshReportBtn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Loading…'; }

    try {
      const data = role === 'ADMIN'
        ? await api.getAnalytics()
        : await api.getReport();
      document.getElementById('reportBody').innerHTML =
        buildReportHTML(data ?? {}, role);
    } catch (err) {
      document.getElementById('reportBody').innerHTML = `
        <div class="empty-state" style="padding:80px">
          <span class="empty-state-icon">⚠️</span>
          <p class="empty-state-text">
            Could not load report data.<br>
            <span style="font-size:13px;color:var(--ink-muted)">${escRp(err.message)}</span>
          </p>
        </div>`;
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '🔄 Refresh'; }
    }
  }

  window.refreshReport = fetchAndRender;
  await fetchAndRender();
};
