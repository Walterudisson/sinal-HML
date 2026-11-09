// 1.7.1-B: impedir repetição acidental de abertura durante tentativas incertas.
// Não guarda mensagem, dados pessoais ou credenciais no armazenamento do navegador.
export function createOpeningAttemptController(prepareAttempt) {
  let pending = null;

  return Object.freeze({
    reserve(message, sessionKey) {
      if (typeof message !== 'string' || !message.trim() || !sessionKey) {
        throw new Error('Não foi possível preparar o envio deste Sinal.');
      }
      if (pending && pending.sessionKey !== sessionKey) {
        throw new Error('A conta foi alterada. Feche e abra novamente para continuar.');
      }
      if (pending && pending.message !== message) {
        throw new Error(
          'Existe uma tentativa de envio pendente. Para evitar duplicidade, mantenha a mensagem original e tente novamente.'
        );
      }
      if (!pending) {
        pending = { message, sessionKey, ids: prepareAttempt() };
      }
      return pending.ids;
    },
    reset() {
      pending = null;
    },
    hasPending() {
      return pending !== null;
    }
  });
}
