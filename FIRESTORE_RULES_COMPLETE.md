# 🔥 REGRAS COMPLETAS DO FIRESTORE

## 📋 Como Aplicar

### **Opção 1: Console Firebase (Recomendado)**
1. Acesse [Firebase Console](https://console.firebase.google.com)
2. Selecione seu projeto
3. Vá para **Firestore Database** → **Rules**
4. Cole o código abaixo
5. Clique em **"Publish"**

### **Opção 2: Firebase CLI**
```bash
# 1. Salve o código abaixo em firestore.rules
# 2. Execute:
firebase deploy --only firestore:rules
```

### **Opção 3: Script Automático**
```bash
./apply-firestore-rules.sh
```

---

## 🔥 **CÓDIGO COMPLETO DAS REGRAS**

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    match /{document=**} {
      allow read, write: if false;
    }

    match /users/{userId}/{document=**} {
      allow read, write: if true;
    }

    match /user_sessions/{userId} {
      allow read, write: if true;
    }

    match /quotation_requests/{requestId} {
      allow read, create, update, delete: if true;
    }

    match /fornecedores/{supplierId} {
      allow get: if true;
      allow list, create, update: if true;
    }

    match /quotations/{quotationId} {
      allow read, create, update, delete: if true;
    }

    match /quotations/{quotationId}/products/{productId}/offers/{offerId} {
      allow create: if true;
      allow read, update, delete: if true;
    }

    match /shopping_list_items/{itemId} {
        allow read, create, update, delete: if true;
    }

    match /supplies/{supplyId} {
        allow read, create, update, delete: if true;
    }

    match /supply_categories/{categoryId} {
        allow read, create, update, delete: if true;
    }

    match /brand_proposals/{proposalId} {
      allow read, write: if true;
    }

    match /pending_brand_offers/{offerId} {
      allow read, write: if true;
    }

    match /pending_brand_requests/{requestId} {
      allow read, write: if true;
    }

    // ==========================================
    // NOVAS REGRAS PARA SISTEMA DE NOTIFICAÇÕES
    // ==========================================
    
    // Rules for notifications system
    match /notifications/{notificationId} {
      allow read, write: if true;
    }

    // Rules for WhatsApp messages
    match /incoming_messages/{messageId} {
      allow read, write: if true;
    }

    // Rules for WhatsApp configuration
    match /whatsapp_config/{configId} {
      allow read, write: if true;
    }
  }
}
```

---

## ✅ **O que essas regras fazem:**

### **Suas Regras Existentes (Mantidas):**
- ✅ `users/{userId}` - Dados de usuários
- ✅ `user_sessions/{userId}` - Sessões de usuário
- ✅ `quotation_requests/{requestId}` - Solicitações de cotação
- ✅ `fornecedores/{supplierId}` - Dados de fornecedores
- ✅ `quotations/{quotationId}` - Cotações
- ✅ `quotations/.../offers/{offerId}` - Ofertas em cotações
- ✅ `shopping_list_items/{itemId}` - Itens de lista de compras
- ✅ `supplies/{supplyId}` - Insumos/produtos
- ✅ `supply_categories/{categoryId}` - Categorias de insumos
- ✅ `brand_proposals/{proposalId}` - Propostas de marca
- ✅ `pending_brand_offers/{offerId}` - Ofertas de marca pendentes
- ✅ `pending_brand_requests/{requestId}` - Solicitações de marca pendentes

### **Novas Regras Adicionadas:**
- 🆕 `notifications/{notificationId}` - **Sistema de notificações**
- 🆕 `incoming_messages/{messageId}` - **Mensagens WhatsApp**
- 🆕 `whatsapp_config/{configId}` - **Configurações WhatsApp**

---

## 🧪 **Após Aplicar as Regras:**

1. **Recarregue a página da aplicação**
2. **Vá para Cotações → Aprovações**
3. **Clique em "Testar Sistema de Notificações"**
4. **Verifique se o sino mostra notificação**
5. **Teste o histórico completo no sino**

---

## 🆘 **Se Houver Problemas:**

- **Erro "syntax error"**: Verifique se copiou todo o código corretamente
- **Ainda não funciona**: Aguarde alguns segundos para propagação
- **Erro de permissão**: Confirme que você tem acesso de admin ao projeto Firebase

**O sistema está 100% pronto para funcionar após aplicar essas regras!** 🚀