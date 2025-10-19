"use client";

import { Timestamp } from "firebase/firestore";
import type { Quotation, Offer } from "@/types";

export interface CounterProposalInfo {
  deadline: Date;
  winningBrand: string;
  myBrand: string;
}

export interface CounterProposalResult {
  counterProposalInfo: CounterProposalInfo | null;
  isLockedOut: boolean;
}

export function calculateCounterProposalStatus(
  quotation: Quotation,
  supplierId: string,
  allOffers: Offer[],
  lowestPriceOverall: number | null
): CounterProposalResult {
  const myOffers = allOffers.filter(o => o.supplierId === supplierId);
  const myOffersWithPrice = myOffers.filter(o => o.pricePerUnit > 0);

  let counterProposalInfo: CounterProposalInfo | null = null;
  let isLockedOut = false;

  if (myOffersWithPrice.length === 0) {
    return { counterProposalInfo, isLockedOut };
  }

  // Encontra minha melhor oferta
  const myBestOffer = myOffersWithPrice.reduce((prev, curr) =>
    (prev.pricePerUnit < curr.pricePerUnit ? prev : curr)
  );
  const myBestPrice = myBestOffer.pricePerUnit;

  // Verifica se fui superado
  if (!lowestPriceOverall || myBestPrice <= lowestPriceOverall) {
    return { counterProposalInfo, isLockedOut };
  }

  // Encontra a oferta que me superou
  const outbidOffer = allOffers
    .filter(o =>
      o.supplierId !== supplierId &&
      o.pricePerUnit === lowestPriceOverall &&
      o.updatedAt instanceof Timestamp
    )
    .sort((a, b) =>
      (b.updatedAt as Timestamp).toMillis() - (a.updatedAt as Timestamp).toMillis()
    )[0];

  if (!outbidOffer || !(outbidOffer.updatedAt instanceof Timestamp)) {
    return { counterProposalInfo, isLockedOut };
  }

  const counterProposalMins = quotation.counterProposalTimeInMinutes ?? 15;
  const deadline = new Date(
    outbidOffer.updatedAt.toDate().getTime() + counterProposalMins * 60000
  );

  // Sempre retorna as informações da contraproposta se ela existir
  counterProposalInfo = {
    deadline,
    winningBrand: outbidOffer.brandOffered,
    myBrand: myBestOffer.brandOffered,
  };

  // Verifica se o prazo expirou para definir o lockout
  const now = new Date();
  if (now >= deadline) {
    const competingSuppliersCount = new Set(
      allOffers.filter(o => o.pricePerUnit > 0).map(o => o.supplierId)
    ).size;

    const isQuotationOpen =
      quotation.status === 'Aberta' &&
      quotation.deadline &&
      now < (quotation.deadline as Timestamp).toDate();

    // Só bloqueia se houver competição E a cotação principal estiver fechada
    if (competingSuppliersCount > 1 && !isQuotationOpen) {
      isLockedOut = true;
    }
  }

  return { counterProposalInfo, isLockedOut };
}

export function isCounterProposalExpired(counterProposalInfo: CounterProposalInfo | null): boolean {
  if (!counterProposalInfo) return false;
  return new Date() > counterProposalInfo.deadline;
}
