// ─────────────────────────────────────────────────────────────
//  home.js  —  Dashboard home module
//  Entry point: window.loadHomeModule(user, container)
//  Shows role-specific stats, greeting, and activity panels.
// ─────────────────────────────────────────────────────────────

// ─── Role config ──────────────────────────────────────────────
const HOME_CONFIG = {

  ADMIN: {
    greeting: (name) => `Welcome back, ${name}.`,
    subtitle:  'Here is an overview of the entire library system.',
    stats: [
      { key: 'totalMembers',      label: 'Total Members',    icon: '👥', accent: 'green'  },
      { key: 'totalLibrarians',   label: 'Librarians',       icon: '🗝️', accent: 'brown'  },
      { key: 'totalResources',    label: 'Resources',        icon: '📦', accent: 'gold'   },
      { key: 'activeTransactions',label: 'Active Borrows',   icon: '📋', accent: 'blue'   },
      { key: 'pendingReservations',label:'Pending Holds',    icon: '🔖', accent: 'rust'   },
      { key: 'unpaidFines',       label: 'Unpaid Fines',     icon: '💰', accent: 'rust'   },
    ],
    fetchData: async () => {
      try { return await api.getAnalytics(); } catch { return null; }
    },
    panels: ['recentTransactions', 'recentMembers'],
  },

  LIBRARIAN: {
    greeting: (name) => `Good day, ${name}.`,
    subtitle:  'Your desk overview — resources, activity, and pending tasks.',
    stats: [
      { key: 'totalResources',     label: 'Resources',       icon: '📦', accent: 'gold'   },
      { key: 'activeTransactions', label: 'Active Borrows',  icon: '📋', accent: 'green'  },
      { key: 'pendingReservations',label: 'Pending Holds',   icon: '🔖', accent: 'blue'   },
      { key: 'unpaidFines',        label: 'Unpaid Fines',    icon: '💰', accent: 'rust'   },
      { key: 'overdueItems',       label: 'Overdue Items',   icon: '⏰', accent: 'rust'   },
    ],
    fetchData: async () => {
      try { return await api.getReport(); } catch { return null; }
    },
    panels: ['recentTransactions', 'pendingReservations'],
  },

  MEMBER: {
    greeting: (name) => `Hello, ${name}.`,
    subtitle:  'Your personal library snapshot.',
    stats: [
      { key: 'totalBorrowed',      label: 'Currently Borrowed', icon: '📚', accent: 'green'  },
      { key: 'borrowLimit',        label: 'Borrow Limit',       icon: '📏', accent: 'brown'  },
      { key: 'activeReservations', label: 'Active Holds',       icon: '🔖', accent: 'blue'   },
      { key: 'unpaidFines',        label: 'Outstanding Fines',  icon: '💰', accent: 'rust'   },
    ],
    fetchData: async (user) => {
      try {
        const [member, fines] = await Promise.allSettled([
          api.getMember(user.id),
          api.getMemberFines(user.id),
        ]);
        const m = member.status === 'fulfilled' ? member.value : {};
        const f = fines.status  === 'fulfilled' ? fines.value  : [];
        const unpaid = Array.isArray(f) ? f.filter(x => !x.isPaid).length : 0;
        const activeRes = Array.isArray(m.activeReservations) ? m.activeReservations.length : 0;
        return {
          totalBorrowed:      m.totalBorrowed      ?? 0,
          borrowLimit:        m.borrowLimit        ?? 0,
          activeReservations: activeRes,
          unpaidFines:        unpaid,
          membershipStatus:   m.membershipStatus   ?? '—',
          recentTransactions: m.borrowHistory      ?? [],
        };
      } catch { return null; }
    },
    panels: ['myRecentBorrows', 'myReservations'],
  },
};

