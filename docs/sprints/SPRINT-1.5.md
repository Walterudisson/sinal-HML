# Sprint 1.5 — Ciclo de Vida do Sinal

**Versão alvo:** 1.5.0  
**Status:** Planejamento para implementação em HML  
**Data de abertura:** 06/10/2026  
**Origem:** Sinal 1.4.3 homologado em HML e PRD

## Objetivo

Completar o ciclo de vida operacional do sinal, permitindo espera por retorno do solicitante, reabertura após resolução, fechamento definitivo, histórico completo dos estados, avaliação do atendimento e notificações coerentes com cada transição.

A Sprint 1.5 deve preservar:
- arquitetura multi-tenant;
- privacidade da resolução técnica;
- histórico auditável;
- experiência mobile-first;
- fluxo HML → homologação → autorização de janela PRD → PRD;
- compatibilidade com sinais criados e resolvidos na série 1.4.x.

## Máquina de estados

Estados persistidos no campo `ticket.status`:

```text
open
  └─ claimed ───────────────► in_progress
                                  │
                                  ├─ waiting_requester ─────► waiting_requester
                                  │                              │
                                  │                              └─ requester_replied ─► in_progress
                                  │
                                  └─ resolved ───────────────► resolved
                                                                  │
                                                                  ├─ reopened ─────────► in_progress
                                                                  │
                                                                  └─ closed ───────────► closed
```

Não existirá um estado persistido `reopened`. Reabertura é um evento de transição `resolved → in_progress`.

`closed` é terminal nesta versão. Um problema posterior deverá gerar um novo sinal.

## Estados e linguagem

| Status técnico | Solicitante | Atendimento | Observação |
| --- | --- | --- | --- |
| `open` | Sinal recebido | Sinal recebido | Ainda sem atendente responsável |
| `in_progress` | Em atendimento | Em atendimento | Há atendente responsável |
| `waiting_requester` | Aguardando você | Aguardando solicitante | Assignee preservado |
| `resolved` | Resolvido | Resolvido | Pode ser reaberto ou fechado |
| `closed` | Fechado | Fechado | Estado terminal |

## Regras de transição

| De | Para | Evento | Quem pode executar | Regra |
| --- | --- | --- | --- | --- |
| `open` | `in_progress` | `claimed` | admin, supervisor ou agente | Usuário que assume torna-se assignee |
| `in_progress` | `waiting_requester` | `waiting_requester` | atendente responsável | Assignee permanece inalterado |
| `waiting_requester` | `in_progress` | `requester_replied` | solicitante do sinal | Ocorre junto da nova mensagem pública do solicitante |
| `in_progress` | `resolved` | `resolved` | atendente responsável | Exige resolução técnica privada |
| `resolved` | `in_progress` | `reopened` | solicitante ou atendente responsável | Preserva assignee; resolução anterior não é apagada |
| `resolved` | `closed` | `closed` | solicitante do sinal | Confirma encerramento definitivo |

### Decisões de escopo

- Admin e supervisor não terão "fechamento forçado" nesta sprint se não forem o solicitante. Fechamento administrativo poderá ser tratado junto da futura gestão operacional.
- Reatribuição de atendente não faz parte da Sprint 1.5.
- Não haverá fechamento automático por prazo nesta sprint.
- O agente pode conversar normalmente em `waiting_requester`; somente uma mensagem do solicitante retoma automaticamente `in_progress`.
- `resolved` e `closed` não permitem novas mensagens. Para conversar novamente em um sinal resolvido, é preciso reabri-lo.
- `closed` não pode ser reaberto na 1.5.

## Evolução do modelo de resolução

### Problema da estrutura atual

Na série 1.4.x a resolução técnica é armazenada em:

```text
tenants/{tenantId}/tickets/{ticketId}/private/resolution
```

Esse modelo comporta apenas uma resolução imutável. Um sinal reaberto pode ser resolvido novamente, portanto sobrescrever o documento eliminaria parte do histórico.

### Modelo 1.5

Novas resoluções serão append-only em:

```text
tenants/{tenantId}/tickets/{ticketId}/privateResolutions/{resolutionId}
```

O `resolutionId` deverá coincidir com o ID do respectivo evento `resolved` em `statusEvents`.

Campos previstos:
- `text`: solução técnica privada;
- `knowledgeCandidate`: boolean;
- `createdByUid`;
- `createdByName`;
- `createdAt`.

No documento principal do ticket:
- `latestResolutionId`: ID da resolução mais recente;
- `resolutionShared`: mantém indicação da resolução pública atual;
- `publicResolution`: mantém o texto público da resolução atual;
- `resolvedAt`, `resolvedByUid`, `resolvedByName`: representam a resolução mais recente.

### Compatibilidade 1.4.x

- Sinais antigos sem `latestResolutionId` continuam lendo `private/resolution`.
- A Sprint 1.5 não precisa migrar em lote dados históricos.
- Ao reabrir e resolver novamente um sinal antigo, a nova resolução passa a usar `privateResolutions/{resolutionId}`.
- O documento legado `private/resolution` não será apagado.

