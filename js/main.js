// 起動処理とゲームの流れ
// タイトル → シーズン（予選 → 決勝 → 順位表）／クイックレース／練習走行 → 結果
import { $, toast, fmtTime } from './util.js';
import { SAVE, loadGame, saveGame } from './save.js';
import { setupOffline, offlineStatus } from './offline.js';
import { COURSES, CALENDAR, buildTrack } from './track.js';
import { THEMES } from './themes.js';
import { useTheme } from './sprites.js';
import { makeCar } from './carart.js';
import { setupRender, resize, render } from './render.js';
import { CAR, KMH, gearOf, posOf } from './physics.js';
import { createRace, stepRace, simulateToEnd, results, gaps } from './race.js';
import { TEAMS, DRIVERS, DIFFS, RACE_LAPS, PLAYER_GRID, PLAYER_TEAM, teamOf } from './data.js';
import { POINTS, SKIP_GRID, newSeason, addResult, driverTable, teamTable, aiQualiTimes, gridFrom } from './season.js';
import { setupInput, input, steerInput, clearInput } from './input.js';
import { setupHud, updateHud, drawMap, showDelta, showBanner, hideBanner, resizeHud } from './hud.js';
import { initAudio, setEngine, blip, thud, setMuted, suspendAudio, resumeAudio } from './audio.js';

// 版の番号（sw.js の VERSION と同じにする）
export const APP_VERSION = '0.3.0';

const loaded = loadGame();
SAVE.settings.diff = SAVE.settings.diff || 'normal';
SAVE.stats = Object.assign({ races: 0, wins: 0, podiums: 0 }, SAVE.stats || {});
SAVE.records = SAVE.records || {};
SAVE.history = SAVE.history || [];
if (SAVE.season === undefined) SAVE.season = null;

// ---- コース（必要になったときに組み立てて覚えておく） ----
const tracks = {};
let track = null;
function setTrack(id){
  track = tracks[id] || (tracks[id] = buildTrack(COURSES[id]));
  useTheme(track.theme);
}

const playerArt = makeCar(teamOf(PLAYER_TEAM));
// ライバル車の絵（チームごと。小さめ）
const arts = {};
for (const t of TEAMS) arts[t.id] = makeCar(t, true);
// 地図の点の色（白っぽい車体はアクセントの色にする）
const light = hex => { const n = parseInt(hex.slice(1), 16); return ((n >> 16) & 255) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11 > 200; };
const mapColor = t => (light(t.body) ? t.accent : t.body);
const ME = DRIVERS.find(d => d.player).id;

const G = {
  mode: 'title',           // title / lights / race / finished / results / quali / paused / menu
  before: 'race',          // 一時停止の前の状態
  kind: 'race',            // race / practice / quali
  opts: {},                // start() に渡したもの（やり直しに使う）
  race: null,
  others: [],
  skyOff: 0,
  lights: 0, lightT: 0, holdT: 0,
  shake: 0, t: 0, hintT: 0, finishT: 0,
};
const bestOf = () => SAVE.best[track.def.id] ?? null;
const diffById = id => DIFFS.find(d => d.id === id) || DIFFS[1];
const nextRoundId = () => (SAVE.season && !SAVE.season.done ? CALENDAR[SAVE.season.round] : null);

// ---- 画面の準備 ----
setupRender($('cv'));
setupInput($('stage'));
setupHud();
setMuted(!SAVE.settings.sound);
$('titleVer').textContent = '版 ' + APP_VERSION;
const onResize = () => { resize(); resizeHud(); };
window.addEventListener('resize', onResize);
if (window.ResizeObserver) new ResizeObserver(onResize).observe($('stage'));

function buildDiff(){
  const el = $('diffSel');
  el.innerHTML = '<small>ライバル</small>';
  for (const d of DIFFS){
    const b = document.createElement('button');
    b.textContent = d.name;
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(d.id === SAVE.settings.diff));
    b.onclick = () => { SAVE.settings.diff = d.id; saveGame(); buildDiff(); };
    el.appendChild(b);
  }
}

