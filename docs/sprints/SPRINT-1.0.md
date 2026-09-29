# Sinal — Sprint 1.0

## Mandar um sinal

**Status:** Em homologação  
**Ambiente:** HML  
**Data:** 2026-09-28

## Objetivo

Entregar a primeira funcionalidade de negócio real do Sinal: permitir que um usuário autenticado abra uma solicitação e a veja imediatamente em sua lista.

## Entregas

- CTA `Mandar um sinal` funcional.
- Composer responsivo:
  - bottom sheet/fullscreen no mobile;
  - modal central no desktop.
- Campos:
  - assunto;
  - categoria;
  - prioridade;
  - descrição.
- Validação de obrigatoriedade.
- Limites de tamanho.
- Gravação real no Firestore HML.
- Status inicial `open`.
- Código curto do sinal.
- Lista `Meus sinais` em tempo real.
- Contador de sinais.
- Exibição do sinal também na área `Sinais`.
- Security Rules para criação e leitura dos próprios sinais.
- Toasts reposicionados para o canto superior direito.
- Toast empilhável e descartável.
- Mensagem `Sinal recebido` após criação.

## Categorias provisórias

Nesta sprint:

- Acesso
- Equipamento
- Rede
- Sistemas
- Outro

As categorias ainda são definidas no frontend. A administração de categorias por tenant entrará posteriormente.

## Prioridades

- Baixa
- Normal
- Alta
- Urgente

## Modelo inicial de ticket

```text
tenants/{tenantId}/tickets/{ticketId}
```

O usuário autenticado é automaticamente registrado como solicitante.

## Decisão de segurança

Na Sprint 1.0 o frontend pode:

- criar seus próprios sinais;
- ler seus próprios sinais.

Não pode:

- alterar sinais existentes;
- excluir sinais;
- assumir sinais;
- acessar sinais de outro solicitante.

Essas capacidades serão abertas de forma incremental conforme os fluxos de atendimento forem implementados.

## Regressão impactada

Como o shell e o `main.js` foram alterados, o roteiro inclui:

- login;
- contexto multi-tenant;
- navegação;
- persistência de sessão;
- logout.

Recuperação de senha não é afetada diretamente pelo fluxo de ticket, mas permanece coberta por um smoke test curto por compartilhar o módulo de autenticação.

## Fora do escopo

- Anexos.
- Comentários/respostas.
- Notas internas.
- Triagem.
- Atribuição.
- Equipes.
- Alteração de status.
- Encerramento.
- SLA.
- Categorias administráveis.
- Numeração sequencial.
- PRD.

## Critério de pronto

A Sprint 1.0 será concluída após execução de `HOMOLOGACAO-SPRINT-1.0.md` e aprovação explícita do responsável pelo produto.
