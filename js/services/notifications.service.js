import {
  collection, doc, getDoc, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, writeBatch
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { deleteToken, getMessaging, getToken, isSupported } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging.js';
import { db, firebaseApp } from '../config/firebase.js';
import { notificationConfig } from '../config/notifications.js';

function notificationsPath(context) {
  return ['tenants', context.tenant.id, 'members', context.firebaseUser.uid, 'notifications'];
}
function devicesPath(context) {
  return ['tenants', context.tenant.id, 'members', context.firebaseUser.uid, 'devices'];
}

export function observeNotifications(context, onData, onError) {
  const ref = collection(db, ...notificationsPath(context));
  const q = query(ref, orderBy('createdAt', 'desc'), limit(50));
  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    onData(items, snapshot.docChanges());
  }, onError);
}

export async function markNotificationRead(context, notificationId) {
  const ref = doc(db, ...notificationsPath(context), notificationId);
  await updateDoc(ref, { isRead: true, readAt: serverTimestamp() });
}

export async function markAllNotificationsRead(context, notifications) {
  const unread = notifications.filter((item) => !item.isRead);
  if (!unread.length) return;
  const batch = writeBatch(db);
  unread.forEach((item) => batch.update(doc(db, ...notificationsPath(context), item.id), { isRead: true, readAt: serverTimestamp() }));
  await batch.commit();
}

export async function enablePushNotifications(context, registration) {
  if (!('Notification' in window)) throw new Error('Este navegador não oferece notificações Web Push.');
  if (!(await isSupported())) throw new Error('FCM não é suportado neste navegador/dispositivo.');
  if (notificationConfig.vapidKey.startsWith('SUBSTITUA_')) throw new Error('A chave pública VAPID do ambiente HML ainda não foi configurada.');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Permissão de notificações não concedida.');

  const messaging = getMessaging(firebaseApp);
  const token = await getToken(messaging, {
    vapidKey: notificationConfig.vapidKey,
    serviceWorkerRegistration: registration
  });
  if (!token) throw new Error('O navegador não retornou um token de notificação.');

  const tokenId = await sha256(token);
  const ref = doc(db, ...devicesPath(context), tokenId);
  const existing = await getDoc(ref);
  const payload = {
    token,
    enabled: true,
    platform: detectPlatform(),
    userAgent: navigator.userAgent.slice(0, 500),
    updatedAt: serverTimestamp()
  };
  if (!existing.exists()) payload.createdAt = serverTimestamp();
  await setDoc(ref, payload, { merge: true });
  localStorage.setItem('sinal.push.tokenId', tokenId);
  return tokenId;
}

export async function disablePushNotifications(context) {
  const tokenId = localStorage.getItem('sinal.push.tokenId');
  if (tokenId) {
    await updateDoc(doc(db, ...devicesPath(context), tokenId), { enabled: false, updatedAt: serverTimestamp() }).catch(() => {});
  }
  if (await isSupported()) {
    try { await deleteToken(getMessaging(firebaseApp)); } catch (_) {}
  }
  localStorage.removeItem('sinal.push.tokenId');
}

export function getPushState() {
  return {
    supported: 'Notification' in window && 'serviceWorker' in navigator,
    permission: 'Notification' in window ? Notification.permission : 'unsupported',
    configured: !notificationConfig.vapidKey.startsWith('SUBSTITUA_'),
    registered: Boolean(localStorage.getItem('sinal.push.tokenId'))
  };
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function detectPlatform() {
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  return 'web';
}
