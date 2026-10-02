# UX-1 — roteiro de homologação HML

**Escopo:** separar Detalhes, Conversa pública e Finalizar atendimento, preservando todas as funcionalidades homologadas das fases 1.4.1 e 1.4.2.

## Testes técnicos no Codespace

Na branch deste PR, a partir da raiz:

```bash
node --check js/ui/ticket-detail.js
node --check js/ui/overlay-history.js
node --test tests/ux1.test.cjs
```

Os testes cobrem presença das três telas, exclusividade dos campos, alternância entre modos e retorno do histórico do navegador. **Não substituem a homologação visual em HML.**

## HML-UX1-01 — Solicitante: detalhes e conversa
- [ ] Abrir um sinal novo como solicitante. A primeira tela exibe título, status, prioridade, descrição e CTA **Abrir conversa**; não exibe formulário de resolução nem solução privada.
- [ ] Abrir conversa: em mobile, a conversa ocupa a tela toda; composer fica presente se o estado permitir, e não existe outro campo de escrita.
- [ ] Enviar mensagem pública: atendente responsável consegue visualizar e responder.
- [ ] Voltar pelo botão do aplicativo: retorna aos detalhes do **mesmo sinal**; usar também o botão Voltar do celular/navegador.
- [ ] Abrir novamente a conversa após voltar: histórico preservado.
- [ ] Um solicitante não visualiza canais internos fictícios, controles de gestor ou solução técnica.

## HML-UX1-02 — Atendente: operação e rascunho
- [ ] Abrir sinal não atribuído, assumir, visualizar status e responsável nos detalhes.
- [ ] Abrir conversa, digitar **rascunho sem enviar**, voltar e entrar novamente: rascunho preservado no mesmo sinal.
- [ ] Entrar em outro sinal: rascunho não migra para outro ticket.
- [ ] Iniciar resolução: abre tela separada com barra inferior **Cancelar / Confirmar resolução**, sem campo fixo de conversa.
- [ ] Cancelar: retorna aos detalhes e permite reabrir a conversa sem envio acidental.
- [ ] Reabrir resolução: compartilhamento de solução desmarcado inicialmente; texto técnico e texto público independentes.
- [ ] Confirmar resolução: status, histórico, acesso à solução interna e bloqueio de escrita após resolver preservados.

## HML-UX1-03 — Navegação, layout, notificações e regressão
- [ ] Desktop: painel de leitura e conversa funcionam sem sobreposição de formulários.
- [ ] Mobile: cabeçalho/Voltar acessíveis, teclado não esconde permanentemente o compositor e barra de resolução permanece disponível.
- [ ] Sinal abre em Detalhes pelo topo, sem rolar automaticamente ao fim da conversa.
- [ ] Novas mensagens só acompanham a rolagem quando usuário já está no final da conversa.
- [ ] Notificações de novo sinal, novas mensagens, assumir e resolver continuam funcionando no sino e no push.
- [ ] Ao tocar notificação push ou sino, o sinal correto abre nos detalhes; conversa pode ser acessada pelo CTA.
- [ ] Solução privada permanece invisível ao solicitante; nenhuma Firestore Rule foi modificada.

## Critério de saída
- Três etapas aprovadas explicitamente pelo responsável do projeto.
- Sem alteração das regras, mensagens existentes ou funções.
- Não promover para PRD antes da homologação UX-1, revisão do diff PRD/HML e aprovação da promoção conjunta.

## Fora de escopo
- Canal Equipe e canal Gestão; novas regras de acesso, participantes por canal, notificações internas e Central desktop em três colunas. Estes itens constam da especificação `UX-CONVERSAS-E-CANAIS.md` em PR de documentação independente.
