import {
  categoryLabels, priorityLabels, priorityClasses, statusLabels, formatDate, escapeHtml
} from './signal-composer.js';

let currentContext = null;
let tickets = [];
let currentFilter = 'new';
let onOpenTicket = null;

const filterCopy = Object.freeze({
  all: ['Todos os sinais', 'Fila completa da organização.'],
  new: ['Novos sinais', 'Sinais recebidos que ainda não entraram em atendimento.'],
  mine: ['Meus atendimentos', 'Sinais atualmente atribuídos a você.'],
  unassigned: ['Sem responsável', 'Sinais que ainda não possuem responsável.']
});

export function initCentral(options) {
  currentContext = options.context;
  onOpenTicket = options.onOpenTicket;

  document.querySelectorAll('[data-central-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      currentFilter = button.dataset.centralFilter;
      renderCentral();
    });
  });
}

export function updateCentralTickets(nextTickets) {
  tickets = nextTickets;
  renderCentral();
}

function renderCentral() {
  if (!currentContext) return;
  const uid = currentContext.firebaseUser.uid;

  const stats = {
    new: tickets.filter((t) => t.status === 'open').length,
    mine: tickets.filter((t) => t.assigneeUid === uid && ['in_progress', 'waiting_requester'].includes(t.status)).length,
    unassigned: tickets.filter((t) => !t.assigneeUid).length
  };

  document.querySelector('#central-new-count').textContent = String(stats.new);
  document.querySelector('#central-mine-count').textContent = String(stats.mine);
  document.querySelector('#central-unassigned-count').textContent = String(stats.unassigned);
  document.querySelector('#home-central-new-count').textContent = String(stats.new);

  document.querySelectorAll('[data-central-filter]').forEach((button) => {
    const active = button.dataset.centralFilter === currentFilter;
    button.classList.toggle('is-active', active);
    button.classList.toggle('central-stat-active', active && button.classList.contains('central-stat'));
  });

  const [title, subtitle] = filterCopy[currentFilter] ?? filterCopy.all;
  document.querySelector('#central-list-title').textContent = title;
  document.querySelector('#central-list-subtitle').textContent = subtitle;

  const filtered = filterTickets(tickets, currentFilter, uid);
  const list = document.querySelector('#central-ticket-list');
  document.querySelector('#central-empty-state').classList.toggle('hidden', filtered.length > 0);
  list.innerHTML = filtered.map(markup).join('');

  list.querySelectorAll('[data-open-ticket]').forEach((button) => {
    button.addEventListener('click', () => {
      const ticket = tickets.find((item) => item.id === button.dataset.openTicket);
      if (ticket) onOpenTicket?.(ticket);
    });
  });
}

function filterTickets(items, filter, uid) {
  if (filter === 'new') return items.filter((t) => t.status === 'open');
  if (filter === 'mine') return items.filter((t) => t.assigneeUid === uid && ['in_progress', 'waiting_requester'].includes(t.status));
  if (filter === 'unassigned') return items.filter((t) => !t.assigneeUid);
  return items;
}

function markup(ticket) {
  const status = ticket.status === 'waiting_requester'
    ? 'Aguardando solicitante'
    : (statusLabels[ticket.status] ?? ticket.status ?? 'Sinal recebido');
  const priority = priorityLabels[ticket.priority] ?? ticket.priority ?? 'Normal';
  const category = categoryLabels[ticket.category] ?? ticket.category ?? 'Sem categoria';
  const priorityClass = priorityClasses[ticket.priority] ?? priorityClasses.normal;

  return `
    <article class="central-ticket">
      <div class="min-w-0">
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-xs font-extrabold uppercase tracking-[0.12em] text-slate-400">${escapeHtml(ticket.code)}</span>
          <span class="ticket-badge ${ticket.status === 'in_progress'
            ? 'bg-indigo-50 text-indigo-700'
            : ticket.status === 'waiting_requester'
              ? 'bg-amber-50 text-amber-800'
              : 'bg-emerald-50 text-emerald-700'}">${escapeHtml(status)}</span>
          <span class="ticket-badge ${priorityClass}">${escapeHtml(priority)}</span>
        </div>
        <h3 class="mt-2 truncate text-sm font-extrabold text-slate-950 sm:text-base">${escapeHtml(ticket.title)}</h3>
        <div class="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
          <span>${escapeHtml(ticket.requesterName)}</span>
          <span>${escapeHtml(category)}</span>
          <span>${escapeHtml(formatDate(ticket.createdAt))}</span>
          <span>${escapeHtml(ticket.assigneeName || 'Sem responsável')}</span>
        </div>
      </div>
      <button data-open-ticket="${escapeHtml(ticket.id)}" class="min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-extrabold text-slate-700 hover:bg-slate-50">Abrir</button>
    </article>`;
}