// ─── Accent colours (matches dashboard.css tokens) ────────────
const ACCENT = {
  green: { bg: '#e8f0e8', border: '#2d4a2d', text: '#2d4a2d' },
  gold:  { bg: '#fdf3d0', border: '#b8860b', text: '#7a5c00' },
  brown: { bg: '#f3ebe0', border: '#5c3d1e', text: '#5c3d1e' },
  blue:  { bg: '#e8edf5', border: '#2a3f6b', text: '#2a3f6b' },
  rust:  { bg: '#fdecea', border: '#8b3a1a', text: '#8b3a1a' },
};

// ─── Helpers ──────────────────────────────────────────────────
function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 1)  return 'just now';
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

function statusBadge(status) {
  const map = {
    Available:  'available',  Borrowed:  'borrowed',
    Reserved:   'reserved',   Lost:      'lost',
    Active:     'active',     Suspended: 'suspended',   Expired:  'expired',
    Pending:    'pending',    Approved:  'approved',    Cancelled:'cancelled',
    Completed:  'completed',
  };
  const cls = map[status] || 'pending';
  return `<span class="badge badge-${cls}">${status ?? '—'}</span>`;
}

// ─── Stat cards ───────────────────────────────────────────────
function buildStatCards(stats, data) {
  return stats.map((s, i) => {
    const val    = data ? (data[s.key] ?? 0) : '—';
    const accent = ACCENT[s.accent] || ACCENT.gold;
    return `
      <div class="stat-card" style="
        border-top-color: ${accent.border};
        animation-delay: ${i * 0.07}s;
      ">
        <span class="stat-icon">${s.icon}</span>
        <span class="stat-value" style="color:${accent.text}">${val}</span>
        <span class="stat-label">${s.label}</span>
      </div>
    `;
  }).join('');
}

// ─── Panel: recent transactions (Admin / Librarian) ───────────
function buildRecentTransactionsPanel(data) {
  const rows = Array.isArray(data?.recentTransactions)
    ? data.recentTransactions.slice(0, 8)
    : [];

  const body = rows.length
    ? rows.map(t => `
        <tr>
          <td>#${t.transactionId ?? '—'}</td>
          <td>${t.memberName ?? '—'}</td>
          <td>${t.resourceTitle ?? '—'}</td>
          <td>${formatDate(t.borrowDate)}</td>
          <td>${formatDate(t.dueDate)}</td>
          <td>${statusBadge(t.transactionStatus)}</td>
        </tr>
      `).join('')
    : `<tr><td colspan="6">
        <div class="empty-state" style="padding:24px">
          <span class="empty-state-icon">📋</span>
          <p class="empty-state-text">No recent transactions</p>
        </div>
      </td></tr>`;

  return `
    <div class="card">
      <div class="card-header">
        <span class="card-title">📋 Recent Transactions</span>
      </div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>#ID</th><th>Member</th><th>Resource</th>
              <th>Borrowed</th><th>Due</th><th>Status</th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    </div>
  `;
}

// ─── Panel: recent members (Admin) ───────────────────────────
function buildRecentMembersPanel(data) {
  const rows = Array.isArray(data?.recentMembers)
    ? data.recentMembers.slice(0, 6)
    : [];

  const body = rows.length
    ? rows.map(m => `
        <tr>
          <td>#${m.membershipId ?? '—'}</td>
          <td>${m.name ?? '—'}</td>
          <td>${m.email ?? '—'}</td>
          <td>${statusBadge(m.membershipStatus)}</td>
          <td>${m.totalBorrowed ?? 0} / ${m.borrowLimit ?? 0}</td>
        </tr>
      `).join('')
    : `<tr><td colspan="5">
        <div class="empty-state" style="padding:24px">
          <span class="empty-state-icon">👥</span>
          <p class="empty-state-text">No member data</p>
        </div>
      </td></tr>`;

  return `
    <div class="card">
      <div class="card-header">
        <span class="card-title">👥 Recent Members</span>
      </div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>#ID</th><th>Name</th><th>Email</th>
              <th>Status</th><th>Borrowed / Limit</th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    </div>
  `;
}

