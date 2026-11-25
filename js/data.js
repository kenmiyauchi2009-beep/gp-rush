// 架空のチームとドライバー（実在のチーム・人物・ロゴは使わない）
// perf：チームの車の速さ（0〜1）、talent：ドライバーのうまさ（0〜1）

export const PLAYER_TEAM = 'works';

export const TEAMS = [
  { id: 'works',    name: 'GPラッシュ・ワークス',   perf: 0.45, body: '#d3202b', accent: '#f4f4f4', helmet: '#ffd23f', wing: 'GP RUSH',  text: '#d3202b' },
  { id: 'aurora',   name: 'オーロラ・レーシング',   perf: 0.95, body: '#1b2a6b', accent: '#f2c230', helmet: '#f2c230', wing: 'AURORA',   text: '#1b2a6b' },
  { id: 'kitsune',  name: 'キツネ・モータースポーツ', perf: 0.88, body: '#f2f2f2', accent: '#e0312b', helmet: '#e0312b', wing: 'KITSUNE',  text: '#ffffff' },
  { id: 'verdant',  name: 'ヴェルダント',           perf: 0.8,  body: '#0f6b4a', accent: '#c7f25a', helmet: '#c7f25a', wing: 'VERDANT',  text: '#0f6b4a' },
  { id: 'solano',   name: 'ソラーノ・コルセ',       perf: 0.72, body: '#e8711a', accent: '#1b1b1b', helmet: '#ffffff', wing: 'SOLANO',   text: '#e8711a' },
  { id: 'nordwind', name: 'ノルトヴィント',         perf: 0.64, body: '#9aa3ad', accent: '#0f9bd7', helmet: '#0f9bd7', wing: 'NORDWIND', text: '#ffffff' },
  { id: 'halcyon',  name: 'ハルシオンGP',           perf: 0.56, body: '#5b2a86', accent: '#ff6fb5', helmet: '#ff6fb5', wing: 'HALCYON',  text: '#5b2a86' },
  { id: 'coral',    name: 'コーラル・ブルー',       perf: 0.5,  body: '#14a3c7', accent: '#ffffff', helmet: '#ffffff', wing: 'CORAL',    text: '#14a3c7' },
  { id: 'meridian', name: 'メリディアン',           perf: 0.38, body: '#1c1c1c', accent: '#c9a227', helmet: '#c9a227', wing: 'MERIDIAN', text: '#1c1c1c' },
  { id: 'tundra',   name: 'ツンドラ・レーシング',   perf: 0.3,  body: '#e9eef2', accent: '#2c6fd6', helmet: '#2c6fd6', wing: 'TUNDRA',   text: '#ffffff' },
];

export const DRIVERS = [
  { id: 'you',     name: 'あなた',                 short: 'YOU', team: 'works',    num: 7,  talent: 0.5, player: true },
  { id: 'minami',  name: 'ハル・ミナミ',           short: 'MIN', team: 'works',    num: 8,  talent: 0.5 },
  { id: 'hagen',   name: 'エミル・ハーゲン',       short: 'HAG', team: 'aurora',   num: 1,  talent: 0.95 },
  { id: 'benetti', name: 'ルカ・ベネッティ',       short: 'BEN', team: 'aurora',   num: 2,  talent: 0.78 },
  { id: 'hayase',  name: 'レン・ハヤセ',           short: 'HAY', team: 'kitsune',  num: 3,  talent: 0.9 },
  { id: 'solis',   name: 'マテオ・ソリス',         short: 'SOL', team: 'kitsune',  num: 4,  talent: 0.74 },
  { id: 'vermeer', name: 'ノア・ヴェルメール',     short: 'VER', team: 'verdant',  num: 5,  talent: 0.82 },
  { id: 'cole',    name: 'イーサン・コール',       short: 'COL', team: 'verdant',  num: 6,  talent: 0.66 },
  { id: 'duarte',  name: 'ラファエル・ドゥアルテ', short: 'DUA', team: 'solano',   num: 10, talent: 0.8 },
  { id: 'leroy',   name: 'カミーユ・ルロワ',       short: 'LER', team: 'solano',   num: 11, talent: 0.62 },
  { id: 'brandt',  name: 'ヨナス・ブラント',       short: 'BRA', team: 'nordwind', num: 12, talent: 0.7 },
  { id: 'virta',   name: 'アーロ・ヴィルタネン',   short: 'VIR', team: 'nordwind', num: 14, talent: 0.6 },
  { id: 'marchan', name: 'テオ・マルシャン',       short: 'MAR', team: 'halcyon',  num: 15, talent: 0.68 },
  { id: 'crawford',name: 'アヤ・クロフォード',     short: 'CRA', team: 'halcyon',  num: 16, talent: 0.72 },
  { id: 'alvarez', name: 'ディエゴ・アルバレス',   short: 'ALV', team: 'coral',    num: 17, talent: 0.64 },
  { id: 'osulli',  name: 'フィン・オサリバン',     short: 'OSU', team: 'coral',    num: 18, talent: 0.55 },
  { id: 'orlov',   name: 'ヴィクトル・オルロフ',   short: 'ORL', team: 'meridian', num: 20, talent: 0.6 },
  { id: 'asakura', name: 'ソウタ・アサクラ',       short: 'ASA', team: 'meridian', num: 21, talent: 0.52 },
  { id: 'ekdahl',  name: 'ニルス・エクダール',     short: 'EKD', team: 'tundra',   num: 22, talent: 0.48 },
  { id: 'garnier', name: 'ジャン＝ポール・ガルニエ', short: 'GAR', team: 'tundra',   num: 23, talent: 0.45 },
];

export const teamOf = id => TEAMS.find(t => t.id === id);

// 難易度：ライバルのうまさの元（カーブの速さにだけ効く。1.0 でほぼ理想の走り。グリーンバレーの1周の目安：0.61→約47.5秒、0.725→約44.5秒、0.85→約42秒）
export const DIFFS = [
  { id: 'easy',   name: 'やさしい',   base: 0.61 },
  { id: 'normal', name: 'ふつう',     base: 0.725 },
  { id: 'hard',   name: 'むずかしい', base: 0.85 },
];

export const RACE_LAPS = 3;
export const PLAYER_GRID = 10;   // 自分のスタート位置（1〜20）
