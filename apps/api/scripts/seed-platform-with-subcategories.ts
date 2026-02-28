// prisma/seed-platform-with-subcategories.ts
// Run with: npx ts-node prisma/seed-platform-with-subcategories.ts <game-slug> <platform-name> <file-prefix> <variables-file>
// Example: npx ts-node prisma/seed-platform-with-subcategories.ts hp1 gbc hp1gbc 29d30ydl-variables.json

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
    videos?: { links?: Array<{ uri: string }> };
    players: Array<{
      rel: string;
      id?: string;
      name?: string;
      uri?: string;
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
    values: Record<string, string>; // Subcategory data
  };
}

interface SRCData {
  game: {
    id: string;
    name: string;
    slug: string;
  };
  category: {
    id: string;
    name: string;
  };
  runs: SRCRun[];
}

interface SRCUserData {
  data: {
    id: string;
    names: {
      international: string;
    };
    location?: {
      country?: {
        code: string;
      };
    };
    twitch?: {
      uri: string;
    };
  };
}

interface Variable {
  id: string;
  name: string;
  'is-subcategory': boolean;
  values: {
    values: Record<string, {
      label: string;
    }>;
  };
}

// Cache for fetched users to avoid duplicate API calls
const userCache = new Map<string, any>();
const CACHE_FILE = 'users-cache.json';

// Load existing cache on startup
function loadUserCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const cacheData = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
      Object.entries(cacheData).forEach(([id, data]) => {
        userCache.set(id, data);
      });
      console.log(`📦 Loaded ${userCache.size} users from cache\n`);
    }
  } catch (error) {
    console.warn('Could not load user cache:', error);
  }
}

