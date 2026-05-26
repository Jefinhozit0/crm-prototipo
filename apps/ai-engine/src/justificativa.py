"""
Construtor de justificativas em pt-BR — porte da versão TypeScript.

Cada recomendação ganha:
  - frases técnicas curtas por fator (usadas no "Como cheguei nisso" do front)
  - uma justificativa em narrativa de 1ª pessoa (lead da recomendação)
"""
from .models import Cliente, Posicao, Produto, Suitability

CATEGORIA_LABEL: dict[str, str] = {
    "RENDA_FIXA": "renda fixa",
    "RENDA_VARIAVEL": "renda variável",
    "FUNDOS": "fundos de investimento",
    "PREVIDENCIA": "previdência privada",
    "ESTRUTURADOS": "produtos estruturados",
    "CAMBIO": "câmbio",
}


def humanizar_patrimonio(v: float) -> str:
    """R$ 14,5 milhões / R$ 800 mil / R$ 350"""
    if v >= 1_000_000_000:
        b = v / 1_000_000_000
        n = f"{round(b)}" if b >= 10 else f"{b:.1f}".replace(".", ",")
        return f"R$ {n} bilhões"
    if v >= 1_000_000:
        m = v / 1_000_000
        n = f"{round(m)}" if m >= 10 else f"{m:.1f}".replace(".", ",")
        return f"R$ {n} milhões"
    if v >= 100_000:
        return f"R$ {round(v / 1_000)} mil"
    s = f"R$ {v:,.0f}".replace(",", ".")
    return s


def pct_categoria(
    cliente: Cliente, posicoes: list[Posicao], categoria: str
) -> int:
    if cliente.patrimonio == 0:
        return 0
    total = sum(p.valor for p in posicoes if p.categoria == categoria)
    return round((total / cliente.patrimonio) * 100)


# ============================================================
# Frases técnicas — uma por fator (drill-down do front)
# ============================================================


def frase_fator(
    fator: str,
    valor: float,
    cliente: Cliente,
    posicoes: list[Posicao],
    p: Produto,
) -> str:
    if fator == "profileMatch":
        if valor == 1.0:
            return (
                f"Produto enquadrado exatamente no perfil "
                f"{cliente.perfil.lower()}."
            )
        return (
            f"Produto adequado ao perfil {cliente.perfil.lower()} "
            f"(perfil mínimo: {p.perfilMinimo.lower()})."
        )

    if fator == "diversification":
        pct = pct_categoria(cliente, posicoes, p.categoria)
        cat = CATEGORIA_LABEL[p.categoria]
        if valor > 0.6:
            return (
                f"Categoria {cat} subponderada — exposição atual de apenas "
                f"{pct}% versus alvo do perfil."
            )
        if valor > 0.3:
            return f"Há espaço para reforçar exposição em {cat} ({pct}% atual)."
        return f"Categoria {cat} já próxima do alvo ({pct}%)."

    if fator == "yield":
        rent = f"{p.rentabilidadeAno:.1f}".replace(".", ",")
        if valor > 0.7:
            return (
                f"Rentabilidade de {rent}% a.a. está entre as melhores da "
                f"categoria."
            )
        if valor > 0.4:
            return f"Rentabilidade de {rent}% a.a. é competitiva."
        return f"Rentabilidade de {rent}% a.a. abaixo da média da categoria."

    if fator == "liquidity":
        h = "horizonte"  # placeholder — preenchido por quem chama
        if valor > 0.7:
            return (
                f"Liquidez {p.liquidez} alinhada ao {h} declarado pelo cliente."
            )
        if valor < 0.4:
            return f"Liquidez {p.liquidez} mais longa que o {h} — avaliar."
        return f"Liquidez {p.liquidez} aceitável para o {h} do cliente."

    if fator == "cost":
        if p.taxaAdmin is None:
            return "Sem taxa de administração."
        taxa = f"{p.taxaAdmin:.1f}".replace(".", ",")
        if valor > 0.7:
            return f"Taxa de administração baixa ({taxa}% a.a.)."
        return f"Taxa de administração de {taxa}% a.a. — verificar custo-benefício."

    return ""


# ============================================================
# Justificativa em narrativa (1ª pessoa)
# ============================================================


def abertura(
    dominante: str,
    cliente: Cliente,
    posicoes: list[Posicao],
    p: Produto,
    suitability: Suitability,
) -> str:
    primeiro = cliente.nome.split(" ")[0]
    perfil = cliente.perfil.lower()
    rent = f"{p.rentabilidadeAno:.1f}".replace(".", ",")

    if dominante == "diversification":
        pct = pct_categoria(cliente, posicoes, p.categoria)
        cat = CATEGORIA_LABEL[p.categoria]
        if pct == 0:
            return (
                f"Olhei a carteira de {primeiro} e a primeira coisa que me "
                f"chamou atenção é a ausência total de exposição em {cat}."
            )
        return (
            f"Analisando a carteira de {primeiro}, vi que {cat} representa "
            f"apenas {pct}% — bem abaixo do alvo pra perfil {perfil}."
        )

    if dominante == "profileMatch":
        return (
            f"O {p.nome} tem o desenho certo pra {primeiro}: foi pensado pra "
            f"perfil {p.perfilMinimo.lower()}, que conversa direto com o "
            f"perfil {perfil} do cliente."
        )

    if dominante == "yield":
        cat = CATEGORIA_LABEL[p.categoria]
        return (
            f"Dentro de {cat}, o {p.nome} entrega {rent}% a.a. — está entre "
            f"os melhores que o BTG distribui na categoria."
        )

    if dominante == "liquidity":
        return (
            f"Considerando o horizonte de {suitability.horizonteAnos} anos "
            f"declarado por {primeiro}, a liquidez {p.liquidez} do {p.nome} "
            f"cai bem."
        )

    if dominante == "cost":
        if p.taxaAdmin is None:
            custo = "não tem taxa de administração"
        else:
            taxa = f"{p.taxaAdmin:.1f}".replace(".", ",")
            custo = f"tem taxa de admin de apenas {taxa}% a.a."
        return (
            f"Um ponto forte do {p.nome} pra {primeiro} é o custo: "
            f"{custo}, o que preserva o yield líquido."
        )

    return ""


