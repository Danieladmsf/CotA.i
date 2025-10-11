"use client";

import { useEffect } from "react";
import type { SystemNotification, Fornecedor as SupplierType } from "@/types";
import { voiceMessages } from "@/config/voiceMessages";

interface ProductToQuoteVM {
  id: string;
  name: string;
}

interface UsePriorityNotificationHandlerParams {
  isLoading: boolean;
  notificationsLoading: boolean;
  hasSpokenTabMessage: boolean;
  notifications: SystemNotification[];
  productsToQuote: ProductToQuoteVM[];
  currentSupplierDetails: SupplierType | null;
  markAsRead: (notificationId: string) => void;
  speak: (message: string) => void;
  setHasSpokenTabMessage: (value: boolean) => void;
}

/**
 * Hook to handle priority notifications (brand approvals/rejections) with voice feedback
 * and welcome messages. Ensures notifications are spoken in order of priority.
 */
export function usePriorityNotificationHandler({
  isLoading,
  notificationsLoading,
  hasSpokenTabMessage,
  notifications,
  productsToQuote,
  currentSupplierDetails,
  markAsRead,
  speak,
  setHasSpokenTabMessage,
}: UsePriorityNotificationHandlerParams) {
  useEffect(() => {
    if (
      isLoading ||
      notificationsLoading ||
      hasSpokenTabMessage ||
      !productsToQuote.length ||
      !currentSupplierDetails
    ) {
      return;
    }

    const brandApprovalNotification = notifications.find(
      (n) => n.type === "brand_approval_approved"
    );
    const brandRejectionNotification = notifications.find(
      (n) => n.type === "brand_approval_rejected"
    );

    if (brandApprovalNotification) {
      speak(
        voiceMessages.actions.brandApproved(
          brandApprovalNotification.brandName || ""
        )
      );
      markAsRead(brandApprovalNotification.id);
      setHasSpokenTabMessage(true);
    } else if (brandRejectionNotification) {
      speak(
        voiceMessages.actions.brandRejected(
          brandRejectionNotification.brandName || ""
        )
      );
      markAsRead(brandRejectionNotification.id);
      setHasSpokenTabMessage(true);
    } else {
      // If no priority message was spoken, speak the normal welcome message
      const supplierName =
        currentSupplierDetails.empresa?.split(" ")[0] || "Fornecedor";
      const itemCount = productsToQuote.length;
      speak(voiceMessages.welcome.quotationPage(supplierName, itemCount));
      setHasSpokenTabMessage(true);
    }
  }, [
    isLoading,
    notificationsLoading,
    hasSpokenTabMessage,
    notifications,
    productsToQuote,
    currentSupplierDetails,
    markAsRead,
    speak,
    setHasSpokenTabMessage,
  ]);
}
