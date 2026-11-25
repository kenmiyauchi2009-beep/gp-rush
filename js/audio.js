// 音（すべてコードで作る。最初のタップで鳴らせるようになる）
// レース中：エンジン・タイヤのきしみ・風・芝の振動・縁石・近くの車・雨。メニュー：BGM
let ac = null, master = null, sfx = null, bgmBus = null, eng = null, fx = null, noiseBuf = null;
let muted = false, bgmOn = true;

export function initAudio(){
  if (ac){ if (ac.state === 'suspended') ac.resume().catch(() => {}); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ac = new AC();
  master = ac.createGain();
  master.gain.value = muted ? 0 : 1;
  master.connect(ac.destination);
  sfx = ac.createGain(); sfx.gain.value = 1; sfx.connect(master);
  bgmBus = ac.createGain(); bgmBus.gain.value = 0; bgmBus.connect(master);

  // 白いノイズ（2秒をくり返す）
  noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
  const nd = noiseBuf.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

  // エンジン：のこぎり波と矩形波を混ぜて、こもらせる
  const o1 = ac.createOscillator(); o1.type = 'sawtooth';
  const o2 = ac.createOscillator(); o2.type = 'square';
  const o3 = ac.createOscillator(); o3.type = 'sawtooth';
  const g2 = ac.createGain(); g2.gain.value = 0.35;
  const g3 = ac.createGain(); g3.gain.value = 0.25;
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 3;
  const gain = ac.createGain(); gain.gain.value = 0;
  o1.connect(lp); o2.connect(g2).connect(lp); o3.connect(g3).connect(lp);
  lp.connect(gain).connect(sfx);
  o1.start(); o2.start(); o3.start();
  eng = { o1, o2, o3, lp, gain };

  // 効果音（ずっと鳴らしておき、音量で出し入れする）
  const noise = (type, freq, q) => {
    const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; if (q) f.Q.value = q;
    const g = ac.createGain(); g.gain.value = 0;
    s.connect(f).connect(g).connect(sfx); s.start();
    return g;
  };
  const squeal = noise('bandpass', 2600, 7);
  const wind = noise('highpass', 900);
  const rumble = noise('lowpass', 160);
  const rain = noise('highpass', 1500);
  const kerbO = ac.createOscillator(); kerbO.type = 'square'; kerbO.frequency.value = 38;
  const kerbF = ac.createBiquadFilter(); kerbF.type = 'lowpass'; kerbF.frequency.value = 300;
  const kerb = ac.createGain(); kerb.gain.value = 0;
  kerbO.connect(kerbF).connect(kerb).connect(sfx); kerbO.start();
  // 近くのライバルのエンジン
  const ro = ac.createOscillator(); ro.type = 'sawtooth';
  const rf = ac.createBiquadFilter(); rf.type = 'lowpass'; rf.frequency.value = 1200;
  const rival = ac.createGain(); rival.gain.value = 0;
  ro.connect(rf).connect(rival).connect(sfx); ro.start();
  fx = { squeal, wind, rumble, rain, kerb, ro, rival };
  setBgmPlaying(bgmWanted);
}

const ramp = (param, v, tc = 0.05) => param.setTargetAtTime(v, ac.currentTime, tc);

// rpm：0〜1、load：アクセルを踏んでいるか（0〜1）、on：鳴らすか
export function setEngine(rpm, load, on){
  if (!eng) return;
  const f = 55 + rpm * 420;
  ramp(eng.o1.frequency, f, 0.03);
  ramp(eng.o2.frequency, f * 0.5, 0.03);
  ramp(eng.o3.frequency, f * 1.007, 0.03);
  ramp(eng.lp.frequency, 300 + rpm * 2200 + load * 900);
  ramp(eng.gain.gain, on ? 0.05 + 0.05 * load : 0, 0.08);
}

// s = { on, speed（0〜1）, scrub（0〜1：タイヤのきしみ）, surface, rival（0〜1：近さ）, rivalRpm, rain }
export function setRaceSounds(s){
  if (!fx) return;
  const on = s.on ? 1 : 0;
  ramp(fx.wind.gain, on * 0.05 * s.speed * s.speed, 0.1);
  ramp(fx.squeal.gain, on * 0.06 * s.scrub, 0.05);
  ramp(fx.rumble.gain, on * (s.surface === 'grass' || s.surface === 'gravel' ? 0.35 * Math.max(0.3, s.speed) : 0), 0.05);
  ramp(fx.kerb.gain, on * (s.surface === 'kerb' ? 0.05 : 0), 0.03);
  ramp(fx.rain.gain, on * (s.rain ? 0.035 : 0), 0.3);
  ramp(fx.rival.gain, on * 0.03 * s.rival, 0.08);
  ramp(fx.ro.frequency, 55 + (s.rivalRpm || 0.6) * 420, 0.05);
}

// 短い音（信号・衝突など）
export function blip(freq, dur = 0.15, type = 'sine', vol = 0.2){
  if (!ac) return;
  const t = ac.currentTime;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(sfx);
  o.start(t); o.stop(t + dur + 0.02);
}

export function thud(){
  if (!ac) return;
  const t = ac.currentTime;
  const s = ac.createBufferSource(); s.buffer = noiseBuf;
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.6, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
  s.connect(lp).connect(g).connect(sfx);
  s.start(t); s.stop(t + 0.3);
}

// ピットのインパクトレンチ
export function wrench(){
  if (!ac) return;
  for (let i = 0; i < 3; i++) setTimeout(() => blip(180 + Math.random() * 40, 0.18, 'sawtooth', 0.08), i * 220);
}

export function setMuted(m){
  muted = m;
  if (master) master.gain.setTargetAtTime(m ? 0 : 1, ac.currentTime, 0.02);
}

export function suspendAudio(){ if (ac && ac.state === 'running') ac.suspend().catch(() => {}); }
export function resumeAudio(){ if (ac && ac.state === 'suspended') ac.resume().catch(() => {}); }

// ---- BGM（メニューで流す。コードで作った短い曲をくり返す） ----
// A マイナー、120 BPM。和音は Am → F → C → G をくり返し、後半はアルペジオを変える
const STEP = 60 / 120 / 4;          // 16分音符の長さ（秒）
const CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];   // MIDI の音の高さ
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
let bgmWanted = false, bgmTimer = 0, nextT = 0, step = 0;

