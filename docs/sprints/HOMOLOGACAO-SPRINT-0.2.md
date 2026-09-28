# Sinal — Homologação da Sprint 0.2

## Primeiro acesso ao Sinal

**Ambiente:** HML  
**Data da execução:** ____________________  
**Responsável:** ____________________  
**URL testada:** ____________________

---

## Orientação

Execute somente os testes desta sprint. Não há regressão de funcionalidades anteriores porque esta é a primeira experiência funcional da aplicação.

Sempre que possível, execute os cenários HML-0.2-01 a HML-0.2-08 em um navegador desktop e repita pelo menos os cenários HML-0.2-01, HML-0.2-02, HML-0.2-06 e HML-0.2-09 em smartphone real.

---

## HML-0.2-01 — Carregamento da tela de login

### Procedimento

1. Abra a URL de HML em uma janela anônima/privada.
2. Aguarde o carregamento da página.

### Resultado esperado

- [ ] A marca `Sinal.` é exibida.
- [ ] O ambiente apresenta indicação `HML`.
- [ ] Existem campos de e-mail e senha.
- [ ] Existe botão `Entrar`.
- [ ] Existe ação `Esqueci minha senha`.
- [ ] Não existe opção de cadastro público.
- [ ] Não há erro visível no carregamento.

**Resultado:** [ ] APROVADO  [ ] REPROVADO

Observações:

____________________________________________________________________

---

## HML-0.2-02 — Login válido

### Pré-condição

Conta Firebase ativa e senha válida.

### Procedimento

1. Informe `walter.udisson@gmail.com`.
2. Informe a senha válida da conta.
3. Clique/toque em `Entrar`.

### Resultado esperado

- [ ] O botão apresenta estado de carregamento durante a autenticação.
- [ ] A tela de login deixa de ser exibida.
- [ ] A tela autenticada é apresentada.
- [ ] O e-mail autenticado é `walter.udisson@gmail.com`.
- [ ] O UID exibido é `9yY4oQdd4oTzXMuj8GuUhkfZNMg2`.
- [ ] Não há mensagem de erro.

**Resultado:** [ ] APROVADO  [ ] REPROVADO

Observações:

____________________________________________________________________

---

## HML-0.2-03 — Senha inválida

### Procedimento

1. Saia da aplicação, se necessário.
2. Informe `walter.udisson@gmail.com`.
3. Informe propositalmente uma senha incorreta.
4. Clique/toque em `Entrar`.

### Resultado esperado

- [ ] O acesso não é concedido.
- [ ] A aplicação continua na tela de login.
- [ ] É apresentada mensagem informando que e-mail ou senha são inválidos.
- [ ] A senha digitada não aparece em texto aberto.

**Resultado:** [ ] APROVADO  [ ] REPROVADO

Observações:

____________________________________________________________________

---

## HML-0.2-04 — Validação de campos obrigatórios

### Procedimento

1. Deixe e-mail e senha vazios.
2. Tente entrar.
3. Depois informe um formato de e-mail inválido e tente novamente.

### Resultado esperado

- [ ] O formulário impede envio sem os campos obrigatórios.
- [ ] O formulário identifica formato de e-mail inválido.
- [ ] Nenhuma autenticação é realizada.

**Resultado:** [ ] APROVADO  [ ] REPROVADO

Observações:

____________________________________________________________________

---

## HML-0.2-05 — Mostrar e ocultar senha

### Procedimento

1. Digite qualquer conteúdo no campo senha.
2. Toque/clique no ícone de visualização.
3. Toque/clique novamente.

### Resultado esperado

- [ ] Primeiro acionamento mostra o conteúdo da senha.
- [ ] Segundo acionamento volta a ocultá-lo.
- [ ] O valor digitado não é apagado.

**Resultado:** [ ] APROVADO  [ ] REPROVADO

Observações:

____________________________________________________________________

---

## HML-0.2-06 — Persistência da sessão

### Pré-condição

Usuário autenticado.

### Procedimento

1. Com a tela autenticada aberta, atualize/recarregue a página.
2. Aguarde o carregamento.
3. Feche a aba.
4. Abra novamente a mesma URL no mesmo navegador.

### Resultado esperado

- [ ] Após recarregar, o usuário continua autenticado.
- [ ] Ao reabrir a aplicação no mesmo navegador, a sessão continua ativa.
- [ ] O e-mail e UID continuam corretos.

**Resultado:** [ ] APROVADO  [ ] REPROVADO

Observações:

____________________________________________________________________

---

## HML-0.2-07 — Logout

### Pré-condição

Usuário autenticado.

### Procedimento

1. Clique/toque em `Sair`.

### Resultado esperado

- [ ] A sessão é encerrada.
- [ ] A tela de login volta a ser exibida.
- [ ] Recarregar a página não restaura a sessão encerrada.

**Resultado:** [ ] APROVADO  [ ] REPROVADO

Observações:

____________________________________________________________________

---

## HML-0.2-08 — Recuperação de senha

### Procedimento A — sem e-mail

1. Deixe o campo e-mail vazio.
2. Clique/toque em `Esqueci minha senha`.

### Resultado esperado A

- [ ] A aplicação solicita que o e-mail seja informado.
- [ ] O foco retorna ao campo de e-mail.

### Procedimento B — com conta válida

1. Informe `walter.udisson@gmail.com`.
2. Clique/toque em `Esqueci minha senha`.

### Resultado esperado B

- [ ] A aplicação apresenta confirmação da solicitação.
- [ ] O Firebase envia a mensagem de redefinição, conforme configuração do projeto.

**Resultado:** [ ] APROVADO  [X] REPROVADO

Observações: e-mail de recuperação não enviado

____________________________________________________________________

---

## HML-0.2-09 — Experiência mobile

### Dispositivo

Modelo: ______________________________  
Sistema/navegador: ______________________________

### Procedimento

1. Abra a aplicação em orientação vertical.
2. Navegue pelos campos usando toque.
3. Abra o teclado virtual.
4. Realize login.
5. Faça logout.

### Resultado esperado

- [ ] Não há rolagem horizontal.
- [ ] Campos e botões permanecem acessíveis com o teclado aberto.
- [ ] Os alvos de toque são confortáveis.
- [ ] O navegador não aplica zoom indesejado ao focar os campos.
- [ ] Textos permanecem legíveis sem ampliar manualmente.
- [ ] Login e logout podem ser realizados confortavelmente com uma mão.

**Resultado:** [ ] APROVADO  [ ] REPROVADO

Observações:

____________________________________________________________________

---

# Resultado geral

- [ ] SPRINT 0.2 APROVADA
- [ ] SPRINT 0.2 REPROVADA
- [ ] APROVADA COM CORREÇÕES PENDENTES

## Falhas / bugs encontrados

| ID | Cenário | Descrição | Severidade |
|---|---|---|---|
| | | | |
| | | | |
| | | | |

## Observações finais

____________________________________________________________________

____________________________________________________________________

____________________________________________________________________
