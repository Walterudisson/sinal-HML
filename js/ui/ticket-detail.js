import {
  categoryLabels, priorityLabels, priorityClasses, statusLabels, requesterStatusLabels, formatDate, escapeHtml
} from './signal-composer.js';
import { forceOverlayClosed, openOverlayHistory, openOverlaySubstate, requestOverlayClose, requestOverlaySubstateClose } from './overlay-history.js';

let currentContext = null;
let selectedTicket = null;
let onClaim = null;
let onSendMessage = null;
let unsubscribeMessages = null;
let unsubscribeStatusEvents = null;
let onResolve = null;
let onReopen = null;
let onGetPrivateResolution = null;
let onObserveStatusEvents = null;
let privateRequestId = 0;
let messagesSnapshotInitialized = false;
let previousMessageIds = [];
let currentStatusEvents = [];
let activeView = 'details';
let onConversationVisible = null;
let substateClosePending = false;
let followKeyboardViewport = false;

const publicSuggestions = [
  'Informamos que os ajustes necessários foram realizados e o problema relatado foi solucionado.',
  'Sua solicitação foi atendida e os procedimentos necessários foram concluídos.',
  'A solicitação foi atendida e as orientações necessárias foram fornecidas. Caso precise de mais informações, entre em contato com a equipe de suporte.'
];

export function setTicketDetailContext(context) { currentContext = context; }

// Notificações só devem ser silenciosas quando a conversa deste sinal está
// efetivamente na tela e o aplicativo está em primeiro plano.
export function isConversationVisible(ticketId) {
  const overlay = document.querySelector('#ticket-detail');
  return Boolean(
    ticketId &&
    selectedTicket?.id === ticketId &&
    activeView === 'conversation' &&
    document.visibilityState === 'visible' &&
    overlay && !overlay.classList.contains('hidden')
  );
}

function setTicketView(view) {
  activeView = view;
  for (const [name, id] of [
    ['details', 'ticket-details-view'],
    ['conversation', 'ticket-conversation-view'],
    ['resolution', 'ticket-resolution-view']
  ]) {
    const element = document.getElementById(id);
    element.classList.toggle('hidden', name !== view);
    if (name !== 'details') element.setAttribute('aria-hidden', String(name !== view));
  }
  const back = document.querySelector('#ticket-view-back');
  back.classList.toggle('hidden', view === 'details');
  const isRequester = selectedTicket?.requesterUid === currentContext?.firebaseUser?.uid;
  document.querySelector('#ticket-view-label').textContent =
    view === 'details'
      ? 'Detalhes do sinal'
      : view === 'conversation'
        ? (isRequester ? 'Conversa com o atendimento' : 'Conversa com o solicitante')
        : 'Finalizar atendimento';
  const panel = document.querySelector('#ticket-detail .ticket-detail-panel');
  panel.classList.toggle('is-immersive', view !== 'details');
  panel.classList.toggle('is-conversation', view === 'conversation');
  document.querySelectorAll('#ticket-detail [data-close-ticket-detail]').forEach((element) => {
    if (element.tagName === 'BUTTON') element.classList.toggle('hidden', view !== 'details');
  });
  if (view === 'conversation') onConversationVisible?.();
}

function goToDetails() {
  if (activeView === 'details' || substateClosePending) return;
  const leaving = activeView;
  substateClosePending = true;
  requestOverlaySubstateClose('ticket-detail', leaving, () => {
    substateClosePending = false;
    setTicketView('details');
  });
}

function openSubView(view) {
  if (!selectedTicket || activeView !== 'details') return;
  const created = openOverlaySubstate('ticket-detail', view, () => {
    substateClosePending = false;
    setTicketView('details');
  });
  if (!created) return;
  setTicketView(view);
  const scroller = document.querySelector(view === 'conversation' ? '#conversation-scroll' : '#resolution-scroll');
  requestAnimationFrame(() => {
    if (selectedTicket && activeView === view) {
      scroller.scrollTop = view === 'conversation' ? scroller.scrollHeight : 0;
    }
  });
}

function isConversationNearBottom(threshold = 140) {
  const scroller = document.querySelector('#conversation-scroll');
  if (!scroller) return false;
  return scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop < threshold;
}

function scrollConversationToBottom() {
  const scroller = document.querySelector('#conversation-scroll');
  if (!scroller || activeView !== 'conversation') return;
  requestAnimationFrame(() => {
    scroller.scrollTop = scroller.scrollHeight;
    requestAnimationFrame(() => {
      scroller.scrollTop = scroller.scrollHeight;
    });
  });
}

