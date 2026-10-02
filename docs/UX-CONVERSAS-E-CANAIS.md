# Sinal: UX de detalhes, conversas e canais internos

**Status:** direção aprovada pelo responsável do projeto; arquitetura detalhada proposta para validação por sprint.
**Ambientes:** desenvolver e testar em HML; não promover para PRD sem aprovação.
**Referência:** feedback após homologação da 1.4.2: campo de resposta fixo compete visualmente com o formulário de resolução em telas mobile.

## 1. Princípios da experiência

1. **O sinal não é a conversa:** detalhes e ações do chamado constituem um espaço próprio; a conversa é aberta como ambiente independente, contextualizado pelo sinal.
2. **Mobile-first:** no telefone, abrir a conversa em uma view/modal full-screen, com botão Voltar explícito e integração com o histórico do dispositivo; preservar o contexto e rascunhos ao navegar. Não apresentar dois compositores simultaneamente.
3. **Desktop:** inicialmente, detalhes e conversa podem aparecer em duas regiões; em etapa futura, Central de três colunas (lista de sinais, conversa ativa, detalhes contextuais) com layout responsivo.
4. **Menos caminhos para o solicitante:** apresentar somente Detalhes, Conversa pública, andamento/histórico público e resolução compartilhada, se houver; nunca expor canais internos ou navegação vazia.
5. **Ações operacionais separadas da escrita:** Assumir/Resolver pertencem aos detalhes, nunca à barra de composição de mensagens. A resolução tem formulário e confirmação próprios.
6. **Privacidade é decisão do servidor:** abas, etiquetas e cores apenas representam permissões impostas pelas Firestore Rules, não são barreira de acesso.

## 2. Telas por perfil

### Solicitante
- Tela do sinal: título, código, status, prioridade, descrição inicial, responsável, histórico público e mensagem de solução compartilhada, quando existir.
- CTA principal **Abrir conversa**, sinalizando mensagens não lidas em evolução futura.
- Conversa: somente canal **Solicitante**, identificado por rótulo neutro; campo de mensagem disponível enquanto o estado permitir, ou leitura quando resolvido.
- Não renderizar controles ou pistas sobre canais Equipe/Gestão.

### Atendente
- Tela do sinal: dados, solicitante, responsável, histórico, solução técnica privada quando autorizada e ações Assumir/Resolver conforme estado e atribuição.
- CTA **Abrir conversa**, inicialmente pública. Quando canais internos existirem, disponibilizar seletor de canal com identidade visual contextual e aviso persistente de público-alvo.
- Em cada canal, apenas um compositor, título e destinatários explícitos. Preservar rascunho **por sinal e por canal**, nunca transportar texto de um canal para outro.
- Resolução: formulário próprio. Antes de confirmar, indicar explicitamente o texto compartilhado (opt-in desmarcado por padrão) e o texto técnico privado. Ao concluir, retornar aos detalhes e não enviar mensagem extra automaticamente.

### Gestor/supervisor
- Visibilidade condicionada a vínculo ativo com tenant, vínculo ao sinal e permissões futuras de equipe/gestão, não apenas a presença da aba.
- Consulta de detalhes e canais autorizados, com trilha de autoria e horários.
- Fluxo futuro **Solicitar decisão**, associado ao sinal, com estado auditável e participantes definidos; não equivale a uma mensagem simples.

## 3. Canais e fronteiras de segurança

| Canal | Quem vê | Quem escreve | Observações |
|---|---|---|---|
| Solicitante (público) | Solicitante do sinal e equipe de suporte autorizada | Solicitante e atendente atribuído, sujeitos ao estado | Preserva regras e coleção atual de mensagens públicas na fase inicial. |
| Equipe (interno) | Apenas equipe autorizada **com vínculo ao sinal** | Membros autorizados; política detalhada antes de ativar | Novo canal e novas Firestore Rules; não reutilizar campo de conversa pública. |
| Gestão (restrito) | Participantes autorizados designados no sinal, incluindo gestor | Participantes autorizados, conforme política | Definir elegibilidade, inclusão/remoção, auditoria e quem pode criar antes de lançar. |

