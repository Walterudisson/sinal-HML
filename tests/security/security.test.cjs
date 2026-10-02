// Testes locais. Nunca utilizam o projeto Firebase real ou dados de HML.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds
} = require('@firebase/rules-unit-testing');
const {
  doc, getDoc, setDoc, writeBatch, serverTimestamp
} = require('firebase/firestore');

const projectId = 'demo-sinal-security';
const tenant = 'sinal-interno';
const walterUid = 'walter-hml-mock';
const otherUid = 'agente-hml-mock';
const requesterUid = 'requester-hml-mock';
let env;

const ticketPath = (ticket) => `tenants/${tenant}/tickets/${ticket}`;

before(async () => {
  env = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: '127.0.0.1',
      port: 8087,
      rules: readFileSync(resolve(__dirname, '../../firestore.rules'), 'utf8')
    }
  });
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    const users = [
      [walterUid, 'Walter HML', 'walter@example.test', 'agente'],
      [otherUid, 'Atendente Teste', 'agente@example.test', 'agente'],
      [requesterUid, 'Solicitante Teste', 'solicitante@example.test', 'solicitante']
    ];
    for (const [uid, displayName, email, role] of users) {
      await setDoc(doc(db, `users/${uid}`), {
        displayName, email, status: 'active', platformRole: 'user', defaultTenantId: tenant
      });
      await setDoc(doc(db, `tenants/${tenant}/members/${uid}`), {
        displayName, role, status: 'active'
      });
    }
    await setDoc(doc(db, `tenants/${tenant}`), { name: 'Sinal teste', status: 'active' });
    for (const ticketId of ['authorized', 'unauthorized', 'standalone']) {
      await setDoc(doc(db, ticketPath(ticketId)), {
        code: 'S-TEST1', title: 'Teste seguro', description: 'Somente dados fictícios',
        category: 'acesso', priority: 'normal', status: 'in_progress',
        requesterUid, requesterName: 'Solicitante Teste',
        requesterEmail: 'solicitante@example.test', createdByUid: requesterUid,
        source: 'web', assigneeUid: walterUid, assigneeName: 'Walter HML',
        assigneeEmail: 'walter@example.test', teamId: null,
        createdAt: new Date(), updatedAt: new Date(), lastEventId: 'seed'
      });
    }
  });
});

after(async () => { await env?.cleanup(); });

function resolutionBatch(uid, ticketId) {
  const db = env.authenticatedContext(uid).firestore();
  const ticketRef = doc(db, ticketPath(ticketId));
  const privateRef = doc(ticketRef, 'private', 'resolution');
  const eventRef = doc(ticketRef, 'statusEvents', 'resolution-test');
  const actorName = uid === walterUid ? 'Walter HML' : 'Atendente Teste';
  const batch = writeBatch(db);
  batch.update(ticketRef, {
    status: 'resolved',
    resolvedAt: serverTimestamp(),
    resolvedByUid: uid,
    resolvedByName: actorName,
    resolutionShared: false,
    publicResolution: '',
    updatedAt: serverTimestamp(),
    lastEventId: 'resolution-test'
  });
  batch.set(privateRef, {
    text: 'Exemplo fictício de solução técnica confidencial',
    knowledgeCandidate: false,
    createdByUid: uid,
    createdByName: actorName,
    createdAt: serverTimestamp()
  });
  batch.set(eventRef, {
    type: 'resolved', from: 'in_progress', to: 'resolved',
    actorUid: uid, actorName,
    createdAt: serverTimestamp()
  });
  return batch.commit();
}

test('Atendente não responsável NÃO consegue resolver, mesmo em lote completo', async () => {
  await assertFails(resolutionBatch(otherUid, 'unauthorized'));
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    const ticket = await getDoc(doc(db, ticketPath('unauthorized')));
    assert.equal(ticket.data().status, 'in_progress');
    const privateDoc = await getDoc(doc(db, ticketPath('unauthorized'), 'private', 'resolution'));
    assert.equal(privateDoc.exists(), false);
  });
});

test('Responsável PODE resolver com lote completo e solução somente privada', async () => {
  await assertSucceeds(resolutionBatch(walterUid, 'authorized'));
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    const publicDoc = (await getDoc(doc(db, ticketPath('authorized')))).data();
    assert.equal(publicDoc.status, 'resolved');
    assert.equal(publicDoc.publicResolution, '');
    assert.equal(publicDoc.resolutionShared, false);
    assert.equal(Object.hasOwn(publicDoc, 'text'), false);
    const privateDoc = await getDoc(doc(db, ticketPath('authorized'), 'private', 'resolution'));
    assert.equal(privateDoc.data().createdByUid, walterUid);
  });
});

test('Leitura privada bloqueada para solicitante e permitida para equipe', async () => {
  const path = doc(env.authenticatedContext(requesterUid).firestore(), ticketPath('authorized'), 'private', 'resolution');
  await assertFails(getDoc(path));
  const allowed = doc(env.authenticatedContext(otherUid).firestore(), ticketPath('authorized'), 'private', 'resolution');
  await assertSucceeds(getDoc(allowed));
});

test('Atualização isolada do ticket é negada até ao responsável', async () => {
  const db = env.authenticatedContext(walterUid).firestore();
  const batch = writeBatch(db);
  batch.update(doc(db, ticketPath('standalone')), {
    status: 'resolved',
    resolvedAt: serverTimestamp(),
    resolvedByUid: walterUid,
    resolvedByName: 'Walter HML',
    resolutionShared: false,
    publicResolution: '',
    updatedAt: serverTimestamp(),
    lastEventId: 'missing-batch-documents'
  });
  await assertFails(batch.commit());
});
