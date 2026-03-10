"use client";
import { useState, useEffect } from "react";
import { useAuth } from "../auth/AuthContext";

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

interface LevelCategory {
  id: string;
  slug: string;
  name: string;
}

interface Level {
  id: string;
  slug: string;
  name: string;
  order: number;
  level_categories: LevelCategory[];
}

export default function SubmitILRun() {
  const { token } = useAuth();

  const [games, setGames] = useState<Game[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);

  const [selectedGame, setSelectedGame] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("");

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

  const selectedPlatformData = platforms.find((p) => p.slug === selectedPlatform);
  const isGametime = selectedPlatformData?.timing_method === "gametime";

  // Unique categories across all levels
  const uniqueCategories: LevelCategory[] = [];
  const seen = new Set<string>();
  for (const level of levels) {
    for (const cat of level.level_categories) {
      if (!seen.has(cat.slug)) {
        seen.add(cat.slug);
        uniqueCategories.push(cat);
      }
    }
  }

  // Only show levels that have the selected category
  const availableLevels = levels.filter((l) =>
    l.level_categories.some((c) => c.slug === selectedCategory)
  );

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
      return;
    }
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/games/${selectedGame}`)
      .then((res) => res.json())
      .then((data) => setPlatforms(data.platforms || []))
      .catch(console.error);
  }, [selectedGame]);

  useEffect(() => {
    if (!selectedGame || !selectedPlatform) {
      setLevels([]);
      return;
    }
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/games/${selectedGame}/${selectedPlatform}/levels`)
      .then((res) => res.json())
      .then((data) => setLevels(data.levels || []))
      .catch(console.error);
  }, [selectedGame, selectedPlatform]);

  // Reset category and level when platform changes
  useEffect(() => {
    setSelectedCategory("");
    setSelectedLevel("");
  }, [selectedPlatform]);

  // Reset level when category changes, default to first available
  useEffect(() => {
    if (!selectedCategory) {
      setSelectedLevel("");
      return;
    }
    const first = levels.find((l) =>
      l.level_categories.some((c) => c.slug === selectedCategory)
    );
    setSelectedLevel(first?.slug ?? "");
  }, [selectedCategory]);

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
  if (!selectedLevel) {
    setError("Please select a level");
    return;
  }

  const igt =
    parseInt(igtHours || "0") * 3600000 +
    parseInt(igtMinutes || "0") * 60000 +
    parseInt(igtSeconds || "0") * 1000 +
    parseInt(igtMilliseconds || "0");

  const finalIgt = isGametime && igt <= 0 ? rta : igt;

  const level = levels.find((l) => l.slug === selectedLevel);
  const levelCategory = level?.level_categories.find((c) => c.slug === selectedCategory);

  if (!levelCategory) {
    setError("Could not resolve level category");
    return;
  }

  setSubmitting(true);
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/runs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        game_slug: selectedGame,
        platform_slug: selectedPlatform,
        level_category_id: levelCategory.id,
        realtime_ms: rta,
        gametime_ms: finalIgt > 0 ? finalIgt : null,
        video_url: videoUrl,
        comment,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to submit run");

    setSuccess(true);
    setSelectedGame("");
    setSelectedPlatform("");
    setSelectedCategory("");
    setSelectedLevel("");
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

  return (
    <>
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
        {/* Game */}
        <div className="form-group">
          <label className="form-label">Game *</label>
          <select
            value={selectedGame}
            onChange={(e) => { setSelectedGame(e.target.value); setSelectedPlatform(""); }}
            required
            className="auth-input"
          >
            <option value="">Select a game</option>
            {games.map((game) => (
              <option key={game.id} value={game.slug}>{game.name}</option>
            ))}
          </select>
        </div>

        {/* Platform */}
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
                <option key={platform.id} value={platform.slug}>{platform.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* IL Category */}
        {selectedPlatform && uniqueCategories.length > 0 && (
          <div className="form-group">
            <label className="form-label">Category *</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              required
              className="auth-input"
            >
              <option value="">Select a category</option>
              {uniqueCategories.map((cat) => (
                <option key={cat.id} value={cat.slug}>{cat.name}</option>
              ))}
            </select>
          </div>
        )}

        {selectedPlatform && uniqueCategories.length === 0 && (
          <p style={{ opacity: 0.5, fontSize: "0.9rem", marginBottom: "1rem" }}>
            No individual levels available for this platform.
          </p>
        )}

        {/* Level */}
        {selectedCategory && (
          <div className="form-group">
            <label className="form-label">Level *</label>
            <select
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
              required
              className="auth-input"
            >
              <option value="">Select a level</option>
              {availableLevels.map((level) => (
                <option key={level.id} value={level.slug}>{level.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Timing */}
        {selectedLevel && (
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

        {/* Video + Comment */}
        {selectedLevel && (
          <>
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

            <button type="submit" className="btn btn-primary btn-full" disabled={submitting}>
              {submitting ? "Submitting..." : "Submit Run"}
            </button>
          </>
        )}
      </form>
    </>
  );
}