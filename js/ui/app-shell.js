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

export function showToast(message, type = 'info', options = {}) {
  const container = document.querySelector('#toast-container');
  if (!container) return;

  const variants = {
    success: {
      shell: 'border-emerald-200 bg-white text-slate-900',
      icon: 'bg-emerald-50 text-emerald-700',
      symbol: '✓'
    },
    error: {
      shell: 'border-rose-200 bg-white text-slate-900',
      icon: 'bg-rose-50 text-rose-700',
      symbol: '!'
    },
    info: {
      shell: 'border-sky-200 bg-white text-slate-900',
      icon: 'bg-sky-50 text-sky-700',
      symbol: 'i'
    }
  };

  const variant = variants[type] ?? variants.info;
  const toast = document.createElement('div');
  toast.className = `toast-item flex items-start gap-3 rounded-2xl border p-4 shadow-xl ${variant.shell}`;
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');

  const icon = document.createElement('div');
  icon.className = `grid h-8 w-8 shrink-0 place-items-center rounded-xl text-sm font-extrabold ${variant.icon}`;
  icon.textContent = variant.symbol;

  const content = document.createElement('div');
  content.className = 'min-w-0 flex-1';

  const title = document.createElement('strong');
  title.className = 'block text-sm font-extrabold';
  title.textContent = options.title ?? (type === 'success' ? 'Sinal recebido' : type === 'error' ? 'Não foi possível' : 'Sinal');

  const body = document.createElement('p');
  body.className = 'mt-1 text-sm leading-5 text-slate-600';
  body.textContent = message;

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'pointer-events-auto grid h-8 w-8 shrink-0 place-items-center rounded-lg text-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700';
  close.setAttribute('aria-label', 'Fechar notificação');
  close.textContent = '×';

  content.append(title, body);
  toast.append(icon, content, close);
  container.append(toast);

  let timer;

  const remove = () => {
    window.clearTimeout(timer);
    toast.classList.add('toast-out');
    window.setTimeout(() => toast.remove(), 180);
  };

  close.addEventListener('click', remove);

  if (options.persistent !== true) {
    timer = window.setTimeout(remove, options.duration ?? 4200);
  }
}
