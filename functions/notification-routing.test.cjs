'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { newTicketNoticeId, buildMessageNotice } = require('./notification-routing');
const { createNotificationOnce } = require('./status-notifications');

const ticket = Object.freeze({
  requesterUid: 'solicitante-1',
  assigneeUid: 'atendente-1',
  firstMessageId: 'mensagem-inicial-123'
});
const original = Object.freeze({ authorUid: 'solicitante-1', body: 'Preciso de suporte' });
const ids = { ticketId: 'ticket-123', messageId: ticket.firstMessageId };

test('a primeira mensagem não cria aviso de resposta mesmo se o ticket já foi assumido', () => {
  assert.equal(buildMessageNotice(ticket, original, ids), null);
});

test('a primeira mensagem também é ignorada antes da atribuição', () => {
  assert.equal(buildMessageNotice({ ...ticket, assigneeUid: null }, original, ids), null);
});

test('resposta do solicitante notifica somente o atendente atribuído', () => {
  assert.deepEqual(buildMessageNotice(ticket, original, {
    ticketId: 'ticket-123', messageId: 'resposta-456'
  }), {
    uid: 'atendente-1', notificationId: 'new-message-ticket-123-resposta-456'
  });
  assert.equal(buildMessageNotice({ ...ticket, assigneeUid: null }, original, {
    ticketId: 'ticket-123', messageId: 'resposta-456'
  }), null);
});

test('resposta do atendente notifica solicitante; terceiros e autor não recebem', () => {
  assert.deepEqual(buildMessageNotice(ticket, { authorUid: 'atendente-1' }, {
    ticketId: 'ticket-123', messageId: 'resposta-789'
  }), {
    uid: 'solicitante-1', notificationId: 'new-message-ticket-123-resposta-789'
  });
  assert.equal(buildMessageNotice(ticket, { authorUid: 'terceiro' }, {
    ticketId: 'ticket-123', messageId: 'resposta-789'
  }), null);
  assert.equal(buildMessageNotice({ ...ticket, assigneeUid: 'solicitante-1' }, original, {
    ticketId: 'ticket-123', messageId: 'resposta-789'
  }), null);
});

test('IDs estáveis não duplicam avisos em reexecuções do mesmo evento', async () => {
  assert.equal(newTicketNoticeId('ticket-123'), 'new-ticket-ticket-123');
  assert.equal(newTicketNoticeId('ticket-123'), newTicketNoticeId('ticket-123'));
  assert.notEqual(newTicketNoticeId('ticket-123'), newTicketNoticeId('ticket-456'));
  const a = buildMessageNotice(ticket, original, {ticketId:'ticket-123',messageId:'resposta-001'});
  const b = buildMessageNotice(ticket, original, {ticketId:'ticket-123',messageId:'resposta-001'});
  const c = buildMessageNotice(ticket, original, {ticketId:'ticket-123',messageId:'resposta-002'});
  assert.equal(a.notificationId,b.notificationId);
  assert.notEqual(a.notificationId,c.notificationId);
  assert.notEqual(a.notificationId,newTicketNoticeId('ticket-123'));

  const saved = new Set();
  const ref = key => ({ async create() {
    if (saved.has(key)) {
      const e = new Error('ALREADY_EXISTS');
      e.code = 6;
      throw e;
    }
    saved.add(key);
  }});
  assert.equal(await createNotificationOnce(ref(a.notificationId), {type:'new_message'}),true);
  assert.equal(await createNotificationOnce(ref(b.notificationId), {type:'new_message'}),false);
  assert.equal(saved.size,1);
});

test('IDs inválidos não originam notificações', () => {
  assert.equal(newTicketNoticeId('../segredo'), null);
  assert.equal(buildMessageNotice(ticket, original, {ticketId:'ticket-123',messageId:'..'}),null);
  assert.equal(buildMessageNotice(null, original, {ticketId:'ticket-123',messageId:'resposta'}),null);
});

test('gatilhos Cloud Functions usam o roteador e o ID estável no createAndPush', () => {
  const source = readFileSync(join(__dirname,'index.js'),'utf8');
  assert.match(source,/const notificationId = newTicketNoticeId\(ticketId\)/);
  assert.match(source,/buildMessageNotice\(ticket, message, \{ ticketId, messageId \}\)/);
  assert.match(source,/ticketId, ticketCode: ticket\.code, notificationId/);
  assert.match(source,/ticketId, ticketCode: ticket\.code, notificationId: notice\.notificationId/);
  assert.match(source,/const created = await createNotificationOnce\(notificationRef, payload\)/);
});
