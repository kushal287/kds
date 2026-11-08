/* Foreground 3D layer (Three.js r128).
 * - ambient floating gold / silver shards that drift with scroll and flee the cursor
 * - scroll-driven "actors": a laptop that opens, spins, closes and vanishes as you leave the
 *   hero, then a KDS medal, a phone and a knot that spin in and out of their sections. */
(function () {
  'use strict';
  if (!window.THREE) return;
  const canvas = document.getElementById('fx');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) { return; }
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 0, 9);

  /* ------------------------------------------------------------ environment */
  (function makeEnv() {
    const env = new THREE.Scene();
    env.background = new THREE.Color(0x050403);
    function panel(color, intensity, w, h, pos, look) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
      m.position.set(pos[0], pos[1], pos[2]); m.lookAt(look[0], look[1], look[2]); env.add(m);
    }
    panel(0xffc266, 9, 12, 5, [-6, 7, 6], [0, 0, 0]);      // warm gold softbox
    panel(0xffffff, 6, 4, 10, [9, 1, 5], [0, 0, 0]);       // white strip right
    panel(0xbfd0ff, 3, 14, 2.5, [0, -7, 5], [0, 0, 0]);    // cool silver floor strip
    panel(0xff9a2e, 3.5, 6, 6, [0, 3, -9], [0, 0, 0]);     // warm rim from behind
    panel(0xffffff, 2.5, 8, 3, [3, 9, -2], [0, 0, 0]);
    const pm = new THREE.PMREMGenerator(renderer);
    const rt = pm.fromScene(env, 0.035);
    scene.environment = rt.texture;
    pm.dispose();
  })();

  scene.add(new THREE.AmbientLight(0xffe2b0, 0.25));
  const key = new THREE.DirectionalLight(0xffd9a0, 1.4); key.position.set(-4, 6, 8); scene.add(key);
  const rim = new THREE.DirectionalLight(0xfff0d0, 1.0); rim.position.set(6, 2, -4); scene.add(rim);

  /* -------------------------------------------------------------- materials */
  const M = {
    gold: new THREE.MeshStandardMaterial({ color: 0xe0a82e, metalness: 1, roughness: 0.26 }),
    goldSoft: new THREE.MeshStandardMaterial({ color: 0xc9922a, metalness: 1, roughness: 0.4 }),
    silver: new THREE.MeshStandardMaterial({ color: 0xdfe3ea, metalness: 1, roughness: 0.2 }),
    graphite: new THREE.MeshStandardMaterial({ color: 0x1d1d22, metalness: 0.95, roughness: 0.32 }),
    black: new THREE.MeshStandardMaterial({ color: 0x050506, metalness: 0.6, roughness: 0.5 })
  };
  const loader = new THREE.TextureLoader();
  const logoTex = loader.load('/assets/logo.png');
  logoTex.encoding = THREE.sRGBEncoding; logoTex.anisotropy = 8;
  const LOGO_AR = 414 / 224;

  /* ---------------------------------------------------------------- helpers */
  function rrShape(w, h, r) {
    const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }
  function slab(w, h, d, r, bevel) {
    bevel = bevel === undefined ? 0.02 : bevel;
    const g = new THREE.ExtrudeGeometry(rrShape(w, h, r), { depth: d, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 10 });
    g.translate(0, 0, -d / 2);
    return g;
  }
  function canvasTex(w, h) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8;
    return { c, ctx: c.getContext('2d'), tex: t };
  }
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ------------------------------------------------------------------ actors */
  const actors = [];
  function makeActor(group, cfg) {
    const mats = new Set();
    group.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => mats.add(m)); });
    const arr = [...mats].map((m) => ({ m, transparent: m.transparent, opacity: m.opacity }));
    const a = Object.assign({ group, mats: arr, el: document.getElementById(cfg.section), vis: 0 }, cfg);
    group.visible = false; scene.add(group); actors.push(a);
    return a;
  }
  function setOpacity(a, v) {
    for (const o of a.mats) { o.m.opacity = o.opacity * v; o.m.transparent = o.transparent || v < 0.999; }
    a.group.visible = v > 0.01;
  }

  /* ---- laptop */
  const laptop = (function () {
    const g = new THREE.Group();
    const base = new THREE.Mesh(slab(3.2, 2.2, 0.1, 0.14), M.graphite);
    base.rotation.x = -Math.PI / 2; base.position.y = 0.07; g.add(base);
    // gold trim on the front lip
    const trim = new THREE.Mesh(new THREE.BoxGeometry(3.12, 0.02, 0.03), M.gold); trim.position.set(0, 0.07, 1.11); g.add(trim);
    // keyboard
    const kb = canvasTex(1024, 380), k = kb.ctx;
    k.fillStyle = '#060607'; k.fillRect(0, 0, 1024, 380);
    const rows = [14, 14, 13, 12, 8];
    rows.forEach((n, r) => {
      const kw = r === 4 ? 0 : 1; const gap = 7; const rowH = 62;
      const totalW = 990; let x = 17; const unit = (totalW - gap * (n - 1)) / n;
      for (let i = 0; i < n; i++) {
        let w = unit; if (r === 4 && i === 3) w = unit * 3.2; else if (r === 4) w = unit * 0.82;
        const grad = k.createLinearGradient(0, 18 + r * 70, 0, 18 + r * 70 + rowH);
        grad.addColorStop(0, '#1b1b20'); grad.addColorStop(1, '#0d0d10');
        k.fillStyle = grad; rr(k, x, 18 + r * 70, w - 1, rowH, 9); k.fill();
        k.strokeStyle = 'rgba(224,168,46,.28)'; k.lineWidth = 1.5; rr(k, x, 18 + r * 70, w - 1, rowH, 9); k.stroke();
        x += w + gap;
      }
    });
    kb.tex.needsUpdate = true;
    const kbMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.86, 1.06), new THREE.MeshBasicMaterial({ map: kb.tex, toneMapped: false }));
    kbMesh.rotation.x = -Math.PI / 2; kbMesh.position.set(0, 0.142, -0.42); g.add(kbMesh);
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.6), new THREE.MeshStandardMaterial({ color: 0x141418, metalness: 0.8, roughness: 0.45 }));
    pad.rotation.x = -Math.PI / 2; pad.position.set(0, 0.142, 0.64); g.add(pad);

    // lid
    const hinge = new THREE.Group(); hinge.position.set(0, 0.15, -1.08); g.add(hinge);
    const lid = new THREE.Mesh(slab(3.2, 2.1, 0.07, 0.12), M.graphite); lid.position.y = 1.05; hinge.add(lid);
    const scr = canvasTex(1024, 640);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 1.9), new THREE.MeshBasicMaterial({ map: scr.tex, toneMapped: false }));
    screen.position.set(0, 1.05, 0.062); hinge.add(screen);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5 / LOGO_AR), new THREE.MeshBasicMaterial({ map: logoTex, transparent: true, toneMapped: false }));
    back.rotation.y = Math.PI; back.position.set(0, 1.05, -0.062); hinge.add(back);
    g.position.y = -0.4;
    const shadowOffset = g;
    return { group: g, hinge, scr, draw: drawLaptopScreen };

    function drawLaptopScreen(time) {
      const c = scr.ctx, W = 1024, H = 640;
      const bg = c.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#0a0a0d'); bg.addColorStop(1, '#14100a');
      c.fillStyle = bg; c.fillRect(0, 0, W, H);
      // title bar
      c.fillStyle = '#0d0d10'; c.fillRect(0, 0, W, 44);
      ['#e0a82e', '#c9ccd2', '#6b6f78'].forEach((col, i) => { c.fillStyle = col; c.beginPath(); c.arc(28 + i * 26, 22, 7, 0, 7); c.fill(); });
      c.fillStyle = '#8a8d96'; c.font = '600 17px Manrope, Arial'; c.fillText('kds / studio.js', 120, 28);
      // sidebar
      c.fillStyle = '#0b0b0e'; c.fillRect(0, 44, 150, H - 44);
      ['index.html', 'style.css', 'app.js', 'admin/', 'assets/'].forEach((t, i) => {
        c.fillStyle = i === 2 ? '#f2c14e' : '#6f737d'; c.font = '500 16px Manrope, Arial'; c.fillText(t, 20, 84 + i * 32);
      });
      // code
      const code = [
        [['const ', 'k'], ['studio', 'f'], [' = {', 'p']],
        [['  name', 'v'], [': ', 'p'], ['"KDS"', 's'], [',', 'p']],
        [['  craft', 'v'], [': [', 'p'], ['"web"', 's'], [', ', 'p'], ['"apps"', 's'], [', ', 'p'], ['"video"', 's'], ['],', 'p']],
        [['};', 'p']],
        [['', 'p']],
        [['function ', 'k'], ['build', 'f'], ['(idea) {', 'p']],
        [['  return ', 'k'], ['idea', 'v'], ['.design()', 'f']],
        [['    .code()', 'f']],
        [['    .launch();', 'f']],
        [['}', 'p']],
        [['', 'p']],
        [['build', 'f'], ['(', 'p'], ['"your next big thing"', 's'], [');', 'p']]
      ];
      const col = { k: '#f2c14e', f: '#fff1c0', p: '#8a8d96', v: '#c9ccd2', s: '#e0a82e' };
      const total = code.reduce((n, l) => n + l.reduce((m, t) => m + t[0].length, 0) + 1, 0);
      let shown = Math.floor((time * 16) % (total + 40));
      c.font = '500 22px "Courier New", monospace';
      let y = 92;
      for (const line of code) {
        let x = 176;
        for (const [txt, kind] of line) {
          const part = txt.slice(0, Math.max(0, shown));
          c.fillStyle = col[kind]; c.fillText(part, x, y); x += c.measureText(txt).width;
          shown -= txt.length;
          if (shown <= 0) break;
        }
        shown -= 1; y += 34;
        if (shown <= 0) { if (Math.floor(time * 2) % 2 === 0) { c.fillStyle = '#f2c14e'; c.fillRect(x + 2, y - 58, 11, 26); } break; }
      }
      // preview card
      const px = 560, py = 330, pw = 420, ph = 270;
      const cg = c.createLinearGradient(px, py, px + pw, py + ph); cg.addColorStop(0, '#1a1710'); cg.addColorStop(1, '#0c0c0f');
      c.fillStyle = cg; rr(c, px, py, pw, ph, 18); c.fill(); c.strokeStyle = 'rgba(224,168,46,.5)'; c.lineWidth = 2; rr(c, px, py, pw, ph, 18); c.stroke();
      if (logoTex.image) c.drawImage(logoTex.image, px + 90, py + 28, 240, 240 / LOGO_AR);
      c.fillStyle = '#c9ccd2'; c.font = '600 20px Manrope, Arial'; c.textAlign = 'center'; c.fillText('Kushal Developer Studios', px + pw / 2, py + 190);
      const bw = 150; const bgG = c.createLinearGradient(px + pw / 2 - bw / 2, 0, px + pw / 2 + bw / 2, 0); bgG.addColorStop(0, '#f6d66f'); bgG.addColorStop(1, '#b97a14');
      c.fillStyle = bgG; rr(c, px + pw / 2 - bw / 2, py + 208, bw, 38, 19); c.fill();
      c.fillStyle = '#16110a'; c.font = '700 17px Manrope, Arial'; c.fillText('Get started', px + pw / 2, py + 233); c.textAlign = 'left';
      // mini chart
      for (let i = 0; i < 12; i++) {
        const h = 30 + 70 * (0.5 + 0.5 * Math.sin(time * 1.4 + i * 0.7));
        c.fillStyle = i % 3 === 0 ? '#e0a82e' : '#8d8f98'; c.fillRect(580 + i * 28, 300 - h, 18, h);
      }
      scr.tex.needsUpdate = true;
    }
  })();
  laptop.group.rotation.order = 'YXZ';
  const laptopActor = makeActor(laptop.group, { section: 'hero', side: 1, turns: 2.0 });

  /* ---- KDS medal */
  const medal = (function () {
    const g = new THREE.Group();
    const coin = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.2, 96, 1), M.graphite); coin.rotation.x = Math.PI / 2; g.add(coin);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.09, 24, 128), M.gold); ring.position.z = 0; g.add(ring);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(1.02, 0.025, 16, 128), M.silver); ring2.position.z = 0.105; g.add(ring2);
    const ring3 = ring2.clone(); ring3.position.z = -0.105; g.add(ring3);
    [1, -1].forEach((s) => {
      const f = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.7 / LOGO_AR), new THREE.MeshBasicMaterial({ map: logoTex, transparent: true, toneMapped: false }));
      f.position.z = s * 0.108; if (s < 0) f.rotation.y = Math.PI; g.add(f);
    });
    return g;
  })();
  const medalActor = makeActor(medal, { section: 'services', side: -1, turns: 2.5 });

  /* ---- phone */
  const phone = (function () {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(slab(1.34, 2.7, 0.1, 0.22, 0.025), M.gold));
    const sc = canvasTex(512, 1024), c = sc.ctx;
    const draw = (time) => {
      c.clearRect(0, 0, 512, 1024);
      c.save(); rr(c, 0, 0, 512, 1024, 70); c.clip();
      const bg = c.createLinearGradient(0, 0, 512, 1024); bg.addColorStop(0, '#0b0b0e'); bg.addColorStop(1, '#17120a'); c.fillStyle = bg; c.fillRect(0, 0, 512, 1024);
      c.fillStyle = '#000'; rr(c, 196, 18, 120, 30, 15); c.fill();
      c.fillStyle = '#c9ccd2'; c.font = '600 22px Manrope, Arial'; c.fillText('9:41', 44, 46);
      if (logoTex.image) c.drawImage(logoTex.image, 136, 90, 240, 240 / LOGO_AR);
      c.fillStyle = '#fff1c0'; c.font = '700 34px Syne, Arial'; c.textAlign = 'center'; c.fillText('KDS Apps', 256, 270); c.textAlign = 'left';
      for (let i = 0; i < 4; i++) {
        const y = 320 + i * 150 + Math.sin(time * 1.2 + i) * 4;
        const gg = c.createLinearGradient(40, y, 472, y + 120); gg.addColorStop(0, i % 2 ? '#1d1a12' : '#1a1a1f'); gg.addColorStop(1, '#0e0e11');
        c.fillStyle = gg; rr(c, 40, y, 432, 124, 26); c.fill(); c.strokeStyle = 'rgba(224,168,46,.35)'; c.lineWidth = 2; rr(c, 40, y, 432, 124, 26); c.stroke();
        c.fillStyle = i % 2 ? '#c9ccd2' : '#e0a82e'; rr(c, 62, y + 24, 76, 76, 20); c.fill();
        c.fillStyle = '#e8e8ea'; rr(c, 160, y + 34, 200, 14, 7); c.fill(); c.fillStyle = '#6f737d'; rr(c, 160, y + 66, 260, 12, 6); c.fill();
      }
      c.restore(); sc.tex.needsUpdate = true;
    };
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.24, 2.48), new THREE.MeshBasicMaterial({ map: sc.tex, transparent: true, toneMapped: false }));
    m.position.z = 0.062; g.add(m);
    g.userData.draw = draw;
    return g;
  })();
  const phoneActor = makeActor(phone, { section: 'projects', side: 1, turns: 2 });

  /* ---- knot */
  const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(0.9, 0.3, 220, 28, 2, 3), M.gold);
  const knotG = new THREE.Group(); knotG.add(knot);
  const knotActor = makeActor(knotG, { section: 'contact', side: 1, turns: 1.5 });

  /* ------------------------------------------------------------ ambient shards */
  const shardGeos = [new THREE.IcosahedronGeometry(1, 0), new THREE.OctahedronGeometry(1, 0), new THREE.TetrahedronGeometry(1, 0), new THREE.TorusGeometry(1, 0.34, 14, 36), new THREE.DodecahedronGeometry(1, 0)];
  const shards = [];
  const rand = (a, b) => a + Math.random() * (b - a);
  for (let i = 0; i < 18; i++) {
    const mesh = new THREE.Mesh(shardGeos[i % shardGeos.length], i % 3 === 0 ? M.silver : i % 3 === 1 ? M.gold : M.goldSoft);
    const s = rand(0.12, 0.42);
    mesh.scale.setScalar(s);
    scene.add(mesh);
    shards.push({ mesh, x: rand(-1, 1), y: rand(0, 1), z: rand(-5, 0.5), speed: rand(0.15, 0.55), rot: new THREE.Vector3(rand(-0.4, 0.4), rand(-0.4, 0.4), rand(-0.2, 0.2)), off: new THREE.Vector2(), phase: rand(0, 6.28) });
  }

  /* ------------------------------------------------------------------ resize */
  let W = 1, H = 1, visW = 10, visH = 6;
  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.updateProjectionMatrix();
    visH = 2 * camera.position.z * Math.tan((camera.fov * Math.PI) / 360); visW = visH * camera.aspect;
  }
  window.addEventListener('resize', resize); resize();

  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener('pointermove', (e) => { mouse.tx = (e.clientX / W) * 2 - 1; mouse.ty = -((e.clientY / H) * 2 - 1); }, { passive: true });

  /* ------------------------------------------------------------------- loop */
  let intro = 0, introStart = null;
  window.addEventListener('kds:ready', () => { introStart = performance.now(); });
  setTimeout(() => { if (introStart === null) introStart = performance.now(); }, 6000);
  const t0 = performance.now();
  let last = t0, drawTick = 0;

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const time = (now - t0) / 1000;
    mouse.x += (mouse.tx - mouse.x) * Math.min(1, dt * 4); mouse.y += (mouse.ty - mouse.y) * Math.min(1, dt * 4);
    const sy = window.scrollY || 0;
    const narrow = W < 820;

    camera.position.x = mouse.x * 0.35; camera.position.y = mouse.y * 0.22 - 0.0; camera.lookAt(0, 0, 0);

    if (introStart !== null) intro = smooth(0, 1, (now - introStart) / 2200);

    // --- actors
    for (const a of actors) {
      const el = a.el;
      if (!el || el.hidden || el.offsetHeight === 0) { a.group.visible = false; continue; }
      const r = el.getBoundingClientRect();
      const t = (H - r.top) / (r.height + H); // 0 = section enters from bottom, 1 = leaves at top
      let vis = smooth(0.0, 0.2, t) * smooth(1.0, 0.8, t);
      const isHero = a === laptopActor;
      if (isHero) vis = smooth(1.0, 0.62, t) * smooth(0, 0.3, intro + 0.0001);
      const cap = narrow ? (isHero ? 0.9 : 0.28) : 1;
      setOpacity(a, vis * cap);
      if (vis <= 0.01) continue;

      const prog = isHero ? (t - 0.5) / 0.5 : (t - 0.1) / 0.8; // 0..1 across the visible span
      const g = a.group;
      let sc = narrow ? Math.min(0.85, (visW * 0.78) / 3.4) : Math.min(1.15, Math.max(0.7, visW / 11));
      let x = narrow ? 0 : a.side * visW * 0.26;
      let y = narrow ? (isHero ? visH * 0.3 : visH * 0.05) : 0;
      let z = 0;
      const spin = prog * Math.PI * 2 * a.turns;
      if (isHero) {
        // opens on intro, spins as you scroll, closes + flies away
        const open = THREE.MathUtils.lerp(Math.PI / 2 - 0.02, -0.3, smooth(0, 1, intro)) ;
        const closing = smooth(0.18, 0.7, prog);
        laptop.hinge.rotation.x = lerp(open, Math.PI / 2 - 0.02, closing);
        g.rotation.y = -0.45 + spin + Math.sin(time * 0.6) * 0.08 + mouse.x * 0.3;
        g.rotation.x = 0.28 + prog * 0.7 + mouse.y * 0.12;
        g.rotation.z = prog * 0.35;
        z = prog * 3.2 - (1 - intro) * 1.5; x = lerp(x, narrow ? 0 : visW * 0.05, prog); y += prog * 1.4 + Math.sin(time * 0.9) * 0.1 - 0.15;
        sc *= lerp(1, 0.55, prog) * lerp(0.7, 1, intro);
      } else {
        g.rotation.y = spin + mouse.x * 0.25; g.rotation.x = Math.sin(time * 0.5 + a.side) * 0.12 + mouse.y * 0.12;
        y += Math.sin(time * 0.8 + a.side * 2) * 0.12;
        sc *= lerp(0.75, 1, smooth(0, 0.4, vis));
        x += (prog - 0.5) * -a.side * 0.9;
      }
      g.position.set(x, y, z); g.scale.setScalar(sc);
    }

    drawTick += dt;
    if (drawTick > 0.05) {
      drawTick = 0;
      if (laptopActor.group.visible) laptop.draw(time);
      if (phoneActor.group.visible) phone.userData.draw(time);
    }
    knot.rotation.x = time * 0.35; knot.rotation.y = time * 0.5;

    // --- shards
    const scrollU = sy / Math.max(1, H);
    for (const s of shards) {
      const range = visH * 1.5;
      const yy = (((s.y * range - scrollU * s.speed * visH * 1.2 + time * 0.05 * s.speed) % range) + range) % range - range / 2;
      const bx = s.x * visW * 0.55;
      const px = bx + Math.sin(time * 0.3 + s.phase) * 0.25, py = yy + Math.cos(time * 0.4 + s.phase) * 0.15;
      // flee the cursor
      const mx = mouse.x * visW * 0.5, my = mouse.y * visH * 0.5;
      const dx = px - mx, dy = py - my, d2 = dx * dx + dy * dy;
      const push = Math.exp(-d2 / 2.0) * 1.2;
      s.off.x += ((dx / (Math.sqrt(d2) + 0.01)) * push - s.off.x) * Math.min(1, dt * 3);
      s.off.y += ((dy / (Math.sqrt(d2) + 0.01)) * push - s.off.y) * Math.min(1, dt * 3);
      s.mesh.position.set(px + s.off.x, py + s.off.y, s.z);
      s.mesh.rotation.x += s.rot.x * dt; s.mesh.rotation.y += s.rot.y * dt; s.mesh.rotation.z += s.rot.z * dt;
    }

    renderer.render(scene, camera);
    if (!reduce) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  if (reduce) { window.addEventListener('scroll', () => requestAnimationFrame(frame), { passive: true }); setTimeout(() => { introStart = performance.now() - 3000; }, 100); }
})();
