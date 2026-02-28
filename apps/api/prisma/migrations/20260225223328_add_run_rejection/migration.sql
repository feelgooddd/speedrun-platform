-- AlterTable
ALTER TABLE "Run" ADD COLUMN     "reject_reason" TEXT,
ADD COLUMN     "rejected" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "verified" SET DEFAULT false;
