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
}

async function getGames(): Promise<Game[]> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/games`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.games ?? data;
}

export default async function GamesPage() {
  const games = await getGames();

  return (
    <div className="landing">
      <div className="section" style={{ paddingTop: "6rem" }}>
        <div className="section-header">
          <div className="section-ornament">✦ ✦ ✦</div>
          <div className="section-divider" />
          <h1 className="section-title">All Games</h1>
          <p className="section-subtitle">Choose a game to view its leaderboards</p>
        </div>

        <div className="games-grid">
          {games.length === 0 && (
            <p className="games-empty">No games found.</p>
          )}
          {games.map((game, i) => (
            <Link
              key={game.id}
              href={`/games/${game.slug}`}
              className="game-card"
              style={{ animationDelay: `${i * 0.1}s`, textDecoration: "none" }}
            >
              <div className="game-card-icon">⚡</div>
              <h2 className="game-card-title">{game.name}</h2>

              <div className="game-card-platforms">
                {game.platforms.map((p) => (
                  <span key={p.id} className="platform-tag">{p.name}</span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}