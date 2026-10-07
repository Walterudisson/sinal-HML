const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

const html = read('index.html');
const detail = read('js/ui/ticket-detail.js');
const main = read('js/main.js');
const central = read('js/ui/central.js');
const messages = read('js/services/messages.service.js');
const rules = read('firestore.rules');
const statusFn = read('functions/status-notifications.js');
const functionsIndex = read('functions/index.js');
const sw = read('service-worker.js');

test('detalhe expõe Aguardar solicitante apenas como ação própria da Fase B', () => {
  assert.match(html, /id="wait-requester-button"/);
  assert.match(html, />\s*Aguardar solicitante\s*</);
  assert.match(detail, /onWaitForRequester/);
  assert.match(detail, /canWaitForRequester = isAssignedAgent && ticket\.status === 'in_progress'/);
});

test('fluxo principal conecta waitForRequester e apresenta feedback ao atendente', () => {
  assert.match(main, /waitForRequester/);
  assert.match(main, /onWaitForRequester:/);
  assert.match(main, /agora está aguardando o solicitante/);
});

test('status waiting_requester usa linguagem contextual para solicitante e equipe', () => {
  assert.match(detail, /isRequester \? 'Aguardando você' : 'Aguardando solicitante'/);
  assert.match(central, /'Aguardando solicitante'/);
  assert.match(detail, /A equipe está aguardando sua resposta/);
  assert.match(detail, /Aguardando resposta do solicitante/);
});

test('sinais aguardando solicitante permanecem em Meus atendimentos da Central', () => {
  const matches = central.match(/\['in_progress', 'waiting_requester'\]/g) || [];
  assert.ok(matches.length >= 2, 'contagem e filtro mine devem incluir waiting_requester');
});

test('histórico reconhece espera e retomada sem expor conteúdo de mensagem', () => {
  assert.match(detail, /event\.type === 'waiting_requester' \? 'Aguardando solicitante'/);
  assert.match(detail, /event\.type === 'requester_replied' \? 'Solicitante respondeu · atendimento retomado'/);
});

test('resposta do solicitante continua ligada à retomada atômica preparada na Fase A', () => {
  assert.match(messages, /TICKET_EVENT\.REQUESTER_REPLIED/);
  assert.match(messages, /messageId:\s*messageRef\.id/);
  assert.match(rules, /linkedStatusEvent\('requester_replied', 'waiting_requester', 'in_progress'\)/);
  assert.match(rules, /(?:data|event)\.messageId == messageId/);
});

test('notificação waiting_requester avisa somente o solicitante e não duplica com requester_replied', () => {
  assert.match(statusFn, /type:\s*'ticket_waiting_requester'/);
  assert.match(statusFn, /title:\s*'A equipe está aguardando você'/);
  assert.match(statusFn, /responda ao sinal para o atendimento continuar/);
  assert.match(functionsIndex, /\['claimed', 'waiting_requester', 'resolved'\]/);
  assert.doesNotMatch(functionsIndex, /\['claimed', 'waiting_requester', 'requester_replied', 'resolved'\]/);
});

test('PWA usa cache próprio do checkpoint B', () => {
  assert.match(sw, /sinal-shell-hml-1\.5-b1/);
});
