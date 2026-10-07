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
import { Campo, ErroFormulario, ariaCampo } from "./campo";
import { SelectOpcoes } from "./select-opcoes";
import {
  useAssessores,
  useAtualizarCliente,
  useCriarCliente,
  type ClienteAtualizarInput,
  type ClienteCriarInput,
} from "@/lib/queries";
import { usePermissoes } from "@/lib/permissoes";
import { statusClienteLabel } from "@/lib/labels";
import {
  aplicarErrosDaApi,
  cpfValido,
  parseValorBR,
  semVazios,
  valorParaCampo,
} from "@/lib/formularios";
import type { Cliente, StatusCliente } from "@/types/api";

const opcional = (schema: z.ZodString) => z.union([z.literal(""), schema]);

const schemaBase = z.object({
  nome: z.string().trim().min(2, "Informe o nome completo").max(120),
  email: z.string().trim().min(1, "Informe o e-mail").email("E-mail inválido").max(254),
  cpf: z.string(),
  telefone: opcional(z.string().trim().min(8, "Telefone incompleto").max(30)),
  cidade: opcional(z.string().trim().min(2, "Cidade inválida").max(80)),
  uf: opcional(z.string().trim().regex(/^[A-Za-z]{2}$/, "Use a sigla (ex.: SP)")),
  patrimonio: z.string().refine((v) => {
    const n = parseValorBR(v);
    return n === null || (Number.isFinite(n) && n >= 0);
  }, "Valor inválido (ex.: 1.500.000,00)"),
  status: z.string(),
  responsavelId: z.string(),
});

const schemaCriacao = schemaBase.extend({
  cpf: z.string().refine(cpfValido, "CPF inválido"),
});

type Valores = z.infer<typeof schemaBase>;
const CAMPOS = ["nome", "email", "cpf", "telefone", "cidade", "uf", "patrimonio", "status", "responsavelId"] as const;

// INATIVO fica fora: inativar é ação própria (só ADMIN), com confirmação
const STATUS_EDITAVEIS: Partial<Record<StatusCliente, string>> = {
  PROSPECTO: statusClienteLabel.PROSPECTO,
  ATIVO: statusClienteLabel.ATIVO,
  BLOQUEADO: statusClienteLabel.BLOQUEADO,
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Presente = edição; ausente = cadastro */
  cliente?: Cliente;
  onSalvo?: (cliente: Cliente) => void;
};

