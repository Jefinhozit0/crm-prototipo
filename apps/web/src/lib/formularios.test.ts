import { describe, expect, it, vi } from "vitest";
import { ApiError } from "./api";
import { aplicarErrosDaApi, cpfValido, parseValorBR, semVazios, valorParaCampo } from "./formularios";

describe("parseValorBR", () => {
  it.each([
    ["", null],
    ["1500000", 1_500_000],
    ["1.500.000", 1_500_000],
    ["1.500.000,50", 1_500_000.5],
    ["R$ 750.000,00", 750_000],
    ["1500000.5", 1_500_000.5],
    ["12,5", 12.5],
    ["1.500", 1500],
  ])("%j → %j", (entrada, esperado) => {
    expect(parseValorBR(entrada)).toBe(esperado);
  });

  it.each(["abc", "750 mil", "1,5,0", "1.50.000", "-10"])("%j é inválido", (entrada) => {
    expect(parseValorBR(entrada)).toBeNaN();
  });

  it("ida e volta com o formato de edição", () => {
    expect(parseValorBR(valorParaCampo(1_234_567.89))).toBe(1_234_567.89);
    expect(valorParaCampo(null)).toBe("");
  });
});

describe("cpfValido (mesmo algoritmo da API)", () => {
  it("aceita CPF válido com ou sem máscara", () => {
    expect(cpfValido("529.982.247-25")).toBe(true);
    expect(cpfValido("52998224725")).toBe(true);
  });
  it("rejeita dígito errado, sequência repetida e tamanho errado", () => {
    expect(cpfValido("52998224724")).toBe(false);
    expect(cpfValido("111.111.111-11")).toBe(false);
    expect(cpfValido("5299822472")).toBe(false);
  });
});

describe("semVazios", () => {
  it("remove strings vazias e undefined, mantém zero e null", () => {
    expect(semVazios({ a: "", b: undefined, c: 0, d: null, e: "x" })).toEqual({ c: 0, d: null, e: "x" });
  });
});

describe("aplicarErrosDaApi", () => {
  const campos = ["email", "cpf"] as const;

  it("leva fieldErrors da API para os campos", () => {
    const setError = vi.fn();
    const erro = new ApiError(400, "Erro de validação", {
      errors: { fieldErrors: { email: ["E-mail inválido"], outro: ["x"] } },
    });
    expect(aplicarErrosDaApi(erro, setError, campos)).toBeNull();
    expect(setError).toHaveBeenCalledWith("email", { type: "server", message: "E-mail inválido" });
    expect(setError).toHaveBeenCalledTimes(1);
  });

  it("CPF duplicado (409) vira erro do campo CPF", () => {
    const setError = vi.fn();
    const erro = new ApiError(409, "Já existe um cliente com este CPF");
    expect(aplicarErrosDaApi(erro, setError, campos)).toBeNull();
    expect(setError).toHaveBeenCalledWith("cpf", expect.objectContaining({ message: erro.message }));
  });

  it("o resto vira mensagem geral do formulário", () => {
    const setError = vi.fn();
    expect(aplicarErrosDaApi(new ApiError(403, "Sem permissão"), setError, campos)).toBe("Sem permissão");
    expect(aplicarErrosDaApi(new Error("x"), setError, campos)).toMatch(/Não foi possível salvar/);
    expect(setError).not.toHaveBeenCalled();
  });
});
