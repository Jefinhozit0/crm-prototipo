"use client";

import { useState } from "react";
import { Info, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CardGridSkeleton, EmptyState, ErrorState } from "@/components/query-states";
import {
  ThinkingDialog,
  type ThinkingClienteInput,
} from "@/components/thinking-dialog";
import { RecomendacaoCard } from "@/components/recomendacao-card";
import { useClientes, useRecomendacoes } from "@/lib/queries";
import { usePermissoes } from "@/lib/permissoes";
import { AVISO_APOIO_DECISAO, perfilLabel, statusRecomendacaoLabel } from "@/lib/labels";
import { fmt } from "@/lib/format";
import type { StatusRecomendacao } from "@/types/api";

export default function RecomendacaoPage() {
  const [status, setStatus] = useState<StatusRecomendacao>("PENDENTE");
  const [genOpen, setGenOpen] = useState(false);
  const [thinkingCliente, setThinkingCliente] =
    useState<ThinkingClienteInput | null>(null);
  const { podeOperar } = usePermissoes();
  const { data, isLoading, error, refetch } = useRecomendacoes({ status, limit: 50 });

  return (
    <>
      <PageHeader
        title="Recomendações"
        description="Sugestões do motor com score e justificativa explicável, para avaliação do assessor"
        actions={
          podeOperar && (
            <Button size="sm" onClick={() => setGenOpen(true)}>
              <Sparkles className="h-4 w-4" aria-hidden />
              Gerar nova
            </Button>
          )
        }
      />

      <p className="mb-4 flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
        <Info className="h-4 w-4 shrink-0 mt-px" aria-hidden />
        {AVISO_APOIO_DECISAO}
      </p>

      <Tabs value={status} onValueChange={(v) => setStatus(v as StatusRecomendacao)}>
        <TabsList className="mb-4">
          <TabsTrigger value="PENDENTE">Pendentes</TabsTrigger>
          <TabsTrigger value="APROVADA">Aprovadas</TabsTrigger>
          <TabsTrigger value="RECUSADA">Recusadas</TabsTrigger>
          <TabsTrigger value="EXPIRADA">Expiradas</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading && <CardGridSkeleton count={3} />}
      {error && <ErrorState message={error.message} onRetry={() => refetch()} />}
      {data && data.data.length === 0 && (
        <EmptyState
          message={
            status === "PENDENTE"
              ? podeOperar
                ? "Nenhuma recomendação pendente. Clique em “Gerar nova” para rodar o motor para um cliente."
                : "Nenhuma recomendação pendente."
              : `Nenhuma recomendação ${statusRecomendacaoLabel[status].toLowerCase()}.`
          }
        />
      )}

      {data && data.data.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {data.data.map((r) => (
            <RecomendacaoCard key={r.id} recomendacao={r} />
          ))}
        </div>
      )}

      {podeOperar && (
        <GenerateDialog
          open={genOpen}
          onOpenChange={setGenOpen}
          onPick={(c) => {
            setGenOpen(false);
            setThinkingCliente(c);
          }}
        />
      )}
      <ThinkingDialog
        cliente={thinkingCliente}
        open={!!thinkingCliente}
        onOpenChange={(v) => {
          if (!v) setThinkingCliente(null);
        }}
      />
    </>
  );
}

// ============================================================
// Dialog: escolher o cliente antes de rodar o motor
// ============================================================

function GenerateDialog({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (cliente: ThinkingClienteInput) => void;
}) {
  const [clienteId, setClienteId] = useState<string>("");
  const { data: clientes, isLoading, error } = useClientes({ limit: 100, status: "ATIVO", sort: "nome" });
  // `items` faz o gatilho mostrar o nome do cliente, não o id
  const itens = Object.fromEntries((clientes?.data ?? []).map((c) => [c.id, c.nome]));

  function handleGenerate() {
    const cliente = clientes?.data.find((c) => c.id === clienteId);
    if (!cliente) return;
    onPick({
      id: cliente.id,
      nome: cliente.nome,
      patrimonio: cliente.patrimonio,
      perfil: cliente.perfil,
    });
    setClienteId("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Gerar recomendação</DialogTitle>
          <DialogDescription>
            O motor analisa a carteira atual e a suitability vigente do cliente, aplica os filtros de
            adequação e devolve até 3 sugestões com justificativa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="cliente" className="text-xs">
            Cliente ativo
          </Label>
          {error ? (
            <p className="text-xs text-destructive" role="alert">
              Não foi possível carregar os clientes: {error.message}
            </p>
          ) : clientes && clientes.data.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum cliente ativo na sua carteira.</p>
          ) : (
            <Select
              items={itens}
              value={clienteId}
              onValueChange={(v) => setClienteId(v ?? "")}
              disabled={isLoading}
            >
              <SelectTrigger id="cliente" className="w-full">
                <SelectValue placeholder={isLoading ? "Carregando clientes…" : "Selecione um cliente"} />
              </SelectTrigger>
              <SelectContent>
                {clientes?.data.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome} · {perfilLabel[c.perfil].toLowerCase()} · {fmt.brl(c.patrimonio)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleGenerate} disabled={!clienteId}>
            <Sparkles className="h-4 w-4" aria-hidden />
            Gerar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
