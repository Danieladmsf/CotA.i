# 🔧 Correção do Campo "Total Un na Emb."

## ❌ Problema Identificado

O input "Total Un na Emb. *" não estava recebendo nem salvando o valor digitado pelo usuário.

## 🔍 Causa Raiz

O campo estava mapeado incorretamente para `offer.unitsPerPackage` no display, mas:

1. **Campo não inicializado**: `unitsPerPackage` não estava sendo inicializado nas criações de ofertas
2. **Inconsistência de mapeamento**: O `onChange` estava correto, mas o `value` não estava consistente
3. **Payload incompleto**: O campo não estava sendo incluído no payload de salvamento

## ✅ Correções Implementadas

### 1. **Corrigido mapeamento do campo**
```typescript
// ANTES (não funcionava)
value={offer.unitsPerPackage || ''}
onChange={(e) => handleOfferChange(product.id, offer.uiId, 'unitsPerPackage', e.target.value)}

// DEPOIS (corrigido)
value={offer.unitsPerPackage || ''}
onChange={(e) => handleOfferChange(product.id, offer.uiId, 'unitsPerPackage', parseInt(e.target.value) || 0)}
```

### 2. **Inicialização em criações de ofertas**
```typescript
// Adicionado em addOfferField()
const newOffer: OfferWithUI = {
  // ... outros campos ...
  unitsInPackaging: 0,
  unitsPerPackage: 0,  // ✅ ADICIONADO
  unitWeight: 0,
  // ... outros campos ...
};

// Adicionado em completeVendorFlow()
const newOffer: OfferWithUI = {
  // ... outros campos ...
  unitsInPackaging: flow.requiredPackages,
  unitsPerPackage: flow.unitsPerPackage,  // ✅ ADICIONADO
  unitWeight: flow.packageWeight,
  // ... outros campos ...
};
```

### 3. **Payload de salvamento completo**
```typescript
// Adicionado em handleSaveProductOffer()
const offerPayload: Omit<Offer, 'id'> = {
  // ... outros campos ...
  unitsInPackaging,
  unitsPerPackage: offerData.unitsPerPackage || 0,  // ✅ ADICIONADO
  unitWeight,
  // ... outros campos ...
};
```

## 📋 Significado dos Campos

Para esclarecimento, aqui está o que cada campo representa:

1. **"Quantas Cx ou fardos vc irá enviar"** = `unitsInPackaging`
   - Quantas embalagens (caixas/fardos) o fornecedor vai enviar
   - Ex: 5 caixas

2. **"Total Un na Emb."** = `unitsPerPackage`  
   - Quantas unidades têm DENTRO de cada embalagem
   - Ex: 12 unidades por caixa

3. **"Peso (Kg)"** = `unitWeight`
   - Peso de cada embalagem individual
   - Ex: 2.5 Kg por caixa

4. **"Preço Total da Emb."** = `totalPackagingPrice`
   - Preço de cada embalagem individual
   - Ex: R$ 15,00 por caixa

## 🧮 Exemplo Prático

Se um fornecedor preenche:
- **5** caixas (unitsInPackaging)
- **12** unidades por caixa (unitsPerPackage)  
- **2.5** Kg por caixa (unitWeight)
- **R$ 15,00** por caixa (totalPackagingPrice)

O sistema calcula:
- **Total de unidades**: 5 × 12 = 60 unidades
- **Peso total**: 5 × 2.5 = 12.5 Kg
- **Valor total**: 5 × R$ 15,00 = R$ 75,00
- **Preço por unidade**: R$ 15,00 ÷ 12 = R$ 1,25

## ✅ Status

- ✅ Problema identificado e corrigido
- ✅ Campo agora recebe valores digitados
- ✅ Valores são salvos corretamente no banco
- ✅ Build passando sem erros
- ✅ Integração com fluxo guiado funcionando

---

**Data da correção**: $(date)  
**Arquivos modificados**: `src/app/(portal)/portal/[supplierId]/cotar/[quotationId]/page.tsx`