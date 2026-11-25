// 汎用の小道具
export const $ = id => document.getElementById(id);
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export const easeIn = (a, b, t) => a + (b - a) * t * t;
export const easeOut = (a, b, t) => a + (b - a) * (1 - (1 - t) * (1 - t));
export const easeInOut = (a, b, t) => a + (b - a) * (0.5 - Math.cos(t * Math.PI) / 2);

// 決まった列の乱数（同じ種なら毎回同じ景色になる）
export function rng(seed){
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 秒 → 「1:05.234」
export function fmtTime(s){
  if (s == null || !isFinite(s)) return '-:--.---';
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}:${r.toFixed(3).padStart(6, '0')}`;
}

// 差 → 「+0.512」「-1.204」
export const fmtDelta = d => (d < 0 ? '-' : '+') + Math.abs(d).toFixed(3);

let toastTimer = 0;
export function toast(msg, ms = 2200){
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}
