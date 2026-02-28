"use client";
import { useState, useEffect } from "react";
import { useAuth } from "../components/auth/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";

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
  pending_runs: number;
}

export default function ModerationDashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [games, setGames] = useState<Game[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }

    const fetchModeratedGames = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me/moderated-games`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("Failed to fetch moderated games");
        const data = await res.json();
        setGames(data.games || []);
        setIsAdmin(data.isAdmin || false);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchModeratedGames();
  }, [user, authLoading, router]);

  if (authLoading || loading) {
    return (
      <div className="landing">
        <div className="section mod-page-section">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  if (games.length === 0) {
    return (
      <div className="landing">
        <div className="section mod-page-section">
          <div className="section-header">
            <h1 className="section-title">Moderation Dashboard</h1>
            <p className="section-subtitle">You are not a moderator for any games</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="landing">
      <div className="section mod-page-section">
        <div className="section-header">
          <h1 className="section-title">Moderation Dashboard</h1>
          <p className="section-subtitle">
            {isAdmin ? "Admin - All Games" : `Moderating ${games.length} game${games.length > 1 ? 's' : ''}`}
          </p>
        </div>

        {isAdmin && (
          <div className="mod-admin-link">
            <Link href="/admin" className="btn btn-primary">
              Admin Panel
            </Link>
          </div>
        )}

        <div className="games-grid">
          {games.map((game, i) => (
            <Link
              key={game.id}
              href={`/moderation/${game.slug}`}
              className="game-card mod-game-card"
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              {game.pending_runs > 0 && (
                <span className="mod-pending-badge">
                  {game.pending_runs} pending
                </span>
              )}
              <div className="game-card-icon">⚖️</div>
              <h2 className="game-card-title">{game.name}</h2>
              <div className="game-card-platforms">
                {game.platforms.map((p) => (
                  <span key={p.id} className="platform-tag">{p.name}</span>
                ))}
              </div>
              <button className="btn btn-full">View Mod Queue →</button>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}