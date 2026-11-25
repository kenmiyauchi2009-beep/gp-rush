// レースの進行：グリッド・ライバルの運転・接触・スリップストリーム・周回と順位
import { SEG, ROAD_W } from './track.js';
import { CAR, newCar, updateCar, autopilot, posOf } from './physics.js';
import { PLAYER_Z } from './render.js';
import { CAR_W } from './carart.js';
import { DRIVERS, teamOf, PLAYER_GRID } from './data.js';
import { gripOf, wearRate, COMPOUNDS } from './weather.js';

export const PIT_LOSS = 8.5;                  // ピットで止まっている時間（秒。ピットレーンを走る分も含む）


export const CAR_LEN = 700;                    // 車の前後の長さ（ワールド単位）
const HALF = CAR_W / ROAD_W / 2;               // 車の半分の幅（道の半幅を1とした値）
const TOUCH = HALF * 2 * 0.9;                  // 横にこれより近いと当たる

const mod = (a, n) => ((a % n) + n) % n;

// ライバルのうまさと最高速（難易度＋チームの速さ＋ドライバーの腕）
export const aiSkill = (d, team, diff) => diff + (team.perf - 0.5) * 0.08 + (d.talent - 0.5) * 0.05;
export const aiMax = team => CAR.max * (0.975 + team.perf * 0.025);

// opts = { diff（難易度の base）, laps（周回数。練習は Infinity）, practice, arts（チーム id → 車の絵）, playerArt,
//          grid（ドライバー id の並び。省略すると速い順で、自分は PLAYER_GRID 番手）, setup（自分の車の性能 tunedCar） }
export function createRace(track, opts){
  const L = track.length, line = track.startSeg * SEG;
  const entries = opts.practice ? DRIVERS.filter(d => d.player) : DRIVERS.slice();
  let grid;
  if (opts.grid && !opts.practice){
    grid = opts.grid.map(id => entries.find(d => d.id === id)).filter(Boolean);
  } else {
    // 速い順にグリッドに並べ、自分は決まった位置に入れる
    const ai = entries.filter(d => !d.player)
      .sort((a, b) => (teamOf(b.team).perf + b.talent * 0.6) - (teamOf(a.team).perf + a.talent * 0.6));
    grid = ai.slice();
    const me = entries.find(d => d.player);
    grid.splice(opts.practice ? 0 : Math.min(PLAYER_GRID - 1, grid.length), 0, me);
  }

  const cars = grid.map((d, g) => {
    const team = teamOf(d.team);
    const front = mod(line - (opts.practice ? (opts.runup || 30) : 12 + g * 4) * SEG, L);
    const off = d.player ? PLAYER_Z : 0;
    const c = newCar(mod(front - off, L), off);
    c.x = opts.practice ? 0 : (g % 2 ? 0.45 : -0.45);
    c.driver = d; c.team = team; c.player = !!d.player;
    c.grid = g + 1;
    c.art = d.player ? opts.playerArt : opts.arts[team.id];
    // うまさ：難易度＋チームの速さ＋ドライバーの腕。少しだけ最高速にも差をつける
    c.skill = d.player ? 1 : aiSkill(d, team, opts.diff);
    c.max = d.player ? (opts.setup ? opts.setup.max : CAR.max) : aiMax(team);
    if (d.player && opts.setup) c.p = opts.setup.p;   // パーツで強くなった自分の車
    c.react = d.player ? 0 : 0.12 + Math.random() * 0.35;   // スタートの反応
    c.lapsDone = -1;          // スタートラインの手前にいるので -1。最初にラインを越えると 0
    c.lapStart = 0;
    c.lapT = 0;
    c.best = null;
    c.lastLap = null;
    c.finished = false;
    c.finishT = null;
    c.prevD = lineDist(c, track);
    c.side = 0;               // 追い越しで寄せている側
    // タイヤ
    c.tyre = d.player ? (opts.tyre || 'medium') : aiStartTyre(opts, d, team);
    c.wear = 0;
    c.grip = gripOf(c.tyre, 0, opts.weather || 'sun');
    c.pitReq = null;          // ピットで替えるタイヤ（予約）
    c.pitT = 0;               // ピットで止まっている残り時間
    c.inPit = false;
    c.stops = 0;
    return c;
  });
  return {
    track, cars, player: cars.find(c => c.player),
    weather: opts.weather || 'sun',
    laps: opts.laps, practice: !!opts.practice,
    t: 0, started: false,
    events: [],               // 自分に起きたこと（周回・ゴール・接触）
  };
}

