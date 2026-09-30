# Sinal — Firestore / FCM Setup HML

## Sprint 1.3 — Notificações + PWA

Firebase: `sinaldesk-hml`

### 1. Publicar Security Rules
Publique o arquivo `firestore.rules`.

Novas subcoleções automáticas:

```text
tenants/{tenantId}/members/{uid}/notifications/{notificationId}
tenants/{tenantId}/members/{uid}/devices/{deviceId}
```

### 2. Gerar chave pública Web Push (VAPID)
No Firebase Console do HML:

**Project Settings → Cloud Messaging → Web configuration → Web Push certificates**

Gere um par de chaves e copie apenas a **chave pública**.

Cole em:

`js/config/notifications.js`

substituindo:

`SUBSTITUA_PELA_CHAVE_PUBLICA_VAPID_HML`

A chave pública VAPID não é segredo.

### 3. Cloud Functions
As funções estão em `functions/` e usam Node.js 20.

No Codespaces, a partir da raiz do repositório:

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

`.firebaserc` aponta para `sinaldesk-hml`.

Funções:
- `notifyNewTicket`
- `notifyNewMessage`

### 4. Eventos
Novo sinal:
- notifica admins, supervisores e agentes ativos;
- não notifica o próprio autor.

Nova mensagem:
- mensagem do solicitante → responsável;
- mensagem do responsável → solicitante;
- nunca notifica o próprio autor.

### 5. PWA
Arquivos principais:
- `manifest.webmanifest`
- `service-worker.js`
- `offline.html`
- `icons/`

No iPhone/iPad, Web Push deve ser testado com o Sinal aberto como web app instalado na Tela de Início.
