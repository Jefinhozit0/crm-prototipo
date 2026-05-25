"use client";

import Link from "next/link";
import { FileCheck2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/query-states";
import { useSuitabilityRecentes } from "@/lib/queries";
import { fmt } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PerfilInvestidor } from "@/types/api";

const perfilColor: Record<PerfilInvestidor, string> = {
  CONSERVADOR: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  MODERADO: "bg-blue-100 text-blue-700 hover:bg-blue-100",
  ARROJADO: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  AGRESSIVO: "bg-red-100 text-red-700 hover:bg-red-100",
};

export default function SuitabilityPage() {
  const { data, isLoading, error } = useSuitabilityRecentes(50);

  return (
    <>
      <PageHeader
        title="Suitability"
        description="Histórico das últimas avaliações de perfil aplicadas. Pra aplicar uma nova, abra um cliente."
      />

      {isLoading && (
        <Card>
          <CardContent className="p-4">
            <TableSkeleton />
          </CardContent>
        </Card>
      )}
      {error && <ErrorState message={error.message} />}
      {data && data.length === 0 && (
        <EmptyState message="Nenhuma suitability aplicada ainda." />
      )}

      {data && data.length > 0 && (
        <div className="space-y-2">
          {data.map((s) => {
            const validade = new Date(s.validoAte);
            const expirado = validade < new Date();
            return (
              <Link
                key={s.id}
                href={`/clientes/${s.cliente.id}`}
                className="block"
              >
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-muted text-muted-foreground flex items-center justify-center shrink-0">
                      <FileCheck2 className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{s.cliente.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        Aplicada {fmt.dateLong(s.aplicadoEm)} · Validade até{" "}
                        {fmt.date(s.validoAte)}
                        {expirado && (
                          <span className="text-destructive ml-1">(expirada)</span>
                        )}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-muted-foreground">
                        Pontuação{" "}
                        <span className="font-medium tabular-nums text-foreground">
                          {s.pontuacao}/100
                        </span>
                      </p>
                      <Badge
                        className={cn("mt-1", perfilColor[s.perfilCalculado])}
                        variant="secondary"
                      >
                        {s.perfilCalculado.toLowerCase()}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
