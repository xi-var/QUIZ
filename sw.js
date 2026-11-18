// 앱 껍데기(HTML, CSS, JS, 아이콘)를 기기에 저장해서 인터넷 없이도 열리게 해요.
// 새 버전을 올릴 때는 아래 CACHE 이름의 숫자를 올려 주세요.
const CACHE = 'quiznote-v3';
const SHELL = [
  './', './index.html', './style.css', './engine.js', './app.js',
  './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-180.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 같은 주소의 파일만 다뤄요. 저장본을 먼저 보여 주고, 뒤에서 새 파일을 받아 갱신해요.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req)
        .then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
          return res;
        })
        .catch(() => hit);
      return hit || net;
    })
  );
});
