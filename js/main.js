/* ==========================================================================
   GRACE BANQUET — main.js
   ========================================================================== */

(function () {
  'use strict';

  /* ---------------------------------------------------------------
     Config
     --------------------------------------------------------------- */
  var WA_NUMBER = '923110607999'; // primary WhatsApp, no + or spaces

  /* ---------------------------------------------------------------
     Nav — scroll state + mobile toggle
     --------------------------------------------------------------- */
  var nav = document.querySelector('.nav');
  var toggle = document.querySelector('.nav-toggle');
  var links = document.querySelector('.nav-links');

  if (nav) {
    var onScroll = function () {
      nav.classList.toggle('scrolled', window.scrollY > 40);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  if (toggle && links) {
    toggle.addEventListener('click', function () {
      var open = links.classList.toggle('open');
      toggle.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      document.body.style.overflow = open ? 'hidden' : '';
    });

    links.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        links.classList.remove('open');
        toggle.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      });
    });
  }

  /* ---------------------------------------------------------------
     Scroll reveal
     --------------------------------------------------------------- */
  var revealEls = document.querySelectorAll('.reveal');
  if (revealEls.length) {
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add('visible');
            io.unobserve(e.target);
          }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
      revealEls.forEach(function (el) { io.observe(el); });
    } else {
      revealEls.forEach(function (el) { el.classList.add('visible'); });
    }
  }

  /* ---------------------------------------------------------------
     Gallery — filter + lightbox
     --------------------------------------------------------------- */
  var filters = document.querySelectorAll('.filter');
  var items = document.querySelectorAll('.gallery-item');

  if (filters.length && items.length) {
    filters.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var cat = btn.dataset.filter;
        filters.forEach(function (f) { f.classList.remove('active'); });
        btn.classList.add('active');
        items.forEach(function (item) {
          item.hidden = !(cat === 'all' || item.dataset.cat === cat);
        });
      });
    });
  }

  var lightbox = document.querySelector('.lightbox');
  if (lightbox && items.length) {
    var lbImg = lightbox.querySelector('img');
    var current = 0;

    var visibleItems = function () {
      return Array.prototype.filter.call(items, function (i) { return !i.hidden; });
    };

    var show = function (idx) {
      var list = visibleItems();
      if (!list.length) return;
      current = (idx + list.length) % list.length;
      var src = list[current].querySelector('img');
      if (src) {
        lbImg.src = src.dataset.full || src.src;
        lbImg.alt = src.alt || '';
      }
    };

    items.forEach(function (item) {
      item.addEventListener('click', function () {
        var list = visibleItems();
        show(list.indexOf(item));
        lightbox.classList.add('open');
        document.body.style.overflow = 'hidden';
      });
    });

    var close = function () {
      lightbox.classList.remove('open');
      document.body.style.overflow = '';
    };

    lightbox.querySelector('.lightbox-close').addEventListener('click', close);
    lightbox.addEventListener('click', function (e) {
      if (e.target === lightbox) close();
    });
    lightbox.querySelector('.lightbox-prev').addEventListener('click', function (e) {
      e.stopPropagation(); show(current - 1);
    });
    lightbox.querySelector('.lightbox-next').addEventListener('click', function (e) {
      e.stopPropagation(); show(current + 1);
    });

    document.addEventListener('keydown', function (e) {
      if (!lightbox.classList.contains('open')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') show(current - 1);
      if (e.key === 'ArrowRight') show(current + 1);
    });
  }

  /* ---------------------------------------------------------------
     Testimonials — auto-rotate
     --------------------------------------------------------------- */
  var slides = document.querySelectorAll('.testimonial-slide');
  var dots = document.querySelectorAll('.dot');

  if (slides.length > 1) {
    var idx = 0;
    var timer;

    var go = function (n) {
      slides.forEach(function (s) { s.classList.remove('active'); });
      dots.forEach(function (d) { d.classList.remove('active'); });
      idx = (n + slides.length) % slides.length;
      slides[idx].classList.add('active');
      if (dots[idx]) dots[idx].classList.add('active');
    };

    var start = function () { timer = setInterval(function () { go(idx + 1); }, 7000); };
    var stop = function () { clearInterval(timer); };

    dots.forEach(function (d, i) {
      d.addEventListener('click', function () { stop(); go(i); start(); });
    });

    start();
  }

  /* ---------------------------------------------------------------
     Inquiry form — validation + WhatsApp fallback
     --------------------------------------------------------------- */
  var form = document.getElementById('inquiry-form');

  if (form) {
    var setError = function (field, msg) {
      var wrap = field.closest('.field');
      if (!wrap) return;
      wrap.classList.add('error');
      var el = wrap.querySelector('.err-msg');
      if (el && msg) el.textContent = msg;
    };

    var clearError = function (field) {
      var wrap = field.closest('.field');
      if (wrap) wrap.classList.remove('error');
    };

    form.querySelectorAll('input, select, textarea').forEach(function (f) {
      f.addEventListener('input', function () { clearError(f); });
      f.addEventListener('change', function () { clearError(f); });
    });

    var validate = function () {
      var ok = true;
      var name = form.querySelector('#name');
      var phone = form.querySelector('#phone');
      var type = form.querySelector('#event_type');
      var date = form.querySelector('#event_date');

      if (!name.value.trim()) { setError(name, 'Enter your name'); ok = false; }

      var digits = phone.value.replace(/\D/g, '');
      if (digits.length < 10) { setError(phone, 'Enter a valid phone number'); ok = false; }

      if (!type.value) { setError(type, 'Choose an event type'); ok = false; }

      if (date.value) {
        var picked = new Date(date.value);
        var today = new Date();
        today.setHours(0, 0, 0, 0);
        if (picked < today) { setError(date, 'Pick a date in the future'); ok = false; }
      }

      return ok;
    };

    var buildMessage = function () {
      var val = function (id) {
        var el = form.querySelector('#' + id);
        if (!el) return '';
        if (el.tagName === 'SELECT') {
          return el.options[el.selectedIndex] ? el.options[el.selectedIndex].text : '';
        }
        return el.value.trim();
      };

      var lines = [
        'Assalam-o-Alaikum, I would like to enquire about Grace Banquet.',
        '',
        'Name: ' + val('name'),
        'Phone: ' + val('phone'),
        'Event: ' + val('event_type')
      ];

      if (val('event_date')) lines.push('Date: ' + val('event_date'));
      if (val('slot')) lines.push('Slot: ' + val('slot'));
      if (val('guests')) lines.push('Guests: approx ' + val('guests'));
      if (val('message')) lines.push('', 'Message: ' + val('message'));

      return lines.join('\n');
    };

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!validate()) {
        var firstErr = form.querySelector('.field.error');
        if (firstErr) {
          firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
          var input = firstErr.querySelector('input, select, textarea');
          if (input) input.focus();
        }
        return;
      }
      var url = 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(buildMessage());
      window.open(url, '_blank', 'noopener');
    });

    /* Min date = today */
    var dateInput = form.querySelector('#event_date');
    if (dateInput) {
      var t = new Date();
      var iso = t.getFullYear() + '-' +
                String(t.getMonth() + 1).padStart(2, '0') + '-' +
                String(t.getDate()).padStart(2, '0');
      dateInput.min = iso;
    }
  }

  /* ---------------------------------------------------------------
     Menu flip cards — tap / Enter / Space toggles; hover handled in CSS
     --------------------------------------------------------------- */
  var flipCards = document.querySelectorAll('.flip-card');
  flipCards.forEach(function (card) {
    function toggle() {
      var on = card.classList.toggle('flipped');
      card.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    card.addEventListener('click', toggle);
    card.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle();
      }
    });
  });

  /* ---------------------------------------------------------------
     Footer year
     --------------------------------------------------------------- */
  var yr = document.getElementById('year');
  if (yr) yr.textContent = new Date().getFullYear();

})();
