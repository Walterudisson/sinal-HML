export const TICKET_STATUS = Object.freeze({
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  WAITING_REQUESTER: 'waiting_requester',
  RESOLVED: 'resolved',
  CLOSED: 'closed'
});

export const TICKET_EVENT = Object.freeze({
  CLAIMED: 'claimed',
  WAITING_REQUESTER: 'waiting_requester',
  REQUESTER_REPLIED: 'requester_replied',
  RESOLVED: 'resolved',
  REOPENED: 'reopened',
  CLOSED: 'closed'
});

export const SUPPORT_ROLES = Object.freeze(['admin', 'supervisor', 'agente']);

const TRANSITIONS = Object.freeze({
  [TICKET_STATUS.OPEN]: Object.freeze({
    [TICKET_EVENT.CLAIMED]: TICKET_STATUS.IN_PROGRESS
  }),
  [TICKET_STATUS.IN_PROGRESS]: Object.freeze({
    [TICKET_EVENT.WAITING_REQUESTER]: TICKET_STATUS.WAITING_REQUESTER,
    [TICKET_EVENT.RESOLVED]: TICKET_STATUS.RESOLVED
  }),
  [TICKET_STATUS.WAITING_REQUESTER]: Object.freeze({
    [TICKET_EVENT.REQUESTER_REPLIED]: TICKET_STATUS.IN_PROGRESS
  }),
  [TICKET_STATUS.RESOLVED]: Object.freeze({
    [TICKET_EVENT.REOPENED]: TICKET_STATUS.IN_PROGRESS,
    [TICKET_EVENT.CLOSED]: TICKET_STATUS.CLOSED
  }),
  [TICKET_STATUS.CLOSED]: Object.freeze({})
});

export function nextTicketStatus(from, event) {
  return TRANSITIONS[from]?.[event] ?? null;
}

export function isAllowedTransition(from, event, to) {
  return nextTicketStatus(from, event) === to;
}

export function canActorTransition({ from, event, role, isRequester = false, isAssignee = false }) {
  if (!nextTicketStatus(from, event)) return false;
  const support = SUPPORT_ROLES.includes(role);

  switch (event) {
    case TICKET_EVENT.CLAIMED:
      return support;
    case TICKET_EVENT.WAITING_REQUESTER:
    case TICKET_EVENT.RESOLVED:
      return support && isAssignee;
    case TICKET_EVENT.REQUESTER_REPLIED:
    case TICKET_EVENT.CLOSED:
      return isRequester;
    case TICKET_EVENT.REOPENED:
      return isRequester || (support && isAssignee);
    default:
      return false;
  }
}
