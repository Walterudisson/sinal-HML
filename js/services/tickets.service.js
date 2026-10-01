import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
  orderBy,
  where
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

import { db } from '../config/firebase.js';

export async function createTicket(context, input) {
  const { firebaseUser, userProfile, tenant } = context;
  const ticketRef = doc(collection(db, 'tenants', tenant.id, 'tickets'));
  const code = `S-${ticketRef.id.slice(0, 6).toUpperCase()}`;

  const payload = {
    code,
    title: input.title.trim(),
    description: input.description.trim(),
    category: input.category,
    priority: input.priority,
    status: 'open',
    requesterUid: firebaseUser.uid,
    requesterName: userProfile.displayName || firebaseUser.displayName || firebaseUser.email || 'Usuário',
    requesterEmail: firebaseUser.email || userProfile.email || '',
    createdByUid: firebaseUser.uid,
    source: 'web',
    assigneeUid: null,
    teamId: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  await setDoc(ticketRef, payload);

  return { id: ticketRef.id, code, ...payload };
}

export async function claimTicket(context, ticket) {
  const { firebaseUser, userProfile, tenant } = context;
  const ticketRef = doc(db, 'tenants', tenant.id, 'tickets', ticket.id);

  const actorName = userProfile.displayName || firebaseUser.displayName || firebaseUser.email || 'Atendente';
  const historyRef = doc(collection(ticketRef, 'statusEvents'));
  const batch = writeBatch(db);
  batch.update(ticketRef, {
    status: 'in_progress',
    assigneeUid: firebaseUser.uid,
    assigneeName: actorName,
    assigneeEmail: firebaseUser.email || userProfile.email || '',
    updatedAt: serverTimestamp(),
    lastEventId: historyRef.id
  });
  batch.set(historyRef, {
    type: 'claimed',
    from: 'open',
    to: 'in_progress',
    actorUid: firebaseUser.uid,
    actorName,
    createdAt: serverTimestamp()
  });
  await batch.commit();
}

export async function resolveTicket(context, ticket, details) {
  if (!navigator.onLine) throw new Error('Você está sem conexão. Reconecte-se para resolver este sinal.');
  if (ticket.status !== 'in_progress' || ticket.assigneeUid !== context.firebaseUser.uid) {
    throw new Error('Somente o técnico responsável pode resolver um sinal em atendimento.');
  }

  const internalText = String(details.internalText || '').trim();
  const share = details.share === true;
  const publicText = share ? String(details.publicText || '').trim() : '';
  if (internalText.length < 3 || internalText.length > 4000) {
    throw new Error('Descreva a solução técnica (3 a 4.000 caracteres).');
  }
  if (share && (publicText.length < 3 || publicText.length > 2000)) {
    throw new Error('Preencha a mensagem compartilhada (3 a 2.000 caracteres).');
  }

  const actorName = context.userProfile.displayName || context.firebaseUser.displayName || context.firebaseUser.email || 'Atendente';
  const ref = doc(db, 'tenants', context.tenant.id, 'tickets', ticket.id);
  const privateRef = doc(ref, 'private', 'resolution');
  const eventRef = doc(collection(ref, 'statusEvents'));
  const batch = writeBatch(db);

  batch.update(ref, {
    status: 'resolved',
    resolvedAt: serverTimestamp(),
    resolvedByUid: context.firebaseUser.uid,
    resolvedByName: actorName,
    resolutionShared: share,
    publicResolution: publicText,
    updatedAt: serverTimestamp(),
    lastEventId: eventRef.id
  });
  // O texto técnico não fica no documento público do sinal.
  batch.set(privateRef, {
    text: internalText,
    knowledgeCandidate: details.knowledgeCandidate === true,
    createdByUid: context.firebaseUser.uid,
    createdByName: actorName,
    createdAt: serverTimestamp()
  });
  batch.set(eventRef, {
    type: 'resolved',
    from: 'in_progress',
    to: 'resolved',
    actorUid: context.firebaseUser.uid,
    actorName,
    createdAt: serverTimestamp()
  });
  await batch.commit();
}

export async function getPrivateResolution(context, ticketId) {
  if (!['admin', 'supervisor', 'agente'].includes(context.membership.role)) return null;
  const ref = doc(db, 'tenants', context.tenant.id, 'tickets', ticketId, 'private', 'resolution');
  const snapshot = await getDoc(ref);
  return snapshot.exists() ? snapshot.data() : null;
}

export function observeStatusEvents(context, ticketId, onData, onError) {
  const ref = collection(db, 'tenants', context.tenant.id, 'tickets', ticketId, 'statusEvents');
  return onSnapshot(query(ref, orderBy('createdAt', 'asc'), limit(100)), (snapshot) => {
    onData(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
  }, onError);
}


export async function getTicketById(context, ticketId) {
  const ref = doc(db, 'tenants', context.tenant.id, 'tickets', ticketId);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) throw new Error('Sinal não encontrado.');
  return { id: snapshot.id, ...snapshot.data() };
}

export function observeMyTickets(context, onData, onError) {
  const ticketsRef = collection(db, 'tenants', context.tenant.id, 'tickets');
  const myTicketsQuery = query(
    ticketsRef,
    where('requesterUid', '==', context.firebaseUser.uid),
    limit(50)
  );

  return onSnapshot(
    myTicketsQuery,
    (snapshot) => onData(sortTickets(snapshot.docs.map(toTicket))),
    onError
  );
}

export function observeCentralTickets(context, onData, onError) {
  const ticketsRef = collection(db, 'tenants', context.tenant.id, 'tickets');
  const centralQuery = query(ticketsRef, limit(100));

  return onSnapshot(
    centralQuery,
    (snapshot) => onData(sortTickets(snapshot.docs.map(toTicket))),
    onError
  );
}

function toTicket(item) {
  return { id: item.id, ...item.data() };
}

function sortTickets(tickets) {
  return tickets.sort((a, b) => {
    const aMillis = a.createdAt?.toMillis?.() ?? 0;
    const bMillis = b.createdAt?.toMillis?.() ?? 0;
    return bMillis - aMillis;
  });
}
