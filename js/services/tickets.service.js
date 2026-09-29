import {
  collection,
  doc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
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

  return {
    id: ticketRef.id,
    code,
    ...payload
  };
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
    (snapshot) => {
      const tickets = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data()
      }));

      tickets.sort((a, b) => {
        const aMillis = a.createdAt?.toMillis?.() ?? 0;
        const bMillis = b.createdAt?.toMillis?.() ?? 0;
        return bMillis - aMillis;
      });

      onData(tickets);
    },
    onError
  );
}
