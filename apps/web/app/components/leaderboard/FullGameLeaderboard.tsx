"use client";
import { useState } from "react";
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
  primary_time_ms?: number | null;
  primary_time_display?: string | null;
  timing_method?: string;
  video_url: string;
  submitted_at: string;
  score_value?: number | null;
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
  order: number;
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
  scoring_type?: string | null;
  variableRuns?: Record<string, { runs: Run[]; total: number }>;
}

interface FullGameLeaderboardProps {
  categories: Category[];
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

// Given the current active filters, compute which variable IDs should be hidden
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

export default function FullGameLeaderboard({
  categories: initialCategories,
  gameSlug,
  platformSlug,
}: FullGameLeaderboardProps) {
  const [activeCategory, setActiveCategory] = useState(
    initialCategories[0]?.slug ?? "",
  );
  const [activeSubcategory, setActiveSubcategory] = useState<
    Record<string, string>
  >({});
  const [activeFilters, setActiveFilters] = useState<
    Record<string, Record<string, string>>
  >({});
  const [categories, setCategories] = useState(initialCategories);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  const { user: authUser } = useAuth();

  const category = categories.find((c) => c.slug === activeCategory);

  const scoringType = category?.scoring_type ?? null;
  const isScored = scoringType !== null;

  const hasVariables = !!category?.variables && category.variables.length > 0;
  const hasSubcategories =
    !!category?.subcategories && category.subcategories.length > 0;
  const isVariableCategory = hasVariables && !hasSubcategories;

  const subcategoryVar = category?.variables?.find((v) => v.is_subcategory);
  const filterVars =
    category?.variables
      ?.filter((v) => !v.is_subcategory)
      .sort((a, b) => a.order - b.order) ?? [];

  const currentFilters: Record<string, string> =
    isVariableCategory && category?.variables
      ? {
          ...buildDefaultFilters(category.variables),
          ...(activeFilters[activeCategory] ?? {}),
        }
      : {};

  // Compute which variable IDs are hidden given current selections
  const hiddenVariableIds =
    isVariableCategory && category?.variables
      ? computeHiddenVariableIds(category.variables, currentFilters)
      : new Set<string>();

  // Filter out hidden variables from filter rows
  const visibleFilterVars = filterVars.filter(
    (v) => !hiddenVariableIds.has(v.id),
  );

  const currentCacheKey = isVariableCategory
    ? serializeFilters(currentFilters)
    : "";

  const currentSubcategorySlug =
    !isVariableCategory && hasSubcategories
      ? activeSubcategory[activeCategory] || category!.subcategories![0].slug
      : null;

  let runs: Run[] = [];
  let total = 0;

  if (isVariableCategory) {
    const varData = category?.variableRuns?.[currentCacheKey];
    runs = varData?.runs ?? [];
    total = varData?.total ?? 0;
  } else if (currentSubcategorySlug && category?.subcategories) {
    const sub = category.subcategories.find(
      (s) => s.slug === currentSubcategorySlug,
    );
    runs = sub?.runs ?? [];
    total = sub?.total ?? runs.length;
  } else {
    runs = category?.runs ?? [];
    total = category?.total ?? runs.length;
  }

  const showSeparateTimes =
    runs.some(
      (run) =>
        run.realtime_ms &&
        run.gametime_ms &&
        run.realtime_ms !== run.gametime_ms,
    ) ?? false;

  const hasSystemColumn = categories.some((cat) => {
    if (cat.runs?.some((r) => r.system)) return true;
    if (cat.subcategories?.some((sub) => sub.runs?.some((r) => r.system)))
      return true;
    if (cat.variableRuns) {
      return Object.values(cat.variableRuns).some((vr) =>
        vr.runs.some((r) => r.system),
      );
    }
    return false;
  });

  const colCount =
    (showSeparateTimes ? 6 : 5) +
    (hasSystemColumn ? 1 : 0) +
    (isScored ? 1 : 0);
  const handleRowClick = (runId: string) => {
    setExpandedRunId((prev) => (prev === runId ? null : runId));
  };

  const fetchVariableRuns = async (
    catSlug: string,
    filters: Record<string, string>,
    page = 1,
  ) => {
    const params = new URLSearchParams({ page: String(page), limit: "25" });
    for (const [k, v] of Object.entries(filters)) params.set(k, v);
    const url = `${process.env.NEXT_PUBLIC_API_URL}/games/${gameSlug}/${platformSlug}/${catSlug}?${params}`;
    const res = await fetch(url);
    const data = await res.json();
    return { runs: data.runs ?? [], total: data.total ?? 0 };
  };

  const handleVariableFilterClick = async (
    varSlug: string,
    valueSlug: string,
  ) => {
    const newFilters = {
      ...buildDefaultFilters(category?.variables ?? []),
      ...(activeFilters[activeCategory] ?? {}),
      [varSlug]: valueSlug,
    };

    setActiveFilters((prev) => ({
      ...prev,
      [activeCategory]: {
        ...(prev[activeCategory] ?? {}),
        [varSlug]: valueSlug,
      },
    }));

    const cacheKey = serializeFilters(newFilters);
    if (category?.variableRuns?.[cacheKey]) return;

    const loadKey = `${activeCategory}-${cacheKey}`;
    setLoading((prev) => ({ ...prev, [loadKey]: true }));
    try {
      const result = await fetchVariableRuns(activeCategory, newFilters);
      setCategories((prev) =>
        prev.map((cat) => {
          if (cat.slug !== activeCategory) return cat;
          return {
            ...cat,
            variableRuns: { ...cat.variableRuns, [cacheKey]: result },
          };
        }),
      );
    } catch (e) {
      console.error("Failed to load variable runs:", e);
    } finally {
      setLoading((prev) => ({ ...prev, [loadKey]: false }));
    }
  };

  const handleShowMore = async () => {
    if (!category) return;

    if (isVariableCategory) {
      const currentRuns = category.variableRuns?.[currentCacheKey]?.runs ?? [];
      const nextPage = Math.ceil(currentRuns.length / 25) + 1;
      const loadKey = `${activeCategory}-${currentCacheKey}`;
      setLoading((prev) => ({ ...prev, [loadKey]: true }));
      try {
        const result = await fetchVariableRuns(
          activeCategory,
          currentFilters,
          nextPage,
        );
        if (result.runs.length > 0) {
          setCategories((prev) =>
            prev.map((cat) => {
              if (cat.slug !== activeCategory) return cat;
              return {
                ...cat,
                variableRuns: {
                  ...cat.variableRuns,
                  [currentCacheKey]: {
                    runs: [...currentRuns, ...result.runs],
                    total: result.total,
                  },
                },
              };
            }),
          );
        }
      } catch (e) {
        console.error("Failed to load more runs:", e);
      } finally {
        setLoading((prev) => ({ ...prev, [loadKey]: false }));
      }
      return;
    }

    const nextPage = Math.ceil(runs.length / 25) + 1;
    const loadKey = currentSubcategorySlug
      ? `${activeCategory}-${currentSubcategorySlug}`
      : activeCategory;

    setLoading((prev) => ({ ...prev, [loadKey]: true }));
    try {
      const url = currentSubcategorySlug
        ? `${process.env.NEXT_PUBLIC_API_URL}/games/${gameSlug}/${platformSlug}/${activeCategory}/${currentSubcategorySlug}?page=${nextPage}&limit=25`
        : `${process.env.NEXT_PUBLIC_API_URL}/games/${gameSlug}/${platformSlug}/${activeCategory}?page=${nextPage}&limit=25`;

      const res = await fetch(url);
      const data = await res.json();

      if (data.runs?.length > 0) {
        setCategories((prev) =>
          prev.map((cat) => {
            if (cat.slug !== activeCategory) return cat;
            if (currentSubcategorySlug && cat.subcategories) {
              return {
                ...cat,
                subcategories: cat.subcategories.map((sub) => {
                  if (sub.slug !== currentSubcategorySlug) return sub;
                  return {
                    ...sub,
                    runs: [...sub.runs, ...data.runs],
                    total: data.total,
                  };
                }),
              };
            }
            return {
              ...cat,
              runs: [...(cat.runs || []), ...data.runs],
              total: data.total,
            };
          }),
        );
      }
    } catch (e) {
      console.error("Failed to load more runs:", e);
    } finally {
      setLoading((prev) => ({ ...prev, [loadKey]: false }));
    }
  };

  const hasMore = total > runs.length;
  const loadingKey = isVariableCategory
    ? `${activeCategory}-${currentCacheKey}`
    : currentSubcategorySlug
      ? `${activeCategory}-${currentSubcategorySlug}`
      : activeCategory;
  const isLoading = loading[loadingKey];

  return (
    <div className="leaderboard">
      {/* Category Tabs */}
      <div className="leaderboard-tabs">
        {categories.map((cat) => (
          <button
            key={cat.id}
            className={`leaderboard-tab ${activeCategory === cat.slug ? "active" : ""}`}
            onClick={() => setActiveCategory(cat.slug)}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Subcategory variable subtabs (is_subcategory: true) */}
      {isVariableCategory &&
        subcategoryVar &&
        !hiddenVariableIds.has(subcategoryVar.id) && (
          <div className="leaderboard-subtabs">
            {subcategoryVar.values.map((val) => {
              const isActive =
                (currentFilters[subcategoryVar.slug] ??
                  subcategoryVar.values[0]?.slug) === val.slug;
              return (
                <button
                  key={val.id}
                  className={`leaderboard-subtab ${isActive ? "active" : ""}`}
                  onClick={() =>
                    handleVariableFilterClick(subcategoryVar.slug, val.slug)
                  }
                >
                  {val.name}
                </button>
              );
            })}
          </div>
        )}

      {/* Filter variable rows — only visible ones */}
      {isVariableCategory &&
        visibleFilterVars.map((filterVar) => (
          <div key={filterVar.id} className="leaderboard-filter-row">
            <span className="leaderboard-filter-label">{filterVar.name}:</span>
            {filterVar.values.map((val) => {
              const isActive =
                (currentFilters[filterVar.slug] ??
                  filterVar.values[0]?.slug) === val.slug;
              return (
                <button
                  key={val.id}
                  className={`leaderboard-filter-btn ${isActive ? "active" : ""}`}
                  onClick={() =>
                    handleVariableFilterClick(filterVar.slug, val.slug)
                  }
                >
                  {val.name}
                </button>
              );
            })}
          </div>
        ))}

      {/* Legacy subcategory subtabs */}
      {!isVariableCategory && hasSubcategories && (
        <div className="leaderboard-subtabs">
          {category!.subcategories!.map((sub) => (
            <button
              key={sub.id}
              className={`leaderboard-subtab ${currentSubcategorySlug === sub.slug ? "active" : ""}`}
              onClick={() =>
                setActiveSubcategory((prev) => ({
                  ...prev,
                  [activeCategory]: sub.slug,
                }))
              }
            >
              {sub.name}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="leaderboard-table-wrap">
        {runs.length === 0 ? (
          <p className="leaderboard-empty">
            {isLoading ? "Loading..." : "No runs submitted yet."}
          </p>
        ) : (
          <>
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Runner</th>
                  {isScored && (
                    <th>{scoringType === "lowcast" ? "Casts" : "Score"}</th>
                  )}
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
                          run.rank === 1
                            ? "rank-1"
                            : run.rank === 2
                              ? "rank-2"
                              : run.rank === 3
                                ? "rank-3"
                                : ""
                        }
                        onClick={() => handleRowClick(run.id)}
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
                                    <span className="runner-separator">
                                      {" "}
                                      &{" "}
                                    </span>
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
                        {isScored && (
                          <td className="time-cell">
                            {run.score_value ?? "—"}
                            {run.realtime_display && (
                              <span className="time-secondary">
                                {" "}
                                ({run.realtime_display})
                              </span>
                            )}
                          </td>
                        )}
                        {showSeparateTimes ? (
                          <>
                            <td className="time-cell">
                              {run.gametime_display || "—"}
                            </td>
                            <td className="time-cell secondary">
                              {run.realtime_display || "—"}
                            </td>
                          </>
                        ) : (
                          <td className="time-cell">
                            {run.timing_method === "gametime"
                              ? run.gametime_display || "—"
                              : run.realtime_display || "—"}
                            {run.timing_method === "realtime" &&
                              run.gametime_display &&
                              run.gametime_ms !== run.realtime_ms && (
                                <span className="time-secondary">
                                  {" "}
                                  ({run.gametime_display} IGT)
                                </span>
                              )}
                            {run.timing_method === "gametime" &&
                              run.realtime_display &&
                              run.gametime_ms !== run.realtime_ms && (
                                <span className="time-secondary">
                                  {" "}
                                  ({run.realtime_display} RTA)
                                </span>
                              )}
                          </td>
                        )}
                        {hasSystemColumn && (
                          <td className="system-cell">
                            {run.system ? (
                              <span className="run-system-badge">
                                {run.system}
                              </span>
                            ) : (
                              "—"
                            )}
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
                              style={{
                                marginLeft: "0.75rem",
                                opacity: 0.6,
                                fontSize: "0.8rem",
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              Edit
                            </Link>
                          )}
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr
                          key={`${run.id}-comment`}
                          className="run-accordion-row"
                        >
                          <td colSpan={colCount} className="run-accordion-cell">
                            <div className="run-accordion-content">
                              <span className="run-accordion-label">
                                Runner's comment:
                              </span>{" "}
                              {run.comment ? (
                                run.comment
                              ) : (
                                <em>No comment provided.</em>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>

            {hasMore && (
              <div style={{ textAlign: "center", marginTop: "2rem" }}>
                <button
                  className="btn btn-primary"
                  onClick={handleShowMore}
                  disabled={isLoading}
                >
                  {isLoading ? "Loading..." : "Show More Runs"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
