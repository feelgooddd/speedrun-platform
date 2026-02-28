/*
  Warnings:

  - You are about to drop the column `timing_method` on the `Category` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Category" DROP COLUMN "timing_method";

-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "timing_method" TEXT NOT NULL DEFAULT 'realtime';
