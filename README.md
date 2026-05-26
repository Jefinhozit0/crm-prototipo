# Capital Elite — Wealth Management CRM

CRM de wealth management com motor de recomendação de IA explicável.
Construído como protótipo / demo pra apresentar pra clientes (ex: BTG Pactual).

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 16 · React 19 · TypeScript · Tailwind v4 · shadcn/ui (Base UI) |
| Estado / data | TanStack Query |
| Backend transacional | NestJS 10 · TypeScript |
| **AI Engine** | **Python 3.11+ · FastAPI · Pydantic** (microsserviço stateless) |
| ORM | Prisma 5 |
| Banco | PostgreSQL (Neon, hospedado) |
| Auth | JWT em cookies httpOnly |

## Arquitetura

```
Browser ─→ Next.js (web, :3000)
              ↓ /api/* proxy
          NestJS (api, :3333) ─── Postgres (Neon)
              ↓ POST /recommend
          Python FastAPI (ai-engine, :8000) ← stateless, motor de regras
```

O Python recebe contexto completo (cliente, suitability, carteira, catálogo) no body,
calcula e devolve. Não acessa banco. Permite plugar ML real (Scikit/LightGBM/XGBoost)
no futuro sem mexer no resto do sistema.

## Estrutura

```
crm-prototipo/
├── apps/
│   ├── web/          Next.js (UI, autenticação, proxy /api)
│   ├── api/          NestJS (REST, Prisma, orquestração)
│   └── ai-engine/    Python + FastAPI (motor de recomendação)
├── stitch-export/    Designs originais (não-código)
├── docker-compose.yml   Postgres + Redis pra dev local (opcional)
└── package.json      npm workspaces
```

## Setup local (primeira vez)

Requisitos: Node 22+, Python 3.11+, conta Neon (ou Docker Desktop pra Postgres local).

### 1. Dependências

```bash
# Raiz — instala web + api
npm install

# AI Engine — venv + pip
cd apps/ai-engine
python -m venv .venv
.\.venv\Scripts\Activate.ps1   # Windows
# source .venv/bin/activate     # macOS/Linux
pip install -r requirements.txt
cd ../..
```

### 2. Variáveis de ambiente

```bash
cp .env.example apps/api/.env
# Editar apps/api/.env com DATABASE_URL do seu Neon
```

### 3. Banco

```bash
npm run prisma:migrate -w @crm/api
npm run prisma:seed -w @crm/api
```

### 4. Subir os 3 serviços (em 3 terminais)

```bash
# Terminal 1 — AI Engine (Python)
cd apps/ai-engine
.\.venv\Scripts\Activate.ps1
uvicorn src.main:app --reload --port 8000

# Terminal 2 — API (NestJS)
npm run dev -w @crm/api          # → http://localhost:3333/api

# Terminal 3 — Web (Next.js)
npm run dev -w @crm/web          # → http://localhost:3000
```

## Credenciais de dev (criadas pelo seed)

| Email | Role | Senha |
|---|---|---|
| `admin@capitalelite.com.br` | ADMIN | `Senha123!` |
| `joao.diniz@capitalelite.com.br` | ASSESSOR | `Senha123!` |
| `marina.lopes@capitalelite.com.br` | ASSESSOR | `Senha123!` |

## Como o motor de IA funciona

Pra cada cliente, o motor (Python):

1. Recebe perfil, suitability, carteira atual e catálogo do NestJS
2. Filtra produtos incompatíveis (perfil, sobrealocação)
3. Pontua cada produto restante em **5 critérios ponderados**:
   - Diversificação (30%) — gap vs alocação alvo do perfil
   - Compatibilidade de perfil (20%)
   - Rentabilidade (20%) — relativa à categoria
   - Liquidez (15%) — vs horizonte declarado
   - Custo (15%) — penaliza taxa alta
4. Gera **justificativa em narrativa pt-BR** (1ª pessoa) com os fatores que mais pesaram
5. Devolve os **top-N produtos** com score, fatores, pesos e payload de auditoria
6. NestJS persiste tudo na tabela `recomendacoes` com `geradoPor: rule-engine-py-v1`

Código do motor: [`apps/ai-engine/src/`](apps/ai-engine/src/).

## Roadmap da IA

| Fase | Status |
|---|---|
| Motor de regras explicável (Python/FastAPI) | ✅ atual |
| Coleta de aprovações/recusas pra dataset | ✅ (já registrado em `recomendacoes`) |
| ML real (Scikit/LightGBM treinado nos próprios dados) | 🔜 quando tiver volume |
| LLM gerando justificativas (Claude/Gemini) | 🔜 opcional |

## Documentação adicional

- API endpoints: `apps/api/src/*/[controller].ts`
- Schema do banco: `apps/api/prisma/schema.prisma`
- Tipos compartilhados (front): `apps/web/src/types/api.ts`
- README do AI Engine: [`apps/ai-engine/README.md`](apps/ai-engine/README.md)
- Swagger do AI Engine (em runtime): http://localhost:8000/docs
