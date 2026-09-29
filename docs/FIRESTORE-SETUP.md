# Sinal — Firestore Setup HML

## Sprint 1.2 — Atendimento e conversa

Ambiente: `sinaldesk-hml`

Não há documentos manuais novos.

Publique o `firestore.rules` desta sprint.

A primeira mensagem criará automaticamente:

`tenants/{tenantId}/tickets/{ticketId}/messages/{messageId}`

Cada mensagem possui:

- `body`
- `visibility: public`
- `authorUid`
- `authorName`
- `authorEmail`
- `authorRole`
- `createdAt`

### Permissões

Solicitante:
- lê e responde no próprio sinal.

Admin/Supervisor/Agente:
- lê os sinais do tenant;
- somente responde quando for o responsável (`assigneeUid`).

Mensagens não podem ser editadas ou excluídas nesta sprint.
