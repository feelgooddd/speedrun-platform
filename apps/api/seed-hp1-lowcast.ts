import prisma from "./src/lib/prisma";

const SRDC_GAME_ID = "3dx2xov1";
const SRDC_CATEGORY_ID = "xd1j7vwd";
const SRDC_VARIABLE_ID = "789x9o08";
const SRDC_LOWCAST_VALUE_ID = "rqvj9v5q";
const CATEGORY_ID = "hp1-pc-lowcast";
const PLATFORM_ID = "cmm1aachi0003dc8owk83f9od";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
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

function decodeLowcastTime(iso: string): { casts: number; realtimeMs: number } {
  // Format: PTxxHyyMzz.zzzS
  // Hours = casts, Minutes = actual hours, Seconds = actual minutes, MS = actual seconds * 10... wait
  // Rule: Hours=Casts, Minutes=Hours on timer, Seconds=Minutes on timer, MS=Seconds*10
  // So actual time = minutes:seconds of the ISO time, converted to ms
  // PT73H3M5.320S → casts=73, actual time = 3min 5.32sec
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?/);
  if (!match) return { casts: 0, realtimeMs: 0 };

  const hours = parseInt(match[1] ?? "0");   // = casts
  const minutes = parseInt(match[2] ?? "0"); // = actual hours on timer... wait
  const seconds = parseFloat(match[3] ?? "0"); // = actual minutes on timer

  // Rule: Hours=Casts, Minutes=Hours, Seconds=Minutes, MS=Seconds×10
  // So actual time in ms = minutes * 3600000 + seconds * 60000
  // Wait, let me re-read: Hours=Casts, Minutes=Hours on timer, Seconds=Minutes on timer, MS=Seconds×10
  // That means: actual_hours = minutes field, actual_minutes = seconds field, actual_seconds = ms field / 10
  // But there's no ms field in the ISO... 
  // Looking at run 1: PT73H3M5.320S → casts=73, time=3h05m32s (5.32 * 10 = 53.2... hmm)
  // Actually: minutes=3 = actual hours, seconds=5.320 = actual minutes, ms = 5.320 * 10 = 53.2s? No...
  // Let me look at Koni's run: PT73H3M5.320S, his time on LB shows 3:05:32
  // So: hours=73 casts, minutes=3 actual hours, seconds=5.32 actual minutes... 5.32 * 60 = 319.2s? No
  // 3h 05m 32s: minutes=3h, seconds field=5 → 5min, ms=320 → 32s
  // So: actual_hours = minutes, actual_minutes = floor(seconds), actual_seconds = (seconds % 1) * 1000 / 10... 
  // 5.320: floor=5 minutes, 0.320 * 1000 = 320, 320/10 = 32 seconds. YES!

  const casts = hours;
  const actualHours = minutes;
  const actualMinutes = Math.floor(seconds);
  const actualSeconds = Math.round((seconds % 1) * 1000 / 10);
  const realtimeMs = actualHours * 3600000 + actualMinutes * 60000 + actualSeconds * 1000;

  return { casts, realtimeMs };
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
  console.log("=== HP1 LOWCAST SCRAPER START ===");

  const url = `https://www.speedrun.com/api/v1/leaderboards/${SRDC_GAME_ID}/category/${SRDC_CATEGORY_ID}?var-${SRDC_VARIABLE_ID}=${SRDC_LOWCAST_VALUE_ID}&embed=players`;
  const data = await fetchJson(url);

  const runs = data.data.runs ?? [];
  const playersMap = new Map<string, any>();
  for (const p of data.data.players?.data ?? []) {
    playersMap.set(p.id, p);
  }

  console.log(`Found ${runs.length} runs`);

  for (const entry of runs) {
    const run = entry.run;
    const srdcRunId = run.id;

    const existing = await prisma.run.findUnique({ where: { speedrun_com_id: srdcRunId } });
    if (existing) {
      console.log(`  Skipping existing ${srdcRunId}`);
      continue;
    }

    const { casts, realtimeMs } = decodeLowcastTime(run.times.realtime);
    const videoUrl = run.videos?.links?.[0]?.uri ?? null;
    const comment = run.comment ?? null;
    const submittedAt = run.date ? new Date(run.date) : new Date();

    // Resolve player
    const playerRef = run.players?.[0];
    if (!playerRef || playerRef.rel === "guest") {
      console.warn(`  Skipping ${srdcRunId} — guest or no player`);
      continue;
    }

    let userId: string;
    try {
      // Try embedded players first
      const embedded = playersMap.get(playerRef.id);
      if (embedded) {
        const existing = await prisma.user.findUnique({ where: { speedrun_com_id: playerRef.id } });
        if (existing) {
          userId = existing.id;
        } else {
          const username = embedded.names?.international ?? playerRef.id;
          const created = await prisma.user.create({
            data: {
              username: username.toLowerCase(),
              display_name: username,
              speedrun_com_id: playerRef.id,
              is_placeholder: true,
              avatar_url: embedded.assets?.image?.uri ?? null,
              twitch: embedded.twitch?.uri ?? null,
              country: embedded.location?.country?.code ?? null,
            },
            
          });
          userId = created.id;
        }
      } else {
        userId = await upsertUser(playerRef.id);
        await sleep(200);
      }
    } catch (e) {
      console.warn(`  Could not process player for ${srdcRunId}`);
      continue;
    }

await prisma.run.create({
  data: {
    user_id: userId,
    category_id: CATEGORY_ID,
    platform_id: PLATFORM_ID,
    is_coop: false,
    realtime_ms: realtimeMs,
    gametime_ms: realtimeMs,
    score_value: casts,
    video_url: videoUrl,
    comment,
    verified: true,
    submitted_at: submittedAt,
    speedrun_com_id: srdcRunId,
    submitted_by_id: userId,
  },
});

    console.log(`  ✓ ${srdcRunId} — ${casts} casts, ${realtimeMs}ms`);
    await sleep(150);
  }

  console.log("\n✓ HP1 Lowcast import complete");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());