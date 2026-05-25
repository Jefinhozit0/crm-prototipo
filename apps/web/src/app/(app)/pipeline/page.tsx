"use client";

import { Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ErrorState } from "@/components/query-states";
import { Skeleton } from "@/components/ui/skeleton";
import { useLeadsBoard } from "@/lib/queries";
import { fmt } from "@/lib/format";
import type { EstagioPipeline } from "@/types/api";

const estagioLabel: Record<EstagioPipeline, string> = {
  PROSPECCAO: "Prospecção",
  QUALIFICACAO: "Qualificação",
  PROPOSTA: "Proposta",
  NEGOCIACAO: "Negociação",
  FECHADO: "Fechado",
  PERDIDO: "Perdido",
};

const estagioCor: Record<EstagioPipeline, string> = {
  PROSPECCAO: "border-slate-300",
  QUALIFICACAO: "border-blue-400",
  PROPOSTA: "border-amber-400",
  NEGOCIACAO: "border-orange-400",
  FECHADO: "border-emerald-500",
  PERDIDO: "border-rose-400",
};

export default function PipelinePage() {
  const { data, isLoading, error } = useLeadsBoard();

  const totalPipeline = data?.reduce((acc, col) => acc + col.total, 0) ?? 0;
  const totalLeads = data?.reduce((acc, col) => acc + col.count, 0) ?? 0;

  return (
    <>
      <PageHeader
        title="Pipeline Comercial"
        description={
          data
            ? `${totalLeads} oportunidades · ${fmt.brl(totalPipeline)} em valor estimado`
            : "Carregando funil..."
        }
        actions={
          <Button size="sm">
            <Plus className="h-4 w-4" />
            Nova oportunidade
          </Button>
        }
      />

      {error && <ErrorState message={error.message} />}

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ))}
        </div>
      )}

      {data && (
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4">
          {data.map((col) => (
            <div key={col.estagio} className="flex flex-col gap-3">
              <div className={`border-t-2 ${estagioCor[col.estagio]} pt-2`}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{estagioLabel[col.estagio]}</p>
                  <Badge variant="outline" className="text-xs">
                    {col.count}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                  {fmt.brl(col.total)}
                </p>
              </div>

              <div className="flex flex-col gap-2 min-h-[60px]">
                {col.itens.map((lead) => (
                  <Card
                    key={lead.id}
                    className="hover:shadow-sm transition-shadow cursor-pointer"
                  >
                    <CardContent className="p-3 space-y-2">
                      <p className="font-medium text-sm leading-tight">{lead.nome}</p>
                      <p className="font-mono text-sm text-emerald-600 font-semibold tabular-nums">
                        {fmt.brl(lead.valorEstimado)}
                      </p>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{lead.origem}</span>
                        {lead.responsavel && (
                          <span className="truncate max-w-[80px]">
                            {lead.responsavel.nome.split(" ")[0]}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {col.itens.length === 0 && (
                  <div className="text-xs text-muted-foreground text-center py-6 border border-dashed rounded-md">
                    Sem leads
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
