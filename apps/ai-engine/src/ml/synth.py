"""
Gerador de dataset sintético pra treino do ranker.

Output: CSV idêntico ao contrato em docs/integration/training-dataset-schema.md.

A "função de aprovação" sintética combina:
  - Filtros hard do motor de regras (perfil_incompativel, risco_alem_tolerancia,
    concentracao_emissor) → label = 0 com alta probabilidade.
  - Score ponderado dos 5 fatores (mesma intuição das regras) +
    "vieses humanos" plausíveis: investidor com alto patrimônio aceita
    melhor produto isento; horizonte longo perdoa baixa liquidez; etc.
  - Ruído gaussiano + Bernoulli pra simular variância de decisão entre
    assessores.

Reproduzível via --seed (default 42).

Uso:
  python -m src.ml.synth --rows 3000 --out data/synth-2026q2.csv
"""
from __future__ import annotations

import argparse
import csv
import math
import random
from dataclasses import dataclass
from pathlib import Path


# ============================================================
# Universo sintético: clientes + catálogo
# ============================================================


PERFIS = ["CONSERVADOR", "MODERADO", "ARROJADO", "AGRESSIVO"]
PERFIS_PESO = [0.30, 0.35, 0.25, 0.10]
PERFIL_ORDEM = {p: i for i, p in enumerate(PERFIS)}
TRIBUTACOES = ["TRIBUTADO", "ISENTO", "INCENTIVADO"]
CATEGORIAS = [
    "RENDA_FIXA",
    "RENDA_VARIAVEL",
    "FUNDOS",
    "PREVIDENCIA",
    "ESTRUTURADOS",
    "CAMBIO",
]

# Alocação alvo % por perfil — espelho do ALVO em rules.py
ALVO_BASE: dict[str, dict[str, float]] = {
    "CONSERVADOR": {"RENDA_FIXA": 0.60, "PREVIDENCIA": 0.30, "FUNDOS": 0.10},
    "MODERADO": {
        "RENDA_FIXA": 0.45, "PREVIDENCIA": 0.15, "FUNDOS": 0.25,
        "RENDA_VARIAVEL": 0.10, "ESTRUTURADOS": 0.05,
    },
    "ARROJADO": {
        "RENDA_FIXA": 0.25, "PREVIDENCIA": 0.05, "FUNDOS": 0.30,
        "RENDA_VARIAVEL": 0.25, "ESTRUTURADOS": 0.10, "CAMBIO": 0.05,
    },
    "AGRESSIVO": {
        "RENDA_FIXA": 0.10, "PREVIDENCIA": 0.05, "FUNDOS": 0.30,
        "RENDA_VARIAVEL": 0.30, "ESTRUTURADOS": 0.15, "CAMBIO": 0.10,
    },
}

RISCO_DRAWDOWN = {1: 5.0, 2: 10.0, 3: 20.0, 4: 35.0, 5: 50.0}


@dataclass
class SynthProduto:
    id: str
    emissor: str
    categoria: str
    risco: int
    rentabilidade_ano: float
    perfil_minimo: str
    taxa_admin: float  # 0 quando não houver
    tributacao: str
    liquidez_meses: float