function refreshTitle(){
  const s = SAVE.season;
  const year = (SAVE.history.length || 0) + 1;
  $('seasonSub').textContent = s && !s.done ? `第${s.round + 1}戦／${CALENDAR.length}・${COURSES[CALENDAR[s.round]].short}` : `シーズン${year}・全${CALENDAR.length}戦`;
  $('titleCirc').textContent = `${track.def.name}（${track.theme.time}）`;
}

function setRace(r){
  G.race = r;
  G.others = r.cars.filter(c => !c.player);
}

function hideOverlays(){
  for (const id of ['title', 'pause', 'results', 'menu', 'hud']) $(id).classList.add('hidden');
  hideBanner();
}

function showTitle(){
  hideOverlays();
  G.mode = 'title';
  $('title').classList.remove('hidden');
  setTrack(nextRoundId() || CALENDAR[Math.floor(Math.random() * CALENDAR.length)]);
  demoRace();
  refreshTitle();
}

// 画面の裏で、全員が自動でレースをしている
function demoRace(){
  const r = createRace(track, { diff: 0.92, laps: Infinity, arts, playerArt });
  r.started = true;
  // 少し進めてから見せる（スタート直後の団子を避ける）
  for (let i = 0; i < 60 * 8; i++) stepRace(r, 1 / 60, null);
  r.events.length = 0;
  setRace(r);
}

// ---- メニュー（シート） ----
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const btn = (label, cls, onclick) => { const b = h('button', cls, label); b.onclick = onclick; return b; };

function openMenu(build){
  for (const id of ['title', 'pause', 'results', 'hud']) $(id).classList.add('hidden');
  const sh = $('menuSheet');
  sh.innerHTML = '';
  build(sh);
  $('menu').classList.remove('hidden');
  if (G.mode !== 'title') G.mode = 'menu';
}
function backToTitle(){ $('menu').classList.add('hidden'); showTitle(); }

// サーキットの札（空の色・時間帯・メモ・記録）
function circuitCard(id, extra){
  const def = COURSES[id], th = THEMES[def.theme];
  const b = h('button', 'cbtn');
  const best = SAVE.best[id], rec = SAVE.records[id];
  b.innerHTML = `<div class="sky" style="background:linear-gradient(180deg,${th.sky[0]},${th.sky[1]} 60%,${th.grass[0]} 61%)">` +
    `${extra ? `<i>${extra}</i>` : ''}<span>${th.time}</span></div><b>${def.short}</b>` +
    `<small>${def.note}<br>ベスト ${best != null ? fmtTime(best) : '-'}${rec && rec.bestFinish ? '・最高 ' + rec.bestFinish + '位' : ''}</small>`;
  return b;
}

function openCircuits(kind){
  openMenu(sh => {
    sh.appendChild(h('h2', '', kind === 'practice' ? '練習走行：サーキットを選ぶ' : `クイックレース：サーキットを選ぶ（${RACE_LAPS}周・ライバル ${diffById(SAVE.settings.diff).name}）`));
    const list = h('div', 'clist');
    for (const id of CALENDAR){
      const b = circuitCard(id);
      b.onclick = () => { setTrack(id); start(kind); };
      list.appendChild(b);
    }
    sh.appendChild(list);
    const bs = h('div', 'rbtns');
    bs.appendChild(btn('もどる', '', backToTitle));
    sh.appendChild(bs);
  });
}

// 順位表（ドライバー／チーム）。mine：自分の行を目立たせる
function standingsTable(season, which, limit){
  const tbl = h('div', 'rtable');
  if (which === 'team'){
    tbl.appendChild(h('div', 'rrow st hd', '<span class="p">順位</span><span></span><span>チーム</span><span class="pt">点</span><span></span>'));
    teamTable(season).forEach((x, i) => {
      const r = h('div', 'rrow st' + (x.t.id === PLAYER_TEAM ? ' me' : ''));
      r.innerHTML = `<span class="p">${i + 1}</span><span class="sw" style="background:${x.t.body};box-shadow:inset 0 -5px 0 ${x.t.accent}"></span><span class="nm">${x.t.name}</span><span class="pt">${x.pts}</span><span></span>`;
      tbl.appendChild(r);
    });
    return tbl;
  }
  tbl.appendChild(h('div', 'rrow st hd', '<span class="p">順位</span><span></span><span>ドライバー</span><span class="pt">点</span><span class="bl">勝</span>'));
  const rows = driverTable(season);
  rows.forEach((x, i) => {
    if (limit && i >= limit && x.d.id !== ME) return;
    const r = h('div', 'rrow st' + (x.d.id === ME ? ' me' : ''));
    r.innerHTML = `<span class="p">${i + 1}</span><span class="sw" style="background:${x.team.body};box-shadow:inset 0 -5px 0 ${x.team.accent}"></span>` +
      `<span class="nm">${x.d.name}<small>${x.team.name}</small></span><span class="pt">${x.pts}</span><span class="bl">${x.wins || ''}</span>`;
    tbl.appendChild(r);
  });
  return tbl;
}

