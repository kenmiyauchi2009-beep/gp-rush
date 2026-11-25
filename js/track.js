// コース：区間の並び → セグメント（道を前後に細かく輪切りにしたもの）
// 擬似3Dの道は「セグメントごとの曲がり具合（curve）と高さ（y）」だけで表す。
import { rng, easeIn, easeInOut } from './util.js';
import { THEMES } from './themes.js';

export const SEG = 200;          // セグメント1つの長さ（ワールド単位）
export const ROAD_W = 2000;      // 道の半分の幅（ワールド単位）。x=±1 が道の端
export const RUMBLE = 3;         // 縁石の赤白が切り替わる間隔（セグメント数）
export const KERB = 1.12;        // 縁石の外側（道の半幅に対する倍率）
export const GRAVEL = 2.1;       // グラベルの外側
// 観客席（道に沿って立つ）：a＝手前の壁の位置、b＝いちばん奥の段、h＝奥の段の高さ、roof＝屋根の高さ
export const STAND = { a: 1.6, b: 3.1, h: 2300, roof: 3100, rows: 7, wall: 260 };

// 区間：[入り, 一定, 抜け, 曲がり（＋右／−左）, 抜けたあとの高さ]
// 入り・抜けは曲がりが徐々に変わる長さ。高さは SEG を1とした単位で、区間全体でなめらかに変わる。
export const COURSES = {
  valley: {
    id: 'valley', name: 'グリーンバレー・サーキット', short: 'グリーンバレー', theme: 'valley', seed: 1207,
    note: '丘とヘアピンのある、基本のコース',
    sections: [
      [0, 150, 0, 0, 0],        // メインストレート
      [25, 45, 25, 5, 0],       // 1コーナー（右）
      [30, 60, 30, 0, 12],      // 上り
      [40, 70, 40, -2.5, 18],   // 2コーナー（左の高速コーナー）
      [20, 60, 20, 0, 18],
      [15, 40, 15, 8, 14],      // 3コーナー（右のヘアピン）
      [40, 80, 40, 0, 0],       // 下り
      [15, 25, 15, -4.5, 0],    // S字
      [15, 25, 15, 4.5, 0],
      [40, 160, 40, 0, 10],     // バックストレート（丘越え）
      [40, 40, 40, 0, 0],
      [40, 90, 40, 2.5, 0],     // 7コーナー（右の高速コーナー）
      [25, 30, 25, 0, 0],
      [10, 14, 10, -6, 0],      // シケイン
      [10, 14, 10, 6, 0],
      [20, 60, 20, 0, 0],
      [30, 70, 30, -2.5, 6],    // 10コーナー（左）
      [30, 50, 30, 3.5, 0],     // 最終コーナー（右）
      [0, 90, 0, 0, 0],
    ],
  },
  bay: {
    id: 'bay', name: 'ミナト・ベイ・サーキット', short: 'ミナト・ベイ', theme: 'bay', seed: 2203,
    note: '夕方の港町。中速コーナーが続く',
    sections: [
      [0, 150, 0, 0, 0],
      [20, 40, 20, 6, 0],       // 1コーナー（右）
      [30, 80, 30, 0, 4],
      [30, 60, 30, -3, 6],      // 左の高速コーナー
      [20, 50, 20, 0, 6],
      [15, 30, 15, 5, 2],       // S字
      [15, 30, 15, -5, 0],
      [40, 120, 40, 0, 0],      // 海沿いのストレート
      [20, 40, 20, 7, 0],       // 右のきついコーナー
      [30, 60, 30, 0, 0],
      [25, 60, 25, 3, 0],
      [20, 30, 20, -4, 0],
      [20, 40, 20, 4, 0],       // 最終コーナー
      [0, 110, 0, 0, 0],
    ],
  },
  desert: {
    id: 'desert', name: 'サンドリッジ・レースウェイ', short: 'サンドリッジ', theme: 'desert', seed: 3301,
    note: '砂漠の長いストレートとヘアピン。スリップストリームが効く',
    sections: [
      [0, 160, 0, 0, 0],
      [15, 30, 15, 8, 0],       // 1コーナー（ヘアピン）
      [40, 220, 40, 0, 8],      // 長いストレート
      [25, 50, 25, -3.5, 10],
      [30, 90, 30, 0, 4],
      [15, 35, 15, 8, 0],       // 2つ目のヘアピン
      [40, 180, 40, 0, 0],      // バックストレート
      [20, 40, 20, 5, 0],
      [20, 40, 20, -5, 0],
      [30, 60, 30, 3, 0],
      [0, 110, 0, 0, 0],
    ],
  },
  alpine: {
    id: 'alpine', name: 'アルペンヴァルト・リンク', short: 'アルペンヴァルト', theme: 'alpine', seed: 4409,
    note: '森の中の山道。上り下りが大きい',
    sections: [
      [0, 150, 0, 0, 0],
      [25, 50, 25, 4, 10],      // 上りながら右
      [30, 60, 30, 0, 24],      // 急な上り
      [30, 50, 30, -5, 30],     // 頂上の左
      [20, 40, 20, 5, 28],
      [40, 80, 40, 0, 14],      // 下り
      [20, 40, 20, -7, 8],      // 下りの先の左
      [30, 70, 30, 0, 0],
      [30, 60, 30, 3, -6],      // 谷へ
      [30, 60, 30, 0, -4],
      [25, 50, 25, -4, 0],
      [25, 50, 25, 5, 0],       // 最終コーナー
      [0, 110, 0, 0, 0],
    ],
  },
  sakura: {
    id: 'sakura', name: 'サクラパーク・サーキット', short: 'サクラパーク', theme: 'sakura', seed: 5521,
    note: '桜の公園。小さなコーナーがたくさん',
    sections: [
      [0, 150, 0, 0, 0],
      [15, 25, 15, 6, 0],       // 1・2コーナー（S字）
      [15, 25, 15, -6, 0],
      [30, 60, 30, 0, 3],
      [20, 40, 20, 4.5, 5],
      [20, 50, 20, 0, 5],
      [15, 30, 15, -7, 2],      // 左のきついコーナー
      [15, 25, 15, 5, 0],
      [30, 90, 30, 0, 0],
      [20, 50, 20, -4, 0],
      [15, 30, 15, 6, 0],
      [30, 60, 30, 0, 0],
      [25, 50, 25, 3.5, 0],     // 最終コーナー
      [0, 110, 0, 0, 0],
    ],
  },
  neon: {
    id: 'neon', name: 'ネオンシティ・ストリート', short: 'ネオンシティ', theme: 'neon', seed: 6607,
    note: '夜の市街地。直角のコーナーとストレートのくり返し',
    sections: [
      [0, 160, 0, 0, 0],
      [10, 15, 10, 7, 0],       // 交差点を右
      [30, 100, 30, 0, 0],
      [10, 15, 10, 7, 0],
      [30, 60, 30, 0, 0],
      [10, 15, 10, -7, 0],
      [20, 40, 20, 0, 0],
      [10, 15, 10, 7, 0],
      [40, 140, 40, 0, 0],      // 大通り
      [10, 20, 10, 8, 0],       // ヘアピン
      [30, 60, 30, 0, 0],
      [15, 25, 15, -5, 0],      // シケイン
      [15, 25, 15, 5, 0],
      [30, 80, 30, 0, 0],
      [10, 15, 10, 6, 0],       // 最終コーナー
      [0, 110, 0, 0, 0],
    ],
  },
  coast: {
    id: 'coast', name: 'コーストハイランド', short: 'コーストハイランド', theme: 'coast', seed: 7717,
    note: '海を見ながら走る高速コース',
    sections: [
      [0, 150, 0, 0, 0],
      [40, 90, 40, 2.5, 6],     // 高速の右
      [40, 80, 40, 0, 12],
      [40, 100, 40, -3, 12],    // 長い左
      [30, 60, 30, 0, 6],
      [30, 70, 30, 4, 0],
      [40, 120, 40, 0, 0],
      [20, 40, 20, -6, 0],      // 左のきついコーナー
      [30, 80, 30, 0, 4],
      [40, 90, 40, 2.5, 4],
      [30, 50, 30, -2, 0],
      [30, 60, 30, 3, 0],       // 最終コーナー
      [0, 110, 0, 0, 0],
    ],
  },
  autumn: {
    id: 'autumn', name: 'オータムヒルズ・サーキット', short: 'オータムヒルズ', theme: 'autumn', seed: 8831,
    note: '紅葉の丘。上りのヘアピンが難しい',
    sections: [
      [0, 150, 0, 0, 0],
      [20, 40, 20, 5, 0],
      [30, 70, 30, 0, 10],
      [15, 30, 15, -8, 14],     // 上りのヘアピン（左）
      [30, 80, 30, 0, 6],
      [30, 60, 30, 3, 2],
      [20, 30, 20, -4.5, 0],    // S字
      [20, 30, 20, 4.5, 0],
      [40, 130, 40, 0, 8],      // 丘越えのストレート
      [20, 40, 20, 6, 8],
      [30, 60, 30, 0, 0],
      [30, 60, 30, -3, 0],
      [25, 50, 25, 4, 0],       // 最終コーナー
      [0, 110, 0, 0, 0],
    ],
  },
};

