# Sprint 1.4 — Resolver e fechar sinais

## Fase 1.4.1: Resolução com privacidade (HML)

**Status:** 1.4.1 homologada em HML; 1.4.2 em preparação para homologação.  
**Origem:** Sprint 1.3.4 homologada HML/PRD.

### Entrega
- Apenas o atendente responsável pode resolver um sinal `in_progress`.
- Descrição técnica obrigatória, salva em `tickets/{ticketId}/private/resolution`; leitura exclusiva para perfis de suporte ativos.
- Compartilhamento desmarcado por padrão. Quando ativado, campo público próprio e 3 modelos clicáveis e editáveis; o texto técnico jamais é copiado automaticamente.
- Marcação de candidata à Base na resolução privada; não publica artigos.
- Registro atômico de mudanças em `statusEvents`, incluindo assumir sinal e resolver sinal.
- Os documentos públicos do ticket incluem somente status, metadados da resolução e mensagem explicitamente compartilhada.
- Solicitante e atendimento visualizam o histórico de status. Apenas suporte tem permissão de ler a solução interna.
- Ao resolver, a conversa fica em modo leitura até a futura função Reabrir sinal.

### Homologação concluída da fase 1.4.1
- HML-1.4.1-01, -02, -03, -04A e -04B aprovados manualmente.
- HML-1.4.1-04C: quatro testes de segurança aprovados no emulador local; nenhuma falha.
- A correção da rolagem do detalhe também foi aprovada em HML.
- A promoção para PRD foi adiada por decisão do usuário até a homologação da 1.4.2.

### Fase 1.4.2: Notificações de status (HML)
- Cloud Function `notifyTicketStatus` criada no evento `statusEvents/{eventId}`, que é gravado atomicamente com a mudança do sinal.
- `claimed` avisa o solicitante ativo: "Seu sinal está em atendimento", com o nome do atendente.
- `resolved` avisa o solicitante ativo: "Seu sinal foi resolvido", sem incluir textos de resolução privados nem públicos no push.
- O autor não recebe notificação de si próprio. Os outros agentes também não recebem estes dois avisos.
- Notificações da etapa têm ID estável `status-{ticketId}-{eventId}`, criada condicionalmente no Firestore, evitando duplicidade no sino e novo envio de push se o mesmo evento for reentregue.
- O aviso usa o sino, toast, push e deep link existentes, sem alterar a interface. Tocar abre o sinal correspondente.
- Limitação técnica: após a gravação da notificação, falhas excepcionais antes do envio podem impedir o push daquela ocorrência. A notificação interna permanece salva; entrega de push é de melhor esforço. Não se promete entrega exatamente uma vez por dispositivos.
- As funções anteriores `notifyNewTicket` e `notifyNewMessage` continuam ativas sem alterações de regra de negócio.
- Não há alterações de `firestore.rules` nem da PWA nesta etapa.
- O deployment necessário é somente da nova Cloud Function no projeto **sinaldesk-hml**, região **southamerica-east1**.

#### Entrega e homologação
1. Abrir PR de 1.4.2 no GitHub e revisar o diff restrito.
2. Validar os testes locais com `cd functions && npm test` (Node 22).
3. Após merge em HML, fazer deploy apenas da nova função: `firebase deploy --only functions:notifyTicketStatus --project sinaldesk-hml`.
4. Usar um sinal novo criado pelo Solicitante Teste, atendido por Walter ou Atendente Teste. Verificar primeiro o aviso de assumir e depois o de resolver, tanto no sino como em push com o app em segundo plano. Confirmar que o link abre o sinal correto.
5. Checar no Firestore que cada evento gerou exatamente uma notificação para o solicitante, que não há solução interna nos campos do aviso e que o autor não foi notificado.
6. Registrar a aprovação da 1.4.2. Só então promover **1.4.1 e 1.4.2 juntas** para PRD.

#### Exclusões
- Atribuição manual de um sinal a outro agente, avisos ao técnico designado por gestor: sprint de equipes/atribuição.
- Preferências por tipo de alerta: sprint posterior de gestão de notificações.

### Fora desta fase
- Reabertura, fechamento administrativo separado, atribuição manual por gestor, notas internas e TAGs.
