"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  steps: string[];
  /**
   * Quando true, a última etapa também vira ✓ (e dispara onAllDone).
   * Antes disso, a última etapa fica em spinner — útil pra esperar uma
   * operação assíncrona real (ex: mutação no backend) antes de finalizar.
   */
  lastStepCompleted?: boolean;
  /** Tempo entre transições (ms). Default 650ms — ~3-4s no total pra 5 steps. */
  stepDelayMs?: number;
  onAllDone?: () => void;
};

export function ThinkingSteps({
  steps,
  lastStepCompleted = true,
  stepDelayMs = 650,
  onAllDone,
}: Props) {
  const [active, setActive] = useState(0);

  // Avança automaticamente até o penúltimo step
  useEffect(() => {
    if (active >= steps.length - 1) return;
    const t = setTimeout(() => setActive((a) => a + 1), stepDelayMs);
    return () => clearTimeout(t);
  }, [active, steps.length, stepDelayMs]);

  // No último step: espera o sinal externo (lastStepCompleted) pra fechar
  useEffect(() => {
    if (active === steps.length - 1 && lastStepCompleted) {
      const t = setTimeout(() => {
        setActive(steps.length);
        onAllDone?.();
      }, stepDelayMs);
      return () => clearTimeout(t);
    }
  }, [active, steps.length, lastStepCompleted, stepDelayMs, onAllDone]);

  return (
    <ul className="space-y-2.5">
      {steps.map((step, i) => {
        const isDone = i < active;
        const isActive = i === active;
        return (
          <li
            key={i}
            className={cn(
              "flex items-start gap-3 text-sm transition-all duration-300",
              !isDone && !isActive && "opacity-50",
            )}
          >
            {isDone ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
            ) : isActive ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0 mt-0.5" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground/30 shrink-0 mt-0.5" />
            )}
            <span
              className={cn(
                "leading-snug transition-colors",
                isDone && "text-foreground",
                isActive && "text-foreground font-medium",
                !isDone && !isActive && "text-muted-foreground",
              )}
            >
              {step}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
