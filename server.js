/* KDS website server — zero dependencies (Node 18+).
 * Serves the public site, the admin panel and a small JSON API.
 * Data lives in ./data/db.json, uploads in ./data/uploads, admin auth in ./data/auth.json
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');

const PORT = parseInt(process.env.PORT, 10) || 3000;
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
// On a host with a persistent disk (e.g. Render) point DATA_DIR at the mounted disk so content survives restarts.
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data'));
const IS_PROD = process.env.NODE_ENV === 'production' || !!process.env.RENDER;
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const AUTH_FILE = path.join(DATA_DIR, 'auth.json');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

/* ------------------------------------------------ optional durable storage (GitHub data repo)
 * Free hosts (Render free plan) wipe the disk on every restart. If GH_DATA_REPO + GH_TOKEN are set,
 * db.json and every upload are also saved in a PRIVATE GitHub repo, and restored from it on start-up.
 * Zero dependencies — plain fetch() against the GitHub Contents API. */
const GH_API = (process.env.GH_API_URL || 'https://api.github.com').replace(/\/$/, '');
const GH = { repo: process.env.GH_DATA_REPO || '', token: process.env.GH_TOKEN || '', branch: process.env.GH_DATA_BRANCH || 'main' };
const REMOTE = !!(GH.repo && GH.token && /^[\w.-]+\/[\w.-]+$/.test(GH.repo));
const REMOTE_MAX_UPLOAD = 25 * 1024 * 1024; // files are sent through the GitHub API, so keep them modest

function ghFetch(method, p, body, accept) {
  const url = `${GH_API}/repos/${GH.repo}/contents/${p.split('/').map(encodeURIComponent).join('/')}` + (method === 'GET' ? `?ref=${encodeURIComponent(GH.branch)}` : '');
  return fetch(url, {
    method,
    headers: Object.assign({ Authorization: 'Bearer ' + GH.token, Accept: accept || 'application/vnd.github+json', 'User-Agent': 'kds-website', 'X-GitHub-Api-Version': '2022-11-28' }, body ? { 'Content-Type': 'application/json' } : {}),
    body: body ? JSON.stringify(body) : undefined
  });
}
async function ghSha(p) {
  const r = await ghFetch('GET', p);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('GitHub ' + r.status);
  return (await r.json()).sha || null;
}
async function ghGetRaw(p) {
  const r = await ghFetch('GET', p, null, 'application/vnd.github.raw+json');
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('GitHub ' + r.status);
  return Buffer.from(await r.arrayBuffer());
}
async function ghPut(p, buf, message) {
  for (let i = 0; i < 3; i++) {
    const sha = await ghSha(p);
    const r = await ghFetch('PUT', p, Object.assign({ message, content: buf.toString('base64'), branch: GH.branch }, sha ? { sha } : {}));
    if (r.ok) return;
    if (r.status !== 409 && r.status !== 422) throw new Error('GitHub ' + r.status + ' ' + (await r.text()).slice(0, 160));
  }
  throw new Error('GitHub conflict — try again');
}
let pushTimer = null, pushing = false, dirty = false;
function queuePush() { dirty = true; clearTimeout(pushTimer); pushTimer = setTimeout(() => pushNow().catch(() => {}), 2500); }
async function pushNow() {
  if (pushing) { dirty = true; return; }
  pushing = true;
  try {
    while (dirty) {
      dirty = false;
      try { await ghPut('db.json', fs.readFileSync(DB_FILE), 'Update site data'); }
      catch (e) { dirty = true; console.error('Saving to the data repo failed (will retry):', e.message); setTimeout(queuePush, 30000).unref(); break; }
    }
  } finally { pushing = false; }
}
async function pullRemote() {
  // Refuse to start if the repo can't be reached — otherwise we could overwrite real data with an empty site.
  for (let i = 1; i <= 5; i++) {
    try {
      const chk = await fetch(`${GH_API}/repos/${GH.repo}`, { headers: { Authorization: 'Bearer ' + GH.token, Accept: 'application/vnd.github+json', 'User-Agent': 'kds-website' } });
      if (!chk.ok) throw new Error(`cannot open data repo "${GH.repo}" (HTTP ${chk.status}) — check GH_DATA_REPO and that GH_TOKEN has Contents read/write access to it`);
      const buf = await ghGetRaw('db.json');
      if (buf) { fs.writeFileSync(DB_FILE, buf); console.log('  Restored site data from GitHub (' + GH.repo + ').'); }
      else console.log('  Data repo has no db.json yet — starting with the default content.');
      return;
    } catch (e) {
      console.error(`Data repo not ready (try ${i}/5): ${e.message}`);
      if (i === 5) throw e;
      await new Promise((r) => setTimeout(r, 3000 * i));
    }
  }
}
const pulling = new Map();
function ensureUpload(file, name) { // fetch an uploaded file back from the data repo if the local copy is gone
  if (fs.existsSync(file)) return Promise.resolve(true);
  if (!REMOTE || !/^[A-Za-z0-9._-]+$/.test(name)) return Promise.resolve(false);
  if (!pulling.has(name)) {
    pulling.set(name, (async () => {
      try { const buf = await ghGetRaw('uploads/' + name); if (!buf) return false; fs.writeFileSync(file, buf); return true; }
      catch (e) { console.error('Could not restore upload ' + name + ':', e.message); return false; }
      finally { pulling.delete(name); }
    })());
  }
  return pulling.get(name);
}

