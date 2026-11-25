// 擬似3Dの描画
// 道を手前から奥へ輪切り（セグメント）で描き、景色と車は奥から手前へ重ねる。
import { SEG, ROAD_W, KERB, GRAVEL } from './track.js';
import { spriteOf, GANTRY_LIGHTS } from './sprites.js';
import { CAR_W, carFrame, drawBrakeGlow } from './carart.js';

export const CAM = {
  height: 1000,                                // カメラの高さ
  depth: 1 / Math.tan(50 * Math.PI / 180),     // 視野 100°
  dist: 280,                                   // 何セグメント先まで描くか
};
export const PLAYER_Z = CAM.height * CAM.depth;   // カメラから自分の車までの距離

const V = { cv: null, g: null, W: 0, H: 0, K: 0, HOR: 0, dpr: 1, layers: null, fogRgb: [0, 0, 0], fogHex: '' };

export function setupRender(cv){
  V.cv = cv;
  V.g = cv.getContext('2d', { alpha: false });
  resize();
}

// 画面の大きさが変わったら測り直す
export function resize(){
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = V.cv.clientWidth || window.innerWidth, h = V.cv.clientHeight || window.innerHeight;
  const W = Math.max(1, Math.round(w * dpr)), H = Math.max(1, Math.round(h * dpr));
  if (W === V.W && H === V.H && dpr === V.dpr) return;
  V.W = W; V.H = H; V.dpr = dpr;
  V.cv.width = W; V.cv.height = H;
  // K：1単位あたりのピクセル数の元。横長の画面でも縦長の画面でも、車が画面の下に来るように決める
  V.K = Math.min(H * 0.6, W * 0.3);
  V.HOR = H - V.K - H * 0.035;
  V.layers = null;
}
export const view = V;

