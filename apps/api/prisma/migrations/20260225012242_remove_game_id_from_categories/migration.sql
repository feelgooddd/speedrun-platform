/*
  Warnings:

  - You are about to drop the column `game_id` on the `Category` table. All the data in the column will be lost.
  - Made the column `platform_id` on table `Category` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Category" DROP CONSTRAINT "Category_game_id_fkey";

-- DropForeignKey
ALTER TABLE "Category" DROP CONSTRAINT "Category_platform_id_fkey";

-- AlterTable
ALTER TABLE "Category" DROP COLUMN "game_id",
ALTER COLUMN "platform_id" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "Platform"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
