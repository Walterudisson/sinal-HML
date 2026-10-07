# Testes de segurança — Sprint 1.5

Executa somente contra o Firestore Emulator com o projeto fictício `demo-sinal-security`.

## Executar

```bash
cd tests/security
npm install
npm test
```

Os testes não acessam HML nem PRD.

## Cobertura da Fase B

1. atendente responsável pode marcar `in_progress → waiting_requester`;
2. outro agente não pode alterar o sinal;
3. solicitante não pode iniciar a espera;
4. resposta do solicitante retoma `waiting_requester → in_progress` no mesmo lote da mensagem e do evento;
5. mensagem isolada do solicitante durante a espera é negada;
6. atendente responsável pode complementar a conversa durante a espera sem retirar o sinal desse estado.
