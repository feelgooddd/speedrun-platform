import prisma from "./src/lib/prisma";


// ============================================================
// SRDC CONSTANTS
// ============================================================

const SRDC_HP4_PC_GAME_ID = "kyd49x1e";
const SRDC_HP4_GBA_GAME_ID = "vo6g2n12";

const PC_PLAYERS_VARIABLE_ID = "dlo3pjrl";
const PC_PLAYERS_VALUES = [
  { srdcId: "5lerwd5q", name: "1 Player", slug: "1p", is_coop: false, required_players: 1 },
  { srdcId: "klr786oq", name: "2 Players", slug: "2p", is_coop: true, required_players: 2 },
  { srdcId: "gq7gyzyq", name: "3 Players", slug: "3p", is_coop: true, required_players: 3 },
];

const GBA_VERSION_VARIABLE_ID = "j84k0x2n";
const GBA_VERSION_VALUES = [
  { srdcId: "21gjm281", name: "GBA", slug: "gba", is_coop: false, required_players: 1 },
  { srdcId: "jqz6jx81", name: "DS", slug: "ds", is_coop: false, required_players: 1 },
  { srdcId: "rqv8m951", name: "DS Emu", slug: "ds-emu", is_coop: false, required_players: 1 },
];

const PC_SYSTEM_MAP: Record<string, string> = {
  "4p9z06rn": "GameCube",
  n5e17e27: "PlayStation 2",
  jm95zz9o: "Xbox",
  "8gej2n93": "PC",
};

const GBA_SYSTEM_MAP: Record<string, string> = {
  "3167d6q2": "Game Boy Advance",
  "7g6m8erk": "Nintendo DS",
  "7m6yvw6p": "Game Boy Player",
  vm9v3ne3: "Game Boy Interface",
};

const PC_CATEGORIES = [
  { srdcId: "7dggn7d4", name: "Any%", slug: "any" },
  { srdcId: "wk6jrxd1", name: "100%", slug: "100" },
  { srdcId: "wkp197jk", name: "All Shields", slug: "all-shields" },
];

