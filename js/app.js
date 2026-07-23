/* 决战动漫之巅 · 主应用（投票系统 — 用户自分组） */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://jnhetrqhizfuxwfnjcoh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpuaGV0cnFoaXpmdXh3Zm5qY29oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ3ODIwMDIsImV4cCI6MjEwMDM1ODAwMn0.Bj4g5R4MOCdvW8gZTHRehqLzaCE5Q8huCtHO7_WWmR0';

const SB = createClient(SUPABASE_URL, SUPABASE_KEY);
const AC = window.AC, esc = AC.esc;

let user = null, animes = [], bracket = null, picks = [], hasVoted = false;
let view = 'login', matchIdx = 0, authMode = 'login';
let pairingSel = null;                                     // 当前高亮的动漫 id
let pairingPairs = [];                                     // [[id1, id2], ...]
const $ = s => document.querySelector(s);

/* ====== Auth ====== */
function validEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
async function doLogin(email, pw) { const { data, e } = await SB.auth.signInWithPassword({ email, password: pw }); if (e) throw e; return data.user; }
async function doRegister(email, pw) { const { data, e } = await SB.auth.signUp({ email, password: pw }); if (e) throw e; return data.session ? data.user : null; }
async function doLogout() { await SB.auth.signOut(); user = null; view = 'login'; resetAll(); render(); }
function resetAll() { animes = []; bracket = null; picks = []; hasVoted = false; pairingSel = null; pairingPairs = []; matchIdx = 0; }

async function loadAnimes() {
  const { data, error } = await SB.from('animes').select('*').order('seed');
  if (error) throw error;
  if (!data || data.length < 32) throw new Error('need_32');
  animes = data;
}

function buildBracketFromPairs() {
  if (pairingPairs.length !== 16) { AC.toast(`需要 16 组对阵，当前只有 ${pairingPairs.length} 组`); return; }
  const round0 = [];
  for (const [a, b] of pairingPairs) round0.push({ a, b, winner: null });
  const rounds = [round0];
  let size = round0.length;
  while (size >= 2) {
    rounds.push(Array.from({ length: size / 2 }, () => ({ a: null, b: null, winner: null })));
    size /= 2;
  }
  bracket = { rounds };
  picks = rounds.map(r => new Array(r.length).fill(null));
}

async function loadMyVotes() {
  if (!user) return;
  const { data } = await SB.from('votes').select('*').eq('user_id', user.id);
  if (!data || data.length === 0) return;
  /* 从第一轮投票重建配对 */
  const r0 = data.filter(v => v.round === 1);
  pairingPairs = r0.map(v => [v.anime_a_id, v.anime_b_id]);
  buildBracketFromPairs();
  data.forEach(v => {
    const ri = v.round - 1;
    const mi = bracket.rounds[ri].findIndex(m => m.a === v.anime_a_id && m.b === v.anime_b_id);
    if (mi >= 0) picks[ri][mi] = v.winner_id;
  });
  for (let r = 0; r < picks.length - 1; r++) {
    if (picks[r].every(p => p !== null)) {
      const nr = bracket.rounds[r + 1];
      for (let mi = 0; mi < nr.length; mi++) { nr[mi].a = picks[r][mi * 2]; nr[mi].b = picks[r][mi * 2 + 1]; }
    }
  }
  hasVoted = true;
}

async function submitVotes() {
  if (!user) return;
  const rows = [];
  bracket.rounds.forEach((round, ri) => {
    round.forEach((m, mi) => {
      if (picks[ri][mi]) rows.push({ user_id: user.id, round: ri + 1, anime_a_id: m.a, anime_b_id: m.b, winner_id: picks[ri][mi] });
    });
  });
  /* 先删旧记录，再插入新的（避免重新分组后旧数据残留） */
  await SB.from('votes').delete().eq('user_id', user.id);
  if (rows.length) await SB.from('votes').insert(rows);
  hasVoted = true;
}

async function loadResults() {
  const { data } = await SB.from('votes').select('*');
  const scores = {}; animes.forEach(a => scores[a.id] = 0);
  const byUser = {};
  (data || []).forEach(v => { if (!byUser[v.user_id]) byUser[v.user_id] = []; byUser[v.user_id].push(v); });
  Object.values(byUser).forEach(vs => {
    vs.filter(v => v.round === 5).forEach(v => { scores[v.winner_id] += 4; scores[v.anime_a_id === v.winner_id ? v.anime_b_id : v.anime_a_id] += 3; });
    vs.filter(v => v.round === 4).forEach(v => { scores[v.anime_a_id === v.winner_id ? v.anime_b_id : v.anime_a_id] += 2; });
    vs.filter(v => v.round === 3).forEach(v => { scores[v.anime_a_id === v.winner_id ? v.anime_b_id : v.anime_a_id] += 1; });
  });
  return Object.entries(scores).map(([id, pts]) => ({ id: +id, pts })).sort((a, b) => b.pts - a.pts);
}

