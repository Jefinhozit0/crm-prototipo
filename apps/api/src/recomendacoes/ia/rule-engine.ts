import type { CategoriaProduto, PerfilInvestidor } from '@prisma/client';
import {
  PESOS,
  produtoToIA,
  type Contexto,
  type Contribuicao,
  type Fatores,
  type ProdutoIA,
  type Scored,
} from './types';
import { buildJustificativa, fraseFator } from './justificativa';

// Ordem ordinal de perfis (mais conservador → mais agressivo)
const PERFIL_ORDEM: Record<PerfilInvestidor, number> = {
  CONSERVADOR: 0,
  MODERADO: 1,
  ARROJADO: 2,
  AGRESSIVO: 3,
};

// Alocação alvo (%) por perfil e categoria — referência da indústria, simplificada.
// O motor compara isso com a carteira real do cliente para encontrar gaps.
type AlocacaoAlvo = Partial<Record<CategoriaProduto, number>>;
const ALVO: Record<PerfilInvestidor, AlocacaoAlvo> = {
  CONSERVADOR: { RENDA_FIXA: 60, PREVIDENCIA: 30, FUNDOS: 10 },
  MODERADO: { RENDA_FIXA: 45, PREVIDENCIA: 15, FUNDOS: 25, RENDA_VARIAVEL: 10, ESTRUTURADOS: 5 },
  ARROJADO: { RENDA_FIXA: 25, PREVIDENCIA: 5, FUNDOS: 30, RENDA_VARIAVEL: 25, ESTRUTURADOS: 10, CAMBIO: 5 },
  AGRESSIVO: { RENDA_FIXA: 15, FUNDOS: 30, RENDA_VARIAVEL: 30, ESTRUTURADOS: 15, CAMBIO: 10 },
};

// Conversão grosseira de liquidez → meses
function liquidezEmMeses(liquidez: string): number {
  const l = liquidez.toLowerCase();
  if (l.startsWith('d+')) {
    const dias = Number(l.replace('d+', '')) || 0;
    return Math.max(dias / 30, 0.05); // D+1 ~ 0.03mês
  }
  if (l.includes('vencimento')) return 36; // assume 3 anos médio
  return 1;
}

function clamp(v: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, v));
}

// ============================================================
// Hard constraints — exclui o produto antes mesmo de pontuar
// ============================================================

function passaFiltro(ctx: Contexto, p: ProdutoIA): { ok: boolean; motivo?: string } {
  if (!p.ativo) return { ok: false, motivo: 'inativo' };

  if (PERFIL_ORDEM[p.perfilMinimo] > PERFIL_ORDEM[ctx.cliente.perfil]) {
    return { ok: false, motivo: 'perfil_incompativel' };
  }

  // Se cliente já tem >30% do patrimônio neste produto, sugerir mais é redundante
  const exposicaoAtual = ctx.posicoes
    .filter((pos) => pos.produtoId === p.id)
    .reduce((acc, pos) => acc + pos.valor, 0);
  if (ctx.cliente.patrimonio > 0 && exposicaoAtual / ctx.cliente.patrimonio > 0.3) {
    return { ok: false, motivo: 'ja_sobrealocado' };
  }
  return { ok: true };
}

// ============================================================
// Fatores — cada um retorna 0..1
// ============================================================

function profileMatch(ctx: Contexto, p: ProdutoIA): number {
  const delta = PERFIL_ORDEM[ctx.cliente.perfil] - PERFIL_ORDEM[p.perfilMinimo];
  // delta == 0 → produto exatamente no perfil (alto)
  // delta > 0 → produto mais conservador que o cliente aceita (ainda OK, perde um pouco)
  if (delta === 0) return 1.0;
  if (delta === 1) return 0.85;
  if (delta === 2) return 0.65;
  return 0.45;
}

function diversification(ctx: Contexto, p: ProdutoIA): number {
  const target = ALVO[ctx.cliente.perfil][p.categoria] ?? 0;
  if (target === 0 || ctx.cliente.patrimonio === 0) return 0;

  const totalCategoria = ctx.posicoes
    .filter((pos) => pos.categoria === p.categoria)
    .reduce((acc, pos) => acc + pos.valor, 0);
  const pctAtual = (totalCategoria / ctx.cliente.patrimonio) * 100;

  const gap = target - pctAtual;
  if (gap <= 0) return 0; // já está no alvo ou acima
  // Normaliza pelo target — gap igual ao target = 1.0
  return clamp(gap / target);
}

function yieldRelativo(p: ProdutoIA, catalog: ProdutoIA[]): number {
  const mesmaCategoria = catalog.filter((x) => x.categoria === p.categoria);
  if (mesmaCategoria.length <= 1) return 0.5;
  const rents = mesmaCategoria.map((x) => x.rentabilidadeAno);
  const min = Math.min(...rents);
  const max = Math.max(...rents);
  if (max === min) return 0.5;
  return clamp((p.rentabilidadeAno - min) / (max - min));
}

function liquidityFit(ctx: Contexto, p: ProdutoIA): number {
  const horizonteMeses = ctx.suitability.horizonteAnos * 12;
  const liquidezMeses = liquidezEmMeses(p.liquidez);
  // Quanto mais a liquidez é menor que o horizonte, melhor (cliente pode "trancar")
  if (liquidezMeses <= horizonteMeses) {
    // Bonus pra produtos com liquidez bem menor que o horizonte
    return clamp(1 - liquidezMeses / Math.max(horizonteMeses, 1));
  }
  // Penaliza: liquidez maior que horizonte
  return clamp(horizonteMeses / liquidezMeses);
}

function costScore(p: ProdutoIA): number {
  if (p.taxaAdmin === null) return 1.0;
  // Taxa de 0% = 1.0, taxa de 3% ou mais = 0
  return clamp(1 - p.taxaAdmin / 3);
}

// ============================================================
// Pontuação combinada
// ============================================================

export function scoreProduto(ctx: Contexto, p: ProdutoIA): Scored | null {
  const filtro = passaFiltro(ctx, p);
  if (!filtro.ok) return null;

  const fatores: Fatores = {
    profileMatch: profileMatch(ctx, p),
    diversification: diversification(ctx, p),
    yield: yieldRelativo(p, ctx.catalog),
    liquidity: liquidityFit(ctx, p),
    cost: costScore(p),
  };

  const contribs: Contribuicao[] = (Object.keys(PESOS) as (keyof Fatores)[]).map((k) => ({
    fator: k,
    contrib: fatores[k] * PESOS[k],
    frase: fraseFator(k, fatores[k], ctx, p),
  }));

  const score = contribs.reduce((acc, c) => acc + c.contrib, 0);

  return { produto: p, score, fatores, pesos: PESOS, contribs };
}

export function topRecomendacoes(ctx: Contexto, n = 3): (Scored & { justificativa: string })[] {
  const scored = ctx.catalog
    .map((p) => scoreProduto(ctx, p))
    .filter((s): s is Scored => s !== null);

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, n).map((s) => ({
    ...s,
    justificativa: buildJustificativa(s, ctx),
  }));
}

export { produtoToIA };
