"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Filter, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ErrorState, TableSkeleton, EmptyState } from "@/components/query-states";
import { useClientes } from "@/lib/queries";
import { fmt } from "@/lib/format";
import type { PerfilInvestidor } from "@/types/api";

const perfilLabel: Record<PerfilInvestidor, string> = {
  CONSERVADOR: "Conservador",
  MODERADO: "Moderado",
  ARROJADO: "Arrojado",
  AGRESSIVO: "Agressivo",
};

const perfilColor: Record<PerfilInvestidor, string> = {
  CONSERVADOR: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  MODERADO: "bg-blue-100 text-blue-700 hover:bg-blue-100",
  ARROJADO: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  AGRESSIVO: "bg-red-100 text-red-700 hover:bg-red-100",
};

function initials(nome: string) {
  return nome
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

export default function LeadsPage() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const { data, isLoading, error } = useClientes({ q: q || undefined, limit: 20 });

  return (
    <>
      <PageHeader
        title="Leads & Clientes"
        description="Gestão completa da base — filtros, segmentação e ações em massa"
        actions={
          <>
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4" />
              Filtros
            </Button>
            <Button size="sm">
              <Plus className="h-4 w-4" />
              Novo lead
            </Button>
          </>
        }
      />

      <Card>
        <CardContent className="p-0">
          <div className="p-4 border-b flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou e-mail…"
                className="pl-9 h-9"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            {data && (
              <div className="text-sm text-muted-foreground">
                Mostrando {data.data.length} de {data.meta.total} contatos
              </div>
            )}
          </div>

          {isLoading && (
            <div className="p-4">
              <TableSkeleton />
            </div>
          )}

          {error && (
            <div className="p-4">
              <ErrorState message={error.message} />
            </div>
          )}

          {data && data.data.length === 0 && (
            <div className="p-4">
              <EmptyState message="Nenhum cliente corresponde aos filtros." />
            </div>
          )}

          {data && data.data.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Cidade</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead className="text-right">Patrimônio</TableHead>
                  <TableHead>Última interação</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((c) => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/clientes/${c.id}`)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs bg-muted">
                            {initials(c.nome)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="leading-tight">
                          <p className="font-medium text-sm">{c.nome}</p>
                          <p className="text-xs text-muted-foreground">{c.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.cidade ? `${c.cidade}${c.uf ? `, ${c.uf}` : ""}` : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge className={perfilColor[c.perfil]} variant="secondary">
                        {perfilLabel[c.perfil]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium font-mono text-sm tabular-nums">
                      {fmt.brl(c.patrimonio)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.ultimaInteracao ? fmt.date(c.ultimaInteracao) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={c.status === "ATIVO" ? "default" : "outline"}
                        className="capitalize"
                      >
                        {c.status.toLowerCase()}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
