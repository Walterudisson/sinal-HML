# Sinal — Sprint 0.3

## Shell autenticado + contexto multi-tenant

**Status:** Em homologação  
**Ambiente:** HML  
**Data:** 2026-09-28

## Objetivo

Transformar o estado autenticado mínimo da Sprint 0.2 na primeira experiência real dentro do Sinal, carregando o contexto do usuário, organização e papel a partir do Firestore.

## Entregas

- Firebase HML isolado (`sinaldesk-hml`).
- Firestore integrado ao frontend.
- Documento global do usuário.
- Tenant inicial.
- Membership do usuário dentro do tenant.
- Separação entre `platformRole` e papel do tenant.
- Carregamento de:
  - usuário autenticado;
  - perfil global;
  - tenant ativo;
  - membership;
  - papel.
- Shell mobile-first.
- Navegação móvel inferior.
- Sidebar desktop.
- Tela inicial contextualizada.
- Identificação de Superadmin.
- Organização e papel exibidos na interface.
- Áreas reservadas para Sinais, Base e Mais.
- CTA `Mandar um sinal` visível, ainda sem persistência.
- Modularização inicial do JavaScript em:
  - `config`;
  - `services`;
  - `ui`.
- Security Rules iniciais de leitura.

## Regressão impactada

A autenticação da Sprint 0.2 foi modularizada. Por isso, login, persistência, recuperação de senha e logout entram na regressão desta sprint.

## Fora do escopo

- Criação de tickets.
- Escrita no Firestore pelo usuário.
- Administração de tenants.
- Administração de usuários.
- Equipes.
- SLA.
- Base de conhecimento funcional.
- PWA.
- PRD.

## Critério de pronto

A sprint será considerada concluída após:

1. configuração dos três documentos iniciais no Firestore HML;
2. publicação das Rules;
3. deploy no GitHub Pages HML;
4. execução do roteiro `HOMOLOGACAO-SPRINT-0.3.md`;
5. aprovação explícita do responsável pelo produto.
