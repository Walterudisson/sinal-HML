# Sinal | Revogação segura de acesso aos anexos

**Escopo:** Sprint 1.7.0-A / Firebase Storage em HML  
**Situação:** requisito de segurança bloqueante para publicação das regras

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

- [ ] Implementar ou aprovar formalmente uma rotina administrativa de revogação de
      todos os vínculos de um usuário/organização.
- [ ] Demonstrar, no Emulator Suite, que a revogação do vínculo impede leitura e
      criação de anexos imediatamente em sessão autenticada.
- [ ] Testar desativação global e de tenant usando a rotina real, incluindo falhas
      parciais e revogações em mais de uma organização.
- [ ] Verificar permissão IAM para cross-service Storage Rules acessar Firestore.
- [ ] Revisar e homologar regras para Firestore de metadados antes do primeiro upload.
- [ ] Validar orçamento/alertas e fluxo de rollback para a política `deny-all`.

**Não tratar a aprovação de testes de regras como prova de que o fluxo administrativo
de revogação global está implementado.**

## Referências

- https://firebase.google.com/docs/storage/security/rules-conditions
- https://firebase.google.com/docs/rules/manage-deploy
- https://firebase.google.com/docs/rules/unit-tests
