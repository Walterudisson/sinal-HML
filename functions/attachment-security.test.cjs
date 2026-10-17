'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  typeMatchesSignature, pathFor, allowedToUpload, verifyPendingMetadata,
  verifyObjectMetadata, orphanCandidate, finalizeAttachment,
  discardPendingAttachment, cleanupOrphanAttachments
} = require('./attachment-security');

const tenantId='tenant-alpha', ticketId='ticket-abc123', attachmentId='attachment_valid_123456789';
const uid='solicitanteA';
const path=pathFor(tenantId,ticketId,attachmentId);
const pending={
  fileName:'arquivo.png',storagePath:path,contentType:'image/png',size:20,
  uploadedByUid:uid,origin:'conversation',status:'pending'
};
const meta={
  size:'20',contentType:'image/png',generation:'123',
  metadata:{tenantId,ticketId,uploadedByUid:uid}
};
const png=Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]);

test('aceita as quatro assinaturas reais e bloqueia conteúdo incompatível',()=>{
  assert.equal(typeMatchesSignature('image/png',png),true);
  assert.equal(typeMatchesSignature('image/jpeg',Buffer.from([255,216,255,224])),true);
  assert.equal(typeMatchesSignature('image/webp',Buffer.from('RIFF0000WEBP','ascii')),true);
  assert.equal(typeMatchesSignature('application/pdf',Buffer.from('%PDF-1.7')),true);
  assert.equal(typeMatchesSignature('image/png',Buffer.from('%PDF-1.7')),false);
  assert.equal(typeMatchesSignature('image/svg+xml',png),false);
  assert.equal(typeMatchesSignature('image/png',Buffer.alloc(0)),false);
});

test('IDs não permitem caminhos arbitrários, nem arquivos fora do ticket',()=>{
  assert.throws(()=>pathFor('../tenant',ticketId,attachmentId),/invalid-argument/);
  assert.throws(()=>pathFor(tenantId,ticketId,'a'),/invalid-argument/);
  assert.equal(path,'tenants/tenant-alpha/tickets/ticket-abc123/attachments/attachment_valid_123456789');
  assert.equal(verifyPendingMetadata({...pending,storagePath:'tenants/else'},uid,path),false);
});

test('permissão exige usuário, tenant e membro ativos e atribuição',()=>{
  const user={status:'active'},tenant={status:'active'};
  const requester={status:'active',role:'solicitante'};
  const agent={status:'active',role:'agente'};
  const ticket={status:'open',requesterUid:uid,assigneeUid:'agente1'};
  assert.equal(allowedToUpload(uid,user,tenant,requester,ticket),true);
  assert.equal(allowedToUpload('agente1',user,tenant,agent,ticket),true);
  assert.equal(allowedToUpload('outro',user,tenant,agent,ticket),false);
  assert.equal(allowedToUpload(uid,user,tenant,requester,{...ticket,status:'resolved'}),false);
  assert.equal(allowedToUpload(uid,{status:'inactive'},tenant,requester,ticket),false);
  assert.equal(allowedToUpload(uid,user,{status:'inactive'},requester,ticket),false);
  assert.equal(allowedToUpload(uid,user,tenant,{...requester,status:'inactive'},ticket),false);
});

test('metadados devem corresponder ao objeto sem confiar na extensão',()=>{
  assert.equal(verifyPendingMetadata(pending,uid,path),true);
  assert.equal(verifyPendingMetadata({...pending,size:11*1024*1024},uid,path),false);
  assert.equal(verifyPendingMetadata({...pending,status:'ready'},uid,path),false);
  assert.equal(verifyPendingMetadata({...pending,contentType:'text/html'},uid,path),false);
  assert.equal(verifyObjectMetadata(meta,pending,tenantId,ticketId,uid),true);
  assert.equal(verifyObjectMetadata({...meta,size:'19'},pending,tenantId,ticketId,uid),false);
  assert.equal(verifyObjectMetadata({...meta,metadata:{...meta.metadata,tenantId:'tenant-bravo'}},pending,tenantId,ticketId,uid),false);
});

function fakeDatabase(initial={}) {
  const defaults={
    ['users/'+uid]:{status:'active'},
    ['tenants/'+tenantId]:{status:'active'},
    ['tenants/'+tenantId+'/members/'+uid]:{status:'active',role:'solicitante'},
    ['tenants/'+tenantId+'/tickets/'+ticketId]:{status:'open',requesterUid:uid,assigneeUid:null},
    [path]:{...pending}
  };
  const values={...defaults,...initial};
  let writes=0;
  return {
    doc(key){
      const ref={path:key};
      ref.get=async()=>({exists:values[key]!=null,data:()=>values[key]});
      ref.set=async data=>{values[key]=data;};
      return ref;
    },
    async runTransaction(callback){
      const changes=[];
      const result=await callback({
        get:ref=>Promise.resolve({exists:values[ref.path]!=null,data:()=>values[ref.path]}),
        update:(ref,data)=>changes.push([ref.path,data]),
        create:(ref,data)=>{if(values[ref.path])throw new Error('already-exists');changes.push([ref.path,data]);}
      });
      for(const [key,value] of changes){values[key]={...values[key],...value};writes++;}
      return result;
    },
    get values(){return values;},
    get writes(){return writes;}
  };
}
function fakeBucket(customMeta=meta,bytes=png){
  return {file:()=>({
    getMetadata:async()=>[customMeta],
    download:async()=>[bytes]
  })};
}
const request=(db,bucket=fakeBucket())=>({db,bucket,uid,tenantId,ticketId,attachmentId});

