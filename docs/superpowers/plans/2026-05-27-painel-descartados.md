# Painel "por que descartei N produtos" — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expor na geração de recomendação o trabalho invisível do motor — quantos produtos foram descartados e por quê — através da animação do `ThinkingDialog` e de um accordion retroativo no card.

**Architecture:** Mudança aditiva em 3 camadas. Engine Python adiciona `descartados[]` + `totalAnalisados` no response e bumpa pra `rule-engine-py-v1.3`. NestJS propaga no `payload` de cada Recomendacao (mesmo objeto coletivo). Next.js renderiza durante o thinking (passo 4 dinâmico) e retroativamente no card (accordion). Spec completo em [docs/superpowers/specs/2026-05-27-painel-descartados-design.md](docs/superpowers/specs/2026-05-27-painel-descartados-design.md).

**Tech Stack:** Python 3.11+ FastAPI + Pydantic v2 · NestJS 10 + Prisma · Next.js 16 + React 19 + TanStack Query · TypeScript estrito · PowerShell pra validação.

**Convenção de commits:** Este projeto segue regra "não commitar sem pedido do usuário". Cada task tem um step "Sugerir commit" — o executor **deve pausar** e pedir confirmação antes de executar `git commit`. Se o user pedir bundle único no fim, todos os commits sugeridos viram um só na Task 12.

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `apps/ai-engine/src/models.py` | + tipos `MotivoDescarte`, `DescarteContexto`, `DescarteAgregado`; expandir `RecommendResponse`; bump engineVersion default |
| `apps/ai-engine/src/rules.py` | + `PRIORIDADE_MOTIVOS` const; + `_pontuar` helper privado (corpo do scoring); refactor `top_recomendacoes` pra retornar tupla `(scored, descartados, total)`; manter `score_produto` removido (não tem mais caller) |
| `apps/ai-engine/src/main.py` | bump `ENGINE_VERSION = "rule-engine-py-v1.3"`; consumir tupla nova de `top_recomendacoes`; popular `descartados` + `totalAnalisados` no `RecommendResponse` |
| `apps/api/src/recomendacoes/ai-engine.service.ts` | + tipo `AiEngineDescarte`; expandir `AiEngineResponse` com `descartados` + `totalAnalisados` |
| `apps/api/src/recomendacoes/recomendacoes.service.ts` | injetar `descartadosDaRodada` + `totalAnalisados` no `payload` no map de criação de Recomendacao em `generate()` |
| `apps/web/src/types/api.ts` | + tipos `MotivoDescarte`, `DescarteAgregado`; estender `Recomendacao.payload` com `descartadosDaRodada?` + `totalAnalisados?` (opcionais — graceful fallback) |
| `apps/web/src/components/thinking-dialog.tsx` | substituir array hardcoded de `steps` por construção reativa a partir de `result.recomendacoes[0]?.payload`; adicionar helper `formatarDescarte` |
| `apps/web/src/components/recomendacao-card.tsx` | + accordion `DescartadosAccordion` abaixo do "Como cheguei nisso", só renderiza se `payload.descartadosDaRodada?.length > 0` |

---

## Pre-flight

### Task 0: Verificar serviços e branch

**Files:** nenhum

- [ ] **Step 1: Confirmar branch e working tree**

```powershell
git status
git branch --show-current
```

Expected: branch `main` (ou branch dedicada se foi criada). Working tree limpo (sem mudanças não commitadas relacionadas).

- [ ] **Step 2: Verificar serviços rodando**

```powershell
$endpoints = @{
  "ai-engine" = "http://127.0.0.1:8000/health"
  "api"       = "http://127.0.0.1:3333/api/health/live"
  "web"       = "http://127.0.0.1:3000"
}
foreach ($n in $endpoints.Keys) {
  try {
    $r = Invoke-WebRequest -Uri $endpoints[$n] -TimeoutSec 2 -UseBasicParsing
    "{0,-10} {1}" -f $n, $r.StatusCode
  } catch {
    "{0,-10} DOWN" -f $n
  }
}
```

Expected: os 3 serviços `200`. Se algum estiver DOWN, suba antes de continuar:
- ai-engine: `Set-Location apps\ai-engine; & ".\.venv\Scripts\python.exe" -u -m uvicorn src.main:app --host 127.0.0.1 --port 8000` (em background)
- api: `npm run dev -w @crm/api` (em background, do root)
- web: `npm run dev -w @crm/web` (em background, do root)

Hot reload já está ligado nos 3 — não precisará reiniciar durante o desenvolvimento, exceto se mudar `models.py` (Pydantic strict).

---

## Phase 1 — Motor Python

### Task 1: Tipos novos em `models.py`

**Files:**
- Modify: `apps/ai-engine/src/models.py`

- [ ] **Step 1: Adicionar tipos de descarte e expandir RecommendResponse**

Depois da linha `Tributacao = Literal[...]` e antes do `Cliente`, adicionar:

```python
MotivoDescarte = Literal[
    "perfil_incompativel",
    "concentracao_emissor",
    "risco_alem_tolerancia",
    "ja_sobrealocado",
]
```

Adicionar duas classes novas perto das outras Pydantic (depois de `Contribuicao` ou similar):

