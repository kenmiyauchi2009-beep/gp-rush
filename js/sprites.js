// 景色の絵（起動時にコードで描いて、小さなキャンバスに取っておく）
import { rng } from './util.js';
import { ROAD_W } from './track.js';

// 架空のスポンサー（実在の会社名は使わない）
export const SPONSORS = [
  { name: 'SORANO', bg: '#0f2f6b', fg: '#ffffff', ac: '#ffcc00' },
  { name: 'ORBIX', bg: '#e8e8e8', fg: '#c8102e', ac: '#1a1a1a' },
  { name: 'RAIKO OIL', bg: '#111111', fg: '#ffb000', ac: '#ff4d00' },
  { name: 'NUVEL', bg: '#00a37a', fg: '#ffffff', ac: '#003b2c' },
  { name: 'ZEFFA', bg: '#6a1fb5', fg: '#ffffff', ac: '#ff5ac8' },
  { name: 'KAZEMI TYRES', bg: '#ffd400', fg: '#111111', ac: '#d40000' },
];

const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const rr = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); };

// name → { cv, ww（ワールドでの幅）, collide（ぶつかるか）, center（真ん中に置くか） }
// テーマ（サーキット）ごとに作り、夕方・夜は色味をかけておく。いま使うテーマの絵が SPRITES に入る。
export const SPRITES = {};
const cache = new Map();

const TREE_COLS = {
  tree: ['#6fbf4a', '#3f8f2c', '#2a6a20'],
  sakura: ['#ffe1ee', '#f5a9c8', '#d97fa6'],
  autumn: ['#ffc15a', '#e8742a', '#a8461d'],
};

function build(theme){
  const r = rng(42);
  const S = {};
  S.tree = { cv: tree(r, TREE_COLS.tree), ww: 1100, collide: true };
  S.sakura = { cv: tree(r, TREE_COLS.sakura), ww: 1150, collide: true };
  S.autumn = { cv: tree(r, TREE_COLS.autumn), ww: 1100, collide: true };
  S.pine = { cv: pine(r), ww: 760, collide: true };
  S.bush = { cv: bush(r), ww: 900, collide: false };
  S.palm = { cv: palm(r), ww: 1000, collide: true };
  S.cactus = { cv: cactus(), ww: 520, collide: true };
  S.rock = { cv: rock(r), ww: 900, collide: true };
  S.lamp = { cv: lamp(), ww: 700, collide: true, glow: true };
  S.tirewall = { cv: tirewall(), ww: 1500, collide: true };
  S.marshal = { cv: marshal(), ww: 900, collide: true };
  S.gantry = { cv: gantry(), ww: ROAD_W * 2.5, collide: false, center: true, lights: true };
  for (const n of ['300', '200', '100']) S['board' + n] = { cv: board(n), ww: 420, collide: true };
  SPONSORS.forEach((sp, i) => { S['billboard' + i] = { cv: billboard(sp), ww: 2300, collide: true }; });
  // 夕方・夜の色味をかける（街灯の光はあとから明るく描き直す）
  if (theme.tint){
    const [col, k] = theme.tint;
    for (const [name, sp] of Object.entries(S)){
      const g = sp.cv.getContext('2d');
      g.globalCompositeOperation = 'source-atop';
      g.globalAlpha = k;
      g.fillStyle = col;
      g.fillRect(0, 0, sp.cv.width, sp.cv.height);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
      if (name === 'lamp') lampGlow(g, sp.cv.width, sp.cv.height);
    }
  }
  // 道の左側の街灯は左右を反転（腕が道のほうを向くように）
  const f = mk(S.lamp.cv.width, S.lamp.cv.height), fg = f.getContext('2d');
  fg.translate(f.width, 0); fg.scale(-1, 1); fg.drawImage(S.lamp.cv, 0, 0);
  S.lampL = { cv: f, ww: S.lamp.ww, collide: true };
  return S;
}

// サーキットを替えたら呼ぶ
export function useTheme(theme){
  let S = cache.get(theme);
  if (!S){ S = build(theme); cache.set(theme, S); }
  for (const k of Object.keys(SPRITES)) delete SPRITES[k];
  Object.assign(SPRITES, S);
}

