// 車の動き（自分の車も、タイトル画面で走る車も同じ計算）
import { SEG, ROAD_W, KERB, GRAVEL, STAND } from './track.js';
import { spriteOf } from './sprites.js';
import { CAR_W } from './carart.js';
import { PLAYER_Z } from './render.js';
import { clamp } from './util.js';

// 調整用の値（速さは「最高速に対する割合」で書く）
export const CAR = {
  max: SEG * 60,       // 最高速（ワールド単位/秒）。1秒に60セグメント進む
  accel: 0.2,          // 加速（低速のとき。速くなるほど弱まる）
  brake: 0.6,          // ブレーキ
  steer: 3.0,          // ハンドルで横に動く速さ（道の半幅/秒、最高速のとき）
  cf: 1.05,            // カーブで外に振られる強さ
  scrub: 0.07,         // ハンドルを切っているときの減速
  steerResp: 9,        // ハンドルの反応（大きいほどすぐ切れる）
  grassMax: 0.3, grassDecel: 1.1,      // 芝：この速さを超えると減速
  gravelMax: 0.15, gravelDecel: 1.8,   // グラベル：強く減速
};
export const KMH = 320 / CAR.max;      // 最高速を 320 km/h と表示する

// ギア：各ギアの上限（最高速に対する割合）
const GEARS = [0.2, 0.32, 0.44, 0.55, 0.66, 0.77, 0.88, 1.0];
export function gearOf(pct){
  for (let i = 0; i < GEARS.length; i++){
    if (pct <= GEARS[i] || i === GEARS.length - 1){
      const lo = i ? GEARS[i - 1] : 0;
      const t = clamp((pct - lo) / (GEARS[i] - lo), 0, 1);
      return { gear: i + 1, rpm: i ? 0.5 + 0.5 * t : 0.3 + 0.7 * t };
    }
  }
}

// z：車の位置。off：z から車の先頭までの距離（自分の車は z がカメラの位置なので PLAYER_Z、ライバルは 0）
export function newCar(z, off = PLAYER_Z){
  return { z, off, x: 0, speed: 0, steer: 0, braking: 0, surface: 'road', crash: 0, hit: false, tow: 0, max: CAR.max };
}

// コース上の位置（車の先頭）
export const posOf = (c, track) => (c.z + c.off) % track.length;

// ctl = { steer: -1〜1, brake: true/false, throttle: true/false }
export function updateCar(c, track, ctl, dt){
  // スリップストリーム（前の車の真後ろ）で最高速が少し上がる
  const max = (c.max || CAR.max) * (1 + 0.05 * (c.tow || 0));
  const seg = track.at(c.z + c.off);
  const pct = c.speed / max;

  // ハンドル（押した・離したをなめらかに）
  c.steer += (ctl.steer - c.steer) * Math.min(1, dt * CAR.steerResp);
  c.x += dt * pct * CAR.steer * c.steer;
  // カーブで外へ振られる（右カーブなら左へ）
  c.x -= dt * pct * pct * seg.curve * CAR.cf;

  // アクセル・ブレーキ
  if (ctl.brake){
    c.speed -= CAR.brake * max * dt;
    c.braking = Math.min(1, c.braking + dt * 8);
  } else {
    if (ctl.throttle !== false) c.speed += CAR.accel * max * (1 - pct * pct) * dt;
    c.braking = Math.max(0, c.braking - dt * 6);
  }
  c.speed -= Math.abs(c.steer) * pct * CAR.scrub * max * dt;

  // 路面：縁石・芝・グラベル
  const ax = Math.abs(c.x), side = Math.sign(c.x);
  c.surface = 'road';
  if (ax > 1 && ax <= KERB) c.surface = 'kerb';
  else if (ax > KERB){
    const gravel = seg.gravel === side && ax < GRAVEL + 0.4;
    c.surface = gravel ? 'gravel' : 'grass';
    const lim = gravel ? CAR.gravelMax : CAR.grassMax;
    const dec = gravel ? CAR.gravelDecel : CAR.grassDecel;
    if (c.speed > lim * max) c.speed -= dec * max * dt;
  }

  // 景色にぶつかる
  c.hit = false;
  c.crash = Math.max(0, c.crash - dt);
  if (ax > 1){
    const half = CAR_W / ROAD_W * 0.4;
    // 観客席の手前の壁
    if (seg.stands && seg.stands.includes(side) && ax + half > STAND.a){
      if (c.crash <= 0){ c.speed = Math.min(c.speed, max * 0.3); c.hit = true; }
      c.crash = 0.5;
      c.x = side * (STAND.a - half - 0.02);
    }
    for (const sp of seg.sprites){
      const s = spriteOf(sp);
      if (!s || !s.collide) continue;
      const w = s.ww / ROAD_W;
      const a = s.center ? sp.offset - w / 2 : sp.offset < 0 ? sp.offset - w : sp.offset;
      if (c.x + half > a && c.x - half < a + w){
        if (c.crash <= 0){ c.speed = Math.min(c.speed, max * 0.15); c.hit = true; }
        c.crash = 0.5;
        c.x -= side * 0.08;   // 道のほうへ押し戻す
        break;
      }
    }
  }

  c.speed = clamp(c.speed, 0, max);
  c.x = clamp(c.x, -(GRAVEL + 2.5), GRAVEL + 2.5);
  c.z = (c.z + c.speed * dt) % track.length;
  if (c.z < 0) c.z += track.length;
}