/* ====== Render ====== */
function render() {
  const app = $('#app'); if (!app) return;
  switch (view) {
    case 'login': app.innerHTML = tplLogin(); break;
    case 'pairing': app.innerHTML = tplPairing(); break;
    case 'voting': app.innerHTML = tplVoting(); setTimeout(() => { if (bracket) syncPicks(); }, 0); break;
    case 'done': app.innerHTML = tplDone(); break;
    case 'results': tplResults().then(html => { app.innerHTML = html; }); break;
  }
}

function tplLogin() {
  return `<section class="screen login-screen">
    <div class="hero"><h1 class="logo-lockup"><span class="logo-badge">🏆</span><span class="logo-anime"><i>动</i><i>漫</i><i>之</i><i>巅</i></span><span class="logo-cup">CUP</span></h1><p class="slogan">决战动漫之巅</p><p class="tagline">32部动漫 · 自定义对阵 · 选出你的本命</p></div>
    <div class="auth-box"><div class="auth-tabs"><button class="auth-tab active" data-act="auth-tab" data-tab="login">登录</button><button class="auth-tab" data-act="auth-tab" data-tab="register">注册</button></div><div id="authForm">${tplAuthForm('login')}</div><p class="auth-error" id="authError" hidden></p></div>
    <div class="home-foot"><button class="btn ghost sm" data-act="show-results">查看实时排名</button></div></section>`;
}

function tplAuthForm(mode) {
  return `<div class="auth-fields"><input id="authEmail" type="email" placeholder="邮箱地址" autocomplete="email"><input id="authPass" type="password" placeholder="密码（至少6位）" autocomplete="${mode==='login'?'current-password':'new-password'}"><button class="btn primary" data-act="${mode==='login'?'login':'register'}">${mode==='login'?'登录':'注册'}</button></div>`;
}

/* ====== 配对阶段 ====== */
function tplPairing() {
  const pairedIds = new Set(pairingPairs.flat());
  const remaining = animes.filter(a => !pairedIds.has(a.id));
  return `<section class="screen pairing-screen"><div class="vote-head"><button class="btn ghost sm" data-act="logout">退出</button><span class="vote-user">${esc(user.email)} · 点击两部动漫配对</span></div>
    <p class="pair-hint">依次点击两部动漫组成一组对阵（共需 16 组）</p>
    <div class="pair-grid">${remaining.map(a => `<div class="pair-card" data-act="sel-pair" data-id="${a.id}"><div class="rart">${a.image_url?`<img src="${esc(a.image_url)}">`:'<div class="noart">🎬</div>'}</div><span>${esc(a.name_cn||a.name)}</span></div>`).join('')}</div>
    <div class="pair-done-wrap" style="display:${pairingPairs.length>0?'block':'none'}">
      <div class="pair-done-title">已配对 ${pairingPairs.length}/16 组</div>
      <div class="pair-done-list">${pairingPairs.map(([a,b],i)=>{const A=animes.find(x=>x.id===a),B=animes.find(x=>x.id===b);return`<div class="pair-done-item" data-act="undo-pair" data-i="${i}"><span>${esc(A?A.name_cn||A.name:'?')}</span><b>VS</b><span>${esc(B?B.name_cn||B.name:'?')}</span></div>`;}).join('')}</div>
    </div>
    <div class="cta-bar pair-cta" style="display:${pairingPairs.length===16?'flex':'none'}"><button class="btn primary" data-act="start-vote">开始投票 🎉</button></div></section>`;
}

