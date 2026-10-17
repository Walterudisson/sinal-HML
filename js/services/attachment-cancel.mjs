// Contrato de cancelamento independente do estado de uploadBytesResumable.
// Antes da confirmação server-side, marcar intenção e cancelar a task;
// depois de iniciar a confirmação, não prometer cancelamento.
export function createAttachmentCancellation() {
  let requested = false;
  let task = null;
  let sealed = false;
  return {
    get requested() { return requested; },
    bind(uploadTask) {
      task = uploadTask;
      if (requested) task.cancel();
    },
    cancel() {
      if (sealed) return false;
      requested = true;
      task?.cancel();
      return true;
    },
    seal() {
      if (requested) return false;
      sealed = true;
      return true;
    }
  };
}
