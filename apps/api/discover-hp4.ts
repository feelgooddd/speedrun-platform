const GAMES = ["hp4", "hp4gba"];

async function fetchJson(url: string) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "WizardingRuns-Discovery/1.0",
      Accept: "application/json",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function discoverGame(gameSlug: string) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`GAME: ${gameSlug}`);
  console.log("=".repeat(60));

  // Get game info
  const gameData = await fetchJson(`https://www.speedrun.com/api/v1/games/${gameSlug}?embed=categories,variables,platforms`);
  const game = gameData.data;

  console.log(`\nGame ID: ${game.id}`);
  console.log(`Game Name: ${game.names.international}`);

  // Platforms
  console.log(`\n--- PLATFORMS ---`);
  const platforms = game.platforms?.data ?? [];
  for (const p of platforms) {
    console.log(`  [${p.id}] ${p.name}`);
  }

  // Categories
  console.log(`\n--- CATEGORIES ---`);
  const categories = game.categories?.data ?? [];
  for (const cat of categories) {
    console.log(`\n  [${cat.id}] ${cat.name} (type: ${cat.type})`);

    // Get variables for this category
    const varData = await fetchJson(
      `https://www.speedrun.com/api/v1/categories/${cat.id}/variables`
    );
    const variables = varData.data ?? [];

    if (variables.length === 0) {
      console.log(`    No variables`);
    } else {
      for (const v of variables) {
        console.log(`\n    Variable: [${v.id}] "${v.name}" (scope: ${v.scope?.type ?? "unknown"}, is-subcategory: ${v["is-subcategory"]})`);
        const values = Object.entries(v.values?.values ?? {});
        for (const [valId, valData] of values) {
          const val = valData as any;
          console.log(`      Value: [${valId}] "${val.label}"${v.values?.default === valId ? " (default)" : ""}`);
        }
      }
    }

    // Peek at leaderboard for this category to see run count
    try {
      const lbData = await fetchJson(
        `https://www.speedrun.com/api/v1/leaderboards/${game.id}/category/${cat.id}?top=1`
      );
      const runs = lbData.data?.runs ?? [];
      console.log(`\n    Leaderboard runs (top 1 peek): ${runs.length > 0 ? "has runs" : "empty"}`);
      if (runs.length > 0) {
        const run = runs[0].run;
        console.log(`    Sample run ID: ${run.id}`);
        console.log(`    Sample run players: ${JSON.stringify(run.players)}`);
        console.log(`    Sample run values: ${JSON.stringify(run.values)}`);
        console.log(`    Sample run times: ${JSON.stringify(run.times)}`);
      }
    } catch (e) {
      console.log(`    Could not peek leaderboard: ${e}`);
    }
  }
}

async function main() {
  for (const slug of GAMES) {
    await discoverGame(slug);
    // Be polite to SRDC API
    await new Promise((r) => setTimeout(r, 1000));
  }
}

main().catch(console.error);