/* ------------------------------------------------------------------ defaults */
const uid = () => crypto.randomBytes(6).toString('hex');

function defaultDb() {
  return {
    settings: {
      studioName: 'KDS',
      fullName: 'Kushal Developer Studios',
      heroTitle: 'We build digital experiences that shine.',
      heroSubtitle:
        'KDS is a developer studio crafting premium websites, apps, videos and business systems — engineered with precision, finished in gold.',
      aboutTitle: 'A studio built on craft, speed and trust.',
      aboutText:
        'KDS — Kushal Developer Studios — turns ideas into polished digital products. From a first sketch to a live launch, we design, build and manage everything you need to grow online, so you can focus on your business.',
      phone: '7676475904',
      email: '287kushal@gmail.com',
      whatsapp: '917676475904',
      address: '',
      socials: { instagram: '', linkedin: '', github: '', youtube: '', profile: '' },
      stats: [
        { value: '', label: 'Projects delivered', auto: 'projects' },
        { value: '', label: 'Happy clients', auto: 'clients' },
        { value: '24h', label: 'Average response time', auto: '' },
        { value: '100%', label: 'Passion for craft', auto: '' }
      ],
      founder: 'Kushal Aggarwal'
    },
    services: [
      { id: uid(), icon: 'social', title: 'Social Media Management', description: 'Content calendars, designs, reels and community management that grow your audience and keep your brand consistently on-point.' },
      { id: uid(), icon: 'web', title: 'Website Building', description: 'Fast, responsive, beautifully animated websites and web apps — from landing pages to full custom platforms.' },
      { id: uid(), icon: 'video', title: 'Video Editing', description: 'Cinematic edits, reels, promos and YouTube content with motion graphics, colour grading and sound design.' },
      { id: uid(), icon: 'business', title: 'Personal Business Management Solutions', description: 'Custom dashboards, automation and tools to run your bookings, billing, customers and daily operations smoothly.' },
      { id: uid(), icon: 'app', title: 'Android & App Development', description: 'Native-feel mobile apps and APKs for your idea or business, built, tested and ready to ship.' },
      { id: uid(), icon: 'design', title: 'Branding & UI/UX Design', description: 'Logos, brand identities and interface design that make your product look premium and feel effortless.' }
    ],
    plans: [],
    projects: [],
    team: [
      { id: uid(), name: 'Kushal Aggarwal', position: 'Founder & Lead Developer', photo: '', bio: '', socials: { instagram: '', github: '', linkedin: '', youtube: '' } }
    ],
    messages: [],
    integrations: { webhookUrl: '', secret: '' }
  };
}

let db;
function loadDb() {
  try {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    const d = defaultDb();
    db.settings = Object.assign({}, d.settings, db.settings || {});
    db.settings.socials = Object.assign({}, d.settings.socials, (db.settings || {}).socials || {});
    for (const k of ['services', 'plans', 'projects', 'team', 'messages']) if (!Array.isArray(db[k])) db[k] = d[k];
    db.integrations = Object.assign({ webhookUrl: '', secret: '' }, db.integrations || {});
    // older messages used a "read" flag; map it to a status
    db.messages.forEach((m) => { if (!m.status) m.status = m.read ? 'contacted' : 'new'; if (!m.sync) m.sync = 'off'; });
  } catch (e) {
    // never silently throw away an unreadable database: keep a copy of it before starting fresh
    if (fs.existsSync(DB_FILE)) {
      try { fs.copyFileSync(DB_FILE, DB_FILE + '.broken-' + Date.now()); } catch (x) { /* ignore */ }
      console.error('db.json could not be read (' + e.message + ') — a backup copy was kept.');
    }
    db = defaultDb();
    saveDb();
  }
  // Keep the Google Sheet hook working even if the data disk is wiped: fall back to environment variables.
  if (!db.integrations.webhookUrl && process.env.KDS_WEBHOOK_URL) {
    db.integrations.webhookUrl = process.env.KDS_WEBHOOK_URL;
    db.integrations.secret = db.integrations.secret || process.env.KDS_WEBHOOK_SECRET || '';
  }
}
let saveTimer = null;
function saveDb() {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
  if (REMOTE) queuePush();
}

