import { openOverlayHistory, requestOverlayClose } from './overlay-history.js';
import { escapeHtml, formatDate } from './signal-composer.js';

let items = [];
let onOpenTicket = null;
let onMarkRead = null;
let onMarkAllRead = null;
let initialSnapshotSeen = false;
let isConversationVisible = null;
const readInFlight = new Set();

function isMessageAlreadyVisible(item) {
  return item?.type === 'new_message' &&
    Boolean(item.ticketId) &&
    isConversationVisible?.(item.ticketId) === true;
}

// A leitura é registrada sem duplicar gravações enquanto o Firestore confirma
// a mudança. Vale tanto para avisos novos quanto para uma conversa já aberta.
export function markVisibleConversationNotifications() {
  if (!onMarkRead) return;
  items.filter((item) => !item.isRead && isMessageAlreadyVisible(item)).forEach((item) => {
    if (readInFlight.has(item.id)) return;
    readInFlight.add(item.id);
    let operation;
    try {
      operation = onMarkRead(item.id);
    } catch (error) {
      readInFlight.delete(item.id);
      console.warn('[Sinal][Notifications] Falha ao marcar mensagem como lida:', error);
      return;
    }
    Promise.resolve(operation).catch((error) => {
      console.warn('[Sinal][Notifications] Falha ao marcar mensagem como lida:', error);
    }).finally(() => readInFlight.delete(item.id));
  });
}

export function resetNotificationsUiSession() {
  initialSnapshotSeen = false;
  readInFlight.clear();
}

export function initNotificationsUi(options) {
  onOpenTicket = options.onOpenTicket;
  onMarkRead = options.onMarkRead;
  onMarkAllRead = options.onMarkAllRead;
  isConversationVisible = options.isConversationVisible;

  document.querySelector('#notification-bell').addEventListener('click', openPanel);
  document.querySelectorAll('[data-close-notifications]').forEach((button) => button.addEventListener('click', closePanel));
  document.querySelector('#mark-all-notifications-read').addEventListener('click', () => onMarkAllRead?.(items));
}

export function renderNotifications(nextItems, changes, showToast) {
  items = nextItems;
  const unread = items.filter((item) => !item.isRead).length;
  const badge = document.querySelector('#notification-badge');
  badge.textContent = unread > 99 ? '99+' : String(unread);
  badge.classList.toggle('hidden', unread === 0);
  document.querySelector('#notification-unread-count').textContent = unread ? `${unread} não lida${unread === 1 ? '' : 's'}` : 'Tudo lido';

  if ('setAppBadge' in navigator) {
    if (unread) navigator.setAppBadge(unread).catch(() => {});
    else navigator.clearAppBadge?.().catch(() => {});
  }

  const list = document.querySelector('#notification-list');
  const empty = document.querySelector('#notification-empty');
  empty.classList.toggle('hidden', items.length > 0);
  list.innerHTML = items.map(markup).join('');

  list.querySelectorAll('[data-notification-id]').forEach((button) => {
    button.addEventListener('click', async () => {
      const item = items.find((n) => n.id === button.dataset.notificationId);
      if (!item) return;
      if (!item.isRead) await onMarkRead?.(item.id);
      if (item.ticketId) {
        const view = item.type === 'new_message' ? 'conversation' : 'details';
        requestOverlayClose('notifications', finalizeClose, () => onOpenTicket?.(item.ticketId, { view }));
      }
    });
  });

  if (initialSnapshotSeen) {
    changes
      .filter((change) => change.type === 'added')
      .forEach((change) => {
        const item = { id: change.doc.id, ...change.doc.data() };

        // Toast apenas para uma notificação realmente nova e ainda não lida.
        if (item.isRead || isMessageAlreadyVisible(item)) return;

        showToast?.(
          item.body || 'Você tem uma nova atualização.',
          'info',
          { title: item.title || 'Novo aviso' }
        );
      });
  } else {
    // O primeiro snapshot de cada login contém todo o histórico como "added".
    // Ele alimenta a Central e o contador, mas não deve gerar toasts.
    initialSnapshotSeen = true;
  }
  markVisibleConversationNotifications();
}

function markup(item) {
  const unreadClass = item.isRead ? 'bg-white' : 'bg-sky-50/70';
  return `<button data-notification-id="${escapeHtml(item.id)}" class="w-full border-b border-slate-100 p-4 text-left ${unreadClass} hover:bg-slate-50">
    <div class="flex items-start gap-3">
      <span class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${item.isRead ? 'bg-slate-200' : 'bg-sky-600'}"></span>
      <div class="min-w-0 flex-1">
        <strong class="block text-sm font-extrabold text-slate-950">${escapeHtml(item.title || 'Notificação')}</strong>
        <p class="mt-1 text-sm leading-5 text-slate-600">${escapeHtml(item.body || '')}</p>
        <span class="mt-2 block text-xs text-slate-400">${escapeHtml(formatDate(item.createdAt))}</span>
      </div>
    </div>
  </button>`;
}

function openPanel() {
  const panel = document.querySelector('#notifications-panel');
  panel.classList.remove('hidden');
  panel.setAttribute('aria-hidden','false');
  document.body.classList.add('overlay-open');
  openOverlayHistory('notifications', finalizeClose);
}
function closePanel() { requestOverlayClose('notifications', finalizeClose); }
function finalizeClose() {
  document.querySelector('#notifications-panel').classList.add('hidden');
  document.querySelector('#notifications-panel').setAttribute('aria-hidden','true');
  document.body.classList.remove('overlay-open');
}
