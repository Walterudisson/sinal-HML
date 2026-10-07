const test = require('node:test');
const assert = require('node:assert/strict');
const {
  assertTransitionAllowed,
  assertCanMessage,
  resolutionInput
} = require('./ticket-commands');

const agent = Object.freeze({ uid: 'agent-1', role: 'agente' });
const otherAgent = Object.freeze({ uid: 'agent-2', role: 'agente' });
const requester = Object.freeze({ uid: 'requester-1', role: 'solicitante' });

function ticket(overrides = {}) {
  return {
    status: 'in_progress',
    requesterUid: 'requester-1',
    assigneeUid: 'agent-1',
    ...overrides
  };
}

test('somente suporte pode assumir sinal aberto e sem responsável', () => {
  assert.doesNotThrow(() => assertTransitionAllowed('claim', agent, ticket({status:'open', assigneeUid:null})));
  assert.throws(() => assertTransitionAllowed('claim', requester, ticket({status:'open', assigneeUid:null})), /não pode ser assumido/i);
});

test('somente o responsável pode colocar em Aguardando solicitante', () => {
  assert.doesNotThrow(() => assertTransitionAllowed('wait_requester', agent, ticket()));
  assert.throws(() => assertTransitionAllowed('wait_requester', otherAgent, ticket()), /responsável/i);
  assert.throws(() => assertTransitionAllowed('wait_requester', requester, ticket()), /responsável/i);
});

test('resolução exige suporte responsável em atendimento', () => {
  assert.doesNotThrow(() => assertTransitionAllowed('resolve', agent, ticket()));
  assert.throws(() => assertTransitionAllowed('resolve', otherAgent, ticket()), /responsável/i);
  assert.throws(() => assertTransitionAllowed('resolve', agent, ticket({status:'waiting_requester'})), /responsável/i);
});

test('reabertura aceita solicitante ou suporte responsável e nunca sinal fechado', () => {
  const resolved = ticket({status:'resolved'});
  assert.doesNotThrow(() => assertTransitionAllowed('reopen', requester, resolved));
  assert.doesNotThrow(() => assertTransitionAllowed('reopen', agent, resolved));
  assert.throws(() => assertTransitionAllowed('reopen', otherAgent, resolved), /não pode ser reaberto/i);
  assert.throws(() => assertTransitionAllowed('reopen', requester, ticket({status:'closed'})), /não pode ser reaberto/i);
});

test('fechamento pertence somente ao solicitante de sinal resolvido', () => {
  const resolved = ticket({status:'resolved'});
  assert.doesNotThrow(() => assertTransitionAllowed('close', requester, resolved));
  assert.throws(() => assertTransitionAllowed('close', agent, resolved), /Somente o solicitante/i);
});

test('mensagem aceita solicitante ou suporte responsável e bloqueia resolvido/fechado', () => {
  assert.doesNotThrow(() => assertCanMessage(requester, ticket()));
  assert.doesNotThrow(() => assertCanMessage(agent, ticket({status:'waiting_requester'})));
  assert.throws(() => assertCanMessage(otherAgent, ticket()), /não pode enviar mensagens/i);
  assert.throws(() => assertCanMessage(requester, ticket({status:'resolved'})), /não aceita novas mensagens/i);
  assert.throws(() => assertCanMessage(requester, ticket({status:'closed'})), /não aceita novas mensagens/i);
});

test('validação de resolução preserva limites e conteúdo público opcional', () => {
  assert.deepEqual(
    resolutionInput({internalText:'Ajuste técnico', share:false, publicText:'ignorar', knowledgeCandidate:true}),
    {internalText:'Ajuste técnico', share:false, publicText:'', knowledgeCandidate:true}
  );
  assert.throws(() => resolutionInput({internalText:'x'}), /3 e 4\.000/);
  assert.throws(() => resolutionInput({internalText:'Ajuste', share:true, publicText:'x'}), /3 e 2\.000/);
});