// シーズンの順番
export const CALENDAR = ['valley', 'bay', 'desert', 'alpine', 'sakura', 'neon', 'coast', 'autumn'];

// 道の色（セグメントごとに明暗を交互にする）
const ROAD = ['#5b5f66', '#575b62'];
const KERBS = ['#e8e8e8', '#d8262b'];
const LINE = '#f2f2f2';
const GRAVEL_C = ['#d8c48f', '#cfba84'];

// コースを組み立てる
export function buildTrack(def){
  const segs = [];
  let y = 0;
  const add = (curve, toY) => {
    const n = segs.length;
    const seg = {
      index: n,
      p1: { world: { y, z: n * SEG }, camera: {}, screen: {} },
      p2: { world: { y: toY, z: (n + 1) * SEG }, camera: {}, screen: {} },
      curve,
      sprites: [],
      cars: [],
      dark: Math.floor(n / RUMBLE) % 2,
      gravel: 0,      // -1：左にグラベル、+1：右、0：なし
      special: '',    // 'start'：スタートライン
      stands: null,   // 観客席のある側（[-1, 1] など）
      clip: 0,
    };
    segs.push(seg);
    y = toY;
  };
  for (const [enter, hold, leave, curve, h] of def.sections){
    const startY = y, endY = h * SEG, total = enter + hold + leave;
    let i = 0;
    for (let k = 0; k < enter; k++, i++) add(easeIn(0, curve, k / enter), easeInOut(startY, endY, i / total));
    for (let k = 0; k < hold; k++, i++) add(curve, easeInOut(startY, endY, i / total));
    for (let k = 0; k < leave; k++, i++) add(easeInOut(curve, 0, k / leave), easeInOut(startY, endY, i / total));
  }
  // 最後の高さを 0 に戻しておく（1周したとき段差にならないように）
  segs[segs.length - 1].p2.world.y = 0;

  const N = segs.length;
  const track = {
    def, segs, N,
    theme: THEMES[def.theme],
    length: N * SEG,
    startSeg: 10,          // スタート／フィニッシュの線のセグメント
    map: null,
    at(z){ return segs[((Math.floor(z / SEG) % N) + N) % N]; },
  };

  // スタートライン（市松模様）
  segs[track.startSeg].special = 'start';
  segs[track.startSeg + 1].special = 'start2';

  // きついコーナーの外側にグラベル
  for (const s of segs){
    if (Math.abs(s.curve) >= 4.4) s.gravel = s.curve > 0 ? -1 : 1;
  }
  // グラベルは少し前後に伸ばす（入口の手前から出口のあとまで）
  const g = segs.map(s => s.gravel);
  for (let i = 0; i < N; i++){
    if (g[i]) continue;
    for (let d = -12; d <= 18; d++){
      const v = g[(i + d + N) % N];
      if (v){ segs[i].gravel = v; break; }
    }
  }

  for (const s of segs){
    s.color = {
      road: ROAD[s.dark],
      kerb: KERBS[s.dark],
      line: LINE,
      grass: track.theme.grass[s.dark],
      gravel: GRAVEL_C[s.dark],
    };
  }

  placeScenery(track);
  track.map = buildMap(track);
  return track;
}