export function setBgmEnabled(on){
  bgmOn = on;
  if (bgmBus) ramp(bgmBus.gain, bgmWanted && bgmOn ? 0.16 : 0, 0.3);
}

// メニューを開いたら true、レースが始まったら false
export function setBgmPlaying(on){
  bgmWanted = on;
  if (!ac) return;
  ramp(bgmBus.gain, on && bgmOn ? 0.16 : 0, on ? 0.6 : 0.25);
  if (on && !bgmTimer){
    nextT = ac.currentTime + 0.1;
    bgmTimer = setInterval(schedule, 25);
  }
  if (!on && bgmTimer){
    // 音が消えてから止める
    setTimeout(() => { if (!bgmWanted && bgmTimer){ clearInterval(bgmTimer); bgmTimer = 0; } }, 1200);
  }
}

function note(freq, t, dur, type, vol, cutoff){
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.value = freq;
  let out = o;
  if (cutoff){ const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff; o.connect(f); out = f; }
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  out.connect(g).connect(bgmBus);
  o.start(t); o.stop(t + dur + 0.05);
}
function drum(kind, t){
  if (kind === 'kick'){
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
    g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    o.connect(g).connect(bgmBus); o.start(t); o.stop(t + 0.25);
    return;
  }
  const s = ac.createBufferSource(); s.buffer = noiseBuf;
  const f = ac.createBiquadFilter();
  const g = ac.createGain();
  const hat = kind === 'hat';
  f.type = hat ? 'highpass' : 'bandpass'; f.frequency.value = hat ? 7000 : 1800;
  g.gain.setValueAtTime(hat ? 0.12 : 0.35, t); g.gain.exponentialRampToValueAtTime(0.001, t + (hat ? 0.05 : 0.14));
  s.connect(f).connect(g).connect(bgmBus);
  s.start(t, Math.random()); s.stop(t + 0.2);
}

function schedule(){
  while (nextT < ac.currentTime + 0.12){
    const t = nextT, bar = Math.floor(step / 16) % 8, s = step % 16;
    const ch = CHORDS[bar % 4];
    // ベース（8分音符）
    if (s % 2 === 0){
      const m = ch[0] - 24 + (s === 6 || s === 14 ? 12 : 0);
      note(mtof(m), t, STEP * 1.8, 'triangle', 0.5);
    }
    // 和音（小節の頭で長く）
    if (s === 0) for (const m of ch) note(mtof(m), t, STEP * 15, 'sawtooth', 0.05, 900);
    // アルペジオ（後半は上下に動く）
    const up = [0, 1, 2, 1, 0, 1, 2, 2];
    const idx = bar < 4 ? s % 3 : up[s % 8];
    if (s % 2 === 1 || bar >= 4) note(mtof(ch[idx % 3] + 12 + (bar >= 4 && s % 8 >= 4 ? 12 : 0)), t, STEP * 0.9, 'square', 0.06, 2600);
    // ドラム
    if (s === 0 || s === 8 || (bar % 2 === 1 && s === 10)) drum('kick', t);
    if (s === 4 || s === 12) drum('snare', t);
    if (s % 2 === 0) drum('hat', t);
    nextT += STEP;
    step++;
  }
}
