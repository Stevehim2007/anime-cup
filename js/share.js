/* 决战动漫之巅 · 晋级之路分享图（含小组赛、淘汰赛对阵树，canvas 绘制） */
window.AC = window.AC || {};

AC.share = (() => {
  const W = 1080;
  const SITE_URL = `${location.origin}${location.pathname}`;
  const SITE_LABEL = (() => {
    try {
      const u = new URL(SITE_URL);
      const path = u.pathname.replace(/\/$/, '');
      return `${u.host}${path}`;
    } catch (e) {
      return SITE_URL.replace(/^https?:\/\//, '').replace(/\/$/, '');
    }
  })();
  const FONT_CN = '"Noto Sans SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';
  const FONT_EN = '"Space Grotesk", "SF Pro Display", sans-serif';
  const FONT_DISPLAY = '"Anton", "Space Grotesk", "Arial Narrow", sans-serif';

  function loadImg(url, ms = 10000) {
    return new Promise(resolve => {
      if (!url) return resolve(null);
      const im = new Image();
      im.crossOrigin = 'anonymous';
      const t = setTimeout(() => { im.src = ''; resolve(null); }, ms);
      im.onload = () => { clearTimeout(t); resolve(im); };
      im.onerror = () => { clearTimeout(t); resolve(null); };
      im.src = url;
    });
  }

  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function fit(ctx, text, maxW) {
    text = String(text ?? '');
    if (ctx.measureText(text).width <= maxW) return text;
    while (text.length > 1 && ctx.measureText(text + '…').width > maxW) text = text.slice(0, -1);
    return text + '…';
  }

  function wrapText(ctx, text, maxW, maxLines) {
    const tokens = String(text ?? '').match(/\S+\s*/g) || [''];
    const lines = [];
    let cur = '';
    const pushCur = () => { if (cur.trim()) lines.push(cur.trim()); cur = ''; };
    for (const tk of tokens) {
      if (ctx.measureText(cur + tk).width <= maxW) { cur += tk; continue; }
      if (ctx.measureText(tk.trim()).width <= maxW) { pushCur(); cur = tk; continue; }
      for (const ch of tk) {
        if (ctx.measureText(cur + ch).width > maxW && cur) { pushCur(); }
        cur += ch;
      }
    }
    pushCur();
    if (lines.length > maxLines) {
      lines.length = maxLines;
      lines[maxLines - 1] = fit(ctx, lines[maxLines - 1] + '…', maxW);
    }
    return lines.length ? lines : [''];
  }

  function drawCover(ctx, img, anime, x, y, size, radius) {
    ctx.save();
    rr(ctx, x, y, size, size, radius);
    ctx.clip();
    if (img && img.width > 0 && img.naturalWidth > 0) {
      ctx.drawImage(img, x, y, size, size);
    } else {
      const hue = ((anime ? anime.id : 7) % 360);
      const g = ctx.createLinearGradient(x, y, x + size, y + size);
      g.addColorStop(0, `hsl(${hue} 45% 30%)`);
      g.addColorStop(1, `hsl(${(hue + 60) % 360} 45% 18%)`);
      ctx.fillStyle = g;
      ctx.fillRect(x, y, size, size);
      ctx.fillStyle = 'rgba(255,255,255,.6)';
      ctx.font = `${Math.round(size * .4)}px ${FONT_CN}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🎬', x + size / 2, y + size / 2 + size * .02);
    }
    ctx.restore();
  }

  function drawWordmark(ctx, text, cx, cy, size, fillStyle, align = 'center') {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.transform(1, 0, -0.14, 1, 0, 0);
    ctx.font = `400 ${size}px ${FONT_DISPLAY}`;
    ctx.textAlign = align;
    ctx.fillStyle = fillStyle;
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  function drawQR(ctx, qr, x, y, size) {
    rr(ctx, x, y, size, size, 16);
    ctx.fillStyle = '#fff';
    ctx.fill();
    const pad = 14;
    const count = qr.getModuleCount();
    const cell = (size - pad * 2) / count;
    ctx.fillStyle = '#0b0b13';
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (qr.isDark(r, c)) ctx.fillRect(x + pad + c * cell, y + pad + r * cell, cell + .35, cell + .35);
      }
    }
  }

  let ctx2d = null;

  async function build(state, onProgress) {
    const animes = state.animes;
    const rounds = state.rounds;
    const T = AC.theme.colors();
    const final = rounds[rounds.length - 1][0];
    const champion = final.winner;

    try {
      await Promise.race([
        Promise.all([
          document.fonts.load(`900 44px ${FONT_CN}`),
          document.fonts.load(`700 22px ${FONT_CN}`),
          document.fonts.load(`400 46px ${FONT_DISPLAY}`),
        ]),
        new Promise(r => setTimeout(r, 1800)),
      ]);
    } catch (e) { /* 忽略 */ }

    const grad = (x0, y0, x1, y1) => {
      const g = ctx2d.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, T.acc1); g.addColorStop(1, T.acc2);
      return g;
    };

    /* ---------- 预载所有封面 ---------- */
    onProgress && onProgress('正在加载封面图片…');
    const allIds = new Set();
    for (const g of state.groups) for (const i of g) allIds.add(i);

    const thumbs = new Map();
    const thumbsSmall = new Map();
    const totalImages = allIds.size;
    let loadedCount = 0;

    const ids = [...allIds];
    for (let bi = 0; bi < ids.length; bi += 6) {
      const batch = ids.slice(bi, bi + 6);
      await Promise.all(batch.map(async i => {
        const a = animes[i];
        const [img, imgSm] = await Promise.all([
          loadImg(a.image || a.image_large || ''),
          loadImg(a.image_small || ''),
        ]);
        if (img) thumbs.set(i, img);
        if (imgSm) thumbsSmall.set(i, imgSm);
        loadedCount++;
        onProgress && onProgress(`封面 ${loadedCount}/${totalImages}`);
      }));
    }

    onProgress && onProgress('正在加载冠军封面…');
    const champUrl = animes[champion].image_large || animes[champion].image || '';
    const champImg = await loadImg(champUrl);
    if (champImg) thumbs.set(champion, champImg);

    onProgress && onProgress('正在绘制…');

    /* ---------- 小组赛布局 ---------- */
    const M = 24;
    const nGroups = state.size.groups;
    const hasWildcard = state.size.wild > 0 && state.wildcardPicks && state.wildcardPicks.length > 0;
    const colsG = nGroups <= 6 ? nGroups : nGroups <= 8 ? 4 : nGroups <= 10 ? 5 : 6;
    const rowsG = Math.ceil(nGroups / colsG);
    const gapG = 14;
    const cardW = Math.min(170, (W - 2 * M - (colsG - 1) * gapG) / colsG);
    const rowH = 24;
    const cardPad = 12;
    const cardHeadH = 22;
    const cardH = cardHeadH + cardPad + 4 * rowH + cardPad;
    const groupTitleH = 44;
    const groupTop = 148;
    const groupSecH = groupTitleH + rowsG * cardH + (rowsG - 1) * gapG + 10;

    let wildSecH = 0;
    if (hasWildcard) {
      const wildCardH = 54;
      wildSecH = 50 + Math.ceil(state.size.wild / Math.min(state.size.wild, 8)) * (wildCardH + 8);
    }

    const chartTop = groupTop + groupSecH + wildSecH + 24;

    /* ---------- 淘汰赛布局 ---------- */
    const PW = 170, PH = 46;
    const DX = 86, STUB = 12;
    const cols = rounds.length - 1;
    const n = state.size.bracket;
    const PAIR = n >= 32 ? 120 : n >= 16 ? 130 : n >= 8 ? 150 : 170;
    const GAP  = n >= 32 ? 64  : n >= 16 ? 72  : 90;
    const pairs = rounds[0].length / 2;
    const blockH = (pairs - 1) * (PAIR + GAP) + PAIR + PH;
    const chartH = Math.max(blockH, 470);
    const padTop = (chartH - blockH) / 2;
    const cy = chartTop + chartH / 2;

    /* ---------- 二维码 ---------- */
    let qrObj = null;
    try {
      if (typeof qrcode !== 'undefined') {
        qrObj = qrcode(0, 'M');
        qrObj.addData(SITE_URL);
        qrObj.make();
      }
    } catch (e) { qrObj = null; }

    const footerH = qrObj ? 248 : 142;
    const H = Math.ceil(chartTop + chartH + footerH);

    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = ctx2d = cv.getContext('2d');

    /* ---------- 背景 ---------- */
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#0a1628');
    bg.addColorStop(.4, '#060e1a');
    bg.addColorStop(1, '#0a1220');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    const glow1 = ctx.createRadialGradient(W * .16, 120, 0, W * .16, 120, 700);
    glow1.addColorStop(0, T.soft1); glow1.addColorStop(1, 'transparent');
    ctx.fillStyle = glow1; ctx.fillRect(0, 0, W, 900);
    const glow2 = ctx.createRadialGradient(W / 2, cy, 0, W / 2, cy, 520);
    glow2.addColorStop(0, T.soft2); glow2.addColorStop(1, 'transparent');
    ctx.fillStyle = glow2; ctx.fillRect(0, cy - 560, W, 1120);

    /* ---------- 头部 ---------- */
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    drawWordmark(ctx, 'ANIME CUP', W / 2, 66, 46, grad(W / 2 - 150, 0, W / 2 + 150, 0));
    ctx.textAlign = 'center';
    ctx.font = `900 44px ${FONT_CN}`;
    ctx.fillStyle = '#fff';
    ctx.fillText(fit(ctx, '决战动漫之巅', W - M * 2), W / 2, 126);

    /* ================================================================
       小组赛绘制
       ================================================================ */
    ctx.font = `700 24px ${FONT_CN}`;
    ctx.fillStyle = 'rgba(255,255,255,.7)';
    ctx.textAlign = 'left';
    ctx.fillText('小组赛 · GROUP STAGE', M + 4, groupTop + 28);

    for (let gi = 0; gi < nGroups; gi++) {
      const row = Math.floor(gi / colsG);
      const col = gi % colsG;
      const cx = M + col * (cardW + gapG);
      const cy2 = groupTop + groupTitleH + row * (cardH + gapG);

      rr(ctx, cx, cy2, cardW, cardH, 12);
      ctx.fillStyle = 'rgba(255,255,255,.045)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.1)';
      ctx.lineWidth = 1;
      rr(ctx, cx, cy2, cardW, cardH, 12);
      ctx.stroke();

      ctx.font = `700 15px ${FONT_DISPLAY}`;
      ctx.textAlign = 'left';
      const gFill = grad(cx, cy2, cx + cardW, cy2);
      ctx.fillStyle = gFill;
      ctx.fillText(AC.GROUP_LETTERS[gi] + ' 组', cx + 12, cy2 + 18);

      const g = state.groups[gi];
      for (let k = 0; k < 4; k++) {
        const idx = g[k];
        const a = animes[idx];
        const isPicked = state.groupPicks[gi] && state.groupPicks[gi].includes(idx);
        const ry = cy2 + cardHeadH + cardPad + k * rowH;
        const rx = cx + 10;

        if (isPicked) {
          ctx.font = `700 13px ${FONT_CN}`;
          ctx.fillStyle = gFill;
          ctx.textAlign = 'center';
          ctx.fillText('✓', rx + 8, ry + 17);
        } else {
          ctx.font = `400 13px ${FONT_CN}`;
          ctx.fillStyle = 'rgba(255,255,255,.18)';
          ctx.textAlign = 'center';
          ctx.fillText('○', rx + 8, ry + 17);
        }

        const thumbSize = 18;
        const thumbX = rx + 18;
        const thumbY = ry + 3;
        drawCover(ctx, thumbsSmall.get(idx) || thumbs.get(idx), a, thumbX, thumbY, thumbSize, 4);

        ctx.font = `${isPicked ? 600 : 400} 12px ${FONT_CN}`;
        ctx.fillStyle = isPicked ? 'rgba(255,255,255,.85)' : 'rgba(235,235,245,.45)';
        ctx.textAlign = 'left';
        ctx.fillText(fit(ctx, a.display || a.name, cardW - 60), rx + 44, ry + 17);
      }
    }

    /* ================================================================
       遗珠复活赛
       ================================================================ */
    if (hasWildcard) {
      const wildY = groupTop + groupSecH + 10;
      ctx.font = `600 18px ${FONT_CN}`;
      ctx.fillStyle = 'rgba(255,255,255,.55)';
      ctx.textAlign = 'left';
      ctx.fillText(`遗珠复活 · 捞回 ${state.size.wild} 部`, M + 4, wildY + 20);

      const wildCardW = 120, wildCardH = 54;
      const wildCols = Math.min(state.size.wild, 8);
      const wildGap = 10;
      for (let wi = 0; wi < state.wildcardPicks.length; wi++) {
        const idx = state.wildcardPicks[wi];
        const a = animes[idx];
        const wr = Math.floor(wi / wildCols);
        const wc = wi % wildCols;
        const wx = M + wc * (wildCardW + wildGap);
        const wy = wildY + 34 + wr * (wildCardH + 8);

        rr(ctx, wx, wy, wildCardW, wildCardH, 10);
        ctx.fillStyle = 'rgba(255,255,255,.055)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.12)';
        ctx.lineWidth = 1;
        rr(ctx, wx, wy, wildCardW, wildCardH, 10);
        ctx.stroke();

        drawCover(ctx, thumbs.get(idx), a, wx + 8, wy + 9, 36, 8);

        ctx.font = `500 13px ${FONT_CN}`;
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'left';
        ctx.fillText(fit(ctx, a.display || a.name, wildCardW - 36 - 22), wx + 36 + 16, wy + wildCardH / 2 + 4);
      }
    }

    /* ================================================================
       淘汰赛对阵树
       ================================================================ */
    const lv = [];
    {
      const l0 = [];
      for (let p = 0; p < pairs; p++) {
        const yA = chartTop + padTop + PH / 2 + p * (PAIR + GAP);
        l0.push(yA, yA + PAIR);
      }
      lv.push(l0);
      for (let k = 1; k < cols; k++) {
        const prev = lv[k - 1], cur = [];
        for (let i = 0; i < prev.length; i += 2) cur.push((prev[i] + prev[i + 1]) / 2);
        lv.push(cur);
      }
    }

    const colX = (k, side) => side === 0 ? M + k * DX : W - M - PW - k * DX;
    const colSongs = (r, side) => {
      const ms = rounds[r], h = ms.length / 2;
      const out = [];
      for (const m of ms.slice(side * h, side * h + h)) {
        out.push({ s: m.a, win: m.winner === m.a });
        out.push({ s: m.b, win: m.winner === m.b });
      }
      return out;
    };

    const A = chartH >= 680 ? 170 : 132;
    ctx.font = `900 34px ${FONT_CN}`;
    const nameLines = wrapText(ctx, animes[champion].display || animes[champion].name, 400, 2);
    const metaTxt = [animes[champion].date ? animes[champion].date.slice(0, 4) : '', animes[champion].platform].filter(Boolean).join(' · ');
    const champBlockH = A + 18 + 44 + 16 + nameLines.length * 46 + (metaTxt ? 34 : 0);
    const artY = cy - champBlockH / 2;
    const artX = (W - A) / 2;
    const artCY = artY + A / 2;

    /* 连接线 */
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    for (let side = 0; side < 2; side++) {
      for (let k = 0; k < cols; k++) {
        const x = colX(k, side);
        const edge = side === 0 ? x + PW : x;
        const jx = side === 0 ? edge + STUB : edge - STUB;
        const ys = lv[k];
        ctx.strokeStyle = 'rgba(255,255,255,.15)';
        for (let i = 0; i < ys.length; i += 2) {
          ctx.beginPath();
          ctx.moveTo(edge, ys[i]);
          ctx.lineTo(jx, ys[i]);
          ctx.lineTo(jx, ys[i + 1]);
          ctx.lineTo(edge, ys[i + 1]);
          ctx.stroke();
        }
        if (k === cols - 1) {
          const mid = (ys[0] + ys[1]) / 2;
          ctx.beginPath();
          ctx.moveTo(jx, mid);
          ctx.lineTo(jx, artCY);
          ctx.lineTo(side === 0 ? artX : artX + A, artCY);
          ctx.stroke();
        }
      }
    }
    ctx.strokeStyle = T.acc1;
    ctx.lineWidth = 2.5;
    for (let side = 0; side < 2; side++) {
      for (let k = 0; k < cols; k++) {
        const entries = colSongs(k, side);
        const i = entries.findIndex(e => e.s === champion);
        if (i < 0) continue;
        const x = colX(k, side);
        const edge = side === 0 ? x + PW : x;
        const jx = side === 0 ? edge + STUB : edge - STUB;
        const y = lv[k][i];
        const nextY = k + 1 < cols ? lv[k + 1][Math.floor(i / 2)] : artCY;
        ctx.beginPath();
        ctx.moveTo(edge, y);
        ctx.lineTo(jx, y);
        ctx.lineTo(jx, nextY);
        if (k === cols - 1) ctx.lineTo(side === 0 ? artX : artX + A, nextY);
        ctx.stroke();
      }
    }

    /* 对阵卡 */
    function pill(x, yC, e) {
      const y = yC - PH / 2;
      const isChamp = e.s === champion;
      rr(ctx, x, y, PW, PH, 12);
      if (isChamp) {
        const g = ctx.createLinearGradient(x, y, x + PW, y);
        g.addColorStop(0, T.soft1); g.addColorStop(1, 'rgba(255,255,255,.06)');
        ctx.fillStyle = g;
      } else {
        ctx.fillStyle = e.win ? 'rgba(255,255,255,.075)' : 'rgba(255,255,255,.035)';
      }
      ctx.fill();
      if (isChamp) {
        ctx.strokeStyle = grad(x, y, x + PW, y);
        ctx.lineWidth = 2;
      } else {
        ctx.strokeStyle = e.win ? 'rgba(255,255,255,.2)' : 'rgba(255,255,255,.08)';
        ctx.lineWidth = 1.5;
      }
      rr(ctx, x, y, PW, PH, 12);
      ctx.stroke();
      drawCover(ctx, thumbs.get(e.s), animes[e.s], x + 8, y + 8, PH - 16, 7);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.font = `${e.win ? 700 : 400} 19px ${FONT_CN}`;
      ctx.fillStyle = e.win ? '#fff' : 'rgba(235,235,245,.42)';
      ctx.fillText(fit(ctx, animes[e.s].display || animes[e.s].name, PW - (PH - 16) - 26), x + PH - 16 + 16, yC + 1);
      ctx.textBaseline = 'alphabetic';
    }
    for (let side = 0; side < 2; side++) {
      for (let k = 0; k < cols; k++) {
        const entries = colSongs(k, side);
        const x = colX(k, side);
        entries.forEach((e, i) => pill(x, lv[k][i], e));
      }
    }

    /* 中央冠军 */
    ctx.save();
    ctx.shadowColor = T.soft1; ctx.shadowBlur = 80; ctx.shadowOffsetY = 16;
    rr(ctx, artX, artY, A, A, 26);
    ctx.fillStyle = '#14141d'; ctx.fill();
    ctx.restore();
    drawCover(ctx, champImg || thumbs.get(champion), animes[champion], artX, artY, A, 26);
    rr(ctx, artX, artY, A, A, 26);
    ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.save();
    ctx.translate(artX + A - 8, artY - 4);
    ctx.rotate(.3);
    ctx.font = '56px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = 1;
    ctx.fillText('👑', 0, 0);
    ctx.restore();

    let y = artY + A + 18;
    ctx.font = `700 22px ${FONT_CN}`;
    const pillTxt = '🏆 冠军 · CHAMPION';
    const pw2 = ctx.measureText(pillTxt).width + 52;
    rr(ctx, (W - pw2) / 2, y, pw2, 44, 22);
    ctx.fillStyle = grad((W - pw2) / 2, y, (W + pw2) / 2, y);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(pillTxt, W / 2, y + 23);
    ctx.textBaseline = 'alphabetic';
    y += 44 + 16;

    ctx.font = `900 34px ${FONT_CN}`;
    ctx.fillStyle = '#fff';
    for (const ln of nameLines) { ctx.fillText(ln, W / 2, y + 32); y += 46; }
    if (metaTxt) {
      ctx.font = `500 20px ${FONT_CN}`;
      ctx.fillStyle = 'rgba(235,235,245,.5)';
      ctx.fillText(fit(ctx, metaTxt, 380), W / 2, y + 24);
    }

    /* 底部 */
    const fy = chartTop + chartH + 34;
    ctx.strokeStyle = 'rgba(255,255,255,.09)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(M + 40, fy); ctx.lineTo(W - M - 40, fy); ctx.stroke();
    if (qrObj) {
      const QS = 140, rowY = fy + 34;
      ctx.font = `400 34px ${FONT_DISPLAY}`;
      const wmW = ctx.measureText('ANIME CUP').width;
      ctx.font = `400 20px ${FONT_CN}`;
      const tagW = ctx.measureText('为你的本命动漫办一场世界杯').width;
      ctx.font = `500 16px ${FONT_EN}`;
      const urlW = ctx.measureText(SITE_LABEL).width;
      const textW = Math.max(wmW, tagW, urlW);
      const gx = (W - (QS + 34 + textW)) / 2;
      drawQR(ctx, qrObj, gx, rowY, QS);
      const tx = gx + QS + 34;
      drawWordmark(ctx, 'ANIME CUP', tx + 8, rowY + 44, 34, grad(tx, rowY, tx + 220, rowY), 'left');
      ctx.textAlign = 'left';
      ctx.font = `400 20px ${FONT_CN}`;
      ctx.fillStyle = 'rgba(235,235,245,.5)';
      ctx.fillText('为你的本命动漫办一场世界杯', tx, rowY + 84);
      ctx.font = `500 16px ${FONT_EN}`;
      ctx.fillStyle = 'rgba(235,235,245,.32)';
      ctx.fillText(SITE_LABEL, tx, rowY + 114);
    } else {
      drawWordmark(ctx, 'ANIME CUP', W / 2, fy + 52, 32, grad(W / 2 - 110, fy, W / 2 + 110, fy));
      ctx.textAlign = 'center';
      ctx.font = `400 20px ${FONT_CN}`;
      ctx.fillStyle = 'rgba(235,235,245,.4)';
      ctx.fillText('为你的本命动漫办一场世界杯', W / 2, fy + 88);
    }

    ctx.globalAlpha = .05;
    for (let i = 0, cnt = Math.floor(W * H / 900); i < cnt; i++) {
      ctx.fillStyle = Math.random() > .5 ? '#fff' : '#000';
      ctx.fillRect(Math.random() * W, Math.random() * H, 1.4, 1.4);
    }
    ctx.globalAlpha = 1;

    const blob = await new Promise(res => cv.toBlob(res, 'image/jpeg', .92));
    return { blob };
  }

  return { build };
})();
