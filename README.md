# Sinal — Homologação (HML)

## Versão em homologação

**v1.7.0-C — Anexos na abertura do sinal e Voltar Android na prévia** (25/10/2026).

- [Sprint 1.7.0-C](docs/sprints/SPRINT-1.7.0-C.md): o solicitante pode anexar um JPG/PNG/WebP ou PDF (até 10 MiB) no formulário **Mandar um sinal**.
- O sinal é salvo antes da transferência. Se o upload falhar ou for cancelado, o sinal permanece criado e o usuário poderá enviar o arquivo pela conversa.
- O botão físico **Voltar** do Android, ao visualizar uma imagem na conversa, agora fecha somente a prévia. A segunda ação de Voltar retorna aos dados do sinal.
- Reutilização da infraestrutura privada de anexos da **1.7.0-B.1**. Sem mudança de Cloud Functions, regras Firebase ou esquema de dados.
- Cache PWA renovado para `sinal-shell-hml-1.7.0-c-opening-attachments-preview-back`.
- Código integrado pela [PR #43](https://github.com/Walterudisson/sinal-HML/pull/43), com testes automatizados aprovados.

**Aguardando homologação funcional no Android e navegador.** Testes manuais de isolamento entre usuários/tenants da 1.7.0-B permanecem pendentes; não confundir aprovação de CI com validação real do isolamento multi-tenant.

## Conferência rápida

1. Acesse https://walterudisson.github.io/sinal-HML/ e confira `HML v1.7.0-C` em **Mais**, depois da publicação do GitHub Pages.
2. Com o **Solicitante Teste**, abra um sinal sem arquivo e outro com imagem opcional; confirme que ambos aparecem em **Meus sinais**.
3. Abra o sinal com imagem, entre na conversa, toque na imagem e pressione **Voltar** do Android: apenas a imagem fecha.
4. Pressione **Voltar** novamente: a conversa fecha e exibe os detalhes do sinal.
5. Faça um teste de cancelamento e confirme que o sinal não é apagado.

## Ambientes

- **HML:** repositório `Walterudisson/sinal-HML`, Firebase `sinaldesk-hml`.
- **PRD:** repositório `Walterudisson/sinal`, Firebase `sinaldesk`, versão 1.6.3.1. **PRD não foi alterado nesta sprint.**

## Histórico

- [Sprint 1.7.0-B: anexos privados na conversa](docs/sprints/SPRINT-1.7.0-B.md).
- [Hotfix 1.7.0-B.1: limpeza de uploads cancelados](docs/sprints/HOTFIX-1.7.0-B1.md).
- [Hotfix 1.6.3.1: notificações na conversa](docs/sprints/HOTFIX-1.6.3.1.md).
