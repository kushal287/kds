/* KDS public site — renders all content from /api/public and wires the interactions. */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeUrl = (u) => (/^(https?:\/\/|mailto:|tel:|\/uploads\/)/i.test(u || '') ? u : '');
  const hasHover = window.matchMedia && matchMedia('(hover: hover)').matches;

  /* ------------------------------------------------------------------ icons */
  const P = {
    social: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>',
    web: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18"/>',
    video: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 9.5v5l4.5-2.5z"/>',
    business: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2M3 13h18"/>',
    app: '<rect x="7" y="2" width="10" height="20" rx="2.5"/><path d="M11 18h2"/>',
    design: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/>',
    seo: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    cloud: '<path d="M18 18a4 4 0 000-8 6 6 0 00-11.7-1.5A4.5 4.5 0 007 18z"/>',
    ai: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 17l.7 1.8 1.8.7-1.8.7L19 22l-.7-1.8-1.8-.7 1.8-.7z"/>',
    game: '<rect x="2" y="7" width="20" height="11" rx="5"/><path d="M7 10v5M4.5 12.5h5M15.5 11.5h.01M18 13.5h.01"/>',
    support: '<path d="M4 14v-2a8 8 0 0116 0v2"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/>',
    star: '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.2 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z"/>',
    instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r=".6"/>',
    linkedin: '<path d="M4 9h4v11H4zM6 4a2 2 0 110 4 2 2 0 010-4zM10 9h3.8v1.6c.6-1 1.9-1.9 3.8-1.9 3.3 0 3.9 2.1 3.9 4.9V20h-4v-5.6c0-1.4 0-2.7-1.7-2.7S14 13 14 14.4V20h-4z"/>',
    github: '<path d="M9 19c-4 1.3-4-2-6-2.5m12 4.5v-3.5a3 3 0 00-.8-2.3c2.7-.3 5.5-1.3 5.5-6a4.6 4.6 0 00-1.3-3.2 4.3 4.3 0 00-.1-3.2s-1-.3-3.4 1.3a11.7 11.7 0 00-6 0C6.500 2.100 5.500 2.400 5.500 2.400a4.300 4.300 0 00-.1 3.200A4.600 4.600 0 004 8.800c0 4.600 2.800 5.700 5.500 6A3 3 0 008.700 17v3.500"/>',
    youtube: '<path d="M22 8.5a3 3 0 00-2-2.100C18 6 12 6 12 6s-6 0-8 .4A3 3 0 002 8.500 31 31 0 001.600 12 31 31 0 002 15.500a3 3 0 002 2.100C6 18 12 18 12 18s6 0 8-.4a3 3 0 002-2.100 31 31 0 00.4-3.500 31 31 0 00-.4-3.500z"/><path d="M10 15l5-3-5-3z"/>',
    profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/>',
    phone: '<path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.500 19.500 0 01-6-6A19.800 19.800 0 012.100 4.200 2 2 0 014.100 2h3a2 2 0 012 1.700c.1 1 .4 1.900.7 2.800a2 2 0 01-.5 2.100L8.100 9.900a16 16 0 006 6l1.300-1.300a2 2 0 012.100-.4c.9.300 1.800.6 2.800.7a2 2 0 011.700 2z"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3.500 7l8.500 6 8.500-6"/>',
    whatsapp: '<path d="M21 11.500a8.500 8.500 0 01-12.600 7.400L3 20.500l1.600-5.200A8.500 8.500 0 1121 11.500z"/>',
    pin: '<path d="M12 21s7-6.200 7-12a7 7 0 10-14 0c0 5.800 7 12 7 12z"/><circle cx="12" cy="9" r="2.500"/>',
    ext: '<path d="M7 17L17 7M8 7h9v9"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    check: '<path d="M5 12.5l4.500 4.500L19 7.500"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>'
  };
  const svg = (n) => `<svg viewBox="0 0 24 24" aria-hidden="true">${P[n] || P.star}</svg>`;
  const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.9L12 17.8 5.8 21.100 7 14.200 2 9.300l6.900-1z"/></svg>';

  document.body.insertAdjacentHTML('beforeend', '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff1b8"/><stop offset=".5" stop-color="#f2c14e"/><stop offset="1" stop-color="#c98a14"/></linearGradient></defs></svg>');

  /* ----------------------------------------------------------------- data */
  let data = null;
  async function load() {
    try {
      const r = await fetch('/api/public', { cache: 'no-store' });
      if (!r.ok) throw new Error(r.status);
      data = await r.json();
    } catch (e) {
      console.warn('Could not load site data', e);
      data = { settings: {}, services: [], plans: [], projects: [], team: [] };
    }
    render(data);
  }

  const SOCIAL_ORDER = [['instagram', 'Instagram'], ['linkedin', 'LinkedIn'], ['github', 'GitHub'], ['youtube', 'YouTube'], ['profile', 'Profile']];
  function socialsHtml(o, keys) {
    o = o || {};
    return (keys || SOCIAL_ORDER).map(([k, label]) => {
      const u = safeUrl(o[k]);
      return u ? `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer" aria-label="${label}" title="${label}">${svg(k)}</a>` : '';
    }).join('');
  }
  const initials = (n) => String(n || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

  function render(d) {
    const s = d.settings || {};
    const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt || ''; };

    /* hero */
    const title = (s.heroTitle || 'We build digital experiences that shine.').trim();
    const words = title.split(/\s+/);
    const goldFrom = Math.max(0, words.length - 2);
    $('#hero-title').innerHTML = words.map((w, i) => `<span class="w"><span style="transition-delay:${0.12 + i * 0.08}s"${i >= goldFrom ? ' class="gold"' : ''}>${esc(w)}</span></span>`).join(' ');
    $('#hero-title').setAttribute('aria-label', title);
    set('hero-sub', s.heroSubtitle);
    $('#hero-sub').hidden = !s.heroSubtitle;

    /* socials */
    const soc = socialsHtml(s.socials);
    ['hero-socials', 'contact-socials', 'footer-socials'].forEach((id) => { const el = document.getElementById(id); el.innerHTML = soc; el.hidden = !soc; });

    /* about + stats */
    $('#about').hidden = !(s.aboutTitle || s.aboutText);
    set('about-title', s.aboutTitle); set('about-text', s.aboutText);
    $('#about-title').hidden = !s.aboutTitle; $('#about-text').hidden = !s.aboutText;
    const clients = new Set((d.projects || []).map((p) => (p.clientName || '').trim().toLowerCase()).filter(Boolean)).size;
    const autoVal = { projects: (d.projects || []).length, clients, team: (d.team || []).length, services: (d.services || []).length };
    const stats = (s.stats || []).map((x) => {
      let v = x.value; const auto = x.auto ? autoVal[x.auto] : null;
      if (x.auto) { if (!auto) return null; v = String(auto) + '+'; }
      return v ? { v, label: x.label } : null;
    }).filter(Boolean);
    $('#stats').innerHTML = stats.map((x) => `<div class="stat"><b data-count="${esc(x.v)}">${esc(x.v)}</b><span>${esc(x.label)}</span></div>`).join('');
    $('#stats').hidden = !stats.length;
    if (!stats.length) $('.about-grid').style.gridTemplateColumns = '1fr';

    /* services */
    const services = d.services || [];
    $('#services').hidden = !services.length;
    $('#services-grid').innerHTML = services.map((x) => `
      <article class="card glass service tilt reveal">
        <div class="ico">${svg(x.icon)}</div>
        <h3>${esc(x.title)}</h3>
        ${x.description ? `<p>${esc(x.description)}</p>` : ''}
      </article>`).join('');

    /* marquee */
    const mq = services.map((x) => x.title);
    if (mq.length) {
      const one = mq.map((t) => `<span>${esc(t)}</span>`).join('');
      $('#marquee').innerHTML = one + one;
      $('.marquee').hidden = false;
    } else $('.marquee').hidden = true;

    /* plans */
    const plans = d.plans || [];
    $('#pricing').hidden = !plans.length;
    $('#plans-grid').innerHTML = plans.map((p) => {
      const badge = p.badge || (p.featured ? 'Most popular' : '');
      const feats = (p.features || []).map((f) => `<li>${svg('check')}<span>${esc(f)}</span></li>`).join('');
      const brochure = safeUrl(p.brochure);
      return `
      <article class="card glass plan tilt reveal${p.featured ? ' featured' : ''}">
        ${badge ? `<span class="badge">${esc(badge)}</span>` : ''}
        <h3>${esc(p.name)}</h3>
        ${p.tagline ? `<p class="tag">${esc(p.tagline)}</p>` : ''}
        ${p.price ? `<div class="price"><b>${esc(p.price)}</b>${p.period ? `<span>${esc(p.period)}</span>` : ''}</div>` : ''}
        ${feats ? `<p class="includes">What’s included</p><ul>${feats}</ul>` : '<ul></ul>'}
        <a class="btn magnetic ${p.featured ? '' : 'btn-ghost'}" href="#contact" data-plan="${esc(p.name)}"><span>${esc(p.ctaLabel || 'Select & enquire')}</span>${svg('arrow')}</a>
        ${brochure ? `<a class="brochure" href="${esc(brochure)}" target="_blank" rel="noopener noreferrer">↓ Download brochure</a>` : ''}
      </article>`;
    }).join('');

    /* projects */
    const projects = d.projects || [];
    $('#projects').hidden = !projects.length;
    $('#projects-grid').innerHTML = projects.map((p) => {
      const img = safeUrl(p.image);
      const L = p.links || {};
      const links = [
        ['live', 'Live site', 'ext'], ['apk', 'Download APK', 'download'], ['github', 'Source code', 'github'], ['other', p.otherLabel || 'View more', 'ext']
      ].map(([k, label, ic]) => { const u = safeUrl(L[k]); return u ? `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer"${k === 'apk' ? ' download' : ''}>${svg(ic)}${esc(label)}</a>` : ''; }).join('');
      const rating = Math.max(0, Math.min(5, p.rating | 0));
      const stars = rating > 0 ? `<div class="stars" role="img" aria-label="${rating} out of 5 stars">${[1, 2, 3, 4, 5].map((i) => STAR.replace('<svg', `<svg class="${i <= rating ? 'on' : ''}"`)).join('')}</div>` : '';
      const cphoto = safeUrl(p.clientPhoto);
      const client = p.clientName ? `<div class="client">${cphoto ? `<img src="${esc(cphoto)}" alt="" loading="lazy">` : `<span class="av">${esc(initials(p.clientName))}</span>`}<div><b>${esc(p.clientName)}</b>${p.clientRole ? `<small>${esc(p.clientRole)}</small>` : ''}</div></div>` : '';
      const quote = (stars || p.testimonial || client) ? `<div class="quote">${stars}${p.testimonial ? `<p>${esc(p.testimonial)}</p>` : ''}${client}</div>` : '';
      return `
      <article class="card glass project tilt reveal">
        <div class="shot">${img ? `<img src="${esc(img)}" alt="${esc(p.title)}" loading="lazy">` : '<div class="ph"><img src="/assets/logo.png" alt=""></div>'}</div>
        <div class="pbody">
          <h3>${esc(p.title)}</h3>
          ${(p.tags || []).length ? `<div class="tags">${p.tags.map((t) => `<span>${esc(t)}</span>`).join('')}</div>` : ''}
          ${p.description ? `<p>${esc(p.description)}</p>` : ''}
          ${links ? `<div class="links">${links}</div>` : ''}
          ${quote}
        </div>
      </article>`;
    }).join('');

    /* team */
    const team = d.team || [];
    $('#team').hidden = !team.length;
    const TS = SOCIAL_ORDER.filter(([k]) => k !== 'profile');
    $('#team-grid').innerHTML = team.map((m) => {
      const photo = safeUrl(m.photo);
      const so = socialsHtml(m.socials, TS);
      return `
      <article class="card glass member tilt reveal">
        <div class="portrait"><div>${photo ? `<img src="${esc(photo)}" alt="${esc(m.name)}" loading="lazy">` : `<span class="init">${esc(initials(m.name))}</span>`}</div></div>
        <h3>${esc(m.name)}</h3>
        ${m.position ? `<p class="pos">${esc(m.position)}</p>` : ''}
        ${m.bio ? `<p class="bio">${esc(m.bio)}</p>` : ''}
        ${so ? `<div class="socials">${so}</div>` : ''}
      </article>`;
    }).join('');

    /* contact */
    const items = [];
    if (s.phone) items.push(`<a class="contact-item" href="tel:${esc(String(s.phone).replace(/[^\d+]/g, ''))}"><span class="ico">${svg('phone')}</span><div><small>Call us</small><b>${esc(s.phone)}</b></div></a>`);
    if (s.email) items.push(`<a class="contact-item" href="mailto:${esc(s.email)}"><span class="ico">${svg('mail')}</span><div><small>Email</small><b>${esc(s.email)}</b></div></a>`);
    if (s.whatsapp) items.push(`<a class="contact-item" href="https://wa.me/${esc(s.whatsapp)}" target="_blank" rel="noopener noreferrer"><span class="ico">${svg('whatsapp')}</span><div><small>WhatsApp</small><b>Chat with us</b></div></a>`);
    if (s.address) items.push(`<div class="contact-item"><span class="ico">${svg('pin')}</span><div><small>Location</small><b>${esc(s.address)}</b></div></div>`);
    $('#contact-list').innerHTML = items.join('');
    $('#contact-list').hidden = !items.length;

    /* footer + brand */
    set('foot-founder', s.founder || 'Kushal Aggarwal');
    set('foot-studio', `${s.studioName || 'KDS'} (${s.fullName || 'Kushal Developer Studios'})`);
    set('year', new Date().getFullYear());
    document.title = `${s.studioName || 'KDS'} — ${s.fullName || 'Kushal Developer Studios'}`;

    fillInterest(plans, services);
    const dir = [];
    if (s.phone) dir.push(`<a class="btn btn-ghost btn-sm" href="tel:${esc(String(s.phone).replace(/[^\d+]/g, ''))}"><span>📞 Call ${esc(s.phone)}</span></a>`);
    if (s.whatsapp) dir.push(`<a class="btn btn-ghost btn-sm" href="https://wa.me/${esc(s.whatsapp)}" target="_blank" rel="noopener noreferrer"><span>💬 WhatsApp us</span></a>`);
    dir.push('<a class="btn btn-sm" href="#contact" id="general-enq"><span>Send a general enquiry</span></a>');
    $('#pricing-direct').innerHTML = '<p>Not sure which one fits? <b>Ask us directly</b> — no need to pick a package.</p><div>' + dir.join('') + '</div>';
    $('#general-enq').addEventListener('click', () => { if (form.classList.contains('sent')) resetForm(); form.elements.interest.value = ''; syncMessage(); });
    buildNav();
    setupReveal();
    setupTilt();
    setupMagnet();
    setupPlanButtons();
  }

  /* -------------------------------------------------------------------- nav */
  const NAV = [['about', 'About'], ['services', 'Services'], ['pricing', 'Pricing'], ['projects', 'Projects'], ['team', 'Team'], ['contact', 'Contact']];
  let navSections = [];
  function buildNav() {
    navSections = NAV.filter(([id]) => { const el = document.getElementById(id); return el && !el.hidden; });
    $('#nav-links').innerHTML = navSections.map(([id, l]) => `<a href="#${id}" data-id="${id}">${l}</a>`).join('');
    $$('#nav-links a').forEach((a) => a.addEventListener('click', closeMenu));
  }
  const burger = $('#burger');
  function closeMenu() { $('#nav-links').classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); }
  burger.addEventListener('click', () => { const o = $('#nav-links').classList.toggle('open'); burger.setAttribute('aria-expanded', String(o)); });

  /* ----------------------------------------------------- reveal / counters */
  let io = null;
  function setupReveal() {
    if (io) io.disconnect();
    $$('.grid').forEach((g) => Array.from(g.children).forEach((c, i) => c.style.setProperty('--d', Math.min(i * 0.09, 0.55) + 's')));
    $$('.hero .reveal').forEach((el, i) => el.style.setProperty('--d', 0.5 + i * 0.12 + 's'));
    io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const el = e.target; io.unobserve(el);
        if (el.closest('.hero') && !document.body.classList.contains('ready')) return;
        el.classList.add('in');
        $$('[data-count]', el).concat(el.matches('[data-count]') ? [el] : []).forEach(countUp);
        setTimeout(() => el.classList.add('settled'), 1500);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    $$('.reveal').forEach((el) => io.observe(el));
  }
  function countUp(el) {
    const m = /^(\d+)(.*)$/.exec(el.dataset.count || '');
    if (!m || el.dataset.done) return; el.dataset.done = 1;
    const end = +m[1], suf = m[2], t0 = performance.now(), dur = 1600;
    (function tick(now) {
      const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 4);
      el.textContent = Math.round(end * e) + suf;
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  }

  /* ---------------------------------------------------------- tilt + magnet */
  function setupTilt() {
    $$('.tilt').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        el.style.setProperty('--mx', x * 100 + '%'); el.style.setProperty('--my', y * 100 + '%');
        if (!hasHover || !el.classList.contains('settled')) return;
        el.style.transform = `perspective(900px) rotateX(${(0.5 - y) * 9}deg) rotateY(${(x - 0.5) * 11}deg) translateY(-6px)`;
      });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
  }
  function setupMagnet() {
    if (!hasHover) return;
    $$('.magnetic').forEach((el) => {
      if (el.dataset.mag) return; el.dataset.mag = 1;
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.22}px, ${(e.clientY - r.top - r.height / 2) * 0.3}px)`;
      });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
  }
  function setupPlanButtons() {
    $$('[data-plan]').forEach((a) => a.addEventListener('click', (e) => {
      e.preventDefault();
      selectPlan(a.dataset.plan);
      scrollThen(document.getElementById('contact'), () => {
        // make sure the form really is on screen (a long smooth scroll can get cut short), then highlight it
        const top = form.getBoundingClientRect().top;
        if (top < 60 || top > window.innerHeight * 0.7) form.scrollIntoView({ behavior: 'instant', block: 'start' });
        form.classList.remove('flash'); void form.offsetWidth; form.classList.add('flash');
        const first = form.classList.contains('sent') ? null : (!form.elements.name.value ? form.elements.name : form.elements.email.value || form.elements.phone.value ? form.elements.message : form.elements.email);
        if (first) first.focus({ preventScroll: true });
      });
    }));
  }
  function scrollThen(el, cb) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    let last = -1, still = 0, n = 0;
    const t = setInterval(() => {
      const y = window.scrollY; still = Math.abs(y - last) < 1 ? still + 1 : 0; last = y;
      if (still >= 4 || ++n > 80) { clearInterval(t); cb(); }
    }, 100);
  }

  /* "What are you interested in?" — packages, services, or a general/direct enquiry */
  let autoMsg = '';
  function fillInterest(plans, services) {
    const sel = $('#form-interest');
    let html = '<option value="">General enquiry — I’ll just ask directly</option>';
    if (plans.length) html += '<optgroup label="Packages & pricing">' + plans.map((p) => `<option value="plan:${esc(p.name)}">${esc(p.name)}${p.price ? ' — ' + esc(p.price) : ''}${p.period ? ' ' + esc(p.period) : ''}</option>`).join('') + '</optgroup>';
    if (services.length) html += '<optgroup label="Services">' + services.map((x) => `<option value="service:${esc(x.title)}">${esc(x.title)}</option>`).join('') + '</optgroup>';
    html += '<option value="service:Something else">Something else</option>';
    sel.innerHTML = html;
  }
  function interestOf(val) { // -> { plan, service, label }
    const i = (val || '').indexOf(':');
    if (i < 0) return { plan: '', service: '', label: '' };
    const kind = val.slice(0, i), name = val.slice(i + 1);
    return { plan: kind === 'plan' ? name : '', service: kind === 'service' ? name : '', label: name };
  }
  function syncMessage() { // keep the auto-written first line in step with the dropdown, never overwrite what the customer typed
    const ta = form.elements.message, { label } = interestOf(form.elements.interest.value);
    const msg = label ? `Hi KDS, I'd like to go ahead with "${label}". ` : '';
    if (!ta.value.trim() || ta.value === autoMsg) { ta.value = msg; autoMsg = msg; }
  }
  function selectPlan(name) {
    if (form.classList.contains('sent')) resetForm();
    const opt = Array.from(form.elements.interest.options).find((o) => o.value === 'plan:' + name);
    if (opt) form.elements.interest.value = opt.value;
    syncMessage();
  }
  function resetForm() {
    form.reset(); form.classList.remove('sent'); $('#form-success').hidden = true; autoMsg = '';
    note.className = 'form-note'; note.textContent = '';
  }

  /* ----------------------------------------------------- scroll: nav / rail */
  const nav = $('#nav'), railFill = $('#rail-fill'), railDot = $('#rail-dot'), railLabel = $('#rail-label'), glow = $('#cursor-glow');
  function onScroll() {
    const y = window.scrollY, max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight), p = Math.min(1, y / max);
    nav.classList.toggle('scrolled', y > 30);
    railFill.style.height = p * 100 + '%'; railDot.style.top = p * 100 + '%';
    // scroll spy
    const mid = window.innerHeight * 0.4;
    const all = [['hero', 'Home']].concat(navSections.map(([id, l]) => [id, l]));
    let cur = all[0], idx = 0;
    all.forEach((s, i) => { const el = document.getElementById(s[0]); if (el && el.getBoundingClientRect().top <= mid) { cur = s; idx = i; } });
    railLabel.textContent = String(idx + 1).padStart(2, '0') + ' — ' + cur[1].toUpperCase();
    $$('#nav-links a').forEach((a) => a.classList.toggle('active', a.dataset.id === cur[0]));
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);

  window.addEventListener('pointermove', (e) => {
    glow.style.opacity = 1; glow.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
  }, { passive: true });
  document.addEventListener('mouseleave', () => { glow.style.opacity = 0; });

  /* -------------------------------------------------------------- contact form */
  const form = $('#contact-form'), note = $('#form-note');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    note.className = 'form-note';
    const fd = Object.fromEntries(new FormData(form).entries());
    const pick = interestOf(fd.interest); fd.plan = pick.plan; fd.service = pick.service; delete fd.interest;
    if (!fd.name.trim() || !fd.message.trim() || (!fd.email.trim() && !fd.phone.trim())) { note.classList.add('err'); note.textContent = 'Please add your name, a message and an email or phone number.'; return; }
    const btn = form.querySelector('button'); btn.disabled = true; note.textContent = 'Sending…';
    try {
      const r = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fd) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Something went wrong');
      const who = fd.name.trim().split(/\s+/)[0], via = fd.email.trim() || fd.phone.trim();
      $('#success-text').textContent = `Thank you, ${who}! We’ve received your request${pick.label ? ` about “${pick.label}”` : ''} and will contact you shortly on ${via}.`;
      form.reset(); autoMsg = ''; note.textContent = '';
      form.classList.add('sent'); $('#form-success').hidden = false;
      form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (err) { note.classList.add('err'); note.textContent = err.message + ' You can also call or email us directly.'; }
    btn.disabled = false;
  });

  $('#form-interest').addEventListener('change', syncMessage);
  $('#send-another').addEventListener('click', resetForm);

  /* -------------------------------------------------------------------- boot */
  const t0 = performance.now();
  const fontsReady = Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), new Promise((r) => setTimeout(r, 2500))]);
  Promise.all([load(), fontsReady]).then(() => {
    const wait = Math.max(0, 1500 - (performance.now() - t0));
    setTimeout(() => {
      $('#loader').classList.add('done');
      document.body.classList.remove('loading');
      document.body.classList.add('ready');
      window.dispatchEvent(new Event('kds:ready'));
      $$('.hero .reveal').forEach((el) => { io && io.unobserve(el); el.classList.add('in'); setTimeout(() => el.classList.add('settled'), 1800); });
      onScroll();
      if (location.hash) { const t = document.querySelector(location.hash); if (t) setTimeout(() => t.scrollIntoView(), 50); }
    }, wait);
  });
})();
