// ─────────────────────────────────────────────────────────────
//  authors.js  —  Authors module
//  Entry point: window.loadAuthorsModule(user, container)
//
//  ADMIN:     browse + view details + written books
//  LIBRARIAN: full CRUD (add, edit, delete)
//  MEMBER:    browse + view details + written books
// ─────────────────────────────────────────────────────────────

// ─── State ────────────────────────────────────────────────────
let _allAuthors2 = [];   // suffix avoids collision with books.js _allAuthors
let _authorUser  = null;

// ─── Helpers ──────────────────────────────────────────────────
function escAu(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

function initials(name) {
  return (name ?? '—')
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

// Deterministic pastel colour from name string
function avatarColor(name) {
  const colors = [
    { bg: '#e8f0e8', text: '#2d4a2d' },
    { bg: '#fdf3d0', text: '#7a5c00' },
    { bg: '#f3ebe0', text: '#5c3d1e' },
    { bg: '#e8edf5', text: '#2a3f6b' },
    { bg: '#fdecea', text: '#8b3a1a' },
    { bg: '#f0e8f0', text: '#4a2a6b' },
  ];
  let hash = 0;
  for (let i = 0; i < (name ?? '').length; i++) hash += name.charCodeAt(i);
  return colors[hash % colors.length];
}

// ─── Filter ───────────────────────────────────────────────────
function filterAuthors(query, natFilter) {
  const q = query.toLowerCase();
  return _allAuthors2.filter(a => {
    const matchQ = !q
      || (a.name        ?? '').toLowerCase().includes(q)
      || (a.nationality ?? '').toLowerCase().includes(q)
      || (a.biography   ?? '').toLowerCase().includes(q);
    const matchN = !natFilter
      || (a.nationality ?? '').toLowerCase() === natFilter.toLowerCase();
    return matchQ && matchN;
  });
}

// ─── Re-render ────────────────────────────────────────────────
function rerenderAuthors() {
  const query  = document.getElementById('authorSearch')?.value  ?? '';
  const nat    = document.getElementById('authorNatFilter')?.value ?? '';
  const items  = filterAuthors(query, nat);
  const list   = document.getElementById('authorList');
  if (!list) return;
  list.innerHTML = renderAuthorGrid(items);
  document.getElementById('authorCount').textContent =
    `${items.length} author${items.length !== 1 ? 's' : ''}`;

  // Populate nationality filter dynamically (unique values)
  const natSelect = document.getElementById('authorNatFilter');
  const current   = natSelect.value;
  const nats      = [...new Set(
    _allAuthors2.map(a => a.nationality).filter(Boolean)
  )].sort();
  natSelect.innerHTML =
    `<option value="">All Nationalities</option>` +
    nats.map(n => `<option value="${escAu(n)}"
      ${n === current ? 'selected' : ''}>${escAu(n)}</option>`).join('');
}

// ─── Author card (used by all roles) ─────────────────────────
function buildAuthorCard(author, role) {
  const color    = avatarColor(author.name);
  const ini      = initials(author.name);
  const bookCount= Array.isArray(author.writtenBooks)
    ? author.writtenBooks.length : (author.bookCount ?? 0);
  const canEdit  = role === 'LIBRARIAN';
  const bio      = author.biography ?? '';
  const bioShort = bio.length > 120 ? bio.slice(0, 117) + '…' : bio;

  return `
    <div style="
      background:var(--cream);
      border:1px solid var(--parchment-dark);
      border-radius:8px;
      padding:22px;
      display:flex;
      flex-direction:column;
      gap:10px;
      box-shadow:var(--shadow-sm);
      transition:box-shadow 0.2s,transform 0.2s;
      animation:cardIn 0.3s ease both;
    "
    onmouseover="this.style.boxShadow='var(--shadow-md)';this.style.transform='translateY(-2px)'"
    onmouseout="this.style.boxShadow='var(--shadow-sm)';this.style.transform='none'">

      <!-- Avatar + name -->
      <div style="display:flex;align-items:center;gap:14px">
        <div style="
          width:52px;height:52px;border-radius:50%;flex-shrink:0;
          background:${color.bg};color:${color.text};
          font-family:'Playfair Display',serif;font-size:20px;font-weight:700;
          display:flex;align-items:center;justify-content:center;
          border:2px solid ${color.text}22;
        ">${ini}</div>
        <div style="flex:1;min-width:0">
          <div style="
            font-family:'Playfair Display',serif;
            font-size:17px;font-weight:700;color:var(--ink);
            white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
          ">${escAu(author.name)}</div>
          <div style="
            font-family:'DM Mono',monospace;font-size:11px;
            color:var(--ink-muted);letter-spacing:0.08em;margin-top:2px;
          ">${escAu(author.nationality ?? '—')}</div>
        </div>
      </div>

      <!-- Bio -->
      ${bioShort
        ? `<p style="
            font-size:14px;color:var(--ink-muted);font-style:italic;
            line-height:1.5;margin:0;
           ">${escAu(bioShort)}</p>`
        : `<p style="font-size:13px;color:var(--ink-muted);font-style:italic;margin:0">
             No biography available.
           </p>`}

      <!-- Book count -->
      <div style="
        display:flex;align-items:center;gap:6px;
        font-family:'DM Mono',monospace;font-size:11px;
        color:var(--brown);letter-spacing:0.08em;
      ">
        <span>📚</span>
        <span>${bookCount} book${bookCount !== 1 ? 's' : ''} in catalogue</span>
      </div>

      <!-- Actions -->
      <div style="display:flex;gap:8px;margin-top:4px">
        <button class="btn-secondary"
          style="flex:1;font-size:14px;padding:8px"
          onclick="openAuthorDetail(${author.authorId})">
          View Profile
        </button>
        ${canEdit ? `
          <button class="btn-icon" title="Edit"
            onclick="openAuthorModal(${author.authorId})">✏️</button>
          <button class="btn-icon danger" title="Delete"
            onclick="deleteAuthor(${author.authorId},'${escAu(author.name)}')">🗑️</button>
        ` : ''}
      </div>
    </div>
  `;
}

function renderAuthorGrid(authors) {
  if (!authors.length) return `
    <div class="empty-state" style="padding:60px">
      <span class="empty-state-icon">✒️</span>
      <p class="empty-state-text">No authors found</p>
    </div>`;
  return `
    <div style="
      display:grid;
      grid-template-columns:repeat(auto-fill,minmax(260px,1fr));
      gap:20px;
    ">${authors.map(a => buildAuthorCard(a, _authorUser?.role)).join('')}</div>`;
}

// ─── Add / Edit modal ─────────────────────────────────────────
window.openAuthorModal = function(authorId = null) {
  const author  = authorId ? _allAuthors2.find(a => a.authorId === authorId) : null;
  const isEdit  = !!author;

  document.getElementById('authorModalTitle').textContent =
    isEdit ? 'Edit Author' : 'Add Author';

  const f = document.getElementById('authorForm');
  f.querySelector('[name=name]').value        = author?.name        ?? '';
  f.querySelector('[name=nationality]').value = author?.nationality ?? '';
  f.querySelector('[name=biography]').value   = author?.biography   ?? '';
  f.dataset.authorId = authorId ?? '';

  document.getElementById('authorModal').classList.add('open');
};

window.closeAuthorModal = function() {
  document.getElementById('authorModal').classList.remove('open');
};

window.submitAuthorForm = async function() {
  const f        = document.getElementById('authorForm');
  const authorId = f.dataset.authorId ? parseInt(f.dataset.authorId) : null;

  const payload = {
    name:        f.querySelector('[name=name]').value.trim(),
    nationality: f.querySelector('[name=nationality]').value.trim(),
    biography:   f.querySelector('[name=biography]').value.trim(),
  };

  if (!payload.name) { showToast('Name is required.', 'error'); return; }

  const btn = document.getElementById('authorSaveBtn');
  btn.disabled = true; btn.textContent = 'Saving…';

  try {
    if (authorId) {
      const updated = await api.updateAuthor(authorId, payload);
      const idx = _allAuthors2.findIndex(a => a.authorId === authorId);
      if (idx !== -1) _allAuthors2[idx] = { ..._allAuthors2[idx], ...updated };
      showToast('Author updated.', 'success');
    } else {
      const created = await api.createAuthor(payload);
      _allAuthors2.unshift(created);
      showToast('Author added.', 'success');
    }
    closeAuthorModal();
    rerenderAuthors();
  } catch (err) {
    showToast(err.message || 'Failed to save author.', 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Save Author';
  }
};

// ─── Delete ───────────────────────────────────────────────────
window.deleteAuthor = function(authorId, name) {
  const modal = document.getElementById('authorConfirmModal');
  document.getElementById('authorConfirmMsg').textContent =
    `Remove "${name}" from the system? Their books will remain in the catalogue.`;
  modal.classList.add('open');

  document.getElementById('authorConfirmOk').onclick = async () => {
    modal.classList.remove('open');
    try {
      await api.deleteAuthor(authorId);
      _allAuthors2 = _allAuthors2.filter(a => a.authorId !== authorId);
      showToast('Author removed.', 'success');
      rerenderAuthors();
    } catch (err) {
      showToast(err.message || 'Failed to delete author.', 'error');
    }
  };
};

// ─── Detail / Profile modal ───────────────────────────────────
window.openAuthorDetail = function(authorId) {
  const a = _allAuthors2.find(x => x.authorId === authorId);
  if (!a) return;

  const color    = avatarColor(a.name);
  const ini      = initials(a.name);
  const books    = Array.isArray(a.writtenBooks) ? a.writtenBooks : [];

  document.getElementById('authorDetailBody').innerHTML = `

    <!-- Profile header -->
    <div style="display:flex;align-items:center;gap:18px;margin-bottom:24px">
      <div style="
        width:64px;height:64px;border-radius:50%;flex-shrink:0;
        background:${color.bg};color:${color.text};
        font-family:'Playfair Display',serif;font-size:24px;font-weight:700;
        display:flex;align-items:center;justify-content:center;
        border:2px solid ${color.text}33;
      ">${ini}</div>
      <div>
        <div style="
          font-family:'Playfair Display',serif;
          font-size:22px;font-weight:700;color:var(--ink);
        ">${escAu(a.name)}</div>
        <div style="
          font-family:'DM Mono',monospace;font-size:12px;
          color:var(--ink-muted);letter-spacing:0.1em;margin-top:3px;
        ">
          ${escAu(a.nationality ?? 'Nationality unknown')}
          &nbsp;·&nbsp; Author #${a.authorId}
        </div>
      </div>
    </div>

    <!-- Biography -->
    <div style="margin-bottom:24px">
      <div style="
        font-family:'DM Mono',monospace;font-size:10px;
        letter-spacing:0.18em;text-transform:uppercase;
        color:var(--brown);margin-bottom:8px;
      ">Biography</div>
      <p style="
        font-size:15px;color:var(--ink-light);
        line-height:1.7;font-style:italic;
      ">${escAu(a.biography) || '<em style="color:var(--ink-muted)">No biography on record.</em>'}</p>
    </div>

    <!-- Written books -->
    <div>
      <div style="
        font-family:'DM Mono',monospace;font-size:10px;
        letter-spacing:0.18em;text-transform:uppercase;
        color:var(--brown);margin-bottom:10px;
      ">Books in Catalogue (${books.length})</div>
      ${books.length
        ? `<div style="display:flex;flex-direction:column;gap:8px">
            ${books.map(b => `
              <div style="
                display:flex;align-items:center;gap:12px;
                padding:10px 14px;
                background:var(--cream-dark);
                border:1px solid var(--parchment-dark);
                border-radius:6px;
              ">
                <span style="font-size:20px">📖</span>
                <div style="flex:1;min-width:0">
                  <div style="
                    font-family:'Playfair Display',serif;
                    font-weight:600;color:var(--ink);
                    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
                  ">${escAu(b.title ?? '—')}</div>
                  <div style="
                    font-family:'DM Mono',monospace;font-size:11px;
                    color:var(--ink-muted);letter-spacing:0.05em;margin-top:2px;
                  ">
                    ${b.ISBN ? `ISBN: ${escAu(b.ISBN)}` : ''}
                    ${b.publicationYear ? ` · ${b.publicationYear}` : ''}
                    ${b.publisher ? ` · ${escAu(b.publisher)}` : ''}
                  </div>
                </div>
                <span class="badge badge-${(b.status??'available').toLowerCase()}">
                  ${escAu(b.status ?? 'Unknown')}
                </span>
              </div>
            `).join('')}
          </div>`
        : `<div class="empty-state" style="padding:24px">
            <span class="empty-state-icon">📚</span>
            <p class="empty-state-text">No books linked yet</p>
          </div>`
      }
    </div>
  `;

  document.getElementById('authorDetailModal').classList.add('open');
};

window.closeAuthorDetail = function() {
  document.getElementById('authorDetailModal').classList.remove('open');
};

// ─── Main entry ───────────────────────────────────────────────
window.loadAuthorsModule = async function(user, container) {
  _authorUser = user;
  const role    = user.role;
  const canEdit = role === 'LIBRARIAN';

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">✒️ Authors</h1>
        <p class="page-subtitle">
          ${canEdit
            ? 'Manage authors and their catalogue entries.'
            : 'Browse author profiles and their written works.'}
        </p>
      </div>
      <div class="page-actions">
        ${canEdit
          ? `<button class="btn-primary" onclick="openAuthorModal()">＋ Add Author</button>`
          : ''}
      </div>
    </div>

    <div class="page-body">

      <!-- Toolbar -->
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:20px">
        <div class="search-bar" style="max-width:300px;flex:1">
          <input type="text" id="authorSearch"
            placeholder="Search by name, nationality, biography…"
            oninput="rerenderAuthors()"/>
        </div>
        <select id="authorNatFilter" onchange="rerenderAuthors()" style="
          padding:9px 12px;font-family:'EB Garamond',serif;font-size:15px;
          border:1.5px solid var(--parchment-dark);border-radius:var(--radius);
          background:var(--cream);color:var(--ink);outline:none;cursor:pointer;
        ">
          <option value="">All Nationalities</option>
        </select>
        <span id="authorCount" style="
          font-family:'DM Mono',monospace;font-size:12px;
          color:var(--ink-muted);letter-spacing:0.08em;white-space:nowrap;
        ">— authors</span>
      </div>

      <!-- Author grid -->
      <div id="authorList">
        <div class="loading-state">
          <span class="spinner"></span><span>Loading authors…</span>
        </div>
      </div>
    </div>

    <!-- ── Add / Edit Modal ───────────────────────────────── -->
    <div class="modal-overlay" id="authorModal">
      <div class="modal-box" style="width:500px">
        <h2 class="modal-title" id="authorModalTitle">Add Author</h2>
        <form id="authorForm" onsubmit="return false">
          <div class="form-grid">
            <div class="form-field full">
              <label>Full Name *</label>
              <input type="text" name="name"
                placeholder="e.g. Gabriel García Márquez"/>
            </div>
            <div class="form-field full">
              <label>Nationality</label>
              <input type="text" name="nationality"
                placeholder="e.g. Colombian"/>
            </div>
            <div class="form-field full">
              <label>Biography</label>
              <textarea name="biography" rows="5"
                placeholder="Brief biography of the author…"></textarea>
            </div>
          </div>
          <div class="modal-actions">
            <button class="btn-secondary" type="button"
              onclick="closeAuthorModal()">Cancel</button>
            <button class="btn-primary" type="button" id="authorSaveBtn"
              onclick="submitAuthorForm()">Save Author</button>
          </div>
        </form>
      </div>
    </div>

    <!-- ── Profile / Detail Modal ─────────────────────────── -->
    <div class="modal-overlay" id="authorDetailModal">
      <div class="modal-box" style="width:580px">
        <div id="authorDetailBody"></div>
        <div class="modal-actions" style="margin-top:16px">
          <button class="btn-secondary" onclick="closeAuthorDetail()">Close</button>
        </div>
      </div>
    </div>

    <!-- ── Confirm Delete Modal ───────────────────────────── -->
    <div class="modal-overlay" id="authorConfirmModal">
      <div class="modal-box" style="width:440px">
        <p class="modal-title">Confirm Removal</p>
        <p class="modal-body" id="authorConfirmMsg"></p>
        <div class="modal-actions">
          <button class="btn-secondary"
            onclick="document.getElementById('authorConfirmModal').classList.remove('open')">
            Cancel
          </button>
          <button class="btn-danger" id="authorConfirmOk">Remove</button>
        </div>
      </div>
    </div>
  `;

  // Close modals on overlay click
  ['authorModal','authorDetailModal','authorConfirmModal'].forEach(id => {
    document.getElementById(id).addEventListener('click', function(e) {
      if (e.target === this) this.classList.remove('open');
    });
  });

  // Fetch
  try {
    const result = await api.getAuthors();
    _allAuthors2 = Array.isArray(result) ? result : [];
  } catch {
    _allAuthors2 = [];
  }

  rerenderAuthors();
};

window.rerenderAuthors = rerenderAuthors;
