const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const {
  initializeTestEnvironment,
  assertSucceeds
} = require('@firebase/rules-unit-testing');
const {
  collection, doc, getDoc, setDoc, updateDoc, serverTimestamp
} = require('firebase/firestore');

const projectId = 'demo-sinal-security';
const tenantId = 'tenant-test';
const requesterUid = 'requester-test';
const agentUid = 'agent-test';
let env;

const ticketPath = (id) => `tenants/${tenantId}/tickets/${id}`;

async function assertDeniedWithoutExpressionLimit(promise) {
  try {
    await promise;
    assert.fail('A operação deveria ser negada pelas regras.');
  } catch (error) {
    const message = String(error?.message || error || '');
    assert.match(message, /permission[-_ ]denied|PERMISSION_DENIED/i);
    assert.doesNotMatch(message, /maximum of 1000 expressions/i);
  }
}

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
    await setDoc(doc(db, `tenants/${tenantId}`), { name: 'Tenant teste', status: 'active' });

    for (const [uid, displayName, email, role] of [
      [requesterUid, 'Solicitante Teste', 'requester@example.test', 'solicitante'],
      [agentUid, 'Agente Teste', 'agent@example.test', 'agente']
    ]) {
      await setDoc(doc(db, `users/${uid}`), {
        displayName, email, status: 'active', platformRole: 'user', defaultTenantId: tenantId
      });
      await setDoc(doc(db, `tenants/${tenantId}/members/${uid}`), {
        displayName, role, status: 'active'
      });
    }

    await setDoc(doc(db, ticketPath('existing')), {
      code: 'S-EXIST', title: 'Teste existente', description: 'Teste',
      category: 'acesso', priority: 'normal', status: 'in_progress',
      requesterUid, requesterName: 'Solicitante Teste', requesterEmail: 'requester@example.test',
      createdByUid: requesterUid, source: 'web',
      assigneeUid: agentUid, assigneeName: 'Agente Teste', assigneeEmail: 'agent@example.test',
      teamId: null, createdAt: new Date(), updatedAt: new Date(), lastEventId: 'seed'
    });

    await setDoc(doc(db, ticketPath('existing'), 'statusEvents', 'seed'), {
      type: 'claimed', from: 'open', to: 'in_progress',
      actorUid: agentUid, actorName: 'Agente Teste', createdAt: new Date()
    });

    await setDoc(doc(db, ticketPath('existing'), 'messages', 'seed-message'), {
      body: 'Mensagem existente', visibility: 'public',
      authorUid: requesterUid, authorName: 'Solicitante Teste',
      authorEmail: 'requester@example.test', authorRole: 'solicitante',
      createdAt: new Date()
    });

    await setDoc(doc(db, ticketPath('existing'), 'privateResolutions', 'seed-resolution'), {
      text: 'Solução técnica interna', knowledgeCandidate: false,
      createdByUid: agentUid, createdByName: 'Agente Teste', createdAt: new Date()
    });
  });
});

after(async () => { await env?.cleanup(); });

test('solicitante ativo pode criar sinal novo no estado open', async () => {
  const db = env.authenticatedContext(requesterUid).firestore();
  await assertSucceeds(setDoc(doc(db, ticketPath('new-ticket')), {
    code: 'S-NEW01',
    title: 'Novo sinal',
    description: 'Descrição válida',
    category: 'acesso',
    priority: 'normal',
    status: 'open',
    requesterUid,
    requesterName: 'Solicitante Teste',
    requesterEmail: 'requester@example.test',
    createdByUid: requesterUid,
    source: 'web',
    assigneeUid: null,
    teamId: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }));
});

test('cliente não pode atualizar ticket operacional diretamente', async () => {
  const db = env.authenticatedContext(agentUid).firestore();
  await assertDeniedWithoutExpressionLimit(updateDoc(doc(db, ticketPath('existing')), {
    status: 'waiting_requester',
    updatedAt: serverTimestamp()
  }));
});

test('cliente não pode criar statusEvent diretamente', async () => {
  const db = env.authenticatedContext(agentUid).firestore();
  await assertDeniedWithoutExpressionLimit(setDoc(
    doc(db, ticketPath('existing'), 'statusEvents', 'fake-event'),
    { type:'waiting_requester', from:'in_progress', to:'waiting_requester',
      actorUid:agentUid, actorName:'Agente Teste', createdAt:serverTimestamp() }
  ));
});

test('solicitante não pode criar mensagem diretamente', async () => {
  const db = env.authenticatedContext(requesterUid).firestore();
  await assertDeniedWithoutExpressionLimit(setDoc(
    doc(collection(db, ticketPath('existing'), 'messages')),
    { body:'Mensagem direta', visibility:'public', authorUid:requesterUid,
      authorName:'Solicitante Teste', authorEmail:'requester@example.test',
      authorRole:'solicitante', createdAt:serverTimestamp() }
  ));
});

test('agente também não pode criar mensagem diretamente', async () => {
  const db = env.authenticatedContext(agentUid).firestore();
  await assertDeniedWithoutExpressionLimit(setDoc(
    doc(collection(db, ticketPath('existing'), 'messages')),
    { body:'Mensagem direta', visibility:'public', authorUid:agentUid,
      authorName:'Agente Teste', authorEmail:'agent@example.test',
      authorRole:'agente', createdAt:serverTimestamp() }
  ));
});

test('cliente não pode escrever resolução privada diretamente', async () => {
  const db = env.authenticatedContext(agentUid).firestore();
  await assertDeniedWithoutExpressionLimit(setDoc(
    doc(db, ticketPath('existing'), 'privateResolutions', 'fake-resolution'),
    { text:'Não autorizado', knowledgeCandidate:false,
      createdByUid:agentUid, createdByName:'Agente Teste', createdAt:serverTimestamp() }
  ));
});

test('solicitante lê conversa e histórico públicos do próprio sinal', async () => {
  const db = env.authenticatedContext(requesterUid).firestore();
  await assertSucceeds(getDoc(doc(db, ticketPath('existing'), 'messages', 'seed-message')));
  await assertSucceeds(getDoc(doc(db, ticketPath('existing'), 'statusEvents', 'seed')));
});

test('solução privada continua exclusiva da equipe', async () => {
  const requesterDb = env.authenticatedContext(requesterUid).firestore();
  const agentDb = env.authenticatedContext(agentUid).firestore();
  const path = ticketPath('existing') + '/privateResolutions/seed-resolution';
  await assertDeniedWithoutExpressionLimit(getDoc(doc(requesterDb, path)));
  await assertSucceeds(getDoc(doc(agentDb, path)));
});
