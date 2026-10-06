"""Regras de adequação e fatores de pontuação."""
import math

import pytest
from pydantic import ValidationError

from src import rules
from src.models import Cliente, Produto, RecommendRequest, Suitability
from tests.conftest import produto, request


def ids(scoreds):
    return [s["produto"].id for s in scoreds]


# ============================================================
# Validação dos modelos (contrato com a API)
# ============================================================


class TestModelos:
    def test_patrimonio_negativo_e_rejeitado(self):
        with pytest.raises(ValidationError):
            Cliente(id="c", nome="A", perfil="MODERADO", patrimonio=-1)

    def test_perfil_desconhecido_e_rejeitado(self):
        with pytest.raises(ValidationError):
            Suitability(perfilCalculado="SUPER_AGRESSIVO", horizonteAnos=5, toleranciaPerda=10)

    @pytest.mark.parametrize("risco", [0, 6])
    def test_risco_fora_de_1_a_5_e_rejeitado(self, risco):
        with pytest.raises(ValidationError):
            produto(risco=risco)

    def test_taxa_negativa_e_rejeitada(self):
        with pytest.raises(ValidationError):
            produto(taxaAdmin=-0.5)

    @pytest.mark.parametrize("top_n", [0, 11])
    def test_top_n_fora_de_1_a_10_e_rejeitado(self, top_n):
        with pytest.raises(ValidationError):
            request(top_n=top_n)

    def test_catalogo_acima_do_limite_e_rejeitado(self):
        with pytest.raises(ValidationError):
            request(catalog=[produto(id=f"p{i}") for i in range(2001)])

    def test_tolerancia_nan_e_rejeitada(self):
        # Regressão: a API mandava toleranciaPerda NaN→null quando lia a suitability errado
        with pytest.raises(ValidationError):
            RecommendRequest.model_validate({
                "cliente": {"id": "c", "nome": "A", "perfil": "MODERADO", "patrimonio": 0},
                "suitability": {"perfilCalculado": "MODERADO", "horizonteAnos": 5, "toleranciaPerda": None},
                "posicoes": [], "catalog": [], "topN": 3,
            })


# ============================================================
# Filtros hard (compliance)
# ============================================================


class TestFiltros:
    def test_perfil_incompativel_e_descartado(self, catalogo_basico):
        req = request(perfil="CONSERVADOR", tolerancia=5, catalog=catalogo_basico)
        scoreds, descartados, _ = rules.top_recomendacoes(req, 10)
        assert all(rules.PERFIL_ORDEM[s["produto"].perfilMinimo] == 0 for s in scoreds)
        motivos = {d["motivo"]: d["count"] for d in descartados}
        # fundo (MODERADO), ações (ARROJADO), COE (AGRESSIVO)
        assert motivos["perfil_incompativel"] == 3

    def test_risco_alem_da_tolerancia_e_descartado(self):
        # Agressivo por perfil, mas declarou tolerância baixa: risco 4 (drawdown 35%)
        # > 10% * 1.5 → fora
        cat = [produto(), produto(id="p-acoes", categoria="RENDA_VARIAVEL", risco=4,
                                  perfilMinimo="ARROJADO", emissor="Gestora D")]
        req = request(perfil="AGRESSIVO", tolerancia=10, catalog=cat)
        scoreds, descartados, _ = rules.top_recomendacoes(req, 10)
        assert ids(scoreds) == ["p-cdb"]
        assert descartados == [{"motivo": "risco_alem_tolerancia", "count": 1}]

    def test_tolerancia_minima_do_questionario_libera_so_risco_1(self):
        # "Não aceito perdas" → 5% na API: risco 1 (5%) passa, risco 2 (10%) não
        cat = [produto(), produto(id="p-r2", risco=2, emissor="Banco Z")]
        scoreds, _, _ = rules.top_recomendacoes(request(perfil="CONSERVADOR", tolerancia=5, catalog=cat), 10)
        assert ids(scoreds) == ["p-cdb"]

    def test_concentracao_em_emissor_descarta_todos_os_produtos_dele(self):
        cat = [produto(), produto(id="p-cdb2", nome="CDB 2", emissor="Banco A"),
               produto(id="p-outro", emissor="Banco B")]
        req = request(catalog=cat, posicoes=[{"produtoId": "p-cdb", "categoria": "RENDA_FIXA", "valor": 400_000}])
        scoreds, descartados, _ = rules.top_recomendacoes(req, 10)
        assert ids(scoreds) == ["p-outro"]
        assert descartados == [{
            "motivo": "concentracao_emissor", "count": 2,
            "contexto": {"emissor": "Banco A", "pctPatrimonio": 40},
        }]

    def test_titulo_publico_nao_conta_como_concentracao_de_emissor(self):
        tesouro = produto(id="p-tes", nome="Tesouro IPCA+", emissor="Tesouro Nacional")
        tesouro2 = produto(id="p-tes2", nome="Tesouro Selic", emissor="Tesouro Nacional")
        req = request(catalog=[tesouro, tesouro2],
                      posicoes=[{"produtoId": "p-tes", "categoria": "RENDA_FIXA", "valor": 250_000}])
        scoreds, descartados, _ = rules.top_recomendacoes(req, 10)
        assert "p-tes2" in ids(scoreds)
        assert all(d["motivo"] != "concentracao_emissor" for d in descartados)

    def test_sobrealocacao_no_produto(self):
        # Produto de emissor não resolvível (posição em produto fora do catálogo de
        # emissores) mas a própria posição passa de 30% → ja_sobrealocado
        regras = rules.passa_filtro(
            request().cliente, request().suitability, {}, request(
                posicoes=[{"produtoId": "p-cdb", "categoria": "RENDA_FIXA", "valor": 310_000}]
            ).posicoes, produto(),
        )
        assert regras == (False, "ja_sobrealocado")

    def test_produto_inativo_nao_conta_como_descarte(self):
        cat = [produto(), produto(id="p-off", ativo=False, emissor="Banco X")]
        scoreds, descartados, total = rules.top_recomendacoes(request(catalog=cat), 10)
        assert ids(scoreds) == ["p-cdb"]
        assert descartados == []
        assert total == 2


