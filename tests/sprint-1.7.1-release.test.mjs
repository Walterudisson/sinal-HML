import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL(path, import.meta.url),'utf8');

test('HML identifica hotfix 1.7.1.1 sem afetar arquivo de versão de PRD',()=>{
  const version=read('../js/config/version.js');
  assert.match(version,/export const APP_VERSION = '1\.7\.1\.1';/);
  const context=read('../js/config/firebase.js');
  assert.match(context,/projectId: 'sinaldesk-hml'/);
  assert.match(context,/name: 'HML'/);
});

test('PWA mantém estratégia de cache e usa uma nova versão de shell',()=>{
  const worker=read('../service-worker.js');
  assert.match(worker,/sinal-shell-hml-1\.7\.1\.1-central-mobile/);
  assert.match(worker,/fetch\(new Request\(request, \{ cache: 'no-store' \}\)\)/);
  assert.match(worker,/self\.skipWaiting\(\)/);
  assert.match(worker,/self\.clients\.claim\(\)/);
  assert.doesNotMatch(worker,/sinal-shell-hml-1\.7\.0-c-opening-attachments-preview-back/);
});

test('Firestore da 1.7.1 exige mensagem vinculada na criação',()=>{
  const rules=read('../firestore.rules');
  assert.match(rules,/request\.resource\.data\.firstMessageId is string/);
  assert.match(rules,/getAfter\(messagePath\(tenantId, ticketId,/);
  assert.match(rules,/match \/triageEvents\/\{eventId\}/);
});
