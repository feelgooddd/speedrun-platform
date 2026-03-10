"use client";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "../auth/AuthContext";
import Link from "next/link";

interface Game {
  id: string;
  slug: string;
  name: string;
}

interface Platform {
  id: string;
  slug: string;
  name: string;
  timing_method: string;
}

interface VariableValue {
  id: string;
  variable_id: string;
  name: string;
  slug: string;
  is_coop: boolean;
  required_players: number | null;
}

interface Variable {
  id: string;
  slug: string;
  name: string;
  is_subcategory: boolean;
  values: VariableValue[];
}

interface Category {
  id: string;
  slug: string;
  name: string;
  variables: Variable[];
}

interface Runner {
  id: string;
  username: string;
  display_name: string | null;
  country: string | null;
}

export default function SubmitFullGameRun() {
  const { user, loading, token } = useAuth();

  const [games, setGames] = useState<Game[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [systems, setSystems] = useState<{ id: string; name: string }[]>([]);

  const [selectedGame, setSelectedGame] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  // Map of variable_id -> selected VariableValue id
  const [selectedVariableValues, setSelectedVariableValues] = useState<
    Record<string, string>
  >({});
  const [selectedSystem, setSelectedSystem] = useState("");

  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const [seconds, setSeconds] = useState("");
  const [milliseconds, setMilliseconds] = useState("");

  const [igtHours, setIgtHours] = useState("");
  const [igtMinutes, setIgtMinutes] = useState("");
  const [igtSeconds, setIgtSeconds] = useState("");
  const [igtMilliseconds, setIgtMilliseconds] = useState("");

  const [videoUrl, setVideoUrl] = useState("");
  const [comment, setComment] = useState("");

  // Co-op runner state
  const [runners, setRunners] = useState<Runner[]>([]);
  const [runnerSearch, setRunnerSearch] = useState("");
  const [runnerResults, setRunnerResults] = useState<Runner[]>([]);
  const [searchingRunners, setSearchingRunners] = useState(false);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // ----------------------------------------------------------------
  // Derived state
  // ----------------------------------------------------------------
  const selectedPlatformData = platforms.find(
    (p) => p.slug === selectedPlatform,
  );
  const isGametime = selectedPlatformData?.timing_method === "gametime";
  const selectedCategoryData = categories.find(
    (c) => c.slug === selectedCategory,
  );

  // Only variables with is_subcategory: true are shown as dropdowns
  const subcategoryVariables =
    selectedCategoryData?.variables.filter((v) => v.is_subcategory) ?? [];

  // Get all selected VariableValue objects
  const selectedValueObjects: VariableValue[] = subcategoryVariables
    .map((v) => {
      const valueId = selectedVariableValues[v.id];
      return v.values.find((val) => val.id === valueId);
    })
    .filter((v): v is VariableValue => v !== undefined);

  // A run is co-op if ANY selected variable value has is_coop: true
  const isCoop = selectedValueObjects.some((v) => v.is_coop);

  // required_players comes from the co-op value (take the max if multiple)
  const requiredPlayers =
    selectedValueObjects
      .filter((v) => v.is_coop && v.required_players)
      .reduce((max, v) => Math.max(max, v.required_players ?? 0), 0) || null;

  // Reset variable selections when category changes
  useEffect(() => {
    setSelectedVariableValues({});
  }, [selectedCategory]);

  // Pre-populate submitter as first runner when co-op is selected
  useEffect(() => {
    if (isCoop && user) {
      setRunners((prev) => {
        if (prev.some((r) => r.id === user.id)) return prev;
        return [
          {
            id: user.id,
            username: user.username,
            display_name: user.display_name ?? null,
            country: user.country ?? null,
          },
          ...prev.filter((r) => r.id !== user.id),
        ];
      });
    } else {
      setRunners([]);
    }
  }, [isCoop]);

  // Debounced runner search
  useEffect(() => {
    if (!runnerSearch.trim() || runnerSearch.length < 2) {
      setRunnerResults([]);
      return;
    }
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      setSearchingRunners(true);
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/users/search?q=${encodeURIComponent(runnerSearch)}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const data = await res.json();
        const filtered = (data.users || []).filter(
          (u: Runner) => !runners.some((r) => r.id === u.id),
        );
        setRunnerResults(filtered);
      } catch {
        setRunnerResults([]);
      } finally {
        setSearchingRunners(false);
      }
    }, 300);
  }, [runnerSearch]);

  const addRunner = (runner: Runner) => {
    if (requiredPlayers && runners.length >= requiredPlayers) return;
    setRunners((prev) => [...prev, runner]);
    setRunnerSearch("");
    setRunnerResults([]);
  };

  const removeRunner = (id: string) => {
    if (id === user?.id) return;
    setRunners((prev) => prev.filter((r) => r.id !== id));
  };

  // ----------------------------------------------------------------
  // Data fetching
  // ----------------------------------------------------------------
  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/games`)
      .then((res) => res.json())
      .then((data) => setGames(data))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedGame) {
      setPlatforms([]);
      setCategories([]);
      return;
    }
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/games/${selectedGame}`)
      .then((res) => res.json())
      .then((data) => setPlatforms(data.platforms || []))
      .catch(console.error);
  }, [selectedGame]);

  useEffect(() => {
    if (!selectedGame || !selectedPlatform) {
      setCategories([]);
      return;
    }
    fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/games/${selectedGame}/${selectedPlatform}/categories`,
    )
      .then((res) => res.json())
      .then((data) => setCategories(data.categories || []))
      .catch(console.error);
  }, [selectedGame, selectedPlatform]);

  useEffect(() => {
    if (!selectedGame || !selectedPlatform) {
      setSystems([]);
      setSelectedSystem("");
      return;
    }
    fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/games/${selectedGame}/${selectedPlatform}/systems`,
    )
      .then((res) => res.json())
      .then((data) => setSystems(data.systems || []))
      .catch(console.error);
  }, [selectedGame, selectedPlatform]);

  useEffect(() => {
    if (!isGametime) {
      setIgtHours("");
      setIgtMinutes("");
      setIgtSeconds("");
      setIgtMilliseconds("");
    }
  }, [isGametime]);

  // ----------------------------------------------------------------
  // Submit
  // ----------------------------------------------------------------
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setError("");
  setSuccess(false);

  const rta =
    parseInt(hours || "0") * 3600000 +
    parseInt(minutes || "0") * 60000 +
    parseInt(seconds || "0") * 1000 +
    parseInt(milliseconds || "0");

  if (rta <= 0) {
    setError("Please enter a valid RTA time");
    return;
  }
  if (!videoUrl) {
    setError("Video URL is required");
    return;
  }

  if (isCoop) {
    if (requiredPlayers && runners.length !== requiredPlayers) {
      setError(`This category requires exactly ${requiredPlayers} runners`);
      return;
    } else if (!requiredPlayers && runners.length < 2) {
      setError("Co-op runs require at least 2 runners");
      return;
    }
  }

  const variable_values = subcategoryVariables
    .filter((v) => selectedVariableValues[v.id])
    .map((v) => {
      const valueId = selectedVariableValues[v.id];
      const value = v.values.find((val) => val.id === valueId);
      return { variable_slug: v.slug, value_slug: value?.slug };
    })
    .filter((v) => v.value_slug);

  const igt =
    parseInt(igtHours || "0") * 3600000 +
    parseInt(igtMinutes || "0") * 60000 +
    parseInt(igtSeconds || "0") * 1000 +
    parseInt(igtMilliseconds || "0");

  const finalIgt = isGametime && igt <= 0 ? rta : igt;

  setSubmitting(true);

  try {
    const endpoint = `${process.env.NEXT_PUBLIC_API_URL}/runs`;

    const body = {
      game_slug: selectedGame,
      platform_slug: selectedPlatform,
      category_slug: selectedCategory,
      variable_values,
      realtime_ms: rta,
      gametime_ms: finalIgt > 0 ? finalIgt : null,
      video_url: videoUrl,
      comment,
      system_id: selectedSystem || undefined,
      ...(isCoop && { runner_ids: runners.map((r) => r.id) }),
    };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to submit run");

    setSuccess(true);
    setSelectedGame("");
    setSelectedPlatform("");
    setSelectedCategory("");
    setSelectedVariableValues({});
    setHours("");
    setMinutes("");
    setSeconds("");
    setMilliseconds("");
    setIgtHours("");
    setIgtMinutes("");
    setIgtSeconds("");
    setIgtMilliseconds("");
    setVideoUrl("");
    setComment("");
    setSelectedSystem("");
    setRunners([]);
  } catch (err: any) {
    setError(err.message);
  } finally {
    setSubmitting(false);
  }
};

  if (loading) return null;

  if (!user) {
    return (
      <div className="landing">
        <div className="section" style={{ paddingTop: "6rem" }}>
          <div className="section-header">
            <h1 className="section-title">Submit Run</h1>
            <p className="section-subtitle">
              You must be logged in to submit runs
            </p>
          </div>
          <div style={{ textAlign: "center", marginTop: "2rem" }}>
            <Link href="/login" className="btn btn-primary">
              Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="landing">
      <div className="section" style={{ paddingTop: "6rem" }}>
        <div className="section-header">
          <h1 className="section-title">Submit Run</h1>
          <p className="section-subtitle">
            Submit your speedrun for verification
          </p>
        </div>

        <div style={{ maxWidth: "600px", margin: "0 auto" }}>
          {success && (
            <div
              style={{
                padding: "1rem",
                marginBottom: "2rem",
                background: "rgba(0,255,0,0.1)",
                border: "1px solid rgba(0,255,0,0.3)",
                borderRadius: "4px",
                color: "var(--accent)",
                textAlign: "center",
              }}
            >
              ✓ Run submitted successfully! Awaiting verification.
            </div>
          )}
          {error && (
            <div
              style={{
                padding: "1rem",
                marginBottom: "2rem",
                background: "rgba(255,0,0,0.1)",
                border: "1px solid rgba(255,0,0,0.3)",
                borderRadius: "4px",
                color: "#ff4444",
                textAlign: "center",
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Game */}
            <div className="form-group">
              <label className="form-label">Game *</label>
              <select
                value={selectedGame}
                onChange={(e) => {
                  setSelectedGame(e.target.value);
                  setSelectedPlatform("");
                  setSelectedCategory("");
                  setSelectedVariableValues({});
                }}
                required
                className="auth-input"
              >
                <option value="">Select a game</option>
                {games.map((game) => (
                  <option key={game.id} value={game.slug}>
                    {game.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Platform */}
            {selectedGame && (
              <div className="form-group">
                <label className="form-label">Platform *</label>
                <select
                  value={selectedPlatform}
                  onChange={(e) => {
                    setSelectedPlatform(e.target.value);
                    setSelectedCategory("");
                    setSelectedVariableValues({});
                  }}
                  required
                  className="auth-input"
                >
                  <option value="">Select a platform</option>
                  {platforms.map((platform) => (
                    <option key={platform.id} value={platform.slug}>
                      {platform.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Category */}
            {selectedPlatform && (
              <div className="form-group">
                <label className="form-label">Category *</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value);
                    setSelectedVariableValues({});
                  }}
                  required
                  className="auth-input"
                >
                  <option value="">Select a category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.slug}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Variable dropdowns (one per is_subcategory variable) */}
            {subcategoryVariables.map((variable) => (
              <div key={variable.id} className="form-group">
                <label className="form-label">{variable.name} *</label>
                <select
                  value={selectedVariableValues[variable.id] || ""}
                  onChange={(e) =>
                    setSelectedVariableValues((prev) => ({
                      ...prev,
                      [variable.id]: e.target.value,
                    }))
                  }
                  required
                  className="auth-input"
                >
                  <option value="">Select {variable.name}</option>
                  {variable.values.map((val) => (
                    <option key={val.id} value={val.id}>
                      {val.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}

            {/* Co-op runners */}
            {isCoop && (
              <div className="runners-form-group">
                <label className="form-label">
                  Runners *{" "}
                  {requiredPlayers && `(${runners.length}/${requiredPlayers})`}
                </label>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "0.5rem",
                    marginBottom: "0.75rem",
                  }}
                >
                  {runners.map((r) => (
                    <div
                      key={r.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.4rem",
                        padding: "0.3rem 0.6rem",
                        background: "var(--card-bg)",
                        border: "1px solid var(--card-border)",
                        borderRadius: "4px",
                        fontSize: "0.85rem",
                      }}
                    >
                      <span>{r.display_name || r.username}</span>
                      {r.id !== user.id ? (
                        <button
                          type="button"
                          onClick={() => removeRunner(r.id)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "#888",
                            cursor: "pointer",
                            padding: "0",
                            fontSize: "0.9rem",
                            lineHeight: 1,
                          }}
                        >
                          ✕
                        </button>
                      ) : (
                        <span style={{ color: "#555", fontSize: "0.75rem" }}>
                          (you)
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                {(!requiredPlayers || runners.length < requiredPlayers) && (
                  <div className="runner-search-wrapper">
                    <input
                      type="text"
                      placeholder="Search for a runner by username..."
                      value={runnerSearch}
                      onChange={(e) => setRunnerSearch(e.target.value)}
                      className="auth-input"
                    />
                    {(runnerResults.length > 0 || searchingRunners) && (
                      <div className="runner-search-dropdown">
                        {searchingRunners ? (
                          <div
                            style={{
                              padding: "0.75rem",
                              color: "#555",
                              fontSize: "0.85rem",
                            }}
                          >
                            Searching...
                          </div>
                        ) : (
                          runnerResults.map((r) => (
                            <div
                              key={r.id}
                              onClick={() => addRunner(r)}
                              style={{
                                padding: "0.6rem 0.75rem",
                                cursor: "pointer",
                                fontSize: "0.9rem",
                                borderBottom: "1px solid var(--card-border)",
                              }}
                              onMouseEnter={(e) =>
                                (e.currentTarget.style.background =
                                  "rgba(255,255,255,0.05)")
                              }
                              onMouseLeave={(e) =>
                                (e.currentTarget.style.background =
                                  "transparent")
                              }
                            >
                              {r.display_name || r.username}
                              <span
                                style={{
                                  color: "#555",
                                  fontSize: "0.8rem",
                                  marginLeft: "0.4rem",
                                }}
                              >
                                @{r.username}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* System */}
            {systems.length > 0 && (
              <div className="form-group">
                <label className="form-label">System *</label>
                <select
                  value={selectedSystem}
                  onChange={(e) => setSelectedSystem(e.target.value)}
                  required
                  className="auth-input"
                >
                  <option value="">Select a system</option>
                  {systems.map((system) => (
                    <option key={system.id} value={system.id}>
                      {system.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Timing */}
            {selectedPlatform && (
              <>
                <div className="form-group">
                  <label className="form-label">Real Time Attack (RTA) *</label>
                  <div className="time-input-group">
                    <input
                      type="number"
                      placeholder="HH"
                      value={hours}
                      onChange={(e) => setHours(e.target.value)}
                      className="auth-input"
                    />
                    <span className="time-separator">:</span>
                    <input
                      type="number"
                      placeholder="MM"
                      value={minutes}
                      onChange={(e) => setMinutes(e.target.value)}
                      className="auth-input"
                    />
                    <span className="time-separator">:</span>
                    <input
                      type="number"
                      placeholder="SS"
                      value={seconds}
                      onChange={(e) => setSeconds(e.target.value)}
                      className="auth-input"
                    />
                    <span className="time-separator">.</span>
                    <input
                      type="number"
                      placeholder="MS"
                      value={milliseconds}
                      onChange={(e) => setMilliseconds(e.target.value)}
                      className="auth-input"
                    />
                  </div>
                </div>

                <div
                  className="form-group"
                  style={{
                    opacity: isGametime ? 1 : 0.4,
                    pointerEvents: isGametime ? "auto" : "none",
                  }}
                >
                  <label className="form-label">
                    In-Game Time (IGT){" "}
                    {isGametime ? "*" : "— N/A for this platform"}
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
                      value={igtMilliseconds}
                      onChange={(e) => setIgtMilliseconds(e.target.value)}
                      className="auth-input"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Video + Comment */}
            <div className="form-group">
              <label className="form-label">Video URL *</label>
              <input
                type="url"
                placeholder="https://youtube.com/watch?v=..."
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                required
                className="auth-input"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Comment (optional)</label>
              <textarea
                placeholder="Any additional notes about this run..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={4}
                className="auth-input"
                style={{ resize: "vertical", fontFamily: "inherit" }}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-full"
              disabled={submitting}
            >
              {submitting ? "Submitting..." : "Submit Run"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
