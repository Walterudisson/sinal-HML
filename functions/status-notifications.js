'use strict';

// Apenas campos públicos e mensagens predefinidas. Nunca recebe ou usa private/resolution.
function buildStatusNotice(ticket, event, eventId) {
  if (!ticket || !event || typeof eventId !== 'string' || !/^[A-Za-z0-9_-]{1,160}$/.test(eventId)) return null;
  const actorUid = event.actorUid;
  const requesterUid = ticket.requesterUid;
  if (typeof actorUid !== 'string' || !actorUid
      || typeof requesterUid !== 'string' || !requesterUid
      || actorUid === requesterUid) return null;

  const code = typeof ticket.code === 'string' ? ticket.code.slice(0, 20) : 'Seu sinal';
  const actorName = typeof event.actorName === 'string'
    ? event.actorName.replace(/[\r\n]+/g, ' ').trim().slice(0, 80)
    : '';

  if (event.type === 'claimed' && event.from === 'open' && event.to === 'in_progress'
      && ticket.assigneeUid === actorUid) {
    return {
      notificationId: `status-${eventId}`,
      uid: requesterUid,
      type: 'ticket_claimed',
      actorUid,
      title: 'Seu sinal está em atendimento',
      body: actorName ? `${code}: ${actorName} assumiu o atendimento.` : `${code}: um atendente assumiu seu sinal.`
    };
  }

  if (event.type === 'resolved' && event.from === 'in_progress' && event.to === 'resolved'
      && ticket.resolvedByUid === actorUid) {
    return {
      notificationId: `status-${eventId}`,
      uid: requesterUid,
      type: 'ticket_resolved',
      actorUid,
      title: 'Seu sinal foi resolvido',
      body: `${code}: seu atendimento foi marcado como resolvido. Abra o sinal para consultar os detalhes disponíveis.`
    };
  }
  return null;
}

module.exports = { buildStatusNotice };
