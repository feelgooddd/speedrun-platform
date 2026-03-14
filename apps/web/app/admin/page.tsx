"use client";
import { useState, useEffect } from "react";
import { useAuth } from "../components/auth/AuthContext";
import { useRouter } from "next/navigation";
import AdminGamesTab from "@/app/components/admin/AdminGamesTab";
import AdminRunsTab from "@/app/components/admin/AdminRunsTab";
import { QueueRun } from "../components/admin/AdminRunCard";
import AdminUsersTab from "@/app/components/admin/AdminUsersTab";
import "../styles/admin.css";

type GameTab = "create" | "categories" | "variables" | "dependencies";

interface Platform {
  id: string;
  name: string;
  slug: string;
  timing_method: string;
}

interface Game {
  id: string;
  slug: string;
  name: string;
  platforms: Platform[];
}

type Tab = "games" | "runs" | "users";

// ----------------------------------------------------------------
// AdminPage
// ----------------------------------------------------------------
export default function AdminPage() {
  const { user, loading: authLoading, token } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("games");
  const [games, setGames] = useState<Game[]>([]);
  const [loadingGames, setLoadingGames] = useState(true);


  // Runs queue
  const [queueRuns, setQueueRuns] = useState<QueueRun[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueError, setQueueError] = useState("");
  const [rejectRunId, setRejectRunId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    if (user.role !== "admin") {
      router.push("/");
      return;
    }
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/games`)
      .then((res) => res.json())
      .then((data) => setGames(data))
      .catch(console.error)
      .finally(() => setLoadingGames(false));
  }, [user, authLoading, router]);

  useEffect(() => {
    if (activeTab !== "runs") return;
    setQueueLoading(true);
    setQueueError("");
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/moderation/queue`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setQueueRuns(data.runs || []))
      .catch(() => setQueueError("Failed to load mod queue"))
      .finally(() => setQueueLoading(false));
  }, [activeTab, token]);

  const handleVerifyRun = async (runId: string) => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/moderation/runs/${runId}/verify`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ verified: true }),
        },
      );
      if (!res.ok) throw new Error("Failed to verify run");
      setQueueRuns((prev) => prev.filter((r) => r.id !== runId));
    } catch (err: any) {
      setQueueError(err.message);
    }
  };

  const handleRejectRun = async (runId: string) => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/moderation/runs/${runId}/verify`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            verified: false,
            rejected: true,
            reject_reason: rejectReason,
          }),
        },
      );
      if (!res.ok) throw new Error("Failed to reject run");
      setQueueRuns((prev) => prev.filter((r) => r.id !== runId));
      setRejectRunId(null);
      setRejectReason("");
    } catch (err: any) {
      setQueueError(err.message);
    }
  };

  if (authLoading) return null;
  if (!user || user.role !== "admin") return null;

  return (
    <div className="landing">
      <div className="section" style={{ paddingTop: "6rem" }}>
        <div className="section-header">
          <h1 className="section-title">Admin Panel</h1>
          <p className="section-subtitle">Manage games, runs, and users</p>
        </div>

        {/* Tabs */}
        <div className="leaderboard-tabs admin-page-tabs">
          {(["games", "runs", "users"] as Tab[]).map((tab) => (
            <button
              key={tab}
              className={`leaderboard-tab ${activeTab === tab ? "active" : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* ── Games Tab ── */}

        {activeTab === "games" && (
          <AdminGamesTab
            games={games}
            token={token}
            onGameCreated={(game) => setGames((prev) => [...prev, game])}
          />
        )}

        {/* ── Runs Tab ── */}
        {activeTab === "runs" && (
          <AdminRunsTab
            runs={queueRuns}
            loading={queueLoading}
            error={queueError}
            rejectRunId={rejectRunId}
            rejectReason={rejectReason}
            onVerify={handleVerifyRun}
            onRejectToggle={(id) =>
              setRejectRunId(rejectRunId === id ? null : id)
            }
            onRejectReasonChange={setRejectReason}
            onRejectConfirm={handleRejectRun}
          />
        )}

        {/* ── Users Tab ── */}
        {activeTab === "users" && <AdminUsersTab games={games} token={token} />}
      </div>
    </div>
  );
}