/* ---------------------------------------------------------------------- auth */
let auth = null;
try { auth = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8')); } catch (e) { auth = null; }
function saveAuth() { fs.writeFileSync(AUTH_FILE, JSON.stringify(auth)); }

function hashPassword(pw, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(pw, salt, 64).toString('hex');
  return { salt, hash };
}
function checkPassword(pw) {
  if (!auth) return false;
  const { hash } = hashPassword(String(pw), auth.salt);
  const a = Buffer.from(hash, 'hex'), b = Buffer.from(auth.hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
// ADMIN_PASSWORD (env) creates the admin login when none exists yet.
// To force a reset later, set ADMIN_PASSWORD_RESET=true together with the new ADMIN_PASSWORD, redeploy, then remove the reset variable.
if (process.env.ADMIN_PASSWORD && (!auth || process.env.ADMIN_PASSWORD_RESET === 'true')) {
  const { salt, hash } = hashPassword(process.env.ADMIN_PASSWORD);
  auth = { salt, hash, secret: crypto.randomBytes(32).toString('hex') };
  saveAuth();
  console.log('  Admin password set from ADMIN_PASSWORD.');
}
// With remote storage the disk is throw-away, so the login comes straight from the environment on every start
// (deterministic session key → you stay logged in across restarts).
let ENV_LOCKED = false;
if (REMOTE && process.env.ADMIN_PASSWORD) {
  const pw = process.env.ADMIN_PASSWORD;
  const salt = crypto.createHash('sha256').update('kds-salt:' + pw).digest('hex').slice(0, 32);
  auth = {
    salt, hash: hashPassword(pw, salt).hash,
    secret: crypto.createHmac('sha256', pw).update('kds-session-v1:' + (process.env.SESSION_SECRET || '')).digest('hex')
  };
  ENV_LOCKED = true;
}

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', auth.secret).update(body).digest('base64url');
  return body + '.' + sig;
}
function verify(token) {
  if (!auth || !token || typeof token !== 'string') return false;
  const [body, sig] = token.split('.');
  if (!body || !sig) return false;
  const good = crypto.createHmac('sha256', auth.secret).update(body).digest('base64url');
  const a = Buffer.from(sig), b = Buffer.from(good);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try { return JSON.parse(Buffer.from(body, 'base64url').toString()).exp > Date.now(); } catch (e) { return false; }
}
function getCookie(req, name) {
  const c = req.headers.cookie || '';
  for (const part of c.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return '';
}
const isAdmin = (req) => verify(getCookie(req, 'kds_admin'));

/* simple in-memory rate limiter */
const hits = new Map();
function limited(key, max, windowMs) {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(key, arr);
  return arr.length > max;
}
setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (!v.some((t) => now - t < 3600e3)) hits.delete(k); }, 600e3).unref();

/* ---------------------------------------------------------------- sanitizers */
const str = (v, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
function url(v) {
  v = str(v, 600);
  if (!v) return '';
  if (/^\/uploads\/[A-Za-z0-9._-]+$/.test(v)) return v;
  if (/^(https?:\/\/|mailto:|tel:)/i.test(v)) return v;
  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(v)) return 'https://' + v; // bare domain
  return '';
}
function handleUrl(v, base) { // allow "@name" for socials
  v = str(v, 300);
  if (!v) return '';
  if (/^@[A-Za-z0-9._-]+$/.test(v)) return base + v.slice(1);
  return url(v);
}
function lines(v, maxItems = 40, maxLen = 160) {
  const arr = Array.isArray(v) ? v : typeof v === 'string' ? v.split(/\r?\n/) : [];
  return arr.map((s) => str(String(s), maxLen)).filter(Boolean).slice(0, maxItems);
}
function socials(o, keys) {
  o = o || {};
  const bases = { instagram: 'https://instagram.com/', github: 'https://github.com/', linkedin: 'https://linkedin.com/in/', youtube: 'https://youtube.com/@', profile: '' };
  const out = {};
  for (const k of keys) out[k] = handleUrl(o[k], bases[k] || '');
  return out;
}
const ICONS = ['social', 'web', 'video', 'business', 'app', 'design', 'seo', 'cloud', 'ai', 'game', 'support', 'star'];

const schemas = {
  services: (b) => ({
    title: str(b.title, 90), description: str(b.description, 400),
    icon: ICONS.includes(b.icon) ? b.icon : 'star'
  }),
  plans: (b) => ({
    name: str(b.name, 60), price: str(b.price, 40), period: str(b.period, 30), tagline: str(b.tagline, 140),
    features: lines(b.features), featured: !!b.featured, badge: str(b.badge, 24),
    brochure: url(b.brochure), ctaLabel: str(b.ctaLabel, 30)
  }),
  projects: (b) => ({
    title: str(b.title, 90), description: str(b.description, 500), image: url(b.image),
    tags: lines(b.tags, 8, 24),
    links: { live: url(b.links && b.links.live), apk: url(b.links && b.links.apk), github: url(b.links && b.links.github), other: url(b.links && b.links.other) },
    otherLabel: str(b.otherLabel, 24),
    clientName: str(b.clientName, 70), clientRole: str(b.clientRole, 80), clientPhoto: url(b.clientPhoto),
    testimonial: str(b.testimonial, 700),
    rating: Math.max(0, Math.min(5, Math.round(Number(b.rating) || 0)))
  }),
  team: (b) => ({
    name: str(b.name, 70), position: str(b.position, 80), photo: url(b.photo), bio: str(b.bio, 240),
    socials: socials(b.socials, ['instagram', 'github', 'linkedin', 'youtube'])
  })
};
const required = { services: 'title', plans: 'name', projects: 'title', team: 'name' };

function cleanSettings(b, cur) {
  const s = {
    studioName: str(b.studioName, 40) || cur.studioName,
    fullName: str(b.fullName, 80) || cur.fullName,
    heroTitle: str(b.heroTitle, 140), heroSubtitle: str(b.heroSubtitle, 400),
    aboutTitle: str(b.aboutTitle, 140), aboutText: str(b.aboutText, 900),
    phone: str(b.phone, 30), email: str(b.email, 100), whatsapp: str(b.whatsapp, 20).replace(/[^\d]/g, ''),
    address: str(b.address, 200),
    socials: socials(b.socials, ['instagram', 'linkedin', 'github', 'youtube', 'profile']),
    founder: str(b.founder, 60),
    stats: (Array.isArray(b.stats) ? b.stats : []).slice(0, 6).map((x) => ({
      value: str(x && x.value, 12), label: str(x && x.label, 40), auto: ['projects', 'clients', 'team', 'services'].includes(x && x.auto) ? x.auto : ''
    })).filter((x) => x.label && (x.value || x.auto))
  };
  return s;
}

/* ------------------------------------------------------------------- helpers */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.pdf': 'application/pdf',
  '.apk': 'application/vnd.android.package-archive', '.zip': 'application/zip', '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2'
};
const UPLOAD_EXT = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.pdf', '.apk', '.zip'];
const MAX_UPLOAD = 150 * 1024 * 1024;

