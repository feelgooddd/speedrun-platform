// scrape-game.ts
// Run with: npx ts-node scrape-game.ts <game-slug> <output-prefix> [variables-file]
// Example (no subcategories):    npx ts-node scrape-game.ts hp2gba hp2gba
// Example (with subcategories):  npx ts-node scrape-game.ts hp2_6th_gen hp2_6th_gen hp2_6th_gen-variables.json
// Example (category-scoped):     npx ts-node scrape-game.ts hp1gbc hp1gbc hp1gbc-variables.json
console.log('Script starting...');

interface SRCGame {
  id: string;
  names: { international: string };
}

interface SRCCategory {
  id: string;
  name: string;
  type: string;
}

interface SRCRun {
  place: number;
  run: {
    id: string;
    weblink: string;
    videos?: { links?: Array<{ uri: string }> };
    comment: string | null;
    players: Array<{ rel: string; id?: string; name?: string; uri?: string }>;
    date: string;
    submitted: string;
    times: {
      primary: string;
      primary_t: number;
      realtime: string;
      realtime_t: number;
      realtime_noloads?: string;
      realtime_noloads_t?: number;
      ingame?: string;
      ingame_t?: number;
    };
    system: { platform: string; emulated: boolean; region: string | null };
    values: Record<string, string>;
  };
}

interface LeaderboardData {
  data: { runs: SRCRun[] };
}

interface VariableValue {
  id: string;
  label: string;
}

interface Variable {
  id: string;
  name: string;
  isSubcategory: boolean;
  scope: string;
  values: VariableValue[];
}

