"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckSquare, Mail, MessageSquare, Phone, StickyNote, Users } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/query-states";
import { useInteracoes } from "@/lib/queries";
import { tipoInteracaoLabel } from "@/lib/labels";
import { fmt } from "@/lib/format";
import type { TipoInteracao } from "@/types/api";

const tipoIcon: Record<TipoInteracao, typeof Mail> = {
  EMAIL: Mail,
  LIGACAO: Phone,
  REUNIAO: Users,
  WHATSAPP: MessageSquare,
  TAREFA: CheckSquare,
  NOTA: StickyNote,
};

const POR_PAGINA = 20;

export default function HistoricoPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, error, refetch, isFetching } = useInteracoes({ page, limit: POR_PAGINA });

  return (
    <>
      <PageHeader
        title="Histórico de Interações"
        description="Linha do tempo de e-mails, ligações, reuniões e mensagens com os clientes da sua carteira"
      />

      {isLoading && (
        <Card>
          <CardContent className="p-4">
            <TableSkeleton rows={6} />
          </CardContent>
        </Card>
      )}
      {error && <ErrorState message={error.message} onRetry={() => refetch()} />}
      {data && data.data.length === 0 && (
        <EmptyState message="Nenhuma interação registrada ainda." />
      )}

      {data && data.data.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Últimas interações</CardTitle>
            <CardDescription>
              {data.meta.total} registro(s) · ordenadas da mais recente para a mais antiga
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="relative border-l border-border ml-2 space-y-6" aria-busy={isFetching}>
              {data.data.map((i) => {
                const Icon = tipoIcon[i.tipo];
                return (
                  <li key={i.id} className="ml-6">
                    <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-background border border-border">
                      <Icon className="h-3 w-3 text-muted-foreground" aria-hidden />
                    </span>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <Link
                        href={`/clientes/${i.cliente.id}`}
                        className="font-medium text-sm hover:underline"
                      >
                        {i.cliente.nome}
                      </Link>
                      <Badge variant="outline" className="text-xs">
                        {tipoInteracaoLabel[i.tipo]}
                      </Badge>
                      <time dateTime={i.data} className="text-xs text-muted-foreground ml-auto">
                        {fmt.dateLong(i.data)}
                      </time>
                    </div>
                    <p className="text-sm font-medium text-foreground/80">{i.assunto}</p>
                    {i.resumo && <p className="text-sm text-muted-foreground mt-1">{i.resumo}</p>}
                    <p className="text-xs text-muted-foreground mt-2">por {i.autor.nome}</p>
                  </li>
                );
              })}
            </ol>

            {data.meta.totalPages > 1 && (
              <nav className="flex items-center justify-between mt-6 pt-4 border-t" aria-label="Paginação">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Anterior
                </Button>
                <span className="text-xs text-muted-foreground tabular-nums">
                  Página {data.meta.page} de {data.meta.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= data.meta.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Próxima
                </Button>
              </nav>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}