function send(res, code, body, headers = {}) {
  const isObj = body !== null && typeof body === 'object' && !Buffer.isBuffer(body);
  const data = isObj ? JSON.stringify(body) : body;
  res.writeHead(code, Object.assign({ 'Content-Type': isObj ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }, headers));
  res.end(data);
}
function readJson(req, limit = 1e6) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString() || '{}')); } catch (e) { reject(new Error('bad json')); } });
    req.on('error', reject);
  });
}
// Behind a host's proxy (Render) the socket address is the proxy, so read the forwarded client address.
const clientIp = (req) => String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '';
const isHttps = (req) => req.headers['x-forwarded-proto'] === 'https' || !!req.socket.encrypted;

function publicData() {
  const { settings, services, plans, projects, team } = db;
  return { settings, services, plans, projects, team };
}

const COMPRESSIBLE = new Set(['.html', '.css', '.js', '.json', '.svg', '.txt']);
const gzCache = new Map();
function serveFile(req, res, file, extra = {}) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, 'Not found');
    const ext = path.extname(file).toLowerCase();
    // Site files (html/css/js) are always revalidated so edits show up immediately for everyone.
    // Uploaded files get a unique name per upload, so they can be cached for long.
    const immutable = file.startsWith(UPLOAD_DIR + path.sep);
    const lastMod = st.mtime.toUTCString();
    const compressible = COMPRESSIBLE.has(ext) && st.size > 1024;
    const headers = Object.assign({
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': st.size,
      ...(compressible ? { 'Vary': 'Accept-Encoding' } : {}),
      'X-Content-Type-Options': 'nosniff',
      'Last-Modified': lastMod,
      'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache'
    }, extra);
    const ims = req.headers['if-modified-since'];
    if (!immutable && ims && new Date(ims).getTime() >= Math.floor(st.mtimeMs / 1000) * 1000) {
      res.writeHead(304, { 'Cache-Control': 'no-cache', 'Last-Modified': lastMod });
      return res.end();
    }
    if (req.method === 'HEAD') { res.writeHead(200, headers); return res.end(); }
    if (compressible && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
      const key = file + ':' + st.mtimeMs;
      const reply = (buf) => { headers['Content-Encoding'] = 'gzip'; headers['Content-Length'] = buf.length; res.writeHead(200, headers); res.end(buf); };
      const hit = gzCache.get(key);
      if (hit) return reply(hit);
      return fs.readFile(file, (e, data) => {
        if (e) return send(res, 404, 'Not found');
        if (gzCache.size > 150) gzCache.clear();
        const buf = zlib.gzipSync(data, { level: 9 }); gzCache.set(key, buf); reply(buf);
      });
    }
    res.writeHead(200, headers);
    fs.createReadStream(file).pipe(res);
  });
}
function safeJoin(base, rel) {
  const full = path.normalize(path.join(base, rel));
  return full.startsWith(base + path.sep) || full === base ? full : null;
}

