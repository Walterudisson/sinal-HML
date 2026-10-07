import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  writeBatch
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

import { db } from '../config/firebase.js';
import { TICKET_EVENT, TICKET_STATUS } from '../domain/ticket-lifecycle.mjs';

export function observeMessages(context, ticketId, onData, onError) {
  const ref = collection(db, 'tenants', context.tenant.id, 'tickets', ticketId, 'messages');
  const q = query(ref, orderBy('createdAt', 'asc'), limit(200));

  return onSnapshot(
    q,
    (snapshot) => onData(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
    onError
  );
}

export async function sendMessage(context, ticket, body) {
  const text = String(body || '').trim();
  if (!text) throw new Error('Escreva uma mensagem antes de enviar.');
  if (ticket.status === TICKET_STATUS.RESOLVED || ticket.status === TICKET_STATUS.CLOSED) {
    throw new Error('Este sinal não aceita novas mensagens neste estado.');
  }

  const ticketRef = doc(db, 'tenants', context.tenant.id, 'tickets', ticket.id);
  const messageRef = doc(collection(ticketRef, 'messages'));
  const name = context.userProfile.displayName
    || context.firebaseUser.displayName
    || context.firebaseUser.email
    || 'Usuário';

  const payload = {
    body: text,
    visibility: 'public',
    authorUid: context.firebaseUser.uid,
    authorName: name,
    authorEmail: context.firebaseUser.email || context.userProfile.email || '',
    authorRole: context.membership.role,
    createdAt: serverTimestamp()
  };

  const isRequesterReplyWhileWaiting =
    ticket.status === TICKET_STATUS.WAITING_REQUESTER
    && ticket.requesterUid === context.firebaseUser.uid;

  if (!isRequesterReplyWhileWaiting) {
    const batch = writeBatch(db);
    batch.set(messageRef, payload);
    await batch.commit();
    return;
  }

  // A resposta do solicitante retoma o atendimento atomicamente.
  const eventRef = doc(collection(ticketRef, 'statusEvents'));
  const batch = writeBatch(db);
  batch.set(messageRef, payload);
  batch.update(ticketRef, {
    status: TICKET_STATUS.IN_PROGRESS,
    updatedAt: serverTimestamp(),
    lastEventId: eventRef.id
  });
  batch.set(eventRef, {
    type: TICKET_EVENT.REQUESTER_REPLIED,
    from: TICKET_STATUS.WAITING_REQUESTER,
    to: TICKET_STATUS.IN_PROGRESS,
    actorUid: context.firebaseUser.uid,
    actorName: name,
    messageId: messageRef.id,
    createdAt: serverTimestamp()
  });
  await batch.commit();
}
