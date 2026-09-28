# Sinal — Decisões de Projeto

Este documento registra decisões consolidadas do projeto Sinal.

> Uma decisão registrada aqui somente deve ser alterada quando houver uma nova decisão explícita de projeto.

---

## DP-001 — Nome do produto

**Status:** Aprovada

O nome provisório do produto é **Sinal**.

O produto utilizará o próprio nome como parte de sua linguagem, especialmente nas principais interações com o usuário.

Exemplos:

- Mandar um sinal
- Novo sinal
- Sinal recebido
- Meus sinais
- Assumir sinal
- Sinal resolvido
- Reabrir sinal

A linguagem deve permanecer natural. Termos convencionais como equipe, categoria, prioridade, SLA, usuários e configurações não devem ser substituídos apenas para forçar a metáfora da marca.

No código e no modelo de dados, devem ser utilizados termos técnicos previsíveis, como `ticket`, `ticketId` e `ticketService`.

---

## DP-002 — Tipo de produto

**Status:** Aprovada

O Sinal será um **SaaS multi-tenant para gestão de suporte e atendimento**.

Cada organização utilizará um ambiente logicamente isolado dentro da plataforma.

O isolamento entre tenants deve existir desde a modelagem inicial e não será tratado como adaptação futura.

---

## DP-003 — Mobile-first

**Status:** Aprovada

O Sinal será desenvolvido seguindo abordagem **mobile-first**.

O uso em smartphones é considerado cenário principal do produto.

Responsividade não será tratada como etapa posterior.

Uma funcionalidade de interface somente poderá ser considerada homologada quando possuir experiência adequada também em dispositivos móveis.

O objetivo é:

> Mobile-first, desktop-complete.

---

## DP-004 — Referências de produto e interface

**Status:** Aprovada

### OpenSupports

O OpenSupports v4.11.0 será utilizado como **referência funcional e estrutural** para análise de conceitos e fluxos de sistemas de help desk.

Não será utilizado como base de código do Sinal.

### AppDashboard-pro

O AppDashboard-pro será utilizado como **caixa de ferramentas visual**.

Seus componentes, layouts e padrões poderão ser extraídos e adaptados ao Sinal.

O Sinal não deverá simplesmente reproduzir o template nem ficar limitado à arquitetura visual original dele.

---

## DP-005 — Stack tecnológica

**Status:** Aprovada

O Sinal seguirá a mesma filosofia tecnológica utilizada no projeto CMAPP.

Base prevista:

- HTML5
- CSS
- JavaScript modular
- Tailwind CSS
- Firebase Authentication
- Cloud Firestore
- Firebase Storage
- Firebase Cloud Functions quando necessárias
- SPA
- PWA
- Service Worker
- Git
- GitHub
- GitHub Codespaces
- GitHub Pages

Bibliotecas adicionais somente deverão ser incorporadas quando houver necessidade concreta.

---

## DP-006 — Ambiente de desenvolvimento

**Status:** Aprovada

O ambiente oficial de desenvolvimento será o **GitHub Codespaces**.

Isso permite independência da máquina física utilizada e maior mobilidade no desenvolvimento.

O repositório oficial é:

`Walterudisson/sinal`

A branch principal é:

`main`

---

## DP-007 — Backend

**Status:** Aprovada

O backend/BaaS do Sinal será o Firebase.

Projeto Firebase:

`sinaldesk`

Serviços inicialmente previstos:

- Authentication
- Cloud Firestore
- Storage
- Analytics
- Cloud Functions quando necessárias

---

## DP-008 — Criação de organizações e usuários

**Status:** Aprovada

Não haverá cadastro público de usuários ou organizações.

As organizações serão criadas exclusivamente pelo **Superadmin da plataforma Sinal**.

Os usuários de cada organização serão administrados pelos **Admins da própria organização**.

---

## DP-009 — Papéis de acesso

**Status:** Aprovada

O Sinal utilizará inicialmente os seguintes papéis:

### Plataforma

- `superadmin`

### Organização

- `admin`
- `supervisor`
- `agente`
- `solicitante`

Não haverá papel `owner` na versão inicial.

Admin, Supervisor e Agente também poderão utilizar funcionalidades de solicitante, incluindo a abertura de seus próprios sinais.

O papel global da plataforma deverá permanecer separado do papel do usuário dentro de cada tenant.

---

## DP-010 — Metodologia de desenvolvimento

**Status:** Aprovada

O Sinal seguirá a metodologia incremental utilizada no projeto CMAPP.

Fluxo:

1. Definição
2. Sprint pequena
3. Implementação
4. Testes técnicos
5. Homologação
6. Correção, quando necessária
7. Aprovação explícita
8. Promoção para produção
9. Próxima etapa

Nenhuma sprint será considerada concluída apenas porque o código foi implementado.

A homologação funcional faz parte da definição de pronto.

---

## DP-011 — HML e PRD

**Status:** Aprovada

Alterações deverão ser validadas em ambiente de homologação antes da promoção para produção.

Experimentos e funcionalidades ainda não homologadas não deverão alterar deliberadamente o ambiente de produção.

---

## DP-012 — Documentação viva

**Status:** Aprovada

Decisões arquiteturais, modelagem, configuração e escopo das sprints deverão ser documentados no próprio repositório.

A conversa com ferramentas de IA não será considerada a única fonte de conhecimento do projeto.

---

## Histórico

| Data | Decisão | Evento |
|---|---|---|
| 2026-09-28 | DP-001 a DP-012 | Fundação inicial do projeto |
