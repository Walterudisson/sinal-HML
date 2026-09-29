# Sinal — Homologação da Sprint 1.0

## Mandar um sinal

**Ambiente:** HML  
**Data da execução:** ____________________  
**Responsável:** Walter Udisson  
**URL testada:** ____________________

---

## Pré-condições

- Sprint 0.3 homologada.
- Firebase: `sinaldesk-hml`.
- Usuário: `walter.udisson@gmail.com`.
- UID HML: `rSbmd9g17XckHd87pxgsNjH1im12`.
- `firestore.rules` desta sprint publicada.

---

## HML-1.0-01 — Regressão: login e contexto

1. Abra HML em janela privada.
2. Faça login.

Esperado:

- [ ] Login concluído.
- [ ] Organização `Sinal`.
- [ ] Papel `Administrador`.
- [ ] Badge `Superadmin`.
- [ ] Nenhum erro no carregamento.

**Resultado:** [ ] APROVADO [ ] REPROVADO

---

## HML-1.0-02 — Abrir composer no desktop

1. Clique em `Mandar um sinal`.

Esperado:

- [ ] Modal central é exibido.
- [ ] Fundo fica escurecido.
- [ ] Campo `O que aconteceu?` recebe foco.
- [ ] Campos Categoria, Prioridade e descrição estão acessíveis.
- [ ] `Esc` fecha o composer.
- [ ] `Cancelar` fecha sem criar documento.

**Resultado:** [ ] APROVADO [ ] REPROVADO

---

## HML-1.0-03 — Abrir composer no mobile

Em smartphone real:

1. Toque em `Mandar um sinal`.
2. Abra o teclado.
3. Navegue por todos os campos.

Esperado:

- [ ] Composer ocupa espaço adequado à tela.
- [ ] Não existe rolagem horizontal.
- [ ] Campos não ficam inacessíveis com o teclado.
- [ ] Botões permanecem confortáveis para toque.
- [ ] Fechar/Cancelar funcionam.

**Resultado:** [ ] APROVADO [ ] REPROVADO

---

## HML-1.0-04 — Validação do formulário

1. Abra `Mandar um sinal`.
2. Tente enviar tudo vazio.
3. Depois preencha somente parte dos campos.

Esperado:

- [ ] Formulário impede envio incompleto.
- [ ] Nenhum documento é criado no Firestore.
- [ ] Contadores de caracteres funcionam.

**Resultado:** [ ] APROVADO [ ] REPROVADO

---

## HML-1.0-05 — Criar primeiro sinal

Preencha:

**O que aconteceu?**  
`Não consigo acessar o sistema de teste`

**Categoria**  
`Sistemas`

**Prioridade**  
`Normal`

**Descrição**  
`Ao tentar entrar no sistema de teste, a tela retorna erro de acesso. O problema começou hoje durante a homologação.`

Toque/clique em `Enviar sinal`.

Esperado:

- [ ] Botão muda para `Enviando...`.
- [ ] Composer fecha após sucesso.
- [ ] Toast aparece no **canto superior direito**.
- [ ] Título do toast: `Sinal recebido`.
- [ ] Toast informa o código `S-XXXXXX`.
- [ ] Novo sinal aparece em `Meus sinais`.
- [ ] Contador passa para `1`.
- [ ] Sinal também aparece na área `Sinais`.

**Resultado:** [ ] APROVADO [ ] REPROVADO

---

## HML-1.0-06 — Conferência no Firestore

No Firebase Console:

`tenants → sinal-interno → tickets → {ticketId}`

Esperado:

- [ ] Documento foi criado.
- [ ] `title` corresponde ao teste.
- [ ] `category = sistemas`.
- [ ] `priority = normal`.
- [ ] `status = open`.
- [ ] `requesterUid = rSbmd9g17XckHd87pxgsNjH1im12`.
- [ ] `createdByUid` é o mesmo UID.
- [ ] `requesterEmail = walter.udisson@gmail.com`.
- [ ] `assigneeUid = null`.
- [ ] `teamId = null`.
- [ ] `createdAt` e `updatedAt` são timestamps.
- [ ] Existe código no formato `S-XXXXXX`.

**Resultado:** [ ] APROVADO [ ] REPROVADO

---

## HML-1.0-07 — Criar segundo sinal e atualização em tempo real

Sem recarregar a página, crie outro sinal.

Esperado:

- [ ] Segundo sinal aparece automaticamente.
- [ ] Contador passa para `2`.
- [ ] Sinal mais recente aparece antes do anterior.
- [ ] Não é necessário atualizar o navegador.

**Resultado:** [ ] APROVADO [ ] REPROVADO

---

## HML-1.0-08 — Persistência dos sinais

1. Recarregue a página.
2. Acesse a área `Sinais`.

Esperado:

- [ ] Os sinais continuam listados.
- [ ] Contador mantém o total correto.
- [ ] Dados principais permanecem corretos.

**Resultado:** [ ] APROVADO [ ] REPROVADO

---

## HML-1.0-09 — Toasts

1. Crie um sinal.
2. Observe a notificação.

Esperado:

- [ ] Toast aparece no topo à direita.
- [ ] Não cobre permanentemente a navegação principal.
- [ ] Pode ser fechado manualmente.
- [ ] Desaparece automaticamente.
- [ ] Layout permanece adequado no smartphone.

**Resultado:** [ ] APROVADO [ ] REPROVADO

---

## HML-1.0-10 — Regressão: navegação

Navegue por:

`Início → Sinais → Base → Mais → Início`

Esperado:

- [ ] Navegação mobile funciona.
- [ ] Sidebar desktop funciona.
- [ ] A lista de sinais continua correta.
- [ ] Nenhum conteúdo é duplicado.

**Resultado:** [ ] APROVADO [ ] REPROVADO

---

## HML-1.0-11 — Regressão: sessão e logout

1. Recarregue autenticado.
2. Confirme contexto e sinais.
3. Faça logout.
4. Recarregue.

Esperado:

- [ ] Sessão persiste antes do logout.
- [ ] Contexto e sinais são restaurados.
- [ ] Logout retorna ao login.
- [ ] Sessão não volta após recarregar.

**Resultado:** [ ] APROVADO [ ] REPROVADO

---

## HML-1.0-12 — Smoke: recuperação de senha

1. Deslogado, informe o e-mail.
2. Acione `Esqueci minha senha`.

Esperado:

- [ ] Solicitação é aceita.
- [ ] Nenhum erro novo foi introduzido no módulo de autenticação.

**Resultado:** [ ] APROVADO [ ] REPROVADO

---

# Resultado geral

- [ ] SPRINT 1.0 APROVADA
- [ ] SPRINT 1.0 REPROVADA
- [ ] APROVADA COM CORREÇÕES PENDENTES

## Bugs / observações

| ID | Cenário | Descrição | Severidade |
|---|---|---|---|
| | | | |
| | | | |
