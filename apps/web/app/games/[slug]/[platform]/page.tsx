import Link from "next/link";
import { notFound } from "next/navigation";
import LeaderboardTabs from "@/app/components/leaderboard/LeaderboardTabs";
import { apiFetch } from "@/app/lib/api";
interface Run {
  rank: number;
  id: string;
  system: string | null;
  comment: string | null;
  realtime_ms: number | null;
  gametime_ms: number | null;
  realtime_display: string | null;
  gametime_display: string | null;
  primary_time_ms?: number | null;
  primary_time_display?: string | null;
  timing_method?: string;
  video_url: string;
  submitted_at: string;
  user: {
    id: string;
    username: string;
    display_name: string | null;
    country: string | null;
  };
}

interface Subcategory {
  id: string;
  name: string;
  slug: string;
  runs: Run[];
  total?: number;
}

interface VariableValue {
  id: string;
  name: string;
  slug: string;
  is_coop: boolean;
  required_players: number;
  hidden_variables?: { variable_id: string }[];
}

interface Variable {
  id: string;
  name: string;
  slug: string;
  is_subcategory: boolean;
  values: VariableValue[];
}

interface Category {
  id: string;
  name: string;
  slug: string;
  subcategories?: Subcategory[];
  variables?: Variable[];
  runs?: Run[];
  total?: number;
  category_type?: string;
  rules?: string | null;
  variableRuns?: Record<string, { runs: Run[]; total: number }>;
}

interface CategoryWithPlatformRules extends Category {
  platform_rules: string | null;
}

interface Game {
  id: string;
  slug: string;
  name: string;
  platforms: { id: string; name: string; slug: string }[];
}

async function getGame(slug: string): Promise<Game | null> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/games/${slug}`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.game ?? data;
}

async function getPlatformCategories(
  slug: string,
  platform: string,
): Promise<Category[]> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/games/${slug}/${platform}/categories`,
    { next: { revalidate: 60 } },
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.categories ?? [];
}

async function getLeaderboard(
  slug: string,
  platform: string,
  category: string,
  subcategory?: string,
  variableFilters?: Record<string, string>,
): Promise<{ runs: Run[]; total: number; platform_rules: string | null; category_rules: string | null }> {
  const empty = { runs: [], total: 0, platform_rules: null, category_rules: null };

  let path = subcategory
    ? `/games/${slug}/${platform}/${category}/${subcategory}?page=1&limit=25`
    : `/games/${slug}/${platform}/${category}?page=1&limit=25`;

  if (variableFilters) {
    for (const [key, value] of Object.entries(variableFilters)) {
      path += `&${key}=${value}`;
    }
  }

  const data = await apiFetch(path);
  if (!data) return empty;

  return {
    runs: data.runs ?? [],
    total: data.total ?? 0,
    platform_rules: data.platform_rules ?? null,
    category_rules: data.category_rules ?? null,
  };
}

export default async function PlatformPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; platform: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const { slug, platform } = await params;
  const sp = await searchParams;

  const game = await getGame(slug);
  if (!game) notFound();

  const platformData = game.platforms.find((p) => p.slug === platform);
  if (!platformData) notFound();

  const platformCategories = await getPlatformCategories(slug, platform);

  const categoriesWithPlatformRules: CategoryWithPlatformRules[] = await Promise.all(
    platformCategories.map(async (cat) => {
      if (cat.subcategories && cat.subcategories.length > 0) {
        const subcategoriesWithRuns: Subcategory[] = await Promise.all(
          cat.subcategories.map(async (sub) => {
            const { runs, total } = await getLeaderboard(
              slug,
              platform,
              cat.slug,
              sub.slug,
            );
            return { ...sub, runs, total };
          }),
        );
        const { platform_rules: pr, category_rules: cr } = await getLeaderboard(
          slug,
          platform,
          cat.slug,
          cat.subcategories[0].slug,
        );
        return { ...cat, subcategories: subcategoriesWithRuns, rules: cr, platform_rules: pr };
      }

      if (cat.variables && cat.variables.length > 0) {
        const variableRuns: Record<string, { runs: Run[]; total: number }> = {};

        const defaultFilters: Record<string, string> = {};
        for (const v of cat.variables) {
          if (v.values[0]) defaultFilters[v.slug] = v.values[0].slug;
        }

        if (Object.keys(defaultFilters).length > 0) {
          const key = Object.entries(defaultFilters)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}:${v}`)
            .join("|");

          const { runs, total, platform_rules: pr, category_rules: cr } = await getLeaderboard(
            slug,
            platform,
            cat.slug,
            undefined,
            defaultFilters,
          );
          variableRuns[key] = { runs, total };
          return { ...cat, variableRuns, rules: cr, platform_rules: pr };
        }

        return { ...cat, variableRuns, rules: null, platform_rules: null };
      }

      const { runs, total, platform_rules: pr, category_rules: cr } = await getLeaderboard(
        slug,
        platform,
        cat.slug,
      );
      return { ...cat, runs, total, rules: cr, platform_rules: pr };
    }),
  );

  const platformRules = categoriesWithPlatformRules[0]?.platform_rules ?? null;

  const categories: Category[] = categoriesWithPlatformRules.map(
    ({ platform_rules, ...rest }) => rest,
  );

  const fullGameCategories = categories.filter(
    (c) => !c.category_type || c.category_type === "full_game",
  );
  const extensionCategories = categories.filter(
    (c) => c.category_type === "extension",
  );

  const initialTab = (sp.type as "fullgame" | "il" | "extension") || "fullgame";
  const initialCategory = sp.category || null;
  const initialSubcategory = sp.subcategory || null;
  const initialLevel = sp.level || null;

  const reservedKeys = new Set(["type", "category", "subcategory", "level"]);
  const initialVariables: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    if (!reservedKeys.has(k)) initialVariables[k] = v;
  }

  return (
    <div className="landing">
      <div className="section" style={{ paddingTop: "6rem" }}>
        <div className="section-header">
          <Link href={`/games/${slug}`} className="auth-back">
            ← {game.name}
          </Link>
          <div className="section-ornament" style={{ marginTop: "1rem" }}>
            ✦ ✦ ✦
          </div>
          <div className="section-divider" />
          <h1 className="section-title">{game.name}</h1>
          <p className="section-subtitle">{platformData.name} Leaderboards</p>
        </div>

        <LeaderboardTabs
          categories={fullGameCategories}
          extensionCategories={extensionCategories}
          gameSlug={slug}
          platformSlug={platform}
          platformName={platformData.name}
          gameName={game.name}
          platformRules={platformRules}
          initialTab={initialTab}
          initialCategory={initialCategory}
          initialSubcategory={initialSubcategory}
          initialLevel={initialLevel}
          initialVariables={initialVariables}
        />
      </div>
    </div>
  );
}