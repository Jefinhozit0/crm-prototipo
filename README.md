# Capital Elite — Wealth Management CRM

CRM de wealth management com motor de recomendação explicável.

> **Estágio: MVP técnico demonstrável — não está pronto para uso financeiro em produção.**
> Veja [`docs/relatorio-evolucao.md`](docs/relatorio-evolucao.md) para o que já foi
> validado, os riscos conhecidos e o que falta para produção.
>
> As recomendações são **apoio à decisão**: a decisão final é do assessor e está
> sujeita aos controles internos e de compliance da instituição.

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 16 · React 19 · TypeScript · Tailwind v4 · shadcn/ui (Base UI) |
| Estado / data | TanStack Query |
| Backend transacional | NestJS 11 (Express 5) · TypeScript · Zod |
| Motor de recomendação | Python 3.11+ · FastAPI · Pydantic (regras + ranker LightGBM opcional) |
| ORM / Banco | Prisma 5 · PostgreSQL |
| Auth | JWT em cookies httpOnly, refresh token com rotação e revogação |
| Testes | Jest + Supertest (API) · Vitest + Testing Library (web) · pytest (motor) |

## Arquitetura

```
Browser ─→ Next.js (web, :3000)
              ↓ /api/* (rewrite — cookies same-origin)
          NestJS (api, :3333) ─── PostgreSQL
              ↓ POST /recommend  (Bearer AI_ENGINE_TOKEN, timeout, X-Request-Id)
          Python FastAPI (ai-engine, :8000) ← stateless, sem acesso a banco
```

- O Python recebe o contexto completo (cliente, suitability vigente, carteira, catálogo
  ativo), calcula e devolve. A API valida a resposta antes de gravar.
- Cada recomendação guarda no `payload` o snapshot do contexto usado (suitability,
  horizonte, tolerância, versão do motor, hash do catálogo) para auditoria.
- Toda requisição recebe um `X-Request-Id`, propagado ao motor e gravado na auditoria.

## Perfis de acesso

| Perfil | Clientes / leads | Suitability e recomendações | Catálogo | Auditoria |
|---|---|---|---|---|
| ADMIN | todos, leitura e escrita | aplicar, gerar, aprovar, recusar | gerir | ler |
| ASSESSOR | **só a própria carteira** | aplicar, gerar, aprovar, recusar (própria carteira) | consultar | — |
| COMPLIANCE | todos, só leitura | só leitura | consultar | ler |
| READONLY | todos, só leitura | só leitura | consultar | — |

Registros fora do escopo respondem **404** (não revela que existem). Escrita sem `@Roles`
explícito exige ADMIN ou ASSESSOR por padrão (`RolesGuard`).

## Setup local

Requisitos: Node 20+ (testado com 24), Python 3.11+, PostgreSQL 16+ (ou Docker).

```bash
# 1. Dependências
npm install
cd apps/ai-engine && python -m venv .venv
.\.venv\Scripts\Activate.ps1          # Windows  (source .venv/bin/activate no macOS/Linux)
pip install -r requirements-dev.txt
cd ../..

# 2. Variáveis de ambiente (ver comentários no arquivo)
cp .env.example apps/api/.env

# 3. Banco (Postgres local via Docker, opcional)
docker compose up -d postgres
npm run prisma:migrate -w @crm/api     # dev; em servidores use: npx prisma migrate deploy
npm run prisma:seed -w @crm/api        # APAGA e recria os dados de demonstração

# 4. Subir os 3 serviços (3 terminais)
cd apps/ai-engine && uvicorn src.main:app --reload --port 8000
npm run dev -w @crm/api                # http://localhost:3333/api
npm run dev -w @crm/web                # http://localhost:3000
```

> O seed **apaga todas as tabelas**. Em `NODE_ENV=production` ele se recusa a rodar,
> a menos que `SEED_ALLOW_RESET=true`.

### Credenciais de demonstração (somente ambiente local, criadas pelo seed)

| Email | Perfil | Senha |
|---|---|---|
| `admin@capitalelite.com.br` | ADMIN | `Senha123!` |
| `joao.diniz@capitalelite.com.br` | ASSESSOR | `Senha123!` |
| `marina.lopes@capitalelite.com.br` | ASSESSOR | `Senha123!` |

