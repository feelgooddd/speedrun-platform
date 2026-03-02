// fetch-variables.ts
// Run with: npx ts-node fetch-variables.ts <game-id>

interface SRCVariable {
  id: string;
  name: string;
  category: string | null;
  scope: {
    type: string;
  };
  mandatory: boolean;
  "user-defined": boolean;
  obsoletes: boolean;
  values: {
    values: Record<
      string,
      {
        label: string;
        rules: string | null;
        flags: any;
      }
    >;
    default?: string;
  };
  "is-subcategory": boolean;
}

async function fetchVariables(gameId: string) {
  console.log(`Fetching variables for game ${gameId}...\n`);

  const response = await fetch(
    `https://www.speedrun.com/api/v1/games/${gameId}/variables`,
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = await response.json();

  const variables: SRCVariable[] = (data as any).data;

  console.log(`Found ${variables.length} variables\n`);
  console.log("=".repeat(60));

  for (const variable of variables) {
    console.log(`\nVariable: ${variable.name}`);
    console.log(`ID: ${variable.id}`);
    console.log(`Is Subcategory: ${variable["is-subcategory"]}`);
    console.log(`Mandatory: ${variable.mandatory}`);
    console.log(`Scope: ${variable.scope.type}`);

    if (variable.category) {
      console.log(`Category: ${variable.category}`);
    }

    console.log("\nPossible Values:");

    const valueEntries = variable.values?.values
      ? Object.entries(variable.values.values)
      : [];

    valueEntries.forEach(([valueId, valueData]) => {
      console.log(`  - ${valueData.label} (ID: ${valueId})`);
    });

    if (variable.values.default) {
      console.log(`Default: ${variable.values.default}`);
    }

    console.log("-".repeat(60));
  }

  const fs = require("fs");

  fs.writeFileSync(
    `${gameId}-variables.json`,
    JSON.stringify(variables, null, 2),
  );

  console.log(`\n✓ Saved to ${gameId}-variables.json`);
}

const gameId = process.argv[2];

if (!gameId) {
  console.error("Usage: npx ts-node fetch-variables.ts <game-id>");
  process.exit(1);
}

fetchVariables(gameId).catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
