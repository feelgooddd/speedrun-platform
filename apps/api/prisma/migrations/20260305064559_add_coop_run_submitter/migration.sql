-- AlterTable
ALTER TABLE "CoopRun" ADD COLUMN     "submitted_by_id" TEXT;

-- AddForeignKey
ALTER TABLE "CoopRun" ADD CONSTRAINT "CoopRun_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
