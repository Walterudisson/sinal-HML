let activeOverlay = null;

window.addEventListener('popstate', () => {
  if (!activeOverlay) return;

  const overlay = activeOverlay;
  activeOverlay = null;
  overlay.onClose?.({ fromHistory: true });
});

export function openOverlayHistory(name, onClose) {
  if (activeOverlay?.name === name) return;

  activeOverlay = { name, onClose };
  history.pushState(
    { ...(history.state ?? {}), sinalOverlay: name },
    '',
    window.location.href
  );
}

export function requestOverlayClose(name, fallbackClose) {
  if (activeOverlay?.name !== name) {
    fallbackClose?.();
    return;
  }

  if (history.state?.sinalOverlay === name) {
    history.back();
  } else {
    const overlay = activeOverlay;
    activeOverlay = null;
    overlay.onClose?.({ fromHistory: false });
  }
}

export function forceOverlayClosed(name) {
  if (activeOverlay?.name === name) {
    activeOverlay = null;
  }
}
