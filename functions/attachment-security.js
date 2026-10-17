'use strict';

// Sprint 1.7.0-B: confirmação server-side; o cliente jamais marca um arquivo como ready.
const { FieldValue } = require('firebase-admin/firestore');

const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const MAX_SIZE = 10 * 1024 * 1024;
const ID = /^[A-Za-z0-9_-]{3,128}$/;
const ATTACHMENT_ID = /^[A-Za-z0-9_-]{20,64}$/;
const SUPPORT_ROLES = new Set(['admin', 'supervisor', 'agente']);

function validateKeys({ tenantId, ticketId, attachmentId }) {
  if (![tenantId, ticketId].every(v => typeof v === 'string' && ID.test(v)) ||
      typeof attachmentId !== 'string' || !ATTACHMENT_ID.test(attachmentId)) {
    throw new Error('invalid-argument');
  }
}

function pathFor(tenantId, ticketId, attachmentId) {
  validateKeys({ tenantId, ticketId, attachmentId });
  return `tenants/${tenantId}/tickets/${ticketId}/attachments/${attachmentId}`;
}

function typeMatchesSignature(type, bytes) {
  if (!Buffer.isBuffer(bytes)) bytes = Buffer.from(bytes || []);
  if (type === 'image/jpeg') return bytes.length >= 3 && bytes.subarray(0,3).equals(Buffer.from([0xff,0xd8,0xff]));
  if (type === 'image/png') return bytes.length >= 8 && bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if (type === 'image/webp') return bytes.length >= 12 && bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP';
  if (type === 'application/pdf') return bytes.length >= 5 && bytes.toString('ascii',0,5) === '%PDF-';
  return false;
}

function allowedToUpload(uid, account, tenant, membership, ticket) {
  if (!uid || account?.status !== 'active' || tenant?.status !== 'active' ||
      membership?.status !== 'active' || !ticket || ticket.status === 'resolved') return false;
  return ticket.requesterUid === uid ||
    (SUPPORT_ROLES.has(membership.role) && ticket.assigneeUid === uid);
}

function verifyPendingMetadata(data, uid, path) {
  return data?.status === 'pending' &&
    data.uploadedByUid === uid &&
    data.storagePath === path &&
    data.origin === 'conversation' &&
    typeof data.fileName === 'string' && data.fileName.length >= 1 &&
    data.fileName.length <= 120 &&
    TYPES.has(data.contentType) &&
    Number.isInteger(data.size) && data.size > 0 && data.size <= MAX_SIZE;
}

function verifyObjectMetadata(objectMetadata, data, tenantId, ticketId, uid) {
  const custom = objectMetadata?.metadata || {};
  return Number(objectMetadata?.size) === data.size &&
    TYPES.has(objectMetadata?.contentType) &&
    objectMetadata.contentType === data.contentType &&
    custom.tenantId === tenantId &&
    custom.ticketId === ticketId &&
    custom.uploadedByUid === uid &&
    typeof objectMetadata?.generation === 'string';
}

function docRefs(db, tenantId, ticketId, attachmentId, uid) {
  const root = `tenants/${tenantId}`;
  return {
    user: db.doc('users/' + uid),
    tenant: db.doc(root),
    member: db.doc(root + '/members/' + uid),
    ticket: db.doc(root + '/tickets/' + ticketId),
    attachment: db.doc(root + '/tickets/' + ticketId + '/attachments/' + attachmentId)
  };
}

