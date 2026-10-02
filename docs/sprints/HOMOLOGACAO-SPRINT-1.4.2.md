# Homologação HML — Sprint 1.4.2: avisos de mudança de status

**Status:** Aguardando publicação da nova função no Firebase HML e testes manuais.

## Preparação
- Verificar que `functions/status-notifications.test.cjs` passou (`cd functions && npm test`).
- Confirmar merge da branch de 1.4.2 em HML e deploy de `notifyTicketStatus` apenas no projeto `sinaldesk-hml`.
- Conta Solicitante Teste e pelo menos uma conta de suporte (Walter/Atendente Teste).
- Notificações Web Push habilitadas no navegador/dispositivo do Solicitante Teste.
- Usar **um sinal novo** para evitar eventos anteriores à implantação.

## A. Aviso de sinal assumido
- [ ] O solicitante criou um sinal e ele aparece na Central.
- [ ] Um atendente diferente do solicitante assumiu o sinal.
- [ ] No sino do solicitante apareceu **uma** notificação "Seu sinal está em atendimento" com nome do atendente, sem conteúdo interno.
- [ ] O toast apareceu com a sessão aberta; um novo teste em segundo plano gerou push.
- [ ] Tocar no aviso (sino/push) abre o sinal correto.
- [ ] O atendente que assumiu não recebe notificação de si mesmo.

## B. Aviso de resolução
- [ ] O responsável resolveu o sinal e descreveu a solução técnica somente no campo interno.
- [ ] O solicitante recebeu **uma** notificação "Seu sinal foi resolvido".
- [ ] O título e a prévia no sino/toast/push não contêm qualquer parte da solução técnica.
- [ ] O push em segundo plano abre diretamente o sinal resolvido.
- [ ] O solicitante só vê informação pública; detalhes internos permanecem protegidos pelas regras homologadas em 1.4.1.
- [ ] O atendente que resolveu não recebeu notificação de si mesmo.

## C. Segurança, deduplicação e regressão
- [ ] Nos documentos `members/{requesterUid}/notifications`, cada evento novo possui um registro com ID `status-{ticketId}-{eventId}`.
- [ ] Nenhum desses documentos contém texto da solução técnica interna.
- [ ] Recarregar/reabrir o app não dispara uma rajada de toasts antigos.
- [ ] Notificações anteriores de novo sinal e novas mensagens continuam funcionando.
- [ ] Os status, a conversa e a rolagem homologados na 1.4.1 permanecem funcionando.

## Critério de aprovação
Aprovar todos os itens e registrar eventual diferença entre avisos internos e push. A deduplicação do registro em banco é garantida pela criação condicional, mas Web Push depende da rede e permissões do navegador. Nenhuma promoção de 1.4.1/1.4.2 para PRD antes da aprovação explícita.
