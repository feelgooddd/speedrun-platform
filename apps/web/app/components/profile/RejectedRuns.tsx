"use client";
import { useState, useEffect } from "react";
import { useAuth } from "../auth/AuthContext";

interface RejectedRun {
  id: string;
  is_il: boolean;
  game: string | null;
  game_slug: string | null;
  category: string | null;
  level: string | null;
  platform: string;
  platform_slug: string | null;
  system_id: string | null;
  realtime_ms: number | null;
  gametime_ms: number | null;
  realtime_display: string | null;
  gametime_display: string | null;
  score_value: number | null;
  scoring_type: string | null;
  video_url: string | null;
  comment: string | null;
  reject_reason: string | null;
  submitted_at: string;
}

interface System {
  id: string;
  name: string;
}

function msToComponents(ms: number | null) {
  if (!ms) return { h: "", m: "", s: "", ms: "" };
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const mil = ms % 1000;
  return {
    h: h > 0 ? String(h) : "",
    m: String(m).padStart(h > 0 ? 2 : 1, "0"),
    s: String(s).padStart(2, "0"),
    ms: String(mil).padStart(3, "0"),
  };
}

function componentsToMs(h: string, m: string, s: string, mil: string) {
  return (
    parseInt(h || "0") * 3600000 +
    parseInt(m || "0") * 60000 +
    parseInt(s || "0") * 1000 +
    parseInt(mil || "0")
  );
}

