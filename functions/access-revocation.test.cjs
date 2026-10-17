// Usa APENAS os emuladores. Nunca liga no projeto sinaldesk-hml real.
const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const { initializeApp, deleteApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { ref, uploadBytes, getMetadata } = require('firebase/storage');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const {
  deactivateUserAccess, deactivateTenantAccess
} = require('./access-revocation');

const projectId = 'demo-sinal-storage-170a';
const root = join(__dirname, '..');
const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const userId = 'user_multi_tenant';
const actorUid = 'superadmin_test';
const tenants = ['tenant-one', 'tenant-two'];
const pathFor = (t, ticket, attachment) =>
  'tenants/' + t + '/tickets/' + ticket + '/attachments/' + attachment;
const metaFor = (uid,t,ticket) => ({
  contentType: 'image/png',
  customMetadata: { tenantId:t, ticketId:ticket, uploadedByUid:uid }
});
let app, db, env;

before(async () => {
  if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080' ||
      process.env.FIREBASE_STORAGE_EMULATOR_HOST !== '127.0.0.1:9199') {
    throw new Error('Emuladores Firebase locais obrigatórios.');
  }
  app = initializeApp({ projectId }, 'security-revocation-tests');
  db = getFirestore(app);
  env = await initializeTestEnvironment({
    projectId,
    firestore: {host:'127.0.0.1',port:8080,rules:readFileSync(join(root,'firestore.rules'),'utf8')},
    storage: {host:'127.0.0.1',port:9199,rules:readFileSync(join(root,'storage.rules'),'utf8')}
  });
  await db.doc('users/' + userId).set({status:'active', platformRole:'user'});
  await db.doc('users/user_failure_case').set({status:'active', platformRole:'user'});
  for (const tenant of tenants) {
    await db.doc('tenants/' + tenant).set({status:'active'});
    await db.doc('tenants/' + tenant + '/members/' + userId)
      .set({status:'active',role:'solicitante'});
    await db.doc('tenants/' + tenant + '/tickets/signal-shared')
      .set({status:'open',requesterUid:userId,assigneeUid:null});
  }
  await db.doc('tenants/tenant-one/members/user_failure_case')
    .set({status:'active',role:'solicitante'});
  await db.doc('tenants/tenant-c').set({status:'active'});
  await db.doc('tenants/tenant-c/members/user_tenant')
    .set({status:'active',role:'solicitante'});
  await db.doc('tenants/tenant-c/tickets/signal-c')
    .set({status:'open',requesterUid:'user_tenant',assigneeUid:null});
});
after(async () => {
  if (env) await env.cleanup();
  if (app) await deleteApp(app);
});

test('revoga vínculo em todos os tenants antes de concluir desativação global', async () => {
  const path = pathFor('tenant-one', 'signal-shared', 'attachment_user_revoke_111');
  const storage = env.authenticatedContext(userId).storage();
  await assertSucceeds(uploadBytes(ref(storage,path),bytes,metaFor(userId,'tenant-one','signal-shared')));
  const beforeAccess = await getMetadata(ref(storage,path));
  assert.ok(beforeAccess);
  const result = await deactivateUserAccess(db,userId,actorUid);
  assert.equal(result.affectedCount,2);
  for (const tenant of tenants) {
    const snap=await db.doc('tenants/' + tenant + '/members/' + userId).get();
    assert.equal(snap.data().status,'inactive');
  }
  const profile=await db.doc('users/' + userId).get();
  assert.equal(profile.data().status,'inactive');
  assert.equal(profile.data().accessRevocationPending,false);
  await assertFails(getMetadata(ref(storage,path)));
  await assertFails(uploadBytes(
    ref(storage,pathFor('tenant-two','signal-shared','attachment_user_revoke_222')),
    bytes,metaFor(userId,'tenant-two','signal-shared')
  ));
});

test('desativação de organização revoga todos seus membros antes de concluir', async () => {
  const storage = env.authenticatedContext('user_tenant').storage();
  const file=pathFor('tenant-c','signal-c','attachment_tenant_revoke_1');
  await assertSucceeds(uploadBytes(ref(storage,file),bytes,metaFor('user_tenant','tenant-c','signal-c')));
  const result = await deactivateTenantAccess(db,'tenant-c',actorUid);
  assert.equal(result.affectedCount,1);
  const member=await db.doc('tenants/tenant-c/members/user_tenant').get();
  const tenant=await db.doc('tenants/tenant-c').get();
  assert.equal(member.data().status,'inactive');
  assert.equal(tenant.data().status,'inactive');
  await assertFails(getMetadata(ref(storage,file)));
});

test('falha no lote não marca conta como inativa e permite retomada idempotente', async () => {
  let interrupted = false;
  const failingDb = {
    doc: p => db.doc(p),
    collection: p => db.collection(p),
    getAll: (...refs) => db.getAll(...refs),
    batch: () => {
      const batch=db.batch();
      return {
        update: (...args) => batch.update(...args),
        async commit() {
          if (!interrupted) { interrupted=true; throw new Error('Simulação de falha na gravação'); }
          return batch.commit();
        }
      };
    }
  };
  await assert.rejects(deactivateUserAccess(failingDb,'user_failure_case',actorUid),
    /Simulação de falha/);
  const profile=await db.doc('users/user_failure_case').get();
  const member=await db.doc('tenants/tenant-one/members/user_failure_case').get();
  assert.equal(profile.data().status,'deactivating');
  assert.equal(profile.data().accessRevocationPending,true);
  assert.equal(member.data().status,'active');
  const recovered=await deactivateUserAccess(db,'user_failure_case',actorUid);
  assert.equal(recovered.affectedCount,1);
  assert.equal((await db.doc('users/user_failure_case').get()).data().status,'inactive');
  assert.equal((await db.doc('tenants/tenant-one/members/user_failure_case').get()).data().status,'inactive');
});

test('não desativa própria conta ou outro superadmin', async () => {
  await assert.rejects(deactivateUserAccess(db,actorUid,actorUid), /própria conta/);
  await db.doc('users/superadmin_extra').set({status:'active',platformRole:'superadmin'});
  await assert.rejects(deactivateUserAccess(db,'superadmin_extra',actorUid), /Superadmin/);
});

test('ações administrativas deixam trilha de auditoria', async () => {
  const audit=await db.collection('securityAudit').get();
  const types=audit.docs.map(s=>s.data().kind);
  assert.ok(types.includes('user_deactivated'));
  assert.ok(types.includes('tenant_deactivated'));
  assert.ok(audit.docs.every(s=>s.data().actorUid===actorUid));
});
