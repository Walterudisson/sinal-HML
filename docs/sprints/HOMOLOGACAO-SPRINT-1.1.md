# Sinal — Homologação da Sprint 1.1

## Central de atendimento e assumir um sinal

**Ambiente:** HML  
**Data da execução:** ____________________  
**Responsável:** Walter Udisson  
**URL testada:** ____________________

## Pré-condições

- Sprint 1.0 homologada.
- Usuário HML `walter.udisson@gmail.com`.
- Papel no tenant: `admin`.
- Existir pelo menos um sinal com:
  - `status = open`
  - `assigneeUid = null`
- `firestore.rules` da Sprint 1.1 publicada.

---

## HML-1.1-01 — Regressão: login e contexto

Esperado:

- [ ] Login funciona.
- [ ] Tenant `Sinal`.
- [ ] Papel `Administrador`.
- [ ] Badge `Superadmin`.
- [ ] Seus sinais anteriores continuam visíveis.

**Resultado:** [ ] APROVADO [ ] REPROVADO

---

## HML-1.1-02 — Nova navegação

No desktop:

- [ ] Sidebar contém `Central`.
- [ ] `Meus sinais` permanece disponível.

No mobile:

- [ ] Barra inferior contém `Central`.
- [ ] Barra continua cabendo sem rolagem horizontal.
- [ ] Alvos continuam confortáveis.

**Resultado:** [ ] APROVADO [ ] REPROVADO

---

## HML-1.1-03 — Indicadores da Central

Abra `Central`.

Esperado:

- [ ] Card `Novos` mostra quantidade de tickets `open`.
- [ ] `Meus` mostra sinais atribuídos a você em atendimento.
- [ ] `Sem responsável` mostra tickets sem `assigneeUid`.
- [ ] Card da Home apresenta quantidade de novos sinais.

**Resultado:** [ ] APROVADO [ ] REPROVADO

---

## HML-1.1-04 — Filtros

Teste:

`Todos → Novos → Meus → Sem responsável`

Esperado:

- [ ] Lista muda conforme o filtro.
- [ ] Título/subtítulo da fila acompanham o filtro.
- [ ] Filtro ativo fica visualmente identificado.
- [ ] Nenhum refresh é necessário.

**Resultado:** [ ] APROVADO [ ] REPROVADO

---

## HML-1.1-05 — Abrir detalhe

Em `Novos`, clique em `Abrir`.

Esperado:

- [ ] Detalhe abre sobre a Central.
- [ ] Código correto.
- [ ] Título e descrição corretos.
- [ ] Categoria correta.
- [ ] Prioridade correta.
- [ ] Solicitante correto.
- [ ] Responsável aparece como `Ainda não atribuído`.
- [ ] Botão `Assumir sinal` disponível.

**Resultado:** [ ] APROVADO [ ] REPROVADO

---

## HML-1.1-06 — Voltar do dispositivo fecha detalhe

Em smartphone real:

1. Abra o detalhe.
2. Use o botão/gesto nativo `Voltar`.

Esperado:

- [ ] Detalhe fecha.
- [ ] Você permanece no Sinal.
- [ ] Navegador NÃO retorna imediatamente ao site anterior.

**Resultado:** [ ] APROVADO [ ] REPROVADO

---

## HML-1.1-07 — Regressão: Voltar fecha composer

Em smartphone real:

1. Abra `Mandar um sinal`.
2. Use o botão/gesto nativo `Voltar`.

Esperado:

- [ ] Composer fecha.
- [ ] Você permanece no Sinal.
- [ ] Nenhum sinal é criado.
- [ ] Navegador NÃO retorna imediatamente ao site anterior.

**Resultado:** [ ] APROVADO [ ] REPROVADO

---

## HML-1.1-08 — Assumir sinal

Abra novamente um sinal novo e clique/toque em:

`Assumir sinal`

Esperado:

- [ ] Botão mostra `Assumindo...`.
- [ ] Detalhe fecha após sucesso.
- [ ] Toast no canto superior direito.
- [ ] Título `Sinal assumido`.
- [ ] Ticket sai de `Novos`.
- [ ] Ticket aparece em `Meus`.
- [ ] Contadores atualizam sem refresh.

**Resultado:** [ ] APROVADO [ ] REPROVADO

---

## HML-1.1-09 — Conferência Firestore

No documento assumido:

Esperado:

- [ ] `status = in_progress`
- [ ] `assigneeUid = rSbmd9g17XckHd87pxgsNjH1im12`
- [ ] `assigneeName = Walter Udisson`
- [ ] `assigneeEmail = walter.udisson@gmail.com`
- [ ] `updatedAt` alterado.
- [ ] Título, descrição, solicitante e demais dados originais não foram modificados.

**Resultado:** [ ] APROVADO [ ] REPROVADO

---

## HML-1.1-10 — Detalhe de sinal já assumido

Abra o sinal no filtro `Meus`.

Esperado:

- [ ] Status `Em atendimento`.
- [ ] Responsável `Walter Udisson`.
- [ ] Botão `Assumir sinal` não aparece.
- [ ] Mensagem informa que o sinal está em atendimento por você.

**Resultado:** [ ] APROVADO [ ] REPROVADO

---

## HML-1.1-11 — Regressão: criar novo sinal

Como solicitante:

1. `Mandar um sinal`.
2. Crie um ticket de teste.

Esperado:

- [ ] Criação continua funcionando.
- [ ] Ticket aparece em `Meus sinais`.
- [ ] Como você também é admin, ticket aparece em `Central → Novos`.
- [ ] Toast permanece no canto superior direito.

**Resultado:** [ ] APROVADO [ ] REPROVADO

---

## HML-1.1-12 — Regressão: sessão, navegação e logout

Esperado:

- [ ] Reload mantém autenticação.
- [ ] Central recarrega.
- [ ] Meus sinais recarregam.
- [ ] Navegação funciona.
- [ ] Logout encerra sessão.

**Resultado:** [ ] APROVADO [ ] REPROVADO

---

# Resultado geral

- [ ] SPRINT 1.1 APROVADA
- [ ] SPRINT 1.1 REPROVADA
- [ ] APROVADA COM CORREÇÕES PENDENTES

## Bugs / observações

| ID | Cenário | Descrição | Severidade |
|---|---|---|---|
| | | | |
| | | | |
