# AI Engine (Python)

Motor de recomendação do CRM em Python + FastAPI. Stateless — recebe contexto
do NestJS via HTTP, calcula, devolve as recomendações.

## Setup local

Requisitos: Python 3.11+

```powershell
# Na raiz de apps/ai-engine/
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Subir o serviço (port 8000)
uvicorn src.main:app --reload --port 8000
```

## Endpoints

| Método | Rota | Descrição |
|---|---|---|
| GET | `/health` | Liveness — `{"status":"ok"}` |
| POST | `/recommend` | Recebe contexto, devolve top-N recomendações |
| GET | `/docs` | Swagger UI (geração automática) |
| GET | `/openapi.json` | Schema OpenAPI |

## Contrato do `/recommend`

**Input** (resumo — schema completo em `/docs`):
```json
{
  "cliente": { "id", "nome", "perfil", "patrimonio" },
  "suitability": { "perfilCalculado", "horizonteAnos", "toleranciaPerda" },
  "posicoes": [{ "produtoId", "categoria", "valor" }],
  "catalog": [{ "id", "nome", "categoria", "rentabilidadeAno", "risco",
               "perfilMinimo", "liquidez", "taxaAdmin", "ativo" }],
  "topN": 3
}
```

**Output**:
```json
{
  "recomendacoes": [
    {
      "produtoId": "...",
      "produtoNome": "BDR S&P 500",
      "score": 0.87,
      "justificativa": "Olhei a carteira de Felipe...",
      "fatores": { "profileMatch": 0.85, "diversification": 1.0, ... },
      "pesos": { "profileMatch": 0.20, ... },
      "contribs": [{ "fator", "contrib", "frase" }]
    }
  ],
  "engineVersion": "rule-engine-py-v1"
}
```

## Estrutura

```
src/
├── main.py            FastAPI app + rotas
├── models.py          Pydantic models (contrato com NestJS)
├── rules.py           Filtros + 5 fatores + scoring
└── justificativa.py   Frases técnicas + narrativa pt-BR
```

A lógica é **idêntica** ao motor TypeScript em `apps/api/src/recomendacoes/ia/`.
Esse Python existe pra preparar terreno pra ML real no futuro
(plugar Scikit/LightGBM/XGBoost), sem mudar o resto do sistema.
