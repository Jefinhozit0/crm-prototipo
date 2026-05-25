# Capital Elite — Wealth Management CRM

CRM de wealth management com motor de recomendação de IA explicável.
Construído como protótipo / demo pra apresentar pra clientes (ex: BTG Pactual).

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | Next.js 16 · React 19 · TypeScript · Tailwind v4 · shadcn/ui (Base UI) |
| Estado / data | TanStack Query |
| Backend | NestJS 10 · TypeScript |
| ORM | Prisma 5 |
| Banco | PostgreSQL (Neon, hospedado) |
| Auth | JWT em cookies httpOnly |
| Motor de IA | TypeScript puro (5 fatores ponderados — diversificação, perfil, yield, liquidez, custo) |

## Estrutura

```
crm-prototipo/
├── apps/
│   ├── web/      Next.js (rota web, UI)
│   └── api/      NestJS (REST + Prisma)
├── stitch-export/   Designs originais (não-código)
├── docker-compose.yml   Postgres + Redis pra dev local (opcional)
└── package.json   npm workspaces
```

## Setup local (primeira vez)

Requisitos: Node 22+, conta Neon (ou Docker Desktop pra Postgres local).

```bash
# 1. Dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example apps/api/.env
# Editar apps/api/.env com DATABASE_URL do seu Neon

# 3. Aplicar migrations + popular banco
npm run prisma:migrate -w @crm/api
npm run prisma:seed -w @crm/api

# 4. Subir API e Web (em terminais separados)
npm run dev -w @crm/api   # → http://localhost:3333/api
npm run dev -w @crm/web   # → http://localhost:3000
```

## Credenciais de dev (criadas pelo seed)

| Email | Role | Senha |
|---|---|---|
| `admin@capitalelite.com.br` | ADMIN | `Senha123!` |
| `joao.diniz@capitalelite.com.br` | ASSESSOR | `Senha123!` |
| `marina.lopes@capitalelite.com.br` | ASSESSOR | `Senha123!` |

## Como o motor de IA funciona

Pra cada cliente, o motor:

1. Lê perfil, suitability e carteira atual do cliente
2. Compara contra o catálogo de produtos do BTG
3. Pontua cada produto em **5 critérios ponderados**:
   - Diversificação (30%) — gap vs alocação alvo do perfil
   - Compatibilidade de perfil (20%)
   - Rentabilidade (20%) — relativa à categoria
   - Liquidez (15%) — vs horizonte declarado
   - Custo (15%) — penaliza taxa alta
4. Retorna os **top 3 produtos** com score + justificativa em pt-BR
5. Persiste tudo (incluindo regras aplicadas e pesos) pra auditoria

Código do motor: [`apps/api/src/recomendacoes/ia/`](apps/api/src/recomendacoes/ia/).

## Documentação adicional

- API endpoints: `apps/api/src/*/[controller].ts`
- Schema do banco: `apps/api/prisma/schema.prisma`
- Tipos compartilhados (front): `apps/web/src/types/api.ts`