```python
class DescarteContexto(BaseModel):
    """Contexto opcional pra enriquecer a frase do descarte (ex: concentração)."""
    emissor: str | None = None
    pctPatrimonio: int | None = None


class DescarteAgregado(BaseModel):
    motivo: MotivoDescarte
    count: int
    contexto: DescarteContexto | None = None
```

Modificar `RecommendResponse` (já existe) pra adicionar 2 campos novos e bumpar engineVersion default:

```python
class RecommendResponse(BaseModel):
    recomendacoes: list[RecomendacaoOut]
    descartados: list[DescarteAgregado] = []
    totalAnalisados: int = 0
    engineVersion: str = "rule-engine-py-v1.3"
```

- [ ] **Step 2: Verificar import**

`BaseModel` já é importado de `pydantic` no topo do arquivo. Nada a adicionar.

- [ ] **Step 3: Compilar pra checar sintaxe**

```powershell
& "apps\ai-engine\.venv\Scripts\python.exe" -m py_compile apps\ai-engine\src\models.py
```

Expected: comando termina silenciosamente sem output (zero exit code).

- [ ] **Step 4: Sugerir commit (pausar pra aprovação)**

```bash
git add apps/ai-engine/src/models.py
git commit -m "feat(ai-engine): add MotivoDescarte/DescarteAgregado types and bump version to v1.3"
```

⚠️ **NÃO executar sem aprovação do usuário.** Mostrar pra ele e perguntar.

---

### Task 2: Refactor de `rules.py` — top_recomendacoes retorna tupla

**Files:**
- Modify: `apps/ai-engine/src/rules.py`

- [ ] **Step 1: Importar Suitability (se ainda não importado) e adicionar PRIORIDADE_MOTIVOS**

Logo após o dict `LIMITE_CONCENTRACAO_EMISSOR = 0.30` (linha ~120), adicionar:

```python
PRIORIDADE_MOTIVOS: list[str] = [
    "perfil_incompativel",
    "concentracao_emissor",
    "risco_alem_tolerancia",
    "ja_sobrealocado",
]
```

- [ ] **Step 2: Extrair body de `score_produto` em `_pontuar` privado**

Substituir a função `score_produto` (linhas 245-280 aprox) por:

```python
def _pontuar(
    req: RecommendRequest, p: Produto, exposicao_emissor: dict[str, float]
) -> dict:
    """Pontua um produto que JÁ PASSOU pelo passa_filtro.
    Não chama passa_filtro novamente — caller é responsável por filtrar."""
    fatores: dict[str, float] = {
        "profileMatch": profile_match(req.suitability, p),
        "diversification": diversification(
            req.cliente, req.suitability, req.posicoes, p
        ),
        "yield": yield_relativo(p, req.catalog, req.suitability.horizonteAnos),
        "liquidity": liquidity_fit(req.suitability.horizonteAnos, p),
        "cost": cost_score(p),
    }

    contribs = [
        {
            "fator": k,
            "contrib": fatores[k] * PESOS[k],
            "frase": "",
        }
        for k in PESOS
    ]

    score = sum(c["contrib"] for c in contribs)

    return {
        "produto": p,
        "score": score,
        "fatores": fatores,
        "pesos": PESOS,
        "contribs": contribs,
    }
```

(Removeu o `passa_filtro` call inicial e o `if not ok: return None`. Renomeou pra `_pontuar`.)

- [ ] **Step 3: Reescrever `top_recomendacoes` pra retornar tupla**

Substituir a função `top_recomendacoes` inteira por:

```python
def top_recomendacoes(
    req: RecommendRequest, n: int = 3
) -> tuple[list[dict], list[dict], int]:
    """Retorna (top-N produtos pontuados, descartados agregados, total analisados).

    Total = len(req.catalog). Descartados agregados por motivo, em ordem fixa.
    Motivo 'inativo' não conta como decisão de scoring.
    """
    exposicao_emissor = exposicao_por_emissor(req.posicoes, req.catalog)
    scored: list[dict] = []
    motivos_count: dict[str, int] = {}
    motivos_contexto: dict[str, dict] = {}

    for p in req.catalog:
        ok, motivo = passa_filtro(
            req.cliente, req.suitability, exposicao_emissor, req.posicoes, p
        )
        if not ok:
            if motivo == "inativo":
                continue
            motivos_count[motivo] = motivos_count.get(motivo, 0) + 1
            if motivo == "concentracao_emissor" and motivo not in motivos_contexto:
                exp = exposicao_emissor.get(p.emissor, 0.0)
                pct = (
                    round(100 * exp / req.cliente.patrimonio)
                    if req.cliente.patrimonio > 0
                    else 0
                )
                motivos_contexto[motivo] = {
                    "emissor": p.emissor,
                    "pctPatrimonio": pct,
                }
            continue
        scored.append(_pontuar(req, p, exposicao_emissor))

    scored.sort(key=lambda s: s["score"], reverse=True)

    descartados = [
        {
            "motivo": m,
            "count": motivos_count[m],
            **({"contexto": motivos_contexto[m]} if m in motivos_contexto else {}),
        }
        for m in PRIORIDADE_MOTIVOS
        if m in motivos_count
    ]

    return scored[:n], descartados, len(req.catalog)
```

- [ ] **Step 4: Compilar**

