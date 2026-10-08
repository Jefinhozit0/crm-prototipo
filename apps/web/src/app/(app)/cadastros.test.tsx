import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderComQuery, jsonResponse } from "@/test/render";
import { mockApi, usuario } from "@/test/fetch-mock";
import LeadsPage from "./leads/page";
import PipelinePage from "./pipeline/page";
import ProdutosPage from "./produtos/page";
import type { Lead, LeadBoardColumn, Produto } from "@/types/api";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push }),
  usePathname: () => "/",
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

afterEach(() => {
  vi.unstubAllGlobals();
  push.mockReset();
});

const pagina = <T,>(data: T[]) => ({
  data,
  meta: { page: 1, limit: 20, total: data.length, totalPages: data.length ? 1 : 0 },
});

const clienteSalvo = {
  id: "c9",
  nome: "Diana Nova",
  email: "diana@x.com",
  telefone: null,
  cpfMasked: "***.***.247-25",
  cidade: null,
  uf: null,
  perfil: "MODERADO",
  status: "PROSPECTO",
  patrimonio: 1_500_000,
  ultimaInteracao: null,
  responsavelId: "u1",
  responsavel: null,
  createdAt: "2026-10-07T12:00:00Z",
  updatedAt: "2026-10-07T12:00:00Z",
};

