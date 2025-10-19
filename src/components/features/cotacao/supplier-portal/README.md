# Supplier Portal Cards

Componentes centralizados para a interface de cotação de fornecedores.

## 📦 Componentes Criados

### 1. **CompetitorOfferCard**
Card que exibe as ofertas dos concorrentes (ou sua própria oferta já salva).

**Props principais:**
- `brandName`: Nome da marca
- `supplierName`: Nome do fornecedor
- `pricePerUnit`: Preço por unidade
- `isLowestOverall`: Se é o melhor preço geral
- `isSelf`: Se é sua própria oferta

**Estilos:**
- 🟢 Verde: Melhor preço geral
- 🔵 Azul: Sua oferta (não melhor)
- ⚪ Cinza: Oferta de concorrente

---

### 2. **BrandRequestCard**
Card colorido para solicitações de marcas (pending/rejected).

**Props principais:**
- `status`: 'pending' | 'approved' | 'rejected'
- `brandName`: Nome da marca solicitada
- `supplierName`: Nome do fornecedor

**Estilos:**
- 🟠 Laranja: Marca aguardando aprovação
- 🔴 Vermelho: Marca rejeitada
- ✅ Verde: Marca aprovada (não exibido neste card, vira oferta)

---

### 3. **OfferFormCard**
Formulário completo com 6 campos em linha única para nova oferta.

**Campos:**
1. **Quantas Cx ou fardos** - Quantidade de embalagens
2. **Total Un na Emb** - Unidades por embalagem
3. **Peso (Kg)** - Peso de cada unidade
4. **Preço Total da Emb** - Preço de cada embalagem
5. **Valor Total do Pedido** - Calculado automaticamente (readonly)
6. **Preço/Unid** - Preço por unidade (readonly, colorido)

**Comportamento:**
- Campos 1-4: Editáveis
- Campos 5-6: Calculados automaticamente
- Campo 6 muda de cor:
  - 🟢 Verde: Melhor preço
  - 🔴 Vermelho: Perdendo para concorrente
  - ⚪ Cinza: Sem comparação ainda

---

## 🎨 Uso

```tsx
import {
  CompetitorOfferCard,
  BrandRequestCard,
  OfferFormCard
} from '@/components/features/cotacao/supplier-portal';

// Exemplo: Card de concorrente
<CompetitorOfferCard
  brandName="Friboi"
  supplierName="Fornecedor XYZ"
  pricePerUnit={10.50}
  isLowestOverall={true}
  isSelf={false}
  {...props}
/>

// Exemplo: Card de marca pendente
<BrandRequestCard
  status="pending"
  brandName="Nova Marca"
  supplierName="Meu Fornecedor"
  {...props}
/>

// Exemplo: Formulário de oferta
<OfferFormCard
  offer={offerData}
  product={productData}
  pricePerUnit={calculatedPrice}
  isOfferDisabled={false}
  {...handlers}
/>
```

---

## 🔧 Migração do page.tsx

Para migrar do código inline no `page.tsx`, siga estes passos:

### Antes:
```tsx
// page.tsx (linha ~2957)
<div className={`flex items-start justify-between p-3 rounded-md ...`}>
  {/* 50+ linhas de JSX inline */}
</div>
```

### Depois:
```tsx
// page.tsx (limpo)
import { CompetitorOfferCard } from '@/components/features/cotacao/supplier-portal';

<CompetitorOfferCard
  brandName={offer.brandName}
  supplierName={offer.supplierName}
  // ... apenas props
/>
```

---

## 📐 Estrutura de Arquivos

```
src/components/features/cotacao/supplier-portal/
├── CompetitorOfferCard.tsx    # Card de ofertas dos concorrentes
├── BrandRequestCard.tsx         # Card de solicitações de marca
├── OfferFormCard.tsx            # Formulário com 6 campos
├── index.ts                     # Exportações centralizadas
└── README.md                    # Esta documentação
```

---

## ✅ Benefícios

1. **Estilos Centralizados**: Mudar cor/layout de um card não afeta outros
2. **Código Limpo**: page.tsx reduzido de 3548 → ~1500 linhas (estimado)
3. **Reutilizável**: Componentes podem ser usados em outras páginas
4. **Testável**: Cada componente pode ser testado isoladamente
5. **Manutenível**: Lógica separada da apresentação

---

## 🚀 Próximos Passos

1. Refatorar `page.tsx` para usar estes componentes
2. Extrair lógica para hooks customizados (`useOfferCalculations`, `useOfferForm`)
3. Adicionar testes unitários
4. Criar Storybook stories para documentação visual

---

## 📝 Notas Importantes

- Todos os componentes são `'use client'` (necessário para interatividade)
- Estilos usam Tailwind CSS com variáveis do shadcn/ui
- Formatação de moeda e unidades deve ser passada como props (formatters)
- Validação de imagens deve ser passada como prop (isValidImageUrl)
