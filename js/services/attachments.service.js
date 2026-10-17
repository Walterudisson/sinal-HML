// Sprint 1.7.0-B: uploads privados com Firebase Storage + confirmação server-side.
import {
  collection, doc, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import {
  getStorage, ref as storageRef, uploadBytesResumable, getBlob
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-functions.js';
import { firebaseApp, db } from '../config/firebase.js';
import { createAttachmentCancellation } from './attachment-cancel.mjs';

const storage = getStorage(firebaseApp);
const functions = getFunctions(firebaseApp, 'southamerica-east1');
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const ATTACHMENT_ID = /^[A-Za-z0-9_-]{20,64}$/;
const confirm = httpsCallable(functions, 'finalizeSinalAttachment');
const discard = httpsCallable(functions, 'discardSinalAttachment');

function fileNameForDisplay(name) {
  return String(name || 'arquivo').replace(/[\\/\x00-\x1f\x7f]/g, '_').slice(0,120) || 'arquivo';
}

export function validateAttachment(file) {
  if (!file || !TYPES.has(file.type)) {
    throw new Error('Formato não permitido. Use JPG, PNG, WebP ou PDF.');
  }
  if (file.size <= 0 || file.size > MAX_ATTACHMENT_BYTES) {
    throw new Error('O arquivo precisa ter entre 1 byte e 10 MiB.');
  }
}

function attachmentPath(tenantId, ticketId, id) {
  if (!ATTACHMENT_ID.test(id)) throw new Error('Identificador de anexo inválido.');
  return `tenants/${tenantId}/tickets/${ticketId}/attachments/${id}`;
}

export function observeAttachments(context, ticketId, onData, onError) {
  const ref = collection(db, 'tenants', context.tenant.id, 'tickets', ticketId, 'attachments');
  return onSnapshot(
    query(ref, orderBy('createdAt', 'asc'), limit(200)),
    snapshot => onData(snapshot.docs.map(item => ({ id: item.id, ...item.data() }))),
    onError
  );
}

export async function uploadConversationAttachment(context, ticket, file, { onProgress, onTask } = {}) {
  validateAttachment(file);
  if (!navigator.onLine) throw new Error('Sem conexão. Reconecte-se antes de enviar.');
  if (!context?.tenant?.id || !ticket?.id || !context?.firebaseUser?.uid) throw new Error('Sessão inválida.');
  const id = crypto.randomUUID().replaceAll('-', '');
  const tenantId = context.tenant.id;
  const ticketId = ticket.id;
  const uploadedByUid = context.firebaseUser.uid;
  const path = attachmentPath(tenantId, ticketId, id);
  const fileRef = storageRef(storage, path);
  const cancellation = createAttachmentCancellation();
  const canceledError = () => Object.assign(new Error('Envio cancelado.'), { code: 'storage/canceled' });
  onTask?.(cancellation);
  let metadataCreated = false;

  try {
    // Primeiro gravar o metadado pending. Se ocorrer cancelamento durante o
    // envio, o backend terá uma referência que pode marcar failed e limpar.
    await setDoc(doc(db, 'tenants', tenantId, 'tickets', ticketId, 'attachments', id), {
      fileName: fileNameForDisplay(file.name),
      storagePath: path,
      contentType: file.type,
      size: file.size,
      uploadedByUid,
      origin: 'conversation',
      status: 'pending',
      createdAt: serverTimestamp()
    });
    metadataCreated = true;
    if (cancellation.requested) throw canceledError();

    const task = uploadBytesResumable(fileRef, file, {
      contentType: file.type,
      customMetadata: { tenantId, ticketId, uploadedByUid }
    });
    cancellation.bind(task);
    await new Promise((resolve, reject) => {
      task.on('state_changed', snapshot => {
        const pct = snapshot.totalBytes
          ? Math.round(snapshot.bytesTransferred / snapshot.totalBytes * 100) : 0;
        onProgress?.(pct);
      }, reject, resolve);
    });
    if (!cancellation.seal()) throw canceledError();

    // Só o servidor define status ready. Após cancelar nunca chamar finalize.
    await confirm({ tenantId, ticketId, attachmentId: id });
    return { id, fileName: fileNameForDisplay(file.name) };
  } catch (error) {
    // Tentar descartar em TODOS os cancelamentos, inclusive antes do fim do
    // upload. A rotina privilegiada marca o pending como failed e elimina
    // o objeto, caso já exista. Triggers corrigem corridas de finalização.
    if (metadataCreated && navigator.onLine) {
      try { await discard({ tenantId, ticketId, attachmentId: id }); }
      catch (cleanupError) {
        console.warn('[Sinal][Attachments] Limpeza posterior necessária:', cleanupError?.code || 'indisponível');
      }
    }
    throw cancellation.requested ? canceledError() : error;
  }
}

export async function fetchPrivateAttachment(context, ticket, attachment) {
  if (attachment?.status !== 'ready') throw new Error('Anexo ainda indisponível.');
  const expected = attachmentPath(context.tenant.id, ticket.id, attachment.id);
  if (attachment.storagePath !== expected) throw new Error('Caminho do anexo inválido.');
  // getBlob usa o SDK autenticado, não emite URL permanente com token.
  return getBlob(storageRef(storage, expected), MAX_ATTACHMENT_BYTES);
}
