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
import type {
  DescarteAgregado,
  GenerateResult,
  MotivoDescarte,
} from "@/types/api";

export type ThinkingClienteInput = {
  id: string;
  nome: string;
  patrimonio: number;
  posicoesCount?: number;
  perfil?: string;
};

const motivoLabel: Record<MotivoDescarte, string> = {
  perfil_incompativel: "perfil incompatível",
  concentracao_emissor: "concentração",
  risco_alem_tolerancia: "risco além da tolerância",
  ja_sobrealocado: "já sobrealocado",
};

function formatarDescarte(d: DescarteAgregado[] | undefined): string {
  if (!d || d.length === 0) return "Aplicando filtros…";
  const total = d.reduce((acc, x) => acc + x.count, 0);
  const partes = d.map((x) =>
    x.motivo === "concentracao_emissor" && x.contexto?.emissor
      ? `${x.count} em ${x.contexto.emissor}${
          x.contexto.pctPatrimonio !== undefined
            ? ` (${x.contexto.pctPatrimonio}%)`
            : ""
        }`
      : `${x.count} ${motivoLabel[x.motivo]}`,
  );
  return `Filtrei ${total}: ${partes.join(" · ")}`;
}

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

  // Dados frescos do result quando chegar — fallbacks razoáveis enquanto null
  const firstPayload = result?.recomendacoes[0]?.payload;
  const total = firstPayload?.totalAnalisados ?? 15;
  const descartados = firstPayload?.descartadosDaRodada;
  const geradas = result?.geradas ?? 3;

  const descarteResumo =
    descartados && descartados.length === 0
      ? `Todos os ${total} produtos passaram pelos filtros`
      : formatarDescarte(descartados);

  const steps = [
    `Carregando dados de ${primeiroNome}…`,
    cliente.posicoesCount !== undefined
      ? `Mapeando carteira atual (${fmt.brl(cliente.patrimonio)} em ${cliente.posicoesCount} posições)`
      : `Mapeando carteira atual (${fmt.brl(cliente.patrimonio)})`,
    `Comparando contra ${total} produtos do catálogo`,
    descarteResumo,
    `Selecionei o top ${geradas} e escrevi a justificativa em pt-BR`,
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
