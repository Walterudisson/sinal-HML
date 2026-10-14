import { openOverlayHistory, requestOverlayClose } from './overlay-history.js';

const MIN_SIGNAL_TEXT_LENGTH = 3;

const categoryLabels = Object.freeze({
  acesso: 'Acesso',
  equipamento: 'Equipamento',
  rede: 'Rede',
  sistemas: 'Sistemas',
  outro: 'Outro'
});

const priorityLabels = Object.freeze({
  baixa: 'Baixa',
  normal: 'Normal',
  alta: 'Alta',
  urgente: 'Urgente'
});

const priorityClasses = Object.freeze({
  baixa: 'bg-slate-100 text-slate-700',
  normal: 'bg-sky-50 text-sky-700',
  alta: 'bg-amber-50 text-amber-800',
  urgente: 'bg-rose-50 text-rose-700'
});

const statusLabels = Object.freeze({
  open: 'Sinal recebido',
  in_progress: 'Em atendimento',
  waiting_requester: 'Aguardando você',
  resolved: 'Resolvido'
});

let lastFocusedElement = null;
let mySignalsItems = [];
let mySignalsOpenHandler = null;
let mySignalsStatus = 'all';
let mySignalsCategory = 'all';
let mySignalsSort = 'activity';
let mySignalsSearch = '';

export function initMySignalsFilters() {
  document.querySelectorAll('[data-my-signals-status]').forEach((button) => {
    button.addEventListener('click', () => {
      mySignalsStatus = button.dataset.mySignalsStatus;
      renderMySignals();
    });
  });

  document.querySelector('#my-signals-search')?.addEventListener('input', (event) => {
    mySignalsSearch = event.currentTarget.value;
    renderMySignals();
  });

  document.querySelector('#my-signals-category')?.addEventListener('change', (event) => {
    mySignalsCategory = event.currentTarget.value;
    renderMySignals();
  });

  document.querySelector('#my-signals-sort')?.addEventListener('change', (event) => {
    mySignalsSort = event.currentTarget.value;
    renderMySignals();
  });
}

function mySignalsTimestamp(ticket) {
  return ticket.lastInteractionAt || ticket.updatedAt || ticket.createdAt;
}

function mySignalsMillis(timestamp) {
  return timestamp?.toMillis?.() ?? timestamp?.toDate?.().getTime?.() ?? 0;
}

function normalizeSearch(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function applyMySignalsFilters(items) {
  const search = normalizeSearch(mySignalsSearch.trim());
  const filtered = items.filter((ticket) => {
    if (mySignalsStatus !== 'all' && ticket.status !== mySignalsStatus) return false;
    if (mySignalsCategory !== 'all' && ticket.category !== mySignalsCategory) return false;

    if (search) {
      const haystack = normalizeSearch([
        ticket.code,
        ticket.title,
        ticket.description
      ].filter(Boolean).join(' '));
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

  return [...filtered].sort((a, b) => {
    if (mySignalsSort === 'newest') return mySignalsMillis(b.createdAt) - mySignalsMillis(a.createdAt);
    if (mySignalsSort === 'oldest') return mySignalsMillis(a.createdAt) - mySignalsMillis(b.createdAt);
    return mySignalsMillis(mySignalsTimestamp(b)) - mySignalsMillis(mySignalsTimestamp(a));
  });
}

function bindMySignalCards(container, items) {
  if (typeof mySignalsOpenHandler !== 'function') return;
  container.querySelectorAll('[data-my-ticket]').forEach((element) => {
    element.classList.add('is-clickable');
    element.setAttribute('tabindex', '0');
    element.setAttribute('role', 'button');

    const open = () => {
      const ticket = items.find((item) => item.id === element.dataset.myTicket);
      if (ticket) mySignalsOpenHandler(ticket);
    };

    element.addEventListener('click', open);
    element.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open();
      }
    });
  });
}

function renderMySignals() {
  const list = document.querySelector('#ticket-list-secondary');
  const empty = document.querySelector('#ticket-empty-state-secondary');
  if (!list || !empty) return;

  const filtered = applyMySignalsFilters(mySignalsItems);
  const count = document.querySelector('#my-signals-result-count');
  if (count) count.textContent = filtered.length === 1 ? '1 sinal' : `${filtered.length} sinais`;

  document.querySelectorAll('[data-my-signals-status]').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.mySignalsStatus === mySignalsStatus);
  });

  empty.classList.toggle('hidden', filtered.length > 0);
  empty.textContent = mySignalsItems.length === 0
    ? 'Nenhum sinal enviado.'
    : 'Nenhum sinal corresponde aos filtros selecionados.';

  list.innerHTML = filtered.map((ticket) => ticketMarkup(ticket, true)).join('');
  bindMySignalCards(list, filtered);
}

