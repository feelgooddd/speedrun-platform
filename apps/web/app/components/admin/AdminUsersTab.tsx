"use client";
import { useState } from "react";

interface Game {
  id: string;
  slug: string;
  name: string;
}

export interface UserResult {
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

interface AdminUsersTabProps {
  games: Game[];
  token: string | null;
}

export default function AdminUsersTab({ games, token }: AdminUsersTabProps) {
  const [userSearch, setUserSearch] = useState("");
  const [userResults, setUserResults] = useState<UserResult[]>([]);
  const [userSearching, setUserSearching] = useState(false);
  const [userError, setUserError] = useState("");

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

  return (
    <div className="admin-users-tab">
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
          <div key={u.id} className="admin-user-card">
            <div className="admin-user-card-header">
              <div>
                <div className="admin-user-name">
                  {u.display_name || u.username}
                </div>
                <div className="admin-user-meta">
                  @{u.username} · {u.email}
                </div>
                <div className="admin-user-meta">Role: {u.role}</div>
              </div>
              <select
                className="auth-input admin-user-role-select"
                value={u.role}
                onChange={(e) => handleRoleChange(u.id, e.target.value)}
              >
                <option value="user">User</option>
                <option value="moderator">Moderator</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div>
              <div className="admin-user-moderates-label">Moderates:</div>
              <div className="admin-user-games">
                {u.moderated_games.length === 0 && (
                  <span className="admin-user-no-games">No games assigned</span>
                )}
                {u.moderated_games.map((mg) => (
                  <span key={mg.game_id} className="admin-user-game-badge">
                    {mg.game.name}
                    <button
                      className="admin-user-game-remove"
                      onClick={() =>
                        handleRemoveModerator(u.id, mg.game.slug, mg.game_id)
                      }
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
                  if (e.target.value) handleAssignModerator(u.id, e.target.value);
                  e.target.value = "";
                }}
              >
                <option value="">Assign to game...</option>
                {games
                  .filter(
                    (g) => !u.moderated_games.find((mg) => mg.game.slug === g.slug),
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
  );
}