def build_catalog(rng: random.Random) -> list[SynthProduto]:
    """Catálogo sintético de ~30 produtos cobrindo todos os perfis e
    diversidade de emissores. Não tenta replicar o seed real — é um
    catálogo representativo."""
    catalog: list[SynthProduto] = []

    emissores_rf_banco = ["BTG Pactual", "Itaú Unibanco", "Bradesco",
                          "Santander", "Caixa Econômica"]
    emissores_rf_publico = ["Tesouro Nacional", "Eletrobras", "Petrobras"]
    emissores_asset = ["BTG Pactual Asset", "Vinci Partners", "XP Asset",
                       "Kinea", "Verde Asset"]

    # RENDA_FIXA — 8 produtos (vários bancos, taxas variadas, tributações mistas)
    for i, banco in enumerate(emissores_rf_banco):
        catalog.append(SynthProduto(
            id=f"rf-cdb-{i}", emissor=banco, categoria="RENDA_FIXA",
            risco=1, rentabilidade_ano=12.0 + rng.uniform(-1.5, 2.0),
            perfil_minimo="CONSERVADOR", taxa_admin=0.0,
            tributacao="TRIBUTADO", liquidez_meses=1 / 30 + rng.uniform(0, 0.1),
        ))
    for i, emp in enumerate(emissores_rf_publico):
        catalog.append(SynthProduto(
            id=f"rf-pub-{i}", emissor=emp, categoria="RENDA_FIXA",
            risco=1 if emp == "Tesouro Nacional" else 3,
            rentabilidade_ano=6.5 if emp == "Tesouro Nacional" else 13.0 + rng.uniform(-1, 1.5),
            perfil_minimo="CONSERVADOR" if emp == "Tesouro Nacional" else "MODERADO",
            taxa_admin=0.0,
            tributacao="TRIBUTADO" if emp == "Tesouro Nacional" else "INCENTIVADO",
            liquidez_meses=36.0 if emp != "Tesouro Nacional" else 1 / 30,
        ))
    # LCI/LCA isentas
    for i, banco in enumerate(["Bradesco", "Itaú Unibanco", "Santander"]):
        catalog.append(SynthProduto(
            id=f"rf-isento-{i}", emissor=banco, categoria="RENDA_FIXA",
            risco=1, rentabilidade_ano=11.5 + rng.uniform(-0.5, 1.0),
            perfil_minimo="CONSERVADOR", taxa_admin=0.0,
            tributacao="ISENTO", liquidez_meses=24.0,
        ))

    # FUNDOS — 8 produtos
    for i, asset in enumerate(emissores_asset):
        catalog.append(SynthProduto(
            id=f"fundo-mm-{i}", emissor=asset, categoria="FUNDOS",
            risco=3 + (i % 2),
            rentabilidade_ano=13.0 + rng.uniform(-0.5, 3.5),
            perfil_minimo="MODERADO" if i % 2 == 0 else "ARROJADO",
            taxa_admin=1.0 + rng.uniform(0, 1.5),
            tributacao="TRIBUTADO",
            liquidez_meses=1.0 + rng.uniform(0, 1.0),
        ))
    # Fundos de RF (FIRF)
    for i, asset in enumerate(["BTG Pactual Asset", "Itaú Asset", "Bradesco Asset"]):
        catalog.append(SynthProduto(
            id=f"firf-{i}", emissor=asset, categoria="FUNDOS",
            risco=2, rentabilidade_ano=11.5 + rng.uniform(-0.5, 1.5),
            perfil_minimo="CONSERVADOR", taxa_admin=0.5 + rng.uniform(0, 0.5),
            tributacao="TRIBUTADO", liquidez_meses=1.0,
        ))

    # RENDA_VARIAVEL — 5 produtos
    for nome, emissor, risco, rent, perfil_min in [
        ("BPAC11", "BTG Pactual S.A.", 4, 18.0, "ARROJADO"),
        ("IVVB11", "B3", 4, 17.0, "ARROJADO"),
        ("ITSA4", "Itaúsa", 4, 14.0, "ARROJADO"),
        ("BTLG11", "BTG Pactual", 3, 11.0, "MODERADO"),
        ("KNRI11", "Kinea", 3, 10.5, "MODERADO"),
    ]:
        catalog.append(SynthProduto(
            id=f"rv-{nome.lower()}", emissor=emissor, categoria="RENDA_VARIAVEL",
            risco=risco, rentabilidade_ano=rent + rng.uniform(-2, 2),
            perfil_minimo=perfil_min, taxa_admin=0.0,
            tributacao="ISENTO" if "11" in nome else "TRIBUTADO",
            liquidez_meses=2 / 30,
        ))

    # PREVIDENCIA — 3 produtos
    for i, asset in enumerate(["BTG Pactual Vida e Previdência",
                                "Brasilprev", "Icatu"]):
        catalog.append(SynthProduto(
            id=f"prev-{i}", emissor=asset, categoria="PREVIDENCIA",
            risco=2 + (i % 2), rentabilidade_ano=10.5 + rng.uniform(-0.5, 1.5),
            perfil_minimo="CONSERVADOR" if i == 0 else "MODERADO",
            taxa_admin=0.8 + rng.uniform(0, 0.7),
            tributacao="INCENTIVADO", liquidez_meses=5 / 30,
        ))

    # ESTRUTURADOS — 2 produtos
    for i, emp in enumerate(["BTG Pactual", "Itaú BBA"]):
        catalog.append(SynthProduto(
            id=f"coe-{i}", emissor=emp, categoria="ESTRUTURADOS",
            risco=5, rentabilidade_ano=20.0 + rng.uniform(-3, 5),
            perfil_minimo="ARROJADO", taxa_admin=0.0,
            tributacao="TRIBUTADO", liquidez_meses=36.0,
        ))

    # CAMBIO — 2 produtos
    for i, asset in enumerate(["BTG Pactual Asset", "XP Asset"]):
        catalog.append(SynthProduto(
            id=f"cambio-{i}", emissor=asset, categoria="CAMBIO",
            risco=4, rentabilidade_ano=12.0 + rng.uniform(-3, 4),
            perfil_minimo="ARROJADO", taxa_admin=1.5 + rng.uniform(0, 1.0),
            tributacao="TRIBUTADO", liquidez_meses=1.0,
        ))

    return catalog


