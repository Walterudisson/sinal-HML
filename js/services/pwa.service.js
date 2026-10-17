let deferredInstallPrompt = null;
let registration = null;

export async function registerPwa({ onInstallAvailable, onInstalled, onUpdate }) {
  if (!('serviceWorker' in navigator)) return null;

  registration = await navigator.serviceWorker.register('./service-worker.js', { updateViaCache: 'none' });
  registration.update().catch(() => {});
  registration = await navigator.serviceWorker.ready;

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    onInstallAvailable?.(true);
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    onInstallAvailable?.(false);
    onInstalled?.();
  });

  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;

    const reloadKey = 'sinal:pwa-controller-reload';
    let alreadyReloaded = false;
    try { alreadyReloaded = sessionStorage.getItem(reloadKey) === '1'; } catch (_) { /* Sem armazenamento. */ }
    if (!alreadyReloaded) {
      try { sessionStorage.setItem(reloadKey, '1'); } catch (_) { /* Sem armazenamento. */ }
      window.location.reload();
      return;
    }

    try { sessionStorage.removeItem(reloadKey); } catch (_) { /* Sem armazenamento. */ }
    onUpdate?.();
  });

  // Libera a trava após uma inicialização estável para que a próxima
  // atualização futura também possa recarregar automaticamente.
  window.setTimeout(() => {
    try { sessionStorage.removeItem('sinal:pwa-controller-reload'); } catch (_) { /* Sem armazenamento. */ }
  }, 5000);

  return registration;
}

export async function promptInstall() {
  if (!deferredInstallPrompt) return false;
  await deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  return true;
}

export function getPwaState() {
  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  return { standalone, ios, installPromptAvailable: Boolean(deferredInstallPrompt) };
}

export function getServiceWorkerRegistration() { return registration; }