async function finalizeAttachment({ db, bucket, uid, tenantId, ticketId, attachmentId }) {
  if (!uid) throw new Error('unauthenticated');
  const path = pathFor(tenantId, ticketId, attachmentId);
  const refs = docRefs(db, tenantId, ticketId, attachmentId, uid);
  const [userSnap, tenantSnap, memberSnap, ticketSnap, attachmentSnap] = await Promise.all(
    Object.values(refs).map(ref => ref.get())
  );
  if (!allowedToUpload(uid, userSnap.data(), tenantSnap.data(), memberSnap.data(), ticketSnap.data())) {
    throw new Error('permission-denied');
  }
  const data = attachmentSnap.data();
  if (data?.status === 'ready' && data.uploadedByUid === uid && data.storagePath === path) {
    return { status: 'ready', attachmentId }; // Repetição segura do callable.
  }
  if (!verifyPendingMetadata(data, uid, path)) throw new Error('failed-precondition');

  const file = bucket.file(path);
  const [meta] = await file.getMetadata();
  if (!verifyObjectMetadata(meta, data, tenantId, ticketId, uid)) {
    throw new Error('failed-precondition');
  }
  // MIME declarado pelo browser não basta. Conferimos o cabeçalho dos bytes reais.
  const [header] = await file.download({ start: 0, end: 15 });
  if (!typeMatchesSignature(data.contentType, header)) throw new Error('failed-precondition');

  // Leitura dentro da transação impede publicar ready após revogação/resolução.
  await db.runTransaction(async tx => {
    const [user, tenant, member, ticket, attachment] = await Promise.all(
      Object.values(refs).map(ref => tx.get(ref))
    );
    if (!allowedToUpload(uid, user.data(), tenant.data(), member.data(), ticket.data())) {
      throw new Error('permission-denied');
    }
    const current = attachment.data();
    if (current?.status === 'ready' && current.uploadedByUid === uid && current.storagePath === path) return;
    if (!verifyPendingMetadata(current, uid, path) ||
        current.size !== data.size || current.contentType !== data.contentType) {
      throw new Error('failed-precondition');
    }
    tx.update(refs.attachment, {
      status: 'ready',
      confirmedAt: FieldValue.serverTimestamp(),
      storageGeneration: String(meta.generation)
    });
    tx.update(refs.ticket, {
      lastInteractionAt: FieldValue.serverTimestamp(),
      lastInteractionType: 'attachment',
      lastInteractionByUid: uid,
      lastInteractionAttachmentId: attachmentId
    });
  });
  return { status: 'ready', attachmentId };
}

async function discardPendingAttachment({ db, bucket, uid, tenantId, ticketId, attachmentId }) {
  if (!uid) throw new Error('unauthenticated');
  const path = pathFor(tenantId, ticketId, attachmentId);
  const refs = docRefs(db, tenantId, ticketId, attachmentId, uid);
  const [user, member, attachment] = await Promise.all([
    refs.user.get(), refs.member.get(), refs.attachment.get()
  ]);
  if (user.data()?.status !== 'active' || member.data()?.status !== 'active') {
    throw new Error('permission-denied');
  }
  const data = attachment.data();
  if (data && (data.uploadedByUid !== uid || data.storagePath !== path || data.status === 'ready')) {
    throw new Error('permission-denied');
  }
  const file = bucket.file(path);
  let object;
  try {
    [object] = await file.getMetadata();
  } catch (error) {
    if (error.code !== 404) throw error;
  }
  if (object) {
    const custom = object.metadata || {};
    if (custom.uploadedByUid !== uid || custom.tenantId !== tenantId || custom.ticketId !== ticketId) {
      throw new Error('permission-denied');
    }
  }
  // Tombstone transacional: mesmo sem documento pending, impede que o cliente
  // crie o metadado após iniciarmos o descarte de um objeto já existente.
  if (data || object) {
    await db.runTransaction(async tx => {
      const current = await tx.get(refs.attachment);
      if (current.exists) {
        if (current.data().uploadedByUid !== uid ||
            current.data().storagePath !== path ||
            current.data().status !== 'pending') throw new Error('failed-precondition');
        tx.update(refs.attachment, { status: 'failed', failedAt: FieldValue.serverTimestamp() });
      } else if (object) {
        tx.create(refs.attachment, {
          status: 'failed', uploadedByUid: uid, storagePath: path,
          failedAt: FieldValue.serverTimestamp(), origin: 'conversation'
        });
      }
    });
  }
  if (object) await file.delete({ ifGenerationMatch: object.generation });
  return { status: 'discarded' };
}