```powershell
& "apps\ai-engine\.venv\Scripts\python.exe" -m py_compile apps\ai-engine\src\rules.py
```

Expected: silêncio (zero exit).

- [ ] **Step 5: Confirmar que `score_produto` não tem mais caller**

```powershell
```

Use the Grep tool (não shell): pattern `score_produto`, path `apps/`. Espera-se: zero ocorrências fora do próprio `rules.py` (e mesmo lá, nenhuma definição sobrando, já que removemos). Se aparecer caller em outro lugar, restaurar `score_produto` como wrapper que chama `passa_filtro` + `_pontuar`.

- [ ] **Step 6: Sugerir commit**

```bash
git add apps/ai-engine/src/rules.py
git commit -m "refactor(ai-engine): split scoring from filter, return descartados aggregate"
```

⚠️ Aguardar aprovação.

---

### Task 3: `main.py` consome tupla e popula response

**Files:**
- Modify: `apps/ai-engine/src/main.py`

- [ ] **Step 1: Bump ENGINE_VERSION**

Trocar linha `ENGINE_VERSION = "rule-engine-py-v1.2"` (linha 14) por:

```python
ENGINE_VERSION = "rule-engine-py-v1.3"
```

- [ ] **Step 2: Atualizar `recommend` pra consumir tupla**

Substituir o corpo de `recommend` por:

```python
@app.post("/recommend", response_model=RecommendResponse)
def recommend(req: RecommendRequest) -> RecommendResponse:
    """
    Recebe contexto do cliente + catálogo. Devolve top-N recomendações
    com score, justificativa em pt-BR, payload de auditoria, e o
    breakdown agregado dos descartes.
    """
    scoreds, descartados, total = top_recomendacoes(req, req.topN)
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
        engineVersion=ENGINE_VERSION,
    )
```

(Mudança: assina tupla, passa `descartados` e `totalAnalisados` no return.)

- [ ] **Step 3: Compilar**

```powershell
& "apps\ai-engine\.venv\Scripts\python.exe" -m py_compile apps\ai-engine\src\main.py
```

Expected: silêncio.

- [ ] **Step 4: Confirmar que uvicorn recarregou (hot reload)**

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8000/health" -TimeoutSec 3
```

Expected:

```
status engine
------ ------
ok     rule-engine-py-v1.3
```

Se `engine` ainda mostrar `v1.2`, reiniciar uvicorn manualmente.

- [ ] **Step 5: Sugerir commit**

```bash
git add apps/ai-engine/src/main.py
git commit -m "feat(ai-engine): /recommend returns descartados + totalAnalisados, version v1.3"
```

⚠️ Aguardar aprovação.

---

### Task 4: Validação backend — 3 cenários no ai-engine

**Files:**
- Create (temporário): `apps/ai-engine/test_descartados.py`

- [ ] **Step 1: Criar script de validação**

```python
"""Validação manual dos descartados — deletar após confirmar verde."""
import json
import urllib.request


def call(payload):
    req = urllib.request.Request(
        "http://127.0.0.1:8000/recommend",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=5) as r:
        return json.loads(r.read())


# Catálogo enxuto cobrindo as 4 condições de filtro
CATALOG = [
    # 0: agressivo, risco alto, BTG Asset (vai pegar concentracao_emissor)
    {"id": "a1", "nome": "Multimercado BTG", "emissor": "BTG Pactual Asset",
     "categoria": "FUNDOS", "rentabilidadeAno": 14.0, "risco": 4,
     "perfilMinimo": "AGRESSIVO", "liquidez": "D+30", "taxaAdmin": 2.0,
     "tributacao": "TRIBUTADO", "ativo": True},
    {"id": "a2", "nome": "FIA BTG", "emissor": "BTG Pactual Asset",
     "categoria": "FUNDOS", "rentabilidadeAno": 16.0, "risco": 4,
     "perfilMinimo": "AGRESSIVO", "liquidez": "D+30", "taxaAdmin": 2.0,
     "tributacao": "TRIBUTADO", "ativo": True},
    # 2-3: arrojados (vão pegar perfil_incompativel pra cliente conservador)
    {"id": "b1", "nome": "Vinci Long Bias", "emissor": "Vinci Partners",
     "categoria": "FUNDOS", "rentabilidadeAno": 15.0, "risco": 4,
     "perfilMinimo": "ARROJADO", "liquidez": "D+30", "taxaAdmin": 1.8,
     "tributacao": "TRIBUTADO", "ativo": True},
    {"id": "b2", "nome": "XP Top Stocks", "emissor": "XP Asset",
     "categoria": "FUNDOS", "rentabilidadeAno": 17.5, "risco": 4,
     "perfilMinimo": "ARROJADO", "liquidez": "D+30", "taxaAdmin": 2.0,
     "tributacao": "TRIBUTADO", "ativo": True},
    # 4: rf conservadora (sempre passa)
    {"id": "c1", "nome": "CDB Itau", "emissor": "Itaú Unibanco",
     "categoria": "RENDA_FIXA", "rentabilidadeAno": 12.5, "risco": 1,
     "perfilMinimo": "CONSERVADOR", "liquidez": "D+1", "taxaAdmin": None,
     "tributacao": "TRIBUTADO", "ativo": True},
]


