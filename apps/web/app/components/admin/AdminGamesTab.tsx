"use client";
import { useState } from "react";
import CreateGameWizard from "./CreateGameWizard";
import VariableForm from "./VariableForm";
import DependencyForm from "./DependencyForm";
import AdminAddCategoryForm from "./AdminAddCategoryForm";
import CreateILWizard from "./CreateILWizard";
import AdminRulesEditor from "./AdminRulesEditor";

type GameTab =
  | "create"
  | "categories"
  | "variables"
  | "dependencies"
  | "ils"
  | "rules";

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

interface AdminGamesTabProps {
  games: Game[];
  token: string | null;
  onGameCreated: (game: Game) => void;
}

export default function AdminGamesTab({
  games,
  token,
  onGameCreated,
}: AdminGamesTabProps) {
  const [activeGameTab, setActiveGameTab] = useState<GameTab>("create");

  return (
    <div className="admin-games-tab">
      <div className="leaderboard-tabs admin-games-subtabs">
        {(
          [
            { key: "create", label: "Create Game" },
            { key: "categories", label: "Add Category" },
            { key: "variables", label: "Add Variable" },
            { key: "dependencies", label: "Set Dependencies" },
            { key: "ils", label: "Add ILs" },
            { key: "rules", label: "Edit Rules" },
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

      {activeGameTab === "create" && (
        <div className="profile-section">
          <h2 className="profile-section-title">🎮 Create Game</h2>
          <CreateGameWizard
            onDoneAction={(game) => onGameCreated({ ...game, platforms: [] })}
          />
        </div>
      )}

      {activeGameTab === "categories" && (
        <div className="profile-section">
          <h2 className="profile-section-title">🏆 Add Category</h2>
          <AdminAddCategoryForm games={games} token={token} />
        </div>
      )}

      {activeGameTab === "variables" && (
        <div className="profile-section">
          <h2 className="profile-section-title">⚙️ Add Variable</h2>
          <VariableForm games={games} token={token} />
        </div>
      )}

      {activeGameTab === "dependencies" && (
        <div className="profile-section">
          <h2 className="profile-section-title">🔗 Set Dependencies</h2>
          <DependencyForm games={games} token={token} />
        </div>
      )}
      {activeGameTab === "ils" && (
        <div className="profile-section">
          <h2 className="profile-section-title">🎮 Individual Levels</h2>
          <CreateILWizard games={games} token={token} />
        </div>
      )}
      {activeGameTab === "rules" && (
        <div className="profile-section">
          <h2 className="profile-section-title">📋 Edit Rules</h2>
          <AdminRulesEditor games={games} token={token} />
        </div>
      )}
    </div>
  );
}
