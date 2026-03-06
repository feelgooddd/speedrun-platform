import { notFound } from "next/navigation";
import Link from "next/link";
import PBTable from "@/app/components/profile/Pbtable";
import RunsTable from "@/app/components/profile/Runstable";
import SettingsLink from "@/app/components/profile/SetingsLink";
import { countryCodeToFlag } from "@/app/lib/flags";
interface PersonalBest {
  is_coop: boolean;
  game_id: string;
  game_name: string;
  game_slug: string;
  category_id: string;
  category_name: string;
  category_slug: string;
  subcategory_name?: string | null;
  platform: string;
  platform_slug: string;
  timing_method: string;
  realtime_ms: number | null;
  realtime_display: string | null;
  gametime_ms: number | null;
  gametime_display: string | null;
  video_url: string | null;
  comment: string | null;
  rank: number;
  runners:
    | {
        id: string;
        username: string;
        display_name: string | null;
        country: string | null;
      }[]
    | null;
}

interface Run {
  id: string;
  game: string;
  category: string;
  platform: string;
  timing_method: string;
  realtime_ms: number | null;
  realtime_display: string | null;
  gametime_ms: number | null;
  gametime_display: string | null;
  verified: boolean;
  video_url: string | null;
  submitted_at: string;
}

interface UserProfile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  country: string | null;
  twitch: string | null;
  is_placeholder: boolean;
  created_at: string;
  stats: {
    total_runs: number;
    verified_runs: number;
    gold_runs: number;
  };
  moderated_games: {
    id: string;
    name: string;
    slug: string;
    role: string;
  }[];
  personal_bests: PersonalBest[];
}

async function getUserProfile(id: string): Promise<UserProfile | null> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/${id}`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) return null;
  return res.json();
}

async function getUserRuns(id: string): Promise<Run[]> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/users/${id}/runs?limit=100`,
    {
      next: { revalidate: 60 },
    },
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.runs ?? [];
}

function groupByGame(pbs: PersonalBest[]) {
  const map = new Map<
    string,
    { game_name: string; game_slug: string; pbs: PersonalBest[] }
  >();
  for (const pb of pbs) {
    if (!map.has(pb.game_id)) {
      map.set(pb.game_id, {
        game_name: pb.game_name,
        game_slug: pb.game_slug,
        pbs: [],
      });
    }
    map.get(pb.game_id)!.pbs.push(pb);
  }
  return Array.from(map.values());
}

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  const [profile, runs] = await Promise.all([
    getUserProfile(username),
    getUserRuns(username),
  ]);

  if (!profile) notFound();

  const gameGroups = groupByGame(profile.personal_bests);
  const displayName = profile.display_name || profile.username;

  return (
    <div className="landing">
      <div className="section" style={{ paddingTop: "6rem" }}>
        <div className="section-header">
          <div className="section-ornament">✦ ✦ ✦</div>
          <div className="section-divider" />

          <div className="profile-header">
            <div className="profile-avatar">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt={displayName} />
              ) : (
                <span>{displayName[0].toUpperCase()}</span>
              )}
            </div>

            <div className="profile-identity">
              <div className="profile-username-row">
                {profile.country && (
                  <span className="profile-country">
                    {countryCodeToFlag(profile.country)}
                  </span>
                )}
                <h1 className="profile-username">{displayName}</h1>
                {profile.is_placeholder && (
                  <span className="profile-placeholder-badge">
                    Unregistered
                  </span>
                )}
                <SettingsLink username={profile.username} />
              </div>

              <div className="profile-meta">
                {profile.twitch && (
                  <a
                    href={profile.twitch}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="profile-twitch-link"
                  >
                    ▶ Twitch
                  </a>
                )}
                <span className="profile-joined">
                  Joined{" "}
                  {new Date(profile.created_at).toLocaleDateString("en-US", {
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="profile-stats">
          <div className="profile-stat">
            <span className="profile-stat-number">
              {profile.stats.verified_runs}
            </span>
            <span className="profile-stat-label">Verified Runs</span>
          </div>
          <div className="profile-stat">
            <span className="profile-stat-number">
              {profile.personal_bests.length}
            </span>
            <span className="profile-stat-label">Categories</span>
          </div>
          <div className="profile-stat">
            <span className="profile-stat-number" style={{ color: "#FFD700" }}>
              {profile.stats.gold_runs}
            </span>
            <span className="profile-stat-label">World Records</span>
          </div>
        </div>

        {/* Moderated Games */}
        {profile.moderated_games.length > 0 && (
          <div className="profile-section">
            <h2 className="profile-section-title">Moderates</h2>
            <div className="profile-mod-list">
              {profile.moderated_games.map((game) => (
                <Link
                  key={game.id}
                  href={`/games/${game.slug}`}
                  className="profile-mod-pill"
                >
                  {game.name}
                  <span className="profile-mod-role">{game.role}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Personal Bests */}
        <div className="profile-section">
          <h2 className="profile-section-title">Personal Bests</h2>
          <PBTable
            gameGroups={gameGroups}
            profileUser={{
              username: profile.username,
              display_name: profile.display_name,
              country: profile.country,
            }}
          />{" "}
        </div>

        {/* Other Runs */}
        <RunsTable runs={runs} personalBests={profile.personal_bests} />
      </div>
    </div>
  );
}
