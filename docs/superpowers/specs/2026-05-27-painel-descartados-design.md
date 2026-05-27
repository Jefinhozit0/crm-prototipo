# Painel "por que descartei N produtos" — Design

**Data:** 2026-05-27
**Projeto:** Capital Elite (CRM de wealth management) — apps/ai-engine + apps/api + apps/web
**Status:** spec — aguarda revisão do usuário antes de virar plano de implementação

## Objetivo

Expor, na experiência de geração de recomendação, o trabalho **invisível** do motor de IA: além dos top-N produtos recomendados, mostrar quantos produtos foram descartados e por quê. Transforma a IA de "caixa preta que cospe top 3" em "consultor que mostra o raciocínio" — talking point central da demo BTG-tier.

Toda a lógica de filtro **já existe** no motor Python (`passa_filtro` em `apps/ai-engine/src/rules.py` retorna `(bool, motivo)`). O que falta é expor essa informação no contrato, propagar pelo NestJS, e renderizar no front.

## Princípios de design

1. **Aditivo, não disruptivo** — nenhum campo existente é removido ou renomeado. Recomendações antigas continuam funcionando.
2. **Persistir o raciocínio** — descartados ficam no `payload` da Recomendacao no Postgres, não só na memória. Compliance, auditoria, e setup pra ML real (Grupo C eventual).
3. **Wow factor no momento da geração** — o destaque visual é a animação do `ThinkingDialog`, onde o passo 4 revela o breakdown.
4. **Graceful fallback** — recomendações antigas (geradas em v1.2 ou anterior, sem campos novos) renderizam sem erro, sem o accordion.

## Decisões já tomadas (perguntas respondidas)

- **Onde aparece:** durante o thinking (animação) **e** persistido no card (accordion expandível).
- **Granularidade:** resumo agregado por motivo, não lista produto-por-produto.
- **Contrato:** engine devolve `descartados[]` agregados (abordagem A discutida); não devolve lista bruta produto-por-produto (abordagem B descartada) nem recomputa no front (abordagem C descartada).
- **Persistência:** sim, no `payload.descartadosDaRodada` da Recomendacao. Mesmo objeto coletivo em cada uma das top-3 da rodada (redundância proposital, simples).

## Arquitetura

Mudança em três camadas, aditiva:

```
Python /recommend → adiciona "descartados" + "totalAnalisados" no response
                    bump engineVersion → "rule-engine-py-v1.3"
       ↓
NestJS            → propaga em payload.descartadosDaRodada e payload.totalAnalisados
                    de cada Recomendacao criada
       ↓
Next.js           → ThinkingDialog mostra resumo na animação (passo 4 dinâmico)
                    RecomendacaoCard mostra accordion retroativo
```

## Contrato

### Engine `/recommend` response (campos novos)

```json
{
  "recomendacoes": [...],
  "descartados": [
    { "motivo": "perfil_incompativel", "count": 7 },
    {
      "motivo": "concentracao_emissor",
      "count": 3,
      "contexto": { "emissor": "BTG Pactual Asset", "pctPatrimonio": 79 }
    },
    { "motivo": "risco_alem_tolerancia", "count": 2 }
  ],
  "totalAnalisados": 15,
  "engineVersion": "rule-engine-py-v1.3"
}
```

**Motivos enum (4):**

- `perfil_incompativel`
- `concentracao_emissor` — único motivo que recebe `contexto: { emissor, pctPatrimonio }`
- `risco_alem_tolerancia`
- `ja_sobrealocado`

O motivo `inativo` que `passa_filtro` retorna fica **fora** do agregado (não é decisão de scoring; produtos inativos nem chegam ao engine via filtro do NestJS).

**Ordem fixa** retornada pelo motor: `perfil → concentracao → risco → sobrealocado`. Conta a história em ordem narrativa decrescente de impacto. Front consome sem reordenar.

### NestJS — Recomendacao.payload

Cada Recomendacao da rodada recebe o **mesmo objeto coletivo**:

```ts
payload: {
  fatores: {...},
  pesos: {...},
  contribs: [...],
  geradoPor: "rule-engine-py-v1.3",
  descartadosDaRodada: [...],   // novo
  totalAnalisados: 15            // novo
}
```

### Pydantic models (`apps/ai-engine/src/models.py`)

