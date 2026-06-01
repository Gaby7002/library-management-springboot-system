// ─── Config ───────────────────────────────────────────────────
const BASE_URL = "http://localhost:8080/api";

// ─── Decorative Book Spines ────────────────────────────────────
const spineData = [
  { h: 60, color: '#3d2b0e' }, { h: 75, color: '#2d4a2d' }, { h: 50, color: '#5c3d1e' },
  { h: 80, color: '#1e3a1e' }, { h: 65, color: '#4a2c0a' }, { h: 55, color: '#2d4a2d' },
  { h: 70, color: '#6b4423' }, { h: 85, color: '#1e2e1e' }, { h: 60, color: '#3d2b0e' },
  { h: 72, color: '#4a1e0e' }, { h: 58, color: '#2d4a2d' }, { h: 78, color: '#5c3d1e' },
  { h: 62, color: '#1e3a1e' }, { h: 68, color: '#4a2c0a' }, { h: 55, color: '#8b3a1a' },
  { h: 82, color: '#1e2e1e' }, { h: 65, color: '#3d2b0e' }, { h: 73, color: '#2d4a2d' },
  { h: 58, color: '#5c3d1e' }, { h: 80, color: '#1e3a1e' }, { h: 62, color: '#4a2c0a' },
  { h: 70, color: '#2d4a2d' }, { h: 55, color: '#6b4423' }, { h: 75, color: '#1e2e1e' },
  { h: 64, color: '#3d2b0e' }, { h: 78, color: '#5c3d1e' }, { h: 60, color: '#2d4a2d' },
  { h: 72, color: '#4a1e0e' }, { h: 85, color: '#1e3a1e' }, { h: 58, color: '#3d2b0e' },
  { h: 68, color: '#8b3a1a' }, { h: 76, color: '#2d4a2d' }, { h: 63, color: '#5c3d1e' },
  { h: 70, color: '#1e3a1e' }, { h: 55, color: '#4a2c0a' }, { h: 80, color: '#3d2b0e' },
  { h: 65, color: '#2d4a2d' }, { h: 72, color: '#6b4423' }, { h: 58, color: '#1e2e1e' },
  { h: 78, color: '#5c3d1e' }, { h: 62, color: '#3d2b0e' }, { h: 82, color: '#2d4a2d' }
];

const spineWidths = [14, 18, 12, 20, 16, 22, 15, 13, 19, 17];

function buildSpines() {
  const container = document.getElementById('spines');
  if (!container) return;
  spineData.forEach((s, i) => {
    const el = document.createElement('div');
    el.className = 'spine';
    el.style.cssText = `
      width: ${spineWidths[i % spineWidths.length]}px;
      height: ${s.h}px;
      background: ${s.color};
      animation-delay: ${(i * 0.03).toFixed(2)}s;
    `;
    container.appendChild(el);
  });
}

// ─── Toast Notification ────────────────────────────────────────
let toastTimer;

function showToast(msg, type = 'error') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast toast-${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
}

// ─── Inline Error Helpers ──────────────────────────────────────
function showError(id, visible) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.display = visible ? 'block' : 'none';
}

function validateEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// ─── Password Visibility Toggle ────────────────────────────────
/*
  We toggle between type="password" and type="text".
  The input already has identical CSS rules for both types
  in style.css, so there is no visual shift.
*/
function initPasswordToggle() {
  const input    = document.getElementById('password');
  const toggleBtn = document.getElementById('togglePw');
  if (!input || !toggleBtn) return;

  toggleBtn.addEventListener('click', () => {
    const isHidden = input.type === 'password';
    input.type = isHidden ? 'text' : 'password';
    toggleBtn.textContent = isHidden ? '🙈' : '👁';
  });
}

// ─── Login Handler ─────────────────────────────────────────────
async function handleLogin() {
  const emailInput  = document.getElementById('email');
  const pwInput     = document.getElementById('password');
  const loginBtn    = document.getElementById('loginBtn');
  const loginError  = document.getElementById('loginError');

  const email    = emailInput.value.trim();
  const password = pwInput.value;
  let valid = true;

  // Clear previous errors
  showError('emailError',    false);
  showError('passwordError', false);
  loginError.style.display = 'none';

  // Validate
  if (!validateEmail(email)) { showError('emailError', true);    valid = false; }
  if (!password)              { showError('passwordError', true); valid = false; }
  if (!valid) return;

  // Loading state
  loginBtn.disabled = true;
  loginBtn.innerHTML = '<span class="spinner"></span> Signing in…';

  try {
    const response = await fetch(`${BASE_URL}/auth/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Invalid credentials. Please try again.');
    }

    // Persist auth token and user profile
    // Expected response shape: { token, id, name, email, role }
    // role is one of: "ADMIN" | "LIBRARIAN" | "MEMBER"
    localStorage.setItem('nexus_token', data.token);
    localStorage.setItem('nexus_user', JSON.stringify({
      id:    data.id,
      name:  data.name,
      email: data.email,
      role:  data.role
    }));

    showToast('Welcome back! Redirecting…', 'success');
    setTimeout(() => { window.location.href = 'dashboard.html'; }, 800);

  } catch (err) {
    loginBtn.disabled = false;
    loginBtn.innerHTML = 'Enter the Library';
    loginError.textContent = err.message;
    loginError.style.display = 'block';
    showToast(err.message, 'error');
  }
}

// ─── Initialise ────────────────────────────────────────────────
(function init() {
  // Already authenticated → skip login
  if (localStorage.getItem('nexus_token')) {
    window.location.href = 'dashboard.html';
    return;
  }

  buildSpines();
  initPasswordToggle();

  // Wire up login button and Enter key
  document.getElementById('loginBtn')
    .addEventListener('click', handleLogin);

  ['email', 'password'].forEach(id => {
    document.getElementById(id)
      .addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });
  });
})();
