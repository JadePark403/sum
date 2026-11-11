/* =========================================================
   서비스 워커: 인터넷이 없어도 앱이 열리도록
   앱 파일을 기기에 한 번 저장(캐시)해 두는 작은 도우미예요.
   파일을 고친 뒤 올릴 때는 아래 VERSION 숫자를 하나 올려 주세요.
   ========================================================= */
const VERSION = 'soom-v7';
const FILES = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(FILES)));
  self.skipWaiting();
});

// 예전 버전 캐시는 지우기
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// 저장해 둔 파일이 있으면 그걸 먼저 보여 주기
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((hit) => hit || fetch(event.request))
  );
});
