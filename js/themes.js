// サーキットごとの景色（空の色・霧・芝・背景・木の種類・時間帯の色味）
// tint：景色全体にかける色味 [色, 強さ]（夕方・夜）
// far：遠くの背景（mountains / snowy / city / dunes / sea）、near：手前の背景（hills / forest / none）
// trees：道ばたに置くものと割合、density：置く多さ、lamps：街灯を並べるか
export const THEMES = {
  valley: {
    time: '昼', sky: ['#3d86d6', '#8cc4f0', '#d9eefa'], fog: '#cfe6f5', grass: ['#4f9a3a', '#468c33'],
    far: { type: 'mountains', c: '#7f97b8' }, near: { type: 'hills', c: ['#4d8a43', '#8bb98a'], forest: ['#2f6a35', '#5d9a58'] },
    clouds: 1, trees: { tree: 0.6, pine: 0.4 }, density: 0.32, tint: null,
  },
  bay: {
    time: '夕方', sky: ['#2b3a78', '#e8775a', '#ffd59a'], fog: '#f2b48a', grass: ['#5b8a3a', '#527f34'],
    far: { type: 'city', c: '#4a3e5c', lit: 0.25 }, near: { type: 'sea', c: ['#5a6fa0', '#f0a77a'] },
    clouds: 0.7, trees: { palm: 0.6, tree: 0.25, bush: 0.15 }, density: 0.22, tint: ['#ff7a3d', 0.14],
  },
  desert: {
    time: '昼', sky: ['#2f86d9', '#a9d4f2', '#f5e6c8'], fog: '#f0dfc0', grass: ['#d9b57a', '#cfa96c'],
    far: { type: 'dunes', c: '#c9875a' }, near: { type: 'none' },
    clouds: 0.2, trees: { cactus: 0.55, rock: 0.45 }, density: 0.14, tint: null,
  },
  alpine: {
    time: '朝', sky: ['#4a7fc4', '#a8cdee', '#eef6fb'], fog: '#dfeaf2', grass: ['#5c8f4a', '#53844a'],
    far: { type: 'snowy', c: '#6f86a8' }, near: { type: 'forest', c: ['#2c5a3a', '#6f9a78'], forest: ['#1d4a2c', '#3f7050'] },
    clouds: 0.8, trees: { pine: 0.85, tree: 0.15 }, density: 0.42, tint: null,
  },
  sakura: {
    time: '昼', sky: ['#6aa6e0', '#bcdcf5', '#fbeef2'], fog: '#f3e3ea', grass: ['#67a84a', '#5e9c43'],
    far: { type: 'mountains', c: '#8d9cc0' }, near: { type: 'hills', c: ['#5f9a4c', '#a9c79a'], forest: ['#e7a1c0', '#c98aa8'] },
    clouds: 0.9, trees: { sakura: 0.7, tree: 0.3 }, density: 0.34, tint: null,
  },
  neon: {
    time: '夜', sky: ['#04061a', '#0f1940', '#2c2b63'], fog: '#1d2147', grass: ['#2a4a35', '#25432f'],
    far: { type: 'city', c: '#141a3a', lit: 0.6 }, near: { type: 'none' },
    clouds: 0, stars: true, trees: { tree: 0.5, bush: 0.5 }, density: 0.12, lamps: true, tint: ['#0a0f2e', 0.45],
  },
  coast: {
    time: '昼', sky: ['#2f7fd6', '#86c3f2', '#e6f4fb'], fog: '#d6ecf7', grass: ['#6fae4c', '#64a045'],
    far: { type: 'sea', c: ['#2a6fb5', '#9fd3f0'] }, near: { type: 'none' },
    clouds: 0.8, trees: { palm: 0.45, bush: 0.3, rock: 0.25 }, density: 0.2, tint: null,
  },
  autumn: {
    time: 'くもり', sky: ['#7d8ea5', '#b9c4d1', '#e3e6ea'], fog: '#d4d8dd', grass: ['#7a9a45', '#71903f'],
    far: { type: 'mountains', c: '#8a8a9a' }, near: { type: 'hills', c: ['#a5652f', '#c8a37a'], forest: ['#b8501f', '#d98a3a'] },
    clouds: 1, trees: { autumn: 0.6, pine: 0.2, tree: 0.2 }, density: 0.36, tint: ['#7a5a3a', 0.06],
  },
};
