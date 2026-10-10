// Opening cinematic: a flight down a blood vessel past red cells and platelets, a neutrophil hunting
// and engulfing a bacterium while antibodies tag it, then the Body Bastion crest.
// Self-contained (no imports) so the Android app's splash page can reuse it.

const TAU = Math.PI * 2;

function rand(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function ease(t) {
  t = Math.max(0, Math.min(1, t));
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function clamp01(t) {
  return Math.max(0, Math.min(1, t));
}

function drawRbc(ctx, x, y, r, rot, alpha, tilt) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(1, tilt);
  ctx.globalAlpha = alpha;
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
  g.addColorStop(0, '#ff6b6b');
  g.addColorStop(0.55, '#d61f3c');
  g.addColorStop(1, '#7a0c1e');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
  // biconcave dimple
  const d = ctx.createRadialGradient(r * 0.08, r * 0.1, 0, 0, 0, r * 0.55);
  d.addColorStop(0, 'rgba(90,0,15,0.55)');
  d.addColorStop(1, 'rgba(90,0,15,0)');
  ctx.fillStyle = d;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.55, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,170,170,0.35)';
  ctx.lineWidth = r * 0.08;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.8, Math.PI * 1.1, Math.PI * 1.7);
  ctx.stroke();
  ctx.restore();
}

