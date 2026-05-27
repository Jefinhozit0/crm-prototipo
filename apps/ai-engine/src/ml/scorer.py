"""
Scorer ML — carrega o modelo .pkl uma vez na inicialização e expõe
`predict_proba` em tempo de inferência.

Singleton via `get_scorer()`. Se o arquivo do modelo não existir ou
falhar no load, o scorer fica em modo "indisponível" e o motor de regras
assume como fallback (ver rules._pontuar).
"""
from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any

import joblib
import numpy as np

from ..models import Cliente, Posicao, Produto, Suitability
from .features import FEATURE_COLUMNS, extract_features_row

logger = logging.getLogger(__name__)

# Caminho default do modelo — relativo ao root do ai-engine
DEFAULT_MODEL_PATH = Path(__file__).resolve().parents[2] / "models" / "ranker-v1.pkl"


class MLScorer:
    """
    Encapsula um modelo LightGBM treinado. Carrega artefato uma vez
    e prediz probabilidade de aprovação por par (cliente × produto).
    """

    def __init__(self, model_path: Path):
        self.model_path = model_path
        self.model: Any | None = None
        self.version: str = "unknown"
        self.metrics: dict = {}
        self.feature_columns: list[str] = FEATURE_COLUMNS
        self.loaded: bool = False
        self._load()

    def _load(self) -> None:
        if not self.model_path.exists():
            logger.warning(
                "Modelo ML não encontrado em %s — motor cairá pro fallback de regras.",
                self.model_path,
            )
            return
        try:
            artefato = joblib.load(self.model_path)
            self.model = artefato["model"]
            self.version = artefato.get("version", "ml-ranker-unknown")
            self.metrics = artefato.get("metrics", {})
            saved_cols = artefato.get("feature_columns", FEATURE_COLUMNS)
            if saved_cols != FEATURE_COLUMNS:
                logger.error(
                    "Feature columns do modelo divergem das atuais — "
                    "treinar de novo antes de usar. Salvo: %s. Atual: %s",
                    saved_cols, FEATURE_COLUMNS,
                )
                self.model = None
                return
            self.feature_columns = saved_cols
            self.loaded = True
            logger.info(
                "Modelo ML carregado: %s (AUC=%.4f, treinado em %s)",
                self.version,
                self.metrics.get("auc", float("nan")),
                artefato.get("trained_at", "?"),
            )
        except Exception as e:  # noqa: BLE001 — log e segue pro fallback
            logger.error("Falha ao carregar modelo ML: %s", e)
            self.model = None
            self.loaded = False

    def predict_proba(
        self,
        cliente: Cliente,
        suitability: Suitability,
        posicoes: list[Posicao],
        catalog: list[Produto],
        produto: Produto,
    ) -> float:
        """Probabilidade [0..1] do assessor aprovar esta recomendação."""
        if not self.loaded or self.model is None:
            raise RuntimeError("Modelo não carregado — caller deve usar fallback.")
        vec = extract_features_row(cliente, suitability, posicoes, catalog, produto)
        arr = np.array([vec], dtype=float)
        proba = self.model.predict(arr)
        return float(proba[0])


# ============================================================
# Singleton
# ============================================================


_scorer: MLScorer | None = None


def get_scorer() -> MLScorer:
    """Retorna o scorer ML (lazy init). Caminho do modelo configurável via
    env CRM_ML_MODEL_PATH (override pra dev/test)."""
    global _scorer
    if _scorer is None:
        path = Path(os.getenv("CRM_ML_MODEL_PATH", str(DEFAULT_MODEL_PATH)))
        _scorer = MLScorer(path)
    return _scorer


def reset_scorer() -> None:
    """Reseta o singleton — usado em testes ou após retreino."""
    global _scorer
    _scorer = None
