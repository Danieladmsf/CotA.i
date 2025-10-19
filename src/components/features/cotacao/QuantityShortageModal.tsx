'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { XCircle, CheckCircle, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { isGranelPackaging } from '@/lib/quotation/utils';

const getUnitAbbr = (unit: string): string => {
  switch (unit) {
    case 'Kilograma(s)': return 'kg';
    case 'Litro(s)': return 'L';
    case 'Unidade(s)': return 'unid';
    default: return unit;
  }
};

const formatNumber = (num: number): string => {
  if (num === Math.floor(num)) {
    return num.toString();
  }
  return num.toFixed(1);
};

interface QuantityShortageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (decision: 'stock_shortage' | 'typing_error' | 'buyer_approval_excess', correctedData?: any) => void;
  productName: string;
  requestedQuantity: number;
  offeredQuantity: number;
  offeredPackages: number;
  unit: string;
  unitsPerPackage: number;
  unitWeight: number;
  totalPackagingPrice: number;
  packagingType: 'bulk' | 'closed_package';
  scenario: 'adequate' | 'insufficient' | 'very_insufficient' | 'exact' | 'excess' | 'valid';
  variationAmount: number;
  variationPercentage: number;
}

export default function QuantityShortageModal({
  isOpen,
  onClose,
  onConfirm,
  productName,
  requestedQuantity,
  offeredQuantity,
  unit,
  unitsPerPackage,
  unitWeight,
  totalPackagingPrice,
  packagingType,
  scenario,
  variationAmount,
  variationPercentage,
  offeredPackages
}: QuantityShortageModalProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showCorrectionInputs, setShowCorrectionInputs] = useState(false);

  // Detectar se é granel usando a lógica MACRO
  const isGranel = isGranelPackaging(packagingType);

  const [correctedData, setCorrectedData] = useState({
    packages: offeredPackages,
    unitsPerPackage: unitsPerPackage,
    unitWeight: unitWeight,
    price: totalPackagingPrice
  });

  useEffect(() => {
    if (isOpen) {
      setSelectedOption(null);
      setShowCorrectionInputs(false);
      setCorrectedData({
        packages: offeredPackages,
        unitsPerPackage: unitsPerPackage,
        unitWeight: unitWeight,
        price: totalPackagingPrice
      });
    }
  }, [isOpen, offeredPackages, unitsPerPackage, unitWeight, totalPackagingPrice]);

  // Calcular dinamicamente os novos valores quando correctedData muda
  const correctedCalculations = useMemo(() => {
    const packages = correctedData.packages || 0;
    const unitsPerPkg = correctedData.unitsPerPackage || 0;
    const weight = correctedData.unitWeight || 0;
    const price = correctedData.price || 0;

    // Aplicar a mesma lógica de cálculo
    const isWeightVolume =
      unit === 'Kilograma(s)' ||
      unit === 'Grama(s)' ||
      unit === 'Litro(s)' ||
      unit === 'Mililitro(s)';

    let newQuantity = 0;
    if (isGranel) {
      newQuantity = packages * weight;
    } else if (isWeightVolume) {
      newQuantity = packages * weight;
    } else {
      newQuantity = packages * unitsPerPkg;
    }

    const newTotal = packages * price;
    const newVariation = newQuantity - requestedQuantity;
    const newVariationPercent = requestedQuantity > 0 ? Math.abs((newVariation / requestedQuantity) * 100) : 0;

    return {
      quantity: newQuantity,
      totalPrice: newTotal,
      variation: newVariation,
      variationPercent: newVariationPercent,
      isExact: newQuantity === requestedQuantity,
      isShort: newQuantity < requestedQuantity,
      isOver: newQuantity > requestedQuantity
    };
  }, [correctedData, unit, isGranel, requestedQuantity]);

  const handleConfirm = () => {
    if (selectedOption === 'typing_error') {
      onConfirm('typing_error', correctedData);
    } else if (selectedOption === 'buyer_approval_excess') {
      onConfirm('buyer_approval_excess', correctedData);
    } else if (selectedOption) {
      onConfirm(selectedOption as 'stock_shortage' | 'typing_error' | 'buyer_approval_excess');
    }
  };

  const handleOptionChange = (value: string) => {
    setSelectedOption(value);
    if (value === 'typing_error') {
      setShowCorrectionInputs(true);
    } else if (value === 'buyer_approval_excess') {
      // Manter inputs visíveis quando seleciona opção de excesso
      // (fornecedor já corrigiu os valores, está apenas escolhendo enviar para aprovação)
      setShowCorrectionInputs(true);
    } else {
      setShowCorrectionInputs(false);
    }
  };

  const unitAbbr = getUnitAbbr(unit);

  // Usar valores corrigidos se estiver editando, senão usar valores originais
  const displayQuantity = showCorrectionInputs ? correctedCalculations.quantity : offeredQuantity;
  const displayPackages = showCorrectionInputs ? correctedData.packages : offeredPackages;
  const displayUnitsPerPackage = showCorrectionInputs ? correctedData.unitsPerPackage : unitsPerPackage;
  const displayUnitWeight = showCorrectionInputs ? correctedData.unitWeight : unitWeight;
  const displayPrice = showCorrectionInputs ? correctedData.price : totalPackagingPrice;
  const displayTotal = showCorrectionInputs ? correctedCalculations.totalPrice : (offeredPackages * totalPackagingPrice);
  const displayVariation = showCorrectionInputs ? correctedCalculations.variation : (offeredQuantity - requestedQuantity);
  const displayVariationPercent = showCorrectionInputs ? correctedCalculations.variationPercent : variationPercentage;

  const renderStatus = () => {
    // Usar variação dinâmica
    const isExact = displayQuantity === requestedQuantity;
    const isShort = displayQuantity < requestedQuantity;

    if (isExact) {
      return {
        icon: <CheckCircle className="h-5 w-5 text-green-600" />,
        title: 'Quantidade Exata',
        description: 'Quantidade perfeita!',
        className: 'bg-green-50 border-green-300 text-green-900'
      };
    }

    if (isShort) {
      if (displayVariationPercent <= 50) {
        return {
          icon: <AlertTriangle className="h-5 w-5 text-yellow-600" />,
          title: 'Quantidade Insuficiente',
          description: `Faltam ${formatNumber(Math.abs(displayVariation))} ${unitAbbr} (${Math.round(displayVariationPercent)}% a menos)`,
          className: 'bg-yellow-50 border-yellow-300 text-yellow-900'
        };
      }
      return {
        icon: <XCircle className="h-5 w-5 text-red-600" />,
        title: 'Quantidade Muito Abaixo',
        description: `Faltam ${formatNumber(Math.abs(displayVariation))} ${unitAbbr} (${Math.round(displayVariationPercent)}% a menos)`,
        className: 'bg-red-50 border-red-300 text-red-900'
      };
    }

    // Excesso
    return {
      icon: <AlertTriangle className="h-5 w-5 text-orange-600" />,
      title: 'Excesso de Quantidade',
      description: `Excesso de ${formatNumber(displayVariation)} ${unitAbbr} (${Math.round(displayVariationPercent)}% a mais)`,
      className: 'bg-orange-50 border-orange-300 text-orange-900'
    };
  };

  const status = renderStatus();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[650px]">
        <DialogHeader>
          <DialogTitle>Confirme os Dados da Oferta</DialogTitle>
          <DialogDescription>Revise as informações antes de enviar</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {status && (
            <div className={`p-3 rounded-lg ${status.className}`}>
              <div className="flex items-center gap-2 mb-2">
                {status.icon}
                <p className="font-bold">{status.title}</p>
              </div>
              <div className="text-sm space-y-1">
                <p>Pedido: <strong>{formatNumber(requestedQuantity)} {unitAbbr}</strong> | Oferta: <strong>{formatNumber(displayQuantity)} {unitAbbr}</strong></p>
                <p className="font-semibold">{status.description}</p>
              </div>
            </div>
          )}

          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div><span className="text-gray-600">Marca:</span><span className="ml-2 font-semibold">{productName}</span></div>
              <div><span className="text-gray-600">Tipo de embalagem:</span><span className="ml-2 font-semibold">{packagingType === 'closed_package' ? 'Caixa (conjunto fixo)' : 'A Granel (embalagens individuais)'}</span></div>
              {!isGranel ? (
                <>
                  {/* 📦 MODO CAIXA/FARDO: Sempre mostra unidades por caixa */}
                  <div><span className="text-gray-600">Quantidade de caixas:</span><span className="ml-2 font-semibold">{displayPackages}</span></div>
                  <div><span className="text-gray-600">Unidades por caixa:</span><span className="ml-2 font-semibold">{displayUnitsPerPackage} unid</span></div>
                  <div><span className="text-gray-600">Peso da caixa completa:</span><span className="ml-2 font-semibold">{displayUnitWeight} {unitAbbr}</span></div>
                  <div><span className="text-gray-600">Preço por caixa:</span><span className="ml-2 font-semibold">{formatCurrency(displayPrice)}</span></div>
                  <div className="col-span-2 pt-2 border-t border-gray-300 mt-1">
                    <span className="text-gray-700">Total oferecido:</span>
                    <span className="ml-2 font-bold text-green-700">{formatCurrency(displayTotal)}</span>
                    <span className="ml-2 text-gray-600">({formatNumber(displayQuantity)} {unitAbbr})</span>
                  </div>
                  <div className="col-span-2 text-xs text-gray-500">
                    Cálculo: {displayPackages} caixas × {displayUnitsPerPackage} unid/caixa = {formatNumber(displayQuantity)} unidades
                  </div>
                </>
              ) : (
                <>
                  <div><span className="text-gray-600">Quantidade de sacos:</span><span className="ml-2 font-semibold">{displayPackages}</span></div>
                  <div><span className="text-gray-600">Peso por saco:</span><span className="ml-2 font-semibold">{displayUnitWeight} kg</span></div>
                  <div><span className="text-gray-600">Preço por saco:</span><span className="ml-2 font-semibold">{formatCurrency(displayPrice)}</span></div>
                  <div className="col-span-2 pt-2 border-t border-gray-300 mt-1">
                    <span className="text-gray-700">Total oferecido:</span>
                    <span className="ml-2 font-bold text-green-700">{formatCurrency(displayTotal)}</span>
                    <span className="ml-2 text-gray-600">({displayQuantity} kg)</span>
                  </div>
                  <div className="col-span-2 text-xs text-gray-500">Cálculo: {displayPackages} sacos × {displayUnitWeight} kg/saco = {displayQuantity} kg</div>
                </>
              )}
            </div>
          </div>

          <div>
            <Label className="text-base font-semibold mb-3 block">O que você deseja fazer?</Label>
            <RadioGroup value={selectedOption || ''} onValueChange={handleOptionChange}>
              <div className="space-y-3">
                <div className="flex items-start space-x-3 p-3 border-2 rounded-lg hover:border-red-400 cursor-pointer">
                  <RadioGroupItem value="stock_shortage" id="stock_shortage" className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="stock_shortage" className="cursor-pointer font-medium">Está em falta no meu estoque</Label>
                    <p className="text-sm text-muted-foreground mt-1">Não consigo fornecer mais. O comprador decidirá.</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3 p-3 border-2 rounded-lg hover:border-blue-400 cursor-pointer">
                  <RadioGroupItem value="typing_error" id="typing_error" className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="typing_error" className="cursor-pointer font-medium">Foi erro de digitação</Label>
                    <p className="text-sm text-muted-foreground mt-1">Deixe-me corrigir os valores.</p>
                  </div>
                </div>
                {showCorrectionInputs && correctedCalculations.isOver && (
                  <div className="flex items-start space-x-3 p-3 border-2 rounded-lg hover:border-green-400 cursor-pointer bg-green-50">
                    <RadioGroupItem value="buyer_approval_excess" id="buyer_approval_excess" className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor="buyer_approval_excess" className="cursor-pointer font-medium text-green-800">Enviar excesso para aprovação do comprador</Label>
                      <p className="text-sm text-green-700 mt-1">Posso fornecer mais, mas preciso da aprovação do comprador para o excedente.</p>
                    </div>
                  </div>
                )}
                {showCorrectionInputs && (
                  <div className="ml-9 p-3 bg-blue-50 border border-blue-200 rounded space-y-3">
                    <p className="text-xs font-semibold text-blue-900">Revise e corrija os valores:</p>
                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <Label htmlFor="corrected_packages" className="text-xs font-bold block mb-1">Caixas</Label>
                        <Input id="corrected_packages" type="number" value={correctedData.packages} onChange={(e) => setCorrectedData({ ...correctedData, packages: Number(e.target.value) })} className="h-8 text-sm" />
                      </div>
                      <div>
                        <Label htmlFor="corrected_units_per_package" className="text-xs font-medium block mb-1">Unid/cx</Label>
                        <Input id="corrected_units_per_package" type="number" value={correctedData.unitsPerPackage} onChange={(e) => setCorrectedData({ ...correctedData, unitsPerPackage: Number(e.target.value) })} className="h-8 text-sm" />
                      </div>
                      <div>
                        <Label htmlFor="corrected_unit_weight" className="text-xs font-medium block mb-1">Peso/cx ({unitAbbr})</Label>
                        <Input id="corrected_unit_weight" type="number" step="0.001" value={correctedData.unitWeight} onChange={(e) => setCorrectedData({ ...correctedData, unitWeight: Number(e.target.value) })} className="h-8 text-sm" />
                      </div>
                      <div>
                        <Label htmlFor="corrected_packaging_price" className="text-xs font-medium block mb-1">Preço/cx (R$)</Label>
                        <Input id="corrected_packaging_price" type="number" step="0.01" value={correctedData.price} onChange={(e) => setCorrectedData({ ...correctedData, price: Number(e.target.value) })} className="h-8 text-sm" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </RadioGroup>
          </div>
        </div>

        <DialogFooter className="flex justify-between">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!selectedOption} className="bg-green-600 hover:bg-green-700">
            <CheckCircle className="h-4 w-4 mr-2" />
            Confirmar Oferta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}