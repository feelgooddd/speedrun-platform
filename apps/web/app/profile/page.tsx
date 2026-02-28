"use client";
import { useAuth } from "../components/auth/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function ProfileRedirect() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) { router.push("/login"); return; }
    router.push(`/profile/${user.username}`);
  }, [user, loading, router]);

  return null;
}