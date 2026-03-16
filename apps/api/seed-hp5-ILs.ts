import prisma from "./src/lib/prisma";

// ============================================================
// CONSTANTS
// ============================================================

const SRDC_GAME_ID = "m1mx5k62"; // HP5 game ID
const PLATFORM_ID = "hp5-pc"; // HP5 PC platform

const SYSTEM_MAP: Record<string, string> = {
  n5e17e27: "PlayStation 2",
  mx6pwe3g: "PlayStation 3",
  n568oevp: "Xbox 360",
  "8gej2n93": "PC",
  v06dk3e4: "Wii",
};

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

// ============================================================
// SRDC FETCHERS
// ============================================================

async function fetchLevels() {
  const data = await fetchJson(
    `https://www.speedrun.com/api/v1/games/${SRDC_GAME_ID}/levels`,
  );
  return data.data;
}

async function fetchLevelCategories(levelId: string) {
  const data = await fetchJson(
    `https://www.speedrun.com/api/v1/levels/${levelId}/categories`,
  );
  return data.data;
}

async function fetchAllRuns(levelId: string, categoryId: string) {
  const runs: any[] = [];
  let offset = 0;
  const max = 200;

  while (true) {
    const url =
      `https://www.speedrun.com/api/v1/runs?` +
      `game=${SRDC_GAME_ID}&level=${levelId}&category=${categoryId}` +
      `&status=verified&orderby=date&direction=asc` +
      `&max=${max}&offset=${offset}&embed=players`;

    console.log(`      Fetching runs offset=${offset}`);

    const data = await fetchJson(url);
    const batch = data.data ?? [];
    runs.push(...batch);

    if (batch.length < max) break;

    offset += max;
    await sleep(600);
  }

  return runs;
}

// ============================================================
// USER HELPERS
// ============================================================

async function upsertGuest(name: string): Promise<string> {
  const username = name.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) return existing.id;
  const created = await prisma.user.create({
    data: { username, display_name: name, is_placeholder: true },
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
// MAIN
// ============================================================

async function main() {
  console.log("=== HP5 IL SCRAPER START ===");

  const platform = await prisma.platform.findUnique({
    where: { id: PLATFORM_ID },
  });
  if (!platform) throw new Error("Platform not found");

  const levels = await fetchLevels();
  const systemIds: Record<string, string> = {};

  for (const [srdcId, sysName] of Object.entries(SYSTEM_MAP)) {
    const sys = await prisma.system.upsert({
      where: { name: sysName },
      update: {},
      create: { name: sysName },
    });
    systemIds[srdcId] = sys.id;
  }

  let levelOrder = 0;

  for (const level of levels) {
    console.log(`\nLevel: ${level.name}`);

    const levelRow = await prisma.level.upsert({
      where: { id: `hp5-il-${level.id}` },
      update: {},
      create: {
        id: `hp5-il-${level.id}`,
        platform_id: platform.id,
        name: level.name,
        slug: level.weblink.split("/").pop(),
        order: levelOrder++,
      },
    });

    const categories = await fetchLevelCategories(level.id);
    let catOrder = 0;

    for (const cat of categories) {
      console.log(`  Category: ${cat.name}`);

      const levelCategory = await prisma.levelCategory.upsert({
        where: { id: `hp5-il-${level.id}-${cat.id}` },
        update: {},
        create: {
          id: `hp5-il-${level.id}-${cat.id}`,
          level_id: levelRow.id,
          name: cat.name,
          slug: cat.name.toLowerCase().replace(/\s+/g, "-").replace(/%/g, ""),
          order: catOrder++,
        },
      });

      const runs = await fetchAllRuns(level.id, cat.id);
      console.log(`    Runs: ${runs.length}`);

      for (const run of runs) {
        const srdcRunId = run.id;

        const existing = await prisma.run.findUnique({
          where: { speedrun_com_id: srdcRunId },
        });
        if (existing) {
          console.log(`      Skipping existing run ${srdcRunId}`);
          continue;
        }

        const realtimeMs = isoToMs(run.times?.realtime ?? null);
        const gametimeMs = isoToMs(run.times?.ingame ?? null);
        const videoUrl = run.videos?.links?.[0]?.uri ?? null;
        const comment = run.comment ?? null;
        const submittedAt = run.date ? new Date(run.date) : new Date();
        const systemId = run.system?.platform
          ? (systemIds[run.system.platform] ?? null)
          : null;

        const players = run.players?.data ?? run.players ?? [];
        const userIds: string[] = [];

        for (const player of players) {
          try {
            if (player.rel === "guest") {
              userIds.push(await upsertGuest(player.name));
            } else {
              userIds.push(await upsertUser(player.id));
              await sleep(200);
            }
          } catch (e) {
            console.warn(`Could not process player`);
          }
        }

        if (userIds.length === 0) {
          console.warn(`Skipping run ${srdcRunId} — no valid user IDs`);
          continue;
        }

        await prisma.run.create({
          data: {
            user_id: userIds[0],
            level_category_id: levelCategory.id,
            platform_id: platform.id,
            is_coop: userIds.length > 1,
            realtime_ms: realtimeMs,
            gametime_ms: gametimeMs,
            video_url: videoUrl,
            comment,
            verified: true,
            submitted_at: submittedAt,
            system_id: systemId,
            speedrun_com_id: srdcRunId,
            runners: {
              create: userIds.map((uid) => ({ user_id: uid })),
            },
          },
        });

        console.log(`      ✓ ${srdcRunId}`);
        await sleep(150);
      }
    }
  }

  console.log("\n✓ HP5 IL import complete");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
