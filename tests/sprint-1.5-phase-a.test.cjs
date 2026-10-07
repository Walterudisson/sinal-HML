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
const commands = read('functions/ticket-commands.js');
const config = read('js/config/firebase.js');

test('domínio 1.5 possui cinco estados persistidos e reabertura apenas como evento', () => {
  for (const status of ['open', 'in_progress', 'waiting_requester', 'resolved', 'closed']) {
    assert.ok(lifecycle.includes(`'${status}'`), status);
  }
  assert.ok(lifecycle.includes("REOPENED: 'reopened'"));
  const statusBlock = lifecycle.split('export const TICKET_STATUS')[1].split('export const TICKET_EVENT')[0];
  assert.ok(!statusBlock.includes('REOPENED'));
  assert.ok(!statusBlock.includes("'reopened'"));
});

test('cliente usa callable para claim, espera, resolução, reabertura e fechamento', () => {
  assert.match(tickets, /httpsCallable/);
  assert.match(tickets, /ticketCommandCallable/);
  for (const command of ['claim', 'wait_requester', 'resolve', 'reopen', 'close']) {
    assert.ok(tickets.includes(`'${command}'`), command);
  }
  assert.doesNotMatch(tickets, /writeBatch/);
});

test('backend mantém resolução append-only e fallback legado permanece no cliente', () => {
  assert.match(commands, /collection\('privateResolutions'\)\.doc\(eventRef\.id\)/);
  assert.match(commands, /latestResolutionId:\s*eventRef\.id/);
  assert.match(commands, /resolutionId:\s*eventRef\.id/);
  assert.match(tickets, /private', 'resolution'/);
  assert.match(tickets, /Compatibilidade com sinais resolvidos na série 1\.4\.x/);
});

test('mensagens são enviadas somente pela callable do backend', () => {
  assert.match(messages, /httpsCallable/);
  assert.match(messages, /sendTicketMessageCallable/);
  assert.match(messages, /tenantId:\s*context\.tenant\.id/);
  assert.match(messages, /ticketId:\s*ticket\.id/);
  assert.doesNotMatch(messages, /writeBatch|serverTimestamp/);
});

test('Rules bloqueiam escrita direta em ticket, eventos, mensagens e resolução privada', () => {
  assert.match(rules, /allow update, delete: if false/);
  const events = rules.split('match /statusEvents/{eventId}')[1].split('match /messages/{messageId}')[0];
  assert.match(events, /allow write: if false/);
  const msgs = rules.split('match /messages/{messageId}')[1];
  assert.match(msgs, /allow write: if false/);
  const privateRes = rules.split('match /privateResolutions/{resolutionId}')[1].split('match /statusEvents')[0];
  assert.match(privateRes, /allow write: if false/);
});

test('backend contém todas as transições previstas da Sprint 1.5', () => {
  for (const event of ['claimed', 'waiting_requester', 'requester_replied', 'resolved', 'reopened', 'closed']) {
    assert.ok(commands.includes(`'${event}'`), event);
  }
  assert.match(commands, /runTransaction/);
  assert.match(commands, /lastEventId:\s*eventRef\.id/);
});

test('resolvido e fechado continuam bloqueando novas mensagens no backend e no cliente', () => {
  assert.match(commands, /ticket\.status === 'resolved' \|\| ticket\.status === 'closed'/);
  assert.match(messages, /TICKET_STATUS\.RESOLVED/);
  assert.match(messages, /TICKET_STATUS\.CLOSED/);
});

test('cliente inicializa Functions na mesma região das Functions HML', () => {
  assert.match(config, /getFunctions\(firebaseApp, 'southamerica-east1'\)/);
});