// ─── Panel: pending reservations (Librarian) ─────────────────
function buildPendingReservationsPanel(data) {
  const rows = Array.isArray(data?.pendingReservations)
    ? data.pendingReservations.slice(0, 8)
    : [];

  const body = rows.length
    ? rows.map(r => `
        <tr>
          <td>#${r.reservationId ?? '—'}</td>
          <td>${r.memberName ?? '—'}</td>
          <td>${r.resourceTitle ?? '—'}</td>
          <td>${formatDate(r.requestDate)}</td>
          <td>${formatDate(r.expiryDate)}</td>
          <td>${r.queuePosition ?? '—'}</td>
          <td>${statusBadge(r.status)}</td>
        </tr>
      `).join('')
    : `<tr><td colspan="7">
        <div class="empty-state" style="padding:24px">
          <span class="empty-state-icon">🔖</span>
          <p class="empty-state-text">No pending reservations</p>
        </div>
      </td></tr>`;

  return `
    <div class="card">
      <div class="card-header">
        <span class="card-title">🔖 Pending Reservations</span>
      </div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>#ID</th><th>Member</th><th>Resource</th>
              <th>Requested</th><th>Expires</th><th>Queue</th><th>Status</th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    </div>
  `;
}

// ─── Panel: member's recent borrows ───────────────────────────
function buildMyRecentBorrowsPanel(data) {
  const rows = Array.isArray(data?.recentTransactions)
    ? data.recentTransactions.slice(0, 6)
    : [];

  const body = rows.length
    ? rows.map(t => `
        <tr>
          <td>${t.resourceTitle ?? '—'}</td>
          <td>${formatDate(t.borrowDate)}</td>
          <td>${formatDate(t.dueDate)}</td>
          <td>${t.returnDate ? formatDate(t.returnDate) : '<em style="color:var(--ink-muted)">Not returned</em>'}</td>
          <td>${statusBadge(t.transactionStatus)}</td>
        </tr>
      `).join('')
    : `<tr><td colspan="5">
        <div class="empty-state" style="padding:24px">
          <span class="empty-state-icon">📚</span>
          <p class="empty-state-text">You haven't borrowed anything yet</p>
        </div>
      </td></tr>`;

  return `
    <div class="card">
      <div class="card-header">
        <span class="card-title">📚 My Recent Borrowings</span>
      </div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Resource</th><th>Borrowed</th>
              <th>Due</th><th>Returned</th><th>Status</th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    </div>
  `;
}

// ─── Panel: member's active reservations ──────────────────────
function buildMyReservationsPanel(data) {
  const rows = Array.isArray(data?.reservations)
    ? data.reservations.slice(0, 6)
    : [];

  const body = rows.length
    ? rows.map(r => `
        <tr>
          <td>${r.resourceTitle ?? '—'}</td>
          <td>${formatDate(r.requestDate)}</td>
          <td>${formatDate(r.expiryDate)}</td>
          <td>#${r.queuePosition ?? '—'}</td>
          <td>${statusBadge(r.status)}</td>
        </tr>
      `).join('')
    : `<tr><td colspan="5">
        <div class="empty-state" style="padding:24px">
          <span class="empty-state-icon">🔖</span>
          <p class="empty-state-text">No active reservations</p>
        </div>
      </td></tr>`;

  return `
    <div class="card">
      <div class="card-header">
        <span class="card-title">🔖 My Reservations</span>
      </div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Resource</th><th>Requested</th>
              <th>Expires</th><th>Queue</th><th>Status</th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    </div>
  `;
}