// Corridas de rede: um objeto pode ser concluído após o usuário cancelar.
// Eventos Storage e Firestore tentam essa limpeza de forma idempotente.
// Sem um tombstone 'failed' comprovado, nunca remover anexo pronto/pending.
async function removeCanceledStorageObject({ db, bucket, objectName, expectedGeneration = null }) {
  const match = /^tenants\/([A-Za-z0-9_-]{3,128})\/tickets\/([A-Za-z0-9_-]{3,128})\/attachments\/([A-Za-z0-9_-]{20,64})$/.exec(objectName || '');
  if (!match) return false;
  const [, tenantId, ticketId, attachmentId] = match;
  const record = await db.doc(pathFor(tenantId, ticketId, attachmentId)).get();
  const data = record.data();
  if (data?.status !== 'failed' || data.storagePath !== objectName ||
      data.origin !== 'conversation' || !data.uploadedByUid) return false;
  const file = bucket.file(objectName);
  let metadata;
  try {
    [metadata] = await file.getMetadata();
  } catch (error) {
    if (Number(error.code) === 404) return false;
    throw error;
  }
  const custom = metadata.metadata || {};
  if (custom.tenantId !== tenantId || custom.ticketId !== ticketId ||
      custom.uploadedByUid !== data.uploadedByUid) return false;
  if (expectedGeneration != null && String(metadata.generation) !== String(expectedGeneration)) {
    return false;
  }
  try {
    await file.delete({ ifGenerationMatch: metadata.generation });
    return true;
  } catch (error) {
    // Duplicação de eventos e disputa com o callable de descarte: idempotente.
    if ([404, 412].includes(Number(error.code))) return false;
    throw error;
  }
}

function orphanCandidate(object, currentTime, minAgeMs = 24 * 60 * 60 * 1000) {
  const parts = /^tenants\/([A-Za-z0-9_-]{3,128})\/tickets\/([A-Za-z0-9_-]{3,128})\/attachments\/([A-Za-z0-9_-]{20,64})$/.exec(object?.name || '');
  const age = currentTime - Date.parse(object?.metadata?.timeCreated || '');
  if (!parts || !Number.isFinite(age) || age < minAgeMs) return null;
  return { tenantId: parts[1], ticketId: parts[2], attachmentId: parts[3] };
}

// Varredura limitada: cursor para não percorrer o bucket inteiro na mesma execução.
async function cleanupOrphanAttachments({ db, bucket, now = Date.now(), maxResults = 100 }) {
  const stateRef = db.doc('maintenance/attachmentCleanup');
  const state = await stateRef.get();
  const token = state.data()?.pageToken || undefined;
  const [files, nextQuery] = await bucket.getFiles({
    prefix: 'tenants/', maxResults, autoPaginate: false, ...(token ? { pageToken: token } : {})
  });
  let removed = 0;
  for (const file of files) {
    const id = orphanCandidate(file, now);
    if (!id) continue;
    const ref = db.doc(pathFor(id.tenantId, id.ticketId, id.attachmentId));
    let deleteAllowed = false;
    await db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists) {
        // Impede um novo documento pending sobre um objeto destinado à exclusão.
        tx.create(ref, {
          status: 'failed', storagePath: file.name,
          uploadedByUid: String(file.metadata?.metadata?.uploadedByUid || ''),
          origin: 'conversation', failedAt: FieldValue.serverTimestamp()
        });
        deleteAllowed = true;
        return;
      }
      if (snap.data().status === 'ready') return;
      if (snap.data().status === 'pending') {
        tx.update(ref, { status: 'failed', failedAt: FieldValue.serverTimestamp() });
      }
      deleteAllowed = true;
    });
    if (!deleteAllowed) continue;
    try {
      // Falha isolada não interrompe o cursor; a próxima rodada poderá reconsiderar.
      await file.delete({ ifGenerationMatch: file.metadata.generation });
      removed++;
    } catch (error) {
      console.error('[Sinal][Attachments] Não foi possível limpar objeto:', error.code || error.message);
    }
  }
  await stateRef.set({ pageToken: nextQuery?.pageToken || null,
    lastRunAt: FieldValue.serverTimestamp(), inspected: files.length, removed }, { merge: true });
  return { inspected: files.length, removed };
}

module.exports = {
  MAX_SIZE, TYPES, validateKeys, pathFor, typeMatchesSignature,
  allowedToUpload, verifyPendingMetadata, verifyObjectMetadata,
  finalizeAttachment, discardPendingAttachment, removeCanceledStorageObject,
  orphanCandidate, cleanupOrphanAttachments
};
