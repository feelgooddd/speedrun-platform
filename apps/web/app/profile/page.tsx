"use client";
import { useAuth } from "../components/auth/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

// app/profile/page.tsx
export default function ProfileRedirect() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) { router.push("/login"); return; }
    router.push(`/profile/${user.username}`);
  }, [user, loading, router]);

  // Returning this ensures the screen stays dark and matched to your UI
  // while the redirect is processing in the background.
  return <div className="landing" style={{ minHeight: '100vh' }} />;
}