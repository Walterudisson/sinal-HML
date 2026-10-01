# Sprint 1.4 — Resolver e fechar sinais

## Fase 1.4.1: Resolução com privacidade (HML)

**Status:** Aguardando homologação HML.  
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

### Ordem de publicação em HML
1. Revisar a branch/PR. Publicar as regras `firestore.rules` desta branch no Console Firestore do projeto `sinaldesk-hml`.
2. Em seguida, fazer merge da branch em `main` de HML. Atualizar/recarregar a PWA.
3. Homologar com duas contas (atendente + solicitante). Testar resolução com e sem texto compartilhado, 3 modelos, acesso privado e histórico.
4. Confirmar no Firestore que o texto interno existe somente no documento `private/resolution`, e não no ticket principal.
5. Não promover para produção nem iniciar a fase 1.4.2 sem homologação explícita do usuário.

### Fase 1.4.2 prevista
- Notificação ao solicitante quando o sinal for assumido.
- Notificação ao solicitante quando o sinal for resolvido, sem qualquer trecho de solução técnica privada.
- Sino/toast/push/deep link existentes reutilizados, com roteamento pelos eventos `statusEvents`.

### Fora desta fase
- Reabertura, fechamento administrativo separado, atribuição manual por gestor, notas internas e TAGs.
