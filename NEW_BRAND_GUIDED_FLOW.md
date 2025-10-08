# 🏷️ Fluxo Guiado de Nova Marca - Implementação Completa

## ✅ Implementação Concluída

O sistema de "Propor Nova Marca" agora utiliza um **fluxo guiado passo a passo** (6 etapas) idêntico ao das ofertas, mas com formatação visual e contexto específicos para nova marca (cores laranja/âmbar).

## 🎯 Conceito Implementado

### **ANTES (Modal Disruptivo):**
```
Clique → 🔲 Modal com todos os campos → Preencher tudo → Enviar
```

### **DEPOIS (Fluxo Guiado 6 Etapas):**
```
Clique → 🏷️ Etapa 1 → Etapa 2 → ... → Etapa 6 → Confirmar → Enviar
```

## 🎨 Características Visuais

### **Tema Laranja/Âmbar Distintivo:**
- 🧡 **Gradiente**: `from-orange-50/30 to-amber-50/30`
- 🏷️ **Título**: "Nova Marca" (cor laranja)
- 📊 **Barra de progresso**: Laranja (`bg-orange-600`)
- 🔘 **Botões**: `bg-orange-600 hover:bg-orange-700`
- 📋 **Resumo final**: Fundo laranja com bordas temáticas

### **Estrutura do Card:**
```tsx
<div className="p-4 border rounded-md bg-gradient-to-r from-orange-50/30 to-amber-50/30 dark:from-orange-950/20 dark:to-amber-950/20 border-orange-200 dark:border-orange-800 shadow-sm space-y-4">
  {/* Cabeçalho com título e progresso */}
  {/* Barra de progresso laranja */}
  {/* Etapa atual renderizada */}
</div>
```

## 📋 Fluxo das 6 Etapas

### **Etapa 1: Nome da Marca**
```
❓ "Qual é o nome da nova marca que você quer propor?"
📝 Input: "Ex: Marca Premium"
✅ Botão: "Próximo" (desabilitado se vazio)
```

### **Etapa 2: Unidades por Embalagem** 
```
❓ "Quantas unidades vêm na embalagem desta marca?"
🔢 Input: Numérico "Ex: 12"
✅ Botão: "Próximo" (desabilitado se <= 0)
```

### **Etapa 3: Peso/Volume da Embalagem**
```
❓ "Qual é o peso (Kg) / volume (Litros) da embalagem desta marca?"
⚖️ Input: Com formatação inteligente "Ex: 2,500"
📏 Sufixo: "Kg" ou "L" automático
✅ Botão: "Próximo" (desabilitado se <= 0)
```

### **Etapa 4: Preço da Embalagem**
```
❓ "Qual o preço da embalagem desta marca?"
💰 Input: Formatação monetária "R$ 0,00"
✅ Botão: "Próximo" (desabilitado se <= 0)
```

### **Etapa 5: Imagem da Marca (Opcional)**
```
❓ "Envie uma imagem da marca/produto (opcional):"
📷 Input: Upload de arquivo estilizado
📝 Descrição: "Envie uma imagem da marca/produto para ajudar na aprovação"
🔘 Botões: "Pular" | "Próximo"
```

### **Etapa 6: Confirmação Final**
```
❓ "Confirme os dados da nova marca:"
📊 Resumo completo com formatação laranja
💡 Aviso: "Solicitação será enviada para aprovação"
🔘 Botões: "Cancelar" | "✅ Enviar Proposta"
```

## 🔧 Implementação Técnica

### **Estado do Fluxo:**
```typescript
const [newBrandFlow, setNewBrandFlow] = useState<Record<string, {
  isActive: boolean;
  currentStep: number;
  brandName: string;
  unitsPerPackage: number;
  packageWeight: number;
  packagePrice: number;
  imageFile: File | null;
  showGuidedFlow: boolean;
}>>({});
```

### **Funções de Controle:**
```typescript
// Iniciar fluxo guiado
const startNewBrandFlow = (productId: string) => {
  const flowKey = `${productId}_brand_flow`;
  setNewBrandFlow(prev => ({
    ...prev,
    [flowKey]: {
      isActive: true,
      currentStep: 1,
      brandName: '',
      unitsPerPackage: 0,
      packageWeight: 0,
      packagePrice: 0,
      imageFile: null,
      showGuidedFlow: true
    }
  }));
};

// Atualizar etapa
const updateNewBrandFlowStep = (productId: string, field: string, value: any, nextStep?: number) => {
  const flowKey = `${productId}_brand_flow`;
  setNewBrandFlow(prev => ({
    ...prev,
    [flowKey]: {
      ...prev[flowKey],
      [field]: value,
      ...(nextStep && { currentStep: nextStep })
    }
  }));
};

// Completar e enviar
const completeNewBrandFlow = async (productId: string) => {
  // Validação → Upload de imagem → Envio para Firestore → Toast → Cleanup
};
```

## 🎯 Formatações Aplicadas

### **Formatação Monetária (Etapa 4):**
```typescript
// Input com formatação automática
value={packagePrice > 0 ? formatCurrencyInput(packagePrice * 100) : ''}
onChange={(e) => {
  const centavos = parseCurrencyInput(e.target.value);
  const decimalValue = centavos / 100;
  updateNewBrandFlowStep(productId, 'packagePrice', decimalValue);
}}
```

### **Formatação de Peso (Etapa 3):**
```typescript
// Formatação inteligente por tipo de produto
value={(() => {
  if (product.unit === 'Kilograma(s)' || product.unit === 'Litro(s)') {
    if (packageWeight > 0) {
      const gramas = Math.round(packageWeight * 1000);
      return formatWeightInputForKg(gramas); // Ex: "2,500"
    }
    return '';
  } else {
    return packageWeight > 0 ? packageWeight.toString().replace('.', ',') : '';
  }
})()}
```

