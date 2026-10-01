import { observeAuth, login, logout, requestPasswordReset } from './services/auth.service.js';
import { loadUserContext } from './services/context.service.js';
import { createTicket, claimTicket, resolveTicket, getPrivateResolution, observeStatusEvents, getTicketById, observeMyTickets, observeCentralTickets } from './services/tickets.service.js';
import { observeMessages, sendMessage } from './services/messages.service.js';
import { initNavigation, isSupportRole, renderContext, showToast } from './ui/app-shell.js';
import { initSignalComposer, renderTickets } from './ui/signal-composer.js';
import { initCentral, updateCentralTickets } from './ui/central.js';
import { initTicketDetail, setTicketDetailContext, openTicketDetail, updateSelectedTicket } from './ui/ticket-detail.js';
import { enablePushNotifications, disablePushNotifications, getPushState, markAllNotificationsRead, markNotificationRead, observeNotifications } from './services/notifications.service.js';
import { getPwaState, getServiceWorkerRegistration, promptInstall, registerPwa } from './services/pwa.service.js';
import { initNotificationsUi, renderNotifications, resetNotificationsUiSession } from './ui/notifications.js';

const loadingScreen = document.querySelector('#loading-screen');
const authView = document.querySelector('#auth-view');
const appView = document.querySelector('#app-view');
const contextError = document.querySelector('#context-error');
const contextErrorMessage = document.querySelector('#context-error-message');
const loginForm = document.querySelector('#login-form');
const emailInput = document.querySelector('#email');
const passwordInput = document.querySelector('#password');
const togglePasswordButton = document.querySelector('#toggle-password');
const eyeOpen = document.querySelector('#eye-open');
const eyeClosed = document.querySelector('#eye-closed');
const forgotPasswordButton = document.querySelector('#forgot-password');
const loginButton = document.querySelector('#login-button');
const loginButtonLabel = document.querySelector('#login-button-label');
const loginSpinner = document.querySelector('#login-spinner');
const authMessage = document.querySelector('#auth-message');
const logoutButton = document.querySelector('#logout-button');
const mobileNavGrid = document.querySelector('#mobile-nav-grid');
const membershipLabel = document.querySelector('#membership-label');

let currentContext = null;
let unsubscribeMyTickets = null;
let unsubscribeCentralTickets = null;
let unsubscribeNotifications = null;
let currentNotifications = [];
let pwaRegistration = null;
let uiInitialized = false;
let centralInitialized = false;
let detailInitialized = false;

// Fallback mobile-first: antes de o contexto ser carregado há quatro itens visíveis.
// renderContext() continua alterando para cinco colunas quando o usuário é suporte.
if (mobileNavGrid) {
  mobileNavGrid.style.gridTemplateColumns = 'repeat(4, minmax(0, 1fr))';
}

const authErrorMessages = {
  'auth/invalid-email': 'Informe um endereço de e-mail válido.',
  'auth/invalid-credential': 'E-mail ou senha inválidos.',
  'auth/user-disabled': 'Esta conta está desativada. Procure o administrador.',
  'auth/too-many-requests': 'Muitas tentativas foram realizadas. Aguarde um pouco e tente novamente.',
  'auth/network-request-failed': 'Não foi possível acessar o serviço de autenticação. Verifique sua conexão.',
  'auth/missing-password': 'Informe sua senha.'
};

function showAuthMessage(message, type = 'error') {
  const v = {
    error: 'border-rose-200 bg-rose-50 text-rose-800',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    info: 'border-sky-200 bg-sky-50 text-sky-800'
  };
  authMessage.className = `mb-5 rounded-xl border px-4 py-3 text-sm leading-5 ${v[type] ?? v.info}`;
  authMessage.textContent = message;
  authMessage.classList.remove('hidden');
}

function clearAuthMessage() { authMessage.textContent = ''; authMessage.classList.add('hidden'); }

function setLoginLoading(value) {
  loginButton.disabled = value;
  loginSpinner.classList.toggle('hidden', !value);
  loginButtonLabel.textContent = value ? 'Entrando...' : 'Entrar';
}

function stopObservers() {
  unsubscribeMyTickets?.();
  unsubscribeCentralTickets?.();
  unsubscribeNotifications?.();
  unsubscribeMyTickets = null;
  unsubscribeCentralTickets = null;
  unsubscribeNotifications = null;
  renderTickets([]);
  updateCentralTickets([]);
}

