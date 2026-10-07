# Checkpoint HML — Sprint 1.5 Fase B

**Escopo:** Aguardando solicitante + retomada automática  
**Ambiente:** HML  
**PRD:** nenhuma promoção nesta fase

## Entrega

- ação **Aguardar solicitante** disponível somente para o atendente responsável em `in_progress`;
- estado persistido `waiting_requester`;
- texto contextual:
  - solicitante: **Aguardando você**;
  - equipe: **Aguardando solicitante**;
- sinais em espera permanecem em **Meus atendimentos** da Central;
- solicitante pode responder normalmente;
- a primeira resposta do solicitante em `waiting_requester` grava, no mesmo lote:
  - mensagem pública;
  - transição para `in_progress`;
  - evento `requester_replied`;
- atendente responsável pode complementar a conversa durante a espera sem alterar o estado;
- histórico reconhece `waiting_requester` e `requester_replied`;
- `notifyTicketStatus` passa a avisar o solicitante quando a equipe estiver aguardando retorno;
- `requester_replied` não gera status push, evitando duplicidade com a notificação normal de nova mensagem;
- cache PWA HML renovado para `sinal-shell-hml-1.5-b1`.

## Testes automatizados

Em um clone limpo:

```bash
cd ~
git clone --branch sprint/1.5-phase-b-waiting-requester --single-branch \
  https://github.com/Walterudisson/sinal-HML.git sinal-HML-15btest
cd ~/sinal-HML-15btest
nvm use 22

node --test \
  tests/ticket-lifecycle.test.mjs \
  tests/sprint-1.5-phase-a.test.cjs \
  tests/sprint-1.5-phase-b.test.cjs \
  tests/ux1.test.cjs \
  tests/release-1.4.3.test.cjs
```

Esperado: **34/34**.

### Segurança Firestore

```bash
cd ~/sinal-HML-15btest/tests/security
npm install
npm test
```

Esperado: **6/6** testes de regras aprovados. O projeto é local e fictício (`demo-sinal-security`); não acessa HML ou PRD.

### Functions

```bash
cd ~/sinal-HML-15btest/functions
npm ci
npm audit
npm test
```

Esperado:
- `0 vulnerabilities`;
- **7/7** testes de notificações.

## Publicação para homologação HML

Somente após os testes e autorização explícita:

1. integrar o PR da Fase B em `main` HML;
2. publicar as regras HML:
   `firebase deploy --only firestore:rules --project sinaldesk-hml`;
3. publicar somente a função alterada:
   `firebase deploy --only functions:notifyTicketStatus --project sinaldesk-hml`;
4. aguardar atualização do GitHub Pages/PWA;
5. executar a homologação manual abaixo.

Nenhuma dessas publicações será feita em PRD nesta fase.

## Homologação manual HML — B

### B-01 — Entrar em espera
1. solicitante cria um sinal novo;
2. agente assume;
3. agente abre o detalhe;
4. confirmar botões **Aguardar solicitante** e **Resolver sinal**;
5. clicar **Aguardar solicitante**.

**Aceite:**
- status da equipe vira **Aguardando solicitante**;
- sinal continua em **Meus atendimentos**;
- histórico registra **Aguardando solicitante**;
- solicitante recebe aviso no sino/push quando disponível.

### B-02 — Visão do solicitante
Abrir o mesmo sinal como solicitante.

**Aceite:**
- status mostra **Aguardando você**;
- orientação informa que a equipe aguarda sua resposta;
- conversa continua liberada.

### B-03 — Retomada automática
Como solicitante, enviar uma mensagem.

**Aceite:**
- mensagem aparece uma única vez;
- status volta automaticamente para **Em atendimento**;
- histórico registra **Solicitante respondeu · atendimento retomado**;
- assignee continua o mesmo;
- agente recebe a notificação normal de nova mensagem;
- não aparece uma segunda notificação de status para o mesmo ato.

### B-04 — Mensagem adicional do agente
Colocar outro sinal em `waiting_requester` e, como agente responsável, enviar uma mensagem adicional.

**Aceite:**
- mensagem é enviada;
- ticket permanece **Aguardando solicitante**;
- não é criado evento `requester_replied`.

### B-05 — Mobile/PWA
Repetir B-01 a B-03 no celular/PWA.

**Aceite:**
- botões e status ficam legíveis;
- conversa continua utilizável;
- botão Voltar mantém o comportamento dos overlays;
- após fechar e reabrir a PWA, o checkpoint B permanece carregado.

## Fora deste checkpoint

- reabrir sinal;
- fechar sinal;
- avaliação;
- múltiplas resoluções visíveis na interface;
- notificações de reabertura/fechamento.

Esses itens permanecem nas próximas fases da Sprint 1.5.