function openStandings(back){
  let which = 'driver';
  const draw = () => openMenu(sh => {
    const s = SAVE.season;
    sh.appendChild(h('h2', '', `シーズン${s.year} 順位表（${s.round}／${CALENDAR.length}戦）`));
    const tabs = h('div', 'mtabs');
    for (const [k, label] of [['driver', 'ドライバー'], ['team', 'チーム']]){
      const b = btn(label, '', () => { which = k; draw(); });
      b.setAttribute('aria-pressed', String(which === k));
      tabs.appendChild(b);
    }
    sh.appendChild(tabs);
    sh.appendChild(standingsTable(s, which));
    const bs = h('div', 'rbtns');
    bs.appendChild(btn('もどる', 'primary', back));
    sh.appendChild(bs);
    const me = sh.querySelector('.me'); if (me) me.scrollIntoView({ block: 'center' });
  });
  draw();
}

function openSeason(){
  const s = SAVE.season;
  if (s && s.done){ openChampion(); return; }
  if (!s){
    const year = SAVE.history.length + 1;
    const diff = diffById(SAVE.settings.diff);
    openMenu(sh => {
      sh.appendChild(h('h2', '', `シーズン${year}を始める`));
      sh.appendChild(h('p', 'mnote', `全${CALENDAR.length}戦・各${RACE_LAPS}周。上位10台にポイント（${POINTS.join('・')}）。<br>各戦の前に予選（1周のタイムアタック）でスタート位置を決める。とばすと${SKIP_GRID}番手から。<br>ライバルの強さ：<b>${diff.name}</b>（タイトル画面で変えられる。シーズン中は変わらない）`));
      const list = h('div', 'clist');
      CALENDAR.forEach((id, i) => { const b = circuitCard(id, `第${i + 1}戦`); b.disabled = true; list.appendChild(b); });
      sh.appendChild(list);
      if (SAVE.history.length){
        sh.appendChild(h('p', 'mnote', 'これまで：' + SAVE.history.map(x => `シーズン${x.year} ${x.me}位${x.me === 1 ? '（チャンピオン）' : ''}`).join('・')));
      }
      const bs = h('div', 'rbtns');
      bs.appendChild(btn('始める', 'primary', () => { SAVE.season = newSeason(diff.id, year); saveGame(); openSeason(); }));
      bs.appendChild(btn('タイトルへ', '', backToTitle));
      sh.appendChild(bs);
    });
    return;
  }
  const id = CALENDAR[s.round];
  if (!track || track.def.id !== id){ setTrack(id); demoRace(); }
  openMenu(sh => {
    sh.appendChild(h('h2', '', `シーズン${s.year}　第${s.round + 1}戦／${CALENDAR.length}（ライバル ${diffById(s.diff).name}）`));
    const top = h('div', 'hubtop');
    const card = circuitCard(id, `第${s.round + 1}戦`);
    card.classList.add('next');
    card.disabled = true;
    top.appendChild(card);
    const side = h('div', 'hubside');
    side.appendChild(btn('予選を走る<small>1周のタイムアタック</small>', 'primary', () => start('quali')));
    side.appendChild(btn(`予選をとばす<small>${SKIP_GRID}番手から決勝</small>`, '', () => {
      const g = gridFrom(aiQualiTimes(track, diffById(s.diff).base), null);
      start('race', { grid: g.order, season: true });
    }));
    side.appendChild(btn('順位表', '', () => openStandings(openSeason)));
    side.appendChild(btn('タイトルへ', '', backToTitle));
    top.appendChild(side);
    sh.appendChild(top);
    if (s.round > 0) sh.appendChild(standingsTable(s, 'driver', 5));
    else sh.appendChild(h('p', 'mnote', '開幕戦。まずは予選で前のほうのグリッドを取ろう。'));
  });
}

