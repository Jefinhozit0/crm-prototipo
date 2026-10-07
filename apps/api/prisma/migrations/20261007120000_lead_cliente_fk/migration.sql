-- Conversão de lead em cliente: leads.clienteId vira FK real (única) para clientes
-- e a coluna marcadora clienteIdUnique (nunca usada) sai.
--
-- Não apaga nem corrige dados. Se houver lead apontando para cliente inexistente,
-- dois leads no mesmo cliente, ou valor em clienteIdUnique que não seja cópia de
-- clienteId, a migração ABORTA com a contagem: os dados precisam ser revisados
-- por alguém antes (ver docs/relatorio-evolucao.md).

DO $$
DECLARE
  orfaos     integer;
  duplicados integer;
  marcadores integer;
BEGIN
  SELECT count(*) INTO orfaos
    FROM "leads" l
   WHERE l."clienteId" IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM "clientes" c WHERE c."id" = l."clienteId");

  SELECT count(*) INTO duplicados
    FROM (SELECT "clienteId" FROM "leads"
           WHERE "clienteId" IS NOT NULL
           GROUP BY "clienteId" HAVING count(*) > 1) d;

  SELECT count(*) INTO marcadores
    FROM "leads"
   WHERE "clienteIdUnique" IS NOT NULL
     AND "clienteIdUnique" IS DISTINCT FROM "clienteId";

  IF orfaos > 0 OR duplicados > 0 OR marcadores > 0 THEN
    RAISE EXCEPTION
      'leads.clienteId inconsistente: % órfão(s), % cliente(s) com mais de um lead, % marcador(es) divergente(s). Revise os dados antes de migrar.',
      orfaos, duplicados, marcadores;
  END IF;
END $$;

-- DropIndex
DROP INDEX "leads_clienteIdUnique_key";

-- AlterTable
ALTER TABLE "leads" DROP COLUMN "clienteIdUnique";

-- CreateIndex
CREATE UNIQUE INDEX "leads_clienteId_key" ON "leads"("clienteId");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
