const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

const tickets = read('js/services/tickets.service.js');
const messages = read('js/services/messages.service.js');
const rules = read('firestore.rules');
const lifecycle = read('js/domain/ticket-lifecycle.mjs');

test('domínio 1.5 possui cinco estados persistidos e reabertura apenas como evento', () => {
  for (const status of ['open', 'in_progress', 'waiting_requester', 'resolved', 'closed']) {
    assert.ok(lifecycle.includes(`'${status}'`), status);
  }
  assert.ok(lifecycle.includes("REOPENED: 'reopened'"));
  const statusBlock = lifecycle.split('export const TICKET_STATUS')[1].split('export const TICKET_EVENT')[0];
  assert.ok(!statusBlock.includes('REOPENED'));
  assert.ok(!statusBlock.includes("'reopened'"));
});

test('serviço possui espera, reabertura e fechamento sem reatribuir assignee', () => {
  assert.match(tickets, /export async function waitForRequester/);
  assert.match(tickets, /export async function reopenTicket/);
  assert.match(tickets, /export async function closeTicket/);

  const reopen = tickets.split('export async function reopenTicket')[1].split('export async function closeTicket')[0];
  assert.match(reopen, /status:\s*TICKET_STATUS\.IN_PROGRESS/);
  assert.doesNotMatch(reopen, /assigneeUid\s*:/);

  const close = tickets.split('export async function closeTicket')[1].split('export async function getPrivateResolution')[0];
  assert.match(close, /closedAt:\s*serverTimestamp\(\)/);
  assert.match(close, /closedByUid:\s*context\.firebaseUser\.uid/);
});

test('resoluções 1.5 são append-only e mantêm fallback legado 1.4.x', () => {
  assert.match(tickets, /privateResolutions', eventRef\.id/);
  assert.match(tickets, /latestResolutionId:\s*eventRef\.id/);
  assert.match(tickets, /resolutionId:\s*eventRef\.id/);
  assert.match(tickets, /private', 'resolution'/);
  assert.match(tickets, /Compatibilidade com sinais resolvidos na série 1\.4\.x/);
});

test('resposta do solicitante em espera grava mensagem, status e evento no mesmo batch', () => {
  assert.match(messages, /TICKET_STATUS\.WAITING_REQUESTER/);
  assert.match(messages, /TICKET_EVENT\.REQUESTER_REPLIED/);
  assert.match(messages, /batch\.set\(messageRef, payload\)/);
  assert.match(messages, /batch\.update\(ticketRef/);
  assert.match(messages, /messageId:\s*messageRef\.id/);
  assert.match(messages, /await batch\.commit\(\)/);
});

test('regras bloqueiam escrita no documento legado e criam resolução imutável por ID', () => {
  const legacy = rules.split('match /private/{privateId}')[1].split('match /privateResolutions')[0];
  assert.match(legacy, /allow create, update, delete: if false/);

  const current = rules.split('match /privateResolutions/{resolutionId}')[1].split('match /statusEvents')[0];
  assert.match(current, /latestResolutionId == resolutionId/);
  assert.match(current, /statusEventPath\(tenantId, ticketId, resolutionId\)/);
  assert.match(current, /allow update, delete: if false/);
});

test('regras ligam cada transição ao statusEvent correspondente', () => {
  for (const event of ['claimed', 'waiting_requester', 'requester_replied', 'resolved', 'reopened', 'closed']) {
    assert.ok(rules.includes(`'${event}'`), event);
  }
  assert.match(rules, /linkedStatusEvent\('reopened', 'resolved', 'in_progress'\)/);
  assert.match(rules, /linkedStatusEvent\('closed', 'resolved', 'closed'\)/);
  assert.match(rules, /linkedStatusEvent\('requester_replied', 'waiting_requester', 'in_progress'\)/);
});

test('sinal fechado não pertence aos estados que aceitam mensagens', () => {
  const reply = rules.split('function canReplyToTicket')[1].split('match /users')[0];
  assert.match(reply, /\['open', 'in_progress', 'waiting_requester'\]/);
  assert.doesNotMatch(reply, /'closed'/);
  assert.doesNotMatch(reply, /'resolved'/);
});

test('retomada por mensagem exige vínculo atômico entre ticket, evento e messageId', () => {
  const messagesRules = rules.split('match /messages/{messageId}')[1];
  assert.match(messagesRules, /waitingRequesterReplyIsAtomic/);
  assert.match(messagesRules, /data\.type == 'requester_replied'/);
  assert.match(messagesRules, /data\.messageId == messageId/);
});