# ============================================================
# Geração de clientes + carteiras
# ============================================================


@dataclass
class SynthCliente:
    id: str
    perfil: str
    perfil_calculado: str
    patrimonio: float
    horizonte_anos: int
    tolerancia_perda: float
    # carteira: lista de (produto_id, valor, categoria, emissor)
    carteira: list[tuple[str, float, str, str]]


def gerar_cliente(rng: random.Random, idx: int, catalog: list[SynthProduto]) -> SynthCliente:
    perfil = rng.choices(PERFIS, weights=PERFIS_PESO)[0]
    # Suitability: 90% bate com cadastrado, 10% diverge em ±1 nível
    if rng.random() < 0.10:
        delta = rng.choice([-1, 1])
        idx_calc = max(0, min(len(PERFIS) - 1, PERFIL_ORDEM[perfil] + delta))
        perfil_calc = PERFIS[idx_calc]
    else:
        perfil_calc = perfil

    # Patrimônio log-normal: alvo médio R$1.5M-R$8M
    patrimonio = max(100_000, rng.lognormvariate(14.5, 1.0))

    # Horizonte e tolerância: dependem do perfil
    horizonte_anos = {
        "CONSERVADOR": rng.randint(2, 6),
        "MODERADO": rng.randint(4, 10),
        "ARROJADO": rng.randint(6, 15),
        "AGRESSIVO": rng.randint(8, 20),
    }[perfil]
    tolerancia_perda = {
        "CONSERVADOR": rng.uniform(3, 10),
        "MODERADO": rng.uniform(10, 20),
        "ARROJADO": rng.uniform(20, 40),
        "AGRESSIVO": rng.uniform(35, 65),
    }[perfil]

    # Carteira: 1-7 posições seguindo ALVO_BASE com noise
    n_posicoes = rng.choices([1, 2, 3, 4, 5, 6, 7], weights=[3, 8, 10, 12, 8, 5, 3])[0]
    alvo = ALVO_BASE[perfil]
    # Adicionar noise nas categorias-alvo
    cats_disponiveis = list(alvo.keys())
    cats_escolhidas = rng.sample(cats_disponiveis, k=min(n_posicoes, len(cats_disponiveis)))

    # Distribuir o patrimônio (não necessariamente 100%; pode ter "cash" residual)
    pcts = [rng.uniform(0.5, 1.5) * alvo[c] for c in cats_escolhidas]
    soma = sum(pcts)
    # Usar 70-100% do patrimônio (resto = cash não declarado)
    uso = rng.uniform(0.7, 1.0)
    pcts = [p / soma * uso for p in pcts]

    carteira: list[tuple[str, float, str, str]] = []
    for cat, pct in zip(cats_escolhidas, pcts):
        # Escolher um produto dessa categoria que aceite o perfil
        candidatos = [p for p in catalog
                      if p.categoria == cat
                      and PERFIL_ORDEM[p.perfil_minimo] <= PERFIL_ORDEM[perfil]]
        if not candidatos:
            continue
        prod = rng.choice(candidatos)
        valor = patrimonio * pct
        carteira.append((prod.id, valor, prod.categoria, prod.emissor))

    return SynthCliente(
        id=f"synth-cli-{idx:04d}",
        perfil=perfil,
        perfil_calculado=perfil_calc,
        patrimonio=patrimonio,
        horizonte_anos=horizonte_anos,
        tolerancia_perda=tolerancia_perda,
        carteira=carteira,
    )


