"use client";
import { useState, useEffect } from "react";
import { useAuth } from "../components/auth/AuthContext";
import { useRouter } from "next/navigation";
import { countryCodeToFlag } from "../lib/flags";
import CreateGameWizard from "../components/admin/Creategamewizard";
import VariableForm from "../components/admin/VariableForm";
import DependencyForm from "../components/admin/DependencyForm";

type GameTab = "create" | "categories" | "variables" | "dependencies";

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
  game_slug: string;
  category: string;
  level: string | null;
  subcategory: string | null;
  variable_values: {
    variable: string;
    variable_slug: string;
    value: string;
    value_slug: string;
  }[];
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
  return str
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
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
  const [activeGameTab, setActiveGameTab] = useState<GameTab>("create");

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
    if (!user) {
      router.push("/login");
      return;
    }
    if (user.role !== "admin") {
      router.push("/");
      return;
    }
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
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ verified: true }),
        },
      );
      if (!res.ok) throw new Error("Failed to verify run");
      setQueueRuns((prev) => prev.filter((r) => r.id !== runId));
    } catch (err: any) {
      setQueueError(err.message);
    }
  };

  const handleRejectRun = async (runId: string) => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/moderation/runs/${runId}/verify`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            verified: false,
            rejected: true,
            reject_reason: rejectReason,
          }),
        },
      );
      if (!res.ok) throw new Error("Failed to reject run");
      setQueueRuns((prev) => prev.filter((r) => r.id !== runId));
      setRejectRunId(null);
      setRejectReason("");
    } catch (err: any) {
      setQueueError(err.message);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setCategoryError("");
    setCategorySuccess("");
    setCategorySubmitting(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/games/${categoryForm.game_slug}/${categoryForm.platform_slug}/categories`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: categoryForm.name,
            category_slug: categoryForm.category_slug,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create category");
      setCategorySuccess(`"${data.category.name}" created successfully.`);
      setCategoryForm({
        game_slug: "",
        platform_slug: "",
        name: "",
        category_slug: "",
      });
    } catch (err: any) {
      setCategoryError(err.message);
    } finally {
      setCategorySubmitting(false);
    }
  };

  const handleUserSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserError("");
    setUserSearching(true);
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
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/users/${userId}/role`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ role: newRole }),
        },
      );
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
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/users/${userId}/moderate/${gameSlug}`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error("Failed to assign moderator");
      setUserResults((prev) =>
        prev.map((u) => {
          if (u.id !== userId) return u;
          const game = games.find((g) => g.slug === gameSlug)!;
          return {
            ...u,
            moderated_games: [
              ...u.moderated_games,
              {
                game_id: game.id,
                game: { id: game.id, name: game.name, slug: game.slug },
              },
            ],
          };
        }),
      );
    } catch (err: any) {
      setUserError(err.message);
    }
  };

  const handleRemoveModerator = async (
    userId: string,
    gameSlug: string,
    gameId: string,
  ) => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/users/${userId}/moderate/${gameSlug}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error("Failed to remove moderator");
      setUserResults((prev) =>
        prev.map((u) => {
          if (u.id !== userId) return u;
          return {
            ...u,
            moderated_games: u.moderated_games.filter(
              (mg) => mg.game_id !== gameId,
            ),
          };
        }),
      );
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

        {/* ── Games Tab ── */}
        {activeTab === "games" && (
          <div style={{ maxWidth: "600px", margin: "0 auto" }}>
            {/* Inner tabs */}
            <div className="leaderboard-tabs" style={{ marginBottom: "2rem" }}>
              {(
                [
                  { key: "create", label: "Create Game" },
                  { key: "categories", label: "Add Category" },
                  { key: "variables", label: "Add Variable" },
                  { key: "dependencies", label: "Set Dependencies" },
                ] as { key: GameTab; label: string }[]
              ).map(({ key, label }) => (
                <button
                  key={key}
                  className={`leaderboard-tab ${activeGameTab === key ? "active" : ""}`}
                  onClick={() => setActiveGameTab(key)}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Create Game */}
            {activeGameTab === "create" && (
              <div className="profile-section">
                <h2 className="profile-section-title">🎮 Create Game</h2>
                <CreateGameWizard
                  onDoneAction={(game) => {
                    setGames((prev) => [...prev, { ...game, platforms: [] }]);
                  }}
                />
              </div>
            )}

            {/* Add Category */}
            {activeGameTab === "categories" && (
              <div className="profile-section">
                <h2 className="profile-section-title">🏆 Add Category</h2>
                <form onSubmit={handleAddCategory}>
                  <div className="form-group">
                    <label className="form-label">Game & Platform</label>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <select
                        className="auth-input"
                        value={categoryForm.game_slug}
                        onChange={(e) =>
                          setCategoryForm({
                            ...categoryForm,
                            game_slug: e.target.value,
                            platform_slug: "",
                          })
                        }
                        required
                      >
                        <option value="">Select Game</option>
                        {games.map((g) => (
                          <option key={g.id} value={g.slug}>
                            {g.name}
                          </option>
                        ))}
                      </select>
                      <select
                        className="auth-input"
                        value={categoryForm.platform_slug}
                        onChange={(e) =>
                          setCategoryForm({
                            ...categoryForm,
                            platform_slug: e.target.value,
                          })
                        }
                        required
                        disabled={!categoryForm.game_slug}
                      >
                        <option value="">Select Platform</option>
                        {selectedGamePlatforms.map((p) => (
                          <option key={p.id} value={p.slug}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: "1rem",
                      marginBottom: "1rem",
                    }}
                  >
                    <div style={{ flex: 2 }}>
                      <label className="form-label">Category Name</label>
                      <input
                        className="auth-input"
                        placeholder="e.g. Any%, 100%"
                        value={categoryForm.name}
                        onChange={(e) =>
                          setCategoryForm({
                            ...categoryForm,
                            name: e.target.value,
                            category_slug: slugify(e.target.value),
                          })
                        }
                        required
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className="form-label">Slug</label>
                      <input
                        className="auth-input"
                        placeholder="any"
                        value={categoryForm.category_slug}
                        onChange={(e) =>
                          setCategoryForm({
                            ...categoryForm,
                            category_slug: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                  </div>
                  {categoryError && (
                    <p className="auth-error">{categoryError}</p>
                  )}
                  {categorySuccess && (
                    <p className="auth-success">{categorySuccess}</p>
                  )}
                  <button
                    className="btn btn-primary btn-full"
                    type="submit"
                    disabled={categorySubmitting}
                  >
                    {categorySubmitting ? "Creating..." : "Create Category"}
                  </button>
                </form>
              </div>
            )}

            {/* Add Variable */}
            {activeGameTab === "variables" && (
              <div className="profile-section">
                <h2 className="profile-section-title">⚙️ Add Variable</h2>
                <VariableForm games={games} token={token} />
              </div>
            )}
          </div>
        )}
        {/* {Add Dependencies} */}
        {activeGameTab === "dependencies" && (
          <div className="profile-section">
            <h2 className="profile-section-title">🔗 Set Dependencies</h2>
            <DependencyForm games={games} token={token} />
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
                <p style={{ opacity: 0.6, textAlign: "center" }}>
                  No pending runs.
                </p>
              ) : (
                queueRuns.map((run) => (
                  <div
                    key={run.id}
                    style={{
                      padding: "1rem",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "4px",
                      marginBottom: "1rem",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: "1rem",
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontWeight: "bold",
                            marginBottom: "0.25rem",
                          }}
                        >
                          {run.is_coop && run.runners ? (
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "0.25rem",
                              }}
                            >
                              {run.runners.map((r) => (
                                <span key={r.id}>
                                  {r.country && (
                                    <span className="runner-country">
                                      {countryCodeToFlag(r.country)}
                                    </span>
                                  )}
                                  {r.display_name || r.username}
                                </span>
                              ))}
                            </div>
                          ) : run.user ? (
                            <span>
                              {run.user.country && (
                                <span className="runner-country">
                                  {countryCodeToFlag(run.user.country)}
                                </span>
                              )}
                              {run.user.display_name || run.user.username}
                            </span>
                          ) : null}
                        </div>
                        <div style={{ fontSize: "0.85rem", opacity: 0.7 }}>
                          {run.game} · {run.platform} · {run.category}
                        </div>
                        <div style={{ fontSize: "0.85rem", opacity: 0.7 }}>
</div>
{run.variable_values?.length > 0 && (
  <div style={{ fontSize: "0.85rem", opacity: 0.7, marginTop: "0.25rem" }}>
    {run.variable_values.map((v) => (
      <span key={v.variable_slug} style={{ marginRight: "0.75rem" }}>
        <span style={{ opacity: 0.5 }}>{v.variable}:</span> {v.value}
      </span>
    ))}
  </div>
)}
                        <div
                          style={{ fontSize: "0.85rem", marginTop: "0.25rem" }}
                        >
                          {run.timing_method === "gametime"
                            ? run.gametime_display ||
                              run.realtime_display ||
                              "—"
                            : run.realtime_display || "—"}
                        </div>
                        {run.comment && (
                          <div
                            style={{
                              fontSize: "0.8rem",
                              opacity: 0.6,
                              marginTop: "0.25rem",
                            }}
                          >
                            "{run.comment}"
                          </div>
                        )}
                        <div
                          style={{
                            fontSize: "0.75rem",
                            opacity: 0.5,
                            marginTop: "0.25rem",
                          }}
                        >
                          {new Date(run.submitted_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: "0.5rem",
                          alignItems: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        {run.video_url && (
                          <a
                            href={run.video_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn"
                            style={{
                              fontSize: "0.85rem",
                              padding: "0.4rem 0.8rem",
                            }}
                          >
                            ▶ Watch
                          </a>
                        )}
                        <button
                          className="btn btn-primary"
                          style={{
                            fontSize: "0.85rem",
                            padding: "0.4rem 0.8rem",
                          }}
                          onClick={() => handleVerifyRun(run.id)}
                        >
                          ✓ Verify
                        </button>
                        <button
                          className="btn"
                          style={{
                            fontSize: "0.85rem",
                            padding: "0.4rem 0.8rem",
                            color: "#ff4444",
                            borderColor: "#ff4444",
                          }}
                          onClick={() =>
                            setRejectRunId(
                              rejectRunId === run.id ? null : run.id,
                            )
                          }
                        >
                          ✕ Reject
                        </button>
                      </div>
                    </div>
                    {rejectRunId === run.id && (
                      <div
                        style={{
                          marginTop: "1rem",
                          display: "flex",
                          gap: "0.5rem",
                        }}
                      >
                        <input
                          className="auth-input"
                          placeholder="Reason for rejection..."
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          style={{ flex: 1 }}
                        />
                        <button
                          className="btn"
                          style={{
                            color: "#ff4444",
                            borderColor: "#ff4444",
                            whiteSpace: "nowrap",
                          }}
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
                <button
                  className="btn btn-primary btn-full"
                  type="submit"
                  disabled={userSearching}
                >
                  {userSearching ? "Searching..." : "Search"}
                </button>
              </form>

              {userResults.map((u) => (
                <div
                  key={u.id}
                  style={{
                    padding: "1rem",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "4px",
                    marginBottom: "1rem",
                    marginTop: "1rem",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "1rem",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: "bold" }}>
                        {u.display_name || u.username}
                      </div>
                      <div style={{ fontSize: "0.8rem", opacity: 0.6 }}>
                        @{u.username} · {u.email}
                      </div>
                      <div style={{ fontSize: "0.8rem", opacity: 0.6 }}>
                        Role: {u.role}
                      </div>
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
                    <div
                      style={{
                        fontSize: "0.85rem",
                        opacity: 0.7,
                        marginBottom: "0.5rem",
                      }}
                    >
                      Moderates:
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "0.5rem",
                        marginBottom: "0.75rem",
                      }}
                    >
                      {u.moderated_games.length === 0 && (
                        <span style={{ fontSize: "0.8rem", opacity: 0.5 }}>
                          No games assigned
                        </span>
                      )}
                      {u.moderated_games.map((mg) => (
                        <span
                          key={mg.game_id}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.4rem",
                            padding: "0.2rem 0.6rem",
                            background: "rgba(255,255,255,0.1)",
                            borderRadius: "4px",
                            fontSize: "0.8rem",
                          }}
                        >
                          {mg.game.name}
                          <button
                            onClick={() =>
                              handleRemoveModerator(
                                u.id,
                                mg.game.slug,
                                mg.game_id,
                              )
                            }
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              color: "#ff4444",
                              fontSize: "0.9rem",
                            }}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                    <select
                      className="auth-input"
                      style={{ width: "100%" }}
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value)
                          handleAssignModerator(u.id, e.target.value);
                        e.target.value = "";
                      }}
                    >
                      <option value="">Assign to game...</option>
                      {games
                        .filter(
                          (g) =>
                            !u.moderated_games.find(
                              (mg) => mg.game.slug === g.slug,
                            ),
                        )
                        .map((g) => (
                          <option key={g.id} value={g.slug}>
                            {g.name}
                          </option>
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
