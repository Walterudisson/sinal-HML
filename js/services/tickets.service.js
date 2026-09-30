import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
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

  await updateDoc(ticketRef, {
    status: 'in_progress',
    assigneeUid: firebaseUser.uid,
    assigneeName: userProfile.displayName || firebaseUser.displayName || firebaseUser.email || 'Atendente',
    assigneeEmail: firebaseUser.email || userProfile.email || '',
    updatedAt: serverTimestamp()
  });
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
