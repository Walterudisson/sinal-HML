# Checkpoint HML — Sprint 1.5 Fase A

**Escopo:** domínio e segurança  
**Ambiente:** somente HML  
**Deploy:** não realizar nesta etapa

## O que esta fase implementa

- contrato da máquina de estados 1.5;
- funções de serviço para:
  - aguardar solicitante;
  - reabrir sinal resolvido;
  - fechar sinal resolvido;
- retomada automática `waiting_requester → in_progress` quando o solicitante envia mensagem;
- resoluções técnicas append-only em `privateResolutions/{resolutionId}`;
- leitura compatível do legado `private/resolution` da série 1.4.x;
- regras Firestore para vincular transição, evento e ator;
- bloqueio de mensagens em `resolved` e `closed`;
- fechamento terminal na 1.5.

Nenhum novo botão ou fluxo visual foi exposto ainda.

## Validação técnica

No Codespace HML:

```bash
cd /workspaces/sinal-HML
git fetch origin
git switch --track origin/sprint/1.5-phase-a-domain-security
nvm use 22

node --test \
  tests/ticket-lifecycle.test.mjs \
  tests/sprint-1.5-phase-a.test.cjs \
  tests/ux1.test.cjs \
  tests/release-1.4.3.test.cjs
```

Em seguida, validar que as regras compilam no emulador:

```bash
npx firebase-tools emulators:exec \
  --only firestore \
  --project sinaldesk-hml \
  "echo FIRESTORE_RULES_OK"
```

E confirmar que as Functions atuais continuam sem regressão:

```bash
cd functions
npm ci
npm audit
npm test
```

## Resultado esperado

- 5 testes de domínio da máquina de estados;
- 8 testes de contrato da Fase A;
- testes 1.4.3/UX-1 permanecem aprovados;
- Firestore Emulator inicia, compila as regras e encerra com `FIRESTORE_RULES_OK`;
- `npm audit` sem vulnerabilidades;
- 6 testes de notificações atuais aprovados.

## Não fazer ainda

- não publicar `firestore.rules`;
- não fazer deploy de Functions;
- não promover para PRD;
- não homologar visualmente novos estados, porque a interface da Fase B ainda não existe.

Após este checkpoint, a Fase B poderá expor `Aguardando solicitante` e a retomada automática na interface HML.
