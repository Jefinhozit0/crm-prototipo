"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  if (!d || d.length === 0) return "Aplicando filtros de adequação…";
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
  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* Montado só enquanto aberto: fechar desmonta e zera o estado da rodada */}
        {open && cliente && <ThinkingRun key={cliente.id} cliente={cliente} onClose={close} />}
      </DialogContent>
    </Dialog>
  );
}

function ThinkingRun({
  cliente,
  onClose,
}: {
  cliente: ThinkingClienteInput;
  onClose: () => void;
}) {
  const { mutate } = useGenerateRecomendacao();
  const [result, setResult] = useState<GenerateResult | null>(null);
  // Garante uma única chamada por abertura (inclusive no double-mount do StrictMode)
  const disparou = useRef(false);

  useEffect(() => {
    if (disparou.current) return;
    disparou.current = true;
    mutate(
      { clienteId: cliente.id, topN: 3 },
      {
        onSuccess: setResult,
        onError: (e) => {
          toast.error(
            e instanceof ApiError ? e.message : "Erro ao gerar recomendação",
          );
          onClose();
        },
      },
    );
  }, [cliente.id, mutate, onClose]);

  const handleAllDone = useCallback(() => {
    if (!result) return;
    if (result.geradas === 0) {
      toast.info(`Nenhum produto elegível para ${cliente.nome}`, {
        description:
          "Todos os produtos do catálogo foram filtrados pelas regras de adequação.",
        duration: 6000,
      });
    } else {
      toast.success(
        `${result.geradas} recomendações geradas para ${cliente.nome}`,
        {
          description: result.recomendacoes
            .map((r) => `${Math.round(r.score * 100)}/100 — ${r.produto.nome}`)
            .join(" · "),
          duration: 6000,
        },
      );
    }
    onClose();
  }, [result, cliente.nome, onClose]);

  const primeiroNome = cliente.nome.split(" ")[0];

  // Dados frescos do result quando chegar — fallbacks neutros enquanto null
  const total = result?.totalAnalisados;
  const descartados = result?.descartados;
  const geradas = result?.geradas;

  const descarteResumo =
    descartados && descartados.length === 0 && total !== undefined
      ? `Todos os ${total} produtos passaram pelos filtros`
      : formatarDescarte(descartados);

  const steps = [
    `Carregando dados de ${primeiroNome}…`,
    cliente.posicoesCount !== undefined
      ? `Mapeando carteira atual (${fmt.brl(cliente.patrimonio)} em ${cliente.posicoesCount} posições)`
      : `Mapeando carteira atual (${fmt.brl(cliente.patrimonio)})`,
    total !== undefined
      ? `Comparando contra ${total} produtos do catálogo`
      : "Comparando contra o catálogo de produtos",
    descarteResumo,
    geradas !== undefined
      ? `Selecionei o top ${geradas} e escrevi a justificativa em pt-BR`
      : "Selecionando os melhores e escrevendo a justificativa",
  ];

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden />
          Motor de recomendação analisando…
        </DialogTitle>
        <DialogDescription>
          Analisando o cenário de <strong>{cliente.nome}</strong>
          {cliente.perfil && ` (perfil ${cliente.perfil.toLowerCase()})`}
        </DialogDescription>
      </DialogHeader>

      <div className="py-3" aria-live="polite">
        <ThinkingSteps
          steps={steps}
          lastStepCompleted={!!result}
          onAllDone={handleAllDone}
        />
      </div>
    </>
  );
}
