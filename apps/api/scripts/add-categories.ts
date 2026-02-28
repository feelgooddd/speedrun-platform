// import { PrismaClient } from '@prisma/client'
// import { PrismaPg } from '@prisma/adapter-pg'
// import 'dotenv/config'

// const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
// const prisma = new PrismaClient({ adapter })

// async function main() {
//   const games = await prisma.game.findMany()
  
//   for (const game of games) {
//     await prisma.category.create({
//       data: {
//         game_id: game.id,
//         name: '100%',
//         slug: '100',
//       }
//     })
//     console.log(`Added 100% to ${game.name}`)
//   }
// }

// main()
//   .catch(console.error)
//   .finally(() => prisma.$disconnect())