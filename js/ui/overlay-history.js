let activeOverlay = null;
let afterClose = null;

window.addEventListener('popstate', () => {
  if (!activeOverlay) return;
  const overlay = activeOverlay;
  activeOverlay = null;
  overlay.onClose?.({ fromHistory: true });
  const callback = afterClose;
  afterClose = null;
  callback?.();
});

export function openOverlayHistory(name, onClose) {
  if (activeOverlay?.name === name) return;
  activeOverlay = { name, onClose };
  history.pushState({ ...(history.state ?? {}), sinalOverlay: name }, '', window.location.href);
}

export function requestOverlayClose(name, fallbackClose, onAfterClose = null) {
  if (activeOverlay?.name !== name) {
    fallbackClose?.();
    onAfterClose?.();
    return;
  }

  if (history.state?.sinalOverlay === name) {
    afterClose = onAfterClose;
    history.back();
  } else {
    const overlay = activeOverlay;
    activeOverlay = null;
    overlay.onClose?.({ fromHistory: false });
    onAfterClose?.();
  }
}

export function forceOverlayClosed(name) {
  if (activeOverlay?.name === name) activeOverlay = null;
}
