# Sprint 1.7.0-C | Anexo na abertura + Voltar do Android

**Ambiente:** somente HML (`sinaldesk-hml`).  
**Base:** 1.7.0-B.1.  
**Versão visual da branch:** `1.7.0-C`.  
**Estado:** proposta implementada em branch para CI e homologação. **Não publicada em PRD.**

## Entrega 1 | Anexo opcional ao mandar um sinal

- O formulário de abertura permite selecionar **um** JPG, PNG, WebP ou PDF de até **10 MiB**.
- Validação ocorre **antes** de criar o sinal; arquivo inválido pode ser removido e escolhido novamente.
- Ao enviar, o sinal é **criado primeiro** no Firestore; somente depois começa a transferência do anexo.
- Reutiliza `uploadConversationAttachment`, inclusive `pending → ready` por Cloud Function, progressão do upload, cancelamento e limpeza de falhas.
- Se upload falhar, a conexão cair ou o usuário cancelar, **o sinal já criado permanece** e a confirmação informa que o arquivo pode ser reenviado pela conversa.
- Nenhuma alteração no esquema, nas Storage/Firestore Rules ou em Cloud Functions. O campo técnico `origin` continua `conversation`, exigido pelas regras existentes, pois o anexo passa a integrar a mesma linha do tempo do sinal.
- Sem áudio/vídeo, anexos múltiplos, uploads paralelos nem URLs de download públicos.

## Entrega 2 | Android Voltar fecha primeiro a prévia

**Defeito:** ao abrir uma imagem da conversa e usar Voltar do Android, o histórico retornava diretamente aos detalhes do sinal, pulando a conversa.

**Correção:** a prévia recebe seu próprio estado filho do estado `conversation` no `overlay-history.js`. A navegação deve obedecer à ordem:

`Imagem → Conversa → Detalhes → tela anterior`.

- O botão visual **Fechar ×** da imagem e a tecla **Escape** devem seguir a mesma ordem.
- Toques duplos no botão fechar não podem consumir dois estados.
- O blob URL temporário da imagem é revogado ao sair da prévia.
- O download de PDF não abre a prévia e não altera o histórico.
- Teste de regressão Node: `tests/overlay-preview-navigation-1.7.0-c.test.mjs`.

## Testes de homologação HML

1. Em **Mais**, verificar `HML v1.7.0-C` depois do merge/publicação do GitHub Pages.
2. Abrir sinal **sem** anexo: fluxo anterior deve permanecer íntegro.
3. Abrir sinal com imagem pequena: observar progresso e confirmar imagem na conversa do sinal.
4. Abrir sinal com PDF: conferir visualização/download autenticado na conversa.
5. Selecionar arquivo acima de 10 MiB ou não permitido: mensagem orientativa antes da criação.
6. Cancelar upload com arquivo grande ou rede lenta: confirmar que o sinal foi criado, o anexo não ficou visível como `ready` e não restou objeto cancelado no Storage HML após processamento.
7. Simular falha de upload: não deve repetir nem remover sinal criado.
8. Na conversa, abrir imagem, tocar **Voltar** do Android: fecha só a imagem. Tocar Voltar novamente: retorna aos detalhes.
9. Na imagem, usar **Fechar ×**: retorna apenas à conversa. No desktop, testar **Escape**.
10. Verificar filtros e mensagens, Android/PWA e que PRD permanece na v1.6.3.1.

## Portões de implantação

- [ ] CI da branch concluída sem falhas (regras/emuladores, functions, sintaxe e navegação).
- [ ] Revisão de código e homologação funcional no HML físico.
- [ ] Conferência de ausência de objetos órfãos após cancelamento.
- [ ] Aprovação explícita do usuário antes de qualquer merge em `main` de HML.
- [ ] **Não promover PRD nesta sprint** sem decisão de release separada.

**Risco aceito temporariamente:** testes manuais de isolamento entre usuários/organizações da 1.7.0-B foram dispensados para prosseguir no **desenvolvimento**. Os testes automatizados existentes dão alguma cobertura, mas não autorizam concluir que o isolamento multi-tenant foi validado no Firebase real. Devem constar como pendência explícita antes de disponibilização ampla em produção.
