/**
 * Sprint 1.7.1-A: regras reais no Firestore Emulator, nunca em Firebase real.
 */
const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, setDoc, getDoc, updateDoc, deleteDoc, serverTimestamp, writeBatch } = require('firebase/firestore');

const projectId = 'demo-sinal-storage-170a';
const a = 'tenant-sprint171-a', b = 'tenant-sprint171-b';
const profiles = {
  alice:['solicitante','active',a], bob:['agente','active',a],
  carol:['supervisor','active',a], diana:['admin','active',a],
  inactive:['agente','inactive',a], blocked:['solicitante','active',a],
  mallory:['agente','active',b]
};
let env, serial=0;
const nextId = kind => kind + '_' + (++serial) + '_' + 'a'.repeat(20);
const tp = (tenant,id) => 'tenants/' + tenant + '/tickets/' + id;
const mp = (tenant,id,mid) => tp(tenant,id) + '/messages/' + mid;
const ep = (tenant,id,eid) => tp(tenant,id) + '/triageEvents/' + eid;
const database = uid => env.authenticatedContext(uid).firestore();
function opening(uid='alice',tenant=a,body='Preciso acessar o sistema') {
  const tid=nextId('ticket'), mid=nextId('message'), db=database(uid);
  const ticketRef=doc(db,tp(tenant,tid)), messageRef=doc(db,mp(tenant,tid,mid));
  const ticket={
    code:'S-'+tid.slice(0,6).toUpperCase(),title:body.split('\n')[0].slice(0,80),
    description:body,category:null,priority:null,status:'open',requesterUid:uid,
    requesterName:uid,requesterEmail:uid+'@test.invalid',createdByUid:uid,
    source:'web',assigneeUid:null,teamId:null,firstMessageId:mid,
    lastInteractionAt:serverTimestamp(),lastInteractionType:'message',
    lastInteractionByUid:uid,lastInteractionMessageId:mid,
    createdAt:serverTimestamp(),updatedAt:serverTimestamp()
  };
  const message={body,visibility:'public',authorUid:uid,authorName:uid,
    authorEmail:uid+'@test.invalid',authorRole:profiles[uid][0],
    createdAt:serverTimestamp()};
  const commit=(t={},m={}) => {
    const batch=writeBatch(db);
    batch.set(ticketRef,{...ticket,...t});batch.set(messageRef,{...message,...m});
    return batch.commit();
  };
  return {uid,tenant,tid,mid,ticketRef,messageRef,ticket,message,commit};
}
async function seedLegacy(id,details={}) {
  await env.withSecurityRulesDisabled(async ctx => {
    await setDoc(doc(ctx.firestore(),tp(a,id)),{
      code:'S-ANTIGO',title:'Problema antigo',description:'Descrição original',
      category:'rede',priority:'normal',status:'open',requesterUid:'alice',
      requesterName:'alice',requesterEmail:'alice@test.invalid',createdByUid:'alice',
      source:'web',assigneeUid:null,teamId:null,
      createdAt:serverTimestamp(),updatedAt:serverTimestamp(),...details
    });
  });
}
function triage(uid,tenant,tid,old,next,options={}) {
  const db=database(uid), eid=nextId('event');
  const ticketRef=doc(db,tp(tenant,tid)),eventRef=doc(db,ep(tenant,tid,eid));
  const type=options.type||(old.category==null && next.category!=null?'classified'
    :old.category===next.category && old.priority===next.priority?'title_changed':'reclassified');
  const event={
    type,fromTitle:old.title,toTitle:next.title,
    fromCategory:old.category,toCategory:next.category,
    fromPriority:old.priority,toPriority:next.priority,
    actorUid:uid,actorName:uid,createdAt:serverTimestamp(),...options.event
  };
  const batch=writeBatch(db);
  batch.update(ticketRef,{title:next.title,category:next.category,
    priority:next.priority,updatedAt:serverTimestamp(),
    lastTriageEventId:eid,...options.ticket});
  batch.set(eventRef,event);
  return {promise:batch.commit(),eventRef,ticketRef};
}
before(async()=>{
  assert.match(projectId,/^demo-/);
  if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8080')
    throw new Error('Firestore Emulator obrigatório; nunca executar em projeto real.');
  env=await initializeTestEnvironment({
    projectId,
    firestore:{host:'127.0.0.1',port:8080,
      rules:readFileSync(join(__dirname,'..','firestore.rules'),'utf8')}
  });
  await env.withSecurityRulesDisabled(async ctx=>{
    const db=ctx.firestore();
    for(const [uid,[role,status,tenant]] of Object.entries(profiles)){
      await setDoc(doc(db,'users',uid),{status:uid==='blocked'?'inactive':'active',
        displayName:uid,email:uid+'@test.invalid',platformRole:'user'});
      await setDoc(doc(db,'tenants',tenant,'members',uid),{status,role});
    }
  });
});
after(async()=>{if(env)await env.cleanup();});

