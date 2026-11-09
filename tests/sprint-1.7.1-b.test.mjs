import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createOpeningAttemptController } from '../js/services/opening-attempt.mjs';

const from = name => readFileSync(new URL(name, import.meta.url), 'utf8');

test('tentativa de abertura reutiliza IDs na retransmissão e rejeita alteração de mensagem', () => {
  let counter = 0;
  const manager = createOpeningAttemptController(() => {
    counter += 1;
    return { ticketId: 'ticket' + counter, messageId: 'message' + counter };
  });
  const first = manager.reserve('Mensagem original', 'tenant:alice');
  assert.deepEqual(manager.reserve('Mensagem original', 'tenant:alice'), first);
  assert.equal(counter, 1);
  assert.equal(manager.hasPending(), true);
  assert.throws(() => manager.reserve('Mensagem alterada', 'tenant:alice'), /duplicidade/);
  assert.throws(() => manager.reserve('Mensagem original', 'tenant:bob'), /conta foi alterada/);
  manager.reset();
  assert.equal(manager.hasPending(), false);
  assert.equal(manager.reserve('Nova mensagem', 'tenant:alice').ticketId, 'ticket2');
});

test('abertura Modelo A tem exatamente um campo textual, sem classificação pelo solicitante', () => {
  const html = from('../index.html');
  const begin = html.indexOf('id="signal-composer"');
  const end = html.indexOf('<!-- Detail / Conversation -->', begin);
  assert.ok(begin > 0 && end > begin);
  const composer = html.slice(begin,end);
  assert.match(composer, /id="signal-message"[^>]+maxlength="4000"[^>]+minlength="3"[^>]+required/);
  assert.match(composer, /id="signal-attachment-file"/);
  assert.match(composer, /id="signal-attachment-cancel"/);
  assert.match(composer, /id="signal-submit-button"/);
  assert.doesNotMatch(composer, /id="signal-title"|id="signal-category"|id="signal-priority"|id="signal-description"/);
});

test('criação atomica precede upload e a UI abre conversa apenas após fechar o composer', () => {
  const main = from('../js/main.js');
  const ui = from('../js/ui/signal-composer.js');
  const service = from('../js/services/tickets.service.js');
  const opening = main.slice(main.indexOf('initSignalComposer({'), main.indexOf('uiInitialized = true;'));
  assert.match(opening, /createConversationTicket\(context, \{ message: payload\.message, attempt \}\)/);
  assert.match(opening, /uploadConversationAttachment\(context, ticket, file/);
  assert.ok(opening.indexOf('createConversationTicket') < opening.indexOf('uploadConversationAttachment'));
  assert.match(opening, /return \{ ticket, tenantId: context\.tenant\.id, requesterUid: context\.firebaseUser\.uid \}/);
  assert.match(opening, /openConversation\(savedTicket, \{ view: 'conversation' \}\)/);
  assert.match(opening, /getTicketById\(currentContext, ticket\.id\)/);
  assert.match(ui, /closeComposer\(true, \(\) => onCreated\?\.\(result\)\)/);
  assert.match(ui, /attempts\.reserve\(message, getSessionKey\(\)\)/);
  assert.match(service, /batch\.set\(ticketRef, payload\)/);
  assert.match(service, /batch\.set\(messageRef, firstMessage\)/);
  assert.match(service, /await batch\.commit\(\)/);
  assert.match(main, /renderTickets\(tickets, ticket => openConversation\(ticket, \{ view: 'conversation' \}\)\)/);
});

test('Android Voltar após envio não reabre formulário encerrado', async () => {
  const callbacks = new Map();
  const stack = [{state:null}], closed = [];
  let position = 0;
  globalThis.window = {
    location:{href:'https://example.test/hml/'},
    addEventListener(name, fn){callbacks.set(name,fn);}
  };
  globalThis.history = {
    get state(){return stack[position].state;},
    pushState(state){stack.splice(position+1);stack.push({state});position=stack.length-1;},
    back(){
      assert.ok(position>0);
      position-=1;
      callbacks.get('popstate')?.({state:stack[position].state});
    }
  };
  const nav = await import('data:text/javascript;charset=utf-8,' +
    encodeURIComponent(from('../js/ui/overlay-history.js')));

  nav.openOverlayHistory('composer', () => closed.push('composer'));
  assert.equal(history.state.sinalOverlay,'composer');
  nav.requestOverlayClose('composer',()=>closed.push('fallback'),()=>{
    closed.push('after-composer');
    nav.openOverlayHistory('ticket-detail',()=>closed.push('details'));
    nav.openOverlaySubstate('ticket-detail','conversation',()=>closed.push('conversation'));
  });
  assert.deepEqual(closed,['composer','after-composer']);
  assert.equal(history.state.sinalOverlaySubstate,'conversation');
  history.back();
  assert.deepEqual(closed,['composer','after-composer','conversation']);
  history.back();
  assert.deepEqual(closed,['composer','after-composer','conversation','details']);
  assert.ok(!closed.includes('fallback'));
  nav.forceOverlayClosed('ticket-detail');
});
