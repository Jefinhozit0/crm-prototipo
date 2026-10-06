/**
 * DADOS DEMONSTRATIVOS — não vêm do banco.
 *
 * O modelo de dados ainda não guarda histórico de AUM nem movimentações
 * (aportes/resgates), então estas séries existem só pra ilustrar os gráficos.
 * Toda tela que as usa exibe o selo <DemoBadge />. Substituir quando houver
 * snapshots mensais de carteira.
 */
export const aumSerieDemo = [
  { mes: "Jan", aum: 162 },
  { mes: "Fev", aum: 165 },
  { mes: "Mar", aum: 168 },
  { mes: "Abr", aum: 172 },
  { mes: "Mai", aum: 176 },
  { mes: "Jun", aum: 184 },
];

export const captacaoSerieDemo = [
  { mes: "Jan", entrada: 2.3, saida: 0.8 },
  { mes: "Fev", entrada: 3.1, saida: 1.0 },
  { mes: "Mar", entrada: 4.0, saida: 1.4 },
  { mes: "Abr", entrada: 3.6, saida: 0.9 },
  { mes: "Mai", entrada: 4.8, saida: 1.1 },
  { mes: "Jun", entrada: 5.2, saida: 1.3 },
];