function setResolvePanel(open) {
  if (open) openSubView('resolution');
  else if (activeView === 'resolution') goToDetails();
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
  currentStatusEvents = Array.isArray(events) ? events : [];
  const list = document.querySelector('#detail-status-history');
  const timeline = [];

  if (selectedTicket?.createdAt) {
    timeline.push({
      type: 'created',
      actorName: selectedTicket.requesterName || 'Solicitante',
      createdAt: selectedTicket.createdAt
    });
  }

  timeline.push(...currentStatusEvents);

  const lastResolved = [...currentStatusEvents].reverse().find((event) => event.type === 'resolved');
  const updatedMillis = selectedTicket?.updatedAt?.toMillis?.() ?? 0;
  const resolvedMillis = lastResolved?.createdAt?.toMillis?.() ?? 0;
  if (
    selectedTicket?.status === 'in_progress' &&
    lastResolved &&
    updatedMillis > resolvedMillis
  ) {
    timeline.push({
      type: 'reopened',
      actorName: selectedTicket.requesterName || 'Solicitante',
      createdAt: selectedTicket.updatedAt
    });
  }

  if (!timeline.length) {
    list.innerHTML = '<li class="text-sm text-slate-500">Sem eventos registrados.</li>';
    return;
  }

  list.innerHTML = timeline.map((event) => {
    const requesterView = selectedTicket?.requesterUid === currentContext?.firebaseUser?.uid;
    const label = event.type === 'created' ? (requesterView ? 'Sinal enviado' : 'Sinal recebido') :
      event.type === 'claimed' ? 'Atendimento iniciado' :
      event.type === 'resolved' ? 'Sinal resolvido' :
      event.type === 'reopened' ? 'Sinal reaberto' : 'Atualização';

    return `<li class="ticket-timeline-item">
      <span class="ticket-timeline-dot" aria-hidden="true"></span>
      <div class="ticket-timeline-content">
        <strong>${escapeHtml(label)}</strong>
        <span>${escapeHtml(event.actorName || 'Equipe')} · ${escapeHtml(formatDate(event.createdAt))}</span>
      </div>
    </li>`;
  }).join('');
}

export function initTicketDetail(options) {
  currentContext = options.context;
  onClaim = options.onClaim;
  onSendMessage = options.onSendMessage;
  onResolve = options.onResolve;
  onReopen = options.onReopen;
  onGetPrivateResolution = options.onGetPrivateResolution;
  onObserveStatusEvents = options.onObserveStatusEvents;
  onConversationVisible = options.onConversationVisible;

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
  document.querySelector('#open-conversation-button').addEventListener('click', () => openSubView('conversation'));
  document.querySelector('#ticket-view-back').addEventListener('click', goToDetails);
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

  document.querySelector('#reopen-ticket-button').addEventListener('click', async () => {
    if (!selectedTicket) return;
    const button = document.querySelector('#reopen-ticket-button');
    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = 'Reabrindo...';
    try {
      await onReopen(selectedTicket);
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  });

  document.querySelector('#message-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!selectedTicket || activeView !== 'conversation') return;

    const textarea = document.querySelector('#message-body');
    const body = textarea.value.trim();
    if (!body) return;

    const button = document.querySelector('#message-submit-button');
    const spinner = document.querySelector('#message-submit-spinner');
    const label = document.querySelector('#message-submit-label');

    const icon = document.querySelector('#message-submit-icon');
    button.disabled = true;
    spinner.classList.remove('hidden');
    icon?.classList.add('hidden');
    label.textContent = 'Enviando...';
    try {
      await onSendMessage(selectedTicket, body);
      textarea.value = '';
      textarea.style.height = '';
    } finally {
      button.disabled = false;
      spinner.classList.add('hidden');
      icon?.classList.remove('hidden');
      label.textContent = 'Enviar';
    }
  });

  const messageBody = document.querySelector('#message-body');

  messageBody.addEventListener('focus', () => {
    followKeyboardViewport = isConversationNearBottom(220);
    if (followKeyboardViewport) {
      window.setTimeout(scrollConversationToBottom, 60);
      window.setTimeout(scrollConversationToBottom, 220);
    }
  });

  messageBody.addEventListener('blur', () => {
    followKeyboardViewport = false;
  });

  messageBody.addEventListener('input', (event) => {
    const el = event.currentTarget;
    const shouldFollow = followKeyboardViewport || isConversationNearBottom(180);
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    if (shouldFollow) scrollConversationToBottom();
  });

  window.visualViewport?.addEventListener('resize', () => {
    if (
      activeView === 'conversation' &&
      document.activeElement === messageBody &&
      followKeyboardViewport
    ) {
      scrollConversationToBottom();
    }
  });

  document.querySelector('#ticket-detail').addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeTicketDetail();
  });
}

