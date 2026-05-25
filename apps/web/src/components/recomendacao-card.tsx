"use client";

import { useState } from "react";
import { Check, ChevronDown, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  useAprovarRecomendacao,
  useRecusarRecomendacao,
} from "@/lib/queries";
import { ApiError } from "@/lib/api";
import { fmt } from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  FatorRecomendacao,
  PerfilInvestidor,
  Recomendacao,
  StatusRecomendacao,
} from "@/types/api";

const perfilColor: Record<PerfilInvestidor, string> = {
  CONSERVADOR: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  MODERADO: "bg-blue-100 text-blue-700 hover:bg-blue-100",
  ARROJADO: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  AGRESSIVO: "bg-red-100 text-red-700 hover:bg-red-100",
};

const statusBadgeVariant: Record<
  StatusRecomendacao,
  "default" | "secondary" | "outline" | "destructive"
> = {
  PENDENTE: "outline",
  APROVADA: "default",
  RECUSADA: "destructive",
  ATIVA: "secondary",
  EXPIRADA: "secondary",
};

const statusLabel: Record<StatusRecomendacao, string> = {
  PENDENTE: "Pendente",
  APROVADA: "Aprovada",
  RECUSADA: "Recusada",
  ATIVA: "Ativa",
  EXPIRADA: "Expirada",
};

const fatorLabel: Record<FatorRecomendacao, string> = {
  profileMatch: "Compatibilidade de perfil",
  diversification: "Diversificação",
  yield: "Rentabilidade",
  liquidity: "Liquidez",
  cost: "Custo",
};

const categoriaLabel: Record<string, string> = {
  RENDA_FIXA: "Renda Fixa",
  RENDA_VARIAVEL: "Renda Variável",
  FUNDOS: "Fundos",
  PREVIDENCIA: "Previdência",
  ESTRUTURADOS: "Estruturados",
  CAMBIO: "Câmbio",
};

type Props = {
  recomendacao: Recomendacao;
  /** Chamado depois de aprovar/recusar com sucesso. Útil pra fechar dialog. */
  onActionDone?: () => void;
};

