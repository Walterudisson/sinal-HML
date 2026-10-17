# Sprint 1.7.0-A — Fundação dos Anexos

**Iniciada:** 17/10/2026  
**Base funcional:** HML v1.6.3.1  
**Status:** proposta de arquitetura; nenhuma operação de upload habilitada

## Objetivo
Preparar a infraestrutura e as regras para anexos em sinais, com segurança multi-tenant
e experiência mobile-first, antes da implementação do botão de clipe.

## Entregas previstas
1. Validar pré-requisitos do Storage em `sinaldesk-hml`: existência do bucket, plano Blaze
   de faturamento e alertas de orçamento. **Ter o campo `storageBucket` no código não prova
   que o bucket está provisionado.**
2. Criar e testar um `storage.rules` exclusivo de HML, com permissão de leitura somente
   para quem já pode ler o sinal e escrita restrita a quem pode interagir nele.
3. Modelar metadados de anexos no Firestore, vinculados a `tenantId`, `ticketId`,
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
