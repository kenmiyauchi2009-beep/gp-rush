// 実績（達成すると CR がもらえる）と記録の画面
import { SAVE, saveGame } from './save.js';
import { toast, fmtTime } from './util.js';
import { CALENDAR, COURSES } from './track.js';
import { THEMES } from './themes.js';
import { DRIVERS } from './data.js';
import { carPower, cr } from './garage.js';

const S = () => SAVE.stats;
const wonAt = id => (SAVE.records[id] && SAVE.records[id].wins) || 0;
const circuitsWon = () => CALENDAR.filter(id => wonAt(id) > 0).length;
const parts = () => SAVE.garage.parts;

// test(ctx)：ctx はレースの結果など（なくても数で判定できるものは判定する）。prog：進み具合 [今, 目標]
export const ACH = [
  { id: 'finish',   name: 'はじめてのゴール',   desc: 'レースを完走する',                     cr: 200,  test: () => S().races >= 1 },
  { id: 'podium',   name: '表彰台',             desc: '3位以内でゴールする',                   cr: 500,  test: () => S().podiums >= 1 },
  { id: 'win',      name: '初優勝',             desc: 'レースで優勝する',                     cr: 1000, test: () => S().wins >= 1 },
  { id: 'pole',     name: 'ポールポジション',   desc: '予選で1番手になる',                     cr: 500,  test: () => (S().poles || 0) >= 1 },
  { id: 'fastest',  name: 'ファステストラップ', desc: 'レースでいちばん速い周を記録する',     cr: 300,  test: () => (S().fastest || 0) >= 1 },
  { id: 'charge',   name: 'ごぼう抜き',         desc: '1レースで10台以上抜く',                 cr: 800,  test: c => c.race && c.grid - c.pos >= 10 },
  { id: 'comeback', name: '大逆転',             desc: '12番手以下のスタートから優勝する',     cr: 1500, test: c => c.race && c.pos === 1 && c.grid >= 12 },
  { id: 'clean',    name: 'ノーミス',           desc: '芝やグラベルに出ず、何にもぶつからずに完走する', cr: 800, test: c => c.race && c.clean },
  { id: 'rain',     name: '雨の勝者',           desc: '雨のレースで優勝する',                 cr: 1200, test: c => c.race && c.pos === 1 && c.weather === 'rain' },
  { id: 'night',    name: '夜の勝者',           desc: '夜のレースで優勝する',                 cr: 800,  test: c => c.race && c.pos === 1 && c.night },
  { id: 'long',     name: 'ロングレース',       desc: '8周のレースを完走する',                 cr: 500,  test: c => c.race && c.laps >= 8 },
  { id: 'strategy', name: '作戦勝ち',           desc: 'ピットに入って、そのレースで優勝する', cr: 1200, test: c => c.race && c.pos === 1 && c.stops >= 1 },
  { id: 'hard',     name: '本気のライバル',     desc: '「むずかしい」で優勝する',             cr: 2000, test: c => c.race && c.pos === 1 && c.diff === 'hard' },
  { id: 'allwins',  name: 'サーキット制覇',     desc: '8つすべてのサーキットで優勝する',       cr: 5000, test: () => circuitsWon() >= CALENDAR.length, prog: () => [circuitsWon(), CALENDAR.length] },
  { id: 'season',   name: 'シーズン完走',       desc: 'シーズンを最後まで走る',               cr: 1500, test: () => SAVE.history.length >= 1 },
  { id: 'champ',    name: 'チャンピオン',       desc: 'シーズンでチャンピオンになる',         cr: 5000, test: () => SAVE.history.some(x => x.me === 1) },
  { id: 'races10',  name: '10レース',           desc: 'レースを10回完走する',                 cr: 500,  test: () => S().races >= 10, prog: () => [S().races, 10] },
  { id: 'races50',  name: '50レース',           desc: 'レースを50回完走する',                 cr: 2000, test: () => S().races >= 50, prog: () => [S().races, 50] },
  { id: 'wins10',   name: '10勝',               desc: '通算10勝する',                         cr: 3000, test: () => S().wins >= 10, prog: () => [S().wins, 10] },
  { id: 'rich',     name: '稼ぎ頭',             desc: '賞金を通算 20,000 CR 稼ぐ',             cr: 1000, test: () => (S().crTotal || 0) >= 20000, prog: () => [Math.min(S().crTotal || 0, 20000), 20000] },
  { id: 'epic',     name: 'エピック',           desc: 'エピックのパーツを手に入れる',         cr: 500,  test: () => parts().some(p => p.r >= 4) },
  { id: 'legend',   name: 'レジェンド',         desc: 'レジェンドのパーツを手に入れる',       cr: 1500, test: () => parts().some(p => p.r >= 5) },
  { id: 'maxlv',    name: '鍛え上げ',           desc: 'パーツを Lv10 まで強化する',            cr: 1000, test: () => parts().some(p => p.lv >= 10) },
  { id: 'power',    name: 'モンスターマシン',   desc: '戦力 1500 に届く',                      cr: 1000, test: () => carPower() >= 1500, prog: () => [Math.min(carPower(), 1500) - 1000, 500] },
];

