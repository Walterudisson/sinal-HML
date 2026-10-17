# Sprint 1.7.0-B | Anexos na conversa

**Data de início:** 17/10/2026  
**Alvo:** HML somente (`sinaldesk-hml`), versão visual `1.7.0-B` após publicação.  
**Base homologada:** 1.7.0-A (infraestrutura, Rules e 5/5 smoke tests).  
**Situação (17/10/2026):** as quatro Cloud Functions foram implantadas no Firebase HML; CORS do bucket HML aplicado e conferido; PR #41 integrado à `main` de `sinal-HML` para testes de interface. **Aguardando publicação efetiva via GitHub Pages e homologação de upload/download com usuários HML. Nenhuma promoção a PRD.**

## Funcionalidade

- Botão de clipe ao lado de **Mensagem**, para solicitante ou atendente responsável em sinal não resolvido.
- Tipos JPEG, PNG, WebP e PDF; 1 arquivo por seleção, tamanho máximo de 10 MiB.
- Upload recuperável com indicador de progresso e cancelamento.
- Cartão de anexo na linha do tempo, sem expor um link persistente de download.
- Notificação para o outro participante somente após confirmação `ready`; atualização da atividade do sinal no Firestore.
- Imagem: pré-visualização com URL `blob:` temporária; PDF: download autenticado com link temporário local.
- Botão desabilitado quando o usuário não tem permissão de resposta ou quando o sinal está resolvido.

## Segurança backend

1. A Storage Rule autoriza somente criação, em caminho por tenant/ticket com metadados personalizados.
2. O cliente grava o documento **pending** e chama `finalizeSinalAttachment` na região `southamerica-east1`.
3. O backend revalida usuário global, organização, membro, sinal e identidade do remetente; compara tipo, tamanho, caminho, custom metadata, geração e **assinatura real** dos bytes.
4. Uma transação confirma `status: ready` e `confirmedAt`, rechecando permissão contra revogação e resolução concorrentes.
5. Se a confirmação falhar, o cliente tenta `discardSinalAttachment`; upload cancelado usa Firebase resumable task cancel.
6. Um job diário `cleanupSinalOrphanAttachments` realiza uma varredura paginada de no máximo 100 arquivos, marcando pendências antigas como falhas e removendo objetos com mais de 24 h sem metadados prontos.

**Pendências a verificar na revisão:** limpeza completa de documentos `pending` sem objeto Storage, corridas entre descarte e confirmação, custos/alertas do Cloud Scheduler, conformidade de tamanho real na leitura e assinatura de MIME, concorrência de abas.

## Implantação controlada em HML (realizada para backend; testes reais pendentes)

1. Revisar o PR e CI; instalar dependências no Cloud Shell e manter versões Node 22 para Functions.
2. Publicar **somente** `finalizeSinalAttachment`, `discardSinalAttachment`, `cleanupSinalOrphanAttachments` e `notifyNewAttachment` em `sinaldesk-hml`. O job agendado pode pedir habilitação de Cloud Scheduler e implicar custo; parar em solicitações não previstas.
3. Configurar **CORS do bucket HML** usando o arquivo `docs/deploy/cors-hml.json`, restrito à origem `https://walterudisson.github.io` (necessário para `getBlob` no navegador). Conforme a documentação Firebase, essa configuração deve ser feita no bucket. Conferir o nome do bucket e a configuração atual antes de qualquer alteração.
4. Validar callable com Firebase Auth e Rules reais: solicitante, responsável, não responsável, outro tenant, conta revogada, documento resolved, arquivos PNG/JPG/WebP/PDF válidos, arquivo de tipo adulterado e acima de 10 MiB.
5. **Só então** efetuar merge da branch em `main` para disponibilizar UI em GitHub Pages HML e realizar o smoke test mobile/web.
6. Homologação explícita antes de considerar promoção a PRD.

## Restrições e decisões

- **Sem áudio e vídeo** nesta versão. Futuramente, avaliar formatos, custo, limites e privacidade específicos.
- **Sem anexos na abertura do sinal**; isso pertence à 1.7.0-C.
- Não confundir `getBlob` autenticado com `getDownloadURL`, que produz URL com token portável.
- Não desativar usuários/tenants por edição isolada do status no Firebase Console. Usar procedimento de revogação e testar em usuários fictícios.
- Monitorar custos: as Rules limitam tamanho por objeto, não quantidade de arquivos ou consumo total. Controles de abuso/quotas continuam necessários para uso ampliado.

