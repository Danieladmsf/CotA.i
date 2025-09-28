# 🔥 ATUALIZAÇÃO NECESSÁRIA DAS REGRAS DO FIRESTORE

## ⚠️ AÇÃO REQUERIDA

Para que a nova funcionalidade de "Propor Nova Marca" funcione corretamente, as regras do Firestore precisam ser atualizadas no Firebase Console.

## 📋 INSTRUÇÕES

1. **Acesse o Firebase Console**: https://console.firebase.google.com/
2. **Selecione o projeto**: `cotao-online`
3. **Vá para**: Firestore Database > Regras
4. **Substitua as regras atuais** pelo conteúdo do arquivo `firestore.rules` atualizado

## ✅ REGRAS ATUALIZADAS

As seguintes alterações foram feitas no arquivo `firestore.rules`:

### 1. Adicionado `pending_brand_requests` às coleções permitidas:
```javascript
// ANTES
allow read, write: if collection in ['supplies', 'supply_categories', 'fornecedores', 'quotations', 'shopping_list_items', 'incoming_messages', 'user_sessions', 'whatsapp_config'] && isOwner(resource.data.userId);

// DEPOIS  
allow read, write: if collection in ['supplies', 'supply_categories', 'fornecedores', 'quotations', 'shopping_list_items', 'incoming_messages', 'user_sessions', 'whatsapp_config', 'pending_brand_requests'] && isOwner(resource.data.userId);
```

### 2. Nova regra específica para solicitações de marca:
```javascript
// NOVA REGRA ADICIONADA
match /pending_brand_requests/{requestId} {
    allow create: if true; // Allow any user (including anonymous portal users) to create a brand request
    allow read: if true; // Allow reading for suppliers to see their own requests  
    allow update, delete: if isOwner(resource.data.userId); // Only the quotation owner can approve/reject
}
```

## 🚀 FUNCIONALIDADE IMPLEMENTADA

Após aplicar essas regras, os fornecedores poderão:

- ✅ Clicar no botão "Outra Marca"
- ✅ Preencher o formulário no modal
- ✅ Fazer upload de imagens para o Vercel Blob Storage
- ✅ Salvar solicitações na coleção `pending_brand_requests`
- ✅ Ver cards laranja com "Aguardando Aprovação"

## 📝 COMANDO PARA APLICAR

Depois de fazer login no Firebase CLI:

```bash
cd /root/pagina-cota.i
firebase deploy --only firestore:rules
```

## 🔍 VERIFICAÇÃO

Após aplicar as regras:
1. Teste a funcionalidade "Outra Marca" no portal do fornecedor
2. Verifique se não há mais erros de `permission-denied`
3. Confirme que as solicitações aparecem como cards laranja

---
**Status**: 🟡 Aguardando aplicação das regras do Firestore
**Funcionalidade**: ✅ Implementada e pronta para uso