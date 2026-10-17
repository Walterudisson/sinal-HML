# Sprint 1.7.0-A — Implantação controlada em Firebase HML

**Alvo exclusivo:** `sinaldesk-hml` / `sinaldesk-hml.firebasestorage.app`  
**Não usar** `sinaldesk` (PRD) em nenhum comando desta etapa.  
**Base de testes:** PR #40, GitHub Actions com 33 testes de segurança e regressão aprovados.

## Pré-condições (antes de publicar)

- [x] Bucket HML e Blaze verificados por captura no Console Firebase.
- [x] Emuladores: Storage + Firestore Rules, múltiplos tenants, revogação, falhas parciais.
- [x] Orçamento existente confirmado pelo responsável em 17/10/2026 para o HML. Conferir no Console os alertas configurados (limiares e destinatários) antes de habilitar uploads.
- [ ] Confirmar que a aba Regras do Storage ainda apresenta `allow read, write: if false;`.
- [ ] Conferir que não houve edição posterior de Firestore Rules no Console (a CLI substitui a versão do Console).
- [ ] Registrar um backup/exportação das regras atuais do Firestore. A regra de bloqueio do Storage está no arquivo `docs/deploy/storage-deny-all.rules`.
- [ ] Confirmar permissão de deploy para o projeto (Firebase Rules, IAM, Cloud Functions e Cloud Build).
- [ ] Garantir que ninguém esteja desativando contas/organizações diretamente no Console durante o teste de Storage.

## Etapa 1 — código no GitHub, sem implantação Firebase

O PR #40 deve ser aprovado e integrado à branch `main` de `Walterudisson/sinal-HML`.
O merge **não equivale** a publicar as Rules no Firebase. O frontend continua identificado
como `HML v1.6.3.1`, pois ainda não existe botão de anexar.

## Etapa 2 — conferir ambiente no Cloud Shell

Abra https://console.cloud.google.com/ no projeto **sinaldesk-hml**, inicie o Cloud Shell
e execute os comandos abaixo, um de cada vez:

```bash
git clone --depth 1 https://github.com/Walterudisson/sinal-HML.git
cd sinal-HML
npm ci --prefix functions --ignore-scripts --no-audit --no-fund
npx --yes firebase-tools@15.32.0 projects:list
```

Se a CLI pedir autenticação, conclua o login na sua própria conta.
**Confirme** que `sinaldesk-hml` aparece na lista antes de continuar.

## Etapa 3 — implantar apenas as duas Functions novas

```bash
npx --yes firebase-tools@15.32.0 deploy --only functions:deactivateSinalUser,functions:deactivateSinalTenant --project sinaldesk-hml
```

Não use `firebase deploy` sem `--only`.
As Functions são destinadas apenas ao Superadmin global ativo. Não utilize as
rotinas para desativar contas reais durante o smoke test; use usuários de teste.

**Ponto de parada:** conferir no Console Firebase > Functions se ambas estão
disponíveis. Se qualquer deploy falhar, parar sem passar às regras.

## Etapa 4 — publicar somente as novas regras do Firestore

```bash
npx --yes firebase-tools@15.32.0 deploy --only firestore:rules --project sinaldesk-hml
```

A alteração adiciona `tickets/{ticketId}/attachments/{attachmentId}` com criação
privada de metadados `pending`; não libera atualizações de documentos existentes.
Confirmar no Console que as regras publicadas correspondem ao arquivo do PR #40.

## Etapa 5 — publicar somente as regras do Storage

```bash
npx --yes firebase-tools@15.32.0 deploy --only storage --project sinaldesk-hml
```

Ao instalar regras com `firestore.get()` ou `firestore.exists()`, o Firebase
pode **pedir autorização cross-service** para o Storage consultar o Firestore.
Se a CLI solicitar a permissão, conferir que se refere a `sinaldesk-hml` e autorizar.
A integração concede a função de IAM "Firebase Rules Firestore Service Agent"
à conta de serviço do Storage, terminada em
`@gcp-sa-firebasestorage.iam.gserviceaccount.com`. Para inspeção no IAM do
Google Cloud, marcar **Incluir concessões de papéis fornecidos pelo Google**.

Se não houver prompt e os testes reais forem negados, conferir a permissão no
Console. **Não afrouxar as regras de acesso** para contornar essa falha.

## Etapa 6 — verificar e homologar apenas infraestrutura HML

- No Console Storage > Regras, conferir se o bloqueio global foi preservado
  e se existe a rota restrita `tenants/{tenantId}/tickets/{ticketId}/attachments/{attachmentId}`.
- Fazer smoke test do Sinal com solicitante e atendente: login, Central, Início,
  Meus sinais, mensagens e notificações, confirmando ausência de regressões.