function renderSignedOut() {
  stopObservers();
  currentContext = null;
  setTicketDetailContext(null);
  appView.hidden = true;
  contextError.classList.add('hidden');
  authView.hidden = false;
  loadingScreen.hidden = true;
}

function ensureContextRetryButton() {
  let button = contextError.querySelector('[data-retry-context]');
  if (button) return button;

  button = document.createElement('button');
  button.type = 'button';
  button.dataset.retryContext = '1';
  button.className = 'mt-4 min-h-11 rounded-xl border border-rose-300 bg-white px-4 text-sm font-extrabold text-rose-800 hover:bg-rose-100';
  button.textContent = 'Tentar novamente';
  button.addEventListener('click', () => window.location.reload());

  contextError.append(button);
  return button;
}

function showContextLoadError(error) {
  const title = contextError.querySelector('strong');
  const message = String(error?.message || '');
  const isOffline =
    !navigator.onLine ||
    error?.code === 'unavailable' ||
    /offline|network/i.test(message);

  ensureContextRetryButton();

  if (isOffline) {
    if (title) title.textContent = 'Você está sem conexão.';
    contextErrorMessage.textContent =
      'Não conseguimos carregar suas informações agora. Verifique sua internet e tente novamente.';
    if (membershipLabel) membershipLabel.textContent = 'Sem conexão';
  } else {
    if (title) title.textContent = 'Não foi possível carregar suas informações.';
    contextErrorMessage.textContent =
      'Tente novamente em alguns instantes. Se o problema continuar, procure o suporte.';
    if (membershipLabel) membershipLabel.textContent = 'Contexto indisponível';
  }

  contextError.classList.remove('hidden');
}

function initAuthenticatedUi() {
  if (uiInitialized) return;
  initNavigation();
  initSignalComposer({
    onSubmit: async (payload) => {
      const ticket = await createTicket(currentContext, payload);
      showToast(`${ticket.code} foi enviado e já aparece em Meus sinais.`, 'success', { title: 'Sinal recebido' });
    }
  });
  uiInitialized = true;
}

function ensureDetailInitialized(context) {
  if (detailInitialized) return;
  initTicketDetail({
    context,
    onClaim: async (ticket) => {
      try {
        await claimTicket(currentContext, ticket);
        showToast(`${ticket.code} agora está em atendimento por você.`, 'success', { title: 'Sinal assumido' });
      } catch (error) {
        showToast('Não foi possível assumir este sinal.', 'error', { title: 'Atendimento não iniciado' });
        throw error;
      }
    },
    onSendMessage: async (ticket, body) => {
      try {
        await sendMessage(currentContext, ticket, body);
      } catch (error) {
        showToast('Não foi possível enviar a mensagem agora.', 'error', { title: 'Mensagem não enviada' });
        throw error;
      }
    },
    onResolve: async (ticket, details) => {
      await resolveTicket(currentContext, ticket, details);
      showToast(`${ticket.code} foi resolvido com sucesso.`, 'success', { title: 'Sinal resolvido' });
    },
    onGetPrivateResolution: (ticketId) => getPrivateResolution(currentContext, ticketId),
    onObserveStatusEvents: (ticketId, onData, onError) =>
      observeStatusEvents(currentContext, ticketId, onData, onError)
  });
  detailInitialized = true;
}

function openConversation(ticket) {
  openTicketDetail(ticket, (selectedTicket, onData, onError) =>
    observeMessages(currentContext, selectedTicket.id, onData, onError)
  );
}

function ensureCentralInitialized(context) {
  if (centralInitialized) return;
  initCentral({ context, onOpenTicket: openConversation });
  centralInitialized = true;
}