# ============================================================
# Fatores
# ============================================================


class TestFatores:
    def test_profile_match_decai_com_a_distancia_de_perfil(self):
        s = Suitability(perfilCalculado="AGRESSIVO", horizonteAnos=5, toleranciaPerda=50)
        valores = [rules.profile_match(s, produto(perfilMinimo=p))
                   for p in ["AGRESSIVO", "ARROJADO", "MODERADO", "CONSERVADOR"]]
        assert valores == [1.0, 0.85, 0.65, 0.45]

    def test_diversificacao_maxima_quando_categoria_vazia(self):
        req = request(perfil="MODERADO")
        assert rules.diversification(req.cliente, req.suitability, [], produto()) == 1.0

    def test_diversificacao_zero_quando_categoria_ja_no_alvo(self):
        req = request(perfil="MODERADO", posicoes=[{"produtoId": "x", "categoria": "RENDA_FIXA", "valor": 500_000}])
        # alvo RF moderado = 45%; já tem 50%
        assert rules.diversification(req.cliente, req.suitability, req.posicoes, produto()) == 0.0

    def test_diversificacao_zero_para_categoria_fora_do_alvo_do_perfil(self):
        req = request(perfil="CONSERVADOR")
        p = produto(categoria="CAMBIO")
        assert rules.diversification(req.cliente, req.suitability, [], p) == 0.0

    def test_yield_considera_ir_e_ignora_inativos(self):
        tributado = produto(id="a", rentabilidadeAno=12.0)  # líquido 10.2 (IR 15%)
        isento = produto(id="b", rentabilidadeAno=11.0, tributacao="ISENTO")  # líquido 11.0
        inativo = produto(id="c", rentabilidadeAno=30.0, ativo=False)
        cat = [tributado, isento, inativo]
        assert rules.yield_relativo(isento, cat, 5) == 1.0
        assert rules.yield_relativo(tributado, cat, 5) == 0.0

    def test_yield_neutro_com_produto_unico_na_categoria(self):
        assert rules.yield_relativo(produto(), [produto()], 5) == 0.5

    def test_aliquota_regressiva(self):
        assert rules.aliquota_ir_estimada(0) == 0.225
        assert rules.aliquota_ir_estimada(1) == 0.175
        assert rules.aliquota_ir_estimada(10) == 0.15

    def test_liquidez(self):
        assert rules.liquidez_em_meses("D+30") == 1.0
        assert rules.liquidez_em_meses("D+0") == 0.05
        assert rules.liquidez_em_meses("No vencimento") == 36.0
        assert rules.liquidez_em_meses("formato estranho") == 1.0
        # horizonte de 1 ano: D+1 cabe bem, vencimento (36m) é penalizado
        assert rules.liquidity_fit(1, produto(liquidez="D+1")) > 0.9
        assert rules.liquidity_fit(1, produto(liquidez="Vencimento")) == pytest.approx(12 / 36)
        # horizonte 0: nada "cabe" — fator zera sem dividir por zero
        assert rules.liquidity_fit(0, produto(liquidez="D+1")) == 0.0

    def test_custo_sem_taxa_e_maximo_e_respeita_cap_por_categoria(self):
        assert rules.cost_score(produto(taxaAdmin=None)) == 1.0
        assert rules.cost_score(produto(taxaAdmin=0.0)) == 1.0
        assert rules.cost_score(produto(categoria="RENDA_FIXA", taxaAdmin=1.0)) == 0.0
        assert rules.cost_score(produto(categoria="FUNDOS", taxaAdmin=1.0)) == 0.5


