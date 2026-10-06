import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderComQuery, jsonResponse } from "@/test/render";
import { mockApi, usuario } from "@/test/fetch-mock";
import HistoricoPage from "./historico/page";
import DashboardPage from "./dashboard/page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/",
}));

afterEach(() => vi.unstubAllGlobals());

const pagina = <T,>(data: T[]) => ({
  data,
  meta: { page: 1, limit: 20, total: data.length, totalPages: 1 },
});

describe("Histórico de interações (dados reais, sem mock)", () => {
  it("renderiza as interações vindas da API", async () => {
    const { chamadas } = mockApi({
      "GET /api/interacoes": pagina([
        {
          id: "i1",
          tipo: "REUNIAO",
          assunto: "Revisão de carteira Q2",
          resumo: "Rebalanceamento",
          data: "2026-05-22T14:30:00Z",
          cliente: { id: "c1", nome: "Mariana Andrade" },
          autor: { id: "u1", nome: "João Diniz" },
        },
      ]),
    });
    renderComQuery(<HistoricoPage />);
    expect(await screen.findByText("Revisão de carteira Q2")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mariana Andrade" })).toHaveAttribute("href", "/clientes/c1");
    expect(screen.getByText("Reunião")).toBeInTheDocument();
    expect(chamadas[0].url).toContain("/api/interacoes?page=1&limit=20");
  });

  it("estado vazio", async () => {
    mockApi({ "GET /api/interacoes": pagina([]) });
    renderComQuery(<HistoricoPage />);
    expect(await screen.findByText("Nenhuma interação registrada ainda.")).toBeInTheDocument();
  });

  it("estado de erro", async () => {
    mockApi({ "GET /api/interacoes": () => jsonResponse({ message: "Banco de dados indisponível" }, 503) });
    renderComQuery(<HistoricoPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Banco de dados indisponível");
  });

  it("mostra skeleton enquanto carrega", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    renderComQuery(<HistoricoPage />);
    expect(screen.getByLabelText("Carregando")).toBeInTheDocument();
  });
});

describe("Dashboard", () => {
  it("KPIs vêm da API; séries históricas aparecem marcadas como demonstrativas", async () => {
    mockApi({
      "GET /api/auth/me": usuario(),
      "GET /api/dashboard/resumo": {
        aumTotal: 32_400_000,
        clientesAtivos: 4,
        leadsAbertos: 3,
        valorPipeline: 5_350_000,
        recomendacoesPendentes: 2,
        clientesSemSuitabilityValida: 1,
        distribuicaoPerfil: [
          { perfil: "CONSERVADOR", quantidade: 1, pct: 25 },
          { perfil: "MODERADO", quantidade: 2, pct: 50 },
          { perfil: "ARROJADO", quantidade: 1, pct: 25 },
          { perfil: "AGRESSIVO", quantidade: 0, pct: 0 },
        ],
      },
      "GET /api/interacoes": pagina([]),
    });
    renderComQuery(<DashboardPage />);

    expect(await screen.findByText("R$ 32.400.000")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sem suitability válida/ })).toHaveTextContent(/^1 cliente/);
    // Os dois gráficos sem fonte real no banco levam o selo
    expect(screen.getAllByText("Dados demonstrativos")).toHaveLength(2);
    // Nenhum dado fictício antigo (mock) sobrou na tela
    expect(screen.queryByText(/184\.320\.000/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Tarefas do dia/)).not.toBeInTheDocument();
  });
});
