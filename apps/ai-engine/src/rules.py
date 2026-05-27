"""
Motor de regras — porte 1:1 da versão TypeScript em apps/api/src/recomendacoes/ia/.

Os fatores, pesos e lógica são idênticos. Qualquer divergência aqui exige
acertar com o TS pra manter consistência durante a migração.
"""
from .models import (
    CategoriaProduto,
    Cliente,
    PerfilInvestidor,
    Posicao,
    Produto,
    RecommendRequest,
    Suitability,
)

# Ordem ordinal dos perfis (mais conservador → mais agressivo)
PERFIL_ORDEM: dict[str, int] = {
    "CONSERVADOR": 0,
    "MODERADO": 1,
    "ARROJADO": 2,
    "AGRESSIVO": 3,
}

# Pesos dos 5 fatores (soma = 1.0)
PESOS: dict[str, float] = {
    "profileMatch": 0.20,
    "diversification": 0.30,
    "yield": 0.20,
    "liquidity": 0.15,
    "cost": 0.15,
}

# Drawdown máximo esperado (% sobre o investido) por nível de risco do produto.
# Calibração grosseira pra checar contra toleranciaPerda declarada na suitability.
RISCO_DRAWDOWN_ESPERADO: dict[int, float] = {
    1: 5.0,
    2: 10.0,
    3: 20.0,
    4: 35.0,
    5: 50.0,
}


def aliquota_ir_estimada(horizonte_anos: int) -> float:
    """Tabela regressiva de IR sobre renda fixa/fundos tributados.
    < 6 meses: 22.5% | 6-12m: 20% | 12-24m: 17.5% | > 24m: 15%
    Usa horizonte_anos como proxy do prazo médio."""
    if horizonte_anos < 0.5:
        return 0.225
    if horizonte_anos < 1:
        return 0.20
    if horizonte_anos < 2:
        return 0.175
    return 0.15


def yield_liquido(p: Produto, horizonte_anos: int) -> float:
    """Yield estimado líquido de IR pra horizonte declarado.
    ISENTO e INCENTIVADO: yield bruto = líquido.
    TRIBUTADO: aplica alíquota da tabela regressiva."""
    if p.tributacao in ("ISENTO", "INCENTIVADO"):
        return p.rentabilidadeAno
    aliq = aliquota_ir_estimada(horizonte_anos)
    return p.rentabilidadeAno * (1 - aliq)

# Cap de taxa de admin (%) por categoria. Acima do cap, score=0.
COST_CAP_BY_CATEGORY: dict[str, float] = {
    "RENDA_FIXA": 1.0,
    "RENDA_VARIAVEL": 2.5,
    "FUNDOS": 2.0,
    "PREVIDENCIA": 2.0,
    "ESTRUTURADOS": 2.5,
    "CAMBIO": 2.0,
}

# Alocação alvo (%) por perfil e categoria — referência da indústria
ALVO: dict[str, dict[str, float]] = {
    "CONSERVADOR": {"RENDA_FIXA": 60, "PREVIDENCIA": 30, "FUNDOS": 10},
    "MODERADO": {
        "RENDA_FIXA": 45,
        "PREVIDENCIA": 15,
        "FUNDOS": 25,
        "RENDA_VARIAVEL": 10,
        "ESTRUTURADOS": 5,
    },
    "ARROJADO": {
        "RENDA_FIXA": 25,
        "PREVIDENCIA": 5,
        "FUNDOS": 30,
        "RENDA_VARIAVEL": 25,
        "ESTRUTURADOS": 10,
        "CAMBIO": 5,
    },
    "AGRESSIVO": {
        "RENDA_FIXA": 10,
        "PREVIDENCIA": 5,
        "FUNDOS": 30,
        "RENDA_VARIAVEL": 30,
        "ESTRUTURADOS": 15,
        "CAMBIO": 10,
    },
}


def liquidez_em_meses(liquidez: str) -> float:
    """Conversão grosseira de liquidez → meses (D+30 = 1, Vencimento ≈ 36)"""
    s = liquidez.lower()
    if s.startswith("d+"):
        try:
            dias = int(s.replace("d+", ""))
        except ValueError:
            dias = 0
        return max(dias / 30, 0.05)
    if "vencimento" in s:
        return 36.0
    return 1.0


