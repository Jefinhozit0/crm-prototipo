"""
Modelos de domínio do motor de IA.
Espelham os tipos do NestJS — qualquer mudança aqui exige bater os tipos do TS.
"""
from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


# ============================================================
# Enums
# ============================================================

PerfilInvestidor = Literal["CONSERVADOR", "MODERADO", "ARROJADO", "AGRESSIVO"]

CategoriaProduto = Literal[
    "RENDA_FIXA",
    "RENDA_VARIAVEL",
    "FUNDOS",
    "PREVIDENCIA",
    "ESTRUTURADOS",
    "CAMBIO",
]

Fator = Literal["profileMatch", "diversification", "yield", "liquidity", "cost"]


# ============================================================
# Input — contexto enviado pelo NestJS
# ============================================================


class Cliente(BaseModel):
    id: str
    nome: str
    perfil: PerfilInvestidor
    patrimonio: float = Field(ge=0)


class Suitability(BaseModel):
    perfilCalculado: PerfilInvestidor
    horizonteAnos: int = Field(ge=0, le=100)
    toleranciaPerda: float = Field(ge=0, le=100)


class Posicao(BaseModel):
    produtoId: str
    categoria: CategoriaProduto
    valor: float = Field(ge=0)


class Produto(BaseModel):
    id: str
    nome: str
    emissor: str
    categoria: CategoriaProduto
    rentabilidadeAno: float
    risco: int = Field(ge=1, le=5)
    perfilMinimo: PerfilInvestidor
    liquidez: str
    taxaAdmin: float | None = None
    ativo: bool = True


class RecommendRequest(BaseModel):
    cliente: Cliente
    suitability: Suitability
    posicoes: list[Posicao]
    catalog: list[Produto]
    topN: int = Field(default=3, ge=1, le=10)


# ============================================================
# Output — resposta pro NestJS
# ============================================================


class Contribuicao(BaseModel):
    fator: Fator
    contrib: float
    frase: str


class Fatores(BaseModel):
    profileMatch: float
    diversification: float
    yield_: float = Field(alias="yield")
    liquidity: float
    cost: float

    model_config = {"populate_by_name": True}


class RecomendacaoOut(BaseModel):
    produtoId: str
    produtoNome: str
    score: float
    justificativa: str
    fatores: dict[str, float]
    pesos: dict[str, float]
    contribs: list[Contribuicao]


class RecommendResponse(BaseModel):
    recomendacoes: list[RecomendacaoOut]
    engineVersion: str = "rule-engine-py-v1"
