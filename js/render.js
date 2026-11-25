// 擬似3Dの描画
// 道を手前から奥へ輪切り（セグメント）で描き、景色と車は奥から手前へ重ねる。
import { SEG, ROAD_W, KERB, GRAVEL, STAND } from './track.js';
import { spriteOf, GANTRY_LIGHTS } from './sprites.js';
import { CAR_W, carFrame, drawBrakeGlow } from './carart.js';

export const CAM = {
  height: 1000,                                // カメラの高さ
  depth: 1 / Math.tan(50 * Math.PI / 180),     // 視野 100°
  dist: 280,                                   // 何セグメント先まで描くか
};
export const PLAYER_Z = CAM.height * CAM.depth;   // カメラから自分の車までの距離

const V = { cv: null, g: null, W: 0, H: 0, K: 0, HOR: 0, dpr: 1, layers: null, fogRgb: [0, 0, 0], tintRgb: null, tintK: 0, key: '' };

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
// 景色の色：時間帯の色味（tint）をかけてから、遠いほど霧の色に近づける
function fogC(hex, f){
  const q = Math.round(f * 24);
  if (q <= 0 && !V.tintRgb) return hex;
  const key = hex + V.key + q;
  let c = fogCache.get(key);
  if (!c){
    let a = hexRgb(hex);
    if (V.tintRgb){ const t = V.tintK, b = V.tintRgb; a = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
    const b = V.fogRgb, t = q / 24;
    c = `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`;
    fogCache.set(key, c);
  }
  return c;
}
const fogAt = n => { const t = n / CAM.dist; return Math.min(1, t * t * 1.15) * 0.92; };

// ---- 背景（雲・遠景・近景）。横につながる絵を作って、カーブに合わせて横に流す ----
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); return c; };
const seeded = seed => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; };

function ridgePath(g, TW, h, top, amp, waves, seed){
  // 横につながるように、周期が幅の整数分の1の波だけを足す
  const ph = waves.map((_, i) => (Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453) % (Math.PI * 2));
  g.beginPath(); g.moveTo(0, h);
  for (let x = 0; x <= TW; x += 3){
    let y = 0;
    waves.forEach(([k, a], i) => { y += a * Math.sin((x / TW) * Math.PI * 2 * k + ph[i]); });
    g.lineTo(x, top + amp * y);
  }
  g.lineTo(TW, h); g.closePath();
}
function ridge(g, TW, h, top, amp, waves, seed, fill){
  ridgePath(g, TW, h, top, amp, waves, seed);
  g.fillStyle = fill; g.fill();
}
const vgrad = (g, h, a, b, y0 = 0) => { const gg = g.createLinearGradient(0, y0, 0, h); gg.addColorStop(0, a); gg.addColorStop(1, b); return gg; };

function farLayer(th, TW){
  const { W, H } = V, f = th.far;
  if (f.type === 'sea'){
    const sea = mk(TW, Math.round(H * 0.06)), c = sea.getContext('2d'), h = sea.height;
    c.fillStyle = vgrad(c, h, f.c[0], f.c[1]); c.fillRect(0, 0, TW, h);
    const r = seeded(11);
    c.fillStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i < 90; i++) c.fillRect(r() * TW, r() * h, W * (0.004 + r() * 0.01), Math.max(1, h * 0.03));
    return sea;
  }
  if (f.type === 'city'){
    const cv = mk(TW, Math.round(H * 0.26)), c = cv.getContext('2d'), h = cv.height;
    const r = seeded(23), u = Math.max(1, V.dpr);
    let x = 0;
    while (x < TW){
      let bw = W * (0.025 + r() * 0.05);
      if (x + bw > TW) bw = TW - x;
      const bh = h * (0.2 + r() * 0.75);
      c.fillStyle = f.c; c.fillRect(x, h - bh, bw, bh);
      c.fillStyle = 'rgba(255,255,255,0.05)'; c.fillRect(x, h - bh, bw * 0.3, bh);
      for (let wy = h - bh + 5 * u; wy < h - 3 * u; wy += 7 * u){
        for (let wx = x + 3 * u; wx < x + bw - 4 * u; wx += 6 * u){
          if (r() < f.lit){ c.fillStyle = r() < 0.8 ? '#ffd98a' : '#9fe3ff'; c.fillRect(wx, wy, 3 * u, 3 * u); }
        }
      }
      x += bw + W * 0.003;
    }
    return cv;
  }
  const cv = mk(TW, Math.round(H * 0.3)), c = cv.getContext('2d'), h = cv.height;
  if (f.type === 'dunes'){
    ridge(c, TW, h, h * 0.62, h * 0.18, [[2, 0.6], [3, 0.3], [5, 0.12]], 4, vgrad(c, h, f.c, th.fog, h * 0.4));
    return cv;
  }
  if (f.type === 'snowy'){
    // とがった高い山。上のほうだけ白くする
    const W5 = [[3, 0.5], [5, 0.32], [11, 0.2], [19, 0.1]];
    ridge(c, TW, h, h * 0.42, h * 0.42, W5, 13, vgrad(c, h, f.c, th.fog));
    c.save();
    ridgePath(c, TW, h, h * 0.42, h * 0.42, W5, 13);
    c.clip();
    c.fillStyle = vgrad(c, h * 0.62, 'rgba(255,255,255,1)', 'rgba(255,255,255,0)', h * 0.1);
    c.fillRect(0, 0, TW, h * 0.62);
    c.restore();
  } else {
    ridge(c, TW, h, h * 0.45, h * 0.3, [[2, 0.5], [3, 0.35], [7, 0.18], [13, 0.08]], 3, vgrad(c, h, f.c, th.fog));
  }
  return cv;
}

