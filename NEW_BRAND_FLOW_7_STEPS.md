# 🏷️ Fluxo Guiado de Nova Marca - 7 Etapas Completas

## ✅ Implementação Final Concluída

O sistema de "Propor Nova Marca" agora utiliza um **fluxo guiado completo de 7 etapas**, incluindo a seleção do tipo de embalagem (caixa, fardo ou a granel), seguindo exatamente o mesmo padrão do fluxo de ofertas.

## 📋 Fluxo Completo das 7 Etapas

### **Etapa 1: Nome da Marca**
```
❓ "Qual é o nome da nova marca que você quer propor?"
📝 Input: "Ex: Marca Premium"
✅ Botão: "Próximo" (desabilitado se vazio)
```

### **Etapa 2: Tipo de Embalagem** ⭐ **NOVA ETAPA**
```
❓ "Seu item virá em:"
🔘 Botões em linha (paralelos):
   [📦 Caixa] [📄 Fardo] [🌾 A Granel]
⚡ Auto-avança: Clique → seleção → próxima etapa
🎯 Lógica: Se "A Granel" → pula etapa 3 (unidades)
📱 Responsivo: `grid-cols-1 sm:grid-cols-3` (empilha em mobile)
```

### **Etapa 3: Unidades por Embalagem** *(Pulada se A Granel)*
```
❓ "Quantas unidades vêm na [caixa/fardo]?"
🔢 Input: Numérico "Ex: 12"
✅ Botão: "Próximo" (desabilitado se <= 0)
📝 Nota: Texto dinâmico baseado na seleção da etapa 2
```

### **Etapa 4: Peso/Volume da Embalagem**
```
❓ "Qual é o peso (Kg) / volume (Litros) da [caixa/fardo/unidade a granel]?"
⚖️ Input: Com formatação inteligente "Ex: 2,500"
📏 Sufixo: "Kg" ou "L" automático
✅ Botão: "Próximo" (desabilitado se <= 0)
📝 Nota: Texto adaptado ao tipo de embalagem selecionado
```

### **Etapa 5: Preço da Embalagem**
```
❓ "Qual o preço da [caixa/fardo/unidade a granel]?"
💰 Input: Formatação monetária "R$ 0,00"
✅ Botão: "Próximo" (desabilitado se <= 0)
📝 Nota: Pergunta adaptada ao tipo de embalagem
```

### **Etapa 6: Imagem da Marca (Opcional)**
```
❓ "Envie uma imagem da marca/produto (opcional):"
📷 Input: Upload de arquivo estilizado
📝 Descrição: "Envie uma imagem da marca/produto para ajudar na aprovação"
🔘 Botões: "Pular" | "Próximo"
```

### **Etapa 7: Confirmação Final**
```
❓ "Confirme os dados da nova marca:"
📊 Resumo completo com formatação laranja:
   - Nova Marca: [Nome]
   - Para Produto: [Produto]
   - Tipo de Embalagem: [Caixa/Fardo/A Granel]
   - Unidades por [tipo]: [Quantidade] (se não for granel)
   - Peso/Volume por [tipo]: [Peso formatado]
   - Preço por [tipo]: [Preço formatado]
   - Imagem: [Nome do arquivo ou "Nenhuma"]
💡 Aviso: "Solicitação será enviada para aprovação"
🔘 Botões: "Cancelar" | "✅ Enviar Proposta"
```

## 🎯 Lógica Inteligente da Etapa 2

### **Seleção com Auto-Navegação:**
```typescript
onClick={() => {
  updateNewBrandFlowStep(productId, 'packagingType', type);
  // Se escolher 'granel', pular a etapa de unidades por embalagem
  const nextStep = type === 'granel' ? 4 : 3;
  setTimeout(() => updateNewBrandFlowStep(productId, 'currentStep', '', nextStep), 300);
}}
```

### **Adaptação de Texto Dinâmico:**

#### **Etapa 3 (Unidades):**
```
packagingType === 'caixa' → "Quantas unidades vêm na caixa?"
packagingType === 'fardo' → "Quantas unidades vêm no fardo?"
packagingType === 'granel' → ETAPA PULADA
```

#### **Etapa 4 (Peso):**
```
packagingType === 'caixa' → "Qual é o peso (Kg) da caixa?"
packagingType === 'fardo' → "Qual é o peso (Kg) do fardo?"
packagingType === 'granel' → "Qual é o peso (Kg) da unidade a granel?"
```

#### **Etapa 5 (Preço):**
```
packagingType === 'caixa' → "Qual o preço da caixa?"
packagingType === 'fardo' → "Qual o preço do fardo?"
packagingType === 'granel' → "Qual o preço da unidade a granel?"
```

## 🔧 Validação Inteligente

### **Validação Condicional:**
```typescript
// Verificar dados básicos
if (!flow.brandName.trim() || !flow.packagingType || flow.packageWeight <= 0 || flow.packagePrice <= 0) {
  toast({ title: "Dados Inválidos", variant: "destructive" });
  return;
}

// Verificar unidades por embalagem apenas se não for a granel
if (flow.packagingType !== 'granel' && flow.unitsPerPackage <= 0) {
  toast({ title: "Quantidade de unidades por embalagem é obrigatória", variant: "destructive" });
  return;
}
```

