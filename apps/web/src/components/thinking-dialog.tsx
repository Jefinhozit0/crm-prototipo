"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ThinkingSteps } from "@/components/thinking-steps";
import { useGenerateRecomendacao } from "@/lib/queries";
import { ApiError } from "@/lib/api";
import { fmt } from "@/lib/format";
import type { GenerateResult } from "@/types/api";

export type ThinkingClienteInput = {
  id: string;
  nome: string;
  patrimonio: number;
  posicoesCount?: number;
  perfil?: string;
};

type Props = {
  cliente: ThinkingClienteInput | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

export function ThinkingDialog({ cliente, open, onOpenChange }: Props) {
  const generate = useGenerateRecomendacao();
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [animDone, setAnimDone] = useState(false);
  const [started, setStarted] = useState(false);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setResult(null);
      setAnimDone(false);
      setStarted(false);
    }
  }, [open]);

  // Dispara mutação assim que abre (uma única vez por abertura)
  useEffect(() => {
    if (!open || !cliente || started) return;
    setStarted(true);
    generate
      .mutateAsync({ clienteId: cliente.id, topN: 3 })
      .then((res) => setResult(res))
      .catch((e) => {
        toast.error(e instanceof ApiError ? e.message : "Erro ao gerar recomendação");
        onOpenChange(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cliente, started]);

  // Quando anim e mutação estiverem prontas → toast + fecha
  useEffect(() => {
    if (!animDone || !result || !cliente) return;
    toast.success(`${result.geradas} recomendações geradas para ${cliente.nome}`, {
      description: result.recomendacoes
        .map((r) => `${Math.round(r.score * 100)}/100 — ${r.produto.nome}`)
        .join(" · "),
      duration: 6000,
    });
    onOpenChange(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animDone, result, cliente]);

  if (!cliente) return null;

  const primeiroNome = cliente.nome.split(" ")[0];
  const steps = [
    `Carregando dados de ${primeiroNome}…`,
    cliente.posicoesCount !== undefined
      ? `Mapeando carteira atual (${fmt.brl(cliente.patrimonio)} em ${cliente.posicoesCount} posições)`
      : `Mapeando carteira atual (${fmt.brl(cliente.patrimonio)})`,
    "Comparando contra catálogo BTG (10 produtos)",
    "Aplicando 5 critérios de aderência",
    "Selecionando top 3 e gerando justificativa em português",
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            IA pensando…
          </DialogTitle>
          <DialogDescription>
            Analisando o cenário de <strong>{cliente.nome}</strong>
            {cliente.perfil && ` (perfil ${cliente.perfil.toLowerCase()})`}
          </DialogDescription>
        </DialogHeader>

        <div className="py-3">
          <ThinkingSteps
            steps={steps}
            lastStepCompleted={!!result}
            onAllDone={() => setAnimDone(true)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
