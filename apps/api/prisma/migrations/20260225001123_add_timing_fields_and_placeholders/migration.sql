/*
  Warnings:

  - A unique constraint covering the columns `[speedrun_com_id]` on the table `Run` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[speedrun_com_id]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Run" ADD COLUMN     "gametime_ms" INTEGER,
ADD COLUMN     "realtime_ms" INTEGER,
ADD COLUMN     "speedrun_com_id" TEXT,
ALTER COLUMN "video_url" DROP NOT NULL,
ALTER COLUMN "verified" SET DEFAULT true;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "is_placeholder" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "speedrun_com_id" TEXT,
ALTER COLUMN "email" DROP NOT NULL,
ALTER COLUMN "password_hash" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Run_speedrun_com_id_key" ON "Run"("speedrun_com_id");

-- CreateIndex
CREATE UNIQUE INDEX "User_speedrun_com_id_key" ON "User"("speedrun_com_id");
