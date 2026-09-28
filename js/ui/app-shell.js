const roleLabels = Object.freeze({
  admin: 'Administrador',
  supervisor: 'Supervisor',
  agente: 'Agente',
  solicitante: 'Solicitante'
});

export function roleLabel(role) {
  return roleLabels[role] ?? role ?? 'Perfil não definido';
}

export function renderContext(context) {
  const { firebaseUser, userProfile, tenant, membership } = context;
  const displayName = userProfile.displayName || firebaseUser.displayName || firebaseUser.email || 'Usuário';
  const firstName = displayName.trim().split(/\s+/)[0];

  document.querySelector('#tenant-name').textContent = tenant.name;
  document.querySelector('#membership-label').textContent = roleLabel(membership.role);
  document.querySelector('#header-user-name').textContent = displayName;
  document.querySelector('#header-user-email').textContent = firebaseUser.email ?? '';
  document.querySelector('#welcome-title').textContent = `Olá, ${firstName}.`;
  document.querySelector('#card-tenant-name').textContent = tenant.name;
  document.querySelector('#card-role').textContent = roleLabel(membership.role);
  document.querySelector('#more-user-email').textContent = firebaseUser.email ?? '';
  document.querySelector('#more-user-uid').textContent = firebaseUser.uid;

  const platformBadge = document.querySelector('#platform-badge');
  platformBadge.classList.toggle('hidden', userProfile.platformRole !== 'superadmin');
}

export function initNavigation() {
  const buttons = [...document.querySelectorAll('[data-view]')];
  const views = [...document.querySelectorAll('[data-app-view]')];

  function activate(viewName) {
    views.forEach((view) => {
      view.classList.toggle('hidden', view.id !== `view-${viewName}`);
    });

    buttons.forEach((button) => {
      button.classList.toggle('is-active', button.dataset.view === viewName);
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  buttons.forEach((button) => {
    button.addEventListener('click', () => activate(button.dataset.view));
  });

  activate('home');
}

let toastTimer;

export function showToast(message) {
  const toast = document.querySelector('#toast');
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.remove('hidden');

  toastTimer = window.setTimeout(() => {
    toast.classList.add('hidden');
  }, 2800);
}
