"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { countryCodeToFlag } from "@/app/lib/flags";

interface User {
  id: string;
  username: string;
  display_name: string | null;
  country: string | null;
}

interface PendingRun {
  id: string;
  is_coop: boolean;
  user: User | null;
  runners: User[] | null;
  subcategory?: string | null;
  category: string;
  platform: string;
  comment: string | null;
  system: string | null;
  realtime_ms?: number | null;
  gametime_ms?: number | null;
  realtime_display?: string | null;
  gametime_display?: string | null;
  video_url: string;
  submitted_at: string;
  rejected?: boolean;
  reject_reason?: string | null;
}

export default function ModQueuePage({
  params,
}: {
  params: Promise<{ gameSlug: string }>;
}) {
  const router = useRouter();
  const [gameSlug, setGameSlug] = useState<string>("");
  const [gameName, setGameName] = useState<string>("");
  const [pendingRuns, setPendingRuns] = useState<PendingRun[]>([]);
  const [rejectedRuns, setRejectedRuns] = useState<PendingRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState<Record<string, boolean>>({});
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>(
    {},
  );
  const [showRejectInput, setShowRejectInput] = useState<
    Record<string, boolean>
  >({});
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  useEffect(() => {
    params.then((p) => setGameSlug(p.gameSlug));
  }, [params]);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      router.push("/login");
      return;
    }

    if (!gameSlug) return;

    const fetchQueue = async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/moderation/${gameSlug}/mod-queue`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (!res.ok) throw new Error("Failed to fetch mod queue");

        const data = await res.json();
        setGameName(data.game || gameSlug);

        const runs = data.runs || [];
        setPendingRuns(runs.filter((r: PendingRun) => !r.rejected));
        setRejectedRuns(runs.filter((r: PendingRun) => r.rejected));
      } catch (error: any) {
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchQueue();
  }, [gameSlug, router]);

  const handleVerify = async (runId: string, approve: boolean) => {
    if (!approve && !rejectReasons[runId]?.trim()) {
      setError("Please provide a reason for rejection");
      return;
    }

    setProcessing((prev) => ({ ...prev, [runId]: true }));
    setError("");

    try {
      const token = localStorage.getItem("token");

      const endpoint = pendingRuns.find((r) => r.id === runId)?.is_coop
        ? `${process.env.NEXT_PUBLIC_API_URL}/moderation/coop-runs/${runId}/verify`
        : `${process.env.NEXT_PUBLIC_API_URL}/moderation/runs/${runId}/verify`;

      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          verified: approve,
          reject_reason: approve ? undefined : rejectReasons[runId],
        }),
      });

      if (!res.ok) throw new Error("Failed to verify run");

      if (approve) {
        setPendingRuns((prev) => prev.filter((r) => r.id !== runId));
      } else {
        const run = pendingRuns.find((r) => r.id === runId);
        console.log("handleVerify run:", run);
        console.log("is_coop:", run?.is_coop);
        if (run) {
          setPendingRuns((prev) => prev.filter((r) => r.id !== runId));
          setRejectedRuns((prev) => [
            ...prev,
            { ...run, rejected: true, reject_reason: rejectReasons[runId] },
          ]);
        }
      }

      setRejectReasons((prev) => {
        const updated = { ...prev };
        delete updated[runId];
        return updated;
      });
      setShowRejectInput((prev) => {
        const updated = { ...prev };
        delete updated[runId];
        return updated;
      });
      if (expandedRunId === runId) setExpandedRunId(null);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setProcessing((prev) => ({ ...prev, [runId]: false }));
    }
  };

  const handleRowClick = (runId: string) => {
    setExpandedRunId((prev) => (prev === runId ? null : runId));
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
  ) => {
    // col count: Runner, Category, Platform, RTA, IGT, Video, + Reason or Actions
    const colCount = 7;

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
                        onClick={() => handleRowClick(run.id)}
                        style={{ cursor: "pointer" }}
                      >
                        <td className="runner-cell">
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
                        <td>{run.platform}</td>
                        <td className="time-cell">
                          {run.realtime_display || "—"}
                        </td>
                        <td className="time-cell">
                          {run.gametime_display || "—"}
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
                                    onClick={() => handleVerify(run.id, false)}
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
                                      setRejectReasons((prev) => {
                                        const updated = { ...prev };
                                        delete updated[run.id];
                                        return updated;
                                      });
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
                                  onClick={() => handleVerify(run.id, true)}
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

                      {/* Accordion row */}
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

        {renderRunsTable(pendingRuns, "Pending Runs", true)}
        {renderRunsTable(rejectedRuns, "Rejected Runs", false)}
      </div>
    </div>
  );
}
