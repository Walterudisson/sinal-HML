# Sprint 1.7.1 | Conversa Primeiro e Triagem Inteligente

**Estado:** ESCOPO APROVADO em 09/11/2026; preparação documental. **Código ainda não implementado.**  
**Ambiente permitido:** HML (repositório \`Walterudisson/sinal-HML\`, Firebase \`sinaldesk-hml\`).  
**Base:** HML 1.7.0-C, funcionalmente homologada; pendências técnicas da 1.7.0-B/C continuam abertas.  
**Entrega prevista:** 1.7.1, somente após validação técnica, testes, merge autorizado e deploy em HML.  
**PRD:** proibida qualquer modificação ou promoção nesta sprint sem decisão específica posterior.  
**Dependência documental:** PR #44 (DP-022 a DP-026), ainda em rascunho; incorporar as diretrizes ao documento oficial quando autorizado.

## 1. Propósito

O solicitante deve abrir um sinal **enviando uma única mensagem**, com anexo opcional, e iniciar imediatamente a conversa. O sistema registra protocolo e título técnico, mas o solicitante não precisa informar título, categoria ou prioridade. A equipe de atendimento classifica, prioriza e gerencia o sinal de maneira segura.

Princípio: **para quem solicita, uma conversa; para quem atende, uma ferramenta de gestão**. O Sinal começa no suporte de TI, mas será uma plataforma SaaS de atendimento corporativo, preparada para outros departamentos sem ampliar a complexidade do fluxo de abertura.

## 2. Escopo aprovado

### A. Solicitante: Conversa Primeiro

1. Substituir título + categoria + prioridade + descrição por **uma mensagem inicial obrigatória**, de 3 a 4.000 caracteres válidos após remoção de espaços nas bordas.
2. Manter **um anexo opcional** na abertura (JPG/PNG/WebP/PDF, até 10 MiB), com progresso, falha e cancelamento conforme 1.7.0-C.
3. Gerar **título técnico automaticamente** e deterministicamente: primeira linha significativa da mensagem, normalizada para uma linha, truncada sem cortar palavra quando possível, até 80 caracteres; nunca usar IA nem expor o campo ao solicitante.
4. Criar o documento do sinal e sua primeira mensagem pública **na mesma operação atômica**; o texto original deve ser preservado, inclusive quebras de linha.
5. Status inicial \`open\`; código \`S-XXXXXX\`; \`category: null\`, \`priority: null\`, \`assigneeUid: null\` e \`teamId: null\`; nenhum estado novo "em triagem".
6. Depois de confirmar a criação, abrir a conversa do novo sinal diretamente (e não a ficha técnica). Em *Meus Sinais*, priorizar a conversa, com detalhes técnicos acessíveis secundariamente.
7. Exibir retorno de sucesso com código do sinal. Não criar sinais duplicados por duplo toque, reenvio acidental, reconexão ou resposta incerta do servidor.
8. Após gravar sinal + mensagem, transferir o anexo opcional pelo fluxo privado já homologado; falha/cancelamento de anexo **não remove** o sinal nem a primeira mensagem, e permite reenvio pela conversa.
9. Em falha anterior à confirmação do sinal, preservar texto e anexo selecionado; mostrar erro e permitir nova tentativa segura, sem presumir que a escrita falhou quando sua resposta é incerta.
10. Respeitar Android/PWA: botão Voltar, teclado, foco, scroll e visualização privada de imagens.

### B. Atendente: triagem

1. Mostrar sinais abertos sem classificação na Central; indicador **Sem triagem**; filtro correspondente e contagem coerente.
2. Categoria e prioridade passam a ser preenchidas **pela equipe**. Valores atuais: categoria \`acesso\`, \`equipamento\`, \`rede\`, \`sistemas\`, \`outro\`; prioridade \`baixa\`, \`normal\`, \`alta\`, \`urgente\`. A parametrização por organização é futura.
3. O agente autorizado pode classificar sinal **sem responsável**; depois de assumido, o responsável, admin ou supervisor podem atualizar. Admin e supervisor podem corrigir a classificação de qualquer sinal não resolvido do próprio tenant.
4. Um sinal pode ser **assumido e atendido sem classificação**. Nenhuma classificação pendente bloqueia conversa, atribuição ou resolução, mas permanece sinalizada na Central até ser realizada.
5. Alterações de categoria, prioridade e título técnico gerado devem guardar **autor, horário, antes e depois** em histórico auditável. O histórico não deve permitir manipulação pelo solicitante.
6. O solicitante pode visualizar apenas o necessário para acompanhar o atendimento e jamais alterar categoria, prioridade ou título por API ou diretamente pelo Firestore.
7. Não mudar os fluxos existentes de \`open\` → \`in_progress\` → \`resolved\` e reabertura, nem quebrar cards, linha do tempo ou notificações.
8. A fila **Precisa de atenção** deve continuar destacando \`alta/urgente\` e também considerar sinais sem triagem dentro de um critério explícito, sem tratá-los como prioridade baixa/normal. Preferir filtro próprio e indicador de pendência, com ordem cronológica estável enquanto não classificados.
9. Atualizações concorrentes: usar escrita atômica/transacional e rejeitar sobrescrita silenciosa por um atendente com dados desatualizados.

## 3. Contratos de dados e compatibilidade

Caminhos mantidos:

- \`tenants/{tenantId}/tickets/{ticketId}\`
- \`tenants/{tenantId}/tickets/{ticketId}/messages/{messageId}\`
- \`tenants/{tenantId}/tickets/{ticketId}/attachments/{attachmentId}\`
- \`tenants/{tenantId}/tickets/{ticketId}/statusEvents/{eventId}\`
- Novo caminho proposto: \`tenants/{tenantId}/tickets/{ticketId}/triageEvents/{eventId}\` para classificação e alterações de título.

Documento novo do ticket preserva os campos existentes e acrescenta \`firstMessageId\` para vincular a escrita atômica. \`description\` é uma cópia íntegra da mensagem inicial para compatibilidade com cartões, busca e histórico; **a conversa renderiza a mensagem da subcoleção uma única vez**, sem construir uma segunda bolha sintética a partir de \`description\`. Opcionalmente, registrar \`lastInteraction*\` da primeira mensagem já na criação, desde que compatível com as regras e notificações existentes.

**Categoria/prioridade pendentes:** representar explicitamente \`null\` nos tickets novos. O frontend não pode converter \`null\` em Normal por fallback. Sinais anteriores, que possuem valores válidos, não serão migrados ou alterados automaticamente; leituras e filtros devem funcionar para ambos os formatos.

Histórico \`triageEvents\`: evento imutável, contendo \`type\` (\`classified\`, \`reclassified\` ou \`title_changed\`), \`from\`/\`to\` dos campos relevantes, \`actorUid\`, \`actorName\` e \`createdAt\`. Em caso de maior simplicidade, diferenciar tipos por campo alterado, contanto que existam valores anterior/novo, autoria e hora, com escrita atômica vinculada ao ticket.

Títulos gerados devem ser editáveis exclusivamente pela equipe autorizada, com trilha histórica. O texto original da solicitação não é modificado por isso.

### Segurança

- **Firestore Rules:** criação de ticket somente pelo usuário autenticado, membro ativo do tenant; permitir \`null\` e restringir os demais campos e seus tipos; garantir autor real da primeira mensagem e consistência da ligação \`firstMessageId\`/documento criado no mesmo batch; negar inserções ou edições arbitrárias.
- **Mensagens:** primeira mensagem é criada no mesmo batch do ticket e sob regra própria, sem liberar escrita a terceiros ou em tickets alheios; mensagens subsequentes seguem a regra \`canReplyToTicket\` existente.
- **Triagem:** permitir apenas papeis \`admin\`, \`supervisor\`, \`agente\` nas condições de atribuição definidas; \`request.resource.data.diff(...)\` precisa limitar os campos; registrar histórico no mesmo commit e não permitir \`update/delete\` de eventos.
- **Concorrência:** validar o estado atual do sinal na atualização e o vínculo com o evento, evitando mudanças conflitantes ou falsificação de auditoria. Não enfraquecer as regras já homologadas de assumir/resolver/reabrir.
- **Cross-tenant:** negar acesso e alterações por outro tenant, membro inativo, usuário de outro perfil ou identidade forjada.
- **Storage:** conservar o protocolo privado atual; sem URLs públicas e sem modificar tipos ou limites nesta sprint.
- **Notificações:** criar **um** evento de novo sinal para equipe, sem notificação redundante gerada pela primeira mensagem. A notificação já existente do \`notifyNewMessage\` deve continuar normal para respostas posteriores.

### Idempotência e rede

A implementação deve reservar um \`ticketId\` antes do primeiro envio e manter a mesma tentativa quando a confirmação for incerta. É necessário prevenir duplicação por clique duplo, queda de rede ou retry após timeout. Não repetir \`setDoc\` inadvertidamente em um ID já criado; preferir \`batch.create\` via backend ou transação/client batch compatível com regras de criação, identificando "já criado" após reconexão. Não declarar sucesso sem confirmação do Firestore.

## 4. Arquivos sob impacto (planejado, ainda sem modificação)

| Arquivo | Finalidade |
|---|---|
| \`index.html\` | Nova abertura por mensagem e triagem no detalhe/central |
| \`js/ui/signal-composer.js\` | Campo único, validação, anexos, abertura da conversa |
| \`js/services/tickets.service.js\` | Criação atômica, título automático e atualização de classificação |
| \`js/services/messages.service.js\` | Estrutura compartilhada da primeira mensagem |
| \`js/main.js\` | Orquestração e abertura direta da conversa |
| \`js/ui/central.js\` | Estados sem triagem, filtros e ordenação |
| \`js/ui/ticket-detail.js\` | Controles de triagem e experiência distinta por papel |
| \`js/ui/home.js\` | Tratamento consistente de categoria/prioridade ausentes |
| \`firestore.rules\` | Criação atômica, permissão de triagem e imutabilidade de histórico |
| \`tests/*\` e \`functions/*\` (se necessário) | Segurança, regressão e notificações; sem Cloud Function nova por padrão |
| \`js/config/version.js\` e cache PWA | Identificação HML após publicação autorizada |

Consultar o código real antes de modificar cada arquivo e atualizar os testes dependentes. A entrega de UI e de regras deverá ocorrer de modo compatível no HML; não publicar um frontend que dependa de regras ainda não implantadas.

## 5. Sequenciamento da implementação controlada

### Fase 1.7.1-A: contrato e segurança
- Preparar testes de Firestore Emulator cobrindo criação atômica e negativas de autorização.
- Implementar domínio do ticket, título gerado, primeira mensagem vinculada e segurança de triagem/histórico.
- Validar regra de criação existente e novo caminho sem quebrar sinais históricos.
- Tratar idempotência de submissão e concorrência.

### Fase 1.7.1-B: solicitante
- Substituir formulário tradicional pelo Modelo A, preservar anexo opcional.
- Após criação, apresentar conversa automaticamente; manter histórico Android e regressão do modal de imagem.
- Validar login, logout e submissão em conexões instáveis, PWA Android e desktop.

### Fase 1.7.1-C: atendente e estabilização
- Adicionar ação de classificação, editar título, filtros de Sem triagem e auditoria.
- Conferir cards, contexto de solicitante, push e mensagens.
- Executar a matriz completa de homologação; corrigir e repetir testes impactados.

## 6. Gates obrigatórios

- [ ] Código desenvolvido **somente em branch do repositório HML**.
- [ ] Testes de Rules e regressão no emulador aprovados, inclusive negações cross-tenant.
- [ ] Segurança das alterações de categoria/prioridade/título revisada.
- [ ] Simulação de falha de conexão e idempotência aprovada.
- [ ] Notificações e anexos sem regressão.
- [ ] Pendências de limpeza de anexos e isolamento multi-tenant da 1.7.0-C reavaliadas antes de qualquer promoção de release.
- [ ] CI aprovada.
- [ ] **Merge na \`main\` HML somente após autorização explícita.**
- [ ] Deploy Firebase exclusivamente no \`sinaldesk-hml\`, mediante validação/autorização apropriada.
- [ ] Homologação funcional em HML Android e navegador, com roteiro específico.
- [ ] **PRD permanece intocada**; promoção a PRD exigirá decisão de release separada.

## 7. Fora do escopo

Cadastro e administração de usuários (1.7.2), reatribuição avançada (avaliar no MVP 1.8.0), equipes, notas internas, SLA, catálogo parametrizável, áudio, vídeo, múltiplos anexos, widget incorporado, Sinal Coletivo, QR Code e Sinal Proativo.

Essas evoluções permanecem no roadmap, mas não bloqueiam a Sprint 1.7.1.
