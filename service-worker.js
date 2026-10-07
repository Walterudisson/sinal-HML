const CACHE_NAME = 'sinal-shell-hml-1.5-b1';
const APP_SHELL = [
  './offline.html',
  './manifest.webmanifest',
  './css/app.css',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/badge-96.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('./offline.html')));
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      return response;
    }))
  );
});

// Interceptar antes do Firebase: quando a PWA já está aberta, o FCM pode
// somente focá-la, sem navegar para o sinal indicado no push.
self.addEventListener('notificationclick', (event) => {
  if (event.action) return;
  const payload = event.notification?.data?.FCM_MSG;
  const link = payload?.fcmOptions?.link || payload?.notification?.click_action;
  if (!link) return;

  let target;
  let ticketId;
  try {
    target = new URL(link, self.registration.scope);
    const scope = new URL(self.registration.scope);
    ticketId = new URLSearchParams(target.hash.slice(1)).get('ticket');
    if (target.origin !== scope.origin || !target.pathname.startsWith(scope.pathname)
        || !ticketId || ticketId.length > 160) return;
  } catch (_) {
    return;
  }

  event.stopImmediatePropagation();
  event.notification.close();
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find((client) => {
      try {
        const url = new URL(client.url);
        return url.origin === target.origin && url.pathname.startsWith(new URL(self.registration.scope).pathname);
      } catch (_) { return false; }
    });

    if (!existing) {
      await self.clients.openWindow(target.href);
      return;
    }

    try {
      const navigated = await existing.navigate(target.href);
      if (navigated) await navigated.focus();
      else {
        await existing.focus();
        existing.postMessage({ type: 'sinal:open-ticket', ticketId });
      }
    } catch (_) {
      await existing.focus();
      existing.postMessage({ type: 'sinal:open-ticket', ticketId });
    }
  })());
});

// FCM no mesmo Service Worker da PWA.
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyDmpeBPs7AEhUr_I8KU1boRXVQKsMKnhVQ',
  authDomain: 'sinaldesk-hml.firebaseapp.com',
  projectId: 'sinaldesk-hml',
  storageBucket: 'sinaldesk-hml.firebasestorage.app',
  messagingSenderId: '338438459376',
  appId: '1:338438459376:web:f30d427998aadeb6659735',
  measurementId: 'G-1YCX97FZK1'
});

firebase.messaging();
