import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch, ApiError } from "./api";
import { safeRedirectPath } from "./safe-redirect";
import { jsonResponse } from "@/test/render";

describe("apiFetch — refresh automático", () => {
  const replace = vi.fn();
  const locationOriginal = window.location;

  beforeEach(() => {
    replace.mockReset();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...locationOriginal, origin: "http://localhost", pathname: "/clientes/abc", search: "?x=1", replace },
    });
  });
  afterEach(() => {
    Object.defineProperty(window, "location", { configurable: true, value: locationOriginal });
    vi.unstubAllGlobals();
  });

  it("401 → renova a sessão e repete a request original", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ message: "expirado" }, 401))
      .mockResolvedValueOnce(jsonResponse({ user: {} }, 200)) // /auth/refresh
      .mockResolvedValueOnce(jsonResponse({ ok: true }, 200));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiFetch("/clientes")).resolves.toEqual({ ok: true });
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual(["/api/clientes", "/api/auth/refresh", "/api/clientes"]);
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: "POST", credentials: "include" });
    expect(replace).not.toHaveBeenCalled();
  });

  it("refresh concorrente (outra aba já renovou): repete e segue logado", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 401))
      .mockResolvedValueOnce(jsonResponse({ code: "REFRESH_CONCORRENTE" }, 401))
      .mockResolvedValueOnce(jsonResponse({ ok: true }, 200));
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiFetch("/clientes")).resolves.toEqual({ ok: true });
    expect(replace).not.toHaveBeenCalled();
  });

  it("sessão expirada de vez → manda pro login preservando o destino", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => Promise.resolve(jsonResponse({ message: "Token inválido" }, 401))),
    );
    await expect(apiFetch("/clientes")).rejects.toMatchObject({ status: 401 });
    expect(replace).toHaveBeenCalledWith(`/login?from=${encodeURIComponent("/clientes/abc?x=1")}`);
  });

  it("várias 401 simultâneas disparam um único /auth/refresh", async () => {
    let refreshes = 0;
    const tentativas = new Map<string, number>();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url === "/api/auth/refresh") {
          refreshes++;
          return Promise.resolve(jsonResponse({}, 200));
        }
        const n = (tentativas.get(url) ?? 0) + 1;
        tentativas.set(url, n);
        return Promise.resolve(n === 1 ? jsonResponse({}, 401) : jsonResponse({ url }, 200));
      }),
    );
    await Promise.all([apiFetch("/a"), apiFetch("/b"), apiFetch("/c")]);
    expect(refreshes).toBe(1);
  });

  it("não tenta refresh em rotas /auth (evita loop)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ message: "Credenciais inválidas" }, 401));
    vi.stubGlobal("fetch", fetchMock);
    await expect(apiFetch("/auth/login", { method: "POST", body: {} })).rejects.toThrow("Credenciais inválidas");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falha de rede vira ApiError com mensagem em português", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const erro = (await apiFetch("/clientes").catch((e) => e)) as ApiError;
    expect(erro).toBeInstanceOf(ApiError);
    expect(erro.status).toBe(0);
    expect(erro.message).toMatch(/Não foi possível conectar/);
  });

  it("expõe o requestId do erro pra suporte", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ message: "Erro interno", requestId: "req-9" }, 500)));
    const erro = (await apiFetch("/x").catch((e) => e)) as ApiError;
    expect(erro.requestId).toBe("req-9");
  });

  it("monta query string ignorando valores vazios", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([], 200));
    vi.stubGlobal("fetch", fetchMock);
    await apiFetch("/clientes", { query: { q: "ana", perfil: undefined, page: 2, status: "" } });
    expect(fetchMock.mock.calls[0][0]).toBe("/api/clientes?q=ana&page=2");
  });
});

describe("safeRedirectPath", () => {
  it.each([
    [null, "/dashboard"],
    ["", "/dashboard"],
    ["/clientes/123", "/clientes/123"],
    ["/recomendacao?status=PENDENTE", "/recomendacao?status=PENDENTE"],
    ["https://site-malicioso.com", "/dashboard"],
    ["//site-malicioso.com", "/dashboard"],
    ["/\\site-malicioso.com", "/dashboard"],
    ["javascript:alert(1)", "/dashboard"],
    ["/login", "/dashboard"],
  ])("%s → %s", (entrada, esperado) => {
    expect(safeRedirectPath(entrada)).toBe(esperado);
  });
});
