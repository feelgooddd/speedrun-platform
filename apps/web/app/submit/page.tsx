"use client";
import { useState } from "react";
import { useAuth } from "../components/auth/AuthContext";
import Link from "next/link";
import SubmitFullGameRun from "../components/submit/SubmitFullGameRun";
import SubmitILRun from "../components/submit/SubmitILRun";

export default function SubmitRunPage() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<"fullgame" | "il">("fullgame");

  if (loading) return null;

  if (!user) {
    return (
      <div className="landing">
        <div className="section" style={{ paddingTop: "6rem" }}>
          <div className="section-header">
            <h1 className="section-title">Submit Run</h1>
            <p className="section-subtitle">
              You must be logged in to submit runs
            </p>
          </div>
          <div style={{ textAlign: "center", marginTop: "2rem" }}>
            <Link href="/login" className="btn btn-primary">
              Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="landing">
      <div className="section" style={{ paddingTop: "6rem" }}>
        <div className="section-header">
          <h1 className="section-title">Submit Run</h1>
          <p className="section-subtitle">
            Submit your speedrun for verification
          </p>
        </div>

        <div style={{ maxWidth: "600px", margin: "0 auto" }}>
          {/* Tab toggle */}
          <div className="leaderboard-tabs" style={{ marginBottom: "2rem" }}>
            <button
              className={`leaderboard-tab ${activeTab === "fullgame" ? "active" : ""}`}
              onClick={() => setActiveTab("fullgame")}
            >
              Full Game
            </button>
            <button
              className={`leaderboard-tab ${activeTab === "il" ? "active" : ""}`}
              onClick={() => setActiveTab("il")}
            >
              Individual Level
            </button>
          </div>

          {activeTab === "fullgame" && <SubmitFullGameRun />}
          {activeTab === "il" && <SubmitILRun />}
        </div>
      </div>
    </div>
  );
}