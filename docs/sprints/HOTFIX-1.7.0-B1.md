# Hotfix 1.7.0-B.1 | Upload cancelado persiste no Storage (HML)

**Detectado pelo usuário:** 17/10/2026, após testes positivos da interface de cancelamento.

## Falha reproduzida por inspeção de código

Na versão 1.7.0-B inicial, `uploadConversationAttachment()` apenas chamava `discardSinalAttachment` quando a variável `uploaded` era `true`. Um clique em Cancelar antes do evento completo disparava `storage/canceled`, mas não executava a rotina de descarte. Devido à natureza do upload resumable, um objeto poderia ter sido aceito pelo Storage mesmo quando a interface exibia “Envio cancelado”, ficando órfão ou pendente. O job noturno remove apenas objetos após 24 horas e não garante descarte imediato.

**Conclusão:** o teste de cancelamento anterior validou só a UX. Não demonstrou limpeza do Storage. Homologação integral da 1.7.0-B suspensa até o hotfix ser aprovado.

## Correção proposta, em branch de HML

1. Criar documento Firestore `attachments/{id}` no estado `pending` **antes** de começar a transferência. Não permitir que o cliente defina `ready`.
2. Controlador explícito de cancelamento permite sinalizar a intenção mesmo antes da task existir. Uma vez iniciada a confirmação server-side, não prometer cancelar.
3. Chamar a rotina privilegiada de descarte sempre que a operação falhar ou for cancelada após criar o metadado, não apenas quando `uploaded = true`.
4. `discardSinalAttachment` marca o documento como `failed` e tenta eliminar o arquivo, caso exista, respeitando `ifGenerationMatch`.
5. Introduzir dois eventos idempotentes para fechar as duas ordens de corrida:
   - `cleanupCanceledSinalUpload`, evento `onObjectFinalized` do bucket HML, executado na região **us-east1** (bucket confirmado em `US-EAST1`): remove objetos que chegarem após o cancelamento, somente se o documento correspondente estiver `failed`.
   - `cleanupFailedSinalAttachment`, evento Firestore `pending → failed`: remove o objeto se tiver terminado de chegar antes do cancelamento.
6. Excluir apenas se caminho, tenant, ticket, `uploadedByUid`, status e geração forem consistentes. Preservar anexos `ready` e `pending`.

## Regressões e testes

- Teste do controlador: cancelamento antes da task, durante a transferência, vedação após a confirmação.
- Teste backend: remoção após upload tardio, idempotência e preservação de objeto pronto ou pertencente a outro autor.
- Manter testes dos emuladores Storage/Firestore e funções anteriores.
- **Ainda necessário em HML real:** cancelamento de arquivo de teste durante upload lento; confirmar que não surge na conversa e que não existe mais objeto correspondente no Storage após processamento; verificar logs das duas novas funções.
- O objeto criado no teste anterior não é automaticamente eliminado por esta implantação. Sua remoção depende do job de limpeza a partir de 24 horas de idade, ou inspeção e exclusão individual controlada pelo responsável após verificar que não é um anexo `ready`.

## Implantação HML

Somente após CI: publicar **apenas** `discardSinalAttachment` (revisada para lidar com objeto já ausente), `cleanupCanceledSinalUpload` e `cleanupFailedSinalAttachment` no Firebase `sinaldesk-hml`. Não publicar as funções de notificação ou as regras novamente. Uma vez validado o deploy, realizar merge do PR para disponibilizar a mudança do frontend na HML. Nunca publicar na produção `sinaldesk` por este procedimento.

**Atenção a custos/permissões:** gatilhos Cloud Storage/Eventarc podem habilitar permissões e gerar cobranças no Blaze; interromper e revisar qualquer solicitação inesperada.

**Versão pretendida:** `1.7.0-B.1`, homologação pendente.

## Validação CI

- GitHub Actions HML: execução **aprovada** https://github.com/Walterudisson/sinal-HML/actions/runs/39073527951.
- Testes incluem cancelamento antes de criar task, durante envio, fechamento da janela de cancelamento após confirmar, exclusão mesmo com chegada tardia do objeto, idempotência e preservação de anexos `ready`.
- A aprovação de CI não é evidência de limpeza real no Storage HML; requer smoke test depois da publicação controlada do backend e frontend.
