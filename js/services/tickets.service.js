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
import {
  TICKET_EVENT,
  TICKET_STATUS,
  canActorTransition
} from '../domain/ticket-lifecycle.mjs';

function actorName(context, fallback = 'Usuário') {
  return context.userProfile.displayName
    || context.firebaseUser.displayName
    || context.firebaseUser.email
    || fallback;
}

function transitionAllowed(context, ticket, event) {
  return canActorTransition({
    from: ticket.status,
    event,
    role: context.membership.role,
    isRequester: ticket.requesterUid === context.firebaseUser.uid,
    isAssignee: ticket.assigneeUid === context.firebaseUser.uid
  });
}

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
    status: TICKET_STATUS.OPEN,
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
  if (!transitionAllowed(context, ticket, TICKET_EVENT.CLAIMED)) {
    throw new Error('Este sinal não pode ser assumido neste estado.');
  }

  const { firebaseUser, userProfile, tenant } = context;
  const ticketRef = doc(db, 'tenants', tenant.id, 'tickets', ticket.id);
  const name = actorName(context, 'Atendente');
  const historyRef = doc(collection(ticketRef, 'statusEvents'));
  const batch = writeBatch(db);

  batch.update(ticketRef, {
    status: TICKET_STATUS.IN_PROGRESS,
    assigneeUid: firebaseUser.uid,
    assigneeName: name,
    assigneeEmail: firebaseUser.email || userProfile.email || '',
    updatedAt: serverTimestamp(),
    lastEventId: historyRef.id
  });
  batch.set(historyRef, {
    type: TICKET_EVENT.CLAIMED,
    from: TICKET_STATUS.OPEN,
    to: TICKET_STATUS.IN_PROGRESS,
    actorUid: firebaseUser.uid,
    actorName: name,
    createdAt: serverTimestamp()
  });
  await batch.commit();
}

export async function waitForRequester(context, ticket) {
  if (!transitionAllowed(context, ticket, TICKET_EVENT.WAITING_REQUESTER)) {
    throw new Error('Somente o atendente responsável pode aguardar o solicitante.');
  }

  const ticketRef = doc(db, 'tenants', context.tenant.id, 'tickets', ticket.id);
  const eventRef = doc(collection(ticketRef, 'statusEvents'));
  const name = actorName(context, 'Atendente');
  const batch = writeBatch(db);

  batch.update(ticketRef, {
    status: TICKET_STATUS.WAITING_REQUESTER,
    updatedAt: serverTimestamp(),
    lastEventId: eventRef.id
  });
  batch.set(eventRef, {
    type: TICKET_EVENT.WAITING_REQUESTER,
    from: TICKET_STATUS.IN_PROGRESS,
    to: TICKET_STATUS.WAITING_REQUESTER,
    actorUid: context.firebaseUser.uid,
    actorName: name,
    createdAt: serverTimestamp()
  });
  await batch.commit();
}

