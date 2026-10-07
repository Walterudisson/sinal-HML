import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TICKET_STATUS,
  TICKET_EVENT,
  nextTicketStatus,
  isAllowedTransition,
  canActorTransition
} from '../js/domain/ticket-lifecycle.mjs';

test('máquina de estados define apenas as transições previstas da Sprint 1.5', () => {
  assert.equal(nextTicketStatus(TICKET_STATUS.OPEN, TICKET_EVENT.CLAIMED), TICKET_STATUS.IN_PROGRESS);
  assert.equal(nextTicketStatus(TICKET_STATUS.IN_PROGRESS, TICKET_EVENT.WAITING_REQUESTER), TICKET_STATUS.WAITING_REQUESTER);
  assert.equal(nextTicketStatus(TICKET_STATUS.WAITING_REQUESTER, TICKET_EVENT.REQUESTER_REPLIED), TICKET_STATUS.IN_PROGRESS);
  assert.equal(nextTicketStatus(TICKET_STATUS.IN_PROGRESS, TICKET_EVENT.RESOLVED), TICKET_STATUS.RESOLVED);
  assert.equal(nextTicketStatus(TICKET_STATUS.RESOLVED, TICKET_EVENT.REOPENED), TICKET_STATUS.IN_PROGRESS);
  assert.equal(nextTicketStatus(TICKET_STATUS.RESOLVED, TICKET_EVENT.CLOSED), TICKET_STATUS.CLOSED);
  assert.equal(nextTicketStatus(TICKET_STATUS.CLOSED, TICKET_EVENT.REOPENED), null);
  assert.equal(nextTicketStatus(TICKET_STATUS.OPEN, TICKET_EVENT.CLOSED), null);
});

test('reopened é evento e não estado persistido', () => {
  assert.ok(!Object.values(TICKET_STATUS).includes('reopened'));
  assert.equal(isAllowedTransition('resolved', 'reopened', 'in_progress'), true);
});

test('aguardar e resolver exigem suporte responsável', () => {
  for (const event of [TICKET_EVENT.WAITING_REQUESTER, TICKET_EVENT.RESOLVED]) {
    assert.equal(canActorTransition({ from: 'in_progress', event, role: 'agente', isAssignee: true }), true);
    assert.equal(canActorTransition({ from: 'in_progress', event, role: 'agente', isAssignee: false }), false);
    assert.equal(canActorTransition({ from: 'in_progress', event, role: 'solicitante', isRequester: true }), false);
  }
});

test('retomada automática e fechamento pertencem ao solicitante', () => {
  assert.equal(canActorTransition({ from: 'waiting_requester', event: 'requester_replied', role: 'solicitante', isRequester: true }), true);
  assert.equal(canActorTransition({ from: 'waiting_requester', event: 'requester_replied', role: 'agente', isAssignee: true }), false);
  assert.equal(canActorTransition({ from: 'resolved', event: 'closed', role: 'solicitante', isRequester: true }), true);
  assert.equal(canActorTransition({ from: 'resolved', event: 'closed', role: 'admin', isAssignee: true }), false);
});

test('reabertura aceita solicitante ou suporte responsável, mas nunca sinal fechado', () => {
  assert.equal(canActorTransition({ from: 'resolved', event: 'reopened', role: 'solicitante', isRequester: true }), true);
  assert.equal(canActorTransition({ from: 'resolved', event: 'reopened', role: 'supervisor', isAssignee: true }), true);
  assert.equal(canActorTransition({ from: 'resolved', event: 'reopened', role: 'supervisor', isAssignee: false }), false);
  assert.equal(canActorTransition({ from: 'closed', event: 'reopened', role: 'solicitante', isRequester: true }), false);
});
