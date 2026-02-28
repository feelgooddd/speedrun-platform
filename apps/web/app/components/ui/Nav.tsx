import Link from "next/link";
import MobileMenu from "./MobileMenu";
import NavAuth from "./NavAuth";

export default function Nav() {
  return (
    <nav className="nav">
      <Link href="/" className="nav-logo">
        <span>⚡</span>
        <span className="nav-logo-text">WIZARDING RUNS</span>
      </Link>
      <div className="nav-links">
        <Link href="/" className="nav-link">Home</Link>
        <Link href="/games" className="nav-link">Leaderboards</Link>
        <NavAuth />
      </div>
      <MobileMenu />
    </nav>
  );
}