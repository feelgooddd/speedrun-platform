// prisma/migrate-categories-to-platforms.ts
// Run this BEFORE changing schema.prisma

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🔄 Migrating categories from games to platforms...\n');

  // Get all runs grouped by game, platform, and category
  const games = await prisma.game.findMany({
    include: {
      platforms: true,
      categories: {
        include: {
          runs: {
            include: {
              platform: true
            }
          }
        }
      }
    }
  });

  const categoryMigrations: any[] = [];

  for (const game of games) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Game: ${game.name}`);
    console.log('='.repeat(60));

    for (const platform of game.platforms) {
      console.log(`\n  Platform: ${platform.name}`);

      // Find which categories have runs on this platform
      const categoriesOnPlatform = new Set<string>();
      
      for (const category of game.categories) {
        const runsOnThisPlatform = category.runs.filter(
          run => run.platform_id === platform.id
        );
        
        if (runsOnThisPlatform.length > 0) {
          categoriesOnPlatform.add(category.id);
          console.log(`    - ${category.name} (${runsOnThisPlatform.length} runs)`);
          
          categoryMigrations.push({
            oldCategoryId: category.id,
            platformId: platform.id,
            categoryName: category.name,
            categorySlug: category.slug,
            runIds: runsOnThisPlatform.map(r => r.id)
          });
        }
      }
    }
  }

 console.log(`\n\n${'='.repeat(60)}`);
  console.log('Migration Plan:');
  console.log('='.repeat(60) + '\n');

  console.log(`Total category-platform combinations to create: ${categoryMigrations.length}`);
  console.log('\nThis will:');
  console.log('1. Add platform_id column to Category table');
  console.log('2. Create new categories for each platform');
  console.log('3. Reassign runs to the correct platform-specific categories');
  console.log('4. Delete old game-level categories\n');

  // Save migration data to a file for the actual migration
  const fs = require('fs');
  fs.writeFileSync(
    'category-migration-data.json',
    JSON.stringify(categoryMigrations, null, 2)
  );

  console.log('✅ Migration plan saved to category-migration-data.json');
  console.log('\nNext steps:');
  console.log('1. Update your schema.prisma file');
  console.log('2. Run: npx prisma migrate dev --name categories_to_platforms');
  console.log('3. Run: npx ts-node prisma/apply-category-migration.ts\n');

  await prisma.$disconnect();
}

main();
