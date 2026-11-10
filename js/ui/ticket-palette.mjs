// Paleta semântica do Sinal: prioridade, triagem, status e alertas.
// Uma classificação incompleta não deve receber prioridade fictícia.
import { pendingTriage } from '../services/triage-domain.mjs';

export const priorityLabels = Object.freeze({
  baixa: 'Baixa',
  normal: 'Normal',
  alta: 'Alta',
  urgente: 'Urgente'
});

export const priorityClasses = Object.freeze({
  baixa: 'bg-slate-100 text-slate-700',
  normal: 'bg-cyan-50 text-cyan-800',
  alta: 'bg-orange-50 text-orange-800',
  urgente: 'bg-rose-50 text-rose-800'
});

export const triagePendingClass = 'bg-violet-50 text-violet-800';
export const newMessageBadgeClass = 'bg-teal-50 text-teal-800';

export const statusClasses = Object.freeze({
  open: 'bg-blue-50 text-blue-700',
  in_progress: 'bg-indigo-50 text-indigo-800',
  waiting_requester: 'bg-yellow-50 text-yellow-800',
  resolved: 'bg-emerald-50 text-emerald-800'
});

export function statusBadgeClass(status) {
  return statusClasses[status] ?? statusClasses.open;
}

export function getClassificationBadge(ticket) {
  const priority = ticket?.priority;
  if (pendingTriage(ticket) || !Object.hasOwn(priorityClasses, priority)) {
    return { label: 'Sem triagem', classes: triagePendingClass };
  }
  return { label: priorityLabels[priority], classes: priorityClasses[priority] };
}
