import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeOpeningMessage, generateSignalTitle, hasTriage,
  validateTriage, MAX_AUTO_TITLE_LENGTH, MAX_OPENING_LENGTH
} from '../js/services/opening-domain.mjs';

test('mensagem inicial: 3..4000 caracteres e conteúdo preservado', () => {
  assert.equal(normalizeOpeningMessage('  Não consigo acessar.\nOutra linha  '), 'Não consigo acessar.\nOutra linha');
  assert.equal(normalizeOpeningMessage('x'.repeat(MAX_OPENING_LENGTH)), 'x'.repeat(MAX_OPENING_LENGTH));
  for (const invalid of ['', ' ', 'ab', 'x'.repeat(MAX_OPENING_LENGTH + 1), null, undefined]) {
    assert.throws(() => normalizeOpeningMessage(invalid));
  }
});

test('título automático usa a primeira linha significativa, sem precisar de IA', () => {
  assert.equal(generateSignalTitle('Falha no login\nMais contexto aqui'), 'Falha no login');
  assert.equal(generateSignalTitle('a\nFalha no login'), 'Falha no login');
  assert.equal(generateSignalTitle('  Sistema   indisponível  '), 'Sistema indisponível');
  assert.equal(generateSignalTitle('abc'), 'abc');
});

test('títulos longos são limitados sem cortar palavras quando possível', () => {
  const source = 'Não consigo acessar o sistema de gestão desde a última atualização do setor de atendimento';
  const title = generateSignalTitle(source);
  assert.ok(title.length <= MAX_AUTO_TITLE_LENGTH);
  assert.ok(source.startsWith(title));
  assert.ok(title.length >= 3);
  assert.equal(generateSignalTitle('x'.repeat(500)).length, 80);
});

test('triagem é explicitamente pendente, nunca prioridade normal por omissão', () => {
  assert.equal(hasTriage(null, null), false);
  assert.equal(hasTriage('acesso', 'normal'), true);
  assert.equal(hasTriage('acesso', null), false);
  assert.doesNotThrow(() => validateTriage(null, null));
  assert.doesNotThrow(() => validateTriage('sistemas', 'urgente'));
  assert.throws(() => validateTriage(null, 'normal'));
  assert.throws(() => validateTriage('acesso', null));
  assert.throws(() => validateTriage('Outro aleatório', 'alta'));
  assert.throws(() => validateTriage('acesso', 'critica'));
});
