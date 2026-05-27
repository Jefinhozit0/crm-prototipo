"""
FastAPI app — motor de recomendação de IA.

Stateless: recebe contexto completo do NestJS, calcula, devolve.
Não tem acesso a banco.

Híbrido ML + regras:
- Filtros hard (perfil, risco, concentração) são determinísticos — compliance.
- Pontuação: LightGBM treinado quando modelo carregado, senão soma ponderada
  dos 5 fatores rule-based (fallback). `engineVersion` reflete qual está em uso.
- Justificativa em pt-BR sempre vem das regras (são auditáveis e explicáveis),
  independente de o ranking ter vindo do ML.
"""
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .justificativa import build_justificativa, preencher_frases_fator
from .ml.scorer import get_scorer
from .models import RecommendRequest, RecommendResponse
from .rules import exposicao_por_emissor, top_recomendacoes

logging.basicConfig(level=logging.INFO)

RULE_ENGINE_VERSION = "rule-engine-py-v1.3"


def resolve_engine_version() -> str:
    scorer = get_scorer()
    return scorer.version if scorer.loaded else RULE_ENGINE_VERSION


app = FastAPI(
    title="Capital Elite — AI Engine",
    description="Motor de recomendação híbrido (LightGBM + regras explicáveis).",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    """Liveness probe — usado por monitores e pelo NestJS na inicialização."""
    scorer = get_scorer()
    return {
        "status": "ok",
        "engine": resolve_engine_version(),
        "ml_loaded": scorer.loaded,
        "ml_metrics": scorer.metrics if scorer.loaded else None,
    }


@app.post("/recommend", response_model=RecommendResponse)
def recommend(req: RecommendRequest) -> RecommendResponse:
    """
    Recebe contexto do cliente + catálogo. Devolve top-N recomendações
    com score (ML quando disponível, regras como fallback), justificativa
    em pt-BR (sempre rule-based, pra auditoria) e breakdown dos descartes.
    """
    scorer = get_scorer()
    scoreds, descartados, total = top_recomendacoes(req, req.topN, ml_scorer=scorer)
    exposicao_emissor = exposicao_por_emissor(req.posicoes, req.catalog)

    recomendacoes = []
    for scored in scoreds:
        preencher_frases_fator(
            scored, req.cliente, req.posicoes, req.suitability
        )
        justificativa = build_justificativa(
            scored, req.cliente, req.posicoes, req.suitability, exposicao_emissor
        )

        recomendacoes.append(
            {
                "produtoId": scored["produto"].id,
                "produtoNome": scored["produto"].nome,
                "score": round(scored["score"], 3),
                "justificativa": justificativa,
                "fatores": scored["fatores"],
                "pesos": scored["pesos"],
                "contribs": scored["contribs"],
            }
        )

    return RecommendResponse(
        recomendacoes=recomendacoes,
        descartados=descartados,
        totalAnalisados=total,
        engineVersion=resolve_engine_version(),
    )
