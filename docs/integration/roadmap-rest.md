# Roadmap — Integração REST API

> **Status:** roadmap. Não implementado ainda. Documentado pra pitch comercial — mostra que a arquitetura atual já suporta a evolução sem retrabalho.

## Por que existe esse doc

A integração MVP é **export CSV manual** (ver [diagrama.md](diagrama.md)). Funciona, é seguro, valida hipótese em 30 dias. Mas o pitch técnico pra CTO pede mais: *"e quando a gente quiser tempo real?"*. A resposta é este roadmap.

## V1 → V2 — evolução sem retrabalho

| Etapa | Hoje (MVP) | V2 (REST) |
|---|---|---|
| Treino | CLI `python -m src.ml.train` rodado manualmente | Endpoint `POST /retrain` recebe CSV via upload |
| Carga do modelo | Lazy load no startup, singleton | Swap atômico em runtime, sem restart |
| Scoring | `POST /recommend` (já existe) | Mesmo endpoint, sem mudança no contrato |
| Auth | Confiança na rede privada | API key + rate limit por tenant |

O ponto importante: **o mesmo `train.py` que roda offline hoje** é o que vai ser chamado por dentro do endpoint REST amanhã. Não tem reescrita.

## Endpoints propostos

### `POST /retrain`

Recebe um CSV (multipart/form-data) no formato documentado em [training-dataset-schema.md](training-dataset-schema.md), treina, valida métricas mínimas, e faz swap atômico do modelo em runtime.

**Request:**
```http
POST /retrain
Authorization: Bearer <api-key>
Content-Type: multipart/form-data

dataset: <arquivo.csv>
version_tag: ml-ranker-v2-bd45ad
min_auc: 0.78   (opcional — rejeita se AUC abaixo)
```

**Response:**
```json
{
  "status": "ok",
  "version": "ml-ranker-v2-bd45ad",
  "trained_at": "2026-09-15T14:32:00Z",
  "metrics": { "auc": 0.842, "accuracy": 0.74, ... },
  "swap_completed": true,
  "previous_version": "ml-ranker-v1"
}
```

Swap atômico: o novo `.pkl` é gravado em `models/ranker-pending.pkl`, validado em memória, e só então a referência do singleton é trocada (lock). Se a validação falhar, o modelo antigo continua servindo.

### `POST /model/rollback`

Volta pro modelo anterior se o novo apresentar drift indesejado.

```http
POST /model/rollback
Authorization: Bearer <api-key>
```

Resposta: identifica versão anterior, recarrega, devolve confirmação.

### `GET /model/info` (já implícito no `/health` atual)

```json
{
  "version": "ml-ranker-v1",
  "trained_at": "2026-08-30T19:15:00Z",
  "dataset_rows": 4250,
  "metrics": { "auc": 0.825, ... },
  "feature_columns": ["cliente_patrimonio", ...]
}
```

## Auth e segurança

- **Bearer token** com escopo limitado (`retrain`, `score`, ambos). Rotacionável.
- **mTLS** entre CRM cliente e nosso motor (opção pra clientes high-trust).
- **Rate limit** por tenant — `/retrain` é caro, limitar a 1 chamada por dia/ambiente.
- **Audit log** de cada treino: quem chamou, dataset hash, métricas, versão resultante.

## Observability

Pra cada `/recommend` em produção:
- Latência de inferência (ms)
- Score retornado por produto (distribuição)
- Versão do modelo em uso
- Match com decisão real do assessor (feedback loop)

Pra cada `/retrain`:
- Tamanho do dataset
- Distribuição da label
- Métricas antes/depois (AUC, calibração)
- Drift de features (KS-test entre treino atual e anterior)

Stack sugerida: Prometheus + Grafana, ou New Relic / Datadog se cliente preferir.

## Quando ativar V2

Critérios pra desbloquear:
- ✅ Validação de hipótese no MVP CSV (cliente vê valor, taxa de aprovação de recomendações sobe)
- ✅ Volume estável de dados (>1k decisões/mês)
- ✅ SLA de uptime contratado (99.5%+)
- ✅ Compliance ok com integração entre redes

Estimativa: ~3 sprints de 2 semanas (auth + retrain endpoint + observability + testing).

## O que NÃO está nesse roadmap

- Decisão em tempo real via webhook por evento de aprovação. Considerado mas rejeitado por fragilidade operacional (gap de webhooks = gap de dataset). Se vier no V3, é tema de design separado.
- Multi-tenant SaaS hosted. Pra demo é só V2 self-hosted.
- AutoML / hyperparameter tuning automático. Pode ser adicionado dentro do train.py sem mudar contrato.
