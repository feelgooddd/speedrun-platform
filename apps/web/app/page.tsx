import Particles from "./components/ui/Particles";
import HouseSelector from "./components/ui/HouseSelector";
import Link from "next/link";

interface Platform {
  id: string;
  game_id: string;
  name: string;
  slug: string;
}

interface Game {
  id: string;
  name: string;
  slug: string;
  platforms: Platform[];
}

interface Stats {
  total_runs: number;
  total_pbs: number;
  runners: number;
  world_records: number;
}

async function getGames(): Promise<Game[]> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/games`, {
      next: { revalidate: 60 },
    });
    return res.json();
  } catch {
    return [];
  }
}

async function getStats(): Promise<Stats | null> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/games/stats`, {
      next: { revalidate: 60 },
    });
    return res.json();
  } catch {
    return null;
  }
}

export default async function Page() {
  const [games, stats] = await Promise.all([getGames(), getStats()]);

  const STATS = [
    { number: stats?.total_runs?.toLocaleString() ?? "—",    label: "Total Runs"    },
    { number: stats?.total_pbs?.toLocaleString() ?? "—", label: "Number of PB's" },
    { number: stats?.runners?.toLocaleString() ?? "—",       label: "Runners"       },
    { number: stats?.world_records?.toLocaleString() ?? "—", label: "World Records" },
  ];

  return (
    <div className="landing">
      <Particles />

      {/* Hero */}
      <section className="hero">
        <div className="hero-ring hero-ring-outer" />
        <div className="hero-ring hero-ring-inner" />

        <HouseSelector />

        <div className="hero-content">
          <h1 className="hero-title">
            The Wizarding World
            <br />
            Speedrun Leaderboards
          </h1>

          <p className="hero-description">
            Every spell cast, every potion brewed, every corridor sprinted 
            all in pursuit of the fastest time through the wizarding world.
          </p>

          <div className="hero-actions">
            <button className="btn btn-primary">View Leaderboards</button>
            <button className="btn">Join the Community</button>
          </div>
        </div>

        <div className="scroll-indicator">
          <span>SCROLL</span>
          <span>↓</span>
        </div>
      </section>

      {/* Stats */}
      <section className="stats-section">
        <div className="stats-grid">
          {STATS.map((s) => (
            <div key={s.label}>
              <div className="stat-number">{s.number}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Games */}
      <section id="games" className="section">
        <div className="section-header">
          <span className="section-ornament">✦ ✦ ✦</span>
          <div className="section-divider" />
          <h2 className="section-title">The Games</h2>
          <div className="section-divider" />
          <p className="section-subtitle">Choose your adventure through the wizarding world</p>
        </div>

        <div className="games-grid">
          {games.length === 0 ? (
            <div className="games-empty">✦ Summoning games from the archives... ✦</div>
          ) : (
            games.map((game, i) => (
              <Link
                key={game.id}
                href={`/games/${game.slug}`}
                className="game-card"
                style={{ animationDelay: `${i * 0.1}s`, textDecoration: "none" }}
              >
                <div className="game-card-icon">⚡</div>
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
      </section>

      {/* CTA Banner */}
      <section className="cta-banner">
        <div className="cta-banner-glow" />
        <div className="cta-banner-content">
          <p className="hero-tagline">✦ Your time starts now ✦</p>
          <h2 className="cta-banner-title">Ready to Prove Your Speed?</h2>
          <p className="cta-banner-description">
            Submit your run and claim your place in the wizarding records.
          </p>
          <div className="cta-banner-actions">
            <button className="btn btn-primary">Create Account</button>
            <button className="btn">Browse Runs</button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-logo">
          <span>⚡</span>
          <span className="footer-logo-text">WIZARDING RUNS</span>
        </div>
        <div className="footer-links">
          <a href="#" className="nav-link">API Docs</a>
          <a href="#" className="nav-link">Discord</a>
          <a href="#" className="nav-link">GitHub</a>
        </div>
        <span className="footer-tagline">Open source. Self-hostable. Community owned.</span>
      </footer>
    </div>
  );
}