interface LoadedVariables {
  vars: Variable[];
  categoryNames: string[] | null;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  return response.json() as Promise<T>;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function loadVariables(variablesFile: string): LoadedVariables {
  const fs = require('fs');
  const raw = JSON.parse(fs.readFileSync(variablesFile, 'utf-8'));

  let allowedIds: string[] | null = null;
  let categoryNames: string[] | null = null;
  let variablesRaw: any[];

  if (Array.isArray(raw)) {
    variablesRaw = raw;
  } else if (raw.variables && Array.isArray(raw.variables)) {
    variablesRaw = raw.variables;
    if (Array.isArray(raw.allowedIds)) allowedIds = raw.allowedIds;
    if (Array.isArray(raw.categoryNames)) categoryNames = raw.categoryNames;
  } else {
    throw new Error('Invalid variables file format.');
  }

  const vars = variablesRaw
    .filter((v: any) => v['is-subcategory'] === true)
    .filter((v: any) => Object.keys(v.values.values).length > 1)
    .filter((v: any) => allowedIds === null || allowedIds.includes(v.id))
    .map((v: any) => ({
      id: v.id,
      name: v.name,
      isSubcategory: true,
      scope: v.scope?.type ?? 'global',
      values: Object.entries(v.values.values).map(([id, val]: [string, any]) => ({
        id,
        label: val.label
      }))
    }));

  return { vars, categoryNames };
}

async function resolveGame(gameSlug: string): Promise<{ id: string; name: string }> {
  try {
    const gameData = await fetchJson<{ data: SRCGame }>(`https://www.speedrun.com/api/v1/games/${gameSlug}`);
    return { id: gameData.data.id, name: gameData.data.names.international };
  } catch {
    console.log(`Direct lookup failed, trying abbreviation search for "${gameSlug}"...`);
    const searchData = await fetchJson<{ data: SRCGame[] }>(
      `https://www.speedrun.com/api/v1/games?abbreviation=${encodeURIComponent(gameSlug)}`
    );
    if (!searchData.data || searchData.data.length === 0) {
      throw new Error(`No game found for slug/abbreviation: ${gameSlug}`);
    }
    return { id: searchData.data[0].id, name: searchData.data[0].names.international };
  }
}

async function scrapeGame(gameSlug: string, outputPrefix: string, variablesFile?: string) {
  const fs = require('fs');

  let subcategoryVars: Variable[] = [];
  let subcategoryCategoryNames: string[] | null = null;

  if (variablesFile) {
    const loaded = loadVariables(variablesFile);
    subcategoryVars = loaded.vars;
    subcategoryCategoryNames = loaded.categoryNames;
    console.log(`📋 Loaded ${subcategoryVars.length} subcategory variable(s) from ${variablesFile}`);
    if (subcategoryCategoryNames) {
      console.log(`   Subcategories apply only to: ${subcategoryCategoryNames.join(', ')}`);
    }
    console.log('');
    subcategoryVars.forEach(v => {
      console.log(`  Variable: ${v.name} (${v.id})`);
      v.values.forEach(val => console.log(`    - ${val.label} (${val.id})`));
    });
    console.log('');
  }

  console.log(`Fetching game data for ${gameSlug}...\n`);

  const { id: gameId, name: gameName } = await resolveGame(gameSlug);
  console.log(`Found: ${gameName} (${gameId})\n`);

  await sleep(1000);

  const categoriesData = await fetchJson<{ data: SRCCategory[] }>(
    `https://www.speedrun.com/api/v1/games/${gameId}/categories`
  );
  const categories = categoriesData.data.filter(cat => cat.type === 'per-game');

  console.log('Full-game categories found:');
  categories.forEach(cat => console.log(`  - ${cat.name} (${cat.id})`));
  console.log('');

  for (const category of categories) {
    const useSubcategories =
      subcategoryVars.length > 0 &&
      (subcategoryCategoryNames === null || subcategoryCategoryNames.includes(category.name));

    if (!useSubcategories) {
      console.log(`Fetching runs for ${category.name}...`);
      await sleep(1000);

      const url = `https://www.speedrun.com/api/v1/leaderboards/${gameId}/category/${category.id}?embed=players&top=10000`;
      const leaderboardData = await fetchJson<LeaderboardData>(url);
      const runs = leaderboardData.data.runs;
      console.log(`  Found ${runs.length} runs`);

      const filename = `${outputPrefix}-${category.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.json`;
      const output = {
        game: { id: gameId, name: gameName, slug: gameSlug },
        category: { id: category.id, name: category.name },
        runCount: runs.length,
        runs,
        scrapedAt: new Date().toISOString()
      };

      fs.writeFileSync(filename, JSON.stringify(output, null, 2));
      console.log(`  ✓ Saved to ${filename}\n`);
    } else {
      const combinations = buildCombinations(subcategoryVars);

      for (const combo of combinations) {
        const labelParts = combo.map(c => c.valueLabel).join('-');
        const queryParams = combo.map(c => `var-${c.varId}=${c.valueId}`).join('&');
        const safeLabel = labelParts.toLowerCase().replace(/[^a-z0-9]/g, '');
        const catSlug = category.name.toLowerCase().replace(/[^a-z0-9]/g, '');

        console.log(`Fetching runs for ${category.name} [${labelParts}]...`);
        await sleep(1000);

        const url = `https://www.speedrun.com/api/v1/leaderboards/${gameId}/category/${category.id}?${queryParams}&embed=players&top=10000`;
        const leaderboardData = await fetchJson<LeaderboardData>(url);
        const runs = leaderboardData.data.runs;
        console.log(`  Found ${runs.length} runs`);

        const filename = `${outputPrefix}-${catSlug}-${safeLabel}.json`;
        const output = {
          game: { id: gameId, name: gameName, slug: gameSlug },
          category: { id: category.id, name: category.name },
          subcategory: combo.map(c => ({
            varId: c.varId,
            varName: c.varName,
            valueId: c.valueId,
            valueLabel: c.valueLabel
          })),
          runCount: runs.length,
          runs,
          scrapedAt: new Date().toISOString()
        };

        fs.writeFileSync(filename, JSON.stringify(output, null, 2));
        console.log(`  ✓ Saved to ${filename}\n`);
      }
    }
  }

  console.log('✓ All categories scraped successfully!');
  console.log('\nFiles created:');
  const files = fs
    .readdirSync('.')
    .filter((f: string) => f.startsWith(outputPrefix) && f.endsWith('.json') && !f.includes('variables'));
  files.forEach((f: string) => console.log(`  - ${f}`));
}

interface Combo {
  varId: string;
  varName: string;
  valueId: string;
  valueLabel: string;
}

function buildCombinations(vars: Variable[]): Combo[][] {
  if (vars.length === 0) return [[]];
  const [first, ...rest] = vars;
  const restCombos = buildCombinations(rest);
  const result: Combo[][] = [];
  for (const val of first.values) {
    for (const restCombo of restCombos) {
      result.push([
        { varId: first.id, varName: first.name, valueId: val.id, valueLabel: val.label },
        ...restCombo
      ]);
    }
  }
  return result;
}

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: npx ts-node scrape-game.ts <game-slug> <output-prefix> [variables-file]');
  process.exit(1);
}

const [gameSlug, outputPrefix, variablesFile] = args;

scrapeGame(gameSlug, outputPrefix, variablesFile).catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});