// 1.7.1-A: regras puras do domínio de abertura. Sem Firebase/DOM.
export const MIN_OPENING_LENGTH = 3;
export const MAX_OPENING_LENGTH = 4000;
export const MAX_AUTO_TITLE_LENGTH = 80;

export function normalizeOpeningMessage(message) {
  if (typeof message !== 'string') throw new Error('Escreva sua mensagem antes de mandar um Sinal.');
  const body = message.trim();
  if (body.length < MIN_OPENING_LENGTH || body.length > MAX_OPENING_LENGTH) {
    throw new Error('A mensagem precisa ter de 3 a 4.000 caracteres.');
  }
  return body;
}

export function generateSignalTitle(message) {
  const body = normalizeOpeningMessage(message);
  // Somente o primeiro parágrafo serve de título, preservando a mensagem original.
  const firstLine = body.split(/\r?\n/).find(line => line.trim().length > 0) || body;
  const oneLine = firstLine.replace(/\s+/g, ' ').trim();
  if (oneLine.length <= MAX_AUTO_TITLE_LENGTH) return oneLine;
  const prefix = oneLine.slice(0, MAX_AUTO_TITLE_LENGTH + 1);
  const lastSpace = prefix.lastIndexOf(' ');
  const cut = lastSpace >= 20 ? prefix.slice(0, lastSpace) : prefix.slice(0, MAX_AUTO_TITLE_LENGTH);
  return cut.trimEnd();
}

export function hasTriage(category, priority) {
  return category != null && priority != null;
}

export const TICKET_CATEGORIES = Object.freeze(['acesso', 'equipamento', 'rede', 'sistemas', 'outro']);
export const TICKET_PRIORITIES = Object.freeze(['baixa', 'normal', 'alta', 'urgente']);

export function validateTriage(category, priority) {
  if (category === null && priority === null) return;
  if (!TICKET_CATEGORIES.includes(category) || !TICKET_PRIORITIES.includes(priority)) {
    throw new Error('Selecione uma categoria e uma prioridade válidas.');
  }
}
