import prisma from "./src/lib/prisma";

// ============================================================
// SRDC CONSTANTS
// ============================================================

const SRDC_HP7_2_PC_GAME_ID = "qw6jqx1j";
const SRDC_HP7_2_DS_GAME_ID = "369p90l1";

const PC_SYSTEM_MAP: Record<string, string> = {
  n5e17e27: "PlayStation 2",
  mx6pwe3g: "PlayStation 3",
  n568oevp: "Xbox 360",
  "8gej2n93": "PC",
  v06dk3e4: "Wii",
};

const DS_SYSTEM_MAP: Record<string, string> = {
  "3167d6q2": "Game Boy Advance",
  "7g6m8erk": "Nintendo DS",
  "7m6yvw6p": "Game Boy Player",
  vm9v3ne3: "Game Boy Interface",
};

// HP7P2 PC: Any% (xk9lv4k0), 100% (n2y7op72), NG+ (zdnprxkq)
// Skipping per-level categories (n2y9weed, xk9eqpx2)
const PC_CATEGORIES = [
  { srdcId: "xk9lv4k0", name: "Any%", slug: "any" },
  { srdcId: "n2y7op72", name: "100%", slug: "100" },
  { srdcId: "zdnprxkq", name: "NG+", slug: "ng-plus" },
];

// HP7P2 DS: Any% (7kj103gk), 100% (xk98zrx2)
// DS/DS Emu split via variable 38dmo3z8 — treated as systems not categories
const DS_CATEGORIES = [
  { srdcId: "7kj103gk", name: "Any%", slug: "any" },
  { srdcId: "xk98zrx2", name: "100%", slug: "100" },
];

// ============================================================
// HELPERS
// ============================================================

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function isoToMs(iso: string | null): number | null {
  if (!iso) return null;
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?/);
  if (!match) return null;
  const h = parseInt(match[1] ?? "0");
  const m = parseInt(match[2] ?? "0");
  const s = parseFloat(match[3] ?? "0");
  return Math.round((h * 3600 + m * 60 + s) * 1000);
}

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "WizardingRuns-Scraper/1.0",
      Accept: "application/json",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function fetchAllRunsByCategory(
  gameId: string,
  categoryId: string,
): Promise<any[]> {
  const runs: any[] = [];
  let offset = 0;
  const max = 200;

  while (true) {
    const url = `https://www.speedrun.com/api/v1/runs?game=${gameId}&category=${categoryId}&status=verified&orderby=date&direction=asc&max=${max}&offset=${offset}&embed=players`;
    console.log(`    Fetching runs offset=${offset}...`);
    const data = await fetchJson(url);
    const batch = data.data ?? [];
    runs.push(...batch);
    if (batch.length < max) break;
    offset += max;
    await sleep(600);
  }

  return runs;
}

async function upsertGuest(name: string): Promise<string> {
  const username = name.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) return existing.id;

  const created = await prisma.user.create({
    data: {
      username,
      display_name: name,
      is_placeholder: true,
    },
  });

  return created.id;
}

async function upsertUser(srdcId: string): Promise<string> {
  const existing = await prisma.user.findUnique({
    where: { speedrun_com_id: srdcId },
  });
  if (existing) return existing.id;

  const data = await fetchJson(
    `https://www.speedrun.com/api/v1/users/${srdcId}`,
  );
  const u = data.data;
  const username = u.names?.international ?? srdcId;

  const created = await prisma.user.create({
    data: {
      username: username.toLowerCase(),
      display_name: username,
      speedrun_com_id: srdcId,
      is_placeholder: true,
      avatar_url: u.assets?.image?.uri ?? null,
      twitch: u.twitch?.uri ?? null,
      country: u.location?.country?.code ?? null,
    },
  });

  return created.id;
}

// ============================================================
// SEED STRUCTURE
// ============================================================

