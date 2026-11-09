import {
  collection,
  doc,
  getDoc,
  getDocFromServer,
  limit,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  orderBy,
  where
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

import { db } from '../config/firebase.js';
import { generateSignalTitle, normalizeOpeningMessage, validateTriage } from './opening-domain.mjs';


/**
 * Reserva os IDs de um único envio. A interface deve guardar este objeto até
 * confirmar o resultado; novas tentativas usam EXATAMENTE os mesmos IDs.
 * O identificador nunca é derivado do texto nem do usuário.
 */
export function prepareConversationOpening(context) {
  if (!context?.tenant?.id || !context?.firebaseUser?.uid) {
    throw new Error('Sessão inválida para abrir um Sinal.');
  }
  const ticketRef = doc(collection(db, 'tenants', context.tenant.id, 'tickets'));
  const messageRef = doc(collection(ticketRef, 'messages'));
  return Object.freeze({
    tenantId: context.tenant.id,
    requesterUid: context.firebaseUser.uid,
    ticketId: ticketRef.id,
    messageId: messageRef.id
  });
}

/**
 * Cria ticket + primeira mensagem em um batch atômico.
 * Em resposta incerta do servidor, uma consulta confirma a tentativa antes
 * de exibir falha. Se for necessário reenviar, preservar o objeto `attempt`.
 */
export async function createConversationTicket(context, { message, attempt }) {
  const body = normalizeOpeningMessage(message);
  if (!attempt || attempt.tenantId !== context?.tenant?.id
    || attempt.requesterUid !== context?.firebaseUser?.uid
    || !/^[a-zA-Z0-9]{10,64}$/.test(attempt.ticketId || '')
    || !/^[a-zA-Z0-9]{10,64}$/.test(attempt.messageId || '')) {
    throw new Error('Tentativa de abertura inválida. Reinicie a abertura deste sinal.');
  }
  const profile = context.userProfile;
  if (!profile?.displayName || !profile?.email) {
    throw new Error('Perfil incompleto: nome e e-mail são necessários para o atendimento.');
  }
  const ticketRef = doc(db, 'tenants', attempt.tenantId, 'tickets', attempt.ticketId);
  const messageRef = doc(ticketRef, 'messages', attempt.messageId);
  const code = `S-${attempt.ticketId.slice(0, 6).toUpperCase()}`;
  const payload = {
    code,
    title: generateSignalTitle(body),
    description: body,
    category: null,
    priority: null,
    status: 'open',
    requesterUid: attempt.requesterUid,
    requesterName: profile.displayName,
    requesterEmail: profile.email,
    createdByUid: attempt.requesterUid,
    source: 'web',
    assigneeUid: null,
    teamId: null,
    firstMessageId: attempt.messageId,
    lastInteractionAt: serverTimestamp(),
    lastInteractionType: 'message',
    lastInteractionByUid: attempt.requesterUid,
    lastInteractionMessageId: attempt.messageId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  const firstMessage = {
    body,
    visibility: 'public',
    authorUid: attempt.requesterUid,
    authorName: profile.displayName,
    authorEmail: profile.email,
    authorRole: context.membership.role,
    createdAt: serverTimestamp()
  };

  const confirmExisting = async () => {
    try {
      const [ticket, first] = await Promise.all([
        getDocFromServer(ticketRef), getDocFromServer(messageRef)
      ]);
      if (!ticket.exists() || !first.exists()) return null;
      const saved = ticket.data();
      const savedMessage = first.data();
      if (saved.requesterUid !== attempt.requesterUid
        || saved.firstMessageId !== attempt.messageId
        || saved.description !== body
        || savedMessage.body !== body
        || savedMessage.authorUid !== attempt.requesterUid) return null;
      return { id: ticket.id, ...saved };
    } catch (_) {
      return null;
    }
  };

  // Evita tentar sobrescrever um sinal já confirmado em uma repetição da ação.
  const confirmed = await confirmExisting();
  if (confirmed) return confirmed;

  const batch = writeBatch(db);
  batch.set(ticketRef, payload);
  batch.set(messageRef, firstMessage);
  try {
    await batch.commit();
  } catch (error) {
    const confirmedAfterError = await confirmExisting();
    if (confirmedAfterError) return confirmedAfterError;
    // A interface NÃO descarta attempt nem a mensagem se a resposta for incerta.
    throw error;
  }
  return { id: ticketRef.id, ...payload };
}

/**
 * Triagem audível e transacional: rejeita edição baseada em estado obsoleto.
 * O ticket deve vir de snapshot atual (categoria, prioridade, título, status,
 * responsável e updatedAt). O backend/Rules revalidam tudo.
 */
export async function updateTicketTriage(context, ticket, changes = {}) {
  if (!ticket?.id || !context?.tenant?.id || !context?.firebaseUser?.uid) {
    throw new Error('Contexto inválido para a triagem.');
  }
  const role = context.membership?.role;
  if (!['admin', 'supervisor', 'agente'].includes(role)) {
    throw new Error('Seu perfil não tem permissão para classificar sinais.');
  }
  const ticketRef = doc(db, 'tenants', context.tenant.id, 'tickets', ticket.id);
  const eventRef = doc(collection(ticketRef, 'triageEvents'));
  const actorName = context.userProfile?.displayName;
  if (!actorName) throw new Error('Perfil do atendente incompleto.');

  await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(ticketRef);
    if (!snapshot.exists()) throw new Error('Sinal não encontrado.');
    const current = snapshot.data();
    const stale = ['title','category','priority','assigneeUid','status'].some(key =>
      (current[key] ?? null) !== (ticket[key] ?? null)
    ) || (
      current.updatedAt?.toMillis?.() !== ticket.updatedAt?.toMillis?.()
    );
    if (stale) {
      const conflict = new Error('Sinal alterado por outra pessoa. Atualize os dados antes de classificar.');
      conflict.code = 'triage/conflict';
      throw conflict;
    }
    if (current.status === 'resolved') throw new Error('Sinais resolvidos não podem ser classificados.');
    if (current.assigneeUid && current.assigneeUid !== context.firebaseUser.uid
      && !['admin','supervisor'].includes(role)) {
      throw new Error('Somente o responsável pode alterar a classificação deste sinal.');
    }

    const category = Object.hasOwn(changes,'category') ? changes.category : current.category;
    const priority = Object.hasOwn(changes,'priority') ? changes.priority : current.priority;
    const title = Object.hasOwn(changes,'title') ? String(changes.title ?? '').trim() : current.title;
    validateTriage(category, priority);
    if (title.length < 3 || title.length > 120) throw new Error('Título deve ter de 3 a 120 caracteres.');
    if ((current.category != null && category === null)
      || (current.priority != null && priority === null)) {
      throw new Error('Não é permitido remover uma classificação já definida.');
    }
    if (current.title === title && current.category === category && current.priority === priority) {
      throw new Error('Nenhuma alteração de triagem foi informada.');
    }

    const classified = current.category == null && category != null;
    const titleOnly = current.category === category && current.priority === priority;
    const type = classified ? 'classified' : titleOnly ? 'title_changed' : 'reclassified';
    transaction.update(ticketRef, {
      title, category, priority, updatedAt: serverTimestamp(),
      lastTriageEventId: eventRef.id
    });
    transaction.set(eventRef, {
      type,
      fromTitle: current.title,
      toTitle: title,
      fromCategory: current.category,
      toCategory: category,
      fromPriority: current.priority,
      toPriority: priority,
      actorUid: context.firebaseUser.uid,
      actorName,
      createdAt: serverTimestamp()
    });
  });
}

export function observeTriageEvents(context, ticketId, onData, onError) {
  const ref = collection(db, 'tenants', context.tenant.id, 'tickets', ticketId, 'triageEvents');
  return onSnapshot(query(ref, orderBy('createdAt', 'asc'), limit(100)),
    snapshot => onData(snapshot.docs.map(item => ({ id: item.id, ...item.data() }))),
    onError);
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

export async function reopenTicket(context, ticket) {
  if (!navigator.onLine) throw new Error('Você está sem conexão. Reconecte-se para reabrir este sinal.');
  if (ticket.status !== 'resolved' || ticket.requesterUid !== context.firebaseUser.uid) {
    throw new Error('Somente o solicitante pode reabrir um sinal resolvido.');
  }

  const ref = doc(db, 'tenants', context.tenant.id, 'tickets', ticket.id);
  await updateDoc(ref, {
    status: 'in_progress',
    updatedAt: serverTimestamp()
  });
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
