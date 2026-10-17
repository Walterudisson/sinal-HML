'use strict';

// Sprint 1.7.0-A: revogação privilegiada de acesso aos anexos.
// A Storage Rule só pode consultar o vínculo e o sinal, por isso o vínculo
// precisa ser invalidado ANTES de concluir a desativação da conta/organização.
// Sem dependências de interface, utilizável também em testes de integração.
const { FieldValue } = require('firebase-admin/firestore');

const PAGE_SIZE = 100;
const VALID_ID = /^[A-Za-z0-9_-]{3,128}$/;

function assertId(value, label) {
  if (typeof value !== 'string' || !VALID_ID.test(value)) {
    throw new Error(label + ' inválido.');
  }
}

// Usa paginação determinística, sem buscar todos os tenants na memória.
// Como ainda não existe provisionamento público, novas adesões precisam
// respeitar o estado "deactivating" ao serem implementadas.
async function revokeUserMemberships(db, uid) {
  let cursor = null;
  let total = 0;
  do {
    let q = db.collection('tenants').orderBy('__name__').limit(PAGE_SIZE);
    if (cursor) q = q.startAfter(cursor);
    const page = await q.get();
    if (page.empty) break;
    const memberRefs = page.docs.map(t => db.doc('tenants/' + t.id + '/members/' + uid));
    const members = await db.getAll(...memberRefs);
    const batch = db.batch();
    let changed = 0;
    for (const snap of members) {
      if (snap.exists && snap.data().status !== 'inactive') {
        batch.update(snap.ref, { status: 'inactive' });
        changed++;
      }
    }
    if (changed) await batch.commit();
    total += changed;
    cursor = page.docs[page.docs.length - 1];
    if (page.size < PAGE_SIZE) break;
  } while (true);
  return total;
}

async function revokeTenantMemberships(db, tenantId) {
  let cursor = null;
  let total = 0;
  const members = db.collection('tenants/' + tenantId + '/members');
  do {
    let q = members.orderBy('__name__').limit(PAGE_SIZE);
    if (cursor) q = q.startAfter(cursor);
    const page = await q.get();
    if (page.empty) break;
    const batch = db.batch();
    let changed = 0;
    for (const snap of page.docs) {
      if (snap.data().status !== 'inactive') {
        batch.update(snap.ref, { status: 'inactive' });
        changed++;
      }
    }
    if (changed) await batch.commit();
    total += changed;
    cursor = page.docs[page.docs.length - 1];
    if (page.size < PAGE_SIZE) break;
  } while (true);
  return total;
}

async function audit(db, kind, targetId, actorUid, affectedCount) {
  await db.collection('securityAudit').add({
    kind, targetId, actorUid, affectedCount,
    createdAt: FieldValue.serverTimestamp()
  });
}

async function deactivateUserAccess(db, uid, actorUid) {
  assertId(uid, 'UID'); assertId(actorUid, 'UID do operador');
  if (uid === actorUid) throw new Error('A desativação da própria conta está bloqueada.');
  const ref = db.doc('users/' + uid);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Conta inexistente.');
  if (snap.data().platformRole === 'superadmin') {
    throw new Error('A desativação de um Superadmin global não é permitida por esta rotina.');
  }

  // Indica operação pendente e bloqueia imediatamente as Rules do Firestore.
  // A operação é idempotente para recuperar falhas de rede ou lotes parciais.
  await ref.update({ status: 'deactivating', accessRevocationPending: true });
  const affectedCount = await revokeUserMemberships(db, uid);

  // Somente após revogar os vínculos é permitido marcar a conta como inativa.
  await ref.update({
    status: 'inactive', accessRevocationPending: false,
    deactivatedByUid: actorUid, deactivatedAt: FieldValue.serverTimestamp()
  });
  await audit(db, 'user_deactivated', uid, actorUid, affectedCount);
  return { uid, affectedCount };
}

async function deactivateTenantAccess(db, tenantId, actorUid) {
  assertId(tenantId, 'Organização'); assertId(actorUid, 'UID do operador');
  const ref = db.doc('tenants/' + tenantId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error('Organização inexistente.');

  // Futuro provisionamento de membros deve rejeitar tenant "deactivating".
  await ref.update({ status: 'deactivating', accessRevocationPending: true });
  const affectedCount = await revokeTenantMemberships(db, tenantId);
  await ref.update({
    status: 'inactive', accessRevocationPending: false,
    deactivatedByUid: actorUid, deactivatedAt: FieldValue.serverTimestamp()
  });
  await audit(db, 'tenant_deactivated', tenantId, actorUid, affectedCount);
  return { tenantId, affectedCount };
}

module.exports = {
  deactivateUserAccess, deactivateTenantAccess,
  revokeUserMemberships, revokeTenantMemberships
};
