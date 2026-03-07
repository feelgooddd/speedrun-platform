import prisma from "./src/lib/prisma";

// ============================================================
// SRDC CONSTANTS
// ============================================================

const SRDC_HP5_PC_GAME_ID = "m1mx5k62";
const SRDC_HP5_GBA_GAME_ID = "nd2w73d0";

const PC_SYSTEM_MAP: Record<string, string> = {
  n5e17e27: "PlayStation 2",
  mx6pwe3g: "PlayStation 3",
  n568oevp: "Xbox 360",
  "8gej2n93": "PC",
  v06dk3e4: "Wii",
};

const GBA_SYSTEM_MAP: Record<string, string> = {
  "3167d6q2": "Game Boy Advance",
  "7g6m8erk": "Nintendo DS",
  "7m6yvw6p": "Game Boy Player",
  vm9v3ne3: "Game Boy Interface",
};

const PC_CATEGORIES = [
  { srdcId: "xk9gp4d0", name: "Any%", slug: "any" },
  { srdcId: "n2y1yzm2", name: "100%", slug: "100" },
];

// GBA/DS categories each have their own Platform variable on SRDC
// We model it as one Variable (Platform) per category on our side
const GBA_CATEGORIES = [
  {
    srdcId: "q25o9r8k",
    name: "Any%",
    slug: "any",
    variableId: "r8r4pv5n",
    values: [
      { srdcId: "qyzn3841", name: "GBA", slug: "gba" },
      { srdcId: "jq6eyz3l", name: "GBA Emu", slug: "gba-emu" },
      { srdcId: "5lmm8gjl", name: "DS", slug: "ds" },
    ],
  },
  {
    srdcId: "jdrq8jxk",
    name: "100%",
    slug: "100",
    variableId: "5lyx4k2n",
    values: [
      { srdcId: "ln85rk0l", name: "GBA", slug: "gba" },
      { srdcId: "81w0e5ol", name: "GBA Emu", slug: "gba-emu" },
      { srdcId: "zqovmrp1", name: "DS", slug: "ds" },
    ],
  },
  {
    srdcId: "n2y9j58d",
    name: "Any% NSC",
    slug: "any-nsc",
    variableId: "rn1y09on",
    values: [
      { srdcId: "qj7gjeeq", name: "GBA", slug: "gba" },
      { srdcId: "10vx39wl", name: "GBA Emu", slug: "gba-emu" },
    ],
  },
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
    where: { slug: "hp5" },
    update: {},
    create: { slug: "hp5", name: "Harry Potter and the Order of the Phoenix" },
  });
  console.log(`Game: ${game.id}`);

  // ---- PC PLATFORM ----
  const pcPlatform = await prisma.platform.upsert({
    where: { id: "hp5-pc" },
    update: {},
    create: {
      id: "hp5-pc",
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

  // HP5 PC has no subcategory variables — categories are flat
  const pcCategoryIds: Record<string, string> = {};
  for (const cat of PC_CATEGORIES) {
    const category = await prisma.category.upsert({
      where: { id: `hp5-pc-${cat.slug}` },
      update: {},
      create: {
        id: `hp5-pc-${cat.slug}`,
        platform_id: pcPlatform.id,
        name: cat.name,
        slug: cat.slug,
      },
    });
    pcCategoryIds[cat.slug] = category.id;
  }
  console.log(`PC categories seeded`);

  // ---- HANDHELD PLATFORM ----
  const handheldPlatform = await prisma.platform.upsert({
    where: { id: "hp5-handheld" },
    update: {},
    create: {
      id: "hp5-handheld",
      game_id: game.id,
      name: "Handheld",
      slug: "handheld",
      timing_method: "realtime",
    },
  });

  const handheldSystemIds: Record<string, string> = {};
  for (const [srdcPlatId, sysName] of Object.entries(GBA_SYSTEM_MAP)) {
    const sys = await prisma.system.upsert({
      where: { name: sysName },
      update: {},
      create: { name: sysName },
    });
    await prisma.platformSystem.upsert({
      where: {
        platform_id_system_id: {
          platform_id: handheldPlatform.id,
          system_id: sys.id,
        },
      },
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
      where: { id: `hp5-handheld-${cat.slug}` },
      update: {},
      create: {
        id: `hp5-handheld-${cat.slug}`,
        platform_id: handheldPlatform.id,
        name: cat.name,
        slug: cat.slug,
      },
    });
    handheldCategoryIds[cat.slug] = category.id;
    handheldVariableValueIds[cat.slug] = {};

    const variable = await prisma.variable.upsert({
      where: { id: `hp5-handheld-${cat.slug}-platform` },
      update: {},
      create: {
        id: `hp5-handheld-${cat.slug}-platform`,
        category_id: category.id,
        name: "Platform",
        slug: "platform",
        is_subcategory: true,
      },
    });

    for (const val of cat.values) {
      const value = await prisma.variableValue.upsert({
        where: { id: `hp5-handheld-${cat.slug}-platform-${val.slug}` },
        update: {},
        create: {
          id: `hp5-handheld-${cat.slug}-platform-${val.slug}`,
          variable_id: variable.id,
          name: val.name,
          slug: val.slug,
          is_coop: false,
          required_players: 1,
        },
      });
      handheldVariableValueIds[cat.slug][val.slug] = value.id;
    }
  }
  console.log(`Handheld categories + variables seeded`);

  return {
    pcPlatform,
    pcSystemIds,
    pcCategoryIds,
    handheldPlatform,
    handheldSystemIds,
    handheldCategoryIds,
    handheldVariableValueIds,
  };
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log("Starting HP5 seed...");

  const {
    pcPlatform,
    pcSystemIds,
    pcCategoryIds,
    handheldPlatform,
    handheldSystemIds,
    handheldCategoryIds,
    handheldVariableValueIds,
  } = await seedStructure();

  // ---- PC runs (no variable filtering needed) ----
  console.log("\n=== Seeding PC runs ===");
  for (const cat of PC_CATEGORIES) {
    console.log(`\n  Fetching runs for ${cat.name}...`);
    const runs = await fetchAllRunsByCategory(SRDC_HP5_PC_GAME_ID, cat.srdcId);
    console.log(`  Total fetched: ${runs.length}`);

    const categoryId = pcCategoryIds[cat.slug];

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
        ? (pcSystemIds[run.system.platform] ?? null)
        : null;
      const players = run.players?.data ?? run.players ?? [];
      const primaryPlayer = players.find((p: any) => p.rel === "user");

      if (!primaryPlayer) {
        console.warn(`    Skipping run ${srdcRunId} - no user player`);
        continue;
      }

      let userId: string;
      try {
        userId = await upsertUser(primaryPlayer.id);
        await sleep(300);
      } catch (e) {
        console.warn(`    Could not fetch user ${primaryPlayer.id}: ${e}`);
        continue;
      }

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
        },
      });
      console.log(`    ✓ Run ${srdcRunId}`);
      await sleep(200);
    }
  }

  // ---- Handheld runs (filter by Platform variable per category) ----
  console.log("\n=== Seeding Handheld runs ===");
  for (const cat of GBA_CATEGORIES) {
    console.log(`\n  Fetching all runs for ${cat.name}...`);
    const allCatRuns = await fetchAllRunsByCategory(
      SRDC_HP5_GBA_GAME_ID,
      cat.srdcId,
    );
    console.log(`  Total fetched: ${allCatRuns.length}`);

    const categoryId = handheldCategoryIds[cat.slug];

    for (const val of cat.values) {
      const runs = allCatRuns.filter(
        (r: any) => r.values?.[cat.variableId] === val.srdcId,
      );
      console.log(`\n  ${cat.name} / ${val.name}: ${runs.length} runs`);

      const variableValueId =
        handheldVariableValueIds[cat.slug][val.slug];

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
          ? (handheldSystemIds[run.system.platform] ?? null)
          : null;
        const players = run.players?.data ?? run.players ?? [];
        const primaryPlayer = players.find((p: any) => p.rel === "user");

        if (!primaryPlayer) {
          console.warn(`    Skipping run ${srdcRunId} - no user player`);
          continue;
        }

        let userId: string;
        try {
          userId = await upsertUser(primaryPlayer.id);
          await sleep(300);
        } catch (e) {
          console.warn(`    Could not fetch user ${primaryPlayer.id}: ${e}`);
          continue;
        }

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
            variable_values: {
              create: [{ variable_value_id: variableValueId }],
            },
          },
        });
        console.log(`    ✓ Run ${srdcRunId}`);
        await sleep(200);
      }
    }
  }

  console.log("\n✓ HP5 seed complete.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());