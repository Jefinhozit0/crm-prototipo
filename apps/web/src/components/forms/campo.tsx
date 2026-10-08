"use client";

import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Props de acessibilidade que o controle do campo deve receber */
export function ariaCampo(id: string, erro?: string, dica?: string) {
  // A dica some quando há erro (ver <Campo>), então só um dos dois é descrito
  const descricao = erro ? `${id}-erro` : dica ? `${id}-dica` : "";
  return {
    id,
    "aria-invalid": !!erro || undefined,
    "aria-describedby": descricao || undefined,
  };
}

/** Rótulo + controle + dica + erro, no padrão do formulário de login */
export function Campo({
  id,
  label,
  erro,
  dica,
  obrigatorio,
  className,
  children,
}: {
  id: string;
  label: string;
  erro?: string;
  dica?: string;
  obrigatorio?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} className="text-xs">
        {label}
        {obrigatorio && (
          <span className="text-destructive" aria-hidden>
            *
          </span>
        )}
      </Label>
      {children}
      {dica && !erro && (
        <p id={`${id}-dica`} className="text-[11px] text-muted-foreground">
          {dica}
        </p>
      )}
      {erro && (
        <p id={`${id}-erro`} className="text-xs text-destructive">
          {erro}
        </p>
      )}
    </div>
  );
}

/** Erro que não pertence a nenhum campo (conflito, permissão, servidor fora) */
export function ErroFormulario({ mensagem }: { mensagem: string | null }) {
  if (!mensagem) return null;
  return (
    <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
      {mensagem}
    </p>
  );
}
