# Fluxo Guiado de Nova Marca - 8 Etapas Implementado

## Resumo das Alterações

Foi implementado um fluxo guiado completo de 8 etapas para propostas de novas marcas, seguindo o mesmo padrão do fluxo de marcas fixas, com validação de quantidade e formatação consistente.

## Etapas do Fluxo de Nova Marca

### Etapa 1: Nome da Marca
- Campo de texto para inserir o nome da nova marca
- Validação obrigatória antes de prosseguir

### Etapa 2: Tipo de Embalagem
- Opções em botões horizontais: Caixa, Fardo, A Granel
- Mesma formatação visual das marcas fixas (`grid-cols-3`)
- Para "A Granel" pula a etapa 3 (unidades por embalagem)

### Etapa 3: Unidades por Embalagem
- Campo numérico para informar quantas unidades vêm na embalagem
- Pulada automaticamente se escolheu "A Granel"

### Etapa 4: Peso/Volume da Embalagem
- Campo com formatação inteligente (Kg/L/g/ml)
- Sufixo dinâmico baseado no tipo de produto
- Formatação monetária aplicada

### Etapa 5: Preço da Embalagem
- Campo com formatação monetária em tempo real
- Conversão automática para centavos

### Etapa 6: Quantidade de Embalagens
- Campo para informar quantas embalagens serão enviadas
- Usado para calcular se atende o pedido do comprador

### Etapa 7: Upload de Imagem (Opcional)
- Opção de enviar imagem da marca/produto
- Botões "Pular" e "Próximo"

### Etapa 8: Confirmação Final
- Resumo completo dos dados inseridos
- Formatação idêntica às marcas fixas
- Validação de quantidade com alertas visuais
- Cálculos automáticos de valores totais

## Funcionalidades Implementadas

### ✅ Validação de Quantidade
- Cálculo automático da quantidade total oferecida
- Comparação com o pedido do comprador
- Alertas visuais para variações acima/abaixo do solicitado
- Margem de tolerância de 10% configurável

### ✅ Formatação Monetária
- Conversão automática para centavos
- Formatação em tempo real durante digitação
- Exibição final em formato brasileiro (R$)

### ✅ Formatação de Peso/Volume
- Formatação inteligente para Kg/L
- Conversão automática g ↔ Kg e ml ↔ L
- Sufixos dinâmicos baseados no tipo de produto

### ✅ Interface Consistente
- Mesma formatação visual das marcas fixas
- Botões de embalagem em grid horizontal
- Barra de progresso de 8 etapas
- Cores diferenciadas (laranja) para nova marca

### ✅ Resumo Padronizado
- **Marca:** Nome da marca
- **Embalagem:** Tipo (caixa/fardo/granel)
- **Unidades por embalagem:** Quantidade
- **Peso/Volume por embalagem:** Com formatação inteligente
- **Preço por embalagem:** Valor formatado
- **Quantidade a enviar:** Número de embalagens
- **Imagem:** Nome do arquivo ou "Nenhuma"
- **Preço por unidade:** Calculado automaticamente
- **Total oferecido:** Quantidade total em unidades do produto
- **Valor Total do Pedido:** Preço total da proposta

### ✅ Persistência dos Dados
- Estado mantido durante navegação entre etapas
- Dados salvos no Firestore com quantidade correta
- Integração com sistema de notificações

## Modificações no Código

### Estado Atualizado
```typescript
const [newBrandFlow, setNewBrandFlow] = useState<Record<string, {
  isActive: boolean;
  currentStep: number;
  brandName: string;
  packagingType: 'caixa' | 'fardo' | 'granel' | '';
  unitsPerPackage: number;
  packageWeight: number;
  packagePrice: number;
  requiredPackages: number; // ← NOVO CAMPO
  imageFile: File | null;
  showGuidedFlow: boolean;
}>>({});
```

### Função de Validação
- `validateQuantityVariation()`: Verifica se a quantidade oferecida atende o pedido
- `calculateTotalOfferedQuantity()`: Calcula quantidade total baseada nas embalagens
- Alertas visuais para variações significativas

### Persistência Corrigida
```typescript
const brandRequest = {
  // ... outros campos
  unitsInPackaging: flow.requiredPackages || 1, // ← CORRIGIDO
  // ... resto dos dados
};
```

## Resultado Final

O fluxo de nova marca agora:
1. ✅ Segue o mesmo padrão visual das marcas fixas
2. ✅ Inclui validação de quantidade adequada
3. ✅ Aplica formatação monetária e de peso consistente
4. ✅ Salva automaticamente ao confirmar (economia de uma etapa)
5. ✅ Mostra resumo padronizado na última etapa
6. ✅ Integra com sistema de notificação de variação de quantidade

## Próximos Passos

O sistema está completo e pronto para uso. As principais funcionalidades implementadas garantem:
- Experiência de usuário consistente entre fluxos
- Validação adequada de dados
- Integração completa com o sistema existente
- Interface intuitiva e responsiva