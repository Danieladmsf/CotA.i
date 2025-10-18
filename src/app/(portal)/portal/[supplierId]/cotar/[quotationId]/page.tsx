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
import { CompetitorOfferCard, BrandRequestCard, OfferFormCard } from "@/components/features/cotacao/supplier-portal";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { sendCounterProposalReminder } from "@/actions/notificationActions";
import { notifyQuantityVariation } from "@/actions/notificationService";
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
import { useOfferManagement } from "@/hooks/quotation/useOfferManagement";
import QuantityShortageModal from "@/components/features/cotacao/QuantityShortageModal";
import { useNewBrandModal } from "@/hooks/quotation/useNewBrandModal";
import { useQuotationData, type ProductToQuoteVM } from "@/hooks/quotation/useQuotationData";
import { useGuidedFlows } from "@/hooks/quotation/useGuidedFlows";
import {
  dayMap,
  getPreferredBrandsArray,
  abbreviateUnit,
  getDynamicWeightLabel,
  getDynamicWeightPlaceholder,
  getUnitSuffix,
  formatCurrencyInput,
  parseCurrencyInput,
  handleCurrencyInputChange,
  formatWeightInputForKg,
  parseWeightInputForKg,
  handleWeightInputChangeForKg,
  formatSmartWeight,
  formatPackaging,
  calculateTotalOfferedQuantity,
  validateQuantityVariation,
  validateBoxQuantityVariation,
  buildDynamicTitle,
  isValidImageUrl,
  isGranelPackaging,
} from "@/lib/quotation/utils";

const QUOTATIONS_COLLECTION = "quotations";
const FORNECEDORES_COLLECTION = "fornecedores";
const SHOPPING_LIST_ITEMS_COLLECTION = "shopping_list_items";
const PENDING_BRAND_REQUESTS_COLLECTION = "pending_brand_requests";

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

// ProductToQuoteVM is imported from useQuotationData hook

