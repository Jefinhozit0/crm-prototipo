-- CreateTable
CREATE TABLE "posicoes" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "valor" DECIMAL(18,2) NOT NULL,
    "adquiridoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "posicoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "posicoes_clienteId_idx" ON "posicoes"("clienteId");

-- CreateIndex
CREATE UNIQUE INDEX "posicoes_clienteId_produtoId_key" ON "posicoes"("clienteId", "produtoId");

-- AddForeignKey
ALTER TABLE "posicoes" ADD CONSTRAINT "posicoes_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posicoes" ADD CONSTRAINT "posicoes_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "produtos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
