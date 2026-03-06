"use client";
import { useState, useEffect } from "react";
import { useAuth } from "../../../components/auth/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Run {
  id: string;
  is_coop: boolean;
  user: {
    id: string;
    username: string;
    display_name: string | null;
    country: string | null;
  } | null;
  runners:
    | {
        id: string;
        username: string;
        display_name: string | null;
        country: string | null;
      }[]
    | null;
  game: string;
  category: string;
  platform: string;
  realtime_ms: number | null;
  gametime_ms: number | null;
  realtime_display: string | null;
  gametime_display: string | null;
  verified: boolean;
  video_url: string | null;
  comment: string | null;
  submitted_at: string;
  verified_at: string | null;
}

function msToComponents(ms: number | null) {
  if (!ms) return { hours: "", minutes: "", seconds: "", milliseconds: "" };
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = ms % 1000;
  return {
    hours: hours > 0 ? String(hours) : "",
    minutes: String(minutes).padStart(hours > 0 ? 2 : 1, "0"),
    seconds: String(seconds).padStart(2, "0"),
    milliseconds: String(milliseconds).padStart(3, "0"),
  };
}

function componentsToMs(
  hours: string,
  minutes: string,
  seconds: string,
  milliseconds: string,
) {
  return (
    parseInt(hours || "0") * 3600000 +
    parseInt(minutes || "0") * 60000 +
    parseInt(seconds || "0") * 1000 +
    parseInt(milliseconds || "0")
  );
}

