// 操作：画面の左半分＝左、右半分＝右、両方＝ブレーキ（キーボードは ← → ↓）
import { $ } from './util.js';

export const input = { left: false, right: false, brake: false };
const ptrs = new Map();    // 押している指 → -1（左）／1（右）
const keys = new Set();
let el = null;

const sideOf = e => (e.clientX < window.innerWidth / 2 ? -1 : 1);

function update(){
  let l = keys.has('L'), r = keys.has('R');
  for (const s of ptrs.values()){ if (s < 0) l = true; else r = true; }
  input.brake = (l && r) || keys.has('B');
  input.left = l && !r;
  input.right = r && !l;
  $('padL').classList.toggle('on', l);
  $('padR').classList.toggle('on', r);
}

export function steerInput(){ return input.left ? -1 : input.right ? 1 : 0; }

export function clearInput(){ ptrs.clear(); keys.clear(); update(); }

export function setupInput(stage){
  el = stage;
  const down = e => {
    if (e.target.closest('button') || e.target.closest('#pause')) return;
    ptrs.set(e.pointerId, sideOf(e));
    try { el.setPointerCapture(e.pointerId); } catch(_){}
    update();
  };
  const move = e => { if (ptrs.has(e.pointerId)){ ptrs.set(e.pointerId, sideOf(e)); update(); } };
  const up = e => { if (ptrs.delete(e.pointerId)) update(); };
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('lostpointercapture', up);
  // 長押しのメニューや拡大を出さない
  el.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('gesturestart', e => e.preventDefault());

  const map = { ArrowLeft: 'L', KeyA: 'L', ArrowRight: 'R', KeyD: 'R', ArrowDown: 'B', KeyS: 'B', Space: 'B' };
  window.addEventListener('keydown', e => { const k = map[e.code]; if (k){ keys.add(k); update(); e.preventDefault(); } });
  window.addEventListener('keyup', e => { const k = map[e.code]; if (k){ keys.delete(k); update(); } });
  window.addEventListener('blur', clearInput);
}
