"use client";
import { useState, useEffect } from "react";
import { useAuth } from "../components/auth/AuthContext";
import { useRouter } from "next/navigation";

interface Platform {
  id: string;
  name: string;
  slug: string;
  timing_method: string;
}

interface Game {
  id: string;
  slug: string;
  name: string;
  platforms: Platform[];
}

interface UserResult {
  id: string;
  username: string;
  display_name: string | null;
  email: string | null;
  role: string;
  country: string | null;
  created_at: string;
  moderated_games: {
    game_id: string;
    game: { id: string; name: string; slug: string };
  }[];
}

interface QueueRun {
  id: string;
  user: { id: string; username: string; display_name: string | null; country: string | null };
  game: string;
  game_slug: string;
  category: string;
  platform: string;
  timing_method: string;
  realtime_ms: number | null;
  realtime_display: string | null;
  gametime_ms: number | null;
  gametime_display: string | null;
  video_url: string | null;
  submitted_at: string;
  comment: string | null;
}

type Tab = "games" | "runs" | "users";

export default function AdminPage() {
  const { user, loading: authLoading, token } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("games");
  const [games, setGames] = useState<Game[]>([]);
  const [loadingGames, setLoadingGames] = useState(true);

  // Add Game
  const [gameForm, setGameForm] = useState({ name: "", slug: "" });
  const [gameError, setGameError] = useState("");
  const [gameSuccess, setGameSuccess] = useState("");
  const [gameSubmitting, setGameSubmitting] = useState(false);

  // Add Platform
  const [platformForm, setPlatformForm] = useState({
    game_slug: "",
    name: "",
    platform_slug: "",
    timing_method: "realtime",
  });
  const [platformError, setPlatformError] = useState("");
  const [platformSuccess, setPlatformSuccess] = useState("");
  const [platformSubmitting, setPlatformSubmitting] = useState(false);

  // Add Category
  const [categoryForm, setCategoryForm] = useState({
    game_slug: "",
    platform_slug: "",
    name: "",
    category_slug: "",
  });
  const [categoryError, setCategoryError] = useState("");
  const [categorySuccess, setCategorySuccess] = useState("");
  const [categorySubmitting, setCategorySubmitting] = useState(false);

  // Runs queue
  const [queueRuns, setQueueRuns] = useState<QueueRun[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueError, setQueueError] = useState("");
  const [rejectRunId, setRejectRunId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // User search
  const [userSearch, setUserSearch] = useState("");
  const [userResults, setUserResults] = useState<UserResult[]>([]);
  const [userSearching, setUserSearching] = useState(false);
  const [userError, setUserError] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push("/login"); return; }
    if (user.role !== "admin") { router.push("/"); return; }

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/games`)
      .then((res) => res.json())
      .then((data) => setGames(data))
      .catch(console.error)
      .finally(() => setLoadingGames(false));
  }, [user, authLoading, router]);

  useEffect(() => {
    if (activeTab !== "runs") return;
    setQueueLoading(true);
    setQueueError("");
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/moderation/queue`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setQueueRuns(data.runs || []))
      .catch(() => setQueueError("Failed to load mod queue"))
      .finally(() => setQueueLoading(false));
  }, [activeTab, token]);

  const handleVerifyRun = async (runId: string) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/moderation/runs/${runId}/verify`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ verified: true }),
      });
      if (!res.ok) throw new Error("Failed to verify run");
      setQueueRuns((prev) => prev.filter((r) => r.id !== runId));
    } catch (err: any) {
      setQueueError(err.message);
    }
  };

  const handleRejectRun = async (runId: string) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/moderation/runs/${runId}/verify`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ verified: false, rejected: true, reject_reason: rejectReason }),
      });
      if (!res.ok) throw new Error("Failed to reject run");
      setQueueRuns((prev) => prev.filter((r) => r.id !== runId));
      setRejectRunId(null);
      setRejectReason("");
    } catch (err: any) {
      setQueueError(err.message);
    }
  };

  const handleAddGame = async (e: React.FormEvent) => {
    e.preventDefault();
    setGameError(""); setGameSuccess(""); setGameSubmitting(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/games`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(gameForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create game");
      setGameSuccess(`Game "${data.game.name}" created successfully.`);
      setGameForm({ name: "", slug: "" });
      setGames((prev) => [...prev, { ...data.game, platforms: [] }]);
    } catch (err: any) {
      setGameError(err.message);
    } finally {
      setGameSubmitting(false);
    }
  };

  const handleAddPlatform = async (e: React.FormEvent) => {
    e.preventDefault();
    setPlatformError(""); setPlatformSuccess(""); setPlatformSubmitting(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/games/${platformForm.game_slug}/platforms`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            name: platformForm.name,
            platform_slug: platformForm.platform_slug,
            timing_method: platformForm.timing_method,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create platform");
      setPlatformSuccess(`Platform "${data.platform.name}" created successfully.`);
      setPlatformForm({ game_slug: "", name: "", platform_slug: "", timing_method: "realtime" });
      setGames((prev) =>
        prev.map((g) =>
          g.slug === platformForm.game_slug
            ? { ...g, platforms: [...g.platforms, data.platform] }
            : g,
        ),
      );
    } catch (err: any) {
      setPlatformError(err.message);
    } finally {
      setPlatformSubmitting(false);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setCategoryError(""); setCategorySuccess(""); setCategorySubmitting(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/games/${categoryForm.game_slug}/${categoryForm.platform_slug}/categories`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            name: categoryForm.name,
            category_slug: categoryForm.category_slug,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create category");
      setCategorySuccess(`Category "${data.category.name}" created successfully.`);
      setCategoryForm({ game_slug: "", platform_slug: "", name: "", category_slug: "" });
    } catch (err: any) {
      setCategoryError(err.message);
    } finally {
      setCategorySubmitting(false);
    }
  };

  const handleUserSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserError(""); setUserSearching(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/users/search?q=${encodeURIComponent(userSearch)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");
      setUserResults(data.users || []);
    } catch (err: any) {
      setUserError(err.message);
    } finally {
      setUserSearching(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) throw new Error("Failed to update role");
      setUserResults((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)),
      );
    } catch (err: any) {
      setUserError(err.message);
    }
  };

  const handleAssignModerator = async (userId: string, gameSlug: string) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/${userId}/moderate/${gameSlug}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to assign moderator");
      setUserResults((prev) => prev.map((u) => {
        if (u.id !== userId) return u;
        const game = games.find((g) => g.slug === gameSlug)!;
        return {
          ...u,
          moderated_games: [...u.moderated_games, { game_id: game.id, game: { id: game.id, name: game.name, slug: game.slug } }],
        };
      }));
    } catch (err: any) {
      setUserError(err.message);
    }
  };

  const handleRemoveModerator = async (userId: string, gameSlug: string, gameId: string) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/${userId}/moderate/${gameSlug}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to remove moderator");
      setUserResults((prev) => prev.map((u) => {
        if (u.id !== userId) return u;
        return { ...u, moderated_games: u.moderated_games.filter((mg) => mg.game_id !== gameId) };
      }));
    } catch (err: any) {
      setUserError(err.message);
    }
  };

  if (authLoading) return null;
  if (!user || user.role !== "admin") return null;

  const selectedGamePlatforms =
    games.find((g) => g.slug === categoryForm.game_slug)?.platforms || [];

  return (
    <div className="landing">
      <div className="section" style={{ paddingTop: "6rem" }}>
        <div className="section-header">
          <h1 className="section-title">Admin Panel</h1>
          <p className="section-subtitle">Manage games, runs, and users</p>
        </div>

        {/* Tabs */}
        <div className="leaderboard-tabs" style={{ marginBottom: "2rem" }}>
          {(["games", "runs", "users"] as Tab[]).map((tab) => (
            <button
              key={tab}
              className={`leaderboard-tab ${activeTab === tab ? "active" : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Games Tab */}
        {activeTab === "games" && (
          <div style={{ maxWidth: "600px", margin: "0 auto" }}>
            <div className="profile-section">
              <h2 className="profile-section-title">Add Game</h2>
              <form onSubmit={handleAddGame}>
                <div className="form-group">
                  <label className="form-label">Game Name *</label>
                  <input className="auth-input" placeholder="Harry Potter and the Philosopher's Stone" value={gameForm.name} onChange={(e) => setGameForm({ ...gameForm, name: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Slug *</label>
                  <input className="auth-input" placeholder="hp1" value={gameForm.slug} onChange={(e) => setGameForm({ ...gameForm, slug: e.target.value })} required />
                </div>
                {gameError && <p className="auth-error">{gameError}</p>}
                {gameSuccess && <p className="auth-success">{gameSuccess}</p>}
                <button className="btn btn-primary btn-full" type="submit" disabled={gameSubmitting}>
                  {gameSubmitting ? "Creating..." : "Create Game"}
                </button>
              </form>
            </div>

            <div className="profile-section" style={{ marginTop: "2rem" }}>
              <h2 className="profile-section-title">Add Platform</h2>
              <form onSubmit={handleAddPlatform}>
                <div className="form-group">
                  <label className="form-label">Game *</label>
                  <select className="auth-input" value={platformForm.game_slug} onChange={(e) => setPlatformForm({ ...platformForm, game_slug: e.target.value })} required>
                    <option value="">Select a game</option>
                    {games.map((g) => <option key={g.id} value={g.slug}>{g.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Platform Name *</label>
                  <input className="auth-input" placeholder="PC" value={platformForm.name} onChange={(e) => setPlatformForm({ ...platformForm, name: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Slug *</label>
                  <input className="auth-input" placeholder="pc" value={platformForm.platform_slug} onChange={(e) => setPlatformForm({ ...platformForm, platform_slug: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Timing Method *</label>
                  <select className="auth-input" value={platformForm.timing_method} onChange={(e) => setPlatformForm({ ...platformForm, timing_method: e.target.value })}>
                    <option value="realtime">Real Time (RTA)</option>
                    <option value="gametime">Game Time (IGT/Loadless)</option>
                  </select>
                </div>
                {platformError && <p className="auth-error">{platformError}</p>}
                {platformSuccess && <p className="auth-success">{platformSuccess}</p>}
                <button className="btn btn-primary btn-full" type="submit" disabled={platformSubmitting}>
                  {platformSubmitting ? "Creating..." : "Create Platform"}
                </button>
              </form>
            </div>

            <div className="profile-section" style={{ marginTop: "2rem" }}>
              <h2 className="profile-section-title">Add Category</h2>
              <form onSubmit={handleAddCategory}>
                <div className="form-group">
                  <label className="form-label">Game *</label>
                  <select className="auth-input" value={categoryForm.game_slug} onChange={(e) => setCategoryForm({ ...categoryForm, game_slug: e.target.value, platform_slug: "" })} required>
                    <option value="">Select a game</option>
                    {games.map((g) => <option key={g.id} value={g.slug}>{g.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Platform *</label>
                  <select className="auth-input" value={categoryForm.platform_slug} onChange={(e) => setCategoryForm({ ...categoryForm, platform_slug: e.target.value })} required disabled={!categoryForm.game_slug}>
                    <option value="">Select a platform</option>
                    {selectedGamePlatforms.map((p) => <option key={p.id} value={p.slug}>{p.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Category Name *</label>
                  <input className="auth-input" placeholder="Any%" value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Slug *</label>
                  <input className="auth-input" placeholder="any" value={categoryForm.category_slug} onChange={(e) => setCategoryForm({ ...categoryForm, category_slug: e.target.value })} required />
                </div>
                {categoryError && <p className="auth-error">{categoryError}</p>}
                {categorySuccess && <p className="auth-success">{categorySuccess}</p>}
                <button className="btn btn-primary btn-full" type="submit" disabled={categorySubmitting}>
                  {categorySubmitting ? "Creating..." : "Create Category"}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Runs Tab */}
        {activeTab === "runs" && (
          <div style={{ maxWidth: "900px", margin: "0 auto" }}>
            <div className="profile-section">
              <h2 className="profile-section-title">
                Pending Runs {queueRuns.length > 0 && `(${queueRuns.length})`}
              </h2>

              {queueError && <p className="auth-error">{queueError}</p>}

              {queueLoading ? (
                <p style={{ opacity: 0.6, textAlign: "center" }}>Loading...</p>
              ) : queueRuns.length === 0 ? (
                <p style={{ opacity: 0.6, textAlign: "center" }}>No pending runs.</p>
              ) : (
                queueRuns.map((run) => (
                  <div key={run.id} style={{
                    padding: "1rem",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "4px",
                    marginBottom: "1rem",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
                      <div>
                        <div style={{ fontWeight: "bold", marginBottom: "0.25rem" }}>
                          {run.user.display_name || run.user.username}
                          {run.user.country && <span style={{ opacity: 0.6, marginLeft: "0.5rem", fontSize: "0.85rem" }}>{run.user.country}</span>}
                        </div>
                        <div style={{ fontSize: "0.85rem", opacity: 0.7 }}>
                          {run.game} · {run.platform} · {run.category}
                        </div>
                        <div style={{ fontSize: "0.85rem", marginTop: "0.25rem" }}>
                          {run.timing_method === "gametime"
                            ? run.gametime_display || run.realtime_display || "—"
                            : run.realtime_display || "—"}
                        </div>
                        {run.comment && (
                          <div style={{ fontSize: "0.8rem", opacity: 0.6, marginTop: "0.25rem" }}>
                            "{run.comment}"
                          </div>
                        )}
                        <div style={{ fontSize: "0.75rem", opacity: 0.5, marginTop: "0.25rem" }}>
                          {new Date(run.submitted_at).toLocaleDateString()}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                        {run.video_url && (
                          <a href={run.video_url} target="_blank" rel="noopener noreferrer" className="btn" style={{ fontSize: "0.85rem", padding: "0.4rem 0.8rem" }}>
                            ▶ Watch
                          </a>
                        )}
                        <button
                          className="btn btn-primary"
                          style={{ fontSize: "0.85rem", padding: "0.4rem 0.8rem" }}
                          onClick={() => handleVerifyRun(run.id)}
                        >
                          ✓ Verify
                        </button>
                        <button
                          className="btn"
                          style={{ fontSize: "0.85rem", padding: "0.4rem 0.8rem", color: "#ff4444", borderColor: "#ff4444" }}
                          onClick={() => setRejectRunId(rejectRunId === run.id ? null : run.id)}
                        >
                          ✕ Reject
                        </button>
                      </div>
                    </div>

                    {rejectRunId === run.id && (
                      <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem" }}>
                        <input
                          className="auth-input"
                          placeholder="Reason for rejection..."
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          style={{ flex: 1 }}
                        />
                        <button
                          className="btn"
                          style={{ color: "#ff4444", borderColor: "#ff4444", whiteSpace: "nowrap" }}
                          onClick={() => handleRejectRun(run.id)}
                        >
                          Confirm Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === "users" && (
          <div style={{ maxWidth: "600px", margin: "0 auto" }}>
            <div className="profile-section">
              <h2 className="profile-section-title">Search Users</h2>
              <form onSubmit={handleUserSearch}>
                <div className="form-group">
                  <label className="form-label">Username</label>
                  <input className="auth-input" placeholder="Search by username..." value={userSearch} onChange={(e) => setUserSearch(e.target.value)} required />
                </div>
                {userError && <p className="auth-error">{userError}</p>}
                <button className="btn btn-primary btn-full" type="submit" disabled={userSearching}>
                  {userSearching ? "Searching..." : "Search"}
                </button>
              </form>

              {userResults.map((u) => (
                <div key={u.id} style={{
                  padding: "1rem",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "4px",
                  marginBottom: "1rem",
                  marginTop: "1rem",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                    <div>
                      <div style={{ fontWeight: "bold" }}>{u.display_name || u.username}</div>
                      <div style={{ fontSize: "0.8rem", opacity: 0.6 }}>@{u.username} · {u.email}</div>
                      <div style={{ fontSize: "0.8rem", opacity: 0.6 }}>Role: {u.role}</div>
                    </div>
                    <select className="auth-input" style={{ width: "auto" }} value={u.role} onChange={(e) => handleRoleChange(u.id, e.target.value)}>
                      <option value="user">User</option>
                      <option value="moderator">Moderator</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>

                  <div>
                    <div style={{ fontSize: "0.85rem", opacity: 0.7, marginBottom: "0.5rem" }}>Moderates:</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.75rem" }}>
                      {u.moderated_games.length === 0 && (
                        <span style={{ fontSize: "0.8rem", opacity: 0.5 }}>No games assigned</span>
                      )}
                      {u.moderated_games.map((mg) => (
                        <span key={mg.game_id} style={{
                          display: "inline-flex", alignItems: "center", gap: "0.4rem",
                          padding: "0.2rem 0.6rem", background: "rgba(255,255,255,0.1)",
                          borderRadius: "4px", fontSize: "0.8rem",
                        }}>
                          {mg.game.name}
                          <button onClick={() => handleRemoveModerator(u.id, mg.game.slug, mg.game_id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ff4444", fontSize: "0.9rem" }}>×</button>
                        </span>
                      ))}
                    </div>
                    <select className="auth-input" style={{ width: "100%" }} defaultValue="" onChange={(e) => { if (e.target.value) handleAssignModerator(u.id, e.target.value); e.target.value = ""; }}>
                      <option value="">Assign to game...</option>
                      {games.filter((g) => !u.moderated_games.find((mg) => mg.game.slug === g.slug)).map((g) => (
                        <option key={g.id} value={g.slug}>{g.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}