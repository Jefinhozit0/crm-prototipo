import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderComQuery, jsonResponse } from "@/test/render";
import { mockApi } from "@/test/fetch-mock";
import { MovimentacaoDialog, type MovimentacaoInicial } from "./forms/movimentacao-dialog";
import { MovimentacoesRecentes } from "./movimentacoes-recentes";
import type { ClienteDetalhado, Movimentacao, Produto } from "@/types/api";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

afterEach(() => vi.unstubAllGlobals());

const pagina = <T,>(data: T[]) => ({
  data,
  meta: { page: 1, limit: 100, total: data.length, totalPages: data.length ? 1 : 0 },
});

const produto = (id: string, nome: string, perfilMinimo: Produto["perfilMinimo"]): Produto => ({
  id,
  nome,
  emissor: "Banco A",
  categoria: "RENDA_FIXA",
  rentabilidadeAno: 11,
  risco: 1,
  tributacao: "TRIBUTADO",
  perfilMinimo,
  liquidez: "D+1",
  taxaAdmin: null,
  taxaPerformance: null,
  ticker: null,
  ativo: true,
  descricao: null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
});

const cdb = produto("p1", "CDB Liquidez", "CONSERVADOR");
const fundo = produto("p2", "Fundo Ações", "ARROJADO");

const cliente: ClienteDetalhado = {
  id: "c1",
  nome: "Ana Souza",
  email: "ana@x.com",
  telefone: null,
  cpfMasked: "***.***.000-00",
  cidade: null,
  uf: null,
  perfil: "MODERADO",
  status: "ATIVO",
  patrimonio: 1_000_000,
  ultimaInteracao: null,
  responsavelId: "u1",
  responsavel: null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  posicoes: [{ id: "pos1", produto: { id: "p1", nome: "CDB Liquidez", categoria: "RENDA_FIXA", emissor: "Banco A" }, valor: 200_000, adquiridoEm: "2026-01-01T00:00:00Z" }],
  suitability: {
    id: "s1",
    perfilCalculado: "MODERADO",
    pontuacao: 40,
    versaoQuestionario: "v1",
    validoAte: "2027-01-01T00:00:00Z",
    aplicadoEm: "2026-01-01T00:00:00Z",
    vencida: false,
    aplicadoPor: null,
  },
  recomendacoes: [],
};

const movSalva = { id: "m1" };

function abrir(inicial: MovimentacaoInicial, rotas: Record<string, unknown> = {}) {
  const api = mockApi({
    "GET /api/produtos": pagina([cdb, fundo]),
    "POST /api/clientes/c1/movimentacoes": () => jsonResponse(movSalva, 201),
    ...rotas,
  });
  const onOpenChange = vi.fn();
  renderComQuery(<MovimentacaoDialog cliente={cliente} open onOpenChange={onOpenChange} inicial={inicial} />);
  return { ...api, onOpenChange };
}

const postDe = (chamadas: { metodo: string; body: unknown }[]) => chamadas.find((c) => c.metodo === "POST")?.body;