export function openTicketDetail(ticket, observeMessages, options = {}) {
  const ticketChanged = selectedTicket?.id !== ticket.id;
  if (ticketChanged) {
    document.querySelector('#message-body').value = '';
    document.querySelector('#message-body').style.height = '';
  }
  selectedTicket = ticket;
  substateClosePending = false;
  followKeyboardViewport = false;
  setTicketView('details');
  renderTicket(ticket);
  messagesSnapshotInitialized = false;
  previousMessageIds = [];
  renderMessages([]);
  // O reset visual não representa o primeiro snapshot do Firestore.
  messagesSnapshotInitialized = false;
  renderStatusHistory([]);
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

  if (options.view === 'conversation') {
    requestAnimationFrame(() => {
      if (selectedTicket?.id === ticket.id && activeView === 'details') {
        openSubView('conversation');
      }
    });
  }
}

export function updateSelectedTicket(ticket) {
  if (selectedTicket?.id === ticket.id) {
    selectedTicket = ticket;
    renderTicket(ticket);
    renderStatusHistory(currentStatusEvents);
    if (ticket.status === 'resolved') void loadPrivateResolution(ticket);
  }
}

export function closeTicketDetail() {
  if (activeView !== 'details') {
    goToDetails();
    return;
  }
  requestOverlayClose('ticket-detail', finalizeClose);
}

function finalizeClose() {
  unsubscribeMessages?.();
  unsubscribeStatusEvents?.();
  unsubscribeMessages = null;
  unsubscribeStatusEvents = null;
  ++privateRequestId;
  substateClosePending = false;
  setTicketView('details');
  document.querySelector('#ticket-detail').classList.add('hidden');
  document.querySelector('#ticket-detail').setAttribute('aria-hidden', 'true');
  document.body.classList.remove('overlay-open');
  selectedTicket = null;
  messagesSnapshotInitialized = false;
  previousMessageIds = [];
  currentStatusEvents = [];
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
  const canReopen = isRequester && ticket.status === 'resolved';
  const canMessage = (isRequester || isAssignedAgent) && ticket.status !== 'resolved';

  const labels = isRequester ? requesterStatusLabels : statusLabels;
  const status = labels[ticket.status] ?? ticket.status ?? (isRequester ? 'Enviado' : 'Sinal recebido');
  const priority = priorityLabels[ticket.priority] ?? ticket.priority ?? 'Normal';
  const priorityClass = priorityClasses[ticket.priority] ?? priorityClasses.normal;
  const category = categoryLabels[ticket.category] ?? ticket.category ?? 'Sem categoria';

  document.querySelector('#detail-code').textContent = ticket.code ?? '';
  document.querySelector('#ticket-detail-title').textContent = ticket.title ?? 'Sinal';
  document.querySelector('#detail-description').textContent = ticket.description ?? '';
  document.querySelector('#detail-requester-name').textContent = ticket.requesterName ?? 'Solicitante';
  document.querySelector('#detail-requester-email').textContent = ticket.requesterEmail ?? '';
  document.querySelector('#detail-created-at').textContent =
    `${isRequester ? 'Enviado' : 'Recebido'} em ${formatDate(ticket.createdAt)}`;
  document.querySelector('#detail-assignee').textContent = ticket.assigneeName || 'Ainda não atribuído';
  document.querySelector('#open-conversation-label').textContent = isRequester ? 'Conversar com o atendimento' : 'Conversar com o solicitante';

  const statusEl = document.querySelector('#detail-status');
  statusEl.className = ticket.status === 'in_progress' ? 'ticket-badge bg-indigo-50 text-indigo-700' : 'ticket-badge bg-emerald-50 text-emerald-700';
  statusEl.textContent = status;

  const priorityEl = document.querySelector('#detail-priority');
  priorityEl.className = `ticket-badge ${priorityClass}`;
  priorityEl.textContent = priority;
  document.querySelector('#detail-category').textContent = category;

  document.querySelector('#claim-ticket-button').classList.toggle('hidden', !canClaim);
  document.querySelector('#resolve-ticket-button').classList.toggle('hidden', !canResolve);
  document.querySelector('#reopen-ticket-button').classList.toggle('hidden', !canReopen);
  if (!canResolve) setResolvePanel(false);

  const publicBlock = document.querySelector('#detail-public-resolution');
  const hasPublicResolution = ticket.status === 'resolved' &&
    ticket.resolutionShared === true && Boolean(ticket.publicResolution);
  publicBlock.classList.toggle('hidden', !hasPublicResolution);
  document.querySelector('#detail-public-resolution-text').textContent =
    hasPublicResolution ? ticket.publicResolution : '';

  const actionHelp = document.querySelector('#detail-action-help');
  if (ticket.status === 'resolved') actionHelp.textContent = canReopen ? 'Sinal resolvido. Reabra se precisar continuar o atendimento.' : 'Sinal resolvido. O histórico continua disponível.';
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
    textarea.placeholder = 'Mensagem...';
  } else {
    textarea.placeholder = 'Mensagem indisponível';
    help.textContent = ticket.status === 'resolved'
      ? (canReopen ? 'Este sinal foi resolvido. Reabra para continuar a conversa.' : 'Conversa encerrada: este sinal foi resolvido.')
      : canClaim
        ? 'Assuma este sinal para responder ao solicitante.'
        : 'Somente o solicitante ou o atendente responsável pode enviar mensagens.';
  }
}

