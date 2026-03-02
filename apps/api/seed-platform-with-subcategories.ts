// prisma/seed-platform-with-subcategories.ts

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as fs from "fs";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

/* ------------------------------------------------ */
/* Types
/* ------------------------------------------------ */

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
    values: Record<string, string>;
  };
}

interface SRCData {
  game: { id: string; name: string; slug: string };
  category: { id: string; name: string };
  subcategory?: Array<{
    varId: string;
    varName: string;
    valueId: string;
    valueLabel: string;
  }>;
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

interface Variable {
  id: string;
  name: string;
  "is-subcategory": boolean;
  values: {
    values: Record<string, { label: string }>;
  };
}

interface VariablesFile {
  allowedIds?: string[];
  variables?: Variable[];
}

/* ------------------------------------------------ */
/* Cache Layer
/* ------------------------------------------------ */

const userCache = new Map<string, any>();
const CACHE_FILE = "users-cache.json";

function loadUserCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const cacheData = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
      Object.entries(cacheData).forEach(([id, data]) =>
        userCache.set(id, data)
      );
      console.log(`📦 Loaded ${userCache.size} users from cache\n`);
    }
  } catch (error) {
    console.warn("Could not load user cache:", error);
  }
}

function saveUserCache() {
  try {
    fs.writeFileSync(
      CACHE_FILE,
      JSON.stringify(Object.fromEntries(userCache), null, 2)
    );
    console.log(`\n💾 Saved ${userCache.size} users to cache`);
  } catch (error) {
    console.warn("Could not save user cache:", error);
  }
}

/* ------------------------------------------------ */
/* Utils
/* ------------------------------------------------ */

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchUserDetails(userId: string): Promise<SRCUserData | null> {
  if (userCache.has(userId)) return userCache.get(userId);

  try {
    await sleep(1000);
    const response = await fetch(
      `https://www.speedrun.com/api/v1/users/${userId}`
    );

    if (!response.ok) {
      console.warn(`Failed to fetch user ${userId}: ${response.status}`);
      return null;
    }

    const data = await response.json();
    userCache.set(userId, data);
    return data as SRCUserData;
  } catch (error) {
    console.warn(`Error fetching user ${userId}:`, error);
    return null;
  }
}

/* ------------------------------------------------ */
/* User Resolver
/* ------------------------------------------------ */

async function getOrCreateUser(player: SRCRun["run"]["players"][0]) {
  if (player.rel === "user" && player.id) {
    let user = await prisma.user.findUnique({
      where: { speedrun_com_id: player.id },
    });

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
          },
        });
        console.log(`  Created user: ${user.username}`);
      } else {
        user = await prisma.user.create({
          data: {
            username: `runner_${player.id}`,
            speedrun_com_id: player.id,
            is_placeholder: true,
          },
        });
        console.log(`  Created user (fallback): ${user.username}`);
      }
    }

    return user;
  }

  if (player.rel === "guest" && player.name) {
    let user = await prisma.user.findUnique({
      where: { username: player.name },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          username: player.name.toLowerCase(),
          display_name: player.name,
          is_placeholder: true,
        },
      });
      console.log(`  Created guest user: ${user.username}`);
    }

    return user;
  }

  throw new Error("Invalid player data");
}

/* ------------------------------------------------ */
/* Variables File Loader
/* ------------------------------------------------ */

/**
 * Supports both formats:
 *   - Legacy: raw Variable[] array
 *   - New:    { allowedIds?: string[], variables: Variable[] }
 */
function loadVariablesFile(variablesFile: string): Variable[] {
  const raw = JSON.parse(fs.readFileSync(variablesFile, "utf-8"));

  let variables: Variable[];
  let allowedIds: string[] | null = null;

  if (Array.isArray(raw)) {
    variables = raw;
  } else {
    variables = raw.variables ?? [];
    allowedIds = raw.allowedIds ?? null;
  }

  return variables.filter((v) => {
    if (!v["is-subcategory"]) return false;
    if (allowedIds && !allowedIds.includes(v.id)) return false;
    return Object.keys(v.values.values).length > 1;
  });
}

/* ------------------------------------------------ */
/* Subcategory Mapping
/* ------------------------------------------------ */

function buildSubcategoryMap(
  variables: Variable[]
): Map<string, Map<string, string>> {
  const map = new Map<string, Map<string, string>>();

  for (const variable of variables) {
    const valueMap = new Map<string, string>();
    for (const [valueId, valueData] of Object.entries(variable.values.values)) {
      valueMap.set(valueId, valueData.label.trim());
    }
    map.set(variable.id, valueMap);
  }

  return map;
}

