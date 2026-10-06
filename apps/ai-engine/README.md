# AI Engine (Python)

Motor de recomendação do CRM em Python + FastAPI. Stateless — recebe contexto
do NestJS via HTTP, calcula e devolve as recomendações. Não acessa banco.

> **Apoio à decisão.** O motor filtra e ordena produtos com regras explícitas; não
> substitui a análise do assessor nem os controles de compliance.

## Setup local

Requisitos: Python 3.11+

```powershell
# Na raiz de apps/ai-engine/
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt   # runtime + pytest/httpx

# Subir o serviço (porta 8000)
uvicorn src.main:app --reload --port 8000

# Testes
pytest -q
```

### Variáveis de ambiente

| Variável | Efeito |
|---|---|
| `AI_ENGINE_TOKEN` | Se definida, `/recommend` exige `Authorization: Bearer <token>` (mesmo valor da API). Obrigatória em produção. |
| `ENV=production` | Desliga `/docs` e `/openapi.json`. |
| `CRM_ML_MODEL_PATH` | Caminho do `.pkl` do ranker (padrão `models/ranker-v1.pkl`). Se não carregar, o motor usa só as regras. |
| `CRM_CASA_DISTRIBUI` | Trecho usado na narrativa ("que distribuímos"). |

## Endpoints

| Método | Rota | Descrição |
|---|---|---|
| GET | `/health` | Liveness — `{"status","engine","ml_loaded"}` (sem token) |
| POST | `/recommend` | Recebe contexto, devolve top-N recomendações (token se configurado) |
| GET | `/docs` | Swagger UI (fora de produção) |

Sem CORS: o serviço é chamado só pela API, nunca pelo navegador. O log de acesso
registra método, rota, status, duração e `X-Request-Id` — nunca o corpo (que tem
nome e patrimônio do cliente).

## Contrato do `/recommend`

**Input** (limites validados pelo Pydantic — schema completo em `/docs`):
```json
{
  "cliente": { "id", "nome", "perfil", "patrimonio" },
  "suitability": { "perfilCalculado", "horizonteAnos", "toleranciaPerda" },
  "posicoes": [{ "produtoId", "categoria", "valor" }],          // máx. 1000
  "catalog": [{ "id", "nome", "emissor", "categoria", "rentabilidadeAno", "risco",
               "tributacao", "perfilMinimo", "liquidez", "taxaAdmin", "ativo" }], // máx. 2000
  "topN": 3                                                     // 1..10
}
```

`horizonteAnos` e `toleranciaPerda` são derivados pela API a partir das respostas do
questionário (`apps/api/src/suitability/parametros.ts`).

**Output**:
```json
{
  "recomendacoes": [
    {
      "produtoId": "...", "produtoNome": "BDR S&P 500",
      "score": 0.87,            // usado no ranking, [0,1]
      "scoreRegras": 0.87,      // soma ponderada dos 5 fatores (o que a justificativa explica)
      "scoreFonte": "rule-engine",   // ou versão do modelo ML / "rule-engine-fallback"
      "justificativa": "Olhei a carteira de Felipe...",
      "fatores": { "profileMatch": 0.85, "diversification": 1.0, ... },
      "pesos": { "profileMatch": 0.20, ... },
      "contribs": [{ "fator", "contrib", "frase" }]
    }
  ],
  "descartados": [{ "motivo": "perfil_incompativel", "count": 3 }],
  "totalAnalisados": 15,
  "engineVersion": "rule-engine-py-v1.4"
}
```

## Regras

- **Filtros**: perfil mínimo > perfil do cliente; drawdown de referência do risco do
  produto > 1,5 × tolerância declarada; > 30% do patrimônio no mesmo emissor privado
  (Tesouro Nacional isento — risco soberano); > 30% do patrimônio no próprio produto.
- **Fatores (0..1)**: compatibilidade de perfil, gap vs. alocação-alvo do perfil,
  rentabilidade líquida de IR (tabela regressiva pelo horizonte) relativa aos produtos
  ativos da categoria, liquidez vs. horizonte, custo vs. teto de taxa da categoria.
- **Casos-limite cobertos por teste**: catálogo vazio, patrimônio zero, horizonte zero,
  produto sem taxa, produto sem posição, NaN/erro do modelo ML (cai para regras).

## Estrutura

```
src/
├── main.py            FastAPI app, autenticação por token, log de acesso
├── models.py          Pydantic (contrato com o NestJS + limites de payload)
├── rules.py           Filtros + 5 fatores + scoring + fallback ML
├── justificativa.py   Frases técnicas + narrativa pt-BR
└── ml/                Features, dataset sintético, treino e scorer LightGBM
tests/                 pytest (regras, contrato HTTP, fallback ML)
```

Esta é a **única** implementação do motor. A versão TypeScript que existia em
`apps/api/src/recomendacoes/ia/` foi removida (não era usada e já divergia).

Faixas de versão em `requirements.txt` são limitadas à major atual: uma major nova
de pandas/scikit-learn/LightGBM pode invalidar o modelo serializado em `models/*.pkl`.
