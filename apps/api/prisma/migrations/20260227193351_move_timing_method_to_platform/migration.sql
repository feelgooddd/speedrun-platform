/*
  Warnings:

  - You are about to drop the column `timing_method` on the `Game` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Game" DROP COLUMN "timing_method";

-- AlterTable
ALTER TABLE "Platform" ADD COLUMN     "timing_method" TEXT NOT NULL DEFAULT 'realtime';