# ============================================================
# Score final e ranking
# ============================================================


class TestScore:
    def test_pesos_somam_1(self):
        assert math.isclose(sum(rules.PESOS.values()), 1.0)

    def test_score_e_soma_ponderada_dos_fatores_e_fica_em_0_1(self, catalogo_basico):
        req = request(perfil="AGRESSIVO", tolerancia=50, catalog=catalogo_basico)
        scoreds, _, _ = rules.top_recomendacoes(req, 10)
        assert scoreds
        for s in scoreds:
            esperado = sum(s["fatores"][k] * rules.PESOS[k] for k in rules.PESOS)
            assert s["score"] == pytest.approx(esperado)
            assert 0.0 <= s["score"] <= 1.0
            assert s["score_rules"] == s["score"]
            assert s["score_source"] == "rule-engine"
            assert set(s["fatores"]) == set(rules.PESOS)

    def test_ranking_decrescente_e_top_n(self, catalogo_basico):
        req = request(perfil="AGRESSIVO", tolerancia=50, catalog=catalogo_basico)
        scoreds, _, _ = rules.top_recomendacoes(req, 2)
        assert len(scoreds) == 2
        assert scoreds[0]["score"] >= scoreds[1]["score"]

    def test_catalogo_vazio(self):
        assert rules.top_recomendacoes(request(catalog=[]), 3) == ([], [], 0)

    def test_patrimonio_zero_nao_divide_por_zero(self, catalogo_basico):
        req = request(patrimonio=0, catalog=catalogo_basico,
                      posicoes=[{"produtoId": "p-cdb", "categoria": "RENDA_FIXA", "valor": 0}])
        scoreds, _, _ = rules.top_recomendacoes(req, 10)
        assert scoreds
        assert all(s["fatores"]["diversification"] == 0.0 for s in scoreds)

    def test_produto_sem_posicao_nao_e_filtrado_por_sobrealocacao(self):
        req = request(posicoes=[])
        assert rules.passa_filtro(req.cliente, req.suitability, {}, [], produto()) == (True, "")


# ============================================================
# Fallback ML
# ============================================================


class ScorerFalso:
    def __init__(self, valor=None, erro=False):
        self.loaded = True
        self.version = "ml-ranker-teste"
        self.valor = valor
        self.erro = erro

    def predict_proba(self, *args):
        if self.erro:
            raise RuntimeError("falhou")
        return self.valor


class TestML:
    def test_score_do_ml_e_usado_e_limitado_a_0_1(self):
        scoreds, _, _ = rules.top_recomendacoes(request(), 3, ml_scorer=ScorerFalso(valor=1.7))
        assert scoreds[0]["score"] == 1.0
        assert scoreds[0]["score_source"] == "ml-ranker-teste"
        # score de regras continua disponível pra explicar
        assert 0 <= scoreds[0]["score_rules"] <= 1

    @pytest.mark.parametrize("scorer", [ScorerFalso(erro=True), ScorerFalso(valor=float("nan"))])
    def test_falha_de_inferencia_cai_para_regras(self, scorer):
        scoreds, _, _ = rules.top_recomendacoes(request(), 3, ml_scorer=scorer)
        assert scoreds[0]["score_source"] == "rule-engine-fallback"
        assert scoreds[0]["score"] == scoreds[0]["score_rules"]

    def test_scorer_descarregado_e_ignorado(self):
        s = ScorerFalso(valor=0.99)
        s.loaded = False
        scoreds, _, _ = rules.top_recomendacoes(request(), 3, ml_scorer=s)
        assert scoreds[0]["score_source"] == "rule-engine"
