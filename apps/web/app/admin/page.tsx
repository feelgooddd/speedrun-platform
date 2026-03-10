"use client";
import { useState, useEffect } from "react";
import { useAuth } from "../components/auth/AuthContext";
import { useRouter } from "next/navigation";
import { countryCodeToFlag } from "../lib/flags";
import CreateGameWizard from "../components/admin/Creategamewizard";

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
  user: {
    id: string;
    username: string;
    display_name: string | null;
    country: string | null;
  };
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

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface VariableValueDraft {
  name: string;
  slug: string;
  is_coop: boolean;
  required_players: number;
}

type Tab = "games" | "runs" | "users";

function slugify(str: string) {
  return str.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

// ----------------------------------------------------------------
// VariableForm
// ----------------------------------------------------------------
function VariableForm({ games, token }: { games: Game[]; token: string | null }) {
  const [gameSlug, setGameSlug] = useState("");
  const [platformSlug, setPlatformSlug] = useState("");
  const [categorySlug, setCategorySlug] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [varName, setVarName] = useState("");
  const [varSlug, setVarSlug] = useState("");
  const [values, setValues] = useState<VariableValueDraft[]>([]);
  const [valForm, setValForm] = useState({ name: "", slug: "", is_coop: false, required_players: 2 });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const selectedPlatforms = games.find((g) => g.slug === gameSlug)?.platforms || [];

  useEffect(() => {
    if (!gameSlug || !platformSlug) { setCategories([]); setCategorySlug(""); return; }
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/games/${gameSlug}/${platformSlug}/categories`)
      .then((r) => r.json())
      .then((d) => setCategories(d.categories || []))
      .catch(console.error);
  }, [gameSlug, platformSlug]);

  const addValue = () => {
    if (!valForm.name.trim() || !valForm.slug.trim()) return;
    setValues((prev) => [...prev, { ...valForm }]);
    setValForm({ name: "", slug: "", is_coop: false, required_players: 2 });
  };

  const removeValue = (i: number) => setValues((prev) => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!varName || !varSlug) { setError("Variable name and slug are required"); return; }
    if (values.length === 0) { setError("Add at least one value"); return; }
    setSubmitting(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/games/${gameSlug}/${platformSlug}/${categorySlug}/variables`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            variable_name: varName,
            variable_slug: varSlug,
            is_subcategory: true,
            values: values.map((v) => ({
              name: v.name,
              slug: v.slug,
              is_coop: v.is_coop,
              required_players: v.is_coop ? v.required_players : null,
            })),
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create variable");
      setSuccess(`Variable "${data.variable.name}" created with ${data.variable.values.length} values.`);
      setVarName(""); setVarSlug(""); setValues([]);
      setCategorySlug("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label className="form-label">Game, Platform & Category</label>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <select
            className="auth-input"
            value={gameSlug}
            onChange={(e) => { setGameSlug(e.target.value); setPlatformSlug(""); setCategorySlug(""); }}
            required
            style={{ flex: 1, minWidth: "120px" }}
          >
            <option value="">Game</option>
            {games.map((g) => <option key={g.id} value={g.slug}>{g.name}</option>)}
          </select>
          <select
            className="auth-input"
            value={platformSlug}
            onChange={(e) => { setPlatformSlug(e.target.value); setCategorySlug(""); }}
            required
            disabled={!gameSlug}
            style={{ flex: 1, minWidth: "100px" }}
          >
            <option value="">Platform</option>
            {selectedPlatforms.map((p) => <option key={p.id} value={p.slug}>{p.name}</option>)}
          </select>
          <select
            className="auth-input"
            value={categorySlug}
            onChange={(e) => setCategorySlug(e.target.value)}
            required
            disabled={!platformSlug}
            style={{ flex: 1, minWidth: "100px" }}
          >
            <option value="">Category</option>
            {categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
        <div style={{ flex: 2 }}>
          <label className="form-label">Variable Name</label>
          <input
            className="auth-input"
            placeholder="e.g. Players, Version"
            value={varName}
            onChange={(e) => { setVarName(e.target.value); setVarSlug(slugify(e.target.value)); }}
            required
          />
        </div>
        <div style={{ flex: 1 }}>
          <label className="form-label">Slug</label>
          <input
            className="auth-input"
            placeholder="players"
            value={varSlug}
            onChange={(e) => setVarSlug(e.target.value)}
            required
          />
        </div>
      </div>

      {/* Values list */}
      {values.length > 0 && (
        <div style={{ marginBottom: "0.75rem" }}>
          {values.map((v, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.3rem 0.6rem", background: "rgba(255,255,255,0.05)", borderRadius: "4px", marginBottom: "0.4rem", fontSize: "0.85rem" }}>
              <span>
                {v.name}<span style={{ opacity: 0.5, marginLeft: "0.4rem" }}>/{v.slug}</span>
                {v.is_coop && <span style={{ opacity: 0.5, marginLeft: "0.5rem" }}>· co-op {v.required_players}p</span>}
              </span>
              <button type="button" onClick={() => removeValue(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ff4444" }}>×</button>
            </div>
          ))}
        </div>
      )}

      {/* Add value */}
      <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: "4px", padding: "0.75rem", marginBottom: "1rem" }}>
        <label className="form-label" style={{ fontSize: "0.75rem", opacity: 0.6 }}>Add Value</label>
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem", flexWrap: "wrap" }}>
          <input
            className="auth-input"
            placeholder="Value name (e.g. 1 Player)"
            style={{ flex: 2, minWidth: "120px", fontSize: "0.85rem" }}
            value={valForm.name}
            onChange={(e) => setValForm({ ...valForm, name: e.target.value, slug: slugify(e.target.value) })}
          />
          <input
            className="auth-input"
            placeholder="slug"
            style={{ flex: 1, minWidth: "70px", fontSize: "0.85rem" }}
            value={valForm.slug}
            onChange={(e) => setValForm({ ...valForm, slug: e.target.value })}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
          <input
            type="checkbox"
            id="vf_coop"
            checked={valForm.is_coop}
            onChange={(e) => setValForm({ ...valForm, is_coop: e.target.checked })}
          />
          <label htmlFor="vf_coop" className="form-label" style={{ margin: 0, fontSize: "0.8rem" }}>Co-op</label>
          {valForm.is_coop && (
            <input
              type="number"
              className="auth-input"
              min={2}
              value={valForm.required_players}
              onChange={(e) => setValForm({ ...valForm, required_players: parseInt(e.target.value) })}
              style={{ width: "80px", fontSize: "0.85rem" }}
            />
          )}
        </div>
        <button
          type="button"
          className="btn"
          onClick={addValue}
          disabled={!valForm.name || !valForm.slug}
          style={{ fontSize: "0.85rem", padding: "0.4rem 0.8rem" }}
        >
          + Add Value
        </button>
      </div>

      {error && <p className="auth-error">{error}</p>}
      {success && <p className="auth-success">{success}</p>}
      <button
        className="btn btn-primary btn-full"
        type="submit"
        disabled={submitting || !categorySlug || values.length === 0}
      >
        {submitting ? "Creating..." : "Create Variable"}
      </button>
    </form>
  );
}

// ----------------------------------------------------------------
// AdminPage
// ----------------------------------------------------------------
export default function AdminPage() {
  const { user, loading: authLoading, token } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("games");
  const [games, setGames] = useState<Game[]>([]);
  const [loadingGames, setLoadingGames] = useState(true);

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
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/moderation/runs/${runId}/verify`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ verified: true }),
        },
      );
      if (!res.ok) throw new Error("Failed to verify run");
      setQueueRuns((prev) => prev.filter((r) => r.id !== runId));
    } catch (err: any) { setQueueError(err.message); }
  };

  const handleRejectRun = async (runId: string) => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/moderation/runs/${runId}/verify`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ verified: false, rejected: true, reject_reason: rejectReason }),
        },
      );
      if (!res.ok) throw new Error("Failed to reject run");
      setQueueRuns((prev) => prev.filter((r) => r.id !== runId));
      setRejectRunId(null);
      setRejectReason("");
    } catch (err: any) { setQueueError(err.message); }
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
          body: JSON.stringify({ name: categoryForm.name, category_slug: categoryForm.category_slug }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create category");
      setCategorySuccess(`"${data.category.name}" created successfully.`);
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
    } catch (err: any) { setUserError(err.message); }
    finally { setUserSearching(false); }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) throw new Error("Failed to update role");
      setUserResults((prev) => prev.map((u) => u.id === userId ? { ...u, role: newRole } : u));
    } catch (err: any) { setUserError(err.message); }
  };

  const handleAssignModerator = async (userId: string, gameSlug: string) => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/users/${userId}/moderate/${gameSlug}`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error("Failed to assign moderator");
      setUserResults((prev) => prev.map((u) => {
        if (u.id !== userId) return u;
        const game = games.find((g) => g.slug === gameSlug)!;
        return { ...u, moderated_games: [...u.moderated_games, { game_id: game.id, game: { id: game.id, name: game.name, slug: game.slug } }] };
      }));
    } catch (err: any) { setUserError(err.message); }
  };

  const handleRemoveModerator = async (userId: string, gameSlug: string, gameId: string) => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/users/${userId}/moderate/${gameSlug}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error("Failed to remove moderator");
      setUserResults((prev) => prev.map((u) => {
        if (u.id !== userId) return u;
        return { ...u, moderated_games: u.moderated_games.filter((mg) => mg.game_id !== gameId) };
      }));
    } catch (err: any) { setUserError(err.message); }
  };

  if (authLoading) return null;
  if (!user || user.role !== "admin") return null;

  const selectedGamePlatforms = games.find((g) => g.slug === categoryForm.game_slug)?.platforms || [];

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

        {/* ── Games Tab ── */}
        {activeTab === "games" && (
          <div
            className="admin-grid"
            style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))", gap: "2rem", alignItems: "start" }}
          >
            {/* Column 1: Create Game Wizard */}
            <div className="admin-col">
              <CreateGameWizard onDoneAction={(game) => {
                setGames((prev) => [...prev, { ...game, platforms: [] }]);
              }} />
            </div>

            {/* Column 2: Add Category + Add Variable */}
            <div className="admin-col">

              {/* Add Category */}
              <div className="profile-section" style={{ marginBottom: "2rem" }}>
                <h2 className="profile-section-title">🏆 Add Category</h2>
                <form onSubmit={handleAddCategory}>
                  <div className="form-group">
                    <label className="form-label">Game & Platform</label>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <select
                        className="auth-input"
                        value={categoryForm.game_slug}
                        onChange={(e) => setCategoryForm({ ...categoryForm, game_slug: e.target.value, platform_slug: "" })}
                        required
                      >
                        <option value="">Select Game</option>
                        {games.map((g) => <option key={g.id} value={g.slug}>{g.name}</option>)}
                      </select>
                      <select
                        className="auth-input"
                        value={categoryForm.platform_slug}
                        onChange={(e) => setCategoryForm({ ...categoryForm, platform_slug: e.target.value })}
                        required
                        disabled={!categoryForm.game_slug}
                      >
                        <option value="">Select Platform</option>
                        {selectedGamePlatforms.map((p) => <option key={p.id} value={p.slug}>{p.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
                    <div style={{ flex: 2 }}>
                      <label className="form-label">Category Name</label>
                      <input
                        className="auth-input"
                        placeholder="e.g. Any%, 100%"
                        value={categoryForm.name}
                        onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                        required
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className="form-label">Slug</label>
                      <input
                        className="auth-input"
                        placeholder="any"
                        value={categoryForm.category_slug}
                        onChange={(e) => setCategoryForm({ ...categoryForm, category_slug: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  {categoryError && <p className="auth-error">{categoryError}</p>}
                  {categorySuccess && <p className="auth-success">{categorySuccess}</p>}
                  <button className="btn btn-primary btn-full" type="submit" disabled={categorySubmitting}>
                    {categorySubmitting ? "Creating..." : "Create Category"}
                  </button>
                </form>
              </div>

              {/* Add Variable */}
              <div className="profile-section">
                <h2 className="profile-section-title">⚙️ Add Variable to Category</h2>
                <VariableForm games={games} token={token} />
              </div>

            </div>
          </div>
        )}

        {/* ── Runs Tab ── */}
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
                  <div key={run.id} style={{ padding: "1rem", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "4px", marginBottom: "1rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
                      <div>
                        <div style={{ fontWeight: "bold", marginBottom: "0.25rem" }}>
                          {run.user.display_name || run.user.username}
                          {run.user.country && (
                            <span className="runner-country">{countryCodeToFlag(run.user.country)}</span>
                          )}
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
                          <div style={{ fontSize: "0.8rem", opacity: 0.6, marginTop: "0.25rem" }}>"{run.comment}"</div>
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
                        <button className="btn btn-primary" style={{ fontSize: "0.85rem", padding: "0.4rem 0.8rem" }} onClick={() => handleVerifyRun(run.id)}>
                          ✓ Verify
                        </button>
                        <button className="btn" style={{ fontSize: "0.85rem", padding: "0.4rem 0.8rem", color: "#ff4444", borderColor: "#ff4444" }} onClick={() => setRejectRunId(rejectRunId === run.id ? null : run.id)}>
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
                        <button className="btn" style={{ color: "#ff4444", borderColor: "#ff4444", whiteSpace: "nowrap" }} onClick={() => handleRejectRun(run.id)}>
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

        {/* ── Users Tab ── */}
        {activeTab === "users" && (
          <div style={{ maxWidth: "600px", margin: "0 auto" }}>
            <div className="profile-section">
              <h2 className="profile-section-title">Search Users</h2>
              <form onSubmit={handleUserSearch}>
                <div className="form-group">
                  <label className="form-label">Username</label>
                  <input
                    className="auth-input"
                    placeholder="Search by username..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    required
                  />
                </div>
                {userError && <p className="auth-error">{userError}</p>}
                <button className="btn btn-primary btn-full" type="submit" disabled={userSearching}>
                  {userSearching ? "Searching..." : "Search"}
                </button>
              </form>

              {userResults.map((u) => (
                <div key={u.id} style={{ padding: "1rem", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "4px", marginBottom: "1rem", marginTop: "1rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                    <div>
                      <div style={{ fontWeight: "bold" }}>{u.display_name || u.username}</div>
                      <div style={{ fontSize: "0.8rem", opacity: 0.6 }}>@{u.username} · {u.email}</div>
                      <div style={{ fontSize: "0.8rem", opacity: 0.6 }}>Role: {u.role}</div>
                    </div>
                    <select
                      className="auth-input"
                      style={{ width: "auto" }}
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.id, e.target.value)}
                    >
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
                        <span key={mg.game_id} style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", padding: "0.2rem 0.6rem", background: "rgba(255,255,255,0.1)", borderRadius: "4px", fontSize: "0.8rem" }}>
                          {mg.game.name}
                          <button
                            onClick={() => handleRemoveModerator(u.id, mg.game.slug, mg.game_id)}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "#ff4444", fontSize: "0.9rem" }}
                          >×</button>
                        </span>
                      ))}
                    </div>
                    <select
                      className="auth-input"
                      style={{ width: "100%" }}
                      defaultValue=""
                      onChange={(e) => { if (e.target.value) handleAssignModerator(u.id, e.target.value); e.target.value = ""; }}
                    >
                      <option value="">Assign to game...</option>
                      {games
                        .filter((g) => !u.moderated_games.find((mg) => mg.game.slug === g.slug))
                        .map((g) => <option key={g.id} value={g.slug}>{g.name}</option>)}
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