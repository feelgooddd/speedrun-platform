"use client";
import Link from "next/link";
import { useAuth } from "../auth/AuthContext";

export default function HeroActions() {
  const { user } = useAuth();

  return (
    <div className="hero-actions">
      <Link href="/games" className="btn btn-primary">View Leaderboards</Link>
      {user ? (
        <Link href="/submit" className="btn">Submit a Run</Link>
      ) : (
        <Link href="/register" className="btn">Join the Community</Link>
      )}
    </div>
  );
}