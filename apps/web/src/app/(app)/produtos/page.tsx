"use client";

import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  CardGridSkeleton,
  EmptyState,
  ErrorState,
} from "@/components/query-states";
import { EmBreveButton } from "@/components/demo";
import { useProdutos } from "@/lib/queries";
import { usePermissoes } from "@/lib/permissoes";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { categoriaLabel, perfilLabel } from "@/lib/labels";
import { fmt } from "@/lib/format";
import type { Tributacao } from "@/types/api";

const tributacaoLabel: Record<Tributacao, string> = {
  TRIBUTADO: "Tributado (IR regressivo)",
  ISENTO: "Isento de IR",
  INCENTIVADO: "Incentivado (isento PF)",
};

function RiscoIndicator({ risco }: { risco: number }) {
  return (
    <div className="flex items-center gap-1" role="img" aria-label={`Risco ${risco} de 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          aria-hidden
          className={`h-1.5 w-3 rounded-sm ${i < risco ? "bg-amber-500" : "bg-muted"}`}
        />
      ))}
      <span className="text-xs text-muted-foreground ml-1" aria-hidden>
        {risco}/5
      </span>
    </div>
  );
}

export default function ProdutosPage() {
  const { podeGerirCatalogo } = usePermissoes();
  const [q, setQ] = useState("");
  const busca = useDebouncedValue(q.trim(), 300);
  const { data, isLoading, error, refetch } = useProdutos({
    limit: 100,
    ativo: true,
    q: busca || undefined,
  });

  return (
    <>
      <PageHeader
        title="Catálogo de Produtos"
        description="Produtos ativos disponíveis para alocação e para o motor de recomendação"
        actions={
          podeGerirCatalogo && (
            <EmBreveButton variant="default">
              <Plus className="h-4 w-4" aria-hidden />
              Novo produto
            </EmBreveButton>
          )
        }
      />

      <div className="relative max-w-md mb-4">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          aria-label="Buscar produto por nome, emissor ou ticker"
          placeholder="Buscar por nome, emissor ou ticker…"
          className="pl-9 h-9"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {isLoading && <CardGridSkeleton count={6} />}
      {error && <ErrorState message={error.message} onRetry={() => refetch()} />}
      {data && data.data.length === 0 && (
        <EmptyState message={busca ? "Nenhum produto encontrado para a busca." : "Nenhum produto ativo no catálogo."} />
      )}

      {data && data.data.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {data.data.map((p) => (
            <Card key={p.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Badge variant="outline" className="text-xs mb-2">
                      {categoriaLabel[p.categoria]}
                    </Badge>
                    <h3 className="font-semibold tracking-tight leading-tight">{p.nome}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{p.emissor}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Rentab. a.a.</p>
                    <p className="text-lg font-semibold text-emerald-700 leading-none mt-1 tabular-nums">
                      {fmt.pct(p.rentabilidadeAno)}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                <dl className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Liquidez</dt>
                    <dd className="font-medium">{p.liquidez}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Perfil mínimo</dt>
                    <dd className="font-medium">{perfilLabel[p.perfilMinimo]}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Taxa de administração</dt>
                    <dd className="font-medium">
                      {p.taxaAdmin === null ? "Sem taxa" : `${fmt.dec(p.taxaAdmin)}% a.a.`}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Tributação</dt>
                    <dd className="font-medium">{tributacaoLabel[p.tributacao]}</dd>
                  </div>
                </dl>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Risco</p>
                  <RiscoIndicator risco={p.risco} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {data && data.meta.total > data.data.length && (
        <p className="text-xs text-muted-foreground mt-4">
          Mostrando {data.data.length} de {data.meta.total}. Refine a busca para ver outros produtos.
        </p>
      )}
    </>
  );
}