function refreshPushUi() {
  const state = getPushState();
  const enable = document.querySelector('#enable-notifications-button');
  const disable = document.querySelector('#disable-notifications-button');
  const status = document.querySelector('#push-status-text');
  if (!enable || !status) return;

  if (!state.supported) {
    status.textContent = 'Este navegador não oferece Web Push neste modo.';
    enable.classList.add('hidden'); disable.classList.add('hidden'); return;
  }
  if (!state.configured) {
    status.textContent = 'HML aguardando configuração da chave Web Push (VAPID).';
    enable.classList.remove('hidden'); disable.classList.add('hidden'); return;
  }
  if (state.permission === 'denied') {
    status.textContent = 'Notificações bloqueadas pelo navegador. Altere a permissão nas configurações do site.';
    enable.classList.add('hidden'); disable.classList.add('hidden'); return;
  }
  if (state.permission === 'granted' && state.registered) {
    status.textContent = 'Notificações ativas neste dispositivo.';
    enable.classList.add('hidden'); disable.classList.remove('hidden'); return;
  }
  status.textContent = 'Ative avisos de novos sinais e novas mensagens.';
  enable.classList.remove('hidden'); disable.classList.add('hidden');
}

function refreshInstallUi() {
  const state = getPwaState();
  const button = document.querySelector('#install-app-button');
  const help = document.querySelector('#pwa-install-help');
  if (!button || !help) return;
  if (state.standalone) {
    button.classList.add('hidden'); help.textContent = 'Sinal já está instalado neste dispositivo.';
  } else if (state.ios && !state.installPromptAvailable) {
    button.classList.add('hidden'); help.textContent = 'No iPhone/iPad, use Compartilhar → Adicionar à Tela de Início. Depois abra o Sinal pelo ícone para ativar Web Push.';
  } else if (state.installPromptAvailable) {
    button.classList.remove('hidden'); help.textContent = 'Instale o Sinal para abrir em modo aplicativo.';
  } else {
    button.classList.add('hidden'); help.textContent = 'A instalação será oferecida quando o navegador considerar o app elegível.';
  }
}

async function openTicketById(ticketId) {
  try {
    const ticket = await getTicketById(currentContext, ticketId);
    openConversation(ticket);
  } catch (error) {
    showToast(error?.message || 'Não foi possível abrir este sinal.', 'error', { title: 'Sinal indisponível' });
  }
}

function handleTicketDeepLink() {
  // O link pode chegar quando a PWA já está aberta ou ainda está autenticando.
  if (!currentContext) return;
  const params = new URLSearchParams(location.hash.replace(/^#/, ''));
  const ticketId = params.get('ticket');
  if (!ticketId || ticketId.length > 160) return;
  history.replaceState(history.state, '', `${location.pathname}${location.search}`);
  void openTicketById(ticketId);
}

// Na PWA em segundo plano, o clique no push não dispara um novo login.
window.addEventListener('hashchange', handleTicketDeepLink);
window.addEventListener('pageshow', handleTicketDeepLink);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) handleTicketDeepLink();
});

// Alternativa quando o sistema operacional não permite navegar um cliente aberto.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type !== 'sinal:open-ticket') return;
    const ticketId = event.data.ticketId;
    if (typeof ticketId !== 'string' || !ticketId || ticketId.length > 160) return;
    if (currentContext) void openTicketById(ticketId);
    else location.hash = `ticket=${encodeURIComponent(ticketId)}`;
  });
}

function initSprint13Ui() {
  initNotificationsUi({
    onOpenTicket: openTicketById,
    onMarkRead: (id) => markNotificationRead(currentContext, id),
    onMarkAllRead: (items) => markAllNotificationsRead(currentContext, items)
  });

  document.querySelector('#install-app-button').addEventListener('click', async () => {
    await promptInstall(); refreshInstallUi();
  });
  document.querySelector('#enable-notifications-button').addEventListener('click', async () => {
    try {
      if (!pwaRegistration) throw new Error('Service Worker ainda não está pronto. Recarregue a página e tente novamente.');
      const pwa = getPwaState();
      if (pwa.ios && !pwa.standalone) throw new Error('No iPhone/iPad, instale o Sinal na Tela de Início e abra pelo ícone antes de ativar notificações.');
      await enablePushNotifications(currentContext, pwaRegistration);
      showToast('Este dispositivo passará a receber avisos do Sinal.', 'success', { title: 'Notificações ativadas' });
      refreshPushUi();
    } catch (error) {
      showToast(error?.message || 'Não foi possível ativar notificações.', 'error', { title: 'Notificações' });
    }
  });
  document.querySelector('#disable-notifications-button').addEventListener('click', async () => {
    await disablePushNotifications(currentContext);
    showToast('Os avisos push foram desativados neste dispositivo.', 'info', { title: 'Notificações desativadas' });
    refreshPushUi();
  });
}

