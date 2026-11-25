// 起動処理とゲームの流れ（タイトル → 信号 → 練習走行）
import { $, toast, fmtTime, rng } from './util.js';
import { SAVE, loadGame, saveGame } from './save.js';
import { setupOffline, offlineStatus } from './offline.js';
import { COURSES, buildTrack, SEG } from './track.js';
import { makeSprites } from './sprites.js';
import { makeCar } from './carart.js';
import { setupRender, resize, render, PLAYER_Z } from './render.js';
import { CAR, KMH, newCar, updateCar, autopilot, gearOf } from './physics.js';
import { setupInput, input, steerInput, clearInput } from './input.js';
import { setupHud, updateHud, drawMap, showDelta, resizeHud } from './hud.js';
import { initAudio, setEngine, blip, thud, setMuted, suspendAudio, resumeAudio } from './audio.js';

// 版の番号（sw.js の VERSION と同じにする）
export const APP_VERSION = '0.1.0';

const loaded = loadGame();
makeSprites();
const track = buildTrack(COURSES.valley);
const playerArt = makeCar({ body: '#d3202b', accent: '#f4f4f4', helmet: '#ffd23f', wing: 'GP RUSH', text: '#d3202b' });

const G = {
  mode: 'title',           // title / lights / race / paused
  before: 'race',          // 一時停止の前の状態
  car: newCar(0),
  skyOff: 0,
  lights: 0, lightT: 0, holdT: 0,
  lap: 1, timing: false, lapT: 0, last: null,
  prevD: 0,
  shake: 0, t: 0,
  hintT: 0,
};
const bestOf = () => SAVE.best[track.def.id] ?? null;

// ---- 画面の準備 ----
setupRender($('cv'));
setupInput($('stage'));
setupHud();
setMuted(!SAVE.settings.sound);
$('titleVer').textContent = '版 ' + APP_VERSION;
const onResize = () => { resize(); resizeHud(); };
window.addEventListener('resize', onResize);
if (window.ResizeObserver) new ResizeObserver(onResize).observe($('stage'));

function refreshTitle(){
  const b = bestOf();
  $('practiceSub').textContent = `${track.def.short}${b != null ? '・ベスト ' + fmtTime(b) : ''}`;
}

function showTitle(){
  G.mode = 'title';
  $('title').classList.remove('hidden');
  $('hud').classList.add('hidden');
  $('pause').classList.add('hidden');
  // タイトルの裏では、車が自動でコースを走る
  const r = rng(Date.now() & 0xffff);
  G.car = newCar(Math.floor(r() * track.N) * SEG);
  G.car.speed = CAR.max * 0.6;
  refreshTitle();
}

// ---- 練習走行 ----
function startPractice(){
  initAudio();
  clearInput();
  $('title').classList.add('hidden');
  $('pause').classList.add('hidden');
  $('hud').classList.remove('hidden');
  $('hHint').classList.remove('gone');
  G.car = newCar(0);
  // スタートラインの30セグメント手前に止める
  G.car.z = (track.startSeg - 30) * SEG - PLAYER_Z + track.length;
  G.car.z %= track.length;
  G.mode = 'lights';
  G.lights = 0; G.lightT = 0; G.holdT = 0.5 + Math.random() * 1.2;
  G.lap = 1; G.timing = false; G.lapT = 0; G.last = null;
  G.prevD = lineDist();
  G.hintT = 6;
}

// 車の先頭からスタートラインまでの距離（ラインを越えると 0 に戻る）
function lineDist(){
  const d = (G.car.z + PLAYER_Z - track.startSeg * SEG) % track.length;
  return d < 0 ? d + track.length : d;
}

function lapDone(){
  if (!G.timing){
    // スタートから最初にラインを越えた：ここから1周目の計測
    G.timing = true; G.lapT = 0;
    return;
  }
  const t = G.lapT, b = bestOf();
  G.last = t;
  if (b == null || t < b){
    SAVE.best[track.def.id] = t;
    saveGame();
    showDelta(b == null ? null : t - b, true);
    if (b != null) toast('ベストラップ更新！ ' + fmtTime(t));
  } else {
    showDelta(t - b, false);
  }
  blip(880, 0.12); setTimeout(() => blip(1320, 0.18), 120);
  G.lap++;
  G.lapT = 0;
}