### Histórico público da resolução

O evento `resolved` poderá guardar somente metadados públicos seguros da resolução:
- `resolutionShared`;
- `publicResolution` quando explicitamente compartilhada.

Nunca armazenar texto técnico privado em `statusEvents`, notificações ou documento público do ticket.

## Eventos de histórico

A coleção permanece:

```text
tenants/{tenantId}/tickets/{ticketId}/statusEvents/{eventId}
```

Eventos da 1.5:
- `claimed`;
- `waiting_requester`;
- `requester_replied`;
- `resolved`;
- `reopened`;
- `closed`.

Todos os eventos de mudança de status devem:
- ser imutáveis;
- registrar `from`, `to`, `actorUid`, `actorName`, `createdAt`;
- ser gravados atomicamente com a mudança correspondente no ticket;
- atualizar `lastEventId`.

## Mensagens e retomada automática

Quando o ticket estiver em `waiting_requester`:

1. o solicitante envia uma mensagem pública;
2. a mensagem, a mudança `waiting_requester → in_progress` e o evento `requester_replied` devem ser gravados de forma consistente;
3. o assignee permanece o mesmo;
4. a notificação normal de nova mensagem continua sendo suficiente para avisar o atendente;
5. `notifyTicketStatus` não deve gerar uma segunda notificação para `requester_replied`.

## Fechamento

`resolved` significa que a equipe apresentou uma solução.

`closed` significa que o solicitante confirmou o encerramento do ciclo.

Ao fechar:
- preservar todas as resoluções e eventos anteriores;
- registrar `closedAt`, `closedByUid` e `closedByName`;
- bloquear mensagens;
- bloquear nova reabertura nesta versão;
- disponibilizar a avaliação do atendimento.

## Avaliação do atendimento

Após `closed`, o solicitante poderá avaliar uma única vez.

Estrutura proposta:

```text
tenants/{tenantId}/tickets/{ticketId}/feedback/requester
```

Campos:
- `score`: inteiro de 1 a 5;
- `comment`: opcional, até 500 caracteres;
- `requesterUid`;
- `createdAt`.

Regras:
- somente o solicitante do ticket pode criar;
- somente quando o ticket estiver `closed`;
- criação única, sem edição ou exclusão nesta sprint;
- suporte pode ler;
- avaliação não altera status;
- não gera push na 1.5.

## Notificações de status

A função atual `notifyTicketStatus` será ampliada sem expor solução técnica.

| Evento | Destinatário | Notificação |
| --- | --- | --- |
| `claimed` | solicitante | já existente |
| `waiting_requester` | solicitante | ação do solicitante é necessária |
| `requester_replied` | nenhum status push | nova mensagem já notifica assignee |
| `resolved` | solicitante | já existente |
| `reopened` pelo solicitante | assignee | sinal foi reaberto |
| `reopened` pelo assignee | solicitante | atendimento foi reaberto |
| `closed` pelo solicitante | assignee | sinal foi fechado |

A regra de nunca notificar o próprio autor permanece.

## Backlog da Sprint 1.5

### S15-01 — Reabrir um sinal resolvido

**Aceite**
- solicitante do ticket pode reabrir `resolved`;
- atendente responsável pode reabrir `resolved`;
- transição é `resolved → in_progress`;
- evento `reopened` é registrado;
- assignee é preservado;
- resolução anterior permanece íntegra;
- `closed` não oferece reabertura.

### S15-02 — Aguardar solicitante

**Aceite**
- somente assignee de `in_progress` executa;
- status passa para `waiting_requester`;
- evento `waiting_requester` é criado;
- solicitante recebe notificação;
- conversa continua acessível às duas pontas.

### S15-03 — Retomar por resposta do solicitante

**Aceite**
- solicitante pode responder em `waiting_requester`;
- mensagem retoma o sinal para `in_progress`;
- evento `requester_replied` é registrado;
- assignee permanece;
- não há notificação duplicada de status + mensagem.

### S15-04 — Fechamento definitivo

**Aceite**
- solicitante pode fechar apenas um ticket `resolved`;
- transição `resolved → closed`;
- evento `closed` e metadados de fechamento registrados;
- mensagens e reabertura ficam indisponíveis;
- histórico continua disponível.

### S15-05 — Histórico completo

**Aceite**
- interface reconhece os seis tipos de evento da sprint;
- apresenta ator e data;
- não expõe conteúdo técnico privado;
- resoluções públicas compartilhadas podem ser mostradas no histórico sem misturar com texto técnico.

### S15-06 — Avaliar atendimento

**Aceite**
- CTA após fechamento;
- nota 1 a 5;
- comentário opcional até 500 caracteres;
- somente uma avaliação por sinal;
- solicitante cria, suporte lê;
- avaliação não altera o status.

### S15-07 — Notificações das novas transições

**Aceite**
- `waiting_requester`, `reopened` e `closed` seguem a matriz desta especificação;
- notificações internas e push continuam idempotentes;
- conteúdo privado nunca é incluído;
- autor não recebe seu próprio evento.

### S15-08 — Notificação de reabertura

