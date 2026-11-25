// 設定：音量・操作（ハンドルの効き・ブレーキアシスト）・画質・セーブの書き出しと読み込み
import { SAVE, saveGame, blockSave } from './save.js';
import { toast } from './util.js';
import { offlineStatus } from './offline.js';
import { setVolumes, setMuted, setBgmEnabled } from './audio.js';
import { setQuality } from './render.js';

export const STEER_FEEL = [
  { id: 'slow',   name: 'ゆっくり', k: 0.6 },
  { id: 'normal', name: 'ふつう',   k: 1 },
  { id: 'quick',  name: 'すばやい', k: 1.6 },
];
export const QUALITY = [
  { id: 'high',   name: 'きれい' },
  { id: 'normal', name: 'ふつう' },
  { id: 'eco',    name: '省電力' },
];

export function defaultSettings(st){
  if (st.sfxVol == null) st.sfxVol = 80;
  if (st.bgmVol == null) st.bgmVol = 70;
  if (!st.steerFeel) st.steerFeel = 'normal';
  if (st.assist == null) st.assist = false;
  if (!st.quality) st.quality = 'high';
}

// 設定を音・画面に反映する
export function applySettings(){
  const st = SAVE.settings;
  defaultSettings(st);
  setMuted(!st.sound);
  setBgmEnabled(st.bgm);
  setVolumes(st.sfxVol / 100, st.bgmVol / 100);
  setQuality(st.quality);
}

export const steerK = () => (STEER_FEEL.find(s => s.id === SAVE.settings.steerFeel) || STEER_FEEL[1]).k;

const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const btn = (label, cls, onclick) => { const b = h('button', cls, label); b.onclick = onclick; return b; };

function seg(label, items, cur, onPick){
  const row = h('div', 'srow');
  row.appendChild(h('span', 'sl', label));
  const box = h('div', 'diff');
  for (const it of items){
    const b = btn(it.name, '', () => onPick(it.id));
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(it.id === cur));
    box.appendChild(b);
  }
  row.appendChild(box);
  return row;
}

function slider(label, val, onInput){
  const row = h('div', 'srow');
  row.appendChild(h('span', 'sl', label));
  const r = document.createElement('input');
  r.type = 'range'; r.min = '0'; r.max = '100'; r.step = '5'; r.value = String(val);
  r.setAttribute('aria-label', label);
  const out = h('b', 'sv', String(val));
  r.oninput = () => { out.textContent = r.value; onInput(+r.value); };
  r.onchange = () => saveGame();
  row.append(r, out);
  return row;
}

export function openSettings(openMenu, back){
  const st = SAVE.settings;
  defaultSettings(st);
  const set = (k, v) => { st[k] = v; applySettings(); saveGame(); draw(); };
  const draw = () => openMenu(async sh => {
    sh.appendChild(h('h2', '', '設定'));
    const body = h('div', 'sbody');
    body.appendChild(h('h3', '', '音'));
    body.appendChild(seg('効果音', [{ id: true, name: 'ON' }, { id: false, name: 'OFF' }], st.sound, v => set('sound', v)));
    body.appendChild(slider('効果音の音量', st.sfxVol, v => { st.sfxVol = v; applySettings(); }));
    body.appendChild(seg('BGM', [{ id: true, name: 'ON' }, { id: false, name: 'OFF' }], st.bgm, v => set('bgm', v)));
    body.appendChild(slider('BGM の音量', st.bgmVol, v => { st.bgmVol = v; applySettings(); }));
    body.appendChild(h('h3', '', '操作'));
    body.appendChild(seg('ハンドルの効き', STEER_FEEL, st.steerFeel, v => set('steerFeel', v)));
    body.appendChild(seg('ブレーキアシスト', [{ id: false, name: 'OFF' }, { id: true, name: 'ON' }], st.assist, v => set('assist', v)));
    body.appendChild(h('p', 'mnote left', 'ブレーキアシスト：速すぎるとカーブの手前で自動でブレーキがかかる。両方押しのブレーキが苦手なときに。'));
    body.appendChild(h('h3', '', '画面'));
    body.appendChild(seg('画質', QUALITY, st.quality, v => set('quality', v)));
    body.appendChild(h('p', 'mnote left', '省電力：解像度を下げ、遠くを描く距離を短くして、1秒に30回だけ描く。電池が長くもつ。'));
    body.appendChild(h('h3', '', 'セーブ'));
    const data = h('div', 'rbtns wrap');
    data.appendChild(btn('書き出す', '', () => openExport(openMenu, draw)));
    data.appendChild(btn('読み込む', '', () => openImport(openMenu, draw)));
    data.appendChild(btn('すべて消す', 'danger', () => openReset(openMenu, draw)));
    body.appendChild(data);
    const off = h('p', 'mnote left', '');
    body.appendChild(off);
    sh.appendChild(body);
    const bs = h('div', 'rbtns');
    bs.appendChild(btn('もどる', 'primary', back));
    sh.appendChild(bs);
    off.textContent = await offlineStatus();
  });
  draw();
}

