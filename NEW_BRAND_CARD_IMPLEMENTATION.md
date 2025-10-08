# 🏷️ Card de Nova Marca - Substituindo o Modal

## ✅ Implementação Concluída

O modal "Propor Nova Marca" foi substituído por um card intercalável que aparece diretamente na área de ofertas, seguindo a mesma lógica de cards intercaláveis já estabelecida no sistema.

## 🔄 Mudança Implementada

### **ANTES (Modal Popup):**
```
Clique "Propor Nova Marca" → Modal sobrepõe a tela → Preencher → Enviar → Modal fecha
```

### **DEPOIS (Card Intercalável):**
```
Clique "Propor Nova Marca" → Card aparece na área de ofertas → Preencher → Enviar → Card fecha
```

## 🎨 Características Visuais do Card

### **Design Único com Tema Laranja/Âmbar:**
```tsx
<div className="p-4 border rounded-md bg-gradient-to-r from-orange-50/30 to-amber-50/30 dark:from-orange-950/20 dark:to-amber-950/20 border-orange-200 dark:border-orange-800 shadow-sm space-y-4">
```

### **Cabeçalho Distintivo:**
- 🏷️ **Título**: "Propor Nova Marca" (cor laranja)
- 📝 **Descrição**: "Envie uma proposta de nova marca para '[Produto]'. Será enviada ao comprador para aprovação."
- ✕ **Botão Fechar**: Cancela e volta ao card tradicional

### **Campos Idênticos ao Modal:**
1. **Nome da Marca** * - Input texto (Ex: Marca Nova)
2. **Total Un na Emb** * - Input numérico (Ex: 12)
3. **× Separador visual** - Símbolo multiplicação
4. **Peso (Kg)** * - Input com formatação inteligente (Ex: 2,500)
5. **Preço Total da Emb. (R$)** * - Input monetário formatado (R$ 15,50)
6. **Imagem da Marca (Opcional)** - Upload de arquivo com estilo customizado

## 🔧 Implementação Técnica

### **Estado de Controle:**
```typescript
const [newBrandCardActive, setNewBrandCardActive] = useState<Record<string, boolean>>({});
```

### **Funções de Controle:**
```typescript
// Mostrar card de nova marca
const showNewBrandCard = (productId: string) => {
  setNewBrandCardActive(prev => ({ ...prev, [productId]: true }));
  closeNewBrandModal(); // Garantir que modal não fica aberto
};

// Cancelar e fechar card
const cancelNewBrandCard = (productId: string) => {
  setNewBrandCardActive(prev => ({ ...prev, [productId]: false }));
};
```

### **Modificação da Função de Abertura:**
```typescript
const openNewBrandModal = (productId: string, productName: string, productUnit: UnitOfMeasure) => {
  // Usar card ao invés de modal
  showNewBrandCard(productId);
  
  // Manter dados do modal para compatibilidade
  setNewBrandModal({
    isOpen: false, // ← Modal fechado, usando card
    productId,
    productName, 
    productUnit
  });
  // ... resto da lógica mantida
};
```

## 🎯 Lógica de Intercalação

### **Verificação de Renderização:**
```typescript
{/* Verificar se há card de nova marca ativo para este produto */}
{newBrandCardActive[product.id] && (
  renderNewBrandCard(
    product.id,
    product,
    newBrandForm,
    handleNewBrandFormChange,
    submitNewBrandRequest,
    cancelNewBrandCard,
    isSubmittingNewBrand,
    // ... funções de formatação
  )
)}
```

### **Prioridade de Cards:**
1. **Fluxo Guiado** (se ativo) - Card verde do vendedor
2. **Nova Marca** (se ativo) - Card laranja de proposta  
3. **Ofertas Tradicionais** - Cards brancos padrão

## 🎨 Formatações Aplicadas

### **Formatação Monetária:**
```typescript
// Input de preço com formatação automática
value={newBrandForm.totalPackagingPrice > 0 ? formatCurrencyInput(newBrandForm.totalPackagingPrice * 100) : ''}
onChange={(e) => {
  const centavos = parseCurrencyInput(e.target.value);
  const decimalValue = centavos / 100;
  handleNewBrandFormChange('totalPackagingPrice', decimalValue);
}}
```

