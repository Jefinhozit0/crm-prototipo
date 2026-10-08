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
  it("KPIs e séries vêm da API; nenhum dado demonstrativo sobra", async () => {
    mockApi({
      "GET /api/auth/me": usuario(),
      "GET /api/dashboard/resumo": {
        aumTotal: 32_400_000,
        patrimonioDeclarado: 40_000_000,
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
      "GET /api/carteira/series": {
        base: "custo",
        meses: [
          { mes: "2026-09", patrimonioAplicado: 1_000_000, entradas: 1_000_000, saidas: 0, captacaoLiquida: 1_000_000 },
          { mes: "2026-10", patrimonioAplicado: 900_000, entradas: 0, saidas: 100_000, captacaoLiquida: -100_000 },
        ],
      },
    });
    const { container } = renderComQuery(<DashboardPage />);

    expect(await screen.findByText("R$ 32.400.000")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sem suitability válida/ })).toHaveTextContent(/^1 cliente/);
    expect(screen.getByText(/patrimônio declarado: R\$ 40\.000\.000/)).toBeInTheDocument();
    // Séries reais: a tabela acessível traz os meses e os valores da API
    const tabela = await screen.findByRole("table", { name: "Evolução mensal da carteira" });
    expect(tabela).toHaveTextContent("set/26");
    expect(tabela).toHaveTextContent("−R$ 100.000");
    expect(screen.queryByText("Dados demonstrativos")).not.toBeInTheDocument();
    // Formato das antigas séries fictícias ("R$ 184 mi")
    expect(container).not.toHaveTextContent(/R\$ \d+ mi\b/);
    // Nenhum dado fictício antigo (mock) sobrou na tela
    expect(screen.queryByText(/184\.320\.000/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Tarefas do dia/)).not.toBeInTheDocument();
  });
});
