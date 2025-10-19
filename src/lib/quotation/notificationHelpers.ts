"use client";

import { getDoc, doc } from "firebase/firestore";
import { db } from "@/lib/config/firebase";
import { sendOutbidNotification } from "@/actions/notificationActions";
import { formatCurrency } from "@/lib/utils";
import type { Quotation, Fornecedor as SupplierType, UnitOfMeasure } from "@/types";

const FORNECEDORES_COLLECTION = "fornecedores";

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

interface BestOffer {
  supplierId: string;
  brandName: string;
  pricePerUnit: number;
  isSelf: boolean;
}

interface Product {
  name: string;
  unit: string;
}

interface HandleOutbidNotificationParams {
  previousBestOffer: BestOffer | null;
  newPricePerUnit: number;
  product: Product;
  quotation: Quotation;
  currentSupplierDetails: SupplierType;
  supplierDetailsCache: Map<string, SupplierType>;
  onError?: (message: string) => void;
}

/**
 * Handles outbid notification logic when a supplier offers a better price.
 * Fetches the outbid supplier details (if needed) and sends the notification.
 */
export async function handleOutbidNotification({
  previousBestOffer,
  newPricePerUnit,
  product,
  quotation,
  currentSupplierDetails,
  supplierDetailsCache,
  onError,
}: HandleOutbidNotificationParams): Promise<void> {
  // Only notify if there was a previous best offer from another supplier and new price is better
  if (
    !previousBestOffer ||
    previousBestOffer.isSelf ||
    newPricePerUnit >= previousBestOffer.pricePerUnit
  ) {
    return;
  }


  let outbidSupplierDetails = supplierDetailsCache.get(
    previousBestOffer.supplierId
  );

  if (!outbidSupplierDetails) {
    try {
      const docSnap = await getDoc(
        doc(db, FORNECEDORES_COLLECTION, previousBestOffer.supplierId)
      );
      if (docSnap.exists()) {
        outbidSupplierDetails = {
          id: docSnap.id,
          ...docSnap.data(),
        } as SupplierType;
        supplierDetailsCache.set(
          previousBestOffer.supplierId,
          outbidSupplierDetails
        );
      }
    } catch (err) {
      console.error(
        `[Action Trigger] Failed to fetch outbid supplier details for ID ${previousBestOffer.supplierId}`,
        err
      );
    }
  }

  if (outbidSupplierDetails) {
    const supplierInfo = {
      whatsapp: outbidSupplierDetails.whatsapp,
      empresa: outbidSupplierDetails.empresa,
    };

    const result = await sendOutbidNotification(
      supplierInfo,
      {
        productName: product.name,
        brandName: previousBestOffer.brandName,
        newBestPriceFormatted: formatCurrency(newPricePerUnit, false),
        unitAbbreviated: abbreviateUnit(product.unit),
        winningSupplierName: currentSupplierDetails.empresa,
        counterProposalTimeInMinutes:
          quotation.counterProposalTimeInMinutes ?? 15,
      },
      quotation.userId
    );

    if (!result.success && onError) {
      onError(
        `Não foi possível notificar o concorrente sobre a contraproposta. Erro: ${result.error}`
      );
    }
  } else {
    console.warn(
      `[Action Trigger] Could not find details for outbid supplier ID: ${previousBestOffer.supplierId}`
    );
  }
}
