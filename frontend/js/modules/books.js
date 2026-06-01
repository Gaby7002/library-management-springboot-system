// ─────────────────────────────────────────────────────────────
//  books.js  —  Books module
//  Entry point: window.loadBooksModule(user, container)
//
//  ADMIN:     browse + view details
//  LIBRARIAN: full CRUD (add, edit, delete) + status update
//  MEMBER:    browse, borrow, reserve
// ─────────────────────────────────────────────────────────────

// ─── State ────────────────────────────────────────────────────
let _allBooks   = [];
let _allAuthors = [];
let _booksUser  = null;

// ─── Helpers ──────────────────────────────────────────────────
function escHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

function statusBadgeB(status) {
  const map = {
    Available: 'available', Borrowed: 'borrowed',
    Reserved:  'reserved',  Lost:     'lost',
  };
  return `<span class="badge badge-${map[status] ?? 'available'}">${escHtml(status)}</span>`;
}

function authorNames(book) {
  if (Array.isArray(book.authors) && book.authors.length)
    return book.authors.map(a => escHtml(a.name)).join(', ');
  return book.authorNames ?? book.author ?? '—';
}

// ─── Search / filter ──────────────────────────────────────────
function filterBooks(query, statusFilter) {
  const q = query.toLowerCase();
  return _allBooks.filter(b => {
    const matchQ = !q
      || (b.title   ?? '').toLowerCase().includes(q)
      || authorNames(b).toLowerCase().includes(q)
      || (b.ISBN    ?? '').toLowerCase().includes(q)
      || (b.category ?? '').toLowerCase().includes(q);
    const matchS = !statusFilter || b.status === statusFilter;
    return matchQ && matchS;
  });
}

// ─── Table row (Admin / Librarian) ────────────────────────────
function buildRow(book, role) {
  const actions = role === 'LIBRARIAN'
    ? `<div class="td-actions">
        <button class="btn-icon" title="Edit"   onclick="openBookModal(${book.resourceId})">✏️</button>
        <button class="btn-icon danger" title="Delete" onclick="deleteBook(${book.resourceId}, '${escHtml(book.title)}')">🗑️</button>
       </div>`
    : `<div class="td-actions">
        <button class="btn-icon" title="Details" onclick="openBookDetail(${book.resourceId})">👁️</button>
       </div>`;

  return `
    <tr data-id="${book.resourceId}">
      <td><strong>${escHtml(book.title)}</strong></td>
      <td>${authorNames(book)}</td>
      <td><code style="font-size:12px">${escHtml(book.ISBN ?? '—')}</code></td>
      <td>${escHtml(book.publisher ?? '—')}</td>
      <td>${escHtml(book.category ?? '—')}</td>
      <td>${book.publicationYear ?? '—'}</td>
      <td>${statusBadgeB(book.status)}</td>
      <td>${actions}</td>
    </tr>
  `;
}

// ─── Member card ──────────────────────────────────────────────
function buildMemberCard(book) {
  const available = book.status === 'Available';
  const reserved  = book.status === 'Reserved';
  return `
    <div class="book-card" data-id="${book.resourceId}" style="
      background: var(--cream);
      border: 1px solid var(--parchment-dark);
      border-radius: 8px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      box-shadow: var(--shadow-sm);
      transition: box-shadow 0.2s, transform 0.2s;
      animation: cardIn 0.3s ease both;
    " onmouseover="this.style.boxShadow='var(--shadow-md)';this.style.transform='translateY(-2px)'"
       onmouseout="this.style.boxShadow='var(--shadow-sm)';this.style.transform='none'">

      <div style="font-size:32px;text-align:center;padding:8px 0">📖</div>

      <div style="
        font-family:'Playfair Display',serif;
        font-size:16px;
        font-weight:700;
        color:var(--ink);
        line-height:1.3;
      ">${escHtml(book.title)}</div>

      <div style="font-size:14px;color:var(--ink-muted);font-style:italic">
        ${authorNames(book)}
      </div>

      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px">
        ${statusBadgeB(book.status)}
        ${book.category ? `<span class="badge" style="background:var(--parchment);color:var(--ink-muted)">${escHtml(book.category)}</span>` : ''}
      </div>

      <div style="
        font-family:'DM Mono',monospace;
        font-size:11px;
        color:var(--ink-muted);
        letter-spacing:0.05em;
        margin-top:2px;
      ">
        ${book.ISBN ? `ISBN: ${escHtml(book.ISBN)}` : ''}
        ${book.publicationYear ? ` · ${book.publicationYear}` : ''}
      </div>

      <div style="display:flex;gap:8px;margin-top:8px">
        ${available
          ? `<button class="btn-primary" style="flex:1;font-size:14px;padding:8px"
               onclick="borrowBook(${book.resourceId}, '${escHtml(book.title)}')">
               Borrow
             </button>`
          : reserved || book.status === 'Borrowed'
          ? `<button class="btn-secondary" style="flex:1;font-size:14px;padding:8px"
               onclick="reserveBook(${book.resourceId}, '${escHtml(book.title)}')">
               Reserve
             </button>`
          : `<button class="btn-secondary" style="flex:1;font-size:14px;padding:8px" disabled>
               Unavailable
             </button>`
        }
        <button class="btn-icon" title="Details"
          onclick="openBookDetail(${book.resourceId})">👁️</button>
      </div>
    </div>
  `;
}

