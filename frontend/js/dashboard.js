// ─────────────────────────────────────────────────────────────
//  dashboard.js  —  Shell controller
//  Reads the logged-in user from localStorage, builds the
//  role-appropriate sidebar, and handles section routing.
// ─────────────────────────────────────────────────────────────

// ─── Nav definitions per role ─────────────────────────────────
const NAV_CONFIG = {
  ADMIN: [
    { group: 'Overview' },
    { id: 'home',        icon: '🏛️',  label: 'Dashboard'     },
    { group: 'Catalogue' },
    { id: 'books',       icon: '📚',  label: 'Books'         },
    { id: 'digital',     icon: '💾',  label: 'Digital Assets'},
    { id: 'equipment',   icon: '🖥️',  label: 'Equipment'     },
    { id: 'authors',     icon: '✒️',  label: 'Authors'       },
    { group: 'People' },
    { id: 'members',     icon: '👤',  label: 'Members'       },
    { id: 'librarians',  icon: '🗝️',  label: 'Librarians'    },
    { group: 'Activity' },
    { id: 'transactions',icon: '📋',  label: 'Transactions'  },
    { id: 'reservations',icon: '🔖',  label: 'Reservations'  },
    { id: 'fines',       icon: '💰',  label: 'Fines'         },
    { group: 'Insights' },
    { id: 'reports',     icon: '📊',  label: 'Reports'       },
    { id: 'analytics',   icon: '📈',  label: 'Analytics'     },
  ],
  LIBRARIAN: [
    { group: 'Overview' },
    { id: 'home',        icon: '🏛️',  label: 'Dashboard'     },
    { group: 'Catalogue' },
    { id: 'books',       icon: '📚',  label: 'Books'         },
    { id: 'digital',     icon: '💾',  label: 'Digital Assets'},
    { id: 'equipment',   icon: '🖥️',  label: 'Equipment'     },
    { id: 'authors',     icon: '✒️',  label: 'Authors'       },
    { group: 'People' },
    { id: 'members',     icon: '👤',  label: 'Members'       },
    { group: 'Activity' },
    { id: 'transactions',icon: '📋',  label: 'Transactions'  },
    { id: 'reservations',icon: '🔖',  label: 'Reservations'  },
    { id: 'fines',       icon: '💰',  label: 'Fines'         },
    { group: 'Insights' },
    { id: 'reports',     icon: '📊',  label: 'Reports'       },
  ],
  MEMBER: [
    { group: 'Overview' },
    { id: 'home',        icon: '🏛️',  label: 'Dashboard'     },
    { group: 'Catalogue' },
    { id: 'books',       icon: '📚',  label: 'Books'         },
    { id: 'digital',     icon: '💾',  label: 'Digital Assets'},
    { id: 'equipment',   icon: '🖥️',  label: 'Equipment'     },
    { id: 'authors',     icon: '✒️',  label: 'Authors'       },
    { group: 'My Account' },
    { id: 'transactions',icon: '📋',  label: 'My Borrowings' },
    { id: 'reservations',icon: '🔖',  label: 'My Reservations'},
    { id: 'fines',       icon: '💰',  label: 'My Fines'      },
    { id: 'recommendations', icon: '⭐', label: 'For You'    },
  ],
};

