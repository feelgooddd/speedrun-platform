"use client";
import { useState } from "react";
import FullGameLeaderboard from "./FullGameLeaderboard";
import ILLeaderboard from "./ILLeaderboard";

interface Category {
  id: string;
  name: string;
  slug: string;
  subcategories?: any[];
  variables?: any[];
  runs?: any[];
  total?: number;
  variableRuns?: Record<string, { runs: any[]; total: number }>;
}

interface LeaderboardTabsProps {
  categories: Category[];
  gameSlug: string;
  platformSlug: string;
}

export default function LeaderboardTabs({
  categories,
  gameSlug,
  platformSlug,
}: LeaderboardTabsProps) {
  const [activeTab, setActiveTab] = useState<"fullgame" | "il">("fullgame");

  return (
    <div>
      {/* Full Game / ILs toggle */}
      <div className="leaderboard-tabs" style={{ marginBottom: "0" }}>
        <button
          className={`leaderboard-tab ${activeTab === "fullgame" ? "active" : ""}`}
          onClick={() => setActiveTab("fullgame")}
        >
          Full Game
        </button>
        <button
          className={`leaderboard-tab ${activeTab === "il" ? "active" : ""}`}
          onClick={() => setActiveTab("il")}
        >
          Individual Levels
        </button>
      </div>

      {activeTab === "fullgame" && (
        <FullGameLeaderboard
          categories={categories}
          gameSlug={gameSlug}
          platformSlug={platformSlug}
        />
      )}

      {activeTab === "il" && (
        <ILLeaderboard
          gameSlug={gameSlug}
          platformSlug={platformSlug}
        />
      )}
    </div>
  );
}