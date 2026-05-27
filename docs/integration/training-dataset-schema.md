# Contrato do Dataset de Treino

**Versão:** 1.0 (motor v2.0)
**Formato:** CSV UTF-8 com header. Aceita também Parquet (`.parquet`).
**Quem produz:** o CRM cliente (exportando histórico de recomendações + decisões).
**Quem consome:** `python -m src.ml.train --dataset <arquivo>` do motor.

---

## Estrutura

Cada **linha** representa **um par (cliente × produto × decisão)** numa rodada de recomendação. Volume típico esperado: ~200 a ~5.000 linhas por export.

| Coluna | Tipo | Descrição | Exemplo |
|---|---|---|---|
| `cliente_id` | string | ID interno do cliente no CRM. Não vai pra feature; usado só pra deduplicação/análise. | `cli-39281` |
| `produto_id` | string | ID interno do produto. Idem acima. | `cdb-itau-2028` |
| `decisao_em` | ISO date | Quando o assessor decidiu. Usado pra split temporal de treino/validação. | `2026-04-12` |
| **— cliente** | | | |
| `cliente_patrimonio` | float | Patrimônio total declarado (BRL). | `4350000` |
| `cliente_perfil` | enum | Perfil cadastrado. Um de: `CONSERVADOR`, `MODERADO`, `ARROJADO`, `AGRESSIVO`. | `MODERADO` |
| **— suitability (CVM 30)** | | | |
| `perfil_calculado` | enum | Perfil resultante do questionário de suitability (pode divergir do cadastrado). | `ARROJADO` |
| `horizonte_anos` | int | Horizonte declarado de investimento (anos). | `8` |
| `tolerancia_perda` | float | Tolerância a perda declarada (%, 0-100). | `15` |
| **— carteira atual** | | | |
| `num_posicoes` | int | Quantidade de posições distintas na carteira. | `5` |
| `pct_rf` | float | % do patrimônio em RENDA_FIXA (0-1). | `0.58` |
| `pct_rv` | float | % do patrimônio em RENDA_VARIAVEL (0-1). | `0.12` |
| `pct_fundos` | float | % em FUNDOS. | `0.20` |
| `pct_previdencia` | float | % em PREVIDENCIA. | `0.10` |
| `pct_estruturados` | float | % em ESTRUTURADOS. | `0.0` |
| `pct_cambio` | float | % em CAMBIO. | `0.0` |
| `top_emissor_pct` | float | % do patrimônio no emissor mais concentrado da carteira (0-1). | `0.43` |
| `emissor_alvo_match` | int | 1 se `produto_emissor` da linha == top emissor da carteira, senão 0. | `0` |
| **— produto ofertado** | | | |
| `produto_categoria` | enum | Uma de: `RENDA_FIXA`, `RENDA_VARIAVEL`, `FUNDOS`, `PREVIDENCIA`, `ESTRUTURADOS`, `CAMBIO`. | `FUNDOS` |
| `produto_risco` | int | Risco 1-5. | `4` |
| `produto_rentabilidade_ano` | float | Rentabilidade declarada (% a.a., bruta). | `15.2` |
| `produto_perfil_minimo` | enum | Perfil mínimo permitido. Mesmos valores de `cliente_perfil`. | `ARROJADO` |
| `produto_taxa_admin` | float | Taxa de administração (% a.a.). Use `0` quando não houver. | `1.8` |
| `produto_tributacao` | enum | `TRIBUTADO`, `ISENTO`, `INCENTIVADO`. | `TRIBUTADO` |
| `produto_liquidez_meses` | float | Liquidez convertida pra meses (D+30 → 1.0, Vencimento → 36.0 default). | `1.0` |
| **— label** | | | |
| `aprovado` | int | **0 ou 1.** `1` se o assessor aprovou a recomendação; `0` se recusou OU se o produto foi descartado pelo motor na mesma rodada (descartados são *implicit negatives*). | `1` |

---

## Exemplo (3 linhas)

```csv
cliente_id,produto_id,decisao_em,cliente_patrimonio,cliente_perfil,perfil_calculado,horizonte_anos,tolerancia_perda,num_posicoes,pct_rf,pct_rv,pct_fundos,pct_previdencia,pct_estruturados,pct_cambio,top_emissor_pct,emissor_alvo_match,produto_categoria,produto_risco,produto_rentabilidade_ano,produto_perfil_minimo,produto_taxa_admin,produto_tributacao,produto_liquidez_meses,aprovado
cli-39281,cdb-itau-2028,2026-04-12,4350000,MODERADO,MODERADO,8,15,5,0.58,0.12,0.20,0.10,0.0,0.0,0.43,0,RENDA_FIXA,1,12.5,CONSERVADOR,0.0,TRIBUTADO,0.033,1
cli-39281,fundo-btg-multimercado,2026-04-12,4350000,MODERADO,MODERADO,8,15,5,0.58,0.12,0.20,0.10,0.0,0.0,0.43,1,FUNDOS,4,14.2,ARROJADO,2.0,TRIBUTADO,1.0,0
cli-77104,lca-bradesco-ipca,2026-04-13,820000,CONSERVADOR,CONSERVADOR,4,8,2,1.0,0.0,0.0,0.0,0.0,0.0,1.0,0,RENDA_FIXA,1,11.8,CONSERVADOR,0.0,ISENTO,36.0,1
```

---

## Regras de qualidade

- **Sem PII**: o CSV NÃO deve conter nome, CPF, email, telefone. Só IDs internos. Hash quando necessário.
- **Encoding**: UTF-8, separador vírgula, decimais com ponto (`12.5`, não `12,5`).
- **Linhas mínimas**: 200 pra um modelo razoável; 1000+ pra confiança; 5000+ pra produção.
- **Balanceamento**: idealmente 30-70% aprovados / 30-70% recusados/descartados. Datasets muito desbalanceados são tratáveis (class_weight) mas pior.
- **Split temporal**: o treino usa as 80% mais antigas, valida nas 20% mais recentes — então `decisao_em` precisa estar correto.

---

## Como gerar do nosso seed (pra teste interno)

Enquanto não há export real, o motor fornece um **gerador sintético** que cospe nesse mesmo formato:

```bash
cd apps/ai-engine
python -m src.ml.synth --rows 3000 --out data/synth-2026q2.csv
```

Isso permite que TODO o pipeline (treino, scoring, inference) seja validado antes de ter dado real.

---

## Roadmap (não implementado ainda)

- **v1.1**: aceitar coluna opcional `recusa_motivo` (texto livre) — vira feature de NLP no futuro.
- **v1.2**: aceitar coluna opcional `valor_alocado` (BRL aprovado) — vira regressor adicional.
- **v2.0**: ingestion via REST `POST /retrain` (upload de CSV → swap atômico do modelo). Ver [roadmap-rest.md](roadmap-rest.md).
