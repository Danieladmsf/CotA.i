"use client";

import * as React from "react";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { db } from "@/lib/config/firebase";
import { doc, getDoc, onSnapshot, setDoc, serverTimestamp, collection, query, where, getDocs, Timestamp, addDoc, deleteDoc, updateDoc, arrayUnion, collectionGroup } from "firebase/firestore";
import type { Quotation, Offer, ShoppingListItem, Fornecedor as SupplierType, UnitOfMeasure, PendingBrandRequest } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription as AlertPrimitiveDescription, AlertTitle } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Info,
  Settings2,
  PlusCircle,
  Save,
  ChevronLeft,
  Bell,
  Loader2,
  Building,
  User,
  Tag,
  Package,
  DollarSign,
  Hash,
  Scale,
  Clock,
  Trash2,
  Award,
  Briefcase,
  Contact,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  TrendingDown,
  EyeOff,
  CheckCircle,
  HelpCircle,
} from "lucide-react";
import { format, intervalToDuration } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { sendCounterProposalReminder, sendQuantityVariationNotification } from "@/actions/notificationActions";
import { closeQuotationAndItems } from "@/actions/quotationActions";
import { formatCurrency } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/hooks/useNotifications";
import { useVoiceAssistant } from "@/hooks/useVoiceAssistant";
import { voiceMessages } from "@/config/voiceMessages";
import { useSupplierAuth } from "@/hooks/useSupplierAuth";
import SupplierPinModal from "@/components/features/portal/SupplierPinModal";
import { CountdownTimer } from "@/components/ui/CountdownTimer";
import {
  useQuotationDeadline,
  calculateCounterProposalStatus,
  isCounterProposalExpired,
  calculateBlockingRules,
  useCounterProposalReminders,
  usePriorityNotificationHandler,
  type CounterProposalInfo
} from "@/hooks/quotation";
import { handleOutbidNotification } from "@/lib/quotation/notificationHelpers";

const QUOTATIONS_COLLECTION = "quotations";
const FORNECEDORES_COLLECTION = "fornecedores";
const SHOPPING_LIST_ITEMS_COLLECTION = "shopping_list_items";
const PENDING_BRAND_REQUESTS_COLLECTION = "pending_brand_requests";

// Utility function to handle preferredBrands as both string and array
const getPreferredBrandsArray = (preferredBrands: string | string[] | undefined): string[] => {
  if (!preferredBrands) return [];
  let brands: string[];
  if (Array.isArray(preferredBrands)) {
    brands = preferredBrands;
  } else {
    brands = preferredBrands.split(',').map(b => b.trim());
  }
  // Filter out brands that are only numbers or empty
  return brands.filter(brand => {
    const trimmed = brand.trim();
    return trimmed.length > 0 && !(/^\d+$/.test(trimmed));
  });
};

const dayMap = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];

interface OfferWithUI extends Offer {
  uiId: string; 
  isSuggestedBrand?: boolean;
  showBeatOfferOptions?: boolean;
}

interface BestOfferForBrandDisplay {
  brandName: string;
  pricePerUnit: number;
  supplierId: string;
  supplierName: string;
  supplierInitials: string;
  supplierFotoUrl?: string;
  supplierFotoHint?: string;
  vendedor?: string;
  cnpj?: string;
  packagingDescription?: string;
  unitsInPackaging?: number;
  unitWeight?: number;
  totalPackagingPrice?: number;
  isSelf: boolean;
  productUnit: UnitOfMeasure;
}

interface NewBrandForm {
  brandName: string;
  packagingDescription: string;
  unitsInPackaging: number;
  unitWeight: number;
  totalPackagingPrice: number;
  imageFile: File | null;
}

// Dynamic label and placeholder functions based on product unit
const getDynamicWeightLabel = (unit: string): string => {
  switch (unit) {
    case 'Kilograma(s)':
      return 'Peso (Kg)';
    case 'Litro(s)':
      return 'Volume (ml)';
    case 'Grama(s)':
      return 'Peso (gr)';
    case 'Mililitro(s)':
      return 'Volume (ml)';
    case 'Unidade(s)':
      return 'Qtd por Emb.';
    case 'Pacote(s)':
      return 'Qtd por Emb.';
    default:
      return `Qtd (${abbreviateUnit(unit)})`;
  }
};

const getDynamicWeightPlaceholder = (unit: string): string => {
  switch (unit) {
    case 'Kilograma(s)':
      return 'Ex: 5Kg';
    case 'Litro(s)':
      return 'Ex: 500ml';
    case 'Grama(s)':
      return 'Ex: 250gr';
    case 'Mililitro(s)':
      return 'Ex: 350ml';
    case 'Unidade(s)':
      return 'Ex: 1 unid';
    case 'Pacote(s)':
      return 'Ex: 1 pct';
    default:
      return `Ex: 1 ${abbreviateUnit(unit)}`;
  }
};

const getUnitSuffix = (unit: string): string => {
  switch (unit) {
    case 'Kilograma(s)':
      return 'Kg';
    case 'Litro(s)':
      return 'ml';
    case 'Grama(s)':
      return 'gr';
    case 'Mililitro(s)':
      return 'ml';
    case 'Unidade(s)':
      return 'unid';
    case 'Pacote(s)':
      return 'pct';
    default:
      return abbreviateUnit(unit);
  }
};

interface ProductToQuoteVM extends ShoppingListItem {
  supplierOffers: OfferWithUI[];
  bestOffersByBrand: BestOfferForBrandDisplay[];
  lowestPriceThisProductHas?: number | null;
  isDeliveryDayMismatch: boolean;
  counterProposalInfo: CounterProposalInfo | null;
  isLockedOut?: boolean;
  acknowledgedDeliveryMismatches?: string[]; // NEW FIELD
  categoryName?: string;
  pendingBrandRequests?: PendingBrandRequest[]; // Nova propriedade para solicitações pendentes
}

const abbreviateUnit = (unit: UnitOfMeasure | string): string => {
  switch (unit) {
    case "Kilograma(s)": return "Kg";
    case "Litro(s)": return "Lt";
    case "Unidade(s)": return "Unid.";
    case "Grama(s)": return "g";
    case "Mililitro(s)": return "ml";
    case "Caixa(s)": return "Cx.";
    case "Pacote(s)": return "Pct.";
    case "Dúzia(s)": return "Dz.";
    case "Peça(s)": return "Pç.";
    case "Metro(s)": return "m";
    case "Lata(s)": return "Lata";
    case "Garrafa(s)": return "Gf.";
    default:
      if (typeof unit === 'string' && unit.includes("(")) return unit.substring(0, unit.indexOf("(")).trim();
      return String(unit);
  }
};