describe("Registrar movimentação", () => {
  it("aplicação adequada ao perfil: envia valor em número e usa a hora atual quando a data é hoje", async () => {
    const user = userEvent.setup();
    const { chamadas, onOpenChange } = abrir({ tipo: "APLICACAO", produtoId: "p1" });
    const dialogo = await screen.findByRole("dialog");

    await user.type(within(dialogo).getByLabelText(/Valor/), "50.000,50");
    await user.click(within(dialogo).getByRole("button", { name: /Registrar aplicação/ }));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(postDe(chamadas)).toEqual({ tipo: "APLICACAO", produtoId: "p1", valor: 50_000.5 });
    expect(within(dialogo).queryByText(/desenquadrada/i)).not.toBeInTheDocument();
  });

  it("produto acima do perfil: avisa (CVM 30) e só envia com a ciência do cliente", async () => {
    const user = userEvent.setup();
    const { chamadas } = abrir({ tipo: "APLICACAO", produtoId: "p2" });
    const dialogo = await screen.findByRole("dialog");

    const aviso = await within(dialogo).findByRole("alert");
    expect(aviso).toHaveTextContent("exige perfil Arrojado e o cliente é Moderado");
    await user.type(within(dialogo).getByLabelText(/Valor/), "1000");
    const enviar = within(dialogo).getByRole("button", { name: /Registrar aplicação/ });
    expect(enviar).toBeDisabled();

    await user.click(within(aviso).getByRole("checkbox"));
    await user.click(enviar);
    await waitFor(() => expect(postDe(chamadas)).toMatchObject({ produtoId: "p2", cienciaDesenquadramento: true }));
  });

  it("resgate acima do saldo é barrado antes de chamar a API", async () => {
    const user = userEvent.setup();
    const { chamadas } = abrir({ tipo: "RESGATE", produtoId: "p1" });
    const dialogo = await screen.findByRole("dialog");

    expect(within(dialogo).getByText(/Saldo: R\$\s200\.000,00/)).toBeInTheDocument();
    await user.type(within(dialogo).getByLabelText(/Valor/), "250.000");
    await user.click(within(dialogo).getByRole("button", { name: /Registrar resgate/ }));

    expect(await within(dialogo).findByText(/O saldo neste produto é/)).toBeInTheDocument();
    expect(chamadas.some((c) => c.metodo === "POST")).toBe(false);
  });

  it("data retroativa vai como meio-dia daquele dia em São Paulo", async () => {
    const user = userEvent.setup();
    const { chamadas } = abrir({ tipo: "APLICACAO", produtoId: "p1" });
    const dialogo = await screen.findByRole("dialog");

    await user.type(within(dialogo).getByLabelText(/Valor/), "100");
    const data = within(dialogo).getByLabelText(/Data da operação/);
    await user.clear(data);
    await user.type(data, "2026-03-15");
    await user.click(within(dialogo).getByRole("button", { name: /Registrar aplicação/ }));

    await waitFor(() => expect(postDe(chamadas)).toMatchObject({ data: "2026-03-15T12:00:00-03:00" }));
  });

  it("executa a recomendação aprovada vinculada", async () => {
    const user = userEvent.setup();
    const { chamadas } = abrir({ tipo: "APLICACAO", produtoId: "p1", recomendacaoId: "r1" });
    const dialogo = await screen.findByRole("dialog");

    expect(within(dialogo).getByText(/passará a/)).toHaveTextContent("Ativa");
    await user.type(within(dialogo).getByLabelText(/Valor/), "100");
    await user.click(within(dialogo).getByRole("button", { name: /Registrar aplicação/ }));
    await waitFor(() => expect(postDe(chamadas)).toMatchObject({ recomendacaoId: "r1" }));
  });

  it("desenquadramento que só a API detecta (ex.: suitability venceu) pede a ciência", async () => {
    const user = userEvent.setup();
    abrir(
      { tipo: "APLICACAO", produtoId: "p1" },
      {
        "POST /api/clientes/c1/movimentacoes": () =>
          jsonResponse({ message: "A suitability do cliente está vencida. Registre a ciência...", code: "DESENQUADRAMENTO" }, 422),
      },
    );
    const dialogo = await screen.findByRole("dialog");
    await user.type(within(dialogo).getByLabelText(/Valor/), "100");
    await user.click(within(dialogo).getByRole("button", { name: /Registrar aplicação/ }));

    expect(await within(dialogo).findByRole("alert")).toHaveTextContent("suitability do cliente está vencida");
    expect(within(dialogo).getByRole("checkbox")).not.toBeChecked();
  });
});

describe("Extrato de movimentações", () => {
  it("mostra sinal em texto, quem registrou e a marca de desenquadramento", async () => {
    const base: Omit<Movimentacao, "id" | "tipo" | "valor" | "desenquadrada"> = {
      clienteId: "c1",
      produtoId: "p1",
      produto: { id: "p1", nome: "CDB Liquidez", categoria: "RENDA_FIXA", emissor: "Banco A" },
      data: "2026-09-10T15:00:00Z",
      observacao: null,
      recomendacaoId: null,
      registradoPor: { id: "u1", nome: "João Diniz" },
      criadoEm: "2026-09-10T15:00:00Z",
    };
    mockApi({
      "GET /api/clientes/c1/movimentacoes": pagina<Movimentacao>([
        { ...base, id: "m2", tipo: "RESGATE", valor: 1500, desenquadrada: false },
        { ...base, id: "m1", tipo: "APLICACAO", valor: 10_000, desenquadrada: true },
      ]),
    });
    renderComQuery(<MovimentacoesRecentes clienteId="c1" />);

    expect(await screen.findByText(/Resgate · CDB Liquidez/)).toBeInTheDocument();
    expect(screen.getByText(/−\sR\$\s1\.500,00/)).toBeInTheDocument();
    expect(screen.getByText(/\+\sR\$\s10\.000,00/)).toBeInTheDocument();
    expect(screen.getByText(/Desenquadrada, com ciência do cliente/)).toBeInTheDocument();
    expect(screen.getAllByText(/João Diniz/)).toHaveLength(2);
  });
});
