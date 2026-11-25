// フォーミュラカーを後ろから見た絵（コードで描く）
// ハンドルの切り具合ごとに5枚作っておき、描画のときに選ぶ。

export const CAR_W = 840;         // ワールドでの車の幅
const CW = 480, CH = 250;         // 絵の大きさ（ピクセル）

const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const rr = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); };

// livery = { body, accent, helmet, number }
export function makeCar(livery){
  const frames = [];
  for (const steer of [-1, -0.5, 0, 0.5, 1]){
    const c = mk(CW, CH);
    drawCar(c.getContext('2d'), CW, CH, steer, livery);
    frames.push(c);
  }
  return { frames, aspect: CH / CW };
}

// steer：-1（左いっぱい）〜 1（右いっぱい）
export function carFrame(car, steer){
  const i = Math.round((steer + 1) * 2);
  return car.frames[Math.max(0, Math.min(4, i))];
}

function shade(hex, k){
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (k < 0){ r *= 1 + k; g *= 1 + k; b *= 1 + k; }
  else { r += (255 - r) * k; g += (255 - g) * k; b += (255 - b) * k; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

function tyre(g, x, y, w, h, front){
  const tg = g.createLinearGradient(x, 0, x + w, 0);
  tg.addColorStop(0, '#0a0a0a'); tg.addColorStop(0.25, '#26282b'); tg.addColorStop(0.55, '#1a1b1d'); tg.addColorStop(1, '#070707');
  rr(g, x, y, w, h, w * 0.28); g.fillStyle = tg; g.fill();
  // 溝のない（スリック）タイヤの照り
  g.fillStyle = 'rgba(255,255,255,0.07)'; g.fillRect(x + w * 0.2, y + h * 0.08, w * 0.12, h * 0.84);
  if (!front){
    // 側面の色の帯
    g.fillStyle = '#e8c52a'; g.fillRect(x + w * 0.05, y + h * 0.48, w * 0.9, h * 0.03);
  }
}

function drawCar(g, W, H, steer, L){
  const body = L.body, acc = L.accent;
  const sx = steer * W * 0.02;      // 前輪が動く量

  // 影
  const sg = g.createRadialGradient(W / 2, H * 0.97, 10, W / 2, H * 0.97, W * 0.52);
  sg.addColorStop(0, 'rgba(0,0,0,0.55)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = sg; g.fillRect(0, H * 0.82, W, H * 0.18);

  // 前輪（奥）
  const fw = W * 0.13, fh = H * 0.3;
  g.save();
  for (const side of [-1, 1]){
    const cx = W / 2 + side * W * 0.29 + sx;
    g.save();
    g.translate(cx, H * 0.6);
    g.transform(1, 0, steer * 0.18, 1, 0, 0);
    tyre(g, -fw / 2, -fh / 2, fw, fh, true);
    g.restore();
  }
  g.restore();

  // フロントウイングの端（奥にちらりと見える）
  g.fillStyle = shade(acc, -0.2);
  g.fillRect(W * 0.14 + sx, H * 0.66, W * 0.06, H * 0.05);
  g.fillRect(W * 0.8 + sx, H * 0.66, W * 0.06, H * 0.05);

  // サイドポッド
  for (const side of [-1, 1]){
    const x0 = W / 2 + side * W * 0.1, x1 = W / 2 + side * W * 0.27;
    const pg = g.createLinearGradient(0, H * 0.42, 0, H * 0.8);
    pg.addColorStop(0, shade(body, 0.15)); pg.addColorStop(1, shade(body, -0.45));
    g.fillStyle = pg;
    g.beginPath();
    g.moveTo(x0, H * 0.44); g.lineTo(x1, H * 0.52); g.lineTo(x1, H * 0.78); g.lineTo(x0, H * 0.8); g.closePath(); g.fill();
  }

  // サスペンションのアーム
  g.strokeStyle = '#111'; g.lineWidth = W * 0.008;
  for (const side of [-1, 1]){
    g.beginPath();
    g.moveTo(W / 2 + side * W * 0.1, H * 0.6); g.lineTo(W / 2 + side * W * 0.36, H * 0.56);
    g.moveTo(W / 2 + side * W * 0.1, H * 0.74); g.lineTo(W / 2 + side * W * 0.36, H * 0.76);
    g.stroke();
  }

  // 後輪
  const rw = W * 0.2, rh = H * 0.5;
  tyre(g, W * 0.03, H * 0.45, rw, rh, false);
  tyre(g, W * 0.97 - rw, H * 0.45, rw, rh, false);

  // エンジンカバー（下が広く、上のエアボックスに向かって細くなる）
  const eg = g.createLinearGradient(W * 0.38, 0, W * 0.62, 0);
  eg.addColorStop(0, shade(body, -0.35)); eg.addColorStop(0.45, shade(body, 0.2)); eg.addColorStop(1, shade(body, -0.4));
  g.fillStyle = eg;
  g.beginPath();
  g.moveTo(W * 0.47, H * 0.22);
  g.quadraticCurveTo(W * 0.5, H * 0.18, W * 0.53, H * 0.22);
  g.lineTo(W * 0.6, H * 0.6);
  g.lineTo(W * 0.66, H * 0.82);
  g.lineTo(W * 0.34, H * 0.82);
  g.lineTo(W * 0.4, H * 0.6);
  g.closePath(); g.fill();
  // 背中の線（チームの色）
  g.fillStyle = acc;
  g.beginPath();
  g.moveTo(W * 0.49, H * 0.24); g.lineTo(W * 0.51, H * 0.24); g.lineTo(W * 0.525, H * 0.8); g.lineTo(W * 0.475, H * 0.8); g.closePath(); g.fill();

  // ヘルメット（エアボックスの横から少し見える）
  g.fillStyle = L.helmet;
  g.beginPath(); g.arc(W * 0.5, H * 0.3, W * 0.045, Math.PI, 0); g.fill();
  g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(W * 0.455, H * 0.3, W * 0.09, H * 0.025);
  // エアボックス（吸気口）
  rr(g, W * 0.475, H * 0.2, W * 0.05, H * 0.06, 6); g.fillStyle = '#0d0f12'; g.fill();

  // ディフューザー
  g.fillStyle = '#101215';
  g.beginPath();
  g.moveTo(W * 0.27, H * 0.8); g.lineTo(W * 0.73, H * 0.8); g.lineTo(W * 0.76, H * 0.95); g.lineTo(W * 0.24, H * 0.95); g.closePath(); g.fill();
  g.strokeStyle = '#2a2e35'; g.lineWidth = W * 0.006;
  for (let i = 1; i < 6; i++){
    const x = W * (0.27 + 0.46 * i / 6);
    g.beginPath(); g.moveTo(x, H * 0.81); g.lineTo(x + (x - W / 2) * 0.06, H * 0.94); g.stroke();
  }
  // 排気管
  g.fillStyle = '#3a3d42'; g.beginPath(); g.arc(W / 2, H * 0.73, W * 0.018, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#0a0a0a'; g.beginPath(); g.arc(W / 2, H * 0.73, W * 0.01, 0, Math.PI * 2); g.fill();
  // 雨用の赤いランプ（ブレーキの光は描画のときに重ねる）
  rr(g, W * 0.475, H * 0.64, W * 0.05, H * 0.04, 3); g.fillStyle = '#5a0b0b'; g.fill();

  // リアウイング
  for (const side of [-1, 1]){
    // 翼端板
    const x = W / 2 + side * W * 0.34 - W * 0.02;
    const pg = g.createLinearGradient(x, 0, x + W * 0.04, 0);
    pg.addColorStop(0, shade(body, -0.5)); pg.addColorStop(1, shade(body, -0.1));
    g.fillStyle = pg;
    rr(g, x, H * 0.04, W * 0.04, H * 0.42, 4); g.fill();
  }
  // 支柱
  g.fillStyle = '#16181c'; g.fillRect(W * 0.49, H * 0.18, W * 0.02, H * 0.5);
  // 主翼と上の翼
  const wg = g.createLinearGradient(0, H * 0.06, 0, H * 0.2);
  wg.addColorStop(0, shade(acc, 0.25)); wg.addColorStop(1, shade(acc, -0.35));
  g.fillStyle = wg;
  rr(g, W * 0.17, H * 0.07, W * 0.66, H * 0.09, 4); g.fill();
  g.fillStyle = shade(body, -0.2);
  rr(g, W * 0.17, H * 0.165, W * 0.66, H * 0.05, 3); g.fill();
  // ウイングの文字（チーム名か番号）
  g.fillStyle = L.text || '#ffffff';
  g.font = `900 italic ${Math.round(H * 0.07)}px sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(L.wing || 'GP RUSH', W / 2, H * 0.115);
  // 番号
  if (L.number != null){
    g.fillStyle = '#fff';
    g.font = `900 ${Math.round(H * 0.075)}px sans-serif`;
    g.fillText(String(L.number), W / 2, H * 0.57);
  }
}

// ブレーキのときに赤いランプを光らせる（描画先の座標で）
export function drawBrakeGlow(g, x, y, w, h, k){
  const cx = x + w * 0.5, cy = y + h * 0.66, rad = w * 0.09;
  const gg = g.createRadialGradient(cx, cy, 0, cx, cy, rad);
  gg.addColorStop(0, `rgba(255,60,60,${0.95 * k})`); gg.addColorStop(0.3, `rgba(255,30,30,${0.55 * k})`); gg.addColorStop(1, 'rgba(255,0,0,0)');
  g.fillStyle = gg; g.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
}
