# Sinal — Homologação da Sprint 1.2

**Ambiente:** HML  
**Responsável:** Walter Udisson

## HML-1.2-01 — Login e Central
- [ ] Login funciona.
- [ ] Central carrega.
- [ ] Meus sinais carregam.
- [ ] Sinais assumidos aparecem em `Central → Meus`.

## HML-1.2-02 — Abrir por Meus sinais
- [ ] Clique/toque em um sinal abre o detalhe.
- [ ] Área Conversa aparece.
- [ ] Solicitante pode escrever.

## HML-1.2-03 — Mensagem do solicitante
Envie: `Olá, estou adicionando mais detalhes para o teste da conversa.`
- [ ] Mensagem aparece sem refresh.
- [ ] Autor e horário aparecem.
- [ ] Contador aumenta.

## HML-1.2-04 — Firestore
Em `tickets/{ticketId}/messages/{messageId}`:
- [ ] body correto.
- [ ] visibility = public.
- [ ] authorUid correto.
- [ ] authorName = Walter Udisson.
- [ ] authorEmail correto.
- [ ] authorRole = admin.
- [ ] createdAt timestamp.

## HML-1.2-05 — Atendente responsável
Envie: `Recebi seu sinal e iniciei a análise.`
- [ ] Mensagem enviada.
- [ ] Histórico atualiza em tempo real.
- [ ] Mensagens anteriores permanecem.

## HML-1.2-06 — Não assumido
Abra ticket novo na Central:
- [ ] conversa pode ser lida;
- [ ] atendente não pode escrever;
- [ ] interface pede para assumir;
- [ ] após assumir, escrita é habilitada.

## HML-1.2-07 — Tempo real
- [ ] Duas mensagens seguidas aparecem sem refresh.
- [ ] Ordem cronológica correta.
- [ ] Rolagem vai para a mais recente.

## HML-1.2-08 — Mobile
- [ ] histórico rola corretamente;
- [ ] teclado não quebra o composer;
- [ ] Enviar permanece tocável;
- [ ] sem rolagem horizontal;
- [ ] bolhas respeitam a largura.

## HML-1.2-09 — Voltar
Com detalhe aberto:
- [ ] Voltar fecha o detalhe;
- [ ] permanece no Sinal.

## HML-1.2-10 — Regressão Mandar um sinal
- [ ] criação funciona;
- [ ] toast superior direito;
- [ ] aparece em Meus sinais e Central.

## HML-1.2-11 — Regressão Assumir
- [ ] open → in_progress;
- [ ] responsável preenchido;
- [ ] Central atualiza;
- [ ] conversa habilita.

## HML-1.2-12 — Persistência
- [ ] feche e reabra o detalhe;
- [ ] recarregue a página;
- [ ] mensagens permanecem;
- [ ] sem duplicações.

# Resultado geral
- [ ] SPRINT 1.2 APROVADA
- [ ] SPRINT 1.2 REPROVADA
- [ ] APROVADA COM CORREÇÕES PENDENTES


## Encerramento

Sprint 1.2 homologada explicitamente em 2026-09-29.