def contexto(dominante: str, cliente: Cliente) -> str:
    perfil = cliente.perfil.lower()
    patrimonio = humanizar_patrimonio(cliente.patrimonio)
    primeiro = cliente.nome.split(" ")[0]

    if dominante == "diversification":
        return (
            f"Para um perfil {perfil} com {patrimonio} de patrimônio, "
            f"isso é uma lacuna estratégica."
        )
    if dominante == "yield":
        return f"Vale considerar pra {primeiro}, que tem {patrimonio} em jogo."
    return ""


def endorsement(
    fator: str,
    valor: float,
    p: Produto,
    suitability: Suitability,
) -> str | None:
    """Frase curta pra fator quando aparece como secundário na proposta.
    Retorna None se o fator é fraco demais pra citar."""

    if fator == "profileMatch":
        if valor >= 1.0:
            return "está enquadrado exatamente no perfil do cliente"
        if valor >= 0.7:
            return "é compatível com o perfil declarado"
        return "é aceito pra esse perfil"

    if fator == "diversification":
        if valor >= 0.6:
            return "preenche um gap importante da carteira"
        if valor >= 0.3:
            return "reforça uma categoria ainda subponderada"
        return None

    if fator == "yield":
        rent = f"{p.rentabilidadeAno:.1f}".replace(".", ",")
        if valor >= 0.7:
            return f"a rentabilidade de {rent}% a.a. está no topo da categoria"
        if valor >= 0.4:
            return f"{rent}% a.a. é um retorno competitivo"
        return None

    if fator == "liquidity":
        if valor >= 0.7:
            return (
                f"a liquidez {p.liquidez} cabe folgadamente no horizonte de "
                f"{suitability.horizonteAnos} anos"
            )
        if valor >= 0.4:
            return f"a liquidez {p.liquidez} é aceitável pra esse horizonte"
        return None

    if fator == "cost":
        if p.taxaAdmin is None:
            return "não tem taxa de administração penalizando o yield"
        if valor >= 0.7:
            taxa = f"{p.taxaAdmin:.1f}".replace(".", ",")
            return f"a taxa de admin de {taxa}% a.a. é baixa pra categoria"
        return None

    return None


def juntar_pt_br(itens: list[str]) -> str:
    if not itens:
        return ""
    if len(itens) == 1:
        return itens[0]
    if len(itens) == 2:
        return f"{itens[0]} e {itens[1]}"
    return f"{', '.join(itens[:-1])} e {itens[-1]}"


def proposta(
    dominante: str,
    p: Produto,
    secundarios: list[dict],
    fatores: dict[str, float],
    suitability: Suitability,
) -> str:
    endos: list[str] = []
    for s in secundarios:
        e = endorsement(s["fator"], fatores[s["fator"]], p, suitability)
        if e:
            endos.append(e)

    if not endos:
        return ""

    lista = juntar_pt_br(endos)

    if dominante == "diversification":
        return f"O {p.nome} resolveria isso: {lista}."
    if dominante == "profileMatch":
        return f"Reforçando a escolha: {lista}."
    return f"Soma-se a isso que {lista}."


def build_justificativa(
    scored: dict,
    cliente: Cliente,
    posicoes: list[Posicao],
    suitability: Suitability,
) -> str:
    """Monta a justificativa final em 3 partes."""
    contribs = sorted(scored["contribs"], key=lambda c: c["contrib"], reverse=True)
    dom = contribs[0]["fator"]
    secundarios = contribs[1:3]

    p: Produto = scored["produto"]
    fatores: dict[str, float] = scored["fatores"]

    partes = [
        abertura(dom, cliente, posicoes, p, suitability),
        contexto(dom, cliente),
        proposta(dom, p, secundarios, fatores, suitability),
    ]

    return " ".join(part for part in partes if part)


def preencher_frases_fator(
    scored: dict,
    cliente: Cliente,
    posicoes: list[Posicao],
    suitability: Suitability,
) -> None:
    """Substitui as frases vazias dos contribs por frases técnicas."""
    p: Produto = scored["produto"]
    fatores: dict[str, float] = scored["fatores"]

    for c in scored["contribs"]:
        frase = frase_fator(c["fator"], fatores[c["fator"]], cliente, posicoes, p)
        if c["fator"] == "liquidity":
            # frase_fator usa placeholder "horizonte" — substituir aqui
            frase = frase.replace(
                "horizonte", f"horizonte de {suitability.horizonteAnos} anos"
            )
        c["frase"] = frase