Coberta tecnicamente por S15-07, mas mantida como história separada para teste funcional explícito dos dois sentidos:
- solicitante → assignee;
- assignee → solicitante.

### S15-09 — Segurança Firestore

**Aceite**
- toda transição é validada no backend por regras;
- ator, estado anterior, estado posterior e assignee são validados;
- evento e mudança do ticket permanecem vinculados;
- resolução técnica fica restrita a suporte;
- feedback segue regras próprias;
- tentativas inválidas falham no Emulator Suite.

### S15-10 — UX mobile/PWA

**Aceite**
- ações cabem no fluxo mobile sem depender de desktop;
- botão Voltar continua respeitando overlay/subtelas;
- atualização de cache da PWA ocorre na release;
- estados e CTAs têm rótulos compreensíveis para solicitante e suporte.

### S15-11 — Auditoria e regressão

**Aceite**
- testes automatizados para máquina de estados;
- testes de regras Firestore no emulador;
- testes unitários de notificações;
- roteiro manual HML cobrindo os fluxos críticos;
- regressão de criar, assumir, conversar e resolver permanece aprovada.

## Ordem de implementação

### Fase A — Domínio e segurança
1. constantes/semântica dos estados;
2. novas transições no service;
3. modelo append-only de resoluções;
4. regras Firestore;
5. testes de regras e transições.

### Fase B — Espera e retomada
1. ação Aguardar solicitante;
2. estado `waiting_requester`;
3. resposta do solicitante retomando para `in_progress`;
4. histórico e notificação.

### Fase C — Reabertura e múltiplas resoluções
1. ação Reabrir sinal;
2. preservação do assignee;
3. segunda resolução sem sobrescrever a anterior;
4. compatibilidade com `private/resolution` da 1.4.x.

### Fase D — Fechamento e avaliação
1. Confirmar encerramento;
2. estado `closed`;
3. feedback 1–5 + comentário opcional;
4. segurança e leitura pela equipe.

### Fase E — UX, notificações e homologação
1. histórico completo;
2. textos por contexto;
3. notificações;
4. PWA/cache;
5. testes automatizados;
6. roteiro manual HML.

## Estratégia de homologação e promoção

A Sprint 1.5 será homologada de forma incremental em HML, mas terá **uma única promoção para PRD**, somente após a conclusão e aprovação da sprint inteira.

Checkpoints de HML:
- fim da Fase B: homologação focada em espera pelo solicitante e retomada automática;
- fim da Fase C: homologação focada em reabertura e múltiplas resoluções;
- fim da Fase D: homologação focada em fechamento e avaliação;
- Fase E: integração final, notificações, mobile/PWA e regressão completa;
- Release Candidate 1.5.0: homologação final do conjunto completo.

As aprovações intermediárias servem para reduzir risco e localizar regressões cedo, mas **não autorizam promoção parcial para PRD**.

Fluxo de release:
1. implementar e testar em HML;
2. concluir todos os checkpoints de homologação;
3. gerar o estado candidato da versão 1.5.0;
4. executar homologação final completa em HML;
5. obter aprovação explícita da versão;
6. confirmar a janela de implantação em PRD;
7. promover a 1.5.0 completa para PRD em uma única transição;
8. executar smoke test objetivo em produção.

Exceções admitidas:
- hotfix crítico em produção;
- necessidade técnica específica de infraestrutura que exija validação isolada em PRD.

Fora dessas exceções, não serão promovidas fases A, B, C ou D separadamente para produção.

## Roteiro mínimo de homologação HML

1. criar sinal como solicitante;
2. assumir como agente;
3. marcar Aguardando solicitante;
4. confirmar aviso ao solicitante;
5. responder como solicitante e confirmar retorno automático para Em atendimento;
6. resolver;
7. confirmar resolução pública/privada conforme opção;
8. reabrir como solicitante;
9. confirmar aviso ao assignee;
10. resolver novamente e confirmar que a primeira resolução não foi perdida;
11. reabrir como assignee em outro cenário e confirmar aviso ao solicitante;
12. resolver e fechar como solicitante;
13. confirmar que o sinal fechado não reabre e não aceita mensagens;
14. avaliar com nota e comentário;
15. tentar avaliar novamente e confirmar bloqueio;
16. validar histórico cronológico completo;
17. testar permissões negativas no emulador;
18. validar tudo também no mobile/PWA.

## Fora da Sprint 1.5

- reatribuição manual;
- equipes e filas avançadas;
- notas internas;
- canais Equipe/Gestão;
- tags;
- SLA;
- fechamento automático;
- fechamento administrativo forçado;
- edição/exclusão de mensagens;
- edição da avaliação;
- dashboard de métricas de satisfação.

## Definição de pronto

A Sprint 1.5 só estará pronta quando:
- funcionalidades e regras estiverem implementadas em HML;
- testes automatizados estiverem aprovados;
- roteiro manual HML estiver aprovado;
- nenhuma regressão crítica for encontrada;
- versão 1.5.0 estiver identificada na interface;
- promoção para PRD ocorrer somente após confirmação explícita de janela;
- smoke test PRD for aprovado.
