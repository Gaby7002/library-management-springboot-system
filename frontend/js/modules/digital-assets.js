// ─────────────────────────────────────────────────────────────
//  digital-assets.js  —  Digital Assets module
//  Entry point: window.loadDigitalAssetsModule(user, container)
//
//  ADMIN:     browse + view details
//  LIBRARIAN: full CRUD (add, edit, delete) + status update
//  MEMBER:    browse, download, preview
// ─────────────────────────────────────────────────────────────

// ─── State ────────────────────────────────────────────────────
let _allAssets = [];
let _assetsUser = null;

// ─── Helpers ──────────────────────────────────────────────────
function escA(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

function statusBadgeA(status) {
  const map = {
    Available: 'available', Borrowed: 'borrowed',
    Reserved:  'reserved',  Lost:     'lost',
  };
  return `<span class="badge badge-${map[status] ?? 'available'}">${escA(status)}</span>`;
}

// Format icon based on file format
function formatIcon(fmt) {
  const f = (fmt ?? '').toUpperCase();
  if (f.includes('PDF'))  return '📄';
  if (f.includes('EPUB')) return '📕';
  if (f.includes('MP4') || f.includes('VIDEO')) return '🎬';
  if (f.includes('MP3') || f.includes('AUDIO')) return '🎵';
  if (f.includes('ZIP') || f.includes('RAR'))   return '🗜️';
  if (f.includes('PPT')) return '📊';
  if (f.includes('DOC') || f.includes('WORD'))  return '📝';
  return '💾';
}

function fileSizeLabel(bytes) {
  if (!bytes && bytes !== 0) return '—';
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1048576)     return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824)  return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
}

function durationLabel(days) {
  if (!days && days !== 0) return '—';
  if (days === 1)  return '1 day';
  if (days < 7)   return `${days} days`;
  if (days === 7)  return '1 week';
  if (days < 30)  return `${Math.round(days / 7)} weeks`;
  if (days === 30) return '1 month';
  return `${Math.round(days / 30)} months`;
}

// ─── Filter ───────────────────────────────────────────────────
function filterAssets(query, statusFilter, fmtFilter) {
  const q = query.toLowerCase();
  return _allAssets.filter(a => {
    const matchQ = !q
      || (a.title      ?? '').toLowerCase().includes(q)
      || (a.category   ?? '').toLowerCase().includes(q)
      || (a.fileFormat ?? '').toLowerCase().includes(q);
    const matchS = !statusFilter || a.status     === statusFilter;
    const matchF = !fmtFilter   || (a.fileFormat ?? '').toUpperCase().includes(fmtFilter);
    return matchQ && matchS && matchF;
  });
}

// ─── Re-render ────────────────────────────────────────────────
function rerenderAssets() {
  const query  = document.getElementById('assetSearch')?.value ?? '';
  const status = document.getElementById('assetStatusFilter')?.value ?? '';
  const fmt    = document.getElementById('assetFmtFilter')?.value ?? '';
  const assets = filterAssets(query, status, fmt);
  const list   = document.getElementById('assetList');
  if (!list) return;
  const role = _assetsUser?.role;
  list.innerHTML = role === 'MEMBER' ? renderAssetGrid(assets) : renderAssetTable(assets, role);
  document.getElementById('assetCount').textContent =
    `${assets.length} asset${assets.length !== 1 ? 's' : ''}`;
}

