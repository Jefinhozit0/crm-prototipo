"use client";

import { Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CardGridSkeleton,
  EmptyState,
  ErrorState,
} from "@/components/query-states";
import { useProdutos } from "@/lib/queries";
import { fmt } from "@/lib/format";
import type { CategoriaProduto } from "@/types/api";

const categoriaLabel: Record<CategoriaProduto, string> = {
  RENDA_FIXA: "Renda Fixa",
  RENDA_VARIAVEL: "Renda Variável",
  FUNDOS: "Fundos",
  PREVIDENCIA: "Previdência",
  ESTRUTURADOS: "Estruturados",
  CAMBIO: "Câmbio",
};

function RiscoIndicator({ risco }: { risco: number }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className={`h-1.5 w-3 rounded-sm ${
            i < risco ? "bg-amber-500" : "bg-muted"
          }`}
        />
      ))}
      <span className="text-xs text-muted-foreground ml-1">{risco}/5</span>
    </div>
  );
}

export default function ProdutosPage() {
  const { data, isLoading, error } = useProdutos({ limit: 50, ativo: true });

  return (
    <>
      <PageHeader
        title="Catálogo de Produtos"
        description="Renda fixa, ações, fundos e previdência disponíveis para alocação"
        actions={
          <>
            <Button variant="outline" size="sm">
              <Search className="h-4 w-4" />
              Buscar
            </Button>
            <Button size="sm">
              <Plus className="h-4 w-4" />
              Novo produto
            </Button>
          </>
        }
      />

      {isLoading && <CardGridSkeleton count={6} />}
      {error && <ErrorState message={error.message} />}
      {data && data.data.length === 0 && (
        <EmptyState message="Nenhum produto cadastrado." />
      )}

      {data && data.data.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {data.data.map((p) => (
            <Card key={p.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Badge variant="outline" className="text-xs mb-2">
                      {categoriaLabel[p.categoria]}
                    </Badge>
                    <h3 className="font-semibold tracking-tight leading-tight">
                      {p.nome}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">{p.emissor}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Rent. ano</p>
                    <p className="text-lg font-semibold text-emerald-600 leading-none mt-1 tabular-nums">
                      {fmt.pct(p.rentabilidadeAno)}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-muted-foreground">Liquidez</p>
                    <p className="font-medium">{p.liquidez}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Perfil mínimo</p>
                    <p className="font-medium capitalize">
                      {p.perfilMinimo.toLowerCase()}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Risco</p>
                  <RiscoIndicator risco={p.risco} />
                </div>
                <Button variant="outline" size="sm" className="w-full">
                  Ver detalhes
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