// ---- 色（遠くほど霧の色に近づける） ----
const hexRgb = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const fogCache = new Map();
function fogC(hex, f){
  const q = Math.round(f * 24);
  if (q <= 0) return hex;
  const key = hex + V.fogHex + q;
  let c = fogCache.get(key);
  if (!c){
    const a = hexRgb(hex), b = V.fogRgb, t = q / 24;
    c = `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;
    fogCache.set(key, c);
  }
  return c;
}
const fogAt = n => { const t = n / CAM.dist; return Math.min(1, t * t * 1.15) * 0.92; };

// ---- 背景（雲・山・丘）。横につながる絵を作って、カーブに合わせて横に流す ----
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); return c; };

function ridge(g, TW, h, top, amp, waves, seed, fill){
  // 横につながるように、周期が幅の整数分の1の波だけを足す
  const ph = waves.map((_, i) => (Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453) % (Math.PI * 2));
  g.fillStyle = fill;
  g.beginPath(); g.moveTo(0, h);
  for (let x = 0; x <= TW; x += 3){
    let y = 0;
    waves.forEach(([k, a], i) => { y += a * Math.sin((x / TW) * Math.PI * 2 * k + ph[i]); });
    g.lineTo(x, top + amp * y);
  }
  g.lineTo(TW, h); g.closePath(); g.fill();
}

function buildLayers(def){
  const { W, H, g } = V;
  V.fogHex = def.fog; V.fogRgb = hexRgb(def.fog);
  const TW = Math.ceil(W * 1.6);
  const sky = g.createLinearGradient(0, 0, 0, V.HOR);
  sky.addColorStop(0, def.sky[0]); sky.addColorStop(0.6, def.sky[1]); sky.addColorStop(1, def.sky[2]);

  // 雲
  const clouds = mk(TW, Math.round(H * 0.45));
  {
    const c = clouds.getContext('2d');
    let s = 7;
    const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    // 横に平たい雲（ぼかした楕円を重ねる）
    for (let i = 0; i < 9; i++){
      const cx = r() * TW, cy = clouds.height * (0.15 + r() * 0.6), w = W * (0.12 + r() * 0.16);
      const puffs = 5 + Math.floor(r() * 4);
      const ps = [];
      for (let j = 0; j < puffs; j++) ps.push([(r() - 0.5) * w, (r() - 0.5) * w * 0.12, w * (0.16 + r() * 0.14)]);
      for (const ox of [-TW, 0, TW]){
        for (const [px, py, rad] of ps){
          c.save();
          c.translate(cx + ox + px, cy + py);
          c.scale(1, 0.42);
          const gg = c.createRadialGradient(0, -rad * 0.2, rad * 0.05, 0, 0, rad);
          gg.addColorStop(0, 'rgba(255,255,255,0.75)'); gg.addColorStop(0.55, 'rgba(255,255,255,0.45)'); gg.addColorStop(1, 'rgba(255,255,255,0)');
          c.fillStyle = gg; c.fillRect(-rad, -rad, rad * 2, rad * 2);
          c.restore();
        }
      }
    }
  }

  // 遠くの山
  const mts = mk(TW, Math.round(H * 0.3));
  {
    const c = mts.getContext('2d'), h = mts.height;
    const gg = c.createLinearGradient(0, 0, 0, h);
    gg.addColorStop(0, '#7f97b8'); gg.addColorStop(1, def.fog);
    ridge(c, TW, h, h * 0.45, h * 0.3, [[2, 0.5], [3, 0.35], [7, 0.18], [13, 0.08]], 3, gg);
  }
  // 手前の丘（木の並び）
  const hills = mk(TW, Math.round(H * 0.16));
  {
    const c = hills.getContext('2d'), h = hills.height;
    const gg = c.createLinearGradient(0, 0, 0, h);
    gg.addColorStop(0, '#4d8a43'); gg.addColorStop(1, '#8bb98a');
    ridge(c, TW, h, h * 0.45, h * 0.25, [[3, 0.5], [5, 0.3], [11, 0.15]], 9, gg);
    // 手前の森（細かいギザギザの濃い緑）
    const fg = c.createLinearGradient(0, h * 0.4, 0, h);
    fg.addColorStop(0, '#2f6a35'); fg.addColorStop(1, '#5d9a58');
    ridge(c, TW, h, h * 0.72, h * 0.16, [[4, 0.45], [29, 0.2], [47, 0.14], [71, 0.1]], 5, fg);
  }
  return { def, sky, clouds, mts, hills, TW };
}

function drawLayer(cv, off, bottom){
  const { g, W } = V;
  const TW = cv.width, y = Math.round(bottom - cv.height);
  let x = -(((off % TW) + TW) % TW);
  for (; x < W; x += TW) g.drawImage(cv, Math.floor(x), y);
}

function drawBackground(skyOff, playerY){
  const { g, W, H, HOR } = V, L = V.layers;
  g.fillStyle = L.sky; g.fillRect(0, 0, W, HOR + 2);
  // 地平線より下（道が下っているときに見える部分）
  g.fillStyle = fogC(L.def.grass[0], 0.75); g.fillRect(0, HOR, W, H - HOR);
  const lift = -playerY / SEG * H * 0.004;
  drawLayer(L.clouds, skyOff * W * 0.12, HOR * 0.75 + lift * 0.3);
  drawLayer(L.mts, skyOff * W * 0.3, HOR + 2 + lift * 0.6);
  drawLayer(L.hills, skyOff * W * 0.6, HOR + 3 + lift);
}

// ---- 道 ----
function project(p, cx, cy, cz){
  p.camera.x = -cx;
  p.camera.y = p.world.y - cy;
  p.camera.z = p.world.z - cz;
  const s = p.screen.scale = CAM.depth / p.camera.z;
  p.screen.x = V.W / 2 + s * p.camera.x * V.K;
  p.screen.y = Math.round(V.HOR - s * p.camera.y * V.K);
  p.screen.w = s * ROAD_W * V.K;
}

function poly(x1, y1, x2, y2, x3, y3, x4, y4, color){
  const g = V.g;
  g.fillStyle = color;
  g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.lineTo(x3, y3); g.lineTo(x4, y4); g.closePath(); g.fill();
}

// 道の上の帯（a〜b は道の半幅に対する位置。-1 が左端、1 が右端）
// 下の辺を1ピクセル伸ばして、手前のセグメントとの継ぎ目に隙間が見えないようにする
function band(seg, a, b, color){
  const p1 = seg.p1.screen, p2 = seg.p2.screen, y1 = p1.y + 1;
  poly(p1.x + p1.w * a, y1, p1.x + p1.w * b, y1, p2.x + p2.w * b, p2.y, p2.x + p2.w * a, p2.y, color);
}

function drawSegment(seg){
  const g = V.g, f = seg.fog, c = seg.color;
  const p1 = seg.p1.screen, p2 = seg.p2.screen;
  // 芝
  g.fillStyle = fogC(c.grass, f);
  g.fillRect(0, p2.y, V.W, p1.y - p2.y + 1);
  // グラベル（コーナーの外側）
  if (seg.gravel < 0) band(seg, -GRAVEL, -KERB, fogC(c.gravel, f));
  if (seg.gravel > 0) band(seg, KERB, GRAVEL, fogC(c.gravel, f));
  // 縁石
  band(seg, -KERB, -1, fogC(c.kerb, f));
  band(seg, 1, KERB, fogC(c.kerb, f));
  // 路面
  band(seg, -1, 1, fogC(c.road, f));
  // 白線
  if (p1.w > 2){
    band(seg, -0.985, -0.95, fogC(c.line, f));
    band(seg, 0.95, 0.985, fogC(c.line, f));
  }
  // スタートライン（市松模様）
  if (seg.special === 'start' || seg.special === 'start2'){
    const n = 14, odd = seg.special === 'start2' ? 1 : 0;
    for (let i = 0; i < n; i++){
      const a = -0.95 + 1.9 * i / n, b = -0.95 + 1.9 * (i + 1) / n;
      band(seg, a, b, fogC((i + odd) % 2 ? '#f4f4f4' : '#1a1a1a', f));
    }
  }
}

// ---- 景色の絵 ----
function drawSprite(cv, ww, scale, x, y, ox, clipY, alpha){
  const g = V.g;
  const w = ww * scale * V.K;
  const h = w * cv.height / cv.width;
  const dx = x + w * ox, dy = y - h;
  if (dx > V.W || dx + w < 0 || w < 1) return null;
  const clipH = clipY ? Math.max(0, dy + h - clipY) : 0;
  if (clipH >= h) return null;
  if (alpha < 1) g.globalAlpha = alpha;
  g.drawImage(cv, 0, 0, cv.width, cv.height * (1 - clipH / h), dx, dy, w, h - clipH);
  if (alpha < 1) g.globalAlpha = 1;
  return { dx, dy, w, h, clipH };
}

function drawLights(r, n){
  if (!r || n <= 0) return;
  const g = V.g, L = GANTRY_LIGHTS;
  for (let i = 0; i < Math.min(n, L.xs.length); i++){
    for (const fy of L.ys){
      const cx = r.dx + L.xs[i] * r.w, cy = r.dy + fy * r.h, rad = L.r * r.w;
      if (cy + rad > r.dy + r.h - r.clipH) continue;
      const gg = g.createRadialGradient(cx, cy, 0, cx, cy, rad * 2.2);
      gg.addColorStop(0, '#ffdede'); gg.addColorStop(0.35, '#ff2020'); gg.addColorStop(1, 'rgba(255,0,0,0)');
      g.fillStyle = gg; g.fillRect(cx - rad * 2.2, cy - rad * 2.2, rad * 4.4, rad * 4.4);
    }
  }
}

function drawPlayer(v){
  const g = V.g;
  const w = CAR_W / CAM.height * V.K;
  const fr = carFrame(v.car, v.steer);
  const h = w * fr.height / fr.width;
  const x = V.W / 2 - w / 2;
  const y = V.HOR + V.K - h + (v.bounce || 0) * V.dpr;
  g.drawImage(fr, x, y, w, h);
  if (v.brake > 0.05) drawBrakeGlow(g, x, y, w, h, v.brake);
}

// v = { track, z, x, steer, brake, car, skyOff, lights, shake, bounce }
export function render(v){
  const { track } = v;
  const g = V.g, W = V.W, H = V.H;
  if (!V.layers || V.layers.def !== track.def) V.layers = buildLayers(track.def);

  const N = track.N, segs = track.segs;
  const base = track.at(v.z);
  const basePct = (v.z % SEG) / SEG;
  const pz = v.z + PLAYER_Z;
  const ps = track.at(pz);
  const ppct = (pz % SEG) / SEG;
  const playerY = ps.p1.world.y + (ps.p2.world.y - ps.p1.world.y) * ppct;
  const camY = playerY + CAM.height;
  const camX = v.x * ROAD_W;

  g.save();
  if (v.shake) g.translate(0, Math.round(v.shake * V.dpr));
  drawBackground(v.skyOff || 0, playerY);

  let maxy = H, xAcc = 0, dx = -(base.curve * basePct);
  for (let n = 0; n < CAM.dist; n++){
    const seg = segs[(base.index + n) % N];
    const looped = seg.index < base.index;
    const camZ = v.z - (looped ? track.length : 0);
    seg.fog = fogAt(n);
    seg.clip = maxy;
    seg.n = n;
    project(seg.p1, camX - xAcc, camY, camZ);
    project(seg.p2, camX - xAcc - dx, camY, camZ);
    xAcc += dx; dx += seg.curve;
    if (seg.p1.camera.z <= CAM.depth || seg.p2.screen.y >= seg.p1.screen.y || seg.p2.screen.y >= maxy){ seg.hidden = true; continue; }
    seg.hidden = false;
    drawSegment(seg);
    maxy = seg.p1.screen.y;
  }

  // 景色と車（奥から手前へ）
  for (let n = CAM.dist - 1; n > 0; n--){
    const seg = segs[(base.index + n) % N];
    const p = seg.p1.screen;
    if (seg.p1.camera.z > CAM.depth){
      const alpha = seg.n > CAM.dist * 0.7 ? Math.max(0, 1 - (seg.n - CAM.dist * 0.7) / (CAM.dist * 0.3)) : 1;
      for (const sp of seg.sprites){
        const s = spriteOf(sp);
        if (!s) continue;
        const x = p.x + p.scale * sp.offset * ROAD_W * V.K;
        const ox = s.center ? -0.5 : (sp.offset < 0 ? -1 : 0);
        const r = drawSprite(s.cv, s.ww, p.scale, x, p.y, ox, seg.clip, alpha);
        if (s.lights) drawLights(r, v.lights || 0);
      }
    }
    if (seg === ps) drawPlayer(v);
  }
  g.restore();
}
