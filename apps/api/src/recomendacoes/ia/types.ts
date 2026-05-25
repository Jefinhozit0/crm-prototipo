import type {
  CategoriaProduto,
  Cliente,
  PerfilInvestidor,
  Produto,
  Suitability,
} from '@prisma/client';

// Subset dos campos do Produto que o engine usa (Decimals já convertidos pra number).
export type ProdutoIA = {
  id: string;
  nome: string;
  emissor: string;
  categoria: CategoriaProduto;
  rentabilidadeAno: number;
  risco: number;
  perfilMinimo: PerfilInvestidor;
  liquidez: string;
  taxaAdmin: number | null;
  ativo: boolean;
};

export type PosicaoIA = {
  produtoId: string;
  categoria: CategoriaProduto;
  valor: number;
};

export type Contexto = {
  cliente: Pick<Cliente, 'id' | 'nome' | 'perfil'> & { patrimonio: number };
  suitability: Pick<Suitability, 'perfilCalculado'> & {
    horizonteAnos: number;
    toleranciaPerda: number;
  };
  posicoes: PosicaoIA[];
  catalog: ProdutoIA[];
};

export type Fatores = {
  profileMatch: number;
  diversification: number;
  yield: number;
  liquidity: number;
  cost: number;
};

export const PESOS: Fatores = {
  profileMatch: 0.2,
  diversification: 0.3,
  yield: 0.2,
  liquidity: 0.15,
  cost: 0.15,
};

export type Contribuicao = {
  fator: keyof Fatores;
  contrib: number;
  frase: string;
};

export type Scored = {
  produto: ProdutoIA;
  score: number;
  fatores: Fatores;
  pesos: Fatores;
  contribs: Contribuicao[];
};

// Helpers convertendo o resultado do Prisma (com Decimals) pro shape do engine
export function produtoToIA(p: Produto): ProdutoIA {
  return {
    id: p.id,
    nome: p.nome,
    emissor: p.emissor,
    categoria: p.categoria,
    rentabilidadeAno: Number(p.rentabilidadeAno.toString()),
    risco: p.risco,
    perfilMinimo: p.perfilMinimo,
    liquidez: p.liquidez,
    taxaAdmin: p.taxaAdmin ? Number(p.taxaAdmin.toString()) : null,
    ativo: p.ativo,
  };
}
