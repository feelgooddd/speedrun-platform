"use client";
import Link from "next/link";
import { useAuth } from "../auth/AuthContext";

export default function LandingCTA() {
  const { user } = useAuth();

  return (
    <div className="cta-banner-actions">
      {user ? (
        <>
          <Link href="/submit" className="btn btn-primary">Submit a Run</Link>
          <Link href="/games" className="btn">Browse Runs</Link>
        </>
      ) : (
        <>
          <Link href="/register" className="btn btn-primary">Create Account</Link>
          <Link href="/games" className="btn">Browse Runs</Link>
        </>
      )}
    </div>
  );
}