// ─── Render table (Admin / Librarian) ─────────────────────────
function renderTable(books, role) {
  if (!books.length) {
    return `<div class="empty-state" style="padding:60px">
      <span class="empty-state-icon">📚</span>
      <p class="empty-state-text">No books found</p>
    </div>`;
  }
  return `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Title</th><th>Author(s)</th><th>ISBN</th><th>Publisher</th>
            <th>Category</th><th>Year</th><th>Status</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>${books.map(b => buildRow(b, role)).join('')}</tbody>
      </table>
    </div>
  `;
}

// ─── Render grid (Member) ─────────────────────────────────────
function renderGrid(books) {
  if (!books.length) {
    return `<div class="empty-state" style="padding:60px">
      <span class="empty-state-icon">📚</span>
      <p class="empty-state-text">No books found</p>
    </div>`;
  }
  return `
    <div style="
      display:grid;
      grid-template-columns:repeat(auto-fill,minmax(220px,1fr));
      gap:20px;
    ">${books.map(buildMemberCard).join('')}</div>
  `;
}

// ─── Re-render list area only ─────────────────────────────────
function rerenderList() {
  const query  = document.getElementById('bookSearch')?.value ?? '';
  const status = document.getElementById('bookStatusFilter')?.value ?? '';
  const books  = filterBooks(query, status);
  const list   = document.getElementById('bookList');
  if (!list) return;
  const role = _booksUser?.role;
  list.innerHTML = role === 'MEMBER' ? renderGrid(books) : renderTable(books, role);
  document.getElementById('bookCount').textContent = `${books.length} book${books.length !== 1 ? 's' : ''}`;
}

// ─── Add / Edit modal (Librarian) ─────────────────────────────
window.openBookModal = function(bookId = null) {
  const book     = bookId ? _allBooks.find(b => b.resourceId === bookId) : null;
  const isEdit   = !!book;
  const title    = isEdit ? 'Edit Book' : 'Add New Book';

  // Build author options
  const authorOptions = _allAuthors.map(a =>
    `<option value="${a.authorId}"
      ${book?.authors?.some(ba => ba.authorId === a.authorId) ? 'selected' : ''}>
      ${escHtml(a.name)}
    </option>`
  ).join('');

  const overlay = document.getElementById('bookModal');
  document.getElementById('bookModalTitle').textContent = title;

  const f = document.getElementById('bookForm');
  f.querySelector('[name=title]').value         = book?.title         ?? '';
  f.querySelector('[name=ISBN]').value          = book?.ISBN          ?? '';
  f.querySelector('[name=publisher]').value     = book?.publisher     ?? '';
  f.querySelector('[name=edition]').value       = book?.edition       ?? '';
  f.querySelector('[name=pageCount]').value     = book?.pageCount     ?? '';
  f.querySelector('[name=category]').value      = book?.category      ?? '';
  f.querySelector('[name=location]').value      = book?.location      ?? '';
  f.querySelector('[name=publicationYear]').value = book?.publicationYear ?? '';
  f.querySelector('[name=status]').value        = book?.status        ?? 'Available';

  // Authors select
  const sel = f.querySelector('[name=authorIds]');
  sel.innerHTML = authorOptions || '<option disabled>No authors in system</option>';

  f.dataset.bookId = bookId ?? '';
  overlay.classList.add('open');
};

window.closeBookModal = function() {
  document.getElementById('bookModal').classList.remove('open');
};