**Importante:** o modelo atual permite a todos os membros ativos de suporte lerem determinados dados do tenant. Isso **não** autoriza automaticamente expor futuras conversas privadas da equipe ou gestão para todos os agentes. Especificar escopo de equipe/participantes e testar acesso cruzado no Emulator antes de publicar qualquer canal novo.

### Modelo de dados: decisão adiada e migração segura
- Hoje: `tenants/{tenantId}/tickets/{ticketId}/messages/{messageId}`, visibilidade pública. Manter leitura e gravação existentes na separação inicial da interface.
- Futuro: considerar `tickets/{ticketId}/channels/{channelId}` + `channels/{channelId}/messages/{messageId}`, com metadados de classe de canal, participantes e política de acesso validados por regras. Avaliar custos de consultas, índices, notificações, migração e riscos antes de definir esquema final.
- **Não renomear/migrar a coleção pública atual** durante a primeira sprint visual.
- Identidade e permissões por tenant; autor da mensagem é sempre `request.auth.uid`. Separar regras de leitura/escrita de cada canal.
- Política para histórico quando participante é removido, retenção e trilhas administrativas devem ser decididas antes da ativação de canais internos.

## 4. Interações e comportamento

- Em mobile, CTA da conversa abre tela full-screen; voltar retorna aos detalhes do **mesmo sinal**, sem rolagem involuntária.
- Se a conversa for encerrada/resolvida, input vira leitura e exibe explicação contextual. Reabertura permanece fora deste escopo.
- Mudar de canal não envia nem copia textos. Confirmação adicional apenas se houver risco real de perda do rascunho.
- Cores, rótulos e ícones distinguem canais, mas identificação textual é obrigatória para acessibilidade.
- Notificações da Sprint 1.4.2 e deep link devem abrir **o sinal correto**; futura especificação definirá se avisos de mensagem abrem diretamente a conversa/canal permitido. Nunca colocar prévia de canal interno em push sem política de privacidade apropriada.
- Desktop usa largura disponível; mobile evita modais encaixados e barras simultâneas de escrita.

## 5. Plano de implementação e critérios de homologação

### Etapa UX-1: separação visual, sem novas permissões
- Refatorar a visualização do sinal em **Detalhes** e **Conversa** independente, preservando serviço de mensagens públicas e histórico.
- Manter resolução nos detalhes, fora da conversa. Garantir um único compositor visível.
- Preservar o funcionamento atual das fases 1.4.1 (solução privada) e 1.4.2 (avisos) e a rolagem homologada.
- Testar mobile e desktop: abrir/fechar conversa, voltar Android/navegador, rascunho, resolver/cancelar, deep link, toast, push e leitura após resolução.
- Sem mudança de regras/coleções nesta etapa.

### Etapa UX-2: desktop produtivo
- Central com painel de lista, conversa e detalhes contextualizados; colapsar responsivamente no mobile.
- Validar ergonomia com atendente de múltiplos sinais antes de adotar atalhos e navegação em massa.

### Etapa CANAIS-1: colaboração interna
- Definir participantes por ticket/equipe, políticas explícitas de leitura/escrita e regras em Firestore Emulator.
- Canal interno isolado, componentes de composição próprios e notificações privadas apropriadas.
- Testes negativos obrigatórios: solicitante, atendente de equipe não autorizada, outro tenant; testes positivos de participantes autorizados.

### Etapa GESTÃO-1: canal com gestor e solicitações de decisão
- Grupo de participantes nomeado, histórico e solicitações de decisão com estados claros e auditoria.
- Avaliar separação entre canal privado e fluxo de aprovações: aprovar não deve depender da leitura de uma mensagem.

## 6. Estado da entrega e promoção

- **1.4.1 e 1.4.2:** homologadas em HML; ainda não promovidas para PRD.
- **PR #7 (ajuste pontual de barra da resolução):** deixar em rascunho, sem merge. Sua intenção será incorporada à UX-1, evitando duas refatorações concorrentes.
- **Esta especificação é documentação, não altera o aplicativo.** Implementar UX-1 em PR de código independente e homologar antes de decidir se entra na promoção conjunta ou em promoção posterior.
- Não iniciar canais internos com permissões simuladas só no frontend. Entregar esquema+regras+testes em sprint própria.
