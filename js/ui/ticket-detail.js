import {
  categoryLabels, priorityLabels, priorityClasses, statusLabels, formatDate, escapeHtml
} from './signal-composer.js';
import { openOverlayHistory, requestOverlayClose } from './overlay-history.js';

let currentContext = null;
let selectedTicket = null;
let onClaim = null;
let onSendMessage = null;
let unsubscribeMessages = null;

export function initTicketDetail(options) {
  currentContext = options.context;
  onClaim = options.onClaim;
  onSendMessage = options.onSendMessage;

  document.querySelectorAll('[data-close-ticket-detail]').forEach((button) => button.addEventListener('click', closeTicketDetail));

  document.querySelector('#claim-ticket-button').addEventListener('click', async () => {
    if (!selectedTicket) return;
    const button = document.querySelector('#claim-ticket-button');
    const spinner = document.querySelector('#claim-ticket-spinner');
    const label = document.querySelector('#claim-ticket-label');

    button.disabled = true;
    spinner.classList.remove('hidden');
    label.textContent = 'Assumindo...';
    try {
      await onClaim(selectedTicket);
    } finally {
      button.disabled = false;
      spinner.classList.add('hidden');
      label.textContent = 'Assumir sinal';
    }
  });

  document.querySelector('#message-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!selectedTicket) return;

    const textarea = document.querySelector('#message-body');
    const body = textarea.value.trim();
    if (!body) return;

    const button = document.querySelector('#message-submit-button');
    const spinner = document.querySelector('#message-submit-spinner');
    const label = document.querySelector('#message-submit-label');

    button.disabled = true;
    spinner.classList.remove('hidden');
    label.textContent = 'Enviando...';
    try {
      await onSendMessage(selectedTicket, body);
      textarea.value = '';
      textarea.style.height = '';
    } finally {
      button.disabled = false;
      spinner.classList.add('hidden');
      label.textContent = 'Enviar';
    }
  });

  document.querySelector('#message-body').addEventListener('input', (event) => {
    const el = event.currentTarget;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 144)}px`;
  });

  document.querySelector('#ticket-detail').addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeTicketDetail();
  });
}

export function openTicketDetail(ticket, observeMessages) {
  selectedTicket = ticket;
  renderTicket(ticket);
  renderMessages([]);

  const overlay = document.querySelector('#ticket-detail');
  overlay.classList.remove('hidden');
  overlay.setAttribute('aria-hidden', 'false');
  document.body.classList.add('overlay-open');

  unsubscribeMessages?.();
  unsubscribeMessages = observeMessages(ticket, renderMessages, (error) => {
    console.error('[Sinal][Messages] Falha ao acompanhar conversa:', error);
  });

  openOverlayHistory('ticket-detail', finalizeClose);
}

export function updateSelectedTicket(ticket) {
  if (selectedTicket?.id === ticket.id) {
    selectedTicket = ticket;
    renderTicket(ticket);
  }
}

export function closeTicketDetail() {
  requestOverlayClose('ticket-detail', finalizeClose);
}

function finalizeClose() {
  unsubscribeMessages?.();
  unsubscribeMessages = null;
  document.querySelector('#ticket-detail').classList.add('hidden');
  document.querySelector('#ticket-detail').setAttribute('aria-hidden', 'true');
  document.body.classList.remove('overlay-open');
  selectedTicket = null;
}

function renderTicket(ticket) {
  const uid = currentContext.firebaseUser.uid;
  const isRequester = ticket.requesterUid === uid;
  const isAssignedAgent = ticket.assigneeUid === uid;
  const canClaim = currentContext.membership.role !== 'solicitante' && ticket.status === 'open' && !ticket.assigneeUid;
  const canMessage = isRequester || isAssignedAgent;

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
  statusEl.className = ticket.status === 'in_progress' ? 'ticket-badge bg-indigo-50 text-indigo-700' : 'ticket-badge bg-emerald-50 text-emerald-700';
  statusEl.textContent = status;

  const priorityEl = document.querySelector('#detail-priority');
  priorityEl.className = `ticket-badge ${priorityClass}`;
  priorityEl.textContent = priority;
  document.querySelector('#detail-category').textContent = category;

  document.querySelector('#claim-ticket-button').classList.toggle('hidden', !canClaim);

  const actionHelp = document.querySelector('#detail-action-help');
  if (canClaim) actionHelp.textContent = 'Assuma o sinal para iniciar o atendimento e poder responder ao solicitante.';
  else if (isAssignedAgent) actionHelp.textContent = 'Este sinal está em atendimento por você.';
  else if (ticket.assigneeName) actionHelp.textContent = `Este sinal está em atendimento por ${ticket.assigneeName}.`;
  else if (isRequester) actionHelp.textContent = 'Seu sinal está aguardando atendimento.';
  else actionHelp.textContent = 'Nenhuma ação operacional disponível neste estado.';

  const textarea = document.querySelector('#message-body');
  const submit = document.querySelector('#message-submit-button');
  const help = document.querySelector('#message-permission-help');

  textarea.disabled = !canMessage;
  submit.disabled = !canMessage;
  help.classList.toggle('hidden', canMessage);

  if (canMessage) {
    textarea.placeholder = isRequester ? 'Escreva uma mensagem para o atendimento...' : 'Escreva uma resposta para o solicitante...';
  } else {
    textarea.placeholder = canClaim ? 'Assuma este sinal para responder.' : 'Mensagem indisponível neste atendimento.';
    help.textContent = 'Somente o solicitante ou o atendente responsável pode enviar mensagens.';
  }
}

function renderMessages(messages) {
  const list = document.querySelector('#conversation-list');
  const empty = document.querySelector('#conversation-empty');
  const count = document.querySelector('#conversation-count');
  const uid = currentContext?.firebaseUser.uid;

  count.textContent = String(messages.length);
  empty.classList.toggle('hidden', messages.length > 0);

  list.innerHTML = messages.map((message) => {
    const mine = message.authorUid === uid;
    return `
      <article class="message-bubble ${mine ? 'mine' : 'theirs'}">
        <div class="whitespace-pre-wrap break-words text-sm leading-6">${escapeHtml(message.body)}</div>
        <div class="message-meta">${escapeHtml(message.authorName || 'Usuário')} · ${escapeHtml(formatDate(message.createdAt))}</div>
      </article>`;
  }).join('');

  const scroller = document.querySelector('#ticket-detail-scroll');
  window.setTimeout(() => { scroller.scrollTop = scroller.scrollHeight; }, 0);
}
