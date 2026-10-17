# Sprint 1.6.3 — Estabilização operacional

**Data de início:** 17/10/2026  
**Ambiente:** HML (`sinaldesk-hml`)  
**Base:** v1.6.2.2 homologada em PRD  
**Status:** aguardando homologação manual

## Objetivo
Consolidar Início, Central, notificações e PWA sem alterar as funções operacionais homologadas.

## Alterações
1. Central: atualizar o contexto de usuário e tenant após logout/login na mesma sessão, limpando o estado anterior e restaurando apenas os filtros do usuário atual.
2. Central: filtros continuam funcionais mesmo quando o navegador bloqueia `sessionStorage`; a persistência passa a ser opcional.
3. Início: limpar dados em memória de sinais e notificações ao inicializar com um novo contexto.
4. Logout: limpar lista, indicadores de notificações e marcadores de novas mensagens antes da próxima autenticação.
5. Botão `Assumir` na Início: restaurar o rótulo e impedir erro de promessa não tratada se a operação falhar.
6. PWA: atualizar o cache para `sinal-shell-hml-1.6.3-stability` e tolerar `sessionStorage` indisponível no controle de atualização.
7. Atualizar os testes de regressão de interface que ainda verificavam versões antigas.

**Não incluído:** Firebase Storage, anexos, novos estados, alteração de Firestore Rules, Cloud Functions, esquema de dados ou PRD.

## Critérios de aceite em HML

| # | Perfil / cenário | Procedimento | Resultado esperado |
|---|---|---|---|
| 01 | Todos | Acessar Mais, identificar ambiente e versão | `HML v1.6.3`, nunca PRD |
| 02 | Solicitante | Entrar e verificar Início / Meus sinais | Contagens e lista corretas, sem dados da sessão anterior |
| 03 | Solicitante | Mandar sinal, consultar detalhe, conversar | Fluxos existentes intactos |
| 04 | Atendente | Entrar e consultar Início | Indicadores Novos, Meus e Sem responsável coerentes com a Central |
| 05 | Atendente | Alternar filtros da Central, buscar e ordenar | Cada controle funciona e atualiza a lista |
| 06 | Atendente | Assumir um sinal novo na Início e na Central | Status atualizado; sem botão travado |
| 07 | Atendente | Abrir conversa, enviar mensagem, resolver sinal | Fluxos existentes intactos |
| 08 | Todos | Abrir notificações e ler uma conversa pelo aviso | Badge e ação atualizados, conversa aberta |
| 09 | Troca de contas | Encerrar sessão de A e entrar com B no mesmo navegador | Nenhum sinal, mensagem, filtro ou contador de A é exibido para B |
| 10 | PWA no Android | Abrir PWA instalada, atualizar a página após a publicação | v1.6.3 sem limpeza manual de dados, se conectado |
| 11 | Desktop | Repetir a troca de contas e filtros após recarga | Persistência somente da própria conta |
| 12 | Rede instável | Desconectar e reconectar; consultar sinais | Sem travamentos ou perda silenciosa de dados em operações existentes |

### Observações de homologação
- HML deve ser testado com contas separadas de solicitante e atendente.
- A indicação dos contadores decorre dos registros observados no cliente. Como as consultas atuais possuem limites (50 Meus sinais, 100 Central), validar os resultados de testes com volumes abaixo desses limites. Contadores globais e paginação serão tratados em sprint própria.
- A falha de armazenamento local pode ser simulada em teste automatizado; no uso comum basta verificar os filtros normalmente.
- A homologação manual no celular e no desktop continua obrigatória.
- **A promoção para PRD somente ocorrerá após aprovação explícita.**

## Verificação técnica
Executar, no checkout da branch, `node --test tests/sprint-1.6.3.test.cjs`. Antes de promover, executar também os testes de regressão existentes e validar manualmente as operações com Firebase.
