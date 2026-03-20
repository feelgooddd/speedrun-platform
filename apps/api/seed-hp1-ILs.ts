import prisma from "./src/lib/prisma";

const SRDC_GAME_ID = "8m1zpm60";
const SRDC_CATEGORY_ID = "n2yo34md";
const PLATFORM_ID = "cmm261efa00003j8oow4a2bc8";
const DB_CATEGORY_ID = "cmm264sj4004k3j8o1mk9cukt";

const SRDC_PLATFORM_MAP: Record<string, string> = {
  "wxeod9rn": "PlayStation",
  "n5e17e27": "PlayStation 2",
  "mx6pwe3g": "PlayStation 3",
};

const SRDC_EMU_MAP: Record<string, string> = {
  "wxeod9rn": "PS1 EMU",
  "n5e17e27": "PS2 EMU",
  "mx6pwe3g": "PS3 EMU",
};

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

async function main() {
  console.log("=== HP1 PS1 NMG SEEDER START ===");

  // Build system ID map
  const allSystemNames = [
    ...Object.values(SRDC_PLATFORM_MAP),
    ...Object.values(SRDC_EMU_MAP),
  ];
  const systems = await prisma.system.findMany({
    where: { name: { in: allSystemNames } },
  });
  const systemIds: Record<string, string> = {};
  for (const s of systems) systemIds[s.name] = s.id;

  const runs: any[] = [];
  let offset = 0;
  const max = 200;

  while (true) {
    const url =
      `https://www.speedrun.com/api/v1/runs?` +
      `game=${SRDC_GAME_ID}&category=${SRDC_CATEGORY_ID}` +
      `&status=verified&orderby=date&direction=asc` +
      `&max=${max}&offset=${offset}&embed=players`;

    console.log(`Fetching runs offset=${offset}`);
    const data = await fetchJson(url);
    const batch = data.data ?? [];
    runs.push(...batch);
    if (batch.length < max) break;
    offset += max;
    await sleep(600);
  }

  console.log(`Total runs: ${runs.length}`);

  for (const run of runs) {
    const srdcRunId = run.id;

    const existing = await prisma.run.findUnique({ where: { speedrun_com_id: srdcRunId } });
    if (existing) continue;

    const realtimeMs = isoToMs(run.times?.realtime ?? null);
    const videoUrl = run.videos?.links?.[0]?.uri ?? null;
    const comment = run.comment ?? null;
    const submittedAt = run.date ? new Date(run.date) : new Date();

    const srdcPlatformId = run.system?.platform ?? null;
    const isEmulated = run.system?.emulated === true;
    const systemName = isEmulated
      ? (SRDC_EMU_MAP[srdcPlatformId] ?? null)
      : (SRDC_PLATFORM_MAP[srdcPlatformId] ?? null);
    const system_id = systemName ? (systemIds[systemName] ?? null) : null;

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
        category_id: DB_CATEGORY_ID,
        platform_id: PLATFORM_ID,
        is_coop: userIds.length > 1,
        realtime_ms: realtimeMs,
        gametime_ms: null,
        video_url: videoUrl,
        comment,
        verified: true,
        submitted_at: submittedAt,
        system_id,
        speedrun_com_id: srdcRunId,
        runners: {
          create: userIds.map((uid) => ({ user_id: uid })),
        },
      },
    });

    console.log(`✓ ${srdcRunId}`);
    await sleep(150);
  }

  console.log("\n✓ HP1 PS1 NMG seeding complete");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());