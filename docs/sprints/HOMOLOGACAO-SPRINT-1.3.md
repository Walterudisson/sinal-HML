# Sinal — Homologação da Sprint 1.3

## Pré-condições
- Sprint 1.2 homologada e em PRD.
- Rules 1.3 publicadas em HML.
- chave pública VAPID HML configurada.
- Cloud Functions implantadas.
- usuário solicitante de teste e Walter/Admin disponíveis.

## HML-1.3-01 — PWA
- [ ] `manifest.webmanifest` carrega.
- [ ] ícone aparece corretamente.
- [ ] instalação funciona em Android/Chrome compatível.
- [ ] app abre em modo standalone após instalado.

## HML-1.3-02 — iPhone/iPad
- [ ] orientação em `Mais` explica Adicionar à Tela de Início.
- [ ] app instalado abre como web app.
- [ ] botão Ativar notificações funciona somente a partir da interação do usuário.

## HML-1.3-03 — Permissão e dispositivo
- [ ] ativar notificações solicita permissão.
- [ ] após permitir, documento aparece em `members/{uid}/devices`.
- [ ] status em Mais muda para ativo.

## HML-1.3-04 — Novo sinal
Com solicitante de teste, crie um sinal.
- [ ] Walter recebe notificação in-app.
- [ ] sino mostra contador.
- [ ] toast aparece se app estiver aberto.
- [ ] com app em segundo plano, chega Web Push.
- [ ] autor do sinal não recebe notificação do próprio evento.

## HML-1.3-05 — Abrir pelo push
- [ ] toque no push abre o Sinal.
- [ ] após autenticação existente, abre o ticket correto.

## HML-1.3-06 — Mensagem solicitante → atendente
- [ ] Walter assume o sinal.
- [ ] solicitante envia mensagem.
- [ ] Walter recebe aviso.
- [ ] solicitante não recebe aviso da própria mensagem.

## HML-1.3-07 — Mensagem atendente → solicitante
- [ ] Walter responde.
- [ ] solicitante recebe aviso.
- [ ] Walter não recebe aviso da própria mensagem.

## HML-1.3-08 — Central de notificações
- [ ] sino abre painel mobile-first.
- [ ] não lidas visualmente distintas.
- [ ] tocar item abre o ticket.
- [ ] item é marcado como lido.
- [ ] Marcar todas como lidas zera contador.

## HML-1.3-09 — Desativar push
- [ ] botão desativa o dispositivo.
- [ ] `enabled = false` no Firestore.
- [ ] notificações in-app continuam funcionando.

## HML-1.3-10 — Offline
- [ ] com app previamente carregado, ficar offline e navegar/reabrir exibe tela offline amigável.
- [ ] ao voltar conexão, Tentar novamente recupera o app.

## HML-1.3-11 — Regressão mobile
- [ ] Mandar um sinal funciona.
- [ ] Central funciona.
- [ ] assumir funciona.
- [ ] conversa funciona.
- [ ] Voltar fecha overlays antes de sair.
- [ ] sem rolagem horizontal nova.

# Resultado
- [ ] SPRINT 1.3 APROVADA
- [ ] SPRINT 1.3 REPROVADA
- [ ] APROVADA COM CORREÇÕES PENDENTES
