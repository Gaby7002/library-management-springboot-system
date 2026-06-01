// ─────────────────────────────────────────────────────────────
//  members.js  —  Members module
//  Entry point: window.loadMembersModule(user, container)
//
//  ADMIN:     full CRUD + membership status management
//  LIBRARIAN: browse all members + view borrow history
//  MEMBER:    view & edit own profile only
// ─────────────────────────────────────────────────────────────

// ─── State ────────────────────────────────────────────────────
let _allMembers = [];
let _memberUser = null;

// ─── Helpers ──────────────────────────────────────────────────
function escM(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

function membershipBadge(status) {
  const map = { Active: 'active', Suspended: 'suspended', Expired: 'expired' };
  return `<span class="badge badge-${map[status] ?? 'active'}">${escM(status ?? '—')}</span>`;
}

function borrowBar(total, limit) {
  const pct = limit > 0 ? Math.min(100, Math.round((total / limit) * 100)) : 0;
  const color = pct >= 90 ? 'var(--rust)' : pct >= 60 ? 'var(--gold)' : 'var(--green)';
  return `
    <div style="display:flex;align-items:center;gap:8px">
      <div style="
        flex:1;height:6px;background:var(--parchment-dark);border-radius:4px;overflow:hidden;
      ">
        <div style="
          width:${pct}%;height:100%;background:${color};
          border-radius:4px;transition:width 0.4s ease;
        "></div>
      </div>
      <span style="
        font-family:'DM Mono',monospace;font-size:11px;
        color:var(--ink-muted);white-space:nowrap;
      ">${total} / ${limit}</span>
    </div>`;
}

function memberInitials(name) {
  return (name ?? '—').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function memberAvatarColor(name) {
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

function formatDate(ds) {
  if (!ds) return '—';
  return new Date(ds).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

// ─── Filter ───────────────────────────────────────────────────
function filterMembers(query, statusFilter) {
  const q = query.toLowerCase();
  return _allMembers.filter(m => {
    const matchQ = !q
      || (m.name  ?? '').toLowerCase().includes(q)
      || (m.email ?? '').toLowerCase().includes(q)
      || (m.phone ?? '').toLowerCase().includes(q)
      || String(m.membershipId ?? '').includes(q);
    const matchS = !statusFilter || m.membershipStatus === statusFilter;
    return matchQ && matchS;
  });
}

// ─── Re-render (Admin / Librarian table) ──────────────────────
function rerenderMembers() {
  const query  = document.getElementById('memberSearch')?.value  ?? '';
  const status = document.getElementById('memberStatusFilter')?.value ?? '';
  const items  = filterMembers(query, status);
  const list   = document.getElementById('memberList');
  if (!list) return;
  list.innerHTML = renderMemberTable(items);
  document.getElementById('memberCount').textContent =
    `${items.length} member${items.length !== 1 ? 's' : ''}`;
}

// ─── Table (Admin / Librarian) ────────────────────────────────
function buildMemberRow(m, role) {
  const color = memberAvatarColor(m.name);
  const ini   = memberInitials(m.name);
  const canEdit = role === 'ADMIN';

  const actions = canEdit
    ? `<div class="td-actions">
        <button class="btn-icon" title="View Profile"
          onclick="openMemberDetail(${m.membershipId})">👁️</button>
        <button class="btn-icon" title="Edit"
          onclick="openMemberModal(${m.membershipId})">✏️</button>
        <button class="btn-icon danger" title="Delete"
          onclick="deleteMember(${m.membershipId},'${escM(m.name)}')">🗑️</button>
       </div>`
    : `<div class="td-actions">
        <button class="btn-icon" title="View Profile"
          onclick="openMemberDetail(${m.membershipId})">👁️</button>
       </div>`;

  return `
    <tr data-id="${m.membershipId}">
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <div style="
            width:32px;height:32px;border-radius:50%;flex-shrink:0;
            background:${color.bg};color:${color.text};
            font-family:'Playfair Display',serif;font-size:12px;font-weight:700;
            display:flex;align-items:center;justify-content:center;
          ">${ini}</div>
          <div>
            <div style="font-weight:600;color:var(--ink)">${escM(m.name)}</div>
            <div style="font-size:12px;color:var(--ink-muted)">${escM(m.email ?? '—')}</div>
          </div>
        </div>
      </td>
      <td><code style="font-size:12px">#${m.membershipId ?? '—'}</code></td>
      <td>${membershipBadge(m.membershipStatus)}</td>
      <td style="min-width:140px">${borrowBar(m.totalBorrowed ?? 0, m.borrowLimit ?? 0)}</td>
      <td>${escM(m.phone ?? '—')}</td>
      <td>${escM(m.address ?? '—')}</td>
      <td>${actions}</td>
    </tr>`;
}

function renderMemberTable(members) {
  if (!members.length) return `
    <div class="empty-state" style="padding:60px">
      <span class="empty-state-icon">👥</span>
      <p class="empty-state-text">No members found</p>
    </div>`;
  return `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Member</th><th>ID</th><th>Status</th>
            <th>Borrowed / Limit</th><th>Phone</th><th>Address</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>${members.map(m => buildMemberRow(m, _memberUser?.role)).join('')}</tbody>
      </table>
    </div>`;
}

// ─── Own profile view (Member role) ───────────────────────────
function renderOwnProfile(m) {
  const color = memberAvatarColor(m.name);
  const ini   = memberInitials(m.name);
  const transactions = Array.isArray(m.borrowHistory) ? m.borrowHistory : [];
  const reservations = Array.isArray(m.activeReservations) ? m.activeReservations : [];

  return `
    <div style="max-width:680px;margin:0 auto;display:flex;flex-direction:column;gap:24px">

      <!-- Profile card -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">My Profile</span>
          <button class="btn-secondary" style="font-size:14px;padding:7px 16px"
            onclick="openMemberModal(${m.membershipId})">✏️ Edit Profile</button>
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
              ">${escM(m.name)}</div>
              <div style="
                font-family:'DM Mono',monospace;font-size:12px;
                color:var(--ink-muted);letter-spacing:0.08em;margin-top:4px;
              ">${escM(m.email ?? '—')} &nbsp;·&nbsp; Member #${m.membershipId}</div>
              <div style="margin-top:8px">${membershipBadge(m.membershipStatus)}</div>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
            ${[
              ['Phone',   m.phone],
              ['Address', m.address],
              ['Borrow Limit', m.borrowLimit],
              ['Currently Borrowed', m.totalBorrowed],
            ].map(([label, val]) => `
              <div>
                <div style="font-family:'DM Mono',monospace;font-size:10px;
                  letter-spacing:0.14em;text-transform:uppercase;
                  color:var(--brown);margin-bottom:4px">${label}</div>
                <div style="color:var(--ink);font-size:15px">${escM(val) || '—'}</div>
              </div>`).join('')}
          </div>
          <div style="margin-top:20px">
            <div style="font-family:'DM Mono',monospace;font-size:10px;
              letter-spacing:0.14em;text-transform:uppercase;
              color:var(--brown);margin-bottom:8px">Borrow Usage</div>
            ${borrowBar(m.totalBorrowed ?? 0, m.borrowLimit ?? 0)}
          </div>
        </div>
      </div>

      <!-- Recent borrows -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">📋 Recent Borrowings (${transactions.length})</span>
        </div>
        ${transactions.length
          ? `<div class="table-wrapper"><table>
              <thead><tr>
                <th>Resource</th><th>Borrowed</th><th>Due</th>
                <th>Returned</th><th>Status</th>
              </tr></thead>
              <tbody>
                ${transactions.slice(0, 8).map(t => `
                  <tr>
                    <td>${escM(t.resourceTitle ?? '—')}</td>
                    <td>${formatDate(t.borrowDate)}</td>
                    <td>${formatDate(t.dueDate)}</td>
                    <td>${t.returnDate
                      ? formatDate(t.returnDate)
                      : '<em style="color:var(--ink-muted)">Pending</em>'}</td>
                    <td><span class="badge badge-${(t.transactionStatus??'').toLowerCase()}">
                      ${escM(t.transactionStatus ?? '—')}
                    </span></td>
                  </tr>`).join('')}
              </tbody>
            </table></div>`
          : `<div class="empty-state" style="padding:32px">
              <span class="empty-state-icon">📋</span>
              <p class="empty-state-text">No borrowing history yet</p>
             </div>`}
      </div>

      <!-- Active reservations -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">🔖 Active Reservations (${reservations.length})</span>
        </div>
        ${reservations.length
          ? `<div class="table-wrapper"><table>
              <thead><tr>
                <th>Resource</th><th>Requested</th>
                <th>Expires</th><th>Queue</th><th>Status</th>
              </tr></thead>
              <tbody>
                ${reservations.map(r => `
                  <tr>
                    <td>${escM(r.resourceTitle ?? '—')}</td>
                    <td>${formatDate(r.requestDate)}</td>
                    <td>${formatDate(r.expiryDate)}</td>
                    <td>#${r.queuePosition ?? '—'}</td>
                    <td><span class="badge badge-${(r.status??'').toLowerCase()}">
                      ${escM(r.status ?? '—')}
                    </span></td>
                  </tr>`).join('')}
              </tbody>
            </table></div>`
          : `<div class="empty-state" style="padding:32px">
              <span class="empty-state-icon">🔖</span>
              <p class="empty-state-text">No active reservations</p>
             </div>`}
      </div>
    </div>`;
}

// ─── Add / Edit modal ─────────────────────────────────────────
window.openMemberModal = function(membershipId = null) {
  const m      = membershipId ? _allMembers.find(x => x.membershipId === membershipId) : null;
  const isEdit = !!m;
  const isAdmin = _memberUser?.role === 'ADMIN';

  document.getElementById('memberModalTitle').textContent =
    isEdit ? 'Edit Member' : 'Add Member';

  const f = document.getElementById('memberForm');
  f.querySelector('[name=name]').value        = m?.name        ?? '';
  f.querySelector('[name=email]').value       = m?.email       ?? '';
  f.querySelector('[name=phone]').value       = m?.phone       ?? '';
  f.querySelector('[name=address]').value     = m?.address     ?? '';
  f.querySelector('[name=borrowLimit]').value = m?.borrowLimit ?? 5;

  // Password only shown on create
  const pwField = document.getElementById('memberPwField');
  pwField.style.display = isEdit ? 'none' : 'block';

  // Status only editable by Admin
  const statusField = document.getElementById('memberStatusField');
  statusField.style.display = isAdmin ? 'block' : 'none';
  if (isAdmin) f.querySelector('[name=membershipStatus]').value = m?.membershipStatus ?? 'Active';

  f.dataset.membershipId = membershipId ?? '';
  document.getElementById('memberModal').classList.add('open');
};

window.closeMemberModal = function() {
  document.getElementById('memberModal').classList.remove('open');
};

window.submitMemberForm = async function() {
  const f    = document.getElementById('memberForm');
  const mid  = f.dataset.membershipId ? parseInt(f.dataset.membershipId) : null;
  const isAdmin = _memberUser?.role === 'ADMIN';

  const payload = {
    name:             f.querySelector('[name=name]').value.trim(),
    email:            f.querySelector('[name=email]').value.trim(),
    phone:            f.querySelector('[name=phone]').value.trim(),
    address:          f.querySelector('[name=address]').value.trim(),
    borrowLimit:      parseInt(f.querySelector('[name=borrowLimit]').value) || 5,
    ...(isAdmin && { membershipStatus: f.querySelector('[name=membershipStatus]').value }),
    ...(!mid && { password: f.querySelector('[name=password]')?.value ?? '' }),
  };

  if (!payload.name)  { showToast('Name is required.',  'error'); return; }
  if (!payload.email) { showToast('Email is required.', 'error'); return; }

  const btn = document.getElementById('memberSaveBtn');
  btn.disabled = true; btn.textContent = 'Saving…';

  try {
    if (mid) {
      const updated = await api.updateMember(mid, payload);
      const idx = _allMembers.findIndex(x => x.membershipId === mid);
      if (idx !== -1) _allMembers[idx] = { ..._allMembers[idx], ...updated };
      showToast('Member updated.', 'success');
    } else {
      const created = await api.createMember(payload);
      _allMembers.unshift(created);
      showToast('Member added.', 'success');
    }
    closeMemberModal();
    if (_memberUser.role === 'MEMBER') {
      // Reload own profile
      loadMembersModule(_memberUser, document.getElementById('mainContent'));
    } else {
      rerenderMembers();
    }
  } catch (err) {
    showToast(err.message || 'Failed to save member.', 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Save';
  }
};

// ─── Delete (Admin only) ──────────────────────────────────────
window.deleteMember = function(membershipId, name) {
  const modal = document.getElementById('memberConfirmModal');
  document.getElementById('memberConfirmMsg').textContent =
    `Permanently remove "${name}" from the system? This cannot be undone.`;
  modal.classList.add('open');

  document.getElementById('memberConfirmOk').onclick = async () => {
    modal.classList.remove('open');
    try {
      await api.deleteMember(membershipId);
      _allMembers = _allMembers.filter(x => x.membershipId !== membershipId);
      showToast('Member removed.', 'success');
      rerenderMembers();
    } catch (err) {
      showToast(err.message || 'Failed to delete member.', 'error');
    }
  };
};

// ─── Detail modal (Admin / Librarian) ────────────────────────
window.openMemberDetail = function(membershipId) {
  const m = _allMembers.find(x => x.membershipId === membershipId);
  if (!m) return;

  const color = memberAvatarColor(m.name);
  const ini   = memberInitials(m.name);
  const transactions = Array.isArray(m.borrowHistory) ? m.borrowHistory : [];

  document.getElementById('memberDetailBody').innerHTML = `
    <!-- Header -->
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
          font-weight:700;color:var(--ink)">${escM(m.name)}</div>
        <div style="font-family:'DM Mono',monospace;font-size:11px;
          color:var(--ink-muted);letter-spacing:0.08em;margin-top:3px">
          ${escM(m.email ?? '—')} &nbsp;·&nbsp; Member #${m.membershipId}
        </div>
        <div style="margin-top:6px">${membershipBadge(m.membershipStatus)}</div>
      </div>
    </div>

    <!-- Fields grid -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;
      margin-bottom:20px;font-size:15px">
      ${[
        ['Phone',    m.phone],
        ['Address',  m.address],
        ['Borrow Limit',   m.borrowLimit],
        ['Total Borrowed', m.totalBorrowed],
      ].map(([label, val]) => `
        <div>
          <div style="font-family:'DM Mono',monospace;font-size:10px;
            letter-spacing:0.14em;text-transform:uppercase;
            color:var(--brown);margin-bottom:4px">${label}</div>
          <div style="color:var(--ink)">${escM(val) || '—'}</div>
        </div>`).join('')}
    </div>

    <!-- Borrow bar -->
    <div style="margin-bottom:20px">
      <div style="font-family:'DM Mono',monospace;font-size:10px;
        letter-spacing:0.14em;text-transform:uppercase;
        color:var(--brown);margin-bottom:8px">Borrow Usage</div>
      ${borrowBar(m.totalBorrowed ?? 0, m.borrowLimit ?? 0)}
    </div>

    <!-- Borrow history -->
    <div style="font-family:'DM Mono',monospace;font-size:10px;
      letter-spacing:0.18em;text-transform:uppercase;
      color:var(--brown);margin-bottom:10px">
      Borrow History (${transactions.length})
    </div>
    ${transactions.length
      ? `<div class="table-wrapper"><table>
          <thead><tr>
            <th>Resource</th><th>Borrowed</th><th>Due</th><th>Status</th>
          </tr></thead>
          <tbody>
            ${transactions.slice(0, 6).map(t => `
              <tr>
                <td>${escM(t.resourceTitle ?? '—')}</td>
                <td>${formatDate(t.borrowDate)}</td>
                <td>${formatDate(t.dueDate)}</td>
                <td><span class="badge badge-${(t.transactionStatus??'').toLowerCase()}">
                  ${escM(t.transactionStatus ?? '—')}
                </span></td>
              </tr>`).join('')}
          </tbody>
        </table></div>`
      : `<div class="empty-state" style="padding:24px">
          <span class="empty-state-icon">📋</span>
          <p class="empty-state-text">No borrowing history</p>
         </div>`}
  `;

  document.getElementById('memberDetailModal').classList.add('open');
};

window.closeMemberDetail = function() {
  document.getElementById('memberDetailModal').classList.remove('open');
};

// ─── Main entry ───────────────────────────────────────────────
window.loadMembersModule = async function(user, container) {
  _memberUser = user;
  const role    = user.role;
  const isAdmin = role === 'ADMIN';
  const isMember = role === 'MEMBER';

  // Member: fetch own profile and render it directly
  if (isMember) {
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">👤 My Profile</h1>
          <p class="page-subtitle">Your membership details and activity.</p>
        </div>
      </div>
      <div class="page-body">
        <div class="loading-state">
          <span class="spinner"></span><span>Loading your profile…</span>
        </div>
      </div>`;

    try {
      const m = await api.getMember(user.id);
      _allMembers = [m];
      container.querySelector('.page-body').innerHTML = renderOwnProfile(m);
    } catch (err) {
      container.querySelector('.page-body').innerHTML = `
        <div class="empty-state"><p class="empty-state-text">
          Could not load profile. ${err.message}
        </p></div>`;
    }

    // Attach modal for profile editing
    container.insertAdjacentHTML('beforeend', memberModalHTML(false));
    document.getElementById('memberModal').addEventListener('click', function(e) {
      if (e.target === this) this.classList.remove('open');
    });
    return;
  }

  // Admin / Librarian: full list view
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">👥 Members</h1>
        <p class="page-subtitle">
          ${isAdmin
            ? 'Manage all library members and their accounts.'
            : 'Browse members and view borrowing activity.'}
        </p>
      </div>
      <div class="page-actions">
        ${isAdmin
          ? `<button class="btn-primary" onclick="openMemberModal()">＋ Add Member</button>`
          : ''}
      </div>
    </div>

    <div class="page-body">

      <!-- Toolbar -->
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:20px">
        <div class="search-bar" style="max-width:300px;flex:1">
          <input type="text" id="memberSearch"
            placeholder="Search by name, email, phone, ID…"
            oninput="rerenderMembers()"/>
        </div>
        <select id="memberStatusFilter" onchange="rerenderMembers()" style="
          padding:9px 12px;font-family:'EB Garamond',serif;font-size:15px;
          border:1.5px solid var(--parchment-dark);border-radius:var(--radius);
          background:var(--cream);color:var(--ink);outline:none;cursor:pointer;
        ">
          <option value="">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Suspended">Suspended</option>
          <option value="Expired">Expired</option>
        </select>
        <span id="memberCount" style="
          font-family:'DM Mono',monospace;font-size:12px;
          color:var(--ink-muted);letter-spacing:0.08em;white-space:nowrap;
        ">— members</span>
      </div>

      <!-- Member table -->
      <div id="memberList">
        <div class="loading-state">
          <span class="spinner"></span><span>Loading members…</span>
        </div>
      </div>
    </div>

    ${memberModalHTML(isAdmin)}

    <!-- ── Detail Modal ───────────────────────────────────── -->
    <div class="modal-overlay" id="memberDetailModal">
      <div class="modal-box" style="width:600px">
        <div id="memberDetailBody"></div>
        <div class="modal-actions" style="margin-top:16px">
          ${isAdmin ? `<button class="btn-secondary"
            onclick="openMemberModal(parseInt(document.querySelector('[data-id]')?.dataset.id));
              closeMemberDetail()">
            ✏️ Edit
          </button>` : ''}
          <button class="btn-secondary" onclick="closeMemberDetail()">Close</button>
        </div>
      </div>
    </div>

    <!-- ── Confirm Delete ─────────────────────────────────── -->
    <div class="modal-overlay" id="memberConfirmModal">
      <div class="modal-box" style="width:440px">
        <p class="modal-title">Confirm Removal</p>
        <p class="modal-body" id="memberConfirmMsg"></p>
        <div class="modal-actions">
          <button class="btn-secondary"
            onclick="document.getElementById('memberConfirmModal').classList.remove('open')">
            Cancel
          </button>
          <button class="btn-danger" id="memberConfirmOk">Remove</button>
        </div>
      </div>
    </div>
  `;

  // Close on overlay click
  ['memberModal','memberDetailModal','memberConfirmModal'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', function(e) {
      if (e.target === this) this.classList.remove('open');
    });
  });

  // Fetch members
  try {
    const result = await api.getMembers();
    _allMembers = Array.isArray(result) ? result : [];
  } catch {
    _allMembers = [];
  }

  rerenderMembers();
};

// ─── Shared modal HTML ────────────────────────────────────────
function memberModalHTML(isAdmin) {
  return `
    <div class="modal-overlay" id="memberModal">
      <div class="modal-box" style="width:540px">
        <h2 class="modal-title" id="memberModalTitle">Add Member</h2>
        <form id="memberForm" onsubmit="return false">
          <div class="form-grid">
            <div class="form-field full">
              <label>Full Name *</label>
              <input type="text" name="name" placeholder="e.g. Jane Doe"/>
            </div>
            <div class="form-field">
              <label>Email *</label>
              <input type="email" name="email" placeholder="jane@library.edu"/>
            </div>
            <div class="form-field">
              <label>Phone</label>
              <input type="tel" name="phone" placeholder="+237 6XX XXX XXX"/>
            </div>
            <div class="form-field full">
              <label>Address</label>
              <input type="text" name="address" placeholder="e.g. Molyko, Buea"/>
            </div>
            <div class="form-field">
              <label>Borrow Limit</label>
              <input type="number" name="borrowLimit" value="5" min="1" max="20"/>
            </div>
            ${isAdmin ? `
            <div class="form-field" id="memberStatusField">
              <label>Membership Status</label>
              <select name="membershipStatus">
                <option value="Active">Active</option>
                <option value="Suspended">Suspended</option>
                <option value="Expired">Expired</option>
              </select>
            </div>` : '<div id="memberStatusField" style="display:none"></div>'}
            <div class="form-field full" id="memberPwField">
              <label>Password (new members only)</label>
              <input type="password" name="password" placeholder="Temporary password"/>
            </div>
          </div>
          <div class="modal-actions">
            <button class="btn-secondary" type="button"
              onclick="closeMemberModal()">Cancel</button>
            <button class="btn-primary" type="button" id="memberSaveBtn"
              onclick="submitMemberForm()">Save</button>
          </div>
        </form>
      </div>
    </div>`;
}

window.rerenderMembers  = rerenderMembers;
window.loadMembersModule = window.loadMembersModule;
