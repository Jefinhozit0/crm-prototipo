// Tipos que casam com as respostas da API NestJS.
// Mantidos manualmente por enquanto; quando criarmos packages/shared
// (Fase 3), substituímos por imports do schema Zod compartilhado.

export type UserRole = "ADMIN" | "ASSESSOR" | "COMPLIANCE" | "READONLY";

export type AuthUser = {
  id: string;
  email: string;
  nome: string;
  role: UserRole;
};

export type Page<T> = {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type PerfilInvestidor =
  | "CONSERVADOR"
  | "MODERADO"
  | "ARROJADO"
  | "AGRESSIVO";

export type StatusCliente = "ATIVO" | "PROSPECTO" | "INATIVO" | "BLOQUEADO";

export type EstagioPipeline =
  | "PROSPECCAO"
  | "QUALIFICACAO"
  | "PROPOSTA"
  | "NEGOCIACAO"
  | "FECHADO"
  | "PERDIDO";

export type CategoriaProduto =
  | "RENDA_FIXA"
  | "RENDA_VARIAVEL"
  | "FUNDOS"
  | "PREVIDENCIA"
  | "ESTRUTURADOS"
  | "CAMBIO";

export type Tributacao = "TRIBUTADO" | "ISENTO" | "INCENTIVADO";

export type Responsavel = {
  id: string;
  nome: string;
  email: string;
};

export type Cliente = {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  cpfMasked: string;
  cidade: string | null;
  uf: string | null;
  perfil: PerfilInvestidor;
  status: StatusCliente;
  patrimonio: number;
  ultimaInteracao: string | null;
  responsavelId: string | null;
  responsavel: Responsavel | null;
  createdAt: string;
  updatedAt: string;
};

export type Produto = {
  id: string;
  nome: string;
  emissor: string;
  categoria: CategoriaProduto;
  rentabilidadeAno: number;
  risco: 1 | 2 | 3 | 4 | 5;
  tributacao: Tributacao;
  perfilMinimo: PerfilInvestidor;
  liquidez: string;
  taxaAdmin: number | null;
  taxaPerformance: number | null;
  ticker: string | null;
  ativo: boolean;
  descricao: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Lead = {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  origem: string;
  estagio: EstagioPipeline;
  valorEstimado: number;
  observacoes: string | null;
  responsavelId: string | null;
  responsavel: Responsavel | null;
  clienteId: string | null;
  createdAt: string;
  updatedAt: string;
  fechadoEm: string | null;
};

export type LeadBoardColumn = {
  estagio: EstagioPipeline;
  total: number;
  count: number;
  itens: Lead[];
};

export type Posicao = {
  id: string;
  produto: {
    id: string;
    nome: string;
    categoria: CategoriaProduto;
    emissor: string;
  };
  valor: number;
  adquiridoEm: string;
};

export type Suitability = {
  id: string;
  perfilCalculado: PerfilInvestidor;
  pontuacao: number;
  versaoQuestionario: string;
  validoAte: string;
  aplicadoEm: string;
  respostas: Record<string, unknown>;
};

export type OpcaoQuestionario = {
  id: string;
  label: string;
  pontos: number;
};

export type PerguntaQuestionario = {
  id: string;
  pergunta: string;
  ajuda?: string;
  opcoes: OpcaoQuestionario[];
};

export type Questionario = {
  versao: string;
  perguntas: PerguntaQuestionario[];
};

export type AplicarSuitabilityResult = {
  suitability: Suitability;
  perfilAnterior: PerfilInvestidor;
  perfilNovo: PerfilInvestidor;
  mudou: boolean;
};

export type ClienteDetalhado = Cliente & {
  posicoes: Posicao[];
  suitability: Suitability | null;
  recomendacoes: Array<{
    id: string;
    produto: { id: string; nome: string; categoria: CategoriaProduto; emissor: string };
    score: number;
    justificativa: string;
    status: StatusRecomendacao;
    geradoEm: string;
  }>;
};

// ----- Recomendações IA -----

export type StatusRecomendacao =
  | "PENDENTE"
  | "APROVADA"
  | "RECUSADA"
  | "ATIVA"
  | "EXPIRADA";

export type FatorRecomendacao =
  | "profileMatch"
  | "diversification"
  | "yield"
  | "liquidity"
  | "cost";

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

export type Recomendacao = {
  id: string;
  clienteId: string;
  cliente: { id: string; nome: string; perfil: PerfilInvestidor };
  produtoId: string;
  produto: {
    id: string;
    nome: string;
    categoria: CategoriaProduto;
    emissor: string;
  };
  score: number;
  justificativa: string;
  status: StatusRecomendacao;
  aprovadoPor: { id: string; nome: string } | null;
  aprovadoEm: string | null;
  recusaMotivo: string | null;
  geradoEm: string;
  expiraEm: string | null;
  // Payload é JSON arbitrário no banco. Recomendações geradas pelo engine
  // têm os campos abaixo; recomendações legadas (importadas/seedadas) podem não ter.
  payload: {
    fatores?: Record<FatorRecomendacao, number>;
    pesos?: Record<FatorRecomendacao, number>;
    contribs?: { fator: FatorRecomendacao; contrib: number; frase: string }[];
    geradoPor?: string;
    descartadosDaRodada?: DescarteAgregado[];
    totalAnalisados?: number;
    [k: string]: unknown;
  };
};

export type GenerateResult = {
  geradas: number;
  recomendacoes: Recomendacao[];
};
