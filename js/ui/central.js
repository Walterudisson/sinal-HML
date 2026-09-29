import {
  categoryLabels,
  priorityLabels,
  priorityClasses,
  statusLabels,
  formatDate,
  escapeHtml
} from './signal-composer.js';

import { openOverlayHistory, requestOverlayClose } from './overlay-history.js';

let currentContext = null;
let tickets = [];
let currentFilter = 'new';
let selectedTicket = null;
let onClaimHandler = null;

const filterCopy = Object.freeze({
  all: ['Todos os sinais', 'Fila completa da organização.'],
  new: ['Novos sinais', 'Sinais recebidos que ainda não entraram em atendimento.'],
  mine: ['Meus atendimentos', 'Sinais atualmente atribuídos a você.'],
  unassigned: ['Sem responsável', 'Sinais que ainda não possuem responsável.']
});

export function initCentral({ context, onClaim }) {
  currentContext = context;
  onClaimHandler = onClaim;

  const filters = [...document.querySelectorAll('[data-central-filter]')];

  filters.forEach((button) => {
    button.addEventListener('click', () => {
      currentFilter = button.dataset.centralFilter;
      renderCentral();
    });
  });

  document.querySelectorAll('[data-close-ticket-detail]').forEach((button) => {
    button.addEventListener('click', closeDetail);
  });

  document.querySelector('#claim-ticket-button').addEventListener('click', async () => {
    if (!selectedTicket || !onClaimHandler) return;

    const button = document.querySelector('#claim-ticket-button');
    const spinner = document.querySelector('#claim-ticket-spinner');
    const label = document.querySelector('#claim-ticket-label');

    button.disabled = true;
    spinner.classList.remove('hidden');
    label.textContent = 'Assumindo...';

    try {
      await onClaimHandler(selectedTicket);
      closeDetail();
    } finally {
      button.disabled = false;
      spinner.classList.add('hidden');
      label.textContent = 'Assumir sinal';
    }
  });

  document.querySelector('#ticket-detail').addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeDetail();
  });
}

export function updateCentralTickets(nextTickets) {
  tickets = nextTickets;
  renderCentral();

  if (selectedTicket) {
    const refreshed = tickets.find((ticket) => ticket.id === selectedTicket.id);
    if (refreshed) {
      selectedTicket = refreshed;
      renderDetail(selectedTicket);
    }
  }
}

