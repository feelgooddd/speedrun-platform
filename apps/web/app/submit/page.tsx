"use client";
import { useState, useEffect } from "react";
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
}

export default function SubmitRunPage() {
  const { user, loading } = useAuth();

  const [games, setGames] = useState<Game[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [selectedGame, setSelectedGame] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedSubcategory, setSelectedSubcategory] = useState("");

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

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const selectedPlatformData = platforms.find(
    (p) => p.slug === selectedPlatform,
  );
  const isGametime = selectedPlatformData?.timing_method === "gametime";

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
    fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/games/${selectedGame}/${selectedPlatform}/categories`,
    )
      .then((res) => res.json())
      .then((data) => setCategories(data.categories || []))
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

    setSubmitting(true);

    try {
      const token = localStorage.getItem("token");

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/runs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          game_slug: selectedGame,
          platform_slug: selectedPlatform,
          category_slug: selectedCategory,
          subcategory_slug: selectedSubcategory || undefined,
          realtime_ms: rta,
          gametime_ms: igt > 0 ? igt : null,
          video_url: videoUrl,
          comment,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to submit run");
      }

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
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Conditional returns AFTER all hooks
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

  const selectedCategoryData = categories.find(
    (c) => c.slug === selectedCategory,
  );
  const hasSubcategories =
    selectedCategoryData?.subcategories &&
    selectedCategoryData.subcategories.length > 0;

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
            <div className="form-group">
              <label className="form-label">Game *</label>
              <select
                value={selectedGame}
                onChange={(e) => setSelectedGame(e.target.value)}
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

            {selectedGame && (
              <div className="form-group">
                <label className="form-label">Platform *</label>
                <select
                  value={selectedPlatform}
                  onChange={(e) => setSelectedPlatform(e.target.value)}
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

            {selectedPlatform && (
              <div className="form-group">
                <label className="form-label">Category *</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
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

            {hasSubcategories && (
              <div className="form-group">
                <label className="form-label">Subcategory *</label>
                <select
                  value={selectedSubcategory}
                  onChange={(e) => setSelectedSubcategory(e.target.value)}
                  required
                  className="auth-input"
                >
                  <option value="">Select a subcategory</option>
                  {selectedCategoryData?.subcategories?.map((sub) => (
                    <option key={sub.id} value={sub.slug}>
                      {sub.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
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
