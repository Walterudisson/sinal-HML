// Sprint 1.7.1-C: decisões operacionais puras para a fila e a triagem.
import { hasTriage } from './opening-domain.mjs';

const supportRoles = new Set(['admin', 'supervisor', 'agente']);
const priorityRank = Object.freeze({ urgente: 5, alta: 4, normal: 2, baixa: 1 });

export function pendingTriage(ticket) {
  return !hasTriage(ticket?.category, ticket?.priority);
}

export function canTriageTicket(context, ticket) {
  if (!context || !ticket || !supportRoles.has(context.membership?.role)
    || !context.firebaseUser?.uid || ticket.status === 'resolved') return false;
  const assigneeUid = ticket.assigneeUid;
  return !assigneeUid || assigneeUid === context.firebaseUser.uid
    || ['admin','supervisor'].includes(context.membership.role);
}

export function needsQueueAttention(ticket) {
  return ticket?.status === 'open'
    && (pendingTriage(ticket) || ['urgente','alta'].includes(ticket.priority));
}

export function queuePriorityScore(ticket) {
  if (pendingTriage(ticket)) return 3;
  return priorityRank[ticket?.priority] ?? 0;
}

export function matchesQueueFilter(ticket, filter, uid) {
  if (filter === 'new') return ticket.status === 'open';
  if (filter === 'attention') return needsQueueAttention(ticket);
  if (filter === 'triage') return ticket.status !== 'resolved' && pendingTriage(ticket);
  if (filter === 'mine') return ticket.assigneeUid === uid && ticket.status === 'in_progress';
  if (filter === 'unassigned') return !ticket.assigneeUid;
  return true;
}

export function matchesQueueProperty(value, filter) {
  if (filter === 'all') return true;
  if (filter === 'pending') return value == null;
  return value === filter;
}

export function describeTriageEvent(event, categoryLabels, priorityLabels) {
  const fromCategory = categoryLabels[event.fromCategory] || (event.fromCategory ?? 'Não definida');
  const toCategory = categoryLabels[event.toCategory] || (event.toCategory ?? 'Não definida');
  const fromPriority = priorityLabels[event.fromPriority] || (event.fromPriority ?? 'Não definida');
  const toPriority = priorityLabels[event.toPriority] || (event.toPriority ?? 'Não definida');
  const lines = [];
  if (event.fromTitle !== event.toTitle) lines.push('Título: ' + event.fromTitle + ' → ' + event.toTitle);
  if (event.fromCategory !== event.toCategory) lines.push('Categoria: ' + fromCategory + ' → ' + toCategory);
  if (event.fromPriority !== event.toPriority) lines.push('Prioridade: ' + fromPriority + ' → ' + toPriority);
  return lines.join(' · ');
}