function doSelectPairing(id) {
  /* 纯 DOM 操作，不刷新页面 */
  if (!pairingSel) {
    /* 选中第一部 */
    pairingSel = id;
    document.querySelectorAll('.pair-card').forEach(c => c.classList.toggle('sel', +c.dataset.id === id));
    return;
  }
  if (pairingSel === id) {
    /* 取消选中 */
    pairingSel = null;
    document.querySelectorAll('.pair-card').forEach(c => c.classList.remove('sel'));
    return;
  }
  /* 配成一对 */
  pairingPairs.push([pairingSel, id]);
  const pairedIds = new Set(pairingPairs.flat());
  /* 从网格中移除这两张卡片 */
  document.querySelectorAll('.pair-card').forEach(c => {
    if (+c.dataset.id === pairingSel || +c.dataset.id === id) c.remove();
  });
  pairingSel = null;
  /* 更新已配对列表 */
  updateDoneList();
  /* 更新计数和按钮 */
  const title = document.querySelector('.pair-done-title');
  const doneWrap = document.querySelector('.pair-done-wrap');
  if (doneWrap) doneWrap.style.display = 'block';
  if (title) title.textContent = `已配对 ${pairingPairs.length}/16 组`;
  if (pairingPairs.length === 16) {
    const cta = document.querySelector('.pair-cta');
    if (cta) cta.style.display = 'flex';
  }
}

function undoPair(i) {
  const [a, b] = pairingPairs[i];
  pairingPairs.splice(i, 1);
  /* 把这两张卡片加回网格 */
  const grid = document.querySelector('.pair-grid');
  if (grid) {
    [a, b].forEach(id => {
      const anime = animes.find(x => x.id === id);
      if (!anime) return;
      const div = document.createElement('div');
      div.className = 'pair-card';
      div.dataset.act = 'sel-pair';
      div.dataset.id = id;
      div.innerHTML = `<div class="rart">${anime.image_url?`<img src="${esc(anime.image_url)}">`:'<div class="noart">🎬</div>'}</div><span>${esc(anime.name_cn||anime.name)}</span>`;
      grid.appendChild(div);
    });
  }
  updateDoneList();
  const title = document.querySelector('.pair-done-title');
  if (title) title.textContent = `已配对 ${pairingPairs.length}/16 组`;
  if (pairingPairs.length < 16) {
    const cta = document.querySelector('.pair-cta');
    if (cta) cta.style.display = 'none';
  }
  if (pairingPairs.length === 0) {
    const doneWrap = document.querySelector('.pair-done-wrap');
    if (doneWrap) doneWrap.style.display = 'none';
  }
}

function updateDoneList() {
  const list = document.querySelector('.pair-done-list');
  if (!list) return;
  list.innerHTML = pairingPairs.map(([a,b],i)=>{
    const A=animes.find(x=>x.id===a),B=animes.find(x=>x.id===b);
    return`<div class="pair-done-item" data-act="undo-pair" data-i="${i}"><span>${esc(A?A.name_cn||A.name:'?')}</span><b>VS</b><span>${esc(B?B.name_cn||B.name:'?')}</span></div>`;
  }).join('');
}

/* ====== 投票阶段 ====== */
function tplVoting() {
  if (!bracket?.rounds) return '<p>加载中...</p>';
  let cr = 0;
  for (let r = 0; r < bracket.rounds.length; r++) { if (!picks[r].every(p => p !== null)) { cr = r; break; } if (r === bracket.rounds.length - 1) cr = r; }
  const rd = bracket.rounds[cr];
  const names = ['32强','16强','8强','半决赛','决赛'];
  return `<section class="screen voting-screen"><div class="vote-head"><button class="btn ghost sm" data-act="logout">退出</button><span class="vote-user">${esc(user.email)}${hasVoted?' · 已投过票，修改后覆盖':''}</span><div class="vote-rounds">${bracket.rounds.map((_,i)=>`<span class="vr-dot${picks[i].every(p=>p!==null)?' done':i===cr?' active':''}">${names[i]}</span>`).join('')}</div></div>
    <div class="duel-wrap"><div class="phase-head"><span class="pill grad">${names[cr]} · ${cr===4?'FINAL':'KNOCKOUT'}</span><h2>${cr===4?'冠军之战':''}</h2><p class="sub">点击支持的那一部</p></div>
    <div class="match-nav"><button class="mn-btn" id="prevMatch" data-act="prev-match" disabled>←</button><span class="mn-info" id="matchInfo">1/${rd.length}</span><button class="mn-btn" id="nextMatch" data-act="next-match">→</button></div>
    <div class="duel" id="duelContainer"></div>
    <div class="cta-bar pair-cta" style="position:static;background:none;padding-top:20px;display:${picks[cr].every(p=>p!==null)?'flex':'none'}"><button class="btn primary" data-act="${cr<4?'next-round':'submit-all'}">${cr<4?'提交本轮→'+names[cr+1]:hasVoted?'重新提交全部投票 🔄':'提交全部投票 🎉'}</button></div></div></section>`;
}

