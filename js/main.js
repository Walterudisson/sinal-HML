import { observeAuth, login, logout, requestPasswordReset } from './services/auth.service.js';
import { loadUserContext } from './services/context.service.js';
import { initNavigation, renderContext, showToast } from './ui/app-shell.js';

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
const sendSignalButton = document.querySelector('#send-signal-button');

let navigationInitialized = false;

const authErrorMessages = {
  'auth/invalid-email': 'Informe um endereço de e-mail válido.',
  'auth/invalid-credential': 'E-mail ou senha inválidos.',
  'auth/user-disabled': 'Esta conta está desativada. Procure o administrador.',
  'auth/too-many-requests': 'Muitas tentativas foram realizadas. Aguarde um pouco e tente novamente.',
  'auth/network-request-failed': 'Não foi possível acessar o serviço de autenticação. Verifique sua conexão.',
  'auth/missing-password': 'Informe sua senha.'
};

function showAuthMessage(message, type = 'error') {
  const variants = {
    error: 'border-rose-200 bg-rose-50 text-rose-800',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    info: 'border-sky-200 bg-sky-50 text-sky-800'
  };

  authMessage.className = `mb-5 rounded-xl border px-4 py-3 text-sm leading-5 ${variants[type] ?? variants.info}`;
  authMessage.textContent = message;
  authMessage.classList.remove('hidden');
}

function clearAuthMessage() {
  authMessage.textContent = '';
  authMessage.classList.add('hidden');
}

function setLoginLoading(isLoading) {
  loginButton.disabled = isLoading;
  loginSpinner.classList.toggle('hidden', !isLoading);
  loginButtonLabel.textContent = isLoading ? 'Entrando...' : 'Entrar';
}

function renderSignedOut() {
  appView.hidden = true;
  contextError.classList.add('hidden');
  authView.hidden = false;
  loadingScreen.hidden = true;
  window.setTimeout(() => emailInput.focus(), 50);
}

async function renderSignedIn(user) {
  clearAuthMessage();
  authView.hidden = true;
  appView.hidden = false;
  loadingScreen.hidden = false;
  contextError.classList.add('hidden');

  try {
    const context = await loadUserContext(user);
    renderContext(context);

    if (!navigationInitialized) {
      initNavigation();
      navigationInitialized = true;
    }
  } catch (error) {
    console.error('[Sinal][Context] Falha ao carregar contexto:', error);
    contextErrorMessage.textContent = error?.message || 'Erro inesperado ao carregar os dados do usuário.';
    contextError.classList.remove('hidden');
  } finally {
    loadingScreen.hidden = true;
  }
}

togglePasswordButton.addEventListener('click', () => {
  const showingPassword = passwordInput.type === 'text';
  passwordInput.type = showingPassword ? 'password' : 'text';
  eyeOpen.classList.toggle('hidden', !showingPassword);
  eyeClosed.classList.toggle('hidden', showingPassword);
  togglePasswordButton.setAttribute('aria-label', showingPassword ? 'Mostrar senha' : 'Ocultar senha');
  togglePasswordButton.title = showingPassword ? 'Mostrar senha' : 'Ocultar senha';
  passwordInput.focus();
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
    console.error('[Sinal][Auth] Falha no login:', error);
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
    emailInput.focus();
    return;
  }

  if (!emailInput.checkValidity()) {
    showAuthMessage('Informe um endereço de e-mail válido.');
    emailInput.focus();
    return;
  }

  try {
    forgotPasswordButton.disabled = true;
    await requestPasswordReset(email);
    showAuthMessage('Se a conta estiver disponível para redefinição, as instruções foram enviadas para o e-mail informado.', 'success');
  } catch (error) {
    console.error('[Sinal][Auth] Falha na redefinição:', error);
    showAuthMessage(authErrorMessages[error.code] ?? 'Não foi possível solicitar a redefinição de senha agora. Tente novamente.');
  } finally {
    forgotPasswordButton.disabled = false;
  }
});

logoutButton.addEventListener('click', async () => {
  logoutButton.disabled = true;
  logoutButton.textContent = 'Saindo...';

  try {
    await logout();
  } catch (error) {
    console.error('[Sinal][Auth] Falha ao sair:', error);
  } finally {
    logoutButton.disabled = false;
    logoutButton.textContent = 'Sair';
  }
});

sendSignalButton.addEventListener('click', () => {
  showToast('A abertura real de sinais chega na Sprint 1.0.');
});

observeAuth((user) => {
  if (user) {
    renderSignedIn(user);
  } else {
    renderSignedOut();
  }
});