async function submitBookForm() {
  const f      = document.getElementById('bookForm');
  const bookId = f.dataset.bookId ? parseInt(f.dataset.bookId) : null;
  const sel    = f.querySelector('[name=authorIds]');
  const authorIds = Array.from(sel.selectedOptions).map(o => parseInt(o.value));

  const payload = {
    title:           f.querySelector('[name=title]').value.trim(),
    ISBN:            f.querySelector('[name=ISBN]').value.trim(),
    publisher:       f.querySelector('[name=publisher]').value.trim(),
    edition:         f.querySelector('[name=edition]').value.trim(),
    pageCount:       parseInt(f.querySelector('[name=pageCount]').value) || null,
    category:        f.querySelector('[name=category]').value.trim(),
    location:        f.querySelector('[name=location]').value.trim(),
    publicationYear: parseInt(f.querySelector('[name=publicationYear]').value) || null,
    status:          f.querySelector('[name=status]').value,
    authorIds,
  };

  if (!payload.title) { showToast('Title is required.', 'error'); return; }

  const saveBtn = document.getElementById('bookSaveBtn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving…';

  try {
    if (bookId) {
      const updated = await api.updateBook(bookId, payload);
      const idx = _allBooks.findIndex(b => b.resourceId === bookId);
      if (idx !== -1) _allBooks[idx] = updated;
      showToast('Book updated successfully.', 'success');
    } else {
      const created = await api.createBook(payload);
      _allBooks.unshift(created);
      showToast('Book added successfully.', 'success');
    }
    closeBookModal();
    rerenderList();
  } catch (err) {
    showToast(err.message || 'Failed to save book.', 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Book';
  }
}

// ─── Delete (Librarian) ───────────────────────────────────────
window.deleteBook = function(bookId, title) {
  const modal = document.getElementById('confirmModal');
  document.getElementById('confirmMsg').textContent =
    `Are you sure you want to remove "${title}" from the catalogue?`;
  modal.classList.add('open');

  document.getElementById('confirmOk').onclick = async () => {
    modal.classList.remove('open');
    try {
      await api.deleteBook(bookId);
      _allBooks = _allBooks.filter(b => b.resourceId !== bookId);
      showToast('Book removed.', 'success');
      rerenderList();
    } catch (err) {
      showToast(err.message || 'Failed to delete book.', 'error');
    }
  };
};

// ─── Detail modal ─────────────────────────────────────────────
window.openBookDetail = function(bookId) {
  const book = _allBooks.find(b => b.resourceId === bookId);
  if (!book) return;

  document.getElementById('detailModalTitle').textContent = book.title;
  document.getElementById('detailModalBody').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;font-size:15px">
      ${[
        ['Title',            book.title],
        ['Author(s)',        authorNames(book)],
        ['ISBN',             book.ISBN],
        ['Publisher',        book.publisher],
        ['Edition',          book.edition],
        ['Page Count',       book.pageCount],
        ['Category',         book.category],
        ['Location',         book.location],
        ['Publication Year', book.publicationYear],
        ['Status',           `<span class="badge badge-${(book.status??'').toLowerCase()}">${book.status}</span>`],
      ].map(([label, val]) => `
        <div>
          <div style="font-family:'DM Mono',monospace;font-size:10px;
            letter-spacing:0.12em;text-transform:uppercase;color:var(--brown);margin-bottom:4px">
            ${label}
          </div>
          <div style="color:var(--ink)">${val ?? '—'}</div>
        </div>
      `).join('')}
    </div>
  `;
  document.getElementById('detailModal').classList.add('open');
};

window.closeDetailModal = function() {
  document.getElementById('detailModal').classList.remove('open');
};

// ─── Borrow (Member) ──────────────────────────────────────────
window.borrowBook = async function(bookId, title) {
  try {
    await api.createTransaction({ memberId: _booksUser.id, resourceId: bookId });
    const b = _allBooks.find(b => b.resourceId === bookId);
    if (b) b.status = 'Borrowed';
    showToast(`"${title}" borrowed successfully!`, 'success');
    rerenderList();
  } catch (err) {
    showToast(err.message || 'Failed to borrow book.', 'error');
  }
};

// ─── Reserve (Member) ─────────────────────────────────────────
window.reserveBook = async function(bookId, title) {
  try {
    await api.createReservation({ memberId: _booksUser.id, resourceId: bookId });
    const b = _allBooks.find(b => b.resourceId === bookId);
    if (b) b.status = 'Reserved';
    showToast(`"${title}" reserved successfully!`, 'success');
    rerenderList();
  } catch (err) {
    showToast(err.message || 'Failed to reserve book.', 'error');
  }
};

// ─── Main entry ───────────────────────────────────────────────
window.loadBooksModule = async function(user, container) {
  _booksUser = user;
  const role = user.role;
  const canEdit = role === 'LIBRARIAN';

  // Page shell
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">📚 Books</h1>
        <p class="page-subtitle">
          ${role === 'MEMBER'
            ? 'Browse the catalogue and borrow or reserve books.'
            : 'Manage the book catalogue.'}
        </p>
      </div>
      <div class="page-actions">
        ${canEdit
          ? `<button class="btn-primary" onclick="openBookModal()">＋ Add Book</button>`
          : ''}
      </div>
    </div>

    <div class="page-body">

      <!-- Toolbar -->
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:20px">
        <div class="search-bar" style="max-width:300px;flex:1">
          <input type="text" id="bookSearch" placeholder="Search by title, author, ISBN…"
            oninput="rerenderList()"/>
        </div>
        <select id="bookStatusFilter" onchange="rerenderList()" style="
          padding:9px 12px;
          font-family:'EB Garamond',serif;
          font-size:15px;
          border:1.5px solid var(--parchment-dark);
          border-radius:var(--radius);
          background:var(--cream);
          color:var(--ink);
          outline:none;
          cursor:pointer;
        ">
          <option value="">All Statuses</option>
          <option value="Available">Available</option>
          <option value="Borrowed">Borrowed</option>
          <option value="Reserved">Reserved</option>
          <option value="Lost">Lost</option>
        </select>
        <span id="bookCount" style="
          font-family:'DM Mono',monospace;
          font-size:12px;
          color:var(--ink-muted);
          letter-spacing:0.08em;
          white-space:nowrap;
        ">— books</span>
      </div>

      <!-- Book list -->
      <div id="bookList">
        <div class="loading-state">
          <span class="spinner"></span><span>Loading books…</span>
        </div>
      </div>

    </div>

    <!-- ── Add/Edit Modal (Librarian only) ───────────────── -->
    <div class="modal-overlay" id="bookModal">
      <div class="modal-box" style="width:580px">
        <h2 class="modal-title" id="bookModalTitle">Add New Book</h2>
        <form id="bookForm" onsubmit="return false">
          <div class="form-grid">
            <div class="form-field full">
              <label>Title *</label>
              <input type="text" name="title" placeholder="e.g. Introduction to Algorithms"/>
            </div>
            <div class="form-field">
              <label>ISBN</label>
              <input type="text" name="ISBN" placeholder="978-3-16-148410-0"/>
            </div>
            <div class="form-field">
              <label>Publisher</label>
              <input type="text" name="publisher" placeholder="MIT Press"/>
            </div>
            <div class="form-field">
              <label>Edition</label>
              <input type="text" name="edition" placeholder="3rd"/>
            </div>
            <div class="form-field">
              <label>Page Count</label>
              <input type="number" name="pageCount" placeholder="512" min="1"/>
            </div>
            <div class="form-field">
              <label>Category</label>
              <input type="text" name="category" placeholder="Computer Science"/>
            </div>
            <div class="form-field">
              <label>Location / Shelf</label>
              <input type="text" name="location" placeholder="Shelf A-3"/>
            </div>
            <div class="form-field">
              <label>Publication Year</label>
              <input type="number" name="publicationYear" placeholder="2022" min="1000" max="2099"/>
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
            <div class="form-field full">
              <label>Author(s) — hold Ctrl / Cmd to select multiple</label>
              <select name="authorIds" multiple style="height:100px">
              </select>
            </div>
          </div>
          <div class="modal-actions">
            <button class="btn-secondary" type="button" onclick="closeBookModal()">Cancel</button>
            <button class="btn-primary"   type="button" id="bookSaveBtn"
              onclick="submitBookForm()">Save Book</button>
          </div>
        </form>
      </div>
    </div>

    <!-- ── Detail Modal ───────────────────────────────────── -->
    <div class="modal-overlay" id="detailModal">
      <div class="modal-box" style="width:540px">
        <h2 class="modal-title" id="detailModalTitle"></h2>
        <div id="detailModalBody" style="margin-top:16px"></div>
        <div class="modal-actions">
          <button class="btn-secondary" onclick="closeDetailModal()">Close</button>
        </div>
      </div>
    </div>

    <!-- ── Confirm Delete Modal ───────────────────────────── -->
    <div class="modal-overlay" id="confirmModal">
      <div class="modal-box" style="width:420px">
        <p class="modal-title">Confirm Removal</p>
        <p class="modal-body" id="confirmMsg"></p>
        <div class="modal-actions">
          <button class="btn-secondary" onclick="document.getElementById('confirmModal').classList.remove('open')">
            Cancel
          </button>
          <button class="btn-danger" id="confirmOk">Remove</button>
        </div>
      </div>
    </div>
  `;

  // Close modals on overlay click
  ['bookModal','detailModal','confirmModal'].forEach(id => {
    document.getElementById(id).addEventListener('click', function(e) {
      if (e.target === this) this.classList.remove('open');
    });
  });

  // Fetch books and authors in parallel
  try {
    const [books, authors] = await Promise.allSettled([
      api.getBooks(),
      api.getAuthors(),
    ]);
    _allBooks   = books.status   === 'fulfilled' && Array.isArray(books.value)   ? books.value   : [];
    _allAuthors = authors.status === 'fulfilled' && Array.isArray(authors.value) ? authors.value : [];
  } catch {
    _allBooks   = [];
    _allAuthors = [];
  }

  rerenderList();
};

// Expose rerenderList globally (called from inline oninput/onchange)
window.rerenderList    = rerenderList;
window.submitBookForm  = submitBookForm;
