// シーズン：全8戦のポイント・順位表と、予選のタイム
import { DRIVERS, TEAMS, teamOf } from './data.js';
import { CALENDAR, SEG } from './track.js';
import { newCar, updateCar, autopilot } from './physics.js';
import { aiSkill, aiMax } from './race.js';

export const POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
export const SKIP_GRID = 12;     // 予選をとばしたときのスタート位置

export function newSeason(diff, year){
  return { year, diff, round: 0, points: {}, team: {}, results: [], done: false };
}

// レースの結果（ドライバー id の順位の並び）を加える
export function addResult(season, trackId, order, fastestId){
  const gained = {};
  order.forEach((id, i) => {
    const pts = POINTS[i] || 0;
    gained[id] = pts;
    season.points[id] = (season.points[id] || 0) + pts;
    const team = DRIVERS.find(d => d.id === id).team;
    season.team[team] = (season.team[team] || 0) + pts;
  });
  season.results.push({ track: trackId, order, fastest: fastestId });
  season.round++;
  if (season.round >= CALENDAR.length) season.done = true;
  return gained;
}

// ドライバーの順位表（ポイント → 勝利数 → 最高順位）
export function driverTable(season){
  return DRIVERS.map(d => {
    let wins = 0, podiums = 0, best = 99;
    for (const r of season.results){
      const p = r.order.indexOf(d.id) + 1;
      if (p === 1) wins++;
      if (p >= 1 && p <= 3) podiums++;
      if (p >= 1) best = Math.min(best, p);
    }
    return { d, team: teamOf(d.team), pts: season.points[d.id] || 0, wins, podiums, best };
  }).sort((a, b) => b.pts - a.pts || b.wins - a.wins || a.best - b.best);
}

export function teamTable(season){
  return TEAMS.map(t => ({ t, pts: season.team[t.id] || 0 })).sort((a, b) => b.pts - a.pts);
}

// 予選：ライバルが1人で1周走ったときのタイム（コース・うまさごとに覚えておく）＋ばらつき
const lapCache = new Map();
function soloLap(track, skill, max){
  const key = `${track.def.id}:${skill.toFixed(3)}:${max.toFixed(0)}`;
  if (lapCache.has(key)) return lapCache.get(key);
  const c = newCar((track.startSeg - 80 + track.N) % track.N * SEG, 0);
  c.max = max;
  c.speed = 0;   // 予選の自分と同じく、80セグメント手前から止まった状態で出る
  const dt = 1 / 60, line = track.startSeg * SEG, L = track.length;
  const dist = () => (((c.z - line) % L) + L) % L;
  let prev = dist(), start = null, t = 0, lap = null;
  while (t < 240 && lap == null){
    updateCar(c, track, autopilot(c, track, skill), dt);
    t += dt;
    const d = dist();
    if (d < prev - L / 2){ if (start == null) start = t; else lap = t - start; }
    prev = d;
  }
  lapCache.set(key, lap ?? 999);
  return lap ?? 999;
}

export function aiQualiTimes(track, diff){
  const out = {};
  for (const d of DRIVERS){
    if (d.player) continue;
    const team = teamOf(d.team);
    let t = soloLap(track, aiSkill(d, team, diff), aiMax(team));
    t += (Math.random() - 0.5) * 0.5;
    if (Math.random() < 0.06) t += 0.8 + Math.random() * 1.5;   // ときどきミス
    out[d.id] = t;
  }
  return out;
}

// 予選のタイムからグリッド（ドライバー id の並び）を作る。playerTime が null なら SKIP_GRID 番手
export function gridFrom(times, playerTime){
  const me = DRIVERS.find(d => d.player).id;
  const rows = Object.entries(times).map(([id, t]) => ({ id, t }));
  if (playerTime != null) rows.push({ id: me, t: playerTime });
  rows.sort((a, b) => a.t - b.t);
  const order = rows.map(r => r.id);
  if (playerTime == null) order.splice(SKIP_GRID - 1, 0, me);
  return { order, rows };
}
