/*
  Warnings:

  - You are about to drop the column `system` on the `Run` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Run" DROP COLUMN "system",
ADD COLUMN     "system_id" TEXT;

-- CreateTable
CREATE TABLE "System" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "platform_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "System_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Run" ADD CONSTRAINT "Run_system_id_fkey" FOREIGN KEY ("system_id") REFERENCES "System"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "System" ADD CONSTRAINT "System_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "Platform"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