// 景色を置く（種が同じなら毎回同じ並び）
function placeScenery(track){
  const { segs, N, def } = track;
  const r = rng(def.seed);
  const put = (i, name, offset, extra) => segs[((i % N) + N) % N].sprites.push(Object.assign({ name, offset }, extra));

  // スタートのやぐら（信号）と、ストレートの両側の観客席
  put(track.startSeg, 'gantry', 0, { center: true });
  for (let i = track.startSeg - 34; i < track.startSeg + 112; i++){
    segs[((i % N) + N) % N].stands = [-1, 1];
  }
  // ピットの建物の代わりに、ストレートの右側に看板を並べる
  for (let i = track.startSeg + 120; i < track.startSeg + 150; i += 10) put(i, 'billboard', 1.45, { variant: (i / 10) | 0 });

  // コーナーの外側にタイヤバリア、手前に距離の看板
  for (let i = 0; i < N; i++){
    const s = segs[i];
    if (s.gravel && i % 5 === 0) put(i, 'tirewall', s.gravel * (GRAVEL + 0.05));
    if (Math.abs(s.curve) >= 4.4 && Math.abs(segs[(i - 1 + N) % N].curve) < 4.4){
      // 曲がり始めの 150・100・50 セグメント手前（およそ 300・200・100 m）
      const side = s.curve > 0 ? 1 : -1;
      if (Math.abs(s.curve) >= 6){
        [[150, '300'], [100, '200'], [50, '100']].forEach(([d, label]) => put(i - d, 'board' + label, -side * 1.3));
      }
    }
  }

  // マーシャルポスト
  for (let i = 160; i < N - 60; i += 260) put(i, 'marshal', (i / 260) % 2 ? 1.5 : -1.5);

  // 看板（スタンドの区間は除く）
  let v = 0;
  for (let i = track.startSeg + 170; i < N - 40; i += 110 + Math.floor(r() * 60)){
    const side = r() < 0.5 ? -1 : 1;
    if (segs[i].gravel === side) continue;
    put(i, 'billboard', side * 1.55, { variant: v++ });
  }

  // 街灯（夜のコース）
  const inStand = i => i > track.startSeg - 36 && i < track.startSeg + 116;
  const th = track.theme;
  if (th.lamps){
    for (let i = 0; i < N; i += 16){
      if (inStand(i)) continue;
      for (const side of [-1, 1]) if (segs[i].gravel !== side) put(i + (side > 0 ? 8 : 0), side > 0 ? 'lamp' : 'lampL', side * 1.4);
    }
  }

  // 木・茂み・岩など（テーマごとの種類と割合）
  const kinds = Object.entries(th.trees);
  const total = kinds.reduce((a, [, w]) => a + w, 0);
  const pick = () => { let x = r() * total; for (const [k, w] of kinds){ if ((x -= w) < 0) return k; } return kinds[0][0]; };
  for (let i = 0; i < N; i++){
    if (inStand(i)) continue;
    const s = segs[i];
    for (const side of [-1, 1]){
      if (r() < th.density){
        const kind = pick();
        const near = kind === 'bush' || kind === 'rock';
        const inner = s.gravel === side ? GRAVEL + 0.35 : near ? 1.4 : 1.7;
        put(i, kind, side * (inner + r() * (near ? 1.2 : 3.2)));
      }
    }
  }
}

// 小さな地図：曲がり具合を積み上げて形を作り、1周で閉じるように少し補正する
function buildMap(track){
  const { segs, N } = track;
  const K = 0.0072;              // 曲がり1あたりの向きの変化（ラジアン/セグメント）
  let total = 0;
  for (const s of segs) total += s.curve * K;
  const fix = (Math.PI * 2 * Math.sign(total || 1) - total) / N;   // ちょうど1回転に合わせる
  const pts = [];
  let a = -Math.PI / 2, x = 0, y = 0;
  for (const s of segs){
    pts.push([x, y]);
    a += s.curve * K + fix;
    x += Math.cos(a); y += Math.sin(a);
  }
  // 端の食い違いを全体に割り振る
  const ex = x, ey = y;
  for (let i = 0; i < N; i++){ pts[i][0] -= ex * i / N; pts[i][1] -= ey * i / N; }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [px, py] of pts){ minX = Math.min(minX, px); maxX = Math.max(maxX, px); minY = Math.min(minY, py); maxY = Math.max(maxY, py); }
  return { pts, minX, minY, w: maxX - minX, h: maxY - minY };
}