// ライバルのスタートのタイヤ
function aiStartTyre(opts, d, team){
  if (opts.weather === 'rain') return 'wet';
  const laps = opts.laps === Infinity ? 3 : opts.laps;
  const r = Math.random();
  if (laps <= 3) return r < 0.75 ? 'soft' : 'medium';
  if (laps <= 5) return r < 0.3 ? 'soft' : r < 0.85 ? 'medium' : 'hard';
  return r < 0.15 ? 'soft' : r < 0.6 ? 'medium' : 'hard';
}

// 残りの周回に合うタイヤ
function pickTyre(weather, remain){
  if (weather === 'rain') return 'wet';
  if (remain * COMPOUNDS.soft.wear <= 0.8) return 'soft';
  if (remain * COMPOUNDS.medium.wear <= 0.85) return 'medium';
  return 'hard';
}

// ライバルがピットに入るか（ラインを越えたときに決める）
function aiWantsPit(c, race){
  const remain = race.laps - c.lapsDone;
  if (race.laps === Infinity || remain < 1) return null;
  if (race.weather !== 'rain' && c.tyre === 'wet') return pickTyre(race.weather, remain);
  if (race.weather === 'rain' && c.tyre !== 'wet') return 'wet';
  const rate = wearRate(c.tyre, race.weather);
  if (c.wear > 0.45 && c.wear + rate * remain > 0.92) return pickTyre(race.weather, remain);
  return null;
}

export function lineDist(c, track){
  return mod(posOf(c, track) - track.startSeg * SEG, track.length);
}

// 進み具合（順位の計算用）
const progress = (c, track) => c.lapsDone * track.length + lineDist(c, track);

export function standings(race){
  const { track } = race;
  return race.cars.slice().sort((a, b) => {
    if (a.finished && b.finished) return a.finishT - b.finishT;
    if (a.finished) return -1;
    if (b.finished) return 1;
    return progress(b, track) - progress(a, track);
  });
}

// ライバルの運転：前に遅い車がいたら、空いている側へよける。よけられなければ後ろにつく
function aiControl(c, race){
  const { track, cars } = race, L = track.length, my = posOf(c, track);
  let block = null, bdz = Infinity;
  for (const o of cars){
    if (o === c || o.inPit) continue;
    const dz = mod(posOf(o, track) - my, L);
    if (dz <= 0 || dz > 26 * SEG) continue;
    if (Math.abs(o.x - c.x) > 0.55) continue;
    // 追いつきそうな車（自分より遅い）か、すぐ前の車
    if (o.speed < c.speed * 1.01 || dz < CAR_LEN * 1.8){
      if (dz < bdz){ bdz = dz; block = o; }
    }
  }
  let target = null, follow = false;
  if (block){
    const free = side => {
      const t = block.x + side * 0.58;
      if (Math.abs(t) > 0.88) return false;
      for (const o of cars){
        if (o === c || o === block || o.inPit) continue;
        const dz = mod(posOf(o, track) - my + L / 2, L) - L / 2;   // 前後の差（-L/2〜L/2）
        if (dz > -CAR_LEN * 1.2 && dz < 22 * SEG && Math.abs(o.x - t) < 0.42) return false;
      }
      return true;
    };
    // 前回と同じ側が空いていればそのまま（左右にふらつかない）
    let side = c.side && free(c.side) ? c.side : 0;
    if (!side){
      const order = c.x <= block.x ? [-1, 1] : [1, -1];
      side = order.find(free) || 0;
    }
    c.side = side;
    if (side) target = block.x + side * 0.58;
    else follow = true;
  } else {
    c.side = 0;
  }
  const ctl = autopilot(c, track, c.skill, target);
  if (follow && bdz < CAR_LEN * 3){
    ctl.throttle = c.speed < block.speed * 0.99;
    if (bdz < CAR_LEN * 1.6 && c.speed > block.speed) ctl.brake = true;
  }
  return ctl;
}

