"use client";
import { useState } from "react";
import Link from "next/link";
import { countryCodeToFlag } from "@/app/lib/flags";

interface Runner {
  id: string;
  username: string;
  display_name: string | null;
  country: string | null;
}

interface ProfileUser {
  username: string;
  display_name: string | null;
  country: string | null;
}

interface VariableValue {
  variable: string;
  variable_slug: string;
  value: string;
  value_slug: string;
}

interface PersonalBest {
  is_coop: boolean;
  game_id: string;
  game_name: string;
  game_slug: string;
  category_id: string;
  category_name: string;
  category_slug: string;
  subcategory_name?: string | null;
  variable_values?: VariableValue[];
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
  runners: Runner[] | null;
}

interface GameGroup {
  game_name: string;
  game_slug: string;
  pbs: PersonalBest[];
}

function getRankDisplay(rank: number) {
  if (rank === 1) return { label: "#1", className: "rank-1" };
  if (rank === 2) return { label: "#2", className: "rank-2" };
  if (rank === 3) return { label: "#3", className: "rank-3" };
  return { label: `#${rank}`, className: "" };
}

export default function PBTable({
  gameGroups,
  profileUser,
}: {
  gameGroups: GameGroup[];
  profileUser: ProfileUser;
}) {
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [expandedGames, setExpandedGames] = useState<Set<string>>(
    () => new Set(gameGroups.map((g) => g.game_slug))
  );

  const toggleGame = (slug: string) => {
    setExpandedGames((prev) => {
      const next = new Set(prev);
      next.has(slug) ? next.delete(slug) : next.add(slug);
      return next;
    });
  };

  if (gameGroups.length === 0) {
    return <p className="leaderboard-empty">No verified runs yet.</p>;
  }

  return (
    <div className="profile-pb-games">
      {gameGroups.map((group) => {
        const isGameExpanded = expandedGames.has(group.game_slug);
        const colCount = 6;

        return (
          <div key={group.game_slug} className="profile-pb-game">
            <div
              className="profile-pb-game-header"
              onClick={() => toggleGame(group.game_slug)}
              style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "0.5rem" }}
            >
              <span className="profile-pb-game-chevron">
                {isGameExpanded ? "▾" : "▸"}
              </span>
              <Link
                href={`/games/${group.game_slug}`}
                className="profile-pb-game-title"
                onClick={(e) => e.stopPropagation()}
              >
                {group.game_name}
              </Link>
              <span className="profile-pb-game-count">
                {group.pbs.length} {group.pbs.length === 1 ? "category" : "categories"}
              </span>
            </div>

            {isGameExpanded && (
              <div className="leaderboard-table-wrap">
                <table className="leaderboard-table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Category</th>
                      <th>Runner</th>
                      <th>Platform</th>
                      <th>Time</th>
                      <th>Video</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.pbs.map((pb) => {
                      const { label, className } = getRankDisplay(pb.rank);
                      const primaryTime =
                        pb.timing_method === "gametime"
                          ? pb.gametime_display
                          : pb.realtime_display;
                      const secondaryTime =
                        pb.timing_method === "gametime"
                          ? pb.realtime_display
                          : pb.gametime_display;
                      const secondaryLabel =
                        pb.timing_method === "gametime" ? "RTA" : "IGT";

                      const varKey = pb.variable_values?.length
                        ? pb.variable_values.map((v) => `${v.variable_slug}:${v.value_slug}`).join("-")
                        : pb.subcategory_name ?? "";
                      const rowKey = `${pb.category_id}-${varKey}`;
                      const isExpanded = expandedRowId === rowKey;

                      const subcategoryBadge = pb.subcategory_name ?? null;
                      const variableBadges = pb.variable_values?.filter(
                        () => !pb.subcategory_name
                      ) ?? [];

                      return (
                        <>
                          <tr
                            key={rowKey}
                            className={className}
                            onClick={() =>
                              setExpandedRowId((prev) =>
                                prev === rowKey ? null : rowKey
                              )
                            }
                            style={{ cursor: "pointer" }}
                          >
                            <td className="rank-cell">{label}</td>
                            <td>
                              <Link
                                href={`/games/${pb.game_slug}/${pb.platform_slug}`}
                                className="runner-link"
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  display: "inline-flex",
                                  gap: "0.4rem",
                                  alignItems: "center",
                                  flexWrap: "wrap",
                                }}
                              >
                                {pb.category_name}
                                {subcategoryBadge && (
                                  <span className="profile-subcategory-badge">
                                    {subcategoryBadge}
                                  </span>
                                )}
                                {variableBadges.map((v) => (
                                  <span key={v.variable_slug} className="profile-subcategory-badge">
                                    {v.value}
                                  </span>
                                ))}
                                {pb.is_coop && (
                                  <span className="profile-coop-badge">Co-op</span>
                                )}
                              </Link>
                            </td>
                            <td className="runner-cell">
                              {pb.is_coop && pb.runners ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                                  {pb.runners.map((r) => (
                                    <Link
                                      key={r.id}
                                      href={`/profile/${r.username}`}
                                      className="runner-link"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {r.country ? (
                                        <span className="runner-country">{countryCodeToFlag(r.country)}</span>
                                      ) : (
                                        <span className="runner-country">🏁</span>
                                      )}
                                      {r.display_name || r.username}
                                    </Link>
                                  ))}
                                </div>
                              ) : (
                                <Link
                                  href={`/profile/${profileUser.username}`}
                                  className="runner-link"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {profileUser.country && (
                                    <span className="runner-country">
                                      {countryCodeToFlag(profileUser.country)}
                                    </span>
                                  )}
                                  {profileUser.display_name || profileUser.username}
                                </Link>
                              )}
                            </td>
                            <td className="date-cell">{pb.platform}</td>
                            <td className="time-cell">
                              {primaryTime || "—"}
                              {secondaryTime && pb.realtime_ms !== pb.gametime_ms && (
                                <span className="time-secondary">
                                  {" "}({secondaryTime} {secondaryLabel})
                                </span>
                              )}
                            </td>
                            <td className="video-cell">
                              {pb.video_url ? (
                                <a
                                  href={pb.video_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="video-link"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  ▶ Watch
                                </a>
                              ) : (
                                <span className="no-video">—</span>
                              )}
                            </td>
                          </tr>

                          {isExpanded && (
                            <tr key={`${rowKey}-comment`} className="run-accordion-row">
                              <td colSpan={colCount} className="run-accordion-cell">
                                <div className="run-accordion-content">
                                  {pb.is_coop && pb.runners && (
                                    <div style={{ marginBottom: "0.5rem" }}>
                                      <span className="run-accordion-label">Runners: </span>
                                      {pb.runners.map((r, i) => (
                                        <span key={r.id}>
                                          <Link
                                            href={`/profile/${r.username}`}
                                            className="runner-link"
                                            style={{ display: "inline" }}
                                          >
                                            {r.display_name || r.username}
                                          </Link>
                                          {i < pb.runners!.length - 1 && ", "}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                  <span className="run-accordion-label">Runner's comment:</span>{" "}
                                  {pb.comment ? pb.comment : <em>No comment provided.</em>}
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}