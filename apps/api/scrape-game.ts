// scrape-game.ts
// Run with: npx ts-node scrape-game.ts <game-slug> <output-prefix>
// Example: npx ts-node scrape-game.ts hp1gba hp1gba

interface SRCGame {
  id: string;
  names: {
    international: string;
  };
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
    videos?: {
      links?: Array<{ uri: string }>;
    };
    comment: string | null;
    players: Array<{
      rel: string;
      id?: string;
      name?: string;
      uri?: string;
    }>;
    date: string;
    submitted: string;
    times: {
      primary: string;
      primary_t: number;
      realtime: string;
      realtime_t: number;
      ingame?: string;
      ingame_t?: number;
    };
    system: {
      platform: string;
      emulated: boolean;
      region: string | null;
    };
    values: Record<string, string>;
  };
}

interface LeaderboardData {
  data: {
    runs: SRCRun[];
  };
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeGame(gameSlug: string, outputPrefix: string) {
  console.log(`Fetching game data for ${gameSlug}...\n`);
  
  // Step 1: Get game ID
  const gameData = await fetchJson<{ data: SRCGame }>(`https://www.speedrun.com/api/v1/games/${gameSlug}`);
  const gameId = gameData.data.id;
  const gameName = gameData.data.names.international;
  
  console.log(`Found: ${gameName} (${gameId})\n`);
  
  await sleep(1000);
  
  // Step 2: Get all categories (filter to full-game only, not ILs)
  const categoriesData = await fetchJson<{ data: SRCCategory[] }>(`https://www.speedrun.com/api/v1/games/${gameId}/categories`);
  const categories = categoriesData.data.filter(cat => cat.type === 'per-game');
  
  console.log('Full-game categories found:');
  categories.forEach(cat => {
    console.log(`  - ${cat.name} (${cat.id})`);
  });
  console.log('');
  
  // Step 3: Fetch leaderboards for each category
  for (const category of categories) {
    console.log(`Fetching runs for ${category.name}...`);
    
    await sleep(1000);
    
    const leaderboardUrl = `https://www.speedrun.com/api/v1/leaderboards/${gameId}/category/${category.id}?embed=players&top=10000`;
    const leaderboardData = await fetchJson<LeaderboardData>(leaderboardUrl);
    
    const runs = leaderboardData.data.runs;
    console.log(`  Found ${runs.length} runs`);
    
    // Create filename from category name
    const filename = `${outputPrefix}-${category.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.json`;
    
    const output = {
      game: {
        id: gameId,
        name: gameName,
        slug: gameSlug
      },
      category: {
        id: category.id,
        name: category.name
      },
      runCount: runs.length,
      runs: runs,
      scrapedAt: new Date().toISOString()
    };
    
    const fs = require('fs');
    fs.writeFileSync(filename, JSON.stringify(output, null, 2));
    console.log(`  ✓ Saved to ${filename}\n`);
  }
  
  console.log('✓ All categories scraped successfully!');
  console.log('\nFiles created:');
  const fs = require('fs');
  const files = fs.readdirSync('.').filter((f: string) => f.startsWith(outputPrefix) && f.endsWith('.json'));
  files.forEach((f: string) => console.log(`  - ${f}`));
}

// Get command line arguments
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: npx ts-node scrape-game.ts <game-slug> <output-prefix>');
  console.error('Example: npx ts-node scrape-game.ts hp1gba hp1gba');
  process.exit(1);
}

const [gameSlug, outputPrefix] = args;

scrapeGame(gameSlug, outputPrefix).catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});