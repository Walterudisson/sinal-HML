import {
  categoryLabels, priorityLabels, priorityClasses, statusLabels, formatDate, formatRelativeAge, escapeHtml
} from './signal-composer.js';

let currentContext = null;
let tickets = [];
let currentFilter = 'new';
let currentPriority = 'all';
let currentCategory = 'all';
let currentSort = 'priority';
let currentSearch = '';
let onOpenTicket = null;
let onClaimTicket = null;
let unreadMessageTicketIds = new Set();
let stateRestored = false;

const filterCopy = Object.freeze({
  all: ['Todos os sinais', 'Fila completa da organização.'],
  new: ['Novos sinais', 'Sinais recebidos que ainda não entraram em atendimento.'],
  attention: ['Precisa de atenção', 'Sinais novos com prioridade alta ou urgente.'],
  mine: ['Meus atendimentos', 'Sinais atualmente atribuídos a você.'],
  unassigned: ['Sem responsável', 'Sinais que ainda não possuem responsável.']
});

const priorityRank = Object.freeze({
  urgente: 4,
  alta: 3,
  normal: 2,
  baixa: 1
});

export function initCentral(options) {
  onOpenTicket = options.onOpenTicket;
  onClaimTicket = options.onClaimTicket;
  setCentralContext(options.context);

  document.querySelectorAll('[data-central-filter]').forEach((button) => {
    button.addEventListener('click', () => {
      currentFilter = button.dataset.centralFilter;
      resetAdvancedFilters();
      persistCentralState();
      renderCentral();
    });
  });

  document.querySelector('#central-search')?.addEventListener('input', (event) => {
    currentSearch = event.currentTarget.value;
    if (currentSearch.trim()) currentFilter = 'all';
    persistCentralState();
    renderCentral();
  });

  document.querySelector('#central-priority')?.addEventListener('change', (event) => {
    currentPriority = event.currentTarget.value;
    if (currentPriority !== 'all') currentFilter = 'all';
    persistCentralState();
    renderCentral();
  });

  document.querySelector('#central-category')?.addEventListener('change', (event) => {
    currentCategory = event.currentTarget.value;
    if (currentCategory !== 'all') currentFilter = 'all';
    persistCentralState();
    renderCentral();
  });

  document.querySelector('#central-sort')?.addEventListener('change', (event) => {
    currentSort = event.currentTarget.value;
    persistCentralState();
    renderCentral();
  });
}

// Reassocia o estado da Central em cada login, inclusive quando a SPA não é recarregada.
export function setCentralContext(context) {
  currentContext = context;
  tickets = [];
  unreadMessageTicketIds = new Set();
  currentFilter = 'new';
  currentPriority = 'all';
  currentCategory = 'all';
  currentSort = 'priority';
  currentSearch = '';
  stateRestored = false;
  restoreCentralState();
  renderCentral();
}

export function updateCentralTickets(nextTickets) {
  tickets = nextTickets;
  renderCentral();
}

export function updateCentralUnreadMessages(ticketIds) {
  unreadMessageTicketIds = new Set(ticketIds || []);
  renderCentral();
}

function centralStateKey() {
  const tenantId = currentContext?.tenant?.id || 'tenant';
  const uid = currentContext?.firebaseUser?.uid || 'user';
  return `sinal:central:${tenantId}:${uid}`;
}

function persistCentralState() {
  if (!currentContext) return;
  // O navegador pode bloquear sessionStorage (modo privado, políticas corporativas).
  // O filtro deve continuar funcionando mesmo sem persistência.
  try {
    sessionStorage.setItem(centralStateKey(), JSON.stringify({
      filter: currentFilter,
      priority: currentPriority,
      category: currentCategory,
      sort: currentSort,
      search: currentSearch
    }));
  } catch (_) {
    // Persistência opcional; a interação permanece funcional.
  }
}

