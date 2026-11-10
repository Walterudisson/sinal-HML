'use strict';

// IDs de notificação determinísticos. Cloud Functions pode entregar o mesmo
// evento Firestore mais de uma vez, portanto o ID deve ser derivado do evento.
const EVENT_ID = /^[A-Za-z0-9_-]{1,160}$/;

function newTicketNoticeId(ticketId) {
  return EVENT_ID.test(ticketId || '') ? `new-ticket-${ticketId}` : null;
}

function buildMessageNotice(ticket, message, { ticketId, messageId } = {}) {
  if (!ticket || !message || !EVENT_ID.test(ticketId || '') || !EVENT_ID.test(messageId || '')) {
    return null;
  }

  // A primeira mensagem pertence à abertura do sinal, não a uma resposta.
  // O gatilho pode executar DEPOIS da atribuição: verificar assigneeUid
  // isoladamente causaria um aviso adicional indevido para o atendente.
  if (messageId === ticket.firstMessageId) return null;

  const authorUid = message.authorUid;
  let uid = null;
  if (authorUid && authorUid === ticket.requesterUid) {
    uid = ticket.assigneeUid || null;
  } else if (authorUid && authorUid === ticket.assigneeUid) {
    uid = ticket.requesterUid || null;
  }
  if (!uid || uid === authorUid) return null;

  return { uid, notificationId: `new-message-${ticketId}-${messageId}` };
}

module.exports = { newTicketNoticeId, buildMessageNotice };
