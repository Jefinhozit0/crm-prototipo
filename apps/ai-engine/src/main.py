"""
FastAPI app — motor de recomendação de IA.

Stateless: recebe contexto completo do NestJS, calcula, devolve.
Não tem acesso a banco.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .justificativa import build_justificativa, preencher_frases_fator
from .models import RecommendRequest, RecommendResponse
from .rules import top_recomendacoes

ENGINE_VERSION = "rule-engine-py-v1"

app = FastAPI(
    title="Capital Elite — AI Engine",
    description="Motor de recomendação de produtos por cliente (Python).",
    version="0.1.0",
)

# CORS — em prod só vai receber do NestJS, mas permitimos tudo em dev.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    """Liveness probe — usado por monitores e pelo NestJS na inicialização."""
    return {"status": "ok", "engine": ENGINE_VERSION}


@app.post("/recommend", response_model=RecommendResponse)
def recommend(req: RecommendRequest) -> RecommendResponse:
    """
    Recebe contexto do cliente + catálogo. Devolve top-N recomendações
    com score, justificativa em pt-BR e payload de auditoria.
    """
    scoreds = top_recomendacoes(req, req.topN)

    recomendacoes = []
    for scored in scoreds:
        preencher_frases_fator(
            scored, req.cliente, req.posicoes, req.suitability
        )
        justificativa = build_justificativa(
            scored, req.cliente, req.posicoes, req.suitability
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
        recomendacoes=recomendacoes, engineVersion=ENGINE_VERSION
    )
