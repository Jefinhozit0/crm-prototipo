"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
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
import { Campo, ErroFormulario, ariaCampo } from "./campo";
import { useConverterLead, type ConverterLeadInput } from "@/lib/queries";
import {
  aplicarErrosDaApi,
  cpfValido,
  parseValorBR,
  semVazios,
  valorParaCampo,
} from "@/lib/formularios";
import type { Cliente, Lead } from "@/types/api";

const opcional = (schema: z.ZodString) => z.union([z.literal(""), schema]);

const schema = z.object({
  nome: z.string().trim().min(2, "Informe o nome completo").max(120),
  email: z.string().trim().min(1, "Informe o e-mail").email("E-mail inválido").max(254),
  cpf: z.string().refine(cpfValido, "CPF inválido"),
  telefone: opcional(z.string().trim().min(8, "Telefone incompleto").max(30)),
  cidade: opcional(z.string().trim().min(2, "Cidade inválida").max(80)),
  uf: opcional(z.string().trim().regex(/^[A-Za-z]{2}$/, "Use a sigla (ex.: SP)")),
  patrimonio: z.string().refine((v) => {
    const n = parseValorBR(v);
    return n === null || (Number.isFinite(n) && n >= 0);
  }, "Valor inválido (ex.: 1.500.000,00)"),
});

type Valores = z.infer<typeof schema>;
const CAMPOS = ["nome", "email", "cpf", "telefone", "cidade", "uf", "patrimonio"] as const;

type Props = {
  lead: Lead;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConvertido: (cliente: Cliente) => void;
};

export function ConverterLeadDialog({ lead, open, onOpenChange, onConvertido }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Converter em cliente</DialogTitle>
          <DialogDescription>
            Cria o cadastro de {lead.nome} na carteira do mesmo assessor e fecha a oportunidade.
            O cliente começa como prospecto, sem suitability.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <FormConversao
            lead={lead}
            onCancelar={() => onOpenChange(false)}
            onConvertido={(c) => {
              onOpenChange(false);
              onConvertido(c);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function FormConversao({
  lead,
  onCancelar,
  onConvertido,
}: {
  lead: Lead;
  onCancelar: () => void;
  onConvertido: (c: Cliente) => void;
}) {
  const converter = useConverterLead(lead.id);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Valores>({
    resolver: zodResolver(schema),
    defaultValues: {
      nome: lead.nome,
      email: lead.email ?? "",
      cpf: "",
      telefone: lead.telefone ?? "",
      cidade: "",
      uf: "",
      patrimonio: valorParaCampo(lead.valorEstimado),
    },
  });

  async function onSubmit(v: Valores) {
    setErroGeral(null);
    try {
      const { cliente } = await converter.mutateAsync({
        ...semVazios({
          nome: v.nome.trim(),
          email: v.email.trim(),
          telefone: v.telefone.trim(),
          cidade: v.cidade.trim(),
          uf: v.uf.trim().toUpperCase(),
          patrimonio: parseValorBR(v.patrimonio) ?? undefined,
        }),
        cpf: v.cpf.replace(/\D/g, ""),
      } as ConverterLeadInput);
      toast.success(`${cliente.nome} agora é cliente`, {
        description: "Próximo passo: aplicar a suitability.",
      });
      onConvertido(cliente);
    } catch (e) {
      setErroGeral(aplicarErrosDaApi(e, setError, CAMPOS));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-3">
      <Campo id="conv-nome" label="Nome completo" erro={errors.nome?.message} obrigatorio>
        <Input autoComplete="off" {...ariaCampo("conv-nome", errors.nome?.message)} {...register("nome")} />
      </Campo>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo id="conv-cpf" label="CPF" erro={errors.cpf?.message} obrigatorio>
          <Input
            inputMode="numeric"
            autoComplete="off"
            placeholder="000.000.000-00"
            autoFocus
            {...ariaCampo("conv-cpf", errors.cpf?.message)}
            {...register("cpf")}
          />
        </Campo>
        <Campo id="conv-email" label="E-mail" erro={errors.email?.message} obrigatorio>
          <Input type="email" autoComplete="off" {...ariaCampo("conv-email", errors.email?.message)} {...register("email")} />
        </Campo>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo id="conv-telefone" label="Telefone" erro={errors.telefone?.message}>
          <Input type="tel" autoComplete="off" {...ariaCampo("conv-telefone", errors.telefone?.message)} {...register("telefone")} />
        </Campo>
        <Campo
          id="conv-patrimonio"
          label="Patrimônio declarado (R$)"
          erro={errors.patrimonio?.message}
          dica="Sugerido: valor estimado da oportunidade"
        >
          <Input
            inputMode="decimal"
            autoComplete="off"
            {...ariaCampo("conv-patrimonio", errors.patrimonio?.message, "Sugerido: valor estimado da oportunidade")}
            {...register("patrimonio")}
          />
        </Campo>
      </div>
      <div className="grid gap-3 grid-cols-[1fr_5rem]">
        <Campo id="conv-cidade" label="Cidade" erro={errors.cidade?.message}>
          <Input autoComplete="off" {...ariaCampo("conv-cidade", errors.cidade?.message)} {...register("cidade")} />
        </Campo>
        <Campo id="conv-uf" label="UF" erro={errors.uf?.message}>
          <Input maxLength={2} className="uppercase" autoComplete="off" {...ariaCampo("conv-uf", errors.uf?.message)} {...register("uf")} />
        </Campo>
      </div>

      <ErroFormulario mensagem={erroGeral} />

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancelar} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          Converter em cliente
        </Button>
      </DialogFooter>
    </form>
  );
}
