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
  order: number;
  values: VariableValue[];
}

interface LevelCategory {
  id: string;
  name: string;
  slug: string;
  variables?: Variable[];
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

function serializeFilters(filters: Record<string, string>): string {
  return Object.entries(filters)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v}`)
    .join("|");
}

function buildDefaultFilters(variables: Variable[]): Record<string, string> {
  const filters: Record<string, string> = {};
  for (const v of variables) {
    if (v.values[0]) filters[v.slug] = v.values[0].slug;
  }
  return filters;
}

function computeHiddenVariableIds(
  variables: Variable[],
  currentFilters: Record<string, string>,
): Set<string> {
  const hidden = new Set<string>();
  for (const variable of variables) {
    const activeSlug = currentFilters[variable.slug];
    if (!activeSlug) continue;
    const activeValue = variable.values.find((v) => v.slug === activeSlug);
    if (!activeValue?.hidden_variables) continue;
    for (const h of activeValue.hidden_variables) {
      hidden.add(h.variable_id);
    }
  }
  return hidden;
}

export default function ILLeaderboard({ gameSlug, platformSlug }: ILLeaderboardProps) {
  const [levels, setLevels] = useState<Level[]>([]);
  const [loadingLevels, setLoadingLevels] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeLevel, setActiveLevel] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  const [runsCache, setRunsCache] = useState<Record<string, { runs: Run[]; total: number; timingMethod: string }>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [timingMethod, setTimingMethod] = useState<string>("realtime");
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

        if (fetchedLevels.length > 0) {
          const allCategories = getUniqueCategories(fetchedLevels);
          if (allCategories.length > 0) {
            setActiveCategory(allCategories[0].slug);
          }
          setActiveLevel(fetchedLevels[0].slug);
        }
      } catch (e) {
        console.error("Failed to fetch levels:", e);
      } finally {
        setLoadingLevels(false);
      }
    };
    fetchLevels();
  }, [gameSlug, platformSlug]);

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

  const availableLevels = levels.filter((l) =>
    l.level_categories.some((c) => c.slug === activeCategory)
  );

  // Get the active level category's variables
  const activeLevelCategory = levels
    .find((l) => l.slug === activeLevel)
    ?.level_categories.find((c) => c.slug === activeCategory);

  const variables = activeLevelCategory?.variables ?? [];
  const subcategoryVar = variables.find((v) => v.is_subcategory);
  const filterVars = variables.filter((v) => !v.is_subcategory).sort((a, b) => a.order - b.order);
  const hasVariables = variables.length > 0;

  const currentFilters: Record<string, string> = hasVariables
    ? { ...buildDefaultFilters(variables), ...activeFilters }
    : {};

  const hiddenVariableIds = hasVariables
    ? computeHiddenVariableIds(variables, currentFilters)
    : new Set<string>();

  const visibleFilterVars = filterVars.filter((v) => !hiddenVariableIds.has(v.id));

  const cacheKey = `${activeLevel}-${activeCategory}-${serializeFilters(currentFilters)}`;

  // Fetch runs when level/category/filters change
  useEffect(() => {
    if (!activeCategory || !activeLevel) return;
    if (runsCache[cacheKey]) {
      setTimingMethod(runsCache[cacheKey].timingMethod);
      return;
    }

    const fetchRuns = async () => {
      setLoading((prev) => ({ ...prev, [cacheKey]: true }));
      try {
        const params = new URLSearchParams({ page: "1", limit: "25" });
        if (hasVariables) {
          for (const [k, v] of Object.entries(currentFilters)) params.set(k, v);
        }
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/games/${gameSlug}/${platformSlug}/levels/${activeCategory}?${params}`
        );
        const data = await res.json();
        const levelData = data.levels?.find((l: any) => l.level_slug === activeLevel);
        const fetchedRuns = levelData?.runs ?? [];
        const fetchedTotal = levelData?.total ?? 0;
        const fetchedTiming = data.timing_method ?? "realtime";
        setTimingMethod(fetchedTiming);
        setRunsCache((prev) => ({
          ...prev,
          [cacheKey]: { runs: fetchedRuns, total: fetchedTotal, timingMethod: fetchedTiming },
        }));
      } catch (e) {
        console.error("Failed to fetch IL runs:", e);
      } finally {
        setLoading((prev) => ({ ...prev, [cacheKey]: false }));
      }
    };
    fetchRuns();
  }, [activeCategory, activeLevel, cacheKey]);

  const handleFilterClick = (varSlug: string, valueSlug: string) => {
    setActiveFilters((prev) => ({ ...prev, [varSlug]: valueSlug }));
  };

  const handleCategoryChange = (catSlug: string) => {
    setActiveCategory(catSlug);
    setActiveFilters({});
    const firstAvailable = levels.find((l) =>
      l.level_categories.some((c) => c.slug === catSlug)
    );
    if (firstAvailable) setActiveLevel(firstAvailable.slug);
  };

  const handleLevelChange = (levelSlug: string) => {
    setActiveLevel(levelSlug);
    setActiveFilters({});
  };

  const runs = runsCache[cacheKey]?.runs ?? [];
  const total = runsCache[cacheKey]?.total ?? 0;
  const isLoading = loading[cacheKey];

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
            onClick={() => handleCategoryChange(cat.slug)}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Subcategory variable subtabs */}
      {subcategoryVar && !hiddenVariableIds.has(subcategoryVar.id) && (
        <div className="leaderboard-subtabs">
          {subcategoryVar.values.map((val) => {
            const isActive = (currentFilters[subcategoryVar.slug] ?? subcategoryVar.values[0]?.slug) === val.slug;
            return (
              <button
                key={val.id}
                className={`leaderboard-subtab ${isActive ? "active" : ""}`}
                onClick={() => handleFilterClick(subcategoryVar.slug, val.slug)}
              >
                {val.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Filter variable rows */}
      {visibleFilterVars.map((filterVar) => (
        <div key={filterVar.id} className="leaderboard-filter-row">
          <span className="leaderboard-filter-label">{filterVar.name}:</span>
          {filterVar.values.map((val) => {
            const isActive = (currentFilters[filterVar.slug] ?? filterVar.values[0]?.slug) === val.slug;
            return (
              <button
                key={val.id}
                className={`leaderboard-filter-btn ${isActive ? "active" : ""}`}
                onClick={() => handleFilterClick(filterVar.slug, val.slug)}
              >
                {val.name}
              </button>
            );
          })}
        </div>
      ))}

      {/* Level dropdown */}
      <div style={{ padding: "1rem 0" }}>
        <select
          className="auth-input"
          style={{ maxWidth: "300px" }}
          value={activeLevel ?? ""}
          onChange={(e) => handleLevelChange(e.target.value)}
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
        {isLoading ? (
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