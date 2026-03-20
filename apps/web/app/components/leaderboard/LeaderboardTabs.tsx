"use client";
import { useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import FullGameLeaderboard from "./FullGameLeaderboard";
import ILLeaderboard from "./ILLeaderboard";

interface Category {
  id: string;
  name: string;
  slug: string;
  category_type?: string;
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
  initialTab: "fullgame" | "il" | "extension";
  initialCategory: string | null;
  initialSubcategory: string | null;
  initialLevel: string | null;
  initialVariables: Record<string, string>;
}

export default function LeaderboardTabs({
  categories,
  extensionCategories,
  gameSlug,
  platformSlug,
  initialTab,
  initialCategory,
  initialSubcategory,
  initialLevel,
  initialVariables = {},
}: LeaderboardTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState<"fullgame" | "il" | "extension">(
    initialTab,
  );
  const hasExtensions = extensionCategories.length > 0;

  const updateUrl = useCallback(
    (params: Record<string, string | null>) => {
      const sp = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
        if (v) sp.set(k, v);
      }
      router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
    },
    [router, pathname],
  );

  const handleTabChange = (tab: "fullgame" | "il" | "extension") => {
    setActiveTab(tab);
    updateUrl({ type: tab });
  };

  return (
    <div>
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
        />
      )}
    </div>
  );
}
