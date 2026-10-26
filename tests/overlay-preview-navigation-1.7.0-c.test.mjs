import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Android Voltar fecha imagem, depois conversa, depois detalhes', async () => {
  const events = new Map();
  const url = 'https://example.test/sinal-HML/';
  const stack = [{ state: null }];
  let position = 0;
  globalThis.window = {
    location: { href: url },
    addEventListener: (name, cb) => { events.set(name, cb); }
  };
  globalThis.history = {
    get state() { return stack[position].state; },
    pushState(state) {
      stack.splice(position + 1);
      stack.push({ state });
      position = stack.length - 1;
    },
    back() {
      assert.ok(position > 0, 'há uma entrada anterior');
      position -= 1;
      events.get('popstate')?.({ state: stack[position].state });
    }
  };
  const script = readFileSync(new URL('../js/ui/overlay-history.js', import.meta.url), 'utf8');
  const navigation = await import('data:text/javascript;charset=utf-8,' + encodeURIComponent(script));

  const closed = [];
  navigation.openOverlayHistory('ticket-detail', () => closed.push('detalhes'));
  assert.equal(navigation.openOverlaySubstate('ticket-detail', 'conversation', () => closed.push('conversa')), true);
  assert.equal(navigation.openOverlayNestedSubstate('ticket-detail', 'conversation', 'attachment-preview',
    () => closed.push('imagem')), true);
  assert.equal(position, 3);

  // Primeiro Voltar físico: não deve retornar aos dados do sinal.
  history.back();
  assert.deepEqual(closed, ['imagem']);
  assert.equal(history.state.sinalOverlaySubstate, 'conversation');

  // Abrir outra imagem e fechar pelo botão visível deve consumir só a prévia.
  assert.equal(navigation.openOverlayNestedSubstate('ticket-detail', 'conversation', 'attachment-preview',
    () => closed.push('imagem-2')), true);
  navigation.requestOverlayNestedSubstateClose('ticket-detail', 'attachment-preview',
    () => closed.push('fallback'));
  assert.deepEqual(closed, ['imagem', 'imagem-2']);
  assert.equal(history.state.sinalOverlaySubstate, 'conversation');

  // O segundo nível de Voltar restaura os dados do sinal.
  history.back();
  assert.deepEqual(closed, ['imagem', 'imagem-2', 'conversa']);
  assert.equal(history.state.sinalOverlay, 'ticket-detail');

  // Só o terceiro nível fecha o detalhe inteiro.
  history.back();
  assert.deepEqual(closed, ['imagem', 'imagem-2', 'conversa', 'detalhes']);
  navigation.forceOverlayClosed('ticket-detail');
});

test('Integração da prévia mantém fechamento por histórico e Escape', () => {
  const source = readFileSync(new URL('../js/ui/ticket-detail.js', import.meta.url), 'utf8');
  assert.match(source, /openOverlayNestedSubstate\(\s*'ticket-detail', 'conversation', 'attachment-preview'/);
  assert.match(source, /requestOverlayNestedSubstateClose\('ticket-detail', 'attachment-preview'/);
  assert.match(source, /if \(event\.key === 'Escape'\) closeTicketDetail\(\)/);
  assert.match(source, /if \(!document\.querySelector\('#attachment-preview'\)\?\.classList\.contains\('hidden'\)\)/);
});
