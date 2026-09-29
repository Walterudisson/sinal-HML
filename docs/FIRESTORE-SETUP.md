# Sinal — Firestore Setup HML

## Sprint 1.1 — Central de atendimento

Ambiente:

`Firebase projectId: sinaldesk-hml`

## 1. Nenhum documento novo obrigatório

A estrutura criada nas Sprints 0.3 e 1.0 continua válida.

Esta sprint não exige criação manual de novas coleções ou documentos.

## 2. Atualizar Security Rules

No Firebase Console:

**Firestore Database → Rules**

Substitua as regras atuais pelo conteúdo do arquivo:

`firestore.rules`

e clique em **Publish**.

## 3. O que muda nas regras

Papéis `admin`, `supervisor` e `agente` podem:

- ler os sinais do tenant;
- assumir um sinal ainda aberto e sem responsável.

Ao assumir, somente estes campos podem mudar:

- `status`: `open` → `in_progress`
- `assigneeUid`
- `assigneeName`
- `assigneeEmail`
- `updatedAt`

O frontend não recebe permissão genérica para editar o ticket.

## 4. Dados adicionados automaticamente ao assumir

Exemplo:

```text
status: in_progress
assigneeUid: rSbmd9g17XckHd87pxgsNjH1im12
assigneeName: Walter Udisson
assigneeEmail: walter.udisson@gmail.com
updatedAt: <timestamp servidor>
```

## 5. Observação de concorrência

Se dois atendentes tentarem assumir o mesmo sinal, somente o primeiro deverá conseguir.

Após a primeira atribuição, as regras recusam nova tentativa porque o ticket deixa de estar `open` e `assigneeUid` deixa de ser `null`.
