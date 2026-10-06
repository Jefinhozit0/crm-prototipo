import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Tone = "blue" | "emerald" | "amber" | "violet" | "rose";

type Props = {
  label: string;
  value: string;
  icon: LucideIcon;
  hint?: string;
  tone?: Tone;
};

// (Variação % vs. período anterior foi removida: o sistema ainda não guarda
// histórico, então qualquer delta exibido seria inventado.)

const toneStyles: Record<Tone, { bg: string; fg: string }> = {
  blue: { bg: "bg-blue-50", fg: "text-blue-700" },
  emerald: { bg: "bg-emerald-50", fg: "text-emerald-700" },
  amber: { bg: "bg-amber-50", fg: "text-amber-700" },
  violet: { bg: "bg-violet-50", fg: "text-violet-700" },
  rose: { bg: "bg-rose-50", fg: "text-rose-700" },
};

export function KpiCard({ label, value, icon: Icon, hint, tone = "blue" }: Props) {
  const t = toneStyles[tone];

  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center", t.bg, t.fg)}>
            <Icon className="h-4 w-4" aria-hidden />
          </div>
        </div>

        <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground font-semibold">
          {label}
        </p>
        <p className="text-2xl font-semibold tracking-tight mt-1 tabular-nums">{value}</p>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}
