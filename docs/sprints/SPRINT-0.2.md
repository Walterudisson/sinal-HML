# Sinal — Sprint 0.2

## Primeiro acesso ao Sinal

**Status:** Em homologação  
**Data:** 2026-09-28

## Objetivo

Disponibilizar a primeira experiência funcional e palpável do Sinal, conectada ao Firebase Authentication, permitindo autenticação real de usuário previamente cadastrado.

## Escopo entregue

- Tela de login mobile-first.
- Identidade provisória do Sinal aplicada à experiência de autenticação.
- Ambiente claramente identificado como HML.
- Firebase Authentication conectado ao projeto `sinaldesk`.
- Login com e-mail e senha.
- Persistência local da sessão.
- Recuperação de senha por e-mail.
- Exibição de erros de autenticação em linguagem compreensível.
- Alternância mostrar/ocultar senha.
- Estado autenticado mínimo para comprovação da sessão.
- Exibição do e-mail e UID do usuário autenticado.
- Logout.
- Ausência de cadastro público.
- Layout responsivo para smartphone e desktop.

## Fora do escopo desta sprint

- Firestore.
- Tenant ativo.
- Papéis e permissões.
- Superadmin.
- Cadastro ou administração de organizações.
- Central de sinais.
- Abertura de sinal.
- App shell definitivo.
- PWA e Service Worker.
- Produção (PRD).

## Decisão de implementação

Para reduzir o tempo até a primeira experiência funcional, esta sprint utiliza uma página estática autocontida com HTML5, Tailwind CSS via CDN, JavaScript ES Modules e Firebase Web SDK 10.8.0 via ESM.

A modularização em `config`, `controllers`, `core`, `services` e `ui` será iniciada junto ao shell da aplicação nas próximas sprints, preservando a arquitetura adotada no CMAPP.

## Critério de pronto

A sprint somente poderá ser aprovada após execução do roteiro `HOMOLOGACAO-SPRINT-0.2.md` e aprovação explícita do responsável pelo produto.