export default function RunEditPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { user, loading: authLoading, token } = useAuth();
  const router = useRouter();
  const [runId, setRunId] = useState<string | null>(null);
  useEffect(() => {
    params.then((p) => setRunId(p.runId));
  }, [params]);
  const [run, setRun] = useState<Run | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // RTA fields
  const [rtaHours, setRtaHours] = useState("");
  const [rtaMinutes, setRtaMinutes] = useState("");
  const [rtaSeconds, setRtaSeconds] = useState("");
  const [rtaMs, setRtaMs] = useState("");

  // IGT fields
  const [igtHours, setIgtHours] = useState("");
  const [igtMinutes, setIgtMinutes] = useState("");
  const [igtSeconds, setIgtSeconds] = useState("");
  const [igtMs, setIgtMs] = useState("");

  const [videoUrl, setVideoUrl] = useState("");
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (!runId || authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    if (user.role !== "admin") {
      router.push("/");
      return;
    }

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/runs/${runId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          return;
        }
        setRun(data);

        const rta = msToComponents(data.realtime_ms);
        setRtaHours(rta.hours);
        setRtaMinutes(rta.minutes);
        setRtaSeconds(rta.seconds);
        setRtaMs(rta.milliseconds);

        const igt = msToComponents(data.gametime_ms);
        setIgtHours(igt.hours);
        setIgtMinutes(igt.minutes);
        setIgtSeconds(igt.seconds);
        setIgtMs(igt.milliseconds);

        setVideoUrl(data.video_url || "");
        setComment(data.comment || "");
      })
      .catch(() => setError("Failed to load run"))
      .finally(() => setLoading(false));
  }, [runId, user, authLoading, router]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);
    const url = run?.is_coop
      ? `${process.env.NEXT_PUBLIC_API_URL}/runs/coop/${runId}`
      : `${process.env.NEXT_PUBLIC_API_URL}/runs/${runId}`;

    console.log("updating url:", url);
    const realtime_ms = componentsToMs(rtaHours, rtaMinutes, rtaSeconds, rtaMs);
    const gametime_ms = componentsToMs(igtHours, igtMinutes, igtSeconds, igtMs);

    try {
      const res = await fetch(
        run?.is_coop
          ? `${process.env.NEXT_PUBLIC_API_URL}/runs/coop/${runId}`
          : `${process.env.NEXT_PUBLIC_API_URL}/runs/${runId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            realtime_ms: realtime_ms > 0 ? realtime_ms : null,
            gametime_ms: gametime_ms > 0 ? gametime_ms : null,
            video_url: videoUrl || null,
            comment: comment || null,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update run");
      setSuccess("Run updated successfully.");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(
        run?.is_coop
          ? `${process.env.NEXT_PUBLIC_API_URL}/runs/coop/${runId}`
          : `${process.env.NEXT_PUBLIC_API_URL}/runs/${runId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok) throw new Error("Failed to delete run");
      router.push("/admin");
    } catch (err: any) {
      setError(err.message);
      setDeleting(false);
    }
  };

  if (authLoading || loading) return null;
  if (!user || user.role !== "admin") return null;

  if (error && !run) {
    return (
      <div className="landing">
        <div className="section" style={{ paddingTop: "6rem" }}>
          <div className="section-header">
            <h1 className="section-title">Edit Run</h1>
            <p className="section-subtitle" style={{ color: "#ff4444" }}>
              {error}
            </p>
          </div>
          <div style={{ textAlign: "center", marginTop: "2rem" }}>
            <Link href="/admin" className="btn btn-primary">
              ← Back to Admin
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="landing">
      <div className="section" style={{ paddingTop: "6rem" }}>
        <div style={{ maxWidth: "600px", margin: "0 auto" }}>
          <Link href="/admin" style={{ opacity: 0.6, fontSize: "0.9rem" }}>
            ← Back to Admin
          </Link>

          <div className="section-header" style={{ marginTop: "1rem" }}>
            <h1 className="section-title">Edit Run</h1>
            {run && (
              <p className="section-subtitle">
                {run.is_coop && run.runners
                  ? run.runners
                      .map((r) => r.display_name || r.username)
                      .join(" & ")
                  : run.user?.display_name || run.user?.username}{" "}
                · {run.game} · {run.platform} · {run.category}
              </p>
            )}
          </div>

          {run && (
            <>
              <div className="profile-section">
                <form onSubmit={handleSave}>
                  <div className="form-group">
                    <label className="form-label">Real Time Attack (RTA)</label>
                    <div className="time-input-group">
                      <input
                        type="number"
                        placeholder="HH"
                        value={rtaHours}
                        onChange={(e) => setRtaHours(e.target.value)}
                        className="auth-input"
                      />
                      <span className="time-separator">:</span>
                      <input
                        type="number"
                        placeholder="MM"
                        value={rtaMinutes}
                        onChange={(e) => setRtaMinutes(e.target.value)}
                        className="auth-input"
                      />
                      <span className="time-separator">:</span>
                      <input
                        type="number"
                        placeholder="SS"
                        value={rtaSeconds}
                        onChange={(e) => setRtaSeconds(e.target.value)}
                        className="auth-input"
                      />
                      <span className="time-separator">.</span>
                      <input
                        type="number"
                        placeholder="MS"
                        value={rtaMs}
                        onChange={(e) => setRtaMs(e.target.value)}
                        className="auth-input"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      In-Game Time (IGT) — Optional
                    </label>
                    <div className="time-input-group">
                      <input
                        type="number"
                        placeholder="HH"
                        value={igtHours}
                        onChange={(e) => setIgtHours(e.target.value)}
                        className="auth-input"
                      />
                      <span className="time-separator">:</span>
                      <input
                        type="number"
                        placeholder="MM"
                        value={igtMinutes}
                        onChange={(e) => setIgtMinutes(e.target.value)}
                        className="auth-input"
                      />
                      <span className="time-separator">:</span>
                      <input
                        type="number"
                        placeholder="SS"
                        value={igtSeconds}
                        onChange={(e) => setIgtSeconds(e.target.value)}
                        className="auth-input"
                      />
                      <span className="time-separator">.</span>
                      <input
                        type="number"
                        placeholder="MS"
                        value={igtMs}
                        onChange={(e) => setIgtMs(e.target.value)}
                        className="auth-input"
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Video URL</label>
                    <input
                      type="url"
                      className="auth-input"
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      placeholder="https://youtube.com/watch?v=..."
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Comment</label>
                    <textarea
                      className="auth-input"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      rows={3}
                      style={{ resize: "vertical", fontFamily: "inherit" }}
                    />
                  </div>

                  <div
                    className="form-group"
                    style={{ fontSize: "0.85rem", opacity: 0.6 }}
                  >
                    <div>
                      Submitted:{" "}
                      {new Date(run.submitted_at).toLocaleDateString()}
                    </div>
                    <div>Status: {run.verified ? "✓ Verified" : "Pending"}</div>
                    {run.verified_at && (
                      <div>
                        Verified:{" "}
                        {new Date(run.verified_at).toLocaleDateString()}
                      </div>
                    )}
                  </div>

                  {error && <p className="auth-error">{error}</p>}
                  {success && <p className="auth-success">{success}</p>}

                  <button
                    className="btn btn-primary btn-full"
                    type="submit"
                    disabled={submitting}
                  >
                    {submitting ? "Saving..." : "Save Changes"}
                  </button>
                </form>
              </div>

              {/* Delete */}
              <div
                className="profile-section"
                style={{ marginTop: "2rem", borderColor: "rgba(255,0,0,0.2)" }}
              >
                <h2
                  className="profile-section-title"
                  style={{ color: "#ff4444" }}
                >
                  Danger Zone
                </h2>
                {!confirmDelete ? (
                  <button
                    className="btn btn-full"
                    style={{ color: "#ff4444", borderColor: "#ff4444" }}
                    onClick={() => setConfirmDelete(true)}
                  >
                    Delete Run
                  </button>
                ) : (
                  <div>
                    <p style={{ marginBottom: "1rem", opacity: 0.8 }}>
                      Are you sure? This cannot be undone.
                    </p>
                    <div style={{ display: "flex", gap: "1rem" }}>
                      <button
                        className="btn btn-full"
                        style={{ color: "#ff4444", borderColor: "#ff4444" }}
                        onClick={handleDelete}
                        disabled={deleting}
                      >
                        {deleting ? "Deleting..." : "Yes, Delete"}
                      </button>
                      <button
                        className="btn btn-full"
                        onClick={() => setConfirmDelete(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
