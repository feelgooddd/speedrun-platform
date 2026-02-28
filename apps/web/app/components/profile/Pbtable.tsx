"use client";
import { useState } from "react";
import Link from "next/link";

interface PersonalBest {
  game_id: string;
  game_name: string;
  game_slug: string;
  category_id: string;
  category_name: string;
  category_slug: string;
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

export default function PBTable({ gameGroups }: { gameGroups: GameGroup[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const colCount = 5;

  if (gameGroups.length === 0) {
    return <p className="leaderboard-empty">No verified runs yet.</p>;
  }

  return (
    <div className="profile-pb-games">
      {gameGroups.map((group) => (
        <div key={group.game_slug} className="profile-pb-game">
          <Link href={`/games/${group.game_slug}`} className="profile-pb-game-title">
            {group.game_name}
          </Link>

          <div className="leaderboard-table-wrap">
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Category</th>
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
                  const isExpanded = expandedId === pb.category_id;

                  return (
                    <>
                      <tr
                        key={pb.category_id}
                        className={className}
                        onClick={() =>
                          setExpandedId((prev) =>
                            prev === pb.category_id ? null : pb.category_id
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
                            style={{ display: "inline-flex" }}
                          >
                            {pb.category_name}
                          </Link>
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
                        <tr key={`${pb.category_id}-comment`} className="run-accordion-row">
                          <td colSpan={colCount} className="run-accordion-cell">
                            <div className="run-accordion-content">
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
        </div>
      ))}
    </div>
  );
}