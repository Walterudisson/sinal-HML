# Sinal — Sprint 1.1

## Central de atendimento e assumir um sinal

**Status:** Em homologação  
**Ambiente:** HML  
**Data:** 2026-09-28

## Objetivo

Construir o primeiro fluxo operacional da equipe de atendimento:

`Sinal recebido → Central → Abrir → Assumir → Em atendimento`

## Entregas

- Nova área `Central`.
- A Central é exibida apenas para:
  - `admin`
  - `supervisor`
  - `agente`
- Navegação continua diferente para solicitantes.
- Fila em tempo real com sinais do tenant.
- Indicadores:
  - Novos
  - Meus
  - Sem responsável
- Filtros da fila.
- Detalhe do sinal.
- Exibição de:
  - código;
  - título;
  - descrição;
  - categoria;
  - prioridade;
  - status;
  - solicitante;
  - responsável;
  - data.
- Ação `Assumir sinal`.
- Atualização:
  - `status: open → in_progress`
  - `assigneeUid`
  - `assigneeName`
  - `assigneeEmail`
- Toast `Sinal assumido`.
- Security Rules específicas para a ação de assumir.
- Atualização em tempo real.
- Correção do comportamento mobile:
  - botão/gesto nativo `Voltar` fecha composer;
  - botão/gesto nativo `Voltar` fecha detalhe;
  - somente depois disso o navegador pode sair da aplicação.

## Decisão de produto

O nome `Central` passa a representar a fila operacional da equipe de atendimento.

`Meus sinais` continua representando sinais criados pelo usuário na condição de solicitante.

Um agente pode ocupar os dois papéis simultaneamente:

- solicitante dos próprios sinais;
- atendente na Central.

## Fora do escopo

- Respostas/conversa.
- Notas internas.
- Reatribuição.
- Devolver sinal à fila.
- Resolver/encerrar.
- Equipes.
- SLA.
- Anexos.
- Administração de usuários.
- PRD.

## Próxima etapa prevista

`Sprint 1.2 — Atendimento e conversa`
