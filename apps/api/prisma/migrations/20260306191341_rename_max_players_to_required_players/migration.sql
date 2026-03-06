/*
  Warnings:

  - You are about to drop the column `max_players` on the `Subcategory` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Subcategory" DROP COLUMN "max_players",
ADD COLUMN     "required_players" INTEGER;