async function seedStructure() {
  console.log("\n=== Seeding game structure ===");

  const game = await prisma.game.upsert({
    where: { slug: "hp7-2" },
    update: {},
    create: {
      slug: "hp7-2",
      name: "Harry Potter and the Deathly Hallows Part 2",
    },
  });
  console.log(`Game: ${game.id}`);

  // ---- PC PLATFORM ----
  const pcPlatform = await prisma.platform.upsert({
    where: { id: "hp7-2-pc" },
    update: {},
    create: {
      id: "hp7-2-pc",
      game_id: game.id,
      name: "PC / Console",
      slug: "pc",
      timing_method: "realtime",
    },
  });

  const pcSystemIds: Record<string, string> = {};
  for (const [srdcPlatId, sysName] of Object.entries(PC_SYSTEM_MAP)) {
    const sys = await prisma.system.upsert({
      where: { name: sysName },
      update: {},
      create: { name: sysName },
    });
    await prisma.platformSystem.upsert({
      where: {
        platform_id_system_id: {
          platform_id: pcPlatform.id,
          system_id: sys.id,
        },
      },
      update: {},
      create: { platform_id: pcPlatform.id, system_id: sys.id },
    });
    pcSystemIds[srdcPlatId] = sys.id;
  }
  console.log(`PC systems seeded`);

  const pcCategoryIds: Record<string, string> = {};
  for (const cat of PC_CATEGORIES) {
    const category = await prisma.category.upsert({
      where: { id: `hp7-2-pc-${cat.slug}` },
      update: {},
      create: {
        id: `hp7-2-pc-${cat.slug}`,
        platform_id: pcPlatform.id,
        name: cat.name,
        slug: cat.slug,
      },
    });
    pcCategoryIds[cat.slug] = category.id;
  }
  console.log(`PC categories seeded`);

  // ---- DS PLATFORM ----
  const dsPlatform = await prisma.platform.upsert({
    where: { id: "hp7-2-ds" },
    update: {},
    create: {
      id: "hp7-2-ds",
      game_id: game.id,
      name: "DS",
      slug: "ds",
      timing_method: "realtime",
    },
  });

  const dsSystemIds: Record<string, string> = {};
  for (const [srdcPlatId, sysName] of Object.entries(DS_SYSTEM_MAP)) {
    const sys = await prisma.system.upsert({
      where: { name: sysName },
      update: {},
      create: { name: sysName },
    });
    await prisma.platformSystem.upsert({
      where: {
        platform_id_system_id: {
          platform_id: dsPlatform.id,
          system_id: sys.id,
        },
      },
      update: {},
      create: { platform_id: dsPlatform.id, system_id: sys.id },
    });
    dsSystemIds[srdcPlatId] = sys.id;
  }
  console.log(`DS systems seeded`);

  const dsCategoryIds: Record<string, string> = {};
  for (const cat of DS_CATEGORIES) {
    const category = await prisma.category.upsert({
      where: { id: `hp7-2-ds-${cat.slug}` },
      update: {},
      create: {
        id: `hp7-2-ds-${cat.slug}`,
        platform_id: dsPlatform.id,
        name: cat.name,
        slug: cat.slug,
      },
    });
    dsCategoryIds[cat.slug] = category.id;
  }
  console.log(`DS categories seeded`);

  return {
    pcPlatform,
    pcSystemIds,
    pcCategoryIds,
    dsPlatform,
    dsSystemIds,
    dsCategoryIds,
  };
}

// ============================================================
// SEED RUNS
// ============================================================

async function seedRuns(
  gameId: string,
  categories: { srdcId: string; name: string; slug: string }[],
  platformId: string,
  systemIds: Record<string, string>,
  categoryIds: Record<string, string>,
  label: string,
) {
  console.log(`\n=== Seeding ${label} runs ===`);

  for (const cat of categories) {
    console.log(`\n  Fetching runs for ${cat.name}...`);
    const runs = await fetchAllRunsByCategory(gameId, cat.srdcId);
    console.log(`  Total fetched: ${runs.length}`);

    const categoryId = categoryIds[cat.slug];

    for (const run of runs) {
      const srdcRunId = run.id;
      const existing = await prisma.run.findUnique({
        where: { speedrun_com_id: srdcRunId },
      });
      if (existing) continue;

      const realtimeMs = isoToMs(run.times?.realtime ?? null);
      const gametimeMs = isoToMs(run.times?.ingame ?? null);
      const videoUrl = run.videos?.links?.[0]?.uri ?? null;
      const comment = run.comment ?? null;
      const submittedAt = run.date ? new Date(run.date) : new Date();
      const systemId = run.system?.platform
        ? (systemIds[run.system.platform] ?? null)
        : null;

      const players = run.players?.data ?? run.players ?? [];
      const primaryPlayer = players[0];

      if (!primaryPlayer) {
        console.warn(`    Skipping run ${srdcRunId} - no player`);
        continue;
      }

      let userId: string;
      try {
        if (primaryPlayer.rel === "guest") {
          userId = await upsertGuest(primaryPlayer.name);
        } else {
          userId = await upsertUser(primaryPlayer.id);
          await sleep(300);
        }
      } catch (e) {
        console.warn(`    Could not resolve user for run ${srdcRunId}: ${e}`);
        continue;
      }

      await prisma.run.create({
        data: {
          user_id: userId,
          category_id: categoryId,
          platform_id: platformId,
          is_coop: false,
          realtime_ms: realtimeMs,
          gametime_ms: gametimeMs,
          video_url: videoUrl,
          comment,
          verified: true,
          submitted_at: submittedAt,
          system_id: systemId,
          speedrun_com_id: srdcRunId,
        },
      });
      console.log(`    ✓ Run ${srdcRunId}`);
      await sleep(200);
    }
  }
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log("Starting HP7-2 seed...");

  const {
    pcPlatform,
    pcSystemIds,
    pcCategoryIds,
    dsPlatform,
    dsSystemIds,
    dsCategoryIds,
  } = await seedStructure();

  await seedRuns(
    SRDC_HP7_2_PC_GAME_ID,
    PC_CATEGORIES,
    pcPlatform.id,
    pcSystemIds,
    pcCategoryIds,
    "PC",
  );

  await seedRuns(
    SRDC_HP7_2_DS_GAME_ID,
    DS_CATEGORIES,
    dsPlatform.id,
    dsSystemIds,
    dsCategoryIds,
    "DS",
  );

  console.log("\n✓ HP7-2 seed complete.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());