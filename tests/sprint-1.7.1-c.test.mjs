import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  pendingTriage, canTriageTicket, needsQueueAttention, queuePriorityScore,
  matchesQueueFilter, matchesQueueProperty, describeTriageEvent
} from '../js/services/triage-domain.mjs';

const source = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const mk = (overrides={}) => ({
  id:'sinal1',status:'open',assigneeUid:null,category:null,priority:null,title:'Falha de acesso',...overrides
});
const context = (role,uid='bob') => ({membership:{role},firebaseUser:{uid}});

test('filtragem: Sem triagem não se mistura com Normal nem omite sinais em atendimento',()=>{
  const open=mk(),assigned=mk({status:'in_progress',assigneeUid:'bob'});
  const resolved=mk({status:'resolved'});
  const normal=mk({priority:'normal',category:'acesso'});
  assert.equal(pendingTriage(open),true);
  assert.equal(pendingTriage(normal),false);
  assert.equal(matchesQueueFilter(open,'triage','bob'),true);
  assert.equal(matchesQueueFilter(assigned,'triage','bob'),true);
  assert.equal(matchesQueueFilter(resolved,'triage','bob'),false);
  assert.equal(matchesQueueFilter(normal,'triage','bob'),false);
  assert.equal(matchesQueueProperty(null,'pending'),true);
  assert.equal(matchesQueueProperty('normal','pending'),false);
  assert.equal(matchesQueueProperty(null,'normal'),false);
  assert.equal(matchesQueueProperty('rede','rede'),true);
});

test('sinais sem triagem recebem atenção, sem prioridade baixa/normal inventada',()=>{
  assert.equal(needsQueueAttention(mk()),true);
  assert.equal(needsQueueAttention(mk({status:'in_progress'})),false);
  assert.equal(needsQueueAttention(mk({priority:'urgente',category:'rede'})),true);
  assert.equal(needsQueueAttention(mk({priority:'alta',category:'rede'})),true);
  assert.equal(needsQueueAttention(mk({priority:'baixa',category:'rede'})),false);
  assert.equal(queuePriorityScore(mk({priority:'urgente',category:'rede'})),5);
  assert.equal(queuePriorityScore(mk({priority:'alta',category:'rede'})),4);
  assert.equal(queuePriorityScore(mk()),3);
  assert.equal(queuePriorityScore(mk({priority:'normal',category:'rede'})),2);
});

test('classificação obedece ao papel, responsável e estado de resolução',()=>{
  assert.equal(canTriageTicket(context('solicitante'),mk()),false);
  assert.equal(canTriageTicket(context('agente'),mk()),true);
  assert.equal(canTriageTicket(context('agente'),mk({assigneeUid:'carol'})),false);
  assert.equal(canTriageTicket(context('agente'),mk({assigneeUid:'bob'})),true);
  assert.equal(canTriageTicket(context('supervisor'),mk({assigneeUid:'carol'})),true);
  assert.equal(canTriageTicket(context('admin'),mk({assigneeUid:'carol'})),true);
  assert.equal(canTriageTicket(context('admin'),mk({status:'resolved'})),false);
  assert.equal(canTriageTicket(null,mk()),false);
});

test('histórico da triagem informa valores anteriores e novos, sem ocultar mudanças',()=>{
  const event={type:'classified',fromTitle:'Erro',toTitle:'Falha no login',
    fromCategory:null,toCategory:'acesso',fromPriority:null,toPriority:'alta'};
  const text=describeTriageEvent(event,{acesso:'Acesso'},{alta:'Alta'});
  assert.match(text,/Título: Erro → Falha no login/);
  assert.match(text,/Categoria: Não definida → Acesso/);
  assert.match(text,/Prioridade: Não definida → Alta/);
});

