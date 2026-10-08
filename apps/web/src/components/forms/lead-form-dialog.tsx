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
import {
  useAssessores,
  useAtualizarLead,
  useCriarLead,
  type LeadAtualizarInput,
  type LeadCriarInput,
} from "@/lib/queries";
import { usePermissoes } from "@/lib/permissoes";
import { ORIGENS_LEAD } from "@/lib/labels";
import { aplicarErrosDaApi, parseValorBR, semVazios, valorParaCampo } from "@/lib/formularios";
import type { Lead } from "@/types/api";

const opcional = (schema: z.ZodString) => z.union([z.literal(""), schema]);

const schema = z.object({
  nome: z.string().trim().min(2, "Informe o nome").max(120),
  email: opcional(z.string().trim().email("E-mail inválido").max(254)),
  telefone: opcional(z.string().trim().min(8, "Telefone incompleto").max(30)),
  origem: z.string().trim().min(2, "Informe a origem").max(60),
  valorEstimado: z.string().refine((v) => {
    const n = parseValorBR(v);
    return n === null || (Number.isFinite(n) && n >= 0);
  }, "Valor inválido (ex.: 500.000,00)"),
  observacoes: z.string().max(2000, "Máximo de 2000 caracteres"),
  responsavelId: z.string(),
});

type Valores = z.infer<typeof schema>;
const CAMPOS = ["nome", "email", "telefone", "origem", "valorEstimado", "observacoes", "responsavelId"] as const;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Presente = edição; ausente = cadastro */
  lead?: Lead;
};

export function LeadFormDialog({ open, onOpenChange, lead }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{lead ? "Editar oportunidade" : "Nova oportunidade"}</DialogTitle>
          <DialogDescription>
            {lead
              ? "O estágio muda pela ficha da oportunidade, para ficar registrado no histórico."
              : "A oportunidade entra no funil em Prospecção."}
          </DialogDescription>
        </DialogHeader>
        {open && <FormLead lead={lead} onFechar={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function FormLead({ lead, onFechar }: { lead?: Lead; onFechar: () => void }) {
  const edicao = !!lead;
  const { podeAtribuirResponsavel: ehAdmin } = usePermissoes();
  const assessores = useAssessores(ehAdmin);
  const criar = useCriarLead();
  const atualizar = useAtualizarLead(lead?.id ?? "");
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
      nome: lead?.nome ?? "",
      email: lead?.email ?? "",
      telefone: lead?.telefone ?? "",
      origem: lead?.origem ?? "",
      valorEstimado: valorParaCampo(lead?.valorEstimado),
      observacoes: lead?.observacoes ?? "",
      responsavelId: lead?.responsavelId ?? "",
    },
  });

  async function onSubmit(v: Valores) {
    setErroGeral(null);
    const campos = semVazios({
      nome: v.nome.trim(),
      email: v.email.trim(),
      telefone: v.telefone.trim(),
      origem: v.origem.trim(),
      valorEstimado: parseValorBR(v.valorEstimado) ?? undefined,
      observacoes: v.observacoes.trim(),
      responsavelId: ehAdmin ? v.responsavelId : "",
    });
    try {
      if (edicao) {
        const alterado = Object.fromEntries(
          Object.entries(campos).filter(([k]) => dirtyFields[k as keyof Valores]),
        ) as LeadAtualizarInput;
        if (Object.keys(alterado).length > 0) {
          await atualizar.mutateAsync(alterado);
          toast.success("Oportunidade atualizada");
        }
      } else {
        await criar.mutateAsync(campos as LeadCriarInput);
        toast.success("Oportunidade criada");
      }
      onFechar();
    } catch (e) {
      setErroGeral(aplicarErrosDaApi(e, setError, CAMPOS));
    }
  }

  const opcoesAssessor = Object.fromEntries((assessores.data ?? []).map((a) => [a.id, a.nome]));

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-3">
      <Campo id="lead-nome" label="Nome" erro={errors.nome?.message} obrigatorio>
        <Input autoComplete="off" {...ariaCampo("lead-nome", errors.nome?.message)} {...register("nome")} />
      </Campo>

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo id="lead-email" label="E-mail" erro={errors.email?.message}>
          <Input type="email" autoComplete="off" {...ariaCampo("lead-email", errors.email?.message)} {...register("email")} />
        </Campo>
        <Campo id="lead-telefone" label="Telefone" erro={errors.telefone?.message}>
          <Input type="tel" autoComplete="off" {...ariaCampo("lead-telefone", errors.telefone?.message)} {...register("telefone")} />
        </Campo>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo id="lead-origem" label="Origem" erro={errors.origem?.message} obrigatorio>
          <Input
            list="lead-origens"
            autoComplete="off"
            placeholder="Indicação, Evento…"
            {...ariaCampo("lead-origem", errors.origem?.message)}
            {...register("origem")}
          />
          <datalist id="lead-origens">
            {ORIGENS_LEAD.map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>
        </Campo>
        <Campo id="lead-valor" label="Valor estimado (R$)" erro={errors.valorEstimado?.message}>
          <Input
            inputMode="decimal"
            autoComplete="off"
            placeholder="500.000,00"
            {...ariaCampo("lead-valor", errors.valorEstimado?.message)}
            {...register("valorEstimado")}
          />
        </Campo>
      </div>

      <Campo id="lead-obs" label="Observações" erro={errors.observacoes?.message}>
        <Textarea rows={3} {...ariaCampo("lead-obs", errors.observacoes?.message)} {...register("observacoes")} />
      </Campo>

      {ehAdmin && (
        <Campo id="lead-responsavel" label="Assessor responsável" erro={errors.responsavelId?.message}>
          <Controller
            control={control}
            name="responsavelId"
            render={({ field }) => (
              <SelectOpcoes
                id="lead-responsavel"
                value={field.value}
                onChange={field.onChange}
                opcoes={opcoesAssessor}
                placeholder={assessores.isLoading ? "Carregando…" : "Sem responsável"}
                disabled={!assessores.data}
              />
            )}
          />
        </Campo>
      )}

      <ErroFormulario mensagem={erroGeral} />

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onFechar} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {edicao ? "Salvar alterações" : "Criar oportunidade"}
        </Button>
      </DialogFooter>
    </form>
  );
}
