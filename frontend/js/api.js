// ─────────────────────────────────────────────────────────────
//  api.js  —  Central API communication layer
//  Change BASE_URL here to point to your Spring Boot server.
// ─────────────────────────────────────────────────────────────

const BASE_URL = "http://localhost:8080/api";

// ─── Core request helper ───────────────────────────────────────
/**
 * Makes an authenticated fetch request to the backend.
 * Automatically attaches the JWT token from localStorage.
 * Throws an Error with the server's message on non-2xx responses.
 *
 * @param {string} endpoint  - e.g. "/books" or "/members/3"
 * @param {object} [options] - standard fetch options (method, body, etc.)
 * @returns {Promise<any>}   - parsed JSON response
 */
async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('nexus_token');

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers
  });

  // Session expired or unauthorised → back to login
  if (response.status === 401) {
    localStorage.removeItem('nexus_token');
    localStorage.removeItem('nexus_user');
    window.location.href = 'index.html';
    return;
  }

  // No body on 204
  if (response.status === 204) return null;

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || `Server error (${response.status})`);
  }

  return data;
}

// ─── Convenience wrappers ──────────────────────────────────────
const api = {

  // ── Auth ────────────────────────────────────────────────────
  login: (email, password) =>
    apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    }),

  // ── Library ─────────────────────────────────────────────────
  getLibrary: ()          => apiRequest('/library'),
  getInventoryReport: ()  => apiRequest('/library/report'),

  // ── Members ─────────────────────────────────────────────────
  getMembers: ()          => apiRequest('/members'),
  getMember:  (id)        => apiRequest(`/members/${id}`),
  createMember: (data)    => apiRequest('/members',      { method: 'POST',   body: JSON.stringify(data) }),
  updateMember: (id,data) => apiRequest(`/members/${id}`,{ method: 'PUT',    body: JSON.stringify(data) }),
  deleteMember: (id)      => apiRequest(`/members/${id}`,{ method: 'DELETE' }),

  // ── Librarians ───────────────────────────────────────────────
  getLibrarians: ()            => apiRequest('/librarians'),
  getLibrarian:  (id)          => apiRequest(`/librarians/${id}`),
  createLibrarian: (data)      => apiRequest('/librarians',        { method: 'POST',   body: JSON.stringify(data) }),
  updateLibrarian: (id, data)  => apiRequest(`/librarians/${id}`,  { method: 'PUT',    body: JSON.stringify(data) }),
  deleteLibrarian: (id)        => apiRequest(`/librarians/${id}`,  { method: 'DELETE' }),

  // ── Resources (generic) ──────────────────────────────────────
  getResources: ()          => apiRequest('/resources'),
  getResource:  (id)        => apiRequest(`/resources/${id}`),
  deleteResource: (id)      => apiRequest(`/resources/${id}`, { method: 'DELETE' }),
  updateResourceStatus: (id, status) =>
    apiRequest(`/resources/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  // ── Books ────────────────────────────────────────────────────
  getBooks: ()            => apiRequest('/books'),
  getBook:  (id)          => apiRequest(`/books/${id}`),
  createBook: (data)      => apiRequest('/books',       { method: 'POST',   body: JSON.stringify(data) }),
  updateBook: (id, data)  => apiRequest(`/books/${id}`, { method: 'PUT',    body: JSON.stringify(data) }),
  deleteBook: (id)        => apiRequest(`/books/${id}`, { method: 'DELETE' }),

  // ── Digital Assets ────────────────────────────────────────────
  getDigitalAssets: ()            => apiRequest('/digital-assets'),
  getDigitalAsset:  (id)          => apiRequest(`/digital-assets/${id}`),
  createDigitalAsset: (data)      => apiRequest('/digital-assets',       { method: 'POST',   body: JSON.stringify(data) }),
  updateDigitalAsset: (id, data)  => apiRequest(`/digital-assets/${id}`, { method: 'PUT',    body: JSON.stringify(data) }),
  deleteDigitalAsset: (id)        => apiRequest(`/digital-assets/${id}`, { method: 'DELETE' }),

  // ── Equipment ────────────────────────────────────────────────
  getEquipment: ()            => apiRequest('/equipment'),
  getEquipmentItem:  (id)     => apiRequest(`/equipment/${id}`),
  createEquipment: (data)     => apiRequest('/equipment',       { method: 'POST',   body: JSON.stringify(data) }),
  updateEquipment: (id, data) => apiRequest(`/equipment/${id}`, { method: 'PUT',    body: JSON.stringify(data) }),
  deleteEquipment: (id)       => apiRequest(`/equipment/${id}`, { method: 'DELETE' }),

  // ── Authors ──────────────────────────────────────────────────
  getAuthors: ()            => apiRequest('/authors'),
  getAuthor:  (id)          => apiRequest(`/authors/${id}`),
  createAuthor: (data)      => apiRequest('/authors',       { method: 'POST',   body: JSON.stringify(data) }),
  updateAuthor: (id, data)  => apiRequest(`/authors/${id}`, { method: 'PUT',    body: JSON.stringify(data) }),
  deleteAuthor: (id)        => apiRequest(`/authors/${id}`, { method: 'DELETE' }),

  // ── Transactions ─────────────────────────────────────────────
  getTransactions: ()               => apiRequest('/transactions'),
  getTransaction:  (id)             => apiRequest(`/transactions/${id}`),
  getMemberTransactions: (memberId) => apiRequest(`/members/${memberId}/transactions`),
  createTransaction: (data)         => apiRequest('/transactions',       { method: 'POST',   body: JSON.stringify(data) }),
  completeTransaction: (id)         => apiRequest(`/transactions/${id}/complete`, { method: 'PATCH' }),
  calculateFine: (id)               => apiRequest(`/transactions/${id}/fine`,     { method: 'GET' }),

  // ── Reservations ─────────────────────────────────────────────
  getReservations: ()               => apiRequest('/reservations'),
  getReservation:  (id)             => apiRequest(`/reservations/${id}`),
  getMemberReservations: (memberId) => apiRequest(`/members/${memberId}/reservations`),
  createReservation: (data)         => apiRequest('/reservations',              { method: 'POST',   body: JSON.stringify(data) }),
  confirmReservation: (id)          => apiRequest(`/reservations/${id}/confirm`,{ method: 'PATCH' }),
  cancelReservation:  (id)          => apiRequest(`/reservations/${id}/cancel`, { method: 'PATCH' }),

  // ── Fines ────────────────────────────────────────────────────
  getFines: ()               => apiRequest('/fines'),
  getFine:  (id)             => apiRequest(`/fines/${id}`),
  getMemberFines: (memberId) => apiRequest(`/members/${memberId}/fines`),
  markFinePaid: (id)         => apiRequest(`/fines/${id}/pay`,  { method: 'PATCH' }),
  calculatePenalty: (id)     => apiRequest(`/fines/${id}/penalty`, { method: 'GET' }),

  // ── Recommendations ───────────────────────────────────────────
  getRecommendations: (memberId) => apiRequest(`/recommendations/${memberId}`),

  // ── Reports ───────────────────────────────────────────────────
  getReport: () => apiRequest('/reports'),

  // ── Admin Analytics ───────────────────────────────────────────
  getAnalytics: () => apiRequest('/admin/analytics'),
};
