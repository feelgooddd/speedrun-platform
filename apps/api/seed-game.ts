import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// --- Interfaces for SRC Data ---
interface SRCRun {
  run: {
    id: string;
    comment?: string;
    videos?: { links?: Array<{ uri: string }> };
    players: Array<{ rel: string; id?: string; name?: string; }>;
    date: string;
    times: { realtime_t: number; realtime_noloads_t?: number; };
  };
}

interface SRCData {
  category: { name: string };
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

// --- User Cache Setup ---
const userCache = new Map<string, any>();
const CACHE_FILE = 'users-cache.json';

function loadUserCache() {
  if (fs.existsSync(CACHE_FILE)) {
    const cacheData = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    Object.entries(cacheData).forEach(([id, data]) => userCache.set(id, data));
    console.log(`📦 Loaded ${userCache.size} users from cache`);
  }
}

function saveUserCache() {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(Object.fromEntries(userCache), null, 2));
  console.log(`💾 Saved ${userCache.size} users to cache`);
}

async function fetchUserDetails(userId: string): Promise<SRCUserData | null> {
  if (userCache.has(userId)) return userCache.get(userId);
  try {
    await new Promise(res => setTimeout(res, 1000)); // Rate limit buffer
    const resp = await fetch(`https://www.speedrun.com/api/v1/users/${userId}`);
    if (!resp.ok) return null;
    const data = await resp.json();
    userCache.set(userId, data);
    return data;
  } catch { return null; }
}

async function getOrCreateUser(player: SRCRun['run']['players'][0]) {
  if (player.rel === 'user' && player.id) {
    let user = await prisma.user.findUnique({ where: { speedrun_com_id: player.id } });
    if (!user) {
      const userData = await fetchUserDetails(player.id);
      user = await prisma.user.create({
        data: {
          username: userData?.data.names.international.toLowerCase() || `runner_${player.id}`,
          display_name: userData?.data.names.international || player.id,
          speedrun_com_id: player.id,
          is_placeholder: true,
          country: userData?.data.location?.country?.code ?? null,
          twitch: userData?.data.twitch?.uri ?? null,
        }
      });
      console.log(`  👤 Created User: ${user.display_name}`);
    }
    return user;
  }

  const guestName = player.name || 'Unknown Guest';
  let guest = await prisma.user.findFirst({ 
    where: { username: guestName.toLowerCase(), is_placeholder: true } 
  });
  if (!guest) {
    guest = await prisma.user.create({
      data: { username: guestName.toLowerCase(), display_name: guestName, is_placeholder: true }
    });
    console.log(`  👤 Created Guest: ${guestName}`);
  }
  return guest;
}

// --- Execution Block ---
async function main() {
  const [gameSlug, platformSlug, filePathPrefix] = process.argv.slice(2);

  if (!gameSlug || !platformSlug || !filePathPrefix) {
    console.log('Usage: npx ts-node seed-game.ts <game-slug> <platform-slug> <path/prefix>');
    return;
  }

  loadUserCache();

  // 1. Resolve Game
  const game = await prisma.game.findUnique({ where: { slug: gameSlug } });
  if (!game) return console.error(`❌ Game "${gameSlug}" not found in database.`);

  // 2. Resolve Platform
  let platform = await prisma.platform.findFirst({
    where: { game_id: game.id, slug: platformSlug }
  });

  if (!platform) {
    platform = await prisma.platform.create({
      data: {
        game_id: game.id,
        name: platformSlug.toUpperCase(),
        slug: platformSlug,
        timing_method: platformSlug === 'pc' ? 'gametime' : 'realtime'
      }
    });
    console.log(`✨ Created Platform with CUID: ${platform.id}`);
  } else {
    console.log(`✅ Using Existing Platform CUID: ${platform.id}`);
  }

  // 3. Find and Process Files
  const dir = path.dirname(filePathPrefix);
  const base = path.basename(filePathPrefix);
  const files = fs.readdirSync(dir).filter(f => f.startsWith(base) && f.endsWith('.json'));

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const data: SRCData = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
    
    // Updated slug logic to trim trailing hyphens
    const categorySlug = data.category.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')      // Collapse multiple dashes
      .replace(/-+$/g, '');     // Remove trailing dashes

    // 4. Resolve Category
    let category = await prisma.category.findFirst({
      where: { platform_id: platform.id, slug: categorySlug }
    });

    if (!category) {
      category = await prisma.category.create({
        data: {
          platform_id: platform.id,
          name: data.category.name,
          slug: categorySlug
        }
      });
      console.log(`✨ Created Category: ${category.name} (${categorySlug})`);
    }

    console.log(`\n📂 Processing ${data.runs.length} runs for ${category.name}...`);

    for (const srcRun of data.runs) {
      const exists = await prisma.run.findUnique({ where: { speedrun_com_id: srcRun.run.id } });
      if (exists) continue;

      try {
        const user = await getOrCreateUser(srcRun.run.players[0]);
        await prisma.run.create({
          data: {
            user_id: user.id,
            category_id: category.id,
            platform_id: platform.id,
            speedrun_com_id: srcRun.run.id,
            realtime_ms: srcRun.run.times.realtime_t ? Math.round(srcRun.run.times.realtime_t * 1000) : null,
            gametime_ms: srcRun.run.times.realtime_noloads_t ? Math.round(srcRun.run.times.realtime_noloads_t * 1000) : null,
            video_url: srcRun.run.videos?.links?.[0]?.uri || null,
            comment: srcRun.run.comment || null,
            verified: true,
            submitted_at: new Date(srcRun.run.date),
            verified_at: new Date(srcRun.run.date),
          }
        });
      } catch (err) {
        console.error(`  ❌ Failed run ${srcRun.run.id}`);
      }
    }
  }

  saveUserCache();
  console.log('\n🚀 Seeding Complete.');
}

main().catch(console.error).finally(() => prisma.$disconnect());