async function renderSignedIn(user) {
  clearAuthMessage();
  authView.hidden = true;
  appView.hidden = false;
  loadingScreen.hidden = false;
  contextError.classList.add('hidden');
  stopObservers();
  currentContext = null;

  try {
    const context = await loadUserContext(user);
    currentContext = context;
    renderContext(context);
    initAuthenticatedUi();
    ensureDetailInitialized(context);
    setTicketDetailContext(context);

    if (!document.body.dataset.sprint13Ui) {
      initSprint13Ui();
      document.body.dataset.sprint13Ui = '1';
    }
    refreshPushUi();
    refreshInstallUi();

    unsubscribeMyTickets = observeMyTickets(
      context,
      (tickets) => {
        renderTickets(tickets, openConversation);
        tickets.forEach(updateSelectedTicket);
      },
      () => showToast('Não foi possível atualizar sua lista de sinais.', 'error')
    );

    // Cada novo login/assinatura deve tratar o primeiro snapshot como estado inicial,
    // não como uma rajada de notificações novas.
    resetNotificationsUiSession();

    unsubscribeNotifications = observeNotifications(
      context,
      (items, changes) => {
        currentNotifications = items;
        renderNotifications(items, changes, showToast);
      },
      () => showToast('Não foi possível atualizar suas notificações.', 'error')
    );

    handleTicketDeepLink();

    if (isSupportRole(context.membership.role)) {
      ensureCentralInitialized(context);
      unsubscribeCentralTickets = observeCentralTickets(
        context,
        (tickets) => {
          updateCentralTickets(tickets);
          tickets.forEach(updateSelectedTicket);
        },
        () => showToast('Não foi possível atualizar a Central.', 'error')
      );
    }
  } catch (error) {
    showContextLoadError(error);
  } finally {
    loadingScreen.hidden = true;
  }
}

togglePasswordButton.addEventListener('click', () => {
  const showing = passwordInput.type === 'text';
  passwordInput.type = showing ? 'password' : 'text';
  eyeOpen.classList.toggle('hidden', !showing);
  eyeClosed.classList.toggle('hidden', showing);
  togglePasswordButton.setAttribute('aria-label', showing ? 'Mostrar senha' : 'Ocultar senha');
});

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearAuthMessage();
  if (!loginForm.reportValidity()) return;

  try {
    setLoginLoading(true);
    await login(emailInput.value.trim(), passwordInput.value);
    passwordInput.value = '';
  } catch (error) {
    showAuthMessage(authErrorMessages[error.code] ?? 'Não foi possível entrar no Sinal. Tente novamente.');
  } finally {
    setLoginLoading(false);
  }
});

forgotPasswordButton.addEventListener('click', async () => {
  clearAuthMessage();
  const email = emailInput.value.trim();

  if (!email) {
    showAuthMessage('Informe seu e-mail acima para solicitar a redefinição de senha.', 'info');
    return;
  }

  try {
    forgotPasswordButton.disabled = true;
    await requestPasswordReset(email);
    showAuthMessage('Se a conta estiver disponível para redefinição, as instruções foram enviadas.', 'success');
  } catch (error) {
    showAuthMessage(authErrorMessages[error.code] ?? 'Não foi possível solicitar a redefinição de senha agora.');
  } finally {
    forgotPasswordButton.disabled = false;
  }
});

logoutButton.addEventListener('click', async () => {
  logoutButton.disabled = true;
  logoutButton.textContent = 'Saindo...';
  try { await logout(); }
  finally {
    logoutButton.disabled = false;
    logoutButton.textContent = 'Sair';
  }
});

registerPwa({
  onInstallAvailable: refreshInstallUi,
  onInstalled: () => {
    refreshInstallUi();
    showToast('Sinal instalado neste dispositivo.', 'success', { title: 'Aplicativo instalado' });
  },
  onUpdate: () => showToast(
    'Uma nova versão do Sinal está pronta.',
    'info',
    {
      title: 'Atualização disponível',
      persistent: true,
      actionLabel: 'Atualizar agora',
      onAction: () => window.location.reload()
    }
  )
}).then((registration) => { pwaRegistration = registration; refreshInstallUi(); }).catch((error) => console.error('[Sinal][PWA]', error));

observeAuth((user) => user ? renderSignedIn(user) : renderSignedOut());
