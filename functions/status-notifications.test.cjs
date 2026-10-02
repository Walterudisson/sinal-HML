const test = require('node:test');
const assert = require('node:assert/strict');
const { buildStatusNotice, createNotificationOnce } = require('./status-notifications');

const ticket = Object.freeze({
  _eventTicketId: 'ticket-exemplo', code: 'S-TESTE', requesterUid: 'solicitante-1',
  assigneeUid: 'agente-1', resolvedByUid: 'agente-1',
  internalSolution: 'NÃO PODE APARECER EM PUSH',
  publicResolution: 'Mensagem pública opcional'
});
const claimed = Object.freeze({
  type: 'claimed', from: 'open', to: 'in_progress',
  actorUid: 'agente-1', actorName: 'Atendente Teste'
});
const resolved = Object.freeze({
  type: 'resolved', from: 'in_progress', to: 'resolved',
  actorUid: 'agente-1', actorName: 'Atendente Teste'
});

test('avisa o solicitante quando alguém assume, sem avisar o ator', () => {
  const notice = buildStatusNotice(ticket, claimed, 'evt-01');
  assert.equal(notice.uid, 'solicitante-1');
  assert.equal(notice.type, 'ticket_claimed');
  assert.match(notice.body, /Atendente Teste/);
  assert.equal(buildStatusNotice({...ticket, requesterUid: 'agente-1'}, claimed, 'evt-02'), null);
});

test('notifica resolução sem expor solução interna nem resumo público', () => {
  const notice = buildStatusNotice(ticket, resolved, 'evt-03');
  assert.equal(notice.type, 'ticket_resolved');
  assert.equal(notice.uid, 'solicitante-1');
  const preview = notice.title + notice.body;
  assert.doesNotMatch(preview, /NÃO PODE APARECER|Mensagem pública opcional/);
  assert.match(preview, /Abra o sinal/);
});

test('mesmo evento gera ID estável de notificação, eventos distintos geram IDs diferentes', () => {
  const a = buildStatusNotice(ticket, claimed, 'evt-04');
  const b = buildStatusNotice(ticket, claimed, 'evt-04');
  const c = buildStatusNotice(ticket, claimed, 'evt-05');
  assert.equal(a.notificationId, b.notificationId);
  assert.notEqual(a.notificationId, c.notificationId);
});

test('ignora eventos inválidos, falsos ou não relacionados ao responsável', () => {
  assert.equal(buildStatusNotice(ticket, {...claimed, actorUid: 'outro-agente'}, 'evt-06'), null);
  assert.equal(buildStatusNotice(ticket, {...resolved, actorUid: 'outro-agente'}, 'evt-07'), null);
  assert.equal(buildStatusNotice(ticket, {...resolved, from: 'open'}, 'evt-08'), null);
  assert.equal(buildStatusNotice(ticket, {...claimed, type: 'other'}, 'evt-09'), null);
  assert.equal(buildStatusNotice(ticket, claimed, 'inválido/com/barra'), null);
});

test('grava uma só notificação por evento e não duplica no retry', async () => {
  let attempts = 0;
  const fakeRef = { async create() {
    attempts++;
    if (attempts > 1) {
      const error = new Error('ALREADY_EXISTS');
      error.code = 6;
      throw error;
    }
  }};
  const notice = buildStatusNotice(ticket, claimed, 'evt-10');
  assert.equal(await createNotificationOnce(fakeRef, notice), true);
  assert.equal(await createNotificationOnce(fakeRef, notice), false);
  assert.equal(attempts, 2);
});

test('erros de infraestrutura não são silenciados pela deduplicação', async () => {
  const fakeRef = { async create() { const error = new Error('Unavailable'); error.code = 14; throw error; }};
  await assert.rejects(createNotificationOnce(fakeRef, {type:'ticket_claimed'}), /Unavailable/);
});
