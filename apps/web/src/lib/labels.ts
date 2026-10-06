import type {
  CategoriaProduto,
  PerfilInvestidor,
  StatusCliente,
  StatusRecomendacao,
  TipoInteracao,
} from "@/types/api";

export const perfilLabel: Record<PerfilInvestidor, string> = {
  CONSERVADOR: "Conservador",
  MODERADO: "Moderado",
  ARROJADO: "Arrojado",
  AGRESSIVO: "Agressivo",
};

// Tons 800 sobre fundo 100: contraste AA pra texto pequeno
export const perfilColor: Record<PerfilInvestidor, string> = {
  CONSERVADOR: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
  MODERADO: "bg-blue-100 text-blue-800 hover:bg-blue-100",
  ARROJADO: "bg-amber-100 text-amber-800 hover:bg-amber-100",
  AGRESSIVO: "bg-red-100 text-red-800 hover:bg-red-100",
};

export const categoriaLabel: Record<CategoriaProduto, string> = {
  RENDA_FIXA: "Renda Fixa",
  RENDA_VARIAVEL: "Renda Variável",
  FUNDOS: "Fundos",
  PREVIDENCIA: "Previdência",
  ESTRUTURADOS: "Estruturados",
  CAMBIO: "Câmbio",
};

export const statusClienteLabel: Record<StatusCliente, string> = {
  ATIVO: "Ativo",
  PROSPECTO: "Prospecto",
  INATIVO: "Inativo",
  BLOQUEADO: "Bloqueado",
};

export const statusRecomendacaoLabel: Record<StatusRecomendacao, string> = {
  PENDENTE: "Pendente",
  APROVADA: "Aprovada",
  RECUSADA: "Recusada",
  ATIVA: "Ativa",
  EXPIRADA: "Expirada",
};

export const tipoInteracaoLabel: Record<TipoInteracao, string> = {
  EMAIL: "E-mail",
  LIGACAO: "Ligação",
  REUNIAO: "Reunião",
  WHATSAPP: "WhatsApp",
  TAREFA: "Tarefa",
  NOTA: "Nota",
};

export const AVISO_APOIO_DECISAO =
  "Recomendações são apoio à decisão. A decisão final é do assessor e está sujeita aos controles internos e de compliance.";
