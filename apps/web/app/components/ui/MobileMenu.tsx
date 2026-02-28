"use client";
import { useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../auth/AuthContext";
import Link from "next/link";

export default function MobileMenu() {
  const [menuOpen, setMenuOpen] = useState(false);
const { user, logout, pendingCount } = useAuth();

  return (
    <>
      <button className="nav-hamburger" onClick={() => setMenuOpen(true)}>
        <span /><span /><span />
      </button>

      {menuOpen && createPortal(
        <div className="nav-mobile-menu open">
          <button className="nav-mobile-close" onClick={() => setMenuOpen(false)}>✕</button>
          <Link href="/" className="nav-mobile-link" onClick={() => setMenuOpen(false)}>Home</Link>
          <Link href="/games" className="nav-mobile-link" onClick={() => setMenuOpen(false)}>Leaderboards</Link>
{user ? (
  <>
    <a href="/profile" className="nav-mobile-link" style={{ color: 'var(--accent)' }} onClick={() => setMenuOpen(false)}>
      {user.display_name}
    </a>
    {(user.role === "admin" || user.role === "moderator") && (
<Link href="/moderation" className="nav-mobile-link" onClick={() => setMenuOpen(false)}>
  Mod Menu
  {pendingCount > 0 && (
    <span className="mod-nav-badge">{pendingCount}</span>
  )}
</Link>
    )}
    <button className="btn" onClick={() => { logout(); setMenuOpen(false); }}>Sign Out</button>
  </>
) : (
  <Link href="/login" className="btn" onClick={() => setMenuOpen(false)}>Sign In</Link>
)}
          
        </div>,
        document.body
      )}
    </>
  );
}