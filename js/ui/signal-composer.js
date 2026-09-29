import { openOverlayHistory, requestOverlayClose } from './overlay-history.js';

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

  function clearError() {
    errorBox.textContent = '';
    errorBox.classList.add('hidden');
  }

  function showError(message) {
    errorBox.textContent = message;
    errorBox.classList.remove('hidden');
  }

  function setSubmitting(isSubmitting) {
    submitButton.disabled = isSubmitting;
    submitSpinner.classList.toggle('hidden', !isSubmitting);
    submitLabel.textContent = isSubmitting ? 'Enviando...' : 'Enviar sinal';
  }

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

  openButtons.forEach((button) => button.addEventListener('click', openComposer));
  closeButtons.forEach((button) => button.addEventListener('click', closeComposer));

  composer.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeComposer();
  });

  titleInput.addEventListener('input', () => {
    titleCount.textContent = String(titleInput.value.length);
  });

  descriptionInput.addEventListener('input', () => {
    descriptionCount.textContent = String(descriptionInput.value.length);
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearError();

    if (!form.reportValidity()) return;

    const payload = {
      title: titleInput.value,
      category: document.querySelector('#signal-category').value,
      priority: document.querySelector('#signal-priority').value,
      description: descriptionInput.value
    };

    try {
      setSubmitting(true);
      await onSubmit(payload);
      resetComposer();
      closeComposer();
    } catch (error) {
      console.error('[Sinal][Ticket] Falha ao criar sinal:', error);
      showError(error?.message || 'Não foi possível enviar seu sinal agora. Tente novamente.');
    } finally {
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

function ticketMarkup(ticket, compact = false) {
  const category = categoryLabels[ticket.category] ?? ticket.category ?? 'Sem categoria';
  const priority = priorityLabels[ticket.priority] ?? ticket.priority ?? 'Normal';
  const priorityClass = priorityClasses[ticket.priority] ?? priorityClasses.normal;
  const status = statusLabels[ticket.status] ?? ticket.status ?? 'Sinal recebido';

  return `
    <article class="${compact ? 'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm' : 'ticket-card'}">
      <div class="flex items-start justify-between gap-4">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-xs font-extrabold uppercase tracking-[0.12em] text-slate-400">${escapeHtml(ticket.code ?? 'Sinal')}</span>
            <span class="ticket-badge bg-emerald-50 text-emerald-700">${escapeHtml(status)}</span>
            <span class="ticket-badge ${priorityClass}">${escapeHtml(priority)}</span>
          </div>
          <h3 class="mt-2 truncate text-sm font-extrabold text-slate-950 sm:text-base">${escapeHtml(ticket.title ?? '')}</h3>
          <div class="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
            <span>${escapeHtml(category)}</span>
            <span>${escapeHtml(formatDate(ticket.createdAt))}</span>
          </div>
        </div>
      </div>
    </article>
  `;
}

export function renderTickets(tickets) {
  const primaryList = document.querySelector('#ticket-list');
  const secondaryList = document.querySelector('#ticket-list-secondary');
  const primaryEmpty = document.querySelector('#ticket-empty-state');
  const secondaryEmpty = document.querySelector('#ticket-empty-state-secondary');
  const count = document.querySelector('#ticket-count');
  const countLabel = document.querySelector('#ticket-count-label');

  count.textContent = String(tickets.length);
  countLabel.textContent = tickets.length === 0
    ? 'Nenhum sinal enviado.'
    : tickets.length === 1
      ? '1 sinal enviado.'
      : `${tickets.length} sinais enviados.`;

  primaryEmpty.classList.toggle('hidden', tickets.length > 0);
  secondaryEmpty.classList.toggle('hidden', tickets.length > 0);

  primaryList.innerHTML = tickets.map((ticket) => ticketMarkup(ticket, false)).join('');
  secondaryList.innerHTML = tickets.map((ticket) => ticketMarkup(ticket, true)).join('');
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export { categoryLabels, priorityLabels, priorityClasses, statusLabels, formatDate };
