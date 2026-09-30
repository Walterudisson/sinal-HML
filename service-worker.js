const CACHE_NAME = 'sinal-shell-1.3.0';
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
