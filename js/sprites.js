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
export const SPRITES = {};

export function makeSprites(){
  const r = rng(42);
  SPRITES.tree = { cv: tree(r), ww: 1100, collide: true };
  SPRITES.pine = { cv: pine(r), ww: 760, collide: true };
  SPRITES.bush = { cv: bush(r), ww: 900, collide: false };
  SPRITES.grandstand = { cv: grandstand(r), ww: 3400, collide: true };
  SPRITES.tirewall = { cv: tirewall(), ww: 1500, collide: true };
  SPRITES.marshal = { cv: marshal(), ww: 900, collide: true };
  SPRITES.gantry = { cv: gantry(), ww: ROAD_W * 2.5, collide: false, center: true, lights: true };
  for (const n of ['300', '200', '100']) SPRITES['board' + n] = { cv: board(n), ww: 420, collide: true };
  SPONSORS.forEach((s, i) => { SPRITES['billboard' + i] = { cv: billboard(s), ww: 2300, collide: true }; });
}

// 置いた景色の名前から絵を引く（看板は番号で入れ替わる）
export function spriteOf(sp){
  if (sp.name === 'billboard') return SPRITES['billboard' + ((sp.variant || 0) % SPONSORS.length)];
  return SPRITES[sp.name];
}

function tree(r){
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
    gg.addColorStop(0, '#6fbf4a'); gg.addColorStop(0.6, '#3f8f2c'); gg.addColorStop(1, '#2a6a20');
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

function grandstand(r){
  const W = 640, H = 330, c = mk(W, H), g = c.getContext('2d');
  // 屋根
  g.fillStyle = '#dfe4ea'; g.beginPath(); g.moveTo(10, 40); g.lineTo(W - 10, 40); g.lineTo(W - 30, 70); g.lineTo(30, 70); g.closePath(); g.fill();
  g.fillStyle = '#9aa5b1'; g.fillRect(30, 70, W - 60, 6);
  // 柱
  g.fillStyle = '#7d8793';
  for (let x = 40; x < W - 30; x += 140) g.fillRect(x, 70, 10, H - 70);
  // 客席の段と観客
  const rows = 9, top = 82, bot = H - 70;
  for (let i = 0; i < rows; i++){
    const y = top + (bot - top) * i / rows, h = (bot - top) / rows;
    g.fillStyle = i % 2 ? '#3b4656' : '#465365'; g.fillRect(30, y, W - 60, h);
    for (let x = 36; x < W - 36; x += 9){
      if (r() < 0.82){
        g.fillStyle = `hsl(${Math.floor(r() * 360)},${50 + r() * 40}%,${45 + r() * 30}%)`;
        g.fillRect(x, y + h * 0.25, 6, h * 0.55);
        g.fillStyle = '#e9c7a8'; g.fillRect(x + 1, y + h * 0.05, 4, h * 0.28);
      }
    }
  }
  // 手前の壁と広告
  g.fillStyle = '#e6e9ee'; g.fillRect(20, H - 70, W - 40, 70);
  g.fillStyle = '#c8102e'; g.fillRect(20, H - 44, W - 40, 22);
  g.fillStyle = '#ffffff'; g.font = 'bold 18px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('GP RUSH  ·  GREEN VALLEY  ·  GP RUSH', W / 2, H - 33);
  return c;
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
