# Sinal 1.4.3: manutenção HML

Escopo fechado antes da Sprint 1.5:
- Início com foco nos indicadores operacionais (removido o card Organização).
- Mais com organização, perfil, ambiente e versão.
- Versão web centralizada em `js/config/version.js`; HML = `1.4.3`.
- Sidebar desktop com versão e identificação curta do ambiente.
- Dependências das Cloud Functions alinhadas com a correção já testada em PRD.
- Configuração explícita das regras Firestore em `firebase.json`.
- Cache PWA identificado com a release.

## Validação antes do merge HML

Na raiz do repositório:
```bash
nvm use 22
node --test tests/ux1.test.cjs tests/release-1.4.3.test.cjs
cd functions
npm ci
npm audit
npm test
```

**Regiões das funções HML:** conferidas no Firebase em 03/10/2026: `notifyNewTicket`, `notifyNewMessage` e `notifyTicketStatus` estão implantadas em `southamerica-east1`, Node.js 22, segunda geração. A branch agora declara explicitamente essa região para as três funções, igual ao PRD. **Não é necessário fazer deploy das funções para homologar a interface 1.4.3**: validar esse ajuste de código agora e implantá-lo somente na próxima publicação necessária das funções.

O deploy da versão HML via GitHub Pages requer merge autorizado desta branch para `main`. Esta release **não exige** deploy de regras nem das funções se já estiverem operacionais; a correção das dependências só será implantada na próxima publicação necessária das funções.

## Homologação manual HML
1. Início: Organização não aparece como card; para agente aparecem Meus sinais e Central.
2. Mais: organização, perfil, ambiente HML e v1.4.3 aparecem corretamente.
3. Menu lateral desktop: identificação HML e v1.4.3 visíveis.
4. Mobile: o menu Mais permite consultar as mesmas informações.
5. Regressão: criar, assumir e abrir um sinal; testar uma mensagem; confirmar notificações.
6. PWA: fechar/reabrir, conferir atualização visual e navegação.

Antes da promoção a PRD, adaptar somente a identificação visual de ambiente, a configuração Firebase e o cache; manter o número `1.4.3`. Confirmar com o responsável que a janela de migração em PRD é adequada.