/* ---------------------------------------------------- Google Sheet / email hook */
const WEBHOOK_RE = /^https:\/\/script\.google\.com\/(a\/macros\/[A-Za-z0-9.-]+\/)?macros\/s\/[A-Za-z0-9_-]+\/exec$/;

async function postToSheet(payload) {
  const { webhookUrl, secret } = db.integrations;
  if (!webhookUrl || !WEBHOOK_RE.test(webhookUrl)) return { ok: false, error: 'No valid Apps Script URL set' };
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    const r = await fetch(webhookUrl, {
      method: 'POST', redirect: 'follow', signal: ctrl.signal,
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // text/plain avoids a CORS-style preflight on Apps Script
      body: JSON.stringify(Object.assign({ secret }, payload))
    });
    clearTimeout(timer);
    const text = await r.text();
    let j = null; try { j = JSON.parse(text); } catch (e) { /* not json */ }
    if (j && j.ok) return { ok: true };
    if (j && j.error) return { ok: false, error: String(j.error).slice(0, 200) };
    return { ok: false, error: r.ok ? 'Unexpected reply — redeploy the script as “Anyone” access' : 'HTTP ' + r.status };
  } catch (e) {
    return { ok: false, error: (e.name === 'AbortError' ? 'Timed out' : e.message || 'Network error').slice(0, 200) };
  }
}
async function forwardToSheet(msg) {
  if (!db.integrations.webhookUrl) { msg.sync = 'off'; msg.syncError = ''; saveDb(); return; }
  msg.sync = 'pending'; msg.attempts = (msg.attempts || 0) + 1; msg.lastTry = Date.now(); saveDb();
  const r = await postToSheet({ id: msg.id, date: msg.date, name: msg.name, email: msg.email, phone: msg.phone, service: msg.service, plan: msg.plan, message: msg.message });
  msg.sync = r.ok ? 'sent' : 'failed'; msg.syncError = r.ok ? '' : r.error;
  saveDb();
}

// Automatic retry: enquiries whose Sheet/email forward failed (or got stuck) are retried every 5 minutes, up to 6 attempts.
// The Apps Script ignores duplicates by enquiry ID, so a retry can never create a second row or email.
let retrying = false;
async function retryFailed() {
  if (retrying || !db || !db.integrations.webhookUrl) return;
  retrying = true;
  try {
    const due = db.messages.filter((m) => (m.sync === 'failed' || m.sync === 'pending') && (m.attempts || 0) < 6 && Date.now() - (m.lastTry || 0) > 2 * 60e3).reverse();
    for (const m of due) await forwardToSheet(m);
  } finally { retrying = false; }
}
setInterval(retryFailed, 5 * 60e3).unref();
setTimeout(retryFailed, 15e3).unref();