# Cenário 1 — Felipe-like (AGRESSIVO 79% em BTG Asset)
print("=== 1. Cliente concentrado em BTG Pactual Asset ===")
out = call({
    "cliente": {"id": "c1", "nome": "Felipe", "perfil": "AGRESSIVO",
                "patrimonio": 10_000_000},
    "suitability": {"perfilCalculado": "AGRESSIVO", "horizonteAnos": 10,
                    "toleranciaPerda": 30},
    "posicoes": [{"produtoId": "a1", "categoria": "FUNDOS",
                  "valor": 7_900_000}],
    "catalog": CATALOG, "topN": 3,
})
print(f"engineVersion: {out['engineVersion']}")
print(f"totalAnalisados: {out['totalAnalisados']}")
for d in out["descartados"]:
    print(f"  - {d}")
assert out["engineVersion"] == "rule-engine-py-v1.3"
assert out["totalAnalisados"] == len(CATALOG)
conc = next((d for d in out["descartados"]
             if d["motivo"] == "concentracao_emissor"), None)
assert conc is not None, "esperava concentracao_emissor"
assert conc["contexto"]["emissor"] == "BTG Pactual Asset"
assert conc["contexto"]["pctPatrimonio"] == 79
print("  ✓ concentracao_emissor com contexto correto\n")

# Cenário 2 — Bianca-like (CONSERVADORA, 100% Tesouro)
print("=== 2. Cliente CONSERVADORA ===")
out = call({
    "cliente": {"id": "c2", "nome": "Bianca", "perfil": "CONSERVADOR",
                "patrimonio": 1_800_000},
    "suitability": {"perfilCalculado": "CONSERVADOR", "horizonteAnos": 3,
                    "toleranciaPerda": 10},
    "posicoes": [],
    "catalog": CATALOG, "topN": 3,
})
for d in out["descartados"]:
    print(f"  - {d}")
perfil = next((d for d in out["descartados"]
               if d["motivo"] == "perfil_incompativel"), None)
assert perfil is not None and perfil["count"] >= 2, \
    "esperava perfil_incompativel >= 2"
print("  ✓ perfil_incompativel cortou os arrojados/agressivos\n")

# Cenário 3 — Tolerância baixíssima (risk_fit corta todo mundo de risco > 1)
print("=== 3. Cliente AGRESSIVO com toleranciaPerda=3 ===")
out = call({
    "cliente": {"id": "c3", "nome": "Teste", "perfil": "AGRESSIVO",
                "patrimonio": 5_000_000},
    "suitability": {"perfilCalculado": "AGRESSIVO", "horizonteAnos": 10,
                    "toleranciaPerda": 3},
    "posicoes": [],
    "catalog": CATALOG, "topN": 3,
})
for d in out["descartados"]:
    print(f"  - {d}")
risco = next((d for d in out["descartados"]
              if d["motivo"] == "risco_alem_tolerancia"), None)
assert risco is not None and risco["count"] >= 3, \
    "esperava risco_alem_tolerancia >= 3"
print("  ✓ risco_alem_tolerancia ativo\n")

