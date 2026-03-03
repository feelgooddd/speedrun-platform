// scrape-hp3-6thgen.ts
// Scrapes HP3 6th gen with proper per-subcategory fetching
// Run with: npx ts-node scrape-hp3-6thgen.ts

import * as fs from 'fs';

const GAME_SLUG = 'hp3_6th_gen';
const FILE_PREFIX = 'hp3-6thgen';

// Console/Emulator subcategory variable
const SUBCATEGORY_VAR_ID = 'yn2wrvjn';
const SUBCATEGORY_VALUES = [
  { id: '5q8n6vgq', label: 'Console' },
  { id: '4qykp241', label: 'Emulator' },
];

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  return response.json();
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log(`Fetching game data for ${GAME_SLUG}...`);

  const gameData = await fetchJson<{ data: { id: string; names: { international: string } } }>(
    `https://www.speedrun.com/api/v1/games/${GAME_SLUG}`
  );
  const gameId = gameData.data.id;
  const gameName = gameData.data.names.international;
  console.log(`Found: ${gameName} (${gameId})\n`);

  await sleep(1000);

  // Get full-game categories
  const categoriesData = await fetchJson<{ data: Array<{ id: string; name: string; type: string }> }>(
    `https://www.speedrun.com/api/v1/games/${gameId}/categories`
  );
  const categories = categoriesData.data.filter(c => c.type === 'per-game');

  console.log(`Categories (${categories.length}):`);
  categories.forEach(c => console.log(`  - ${c.name} (${c.id})`));
  console.log('');

  for (const category of categories) {
    const allRuns: any[] = [];

    for (const subValue of SUBCATEGORY_VALUES) {
      console.log(`Fetching ${category.name} - ${subValue.label}...`);
      await sleep(1000);

      const url = `https://www.speedrun.com/api/v1/leaderboards/${gameId}/category/${category.id}?var-${SUBCATEGORY_VAR_ID}=${subValue.id}&embed=players&top=10000`;
      const data = await fetchJson<{ data: { runs: any[] } }>(url);
      const runs = data.data.runs;

      console.log(`  Found ${runs.length} runs`);
      allRuns.push(...runs);
    }

    const slug = category.name
      .toLowerCase()
      .replace(/%/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const filename = `${FILE_PREFIX}-${slug}.json`;

    const output = {
      game: { id: gameId, name: gameName, slug: GAME_SLUG },
      platform: '6thGen',
      category: { id: category.id, name: category.name },
      runCount: allRuns.length,
      runs: allRuns,
      scrapedAt: new Date().toISOString(),
    };

    fs.writeFileSync(filename, JSON.stringify(output, null, 2));
    console.log(`  ✓ Saved ${allRuns.length} runs to ${filename}\n`);
  }

  console.log('✓ Done! Files created:');
  fs.readdirSync('.')
    .filter(f => f.startsWith(FILE_PREFIX) && f.endsWith('.json') && !f.includes('variables'))
    .forEach(f => {
      const data = JSON.parse(fs.readFileSync(f, 'utf-8'));
      console.log(`  - ${f} (${data.runCount} runs)`);
    });
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});