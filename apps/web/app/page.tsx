import { Suspense } from "react";
import Particles from "./components/ui/Particles";
import HouseSelector from "./components/ui/HouseSelector";
import Link from "next/link";
import HeroActions from "./components/ui/HeroActions";
import LandingCTA from "./components/ui/LandingCTA";
import { GamesGrid, GamesSkeleton } from "./components/ui/GamesGrid"
import { StatsSection, StatsSkeleton } from "./components/ui/StatsSection";

export default function Page() {
  // Don't await — pass the promises to Suspense boundaries
  const gamesPromise = fetch(`${process.env.NEXT_PUBLIC_API_URL}/games`, {
    next: { revalidate: 0 },
  }).then(r => r.json()).catch(() => []);

  const statsPromise = fetch(`${process.env.NEXT_PUBLIC_API_URL}/games/stats`, {
    next: { revalidate: 60 },
  }).then(r => r.json()).catch(() => null);

  return (
    <div className="landing">
      <Particles />

      {/* Hero renders INSTANTLY — no data needed */}
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
            Every spell cast, every potion brewed, every corridor sprinted all
            in pursuit of the fastest time through the wizarding world.
          </p>
          <HeroActions />
        </div>
        <div className="scroll-indicator">
          <span>SCROLL</span>
          <span>↓</span>
        </div>
      </section>

      {/* Stats stream in */}
      <Suspense fallback={<StatsSkeleton />}>
        <StatsSection statsPromise={statsPromise} />
      </Suspense>

      {/* Games stream in */}
      <section id="games" className="section">
        <div className="section-header">
          <span className="section-ornament">✦ ✦ ✦</span>
          <div className="section-divider" />
          <h2 className="section-title">The Games</h2>
          <div className="section-divider" />
          <p className="section-subtitle">Choose your adventure through the wizarding world</p>
        </div>
        <Suspense fallback={<GamesSkeleton />}>
          <GamesGrid gamesPromise={gamesPromise} />
        </Suspense>
      </section>

      {/* CTA + Footer render instantly */}
      <section className="cta-banner">
        <div className="cta-banner-glow" />
        <div className="cta-banner-content">
          <p className="hero-tagline">✦ Your time starts now ✦</p>
          <h2 className="cta-banner-title">Ready to Prove Your Speed?</h2>
          <p className="cta-banner-description">
            Submit your run and claim your place in the wizarding records.
          </p>
          <LandingCTA />
        </div>
      </section>

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