const GBA_CATEGORIES = [
  { srdcId: "zd3yx82n", name: "Any%", slug: "any" },
  { srdcId: "7dgjp4d4", name: "100%", slug: "100" },
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
    headers: { "User-Agent": "WizardingRuns-Scraper/1.0", Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

// Fetches ALL verified runs for a category (no variable filter - SRDC ignores it)
// Returns a map of valueId -> runs[]
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

async function upsertUser(srdcId: string): Promise<string> {
  const existing = await prisma.user.findUnique({ where: { speedrun_com_id: srdcId } });
  if (existing) return existing.id;

  const data = await fetchJson(`https://www.speedrun.com/api/v1/users/${srdcId}`);
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
    where: { slug: "hp4" },
    update: {},
    create: { slug: "hp4", name: "Harry Potter and the Goblet of Fire" },
  });
  console.log(`Game: ${game.id}`);

  // ---- PC PLATFORM ----
  const pcPlatform = await prisma.platform.upsert({
    where: { id: "hp4-pc" },
    update: {},
    create: { id: "hp4-pc", game_id: game.id, name: "PC / Console", slug: "pc", timing_method: "realtime" },
  });

  const pcSystemIds: Record<string, string> = {};
  for (const [srdcPlatId, sysName] of Object.entries(PC_SYSTEM_MAP)) {
    const sys = await prisma.system.upsert({ where: { name: sysName }, update: {}, create: { name: sysName } });
    await prisma.platformSystem.upsert({
      where: { platform_id_system_id: { platform_id: pcPlatform.id, system_id: sys.id } },
      update: {},
      create: { platform_id: pcPlatform.id, system_id: sys.id },
    });
    pcSystemIds[srdcPlatId] = sys.id;
  }
  console.log(`PC systems seeded`);

  const pcCategoryIds: Record<string, string> = {};
  const pcVariableValueIds: Record<string, Record<string, string>> = {};

  for (const cat of PC_CATEGORIES) {
    const category = await prisma.category.upsert({
      where: { id: `hp4-pc-${cat.slug}` },
      update: {},
      create: { id: `hp4-pc-${cat.slug}`, platform_id: pcPlatform.id, name: cat.name, slug: cat.slug },
    });
    pcCategoryIds[cat.slug] = category.id;
    pcVariableValueIds[cat.slug] = {};

    const variable = await prisma.variable.upsert({
      where: { id: `hp4-pc-${cat.slug}-players` },
      update: {},
      create: {
        id: `hp4-pc-${cat.slug}-players`,
        category_id: category.id,
        name: "Players",
        slug: "players",
        is_subcategory: true,
      },
    });

    for (const val of PC_PLAYERS_VALUES) {
      const value = await prisma.variableValue.upsert({
        where: { id: `hp4-pc-${cat.slug}-players-${val.slug}` },
        update: {},
        create: {
          id: `hp4-pc-${cat.slug}-players-${val.slug}`,
          variable_id: variable.id,
          name: val.name,
          slug: val.slug,
          is_coop: val.is_coop,
          required_players: val.required_players,
        },
      });
      pcVariableValueIds[cat.slug][val.slug] = value.id;
    }
  }
  console.log(`PC categories + variables seeded`);

  // ---- HANDHELD PLATFORM ----
  const handheldPlatform = await prisma.platform.upsert({
    where: { id: "hp4-handheld" },
    update: {},
    create: { id: "hp4-handheld", game_id: game.id, name: "Handheld", slug: "handheld", timing_method: "realtime" },
  });

  const handheldSystemIds: Record<string, string> = {};
  for (const [srdcPlatId, sysName] of Object.entries(GBA_SYSTEM_MAP)) {
    const sys = await prisma.system.upsert({ where: { name: sysName }, update: {}, create: { name: sysName } });
    await prisma.platformSystem.upsert({
      where: { platform_id_system_id: { platform_id: handheldPlatform.id, system_id: sys.id } },
      update: {},
      create: { platform_id: handheldPlatform.id, system_id: sys.id },
    });
    handheldSystemIds[srdcPlatId] = sys.id;
  }
  console.log(`Handheld systems seeded`);

  const handheldCategoryIds: Record<string, string> = {};
  const handheldVariableValueIds: Record<string, Record<string, string>> = {};

  for (const cat of GBA_CATEGORIES) {
    const category = await prisma.category.upsert({
      where: { id: `hp4-handheld-${cat.slug}` },
      update: {},
      create: { id: `hp4-handheld-${cat.slug}`, platform_id: handheldPlatform.id, name: cat.name, slug: cat.slug },
    });
    handheldCategoryIds[cat.slug] = category.id;
    handheldVariableValueIds[cat.slug] = {};

    const variable = await prisma.variable.upsert({
      where: { id: `hp4-handheld-${cat.slug}-version` },
      update: {},
      create: {
        id: `hp4-handheld-${cat.slug}-version`,
        category_id: category.id,
        name: "Version",
        slug: "version",
        is_subcategory: true,
      },
    });

    for (const val of GBA_VERSION_VALUES) {
      const value = await prisma.variableValue.upsert({
        where: { id: `hp4-handheld-${cat.slug}-version-${val.slug}` },
        update: {},
        create: {
          id: `hp4-handheld-${cat.slug}-version-${val.slug}`,
          variable_id: variable.id,
          name: val.name,
          slug: val.slug,
          is_coop: val.is_coop,
          required_players: val.required_players,
        },
      });
      handheldVariableValueIds[cat.slug][val.slug] = value.id;
    }
  }
  console.log(`Handheld categories + variables seeded`);

  return { pcPlatform, pcSystemIds, pcCategoryIds, pcVariableValueIds, handheldPlatform, handheldSystemIds, handheldCategoryIds, handheldVariableValueIds };
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log("Starting HP4 seed...");

  const {
    pcPlatform, pcSystemIds, pcCategoryIds, pcVariableValueIds,
    handheldPlatform, handheldSystemIds, handheldCategoryIds, handheldVariableValueIds,
  } = await seedStructure();

  // ---- PC runs ----
  console.log("\n=== Seeding PC runs ===");
  for (const cat of PC_CATEGORIES) {
    console.log(`\n  Fetching all runs for ${cat.name}...`);
    const allCatRuns = await fetchAllRunsByCategory(SRDC_HP4_PC_GAME_ID, cat.srdcId);
    console.log(`  Total fetched: ${allCatRuns.length}`);

    for (const val of PC_PLAYERS_VALUES) {
      const runs = allCatRuns.filter((r: any) => r.values?.[PC_PLAYERS_VARIABLE_ID] === val.srdcId);
      console.log(`\n  ${cat.name} / ${val.name}: ${runs.length} runs`);

      const categoryId = pcCategoryIds[cat.slug];
      const variableValueId = pcVariableValueIds[cat.slug][val.slug];

      for (const run of runs) {
        const srdcRunId = run.id;
        const existing = await prisma.run.findUnique({ where: { speedrun_com_id: srdcRunId } });
        if (existing) continue;

        const realtimeMs = isoToMs(run.times?.realtime ?? null);
        const gametimeMs = isoToMs(run.times?.ingame ?? null);
        const videoUrl = run.videos?.links?.[0]?.uri ?? null;
        const comment = run.comment ?? null;
        const submittedAt = run.date ? new Date(run.date) : new Date();
        const systemId = run.system?.platform ? (pcSystemIds[run.system.platform] ?? null) : null;
        const players = run.players?.data ?? run.players ?? [];

        if (val.is_coop) {
          const userIds: string[] = [];
          for (const player of players) {
            if (player.rel === "guest") continue;
            try { userIds.push(await upsertUser(player.id)); await sleep(300); }
            catch (e) { console.warn(`    Could not fetch user ${player.id}: ${e}`); }
          }
          if (userIds.length === 0) { console.warn(`    Skipping coop run ${srdcRunId} - no valid players`); continue; }

          await prisma.run.create({
            data: {
              user_id: userIds[0],
              category_id: categoryId,
              platform_id: pcPlatform.id,
              is_coop: true,
              realtime_ms: realtimeMs,
              gametime_ms: gametimeMs,
              video_url: videoUrl,
              comment,
              verified: true,
              submitted_at: submittedAt,
              system_id: systemId,
              speedrun_com_id: srdcRunId,
              variable_values: { create: [{ variable_value_id: variableValueId }] },
              runners: { create: userIds.map((uid) => ({ user_id: uid })) },
            },
          });
          console.log(`    ✓ Coop run ${srdcRunId} (${userIds.length} players)`);
        } else {
          const primaryPlayer = players.find((p: any) => p.rel === "user");
          if (!primaryPlayer) { console.warn(`    Skipping run ${srdcRunId} - no user player`); continue; }

          let userId: string;
          try { userId = await upsertUser(primaryPlayer.id); await sleep(300); }
          catch (e) { console.warn(`    Could not fetch user ${primaryPlayer.id}: ${e}`); continue; }

          await prisma.run.create({
            data: {
              user_id: userId,
              category_id: categoryId,
              platform_id: pcPlatform.id,
              is_coop: false,
              realtime_ms: realtimeMs,
              gametime_ms: gametimeMs,
              video_url: videoUrl,
              comment,
              verified: true,
              submitted_at: submittedAt,
              system_id: systemId,
              speedrun_com_id: srdcRunId,
              variable_values: { create: [{ variable_value_id: variableValueId }] },
            },
          });
          console.log(`    ✓ Run ${srdcRunId}`);
        }
        await sleep(200);
      }
    }
  }

  // ---- Handheld runs ----
  console.log("\n=== Seeding Handheld runs ===");
  for (const cat of GBA_CATEGORIES) {
    for (const val of GBA_VERSION_VALUES) {
      console.log(`\n  ${cat.name} / ${val.name}`);
      const allGbaRuns = await fetchAllRunsByCategory(SRDC_HP4_GBA_GAME_ID, cat.srdcId);
      const runs = allGbaRuns.filter((r: any) => r.values?.[GBA_VERSION_VARIABLE_ID] === val.srdcId);
      console.log(`  ${cat.name} / ${val.name}: ${runs.length} runs`);

      const categoryId = handheldCategoryIds[cat.slug];
      const variableValueId = handheldVariableValueIds[cat.slug][val.slug];

      for (const run of runs) {
        const srdcRunId = run.id;
        const existing = await prisma.run.findUnique({ where: { speedrun_com_id: srdcRunId } });
        if (existing) continue;

        const realtimeMs = isoToMs(run.times?.realtime ?? null);
        const gametimeMs = isoToMs(run.times?.ingame ?? null);
        const videoUrl = run.videos?.links?.[0]?.uri ?? null;
        const comment = run.comment ?? null;
        const submittedAt = run.date ? new Date(run.date) : new Date();
        const systemId = run.system?.platform ? (handheldSystemIds[run.system.platform] ?? null) : null;
        const players = run.players?.data ?? run.players ?? [];
        const primaryPlayer = players.find((p: any) => p.rel === "user");

        if (!primaryPlayer) { console.warn(`    Skipping run ${srdcRunId} - no user player`); continue; }

        let userId: string;
        try { userId = await upsertUser(primaryPlayer.id); await sleep(300); }
        catch (e) { console.warn(`    Could not fetch user ${primaryPlayer.id}: ${e}`); continue; }

        await prisma.run.create({
          data: {
            user_id: userId,
            category_id: categoryId,
            platform_id: handheldPlatform.id,
            is_coop: false,
            realtime_ms: realtimeMs,
            gametime_ms: gametimeMs,
            video_url: videoUrl,
            comment,
            verified: true,
            submitted_at: submittedAt,
            system_id: systemId,
            speedrun_com_id: srdcRunId,
            variable_values: { create: [{ variable_value_id: variableValueId }] },
          },
        });
        console.log(`    ✓ Run ${srdcRunId}`);
        await sleep(200);
      }
    }
  }

  console.log("\n✓ HP4 seed complete.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());