import { escapeHtml, formatRelativeAge, priorityClasses, priorityLabels } from './signal-composer.js';

let currentContext = null;
let myTickets = [];
let centralTickets = [];
let notifications = [];
let onOpenTicket = null;
let onClaimTicket = null;

export function initHome(options) {
  currentContext = options.context;
  onOpenTicket = options.onOpenTicket;
  onClaimTicket = options.onClaimTicket;
  renderHome();
}

export function updateHomeMyTickets(items) {
  myTickets = Array.isArray(items) ? items : [];
  renderHome();
}

export function updateHomeCentralTickets(items) {
  centralTickets = Array.isArray(items) ? items : [];
  renderHome();
}

export function updateHomeNotifications(items) {
  notifications = Array.isArray(items) ? items : [];
  renderHome();
}

function isSupport() {
  return ['admin', 'supervisor', 'agente'].includes(currentContext?.membership?.role);
}

function activityMillis(ticket) {
  const timestamp = ticket?.lastInteractionAt || ticket?.updatedAt || ticket?.createdAt;
  return timestamp?.toMillis?.() ?? timestamp?.toDate?.().getTime?.() ?? 0;
}

function renderHome() {
  if (!currentContext) return;
  const support = isSupport();
  document.querySelector('#home-requester')?.classList.toggle('hidden', support);
  document.querySelector('#home-support')?.classList.toggle('hidden', !support);

  const subtitle = document.querySelector('#home-subtitle');
  if (subtitle) {
    subtitle.textContent = support
      ? 'Veja o que precisa da sua atenção no atendimento agora.'
      : 'Acompanhe o que mudou e continue de onde parou.';
  }

  if (support) renderSupportHome();
  else renderRequesterHome();
}

function renderRequesterHome() {
  setText('#home-requester-open', myTickets.filter((t) => t.status === 'open').length);
  setText('#home-requester-progress', myTickets.filter((t) => t.status === 'in_progress').length);
  setText('#home-requester-resolved', myTickets.filter((t) => t.status === 'resolved').length);

  const unreadMessages = notifications
    .filter((item) => item.type === 'new_message' && !item.isRead && item.ticketId)
    .map((item) => ({
      notification: item,
      ticket: myTickets.find((ticket) => ticket.id === item.ticketId)
    }))
    .filter((item) => item.ticket)
    .slice(0, 3);

  const attention = document.querySelector('#home-requester-attention');
  const attentionEmpty = document.querySelector('#home-requester-attention-empty');
  attention.innerHTML = unreadMessages.map(({ ticket }) => requesterAttentionMarkup(ticket)).join('');
  attentionEmpty.classList.toggle('hidden', unreadMessages.length > 0);

  const recent = notifications
    .filter((item) => item.ticketId)
    .slice(0, 5);

  const activity = document.querySelector('#home-requester-activity');
  const activityEmpty = document.querySelector('#home-requester-activity-empty');
  activity.innerHTML = recent.map(notificationMarkup).join('');
  activityEmpty.classList.toggle('hidden', recent.length > 0);

  bindHomeActions();
}

function renderSupportHome() {
  const uid = currentContext.firebaseUser.uid;
  const newTickets = centralTickets.filter((t) => t.status === 'open');
  const mine = centralTickets.filter((t) => t.status === 'in_progress' && t.assigneeUid === uid);
  const unassigned = centralTickets.filter((t) => !t.assigneeUid && t.status === 'open');

  setText('#home-support-new', newTickets.length);
  setText('#home-support-mine', mine.length);
  setText('#home-support-unassigned', unassigned.length);

  const candidates = [];
  const seen = new Set();

  notifications
    .filter((item) => item.type === 'new_message' && !item.isRead && item.ticketId)
    .forEach((item) => {
      const ticket = mine.find((t) => t.id === item.ticketId);
      if (ticket && !seen.has(ticket.id)) {
        seen.add(ticket.id);
        candidates.push({ kind: 'message', ticket });
      }
    });

  [...unassigned]
    .filter((ticket) => ['urgente', 'alta'].includes(ticket.priority))
    .sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority) || activityMillis(a) - activityMillis(b))
    .forEach((ticket) => {
      if (!seen.has(ticket.id)) {
        seen.add(ticket.id);
        candidates.push({ kind: 'priority', ticket });
      }
    });

  [...mine]
    .sort((a, b) => activityMillis(b) - activityMillis(a))
    .forEach((ticket) => {
      if (!seen.has(ticket.id)) {
        seen.add(ticket.id);
        candidates.push({ kind: 'mine', ticket });
      }
    });

  const now = candidates.slice(0, 4);
  const nowList = document.querySelector('#home-support-now');
  const nowEmpty = document.querySelector('#home-support-now-empty');
  nowList.innerHTML = now.map(supportNowMarkup).join('');
  nowEmpty.classList.toggle('hidden', now.length > 0);

  const mineList = document.querySelector('#home-support-mine-list');
  const mineEmpty = document.querySelector('#home-support-mine-empty');
  const latestMine = [...mine].sort((a, b) => activityMillis(b) - activityMillis(a)).slice(0, 4);
  mineList.innerHTML = latestMine.map(compactTicketMarkup).join('');
  mineEmpty.classList.toggle('hidden', latestMine.length > 0);

  bindHomeActions();
}

