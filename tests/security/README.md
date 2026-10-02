# HML 1.4.1: teste das regras de resolução

Este teste executa **somente** com um projeto local fictício `demo-sinal-security` no Firestore Emulator. Não acessa o Firebase HML ou PRD.

## Como executar pelo GitHub Codespaces

Abra um Codespace da branch deste PR e, no Terminal, execute:

```bash
cd tests/security
npm install
npm test
```

Requisitos: Node 22 e Java disponível no ambiente. O comando lê o arquivo de regras do repositório e cria documentos fictícios dentro do emulador na porta 8087.

## O que o teste cobre

1. Segundo atendente, sem atribuição, tenta a resolução em lote com ticket + solução privada + histórico: **NEGADO**.
2. Técnico responsável faz o mesmo lote: **PERMITIDO**.
3. Solicitante lê a solução técnica: **NEGADO**.
4. Outro agente da equipe lê a solução técnica: **PERMITIDO**.
5. Atualização isolada sem criar documentos vinculados: **NEGADO**.

**Critério:** os quatro casos descritos na saída devem passar (o teste de leitura é um caso com duas asserções). Não marque a homologação final se houver erros.

Nenhum `firebase deploy` é necessário. A porta e as configurações ficam em `firebase.security.json`, separado do `firebase.json` de publicação.