```python
MotivoDescarte = Literal[
    "perfil_incompativel", "concentracao_emissor",
    "risco_alem_tolerancia", "ja_sobrealocado",
]

class DescarteContexto(BaseModel):
    emissor: str | None = None
    pctPatrimonio: int | None = None

class DescarteAgregado(BaseModel):
    motivo: MotivoDescarte
    count: int
    contexto: DescarteContexto | None = None

class RecommendResponse(BaseModel):
    recomendacoes: list[RecomendacaoOut]
    descartados: list[DescarteAgregado] = []
    totalAnalisados: int = 0
    engineVersion: str = "rule-engine-py-v1.3"
```

### TypeScript (`apps/web/src/types/api.ts`)

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

// Em Recomendacao.payload — opcionais pra graceful fallback:
descartadosDaRodada?: DescarteAgregado[];
totalAnalisados?: number;
```

### NestJS service (`apps/api/src/recomendacoes/ai-engine.service.ts`)

```ts
export type AiEngineDescarte = {
  motivo: 'perfil_incompativel' | 'concentracao_emissor'
        | 'risco_alem_tolerancia' | 'ja_sobrealocado';
  count: number;
  contexto?: { emissor?: string; pctPatrimonio?: number };
};

export type AiEngineResponse = {
  recomendacoes: AiEngineRecomendacao[];
  descartados: AiEngineDescarte[];
  totalAnalisados: number;
  engineVersion: string;
};
```

## Motor Python — refactor de `top_recomendacoes`

Hoje, `passa_filtro` é chamado dentro de `score_produto`, e produtos filtrados viram `None`. Vou separar: `top_recomendacoes` chama `passa_filtro` direto, agrega os motivos, e quem passa segue pra um helper de scoring.

```python
PRIORIDADE_MOTIVOS = [
    "perfil_incompativel",
    "concentracao_emissor",
    "risco_alem_tolerancia",
    "ja_sobrealocado",
]

def top_recomendacoes(req, n=3) -> tuple[list[dict], list[dict], int]:
    exposicao_emissor = exposicao_por_emissor(req.posicoes, req.catalog)
    scored: list[dict] = []
    motivos_count: dict[str, int] = {}
    motivos_contexto: dict[str, dict] = {}

    for p in req.catalog:
        ok, motivo = passa_filtro(req.cliente, req.suitability,
                                  exposicao_emissor, req.posicoes, p)
        if not ok:
            if motivo == "inativo":
                continue
            motivos_count[motivo] = motivos_count.get(motivo, 0) + 1
            # primeira ocorrência de concentracao: captura emissor + pct
            if motivo == "concentracao_emissor" and motivo not in motivos_contexto:
                exp = exposicao_emissor.get(p.emissor, 0.0)
                pct = round(100 * exp / req.cliente.patrimonio) \
                    if req.cliente.patrimonio > 0 else 0
                motivos_contexto[motivo] = {
                    "emissor": p.emissor, "pctPatrimonio": pct
                }
            continue
        scored.append(_pontuar(req, p, exposicao_emissor))

    scored.sort(key=lambda s: s["score"], reverse=True)

    descartados = [
        {"motivo": m, "count": motivos_count[m],
         **({"contexto": motivos_contexto[m]} if m in motivos_contexto else {})}
        for m in PRIORIDADE_MOTIVOS if m in motivos_count
    ]
    return scored[:n], descartados, len(req.catalog)
```

Onde `_pontuar` é o `score_produto` sem o `passa_filtro` interno (assume que o produto já passou). `score_produto` antigo continua existindo só se houver outro caller; caso contrário é removido.

### `main.py`

```python
@app.post("/recommend", response_model=RecommendResponse)
def recommend(req: RecommendRequest) -> RecommendResponse:
    scoreds, descartados, total = top_recomendacoes(req, req.topN)
    exposicao_emissor = exposicao_por_emissor(req.posicoes, req.catalog)

    recomendacoes = []
    for scored in scoreds:
        preencher_frases_fator(scored, req.cliente, req.posicoes, req.suitability)
        justificativa = build_justificativa(
            scored, req.cliente, req.posicoes, req.suitability, exposicao_emissor
        )
        recomendacoes.append({
            "produtoId": scored["produto"].id,
            "produtoNome": scored["produto"].nome,
            "score": round(scored["score"], 3),
            "justificativa": justificativa,
            "fatores": scored["fatores"],
            "pesos": scored["pesos"],
            "contribs": scored["contribs"],
        })

    return RecommendResponse(
        recomendacoes=recomendacoes,
        descartados=descartados,
        totalAnalisados=total,
        engineVersion=ENGINE_VERSION,
    )