### Variáveis obrigatórias em produção

A API **não sobe** em `NODE_ENV=production` sem: `JWT_SECRET` e `JWT_REFRESH_SECRET`
(32+ caracteres, diferentes), `CPF_HASH_SECRET` (32+) e `AI_ENGINE_TOKEN` (mesmo valor
configurado no motor Python). Detalhes em [`.env.example`](.env.example).

## Validação

```bash
npm run lint        # ESLint (web)
npm run typecheck   # tsc (api + web)
npm run build       # prisma generate + nest build · next build
npm test            # Jest (api) + Vitest (web)

cd apps/ai-engine && pytest -q
```

Os testes da API sobem a aplicação Nest real (guards, pipes, filtros, cookies) com o
Prisma trocado por um banco em memória — não precisam de Postgres.

O CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) roda em todo PR e push na
`main`: os comandos acima, `npm audit --omit=dev` (falha em vulnerabilidade alta ou crítica
de produção), as migrações do zero num PostgreSQL real com checagem de drift contra o
`schema.prisma` e o seed, e o pytest do motor.

## Endpoints principais

| Método | Rota | Quem |
|---|---|---|
| POST | `/api/auth/login` · `/refresh` · `/logout` | público |
| GET | `/api/clientes` · `/:id` · `/:id/detalhado` | autenticado (escopo) |
| POST/PATCH | `/api/clientes` · `/:id` | ADMIN, ASSESSOR (entrar/sair de INATIVO: só ADMIN) |
| DELETE | `/api/clientes/:id` (inativa — não apaga) | ADMIN |
| GET | `/api/leads` · `/board` · `/:id` | autenticado (escopo) |
| POST/PATCH/DELETE | `/api/leads` · `/:id` · `/:id/mover-estagio` | ADMIN, ASSESSOR |
| POST | `/api/leads/:id/converter` (cria o cliente e fecha o lead, numa transação) | ADMIN, ASSESSOR |
| GET | `/api/produtos` · `/:id` | autenticado |
| POST/PATCH/DELETE | `/api/produtos` · `/:id` (DELETE desativa) | ADMIN |
| GET | `/api/usuarios/assessores` | ADMIN |
| GET/POST | `/api/suitability` · `/questionario` · `/cliente/:id` | leitura: todos · aplicar: ADMIN, ASSESSOR |
| POST | `/api/recomendacoes/generate` | ADMIN, ASSESSOR |
| PATCH | `/api/recomendacoes/:id/aprovar` · `/recusar` | ADMIN, ASSESSOR |
| GET | `/api/dashboard/resumo` · `/api/interacoes` | autenticado (escopo) |
| GET | `/api/auditoria` | ADMIN, COMPLIANCE |
| GET | `/api/health/live` · `/ready` (público) · `/api/health` (ADMIN) | — |

## Como o motor funciona

Para cada cliente com **suitability válida** (sem ela a API responde 422):

1. Filtros de adequação (determinísticos): perfil mínimo do produto, risco além da
   tolerância declarada, concentração > 30% em um emissor privado (título público
   federal não conta), sobrealocação > 30% no produto.
2. Cinco fatores ponderados: diversificação vs. alocação-alvo do perfil (30%),
   compatibilidade de perfil (20%), rentabilidade líquida de IR relativa à categoria
   (20%), liquidez vs. horizonte (15%), custo (15%).
3. Ranking: ranker LightGBM quando o modelo carrega; senão, a soma ponderada. Cada
   recomendação informa `scoreFonte` e `scoreRegras`.
4. Justificativa em pt-BR sempre gerada pelas regras (auditável).

Detalhes: [`apps/ai-engine/README.md`](apps/ai-engine/README.md).

## Estrutura

```
crm-prototipo/
├── apps/
│   ├── web/          Next.js (UI, proxy /api)
│   ├── api/          NestJS (REST, Prisma, auth, auditoria) — testes em test/ e *.spec.ts
│   └── ai-engine/    Python + FastAPI (motor) — testes em tests/
├── docs/             Relatório de evolução e documentos de integração
├── stitch-export/    Designs originais (não-código)
└── docker-compose.yml   Postgres + Redis pra dev local
```
