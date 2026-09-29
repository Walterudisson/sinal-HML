# Sinal — Firestore Setup HML

## Sprint 1.0 — Mandar um sinal

Esta sprint utiliza somente:

`Firebase projectId: sinaldesk-hml`

---

## 1. Dados da Sprint 0.3

Os documentos abaixo devem continuar existentes:

```text
users/rSbmd9g17XckHd87pxgsNjH1im12

tenants/sinal-interno

tenants/sinal-interno/members/rSbmd9g17XckHd87pxgsNjH1im12
```

Não é necessário recriá-los se a Sprint 0.3 já está homologada.

---

## 2. Atualizar as Security Rules

No Firebase Console:

**Firestore Database → Rules**

Substitua as regras atuais pelo conteúdo de:

`firestore.rules`

e clique em **Publish**.

A mudança desta sprint permite:

- leitura do próprio perfil/contexto;
- criação de um sinal pelo usuário autenticado e ativo;
- leitura somente dos sinais em que o próprio usuário é o solicitante;
- nenhuma atualização ou exclusão de sinal ainda.

---

## 3. Coleção criada automaticamente

Não crie manualmente a coleção de tickets.

Ao executar o primeiro teste de abertura, o frontend criará:

```text
tenants/
└── sinal-interno/
    └── tickets/
        └── {ticketId}
```

O documento deverá conter:

- `code`
- `title`
- `description`
- `category`
- `priority`
- `status: open`
- `requesterUid`
- `requesterName`
- `requesterEmail`
- `createdByUid`
- `source: web`
- `assigneeUid: null`
- `teamId: null`
- `createdAt`
- `updatedAt`

---

## 4. Identificador do sinal

Nesta sprint o Sinal utiliza um código curto derivado do ID seguro do documento Firestore, por exemplo:

`S-A1B2C3`

Numeração sequencial global por tenant será tratada posteriormente, quando introduzirmos backend transacional/Cloud Functions para evitar colisões e condições de corrida.