function syncPicks() {
  if (!bracket?.rounds?.length) return;
  const cr = getCurrentRound();
  if (!bracket.rounds[cr]?.length) return;
  if (matchIdx >= bracket.rounds[cr].length) matchIdx = 0;
  renderMatch(cr, matchIdx);
}
function getCurrentRound() { for (let r = 0; r < bracket.rounds.length; r++) if (!picks[r].every(p => p !== null)) return r; return bracket.rounds.length - 1; }

function renderMatch(r, mi) {
  const m = bracket.rounds[r][mi], container = $('#duelContainer');
  if (!container) return;
  const card = (id, side) => { const an = animes.find(x => x.id === id); const won = picks[r][mi] === id;
    return `<div class="dcard${won?' winner':''}" data-act="pick" data-side="${side}" data-r="${r}" data-mi="${mi}" data-id="${id}"><div class="art">${an?.image_url?`<img src="${esc(an.image_url)}">`:`<div class="noart">${AC.icons.film}</div>`}</div><div class="meta"><div class="tname">${esc((an?.name_cn||an?.name)||'—')}</div></div></div>`; };
  container.innerHTML = `${card(m.a,'a')}<div class="vs-badge"><b>VS</b></div>${card(m.b,'b')}`;
  updateNav(r);
  document.getElementById('matchInfo').textContent = `${mi+1}/${bracket.rounds[r].length}`;
}
function updateNav(r) { const p=$('#prevMatch'),n=$('#nextMatch'); if(p)p.disabled=matchIdx===0; if(n)n.disabled=matchIdx>=bracket.rounds[r].length-1; }
function doPick(id, r, mi) {
  picks[r][mi] = id;
  /* 只更新卡片样式，不刷新页面 */
  const duel = $('#duelContainer');
  if (duel) {
    duel.querySelectorAll('.dcard').forEach(c => {
      c.classList.toggle('winner', +c.dataset.id === id);
      c.classList.toggle('loser', +c.dataset.id !== id);
    });
  }
  /* 检查本轮是否全部完成，显示/隐藏提交按钮 */
  const allDone = picks[r].every(p => p !== null);
  const cta = document.querySelector('.pair-cta');
  if (cta) cta.style.display = allDone ? 'flex' : 'none';
  if (cta && allDone) {
    const btn = cta.querySelector('button');
    const names = ['32强','16强','8强','半决赛','决赛'];
    const isLast = r >= bracket.rounds.length - 1;
    btn.dataset.act = isLast ? 'submit-all' : 'next-round';
    btn.textContent = isLast ? (hasVoted ? '重新提交全部投票 🔄' : '提交全部投票 🎉') : `提交本轮 → ${names[r+1]}`;
  }
  /* 更新轮次状态点 */
  document.querySelectorAll('.vr-dot').forEach((d, i) => {
    d.classList.toggle('done', picks[i]?.every(p => p !== null));
    d.classList.toggle('active', i === r && !allDone);
  });
}

function doNextRound() {
  const cr = getCurrentRound();
  if (cr > 0) {
    const nr = bracket.rounds[cr];
    const prev = picks[cr - 1];
    for (let mi = 0; mi < nr.length; mi++) {
      nr[mi].a = prev[mi * 2];
      nr[mi].b = prev[mi * 2 + 1];
    }
  }
  matchIdx = 0; render();
}
function goMatch(dir) { const cr = getCurrentRound(); matchIdx = Math.max(0, Math.min(bracket.rounds[cr].length - 1, matchIdx + dir)); renderMatch(cr, matchIdx); }
async function doSubmitAll() { try { AC.toast('提交中...'); await submitVotes(); view = 'done'; render(); AC.toast(hasVoted ? '投票已更新！' : '投票成功！'); } catch (e) { AC.toast('失败: ' + e.message); } }

function tplDone() {
  return `<section class="screen done-screen"><div class="hero" style="margin-top:20vh"><div class="champ-crown">${AC.icons.trophy}</div><h1 style="font-size:32px;font-weight:900;margin:16px 0">投票成功！</h1><p class="tagline">你的选择已记录</p></div><div style="display:flex;flex-direction:column;gap:12px;margin-top:40px;align-items:center"><button class="btn primary" data-act="go-vote">修改投票</button><button class="btn primary" data-act="show-results">查看实时排名</button><button class="btn ghost" data-act="logout">退出</button></div></section>`;
}