## 📊 Resumo Final Adaptado (Etapa 7)

### **Layout Dinâmico por Tipo:**

#### **Para Caixa/Fardo:**
```
✅ Nova Marca: Friboi Premium
✅ Para Produto: Açém  
✅ Tipo de Embalagem: Caixa
✅ Unidades por caixa: 12
✅ Peso/Volume por caixa: 2,500 Kg
✅ Preço por caixa: R$ 30,00
✅ Imagem: friboi-logo.jpg
──────────────────────────────
💰 Preço por unidade: R$ 2,50
🏷️ Solicitação será enviada para aprovação
```

#### **Para A Granel:**
```
✅ Nova Marca: Friboi Premium
✅ Para Produto: Açém
✅ Tipo de Embalagem: A Granel
✅ Peso/Volume por unidade: 1,000 Kg
✅ Preço por unidade: R$ 15,00
✅ Imagem: Nenhuma
──────────────────────────────
💰 Preço por unidade: R$ 15,00
🏷️ Solicitação será enviada para aprovação
```

## 🎨 Características Visuais

### **Etapa 2 - Botões de Seleção em Linha:**
```typescript
<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
  <Button className="h-16 text-base">📦 Caixa</Button>
  <Button className="h-16 text-base">📄 Fardo</Button>
  <Button className="h-16 text-base">🌾 A Granel</Button>
</div>
```

### **Indicador de Progresso Atualizado:**
```
Etapa 1 de 7 → 14.3% (barra laranja)
Etapa 2 de 7 → 28.6% (barra laranja)
...
Etapa 7 de 7 → 100% (barra laranja completa)
```

## 📦 Payload Atualizado

### **Estrutura do Brand Request:**
```typescript
const brandRequest = {
  quotationId: quotationId,
  supplierId: currentSupplierDetails.id,
  supplierName: currentSupplierDetails.empresa,
  productId: productId,
  productName: product.name,
  brandName: flow.brandName,
  packagingType: flow.packagingType,                    // ← NOVO CAMPO
  packagingDescription: flow.packagingType === 'granel'  // ← LÓGICA CONDICIONAL
    ? 'A granel' 
    : `${flow.unitsPerPackage} unidades por ${flow.packagingType}`,
  unitsInPackaging: 1,
  unitsPerPackage: flow.packagingType === 'granel' ? 1 : flow.unitsPerPackage,
  unitWeight: flow.packageWeight,
  totalPackagingPrice: flow.packagePrice,
  imageUrl: imageUrl,
  status: 'pending',
  requestedAt: serverTimestamp(),
  requestedBy: sellerUser?.uid || '',
  sellerId: sellerUser?.uid || ''
};
```

## 🎮 Exemplo de Uso Completo

### **Cenário 1: Friboi Premium em Caixas**
```
1. 🏷️ "Friboi Premium" → Próximo (2/7)
2. 📦 Clica "Caixa" → Auto-avança (3/7)
3. 🔢 "12" unidades → Próximo (4/7)
4. ⚖️ "2500" → "2,500 Kg" → Próximo (5/7)
5. 💰 "3000" → "R$ 30,00" → Próximo (6/7)
6. 📷 Upload imagem → Próximo (7/7)
7. ✅ Confirma resumo → Enviado!
```

### **Cenário 2: Marca Artesanal A Granel**
```
1. 🏷️ "Artesanal Local" → Próximo (2/7)
2. 📦 Clica "A Granel" → Auto-pula para (4/7)
3. ⚖️ "1000" → "1,000 Kg" → Próximo (5/7)
4. 💰 "1500" → "R$ 15,00" → Próximo (6/7)
5. 📷 Pula imagem → Próximo (7/7)
6. ✅ Confirma resumo (sem unidades) → Enviado!
```

## 🚀 Benefícios da Etapa Adicional

### **UX Melhorada:**
1. **Clareza**: Definição explícita do tipo de embalagem
2. **Precisão**: Perguntas adaptadas ao contexto
3. **Eficiência**: Pula etapas desnecessárias (granel)
4. **Consistência**: Mesmo padrão das ofertas

### **Dados Mais Ricos:**
1. **Tipo de embalagem**: Informação crucial para aprovação
2. **Descrição automática**: Gerada conforme o tipo
3. **Validação inteligente**: Condicional por tipo
4. **Resumo adaptado**: Layout específico por contexto

### **Flexibilidade Total:**
- ✅ **Caixas**: Unidades + peso + preço
- ✅ **Fardos**: Unidades + peso + preço  
- ✅ **A Granel**: Peso + preço (sem unidades)

---

**Status**: ✅ Implementado e funcionando  
**Build**: ✅ Passando sem erros  
**Etapas**: 7 etapas completas com lógica inteligente  
**Tipos**: Caixa, Fardo, A Granel com adaptação automática  
**UX**: Experiência completa e contextual