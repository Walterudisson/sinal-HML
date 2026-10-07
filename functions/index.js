const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onCall } = require('firebase-functions/v2/https');
const { buildStatusNotice, createNotificationOnce } = require('./status-notifications');
const { executeTicketCommand, executeSendMessage } = require('./ticket-commands');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();
const db = getFirestore();
const APP_BASE_URL = 'https://walterudisson.github.io/sinal-HML/';
const SUPPORT_ROLES = new Set(['admin', 'supervisor', 'agente']);

exports.ticketCommand = onCall({ region: 'southamerica-east1' }, async (request) => {
  return executeTicketCommand(db, request.auth, request.data);
});

exports.sendTicketMessage = onCall({ region: 'southamerica-east1' }, async (request) => {
  return executeSendMessage(db, request.auth, request.data);
});

exports.notifyNewTicket = onDocumentCreated({ document: 'tenants/{tenantId}/tickets/{ticketId}', region: 'southamerica-east1' }, async (event) => {
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

exports.notifyNewMessage = onDocumentCreated({ document: 'tenants/{tenantId}/tickets/{ticketId}/messages/{messageId}', region: 'southamerica-east1' }, async (event) => {
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


// A gravação do statusEvent e a mudança do ticket ocorrem no mesmo lote.
// Os eventos são imutáveis e contêm somente metadados, nunca a solução interna.
exports.notifyTicketStatus = onDocumentCreated(
  {
    document: 'tenants/{tenantId}/tickets/{ticketId}/statusEvents/{eventId}',
    region: 'southamerica-east1'
  },
  async (event) => {
    if (!event.data) return;
    const { tenantId, ticketId, eventId } = event.params;
    const statusEvent = event.data.data();
    if (!['claimed', 'waiting_requester', 'resolved'].includes(statusEvent.type)) return;

    const ticketSnap = await db.doc(`tenants/${tenantId}/tickets/${ticketId}`).get();
    if (!ticketSnap.exists) return;
    const ticket = ticketSnap.data();
    const notice = buildStatusNotice({ ...ticket, _eventTicketId: ticketId }, statusEvent, eventId);
    if (!notice) return;

    const recipient = await db.doc(`tenants/${tenantId}/members/${notice.uid}`).get();
    if (!recipient.exists || recipient.data().status !== 'active') return;
    const profile = await db.doc(`users/${notice.uid}`).get();
    if (!profile.exists || profile.data().status !== 'active') return;

    await createAndPush({
      tenantId, uid: notice.uid, type: notice.type, actorUid: notice.actorUid,
      title: notice.title, body: notice.body, ticketId, ticketCode: ticket.code,
      notificationId: notice.notificationId
    });
  }
);

async function createAndPush({ tenantId, uid, type, actorUid, title, body, ticketId, ticketCode, notificationId = null }) {
  const notificationCollection = db.collection(`tenants/${tenantId}/members/${uid}/notifications`);
  const notificationRef = notificationId
    ? notificationCollection.doc(notificationId)
    : notificationCollection.doc();
  const payload = {
    type, title, body, ticketId, ticketCode: ticketCode || '', actorUid: actorUid || '',
    isRead: false, readAt: null, createdAt: FieldValue.serverTimestamp()
  };

  if (notificationId) {
    // A entrega de eventos Firestore é pelo menos uma vez. Uma ID estável
    // evita notificações repetidas no sino e reenvio de push em reexecuções.
    const created = await createNotificationOnce(notificationRef, payload);
    if (!created) return;
  } else {
    await notificationRef.set(payload);
  }

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
