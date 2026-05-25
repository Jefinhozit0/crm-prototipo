import type { CategoriaProduto } from '@prisma/client';
import type { Contexto, Fatores, ProdutoIA, Scored } from './types';

const CATEGORIA_LABEL: Record<CategoriaProduto, string> = {
  RENDA_FIXA: 'renda fixa',
  RENDA_VARIAVEL: 'renda variável',
  FUNDOS: 'fundos de investimento',
  PREVIDENCIA: 'previdência privada',
  ESTRUTURADOS: 'produtos estruturados',
  CAMBIO: 'câmbio',
};

const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

/** "R$ 14,5 milhões" / "R$ 800 mil" / "R$ 350" — escala humana */
function humanizarPatrimonio(valor: number): string {
  if (valor >= 1_000_000_000) {
    const b = valor / 1_000_000_000;
    return `R$ ${b >= 10 ? Math.round(b) : b.toFixed(1).replace('.', ',')} bilhões`;
  }
  if (valor >= 1_000_000) {
    const m = valor / 1_000_000;
    return `R$ ${m >= 10 ? Math.round(m) : m.toFixed(1).replace('.', ',')} milhões`;
  }
  if (valor >= 100_000) {
    return `R$ ${Math.round(valor / 1_000)} mil`;
  }
  return brl.format(valor);
}

function pctCategoria(ctx: Contexto, categoria: CategoriaProduto): number {
  if (ctx.cliente.patrimonio === 0) return 0;
  const total = ctx.posicoes
    .filter((p) => p.categoria === categoria)
    .reduce((acc, p) => acc + p.valor, 0);
  return Math.round((total / ctx.cliente.patrimonio) * 100);
}

// ============================================================
// Frases técnicas (uma por fator) — usadas no "Como cheguei nisso"
// ============================================================

export function fraseFator(
  fator: keyof Fatores,
  valor: number,
  ctx: Contexto,
  p: ProdutoIA,
): string {
  switch (fator) {
    case 'profileMatch': {
      if (valor === 1)
        return `Produto enquadrado exatamente no perfil ${ctx.cliente.perfil.toLowerCase()}.`;
      return `Produto adequado ao perfil ${ctx.cliente.perfil.toLowerCase()} (perfil mínimo: ${p.perfilMinimo.toLowerCase()}).`;
    }
    case 'diversification': {
      const pct = pctCategoria(ctx, p.categoria);
      if (valor > 0.6) {
        return `Categoria ${CATEGORIA_LABEL[p.categoria]} subponderada — exposição atual de apenas ${pct}% versus alvo do perfil.`;
      }
      if (valor > 0.3) {
        return `Há espaço para reforçar exposição em ${CATEGORIA_LABEL[p.categoria]} (${pct}% atual).`;
      }
      return `Categoria ${CATEGORIA_LABEL[p.categoria]} já próxima do alvo (${pct}%).`;
    }
    case 'yield': {
      if (valor > 0.7)
        return `Rentabilidade de ${p.rentabilidadeAno.toFixed(1)}% a.a. está entre as melhores da categoria.`;
      if (valor > 0.4)
        return `Rentabilidade de ${p.rentabilidadeAno.toFixed(1)}% a.a. é competitiva.`;
      return `Rentabilidade de ${p.rentabilidadeAno.toFixed(1)}% a.a. abaixo da média da categoria.`;
    }
    case 'liquidity': {
      const h = ctx.suitability.horizonteAnos;
      if (valor > 0.7)
        return `Liquidez ${p.liquidez} alinhada ao horizonte de ${h} anos declarado pelo cliente.`;
      if (valor < 0.4)
        return `Liquidez ${p.liquidez} mais longa que o horizonte de ${h} anos — avaliar.`;
      return `Liquidez ${p.liquidez} aceitável para o horizonte do cliente.`;
    }
    case 'cost': {
      if (p.taxaAdmin === null) return 'Sem taxa de administração.';
      if (valor > 0.7)
        return `Taxa de administração baixa (${p.taxaAdmin.toFixed(1)}% a.a.).`;
      return `Taxa de administração de ${p.taxaAdmin.toFixed(1)}% a.a. — verificar custo-benefício.`;
    }
  }
}

// ============================================================
// Justificativa em narrativa (1ª pessoa) — usada como copy principal
// ============================================================

/** Frase de abertura — varia conforme o fator com maior peso */
function abertura(
  dom: keyof Fatores,
  p: ProdutoIA,
  ctx: Contexto,
): string {
  const primeiro = ctx.cliente.nome.split(' ')[0];
  const perfil = ctx.cliente.perfil.toLowerCase();

  switch (dom) {
    case 'diversification': {
      const pct = pctCategoria(ctx, p.categoria);
      const cat = CATEGORIA_LABEL[p.categoria];
      if (pct === 0) {
        return `Olhei a carteira de ${primeiro} e a primeira coisa que me chamou atenção é a ausência total de exposição em ${cat}.`;
      }
      return `Analisando a carteira de ${primeiro}, vi que ${cat} representa apenas ${pct}% — bem abaixo do alvo pra perfil ${perfil}.`;
    }
    case 'profileMatch':
      return `O ${p.nome} tem o desenho certo pra ${primeiro}: foi pensado pra perfil ${p.perfilMinimo.toLowerCase()}, que conversa direto com o perfil ${perfil} do cliente.`;
    case 'yield': {
      const cat = CATEGORIA_LABEL[p.categoria];
      return `Dentro de ${cat}, o ${p.nome} entrega ${p.rentabilidadeAno.toFixed(1)}% a.a. — está entre os melhores que o BTG distribui na categoria.`;
    }
    case 'liquidity':
      return `Considerando o horizonte de ${ctx.suitability.horizonteAnos} anos declarado por ${primeiro}, a liquidez ${p.liquidez} do ${p.nome} cai bem.`;
    case 'cost': {
      const custo =
        p.taxaAdmin === null
          ? 'não tem taxa de administração'
          : `tem taxa de admin de apenas ${p.taxaAdmin.toFixed(1)}% a.a.`;
      return `Um ponto forte do ${p.nome} pra ${primeiro} é o custo: ${custo}, o que preserva o yield líquido.`;
    }
  }
}

