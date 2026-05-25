export type PerfilInvestidor = "conservador" | "moderado" | "arrojado" | "agressivo";

export type StatusCliente = "ativo" | "prospecto" | "inativo";

export type Cliente = {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  cidade: string;
  perfil: PerfilInvestidor;
  patrimonio: number;
  ultimaInteracao: string;
  status: StatusCliente;
};

export type EstagioPipeline =
  | "prospeccao"
  | "qualificacao"
  | "proposta"
  | "negociacao"
  | "fechado";

export type Lead = {
  id: string;
  nome: string;
  origem: string;
  estagio: EstagioPipeline;
  valorEstimado: number;
  diasNoEstagio: number;
  responsavel: string;
};

export type CategoriaProduto =
  | "renda-fixa"
  | "renda-variavel"
  | "fundos"
  | "previdencia"
  | "estruturados";

export type Produto = {
  id: string;
  nome: string;
  categoria: CategoriaProduto;
  emissor: string;
  rentabilidadeAno: number;
  risco: 1 | 2 | 3 | 4 | 5;
  perfilMinimo: PerfilInvestidor;
  liquidez: string;
  taxaAdmin?: number;
};

export type RecomendacaoIA = {
  id: string;
  clienteId: string;
  clienteNome: string;
  produtoId: string;
  produtoNome: string;
  score: number;
  justificativa: string;
  geradoEm: string;
  status: "pendente" | "aprovada" | "recusada" | "ativa";
};

export type TipoInteracao = "email" | "ligacao" | "reuniao" | "whatsapp" | "tarefa";

export type Interacao = {
  id: string;
  clienteId: string;
  clienteNome: string;
  tipo: TipoInteracao;
  assunto: string;
  resumo: string;
  data: string;
  autor: string;
};
