// prisma/seed-game.ts
// Run with: npx ts-node prisma/seed-game.ts <game-slug> <platform-name> <file-prefix>
// Example: npx ts-node prisma/seed-game.ts hp1 gba hp1gba
//
// NOTE: This script is for categories WITHOUT subcategories.
//       If your category has subcategories (e.g. GBC Any% with version splits),
//       use seed-platform-with-subcategories.ts instead.

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as fs from 'fs';
import 'dotenv/config';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

interface SRCRun {
  place: number;
  run: {
    id: string;
    weblink: string;
    comment?: string;
    videos?: { links?: Array<{ uri: string }> };
    players: Array<{
      rel: string;
      id?: string;
      name?: string;
    }>;
    date: string;
    times: {
      primary_t: number;
      realtime_t: number;
      realtime_noloads_t?: number;
    };
    system: {
      platform: string;
    };
  };
}

interface SRCData {
  game: { id: string; name: string; slug: string };
  category: { id: string; name: string };
  runs: SRCRun[];
}

interface SRCUserData {
  data: {
    id: string;
    names: { international: string };
    location?: { country?: { code: string } };
    twitch?: { uri: string };
  };
}

const userCache = new Map<string, any>();
const CACHE_FILE = 'users-cache.json';

function loadUserCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const cacheData = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
      Object.entries(cacheData).forEach(([id, data]) => userCache.set(id, data));
      console.log(`📦 Loaded ${userCache.size} users from cache\n`);
    }
  } catch (error) {
    console.warn('Could not load user cache:', error);
  }
}

function saveUserCache() {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(Object.fromEntries(userCache), null, 2));
    console.log(`\n💾 Saved ${userCache.size} users to cache`);
  } catch (error) {
    console.warn('Could not save user cache:', error);
  }
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchUserDetails(userId: string): Promise<SRCUserData | null> {
  if (userCache.has(userId)) return userCache.get(userId);

  try {
    await sleep(1000);
    const response = await fetch(`https://www.speedrun.com/api/v1/users/${userId}`);
    if (!response.ok) {
      console.warn(`Failed to fetch user ${userId}: ${response.status}`);
      return null;
    }
    const data = await response.json();
    userCache.set(userId, data);
    return data;
  } catch (error) {
    console.warn(`Error fetching user ${userId}:`, error);
    return null;
  }
}

async function getOrCreateUser(player: SRCRun['run']['players'][0]) {
  if (player.rel === 'user' && player.id) {
    let user = await prisma.user.findUnique({ where: { speedrun_com_id: player.id } });

    if (!user) {
      const userData = await fetchUserDetails(player.id);

      if (userData) {
        const src = userData.data;
        user = await prisma.user.create({
          data: {
            username: src.names.international.toLowerCase(),
            display_name: src.names.international,
            speedrun_com_id: player.id,
            is_placeholder: true,
            country: src.location?.country?.code ?? null,
            twitch: src.twitch?.uri ?? null,
          }
        });
        console.log(`  Created user: ${user.username}`);
      } else {
        user = await prisma.user.create({
          data: {
            username: `runner_${player.id}`,
            speedrun_com_id: player.id,
            is_placeholder: true,
          }
        });
        console.log(`  Created user (fallback): ${user.username}`);
      }
    }
    return user;
  }

  if (player.rel === 'guest' && player.name) {
    let user = await prisma.user.findUnique({ where: { username: player.name } });

    if (!user) {
      user = await prisma.user.create({
        data: { username: player.name.toLowerCase(), display_name: player.name, is_placeholder: true }
      });
      console.log(`  Created guest user: ${user.username}`);
    }
    return user;
  }

  throw new Error('Invalid player data');
}

