/**
 * Integration tests of Firebase Storage + Firestore cross-service Rules.
 * Only a demo-* Firebase project and local emulators may be used.
 * Run: npm run test:storage:emulator
 */
const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const {
  initializeTestEnvironment, assertSucceeds, assertFails
} = require('@firebase/rules-unit-testing');
const { setDoc, doc } = require('firebase/firestore');
const {
  ref, uploadBytes, getMetadata, listAll, deleteObject, updateMetadata
} = require('firebase/storage');

const projectId = 'demo-sinal-storage-170a';
const base = join(__dirname, '..');
const bytes = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
const orgA = 'tenant-alpha';
const orgB = 'tenant-bravo';
const openTicket = 'signal-open';
const assignedTicket = 'signal-assigned';
const resolvedTicket = 'signal-resolved';
const newId = key => 'attachment_' + key.padEnd(22, 'x');
const pathFor = (tenantId, ticketId, name) =>
  'tenants/' + tenantId + '/tickets/' + ticketId + '/attachments/' + newId(name);
let env;

function store(uid) {
  return uid === null ? env.unauthenticatedContext().storage() : env.authenticatedContext(uid).storage();
}
function options(uid, tenantId, ticketId, contentType = 'image/png') {
  return {
    contentType,
    customMetadata: { tenantId, ticketId, uploadedByUid: uid }
  };
}
function upload(uid, tenantId, ticketId, id, type = 'image/png', data = bytes, metadata = null) {
  return uploadBytes(ref(store(uid), pathFor(tenantId, ticketId, id)),
    data, metadata || options(uid, tenantId, ticketId, type));
}

before(async () => {
  assert.match(projectId, /^demo-/);
  if (!process.env.FIREBASE_STORAGE_EMULATOR_HOST && !process.env.FIREBASE_EMULATOR_HUB) {
    throw new Error('Ambiente de emuladores não identificado. Nunca executar contra Firebase real.');
  }
  env = await initializeTestEnvironment({
    projectId,
    firestore: { host: '127.0.0.1', port: 8080, rules: readFileSync(join(base, 'firestore.rules'), 'utf8') },
    storage: { host: '127.0.0.1', port: 9199, rules: readFileSync(join(base, 'storage.rules'), 'utf8') }
  });
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    for (const [tenantId, uid, role, status] of [
      [orgA, 'alice', 'solicitante', 'active'],
      [orgA, 'bob', 'agente', 'active'],
      [orgA, 'carol', 'supervisor', 'active'],
      [orgA, 'disabled', 'solicitante', 'inactive'],
      [orgB, 'mallory', 'agente', 'active']
    ]) {
      await setDoc(doc(db, 'tenants', tenantId, 'members', uid), { role, status });
    }
    for (const [ticketId, status, assigneeUid] of [
      [openTicket, 'open', null],
      [assignedTicket, 'in_progress', 'bob'],
      [resolvedTicket, 'resolved', 'bob']
    ]) {
      await setDoc(doc(db, 'tenants', orgA, 'tickets', ticketId), {
        status, requesterUid: 'alice', assigneeUid
      });
    }
    await setDoc(doc(db, 'tenants', orgB, 'tickets', 'other-ticket'), {
      status: 'open', requesterUid: 'mallory', assigneeUid: null
    });
  });
});

after(async () => { if (env) await env.cleanup(); });

test('solicitante pode anexar a sinal aberto e ler seu próprio arquivo', async () => {
  await assertSucceeds(upload('alice', orgA, openTicket, 'alice-open'));
  await assertSucceeds(getMetadata(ref(store('alice'), pathFor(orgA, openTicket, 'alice-open'))));
});
test('atendente atribuído pode anexar, e participantes autorizados podem ler', async () => {
  await assertSucceeds(upload('bob', orgA, assignedTicket, 'bob-assigned'));
  const file = pathFor(orgA, assignedTicket, 'bob-assigned');
  await assertSucceeds(getMetadata(ref(store('alice'), file)));
  await assertSucceeds(getMetadata(ref(store('carol'), file)));
});
test('atendente não atribuído não pode anexar em atendimento', async () => {
  await assertFails(upload('carol', orgA, assignedTicket, 'not-assigned'));
});
test('usuário de outro tenant não pode ler ou gravar arquivos', async () => {
  const aliceFile = pathFor(orgA, openTicket, 'alice-open');
  await assertFails(getMetadata(ref(store('mallory'), aliceFile)));
  await assertFails(upload('mallory', orgA, openTicket, 'outsider'));
  await assertFails(upload('alice', orgB, 'other-ticket', 'other-org'));
});
test('usuário não autenticado não pode ler, enviar ou listar arquivos', async () => {
  const aliceFile = pathFor(orgA, openTicket, 'alice-open');
  await assertFails(getMetadata(ref(store(null), aliceFile)));
  await assertFails(upload(null, orgA, openTicket, 'anonymous', 'image/png', bytes,
    { contentType: 'image/png', customMetadata: { tenantId: orgA, ticketId: openTicket, uploadedByUid: 'alice' } }));
  await assertFails(listAll(ref(store(null), 'tenants/' + orgA)));
});
test('membro inativo não pode gravar nem acessar arquivo', async () => {
  const aliceFile = pathFor(orgA, openTicket, 'alice-open');
  await assertFails(getMetadata(ref(store('disabled'), aliceFile)));
  await assertFails(upload('disabled', orgA, openTicket, 'disabled'));
});
test('sinal resolvido não aceita novos arquivos', async () => {
  await assertFails(upload('alice', orgA, resolvedTicket, 'resolved'));
});
test('arquivos não podem ser substituídos nem removidos', async () => {
  const file = ref(store('alice'), pathFor(orgA, openTicket, 'alice-open'));
  await assertFails(upload('alice', orgA, openTicket, 'alice-open'));
  await assertFails(deleteObject(file));
  await assertFails(updateMetadata(file, { customMetadata: { tenantId: orgA } }));
});
test('nenhum usuário pode listar o diretório de anexos', async () => {
  await assertFails(listAll(ref(store('alice'), 'tenants/' + orgA + '/tickets/' + openTicket + '/attachments')));
});
test('tipo proibido, MIME inconsistente e metadados de autoria adulterados são negados', async () => {
  await assertFails(upload('alice', orgA, openTicket, 'exe', 'application/x-msdownload'));
  await assertFails(upload('alice', orgA, openTicket, 'author-mismatch', 'image/png', bytes,
    options('bob', orgA, openTicket)));
  await assertFails(upload('alice', orgA, openTicket, 'tenant-mismatch', 'image/png', bytes,
    options('alice', orgB, openTicket)));
  await assertFails(upload('alice', orgA, openTicket, 'missing-meta', 'image/png', bytes,
    { contentType: 'image/png' }));
});
test('arquivo com mais de 10 MiB é negado', async () => {
  const oversized = new Uint8Array(10 * 1024 * 1024 + 1);
  await assertFails(upload('alice', orgA, openTicket, 'oversized', 'image/png', oversized));
});
test('somente objetos no caminho autorizado podem ser criados', async () => {
  await assertFails(uploadBytes(ref(store('alice'), 'public/unsafe.png'), bytes, options('alice', orgA, openTicket)));
  await assertFails(uploadBytes(ref(store('alice'), 'tenants/' + orgA + '/tickets/' + openTicket + '/attachments/short'),
    bytes, options('alice', orgA, openTicket)));
});
