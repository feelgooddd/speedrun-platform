"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { countryCodeToFlag } from "@/app/lib/flags";
import { PendingRun } from "@/app/lib/types/moderation";
import { useModQueue } from "@/app/lib/hooks/useModQueue";

export default function ModQueuePage({
  params,
}: {
  params: Promise<{ gameSlug: string }>;
}) {
  const [slug, setSlug] = useState<string>("");
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>(
    {},
  );
  const [showRejectInput, setShowRejectInput] = useState<
    Record<string, boolean>
  >({});

  // Unwrap params
  useEffect(() => {
    params.then((p) => setSlug(p.gameSlug));
  }, [params]);

  // Our new logic "Brain"
  const { queue, gameName, loading, error, processing, verifyRun, setError } =
    useModQueue(slug);

  const handleAction = async (runId: string, approve: boolean) => {
    const success = await verifyRun(runId, approve, rejectReasons[runId]);
    if (success) {
      // Clear local UI states for this specific row
      setRejectReasons((prev) => {
        const u = { ...prev };
        delete u[runId];
        return u;
      });
      setShowRejectInput((prev) => {
        const u = { ...prev };
        delete u[runId];
        return u;
      });
      if (expandedRunId === runId) setExpandedRunId(null);
    }
  };

  if (loading) {
    return (
      <div className="landing">
        <div
          className="section"
          style={{ paddingTop: "6rem", textAlign: "center" }}
        >
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  const renderRunsTable = (
    runs: PendingRun[],
    title: string,
    isPending: boolean,
    isIL: boolean = false,
  ) => {
    const colCount = isIL ? 9 : 8;
    return (
      <>
        <h2
          style={{
            color: "var(--text)",
            marginTop: "3rem",
            marginBottom: "1rem",
            fontSize: "1.5rem",
          }}
        >
          {title} ({runs.length})
        </h2>
        {runs.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "2rem",
              color: "var(--text-secondary)",
            }}
          >
            No {isPending ? "pending" : "rejected"} runs
          </div>
        ) : (
          <div className="leaderboard-table-wrap">
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th>Runner</th>
                  <th>Category</th>
                  {isIL && <th>Level</th>}
                  <th>Variables</th> {/* 👈 add this */}
                  <th>Platform</th>
                  <th>RTA</th>
                  <th>IGT</th>
                  <th>Video</th>
                  <th>System</th>
                  {!isPending && <th>Reason</th>}
                  {isPending && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => {
                  const isExpanded = expandedRunId === run.id;
                  return (
                    <>
                      <tr
                        key={run.id}
                        onClick={() =>
                          setExpandedRunId(isExpanded ? null : run.id)
                        }
                        style={{ cursor: "pointer" }}
                      >
                        <td className="runner-cell">
                          {/* Runner rendering logic... (kept same for styles) */}
                          {run.is_coop && run.runners ? (
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "0.25rem",
                              }}
                            >
                              {run.runners.map((r) => (
                                <Link
                                  key={r.id}
                                  href={`/profile/${r.username}`}
                                  className="runner-link"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {r.country && (
                                    <span className="runner-country">
                                      {countryCodeToFlag(r.country)}
                                    </span>
                                  )}
                                  {r.display_name || r.username}
                                </Link>
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
                              {run.user.display_name || run.user.username}
                            </Link>
                          ) : null}
                        </td>
                        <td>{run.category}</td>
                        {isIL && <td>{run.level ?? "—"}</td>}
                        <td>
                          {run.variable_values?.length > 0 ? (
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "0.25rem",
                              }}
                            >
                              {run.variable_values.map((v) => (
                                <span
                                  key={v.variable_slug}
                                  style={{
                                    fontSize: "0.85rem",
                                    color: "var(--text-secondary)",
                                  }}
                                >
                                  <span style={{ color: "var(--text)" }}>
                                    {v.variable}:
                                  </span>{" "}
                                  {v.value}
                                </span>
                              ))}
                            </div>
                          ) : (
                            "—"
                          )}
                        </td>
                        {isIL && <td>{run.level ?? "—"}</td>}
                        <td>{run.platform}</td>
                        <td className="time-cell">
                          {run.realtime_display || "—"}
                        </td>
                        <td className="time-cell">
                          {run.gametime_display || run.realtime_display || "—"}
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
                        </td>
                        <td className="system-cell">
                          {run.system ? (
                            <span className="run-system-badge">
                              {run.system}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        {!isPending && (
                          <td
                            style={{
                              color: "var(--text-secondary)",
                              fontSize: "0.9rem",
                            }}
                          >
                            {run.reject_reason || "No reason provided"}
                          </td>
                        )}
                        {isPending && (
                          <td onClick={(e) => e.stopPropagation()}>
                            {showRejectInput[run.id] ? (
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "0.5rem",
                                  minWidth: "200px",
                                }}
                              >
                                <input
                                  type="text"
                                  placeholder="Rejection reason..."
                                  value={rejectReasons[run.id] || ""}
                                  onChange={(e) =>
                                    setRejectReasons((prev) => ({
                                      ...prev,
                                      [run.id]: e.target.value,
                                    }))
                                  }
                                  style={{
                                    padding: "0.5rem",
                                    background: "rgba(255, 255, 255, 0.05)",
                                    border: "1px solid rgba(255, 215, 0, 0.2)",
                                    borderRadius: "4px",
                                    color: "var(--text)",
                                    fontSize: "0.9rem",
                                  }}
                                />
                                <div style={{ display: "flex", gap: "0.5rem" }}>
                                  <button
                                    className="btn"
                                    onClick={() => handleAction(run.id, false)}
                                    disabled={processing[run.id]}
                                    style={{
                                      background: "rgba(255, 0, 0, 0.1)",
                                      border: "1px solid rgba(255, 0, 0, 0.3)",
                                      color: "#ff4444",
                                      padding: "0.5rem 1rem",
                                      fontSize: "0.8rem",
                                      flex: 1,
                                    }}
                                  >
                                    {processing[run.id] ? "..." : "Confirm"}
                                  </button>
                                  <button
                                    className="btn"
                                    onClick={() => {
                                      setShowRejectInput((prev) => ({
                                        ...prev,
                                        [run.id]: false,
                                      }));
                                    }}
                                    style={{
                                      background: "rgba(255, 255, 255, 0.05)",
                                      border:
                                        "1px solid rgba(255, 215, 0, 0.2)",
                                      padding: "0.5rem 1rem",
                                      fontSize: "0.8rem",
                                      flex: 1,
                                    }}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div
                                style={{
                                  display: "flex",
                                  gap: "0.5rem",
                                  justifyContent: "center",
                                }}
                              >
                                <button
                                  className="btn"
                                  onClick={() => handleAction(run.id, true)}
                                  disabled={processing[run.id]}
                                  style={{
                                    background: "rgba(0, 255, 0, 0.1)",
                                    border: "1px solid rgba(0, 255, 0, 0.3)",
                                    color: "#00ff00",
                                    padding: "0.5rem 1rem",
                                    fontSize: "0.9rem",
                                  }}
                                >
                                  {processing[run.id] ? "..." : "✓ Approve"}
                                </button>
                                <button
                                  className="btn"
                                  onClick={() =>
                                    setShowRejectInput((prev) => ({
                                      ...prev,
                                      [run.id]: true,
                                    }))
                                  }
                                  disabled={processing[run.id]}
                                  style={{
                                    background: "rgba(255, 0, 0, 0.1)",
                                    border: "1px solid rgba(255, 0, 0, 0.3)",
                                    color: "#ff4444",
                                    padding: "0.5rem 1rem",
                                    fontSize: "0.9rem",
                                  }}
                                >
                                  ✗ Reject
                                </button>
                              </div>
                            )}
                          </td>
                        )}
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
          </div>
        )}
      </>
    );
  };

  return (
    <div className="landing">
      <div className="section" style={{ paddingTop: "6rem" }}>
        <div className="section-header">
          <Link href="/moderation" className="auth-back">
            ← Back to Dashboard
          </Link>
          <div className="section-ornament" style={{ marginTop: "1rem" }}>
            ✦ ✦ ✦
          </div>
          <div className="section-divider" />
          <h1 className="section-title">{gameName}</h1>
          <p className="section-subtitle">Moderation Queue</p>
        </div>

        {error && (
          <div
            style={{
              padding: "1rem",
              marginBottom: "2rem",
              background: "rgba(255, 0, 0, 0.1)",
              border: "1px solid rgba(255, 0, 0, 0.3)",
              borderRadius: "4px",
              color: "#ff4444",
              textAlign: "center",
            }}
          >
            {error}
          </div>
        )}

        {renderRunsTable(queue.pending, "Pending Full Game Runs", true, false)}
        {renderRunsTable(
          queue.pendingIL,
          "Pending Individual Level Runs",
          true,
          true,
        )}
        {renderRunsTable(
          queue.rejected,
          "Rejected Full Game Runs",
          false,
          false,
        )}
        {renderRunsTable(
          queue.rejectedIL,
          "Rejected Individual Level Runs",
          false,
          true,
        )}
      </div>
    </div>
  );
}
