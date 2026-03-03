/*
  Warnings:

  - You are about to drop the column `created_at` on the `System` table. All the data in the column will be lost.
  - You are about to drop the column `platform_id` on the `System` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[name]` on the table `System` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "System" DROP CONSTRAINT "System_platform_id_fkey";

-- AlterTable
ALTER TABLE "System" DROP COLUMN "created_at",
DROP COLUMN "platform_id";

-- CreateIndex
CREATE UNIQUE INDEX "System_name_key" ON "System"("name");
