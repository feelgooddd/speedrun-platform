import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import 'dotenv/config'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
  const user = await prisma.user.findFirst()
  const category = await prisma.category.findFirst({ where: { slug: 'any' } })
  const platform = await prisma.platform.findFirst({ where: { slug: 'pc' } })

  const run = await prisma.run.create({
    data: {
      user_id: user!.id,
      category_id: category!.id,
      platform_id: platform!.id,
      time_ms: 3661000,
      video_url: 'https://twitch.tv/videos/123456',
      verified: true,
    }
  })

  console.log('Run created:', run.id)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())