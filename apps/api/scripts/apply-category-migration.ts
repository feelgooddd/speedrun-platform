// prisma/apply-category-migration.ts
// Run this AFTER the schema migration

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as fs from 'fs';
import 'dotenv/config';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🔄 Applying category migration...\n');

  // Load migration data
  const migrationData = JSON.parse(
    fs.readFileSync('category-migration-data.json', 'utf-8')
  );

  console.log(`Processing ${migrationData.length} category-platform combinations\n`);

  const categoryMap = new Map<string, string>(); // oldCategoryId -> newCategoryId

  for (const migration of migrationData) {
    const key = `${migration.oldCategoryId}-${migration.platformId}`;
    
    if (!categoryMap.has(key)) {
      // Create new platform-specific category
      const newCategory = await prisma.category.create({
        data: {
          platform_id: migration.platformId,
          name: migration.categoryName,
          slug: migration.categorySlug,
        }
      });

      categoryMap.set(key, newCategory.id);
      console.log(`✓ Created category: ${migration.categoryName} for platform ${migration.platformId}`);
    }

    const newCategoryId = categoryMap.get(key)!;

    // Update all runs to point to new category
    await prisma.run.updateMany({
      where: {
        id: { in: migration.runIds }
      },
      data: {
        category_id: newCategoryId
      }
    });

    console.log(`  → Reassigned ${migration.runIds.length} runs`);
  }

  console.log('\n✅ Migration complete!');
  console.log('\nCleaning up old categories...');

  // Delete old categories (they should have no runs now)
  const oldCategoryIds = [...new Set<string>(migrationData.map((m: any) => m.oldCategoryId))];
  for (const oldId of oldCategoryIds) {
    try {
      await prisma.category.delete({ where: { id: oldId } });
      console.log(`✓ Deleted old category ${oldId}`);
    } catch (error) {
      console.warn(`⚠️  Could not delete category ${oldId}:`, error);
    }
  }

  console.log('\n✨ All done! Categories now belong to platforms.\n');

  await prisma.$disconnect();
}

main();
