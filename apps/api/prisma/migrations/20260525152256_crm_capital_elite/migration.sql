-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'ASSESSOR', 'COMPLIANCE', 'READONLY');

-- CreateEnum
CREATE TYPE "PerfilInvestidor" AS ENUM ('CONSERVADOR', 'MODERADO', 'ARROJADO', 'AGRESSIVO');

-- CreateEnum
CREATE TYPE "StatusCliente" AS ENUM ('ATIVO', 'PROSPECTO', 'INATIVO', 'BLOQUEADO');

-- CreateEnum
CREATE TYPE "EstagioPipeline" AS ENUM ('PROSPECCAO', 'QUALIFICACAO', 'PROPOSTA', 'NEGOCIACAO', 'FECHADO', 'PERDIDO');

-- CreateEnum
CREATE TYPE "CategoriaProduto" AS ENUM ('RENDA_FIXA', 'RENDA_VARIAVEL', 'FUNDOS', 'PREVIDENCIA', 'ESTRUTURADOS', 'CAMBIO');

-- CreateEnum
CREATE TYPE "StatusRecomendacao" AS ENUM ('PENDENTE', 'APROVADA', 'RECUSADA', 'ATIVA', 'EXPIRADA');

-- CreateEnum
CREATE TYPE "TipoInteracao" AS ENUM ('EMAIL', 'LIGACAO', 'REUNIAO', 'WHATSAPP', 'TAREFA', 'NOTA');

-- CreateEnum
CREATE TYPE "AcaoAuditoria" AS ENUM ('CRIACAO', 'ATUALIZACAO', 'EXCLUSAO', 'LOGIN', 'APROVACAO_RECOMENDACAO', 'RECUSA_RECOMENDACAO', 'APROVACAO_CARTEIRA', 'EXPORTACAO_DADOS', 'ACESSO_DADO_SENSIVEL');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'ASSESSOR',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mfaSecret" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefone" TEXT,
    "cpfHash" TEXT NOT NULL,
    "cpfMasked" TEXT NOT NULL,
    "cidade" TEXT,
    "uf" TEXT,
    "perfil" "PerfilInvestidor" NOT NULL DEFAULT 'MODERADO',
    "patrimonio" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" "StatusCliente" NOT NULL DEFAULT 'PROSPECTO',
    "responsavelId" TEXT,
    "ultimaInteracao" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT,
    "telefone" TEXT,
    "origem" TEXT NOT NULL,
    "estagio" "EstagioPipeline" NOT NULL DEFAULT 'PROSPECCAO',
    "valorEstimado" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "observacoes" TEXT,
    "responsavelId" TEXT,
    "clienteId" TEXT,
    "clienteIdUnique" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "fechadoEm" TIMESTAMP(3),

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estagio_historico" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "estagio" "EstagioPipeline" NOT NULL,
    "notas" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estagio_historico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "produtos" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "emissor" TEXT NOT NULL,
    "categoria" "CategoriaProduto" NOT NULL,
    "rentabilidadeAno" DECIMAL(6,2) NOT NULL,
    "risco" INTEGER NOT NULL,
    "perfilMinimo" "PerfilInvestidor" NOT NULL,
    "liquidez" TEXT NOT NULL,
    "taxaAdmin" DECIMAL(5,2),
    "taxaPerformance" DECIMAL(5,2),
    "ticker" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "descricao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "produtos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suitability" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "respostas" JSONB NOT NULL,
    "pontuacao" INTEGER NOT NULL,
    "perfilCalculado" "PerfilInvestidor" NOT NULL,
    "versaoQuestionario" TEXT NOT NULL DEFAULT 'v1',
    "validoAte" TIMESTAMP(3) NOT NULL,
    "aplicadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aplicadoPorId" TEXT,

    CONSTRAINT "suitability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recomendacoes" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "score" DECIMAL(4,3) NOT NULL,
    "justificativa" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "StatusRecomendacao" NOT NULL DEFAULT 'PENDENTE',
    "aprovadoPorId" TEXT,
    "aprovadoEm" TIMESTAMP(3),
    "recusaMotivo" TEXT,
    "geradoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiraEm" TIMESTAMP(3),

    CONSTRAINT "recomendacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interacoes" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "autorId" TEXT NOT NULL,
    "tipo" "TipoInteracao" NOT NULL,
    "assunto" TEXT NOT NULL,
    "resumo" TEXT,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditoria" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "acao" "AcaoAuditoria" NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidadeId" TEXT,
    "diff" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_email_key" ON "clientes"("email");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_cpfHash_key" ON "clientes"("cpfHash");

-- CreateIndex
CREATE INDEX "clientes_responsavelId_status_idx" ON "clientes"("responsavelId", "status");

-- CreateIndex
CREATE INDEX "clientes_perfil_idx" ON "clientes"("perfil");

-- CreateIndex
CREATE UNIQUE INDEX "leads_clienteIdUnique_key" ON "leads"("clienteIdUnique");

-- CreateIndex
CREATE INDEX "leads_estagio_responsavelId_idx" ON "leads"("estagio", "responsavelId");

-- CreateIndex
CREATE INDEX "leads_createdAt_idx" ON "leads"("createdAt");

-- CreateIndex
CREATE INDEX "estagio_historico_leadId_criadoEm_idx" ON "estagio_historico"("leadId", "criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "produtos_ticker_key" ON "produtos"("ticker");

-- CreateIndex
CREATE INDEX "produtos_categoria_ativo_idx" ON "produtos"("categoria", "ativo");

-- CreateIndex
CREATE INDEX "produtos_perfilMinimo_idx" ON "produtos"("perfilMinimo");

-- CreateIndex
CREATE INDEX "suitability_clienteId_aplicadoEm_idx" ON "suitability"("clienteId", "aplicadoEm");

-- CreateIndex
CREATE INDEX "recomendacoes_clienteId_status_idx" ON "recomendacoes"("clienteId", "status");

-- CreateIndex
CREATE INDEX "recomendacoes_status_geradoEm_idx" ON "recomendacoes"("status", "geradoEm");

-- CreateIndex
CREATE INDEX "interacoes_clienteId_data_idx" ON "interacoes"("clienteId", "data" DESC);

-- CreateIndex
CREATE INDEX "interacoes_autorId_data_idx" ON "interacoes"("autorId", "data" DESC);

-- CreateIndex
CREATE INDEX "auditoria_userId_criadoEm_idx" ON "auditoria"("userId", "criadoEm");

-- CreateIndex
CREATE INDEX "auditoria_entidade_entidadeId_idx" ON "auditoria"("entidade", "entidadeId");

-- CreateIndex
CREATE INDEX "auditoria_acao_criadoEm_idx" ON "auditoria"("acao", "criadoEm");

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estagio_historico" ADD CONSTRAINT "estagio_historico_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suitability" ADD CONSTRAINT "suitability_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recomendacoes" ADD CONSTRAINT "recomendacoes_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recomendacoes" ADD CONSTRAINT "recomendacoes_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "produtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recomendacoes" ADD CONSTRAINT "recomendacoes_aprovadoPorId_fkey" FOREIGN KEY ("aprovadoPorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interacoes" ADD CONSTRAINT "interacoes_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interacoes" ADD CONSTRAINT "interacoes_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