export function initSignalComposer({ onSubmit }) {
  const composer = document.querySelector('#signal-composer');
  const form = document.querySelector('#signal-form');
  const titleInput = document.querySelector('#signal-title');
  const descriptionInput = document.querySelector('#signal-description');
  const titleCount = document.querySelector('#signal-title-count');
  const descriptionCount = document.querySelector('#signal-description-count');
  const submitButton = document.querySelector('#signal-submit-button');
  const submitLabel = document.querySelector('#signal-submit-label');
  const submitSpinner = document.querySelector('#signal-submit-spinner');
  const errorBox = document.querySelector('#signal-form-error');
  const openButtons = [...document.querySelectorAll('[data-open-signal-composer]')];
  const closeButtons = [...document.querySelectorAll('[data-close-signal-composer]')];
  let submitting = false;
  let slowTimer = null;
  let networkMessage = false;

  function clearError() {
    errorBox.textContent = '';
    errorBox.classList.add('hidden');
    networkMessage = false;
  }

  function showError(message) {
    errorBox.textContent = message;
    errorBox.classList.remove('hidden');
  }

  function showConnectionMessage(message) {
    showError(message);
    networkMessage = true;
  }

  function setSubmitting(isSubmitting) {
    submitting = isSubmitting;
    submitButton.disabled = isSubmitting || !navigator.onLine;
    submitSpinner.classList.toggle('hidden', !isSubmitting);
    submitLabel.textContent = isSubmitting
      ? (navigator.onLine ? 'Enviando...' : 'Aguardando conexão...')
      : (navigator.onLine ? 'Enviar sinal' : 'Sem conexão');
  }

  function syncNetworkStatus() {
    setSubmitting(submitting);

    if (!navigator.onLine) {
      showConnectionMessage(submitting
        ? 'Sua conexão caiu durante o envio. Mantenha o Sinal aberto e aguarde a confirmação quando a internet voltar. Não envie novamente.'
        : 'Você está sem conexão. Seu texto foi mantido. Reconecte-se para enviar o sinal.');
    } else if (submitting && networkMessage) {
      showConnectionMessage('Conexão restabelecida. Aguardando a confirmação do envio. Não envie novamente.');
    } else if (networkMessage && !submitting) {
      clearError();
    }
  }

  window.addEventListener('offline', syncNetworkStatus);
  window.addEventListener('online', syncNetworkStatus);

  function finalizeClose() {
    composer.classList.add('hidden');
    composer.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('overlay-open');
    lastFocusedElement?.focus?.();
  }

  function openComposer() {
    if (!composer.classList.contains('hidden')) return;

    lastFocusedElement = document.activeElement;
    clearError();
    syncNetworkStatus();
    composer.classList.remove('hidden');
    composer.setAttribute('aria-hidden', 'false');
    document.body.classList.add('overlay-open');

    openOverlayHistory('composer', finalizeClose);
    window.setTimeout(() => titleInput.focus(), 40);
  }

  function closeComposer() {
    requestOverlayClose('composer', finalizeClose);
  }

  function resetComposer() {
    form.reset();
    document.querySelector('#signal-priority').value = 'normal';
    titleCount.textContent = '0';
    descriptionCount.textContent = '0';
    clearError();
  }

  function validateSignalText() {
    const title = titleInput.value.trim();
    const description = descriptionInput.value.trim();

    if (title.length < MIN_SIGNAL_TEXT_LENGTH) {
      showError('O título precisa ter pelo menos 3 caracteres.');
      titleInput.focus();
      return null;
    }

    if (description.length < MIN_SIGNAL_TEXT_LENGTH) {
      showError('A descrição precisa ter pelo menos 3 caracteres.');
      descriptionInput.focus();
      return null;
    }

    return { title, description };
  }

  openButtons.forEach((button) => button.addEventListener('click', openComposer));
  closeButtons.forEach((button) => button.addEventListener('click', closeComposer));

  composer.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeComposer();
  });

  titleInput.addEventListener('input', () => {
    titleCount.textContent = String(titleInput.value.length);
    if (!errorBox.classList.contains('hidden')) {
      if (navigator.onLine && !submitting) clearError();
      else syncNetworkStatus();
    }
  });

  descriptionInput.addEventListener('input', () => {
    descriptionCount.textContent = String(descriptionInput.value.length);
    if (!errorBox.classList.contains('hidden')) {
      if (navigator.onLine && !submitting) clearError();
      else syncNetworkStatus();
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitting) return;
    clearError();

    if (!navigator.onLine) {
      syncNetworkStatus();
      return;
    }

    if (!form.reportValidity()) return;

    const text = validateSignalText();
    if (!text) return;

    const payload = {
      title: text.title,
      category: document.querySelector('#signal-category').value,
      priority: document.querySelector('#signal-priority').value,
      description: text.description
    };

    try {
      setSubmitting(true);
      slowTimer = window.setTimeout(() => {
        if (submitting && navigator.onLine) {
          showConnectionMessage('O envio está demorando. Verifique a conexão e mantenha o Sinal aberto até a confirmação. Não envie novamente.');
        }
      }, 8000);
      await onSubmit(payload);
      resetComposer();
      closeComposer();
    } catch (error) {
      console.error('[Sinal][Ticket] Falha ao criar sinal:', error);

      const isPermissionError =
        error?.code === 'permission-denied' ||
        /insufficient permissions|permission denied/i.test(error?.message || '');

      showError(
        isPermissionError
          ? 'Não foi possível enviar este sinal. Reabra o Sinal e tente novamente. Se o problema continuar, procure o suporte.'
          : 'Não foi possível enviar seu sinal agora. Tente novamente.'
      );
    } finally {
      window.clearTimeout(slowTimer);
      slowTimer = null;
      setSubmitting(false);
    }
  });

  return { open: openComposer, close: closeComposer };
}

