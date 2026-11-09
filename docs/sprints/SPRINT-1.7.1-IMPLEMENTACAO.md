# Sprint 1.7.1 | Plano de implementação controlada em HML

**Escopo e critérios de aceite:** ver `SPRINT-1.7.1.md` e `HOMOLOGACAO-SPRINT-1.7.1.md`.

## Ordem técnica recomendada

1. **Baseline:** registrar SHA da `main` HML e histórico da 1.7.0-C. Não tocar em PRD.
2. **Contrato:** definir formato de `ticket`, `firstMessageId`, mensagem inicial, campos `null` e `triageEvents`. Confirmar compatibilidade das queries existentes.
3. **Segurança antes da UI:** escrever testes de permissão (positivos/negativos) e implementar Rules com vínculo transacional ticket↔primeira mensagem e updates auditáveis. Não conceder escrita genérica a agentes.
4. **Serviço de domínio:** implementar criação atômica e idempotente, geração de título e operações de triagem com verificação de estado/concorrência.
5. **Frontend do solicitante:** campo único, anexos, confirmações, prevenção de envio duplicado e navegação direta para conversa.
6. **Frontend do atendente:** classificação, título editável, histórico e fila Sem triagem.
7. **Regressão de Functions:** cuidado especial: `notifyNewTicket` e `notifyNewMessage` são disparadas por eventos distintos; a primeira mensagem **não** deve notificar a equipe duas vezes nem ficar sem notificação.
8. **Emulator + CI:** rodar testes e validar casos de concorrência, rede, regras, backend e UX.
9. **HML apenas mediante gate:** revisar PR, obter autorização explícita, realizar merge, publicar Rules/Functions se necessário exclusivamente no projeto `sinaldesk-hml`, verificar GitHub Pages e cache PWA.
10. **Homologação:** executar roteiro Android + desktop e registrar evidências. PRD só poderá ser alterada em release separado, mediante nova autorização.

## Pontos de atenção de arquitetura

- O `createTicket()` atual executa `setDoc` somente do ticket. A primeira mensagem exige batch atômico e regras cruzadas. Não fazer apenas `sendMessage()` depois de `createTicket()`, pois falha intermediária cria sinal vazio.
- O `firestore.rules` atual obriga `category` e `priority` dentro de enums. Permitir `null` na criação e mutações apenas por equipe autorizada; garantir campos suficientes no allowlist.
- O `statusEvents` atual trata apenas assumir/resolver. Não forçar alterações de classificação nesse modelo sem redesenhar as Rules. Preferir coleção separada de eventos de triagem.
- O `central.js`, `signal-composer.js` e `ticket-detail.js` usam fallback para prioridade **Normal**. Substituir por tratamento explícito de pendente; preservar indicadores e filtros históricos.
- `tickets.service.js` mantém `description` para busca. Repetir o texto no ticket e na primeira mensagem é intencional para compatibilidade, porém apenas a subcoleção renderiza a bolha na conversa.
- O `main.js` já suporta abertura direta da conversa com `options.view = 'conversation'`; reaproveitar o fluxo, respeitando histórico mobile.
- Os limites de 50 sinais em *Meus Sinais*, 100 na Central e 200 mensagens continuam sendo dívida técnica conhecida; testes precisam considerar o limite, sem fingir paginação completa.
- Não liberar a 1.7.1 em PRD enquanto os testes reais de isolamento multi-tenant e a verificação de objetos órfãos da 1.7.0-C estiverem pendentes.

## Verificação antes de considerar "pronto"

Uma branch ou PR com esta documentação **não equivale a uma implementação**. Somente marcar implementado após evidência de código revisado, testes automatizados, implantação em HML e homologação funcional.


## Estado da execução em 09/11/2026

**1.7.1-A: implementada em branch, CI aprovada. NÃO implantada no Firebase HML.**

Alterações implementadas:

