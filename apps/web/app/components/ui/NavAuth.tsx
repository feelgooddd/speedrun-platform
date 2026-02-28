"use client";
import { useAuth } from "../auth/AuthContext";
import Link from "next/link";
import { useState, useEffect } from "react";

export default function NavAuth() {
const { user, logout, token, pendingCount } = useAuth();


  if (user) {
    return (
      <>
        <a className="nav-link" href="/profile" style={{ color: "var(--accent)" }}>
          {user.display_name}
        </a>
        {(user.role === "admin" || user.role === "moderator") && (
          <Link href="/moderation" className="nav-link mod-menu-link">
            Mod Menu
            {pendingCount > 0 && (
              <span className="mod-nav-badge">{pendingCount}</span>
            )}
          </Link>
        )}
        <button className="btn btn-sm" onClick={logout}>Sign Out</button>
      </>
    );
  }

  return <Link href="/login" className="btn btn-sm">Sign In</Link>;
}