// 自動で走らせる（タイトル画面の車とライバル車）
// カーブ c を曲がりきれる速さ（最高速に対する割合）。grip は道幅を使って曲がる分も含めた値（シミュレーションで決めた）
export const cornerLimit = (curve, grip = 1.42) =>
  Math.abs(curve) < 0.05 ? 1 : Math.min(1, (CAR.steer * grip) / (CAR.cf * Math.abs(curve)));

// コースの各セグメントで「その先を見て出してよい速さ」と「走る線」を、うまさごとに前もって計算しておく
const planCache = new Map();
function planFor(track, skill){
  const key = track.def.id + ':' + skill.toFixed(3);
  let p = planCache.get(key);
  if (p) return p;
  const N = track.N, segs = track.segs;
  const lim = new Float32Array(N), line = new Float32Array(N);
  const dec = CAR.brake * 0.85;            // 最高速に対する割合で計算する
  for (let i = 0; i < N; i++) lim[i] = cornerLimit(segs[i].curve) * skill;
  // 後ろから前へ：v² ≤ (次のセグメントの v)² + 2・減速・距離 を2周まわして行き渡らせる
  const k = 2 * dec * SEG / CAR.max;        // 1セグメント分（割合の2乗の単位）
  for (let pass = 0; pass < 2; pass++){
    for (let i = N - 1; i >= 0; i--){
      const nx = lim[(i + 1) % N];
      const v = Math.sqrt(nx * nx + k);
      if (v < lim[i]) lim[i] = v;
    }
  }
  for (let i = 0; i < N; i++){
    let near = 0;
    for (let j = 1; j <= 24; j++) near += segs[(i + j) % N].curve;
    line[i] = clamp((near / 24) * 0.16, -0.6, 0.6);
  }
  p = { lim, line };
  planCache.set(key, p);
  return p;
}

// targetX を渡すと、走る線の代わりにそこへ寄せる（追い越し・よけるとき）
export function autopilot(c, track, skill = 0.95, targetX = null){
  const max = c.max || CAR.max;
  const pz = c.z + c.off;
  const pct = c.speed / max;
  const seg = track.at(pz);
  const plan = planFor(track, skill);
  const allow = plan.lim[seg.index] * max * (1 + 0.05 * (c.tow || 0));
  // 曲がりの内側に寄せる
  const target = targetX == null ? plan.line[seg.index] : targetX;
  const hold = pct * seg.curve * CAR.cf / CAR.steer;
  const steer = clamp(hold + (target - c.x) * 1.8, -1, 1);
  return { steer, brake: c.speed > allow * 1.02, throttle: c.speed < allow };
}