test('ticket e mensagem inicial são criados atomicamente',async()=>{
  const o=opening();await assertSucceeds(o.commit());
  const t=(await assertSucceeds(getDoc(o.ticketRef))).data();
  const m=(await assertSucceeds(getDoc(o.messageRef))).data();
  assert.equal(t.description,m.body);assert.equal(t.firstMessageId,o.mid);
  assert.equal(t.category,null);assert.equal(t.priority,null);
  assert.equal(t.lastInteractionMessageId,o.mid);
});

test('ticket sem mensagem e primeira mensagem sem ticket são negados',async()=>{
  let o=opening();await assertFails(setDoc(o.ticketRef,o.ticket));
  o=opening();await assertFails(setDoc(o.messageRef,o.message));
});

test('divergência no texto, referência ou autoria invalida abertura',async()=>{
  await assertFails(opening().commit({description:'Outra descrição'}));
  await assertFails(opening().commit({firstMessageId:nextId('false')}));
  await assertFails(opening().commit({}, {body:'Outra mensagem'}));
  await assertFails(opening().commit({}, {authorUid:'bob'}));
  await assertFails(opening().commit({}, {authorName:'bob'}));
});

test('solicitante não define prioridade nem falsifica identidade',async()=>{
  await assertFails(opening().commit({category:'acesso',priority:'urgente'}));
  await assertFails(opening().commit({priority:'normal'}));
  await assertFails(opening().commit({requesterUid:'bob'}));
  await assertFails(opening().commit({requesterName:'bob'}));
  await assertFails(opening().commit({requesterEmail:'someone@test.invalid'}));
});

test('outro tenant e contas inativas não abrem sinal no tenant A',async()=>{
  await assertFails(opening('mallory',a).commit());
  await assertFails(opening('inactive',a).commit());
  await assertFails(opening('blocked',a).commit());
});

test('repetir o batch com mesmos IDs não sobrescreve sinal existente',async()=>{
  const o=opening();await assertSucceeds(o.commit());
  await assertFails(o.commit());
  assert.equal((await getDoc(o.ticketRef)).data().description,o.ticket.description);
});

test('agente classifica sinal sem responsável com histórico imutável',async()=>{
  const o=opening();await assertSucceeds(o.commit());
  const old=(await getDoc(o.ticketRef)).data();
  const op=triage('bob',a,o.tid,old,{...old,category:'acesso',priority:'alta'});
  await assertSucceeds(op.promise);
  const t=(await assertSucceeds(getDoc(op.ticketRef))).data();
  const e=(await assertSucceeds(getDoc(op.eventRef))).data();
  assert.equal(t.category,'acesso');assert.equal(t.priority,'alta');
  assert.equal(e.fromCategory,null);assert.equal(e.toCategory,'acesso');
  await assertFails(updateDoc(op.eventRef,{toPriority:'baixa'}));
  await assertFails(deleteDoc(op.eventRef));
});

