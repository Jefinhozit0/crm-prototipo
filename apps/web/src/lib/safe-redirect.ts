const DEFAULT_PATH = "/dashboard";

/**
 * Só aceita caminhos internos ("/clientes/123"). Bloqueia open redirect via
 * ?from=https://site-externo, ?from=//site-externo ou ?from=/\site-externo.
 */
export function safeRedirectPath(from: string | null | undefined): string {
  if (!from) return DEFAULT_PATH;
  if (!from.startsWith("/")) return DEFAULT_PATH;
  if (from.startsWith("//") || from.startsWith("/\\")) return DEFAULT_PATH;
  if (from === "/login" || from.startsWith("/login?")) return DEFAULT_PATH;
  return from;
}
