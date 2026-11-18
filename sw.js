// 앱 껍데기(HTML, CSS, JS, 아이콘)를 기기에 저장해서 다음부터는 바로 열리고, 인터넷 없이도 열리게 해요.
// 새 버전을 올릴 때는 아래 CACHE 이름의 숫자를 올려 주세요.
const CACHE = 'quiznote-v16';
const SHELL = [
  './', './index.html', './style.css', './engine.js', './app.js',
  './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-180.png'
];

// 파일 하나가 없어도(예: 아이콘을 아직 안 올렸을 때) 설치가 멈추지 않게 하나씩 저장해요.
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(SHELL.map((u) => c.add(u).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 같은 주소의 파일만 다뤄요. 저장본을 먼저 보여 주고, 뒤에서 새 파일을 받아 갱신해요.
// config.json(관리자 설정)은 저장하지 않고 항상 새로 받아요.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('/config.json')) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
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
