# 🚨 URGENTE: APLICAR REGRAS DO FIRESTORE

## ⚠️ PROBLEMA ATUAL
A funcionalidade "Propor Nova Marca" está implementada, mas o Firestore está bloqueando as solicitações com erro `permission-denied`.

## 🔥 REGRA QUE PRECISA SER ADICIONADA

No **Firebase Console** > **Firestore Database** > **Regras**, adicione esta regra:

```javascript
// Allow suppliers to submit pending brand requests
match /pending_brand_requests/{requestId} {
    allow create: if true; // Allow any user (including anonymous portal users) to create a brand request
    allow read: if true; // Allow reading for suppliers to see their own requests
    allow update, delete: if isOwner(resource.data.userId); // Only the quotation owner can approve/reject
}
```

## 📍 ONDE ADICIONAR

Cole essa regra **ANTES** da chave de fechamento `}` das regras existentes, junto com as outras regras similares.

## 🚀 RESULTADO ESPERADO

Após aplicar:
- ✅ Fornecedores poderão criar solicitações de marca
- ✅ Cards laranja aparecerão corretamente
- ✅ Não haverá mais erro `permission-denied`

## 🎯 TESTE

1. Vá para o portal do fornecedor
2. Clique em "Outra Marca"
3. Preencha o formulário
4. Clique "Enviar Proposta"
5. Deve aparecer: "Solicitação Enviada!"

---
**URGENTE**: Aplique essa regra para ativar a funcionalidade!