function nearLayer(th, TW){
  const { H } = V, n = th.near;
  if (n.type === 'none') return null;
  if (n.type === 'sea'){
    const sea = mk(TW, Math.round(H * 0.05)), c = sea.getContext('2d'), h = sea.height;
    c.fillStyle = vgrad(c, h, n.c[0], n.c[1]); c.fillRect(0, 0, TW, h);
    const r = seeded(5);
    c.fillStyle = 'rgba(255,230,180,0.45)';
    for (let i = 0; i < 70; i++) c.fillRect(r() * TW, r() * h, V.W * (0.004 + r() * 0.012), Math.max(1, h * 0.04));
    return sea;
  }
  const cv = mk(TW, Math.round(H * 0.16)), c = cv.getContext('2d'), h = cv.height;
  if (n.type === 'forest'){
    ridge(c, TW, h, h * 0.4, h * 0.2, [[3, 0.5], [6, 0.3]], 7, vgrad(c, h, n.c[0], n.c[1]));
    ridge(c, TW, h, h * 0.62, h * 0.2, [[5, 0.3], [37, 0.3], [61, 0.25], [97, 0.15]], 8, vgrad(c, h, n.forest[0], n.forest[1], h * 0.3));
    return cv;
  }
  ridge(c, TW, h, h * 0.45, h * 0.25, [[3, 0.5], [5, 0.3], [11, 0.15]], 9, vgrad(c, h, n.c[0], n.c[1]));
  // 手前の森（細かいギザギザ）
  ridge(c, TW, h, h * 0.72, h * 0.16, [[4, 0.45], [29, 0.2], [47, 0.14], [71, 0.1]], 5, vgrad(c, h, n.forest[0], n.forest[1], h * 0.4));
  return cv;
}

