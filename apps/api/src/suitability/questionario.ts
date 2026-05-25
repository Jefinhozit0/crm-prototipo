import type { PerfilInvestidor } from '@prisma/client';

export type Opcao = {
  id: string;
  label: string;
  pontos: number;
};

export type Pergunta = {
  id: string;
  pergunta: string;
  ajuda?: string;
  opcoes: Opcao[];
};

/**
 * Questionário v1 — 10 perguntas, pontuação 0-100.
 * Mantido como código (não em DB) pra ter versionamento via git.
 * Quando mudar, bumpar a constante VERSAO.
 */
export const VERSAO = 'v1';

export const QUESTIONARIO: Pergunta[] = [
  {
    id: 'horizonte',
    pergunta: 'Em quanto tempo você prevê precisar desses investimentos?',
    ajuda: 'Pense no objetivo principal — aposentadoria, casa, reserva, etc.',
    opcoes: [
      { id: 'h1', label: 'Menos de 1 ano', pontos: 0 },
      { id: 'h2', label: 'De 1 a 3 anos', pontos: 3 },
      { id: 'h3', label: 'De 3 a 7 anos', pontos: 7 },
      { id: 'h4', label: 'Mais de 7 anos', pontos: 10 },
    ],
  },
  {
    id: 'objetivo',
    pergunta: 'Qual o objetivo principal dos investimentos?',
    opcoes: [
      { id: 'o1', label: 'Preservar capital (sem perdas)', pontos: 0 },
      { id: 'o2', label: 'Gerar renda mensal estável', pontos: 3 },
      { id: 'o3', label: 'Crescimento de longo prazo', pontos: 7 },
      { id: 'o4', label: 'Maximizar retorno (aceito volatilidade)', pontos: 10 },
    ],
  },
  {
    id: 'reacao_queda',
    pergunta: 'Sua carteira cai 20% em um mês. O que você faz?',
    opcoes: [
      { id: 'r1', label: 'Vendo tudo pra evitar mais perdas', pontos: 0 },
      { id: 'r2', label: 'Vendo a parte mais arriscada', pontos: 5 },
      { id: 'r3', label: 'Aguardo — faz parte do jogo', pontos: 10 },
      { id: 'r4', label: 'Aproveito pra aportar mais', pontos: 15 },
    ],
  },
  {
    id: 'tolerancia_perda',
    pergunta: 'Qual a maior perda anual que você aceita sem se desesperar?',
    opcoes: [
      { id: 't1', label: 'Não aceito perdas', pontos: 0 },
      { id: 't2', label: 'Até 10%', pontos: 5 },
      { id: 't3', label: 'Até 25%', pontos: 10 },
      { id: 't4', label: 'Acima de 25%', pontos: 15 },
    ],
  },
  {
    id: 'renda',
    pergunta: 'Qual a sua faixa de renda mensal?',
    opcoes: [
      { id: 'rd1', label: 'Até R$ 10 mil', pontos: 0 },
      { id: 'rd2', label: 'R$ 10 mil a R$ 30 mil', pontos: 2 },
      { id: 'rd3', label: 'R$ 30 mil a R$ 100 mil', pontos: 4 },
      { id: 'rd4', label: 'Acima de R$ 100 mil', pontos: 5 },
    ],
  },
  {
    id: 'renda_comprometida',
    pergunta: 'Quanto da sua renda mensal você consegue investir?',
    opcoes: [
      { id: 'rc1', label: 'Até 10%', pontos: 0 },
      { id: 'rc2', label: '10% a 30%', pontos: 2 },
      { id: 'rc3', label: '30% a 50%', pontos: 4 },
      { id: 'rc4', label: 'Mais de 50%', pontos: 5 },
    ],
  },
  {
    id: 'experiencia',
    pergunta: 'Há quantos anos você investe?',
    opcoes: [
      { id: 'e1', label: 'Menos de 2 anos', pontos: 0 },
      { id: 'e2', label: '2 a 5 anos', pontos: 4 },
      { id: 'e3', label: '5 a 10 anos', pontos: 7 },
      { id: 'e4', label: 'Mais de 10 anos', pontos: 10 },
    ],
  },
  {
    id: 'conhecimento',
    pergunta: 'Qual o produto mais sofisticado que você já usou?',
    opcoes: [
      { id: 'c1', label: 'Apenas poupança / CDB', pontos: 0 },
      { id: 'c2', label: 'Tesouro Direto / fundos de renda fixa', pontos: 3 },
      { id: 'c3', label: 'Ações / fundos de ações / BDR', pontos: 7 },
      { id: 'c4', label: 'Derivativos / estruturados / multimercado', pontos: 10 },
    ],
  },
  {
    id: 'liquidez',
    pergunta: 'Quanto tempo aceita ficar sem acesso ao dinheiro investido?',
    opcoes: [
      { id: 'l1', label: 'Preciso disponível sempre', pontos: 0 },
      { id: 'l2', label: 'Posso esperar até 30 dias', pontos: 4 },
      { id: 'l3', label: 'Posso travar por 1 ano', pontos: 7 },
      { id: 'l4', label: 'Não preciso por anos', pontos: 10 },
    ],
  },
  {
    id: 'diversificacao',
    pergunta: 'Em quantas classes de ativos sua carteira está hoje?',
    ajuda: 'Ex: renda fixa, ações, fundos, internacional, imóveis, etc.',
    opcoes: [
      { id: 'd1', label: 'Apenas 1 (ex: poupança)', pontos: 0 },
      { id: 'd2', label: '2 classes', pontos: 3 },
      { id: 'd3', label: '3 a 4 classes', pontos: 7 },
      { id: 'd4', label: '5 ou mais classes', pontos: 10 },
    ],
  },
];

// Soma máxima = 100. Mapeamento de faixa pra perfil:
export function perfilDePontuacao(pontuacao: number): PerfilInvestidor {
  if (pontuacao <= 25) return 'CONSERVADOR';
  if (pontuacao <= 50) return 'MODERADO';
  if (pontuacao <= 75) return 'ARROJADO';
  return 'AGRESSIVO';
}

/**
 * Recebe { perguntaId: opcaoId } e devolve { pontuacao, respostasComLabel }
 * — também valida que toda pergunta foi respondida.
 */
export function pontuar(respostas: Record<string, string>) {
  let pontuacao = 0;
  const detalhe: Record<string, { opcaoId: string; pontos: number; label: string }> = {};

  for (const p of QUESTIONARIO) {
    const opcaoId = respostas[p.id];
    if (!opcaoId) {
      throw new Error(`Pergunta "${p.id}" não foi respondida`);
    }
    const opcao = p.opcoes.find((o) => o.id === opcaoId);
    if (!opcao) {
      throw new Error(`Opção "${opcaoId}" inválida para pergunta "${p.id}"`);
    }
    pontuacao += opcao.pontos;
    detalhe[p.id] = { opcaoId, pontos: opcao.pontos, label: opcao.label };
  }

  return { pontuacao, detalhe };
}