function restoreCentralState() {
  if (!currentContext || stateRestored) return;
  stateRestored = true;
  try {
    const raw = sessionStorage.getItem(centralStateKey());
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (filterCopy[saved.filter]) currentFilter = saved.filter;
    if (['all','baixa','normal','alta','urgente'].includes(saved.priority)) currentPriority = saved.priority;
    if (['all','acesso','equipamento','rede','sistemas','outro'].includes(saved.category)) currentCategory = saved.category;
    if (['priority','activity','newest','oldest'].includes(saved.sort)) currentSort = saved.sort;
    if (typeof saved.search === 'string') currentSearch = saved.search.slice(0, 120);

    const search = document.querySelector('#central-search');
    const priority = document.querySelector('#central-priority');
    const category = document.querySelector('#central-category');
    const sort = document.querySelector('#central-sort');
    if (search) search.value = currentSearch;
    if (priority) priority.value = currentPriority;
    if (category) category.value = currentCategory;
    if (sort) sort.value = currentSort;
  } catch (_) {
    try { sessionStorage.removeItem(centralStateKey()); } catch (_) { /* Armazenamento indisponível. */ }
  }
}

function resetAdvancedFilters() {
  currentSearch = '';
  currentPriority = 'all';
  currentCategory = 'all';

  const search = document.querySelector('#central-search');
  const priority = document.querySelector('#central-priority');
  const category = document.querySelector('#central-category');

  if (search) search.value = '';
  if (priority) priority.value = 'all';
  if (category) category.value = 'all';
}

function renderCentral() {
  if (!currentContext) return;
  const uid = currentContext.firebaseUser.uid;

  const stats = {
    new: tickets.filter((t) => t.status === 'open').length,
    attention: tickets.filter(needsAttention).length,
    mine: tickets.filter((t) => t.assigneeUid === uid && t.status === 'in_progress').length,
    unassigned: tickets.filter((t) => !t.assigneeUid).length
  };

  document.querySelector('#central-new-count').textContent = String(stats.new);
  document.querySelector('#central-attention-count').textContent = String(stats.attention);
  document.querySelector('#central-mine-count').textContent = String(stats.mine);
  document.querySelector('#central-unassigned-count').textContent = String(stats.unassigned);

  document.querySelectorAll('[data-central-filter]').forEach((button) => {
    const active = button.dataset.centralFilter === currentFilter;
    button.classList.toggle('is-active', active);
    button.classList.toggle('central-stat-active', active && button.classList.contains('central-stat'));
  });

  const [title, subtitle] = filterCopy[currentFilter] ?? filterCopy.all;
  document.querySelector('#central-list-title').textContent = title;
  document.querySelector('#central-list-subtitle').textContent = subtitle;

  const filtered = applyQueue(tickets, uid);
  const list = document.querySelector('#central-ticket-list');
  const empty = document.querySelector('#central-empty-state');
  const resultCount = document.querySelector('#central-result-count');

  empty.classList.toggle('hidden', filtered.length > 0);
  resultCount.textContent = filtered.length === 1 ? '1 sinal' : `${filtered.length} sinais`;
  list.innerHTML = filtered.map(markup).join('');

  list.querySelectorAll('[data-claim-ticket]').forEach((button) => {
    button.addEventListener('click', async (event) => {
      event.stopPropagation();
      const ticket = tickets.find((item) => item.id === button.dataset.claimTicket);
      if (!ticket || !onClaimTicket) return;

      button.disabled = true;
      const originalText = button.textContent;
      button.textContent = 'Assumindo...';

      try {
        await onClaimTicket(ticket);
      } finally {
        button.disabled = false;
        button.textContent = originalText;
      }
    });
  });

  list.querySelectorAll('[data-open-conversation]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const ticket = tickets.find((item) => item.id === button.dataset.openConversation);
      if (ticket) onOpenTicket?.(ticket, { view: 'conversation' });
    });
  });

  list.querySelectorAll('[data-open-ticket]').forEach((card) => {
    const open = () => {
      const ticket = tickets.find((item) => item.id === card.dataset.openTicket);
      if (ticket) onOpenTicket?.(ticket);
    };

    card.addEventListener('click', open);
    card.addEventListener('keydown', (event) => {
      if (event.target !== card) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open();
      }
    });
  });
}

function applyQueue(items, uid) {
  const search = normalize(currentSearch.trim());

  const filtered = items.filter((ticket) => {
    if (!matchesBaseFilter(ticket, currentFilter, uid)) return false;
    if (currentPriority !== 'all' && ticket.priority !== currentPriority) return false;
    if (currentCategory !== 'all' && ticket.category !== currentCategory) return false;

    if (search) {
      const haystack = normalize([
        ticket.code,
        ticket.title,
        ticket.description,
        ticket.requesterName
      ].filter(Boolean).join(' '));
      if (!haystack.includes(search)) return false;
    }

    return true;
  });

  return [...filtered].sort(queueComparator);
}