test('confirma anexo válido somente no servidor e permite retry idempotente',async()=>{
  const db=fakeDatabase();
  assert.deepEqual(await finalizeAttachment(request(db)),{status:'ready',attachmentId});
  assert.equal(db.values[path].status,'ready');
  assert.equal(db.values[path].storageGeneration,'123');
  assert.equal(db.writes,1);
  assert.deepEqual(await finalizeAttachment(request(db)),{status:'ready',attachmentId});
  assert.equal(db.writes,1);
});

test('nega arquivo de outro tenant, bytes adulterados e conta revogada',async()=>{
  const cases=[
    [fakeDatabase(),fakeBucket({...meta,metadata:{...meta.metadata,tenantId:'outro'}})],
    [fakeDatabase(),fakeBucket(meta,Buffer.from('<svg></svg>'))],
    [fakeDatabase({['users/'+uid]:{status:'inactive'}}),fakeBucket()]
  ];
  for(const [db,bucket] of cases){
    await assert.rejects(finalizeAttachment(request(db,bucket)));
    assert.equal(db.values[path].status,'pending');
    assert.equal(db.writes,0);
  }
});

test('revalida o ticket na transação para impedir corrida de resolução',async()=>{
  const db=fakeDatabase();
  const original=db.runTransaction.bind(db);
  db.runTransaction=async fn=>{
    db.values['tenants/'+tenantId+'/tickets/'+ticketId].status='resolved';
    return original(fn);
  };
  await assert.rejects(finalizeAttachment(request(db)),/permission-denied/);
  assert.equal(db.values[path].status,'pending');
});

test('limpeza considera somente objetos antigos em caminho de anexo',()=>{
  const now=Date.parse('2026-10-17T20:00:00Z');
  const old=new Date(now-25*3600_000).toISOString();
  const fresh=new Date(now-12*3600_000).toISOString();
  assert.deepEqual(orphanCandidate({name:path,metadata:{timeCreated:old}},now),
    {tenantId,ticketId,attachmentId});
  assert.equal(orphanCandidate({name:path,metadata:{timeCreated:fresh}},now),null);
  assert.equal(orphanCandidate({name:'else/'+path,metadata:{timeCreated:old}},now),null);
});


test('descarta upload pendente e cria proteção de exclusão contra corrida',async()=>{
  const db=fakeDatabase();
  let deleted=0;
  const bucket={file:()=>({
    getMetadata:async()=>[meta],
    delete:async()=>{deleted++;}
  })};
  assert.deepEqual(await discardPendingAttachment(request(db,bucket)),{status:'discarded'});
  assert.equal(db.values[path].status,'failed');
  assert.equal(deleted,1);
  await assert.rejects(finalizeAttachment(request(db,fakeBucket())),/failed-precondition/);

  const missing=fakeDatabase({[path]:null});
  await discardPendingAttachment(request(missing,bucket));
  assert.equal(missing.values[path].status,'failed');
  assert.equal(deleted,2);
});

test('não descarta arquivo confirmado nem de outro remetente',async()=>{
  const ready=fakeDatabase({[path]:{...pending,status:'ready'}});
  const wrong=fakeDatabase({[path]:{...pending,uploadedByUid:'outro'}});
  await assert.rejects(discardPendingAttachment(request(ready,fakeBucket())),/permission-denied/);
  await assert.rejects(discardPendingAttachment(request(wrong,fakeBucket())),/permission-denied/);
});

test('limpeza paginada mantém ready e elimina órfãos e pendentes antigos',async()=>{
  const now=Date.parse('2026-10-17T20:00:00Z');
  const expiredTime=new Date(now-30*3600_000).toISOString();
  const readyId='attachment_ready_123456789';
  const orphanId='attachment_orphan_123456789';
  const readyPath=pathFor(tenantId,ticketId,readyId);
  const orphanPath=pathFor(tenantId,ticketId,orphanId);
  const db=fakeDatabase({
    [readyPath]:{...pending,storagePath:readyPath,status:'ready'},
    [orphanPath]:null
  });
  const deleted=[];
  const files=[path,readyPath,orphanPath].map(name=>({
    name,metadata:{timeCreated:expiredTime,generation:'123',metadata:{uploadedByUid:uid}},
    delete:async()=>{deleted.push(name);}
  }));
  const bucket={getFiles:async()=>[files,null]};
  assert.deepEqual(await cleanupOrphanAttachments({db,bucket,now}),
    {inspected:3,removed:2});
  assert.deepEqual(deleted.sort(),[path,orphanPath].sort());
  assert.equal(db.values[path].status,'failed');
  assert.equal(db.values[readyPath].status,'ready');
  assert.equal(db.values[orphanPath].status,'failed');
  assert.equal(db.values['maintenance/attachmentCleanup'].removed,2);
});
