// scripts/backfill-display-names.ts
// Run with: npx ts-node scripts/backfill-display-names.ts

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('\n🔄 Backfilling display names for placeholder users...\n');

  const users = await prisma.user.findMany({
    where: {
      is_placeholder: true,
      display_name: null,
    }
  });

  console.log(`Found ${users.length} users to backfill\n`);

  let updated = 0;
  let failed = 0;

  for (const user of users) {
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          display_name: user.username,
          username: user.username.toLowerCase(),
        }
      });

      console.log(`  ✓ ${user.username} → display: ${user.username} / username: ${user.username.toLowerCase()}`);
      updated++;
    } catch (error: any) {
      console.log(`  ❌ ${user.username}: ${error.message}`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`✨ Backfill complete`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Failed:  ${failed}`);
  console.log('='.repeat(60) + '\n');
}

main()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());