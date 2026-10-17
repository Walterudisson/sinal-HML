const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const read = path => readFileSync(join(__dirname, '..', path), 'utf8');
const version = read('js/config/version.js');
const sw = read('service-worker.js');
const central = read('js/ui/central.js');
const home = read('js/ui/home.js');
const main = read('js/main.js');
const pwa = read('js/services/pwa.service.js');
const firebase = read('js/config/firebase.js');

function between(src, first, second) {
  const start = src.indexOf(first);
  const end = src.indexOf(second, start + first.length);
  assert.ok(start >= 0 && end > start, 'Trecho esperado ausente: ' + first);
  return src.slice(start, end);
}

test('identidade HML v1.6.3 e cache renovado', () => {
  assert.match(version, /APP_VERSION = '1\.6\.3'/);
  assert.match(sw, /sinal-shell-hml-1\.6\.3-stability/);
  assert.match(firebase, /projectId: 'sinaldesk-hml'/);
  assert.match(sw, /projectId: 'sinaldesk-hml'/);
  assert.doesNotMatch(sw, /projectId: 'sinaldesk'[,\s]/);
});

test('filtros da Central não quebram quando sessionStorage falha', () => {
  const source = between(central, 'function persistCentralState()', 'function restoreCentralState()');
  const mockedStorage = { setItem() { throw new Error('Armazenamento bloqueado'); } };
  const persist = new Function('sessionStorage',
    "const currentContext={ tenant:{id:'t'}, firebaseUser:{uid:'u'} };\n" +
    "function centralStateKey(){return 'sinal:central:t:u';}\n" +
    "let currentFilter='new',currentPriority='all',currentCategory='all',currentSort='priority',currentSearch='';\n" +
    source + '\nreturn persistCentralState;'
  )(mockedStorage);
  assert.doesNotThrow(persist);
});

test('Central zera dados da sessão anterior a cada troca de contexto', () => {
  const source = between(central, 'export function setCentralContext(context)', 'export function updateCentralTickets')
    .replace('export function', 'function');
  const harness = new Function(
    "let currentContext=null,tickets=[{id:'privado'}],unreadMessageTicketIds=new Set(['privado'])," +
    "currentFilter='mine',currentPriority='alta',currentCategory='rede',currentSort='activity'," +
    "currentSearch='privado',stateRestored=true;\n" +
    "let restored=0;function restoreCentralState(){restored++;}function renderCentral(){};\n" +
    source + '\nreturn {run:setCentralContext,snapshot:()=>({currentContext,tickets,unreadMessageTicketIds,' +
    'currentFilter,currentPriority,currentCategory,currentSort,currentSearch,stateRestored,restored})};'
  )();
  const next = { tenant: { id: 'outro' }, firebaseUser: { uid: 'B' } };
  harness.run(next);
  const state = harness.snapshot();
  assert.equal(state.currentContext, next);
  assert.deepEqual(state.tickets, []);
  assert.equal(state.unreadMessageTicketIds.size, 0);
  assert.equal(state.currentFilter, 'new');
  assert.equal(state.currentSearch, '');
  assert.equal(state.stateRestored, false);
  assert.equal(state.restored, 1);
});

test('Início, avisos e Central são esvaziados na nova sessão', () => {
  assert.match(between(home, 'export function initHome(options)', 'export function updateHomeMyTickets'), /myTickets = \[\];[\s\S]*centralTickets = \[\];[\s\S]*notifications = \[\];/);
  assert.match(main, /function ensureCentralInitialized\(context\)[\s\S]*setCentralContext\(context\)/);
  assert.match(between(main, 'function stopObservers()', 'function renderSignedOut()'), /renderNotifications\(\[\], \[\], showToast\)/);
  assert.match(main, /resetNotificationsUiSession\(\)/);
});

test('assumir sinal reverte o estado visual mesmo após falha', () => {
  const action = between(home, "document.querySelectorAll('[data-home-claim]')", '\n}\n\nfunction priorityRank');
  assert.match(action, /catch \(_\)/);
  assert.match(action, /button\.disabled = false/);
  assert.match(action, /button\.textContent = originalText/);
});

test('atualização PWA tolera armazenamento restrito', () => {
  assert.match(pwa, /alreadyReloaded = sessionStorage\.getItem\(reloadKey\)/);
  assert.match(pwa, /try \{ sessionStorage\.setItem\(reloadKey, '1'\); \} catch/);
  assert.match(pwa, /try \{ sessionStorage\.removeItem\(reloadKey\); \} catch/);
});
