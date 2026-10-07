"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Campo, ErroFormulario, ariaCampo } from "./campo";
import { SelectOpcoes } from "./select-opcoes";
import { useAtualizarProduto, useCriarProduto, type ProdutoInput } from "@/lib/queries";
import { categoriaLabel, perfilLabel, tributacaoLabel } from "@/lib/labels";
import { aplicarErrosDaApi } from "@/lib/formularios";
import type { CategoriaProduto, PerfilInvestidor, Produto, Tributacao } from "@/types/api";

/** Percentual digitado com vírgula ou ponto ("11,5" ou "11.5"). Vazio → null. */
function parsePct(v: string): number | null {
  const s = v.trim().replace("%", "").replace(",", ".");
  return s === "" ? null : Number(s);
}
const pct = (min: number, max: number, obrigatorio: boolean) =>
  z.string().refine((v) => {
    const n = parsePct(v);
    if (n === null) return !obrigatorio;
    return Number.isFinite(n) && n >= min && n <= max;
  }, obrigatorio ? `Informe um percentual entre ${min} e ${max}` : `Entre ${min} e ${max}, ou deixe vazio`);

const schema = z.object({
  nome: z.string().trim().min(2, "Informe o nome").max(120),
  emissor: z.string().trim().min(2, "Informe o emissor").max(120),
  categoria: z.string().min(1, "Escolha a categoria"),
  rentabilidadeAno: pct(-100, 1000, true),
  risco: z.string().min(1, "Escolha o risco"),
  tributacao: z.string().min(1, "Escolha a tributação"),
  perfilMinimo: z.string().min(1, "Escolha o perfil mínimo"),
  // Mesmo formato que o motor de recomendação entende (validado também na API)
  liquidez: z
    .string()
    .trim()
    .max(30)
    .refine((v) => /^d\+\d{1,4}$/i.test(v) || /vencimento/i.test(v), 'Use "D+N" (ex.: D+30) ou "No vencimento"'),
  taxaAdmin: pct(0, 100, false),
  taxaPerformance: pct(0, 100, false),
  ticker: z.union([z.literal(""), z.string().trim().min(2, "Mínimo de 2 caracteres").max(30)]),
  descricao: z.string().max(2000, "Máximo de 2000 caracteres"),
});

type Valores = z.infer<typeof schema>;
const CAMPOS = [
  "nome", "emissor", "categoria", "rentabilidadeAno", "risco", "tributacao",
  "perfilMinimo", "liquidez", "taxaAdmin", "taxaPerformance", "ticker", "descricao",
] as const;

const RISCOS: Record<string, string> = {
  "1": "1 — Muito baixo",
  "2": "2 — Baixo",
  "3": "3 — Médio",
  "4": "4 — Alto",
  "5": "5 — Muito alto",
};

function paraPayload(v: Valores): ProdutoInput {
  return {
    nome: v.nome.trim(),
    emissor: v.emissor.trim(),
    categoria: v.categoria as CategoriaProduto,
    rentabilidadeAno: parsePct(v.rentabilidadeAno)!,
    risco: Number(v.risco),
    tributacao: v.tributacao as Tributacao,
    perfilMinimo: v.perfilMinimo as PerfilInvestidor,
    liquidez: v.liquidez.trim().toUpperCase().startsWith("D+") ? v.liquidez.trim().toUpperCase() : v.liquidez.trim(),
    // null explícito = "sem taxa" (a API aceita null pra limpar)
    taxaAdmin: parsePct(v.taxaAdmin),
    taxaPerformance: parsePct(v.taxaPerformance),
    ...(v.ticker.trim() && { ticker: v.ticker.trim().toUpperCase() }),
    ...(v.descricao.trim() && { descricao: v.descricao.trim() }),
  };
}

const paraCampo = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n).replace(".", ","));

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  produto?: Produto;
};

