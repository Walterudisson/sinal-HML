const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { buildStatusNotice, createNotificationOnce } = require('./status-notifications');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
const { getStorage } = require('firebase-admin/storage');

initializeApp();
const db = getFirestore();
const APP_BASE_URL = 'https://walterudisson.github.io/sinal-HML/';
const SUPPORT_ROLES = new Set(['admin', 'supervisor', 'agente']);

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
    if (!['claimed', 'resolved'].includes(statusEvent.type)) return;

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


// Sprint 1.7.0-A: endpoints administrativos exclusivamente para Superadmin.
// Publicados em HML; preservar isolamento entre ambientes.
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { authorizeSuperadmin, deactivateUserAccess, deactivateTenantAccess } = require('./access-revocation');

async function requireGlobalSuperadmin(request) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Autenticação obrigatória.');
  try {
    return await authorizeSuperadmin(db, uid);
  } catch (_) {
    throw new HttpsError('permission-denied', 'Operação exclusiva do Superadmin global.');
  }
}

const revocationCallableOptions = {
  region: 'southamerica-east1',
  timeoutSeconds: 300,
  maxInstances: 2,
  memory: '256MiB'
};

exports.deactivateSinalUser = onCall(revocationCallableOptions, async (request) => {
  const actorUid = await requireGlobalSuperadmin(request);
  const uid = request.data?.uid;
  if (typeof uid !== 'string' || !/^[A-Za-z0-9_-]{3,128}$/.test(uid)) {
    throw new HttpsError('invalid-argument', 'UID inválido.');
  }
  if (actorUid === uid) {
    throw new HttpsError('failed-precondition', 'Não é possível desativar sua própria conta.');
  }
  try {
    return await deactivateUserAccess(db, uid, actorUid);
  } catch (error) {
    console.error('[Sinal][Access] Falha na revogação de usuário:', error);
    throw new HttpsError('failed-precondition',
      'Não foi possível concluir a desativação. Confira o status de revogação e tente novamente.');
  }
});

exports.deactivateSinalTenant = onCall(revocationCallableOptions, async (request) => {
  const actorUid = await requireGlobalSuperadmin(request);
  const tenantId = request.data?.tenantId;
  if (typeof tenantId !== 'string' || !/^[A-Za-z0-9_-]{3,128}$/.test(tenantId)) {
    throw new HttpsError('invalid-argument', 'Identificação da organização inválida.');
  }
  try {
    return await deactivateTenantAccess(db, tenantId, actorUid);
  } catch (error) {
    console.error('[Sinal][Access] Falha na revogação de organização:', error);
    throw new HttpsError('failed-precondition',
      'Não foi possível concluir a desativação. Confira o status de revogação e tente novamente.');
  }
});


// Sprint 1.7.0-B: anexos privados vinculados à conversa.
// A UI não pode definir 'ready': apenas esta função valida a existência e
// assinatura dos bytes reais, as permissões atuais e a correspondência Storage↔Firestore.
const {
  finalizeAttachment, discardPendingAttachment, cleanupOrphanAttachments
} = require('./attachment-security');
const { onSchedule } = require('firebase-functions/v2/scheduler');

const attachmentOptions = {
  region: 'southamerica-east1',
  timeoutSeconds: 60,
  memory: '256MiB',
  maxInstances: 5
};
function attachmentArgs(request) {
  const { tenantId, ticketId, attachmentId } = request.data || {};
  return { uid: request.auth?.uid, tenantId, ticketId, attachmentId };
}
function attachmentError(error) {
  const code = ['unauthenticated', 'invalid-argument', 'permission-denied',
    'failed-precondition'].includes(error.message) ? error.message : 'internal';
  if (code === 'internal') console.error('[Sinal][Attachments] Erro interno:', error);
  return new HttpsError(code,
    code === 'permission-denied' ? 'Você não tem permissão para este anexo.' :
    code === 'unauthenticated' ? 'Faça login para continuar.' :
    code === 'invalid-argument' ? 'Identificação do arquivo inválida.' :
    code === 'failed-precondition' ? 'O anexo não pode ser confirmado neste estado.' :
    'Não foi possível processar o anexo agora.');
}
exports.finalizeSinalAttachment = onCall(attachmentOptions, async request => {
  try {
    return await finalizeAttachment({
      db, bucket: getStorage().bucket(), ...attachmentArgs(request)
    });
  } catch (error) {
    throw attachmentError(error);
  }
});
exports.discardSinalAttachment = onCall(attachmentOptions, async request => {
  try {
    return await discardPendingAttachment({
      db, bucket: getStorage().bucket(), ...attachmentArgs(request)
    });
  } catch (error) {
    throw attachmentError(error);
  }
});

// Agenda diária; varredura paginada e limitada a 100 objetos por execução.
// Não usa URLs públicas e nunca exclui um documento em estado ready.
exports.cleanupSinalOrphanAttachments = onSchedule({
  schedule: 'every day 03:00',
  timeZone: 'America/Sao_Paulo',
  region: 'southamerica-east1',
  timeoutSeconds: 300,
  memory: '256MiB',
  maxInstances: 1
}, async () => {
  await cleanupOrphanAttachments({ db, bucket: getStorage().bucket() });
});


// Notificação privada apenas após confirmação: um anexo pendente não aparece
// no histórico visível nem gera push para outro usuário.
exports.notifyNewAttachment = onDocumentUpdated({
  document: 'tenants/{tenantId}/tickets/{ticketId}/attachments/{attachmentId}',
  region: 'southamerica-east1'
}, async event => {
  const before = event.data?.before?.data();
  const after = event.data?.after?.data();
  if (!after || before?.status === 'ready' || after.status !== 'ready') return;

  const { tenantId, ticketId, attachmentId } = event.params;
  const ticketSnap = await db.doc(`tenants/${tenantId}/tickets/${ticketId}`).get();
  if (!ticketSnap.exists) return;
  const ticket = ticketSnap.data();
  const authorUid = after.uploadedByUid;
  let recipientUid = null;
  if (authorUid === ticket.requesterUid) recipientUid = ticket.assigneeUid || null;
  else if (authorUid === ticket.assigneeUid) recipientUid = ticket.requesterUid || null;
  if (!recipientUid || recipientUid === authorUid) return;

  const [member, user] = await Promise.all([
    db.doc(`tenants/${tenantId}/members/${recipientUid}`).get(),
    db.doc('users/' + recipientUid).get()
  ]);
  if (member.data()?.status !== 'active' || user.data()?.status !== 'active') return;
  await createAndPush({
    tenantId, uid: recipientUid, type: 'new_message', actorUid: authorUid,
    title: 'Novo anexo na conversa',
    body: `${after.contentType === 'application/pdf' ? '📄 PDF' : '🖼️ Imagem'}: ${String(after.fileName || 'Arquivo').slice(0,80)}`,
    ticketId, ticketCode: ticket.code,
    notificationId: 'attachment-' + attachmentId
  });
});