async function tplResults() {
  let h = `<section class="screen results-screen"><div class="phase-head"><span class="pill grad">实时排名</span><h2>动漫积分榜</h2><p class="sub">冠军+4/亚军+3/四强+2/八强+1</p></div>`;
  try {
    const rankings = await loadResults();
    const { data: votes } = await SB.from('votes').select('user_id');
    const voterSet = new Set(); (votes || []).forEach(v => voterSet.add(v.user_id));
    h += `<p class="result-count">已有 <b>${voterSet.size}</b> 人参与</p><div class="rank-list">`;
    const medals = ['🥇','🥈','🥉'];
    rankings.forEach((r, i) => {
      if (!r.pts) return; const a = animes.find(x => x.id === r.id);
      h += `<div class="rank-item" style="animation-delay:${Math.min(i*40,600)}ms"><span class="rank-no">${i<3?medals[i]:`#${i+1}`}</span>${a?.image_url?`<img src="${esc(a.image_url)}" class="rank-img">`:'<div class="noart rank-img">🎬</div>'}<span class="rank-name">${esc((a?.name_cn||a?.name)||'?')}</span><span class="rank-pts">${r.pts}分</span><span class="rank-bar" style="width:${Math.max(4,r.pts/Math.max(1,rankings[0].pts)*100)}%"></span></div>`;
    });
    if (rankings.every(r => r.pts === 0)) h += '<p class="roster-empty">暂无投票数据</p>';
    h += '</div>';
  } catch (e) { h += `<p class="roster-empty">${e.message}</p>`; }
  h += `<div style="display:flex;gap:12px;justify-content:center;margin-top:24px">${user?'<button class="btn primary" data-act="go-vote">去投票</button>':''}<button class="btn ghost" data-act="go-login">${user?'退出':'返回'}</button></div></section>`;
  return h;
}

/* ====== Events ====== */
document.addEventListener('click', e => {
  const t = e.target.closest('[data-act]'); if (!t) return;
  const act = t.dataset.act;
  switch (act) {
    case 'auth-tab': authMode = t.dataset.tab; document.querySelectorAll('.auth-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === authMode)); $('#authForm') && ($('#authForm').innerHTML = tplAuthForm(authMode)); break;
    case 'login': case 'register': {
      const email = (document.getElementById('authEmail')?.value||'').trim(), pw = document.getElementById('authPass')?.value||'', err = document.getElementById('authError');
      if (!validEmail(email)) { if(err){err.hidden=false;err.textContent='请输入正确的邮箱地址';} return; }
      if (pw.length < 6) { if(err){err.hidden=false;err.textContent='密码至少6位';} return; }
      if(err)err.hidden=true;
      (async () => { try {
        if (act === 'login') { user = await doLogin(email, pw); }
        else { const u = await doRegister(email, pw); if (u) { user = u; AC.toast('注册成功！'); } else { AC.toast('注册成功！请登录'); authMode='login'; render(); return; } }
        await loadAnimes();
        if (!hasVoted) { view = 'pairing'; } else { await loadMyVotes(); view = 'voting'; }
        render();
      } catch (e) { if (e.message === 'need_32') AC.toast('后台还未设置32强动漫'); else if (err) { err.hidden = false; err.textContent = e.message; } } })();
      break;
    }
    case 'sel-pair': doSelectPairing(+t.dataset.id); break;
    case 'undo-pair': undoPair(+t.dataset.i); break;
    case 'start-vote': buildBracketFromPairs(); if (!bracket) return; view = 'voting'; matchIdx = 0; render(); break;
    case 'pick': doPick(+t.dataset.id, +t.dataset.r, +t.dataset.mi); break;
    case 'prev-match': goMatch(-1); break;
    case 'next-match': goMatch(1); break;
    case 'next-round': doNextRound(); break;
    case 'submit-all': doSubmitAll(); break;
    case 'logout': doLogout(); break;
    case 'show-results': view = 'results'; render(); break;
    case 'go-vote': view = hasVoted ? 'voting' : 'pairing'; matchIdx = 0; render(); break;
    case 'go-login': doLogout(); break;
  }
});

/* ====== Init ====== */
(async () => {
  const { data: { session } } = await SB.auth.getSession();
  if (session) {
    user = session.user;
    try {
      await loadAnimes();
      await loadMyVotes();
      view = hasVoted ? 'voting' : 'pairing';
    } catch (e) { view = 'login'; if (e.message === 'need_32') AC.toast('后台还未设置32强动漫'); }
  }
  render();
})();
