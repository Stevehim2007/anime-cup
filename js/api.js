/* 决战动漫之巅 · Bangumi API 数据层 */
window.AC = window.AC || {};

AC.api = (() => {
  const BASE = 'https://api.bgm.tv';
  const UA = 'AnimeCup/1.0 (https://github.com/anime-cup)';

  async function get(url, opts = {}) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    try {
      const r = await fetch(url, {
        signal: ctrl.signal,
        headers: { 'User-Agent': UA, ...opts.headers },
        method: opts.method || 'GET',
        body: opts.body ? JSON.stringify(opts.body) : undefined,
      });
      clearTimeout(timer);
      if (!r.ok) throw new Error('http ' + r.status);
      return await r.json();
    } catch (e) {
      clearTimeout(timer);
      throw e;
    }
  }

  async function post(url, body) {
    return get(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
  }

  const searchCache = new Map();

  function displayName(item) {
    return item.name_cn || item.name || '';
  }

  function seasonInfo(item) {
    const parts = [];
    if (item.date) parts.push(item.date.slice(0, 4));
    if (item.platform) parts.push(item.platform);
    return parts.join(' · ');
  }

  function imgUrl(images, key) {
    try { return (images && images[key]) || ''; } catch (e) { return ''; }
  }

  function parseSubject(item) {
    const imgs = item.images || {};
    return {
      id: item.id,
      name: item.name || '',
      name_cn: item.name_cn || '',
      display: displayName(item),
      summary: (item.summary || '').replace(/\n/g, ' ').slice(0, 120),
      image: imgUrl(imgs, 'common') || imgUrl(imgs, 'medium') || imgUrl(imgs, 'large') || '',
      image_large: imgUrl(imgs, 'large') || imgUrl(imgs, 'common') || '',
      image_small: imgUrl(imgs, 'grid') || imgUrl(imgs, 'small') || imgUrl(imgs, 'medium') || '',
      rating: item.rating ? item.rating.score : 0,
      rank: item.rating ? item.rating.rank : 0,
      total_rating: item.rating ? item.rating.total : 0,
      date: item.date || '',
      platform: item.platform || '',
      eps: item.eps || item.total_episodes || 0,
      meta: seasonInfo(item),
      tags: (item.tags || []).slice(0, 4).map(t => t.name),
    };
  }

  async function searchAnime(keyword, limit = 12) {
    const key = keyword.trim().toLowerCase();
    if (searchCache.has(key)) return searchCache.get(key);

    const data = await post(`${BASE}/v0/search/subjects?limit=${limit}&offset=0`, {
      keyword,
      sort: 'rank',
      filter: { type: [2] },
    });

    const results = (data.data || []).map(parseSubject);
    searchCache.set(key, results);
    return results;
  }

  async function getSubjectDetail(id) {
    const data = await get(`${BASE}/v0/subjects/${id}`);
    return parseSubject(data);
  }

  return { searchAnime, getSubjectDetail, displayName, seasonInfo };
})();

AC.theme = (() => {
  const BRAND = { h: 190, s: 85, l: 55 };

  function colors() {
    const c = BRAND;
    const h2 = 20;
    return {
      acc1: `hsl(${c.h} ${c.s}% ${c.l}%)`,
      acc2: `hsl(${h2} 90% 58%)`,
      soft1: `hsl(${c.h} ${c.s}% ${c.l}% / .34)`,
      soft2: `hsl(${h2} 90% 58% / .26)`,
    };
  }

  return { colors };
})();
