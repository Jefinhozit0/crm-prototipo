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
        "RENDA_FIXA": 15,
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


def clamp(v: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, v))


# ============================================================
# Hard constraints — descarta produto antes de pontuar
# ============================================================


def passa_filtro(
    cliente: Cliente, posicoes: list[Posicao], p: Produto
) -> tuple[bool, str]:
    if not p.ativo:
        return (False, "inativo")

    if PERFIL_ORDEM[p.perfilMinimo] > PERFIL_ORDEM[cliente.perfil]:
        return (False, "perfil_incompativel")

    # Sobrealocação: cliente já tem >30% do patrimônio nesse produto
    exposicao = sum(pos.valor for pos in posicoes if pos.produtoId == p.id)
    if cliente.patrimonio > 0 and (exposicao / cliente.patrimonio) > 0.30:
        return (False, "ja_sobrealocado")

    return (True, "")


# ============================================================
# Fatores — cada um retorna 0..1
# ============================================================


def profile_match(cliente: Cliente, p: Produto) -> float:
    delta = PERFIL_ORDEM[cliente.perfil] - PERFIL_ORDEM[p.perfilMinimo]
    if delta == 0:
        return 1.0
    if delta == 1:
        return 0.85
    if delta == 2:
        return 0.65
    return 0.45


def diversification(
    cliente: Cliente, posicoes: list[Posicao], p: Produto
) -> float:
    target = ALVO.get(cliente.perfil, {}).get(p.categoria, 0.0)
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


def yield_relativo(p: Produto, catalog: list[Produto]) -> float:
    mesma = [x for x in catalog if x.categoria == p.categoria]
    if len(mesma) <= 1:
        return 0.5
    rents = [x.rentabilidadeAno for x in mesma]
    lo, hi = min(rents), max(rents)
    if hi == lo:
        return 0.5
    return clamp((p.rentabilidadeAno - lo) / (hi - lo))


def liquidity_fit(horizonte_anos: int, p: Produto) -> float:
    horizonte_meses = horizonte_anos * 12
    liq_meses = liquidez_em_meses(p.liquidez)

    if liq_meses <= horizonte_meses:
        return clamp(1 - liq_meses / max(horizonte_meses, 1))
    return clamp(horizonte_meses / liq_meses)


def cost_score(p: Produto) -> float:
    if p.taxaAdmin is None:
        return 1.0
    return clamp(1 - p.taxaAdmin / 3)


# ============================================================
# Pontuação combinada
# ============================================================


def score_produto(
    req: RecommendRequest, p: Produto
) -> dict | None:
    """Pontua um produto. Retorna None se foi filtrado."""
    ok, _motivo = passa_filtro(req.cliente, req.posicoes, p)
    if not ok:
        return None

    fatores: dict[str, float] = {
        "profileMatch": profile_match(req.cliente, p),
        "diversification": diversification(req.cliente, req.posicoes, p),
        "yield": yield_relativo(p, req.catalog),
        "liquidity": liquidity_fit(req.suitability.horizonteAnos, p),
        "cost": cost_score(p),
    }

    contribs = [
        {
            "fator": k,
            "contrib": fatores[k] * PESOS[k],
            "frase": "",  # preenchido depois pelo módulo de justificativa
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


def top_recomendacoes(req: RecommendRequest, n: int = 3) -> list[dict]:
    """Retorna os top-N produtos com maior score (sem justificativa ainda)."""
    scored = [score_produto(req, p) for p in req.catalog]
    scored = [s for s in scored if s is not None]
    scored.sort(key=lambda s: s["score"], reverse=True)
    return scored[:n]
