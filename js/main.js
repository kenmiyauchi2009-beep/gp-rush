// 起動処理とゲームの流れ（タイトル → 信号 → レース／練習走行 → 結果）
import { $, toast, fmtTime } from './util.js';
import { SAVE, loadGame, saveGame } from './save.js';
import { setupOffline, offlineStatus } from './offline.js';
import { COURSES, buildTrack, SEG } from './track.js';
import { makeSprites } from './sprites.js';
import { makeCar } from './carart.js';
import { setupRender, resize, render } from './render.js';
import { CAR, KMH, gearOf, posOf } from './physics.js';
import { createRace, stepRace, simulateToEnd, results, gaps } from './race.js';
import { TEAMS, DIFFS, RACE_LAPS, PLAYER_GRID, PLAYER_TEAM, teamOf } from './data.js';
import { setupInput, input, steerInput, clearInput } from './input.js';
import { setupHud, updateHud, drawMap, showDelta, showBanner, hideBanner, resizeHud } from './hud.js';
import { initAudio, setEngine, blip, thud, setMuted, suspendAudio, resumeAudio } from './audio.js';

// 版の番号（sw.js の VERSION と同じにする）
export const APP_VERSION = '0.2.0';

const loaded = loadGame();
SAVE.settings.diff = SAVE.settings.diff || 'normal';
SAVE.stats = Object.assign({ races: 0, wins: 0, podiums: 0 }, SAVE.stats || {});
SAVE.records = SAVE.records || {};

makeSprites();
const track = buildTrack(COURSES.valley);
const playerArt = makeCar(teamOf(PLAYER_TEAM));
// ライバル車の絵（チームごと。小さめ）
const arts = {};
for (const t of TEAMS) arts[t.id] = makeCar(t, true);
// 地図の点の色（白っぽい車体はアクセントの色にする）
const light = hex => { const n = parseInt(hex.slice(1), 16); return ((n >> 16) & 255) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11 > 200; };
const mapColor = t => (light(t.body) ? t.accent : t.body);

const G = {
  mode: 'title',           // title / lights / race / finished / results / paused
  before: 'race',          // 一時停止の前の状態
  kind: 'race',            // race / practice
  race: null,
  others: [],
  skyOff: 0,
  lights: 0, lightT: 0, holdT: 0,
  shake: 0, t: 0, hintT: 0, finishT: 0,
};
const bestOf = () => SAVE.best[track.def.id] ?? null;
const diffOf = () => DIFFS.find(d => d.id === SAVE.settings.diff) || DIFFS[1];

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
    b.onclick = () => { SAVE.settings.diff = d.id; saveGame(); buildDiff(); refreshTitle(); };
    el.appendChild(b);
  }
}

function refreshTitle(){
  const b = bestOf();
  const rec = SAVE.records[track.def.id];
  $('raceSub').textContent = `${RACE_LAPS}周・${track.def.short}${rec && rec.bestFinish ? '・最高 ' + rec.bestFinish + '位' : ''}`;
  $('practiceSub').textContent = b != null ? 'ベスト ' + fmtTime(b) : track.def.short;
}

function setRace(r){
  G.race = r;
  G.others = r.cars.filter(c => !c.player);
}

function showTitle(){
  G.mode = 'title';
  $('title').classList.remove('hidden');
  $('hud').classList.add('hidden');
  $('pause').classList.add('hidden');
  $('results').classList.add('hidden');
  hideBanner();
  // タイトルの裏では、全員が自動でレースをしている
  const r = createRace(track, { diff: 0.92, laps: Infinity, arts, playerArt });
  r.started = true;
  // 少し進めてから見せる（スタート直後の団子を避ける）
  for (let i = 0; i < 60 * 8; i++) stepRace(r, 1 / 60, null);
  r.events.length = 0;
  setRace(r);
  refreshTitle();
}

// ---- レース・練習走行 ----
function start(kind){
  initAudio();
  clearInput();
  G.kind = kind;
  $('title').classList.add('hidden');
  $('pause').classList.add('hidden');
  $('results').classList.add('hidden');
  $('hud').classList.remove('hidden');
  $('hHint').classList.remove('gone');
  hideBanner();
  setRace(createRace(track, {
    diff: diffOf().base,
    laps: kind === 'race' ? RACE_LAPS : Infinity,
    practice: kind === 'practice',
    arts, playerArt,
  }));
  G.mode = 'lights';
  G.lights = 0; G.lightT = 0; G.holdT = 0.5 + Math.random() * 1.2;
  G.hintT = 6;
  G.finishT = 0;
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
  if (r.laps !== Infinity && e.n === r.laps - 1) showBanner('<b>FINAL LAP</b><span>ファイナルラップ</span>', 2000);
}

