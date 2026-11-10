# Sinal | Homologação (HML)

## Versão em HML: v1.7.1.2

**v1.7.1 | Conversa Primeiro e Triagem Inteligente** (09/11/2026), com hotfix v1.7.1.1 e padronização visual v1.7.1.2.

- Solicitante abre o sinal por mensagem única, com anexo opcional, sem informar título, categoria ou prioridade.
- Título técnico automático e primeira mensagem criados no mesmo batch Firestore.
- Central oferece filtro e indicador **Sem triagem**; equipe classifica, define prioridade e pode corrigir o título.
- Histórico de triagem interno, transacional, auditável e protegido pelas Security Rules.
- Correções de navegação Android preservadas; identificação em **Mais → HML v1.7.1.2** e renovação do cache PWA.
- Etiquetas de status/prioridade com paleta uniforme na Central, Meus Sinais, Início e detalhes; **Sem triagem** violeta e **Alta** laranja, sem selo redundante **Classificado** nos cards.
- A implementação está isolada no [PR #45](https://github.com/Walterudisson/sinal-HML/pull/45). **Não foi publicada no HML.**
- Testes automatizados no CI aprovados, sem substituir homologação manual.

**Publicação obrigatoriamente coordenada:** as regras novas não aceitam o formulário anterior. Consultar o [roteiro de deploy HML](docs/sprints/DEPLOY-SPRINT-1.7.1-HML.md) antes de qualquer merge, deploy ou ação na `main`. A implantação das Rules requer a conta autorizada no Firebase `sinaldesk-hml`.

### Materiais da sprint
- [Especificação 1.7.1](docs/sprints/SPRINT-1.7.1.md)
- [Testes de homologação 1.7.1](docs/sprints/HOMOLOGACAO-SPRINT-1.7.1.md)
- [Plano técnico e resultados](docs/sprints/SPRINT-1.7.1-IMPLEMENTACAO.md)

## Versão atualmente publicada

**HML v1.7.0-C**, homologação funcional consolidada. **PRD v1.6.3.1**, sem alterações.

## Histórico

- [Sprint 1.7.0-B: anexos privados na conversa](docs/sprints/SPRINT-1.7.0-B.md).
- [Hotfix 1.7.0-B.1: limpeza de uploads cancelados](docs/sprints/HOTFIX-1.7.0-B1.md).
- [Hotfix 1.6.3.1: notificações na conversa](docs/sprints/HOTFIX-1.6.3.1.md).