export async function resolveTicket(context, ticket, details) {
  if (!navigator.onLine) throw new Error('Você está sem conexão. Reconecte-se para resolver este sinal.');
  if (!transitionAllowed(context, ticket, TICKET_EVENT.RESOLVED)) {
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

  const name = actorName(context, 'Atendente');
  const ticketRef = doc(db, 'tenants', context.tenant.id, 'tickets', ticket.id);
  const eventRef = doc(collection(ticketRef, 'statusEvents'));
  const privateRef = doc(ticketRef, 'privateResolutions', eventRef.id);
  const batch = writeBatch(db);

  batch.update(ticketRef, {
    status: TICKET_STATUS.RESOLVED,
    resolvedAt: serverTimestamp(),
    resolvedByUid: context.firebaseUser.uid,
    resolvedByName: name,
    resolutionShared: share,
    publicResolution: publicText,
    latestResolutionId: eventRef.id,
    updatedAt: serverTimestamp(),
    lastEventId: eventRef.id
  });

  // Resoluções 1.5 são append-only. O ID coincide com o evento resolved.
  batch.set(privateRef, {
    text: internalText,
    knowledgeCandidate: details.knowledgeCandidate === true,
    createdByUid: context.firebaseUser.uid,
    createdByName: name,
    createdAt: serverTimestamp()
  });

  batch.set(eventRef, {
    type: TICKET_EVENT.RESOLVED,
    from: TICKET_STATUS.IN_PROGRESS,
    to: TICKET_STATUS.RESOLVED,
    actorUid: context.firebaseUser.uid,
    actorName: name,
    resolutionId: eventRef.id,
    resolutionShared: share,
    publicResolution: publicText,
    createdAt: serverTimestamp()
  });

  await batch.commit();
}

export async function reopenTicket(context, ticket) {
  if (!transitionAllowed(context, ticket, TICKET_EVENT.REOPENED)) {
    throw new Error('Este sinal não pode ser reaberto por este usuário.');
  }

  const ticketRef = doc(db, 'tenants', context.tenant.id, 'tickets', ticket.id);
  const eventRef = doc(collection(ticketRef, 'statusEvents'));
  const name = actorName(context);
  const batch = writeBatch(db);

  batch.update(ticketRef, {
    status: TICKET_STATUS.IN_PROGRESS,
    updatedAt: serverTimestamp(),
    lastEventId: eventRef.id
  });
  batch.set(eventRef, {
    type: TICKET_EVENT.REOPENED,
    from: TICKET_STATUS.RESOLVED,
    to: TICKET_STATUS.IN_PROGRESS,
    actorUid: context.firebaseUser.uid,
    actorName: name,
    createdAt: serverTimestamp()
  });
  await batch.commit();
}

export async function closeTicket(context, ticket) {
  if (!transitionAllowed(context, ticket, TICKET_EVENT.CLOSED)) {
    throw new Error('Somente o solicitante pode confirmar o encerramento de um sinal resolvido.');
  }

  const ticketRef = doc(db, 'tenants', context.tenant.id, 'tickets', ticket.id);
  const eventRef = doc(collection(ticketRef, 'statusEvents'));
  const name = actorName(context, 'Solicitante');
  const batch = writeBatch(db);

  batch.update(ticketRef, {
    status: TICKET_STATUS.CLOSED,
    closedAt: serverTimestamp(),
    closedByUid: context.firebaseUser.uid,
    closedByName: name,
    updatedAt: serverTimestamp(),
    lastEventId: eventRef.id
  });
  batch.set(eventRef, {
    type: TICKET_EVENT.CLOSED,
    from: TICKET_STATUS.RESOLVED,
    to: TICKET_STATUS.CLOSED,
    actorUid: context.firebaseUser.uid,
    actorName: name,
    createdAt: serverTimestamp()
  });
  await batch.commit();
}

export async function getPrivateResolution(context, ticketId) {
  if (!['admin', 'supervisor', 'agente'].includes(context.membership.role)) return null;

  const ticketRef = doc(db, 'tenants', context.tenant.id, 'tickets', ticketId);
  const ticketSnapshot = await getDoc(ticketRef);
  if (!ticketSnapshot.exists()) return null;

  const latestResolutionId = ticketSnapshot.data().latestResolutionId;
  if (typeof latestResolutionId === 'string' && latestResolutionId) {
    const latestRef = doc(ticketRef, 'privateResolutions', latestResolutionId);
    const latestSnapshot = await getDoc(latestRef);
    if (latestSnapshot.exists()) return { id: latestSnapshot.id, ...latestSnapshot.data() };
  }

  // Compatibilidade com sinais resolvidos na série 1.4.x.
  const legacyRef = doc(ticketRef, 'private', 'resolution');
  const legacySnapshot = await getDoc(legacyRef);
  return legacySnapshot.exists() ? { id: 'legacy', ...legacySnapshot.data() } : null;
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
