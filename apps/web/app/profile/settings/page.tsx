"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../components/auth/AuthContext";
import Link from "next/link";
import "../../styles/auth.css";

// Our new modular pieces
import { ProfileForm } from "@/app/components/profile/ProfileForm";
import { PasswordForm } from "@/app/components/profile/PasswordForm";
import { useUpdateProfile } from "@/app/lib/hooks/useUpdateProfile";
import { useChangePassword } from "@/app/lib/hooks/useChangePassword";

export default function SettingsPage() {
  const router = useRouter();
  const { user, token, login, loading } = useAuth();

  // Logic Hooks
  const profile = useUpdateProfile(user, token, login);
  const security = useChangePassword(token);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (!user) return null;

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link href="/" className="auth-back">← Back</Link>

        <div className="auth-header">
          <div className="auth-icon">⚡</div>
          <h1 className="auth-title">My Profile</h1>
          <p className="auth-subtitle">{user.display_name || user.username}</p>
        </div>

        {/* Modular Sections */}
        <ProfileForm profile={profile} />
        <PasswordForm security={security} />

        <p className="auth-switch">
          <Link href={`/profile/${user.username}`} className="auth-switch-link">
            View your public profile →
          </Link>
        </p>
      </div>
    </div>
  );
}