/* KDS admin panel */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const app = $('#app');
  let db = null, tab = 'overview';

  /* ---------------------------------------------------------------- helpers */
  let toastT;
  function toast(msg, err) {
    const t = $('#toast'); t.textContent = msg; t.className = 'show' + (err ? ' err' : '');
    clearTimeout(toastT); toastT = setTimeout(() => (t.className = ''), 3200);
  }
  async function api(method, url, body) {
    const r = await fetch(url, { method, credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401 && !/login|setup/.test(url)) { boot(); throw new Error('Session expired — please log in again'); }
    if (!r.ok) throw new Error(j.error || 'Something went wrong');
    return j;
  }
  const getp = (o, p) => p.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
  const setp = (o, p, v) => { const ks = p.split('.'); let c = o; ks.slice(0, -1).forEach((k) => (c = c[k] = c[k] || {})); c[ks[ks.length - 1]] = v; };
  const isImg = (u) => /\.(png|jpe?g|webp|gif)(\?|$)/i.test(u || '') || /^https?:\/\/.*\.(png|jpe?g|webp|gif)/i.test(u || '');

  /* ------------------------------------------------------------------- auth */
  async function boot() {
    closeModal();
    let st; try { st = await api('GET', '/api/admin/status'); } catch (e) { app.innerHTML = '<div class="auth"><div class="auth-card"><p>Cannot reach the server.</p></div></div>'; return; }
    if (st.locked) { app.innerHTML = '<div class="auth"><div class="auth-card"><img src="/assets/logo.png" alt="KDS"><h1>Admin not configured</h1><p>This hosted site has no admin password yet. In your hosting dashboard add an environment variable <code>ADMIN_PASSWORD</code> and redeploy, then come back here to log in.</p></div></div>'; return; }
    if (st.setup) return authView('setup');
    if (!st.loggedIn) return authView('login');
    await refresh(); shell();
  }
  function authView(mode) {
    const setup = mode === 'setup';
    app.innerHTML = `
      <div class="auth"><div class="auth-card">
        <img src="/assets/logo.png" alt="KDS">
        <h1>${setup ? 'Create your admin password' : 'Admin login'}</h1>
        <p>${setup ? 'First time here — choose a strong password (8+ characters). You’ll use it to manage the site.' : 'Sign in to manage your KDS website.'}</p>
        <form id="auth-form">
          <label class="f"><span>${setup ? 'New password' : 'Password'}</span><input type="password" name="password" required minlength="${setup ? 8 : 1}" autocomplete="${setup ? 'new-password' : 'current-password'}" autofocus></label>
          ${setup ? '<label class="f"><span>Confirm password</span><input type="password" name="confirm" required autocomplete="new-password"></label>' : ''}
          <p class="err-text" id="auth-err"></p>
          <button class="btn primary" style="justify-content:center">${setup ? 'Create & continue' : 'Log in'}</button>
        </form>
        <p style="margin:18px 0 0"><a href="/">← Back to website</a></p>
      </div></div>`;
    $('#auth-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = new FormData(e.target), pw = f.get('password');
      if (setup && pw !== f.get('confirm')) { $('#auth-err').textContent = 'Passwords do not match.'; return; }
      try { await api('POST', setup ? '/api/admin/setup' : '/api/admin/login', { password: pw }); boot(); }
      catch (err) { $('#auth-err').textContent = err.message; }
    });
  }
  async function refresh() { db = await api('GET', '/api/admin/data'); }

  /* ------------------------------------------------------------ collections */
  const ICONS = [['social', 'Social / share'], ['web', 'Website / globe'], ['video', 'Video'], ['business', 'Business / briefcase'], ['app', 'Mobile app'], ['design', 'Design / pen'], ['seo', 'SEO / search'], ['cloud', 'Cloud / hosting'], ['ai', 'AI / sparkle'], ['game', 'Games'], ['support', 'Support'], ['star', 'Star']];
  const COLS = {
    services: {
      name: 'Services', one: 'service', desc: 'The “Services we offer” cards on your site.',
      fields: [
        { k: 'title', t: 'text', l: 'Service name', req: 1, ph: 'e.g. Website Building' },
        { k: 'icon', t: 'select', l: 'Icon', opts: ICONS },
        { k: 'description', t: 'textarea', l: 'Description' }
      ],
      row: (i) => ({ title: i.title, sub: i.description })
    },
    plans: {
      name: 'Pricing & Brochures', one: 'package', desc: 'Your one-time services / packages with prices. Customers can select one and enquire. While there are none, the section stays hidden on the site.',
      fields: [
        { k: 'name', t: 'text', l: 'Package / service name', req: 1, ph: 'e.g. Business Website' },
        { k: 'tagline', t: 'text', l: 'Short tagline', ph: 'e.g. Perfect for new businesses' },
        { k: 'price', t: 'text', l: 'Price', ph: 'e.g. ₹4,999', half: 1 },
        { k: 'period', t: 'text', l: 'Billing', ph: 'e.g. one-time', half: 1 },
        { k: 'features', t: 'lines', l: 'What’s included', hint: 'One item per line — each shows with a ✓ below the price.' },
        { k: 'featured', t: 'check', l: 'Highlight this package (gold border)' },
        { k: 'badge', t: 'text', l: 'Badge text', ph: 'e.g. Most popular (optional)' },
        { k: 'ctaLabel', t: 'text', l: 'Button label', ph: 'Select & enquire' },
        { k: 'brochure', t: 'file', l: 'Brochure (PDF / image)', accept: '.pdf,image/*', hint: 'Optional — shows a “Download brochure” link on the card.' }
      ],
      row: (i) => ({ title: i.name + (i.featured ? '<span class="pill">Featured</span>' : ''), raw: 1, sub: [i.price, i.period].filter(Boolean).join(' ') + (i.features && i.features.length ? ` · ${i.features.length} features` : '') })
    },
    projects: {
      name: 'Projects', one: 'project', desc: 'Work done by KDS, with links and client testimonials. Hidden on the site until you add one.',
      fields: [
        { k: 'title', t: 'text', l: 'Project name', req: 1 },
        { k: 'description', t: 'textarea', l: 'Description' },
        { k: 'image', t: 'image', l: 'Screenshot / cover image', aspect: 16 / 10, out: 1280, hint: 'You’ll crop it to the card shape (16:10) before it’s saved.' },
        { k: 'tags', t: 'tags', l: 'Tags', hint: 'Comma separated, e.g. Website, React, E-commerce' },
        { group: 'Links (leave empty to hide)', fields: [
          { k: 'links.live', t: 'text', l: 'Live website', ph: 'https://…' },
          { k: 'links.apk', t: 'file', l: 'APK (upload or link)', accept: '.apk', hint: 'Upload the .apk file or paste a download link.' },
          { k: 'links.github', t: 'text', l: 'GitHub / source code', ph: 'https://github.com/…' },
          { k: 'links.other', t: 'text', l: 'Other link', ph: 'https://…', half: 1 },
          { k: 'otherLabel', t: 'text', l: 'Other link label', ph: 'e.g. Play Store', half: 1 }
        ] },
        { group: 'Client & testimonial', fields: [
          { k: 'clientName', t: 'text', l: 'Client name', half: 1 },
          { k: 'clientRole', t: 'text', l: 'Client role / company', half: 1 },
          { k: 'clientPhoto', t: 'image', l: 'Client photo (optional)', aspect: 1, out: 600, round: 1, hint: 'Shown as a small circle.' },
          { k: 'testimonial', t: 'textarea', l: 'Testimonial' },
          { k: 'rating', t: 'stars', l: 'Rating' }
        ] }
      ],
      row: (i) => ({ title: i.title, sub: [i.clientName, i.rating ? '★'.repeat(i.rating) + '☆'.repeat(5 - i.rating) : ''].filter(Boolean).join('  ·  ') || i.description, thumb: i.image })
    },
    team: {
      name: 'Team', one: 'team member', desc: 'People shown in the “Meet the team” section. Use the position number to choose where each person appears.',
      fields: [
        { k: 'name', t: 'text', l: 'Name', req: 1 },
        { k: 'position', t: 'text', l: 'Position / role', ph: 'e.g. Lead Developer' },
        { k: 'photo', t: 'image', l: 'Photo', aspect: 1, out: 800, round: 1, hint: 'Shown as a circle — crop so the face is centred.' },
        { k: 'bio', t: 'textarea', l: 'Short bio (optional)' },
        { group: 'Social links (empty ones stay hidden)', fields: [
          { k: 'socials.instagram', t: 'text', l: 'Instagram', ph: 'https://instagram.com/… or @name', half: 1 },
          { k: 'socials.github', t: 'text', l: 'GitHub', ph: 'https://github.com/… or @name', half: 1 },
          { k: 'socials.linkedin', t: 'text', l: 'LinkedIn', ph: 'https://linkedin.com/in/…', half: 1 },
          { k: 'socials.youtube', t: 'text', l: 'YouTube', ph: 'https://youtube.com/@…', half: 1 }
        ] }
      ],
      row: (i) => ({ title: i.name, sub: i.position, thumb: i.photo, round: 1 })
    }
  };

  /* ------------------------------------------------------------------ shell */
  const TABS = [['overview', 'Overview'], ['messages', 'Enquiries'], ['services', 'Services'], ['plans', 'Pricing & Brochures'], ['projects', 'Projects'], ['team', 'Team'], ['sheet', 'Google Sheet & Email'], ['settings', 'Site settings']];
  const newCount = () => db.messages.filter((m) => m.status === 'new').length;
  function shell() {
    const unread = newCount();
    document.title = (unread ? `(${unread}) ` : '') + 'KDS Admin';
    const counts = { services: db.services.length, plans: db.plans.length, projects: db.projects.length, team: db.team.length, messages: unread };
    app.innerHTML = `
      <div class="shell">
        <aside class="side">
          <div class="brand"><img src="/assets/logo.png" alt=""><div><b>KDS ADMIN</b><small>Control panel</small></div></div>
          ${TABS.map(([id, l]) => `<button class="tab${tab === id ? ' active' : ''}" data-tab="${id}">${l}${counts[id] ? `<span class="count">${counts[id]}</span>` : ''}</button>`).join('')}
          <div class="spacer"></div>
          <a class="tab" href="/" target="_blank">↗ View website</a>
          <button class="tab" id="logout">Log out</button>
        </aside>
        <main class="main" id="main"></main>
      </div>`;
    $$('.tab[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; shell(); }));
    $('#logout').addEventListener('click', async () => { await api('POST', '/api/admin/logout').catch(() => {}); boot(); });
    const main = $('#main');
    if (tab === 'overview') overview(main);
    else if (COLS[tab]) listView(main, tab);
    else if (tab === 'messages') messages(main);
    else if (tab === 'sheet') sheetView(main);
    else settings(main);
  }
  async function reload() { await refresh(); const y = window.scrollY; shell(); window.scrollTo(0, y); }

  /* --------------------------------------------------------------- overview */
  function overview(main) {
    const items = [['services', 'Services'], ['plans', 'Pricing plans'], ['projects', 'Projects'], ['team', 'Team members']];
    main.innerHTML = `
      <div class="top"><h2>Welcome back 👋</h2><p>Everything you change here appears on the live website instantly.</p></div>
      <div class="stats">${items.map(([k, l]) => `<div class="stat" data-go="${k}"><b>${db[k].length}</b><span>${l}</span></div>`).join('')}
        <div class="stat" data-go="messages"><b>${newCount()}</b><span>New enquiries</span></div></div>
      ${!db.integrations.webhookUrl ? '<div class="hint-bar">📧 Email &amp; Google Sheet alerts for new enquiries are <b>not connected yet</b>. Open “Google Sheet &amp; Email” for the 10-minute setup.</div>' : ''}
      ${!db.plans.length ? '<div class="hint-bar">💡 The <b>Pricing</b> section is hidden on your site because there are no plans yet. Add one under “Pricing & Brochures”.</div>' : ''}
      ${!db.projects.length ? '<div class="hint-bar">💡 The <b>Projects</b> section is hidden because there are no projects yet.</div>' : ''}
      <div class="panel"><h3 style="font:800 18px var(--display);margin-bottom:10px">Quick tips</h3>
        <ul style="color:var(--mute);padding-left:20px;display:grid;gap:6px;font-size:14px">
          <li>Any field you leave empty is automatically hidden on the website.</li>
          <li>Use the <b>position number</b> in a form (or the ↑ ↓ buttons) to change the display order.</li>
          <li>Add your studio’s Instagram, LinkedIn, GitHub, YouTube and profile links in <b>Site settings</b>.</li>
          <li>Visitor enquiries from the contact form arrive under <b>Enquiries</b>.</li>
        </ul></div>`;
    $$('[data-go]', main).forEach((c) => c.addEventListener('click', () => { tab = c.dataset.go; shell(); }));
  }

  /* ------------------------------------------------------------- list views */
  function listView(main, key) {
    const C = COLS[key], list = db[key];
    main.innerHTML = `
      <div class="top"><h2>${C.name}</h2><span class="grow"></span><button class="btn primary" id="add">＋ Add ${C.one}</button><p>${C.desc}</p></div>
      ${list.length ? `<div class="list">${list.map((it, i) => {
        const r = C.row(it);
        return `<div class="row" data-id="${it.id}">
          <span class="pos">${i + 1}</span>
          ${r.thumb !== undefined ? (r.thumb ? `<img class="thumb${r.round ? ' round' : ''}" src="${esc(r.thumb)}" alt="">` : `<span class="thumb${r.round ? ' round' : ''}"></span>`) : ''}
          <div class="info"><b>${r.raw ? r.title : esc(r.title)}</b><small>${esc(r.sub || '')}</small></div>
          <div class="acts">
            <button class="btn sm icon" data-a="up" title="Move up" ${i === 0 ? 'disabled' : ''}>↑</button>
            <button class="btn sm icon" data-a="down" title="Move down" ${i === list.length - 1 ? 'disabled' : ''}>↓</button>
            <button class="btn sm" data-a="edit">Edit</button>
            <button class="btn sm danger" data-a="del">Delete</button>
          </div></div>`;
      }).join('')}</div>` : `<div class="empty">No ${C.name.toLowerCase()} yet.<br>${key === 'plans' || key === 'projects' ? 'The section stays hidden on the website until you add one.' : ''}</div>`}`;
    $('#add').addEventListener('click', () => openForm(key));
    $$('.row', main).forEach((row) => row.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-a]'); if (!b) return;
      const id = row.dataset.id, it = list.find((x) => x.id === id);
      try {
        if (b.dataset.a === 'edit') openForm(key, it);
        else if (b.dataset.a === 'del') { if (confirm(`Delete “${it.title || it.name}”? This cannot be undone.`)) { await api('DELETE', `/api/admin/${key}/${id}`); toast('Deleted'); reload(); } }
        else { await api('POST', `/api/admin/${key}/${id}/move`, { dir: b.dataset.a }); reload(); }
      } catch (err) { toast(err.message, 1); }
    }));
  }

  /* -------------------------------------------------------------- form modal */
  const STAR = '<svg viewBox="0 0 24 24"><path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.9L12 17.8 5.8 21.1 7 14.2 2 9.3l6.9-1z"/></svg>';
  function fieldHtml(f, item) {
    const v = getp(item || {}, f.k);
    const id = 'f_' + f.k.replace(/\W/g, '_');
    const hint = f.hint ? `<small>${esc(f.hint)}</small>` : '';
    const wrap = (inner) => `<div style="${f.half ? '' : ''}" class="${f.half ? 'half' : ''}">${inner}</div>`;
    switch (f.t) {
      case 'textarea': return wrap(`<label class="f"><span>${f.l}</span><textarea data-k="${f.k}" placeholder="${esc(f.ph || '')}">${esc(v || '')}</textarea>${hint}</label>`);
      case 'lines': return wrap(`<label class="f"><span>${f.l}</span><textarea data-k="${f.k}" rows="6" data-t="lines">${esc((v || []).join('\n'))}</textarea>${hint}</label>`);
      case 'tags': return wrap(`<label class="f"><span>${f.l}</span><input type="text" data-k="${f.k}" data-t="tags" value="${esc((v || []).join(', '))}">${hint}</label>`);
      case 'select': return wrap(`<label class="f"><span>${f.l}</span><select data-k="${f.k}">${f.opts.map(([o, l]) => `<option value="${o}"${v === o ? ' selected' : ''}>${l}</option>`).join('')}</select></label>`);
      case 'check': return wrap(`<label class="check"><input type="checkbox" data-k="${f.k}" data-t="check"${v ? ' checked' : ''}><span>${f.l}</span></label>`);
      case 'stars': {
        const n = Math.max(0, Math.min(5, v | 0));
        return wrap(`<div class="f"><span class="lbl">${f.l} (0–5 stars)</span><div class="starpick" data-k="${f.k}" data-t="stars" data-value="${n}">
          ${[1, 2, 3, 4, 5].map((i) => `<button type="button" data-s="${i}" class="${i <= n ? 'on' : ''}" aria-label="${i} stars">${STAR}</button>`).join('')}
          <button type="button" class="btn sm" data-s="0">Clear</button><span class="val">${n} / 5</span></div><small class="hint">0 stars = rating hidden on the site.</small></div>`);
      }
      case 'image': case 'file': {
        const accept = f.t === 'image' ? 'image/*' : (f.accept || '');
        const crop = f.t === 'image' ? ` data-crop="${f.aspect || 1}" data-out="${f.out || 800}" data-round="${f.round ? 1 : 0}"` : '';
        const local = /^\/uploads\//.test(v || '');
        return wrap(`<div class="f"><span class="lbl">${f.l}</span>
          <div class="upl">${f.t === 'image' ? `<div class="prev">${isImg(v) || local ? `<img src="${esc(v)}" alt="">` : 'No image'}</div>` : ''}
            <input type="text" data-k="${f.k}" data-t="url" value="${esc(v || '')}" placeholder="Paste a link, or upload →">
            <label class="btn sm">Upload<input type="file" hidden accept="${accept}" data-up="${f.k}"${crop}></label>
            ${f.t === 'image' ? `<button type="button" class="btn sm" data-recrop${local ? '' : ' hidden'}>Re-crop</button>` : ''}
          </div><div class="progress" hidden><i></i></div>${hint}</div>`);
      }
      default: return wrap(`<label class="f"><span>${f.l}${f.req ? ' *' : ''}</span><input type="text" id="${id}" data-k="${f.k}" value="${esc(v || '')}" placeholder="${esc(f.ph || '')}"${f.req ? ' required' : ''}>${hint}</label>`);
    }
  }
  function formBody(fields, item) {
    let html = '', buf = '';
    const flush = () => { if (buf) { html += `<div class="grid2">${buf}</div>`; buf = ''; } };
    for (const f of fields) {
      if (f.group) { flush(); html += `<fieldset><legend>${f.group}</legend>${formBody(f.fields, item)}</fieldset>`; continue; }
      if (f.half) buf += fieldHtml(f, item); else { flush(); html += fieldHtml(f, item); }
    }
    flush(); return html;
  }
  function openForm(key, item) {
    const C = COLS[key], list = db[key], editing = !!item;
    const pos = editing ? list.findIndex((x) => x.id === item.id) + 1 : list.length + 1;
    const ov = document.createElement('div'); ov.className = 'overlay'; ov.id = 'modal';
    ov.innerHTML = `<div class="modal"><h3>${editing ? 'Edit' : 'Add'} ${C.one}<button class="btn sm x" type="button" data-close>✕</button></h3>
      <form>${formBody(C.fields, item)}
        <label class="f"><span>Display position</span><input type="number" min="1" max="${list.length + (editing ? 0 : 1)}" data-k="position" value="${pos}"><small>1 = shown first. Change this to place it anywhere in the order.</small></label>
        <p class="err-text" id="form-err"></p>
        <div class="foot"><button class="btn" type="button" data-close>Cancel</button><button class="btn primary" type="submit">${editing ? 'Save changes' : 'Add'}</button></div>
      </form></div>`;
    document.body.appendChild(ov); document.body.style.overflow = 'hidden';
    ov.addEventListener('mousedown', (e) => { if (e.target === ov) ov._md = true; });
    ov.addEventListener('click', (e) => { if (e.target.closest('[data-close]') || (e.target === ov && ov._md)) closeModal(); ov._md = false; });
    wireStars(ov); wireUploads(ov);
    $('form', ov).addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = {};
      $$('[data-k]', ov).forEach((el) => {
        const k = el.dataset.k, t = el.dataset.t; let val;
        if (t === 'check') val = el.checked;
        else if (t === 'stars') val = +el.dataset.value;
        else if (t === 'tags') val = el.value.split(',').map((s) => s.trim()).filter(Boolean);
        else val = el.value;
        setp(body, k, val);
      });
      const btn = $('button[type=submit]', ov); btn.disabled = true;
      try {
        if (editing) await api('PUT', `/api/admin/${key}/${item.id}`, body); else await api('POST', `/api/admin/${key}`, body);
        closeModal(); toast(editing ? 'Saved ✓' : 'Added ✓'); reload();
      } catch (err) { $('#form-err').textContent = err.message; btn.disabled = false; }
    });
  }
  function closeModal() { const m = $('#modal'); if (m) m.remove(); document.body.style.overflow = ''; }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  function wireStars(root) {
    $$('.starpick', root).forEach((sp) => sp.addEventListener('click', (e) => {
      const b = e.target.closest('[data-s]'); if (!b) return;
      const n = +b.dataset.s; sp.dataset.value = n;
      $$('button[data-s]', sp).forEach((x) => x.classList.toggle('on', +x.dataset.s >= 1 && +x.dataset.s <= n));
      $('.val', sp).textContent = n + ' / 5';
    }));
  }
  function sendFile(blob, name, wrap) {
    const bar = $('.progress', wrap), fill = $('i', bar), text = $('input[data-k]', wrap), prev = $('.prev', wrap), rec = $('[data-recrop]', wrap);
    bar.hidden = false; fill.style.width = '0';
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/admin/upload?name=' + encodeURIComponent(name));
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) fill.style.width = (e.loaded / e.total) * 100 + '%'; };
    xhr.onload = () => {
      bar.hidden = true; let j = {}; try { j = JSON.parse(xhr.responseText); } catch (e) {}
      if (xhr.status !== 200) return toast(j.error || 'Upload failed', 1);
      const isPic = /\.(png|jpe?g|webp|gif)$/i.test(j.url);
      text.value = j.url; if (prev) prev.innerHTML = isPic ? `<img src="${esc(j.url)}" alt="">` : 'File ✓';
      if (rec) rec.hidden = !isPic;
      toast('Uploaded ✓');
    };
    xhr.onerror = () => { bar.hidden = true; toast('Upload failed', 1); };
    xhr.send(blob);
  }
  function wireUploads(root) {
    $$('input[type=file][data-up]', root).forEach((inp) => inp.addEventListener('change', async () => {
      const file = inp.files[0]; if (!file) return;
      const wrap = inp.closest('.f');
      const isImage = /^image\//.test(file.type) || /\.(png|jpe?g|webp|gif)$/i.test(file.name);
      if (inp.dataset.crop && isImage) {
        const out = await openCropper(file, { aspect: +inp.dataset.crop, out: +inp.dataset.out, round: inp.dataset.round === '1' });
        inp.value = ''; if (!out) return; // cancelled → nothing is uploaded
        return sendFile(out.blob, out.name, wrap);
      }
      sendFile(file, file.name, wrap); inp.value = '';
    }));
    // "Re-crop" an already-uploaded image
    $$('[data-recrop]', root).forEach((btn) => btn.addEventListener('click', async () => {
      const wrap = btn.closest('.f'), text = $('input[data-k]', wrap), file = $('input[type=file]', wrap);
      if (!/^\/uploads\//.test(text.value)) return toast('Only uploaded images can be re-cropped', 1);
      try {
        const blob = await (await fetch(text.value)).blob();
        const out = await openCropper(blob, { aspect: +file.dataset.crop, out: +file.dataset.out, round: file.dataset.round === '1', name: text.value.split('/').pop() });
        if (out) sendFile(out.blob, out.name, wrap);
      } catch (e) { toast('Could not open that image', 1); }
    }));
  }

  /* ------------------------------------------------------------ image cropper */
  // Opens a dialog with a fixed-shape frame. Drag the picture to move it, scroll / slider to zoom.
  // Resolves { blob, name } containing ONLY the area inside the frame, or null if cancelled.
  function openCropper(file, cfg) {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onerror = () => { URL.revokeObjectURL(url); toast('Could not read that image', 1); resolve(null); };
      img.onload = () => build();
      img.src = url;

      function build() {
        const iw = img.naturalWidth, ih = img.naturalHeight, aspect = cfg.aspect || 1;
        const ov = document.createElement('div'); ov.className = 'overlay crop-ov';
        ov.innerHTML = `<div class="modal crop-modal" role="dialog" aria-label="Crop image">
          <h3>Crop image<button class="btn sm x" type="button" data-x>✕</button></h3>
          <p class="hint">Drag the picture to position it · scroll or use the slider to zoom. <b>Only the area inside the frame is saved.</b></p>
          <div class="crop-stage"><img alt="" draggable="false"><div class="crop-frame${cfg.round ? ' round' : ''}"></div></div>
          <div class="crop-controls"><span>🔍−</span><input type="range" min="1" max="4" step="0.005" value="1" aria-label="Zoom"><span>🔍+</span><button type="button" class="btn sm" data-reset>Reset</button></div>
          <p class="crop-info"></p>
          <div class="foot"><button class="btn" type="button" data-x>Cancel</button><button class="btn primary" type="button" data-ok>Use cropped image</button></div></div>`;
        document.body.appendChild(ov);
        const stage = $('.crop-stage', ov), im = $('img', stage), frame = $('.crop-frame', stage), slider = $('input[type=range]', ov), info = $('.crop-info', ov);
        im.src = url;

        const SW = Math.min(560, window.innerWidth - 56), SH = Math.min(420, Math.max(240, window.innerHeight * 0.5));
        stage.style.width = SW + 'px'; stage.style.height = SH + 'px';
        let fw = Math.min(SW - 36, (SH - 36) * aspect), fh = fw / aspect;
        if (fh > SH - 36) { fh = SH - 36; fw = fh * aspect; }
        frame.style.width = fw + 'px'; frame.style.height = fh + 'px';

        const sMin = Math.max(fw / iw, fh / ih);       // image just covers the frame
        let z = 1, ox = 0, oy = 0;                      // zoom factor, image-centre offset from frame centre (px)
        const clamp = () => {
          const mx = Math.max(0, (iw * sMin * z - fw) / 2), my = Math.max(0, (ih * sMin * z - fh) / 2);
          ox = Math.min(mx, Math.max(-mx, ox)); oy = Math.min(my, Math.max(-my, oy));
        };
        const render = () => {
          clamp(); const s = sMin * z;
          im.style.width = iw * s + 'px'; im.style.height = ih * s + 'px';
          im.style.left = SW / 2 + ox - (iw * s) / 2 + 'px'; im.style.top = SH / 2 + oy - (ih * s) / 2 + 'px';
          slider.value = z;
          const sw = fw / s; info.textContent = `Selected area: ${Math.round(sw)} × ${Math.round(fh / s)} px` + (sw < (cfg.out || 800) * 0.6 ? ' — low resolution, may look soft' : '');
        };
        render();

        let drag = null;
        stage.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, ox, oy }; stage.setPointerCapture(e.pointerId); stage.classList.add('grab'); });
        stage.addEventListener('pointermove', (e) => { if (!drag) return; ox = drag.ox + e.clientX - drag.x; oy = drag.oy + e.clientY - drag.y; render(); });
        const up = () => { drag = null; stage.classList.remove('grab'); };
        stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
        stage.addEventListener('wheel', (e) => { e.preventDefault(); z = Math.min(4, Math.max(1, z * (e.deltaY < 0 ? 1.08 : 1 / 1.08))); render(); }, { passive: false });
        slider.addEventListener('input', () => { z = +slider.value; render(); });
        $('[data-reset]', ov).addEventListener('click', () => { z = 1; ox = 0; oy = 0; render(); });

        const onKey = (e) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); close(null); } };
        window.addEventListener('keydown', onKey, true);
        function close(result) { window.removeEventListener('keydown', onKey, true); ov.remove(); URL.revokeObjectURL(url); resolve(result); }
        $$('[data-x]', ov).forEach((b) => b.addEventListener('click', () => close(null)));

        $('[data-ok]', ov).addEventListener('click', () => {
          const s = sMin * z, sw = fw / s, sh = fh / s;
          const sx = Math.max(0, Math.min(iw - sw, iw / 2 - (fw / 2 + ox) / s)), sy = Math.max(0, Math.min(ih - sh, ih / 2 - (fh / 2 + oy) / s));
          const ow = Math.max(40, Math.min(cfg.out || 800, Math.round(sw))), oh = Math.round(ow / aspect); // never upscale
          const c = document.createElement('canvas'); c.width = ow; c.height = oh;
          const ctx = c.getContext('2d'); ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(im, sx, sy, sw, sh, 0, 0, ow, oh);
          c.toBlob((blob) => {
            if (!blob) { toast('Could not crop this image', 1); return; }
            const ext = blob.type === 'image/webp' ? 'webp' : blob.type === 'image/png' ? 'png' : 'jpg';
            const base = (cfg.name || file.name || 'image').replace(/\.[^.]+$/, '').replace(/-cropped$/, '').replace(/-[0-9a-f]{12}$/, '').slice(0, 40) || 'image';
            close({ blob, name: `${base}-cropped.${ext}` });
          }, 'image/webp', 0.92);
        });
      }
    });
  }

  /* ---------------------------------------------------------------- enquiries */
  const enq = { q: '', status: 'all' };
  const STATUS = [['new', 'New'], ['contacted', 'Contacted'], ['done', 'Done']];
  function syncBadge(m) {
    if (m.sync === 'sent') return '<span class="pill ok" title="Saved to Google Sheet and emailed">Sheet ✓</span>';
    if (m.sync === 'failed') return `<span class="pill bad" title="${esc(m.syncError || '')}">Sheet ✗</span>`;
    if (m.sync === 'pending') return '<span class="pill">Sending…</span>';
    return '<span class="pill off" title="Google Sheet not connected">Sheet off</span>';
  }
  function enquiryCards(list) {
    if (!list.length) return '<div class="empty">No enquiries match.</div>';
    return list.map((m) => `
      <div class="msg ${m.status}" data-id="${m.id}">
        <div class="msg-head"><b>${esc(m.name)}</b>${m.service ? `<span class="pill">${esc(m.service)}</span>` : ''}${m.plan ? `<span class="pill">Plan: ${esc(m.plan)}</span>` : ''}${syncBadge(m)}
          <span style="flex:1"></span><small style="color:var(--mute)">${new Date(m.date).toLocaleString()}</small></div>
        <div class="meta">${m.email ? `<a href="mailto:${esc(m.email)}?subject=${encodeURIComponent('Re: your enquiry to KDS')}">✉ ${esc(m.email)}</a>` : ''}${m.phone ? `<a href="tel:${esc(m.phone)}">☎ ${esc(m.phone)}</a>` : ''}</div>
        <p>${esc(m.message)}</p>
        ${m.sync === 'failed' && m.syncError ? `<small class="err-text">Sheet error: ${esc(m.syncError)}</small>` : ''}
        <div class="msg-actions">
          <select data-a="status" class="status-sel">${STATUS.map(([v, l]) => `<option value="${v}"${m.status === v ? ' selected' : ''}>${l}</option>`).join('')}</select>
          ${db.integrations.webhookUrl && m.sync !== 'sent' ? '<button class="btn sm" data-a="resend">Resend to Sheet</button>' : ''}
          <button class="btn sm danger" data-a="del">Delete</button>
        </div>
      </div>`).join('');
  }
  function filteredEnquiries() {
    const q = enq.q.toLowerCase();
    return db.messages.filter((m) => (enq.status === 'all' || m.status === enq.status) && (!q || [m.name, m.email, m.phone, m.service, m.plan, m.message].join(' ').toLowerCase().includes(q)));
  }
  function messages(main) {
    const n = newCount();
    main.innerHTML = `<div class="top"><h2>Enquiries</h2><span class="grow"></span><button class="btn" id="csv">⬇ Export CSV</button>
      <p>Every request sent through the website contact form lands here — ${n ? `<b style="color:var(--gold)">${n} new</b>` : 'no new ones right now'}.</p></div>
      <div class="toolbar"><input type="text" id="enq-q" placeholder="Search name, phone, email, requirement…" value="${esc(enq.q)}">
        <select id="enq-s">${[['all', 'All'], ...STATUS].map(([v, l]) => `<option value="${v}"${enq.status === v ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
      ${!db.integrations.webhookUrl ? '<div class="hint-bar">📧 Want these emailed to you and saved in Google Sheets too? Set it up under <b>Google Sheet &amp; Email</b>.</div>' : ''}
      <div class="list" id="enq-list">${enquiryCards(filteredEnquiries())}</div>`;
    const redraw = () => { $('#enq-list').innerHTML = enquiryCards(filteredEnquiries()); };
    $('#enq-q').addEventListener('input', (e) => { enq.q = e.target.value; redraw(); });
    $('#enq-s').addEventListener('change', (e) => { enq.status = e.target.value; redraw(); });
    $('#csv').addEventListener('click', () => {
      const rows = [['Received', 'Name', 'Email', 'Phone', 'Service', 'Plan', 'Requirement', 'Status']].concat(db.messages.map((m) => [m.date, m.name, m.email, m.phone, m.service, m.plan, m.message, m.status]));
      const csv = rows.map((r) => r.map((c) => '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"').join(',')).join('\r\n');
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' })); a.download = 'kds-enquiries.csv'; a.click();
    });
    const list = $('#enq-list');
    list.addEventListener('change', async (e) => {
      const sel = e.target.closest('select[data-a=status]'); if (!sel) return;
      try { await api('PUT', `/api/admin/messages/${sel.closest('.msg').dataset.id}`, { status: sel.value }); await reload(); } catch (err) { toast(err.message, 1); }
    });
    list.addEventListener('click', async (e) => {
      const b = e.target.closest('button[data-a]'); if (!b) return;
      const id = b.closest('.msg').dataset.id;
      try {
        if (b.dataset.a === 'resend') { b.disabled = true; b.textContent = 'Sending…'; const r = await api('POST', `/api/admin/messages/${id}/resend`); toast(r.sync === 'sent' ? 'Sent to Google Sheet ✓' : 'Failed: ' + (r.syncError || 'unknown error'), r.sync !== 'sent'); }
        else if (b.dataset.a === 'del') { if (!confirm('Delete this enquiry? This cannot be undone.')) return; await api('DELETE', `/api/admin/messages/${id}`); }
        await reload();
      } catch (err) { toast(err.message, 1); }
    });
  }

  /* ---------------------------------------------------- Google Sheet & email */
  function sheetView(main) {
    const it = db.integrations || {};
    const on = !!it.webhookUrl;
    main.innerHTML = `
      <div class="top"><h2>Google Sheet &amp; Email</h2><p>Get every enquiry as a row in Google Sheets <b>and</b> an email to 287kushal@gmail.com (plus a phone alert via the Gmail app).</p></div>
      <div class="hint-bar" style="${on ? 'border-color:rgba(120,220,140,.5);color:#bfe9c8' : ''}">${on ? '✅ Connected — new enquiries are forwarded automatically.' : '⚠ Not connected yet. Follow the steps below (about 10 minutes), then paste the two values in the form.'}</div>

      <div class="panel" style="margin-bottom:22px"><h3 class="h3">Connect</h3>
        <form id="hook-form" style="display:grid;gap:14px">
          <label class="f"><span>Apps Script web app URL</span><input type="text" data-k="webhookUrl" value="${esc(it.webhookUrl || '')}" placeholder="https://script.google.com/macros/s/…/exec" autocomplete="off"></label>
          <label class="f"><span>Secret key</span><input type="password" data-k="secret" value="${esc(it.secret || '')}" placeholder="Same secret you put in the script" autocomplete="off"><small>Must be exactly the same as <code>SECRET</code> in the script — it stops strangers posting to your sheet.</small></label>
          <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn primary" type="submit">Save</button><button class="btn" type="button" id="hook-test">Send test enquiry</button></div>
          <p class="err-text" id="hook-err"></p>
        </form></div>

      <div class="panel steps"><h3 class="h3">Setup steps</h3>
        <ol>
          <li><b>Create a Google Sheet</b> — go to <a href="https://sheets.google.com" target="_blank" rel="noopener">sheets.google.com</a> → Blank spreadsheet → name it <i>KDS Enquiries</i> (use 287kushal@gmail.com).</li>
          <li><b>Open the script editor</b> — in the sheet click <i>Extensions → Apps Script</i>. Delete the default code.</li>
          <li><b>Paste the script</b> — click <i>Copy script</i> below, paste it in the editor.</li>
          <li><b>Set your secret</b> — change <code>SECRET = '…'</code> at the top to a long random text (20+ characters). <code>NOTIFY_EMAIL</code> is already 287kushal@gmail.com. Click 💾 Save.</li>
          <li><b>Authorise once</b> — choose function <code>testSetup</code> → ▶ Run → Review permissions → pick your account → Advanced → <i>Go to project (unsafe)</i> → Allow. A test email arrives.</li>
          <li><b>Deploy</b> — <i>Deploy → New deployment</i> → ⚙ → <b>Web app</b> → Execute as: <b>Me</b>, Who has access: <b>Anyone</b> → Deploy → copy the <b>Web app URL</b> (ends in <code>/exec</code>).</li>
          <li><b>Connect</b> — paste the URL and the same secret in the form above → Save → <b>Send test enquiry</b>. You should see a new row in the sheet and an email in your inbox.</li>
          <li><b>(Optional)</b> Install the Gmail app on your phone for instant notifications. Run <code>createDailyReminder</code> once to get a 9 am email listing enquiries still marked “New”.</li>
        </ol>
        <p class="hint">Edited the script later? <i>Deploy → Manage deployments → ✏ → Version: New version → Deploy</i>. Full guide with troubleshooting: <code>SETUP-GOOGLE-SHEETS.md</code> in the project folder.</p>
      </div>

      <div class="panel" style="margin-top:22px"><h3 class="h3" style="display:flex;align-items:center;gap:12px">Apps Script code <span style="flex:1"></span><button class="btn sm primary" id="copy-code" type="button">Copy script</button></h3>
        <pre class="code" id="code-box">Loading…</pre></div>`;
    $('#hook-form').addEventListener('submit', async (e) => {
      e.preventDefault(); $('#hook-err').textContent = '';
      try {
        const body = {}; $$('#hook-form [data-k]').forEach((el) => (body[el.dataset.k] = el.value.trim()));
        await api('PUT', '/api/admin/integrations', body); toast('Saved ✓'); await reload();
      } catch (err) { $('#hook-err').textContent = err.message; }
    });
    $('#hook-test').addEventListener('click', async (e) => {
      const b = e.target; b.disabled = true; b.textContent = 'Sending…'; $('#hook-err').textContent = '';
      try { await api('POST', '/api/admin/integrations/test'); toast('Test sent ✓ — check your sheet and inbox'); }
      catch (err) { $('#hook-err').textContent = '✗ ' + err.message; }
      b.disabled = false; b.textContent = 'Send test enquiry';
    });
    let code = '';
    api('GET', '/api/admin/apps-script').then((r) => { code = r.code; $('#code-box').textContent = code; }).catch(() => { $('#code-box').textContent = 'Could not load google-apps-script/Code.gs'; });
    $('#copy-code').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(code); toast('Script copied ✓ — paste it in the Apps Script editor'); }
      catch (e) { const r = document.createRange(); r.selectNodeContents($('#code-box')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); toast('Press Ctrl+C to copy', 1); }
    });
  }

  /* ------------------------------------------------- new-enquiry notifications */
  setInterval(async () => {
    if (!db || document.hidden) return;
    try {
      const { count } = await api('GET', '/api/admin/pending');
      const prev = newCount();
      if (count > prev) {
        toast('🔔 New enquiry received!');
        await refresh();
        if (!$('#modal') && (tab === 'messages' || tab === 'overview')) shell(); else document.title = `(${newCount()}) KDS Admin`;
      }
    } catch (e) { /* ignore */ }
  }, 30000);

  /* --------------------------------------------------------------- settings */
  function settings(main) {
    const s = db.settings;
    const t = (k, l, ph, hint) => `<label class="f"><span>${l}</span><input type="text" data-k="${k}" value="${esc(getp(s, k) || '')}" placeholder="${esc(ph || '')}">${hint ? `<small>${hint}</small>` : ''}</label>`;
    const ta = (k, l) => `<label class="f"><span>${l}</span><textarea data-k="${k}">${esc(getp(s, k) || '')}</textarea></label>`;
    const stats = (s.stats || []).concat(Array(4).fill({})).slice(0, 4);
    main.innerHTML = `
      <div class="top"><h2>Site settings</h2><p>Text, contact details and social links shown across the website. Empty fields are hidden.</p></div>
      <form id="settings-form" style="display:grid;gap:20px">
        <fieldset><legend>Hero & about</legend>
          ${t('heroTitle', 'Hero headline')}${ta('heroSubtitle', 'Hero sub-text')}${t('aboutTitle', 'About heading')}${ta('aboutText', 'About text')}
        </fieldset>
        <fieldset><legend>Brand</legend>
          <div class="grid2">${t('studioName', 'Short name', 'KDS')}${t('fullName', 'Full name', 'Kushal Developer Studios')}</div>
          ${t('founder', 'Footer “Made by” name', 'Kushal Aggarwal')}
        </fieldset>
        <fieldset><legend>Contact details</legend>
          <div class="grid2">${t('phone', 'Phone', '7676475904')}${t('email', 'Email', 'you@example.com')}</div>
          <div class="grid2">${t('whatsapp', 'WhatsApp number', '917676475904', 'Digits only, with country code. Powers the WhatsApp button.')}${t('address', 'Location / address', '')}</div>
        </fieldset>
        <fieldset><legend>KDS social links</legend>
          <div class="grid2">${t('socials.instagram', 'Instagram', 'https://instagram.com/…')}${t('socials.linkedin', 'LinkedIn', 'https://linkedin.com/…')}${t('socials.github', 'GitHub', 'https://github.com/…')}${t('socials.youtube', 'YouTube', 'https://youtube.com/@…')}</div>
          ${t('socials.profile', 'Profile link (portfolio / linktree)', 'https://…')}
        </fieldset>
        <fieldset><legend>Numbers on the About section</legend>
          <p class="hint">“Auto” counts your real projects / clients. Leave label empty to remove a stat.</p>
          ${stats.map((x, i) => `<div class="grid2" data-stat="${i}" style="grid-template-columns:110px 1fr 160px">
            <input type="text" data-sv placeholder="Value" value="${esc(x.value || '')}" maxlength="12">
            <input type="text" data-sl placeholder="Label" value="${esc(x.label || '')}">
            <select data-sa><option value="">Fixed value</option>${[['projects', 'Auto: projects'], ['clients', 'Auto: clients'], ['team', 'Auto: team'], ['services', 'Auto: services']].map(([o, l]) => `<option value="${o}"${x.auto === o ? ' selected' : ''}>${l}</option>`).join('')}</select></div>`).join('')}
        </fieldset>
        <div><button class="btn primary" type="submit">Save settings</button> <span class="err-text" id="set-err"></span></div>
      </form>
      <div class="panel" style="margin-top:34px"><h3 style="font:800 18px var(--display);margin-bottom:14px">Change admin password</h3>
        <form id="pw-form" style="display:grid;gap:12px;max-width:380px">
          <label class="f"><span>Current password</span><input type="password" name="current" required autocomplete="current-password"></label>
          <label class="f"><span>New password</span><input type="password" name="password" required minlength="8" autocomplete="new-password"></label>
          <button class="btn" type="submit">Update password</button><span class="err-text" id="pw-err"></span>
        </form></div>`;
    $('#settings-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = { socials: {} };
      $$('#settings-form [data-k]').forEach((el) => setp(body, el.dataset.k, el.value));
      body.stats = $$('#settings-form [data-stat]').map((r) => ({ value: $('[data-sv]', r).value, label: $('[data-sl]', r).value, auto: $('[data-sa]', r).value }));
      try { await api('PUT', '/api/admin/settings', body); toast('Settings saved ✓'); await refresh(); } catch (err) { $('#set-err').textContent = err.message; }
    });
    $('#pw-form').addEventListener('submit', async (e) => {
      e.preventDefault(); const f = new FormData(e.target);
      try { await api('POST', '/api/admin/password', { current: f.get('current'), password: f.get('password') }); toast('Password updated ✓'); e.target.reset(); $('#pw-err').textContent = ''; }
      catch (err) { $('#pw-err').textContent = err.message; }
    });
  }

  boot();
})();