function matchesBaseFilter(ticket, filter, uid) {
  if (filter === 'new') return ticket.status === 'open';
  if (filter === 'attention') return needsAttention(ticket);
  if (filter === 'mine') return ticket.assigneeUid === uid && ticket.status === 'in_progress';
  if (filter === 'unassigned') return !ticket.assigneeUid;
  return true;
}

function needsAttention(ticket) {
  return ticket.status === 'open' && ['urgente', 'alta'].includes(ticket.priority);
}

function queueComparator(a, b) {
  const aTime = timestampMillis(a.createdAt);
  const bTime = timestampMillis(b.createdAt);

  if (currentSort === 'activity') {
    return interactionMillis(b) - interactionMillis(a);
  }
  if (currentSort === 'newest') return bTime - aTime;
  if (currentSort === 'oldest') return aTime - bTime;

  const priorityDiff = (priorityRank[b.priority] ?? 0) - (priorityRank[a.priority] ?? 0);
  if (priorityDiff !== 0) return priorityDiff;

  return aTime - bTime;
}

function timestampMillis(timestamp) {
  return timestamp?.toMillis?.() ?? timestamp?.toDate?.().getTime?.() ?? 0;
}

function interactionTimestamp(ticket) {
  return ticket.lastInteractionAt || ticket.updatedAt || ticket.createdAt;
}

function interactionMillis(ticket) {
  return timestampMillis(interactionTimestamp(ticket));
}

function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
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
  const hasUnreadMessage = unreadMessageTicketIds.has(ticket.id);
  const interactionAt = interactionTimestamp(ticket);
  const isMine =
    ticket.status === 'in_progress' &&
    ticket.assigneeUid === currentContext?.firebaseUser?.uid;

  return `
    <article data-open-ticket="${escapeHtml(ticket.id)}" tabindex="0" role="button"
      aria-label="Abrir ${escapeHtml(ticket.code || 'sinal')}"
      class="central-ticket-card ticket-smart priority-${priorityKey}">
      <div class="central-ticket">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-xs font-extrabold uppercase tracking-[0.12em] text-slate-400">${escapeHtml(ticket.code)}</span>
            <span class="ticket-badge ${ticket.status === 'in_progress' ? 'bg-indigo-50 text-indigo-700' : ticket.status === 'resolved' ? 'bg-emerald-50 text-emerald-700' : 'bg-sky-50 text-sky-700'}">${escapeHtml(status)}</span>
            <span class="ticket-badge ${priorityClass}">${escapeHtml(priority)}</span>
            ${hasUnreadMessage ? '<span class="ticket-badge bg-rose-50 text-rose-700">Nova mensagem</span>' : ''}
          </div>
          <h3 class="ticket-title-clamp mt-2 text-sm font-extrabold text-slate-950 sm:text-base">${escapeHtml(ticket.title)}</h3>
          <p class="ticket-smart-context">${escapeHtml(contextLabel)}</p>
          <div class="ticket-smart-meta">
            <span>${escapeHtml(ticket.requesterName)}</span>
            <span>${escapeHtml(category)}</span>
            <span title="${escapeHtml(formatDate(ticket.createdAt))}">${escapeHtml(formatRelativeAge(ticket.createdAt))}</span>
            <span title="${escapeHtml(formatDate(interactionAt))}">Atividade ${escapeHtml(formatRelativeAge(interactionAt))}</span>
          </div>
        </div>

        <div class="flex items-center gap-2">
          ${ticket.status === 'open' && !ticket.assigneeUid ? `
            <button data-claim-ticket="${escapeHtml(ticket.id)}" type="button"
              class="min-h-11 rounded-xl bg-indigo-700 px-3 text-xs font-extrabold text-white transition hover:bg-indigo-600 disabled:cursor-wait disabled:opacity-60">
              Assumir
            </button>` : ''}
          ${isMine ? `
            <button data-open-conversation="${escapeHtml(ticket.id)}" type="button"
              class="min-h-11 rounded-xl border border-sky-200 bg-sky-50 px-3 text-xs font-extrabold text-sky-800 transition hover:bg-sky-100">
              Conversar
            </button>` : ''}
        </div>
      </div>
    </article>`;
}