function openChampion(){
  const s = SAVE.season;
  const rows = driverTable(s), teams = teamTable(s);
  const meRow = rows.findIndex(x => x.d.id === ME) + 1;
  if (!s.recorded){
    SAVE.history.push({ year: s.year, champ: rows[0].d.id, team: teams[0].t.id, me: meRow, diff: s.diff });
    s.recorded = true;
    saveGame();
  }
  openMenu(sh => {
    sh.appendChild(h('h2', '', `シーズン${s.year} 終了`));
    const c = h('div', 'champ');
    c.innerHTML = `ドライバーズチャンピオン<b class="cn">${rows[0].d.name}</b><small>${rows[0].team.name}・${rows[0].pts}点</small>` +
      `<p class="mnote">チームチャンピオン：${teams[0].t.name}（${teams[0].pts}点）　あなた：<b>${meRow}位</b>（${rows[meRow - 1].pts}点）</p>`;
    sh.appendChild(c);
    sh.appendChild(standingsTable(s, 'driver'));
    const bs = h('div', 'rbtns');
    bs.appendChild(btn('次のシーズンへ', 'primary', () => { SAVE.season = null; saveGame(); openSeason(); }));
    bs.appendChild(btn('タイトルへ', '', () => { SAVE.season = null; saveGame(); backToTitle(); }));
    sh.appendChild(bs);
    const me = sh.querySelector('.rtable .me'); if (me) me.scrollIntoView({ block: 'center' });
  });
}

// ---- レース・予選・練習走行 ----
// kind：race / practice / quali。opts：{ grid（ドライバー id の並び）, season（シーズンの決勝か） }
function start(kind, opts = {}){
  initAudio();
  clearInput();
  G.kind = kind;
  G.opts = opts;
  hideOverlays();
  $('hud').classList.remove('hidden');
  $('hHint').classList.remove('gone');
  const s = SAVE.season;
  const diff = (opts.season || kind === 'quali') && s ? diffById(s.diff) : diffById(SAVE.settings.diff);
  setRace(createRace(track, {
    diff: diff.base,
    laps: kind === 'race' ? RACE_LAPS : kind === 'quali' ? 1 : Infinity,
    practice: kind !== 'race',
    runup: kind === 'quali' ? 80 : 30,
    grid: opts.grid,
    arts, playerArt,
  }));
  G.mode = 'lights';
  G.lights = 0; G.lightT = 0; G.holdT = 0.5 + Math.random() * 1.2;
  G.hintT = 6;
  G.finishT = 0;
  if (kind === 'quali') showBanner('<b>QUALIFYING</b><span>予選：ラインを越えてから1周</span>', 2600);
}

function onLap(e){
  const b = bestOf();
  if (b == null || e.lap < b){
    SAVE.best[track.def.id] = e.lap;
    saveGame();
    showDelta(b == null ? null : e.lap - b, true);
    if (b != null) toast('ベストラップ更新！ ' + fmtTime(e.lap));
  } else {
    showDelta(e.lap - b, false);
  }
  blip(880, 0.12); setTimeout(() => blip(1320, 0.18), 120);
  const r = G.race;
  if (G.kind === 'race' && e.n === r.laps - 1) showBanner('<b>FINAL LAP</b><span>ファイナルラップ</span>', 2000);
}

function onFinish(){
  G.mode = 'finished';
  G.finishT = 0;
  if (G.kind === 'quali'){
    showBanner(`<b>${fmtTime(G.race.player.lastLap)}</b><span>予選タイム</span>`, 0);
  } else {
    showBanner(`<b>FINISH</b><span>${gaps(G.race).pos}位</span>`, 0);
  }
  blip(660, 0.15); setTimeout(() => blip(990, 0.15), 150); setTimeout(() => blip(1320, 0.3), 300);
}