test('Central possui filtro, contador, ordem e ação classificar',()=>{
  const central=source('../js/ui/central.js'),html=source('../index.html');
  assert.match(central,/filterCopy[\s\S]*triage:/);
  assert.match(central,/tickets\.filter\(\(t\) => t\.status !== 'resolved' && pendingTriage\(t\)\)/);
  assert.match(central,/matchesQueueProperty\(ticket\.priority, currentPriority\)/);
  assert.match(central,/matchesQueueFilter\(ticket, currentFilter, uid\)/);
  assert.match(central,/queuePriorityScore\(b\) - queuePriorityScore\(a\)/);
  assert.match(central,/data-triage-ticket/);
  assert.match(central,/onOpenTicket\?\.\(ticket, \{ focusTriage: true \}\)/);
  assert.match(html,/data-central-filter="triage"/);
  assert.match(html,/id="central-triage-count"/);
  assert.match(html,/id="central-priority"[\s\S]*?<option value="pending">Não definida<\/option>/);
  assert.match(html,/id="central-category"[\s\S]*?<option value="pending">Não definida<\/option>/);
});

test('painel de triagem não integra a conversa e não fica disponível ao solicitante',()=>{
  const detail=source('../js/ui/ticket-detail.js'),html=source('../index.html');
  const main=source('../js/main.js');
  assert.match(html,/id="detail-triage-form"/);
  assert.match(html,/id="detail-triage-title-input"/);
  assert.match(html,/id="detail-triage-category"/);
  assert.match(html,/id="detail-triage-priority"/);
  assert.match(html,/id="detail-triage-history"/);
  assert.match(detail,/panel\.classList\.toggle\('hidden', !support\)/);
  assert.match(detail,/canTriageTicket\(currentContext, ticket\)/);
  assert.match(detail,/options\.focusTriage && canTriageTicket\(currentContext, ticket\)/);
  assert.match(detail,/unsubscribeTriageEvents\?\.\(\)/);
  assert.match(detail,/onObserveTriageEvents\?\.\(/);
  assert.match(detail,/await onSaveTriage\?\.\(originalTicket, \{ title, category, priority \}\)/);
  assert.match(main,/updateTicketTriage\(currentContext, ticket, changes\)/);
  assert.match(main,/observeTriageEvents\(currentContext, ticketId, onData, onError\)/);
  const input=html.indexOf('id="detail-triage-form"');
  const conversation=html.indexOf('id="ticket-conversation-view"');
  assert.ok(input>0 && input<conversation);
});

test('classificação é transacional, auditável e não sobrescreve o estado anterior',()=>{
  const service=source('../js/services/tickets.service.js'),rules=source('../firestore.rules');
  assert.match(service,/await runTransaction\(db, async transaction =>/);
  assert.match(service,/const stale = \['title','category','priority','assigneeUid','status'\]/);
  assert.match(service,/transaction\.set\(eventRef, \{/);
  assert.match(rules,/match \/triageEvents\/\{eventId\}/);
  assert.match(rules,/allow update, delete: if false;/);
});

test('a tela Início também destaca novos sinais sem triagem e não inventa prioridade',()=>{
  const home=source('../js/ui/home.js');
  assert.match(home,/\.filter\(needsQueueAttention\)/);
  assert.match(home,/queuePriorityScore\(b\) - queuePriorityScore\(a\)/);
  assert.match(home,/ticket\.priority \?\? 'Sem triagem'/);
  assert.doesNotMatch(home,/priorityLabels\[ticket\.priority\] \?\? ticket\.priority \?\? 'Normal'/);
});


test('hotfix 1.7.1.1: Central usa só uma badge Sem triagem e separa ações no mobile', () => {
  const central=source('../js/ui/central.js'),css=source('../css/app.css');
  const markup=central.slice(central.indexOf('function markup(ticket)'));
  assert.match(markup,/const triagePending = pendingTriage\(ticket\);/);
  assert.match(markup,/const priorityBadge = triagePending[\s\S]*?Sem triagem[\s\S]*?priorityClass/);
  assert.match(markup,/\$\{priorityBadge\}/);
  assert.doesNotMatch(markup,/\$\{pendingTriage\(ticket\) \? '<span class="ticket-badge/);
  assert.match(markup,/class="central-ticket-actions /);
  assert.match(css,/@media \(max-width: 639px\) \{[\s\S]*?\.central-ticket \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(css,/\.central-ticket-actions \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
});
