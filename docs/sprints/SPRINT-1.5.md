# Sprint 1.5 — Lean

**Objetivo:** voltar a entregar valor visível com o menor número possível de peças.

## Entrega

Permitir que o próprio solicitante reabra um sinal resolvido.

Fluxo:

`Resolvido → Reabrir sinal → Em atendimento`

O responsável anterior permanece atribuído e a conversa volta a aceitar mensagens.

## Fora do escopo

- estado `waiting_requester`;
- estado `closed`;
- retomada automática;
- nova máquina de estados;
- backend autoritativo adicional;
- novos fluxos de notificação;
- suíte extensa de testes para a mudança.

## Segurança mínima necessária

A reabertura só pode ser feita pelo solicitante do próprio sinal e só pode alterar:

- `status`: `resolved → in_progress`;
- `updatedAt`.

Nenhum outro campo pode ser alterado nessa operação.

## Homologação

Validar em HML apenas:

1. solicitante vê **Reabrir sinal** em sinal resolvido;
2. outro usuário não vê a ação;
3. ao reabrir, o status volta para **Em atendimento**;
4. a conversa volta a aceitar mensagens;
5. PRD permanece inalterado.

Se os cinco pontos funcionarem, a Sprint 1.5 está homologada.
