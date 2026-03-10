"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "../auth/AuthContext";
import { countryCodeToFlag } from "@/app/lib/flags";

interface Run {
  rank: number;
  id: string;
  comment: string | null;
  system: string | null;
  realtime_ms: number | null;
  gametime_ms: number | null;
  realtime_display: string | null;
  gametime_display: string | null;
  video_url: string;
  submitted_at: string;
  user?: {
    id: string;
    username: string;
    display_name: string | null;
    country: string | null;
  };
  runners?: {
    id: string;
    username: string;
    display_name: string | null;
    country: string | null;
  }[];
}

interface LevelCategory {
  id: string;
  name: string;
  slug: string;
}

interface Level {
  id: string;
  name: string;
  slug: string;
  order: number;
  level_categories: LevelCategory[];
}

interface ILLeaderboardProps {
  gameSlug: string;
  platformSlug: string;
}

export default function ILLeaderboard({ gameSlug, platformSlug }: ILLeaderboardProps) {
  const [levels, setLevels] = useState<Level[]>([]);
  const [loadingLevels, setLoadingLevels] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeLevel, setActiveLevel] = useState<string | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [total, setTotal] = useState(0);
  const [timingMethod, setTimingMethod] = useState<string>("realtime");
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  const { user: authUser } = useAuth();

  // Fetch levels on mount
  useEffect(() => {
    const fetchLevels = async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/games/${gameSlug}/${platformSlug}/levels`
        );
        const data = await res.json();
        const fetchedLevels: Level[] = data.levels ?? [];
        setLevels(fetchedLevels);

        // Default to first level category and first level
        if (fetchedLevels.length > 0) {
          const firstLevel = fetchedLevels[0];
          const allCategories = getUniqueCategories(fetchedLevels);
          if (allCategories.length > 0) {
            setActiveCategory(allCategories[0].slug);
          }
          setActiveLevel(firstLevel.slug);
        }
      } catch (e) {
        console.error("Failed to fetch levels:", e);
      } finally {
        setLoadingLevels(false);
      }
    };
    fetchLevels();
  }, [gameSlug, platformSlug]);

  // Fetch runs when active category or level changes
  useEffect(() => {
    if (!activeCategory || !activeLevel) return;
    const fetchRuns = async () => {
      setLoadingRuns(true);
      setRuns([]);
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/games/${gameSlug}/${platformSlug}/levels/${activeCategory}`
        );
        const data = await res.json();

        // Find the runs for the selected level only
        const levelData = data.levels?.find((l: any) => l.level_slug === activeLevel);
        setRuns(levelData?.runs ?? []);
        setTotal(levelData?.total ?? 0);
        setTimingMethod(data.timing_method ?? "realtime");
      } catch (e) {
        console.error("Failed to fetch IL runs:", e);
      } finally {
        setLoadingRuns(false);
      }
    };
    fetchRuns();
  }, [activeCategory, activeLevel, gameSlug, platformSlug]);

  // Get unique categories across all levels
  const getUniqueCategories = (lvls: Level[]): LevelCategory[] => {
    const seen = new Set<string>();
    const result: LevelCategory[] = [];
    for (const level of lvls) {
      for (const cat of level.level_categories) {
        if (!seen.has(cat.slug)) {
          seen.add(cat.slug);
          result.push(cat);
        }
      }
    }
    return result;
  };

  const uniqueCategories = getUniqueCategories(levels);

  // Only show levels that have the active category
  const availableLevels = levels.filter((l) =>
    l.level_categories.some((c) => c.slug === activeCategory)
  );

  const showSeparateTimes = runs.some(
    (run) => run.realtime_ms && run.gametime_ms && run.realtime_ms !== run.gametime_ms
  );
  const hasSystemColumn = runs.some((r) => r.system);
  const colCount = (showSeparateTimes ? 6 : 5) + (hasSystemColumn ? 1 : 0);

  if (loadingLevels) {
    return <p className="leaderboard-empty">Loading...</p>;
  }

  if (levels.length === 0) {
    return <p className="leaderboard-empty">No individual levels available.</p>;
  }

  return (
    <div className="leaderboard">
      {/* Category tabs */}
      <div className="leaderboard-tabs">
        {uniqueCategories.map((cat) => (
          <button
            key={cat.id}
            className={`leaderboard-tab ${activeCategory === cat.slug ? "active" : ""}`}
            onClick={() => {
              setActiveCategory(cat.slug);
              // Reset to first level that has this category
              const firstAvailable = levels.find((l) =>
                l.level_categories.some((c) => c.slug === cat.slug)
              );
              if (firstAvailable) setActiveLevel(firstAvailable.slug);
            }}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Level dropdown */}
      <div style={{ padding: "1rem 0" }}>
        <select
          className="auth-input"
          style={{ maxWidth: "300px" }}
          value={activeLevel ?? ""}
          onChange={(e) => setActiveLevel(e.target.value)}
        >
          {availableLevels.map((level) => (
            <option key={level.id} value={level.slug}>
              {level.name}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="leaderboard-table-wrap">
        {loadingRuns ? (
          <p className="leaderboard-empty">Loading...</p>
        ) : runs.length === 0 ? (
          <p className="leaderboard-empty">No runs submitted yet.</p>
        ) : (
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Runner</th>
                {showSeparateTimes ? (
                  <>
                    <th>Time (IGT)</th>
                    <th>RTA</th>
                  </>
                ) : (
                  <th>Time</th>
                )}
                {hasSystemColumn && <th>System</th>}
                <th>Date</th>
                <th>Video</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => {
                const isExpanded = expandedRunId === run.id;
                return (
                  <>
                    <tr
                      key={run.id}
                      className={
                        run.rank === 1 ? "rank-1" : run.rank === 2 ? "rank-2" : run.rank === 3 ? "rank-3" : ""
                      }
                      onClick={() => setExpandedRunId((prev) => (prev === run.id ? null : run.id))}
                      style={{ cursor: "pointer" }}
                    >
                      <td className="rank-cell">#{run.rank}</td>
                      <td className="runner-cell">
                        {run.runners ? (
                          <div className="runner-link-group flex flex-col">
                            {run.runners.map((runner, i) => (
                              <span key={runner.id}>
                                <Link
                                  href={`/profile/${runner.username}`}
                                  className="runner-link"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {runner.country ? (
                                    <span className="runner-country">
                                      {countryCodeToFlag(runner.country)}
                                    </span>
                                  ) : (
                                    <span>🏁</span>
                                  )}
                                  {runner.display_name}
                                </Link>
                                {i < run.runners!.length - 1 && (
                                  <span className="runner-separator"> & </span>
                                )}
                              </span>
                            ))}
                          </div>
                        ) : run.user ? (
                          <Link
                            href={`/profile/${run.user.username}`}
                            className="runner-link"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {run.user.country && (
                              <span className="runner-country">
                                {countryCodeToFlag(run.user.country)}
                              </span>
                            )}
                            {run.user.display_name}
                          </Link>
                        ) : null}
                      </td>
                      {showSeparateTimes ? (
                        <>
                          <td className="time-cell">{run.gametime_display || "—"}</td>
                          <td className="time-cell secondary">{run.realtime_display || "—"}</td>
                        </>
                      ) : (
                        <td className="time-cell">
{timingMethod === "gametime"
  ? run.gametime_display || run.realtime_display || "—"
  : run.realtime_display || run.gametime_display || "—"}
                        </td>
                      )}
                      {hasSystemColumn && (
                        <td className="system-cell">
                          {run.system ? (
                            <span className="run-system-badge">{run.system}</span>
                          ) : "—"}
                        </td>
                      )}
                      <td className="date-cell">
                        {new Date(run.submitted_at).toLocaleDateString()}
                      </td>
                      <td className="video-cell">
                        {run.video_url ? (
                          <a
                            href={run.video_url}
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
                        {authUser?.role === "admin" && (
                          <Link
                            href={`/admin/runs/${run.id}`}
                            className="video-link"
                            style={{ marginLeft: "0.75rem", opacity: 0.6, fontSize: "0.8rem" }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            Edit
                          </Link>
                        )}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${run.id}-comment`} className="run-accordion-row">
                        <td colSpan={colCount} className="run-accordion-cell">
                          <div className="run-accordion-content">
                            <span className="run-accordion-label">Runner's comment:</span>{" "}
                            {run.comment ? run.comment : <em>No comment provided.</em>}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}