import { observeAuth, login, logout, requestPasswordReset } from './services/auth.service.js';
import { loadUserContext } from './services/context.service.js';
import { createTicket, claimTicket, observeMyTickets, observeCentralTickets } from './services/tickets.service.js';
import { observeMessages, sendMessage } from './services/messages.service.js';
import { initNavigation, isSupportRole, renderContext, showToast } from './ui/app-shell.js';
import { initSignalComposer, renderTickets } from './ui/signal-composer.js';
import { initCentral, updateCentralTickets } from './ui/central.js';
import { initTicketDetail, openTicketDetail, updateSelectedTicket } from './ui/ticket-detail.js';

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

let currentContext = null;
let unsubscribeMyTickets = null;
let unsubscribeCentralTickets = null;
let uiInitialized = false;
let centralInitialized = false;
let detailInitialized = false;

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
  unsubscribeMyTickets = null;
  unsubscribeCentralTickets = null;
  renderTickets([]);
  updateCentralTickets([]);
}

function renderSignedOut() {
  stopObservers();
  currentContext = null;
  appView.hidden = true;
  contextError.classList.add('hidden');
  authView.hidden = false;
  loadingScreen.hidden = true;
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
    }
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

async function renderSignedIn(user) {
  clearAuthMessage();
  authView.hidden = true;
  appView.hidden = false;
  loadingScreen.hidden = false;
  contextError.classList.add('hidden');
  stopObservers();

  try {
    const context = await loadUserContext(user);
    currentContext = context;
    renderContext(context);
    initAuthenticatedUi();
    ensureDetailInitialized(context);

    unsubscribeMyTickets = observeMyTickets(
      context,
      (tickets) => {
        renderTickets(tickets, openConversation);
        tickets.forEach(updateSelectedTicket);
      },
      () => showToast('Não foi possível atualizar sua lista de sinais.', 'error')
    );

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
    contextErrorMessage.textContent = error?.message || 'Erro inesperado ao carregar os dados do usuário.';
    contextError.classList.remove('hidden');
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

observeAuth((user) => user ? renderSignedIn(user) : renderSignedOut());