// スリップストリーム：前の車の真後ろ（4〜30セグメント）にいると最高速が少し上がる
function towFor(c, race){
  const { track, cars } = race, L = track.length, my = posOf(c, track);
  let tow = 0;
  for (const o of cars){
    if (o === c || o.inPit) continue;
    const dz = mod(posOf(o, track) - my, L);
    if (dz < 4 * SEG || dz > 30 * SEG) continue;
    if (Math.abs(o.x - c.x) > 0.35) continue;
    tow = Math.max(tow, 1 - (dz - 4 * SEG) / (26 * SEG));
  }
  return tow;
}

// 車どうしの接触
function contacts(race){
  const { track, cars } = race, L = track.length;
  for (let i = 0; i < cars.length; i++){
    for (let j = i + 1; j < cars.length; j++){
      const a = cars[i], b = cars[j];
      if (a.inPit || b.inPit) continue;
      const dx = b.x - a.x;
      if (Math.abs(dx) >= TOUCH) continue;
      let dz = mod(posOf(b, track) - posOf(a, track), L);
      let back = a, front = b;
      if (dz > L / 2){ dz = L - dz; back = b; front = a; }
      if (dz >= CAR_LEN) continue;
      // 前後：後ろの車が速ければ前の車の速さに合わせ、前の車を少し押す
      if (back.speed > front.speed){
        const rel = back.speed - front.speed;
        // 接触に強いパーツ（bumpRes）があると、落ちる速さが少ない
        const res = (back.p && back.p.bumpRes) || 0;
        back.speed = front.speed * 0.97 + (back.speed - front.speed * 0.97) * res * 0.6;
        front.speed += rel * 0.15;
        if ((back.player || front.player) && rel > CAR.max * 0.04) race.events.push({ type: 'bump', rel });
      }
      // 横：押し合って離れる
      const overlap = TOUCH - Math.abs(dx);
      const s = Math.sign(dx) || (Math.random() < 0.5 ? -1 : 1);
      a.x -= s * overlap * 0.5;
      b.x += s * overlap * 0.5;
      // めり込まないように後ろの車を下げる
      if (dz < CAR_LEN * 0.7 && overlap > TOUCH * 0.5){
        back.z = mod(back.z - (CAR_LEN * 0.7 - dz), L);
      }
    }
  }
}

