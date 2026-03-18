import Link from "next/link";
import { notFound } from "next/navigation";

interface Platform {
  id: string;
  name: string;
  slug: string;
  img_url: string;
  categories: Category[];
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface Game {
  id: string;
  slug: string;
  name: string;
  platforms: Platform[];
  default_platform_id: string | null;
}

async function getGame(slug: string): Promise<Game | null> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/games/${slug}`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.game ?? data;
}


export default async function GamePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const game = await getGame(slug);

  if (!game) notFound();

  return (
    <div className="landing">
      <div className="section" style={{ paddingTop: "6rem" }}>
        <div className="section-header">
          <Link href="/games" className="auth-back">← All Games</Link>
          <div className="section-ornament" style={{ marginTop: "1rem" }}>✦ ✦ ✦</div>
          <div className="section-divider" />
          <h1 className="section-title">{game.name}</h1>
          <p className="section-subtitle">Select a platform to view leaderboards</p>
        </div>

        <div className="games-grid">
          {game.platforms.map((platform, i) => (
            <Link
              key={platform.id}
              href={`/games/${slug}/${platform.slug}`}
              className="game-card"
              style={{ animationDelay: `${i * 0.1}s`, textDecoration: "none" }}
            >
<div className="game-card-icon">
  {platform.img_url 
    ? <img src={platform.img_url} alt={platform.name} />
    : "🎮"
  }
</div>
              <h2 className="game-card-title">{platform.name}</h2>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}