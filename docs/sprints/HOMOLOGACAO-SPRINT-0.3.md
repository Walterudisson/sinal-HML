# Sinal — Homologação da Sprint 0.3

## Shell autenticado + contexto multi-tenant

**Ambiente:** HML  
**Data da execução:** ____________________  
**Responsável:** Walter Udisson  
**URL testada:** ____________________

---

## Pré-condições

- Usuário HML `walter.udisson@gmail.com` ativo.
- UID HML: `rSbmd9g17XckHd87pxgsNjH1im12`.
- `firestore.rules` publicada no projeto `sinaldesk-hml`.
- Documentos descritos em `FIRESTORE-SETUP.md` criados.

---

## HML-0.3-01 — Regressão: login válido

1. Abra HML em janela anônima.
2. Faça login com `walter.udisson@gmail.com`.

Esperado:

- [ ] Login concluído.
- [ ] Nenhum erro de autenticação.
- [ ] A tela interna do Sinal é carregada.

**Resultado:** [ ] APROVADO [ ] REPROVADO

---

## HML-0.3-02 — Contexto do usuário

Após login, confirme:

- [ ] Saudação exibe `Walter`.
- [ ] Organização exibida é `Sinal`.
- [ ] Papel exibido é `Administrador`.
- [ ] Badge `Superadmin` é exibido.
- [ ] E-mail correto aparece na área do usuário.
- [ ] Em `Mais`, o UID é `rSbmd9g17XckHd87pxgsNjH1im12`.

**Resultado:** [ ] APROVADO [ ] REPROVADO

---

## HML-0.3-03 — Navegação mobile

Em smartphone real, orientação vertical:

1. Abra a aplicação.
2. Navegue entre `Início`, `Sinais`, `Base` e `Mais`.

Esperado:

- [ ] Barra inferior permanece utilizável.
- [ ] Item ativo muda corretamente.
- [ ] Não existe rolagem horizontal.
- [ ] Conteúdo não fica oculto sob a barra inferior.
- [ ] Alvos de toque são confortáveis.

**Resultado:** [ ] APROVADO [ ] REPROVADO

---

## HML-0.3-04 — Navegação desktop

Em desktop:

Esperado:

- [ ] Sidebar lateral é exibida.
- [ ] Barra inferior móvel não é exibida.
- [ ] Navegação entre as quatro áreas funciona.
- [ ] Cabeçalho exibe organização, papel e usuário.

**Resultado:** [ ] APROVADO [ ] REPROVADO

---

## HML-0.3-05 — CTA Mandar um sinal

1. Na tela inicial, clique/toque em `Mandar um sinal`.

Esperado:

- [ ] Nenhum erro ocorre.
- [ ] É apresentada mensagem informando que a abertura real entra na Sprint 1.0.
- [ ] Nenhum documento é criado no Firestore.

**Resultado:** [ ] APROVADO [ ] REPROVADO

---

## HML-0.3-06 — Regressão: persistência da sessão

1. Autenticado, recarregue a página.
2. Feche a aba.
3. Abra novamente HML no mesmo navegador.

Esperado:

- [ ] Sessão permanece autenticada.
- [ ] Contexto Sinal / Administrador / Superadmin é recarregado corretamente.

**Resultado:** [ ] APROVADO [ ] REPROVADO

---

## HML-0.3-07 — Regressão: logout

1. Clique/toque em `Sair`.
2. Recarregue a página.

Esperado:

- [ ] Login volta a ser exibido.
- [ ] Sessão não é restaurada.

**Resultado:** [ ] APROVADO [ ] REPROVADO

---

## HML-0.3-08 — Regressão: senha incorreta

1. Tente entrar com senha propositalmente errada.

Esperado:

- [ ] Acesso negado.
- [ ] Mensagem compreensível de credencial inválida.
- [ ] Aplicação permanece no login.

**Resultado:** [ ] APROVADO [ ] REPROVADO

---

## HML-0.3-09 — Regressão: recuperação de senha

1. Informe `walter.udisson@gmail.com`.
2. Acione `Esqueci minha senha`.

Esperado:

- [ ] Aplicação confirma a solicitação.
- [ ] E-mail é enviado pelo Firebase HML.
- [ ] Verificar também Spam, caso necessário.

**Resultado:** [ ] APROVADO [ ] REPROVADO

---

## HML-0.3-10 — Segurança de leitura básica

No Firebase Console, confirme após uso normal:

- [ ] A aplicação apenas leu `users/{uid}`.
- [ ] Leu `tenants/sinal-interno`.
- [ ] Leu `tenants/sinal-interno/members/{uid}`.
- [ ] Nenhum ticket ou outro documento foi criado.

**Resultado:** [ ] APROVADO [ ] REPROVADO

---

# Resultado geral

- [ ] SPRINT 0.3 APROVADA
- [ ] SPRINT 0.3 REPROVADA
- [ ] APROVADA COM CORREÇÕES PENDENTES

## Bugs / observações

| ID | Cenário | Descrição | Severidade |
|---|---|---|---|
| | | | |
| | | | |