LIMITE_CONCENTRACAO_EMISSOR = 0.30  # 30% do patrimônio em um emissor já é demais

PRIORIDADE_MOTIVOS: list[str] = [
    "perfil_incompativel",
    "concentracao_emissor",
    "risco_alem_tolerancia",
    "ja_sobrealocado",
]


def exposicao_por_emissor(
    posicoes: list[Posicao], catalog: list[Produto]
) -> dict[str, float]:
    """Soma quanto o cliente já tem em cada emissor.
    Precisa do catalog pra resolver produtoId -> emissor."""
    emissor_de: dict[str, str] = {p.id: p.emissor for p in catalog}
    out: dict[str, float] = {}
    for pos in posicoes:
        e = emissor_de.get(pos.produtoId)
        if e:
            out[e] = out.get(e, 0.0) + pos.valor
    return out


def clamp(v: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, v))


# ============================================================
# Hard constraints — descarta produto antes de pontuar
# ============================================================


def passa_filtro(
    cliente: Cliente,
    suitability: Suitability,
    exposicao_emissor: dict[str, float],
    posicoes: list[Posicao],
    p: Produto,
) -> tuple[bool, str]:
    if not p.ativo:
        return (False, "inativo")

    if PERFIL_ORDEM[p.perfilMinimo] > PERFIL_ORDEM[suitability.perfilCalculado]:
        return (False, "perfil_incompativel")

    drawdown_esperado = RISCO_DRAWDOWN_ESPERADO.get(p.risco, 50.0)
    if drawdown_esperado > suitability.toleranciaPerda * 1.5:
        return (False, "risco_alem_tolerancia")

    if cliente.patrimonio > 0:
        exp_emissor = exposicao_emissor.get(p.emissor, 0.0)
        if exp_emissor / cliente.patrimonio > LIMITE_CONCENTRACAO_EMISSOR:
            return (False, "concentracao_emissor")

    # Sobrealocação: cliente já tem >30% do patrimônio nesse produto
    exposicao = sum(pos.valor for pos in posicoes if pos.produtoId == p.id)
    if cliente.patrimonio > 0 and (exposicao / cliente.patrimonio) > 0.30:
        return (False, "ja_sobrealocado")

    return (True, "")


# ============================================================
# Fatores — cada um retorna 0..1
# ============================================================


def profile_match(suitability: Suitability, p: Produto) -> float:
    delta = PERFIL_ORDEM[suitability.perfilCalculado] - PERFIL_ORDEM[p.perfilMinimo]
    if delta == 0:
        return 1.0
    if delta == 1:
        return 0.85
    if delta == 2:
        return 0.65
    return 0.45


def diversification(
    cliente: Cliente,
    suitability: Suitability,
    posicoes: list[Posicao],
    p: Produto,
) -> float:
    target = ALVO.get(suitability.perfilCalculado, {}).get(p.categoria, 0.0)
    if target == 0 or cliente.patrimonio == 0:
        return 0.0

    total_categoria = sum(
        pos.valor for pos in posicoes if pos.categoria == p.categoria
    )
    pct_atual = (total_categoria / cliente.patrimonio) * 100

    gap = target - pct_atual
    if gap <= 0:
        return 0.0
    return clamp(gap / target)


def yield_relativo(p: Produto, catalog: list[Produto], horizonte_anos: int) -> float:
    mesma = [x for x in catalog if x.categoria == p.categoria]
    if len(mesma) <= 1:
        return 0.5
    liquidos = [yield_liquido(x, horizonte_anos) for x in mesma]
    lo, hi = min(liquidos), max(liquidos)
    if hi == lo:
        return 0.5
    return clamp((yield_liquido(p, horizonte_anos) - lo) / (hi - lo))


