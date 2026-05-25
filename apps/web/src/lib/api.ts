// Caminho relativo — passa pelo rewrite do Next (vide next.config.ts) e cai
// no NestJS na 3333 com cookies same-origin.
const API_BASE = "/api";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public payload?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type FetchOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  /** Não tentar refresh em caso de 401 — usado internamente pra evitar loops */
  _noRetry?: boolean;
};

function buildUrl(path: string, query?: FetchOptions["query"]) {
  const url = new URL(
    `${API_BASE}/${path.replace(/^\//, "")}`,
    typeof window !== "undefined" ? window.location.origin : "http://localhost",
  );
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.pathname + url.search;
}

async function rawFetch(path: string, opts: FetchOptions): Promise<Response> {
  const { body, query, headers, _noRetry: _, ...rest } = opts;
  return fetch(buildUrl(path, query), {
    ...rest,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

let refreshInflight: Promise<boolean> | null = null;

/** Tenta /auth/refresh uma única vez; coalesce chamadas concorrentes */
async function tryRefresh(): Promise<boolean> {
  if (refreshInflight) return refreshInflight;
  refreshInflight = (async () => {
    try {
      const r = await rawFetch("/auth/refresh", {
        method: "POST",
        _noRetry: true,
      });
      return r.ok;
    } catch {
      return false;
    } finally {
      refreshInflight = null;
    }
  })();
  return refreshInflight;
}

export async function apiFetch<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  let res = await rawFetch(path, opts);

  // Auto-refresh: se 401 numa rota que não é /auth/*, tenta uma vez
  const isAuthRoute = path.startsWith("/auth/") || path.startsWith("auth/");
  if (res.status === 401 && !opts._noRetry && !isAuthRoute) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      res = await rawFetch(path, { ...opts, _noRetry: true });
    } else if (typeof window !== "undefined" && window.location.pathname !== "/login") {
      // Sessão totalmente expirada — derruba pro login preservando destino atual
      const from = encodeURIComponent(window.location.pathname);
      window.location.replace(`/login?from=${from}`);
    }
  }

  const text = await res.text();
  const data = text ? safeParse(text) : null;

  if (!res.ok) {
    const msg =
      (data && typeof data === "object" && "message" in data
        ? String((data as { message: unknown }).message)
        : null) ?? `HTTP ${res.status}`;
    throw new ApiError(res.status, msg, data);
  }

  return data as T;
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
