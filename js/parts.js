// マシンのパーツ：部位・レア度・レベル・付与効果と、そこから決まる車の性能
import { SPONSORS } from './sprites.js';

export const SLOTS = [
  { id: 'engine',  name: 'エンジン',     stat: 'top',    label: '最高速' },
  { id: 'gearbox', name: 'ギアボックス', stat: 'accel',  label: '加速' },
  { id: 'aero',    name: '空力',         stat: 'corner', label: 'コーナー' },
  { id: 'tyres',   name: 'タイヤ',       stat: 'grip',   label: 'グリップ' },
  { id: 'brakes',  name: 'ブレーキ',     stat: 'brake',  label: 'ブレーキ' },
];
export const slotOf = id => SLOTS.find(s => s.id === id);

// レア度（0 は最初から付いているノーマル）
export const RARITY = [
  { name: 'ノーマル',   color: '#8a93a3', k: 0,    affixes: [0, 0] },
  { name: 'コモン',     color: '#c9d1dc', k: 0.2,  affixes: [0, 0] },
  { name: 'アンコモン', color: '#4cc96b', k: 0.4,  affixes: [1, 1] },
  { name: 'レア',       color: '#3f8cff', k: 0.6,  affixes: [1, 2] },
  { name: 'エピック',   color: '#b45cff', k: 0.8,  affixes: [2, 2] },
  { name: 'レジェンド', color: '#ffb020', k: 1.0,  affixes: [3, 3] },
];
const GRADE = ['ノーマル', 'ストリート', 'スポーツ', 'レーシング', 'ワークス', 'プロトタイプ'];

// 性能の種類と、レジェンド・レベル10のときの最大値（割合）
export const STATS = {
  top:    { name: '最高速',            max: 0.05, fmt: v => `+${(v * 100).toFixed(1)}%` },
  accel:  { name: '加速',              max: 0.2, fmt: v => `+${Math.round(v * 100)}%` },
  corner: { name: 'コーナー',          max: 0.1, fmt: v => `+${Math.round(v * 100)}%` },
  grip:   { name: 'グリップ',          max: 0.08, fmt: v => `+${Math.round(v * 100)}%` },
  brake:  { name: 'ブレーキ',          max: 0.25, fmt: v => `+${Math.round(v * 100)}%` },
  grass:  { name: '芝・グラベルで減速しにくい', max: 0.35, fmt: v => `+${Math.round(v * 100)}%` },
  tow:    { name: 'スリップストリーム', max: 0.6,  fmt: v => `+${Math.round(v * 100)}%` },
  bump:   { name: '接触に強い',        max: 0.5,  fmt: v => `+${Math.round(v * 100)}%` },
};
// 付与効果は主な性能の 1/3 くらいの強さ
const AFFIX_SCALE = { top: 0.33, accel: 0.33, corner: 0.33, grip: 0.33, brake: 0.33, grass: 1, tow: 1, bump: 1 };

export const MAX_LV = 10;
const levelF = lv => 0.55 + 0.045 * lv;            // レベル1：約0.6 → レベル10：1.0

// パーツの性能（{ 性能の種類: 値 }）
export function partStats(p){
  const out = {};
  const r = RARITY[p.r], lf = levelF(p.lv);
  const main = slotOf(p.slot).stat;
  out[main] = STATS[main].max * r.k * lf;
  for (const a of p.aff || []){
    out[a.k] = (out[a.k] || 0) + STATS[a.k].max * AFFIX_SCALE[a.k] * a.q * lf;
  }
  return out;
}

// 装着しているパーツを合わせた性能
export function totalStats(garage){
  const t = {};
  for (const k of Object.keys(STATS)) t[k] = 0;
  for (const s of SLOTS){
    const p = garage.parts.find(x => x.id === garage.equip[s.id]);
    if (!p) continue;
    const st = partStats(p);
    for (const [k, v] of Object.entries(st)) t[k] += v;
  }
  return t;
}

// 戦力（見やすい数字にまとめたもの）
export function powerOf(stats){
  let p = 1000;
  for (const [k, v] of Object.entries(stats)) p += (v / STATS[k].max) * (k in AFFIX_SCALE && AFFIX_SCALE[k] === 1 ? 80 : 300);
  return Math.round(p);
}

// 1つのパーツの戦力（比べる用）
export const partPower = p => powerOf(partStats(p)) - 1000;

// 新しいパーツを作る（rng：0〜1 の乱数）
export function makePart(garage, slot, r, rng = Math.random){
  const [lo, hi] = RARITY[r].affixes;
  const n = lo + Math.floor(rng() * (hi - lo + 1));
  const main = slotOf(slot).stat;
  const pool = Object.keys(STATS).filter(k => k !== main);
  const aff = [];
  for (let i = 0; i < n && pool.length; i++){
    const k = pool.splice(Math.floor(rng() * pool.length), 1)[0];
    aff.push({ k, q: 0.5 + rng() * 0.5 });
  }
  const brand = SPONSORS[Math.floor(rng() * SPONSORS.length)].name.split(' ')[0];
  const p = { id: ++garage.nextId, slot, r, lv: 1, aff, brand, isNew: true };
  return p;
}

export const partName = p => (p.r === 0 ? `ノーマル${slotOf(p.slot).name}` : `${p.brand} ${GRADE[p.r]}${slotOf(p.slot).name}`);

// 強化と分解の値段
export const upgradeCost = p => Math.round(60 * (p.r + 1) * p.lv);
export const scrapValue = p => Math.round(40 * (p.r + 1) * (1 + (p.lv - 1) * 0.5));

export function newGarage(){
  const g = { equip: {}, parts: [], nextId: 0 };
  for (const s of SLOTS){
    const p = { id: ++g.nextId, slot: s.id, r: 0, lv: 1, aff: [], brand: '' };
    g.parts.push(p);
    g.equip[s.id] = p.id;
  }
  return g;
}

export const INV_MAX = 40;

// ---- 賞金とパーツのもらえ方 ----
const PRIZE = [1200, 950, 800, 680, 580, 500, 430, 370, 320, 280, 240, 210, 190, 170, 160, 150, 140, 130, 120, 110];
export function prizeFor(pos, { season = false, pole = false, fastest = false } = {}){
  let cr = PRIZE[pos - 1] || 100;
  if (season) cr = Math.round(cr * 1.5);
  const bonus = (pole ? 200 : 0) + (fastest ? 150 : 0);
  return { cr: cr + bonus, base: cr, bonus };
}

// 順位で変わるレア度の出やすさ（コモン〜レジェンド）
export function dropRarity(pos, rng = Math.random){
  const w = pos <= 1 ? [10, 30, 32, 20, 8] : pos <= 3 ? [20, 35, 28, 13, 4] : pos <= 10 ? [40, 35, 18, 6, 1] : [60, 30, 9, 1, 0];
  let x = rng() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < w.length; i++){ if ((x -= w[i]) < 0) return i + 1; }
  return 1;
}

// ショップのパーツ箱
export const BOXES = [
  { id: 'basic',  name: 'スポーツの箱',     price: 500,  w: [55, 35, 10, 0, 0] },
  { id: 'racing', name: 'レーシングの箱',   price: 1500, w: [0, 45, 40, 15, 0] },
  { id: 'works',  name: 'ワークスの箱',     price: 4000, w: [0, 0, 50, 40, 10] },
];
export function boxRarity(box, rng = Math.random){
  let x = rng() * box.w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < box.w.length; i++){ if ((x -= box.w[i]) < 0) return i + 1; }
  return 1;
}
export const randomSlot = (rng = Math.random) => SLOTS[Math.floor(rng() * SLOTS.length)].id;
