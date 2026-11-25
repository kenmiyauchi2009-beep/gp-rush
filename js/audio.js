// 音（すべてコードで作る。最初のタップで鳴らせるようになる）
let ac = null, master = null, eng = null, muted = false;

export function initAudio(){
  if (ac){ if (ac.state === 'suspended') ac.resume().catch(() => {}); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ac = new AC();
  master = ac.createGain();
  master.gain.value = muted ? 0 : 1;
  master.connect(ac.destination);

  // エンジン：のこぎり波と矩形波を混ぜて、こもらせる
  const o1 = ac.createOscillator(); o1.type = 'sawtooth';
  const o2 = ac.createOscillator(); o2.type = 'square';
  const o3 = ac.createOscillator(); o3.type = 'sawtooth';
  const g2 = ac.createGain(); g2.gain.value = 0.35;
  const g3 = ac.createGain(); g3.gain.value = 0.25;
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 3;
  const gain = ac.createGain(); gain.gain.value = 0;
  o1.connect(lp); o2.connect(g2).connect(lp); o3.connect(g3).connect(lp);
  lp.connect(gain).connect(master);
  o1.start(); o2.start(); o3.start();
  eng = { o1, o2, o3, lp, gain };
}

// rpm：0〜1、load：アクセルを踏んでいるか（0〜1）、on：鳴らすか
export function setEngine(rpm, load, on){
  if (!eng) return;
  const t = ac.currentTime, f = 55 + rpm * 420;
  eng.o1.frequency.setTargetAtTime(f, t, 0.03);
  eng.o2.frequency.setTargetAtTime(f * 0.5, t, 0.03);
  eng.o3.frequency.setTargetAtTime(f * 1.007, t, 0.03);
  eng.lp.frequency.setTargetAtTime(300 + rpm * 2200 + load * 900, t, 0.05);
  eng.gain.gain.setTargetAtTime(on ? 0.05 + 0.05 * load : 0, t, 0.08);
}

// 短い音（信号・衝突など）
export function blip(freq, dur = 0.15, type = 'sine', vol = 0.2){
  if (!ac) return;
  const t = ac.currentTime;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

export function thud(){
  if (!ac) return;
  const t = ac.currentTime;
  const len = Math.floor(ac.sampleRate * 0.25);
  const buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  const s = ac.createBufferSource(); s.buffer = buf;
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
  const g = ac.createGain(); g.gain.value = 0.6;
  s.connect(lp).connect(g).connect(master);
  s.start(t);
}

export function setMuted(m){
  muted = m;
  if (master) master.gain.setTargetAtTime(m ? 0 : 1, ac.currentTime, 0.02);
}

export function suspendAudio(){ if (ac && ac.state === 'running') ac.suspend().catch(() => {}); }
export function resumeAudio(){ if (ac && ac.state === 'suspended') ac.resume().catch(() => {}); }