// 置いた景色の名前から絵を引く（看板は番号で入れ替わる）
export function spriteOf(sp){
  if (sp.name === 'billboard') return SPRITES['billboard' + ((sp.variant || 0) % SPONSORS.length)];
  return SPRITES[sp.name];
}

function tree(r, cols){
  const W = 260, H = 330, c = mk(W, H), g = c.getContext('2d');
  // 幹
  const tg = g.createLinearGradient(W / 2 - 14, 0, W / 2 + 14, 0);
  tg.addColorStop(0, '#4a2f1a'); tg.addColorStop(1, '#6e4a2b');
  g.fillStyle = tg; g.fillRect(W / 2 - 13, H * 0.55, 26, H * 0.45);
  // 葉（丸をいくつも重ねる）
  const blobs = [];
  for (let i = 0; i < 14; i++){
    const a = r() * Math.PI * 2, d = r() * 70;
    blobs.push([W / 2 + Math.cos(a) * d * 1.1, H * 0.38 + Math.sin(a) * d * 0.9, 50 + r() * 34]);
  }
  blobs.sort((a, b) => a[1] - b[1]);
  for (const [x, y, rad] of blobs){
    const gg = g.createRadialGradient(x - rad * 0.35, y - rad * 0.45, rad * 0.1, x, y, rad);
    gg.addColorStop(0, cols[0]); gg.addColorStop(0.6, cols[1]); gg.addColorStop(1, cols[2]);
    g.fillStyle = gg; g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
  }
  return c;
}

function pine(r){
  const W = 200, H = 360, c = mk(W, H), g = c.getContext('2d');
  g.fillStyle = '#4b311c'; g.fillRect(W / 2 - 9, H * 0.78, 18, H * 0.22);
  const layers = 5;
  for (let i = 0; i < layers; i++){
    const t = i / (layers - 1);
    const top = H * (0.02 + t * 0.17), bot = H * (0.32 + t * 0.5), half = W * (0.22 + t * 0.28);
    const gg = g.createLinearGradient(W / 2 - half, 0, W / 2 + half, 0);
    gg.addColorStop(0, '#1f5a2c'); gg.addColorStop(0.55, '#2f7a3a'); gg.addColorStop(1, '#174424');
    g.fillStyle = gg;
    g.beginPath(); g.moveTo(W / 2, top); g.lineTo(W / 2 + half, bot); g.lineTo(W / 2 - half, bot); g.closePath(); g.fill();
  }
  return c;
}

function bush(r){
  const W = 260, H = 120, c = mk(W, H), g = c.getContext('2d');
  for (let i = 0; i < 9; i++){
    const x = 40 + r() * (W - 80), rad = 30 + r() * 26, y = H - rad * 0.7;
    const gg = g.createRadialGradient(x - 8, y - 12, 4, x, y, rad);
    gg.addColorStop(0, '#79c255'); gg.addColorStop(1, '#2f7426');
    g.fillStyle = gg; g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
  }
  return c;
}

function palm(r){
  const W = 280, H = 420, c = mk(W, H), g = c.getContext('2d');
  // 少し曲がった幹
  g.strokeStyle = '#8a6a44'; g.lineCap = 'round';
  for (let i = 0; i < 12; i++){
    const t0 = i / 12, t1 = (i + 1) / 12;
    const x = t => W / 2 + Math.sin(t * 1.6) * 26 - 13, y = t => H - t * H * 0.72;
    g.lineWidth = 22 - i * 0.9;
    g.beginPath(); g.moveTo(x(t0), y(t0)); g.lineTo(x(t1), y(t1)); g.stroke();
    g.strokeStyle = i % 2 ? '#8a6a44' : '#7a5c3a';
  }
  // 葉
  const tx = W / 2 + Math.sin(1.6) * 26 - 13, ty = H * 0.28;
  for (let i = 0; i < 9; i++){
    const a = -Math.PI + (i / 8) * Math.PI + (r() - 0.5) * 0.2;
    const len = 110 + r() * 30;
    g.strokeStyle = i % 2 ? '#2f7d32' : '#3f9a3c'; g.lineWidth = 16;
    g.beginPath(); g.moveTo(tx, ty);
    g.quadraticCurveTo(tx + Math.cos(a) * len * 0.6, ty + Math.sin(a) * len * 0.6 - 30, tx + Math.cos(a) * len, ty + Math.sin(a) * len * 0.5 + 40);
    g.stroke();
  }
  g.fillStyle = '#5a3d22'; g.beginPath(); g.arc(tx, ty + 6, 12, 0, Math.PI * 2); g.fill();
  return c;
}

