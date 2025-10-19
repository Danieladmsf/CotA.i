"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { intervalToDuration } from "date-fns";

interface CountdownTimerProps {
  deadline: Date;
  onEnd?: () => void;
}

export function CountdownTimer({ deadline, onEnd }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState("Calculando...");
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const updateTimer = useCallback(() => {
    const now = new Date();
    const diff = deadline.getTime() - now.getTime();

    if (diff <= 0) {
      setTimeLeft("Encerrado");
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (onEnd) onEnd();
      return;
    }

    const duration = intervalToDuration({ start: now, end: deadline });
    const parts: string[] = [];

    if (duration.days && duration.days > 0) parts.push(`${duration.days}d`);
    if (duration.hours && duration.hours > 0) parts.push(`${duration.hours}h`);
    if (duration.minutes && duration.minutes > 0) parts.push(`${duration.minutes}m`);
    if (duration.seconds && duration.seconds > 0) parts.push(`${duration.seconds}s`);

    setTimeLeft(parts.join(' ') || "0s");
  }, [deadline, onEnd]);

  useEffect(() => {
    updateTimer();
    intervalRef.current = setInterval(updateTimer, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [updateTimer]);

  return <span>{timeLeft}</span>;
}
