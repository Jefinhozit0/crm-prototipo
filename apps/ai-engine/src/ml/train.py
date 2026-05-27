"""
CLI de treino do ranker LightGBM.

Aceita qualquer CSV no formato documentado em
`docs/integration/training-dataset-schema.md`. Funciona com:
  - dataset sintético gerado por `src.ml.synth`
  - export real do CRM cliente (quando disponível)

Pipeline:
  1. Lê CSV → DataFrame
  2. Converte colunas categóricas (perfil, tributação, categoria) pra códigos
  3. Split temporal: 80% mais antigas pra treino, 20% recentes pra validação
  4. Treina LightGBM com early stopping na AUC de validação
  5. Salva (model + metadata) num único .pkl via joblib
  6. Imprime métricas + feature importance

Uso:
  python -m src.ml.train --dataset data/synth-2026q2.csv \\
                         --out models/ranker-v1.pkl --version ml-ranker-v1
"""
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import joblib
import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.metrics import roc_auc_score, accuracy_score, precision_recall_fscore_support

from .features import (
    CATEGORIAS,
    FEATURE_COLUMNS,
    PERFIL_ORDEM,
    TRIBUTACAO_ORDEM,
)


# ============================================================
# Transformação CSV → matriz de features
# ============================================================


def csv_to_features(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series, pd.Series]:
    """
    Converte o CSV de treino na matriz X (FEATURE_COLUMNS), labels y, e
    timestamps t pra split temporal.

    Esta função É o contrato entre o CSV e o modelo. Se o CSV vier diferente
    da spec, falha aqui com erro descritivo (não em runtime).
    """
    required = {
        "cliente_id", "produto_id", "decisao_em", "cliente_patrimonio",
        "cliente_perfil", "perfil_calculado", "horizonte_anos",
        "tolerancia_perda", "num_posicoes", "pct_rf", "pct_rv", "pct_fundos",
        "pct_previdencia", "pct_estruturados", "pct_cambio", "top_emissor_pct",
        "emissor_alvo_match", "produto_categoria", "produto_risco",
        "produto_rentabilidade_ano", "produto_perfil_minimo",
        "produto_taxa_admin", "produto_tributacao", "produto_liquidez_meses",
        "aprovado",
    }
    missing = required - set(df.columns)
    if missing:
        raise ValueError(
            f"CSV faltando colunas obrigatórias: {sorted(missing)}. "
            f"Veja docs/integration/training-dataset-schema.md"
        )

    # Ordinal encodings (alinhados com features.py)
    df = df.copy()
    df["cliente_perfil_ord"] = df["cliente_perfil"].map(PERFIL_ORDEM)
    df["perfil_calculado_ord"] = df["perfil_calculado"].map(PERFIL_ORDEM)
    df["divergencia_perfil"] = (
        df["cliente_perfil_ord"] != df["perfil_calculado_ord"]
    ).astype(int)
    df["produto_perfil_minimo_ord"] = df["produto_perfil_minimo"].map(PERFIL_ORDEM)
    df["produto_categoria_ord"] = df["produto_categoria"].apply(
        lambda c: CATEGORIAS.index(c) if c in CATEGORIAS else -1
    )
    df["produto_tributacao_ord"] = df["produto_tributacao"].map(TRIBUTACAO_ORDEM)
    df["perfil_match_delta"] = (
        df["cliente_perfil_ord"] - df["produto_perfil_minimo_ord"]
    )
    df["categoria_gap_proxy"] = (
        1.0 - df.apply(
            lambda r: {
                "RENDA_FIXA": r["pct_rf"],
                "RENDA_VARIAVEL": r["pct_rv"],
                "FUNDOS": r["pct_fundos"],
                "PREVIDENCIA": r["pct_previdencia"],
                "ESTRUTURADOS": r["pct_estruturados"],
                "CAMBIO": r["pct_cambio"],
            }.get(r["produto_categoria"], 0.0) * 2,
            axis=1,
        )
    ).clip(lower=0.0)

    # Renomeia pra match FEATURE_COLUMNS (csv usa snake_case curto)
    df = df.rename(columns={
        "cliente_patrimonio": "cliente_patrimonio",
        "horizonte_anos": "horizonte_anos",
        "tolerancia_perda": "tolerancia_perda",
        "num_posicoes": "num_posicoes",
        "top_emissor_pct": "top_emissor_pct",
        "emissor_alvo_match": "emissor_alvo_match",
        "produto_risco": "produto_risco",
        "produto_rentabilidade_ano": "produto_rentabilidade_ano",
        "produto_taxa_admin": "produto_taxa_admin",
        "produto_liquidez_meses": "produto_liquidez_meses",
    })

    # Sanity check: todas FEATURE_COLUMNS presentes
    faltando = [c for c in FEATURE_COLUMNS if c not in df.columns]
    if faltando:
        raise RuntimeError(f"Bug interno: features faltando após transform: {faltando}")

    X = df[FEATURE_COLUMNS].astype(float)
    y = df["aprovado"].astype(int)
    t = pd.to_datetime(df["decisao_em"])
    return X, y, t


# ============================================================
# Treino
# ============================================================


