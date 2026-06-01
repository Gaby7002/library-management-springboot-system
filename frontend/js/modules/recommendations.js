// ─────────────────────────────────────────────────────────────
//  recommendations.js  —  Recommendations module (Member only)
//  Entry point: window.loadRecommendationsModule(user, container)
//
//  Calls RecommendationService via GET /api/recommendations/{memberId}
//  Displays personalised resource suggestions based on borrow history.
// ─────────────────────────────────────────────────────────────

// ─── State ────────────────────────────────────────────────────
let _recData = null;
let _recUser = null;

// ─── Helpers ──────────────────────────────────────────────────
function escRec(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

function statusBadgeRec(status) {
  const map = {
    Available: 'available', Borrowed: 'borrowed',
    Reserved:  'reserved',  Lost:     'lost',
  };
  return `<span class="badge badge-${map[status] ?? 'available'}">${escRec(status ?? '—')}</span>`;
}

function resourceIcon(type) {
  const t = (type ?? '').toLowerCase();
  if (t === 'book')    return '📖';
  if (t === 'digital') return '💾';
  if (t === 'equipment') return '🖥️';
  return '📦';
}

function similarityBar(score) {
  // score expected 0–1 or 0–100; normalise to 0–100
  const pct = score > 1 ? Math.min(100, Math.round(score)) : Math.round(score * 100);
  const color = pct >= 75 ? 'var(--green)'
              : pct >= 50 ? 'var(--gold)'
              : 'var(--brown)';
  return `
    <div style="display:flex;align-items:center;gap:8px">
      <div style="
        flex:1;height:6px;background:var(--parchment-dark);
        border-radius:4px;overflow:hidden;
      ">
        <div style="
          width:${pct}%;height:100%;background:${color};
          border-radius:4px;transition:width 0.6s ease;
        "></div>
      </div>
      <span style="
        font-family:'DM Mono',monospace;font-size:11px;
        color:var(--ink-muted);white-space:nowrap;
      ">${pct}% match</span>
    </div>`;
}

// ─── Recommendation card ──────────────────────────────────────
function buildRecCard(rec, index) {
  const resource  = rec.resource ?? rec;
  const available = resource.status === 'Available';
  const score     = rec.similarityScore ?? rec.score ?? null;
  const reason    = rec.reason ?? rec.recommendationReason ?? null;
  const icon      = resourceIcon(resource.resourceType ?? resource.type);

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
      position:relative;
      overflow:hidden;
      animation:cardIn 0.35s ease both;
      animation-delay:${index * 0.07}s;
      transition:box-shadow 0.2s,transform 0.2s;
    "
    onmouseover="this.style.boxShadow='var(--shadow-md)';this.style.transform='translateY(-2px)'"
    onmouseout="this.style.boxShadow='var(--shadow-sm)';this.style.transform='none'">

      <!-- Rank badge -->
      <div style="
        position:absolute;top:14px;right:14px;
        width:28px;height:28px;border-radius:50%;
        background:var(--green);color:var(--cream);
        font-family:'DM Mono',monospace;font-size:12px;font-weight:700;
        display:flex;align-items:center;justify-content:center;
        box-shadow:0 2px 6px rgba(0,0,0,0.2);
      ">${index + 1}</div>

      <!-- Icon + title -->
      <div style="display:flex;gap:14px;align-items:flex-start;padding-right:36px">
        <div style="
          font-size:32px;flex-shrink:0;
          width:48px;height:48px;
          background:var(--parchment);
          border-radius:8px;
          display:flex;align-items:center;justify-content:center;
        ">${icon}</div>
        <div style="flex:1;min-width:0">
          <div style="
            font-family:'Playfair Display',serif;
            font-size:17px;font-weight:700;
            color:var(--ink);line-height:1.3;
          ">${escRec(resource.title ?? '—')}</div>
          <div style="
            font-size:13px;color:var(--ink-muted);
            font-style:italic;margin-top:3px;
          ">
            ${resource.category ? escRec(resource.category) : ''}
            ${resource.publicationYear ? ` · ${resource.publicationYear}` : ''}
          </div>
        </div>
      </div>

      <!-- Status + type badges -->
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${statusBadgeRec(resource.status)}
        ${resource.resourceType
          ? `<span class="badge" style="background:var(--parchment);color:var(--ink-muted)">
               ${escRec(resource.resourceType)}
             </span>`
          : ''}
      </div>

      <!-- Similarity score -->
      ${score !== null
        ? `<div>
            <div style="
              font-family:'DM Mono',monospace;font-size:10px;
              letter-spacing:0.12em;text-transform:uppercase;
              color:var(--brown);margin-bottom:5px;
            ">Similarity Score</div>
            ${similarityBar(score)}
           </div>`
        : ''}

      <!-- Reason / why recommended -->
      ${reason
        ? `<div style="
            padding:10px 14px;
            background:var(--parchment);
            border-radius:6px;
            border-left:3px solid var(--gold);
            font-size:13px;
            color:var(--ink-light);
            font-style:italic;
            line-height:1.5;
          ">
            💡 ${escRec(reason)}
          </div>`
        : ''}

      <!-- Action buttons -->
      <div style="display:flex;gap:8px;margin-top:4px">
        ${available
          ? `<button class="btn-primary"
               style="flex:1;font-size:14px;padding:8px"
               onclick="borrowRecommended(${resource.resourceId},'${escRec(resource.title)}')">
               Borrow
             </button>
             <button class="btn-secondary"
               style="font-size:14px;padding:8px"
               onclick="reserveRecommended(${resource.resourceId},'${escRec(resource.title)}')">
               🔖 Reserve
             </button>`
          : `<button class="btn-secondary"
               style="flex:1;font-size:14px;padding:8px"
               onclick="reserveRecommended(${resource.resourceId},'${escRec(resource.title)}')">
               🔖 Reserve
             </button>`
        }
      </div>
    </div>`;
}

// ─── Empty / no history state ────────────────────────────────
function buildNoHistoryState() {
  return `
    <div style="
      max-width:480px;margin:60px auto;text-align:center;
      display:flex;flex-direction:column;align-items:center;gap:16px;
    ">
      <div style="font-size:56px">📚</div>
      <div style="
        font-family:'Playfair Display',serif;
        font-size:22px;font-weight:700;color:var(--ink);
      ">No Recommendations Yet</div>
      <p style="
        font-size:15px;color:var(--ink-muted);font-style:italic;
        line-height:1.6;
      ">
        Borrow a few resources first and the system will generate personalised
        recommendations based on your reading and borrowing history.
      </p>
      <button class="btn-primary" style="padding:10px 28px;font-size:16px"
        onclick="window.navigateTo('books')">
        Browse Books
      </button>
    </div>`;
}

// ─── Render recommendations ───────────────────────────────────
function renderRecommendations(recommendations) {
  if (!Array.isArray(recommendations) || !recommendations.length) {
    return buildNoHistoryState();
  }

  return `
    <!-- Intro banner -->
    <div style="
      background:var(--green);
      background-image:linear-gradient(135deg, var(--green) 0%, #1e3a1e 100%);
      border-radius:8px;
      padding:22px 28px;
      margin-bottom:28px;
      display:flex;align-items:center;gap:18px;
      color:var(--cream);
    ">
      <div style="font-size:36px">⭐</div>
      <div>
        <div style="
          font-family:'Playfair Display',serif;
          font-size:20px;font-weight:700;margin-bottom:4px;
        ">Curated For You</div>
        <div style="
          font-family:'EB Garamond',serif;
          font-size:15px;color:rgba(245,240,232,0.75);font-style:italic;
        ">
          Based on your borrowing history and reading patterns,
          here are ${recommendations.length} resources you may enjoy.
        </div>
      </div>
    </div>

    <!-- Cards grid -->
    <div style="
      display:grid;
      grid-template-columns:repeat(auto-fill,minmax(280px,1fr));
      gap:20px;
    ">
      ${recommendations.map((rec, i) => buildRecCard(rec, i)).join('')}
    </div>

    <!-- Refresh note -->
    <div style="
      margin-top:32px;text-align:center;
      font-family:'DM Mono',monospace;font-size:11px;
      letter-spacing:0.1em;color:var(--ink-muted);
    ">
      ❧ &nbsp; Recommendations refresh automatically as your borrow history grows &nbsp; ❧
    </div>
  `;
}

// ─── Member actions ───────────────────────────────────────────
window.borrowRecommended = async function(resourceId, title) {
  try {
    await api.createTransaction({ memberId: _recUser.id, resourceId });
    showToast(`"${title}" borrowed successfully!`, 'success');
    // Re-fetch to update availability
    loadRecommendationsModule(_recUser, document.getElementById('mainContent'));
  } catch (err) {
    showToast(err.message || 'Borrow failed.', 'error');
  }
};

window.reserveRecommended = async function(resourceId, title) {
  try {
    await api.createReservation({ memberId: _recUser.id, resourceId });
    showToast(`"${title}" reserved successfully!`, 'success');
    loadRecommendationsModule(_recUser, document.getElementById('mainContent'));
  } catch (err) {
    showToast(err.message || 'Reservation failed.', 'error');
  }
};

// ─── Main entry ───────────────────────────────────────────────
window.loadRecommendationsModule = async function(user, container) {
  _recUser = user;

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">⭐ For You</h1>
        <p class="page-subtitle">
          Personalised recommendations powered by your borrowing history.
        </p>
      </div>
      <div class="page-actions">
        <button class="btn-primary" id="refreshRecBtn"
          onclick="refreshRecommendations()">
          🔄 Refresh
        </button>
      </div>
    </div>

    <div class="page-body">
      <div id="recBody">
        <div class="loading-state">
          <span class="spinner"></span>
          <span>Generating your recommendations…</span>
        </div>
      </div>
    </div>
  `;

  async function fetchAndRender() {
    const btn = document.getElementById('refreshRecBtn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Loading…'; }

    try {
      const data = await api.getRecommendations(user.id);
      _recData = Array.isArray(data) ? data
               : Array.isArray(data?.recommendations) ? data.recommendations
               : [];
      document.getElementById('recBody').innerHTML =
        renderRecommendations(_recData);
    } catch (err) {
      // If no history yet, show the friendly empty state
      document.getElementById('recBody').innerHTML =
        buildNoHistoryState();
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '🔄 Refresh'; }
    }
  }

  window.refreshRecommendations = fetchAndRender;
  await fetchAndRender();
};