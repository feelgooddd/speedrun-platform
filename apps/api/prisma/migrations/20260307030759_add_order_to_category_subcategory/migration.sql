-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Subcategory" ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0;
