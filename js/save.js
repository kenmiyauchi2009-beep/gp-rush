// セーブ（localStorage に JSON で1つ）
const KEY = 'gprush-save';
export const SAVE_VERSION = 1;

export function newSave(){
  return { v: SAVE_VERSION, best: {}, settings: { sound: true } };
}

export let SAVE = newSave();

export function loadGame(){
  let raw = null;
  try { raw = localStorage.getItem(KEY); } catch(e){ return 'none'; }
  if (!raw) return 'new';
  try {
    const d = JSON.parse(raw);
    SAVE = Object.assign(newSave(), d);
    SAVE.settings = Object.assign(newSave().settings, d.settings || {});
    SAVE.best = d.best || {};
    return 'ok';
  } catch(e){
    // 読めないデータは消さずに別名で残しておく
    try { localStorage.setItem(KEY + '-broken-' + Date.now(), raw); } catch(_){}
    SAVE = newSave();
    return 'broken';
  }
}

let lastWritten = '';
export function saveGame(){
  const s = JSON.stringify(SAVE);
  if (s === lastWritten) return;
  try { localStorage.setItem(KEY, s); lastWritten = s; } catch(e){}
}