function cactus(){
  const W = 160, H = 300, c = mk(W, H), g = c.getContext('2d');
  const gg = g.createLinearGradient(0, 0, W, 0);
  gg.addColorStop(0, '#2f6b35'); gg.addColorStop(0.5, '#4f9a4a'); gg.addColorStop(1, '#2a5c30');
  g.fillStyle = gg;
  rr(g, W / 2 - 22, 20, 44, H - 20, 22); g.fill();
  rr(g, 14, 110, 30, 100, 15); g.fill(); rr(g, 14, 190, 60, 24, 12); g.fill();
  rr(g, W - 44, 70, 30, 90, 15); g.fill(); rr(g, W - 74, 140, 60, 24, 12); g.fill();
  return c;
}

function rock(r){
  const W = 260, H = 150, c = mk(W, H), g = c.getContext('2d');
  const gg = g.createLinearGradient(0, 0, 0, H);
  gg.addColorStop(0, '#b9a58a'); gg.addColorStop(1, '#6f5f4c');
  g.fillStyle = gg;
  g.beginPath(); g.moveTo(10, H);
  const n = 9;
  for (let i = 0; i <= n; i++){
    const x = 10 + (W - 20) * i / n, y = H * (0.2 + 0.5 * Math.pow(Math.abs(i / n - 0.5) * 2, 1.6)) + (r() - 0.5) * 18;
    g.lineTo(x, y);
  }
  g.lineTo(W - 10, H); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(W * 0.35, H * 0.3); g.lineTo(W * 0.45, H * 0.8); g.stroke();
  return c;
}

// 街灯（道のほうへ腕が出ている。光は lampGlow で描く）
function lamp(){
  const W = 200, H = 520, c = mk(W, H), g = c.getContext('2d');
  g.fillStyle = '#4c5563';
  g.fillRect(W - 40, 40, 14, H - 40);
  g.fillRect(40, 40, W - 66, 10);
  rr(g, 24, 36, 60, 22, 8); g.fillStyle = '#2b313b'; g.fill();
  lampGlow(g, W, H);
  return c;
}
function lampGlow(g, W, H){
  const gg = g.createRadialGradient(54, 62, 2, 54, 62, 40);
  gg.addColorStop(0, 'rgba(255,250,220,1)'); gg.addColorStop(0.35, 'rgba(255,226,150,0.8)'); gg.addColorStop(1, 'rgba(255,200,120,0)');
  g.fillStyle = gg; g.fillRect(10, 22, 90, 80);
}

function billboard(s){
  const W = 520, H = 250, c = mk(W, H), g = c.getContext('2d');
  g.fillStyle = '#6b7380'; g.fillRect(70, 120, 16, H - 120); g.fillRect(W - 86, 120, 16, H - 120);
  rr(g, 6, 6, W - 12, 150, 8); g.fillStyle = '#20252e'; g.fill();
  rr(g, 14, 14, W - 28, 134, 5); g.fillStyle = s.bg; g.fill();
  g.fillStyle = s.ac; g.fillRect(14, 120, W - 28, 10);
  g.fillStyle = s.fg; g.font = '900 italic 66px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  let size = 66;
  while (g.measureText(s.name).width > W - 70 && size > 30){ size -= 4; g.font = `900 italic ${size}px sans-serif`; }
  g.fillText(s.name, W / 2, 70);
  return c;
}

