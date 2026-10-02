import {
  categoryLabels, priorityLabels, priorityClasses, statusLabels, formatDate, escapeHtml
} from './signal-composer.js';
import { forceOverlayClosed, openOverlayHistory, requestOverlayClose } from './overlay-history.js';

let currentContext = null;
let selectedTicket = null;
let onClaim = null;
let onSendMessage = null;
let unsubscribeMessages = null;
let unsubscribeStatusEvents = null;
let onResolve = null;
let onGetPrivateResolution = null;
let onObserveStatusEvents = null;
let privateRequestId = 0;
let messagesSnapshotInitialized = false;
let previousMessageIds = [];

const publicSuggestions = [
  'Informamos que os ajustes necessários foram realizados e o problema relatado foi solucionado.',
  'Sua solicitação foi atendida e os procedimentos necessários foram concluídos.',
  'A solicitação foi atendida e as orientações necessárias foram fornecidas. Caso precise de mais informações, entre em contato com a equipe de suporte.'
];

export function setTicketDetailContext(context) { currentContext = context; }

function setResolvePanel(open) {
  document.querySelector('#resolve-panel').classList.toggle('hidden', !open);
  if (open) {
    document.querySelector('#resolve-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

async function loadPrivateResolution(ticket) {
  const requestId = ++privateRequestId;
  const block = document.querySelector('#detail-private-resolution');
  block.classList.add('hidden');
  document.querySelector('#detail-knowledge-candidate').classList.add('hidden');
  if (!currentContext || !['admin', 'supervisor', 'agente'].includes(currentContext.membership.role)
      || ticket.status !== 'resolved') return;

  try {
    const resolution = await onGetPrivateResolution?.(ticket.id);
    if (requestId !== privateRequestId || selectedTicket?.id !== ticket.id) return;
    if (!resolution) return;
    document.querySelector('#detail-private-resolution-text').textContent = resolution.text || '';
    document.querySelector('#detail-knowledge-candidate').classList.toggle('hidden', resolution.knowledgeCandidate !== true);
    block.classList.remove('hidden');
  } catch (error) {
    // Nenhuma informação interna é apresentada quando a leitura falhar.
    console.error('[Sinal] Não foi possível carregar a solução interna:', error?.code || 'indisponível');
  }
}

function renderStatusHistory(events) {
  const list = document.querySelector('#detail-status-history');
  if (!events.length) {
    list.innerHTML = '<li>Sem mudanças registradas nesta versão.</li>';
    return;
  }
  list.innerHTML = events.map((event) => {
    const label = event.type === 'claimed' ? 'Sinal em atendimento' :
      event.type === 'resolved' ? 'Sinal resolvido' : 'Atualização';
    return `<li class="rounded-xl border border-slate-100 bg-slate-50 p-3">
      <strong class="block text-slate-800">${escapeHtml(label)}</strong>
      <span class="mt-1 block text-xs text-slate-500">${escapeHtml(event.actorName || 'Equipe')} · ${escapeHtml(formatDate(event.createdAt))}</span>
    </li>`;
  }).join('');
}

export function initTicketDetail(options) {
  currentContext = options.context;
  onClaim = options.onClaim;
  onSendMessage = options.onSendMessage;
  onResolve = options.onResolve;
  onGetPrivateResolution = options.onGetPrivateResolution;
  onObserveStatusEvents = options.onObserveStatusEvents;

  const form = document.querySelector('#resolve-form');
  const internal = document.querySelector('#resolution-internal');
  const share = document.querySelector('#resolution-share');
  const publicText = document.querySelector('#resolution-public');
  const errorBox = document.querySelector('#resolve-error');
  let resolving = false;

  document.querySelector('#resolve-ticket-button').addEventListener('click', () => {
    form.reset();
    errorBox.classList.add('hidden');
    document.querySelector('#resolution-public-area').classList.add('hidden');
    setResolvePanel(true);
  });
  document.querySelector('#resolve-cancel').addEventListener('click', () => {
    if (!resolving) setResolvePanel(false);
  });
  share.addEventListener('change', () => {
    document.querySelector('#resolution-public-area').classList.toggle('hidden', !share.checked);
  });
  document.querySelectorAll('[data-resolution-suggestion]').forEach((button) => {
    button.addEventListener('click', () => {
      const suggestion = publicSuggestions[Number(button.dataset.resolutionSuggestion)];
      if (suggestion) {
        publicText.value = suggestion;
        publicText.focus();
      }
    });
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!selectedTicket || resolving) return;
    const internalText = internal.value.trim();
    const message = share.checked ? publicText.value.trim() : '';
    const fail = (text) => { errorBox.textContent = text; errorBox.classList.remove('hidden'); };
    errorBox.classList.add('hidden');
    if (!navigator.onLine) return fail('Você está sem conexão. Reconecte-se antes de resolver o sinal.');
    if (internalText.length < 3) return fail('Descreva a solução interna com pelo menos 3 caracteres.');
    if (share.checked && message.length < 3) return fail('Preencha a mensagem para o solicitante com pelo menos 3 caracteres.');

    const button = document.querySelector('#resolve-submit');
    resolving = true;
    button.disabled = true;
    button.textContent = 'Resolvendo...';
    try {
      await onResolve(selectedTicket, {
        internalText,
        share: share.checked,
        publicText: message,
        knowledgeCandidate: document.querySelector('#resolution-knowledge').checked
      });
      setResolvePanel(false);
      form.reset();
    } catch (error) {
      const isKnown = /sem conexão|somente o técnico|descreva a solução|preencha a mensagem/i.test(error?.message || '');
      fail(isKnown ? error.message : 'Não foi possível confirmar a resolução. Verifique a conexão e tente novamente; se persistir, procure o suporte.');
    } finally {
      resolving = false;
      button.disabled = false;
      button.textContent = 'Confirmar resolução';
    }
  });

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
  messagesSnapshotInitialized = false;
  previousMessageIds = [];
  renderMessages([]);
  renderStatusHistory([]);
  setResolvePanel(false);
  void loadPrivateResolution(ticket);

  const overlay = document.querySelector('#ticket-detail');
  overlay.classList.remove('hidden');
  overlay.setAttribute('aria-hidden', 'false');
  document.body.classList.add('overlay-open');

  // Abrir sempre pelo cabeçalho: status, prioridade e categoria precisam ficar visíveis.
  // A conversa não deve forçar a rolagem ao receber o primeiro snapshot.
  const scroller = document.querySelector('#ticket-detail-scroll');
  scroller.scrollTop = 0;
  requestAnimationFrame(() => {
    if (selectedTicket?.id === ticket.id) scroller.scrollTop = 0;
  });

  unsubscribeMessages?.();
  unsubscribeMessages = observeMessages(ticket, renderMessages, (error) => {
    console.error('[Sinal][Messages] Falha ao acompanhar conversa:', error);
  });
  unsubscribeStatusEvents?.();
  unsubscribeStatusEvents = onObserveStatusEvents?.(
    ticket.id,
    renderStatusHistory,
    () => renderStatusHistory([])
  );

  openOverlayHistory('ticket-detail', finalizeClose);
}

export function updateSelectedTicket(ticket) {
  if (selectedTicket?.id === ticket.id) {
    selectedTicket = ticket;
    renderTicket(ticket);
    if (ticket.status === 'resolved') void loadPrivateResolution(ticket);
  }
}

export function closeTicketDetail() {
  requestOverlayClose('ticket-detail', finalizeClose);
}

function finalizeClose() {
  unsubscribeMessages?.();
  unsubscribeStatusEvents?.();
  unsubscribeMessages = null;
  unsubscribeStatusEvents = null;
  ++privateRequestId;
  setResolvePanel(false);
  document.querySelector('#ticket-detail').classList.add('hidden');
  document.querySelector('#ticket-detail').setAttribute('aria-hidden', 'true');
  document.body.classList.remove('overlay-open');
  selectedTicket = null;
  messagesSnapshotInitialized = false;
  previousMessageIds = [];
  document.querySelector('#detail-private-resolution-text').textContent = '';
  document.querySelector('#detail-private-resolution').classList.add('hidden');
  document.querySelector('#detail-public-resolution-text').textContent = '';
  document.querySelector('#detail-public-resolution').classList.add('hidden');
  renderStatusHistory([]);
}

export function resetTicketDetailUi() {
  forceOverlayClosed('ticket-detail');
  finalizeClose();
  currentContext = null;
}

function renderTicket(ticket) {
  const uid = currentContext.firebaseUser.uid;
  const isRequester = ticket.requesterUid === uid;
  const isAssignedAgent = ticket.assigneeUid === uid;
  const canClaim = currentContext.membership.role !== 'solicitante' && ticket.status === 'open' && !ticket.assigneeUid;
  const canResolve = isAssignedAgent && ticket.status === 'in_progress';
  const canMessage = (isRequester || isAssignedAgent) && ticket.status !== 'resolved';

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
  document.querySelector('#resolve-ticket-button').classList.toggle('hidden', !canResolve);
  if (!canResolve) setResolvePanel(false);

  const publicBlock = document.querySelector('#detail-public-resolution');
  const hasPublicResolution = ticket.status === 'resolved' &&
    ticket.resolutionShared === true && Boolean(ticket.publicResolution);
  publicBlock.classList.toggle('hidden', !hasPublicResolution);
  document.querySelector('#detail-public-resolution-text').textContent =
    hasPublicResolution ? ticket.publicResolution : '';

  const actionHelp = document.querySelector('#detail-action-help');
  if (ticket.status === 'resolved') actionHelp.textContent = 'Sinal resolvido. O histórico continua disponível.';
  else if (canClaim) actionHelp.textContent = 'Assuma o sinal para iniciar o atendimento e poder responder ao solicitante.';
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
    textarea.placeholder = ticket.status === 'resolved' ? 'Conversa encerrada neste sinal.' :
      canClaim ? 'Assuma este sinal para responder.' : 'Mensagem indisponível neste atendimento.';
    help.textContent = ticket.status === 'resolved' ? 'Este sinal foi resolvido. A reabertura será disponibilizada em uma próxima versão.' :
      'Somente o solicitante ou o atendente responsável pode enviar mensagens.';
  }
}

function renderMessages(messages) {
  const list = document.querySelector('#conversation-list');
  const empty = document.querySelector('#conversation-empty');
  const count = document.querySelector('#conversation-count');
  const uid = currentContext?.firebaseUser.uid;

  const scroller = document.querySelector('#ticket-detail-scroll');
  const nearBottom = scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop < 100;
  const nextMessageIds = messages.map((message) => message.id);
  const hasNewMessage = messagesSnapshotInitialized && messages.length > previousMessageIds.length
    && nextMessageIds.some((id) => !previousMessageIds.includes(id));
  previousMessageIds = nextMessageIds;
  const shouldFollow = hasNewMessage && nearBottom;
  messagesSnapshotInitialized = true;

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

  // Apenas acompanhar novas mensagens quando o usuário já estiver perto do final.
  // Nunca mover a tela ao abrir um sinal ou ao atualizar um snapshot existente.
  if (shouldFollow) {
    requestAnimationFrame(() => { scroller.scrollTop = scroller.scrollHeight; });
  }
}
