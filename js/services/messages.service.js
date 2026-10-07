import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-functions.js';

import { db, functions } from '../config/firebase.js';
import { TICKET_STATUS } from '../domain/ticket-lifecycle.mjs';

export function observeMessages(context, ticketId, onData, onError) {
  const ref = collection(db, 'tenants', context.tenant.id, 'tickets', ticketId, 'messages');
  const q = query(ref, orderBy('createdAt', 'asc'), limit(200));

  return onSnapshot(
    q,
    (snapshot) => onData(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
    onError
  );
}

const sendTicketMessageCallable = httpsCallable(functions, 'sendTicketMessage');

export async function sendMessage(context, ticket, body) {
  const text = String(body || '').trim();
  if (!text) throw new Error('Escreva uma mensagem antes de enviar.');
  if (ticket.status === TICKET_STATUS.RESOLVED || ticket.status === TICKET_STATUS.CLOSED) {
    throw new Error('Este sinal não aceita novas mensagens neste estado.');
  }

  const result = await sendTicketMessageCallable({
    tenantId: context.tenant.id,
    ticketId: ticket.id,
    body: text
  });
  return result.data;
}
