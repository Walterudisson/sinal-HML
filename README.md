# Sinal — Homologação (HML)

## Hotfix atual
**v1.6.3.1 — Notificações conscientes da conversa** (17/10/2026)

Uma nova mensagem não gera toast quando a conversa daquele sinal está aberta
e visível. A notificação é marcada como lida automaticamente. Em outras telas,
em outros sinais ou em segundo plano, a regra anterior de notificação permanece.

- Sem mudanças em Firebase, Firestore Rules, Cloud Functions ou formato dos documentos.
- Atualização do cache PWA para `sinal-shell-hml-1.6.3.1-conversation-notifications`.
- Consulte [roteiro da versão 1.6.3.1](docs/sprints/HOTFIX-1.6.3.1.md).

## Homologação
1. Abra a versão publicada em HML e confira `HML v1.6.3.1` na tela Mais.
2. Com duas contas, simule mensagens com a conversa do destinatário aberta e visível.
3. Confirme que não aparece toast redundante, que a mensagem chega e que o aviso fica lido.
4. Repita com outra tela aberta, outro sinal e aplicativo em segundo plano.
5. Aprove explicitamente antes de promover qualquer mudança a PRD.

HML: `Walterudisson/sinal-HML`, Firebase `sinaldesk-hml`.
PRD: `Walterudisson/sinal`, Firebase `sinaldesk`. Produção não muda neste hotfix.
