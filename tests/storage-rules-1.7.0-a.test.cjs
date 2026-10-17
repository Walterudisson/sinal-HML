const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const rules = readFileSync(join(root, 'storage.rules'), 'utf8');
const firebase = JSON.parse(readFileSync(join(root, 'firebase.json'), 'utf8'));

test('Firebase aponta para storage.rules sem substituir regras do Firestore', () => {
  assert.equal(firebase.storage.rules, 'storage.rules');
  assert.equal(firebase.firestore.rules, 'firestore.rules');
});

test('todo armazenamento não autorizado permanece bloqueado', () => {
  assert.match(rules, /match \/\{otherPaths=\*\*\}/);
  assert.match(rules, /allow read, write: if false;/);
  assert.match(rules, /allow list: if false;/);
  assert.match(rules, /allow update, delete: if false;/);
});

test('acesso se limita à organização e ao sinal com vínculo ativo', () => {
  assert.match(rules, /match \/tenants\/\{tenantId\}\/tickets\/\{ticketId\}\/attachments\/\{attachmentId\}/);
  assert.match(rules, /firestore\.get\(\/databases\/\(default\)\/documents\/tenants\/\$\(tenantId\)\/members\/\$\(request\.auth\.uid\)\)/);
  assert.match(rules, /firestore\.get\(\/databases\/\(default\)\/documents\/tenants\/\$\(tenantId\)\/tickets\/\$\(ticketId\)\)/);
  assert.match(rules, /data\.status == 'active'/);
  assert.match(rules, /data\.requesterUid == request\.auth\.uid/);
  assert.match(rules, /data\.assigneeUid == request\.auth\.uid/);
  assert.match(rules, /data\.status != 'resolved'/);
});

test('apenas dois documentos distintos consultados por avaliação', () => {
  const refs = [...rules.matchAll(/firestore\.(?:get|exists)\(\/databases\/\(default\)\/documents\/([^)]*\$\([^)]*\)[^)]*)\)/g)]
    .map(match => match[1].replace(/\$\([^)]+\)/g, '{id}'));
  assert.ok(refs.length >= 3, 'Sem verificações de vínculo/sinal');
  assert.ok(refs.every(path => path.includes('/members/') || path.includes('/tickets/')),
    'Há consultas inesperadas além do membro e do sinal');
  assert.ok(!rules.includes('/documents/users/'), 'Terceiro documento viola limite do Storage');
});

test('upload privado tem tipo, tamanho e metadados de autoria obrigatórios', () => {
  assert.match(rules, /allow get: if canReadTicket/);
  assert.match(rules, /allow create: if canUploadTicket/);
  assert.match(rules, /10 \* 1024 \* 1024/);
  for (const type of ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']) {
    assert.ok(rules.includes(type), type);
  }
  for (const field of ['tenantId', 'ticketId', 'uploadedByUid']) {
    assert.ok(rules.includes('request.resource.metadata.' + field), field);
  }
});

// Estes testes verificam invariantes textuais. NÃO substituem os testes
// de permissão reais no Emulator Suite com usuários/tenants diferentes.