// 新しく達成したものを調べて CR を渡す
export function checkAch(ctx = {}){
  SAVE.ach = SAVE.ach || {};
  const got = [];
  for (const a of ACH){
    if (SAVE.ach[a.id]) continue;
    let ok = false;
    try { ok = !!a.test(ctx); } catch(e){ ok = false; }
    if (ok){
      SAVE.ach[a.id] = Date.now();
      SAVE.cr += a.cr;
      got.push(a);
    }
  }
  if (got.length){
    saveGame();
    const first = got[0];
    toast(`実績「${first.name}」 +${cr(first.cr)}${got.length > 1 ? `　ほか${got.length - 1}つ` : ''}`, 3200);
  }
  return got;
}

const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const btn = (label, cls, onclick) => { const b = h('button', cls, label); b.onclick = onclick; return b; };

export function openAchievements(openMenu, back, tab = 'ach'){
  const draw = () => openMenu(sh => {
    SAVE.ach = SAVE.ach || {};
    const done = ACH.filter(a => SAVE.ach[a.id]).length;
    sh.appendChild(h('h2', '', tab === 'ach' ? `実績　${done}／${ACH.length}` : '記録'));
    const tabs = h('div', 'mtabs');
    for (const [k, label] of [['ach', '実績'], ['rec', '記録']]){
      const b = btn(label, '', () => { tab = k; draw(); });
      b.setAttribute('aria-pressed', String(tab === k));
      tabs.appendChild(b);
    }
    sh.appendChild(tabs);
    if (tab === 'ach'){
      const list = h('div', 'alist');
      // 達成していないものを先に
      for (const a of ACH.slice().sort((x, y) => (SAVE.ach[x.id] ? 1 : 0) - (SAVE.ach[y.id] ? 1 : 0))){
        const ok = !!SAVE.ach[a.id];
        const pr = !ok && a.prog ? a.prog() : null;
        const row = h('div', 'arow' + (ok ? ' ok' : ''));
        row.innerHTML = `<i>${ok ? '★' : '☆'}</i><span><b>${a.name}</b><small>${a.desc}${pr ? `（${Math.max(0, pr[0]).toLocaleString('ja-JP')}／${pr[1].toLocaleString('ja-JP')}）` : ''}</small></span><em>${ok ? '達成' : '+' + cr(a.cr)}</em>`;
        list.appendChild(row);
      }
      sh.appendChild(list);
    } else {
      const st = SAVE.stats;
      const box = h('div', 'alist');
      box.appendChild(h('div', 'gs', `<span>レース</span><b>${st.races}回</b>`));
      box.appendChild(h('div', 'gs', `<span>優勝・表彰台</span><b>${st.wins}勝・${st.podiums}回</b>`));
      box.appendChild(h('div', 'gs', `<span>ポール・ファステストラップ</span><b>${st.poles || 0}回・${st.fastest || 0}回</b>`));
      box.appendChild(h('div', 'gs', `<span>賞金の合計</span><b>${cr(st.crTotal || 0)}</b>`));
      box.appendChild(h('div', 'gs', `<span>練習走行</span><b>${st.practiceLaps || 0}周</b>`));
      const tbl = h('div', 'rtable');
      tbl.appendChild(h('div', 'rrow rec hd', '<span>サーキット</span><span class="t">ベストラップ</span><span class="t">最高順位</span><span class="t">優勝</span>'));
      for (const id of CALENDAR){
        const rec = SAVE.records[id] || {};
        tbl.appendChild(h('div', 'rrow rec', `<span class="nm">${COURSES[id].short}<small>${THEMES[COURSES[id].theme].time}</small></span>` +
          `<span class="t">${SAVE.best[id] != null ? fmtTime(SAVE.best[id]) : '-'}</span><span class="t">${rec.bestFinish ? rec.bestFinish + '位' : '-'}</span><span class="t">${rec.wins || 0}</span>`));
      }
      box.appendChild(tbl);
      if (SAVE.history.length){
        box.appendChild(h('p', 'mnote', 'シーズン：' + SAVE.history.map(x => {
          const ch = DRIVERS.find(d => d.id === x.champ);
          return `${x.year}年目 あなた${x.me}位（チャンピオン ${ch ? ch.name : '-'}）`;
        }).join('・')));
      }
      sh.appendChild(box);
    }
    const bs = h('div', 'rbtns');
    bs.appendChild(btn('もどる', 'primary', back));
    sh.appendChild(bs);
  });
  draw();
}

