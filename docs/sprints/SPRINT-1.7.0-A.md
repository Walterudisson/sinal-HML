# Sprint 1.7.0-A — Fundação dos Anexos

**Iniciada:** 17/10/2026  
**Base funcional:** HML v1.6.3.1  
**Status:** fundação e backend administrativo implementados na branch; 33 testes automatizados aprovados em emuladores. Nada implantado no Firebase HML e uploads indisponíveis.

## Objetivo
Preparar a infraestrutura e as regras para anexos em sinais, com segurança multi-tenant
e experiência mobile-first, antes da implementação do botão de clipe.

## Entregas previstas
1. **Confirmado por imagem em 17/10/2026:** projeto `sinaldesk-hml` em plano Blaze,
   bucket `sinaldesk-hml.firebasestorage.app` criado e vazio. Alertas de orçamento ainda
   precisam ser verificados no console.
   Na captura de Regras, o Storage continua com `allow read, write: if false;`.
   **Nenhuma regra foi implantada pelo GitHub nesta fase.**
2. Regra `storage.rules` criada nesta branch, referenciada por `firebase.json`.
   Testes textuais e testes no Emulator Suite passaram, verificando autenticação,
   bloqueios, limites de tamanho, tipos permitidos e isolamento multi-tenant. A permissão de leitura deve ser somente
   para quem já pode ler o sinal e escrita restrita a quem pode interagir nele.
3. **Regras de metadados implementadas em `firestore.rules` e testadas no emulador.**
   Modelar metadados de anexos no Firestore, vinculados ao contexto de `tenantId`, `ticketId`,
   autor e origem (abertura/conversa), com identificador de armazenamento não adivinhável.
4. Planejar upload recuperável para a próxima fase, com progresso, cancelamento, estados
   `pending/ready/failed` e limpeza segura de uploads incompletos.
5. Validar no Emulator Suite permissões de solicitante, agente responsável, outros
   atendentes do mesmo tenant e usuários de outro tenant. Exercitar arquivos negados.

## Modelo proposto (sujeito a validação)

Arquivo binário no Cloud Storage:
`tenants/{tenantId}/tickets/{ticketId}/attachments/{attachmentId}`

Metadados em:
`tenants/{tenantId}/tickets/{ticketId}/attachments/{attachmentId}`

Campos de referência do documento:
- `fileName` (nome original tratado para exibição, nunca usado diretamente no caminho)
- `storagePath` (caminho completo gerado internamente)
- `contentType`, `size`
- `uploadedByUid`, `createdAt`
- `origin`: `opening` ou `conversation`
- `messageId` opcional para vincular à conversa
- `status`: `pending`, `ready`, `failed`

A validação de metadados e o ciclo de upload devem impedir que um arquivo enviado
se torne visível apenas pela alegação do cliente de que pertence ao sinal.
Vínculos confiáveis entre documento e objeto precisam ser implementados e testados
antes da liberação a usuários.

## Política inicial proposta
- Tipos: JPEG, PNG, WebP e PDF.
- Limite inicial: 10 MiB por arquivo, validado também nas Storage Rules.
- Limite sugerido de interface: até 5 anexos por ação (a confirmar).
- Nenhum executável, HTML, SVG ou mídia de áudio/vídeo nesta entrega.
- Arquivos privados: sem URLs permanentes compartilháveis por padrão.
- Bloquear alterações/remoções arbitrárias de anexos depois de confirmados.
- Metadados no Firestore não devem conter arquivo base64.
- Não confiar só na extensão ou no MIME declarado pelo usuário para comprovar segurança;
  validação de conteúdo, antimalware e pré-visualização segura podem exigir backend.

## Sequenciamento planejado
- **1.7.0-A | Fundação**: Storage, regras, metadados, testes de isolamento.
- **1.7.0-B | Conversa**: selecionar, enviar, acompanhar progresso e visualizar imagens/PDF.
- **1.7.0-C | Abertura de sinal**: adicionar anexos ao criar o sinal, falhas recuperáveis.
- **1.7.0-D | Acabamento**: UX móvel, upload em rede ruim, limites, estados vazios, regressão.

## Gate para passar da fase A à B
- Bucket HML confirmado e disponível.
- Plano Blaze validado; orçamento e custos conhecidos.
- Regras de Storage e Firestore testadas no emulador: outro tenant nunca acessa.
- Fluxo de falha de upload e limpeza documentado e testado.
- Aprovação explícita da fase A.

## Regra de ambientes
Esta etapa acontece exclusivamente em HML. Nenhuma mudança em PRD.
Não implantar regras permissivas para contornar falhas de desenvolvimento.

## Referências oficiais
- https://firebase.google.com/docs/storage/web/start
- https://firebase.google.com/docs/storage/security/get-started
- https://firebase.google.com/docs/rules/manage-deploy
- https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024

## Restrição crítica de segurança descoberta nesta etapa

As Storage Rules podem ler **no máximo dois documentos distintos do Firestore**
por avaliação de acesso, conforme documentação oficial. No Sinal, a autorização
atual consulta usuário global, vínculo de membro no tenant e sinal, totalizando três.