```

Bump: `ENGINE_VERSION = "rule-engine-py-v1.3"` em `main.py` e default em `models.py`.

## NestJS — `recomendacoes.service.ts`

Em `generate()`, no map que cria as Recomendacao, injetar as 2 chaves novas no `payload`:

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

`GenerateResult` (DTO do controller) **não muda** — o front lê via `recomendacao.payload.descartadosDaRodada`. Sem campo extra no top level.

## UX

### A. Durante o thinking (`ThinkingDialog` + `ThinkingSteps`)

Substituir os steps hardcoded em [thinking-dialog.tsx:78-86](apps/web/src/components/thinking-dialog.tsx) por steps construídos reativamente a partir do `result.payload`.

Steps novos (5 total, mesma quantidade — só muda o texto):

```
1. Carregando dados de Felipe…                                        ✓
2. Mapeando carteira atual (R$ 14,5 milhões em 3 posições)            ✓
3. Comparando contra 15 produtos do catálogo                          ✓
4. Filtrei 12: 7 perfil incompatível · 3 em BTG Pactual Asset (79%)   ✓
       · 2 risco além da tolerância
5. Selecionei o top 3 e escrevi a justificativa em pt-BR              ⠋ → ✓
```

- Step 3: `totalAnalisados` (fallback 15 se `result` ainda for null).
- Step 4: construído por `formatarDescarte(payload.descartadosDaRodada)`. Enquanto `result` for null, mostra placeholder `"Aplicando filtros…"`.
- Como a animação dura ~3.25s (5 × 650ms) e a mutation retorna em ~50-200ms, o texto real do step 4 já está disponível quando a animação chega lá. Sem refactor profundo do `ThinkingSteps` necessário — apenas re-render reativo.
- Cliente passado pro Dialog já tem `patrimonio` e `posicoesCount`, então step 2 fica como hoje.

Helper de formatação:

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
    x.motivo === "concentracao_emissor" && x.contexto
      ? `${x.count} em ${x.contexto.emissor} (${x.contexto.pctPatrimonio}%)`
      : `${x.count} ${motivoLabel[x.motivo]}`
  );
  return `Filtrei ${total}: ${partes.join(" · ")}`;
}
```

### B. No card de recomendação (acesso retroativo)

Em [recomendacao-card.tsx](apps/web/src/components/recomendacao-card.tsx), abaixo do bloco "Como cheguei nisso", adicionar outro accordion. Só renderiza se `payload.descartadosDaRodada?.length > 0`.

```
┌─ Por que descartei 12 produtos ─────────────────  ⌄
│
│  Perfil incompatível                            7
│  Concentração em BTG Pactual Asset (79%)        3
│  Risco além da tolerância                       2
│
└─────────────────────────────────────────────────
```

Componente novo `DescartadosAccordion` que reusa o padrão visual do "Como cheguei nisso" (Button + state expanded, lista com flex justify-between).

## Edge cases

- **`descartados = []`** (todos passaram, raro): step 4 da animação vira `"Todos os ${totalAnalisados} produtos passaram pelos filtros — selecionei top ${N} pelo score"`. Accordion retroativo não aparece.
- **Recomendação antiga em v1.2 ou seed** (`payload.descartadosDaRodada` undefined): accordion não renderiza. Animação no thinking sempre usa dados frescos (v1.3+).
- **Concentração com `patrimonio = 0`** (cliente sem patrimônio cadastrado): `pctPatrimonio = 0`. Frase do step 4 fica `"3 em BTG Pactual Asset (0%)"` — estranho mas sem erro. Caso de borda raríssimo (clientes ativos sempre têm patrimônio > 0 no seed). Pode ser melhorado depois se aparecer na prática.
- **Emissor com nome longo** (ex: "BTG Pactual Vida e Previdência"): step 4 pode quebrar em 2 linhas no DialogContent (sm:max-w-md). Aceitável — `leading-snug` já suporta.
- **Mutation demora >3s**: animação termina antes do resultado, step 5 fica spinning. Comportamento atual já lida via `lastStepCompleted`. Sem mudança.

