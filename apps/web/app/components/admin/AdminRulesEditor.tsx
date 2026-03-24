"use client";
import { useState, useEffect } from "react";

interface Platform {
  id: string;
  name: string;
  slug: string;
}

interface Game {
  id: string;
  slug: string;
  name: string;
  platforms: Platform[];
}

interface Category {
  id: string;
  name: string;
  slug: string;
  rules?: string | null;
  category_type?: string;
}

interface Level {
  id: string;
  name: string;
  slug: string;
  rules?: string | null;
  level_categories: { id: string; name: string; slug: string; rules?: string | null }[];
}

interface LevelCategory {
  id: string;
  name: string;
  slug: string;
  rules?: string | null;
}

type RulesTab = "platform" | "category" | "level" | "levelcategory";

interface AdminRulesEditorProps {
  games: Game[];
  token: string | null;
}

export default function AdminRulesEditor({ games, token }: AdminRulesEditorProps) {
  const [activeTab, setActiveTab] = useState<RulesTab>("platform");
  const [gameSlug, setGameSlug] = useState("");
  const [platformSlug, setPlatformSlug] = useState("");
  const [platformRules, setPlatformRules] = useState<string>("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [levelCategories, setLevelCategories] = useState<LevelCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("");
  const [selectedLevelCategory, setSelectedLevelCategory] = useState("");
  const [rules, setRules] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedPlatforms = games.find((g) => g.slug === gameSlug)?.platforms || [];

  // Fetch all rules when game+platform selected
  useEffect(() => {
    if (!gameSlug || !platformSlug) {
      setCategories([]);
      setLevels([]);
      setLevelCategories([]);
      setPlatformRules("");
      return;
    }
    setLoading(true);
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/moderation/games/${gameSlug}/${platformSlug}/rules`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        setPlatformRules(data.platform_rules ?? "");
        setCategories(data.categories ?? []);
        setLevels(data.levels ?? []);
        setLevelCategories(data.level_categories ?? []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [gameSlug, platformSlug]);

  // Prepopulate rules textarea when selection changes
  useEffect(() => {
    setError("");
    setSuccess("");
    if (activeTab === "platform") {
      setRules(platformRules);
    } else if (activeTab === "category") {
      const cat = categories.find((c) => c.slug === selectedCategory);
      setRules(cat?.rules ?? "");
    } else if (activeTab === "level") {
      const level = levels.find((l) => l.slug === selectedLevel);
      setRules(level?.rules ?? "");
    } else if (activeTab === "levelcategory") {
      const lc = levelCategories.find((l) => l.slug === selectedLevelCategory);
      setRules(lc?.rules ?? "");
    }
  }, [activeTab, platformRules, selectedCategory, selectedLevel, selectedLevelCategory]);

  const getEndpoint = () => {
    switch (activeTab) {
      case "platform":
        return `${process.env.NEXT_PUBLIC_API_URL}/moderation/games/${gameSlug}/${platformSlug}/rules`;
      case "category":
        return `${process.env.NEXT_PUBLIC_API_URL}/moderation/games/${gameSlug}/${platformSlug}/${selectedCategory}/rules`;
case "level":
  return `${process.env.NEXT_PUBLIC_API_URL}/moderation/games/${gameSlug}/${platformSlug}/levels/${selectedLevel}/rules`;

case "levelcategory":
  return `${process.env.NEXT_PUBLIC_API_URL}/moderation/games/${gameSlug}/${platformSlug}/levels/categories/${selectedLevelCategory}/rules`;
        return `${process.env.NEXT_PUBLIC_API_URL}/moderation/games/${gameSlug}/${platformSlug}/levels/${selectedLevelCategory}/rules`;
    }
  };

  const canSubmit = () => {
    if (!gameSlug || !platformSlug) return false;
    if (activeTab === "category" && !selectedCategory) return false;
    if (activeTab === "level" && !selectedLevel) return false;
    if (activeTab === "levelcategory" && !selectedLevelCategory) return false;
    return true;
  };

  const handleSave = async () => {
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(getEndpoint()!, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ rules: rules || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save rules");

      // Update local state so textarea reflects saved value without refetch
      if (activeTab === "platform") setPlatformRules(rules);
      if (activeTab === "category") {
        setCategories((prev) =>
          prev.map((c) => c.slug === selectedCategory ? { ...c, rules } : c)
        );
      }
      if (activeTab === "level") {
        setLevels((prev) =>
          prev.map((l) => l.slug === selectedLevel ? { ...l, rules } : l)
        );
      }
      if (activeTab === "levelcategory") {
        setLevelCategories((prev) =>
          prev.map((lc) => lc.slug === selectedLevelCategory ? { ...lc, rules } : lc)
        );
      }

      setSuccess("Rules saved successfully.");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      {/* Rules subtabs */}
      <div className="leaderboard-tabs" style={{ marginBottom: "1.5rem" }}>
        {([
          { key: "platform", label: "Platform" },
          { key: "category", label: "Category" },
          { key: "level", label: "Level" },
          { key: "levelcategory", label: "Level Category" },
        ] as { key: RulesTab; label: string }[]).map(({ key, label }) => (
          <button
            key={key}
            className={`leaderboard-tab ${activeTab === key ? "active" : ""}`}
            onClick={() => setActiveTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Game + Platform selectors */}
      <div className="form-group">
        <label className="form-label">Game & Platform</label>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <select
            className="auth-input"
            value={gameSlug}
            onChange={(e) => { setGameSlug(e.target.value); setPlatformSlug(""); }}
            style={{ flex: 1, minWidth: "120px" }}
          >
            <option value="">Select Game</option>
            {games.map((g) => (
              <option key={g.id} value={g.slug}>{g.name}</option>
            ))}
          </select>
          <select
            className="auth-input"
            value={platformSlug}
            onChange={(e) => setPlatformSlug(e.target.value)}
            disabled={!gameSlug}
            style={{ flex: 1, minWidth: "100px" }}
          >
            <option value="">Select Platform</option>
            {selectedPlatforms.map((p) => (
              <option key={p.id} value={p.slug}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {loading && <p style={{ opacity: 0.5, fontSize: "0.85rem" }}>Loading rules...</p>}

      {/* Category selector */}
      {activeTab === "category" && (
        <div className="form-group">
          <label className="form-label">Category</label>
          <select
            className="auth-input"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            disabled={!platformSlug}
          >
            <option value="">Select Category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.slug}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Level selector */}
      {activeTab === "level" && (
        <div className="form-group">
          <label className="form-label">Level</label>
          <select
            className="auth-input"
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value)}
            disabled={!platformSlug}
          >
            <option value="">Select Level</option>
            {levels.map((l) => (
              <option key={l.id} value={l.slug}>{l.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Level Category selector */}
      {activeTab === "levelcategory" && (
        <div className="form-group">
          <label className="form-label">Level Category</label>
          <select
            className="auth-input"
            value={selectedLevelCategory}
            onChange={(e) => setSelectedLevelCategory(e.target.value)}
            disabled={!platformSlug}
          >
            <option value="">Select Level Category</option>
            {levelCategories.map((lc) => (
              <option key={lc.id} value={lc.slug}>{lc.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Rules textarea */}
      {platformSlug && (
        <div className="form-group">
          <label className="form-label">Rules</label>
          <textarea
            className="auth-input"
            value={rules}
            onChange={(e) => setRules(e.target.value)}
            rows={8}
            placeholder="Enter rules text..."
            style={{ resize: "vertical", fontFamily: "inherit" }}
          />
        </div>
      )}

      {error && <p className="auth-error">{error}</p>}
      {success && <p className="auth-success">{success}</p>}

      {platformSlug && (
        <button
          className="btn btn-primary btn-full"
          onClick={handleSave}
          disabled={submitting || !canSubmit()}
        >
          {submitting ? "Saving..." : "Save Rules"}
        </button>
      )}
    </div>
  );
}