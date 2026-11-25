// ガレージ：装着中のパーツ・所持品・ショップ・パーツの詳細（付け替え・強化・分解）
import { SAVE, saveGame } from './save.js';
import { toast } from './util.js';
import { SLOTS, RARITY, STATS, MAX_LV, INV_MAX, BOXES, slotOf, partStats, totalStats, powerOf, partPower, partName,
  makePart, upgradeCost, scrapValue, boxRarity, randomSlot } from './parts.js';
import { CAR, tunedCar } from './physics.js';

const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const btn = (label, cls, onclick) => { const b = h('button', cls, label); b.onclick = onclick; return b; };
const cr = n => `${Math.round(n).toLocaleString('ja-JP')} CR`;

export const garage = () => SAVE.garage;
export const equipped = slot => SAVE.garage.parts.find(p => p.id === SAVE.garage.equip[slot]);
export const carSetup = () => tunedCar(totalStats(SAVE.garage));
export const carPower = () => powerOf(totalStats(SAVE.garage));

// 性能の一覧（数字）
function statLines(st){
  const t = tunedCar(st);
  const kmh = Math.round(320 * t.max / CAR.max);
  const rows = [
    ['最高速', `${kmh} km/h`, st.top],
    ['加速', STATS.accel.fmt(st.accel), st.accel],
    ['コーナー', STATS.corner.fmt(st.corner), st.corner],
    ['グリップ', STATS.grip.fmt(st.grip), st.grip],
    ['ブレーキ', STATS.brake.fmt(st.brake), st.brake],
  ];
  for (const k of ['grass', 'tow', 'bump']) if (st[k] > 0) rows.push([STATS[k].name, STATS[k].fmt(st[k]), st[k]]);
  return rows;
}

function partLine(p, opts = {}){
  const r = RARITY[p.r], st = partStats(p), main = slotOf(p.slot).stat;
  const eq = equipped(p.slot);
  const diff = eq && eq.id !== p.id ? partPower(p) - partPower(eq) : null;
  const b = h('button', 'pline' + (opts.equipped ? ' eq' : ''));
  b.style.setProperty('--rc', r.color);
  b.innerHTML = `<i></i><span class="pn"><b>${opts.slotLabel ? slotOf(p.slot).name + '：' : ''}${partName(p)}</b>` +
    `<small>${r.name}・Lv${p.lv}　${STATS[main].name} ${STATS[main].fmt(st[main] || 0)}${p.aff.length ? '　＋' + p.aff.map(a => STATS[a.k].name).join('・') : ''}</small></span>` +
    `<span class="pd">${p.isNew ? '<em>NEW</em>' : ''}${diff != null ? `<b class="${diff > 0 ? 'up' : diff < 0 ? 'down' : ''}">${diff > 0 ? '+' : ''}${diff}</b>` : opts.equipped ? '<small>装着中</small>' : ''}</span>`;
  return b;
}