export function ProdutoFormDialog({ open, onOpenChange, produto }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{produto ? "Editar produto" : "Novo produto"}</DialogTitle>
          <DialogDescription>
            Produtos ativos entram no motor de recomendação. Risco, perfil mínimo e liquidez
            definem para quais clientes o produto pode ser sugerido.
          </DialogDescription>
        </DialogHeader>
        {open && <FormProduto produto={produto} onFechar={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function FormProduto({ produto, onFechar }: { produto?: Produto; onFechar: () => void }) {
  const criar = useCriarProduto();
  const atualizar = useAtualizarProduto();
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<Valores>({
    resolver: zodResolver(schema),
    defaultValues: {
      nome: produto?.nome ?? "",
      emissor: produto?.emissor ?? "",
      categoria: produto?.categoria ?? "",
      rentabilidadeAno: paraCampo(produto?.rentabilidadeAno),
      risco: produto ? String(produto.risco) : "",
      tributacao: produto?.tributacao ?? "TRIBUTADO",
      perfilMinimo: produto?.perfilMinimo ?? "",
      liquidez: produto?.liquidez ?? "",
      taxaAdmin: paraCampo(produto?.taxaAdmin),
      taxaPerformance: paraCampo(produto?.taxaPerformance),
      ticker: produto?.ticker ?? "",
      descricao: produto?.descricao ?? "",
    },
  });

  async function onSubmit(v: Valores) {
    setErroGeral(null);
    const payload = paraPayload(v);
    try {
      if (produto) {
        const alterado = Object.fromEntries(
          Object.entries(payload).filter(([k]) => dirtyFields[k as keyof Valores]),
        ) as Partial<ProdutoInput>;
        if (Object.keys(alterado).length > 0) {
          await atualizar.mutateAsync({ id: produto.id, ...alterado });
          toast.success("Produto atualizado");
        }
      } else {
        await criar.mutateAsync(payload);
        toast.success("Produto adicionado ao catálogo");
      }
      onFechar();
    } catch (e) {
      setErroGeral(aplicarErrosDaApi(e, setError, CAMPOS));
    }
  }

  const select = (name: "categoria" | "risco" | "tributacao" | "perfilMinimo", id: string, opcoes: Record<string, string>) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <SelectOpcoes
          {...ariaCampo(id, errors[name]?.message)}
          value={field.value}
          onChange={field.onChange}
          opcoes={opcoes}
        />
      )}
    />
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo id="prod-nome" label="Nome" erro={errors.nome?.message} obrigatorio>
          <Input autoComplete="off" {...ariaCampo("prod-nome", errors.nome?.message)} {...register("nome")} />
        </Campo>
        <Campo id="prod-emissor" label="Emissor / gestora" erro={errors.emissor?.message} obrigatorio>
          <Input autoComplete="off" {...ariaCampo("prod-emissor", errors.emissor?.message)} {...register("emissor")} />
        </Campo>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo id="prod-categoria" label="Categoria" erro={errors.categoria?.message} obrigatorio>
          {select("categoria", "prod-categoria", categoriaLabel)}
        </Campo>
        <Campo id="prod-tributacao" label="Tributação" erro={errors.tributacao?.message} obrigatorio>
          {select("tributacao", "prod-tributacao", tributacaoLabel)}
        </Campo>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Campo id="prod-risco" label="Risco" erro={errors.risco?.message} obrigatorio>
          {select("risco", "prod-risco", RISCOS)}
        </Campo>
        <Campo id="prod-perfil" label="Perfil mínimo" erro={errors.perfilMinimo?.message} obrigatorio>
          {select("perfilMinimo", "prod-perfil", perfilLabel)}
        </Campo>
        <Campo id="prod-liquidez" label="Liquidez" erro={errors.liquidez?.message} dica="D+0, D+30, No vencimento" obrigatorio>
          <Input
            autoComplete="off"
            {...ariaCampo("prod-liquidez", errors.liquidez?.message, "D+0, D+30, No vencimento")}
            {...register("liquidez")}
          />
        </Campo>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Campo id="prod-rent" label="Rentabilidade (% a.a.)" erro={errors.rentabilidadeAno?.message} obrigatorio>
          <Input inputMode="decimal" autoComplete="off" placeholder="11,5" {...ariaCampo("prod-rent", errors.rentabilidadeAno?.message)} {...register("rentabilidadeAno")} />
        </Campo>
        <Campo id="prod-taxa-adm" label="Taxa de adm. (% a.a.)" erro={errors.taxaAdmin?.message}>
          <Input inputMode="decimal" autoComplete="off" placeholder="Sem taxa" {...ariaCampo("prod-taxa-adm", errors.taxaAdmin?.message)} {...register("taxaAdmin")} />
        </Campo>
        <Campo id="prod-taxa-perf" label="Taxa de perf. (%)" erro={errors.taxaPerformance?.message}>
          <Input inputMode="decimal" autoComplete="off" placeholder="Sem taxa" {...ariaCampo("prod-taxa-perf", errors.taxaPerformance?.message)} {...register("taxaPerformance")} />
        </Campo>
      </div>

      <Campo id="prod-ticker" label="Ticker / código" erro={errors.ticker?.message} className="sm:w-1/3">
        <Input autoComplete="off" className="uppercase" {...ariaCampo("prod-ticker", errors.ticker?.message)} {...register("ticker")} />
      </Campo>

      <Campo id="prod-descricao" label="Descrição" erro={errors.descricao?.message}>
        <Textarea rows={3} {...ariaCampo("prod-descricao", errors.descricao?.message)} {...register("descricao")} />
      </Campo>

      <ErroFormulario mensagem={erroGeral} />

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onFechar} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {produto ? "Salvar alterações" : "Adicionar ao catálogo"}
        </Button>
      </DialogFooter>
    </form>
  );
}