function showQuali(){
  const s = SAVE.season;
  const mine = G.race.player.lastLap;
  const g = gridFrom(aiQualiTimes(track, diffById(s.diff).base), mine);
  const pos = g.order.indexOf(ME) + 1;
  G.mode = 'menu';
  openMenu(sh => {
    sh.appendChild(h('h2', '', `予選結果　${track.def.short}`));
    sh.appendChild(h('p', 'rsum', `あなた：<b>${pos}番手</b>（${fmtTime(mine)}）${pos === 1 ? '　ポールポジション！' : ''}`));
    const tbl = h('div', 'rtable');
    tbl.appendChild(h('div', 'rrow q hd', '<span class="p">順位</span><span></span><span>ドライバー</span><span class="t">タイム</span>'));
    g.rows.forEach((x, i) => {
      const d = DRIVERS.find(v => v.id === x.id), t = teamOf(d.team);
      const r = h('div', 'rrow q' + (x.id === ME ? ' me' : ''));
      r.innerHTML = `<span class="p">${i + 1}</span><span class="sw" style="background:${t.body};box-shadow:inset 0 -5px 0 ${t.accent}"></span>` +
        `<span class="nm">${d.name}<small>${t.name}</small></span><span class="t">${fmtTime(x.t)}</span>`;
      tbl.appendChild(r);
    });
    sh.appendChild(tbl);
    const bs = h('div', 'rbtns');
    bs.appendChild(btn('決勝へ', 'primary', () => start('race', { grid: g.order, season: true })));
    bs.appendChild(btn('予選をやり直す', '', () => start('quali')));
    sh.appendChild(bs);
    const me = tbl.querySelector('.me'); if (me) me.scrollIntoView({ block: 'center' });
  });
}

function showResults(){
  const r = G.race;
  simulateToEnd(r);
  hideBanner();
  const rows = results(r);
  const me = rows.find(x => x.car.player);
  const fastest = rows.reduce((m, x) => (x.best != null && (m == null || x.best < m.best) ? x : m), null);
  const grid = me.car.grid;
  // 記録
  SAVE.stats.races++;
  if (me.pos === 1) SAVE.stats.wins++;
  if (me.pos <= 3) SAVE.stats.podiums++;
  const rec = SAVE.records[track.def.id] || (SAVE.records[track.def.id] = {});
  if (!rec.bestFinish || me.pos < rec.bestFinish) rec.bestFinish = me.pos;
  // シーズンのポイント
  let gained = null;
  const s = SAVE.season;
  if (G.opts.season && s && !s.done){
    gained = addResult(s, track.def.id, rows.map(x => x.car.driver.id), fastest ? fastest.car.driver.id : null);
  }
  saveGame();

  $('rTitle').textContent = (gained ? `第${s.round}戦 ` : '') + `レース結果　${track.def.name}`;
  const moved = grid - me.pos;
  $('rSummary').innerHTML = `あなた：<b>${me.pos}位</b>（${grid}番手スタート${moved > 0 ? '・' + moved + '台抜き' : moved < 0 ? '・' + (-moved) + 'つ後退' : ''}）` +
    `${gained ? `　<b>+${gained[ME]}点</b>` : ''}　ベストラップ ${fmtTime(me.best)}`;
  const tbl = $('rTable');
  tbl.innerHTML = '<div class="rrow hd"><span class="p">順位</span><span></span><span>ドライバー</span><span class="t">タイム</span><span class="bl">ベスト</span><span class="pt">' + (gained ? '点' : '') + '</span></div>';
  for (const x of rows){
    const c = x.car;
    const row = document.createElement('div');
    row.className = 'rrow' + (c.player ? ' me' : '');
    const t = x.pos === 1 ? fmtTime(x.time) : typeof x.gap === 'string' ? x.gap : '+' + x.gap.toFixed(3);
    const pts = gained && gained[c.driver.id] ? '+' + gained[c.driver.id] : '';
    row.innerHTML = `<span class="p">${x.pos}</span><span class="sw" style="background:${c.team.body};box-shadow:inset 0 -5px 0 ${c.team.accent}"></span>` +
      `<span class="nm">${c.driver.name}<small>${c.team.name}</small></span><span class="t">${t}</span>` +
      `<span class="bl${x === fastest ? ' fl' : ''}">${fmtTime(x.best)}</span><span class="pt">${pts}</span>`;
    tbl.appendChild(row);
  }
  const bs = $('rBtns');
  bs.innerHTML = '';
  if (gained){
    bs.appendChild(btn(s.done ? '最終結果へ' : 'シーズンへ', 'primary', () => { $('results').classList.add('hidden'); openSeason(); }));
    bs.appendChild(btn('順位表', '', () => openStandings(() => { openMenu(() => {}); $('menu').classList.add('hidden'); $('results').classList.remove('hidden'); G.mode = 'results'; })));
  } else {
    bs.appendChild(btn('もう一度', 'primary', () => start('race', G.opts)));
    bs.appendChild(btn('タイトルへ', '', () => { setEngine(0, 0, false); showTitle(); }));
  }
  $('hud').classList.add('hidden');
  $('results').classList.remove('hidden');
  G.mode = 'results';
  const mine = tbl.querySelector('.me');
  if (mine) mine.scrollIntoView({ block: 'center' });
}

