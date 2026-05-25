"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
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
import { fmt } from "@/lib/format";
import type { StatusRecomendacao } from "@/types/api";

const statusLabel: Record<StatusRecomendacao, string> = {
  PENDENTE: "Pendente",
  APROVADA: "Aprovada",
  RECUSADA: "Recusada",
  ATIVA: "Ativa",
  EXPIRADA: "Expirada",
};

export default function RecomendacaoPage() {
  const [status, setStatus] = useState<StatusRecomendacao>("PENDENTE");
  const [genOpen, setGenOpen] = useState(false);
  const [thinkingCliente, setThinkingCliente] =
    useState<ThinkingClienteInput | null>(null);
  const { data, isLoading, error } = useRecomendacoes({ status, limit: 50 });

  return (
    <>
      <PageHeader
        title="Recomendações da IA"
        description="Sugestões geradas pelo motor com score e justificativa explicável"
        actions={
          <Button size="sm" onClick={() => setGenOpen(true)}>
            <Sparkles className="h-4 w-4" />
            Gerar nova
          </Button>
        }
      />

      <Tabs value={status} onValueChange={(v) => setStatus(v as StatusRecomendacao)}>
        <TabsList className="mb-4">
          <TabsTrigger value="PENDENTE">Pendentes</TabsTrigger>
          <TabsTrigger value="APROVADA">Aprovadas</TabsTrigger>
          <TabsTrigger value="RECUSADA">Recusadas</TabsTrigger>
          <TabsTrigger value="EXPIRADA">Expiradas</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading && <CardGridSkeleton count={3} />}
      {error && <ErrorState message={error.message} />}
      {data && data.data.length === 0 && (
        <EmptyState
          message={
            status === "PENDENTE"
              ? "Nenhuma recomendação pendente. Clique em 'Gerar nova' pra rodar o motor."
              : `Nenhuma recomendação ${statusLabel[status].toLowerCase()}.`
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

      <GenerateDialog
        open={genOpen}
        onOpenChange={setGenOpen}
        onPick={(c) => {
          setGenOpen(false);
          setThinkingCliente(c);
        }}
      />
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
// Dialog: Picker pra escolher cliente antes de pensar
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
  const { data: clientes } = useClientes({ limit: 100 });

  function handleGenerate() {
    if (!clienteId) return;
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
            O motor vai analisar a carteira atual do cliente, comparar com o catálogo
            de produtos e devolver as 3 melhores sugestões com justificativa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="cliente" className="text-xs">
            Cliente
          </Label>
          <Select value={clienteId} onValueChange={(v) => setClienteId(v ?? "")}>
            <SelectTrigger id="cliente" className="w-full">
              <SelectValue placeholder="Selecione um cliente" />
            </SelectTrigger>
            <SelectContent>
              {clientes?.data.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome} · {c.perfil.toLowerCase()} · {fmt.brl(c.patrimonio)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleGenerate} disabled={!clienteId}>
            <Sparkles className="h-4 w-4" />
            Gerar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
