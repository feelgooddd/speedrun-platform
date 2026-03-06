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

  // Solo
  user?: {
    id: string;
    username: string;
    display_name: string | null;
    country: string | null;
  };

  // Co-op
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

interface Category {
  id: string;
  name: string;
  slug: string;
  subcategories?: Subcategory[];
  runs?: Run[];
  total?: number;
}

interface LeaderboardTabsProps {
  categories: Category[];
  gameSlug: string;
  platformSlug: string;
}

export default function LeaderboardTabs({
  categories: initialCategories,
  gameSlug,
  platformSlug,
}: LeaderboardTabsProps) {
  const [activeCategory, setActiveCategory] = useState(
    initialCategories[0]?.slug ?? "",
  );
  const [activeSubcategory, setActiveSubcategory] = useState<
    Record<string, string>
  >({});
  const [categories, setCategories] = useState(initialCategories);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  const { user: authUser } = useAuth();

  const category = categories.find((c) => c.slug === activeCategory);

  const currentSubcategorySlug = category?.subcategories?.length
    ? activeSubcategory[activeCategory] || category.subcategories[0].slug
    : null;

  const activeData =
    currentSubcategorySlug && category?.subcategories
      ? category.subcategories.find((s) => s.slug === currentSubcategorySlug)
      : category;

  const runs = activeData?.runs || [];
  const total = activeData?.total || runs.length;

  const showSeparateTimes =
    runs.some(
      (run) =>
        run.realtime_ms &&
        run.gametime_ms &&
        run.realtime_ms !== run.gametime_ms,
    ) ?? false;

  // Total number of <th> columns so the accordion row can span all of them
  const hasSystemColumn = categories.some((cat) => {
    if (cat.runs?.some((r) => r.system)) return true;
    if (cat.subcategories?.some((sub) => sub.runs?.some((r) => r.system)))
      return true;
    return false;
  });

  const colCount = (showSeparateTimes ? 6 : 5) + (hasSystemColumn ? 1 : 0);

  const handleRowClick = (runId: string) => {
    setExpandedRunId((prev) => (prev === runId ? null : runId));
  };

  const handleShowMore = async () => {
    if (!category || !activeData) return;

    const currentPage = Math.ceil(runs.length / 25);
    const nextPage = currentPage + 1;

    const key = currentSubcategorySlug
      ? `${activeCategory}-${currentSubcategorySlug}`
      : activeCategory;

    setLoading((prev) => ({ ...prev, [key]: true }));

    try {
      const url = currentSubcategorySlug
        ? `${process.env.NEXT_PUBLIC_API_URL}/games/${gameSlug}/${platformSlug}/${activeCategory}/${currentSubcategorySlug}?page=${nextPage}&limit=25`
        : `${process.env.NEXT_PUBLIC_API_URL}/games/${gameSlug}/${platformSlug}/${activeCategory}?page=${nextPage}&limit=25`;

      const res = await fetch(url);
      const data = await res.json();

      if (data.runs && data.runs.length > 0) {
        setCategories((prev) =>
          prev.map((cat) => {
            if (cat.slug === activeCategory) {
              if (currentSubcategorySlug && cat.subcategories) {
                return {
                  ...cat,
                  subcategories: cat.subcategories.map((sub) => {
                    if (sub.slug === currentSubcategorySlug) {
                      return {
                        ...sub,
                        runs: [...sub.runs, ...data.runs],
                        total: data.total,
                      };
                    }
                    return sub;
                  }),
                };
              } else {
                return {
                  ...cat,
                  runs: [...(cat.runs || []), ...data.runs],
                  total: data.total,
                };
              }
            }
            return cat;
          }),
        );
      }
    } catch (error) {
      console.error("Failed to load more runs:", error);
    } finally {
      setLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const hasMore = total > runs.length;
  const key = currentSubcategorySlug
    ? `${activeCategory}-${currentSubcategorySlug}`
    : activeCategory;
  const isLoading = loading[key];

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

      {/* Subcategory Tabs */}
      {category?.subcategories && category.subcategories.length > 0 && (
        <div className="leaderboard-subtabs">
          {category.subcategories.map((sub) => (
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
      {activeData && (
        <div className="leaderboard-table-wrap">
          {runs.length === 0 ? (
            <p className="leaderboard-empty">No runs submitted yet.</p>
          ) : (
            <>
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
                                      ): (
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

                        {/* Accordion row */}
                        {isExpanded && (
                          <tr
                            key={`${run.id}-comment`}
                            className="run-accordion-row"
                          >
                            <td
                              colSpan={colCount}
                              className="run-accordion-cell"
                            >
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
      )}
    </div>
  );
}
