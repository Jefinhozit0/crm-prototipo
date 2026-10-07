"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/**
 * Select de opções fixas (valor → rótulo). `items` faz o gatilho mostrar o
 * rótulo, não o valor cru. Valor vazio mostra o placeholder.
 */
export function SelectOpcoes({
  id,
  value,
  onChange,
  opcoes,
  placeholder = "Selecione…",
  disabled,
  className,
  ...aria
}: {
  id: string;
  value: string;
  onChange: (valor: string) => void;
  opcoes: Record<string, string>;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}) {
  return (
    <Select
      items={opcoes}
      value={value || null}
      onValueChange={(v) => onChange((v as string | null) ?? "")}
      disabled={disabled}
    >
      <SelectTrigger id={id} className={cn("w-full", className)} {...aria}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(opcoes).map(([valor, rotulo]) => (
          <SelectItem key={valor} value={valor}>
            {rotulo}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
