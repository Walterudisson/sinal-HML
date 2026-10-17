# Sinal | Revogação segura de acesso aos anexos

**Escopo:** Sprint 1.7.0-A / Firebase Storage em HML  
**Situação (17/10/2026):** backend de revogação e Storage/Firestore Rules publicados no HML; IAM cross-service autorizado. Testes reais de revogação com usuários de teste e fluxo administrativo na aplicação pendentes.

## Problema

As Security Rules do Cloud Storage só podem consultar **dois documentos distintos** do Firestore
por requisição. O Sinal precisa verificar três dimensões de autorização:

1. Conta global (`users/{uid}.status`).
2. Vínculo na organização (`tenants/{tenantId}/members/{uid}.status`).
3. Sinal (`tenants/{tenantId}/tickets/{ticketId}`).

A versão atual de `storage.rules` consulta **vínculo e sinal**. Isso atende a maioria
dos fluxos operacionais, mas não consulta diretamente a conta global ou o status da
organização. A aplicação web impede login normal quando a conta ou a organização estão
inativas, porém um cliente malicioso com credenciais válidas poderia fazer chamadas ao
Storage diretamente caso o vínculo permaneça `active`.

## Política obrigatória antes do primeiro deploy

**A fonte de autorização do Storage será o vínculo por tenant.**
Toda operação administrativa de desativação deve revogar esses vínculos *antes* de
considerar a conta ou a organização desativada.

- **Desativação de usuário:** usar um procedimento privilegiado único que procure todos
  os vínculos ativos do UID em todos os tenants e marque `status: inactive`;
  em seguida desativar `users/{uid}` e, quando necessário, o usuário do Firebase Auth.
- **Desativação de organização:** primeiro revogar os vínculos ativos dos membros do
  tenant; depois marcar o tenant como inativo.
- **Falha parcial:** se qualquer revogação falhar, não declarar a desativação concluída.
  Registrar o erro, bloquear o fluxo administrativo e permitir uma nova tentativa.
- **Reativação:** validar situação global do usuário e tenant antes de reativar um
  vínculo. Não reativar usuários automaticamente só porque a organização foi reativada.
- **Sem escrita direta de clientes:** manter `allow write: if false` sobre `users`,
  `tenants` e `members` nas Firestore Rules. Desativação fica em backend
  privilegiado ou procedimento administrativo controlado.
- **Auditoria:** registrar operador, data/hora, UID, tenant e resultado da operação.

## Critério de aceite bloqueante

Antes de colocar `storage.rules` em HML:

- [x] Implementar rotinas administrativas de revogação por usuário/organização,
      com acesso exclusivo ao Superadmin global e auditoria.
      Código: `functions/access-revocation.js` e callables em `functions/index.js`.
- [x] Demonstrar no Emulator Suite que a revogação do vínculo impede leitura
      e criação de anexos imediatamente, mesmo com sessão autenticada.
- [x] Testar desativação global e de tenant em emuladores, incluindo falha
      parcial, recuperação e revogações em múltiplas organizações.
- [x] Verificar e conceder permissão IAM cross-service Storage Rules↔Firestore em HML (CLI confirmou atualização da conta de serviço em 17/10/2026). Testes reais de autorização ainda necessários.
- [x] Criar e testar em emuladores regras Firestore para metadados pendentes,
      rejeitando cross-tenant, alterações arbitrárias e vinculação falsa.
- [ ] Implantar e homologar o fluxo de confirmação `pending → ready` por backend
      após verificar a existência real do arquivo (Fase 1.7.0-B).
- [ ] Validar orçamento/alertas e fluxo de rollback para a política `deny-all`.

**Não tratar a aprovação de testes de regras como prova de que o fluxo administrativo
de revogação global está implementado.**

## Referências

- https://firebase.google.com/docs/storage/security/rules-conditions
- https://firebase.google.com/docs/rules/manage-deploy
- https://firebase.google.com/docs/rules/unit-tests


## Resultado técnico de 17/10/2026

- GitHub Actions: https://github.com/Walterudisson/sinal-HML/actions/runs/39052004143
- 33 testes aprovados: 5 estáticos, 6 de notificações existentes, 16 de acesso
  a Storage/Firestore e 6 de revogação/autorização administrativa.
- As rotinas `deactivateSinalUser` e `deactivateSinalTenant` foram implantadas no Firebase **HML** em 17/10/2026, após integração da branch em `main`.
- As Security Rules de Firestore e Storage foram publicadas exclusivamente em `sinaldesk-hml`. Nenhuma promoção a PRD.
- Administração manual pelo Console Firebase continua sendo uma exceção
  **não coberta** pelas garantias da rotina. Para desativar usuários e organizações
  após habilitar Storage, usar apenas o fluxo privilegiado de revogação.
- O sistema ainda não dispõe de interface visual para essas rotinas; antes de
  habilitar anexos será necessário definir acesso operacional seguro ao Superadmin
  e testar o callable implantado em HML.
- A CLI confirmou a autorização de IAM cross-service Storage↔Firestore em `sinaldesk-hml`; os testes de leitura/escrita com identidade autenticada no Firebase real continuam pendentes.

## Resultado do smoke test da aplicação (17/10/2026)

Os cinco testes funcionais de regressão após implantação da infraestrutura foram confirmados pelo usuário: solicitante (login/Início, Meus sinais, envio de mensagem), atendente (Central, recebimento de mensagem). **Isto não testa a revogação real nem as permissões Storage em produção de HML.** Não desativar contas reais para tentar esse teste; usar somente contas de teste e procedimento auditado.