- Executar teste funcional de segurança controlado com contas de teste antes do
  primeiro upload. Não enviar anexos pelo Console Firebase, que contorna a
  autenticação do aplicativo e não simula as regras dos usuários.
- Não promover as regras a PRD. Não habilitar botão de upload nesta etapa.
- Para iniciar a Fase 1.7.0-B, falta o backend de confirmação `pending → ready`,
  tratamento de upload interrompido e limpeza de objetos órfãos.

## Reversão segura

**Storage:** restaurar imediatamente a regra `deny-all` do arquivo
`docs/deploy/storage-deny-all.rules`, pela aba Storage > Regras do Console HML.
Confirmar que o editor aponta para o bucket **HML**, não PRD.

**Firestore:** recuperar a versão anterior da aba Regras > Histórico
na **base HML**, ou aplicar a versão pré-PR #40 do repositório GitHub.
Reverter o Firestore apenas se necessário; a versão atual conserva as regras
de operações existentes e somente adiciona um `match /attachments`.

**Functions:** se for preciso desabilitar endpoints administrativos, não apagar
funções não relacionadas (notificações). Restringir as duas novas Functions
e interromper o uso enquanto investiga. Qualquer exclusão deve ser deliberada.

## Segurança/limites

- Regras do Storage podem consultar no máximo **dois documentos distintos**
  do Firestore por pedido, aqui `members/{uid}` e `tickets/{ticketId}`.
- Sempre desativar conta ou tenant **pela rotina privilegiada**, nunca editando
  somente `users/{uid}.status` no Console, porque isso poderia conservar
  permissões diretas do Storage.
- Regras do Storage **não impõem cota total de consumo por tenant**, só o tamanho
  máximo por objeto. Limite de consumo, App Check e limpeza de órfãos são
  controles adicionais a implementar antes de uso externo.
- O usuário final só terá interface de anexos após a fase B homologada.

## Documentação oficial

- https://firebase.google.com/docs/rules/manage-deploy
- https://firebase.google.com/docs/cli
- https://firebase.google.com/docs/storage/security/rules-conditions

## Registro da implantação real em 17/10/2026

**Status:** Cloud Functions, Firestore Rules e Storage Rules publicados no projeto `sinaldesk-hml`, segundo os resultados completos enviados pelo operador do Cloud Shell. A aplicação web permanece v1.6.3.1, sem interface de anexos. Nenhum deploy em `sinaldesk` (PRD).

- **Cloud Functions:** deploy seletivo bem-sucedido para `deactivateSinalUser` e `deactivateSinalTenant` (`southamerica-east1`).
- **Firestore Rules:** compilação bem-sucedida e confirmação de `released rules firestore.rules to cloud.firestore`.
- **Storage Rules:** compilação bem-sucedida e confirmação de `released rules storage.rules to firebase.storage`.
- **IAM cross-service:** Firebase CLI solicitou a função de IAM necessária, operador confirmou `Yes` e o terminal informou `updated service account for cross-service rules`.
- **Orçamento:** usuário confirmou que o orçamento já existe. Limiares e destinatários não verificados.

**Conferido após a implantação:** conteúdo das regras do Firestore e do Storage enviado pelo operador, incluindo o caminho de anexos e o bloqueio residual. **Smoke test da aplicação concluído pelo usuário:** 5/5 verificações passaram (login e Início solicitante, Meus sinais, mensagem, Central atendente e recebimento da mensagem).

**Ainda não homologado:** operações reais de leitura/upload autorizadas e negadas no Firebase Storage, callables com autenticação de teste, fluxo `pending → ready`, proteção contra anexos órfãos e conferência de cotas. Os 33 testes de segurança e regressão anteriores passaram em CI/emuladores.

**Próxima etapa:** Sprint 1.7.0-B, implementar confirmação de upload `pending → ready` no backend, limpeza de órfãos, visualização privada, controles de custo/abuso e testes integrados com contas HML de teste. Nenhuma ação de desativação com conta real. Não liberar upload aos usuários antes da homologação funcional.

**Observação de custos:** limites de 10 MiB por objeto não evitam muitos objetos por usuário. Até implantar controles de limpeza/cotas, os uploads ainda não devem ser habilitados na UI para o público.

## Homologação da infraestrutura e regressão (17/10/2026)

**Resultado:** Sprint 1.7.0-A **homologada para implantação de infraestrutura HML e regressão funcional básica**. O operador confirmou os cinco testes funcionais no app web. Não houve promoção para PRD nem mudança de versão visível da interface (HML 1.6.3.1).

**Escopo fora da homologação:** segurança das Rules em solicitações reais ao Firebase Storage, integração ponta a ponta de envio, processamento de arquivos, chamadas administrativas reais e limites de uso. Permanecem exigências da Sprint 1.7.0-B antes de habilitar botão de anexos.