function renderCentral() {
  if (!currentContext) return;

  const uid = currentContext.firebaseUser.uid;

  const stats = {
    new: tickets.filter((ticket) => ticket.status === 'open').length,
    mine: tickets.filter((ticket) => ticket.assigneeUid === uid && ticket.status === 'in_progress').length,
    unassigned: tickets.filter((ticket) => !ticket.assigneeUid).length
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
  const empty = document.querySelector('#central-empty-state');

  empty.classList.toggle('hidden', filtered.length > 0);
  list.innerHTML = filtered.map(centralTicketMarkup).join('');

  list.querySelectorAll('[data-open-ticket]').forEach((button) => {
    button.addEventListener('click', () => {
      const ticket = tickets.find((item) => item.id === button.dataset.openTicket);
      if (ticket) openDetail(ticket);
    });
  });
}

function filterTickets(items, filter, uid) {
  switch (filter) {
    case 'new':
      return items.filter((ticket) => ticket.status === 'open');
    case 'mine':
      return items.filter((ticket) => ticket.assigneeUid === uid && ticket.status === 'in_progress');
    case 'unassigned':
      return items.filter((ticket) => !ticket.assigneeUid);
    default:
      return items;
  }
}

function centralTicketMarkup(ticket) {
  const status = statusLabels[ticket.status] ?? ticket.status ?? 'Sinal recebido';
  const priority = priorityLabels[ticket.priority] ?? ticket.priority ?? 'Normal';
  const priorityClass = priorityClasses[ticket.priority] ?? priorityClasses.normal;
  const category = categoryLabels[ticket.category] ?? ticket.category ?? 'Sem categoria';
  const assignee = ticket.assigneeName || 'Sem responsável';

  return `
    <article class="central-ticket">
      <div class="min-w-0">
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-xs font-extrabold uppercase tracking-[0.12em] text-slate-400">${escapeHtml(ticket.code)}</span>
          <span class="ticket-badge bg-emerald-50 text-emerald-700">${escapeHtml(status)}</span>
          <span class="ticket-badge ${priorityClass}">${escapeHtml(priority)}</span>
        </div>

        <h3 class="mt-2 truncate text-sm font-extrabold text-slate-950 sm:text-base">${escapeHtml(ticket.title)}</h3>

        <div class="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
          <span>${escapeHtml(ticket.requesterName)}</span>
          <span>${escapeHtml(category)}</span>
          <span>${escapeHtml(formatDate(ticket.createdAt))}</span>
          <span>${escapeHtml(assignee)}</span>
        </div>
      </div>

      <button data-open-ticket="${escapeHtml(ticket.id)}"
        class="min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-extrabold text-slate-700 hover:bg-slate-50">
        Abrir
      </button>
    </article>
  `;
}

function openDetail(ticket) {
  const overlay = document.querySelector('#ticket-detail');
  selectedTicket = ticket;

  renderDetail(ticket);
  overlay.classList.remove('hidden');
  overlay.setAttribute('aria-hidden', 'false');
  document.body.classList.add('overlay-open');

  openOverlayHistory('ticket-detail', finalizeCloseDetail);
  window.setTimeout(() => document.querySelector('[data-close-ticket-detail]')?.focus(), 40);
}

function closeDetail() {
  requestOverlayClose('ticket-detail', finalizeCloseDetail);
}

function finalizeCloseDetail() {
  const overlay = document.querySelector('#ticket-detail');
  overlay.classList.add('hidden');
  overlay.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('overlay-open');
  selectedTicket = null;
}

function renderDetail(ticket) {
  const uid = currentContext.firebaseUser.uid;
  const status = statusLabels[ticket.status] ?? ticket.status ?? 'Sinal recebido';
  const priority = priorityLabels[ticket.priority] ?? ticket.priority ?? 'Normal';
  const priorityClass = priorityClasses[ticket.priority] ?? priorityClasses.normal;
  const category = categoryLabels[ticket.category] ?? ticket.category ?? 'Sem categoria';

  document.querySelector('#detail-code').textContent = ticket.code ?? '';
  document.querySelector('#ticket-detail-title').textContent = ticket.title ?? 'Sinal';
  document.querySelector('#detail-description').textContent = ticket.description ?? '';
  document.querySelector('#detail-requester-name').textContent = ticket.requesterName ?? 'Solicitante';
  document.querySelector('#detail-requester-email').textContent = ticket.requesterEmail ?? '';
  document.querySelector('#detail-created-at').textContent = `Recebido em ${formatDate(ticket.createdAt)}`;
  document.querySelector('#detail-assignee').textContent = ticket.assigneeName || 'Ainda não atribuído';

  const statusEl = document.querySelector('#detail-status');
  statusEl.className = 'ticket-badge bg-emerald-50 text-emerald-700';
  statusEl.textContent = status;

  const priorityEl = document.querySelector('#detail-priority');
  priorityEl.className = `ticket-badge ${priorityClass}`;
  priorityEl.textContent = priority;

  document.querySelector('#detail-category').textContent = category;

  const claimButton = document.querySelector('#claim-ticket-button');
  const help = document.querySelector('#detail-action-help');

  const canClaim = ticket.status === 'open' && !ticket.assigneeUid;
  claimButton.classList.toggle('hidden', !canClaim);

  if (canClaim) {
    help.textContent = 'Ao assumir, o sinal entra em atendimento e fica atribuído a você.';
  } else if (ticket.assigneeUid === uid) {
    help.textContent = 'Este sinal está em atendimento por você.';
  } else if (ticket.assigneeName) {
    help.textContent = `Este sinal está atribuído a ${ticket.assigneeName}.`;
  } else {
    help.textContent = 'Nenhuma ação de atendimento está disponível neste estado.';
  }
}
