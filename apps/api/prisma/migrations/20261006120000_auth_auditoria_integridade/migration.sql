-- Evolução MVP: refresh tokens com rotação/revogação, auditoria com requestId,
-- retenção de suitability/recomendações (Restrict em vez de Cascade), FK do
-- aplicador da suitability, índices e CHECKs de integridade.
--
-- Não apaga dados. A única escrita é anular aplicadoPorId que aponte pra usuário
-- inexistente (referência já quebrada), necessário pra criar a FK.

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AcaoAuditoria" ADD VALUE 'LOGOUT';
ALTER TYPE "AcaoAuditoria" ADD VALUE 'LOGIN_FALHA';
ALTER TYPE "AcaoAuditoria" ADD VALUE 'GERACAO_RECOMENDACAO';
ALTER TYPE "AcaoAuditoria" ADD VALUE 'APLICACAO_SUITABILITY';
ALTER TYPE "AcaoAuditoria" ADD VALUE 'REUSO_REFRESH_TOKEN';

-- DropForeignKey
ALTER TABLE "suitability" DROP CONSTRAINT "suitability_clienteId_fkey";

-- DropForeignKey
ALTER TABLE "recomendacoes" DROP CONSTRAINT "recomendacoes_clienteId_fkey";

-- DropIndex
DROP INDEX "users_email_idx";

-- DropIndex
DROP INDEX "posicoes_clienteId_idx";

-- AlterTable
ALTER TABLE "auditoria" ADD COLUMN     "requestId" TEXT;

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "familiaId" TEXT NOT NULL,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "revogadoEm" TIMESTAMP(3),
    "substituidoPor" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "refresh_tokens_familiaId_idx" ON "refresh_tokens"("familiaId");

-- CreateIndex
CREATE INDEX "refresh_tokens_expiraEm_idx" ON "refresh_tokens"("expiraEm");

-- CreateIndex
CREATE INDEX "posicoes_produtoId_idx" ON "posicoes"("produtoId");

-- CreateIndex
CREATE INDEX "recomendacoes_produtoId_idx" ON "recomendacoes"("produtoId");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suitability" ADD CONSTRAINT "suitability_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Referências órfãs (usuário removido) impediriam a criação da FK abaixo
UPDATE "suitability" SET "aplicadoPorId" = NULL
WHERE "aplicadoPorId" IS NOT NULL
  AND "aplicadoPorId" NOT IN (SELECT "id" FROM "users");

-- AddForeignKey
ALTER TABLE "suitability" ADD CONSTRAINT "suitability_aplicadoPorId_fkey" FOREIGN KEY ("aplicadoPorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recomendacoes" ADD CONSTRAINT "recomendacoes_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CHECKs de domínio. NOT VALID: valem pra toda escrita nova sem varrer/travar
-- dados legados. Depois de conferir a base: ALTER TABLE ... VALIDATE CONSTRAINT ...
ALTER TABLE "produtos" ADD CONSTRAINT "produtos_risco_check" CHECK ("risco" BETWEEN 1 AND 5) NOT VALID;
ALTER TABLE "produtos" ADD CONSTRAINT "produtos_taxas_check" CHECK (("taxaAdmin" IS NULL OR "taxaAdmin" >= 0) AND ("taxaPerformance" IS NULL OR "taxaPerformance" >= 0)) NOT VALID;
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_patrimonio_check" CHECK ("patrimonio" >= 0) NOT VALID;
ALTER TABLE "posicoes" ADD CONSTRAINT "posicoes_valor_check" CHECK ("valor" >= 0) NOT VALID;
ALTER TABLE "leads" ADD CONSTRAINT "leads_valor_estimado_check" CHECK ("valorEstimado" >= 0) NOT VALID;
ALTER TABLE "recomendacoes" ADD CONSTRAINT "recomendacoes_score_check" CHECK ("score" >= 0 AND "score" <= 1) NOT VALID;
ALTER TABLE "suitability" ADD CONSTRAINT "suitability_pontuacao_check" CHECK ("pontuacao" BETWEEN 0 AND 100) NOT VALID;
