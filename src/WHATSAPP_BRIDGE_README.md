# 📱 Documentação Técnica da Ponte WhatsApp (WhatsApp Bridge)

Este documento descreve a arquitetura do banco de dados Firestore e a lógica implementada para que a ponte local do WhatsApp (`whatsapp-bridge`) funcione corretamente com a aplicação web.

## 🏗️ Visão Geral da Arquitetura

A comunicação entre a aplicação web (Next.js) e a ponte local (Node.js + `whatsapp-web.js`) é feita através de duas coleções principais no Firestore, de forma totalmente desacoplada e em tempo real.

A arquitetura é projetada para ser **multi-instância**: cada usuário da aplicação web executa sua própria instância separada desta ponte, garantindo que os dados e as sessões de WhatsApp sejam completamente isolados.

1.  **`user_sessions`**: Para gerenciar o ciclo de vida da conexão do WhatsApp de um usuário específico (iniciar sessão, gerar QR code, manter conexão ativa).
2.  **`incoming_messages`**: Para gerenciar o envio e o recebimento de todas as mensagens de um usuário específico em uma fila unificada que também serve como histórico.

---

## 1. 📊 Coleção `user_sessions`

Esta coleção controla o estado da conexão de cada usuário com o WhatsApp. A ponte deve "ouvir" (`listen`) por mudanças nesta coleção para saber quando agir.

**ID do Documento:** `userId` (o ID de autenticação do usuário)

### Estrutura do Documento

```json
{
  "status": "connected" | "disconnected" | "needs_qr" | "create_requested" | "failed",
  "qrCode": "data:image/png;base64,...",
  "requestedAt": Timestamp,
  "connectedAt": Timestamp,
  "disconnectedAt": Timestamp,
  "updatedAt": Timestamp,
  "error": "Mensagem de erro se a conexão falhou"
}
```

### Lógica de Operação da Ponte

A ponte deve ter um **listener contínuo** na coleção `user_sessions`, especificamente para documentos onde o `status` é `"create_requested"`.

**Fluxo de Criação de Sessão:**

1.  **Web App**: Quando o usuário solicita a conexão, a aplicação web cria ou atualiza um documento na coleção `user_sessions` com o `userId` do usuário e define o `status: "create_requested"`.
2.  **Ponte (Listener)**: O listener da ponte detecta este novo documento ou a mudança de status.
3.  **Ponte (Ação)**: A ponte inicia uma nova instância do cliente `whatsapp-web.js`.
    *   Se um QR Code for necessário, a ponte atualiza o mesmo documento com `status: "needs_qr"` e o campo `qrCode` com a string da imagem.
    *   Quando o usuário escaneia e a conexão é bem-sucedida, a ponte atualiza o documento com `status: "connected"`.
    *   Se a conexão falhar ou for perdida, a ponte atualiza o `status` para `"failed"` ou `"disconnected"`.

---

## 2. 📨 Coleção `incoming_messages`

Esta coleção unificada serve tanto como **fila de envio** quanto como **histórico completo** de todas as mensagens.

### Estrutura do Documento

```json
{
  "isOutgoing": boolean,
  "status": "pending" | "sent" | "failed" | "received" | "read",
  "phoneNumber": "5511999998888",
  "supplierName": "Nome do Fornecedor",
  "message": "Conteúdo da mensagem.",
  "userId": "ID do usuário dono da sessão",
  "createdAt": Timestamp,
  "updatedAt": Timestamp,
  "sentAt": Timestamp,
  "error": "Motivo da falha"
}
```

### Lógica de Operação da Ponte

A ponte deve ter **dois mecanismos**: um para enviar mensagens e outro para receber.

#### A. 📤 Envio de Mensagens (Lógica de Fila)

A ponte deve ter um **listener contínuo** na coleção `incoming_messages`, filtrando por documentos que atendam a duas condições:
- `isOutgoing == true`
- `status == "pending"`

**Fluxo de Envio:**

1.  **Web App**: Para enviar uma notificação, a aplicação cria um novo documento na coleção com `isOutgoing: true` e `status: "pending"`.
2.  **Ponte (Listener)**: O listener da ponte detecta este novo documento pendente.
3.  **Ponte (Ação)**: A ponte verifica se a sessão do `userId` correspondente está ativa. Se estiver, ela usa o cliente `whatsapp-web.js` para enviar a mensagem para o `phoneNumber`.
4.  **Ponte (Atualização)**: Após a tentativa de envio, a ponte **atualiza o status** do mesmo documento para `"sent"` (em caso de sucesso) ou `"failed"` (em caso de erro, preenchendo o campo `error`).

#### B. 📥 Recebimento de Mensagens

A ponte deve escutar o evento `'message'` do cliente `whatsapp-web.js`.

**Fluxo de Recebimento:**

1.  **WhatsApp**: Um fornecedor envia uma mensagem para o número conectado.
2.  **Ponte (Evento)**: O evento `'message'` é disparado na instância do cliente correspondente.
3.  **Ponte (Ação)**: A ponte cria um **novo documento** na coleção `incoming_messages` com `isOutgoing: false` e `status: "received"`, preenchendo os detalhes da mensagem recebida.

---

## 3. 🚀 Como Executar a Ponte

1.  **Instalação**: No diretório `whatsapp-bridge`, execute `npm install` para baixar as dependências (`whatsapp-web.js`, `firebase`, etc.).
2.  **Execução**: Execute `npm start` ou `node src/index.js` para iniciar a ponte.
3.  **Monitoramento**: Acompanhe o console do terminal para ver os logs de conexão, envio e recebimento de mensagens. A ponte se conectará automaticamente ao Firestore e começará a ouvir por mudanças.