### **Upload de Arquivo Estilizado (Etapa 5):**
```typescript
<Input
  type="file"
  accept="image/*"
  className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"
/>
```

## 📊 Resumo Final (Etapa 6)

### **Layout Laranja Temático:**
```tsx
<div className="bg-orange-50/50 dark:bg-orange-950/20 p-4 rounded-lg space-y-3 border border-orange-200 dark:border-orange-800">
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
    <div><strong>Nova Marca:</strong> {brandName}</div>
    <div><strong>Para Produto:</strong> {product.name}</div>
    <div><strong>Unidades por embalagem:</strong> {unitsPerPackage}</div>
    <div><strong>Peso/Volume por embalagem:</strong> {formatação inteligente}</div>
    <div><strong>Preço por embalagem:</strong> {formatCurrency(packagePrice)}</div>
    <div><strong>Imagem:</strong> {imageFile ? imageFile.name : 'Nenhuma'}</div>
  </div>
  <div className="border-t border-orange-200 pt-3">
    <div className="text-lg font-bold">Preço por unidade: {formatCurrency(pricePerUnit)}</div>
    <div className="text-lg font-bold text-orange-600 mt-2">Solicitação será enviada para aprovação</div>
  </div>
</div>
```

## 🔄 Integração com Sistema Existente

### **Substituição da Abertura do Modal:**
```typescript
// ANTES: Abria modal popup
const openNewBrandModal = (productId: string, productName: string, productUnit: UnitOfMeasure) => {
  setNewBrandModal({ isOpen: true, ... });
};

// DEPOIS: Inicia fluxo guiado
const openNewBrandModal = (productId: string, productName: string, productUnit: UnitOfMeasure) => {
  startNewBrandFlow(productId); // ← Fluxo guiado em 6 etapas
  setNewBrandModal({ isOpen: false, ... }); // Modal fechado
};
```

### **Renderização Intercalável:**
```typescript
// Verificar se há fluxo guiado de nova marca ativo para este produto
{(() => {
  const flowKey = `${product.id}_brand_flow`;
  const activeBrandFlow = newBrandFlow[flowKey];
  
  if (activeBrandFlow && activeBrandFlow.showGuidedFlow) {
    return renderNewBrandFlowCard(/* parâmetros */);
  }
  return null;
})()}
```

### **Prioridade de Cards:**
1. **Fluxo Guiado de Ofertas** (verde) - se ativo
2. **Fluxo Guiado de Nova Marca** (laranja) - se ativo
3. **Ofertas Tradicionais** (branco) - padrão

## 🚀 Fluxo de Funcionamento

### **1. Ativação:**
```
Usuário clica "Propor Nova Marca" 
→ openNewBrandModal() chamada
→ startNewBrandFlow() ativada
→ Card laranja aparece (Etapa 1/6)
→ Narração: "Vou te guiar passo a passo..."
```

### **2. Navegação Passo a Passo:**
```
Etapa 1 → Digite nome → "Próximo" → Etapa 2
Etapa 2 → Digite unidades → "Próximo" → Etapa 3  
Etapa 3 → Digite peso → "Próximo" → Etapa 4
Etapa 4 → Digite preço → "Próximo" → Etapa 5
Etapa 5 → Upload opcional → "Próximo"/"Pular" → Etapa 6
Etapa 6 → Revisar → "✅ Enviar Proposta"
```

### **3. Finalização Automática:**
```
completeNewBrandFlow():
1. Validação de dados obrigatórios
2. Upload de imagem (se fornecida) 
3. Criação do payload no Firestore
4. Toast: "Solicitação Enviada!"
5. Narração de sucesso
6. Limpeza do fluxo (card desaparece)
```

## 📈 Benefícios da Implementação

### **UX Drasticamente Melhorada:**
- 🎯 **Foco**: Uma pergunta por vez
- 🧠 **Carga cognitiva reduzida**: Não precisa pensar em todos os campos
- 📱 **Mobile-friendly**: Navegação fácil em telas pequenas
- 🔄 **Consistência**: Mesmo padrão das ofertas

### **Validação Inteligente:**
- ✅ **Progressiva**: Valida campo por campo
- 🚫 **Prevenção**: Não avança sem dados válidos
- 💡 **Feedback imediato**: Botões desabilitados mostram o que falta

### **Formatação Profissional:**
- 💰 **Monetária**: R$ 15,50 automático
- ⚖️ **Peso**: 2,500 Kg formatação brasileira
- 📷 **Upload**: Estilo customizado laranja

## 🎮 Exemplo de Uso Completo

### **Cenário: Fornecedor quer propor "Friboi Premium"**
```
1. Clica "Propor Nova Marca" no produto "Açém"
2. 🏷️ Card laranja aparece (1/6)
3. Digite: "Friboi Premium" → Próximo (2/6)  
4. Digite: "12" unidades → Próximo (3/6)
5. Digite: "2500" → Mostra "2,500" → Próximo (4/6)
6. Digite: "1850" → Mostra "R$ 18,50" → Próximo (5/6)
7. Upload imagem da marca → Próximo (6/6)
8. Revisa resumo laranja → "✅ Enviar Proposta"
9. ✅ Toast: "Solicitação Enviada!"
10. Card desaparece, volta para ofertas normais
```

---

**Status**: ✅ Implementado e funcionando  
**Build**: ✅ Passando sem erros  
**Etapas**: 6 etapas guiadas com formatações profissionais  
**Tema**: Laranja/âmbar distintivo e consistente  
**UX**: Experiência idêntica ao fluxo de ofertas, mas contextualizada para nova marca