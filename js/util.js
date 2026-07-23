/* 决战动漫之巅 · 通用工具 */
window.AC = window.AC || {};

AC.esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

AC.debounce = (fn, ms) => {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
};

AC.shuffle = arr => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

AC.vibrate = p => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) { /* noop */ } };

AC.toast = (msg, ms = 2600) => {
  const host = document.getElementById('overlays') || document.body;
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 350); }, ms);
};

AC.icons = {
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20.2 20.2-3.4-3.4"/></svg>',
  undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>',
  loader: '<span class="ldr" aria-hidden="true"></span>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  restart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20.5 3.5V8H16"/></svg>',
  share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V4"/><path d="m8 7 4-4 4 4"/><path d="M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8"/></svg>',
  crown: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3.6 18.2 2.2 8.9c-.1-.7.8-1.2 1.3-.7l3.9 4.1 3.7-6.9c.3-.6 1.2-.6 1.6 0l3.7 6.9 3.9-4.1c.5-.5 1.4 0 1.3.7l-1.4 9.3c-.1.5-.5.8-1 .8H4.6c-.5 0-.9-.3-1-.8z"/></svg>',
  film: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18 4l2 3h-3l-2-3h-2l2 3h-3l-2-3H8l2 3H7L5 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/></svg>',
  add: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  remove: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M18 12H6"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>',
  trophy: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M5 2h14v3.22A3.5 3.5 0 0 1 22 8.5v.05a3.5 3.5 0 0 1-3.74 3.53c-.03.72-.08 1.14-.16 1.44-.15.6-.5 1.24-1.16 1.95-.74.8-2.04 1.58-4.47 2.18l-.06.26V22h4v1H8v-1h4v-4.1c-2.43-.6-3.73-1.38-4.47-2.18-.66-.7-1.01-1.35-1.16-1.95-.08-.3-.13-.72-.16-1.44A3.5 3.5 0 0 1 2.5 8.55v-.05A3.5 3.5 0 0 1 5 5.22V2z"/></svg>',
};

/* ---------- 彩带庆祝 ---------- */
AC.confetti = (colors) => {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cv = document.getElementById('fx');
  if (!cv) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
  cv.style.width = innerWidth + 'px'; cv.style.height = innerHeight + 'px';
  const ctx = cv.getContext('2d');
  ctx.scale(dpr, dpr);
  const pal = colors && colors.length ? colors : ['#24c8d4', '#ff6b3d', '#ffd166', '#ffffff'];
  const parts = [];
  const spawn = (x, dir) => {
    for (let i = 0; i < 90; i++) {
      const a = (-Math.PI / 2) + dir * (0.15 + Math.random() * 0.5);
      const v = 9 + Math.random() * 13;
      parts.push({
        x, y: innerHeight + 12,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        w: 5 + Math.random() * 6, h: 8 + Math.random() * 8,
        r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.35,
        c: pal[i % pal.length], life: 1,
      });
    }
  };
  spawn(innerWidth * 0.08, +1);
  spawn(innerWidth * 0.92, -1);
  const t0 = performance.now();
  cv.style.opacity = '1';
  (function tick(t) {
    const el = (t - t0) / 1000;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of parts) {
      p.vy += 0.26; p.vx *= 0.992;
      p.x += p.vx; p.y += p.vy; p.r += p.vr;
      if (el > 1.6) p.life -= 0.03;
      if (p.life <= 0) continue;
      ctx.save();
      ctx.globalAlpha = Math.max(p.life, 0);
      ctx.translate(p.x, p.y); ctx.rotate(p.r);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, Math.abs(Math.sin(el * 6 + p.x)) * p.h + 2);
      ctx.restore();
    }
    if (el < 3.4) requestAnimationFrame(tick);
    else { ctx.clearRect(0, 0, innerWidth, innerHeight); cv.style.opacity = '0'; }
  })(t0);
};