// openMenu：main.js のシートを開く関数、back：もどる先
export function openGarage(openMenu, back, tab = 'car'){
  let filter = 'all';
  const draw = () => openMenu(sh => {
    const g = SAVE.garage;
    const st = totalStats(g);
    sh.appendChild(h('h2', '', `ガレージ　<span class="crv">${cr(SAVE.cr)}</span>　<span class="pow">戦力 ${powerOf(st)}</span>`));
    const tabs = h('div', 'mtabs');
    const newCount = g.parts.filter(p => p.isNew).length;
    for (const [k, label] of [['car', 'マシン'], ['bag', `所持品 ${g.parts.length}/${INV_MAX}${newCount ? ` <em>${newCount}</em>` : ''}`], ['shop', 'ショップ']]){
      const b = btn(label, '', () => { tab = k; draw(); });
      b.setAttribute('aria-pressed', String(tab === k));
      tabs.appendChild(b);
    }
    sh.appendChild(tabs);
    const body = h('div', 'gbody');

    if (tab === 'car'){
      const stats = h('div', 'gstats');
      for (const [name, val, raw] of statLines(st)){
        stats.appendChild(h('div', 'gs', `<span>${name}</span><b class="${raw > 0 ? 'up' : ''}">${val}</b>`));
      }
      body.appendChild(stats);
      const list = h('div', 'plist');
      for (const s of SLOTS){
        const p = equipped(s.id);
        const b = partLine(p, { equipped: true, slotLabel: true });
        b.onclick = () => openPart(p);
        list.appendChild(b);
      }
      body.appendChild(list);
    } else if (tab === 'bag'){
      const chips = h('div', 'mtabs chips');
      for (const [k, label] of [['all', '全部'], ...SLOTS.map(s => [s.id, s.name])]){
        const b = btn(label, '', () => { filter = k; draw(); });
        b.setAttribute('aria-pressed', String(filter === k));
        chips.appendChild(b);
      }
      sh.appendChild(chips);
      const list = h('div', 'plist full');
      const parts = g.parts.filter(p => filter === 'all' || p.slot === filter)
        .sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0) || SLOTS.findIndex(s => s.id === a.slot) - SLOTS.findIndex(s => s.id === b.slot) || partPower(b) - partPower(a));
      for (const p of parts){
        const isEq = g.equip[p.slot] === p.id;
        const b = partLine(p, { equipped: isEq, slotLabel: true });
        b.onclick = () => openPart(p);
        list.appendChild(b);
      }
      body.appendChild(list);
    } else {
      const list = h('div', 'shop');
      for (const box of BOXES){
        const odds = box.w.map((w, i) => w ? `${RARITY[i + 1].name} ${w}%` : '').filter(Boolean).join('・');
        const b = h('button', 'box');
        b.innerHTML = `<b>${box.name}</b><small>${odds}</small><span>${cr(box.price)}</span>`;
        b.disabled = SAVE.cr < box.price || g.parts.length >= INV_MAX;
        b.onclick = () => {
          SAVE.cr -= box.price;
          const p = makePart(g, randomSlot(), boxRarity(box));
          g.parts.push(p);
          saveGame();
          openPart(p, true);
        };
        list.appendChild(b);
      }
      body.appendChild(list);
      body.appendChild(h('p', 'mnote', g.parts.length >= INV_MAX ? '所持品がいっぱい。いらないパーツを分解してから買う。' : 'パーツはランダムな部位で出る。レースでも1つもらえる（上位ほどレアが出やすい）。'));
    }
    sh.appendChild(body);
    const bs = h('div', 'rbtns');
    bs.appendChild(btn('もどる', 'primary', back));
    sh.appendChild(bs);
  });

  // パーツの詳細
  const openPart = (p, fresh = false) => openMenu(sh => {
    const g = SAVE.garage;
    p.isNew = false;
    saveGame();
    const r = RARITY[p.r], st = partStats(p), main = slotOf(p.slot).stat;
    const eq = equipped(p.slot), isEq = eq.id === p.id;
    sh.appendChild(h('h2', '', fresh ? '新しいパーツ！' : 'パーツ'));
    const card = h('div', 'pcard');
    card.style.setProperty('--rc', r.color);
    let html = `<div class="ph"><b>${partName(p)}</b><small>${slotOf(p.slot).name}・${r.name}・Lv${p.lv}／${MAX_LV}</small></div><ul>`;
    html += `<li class="main"><span>${STATS[main].name}</span><b>${STATS[main].fmt(st[main] || 0)}</b></li>`;
    for (const a of p.aff) html += `<li><span>${STATS[a.k].name}</span><b>${STATS[a.k].fmt(partStats({ ...p, aff: [a], r: p.r, slot: p.slot })[a.k] || 0)}</b></li>`;
    if (!p.aff.length && p.r > 0) html += '<li class="none"><span>付与効果なし（アンコモン以上で付く）</span></li>';
    html += '</ul>';
    if (!isEq){
      const d = partPower(p) - partPower(eq);
      html += `<p class="cmp">いま付けている「${partName(eq)}」と比べて 戦力 <b class="${d > 0 ? 'up' : d < 0 ? 'down' : ''}">${d > 0 ? '+' : ''}${d}</b></p>`;
    } else html += '<p class="cmp">装着中</p>';
    card.innerHTML = html;
    sh.appendChild(card);

    const bs = h('div', 'rbtns wrap');
    if (!isEq) bs.appendChild(btn('装着する', 'primary', () => { g.equip[p.slot] = p.id; saveGame(); toast(`${partName(p)} を装着した`); openPart(p); }));
    if (p.r > 0 && p.lv < MAX_LV){
      const cost = upgradeCost(p);
      const b = btn(`強化 Lv${p.lv + 1}<small>${cr(cost)}</small>`, '', () => { SAVE.cr -= cost; p.lv++; saveGame(); openPart(p); });
      b.disabled = SAVE.cr < cost;
      bs.appendChild(b);
    }
    if (p.r > 0 && !isEq){
      const v = scrapValue(p);
      bs.appendChild(btn(`分解<small>+${cr(v)}</small>`, '', () => {
        SAVE.cr += v;
        g.parts.splice(g.parts.indexOf(p), 1);
        saveGame();
        toast(`分解して ${cr(v)} を受け取った`);
        draw();
      }));
    }
    bs.appendChild(btn('もどる', '', draw));
    sh.appendChild(bs);
    sh.appendChild(h('p', 'mnote', `所持 ${cr(SAVE.cr)}`));
  });

  draw();
}

// レースのあと：パーツを1つもらう（所持品がいっぱいなら分解して CR にする）
export function grantPart(slot, r){
  const g = SAVE.garage;
  const p = makePart(g, slot, r);
  if (g.parts.length >= INV_MAX){
    const v = scrapValue(p);
    SAVE.cr += v;
    return { p, scrapped: v };
  }
  g.parts.push(p);
  return { p, scrapped: 0 };
}

export { RARITY, partName, cr };