def split_temporal(X: pd.DataFrame, y: pd.Series, t: pd.Series,
                   ratio_treino: float = 0.8) -> tuple:
    """Split temporal: as 80% mais antigas viram treino."""
    order = t.argsort()
    cut = int(len(order) * ratio_treino)
    train_idx = order[:cut]
    val_idx = order[cut:]
    return (X.iloc[train_idx], y.iloc[train_idx],
            X.iloc[val_idx], y.iloc[val_idx])


def treinar_lgbm(X_train: pd.DataFrame, y_train: pd.Series,
                 X_val: pd.DataFrame, y_val: pd.Series) -> lgb.Booster:
    categorical_feature = ["produto_categoria_ord", "produto_tributacao_ord"]
    train_ds = lgb.Dataset(X_train, label=y_train,
                           categorical_feature=categorical_feature,
                           free_raw_data=False)
    val_ds = lgb.Dataset(X_val, label=y_val,
                         categorical_feature=categorical_feature,
                         reference=train_ds, free_raw_data=False)

    params = {
        "objective": "binary",
        "metric": ["binary_logloss", "auc"],
        "boosting_type": "gbdt",
        "learning_rate": 0.05,
        "num_leaves": 31,
        "min_data_in_leaf": 20,
        "feature_fraction": 0.85,
        "bagging_fraction": 0.85,
        "bagging_freq": 5,
        "lambda_l2": 0.1,
        "verbose": -1,
    }

    model = lgb.train(
        params,
        train_ds,
        num_boost_round=500,
        valid_sets=[train_ds, val_ds],
        valid_names=["train", "val"],
        callbacks=[
            lgb.early_stopping(stopping_rounds=20, verbose=False),
            lgb.log_evaluation(period=50),
        ],
    )
    return model


def avaliar(model: lgb.Booster, X_val: pd.DataFrame, y_val: pd.Series) -> dict:
    proba = model.predict(X_val)
    pred = (proba >= 0.5).astype(int)
    p, r, f1, _ = precision_recall_fscore_support(
        y_val, pred, average="binary", zero_division=0
    )
    return {
        "auc": float(roc_auc_score(y_val, proba)),
        "accuracy": float(accuracy_score(y_val, pred)),
        "precision": float(p),
        "recall": float(r),
        "f1": float(f1),
        "best_iteration": int(model.best_iteration or model.num_trees()),
    }


def feature_importance(model: lgb.Booster) -> list[tuple[str, int]]:
    imps = model.feature_importance(importance_type="gain")
    pares = list(zip(FEATURE_COLUMNS, imps))
    pares.sort(key=lambda kv: kv[1], reverse=True)
    return pares


# ============================================================
# Persistência (modelo + metadata num único .pkl)
# ============================================================


def salvar_modelo(path: Path, model: lgb.Booster, metrics: dict,
                  version: str, dataset_path: str, n_rows: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    artefato = {
        "model": model,
        "feature_columns": FEATURE_COLUMNS,
        "version": version,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "dataset_path": dataset_path,
        "dataset_rows": n_rows,
        "metrics": metrics,
    }
    joblib.dump(artefato, path)


# ============================================================
# CLI
# ============================================================


def main():
    parser = argparse.ArgumentParser(description="Treina o ranker LightGBM.")
    parser.add_argument("--dataset", type=str, required=True,
                        help="Caminho do CSV (schema: docs/integration/training-dataset-schema.md)")
    parser.add_argument("--out", type=str, required=True,
                        help="Caminho do .pkl de saída")
    parser.add_argument("--version", type=str, default="ml-ranker-v1",
                        help="Identificador da versão (vira engineVersion)")
    args = parser.parse_args()

    csv_path = Path(args.dataset)
    if not csv_path.exists():
        raise SystemExit(f"Dataset não encontrado: {csv_path}")

    print(f"Lendo {csv_path}...")
    df = pd.read_csv(csv_path)
    print(f"  {len(df)} linhas")

    X, y, t = csv_to_features(df)
    X_train, y_train, X_val, y_val = split_temporal(X, y, t)
    print(f"Split temporal: {len(X_train)} treino / {len(X_val)} validação")
    print(f"  Treino: aprovados {y_train.mean():.1%}")
    print(f"  Validação: aprovados {y_val.mean():.1%}")

    print("\nTreinando LightGBM...")
    model = treinar_lgbm(X_train, y_train, X_val, y_val)

    metrics = avaliar(model, X_val, y_val)
    print(f"\nMétricas (validação):")
    print(f"  AUC:       {metrics['auc']:.4f}")
    print(f"  Accuracy:  {metrics['accuracy']:.4f}")
    print(f"  Precision: {metrics['precision']:.4f}")
    print(f"  Recall:    {metrics['recall']:.4f}")
    print(f"  F1:        {metrics['f1']:.4f}")
    print(f"  Iterações: {metrics['best_iteration']}")

    print("\nTop-10 feature importance (gain):")
    for nome, imp in feature_importance(model)[:10]:
        print(f"  {nome:32s}  {imp:>10.0f}")

    out_path = Path(args.out)
    salvar_modelo(out_path, model, metrics, args.version, str(csv_path), len(df))
    print(f"\nModelo salvo em {out_path}")
    print(f"Metadata: version={args.version}, AUC={metrics['auc']:.4f}")


if __name__ == "__main__":
    main()
