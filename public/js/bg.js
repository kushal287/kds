/* Interactive molten-gold silk background (raw WebGL fragment shader).
 * Domain-warped noise → liquid gold / silver folds on black. The cursor bends the
 * fabric, fast movement leaves a swirl, scrolling slides the folds. */
(function () {
  'use strict';
  const canvas = document.getElementById('bg');
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' });
  if (!gl) { document.body.classList.add('no-webgl'); return; }

  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  const fs = `
precision highp float;
uniform vec2 uRes; uniform float uTime; uniform vec2 uMouse; uniform vec2 uVel; uniform float uScroll; uniform float uPulse;

float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){
  vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y);
}
float fbm(vec2 p){
  float v=0., a=.5;
  mat2 r = mat2(.8,-.6,.6,.8);
  for(int i=0;i<5;i++){ v+=a*noise(p); p=r*p*2.03+7.1; a*=.5; }
  return v;
}
void main(){
  vec2 frag = gl_FragCoord.xy;
  vec2 p = (frag - .5*uRes) / uRes.y;
  vec2 m = (uMouse*uRes - .5*uRes) / uRes.y;

  // cursor bends the fabric + swirl proportional to its velocity
  vec2 d = p - m; float dist = length(d);
  float fall = exp(-dist*dist*7.);
  float ang = fall * (uVel.x*1.6 - uVel.y*1.6 + .55*sin(uTime*.6));
  mat2 rot = mat2(cos(ang), -sin(ang), sin(ang), cos(ang));
  p = m + rot * d * (1. - .28*fall);

  float t = uTime * .045;
  vec2 q = vec2(fbm(p*1.25 + vec2(0., t)), fbm(p*1.25 + vec2(5.2, 1.3) - t));
  vec2 r = vec2(fbm(p*1.5 + 3.2*q + vec2(1.7, 9.2) + .8*t + uScroll*.35),
                fbm(p*1.5 + 3.2*q + vec2(8.3, 2.8) - .6*t));
  float f = fbm(p*1.35 + 3.4*r);

  // silk ridges (thin bright creases) and broad folds
  float ridge  = 1. - abs(2.*f - 1.);
  float crease = pow(ridge, 9.);
  float fold   = pow(ridge, 3.);
  float sheen  = pow(clamp(r.x*1.4 - .25, 0., 1.), 3.);

  vec3 goldDeep = vec3(.36, .20, .02);
  vec3 gold     = vec3(.95, .68, .18);
  vec3 goldHi   = vec3(1.0, .90, .58);
  vec3 silver   = vec3(.78, .82, .90);

  vec3 col = vec3(.012, .011, .010);
  col += goldDeep * fold * .55;
  col += mix(gold, goldHi, crease) * crease * .85;
  col += silver * pow(ridge, 16.) * sheen * .55;
  col += gold * fall * (.10 + .20*uPulse) * (.4 + fold);       // warm glow under the cursor
  col += vec3(.55,.34,.06) * pow(max(0., 1. - dist*1.7), 3.) * .09;

  // vignette keeps text readable at the edges, darkens overall
  vec2 uv = frag / uRes;
  float vig = smoothstep(1.15, .25, length((uv - .5) * vec2(1.1, 1.0)));
  col *= .38 + .62 * vig;
  col *= .78;
  col = pow(col, vec3(.92));
  gl_FragColor = vec4(col, 1.);
}`;

  function sh(type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; }
    return s;
  }
  const v = sh(gl.VERTEX_SHADER, vs), f = sh(gl.FRAGMENT_SHADER, fs);
  if (!v || !f) { document.body.classList.add('no-webgl'); return; }
  const prog = gl.createProgram();
  gl.attachShader(prog, v); gl.attachShader(prog, f); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { document.body.classList.add('no-webgl'); return; }
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = {};
  ['uRes', 'uTime', 'uMouse', 'uVel', 'uScroll', 'uPulse'].forEach((n) => (U[n] = gl.getUniformLocation(prog, n)));

  let scale = Math.min(window.devicePixelRatio || 1, 1.5) * (window.innerWidth < 800 ? 0.45 : 0.55);
  let w = 0, h = 0;
  function resize() {
    w = Math.max(2, Math.floor(window.innerWidth * scale));
    h = Math.max(2, Math.floor(window.innerHeight * scale));
    canvas.width = w; canvas.height = h;
    gl.viewport(0, 0, w, h);
  }
  window.addEventListener('resize', resize);
  resize();

  const mouse = { x: 0.62, y: 0.55, tx: 0.62, ty: 0.55, vx: 0, vy: 0 };
  let pulse = 0, scrollSmooth = 0;
  function setTarget(x, y) { mouse.tx = x / window.innerWidth; mouse.ty = 1 - y / window.innerHeight; }
  window.addEventListener('pointermove', (e) => setTarget(e.clientX, e.clientY), { passive: true });
  window.addEventListener('pointerdown', () => { pulse = 1; }, { passive: true });
  window.addEventListener('touchmove', (e) => { if (e.touches[0]) setTarget(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });

  // adaptive quality — if frames are slow, lower the resolution
  let acc = 0, frames = 0, last = performance.now(), start = last;
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    const px = mouse.x, py = mouse.y;
    mouse.x += (mouse.tx - mouse.x) * Math.min(1, dt * 5);
    mouse.y += (mouse.ty - mouse.y) * Math.min(1, dt * 5);
    const ivx = (mouse.x - px) / Math.max(dt, 0.001) * 0.12, ivy = (mouse.y - py) / Math.max(dt, 0.001) * 0.12;
    mouse.vx += (ivx - mouse.vx) * Math.min(1, dt * 6);
    mouse.vy += (ivy - mouse.vy) * Math.min(1, dt * 6);
    pulse *= Math.pow(0.04, dt);
    const sy = (window.scrollY || 0) / Math.max(1, window.innerHeight);
    scrollSmooth += (sy - scrollSmooth) * Math.min(1, dt * 4);
    window.__kdsScrollSmooth = scrollSmooth;

    gl.uniform2f(U.uRes, w, h);
    gl.uniform1f(U.uTime, reduce ? 12 : (now - start) / 1000);
    gl.uniform2f(U.uMouse, mouse.x, mouse.y);
    gl.uniform2f(U.uVel, Math.max(-1.5, Math.min(1.5, mouse.vx)), Math.max(-1.5, Math.min(1.5, mouse.vy)));
    gl.uniform1f(U.uScroll, scrollSmooth);
    gl.uniform1f(U.uPulse, pulse);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    acc += dt; frames++;
    if (acc > 2) {
      const fps = frames / acc; acc = 0; frames = 0;
      if (fps < 28 && scale > 0.28) { scale *= 0.8; resize(); }
    }
    if (!reduce) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  if (reduce) window.addEventListener('pointermove', () => requestAnimationFrame(frame), { passive: true });
})();
