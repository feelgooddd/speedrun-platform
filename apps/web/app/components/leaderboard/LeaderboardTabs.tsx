"use client";
import { useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import FullGameLeaderboard from "./FullGameLeaderboard";
import ILLeaderboard from "./ILLeaderboard";
import RulesModal from "./RulesModal";

interface Category {
  id: string;
  name: string;
  slug: string;
  category_type?: string;
  category_rules?: string | null;
  subcategories?: any[];
  variables?: any[];
  runs?: any[];
  total?: number;
  variableRuns?: Record<string, { runs: any[]; total: number }>;
}

interface LeaderboardTabsProps {
  categories: Category[];
  extensionCategories: Category[];
  gameSlug: string;
  platformSlug: string;
  platformName: string;
  gameName: string;
  platformRules: string | null;
  initialTab?: "fullgame" | "il" | "extension";
  initialCategory?: string | null;
  initialSubcategory?: string | null;
  initialLevel?: string | null;
  initialVariables?: Record<string, string>;
}

export default function LeaderboardTabs({
  categories,
  extensionCategories,
  gameSlug,
  platformSlug,
  platformName,
  gameName,
  platformRules,
  initialTab = "fullgame",
  initialCategory = null,
  initialSubcategory = null,
  initialLevel = null,
  initialVariables = {},
}: LeaderboardTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState<"fullgame" | "il" | "extension">(initialTab);
  const [activeCategory, setActiveCategory] = useState<string | null>(initialCategory);
  const [rulesOpen, setRulesOpen] = useState(false);
  const hasExtensions = extensionCategories.length > 0;

  const updateUrl = useCallback((params: Record<string, string | null>) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v) sp.set(k, v);
    }
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
  }, [router, pathname]);

  const handleTabChange = (tab: "fullgame" | "il" | "extension") => {
    setActiveTab(tab);
    setActiveCategory(null);
    updateUrl({ type: tab });
  };

  const handleCategoryChange = (category: string) => {
    setActiveCategory(category);
  };

  // Resolve category_rules for the active category
  const allCategories = [...categories, ...extensionCategories];

  return (
    <div>
      {/* Rules trigger */}
      <div style={{ textAlign: "center", marginBottom: "1rem" }}>
        <button className="rules-trigger-btn" onClick={() => setRulesOpen(true)}>
          📋 Show Rules
        </button>
      </div>

      <div className="leaderboard-tabs" style={{ marginBottom: "0" }}>
        <button
          className={`leaderboard-tab ${activeTab === "fullgame" ? "active" : ""}`}
          onClick={() => handleTabChange("fullgame")}
        >
          Full Game
        </button>
        <button
          className={`leaderboard-tab ${activeTab === "il" ? "active" : ""}`}
          onClick={() => handleTabChange("il")}
        >
          Individual Levels
        </button>
        {hasExtensions && (
          <button
            className={`leaderboard-tab ${activeTab === "extension" ? "active" : ""}`}
            onClick={() => handleTabChange("extension")}
          >
            Category Extensions
          </button>
        )}
      </div>

      {activeTab === "fullgame" && (
        <FullGameLeaderboard
          categories={categories}
          gameSlug={gameSlug}
          platformSlug={platformSlug}
          initialCategory={initialCategory}
          initialSubcategory={initialSubcategory}
          initialVariables={initialVariables}
          tabType="fullgame"
          onUrlChange={updateUrl}
          onCategoryChange={handleCategoryChange}
        />
      )}

      {activeTab === "il" && (
        <ILLeaderboard
          gameSlug={gameSlug}
          platformSlug={platformSlug}
          initialLevel={initialLevel}
          initialCategory={initialCategory}
          initialVariables={initialVariables}
          onUrlChange={updateUrl}
          onCategoryChange={handleCategoryChange}
        />
      )}

      {activeTab === "extension" && (
        <FullGameLeaderboard
          categories={extensionCategories}
          gameSlug={gameSlug}
          platformSlug={platformSlug}
          initialCategory={initialCategory}
          initialSubcategory={initialSubcategory}
          initialVariables={initialVariables}
          tabType="extension"
          onUrlChange={updateUrl}
          onCategoryChange={handleCategoryChange}
        />
      )}

      <RulesModal
        isOpen={rulesOpen}
        onClose={() => setRulesOpen(false)}
        gameSlug={gameSlug}
        platformSlug={platformSlug}
        platformName={platformName}
        gameName={gameName}
        categories={categories}
        extensionCategories={extensionCategories}
        platformRules={platformRules}
        initialTab={activeTab}
        initialCategory={activeCategory}
      />
    </div>
  );
}