test('edição sem evento e evento isolado são proibidos',async()=>{
  const o=opening();await assertSucceeds(o.commit());
  await assertFails(updateDoc(doc(database('bob'),tp(a,o.tid)),{
    category:'rede',priority:'normal',updatedAt:serverTimestamp()
  }));
  const old=(await getDoc(o.ticketRef)).data();
  await assertFails(setDoc(doc(database('bob'),ep(a,o.tid,nextId('event'))),{
    type:'classified',fromTitle:old.title,toTitle:old.title,
    fromCategory:null,toCategory:'rede',fromPriority:null,toPriority:'normal',
    actorUid:'bob',actorName:'bob',createdAt:serverTimestamp()
  }));
});

test('solicitante, outsider e membro inativo não classificam',async()=>{
  const o=opening();await assertSucceeds(o.commit());
  const old=(await getDoc(o.ticketRef)).data(),next={...old,category:'rede',priority:'normal'};
  await assertFails(triage('alice',a,o.tid,old,next).promise);
  await assertFails(triage('mallory',a,o.tid,old,next).promise);
  await assertFails(triage('inactive',a,o.tid,old,next).promise);
  await assertFails(updateDoc(doc(database('alice'),tp(a,o.tid)),{
    title:'Título manipulado',updatedAt:serverTimestamp()
  }));
});

test('agente não altera sinal atribuído a outro, admin pode corrigir',async()=>{
  const id=nextId('legacy');await seedLegacy(id,{assigneeUid:'carol',status:'in_progress'});
  const old=(await getDoc(doc(database('bob'),tp(a,id)))).data();
  const next={...old,category:'equipamento',priority:'alta'};
  await assertFails(triage('bob',a,id,old,next).promise);
  await assertSucceeds(triage('diana',a,id,old,next).promise);
});

test('título pode ser editado por supervisor sem modificar relato antigo',async()=>{
  const id=nextId('legacy');await seedLegacy(id);
  const old=(await getDoc(doc(database('carol'),tp(a,id)))).data();
  await assertSucceeds(triage('carol',a,id,old,{...old,title:'Título revisado'}).promise);
  const saved=(await getDoc(doc(database('carol'),tp(a,id)))).data();
  assert.equal(saved.description,'Descrição original');
  assert.equal(saved.priority,'normal');
  assert.equal(saved.title,'Título revisado');
});

test('triagem inválida, histórico forjado e remoção de classificação são negados',async()=>{
  const o=opening();await assertSucceeds(o.commit());
  const old=(await getDoc(o.ticketRef)).data();
  await assertFails(triage('bob',a,o.tid,old,{...old,category:'rede',priority:'critica'}).promise);
  await assertFails(triage('bob',a,o.tid,old,{...old,category:'rede',priority:null}).promise);
  await assertFails(triage('bob',a,o.tid,old,{...old,category:'rede',priority:'normal'},
    {event:{actorName:'outro'}}).promise);
  await assertSucceeds(triage('bob',a,o.tid,old,{...old,category:'rede',priority:'normal'}).promise);
  const updated=(await getDoc(o.ticketRef)).data();
  await assertFails(triage('bob',a,o.tid,updated,{...updated,category:null,priority:null}).promise);
});

test('sinal resolvido não pode ser classificado',async()=>{
  const id=nextId('legacy');await seedLegacy(id,{status:'resolved',assigneeUid:'bob'});
  const old=(await getDoc(doc(database('bob'),tp(a,id)))).data();
  await assertFails(triage('bob',a,id,old,{...old,priority:'alta'}).promise);
});

test('outro tenant não lê ticket, mensagem ou histórico',async()=>{
  const o=opening();await assertSucceeds(o.commit());
  await assertFails(getDoc(doc(database('mallory'),tp(a,o.tid))));
  await assertFails(getDoc(doc(database('mallory'),mp(a,o.tid,o.mid))));
  await assertFails(getDoc(doc(database('mallory'),ep(a,o.tid,nextId('event')))));
});