/* -------------------------------------------------------------------- routes */
async function api(req, res, pathname) {
  const method = req.method;

  /* ----- public */
  if (pathname === '/api/public' && method === 'GET') return send(res, 200, publicData());

  if (pathname === '/api/contact' && method === 'POST') {
    if (limited('contact:' + clientIp(req), 5, 3600e3)) return send(res, 429, { error: 'Too many messages. Please try again later.' });
    let b; try { b = await readJson(req, 20000); } catch (e) { return send(res, 400, { error: 'Bad request' }); }
    if (b.website) return send(res, 200, { ok: true }); // honeypot
    const msg = { id: uid(), name: str(b.name, 80), email: str(b.email, 100), phone: str(b.phone, 30), service: str(b.service, 80), plan: str(b.plan, 60), message: str(b.message, 2000), date: new Date().toISOString(), status: 'new', sync: 'off', syncError: '' };
    if (!msg.name || !msg.message || (!msg.email && !msg.phone)) return send(res, 400, { error: 'Please fill in your name, a message and an email or phone.' });
    db.messages.unshift(msg);
    db.messages = db.messages.slice(0, 500);
    saveDb();
    send(res, 200, { ok: true });
    forwardToSheet(msg); // fire and forget — never blocks or fails the visitor
    return;
  }

  /* ----- admin auth */
  if (pathname === '/api/admin/status' && method === 'GET') return send(res, 200, { setup: !auth && !IS_PROD, locked: !auth && IS_PROD, loggedIn: isAdmin(req) });

  if (pathname === '/api/admin/setup' && method === 'POST') {
    if (auth) return send(res, 403, { error: 'Already set up' });
    if (IS_PROD) return send(res, 403, { error: 'Setup is disabled on hosted sites. Set the ADMIN_PASSWORD environment variable and redeploy.' });
    let b; try { b = await readJson(req, 5000); } catch (e) { return send(res, 400, { error: 'Bad request' }); }
    const pw = str(b.password, 200);
    if (pw.length < 8) return send(res, 400, { error: 'Password must be at least 8 characters.' });
    const { salt, hash } = hashPassword(pw);
    auth = { salt, hash, secret: crypto.randomBytes(32).toString('hex') };
    saveAuth();
    return startSession(req, res);
  }
  if (pathname === '/api/admin/login' && method === 'POST') {
    if (limited('login:' + clientIp(req), 8, 15 * 60e3) || limited('login:all', 40, 15 * 60e3)) return send(res, 429, { error: 'Too many attempts. Try again in 15 minutes.' });
    let b; try { b = await readJson(req, 5000); } catch (e) { return send(res, 400, { error: 'Bad request' }); }
    if (!checkPassword(b.password || '')) return send(res, 401, { error: 'Wrong password.' });
    return startSession(req, res);
  }
  if (pathname === '/api/admin/logout' && method === 'POST') {
    return send(res, 200, { ok: true }, { 'Set-Cookie': 'kds_admin=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0' + (isHttps(req) ? '; Secure' : '') });
  }

  /* everything below needs admin */
  if (!pathname.startsWith('/api/admin/')) return send(res, 404, { error: 'Not found' });
  if (!isAdmin(req)) return send(res, 401, { error: 'Not logged in' });
  // CSRF defence: state-changing requests must come from our own origin
  if (method !== 'GET') {
    const origin = req.headers.origin;
    if (origin && new URL(origin).host !== req.headers.host) return send(res, 403, { error: 'Bad origin' });
  }
  const parts = pathname.split('/').filter(Boolean).slice(2); // after api/admin

  if (parts[0] === 'data' && method === 'GET') return send(res, 200, db);

  if (parts[0] === 'settings' && method === 'PUT') {
    let b; try { b = await readJson(req, 50000); } catch (e) { return send(res, 400, { error: 'Bad request' }); }
    db.settings = cleanSettings(b, db.settings);
    saveDb();
    return send(res, 200, db.settings);
  }

  if (parts[0] === 'password' && method === 'POST') {
    if (ENV_LOCKED) return send(res, 400, { error: 'On this hosted site the admin password comes from the ADMIN_PASSWORD environment variable — change it in your Render dashboard (Environment) and redeploy.' });
    let b; try { b = await readJson(req, 5000); } catch (e) { return send(res, 400, { error: 'Bad request' }); }
    if (!checkPassword(b.current || '')) return send(res, 403, { error: 'Current password is wrong.' });
    const pw = str(b.password, 200);
    if (pw.length < 8) return send(res, 400, { error: 'New password must be at least 8 characters.' });
    const { salt, hash } = hashPassword(pw);
    auth.salt = salt; auth.hash = hash; auth.secret = crypto.randomBytes(32).toString('hex'); // invalidates other sessions
    saveAuth();
    return startSession(req, res);
  }

  if (parts[0] === 'upload' && method === 'POST') return upload(req, res);

  if (parts[0] === 'pending' && method === 'GET') return send(res, 200, { count: db.messages.filter((m) => m.status === 'new').length });

  if (parts[0] === 'messages') {
    const m = parts[1] && db.messages.find((x) => x.id === parts[1]);
    if (parts[1] && !m) return send(res, 404, { error: 'Not found' });
    if (m && parts[2] === 'resend' && method === 'POST') {
      if (!db.integrations.webhookUrl) return send(res, 400, { error: 'Add your Google Apps Script URL in the “Google Sheet & Email” tab first.' });
      await forwardToSheet(m);
      return send(res, 200, m);
    }
    if (m && method === 'PUT') {
      let b; try { b = await readJson(req, 2000); } catch (e) { return send(res, 400, { error: 'Bad request' }); }
      if (['new', 'contacted', 'done'].includes(b.status)) m.status = b.status;
      saveDb(); return send(res, 200, m);
    }
    if (m && method === 'DELETE') {
      db.messages = db.messages.filter((x) => x.id !== m.id); saveDb(); return send(res, 200, { ok: true });
    }
  }

  if (parts[0] === 'integrations') {
    if (!parts[1] && method === 'PUT') {
      let b; try { b = await readJson(req, 5000); } catch (e) { return send(res, 400, { error: 'Bad request' }); }
      const u = str(b.webhookUrl, 300);
      if (u && !WEBHOOK_RE.test(u)) return send(res, 400, { error: 'That doesn’t look like a Google Apps Script web app URL. It should look like https://script.google.com/macros/s/…/exec' });
      db.integrations = { webhookUrl: u, secret: str(b.secret, 100) };
      saveDb(); return send(res, 200, db.integrations);
    }
    if (parts[1] === 'test' && method === 'POST') {
      if (!db.integrations.webhookUrl) return send(res, 400, { error: 'Save your Apps Script URL first.' });
      const r = await postToSheet({ id: 'test-' + uid(), date: new Date().toISOString(), name: 'Test Enquiry', email: '287kushal@gmail.com', phone: '7676475904', service: 'Website Building', plan: 'Pro', message: 'This is a test enquiry sent from your KDS admin panel. If you got an email and a new row in your sheet, everything works! 🎉', test: true });
      return send(res, r.ok ? 200 : 502, r.ok ? { ok: true } : { error: r.error });
    }
  }
  if (parts[0] === 'apps-script' && method === 'GET') {
    try { return send(res, 200, { code: fs.readFileSync(path.join(ROOT, 'google-apps-script', 'Code.gs'), 'utf8') }); }
    catch (e) { return send(res, 404, { error: 'Code.gs not found' }); }
  }

  const col = parts[0];
  if (schemas[col]) {
    const list = db[col];
    if (method === 'POST' && !parts[1]) {
      let b; try { b = await readJson(req, 50000); } catch (e) { return send(res, 400, { error: 'Bad request' }); }
      const item = Object.assign({ id: uid() }, schemas[col](b));
      if (!item[required[col]]) return send(res, 400, { error: 'Missing ' + required[col] });
      placeAt(list, item, b.position);
      saveDb();
      return send(res, 200, item);
    }
    if (method === 'PUT' && parts[1] && !parts[2]) {
      let b; try { b = await readJson(req, 50000); } catch (e) { return send(res, 400, { error: 'Bad request' }); }
      const idx = list.findIndex((x) => x.id === parts[1]); if (idx < 0) return send(res, 404, { error: 'Not found' });
      const item = Object.assign({ id: parts[1] }, schemas[col](b));
      if (!item[required[col]]) return send(res, 400, { error: 'Missing ' + required[col] });
      list.splice(idx, 1);
      placeAt(list, item, b.position === undefined ? idx + 1 : b.position);
      saveDb();
      return send(res, 200, item);
    }
    if (method === 'POST' && parts[2] === 'move') {
      let b; try { b = await readJson(req, 2000); } catch (e) { return send(res, 400, { error: 'Bad request' }); }
      const idx = list.findIndex((x) => x.id === parts[1]); if (idx < 0) return send(res, 404, { error: 'Not found' });
      const to = b.dir === 'up' ? idx - 1 : idx + 1;
      if (to >= 0 && to < list.length) { [list[idx], list[to]] = [list[to], list[idx]]; saveDb(); }
      return send(res, 200, { ok: true });
    }
    if (method === 'DELETE' && parts[1]) {
      const item = list.find((x) => x.id === parts[1]);
      db[col] = list.filter((x) => x.id !== parts[1]);
      saveDb();
      return send(res, 200, { ok: true });
    }
  }
  return send(res, 404, { error: 'Not found' });
}

