"use client";
import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../components/auth/AuthContext";
import Link from "next/link";
import "../styles/auth.css";

type Step = "form" | "verify" | "claim";

export default function RegisterPage() {
  const router = useRouter();
  const { login, user } = useAuth();

  useEffect(() => {
    if (user) router.replace("/");
  }, [user]);

  const [step, setStep] = useState<Step>("form");
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [verifyStatus, setVerifyStatus] = useState<"idle" | "checking" | "verified" | "failed">("idle");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleUsernameBlur = async () => {
    if (!form.username) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/check-username`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: form.username }),
      });
      const data = await res.json();
      if (data.isPlaceholder) setStep("verify");
    } catch {}
  };

  const handleCheckVerification = useCallback(async () => {
    setVerifyStatus("checking");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/verify-srdc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: form.username, apiKey }),
      });
      const data = await res.json();
      if (data.verified) {
        setVerifyStatus("verified");
        setStep("claim");
      } else {
        setVerifyStatus("failed");
      }
    } catch {
      setVerifyStatus("failed");
    }
  }, [form.username, apiKey]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Registration failed"); return; }
      login(data.user, data.token);
      router.replace("/");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link href="/" className="auth-back">← Back</Link>
        <div className="auth-header">
          <div className="auth-icon">⚡</div>
          <h1 className="auth-title">Create Account</h1>
          <p className="auth-subtitle">
            {step === "verify" ? "Verify your speedrun.com account" : step === "claim" ? "Almost there! Set your credentials" : "Join the wizarding speedrun community"}
          </p>
        </div>

        {step === "form" && (
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="auth-field">
              <label className="auth-label">Username</label>
              <input className="auth-input" type="text" name="username" value={form.username} onChange={handleChange} onBlur={handleUsernameBlur} placeholder="e.g. HarryPotter99" required autoComplete="off" />
            </div>
            <div className="auth-field">
              <label className="auth-label">Email</label>
              <input className="auth-input" type="email" name="email" value={form.email} onChange={handleChange} placeholder="you@example.com" required autoComplete="email" />
            </div>
            <div className="auth-field">
              <label className="auth-label">Password</label>
              <input className="auth-input" type="password" name="password" value={form.password} onChange={handleChange} placeholder="••••••••" required autoComplete="new-password" />
            </div>
            {error && <p className="auth-error">{error}</p>}
            <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>
        )}

        {step === "verify" && (
          <div className="auth-form">
            <p style={{ marginBottom: "1rem", fontSize: "0.9rem", opacity: 0.8 }}>
              The username <strong>{form.username}</strong> exists in our database from speedrun.com. To claim it, enter your speedrun.com API key to verify ownership.
            </p>
            <div className="auth-field">
              <label className="auth-label">speedrun.com API Key</label>
              <input className="auth-input" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Your SRDC API key" autoComplete="off" />
              <span style={{ fontSize: "0.75rem", opacity: 0.5, marginTop: "0.25rem" }}>
                Found at speedrun.com → Settings → API Key. We use it once to verify your identity and never store it.
              </span>
            </div>
            {verifyStatus === "failed" && <p className="auth-error">Invalid API key or key doesn't match this account.</p>}
            <button className="btn btn-primary auth-submit" onClick={handleCheckVerification} disabled={verifyStatus === "checking" || !apiKey}>
              {verifyStatus === "checking" ? "Verifying..." : "Verify Account"}
            </button>
            <button className="btn auth-submit" style={{ marginTop: "0.5rem", opacity: 0.6 }} onClick={() => setStep("form")}>
              This isn't my account
            </button>
          </div>
        )}

        {step === "claim" && (
          <form onSubmit={handleSubmit} className="auth-form">
            <p style={{ marginBottom: "1rem", fontSize: "0.9rem", color: "#4ade80" }}>✓ Verified! You can now set your email and password.</p>
            <div className="auth-field">
              <label className="auth-label">Email</label>
              <input className="auth-input" type="email" name="email" value={form.email} onChange={handleChange} placeholder="you@example.com" required autoComplete="email" />
            </div>
            <div className="auth-field">
              <label className="auth-label">Password</label>
              <input className="auth-input" type="password" name="password" value={form.password} onChange={handleChange} placeholder="••••••••" required autoComplete="new-password" />
            </div>
            {error && <p className="auth-error">{error}</p>}
            <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
              {loading ? "Claiming account..." : "Claim Account"}
            </button>
          </form>
        )}

        <p className="auth-switch">
          Already have an account?{" "}
          <Link href="/login" className="auth-switch-link">Sign in</Link>
        </p>
      </div>
    </div>
  );
}