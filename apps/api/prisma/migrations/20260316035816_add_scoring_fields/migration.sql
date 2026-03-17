-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "scoring_type" TEXT;

-- AlterTable
ALTER TABLE "LevelCategory" ADD COLUMN     "scoring_type" TEXT;

-- AlterTable
ALTER TABLE "Run" ADD COLUMN     "score_value" INTEGER;
