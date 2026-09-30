# Sinal — Sprint 1.3

## Notificações + PWA

**Status:** Em homologação  
**Ambiente:** HML  
**Data:** 2026-09-29

## Objetivo
Transformar o Sinal em um aplicativo web instalável e avisar o usuário quando algo exigir sua atenção.

## Notificações
- novo sinal → equipe de atendimento;
- nova mensagem do solicitante → atendente responsável;
- nova mensagem do atendente → solicitante;
- autor do evento não recebe aviso de si mesmo;
- sino com contador de não lidas;
- central de notificações;
- marcar uma/todas como lidas;
- toast quando o app está aberto;
- Web Push quando o app está em segundo plano/fechado;
- toque na notificação abre o sinal correspondente.

## PWA
- manifest;
- Service Worker;
- ícones 192/512 e Apple Touch Icon;
- instalação em modo standalone;
- tela offline;
- cache de shell local;
- detecção de atualização;
- orientação específica para iPhone/iPad;
- ativação de push apenas após ação explícita do usuário.

## Backend
Cloud Functions 2nd gen:
- `notifyNewTicket`;
- `notifyNewMessage`.

## Fora do escopo
- e-mail;
- SMS;
- preferências granulares por tipo de notificação;
- horários silenciosos;
- SLA;
- resolver/encerrar.

## Próxima sprint
`Sprint 1.4 — Resolver e encerrar sinal`
