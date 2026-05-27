-- CreateEnum
CREATE TYPE "Tributacao" AS ENUM ('TRIBUTADO', 'ISENTO', 'INCENTIVADO');

-- AlterTable
ALTER TABLE "produtos" ADD COLUMN     "tributacao" "Tributacao" NOT NULL DEFAULT 'TRIBUTADO';
