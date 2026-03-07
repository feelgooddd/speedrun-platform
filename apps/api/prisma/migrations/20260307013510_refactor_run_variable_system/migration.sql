/*
  Warnings:

  - You are about to drop the column `is_coop` on the `Subcategory` table. All the data in the column will be lost.
  - You are about to drop the column `required_players` on the `Subcategory` table. All the data in the column will be lost.
  - You are about to drop the `CoopRun` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CoopRunRunner` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "CoopRun" DROP CONSTRAINT "CoopRun_category_id_fkey";

-- DropForeignKey
ALTER TABLE "CoopRun" DROP CONSTRAINT "CoopRun_platform_id_fkey";

-- DropForeignKey
ALTER TABLE "CoopRun" DROP CONSTRAINT "CoopRun_subcategory_id_fkey";

-- DropForeignKey
ALTER TABLE "CoopRun" DROP CONSTRAINT "CoopRun_submitted_by_id_fkey";

-- DropForeignKey
ALTER TABLE "CoopRun" DROP CONSTRAINT "CoopRun_system_id_fkey";

-- DropForeignKey
ALTER TABLE "CoopRunRunner" DROP CONSTRAINT "CoopRunRunner_coop_run_id_fkey";

-- DropForeignKey
ALTER TABLE "CoopRunRunner" DROP CONSTRAINT "CoopRunRunner_user_id_fkey";

-- AlterTable
ALTER TABLE "Run" ADD COLUMN     "is_coop" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "submitted_by_id" TEXT;

-- AlterTable
ALTER TABLE "Subcategory" DROP COLUMN "is_coop",
DROP COLUMN "required_players";

-- DropTable
DROP TABLE "CoopRun";

-- DropTable
DROP TABLE "CoopRunRunner";

-- CreateTable
CREATE TABLE "Variable" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "is_subcategory" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Variable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VariableValue" (
    "id" TEXT NOT NULL,
    "variable_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "is_coop" BOOLEAN NOT NULL DEFAULT false,
    "required_players" INTEGER,

    CONSTRAINT "VariableValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RunVariableValue" (
    "run_id" TEXT NOT NULL,
    "variable_value_id" TEXT NOT NULL,

    CONSTRAINT "RunVariableValue_pkey" PRIMARY KEY ("run_id","variable_value_id")
);

-- CreateTable
CREATE TABLE "RunRunner" (
    "run_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "RunRunner_pkey" PRIMARY KEY ("run_id","user_id")
);

-- AddForeignKey
ALTER TABLE "Variable" ADD CONSTRAINT "Variable_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariableValue" ADD CONSTRAINT "VariableValue_variable_id_fkey" FOREIGN KEY ("variable_id") REFERENCES "Variable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Run" ADD CONSTRAINT "Run_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunVariableValue" ADD CONSTRAINT "RunVariableValue_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "Run"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunVariableValue" ADD CONSTRAINT "RunVariableValue_variable_value_id_fkey" FOREIGN KEY ("variable_value_id") REFERENCES "VariableValue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunRunner" ADD CONSTRAINT "RunRunner_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "Run"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunRunner" ADD CONSTRAINT "RunRunner_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
