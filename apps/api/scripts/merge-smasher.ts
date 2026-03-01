// scripts/merge-smasher.ts
// Run with: npx ts-node scripts/merge-smasher.ts

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const KEEP_ID = 'cmm264e9k00403j8oznw6hhae';   // smasher419 (lowercase, keeping)
const DELETE_ID = 'cmm7zzvm5001sh28o1ieegeuy';  // Smasher419 (placeholder, deleting)

async function main() {
  console.log('\n🔄 Merging Smasher419 into smasher419...\n');

  // Reassign runs from DELETE_ID to KEEP_ID
  const updated = await prisma.run.updateMany({
    where: { user_id: DELETE_ID },
    data: { user_id: KEEP_ID }
  });
  console.log(`✓ Reassigned ${updated.count} run(s) to smasher419`);

  // Set display_name on the keeper
  await prisma.user.update({
    where: { id: KEEP_ID },
    data: { display_name: 'Smasher419' }
  });
  console.log(`✓ Set display_name to Smasher419`);

  // Delete the duplicate
  await prisma.user.delete({ where: { id: DELETE_ID } });
  console.log(`✓ Deleted placeholder Smasher419\n`);

  console.log('✨ Done!');
}

main()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());