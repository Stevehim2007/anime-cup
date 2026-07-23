/* 决战动漫之巅 · 主应用（状态机 + 渲染 + 交互） */
(() => {
  const KEY = 'animecup_v1';
  const CHIPS = ['进击的巨人', '鬼灭之刃', '钢之炼金术师', '命运石之门', '星际牛仔', '咒术回战'];
  const TIPS = ['正在收集动漫数据…', '按添加顺序分档抽签…', '排布小组签位…', '灯光调试中…'];

  let state = null;
  let epoch = 0;
  let busy = false;
  const ui = { view: null, sug: null, q: '', tipTimer: 0, shareBlob: null, shareUrl: null };

  const $ = sel => document.querySelector(sel);
  const esc = AC.esc;

  /* ---------- 持久化 ---------- */
  const save = () => { try { state ? localStorage.setItem(KEY, JSON.stringify(state)) : localStorage.removeItem(KEY); } catch (e) {} };
  const loadSave = () => {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || 'null');
      return s && s.v === 1 && Array.isArray(s.animes) && s.size ? s : null;
    } catch (e) { return null; }
  };

  /* ---------- 撤销 ---------- */
  const clearMatch = (r, m) => {
    const match = state.rounds[r][m];
    match.winner = null;
    if (r + 1 < state.rounds.length) {
      const nm = state.rounds[r + 1][Math.floor(m / 2)];
      if (m % 2 === 0) nm.a = null; else nm.b = null;
    }
  };
  function undo() {
    if (!state) return;
    epoch++; busy = false;
    const s = state;
    switch (s.phase) {
      case 'draw':
        s.phase = 'collect';
        break;
      case 'group':
        if (s.gi > 0) { s.gi--; s.sel = s.groupPicks.pop(); }
        else { s.phase = 'draw'; s.sel = []; }
        break;
      case 'wildcard':
        s.phase = 'group';
        s.gi = s.size.groups - 1;
        s.sel = s.groupPicks.pop();
        break;
      case 'knockout': {
        const cur = s.rounds[s.ri][s.mi];
        if (cur.winner != null) clearMatch(s.ri, s.mi);
        else if (s.mi > 0) { s.mi--; clearMatch(s.ri, s.mi); }
        else if (s.ri > 0) { s.ri--; s.mi = s.rounds[s.ri].length - 1; clearMatch(s.ri, s.mi); }
        else if (s.size.wild > 0) {
          s.phase = 'wildcard';
          s.sel = s.wildcardPicks; s.wildcardPicks = [];
          s.rounds = null; s.ri = 0; s.mi = 0;
        } else {
          s.phase = 'group';
          s.gi = s.size.groups - 1;
          s.sel = s.groupPicks.pop();
          s.rounds = null; s.ri = 0; s.mi = 0;
        }
        break;
      }
      case 'done':
        s.phase = 'knockout';
        s.ri = s.rounds.length - 1; s.mi = 0;
        s.rounds[s.ri][0].winner = null;
        s.celebrated = false;
        break;
    }
    save(); render();
  }

  /* ---------- 小部件 ---------- */
  const cover = (a, size) => a.image
    ? `<img src="${esc(a.image)}" loading="lazy" alt="">`
    : `<div class="noart">${AC.icons.film}</div>`;
  const meta = a => {
    const parts = [];
    if (a.date) parts.push(a.date.slice(0, 4));
    if (a.platform) parts.push(a.platform);
    if (a.eps) parts.push(a.eps + '话');
    return parts.join(' · ');
  };

  function progress() {
    if (!state) return 0;
    const total = state.size.groups + (state.size.wild ? 1 : 0) + (state.size.bracket - 1);
    let done = state.groupPicks.length;
    if (state.size.wild && (state.phase === 'knockout' || state.phase === 'done')) done += 1;
    if (state.rounds) done += state.rounds.flat().filter(m => m.winner != null).length;
    return Math.min(100, Math.round(done / total * 100));
  }

  function phaseLabel() {
    switch (state.phase) {
      case 'collect': return '挑选动漫';
      case 'draw': return '小组抽签';
      case 'group': return `小组赛 · ${AC.GROUP_LETTERS[state.gi]} 组`;
      case 'wildcard': return '遗珠复活赛';
      case 'knockout': return `${AC.roundNames(state.size.bracket)[state.ri]} · 第 ${state.mi + 1} 场`;
      case 'done': return '冠军诞生';
      default: return '';
    }
  }

  /* ============================================================
     渲染
     ============================================================ */
  function render() {
    clearInterval(ui.tipTimer);
    renderTopbar();
    const app = $('#app');
    if (!state) { app.innerHTML = tplHome(); wireSearch(); return; }
    switch (state.phase) {
      case 'collect': app.innerHTML = tplCollect(); wireSearch(); break;
      case 'draw': app.innerHTML = tplDraw(); break;
      case 'group': app.innerHTML = tplGroup(); syncGroupSel(); break;
      case 'wildcard': app.innerHTML = tplWild(); syncWildSel(); break;
      case 'knockout': app.innerHTML = tplKnockout(); break;
      case 'done': app.innerHTML = tplDone(); celebrate(); break;
    }
    if (ui.view === 'loading') { app.innerHTML = tplLoading(); startTips(); }
    window.scrollTo(0, 0);
  }

  function renderTopbar() {
    const tb = $('#topbar');
    if (!state || ui.view === 'loading') { tb.hidden = true; return; }
    tb.hidden = false;
    const title = state.phase === 'collect' ? '决战动漫之巅' : '决战动漫之巅';
    const label = state.phase === 'collect' ? `已选 ${state.animes.length} 部` : phaseLabel();
    tb.innerHTML = `
      <button class="tb-btn" data-act="undo" aria-label="返回上一步">${AC.icons.undo}</button>
      <div class="tb-mid">
        <span class="tb-artist">${esc(title)}</span>
        <span class="tb-phase">${label}</span>
      </div>
      <button class="tb-btn" data-act="restart-ask" aria-label="重新开始">${AC.icons.restart}</button>
      <div class="tb-prog"><i style="width:${progress()}%"></i></div>`;
  }

  /* ---------- 首页 ---------- */
  function tplHome() {
    return `<section class="screen home">
      <div class="hero">
        <h1 class="logo-lockup" aria-label="动漫之巅">
          <span class="logo-badge" aria-hidden="true">🏆</span>
          <span class="logo-anime" aria-hidden="true"><i>动</i><i>漫</i><i>之</i><i>巅</i></span>
          <span class="logo-cup" aria-hidden="true">CUP</span>
        </h1>
        <p class="slogan">决战动漫之巅</p>
        <p class="tagline">挑选你喜欢的动漫，开启世界杯对决</p>
      </div>
      <div class="searchbox" id="searchbox">
        <div class="search-field">
          ${AC.icons.search}
          <input id="q" type="search" placeholder="搜索动漫：进击的巨人 / 星际牛仔…" autocomplete="off" enterkeyhint="search">
        </div>
        <div class="sug" id="sug"></div>
      </div>
      <div class="chips-wrap">
        <p class="chips-label">热门动漫</p>
        <div class="chips">${CHIPS.map(c => `<button class="chip" data-act="chip-add" data-name="${esc(c)}">${esc(c)}</button>`).join('')}</div>
      </div>
      <p class="home-foot">小组赛 → 遗珠复活 → 淘汰赛，选出你的本命动漫</p>
      <div class="credit">
        <p class="credit-name">@青棠</p>
        <p class="credit-desc">青棠科技</p>
      </div>
    </section>`;
  }

  function tplLoading() {
    return `<section class="screen loading">
      <div class="spinner"><span class="note">${AC.icons.film}</span></div>
      <div>
        <div class="loading-artist">${esc(ui.artistName || '加载中')}</div>
        <p class="loading-tip" id="loadTip">${TIPS[0]}</p>
      </div>
    </section>`;
  }
  function startTips() {
    let i = 0;
    ui.tipTimer = setInterval(() => {
      const el = $('#loadTip');
      if (!el) return clearInterval(ui.tipTimer);
      i = (i + 1) % TIPS.length;
      el.style.opacity = 0;
      setTimeout(() => { el.textContent = TIPS[i]; el.style.opacity = 1; }, 260);
    }, 1500);
  }

  /* ---------- 搜索 ---------- */
  function wireSearch() {
    const q = $('#q');
    if (!q) return;
    q.addEventListener('input', () => {
      const term = q.value.trim();
      ui.q = term;
      if (!term) { ui.sug = null; renderSug(); return; }
      const minLen = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/.test(term) ? 1 : 2;
      if (term.length < minLen) return;
      doSearch(term);
    });
    q.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      const first = document.querySelector('#sug [data-act="add-anime"]');
      if (first) { first.click(); q.blur(); }
      else if (ui.q) searchNow(ui.q);
    });
  }
  async function searchNow(term) {
    try {
      const res = await AC.api.searchAnime(term);
      if (term !== ui.q) return;
      ui.sug = res;
      renderSug();
    } catch (e) {
      if (term === ui.q) AC.toast('搜索失败，请检查网络');
    }
  }
  const doSearch = AC.debounce(searchNow, 300);
  function renderSug() {
    const el = $('#sug'), box = $('#searchbox');
    if (!el) return;
    if (!ui.sug) { el.innerHTML = ''; box && box.classList.remove('open'); return; }
    box && box.classList.add('open');
    el.innerHTML = ui.sug.length
      ? ui.sug.map(a => {
          const added = state && state.animes && state.animes.some(x => x.id === a.id);
          return `<button class="sug-item" data-act="add-anime" data-idx="${a.id}"${added ? ' disabled' : ''}>
            <span class="sug-meta">
              <span class="sug-name">${esc(a.display || a.name)}</span>
              <span class="sug-genre">${esc(a.meta || '')}${added ? ' · 已添加' : ''}</span>
            </span>
            ${added ? `<span class="sug-added">✓</span>` : `<span class="sug-add-btn">${AC.icons.add}</span>`}
          </button>`;
        }).join('')
      : `<div class="sug-empty">没找到这部动漫，试试其他关键词</div>`;
  }

  /* ---------- 选动漫 ---------- */
  async function addAnimeById(id) {
    if (!ui.sug) return;
    const basic = ui.sug.find(x => x.id === id);
    if (!basic) return;
    if (state && state.animes && state.animes.some(x => x.id === basic.id)) {
      AC.toast('这部动漫已在你选择的列表中');
      return;
    }
    if (!state) {
      state = { v: 1, animes: [], phase: 'collect', size: AC.SIZES[3], gi: 0, sel: [], groupPicks: [], wildcardPicks: [], rounds: null, ri: 0, mi: 0, celebrated: false };
    }

    /* 显示加载中 */
    const btn = document.querySelector(`[data-act="add-anime"][data-idx="${id}"]`);
    if (btn) { btn.disabled = true; btn.querySelector('.sug-add-btn') && (btn.querySelector('.sug-add-btn').innerHTML = AC.icons.loader); }

    try {
      /* 拉取详情获取封面图 */
      const detail = await AC.api.getSubjectDetail(id);
      const a = { ...basic, ...detail, image: detail.image || basic.image, image_large: detail.image_large || basic.image_large, image_small: detail.image_small || basic.image_small };
      if (!state) { state = { v: 1, animes: [], phase: 'collect', size: AC.SIZES[3], gi: 0, sel: [], groupPicks: [], wildcardPicks: [], rounds: null, ri: 0, mi: 0, celebrated: false }; }
      if (state.animes.some(x => x.id === a.id)) { AC.toast('这部动漫已在你选择的列表中'); renderSug(); return; }
      state.animes.push(a);
      AC.vibrate(8);
    } catch (e) {
      /* 详情拉取失败，用搜索结果的简易数据 */
      if (state.animes.some(x => x.id === basic.id)) { AC.toast('这部动漫已在你选择的列表中'); renderSug(); return; }
      state.animes.push(basic);
      AC.vibrate(8);
    }
    save();

    state.phase = 'collect';
    state.size = AC.SIZES[3];
    state.groups = null;
    state.groupOf = null;
    state.groupPicks = [];
    state.wildcardPicks = [];
    state.rounds = null;
    state.ri = 0; state.mi = 0;
    state.celebrated = false;

    renderSug();
    render();
    AC.toast(`已添加「${basic.display || basic.name}」`);
  }

  function removeAnime(idx) {
    if (!state || !state.animes) return;
    const a = state.animes[idx];
    state.animes.splice(idx, 1);
    state.groups = null;
    state.groupOf = null;
    state.groupPicks = [];
    state.wildcardPicks = [];
    state.rounds = null;
    state.ri = 0; state.mi = 0;
    state.phase = 'collect';
    AC.vibrate(8);
    save();
    render();
    AC.toast(`已移除「${a.display || a.name}」`);
  }

  function startGame() {
    if (!state || !state.animes) return;
    const size = AC.pickSize(state.animes.length);
    if (!size) { AC.toast('至少需要 8 部动漫才能开始比赛'); return; }
    const use = state.animes.slice(0, size.n);
    const groups = AC.drawGroups(size.groups);
    const groupOf = {};
    groups.forEach((g, gi) => g.forEach(i => { groupOf[i] = gi; }));

    state.size = size;
    state.groups = groups;
    state.groupOf = groupOf;
    state.phase = 'draw';
    state.gi = 0;
    state.sel = [];
    state.groupPicks = [];
    state.wildcardPicks = [];
    state.rounds = null;
    state.ri = 0; state.mi = 0;
    state.celebrated = false;

    save(); render();
  }

  /* ---------- 收藏页（选动漫） ---------- */
  function tplCollect() {
    const animes = state.animes || [];
    const sizeTexts = AC.SIZES.filter(s => animes.length >= s.n).map(s => `${s.n}部赛制`);
    const nextTarget = AC.SIZES.slice().reverse().find(s => animes.length < s.n);
    const needText = nextTarget ? `还差 ${nextTarget.n - animes.length} 部即可开启${nextTarget.n}部赛制` : '';

    return `<section class="screen with-topbar${animes.length >= 8 ? ' with-cta' : ''}">
      <div class="searchbox" id="searchbox" style="margin-top:12px">
        <div class="search-field">
          ${AC.icons.search}
          <input id="q" type="search" placeholder="搜索动漫并加入比赛…" autocomplete="off" enterkeyhint="search">
        </div>
        <div class="sug" id="sug"></div>
      </div>

      <div class="roster-wrap">
        <div class="roster-head">
          <h3>我的阵容</h3>
          <span class="roster-count">${animes.length} 部</span>
        </div>
        ${animes.length === 0 ? `<p class="roster-empty">搜索动漫并点击添加到阵容中</p>` : ''}
        <div class="roster-grid">
          ${animes.map((a, i) => `
            <div class="roster-card" style="animation-delay:${Math.min(i * 30, 400)}ms">
              <div class="rart">${cover(a, 200)}</div>
              <div class="rmeta">
                <div class="rname">${esc(a.display || a.name)}</div>
                <div class="rinfo">${meta(a)}</div>
                ${a.rating ? `<div class="rrating">${AC.icons.star} ${a.rating.toFixed(1)}</div>` : ''}
              </div>
              <button class="rremove" data-act="remove-anime" data-i="${i}" aria-label="移除">${AC.icons.remove}</button>
            </div>`).join('')}
        </div>
      </div>

      ${needText ? `<p class="need-hint">${needText}</p>` : ''}
      ${animes.length >= 8 ? `<div class="cta-bar"><button class="btn primary" data-act="start-game">开始对战 · ${sizeTexts[0]}</button></div>` : ''}
      ${animes.length < 8 && animes.length > 0 ? `<p class="need-hint">至少需要 8 部动漫，已选 ${animes.length} 部</p>` : ''}
      <div class="chips-wrap" style="margin-top:16px">
        <p class="chips-label">快速搜索</p>
        <div class="chips">${CHIPS.map(c => `<button class="chip" data-act="chip-search" data-name="${esc(c)}">${esc(c)}</button>`).join('')}</div>
      </div>
    </section>`;
  }

  /* ---------- 抽签展示 ---------- */
  function tplDraw() {
    const s = state.size;
    const wildTxt = s.wild
      ? `每组选 2 部直通，落选动漫再复活 ${s.wild} 部 → ${s.bracket} 强`
      : `每组选 2 部晋级 → ${s.bracket} 强淘汰赛`;
    const cut = state.animes.length > s.n ? `已按添加顺序选出前 ${s.n} 部 · ` : '';
    return `<section class="screen with-topbar with-cta">
      <div class="draw-head">
        <span class="pill grad">分组抽签完毕</span>
        <h2>决战动漫之巅</h2>
        <p class="sub">${cut}${wildTxt}</p>
      </div>
      <div class="stat-row">
        <div class="stat"><b class="en">${s.n}</b><span>参赛动漫</span></div>
        <div class="stat"><b class="en">${s.groups}</b><span>个小组</span></div>
        <div class="stat"><b class="en">${s.bracket}</b><span>强席位</span></div>
      </div>
      <div class="group-grid">
        ${state.groups.map((g, gi) => `
          <div class="gcard" style="animation-delay:${Math.min(gi * 55, 600)}ms">
            <div class="gcard-head"><b>${AC.GROUP_LETTERS[gi]}</b><span>GROUP</span></div>
            ${g.map(i => {
              const a = state.animes[i];
              return `<div class="gsong">${a.image ? `<img src="${esc(a.image)}" loading="lazy" alt="">` : `<div class="noart">${AC.icons.film}</div>`}<span>${esc(a.display || a.name)}</span></div>`;
            }).join('')}
          </div>`).join('')}
      </div>
      <div class="cta-bar"><button class="btn primary" data-act="start-group">开始小组赛</button></div>
    </section>`;
  }

  /* ---------- 小组赛 ---------- */
  function tplGroup() {
    const g = state.groups[state.gi];
    return `<section class="screen with-topbar with-cta">
      <div class="phase-head">
        <span class="pill">小组赛 · GROUP STAGE</span>
        <h2><span class="en grad-text">${AC.GROUP_LETTERS[state.gi]}</span> 组</h2>
        <p class="sub">选出你更喜欢的 2 部，直通 ${state.size.bracket} 强</p>
        <p class="count en">${state.gi + 1} / ${state.size.groups}</p>
      </div>
      <div class="pick-grid">
        ${g.map((i, k) => {
          const a = state.animes[i];
          return `<div class="scard" data-act="toggle-pick" data-i="${i}" role="button" tabindex="0" style="animation-delay:${k * 70}ms">
            <div class="art">${cover(a, 300)}<div class="check">✓</div></div>
            <div class="meta">
              <div class="tname">${esc(a.display || a.name)}</div>
              <div class="talbum">${meta(a)}</div>
            </div>
          </div>`;
        }).join('')}
      </div>
      <div class="cta-bar"><button class="btn primary" id="confirmBtn" data-act="confirm-group" disabled>已选 0 / 2</button></div>
    </section>`;
  }

  function togglePick(i) {
    const s = state.sel, at = s.indexOf(i);
    if (at >= 0) s.splice(at, 1);
    else { s.push(i); if (s.length > 2) s.shift(); }
    AC.vibrate(8);
    syncGroupSel(); save();
  }
  function syncGroupSel() {
    document.querySelectorAll('.scard[data-i]').forEach(el =>
      el.classList.toggle('picked', state.sel.includes(+el.dataset.i)));
    const btn = $('#confirmBtn');
    if (!btn) return;
    const n = state.sel.length;
    btn.disabled = n !== 2;
    if (n !== 2) btn.textContent = `已选 ${n} / 2`;
    else if (state.gi + 1 < state.size.groups) btn.textContent = `锁定，进入 ${AC.GROUP_LETTERS[state.gi + 1]} 组`;
    else btn.textContent = state.size.wild ? '锁定，进入遗珠复活赛' : '锁定，开启淘汰赛';
  }
  function confirmGroup() {
    if (state.sel.length !== 2) return;
    state.groupPicks.push(state.sel.slice());
    state.sel = [];
    if (state.groupPicks.length < state.size.groups) {
      state.gi++;
      save(); render();
    } else if (state.size.wild > 0) {
      state.phase = 'wildcard';
      save(); render();
    } else {
      startKnockout();
    }
  }

  /* ---------- 遗珠复活赛 ---------- */
  function tplWild() {
    const leftovers = [];
    state.groups.forEach((g, gi) => g.forEach(i => {
      if (!state.groupPicks[gi].includes(i)) leftovers.push({ i, gi });
    }));
    return `<section class="screen with-topbar with-cta">
      <div class="phase-head">
        <span class="pill">遗珠复活赛 · PLAY-OFF</span>
        <h2>捞回<span class="grad-text">遗珠</span></h2>
        <p class="sub">落选的 ${leftovers.length} 部里还有 <b>${state.size.wild}</b> 个复活名额</p>
      </div>
      <div class="wild-grid">
        ${leftovers.map((o, k) => {
          const a = state.animes[o.i];
          return `<div class="wcard" data-act="toggle-wild" data-i="${o.i}" role="button" tabindex="0" style="animation-delay:${Math.min(k * 30, 500)}ms">
            <div class="art">${cover(a, 300)}
              <span class="gbadge">${AC.GROUP_LETTERS[o.gi]}</span>
              <div class="check">✓</div>
            </div>
            <div class="wname">${esc(a.display || a.name)}</div>
          </div>`;
        }).join('')}
      </div>
      <div class="cta-bar"><button class="btn primary" id="confirmBtn" data-act="confirm-wild" disabled>已复活 0 / ${state.size.wild}</button></div>
    </section>`;
  }
  function toggleWild(i) {
    const s = state.sel, at = s.indexOf(i);
    if (at >= 0) s.splice(at, 1);
    else if (s.length >= state.size.wild) {
      AC.toast(`复活名额只有 ${state.size.wild} 个，先取消一部`);
      return;
    } else s.push(i);
    AC.vibrate(8);
    syncWildSel(); save();
  }
  function syncWildSel() {
    document.querySelectorAll('.wcard[data-i]').forEach(el =>
      el.classList.toggle('picked', state.sel.includes(+el.dataset.i)));
    const btn = $('#confirmBtn');
    if (!btn) return;
    const n = state.sel.length, w = state.size.wild;
    btn.disabled = n !== w;
    btn.textContent = n === w ? '名单齐了，开启淘汰赛' : `已复活 ${n} / ${w}`;
  }
  function confirmWild() {
    if (state.sel.length !== state.size.wild) return;
    state.wildcardPicks = state.sel.slice();
    state.sel = [];
    startKnockout();
  }

  /* ---------- 淘汰赛 ---------- */
  function startKnockout() {
    const placed = AC.seedBracket(state);
    state.rounds = AC.buildRounds(placed);
    state.phase = 'knockout';
    state.ri = 0; state.mi = 0;
    save(); render();
    showIntro(...introFor(0));
  }

  function introFor(r) {
    const names = AC.roundNames(state.size.bracket);
    const count = state.rounds[r].length;
    if (count === 1) return ['决赛', '最后一战，选出你的本命动漫'];
    if (count === 2) return ['半决赛', '四强对决，两个半区的巅峰'];
    return [names[r], `${count * 2} 部动漫 · ${count} 场对决 · 点选更喜欢的一部`];
  }

  function tplKnockout() {
    const names = AC.roundNames(state.size.bracket);
    const round = state.rounds[state.ri];
    const m = round[state.mi];
    const isFinal = state.ri === state.rounds.length - 1;
    const dcard = (i, side) => {
      const a = state.animes[i];
      return `<div class="dcard" data-act="win" data-side="${side}" role="button" tabindex="0" aria-label="选择 ${esc(a.display || a.name)}">
        <div class="art">${cover(a, 600)}</div>
        <div class="meta">
          <div class="tname">${esc(a.display || a.name)}</div>
          <div class="talbum">${meta(a)}</div>
        </div>
      </div>`;
    };
    return `<section class="screen with-topbar">
      <div class="duel-wrap">
        <div class="phase-head">
          <span class="pill">${esc(names[state.ri])} · ${isFinal ? 'FINAL' : 'KNOCKOUT'}</span>
          <h2>${isFinal ? '冠军之战' : `第 <span class="en">${state.mi + 1}</span> 场`}</h2>
          <p class="count en">${state.mi + 1} / ${round.length}</p>
        </div>
        <div class="duel">
          ${dcard(m.a, 'a')}
          <div class="vs-badge"><b>VS</b></div>
          ${dcard(m.b, 'b')}
        </div>
        <p class="duel-hint">点击卡片选出胜者</p>
      </div>
    </section>`;
  }

  function onWin(side, el) {
    if (busy || !state || state.phase !== 'knockout') return;
    busy = true;
    const m = state.rounds[state.ri][state.mi];
    m.winner = side === 'a' ? m.a : m.b;
    AC.vibrate(12);
    el.classList.add('winner');
    const other = el.parentElement.querySelector(`.dcard[data-side="${side === 'a' ? 'b' : 'a'}"]`);
    other && other.classList.add('loser');
    const myEpoch = epoch;
    setTimeout(() => {
      if (myEpoch !== epoch) { busy = false; return; }
      busy = false;
      advance(m);
    }, 560);
  }

  function advance(m) {
    const rounds = state.rounds, r = state.ri, mi = state.mi;
    if (r + 1 < rounds.length) {
      const nm = rounds[r + 1][Math.floor(mi / 2)];
      if (mi % 2 === 0) nm.a = m.winner; else nm.b = m.winner;
    }
    if (mi + 1 < rounds[r].length) {
      state.mi++;
      save(); render();
    } else if (r + 1 < rounds.length) {
      state.ri++; state.mi = 0;
      save(); render();
      showIntro(...introFor(state.ri));
    } else {
      state.phase = 'done';
      save(); render();
    }
  }

  function showIntro(title, sub) {
    const host = $('#overlays');
    const el = document.createElement('div');
    el.className = 'round-intro';
    el.innerHTML = `<div class="ri-box">
      <span class="pill grad">决战动漫之巅</span>
      <div class="ri-title">${esc(title)}</div>
      ${sub ? `<p class="ri-sub">${esc(sub)}</p>` : ''}
    </div>`;
    host.appendChild(el);
    let closed = false;
    const close = () => { if (closed) return; closed = true; el.classList.add('out'); setTimeout(() => el.remove(), 320); };
    el.addEventListener('click', close);
    setTimeout(close, 1600);
  }

  /* ---------- 冠军 ---------- */
  function tplDone() {
    const final = state.rounds[state.rounds.length - 1][0];
    const champ = final.winner;
    const runner = final.a === champ ? final.b : final.a;
    const semis = state.rounds.length >= 2
      ? state.rounds[state.rounds.length - 2].map(m => (m.winner === m.a ? m.b : m.a))
      : [];
    const a = state.animes[champ];
    const pod = (rank, i, cls) => `<div class="pod ${cls}">
        ${state.animes[i].image ? `<img src="${esc(state.animes[i].image)}" alt="">` : `<div class="noart">${AC.icons.film}</div>`}
        <div class="pod-meta">
          <div class="pod-rank">${rank}</div>
          <div class="pod-name">${esc(state.animes[i].display || state.animes[i].name)}</div>
        </div>
      </div>`;
    return `<section class="screen with-topbar champ">
      <div style="flex:1;max-height:34px"></div>
      <div class="champ-crown">${AC.icons.trophy}</div>
      <div class="champ-label en">C H A M P I O N</div>
      <div class="champ-art-wrap">${cover(a, 600)}</div>
      <h1 class="champ-title">${esc(a.display || a.name)}</h1>
      <p class="champ-album">${meta(a)}</p>
      <div class="podium">
        ${pod('亚军 · RUNNER-UP', runner, 'silver')}
        ${semis.map(x => pod('四强 · SEMI', x, '')).join('')}
      </div>
      <div class="champ-actions">
        <button class="btn primary" data-act="share">${AC.icons.share}生成分享图</button>
        <button class="btn ghost" data-act="restart-yes">${AC.icons.restart}再来一场</button>
      </div>
    </section>`;
  }

  function celebrate() {
    if (state.celebrated) return;
    state.celebrated = true;
    save();
    const c = AC.theme.colors();
    setTimeout(() => AC.confetti([c.acc1, c.acc2, '#ffd166', '#ffffff']), 700);
  }

  /* ---------- 分享图 ---------- */
  async function openShare() {
    if ($('#shareModal')) return;
    const el = document.createElement('div');
    el.className = 'modal';
    el.id = 'shareModal';
    el.innerHTML = `
      <button class="modal-close" data-act="close-modal" aria-label="关闭">${AC.icons.close}</button>
      <div class="share-stage">
        <div class="share-loading">
          <div class="spinner"><span class="note">${AC.icons.film}</span></div>
          <span id="shareProg">正在准备…</span>
        </div>
      </div>
      <div class="share-actions"></div>`;
    $('#overlays').appendChild(el);
    const updateProg = (msg) => {
      const sp = document.getElementById('shareProg');
      if (sp) sp.textContent = msg;
    };
    try {
      const { blob } = await AC.share.build(state, updateProg);
      if (!el.isConnected) return;
      ui.shareBlob = blob;
      if (/MicroMessenger/i.test(navigator.userAgent)) {
        const dataUrl = await new Promise(res => {
          const fr = new FileReader();
          fr.onload = () => res(fr.result);
          fr.readAsDataURL(blob);
        });
        if (!el.isConnected) return;
        el.querySelector('.share-stage').innerHTML = `<img src="${dataUrl}" alt="晋级之路分享图">`;
        el.querySelector('.share-actions').outerHTML =
          `<p class="wx-hint">长按上方图片，保存到相册或发给朋友</p>`;
      } else {
        if (ui.shareUrl) URL.revokeObjectURL(ui.shareUrl);
        ui.shareUrl = URL.createObjectURL(blob);
        el.querySelector('.share-stage').innerHTML = `<img src="${ui.shareUrl}" alt="晋级之路分享图">`;
        el.querySelector('.share-actions').innerHTML =
          `<button class="btn primary sm" data-act="share-go">${AC.icons.share}分享</button>`;
        if (/Android/i.test(navigator.userAgent)) {
          el.querySelector('.share-actions').insertAdjacentHTML('afterend', '<p class="save-hint">长按保存图片</p>');
        }
      }
    } catch (e) {
      if (el.isConnected) el.querySelector('.share-stage').innerHTML =
        `<div class="share-loading">图片生成失败，请稍后再试</div>`;
    }
  }
  function champName() {
    const f = state.rounds[state.rounds.length - 1][0];
    return state.animes[f.winner].display || state.animes[f.winner].name;
  }
  function saveImage() {
    if (!ui.shareBlob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(ui.shareBlob);
    a.download = `AnimeCup-${champName()}.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  async function shareGo() {
    if (!ui.shareBlob) return;
    const file = new File([ui.shareBlob], `AnimeCup-${champName()}.jpg`, { type: 'image/jpeg' });
    let canSys = false;
    try { canSys = !!(navigator.canShare && navigator.canShare({ files: [file] })); } catch (e) {}
    if (!canSys) { saveImage(); return; }
    try {
      await navigator.share({
        files: [file],
        title: '决战动漫之巅',
        text: `我办了一场动漫世界杯，冠军是《${champName()}》！`,
      });
    } catch (e) { /* 用户取消 */ }
  }

  /* ---------- 重新开始 ---------- */
  function askRestart() {
    if ($('#confirmModal')) return;
    const el = document.createElement('div');
    el.className = 'modal';
    el.id = 'confirmModal';
    el.innerHTML = `
      <div class="confirm-box">
        <h4>重新开始？</h4>
        <p>当前赛事进度将被清空</p>
        <div class="row">
          <button class="btn ghost" data-act="close-modal">继续比赛</button>
          <button class="btn primary" data-act="restart-yes">重新开始</button>
        </div>
      </div>`;
    $('#overlays').appendChild(el);
  }
  function doRestart() {
    epoch++; busy = false;
    state = null; ui.view = null; ui.shareBlob = null; ui.sug = null;
    save();
    $('#overlays').innerHTML = '';
    render();
  }

  /* ============================================================
     事件
     ============================================================ */
  document.addEventListener('click', e => {
    if (ui.sug && !e.target.closest('#searchbox')) { ui.sug = null; renderSug(); }

    const t = e.target.closest('[data-act]');
    if (!t) return;
    const act = t.dataset.act;
    const i = t.dataset.i != null ? +t.dataset.i : null;
    switch (act) {
      case 'add-anime': addAnimeById(+t.dataset.idx); break;
      case 'remove-anime': removeAnime(i); break;
      case 'chip-add': {
        const name = t.dataset.name;
        const qEl = $('#q');
        if (qEl) { qEl.value = name; qEl.dispatchEvent(new Event('input')); }
        break;
      }
      case 'chip-search': {
        const name = t.dataset.name;
        const qEl = $('#q');
        if (qEl) { qEl.value = name; qEl.dispatchEvent(new Event('input')); }
        break;
      }
      case 'start-game': startGame(); break;
      case 'start-group': state.phase = 'group'; save(); render(); break;
      case 'toggle-pick': togglePick(i); break;
      case 'confirm-group': confirmGroup(); break;
      case 'toggle-wild': toggleWild(i); break;
      case 'confirm-wild': confirmWild(); break;
      case 'win': onWin(t.dataset.side, t); break;
      case 'undo': undo(); break;
      case 'share': openShare(); break;
      case 'close-modal': { const m = e.target.closest('.modal'); m && m.remove(); break; }
      case 'share-go': shareGo(); break;
      case 'restart-ask': askRestart(); break;
      case 'restart-yes': doRestart(); break;
    }
  });

  document.addEventListener('keydown', e => {
    if (e.repeat) return;
    const el = e.target;
    if ((e.key === 'Enter' || e.key === ' ') && el instanceof HTMLElement &&
        el.dataset && el.dataset.act && el.tagName !== 'INPUT' && el.tagName !== 'BUTTON') {
      e.preventDefault(); el.click(); return;
    }
    if (!state || el.tagName === 'INPUT') return;
    if (state.phase === 'knockout') {
      const side = (e.key === '1' || e.key === 'ArrowLeft') ? 'a'
        : (e.key === '2' || e.key === 'ArrowRight') ? 'b' : null;
      if (side) { const card = document.querySelector(`.dcard[data-side="${side}"]`); card && onWin(side, card); }
    } else if (state.phase === 'group' && ['1', '2', '3', '4'].includes(e.key)) {
      const idx = state.groups[state.gi][+e.key - 1];
      if (idx != null) togglePick(idx);
    }
  });

  /* ---------- 启动 ---------- */
  const saved = loadSave();
  if (saved) {
    state = saved;
    setTimeout(() => AC.toast('已恢复上次进度，右上角可重新开始'), 600);
    /* 旧数据可能缺少封面图，后台补拉 */
    if (state.animes && state.animes.some(a => !a.image)) {
      (async () => {
        let fetched = 0;
        for (const a of state.animes) {
          if (a.image) continue;
          try {
            const detail = await AC.api.getSubjectDetail(a.id);
            if (detail.image) { a.image = detail.image; a.image_large = detail.image_large; a.image_small = detail.image_small; }
            fetched++;
          } catch (e) { /* skip */ }
        }
        if (fetched > 0) { save(); AC.toast(`已补充 ${fetched} 部动漫封面`); }
      })();
    }
  }
  render();
})();
