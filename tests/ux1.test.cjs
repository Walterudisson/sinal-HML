const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const root = join(__dirname, '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const css = readFileSync(join(root, 'css/app.css'), 'utf8');
const serviceWorker = readFileSync(join(root, 'service-worker.js'), 'utf8');
const ui = readFileSync(join(root, 'js/ui/ticket-detail.js'), 'utf8');
const overlayCode = readFileSync(join(root, 'js/ui/overlay-history.js'), 'utf8');

function section(start, finish) {
  return html.slice(html.indexOf(start), html.indexOf(finish, html.indexOf(start)));
}

test('três telas independentes e controles não duplicados', () => {
  for (const id of ['ticket-details-view', 'ticket-conversation-view', 'ticket-resolution-view',
    'ticket-detail-scroll', 'conversation-scroll', 'resolution-scroll', 'resolve-submit',
    'resolve-cancel', 'message-form', 'conversation-list']) {
    assert.equal(html.split('id="' + id + '"').length - 1, 1, id);
  }
  const detail = section('id="ticket-details-view"', 'id="ticket-conversation-view"');
  const conversation = section('id="ticket-conversation-view"', 'id="ticket-resolution-view"');
  const resolution = section('id="ticket-resolution-view"', '    <div id="toast-container"');
  assert.match(detail, /id="open-conversation-button"/);
  assert.doesNotMatch(detail, /id="message-body"|id="resolution-internal"/);
  assert.match(conversation, /id="message-body"/);
  assert.doesNotMatch(conversation, /id="resolution-internal"/);
  assert.match(resolution, /id="resolution-internal"/);
  assert.match(resolution, /id="resolve-submit"[^>]*form="resolve-form"/);
  assert.doesNotMatch(resolution, /id="message-body"/);
});

test('mudar de modo mostra somente a tela pertinente', () => {
  const elements = new Map();
  function item(id) {
    const el = {
      tagName: 'DIV',
      hidden: false,
      attrs: {},
      classList: {
        values: new Set(),
        toggle(name, toggle) {
          if (toggle) this.values.add(name);
          else this.values.delete(name);
        },
        contains(name) { return this.values.has(name); }
      },
      setAttribute(k, v) { this.attrs[k] = v; },
      textContent: ''
    };
    elements.set(id, el);
    return el;
  }
  ['ticket-details-view','ticket-conversation-view','ticket-resolution-view',
    'ticket-view-back','ticket-view-label','panel'].forEach(item);
  const close = item('close');
  close.tagName = 'BUTTON';
  const document = {
    getElementById: id => elements.get(id),
    querySelector: selector => elements.get(selector === '#ticket-detail .ticket-detail-panel' ? 'panel' : selector.slice(1)),
    querySelectorAll: () => [close]
  };
  const source = ui.slice(ui.indexOf('function setTicketView(view) {'), ui.indexOf('function goToDetails()'));
  const setTicketView = new Function('document', source + ';return setTicketView;')(document);
  for (const view of ['details','conversation','resolution','details']) {
    setTicketView(view);
    for (const id of ['details','conversation','resolution']) {
      assert.equal(elements.get('ticket-'+id+'-view').classList.contains('hidden'), id !== view, id + ' vs ' + view);
    }
    assert.equal(elements.get('ticket-view-back').classList.contains('hidden'), view === 'details');
    assert.equal(close.classList.contains('hidden'), view !== 'details');
  }
});

test('voltar de subtela preserva o overlay, voltar novamente fecha o sinal', () => {
  const listeners = {};
  const window = { location: { href: 'https://example.test/#ticket=sample' },
    addEventListener: (name, fn) => { listeners[name] = fn; } };
  const states = [{ base: true }];
  const history = {
    get state() { return states.at(-1); },
    pushState(value) { states.push(value); },
    back() { states.pop(); listeners.popstate(); }
  };
  const source = overlayCode.replaceAll('export function', 'function');
  const nav = new Function('window', 'history', source +
    ';return {openOverlayHistory,requestOverlayClose,openOverlaySubstate,requestOverlaySubstateClose}')(window, history);
  let rootClosed = 0, childClosed = 0;
  nav.openOverlayHistory('ticket-detail', () => rootClosed++);
  assert.equal(nav.openOverlaySubstate('ticket-detail','conversation',()=>childClosed++), true);
  nav.requestOverlaySubstateClose('ticket-detail','conversation');
  assert.equal(childClosed, 1);
  assert.equal(rootClosed, 0);
  assert.equal(states.length, 2);
  nav.requestOverlayClose('ticket-detail');
  assert.equal(rootClosed, 1);
  assert.equal(states.length, 1);
});

test('a conversa permanece pública nesta etapa e não altera as regras', () => {
  assert.match(ui, /activeView !== 'conversation'/);
  assert.match(ui, /#conversation-scroll/);
  assert.match(html, /Canal público: mensagens entre solicitante e atendimento/);
  assert.match(html, /Compartilhar uma mensagem de solução com o solicitante/);
});

test('painel mobile usa altura definida e rolagem própria para detalhes completos', () => {
  const panelStart = html.indexOf('<section class="ticket-detail-panel');
  assert.ok(panelStart >= 0, 'painel de detalhes presente');
  const panelEnd = html.indexOf('role="dialog"', panelStart);
  assert.ok(panelEnd > panelStart, 'fim da abertura do modal de detalhes presente');
  const panel = html.slice(panelStart, panelEnd);
  assert.ok(panel.includes('h-[96dvh] max-h-[96dvh]'), 'altura definida no mobile');
  assert.ok(panel.includes('sm:h-[min(90dvh,760px)]'), 'desktop preserva altura anterior');
  assert.ok(html.includes('id="ticket-details-view" class="min-h-0 flex-1 overflow-hidden"'));
  assert.ok(html.includes('class="h-full min-h-0 overflow-y-auto" id="ticket-detail-scroll"'));
  assert.ok(css.includes('overscroll-behavior-y: contain'));
  assert.ok(serviceWorker.includes('sinal-shell-hml-1.4.3'));
});