function formatMessageStamp(timestamp) {
  if (!timestamp?.toDate) return 'agora';
  const date = timestamp.toDate();
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  return new Intl.DateTimeFormat('pt-BR', sameDay
    ? { hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }
  ).format(date);
}

function messageDayKey(timestamp) {
  if (!timestamp?.toDate) return '';
  const date = timestamp.toDate();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatMessageDay(timestamp) {
  if (!timestamp?.toDate) return 'Hoje';
  const date = timestamp.toDate();
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(date, today)) return 'Hoje';
  if (sameDay(date, yesterday)) return 'Ontem';

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short'
  }).format(date).replace('.', '');
}

function renderMessages(messages) {
  const list = document.querySelector('#conversation-list');
  const empty = document.querySelector('#conversation-empty');
  const count = document.querySelector('#conversation-count');
  const uid = currentContext?.firebaseUser.uid;

  const scroller = document.querySelector('#conversation-scroll');
  const nearBottom = scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop < 100;
  const firstSnapshot = !messagesSnapshotInitialized;
  const nextMessageIds = messages.map((message) => message.id);
  const hasNewMessage = !firstSnapshot && messages.length > previousMessageIds.length
    && nextMessageIds.some((id) => !previousMessageIds.includes(id));
  previousMessageIds = nextMessageIds;
  const shouldFollow =
    activeView === 'conversation' &&
    (firstSnapshot || (hasNewMessage && nearBottom));
  messagesSnapshotInitialized = true;

  count.textContent = String(messages.length);
  empty.classList.toggle('hidden', messages.length > 0);

  let previousDay = '';
  list.innerHTML = messages.map((message) => {
    const mine = message.authorUid === uid;
    const dayKey = messageDayKey(message.createdAt);
    const separator = dayKey && dayKey !== previousDay
      ? `<div class="message-day-separator" role="separator"><span>${escapeHtml(formatMessageDay(message.createdAt))}</span></div>`
      : '';
    previousDay = dayKey || previousDay;

    return `${separator}
      <article class="message-row ${mine ? 'mine' : 'theirs'}">
        <div class="message-bubble ${mine ? 'mine' : 'theirs'}">
          ${mine ? '' : `<div class="message-author">${escapeHtml(message.authorName || 'Usuário')}</div>`}
          <div class="message-text">${escapeHtml(message.body)}</div>
          <div class="message-meta">${escapeHtml(formatMessageStamp(message.createdAt))}</div>
        </div>
      </article>`;
  }).join('');

  // Ao entrar na conversa, mostrar a mensagem mais recente.
  // Depois disso, só acompanhar novas mensagens se o usuário já estiver perto do final.
  if (shouldFollow) {
    requestAnimationFrame(() => { scroller.scrollTop = scroller.scrollHeight; });
  }
}