// ─── Table row (Admin / Librarian) ────────────────────────────
function buildAssetRow(asset, role) {
  const actions = role === 'LIBRARIAN'
    ? `<div class="td-actions">
        <button class="btn-icon" title="Edit"
          onclick="openAssetModal(${asset.resourceId})">✏️</button>
        <button class="btn-icon danger" title="Delete"
          onclick="deleteAsset(${asset.resourceId},'${escA(asset.title)}')">🗑️</button>
       </div>`
    : `<div class="td-actions">
        <button class="btn-icon" title="Details"
          onclick="openAssetDetail(${asset.resourceId})">👁️</button>
       </div>`;

  return `
    <tr data-id="${asset.resourceId}">
      <td>
        <span style="font-size:18px;margin-right:6px">${formatIcon(asset.fileFormat)}</span>
        <strong>${escA(asset.title)}</strong>
      </td>
      <td><code style="font-size:12px">${escA(asset.fileFormat ?? '—')}</code></td>
      <td>${fileSizeLabel(asset.fileSize)}</td>
      <td>${durationLabel(asset.accessDuration)}</td>
      <td>${escA(asset.category ?? '—')}</td>
      <td>${escA(asset.location ?? '—')}</td>
      <td>${asset.publicationYear ?? '—'}</td>
      <td>${statusBadgeA(asset.status)}</td>
      <td>${actions}</td>
    </tr>
  `;
}

function renderAssetTable(assets, role) {
  if (!assets.length) return `
    <div class="empty-state" style="padding:60px">
      <span class="empty-state-icon">💾</span>
      <p class="empty-state-text">No digital assets found</p>
    </div>`;
  return `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Title</th><th>Format</th><th>Size</th><th>Access Duration</th>
            <th>Category</th><th>Location</th><th>Year</th><th>Status</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>${assets.map(a => buildAssetRow(a, role)).join('')}</tbody>
      </table>
    </div>`;
}

// ─── Member card grid ─────────────────────────────────────────
function buildAssetCard(asset) {
  const available = asset.status === 'Available';
  const icon = formatIcon(asset.fileFormat);

  return `
    <div class="book-card" style="
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

      <div style="font-size:36px;text-align:center;padding:6px 0">${icon}</div>

      <div style="
        font-family:'Playfair Display',serif;
        font-size:16px;font-weight:700;
        color:var(--ink);line-height:1.3;
      ">${escA(asset.title)}</div>

      <div style="
        display:flex;flex-wrap:wrap;gap:6px;margin-top:2px;align-items:center
      ">
        ${statusBadgeA(asset.status)}
        <span class="badge" style="background:var(--parchment);color:var(--ink-muted)">
          ${escA(asset.fileFormat ?? '—')}
        </span>
        ${asset.category
          ? `<span class="badge" style="background:var(--parchment);color:var(--ink-muted)">
               ${escA(asset.category)}
             </span>`
          : ''}
      </div>

      <div style="
        font-family:'DM Mono',monospace;
        font-size:11px;color:var(--ink-muted);
        letter-spacing:0.05em;
        display:flex;flex-direction:column;gap:2px;
      ">
        <span>📦 ${fileSizeLabel(asset.fileSize)}</span>
        <span>⏱ Access: ${durationLabel(asset.accessDuration)}</span>
        ${asset.publicationYear ? `<span>📅 ${asset.publicationYear}</span>` : ''}
      </div>

      <div style="display:flex;gap:8px;margin-top:8px">
        ${available
          ? `<button class="btn-primary"
               style="flex:1;font-size:14px;padding:8px"
               onclick="downloadAsset(${asset.resourceId},'${escA(asset.title)}')">
               ⬇ Download
             </button>
             <button class="btn-secondary"
               style="font-size:14px;padding:8px"
               onclick="previewAsset(${asset.resourceId},'${escA(asset.title)}')">
               👁 Preview
             </button>`
          : `<button class="btn-secondary"
               style="flex:1;font-size:14px;padding:8px"
               onclick="reserveAsset(${asset.resourceId},'${escA(asset.title)}')">
               🔖 Reserve
             </button>`
        }
        <button class="btn-icon" title="Details"
          onclick="openAssetDetail(${asset.resourceId})">ℹ️</button>
      </div>
    </div>
  `;
}

