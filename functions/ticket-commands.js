'use strict';

const { HttpsError } = require('firebase-functions/v2/https');
const { FieldValue } = require('firebase-admin/firestore');

const SUPPORT_ROLES = new Set(['admin', 'supervisor', 'agente']);
const COMMANDS = new Set(['claim', 'wait_requester', 'resolve', 'reopen', 'close']);

function requireId(value, label) {
  const id = String(value || '');
  if (!/^[A-Za-z0-9_-]{1,160}$/.test(id)) {
    throw new HttpsError('invalid-argument', `${label} inválido.`);
  }
  return id;
}

function requireActiveAccount(userSnap, memberSnap) {
  if (!userSnap.exists || userSnap.data().status !== 'active') {
    throw new HttpsError('permission-denied', 'Conta indisponível.');
  }
  if (!memberSnap.exists || memberSnap.data().status !== 'active') {
    throw new HttpsError('permission-denied', 'Vínculo com a organização indisponível.');
  }
}

function actorFrom({ uid, token }, user, member) {
  return {
    uid,
    name: user.displayName || member.displayName || token?.name || token?.email || 'Usuário',
    email: user.email || token?.email || '',
    role: member.role || 'solicitante'
  };
}

function assertTransitionAllowed(command, actor, ticket) {
  const support = SUPPORT_ROLES.has(actor.role);
  const requester = ticket.requesterUid === actor.uid;
  const assignee = ticket.assigneeUid === actor.uid;

  if (command === 'claim') {
    if (!support || ticket.status !== 'open' || ticket.assigneeUid) {
      throw new HttpsError('failed-precondition', 'Este sinal não pode ser assumido por este usuário.');
    }
    return;
  }
  if (command === 'wait_requester') {
    if (!support || !assignee || ticket.status !== 'in_progress') {
      throw new HttpsError('failed-precondition', 'Somente o atendente responsável pode aguardar o solicitante.');
    }
    return;
  }
  if (command === 'resolve') {
    if (!support || !assignee || ticket.status !== 'in_progress') {
      throw new HttpsError('failed-precondition', 'Somente o atendente responsável pode resolver este sinal.');
    }
    return;
  }
  if (command === 'reopen') {
    if (ticket.status !== 'resolved' || !(requester || (support && assignee))) {
      throw new HttpsError('failed-precondition', 'Este sinal não pode ser reaberto por este usuário.');
    }
    return;
  }
  if (command === 'close') {
    if (!requester || ticket.status !== 'resolved') {
      throw new HttpsError('failed-precondition', 'Somente o solicitante pode fechar um sinal resolvido.');
    }
    return;
  }
  throw new HttpsError('invalid-argument', 'Comando de ciclo de vida inválido.');
}

function assertCanMessage(actor, ticket) {
  if (ticket.status === 'resolved' || ticket.status === 'closed') {
    throw new HttpsError('failed-precondition', 'Este sinal não aceita novas mensagens.');
  }

  const requester = ticket.requesterUid === actor.uid;
  const assignedSupport = SUPPORT_ROLES.has(actor.role) && ticket.assigneeUid === actor.uid;
  if (!requester && !assignedSupport) {
    throw new HttpsError('permission-denied', 'Você não pode enviar mensagens neste sinal.');
  }
}

function resolutionInput(data) {
  const internalText = String(data.internalText || '').trim();
  const share = data.share === true;
  const publicText = share ? String(data.publicText || '').trim() : '';
  if (internalText.length < 3 || internalText.length > 4000) {
    throw new HttpsError('invalid-argument', 'A solução interna deve ter entre 3 e 4.000 caracteres.');
  }
  if (share && (publicText.length < 3 || publicText.length > 2000)) {
    throw new HttpsError('invalid-argument', 'A mensagem pública deve ter entre 3 e 2.000 caracteres.');
  }
  return {
    internalText,
    share,
    publicText,
    knowledgeCandidate: data.knowledgeCandidate === true
  };
}

async function loadCommandContext(tx, db, auth, tenantId, ticketId) {
  const userRef = db.doc(`users/${auth.uid}`);
  const memberRef = db.doc(`tenants/${tenantId}/members/${auth.uid}`);
  const ticketRef = db.doc(`tenants/${tenantId}/tickets/${ticketId}`);
  const [userSnap, memberSnap, ticketSnap] = await Promise.all([
    tx.get(userRef),
    tx.get(memberRef),
    tx.get(ticketRef)
  ]);

  requireActiveAccount(userSnap, memberSnap);
  if (!ticketSnap.exists) throw new HttpsError('not-found', 'Sinal não encontrado.');

  const user = userSnap.data();
  const member = memberSnap.data();
  const ticket = ticketSnap.data();
  const actor = actorFrom(auth, user, member);
  return { actor, ticket, ticketRef };
}

