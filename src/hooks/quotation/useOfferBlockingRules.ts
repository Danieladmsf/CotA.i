"use client";

import type { CounterProposalInfo } from "./useCounterProposalLogic";
import { isCounterProposalExpired } from "./useCounterProposalLogic";

export interface BlockingConditions {
  isQuotationEnded: boolean;
  isLockedOut: boolean;
  isStoppedQuoting: boolean;
  counterProposalInfo: CounterProposalInfo | null;
  isOfferSaved: boolean;
  isInEditMode: boolean;
  isSaving: boolean;
}

export interface BlockingResult {
  isOfferDisabled: boolean;
  isBrandFieldDisabled: boolean;
  isButtonDisabled: boolean;
  isBadgeDisabled: boolean;
}

export function calculateBlockingRules(
  conditions: BlockingConditions,
  isSuggestedBrand: boolean = false
): BlockingResult {
  const {
    isQuotationEnded,
    isLockedOut,
    isStoppedQuoting,
    counterProposalInfo,
    isOfferSaved,
    isInEditMode,
    isSaving
  } = conditions;

  // Regra principal: oferta está desabilitada se:
  const isOfferDisabled = Boolean(
    isQuotationEnded ||                           // 1. Cotação encerrada
    isLockedOut ||                                // 2. Produto bloqueado (perdeu contraproposta)
    isStoppedQuoting ||                           // 3. Fornecedor parou de cotar
    isCounterProposalExpired(counterProposalInfo) || // 4. Contraproposta expirada
    (isOfferSaved && !isInEditMode)              // 5. Oferta salva e não em edição
  );

  // Campo de marca também desabilitado para marcas sugeridas (não editáveis)
  const isBrandFieldDisabled = Boolean(
    isOfferDisabled || isSuggestedBrand
  );

  // Botões desabilitados durante salvamento ou pelas mesmas regras
  const isButtonDisabled = Boolean(
    isSaving ||
    isQuotationEnded ||
    isLockedOut ||
    isStoppedQuoting ||
    isCounterProposalExpired(counterProposalInfo)
  );

  // Badges (marcas sugeridas, nova marca) desabilitadas pelas mesmas regras de bloqueio
  const isBadgeDisabled = Boolean(
    isQuotationEnded ||
    isLockedOut ||
    isStoppedQuoting ||
    isCounterProposalExpired(counterProposalInfo)
  );

  return {
    isOfferDisabled,
    isBrandFieldDisabled,
    isButtonDisabled,
    isBadgeDisabled
  };
}
