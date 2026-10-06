"""Fixtures compartilhadas. Por padrão os testes rodam SEM modelo ML (regras puras)."""
import pytest

from src.ml import scorer as scorer_mod
from src.models import Cliente, Posicao, Produto, RecommendRequest, Suitability


@pytest.fixture(autouse=True)
def sem_modelo_ml(monkeypatch, tmp_path):
    """Aponta o scorer pra um arquivo inexistente → motor em modo regras."""
    monkeypatch.setenv("CRM_ML_MODEL_PATH", str(tmp_path / "nao-existe.pkl"))
    monkeypatch.delenv("AI_ENGINE_TOKEN", raising=False)
    scorer_mod.reset_scorer()
    yield
    scorer_mod.reset_scorer()


def produto(**kw) -> Produto:
    base = dict(
        id="p-cdb",
        nome="CDB Banco A",
        emissor="Banco A",
        categoria="RENDA_FIXA",
        rentabilidadeAno=12.0,
        risco=1,
        tributacao="TRIBUTADO",
        perfilMinimo="CONSERVADOR",
        liquidez="D+1",
        taxaAdmin=None,
        ativo=True,
    )
    base.update(kw)
    return Produto(**base)


def request(
    *,
    perfil="MODERADO",
    patrimonio=1_000_000.0,
    horizonte=5,
    tolerancia=15.0,
    posicoes=None,
    catalog=None,
    top_n=3,
    nome="Mariana Andrade",
) -> RecommendRequest:
    return RecommendRequest(
        cliente=Cliente(id="c1", nome=nome, perfil=perfil, patrimonio=patrimonio),
        suitability=Suitability(
            perfilCalculado=perfil, horizonteAnos=horizonte, toleranciaPerda=tolerancia
        ),
        posicoes=[Posicao(**p) for p in (posicoes or [])],
        catalog=catalog if catalog is not None else [produto()],
        topN=top_n,
    )


@pytest.fixture
def catalogo_basico() -> list[Produto]:
    return [
        produto(),
        produto(id="p-lci", nome="LCI Banco B", emissor="Banco B", tributacao="ISENTO",
                rentabilidadeAno=10.5, liquidez="Vencimento"),
        produto(id="p-fundo", nome="Fundo Multimercado", emissor="Gestora C",
                categoria="FUNDOS", risco=3, perfilMinimo="MODERADO",
                rentabilidadeAno=14.0, liquidez="D+30", taxaAdmin=1.5),
        produto(id="p-acoes", nome="Fundo de Ações", emissor="Gestora D",
                categoria="RENDA_VARIAVEL", risco=4, perfilMinimo="ARROJADO",
                rentabilidadeAno=18.0, liquidez="D+2", taxaAdmin=2.0),
        produto(id="p-coe", nome="COE Alavancado", emissor="Banco A",
                categoria="ESTRUTURADOS", risco=5, perfilMinimo="AGRESSIVO",
                rentabilidadeAno=25.0, liquidez="Vencimento"),
    ]
