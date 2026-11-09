# Homologação da Sprint 1.7.1 | Conversa Primeiro e Triagem Inteligente

**Roteiro proposto para HML.** Não executar antes da implantação controlada da sprint.  
**Ambientes:** HML `sinaldesk-hml`; PRD intocada.  
**Perfis:** Solicitante Teste, Atendente Teste, Superadmin e, quando disponíveis, admin/supervisor e membro de outra organização. A ausência de outro tenant não autoriza aprovar isolamento real.

## Preparação

- [ ] Conferir identificação `HML v1.7.1` após publicação autorizada.
- [ ] Confirmar CI, Firebase Emulator Suite e Rules corretas em HML.
- [ ] Manter um sinal antigo com categoria e prioridade existentes.
- [ ] Manter sinal criado na 1.7.0-C com anexo para regressão.
- [ ] Identificar quais testes exigem outro tenant/usuário e registrar explicitamente quando não executados.

## A. Solicitante (funcional)

| ID | Procedimento | Aceite |
|---|---|---|
| HML-171-01 | Abrir **Mandar um Sinal** | Uma única mensagem obrigatória; sem título/categoria/prioridade |
| HML-171-02 | Tentar mensagem vazia, espaços e menos de 3 caracteres | Bloqueio com orientação clara e sem sinal criado |
| HML-171-03 | Enviar mensagem 3–4.000 caracteres | Um sinal criado, código exibido e mensagem inteira preservada |
| HML-171-04 | Mensagem longa com quebras de linha | Título curto, legível e com no máximo 80 caracteres |
| HML-171-05 | Abrir novo sinal | Conversa aberta diretamente, mensagem inicial exibida uma só vez |
| HML-171-06 | Enviar sem anexo | Fluxo normal, sinal em Meus Sinais |
| HML-171-07 | Enviar JPG/PNG/WebP/PDF permitido | Anexo privado visível na conversa |
| HML-171-08 | Cancelar/falhar upload depois da criação | Sinal + mensagem persistem, sem anexo pronto indevido |
| HML-171-09 | Tocar duas vezes em enviar | Exatamente um sinal e uma primeira mensagem |
| HML-171-10 | Simular rede instável/retorno incerto | Não duplica sinal nem perde texto antes de confirmação |
| HML-171-11 | Abrir sinal em Meus Sinais | Conversa priorizada e detalhes disponíveis secundariamente |
| HML-171-12 | Voltar Android em conversa/prévia de imagem | Ordem correta: imagem → conversa → detalhes/tela anterior, sem sair da PWA |

## B. Atendente (funcional)

| ID | Procedimento | Aceite |
|---|---|---|
| HML-171-13 | Receber sinal recém-criado | Aparece na Central como **Sem triagem**, sem prioridade fictícia |
| HML-171-14 | Filtrar Sem triagem | Fila e contador corretos; sinal nunca desaparece por falta de prioridade |
| HML-171-15 | Classificar sem assumir | Agente autorizado consegue definir categoria e prioridade |
| HML-171-16 | Assumir e conversar antes da classificação | Permitido; pendência continua visível |
| HML-171-17 | Reclassificar como responsável | Alteração persistida; histórico mostra antes/depois e ator |
| HML-171-18 | Alterar título técnico | Título atualizado, descrição original preservada e evento auditado |
| HML-171-19 | Usar filtros por categoria, prioridade, busca e ordenação | Sinais antigos e novos continuam encontráveis |
| HML-171-20 | Resolver e reabrir sinal | Regras e histórico anteriores preservados |

## C. Segurança (Emulator + Firebase HML real quando autorizado)

| ID | Procedimento | Aceite |
|---|---|---|
| SEC-171-01 | Solicitante tenta editar categoria/prioridade/título no Firestore | **permission-denied** |
| SEC-171-02 | Agente tenta alterar sinal atribuído a outro agente | **permission-denied**, salvo regra explícita por perfil |
| SEC-171-03 | Admin/supervisor corrige sinal do próprio tenant | Permitido com histórico correto |
| SEC-171-04 | Agente tenta forjar identidade/horário/histórico | **permission-denied** |
| SEC-171-05 | Conta inativa tenta criar/classificar | **permission-denied** |
| SEC-171-06 | Outro tenant tenta ler/escrever sinal/mensagem/anexo | **permission-denied** |
| SEC-171-07 | Criar ticket sem primeira mensagem, ou primeira mensagem sem ticket válido | **permission-denied** ou transação abortada |
| SEC-171-08 | Concorrência em duas classificações | Não perde alterações nem aceita sobrescrita silenciosa |
| SEC-171-09 | Forjar metadados de anexos `ready` ou URL pública | Bloqueado |
| SEC-171-10 | Verificar notificações de abertura/resposta | Sem duplicidade introduzida pela primeira mensagem |

## D. Regressões e gates

- [ ] Login e recuperação de senha.
- [ ] Central e Meus Sinais após troca de sessão.
- [ ] Anexos anteriores ainda disponíveis somente a quem tem permissão.
- [ ] Limpeza de uploads abandonados no Storage HML após tempo adequado.
- [ ] Regressão dos fluxos de resolução privada/reabertura.
- [ ] Android, desktop, PWA e teclado.
- [ ] Conferência de que PRD continua na versão anterior e não foi modificada.

**Registro:** para cada caso anotar Aprovado, Falhou ou Não executado, evidência, perfil e data. Não somar **Não executado** como aprovação. Encerrar homologação apenas após revisão dos itens críticos, testes de segurança e autorização explícita do responsável pelo produto.
