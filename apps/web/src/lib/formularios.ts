import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { ApiError } from "./api";

/**
 * Lê valor monetário digitado em pt-BR ("R$ 1.500.000,50") ou com ponto
 * decimal ("1500000.5"). Vazio → null; texto inválido (ex.: "750 mil") → NaN.
 */
export function parseValorBR(texto: string): number | null {
  const s = texto.replace(/R\$|\s/g, "");
  if (!s) return null;
  if (!/^\d[\d.,]*$/.test(s)) return NaN;
  // Com vírgula: vírgula é decimal e pontos são milhar
  if (s.includes(",")) {
    if (s.indexOf(",") !== s.lastIndexOf(",")) return NaN;
    return Number(s.replace(/\./g, "").replace(",", "."));
  }
  // Só pontos: mais de um, ou grupo final de 3 dígitos → separador de milhar
  const partes = s.split(".");
  if (partes.length > 2 || (partes.length === 2 && partes[1].length === 3)) {
    return partes.slice(1).every((p) => p.length === 3) ? Number(partes.join("")) : NaN;
  }
  return Number(s);
}

/** Valor numérico já formatado pra edição ("1500000.5" → "1.500.000,50") */
export function valorParaCampo(v: number | null | undefined): string {
  if (v === null || v === undefined) return "";
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(v);
}

/** Mesmo algoritmo da API (apps/api/src/clientes/cpf.ts) — a API revalida. */
export function cpfValido(texto: string): boolean {
  const cpf = texto.replace(/\D/g, "");
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const dv = (base: string, pesoInicial: number) => {
    const soma = [...base].reduce((acc, d, i) => acc + Number(d) * (pesoInicial - i), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return dv(cpf.slice(0, 9), 10) === Number(cpf[9]) && dv(cpf.slice(0, 10), 11) === Number(cpf[10]);
}

/** Remove strings vazias (a API trata campo ausente como "não informado") */
export function semVazios<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== "" && v !== undefined),
  ) as Partial<T>;
}

/**
 * Leva os erros de validação da API (zod flatten → errors.fieldErrors) para os
 * campos do formulário. Devolve a mensagem que não coube em nenhum campo
 * (ou null, se tudo foi mapeado).
 */
export function aplicarErrosDaApi<T extends FieldValues>(
  erro: unknown,
  setError: UseFormSetError<T>,
  campos: readonly Path<T>[],
): string | null {
  if (!(erro instanceof ApiError)) return "Não foi possível salvar. Tente novamente.";

  const fieldErrors = (erro.payload as { errors?: { fieldErrors?: Record<string, string[]> } } | undefined)
    ?.errors?.fieldErrors;
  let mapeou = false;
  if (fieldErrors) {
    for (const [campo, msgs] of Object.entries(fieldErrors)) {
      if ((campos as readonly string[]).includes(campo) && msgs?.[0]) {
        setError(campo as Path<T>, { type: "server", message: msgs[0] });
        mapeou = true;
      }
    }
  }
  // Conflito de CPF (409) é um erro do campo, não do formulário
  if (erro.status === 409 && /CPF/.test(erro.message) && (campos as readonly string[]).includes("cpf")) {
    setError("cpf" as Path<T>, { type: "server", message: erro.message });
    return null;
  }
  return mapeou ? null : erro.message;
}
