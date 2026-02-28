"use client";
import Link from "next/link";
import { useAuth } from "../auth/AuthContext";

export default function SettingsLink({ username }: { username: string }) {
  const { user } = useAuth();
  if (user?.username !== username) return null;
  return (
    <Link href="/profile/settings" className="btn">
      Settings
    </Link>
  );
}