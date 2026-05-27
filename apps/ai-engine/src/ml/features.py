"""
Extração de features pro modelo de ML.

Mesmo schema do CSV de treino (docs/integration/training-dataset-schema.md) —
extrai do `RecommendRequest` em tempo de inferência. Garante paridade entre
treino e produção: se o feature engineering aqui muda, o synth/train precisam
acompanhar.
"""
from __future__ import annotations

from ..models import Cliente, Posicao, Produto, Suitability

# Ordenação ordinal dos perfis (espelha rules.PERFIL_ORDEM mas mantida aqui
# pra evitar dependência circular)
PERFIL_ORDEM: dict[str, int] = {
    "CONSERVADOR": 0,
    "MODERADO": 1,
    "ARROJADO": 2,
    "AGRESSIVO": 3,
}

CATEGORIAS = [
    "RENDA_FIXA",
    "RENDA_VARIAVEL",
    "FUNDOS",
    "PREVIDENCIA",
    "ESTRUTURADOS",
    "CAMBIO",
]

# Ordem fixa das colunas — o modelo treinado depende disso.
# Mudar essa lista significa retreinar o modelo.
FEATURE_COLUMNS: list[str] = [
    "cliente_patrimonio",
    "cliente_perfil_ord",
    "perfil_calculado_ord",
    "divergencia_perfil",
    "horizonte_anos",
    "tolerancia_perda",
    "num_posicoes",
    "pct_rf",
    "pct_rv",
    "pct_fundos",
    "pct_previdencia",
    "pct_estruturados",
    "pct_cambio",
    "top_emissor_pct",
    "emissor_alvo_match",
    "produto_categoria_ord",
    "produto_risco",
    "produto_rentabilidade_ano",
    "produto_perfil_minimo_ord",
    "produto_taxa_admin",
    "produto_tributacao_ord",
    "produto_liquidez_meses",
    "perfil_match_delta",
    "categoria_gap_proxy",
]

# Categóricas pro LightGBM (índices que ele trata como categorical)
CATEGORICAL_INDICES: list[int] = [
    FEATURE_COLUMNS.index("produto_categoria_ord"),
    FEATURE_COLUMNS.index("produto_tributacao_ord"),
]

TRIBUTACAO_ORDEM: dict[str, int] = {
    "TRIBUTADO": 0,
    "ISENTO": 1,
    "INCENTIVADO": 2,
}


def _liquidez_meses(s: str) -> float:
    s = s.lower()
    if s.startswith("d+"):
        try:
            dias = int(s.replace("d+", ""))
        except ValueError:
            dias = 0
        return max(dias / 30, 0.05)
    if "vencimento" in s:
        return 36.0
    return 1.0


def _pct_por_categoria(
    posicoes: list[Posicao], patrimonio: float
) -> dict[str, float]:
    """% do patrimônio em cada categoria. Soma <= 1 (resto = cash não declarado)."""
    if patrimonio <= 0:
        return {c: 0.0 for c in CATEGORIAS}
    totals: dict[str, float] = {c: 0.0 for c in CATEGORIAS}
    for pos in posicoes:
        if pos.categoria in totals:
            totals[pos.categoria] += pos.valor
    return {c: totals[c] / patrimonio for c in CATEGORIAS}


def _top_emissor(
    posicoes: list[Posicao], catalog: list[Produto], patrimonio: float
) -> tuple[str | None, float]:
    """Emissor de maior concentração e seu %."""
    if patrimonio <= 0 or not posicoes:
        return (None, 0.0)
    emissor_de = {p.id: p.emissor for p in catalog}
    exp: dict[str, float] = {}
    for pos in posicoes:
        e = emissor_de.get(pos.produtoId)
        if e:
            exp[e] = exp.get(e, 0.0) + pos.valor
    if not exp:
        return (None, 0.0)
    top, val = max(exp.items(), key=lambda kv: kv[1])
    return (top, val / patrimonio)


def extract_features_row(
    cliente: Cliente,
    suitability: Suitability,
    posicoes: list[Posicao],
    catalog: list[Produto],
    produto: Produto,
) -> list[float]:
    """Constrói o vetor de features pra um par (cliente × produto)."""
    pct_cat = _pct_por_categoria(posicoes, cliente.patrimonio)
    top_emissor, top_pct = _top_emissor(posicoes, catalog, cliente.patrimonio)
    emissor_alvo_match = 1 if top_emissor == produto.emissor else 0

    cliente_perfil_ord = PERFIL_ORDEM[cliente.perfil]
    perfil_calc_ord = PERFIL_ORDEM[suitability.perfilCalculado]
    produto_perfil_min_ord = PERFIL_ORDEM[produto.perfilMinimo]
    categoria_ord = CATEGORIAS.index(produto.categoria)

    # categoria_gap_proxy: 1 se cliente tem 0% nessa categoria, decai linear
    categoria_pct_atual = pct_cat.get(produto.categoria, 0.0)
    categoria_gap_proxy = max(0.0, 1.0 - categoria_pct_atual * 2)

    return [
        cliente.patrimonio,
        cliente_perfil_ord,
        perfil_calc_ord,
        1 if cliente_perfil_ord != perfil_calc_ord else 0,
        suitability.horizonteAnos,
        suitability.toleranciaPerda,
        len(posicoes),
        pct_cat["RENDA_FIXA"],
        pct_cat["RENDA_VARIAVEL"],
        pct_cat["FUNDOS"],
        pct_cat["PREVIDENCIA"],
        pct_cat["ESTRUTURADOS"],
        pct_cat["CAMBIO"],
        top_pct,
        emissor_alvo_match,
        categoria_ord,
        produto.risco,
        produto.rentabilidadeAno,
        produto_perfil_min_ord,
        produto.taxaAdmin if produto.taxaAdmin is not None else 0.0,
        TRIBUTACAO_ORDEM[produto.tributacao],
        _liquidez_meses(produto.liquidez),
        cliente_perfil_ord - produto_perfil_min_ord,
        categoria_gap_proxy,
    ]


def extract_features_dict(
    cliente: Cliente,
    suitability: Suitability,
    posicoes: list[Posicao],
    catalog: list[Produto],
    produto: Produto,
) -> dict[str, float]:
    """Mesma extração, retorna dict — útil pra debugging."""
    vals = extract_features_row(cliente, suitability, posicoes, catalog, produto)
    return dict(zip(FEATURE_COLUMNS, vals))