function onFinish(){
  const r = G.race, g = gaps(r);
  G.mode = 'finished';
  G.finishT = 0;
  showBanner(`<b>FINISH</b><span>${g.pos}位</span>`, 0);
  blip(660, 0.15); setTimeout(() => blip(990, 0.15), 150); setTimeout(() => blip(1320, 0.3), 300);
}

function showResults(){
  const r = G.race;
  simulateToEnd(r);
  hideBanner();
  const rows = results(r);
  const me = rows.find(x => x.car.player);
  const fastest = rows.reduce((m, x) => (x.best != null && (m == null || x.best < m.best) ? x : m), null);
  // 記録
  SAVE.stats.races++;
  if (me.pos === 1) SAVE.stats.wins++;
  if (me.pos <= 3) SAVE.stats.podiums++;
  const rec = SAVE.records[track.def.id] || (SAVE.records[track.def.id] = {});
  if (!rec.bestFinish || me.pos < rec.bestFinish) rec.bestFinish = me.pos;
  saveGame();

  $('rTitle').textContent = `レース結果　${track.def.name}`;
  const moved = PLAYER_GRID - me.pos;
  $('rSummary').innerHTML = `あなた：<b>${me.pos}位</b>（${PLAYER_GRID}番手スタート${moved > 0 ? '・' + moved + '台抜き' : moved < 0 ? '・' + (-moved) + 'つ後退' : ''}）　ベストラップ ${fmtTime(me.best)}`;
  const tbl = $('rTable');
  tbl.innerHTML = '<div class="rrow hd"><span class="p">順位</span><span></span><span>ドライバー</span><span class="t">タイム</span><span class="bl">ベスト</span></div>';
  for (const x of rows){
    const c = x.car;
    const row = document.createElement('div');
    row.className = 'rrow' + (c.player ? ' me' : '');
    const t = x.pos === 1 ? fmtTime(x.time) : typeof x.gap === 'string' ? x.gap : '+' + x.gap.toFixed(3);
    row.innerHTML = `<span class="p">${x.pos}</span><span class="sw" style="background:${c.team.body};box-shadow:inset 0 -5px 0 ${c.team.accent}"></span>` +
      `<span class="nm">${c.driver.name}<small>${c.team.name}</small></span><span class="t">${t}</span>` +
      `<span class="bl${x === fastest ? ' fl' : ''}">${fmtTime(x.best)}</span>`;
    tbl.appendChild(row);
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

$('raceBtn').onclick = () => start('race');
$('practiceBtn').onclick = () => start('practice');
$('pauseBtn').onclick = pause;
$('resumeBtn').onclick = resume;
$('restartBtn').onclick = () => start(G.kind);
$('againBtn').onclick = () => start('race');
$('toTitleBtn').onclick = () => { setEngine(0, 0, false); showTitle(); };
$('quitBtn').onclick = () => { setEngine(0, 0, false); showTitle(); };
$('soundBtn').onclick = () => {
  SAVE.settings.sound = !SAVE.settings.sound;
  setMuted(!SAVE.settings.sound);
  saveGame();
  updateSoundBtn();
};
window.addEventListener('keydown', e => {
  if (e.code === 'Escape' || e.code === 'KeyP'){ G.mode === 'paused' ? resume() : pause(); }
  if (e.code === 'Enter' && G.mode === 'title') start('race');
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
    if (G.finishT > 3) showResults();
  } else {
    // タイトル・結果：自動で走り続ける
    stepRace(r, dt, null);
  }

  for (const e of r.events){
    if (G.mode === 'title' || G.mode === 'results') break;
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

  const racing = G.mode === 'lights' || G.mode === 'race' || G.mode === 'finished' || (G.mode === 'paused');
  if (racing){
    const ge = gearOf(Math.min(1, pct));
    const moving = c.speed > 1;
    const isRace = r.laps !== Infinity;
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
window.T = { G, track, SAVE, CAR, start, showTitle, showResults, pause, resume };