function renderAssetGrid(assets) {
  if (!assets.length) return `
    <div class="empty-state" style="padding:60px">
      <span class="empty-state-icon">💾</span>
      <p class="empty-state-text">No digital assets found</p>
    </div>`;
  return `
    <div style="
      display:grid;
      grid-template-columns:repeat(auto-fill,minmax(230px,1fr));
      gap:20px;
    ">${assets.map(buildAssetCard).join('')}</div>`;
}

// ─── Add / Edit modal (Librarian) ─────────────────────────────
window.openAssetModal = function(assetId = null) {
  const asset  = assetId ? _allAssets.find(a => a.resourceId === assetId) : null;
  const isEdit = !!asset;

  document.getElementById('assetModalTitle').textContent =
    isEdit ? 'Edit Digital Asset' : 'Add Digital Asset';

  const f = document.getElementById('assetForm');
  f.querySelector('[name=title]').value           = asset?.title           ?? '';
  f.querySelector('[name=fileFormat]').value      = asset?.fileFormat      ?? '';
  f.querySelector('[name=fileSize]').value        = asset?.fileSize        ?? '';
  f.querySelector('[name=accessDuration]').value  = asset?.accessDuration  ?? '';
  f.querySelector('[name=category]').value        = asset?.category        ?? '';
  f.querySelector('[name=location]').value        = asset?.location        ?? '';
  f.querySelector('[name=publicationYear]').value = asset?.publicationYear ?? '';
  f.querySelector('[name=status]').value          = asset?.status          ?? 'Available';
  f.dataset.assetId = assetId ?? '';

  document.getElementById('assetModal').classList.add('open');
};

window.closeAssetModal = function() {
  document.getElementById('assetModal').classList.remove('open');
};

