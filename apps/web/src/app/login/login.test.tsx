import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderComQuery, jsonResponse } from "@/test/render";
import { mockApi } from "@/test/fetch-mock";
import LoginPage from "./page";

const replace = vi.fn();
let from: string | null = null;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  useSearchParams: () => ({ get: (k: string) => (k === "from" ? from : null) }),
}));

describe("Login", () => {
  beforeEach(() => {
    replace.mockReset();
    from = null;
  });
  afterEach(() => vi.unstubAllGlobals());

  async function preencherEEnviar(email = "joao@ce.com", senha = "Senha123!") {
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("E-mail"), email);
    await user.type(screen.getByLabelText("Senha"), senha);
    await user.click(screen.getByRole("button", { name: "Entrar" }));
  }

  it("login válido redireciona para o destino interno solicitado", async () => {
    from = "/clientes/abc";
    const { chamadas } = mockApi({ "POST /api/auth/login": { user: { id: "u1", nome: "João", email: "j", role: "ASSESSOR" } } });
    renderComQuery(<LoginPage />);
    await preencherEEnviar();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/clientes/abc"));
    expect(chamadas[0].body).toEqual({ email: "joao@ce.com", password: "Senha123!" });
  });

  it("ignora destino externo (open redirect) e vai pro dashboard", async () => {
    from = "https://site-malicioso.example";
    mockApi({ "POST /api/auth/login": { user: {} } });
    renderComQuery(<LoginPage />);
    await preencherEEnviar();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard"));
  });

  it("credenciais inválidas mostram a mensagem da API num alerta", async () => {
    mockApi({ "POST /api/auth/login": () => jsonResponse({ message: "Credenciais inválidas" }, 401) });
    renderComQuery(<LoginPage />);
    await preencherEEnviar();
    expect(await screen.findByRole("alert")).toHaveTextContent("Credenciais inválidas");
    expect(replace).not.toHaveBeenCalled();
  });

  it("bloqueio por excesso de tentativas tem mensagem própria", async () => {
    mockApi({ "POST /api/auth/login": () => jsonResponse({ message: "x" }, 429) });
    renderComQuery(<LoginPage />);
    await preencherEEnviar();
    expect(await screen.findByRole("alert")).toHaveTextContent(/Muitas tentativas/);
  });

  it("valida o formulário antes de chamar a API", async () => {
    const { fetchMock } = mockApi({});
    renderComQuery(<LoginPage />);
    await preencherEEnviar("nao-e-email", "123");
    expect(await screen.findByText("E-mail inválido")).toBeInTheDocument();
    expect(screen.getByText("Mínimo 6 caracteres")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