// ---- 一時停止 ----
async function pause(){
  if (G.mode !== 'race' && G.mode !== 'lights' && G.mode !== 'finished') return;
  G.before = G.mode;
  G.mode = 'paused';
  clearInput();
  setEngine(0, 0, false);
  $('pause').classList.remove('hidden');
  $('quitBtn').textContent = G.opts.season || G.kind === 'quali' ? 'シーズンの画面へ（この回は数えない）' : 'タイトルへ';
  updateSoundBtn();
  $('offlStatus').textContent = await offlineStatus();
}
function resume(){
  if (G.mode !== 'paused') return;
  $('pause').classList.add('hidden');
  initAudio();
  G.mode = G.before;
}
function updateSoundBtn(){
  const on = SAVE.settings.sound;
  $('soundBtn').textContent = '音：' + (on ? 'ON' : 'OFF');
  $('soundBtn').setAttribute('aria-pressed', String(on));
}

$('seasonBtn').onclick = openSeason;
$('quickBtn').onclick = () => openCircuits('race');
$('practiceBtn').onclick = () => openCircuits('practice');
$('pauseBtn').onclick = pause;
$('resumeBtn').onclick = resume;
$('restartBtn').onclick = () => start(G.kind, G.opts);
$('quitBtn').onclick = () => {
  setEngine(0, 0, false);
  if (G.opts.season || G.kind === 'quali'){ $('pause').classList.add('hidden'); $('hud').classList.add('hidden'); G.mode = 'menu'; openSeason(); }
  else showTitle();
};
$('soundBtn').onclick = () => {
  SAVE.settings.sound = !SAVE.settings.sound;
  setMuted(!SAVE.settings.sound);
  saveGame();
  updateSoundBtn();
};
window.addEventListener('keydown', e => {
  if (e.code === 'Escape' || e.code === 'KeyP'){ G.mode === 'paused' ? resume() : pause(); }
});

// 裏に回ったら止める
document.addEventListener('visibilitychange', () => {
  if (document.hidden){ if (!G.noAutoPause) pause(); suspendAudio(); saveGame(); }
  else resumeAudio();
});
window.addEventListener('pagehide', saveGame);

// ---- 毎フレームの処理 ----
function update(dt){
  const r = G.race;
  G.t += dt;
  if (G.mode === 'paused') return;

  if (G.mode === 'lights'){
    // 信号：1つずつ点いて、5つ点いたあと少し待って全部消えたらスタート
    G.lightT += dt;
    const want = Math.min(5, Math.floor((G.lightT - 0.6) / 0.9) + 1);
    if (want > G.lights && G.lightT > 0.6){ G.lights = want; blip(520, 0.12, 'square', 0.08); }
    if (G.lights === 5 && G.lightT > 0.6 + 4 * 0.9 + G.holdT){
      G.lights = 0; G.mode = 'race'; r.started = true;
      blip(1040, 0.3, 'square', 0.1);
    }
    stepRace(r, dt, null);
  } else if (G.mode === 'race'){
    // autoDrive は確認用（コンソールで T.G.autoDrive = true にすると自動で走る）
    const ctl = G.autoDrive ? null : { steer: steerInput(), brake: input.brake, throttle: true };
    stepRace(r, dt, ctl);
    if (G.hintT > 0){ G.hintT -= dt; if (G.hintT <= 0) $('hHint').classList.add('gone'); }
  } else if (G.mode === 'finished'){
    stepRace(r, dt, null);
    G.finishT += dt;
    if (G.finishT > (G.kind === 'quali' ? 2 : 3)){ hideBanner(); G.kind === 'quali' ? showQuali() : showResults(); }
  } else {
    // タイトル・結果・メニュー：自動で走り続ける
    stepRace(r, dt, null);
  }

  for (const e of r.events){
    if (G.mode !== 'race' && G.mode !== 'finished') break;
    if (e.type === 'lap') onLap(e);
    else if (e.type === 'finish') onFinish();
    else if (e.type === 'hit'){ thud(); G.shake = 0.35; }
    else if (e.type === 'bump'){ thud(); G.shake = Math.max(G.shake, Math.min(0.35, e.rel / CAR.max * 2)); }
  }
  r.events.length = 0;

  // 景色の流れ（右カーブでは背景が左へ）
  const p = r.player;
  const seg = track.at(p.z + p.off);
  G.skyOff += seg.curve * (p.speed / CAR.max) * dt * 0.035;
  G.shake = Math.max(0, G.shake - dt);
}