def liquidity_fit(horizonte_anos: int, p: Produto) -> float:
    horizonte_meses = horizonte_anos * 12
    liq_meses = liquidez_em_meses(p.liquidez)

    if liq_meses <= horizonte_meses:
        return clamp(1 - liq_meses / max(horizonte_meses, 1))
    return clamp(horizonte_meses / liq_meses)


def cost_score(p: Produto) -> float:
    if p.taxaAdmin is None:
        return 1.0
    cap = COST_CAP_BY_CATEGORY.get(p.categoria, 3.0)
    return clamp(1 - p.taxaAdmin / cap)


# ============================================================
# Pontuação combinada
# ============================================================


def _pontuar(
    req: RecommendRequest, p: Produto, exposicao_emissor: dict[str, float]
) -> dict:
    """Pontua um produto que JÁ PASSOU pelo passa_filtro.
    Não chama passa_filtro novamente — caller é responsável por filtrar."""
    fatores: dict[str, float] = {
        "profileMatch": profile_match(req.suitability, p),
        "diversification": diversification(
            req.cliente, req.suitability, req.posicoes, p
        ),
        "yield": yield_relativo(p, req.catalog, req.suitability.horizonteAnos),
        "liquidity": liquidity_fit(req.suitability.horizonteAnos, p),
        "cost": cost_score(p),
    }

    contribs = [
        {
            "fator": k,
            "contrib": fatores[k] * PESOS[k],
            "frase": "",
        }
        for k in PESOS
    ]

    score = sum(c["contrib"] for c in contribs)

    return {
        "produto": p,
        "score": score,
        "fatores": fatores,
        "pesos": PESOS,
        "contribs": contribs,
    }


def top_recomendacoes(
    req: RecommendRequest, n: int = 3, ml_scorer=None
) -> tuple[list[dict], list[dict], int]:
    """Retorna (top-N produtos pontuados, descartados agregados, total analisados).

    Filtros hard (passa_filtro) sempre rodam — compliance é determinístico.
    Pontuação (`score`):
      - Se `ml_scorer` for fornecido e estiver carregado, score = P(aprovação)
        do modelo. Os fatores rule-based continuam preenchidos pra justificativa
        (`score_rules` preservado).
      - Senão, score = soma ponderada dos fatores (rule engine).
    """
    exposicao_emissor = exposicao_por_emissor(req.posicoes, req.catalog)
    scored: list[dict] = []
    motivos_count: dict[str, int] = {}
    motivos_contexto: dict[str, dict] = {}

    use_ml = ml_scorer is not None and getattr(ml_scorer, "loaded", False)

    for p in req.catalog:
        ok, motivo = passa_filtro(
            req.cliente, req.suitability, exposicao_emissor, req.posicoes, p
        )
        if not ok:
            if motivo == "inativo":
                continue
            motivos_count[motivo] = motivos_count.get(motivo, 0) + 1
            if motivo == "concentracao_emissor" and motivo not in motivos_contexto:
                exp = exposicao_emissor.get(p.emissor, 0.0)
                pct = (
                    round(100 * exp / req.cliente.patrimonio)
                    if req.cliente.patrimonio > 0
                    else 0
                )
                motivos_contexto[motivo] = {
                    "emissor": p.emissor,
                    "pctPatrimonio": pct,
                }
            continue

        item = _pontuar(req, p, exposicao_emissor)
        item["score_rules"] = item["score"]

        if use_ml:
            try:
                proba = ml_scorer.predict_proba(
                    req.cliente, req.suitability, req.posicoes, req.catalog, p
                )
                item["score"] = float(proba)
                item["score_source"] = ml_scorer.version
            except Exception:
                # Falha de inferência no produto não derruba a rodada — usa fallback
                item["score_source"] = "rule-engine-fallback"
        else:
            item["score_source"] = "rule-engine"

        scored.append(item)

    scored.sort(key=lambda s: s["score"], reverse=True)

    descartados = [
        {
            "motivo": m,
            "count": motivos_count[m],
            **({"contexto": motivos_contexto[m]} if m in motivos_contexto else {}),
        }
        for m in PRIORIDADE_MOTIVOS
        if m in motivos_count
    ]

    return scored[:n], descartados, len(req.catalog)
