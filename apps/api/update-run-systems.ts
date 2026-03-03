// update-run-systems.ts
// Reads all scraped JSON files and updates the system field on existing runs
// Run with: npx ts-node update-run-systems.ts <directory>
// Example: npx ts-node update-run-systems.ts ./scrapers

import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// Map SRC platform IDs -> System table IDs
const PLATFORM_MAP: Record<string, string> = {
  '4p9z06rn': 'c4602229-f363-44c3-b064-71efd21d56fd', // GameCube
  'n5e17e27': 'e6e7c932-a5a1-4ea2-b754-70dc0305e395', // PlayStation 2
  'jm95zz9o': '42932076-ba63-457c-beac-f239d2854716', // Xbox
};

async function main() {
  const dir = process.argv[2];

  if (!dir) {
    console.error('Usage: npx ts-node update-run-systems.ts <directory>');
    process.exit(1);
  }

  const files = fs.readdirSync(dir).filter(
    f => f.endsWith('.json') &&
    !f.includes('variables') &&
    !f.includes('cache') &&
    !f.includes('raw')
  );

  console.log(`Found ${files.length} JSON files in ${dir}\n`);

  let updated = 0;
  let skipped = 0;
  let notFound = 0;

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const data = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));

    if (!data.runs || !Array.isArray(data.runs)) continue;

    console.log(`Processing ${file} (${data.runs.length} runs)...`);

    for (const srcRun of data.runs) {
      const platformId = srcRun.run?.system?.platform;
      const systemId = platformId ? (PLATFORM_MAP[platformId] ?? null) : null;

      if (!systemId) {
        skipped++;
        continue;
      }

      const result = await prisma.run.updateMany({
        where: { speedrun_com_id: srcRun.run.id },
        data: { system_id: systemId },
      });

      if (result.count > 0) {
        updated++;
      } else {
        notFound++;
      }
    }
  }

  console.log('\n✓ Done!');
  console.log(`  Updated:   ${updated}`);
  console.log(`  Skipped (no mapping): ${skipped}`);
  console.log(`  Not in DB: ${notFound}`);
}

main()
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());