// Save cache to disk
function saveUserCache() {
  try {
    const cacheData = Object.fromEntries(userCache);
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cacheData, null, 2));
    console.log(`\n💾 Saved ${userCache.size} users to cache`);
  } catch (error) {
    console.warn('Could not save user cache:', error);
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchUserDetails(userId: string): Promise<SRCUserData | null> {
  if (userCache.has(userId)) {
    return userCache.get(userId);
  }

  try {
    await sleep(1000); // Rate limit
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

async function getOrCreateUser(player: any) {
  // Player is a registered SRC user
  if (player.rel === 'user' && player.id) {
    let user = await prisma.user.findUnique({
      where: { speedrun_com_id: player.id }
    });

    if (!user) {
      // Fetch full user details from SRC API
      const userData = await fetchUserDetails(player.id);
      
      if (userData) {
        const srcUser = userData.data;
        user = await prisma.user.create({
          data: {
            username: srcUser.names.international,
            speedrun_com_id: player.id,
            is_placeholder: true,
            country: srcUser.location?.country?.code || null,
            twitch: srcUser.twitch?.uri || null,
          }
        });
        console.log(`  Created placeholder user: ${user.username}`);
      } else {
        // Fallback if API fetch fails
        user = await prisma.user.create({
          data: {
            username: `runner_${player.id}`,
            speedrun_com_id: player.id,
            is_placeholder: true,
          }
        });
        console.log(`  Created placeholder user (fallback): ${user.username}`);
      }
    }
    return user;
  }
  
  // Player is a guest (not registered on SRC)
  if (player.rel === 'guest' && player.name) {
    let user = await prisma.user.findUnique({
      where: { username: player.name }
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          username: player.name,
          is_placeholder: true,
        }
      });
      console.log(`  Created placeholder user (guest): ${user.username}`);
    }
    return user;
  }

  throw new Error('Invalid player data');
}

// Build subcategory map from variables
function buildSubcategoryMap(variables: Variable[]): Map<string, Record<string, string>> {
  const map = new Map<string, Record<string, string>>();
  
  for (const variable of variables) {
    if (variable['is-subcategory']) {
      const valueMap: Record<string, string> = {};
      for (const [valueId, valueData] of Object.entries(variable.values.values)) {
        valueMap[valueId] = valueData.label.trim();
      }
      map.set(variable.id, valueMap);
    }
  }
  
  return map;
}

async function seedFile(
  filename: string, 
  gameId: string, 
  platformId: string,
  subcategoryMap: Map<string, Record<string, string>>
) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Processing: ${filename}`);
  console.log('='.repeat(60));

  const fileContent = fs.readFileSync(filename, 'utf-8');
  const srcData: SRCData = JSON.parse(fileContent);

  const categoryName = srcData.category.name;

  console.log(`Category: ${categoryName}`);
  console.log(`Total runs: ${srcData.runs.length}\n`);

  // Create or find category
  const categorySlug = categoryName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/^-+|-+$/g, '');
  let category = await prisma.category.findFirst({
    where: { slug: categorySlug, platform_id: platformId }
  });
  
  if (!category) {
    category = await prisma.category.create({
      data: {
        platform_id: platformId,
        name: categoryName,
        slug: categorySlug,
      }
    });
    console.log(`✓ Created category: ${category.name}`);
  } else {
    console.log(`✓ Category already exists: ${category.name}`);
  }

  // Determine subcategories from runs
  const subcategoriesNeeded = new Set<string>();
  for (const srcRun of srcData.runs) {
    for (const [variableId, valueId] of Object.entries(srcRun.run.values || {})) {
      if (subcategoryMap.has(variableId)) {
        const subcategoryName = subcategoryMap.get(variableId)![valueId];
        if (subcategoryName) {
          subcategoriesNeeded.add(subcategoryName);
        }
      }
    }
  }

  // Create subcategories
  const subcategoryCache = new Map<string, any>();
  for (const subcategoryName of subcategoriesNeeded) {
    const subcategorySlug = subcategoryName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/^-+|-+$/g, '');
    
    let subcategory = await prisma.subcategory.findFirst({
      where: { slug: subcategorySlug, category_id: category.id }
    });
    
    if (!subcategory) {
      subcategory = await prisma.subcategory.create({
        data: {
          category_id: category.id,
          name: subcategoryName,
          slug: subcategorySlug,
        }
      });
      console.log(`  ✓ Created subcategory: ${subcategoryName}`);
    }
    
    subcategoryCache.set(subcategoryName, subcategory);
  }

  console.log('Importing runs...');

  // Import runs
  let imported = 0;
  let skipped = 0;

  for (const srcRun of srcData.runs) {
    // Check if run already exists
    const existingRun = await prisma.run.findUnique({
      where: { speedrun_com_id: srcRun.run.id }
    });
    
    if (existingRun) {
      skipped++;
      continue;
    }

    try {
      // Get or create user
      const player = srcRun.run.players[0]; // Primary runner
      const user = await getOrCreateUser(player);

      // Get video URL
      const videoUrl = srcRun.run.videos?.links?.[0]?.uri || null;

      // Determine subcategory
      let subcategoryId: string | null = null;
      for (const [variableId, valueId] of Object.entries(srcRun.run.values || {})) {
        if (subcategoryMap.has(variableId)) {
          const subcategoryName = subcategoryMap.get(variableId)![valueId];
          if (subcategoryName && subcategoryCache.has(subcategoryName)) {
            subcategoryId = subcategoryCache.get(subcategoryName).id;
            break;
          }
        }
      }

      // Create run
      await prisma.run.create({
        data: {
          user_id: user.id,
          category_id: category.id,
          platform_id: platformId,
          subcategory_id: subcategoryId,
          time_ms: Math.round(srcRun.run.times.primary_t * 1000),
          realtime_ms: Math.round(srcRun.run.times.realtime_t * 1000),
          gametime_ms: srcRun.run.times.realtime_noloads_t 
            ? Math.round(srcRun.run.times.realtime_noloads_t * 1000) 
            : null,
          video_url: videoUrl,
          verified: true,
          speedrun_com_id: srcRun.run.id,
          submitted_at: new Date(srcRun.run.date),
          verified_at: new Date(srcRun.run.date),
        }
      });
      
      imported++;
      
      if (imported % 10 === 0) {
        console.log(`  Imported ${imported} runs...`);
      }
    } catch (error) {
      console.error(`  Error importing run ${srcRun.run.id}:`, error);
    }
  }

  console.log(`\n✓ Import complete for ${categoryName}`);
  console.log(`  - Imported: ${imported} new runs`);
  console.log(`  - Skipped: ${skipped} existing runs`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 4) {
    console.error('Usage: npx ts-node prisma/seed-platform-with-subcategories.ts <game-slug> <platform-name> <file-prefix> <variables-file>');
    console.error('Example: npx ts-node prisma/seed-platform-with-subcategories.ts hp1 gbc hp1gbc 29d30ydl-variables.json');
    process.exit(1);
  }

  const [gameSlug, platformName, filePrefix, variablesFile] = args;

  console.log(`\n🎮 Seeding ${gameSlug.toUpperCase()} - ${platformName.toUpperCase()}\n`);

  // Load variables
  const variables: Variable[] = JSON.parse(fs.readFileSync(variablesFile, 'utf-8'));
  const subcategoryMap = buildSubcategoryMap(variables);
  
  console.log(`📋 Found ${subcategoryMap.size} subcategory variables\n`);

  // Load existing user cache
  loadUserCache();

  // Find or create game
  let game = await prisma.game.findUnique({ where: { slug: gameSlug } });
  if (!game) {
    console.error(`Game "${gameSlug}" not found. Create it first.`);
    process.exit(1);
  }
  console.log(`✓ Found game: ${game.name}\n`);

  // Create or find platform
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
      }
    });
    console.log(`✓ Created platform: ${platform.name}\n`);
  } else {
    console.log(`✓ Platform already exists: ${platform.name}\n`);
  }

  // Find all JSON files with the prefix
  const files = fs.readdirSync('.').filter(f => 
    f.startsWith(filePrefix) && f.endsWith('.json') && !f.includes('cache') && !f.includes('variables')
  );

  if (files.length === 0) {
    console.error(`No JSON files found with prefix "${filePrefix}"`);
    process.exit(1);
  }

  console.log(`Found ${files.length} files to process:\n`);
  files.forEach(f => console.log(`  - ${f}`));

  for (const file of files) {
    try {
      await seedFile(file, game.id, platform.id, subcategoryMap);
    } catch (error) {
      console.error(`\n❌ Error processing ${file}:`, error);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('✨ All files processed!');
  console.log('='.repeat(60) + '\n');

  // Save user cache for next time
  saveUserCache();

  // Summary
  const totalRuns = await prisma.run.count();
  const totalUsers = await prisma.user.count();
  const totalCategories = await prisma.category.count();
  const totalSubcategories = await prisma.subcategory.count();

  console.log('📊 Database Summary:');
  console.log(`  - Total runs: ${totalRuns}`);
  console.log(`  - Total users: ${totalUsers}`);
  console.log(`  - Total categories: ${totalCategories}`);
  console.log(`  - Total subcategories: ${totalSubcategories}`);
  console.log('');
}

main()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
