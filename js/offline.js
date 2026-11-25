// service worker の登録とオフライン状態
import { toast } from './util.js';

const supported = () => 'serviceWorker' in navigator && window.isSecureContext;

// 手元（localhost）で開発しているときは、古いファイルが残らないように使わない（?sw=1 で使う）
const devHost = () => /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) && !/[?&]sw=1/.test(location.search);

export function setupOffline(){
  if (!supported()) return;
  if (devHost()){
    navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister())).catch(() => {});
    return;
  }
  let controlled = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    const first = !controlled;    // 初回のインストールでは知らせない
    controlled = true;
    if (!first) toast('新しい版を受け取りました。次に起動したときに切り替わります', 3200);
  });
  navigator.serviceWorker.register('sw.js', {updateViaCache:'none'}).then(reg => {
    // ホーム画面のアプリは開きっぱなしになりやすいので、前面に戻ったときも更新を確認する
    document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
  }).catch(() => {});
}

export async function offlineStatus(){
  if (!('serviceWorker' in navigator)) return 'オフライン：未対応のブラウザです。';
  if (!window.isSecureContext) return 'オフライン：https（GitHub Pages など）か localhost で開いたときだけ有効になります。';
  let ver = '';
  try { ver = (await caches.keys()).find(k => k.startsWith('gprush-')) || ''; } catch(e){}
  if (navigator.serviceWorker.controller && ver) return `オフライン：有効（${ver.replace('gprush-', '版 ')}）。機内モードでも起動できます。`;
  return 'オフライン：準備中。一度アプリを閉じて開き直すと有効になります。';
}
