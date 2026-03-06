"use client";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "../components/auth/AuthContext";
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

interface Category {
  id: string;
  slug: string;
  name: string;
  subcategories?: Subcategory[];
}

interface Subcategory {
  id: string;
  slug: string;
  name: string;
  is_coop: boolean;
}

interface Runner {
  id: string;
  username: string;
  display_name: string | null;
  country: string | null;
}

export default function SubmitRunPage() {
  const { user, loading } = useAuth();

  const [games, setGames] = useState<Game[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [systems, setSystems] = useState<{ id: string; name: string }[]>([]);

  const [selectedGame, setSelectedGame] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedSubcategory, setSelectedSubcategory] = useState("");
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

  const selectedPlatformData = platforms.find((p) => p.slug === selectedPlatform);
  const isGametime = selectedPlatformData?.timing_method === "gametime";
  const selectedCategoryData = categories.find((c) => c.slug === selectedCategory);
  const hasSubcategories = selectedCategoryData?.subcategories && selectedCategoryData.subcategories.length > 0;
  const selectedSubcategoryData = selectedCategoryData?.subcategories?.find((s) => s.slug === selectedSubcategory);
  const isCoop = selectedSubcategoryData?.is_coop ?? false;

  // Pre-populate submitter as first runner when co-op subcategory is selected
  useEffect(() => {
    if (isCoop && user) {
      setRunners([
        {
          id: user.id,
          username: user.username,
          display_name: user.display_name ?? null,
          country: user.country ?? null,
        },
      ]);
    } else {
      setRunners([]);
    }
  }, [isCoop, selectedSubcategory]);

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
        const token = localStorage.getItem("token");
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/users/search?q=${encodeURIComponent(runnerSearch)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json();
        // Filter out already added runners
        const filtered = (data.users || []).filter(
          (u: Runner) => !runners.some((r) => r.id === u.id)
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
    setRunners((prev) => [...prev, runner]);
    setRunnerSearch("");
    setRunnerResults([]);
  };

  const removeRunner = (id: string) => {
    // Can't remove the submitter (first runner)
    if (id === user?.id) return;
    setRunners((prev) => prev.filter((r) => r.id !== id));
  };

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/games`)
      .then((res) => res.json())
      .then((data) => setGames(data))
      .catch((err) => console.error(err));
  }, []);

  useEffect(() => {
    if (!selectedGame) {
      setPlatforms([]);
      setCategories([]);
      return;
    }
    const game = games.find((g) => g.slug === selectedGame);
    if (!game) return;
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/games/${game.slug}`)
      .then((res) => res.json())
      .then((data) => setPlatforms(data.platforms || []))
      .catch((err) => console.error(err));
  }, [selectedGame, games]);

  useEffect(() => {
    if (!selectedGame || !selectedPlatform) {
      setCategories([]);
      return;
    }
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/games/${selectedGame}/${selectedPlatform}/categories`)
      .then((res) => res.json())
      .then((data) => setCategories(data.categories || []))
      .catch((err) => console.error(err));
  }, [selectedGame, selectedPlatform]);

  useEffect(() => {
    if (!selectedGame || !selectedPlatform) {
      setSystems([]);
      setSelectedSystem("");
      return;
    }
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/games/${selectedGame}/${selectedPlatform}/systems`)
      .then((res) => res.json())
      .then((data) => setSystems(data.systems || []))
      .catch((err) => console.error(err));
  }, [selectedGame, selectedPlatform]);

  useEffect(() => {
    if (!isGametime) {
      setIgtHours("");
      setIgtMinutes("");
      setIgtSeconds("");
      setIgtMilliseconds("");
    }
  }, [isGametime]);

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

    const igt =
      parseInt(igtHours || "0") * 3600000 +
      parseInt(igtMinutes || "0") * 60000 +
      parseInt(igtSeconds || "0") * 1000 +
      parseInt(igtMilliseconds || "0");

    if (!videoUrl) {
      setError("Video URL is required");
      return;
    }

    if (isCoop && runners.length < 2) {
      setError("Co-op runs require at least 2 runners");
      return;
    }

    setSubmitting(true);

    try {
      const token = localStorage.getItem("token");

      const endpoint = isCoop
        ? `${process.env.NEXT_PUBLIC_API_URL}/runs/coop`
        : `${process.env.NEXT_PUBLIC_API_URL}/runs`;

      const body = isCoop
        ? {
            game_slug: selectedGame,
            platform_slug: selectedPlatform,
            category_slug: selectedCategory,
            subcategory_slug: selectedSubcategory,
            realtime_ms: rta,
            gametime_ms: igt > 0 ? igt : null,
            video_url: videoUrl,
            comment,
            system_id: selectedSystem || undefined,
            runner_ids: runners.map((r) => r.id),
          }
        : {
            game_slug: selectedGame,
            platform_slug: selectedPlatform,
            category_slug: selectedCategory,
            subcategory_slug: selectedSubcategory || undefined,
            realtime_ms: rta,
            gametime_ms: igt > 0 ? igt : null,
            video_url: videoUrl,
            comment,
            system_id: selectedSystem || undefined,
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
      setSelectedSubcategory("");
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
            <p className="section-subtitle">You must be logged in to submit runs</p>
          </div>
          <div style={{ textAlign: "center", marginTop: "2rem" }}>
            <Link href="/login" className="btn btn-primary">Login</Link>
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
          <p className="section-subtitle">Submit your speedrun for verification</p>
        </div>

        <div style={{ maxWidth: "600px", margin: "0 auto" }}>
          {success && (
            <div style={{ padding: "1rem", marginBottom: "2rem", background: "rgba(0,255,0,0.1)", border: "1px solid rgba(0,255,0,0.3)", borderRadius: "4px", color: "var(--accent)", textAlign: "center" }}>
              ✓ Run submitted successfully! Awaiting verification.
            </div>
          )}

          {error && (
            <div style={{ padding: "1rem", marginBottom: "2rem", background: "rgba(255,0,0,0.1)", border: "1px solid rgba(255,0,0,0.3)", borderRadius: "4px", color: "#ff4444", textAlign: "center" }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Game *</label>
              <select value={selectedGame} onChange={(e) => setSelectedGame(e.target.value)} required className="auth-input">
                <option value="">Select a game</option>
                {games.map((game) => (
                  <option key={game.id} value={game.slug}>{game.name}</option>
                ))}
              </select>
            </div>

            {selectedGame && (
              <div className="form-group">
                <label className="form-label">Platform *</label>
                <select value={selectedPlatform} onChange={(e) => setSelectedPlatform(e.target.value)} required className="auth-input">
                  <option value="">Select a platform</option>
                  {platforms.map((platform) => (
                    <option key={platform.id} value={platform.slug}>{platform.name}</option>
                  ))}
                </select>
              </div>
            )}

            {selectedPlatform && (
              <div className="form-group">
                <label className="form-label">Category *</label>
                <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} required className="auth-input">
                  <option value="">Select a category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.slug}>{category.name}</option>
                  ))}
                </select>
              </div>
            )}

            {hasSubcategories && (
              <div className="form-group">
                <label className="form-label">Subcategory *</label>
                <select value={selectedSubcategory} onChange={(e) => setSelectedSubcategory(e.target.value)} required className="auth-input">
                  <option value="">Select a subcategory</option>
                  {selectedCategoryData?.subcategories?.map((sub) => (
                    <option key={sub.id} value={sub.slug}>{sub.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Co-op runners section */}
            {isCoop && (
              <div className="form-group">
                <label className="form-label">Runners *</label>

                {/* Added runners */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.75rem" }}>
                  {runners.map((r) => (
                    <div key={r.id} style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.3rem 0.6rem", background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: "4px", fontSize: "0.85rem" }}>
                      <span>{r.display_name || r.username}</span>
                      {r.id !== user.id && (
                        <button
                          type="button"
                          onClick={() => removeRunner(r.id)}
                          style={{ background: "none", border: "none", color: "#888", cursor: "pointer", padding: "0", fontSize: "0.9rem", lineHeight: 1 }}
                        >
                          ✕
                        </button>
                      )}
                      {r.id === user.id && (
                        <span style={{ color: "#555", fontSize: "0.75rem" }}>(you)</span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Runner search */}
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    placeholder="Search for a runner by username..."
                    value={runnerSearch}
                    onChange={(e) => setRunnerSearch(e.target.value)}
                    className="auth-input"
                  />
                  {(runnerResults.length > 0 || searchingRunners) && (
                    <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: "4px", zIndex: 10, maxHeight: "200px", overflowY: "auto" }}>
                      {searchingRunners ? (
                        <div style={{ padding: "0.75rem", color: "#555", fontSize: "0.85rem" }}>Searching...</div>
                      ) : (
                        runnerResults.map((r) => (
                          <div
                            key={r.id}
                            onClick={() => addRunner(r)}
                            style={{ padding: "0.6rem 0.75rem", cursor: "pointer", fontSize: "0.9rem", borderBottom: "1px solid var(--card-border)" }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}
                            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                          >
                            {r.display_name || r.username}
                            <span style={{ color: "#555", fontSize: "0.8rem", marginLeft: "0.4rem" }}>@{r.username}</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {systems.length > 0 && (
              <div className="form-group">
                <label className="form-label">System *</label>
                <select value={selectedSystem} onChange={(e) => setSelectedSystem(e.target.value)} required className="auth-input">
                  <option value="">Select a system</option>
                  {systems.map((system) => (
                    <option key={system.id} value={system.id}>{system.name}</option>
                  ))}
                </select>
              </div>
            )}

            {selectedPlatform && (
              <>
                <div className="form-group">
                  <label className="form-label">Real Time Attack (RTA) *</label>
                  <div className="time-input-group">
                    <input type="number" placeholder="HH" value={hours} onChange={(e) => setHours(e.target.value)} className="auth-input" />
                    <span className="time-separator">:</span>
                    <input type="number" placeholder="MM" value={minutes} onChange={(e) => setMinutes(e.target.value)} className="auth-input" />
                    <span className="time-separator">:</span>
                    <input type="number" placeholder="SS" value={seconds} onChange={(e) => setSeconds(e.target.value)} className="auth-input" />
                    <span className="time-separator">.</span>
                    <input type="number" placeholder="MS" value={milliseconds} onChange={(e) => setMilliseconds(e.target.value)} className="auth-input" />
                  </div>
                </div>

                <div className="form-group" style={{ opacity: isGametime ? 1 : 0.4, pointerEvents: isGametime ? "auto" : "none" }}>
                  <label className="form-label">
                    In-Game Time (IGT) {isGametime ? "*" : "— N/A for this platform"}
                  </label>
                  <div className="time-input-group">
                    <input type="number" placeholder="HH" value={igtHours} onChange={(e) => setIgtHours(e.target.value)} className="auth-input" />
                    <span className="time-separator">:</span>
                    <input type="number" placeholder="MM" value={igtMinutes} onChange={(e) => setIgtMinutes(e.target.value)} className="auth-input" />
                    <span className="time-separator">:</span>
                    <input type="number" placeholder="SS" value={igtSeconds} onChange={(e) => setIgtSeconds(e.target.value)} className="auth-input" />
                    <span className="time-separator">.</span>
                    <input type="number" placeholder="MS" value={igtMilliseconds} onChange={(e) => setIgtMilliseconds(e.target.value)} className="auth-input" />
                  </div>
                </div>
              </>
            )}

            <div className="form-group">
              <label className="form-label">Video URL *</label>
              <input type="url" placeholder="https://youtube.com/watch?v=..." value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} required className="auth-input" />
            </div>

            <div className="form-group">
              <label className="form-label">Comment (optional)</label>
              <textarea placeholder="Any additional notes about this run..." value={comment} onChange={(e) => setComment(e.target.value)} rows={4} className="auth-input" style={{ resize: "vertical", fontFamily: "inherit" }} />
            </div>

            <button type="submit" className="btn btn-primary btn-full" disabled={submitting}>
              {submitting ? "Submitting..." : "Submit Run"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}