async function seedFile(filename: string, gameId: string, platform: { id: string; timing_method: string }) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Processing: ${filename}`);
  console.log('='.repeat(60));

  const srcData: SRCData = JSON.parse(fs.readFileSync(filename, 'utf-8'));
  const categoryName = srcData.category.name;

  console.log(`Category: ${categoryName}`);
  console.log(`Total runs: ${srcData.runs.length}\n`);

  // Find or create category
  const categorySlug = categoryName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/^-+|-+$/g, '');
  let category = await prisma.category.findFirst({
    where: { slug: categorySlug, platform_id: platform.id }
  });

  if (!category) {
    category = await prisma.category.create({
      data: { platform_id: platform.id, name: categoryName, slug: categorySlug }
    });
    console.log(`✓ Created category: ${category.name}`);
  } else {
    console.log(`✓ Category exists: ${category.name}`);
  }

  console.log('\nImporting runs...');

  let imported = 0;
  let skipped = 0;

  for (const srcRun of srcData.runs) {
    const existing = await prisma.run.findUnique({ where: { speedrun_com_id: srcRun.run.id } });
    if (existing) { skipped++; continue; }

    try {
      const player = srcRun.run.players[0];
      const user = await getOrCreateUser(player);
      const videoUrl = srcRun.run.videos?.links?.[0]?.uri ?? null;

      const realtimeMs = srcRun.run.times.realtime_t
        ? Math.round(srcRun.run.times.realtime_t * 1000)
        : null;

      const gametimeMs = srcRun.run.times.realtime_noloads_t
        ? Math.round(srcRun.run.times.realtime_noloads_t * 1000)
        : null;

      await prisma.run.create({
        data: {
          user_id: user.id,
          category_id: category.id,
          platform_id: platform.id,
          realtime_ms: realtimeMs,
          gametime_ms: gametimeMs,
          comment: srcRun.run.comment ?? null,
          video_url: videoUrl,
          verified: true,
          speedrun_com_id: srcRun.run.id,
          submitted_at: new Date(srcRun.run.date),
          verified_at: new Date(srcRun.run.date),
        }
      });

      imported++;
      if (imported % 10 === 0) console.log(`  Imported ${imported} runs...`);
    } catch (error) {
      console.error(`  Error importing run ${srcRun.run.id}:`, error);
    }
  }

  console.log(`\n✓ Done: ${imported} imported, ${skipped} skipped`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 3) {
    console.error('Usage: npx ts-node prisma/seed-game.ts <game-slug> <platform-name> <file-prefix>');
    console.error('Example: npx ts-node prisma/seed-game.ts hp1 gba hp1gba');
    process.exit(1);
  }

  const [gameSlug, platformName, filePrefix] = args;

  console.log(`\n🎮 Seeding ${gameSlug.toUpperCase()} - ${platformName.toUpperCase()}\n`);

  loadUserCache();

  const game = await prisma.game.findUnique({ where: { slug: gameSlug } });
  if (!game) {
    console.error(`Game "${gameSlug}" not found. Create it first with your main seed.`);
    process.exit(1);
  }
  console.log(`✓ Found game: ${game.name}\n`);

  // Find or create platform
  const platformSlug = platformName.toLowerCase().replace(/\s+/g, '-');
  let platform = await prisma.platform.findFirst({
    where: { game_id: game.id, slug: platformSlug }
  });

  if (!platform) {
    platform = await prisma.platform.create({
      data: {
        game_id: game.id,
        name: platformName.toUpperCase(),
        slug: platformSlug,
        timing_method: 'realtime',
      }
    });
    console.log(`✓ Created platform: ${platform.name}\n`);
  } else {
    console.log(`✓ Platform exists: ${platform.name} (timing: ${platform.timing_method})\n`);
  }

  // Find all matching JSON files
  const files = fs.readdirSync('.').filter(f =>
    f.startsWith(filePrefix) && f.endsWith('.json') && !f.includes('cache') && !f.includes('variables')
  );

  if (files.length === 0) {
    console.error(`No JSON files found with prefix "${filePrefix}"`);
    process.exit(1);
  }

  console.log(`Found ${files.length} file(s):\n`);
  files.forEach(f => console.log(`  - ${f}`));

  for (const file of files) {
    try {
      await seedFile(file, game.id, platform);
    } catch (error) {
      console.error(`\n❌ Error processing ${file}:`, error);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✨ All files processed!');
  console.log('='.repeat(60) + '\n');

  saveUserCache();

  const [totalRuns, totalUsers, totalCategories] = await Promise.all([
    prisma.run.count(),
    prisma.user.count(),
    prisma.category.count(),
  ]);

  console.log('📊 DB Summary:');
  console.log(`  Runs:       ${totalRuns}`);
  console.log(`  Users:      ${totalUsers}`);
  console.log(`  Categories: ${totalCategories}\n`);
}

main()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());