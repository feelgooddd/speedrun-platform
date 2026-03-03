-- CreateTable
CREATE TABLE "PlatformSystem" (
    "platform_id" TEXT NOT NULL,
    "system_id" TEXT NOT NULL,

    CONSTRAINT "PlatformSystem_pkey" PRIMARY KEY ("platform_id","system_id")
);

-- AddForeignKey
ALTER TABLE "PlatformSystem" ADD CONSTRAINT "PlatformSystem_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "Platform"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformSystem" ADD CONSTRAINT "PlatformSystem_system_id_fkey" FOREIGN KEY ("system_id") REFERENCES "System"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
