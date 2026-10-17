import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createAttachmentCancellation } from '../js/services/attachment-cancel.mjs';

test('cancelamento antes de existir a task é preservado e impede confirmação',()=>{
  const controller=createAttachmentCancellation();
  let canceled=0;
  assert.equal(controller.cancel(),true);
  controller.bind({cancel:()=>{canceled++;}});
  assert.equal(canceled,1);
  assert.equal(controller.requested,true);
  assert.equal(controller.seal(),false);
});

test('cancelamento durante upload é propagado uma vez para a task',()=>{
  const controller=createAttachmentCancellation();
  let canceled=0;
  controller.bind({cancel:()=>{canceled++;}});
  assert.equal(controller.cancel(),true);
  assert.equal(controller.requested,true);
  assert.equal(canceled,1);
  assert.equal(controller.seal(),false);
});

test('cancelamento não é prometido depois do início de confirmação',()=>{
  const controller=createAttachmentCancellation();
  let canceled=0;
  controller.bind({cancel:()=>{canceled++;}});
  assert.equal(controller.seal(),true);
  assert.equal(controller.cancel(),false);
  assert.equal(controller.requested,false);
  assert.equal(canceled,0);
});

test('cliente grava pending ANTES de iniciar upload e tenta descarte após qualquer cancelamento',()=>{
  const s=readFileSync(new URL('../js/services/attachments.service.js',import.meta.url),'utf8');
  const declaration=s.indexOf('metadataCreated = true');
  const upload=s.indexOf('uploadBytesResumable(fileRef');
  assert.ok(declaration>=0 && upload>declaration,'Storage não pode receber bytes antes de pending');
  const catchStart=s.indexOf('} catch (error) {',upload);
  const discard=s.indexOf('await discard({ tenantId, ticketId, attachmentId: id })',catchStart);
  assert.ok(discard>catchStart,'cancelamento deve chamar descarte');
  assert.match(s,/if \(!cancellation\.seal\(\)\) throw canceledError\(\)/);
});
