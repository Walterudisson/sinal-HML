# Testes de segurança — Sprint 1.5

Executa somente contra o Firestore Emulator com o projeto fictício `demo-sinal-security`.

## Executar

```bash
cd tests/security
rm -rf node_modules package-lock.json
npm install
npm audit
npm test
```

Os testes não acessam HML nem PRD.

## Arquitetura após o pivô

O cliente pode criar o sinal inicial, mas não pode alterar diretamente tickets existentes nem escrever em `messages`, `statusEvents` ou `privateResolutions`. Essas operações pertencem às Cloud Functions autenticadas.

## Cobertura

1. solicitante ativo pode criar sinal novo em `open`;
2. cliente não pode atualizar ticket operacional diretamente;
3. cliente não pode criar `statusEvent`;
4. solicitante não pode criar mensagem diretamente;
5. agente também não pode criar mensagem diretamente;
6. cliente não pode escrever resolução privada diretamente;
7. solicitante lê conversa e histórico públicos do próprio sinal;
8. solução privada é negada ao solicitante e permitida à equipe.

**Critério:** 8/8 aprovados, audit sem vulnerabilidades e nenhuma ocorrência de `maximum of 1000 expressions`.

Nenhum `firebase deploy` é necessário para estes testes.
