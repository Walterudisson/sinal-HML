const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();
const db = getFirestore();
const APP_BASE_URL = 'https://walterudisson.github.io/sinal-HML/';
const SUPPORT_ROLES = new Set(['admin', 'supervisor', 'agente']);

exports.notifyNewTicket = onDocumentCreated('tenants/{tenantId}/tickets/{ticketId}', async (event) => {
  if (!event.data) return;
  const { tenantId, ticketId } = event.params;
  const ticket = event.data.data();
  const members = await db.collection(`tenants/${tenantId}/members`).where('status', '==', 'active').get();
  const recipients = members.docs
    .filter((doc) => SUPPORT_ROLES.has(doc.data().role) && doc.id !== ticket.createdByUid)
    .map((doc) => doc.id);

  await Promise.all(recipients.map((uid) => createAndPush({
    tenantId, uid, type: 'new_ticket', actorUid: ticket.createdByUid,
    title: 'Novo sinal recebido',
    body: `${ticket.requesterName || 'Solicitante'}: ${ticket.title || ticket.code}`,
    ticketId, ticketCode: ticket.code
  })));
});

exports.notifyNewMessage = onDocumentCreated('tenants/{tenantId}/tickets/{ticketId}/messages/{messageId}', async (event) => {
  if (!event.data) return;
  const { tenantId, ticketId } = event.params;
  const message = event.data.data();
  const ticketSnap = await db.doc(`tenants/${tenantId}/tickets/${ticketId}`).get();
  if (!ticketSnap.exists) return;
  const ticket = ticketSnap.data();

  let recipientUid = null;
  if (message.authorUid === ticket.requesterUid) recipientUid = ticket.assigneeUid || null;
  else if (message.authorUid === ticket.assigneeUid) recipientUid = ticket.requesterUid || null;
  if (!recipientUid || recipientUid === message.authorUid) return;

  const preview = String(message.body || '').replace(/\s+/g, ' ').trim().slice(0, 140);
  await createAndPush({
    tenantId, uid: recipientUid, type: 'new_message', actorUid: message.authorUid,
    title: `${message.authorName || 'Alguém'} respondeu`,
    body: preview || `Nova mensagem em ${ticket.code}`,
    ticketId, ticketCode: ticket.code
  });
});

async function createAndPush({ tenantId, uid, type, actorUid, title, body, ticketId, ticketCode }) {
  const notificationRef = db.collection(`tenants/${tenantId}/members/${uid}/notifications`).doc();
  await notificationRef.set({
    type, title, body, ticketId, ticketCode: ticketCode || '', actorUid: actorUid || '',
    isRead: false, readAt: null, createdAt: FieldValue.serverTimestamp()
  });

  const devices = await db.collection(`tenants/${tenantId}/members/${uid}/devices`).where('enabled', '==', true).get();
  const valid = devices.docs.filter((doc) => typeof doc.data().token === 'string' && doc.data().token.length > 20);
  if (!valid.length) return;

  const tokens = valid.map((doc) => doc.data().token);
  const link = `${APP_BASE_URL}#ticket=${encodeURIComponent(ticketId)}`;
  const response = await getMessaging().sendEachForMulticast({
    tokens,
    notification: { title, body },
    webpush: {
      notification: {
        icon: `${APP_BASE_URL}icons/icon-192.png`,
        badge: `${APP_BASE_URL}icons/badge-96.png`,
        tag: `sinal-${ticketId}`,
        renotify: true
      },
      fcmOptions: { link }
    },
    data: { type, ticketId, ticketCode: ticketCode || '' }
  });

  const cleanup = [];
  response.responses.forEach((item, index) => {
    const code = item.error?.code || '';
    if (!item.success && (code.includes('registration-token-not-registered') || code.includes('invalid-registration-token'))) {
      cleanup.push(valid[index].ref.delete());
    }
  });
  await Promise.all(cleanup);
}