/** Frase opcional de contexto sobre o cliente (patrimônio, perfil) */
function contexto(dom: keyof Fatores, ctx: Contexto): string {
  const perfil = ctx.cliente.perfil.toLowerCase();
  const patrimonio = humanizarPatrimonio(ctx.cliente.patrimonio);

  switch (dom) {
    case 'diversification':
      return `Para um perfil ${perfil} com ${patrimonio} de patrimônio, isso é uma lacuna estratégica.`;
    case 'yield':
      return `Vale considerar pra ${ctx.cliente.nome.split(' ')[0]}, que tem ${patrimonio} em jogo.`;
    case 'profileMatch':
    case 'liquidity':
    case 'cost':
      return '';
  }
}

/** Endorsement curto de um fator quando ele aparece como secundário na proposta */
function endorsement(
  fator: keyof Fatores,
  valor: number,
  p: ProdutoIA,
  ctx: Contexto,
): string {
  switch (fator) {
    case 'profileMatch':
      if (valor >= 1) return 'está enquadrado exatamente no perfil do cliente';
      if (valor >= 0.7) return 'é compatível com o perfil declarado';
      return 'é aceito pra esse perfil';
    case 'diversification':
      if (valor >= 0.6) return 'preenche um gap importante da carteira';
      if (valor >= 0.3) return 'reforça uma categoria ainda subponderada';
      return null as never; // contribuição irrelevante — não citar
    case 'yield':
      if (valor >= 0.7)
        return `a rentabilidade de ${p.rentabilidadeAno.toFixed(1)}% a.a. está no topo da categoria`;
      if (valor >= 0.4)
        return `${p.rentabilidadeAno.toFixed(1)}% a.a. é um retorno competitivo`;
      return null as never;
    case 'liquidity':
      if (valor >= 0.7)
        return `a liquidez ${p.liquidez} cabe folgadamente no horizonte de ${ctx.suitability.horizonteAnos} anos`;
      if (valor >= 0.4) return `a liquidez ${p.liquidez} é aceitável pra esse horizonte`;
      return null as never;
    case 'cost':
      if (p.taxaAdmin === null)
        return 'não tem taxa de administração penalizando o yield';
      if (valor >= 0.7)
        return `a taxa de admin de ${p.taxaAdmin.toFixed(1)}% a.a. é baixa pra categoria`;
      return null as never;
  }
}

/** Junta endorsements em pt-BR natural ("X, Y e Z") */
function juntarPtBr(itens: string[]): string {
  if (itens.length === 0) return '';
  if (itens.length === 1) return itens[0];
  if (itens.length === 2) return `${itens[0]} e ${itens[1]}`;
  return `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`;
}

/** Proposta — apresenta o produto como solução, somando os pontos secundários */
function proposta(
  dom: keyof Fatores,
  p: ProdutoIA,
  secundarios: { fator: keyof Fatores }[],
  fatores: Fatores,
  ctx: Contexto,
): string {
  const endorsements = secundarios
    .map((s) => endorsement(s.fator, fatores[s.fator], p, ctx))
    .filter((e): e is string => typeof e === 'string' && e.length > 0);

  if (endorsements.length === 0) {
    // Caso raro: nenhum fator secundário valeu citação
    if (dom === 'diversification' || dom === 'profileMatch') return '';
    return '';
  }

  const lista = juntarPtBr(endorsements);

  if (dom === 'diversification') {
    return `O ${p.nome} resolveria isso: ${lista}.`;
  }
  if (dom === 'profileMatch') {
    return `Reforçando a escolha: ${lista}.`;
  }
  // Quando o dominante já é o "ponto forte do produto" (yield/liquidity/cost),
  // a proposta fica como "soma-se a isso..."
  return `Soma-se a isso que ${lista}.`;
}

/**
 * Monta a justificativa final em 3 partes:
 *   [Abertura focada no fator dominante]  [Contexto sobre o cliente]  [Proposta com 2 endorsements]
 */
export function buildJustificativa(s: Scored, ctx: Contexto): string {
  const sortedContribs = [...s.contribs].sort((a, b) => b.contrib - a.contrib);
  const dom = sortedContribs[0].fator;
  const secundarios = sortedContribs.slice(1, 3);

  const partes = [
    abertura(dom, s.produto, ctx),
    contexto(dom, ctx),
    proposta(dom, s.produto, secundarios, s.fatores, ctx),
  ].filter((p) => p && p.length > 0);

  return partes.join(' ');
}
