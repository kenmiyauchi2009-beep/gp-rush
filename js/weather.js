// 天気とタイヤ：景色の変わり方と、グリップ（曲がりやすさ）の計算
export const WEATHER = {
  sun:    { id: 'sun',    name: '晴れ',   icon: '☀' },
  cloudy: { id: 'cloudy', name: 'くもり', icon: '☁' },
  rain:   { id: 'rain',   name: '雨',     icon: '☂' },
};

// 天気を決める（砂漠は雨が降らない）
export function rollWeather(themeId, rng = Math.random){
  const x = rng();
  if (themeId === 'desert') return x < 0.8 ? 'sun' : 'cloudy';
  return x < 0.55 ? 'sun' : x < 0.78 ? 'cloudy' : 'rain';
}

// タイヤ：grip（乾いた路面のグリップ）、wet（雨の路面のグリップ）、wear（1周で減る割合）
export const COMPOUNDS = {
  soft:   { id: 'soft',   name: 'ソフト',   short: 'S', color: '#ff4b4b', grip: 1.05, wet: 0.74, wear: 0.24, note: '速いが減りやすい' },
  medium: { id: 'medium', name: 'ミディアム', short: 'M', color: '#ffd23f', grip: 1.0,  wet: 0.73, wear: 0.15, note: 'バランス型' },
  hard:   { id: 'hard',   name: 'ハード',   short: 'H', color: '#f2f2f2', grip: 0.96, wet: 0.72, wear: 0.09, note: '遅いが長持ち' },
  wet:    { id: 'wet',    name: 'レイン',   short: 'W', color: '#2f9bff', grip: 0.9,  wet: 0.87, wear: 0.12, dryWear: 0.35, note: '雨の日用（晴れだとすぐ減る）' },
};
export const COMPOUND_ORDER = ['soft', 'medium', 'hard', 'wet'];

// タイヤの減り具合（0〜1）によるグリップの落ち方：60% までは変わらず、そこから最大 22% 落ちる
export const wearPenalty = w => (w <= 0.6 ? 0 : Math.min(1, (w - 0.6) / 0.4) * 0.22);

// グリップ（1 が基準）
export function gripOf(compoundId, wear, weatherId){
  const c = COMPOUNDS[compoundId];
  return (weatherId === 'rain' ? c.wet : c.grip) * (1 - wearPenalty(wear));
}

// 1周あたりの減り
export function wearRate(compoundId, weatherId){
  const c = COMPOUNDS[compoundId];
  if (c.id === 'wet' && weatherId !== 'rain') return c.dryWear;
  return c.wear;
}

// おすすめのタイヤ（周回数と天気から）
export function suggestCompound(laps, weatherId){
  if (weatherId === 'rain') return 'wet';
  if (laps <= 3) return 'soft';
  if (laps <= 5) return 'medium';
  return 'medium';
}

// ---- 天気に合わせた景色（テーマを元に、空・霧・色味を変える） ----
const hex = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const toHex = a => '#' + a.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
const mixHex = (a, b, t) => { const x = hex(a), y = hex(b); return toHex(x.map((v, i) => v + (y[i] - v) * t)); };

const envCache = new Map();
export function envFor(theme, weatherId){
  const key = theme;
  let byW = envCache.get(key);
  if (!byW){ byW = {}; envCache.set(key, byW); }
  if (byW[weatherId]) return byW[weatherId];
  let env;
  if (weatherId === 'sun') env = theme;
  else {
    const rain = weatherId === 'rain', night = theme.time === '夜';
    const grey = night ? '#1a1f2e' : rain ? '#6f7884' : '#9aa3ad';
    const k = rain ? 0.6 : 0.35;
    env = Object.assign({}, theme, {
      weather: weatherId,
      time: theme.time,
      sky: theme.sky.map(c => mixHex(c, grey, k)),
      fog: mixHex(theme.fog, grey, k),
      clouds: night ? theme.clouds : rain ? 1.6 : 1.5,
      cloudGrey: night ? 0 : rain ? 0.55 : 0.3,
      stars: theme.stars && !rain,
      fogK: rain ? 1.6 : 1.15,
      tint: theme.tint
        ? [mixHex(theme.tint[0], '#3a4552', rain ? 0.5 : 0.25), Math.min(0.6, theme.tint[1] + (rain ? 0.12 : 0.05))]
        : [rain ? '#3a4552' : '#5a6270', rain ? 0.24 : 0.1],
      wet: rain,
    });
  }
  byW[weatherId] = env;
  return env;
}