let lastT = performance.now();
function frame(now){
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  // 物理は細かく刻む（フレームが落ちても動きが変わらないように）
  const n = Math.max(1, Math.ceil(dt / (1 / 120)));
  for (let i = 0; i < n; i++) update(dt / n);

  const r = G.race, c = r.player, pct = c.speed / CAR.max;
  // 揺れ：縁石・芝・ぶつかったとき・速いとき
  let shake = 0, bounce = Math.sin(G.t * 31) * pct * 0.6;
  if (G.mode !== 'paused'){
    if (c.surface === 'kerb') shake = (Math.random() - 0.5) * 3 * pct;
    if (c.surface === 'grass' || c.surface === 'gravel') shake = (Math.random() - 0.5) * 5 * Math.max(0.3, pct);
    if (G.shake > 0) shake += (Math.random() - 0.5) * 14 * G.shake;
    if (c.surface !== 'road') bounce += (Math.random() - 0.5) * 3 * pct;
  }

  render({
    track, z: c.z, x: c.x, steer: c.steer, brake: c.braking,
    car: playerArt, cars: G.others, skyOff: G.skyOff, lights: G.lights, shake, bounce,
  });

  const racing = G.mode === 'lights' || G.mode === 'race' || G.mode === 'finished' || G.mode === 'paused';
  if (racing){
    const ge = gearOf(Math.min(1, pct));
    const moving = c.speed > 1;
    const isRace = G.kind === 'race';
    const gp = isRace ? gaps(r) : null;
    updateHud({
      lap: Math.max(1, Math.min(isRace ? r.laps : 999, c.lapsDone + 1)), lapOf: isRace ? r.laps : 0,
      pos: gp ? gp.pos : null, posOf: gp ? gp.of : 0, ahead: gp ? gp.ahead : null, behind: gp ? gp.behind : null,
      time: c.lapsDone >= 0 ? c.lapT : 0, best: bestOf(), last: c.lastLap,
      kmh: c.speed * KMH, gear: moving || G.mode === 'race' ? String(ge.gear) : 'N',
      rpm: moving ? ge.rpm : (G.mode === 'lights' ? 0.55 + 0.1 * Math.sin(G.t * 9) : 0),
    });
    drawMap(track, posOf(c, track), G.others.map(o => ({ z: posOf(o, track), color: mapColor(o.team) })));
    if (G.mode === 'race') setEngine(ge.rpm, input.brake ? 0 : 1, true);
    else if (G.mode === 'finished') setEngine(ge.rpm * 0.8, 0.2, true);
    else if (G.mode === 'lights') setEngine(0.35 + 0.08 * Math.sin(G.t * 9), 0.3, true);
    else setEngine(0, 0, false);
  } else {
    setEngine(0, 0, false);
  }
  requestAnimationFrame(frame);
}

buildDiff();
showTitle();
requestAnimationFrame(frame);
setupOffline();
if (loaded === 'broken') toast('セーブデータを読めなかったため、新しく始めました（元のデータは別名で保管）', 4000);

// 調整・確認用
window.T = { G, get track(){ return track; }, setTrack, SAVE, CAR, start, showTitle, showResults, openSeason, pause, resume };
