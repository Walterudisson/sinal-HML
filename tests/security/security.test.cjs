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
  collection, doc, getDoc, setDoc, writeBatch, serverTimestamp
} = require('firebase/firestore');

const projectId = 'demo-sinal-security';
const tenantId = 'tenant-test';
const requesterUid = 'requester-test';
const agentUid = 'agent-test';
const otherAgentUid = 'other-agent-test';
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
    const users = [
      [requesterUid, 'Solicitante Teste', 'requester@example.test', 'solicitante'],
      [agentUid, 'Agente Teste', 'agent@example.test', 'agente'],
      [otherAgentUid, 'Outro Agente', 'other@example.test', 'agente']
    ];

    await setDoc(doc(db, `tenants/${tenantId}`), { name: 'Tenant teste', status: 'active' });

    for (const [uid, displayName, email, role] of users) {
      await setDoc(doc(db, `users/${uid}`), {
        displayName, email, status: 'active', platformRole: 'user', defaultTenantId: tenantId
      });
      await setDoc(doc(db, `tenants/${tenantId}/members/${uid}`), {
        displayName, role, status: 'active'
      });
    }

    for (const id of ['wait-ok', 'wait-other', 'wait-requester', 'wait-no-event']) {
      await setDoc(doc(db, ticketPath(id)), {
        code: 'S-WAIT', title: 'Teste espera', description: 'Teste de regras',
        category: 'acesso', priority: 'normal', status: 'in_progress',
        requesterUid, requesterName: 'Solicitante Teste', requesterEmail: 'requester@example.test',
        createdByUid: requesterUid, source: 'web',
        assigneeUid: agentUid, assigneeName: 'Agente Teste', assigneeEmail: 'agent@example.test',
        teamId: null, createdAt: new Date(), updatedAt: new Date(), lastEventId: 'seed'
      });
    }

    for (const id of ['resume-ok', 'resume-standalone', 'agent-message']) {
      await setDoc(doc(db, ticketPath(id)), {
        code: 'S-RESUME', title: 'Teste retomada', description: 'Teste de regras',
        category: 'acesso', priority: 'normal', status: 'waiting_requester',
        requesterUid, requesterName: 'Solicitante Teste', requesterEmail: 'requester@example.test',
        createdByUid: requesterUid, source: 'web',
        assigneeUid: agentUid, assigneeName: 'Agente Teste', assigneeEmail: 'agent@example.test',
        teamId: null, createdAt: new Date(), updatedAt: new Date(), lastEventId: 'seed'
      });
    }
  });
});

after(async () => { await env?.cleanup(); });

function waitBatch(uid, ticketId, actorName) {
  const db = env.authenticatedContext(uid).firestore();
  const ticketRef = doc(db, ticketPath(ticketId));
  const eventRef = doc(ticketRef, 'statusEvents', 'evt-wait');
  const batch = writeBatch(db);
  batch.update(ticketRef, {
    status: 'waiting_requester',
    updatedAt: serverTimestamp(),
    lastEventId: 'evt-wait'
  });
  batch.set(eventRef, {
    type: 'waiting_requester',
    from: 'in_progress',
    to: 'waiting_requester',
    actorUid: uid,
    actorName,
    createdAt: serverTimestamp()
  });
  return batch.commit();
}

function requesterResumeBatch(ticketId) {
  const db = env.authenticatedContext(requesterUid).firestore();
  const ticketRef = doc(db, ticketPath(ticketId));
  const messageRef = doc(collection(ticketRef, 'messages'));
  const eventRef = doc(ticketRef, 'statusEvents', 'evt-resume');
  const batch = writeBatch(db);

  batch.set(messageRef, {
    body: 'Segue a informação solicitada.',
    visibility: 'public',
    authorUid: requesterUid,
    authorName: 'Solicitante Teste',
    authorEmail: 'requester@example.test',
    authorRole: 'solicitante',
    createdAt: serverTimestamp()
  });
  batch.update(ticketRef, {
    status: 'in_progress',
    updatedAt: serverTimestamp(),
    lastEventId: 'evt-resume'
  });
  batch.set(eventRef, {
    type: 'requester_replied',
    from: 'waiting_requester',
    to: 'in_progress',
    actorUid: requesterUid,
    actorName: 'Solicitante Teste',
    messageId: messageRef.id,
    createdAt: serverTimestamp()
  });
  return batch.commit();
}