// Funções para formatação monetária
const formatCurrencyInput = (centavos: number): string => {
  const reais = centavos / 100;
  return reais.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const parseCurrencyInput = (value: string): number => {
  // Remove tudo exceto números
  const numbersOnly = value.replace(/[^\d]/g, '');
  // Converte para centavos (número inteiro)
  return parseInt(numbersOnly) || 0;
};

const handleCurrencyInputChange = (value: string): string => {
  const centavos = parseCurrencyInput(value);
  return formatCurrencyInput(centavos);
};

// Funções para formatação de peso (Kg/L)
const formatWeightInputForKg = (gramas: number): string => {
  const kg = gramas / 1000;
  return kg.toFixed(3).replace('.', ',');
};

const parseWeightInputForKg = (value: string): number => {
  const numbersOnly = value.replace(/[^\d]/g, '');
  return parseInt(numbersOnly) || 0;
};

const handleWeightInputChangeForKg = (value: string): string => {
  const gramas = parseWeightInputForKg(value);
  return formatWeightInputForKg(gramas);
};

// Funções para validação de quantidade total
const calculateTotalOfferedQuantity = (offer: OfferWithUI, product: ProductToQuoteVM): number => {
  const packagesCount = Number(offer.unitsInPackaging) || 0;
  const unitsPerPackage = Number(offer.unitsPerPackage) || 0;
  const unitWeight = Number(offer.unitWeight) || 0;

  if (packagesCount <= 0) return 0;

  // Para produtos vendidos por peso (Kg/L), usar peso total
  if (product.unit === 'Kilograma(s)' || product.unit === 'Litro(s)') {
    return packagesCount * unitWeight;
  }
  
  // Para produtos vendidos por unidade, usar quantidade de unidades
  if (product.unit === 'Unidade(s)' || product.unit === 'Peça(s)' || product.unit === 'Dúzia(s)') {
    return packagesCount * unitsPerPackage;
  }
  
  // Para outras unidades, usar peso
  return packagesCount * unitWeight;
};

const validateQuantityVariation = (
  offeredQuantity: number, 
  requestedQuantity: number,
  tolerancePercent: number = 10
): { isValid: boolean; variationType?: 'over' | 'under'; variationPercentage: number } => {
  if (requestedQuantity <= 0) {
    return { isValid: true, variationPercentage: 0 };
  }

  const variationPercentage = Math.abs((offeredQuantity - requestedQuantity) / requestedQuantity) * 100;
  
  if (variationPercentage <= tolerancePercent) {
    return { isValid: true, variationPercentage };
  }

  const variationType = offeredQuantity > requestedQuantity ? 'over' : 'under';
  return { 
    isValid: false, 
    variationType, 
    variationPercentage 
  };
};

// Formatação inteligente de peso para títulos
const formatSmartWeight = (weight: number, unit: UnitOfMeasure | string): string => {
  if ((unit === 'Kilograma(s)' || unit === 'Kg') && weight < 1 && weight > 0) {
    const gramas = Math.round(weight * 1000);
    return `${gramas}g`;
  }
  if ((unit === 'Litro(s)' || unit === 'Lt' || unit === 'L') && weight < 1 && weight > 0) {
    const ml = Math.round(weight * 1000);
    return `${ml}ml`;
  }
  const formattedWeight = weight % 1 === 0 ? weight.toFixed(0) : weight;
  return `${formattedWeight}${abbreviateUnit(unit)}`;
};

const formatPackaging = (quantity: number, weight: number, unit: UnitOfMeasure | string): string => {
  return `${quantity}×${formatSmartWeight(weight, unit)}`;
};

// Gera título dinâmico do produto baseado na oferta do fornecedor
const buildDynamicTitle = (
  productName: string,
  offer: OfferWithUI | undefined,
  productUnit: UnitOfMeasure
): string => {
  if (!offer) return productName;

  let title = productName;

  // Adiciona marca com hífen se preenchida
  if (offer.brandOffered && offer.brandOffered.trim()) {
    title += ` - ${offer.brandOffered}`;
  }

  // Adiciona embalagem se ambos campos preenchidos
  if (offer.unitsInPackaging > 0 && offer.unitWeight && offer.unitWeight > 0) {
    title += ` ${formatPackaging(offer.unitsInPackaging, offer.unitWeight, productUnit)}`;
  }

  // Adiciona preço se preenchido
  if (offer.totalPackagingPrice > 0) {
    title += ` | ${formatCurrency(offer.totalPackagingPrice)}`;
  }

  return title;
};


const isValidImageUrl = (url?: string): url is string => {
  return !!url && (url.startsWith('http') || url.startsWith('data:'));
};

// Renderiza o card do fluxo guiado do vendedor
const renderVendorFlowCard = (
  productId: string,
  product: ProductToQuoteVM,
  flow: any,
  updateVendorFlowStep: (productId: string, field: string, value: any, nextStep?: number) => void,
  completeVendorFlow: (productId: string) => void,
  cancelVendorFlow: (productId: string) => void,
  formatCurrency: (value: number | null) => string
) => {
  const { currentStep, selectedBrand, packagingType, unitsPerPackage, packageWeight, packagePrice, requiredPackages } = flow;

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <h4 className="text-lg font-semibold">Seu item virá em:</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Button
                variant={packagingType === 'caixa' ? 'default' : 'outline'}
                onClick={() => updateVendorFlowStep(productId, 'packagingType', 'caixa', 2)}
                className="h-16 text-base"
              >
                📦 Caixa
              </Button>
              <Button
                variant={packagingType === 'fardo' ? 'default' : 'outline'}
                onClick={() => updateVendorFlowStep(productId, 'packagingType', 'fardo', 2)}
                className="h-16 text-base"
              >
                📄 Fardo
              </Button>
              <Button
                variant={packagingType === 'granel' ? 'default' : 'outline'}
                onClick={() => updateVendorFlowStep(productId, 'packagingType', 'granel', 3)} // Pula etapa 2 para granel
                className="h-16 text-base"
              >
                🌾 A Granel
              </Button>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <h4 className="text-lg font-semibold">
              Quantas unidades vêm na {packagingType}?
            </h4>
            <div className="space-y-2">
              <Input
                type="number"
                placeholder="Ex: 12"
                value={unitsPerPackage > 0 ? unitsPerPackage : ''}
                onChange={(e) => updateVendorFlowStep(productId, 'unitsPerPackage', parseInt(e.target.value) || 0)}
                className="text-lg h-12"
              />
              <Button
                onClick={() => updateVendorFlowStep(productId, 'currentStep', '', 3)}
                disabled={unitsPerPackage <= 0}
                className="w-full"
              >
                Próximo
              </Button>
            </div>
          </div>
        );

      case 3:
        const isLiquid = product.unit === 'Litro(s)' || product.unit === 'Mililitro(s)';
        const weightLabel = isLiquid ? 'volume (Litros)' : 'peso (Kg)';
        const weightKey = `${productId}_weight`;
        return (
          <div className="space-y-4">
            <h4 className="text-lg font-semibold">
              Qual é o {weightLabel} da embalagem?
            </h4>
            <div className="space-y-2">
              <div className="relative">
                <Input
                  type={product.unit === 'Kilograma(s)' || product.unit === 'Litro(s)' ? "text" : "number"}
                  step="0.001"
                  placeholder={isLiquid ? "Ex: 1,500" : "Ex: 2,500"}
                  value={(() => {
                    if (product.unit === 'Kilograma(s)' || product.unit === 'Litro(s)') {
                      // Usar formatação de peso para Kg/L
                      if (packageWeight > 0) {
                        const gramas = Math.round(packageWeight * 1000);
                        return formatWeightInputForKg(gramas);
                      }
                      return '';
                    } else {
                      // Outras unidades: valor direto
                      return packageWeight > 0 ? packageWeight.toString().replace('.', ',') : '';
                    }
                  })()}
                  onChange={(e) => {
                    const inputValue = e.target.value;
                    if (product.unit === 'Kilograma(s)' || product.unit === 'Litro(s)') {
                      // Formatação para Kg/L
                      const gramas = parseWeightInputForKg(inputValue);
                      const kg = gramas / 1000;
                      updateVendorFlowStep(productId, 'packageWeight', kg);
                    } else {
                      // Outras unidades
                      const numericValue = parseFloat(inputValue.replace(',', '.')) || 0;
                      updateVendorFlowStep(productId, 'packageWeight', numericValue);
                    }
                  }}
                  className="text-lg h-12 pr-12"
                />
                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                  {isLiquid ? 'L' : 'Kg'}
                </span>
              </div>
              <Button
                onClick={() => updateVendorFlowStep(productId, 'currentStep', '', 4)}
                disabled={packageWeight <= 0}
                className="w-full"
              >
                Próximo
              </Button>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <h4 className="text-lg font-semibold">
              Qual o preço d{packagingType === 'caixa' ? 'a caixa' : packagingType === 'fardo' ? 'o fardo' : 'a unidade a granel'}?
            </h4>
            <div className="space-y-2">
              <Input
                type="text"
                placeholder="R$ 0,00"
                value={packagePrice > 0 ? formatCurrencyInput(packagePrice * 100) : ''}
                onChange={(e) => {
                  const centavos = parseCurrencyInput(e.target.value);
                  const decimalValue = centavos / 100;
                  updateVendorFlowStep(productId, 'packagePrice', decimalValue);
                }}
                className="text-lg h-12"
              />
              <Button
                onClick={() => updateVendorFlowStep(productId, 'currentStep', '', 5)}
                disabled={packagePrice <= 0}
                className="w-full"
              >
                Próximo
              </Button>
            </div>
          </div>
        );

      case 5:
        const unitLabel = product.unit === 'Kilograma(s)' ? 'Kg' : 
                         product.unit === 'Litro(s)' ? 'Litros' : 
                         product.unit === 'Unidade(s)' ? 'unidades' : product.unit;
        
        return (
          <div className="space-y-4">
            <h4 className="text-lg font-semibold">
              Para atender {product.quantity} {unitLabel} do pedido do comprador, 
              quantas {packagingType === 'caixa' ? 'caixas' : packagingType === 'fardo' ? 'fardos' : 'unidades a granel'} você precisa enviar?
            </h4>
            <div className="space-y-2">
              <Input
                type="number"
                placeholder="Ex: 50"
                value={requiredPackages > 0 ? requiredPackages : ''}
                onChange={(e) => updateVendorFlowStep(productId, 'requiredPackages', parseInt(e.target.value) || 0)}
                className="text-lg h-12"
              />
              <Button
                onClick={() => updateVendorFlowStep(productId, 'currentStep', '', 6)}
                disabled={requiredPackages <= 0}
                className="w-full"
              >
                Próximo
              </Button>
            </div>
          </div>
        );

      case 6:
        const totalValue = requiredPackages * packagePrice;
        const pricePerUnit = packagePrice / ((unitsPerPackage || 1) * (packageWeight || 1));
        
        // Calcular quantidade total oferecida
        const tempOffer: OfferWithUI = {
          unitsInPackaging: requiredPackages,
          unitsPerPackage: unitsPerPackage,
          unitWeight: packageWeight,
          // outros campos necessários para compilação
          uiId: '',
          quotationId: '',
          supplierId: '',
          supplierName: '',
          supplierInitials: '',
          pricePerUnit: 0,
          brandOffered: '',
          packagingDescription: '',
          totalPackagingPrice: 0,
          updatedAt: {} as any,
          productId: ''
        };
        
        const offeredQuantity = calculateTotalOfferedQuantity(tempOffer, product);
        const requestedQuantity = product.quantity;
        const quantityValidation = validateQuantityVariation(offeredQuantity, requestedQuantity);
        
        return (
          <div className="space-y-4">
            <h4 className="text-lg font-semibold">Confirme se os dados e valores estão corretos:</h4>
            
            {/* Alerta de variação de quantidade */}
            {!quantityValidation.isValid && (
              <div className={`p-3 rounded-lg border-l-4 ${
                quantityValidation.variationType === 'over' 
                  ? 'bg-orange-50 border-orange-500 dark:bg-orange-950/20' 
                  : 'bg-red-50 border-red-500 dark:bg-red-950/20'
              }`}>
                <div className="flex items-start gap-2">
                  <span className="text-lg">
                    {quantityValidation.variationType === 'over' ? '⚠️' : '❌'}
                  </span>
                  <div className="text-sm">
                    <p className="font-semibold">
                      {quantityValidation.variationType === 'over' 
                        ? 'Quantidade Acima do Pedido' 
                        : 'Quantidade Abaixo do Pedido'}
                    </p>
                    <p className="mt-1">
                      Pedido: <strong>{requestedQuantity} {abbreviateUnit(product.unit)}</strong> | 
                      Oferta: <strong>{offeredQuantity.toFixed(3)} {abbreviateUnit(product.unit)}</strong>
                    </p>
                    <p className="mt-1 text-xs">
                      Variação: <strong>{quantityValidation.variationPercentage.toFixed(1)}%</strong> 
                      {quantityValidation.variationType === 'over' ? ' acima' : ' abaixo'} do solicitado
                    </p>
                    <p className="mt-2 text-xs">
                      {quantityValidation.variationType === 'over' 
                        ? 'O comprador receberá uma notificação sobre esta quantidade extra.'
                        : 'Esta oferta não atende completamente o pedido do comprador.'}
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            <div className="bg-muted/30 p-4 rounded-lg space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div><strong>Marca:</strong> {selectedBrand}</div>
                <div><strong>Embalagem:</strong> {packagingType}</div>
                <div><strong>Unidades por {packagingType}:</strong> {unitsPerPackage || 'N/A'}</div>
                <div><strong>Peso/Volume por {packagingType}:</strong> {(() => {
                  const isLiquidUnit = product.unit === 'Litro(s)' || product.unit === 'Mililitro(s)';
                  if (product.unit === 'Kilograma(s)' || product.unit === 'Litro(s)') {
                    // Usar formatação inteligente para Kg/L
                    if (packageWeight < 1 && packageWeight > 0) {
                      const gramas = Math.round(packageWeight * 1000);
                      return `${gramas}${isLiquidUnit ? 'ml' : 'g'}`;
                    }
                    return `${packageWeight.toFixed(3).replace('.', ',')}${isLiquidUnit ? 'L' : 'Kg'}`;
                  } else {
                    return `${packageWeight} ${isLiquidUnit ? 'L' : 'Kg'}`;
                  }
                })()}</div>
                <div><strong>Preço por {packagingType}:</strong> {formatCurrency(packagePrice)}</div>
                <div><strong>Quantidade a enviar:</strong> {requiredPackages} {packagingType}(s)</div>
              </div>
              <div className="border-t pt-3">
                <div className="text-lg font-bold">Preço por unidade: {formatCurrency(pricePerUnit)}</div>
                <div className="text-sm text-muted-foreground mt-1">
                  Total oferecido: <strong>{offeredQuantity.toFixed(3)} {abbreviateUnit(product.unit)}</strong>
                </div>
                <div className="text-lg font-bold text-primary mt-2">Valor Total do Pedido: {formatCurrency(totalValue)}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                onClick={() => cancelVendorFlow(productId)}
                className="w-full"
              >
                Cancelar
              </Button>
              <Button
                onClick={() => completeVendorFlow(productId)}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                ✅ Confirmar Oferta
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="p-4 border rounded-md bg-gradient-to-r from-green-50/30 to-emerald-50/30 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200 dark:border-green-800 shadow-sm space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold">{selectedBrand}</h3>
          <p className="text-sm text-muted-foreground">Etapa {currentStep} de 6</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => cancelVendorFlow(productId)}
        >
          ✕
        </Button>
      </div>
      
      <div className="w-full bg-muted rounded-full h-2">
        <div 
          className="bg-green-600 h-2 rounded-full transition-all duration-300" 
          style={{ width: `${(currentStep / 6) * 100}%` }}
        />
      </div>

      {renderStep()}
    </div>
  );
};



// Renderiza o fluxo guiado de nova marca (6 etapas)
const renderNewBrandFlowCard = (
  productId: string,
  product: ProductToQuoteVM,
  flow: any,
  updateNewBrandFlowStep: (productId: string, field: string, value: any, nextStep?: number) => void,
  completeNewBrandFlow: (productId: string) => void,
  cancelNewBrandFlow: (productId: string) => void,
  formatCurrency: (value: number) => string,
  formatCurrencyInput: (centavos: number) => string,
  parseCurrencyInput: (value: string) => number,
  formatWeightInputForKg: (gramas: number) => string,
  parseWeightInputForKg: (value: string) => number,
  isSubmittingNewBrand: boolean
) => {
  const {
    currentStep,
    brandName = '',
    packagingType = '',
    unitsPerPackage = 0,
    packageWeight = 0,
    packagePrice = 0,
    requiredPackages = 0,
    imageFile = null
  } = flow || {};

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <h4 className="text-lg font-semibold">Qual é o nome da nova marca que você quer propor?</h4>
            <div className="space-y-2">
              <Input
                type="text"
                placeholder="Ex: Marca Premium"
                value={brandName}
                onChange={(e) => updateNewBrandFlowStep(productId, 'brandName', e.target.value)}
                className="text-lg h-12"
              />
              <Button
                onClick={() => updateNewBrandFlowStep(productId, 'currentStep', '', 2)}
                disabled={!brandName.trim()}
                className="w-full bg-orange-600 hover:bg-orange-700"
              >
                Próximo
              </Button>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <h4 className="text-lg font-semibold">Seu item virá em:</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Button
                variant={packagingType === 'caixa' ? 'default' : 'outline'}
                onClick={() => updateNewBrandFlowStep(productId, 'packagingType', 'caixa', 3)}
                className="h-16 text-base"
              >
                📦 Caixa
              </Button>
              <Button
                variant={packagingType === 'fardo' ? 'default' : 'outline'}
                onClick={() => updateNewBrandFlowStep(productId, 'packagingType', 'fardo', 3)}
                className="h-16 text-base"
              >
                📄 Fardo
              </Button>
              <Button
                variant={packagingType === 'granel' ? 'default' : 'outline'}
                onClick={() => updateNewBrandFlowStep(productId, 'packagingType', 'granel', 4)} // Pula etapa 3 para granel
                className="h-16 text-base"
              >
                🌾 A Granel
              </Button>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <h4 className="text-lg font-semibold">
              Quantas unidades vêm na {packagingType}?
            </h4>
            <div className="space-y-2">
              <Input
                type="number"
                placeholder="Ex: 12"
                value={unitsPerPackage > 0 ? unitsPerPackage : ''}
                onChange={(e) => updateNewBrandFlowStep(productId, 'unitsPerPackage', parseInt(e.target.value) || 0)}
                className="text-lg h-12"
              />
              <Button
                onClick={() => updateNewBrandFlowStep(productId, 'currentStep', '', 4)}
                disabled={unitsPerPackage <= 0}
                className="w-full bg-orange-600 hover:bg-orange-700"
              >
                Próximo
              </Button>
            </div>
          </div>
        );

      case 4:
        const isLiquid = product.unit === 'Litro(s)' || product.unit === 'Mililitro(s)';
        const weightLabel = isLiquid ? 'volume (Litros)' : 'peso (Kg)';
        return (
          <div className="space-y-4">
            <h4 className="text-lg font-semibold">
              Qual é o {weightLabel} da embalagem desta marca?
            </h4>
            <div className="space-y-2">
              <div className="relative">
                <Input
                  type={product.unit === 'Kilograma(s)' || product.unit === 'Litro(s)' ? "text" : "number"}
                  step="0.001"
                  placeholder={isLiquid ? "Ex: 1,500" : "Ex: 2,500"}
                  value={(() => {
                    if (product.unit === 'Kilograma(s)' || product.unit === 'Litro(s)') {
                      if (packageWeight > 0) {
                        const gramas = Math.round(packageWeight * 1000);
                        return formatWeightInputForKg(gramas);
                      }
                      return '';
                    } else {
                      return packageWeight > 0 ? packageWeight.toString().replace('.', ',') : '';
                    }
                  })()}
                  onChange={(e) => {
                    const inputValue = e.target.value;
                    if (product.unit === 'Kilograma(s)' || product.unit === 'Litro(s)') {
                      const gramas = parseWeightInputForKg(inputValue);
                      const kg = gramas / 1000;
                      updateNewBrandFlowStep(productId, 'packageWeight', kg);
                    } else {
                      const numericValue = parseFloat(inputValue.replace(',', '.')) || 0;
                      updateNewBrandFlowStep(productId, 'packageWeight', numericValue);
                    }
                  }}
                  className="text-lg h-12 pr-12"
                />
                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                  {isLiquid ? 'L' : 'Kg'}
                </span>
              </div>
              <Button
                onClick={() => updateNewBrandFlowStep(productId, 'currentStep', '', 5)}
                disabled={packageWeight <= 0}
                className="w-full bg-orange-600 hover:bg-orange-700"
              >
                Próximo
              </Button>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <h4 className="text-lg font-semibold">Qual o preço da embalagem desta marca?</h4>
            <div className="space-y-2">
              <Input
                type="text"
                placeholder="R$ 0,00"
                value={packagePrice > 0 ? formatCurrencyInput(packagePrice * 100) : ''}
                onChange={(e) => {
                  const centavos = parseCurrencyInput(e.target.value);
                  const decimalValue = centavos / 100;
                  updateNewBrandFlowStep(productId, 'packagePrice', decimalValue);
                }}
                className="text-lg h-12"
              />
              <Button
                onClick={() => updateNewBrandFlowStep(productId, 'currentStep', '', 6)}
                disabled={packagePrice <= 0}
                className="w-full bg-orange-600 hover:bg-orange-700"
              >
                Próximo
              </Button>
            </div>
          </div>
        );

      case 6:
        const unitLabel = product.unit === 'Kilograma(s)' ? 'Kg' : 
                         product.unit === 'Litro(s)' ? 'Litros' : 
                         product.unit === 'Unidade(s)' ? 'unidades' : product.unit;
        
        return (
          <div className="space-y-4">
            <h4 className="text-lg font-semibold">
              Para atender {product.quantity} {unitLabel} do pedido do comprador, 
              quantas embalagens você precisa enviar?
            </h4>
            <div className="space-y-2">
              <Input
                type="number"
                placeholder="Ex: 4"
                value={flow.requiredPackages > 0 ? flow.requiredPackages : ''}
                onChange={(e) => updateNewBrandFlowStep(productId, 'requiredPackages', parseInt(e.target.value) || 0)}
                className="text-lg h-12"
              />
              <Button
                onClick={() => updateNewBrandFlowStep(productId, 'currentStep', '', 7)}
                disabled={flow.requiredPackages <= 0}
                className="w-full bg-orange-600 hover:bg-orange-700"
              >
                Próximo
              </Button>
            </div>
          </div>
        );

      case 7:
        return (
          <div className="space-y-4">
            <h4 className="text-lg font-semibold">Envie uma imagem da marca/produto (opcional):</h4>
            <div className="space-y-2">
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => updateNewBrandFlowStep(productId, 'imageFile', e.target.files?.[0] || null)}
                className="text-lg file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"
              />
              <p className="text-xs text-muted-foreground">
                Envie uma imagem da marca/produto para ajudar na aprovação
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => updateNewBrandFlowStep(productId, 'currentStep', '', 8)}
                  className="flex-1"
                >
                  Pular
                </Button>
                <Button
                  onClick={() => updateNewBrandFlowStep(productId, 'currentStep', '', 8)}
                  className="flex-1 bg-orange-600 hover:bg-orange-700"
                >
                  Próximo
                </Button>
              </div>
            </div>
          </div>
        );

      case 8:
        // Calcular a quantidade oferecida baseada nos dados preenchidos
        const tempBrandOffer = {
          unitsInPackaging: flow.requiredPackages || 1, // Usar a quantidade informada pelo vendedor
          unitsPerPackage: packagingType === 'granel' ? 1 : unitsPerPackage,
          unitWeight: packageWeight
        };
        
        const offeredQuantity = calculateTotalOfferedQuantity(tempBrandOffer as any, product);
        const requestedQuantity = product.quantity;
        const quantityValidation = validateQuantityVariation(offeredQuantity, requestedQuantity);
        
        const totalValue = (flow.requiredPackages || 1) * packagePrice;
        const pricePerUnit = packagePrice / ((unitsPerPackage || 1) * (packageWeight || 1));
        
        return (
          <div className="space-y-4">
            <h4 className="text-lg font-semibold">Confirme os dados da nova marca:</h4>
            
            {/* Alerta de variação de quantidade */}
            {!quantityValidation.isValid && (
              <div className={`p-3 rounded-lg border-l-4 ${
                quantityValidation.variationType === 'over' 
                  ? 'bg-orange-50 border-orange-500 dark:bg-orange-950/20' 
                  : 'bg-red-50 border-red-500 dark:bg-red-950/20'
              }`}>
                <div className="flex items-start gap-2">
                  <span className="text-lg">
                    {quantityValidation.variationType === 'over' ? '⚠️' : '❌'}
                  </span>
                  <div className="text-sm">
                    <p className="font-semibold">
                      {quantityValidation.variationType === 'over' 
                        ? 'Quantidade Acima do Pedido' 
                        : 'Quantidade Abaixo do Pedido'}
                    </p>
                    <p className="mt-1">
                      Pedido: <strong>{requestedQuantity} {abbreviateUnit(product.unit)}</strong> | 
                      Oferta: <strong>{offeredQuantity.toFixed(3)} {abbreviateUnit(product.unit)}</strong>
                    </p>
                    <p className="mt-1 text-xs">
                      Variação: <strong>{quantityValidation.variationPercentage.toFixed(1)}%</strong> 
                      {quantityValidation.variationType === 'over' ? ' acima' : ' abaixo'} do solicitado
                    </p>
                    <p className="mt-2 text-xs">
                      {quantityValidation.variationType === 'over' 
                        ? 'O comprador receberá uma notificação sobre esta quantidade extra.'
                        : 'Esta nova marca não atende completamente o pedido do comprador.'}
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            <div className="bg-orange-50/50 dark:bg-orange-950/20 p-4 rounded-lg space-y-3 border border-orange-200 dark:border-orange-800">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div><strong>Nova Marca:</strong> {brandName}</div>
                <div><strong>Para Produto:</strong> {product.name}</div>
                <div><strong>Embalagem:</strong> {packagingType}</div>
                <div><strong>Unidades por embalagem:</strong> {packagingType === 'granel' ? 'N/A' : unitsPerPackage}</div>
                <div><strong>Peso/Volume por embalagem:</strong> {(() => {
                  const isLiquidUnit = product.unit === 'Litro(s)' || product.unit === 'Mililitro(s)';
                  if (product.unit === 'Kilograma(s)' || product.unit === 'Litro(s)') {
                    if (packageWeight < 1 && packageWeight > 0) {
                      const gramas = Math.round(packageWeight * 1000);
                      return `${gramas}${isLiquidUnit ? 'ml' : 'g'}`;
                    }
                    return `${packageWeight.toFixed(3).replace('.', ',')}${isLiquidUnit ? 'L' : 'Kg'}`;
                  } else {
                    return `${packageWeight} ${isLiquidUnit ? 'L' : 'Kg'}`;
                  }
                })()}</div>
                <div><strong>Preço por embalagem:</strong> {formatCurrency(packagePrice)}</div>
                <div><strong>Quantidade a enviar:</strong> {flow.requiredPackages || 1} embalagem(s)</div>
                <div><strong>Imagem:</strong> {imageFile ? imageFile.name : 'Nenhuma'}</div>
              </div>
              <div className="border-t border-orange-200 dark:border-orange-700 pt-3">
                <div className="text-lg font-bold">Preço por unidade: {formatCurrency(pricePerUnit)}</div>
                <div className="text-sm text-muted-foreground mt-1">
                  Total oferecido: <strong>{offeredQuantity.toFixed(3)} {abbreviateUnit(product.unit)}</strong>
                </div>
                <div className="text-lg font-bold text-primary mt-2">Valor Total do Pedido: {formatCurrency(totalValue)}</div>
                <div className="text-sm text-orange-600 mt-1">Solicitação será enviada para aprovação</div>
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-orange-200">
              <Button
                variant="outline"
                onClick={() => cancelNewBrandFlow(productId)}
                disabled={isSubmittingNewBrand}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={() => completeNewBrandFlow(productId)}
                disabled={isSubmittingNewBrand}
                className="flex-1 bg-orange-600 hover:bg-orange-700"
              >
                {isSubmittingNewBrand ? 'Enviando...' : '✅ Enviar Proposta'}
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="p-4 border rounded-md bg-gradient-to-r from-orange-50/30 to-amber-50/30 dark:from-orange-950/20 dark:to-amber-950/20 border-orange-200 dark:border-orange-800 shadow-sm space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold text-orange-700 dark:text-orange-300">Nova Marca</h3>
          <p className="text-sm text-muted-foreground">Etapa {currentStep} de 8 - {product.name}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => cancelNewBrandFlow(productId)}
          disabled={isSubmittingNewBrand}
        >
          ✕
        </Button>
      </div>
      
      <div className="w-full bg-muted rounded-full h-2">
        <div 
          className="bg-orange-600 h-2 rounded-full transition-all duration-300" 
          style={{ width: `${(currentStep / 8) * 100}%` }}
        />
      </div>

      {renderStep()}
    </div>
  );
};