export function ClienteFormDialog({ open, onOpenChange, cliente, onSalvo }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{cliente ? "Editar cliente" : "Novo cliente"}</DialogTitle>
          <DialogDescription>
            {cliente
              ? "CPF e perfil não mudam por aqui: o CPF é fixo e o perfil vem da suitability."
              : "O cliente começa como prospecto. Depois do cadastro, aplique a suitability para definir o perfil."}
          </DialogDescription>
        </DialogHeader>
        {/* Monta de novo a cada abertura: o formulário sempre parte do registro atual */}
        {open && (
          <FormCliente
            cliente={cliente}
            onCancelar={() => onOpenChange(false)}
            onSalvo={(c) => {
              onOpenChange(false);
              onSalvo?.(c);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function FormCliente({
  cliente,
  onCancelar,
  onSalvo,
}: {
  cliente?: Cliente;
  onCancelar: () => void;
  onSalvo: (c: Cliente) => void;
}) {
  const edicao = !!cliente;
  const { podeAtribuirResponsavel: ehAdmin } = usePermissoes();
  const assessores = useAssessores(ehAdmin);
  const criar = useCriarCliente();
  const atualizar = useAtualizarCliente(cliente?.id ?? "");
  const [erroGeral, setErroGeral] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<Valores>({
    resolver: zodResolver(edicao ? schemaBase : schemaCriacao),
    defaultValues: {
      nome: cliente?.nome ?? "",
      email: cliente?.email ?? "",
      cpf: "",
      telefone: cliente?.telefone ?? "",
      cidade: cliente?.cidade ?? "",
      uf: cliente?.uf ?? "",
      patrimonio: valorParaCampo(cliente?.patrimonio),
      status: cliente?.status ?? "PROSPECTO",
      responsavelId: cliente?.responsavelId ?? "",
    },
  });

  async function onSubmit(v: Valores) {
    setErroGeral(null);
    const campos = semVazios({
      nome: v.nome.trim(),
      email: v.email.trim(),
      telefone: v.telefone.trim(),
      cidade: v.cidade.trim(),
      uf: v.uf.trim().toUpperCase(),
      patrimonio: parseValorBR(v.patrimonio) ?? undefined,
      responsavelId: ehAdmin ? v.responsavelId : "",
    });
    try {
      if (edicao) {
        // Só o que mudou: a auditoria registra exatamente o que o usuário alterou
        const alterado = Object.fromEntries(
          Object.entries({ ...campos, status: v.status }).filter(
            ([k]) => dirtyFields[k as keyof Valores],
          ),
        ) as ClienteAtualizarInput;
        if (Object.keys(alterado).length === 0) {
          onCancelar();
          return;
        }
        const salvo = await atualizar.mutateAsync(alterado);
        toast.success("Cliente atualizado");
        onSalvo(salvo);
      } else {
        const salvo = await criar.mutateAsync({
          ...campos,
          cpf: v.cpf.replace(/\D/g, ""),
        } as ClienteCriarInput);
        toast.success("Cliente cadastrado", { description: "Próximo passo: aplicar a suitability." });
        onSalvo(salvo);
      }
    } catch (e) {
      setErroGeral(aplicarErrosDaApi(e, setError, CAMPOS));
    }
  }

  const opcoesAssessor = Object.fromEntries((assessores.data ?? []).map((a) => [a.id, a.nome]));

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-3">
      <Campo id="cli-nome" label="Nome completo" erro={errors.nome?.message} obrigatorio>
        <Input autoComplete="off" {...ariaCampo("cli-nome", errors.nome?.message)} {...register("nome")} />
      </Campo>

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo id="cli-email" label="E-mail" erro={errors.email?.message} obrigatorio>
          <Input type="email" autoComplete="off" {...ariaCampo("cli-email", errors.email?.message)} {...register("email")} />
        </Campo>
        {edicao ? (
          <Campo id="cli-cpf" label="CPF">
            <Input id="cli-cpf" value={cliente.cpfMasked} disabled readOnly />
          </Campo>
        ) : (
          <Campo id="cli-cpf" label="CPF" erro={errors.cpf?.message} obrigatorio>
            <Input
              inputMode="numeric"
              autoComplete="off"
              placeholder="000.000.000-00"
              {...ariaCampo("cli-cpf", errors.cpf?.message)}
              {...register("cpf")}
            />
          </Campo>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo id="cli-telefone" label="Telefone" erro={errors.telefone?.message}>
          <Input type="tel" autoComplete="off" {...ariaCampo("cli-telefone", errors.telefone?.message)} {...register("telefone")} />
        </Campo>
        <Campo
          id="cli-patrimonio"
          label="Patrimônio declarado (R$)"
          erro={errors.patrimonio?.message}
          dica="Ex.: 1.500.000,00"
        >
          <Input
            inputMode="decimal"
            autoComplete="off"
            {...ariaCampo("cli-patrimonio", errors.patrimonio?.message, "Ex.: 1.500.000,00")}
            {...register("patrimonio")}
          />
        </Campo>
      </div>

      <div className="grid gap-3 grid-cols-[1fr_5rem]">
        <Campo id="cli-cidade" label="Cidade" erro={errors.cidade?.message}>
          <Input autoComplete="off" {...ariaCampo("cli-cidade", errors.cidade?.message)} {...register("cidade")} />
        </Campo>
        <Campo id="cli-uf" label="UF" erro={errors.uf?.message}>
          <Input maxLength={2} className="uppercase" autoComplete="off" {...ariaCampo("cli-uf", errors.uf?.message)} {...register("uf")} />
        </Campo>
      </div>

      {edicao && cliente.status !== "INATIVO" && (
        <Campo id="cli-status" label="Status" erro={errors.status?.message}>
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <SelectOpcoes
                id="cli-status"
                value={field.value}
                onChange={field.onChange}
                opcoes={STATUS_EDITAVEIS as Record<string, string>}
              />
            )}
          />
        </Campo>
      )}

      {ehAdmin && (
        <Campo
          id="cli-responsavel"
          label="Assessor responsável"
          erro={errors.responsavelId?.message}
          dica={assessores.isError ? "Não foi possível carregar os assessores." : undefined}
        >
          <Controller
            control={control}
            name="responsavelId"
            render={({ field }) => (
              <SelectOpcoes
                id="cli-responsavel"
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
        <Button type="button" variant="outline" onClick={onCancelar} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {edicao ? "Salvar alterações" : "Cadastrar cliente"}
        </Button>
      </DialogFooter>
    </form>
  );
}
