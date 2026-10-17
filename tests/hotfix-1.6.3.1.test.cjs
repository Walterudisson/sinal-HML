const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const read = path => readFileSync(join(__dirname, '..', path), 'utf8');
const detail = read('js/ui/ticket-detail.js');
const notifications = read('js/ui/notifications.js');
const main = read('js/main.js');
const version = read('js/config/version.js');
const worker = read('service-worker.js');

function between(src, first, last) {
  const a = src.indexOf(first);
  const b = src.indexOf(last, a + first.length);
  assert.ok(a >= 0 && b > a, 'Delimitadores ausentes: ' + first);
  return src.slice(a, b);
}

function makeDetailHarness() {
  const source = between(detail, 'export function isConversationVisible(ticketId)', 'function setTicketView(view)')
    .replace('export function', 'function');
  let visibility = 'visible';
  let overlayHidden = false;
  const document = {
    get visibilityState() { return visibility; },
    querySelector: () => ({ classList: { contains: name => name === 'hidden' && overlayHidden } })
  };
  const app = new Function('document', [
    'let selectedTicket=null, activeView="details";',
    source,
    'return {check:isConversationVisible,set:(id,view)=>{selectedTicket={id};activeView=view;}};'
  ].join('\n'))(document);
  return { ...app, visibility: value => { visibility = value; }, hidden: value => { overlayHidden = value; } };
}

function makeNotificationsHarness() {
  const source = [
    between(notifications, 'function isMessageAlreadyVisible(item)', 'export function resetNotificationsUiSession()'),
    between(notifications, 'export function renderNotifications(nextItems, changes, showToast)', 'function markup(item)')
  ].join('\n').replaceAll('export function', 'function');

  const cells = new Map();
  const element = id => {
    if (!cells.has(id)) cells.set(id, {
      textContent: '', innerHTML: '', classList: { toggle() {} },
      querySelectorAll: () => []
    });
    return cells.get(id);
  };
  const document = { querySelector: element };
  let foregroundTicket = null;
  let attempts = [];
  const app = new Function('document', 'navigator', 'console', [
    'let items=[], initialSnapshotSeen=false;',
    'const readInFlight=new Set();',
    'let onMarkRead=(id)=>{attempts.push(id); return Promise.resolve();};',
    'let isConversationVisible=(id)=>id===foregroundTicket;',
    'let foregroundTicket=null, attempts=[];',
    'function markup(){return "";}', source,
    'return {render:renderNotifications, read:markVisibleConversationNotifications,',
    'setTicket:(id)=>{foregroundTicket=id;}, attempts:()=>attempts, reset:()=>{attempts=[]}};'
  ].join('\n'))(document, {}, console);
  return app;
}

test('v1.6.3.1 e cache HML distinguíveis', () => {
  assert.match(version, /APP_VERSION = '1\.6\.3\.1'/);
  assert.match(worker, /sinal-shell-hml-1\.6\.3\.1-conversation-notifications/);
  assert.match(worker, /projectId: 'sinaldesk-hml'/);
});

test('somente a conversa do sinal exibido e em primeiro plano é considerada visível', () => {
  const h = makeDetailHarness();
  h.set('A', 'conversation');
  assert.equal(h.check('A'), true);
  assert.equal(h.check('B'), false);
  h.set('A', 'details');
  assert.equal(h.check('A'), false);
  h.set('A', 'conversation');
  h.visibility('hidden');
  assert.equal(h.check('A'), false);
  h.visibility('visible');
  h.hidden(true);
  assert.equal(h.check('A'), false);
});

test('toast silencioso na conversa aberta, mas disponível para outro sinal', () => {
  const h = makeNotificationsHarness();
  let toasts = [];
  const showToast = (...args) => toasts.push(args);
  h.render([], [], showToast); // snapshot inicial não gera toast
  h.setTicket('A');
  const a = { id:'n1', ticketId:'A', type:'new_message', isRead:false };
  h.render([a], [{type:'added', doc:{id:'n1', data:()=>a}}], showToast);
  assert.equal(toasts.length, 0);
  assert.deepEqual(h.attempts(), ['n1']);
  const b = { id:'n2', ticketId:'B', type:'new_message', isRead:false };
  h.render([a,b], [{type:'added', doc:{id:'n2', data:()=>b}}], showToast);
  assert.equal(toasts.length, 1);
});

test('avisos anteriores também podem ser lidos ao entrar numa conversa', () => {
  const h = makeNotificationsHarness();
  h.render([], [], () => {});
  h.setTicket(null);
  const a = { id:'n3', ticketId:'A', type:'new_message', isRead:false };
  h.render([a], [], () => {});
  assert.deepEqual(h.attempts(), []);
  h.setTicket('A');
  h.read();
  h.read();
  assert.deepEqual(h.attempts(), ['n3'], 'não grava duas vezes durante leitura pendente');
});

test('integração marca avisos ao entrar na conversa e ao retomar o aplicativo', () => {
  assert.match(detail, /onConversationVisible\?\.\(\)/);
  assert.match(main, /onConversationVisible: markVisibleConversationNotifications/);
  assert.match(main, /isConversationVisible\s*\n/);
  assert.match(main, /visibilitychange[\s\S]*markVisibleConversationNotifications\(\)/);
  assert.doesNotMatch(main, /currentNotifications/);
});