function buildLayers(th){
  const { W, H, g } = V;
  V.fogRgb = hexRgb(th.fog);
  V.tintRgb = th.tint ? hexRgb(th.tint[0]) : null;
  V.tintK = th.tint ? th.tint[1] : 0;
  V.key = th.fog + (th.tint ? th.tint.join() : '');
  const TW = Math.ceil(W * 1.6);
  const sky = g.createLinearGradient(0, 0, 0, V.HOR);
  sky.addColorStop(0, th.sky[0]); sky.addColorStop(0.6, th.sky[1]); sky.addColorStop(1, th.sky[2]);

  // 雲（夕方は色味をかける）と星
  const clouds = mk(TW, Math.round(H * 0.45));
  {
    const c = clouds.getContext('2d');
    const r = seeded(7);
    if (th.stars){
      for (let i = 0; i < 160; i++){
        c.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.6})`;
        const s = Math.max(1, V.dpr * (r() < 0.1 ? 1.6 : 1));
        c.fillRect(r() * TW, r() * clouds.height * 0.8, s, s);
      }
    }
    const cc = th.tint ? hexRgb(th.tint[0]).map(v => Math.round(255 + (v - 255) * th.tint[1] * 1.6)) : [255, 255, 255];
    const col = a => `rgba(${cc[0]},${cc[1]},${cc[2]},${a})`;
    const count = Math.round(9 * (th.clouds || 0));
    // 横に平たい雲（ぼかした楕円を重ねる）
    for (let i = 0; i < count; i++){
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
          gg.addColorStop(0, col(0.75)); gg.addColorStop(0.55, col(0.45)); gg.addColorStop(1, col(0));
          c.fillStyle = gg; c.fillRect(-rad, -rad, rad * 2, rad * 2);
          c.restore();
        }
      }
    }
  }
  return { th, sky, clouds, far: farLayer(th, TW), near: nearLayer(th, TW), TW };
}

function drawLayer(cv, off, bottom){
  if (!cv) return;
  const { g, W } = V;
  const TW = cv.width, y = Math.round(bottom - cv.height);
  let x = -(((off % TW) + TW) % TW);
  for (; x < W; x += TW) g.drawImage(cv, Math.floor(x), y);
}

function drawBackground(skyOff, playerY){
  const { g, W, H, HOR } = V, L = V.layers;
  g.fillStyle = L.sky; g.fillRect(0, 0, W, HOR + 2);
  // 地平線より下（道が下っているときに見える部分）
  g.fillStyle = fogC(L.th.grass[0], 0.75); g.fillRect(0, HOR, W, H - HOR);
  // 高いところにいるときは背景を少しだけ上げる（上げすぎると遠くの山が手前の丘に隠れる）
  const lift = Math.max(-0.035 * H, Math.min(0.035 * H, -playerY / SEG * H * 0.0015));
  drawLayer(L.clouds, skyOff * W * 0.12, HOR * 0.75 + lift * 0.3);
  drawLayer(L.far, skyOff * W * 0.3, HOR + 2 + lift * 0.6);
  drawLayer(L.near, skyOff * W * 0.6, HOR + 3 + lift);
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

// ---- 観客席（道に沿って立つ。セグメントごとに斜めの客席・屋根を描く） ----
const CROWD = ['#e8433a', '#f2c230', '#2f7de1', '#f4f4f4', '#3cb371', '#ff8c2a', '#9b59d0', '#1e2a44',
  '#e86fa6', '#58c8e8', '#c9302c', '#ffd9a8', '#2c3e50', '#7fd16a', '#ffffff', '#f06b2b'];
const SKIN = ['#f1c9a5', '#d9a37a', '#8d5a3b', '#f6dcc4', '#c68a5e'];
const crowdAt = (i, r, k) => CROWD[(((i * 73856093) ^ (r * 19349663) ^ (k * 83492791)) >>> 0) % CROWD.length];

function quad(a, b, c, d, color){ poly(a[0], a[1], b[0], b[1], c[0], c[1], d[0], d[1], color); }
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

function drawStand(seg, side){
  const f = seg.fog, p1 = seg.p1.screen, p2 = seg.p2.screen;
  const { a, b, h, roof, rows, wall } = STAND;
  // 道からの横の位置 o（道の半幅が1）と高さ hh の点を画面へ
  const P = (p, o, hh) => [p.x + p.scale * o * side * ROAD_W * V.K, p.y - p.scale * hh * V.K];
  const fine = seg.n < 70;     // 近いところは席を細かく分ける

  // 奥の壁（客席の上から屋根まで）
  quad(P(p1, b, h), P(p2, b, h), P(p2, b, roof + 250), P(p1, b, roof + 250), fogC('#56606e', f));
  // 客席（奥の段から手前へ。手前の段が奥の人の足もとを隠す）
  for (let r = rows - 1; r >= 0; r--){
    const o0 = a + (b - a) * r / rows, o1 = a + (b - a) * (r + 1) / rows;
    const h0 = wall + (h - wall) * r / rows, h1 = wall + (h - wall) * (r + 1) / rows;
    const q1 = P(p1, o0, h0), q2 = P(p2, o0, h0), q3 = P(p2, o1, h1), q4 = P(p1, o1, h1);
    quad(q1, q2, q3, q4, fogC(r % 2 ? '#3b4656' : '#465365', f));
    // 観客：遠くは色のかたまり、近くは1人ずつ道のほうを向いて立つ（服の色の体と、肌の色の頭）
    if (!fine){
      const lo1 = mix(q1, q4, 0.3), lo2 = mix(q2, q3, 0.3);
      quad(mix(lo1, lo2, 0.05), mix(lo1, lo2, 0.95), mix(q4, q3, 0.95), mix(q4, q3, 0.05), fogC(crowdAt(seg.index, r, 0), f));
    } else {
      const parts = 3, o = o0 + (o1 - o0) * 0.4, hb = h0 + (h1 - h0) * 0.4;
      // セグメントの中の位置 t（0〜1）と高さ hh の点
      const at = (t, hh) => mix(P(p1, o, hh), P(p2, o, hh), t);
      for (let k = 0; k < parts; k++){
        if (((seg.index * 7 + r * 3 + k) % 11) === 0) continue;   // ところどころ空席
        const t0 = (k + 0.18) / parts, t1 = (k + 0.82) / parts, tm = (k + 0.5) / parts, hw = 0.16 / parts;
        quad(at(t0, hb), at(t1, hb), at(t1, hb + 250), at(t0, hb + 250), fogC(crowdAt(seg.index, r, k), f));
        quad(at(tm - hw, hb + 260), at(tm + hw, hb + 260), at(tm + hw, hb + 370), at(tm - hw, hb + 370), fogC(SKIN[(seg.index + r + k) % SKIN.length], f));
      }
    }
  }
  // 手前の壁（広告の帯つき）
  quad(P(p1, a, 0), P(p2, a, 0), P(p2, a, wall), P(p1, a, wall), fogC('#e6e9ee', f));
  quad(P(p1, a, wall * 0.25), P(p2, a, wall * 0.25), P(p2, a, wall * 0.7), P(p1, a, wall * 0.7), fogC(seg.index % 12 < 6 ? '#c8102e' : '#1b4fbf', f));
  // 柱
  if (seg.index % 8 === 0){
    const t = P(p1, a + 0.12, roof), bt = P(p1, a + 0.12, wall);
    const w = Math.max(1, p1.scale * 90 * V.K);
    V.g.fillStyle = fogC('#7d8793', f);
    V.g.fillRect(t[0] - w / 2, t[1], w, bt[1] - t[1]);
  }
  // 屋根（裏側と、手前の縁）
  quad(P(p1, a - 0.05, roof), P(p2, a - 0.05, roof), P(p2, b + 0.2, roof + 250), P(p1, b + 0.2, roof + 250), fogC('#8e98a5', f));
  quad(P(p1, a - 0.05, roof), P(p2, a - 0.05, roof), P(p2, a - 0.05, roof + 200), P(p1, a - 0.05, roof + 200), fogC('#f2f4f7', f));
}

// ---- ライバル車 ----
let carSegs = [];
function placeCars(track, cars){
  for (const s of carSegs) s.cars.length = 0;
  carSegs = [];
  if (!cars) return;
  for (const c of cars){
    const s = track.at(c.z + c.off);
    if (!s.cars.length) carSegs.push(s);
    s.cars.push(c);
  }
  for (const s of carSegs) if (s.cars.length > 1) s.cars.sort((a, b) => ((b.z + b.off) % SEG) - ((a.z + a.off) % SEG));
}

function drawCarAt(seg, c){
  const g = V.g, p1 = seg.p1.screen, p2 = seg.p2.screen;
  const t = (((c.z + c.off) % SEG) + SEG) % SEG / SEG;
  const scale = p1.scale + (p2.scale - p1.scale) * t;
  const x = p1.x + (p2.x - p1.x) * t + scale * c.x * ROAD_W * V.K;
  const y = p1.y + (p2.y - p1.y) * t;
  const fr = carFrame(c.art, c.steer);
  const w = CAR_W * scale * V.K, h = w * fr.height / fr.width;
  const dx = x - w / 2, dy = y - h;
  if (dx > V.W || dx + w < 0 || w < 2) return;
  const clipH = Math.max(0, dy + h - seg.clip);
  if (clipH >= h) return;
  g.drawImage(fr, 0, 0, fr.width, fr.height * (1 - clipH / h), dx, dy, w, h - clipH);
  if (c.braking > 0.05 && clipH < h * 0.3) drawBrakeGlow(g, dx, dy, w, h, c.braking);
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

// v = { track, z, x, steer, brake, car, skyOff, lights, shake, bounce, cars（ライバル車の配列） }
export function render(v){
  const { track } = v;
  const g = V.g, W = V.W, H = V.H;
  if (!V.layers || V.layers.th !== track.theme) V.layers = buildLayers(track.theme);

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
  placeCars(track, v.cars);
  const myT = ppct;
  for (let n = CAM.dist - 1; n > 0; n--){
    const seg = segs[(base.index + n) % N];
    const p = seg.p1.screen;
    if (seg.p1.camera.z > CAM.depth){
      if (seg.stands && !seg.hidden) for (const side of seg.stands) drawStand(seg, side);
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
    if (seg === ps){
      // 同じセグメントでは、自分より前の車 → 自分 → 後ろの車の順
      let drawn = false;
      for (const c of seg.cars){
        const t = (((c.z + c.off) % SEG) + SEG) % SEG / SEG;
        if (!drawn && t < myT){ drawPlayer(v); drawn = true; }
        if (seg.p1.camera.z > CAM.depth) drawCarAt(seg, c);
      }
      if (!drawn) drawPlayer(v);
    } else if (seg.p1.camera.z > CAM.depth){
      for (const c of seg.cars) drawCarAt(seg, c);
    }
  }
  g.restore();
}
