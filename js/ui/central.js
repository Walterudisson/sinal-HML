import {
  categoryLabels, priorityLabels, priorityClasses, statusLabels, formatDate, formatRelativeAge, escapeHtml
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
    mine: tickets.filter((t) => t.assigneeUid === uid && t.status === 'in_progress').length,
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

  list.querySelectorAll('[data-open-ticket]').forEach((card) => {
    const open = () => {
      const ticket = tickets.find((item) => item.id === card.dataset.openTicket);
      if (ticket) onOpenTicket?.(ticket);
    };
    card.addEventListener('click', open);
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open();
      }
    });
  });
}

function filterTickets(items, filter, uid) {
  if (filter === 'new') return items.filter((t) => t.status === 'open');
  if (filter === 'mine') return items.filter((t) => t.assigneeUid === uid && t.status === 'in_progress');
  if (filter === 'unassigned') return items.filter((t) => !t.assigneeUid);
  return items;
}

function centralContext(ticket) {
  if (ticket.status === 'open') return ticket.assigneeName ? `Com ${ticket.assigneeName}` : 'Aguardando responsável';
  if (ticket.status === 'in_progress') return ticket.assigneeName ? `Com ${ticket.assigneeName}` : 'Em atendimento';
  if (ticket.status === 'resolved') return 'Atendimento concluído';
  return 'Atendimento atualizado';
}

function markup(ticket) {
  const status = statusLabels[ticket.status] ?? ticket.status ?? 'Sinal recebido';
  const priority = priorityLabels[ticket.priority] ?? ticket.priority ?? 'Normal';
  const category = categoryLabels[ticket.category] ?? ticket.category ?? 'Sem categoria';
  const priorityClass = priorityClasses[ticket.priority] ?? priorityClasses.normal;
  const priorityKey = ['baixa', 'normal', 'alta', 'urgente'].includes(ticket.priority) ? ticket.priority : 'normal';
  const contextLabel = centralContext(ticket);

  return `
    <article data-open-ticket="${escapeHtml(ticket.id)}" tabindex="0" role="button"
      aria-label="Abrir ${escapeHtml(ticket.code || 'sinal')}"
      class="central-ticket ticket-smart priority-${priorityKey}">
      <div class="min-w-0">
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-xs font-extrabold uppercase tracking-[0.12em] text-slate-400">${escapeHtml(ticket.code)}</span>
          <span class="ticket-badge ${ticket.status === 'in_progress' ? 'bg-indigo-50 text-indigo-700' : ticket.status === 'resolved' ? 'bg-emerald-50 text-emerald-700' : 'bg-sky-50 text-sky-700'}">${escapeHtml(status)}</span>
          <span class="ticket-badge ${priorityClass}">${escapeHtml(priority)}</span>
        </div>
        <h3 class="mt-2 truncate text-sm font-extrabold text-slate-950 sm:text-base">${escapeHtml(ticket.title)}</h3>
        <p class="ticket-smart-context">${escapeHtml(contextLabel)}</p>
        <div class="ticket-smart-meta">
          <span>${escapeHtml(ticket.requesterName)}</span>
          <span>${escapeHtml(category)}</span>
          <span title="${escapeHtml(formatDate(ticket.createdAt))}">${escapeHtml(formatRelativeAge(ticket.createdAt))}</span>
        </div>
      </div>
      <span class="ticket-smart-open" aria-hidden="true">→</span>
    </article>`;
}