### **Formatação de Peso:**
```typescript
// Input de peso com formatação inteligente para Kg/L
value={
  product.unit === 'Kilograma(s)' || product.unit === 'Litro(s)'
    ? (newBrandForm.unitWeight > 0 ? formatWeightInputForKg(newBrandForm.unitWeight * 1000) : '')
    : (newBrandForm.unitWeight || '')
}
```

### **Upload de Arquivo Estilizado:**
```typescript
<Input
  type="file"
  accept="image/*"
  className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"
/>
```

## 🔄 Fluxo de Funcionamento

### **1. Ativação do Card:**
```
Usuário clica "Propor Nova Marca" 
→ openNewBrandModal() chamada
→ showNewBrandCard() ativada
→ Card laranja aparece na área de ofertas
```

### **2. Preenchimento:**
```
Usuário preenche campos obrigatórios:
✅ Nome da Marca
✅ Total Un na Emb  
✅ Peso (formatado automaticamente)
✅ Preço (formatação monetária)
📎 Imagem (opcional)
```

### **3. Validação e Envio:**
```
Botão "Enviar Proposta" habilitado quando:
- brandName.trim() não vazio
- unitsInPackaging > 0  
- totalPackagingPrice > 0

submitNewBrandRequest() → Firestore → Toast de sucesso → Card fecha
```

## 📊 Comparação: Modal vs Card

| Aspecto | Modal (Antes) | Card (Depois) |
|---------|---------------|---------------|
| **Posicionamento** | Sobrepõe toda a tela | Integrado na área de ofertas |
| **Contexto** | Perde contexto do produto | Mantém contexto visual |
| **Navegação** | Bloqueia navegação | Permite scroll e navegação |
| **Responsividade** | Tamanho fixo | Adapta-se ao container |
| **Consistência** | Interface diferente | Consistente com outros cards |
| **UX** | Interruptiva | Fluida e natural |

## 🎨 Estilos e Cores

### **Paleta de Cores (Laranja/Âmbar):**
- **Fundo**: `from-orange-50/30 to-amber-50/30`
- **Borda**: `border-orange-200`
- **Título**: `text-orange-700 dark:text-orange-300`
- **Botão Principal**: `bg-orange-600 hover:bg-orange-700`
- **Upload**: `file:bg-orange-50 file:text-orange-700`

### **Inputs Grandes e Acessíveis:**
```typescript
className="text-base h-12"  // Inputs maiores que o padrão
```

## 🔧 Compatibilidade e Fallback

### **Modal Mantido para Compatibilidade:**
- Modal ainda existe no código (comentado/oculto)
- Pode ser reativado facilmente se necessário
- Dados compartilhados entre modal e card

### **Funcionalidades Preservadas:**
- ✅ **Validação** idêntica ao modal
- ✅ **Upload de imagem** mantido
- ✅ **Formatação** de campos preservada
- ✅ **Narração de voz** funcional
- ✅ **Toast notifications** inalteradas
- ✅ **Envio para Firestore** idêntico

## ✨ Benefícios da Mudança

1. **Integração Visual**: Card se integra naturalmente com outras ofertas
2. **Contexto Preservado**: Usuário não perde de vista o produto
3. **Fluxo Contínuo**: Não interrompe a navegação
4. **Consistência**: Segue padrão dos outros cards intercaláveis
5. **Responsividade**: Adapta-se melhor a diferentes telas
6. **UX Melhorada**: Experiência mais fluida e natural

## 🎯 Exemplo de Uso

### **Cenário Típico:**
```
1. Fornecedor vê produto "Açém" 
2. Clica "Propor Nova Marca"
3. 🏷️ Card laranja aparece na área de ofertas
4. Preenche: "Friboi Premium", 12 unidades, 2,500 Kg, R$ 18,50
5. Adiciona imagem da marca (opcional)
6. Clica "Enviar Proposta" 
7. ✅ Toast: "Solicitação Enviada!"
8. Card fecha, volta para ofertas normais
```

---

**Status**: ✅ Implementado e funcionando  
**Build**: ✅ Passando sem erros  
**Compatibilidade**: Modal preservado como fallback  
**Integração**: Perfeita com sistema de cards intercaláveis existente  
**UX**: Significativamente melhorada