// セーブを文字にして書き出す（別の端末に移すときや、控えに）
function openExport(openMenu, back){
  openMenu(sh => {
    sh.appendChild(h('h2', '', 'セーブを書き出す'));
    sh.appendChild(h('p', 'mnote', '下の文字をすべてコピーして、メモなどに保存する。読み込むときはこの文字を貼り付ける。'));
    const ta = document.createElement('textarea');
    ta.className = 'sdata';
    ta.readOnly = true;
    ta.value = 'GPRUSH1:' + btoa(unescape(encodeURIComponent(JSON.stringify(SAVE))));
    sh.appendChild(ta);
    const bs = h('div', 'rbtns');
    bs.appendChild(btn('コピー', 'primary', async () => {
      try { await navigator.clipboard.writeText(ta.value); toast('コピーした'); }
      catch(e){ ta.select(); toast('選んだ文字を長押ししてコピーする'); }
    }));
    bs.appendChild(btn('もどる', '', back));
    sh.appendChild(bs);
  });
}

function openImport(openMenu, back){
  openMenu(sh => {
    sh.appendChild(h('h2', '', 'セーブを読み込む'));
    sh.appendChild(h('p', 'mnote', '書き出した文字を貼り付けて「読み込む」。いまのセーブは上書きされる。'));
    const ta = document.createElement('textarea');
    ta.className = 'sdata';
    ta.placeholder = 'GPRUSH1:…';
    sh.appendChild(ta);
    const bs = h('div', 'rbtns');
    bs.appendChild(btn('読み込む', 'primary', () => {
      const txt = ta.value.trim();
      try {
        if (!txt.startsWith('GPRUSH1:')) throw new Error('form');
        const d = JSON.parse(decodeURIComponent(escape(atob(txt.slice(8)))));
        if (!d || typeof d !== 'object' || !d.settings) throw new Error('data');
        blockSave();
        localStorage.setItem('gprush-save', JSON.stringify(d));
        localStorage.removeItem('gprush-run');
        toast('読み込んだ。起動し直す');
        setTimeout(() => location.reload(), 800);
      } catch(e){
        toast('読み込めなかった。書き出した文字をそのまま貼り付ける');
      }
    }));
    bs.appendChild(btn('もどる', '', back));
    sh.appendChild(bs);
  });
}

function openReset(openMenu, back){
  openMenu(sh => {
    sh.appendChild(h('h2', '', 'セーブをすべて消す'));
    sh.appendChild(h('p', 'mnote', 'パーツ・CR・シーズン・記録・実績・設定がすべて消える。元に戻せない。<br>消す前に「書き出す」で控えを取っておくと、あとで読み込める。'));
    const bs = h('div', 'rbtns');
    bs.appendChild(btn('すべて消す', 'danger', () => {
      blockSave();
      localStorage.removeItem('gprush-save');
      localStorage.removeItem('gprush-run');
      toast('消した。起動し直す');
      setTimeout(() => location.reload(), 800);
    }));
    bs.appendChild(btn('やめる', 'primary', back));
    sh.appendChild(bs);
  });
}