test('responsável pode marcar sinal como Aguardando solicitante', async () => {
  await assertSucceeds(waitBatch(agentUid, 'wait-ok', 'Agente Teste'));
  await env.withSecurityRulesDisabled(async (context) => {
    const snap = await getDoc(doc(context.firestore(), ticketPath('wait-ok')));
    assert.equal(snap.data().status, 'waiting_requester');
  });
});

test('outro agente não pode colocar sinal alheio em espera', async () => {
  await assertDeniedWithoutExpressionLimit(waitBatch(otherAgentUid, 'wait-other', 'Outro Agente'));
});

test('statusEvent isolado não pode ser criado sem a transição correspondente no ticket', async () => {
  const db = env.authenticatedContext(agentUid).firestore();
  const eventRef = doc(db, ticketPath('wait-other'), 'statusEvents', 'evt-isolated');
  await assertDeniedWithoutExpressionLimit(setDoc(eventRef, {
    type: 'waiting_requester',
    from: 'in_progress',
    to: 'waiting_requester',
    actorUid: agentUid,
    actorName: 'Agente Teste',
    createdAt: serverTimestamp()
  }));
});

test('ticket não pode mudar para espera sem criar o statusEvent no mesmo lote', async () => {
  const db = env.authenticatedContext(agentUid).firestore();
  const ticketRef = doc(db, ticketPath('wait-no-event'));
  const batch = writeBatch(db);
  batch.update(ticketRef, {
    status: 'waiting_requester',
    updatedAt: serverTimestamp(),
    lastEventId: 'evt-ausente'
  });
  await assertDeniedWithoutExpressionLimit(batch.commit());
});

test('solicitante não pode executar a transição de espera', async () => {
  await assertDeniedWithoutExpressionLimit(waitBatch(requesterUid, 'wait-requester', 'Solicitante Teste'));
});

test('resposta do solicitante retoma atendimento em lote atômico', async () => {
  await assertSucceeds(requesterResumeBatch('resume-ok'));
  await env.withSecurityRulesDisabled(async (context) => {
    const snap = await getDoc(doc(context.firestore(), ticketPath('resume-ok')));
    assert.equal(snap.data().status, 'in_progress');
    assert.equal(snap.data().assigneeUid, agentUid);
    assert.equal(snap.data().lastEventId, 'evt-resume');
  });
});

test('mensagem isolada do solicitante enquanto aguarda é negada', async () => {
  const db = env.authenticatedContext(requesterUid).firestore();
  const messageRef = doc(collection(db, ticketPath('resume-standalone'), 'messages'));
  await assertDeniedWithoutExpressionLimit(setDoc(messageRef, {
    body: 'Mensagem sem retomar o estado',
    visibility: 'public',
    authorUid: requesterUid,
    authorName: 'Solicitante Teste',
    authorEmail: 'requester@example.test',
    authorRole: 'solicitante',
    createdAt: serverTimestamp()
  }));
});

test('atendente responsável pode continuar enviando mensagem durante a espera sem mudar o estado', async () => {
  const db = env.authenticatedContext(agentUid).firestore();
  const messageRef = doc(collection(db, ticketPath('agent-message'), 'messages'));
  await assertSucceeds(setDoc(messageRef, {
    body: 'Complemento da solicitação de informação.',
    visibility: 'public',
    authorUid: agentUid,
    authorName: 'Agente Teste',
    authorEmail: 'agent@example.test',
    authorRole: 'agente',
    createdAt: serverTimestamp()
  }));

  await env.withSecurityRulesDisabled(async (context) => {
    const snap = await getDoc(doc(context.firestore(), ticketPath('agent-message')));
    assert.equal(snap.data().status, 'waiting_requester');
  });
});