function drawPlatelet(ctx, x, y, r, alpha) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#f7b8d2';
  ctx.beginPath();
  for (let k = 0; k <= 8; k++) {
    const a = (k / 8) * TAU;
    const rr = r * (0.8 + 0.25 * Math.sin(k * 2.3));
    if (k === 0) ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.7);
    else ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.7);
  }
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawBacterium(ctx, x, y, s, t, alpha, ang) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = 'rgba(160,230,120,0.7)';
  ctx.lineWidth = s * 0.05;
  for (let k = -1; k <= 1; k++) {
    ctx.beginPath();
    for (let q = 0; q <= 14; q++) {
      const px = -s * 0.9 - q * s * 0.09;
      const py = k * s * 0.2 + Math.sin(q * 0.9 + t * 14 + k) * s * 0.09;
      if (q === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  const g = ctx.createLinearGradient(0, -s * 0.4, 0, s * 0.4);
  g.addColorStop(0, '#b6f07a');
  g.addColorStop(0.5, '#5fbf3a');
  g.addColorStop(1, '#2d6b1c');
  ctx.fillStyle = g;
  ctx.strokeStyle = '#1d4a12';
  ctx.lineWidth = s * 0.05;
  ctx.beginPath();
  ctx.roundRect(-s * 0.9, -s * 0.36, s * 1.8, s * 0.72, s * 0.36);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.beginPath();
  ctx.ellipse(-s * 0.2, -s * 0.18, s * 0.5, s * 0.08, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(30,70,20,0.5)';
  for (let k = 0; k < 4; k++) {
    ctx.beginPath();
    ctx.arc(-s * 0.5 + k * s * 0.33, s * 0.06, s * 0.06, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawNeutrophil(ctx, x, y, r, t, alpha, wrap) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  const n = 60;
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU;
    let rr = r * (1 + 0.08 * Math.sin(5 * a + t * 3) + 0.05 * Math.sin(9 * a - t * 4));
    // pseudopods reaching forward (to the right) while hunting, closing in when engulfing
    const reach = Math.max(0, Math.cos(a)) ** 6;
    rr += r * reach * (0.55 - 0.45 * wrap) * (1 + 0.15 * Math.sin(t * 6 + a * 3));
    if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.4);
  g.addColorStop(0, 'rgba(255,255,255,0.98)');
  g.addColorStop(0.6, 'rgba(225,228,255,0.92)');
  g.addColorStop(1, 'rgba(160,170,230,0.85)');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = 'rgba(100,90,190,0.8)';
  ctx.lineWidth = r * 0.035;
  ctx.stroke();
  // granules
  for (let k = 0; k < 26; k++) {
    const a = k * 2.39996, d = Math.sqrt((k + 0.5) / 26) * r * 0.8;
    ctx.fillStyle = 'rgba(180,140,220,0.5)';
    ctx.beginPath();
    ctx.arc(Math.cos(a) * d, Math.sin(a) * d, r * 0.03, 0, TAU);
    ctx.fill();
  }
  // multilobed nucleus
  const lobes = [[-0.32, 0.05], [-0.05, -0.2], [0.22, 0.02], [0.02, 0.24]];
  ctx.fillStyle = '#7a4cc2';
  ctx.strokeStyle = '#4b2a8a';
  ctx.lineWidth = r * 0.03;
  for (const [lx, ly] of lobes) {
    ctx.beginPath();
    ctx.ellipse(lx * r - r * 0.1, ly * r, r * 0.19, r * 0.15, lx * 2, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }
  ctx.strokeStyle = '#5b33a0';
  ctx.lineWidth = r * 0.05;
  ctx.beginPath();
  lobes.forEach(([lx, ly], i) => (i ? ctx.lineTo(lx * r - r * 0.1, ly * r) : ctx.moveTo(lx * r - r * 0.1, ly * r)));
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.45, -r * 0.5, r * 0.22, r * 0.09, -0.6, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawAntibody(ctx, x, y, s, ang, alpha) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.globalAlpha = alpha;
  ctx.lineCap = 'round';
  for (const [w, c] of [[s * 0.34, '#1d3f9a'], [s * 0.2, '#8fc0ff']]) {
    ctx.strokeStyle = c;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(0, s);
    ctx.lineTo(0, 0);
    ctx.lineTo(-s * 0.7, -s * 0.8);
    ctx.moveTo(0, 0);
    ctx.lineTo(s * 0.7, -s * 0.8);
    ctx.stroke();
  }
  ctx.restore();
}

function crest(ctx, x, y, s, glowA) {
  ctx.save();
  ctx.translate(x, y);
  const k = s / 512;
  ctx.scale(k, k);
  ctx.translate(-256, -272);
  const halo = ctx.createRadialGradient(256, 260, 40, 256, 260, 330);
  halo.addColorStop(0, `rgba(255,140,200,${0.55 * glowA})`);
  halo.addColorStop(1, 'rgba(255,140,200,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(-120, -120, 760, 760);
  const shield = new Path2D('M112 120V88h44v28h34V88h44v28h44V88h44v28h34V88h44v32l0 140c0 92-66 160-144 196-78-36-144-104-144-196z');
  const g = ctx.createLinearGradient(0, 88, 0, 456);
  g.addColorStop(0, '#ef3b7f');
  g.addColorStop(1, '#8e0f45');
  ctx.fillStyle = g;
  ctx.fill(shield);
  ctx.lineWidth = 14;
  ctx.strokeStyle = '#4a0822';
  ctx.lineJoin = 'round';
  ctx.stroke(shield);
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(255,215,120,0.95)';
  ctx.stroke(shield);
  const gut = new Path2D('M190 176h132v58H190v58h132v42h-66');
  ctx.lineCap = 'round';
  ctx.lineWidth = 52;
  ctx.strokeStyle = '#4a0822';
  ctx.stroke(gut);
  ctx.lineWidth = 32;
  ctx.strokeStyle = '#ffd2bf';
  ctx.stroke(gut);
  ctx.beginPath();
  ctx.arc(256, 376, 34, 0, TAU);
  ctx.fillStyle = '#ffc94a';
  ctx.fill();
  ctx.lineWidth = 10;
  ctx.strokeStyle = '#4a0822';
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.ellipse(190, 150, 46, 14, -0.3, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function outlinedText(ctx, text, x, y, size, fill, stroke, letter = 0) {
  ctx.font = `900 ${size}px "Trebuchet MS", "Segoe UI Black", "Arial Black", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${letter}px`;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = size * 0.22;
  ctx.strokeText(text, x, y + size * 0.08);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = size * 0.16;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
}

/**
 * Play the intro over the page.
 * opts.short: shorter version for returning players.
 * opts.waitFor: optional promise; "Tap to begin" appears only once it resolves (the Android splash
 *   uses this while the server wakes up).
 * opts.statusText: text shown while waiting.
 * Resolves when the player taps through or skips.
 */
export function playIntro(opts = {}) {
  return new Promise((resolve) => {
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const short = !!opts.short;
    const T_HUNT = short ? 0.6 : 2.2;
    const T_EAT = T_HUNT + (short ? 1.4 : 2.6);
    const T_TITLE = T_EAT + 0.6;
    let ready = !opts.waitFor;
    if (opts.waitFor) Promise.resolve(opts.waitFor).then(() => { ready = true; }, () => { ready = true; });

    const wrap = document.createElement('div');
    wrap.className = 'intro';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-label', 'Body Bastion intro');
    wrap.style.cssText = 'position:fixed;inset:0;z-index:1000;background:#1a0510;cursor:pointer;touch-action:manipulation;transition:opacity .45s ease;';
    const cv = document.createElement('canvas');
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
    cv.setAttribute('aria-hidden', 'true');
    const skip = document.createElement('button');
    skip.type = 'button';
    skip.textContent = 'Skip';
    skip.setAttribute('aria-label', 'Skip the intro');
    skip.style.cssText = 'position:absolute;top:max(14px,env(safe-area-inset-top));right:14px;z-index:2;min-height:40px;padding:6px 18px;border-radius:12px;border:2px solid rgba(255,255,255,.55);background:rgba(20,4,12,.45);color:#fff;font:800 15px system-ui,sans-serif;cursor:pointer;';
    const live = document.createElement('p');
    live.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);';
    live.setAttribute('aria-live', 'polite');
    live.textContent = 'Body Bastion. Defend the gut. Learn the drugs.';
    wrap.append(cv, skip, live);
    document.body.append(wrap);
    const prevFocus = document.activeElement;
    try { skip.focus({ preventScroll: true }); } catch { /* ignore */ }

    const ctx = cv.getContext('2d');
    let vw = 1, vh = 1, dpr = 1;
    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      vw = Math.max(1, window.innerWidth);
      vh = Math.max(1, window.innerHeight);
      cv.width = Math.round(vw * dpr);
      cv.height = Math.round(vh * dpr);
    };
    resize();
    window.addEventListener('resize', resize);

    const R = rand(1977);
    const cells = Array.from({ length: 46 }, () => ({
      x: R(), y: R(), z: 0.25 + R() * 0.95, rot: R() * TAU, spin: (R() - 0.5) * 0.8, tilt: 0.45 + R() * 0.55, wob: R() * TAU,
    }));
    const plates = Array.from({ length: 34 }, () => ({ x: R(), y: R(), z: 0.2 + R() * 0.8 }));
    const motes = Array.from({ length: 70 }, () => ({ x: R(), y: R(), z: R(), s: R() }));
    const abs = Array.from({ length: 7 }, (_, k) => ({ a: (k / 7) * TAU + R() * 0.4, d: 1.6 + R() * 0.8, delay: R() * 0.6, spin: R() * TAU }));

    let start = performance.now();
    let done = false;
    let raf = 0;
    let titleAt = reduce ? 0 : T_TITLE;
    if (reduce) start -= T_TITLE * 1000;

    function finish() {
      if (done) return;
      if (!ready) return;
      done = true;
      wrap.style.opacity = '0';
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', onKey, true);
      setTimeout(() => {
        cancelAnimationFrame(raf);
        wrap.remove();
        try { if (prevFocus && prevFocus.focus) prevFocus.focus({ preventScroll: true }); } catch { /* ignore */ }
        resolve();
      }, 460);
    }
    function jumpToTitle() {
      const t = (performance.now() - start) / 1000;
      if (t < titleAt) start = performance.now() - titleAt * 1000;
      else finish();
    }
    function onKey(e) {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (e.key === 'Escape') { ready = true; finish(); } else jumpToTitle(); }
    }
    skip.addEventListener('click', (e) => { e.stopPropagation(); if (ready) finish(); else jumpToTitle(); });
    wrap.addEventListener('click', () => jumpToTitle());
    window.addEventListener('keydown', onKey, true);

    function frame(now) {
      const t = (now - start) / 1000;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const W = vw, H = vh, M = Math.min(W, H);
      // vessel lumen
      const bg = ctx.createRadialGradient(W * 0.5, H * 0.5, M * 0.05, W * 0.5, H * 0.5, Math.max(W, H) * 0.75);
      bg.addColorStop(0, '#7a1630');
      bg.addColorStop(0.45, '#4a0c20');
      bg.addColorStop(1, '#14030a');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);
      // vessel wall rings rushing past (flying down the vessel)
      ctx.lineWidth = 2;
      for (let k = 0; k < 7; k++) {
        const p = ((t * 0.35 + k / 7) % 1);
        const rr = M * (0.15 + p * p * 1.2);
        ctx.strokeStyle = `rgba(255,120,150,${(0.12 * (1 - p)).toFixed(3)})`;
        ctx.beginPath();
        ctx.ellipse(W / 2, H / 2, rr * 1.25, rr, 0, 0, TAU);
        ctx.stroke();
      }
      for (const m of motes) {
        const x = ((m.x + t * (0.03 + m.z * 0.12)) % 1) * W;
        const y = m.y * H + Math.sin(t + m.s * 9) * 6;
        ctx.fillStyle = `rgba(255,200,210,${(0.15 + m.z * 0.25).toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(x, y, 0.8 + m.z * 1.6, 0, TAU);
        ctx.fill();
      }
      // red cells and platelets drifting in the flow, back to front
      const flow = t * 0.07;
      const sorted = cells;
      for (const c of sorted) {
        const x = ((c.x + flow * (0.6 + c.z) + 1) % 1.2 - 0.1) * W;
        const y = c.y * H + Math.sin(t * 0.8 + c.wob) * 14 * c.z;
        const r = M * 0.035 * (0.5 + c.z * 1.1);
        const a = 0.25 + 0.75 * Math.min(1, c.z);
        drawRbc(ctx, x, y, r, c.rot + t * c.spin, a * (t > titleAt ? 0.55 : 1), c.tilt);
      }
      for (const p of plates) {
        const x = ((p.x + flow * (0.9 + p.z) + 1) % 1.1) * W;
        drawPlatelet(ctx, x, p.y * H, M * 0.008 * (0.6 + p.z), 0.5 + p.z * 0.4);
      }

      // the hunt
      const cx = W * 0.5, cy = H * 0.52;
      const huntP = ease(t / T_HUNT);
      const eatP = clamp01((t - T_HUNT) / (T_EAT - T_HUNT));
      const nr = M * 0.13;
      if (t < T_TITLE + 0.8) {
        const fade = 1 - clamp01((t - T_TITLE) / 0.8);
        const bx = cx + M * 0.22 - eatP * M * 0.05 + Math.sin(t * 5) * M * 0.012 * (1 - eatP);
        const by = cy + Math.cos(t * 4) * M * 0.02 * (1 - eatP);
        const nx = cx - M * 0.55 + huntP * M * 0.52 + eatP * M * 0.2;
        const ny = cy + Math.sin(t * 2) * M * 0.015;
        // antibodies opsonise the bacterium
        for (const ab of abs) {
          const p = ease(clamp01((t - ab.delay - 0.3) / 1.6));
          const dist = M * 0.1 * (ab.d * (1 - p) + 0.55);
          const ax = bx + Math.cos(ab.a) * dist, ay = by + Math.sin(ab.a) * dist;
          drawAntibody(ctx, ax, ay, M * 0.022, ab.a - Math.PI / 2 + (1 - p) * ab.spin, fade * (1 - eatP * 0.9));
        }
        const bS = M * 0.06 * (1 - eatP * 0.55);
        drawBacterium(ctx, bx, by, bS, t, fade * (1 - eatP * 0.75), Math.sin(t * 2) * 0.2);
        drawNeutrophil(ctx, nx, ny, nr * (1 + eatP * 0.15), t, fade, eatP);
        if (eatP > 0.6 && eatP < 1) {
          const f = (eatP - 0.6) / 0.4;
          ctx.fillStyle = `rgba(255,240,180,${(0.5 * (1 - f)).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(bx, by, M * 0.05 + f * M * 0.15, 0, TAU);
          ctx.fill();
        }
        if (!short && t < T_EAT) {
          const capA = clamp01(t / 0.6) * (1 - clamp01((t - T_EAT + 0.5) / 0.5));
          ctx.globalAlpha = capA;
          ctx.font = `700 ${Math.max(13, M * 0.028)}px system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillStyle = 'rgba(255,230,236,0.92)';
          const cap = t < T_HUNT ? 'A gut bacterium has slipped into the bloodstream...' : 'Antibodies tag it; a neutrophil moves in to engulf it.';
          ctx.fillText(cap, W / 2, H - Math.max(46, H * 0.12));
          ctx.globalAlpha = 1;
        }
      }

      // title card
      if (t >= titleAt) {
        const p = ease((t - titleAt) / 0.9);
        const flash = 1 - clamp01((t - titleAt) / 0.5);
        if (flash > 0) {
          ctx.fillStyle = `rgba(255,235,245,${(flash * 0.85).toFixed(3)})`;
          ctx.fillRect(0, 0, W, H);
        }
        const vign = ctx.createRadialGradient(W / 2, H * 0.45, M * 0.1, W / 2, H * 0.45, M * 0.75);
        vign.addColorStop(0, `rgba(20,4,12,${(0.15 * p).toFixed(3)})`);
        vign.addColorStop(1, `rgba(20,4,12,${(0.6 * p).toFixed(3)})`);
        ctx.fillStyle = vign;
        ctx.fillRect(0, 0, W, H);
        const cs = M * 0.34 * (0.6 + 0.4 * p) * (1 + 0.02 * Math.sin(t * 2));
        const crestY = H * 0.36;
        ctx.globalAlpha = p;
        // orbiting immune cells around the crest
        for (let k = 0; k < 10; k++) {
          const a = t * 0.6 + (k / 10) * TAU;
          const ox = W / 2 + Math.cos(a) * cs * 0.85, oy = crestY + Math.sin(a) * cs * 0.32;
          if (k % 2) drawRbc(ctx, ox, oy, M * 0.018, a, p * 0.9, 0.7);
          else drawAntibody(ctx, ox, oy, M * 0.014, a, p * 0.9);
        }
        crest(ctx, W / 2, crestY, cs, p);
        const ts = Math.min(W * 0.11, M * 0.13);
        outlinedText(ctx, 'BODY BASTION', W / 2, crestY + cs * 0.62 + ts * 0.25, ts * (0.8 + 0.2 * p), '#ffe17a', '#5a1028', ts * 0.03);
        ctx.font = `800 ${Math.max(14, ts * 0.3)}px system-ui, sans-serif`;
        ctx.fillStyle = '#ffd6e4';
        ctx.textAlign = 'center';
        ctx.fillText('Defend the gut. Learn the drugs.', W / 2, crestY + cs * 0.62 + ts * 1.05);
        const tap = clamp01((t - titleAt - 0.9) / 0.4);
        if (tap > 0) {
          ctx.globalAlpha = tap * (ready ? 0.65 + 0.35 * Math.sin(t * 4) : 0.9);
          ctx.font = `900 ${Math.max(15, ts * 0.32)}px system-ui, sans-serif`;
          ctx.fillStyle = '#ffffff';
          const msg = ready ? 'Tap to begin' : ((typeof opts.statusText === 'function' ? opts.statusText() : opts.statusText) || 'Loading...');
          ctx.fillText(msg, W / 2, Math.min(H - 40, crestY + cs * 0.62 + ts * 1.9));
          if (!ready) {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 3;
            ctx.beginPath();
            const ry = Math.min(H - 40, crestY + cs * 0.62 + ts * 1.9) + ts * 0.55;
            ctx.arc(W / 2, ry, ts * 0.16, t * 5, t * 5 + 4.2);
            ctx.stroke();
          }
          ctx.font = `600 ${Math.max(11, M * 0.02)}px system-ui, sans-serif`;
          ctx.fillStyle = 'rgba(255,220,232,0.7)';
          ctx.globalAlpha = tap * 0.8;
          ctx.fillText('Maulana Azad Medical College, New Delhi - Department of Pharmacology' + (opts.version ? `   |   ${opts.version}` : ''), W / 2, H - Math.max(18, H * 0.035));
        }
        ctx.globalAlpha = 1;
        if (ready && opts.autoClose && t > titleAt + opts.autoClose) finish();
      }
      if (!done) raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
  });
}
