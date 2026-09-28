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

## DP-006 — Repositórios e ambiente de desenvolvimento

**Status:** Aprovada

O ambiente oficial de desenvolvimento será o **GitHub Codespaces**.

O Sinal utilizará dois repositórios independentes:

- `Walterudisson/sinal-HML` — desenvolvimento e homologação.
- `Walterudisson/sinal` — produção.

A branch principal de ambos é `main`.

O repositório de produção não será utilizado para experimentos ou desenvolvimento corrente.

---

## DP-007 — Backend Firebase

**Status:** Aprovada

O Sinal utilizará dois projetos Firebase independentes:

### HML

`projectId: sinaldesk-hml`

Serviços:

- Authentication
- Cloud Firestore
- Storage
- Analytics
- Cloud Functions quando necessárias

### PRD

`projectId: sinaldesk`

Serviços:

- Authentication
- Cloud Firestore
- Storage
- Analytics
- Cloud Functions quando necessárias

Dados, usuários de teste, regras e recursos de HML não devem compartilhar o mesmo ambiente de produção.

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

Toda funcionalidade será desenvolvida e testada primeiro em HML.

Somente versões explicitamente homologadas poderão ser promovidas para PRD.

Mapeamento oficial:

| Ambiente | Repositório | Firebase | Endereço |
|---|---|---|---|
| HML | `Walterudisson/sinal-HML` | `sinaldesk-hml` | GitHub Pages do repositório HML |
| PRD | `Walterudisson/sinal` | `sinaldesk` | `https://sinal.app.br` |

O domínio personalizado `sinal.app.br` será exclusivo de PRD.

---

## DP-012 — Documentação viva

**Status:** Aprovada

Decisões arquiteturais, modelagem, configuração e escopo das sprints deverão ser documentados no próprio repositório.

A conversa com ferramentas de IA não será considerada a única fonte de conhecimento do projeto.

---

## DP-013 — Entrega de arquivos e uso de terminal

**Status:** Aprovada

Arquivos novos ou alterações extensas serão preferencialmente entregues prontos e organizados na mesma estrutura de pastas esperada no repositório.

Alterações pequenas em arquivos existentes poderão ser fornecidas como conteúdo pronto para copiar e colar.

GitHub Codespaces e Firebase Console serão utilizados quando houver necessidade técnica real, evitando comandos de terminal para operações simples de edição e upload de arquivos.

---

## DP-014 — Homologação manual por sprint

**Status:** Aprovada

Sempre que uma sprint introduzir ou alterar funcionalidade testável, será fornecido um roteiro de homologação manual.

Os testes deverão se concentrar nas alterações da sprint atual.

Funcionalidades de sprints anteriores somente entrarão em regressão manual quando a mudança atual puder impactá-las.

---

## Histórico

| Data | Decisão | Evento |
|---|---|---|
| 2026-09-28 | DP-001 a DP-012 | Fundação inicial do projeto |
| 2026-09-28 | DP-006, DP-007 e DP-011 | Separação física entre HML e PRD |
| 2026-09-28 | DP-013 e DP-014 | Processo de entrega e homologação incremental |