describe("Cadastro de cliente", () => {
  it("valida CPF no navegador, envia o payload limpo e abre a ficha", async () => {
    const user = userEvent.setup();
    const { chamadas } = mockApi({
      "GET /api/auth/me": usuario("ASSESSOR"),
      "GET /api/clientes": pagina([]),
      "POST /api/clientes": () => jsonResponse(clienteSalvo, 201),
    });
    renderComQuery(<LeadsPage />);

    await user.click(await screen.findByRole("button", { name: /Novo cliente/ }));
    const dialogo = await screen.findByRole("dialog");
    await user.type(within(dialogo).getByLabelText(/Nome completo/), "Diana Nova");
    await user.type(within(dialogo).getByLabelText(/E-mail/), "diana@x.com");
    await user.type(within(dialogo).getByLabelText(/CPF/), "529.982.247-24");
    await user.type(within(dialogo).getByLabelText(/Patrimônio/), "1.500.000,00");
    await user.click(within(dialogo).getByRole("button", { name: "Cadastrar cliente" }));

    expect(await within(dialogo).findByText("CPF inválido")).toBeInTheDocument();
    expect(within(dialogo).getByLabelText(/CPF/)).toHaveAttribute("aria-invalid", "true");
    expect(chamadas.some((c) => c.metodo === "POST")).toBe(false);

    const cpf = within(dialogo).getByLabelText(/CPF/);
    await user.clear(cpf);
    await user.type(cpf, "529.982.247-25");
    await user.click(within(dialogo).getByRole("button", { name: "Cadastrar cliente" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/clientes/c9"));
    const post = chamadas.find((c) => c.metodo === "POST");
    // Sem campos vazios, CPF só com dígitos, valor em número; assessor não escolhe responsável
    expect(post?.body).toEqual({
      nome: "Diana Nova",
      email: "diana@x.com",
      cpf: "52998224725",
      patrimonio: 1_500_000,
    });
  });

  it("CPF já cadastrado aparece no próprio campo", async () => {
    const user = userEvent.setup();
    mockApi({
      "GET /api/auth/me": usuario("ASSESSOR"),
      "GET /api/clientes": pagina([]),
      "POST /api/clientes": () => jsonResponse({ message: "Já existe um cliente com este CPF" }, 409),
    });
    renderComQuery(<LeadsPage />);

    await user.click(await screen.findByRole("button", { name: /Novo cliente/ }));
    const dialogo = await screen.findByRole("dialog");
    await user.type(within(dialogo).getByLabelText(/Nome completo/), "Diana Nova");
    await user.type(within(dialogo).getByLabelText(/E-mail/), "diana@x.com");
    await user.type(within(dialogo).getByLabelText(/CPF/), "52998224725");
    await user.click(within(dialogo).getByRole("button", { name: "Cadastrar cliente" }));

    expect(await within(dialogo).findByText("Já existe um cliente com este CPF")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("perfil só de leitura não vê o botão de cadastro", async () => {
    mockApi({ "GET /api/auth/me": usuario("READONLY"), "GET /api/clientes": pagina([]) });
    renderComQuery(<LeadsPage />);
    expect(await screen.findByText("Nenhum cliente corresponde aos filtros.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Novo cliente/ })).not.toBeInTheDocument();
  });
});

const lead: Lead = {
  id: "l1",
  nome: "Carlos Mendes",
  email: "carlos@x.com",
  telefone: null,
  origem: "Indicação",
  estagio: "QUALIFICACAO",
  valorEstimado: 1_200_000,
  observacoes: null,
  responsavelId: "u1",
  responsavel: { id: "u1", nome: "João Diniz", email: "joao@ce.com" },
  clienteId: null,
  cliente: null,
  createdAt: "2026-09-01T12:00:00Z",
  updatedAt: "2026-09-01T12:00:00Z",
  fechadoEm: null,
};

const board = (itens: Lead[]): LeadBoardColumn[] =>
  (["PROSPECCAO", "QUALIFICACAO", "PROPOSTA", "NEGOCIACAO", "FECHADO", "PERDIDO"] as const).map((estagio) => {
    const doEstagio = itens.filter((l) => l.estagio === estagio);
    return { estagio, count: doEstagio.length, total: doEstagio.reduce((a, l) => a + l.valorEstimado, 0), itens: doEstagio };
  });

describe("Pipeline: ficha e conversão de lead", () => {
  it("abre a ficha com histórico e converte em cliente", async () => {
    const user = userEvent.setup();
    const { chamadas } = mockApi({
      "GET /api/auth/me": usuario("ASSESSOR"),
      "GET /api/leads/board": board([lead]),
      "GET /api/leads/l1": {
        ...lead,
        estagioHistorico: [
          { id: "h2", estagio: "QUALIFICACAO", notas: "Reunião feita", criadoEm: "2026-09-10T12:00:00Z" },
          { id: "h1", estagio: "PROSPECCAO", notas: "Lead criado", criadoEm: "2026-09-01T12:00:00Z" },
        ],
      },
      "POST /api/leads/l1/converter": () =>
        jsonResponse({ lead: { ...lead, estagio: "FECHADO", clienteId: "c9" }, cliente: { ...clienteSalvo, nome: "Carlos Mendes" } }, 201),
    });
    renderComQuery(<PipelinePage />);

    await user.click(await screen.findByRole("button", { name: "Carlos Mendes" }));
    const ficha = await screen.findByRole("dialog");
    expect(await within(ficha).findByText(/Reunião feita/)).toBeInTheDocument();

    await user.click(within(ficha).getByRole("button", { name: /Converter em cliente/ }));
    const conversao = await screen.findByRole("dialog");
    // Dados do lead já vêm preenchidos; falta só o CPF
    expect(within(conversao).getByLabelText(/Nome completo/)).toHaveValue("Carlos Mendes");
    expect(within(conversao).getByLabelText(/E-mail/)).toHaveValue("carlos@x.com");
    expect(within(conversao).getByLabelText(/Patrimônio/)).toHaveValue("1.200.000");

    await user.type(within(conversao).getByLabelText(/CPF/), "529.982.247-25");
    await user.type(within(conversao).getByLabelText(/^UF/), "sp");
    await user.click(within(conversao).getByRole("button", { name: "Converter em cliente" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/clientes/c9"));
    expect(chamadas.find((c) => c.metodo === "POST")?.body).toEqual({
      nome: "Carlos Mendes",
      email: "carlos@x.com",
      cpf: "52998224725",
      uf: "SP",
      patrimonio: 1_200_000,
    });
  });

  it("lead convertido mostra o vínculo e não oferece excluir nem mover", async () => {
    const user = userEvent.setup();
    const convertido = { ...lead, estagio: "FECHADO" as const, clienteId: "c9", cliente: { id: "c9", nome: "Carlos Mendes" } };
    mockApi({
      "GET /api/auth/me": usuario("ASSESSOR"),
      "GET /api/leads/board": board([convertido]),
      "GET /api/leads/l1": { ...convertido, estagioHistorico: [] },
    });
    renderComQuery(<PipelinePage />);

    await user.click(await screen.findByRole("button", { name: "Carlos Mendes" }));
    const ficha = await screen.findByRole("dialog");
    expect(await within(ficha).findByText(/Convertida em cliente/)).toBeInTheDocument();
    expect(within(ficha).getByRole("link", { name: "Abrir cliente" })).toHaveAttribute("href", "/clientes/c9");
    expect(within(ficha).queryByRole("button", { name: /Excluir/ })).not.toBeInTheDocument();
    expect(within(ficha).queryByRole("button", { name: /Mover/ })).not.toBeInTheDocument();
  });

  it("nova oportunidade envia só os campos preenchidos", async () => {
    const user = userEvent.setup();
    const { chamadas } = mockApi({
      "GET /api/auth/me": usuario("ASSESSOR"),
      "GET /api/leads/board": board([]),
      "POST /api/leads": () => jsonResponse({ ...lead, id: "l2" }, 201),
    });
    renderComQuery(<PipelinePage />);

    await user.click(await screen.findByRole("button", { name: /Nova oportunidade/ }));
    const dialogo = await screen.findByRole("dialog");
    await user.type(within(dialogo).getByLabelText(/^Nome/), "Helena Sá");
    await user.type(within(dialogo).getByLabelText(/Origem/), "Evento");
    await user.type(within(dialogo).getByLabelText(/Valor estimado/), "3.500.000");
    await user.click(within(dialogo).getByRole("button", { name: "Criar oportunidade" }));

    await waitFor(() => expect(chamadas.some((c) => c.metodo === "POST")).toBe(true));
    expect(chamadas.find((c) => c.metodo === "POST")?.body).toEqual({
      nome: "Helena Sá",
      origem: "Evento",
      valorEstimado: 3_500_000,
    });
  });
});

const produto: Produto = {
  id: "p1",
  nome: "CDB Banco A",
  emissor: "Banco A",
  categoria: "RENDA_FIXA",
  rentabilidadeAno: 11.5,
  risco: 1,
  tributacao: "TRIBUTADO",
  perfilMinimo: "CONSERVADOR",
  liquidez: "D+1",
  taxaAdmin: null,
  taxaPerformance: null,
  ticker: null,
  ativo: true,
  descricao: null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

describe("Catálogo de produtos", () => {
  it("ADMIN edita e o PATCH leva só o que mudou", async () => {
    const user = userEvent.setup();
    const { chamadas } = mockApi({
      "GET /api/auth/me": usuario("ADMIN"),
      "GET /api/produtos": pagina([produto]),
      "PATCH /api/produtos/p1": { ...produto, rentabilidadeAno: 12 },
    });
    renderComQuery(<ProdutosPage />);

    await user.click(await screen.findByRole("button", { name: "Editar CDB Banco A" }));
    const dialogo = await screen.findByRole("dialog");
    const rent = within(dialogo).getByLabelText(/Rentabilidade/);
    expect(rent).toHaveValue("11,5");
    await user.clear(rent);
    await user.type(rent, "12");
    await user.click(within(dialogo).getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => expect(chamadas.some((c) => c.metodo === "PATCH")).toBe(true));
    expect(chamadas.find((c) => c.metodo === "PATCH")?.body).toEqual({ rentabilidadeAno: 12 });
  });

  it("desativar pede confirmação antes do PATCH", async () => {
    const user = userEvent.setup();
    const { chamadas } = mockApi({
      "GET /api/auth/me": usuario("ADMIN"),
      "GET /api/produtos": pagina([produto]),
      "PATCH /api/produtos/p1": { ...produto, ativo: false },
    });
    renderComQuery(<ProdutosPage />);

    await user.click(await screen.findByRole("button", { name: "Desativar CDB Banco A" }));
    const confirmacao = await screen.findByRole("dialog");
    expect(chamadas.some((c) => c.metodo === "PATCH")).toBe(false);
    await user.click(within(confirmacao).getByRole("button", { name: "Desativar" }));
    await waitFor(() => expect(chamadas.find((c) => c.metodo === "PATCH")?.body).toEqual({ ativo: false }));
  });

  it("assessor consulta o catálogo sem ações de curadoria", async () => {
    mockApi({ "GET /api/auth/me": usuario("ASSESSOR"), "GET /api/produtos": pagina([produto]) });
    renderComQuery(<ProdutosPage />);
    expect(await screen.findByText("CDB Banco A")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Novo produto/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Editar/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Mostrar inativos")).not.toBeInTheDocument();
  });
});