A versão proposta de `storage.rules` consulta **apenas membro + sinal**,
verificando `status=active` no vínculo e permissão de leitura/escrita no próprio sinal.

**Gate obrigatório antes da implantação:** definir/testar a propagação de
desativação de `users/{uid}.status` para `tenants/{tenantId}/members/{uid}.status`,
em todos os tenants correspondentes. Sem essa garantia, uma conta desativada
globalmente poderia continuar com acesso direto ao Storage até seu vínculo ser
revogado. Não tratar esta diferença como um risco resolvido.

Também é necessário verificar se a integração de IAM entre Storage e Firestore
será autorizada ao publicar regras com `firestore.get/exists`.

## Situação do trabalho em GitHub

- `storage.rules`: política proposta; leitura apenas de objeto individual (`get`),
  escrita somente criação (`create`) quando solicitante ou responsável ativo pode
  interagir no sinal, com MIME permitido, tamanho e metadados obrigatórios.
- `firebase.json`: referência ao arquivo de regras para futura implantação.
- `tests/storage-rules-1.7.0-a.test.cjs`: cinco testes estáticos aprovados.
- **Concluído:** compilação das Rules no emulador, testes reais de usuário/tenant,
  imutabilidade dos arquivos, tipos, tamanho e metadados. Evidência: 
  https://github.com/Walterudisson/sinal-HML/actions/runs/39044252103
- **Concluído em código:** rotinas administrativas de revogação de usuários/tenants,
  autorização pelo Superadmin e regras de metadados em `firestore.rules`.
- **Não realizado:** implantação das Cloud Functions e Rules no Firebase real,
  fluxo `pending → ready` e limpeza de anexos órfãos, habilitação de uploads.
- A aba **Regras** do console permanece na política `deny all` até a implantação
  deliberada e validada; não colar regras diretamente sem essa validação.

### Atenções para a próxima fase

- O MIME declarado pelo cliente não comprova o conteúdo real do arquivo.
- Evitar URLs persistentes de download com token público: preferir leitura via SDK
  autenticado e criação de URLs locais temporárias para visualização.
- Definir política de limpeza de arquivos órfãos e total de armazenamento por tenant.
- Os testes estáticos não comprovam permissões efetivas no Firebase.


## Resultado da validação automática de 17/10/2026

- **GitHub Actions:** 5/5 verificações estáticas e 12/12 testes usando Firestore + Storage Emulator.
- A primeira execução identificou sobrescrita inesperada de anexo.
- O `allow create` foi endurecido com `resource == null`; segunda execução aprovou
  o bloqueio de sobrescrita mesmo com a classificação de operações no emulador.
- **Execução aprovada:** https://github.com/Walterudisson/sinal-HML/actions/runs/39044252103
- **PR de HML:** https://github.com/Walterudisson/sinal-HML/pull/40 (rascunho; sem merge).

**Bloqueio remanescente:** implementar e testar a política
[`docs/security/REVOGACAO-ANEXOS.md`](../security/REVOGACAO-ANEXOS.md).
Essa política precisa sincronizar a desativação global de usuário e de tenant com
todos os vínculos, pois as regras do Storage não podem consultar três documentos
do Firestore. Não publicar as regras antes de concluir essa etapa.


## Atualização técnica da fase A — 17/10/2026

**GitHub Actions:** https://github.com/Walterudisson/sinal-HML/actions/runs/39052004143

| Testes | Aprovados |
|---|---:|
| Verificação estática das Storage Rules | 5/5 |
| Testes existentes de notificações (regressão) | 6/6 |
| Storage e metadados Firestore no emulador | 16/16 |
| Revogação, falha parcial e autorização Superadmin | 6/6 |
| **Total** | **33/33** |

Arquivos principais:
- `storage.rules` e `firebase.json`
- `firestore.rules` (subcoleção de metadados `attachments`, apenas `pending`)
- `functions/access-revocation.js` e `functions/index.js` (callables Superadmin)
- `functions/access-revocation.test.cjs` e `tests/storage-emulator-1.7.0-a.test.cjs`
- `.github/workflows/storage-security.yml`

### Bloqueios antes de liberar anexos em HML

1. Validar permissão cross-service IAM de Storage Rules para Firestore no projeto real.
2. Garantir que a administração de desativação use os callables e não alterações
   diretas de status pelo Console (bypass do processo de revogação).
3. Planejar a implantação controlada das Rules e dos callables, com teste real
   e procedimento de reversão para `allow read, write: if false;`.
4. Criar o backend de confirmação do arquivo `pending → ready` e limpeza de
   objetos/entradas órfãos, antes de habilitar o upload na interface.
5. Conferir alertas de custo no projeto Blaze.

**Nota:** a política de Firestore permite criar apenas metadados pendentes de
anexos de conversa em sinais já existentes. Anexos durante a abertura do sinal
precisarão de estratégia própria de estágio de upload na fase C.

A fase A está pronta para revisão de segurança; não equivale a publicação ou
homologação funcional do módulo de anexos.