## Validação (checklist de pronto)

### Engine (Python)

1. `py_compile` em `rules.py`, `models.py`, `main.py`, `justificativa.py` — sem erro.
2. Script ad-hoc `test_descartados.py` (descartável depois) hitando `POST http://127.0.0.1:8000/recommend` com 3 payloads:
   - **Felipe AGRESSIVO 79% em BTG Asset** → response inclui `descartados` contendo `concentracao_emissor` com `count >= 1`, `contexto.emissor = "BTG Pactual Asset"`, `pctPatrimonio = 79`.
   - **Bianca CONSERVADORA, 100% em Tesouro Nacional** → response inclui `concentracao_emissor` com `contexto.emissor = "Tesouro Nacional"`, `pctPatrimonio = 100`, e provavelmente `perfil_incompativel` com count alto.
   - **Cliente fictício com `toleranciaPerda = 3`** → response inclui `risco_alem_tolerancia` com count alto.
3. `GET /health` retorna `{"engine": "rule-engine-py-v1.3"}`.

### NestJS

4. Login + `POST /api/recomendacoes/generate` pra Felipe — cada recomendação criada tem `payload.descartadosDaRodada: DescarteAgregado[]` e `payload.totalAnalisados: number` populados corretamente.

### Front (manual, browser)

5. Subir stack, login com `joao.diniz@capitalelite.com.br` / `Senha123!`, clicar "Gerar nova" em Felipe.
6. Na animação do `ThinkingDialog`:
   - Step 3 mostra "15 produtos" (dinâmico).
   - Step 4 mostra a frase de descartados formatada corretamente, incluindo `"em BTG Pactual Asset (79%)"`.
   - Animação não trava se mutation demora.
7. Card da recomendação resultante mostra o accordion "Por que descartei N produtos" expandível, com counts/contexto corretos.
8. Abrir uma recomendação antiga (`payload.geradoPor = "rule-engine-py-v1.2"` ou seed sem campo) — accordion **não aparece**, sem erro no console.

### Critérios finais

- 4/4 ✓ nos testes 1–4 (backend automatizado).
- 5/5 ✓ nos testes 5–8 (manual browser).
- `engineVersion: "rule-engine-py-v1.3"` aparece em recomendações novas no DB.
- Recomendações antigas continuam rendering normalmente (graceful fallback).

## Arquivos tocados

| Arquivo | Mudança |
|---|---|
| `apps/ai-engine/src/models.py` | + tipos `MotivoDescarte`, `DescarteContexto`, `DescarteAgregado`; + 2 campos em `RecommendResponse`; bump engineVersion default |
| `apps/ai-engine/src/rules.py` | refactor de `top_recomendacoes` pra retornar tupla `(scored, descartados, total)`; novo `_pontuar` helper; `PRIORIDADE_MOTIVOS` const |
| `apps/ai-engine/src/main.py` | bump `ENGINE_VERSION`; recebe tupla nova; popula `RecommendResponse` |
| `apps/api/src/recomendacoes/ai-engine.service.ts` | + tipo `AiEngineDescarte`; expandir `AiEngineResponse` com 2 campos |
| `apps/api/src/recomendacoes/recomendacoes.service.ts` | injetar 2 chaves novas em `payload` no `generate()` |
| `apps/web/src/types/api.ts` | + tipos `MotivoDescarte`, `DescarteAgregado`; estender `Recomendacao.payload` com 2 chaves opcionais |
| `apps/web/src/components/thinking-dialog.tsx` | steps construídos reativamente do `result.payload`; helper `formatarDescarte` |
| `apps/web/src/components/recomendacao-card.tsx` | novo accordion `DescartadosAccordion` abaixo de "Como cheguei nisso" |

## Não está no escopo

- Painel de descartados na tela de listagem de recomendações (`apps/web/src/app/(app)/recomendacao/page.tsx`).
- Persistir descartados em tabela separada (vai dentro de `payload` mesmo).
- Visualização gráfica (radar, pie chart). Lista textual basta.
- Treinamento de ML usando descartados como feature — fica pra eventual Grupo C.
- Alteração no DB schema (`recomendacoes.payload` já é `Json`, não precisa migration).
