# Publicação coordenada | Sprint 1.7.1 HML

**Status: aguardando operação assistida.**  
**Alvo exclusivo:** repositório \`Walterudisson/sinal-HML\`, GitHub Pages HML e Firebase \`sinaldesk-hml\`.  
**Jamais executar no projeto PRD \`sinaldesk\`.**

## Por que há uma ordem obrigatória?

Na versão 1.7.0-C, o formulário cria um documento \`ticket\` sem a primeira mensagem. Na 1.7.1, o Firestore exige a criação **atômica** do ticket e da primeira mensagem, com \`firstMessageId\`. As versões de frontend e Rules não são compatíveis durante o intervalo de migração.

Consequentemente, a publicação deve ocorrer em janela curta de manutenção HML, com operadores informados para não abrir sinais durante o intervalo. Não publicar automaticamente apenas uma das partes. A regra final é estrita por segurança; **não adicionar liberação de escrita legacy sem nova revisão de segurança**, pois permitiria ao solicitante escolher prioridade/categoria por API.

## Preparação obrigatória

- [ ] PR #45 permanece em draft até revisão final, CI verde no último SHA e autorização explícita do responsável.
- [ ] Cloud Shell autenticado no projeto HML, repositório local sem alterações não salvas.
- [ ] \`main\` HML e PRD anotadas para verificação de reversão.
- [ ] Operadores cientes de que HML pode rejeitar novas aberturas durante a curta migração.
- [ ] Saber que serviço no PWA pode usar cache antigo; atualizar/reabrir o app.
- [ ] Identificar que **não é necessário publicar Storage Rules/Functions** nesta sprint, apenas Firestore Rules e frontend GitHub Pages.
- [ ] Não executar em dia/horário em que usuários estejam realizando testes HML.

## Passo 1. Preparar Cloud Shell (sem deploy)

No Cloud Shell, na pasta do repositório HML:

\`\`\`bash
cd ~/sinal-HML
git status --short
git fetch origin
git switch sprint/1.7.1-preparacao-conversa-triagem 2>/dev/null || git switch --track origin/sprint/1.7.1-preparacao-conversa-triagem
git pull --ff-only origin sprint/1.7.1-preparacao-conversa-triagem
git rev-parse --short HEAD
firebase projects:list
\`\`\`

Se \`git status --short\` exibir arquivos modificados, **pare e não descarte alterações**. A lista de projetos deve conter \`sinaldesk-hml\`. Não presumir que seleção padrão da CLI é HML: usar sempre \`--project sinaldesk-hml\`.

## Passo 2. Preparar rollback local e conferir Rules

\`\`\`bash
git show origin/main:firestore.rules > /tmp/sinal-hml-firestore-1.7.0-c.rules
git show origin/main:js/config/version.js
git diff --stat origin/main...HEAD
grep "APP_VERSION" js/config/version.js
grep "sinal-shell-hml-" service-worker.js
\`\`\`

Deve exibir \`APP_VERSION = '1.7.1'\`. Verificar CI verde antes de continuar.

## Passo 3. Iniciar manutenção e publicar apenas Firestore Rules

**Executar exclusivamente depois da conferência e com operador disponível para merge imediato**:

\`\`\`bash
firebase deploy --only firestore:rules --project sinaldesk-hml
\`\`\`

Guardar o log. Em caso de erro, **não mesclar** PR #45. Após êxito, a interface HML antiga pode rejeitar aberturas até que a nova chegue ao GitHub Pages; não deixar o intervalo se prolongar sem executar o passo 4 ou rollback.

## Passo 4. Merge do PR #45 na main HML

Mesclar PR #45 **somente após o sucesso do passo 3**; o merge poderá ser feito via integração GitHub do ChatGPT assim que o operador confirmar, ou pela interface do GitHub mediante orientação. A publicação do frontend depende da configuração atual de GitHub Pages e pode levar um período de propagação; verificar antes de abrir os testes.

Não confundir merge de PR #44, somente documental, com PR #45.

## Passo 5. Conferir publicação e realizar smoke test

1. Abrir \`https://walterudisson.github.io/sinal-HML/\` e conferir **Mais → HML v1.7.1**. Em Android PWA, fechar/reabrir e atualizar cache se necessário.
2. Solicitante Teste: criar um sinal **sem anexo**, com mensagem única, e verificar a conversa imediata e o protocolo.
3. Solicitante Teste: criar um sinal com imagem; conferir anexo e conversa.
4. Atendente Teste: Central → **Sem triagem** → **Classificar**; definir categoria e prioridade e salvar.
5. Verificar histórico de triagem e visibilidade de respostas. Confirmar que um solicitante não vê o painel administrativo.
6. Confirmar que sinais 1.7.0-C antigos permanecem acessíveis. Testar Voltar Android e notificações.
7. Completar o roteiro \`HOMOLOGACAO-SPRINT-1.7.1.md\`, inclusive negativas no emulador e cenários reais multi-tenant quando disponíveis.

## Rollback seguro em HML

**Se o deploy das Rules ocorrer, mas o frontend novo não for publicado:** reimplantar as **regras antigas** a partir de uma cópia comprovadamente idêntica à \`main\` pré-merge:

\`\`\`bash
cp /tmp/sinal-hml-firestore-1.7.0-c.rules firestore.rules
firebase deploy --only firestore:rules --project sinaldesk-hml
\`\`\`

**Atenção:** esse comando modifica o arquivo de trabalho local. Preservar a cópia antiga; restaurar o arquivo da branch antes de novos commits/ações. Se já houve merge e publicação de frontend 1.7.1, o rollback exige **também** restaurar o frontend 1.7.0-C em GitHub Pages, coordenando a ordem para evitar incompatibilidade. **Não executar rollback isolado** sem orientação e verificação do SHA.

Se ocorrer falha após criar tickets 1.7.1 em HML, **não excluir dados automaticamente**; documentar novos IDs. O frontend antigo continua apto a ler tickets, mas a lógica de exibição será diferente.

## Critério de encerramento

- CI final verde.
- Rules HML e frontend HML publicados e verificados no mesmo ciclo.
- Homologação funcional pelo usuário, teste por teste, sem declarar sucesso apenas por CI.
- PRD sem alteração.