export default function RejectedRuns({ username }: { username: string }) {
  const { user, token } = useAuth();
  const [runs, setRuns] = useState<RejectedRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editForms, setEditForms] = useState<Record<string, {
    h: string; m: string; s: string; ms: string;
    videoUrl: string; comment: string; scoreValue: string;
    systemId: string;
  }>>({});
  const [platformSystems, setPlatformSystems] = useState<Record<string, System[]>>({});
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successes, setSuccesses] = useState<Record<string, string>>({});

  const isOwnProfile = user?.username === username;

  useEffect(() => {
    if (!isOwnProfile || !token) { setLoading(false); return; }
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/runs/my-rejected`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then(async (data) => {
        const fetched: RejectedRun[] = data.runs ?? [];
        setRuns(fetched);

        const forms: typeof editForms = {};
        for (const run of fetched) {
          const t = msToComponents(run.realtime_ms);
          forms[run.id] = {
            h: t.h, m: t.m, s: t.s, ms: t.ms,
            videoUrl: run.video_url ?? "",
            comment: run.comment ?? "",
            scoreValue: run.score_value != null ? String(run.score_value) : "",
            systemId: run.system_id ?? "",
          };
        }
        setEditForms(forms);

        // Fetch systems for each unique game+platform combo
        const uniquePlatforms = new Map<string, { gameSlug: string; platformSlug: string }>();
        for (const run of fetched) {
          if (run.game_slug && run.platform_slug) {
            const key = `${run.game_slug}/${run.platform_slug}`;
            if (!uniquePlatforms.has(key)) {
              uniquePlatforms.set(key, { gameSlug: run.game_slug, platformSlug: run.platform_slug });
            }
          }
        }

        const systemsMap: Record<string, System[]> = {};
        await Promise.all(
          Array.from(uniquePlatforms.entries()).map(async ([key, { gameSlug, platformSlug }]) => {
            try {
              const res = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/games/${gameSlug}/${platformSlug}/systems`
              );
              const sysData = await res.json();
              systemsMap[key] = sysData.systems ?? [];
            } catch {
              systemsMap[key] = [];
            }
          })
        );
        setPlatformSystems(systemsMap);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [isOwnProfile, token]);

  if (!isOwnProfile) return null;
  if (loading) return null;
  if (runs.length === 0) return null;

  const handleResubmit = async (run: RejectedRun) => {
    const form = editForms[run.id];
    if (!form) return;
    setSubmitting((p) => ({ ...p, [run.id]: true }));
    setErrors((p) => ({ ...p, [run.id]: "" }));
    setSuccesses((p) => ({ ...p, [run.id]: "" }));

    const isScored = !!run.scoring_type;
    const realtime_ms = componentsToMs(form.h, form.m, form.s, form.ms);

    if (!realtime_ms || realtime_ms <= 0) {
      setErrors((p) => ({ ...p, [run.id]: "Please enter a valid time" }));
      setSubmitting((p) => ({ ...p, [run.id]: false }));
      return;
    }

    if (!form.videoUrl) {
      setErrors((p) => ({ ...p, [run.id]: "Video URL is required" }));
      setSubmitting((p) => ({ ...p, [run.id]: false }));
      return;
    }

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/runs/${run.id}/resubmit`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            realtime_ms,
            video_url: form.videoUrl,
            comment: form.comment || null,
            score_value: isScored && form.scoreValue ? parseInt(form.scoreValue) : null,
            system_id: form.systemId || null,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to resubmit");
      setRuns((prev) => prev.filter((r) => r.id !== run.id));
      setSuccesses((p) => ({ ...p, [run.id]: "Resubmitted successfully!" }));
      setExpandedId(null);
    } catch (err: any) {
      setErrors((p) => ({ ...p, [run.id]: err.message }));
    } finally {
      setSubmitting((p) => ({ ...p, [run.id]: false }));
    }
  };

  const updateForm = (id: string, patch: Partial<typeof editForms[string]>) => {
    setEditForms((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  return (
    <div className="profile-section">
      <h2 className="profile-section-title" style={{ color: "#ff4444" }}>
        Rejected Runs
      </h2>
      <div className="profile-pb-games">
        {runs.map((run) => {
          const form = editForms[run.id];
          const isExpanded = expandedId === run.id;
          const isScored = !!run.scoring_type;
          const platformKey = `${run.game_slug}/${run.platform_slug}`;
          const systems = platformSystems[platformKey] ?? [];

          return (
            <div key={run.id} className="cgw-card" style={{ borderColor: "rgba(255,0,0,0.2)" }}>
              {/* Header */}
              <div className="cgw-card-header">
                <button
                  className="cgw-card-toggle"
                  onClick={() => setExpandedId((p) => p === run.id ? null : run.id)}
                >
                  <span className="cgw-card-name">
                    {run.game} — {run.category}
                    {run.is_il && run.level ? ` — ${run.level}` : ""}
                  </span>
                  <span className="cgw-card-slug" style={{ color: "#ff4444" }}>
                    {run.reject_reason || "No reason provided"}
                  </span>
                  <span className="cgw-chevron">{isExpanded ? "▲" : "▼"}</span>
                </button>
              </div>

              {/* Edit form */}
              {isExpanded && form && (
                <div className="cgw-card-body">
                  {isScored && (
                    <div className="form-group">
                      <label className="form-label">
                        {run.scoring_type === "highscore" ? "Score" : "Casts"}
                      </label>
                      <input
                        type="number"
                        className="auth-input"
                        value={form.scoreValue}
                        onChange={(e) => updateForm(run.id, { scoreValue: e.target.value })}
                        placeholder="Enter score..."
                      />
                    </div>
                  )}

                  <div className="form-group">
                    <label className="form-label">Time (RTA)</label>
                    <div className="time-input-group">
                      <input type="number" placeholder="HH" className="auth-input" value={form.h} onChange={(e) => updateForm(run.id, { h: e.target.value })} />
                      <span className="time-separator">:</span>
                      <input type="number" placeholder="MM" className="auth-input" value={form.m} onChange={(e) => updateForm(run.id, { m: e.target.value })} />
                      <span className="time-separator">:</span>
                      <input type="number" placeholder="SS" className="auth-input" value={form.s} onChange={(e) => updateForm(run.id, { s: e.target.value })} />
                      <span className="time-separator">.</span>
                      <input type="number" placeholder="MS" className="auth-input" value={form.ms} onChange={(e) => updateForm(run.id, { ms: e.target.value })} />
                    </div>
                  </div>

                  {systems.length > 0 && (
                    <div className="form-group">
                      <label className="form-label">System</label>
                      <select
                        className="auth-input"
                        value={form.systemId}
                        onChange={(e) => updateForm(run.id, { systemId: e.target.value })}
                      >
                        <option value="">— None —</option>
                        {systems.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="form-group">
                    <label className="form-label">Video URL</label>
                    <input
                      type="url"
                      className="auth-input"
                      value={form.videoUrl}
                      onChange={(e) => updateForm(run.id, { videoUrl: e.target.value })}
                      placeholder="https://youtube.com/watch?v=..."
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Comment (optional)</label>
                    <textarea
                      className="auth-input"
                      value={form.comment}
                      onChange={(e) => updateForm(run.id, { comment: e.target.value })}
                      rows={3}
                      style={{ resize: "vertical", fontFamily: "inherit" }}
                    />
                  </div>

                  {errors[run.id] && <p className="auth-error">{errors[run.id]}</p>}
                  {successes[run.id] && <p className="auth-success">{successes[run.id]}</p>}

                  <button
                    className="btn btn-primary btn-full"
                    onClick={() => handleResubmit(run)}
                    disabled={submitting[run.id]}
                  >
                    {submitting[run.id] ? "Resubmitting..." : "Resubmit Run"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}