export function RecomendacaoCard({ recomendacao: r, onActionDone }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [recusarOpen, setRecusarOpen] = useState(false);
  const aprovar = useAprovarRecomendacao();

  const scorePct = Math.round(r.score * 100);
  const scoreColor =
    scorePct >= 80
      ? "text-emerald-600"
      : scorePct >= 60
        ? "text-amber-600"
        : "text-muted-foreground";
  const progressColor =
    scorePct >= 80 ? "bg-emerald-500" : scorePct >= 60 ? "bg-amber-500" : "bg-slate-400";

  async function handleAprovar() {
    try {
      await aprovar.mutateAsync(r.id);
      toast.success(`Recomendação aprovada para ${r.cliente.nome}`);
      onActionDone?.();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Erro ao aprovar");
    }
  }

  return (
    <>
      <Card className="flex flex-col">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                {r.cliente.nome}
                <Badge className={perfilColor[r.cliente.perfil]} variant="secondary">
                  {r.cliente.perfil.toLowerCase()}
                </Badge>
              </CardTitle>
              <CardDescription className="mt-1.5">
                Sugestão:{" "}
                <span className="font-medium text-foreground">{r.produto.nome}</span>{" "}
                <Badge variant="outline" className="text-[10px] ml-1">
                  {categoriaLabel[r.produto.categoria]}
                </Badge>
              </CardDescription>
            </div>
            <Badge variant={statusBadgeVariant[r.status]} className="shrink-0">
              {statusLabel[r.status]}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="flex-1 space-y-4">
          {/* Score */}
          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground font-semibold">
                Aderência
              </p>
              <p className={cn("text-2xl font-semibold tabular-nums", scoreColor)}>
                {scorePct}
                <span className="text-sm text-muted-foreground">/100</span>
              </p>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={cn("h-full transition-all", progressColor)}
                style={{ width: `${scorePct}%` }}
              />
            </div>
          </div>

          {/* Justificativa */}
          <div className="rounded-md bg-muted/40 p-3 border border-border">
            <p className="text-sm leading-relaxed text-foreground/90 italic">
              &ldquo;{r.justificativa}&rdquo;
            </p>
          </div>

          {/* Detalhes (expansível) — só pra recomendações geradas pelo engine */}
          {r.payload?.contribs && r.payload.contribs.length > 0 ? (
            <>
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="w-full flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <span>Como cheguei nisso ({r.payload.contribs.length} fatores)</span>
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 transition-transform",
                    expanded && "rotate-180",
                  )}
                />
              </button>

              {expanded && (
                <div className="space-y-2 pt-3 border-t">
                  {[...r.payload.contribs]
                    .sort((a, b) => b.contrib - a.contrib)
                    .map((c) => {
                      const fatorPct = Math.round(
                        (r.payload.fatores?.[c.fator] ?? 0) * 100,
                      );
                      const pesoPct = Math.round(
                        (r.payload.pesos?.[c.fator] ?? 0) * 100,
                      );
                      return (
                        <div key={c.fator} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium">{fatorLabel[c.fator]}</span>
                            <span className="text-muted-foreground tabular-nums">
                              {fatorPct}% × peso {pesoPct}%
                            </span>
                          </div>
                          <Progress value={fatorPct} className="h-1" />
                        </div>
                      );
                    })}
                  <p className="text-[11px] text-muted-foreground pt-2 border-t">
                    Motor:{" "}
                    <code className="font-mono">
                      {r.payload.geradoPor ?? "—"}
                    </code>{" "}
                    · Gerado em {fmt.dateLong(r.geradoEm)}
                  </p>
                </div>
              )}
            </>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              Gerada em {fmt.dateLong(r.geradoEm)}
            </p>
          )}
        </CardContent>

        {/* Ações / status footer */}
        {r.status === "PENDENTE" && (
          <div className="px-6 pb-5 pt-1 flex items-center justify-end gap-2 border-t mt-2 pt-4">
            <Button size="sm" variant="ghost" onClick={() => setRecusarOpen(true)}>
              <X className="h-4 w-4" />
              Recusar
            </Button>
            <Button size="sm" onClick={handleAprovar} disabled={aprovar.isPending}>
              {aprovar.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Aprovar
            </Button>
          </div>
        )}

        {r.status === "APROVADA" && r.aprovadoPor && r.aprovadoEm && (
          <div className="px-6 pb-5 pt-1 border-t mt-2 pt-4 text-xs text-muted-foreground">
            ✓ Aprovada por <span className="font-medium">{r.aprovadoPor.nome}</span>{" "}
            em {fmt.dateLong(r.aprovadoEm)}
          </div>
        )}

        {r.status === "RECUSADA" && r.recusaMotivo && (
          <div className="px-6 pb-5 pt-1 border-t mt-2 pt-4">
            <p className="text-xs text-muted-foreground mb-1">Motivo:</p>
            <p className="text-sm">{r.recusaMotivo}</p>
          </div>
        )}
      </Card>

      <RecusarDialog
        recomendacao={r}
        open={recusarOpen}
        onOpenChange={setRecusarOpen}
        onDone={() => onActionDone?.()}
      />
    </>
  );
}

// ============================================================
// Dialog: Recusar (pede motivo)
// ============================================================

function RecusarDialog({
  recomendacao,
  open,
  onOpenChange,
  onDone,
}: {
  recomendacao: Recomendacao;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: () => void;
}) {
  const [motivo, setMotivo] = useState("");
  const recusar = useRecusarRecomendacao();

  async function handleRecusar() {
    if (motivo.trim().length < 3) {
      toast.error("Descreva o motivo em pelo menos 3 caracteres");
      return;
    }
    try {
      await recusar.mutateAsync({ id: recomendacao.id, motivo });
      toast.success("Recomendação recusada");
      onOpenChange(false);
      setMotivo("");
      onDone?.();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Erro ao recusar");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Recusar recomendação</DialogTitle>
          <DialogDescription>
            Por que essa sugestão não cabe agora? O motivo fica registrado pra
            refinar o motor de IA no futuro.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="motivo" className="text-xs">
            Motivo
          </Label>
          <Textarea
            id="motivo"
            placeholder="Ex.: cliente já avaliou e não tem interesse, prefere manter posição atual…"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={3}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleRecusar}
            disabled={recusar.isPending}
          >
            {recusar.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Recusar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
