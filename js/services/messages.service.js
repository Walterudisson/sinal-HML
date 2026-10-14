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

export function observeMessages(context, ticketId, onData, onError) {
  const ref = collection(db, 'tenants', context.tenant.id, 'tickets', ticketId, 'messages');
  const q = query(ref, orderBy('createdAt', 'asc'), limit(200));

  return onSnapshot(
    q,
    (snapshot) => onData(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))),
    onError
  );
}

export async function sendMessage(context, ticket, body) {
  const ticketRef = doc(db, 'tenants', context.tenant.id, 'tickets', ticket.id);
  const messageRef = doc(collection(ticketRef, 'messages'));
  const batch = writeBatch(db);

  batch.set(messageRef, {
    body: body.trim(),
    visibility: 'public',
    authorUid: context.firebaseUser.uid,
    authorName: context.userProfile.displayName || context.firebaseUser.displayName || context.firebaseUser.email || 'Usuário',
    authorEmail: context.firebaseUser.email || context.userProfile.email || '',
    authorRole: context.membership.role,
    createdAt: serverTimestamp()
  });

  batch.update(ticketRef, {
    lastInteractionAt: serverTimestamp(),
    lastInteractionType: 'message',
    lastInteractionByUid: context.firebaseUser.uid,
    lastInteractionMessageId: messageRef.id
  });

  await batch.commit();
}