# ============================================================
# Função de aprovação sintética (label generator)
# ============================================================


def sigmoid(x: float) -> float:
    if x < -50:
        return 0.0
    if x > 50:
        return 1.0
    return 1 / (1 + math.exp(-x))


def passa_filtros_hard(c: SynthCliente, prod: SynthProduto,
                       exp_emissor: dict[str, float]) -> tuple[bool, str]:
    """Replica filtros hard do motor de regras — pra negative examples."""
    if PERFIL_ORDEM[prod.perfil_minimo] > PERFIL_ORDEM[c.perfil_calculado]:
        return (False, "perfil_incompativel")
    if RISCO_DRAWDOWN[prod.risco] > c.tolerancia_perda * 1.5:
        return (False, "risco_alem_tolerancia")
    if c.patrimonio > 0:
        pct = exp_emissor.get(prod.emissor, 0.0) / c.patrimonio
        if pct > 0.30:
            return (False, "concentracao_emissor")
    return (True, "")


def calcular_label(
    c: SynthCliente,
    prod: SynthProduto,
    exp_emissor: dict[str, float],
    pct_cat: dict[str, float],
    rng: random.Random,
) -> int:
    """
    Gera label 0/1 simulando decisão do assessor.

    - Se filtro hard falha: label=0 com p=0.95 (raramente um assessor
      aceita um descartado — é o erro humano).
    - Se passa: calcula score nuance + bias + ruído → sigmoid → Bernoulli.
    """
    passa, _motivo = passa_filtros_hard(c, prod, exp_emissor)
    if not passa:
        return 0 if rng.random() < 0.95 else 1

    score = 0.0

    # Fator 1: alinhamento de perfil (-1 a 0)
    delta_perfil = PERFIL_ORDEM[c.perfil_calculado] - PERFIL_ORDEM[prod.perfil_minimo]
    score += {0: 0.6, 1: 0.3, 2: -0.1, 3: -0.4}.get(delta_perfil, -0.5)

    # Fator 2: gap de categoria (preenche carteira → +)
    cat_pct = pct_cat.get(prod.categoria, 0.0)
    alvo_pct = ALVO_BASE[c.perfil].get(prod.categoria, 0.0)
    gap = alvo_pct - cat_pct
    if gap > 0.05:
        score += 0.8 * min(gap / max(alvo_pct, 0.05), 1.0)
    else:
        score -= 0.3  # já saturado

    # Fator 3: rentabilidade líquida estimada (escalada)
    aliq = 0.225 if c.horizonte_anos < 1 else 0.20 if c.horizonte_anos < 2 else 0.15
    rent_liquida = prod.rentabilidade_ano if prod.tributacao != "TRIBUTADO" \
        else prod.rentabilidade_ano * (1 - aliq)
    # Normaliza: ~10% a.a. = neutro, >14% = bom
    score += (rent_liquida - 10.0) / 8.0

    # Fator 4: liquidez vs horizonte
    if prod.liquidez_meses <= c.horizonte_anos * 12:
        score += 0.3
    else:
        score -= 0.5

    # Fator 5: custo (taxa_admin alta penaliza)
    if prod.taxa_admin > 0:
        score -= prod.taxa_admin * 0.3

    # Vieses humanos sutis
    if c.patrimonio > 5_000_000 and prod.tributacao in ("ISENTO", "INCENTIVADO"):
        # Cliente alto patrimônio adora isento (alíquota marginal alta)
        score += 0.6
    if c.perfil == "AGRESSIVO" and prod.categoria in ("RENDA_VARIAVEL", "CAMBIO"):
        score += 0.4
    if c.perfil == "CONSERVADOR" and prod.categoria in ("ESTRUTURADOS", "CAMBIO"):
        score -= 0.6
    if c.horizonte_anos >= 10 and prod.liquidez_meses > 12:
        # Horizonte longo perdoa baixa liquidez
        score += 0.2

    # Bias: assessor recusa às vezes mesmo um bom produto (concorrência, timing)
    score -= 0.5  # threshold geral — só ~50% aprovação mesmo nos bons

    # Ruído gaussiano (variância entre assessores)
    score += rng.gauss(0, 0.4)

    p = sigmoid(score)
    return 1 if rng.random() < p else 0


# ============================================================
# Pipeline principal
# ============================================================


