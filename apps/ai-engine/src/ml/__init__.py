"""
Camada de Machine Learning do motor de IA.

- `features`: extração de features (request → vetor) usada por treino e inferência
- `synth`:    geração de dataset sintético (bootstrap até ter dado real)
- `train`:    CLI de treino que aceita CSV externo e gera .pkl
- `scorer`:   carrega modelo na inicialização do FastAPI, expõe predict_proba

Schema do dataset documentado em docs/integration/training-dataset-schema.md.
"""