// Renderiza o card do fluxo guiado do vendedor
const renderVendorFlowCard = (
  productId: string,
  product: ProductToQuoteVM,
  flow: any,
  updateVendorFlowStep: (productId: string, field: string, value: any, nextStep?: number) => void,
  completeVendorFlow: (productId: string, correctedData?: any) => void,
  cancelVendorFlow: (productId: string) => void,
  formatCurrency: (value: number | null) => string,
  vendorFlowModalStates: Record<string, boolean>,
  setVendorFlowModalStates: React.Dispatch<React.SetStateAction<Record<string, boolean>>>,
  vendorFlowDecisions: Record<string, {
    decision: string;
    correctedData?: {
      unitsPerPackage?: number;
      unitWeight?: number;
      totalPackagingPrice?: number;
      packages?: number;
      quantity?: number;
      weight?: number;
    };
  }>,
  setVendorFlowDecisions: React.Dispatch<React.SetStateAction<Record<string, {
    decision: string;
    correctedData?: {
      unitsPerPackage?: number;
      unitWeight?: number;
      totalPackagingPrice?: number;
      packages?: number;
      quantity?: number;
      weight?: number;
    };
  }>>>
) => {
  const { currentStep, selectedBrand, packagingType, unitsPerPackage, packageWeight, packagePrice, requiredPackages } = flow;
  
  console.log('🔍 [renderVendorFlowCard] Flow extraction:', {
    'flow_raw': flow,
    'currentStep': currentStep,
    'packagingType': packagingType,
    'unitsPerPackage_extracted': unitsPerPackage,
    'packageWeight_extracted': packageWeight,
    'requiredPackages_extracted': requiredPackages,
    'productUnit': product.unit
  });

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <h4 className="text-lg font-semibold">Seu item virá em:</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Button
                variant={packagingType === 'caixa' ? 'default' : 'outline'}
                onClick={() => {
                  updateVendorFlowStep(productId, 'packagingType', 'caixa');
                  // Para UNIDADES: pular Step 2, ir direto para Step 3
                  if (product.unit === 'Unidade(s)') {
                    updateVendorFlowStep(productId, 'unitsPerPackage', 1); // placeholder
                    updateVendorFlowStep(productId, 'currentStep', '', 3);
                  } else {
                    // Para KG/LITROS: ir para Step 2
                    updateVendorFlowStep(productId, 'currentStep', '', 2);
                  }
                }}
                className="h-16 text-base"
              >
                📦 Caixa
              </Button>
              <Button
                variant={packagingType === 'fardo' ? 'default' : 'outline'}
                onClick={() => {
                  updateVendorFlowStep(productId, 'packagingType', 'fardo');
                  // Para UNIDADES: pular Step 2, ir direto para Step 3
                  if (product.unit === 'Unidade(s)') {
                    updateVendorFlowStep(productId, 'unitsPerPackage', 1); // placeholder
                    updateVendorFlowStep(productId, 'currentStep', '', 3);
                  } else {
                    // Para KG/LITROS: ir para Step 2
                    updateVendorFlowStep(productId, 'currentStep', '', 2);
                  }
                }}
                className="h-16 text-base"
              >
                📄 Fardo
              </Button>
              <Button
                variant={packagingType === 'granel' ? 'default' : 'outline'}
                onClick={() => {
                  // Para granel, pular etapa 2 (unidades por caixa) e ir direto para peso/volume
                  updateVendorFlowStep(productId, 'packagingType', 'granel');
                  updateVendorFlowStep(productId, 'unitsPerPackage', 1); // Definir como 1 para granel (correto)
                  updateVendorFlowStep(productId, 'currentStep', '', 3);
                }}
                className="h-16 text-base"
              >
                🌾 A Granel
              </Button>
            </div>
          </div>
        );

      case 2:
        // Step 2: Só para KG/LITROS com CAIXA/FARDO
        // Pergunta sempre "Quantas unidades" (geralmente resposta = 1, ignorada no cálculo)
        return (
          <div className="space-y-4">
            <h4 className="text-lg font-semibold">
              Quantas unidades vêm na {packagingType}?
            </h4>
            <div className="space-y-2">
              <Input
                type="number"
                placeholder="Ex: 1"
                value={unitsPerPackage > 0 ? unitsPerPackage : ''}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || 0;
                  updateVendorFlowStep(productId, 'unitsPerPackage', value);
                }}
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
        const isGranelWeight = packagingType === 'granel';
        const isUnitProduct = product.unit === 'Unidade(s)';

        // Para UNIDADES com CAIXA/FARDO: perguntar quantidade de unidades
        if (isUnitProduct && !isGranelWeight) {
          return (
            <div className="space-y-4">
              <h4 className="text-lg font-semibold">
                Quantas unidades vêm na {packagingType}?
              </h4>
              <div className="space-y-2">
                <Input
                  type="number"
                  placeholder="Ex: 30"
                  value={unitsPerPackage > 0 ? unitsPerPackage : ''}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 0;
                    updateVendorFlowStep(productId, 'unitsPerPackage', value);
                  }}
                  className="text-lg h-12"
                />
                <Button
                  onClick={() => updateVendorFlowStep(productId, 'currentStep', '', 4)}
                  disabled={unitsPerPackage <= 0}
                  className="w-full"
                >
                  Próximo
                </Button>
              </div>
            </div>
          );
        }

        // Para KG/LITROS ou GRANEL: perguntar peso/volume
        const weightLabel = isGranelWeight
          ? (isLiquid ? 'volume por embalagem individual (Litros)' : 'peso por embalagem individual (Kg)')
          : (isLiquid ? `volume da ${packagingType} completa (Litros)` : `peso da ${packagingType} completa (Kg)`);

        const weightPlaceholder = isGranelWeight
          ? (isLiquid ? "Ex: 2,000" : "Ex: 1,000")
          : (isLiquid ? "Ex: 30,000" : "Ex: 25,000");

        return (
          <div className="space-y-4">
            <h4 className="text-lg font-semibold">
              Qual é o {weightLabel}?
            </h4>
            {!isGranelWeight && (
              <p className="text-sm text-muted-foreground">
                Este é o peso/volume total da {packagingType} completa com todas as {unitsPerPackage} unidades
              </p>
            )}
            <div className="space-y-2">
              <div className="relative">
                <Input
                  type={product.unit === 'Kilograma(s)' || product.unit === 'Litro(s)' ? "text" : "number"}
                  step="0.001"
                  placeholder={weightPlaceholder}
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
        const isGranelPrice = packagingType === 'granel';
        const priceLabel = isGranelPrice 
          ? 'preço por embalagem individual'
          : `preço ${packagingType === 'caixa' ? 'da caixa' : 'do fardo'} completa`;
          
        return (
          <div className="space-y-4">
            <h4 className="text-lg font-semibold">
              Qual o {priceLabel}?
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
        
        const isGranelQuantity = packagingType === 'granel';
        const packageLabel = isGranelQuantity 
          ? 'embalagens individuais'
          : `${packagingType === 'caixa' ? 'caixas' : 'fardos'}`;
        
        return (
          <div className="space-y-4">
            <h4 className="text-lg font-semibold">
              Para atender {product.quantity} {unitLabel} do pedido do comprador, 
              quantas {packageLabel} você precisa enviar?
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
        const isGranel = isGranelPackaging(packagingType);

        // CÁLCULO DO PREÇO POR UNIDADE
        // Para CAIXA/FARDO: preço_caixa / (unidades_por_caixa × peso_por_unidade)
        // Para GRANEL: preço_embalagem / peso_por_embalagem
        const pricePerUnit = isGranel
          ? packagePrice / (packageWeight || 1)  // Para granel: preço por embalagem / peso por embalagem
          : packagePrice / ((unitsPerPackage || 1) * (packageWeight || 1)); // Para caixa/fardo: preço por caixa / (unidades × peso unitário)
        
        // Calcular quantidade total oferecida
        console.log('🔍 [Vendor Flow Step 6] Before tempOffer creation:', {
          requiredPackages,
          unitsPerPackage,
          packageWeight,
          packagingType,
          isGranel,
          productUnit: product.unit,
          expectedCalculation: `${requiredPackages} caixas × ${unitsPerPackage} unid = ${requiredPackages * unitsPerPackage} unid`,
          'FLOW_DEBUG': {
            'COMPLETE_FLOW_OBJECT': JSON.stringify(flow, null, 2),
            'flow.unitsPerPackage': flow.unitsPerPackage,
            'flow.packageWeight': flow.packageWeight,
            'WHERE_DOES_UNITS_COME_FROM': 'Checking if flow.unitsPerPackage is correct',
            'packagingType_analysis': {
              'flow.packagingType': flow.packagingType,
              'packagingType_variable': packagingType,
              'IS_GRANEL': packagingType === 'granel',
              'isGranel': isGranel
            }
          }
        });
        
        const tempOffer: OfferWithUI = {
          unitsInPackaging: requiredPackages,
          unitsPerPackage: isGranel ? 1 : unitsPerPackage, // Para granel, sempre 1
          unitWeight: packageWeight,
          packagingType: isGranel ? 'bulk' : 'closed_package', // Adicionar tipo de embalagem
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
        
        console.log('🔍 [Vendor Flow Step 6] tempOffer created:', {
          tempOffer,
          'PROBLEM_ANALYSIS': {
            unitsPerPackage_in_tempOffer: tempOffer.unitsPerPackage,
            unitsPerPackage_from_flow: unitsPerPackage,
            packageWeight_from_flow: packageWeight,
            isGranel,
            'EXPECTED_FOR_AMIDO': 'unitsPerPackage should be 30 for Amido de milho'
          }
        });

        // Calculate offered quantity for display
        const offeredQuantity = calculateTotalOfferedQuantity(tempOffer, product);
        
        console.log('🔍 [Vendor Flow Step 6] After calculateTotalOfferedQuantity:', {
          tempOffer,
          offeredQuantity,
          expectedForAmido: `Should be ${requiredPackages} × ${unitsPerPackage} = ${requiredPackages * unitsPerPackage} for Amido de milho`
        });

        // For validation, compare in the same unit as the product
        const offeredAmount = offeredQuantity; // Already calculated in product's unit
        const requestedAmount = product.quantity; // Already in product's unit

        const boxValidation = validateBoxQuantityVariation(offeredAmount, requestedAmount);



        // Also store box count for display
        const offeredBoxes = flow.requiredPackages || 0;

        // Get modal state for this product
        const vendorFlowModalOpen = vendorFlowModalStates[productId] !== undefined
          ? vendorFlowModalStates[productId]
          : boxValidation.requiresModal;
        const vendorFlowDecision = vendorFlowDecisions[productId];

        // Open modal automatically if needed and not yet decided
        if (boxValidation.requiresModal && !vendorFlowDecision && !vendorFlowModalOpen) {
          setVendorFlowModalStates(prev => ({ ...prev, [productId]: true }));
        }

        const handleVendorFlowModalConfirm = async (
          decision: string,
          correctedData?: {
            unitsPerPackage?: number;
            unitWeight?: number;
            totalPackagingPrice?: number;
            packages?: number;
            quantity?: number;
            weight?: number;
            price?: number;
          }
        ) => {
          console.log('🔧 [Vendor Flow Modal Confirm] Received:', { decision, correctedData });

          setVendorFlowDecisions(prev => ({ ...prev, [productId]: { decision, correctedData } }));
          setVendorFlowModalStates(prev => ({ ...prev, [productId]: false }));

          if ((decision === 'typing_error' || decision === 'buyer_approval_excess') && correctedData) {
            const price = (correctedData as any).price ?? correctedData.totalPackagingPrice;
            
            const correctedFlowData = {
              requiredPackages: correctedData.packages,
              packageWeight: correctedData.unitWeight,
              unitsPerPackage: !isGranel ? correctedData.unitsPerPackage : undefined,
              packagePrice: price,
            };

            // Filtra chaves com valor undefined para não sobrescrever dados existentes desnecessariamente
            const payload = Object.fromEntries(
              Object.entries(correctedFlowData).filter(([, value]) => value !== undefined)
            );

            console.log('🔧 [Vendor Flow] Passing corrected data directly to completeVendorFlow:', payload);
            await completeVendorFlow(productId, payload);

          } else if (decision === 'adjust_to_request') {
            let requiredPackages;
            if (isGranel) {
              requiredPackages = Math.ceil(requestedAmount / packageWeight);
            } else {
              requiredPackages = Math.ceil(requestedAmount / unitsPerPackage);
            }
            console.log('🔧 [Vendor Flow] Adjusting to request, passing new requiredPackages:', requiredPackages);
            await completeVendorFlow(productId, { requiredPackages });
          
          } else if (decision !== 'cancel') {
            // Para outras decisões (como 'confirm_anyway'), completa com os dados do fluxo atual
            await completeVendorFlow(productId);
          }
          // Se a decisão for 'cancel', não faz nada, apenas fecha o modal
        };

        return (
          <>
            {/* Modal for quantity validation */}
            {boxValidation.requiresModal && (
              <>
                {console.log('🔍 [Vendor Flow Modal] Data being passed to modal:', {
                  productName: product.name,
                  requestedQuantity: requestedAmount,
                  offeredQuantity: offeredAmount,
                  offeredPackages: offeredBoxes,
                  unit: product.unit,
                  unitsPerPackage: unitsPerPackage,
                  unitWeight: packageWeight,
                  totalPackagingPrice: packagePrice,
                  packagingType: isGranel ? 'bulk' : 'closed_package',
                  boxValidation
                })}
                <QuantityShortageModal
                  isOpen={vendorFlowModalOpen}
                  onClose={() => {
                    setVendorFlowModalStates(prev => ({ ...prev, [productId]: false }));
                    cancelVendorFlow(productId);
                  }}
                  onConfirm={handleVendorFlowModalConfirm}
                  productName={product.name}
                  requestedQuantity={requestedAmount}
                  offeredQuantity={offeredAmount}
                  offeredPackages={offeredBoxes}
                  unit={product.unit}
                  unitsPerPackage={unitsPerPackage}
                  unitWeight={packageWeight}
                  totalPackagingPrice={packagePrice}
                  scenario={boxValidation.scenario}
                  variationAmount={boxValidation.variationAmount}
                  variationPercentage={boxValidation.variationPercentage}
                  packagingType={isGranel ? 'bulk' : 'closed_package'}
                />
              </>
            )}

            {/* Simple confirmation if no modal required */}
            {!boxValidation.requiresModal && (
              <div className="space-y-4">
                <h4 className="text-lg font-semibold">Confirme se os dados e valores estão corretos:</h4>

                {/* Mostrar aviso se houver variação */}
                {boxValidation.scenario !== 'exact' && (
                  <div className={`p-3 rounded-lg border ${
                    boxValidation.scenario === 'adequate'
                      ? 'bg-green-50 border-green-300 text-green-900'
                      : 'bg-yellow-50 border-yellow-300 text-yellow-900'
                  }`}>
                    <p className="text-sm font-semibold">
                      Pedido: {requestedAmount} {abbreviateUnit(product.unit)} |
                      Oferta: {offeredAmount.toFixed(3)} {abbreviateUnit(product.unit)}
                    </p>
                    <p className="text-xs mt-1">
                      {boxValidation.variationType === 'under'
                        ? `Faltam ${Math.abs(boxValidation.variationAmount).toFixed(3)} ${abbreviateUnit(product.unit)} (${Math.round(boxValidation.variationPercentage)}% a menos)`
                        : `Excesso de ${boxValidation.variationAmount.toFixed(3)} ${abbreviateUnit(product.unit)} (${Math.round(boxValidation.variationPercentage)}% a mais)`
                      }
                    </p>
                  </div>
                )}

                <div className="bg-muted/30 p-4 rounded-lg space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div><strong>Marca:</strong> {selectedBrand}</div>
                    <div><strong>Embalagem:</strong> {packagingType}</div>

                    {/* Para CAIXA/FARDO: mostrar unidades por embalagem */}
                    {!isGranel && (
                      <div><strong>Unidades por {packagingType}:</strong> {unitsPerPackage || 'N/A'}</div>
                    )}

                    {/* Para GRANEL: não mostrar unidades por embalagem, apenas peso/volume */}
                    <div><strong>{isGranel ? 'Peso/Volume por embalagem individual:' : `Peso/Volume da ${packagingType} completa:`}</strong> {(() => {
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

                    <div><strong>{isGranel ? 'Preço por embalagem individual:' : `Preço por ${packagingType}:`}</strong> {formatCurrency(packagePrice)}</div>
                    <div><strong>Quantidade a enviar:</strong> {requiredPackages} {isGranel ? 'embalagem(ns)' : `${packagingType}(s)`}</div>
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
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={() => completeVendorFlow(productId)}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    ✅ Confirmar Oferta
                  </Button>
                </div>
              </div>
            )}
          </>
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
                onClick={() => {
                  updateNewBrandFlowStep(productId, 'packagingType', 'caixa');
                  // Para UNIDADES: pular Step 3, ir direto para Step 4
                  if (product.unit === 'Unidade(s)') {
                    updateNewBrandFlowStep(productId, 'unitsPerPackage', 1); // placeholder
                    updateNewBrandFlowStep(productId, 'currentStep', '', 4);
                  } else {
                    // Para KG/LITROS: ir para Step 3
                    updateNewBrandFlowStep(productId, 'currentStep', '', 3);
                  }
                }}
                className="h-16 text-base"
              >
                📦 Caixa
              </Button>
              <Button
                variant={packagingType === 'fardo' ? 'default' : 'outline'}
                onClick={() => {
                  updateNewBrandFlowStep(productId, 'packagingType', 'fardo');
                  // Para UNIDADES: pular Step 3, ir direto para Step 4
                  if (product.unit === 'Unidade(s)') {
                    updateNewBrandFlowStep(productId, 'unitsPerPackage', 1); // placeholder
                    updateNewBrandFlowStep(productId, 'currentStep', '', 4);
                  } else {
                    // Para KG/LITROS: ir para Step 3
                    updateNewBrandFlowStep(productId, 'currentStep', '', 3);
                  }
                }}
                className="h-16 text-base"
              >
                📄 Fardo
              </Button>
              <Button
                variant={packagingType === 'granel' ? 'default' : 'outline'}
                onClick={() => {
                  // Para granel, pular etapa 3 (unidades por caixa) e ir direto para peso/volume
                  updateNewBrandFlowStep(productId, 'packagingType', 'granel');
                  updateNewBrandFlowStep(productId, 'unitsPerPackage', 1); // Definir como 1 para granel
                  updateNewBrandFlowStep(productId, 'currentStep', '', 4);
                }}
                className="h-16 text-base"
              >
                🌾 A Granel
              </Button>
            </div>
          </div>
        );

      case 3:
        // Step 3: Só para KG/LITROS com CAIXA/FARDO
        // Pergunta sempre "Quantas unidades" (geralmente resposta = 1, ignorada no cálculo)
        return (
          <div className="space-y-4">
            <h4 className="text-lg font-semibold">
              Quantas unidades vêm na {packagingType}?
            </h4>
            <div className="space-y-2">
              <Input
                type="number"
                placeholder="Ex: 1"
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
        const isGranelWeight = packagingType === 'granel';
        const isUnitProduct = product.unit === 'Unidade(s)';

        // Para UNIDADES com CAIXA/FARDO: perguntar quantidade de unidades
        if (isUnitProduct && !isGranelWeight) {
          return (
            <div className="space-y-4">
              <h4 className="text-lg font-semibold">
                Quantas unidades vêm na {packagingType} desta marca?
              </h4>
              <div className="space-y-2">
                <Input
                  type="number"
                  placeholder="Ex: 30"
                  value={unitsPerPackage > 0 ? unitsPerPackage : ''}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 0;
                    updateNewBrandFlowStep(productId, 'unitsPerPackage', value);
                  }}
                  className="text-lg h-12"
                />
                <Button
                  onClick={() => updateNewBrandFlowStep(productId, 'currentStep', '', 5)}
                  disabled={unitsPerPackage <= 0}
                  className="w-full bg-orange-600 hover:bg-orange-700"
                >
                  Próximo
                </Button>
              </div>
            </div>
          );
        }

        // Para KG/LITROS ou GRANEL: perguntar peso/volume
        const weightLabel = isGranelWeight
          ? (isLiquid ? 'volume por embalagem individual desta marca (Litros)' : 'peso por embalagem individual desta marca (Kg)')
          : (isLiquid ? `volume da ${packagingType} completa desta marca (Litros)` : `peso da ${packagingType} completa desta marca (Kg)`);

        const weightPlaceholder = isGranelWeight
          ? (isLiquid ? "Ex: 2,000" : "Ex: 1,000")
          : (isLiquid ? "Ex: 30,000" : "Ex: 25,000");

        return (
          <div className="space-y-4">
            <h4 className="text-lg font-semibold">
              Qual é o {weightLabel}?
            </h4>
            <div className="space-y-2">
              <div className="relative">
                <Input
                  type={product.unit === 'Kilograma(s)' || product.unit === 'Litro(s)' ? "text" : "number"}
                  step="0.001"
                  placeholder={weightPlaceholder}
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
        const isGranelPrice = packagingType === 'granel';
        const priceLabel = isGranelPrice 
          ? 'preço por embalagem individual desta marca'
          : `preço ${packagingType === 'caixa' ? 'da caixa' : 'do fardo'} completo desta marca`;
          
        return (
          <div className="space-y-4">
            <h4 className="text-lg font-semibold">Qual o {priceLabel}?</h4>
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
        
        const isGranelQuantity = packagingType === 'granel';
        const packageLabel = isGranelQuantity 
          ? 'embalagens individuais desta marca'
          : `${packagingType === 'caixa' ? 'caixas' : 'fardos'} desta marca`;
        
        return (
          <div className="space-y-4">
            <h4 className="text-lg font-semibold">
              Para atender {product.quantity} {unitLabel} do pedido do comprador, 
              quantas {packageLabel} você precisa enviar?
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
        const isGranelConfirm = packagingType === 'granel';
        
        // Calcular a quantidade oferecida baseada nos dados preenchidos
        const tempBrandOffer = {
          unitsInPackaging: flow.requiredPackages || 1,
          unitsPerPackage: isGranelConfirm ? 1 : unitsPerPackage,
          unitWeight: packageWeight,
          packagingType: isGranelConfirm ? 'bulk' : 'closed_package'
        };

        // Calculate offered quantity for display
        const offeredQuantity = calculateTotalOfferedQuantity(tempBrandOffer as any, product);

        const offeredBoxes = flow.requiredPackages || 0;
        const requestedBoxes = product.quantity;
        const boxValidation = validateBoxQuantityVariation(offeredQuantity, requestedBoxes); // Usar offeredQuantity ao invés de offeredBoxes

        const totalValue = (flow.requiredPackages || 1) * packagePrice;
        
        // CÁLCULO DO PREÇO POR UNIDADE para nova marca
        const pricePerUnit = isGranelConfirm 
          ? packagePrice / (packageWeight || 1)  // Para granel: preço por embalagem / peso por embalagem
          : packagePrice / ((unitsPerPackage || 1) * (packageWeight || 1)); // Para caixa/fardo: preço por caixa / (unidades × peso unitário)

        return (
          <div className="space-y-4">
            <h4 className="text-lg font-semibold">Confirme os dados da nova marca:</h4>

            {/* Alerta de variação de quantidade */}
            {!boxValidation.isValid && (
              <div className={`p-3 rounded-lg border-l-4 ${
                boxValidation.variationType === 'over'
                  ? 'bg-orange-50 border-orange-500 dark:bg-orange-950/20'
                  : 'bg-red-50 border-red-500 dark:bg-red-950/20'
              }`}>
                <div className="flex items-start gap-2">
                  <span className="text-lg">
                    {boxValidation.variationType === 'over' ? '⚠️' : '❌'}
                  </span>
                  <div className="text-sm">
                    <p className="font-semibold">
                      {boxValidation.variationType === 'over'
                        ? 'Quantidade Acima do Pedido'
                        : 'Quantidade Abaixo do Pedido'}
                    </p>
                    <p className="mt-1">
                      Pedido: <strong>{requestedBoxes} {abbreviateUnit(product.unit)}</strong> |
                      Oferta: <strong>{offeredQuantity.toFixed(3)} {abbreviateUnit(product.unit)}</strong>
                    </p>
                    <p className="mt-1 text-xs">
                      Variação: <strong>{boxValidation.variationAmount.toFixed(1)} {abbreviateUnit(product.unit)}</strong>
                      {boxValidation.variationType === 'over' ? ' a mais' : ' a menos'}
                    </p>
                    <p className="mt-2 text-xs font-semibold">
                      {boxValidation.shouldNotifyBuyer ? (
                        boxValidation.variationType === 'over'
                          ? '⚠️ O comprador será notificado sobre esta quantidade extra.'
                          : '⚠️ O comprador será notificado sobre esta falta.'
                      ) : (
                        '✓ Variação dentro da tolerância. Comprador não será notificado.'
                      )}
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
                
                {/* Para CAIXA/FARDO: mostrar unidades por embalagem */}
                {!isGranelConfirm && (
                  <div><strong>Unidades por embalagem:</strong> {unitsPerPackage}</div>
                )}
                
                <div><strong>{isGranelConfirm ? 'Peso/Volume por embalagem individual:' : `Peso/Volume por ${packagingType}:`}</strong> {(() => {
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
                
                <div><strong>{isGranelConfirm ? 'Preço por embalagem individual:' : `Preço por ${packagingType}:`}</strong> {formatCurrency(packagePrice)}</div>
                <div><strong>Quantidade a enviar:</strong> {flow.requiredPackages || 1} {isGranelConfirm ? 'embalagem(ns)' : `${packagingType}(s)`}</div>
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

  const brandInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const supplierDetailsCache = useRef(new Map<string, SupplierType>());
  const closingQuotationsRef = useRef(new Set<string>());
  const lastClickRef = useRef<{ action: string; timestamp: number } | null>(null);

  // Load quotation data with custom hook
  const {
    quotation,
    setQuotation,
    currentSupplierDetails,
    productsToQuote,
    setProductsToQuote,
    isLoading,
    pendingRequestsCache,
    stoppedQuotingProducts,
    setStoppedQuotingProducts,
  } = useQuotationData({
    quotationId,
    supplierId,
    toast,
    speak,
    voiceMessages,
    supplierDetailsCache,
  });
  const [unseenAlerts, setUnseenAlerts] = useState<string[]>([]);
  const [expandedProductIds, setExpandedProductIds] = useState<string[]>([]);
  const [showStopQuotingModal, setShowStopQuotingModal] = useState(false);
  const [offerToStop, setOfferToStop] = useState<{productId: string, offerUiId: string, productName: string} | null>(null);
  const [activeCategoryTab, setActiveCategoryTab] = useState<string>("all");
  const [hasSpokenTabMessage, setHasSpokenTabMessage] = useState(false);

  // Loading state para o fluxo guiado de nova marca
  const [isSubmittingGuidedBrand, setIsSubmittingGuidedBrand] = useState(false);

  // Vendor flow modal states (Etapa 6)
  const [vendorFlowModalStates, setVendorFlowModalStates] = useState<Record<string, boolean>>({});
  const [vendorFlowDecisions, setVendorFlowDecisions] = useState<Record<string, {
    decision: string;
    correctedData?: {
      unitsPerPackage?: number;
      unitWeight?: number;
      totalPackagingPrice?: number;
      packages?: number;
      quantity?: number;
      weight?: number;
    };
  }>>({});

  // Guided flows hook
  const {
    vendorFlow,
    startVendorFlow,
    updateVendorFlow,
    cancelVendorFlow,
    newBrandFlow,
    startNewBrandFlow,
    updateNewBrandFlow,
    cancelNewBrandFlow,
    wizardState,
    startWizard,
    updateWizard,
    cancelWizard,
  } = useGuidedFlows();

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

  // Helper function to check and block actions when quotation is ended
  const checkAndBlockIfQuotationEnded = useCallback((): boolean => {
    if (isQuotationEnded) {
      toast({
        title: "Ação Bloqueada",
        description: "Não é possível adicionar marcas em cotações encerradas.",
        variant: "destructive"
      });
      return true; // Blocked
    }
    return false; // Allowed
  }, [isQuotationEnded, toast]);

  // Custom hooks for offer and brand management
  const offerManagement = useOfferManagement({
    quotationId,
    supplierId,
    productsToQuote,
    setProductsToQuote,
    currentSupplierDetails,
    quotation,
    expandedProductIds,
    setExpandedProductIds,
    setUnseenAlerts,
    brandInputRefs,
    supplierDetailsCache,
    speak,
    voiceMessages,
  });

  const newBrandManagement = useNewBrandModal({
    quotation,
    currentSupplierDetails,
    supplierId,
    sellerUser,
    speak,
    voiceMessages,
    checkAndBlockIfQuotationEnded,
    startNewBrandFlow,
  });

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

  // Funções para nova marca (agora usando fluxo guiado ao invés de modal)
  // NOTE: Quotation and supplier data loading is handled by useQuotationData hook

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

  // NOTE: Brand requests loading is handled by useQuotationData hook

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

          // NOTE: Loading state is managed by useQuotationData hook
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
  // NOTE: initVendorFlow and updateVendorFlowStep are provided by useGuidedFlows hook as startVendorFlow and updateVendorFlow

  const updateVendorFlowStep = (productId: string, field: string, value: any, nextStep?: number) => {
    console.log('🔍 [updateVendorFlowStep] Called with:', {
      productId,
      field,
      value,
      nextStep,
      currentFlow: vendorFlow[`${productId}_vendor_flow`]
    });
    updateVendorFlow(productId, field as any, value, nextStep);
  };

  const completeVendorFlow = async (productId: string, correctedFlowData?: Partial<typeof vendorFlow[string]>) => {
    const flowKey = `${productId}_vendor_flow`;
    const originalFlow = vendorFlow[flowKey];
    
    if (!originalFlow || !currentSupplierDetails || !quotation) return;

    const flow = { ...originalFlow, ...correctedFlowData };
    console.log('✅ [completeVendorFlow] Using flow data:', { original: originalFlow, corrected: correctedFlowData, final: flow });

    const product = productsToQuote.find(p => p.id === productId);
    if (!product) return;

    // For unit-based products (Unidade(s)), packageWeight is not required - default to 1
    const isUnitProduct = product.unit === 'Unidade(s)';
    let finalPackageWeight = flow.packageWeight;
    if (isUnitProduct && (!finalPackageWeight || finalPackageWeight <= 0)) {
      finalPackageWeight = 1; // Default to 1 for unit products
    }

    // Verificar dados básicos
    if (!flow.selectedBrand.trim() || flow.requiredPackages <= 0 || flow.packagePrice <= 0) {
      toast({
        title: "Dados Inválidos",
        description: "Preencha marca, quantidade de caixas e preço.",
        variant: "destructive"
      });
      return;
    }

    // For weight/volume products, packageWeight is required
    if (!isUnitProduct && (!finalPackageWeight || finalPackageWeight <= 0)) {
      toast({
        title: "Dados Inválidos",
        description: "Preencha o peso/volume da embalagem.",
        variant: "destructive"
      });
      return;
    }

    // Determinar se é granel ou caixa/fardo
    const isGranelComplete = flow.packagingType === 'granel';

    // CÁLCULO DO PREÇO POR UNIDADE
    // Para GRANEL: preço_embalagem / peso_por_embalagem
    // Para CAIXA/FARDO: preço_caixa / (unidades_por_caixa × peso_por_unidade)
    const pricePerUnit = isGranelComplete
      ? flow.packagePrice / (finalPackageWeight || 1)  // Para granel: preço por embalagem / peso por embalagem
      : flow.packagePrice / ((flow.unitsPerPackage || 1) * (finalPackageWeight || 1)); // Para caixa/fardo: preço por caixa / (unidades × peso unitário)

    // Criar nova oferta com dados do fluxo guiado
    const newOfferUiId = Date.now().toString() + Math.random().toString(36).substring(2,7);
    
    const newOffer: OfferWithUI = {
      uiId: newOfferUiId,
      quotationId: quotationId,
      supplierId: supplierId,
      supplierName: currentSupplierDetails.empresa || "N/A",
      supplierInitials: currentSupplierDetails.empresa?.substring(0, 2).toUpperCase() || "XX",
      brandOffered: flow.selectedBrand,
      packagingDescription: `${flow.requiredPackages} ${isGranelComplete ? 'embalagem(ns)' : `${flow.packagingType}(s)`}`,
      unitsInPackaging: flow.requiredPackages,
      unitsPerPackage: isGranelComplete ? 1 : flow.unitsPerPackage, // Para granel, sempre 1
      unitWeight: finalPackageWeight,
      totalPackagingPrice: flow.packagePrice,
      pricePerUnit: pricePerUnit,
      updatedAt: serverTimestamp() as Timestamp,
      productId: productId,
      isSuggestedBrand: false,
      packagingType: isGranelComplete ? 'bulk' : 'closed_package', // Adicionar tipo de embalagem
    };

    try {
      // Salvar automaticamente no Firestore
      const offerPayload: Omit<Offer, 'id'> = {
        quotationId: quotationId,
        supplierId: currentSupplierDetails.id,
        supplierName: currentSupplierDetails.empresa,
        supplierInitials: currentSupplierDetails.empresa.substring(0, 2).toUpperCase(),
        brandOffered: flow.selectedBrand,
        packagingDescription: `${flow.requiredPackages} ${isGranelComplete ? 'embalagem(ns)' : `${flow.packagingType}(s)`}`,
        unitsInPackaging: flow.requiredPackages,
        unitsPerPackage: isGranelComplete ? 1 : flow.unitsPerPackage, // Para granel, sempre 1
        unitWeight: finalPackageWeight,
        totalPackagingPrice: flow.packagePrice,
        pricePerUnit: pricePerUnit,
        updatedAt: serverTimestamp() as Timestamp,
        productId: productId,
        packagingType: isGranelComplete ? 'bulk' : 'closed_package', // Adicionar tipo de embalagem
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

      // Verificar variação de quantidade e notificar comprador se necessário
      const offeredQuantity = calculateTotalOfferedQuantity({
        unitsInPackaging: flow.requiredPackages || 0,
        unitsPerPackage: isGranelComplete ? 1 : flow.unitsPerPackage,
        unitWeight: finalPackageWeight,
        packagingType: isGranelComplete ? 'bulk' : 'closed_package',
      }, product);
      const requestedQuantity = product.quantity;
      const boxValidation = validateBoxQuantityVariation(offeredQuantity, requestedQuantity);

      console.log('📊 [Vendor Flow - Quantity Validation]', {
        productName: product.name,
        offeredQuantity,
        requestedQuantity,
        isValid: boxValidation.isValid,
        shouldNotifyBuyer: boxValidation.shouldNotifyBuyer,
        variationType: boxValidation.variationType,
        variationAmount: boxValidation.variationAmount,
      });

      // Notificar o comprador internamente (sistema de notificações do sino)
      // Don't notify if variationType is 'exact' (no variation)
      if (boxValidation.shouldNotifyBuyer && quotation.userId && boxValidation.variationType !== 'exact') {


        try {
          const result = await notifyQuantityVariation({
            userId: quotation.userId,
            quotationId: quotationId,
            quotationName: quotation.name || `Cotação #${quotationId.slice(-6)}`,
            productId: product.id,
            productName: product.name,
            supplierName: currentSupplierDetails.empresa,
            supplierId: supplierId,
            brandName: flow.selectedBrand,
            requestedQuantity: product.quantity,
            offeredPackages: flow.requiredPackages,
            unit: product.unit,
            offerId: newOfferDocRef.id,
            unitsPerPackage: isGranelComplete ? 1 : flow.unitsPerPackage,
            unitWeight: finalPackageWeight,
            totalPackagingPrice: flow.packagePrice,
          });

          if (result.success) {
            console.log('✅ [Vendor Flow] Internal notification created successfully', {
              productName: product.name,
              notificationId: result.id,
            });
          } else {
            console.warn('⚠️ [Vendor Flow] Failed to create notification:', result.error);
          }
        } catch (notifError: any) {
          console.error('❌ [Vendor Flow] Exception while creating notification:', {
            error: notifError.message,
            code: notifError.code,
          });
        }
      } else {
        console.log('ℹ️ [Vendor Flow] No notification needed', {
          shouldNotifyBuyer: boxValidation.shouldNotifyBuyer,
          hasUserId: !!quotation.userId,
        });
      }

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
      cancelVendorFlow(productId);
    }
  };

  // NOTE: cancelVendorFlow is provided by useGuidedFlows hook

  // Funções para controlar o fluxo guiado de nova marca
  // NOTE: startNewBrandFlow, updateNewBrandFlow, cancelNewBrandFlow are provided by useGuidedFlows hook

  const updateNewBrandFlowStep = (productId: string, field: string, value: any, nextStep?: number) => {
    updateNewBrandFlow(productId, field as any, value, nextStep);
  };

  const completeNewBrandFlow = async (productId: string) => {
    const flowKey = `${productId}_brand_flow`;
    const flow = newBrandFlow[flowKey];
    
    if (!flow || !currentSupplierDetails || !quotation) return;

    const product = productsToQuote.find(p => p.id === productId);
    if (!product) return;

    // For unit-based products (Unidade(s)), packageWeight is not required - default to 1
    const isUnitProduct = product.unit === 'Unidade(s)';
    let finalPackageWeight = flow.packageWeight;
    if (isUnitProduct && (!finalPackageWeight || finalPackageWeight <= 0)) {
      finalPackageWeight = 1; // Default to 1 for unit products
    }

    // Verificar se os dados atendem à quantidade solicitada
    const tempBrandOffer = {
      unitsInPackaging: flow.requiredPackages || 1, // Usar a quantidade informada pelo vendedor
      unitsPerPackage: flow.packagingType === 'granel' ? 1 : flow.unitsPerPackage,
      unitWeight: finalPackageWeight
    };

    // Verificar dados básicos
    if (!flow.brandName.trim() || flow.unitsPerPackage <= 0 || flow.packagePrice <= 0 || flow.requiredPackages <= 0) {
      toast({
        title: "Dados Inválidos",
        description: "Preencha nome da marca, unidades, preço e quantidade.",
        variant: "destructive"
      });
      return;
    }

    // For weight/volume products, packageWeight is required
    if (!isUnitProduct && (!finalPackageWeight || finalPackageWeight <= 0)) {
      toast({
        title: "Dados Inválidos",
        description: "Preencha o peso/volume da embalagem.",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsSubmittingGuidedBrand(true);

      // Upload da imagem se fornecida
      let imageUrl = '';
      if (flow.imageFile) {
        imageUrl = await uploadImageToVercelBlob(flow.imageFile);
      }

      // Calcular preço por unidade
      const pricePerUnit = flow.packagePrice / (flow.unitsPerPackage * finalPackageWeight);

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
        unitWeight: finalPackageWeight,
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
      setIsSubmittingGuidedBrand(false);
    }
  };

  // Destructure offer management functions from hook
  const {
    isSaving,
    weightInputValues,
    editingOffers,
    savingOffers,
    handleOfferChange,
    handlePriceChange,
    handleWeightChange,
    getWeightDisplayValue,
    toggleEditMode,
    isInEditMode,
    addOfferField,
    removeOfferField,
    handleSaveProductOffer,
  } = offerManagement;

  // Destructure new brand management functions from hook
  const {
    newBrandModal,
    newBrandForm,
    isSubmittingNewBrand,
    openNewBrandModal,
    closeNewBrandModal,
    handleNewBrandFormChange,
    uploadImageToVercelBlob,
    submitNewBrandRequest,
  } = newBrandManagement;

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

  const handleStopQuotingClick = (productId: string, offerUiId: string, productName: string) => {
    setOfferToStop({ productId, offerUiId, productName });
    setShowStopQuotingModal(true);
  };

  const confirmStopQuoting = async () => {
    if (!offerToStop || !supplierId) return;

    const { productId, offerUiId } = offerToStop;
    const product = productsToQuote.find(p => p.id === productId);
    const offer = product?.supplierOffers.find(o => o.uiId === offerUiId);

    try {
      // 1. Remove a oferta do banco de dados (se existir)
      if (offer && offer.id) {
        await removeOfferField(productId, offer);
      }

      // 2. Salva no banco que este fornecedor parou de cotar este produto
      const productRef = doc(db, SHOPPING_LIST_ITEMS_COLLECTION, productId);
      await updateDoc(productRef, {
        stoppedQuotingSuppliers: arrayUnion(supplierId)
      });

      // 3. Atualiza estado local
      setStoppedQuotingProducts(prev => new Set(prev).add(productId));

      setShowStopQuotingModal(false);
      setOfferToStop(null);
      toast({
        title: "Parou de Cotar",
        description: `Você parou de cotar "${offerToStop.productName}". Não poderá mais fazer ofertas para este item nesta cotação.`,
      });
    } catch (error: any) {
      toast({
        title: "Erro ao Parar de Cotar",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handleSuggestedBrandClick = (productId: string, brandName: string) => {
    // Verificação de segurança: bloquear se cotação encerrada
    if (checkAndBlockIfQuotationEnded()) return;

    // Iniciar o fluxo guiado do vendedor
    startVendorFlow(productId, brandName);

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
                                          const isLowestOverall = product.lowestPriceThisProductHas !== null && offer.pricePerUnit === product.lowestPriceThisProductHas;

                                          return (
                                              <CompetitorOfferCard
                                                key={offer.brandName + offer.supplierId}
                                                brandName={offer.brandName}
                                                supplierId={offer.supplierId}
                                                supplierName={offer.supplierName}
                                                supplierInitials={offer.supplierInitials}
                                                supplierFotoUrl={offer.supplierFotoUrl}
                                                supplierFotoHint={offer.supplierFotoHint}
                                                vendedor={offer.vendedor}
                                                cnpj={offer.cnpj}
                                                pricePerUnit={offer.pricePerUnit}
                                                productUnit={offer.productUnit}
                                                unitsInPackaging={offer.unitsInPackaging}
                                                unitWeight={offer.unitWeight}
                                                totalPackagingPrice={offer.totalPackagingPrice}
                                                isSelf={offer.isSelf}
                                                isLowestOverall={isLowestOverall}
                                                formatCurrency={formatCurrency}
                                                abbreviateUnit={abbreviateUnit}
                                                formatPackaging={formatPackaging}
                                                isValidImageUrl={isValidImageUrl}
                                              />
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
                                      {product.pendingBrandRequests?.map(request => (
                                        <BrandRequestCard
                                          key={request.id || `brand-${request.brandName}`}
                                          id={request.id || ''}
                                          brandName={request.brandName}
                                          supplierName={request.supplierName}
                                          supplierInitials={request.supplierInitials}
                                          imageUrl={request.imageUrl}
                                          status={request.status}
                                          unitsInPackaging={request.unitsInPackaging}
                                          unitWeight={request.unitWeight}
                                          totalPackagingPrice={request.totalPackagingPrice}
                                          pricePerUnit={request.pricePerUnit}
                                          productUnit={product.unit}
                                          formatCurrency={formatCurrency}
                                          abbreviateUnit={abbreviateUnit}
                                          formatPackaging={formatPackaging}
                                        />
                                      ))}
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
                                           formatCurrency,
                                           vendorFlowModalStates,
                                           setVendorFlowModalStates,
                                           vendorFlowDecisions,
                                           setVendorFlowDecisions
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
                                       
                                                                              // Ativar showBeatOfferOptions automaticamente quando estiver perdendo
                                                                              if (isMyOfferOutbid && !offer.showBeatOfferOptions) {
                                                                                setTimeout(() => {
                                                                                  handleOfferChange(product.id, offer.uiId, 'showBeatOfferOptions', true);
                                                                                }, 0);
                                                                              }
                                             
                                       if (hasMyOffers && pricePerUnit !== null && bestCompetitorOfferOverall) {
                                          if(pricePerUnit <= bestCompetitorOfferOverall.pricePerUnit) {
                                            pricePerUnitClasses = "bg-green-500/10 border-green-500/40 text-green-700 font-semibold";
                                          } else if (pricePerUnit > bestCompetitorOfferOverall.pricePerUnit) {
                                            pricePerUnitClasses = "bg-destructive/10 border-destructive/30 text-destructive font-semibold";
                                          }
                                       }
      

                                       
                                       // Card padrão (formulário) - usando componente
                                       const totalOrderValue = (Number(offer.unitsInPackaging) || 0) * (Number(offer.totalPackagingPrice) || 0);

                                       return (
                                        <div key={`${product.id}-${offerIndex}-${offer.uiId}`}>
                                        {/* Render discount buttons if product.counterProposalInfo exists */}
                                        {product.counterProposalInfo && (
                                          <div className="flex flex-wrap gap-2 mt-2 mb-2">
                                            <span className="text-sm font-medium text-muted-foreground">Aplicar Desconto:</span>
                                            {[1, 2, 3, 4, 5].map(discount => (
                                              <Button
                                                key={discount}
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleBeatOfferClick(product.id, offer.uiId, discount)}
                                                disabled={isOfferDisabled || isButtonDisabled}
                                                className="border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white"
                                              >
                                                {discount}%
                                              </Button>
                                            ))}
                                          </div>
                                        )}
                                          <OfferFormCard
                                            offer={offer}
                                            product={product}
                                            pricePerUnit={pricePerUnit}
                                            pricePerUnitClasses={pricePerUnitClasses}
                                            totalOrderValue={totalOrderValue}
                                            isOfferDisabled={isOfferDisabled}
                                            isButtonDisabled={isButtonDisabled}
                                            isQuotationEnded={isQuotationEnded}
                                            handleOfferChange={handleOfferChange}
                                            handleWeightChange={handleWeightChange}
                                            handlePriceChange={handlePriceChange}
                                            handleSaveProductOffer={handleSaveProductOffer}
                                            onRequestStopQuoting={(productId) => handleStopQuotingClick(productId, offer.uiId, product.name)}
                                            formatCurrency={formatCurrency}
                                            formatCurrencyInput={formatCurrencyInput}
                                            abbreviateUnit={abbreviateUnit}
                                            getWeightDisplayValue={getWeightDisplayValue}
                                            toggleEditMode={toggleEditMode}
                                            isInEditMode={isInEditMode}
                                          />
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

      {/* Quantity Shortage Modal */}
      {offerManagement.showQuantityShortageModal && offerManagement.quantityShortageContext && (() => {
        const ctx = offerManagement.quantityShortageContext;
        // Calculate offered quantity in product's unit
        const offeredAmount = calculateTotalOfferedQuantity(ctx.offerData, ctx.product);
        const offeredPackages = Number(ctx.offerData.unitsInPackaging) || 0;

        return (
          <QuantityShortageModal
            isOpen={offerManagement.showQuantityShortageModal}
            onClose={offerManagement.handleCloseQuantityShortageModal}
            onConfirm={offerManagement.handleQuantityShortageDecision}
            productName={ctx.product.name}
            requestedQuantity={ctx.product.quantity}
            offeredQuantity={offeredAmount}
            offeredPackages={offeredPackages}
            unit={ctx.product.unit}
            unitsPerPackage={Number(ctx.offerData.unitsPerPackage) || 0}
            unitWeight={Number(ctx.offerData.unitWeight) || 0}
            totalPackagingPrice={Number(ctx.offerData.totalPackagingPrice) || 0}
            scenario={ctx.scenario}
            variationPercentage={ctx.variationPercentage}
            variationAmount={ctx.variationAmount}
            packagingType={ctx.offerData.packagingType || 'closed_package'}
          />
        );
      })()}
    </div>
  );
}