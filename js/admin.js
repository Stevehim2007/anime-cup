/* 决战动漫之巅 · 后台管理 */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://jnhetrqhizfuxwfnjcoh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpuaGV0cnFoaXpmdXh3Zm5qY29oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ3ODIwMDIsImV4cCI6MjEwMDM1ODAwMn0.Bj4g5R4MOCdvW8gZTHRehqLzaCE5Q8huCtHO7_WWmR0';

const ADMIN_EMAILS = ['2933886037@qq.com'];

const SB = createClient(SUPABASE_URL, SUPABASE_KEY);
const AC = window.AC;
const esc = AC.esc;

let user = null;
let animes = [];
let searchResults = [];

const $ = s => document.querySelector(s);

/* ====== Auth ====== */
async function doLogin(email, password) {
  const { data, error } = await SB.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

async function doLogout() {
  await SB.auth.signOut();
  user = null;
  render();
}

/* ====== Data ====== */
async function loadAnimes() {
  const { data } = await SB.from('animes').select('*').order('seed');
  animes = data || [];
}

async function addAnime(a) {
  const nextSeed = animes.length + 1;
  if (nextSeed > 32) { AC.toast('最多 32 部动漫'); return; }
  /* 先拉取详情获取封面图 */
  let imgUrl = '';
  try {
    const detail = await AC.api.getSubjectDetail(a.id);
    imgUrl = detail.image || detail.image_large || '';
  } catch (e) { /* 用搜索结果的封面 */ }
  const { error } = await SB.from('animes').insert({
    name: a.name || '',
    name_cn: a.name_cn || a.name || '',
    image_url: imgUrl || a.image || a.image_large || '',
    seed: nextSeed,
  });
  if (error) { AC.toast('添加失败: ' + error.message); return; }
  AC.toast(`已添加「${a.name_cn || a.name || ''}」`);
  await loadAnimes();
  render();
}

async function removeAnime(id) {
  const { error } = await SB.from('animes').delete().eq('id', id);
  if (error) { AC.toast('删除失败: ' + error.message); return; }
  AC.toast('已删除');
  /* 重新编号 */
  const { data } = await SB.from('animes').select('*').order('seed');
  for (let i = 0; i < (data || []).length; i++) {
    if (data[i].seed !== i + 1) {
      await SB.from('animes').update({ seed: i + 1 }).eq('id', data[i].id);
    }
  }
  await loadAnimes();
  render();
}

async function moveUp(id) {
  const idx = animes.findIndex(a => a.id === id);
  if (idx <= 0) return;
  const a = animes[idx], b = animes[idx - 1];
  await SB.from('animes').update({ seed: a.seed }).eq('id', b.id);
  await SB.from('animes').update({ seed: b.seed }).eq('id', a.id);
  await loadAnimes();
  render();
}

async function moveDown(id) {
  const idx = animes.findIndex(a => a.id === id);
  if (idx < 0 || idx >= animes.length - 1) return;
  const a = animes[idx], b = animes[idx + 1];
  await SB.from('animes').update({ seed: a.seed }).eq('id', b.id);
  await SB.from('animes').update({ seed: b.seed }).eq('id', a.id);
  await loadAnimes();
  render();
}

let adminSearchTimer;
async function doSearch(term) {
  clearTimeout(adminSearchTimer);
  adminSearchTimer = setTimeout(async () => {
    try {
      searchResults = await AC.api.searchAnime(term, 10);
    } catch (e) { searchResults = []; }
    renderSug();
  }, 350);
}

function renderSug() {
  const el = $('#sug');
  if (!el) return;
  const addedIds = new Set(animes.map(a => a.id));
  if (!searchResults.length) { el.innerHTML = ''; return; }
  el.innerHTML = searchResults.map(a => {
    const added = addedIds.has(a.id);
    return `<button class="sug-item" data-act="add-anime" data-id="${a.id}"${added ? ' disabled' : ''}>
      <span class="sug-meta">
        <span class="sug-name">${esc(a.name_cn || a.name)}</span>
        <span class="sug-genre">${esc(a.meta || '')}${added ? ' · 已添加' : ''}</span>
      </span>
      ${added ? '<span class="sug-added">✓</span>' : ''}
    </button>`;
  }).join('');
}

/* ====== Render ====== */
function render() {
  const app = $('#app');
  if (!app) return;

  if (!user) {
    app.innerHTML = `<section class="screen login-screen">
      <div class="hero">
        <h1 style="font-size:28px;font-weight:900;text-align:center">后台管理</h1>
        <p class="tagline">仅限管理员登录</p>
      </div>
      <div class="auth-box">
        <div class="auth-fields">
          <input id="authEmail" type="email" placeholder="管理员邮箱">
          <input id="authPass" type="password" placeholder="密码">
          <button class="btn primary" id="loginBtn">管理员登录</button>
        </div>
        <p class="auth-error" id="authError" hidden></p>
      </div>
    </section>`;
    document.getElementById('loginBtn').onclick = async () => {
      const email = (document.getElementById('authEmail')?.value || '').trim();
      const pass = document.getElementById('authPass')?.value;
      const errEl = document.getElementById('authError');
      if (!email || !pass) { if (errEl) { errEl.hidden = false; errEl.textContent = '请填写邮箱和密码'; } return; }
      try {
        user = await doLogin(email, pass);
        if (!ADMIN_EMAILS.includes(user.email)) {
          await SB.auth.signOut(); user = null;
          if (errEl) { errEl.hidden = false; errEl.textContent = '你不是管理员'; }
          return;
        }
        await loadAnimes();
/* 恢复登录态——先检查再渲染 */
(async () => {
  const { data: { session } } = await SB.auth.getSession();
  if (session?.user && ADMIN_EMAILS.includes(session.user.email)) {
    user = session.user;
    await loadAnimes();
  }
  render();
})();
      } catch (e) {
        if (errEl) { errEl.hidden = false; errEl.textContent = e.message; }
      }
    };
    return;
  }

  app.innerHTML = `<section class="screen admin-screen">
    <div class="admin-head">
      <div>
        <h2>动漫管理</h2>
        <span class="admin-user">${esc(user.email)} · <button class="link-btn" id="logoutBtn">退出</button> · <button class="link-btn" id="statsBtn">数据统计</button></span>
      </div>
      <span class="admin-count">${animes.length} / 32</span>
    </div>
    <div class="searchbox" id="searchbox" style="margin:12px 0">
      <div class="search-field">
        <input id="q" type="search" placeholder="搜索动漫添加到32强...">
      </div>
      <div class="sug" id="sug"></div>
    </div>
    <div class="anime-list">
      ${animes.length === 0 ? '<p class="roster-empty">还没有动漫，搜索并添加</p>' : ''}
      ${animes.map(a => `
        <div class="roster-card">
          <div class="rart">${a.image_url ? `<img src="${esc(a.image_url)}" alt="">` : '<div class="noart">🎬</div>'}</div>
          <div class="rmeta">
            <div class="rname">#${a.seed} ${esc(a.name_cn || a.name)}</div>
            <div class="rinfo">${esc(a.name || '')}</div>
          </div>
          <button class="rremove" data-act="move-up" data-id="${a.id}" title="上移">↑</button>
          <button class="rremove" data-act="move-down" data-id="${a.id}" title="下移">↓</button>
          <button class="rremove" data-act="remove-anime" data-id="${a.id}" title="删除" style="color:#ff5555">✕</button>
        </div>`).join('')}
    </div>
  </section>`;

  document.getElementById('logoutBtn').onclick = doLogout;
  document.getElementById('statsBtn').onclick = showStats;
  const qEl = document.getElementById('q');
  if (qEl) {
    qEl.oninput = () => {
      const term = qEl.value.trim();
      if (term.length < 2) { searchResults = []; renderSug(); return; }
      doSearch(term);
    };
  }
}

/* ====== 全局事件（只绑定一次） ====== */
document.addEventListener('click', e => {
  const t = e.target.closest('[data-act]');
  if (!t) {
    /* 点击搜索框外关闭建议 */
    if (!e.target.closest('#searchbox')) { searchResults = []; renderSug(); }
    return;
  }
  const act = t.dataset.act;
  const id = t.dataset.id ? +t.dataset.id : null;

  switch (act) {
    case 'add-anime': {
      const a = searchResults.find(x => x.id === id);
      if (a) addAnime(a);
      break;
    }
    case 'remove-anime': removeAnime(id); break;
    case 'move-up': moveUp(id); break;
    case 'move-down': moveDown(id); break;
  }
});

/* ====== 统计弹窗 ====== */
async function showStats() {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.id = 'statsModal';
  modal.innerHTML = `<div class="modal-close" id="closeStats"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="19" height="19"><path d="M6 6l12 12M18 6 6 18"/></svg></div>
    <div style="background:var(--panel);border:1px solid var(--line);border-radius:var(--r-lg);padding:24px;max-width:500px;width:90vw;max-height:80vh;overflow-y:auto">
      <h3 style="margin-bottom:8px">数据统计</h3>
      <p style="color:var(--dim);margin-bottom:16px" id="statsLoading">加载中...</p>
      <div id="statsContent"></div>
    </div>`;
  document.body.appendChild(modal);

  try {
    const { data: votes } = await SB.from('votes').select('*');
    const voterSet = new Set();
    (votes || []).forEach(v => voterSet.add(v.user_id));

    const scores = {};
    animes.forEach(a => { scores[a.id] = 0; });
    const byUser = {};
    (votes || []).forEach(v => {
      if (!byUser[v.user_id]) byUser[v.user_id] = [];
      byUser[v.user_id].push(v);
    });
    Object.values(byUser).forEach(userVotes => {
      userVotes.filter(v => v.round === 5).forEach(v => {
        scores[v.winner_id] = (scores[v.winner_id] || 0) + 4;
        scores[v.anime_a_id === v.winner_id ? v.anime_b_id : v.anime_a_id] = (scores[v.anime_a_id === v.winner_id ? v.anime_b_id : v.anime_a_id] || 0) + 3;
      });
      userVotes.filter(v => v.round === 4).forEach(v => {
        scores[v.anime_a_id === v.winner_id ? v.anime_b_id : v.anime_a_id] = (scores[v.anime_a_id === v.winner_id ? v.anime_b_id : v.anime_a_id] || 0) + 2;
      });
      userVotes.filter(v => v.round === 3).forEach(v => {
        scores[v.anime_a_id === v.winner_id ? v.anime_b_id : v.anime_a_id] = (scores[v.anime_a_id === v.winner_id ? v.anime_b_id : v.anime_a_id] || 0) + 1;
      });
    });

    const rankings = Object.entries(scores).map(([id, pts]) => ({ id: +id, pts })).sort((a, b) => b.pts - a.pts);
    document.getElementById('statsLoading').textContent = `共 ${voterSet.size} 人参与投票`;

    const medals = ['🥇', '🥈', '🥉'];
    let html = '<div class="rank-list">';
    rankings.forEach((r, i) => {
      if (r.pts === 0) return;
      const a = animes.find(x => x.id === r.id);
      html += `<div class="rank-item"><span class="rank-no">${i < 3 ? medals[i] : `#${i + 1}`}</span>
        ${a?.image_url ? `<img src="${esc(a.image_url)}" class="rank-img" alt="">` : '<div class="noart rank-img">🎬</div>'}
        <span class="rank-name">${esc(a ? (a.name_cn || a.name) : '?')}</span>
        <span class="rank-pts">${r.pts} 分</span></div>`;
    });
    if (rankings.every(r => r.pts === 0)) html += '<p>暂无投票数据</p>';
    html += '</div>';
    document.getElementById('statsContent').innerHTML = html;
  } catch (e) {
    document.getElementById('statsContent').innerHTML = `<p>加载失败: ${e.message}</p>`;
  }

  document.getElementById('closeStats').onclick = () => modal.remove();
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

render();
