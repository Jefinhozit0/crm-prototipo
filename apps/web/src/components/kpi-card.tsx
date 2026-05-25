import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Tone = "blue" | "emerald" | "amber" | "violet" | "rose";

type Props = {
  label: string;
  value: string;
  icon: LucideIcon;
  delta?: number;
  hint?: string;
  tone?: Tone;
};

const toneStyles: Record<Tone, { bg: string; fg: string }> = {
  blue: { bg: "bg-blue-50", fg: "text-blue-600" },
  emerald: { bg: "bg-emerald-50", fg: "text-emerald-600" },
  amber: { bg: "bg-amber-50", fg: "text-amber-600" },
  violet: { bg: "bg-violet-50", fg: "text-violet-600" },
  rose: { bg: "bg-rose-50", fg: "text-rose-600" },
};

export function KpiCard({ label, value, icon: Icon, delta, hint, tone = "blue" }: Props) {
  const positive = (delta ?? 0) >= 0;
  const t = toneStyles[tone];

  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div
            className={cn(
              "h-9 w-9 rounded-lg flex items-center justify-center",
              t.bg,
              t.fg,
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
          {delta !== undefined && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
                positive
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-rose-50 text-rose-700",
              )}
            >
              {positive ? (
                <ArrowUpRight className="h-3 w-3" />
              ) : (
                <ArrowDownRight className="h-3 w-3" />
              )}
              {positive ? "+" : ""}
              {delta}%
            </span>
          )}
        </div>

        <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground font-semibold">
          {label}
        </p>
        <p className="text-2xl font-semibold tracking-tight mt-1 tabular-nums">
          {value}
        </p>
        {hint && (
          <p className="text-xs text-muted-foreground mt-1">{hint}</p>
        )}
      </CardContent>
    </Card>
  );
}