## Critério de homologação

- [x] Testes CI e emuladores aprovados para as mudanças entregues no PR #41.
- [ ] Backend de confirmação e limpeza implantado e testado no Firebase **HML**.
- [ ] CORS validado no browser com autenticação, sem links permanentes.
- [ ] Solicitante envia imagem, responsável visualiza; responsável envia PDF, solicitante baixa.
- [ ] Progresso e cancelamento funcionam no Android e desktop.
- [ ] Um terceiro usuário/tenant não consegue obter objeto, mesmo com ID conhecido.
- [ ] Regras negam arquivos não permitidos, tamanho excedente e sinal resolvido.
- [ ] Conversa de texto, Central, Início, Meus sinais e notificações não regrediram.
- [ ] Logs/custos, falhas e limpeza de órfãos analisados.
- [ ] Usuário homologou explicitamente.

**Produção:** inalterada.

## Primeira entrega de código e integração contínua

- Branch: `sprint/1.7.0-b-attachments-conversation`; PR #41 **integrado à `main` HML** em 17/10/2026, merge `765663e89e2589ae051203a018bbae1adad3d444`.
- GitHub Actions `Sinal Segurança HML - Anexos`: **sucesso** no commit `2e551b1a709fa6872ba84e07c5cc3903681ef6aa`, execução https://github.com/Walterudisson/sinal-HML/actions/runs/39057763302.
- Regressão dos testes das regras/emuladores, testes de funções e verificações sintáticas executadas no CI.
- **Cloud Functions implantadas no Firebase HML:** `finalizeSinalAttachment`, `discardSinalAttachment`, `cleanupSinalOrphanAttachments`, `notifyNewAttachment`. Firebase CLI confirmou `Deploy complete!`. A infraestrutura foi implantada **antes** do merge do frontend.
- **CORS do bucket HML aplicado e verificado:** origem `https://walterudisson.github.io`, métodos GET/HEAD/POST/PUT, cabeçalhos Authorization/Content-Type/x-goog-resumable, expiração 3600 s. Conferência `gcloud storage buckets describe ... --format="default(cors_config)"`.
- **Merge HML #41 realizado:** confirmação de GitHub. Frontend em operação no GitHub Pages HML, comprovado por captura e relato de teste do usuário em 17/10/2026.
- **Pendência:** smoke test real em HML por perfis, upload/download, isolamento entre tenants, falhas, notificação e CORS no navegador; não promover produção antes da homologação explícita.

## Teste funcional real de anexos, HML — 17/10/2026

O usuário reportou **“funcionou perfeitamente”** e enviou captura da interface `Conversa com o atendimento` após publicar a Sprint 1.7.0-B. Evidências observáveis na imagem:

- Botão de clipe e composer da conversa funcionando, sem perda das mensagens anteriores.
- Quatro cartões de anexos renderizados, sendo três imagens e um PDF, tanto nas bolhas do solicitante quanto do atendente.
- Nomes (truncados), ícones, tamanho e horário apresentados. Tamanhos visíveis: aproximadamente 347 KiB (imagem), 456 KiB (PDF), 4,5 MiB (imagem) e 4,7 MiB (imagem).
- A interface foi publicada em HML e o envio resultou em itens efetivamente apresentados como anexos confirmados.

**Estado:** fluxo feliz de envio e exibição de imagens/PDFs **validado pelo usuário em HML**, mas ainda não é homologação integral da Sprint B. A captura e o relato não isolam os testes de pré-visualização/download, cancelamento, arquivo inválido, limites, leitura cruzada entre tenants, tentativa de acesso de não responsável, expiração, limpeza, concorrência e custos. Realizar esses testes com contas e dados de teste antes de promover qualquer código ou regras para produção.

## Confirmação adicional de visualização e download em HML — 17/10/2026

O usuário confirmou, após o primeiro envio real de imagens e PDF:

- **Visualização de imagem:** ao tocar em uma imagem enviada pelo atendente, ela abriu corretamente no visualizador privado dentro do próprio Sinal.
- **PDF:** download concluído com sucesso a partir do cartão de anexo na conversa.

São testes funcionais positivos da interface e da obtenção do arquivo autenticado. **Não equivalem, isoladamente, à prova de que nenhum URL público existe ou de isolamento entre organizações.** Continuam pendentes testes de cancelamento, falha de rede, tipos e tamanhos rejeitados, permissão de terceiro/tenant, limpeza automática, custos e regressão.