function placeAt(list, item, position) {
  let i = parseInt(position, 10);
  if (!Number.isFinite(i)) i = list.length + 1;
  i = Math.max(1, Math.min(list.length + 1, i)) - 1;
  list.splice(i, 0, item);
}

function startSession(req, res) {
  const token = sign({ exp: Date.now() + 7 * 24 * 3600e3 });
  return send(res, 200, { ok: true }, { 'Set-Cookie': `kds_admin=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${7 * 24 * 3600}${isHttps(req) ? '; Secure' : ''}` });
}

function upload(req, res) {
  const u = new URL(req.url, 'http://x');
  const orig = str(u.searchParams.get('name'), 120);
  let ext = path.extname(orig).toLowerCase();
  if (ext === '.jpeg') ext = '.jpg';
  if (!UPLOAD_EXT.includes(ext) && ext !== '.jpg') return send(res, 400, { error: 'File type not allowed. Use png, jpg, webp, gif, pdf, apk or zip.' });
  const len = parseInt(req.headers['content-length'], 10);
  const cap = REMOTE ? REMOTE_MAX_UPLOAD : MAX_UPLOAD;
  if (!len || len > cap) return send(res, 413, { error: `File too large (max ${Math.round(cap / 1048576)} MB).${REMOTE ? ' For bigger files (e.g. an APK) upload to Google Drive / GitHub Releases and paste the link instead.' : ''}` });
  const base = orig.replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'file';
  const name = `${base}-${uid()}${ext}`;
  const dest = path.join(UPLOAD_DIR, name);
  const out = fs.createWriteStream(dest);
  let size = 0, aborted = false;
  req.on('data', (c) => {
    size += c.length;
    if (size > cap && !aborted) { aborted = true; out.destroy(); fs.unlink(dest, () => {}); send(res, 413, { error: 'File too large' }); req.destroy(); }
  });
  req.pipe(out);
  out.on('finish', async () => {
    if (aborted) return;
    if (REMOTE) { // keep a permanent copy before telling the admin it worked
      try { await ghPut('uploads/' + name, fs.readFileSync(dest), 'Upload ' + name); }
      catch (e) { fs.unlink(dest, () => {}); return send(res, 502, { error: 'Could not save the file to permanent storage: ' + e.message }); }
    }
    send(res, 200, { url: '/uploads/' + name, name });
  });
  out.on('error', () => { if (!aborted) send(res, 500, { error: 'Could not save file' }); });
}

