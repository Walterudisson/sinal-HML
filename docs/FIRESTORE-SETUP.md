# Sinal — Firestore Setup HML

## Sprint 0.3

Este roteiro configura somente o ambiente:

`Firebase projectId: sinaldesk-hml`

Não execute estes passos no Firebase de produção nesta sprint.

---

## 1. Publicar as regras

No Firebase Console:

**Firestore Database → Rules**

Substitua o conteúdo atual pelo arquivo `firestore.rules` entregue nesta sprint e clique em **Publish**.

As regras desta etapa permitem somente leituras necessárias para o contexto autenticado. Escritas da aplicação continuam bloqueadas.

---

## 2. Criar o perfil global do usuário

Em:

**Firestore Database → Data**

Crie a coleção:

`users`

Crie o documento com ID exato:

`rSbmd9g17XckHd87pxgsNjH1im12`

Campos:

| Campo | Tipo | Valor |
|---|---|---|
| `displayName` | string | `Walter Udisson` |
| `email` | string | `walter.udisson@gmail.com` |
| `platformRole` | string | `superadmin` |
| `status` | string | `active` |
| `defaultTenantId` | string | `sinal-interno` |
| `createdAt` | timestamp | data/hora atual |
| `updatedAt` | timestamp | data/hora atual |

---

## 3. Criar o tenant inicial

Crie a coleção:

`tenants`

Crie o documento:

`sinal-interno`

Campos:

| Campo | Tipo | Valor |
|---|---|---|
| `name` | string | `Sinal` |
| `slug` | string | `sinal-interno` |
| `status` | string | `active` |
| `plan` | string | `internal` |
| `createdAt` | timestamp | data/hora atual |
| `updatedAt` | timestamp | data/hora atual |

---

## 4. Criar o vínculo do usuário com o tenant

Dentro do documento:

`tenants/sinal-interno`

Crie a subcoleção:

`members`

Crie o documento com ID:

`rSbmd9g17XckHd87pxgsNjH1im12`

Campos:

| Campo | Tipo | Valor |
|---|---|---|
| `displayName` | string | `Walter Udisson` |
| `email` | string | `walter.udisson@gmail.com` |
| `role` | string | `admin` |
| `status` | string | `active` |
| `joinedAt` | timestamp | data/hora atual |

---

## 5. Estrutura esperada

```text
users/
└── rSbmd9g17XckHd87pxgsNjH1im12
    ├── displayName: Walter Udisson
    ├── email: walter.udisson@gmail.com
    ├── platformRole: superadmin
    ├── status: active
    └── defaultTenantId: sinal-interno

tenants/
└── sinal-interno
    ├── name: Sinal
    ├── status: active
    ├── plan: internal
    └── members/
        └── rSbmd9g17XckHd87pxgsNjH1im12
            ├── role: admin
            └── status: active
```

Depois disso, publique os arquivos da Sprint 0.3 no repositório `Walterudisson/sinal-HML` e execute o roteiro de homologação.
