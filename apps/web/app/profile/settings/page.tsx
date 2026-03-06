"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../components/auth/AuthContext";
import Link from "next/link";
import "../../styles/auth.css";
import { COUNTRIES } from "@/app/lib/countries";
import InfoPanel from "@/app/components/ui/InfoPanel";

export default function MePage() {
  const router = useRouter();
  const { user, token, login, loading } = useAuth();
  const [form, setForm] = useState({
    email: "",
    country: "",
    display_name: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [showInfo, setShowInfo] = useState(false);

  const [pwForm, setPwForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError("");
    setPwSuccess(false);
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwError("New passwords don't match");
      return;
    }
    if (pwForm.newPassword.length < 8) {
      setPwError("New password must be at least 8 characters");
      return;
    }
    setPwLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/change-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            currentPassword: pwForm.currentPassword,
            newPassword: pwForm.newPassword,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setPwError(data.error);
        return;
      }
      setPwSuccess(true);
      setPwForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch {
      setPwError("Something went wrong");
    } finally {
      setPwLoading(false);
    }
  };

  useEffect(() => {
    if (loading) return; // wait for auth to hydrate
    if (!user) {
      router.push("/login");
      return;
    }
    setForm({
      email: user.email || "",
      country: user.country || "",
      display_name: user.display_name || "",
    });
  }, [user, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/me`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Update failed");
        return;
      }

      // Update auth context with new user data
      login(data, token!);
      setSuccess("Profile updated successfully.");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link href="/" className="auth-back">
          ← Back
        </Link>

        <div className="auth-header">
          <div className="auth-icon">⚡</div>
          <h1 className="auth-title">My Profile</h1>
          <p className="auth-subtitle">{user.display_name || user.username}</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-field">
            <label className="auth-label">Email</label>
            <input
              className="auth-input"
              type="email"
              name="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="you@example.com"
              required
            />
          </div>
          <div className="auth-field">
            <label className="auth-label">Display Name:</label>
            <div className="auth-group">
              <input
                className="auth-input"
                type="text"
                name="display-name"
                value={form.display_name}
                onChange={(e) =>
                  setForm({ ...form, display_name: e.target.value })
                }
                placeholder="Display"
                required
              />
              <button
                onClick={() => setShowInfo(!showInfo)}
                className="house-btn"
                type="button"
              >
                {!showInfo ? "?" : "x"}
              </button>
            </div>
            {showInfo && <InfoPanel />}
          </div>
          <div className="auth-field">
            <label className="auth-label">Country</label>
            <select
              className="auth-input"
              value={form.country}
              onChange={(e) => setForm({ ...form, country: e.target.value })}
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {error && <p className="auth-error">{error}</p>}
          {success && <p className="auth-success">{success}</p>}

          <button
            type="submit"
            className="btn btn-primary auth-submit"
            disabled={submitting}
          >
            {submitting ? "Saving..." : "Save Changes"}
          </button>
        </form>
        <div
          className="auth-form"
          style={{
            borderTop: "1px solid rgba(255,255,255,0.1)",
            marginTop: "2rem",
            paddingTop: "2rem",
          }}
        >
          <h2 style={{ fontSize: "1rem", marginBottom: "1rem", opacity: 0.8 }}>
            Change Password
          </h2>
          <form onSubmit={handleChangePassword} className="auth-form">
            <div className="auth-field">
              <label className="auth-label">Current Password</label>
              <input
                className="auth-input"
                type="password"
                value={pwForm.currentPassword}
                onChange={(e) =>
                  setPwForm({ ...pwForm, currentPassword: e.target.value })
                }
                required
              />
            </div>
            <div className="auth-field">
              <label className="auth-label">New Password</label>
              <input
                className="auth-input"
                type="password"
                value={pwForm.newPassword}
                onChange={(e) =>
                  setPwForm({ ...pwForm, newPassword: e.target.value })
                }
                required
              />
            </div>
            <div className="auth-field">
              <label className="auth-label">Confirm New Password</label>
              <input
                className="auth-input"
                type="password"
                value={pwForm.confirmPassword}
                onChange={(e) =>
                  setPwForm({ ...pwForm, confirmPassword: e.target.value })
                }
                required
              />
            </div>
            {pwError && <p className="auth-error">{pwError}</p>}
            {pwSuccess && (
              <p className="auth-success">✓ Password updated successfully</p>
            )}
            <button
              type="submit"
              className="btn btn-primary auth-submit"
              disabled={pwLoading}
            >
              {pwLoading ? "Updating..." : "Update Password"}
            </button>
          </form>
        </div>
        <p className="auth-switch">
          <Link href={`/profile/${user.username}`} className="auth-switch-link">
            View your public profile →
          </Link>
        </p>
      </div>
    </div>
  );
}
