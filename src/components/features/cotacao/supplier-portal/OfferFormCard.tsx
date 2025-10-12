'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface OfferFormCardProps {
  // Offer data (using any to accept OfferWithUI or similar types)
  offer: any;

  // Product data
  product: {
    id: string;
    unit: string;
  };

  // Calculated values
  pricePerUnit: number | null;
  pricePerUnitClasses: string;
  totalOrderValue: number;

  // State
  isOfferDisabled: boolean;

  // Handlers
  handleOfferChange: (productId: string, offerUiId: string, field: any, value: any) => void;
  handleWeightChange: (e: React.ChangeEvent<HTMLInputElement>, product: any, offer: any) => void;
  handlePriceChange: (productId: string, offerUiId: string, value: string) => void;
  handleSaveProductOffer: (productId: string, offerUiId: string) => Promise<boolean>;
  removeOfferField: (productId: string, offer: any) => void;
  onRequestStopQuoting?: (productId: string) => void;

  // Format functions
  formatCurrency: (value: number | null) => string;
  formatCurrencyInput: (cents: number) => string;
  abbreviateUnit: (unit: string) => string;
  getWeightDisplayValue: (product: any, offer: any) => string;
}

export function OfferFormCard({
  offer,
  product,
  pricePerUnit,
  pricePerUnitClasses,
  totalOrderValue,
  isOfferDisabled,
  handleOfferChange,
  handleWeightChange,
  handlePriceChange,
  handleSaveProductOffer,
  removeOfferField,
  onRequestStopQuoting,
  formatCurrency,
  formatCurrencyInput,
  abbreviateUnit,
  getWeightDisplayValue
}: OfferFormCardProps) {
  return (
    <div key={`${product.id}-${offer.uiId}`} className="p-3 border rounded-md bg-background shadow-sm space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        {/* Campo 1: Quantas Cx ou fardos */}
        <div className="space-y-1">
          <label
            htmlFor={`packages-${product.id}-${offer.uiId}`}
            className="block text-xs font-medium text-muted-foreground"
          >
            Quantas Cx ou fardos vc irá enviar *
          </label>
          <Input
            id={`packages-${product.id}-${offer.uiId}`}
            type="number"
            value={offer.unitsInPackaging > 0 ? offer.unitsInPackaging : ''}
            onChange={(e) => handleOfferChange(product.id, offer.uiId, 'unitsInPackaging', e.target.value)}
            placeholder="Ex: 5"
            disabled={isOfferDisabled}
          />
        </div>

        {/* Campo 2: Total Un na Emb */}
        <div className="space-y-1">
          <label
            htmlFor={`units-${product.id}-${offer.uiId}`}
            className="block text-xs font-medium text-muted-foreground"
          >
            Total Un na Emb. *
          </label>
          <Input
            id={`units-${product.id}-${offer.uiId}`}
            type="number"
            value={offer.unitsPerPackage || ''}
            onChange={(e) => handleOfferChange(product.id, offer.uiId, 'unitsPerPackage', parseInt(e.target.value) || 0)}
            placeholder="Ex: 12"
            disabled={isOfferDisabled}
          />
        </div>

        {/* Campo 3: Peso */}
        <div className="space-y-1">
          <label
            htmlFor={`weight-${product.id}-${offer.uiId}`}
            className="block text-xs font-medium text-muted-foreground"
          >
            Peso (Kg) *
          </label>
          <div className="relative">
            <Input
              id={`weight-${product.id}-${offer.uiId}`}
              type={product.unit === 'Kilograma(s)' || product.unit === 'Litro(s)' ? "text" : "number"}
              value={getWeightDisplayValue(product, offer)}
              onChange={(e) => handleWeightChange(e, product, offer)}
              placeholder="0,000"
              disabled={isOfferDisabled}
              className="pr-8"
            />
            <span className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-muted-foreground">
              Kg
            </span>
          </div>
        </div>

        {/* Campo 4: Preço Total da Emb */}
        <div className="space-y-1">
          <label
            htmlFor={`price-${product.id}-${offer.uiId}`}
            className="block text-xs font-medium text-muted-foreground"
          >
            Preço Total da Emb. (R$) *
          </label>
          <Input
            id={`price-${product.id}-${offer.uiId}`}
            type="text"
            value={offer.totalPackagingPrice > 0 ? formatCurrencyInput(offer.totalPackagingPrice * 100) : ''}
            onChange={(e) => handlePriceChange(product.id, offer.uiId, e.target.value)}
            placeholder="R$ 0,00"
            disabled={isOfferDisabled}
          />
        </div>

        {/* Campo 5: Valor Total do Pedido (calculado) */}
        <div className="space-y-1">
          <label className="block text-xs font-medium text-muted-foreground">
            Valor Total do Pedido (R$)
          </label>
          <Input
            type="text"
            value={totalOrderValue > 0 ? formatCurrencyInput(totalOrderValue * 100) : ''}
            readOnly
            className="bg-muted/50"
          />
        </div>

        {/* Campo 6: Preço/Unid. */}
        <div className="space-y-1">
          <label className="block text-xs font-medium text-muted-foreground">
            Preço/Unid.
          </label>
          <div className="h-10 flex items-center">
            <span className={`text-sm px-2 py-1 rounded border w-full text-center ${pricePerUnitClasses}`}>
              {formatCurrency(pricePerUnit)} / {abbreviateUnit(product.unit)}
            </span>
          </div>
        </div>
      </div>

      {/* Botões na linha de baixo */}
      <div className="flex justify-between gap-2 pt-2 border-t">
        {/* Botão para deixar de cotar (à esquerda) */}
        {onRequestStopQuoting && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onRequestStopQuoting(product.id)}
            disabled={isOfferDisabled}
            className="text-amber-600 hover:text-amber-700 border-amber-300 hover:border-amber-400"
          >
            Deixar de Cotar Este Item
          </Button>
        )}

        {/* Botões de ação (à direita) */}
        <div className="flex gap-2 ml-auto">
          {offer.id && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => removeOfferField(product.id, offer)}
              disabled={isOfferDisabled}
              className="text-destructive hover:text-destructive"
            >
              Remover Oferta
            </Button>
          )}
          <Button
            onClick={async () => {
              await handleSaveProductOffer(product.id, offer.uiId);
            }}
            disabled={isOfferDisabled}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {offer.id ? 'Editar Oferta' : 'Salvar Nova Oferta'}
          </Button>
        </div>
      </div>
    </div>
  );
}
