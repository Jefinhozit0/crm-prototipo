import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./api";
import type {
  AplicarSuitabilityResult,
  AuthUser,
  Cliente,
  ClienteDetalhado,
  GenerateResult,
  LeadBoardColumn,
  Page,
  Produto,
  Questionario,
  Recomendacao,
  StatusCliente,
  StatusRecomendacao,
  Suitability,
  PerfilInvestidor,
  CategoriaProduto,
} from "@/types/api";

// ----- Auth -----

export const ME_QUERY_KEY = ["auth", "me"] as const;

export function useMe() {
  return useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: () => apiFetch<{ user: AuthUser }>("/auth/me").then((r) => r.user),
    retry: false,
    staleTime: 5 * 60_000,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; password: string }) =>
      apiFetch<{ user: AuthUser }>("/auth/login", { method: "POST", body }),
    onSuccess: ({ user }) => {
      qc.setQueryData(ME_QUERY_KEY, user);
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<null>("/auth/logout", { method: "POST" }),
    // onSettled roda em sucesso E erro — sempre limpa o cache local.
    onSettled: () => {
      qc.clear();
    },
  });
}

// ----- Clientes -----

export type ClientesFilters = {
  page?: number;
  limit?: number;
  perfil?: PerfilInvestidor;
  status?: StatusCliente;
  q?: string;
  sort?: string;
};

export function useClientes(filters: ClientesFilters = {}) {
  return useQuery({
    queryKey: ["clientes", filters],
    queryFn: () =>
      apiFetch<Page<Cliente>>("/clientes", {
        query: filters,
      }),
  });
}

export const CLIENTE_DETALHADO_KEY = "cliente-detalhado" as const;

export function useClienteDetalhado(id: string | null) {
  return useQuery({
    queryKey: [CLIENTE_DETALHADO_KEY, id],
    queryFn: () => apiFetch<ClienteDetalhado>(`/clientes/${id}/detalhado`),
    enabled: !!id,
  });
}

// ----- Produtos -----

export type ProdutosFilters = {
  page?: number;
  limit?: number;
  categoria?: CategoriaProduto;
  perfilMinimo?: PerfilInvestidor;
  ativo?: boolean;
  riscoMax?: number;
  q?: string;
};

export function useProdutos(filters: ProdutosFilters = {}) {
  return useQuery({
    queryKey: ["produtos", filters],
    queryFn: () =>
      apiFetch<Page<Produto>>("/produtos", {
        query: filters,
      }),
  });
}

// ----- Leads -----

export function useLeadsBoard(responsavelId?: string) {
  return useQuery({
    queryKey: ["leads", "board", responsavelId ?? null],
    queryFn: () =>
      apiFetch<LeadBoardColumn[]>("/leads/board", {
        query: { responsavelId },
      }),
  });
}

// ----- Recomendações IA -----

export type RecomendacoesFilters = {
  page?: number;
  limit?: number;
  clienteId?: string;
  status?: StatusRecomendacao;
};

export const RECOMENDACOES_KEY = "recomendacoes" as const;

export function useRecomendacoes(filters: RecomendacoesFilters = {}) {
  return useQuery({
    queryKey: [RECOMENDACOES_KEY, filters],
    queryFn: () =>
      apiFetch<Page<Recomendacao>>("/recomendacoes", {
        query: filters,
      }),
  });
}

export function useRecomendacao(id: string | null) {
  return useQuery({
    queryKey: [RECOMENDACOES_KEY, "detail", id],
    queryFn: () => apiFetch<Recomendacao>(`/recomendacoes/${id}`),
    enabled: !!id,
  });
}

export function useGenerateRecomendacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { clienteId: string; topN?: number }) =>
      apiFetch<GenerateResult>("/recomendacoes/generate", {
        method: "POST",
        body,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [RECOMENDACOES_KEY] });
      qc.invalidateQueries({ queryKey: [CLIENTE_DETALHADO_KEY] });
    },
  });
}

export function useAprovarRecomendacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<Recomendacao>(`/recomendacoes/${id}/aprovar`, {
        method: "PATCH",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [RECOMENDACOES_KEY] });
      qc.invalidateQueries({ queryKey: [CLIENTE_DETALHADO_KEY] });
    },
  });
}

// ----- Suitability -----

export const SUITABILITY_RECENTES_KEY = "suitability-recentes" as const;
export const QUESTIONARIO_KEY = "suitability-questionario" as const;

export function useQuestionario() {
  return useQuery({
    queryKey: [QUESTIONARIO_KEY],
    queryFn: () => apiFetch<Questionario>("/suitability/questionario"),
    staleTime: 60 * 60_000, // 1h — não muda em runtime
  });
}

export function useSuitabilityRecentes(limit = 20) {
  return useQuery({
    queryKey: [SUITABILITY_RECENTES_KEY, limit],
    queryFn: () =>
      apiFetch<
        Array<Suitability & { cliente: { id: string; nome: string; email: string } }>
      >("/suitability", { query: { limit } }),
  });
}

export function useAplicarSuitability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { clienteId: string; respostas: Record<string, string> }) =>
      apiFetch<AplicarSuitabilityResult>("/suitability", {
        method: "POST",
        body,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [CLIENTE_DETALHADO_KEY] });
      qc.invalidateQueries({ queryKey: ["clientes"] });
      qc.invalidateQueries({ queryKey: [SUITABILITY_RECENTES_KEY] });
    },
  });
}

export function useRecusarRecomendacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; motivo: string }) =>
      apiFetch<Recomendacao>(`/recomendacoes/${input.id}/recusar`, {
        method: "PATCH",
        body: { motivo: input.motivo },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [RECOMENDACOES_KEY] });
      qc.invalidateQueries({ queryKey: [CLIENTE_DETALHADO_KEY] });
    },
  });
}