- `firestore.rules`: abertura vinculada à mensagem inicial na mesma operação, campos de triagem pendentes e alterações auditáveis pelo pessoal de suporte;
- `js/services/opening-domain.mjs`: validação e geração de títulos sem IA;
- `js/services/tickets.service.js`: preparação de tentativa de abertura, criação atômica e idempotente por IDs reutilizados, triagem transacional com verificação de versão e observação do histórico;
- `tests/sprint-1.7.1-a-domain.test.mjs`: **4 testes aprovados**;
- `tests/sprint-1.7.1-a-emulator.test.cjs`: **16 cenários aprovados** no Emulator Suite (abertura, negativa de acesso, isolamento, classificação, histórico, concorrência, assumir e responder sem classificação);
- `package.json` e `.github/workflows/storage-security.yml`: execução automatizada dos testes, incluindo regressões já existentes.

**Evidência CI:** GitHub Actions [run 42617461958](https://github.com/Walterudisson/sinal-HML/actions/runs/42617461958), conclusão **success**. Os testes anteriores de anexos (16), revogação (6) e funções (22) também passaram.

A interface ainda usa o formulário legado na branch e não chama `createConversationTicket`. As Rules novas exigem mensagem inicial atômica: **não publicar esta branch ou suas regras separadamente antes de concluir 1.7.1-B e C**. O fluxo atual no HML publicado não foi modificado.

**A fazer:** interface Modelo A, tratamento visual da fila `Sem triagem`, integração operacional, testes de concorrência em navegadores, homologação Android e revisão final de Rules. A PR deve permanecer em rascunho até autorização explícita. Não alterar PRD.


## Estado da fase 1.7.1-B em 09/11/2026

**Abertura conversacional implementada em branch, CI aprovada. Sem merge e sem deploy HML/PRD.**

- `index.html`: formulário substituído por mensagem única (3 a 4.000 caracteres) e anexo opcional, sem título/categoria/prioridade.
- `js/ui/signal-composer.js`: validação, feedback de rede, upload opcional, prevenção de envio duplo e transição para a conversa após fechamento do histórico do composer; preserva tentativa de envio e texto caso a confirmação seja incerta.
- `js/services/opening-attempt.mjs`: controlador puro que reusa IDs reservados em retentativas da mesma sessão e bloqueia mudanças de mensagem enquanto o envio anterior estiver incerto.
- `js/main.js`: integra `prepareConversationOpening` e `createConversationTicket`, mantém envio de anexos após a escrita atômica e abre a conversa diretamente; valida sessão antes de exibir.
- `js/ui/signal-composer.js`, `js/ui/ticket-detail.js` e `js/ui/central.js`: não apresentam prioridade fictícia "Normal" quando a triagem está pendente. A ação de classificar e os filtros operacionais completos pertencem à 1.7.1-C.
- `tests/sprint-1.7.1-b.test.mjs`: quatro verificações de tentativa, interface/integração e histórico Android.
- `tests/sprint-1.7.1-b-ui.test.mjs`: três simulações de UI (retentativa após erro, duplo envio, Voltar Android durante envio).
- `package.json` e `.github/workflows/storage-security.yml`: novos testes associados ao workflow HML.

**Evidência:** [GitHub Actions #42632318516](https://github.com/Walterudisson/sinal-HML/actions/runs/42632318516), conclusão `success`, com **7/7 testes da fase B**, **4/4 do domínio A**, **16/16 no emulador A** e regressões anteriores aprovadas.

**Limites de validação:** os sete testes B incluem inspeções estáticas, testes de lógica pura e simulações de DOM/histórico. Não substituem homologação real em navegador/Android e Firebase HML. A tentativa permanece em memória, não persistida em disco após recarregamento; queda/recarga durante confirmação incerta deve ser contemplada no endurecimento de recuperação do MVP. A fase C precisa implementar classificação e filtros antes de qualquer publicação da branch. Não promover as Rules isoladamente: o frontend publicado em HML ainda utiliza o formulário anterior.

**Próxima entrega:** 1.7.1-C, Central e Triagem, incluindo histórico visível e regressão dos tickets antigos e novos. Gate final de merge/deploy HML exige aprovação explícita.
