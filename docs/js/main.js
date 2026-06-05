/* ===== EduConsult Main JS ===== */
document.addEventListener('DOMContentLoaded', () => {

  // ===== NAVBAR =====
  const navbar = document.querySelector('.navbar');
  const hamburger = document.querySelector('.hamburger');
  const navMenu = document.querySelector('.nav-menu');

  if (navbar) {
    window.addEventListener('scroll', () => {
      navbar.classList.toggle('scrolled', window.scrollY > 20);
    });
  }

  if (hamburger && navMenu) {
    hamburger.addEventListener('click', () => {
      navMenu.classList.toggle('open');
      const spans = hamburger.querySelectorAll('span');
      const isOpen = navMenu.classList.contains('open');
      spans[0].style.transform = isOpen ? 'rotate(45deg) translate(5px,5px)' : '';
      spans[1].style.opacity = isOpen ? '0' : '1';
      spans[2].style.transform = isOpen ? 'rotate(-45deg) translate(5px,-5px)' : '';
    });
    document.addEventListener('click', e => {
      if (!navbar.contains(e.target)) navMenu.classList.remove('open');
    });
  }

  // Mark active nav link
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link').forEach(link => {
    const href = link.getAttribute('href') || '';
    if (href === currentPage || (currentPage === '' && href === 'index.html')) {
      link.classList.add('active');
    }
  });

  // ===== THEME TOGGLE =====
  document.querySelectorAll('.theme-toggle').forEach(btn => {
    btn.addEventListener('click', () => theme.toggle());
  });

  // ===== AUTH BUTTONS =====
  updateAuthUI();

  // ===== MOBILE NAV: move auth actions into the dropdown menu =====
  relocateNavActions();
  let _navResizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(_navResizeTimer);
    _navResizeTimer = setTimeout(relocateNavActions, 150);
  });
  // matchMedia fires exactly when crossing the breakpoint (more reliable)
  const _navMq = window.matchMedia('(max-width: 768px)');
  (_navMq.addEventListener ? _navMq.addEventListener('change', relocateNavActions)
                           : _navMq.addListener(relocateNavActions));

  // ===== PAGE LOADER =====
  const loader = document.querySelector('.page-loader');
  if (loader) {
    window.addEventListener('load', () => {
      setTimeout(() => loader.classList.add('hide'), 300);
    });
  }

  // ===== SMOOTH SCROLL =====
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const target = document.querySelector(a.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // ===== FAQ ACCORDION =====
  document.querySelectorAll('.faq-question').forEach(q => {
    q.addEventListener('click', () => {
      const item = q.closest('.faq-item');
      const wasOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(i => i.classList.remove('open'));
      if (!wasOpen) item.classList.add('open');
    });
  });

  // ===== MODAL CLOSE =====
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.classList.remove('active');
    });
  });
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => btn.closest('.modal-overlay')?.classList.remove('active'));
  });

});

// On phones, relocate Sign In / Start Learning / user-menu into the dropdown
// menu so the top bar only holds the logo, theme toggle and hamburger.
function relocateNavActions() {
  const menu = document.querySelector('.nav-menu');
  const actions = document.querySelector('.nav-actions');
  if (!menu || !actions) return;
  const mobile = window.matchMedia('(max-width: 768px)').matches;
  const els = [
    document.querySelector('.nav-actions .auth-login-btn'),
    document.querySelector('.nav-actions .auth-register-btn'),
    document.querySelector('.nav-actions .auth-user-menu'),
    ...menu.querySelectorAll('.nav-auth-item .auth-login-btn, .nav-auth-item .auth-register-btn, .nav-auth-item .auth-user-menu')
  ].filter(Boolean);
  const hamburger = actions.querySelector('.hamburger');

  if (mobile) {
    els.forEach(el => {
      if (!el.closest('.nav-menu')) {
        const li = document.createElement('li');
        li.className = 'nav-auth-item';
        li.appendChild(el);
        menu.appendChild(li);
      }
    });
  } else {
    els.forEach(el => {
      const li = el.closest('.nav-auth-item');
      if (li) { actions.insertBefore(el, hamburger); li.remove(); }
    });
  }
}

function updateAuthUI() {
  const isLoggedIn = auth.isLoggedIn();
  const user = auth.getUser();

  document.querySelectorAll('.auth-login-btn').forEach(el => {
    el.style.display = isLoggedIn ? 'none' : 'flex';
  });
  document.querySelectorAll('.auth-register-btn').forEach(el => {
    el.style.display = isLoggedIn ? 'none' : 'flex';
  });
  document.querySelectorAll('.auth-user-menu').forEach(el => {
    el.style.display = isLoggedIn ? 'flex' : 'none';
    if (isLoggedIn && user) {
      const nameEl = el.querySelector('.user-name');
      if (nameEl) nameEl.textContent = user.name;
    }
  });

  // Redirect admin
  if (isLoggedIn && user?.role === 'admin') {
    document.querySelectorAll('.admin-link').forEach(el => el.style.display = 'flex');
  }
}

function openModal(id) {
  document.getElementById(id)?.classList.add('active');
}
function closeModal(id) {
  document.getElementById(id)?.classList.remove('active');
}

// Loading states on buttons
function setLoading(btn, loading) {
  if (loading) {
    btn.dataset.originalText = btn.innerHTML;
    btn.innerHTML = '<span class="loader"></span>';
    btn.disabled = true;
  } else {
    btn.innerHTML = btn.dataset.originalText || btn.innerHTML;
    btn.disabled = false;
  }
}
