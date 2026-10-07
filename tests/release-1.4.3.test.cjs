const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const root = join(__dirname, '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const html = read('index.html');
const appShell = read('js/ui/app-shell.js');
const version = read('js/config/version.js');
const firebase = read('js/config/firebase.js');
const sw = read('service-worker.js');

test('Início prioriza cards operacionais e remove o card Organização', () => {
  const home = html.split('<section id="view-home"')[1]?.split('<section id="view-')[0];
  assert.ok(home, 'Seção Início ausente');
  assert.ok(home.includes('id="ticket-count"'));
  assert.ok(home.includes('id="home-central-new-count"'));
  assert.ok(!home.includes('id="card-tenant-name"'));
  assert.ok(!home.includes('>Organização</span>'));
});
test('Mais reúne organização, perfil, ambiente e versão', () => {
  const more = html.split('<section id="view-more"')[1]?.split('</section>')[0];
  assert.ok(more);
  for (const id of ['more-tenant-name', 'more-user-role', 'more-app-environment', 'more-app-version']) {
    assert.ok(more.includes(`id="${id}"`), id);
    assert.ok(appShell.includes(`'#${id}'`), `ligação JS: ${id}`);
  }
});
test('Versão possui fonte única e é preenchida também na barra lateral', () => {
  assert.ok(version.includes("export const APP_VERSION = '1.4.3';"));
  assert.ok(html.includes('id="sidebar-app-environment"'));
  assert.ok(appShell.includes("'#sidebar-app-environment'"));
  assert.ok(appShell.includes("environment.production ? 'PRD' : 'HML'"));
  assert.ok(!html.includes('<span>HML</span><span id="sidebar-app-version"'), 'Rodapé não pode fixar o ambiente no HTML');
  assert.ok(html.includes('id="sidebar-app-version"'));
  assert.ok(appShell.includes("import { APP_VERSION } from '../config/version.js'"));
  assert.ok(appShell.includes("'#sidebar-app-version'"));
  assert.ok(appShell.includes("'#more-app-version'"));
  assert.ok(!html.includes('v1.4.3'), 'Não duplicar versão fixa no HTML');
});
test('Ambiente é obtido do Firebase HML, sem valor PRD no código', () => {
  assert.ok(appShell.includes("import { environment } from '../config/firebase.js'"));
  assert.ok(firebase.includes("name: 'HML'"));
  assert.ok(firebase.includes("projectId: 'sinaldesk-hml'"));
});
test('PWA invalida cache para a nova release sem mudar o projeto Firebase', () => {
  assert.ok(sw.includes("sinal-shell-hml-"));
  assert.ok(sw.includes("projectId: 'sinaldesk-hml'"));
});
test('Regras têm alvo HML definido explicitamente', () => {
  const config = JSON.parse(read('firebase.json'));
  assert.equal(config.firestore.rules, 'firestore.rules');
  assert.equal(config.functions.runtime, 'nodejs22');
});
test('Correção do uuid transitivo foi alinhada com PRD', () => {
  const pkg = JSON.parse(read('functions/package.json'));
  const lock = JSON.parse(read('functions/package-lock.json'));
  assert.equal(pkg.overrides.gaxios.uuid, '^11.1.1');
  assert.equal(lock.packages['node_modules/uuid'].version, '11.1.1');
});

test('As três funções usam a região sul-americana já implantada em HML', () => {
  const functions = read('functions/index.js');
  for (const name of ['notifyNewTicket', 'notifyNewMessage', 'notifyTicketStatus']) {
    const start = functions.indexOf(`exports.${name} = onDocumentCreated(`);
    assert.ok(start >= 0, `Função ausente: ${name}`);
    const options = functions.slice(start, start + 230);
    assert.ok(options.includes("region: 'southamerica-east1'"), `Região ausente: ${name}`);
  }
});