// ---- 一時停止 ----
async function pause(){
  if (G.mode !== 'race' && G.mode !== 'lights') return;
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

$('practiceBtn').onclick = startPractice;
$('pauseBtn').onclick = pause;
$('resumeBtn').onclick = resume;
$('restartBtn').onclick = startPractice;
$('quitBtn').onclick = () => { setEngine(0, 0, false); showTitle(); };
$('soundBtn').onclick = () => {
  SAVE.settings.sound = !SAVE.settings.sound;
  setMuted(!SAVE.settings.sound);
  saveGame();
  updateSoundBtn();
};
window.addEventListener('keydown', e => {
  if (e.code === 'Escape' || e.code === 'KeyP'){ G.mode === 'paused' ? resume() : pause(); }
  if (e.code === 'Enter' && G.mode === 'title') startPractice();
});

// 裏に回ったら止める
document.addEventListener('visibilitychange', () => {
  if (document.hidden){ if (!G.noAutoPause) pause(); suspendAudio(); saveGame(); }
  else resumeAudio();
});
window.addEventListener('pagehide', saveGame);

// ---- 毎フレームの処理 ----
function update(dt){
  const c = G.car;
  G.t += dt;
  if (G.mode === 'paused') return;

  if (G.mode === 'title'){
    updateCar(c, track, autopilot(c, track, 0.95), dt);
  } else if (G.mode === 'lights'){
    // 信号：1秒ごとに1つずつ点いて、5つ点いたあと少し待って全部消えたらスタート
    G.lightT += dt;
    const want = Math.min(5, Math.floor((G.lightT - 0.6) / 0.9) + 1);
    if (want > G.lights && G.lightT > 0.6){ G.lights = want; blip(520, 0.12, 'square', 0.08); }
    if (G.lights === 5 && G.lightT > 0.6 + 4 * 0.9 + G.holdT){
      G.lights = 0; G.mode = 'race';
      blip(1040, 0.3, 'square', 0.1);
    }
    updateCar(c, track, { steer: 0, brake: false, throttle: false }, dt);
  } else if (G.mode === 'race'){
    // autoDrive は確認用（コンソールで T.G.autoDrive = true にすると自動で走る）
    const ctl = G.autoDrive ? autopilot(c, track, 1) : { steer: steerInput(), brake: input.brake, throttle: true };
    updateCar(c, track, ctl, dt);
    if (c.hit){ thud(); G.shake = 0.35; }
    if (G.timing) G.lapT += dt;
    const d = lineDist();
    if (d < G.prevD - track.length / 2) lapDone();
    G.prevD = d;
    if (G.hintT > 0){ G.hintT -= dt; if (G.hintT <= 0) $('hHint').classList.add('gone'); }
  }

  // 景色の流れ（右カーブでは背景が左へ）
  const seg = track.at(c.z + PLAYER_Z);
  G.skyOff += seg.curve * (c.speed / CAR.max) * dt * 0.035;
  G.shake = Math.max(0, G.shake - dt);
}

let lastT = performance.now();
function frame(now){
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  // 物理は細かく刻む（フレームが落ちても動きが変わらないように）
  const n = Math.max(1, Math.ceil(dt / (1 / 120)));
  for (let i = 0; i < n; i++) update(dt / n);

  const c = G.car, pct = c.speed / CAR.max;
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
    car: playerArt, skyOff: G.skyOff, lights: G.lights, shake, bounce,
  });

  if (G.mode !== 'title'){
    const ge = gearOf(pct);
    const moving = c.speed > 1;
    updateHud({
      lap: G.lap, time: G.timing ? G.lapT : 0, best: bestOf(), last: G.last,
      kmh: c.speed * KMH, gear: moving || G.mode === 'race' ? String(ge.gear) : 'N', rpm: moving ? ge.rpm : (G.mode === 'lights' ? 0.55 + 0.1 * Math.sin(G.t * 9) : 0),
    });
    drawMap(track, c.z + PLAYER_Z);
    if (G.mode === 'race') setEngine(ge.rpm, input.brake ? 0 : 1, true);
    else if (G.mode === 'lights') setEngine(0.35 + 0.08 * Math.sin(G.t * 9), 0.3, true);
  } else {
    setEngine(0, 0, false);
  }
  requestAnimationFrame(frame);
}

showTitle();
requestAnimationFrame(frame);
setupOffline();
if (loaded === 'broken') toast('セーブデータを読めなかったため、新しく始めました（元のデータは別名で保管）', 4000);

// 調整・確認用
window.T = { G, track, SAVE, CAR, startPractice, showTitle, pause, resume };
