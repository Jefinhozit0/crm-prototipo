/**
 * Converte as respostas da suitability nos parâmetros numéricos que o motor de
 * recomendação usa (horizonte em anos e tolerância a perda em %).
 *
 * Antes, a API lia `respostas.horizonte_anos` / `respostas.tolerancia_perda`
 * como número — mas o questionário grava o ID da opção ("h3", "t2"). Resultado:
 * horizonte sempre caía no default e a tolerância virava NaN, o que fazia o
 * motor rejeitar o request pra qualquer cliente com suitability aplicada pela UI.
 *
 * Mapeamento (conservador — na dúvida, arredonda pro lado de MENOS risco):
 *   horizonte:        h1 "< 1 ano" → 1 | h2 "1 a 3" → 2 | h3 "3 a 7" → 5 | h4 "> 7" → 10
 *   tolerancia_perda: t1 "não aceito perdas" → 5 | t2 "até 10%" → 10
 *                     t3 "até 25%" → 25 | t4 "acima de 25%" → 40
 *
 * "Não aceito perdas" vira 5% e não 0%: com 0 nem renda fixa de risco 1
 * (drawdown de referência 5%) passaria no filtro do motor e o cliente ficaria
 * sem nenhuma recomendação possível. 5% libera só produtos de risco 1.
 */
export const HORIZONTE_ANOS: Record<string, number> = { h1: 1, h2: 2, h3: 5, h4: 10 };
export const TOLERANCIA_PERDA_PCT: Record<string, number> = { t1: 5, t2: 10, t3: 25, t4: 40 };

export type ParametrosSuitability = {
  horizonteAnos: number;
  toleranciaPerda: number;
  /** "questionario" = respostas do form v1; "legado" = valores numéricos (seed antigo) */
  origem: 'questionario' | 'legado';
};

export function extrairParametrosSuitability(respostas: unknown): ParametrosSuitability | null {
  if (!respostas || typeof respostas !== 'object' || Array.isArray(respostas)) return null;
  const r = respostas as Record<string, unknown>;

  // Formato do questionário v1: { horizonte: "h3", tolerancia_perda: "t2", ... }
  const h = typeof r.horizonte === 'string' ? HORIZONTE_ANOS[r.horizonte] : undefined;
  const t =
    typeof r.tolerancia_perda === 'string' ? TOLERANCIA_PERDA_PCT[r.tolerancia_perda] : undefined;
  if (h !== undefined && t !== undefined) {
    return { horizonteAnos: h, toleranciaPerda: t, origem: 'questionario' };
  }

  // Formato legado (seed): { horizonte_anos: 7, tolerancia_perda: 15 }
  const hl = numeroValido(r.horizonte_anos, 0, 100);
  const tl = numeroValido(r.tolerancia_perda, 0, 100);
  if (hl !== null && tl !== null) {
    return { horizonteAnos: Math.round(hl), toleranciaPerda: tl, origem: 'legado' };
  }

  return null;
}

function numeroValido(v: unknown, min: number, max: number): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  if (v < min || v > max) return null;
  return v;
}
