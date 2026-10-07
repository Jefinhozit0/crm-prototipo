-- Movimentacoes de carteira (aplicacao, resgate) e historico.
--
-- Invariante: posicoes.valor = soma das movimentacoes do par cliente/produto
-- (SALDO_INICIAL + APLICACAO - RESGATE). Para valer desde ja, cada posicao
-- existente ganha um lancamento SALDO_INICIAL com o valor atual, na data de
-- aquisicao. Nao altera nem apaga nenhuma posicao.

-- CreateEnum
CREATE TYPE "TipoMovimentacao" AS ENUM ('SALDO_INICIAL', 'APLICACAO', 'RESGATE');

-- CreateTable
CREATE TABLE "movimentacoes" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "tipo" "TipoMovimentacao" NOT NULL,
    "valor" DECIMAL(18,2) NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "observacao" TEXT,
    "desenquadrada" BOOLEAN NOT NULL DEFAULT false,
    "recomendacaoId" TEXT,
    "registradoPorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimentacoes_pkey" PRIMARY KEY ("id"),
    -- O tipo da o sinal; valor zero ou negativo nao tem significado
    CONSTRAINT "movimentacoes_valor_check" CHECK ("valor" > 0)
);

-- CreateIndex
CREATE INDEX "movimentacoes_clienteId_data_idx" ON "movimentacoes"("clienteId", "data");

-- CreateIndex
CREATE INDEX "movimentacoes_data_idx" ON "movimentacoes"("data");

-- CreateIndex
CREATE INDEX "movimentacoes_produtoId_idx" ON "movimentacoes"("produtoId");

-- AddForeignKey
ALTER TABLE "movimentacoes" ADD CONSTRAINT "movimentacoes_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes" ADD CONSTRAINT "movimentacoes_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "produtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes" ADD CONSTRAINT "movimentacoes_recomendacaoId_fkey" FOREIGN KEY ("recomendacaoId") REFERENCES "recomendacoes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes" ADD CONSTRAINT "movimentacoes_registradoPorId_fkey" FOREIGN KEY ("registradoPorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Saldo inicial das posicoes que ja existem (id deterministico: reaplicar o
-- INSERT nao duplica)
INSERT INTO "movimentacoes" ("id", "clienteId", "produtoId", "tipo", "valor", "data", "observacao")
SELECT 'si_' || p."id", p."clienteId", p."produtoId", 'SALDO_INICIAL', p."valor", p."adquiridoEm",
       'Saldo existente antes do registro de movimentacoes'
  FROM "posicoes" p
 WHERE p."valor" > 0
ON CONFLICT ("id") DO NOTHING;
