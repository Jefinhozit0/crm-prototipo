/**
 * Seed do CRM Capital Elite — gera 1 admin + 2 assessores,
 * ~10 clientes, ~5 produtos, leads em vários estágios,
 * suitabilities, recomendações de IA e interações.
 *
 * Rodar: npm run prisma:seed -w @crm/api
 */
import {
  PrismaClient,
  UserRole,
  PerfilInvestidor,
  StatusCliente,
  EstagioPipeline,
  CategoriaProduto,
  StatusRecomendacao,
  TipoInteracao,
  AcaoAuditoria,
  Tributacao,
} from '@prisma/client';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Senha de dev para os 3 usuários seedados — TROQUE EM PRODUÇÃO.
const DEV_PASSWORD = 'Senha123!';

function hash(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function maskCpf(cpf: string) {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return cpf;
  return `***.***.${digits.slice(6, 9)}-${digits.slice(9)}`;
}


async function main() {
  console.log('🌱 Limpando dados existentes...');

  // Ordem importa por causa das FKs
  await prisma.auditoria.deleteMany();
  await prisma.interacao.deleteMany();
  await prisma.recomendacao.deleteMany();
  await prisma.posicao.deleteMany();
  await prisma.suitability.deleteMany();
  await prisma.estagioHistorico.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.cliente.deleteMany();
  await prisma.produto.deleteMany();
  await prisma.user.deleteMany();

  console.log('👤 Criando usuários (senha padrão para todos: ' + DEV_PASSWORD + ')...');

  const senhaHash = await bcrypt.hash(DEV_PASSWORD, 10);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@capitalelite.com.br',
      nome: 'Admin Capital',
      senhaHash,
      role: UserRole.ADMIN,
    },
  });

  const joao = await prisma.user.create({
    data: {
      email: 'joao.diniz@capitalelite.com.br',
      nome: 'João Diniz',
      senhaHash,
      role: UserRole.ASSESSOR,
    },
  });

  const marina = await prisma.user.create({
    data: {
      email: 'marina.lopes@capitalelite.com.br',
      nome: 'Marina Lopes',
      senhaHash,
      role: UserRole.ASSESSOR,
    },
  });

  console.log('📦 Criando produtos do BTG Pactual...');

  // Catálogo enxuto cobrindo todas as categorias e perfis.
  // Valores de rentabilidade/taxas são ilustrativos — ajustar com tabela real do BTG.
  const produtos = await Promise.all([
    // 0 — CDB BTG (RF conservador, alta liquidez)
    prisma.produto.create({
      data: {
        nome: 'CDB BTG Pactual Pré 13%',
        emissor: 'BTG Pactual',
        categoria: CategoriaProduto.RENDA_FIXA,
        rentabilidadeAno: 13.0,
        risco: 1,
        tributacao: Tributacao.TRIBUTADO,
        perfilMinimo: PerfilInvestidor.CONSERVADOR,
        liquidez: 'D+1',
        ticker: 'CDB-BTG-PRE-2027',
      },
    }),
    // 1 — Tesouro via BTG (RF, base de qualquer carteira)
    prisma.produto.create({
      data: {
        nome: 'Tesouro IPCA+ 2035 (via BTG)',
        emissor: 'Tesouro Nacional',
        categoria: CategoriaProduto.RENDA_FIXA,
        rentabilidadeAno: 6.4,
        risco: 1,
        tributacao: Tributacao.TRIBUTADO,
        perfilMinimo: PerfilInvestidor.CONSERVADOR,
        liquidez: 'D+1',
        ticker: 'NTN-B-2035',
      },
    }),
    // 2 — Crédito Privado BTG Asset (RF moderado, yield maior)
    prisma.produto.create({
      data: {
        nome: 'BTG Pactual Crédito Privado FIRF',
        emissor: 'BTG Pactual Asset',
        categoria: CategoriaProduto.FUNDOS,
        rentabilidadeAno: 12.5,
        risco: 3,
        tributacao: Tributacao.TRIBUTADO,
        perfilMinimo: PerfilInvestidor.MODERADO,
        liquidez: 'D+30',
        taxaAdmin: 0.6,
      },
    }),
    // 3 — Multimercado BTG (carro-chefe de fundos arrojados)
    prisma.produto.create({
      data: {
        nome: 'BTG Pactual Absoluto Multimercado FIC',
        emissor: 'BTG Pactual Asset',
        categoria: CategoriaProduto.FUNDOS,
        rentabilidadeAno: 14.2,
        risco: 4,
        tributacao: Tributacao.TRIBUTADO,
        perfilMinimo: PerfilInvestidor.ARROJADO,
        liquidez: 'D+30',
        taxaAdmin: 2.0,
        taxaPerformance: 20.0,
      },
    }),
    // 4 — Ações BTG Dividendos (RV via fundo)
    prisma.produto.create({
      data: {
        nome: 'BTG Pactual Dividendos FI Ações',
        emissor: 'BTG Pactual Asset',
        categoria: CategoriaProduto.FUNDOS,
        rentabilidadeAno: 16.8,
        risco: 4,
        tributacao: Tributacao.TRIBUTADO,
        perfilMinimo: PerfilInvestidor.ARROJADO,
        liquidez: 'D+30',
        taxaAdmin: 2.0,
      },
    }),
    // 5 — BPAC11 (ação do próprio BTG — boa pra colocar a casa)
    prisma.produto.create({
      data: {
        nome: 'BPAC11 — BTG Pactual',
        emissor: 'BTG Pactual S.A.',
        categoria: CategoriaProduto.RENDA_VARIAVEL,
        rentabilidadeAno: 19.5,
        risco: 4,
        tributacao: Tributacao.TRIBUTADO,
        perfilMinimo: PerfilInvestidor.ARROJADO,
        liquidez: 'D+2',
        ticker: 'BPAC11',
      },
    }),
    // 6 — FII BTG Logística (renda imobiliária mensal)
    prisma.produto.create({
      data: {
        nome: 'BTLG11 — FII BTG Logística',
        emissor: 'BTG Pactual',
        categoria: CategoriaProduto.RENDA_VARIAVEL,
        rentabilidadeAno: 11.2,
        risco: 3,
        tributacao: Tributacao.ISENTO,
        perfilMinimo: PerfilInvestidor.MODERADO,
        liquidez: 'D+2',
        ticker: 'BTLG11',
      },
    }),
    // 7 — BDR S&P 500 (exposição internacional via BTG)
    prisma.produto.create({
      data: {
        nome: 'BDR S&P 500 (IVVB11) — via BTG',
        emissor: 'B3 / Distribuído por BTG',
        categoria: CategoriaProduto.RENDA_VARIAVEL,
        rentabilidadeAno: 18.5,
        risco: 4,
        tributacao: Tributacao.TRIBUTADO,
        perfilMinimo: PerfilInvestidor.ARROJADO,
        liquidez: 'D+2',
        ticker: 'IVVB11',
      },
    }),
    // 8 — Previdência BTG (vantagem tributária, perfil conservador)
    prisma.produto.create({
      data: {
        nome: 'BTG Pactual Prev RF Crédito Privado',
        emissor: 'BTG Pactual Vida e Previdência',
        categoria: CategoriaProduto.PREVIDENCIA,
        rentabilidadeAno: 10.4,
        risco: 2,
        tributacao: Tributacao.INCENTIVADO,
        perfilMinimo: PerfilInvestidor.CONSERVADOR,
        liquidez: 'D+5',
        taxaAdmin: 0.9,
      },
    }),
    // 9 — COE BTG (estruturado, agressivo)
    prisma.produto.create({
      data: {
        nome: 'COE BTG Bull S&P 500 Capital Protegido 4A',
        emissor: 'BTG Pactual',
        categoria: CategoriaProduto.ESTRUTURADOS,
        rentabilidadeAno: 22.0,
        risco: 5,
        tributacao: Tributacao.TRIBUTADO,
        perfilMinimo: PerfilInvestidor.AGRESSIVO,
        liquidez: 'Vencimento',
      },
    }),
    // 10 — CDB Itaú DI (alternativa BTG-Pactual em RF de banco)
    prisma.produto.create({
      data: {
        nome: 'CDB Itaú DI 110% CDI',
        emissor: 'Itaú Unibanco',
        categoria: CategoriaProduto.RENDA_FIXA,
        rentabilidadeAno: 12.5,
        risco: 1,
        perfilMinimo: PerfilInvestidor.CONSERVADOR,
        liquidez: 'D+1',
        tributacao: Tributacao.TRIBUTADO,
        ticker: 'CDB-ITAU-DI-2028',
      },
    }),
    // 11 — LCA Bradesco isenta IR (diversifica RF + benefício tributário pra alíquota alta)
    prisma.produto.create({
      data: {
        nome: 'LCA Bradesco IPCA+ 5,2%',
        emissor: 'Bradesco',
        categoria: CategoriaProduto.RENDA_FIXA,
        rentabilidadeAno: 11.8,
        risco: 1,
        perfilMinimo: PerfilInvestidor.CONSERVADOR,
        liquidez: 'Vencimento',
        tributacao: Tributacao.ISENTO,
        ticker: 'LCA-BRAD-IPCA-2029',
      },
    }),
    // 12 — Debênture Incentivada Eletrobras (RF moderado, isenção art. 2º Lei 12.431)
    prisma.produto.create({
      data: {
        nome: 'Debênture Eletrobras 2031 (Incentivada)',
        emissor: 'Eletrobras',
        categoria: CategoriaProduto.RENDA_FIXA,
        rentabilidadeAno: 13.2,
        risco: 3,
        perfilMinimo: PerfilInvestidor.MODERADO,
        liquidez: 'Vencimento',
        tributacao: Tributacao.INCENTIVADO,
        ticker: 'ELET-DEB-2031',
      },
    }),
    // 13 — Vinci Long Bias (multimercado de outra gestora; diversifica BTG Asset)
    prisma.produto.create({
      data: {
        nome: 'Vinci Capital Long Bias FIM',
        emissor: 'Vinci Partners',
        categoria: CategoriaProduto.FUNDOS,
        rentabilidadeAno: 15.2,
        risco: 4,
        perfilMinimo: PerfilInvestidor.ARROJADO,
        liquidez: 'D+30',
        taxaAdmin: 1.8,
        taxaPerformance: 20.0,
        tributacao: Tributacao.TRIBUTADO,
      },
    }),
    // 14 — XP Top Stocks (FIA de outra casa; alternativa a BTG Dividendos)
    prisma.produto.create({
      data: {
        nome: 'XP Top Stocks FIA',
        emissor: 'XP Asset',
        categoria: CategoriaProduto.FUNDOS,
        rentabilidadeAno: 17.5,
        risco: 4,
        perfilMinimo: PerfilInvestidor.ARROJADO,
        liquidez: 'D+30',
        taxaAdmin: 2.0,
        taxaPerformance: 20.0,
        tributacao: Tributacao.TRIBUTADO,
      },
    }),
  ]);

  console.log('👥 Criando clientes...');

  const clientesData = [
    {
      nome: 'Mariana Andrade',
      email: 'mariana.andrade@example.com',
      telefone: '+55 11 98123-4567',
      cpf: '12345678901',
      cidade: 'São Paulo',
      uf: 'SP',
      perfil: PerfilInvestidor.MODERADO,
      patrimonio: 4_350_000,
      status: StatusCliente.ATIVO,
      responsavelId: joao.id,
    },
    {
      nome: 'Ricardo Tavares',
      email: 'ricardo.tavares@example.com',
      telefone: '+55 21 97777-1010',
      cpf: '23456789012',
      cidade: 'Rio de Janeiro',
      uf: 'RJ',
      perfil: PerfilInvestidor.ARROJADO,
      patrimonio: 9_120_000,
      status: StatusCliente.ATIVO,
      responsavelId: joao.id,
    },
    {
      nome: 'Bianca Lemos',
      email: 'bianca.lemos@example.com',
      telefone: '+55 31 96555-3322',
      cpf: '34567890123',
      cidade: 'Belo Horizonte',
      uf: 'MG',
      perfil: PerfilInvestidor.CONSERVADOR,
      patrimonio: 1_780_000,
      status: StatusCliente.ATIVO,
      responsavelId: marina.id,
    },
    {
      nome: 'Felipe Okabe',
      email: 'felipe.okabe@example.com',
      telefone: '+55 41 96123-9988',
      cpf: '45678901234',
      cidade: 'Curitiba',
      uf: 'PR',
      perfil: PerfilInvestidor.AGRESSIVO,
      patrimonio: 14_500_000,
      status: StatusCliente.ATIVO,
      responsavelId: joao.id,
    },
    {
      nome: 'Patrícia Holanda',
      email: 'patricia.holanda@example.com',
      telefone: '+55 85 98444-6655',
      cpf: '56789012345',
      cidade: 'Fortaleza',
      uf: 'CE',
      perfil: PerfilInvestidor.MODERADO,
      patrimonio: 2_650_000,
      status: StatusCliente.PROSPECTO,
      responsavelId: marina.id,
    },
  ];

  const clientes = await Promise.all(
    clientesData.map((c) =>
      prisma.cliente.create({
        data: {
          nome: c.nome,
          email: c.email,
          telefone: c.telefone,
          cpfHash: hash(c.cpf),
          cpfMasked: maskCpf(c.cpf),
          cidade: c.cidade,
          uf: c.uf,
          perfil: c.perfil,
          patrimonio: c.patrimonio,
          status: c.status,
          responsavelId: c.responsavelId,
          ultimaInteracao: new Date(Date.now() - Math.random() * 14 * 86400000),
        },
      }),
    ),
  );

  console.log('🎯 Criando leads...');

  await Promise.all([
    prisma.lead.create({
      data: {
        nome: 'Carlos Mendes',
        email: 'carlos.mendes@example.com',
        origem: 'Indicação',
        estagio: EstagioPipeline.QUALIFICACAO,
        valorEstimado: 1_200_000,
        responsavelId: joao.id,
      },
    }),
    prisma.lead.create({
      data: {
        nome: 'Helena Sá',
        email: 'helena.sa@example.com',
        origem: 'Evento',
        estagio: EstagioPipeline.PROPOSTA,
        valorEstimado: 3_500_000,
        responsavelId: joao.id,
      },
    }),
    prisma.lead.create({
      data: {
        nome: 'Otávio Brandão',
        email: 'otavio.brandao@example.com',
        origem: 'Inbound',
        estagio: EstagioPipeline.NEGOCIACAO,
        valorEstimado: 850_000,
        responsavelId: marina.id,
      },
    }),
    prisma.lead.create({
      data: {
        nome: 'Sofia Albuquerque',
        email: 'sofia.albuquerque@example.com',
        origem: 'LinkedIn',
        estagio: EstagioPipeline.PROSPECCAO,
        valorEstimado: 600_000,
        responsavelId: joao.id,
      },
    }),
  ]);

  console.log('📋 Criando suitabilities...');

  for (const c of clientes) {
    await prisma.suitability.create({
      data: {
        clienteId: c.id,
        respostas: {
          horizonte_anos: c.perfil === 'CONSERVADOR' ? 3 : c.perfil === 'MODERADO' ? 7 : 15,
          tolerancia_perda: c.perfil === 'CONSERVADOR' ? 5 : c.perfil === 'AGRESSIVO' ? 30 : 15,
          experiencia_anos: c.perfil === 'CONSERVADOR' ? 2 : 8,
        },
        pontuacao: c.perfil === 'CONSERVADOR' ? 15 : c.perfil === 'MODERADO' ? 35 : c.perfil === 'ARROJADO' ? 55 : 75,
        perfilCalculado: c.perfil,
        validoAte: new Date(Date.now() + 730 * 86400000),
        aplicadoPorId: c.responsavelId ?? joao.id,
      },
    });
  }

  console.log('💼 Criando posições (carteiras com gaps intencionais pro motor de IA encontrar)...');

  // Catálogo BTG:
  // [0]=CDB BTG | [1]=Tesouro IPCA+ | [2]=BTG Crédito Privado | [3]=BTG Absoluto Multimercado
  // [4]=BTG Dividendos | [5]=BPAC11 | [6]=BTLG11 (FII) | [7]=BDR S&P 500 | [8]=BTG Previdência | [9]=COE BTG
  //
  // Clientes: [0]=Mariana (MOD) | [1]=Ricardo (ARR) | [2]=Bianca (CONS) | [3]=Felipe (AGR) | [4]=Patrícia (MOD, prospect)

  const posicoes = [
    // Mariana (R$4.35M moderado): pesada em RF tradicional, sem renda variável/FII
    // GAP: zero exposição em RV/FII → motor deve sugerir BTLG11 ou BTG Dividendos
    { c: 0, p: 1, v: 2_500_000 }, // Tesouro IPCA+
    { c: 0, p: 8, v: 1_100_000 }, // BTG Previdência
    { c: 0, p: 2, v: 750_000 },   // BTG Crédito Privado

    // Ricardo (R$9.12M arrojado): mix BR amplo mas zero internacional
    // GAP: sem BDR/COE → motor deve sugerir BDR S&P 500 com score alto
    { c: 1, p: 1, v: 2_000_000 }, // Tesouro IPCA+
    { c: 1, p: 2, v: 2_500_000 }, // BTG Crédito Privado
    { c: 1, p: 3, v: 4_620_000 }, // BTG Absoluto Multimercado

    // Bianca (R$1.78M conservador): só Tesouro — categorias ricas vazias
    // GAP: sem CDB e sem Previdência (tributariamente eficiente) → motor sugere ambos
    { c: 2, p: 1, v: 1_780_000 }, // Tesouro IPCA+

    // Felipe (R$14.5M agressivo): pesado em BR, zero internacional/estruturado
    // GAP forte: sem BDR S&P 500 nem COE → motor sugere internacional com score alto
    { c: 3, p: 3, v: 8_000_000 }, // BTG Absoluto Multimercado
    { c: 3, p: 2, v: 3_500_000 }, // BTG Crédito Privado
    { c: 3, p: 1, v: 3_000_000 }, // Tesouro IPCA+

    // Patrícia (R$2.65M moderado, prospect): apenas parcialmente alocada
    // R$1.85M disponível — espaço pro motor sugerir várias categorias
    { c: 4, p: 1, v: 800_000 },   // Tesouro IPCA+
  ];

  await Promise.all(
    posicoes.map((pos) =>
      prisma.posicao.create({
        data: {
          clienteId: clientes[pos.c].id,
          produtoId: produtos[pos.p].id,
          valor: pos.v,
        },
      }),
    ),
  );

  // Uma recomendação já aprovada pra a tela não nascer 100% vazia.
  await prisma.recomendacao.create({
    data: {
      clienteId: clientes[2].id, // Bianca (conservadora)
      produtoId: produtos[8].id, // BTG Previdência RF Crédito Privado
      score: 0.92,
      justificativa:
        'Cliente conservadora 100% em Tesouro. Previdência PGBL do BTG traz vantagem tributária (dedução até 12% da renda) sem alterar o perfil de risco.',
      payload: { tipo: 'seed-inicial', regras: ['vantagem_tributaria_pgbl'] },
      status: StatusRecomendacao.APROVADA,
      aprovadoPorId: marina.id,
      aprovadoEm: new Date(),
    },
  });

  console.log('💬 Criando interações...');

  await Promise.all([
    prisma.interacao.create({
      data: {
        clienteId: clientes[0].id,
        autorId: joao.id,
        tipo: TipoInteracao.REUNIAO,
        assunto: 'Revisão de carteira Q2',
        resumo: 'Discutimos rebalanceamento da posição em renda fixa.',
        metadata: { duracaoMin: 45, local: 'presencial' },
      },
    }),
    prisma.interacao.create({
      data: {
        clienteId: clientes[1].id,
        autorId: joao.id,
        tipo: TipoInteracao.LIGACAO,
        assunto: 'Follow-up sobre BDR',
        resumo: 'Cliente pediu mais detalhes sobre alocação internacional.',
        metadata: { duracaoMin: 18 },
      },
    }),
    prisma.interacao.create({
      data: {
        clienteId: clientes[2].id,
        autorId: marina.id,
        tipo: TipoInteracao.EMAIL,
        assunto: 'Proposta aprovada',
        resumo: 'Cliente confirmou alocação em Tesouro IPCA+ 2035.',
      },
    }),
  ]);

  console.log('📜 Registrando auditoria inicial...');

  await prisma.auditoria.create({
    data: {
      userId: admin.id,
      acao: AcaoAuditoria.CRIACAO,
      entidade: 'Seed',
      diff: { mensagem: 'seed inicial executado' },
    },
  });

  console.log('\n✅ Seed concluído:');
  console.log(`   Users:         3`);
  console.log(`   Produtos:      ${produtos.length}`);
  console.log(`   Clientes:      ${clientes.length}`);
  console.log(`   Leads:         4`);
  console.log(`   Suitabilities: ${clientes.length}`);
  console.log(`   Recomendações: 3`);
  console.log(`   Interações:    3`);
}

main()
  .catch((e) => {
    console.error('❌ Seed falhou:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