window.submitAssetForm = async function() {
  const f       = document.getElementById('assetForm');
  const assetId = f.dataset.assetId ? parseInt(f.dataset.assetId) : null;

  const payload = {
    title:           f.querySelector('[name=title]').value.trim(),
    fileFormat:      f.querySelector('[name=fileFormat]').value.trim(),
    fileSize:        parseFloat(f.querySelector('[name=fileSize]').value) || null,
    accessDuration:  parseInt(f.querySelector('[name=accessDuration]').value) || null,
    category:        f.querySelector('[name=category]').value.trim(),
    location:        f.querySelector('[name=location]').value.trim(),
    publicationYear: parseInt(f.querySelector('[name=publicationYear]').value) || null,
    status:          f.querySelector('[name=status]').value,
  };

  if (!payload.title) { showToast('Title is required.', 'error'); return; }

  const btn = document.getElementById('assetSaveBtn');
  btn.disabled = true; btn.textContent = 'Saving…';

  try {
    if (assetId) {
      const updated = await api.updateDigitalAsset(assetId, payload);
      const idx = _allAssets.findIndex(a => a.resourceId === assetId);
      if (idx !== -1) _allAssets[idx] = updated;
      showToast('Asset updated.', 'success');
    } else {
      const created = await api.createDigitalAsset(payload);
      _allAssets.unshift(created);
      showToast('Asset added.', 'success');
    }
    closeAssetModal();
    rerenderAssets();
  } catch (err) {
    showToast(err.message || 'Failed to save asset.', 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Save Asset';
  }
};

// ─── Delete (Librarian) ───────────────────────────────────────
window.deleteAsset = function(assetId, title) {
  const modal = document.getElementById('assetConfirmModal');
  document.getElementById('assetConfirmMsg').textContent =
    `Are you sure you want to remove "${title}" from the catalogue?`;
  modal.classList.add('open');

  document.getElementById('assetConfirmOk').onclick = async () => {
    modal.classList.remove('open');
    try {
      await api.deleteDigitalAsset(assetId);
      _allAssets = _allAssets.filter(a => a.resourceId !== assetId);
      showToast('Asset removed.', 'success');
      rerenderAssets();
    } catch (err) {
      showToast(err.message || 'Failed to delete asset.', 'error');
    }
  };
};

// ─── Detail modal ─────────────────────────────────────────────
window.openAssetDetail = function(assetId) {
  const a = _allAssets.find(x => x.resourceId === assetId);
  if (!a) return;
  document.getElementById('assetDetailTitle').textContent = a.title;
  document.getElementById('assetDetailBody').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;font-size:15px">
      ${[
        ['Title',           a.title],
        ['File Format',     a.fileFormat],
        ['File Size',       fileSizeLabel(a.fileSize)],
        ['Access Duration', durationLabel(a.accessDuration)],
        ['Category',        a.category],
        ['Location',        a.location],
        ['Year',            a.publicationYear],
        ['Status',          `<span class="badge badge-${(a.status??'').toLowerCase()}">${a.status}</span>`],
      ].map(([label, val]) => `
        <div>
          <div style="font-family:'DM Mono',monospace;font-size:10px;
            letter-spacing:0.12em;text-transform:uppercase;color:var(--brown);margin-bottom:4px">
            ${label}
          </div>
          <div style="color:var(--ink)">${val ?? '—'}</div>
        </div>
      `).join('')}
    </div>`;
  document.getElementById('assetDetailModal').classList.add('open');
};

window.closeAssetDetail = function() {
  document.getElementById('assetDetailModal').classList.remove('open');
};

// ─── Member actions ───────────────────────────────────────────
window.downloadAsset = async function(assetId, title) {
  try {
    await api.createTransaction({ memberId: _assetsUser.id, resourceId: assetId });
    showToast(`"${title}" is now available for download.`, 'success');
    const a = _allAssets.find(x => x.resourceId === assetId);
    if (a) a.status = 'Borrowed';
    rerenderAssets();
  } catch (err) {
    showToast(err.message || 'Download failed.', 'error');
  }
};

window.previewAsset = async function(assetId, title) {
  // Placeholder — backend can return a signed URL or stream
  showToast(`Preview for "${title}" coming soon.`, 'info');
};

window.reserveAsset = async function(assetId, title) {
  try {
    await api.createReservation({ memberId: _assetsUser.id, resourceId: assetId });
    const a = _allAssets.find(x => x.resourceId === assetId);
    if (a) a.status = 'Reserved';
    showToast(`"${title}" reserved successfully.`, 'success');
    rerenderAssets();
  } catch (err) {
    showToast(err.message || 'Reservation failed.', 'error');
  }
};

// ─── Main entry ───────────────────────────────────────────────
window.loadDigitalAssetsModule = async function(user, container) {
  _assetsUser = user;
  const role = user.role;
  const canEdit = role === 'LIBRARIAN';

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">💾 Digital Assets</h1>
        <p class="page-subtitle">
          ${role === 'MEMBER'
            ? 'Browse, download, and preview digital resources.'
            : 'Manage the digital asset catalogue.'}
        </p>
      </div>
      <div class="page-actions">
        ${canEdit ? `<button class="btn-primary" onclick="openAssetModal()">＋ Add Asset</button>` : ''}
      </div>
    </div>

    <div class="page-body">

      <!-- Toolbar -->
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:20px">
        <div class="search-bar" style="max-width:300px;flex:1">
          <input type="text" id="assetSearch" placeholder="Search by title, format, category…"
            oninput="rerenderAssets()"/>
        </div>
        <select id="assetStatusFilter" onchange="rerenderAssets()" style="
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
        <select id="assetFmtFilter" onchange="rerenderAssets()" style="
          padding:9px 12px;font-family:'EB Garamond',serif;font-size:15px;
          border:1.5px solid var(--parchment-dark);border-radius:var(--radius);
          background:var(--cream);color:var(--ink);outline:none;cursor:pointer;
        ">
          <option value="">All Formats</option>
          <option value="PDF">PDF</option>
          <option value="EPUB">EPUB</option>
          <option value="MP4">MP4 (Video)</option>
          <option value="MP3">MP3 (Audio)</option>
          <option value="PPT">PowerPoint</option>
          <option value="DOC">Word / Doc</option>
          <option value="ZIP">ZIP / Archive</option>
        </select>
        <span id="assetCount" style="
          font-family:'DM Mono',monospace;font-size:12px;
          color:var(--ink-muted);letter-spacing:0.08em;white-space:nowrap;
        ">— assets</span>
      </div>

      <!-- Asset list -->
      <div id="assetList">
        <div class="loading-state">
          <span class="spinner"></span><span>Loading assets…</span>
        </div>
      </div>
    </div>

    <!-- ── Add/Edit Modal ──────────────────────────────────── -->
    <div class="modal-overlay" id="assetModal">
      <div class="modal-box" style="width:560px">
        <h2 class="modal-title" id="assetModalTitle">Add Digital Asset</h2>
        <form id="assetForm" onsubmit="return false">
          <div class="form-grid">
            <div class="form-field full">
              <label>Title *</label>
              <input type="text" name="title" placeholder="e.g. Calculus — Early Transcendentals"/>
            </div>
            <div class="form-field">
              <label>File Format</label>
              <input type="text" name="fileFormat" placeholder="e.g. PDF, EPUB, MP4"/>
            </div>
            <div class="form-field">
              <label>File Size (bytes)</label>
              <input type="number" name="fileSize" placeholder="e.g. 5242880" min="0"/>
            </div>
            <div class="form-field">
              <label>Access Duration (days)</label>
              <input type="number" name="accessDuration" placeholder="e.g. 14" min="1"/>
            </div>
            <div class="form-field">
              <label>Category</label>
              <input type="text" name="category" placeholder="e.g. Mathematics"/>
            </div>
            <div class="form-field">
              <label>Location / Path</label>
              <input type="text" name="location" placeholder="e.g. /digital/maths/"/>
            </div>
            <div class="form-field">
              <label>Publication Year</label>
              <input type="number" name="publicationYear" placeholder="2023" min="1000" max="2099"/>
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
            <button class="btn-secondary" type="button" onclick="closeAssetModal()">Cancel</button>
            <button class="btn-primary"   type="button" id="assetSaveBtn"
              onclick="submitAssetForm()">Save Asset</button>
          </div>
        </form>
      </div>
    </div>

    <!-- ── Detail Modal ───────────────────────────────────── -->
    <div class="modal-overlay" id="assetDetailModal">
      <div class="modal-box" style="width:500px">
        <h2 class="modal-title" id="assetDetailTitle"></h2>
        <div id="assetDetailBody" style="margin-top:16px"></div>
        <div class="modal-actions">
          <button class="btn-secondary" onclick="closeAssetDetail()">Close</button>
        </div>
      </div>
    </div>

    <!-- ── Confirm Delete Modal ───────────────────────────── -->
    <div class="modal-overlay" id="assetConfirmModal">
      <div class="modal-box" style="width:420px">
        <p class="modal-title">Confirm Removal</p>
        <p class="modal-body" id="assetConfirmMsg"></p>
        <div class="modal-actions">
          <button class="btn-secondary"
            onclick="document.getElementById('assetConfirmModal').classList.remove('open')">
            Cancel
          </button>
          <button class="btn-danger" id="assetConfirmOk">Remove</button>
        </div>
      </div>
    </div>
  `;

  // Close on overlay click
  ['assetModal','assetDetailModal','assetConfirmModal'].forEach(id => {
    document.getElementById(id).addEventListener('click', function(e) {
      if (e.target === this) this.classList.remove('open');
    });
  });

  // Fetch assets
  try {
    const result = await api.getDigitalAssets();
    _allAssets = Array.isArray(result) ? result : [];
  } catch {
    _allAssets = [];
  }

  rerenderAssets();
};

window.rerenderAssets = rerenderAssets;
