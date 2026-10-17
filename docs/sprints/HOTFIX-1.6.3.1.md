# Hotfix 1.6.3.1 — Notificações conscientes da conversa

**Data:** 17/10/2026  
**Ambiente:** HML (`sinaldesk-hml`)  
**Base:** v1.6.3  
**Status:** Aguardando homologação

## Motivação
O usuário percebeu toast de mensagem recebida ao mesmo tempo em que a mensagem
já estava aparecendo na conversa do mesmo sinal, causando duplicidade visual.

## Alterações
- Adiciona verificação de conversa aberta, visível e em primeiro plano, vinculada ao ID do sinal.
- Suprime somente o toast `new_message` relacionado à conversa que está sendo visualizada.
- Marca avisos correspondentes como lidos ao chegar uma nova notificação,
  ao abrir a conversa manualmente ou ao voltar ao aplicativo.
- Evita solicitações duplicadas de leitura enquanto a primeira gravação está pendente.
- Mantém outros avisos e notificações para outros sinais; Web Push de segundo plano não é alterado.
- Atualiza a versão, cache PWA e testes de regressão de HML.

## Roteiro de homologação

| Cenário | Procedimento | Resultado esperado |
|---|---|---|
| Identificação | Acessar Mais | HML v1.6.3.1 |
| Conversa visível | Conta A conversa com B; B envia nova mensagem com conversa A aberta | Mensagem chega, sem toast; aviso marcado como lido |
| Outra tela | B envia nova mensagem enquanto A está na Início ou Central | Toast continua aparecendo |
| Outro sinal | A lê conversa X; B envia mensagem no sinal Y | Toast do sinal Y continua aparecendo |
| Acesso pelos detalhes | A abre sinal pelos detalhes e entra na conversa | Avisos não lidos correspondentes são marcados como lidos |
| Segundo plano | Minimizar ou trocar de aplicativo e receber nova mensagem | Nenhuma alteração no comportamento de Web Push em segundo plano |
| Retorno | Voltar com a conversa aberta | Avisos pendentes da conversa exibida são marcados como lidos |
| Solicitante | Repetir os testes da conversa pelo perfil solicitante | Mesmo comportamento |
| Android | Abrir PWA instalada após a publicação | Versão v1.6.3.1 sem limpeza manual de dados |

## Limites
Não estão sendo modificados os gatilhos de notificação, o Web Push do sistema
operacional, os campos de mensagem ou as regras de segurança do banco de dados.

**Apenas HML; não promover à produção sem aprovação explícita.**