function formatDate(timestamp) {
  if (!timestamp?.toDate) return 'Agora';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).format(timestamp.toDate());
}

function formatRelativeAge(timestamp) {
  if (!timestamp?.toDate) return 'agora';
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp.toDate().getTime()) / 60000));
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'há 1 dia' : `há ${days} dias`;
}

function requesterContext(ticket) {
  if (ticket.status === 'open') return 'Aguardando atendimento';
  if (ticket.status === 'in_progress') return ticket.assigneeName ? `Com ${ticket.assigneeName}` : 'Em atendimento';
  if (ticket.status === 'resolved') return 'Atendimento concluído';
  return 'Atendimento atualizado';
}

function ticketMarkup(ticket, compact = false) {
  const category = categoryLabels[ticket.category] ?? ticket.category ?? 'Sem categoria';
  const priority = priorityLabels[ticket.priority] ?? ticket.priority ?? 'Normal';
  const priorityClass = priorityClasses[ticket.priority] ?? priorityClasses.normal;
  const status = statusLabels[ticket.status] ?? ticket.status ?? 'Sinal recebido';
  const priorityKey = ['baixa', 'normal', 'alta', 'urgente'].includes(ticket.priority) ? ticket.priority : 'normal';
  const contextLabel = requesterContext(ticket);
  const activityAt = ticket.lastInteractionAt || ticket.updatedAt || ticket.createdAt;

  return `
    <article data-my-ticket="${escapeHtml(ticket.id)}" class="ticket-card ticket-smart priority-${priorityKey} rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div class="min-w-0">
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-xs font-extrabold uppercase tracking-[0.12em] text-slate-400">${escapeHtml(ticket.code ?? 'Sinal')}</span>
          <span class="ticket-badge ${ticket.status === 'in_progress' ? 'bg-indigo-50 text-indigo-700' : ticket.status === 'resolved' ? 'bg-emerald-50 text-emerald-700' : 'bg-sky-50 text-sky-700'}">${escapeHtml(status)}</span>
          <span class="ticket-badge ${priorityClass}">${escapeHtml(priority)}</span>
        </div>
        <h3 class="ticket-title-clamp mt-2 text-sm font-extrabold text-slate-950 sm:text-base">${escapeHtml(ticket.title ?? '')}</h3>
        <p class="ticket-smart-context">${escapeHtml(contextLabel)}</p>
        <div class="ticket-smart-meta">
          <span>${escapeHtml(category)}</span>
          <span title="${escapeHtml(formatDate(ticket.createdAt))}">Aberto ${escapeHtml(formatRelativeAge(ticket.createdAt))}</span>
          <span title="${escapeHtml(formatDate(activityAt))}">Atividade ${escapeHtml(formatRelativeAge(activityAt))}</span>
        </div>
      </div>
    </article>
  `;
}

export function renderTickets(tickets, onOpenTicket = null) {
  const primaryList = document.querySelector('#ticket-list');
  const primaryEmpty = document.querySelector('#ticket-empty-state');
  const count = document.querySelector('#ticket-count');
  const countLabel = document.querySelector('#ticket-count-label');

  mySignalsItems = tickets;
  mySignalsOpenHandler = onOpenTicket;

  count.textContent = String(tickets.length);
  countLabel.textContent = tickets.length === 0
    ? 'Nenhum sinal enviado.'
    : tickets.length === 1
      ? '1 sinal enviado.'
      : `${tickets.length} sinais enviados.`;

  primaryEmpty.classList.toggle('hidden', tickets.length > 0);
  primaryList.innerHTML = tickets.map((ticket) => ticketMarkup(ticket, false)).join('');

  if (typeof onOpenTicket === 'function') {
    bindMySignalCards(primaryList, tickets);
  }

  renderMySignals();
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export { categoryLabels, priorityLabels, priorityClasses, statusLabels, formatDate, formatRelativeAge };
