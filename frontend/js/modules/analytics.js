// ─────────────────────────────────────────────────────────────
//  analytics.js  —  Analytics module  (Admin only)
//  Entry point: window.loadAnalyticsModule(user, container)
// ─────────────────────────────────────────────────────────────

// ─── Helpers ──────────────────────────────────────────────────
function escAn(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

// ─── KPI card ─────────────────────────────────────────────────
function kpiCard(icon, label, value, sub, accentColor, delay = 0) {
  return `
    <div style="
      background:var(--cream);
      border:1px solid var(--parchment-dark);
      border-radius:8px;
      padding:20px;
      box-shadow:var(--shadow-sm);
      border-top:3px solid ${accentColor};
      animation:cardIn 0.35s ease both;
      animation-delay:${delay}s;
    ">
      <div style="font-size:22px;margin-bottom:6px">${icon}</div>
      <div style="
        font-family:'Playfair Display',serif;
        font-size:30px;font-weight:700;
        color:${accentColor};line-height:1;
      ">${escAn(String(value ?? '—'))}</div>
      <div style="
        font-family:'DM Mono',monospace;font-size:10px;
        letter-spacing:0.14em;text-transform:uppercase;
        color:var(--ink-muted);margin-top:6px;
      ">${escAn(label)}</div>
      ${sub ? `<div style="font-size:13px;color:var(--ink-muted);
        font-style:italic;margin-top:4px">${escAn(sub)}</div>` : ''}
    </div>`;
}

// ─── Horizontal bar chart (pure CSS/HTML) ─────────────────────
function barChart(items, valueKey, labelKey, color = 'var(--green)') {
  if (!Array.isArray(items) || !items.length) return `
    <div class="empty-state" style="padding:24px">
      <span class="empty-state-icon">📊</span>
      <p class="empty-state-text">No data available</p>
    </div>`;

  const max = Math.max(...items.map(i => Number(i[valueKey] ?? 0)), 1);

  return `
    <div style="display:flex;flex-direction:column;gap:10px">
      ${items.slice(0, 8).map((item, idx) => {
        const val = Number(item[valueKey] ?? 0);
        const pct = Math.round((val / max) * 100);
        return `
          <div>
            <div style="
              display:flex;justify-content:space-between;
              font-size:13px;margin-bottom:4px;
            ">
              <span style="
                color:var(--ink-light);
                white-space:nowrap;overflow:hidden;
                text-overflow:ellipsis;max-width:65%;
              ">${escAn(item[labelKey] ?? '—')}</span>
              <span style="
                font-family:'DM Mono',monospace;
                color:var(--ink-muted);font-size:12px;
              ">${val}</span>
            </div>
            <div style="
              height:10px;background:var(--parchment-dark);
              border-radius:5px;overflow:hidden;
            ">
              <div style="
                width:${pct}%;height:100%;
                background:${color};
                border-radius:5px;
                transition:width 0.8s cubic-bezier(0.4,0,0.2,1);
                animation-delay:${idx * 0.08}s;
              "></div>
            </div>
          </div>`;
      }).join('')}
    </div>`;
}

// ─── Donut-style pie (CSS-only) ───────────────────────────────
function pieChart(segments) {
  // segments: [{label, value, color}]
  if (!Array.isArray(segments) || !segments.length) return '';

  const total = segments.reduce((s, x) => s + Number(x.value ?? 0), 0);
  if (!total) return `<p style="color:var(--ink-muted);font-style:italic;
    font-size:14px;text-align:center">No data</p>`;

  // Build conic-gradient stops
  let deg = 0;
  const stops = segments.map(s => {
    const pct = (Number(s.value ?? 0) / total) * 360;
    const start = deg;
    deg += pct;
    return `${s.color} ${start.toFixed(1)}deg ${deg.toFixed(1)}deg`;
  }).join(', ');

  return `
    <div style="display:flex;align-items:center;gap:24px;flex-wrap:wrap">
      <div style="
        width:120px;height:120px;flex-shrink:0;
        border-radius:50%;
        background:conic-gradient(${stops});
        box-shadow:0 2px 12px rgba(0,0,0,0.12);
      "></div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${segments.map(s => {
          const pct = total > 0
            ? Math.round((Number(s.value ?? 0) / total) * 100)
            : 0;
          return `
            <div style="display:flex;align-items:center;gap:8px">
              <div style="
                width:12px;height:12px;border-radius:2px;
                background:${s.color};flex-shrink:0;
              "></div>
              <span style="font-size:14px;color:var(--ink-light)">
                ${escAn(s.label)}
              </span>
              <span style="
                font-family:'DM Mono',monospace;font-size:12px;
                color:var(--ink-muted);margin-left:4px;
              ">${s.value} (${pct}%)</span>
            </div>`;
        }).join('')}
      </div>
    </div>`;
}

// ─── Section header ───────────────────────────────────────────
function sectionHeaderAn(title) {
  return `
    <div style="
      display:flex;align-items:center;gap:12px;margin:32px 0 16px;
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

// ─── Build analytics page ─────────────────────────────────────
function buildAnalyticsHTML(data) {
  const members    = data?.members          ?? {};
  const inventory  = data?.inventory        ?? {};
  const activity   = data?.activity         ?? {};
  const fines      = data?.fines            ?? {};
  const topBorrowed= data?.topBorrowed      ?? [];
  const topMembers = data?.topMembers       ?? [];
  const resBreak   = data?.resourceBreakdown?? {};
  const memBreak   = data?.memberBreakdown  ?? {};

  return `

    ${sectionHeaderAn('Key Performance Indicators')}

    <!-- KPI grid -->
    <div style="
      display:grid;
      grid-template-columns:repeat(auto-fill,minmax(170px,1fr));
      gap:16px;margin-bottom:8px;
    ">
      ${kpiCard('👥', 'Total Members',    members.total      ?? 0, `${members.active ?? 0} active`, 'var(--green)', 0)}
      ${kpiCard('📦', 'Total Resources',  inventory.totalResources ?? 0, `${resBreak.available ?? 0} available`, 'var(--gold)', 0.05)}
      ${kpiCard('📋', 'Active Borrows',   activity.activeTransactions ?? 0, `${activity.overdueItems ?? 0} overdue`, 'var(--blue)', 0.10)}
      ${kpiCard('🔖', 'Pending Holds',    activity.pendingReservations ?? 0, 'awaiting approval', 'var(--brown)', 0.15)}
      ${kpiCard('💰', 'Unpaid Fines',     fines.unpaidFines  ?? 0, `$${Number(fines.unpaidAmount ?? 0).toFixed(2)} outstanding`, 'var(--rust)', 0.20)}
      ${kpiCard('🗝️', 'Librarians',       members.librarians ?? 0, 'active staff', 'var(--ink-muted)', 0.25)}
    </div>

    ${sectionHeaderAn('Inventory Breakdown')}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:8px">

      <!-- Resource type split -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">📦 By Resource Type</span>
        </div>
        <div class="card-body">
          ${pieChart([
            { label: 'Books',          value: inventory.totalBooks    ?? 0, color: 'var(--green)'      },
            { label: 'Digital Assets', value: inventory.totalDigital  ?? 0, color: 'var(--gold)'       },
            { label: 'Equipment',      value: inventory.totalEquipment?? 0, color: 'var(--brown)'      },
          ])}
        </div>
      </div>

      <!-- Resource status split -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">📊 By Availability Status</span>
        </div>
        <div class="card-body">
          ${pieChart([
            { label: 'Available', value: resBreak.available ?? 0, color: 'var(--green)'       },
            { label: 'Borrowed',  value: resBreak.borrowed  ?? 0, color: 'var(--gold)'        },
            { label: 'Reserved',  value: resBreak.reserved  ?? 0, color: '#2a3f6b'            },
            { label: 'Lost',      value: resBreak.lost      ?? 0, color: 'var(--rust)'        },
          ])}
        </div>
      </div>
    </div>

    ${sectionHeaderAn('Member Analytics')}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:8px">

      <!-- Membership status split -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">👤 Membership Status</span>
        </div>
        <div class="card-body">
          ${pieChart([
            { label: 'Active',    value: memBreak.active    ?? members.active    ?? 0, color: 'var(--green)' },
            { label: 'Suspended', value: memBreak.suspended ?? members.suspended ?? 0, color: 'var(--gold)'  },
            { label: 'Expired',   value: memBreak.expired   ?? members.expired   ?? 0, color: 'var(--rust)'  },
          ])}
        </div>
      </div>

      <!-- Top borrowing members -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">🏆 Top Borrowing Members</span>
        </div>
        <div class="card-body">
          ${barChart(topMembers, 'count', 'name', 'var(--green)')}
        </div>
      </div>
    </div>

    ${sectionHeaderAn('Borrowing Activity')}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:8px">

      <!-- Most borrowed resources -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">📚 Most Borrowed Resources</span>
        </div>
        <div class="card-body">
          ${barChart(topBorrowed, 'count', 'title', 'var(--brown)')}
        </div>
      </div>

      <!-- Transaction activity summary -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">📋 Transaction Overview</span>
        </div>
        <div class="card-body">
          ${barChart([
            { label: 'Total Transactions',   count: activity.totalTransactions   ?? 0 },
            { label: 'Active Borrows',       count: activity.activeTransactions  ?? 0 },
            { label: 'Completed Returns',    count: activity.completedReturns    ?? 0 },
            { label: 'Overdue Items',        count: activity.overdueItems        ?? 0 },
            { label: 'Total Reservations',   count: activity.totalReservations   ?? 0 },
            { label: 'Pending Reservations', count: activity.pendingReservations ?? 0 },
          ], 'count', 'label', 'var(--blue)')}
        </div>
      </div>
    </div>

    ${sectionHeaderAn('Fines Overview')}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:8px">

      <div class="card">
        <div class="card-header">
          <span class="card-title">💰 Fine Status Split</span>
        </div>
        <div class="card-body">
          ${pieChart([
            { label: 'Paid',   value: fines.paidFines   ?? 0, color: 'var(--green)' },
            { label: 'Unpaid', value: fines.unpaidFines ?? 0, color: 'var(--rust)'  },
          ])}
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <span class="card-title">💵 Financial Summary</span>
        </div>
        <div class="card-body">
          ${barChart([
            { label: 'Total Issued ($)',    count: Number(fines.totalAmount  ?? 0).toFixed(2) },
            { label: 'Collected ($)',       count: Number(fines.paidAmount   ?? 0).toFixed(2) },
            { label: 'Outstanding ($)',     count: Number(fines.unpaidAmount ?? 0).toFixed(2) },
          ], 'count', 'label', 'var(--rust)')}
        </div>
      </div>
    </div>
  `;
}

// ─── Main entry ───────────────────────────────────────────────
window.loadAnalyticsModule = async function(user, container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">📈 Analytics</h1>
        <p class="page-subtitle">System-wide performance metrics and visual breakdowns.</p>
      </div>
      <div class="page-actions">
        <button class="btn-primary" id="refreshAnalyticsBtn"
          onclick="refreshAnalytics()">🔄 Refresh</button>
      </div>
    </div>

    <div class="page-body">
      <div id="analyticsBody">
        <div class="loading-state">
          <span class="spinner"></span><span>Loading analytics…</span>
        </div>
      </div>
    </div>
  `;

  async function fetchAndRender() {
    const btn = document.getElementById('refreshAnalyticsBtn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Loading…'; }

    try {
      const data = await api.getAnalytics();
      document.getElementById('analyticsBody').innerHTML =
        buildAnalyticsHTML(data ?? {});
    } catch (err) {
      document.getElementById('analyticsBody').innerHTML = `
        <div class="empty-state" style="padding:80px">
          <span class="empty-state-icon">⚠️</span>
          <p class="empty-state-text">
            Could not load analytics.<br>
            <span style="font-size:13px;color:var(--ink-muted)">${escAn(err.message)}</span>
          </p>
        </div>`;
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '🔄 Refresh'; }
    }
  }

  window.refreshAnalytics = fetchAndRender;
  await fetchAndRender();
};