def _pct_cat(carteira, patrimonio):
    out = {c: 0.0 for c in CATEGORIAS}
    if patrimonio <= 0:
        return out
    for _id, valor, cat, _emissor in carteira:
        if cat in out:
            out[cat] += valor
    return {c: v / patrimonio for c, v in out.items()}


def _exp_emissor(carteira):
    out: dict[str, float] = {}
    for _id, valor, _cat, emissor in carteira:
        out[emissor] = out.get(emissor, 0.0) + valor
    return out


def _top_emissor(exp_emissor, patrimonio):
    if not exp_emissor or patrimonio <= 0:
        return None, 0.0
    top, val = max(exp_emissor.items(), key=lambda kv: kv[1])
    return top, val / patrimonio


def gerar_dataset(rows: int, seed: int = 42) -> list[dict]:
    rng = random.Random(seed)
    catalog = build_catalog(rng)

    # Quantos clientes? ~rows / produtos por cliente (avg ~15)
    n_clientes = max(50, rows // 15)
    clientes = [gerar_cliente(rng, i, catalog) for i in range(n_clientes)]

    saidas: list[dict] = []
    for c in clientes:
        # Pra cada cliente, sortear 8-25 produtos do catalog pra avaliar
        n_produtos = rng.randint(8, min(25, len(catalog)))
        produtos_sample = rng.sample(catalog, n_produtos)

        pct_cat = _pct_cat(c.carteira, c.patrimonio)
        exp_emissor = _exp_emissor(c.carteira)
        top_emissor_nome, top_pct = _top_emissor(exp_emissor, c.patrimonio)

        for prod in produtos_sample:
            label = calcular_label(c, prod, exp_emissor, pct_cat, rng)
            emissor_alvo_match = 1 if top_emissor_nome == prod.emissor else 0

            saidas.append({
                "cliente_id": c.id,
                "produto_id": prod.id,
                "decisao_em": f"2026-{rng.randint(1, 5):02d}-{rng.randint(1, 28):02d}",
                "cliente_patrimonio": round(c.patrimonio, 2),
                "cliente_perfil": c.perfil,
                "perfil_calculado": c.perfil_calculado,
                "horizonte_anos": c.horizonte_anos,
                "tolerancia_perda": round(c.tolerancia_perda, 1),
                "num_posicoes": len(c.carteira),
                "pct_rf": round(pct_cat["RENDA_FIXA"], 4),
                "pct_rv": round(pct_cat["RENDA_VARIAVEL"], 4),
                "pct_fundos": round(pct_cat["FUNDOS"], 4),
                "pct_previdencia": round(pct_cat["PREVIDENCIA"], 4),
                "pct_estruturados": round(pct_cat["ESTRUTURADOS"], 4),
                "pct_cambio": round(pct_cat["CAMBIO"], 4),
                "top_emissor_pct": round(top_pct, 4),
                "emissor_alvo_match": emissor_alvo_match,
                "produto_categoria": prod.categoria,
                "produto_risco": prod.risco,
                "produto_rentabilidade_ano": round(prod.rentabilidade_ano, 2),
                "produto_perfil_minimo": prod.perfil_minimo,
                "produto_taxa_admin": round(prod.taxa_admin, 2),
                "produto_tributacao": prod.tributacao,
                "produto_liquidez_meses": round(prod.liquidez_meses, 3),
                "aprovado": label,
            })
            if len(saidas) >= rows:
                break
        if len(saidas) >= rows:
            break

    return saidas[:rows]


def escrever_csv(rows: list[dict], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)


def main():
    parser = argparse.ArgumentParser(description="Gera dataset sintético de treino.")
    parser.add_argument("--rows", type=int, default=3000)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--out", type=str, required=True,
                        help="Caminho do CSV de saída (ex: data/synth.csv)")
    args = parser.parse_args()

    rows = gerar_dataset(args.rows, args.seed)
    out_path = Path(args.out)
    escrever_csv(rows, out_path)

    aprovados = sum(1 for r in rows if r["aprovado"] == 1)
    print(f"Gerado {len(rows)} linhas em {out_path}")
    print(f"  Aprovados: {aprovados} ({aprovados / len(rows) * 100:.1f}%)")
    print(f"  Recusados: {len(rows) - aprovados} ({(1 - aprovados / len(rows)) * 100:.1f}%)")


if __name__ == "__main__":
    main()
