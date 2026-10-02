let activeOverlay = null;
let afterClose = null;

window.addEventListener('popstate', () => {
  if (!activeOverlay) return;
  if (activeOverlay.substate) {
    const nested = activeOverlay.substate;
    activeOverlay.substate = null;
    nested.onClose?.({ fromHistory: true });
    return;
  }
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

// Subtela opcional do overlay atual. Voltar fecha apenas a subtela,
// mantendo o detalhe do mesmo sinal e o histórico anterior do usuário.
export function openOverlaySubstate(name, subName, onClose) {
  if (activeOverlay?.name !== name || activeOverlay.substate) return false;
  activeOverlay.substate = { name: subName, onClose };
  history.pushState({ ...(history.state ?? {}), sinalOverlay: name, sinalOverlaySubstate: subName }, '', window.location.href);
  return true;
}

export function requestOverlaySubstateClose(name, subName, fallbackClose) {
  if (activeOverlay?.name === name && activeOverlay.substate?.name === subName) {
    if (history.state?.sinalOverlaySubstate === subName) history.back();
    else {
      activeOverlay.substate = null;
      fallbackClose?.();
    }
  } else fallbackClose?.();
}