async function executeTicketCommand(db, auth, rawData) {
  if (!auth?.uid) throw new HttpsError('unauthenticated', 'Entre novamente para continuar.');
  const data = rawData || {};
  const tenantId = requireId(data.tenantId, 'Organização');
  const ticketId = requireId(data.ticketId, 'Sinal');
  const command = String(data.command || '');
  if (!COMMANDS.has(command)) throw new HttpsError('invalid-argument', 'Comando inválido.');

  return db.runTransaction(async (tx) => {
    const { actor, ticket, ticketRef } = await loadCommandContext(tx, db, auth, tenantId, ticketId);
    assertTransitionAllowed(command, actor, ticket);

    const eventRef = ticketRef.collection('statusEvents').doc();
    const now = FieldValue.serverTimestamp();

    if (command === 'claim') {
      tx.update(ticketRef, {
        status: 'in_progress',
        assigneeUid: actor.uid,
        assigneeName: actor.name,
        assigneeEmail: actor.email,
        updatedAt: now,
        lastEventId: eventRef.id
      });
      tx.set(eventRef, {
        type: 'claimed', from: 'open', to: 'in_progress',
        actorUid: actor.uid, actorName: actor.name, createdAt: now
      });
      return { status: 'in_progress', eventId: eventRef.id };
    }

    if (command === 'wait_requester') {
      tx.update(ticketRef, {
        status: 'waiting_requester',
        updatedAt: now,
        lastEventId: eventRef.id
      });
      tx.set(eventRef, {
        type: 'waiting_requester', from: 'in_progress', to: 'waiting_requester',
        actorUid: actor.uid, actorName: actor.name, createdAt: now
      });
      return { status: 'waiting_requester', eventId: eventRef.id };
    }

    if (command === 'resolve') {
      const resolution = resolutionInput(data);
      const privateRef = ticketRef.collection('privateResolutions').doc(eventRef.id);
      tx.update(ticketRef, {
        status: 'resolved',
        resolvedAt: now,
        resolvedByUid: actor.uid,
        resolvedByName: actor.name,
        resolutionShared: resolution.share,
        publicResolution: resolution.publicText,
        latestResolutionId: eventRef.id,
        updatedAt: now,
        lastEventId: eventRef.id
      });
      tx.set(privateRef, {
        text: resolution.internalText,
        knowledgeCandidate: resolution.knowledgeCandidate,
        createdByUid: actor.uid,
        createdByName: actor.name,
        createdAt: now
      });
      tx.set(eventRef, {
        type: 'resolved', from: 'in_progress', to: 'resolved',
        actorUid: actor.uid, actorName: actor.name,
        resolutionId: eventRef.id,
        resolutionShared: resolution.share,
        publicResolution: resolution.publicText,
        createdAt: now
      });
      return { status: 'resolved', eventId: eventRef.id };
    }

    if (command === 'reopen') {
      tx.update(ticketRef, {
        status: 'in_progress',
        updatedAt: now,
        lastEventId: eventRef.id
      });
      tx.set(eventRef, {
        type: 'reopened', from: 'resolved', to: 'in_progress',
        actorUid: actor.uid, actorName: actor.name, createdAt: now
      });
      return { status: 'in_progress', eventId: eventRef.id };
    }

    tx.update(ticketRef, {
      status: 'closed',
      closedAt: now,
      closedByUid: actor.uid,
      closedByName: actor.name,
      updatedAt: now,
      lastEventId: eventRef.id
    });
    tx.set(eventRef, {
      type: 'closed', from: 'resolved', to: 'closed',
      actorUid: actor.uid, actorName: actor.name, createdAt: now
    });
    return { status: 'closed', eventId: eventRef.id };
  });
}

async function executeSendMessage(db, auth, rawData) {
  if (!auth?.uid) throw new HttpsError('unauthenticated', 'Entre novamente para continuar.');
  const data = rawData || {};
  const tenantId = requireId(data.tenantId, 'Organização');
  const ticketId = requireId(data.ticketId, 'Sinal');
  const body = String(data.body || '').trim();
  if (!body || body.length > 4000) {
    throw new HttpsError('invalid-argument', 'A mensagem deve ter entre 1 e 4.000 caracteres.');
  }

  return db.runTransaction(async (tx) => {
    const { actor, ticket, ticketRef } = await loadCommandContext(tx, db, auth, tenantId, ticketId);
    assertCanMessage(actor, ticket);

    const messageRef = ticketRef.collection('messages').doc();
    const now = FieldValue.serverTimestamp();
    tx.set(messageRef, {
      body,
      visibility: 'public',
      authorUid: actor.uid,
      authorName: actor.name,
      authorEmail: actor.email,
      authorRole: actor.role,
      createdAt: now
    });

    let resumed = false;
    let eventId = null;
    if (ticket.status === 'waiting_requester' && ticket.requesterUid === actor.uid) {
      const eventRef = ticketRef.collection('statusEvents').doc();
      eventId = eventRef.id;
      resumed = true;
      tx.update(ticketRef, {
        status: 'in_progress',
        updatedAt: now,
        lastEventId: eventRef.id
      });
      tx.set(eventRef, {
        type: 'requester_replied',
        from: 'waiting_requester',
        to: 'in_progress',
        actorUid: actor.uid,
        actorName: actor.name,
        messageId: messageRef.id,
        createdAt: now
      });
    }

    return { messageId: messageRef.id, resumed, eventId };
  });
}

module.exports = {
  SUPPORT_ROLES,
  assertTransitionAllowed,
  assertCanMessage,
  resolutionInput,
  executeTicketCommand,
  executeSendMessage
};