// ─── Toast helper ──────────────────────────────────────────────
let _toastTimer;
function showToast(msg, type = 'info') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast toast-${type} show`;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 3500);
}

// Expose globally so modules can call it
window.showToast = showToast;

// ─── Navbar ────────────────────────────────────────────────────
function buildNavbar(user) {
  document.getElementById('userName').textContent = user.name;

  const initials = user.name
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  document.getElementById('userAvatar').textContent = initials;

  const badge = document.getElementById('roleBadge');
  const roleLabels = { ADMIN: 'Admin', LIBRARIAN: 'Librarian', MEMBER: 'Member' };
  badge.textContent = roleLabels[user.role] || user.role;
  badge.className = `role-badge ${user.role.toLowerCase()}`;
}

// ─── Sidebar ───────────────────────────────────────────────────
function buildSidebar(role) {
  const nav   = document.getElementById('sidebarNav');
  const items = NAV_CONFIG[role] || NAV_CONFIG.MEMBER;

  nav.innerHTML = '';

  items.forEach((item, index) => {
    if (item.group) {
      const label = document.createElement('div');
      label.className = 'nav-group-label';
      label.textContent = item.group;
      nav.appendChild(label);
      return;
    }

    const el = document.createElement('div');
    el.className = 'nav-item';
    el.dataset.section = item.id;
    el.style.animationDelay = `${index * 0.04}s`;
    el.innerHTML = `
      <span class="nav-icon">${item.icon}</span>
      <span class="nav-label">${item.label}</span>
    `;
    el.addEventListener('click', () => navigateTo(item.id));
    nav.appendChild(el);
  });
}

// ─── Sidebar toggle ────────────────────────────────────────────
function initSidebarToggle() {
  document.getElementById('sidebarToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('collapsed');
  });
}

// ─── Section routing ───────────────────────────────────────────
let currentSection = null;

async function navigateTo(sectionId) {
  if (currentSection === sectionId) return;
  currentSection = sectionId;

  // Highlight active nav item
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.section === sectionId);
  });

  // Show loading
  const main = document.getElementById('mainContent');
  main.innerHTML = `
    <div class="loading-state">
      <span class="spinner"></span>
      <span>Loading…</span>
    </div>
  `;

  try {
    await loadSection(sectionId);
  } catch (err) {
    main.innerHTML = `
      <div class="empty-state">
        <span class="empty-state-icon">⚠️</span>
        <p class="empty-state-text">${err.message || 'Failed to load section.'}</p>
      </div>
    `;
  }
}

// ─── Section loader (delegates to module scripts) ──────────────
/*
 * Each module file (js/modules/books.js, etc.) must expose a
 * single function:  window.loadBooksModule(user, container)
 * The dashboard calls it and passes the current user + the
 * main content container element.
 *
 * Modules are loaded lazily via <script> injection on first
 * visit so we don't load everything upfront.
 */
const loadedModules = new Set();

async function loadModule(scriptSrc) {
  if (loadedModules.has(scriptSrc)) return;
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = scriptSrc;
    s.onload  = () => { loadedModules.add(scriptSrc); resolve(); };
    s.onerror = () => reject(new Error(`Could not load module: ${scriptSrc}`));
    document.body.appendChild(s);
  });
}

async function loadSection(sectionId) {
  const user = window._nexusUser;
  const main = document.getElementById('mainContent');

  const sectionMap = {
    home:            { src: 'js/modules/home.js',            fn: 'loadHomeModule'            },
    books:           { src: 'js/modules/books.js',           fn: 'loadBooksModule'           },
    digital:         { src: 'js/modules/digital-assets.js',  fn: 'loadDigitalAssetsModule'   },
    equipment:       { src: 'js/modules/equipment.js',       fn: 'loadEquipmentModule'       },
    authors:         { src: 'js/modules/authors.js',         fn: 'loadAuthorsModule'         },
    members:         { src: 'js/modules/members.js',         fn: 'loadMembersModule'         },
    librarians:      { src: 'js/modules/librarians.js',      fn: 'loadLibrariansModule'      },
    transactions:    { src: 'js/modules/transactions.js',    fn: 'loadTransactionsModule'    },
    reservations:    { src: 'js/modules/reservations.js',    fn: 'loadReservationsModule'    },
    fines:           { src: 'js/modules/fines.js',           fn: 'loadFinesModule'           },
    reports:         { src: 'js/modules/reports.js',         fn: 'loadReportsModule'         },
    analytics:       { src: 'js/modules/analytics.js',       fn: 'loadAnalyticsModule'       },
    recommendations: { src: 'js/modules/recommendations.js', fn: 'loadRecommendationsModule' },
  };

  const entry = sectionMap[sectionId];
  if (!entry) {
    main.innerHTML = `<div class="empty-state"><p class="empty-state-text">Section not found.</p></div>`;
    return;
  }

  await loadModule(entry.src);

  if (typeof window[entry.fn] === 'function') {
    await window[entry.fn](user, main);
  } else {
    main.innerHTML = `<div class="empty-state"><p class="empty-state-text">Module not yet implemented.</p></div>`;
  }
}

// ─── Logout ────────────────────────────────────────────────────
function initLogout() {
  const modal   = document.getElementById('logoutModal');
  const btnOpen = document.getElementById('logoutBtn');
  const btnCancel  = document.getElementById('logoutCancel');
  const btnConfirm = document.getElementById('logoutConfirm');

  btnOpen.addEventListener('click', () => modal.classList.add('open'));
  btnCancel.addEventListener('click', () => modal.classList.remove('open'));
  modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('open'); });

  btnConfirm.addEventListener('click', () => {
    localStorage.removeItem('nexus_token');
    localStorage.removeItem('nexus_user');
    window.location.href = 'index.html';
  });
}

// ─── Boot ──────────────────────────────────────────────────────
(function init() {
  const raw = localStorage.getItem('nexus_user');
  if (!raw || !localStorage.getItem('nexus_token')) {
    window.location.href = 'index.html';
    return;
  }

  const user = JSON.parse(raw);
  window._nexusUser = user;   // Available globally to all modules

  buildNavbar(user);
  buildSidebar(user.role);
  initSidebarToggle();
  initLogout();

  // Land on home by default
  navigateTo('home');
})();