function tirewall(){
  const W = 420, H = 120, c = mk(W, H), g = c.getContext('2d');
  const cols = 9, rows = 3, cw = W / cols, rh = H / rows;
  for (let row = 0; row < rows; row++){
    for (let col = 0; col < cols; col++){
      const x = col * cw + cw / 2, y = row * rh + rh / 2;
      g.fillStyle = '#16181b'; g.beginPath(); g.ellipse(x, y, cw / 2 - 1, rh / 2 - 1, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#2a2e33'; g.beginPath(); g.ellipse(x, y, cw / 4, rh / 4, 0, 0, Math.PI * 2); g.fill();
    }
  }
  // 上の帯（赤白）
  for (let col = 0; col < cols; col++){
    g.fillStyle = col % 2 ? '#e8e8e8' : '#d8262b';
    g.fillRect(col * cw, 4, cw, 12);
  }
  return c;
}

function board(label){
  const W = 120, H = 300, c = mk(W, H), g = c.getContext('2d');
  g.fillStyle = '#8a929c'; g.fillRect(W / 2 - 6, 120, 12, H - 120);
  rr(g, 4, 4, W - 8, 130, 8); g.fillStyle = '#ffffff'; g.fill();
  rr(g, 12, 12, W - 24, 114, 5); g.fillStyle = '#1b4fbf'; g.fill();
  g.fillStyle = '#ffffff'; g.font = '900 52px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(label, W / 2, 70, W - 28);
  return c;
}

function marshal(){
  const W = 240, H = 240, c = mk(W, H), g = c.getContext('2d');
  g.fillStyle = '#f07c12'; g.fillRect(30, 90, 150, 150);
  g.fillStyle = '#ffffff'; g.fillRect(30, 70, 150, 26);
  g.fillStyle = '#2b3442'; g.fillRect(50, 120, 110, 50);
  g.fillStyle = '#9fd0ff'; g.fillRect(56, 126, 98, 38);
  // 旗
  g.fillStyle = '#ccc'; g.fillRect(196, 20, 6, 220);
  g.fillStyle = '#ffd400'; g.fillRect(202, 22, 34, 24);
  g.fillStyle = '#2a9d3a'; g.fillRect(202, 46, 34, 24);
  return c;
}

// スタートのやぐら。信号の丸は描画のときに上から重ねる（GANTRY_LIGHTS の位置）
export const GANTRY_LIGHTS = { ys: [0.2, 0.37], r: 0.022, xs: [0.36, 0.43, 0.5, 0.57, 0.64] };
function gantry(){
  const W = 1000, H = 420, c = mk(W, H), g = c.getContext('2d');
  // 柱
  const pg = g.createLinearGradient(0, 0, 40, 0);
  pg.addColorStop(0, '#8f98a3'); pg.addColorStop(1, '#c9d0d8');
  g.fillStyle = pg; g.fillRect(20, 40, 40, H - 40); g.fillRect(W - 60, 40, 40, H - 40);
  // 梁
  g.fillStyle = '#2a3140'; g.fillRect(10, 40, W - 20, 150);
  g.fillStyle = '#c8102e'; g.fillRect(10, 40, W - 20, 22);
  g.fillStyle = '#ffffff'; g.font = '900 italic 20px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('START  ·  FINISH', W / 2, 52);
  // 信号の箱
  const L = GANTRY_LIGHTS;
  for (const fx of L.xs){
    rr(g, fx * W - 30, 66, 60, 118, 10); g.fillStyle = '#0c0f14'; g.fill();
  }
  // 横の広告
  g.fillStyle = '#ffd23f'; g.font = '900 italic 40px sans-serif';
  g.fillText('GP RUSH', W * 0.16, 125);
  g.fillText('GP RUSH', W * 0.84, 125);
  // 消えている信号
  for (const fx of L.xs) for (const fy of L.ys){
    g.fillStyle = '#2a0c0c'; g.beginPath(); g.arc(fx * W, fy * H, L.r * W, 0, Math.PI * 2); g.fill();
  }
  return c;
}
