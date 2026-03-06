-- AlterTable
ALTER TABLE "Subcategory" ADD COLUMN     "is_coop" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "CoopRun" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "platform_id" TEXT NOT NULL,
    "subcategory_id" TEXT NOT NULL,
    "realtime_ms" INTEGER,
    "gametime_ms" INTEGER,
    "comment" TEXT,
    "video_url" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "rejected" BOOLEAN NOT NULL DEFAULT false,
    "reject_reason" TEXT,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verified_at" TIMESTAMP(3),
    "system_id" TEXT,

    CONSTRAINT "CoopRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoopRunRunner" (
    "coop_run_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "CoopRunRunner_pkey" PRIMARY KEY ("coop_run_id","user_id")
);

-- AddForeignKey
ALTER TABLE "CoopRun" ADD CONSTRAINT "CoopRun_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoopRun" ADD CONSTRAINT "CoopRun_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "Platform"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoopRun" ADD CONSTRAINT "CoopRun_subcategory_id_fkey" FOREIGN KEY ("subcategory_id") REFERENCES "Subcategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoopRun" ADD CONSTRAINT "CoopRun_system_id_fkey" FOREIGN KEY ("system_id") REFERENCES "System"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoopRunRunner" ADD CONSTRAINT "CoopRunRunner_coop_run_id_fkey" FOREIGN KEY ("coop_run_id") REFERENCES "CoopRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoopRunRunner" ADD CONSTRAINT "CoopRunRunner_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
