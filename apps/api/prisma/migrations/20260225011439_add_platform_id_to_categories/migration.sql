-- DropForeignKey
ALTER TABLE "Category" DROP CONSTRAINT "Category_game_id_fkey";

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "platform_id" TEXT,
ALTER COLUMN "game_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "Game"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "Platform"("id") ON DELETE SET NULL ON UPDATE CASCADE;
