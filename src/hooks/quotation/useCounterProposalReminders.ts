"use client";

import { useEffect, useRef } from "react";
import { sendCounterProposalReminder } from "@/actions/notificationActions";
import type { Quotation, Fornecedor as SupplierType } from "@/types";
import type { CounterProposalInfo } from "./useCounterProposalLogic";

interface ProductWithCounterProposal {
  id: string;
  name: string;
  counterProposalInfo?: CounterProposalInfo | null;
}

export function useCounterProposalReminders(
  products: ProductWithCounterProposal[],
  quotation: Quotation | null,
  currentSupplierDetails: SupplierType | null
) {
  const activeTimersRef = useRef(new Map<string, NodeJS.Timeout>());

  useEffect(() => {
    if (!quotation || !currentSupplierDetails) return;

    const requiredReminders = new Set<string>();
    const REMIND_BEFORE_END_MS = 5 * 60 * 1000; // 5 minutos antes

    products.forEach(product => {
      const { counterProposalInfo } = product;

      if (
        counterProposalInfo &&
        quotation.userId &&
        new Date() < counterProposalInfo.deadline
      ) {
        const reminderKey = `${product.id}-${counterProposalInfo.myBrand}`;
        requiredReminders.add(reminderKey);

        // Se já existe timer, não criar outro
        if (activeTimersRef.current.has(reminderKey)) {
          return;
        }

        const timeUntilDeadlineMs = counterProposalInfo.deadline.getTime() - new Date().getTime();
        const timeoutDelayMs = timeUntilDeadlineMs - REMIND_BEFORE_END_MS;
        const minutesLeftForMessage = Math.round(REMIND_BEFORE_END_MS / 60000);

        if (timeoutDelayMs > 0 && minutesLeftForMessage > 0) {
          console.log(`[Reminder] Scheduling reminder for ${product.name} (${counterProposalInfo.myBrand}) in ${timeoutDelayMs / 1000}s.`);

          const timerId = setTimeout(() => {
            console.log(`[Reminder] Sending reminder for ${product.name} (${counterProposalInfo.myBrand}).`);

            sendCounterProposalReminder(
              currentSupplierDetails,
              product.name,
              counterProposalInfo.myBrand,
              minutesLeftForMessage,
              quotation.userId!
            );

            activeTimersRef.current.delete(reminderKey);
          }, timeoutDelayMs);

          activeTimersRef.current.set(reminderKey, timerId);
        }
      }
    });

    // Limpar timers obsoletos
    const currentTimers = activeTimersRef.current;
    currentTimers.forEach((timerId, reminderKey) => {
      if (!requiredReminders.has(reminderKey)) {
        console.log(`[Reminder] Clearing obsolete reminder: ${reminderKey}`);
        clearTimeout(timerId);
        currentTimers.delete(reminderKey);
      }
    });

    // Cleanup on unmount
    return () => {
      console.log("[Reminder] Component unmounting. Clearing all active timers.");
      const timers = activeTimersRef.current;
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, [products, quotation, currentSupplierDetails]);
}
