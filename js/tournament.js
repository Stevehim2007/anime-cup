/* 决战动漫之巅 · 赛制逻辑（纯函数，与 UI 无关） */
window.AC = window.AC || {};

AC.GROUP_LETTERS = 'ABCDEFGHIJKL';

/**
 * 可用赛制规模（参照 2026 世界杯 48 队赛制）：
 * n=参赛动漫数, groups=小组数(每组4选2), bracket=淘汰赛规模, wild=遗珠复活名额
 */
AC.SIZES = [
  { n: 48, groups: 12, bracket: 32 },
  { n: 40, groups: 10, bracket: 32 },
  { n: 32, groups: 8,  bracket: 16 },
  { n: 24, groups: 6,  bracket: 16 },
  { n: 16, groups: 4,  bracket: 8 },
  { n: 8,  groups: 2,  bracket: 4 },
];

AC.pickSize = avail => {
  const s = AC.SIZES.find(x => avail >= x.n);
  if (!s) return null;
  return { ...s, wild: s.bracket - s.n / 2 };
};

/**
 * 世界杯式分档抽签：按添加顺序分 4 档（档 p = 索引 [p*g, (p+1)*g)），
 * 每组从每档各抽 1 部，保证组内强弱均衡。
 * 返回 groups[gi] = [4 个动漫索引]
 */
AC.drawGroups = g => {
  const groups = Array.from({ length: g }, () => []);
  for (let p = 0; p < 4; p++) {
    const pot = AC.shuffle(Array.from({ length: g }, (_, i) => p * g + i));
    for (let i = 0; i < g; i++) groups[i].push(pot[i]);
  }
  return groups;
};

/** 标准种子签位序：[1,n] 两端相遇于决赛。n=4 → [1,4,2,3] */
AC.bracketOrder = n => {
  let arr = [1];
  while (arr.length < n) {
    const m = arr.length * 2;
    const next = [];
    for (const s of arr) next.push(s, m + 1 - s);
    arr = next;
  }
  return arr;
};

/**
 * 生成淘汰赛签表：
 * - 小组晋级者作为高种子，遗珠复活者为低种子
 * - 标准蛇形落位，两个半区决赛前不相遇
 * - 尽量避免同组动漫首轮相遇（局部交换）
 */
AC.seedBracket = state => {
  const winners = state.groupPicks.flat().slice().sort((a, b) => a - b);
  const wild = state.wildcardPicks.slice().sort((a, b) => a - b);
  const seeds = winners.concat(wild);
  const order = AC.bracketOrder(seeds.length);
  const placed = order.map(s => seeds[s - 1]);
  const grp = i => state.groupOf[i];
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < placed.length; i += 2) {
      if (grp(placed[i]) !== grp(placed[i + 1])) continue;
      for (let j = 0; j < placed.length; j += 2) {
        if (j === i) continue;
        const a = placed[i], b = placed[i + 1], c = placed[j], d = placed[j + 1];
        if (grp(a) !== grp(d) && grp(c) !== grp(b)) {
          placed[i + 1] = d; placed[j + 1] = b;
          break;
        }
      }
    }
  }
  return placed;
};

/** rounds[r] = [{a, b, winner}]，后续轮次先占位为 null */
AC.buildRounds = placed => {
  const rounds = [];
  rounds.push(Array.from({ length: placed.length / 2 }, (_, m) =>
    ({ a: placed[2 * m], b: placed[2 * m + 1], winner: null })));
  let size = placed.length / 2;
  while (size >= 2) {
    rounds.push(Array.from({ length: size / 2 }, () => ({ a: null, b: null, winner: null })));
    size /= 2;
  }
  return rounds;
};

AC.roundNames = bracket => ({
  32: ['32强', '16强', '8强', '半决赛', '决赛'],
  16: ['16强', '8强', '半决赛', '决赛'],
  8:  ['8强', '半决赛', '决赛'],
  4:  ['半决赛', '决赛'],
}[bracket]);