print("Todos os cenários passaram ✓")
```

- [ ] **Step 2: Executar o script**

```powershell
Set-Location "C:\Users\TI Tntfit 1\Documents\crm-prototipo\apps\ai-engine"
& ".\.venv\Scripts\python.exe" test_descartados.py
```

Expected: 3 cenários impressos, todos com checkmark, mensagem final "Todos os cenários passaram ✓".

Se algum `assert` falhar, NÃO seguir — debugar `rules.py` ou `main.py`.

- [ ] **Step 3: Limpar o script (descartável)**

```powershell
Remove-Item "apps\ai-engine\test_descartados.py"
```

- [ ] **Step 4: Confirmar working tree limpo**

```powershell
git status
```

Expected: apenas mudanças em `apps/ai-engine/src/*.py` (já staged ou unstaged). `test_descartados.py` não deve aparecer (removido).

---

## Phase 2 — NestJS

### Task 5: Tipos em `ai-engine.service.ts`

**Files:**
- Modify: `apps/api/src/recomendacoes/ai-engine.service.ts`

- [ ] **Step 1: Adicionar tipo AiEngineDescarte e expandir AiEngineResponse**

Depois do tipo `AiEngineRecomendacao` (linha ~53), adicionar:

```ts
export type AiEngineDescarte = {
  motivo:
    | 'perfil_incompativel'
    | 'concentracao_emissor'
    | 'risco_alem_tolerancia'
    | 'ja_sobrealocado';
  count: number;
  contexto?: { emissor?: string; pctPatrimonio?: number };
};
```

Modificar `AiEngineResponse` (já existe) pra:

```ts
export type AiEngineResponse = {
  recomendacoes: AiEngineRecomendacao[];
  descartados: AiEngineDescarte[];
  totalAnalisados: number;
  engineVersion: string;
};
```

- [ ] **Step 2: Confirmar typecheck (hot reload do NestJS roda)**

```powershell
Get-Content "C:\Users\TITNTF~2\AppData\Local\Temp\claude\c--Users-TI-Tntfit-1-Documents-crm-prototipo\*\tasks\*.output" -Tail 5 -ErrorAction SilentlyContinue
```

(Ou checar terminal onde rodou `npm run dev -w @crm/api`.)

Expected: `Found 0 errors. Watching for file changes.` Nenhum erro de tipo.

Se NestJS reclamar (improvável — só está adicionando campos), corrigir antes de seguir.

- [ ] **Step 3: Sugerir commit**

```bash
git add apps/api/src/recomendacoes/ai-engine.service.ts
git commit -m "feat(api): expand AiEngineResponse with descartados + totalAnalisados"
```

⚠️ Aguardar aprovação.

---

### Task 6: Injetar campos no payload em `recomendacoes.service.ts`

**Files:**
- Modify: `apps/api/src/recomendacoes/recomendacoes.service.ts`

- [ ] **Step 1: Adicionar 2 chaves no payload do `generate()`**

Localizar o bloco `payload: { ... }` dentro do `.map` em `generate()` (linhas ~52-71). Trocar:

```ts
            payload: {
              fatores: r.fatores,
              pesos: r.pesos,
              contribs: r.contribs,
              geradoPor: result.engineVersion,
            } as Prisma.InputJsonValue,
```

Por:

```ts
            payload: {
              fatores: r.fatores,
              pesos: r.pesos,
              contribs: r.contribs,
              geradoPor: result.engineVersion,
              descartadosDaRodada: result.descartados,
              totalAnalisados: result.totalAnalisados,
            } as Prisma.InputJsonValue,
```

(Mesmo objeto coletivo em cada Recomendacao da rodada — redundância proposital.)

- [ ] **Step 2: Confirmar typecheck**

NestJS hot-reload. Confirmar log "Found 0 errors".

- [ ] **Step 3: Sugerir commit**

```bash
git add apps/api/src/recomendacoes/recomendacoes.service.ts
git commit -m "feat(api): persist descartadosDaRodada + totalAnalisados in payload"
```

⚠️ Aguardar aprovação.

---

### Task 7: Validação end-to-end via NestJS

**Files:** nenhum

- [ ] **Step 1: Login e gerar recomendação pro Felipe**

```powershell
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
Invoke-RestMethod -Uri "http://127.0.0.1:3333/api/auth/login" -Method Post `
  -ContentType "application/json" `
  -Body '{"email":"joao.diniz@capitalelite.com.br","password":"Senha123!"}' `
  -WebSession $session | Out-Null

$clientes = Invoke-RestMethod -Uri "http://127.0.0.1:3333/api/clientes" -WebSession $session
$felipe = $clientes.data | Where-Object { $_.nome -like "Felipe*" }

$gen = Invoke-RestMethod -Uri "http://127.0.0.1:3333/api/recomendacoes/generate" `
  -Method Post -ContentType "application/json" `
  -Body ('{"clienteId":"' + $felipe.id + '","topN":3}') -WebSession $session

$first = $gen.recomendacoes[0]
Write-Output "engineVersion: $($first.payload.geradoPor)"
Write-Output "totalAnalisados: $($first.payload.totalAnalisados)"
Write-Output "descartadosDaRodada:"
$first.payload.descartadosDaRodada | ConvertTo-Json -Depth 5
```

Expected:
- `engineVersion: rule-engine-py-v1.3`
- `totalAnalisados: 15`
- `descartadosDaRodada` é um array com `motivo`, `count`, e (pra concentracao_emissor) `contexto`. Pelo menos 1 entrada com `motivo: "concentracao_emissor"`, `contexto.emissor: "BTG Pactual Asset"`, `contexto.pctPatrimonio` ~79.

Se algum campo vier `null` ou ausente, debugar `recomendacoes.service.ts` ou rastrear o response do `ai-engine.service.ts`.

- [ ] **Step 2: Confirmar persistência no DB**

```powershell
$first.payload.descartadosDaRodada.Count
```

Expected: número > 0 (pelo menos 1 motivo). Se quiser conferir direto no DB:

```powershell
& "node_modules\.bin\prisma" studio --schema=apps\api\prisma\schema.prisma
```

Abre Prisma Studio no navegador — abrir a tabela `recomendacoes`, ver a coluna `payload` da Recomendacao mais recente, conferir as 2 chaves novas.

---

## Phase 3 — Frontend

### Task 8: Tipos em `apps/web/src/types/api.ts`

**Files:**
- Modify: `apps/web/src/types/api.ts`

- [ ] **Step 1: Adicionar tipos novos**

Depois de `FatorRecomendacao` (linhas ~183-188) adicionar:

```ts
export type MotivoDescarte =
  | "perfil_incompativel"
  | "concentracao_emissor"
  | "risco_alem_tolerancia"
  | "ja_sobrealocado";

export type DescarteAgregado = {
  motivo: MotivoDescarte;
  count: number;
  contexto?: { emissor?: string; pctPatrimonio?: number };
};
```

- [ ] **Step 2: Estender Recomendacao.payload**

No tipo `Recomendacao` (linhas ~190-218), no bloco `payload`, adicionar duas chaves opcionais:

```ts
  payload: {
    fatores?: Record<FatorRecomendacao, number>;
    pesos?: Record<FatorRecomendacao, number>;
    contribs?: { fator: FatorRecomendacao; contrib: number; frase: string }[];
    geradoPor?: string;
    descartadosDaRodada?: DescarteAgregado[];
    totalAnalisados?: number;
    [k: string]: unknown;
  };
```

- [ ] **Step 3: Confirmar typecheck no Next.js**

Next.js hot-reload (dev server) imprime erros de tipo em runtime no console do navegador, mas também no terminal. Confirmar sem `error TS`.

```powershell
Get-Content "C:\Users\TITNTF~2\AppData\Local\Temp\claude\c--Users-TI-Tntfit-1-Documents-crm-prototipo\*\tasks\*.output" -Tail 10 -ErrorAction SilentlyContinue
```

Expected: nenhum erro.

- [ ] **Step 4: Sugerir commit**

```bash
git add apps/web/src/types/api.ts
git commit -m "feat(web): add MotivoDescarte/DescarteAgregado and extend Recomendacao.payload"
```

⚠️ Aguardar aprovação.

---

### Task 9: Steps reativos no `ThinkingDialog`

**Files:**
- Modify: `apps/web/src/components/thinking-dialog.tsx`

- [ ] **Step 1: Adicionar imports e helper de formatação**

No topo, na lista de imports do `@/types/api`:

```ts
import type {
  DescarteAgregado,
  GenerateResult,
  MotivoDescarte,
} from "@/types/api";
```

Logo após a definição de `ThinkingClienteInput` (antes do `Props`), adicionar:

```ts
const motivoLabel: Record<MotivoDescarte, string> = {
  perfil_incompativel: "perfil incompatível",
  concentracao_emissor: "concentração",  // formatado especial via contexto
  risco_alem_tolerancia: "risco além da tolerância",
  ja_sobrealocado: "já sobrealocado",
};

function formatarDescarte(d: DescarteAgregado[] | undefined): string {
  if (!d || d.length === 0) return "Aplicando filtros…";
  const total = d.reduce((acc, x) => acc + x.count, 0);
  const partes = d.map((x) =>
    x.motivo === "concentracao_emissor" && x.contexto?.emissor
      ? `${x.count} em ${x.contexto.emissor}${
          x.contexto.pctPatrimonio !== undefined
            ? ` (${x.contexto.pctPatrimonio}%)`
            : ""
        }`
      : `${x.count} ${motivoLabel[x.motivo]}`,
  );
  return `Filtrei ${total}: ${partes.join(" · ")}`;
}
```

- [ ] **Step 2: Reescrever a construção dos `steps` pra usar o result**

Substituir o array hardcoded `steps` (linhas ~78-86, atual `"Comparando contra catálogo BTG (10 produtos)"` etc) por:

```ts
  const primeiroNome = cliente.nome.split(" ")[0];

  // Dados frescos do result quando chegar — fallbacks razoáveis enquanto null
  const firstPayload = result?.recomendacoes[0]?.payload;
  const total = firstPayload?.totalAnalisados ?? 15;
  const descartados = firstPayload?.descartadosDaRodada;
  const geradas = result?.geradas ?? 3;

  const descarteResumo =
    descartados && descartados.length === 0
      ? `Todos os ${total} produtos passaram pelos filtros`
      : formatarDescarte(descartados);

  const steps = [
    `Carregando dados de ${primeiroNome}…`,
    cliente.posicoesCount !== undefined
      ? `Mapeando carteira atual (${fmt.brl(cliente.patrimonio)} em ${cliente.posicoesCount} posições)`
      : `Mapeando carteira atual (${fmt.brl(cliente.patrimonio)})`,
    `Comparando contra ${total} produtos do catálogo`,
    descarteResumo,
    `Selecionei o top ${geradas} e escrevi a justificativa em pt-BR`,
  ];
```

(Mudou: step 3 usa `total` em vez de hardcoded "10"; step 4 mostra o resumo de descartados; step 5 usa `geradas`.)

- [ ] **Step 3: Salvar e checar no navegador**

Next.js faz fast refresh. Abrir http://localhost:3000, login, ir num cliente, clicar "Gerar nova". Confirmar que:
- Step 3 mostra "Comparando contra 15 produtos do catálogo" (ou número correto).
- Step 4 começa com "Aplicando filtros…" e troca pra "Filtrei N: ..." quando o response chega.
- Animação não trava.

Se step 4 ficar congelado no placeholder, debugar — provavelmente o `payload` não chegou no resultado (`result?.recomendacoes[0]?.payload` undefined).

- [ ] **Step 4: Sugerir commit**

```bash
git add apps/web/src/components/thinking-dialog.tsx
git commit -m "feat(web): reactive thinking steps with descartados breakdown"
```

⚠️ Aguardar aprovação.

---

### Task 10: Accordion no `RecomendacaoCard`

**Files:**
- Modify: `apps/web/src/components/recomendacao-card.tsx`

- [ ] **Step 1: Importar tipos novos**

Na lista de imports do `@/types/api`, adicionar `DescarteAgregado` e `MotivoDescarte`:

```ts
import type {
  DescarteAgregado,
  FatorRecomendacao,
  MotivoDescarte,
  PerfilInvestidor,
  Recomendacao,
  StatusRecomendacao,
} from "@/types/api";
```

- [ ] **Step 2: Adicionar map de labels (próximo dos outros maps no topo)**

Próximo ao `fatorLabel`, adicionar:

```ts
const motivoLabelCard: Record<MotivoDescarte, string> = {
  perfil_incompativel: "Perfil incompatível",
  concentracao_emissor: "Concentração",
  risco_alem_tolerancia: "Risco além da tolerância",
  ja_sobrealocado: "Já sobrealocado",
};

function formatarMotivoCard(d: DescarteAgregado): string {
  if (d.motivo === "concentracao_emissor" && d.contexto?.emissor) {
    return `${motivoLabelCard.concentracao_emissor} em ${d.contexto.emissor}${
      d.contexto.pctPatrimonio !== undefined ? ` (${d.contexto.pctPatrimonio}%)` : ""
    }`;
  }
  return motivoLabelCard[d.motivo];
}
```

- [ ] **Step 3: Adicionar state e renderização do accordion**

No corpo do `RecomendacaoCard`, próximo do `const [expanded, setExpanded] = useState(false);`, adicionar:

```ts
  const [descartadosExpanded, setDescartadosExpanded] = useState(false);
  const descartados = r.payload?.descartadosDaRodada;
  const totalDescartados = descartados?.reduce((acc, d) => acc + d.count, 0) ?? 0;
```

E, dentro do `<CardContent>`, **depois** do bloco "Detalhes (expansível) — só pra recomendações geradas pelo engine" (que termina próximo à linha 220 ou onde o accordion de fatores acaba), adicionar:

```tsx
          {/* Descartados (expansível) — só pra recomendações com payload.descartadosDaRodada */}
          {descartados && descartados.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setDescartadosExpanded((v) => !v)}
                className="w-full flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <span>Por que descartei {totalDescartados} produtos</span>
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 transition-transform",
                    descartadosExpanded && "rotate-180",
                  )}
                />
              </button>

              {descartadosExpanded && (
                <div className="space-y-1.5 pt-3 border-t">
                  {descartados.map((d) => (
                    <div
                      key={d.motivo}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="text-foreground/80">
                        {formatarMotivoCard(d)}
                      </span>
                      <span className="font-medium tabular-nums">{d.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
```

(Mesmo padrão visual do accordion de fatores logo acima.)

- [ ] **Step 4: Confirmar visual no navegador**

Fast refresh recarrega. Abrir uma recomendação recente (gerada após v1.3) pelo dialog de detalhe ou na listagem. Confirmar:
- Aparece o botão "Por que descartei N produtos" abaixo de "Como cheguei nisso".
- Click expande mostrando lista de motivos com counts.
- Click de novo recolhe.

Pra recomendação antiga (sem `descartadosDaRodada` no payload), o accordion **não aparece**. Sem erro no console.

- [ ] **Step 5: Sugerir commit**

```bash
git add apps/web/src/components/recomendacao-card.tsx
git commit -m "feat(web): add 'Por que descartei N' accordion to RecomendacaoCard"
```

⚠️ Aguardar aprovação.

---

## Phase 4 — Validação manual final e bundle

### Task 11: Validação manual end-to-end no navegador

**Files:** nenhum

- [ ] **Step 1: Limpar recomendações antigas pra contraste**

(Opcional — só pra demo brilhar.) Logar como admin, ir na tela de recomendações, observar quais são "Pendente" vs "Aprovada". Não precisa apagar — só ter o cenário.

- [ ] **Step 2: Gerar nova recomendação pro Felipe (cliente concentrado)**

1. Logar em http://localhost:3000 como `joao.diniz@capitalelite.com.br` / `Senha123!`.
2. Navegar pra Recomendações → clicar "Gerar nova".
3. Selecionar **Felipe Okabe** e confirmar.

Verificar na animação:

- ✅ Step 3: "Comparando contra **15** produtos do catálogo" (não 10).
- ✅ Step 4: começa com "Aplicando filtros…" e logo troca pra algo como:
  > Filtrei 12: 7 perfil incompatível · 3 em **BTG Pactual Asset (79%)** · 2 risco além da tolerância

  (Os números exatos dependem do estado atual; o importante é a frase ESTAR formada com a parte de concentração no meio.)

- ✅ Step 5: "Selecionei o top 3 e escrevi a justificativa em pt-BR" termina com check.

- ✅ Toast aparece com "3 recomendações geradas para Felipe Okabe…" e fecha o dialog.

- [ ] **Step 3: Abrir uma das recomendações geradas e expandir o accordion**

Na listagem, clicar numa recomendação **PENDENTE** recém-gerada. Dialog de detalhe abre. No card:

- ✅ Justificativa em pt-BR coerente.
- ✅ Bloco "Como cheguei nisso" (já existia).
- ✅ Bloco **"Por que descartei 12 produtos"** (novo) — clicar e ver a lista:
  - Perfil incompatível — 7
  - Concentração em BTG Pactual Asset (79%) — 3
  - Risco além da tolerância — 2

- [ ] **Step 4: Confirmar graceful fallback em recomendação antiga**

Mudar pra aba "Aprovadas" (no topo da tela de Recomendações). Abrir aquela do seed pra Bianca (`BTG Pactual Prev RF Crédito Privado`). No card:

- ✅ Justificativa renderiza.
- ✅ **NÃO aparece** o accordion "Por que descartei…" (payload antigo não tem `descartadosDaRodada`).
- ✅ Console do navegador sem erros.

- [ ] **Step 5: Confirmar versão no DB**

```powershell
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
Invoke-RestMethod -Uri "http://127.0.0.1:3333/api/auth/login" -Method Post `
  -ContentType "application/json" `
  -Body '{"email":"joao.diniz@capitalelite.com.br","password":"Senha123!"}' `
  -WebSession $session | Out-Null
$recs = Invoke-RestMethod -Uri "http://127.0.0.1:3333/api/recomendacoes?status=PENDENTE&limit=10" -WebSession $session
$recs.data[0].payload.geradoPor
```

Expected: `rule-engine-py-v1.3`.

---

### Task 12: Bundle final e proposta de commit

**Files:** nenhum

- [ ] **Step 1: Listar todos os arquivos modificados**

```powershell
git status
git diff --stat HEAD
```

Expected (se não foi commitando ao longo do caminho — modo bundle único):

```
apps/ai-engine/src/main.py                                | ~20 +-
apps/ai-engine/src/models.py                              | ~25 ++
apps/ai-engine/src/rules.py                               | ~70 +-
apps/api/src/recomendacoes/ai-engine.service.ts           | ~15 +-
apps/api/src/recomendacoes/recomendacoes.service.ts       | ~3 +
apps/web/src/components/recomendacao-card.tsx             | ~50 +-
apps/web/src/components/thinking-dialog.tsx               | ~40 +-
apps/web/src/types/api.ts                                 | ~15 +-
docs/superpowers/plans/2026-05-27-painel-descartados.md   | NEW
docs/superpowers/specs/2026-05-27-painel-descartados-design.md | NEW
```

- [ ] **Step 2: Apresentar diff resumido pro usuário e perguntar formato do commit**

Perguntar:
- (a) Um único commit `feat: painel "por que descartei N produtos" (engine v1.3)` — bundle.
- (b) Múltiplos commits seguindo as sugestões de cada Task (mais granular).
- (c) Não commitar agora.

Aguardar resposta.

- [ ] **Step 3: Executar commit conforme escolha do usuário**

Se (a):

```bash
git add apps/ai-engine apps/api apps/web docs/superpowers
git commit -m "$(cat <<'EOF'
feat: painel "por que descartei N produtos" (engine v1.3)

Expõe na animação do ThinkingDialog e no card de recomendação o
breakdown agregado dos produtos descartados pelo motor: contagem
por motivo (perfil_incompativel, concentracao_emissor,
risco_alem_tolerancia, ja_sobrealocado), com contexto enriquecido
de emissor + % do patrimônio pra concentração.

- Engine bumpa pra rule-engine-py-v1.3; /recommend devolve
  `descartados[]` agregados + `totalAnalisados`.
- Refactor de top_recomendacoes pra retornar tupla
  (scored, descartados, total) sem chamar passa_filtro duas vezes.
- NestJS persiste em payload.descartadosDaRodada + payload.totalAnalisados.
- ThinkingDialog mostra resumo dinâmico no passo 4 da animação.
- RecomendacaoCard ganha accordion "Por que descartei N produtos"
  abaixo de "Como cheguei nisso", com graceful fallback pra
  recomendações antigas (sem o campo no payload).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

Se (b): rodar os git add + git commit das Tasks 1, 2, 3, 5, 6, 8, 9, 10 — nessa ordem.

Se (c): só `git status` pra mostrar onde está.

---

## Self-Review (skill checklist)

**1. Spec coverage:**

| Spec section | Coberto por task |
|---|---|
| Engine /recommend response shape | Tasks 1, 3 |
| Pydantic models | Task 1 |
| Refactor de top_recomendacoes + _pontuar | Task 2 |
| main.py bump version + tuple | Task 3 |
| NestJS AiEngineResponse | Task 5 |
| NestJS payload injection | Task 6 |
| Front types | Task 8 |
| ThinkingDialog steps reativos + formatarDescarte | Task 9 |
| RecomendacaoCard accordion | Task 10 |
| Edge case: descartados vazio | Task 9 step 2 (`length === 0` branch) |
| Edge case: payload antigo | Task 10 step 3 (`descartados && length > 0`) |
| Validação backend 1-3 (cenários Felipe/Bianca/baixa tolerância) | Task 4 |
| Validação backend 4 (NestJS payload) | Task 7 |
| Validação front 5-8 (browser manual) | Task 11 |
| Engine version v1.3 nos dois lugares (main.py + models.py) | Tasks 1 + 3 |
| Documentação | Specs e plan files já criados |

Nenhum gap.

**2. Placeholder scan:** Plano não tem TBDs, TODOs, "fill in", "similar to Task N" sem código, ou validações sem comando exato. ✓

**3. Type consistency:** `MotivoDescarte` Literal/union batem (Python `Literal[...]` ↔ TS `| union`). `DescarteAgregado` shape idêntico nos 3 lados (Python BaseModel, NestJS type, TS type). `descartadosDaRodada` é o nome do campo do payload em todos os lugares (não `descartadosRodada` ou outras variações). `totalAnalisados` idem. ✓

---

## Execution Handoff

Plano completo salvo em [docs/superpowers/plans/2026-05-27-painel-descartados.md](docs/superpowers/plans/2026-05-27-painel-descartados.md).