/* ------------------------------------------------ */
/* Timing Helper
/* ------------------------------------------------ */

/**
 * For games that use realtime_noloads as primary (like hp2_6th_gen),
 * gametime_ms = realtime_noloads_t and realtime_ms = realtime_t.
 * For games that only have realtime, gametime_ms = null.
 */
function resolveTiming(times: SRCRun["run"]["times"]): {
  realtime_ms: number | null;
  gametime_ms: number | null;
} {
  const realtime_ms = times.realtime_t
    ? Math.round(times.realtime_t * 1000)
    : null;

  const gametime_ms = times.realtime_noloads_t
    ? Math.round(times.realtime_noloads_t * 1000)
    : null;

  return { realtime_ms, gametime_ms };
}

/* ------------------------------------------------ */
/* Seeder Core
/* ------------------------------------------------ */

async function seedFile(
  filename: string,
  gameId: string,
  platform: { id: string; timing_method: string },
  subcategoryMap: Map<string, Map<string, string>>
) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Processing: ${filename}`);
  console.log("=".repeat(60));

  const srcData: SRCData = JSON.parse(fs.readFileSync(filename, "utf-8"));

  const categoryName = srcData.category.name;
  console.log(`Category: ${categoryName}`);
  console.log(`Total runs: ${srcData.runs.length}\n`);

  /* Category */

  const categorySlug = categoryName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/^-+|-+$/g, "");

  let category = await prisma.category.findFirst({
    where: { slug: categorySlug, platform_id: platform.id },
  });

  if (!category) {
    category = await prisma.category.create({
      data: {
        platform_id: platform.id,
        name: categoryName,
        slug: categorySlug,
      },
    });
    console.log(`✓ Created category: ${category.name}`);
  } else {
    console.log(`✓ Category exists: ${category.name}`);
  }

  /* Subcategory Discovery
   *
   * Prefer reading subcategory directly from the scraped file's
   * top-level "subcategory" field (set by the scraper), then fall
   * back to inspecting each run's values map against subcategoryMap.
   */

  const subcategoryCache = new Map<string, any>();

  // If the scraper embedded the subcategory label at the file level, use it
  if (srcData.subcategory && srcData.subcategory.length > 0) {
    for (const sub of srcData.subcategory) {
      const name = sub.valueLabel.trim();
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-")
        .replace(/^-+|-+$/g, "");

      let dbSub = await prisma.subcategory.findFirst({
        where: { slug, category_id: category.id },
      });

      if (!dbSub) {
        dbSub = await prisma.subcategory.create({
          data: { category_id: category.id, name, slug },
        });
        console.log(`  ✓ Created subcategory: ${name}`);
      }

      subcategoryCache.set(name, dbSub);
    }
  } else {
    // Fallback: discover subcategories from run values
    const subcategoriesNeeded = new Set<string>();

    for (const srcRun of srcData.runs) {
      for (const [variableId, valueId] of Object.entries(
        srcRun.run.values ?? {}
      )) {
        const variableMap = subcategoryMap.get(variableId);
        if (!variableMap) continue;
        const name = variableMap.get(valueId);
        if (name) subcategoriesNeeded.add(name);
      }
    }

    for (const name of subcategoriesNeeded) {
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-")
        .replace(/^-+|-+$/g, "");

      let dbSub = await prisma.subcategory.findFirst({
        where: { slug, category_id: category.id },
      });

      if (!dbSub) {
        dbSub = await prisma.subcategory.create({
          data: { category_id: category.id, name, slug },
        });
        console.log(`  ✓ Created subcategory: ${name}`);
      }

      subcategoryCache.set(name, dbSub);
    }
  }

  console.log("\nImporting runs...");

  let imported = 0;
  let skipped = 0;

  /* Run Import */

  for (const srcRun of srcData.runs) {
    const existing = await prisma.run.findUnique({
      where: { speedrun_com_id: srcRun.run.id },
    });

    if (existing) {
      skipped++;
      continue;
    }

    try {
      const player = srcRun.run.players[0];
      const user = await getOrCreateUser(player);
      const videoUrl = srcRun.run.videos?.links?.[0]?.uri ?? null;

      /* Resolve Subcategory */

      let subcategoryId: string | null = null;

      // First try: use file-level subcategory if present
      if (srcData.subcategory && srcData.subcategory.length > 0) {
        const name = srcData.subcategory[0].valueLabel.trim();
        subcategoryId = subcategoryCache.get(name)?.id ?? null;
      } else {
        // Fallback: scan run values
        for (const [variableId, valueId] of Object.entries(
          srcRun.run.values ?? {}
        )) {
          const variableMap = subcategoryMap.get(variableId);
          if (!variableMap) continue;
          const name = variableMap.get(valueId);
          if (name && subcategoryCache.has(name)) {
            subcategoryId = subcategoryCache.get(name).id;
            break;
          }
        }
      }

      /* Timing */
      const { realtime_ms, gametime_ms } = resolveTiming(srcRun.run.times);

      await prisma.run.create({
        data: {
          user_id: user.id,
          category_id: category.id,
          platform_id: platform.id,
          subcategory_id: subcategoryId,
          realtime_ms,
          gametime_ms,
          comment: srcRun.run.comment ?? null,
          video_url: videoUrl,
          verified: true,
          speedrun_com_id: srcRun.run.id,
          submitted_at: new Date(srcRun.run.date),
          verified_at: new Date(srcRun.run.date),
        },
      });

      imported++;
      if (imported % 10 === 0) {
        console.log(`  Imported ${imported} runs...`);
      }
    } catch (error) {
      console.error(`  Error importing run ${srcRun.run.id}:`, error);
    }
  }

  console.log(`\n✓ Done: ${imported} imported, ${skipped} skipped`);
}

/* ------------------------------------------------ */
/* Main CLI
/* ------------------------------------------------ */

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 4) {
    console.error(
      "Usage: npx ts-node prisma/seed-platform-with-subcategories.ts <game-slug> <platform-name> <file-prefix> <variables-file>"
    );
    process.exit(1);
  }

  const [gameSlug, platformName, filePrefix, variablesFile] = args;

  console.log(`\n🎮 Seeding ${gameSlug.toUpperCase()} - ${platformName.toUpperCase()}\n`);

  const variables = loadVariablesFile(variablesFile);
  const subcategoryMap = buildSubcategoryMap(variables);

  console.log(`📋 Found ${subcategoryMap.size} subcategory variable(s)\n`);

  loadUserCache();

  const game = await prisma.game.findUnique({ where: { slug: gameSlug } });

  if (!game) {
    console.error(
      `Game "${gameSlug}" not found. Create it first with your main seed.`
    );
    process.exit(1);
  }

  console.log(`✓ Found game: ${game.name}\n`);

  /* Platform */

  const platformSlug = platformName.toLowerCase().replace(/\s+/g, "-");

  let platform = await prisma.platform.findFirst({
    where: { game_id: game.id, slug: platformSlug },
  });

  if (!platform) {
    platform = await prisma.platform.create({
      data: {
        game_id: game.id,
        name: platformName.toUpperCase(),
        slug: platformSlug,
        timing_method: "gametime", // realtime_noloads is primary for this game
      },
    });
    console.log(`✓ Created platform: ${platform.name}\n`);
  } else {
    console.log(
      `✓ Platform exists: ${platform.name} (timing: ${platform.timing_method})\n`
    );
  }

  /* File Discovery */

  const files = fs
    .readdirSync(".")
    .filter(
      (f) =>
        f.startsWith(filePrefix) &&
        f.endsWith(".json") &&
        !f.includes("cache") &&
        !f.includes("variables")
    )
    .sort(); // consistent ordering

  if (files.length === 0) {
    console.error(`No JSON files found with prefix "${filePrefix}"`);
    process.exit(1);
  }

  console.log(`Found ${files.length} file(s):\n`);
  files.forEach((f) => console.log(`  - ${f}`));

  for (const file of files) {
    try {
      await seedFile(file, game.id, platform, subcategoryMap);
    } catch (error) {
      console.error(`\n❌ Error processing ${file}:`, error);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("✨ All files processed!");
  console.log("=".repeat(60) + "\n");

  saveUserCache();

  const [totalRuns, totalUsers, totalCategories, totalSubcategories] =
    await Promise.all([
      prisma.run.count(),
      prisma.user.count(),
      prisma.category.count(),
      prisma.subcategory.count(),
    ]);

  console.log("📊 DB Summary:");
  console.log(`  Runs:          ${totalRuns}`);
  console.log(`  Users:         ${totalUsers}`);
  console.log(`  Categories:    ${totalCategories}`);
  console.log(`  Subcategories: ${totalSubcategories}\n`);
}

main()
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());