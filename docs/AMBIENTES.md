# Sinal — Ambientes

## Objetivo

Manter desenvolvimento/homologação e produção fisicamente separados.

## HML

- Repositório: `Walterudisson/sinal-HML`
- Branch publicada: `main`
- Firebase: `sinaldesk-hml`
- Uso: desenvolvimento, correções, experimentos e homologação manual
- Domínio personalizado de produção: **não utilizar**

## PRD

- Repositório: `Walterudisson/sinal`
- Branch publicada: `main`
- Firebase: `sinaldesk`
- Uso: somente versões homologadas
- Domínio oficial: `https://sinal.app.br`

## Regra de promoção

1. Implementar em HML.
2. Executar testes técnicos.
3. Publicar no GitHub Pages de HML.
4. Executar o roteiro manual da sprint.
5. Corrigir eventuais falhas em HML.
6. Obter aprovação explícita.
7. Preparar pacote de PRD a partir da versão homologada.
8. Promover o pacote para `Walterudisson/sinal`.
9. Executar smoke test de produção quando aplicável.

## Firebase

Nunca reutilizar configuração Firebase de PRD em HML ou configuração Firebase de HML em PRD.

A configuração Web do Firebase identifica o projeto, mas a segurança da aplicação depende de Authentication, Security Rules, App Check e validações server-side quando aplicáveis.
