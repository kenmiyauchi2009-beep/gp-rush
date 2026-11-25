// レース中の表示（周回・タイム・速さ・ギア・小さな地図）
import { $, fmtTime, fmtDelta } from './util.js';
import { SEG } from './track.js';

const LEDS = 15;
const last = {};
const set = (id, text) => { if (last[id] !== text){ last[id] = text; $(id).textContent = text; } };

let mapCv = null, mapG = null, mapScale = 1, mapOx = 0, mapOy = 0, mapPath = null, mapTrack = null;

export function setupHud(){
  const leds = $('hLeds');
  leds.innerHTML = '';
  for (let i = 0; i < LEDS; i++) leds.appendChild(document.createElement('i'));
  mapCv = $('map');
  mapG = mapCv.getContext('2d');
}

function prepareMap(track){
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = mapCv.clientWidth, h = mapCv.clientHeight;
  mapCv.width = Math.round(w * dpr); mapCv.height = Math.round(h * dpr);
  const m = track.map, pad = 10 * dpr;
  mapScale = Math.min((mapCv.width - pad * 2) / m.w, (mapCv.height - pad * 2) / m.h);
  mapOx = (mapCv.width - m.w * mapScale) / 2 - m.minX * mapScale;
  mapOy = (mapCv.height - m.h * mapScale) / 2 - m.minY * mapScale;
  mapPath = new Path2D();
  m.pts.forEach(([x, y], i) => { const px = mapOx + x * mapScale, py = mapOy + y * mapScale; i ? mapPath.lineTo(px, py) : mapPath.moveTo(px, py); });
  mapPath.closePath();
  mapTrack = track;
}

export function resizeHud(){ mapTrack = null; }

// 地図：コースと自分の位置（others：ライバルの位置の配列）
export function drawMap(track, z, others){
  if (!mapCv.clientWidth) return;
  if (mapTrack !== track) prepareMap(track);
  const g = mapG, dpr = Math.min(window.devicePixelRatio || 1, 2);
  g.clearRect(0, 0, mapCv.width, mapCv.height);
  g.lineJoin = 'round';
  g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 3.2 * dpr; g.stroke(mapPath);
  g.strokeStyle = 'rgba(40,50,70,0.9)'; g.lineWidth = 1.6 * dpr; g.stroke(mapPath);
  // スタートライン
  const s = track.map.pts[track.startSeg];
  g.fillStyle = '#ffd23f';
  g.fillRect(mapOx + s[0] * mapScale - 2 * dpr, mapOy + s[1] * mapScale - 2 * dpr, 4 * dpr, 4 * dpr);
  // ライバル
  if (others){
    for (const o of others){
      const q = track.map.pts[Math.floor(o.z / SEG) % track.N];
      g.fillStyle = o.color;
      g.beginPath(); g.arc(mapOx + q[0] * mapScale, mapOy + q[1] * mapScale, 2.6 * dpr, 0, Math.PI * 2); g.fill();
    }
  }
  // 自分
  const p = track.map.pts[Math.floor(z / SEG) % track.N];
  g.fillStyle = '#ff3b3b'; g.strokeStyle = '#fff'; g.lineWidth = 1.5 * dpr;
  g.beginPath(); g.arc(mapOx + p[0] * mapScale, mapOy + p[1] * mapScale, 4 * dpr, 0, Math.PI * 2); g.fill(); g.stroke();
}

// s = { lap, lapOf, pos, posOf, ahead, behind, time, best, last, kmh, gear, rpm }
export function updateHud(s){
  set('hLap', String(s.lap));
  set('hLapOf', s.lapOf ? '/' + s.lapOf : '');
  const race = s.pos != null;
  if (last.race !== race){
    last.race = race;
    $('hPosBox').classList.toggle('hidden', !race);
    $('hGaps').classList.toggle('hidden', !race);
  }
  if (race){
    set('hPos', String(s.pos));
    set('hPosOf', '/' + s.posOf);
    set('hAhead', s.ahead == null ? '-' : '+' + s.ahead.toFixed(1));
    set('hBehind', s.behind == null ? '-' : '-' + s.behind.toFixed(1));
  }
  set('hTime', fmtTime(s.time));
  set('hBest', fmtTime(s.best));
  set('hLast', fmtTime(s.last));
  set('hSpd', String(Math.round(s.kmh)));
  set('hGear', s.gear);
  // 回転数の LED（緑5・赤5・青5）
  const lit = Math.round(Math.max(0, Math.min(1, (s.rpm - 0.5) / 0.48)) * LEDS);
  if (last.leds !== lit){
    last.leds = lit;
    const els = $('hLeds').children;
    for (let i = 0; i < LEDS; i++) els[i].className = i < lit ? (i < 5 ? 'g' : i < 10 ? 'r' : 'b') : '';
  }
}

let bannerTimer = 0;
export function showBanner(html, ms = 2500){
  const el = $('banner');
  el.innerHTML = html;
  el.classList.remove('hidden');
  // アニメーションをやり直す
  el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  clearTimeout(bannerTimer);
  if (ms) bannerTimer = setTimeout(() => el.classList.add('hidden'), ms);
}
export function hideBanner(){ clearTimeout(bannerTimer); $('banner').classList.add('hidden'); }

let deltaTimer = 0;
export function showDelta(d, isBest){
  const el = $('hDelta');
  el.textContent = d == null ? 'ラップ記録' : (isBest ? 'ベスト  ' : '') + fmtDelta(d);
  el.className = 'delta show ' + (d == null || d < 0 ? 'good' : 'bad');
  clearTimeout(deltaTimer);
  deltaTimer = setTimeout(() => { el.className = 'delta'; }, 3000);
}
