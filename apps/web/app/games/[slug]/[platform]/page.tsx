import Link from "next/link";
import { notFound } from "next/navigation";
import LeaderboardTabs from "@/app/components/leaderboard/LeaderboardTabs";

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
  // variable-filtered runs keyed by "varSlug:valueSlug"
  variableRuns?: Record<string, { runs: Run[]; total: number }>;
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
): Promise<{ runs: Run[]; total: number }> {
  let url = subcategory
    ? `${process.env.NEXT_PUBLIC_API_URL}/games/${slug}/${platform}/${category}/${subcategory}?page=1&limit=25`
    : `${process.env.NEXT_PUBLIC_API_URL}/games/${slug}/${platform}/${category}?page=1&limit=25`;

  if (variableFilters) {
    for (const [key, value] of Object.entries(variableFilters)) {
      url += `&${key}=${value}`;
    }
  }

  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) return { runs: [], total: 0 };
  const data = await res.json();
  return { runs: data.runs ?? [], total: data.total ?? 0 };
}

export default async function PlatformPage({
  params,
}: {
  params: Promise<{ slug: string; platform: string }>;
}) {
  const { slug, platform } = await params;
  const game = await getGame(slug);
  if (!game) notFound();

  const platformData = game.platforms.find((p) => p.slug === platform);
  if (!platformData) notFound();

  const platformCategories = await getPlatformCategories(slug, platform);

  const categories: Category[] = await Promise.all(
    platformCategories.map(async (cat) => {
      // Has subcategories (legacy HP1-3)
      if (cat.subcategories && cat.subcategories.length > 0) {
        const subcategoriesWithRuns: Subcategory[] = await Promise.all(
          cat.subcategories.map(async (sub) => {
            const { runs, total } = await getLeaderboard(slug, platform, cat.slug, sub.slug);
            return { ...sub, runs, total };
          }),
        );
        return { ...cat, subcategories: subcategoriesWithRuns };
      }

      // Has variables (HP4+)
      if (cat.variables && cat.variables.length > 0) {
        // Find the first subcategory-style variable (is_subcategory: true)
        const primaryVar = cat.variables.find((v) => v.is_subcategory) ?? cat.variables[0];
        const variableRuns: Record<string, { runs: Run[]; total: number }> = {};

        // Only fetch the first value on SSR; client fetches the rest on tab switch
        const firstValue = primaryVar.values[0];
        if (firstValue) {
          const key = `${primaryVar.slug}:${firstValue.slug}`;
          const result = await getLeaderboard(slug, platform, cat.slug, undefined, {
            [primaryVar.slug]: firstValue.slug,
          });
          variableRuns[key] = result;
        }

        return { ...cat, variableRuns };
      }

      // No subcategories or variables - fetch runs directly
      const { runs, total } = await getLeaderboard(slug, platform, cat.slug);
      return { ...cat, runs, total };
    }),
  );

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
          categories={categories}
          gameSlug={slug}
          platformSlug={platform}
        />
      </div>
    </div>
  );
}