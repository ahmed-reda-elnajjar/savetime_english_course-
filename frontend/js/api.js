/* ===== Save Time API Client ===== */
const API_BASE = '/api';

const api = {
  token: () => localStorage.getItem('edu_token'),

  headers(extra = {}) {
    const h = { 'Content-Type': 'application/json', ...extra };
    const t = this.token();
    if (t) h['Authorization'] = `Bearer ${t}`;
    return h;
  },

  async request(method, path, body, opts = {}) {
    try {
      const res = await fetch(API_BASE + path, {
        method,
        headers: opts.multipart ? { Authorization: `Bearer ${this.token()}` } : this.headers(),
        body: opts.multipart ? body : (body ? JSON.stringify(body) : undefined),
        signal: opts.signal
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Error ${res.status}`);
      return data;
    } catch (err) {
      if (err.name === 'AbortError') return;
      throw err;
    }
  },

  get: (path, opts) => api.request('GET', path, null, opts),
  post: (path, body, opts) => api.request('POST', path, body, opts),
  put: (path, body, opts) => api.request('PUT', path, body, opts),
  delete: (path, opts) => api.request('DELETE', path, null, opts),

  postForm(path, formData) {
    return api.request('POST', path, formData, { multipart: true });
  },
  putForm(path, formData) {
    return api.request('PUT', path, formData, { multipart: true });
  },

  // Auth
  auth: {
    login: (e, p) => api.post('/auth/login', { email: e, password: p }),
    register: (d) => api.post('/auth/register', d),
    me: () => api.get('/auth/me'),
    updateProfile: (d) => api.put('/auth/profile', d),
    changePassword: (d) => api.put('/auth/change-password', typeof d === 'object' ? d : { currentPassword: d, newPassword: arguments[1] }),
  },

  // Courses
  courses: {
    list: (q = {}) => api.get('/courses?' + new URLSearchParams(q)),
    get: (slug) => api.get('/courses/' + slug),
    categories: () => api.get('/courses/categories'),
    create: (d) => (d instanceof FormData ? api.postForm('/courses', d) : api.post('/courses', d)),
    update: (id, d) => (d instanceof FormData ? api.putForm('/courses/' + id, d) : api.put('/courses/' + id, d)),
    delete: (id) => api.delete('/courses/' + id),
    addLesson: (id, d) => api.post(`/courses/${id}/lessons`, d),
    uploadVideo: (id, fd) => api.postForm(`/courses/${id}/videos`, fd),
    videos: (id) => api.get(`/courses/id/${id}/videos`),
  },

  // Enrollments
  enrollments: {
    my: () => api.get('/enrollments/my'),
    enroll: (courseId) => api.post('/enrollments', { course_id: courseId }),
    updateProgress: (id, d) => api.put(`/enrollments/${id}/progress`, d),
    all: (q = {}) => api.get('/enrollments/all?' + new URLSearchParams(q)),
  },

  // Testimonials
  testimonials: {
    list: (q = {}) => api.get('/testimonials?' + new URLSearchParams(q)),
    featured: () => api.get('/testimonials?featured=true&limit=6'),
    allAdmin: () => api.get('/testimonials/admin/all'),
    create: (d) => api.post('/testimonials', d),
    submit: (d) => api.post('/testimonials', d),
    update: (id, d) => api.put('/testimonials/' + id, d),
    delete: (id) => api.delete('/testimonials/' + id),
  },

  // Contact
  contacts: {
    send: (d) => api.post('/contacts', d),
    list: (q = {}) => api.get('/contacts?' + new URLSearchParams(q)),
    updateStatus: (id, status) => api.put(`/contacts/${id}/status`, { status }),
    delete: (id) => api.delete('/contacts/' + id),
  },

  // Admin
  admin: {
    analytics: () => api.get('/admin/analytics'),
    users: (q = {}) => api.get('/admin/users?' + new URLSearchParams(q)),
    updateUser: (id, d) => api.put('/admin/users/' + id, d),
    deleteUser: (id) => api.delete('/admin/users/' + id),
    settings: () => api.get('/admin/settings'),
    saveSettings: (d) => api.put('/admin/settings', d),
    updateSettings: (d) => api.put('/admin/settings', d),
    pricing: () => api.get('/admin/pricing'),
    createPlan: (d) => api.post('/admin/pricing', d),
    createPricing: (d) => api.post('/admin/pricing', d),
    updatePlan: (id, d) => api.put('/admin/pricing/' + id, d),
    updatePricing: (id, d) => api.put('/admin/pricing/' + id, d),
    deletePlan: (id) => api.delete('/admin/pricing/' + id),
    deletePricing: (id) => api.delete('/admin/pricing/' + id),
    videos: () => api.get('/admin/videos'),
    deleteVideo: (id) => api.delete('/admin/videos/' + id),
    testimonials: () => api.get('/testimonials/admin/all'),
    approveTestimonial: (id) => api.put('/testimonials/' + id, { is_approved: 1 }),
    deleteTestimonial: (id) => api.delete('/testimonials/' + id),
    messages: () => api.get('/contacts'),
  },

  // Videos
  videos: {
    lesson: (id) => api.get('/videos/lesson/' + id),
    upload: (fd) => api.postForm('/videos', fd),
    update: (id, d) => api.put('/videos/' + id, d),
    delete: (id) => api.delete('/videos/' + id),
    streamUrl: (id) => `/api/videos/stream/${id}` + (api.token() ? `?token=${api.token()}` : ''),
  },

  // Public
  settings: {
    get: () => api.get('/settings'),
  },
  pricing: {
    list: () => api.get('/pricing'),
  },
};

// ===== Auth Store =====
const auth = {
  user: null,
  isLoggedIn: () => !!localStorage.getItem('edu_token'),
  getUser: () => { try { return JSON.parse(localStorage.getItem('edu_user')); } catch { return null; } },
  isAdmin: () => auth.getUser()?.role === 'admin',

  setSession(token, user) {
    localStorage.setItem('edu_token', token);
    localStorage.setItem('edu_user', JSON.stringify(user));
  },

  clearSession() {
    localStorage.removeItem('edu_token');
    localStorage.removeItem('edu_user');
  },

  logout() {
    this.clearSession();
    window.location.href = '/index.html';
  }
};

// ===== Toast Notifications =====
function showToast(message, type = 'success', duration = 4000) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type] || '•'}</span><span class="toast-msg">${message}</span><button class="toast-close" onclick="this.parentElement.remove()">×</button>`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(100%)'; toast.style.transition = '0.3s'; setTimeout(() => toast.remove(), 300); }, duration);
}

// ===== Theme =====
const theme = {
  get: () => localStorage.getItem('edu_theme') || 'light',
  set(t) { localStorage.setItem('edu_theme', t); document.documentElement.setAttribute('data-theme', t); this.updateIcon(); },
  toggle() { this.set(this.get() === 'dark' ? 'light' : 'dark'); },
  init() { this.set(this.get()); },
  updateIcon() {
    const t = this.get();
    document.querySelectorAll('.theme-icon').forEach(el => el.textContent = t === 'dark' ? '☀' : '🌙');
  }
};

// ===== AOS (Animate On Scroll) =====
function initAOS() {
  const els = document.querySelectorAll('[data-aos]');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('aos-animate'); observer.unobserve(e.target); } });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
  els.forEach(el => observer.observe(el));
}

// ===== Counter Animation =====
function animateCounter(el, target, duration = 2000) {
  const start = performance.now();
  const startVal = 0;
  const update = (time) => {
    const elapsed = time - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(startVal + (target - startVal) * eased).toLocaleString();
    if (progress < 1) requestAnimationFrame(update);
  };
  requestAnimationFrame(update);
}

function initCounters() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        const target = parseInt(e.target.dataset.count);
        if (!isNaN(target)) animateCounter(e.target, target);
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.5 });
  document.querySelectorAll('[data-count]').forEach(el => observer.observe(el));
}

// ===== Stars render =====
function renderStars(rating, max = 5) {
  return Array.from({ length: max }, (_, i) => `<span style="color:${i < rating ? '#f59e0b' : '#e2e8f0'}">★</span>`).join('');
}

// ===== Date format =====
function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function timeAgo(ts) {
  const seconds = Math.floor(Date.now() / 1000 - ts);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return formatDate(ts);
}

// Init on load
document.addEventListener('DOMContentLoaded', () => {
  theme.init();
  initAOS();
  initCounters();
});
