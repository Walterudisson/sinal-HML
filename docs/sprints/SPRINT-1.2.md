# Sinal — Sprint 1.2

## Atendimento e conversa

**Status:** Homologada  
**Ambiente:** HML  
**Data:** 2026-09-29

## Objetivo

Completar:

`Solicitante abre → Central recebe → Atendente assume → Ambos conversam`

## Entregas

- conversa persistida no Firestore;
- atualização em tempo real;
- mensagens públicas;
- autor, papel e horário;
- abrir ticket a partir de `Meus sinais`;
- solicitante responde no próprio sinal;
- atendente responsável responde;
- atendente não responsável lê, mas não responde;
- layout mobile-first;
- contador de mensagens;
- histórico visual em bolhas;
- botão/gesto Voltar continua fechando o detalhe primeiro.

## Firestore

`tenants/{tenantId}/tickets/{ticketId}/messages/{messageId}`

## Fora do escopo

- notas internas;
- anexos;
- edição/exclusão de mensagens;
- resolver/encerrar;
- SLA;
- notificações push/e-mail;
- reatribuição.

## Próxima sprint prevista

`1.3 — Resolver e encerrar sinal`