// ─── Member status banner ─────────────────────────────────────
function buildMemberBanner(data) {
  if (!data?.membershipStatus) return '';
  const statusColors = {
    Active:    { bg: '#e8f0e8', border: '#2d4a2d', text: '#2d4a2d', icon: '✅' },
    Suspended: { bg: '#fff3cd', border: '#b8860b', text: '#7a5c00', icon: '⚠️' },
    Expired:   { bg: '#fdecea', border: '#8b3a1a', text: '#8b3a1a', icon: '❌' },
  };
  const s = statusColors[data.membershipStatus] || statusColors.Active;
  return `
    <div style="
      background: ${s.bg};
      border: 1.5px solid ${s.border};
      border-radius: 6px;
      padding: 12px 18px;
      margin-bottom: 24px;
      display: flex;
      align-items: center;
      gap: 10px;
      font-family: 'EB Garamond', serif;
      font-size: 15px;
      color: ${s.text};
    ">
      <span style="font-size:18px">${s.icon}</span>
      <span>
        Membership status: <strong>${data.membershipStatus}</strong>
        ${data.membershipStatus === 'Suspended'
          ? ' — Please contact a librarian to resolve outstanding issues.'
          : data.membershipStatus === 'Expired'
          ? ' — Please renew your membership at the front desk.'
          : ' — Your account is in good standing.'}
      </span>
    </div>
  `;
}

// ─── Panel selector ───────────────────────────────────────────
function buildPanel(panelId, data) {
  switch (panelId) {
    case 'recentTransactions':    return buildRecentTransactionsPanel(data);
    case 'recentMembers':         return buildRecentMembersPanel(data);
    case 'pendingReservations':   return buildPendingReservationsPanel(data);
    case 'myRecentBorrows':       return buildMyRecentBorrowsPanel(data);
    case 'myReservations':        return buildMyReservationsPanel(data);
    default: return '';
  }
}

// ─── Main entry point ─────────────────────────────────────────
window.loadHomeModule = async function(user, container) {
  const role   = user.role;
  const config = HOME_CONFIG[role] || HOME_CONFIG.MEMBER;

  // Fetch data (fails silently — shows zeros/empty states)
  const data = await config.fetchData(user);

  // Build HTML
  const statCards = buildStatCards(config.stats, data);
  const panels    = config.panels.map(p => buildPanel(p, data)).join('');
  const banner    = role === 'MEMBER' ? buildMemberBanner(data) : '';

  // Get current hour for greeting flavour
  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';

  container.innerHTML = `
    <!-- Page header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">${config.greeting(user.name.split(' ')[0])}</h1>
        <p class="page-subtitle">${timeOfDay} · ${new Date().toLocaleDateString('en-GB', {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        })}</p>
      </div>
      <div style="
        font-family: 'DM Mono', monospace;
        font-size: 11px;
        color: var(--ink-muted);
        letter-spacing: 0.1em;
        text-align: right;
        line-height: 1.8;
      ">
        <div style="text-transform:uppercase">NEXUS LMS</div>
        <div>${config.subtitle}</div>
      </div>
    </div>

    <!-- Body -->
    <div class="page-body">

      ${banner}

      <!-- Ornamental divider -->
      <div style="
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 20px;
      ">
        <span style="
          font-family:'DM Mono',monospace;
          font-size:10px;
          letter-spacing:0.18em;
          text-transform:uppercase;
          color:var(--ink-muted);
        ">At a Glance</span>
        <div style="flex:1;height:1px;background:var(--parchment-dark)"></div>
        <span style="color:var(--gold);font-size:12px">❧</span>
      </div>

      <!-- Stat cards -->
      <div class="stat-grid" style="margin-bottom:32px">
        ${statCards}
      </div>

      <!-- Ornamental divider -->
      <div style="
        display:flex;
        align-items:center;
        gap:12px;
        margin-bottom:20px;
      ">
        <span style="
          font-family:'DM Mono',monospace;
          font-size:10px;
          letter-spacing:0.18em;
          text-transform:uppercase;
          color:var(--ink-muted);
        ">Recent Activity</span>
        <div style="flex:1;height:1px;background:var(--parchment-dark)"></div>
        <span style="color:var(--gold);font-size:12px">❧</span>
      </div>

      <!-- Panels -->
      <div style="display:flex;flex-direction:column;gap:24px">
        ${panels}
      </div>

    </div>
  `;
};
