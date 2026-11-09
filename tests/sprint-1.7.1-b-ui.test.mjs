import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeOpeningMessage } from '../js/services/opening-domain.mjs';
import { createOpeningAttemptController } from '../js/services/opening-attempt.mjs';

const source = readFileSync(new URL('../js/ui/signal-composer.js', import.meta.url),'utf8');
const begin = source.indexOf('export function initSignalComposer(');
const end = source.indexOf('\nfunction formatDate(', begin);
assert.ok(begin > 0 && end > begin);

const factory = new Function(
  'document','window','navigator','openOverlayHistory','requestOverlayClose',
  'validateAttachment','normalizeOpeningMessage','createOpeningAttemptController','lastFocusedElement',
  source.slice(begin,end).replace('export function initSignalComposer(', 'function initSignalComposer(')
    + '\nreturn initSignalComposer;'
);

function mockClassList(initial=[]) {
  const data=new Set(initial);
  return {
    contains(name){return data.has(name);},
    add(name){data.add(name);},
    remove(name){data.delete(name);},
    toggle(name,force){
      if(force===undefined)force=!data.has(name);
      if(force)data.add(name);
      else data.delete(name);
      return force;
    }
  };
}
function harness({onSubmit, prepareAttempt, onCreated}) {
  const ids=[
    'signal-composer','signal-form','signal-message','signal-message-count',
    'signal-submit-button','signal-submit-label','signal-submit-spinner',
    'signal-form-error','signal-attachment-file','signal-attachment-choose',
    'signal-attachment-remove','signal-attachment-name',
    'signal-attachment-upload-status','signal-attachment-upload-progress',
    'signal-attachment-progress-label','signal-attachment-cancel'
  ];
  const nodes=Object.fromEntries(ids.map(id=>{
    const handlers=new Map();
    return [id,{
      id,value:'',textContent:'',disabled:false,files:[],
      classList:mockClassList(['signal-composer','signal-submit-spinner','signal-form-error',
        'signal-attachment-remove','signal-attachment-upload-status'].includes(id)?['hidden']:[]),
      addEventListener(name,fn){handlers.set(name,fn);},
      fire(name,event={}){return handlers.get(name)?.(event);},
      focus(){doc.activeElement=this;},
      setAttribute(){},reportValidity(){return true;},
      reset(){nodes['signal-message'].value='';}
    }];
  }));
  const openButton={disabled:false,addEventListener(name,fn){this.handler=fn;},fire(){return this.handler?.();}};
  const closeButton={disabled:false,addEventListener(name,fn){this.handler=fn;},fire(){return this.handler?.();}};
  const doc={
    activeElement:{focus(){}},
    body:{classList:mockClassList()},
    querySelector(sel){return nodes[sel.slice(1)];},
    querySelectorAll(sel){
      if(sel==='[data-open-signal-composer]')return [openButton];
      if(sel==='[data-close-signal-composer]')return [closeButton];
      return [];
    }
  };
  const events=[];
  let browserOnClose=null;
  const win={
    addEventListener(){},
    setTimeout(){return 1;},
    clearTimeout(){}
  };
  const init=factory(doc,win,{onLine:true},
    (name,fn)=>{events.push('open:'+name);browserOnClose=fn;},
    (name,fallback,after)=>{events.push('close:'+name);fallback();after?.();},
    ()=>{},normalizeOpeningMessage,createOpeningAttemptController,null
  );
  const ui=init({
    onSubmit,prepareAttempt,
    onCreated:data=>{events.push('created');onCreated?.(data);},
    getSessionKey:()=> 'tenant:alice'
  });
  return {
    ui,nodes,events,openButton,
    async submit(){
      return nodes['signal-form'].fire('submit',{preventDefault(){}});
    },
    androidBack(){browserOnClose?.();}
  };
}

test('retry mantém IDs após erro, preserva texto e só abre a conversa depois de fechar composer',async()=>{
  let ids=0,calls=0;
  const result={ticket:{id:'ticket123',code:'S-123'},tenantId:'tenant',requesterUid:'alice'};
  const received=[];
  const h=harness({
    prepareAttempt:()=>{ids+=1;return {ticketId:'t'+ids,messageId:'m'+ids};},
    onCreated:data=>received.push(data),
    onSubmit:async(data,opts)=>{
      calls+=1;
      assert.equal(data.message,'Minha solicitação');
      assert.equal(opts.attempt.ticketId,'t1');
      if(calls===1)throw new Error('conexão temporária');
      return result;
    }
  });
  h.ui.open();
  h.nodes['signal-message'].value='Minha solicitação';
  await h.submit();
  assert.equal(h.nodes['signal-message'].value,'Minha solicitação');
  assert.equal(h.nodes['signal-form-error'].classList.contains('hidden'),false);
  assert.equal(ids,1);
  await h.submit();
  assert.equal(ids,1);
  assert.deepEqual(received,[result]);
  assert.equal(h.nodes['signal-message'].value,'');
  assert.deepEqual(h.events.slice(-2),['close:composer','created']);
});

test('dois envios simultâneos não executam duas gravações',async()=>{
  let calls=0,resolve;
  const h=harness({
    prepareAttempt:()=>({ticketId:'t1',messageId:'m1'}),
    onCreated:()=>{},
    onSubmit:()=>{
      calls+=1;
      return new Promise(done=>{resolve=done;});
    }
  });
  h.ui.open();
  h.nodes['signal-message'].value='Problema na rede';
  const first=h.submit();
  const second=h.submit();
  await second;
  assert.equal(calls,1);
  resolve({ticket:{id:'t1'},tenantId:'tenant',requesterUid:'alice'});
  await first;
});

test('Voltar Android durante envio não abre conversa inesperadamente',async()=>{
  let resolve;
  let opened=0;
  const h=harness({
    prepareAttempt:()=>({ticketId:'t1',messageId:'m1'}),
    onCreated:()=>{opened+=1;},
    onSubmit:()=>new Promise(done=>{resolve=done;})
  });
  h.ui.open();
  h.nodes['signal-message'].value='Meu equipamento desligou';
  const inFlight=h.submit();
  h.androidBack();
  resolve({ticket:{id:'t1'},tenantId:'tenant',requesterUid:'alice'});
  await inFlight;
  assert.equal(opened,0);
  assert.equal(h.nodes['signal-composer'].classList.contains('hidden'),true);
});
