import { vi } from "vitest";
import { jsonResponse } from "./render";

type Handler = (init: RequestInit & { url: string }) => Response | Promise<Response>;

/**
 * Stub de fetch roteado por "MÉTODO /caminho" (sem query string).
 * Rotas não mapeadas respondem 404 — o teste falha de forma visível.
 */
export function mockApi(rotas: Record<string, Handler | unknown>) {
  const chamadas: { metodo: string; caminho: string; url: string; body: unknown }[] = [];
  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const metodo = (init.method ?? "GET").toUpperCase();
    const caminho = url.split("?")[0];
    const body = typeof init.body === "string" ? JSON.parse(init.body) : undefined;
    chamadas.push({ metodo, caminho, url, body });
    const rota = rotas[`${metodo} ${caminho}`];
    if (rota === undefined) return jsonResponse({ message: `rota não mockada: ${metodo} ${caminho}` }, 404);
    if (typeof rota === "function") return (rota as Handler)({ ...init, url });
    return jsonResponse(rota);
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, chamadas };
}

export const usuario = (role: "ADMIN" | "ASSESSOR" | "COMPLIANCE" | "READONLY" = "ASSESSOR") => ({
  user: { id: "u1", email: "joao@ce.com", nome: "João Diniz", role },
});
