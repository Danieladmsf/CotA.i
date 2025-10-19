/**
 * Quotation Utility Functions
 *
 * Centralized utility functions for quotation formatting, calculations,
 * and validation used across the supplier portal quotation system.
 */

import { UnitOfMeasure, Offer } from "@/types";
import { formatCurrency } from "@/lib/utils";

// ============================================================================
// CONSTANTS
// ============================================================================

export const dayMap = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];

// ============================================================================
// BRAND & ARRAY UTILITIES
// ============================================================================

/**
 * Handles preferredBrands as both string and array, filtering out invalid entries
 */
export const getPreferredBrandsArray = (preferredBrands: string | string[] | undefined): string[] => {
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

// ============================================================================
// UNIT FORMATTING
// ============================================================================

/**
 * Abbreviates unit of measure for display
 */
export const abbreviateUnit = (unit: UnitOfMeasure | string): string => {
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

/**
 * Gets dynamic weight label based on product unit
 */
export const getDynamicWeightLabel = (unit: string): string => {
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

/**
 * Gets dynamic weight placeholder based on product unit
 */
export const getDynamicWeightPlaceholder = (unit: string): string => {
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

/**
 * Gets unit suffix for display
 */
export const getUnitSuffix = (unit: string): string => {
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

// ============================================================================
// CURRENCY FORMATTING
// ============================================================================

/**
 * Formats currency value from cents to BRL string
 */
export const formatCurrencyInput = (centavos: number): string => {
  const reais = centavos / 100;
  return reais.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

/**
 * Parses currency string to cents (integer)
 */
export const parseCurrencyInput = (value: string): number => {
  // Remove tudo exceto números
  const numbersOnly = value.replace(/[^\d]/g, '');
  // Converte para centavos (número inteiro)
  return parseInt(numbersOnly) || 0;
};

/**
 * Handles currency input change and formats it
 */
export const handleCurrencyInputChange = (value: string): string => {
  const centavos = parseCurrencyInput(value);
  return formatCurrencyInput(centavos);
};

// ============================================================================
// WEIGHT FORMATTING (Kg/L)
// ============================================================================

/**
 * Formats weight from grams to Kg string
 */
export const formatWeightInputForKg = (gramas: number): string => {
  const kg = gramas / 1000;
  return kg.toFixed(3).replace('.', ',');
};

/**
 * Parses weight string to grams (integer)
 */
export const parseWeightInputForKg = (value: string): number => {
  const numbersOnly = value.replace(/[^\d]/g, '');
  return parseInt(numbersOnly) || 0;
};

/**
 * Handles weight input change and formats it for Kg/L
 */
export const handleWeightInputChangeForKg = (value: string): string => {
  const gramas = parseWeightInputForKg(value);
  return formatWeightInputForKg(gramas);
};

// ============================================================================
// SMART FORMATTING (Adaptive)
// ============================================================================

/**
 * Smart weight formatting that adapts to unit (shows grams if < 1Kg, etc)
 */
export const formatSmartWeight = (weight: number, unit: UnitOfMeasure | string): string => {
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

/**
 * Formats packaging description (e.g., "12×500g")
 */
export const formatPackaging = (quantity: number, weight: number, unit: UnitOfMeasure | string): string => {
  return `${quantity}×${formatSmartWeight(weight, unit)}`;
};

// ============================================================================
// QUANTITY CALCULATIONS - LÓGICA MACRO
// ============================================================================

/**
 * Detecta se o tipo de embalagem é GRANEL
 * @param packagingType - Tipo de embalagem ('bulk' ou 'closed_package')
 */
export const isGranelPackaging = (packagingType: string): boolean => {
  return packagingType === 'bulk' || packagingType === 'granel' || packagingType === 'a granel';
};

/**
 * Calcula quantidade total oferecida baseado no tipo de embalagem E unidade do produto
 *
 * LÓGICA COMPLETA:
 * 1. GRANEL: sempre packagesCount × unitWeight
 * 2. CAIXA/FARDO + KG/LITROS: packagesCount × unitWeight
 * 3. CAIXA/FARDO + UNIDADES: packagesCount × unitsPerPackage
 */
export const calculateTotalOfferedQuantity = (offer: any, product: any): number => {
  const packagesCount = Number(offer.unitsInPackaging) || 0;
  const unitsPerPackage = Number(offer.unitsPerPackage) || 0;
  const unitWeight = Number(offer.unitWeight) || 0;
  const packagingType = offer.packagingType || 'closed_package';

  // Detectar unidade do produto
  const productUnit = product?.unit || '';
  const isWeightVolume =
    productUnit === 'Kilograma(s)' ||
    productUnit === 'Grama(s)' ||
    productUnit === 'Litro(s)' ||
    productUnit === 'Mililitro(s)';

  // 🌾 MODO 1: GRANEL
  // Sempre usa: packagesCount × unitWeight
  if (isGranelPackaging(packagingType)) {
    return packagesCount * unitWeight;
  }

  // 📦 MODO 2: CAIXA/FARDO com KG/LITROS
  // Usa: packagesCount × unitWeight
  // Exemplo: 3 caixas × 30 kg = 90 kg
  if (isWeightVolume) {
    return packagesCount * unitWeight;
  }

  // 📦 MODO 3: CAIXA/FARDO com UNIDADES
  // Usa: packagesCount × unitsPerPackage
  // Exemplo: 3 caixas × 30 unid = 90 unidades
  return packagesCount * unitsPerPackage;
};

/**
 * Validates quantity variation against requested quantity
 */
export const validateQuantityVariation = (
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

export const validateBoxQuantityVariation = (
  offeredQuantity: number,
  requestedQuantity: number
): {
  isValid: boolean;
  variationType?: 'over' | 'under' | 'exact';
  variationAmount: number;
  shouldNotifyBuyer: boolean;
  variationPercentage: number;
  scenario: 'adequate' | 'insufficient' | 'very_insufficient' | 'exact' | 'excess' | 'valid';
  requiresModal: boolean;
} => {
  if (requestedQuantity <= 0) {
    return {
      isValid: true,
      variationAmount: 0,
      shouldNotifyBuyer: false,
      variationPercentage: 0,
      scenario: 'valid',
      requiresModal: false,
    };
  }

  const variationAmount = offeredQuantity - requestedQuantity;
  const variationPercentage = Math.abs(variationAmount / requestedQuantity) * 100;

  if (offeredQuantity === requestedQuantity) {
    return {
      isValid: true,
      variationType: 'exact',
      variationAmount: 0,
      shouldNotifyBuyer: false,
      variationPercentage: 0,
      scenario: 'exact',
      requiresModal: false,
    };
  }

  if (offeredQuantity < requestedQuantity) {
    // SEMPRE mostrar modal se faltou QUALQUER quantidade (sem tolerância)
    if (variationPercentage <= 50) {
      return {
        isValid: false,
        variationType: 'under',
        variationAmount: Math.abs(variationAmount),
        shouldNotifyBuyer: true,
        variationPercentage,
        scenario: 'insufficient',
        requiresModal: true, // SEMPRE mostrar modal se faltou
      };
    }
    return {
      isValid: false,
      variationType: 'under',
      variationAmount: Math.abs(variationAmount),
      shouldNotifyBuyer: true,
      variationPercentage,
      scenario: 'very_insufficient',
      requiresModal: true,
    };
  }

  // Excesso
  return {
    isValid: false,
    variationType: 'over',
    variationAmount: variationAmount,
    shouldNotifyBuyer: true,
    variationPercentage,
    scenario: 'excess',
    requiresModal: true,
  };
};

// ============================================================================
// TITLE BUILDING
// ============================================================================

/**
 * Builds dynamic product title based on offer data
 */
export const buildDynamicTitle = (
  productName: string,
  offer: any | undefined,
  productUnit: UnitOfMeasure
): string => {
  if (!offer) return productName;

  let title = productName;

  // Adiciona marca com hífen se preenchida
  if (offer.brandOffered && offer.brandOffered.trim()) {
    title += ` - ${offer.brandOffered}`;
  }

  // Detectar se é produto de unidade
  const isUnitProduct = productUnit === 'Unidade(s)';

  // Adiciona embalagem - lógica diferente para unidades vs peso/volume
  if (isUnitProduct) {
    // Para produtos de UNIDADE: mostrar apenas unitsPerPackage
    if (offer.unitsPerPackage > 0) {
      title += ` ${offer.unitsPerPackage}${abbreviateUnit(productUnit)}`;
    }
  } else {
    // Para produtos de PESO/VOLUME: mostrar unitsInPackaging × unitWeight
    if (offer.unitsInPackaging > 0 && offer.unitWeight && offer.unitWeight > 0) {
      title += ` ${formatPackaging(offer.unitsInPackaging, offer.unitWeight, productUnit)}`;
    }
  }

  // Adiciona preço se preenchido
  if (offer.totalPackagingPrice > 0) {
    title += ` | ${formatCurrency(offer.totalPackagingPrice)}`;
  }

  return title;
};

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validates if URL is a valid image URL
 */
export const isValidImageUrl = (url?: string): url is string => {
  return !!url && (url.startsWith('http') || url.startsWith('data:'));
};
