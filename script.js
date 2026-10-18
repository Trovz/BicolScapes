/* ==========================================================================
   Bicol Scapes – shared behaviour (vanilla JavaScript, no libraries)

   Features
   1. Modal dialogs (welcome, sign in, privacy, terms, package details)
   2. Live search + category filter (Destinations)
   3. Package filter + FAQ accordion (Packages)
   4. Form validation with inline errors (Contact)
   5. Disabled past dates (Contact)
   ========================================================================== */
(function () {
  'use strict';

  /* ---------- Helpers ---------- */
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  // localStorage can throw (private mode etc.), so every access is wrapped.
  const store = {
    get(key) {
      try { return localStorage.getItem(key); } catch (e) { return null; }
    },
    set(key, value) {
      try { localStorage.setItem(key, value); } catch (e) { /* ignore */ }
    },
    remove(key) {
      try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
    },
  };

  const params = new URLSearchParams(window.location.search);

  /* Small toast message at the bottom of the screen */
  function toast(message) {
    let el = $('#toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      el.className =
        'fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-6 py-2 rounded-lg ' +
        'bg-slate-800 text-slate-100 text-sm font-medium shadow-xl ' +
        'transition-opacity duration-300 opacity-0 pointer-events-none';
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.remove('opacity-0');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.add('opacity-0'), 3000);
  }

  let lastFocused = null;

  function closeModal() {
    const modal = $('#app-modal');
    if (!modal) return;
    modal.remove();
    document.body.classList.remove('overflow-hidden');
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  }

  function openModal({ title, body }) {
    closeModal();
    lastFocused = document.activeElement;

    const overlay = document.createElement('div');
    overlay.id = 'app-modal';
    overlay.className =
      'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm';
    overlay.innerHTML =
      '<div role="dialog" aria-modal="true" aria-labelledby="app-modal-title" ' +
      'class="modal-pop relative w-full max-w-lg max-h-full overflow-y-auto bg-white ' + 'rounded-xl p-6 shadow-xl">' +
      '<button type="button" data-close aria-label="Close dialog" ' +
      'class="absolute top-3 right-3 w-9 h-9 flex items-center justify-center rounded-full ' + 'text-slate-600 hover:bg-blue-100 transition-colors">' +
      '<span class="material-symbols-outlined text-xl" aria-hidden="true" style="--icon-mask: url(../image/close.svg)"></span></button>' +
      '<h2 id="app-modal-title" class="text-2xl font-semibold text-slate-900 mb-4 pr-10"></h2>' +
      '<div data-body></div></div>';

    $('#app-modal-title', overlay).textContent = title;
    const bodyEl = $('[data-body]', overlay);
    if (typeof body === 'string') bodyEl.innerHTML = body;
    else bodyEl.appendChild(body);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay || e.target.closest('[data-close]')) closeModal();
    });
    document.body.appendChild(overlay);
    document.body.classList.add('overflow-hidden');

    const first = $('input, select, textarea, button:not([data-close]), a[href]', bodyEl) || $('[data-close]', overlay);
    if (first) first.focus();
    return overlay;
  }

  // Escape closes the modal; Tab stays inside it.
  document.addEventListener('keydown', (e) => {
    const modal = $('#app-modal');
    if (!modal) return;
    if (e.key === 'Escape') {
      closeModal();
      return;
    }
    if (e.key === 'Tab') {
      const focusable = $$('a[href], button, input, select, textarea', modal).filter((el) => !el.disabled);
      if (!focusable.length) return;
      const firstEl = focusable[0];
      const lastEl = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    }
  });

  /* ---------- Reusable validation helpers (used by sign-in, welcome and contact forms) ---------- */
  function fieldWrapper(input) {
    return input.closest('.flex-col') || input.parentElement;
  }

  function setError(input, message) {
    const wrap = fieldWrapper(input);
    let err = $('.field-error', wrap);
    if (!err) {
      err = document.createElement('p');
      err.className = 'field-error mt-1';
      err.id = input.id + '-error';
      err.setAttribute('role', 'alert');
      wrap.appendChild(err);
    }
    err.textContent = message;
    input.classList.add('is-invalid');
    input.classList.remove('is-valid');
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-describedby', err.id);
  }

  function clearError(input, markValid) {
    const err = $('.field-error', fieldWrapper(input));
    if (err) err.remove();
    input.classList.remove('is-invalid');
    input.classList.toggle('is-valid', Boolean(markValid));
    input.removeAttribute('aria-invalid');
    input.removeAttribute('aria-describedby');
  }

  // rules: { fieldId: (value, input) => 'error message' | '' }
  function validateField(input, rule) {
    const message = rule(input.value.trim(), input);
    if (message) {
      setError(input, message);
      return false;
    }
    clearError(input, input.value.trim() !== '');
    return true;
  }

  function attachValidation(form, rules) {
    const inputs = Object.keys(rules)
      .map((id) => $('#' + id, form))
      .filter(Boolean);
    inputs.forEach((input) => {
      // Only nag on blur once something has been typed. Flagging an empty field the moment
      // it loses focus shifts the layout and can swallow the click that caused the blur
      // (e.g. "Skip for now"); empty required fields are reported on submit instead.
      input.addEventListener('blur', () => {
        if (input.value.trim() === '' && !input.classList.contains('is-invalid')) return;
        validateField(input, rules[input.id]);
      });
      input.addEventListener('input', () => {
        if (input.classList.contains('is-invalid')) validateField(input, rules[input.id]);
      });
      input.addEventListener('change', () => validateField(input, rules[input.id]));
    });
    return function validateAll() {
      let firstInvalid = null;
      inputs.forEach((input) => {
        if (!validateField(input, rules[input.id]) && !firstInvalid) firstInvalid = input;
      });
      if (firstInvalid) firstInvalid.focus();
      return !firstInvalid;
    };
  }

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const NAME_RE = /^[\p{L}][\p{L}\s.'-]*$/u;

  const rules = {
    name(value) {
      if (!value) return 'Please enter your name.';
      if (value.length < 2) return 'Your name must be at least 2 characters.';
      if (!NAME_RE.test(value)) return 'Use letters only (spaces, . - and \' are fine).';
      return '';
    },
    email(value) {
      if (!value) return 'Please enter your email address.';
      if (!EMAIL_RE.test(value)) return 'Enter a valid email, like name@example.com.';
      return '';
    },
    password(value) {
      if (!value) return 'Please enter a password.';
      if (value.length < 8) return 'Password must be at least 8 characters.';
      return '';
    },
  };

  function renderSignInButton() {
    const btn = $('#signin-btn');
    if (!btn) return;
    const email = store.get('aura-user');
    btn.textContent = email ? 'Hi, ' + email.split('@')[0] : 'Sign In';
  }

  function openSignIn() {
    const email = store.get('aura-user');
    if (email) {
      const box = document.createElement('div');
      box.innerHTML =
        '<p class="text-base text-slate-600 mb-6">You are signed in as ' +
        '<strong class="text-slate-900 " data-email></strong>.</p>' +
        '<button type="button" data-signout class="w-full py-2 rounded-lg bg-sky-700 text-white ' + 'hover:bg-sky-600 text-sm font-medium transition-colors">Sign out</button>';
      $('[data-email]', box).textContent = email;
      $('[data-signout]', box).addEventListener('click', () => {
        store.remove('aura-user');
        renderSignInButton();
        closeModal();
        toast('You have been signed out.');
      });
      openModal({ title: 'Your account', body: box });
      return;
    }

    const modal = openModal({
      title: 'Sign in to Bicol Scapes',
      body:
        '<form id="signin-form" novalidate class="flex flex-col gap-4">' +
        '<div class="flex flex-col gap-1"><label for="si-email" class="text-xs text-slate-900 font-medium">Email</label>' +
        '<input id="si-email" name="email" type="email" autocomplete="email" placeholder="you@example.com" ' +
        'class="w-full px-4 py-2 rounded-lg bg-blue-50 text-slate-900 placeholder:text-slate-400 "></div>' +
        '<div class="flex flex-col gap-1"><label for="si-password" class="text-xs text-slate-900 font-medium">Password</label>' +
        '<input id="si-password" name="password" type="password" autocomplete="current-password" placeholder="At least 8 characters" ' +
        'class="w-full px-4 py-2 rounded-lg bg-blue-50 text-slate-900 placeholder:text-slate-400 "></div>' +
        '<button type="submit" class="w-full py-2 rounded-lg bg-sky-700 text-white hover:bg-sky-600 text-sm font-medium transition-colors">Sign in</button></form>',
    });
    const form = $('#signin-form', modal);
    const validateAll = attachValidation(form, {
      'si-email': rules.email,
      'si-password': rules.password,
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!validateAll()) return;
      store.set('aura-user', $('#si-email', form).value.trim());
      renderSignInButton();
      closeModal();
      toast('Signed in successfully.');
    });
  }

  const POLICIES = {
    privacy: {
      title: 'Privacy Policy',
      body:
        '<div class="space-y-2 text-sm text-slate-600 ">' +
        '<p>This is a student demo website. It does not collect, store on a server, or share any personal data.</p>' +
        '<p>Your theme choice, sign-in name and welcome-message preference are kept only in your own browser (localStorage) and can be cleared at any time from your browser settings.</p>' +
        '<p>Forms on this site (such as the trip inquiry) are simulated and are not transmitted anywhere.</p></div>',
    },
    terms: {
      title: 'Terms of Service',
      body:
        '<div class="space-y-2 text-sm text-slate-600 ">' +
        '<p>Bicol Scapes is a fictional travel agency created for a web-development class project.</p>' +
        '<p>Destinations, prices and packages are sample content only. No bookings can be made and no payments are processed.</p>' +
        '<p>Images and icons are used for demonstration purposes.</p></div>',
    },
  };

  function initModalTriggers() {
    renderSignInButton();
    document.addEventListener('click', (e) => {
      const trigger = e.target.closest('[data-modal]');
      if (!trigger) return;
      e.preventDefault();
      const kind = trigger.getAttribute('data-modal');
      if (kind === 'signin') openSignIn();
      else if (POLICIES[kind]) openModal(POLICIES[kind]);
    });
    // Generic "go to another page" buttons
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-href]');
      if (el) window.location.href = el.getAttribute('data-href');
    });
  }

  /* ---------- Home page: search ---------- */
  function initHome() {
    // Hero search → Destinations page with ?q=
    const search = $('#home-search');
    if (search) {
      search.addEventListener('submit', (e) => {
        e.preventDefault();
        const q = $('#search-dest', search).value.trim();
        window.location.href = 'destinations.html' + (q ? '?q=' + encodeURIComponent(q) : '');
      });
    }

    // Popular getaway cards are clickable
    $$('[data-dest-card]').forEach((card) => {
      const go = () => {
        window.location.href = 'destinations.html';
      };
      card.addEventListener('click', go);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          go();
        }
      });
    });
  }

  /* ======================================================================
     5. DESTINATIONS: live search + category filter
     ====================================================================== */
  const PILL_ON = 'bg-sky-700 text-white shadow-sm'.split(' ');
  const PILL_OFF = 'bg-blue-50 text-slate-600 '.split(' ');

  function initDestinations() {
    const grid = $('#destinations-grid');
    if (!grid) return;

    const cards = $$('.destination-card', grid);
    const pills = $$('.filter-pill');
    const input = $('#dest-search');
    const count = $('#result-count');
    let category = 'all';

    const empty = document.createElement('div');
    empty.className = 'hidden col-span-full text-center py-10';
    empty.innerHTML =
      '<span class="material-symbols-outlined text-4xl text-slate-400 " aria-hidden="true" style="--icon-mask: url(../image/travel_explore.svg)"></span>' +
      '<h2 class="text-xl font-medium text-slate-900 mt-2">No destinations found</h2>' +
      '<p class="text-base text-slate-600 mb-4">Try a different word or choose another category.</p>' +
      '<button type="button" class="px-6 py-2 rounded-lg bg-sky-700 text-white hover:bg-sky-600 text-sm font-medium transition-colors">Clear filters</button>';
    grid.appendChild(empty);

    function apply() {
      const query = input ? input.value.trim().toLowerCase() : '';
      let shown = 0;
      cards.forEach((card) => {
        const cats = card.getAttribute('data-category') || '';
        const text = card.textContent.toLowerCase();
        const match = (category === 'all' || cats.split(' ').includes(category)) && (!query || text.includes(query));
        const wasHidden = card.classList.contains('hidden');
        card.classList.toggle('hidden', !match);
        if (match) {
          shown += 1;
          if (wasHidden) {
            card.classList.remove('fade-in');
            void card.offsetWidth; // restart the animation
            card.classList.add('fade-in');
          }
        }
      });
      empty.classList.toggle('hidden', shown !== 0);
      if (count) count.textContent = shown + (shown === 1 ? ' destination' : ' destinations');
    }

    pills.forEach((pill) => {
      pill.addEventListener('click', () => {
        category = pill.getAttribute('data-filter');
        pills.forEach((p) => {
          p.classList.remove(...PILL_ON);
          p.classList.add(...PILL_OFF);
          p.setAttribute('aria-pressed', 'false');
        });
        pill.classList.remove(...PILL_OFF);
        pill.classList.add(...PILL_ON);
        pill.setAttribute('aria-pressed', 'true');
        apply();
      });
    });

    if (input) {
      input.addEventListener('input', apply);
      const q = params.get('q');
      if (q) input.value = q;
    }
    $('button', empty).addEventListener('click', () => {
      if (input) input.value = '';
      const all = pills.find((p) => p.getAttribute('data-filter') === 'all');
      if (all) all.click();
      else apply();
    });
    apply();
  }

  /* ======================================================================
     6. PACKAGES: filter, details modal, FAQ accordion
     ====================================================================== */
  function initPackages() {
    const grid = $('#packages-grid');
    if (!grid) return;

    const buttons = $$('.filter-btn');
    const cards = $$('.package-card', grid);
    const ON = 'bg-sky-700 text-white '.split(' ');
    const OFF = 'bg-white text-slate-600 '.split(' ');

    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const category = btn.getAttribute('data-filter');
        buttons.forEach((b) => {
          b.classList.remove(...ON);
          b.classList.add(...OFF);
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.remove(...OFF);
        btn.classList.add(...ON);
        btn.setAttribute('aria-pressed', 'true');
        cards.forEach((card) => {
          const cats = (card.getAttribute('data-category') || '').split(' ');
          const show = category === 'all' || cats.includes(category);
          card.classList.toggle('hidden', !show);
          if (show) {
            card.classList.remove('fade-in');
            void card.offsetWidth;
            card.classList.add('fade-in');
          }
        });
      });
    });

    // "View Details" opens a modal built from the card's own content
    $$('[data-details]', grid).forEach((btn) => {
      btn.addEventListener('click', () => {
        const card = btn.closest('.package-card');
        const title = $('h2', card).textContent.trim();
        const price = $('[data-price]', card).textContent.trim();
        const days = $('[data-days]', card).textContent.trim();
        const included = $('[data-included]', card).cloneNode(true);
        included.classList.add('mb-4');

        const body = document.createElement('div');
        body.innerHTML =
          '<p class="text-base text-slate-600 mb-4"><span data-meta></span></p>';
        $('[data-meta]', body).textContent = days + ' · Price range ' + price + ' per person';
        body.appendChild(included);
        const cta = document.createElement('a');
        cta.href = 'contact.html?trip=' + encodeURIComponent(title);
        cta.className =
          'inline-flex w-full items-center justify-center gap-1 py-2 rounded-lg bg-sky-700 text-white ' +
          'hover:bg-sky-600 text-sm font-medium transition-colors';
        cta.innerHTML = '<span>Enquire about this trip</span><span class="material-symbols-outlined text-lg" aria-hidden="true" style="--icon-mask: url(../image/arrow_forward.svg)"></span>';
        body.appendChild(cta);
        openModal({ title, body });
      });
    });

    // FAQ accordion: one answer open at a time
    const faqButtons = $$('[data-faq]');
    faqButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-faq');
        const answer = $('#faq-ans-' + id);
        const wasOpen = !answer.classList.contains('hidden');
        faqButtons.forEach((other) => {
          const oid = other.getAttribute('data-faq');
          $('#faq-ans-' + oid).classList.add('hidden');
          $('#faq-icon-' + oid).style.transform = 'rotate(0deg)';
          other.setAttribute('aria-expanded', 'false');
        });
        if (!wasOpen) {
          answer.classList.remove('hidden');
          $('#faq-icon-' + id).style.transform = 'rotate(180deg)';
          btn.setAttribute('aria-expanded', 'true');
        }
      });
    });
  }

  /* ======================================================================
     7. CONTACT: validation + past dates disabled + success state
     ====================================================================== */
  function todayISO() {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); // local date, not UTC
    return d.toISOString().slice(0, 10);
  }

  function initContact() {
    const form = $('#booking-inquiry-form');
    if (!form) return;

    const date = $('#travelDates', form);
    if (date) {
      date.min = todayISO(); // past dates can't be picked
      const updateDateStyle = () => date.classList.toggle('has-value', Boolean(date.value));
      date.addEventListener('input', updateDateStyle);
      date.addEventListener('change', updateDateStyle);
      form.addEventListener('reset', () => requestAnimationFrame(updateDateStyle));
      updateDateStyle();
    }

    const trip = params.get('trip');
    const notes = $('#notes', form);
    if (trip && notes && !notes.value) notes.value = 'I’m interested in the "' + trip + '" package. ';

    const validateAll = attachValidation(form, {
      fullName: rules.name,
      email: rules.email,
      destination(value) {
        return value ? '' : 'Please choose a destination.';
      },
      travelDates(value) {
        if (!value) return 'Please pick a departure date.';
        if (value < todayISO()) return 'Travel date can’t be in the past.';
        return '';
      },
      notes(value) {
        if (value.length < 10) return 'Please tell us a little more (at least 10 characters).';
        if (value.length > 500) return 'Please keep your message under 500 characters.';
        return '';
      },
    });

    const btn = $('#submit-btn', form);
    const success = $('#form-success');
    const btnHTML = btn ? btn.innerHTML : '';

    form.setAttribute('novalidate', '');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!validateAll()) return;
      btn.innerHTML =
        '<span class="material-symbols-outlined animate-spin text-lg" aria-hidden="true" style="--icon-mask: url(../image/progress_activity.svg)"></span><span>Sending...</span>';
      btn.disabled = true;
      setTimeout(() => {
        success.classList.remove('hidden');
        btn.innerHTML = btnHTML;
        btn.disabled = false;
      }, 700);
    });

    const again = $('[data-reset-form]');
    if (again) {
      again.addEventListener('click', () => {
        form.reset();
        $$('input, select, textarea', form).forEach((el) => clearError(el, false));
        success.classList.add('hidden');
      });
    }
  }

  /* ---------- Boot ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    initModalTriggers();
    initHome();
    initDestinations();
    initPackages();
    initContact();
  });
})();
