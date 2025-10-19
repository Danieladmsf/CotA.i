"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { intervalToDuration } from "date-fns";
import type { Timestamp } from "firebase/firestore";
import type { Quotation } from "@/types";

interface UseQuotationDeadlineReturn {
  timeLeft: string;
  isDeadlinePassed: boolean;
  isQuotationEnded: boolean;
}

export function useQuotationDeadline(
  quotation: Quotation | null,
  onDeadlineEnd?: (quotationId: string) => void
): UseQuotationDeadlineReturn {
  const [timeLeft, setTimeLeft] = useState("Calculando...");
  const [isDeadlinePassed, setIsDeadlinePassed] = useState(false);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!quotation?.deadline) {
      setTimeLeft("Prazo não definido");
      setIsDeadlinePassed(false);
      return;
    }

    const deadlineDate = (quotation.deadline as Timestamp).toDate();

    const updateTimer = () => {
      const now = new Date();
      const diff = deadlineDate.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft("Prazo Encerrado");
        setIsDeadlinePassed(true);

        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }

        // Trigger auto-close callback
        if (quotation.id && quotation.status === 'Aberta' && onDeadlineEnd) {
          onDeadlineEnd(quotation.id);
        }
        return;
      }

      setIsDeadlinePassed(false);
      const duration = intervalToDuration({ start: now, end: deadlineDate });
      const parts: string[] = [];

      if (duration.days && duration.days > 0) parts.push(`${duration.days}d`);
      if (duration.hours && duration.hours > 0) parts.push(`${duration.hours}h`);
      if (duration.minutes && duration.minutes > 0) parts.push(`${duration.minutes}m`);
      if (duration.seconds && duration.seconds > 0) parts.push(`${duration.seconds}s`);

      setTimeLeft(parts.join(' ') || "Encerrando...");
    };

    updateTimer();
    countdownIntervalRef.current = setInterval(updateTimer, 1000);

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [quotation, onDeadlineEnd]);

  const isQuotationEnded =
    quotation?.status === 'Fechada' ||
    quotation?.status === 'Concluída' ||
    isDeadlinePassed;

  return { timeLeft, isDeadlinePassed, isQuotationEnded };
}