export default function SellerQuotationPage() {
  const router = useRouter();
  const params = useParams();
  const { user: sellerUser } = useAuth();
  const { toast } = useToast();
  const { speak, stop } = useVoiceAssistant();

  const quotationId = params.quotationId as string;
  const supplierId = params.supplierId as string; // ID of the supplier currently viewing the portal

  // PIN Authentication
  const { isAuthenticated, isLoading: authLoading, supplier, showPinModal, verifyPin } = useSupplierAuth(supplierId);

  const { notifications, markAsRead, isLoading: notificationsLoading } = useNotifications({
    targetSupplierId: supplierId,
    quotationId: quotationId,
    isRead: false
  });
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [currentSupplierDetails, setCurrentSupplierDetails] = useState<SupplierType | null>(null);
  const [productsToQuote, setProductsToQuote] = useState<ProductToQuoteVM[]>([]);
  const [pendingRequestsCache, setPendingRequestsCache] = useState<PendingBrandRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState<Record<string, boolean>>({});
  const [unseenAlerts, setUnseenAlerts] = useState<string[]>([]);
  const [weightInputValues, setWeightInputValues] = useState<Record<string, string>>({});
  const [expandedProductIds, setExpandedProductIds] = useState<string[]>([]);
  const [showStopQuotingModal, setShowStopQuotingModal] = useState(false);
  const [offerToStop, setOfferToStop] = useState<{productId: string, offerUiId: string, productName: string} | null>(null);
  const [stoppedQuotingProducts, setStoppedQuotingProducts] = useState<Set<string>>(new Set());
  const [editingOffers, setEditingOffers] = useState<Set<string>>(new Set()); // productId_offerUiId
  const [savingOffers, setSavingOffers] = useState<Set<string>>(new Set()); // productId_offerUiId
  const [activeCategoryTab, setActiveCategoryTab] = useState<string>("all");
  const [hasSpokenTabMessage, setHasSpokenTabMessage] = useState(false);

  // Estados para o fluxo guiado do vendedor
  const [vendorFlow, setVendorFlow] = useState<Record<string, {
    isActive: boolean;
    currentStep: number;
    selectedBrand: string;
    packagingType: 'caixa' | 'fardo' | 'granel' | '';
    unitsPerPackage: number;
    packageWeight: number;
    packagePrice: number;
    requiredPackages: number;
    showGuidedFlow: boolean;
  }>>({});

  // Estado para controlar o fluxo guiado de nova marca
  const [newBrandFlow, setNewBrandFlow] = useState<Record<string, {
    isActive: boolean;
    currentStep: number;
    brandName: string;
    packagingType: 'caixa' | 'fardo' | 'granel' | '';
    unitsPerPackage: number;
    packageWeight: number;
    packagePrice: number;
    requiredPackages: number;
    imageFile: File | null;
    showGuidedFlow: boolean;
  }>>({});

  // Estados para o wizard do vendedor
  const [wizardState, setWizardState] = useState<Record<string, {
    isActive: boolean;
    currentStep: number;
    selectedBrand: string;
    packagingType: 'caixa' | 'fardo' | 'granel' | '';
    unitsPerPackage: number;
    packageWeight: number;
    packagePrice: number;
    requiredPackages: number;
  }>>({});

  // Estados para o modal de nova marca
  const [newBrandModal, setNewBrandModal] = useState({
    isOpen: false,
    productId: '',
    productName: '',
    productUnit: '' as UnitOfMeasure | ''
  });
  const [newBrandForm, setNewBrandForm] = useState<NewBrandForm>({
    brandName: '',
    packagingDescription: '',
    unitsInPackaging: 0,
    unitWeight: 0,
    totalPackagingPrice: 0,
    imageFile: null
  });
  const [isSubmittingNewBrand, setIsSubmittingNewBrand] = useState(false);

  const brandInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const supplierDetailsCache = useRef(new Map<string, SupplierType>());
  const closingQuotationsRef = useRef(new Set<string>());
  const lastClickRef = useRef<{ action: string; timestamp: number } | null>(null);

  // Hook de cronômetro e auto-close da cotação
  const handleAutoCloseQuotation = useCallback(async (quotationId: string) => {
    if (closingQuotationsRef.current.has(quotationId)) {
        return;
    }
    closingQuotationsRef.current.add(quotationId);

    // Optimistic UI update
    const originalQuotationStatus = quotation?.status;
    setQuotation(prev => prev ? { ...prev, status: 'Fechada' } : null);

    const result = await closeQuotationAndItems(quotationId, quotation?.userId || '');
    if(result.success && (result.updatedItemsCount ?? 0) > 0) {
      toast({
        title: "Cotação Encerrada",
        description: "O prazo para esta cotação terminou. Não é mais possível enviar ou editar ofertas.",
      });
    } else if (!result.success) {
      setQuotation(prev => prev ? { ...prev, status: originalQuotationStatus || 'Aberta' } : null);
      toast({
        title: "Erro ao Encerrar Cotação",
        description: result.error || "Não foi possível encerrar a cotação automaticamente.",
        variant: "destructive"
      });
    }
    closingQuotationsRef.current.delete(quotationId);
  }, [toast, quotation, setQuotation]);

  const { timeLeft, isDeadlinePassed, isQuotationEnded } = useQuotationDeadline(quotation, handleAutoCloseQuotation);

  const productsWithMyOffers = useMemo(() => {
    const productIds = new Set<string>();
    productsToQuote.forEach(product => {
        if (product.supplierOffers.some(offer => offer.id)) {
            productIds.add(product.id);
        }
    });
    return productIds;
  }, [productsToQuote]);

  const productCategories = useMemo(() => {
    const categories = new Set<string>();
    productsToQuote.forEach(product => {
      if (product.categoryName) {
        categories.add(product.categoryName);
      }
    });
    return Array.from(categories).sort();
  }, [productsToQuote]);

  const filteredProducts = useMemo(() => {
    if (activeCategoryTab === "all") {
      return productsToQuote;
    }
    return productsToQuote.filter(p => p.categoryName === activeCategoryTab);
  }, [productsToQuote, activeCategoryTab]);

  const handleAcknowledgeMismatch = async (productId: string) => {
    if (!supplierId) {
      toast({ title: "Erro", description: "ID do fornecedor ausente.", variant: "destructive" });
      return;
    }
    try {
      const itemRef = doc(db, SHOPPING_LIST_ITEMS_COLLECTION, productId);
      await updateDoc(itemRef, {
        acknowledgedDeliveryMismatches: arrayUnion(supplierId)
      });
      // Optimistically update local state
      setProductsToQuote(prevProducts =>
        prevProducts.map(p =>
          p.id === productId
            ? { ...p, acknowledgedDeliveryMismatches: [...(p.acknowledgedDeliveryMismatches || []), supplierId] }
            : p
        )
      );
      toast({ title: "Confirmação Salva", description: "Sua confirmação de entrega foi registrada." });
    } catch (error: any) {
      toast({ title: "Erro ao Salvar Confirmação", description: error.message, variant: "destructive" });
    }
  };

  // Handlers de narração para o modal de nova marca
  const handleNewBrandBrandNameFocus = () => speak(voiceMessages.formFields.newBrand_brandName_prompt);
  const handleNewBrandPackagingFocus = () => speak(voiceMessages.formFields.newBrand_packaging_prompt);
  const handleNewBrandUnitsFocus = () => speak(voiceMessages.formFields.newBrand_units_prompt);
  const handleNewBrandPriceFocus = () => speak(voiceMessages.formFields.newBrand_price_prompt);
  const handleNewBrandImageFocus = () => speak(voiceMessages.formFields.newBrand_image_prompt);

  // Helper function to check and block actions when quotation is ended
  const checkAndBlockIfQuotationEnded = (): boolean => {
    if (isQuotationEnded) {
      toast({
        title: "Ação Bloqueada",
        description: "Não é possível adicionar marcas em cotações encerradas.",
        variant: "destructive"
      });
      return true; // Blocked
    }
    return false; // Allowed
  };

  // Funções para nova marca (agora usando fluxo guiado ao invés de modal)
  const openNewBrandModal = (productId: string, productName: string, productUnit: UnitOfMeasure) => {
    // Verificação de segurança: bloquear se cotação encerrada
    if (checkAndBlockIfQuotationEnded()) return;

    // Usar fluxo guiado ao invés de modal
    startNewBrandFlow(productId);

    // Manter dados do modal para compatibilidade (mas não abrir modal)
    setNewBrandModal({
      isOpen: false, // Modal fechado, usando fluxo guiado
      productId,
      productName,
      productUnit
    });
    speak("Ok, vamos solicitar uma nova marca. Vou te guiar passo a passo para criar uma proposta. Sua sugestão será enviada para o comprador analisar.");
  };

  const closeNewBrandModal = () => {
    setNewBrandModal({
      isOpen: false,
      productId: '',
      productName: '',
      productUnit: '' as UnitOfMeasure | ''
    });
    setNewBrandForm({
      brandName: '',
      packagingDescription: '',
      unitsInPackaging: 0,
      unitWeight: 0,
      totalPackagingPrice: 0,
      imageFile: null
    });
  };

  const handleNewBrandFormChange = (field: keyof typeof newBrandForm, value: any) => {
    setNewBrandForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const uploadImageToVercelBlob = async (file: File): Promise<string> => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      // Use filename as query parameter as expected by the API
      const filename = `brand-images/${Date.now()}-${file.name}`;
      const response = await fetch(`/api/upload?filename=${encodeURIComponent(filename)}`, {
        method: 'POST',
        body: file, // Send file directly, not FormData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Falha no upload da imagem');
      }

      const data = await response.json();
      return data.url;
    } catch (error: any) {
      throw new Error('Falha no upload da imagem: ' + error.message);
    }
  };

  const submitNewBrandRequest = async () => {
    if (!quotation || !currentSupplierDetails || !newBrandModal.productId) {
      toast({ title: "Erro", description: "Dados insuficientes para enviar solicitação.", variant: "destructive" });
      return;
    }

    if (!sellerUser?.uid) {
      toast({ title: "Erro de Autenticação", description: "Seu usuário não foi encontrado. Por favor, recarregue a página.", variant: "destructive" });
      return;
    }

    if (newBrandForm.unitsInPackaging <= 0 || newBrandForm.unitWeight <= 0 || newBrandForm.totalPackagingPrice <= 0) {
      toast({ title: "Erro", description: "Todos os campos são obrigatórios (Unidades > 0, Peso > 0, Preço > 0).", variant: "destructive" });
      return;
    }

    setIsSubmittingNewBrand(true);

    try {
      let imageUrl = '';
      if (newBrandForm.imageFile) {
        try {
          imageUrl = await uploadImageToVercelBlob(newBrandForm.imageFile);
        } catch (error: any) {
          // Image upload failed, continuing without image
        }
      }

      // No modal de nova marca, unitsInPackaging representa "Total Un na Emb" (unidades por embalagem)
      // O preço é da embalagem completa, então calculamos: preço_embalagem / (unidades × peso_unitário)
      const unitsPerPackage = newBrandForm.unitsInPackaging; // "Total Un na Emb"
      const pricePerUnit = newBrandForm.totalPackagingPrice / (unitsPerPackage * newBrandForm.unitWeight);

      const brandRequestData = {
        quotationId: quotation.id,
        productId: newBrandModal.productId,
        productName: newBrandModal.productName, // Added for notification context
        supplierId: supplierId,
        supplierName: currentSupplierDetails.empresa,
        supplierInitials: currentSupplierDetails.vendedor.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase(),
        brandName: newBrandForm.brandName.trim(),
        packagingDescription: newBrandForm.packagingDescription.trim() || formatPackaging(newBrandForm.unitsInPackaging, newBrandForm.unitWeight, newBrandModal.productUnit),
        unitsInPackaging: newBrandForm.unitsInPackaging,
        unitsPerPackage: newBrandForm.unitsInPackaging, // No modal, unitsInPackaging = unitsPerPackage
        unitWeight: newBrandForm.unitWeight,
        totalPackagingPrice: newBrandForm.totalPackagingPrice,
        pricePerUnit: pricePerUnit,
        imageUrl: imageUrl,
        imageFileName: newBrandForm.imageFile?.name || '',
        buyerUserId: quotation.userId, // ID do comprador
        sellerUserId: sellerUser?.uid || supplierId, // ID do vendedor (usa supplierId se não autenticado)
      };

      const response = await fetch('/api/brand-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(brandRequestData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Falha ao enviar solicitação');
      }

      const result = await response.json();

      // Check for notification error
      if (result.notificationError) {
        toast({
          title: "Solicitação Enviada com Aviso",
          description: `Marca enviada, mas notificação falhou: ${result.notificationError}`,
          variant: "default"
        });
      } else {
        toast({
          title: "Solicitação Enviada!",
          description: "Sua nova marca foi enviada para aprovação do comprador.",
          variant: "default"
        });
      }

      speak(voiceMessages.success.brandRequestSent);

      // Fechar modal, card e fluxo guiado
      closeNewBrandModal();
      if (newBrandModal.productId) {
        cancelNewBrandFlow(newBrandModal.productId);
      }

    } catch (error: any) {
      if (error.code === 'permission-denied') {
        toast({ 
          title: "Erro de Permissão", 
          description: "As regras do Firestore precisam ser atualizadas para permitir solicitações de marca. Entre em contato com o administrador.", 
          variant: "destructive" 
        });
      } else {
        toast({ 
          title: "Erro ao Enviar Solicitação", 
          description: error.message || "Erro desconhecido. Tente novamente.", 
          variant: "destructive" 
        });
      }
    } finally {
      setIsSubmittingNewBrand(false);
    }
  };

  // Main listener for the quotation document itself
  useEffect(() => {
    if (!quotationId) return;

    const quotationRef = doc(db, QUOTATIONS_COLLECTION, quotationId);
    const unsubscribe = onSnapshot(quotationRef, (docSnap) => {
      if (docSnap.exists()) {
        setQuotation({ id: docSnap.id, ...docSnap.data() } as Quotation);
      } else {
        toast({ title: "Cotação não encontrada.", variant: "destructive" });
        setQuotation(null);
      }
    });

    return () => unsubscribe();
  }, [quotationId, toast]);

  // Effect to load supplier details only (quotation and products load via real-time listeners)
  useEffect(() => {
    if (!quotationId || !supplierId) {
        setIsLoading(false);
        toast({ title: "Erro", description: "ID da cotação ou do fornecedor ausente.", variant: "destructive" });
        return;
    }
    setIsLoading(true);

    const fetchSupplierData = async () => {
      try {
        const supplierRef = doc(db, FORNECEDORES_COLLECTION, supplierId);
        const supplierSnap = await getDoc(supplierRef);
        if (!supplierSnap.exists()) throw new Error("Fornecedor não encontrado.");
        const fetchedSupplier = { id: supplierSnap.id, ...supplierSnap.data() } as SupplierType;
        setCurrentSupplierDetails(fetchedSupplier);
        supplierDetailsCache.current.set(supplierId, fetchedSupplier);

      } catch (error: any) {
        toast({ title: "Erro ao carregar dados", description: error.message, variant: "destructive" });
        speak(voiceMessages.error.loadFailed);
        setIsLoading(false);
      }
    };
    fetchSupplierData();
  }, [quotationId, supplierId, toast, speak]);

  // Handle priority notifications and welcome speech
  usePriorityNotificationHandler({
    isLoading,
    notificationsLoading,
    hasSpokenTabMessage,
    notifications,
    productsToQuote,
    currentSupplierDetails,
    markAsRead,
    speak,
    setHasSpokenTabMessage,
  });

  // Effect to listen for brand requests
  // NOTE: Approved brands automatically become offers and are not shown here
  // Only pending (orange) and rejected (red) requests are displayed
  useEffect(() => {
    if (!quotationId || !supplierId) return;

    const brandRequestsQuery = query(
      collection(db, PENDING_BRAND_REQUESTS_COLLECTION),
      where("quotationId", "==", quotationId),
      where("supplierId", "==", supplierId)
      // Query all statuses but filter client-side to show only pending/rejected
    );

    const unsubscribe = onSnapshot(brandRequestsQuery, (snapshot) => {
      const brandRequests = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as PendingBrandRequest));

      // Filtrar apenas pending e rejected (approved vira oferta automaticamente)
      const visibleRequests = brandRequests.filter(req => req.status === 'pending' || req.status === 'rejected');

      console.log('🔵 [Brand Requests] Total recebidas:', brandRequests.length);
      console.log('🔵 [Brand Requests] Visíveis (pending/rejected):', visibleRequests.length);
      console.log('🔵 [Brand Requests] Status:', brandRequests.map(r => ({ id: r.id, brand: r.brandName, status: r.status })));

      // Armazena no cache para uso na carga inicial de produtos
      setPendingRequestsCache(visibleRequests);

      // Update products to include visible brand requests (se já existem produtos)
      setProductsToQuote(prevProducts => {
        if (prevProducts.length === 0) {
          return prevProducts;
        }

        return prevProducts.map(product => {
          const productBrandRequests = visibleRequests.filter(req => req.productId === product.id);
          return {
            ...product,
            pendingBrandRequests: productBrandRequests // Mantém o nome do campo por compatibilidade
          };
        });
      });
    });

    return () => unsubscribe();
  }, [quotationId, supplierId]);

  // Effect to listen for real-time changes in shopping_list_items (initial load + updates)
  useEffect(() => {
    if (!quotationId || !currentSupplierDetails) return;

    const shoppingListItemsQuery = query(
      collection(db, SHOPPING_LIST_ITEMS_COLLECTION),
      where("quotationId", "==", quotationId)
    );

    const unsubscribe = onSnapshot(shoppingListItemsQuery, (snapshot) => {
      const supplierDeliveryDays = currentSupplierDetails.diasDeEntrega || [];

      setProductsToQuote(prevProducts => {
        // Initial load: prevProducts is empty
        if (prevProducts.length === 0) {
          const initialProducts = snapshot.docs.map(docSnap => {
            const itemData = docSnap.data() as ShoppingListItem;

            let isMismatch = false;
            if (itemData.hasSpecificDate && itemData.deliveryDate) {
              const deliveryDate = itemData.deliveryDate.toDate();
              const deliveryDay = dayMap[deliveryDate.getDay()];
              isMismatch = !supplierDeliveryDays.includes(deliveryDay);
            }

            // Aplica pending requests do cache se existirem
            const productPendingRequests = pendingRequestsCache.filter(req => req.productId === docSnap.id);

            return {
              ...itemData,
              id: docSnap.id,
              supplierOffers: [],
              bestOffersByBrand: [],
              lowestPriceThisProductHas: null,
              isDeliveryDayMismatch: isMismatch,
              counterProposalInfo: null,
              isLockedOut: false,
              pendingBrandRequests: productPendingRequests
            } as ProductToQuoteVM;
          }).sort((a, b) => a.name.localeCompare(b.name));

          // Set loading to false after initial products load
          setIsLoading(false);
          return initialProducts;
        }

        // Update existing products with new data (e.g., preferredBrands changes)
        const updatedProducts = prevProducts.map(product => {
          const updatedDoc = snapshot.docs.find(doc => doc.id === product.id);
          if (updatedDoc) {
            const updatedData = updatedDoc.data() as ShoppingListItem;
            return {
              ...product,
              preferredBrands: updatedData.preferredBrands,
              updatedAt: updatedData.updatedAt,
              // Preserva dados que vêm de outros listeners
              pendingBrandRequests: product.pendingBrandRequests || []
            };
          }
          return product;
        });

        return updatedProducts;
      });
    });

    return () => unsubscribe();
  }, [quotationId, currentSupplierDetails]);

  useEffect(() => {
    if (!quotationId || !supplierId || productsToQuote.length === 0 || !currentSupplierDetails || isLoading || !quotation) return ()=>{};

    // OPTIMIZED: Single listener for ALL offers in this quotation using collectionGroup
    const offersCollectionGroupQuery = query(
      collectionGroup(db, 'offers'),
      where('quotationId', '==', quotationId)
    );

    const unsubscribe = onSnapshot(offersCollectionGroupQuery, async (offersSnapshot) => {
      const snapshotStartTime = performance.now();

      // Group offers by productId
      const offersByProduct = new Map<string, Offer[]>();
      offersSnapshot.docs.forEach(doc => {
        const offerData = { ...doc.data() as Offer, id: doc.id, uiId: doc.id };
        // Extract productId from document path: quotations/{quotationId}/products/{productId}/offers/{offerId}
        const pathParts = doc.ref.path.split('/');
        const productId = pathParts[3]; // Index 3 is the productId

        if (!offersByProduct.has(productId)) {
          offersByProduct.set(productId, []);
        }
        offersByProduct.get(productId)!.push(offerData);
      });

      // Fetch new supplier details (all at once)
      const fetchStartTime = performance.now();
      const allOffers = offersSnapshot.docs.map(doc => doc.data() as Offer);
      const newSupplierIdsToFetch = new Set<string>();
      allOffers.forEach(offer => {
        if (offer.supplierId && !supplierDetailsCache.current.has(offer.supplierId)) {
          newSupplierIdsToFetch.add(offer.supplierId);
        }
      });

      if (newSupplierIdsToFetch.size > 0) {
        const fetchPromises = Array.from(newSupplierIdsToFetch).map(async (sid) => {
          try {
            const supplierDoc = await getDoc(doc(db, FORNECEDORES_COLLECTION, sid));
            if (supplierDoc.exists()) {
              supplierDetailsCache.current.set(sid, { ...supplierDoc.data(), id: sid } as SupplierType);
            }
          } catch (err) {
            // Error fetching supplier details
          }
        });
        await Promise.all(fetchPromises);
        const fetchEndTime = performance.now();
      }

      // Process each product's offers
      const listenerStartTime = performance.now();
      setProductsToQuote(currentProducts => {
        return currentProducts.map(product => {
          const offersData = offersByProduct.get(product.id) || [];

          if (offersData.length === 0) return product; // No offers for this product

          // Group offers by brand for this product
          const offersGroupedByBrand = new Map<string, Offer[]>();
          offersData.forEach(offer => {
          if(offer.pricePerUnit > 0) {
            if (!offersGroupedByBrand.has(offer.brandOffered)) {
              offersGroupedByBrand.set(offer.brandOffered, []);
            }
            offersGroupedByBrand.get(offer.brandOffered)!.push(offer);
          }
        });

        const brandDisplays: BestOfferForBrandDisplay[] = [];
        const myOfferBrands = new Set<string>();

        offersGroupedByBrand.forEach((offers, brandName) => {
          if (offers.length === 0) return;

          const bestOffer = offers.reduce((prev, curr) => prev.pricePerUnit < curr.pricePerUnit ? prev : curr);

          const supplierDetails = supplierDetailsCache.current.get(bestOffer.supplierId);
          if (supplierDetails) {
            brandDisplays.push({
              brandName,
              pricePerUnit: bestOffer.pricePerUnit,
              supplierId: bestOffer.supplierId,
              supplierName: supplierDetails.empresa,
              supplierInitials: supplierDetails.empresa.substring(0, 2).toUpperCase(),
              supplierFotoUrl: supplierDetails.fotoUrl,
              supplierFotoHint: supplierDetails.fotoHint,
              vendedor: supplierDetails.vendedor,
              cnpj: supplierDetails.cnpj,
              packagingDescription: bestOffer.packagingDescription,
              unitsInPackaging: bestOffer.unitsInPackaging,
              unitWeight: bestOffer.unitWeight,
              totalPackagingPrice: bestOffer.totalPackagingPrice,
              isSelf: bestOffer.supplierId === supplierId,
              productUnit: product.unit,
            });

            if (bestOffer.supplierId === supplierId) {
              myOfferBrands.add(brandName);
            }
          }

          // If my offer is not the best for this brand, add it separately
          const myOfferForBrand = offers.find(o => o.supplierId === supplierId);

          if (myOfferForBrand && myOfferForBrand.id !== bestOffer.id) {
            const mySupplierDetails = supplierDetailsCache.current.get(supplierId);
            if (mySupplierDetails) {
              brandDisplays.push({
                brandName,
                pricePerUnit: myOfferForBrand.pricePerUnit,
                supplierId,
                supplierName: mySupplierDetails.empresa,
                supplierInitials: mySupplierDetails.empresa.substring(0, 2).toUpperCase(),
                supplierFotoUrl: mySupplierDetails.fotoUrl,
                supplierFotoHint: mySupplierDetails.fotoHint,
                vendedor: mySupplierDetails.vendedor,
                cnpj: mySupplierDetails.cnpj,
                packagingDescription: myOfferForBrand.packagingDescription,
                unitsInPackaging: myOfferForBrand.unitsInPackaging,
                unitWeight: myOfferForBrand.unitWeight,
                totalPackagingPrice: myOfferForBrand.totalPackagingPrice,
                isSelf: true,
                productUnit: product.unit,
              });
              myOfferBrands.add(brandName);
            }
          }
        });
        brandDisplays.sort((a, b) => a.pricePerUnit - b.pricePerUnit || a.brandName.localeCompare(b.brandName));

          const lowestPriceOverall = brandDisplays.length > 0 ? brandDisplays[0].pricePerUnit : null;
          const myOffers = offersData.filter(o => o.supplierId === supplierId).map(o => ({...o, uiId: o.id!}));

          // Calcula contraproposta e lockout usando hook
          const { counterProposalInfo, isLockedOut } = calculateCounterProposalStatus(
            quotation,
            supplierId,
            offersData,
            lowestPriceOverall
          );

          // Get local offers that are not yet saved to Firestore
          const localUnsavedOffers = product.supplierOffers.filter(o => !o.id);

          // From the unsaved local offers, filter out any that now exist in Firestore
          const trulyLocalOffers = localUnsavedOffers.filter(localOffer => {
            const hasMatchInFirestore = myOffers.some(firestoreOffer =>
              firestoreOffer.brandOffered === localOffer.brandOffered &&
              firestoreOffer.supplierId === localOffer.supplierId &&
              Number(firestoreOffer.totalPackagingPrice) === Number(localOffer.totalPackagingPrice) &&
              Number(firestoreOffer.unitsInPackaging) === Number(localOffer.unitsInPackaging) &&
              firestoreOffer.packagingDescription === localOffer.packagingDescription
            );
            return !hasMatchInFirestore;
          });

          // The new list of offers is the one from Firestore plus any truly local ones that haven't been saved
          const updatedOffers = [...myOffers, ...trulyLocalOffers].sort((a, b) => (a.brandOffered || '').localeCompare(b.brandOffered || ''));

          return {
            ...product,
            supplierOffers: updatedOffers,
            bestOffersByBrand: brandDisplays,
            lowestPriceThisProductHas: lowestPriceOverall,
            counterProposalInfo,
            isLockedOut
          };
        });
      });

      const listenerEndTime = performance.now();
      const totalListenerTime = listenerEndTime - snapshotStartTime;
    }, (error) => {
      // Error in SINGLE offers listener
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quotationId, supplierId, currentSupplierDetails, toast, isLoading, quotation]);
  
  // Hook de lembretes de contraproposta
  useCounterProposalReminders(productsToQuote, quotation, currentSupplierDetails);

  // Effect for voice narration when user actively changes tabs
  useEffect(() => {
    if (hasSpokenTabMessage) {
      const tabMessages: Record<string, string> = {
        all: voiceMessages.tabs.all,
        obrigatorios: voiceMessages.tabs.required,
        opcionais: voiceMessages.tabs.optional,
        enviados: voiceMessages.tabs.sent,
      };

      const message = tabMessages[activeCategoryTab];
      if (message) {
        speak(message);
      }
    }
  }, [activeCategoryTab, hasSpokenTabMessage, speak]);

  const toggleProductExpansion = (productId: string) => {
    const wasExpanded = expandedProductIds.includes(productId);

    if (wasExpanded) {
      stop(); // Interrompe a fala se o card estiver sendo fechado
    }

    setExpandedProductIds(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [productId]
    );

    // Narração ao expandir (não ao colapsar)
    if (!wasExpanded) {
      const product = productsToQuote.find(p => p.id === productId);
      if (product) {
        // Verifica se já tem ofertas salvas do fornecedor atual
        const myOffers = product.supplierOffers.filter(o => o.id && o.supplierId === supplierId);

        if (myOffers.length > 0) {
          // Já tem oferta(s) enviada(s)
          const hasMultipleOffers = myOffers.length > 1;

          // Verifica se está ganhando ou perdendo
          const myBestPrice = Math.min(...myOffers.map(o => o.pricePerUnit));
          const competitorBestOffer = product.bestOffersByBrand.find(b => !b.isSelf);

          const isWinning = !competitorBestOffer || myBestPrice < competitorBestOffer.pricePerUnit;
          const competitorPriceStr = competitorBestOffer
            ? formatCurrency(competitorBestOffer.pricePerUnit)
            : undefined;

          speak(voiceMessages.actions.itemExpandedWithOffer(
            product.name,
            hasMultipleOffers,
            isWinning,
            competitorPriceStr
          ));
        } else {
          // Ainda não tem oferta enviada
          const hasDeliveryMismatch = Boolean(product.hasSpecificDate && product.isDeliveryDayMismatch);
          speak(voiceMessages.actions.itemExpanded(product.name, hasDeliveryMismatch));
        }
      }
    }
  };

  // Funções para o fluxo guiado do vendedor
  const initVendorFlow = (productId: string, brandName: string) => {
    const flowKey = `${productId}_vendor_flow`;
    setVendorFlow(prev => ({
      ...prev,
      [flowKey]: {
        isActive: true,
        currentStep: 1,
        selectedBrand: brandName,
        packagingType: '',
        unitsPerPackage: 0,
        packageWeight: 0,
        packagePrice: 0,
        requiredPackages: 0,
        showGuidedFlow: true
      }
    }));
  };

  const updateVendorFlowStep = (productId: string, field: string, value: any, nextStep?: number) => {
    const flowKey = `${productId}_vendor_flow`;
    setVendorFlow(prev => ({
      ...prev,
      [flowKey]: {
        ...prev[flowKey],
        [field]: value,
        currentStep: nextStep || prev[flowKey]?.currentStep || 1
      }
    }));
  };

  const completeVendorFlow = async (productId: string) => {
    const flowKey = `${productId}_vendor_flow`;
    const flow = vendorFlow[flowKey];
    
    if (!flow || !currentSupplierDetails || !quotation) return;

    const product = productsToQuote.find(p => p.id === productId);
    if (!product) return;

    // Verificar dados básicos
    if (!flow.selectedBrand.trim() || flow.requiredPackages <= 0 || flow.packageWeight <= 0 || flow.packagePrice <= 0) {
      toast({
        title: "Dados Inválidos", 
        description: "Todos os campos devem estar preenchidos corretamente.", 
        variant: "destructive"
      });
      return;
    }

    // Criar nova oferta com dados do fluxo guiado
    const newOfferUiId = Date.now().toString() + Math.random().toString(36).substring(2,7);
    const pricePerUnit = flow.packagePrice / ((flow.unitsPerPackage || 1) * (flow.packageWeight || 1));
    
    const newOffer: OfferWithUI = {
      uiId: newOfferUiId,
      quotationId: quotationId,
      supplierId: supplierId,
      supplierName: currentSupplierDetails.empresa || "N/A",
      supplierInitials: currentSupplierDetails.empresa?.substring(0, 2).toUpperCase() || "XX",
      brandOffered: flow.selectedBrand,
      packagingDescription: `${flow.requiredPackages} ${flow.packagingType}(s)`,
      unitsInPackaging: flow.requiredPackages,
      unitsPerPackage: flow.unitsPerPackage,
      unitWeight: flow.packageWeight,
      totalPackagingPrice: flow.packagePrice,
      pricePerUnit: pricePerUnit,
      updatedAt: serverTimestamp() as Timestamp,
      productId: productId,
      isSuggestedBrand: false,
    };

    // Verificar variação de quantidade
    const offeredQuantity = calculateTotalOfferedQuantity(newOffer, product);
    const requestedQuantity = product.quantity;
    const quantityValidation = validateQuantityVariation(offeredQuantity, requestedQuantity);
    
    // Se há variação significativa, registrar para possível notificação futura
    if (!quantityValidation.isValid && quotation) {
      // Mostrar toast informativo para o fornecedor
      toast({
        title: "Variação de Quantidade Detectada",
        description: `Sua oferta tem ${quantityValidation.variationPercentage.toFixed(1)}% de variação ${quantityValidation.variationType === 'over' ? 'acima' : 'abaixo'} do pedido.`,
        duration: 5000,
      });
    }

    try {
      // Salvar automaticamente no Firestore
      const offerPayload: Omit<Offer, 'id'> = {
        quotationId: quotationId,
        supplierId: currentSupplierDetails.id,
        supplierName: currentSupplierDetails.empresa,
        supplierInitials: currentSupplierDetails.empresa.substring(0, 2).toUpperCase(),
        brandOffered: flow.selectedBrand,
        packagingDescription: `${flow.requiredPackages} ${flow.packagingType}(s)`,
        unitsInPackaging: flow.requiredPackages,
        unitsPerPackage: flow.unitsPerPackage,
        unitWeight: flow.packageWeight,
        totalPackagingPrice: flow.packagePrice,
        pricePerUnit: pricePerUnit,
        updatedAt: serverTimestamp() as Timestamp,
        productId: productId,
      };

      const offerCollectionRef = collection(db, `quotations/${quotationId}/products/${productId}/offers`);
      const newOfferDocRef = await addDoc(offerCollectionRef, offerPayload);

      // Atualizar estado local com a oferta salva (incluindo o ID do Firestore)
      const savedOffer: OfferWithUI = {
        ...newOffer,
        id: newOfferDocRef.id, // Incluir o ID do Firestore
      };

      setProductsToQuote(prevProducts =>
        prevProducts.map(p => {
          if (p.id === productId) {
            return {
              ...p,
              supplierOffers: [...p.supplierOffers, savedOffer],
            };
          }
          return p;
        })
      );

      // Toast de sucesso
      toast({ 
        title: "Oferta Confirmada e Salva!", 
        description: `Sua oferta para ${product.name} (${flow.selectedBrand}) foi salva automaticamente.`,
        duration: 4000
      });

      // Narração de sucesso
      setTimeout(() => speak(voiceMessages.success.offerSaved), 0);

    } catch (error: any) {
      // Em caso de erro, ainda adicionar ao estado local para não perder o trabalho
      setProductsToQuote(prevProducts =>
        prevProducts.map(p => {
          if (p.id === productId) {
            return {
              ...p,
              supplierOffers: [...p.supplierOffers, newOffer],
            };
          }
          return p;
        })
      );

      toast({ 
        title: "Erro ao Salvar Automaticamente", 
        description: `A oferta foi criada localmente, mas houve erro ao salvar: ${error.message}. Use "Salvar Nova Oferta" para tentar novamente.`,
        variant: "destructive",
        duration: 7000
      });
    } finally {
      // Limpar o fluxo independente do resultado
      setVendorFlow(prev => {
        const newFlow = { ...prev };
        delete newFlow[flowKey];
        return newFlow;
      });
    }
  };

  const cancelVendorFlow = (productId: string) => {
    const flowKey = `${productId}_vendor_flow`;
    setVendorFlow(prev => {
      const newFlow = { ...prev };
      delete newFlow[flowKey];
      return newFlow;
    });
  };

  // Funções para controlar o fluxo guiado de nova marca
  const startNewBrandFlow = (productId: string) => {
    const flowKey = `${productId}_brand_flow`;
    setNewBrandFlow(prev => ({
      ...prev,
      [flowKey]: {
        isActive: true,
        currentStep: 1,
        brandName: '',
        packagingType: '',
        unitsPerPackage: 0,
        packageWeight: 0,
        packagePrice: 0,
        requiredPackages: 0,
        imageFile: null,
        showGuidedFlow: true
      }
    }));
    // Fechar modal se estiver aberto
    closeNewBrandModal();
  };

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

  const cancelNewBrandFlow = (productId: string) => {
    const flowKey = `${productId}_brand_flow`;
    setNewBrandFlow(prev => {
      const newFlow = { ...prev };
      delete newFlow[flowKey];
      return newFlow;
    });
  };

  const completeNewBrandFlow = async (productId: string) => {
    const flowKey = `${productId}_brand_flow`;
    const flow = newBrandFlow[flowKey];
    
    if (!flow || !currentSupplierDetails || !quotation) return;

    const product = productsToQuote.find(p => p.id === productId);
    if (!product) return;

    // Verificar se os dados atendem à quantidade solicitada
    const tempBrandOffer = {
      unitsInPackaging: flow.requiredPackages || 1, // Usar a quantidade informada pelo vendedor
      unitsPerPackage: flow.packagingType === 'granel' ? 1 : flow.unitsPerPackage,
      unitWeight: flow.packageWeight
    };
    
    const offeredQuantity = calculateTotalOfferedQuantity(tempBrandOffer as any, product);
    const requestedQuantity = product.quantity;
    const quantityValidation = validateQuantityVariation(offeredQuantity, requestedQuantity);
    
    // Se há variação significativa, mostrar toast informativo
    if (!quantityValidation.isValid) {
      toast({
        title: "Variação de Quantidade Detectada",
        description: `Sua nova marca tem ${quantityValidation.variationPercentage.toFixed(1)}% de variação ${quantityValidation.variationType === 'over' ? 'acima' : 'abaixo'} do pedido.`,
        duration: 5000,
      });
    }

    // Verificar dados básicos
    if (!flow.brandName.trim() || flow.unitsPerPackage <= 0 || flow.packageWeight <= 0 || flow.packagePrice <= 0 || flow.requiredPackages <= 0) {
      toast({
        title: "Dados Inválidos", 
        description: "Todos os campos devem estar preenchidos corretamente.", 
        variant: "destructive"
      });
      return;
    }

    try {
      setIsSubmittingNewBrand(true);

      // Upload da imagem se fornecida
      let imageUrl = '';
      if (flow.imageFile) {
        imageUrl = await uploadImageToVercelBlob(flow.imageFile);
      }

      // Calcular preço por unidade
      const pricePerUnit = flow.packagePrice / (flow.unitsPerPackage * flow.packageWeight);

      // Criar request de nova marca usando a API
      const brandRequestData = {
        quotationId: quotationId,
        productId: productId,
        productName: product.name,
        supplierId: currentSupplierDetails.id,
        supplierName: currentSupplierDetails.empresa,
        supplierInitials: currentSupplierDetails.vendedor.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase(),
        brandName: flow.brandName,
        packagingDescription: `${flow.unitsPerPackage} unidades por embalagem`,
        unitsInPackaging: flow.requiredPackages || 1,
        unitsPerPackage: flow.unitsPerPackage,
        unitWeight: flow.packageWeight,
        totalPackagingPrice: flow.packagePrice,
        pricePerUnit: pricePerUnit,
        imageUrl: imageUrl,
        imageFileName: flow.imageFile?.name || '',
        buyerUserId: quotation.userId,
        sellerUserId: sellerUser?.uid || currentSupplierDetails.id
      };

      console.log('\n🟢 [completeNewBrandFlow] Enviando para API /api/brand-request');
      console.log('🟢 [completeNewBrandFlow] Dados:', brandRequestData);

      // Enviar para API que cria a brand request E a notificação
      const response = await fetch('/api/brand-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(brandRequestData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Falha ao enviar solicitação');
      }

      const result = await response.json();
      console.log('✅ [completeNewBrandFlow] Resposta da API:', result);

      // Check for notification error
      if (result.notificationError) {
        console.error('🚨 [completeNewBrandFlow] Notification failed:', result.notificationError);
      }

      toast({ 
        title: "Solicitação Enviada!", 
        description: "Sua nova marca foi enviada para aprovação do comprador.",
        variant: "default"
      });

      speak(voiceMessages.success.brandRequestSent);

      // Limpar o fluxo
      cancelNewBrandFlow(productId);

    } catch (error: any) {
      toast({
        title: "Erro ao Enviar Solicitação",
        description: error.message || "Erro desconhecido. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsSubmittingNewBrand(false);
    }
  };

  const handleOfferChange = (productId: string, offerUiId: string, field: keyof OfferWithUI, value: string | number | boolean) => {
    setProductsToQuote(prevProducts =>
      prevProducts.map(p =>
        p.id === productId
          ? {
              ...p,
              supplierOffers: p.supplierOffers.map((offer) =>
                offer.uiId === offerUiId ? { ...offer, [field]: value, updatedAt: serverTimestamp() as Timestamp } : offer
              ),
            }
          : p
      )
    );
  };

  // Handlers de narração para campos do formulário
  const handlePackagingDescriptionBlur = (productId: string, offerUiId: string) => {
    const product = productsToQuote.find(p => p.id === productId);
    const offer = product?.supplierOffers.find(o => o.uiId === offerUiId);
    if (offer && offer.packagingDescription.trim()) {
      speak(voiceMessages.formFields.packagingDescriptionFilled);
    }
  };

  const handleUnitsInPackagingFocus = (productId: string) => {
    const product = productsToQuote.find(p => p.id === productId);
    if (product) {
      speak(voiceMessages.formFields.unitsInPackagingPrompt(product.unit, product.name || ''));
    }
  };

  const handleUnitsInPackagingBlur = () => {
    speak(voiceMessages.formFields.unitsInPackagingFilled);
  };

  const handlePriceFocus = (productId: string) => {
    const product = productsToQuote.find(p => p.id === productId);
    if (product) {
      speak(voiceMessages.formFields.pricePrompt(product.unit));
    }
  };

  const handlePriceBlur = (productId: string, offerUiId: string) => {
    const product = productsToQuote.find(p => p.id === productId);
    const offer = product?.supplierOffers.find(o => o.uiId === offerUiId);
    if (offer && product && offer.totalPackagingPrice > 0) {
      const priceFormatted = formatCurrency(offer.totalPackagingPrice);
      speak(voiceMessages.formFields.priceFilled(product.name, offer.brandOffered, priceFormatted, product.unit));
    }
  };

  const handlePriceChange = (productId: string, offerUiId: string, inputValue: string) => {
    // Parse centavos do input formatado
    const centavos = parseCurrencyInput(inputValue);
    // Converte para valor decimal para armazenamento
    const decimalValue = centavos / 100;
    // Atualiza o estado com o valor decimal
    handleOfferChange(productId, offerUiId, 'totalPackagingPrice', decimalValue);
  };

  const handleWeightChange = (e: React.ChangeEvent<HTMLInputElement>, product: ProductToQuoteVM, offer: OfferWithUI) => {
    const inputValue = e.target.value;
    const key = `${product.id}_${offer.uiId}`;

    // Para Kg e Litros: usuário digita em gramas/ml, sistema converte para Kg/L
    if (product.unit === 'Kilograma(s)' || product.unit === 'Litro(s)') {
      const gramas = parseWeightInputForKg(inputValue);
      const kg = gramas / 1000;

      // Atualiza o display value (formatado com vírgula)
      const formattedValue = formatWeightInputForKg(gramas);
      setWeightInputValues(prev => ({ ...prev, [key]: formattedValue }));

      // Atualiza o valor real em Kg/L
      handleOfferChange(product.id, offer.uiId, 'unitWeight', kg);
    } else {
      // Para outras unidades: valor direto
      const numericValue = parseFloat(inputValue.replace(',', '.')) || 0;
      handleOfferChange(product.id, offer.uiId, 'unitWeight', numericValue);
    }
  };

  const getWeightDisplayValue = (product: ProductToQuoteVM, offer: OfferWithUI): string => {
    const key = `${product.id}_${offer.uiId}`;

    // Para Kg/L: usa o valor formatado do state
    if (product.unit === 'Kilograma(s)' || product.unit === 'Litro(s)') {
      if (weightInputValues[key] !== undefined) {
        return weightInputValues[key];
      }
      // Valor inicial: converte Kg para gramas e formata
      if (offer.unitWeight) {
        const gramas = Math.round(offer.unitWeight * 1000);
        return formatWeightInputForKg(gramas);
      }
      return '0,000';
    }

    // Para outras unidades: valor direto
    return offer.unitWeight?.toString().replace('.', ',') || '';
  };

  const handleStopQuotingClick = (productId: string, offerUiId: string, productName: string) => {
    setOfferToStop({ productId, offerUiId, productName });
    setShowStopQuotingModal(true);
  };

  const confirmStopQuoting = async () => {
    if (!offerToStop) return;

    const { productId, offerUiId } = offerToStop;
    const product = productsToQuote.find(p => p.id === productId);
    const offer = product?.supplierOffers.find(o => o.uiId === offerUiId);

    if (offer && offer.id) {
      // Remove a oferta do banco de dados
      await removeOfferField(productId, offer);
    }

    // Marca o produto como "parado de cotar"
    setStoppedQuotingProducts(prev => new Set(prev).add(productId));

    setShowStopQuotingModal(false);
    setOfferToStop(null);
    toast({
      title: "Parou de Cotar",
      description: `Você parou de cotar "${offerToStop.productName}". Não poderá mais fazer ofertas para este item nesta cotação.`,
    });
  };

  const toggleEditMode = (productId: string, offerUiId: string) => {
    const editKey = `${productId}_${offerUiId}`;
    setEditingOffers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(editKey)) {
        newSet.delete(editKey);
      } else {
        newSet.add(editKey);
      }
      return newSet;
    });
  };

  const isInEditMode = (productId: string, offerUiId: string): boolean => {
    return editingOffers.has(`${productId}_${offerUiId}`);
  };

  const addOfferField = (productId: string, brandToPreFill?: string, isSuggested?: boolean) => {

    // Prevent duplicate execution
    const executionKey = `addOffer-${productId}-${brandToPreFill}-${isSuggested}`;
    if (lastClickRef.current?.action === executionKey && Date.now() - lastClickRef.current.timestamp < 500) {
      return;
    }
    lastClickRef.current = { action: executionKey, timestamp: Date.now() };

    if (!currentSupplierDetails) {
        toast({title: "Erro", description: "Dados do fornecedor não carregados.", variant: "destructive"});
        return;
    }

    if (!expandedProductIds.includes(productId)) {
      setExpandedProductIds(prev => [...prev, productId]);
    }

    const newOfferUiId = Date.now().toString() + Math.random().toString(36).substring(2,7);

    setProductsToQuote(prevProducts => {
      const targetProduct = prevProducts.find(p => p.id === productId);
      if (targetProduct) {
      }
      const updatedProducts = prevProducts.map(p => {
        if (p.id === productId) {
            const newOffer: OfferWithUI = {
                uiId: newOfferUiId,
                quotationId: quotationId, // Adicionar campo obrigatório
                supplierId: supplierId,
                supplierName: currentSupplierDetails.empresa || "N/A",
                supplierInitials: currentSupplierDetails.empresa.substring(0, 2).toUpperCase() || "XX",
                brandOffered: brandToPreFill || "",
                packagingDescription: "",
                unitsInPackaging: 0,
                unitsPerPackage: 0,
                unitWeight: 0,
                totalPackagingPrice: 0,
                pricePerUnit: 0,
                updatedAt: serverTimestamp() as Timestamp,
                productId: productId,
                isSuggestedBrand: isSuggested || false,
            };

            const updatedProduct = {
                ...p,
                supplierOffers: [...p.supplierOffers, newOffer],
            };
             // Don't auto-focus for suggested brands - they should appear pre-filled but not editable
             if (!brandToPreFill) {
               setTimeout(() => {
                  const brandInputRef = brandInputRefs.current[`${productId}_${newOfferUiId}`];
                  brandInputRef?.focus();
              }, 0);
             } else {
             }
            return updatedProduct;
        }
        return p;
      });
      return updatedProducts;
    });
  };
  
  const removeOfferField = async (productId: string, offerToRemove: OfferWithUI) => {
    if (offerToRemove.id) { 
        setIsSaving(prev => ({ ...prev, [`${productId}_${offerToRemove.uiId}`]: true }));
        try {
            const offerRef = doc(db, `quotations/${quotationId}/products/${productId}/offers/${offerToRemove.id}`);
            await deleteDoc(offerRef);
            toast({ title: "Oferta Removida", description: "A oferta foi removida do banco de dados." });
        } catch (error: any) {
            toast({ title: "Erro ao Remover", description: error.message, variant: "destructive" });
            setIsSaving(prev => ({ ...prev, [`${productId}_${offerToRemove.uiId}`]: false }));
            return; 
        } finally {
             setIsSaving(prev => ({ ...prev, [`${productId}_${offerToRemove.uiId}`]: false }));
        }
    }
    setProductsToQuote(prevProducts =>
      prevProducts.map(p =>
        p.id === productId
          ? { ...p, supplierOffers: p.supplierOffers.filter(offer => offer.uiId !== offerToRemove.uiId) }
          : p
      )
    );
  };

  const handleSuggestedBrandClick = (productId: string, brandName: string) => {
    // Verificação de segurança: bloquear se cotação encerrada
    if (checkAndBlockIfQuotationEnded()) return;

    // Iniciar o fluxo guiado do vendedor
    initVendorFlow(productId, brandName);

    // Narração após selecionar marca
    const product = productsToQuote.find(p => p.id === productId);
    if (product) {
      speak(voiceMessages.actions.brandSelected(brandName, product.unit));
    }
  };

  const handleOtherBrandClick = (productId: string) => {
    // Debounce rapid clicks
    const now = Date.now();
    const actionKey = `other-${productId}`;

    if (lastClickRef.current?.action === actionKey && now - lastClickRef.current.timestamp < 300) {
      return;
    }
    lastClickRef.current = { action: actionKey, timestamp: now };

    const product = productsToQuote.find(p => p.id === productId);
    if (!product) return;

    const unsavedOfferIndex = product.supplierOffers.findIndex(o => !o.id);

    if (unsavedOfferIndex === -1) {
        // Only add a new field if there are no unsaved offers
        addOfferField(productId, '', false);
    } else {
        // Convert existing unsaved offer to "other brand" (clear brand and make editable)
        const currentOffer = product.supplierOffers[unsavedOfferIndex];

        // Prevent double execution
        const conversionKey = `convertOther-${productId}-${currentOffer.uiId}`;
        if (lastClickRef.current?.action === conversionKey && Date.now() - lastClickRef.current.timestamp < 200) {
          return;
        }
        lastClickRef.current = { action: conversionKey, timestamp: Date.now() };

        setProductsToQuote(prevProducts => {
          const result = prevProducts.map(p => {
            if (p.id === productId) {
              const updatedOffers = [...p.supplierOffers];
              const originalOffer = updatedOffers[unsavedOfferIndex];
              updatedOffers[unsavedOfferIndex] = {
                ...originalOffer,
                brandOffered: '',
                isSuggestedBrand: false
              };
              return { ...p, supplierOffers: updatedOffers };
            }
            return p;
          });
          return result;
        });
    }
  };

  const isFirstOfferForProduct = useCallback((productId: string) => {
    const product = productsToQuote.find(p => p.id === productId);
    return !product || product.supplierOffers.length === 0;
  }, [productsToQuote]);

  const calculatePricePerUnit = (offer: OfferWithUI | Partial<OfferWithUI>): number | null => {
    const unitsPerPackage = Number(offer.unitsPerPackage);
    const price = Number(offer.totalPackagingPrice);
    const weight = Number(offer.unitWeight);

    if (!isNaN(unitsPerPackage) && !isNaN(price) && !isNaN(weight) && unitsPerPackage > 0 && price > 0 && weight > 0) {
      // Cálculo correto: preço / (unidades_por_embalagem × peso_unitário)
      return price / (unitsPerPackage * weight);
    }
    return null;
  };

  const handleSaveProductOffer = async (productId: string, offerUiId: string): Promise<boolean> => {
    const totalStartTime = performance.now();
    // Debounce rapid save clicks
    const now = Date.now();
    const actionKey = `save-${productId}-${offerUiId}`;
    if (lastClickRef.current?.action === actionKey && now - lastClickRef.current.timestamp < 1000) {
      return false;
    }
    lastClickRef.current = { action: actionKey, timestamp: now };

    if (!currentSupplierDetails || !quotation || !quotation.userId) {
        toast({title: "Erro Interno", description: "Dados do fornecedor, cotação ou ID do comprador ausentes.", variant: "destructive"});
        return false;
    }
    const product = productsToQuote.find(p => p.id === productId);
    if (!product) {
      return false;
    }

    const offerToSaveIndex = product.supplierOffers.findIndex(o => o.uiId === offerUiId);
    if (offerToSaveIndex === -1) {
        toast({title: "Erro", description: "Oferta não encontrada para salvar.", variant: "destructive"});
        return false;
    }
    const offerData = product.supplierOffers[offerToSaveIndex];

    const unitsInPackaging = Number(offerData.unitsInPackaging);
    const unitsPerPackage = Number(offerData.unitsPerPackage);
    const unitWeight = Number(offerData.unitWeight);
    const totalPackagingPrice = Number(offerData.totalPackagingPrice);

    if (isNaN(unitsInPackaging) || unitsInPackaging <= 0 || isNaN(unitsPerPackage) || unitsPerPackage <= 0 || isNaN(unitWeight) || unitWeight <= 0 || isNaN(totalPackagingPrice) || totalPackagingPrice <= 0) {
      toast({title: "Dados Inválidos", description: "Preencha todos os campos da oferta corretamente (Unidades > 0, Peso > 0, Preço > 0).", variant: "destructive", duration: 7e3});
      return false;
    }

    const pricePerUnit = totalPackagingPrice / (unitsPerPackage * unitWeight);

    const bestCompetitorOffer = product.bestOffersByBrand.find(o => o.supplierId !== supplierId);

    if (bestCompetitorOffer && pricePerUnit < bestCompetitorOffer.pricePerUnit && pricePerUnit > bestCompetitorOffer.pricePerUnit * 0.99) {
        toast({
            title: "Oferta Inválida",
            description: `Sua oferta deve ser pelo menos 1% menor que a melhor oferta atual de ${formatCurrency(bestCompetitorOffer.pricePerUnit)}. O valor mínimo para cobrir esta oferta é de ${formatCurrency(bestCompetitorOffer.pricePerUnit * 0.99)}. `,
            variant: "destructive",
        });
        return false;
    }

    const isDuplicatePrice = product.bestOffersByBrand.some(
        (offer) => offer.pricePerUnit === pricePerUnit && offer.supplierId !== supplierId
    );

    if (isDuplicatePrice) {
        toast({
            title: "Preço Duplicado",
            description: "Este preço já foi ofertado por outro fornecedor. Por favor, insira um valor diferente.",
            variant: "destructive",
        });
        return false;
    }

    const brandName = offerData.brandOffered.trim();

    const previousBestOffer = product.bestOffersByBrand.length > 0 ? product.bestOffersByBrand[0] : null;

    // Handle outbid notification
    await handleOutbidNotification({
      previousBestOffer,
      newPricePerUnit: pricePerUnit,
      product,
      quotation,
      currentSupplierDetails,
      supplierDetailsCache: supplierDetailsCache.current,
      onError: (message) => {
        toast({
          title: "Falha na Notificação",
          description: message,
          variant: "destructive"
        });
      }
    });

    const offerPayload: Omit<Offer, 'id'> = {
      quotationId: quotationId, // Adicionar campo obrigatório
      supplierId: currentSupplierDetails.id,
      supplierName: currentSupplierDetails.empresa,
      supplierInitials: currentSupplierDetails.empresa.substring(0, 2).toUpperCase(),
      brandOffered: offerData.brandOffered,
      packagingDescription: offerData.packagingDescription,
      unitsInPackaging,
      unitsPerPackage: offerData.unitsPerPackage || 0,
      unitWeight,
      totalPackagingPrice,
      pricePerUnit,
      updatedAt: serverTimestamp() as Timestamp,
      productId: productId,
    };
    
    const savingKey = `${productId}_${offerUiId}`;
    setIsSaving(prev => ({ ...prev, [savingKey]: true }));
    // Adiciona a oferta à lista de ofertas sendo salvas
    setSavingOffers(prev => new Set(prev).add(savingKey));

    try {
      if (offerData.id) {
        const offerRef = doc(db, `quotations/${quotationId}/products/${productId}/offers/${offerData.id}`);
        await updateDoc(offerRef, offerPayload);
        toast({ title: "Oferta Atualizada!", description: `Sua oferta para ${product.name} (${offerData.brandOffered}) foi atualizada.` });
        speak(voiceMessages.success.offerSaved);
      } else {
        // Skip duplicate check for better performance - Firebase will handle uniqueness with IDs
        const addDocStartTime = performance.now();
        const offerCollectionRef = collection(db, `quotations/${quotationId}/products/${productId}/offers`);
        const newOfferDocRef = await addDoc(offerCollectionRef, offerPayload);
        const addDocEndTime = performance.now();

        // Verificar variação de quantidade e registrar
        const offeredQuantity = calculateTotalOfferedQuantity(offerData, product);
        const requestedQuantity = product.quantity;
        const quantityValidation = validateQuantityVariation(offeredQuantity, requestedQuantity);

        if (!quantityValidation.isValid && quotation) {
          // TODO: Implementar busca dos dados do comprador para envio de notificação
          // Para isso, seria necessário buscar os dados do comprador usando quotation.userId
        }

        const toastStartTime = performance.now();
        toast({ title: "Oferta Salva!", description: `Sua oferta para ${product.name} (${offerData.brandOffered}) foi salva.` });
        const toastEndTime = performance.now();

        const speakStartTime = performance.now();
        // Make speak non-blocking by deferring it
        setTimeout(() => speak(voiceMessages.success.offerSaved), 0);
        const speakEndTime = performance.now();
      }

      const clearingStartTime = performance.now();

      const alertsStartTime = performance.now();
      setUnseenAlerts(prev => prev.filter(alertId => alertId !== productId));
      const alertsEndTime = performance.now();

      const offerChangeStartTime = performance.now();
      handleOfferChange(productId, offerUiId, 'showBeatOfferOptions', false); // Reset the flag after saving
      const offerChangeEndTime = performance.now();

      const totalEndTime = performance.now();
      return true;
    } catch (error: any) {
      toast({ title: "Erro ao Salvar Oferta", description: error.message, variant: "destructive" });
      setTimeout(() => speak(voiceMessages.error.saveFailed), 0);
      return false;
    } finally {
      setIsSaving(prev => ({ ...prev, [savingKey]: false }));
      // Remove a oferta da lista de ofertas sendo salvas
      setSavingOffers(prev => {
        const newSet = new Set(prev);
        newSet.delete(savingKey);
        return newSet;
      });
      const totalEndTime = performance.now();
    }
  };
  
  const handleBeatOfferClick = (productId: string, offerUiId: string, discountPercentage: number) => {
    const product = productsToQuote.find((p) => p.id === productId);
    const offer = product?.supplierOffers.find((o) => o.uiId === offerUiId);

    if (!product || !offer) {
      return;
    }

    const bestOverallPrice = product.lowestPriceThisProductHas;

    if (!bestOverallPrice) {
      toast({
        title: "Sem oferta para cobrir",
        description: "Nenhum concorrente ofertou para este produto ainda.",
      });
      return;
    }

    const units = Number(offer.unitsInPackaging);
    if (isNaN(units) || units <= 0) {
      toast({
        title: "Unidades necessárias",
        description:
          "Primeiro, preencha o campo 'Total Un na Emb.' para calcular o preço.",
        variant: "destructive",
      });
      return;
    }

    const targetPricePerUnit = bestOverallPrice * (1 - discountPercentage / 100.0);
    const newTotalPackagingPrice = targetPricePerUnit * units;

    handleOfferChange(
      productId,
      offerUiId,
      'totalPackagingPrice',
      parseFloat(newTotalPackagingPrice.toFixed(6))
    );

    // Manter os botões visíveis para navegação
    handleOfferChange(productId, offerUiId, 'showBeatOfferOptions', true);

     toast({
        title: "Preço Ajustado",
        description: `Novo preço calculado para um desconto de ${discountPercentage}%. Salve a oferta para confirmar.`,
    });
  };

  // Show loading while checking authentication
  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg">Carregando...</p>
      </div>
    );
  }

  // Show PIN modal if not authenticated
  if (showPinModal && supplier) {
    return (
      <SupplierPinModal
        isOpen={true}
        supplierName={supplier.empresa}
        onVerify={verifyPin}
      />
    );
  }

  // Block access if not authenticated (and supplier has PIN)
  if (!isAuthenticated && supplier?.pin) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-4 text-lg text-muted-foreground">Aguardando autenticação...</p>
      </div>
    );
  }

  // If supplier has no PIN, allow access (backward compatibility)
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-lg">Carregando cotação...</p>
      </div>
    );
  }
  
  if (!quotation || !currentSupplierDetails) {
    return (
      <div className="p-8 text-center text-destructive">
        Cotação ou fornecedor não encontrado. Verifique os IDs.
      </div>
    );
  }

  if (quotation.status === 'Pausada') {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background text-center p-4">
        <Clock className="h-16 w-16 text-amber-500 mb-4" />
        <h1 className="text-3xl font-bold text-foreground">Cotação Pausada</h1>
        <p className="text-lg text-muted-foreground mt-2">O comprador pausou temporariamente esta cotação.</p>
        <p className="text-muted-foreground">Novas ofertas não podem ser enviadas no momento. Por favor, aguarde.</p>
        <Button variant="outline" onClick={() => router.push(`/portal/${supplierId}`)} className="mt-8">
            <ChevronLeft className="mr-2 h-4 w-4"/> Voltar ao Portal
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-6">
      <header className="space-y-4 pb-6 border-b">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <Button variant="outline" onClick={() => router.push(`/portal/${supplierId}`)} className="w-full sm:w-auto">
                <ChevronLeft className="mr-2 h-4 w-4"/> Voltar ao Portal
            </Button>
            {unseenAlerts.length > 0 && (
                <Badge variant="warning" className="flex items-center gap-1.5 text-sm p-2 animate-pulse order-first sm:order-none">
                    <Bell className="h-4 w-4"/> {unseenAlerts.length} Alerta(s) de Preço!
                </Badge>
            )}
        </div>
        <div className="flex flex-row justify-end items-center gap-4">
          <div className={`flex items-center gap-3 p-3 rounded-lg shadow-sm border ${isQuotationEnded ? 'bg-destructive/10 border-destructive text-destructive' : 'bg-card border-border'}`}>
              {!isQuotationEnded && (
                  <>
                    <Clock className={`h-5 w-5 ${isQuotationEnded ? 'text-destructive' : 'text-primary'}`} />
                    <div className="flex items-center gap-2">
                      <span className={`text-lg font-bold ${isQuotationEnded ? 'text-destructive' : 'text-primary'}`}>{timeLeft}</span>
                      <span className="text-xs text-muted-foreground">
                        (Prazo Final: {quotation.deadline ? format(quotation.deadline.toDate(), "dd/MM/yyyy HH:mm", {locale: ptBR}) : 'N/A'})
                      </span>
                    </div>
                  </>
              )}
              {isQuotationEnded && (
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-destructive">Prazo Encerrado</span>
                    <span className="text-xs text-destructive/70">
                      (Prazo Final: {quotation.deadline ? format(quotation.deadline.toDate(), "dd/MM/yyyy HH:mm", {locale: ptBR}) : 'N/A'})
                    </span>
                  </div>
              )}
          </div>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg font-medium flex items-center gap-2"><Contact className="h-5 w-5 text-primary"/>Seus Dados (Fornecedor)</CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
                <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                        <Image src={isValidImageUrl(currentSupplierDetails.fotoUrl) ? currentSupplierDetails.fotoUrl : 'https://placehold.co/64x64.png'} alt={currentSupplierDetails.empresa} width={64} height={64} className="object-cover w-full h-full rounded-full" data-ai-hint={currentSupplierDetails.fotoHint || 'logo company'} />
                        <AvatarFallback className="bg-muted text-xl">{currentSupplierDetails.empresa.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                        <p className="font-semibold">{currentSupplierDetails.vendedor}</p>
                        <p className="text-sm text-muted-foreground">{currentSupplierDetails.empresa}</p>
                        <p className="text-xs text-muted-foreground">CNPJ: {currentSupplierDetails.cnpj}</p>
                    </div>
                </div>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg font-medium flex items-center gap-2"><Briefcase className="h-5 w-5 text-primary" />Detalhes da Cotação</CardTitle>
            </CardHeader>
            <CardContent className="pt-2 space-y-2">
                <div className="text-sm flex items-center gap-2">
                    <span className="font-medium">Status:</span>
                    <Badge variant={quotation.status === 'Aberta' ? 'default' : 'secondary'}>{quotation.status}</Badge>
                </div>
                <div className="text-sm"><span className="font-medium">Data da Lista:</span> {quotation.shoppingListDate ? format(quotation.shoppingListDate.toDate(), "dd/MM/yyyy", { locale: ptBR }) : 'N/A'}</div>
                <p className="text-sm"><span className="font-medium">Criada em:</span> {quotation.createdAt && 'toDate' in quotation.createdAt ? format(quotation.createdAt.toDate(), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : 'N/A'}</p>
            </CardContent>
        </Card>
      </section>
      
            <section className="space-y-6">
              <Tabs value={activeCategoryTab} onValueChange={setActiveCategoryTab} className="w-full">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold text-foreground">Produtos para Cotação ({filteredProducts.length})</h2>
                  <TabsList>
                    <TabsTrigger value="all">Todos</TabsTrigger>
                    {productCategories.map(category => (
                      <TabsTrigger key={category} value={category}>{category}</TabsTrigger>
                    ))}
                  </TabsList>
                </div>
                <TabsContent value={activeCategoryTab} className="space-y-8">
                  {filteredProducts.length === 0 && !isLoading ? (
                      <Card><CardContent className="p-6 text-center"><p className="text-muted-foreground">Nenhum item encontrado nesta categoria.</p></CardContent></Card>
                  ) : (
                    <div className="space-y-8">
                      {filteredProducts.map((product, index) => {
                    const hasUnseenAlert = unseenAlerts.includes(product.id);
                    const isExpanded = expandedProductIds.includes(product.id);
                    const isDeliveryMismatch = product.hasSpecificDate && product.isDeliveryDayMismatch;
                    const hasMyOffers = productsWithMyOffers.has(product.id);
                    const isLockedOut = !!product.isLockedOut;
      
                    // New logic for pulsating border on main product card
                    const mySavedOffers = product.supplierOffers.filter(offer => offer.supplierId === supplierId && offer.id);
                    const isMyOfferWinning = mySavedOffers.some(offer => offer.pricePerUnit === product.lowestPriceThisProductHas);
                    const isMyOfferLosing = mySavedOffers.some(offer => offer.pricePerUnit > 0) && !isMyOfferWinning;
      
                    return (
                      <Card key={product.id} className={`border-2 transition-all duration-300 ${
                          isMyOfferWinning ? 'animate-pulse-glow-green' :
                          isMyOfferLosing ? 'animate-pulse-glow-red' :
                          hasUnseenAlert ? 'border-orange-500 shadow-lg' : 
                          isExpanded ? 'border-blue-500 shadow-lg bg-gradient-to-r from-blue-50/30 to-indigo-50/30 dark:from-blue-950/20 dark:to-indigo-950/20' : 'border-transparent'
                      }`}>                  <CardHeader className="bg-muted/30 p-4 cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => toggleProductExpansion(product.id)}>
                            <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                                <div className="flex items-center gap-3 flex-grow">

                                    <div>
                                        <h3 className="text-xl font-semibold">
                                          {(() => {
                                            // Pega a oferta em andamento (não salva) ou a última oferta do fornecedor
                                            const myOfferInProgress = product.supplierOffers.find(o => o.supplierId === supplierId && !o.id);
                                            const myLastOffer = product.supplierOffers.filter(o => o.supplierId === supplierId).sort((a, b) => {
                                              if (a.updatedAt instanceof Timestamp && b.updatedAt instanceof Timestamp) {
                                                return b.updatedAt.toMillis() - a.updatedAt.toMillis();
                                              }
                                              return 0;
                                            })[0];
                                            const offerToShow = myOfferInProgress || myLastOffer;
                                            return buildDynamicTitle(product.name, offerToShow, product.unit);
                                          })()}
                                        </h3>
                                        <p className="text-sm text-muted-foreground">
                                          Pedido: {product.quantity} {abbreviateUnit(product.unit)} para {product.hasSpecificDate && product.deliveryDate ? format(product.deliveryDate.toDate(), "dd/MM/yyyy", { locale: ptBR }) : <span className="font-medium text-accent">entregar na próxima entrega da sua grade</span>}
                                        </p>
                                    </div>
                                </div>
                                {!hasMyOffers && isExpanded && (
                                    <div className="flex items-center gap-2 p-3 rounded-md bg-accent/10 border border-accent/20 text-accent">
                                        <EyeOff className="h-5 w-5" />
                                        <div className="text-sm">
                                            <p className="font-semibold">Preços Ocultos</p>
                                            <p className="text-xs">Faça uma oferta para ver os lances.</p>
                                        </div>
                                    </div>
                                )}
                                {hasMyOffers && product.bestOffersByBrand && product.bestOffersByBrand.length > 0 && (
                                  <div className="flex flex-row flex-wrap gap-6 p-3">
                                      {product.bestOffersByBrand.map(offer => {
                                          let variantClasses = "border-muted-foreground/20";
                                          let textPriceClass = "text-foreground";
                                          const isLowestOverall = product.lowestPriceThisProductHas !== null && offer.pricePerUnit === product.lowestPriceThisProductHas;
                                          
                                          if(isLowestOverall) {
                                            variantClasses = "border-green-500";
                                            textPriceClass = "text-green-600 dark:text-green-400";
                                          } else if(offer.isSelf) {
                                            variantClasses = "border-primary";
                                            textPriceClass = "text-primary";
                                          }
      
                                          return (
                                              <div key={offer.brandName + offer.supplierId} className={`flex items-start justify-between p-3 rounded-md bg-muted/20 border-l-4 min-w-[280px] gap-3 ${variantClasses}`}>
                                                  <div className="flex items-start gap-3 flex-1">
                                                      <TooltipProvider>
                                                          <Tooltip>
                                                              <TooltipTrigger asChild>
                                                                  <Avatar className="h-8 w-8 shrink-0 cursor-pointer">
                                                                    <Image src={isValidImageUrl(offer.supplierFotoUrl) ? offer.supplierFotoUrl : 'https://placehold.co/40x40.png'} alt={offer.supplierName || 'Fornecedor'} width={40} height={40} className="object-cover w-full h-full rounded-full" data-ai-hint={offer.supplierFotoHint || 'logo company'} />
                                                                    <AvatarFallback className="text-xs bg-muted">{offer.supplierInitials}</AvatarFallback>
                                                                  </Avatar>
                                                              </TooltipTrigger>
                                                              <TooltipContent side="top" className="bg-background border text-foreground shadow-lg rounded-md text-xs p-2">
                                                                <p className="font-semibold">{offer.vendedor}</p>
                                                                <p>{offer.supplierName}</p>
                                                                <p className="text-muted-foreground">CNPJ: {offer.cnpj}</p>
                                                              </TooltipContent>
                                                          </Tooltip>
                                                      </TooltipProvider>
                                                      <div className="flex-1">
                                                          <div className="mb-1">
                                                            <h4 className="text-base font-semibold text-foreground" title={offer.brandName}>
                                                              {offer.brandName}
                                                              {offer.unitsInPackaging && offer.unitWeight && (
                                                                <span className="text-sm text-muted-foreground font-normal">
                                                                  {` - ${formatPackaging(offer.unitsInPackaging, offer.unitWeight, offer.productUnit)}`}
                                                                </span>
                                                              )}
                                                              {offer.totalPackagingPrice && offer.totalPackagingPrice > 0 && (
                                                                <span className="text-sm text-muted-foreground font-normal">
                                                                  {` | ${formatCurrency(offer.totalPackagingPrice)}`}
                                                                </span>
                                                              )}
                                                            </h4>
                                                          </div>
                                                          <p className="text-xs text-muted-foreground">por {offer.supplierName}</p>
                                                      </div>
                                                  </div>
                                                  <div className="text-right shrink-0">
                                                      <p className={`text-base font-bold leading-tight ${textPriceClass}`}>
                                                        {formatCurrency(offer.pricePerUnit)} / {abbreviateUnit(offer.productUnit)}
                                                      </p>
                                                      <div className="mt-1">
                                                        {isLowestOverall && <Badge variant={offer.isSelf ? "default" : "outline"} className={`text-xs ${offer.isSelf ? 'bg-green-600 text-white' : 'border-green-600 text-green-700'}`}>Melhor Preço</Badge>}
                                                        {!isLowestOverall && offer.isSelf && <Badge variant="default" className="text-xs">Sua Oferta</Badge>}
                                                      </div>
                                                  </div>
                                              </div>
                                          )
                                      })}
                                  </div>
                                )}

                                {/* Render brand requests (pending=orange, rejected=red) */}
                                {(() => {
                                  const hasBrandRequests = product.pendingBrandRequests && product.pendingBrandRequests.length > 0;
                                  return hasBrandRequests;
                                })() && (
                                  <div className="flex flex-row flex-wrap gap-2 p-1">
                                      {product.pendingBrandRequests?.map(request => {
                                        // Define colors based on status (only pending or rejected shown)
                                        const isPending = request.status === 'pending';
                                        const isRejected = request.status === 'rejected';

                                        const cardBg = isPending ? 'bg-orange-50/50' : 'bg-red-50/50';
                                        const borderColor = isPending ? 'border-orange-500' : 'border-red-500';
                                        const textColor = isPending ? 'text-orange-600' : 'text-red-600';
                                        const badgeBorder = isPending ? 'border-orange-600' : 'border-red-600';
                                        const badgeText = isPending ? 'text-orange-700' : 'text-red-700';
                                        const badgeLabel = isPending ? 'Aguardando Aprovação' : '✗ Rejeitada';

                                        return (
                                          <div key={request.id} className={`flex items-start justify-between p-3 rounded-md ${cardBg} border-l-4 ${borderColor} min-w-[280px] gap-3`}>
                                              <div className="flex items-start gap-3 flex-1">
                                                  <TooltipProvider>
                                                      <Tooltip>
                                                          <TooltipTrigger asChild>
                                                              <Avatar className="h-8 w-8 shrink-0 cursor-pointer">
                                                                {request.imageUrl ? (
                                                                  <Image 
                                                                    src={request.imageUrl} 
                                                                    alt={request.brandName} 
                                                                    width={40} 
                                                                    height={40} 
                                                                    className="object-cover w-full h-full rounded-full" 
                                                                  />
                                                                ) : (
                                                                  <AvatarFallback className="text-xs bg-orange-100">{request.supplierInitials}</AvatarFallback>
                                                                )}
                                                              </Avatar>
                                                          </TooltipTrigger>
                                                          <TooltipContent side="top" className="bg-background border text-foreground shadow-lg rounded-md text-xs p-2">
                                                            <p className="font-semibold">{request.supplierName}</p>
                                                            <p className="text-muted-foreground">Nova marca proposta</p>
                                                          </TooltipContent>
                                                      </Tooltip>
                                                  </TooltipProvider>
                                                  <div className="flex-1">
                                                      <div className="mb-1">
                                                        <h4 className="text-base font-semibold text-foreground" title={request.brandName}>
                                                          {request.brandName}
                                                          {request.unitsInPackaging && request.unitWeight && (
                                                            <span className="text-sm text-muted-foreground font-normal">
                                                              {` - ${formatPackaging(request.unitsInPackaging, request.unitWeight, product.unit)}`}
                                                            </span>
                                                          )}
                                                          {request.totalPackagingPrice && request.totalPackagingPrice > 0 && (
                                                            <span className="text-sm text-muted-foreground font-normal">
                                                              {` | ${formatCurrency(request.totalPackagingPrice)}`}
                                                            </span>
                                                          )}
                                                        </h4>
                                                      </div>
                                                      <p className="text-xs text-muted-foreground">por {request.supplierName}</p>
                                                  </div>
                                              </div>
                                              <div className="text-right shrink-0">
                                                  <p className={`text-base font-bold ${textColor} leading-tight`}>
                                                    {(() => {
                                                      // Fallback: recalcula preço se estiver inválido
                                                      if (request.pricePerUnit && !isNaN(request.pricePerUnit)) {
                                                        return formatCurrency(request.pricePerUnit);
                                                      }
                                                      // Recalcular se temos os dados necessários
                                                      if (request.totalPackagingPrice && request.unitsInPackaging && request.unitWeight) {
                                                        const calculated = request.totalPackagingPrice / (request.unitsInPackaging * request.unitWeight);
                                                        return formatCurrency(calculated);
                                                      }
                                                      return "-";
                                                    })()}
                                                    {" / "}
                                                    {abbreviateUnit(product.unit)}
                                                  </p>
                                                  <div className="mt-1">
                                                    <Badge variant="outline" className={`text-xs ${badgeBorder} ${badgeText}`}>
                                                      {badgeLabel}
                                                    </Badge>
                                                  </div>
                                              </div>
                                          </div>
                                        );
                                      })}
                                  </div>
                                )}
                                <div className="sm:ml-auto">
                                  {isExpanded ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                                </div>
                            </div>
                        </CardHeader>
                        {isExpanded && (
                            <div className="relative">
                                {isDeliveryMismatch && !product.acknowledgedDeliveryMismatches?.includes(supplierId) && (
                                    <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center p-4 text-center rounded-b-lg">
                                       <AlertTriangle className="h-10 w-10 text-amber-500 mb-2" />
                                        <p className="font-semibold text-destructive-foreground">A entrega em {product.deliveryDate ? format(product.deliveryDate.toDate(), "eeee, dd/MM", { locale: ptBR }) : ''} está fora da sua grade.</p>
                                        <p className="text-sm text-muted-foreground mb-4">Sua grade de entrega: {currentSupplierDetails?.diasDeEntrega?.join(', ') || 'Nenhuma'}</p>
                                        <Button onClick={() => handleAcknowledgeMismatch(product.id)}>Cotar mesmo assim (Confirmo que posso entregar)</Button>
                                    </div>
                                )}
                                 <CardContent className={`p-4 space-y-4 ${isDeliveryMismatch && !product.acknowledgedDeliveryMismatches?.includes(supplierId) ? 'opacity-40 pointer-events-none' : ''}`}>
                                     {(() => {
                                       // Calcula bloqueio para badges
                                       const { isBadgeDisabled } = calculateBlockingRules({
                                         isQuotationEnded,
                                         isLockedOut,
                                         isStoppedQuoting: stoppedQuotingProducts.has(product.id),
                                         counterProposalInfo: product.counterProposalInfo,
                                         isOfferSaved: false,
                                         isInEditMode: false,
                                         isSaving: false
                                       });

                                     return (
                                     <>
                                     {isLockedOut && (
                                          <Alert variant="destructive">
                                              <AlertTriangle className="h-4 w-4" />
                                              <AlertTitle>Prazo de Contraproposta Expirado</AlertTitle>
                                              <AlertPrimitiveDescription>
                                                  Seu tempo para cobrir a oferta concorrente neste item terminou. Não é mais possível enviar ou editar propostas para este produto.
                                              </AlertPrimitiveDescription>
                                          </Alert>
                                     )}
                                     {product.counterProposalInfo && (
                                         <Alert variant="destructive" className="my-2 animate-pulse">
                                            <AlertTriangle className="h-4 w-4"/>
                                            <AlertTitle>Contraproposta Urgente!</AlertTitle>
                                            <AlertPrimitiveDescription className="flex items-center gap-2">
                                                                                          Sua oferta para &quot;{product.counterProposalInfo.myBrand}&quot; foi superada! Você tem                                           <strong className="flex items-center gap-1.5 text-base">
                                                  <Clock className="h-4 w-4"/>
                                                  <CountdownTimer deadline={product.counterProposalInfo.deadline} />
                                                </strong>
                                                 para cobrir a oferta da marca &quot;{product.counterProposalInfo.winningBrand}&quot;.
                                            </AlertPrimitiveDescription>
                                         </Alert>
                                     )}
      
                                     <div className="flex flex-col sm:flex-row sm:items-center gap-x-4 gap-y-2 text-sm">
                                        {product.preferredBrands && product.preferredBrands.length > 0 && (
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="font-medium text-muted-foreground mr-1">Marcas Sugeridas:</span>
                                            {getPreferredBrandsArray(product.preferredBrands).map(brand => (
                                                <Badge key={brand.trim()} variant="outline" onClick={() => !isBadgeDisabled && handleSuggestedBrandClick(product.id, brand.trim())} className={isBadgeDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-muted hover:border-primary/50'}>{brand.trim()}</Badge>
                                            ))}
                                          </div>
                                        )}
                                        <Badge
                                          variant="outline"
                                          onClick={() => !isBadgeDisabled && openNewBrandModal(product.id, product.name, product.unit)}
                                          className={`border-primary/70 text-primary/90 ${isBadgeDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-muted hover:border-primary/50'}`}
                                        >
                                          <PlusCircle className="mr-1.5 h-3 w-3" /> Outra Marca
                                        </Badge>
                                        {product.notes && <p className="text-muted-foreground mt-2 sm:mt-0"><span className="font-medium">Obs. Comprador:</span> {product.notes}</p>}
                                     </div>
      
                                     {/* Verificar se há fluxo guiado ativo para este produto */}
                                     {(() => {
                                       const flowKey = `${product.id}_vendor_flow`;
                                       const activeFlow = vendorFlow[flowKey];
                                       
                                       if (activeFlow && activeFlow.showGuidedFlow) {
                                         return renderVendorFlowCard(
                                           product.id,
                                           product,
                                           activeFlow,
                                           updateVendorFlowStep,
                                           completeVendorFlow,
                                           cancelVendorFlow,
                                           formatCurrency
                                         );
                                       }
                                       return null;
                                     })()}

                                     {/* Verificar se há fluxo guiado de nova marca ativo para este produto */}
                                     {(() => {
                                       const flowKey = `${product.id}_brand_flow`;
                                       const activeBrandFlow = newBrandFlow[flowKey];
                                       
                                       if (activeBrandFlow && activeBrandFlow.showGuidedFlow) {
                                         return renderNewBrandFlowCard(
                                           product.id,
                                           product,
                                           activeBrandFlow,
                                           updateNewBrandFlowStep,
                                           completeNewBrandFlow,
                                           cancelNewBrandFlow,
                                           formatCurrency,
                                           formatCurrencyInput,
                                           parseCurrencyInput,
                                           formatWeightInputForKg,
                                           parseWeightInputForKg,
                                           isSubmittingNewBrand
                                         );
                                       }
                                       return null;
                                     })()}

                                     {product.supplierOffers.map((offer, offerIndex) => {
                                       const savingKey = `${product.id}_${offer.uiId}`;
                                       const pricePerUnit = calculatePricePerUnit(offer);
                                       let pricePerUnitClasses = "bg-muted";
                                       const bestCompetitorOfferOverall = product.bestOffersByBrand.find(b => !b.isSelf);
                                       const isMyOfferOutbid = offer.id && bestCompetitorOfferOverall && pricePerUnit && pricePerUnit > bestCompetitorOfferOverall.pricePerUnit;
      
                                       // Ativar showBeatOfferOptions automaticamente quando estiver perdendo
                                       if (isMyOfferOutbid && !offer.showBeatOfferOptions) {
                                         setTimeout(() => {
                                           handleOfferChange(product.id, offer.uiId, 'showBeatOfferOptions', true);
                                         }, 0);
                                       }
      
                                       // Calcular condições de bloqueio usando hook
                                       const { isOfferDisabled, isBrandFieldDisabled, isButtonDisabled } = calculateBlockingRules({
                                         isQuotationEnded,
                                         isLockedOut,
                                         isStoppedQuoting: stoppedQuotingProducts.has(product.id),
                                         counterProposalInfo: product.counterProposalInfo,
                                         isOfferSaved: !!offer.id,
                                         isInEditMode: isInEditMode(product.id, offer.uiId),
                                         isSaving: isSaving[savingKey] || false
                                       }, offer.isSuggestedBrand);
                                       
                                       if (hasMyOffers && pricePerUnit !== null && bestCompetitorOfferOverall) {
                                          if(pricePerUnit <= bestCompetitorOfferOverall.pricePerUnit) {
                                            pricePerUnitClasses = "bg-green-500/10 border-green-500/40 text-green-700 font-semibold";
                                          } else if (pricePerUnit > bestCompetitorOfferOverall.pricePerUnit) {
                                            pricePerUnitClasses = "bg-destructive/10 border-destructive/30 text-destructive font-semibold";
                                          }
                                       }
      
                                       // Verificar se há fluxo guiado ativo para este produto
                                       const flowKey = `${product.id}_vendor_flow`;
                                       const activeFlow = vendorFlow[flowKey];
                                       
                                       if (activeFlow && activeFlow.showGuidedFlow) {
                                         return renderVendorFlowCard(
                                           product.id,
                                           product,
                                           activeFlow,
                                           updateVendorFlowStep,
                                           completeVendorFlow,
                                           cancelVendorFlow,
                                           formatCurrency
                                         );
                                       }
                                       
                                       // Card padrão (formulário)
                                       return (
                                         <div key={`${product.id}-${offerIndex}-${offer.uiId}`} className="p-3 border rounded-md bg-background shadow-sm space-y-3">
                                           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                                             {/* Campo 1: Quantas Cx ou fardos */}
                                             <div className="space-y-1">
                                               <label htmlFor={`packages-${product.id}-${offer.uiId}`} className="block text-xs font-medium text-muted-foreground">Quantas Cx ou fardos vc irá enviar *</label>
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
                                               <label htmlFor={`units-${product.id}-${offer.uiId}`} className="block text-xs font-medium text-muted-foreground">Total Un na Emb. *</label>
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
                                               <label htmlFor={`weight-${product.id}-${offer.uiId}`} className="block text-xs font-medium text-muted-foreground">Peso (Kg) *</label>
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
                                                 <span className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-muted-foreground">Kg</span>
                                               </div>
                                             </div>

                                             {/* Campo 4: Preço Total da Emb */}
                                             <div className="space-y-1">
                                               <label htmlFor={`price-${product.id}-${offer.uiId}`} className="block text-xs font-medium text-muted-foreground">Preço Total da Emb. (R$) *</label>
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
                                               <label className="block text-xs font-medium text-muted-foreground">Valor Total do Pedido (R$)</label>
                                               <Input
                                                 type="text"
                                                 value={(() => {
                                                   const packagesCount = Number(offer.unitsInPackaging) || 0;
                                                   const pricePerEmb = Number(offer.totalPackagingPrice) || 0;
                                                   if (packagesCount > 0 && pricePerEmb > 0) {
                                                     return formatCurrencyInput((packagesCount * pricePerEmb) * 100);
                                                   }
                                                   return '';
                                                 })()}
                                                 readOnly
                                                 className="bg-muted/50"
                                               />
                                             </div>

                                             {/* Campo 6: Preço/Unid. */}
                                             <div className="space-y-1">
                                               <label className="block text-xs font-medium text-muted-foreground">Preço/Unid.</label>
                                               <div className="h-10 flex items-center">
                                                 <span className={`text-sm px-2 py-1 rounded border w-full text-center ${pricePerUnitClasses}`}>
                                                   {formatCurrency(pricePerUnit)} / {abbreviateUnit(product.unit)}
                                                 </span>
                                               </div>
                                             </div>
                                           </div>

                                           {/* Botões na linha de baixo */}
                                           <div className="flex justify-end gap-2 pt-2 border-t">

                                             <div className="flex gap-2">
                                               <Button
                                                 variant="outline"
                                                 size="sm"
                                                 onClick={() => removeOfferField(product.id, offer)}
                                                 disabled={isOfferDisabled}
                                                 className="text-destructive hover:text-destructive"
                                               >
                                                 Remover Oferta
                                               </Button>
                                               <Button
                                                 onClick={async () => {
                                                   const success = await handleSaveProductOffer(product.id, offer.uiId);
                                                 }}
                                                 disabled={isOfferDisabled}
                                                 className="bg-primary text-primary-foreground hover:bg-primary/90"
                                               >
                                                 Salvar Nova Oferta
                                               </Button>
                                             </div>
                                           </div>
                                         </div>
                                       );
                                     })}
                                     </>
                                     );
                                     })()}
                                 </CardContent>
                              </div>
                          )}
                        </Card>
                      )
                    })}
                    </div>
                  )}
                  </TabsContent>
              </Tabs>
            </section>      
      <footer className="mt-8 py-6 border-t" />

      {/* Modal de confirmação para parar de cotar */}
      <AlertDialog open={showStopQuotingModal} onOpenChange={setShowStopQuotingModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Parar de cotar este item?</AlertDialogTitle>
            <AlertDialogDescription>
              Você tem certeza que deseja parar de cotar &quot;{offerToStop?.productName}&quot;?
              {' '}
              <strong>Esta ação é irreversível</strong> e você não poderá mais fazer ofertas para este item nesta cotação.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmStopQuoting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Sim, parar de cotar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de Nova Marca */}
      <Dialog open={newBrandModal.isOpen} onOpenChange={(open) => !open && closeNewBrandModal()}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Propor Nova Marca</DialogTitle>
            <DialogDescription>
              Envie uma proposta de nova marca para &quot;{newBrandModal.productName}&quot;. 
              Ela será enviada ao comprador para aprovação.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="brand-name">Nome da Marca *</Label>
              <Input
                id="brand-name"
                type="text"
                value={newBrandForm.brandName}
                onChange={(e) => handleNewBrandFormChange('brandName', e.target.value)}
                onFocus={handleNewBrandBrandNameFocus}
                placeholder="Ex: Marca Nova"
                className="text-base"
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="units-packaging">Total Un na Emb. *</Label>
              <Input
                id="units-packaging"
                type="number"
                value={newBrandForm.unitsInPackaging || ''}
                onChange={(e) => handleNewBrandFormChange('unitsInPackaging', parseInt(e.target.value) || 0)}
                onFocus={handleNewBrandUnitsFocus}
                placeholder="Ex: 12"
                className="text-base"
              />
            </div>

            {/* X separator between fields */}
            <div className="flex items-center justify-center">
              <span className="text-2xl font-bold text-muted-foreground">×</span>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="unit-weight-modal">
                {getDynamicWeightLabel(newBrandModal.productUnit)} *
              </Label>
              <div className="relative">
                <Input
                  id="unit-weight-modal"
                  type={newBrandModal.productUnit === 'Kilograma(s)' || newBrandModal.productUnit === 'Litro(s)' ? "text" : "number"}
                  value={
                    newBrandModal.productUnit === 'Kilograma(s)' || newBrandModal.productUnit === 'Litro(s)'
                      ? (newBrandForm.unitWeight > 0 ? formatWeightInputForKg(newBrandForm.unitWeight * 1000) : '')
                      : (newBrandForm.unitWeight || '')
                  }
                  onChange={(e) => {
                    const inputValue = e.target.value;
                    if (newBrandModal.productUnit === 'Kilograma(s)' || newBrandModal.productUnit === 'Litro(s)') {
                      const gramas = parseWeightInputForKg(inputValue);
                      const kg = gramas / 1000;
                      handleNewBrandFormChange('unitWeight', kg);
                    } else {
                      const numericValue = parseFloat(inputValue.replace(',', '.')) || 0;
                      handleNewBrandFormChange('unitWeight', numericValue);
                    }
                  }}
                  placeholder={getDynamicWeightPlaceholder(newBrandModal.productUnit)}
                  className="text-base pr-12"
                />
                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                  {getUnitSuffix(newBrandModal.productUnit)}
                </span>
              </div>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="total-price">Preço Total da Emb. (R$) *</Label>
              <Input
                id="total-price"
                type="text"
                value={newBrandForm.totalPackagingPrice > 0 ? formatCurrencyInput(newBrandForm.totalPackagingPrice * 100) : ''}
                onChange={(e) => {
                  const centavos = parseCurrencyInput(e.target.value);
                  const decimalValue = centavos / 100;
                  handleNewBrandFormChange('totalPackagingPrice', decimalValue);
                }}
                onFocus={handleNewBrandPriceFocus}
                placeholder="R$ 0,00"
                className="text-base"
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="brand-image">Imagem da Marca (Opcional)</Label>
              <Input
                id="brand-image"
                type="file"
                accept="image/*"
                onChange={(e) => handleNewBrandFormChange('imageFile', e.target.files?.[0] || null)}
                onFocus={handleNewBrandImageFocus}
                className="text-base file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"
              />
              <p className="text-xs text-muted-foreground">
                Envie uma imagem da marca/produto para ajudar na aprovação
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={closeNewBrandModal}
              disabled={isSubmittingNewBrand}
            >
              Cancelar
            </Button>
            <Button
              onClick={submitNewBrandRequest}
              disabled={isSubmittingNewBrand || !newBrandForm.brandName.trim() || newBrandForm.unitsInPackaging <= 0 || newBrandForm.unitWeight <= 0 || newBrandForm.totalPackagingPrice <= 0}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {isSubmittingNewBrand ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                'Enviar Proposta'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}