const server = http.createServer(async (req, res) => {
  try {
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch (e) { return send(res, 400, 'Bad request'); }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    if (isHttps(req)) res.setHeader('Strict-Transport-Security', 'max-age=15552000');

    if (pathname.startsWith('/api/')) return await api(req, res, pathname);

    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
    if (pathname === '/healthz') return send(res, 200, 'ok');

    if (pathname.startsWith('/uploads/')) {
      const f = safeJoin(UPLOAD_DIR, pathname.slice('/uploads/'.length));
      if (!f) return send(res, 403, 'Forbidden');
      await ensureUpload(f, pathname.slice('/uploads/'.length));
      const ext = path.extname(f).toLowerCase();
      const extra = ['.apk', '.zip'].includes(ext) ? { 'Content-Disposition': 'attachment' } : { 'Content-Security-Policy': "default-src 'none'; sandbox" };
      return serveFile(req, res, f, extra);
    }

    if (pathname === '/aaddmmiinn' || pathname === '/aaddmmiinn/') return serveFile(req, res, path.join(PUBLIC, 'aaddmmiinn', 'index.html'));
    if (pathname === '/') pathname = '/index.html';
    const f = safeJoin(PUBLIC, pathname);
    if (!f) return send(res, 403, 'Forbidden');
    return serveFile(req, res, f);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) send(res, 500, { error: 'Server error' }); else res.end();
  }
});

async function start() {
  if (REMOTE) await pullRemote();
  loadDb();
  server.listen(PORT, () => {
    console.log('\n  KDS website running');
    console.log(`  Site:   http://localhost:${PORT}`);
    console.log(`  Admin:  http://localhost:${PORT}/aaddmmiinn${auth ? '' : IS_PROD ? '' : '   (first visit: choose your admin password)'}`);
    console.log(`  Data:   ${REMOTE ? 'GitHub data repo ' + GH.repo + ' (local cache ' + DATA_DIR + ')' : DATA_DIR}`);
    if (IS_PROD && !auth) console.log('  !! No admin password yet — set the ADMIN_PASSWORD environment variable and redeploy.');
    if (IS_PROD && !REMOTE && !process.env.DATA_DIR) console.log('  !! No permanent storage configured — content is lost on every restart. Set GH_DATA_REPO + GH_TOKEN (see DEPLOY-RENDER.md).');
    console.log('');
  });
}
start().catch((e) => { console.error('Start-up failed:', e.message); process.exit(1); });

// Hosts send SIGTERM before stopping/sleeping an instance — flush any pending save first.
process.on('SIGTERM', async () => {
  console.log('Shutting down — saving…');
  clearTimeout(pushTimer);
  try { if (REMOTE && dirty) { dirty = true; pushing = false; await pushNow(); } } catch (e) { console.error(e.message); }
  process.exit(0);
});
