import Link from "next/link";
interface Platform { id: string; game_id: string; name: string; slug: string; }
interface Game { id: string; name: string; img_url: string; slug: string; platforms: Platform[]; }

export async function GamesGrid({ gamesPromise }: { gamesPromise: Promise<Game[]> }) {
  const games = await gamesPromise;

  return (
    <div className="games-grid">
      {games.length === 0 ? (
        <div className="games-empty">✦ No games found ✦</div>
      ) : (
        games.map((game, i) => (
          <Link
            key={game.id}
            href={`/games/${game.slug}`}
            className="game-card"
            style={{ animationDelay: `${i * 0.1}s`, textDecoration: "none" }}
          >
            <div className="game-card-icon">
              {game.img_url ? <img src={game.img_url} alt={game.name} /> : "⚡"}
            </div>
            <h3 className="game-card-title">{game.name}</h3>
            <div className="game-card-platforms">
              {game.platforms.map((p) => (
                <span key={p.id} className="platform-tag">{p.name}</span>
              ))}
            </div>
            <button className="btn btn-full">View Game →</button>
          </Link>
        ))
      )}
    </div>
  );
}

export function GamesSkeleton() {
  return (
    <div className="games-grid">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="game-card" style={{ opacity: 0.4, pointerEvents: "none" }}>
          <div className="game-card-icon">⚡</div>
          <h3 className="game-card-title">Summoning...</h3>
          <div className="game-card-platforms">
            <span className="platform-tag">—</span>
          </div>
          <button className="btn btn-full">View Game →</button>
        </div>
      ))}
    </div>
  );
}