// 1ステップ進める。playerCtl：自分の操作（null なら自動で走る）
export function stepRace(race, dt, playerCtl){
  const { track, cars } = race;
  if (race.started) race.t += dt;
  for (const c of cars) c.tow = race.started ? towFor(c, race) : 0;
  for (const c of cars){
    // ピットで止まっている
    if (c.inPit){
      c.speed = 0;
      c.pitT -= dt;
      if (c.pitT <= 0){
        c.inPit = false;
        c.tyre = c.newTyre;
        c.wear = 0;
        c.stops++;
        c.speed = CAR.max * 0.3;
        c.grip = gripOf(c.tyre, 0, race.weather);
        if (c.player) race.events.push({ type: 'pitOut', tyre: c.tyre });
      }
      continue;
    }
    let ctl;
    if (!race.started) ctl = { steer: 0, brake: false, throttle: false };
    else if (c.player && playerCtl && !c.finished) ctl = playerCtl;
    else if (!c.player && race.t < c.react) ctl = { steer: 0, brake: false, throttle: false };
    else if (c.player) ctl = autopilot(c, track, 0.85);
    else ctl = aiControl(c, race);
    updateCar(c, track, ctl, dt);
    if (c.player && c.hit) race.events.push({ type: 'hit' });
    // タイヤが減る（走った距離と、ハンドルを切っている分）
    if (race.started){
      c.wear = Math.min(1, c.wear + c.speed * dt / track.length * wearRate(c.tyre, race.weather) * (1 + 0.3 * Math.abs(c.steer)));
      c.grip = gripOf(c.tyre, c.wear, race.weather);
    }
  }
  if (cars.length > 1) contacts(race);

  // 周回
  for (const c of cars){
    const d = lineDist(c, track);
    // ゴールしたあとは周回を数えない（そのまま流して走るだけ）
    if (c.finished){ c.prevD = d; continue; }
    if (d < c.prevD - track.length / 2){
      c.lapsDone++;
      if (c.lapsDone >= 1){
        const lap = race.t - c.lapStart;
        c.lastLap = lap;
        const isBest = c.best == null || lap < c.best;
        if (isBest) c.best = lap;
        if (c.player) race.events.push({ type: 'lap', lap, isBest, n: c.lapsDone });
      } else if (c.player){
        race.events.push({ type: 'go' });
      }
      c.lapStart = race.t;
      // 1位がゴールしたあとは、周回遅れの車もラインを越えたところでゴール
      if ((c.lapsDone >= race.laps || (race.leaderDone && c.lapsDone >= 1)) && !c.finished){
        c.finished = true;
        c.finishT = race.t;
        race.leaderDone = true;
        if (c.player) race.events.push({ type: 'finish' });
      } else if (c.lapsDone >= 0){
        // ピット：自分は予約していたら、ライバルはタイヤの減り具合で決める
        const want = c.player ? c.pitReq : (race.started ? aiWantsPit(c, race) : null);
        if (want){
          c.inPit = true;
          c.pitT = PIT_LOSS + (c.player ? 0 : Math.random() * 0.8);
          c.newTyre = want;
          c.pitReq = null;
          c.speed = 0;
          if (c.player) race.events.push({ type: 'pitIn', tyre: want });
        }
      }
    }
    c.prevD = d;
    c.lapT = c.lapsDone >= 0 ? race.t - c.lapStart : 0;
  }
}

// 自分がゴールしたあと、残りの車がゴールするまで一気に進める（結果を出すため）
export function simulateToEnd(race){
  const dt = 1 / 60;
  const limit = race.t + 120;
  while (race.cars.some(c => !c.finished) && race.t < limit) stepRace(race, dt, null);
  race.events.length = 0;
}

// 結果の表
export function results(race){
  const st = standings(race);
  const win = st[0];
  return st.map((c, i) => {
    let gap;
    if (i === 0) gap = null;
    else if (!c.finished || c.lapsDone < win.lapsDone){
      const down = Math.max(1, win.lapsDone - c.lapsDone);
      gap = `+${down}周`;
    } else gap = c.finishT - win.finishT;
    return { pos: i + 1, car: c, time: c.finishT, gap, best: c.best };
  });
}

// 自分の前後の車との差（秒）。前の車：ahead、後ろの車：behind
export function gaps(race){
  const st = standings(race);
  const i = st.indexOf(race.player);
  const p = race.player, v = Math.max(p.speed, CAR.max * 0.3);
  const L = race.track.length;
  const ahead = i > 0 ? (progress(st[i - 1], race.track) - progress(p, race.track)) / v : null;
  const behind = i < st.length - 1 ? (progress(p, race.track) - progress(st[i + 1], race.track)) / v : null;
  return { pos: i + 1, of: st.length, ahead: ahead != null ? Math.min(ahead, 99.9) : null, behind: behind != null ? Math.min(behind, 99.9) : null, L };
}