function requesterAttentionMarkup(ticket) {
  return `<article class="home-action-card">
    <div class="min-w-0">
      <div class="home-action-kicker">💬 Nova mensagem · ${escapeHtml(ticket.code || 'Sinal')}</div>
      <strong class="home-action-title">${escapeHtml(ticket.title || 'Sinal')}</strong>
      <span class="home-action-meta">Atividade ${escapeHtml(formatRelativeAge(ticket.lastInteractionAt || ticket.updatedAt || ticket.createdAt))}</span>
    </div>
    <button data-home-ticket="${escapeHtml(ticket.id)}" data-home-view="conversation" class="home-action-button">Conversar</button>
  </article>`;
}

function notificationMarkup(item) {
  const view = item.type === 'new_message' ? 'conversation' : 'details';
  return `<button data-home-ticket="${escapeHtml(item.ticketId)}" data-home-view="${view}" class="home-activity-item">
    <span class="home-activity-icon">${item.type === 'new_message' ? '💬' : '•'}</span>
    <span class="min-w-0 flex-1">
      <strong>${escapeHtml(item.title || 'Atualização')}</strong>
      <span>${escapeHtml(item.body || '')}</span>
    </span>
    <span class="home-activity-age">${escapeHtml(formatRelativeAge(item.createdAt))}</span>
  </button>`;
}

function supportNowMarkup(item) {
  const { ticket, kind } = item;
  const priority = priorityLabels[ticket.priority] ?? ticket.priority ?? 'Normal';
  const priorityClass = priorityClasses[ticket.priority] ?? priorityClasses.normal;

  if (kind === 'message') {
    return `<article class="home-action-card">
      <div class="min-w-0">
        <div class="home-action-kicker">💬 Nova mensagem · ${escapeHtml(ticket.code || '')}</div>
        <strong class="home-action-title">${escapeHtml(ticket.title || 'Sinal')}</strong>
        <span class="home-action-meta">Atividade ${escapeHtml(formatRelativeAge(ticket.lastInteractionAt || ticket.updatedAt || ticket.createdAt))}</span>
      </div>
      <button data-home-ticket="${escapeHtml(ticket.id)}" data-home-view="conversation" class="home-action-button">Conversar</button>
    </article>`;
  }

  if (kind === 'priority') {
    return `<article class="home-action-card">
      <div class="min-w-0">
        <div class="flex flex-wrap items-center gap-2">
          <span class="home-action-kicker">${escapeHtml(ticket.code || '')}</span>
          <span class="ticket-badge ${priorityClass}">${escapeHtml(priority)}</span>
        </div>
        <strong class="home-action-title">${escapeHtml(ticket.title || 'Sinal')}</strong>
        <span class="home-action-meta">Sem responsável · aberto ${escapeHtml(formatRelativeAge(ticket.createdAt))}</span>
      </div>
      <button data-home-claim="${escapeHtml(ticket.id)}" class="home-action-button">Assumir</button>
    </article>`;
  }

  return `<article class="home-action-card">
    <div class="min-w-0">
      <div class="home-action-kicker">${escapeHtml(ticket.code || '')} · Em atendimento</div>
      <strong class="home-action-title">${escapeHtml(ticket.title || 'Sinal')}</strong>
      <span class="home-action-meta">Atividade ${escapeHtml(formatRelativeAge(ticket.lastInteractionAt || ticket.updatedAt || ticket.createdAt))}</span>
    </div>
    <button data-home-ticket="${escapeHtml(ticket.id)}" data-home-view="conversation" class="home-action-button">Conversar</button>
  </article>`;
}

function compactTicketMarkup(ticket) {
  return `<button data-home-ticket="${escapeHtml(ticket.id)}" data-home-view="details" class="home-activity-item">
    <span class="home-activity-icon">›</span>
    <span class="min-w-0 flex-1">
      <strong>${escapeHtml(ticket.title || 'Sinal')}</strong>
      <span>${escapeHtml(ticket.code || '')} · atividade ${escapeHtml(formatRelativeAge(ticket.lastInteractionAt || ticket.updatedAt || ticket.createdAt))}</span>
    </span>
  </button>`;
}

function bindHomeActions() {
  document.querySelectorAll('[data-home-ticket]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.dataset.homeTicket;
      const ticket = [...myTickets, ...centralTickets].find((item) => item.id === id);
      if (ticket) onOpenTicket?.(ticket, { view: button.dataset.homeView || 'details' });
    });
  });

  document.querySelectorAll('[data-home-claim]').forEach((button) => {
    button.addEventListener('click', async () => {
      const ticket = centralTickets.find((item) => item.id === button.dataset.homeClaim);
      if (!ticket || !onClaimTicket) return;
      button.disabled = true;
      button.textContent = 'Assumindo...';
      try {
        await onClaimTicket(ticket);
      } finally {
        button.disabled = false;
      }
    });
  });
}

function priorityRank(priority) {
  return ({ urgente: 4, alta: 3, normal: 2, baixa: 1 })[priority] ?? 0;
}

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = String(value);
}
