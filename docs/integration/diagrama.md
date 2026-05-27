# Arquitetura — Motor de IA Capital Elite

## Stack atual (v2.0)

```
┌──────────────────────────────────────────────────────────────────┐
│                         CRM do cliente                            │
│              (BTG, XP, ou outro — quem nos contrata)              │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  Histórico interno: recomendações × decisões de assessores │   │
│  └─────────────────────────┬──────────────────────────────────┘   │
│                            │ export periódico (CSV)               │
└────────────────────────────┼──────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│            Pipeline de Treino do motor (offline)                  │
│                                                                   │
│   data/cliente-export.csv                                         │
│       │                                                           │
│       ▼                                                           │
│   python -m src.ml.train --dataset ... --out models/ranker.pkl    │
│       │                                                           │
│       ▼                                                           │
│   models/ranker-v1.pkl  ← artefato versionado                     │
└──────────────────────────┬───────────────────────────────────────┘
                           │ carregado na inicialização
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                  Motor (apps/ai-engine) — Python                  │
│                                                                   │
│   POST /recommend                                                 │
│      │                                                            │
│      ▼                                                            │
│   passa_filtro (rules)  ← determinístico, compliance              │
│      │                                                            │
│      ▼                                                            │
│   ML scorer (LightGBM)  ← probabilidade de aprovação              │
│      │     │ fallback se .pkl indisponível                        │
│      │     ▼                                                      │
│      │  rule-based score (5 fatores ponderados)                   │
│      ▼                                                            │
│   build_justificativa (rules)  ← narrativa pt-BR auditável        │
│      │                                                            │
│      ▼                                                            │
│   { recomendacoes, descartados, totalAnalisados, engineVersion }  │
└──────────────────────────┬───────────────────────────────────────┘
                           │ HTTP JSON
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                    NestJS (apps/api) — orquestração               │
│   /api/recomendacoes/generate                                     │
│      │                                                            │
│      ├─ persiste recomendacoes + payload (audit trail)            │
│      └─ devolve pro front                                         │
└──────────────────────────┬───────────────────────────────────────┘
                           │
                           ▼
                  Next.js (apps/web) — UI
```

## Pontos de integração com o CRM do cliente

| Ponto | Hoje (MVP) | Roadmap (V2) |
|---|---|---|
| **Treino** | Export CSV manual → CLI offline | Endpoint `POST /retrain` recebe CSV, swap atômico do modelo |
| **Scoring** | Self-hosted, motor próprio | Mesma coisa; pode virar SaaS multi-tenant |
| **Auditoria** | `payload` no Postgres | Mesma coisa + dashboard de drift |
| **Catálogo** | NestJS Postgres (próprio) | Espelho do CRM cliente ou consulta direta |

Hoje todos os dados (clientes, produtos, recomendações) ficam no Postgres do **nosso** CRM. A integração com o CRM do cliente é via **export periódico do histórico de decisões** (ver [training-dataset-schema.md](training-dataset-schema.md)).

## Modos de score em runtime

O motor sempre tenta usar o modelo ML. Se falhar:

```
get_scorer() → MLScorer:
  ├─ .pkl existe e carrega OK → loaded=true
  │     → predict_proba retorna P(aprovação)
  │     → engineVersion = "ml-ranker-v1" (ou o que o .pkl declarou)
  │
  └─ .pkl ausente / corrupto / feature columns divergentes
        → loaded=false
        → caller cai pro rule-based score (sum of 5 weighted factors)
        → engineVersion = "rule-engine-py-v1.3" (fallback)
```

A justificativa em pt-BR é **sempre** gerada a partir dos fatores rule-based — o ML re-ranqueia, mas a explicação do "porquê" continua determinística e auditável. Diretor de risco pode ler exatamente o que pesou.

## Componentes da camada ML

```
apps/ai-engine/src/ml/
├── __init__.py
├── features.py    Extração de features (mesma usada por treino e inferência)
├── synth.py       Gerador de dataset sintético (bootstrap)
├── train.py       CLI: CSV → LightGBM treinado → .pkl
└── scorer.py      Singleton que carrega .pkl na inicialização do FastAPI

apps/ai-engine/data/
└── synth-2026q2.csv   ← dataset sintético versionado

apps/ai-engine/models/
└── ranker-v1.pkl      ← artefato do modelo (binário, joblib)
```

## Ver também

- [training-dataset-schema.md](training-dataset-schema.md) — contrato do CSV de treino
- [roadmap-rest.md](roadmap-rest.md) — roadmap de integração via REST API
