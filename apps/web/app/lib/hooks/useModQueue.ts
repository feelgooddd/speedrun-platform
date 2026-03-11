import { useState, useEffect, useMemo } from "react";
import { PendingRun } from "../types/moderation";

export function useModQueue(gameSlug: string) {
  const [allRuns, setAllRuns] = useState<PendingRun[]>([]);
  const [gameName, setGameName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState<Record<string, boolean>>({});

  // Derived state: No more manual filtering in handlers!
  const queue = useMemo(() => ({
    pending: allRuns.filter(r => !r.rejected && !r.is_il),
    pendingIL: allRuns.filter(r => !r.rejected && r.is_il),
    rejected: allRuns.filter(r => r.rejected && !r.is_il),
    rejectedIL: allRuns.filter(r => r.rejected && r.is_il),
  }), [allRuns]);

  useEffect(() => {
    if (!gameSlug) return;
    const fetchQueue = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/moderation/${gameSlug}/mod-queue`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        setAllRuns(data.runs || []);
        setGameName(data.game || gameSlug);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchQueue();
  }, [gameSlug]);

const verifyRun = async (runId: string, approve: boolean, reason?: string) => {
  setProcessing(p => ({ ...p, [runId]: true }));
  try {
    const token = localStorage.getItem("token");
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/moderation/runs/${runId}/verify`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ verified: approve, reject_reason: reason }),
    });

    if (!res.ok) throw new Error("Verification failed");

    setAllRuns(prev => {
      if (approve) {
        // If approved, most people want it to disappear from the Mod Queue entirely.
        return prev.filter(r => r.id !== runId);
      } else {
        // If rejected, we update the status so it moves to the "Rejected" section
        return prev.map(r => 
          r.id === runId ? { ...r, rejected: true, reject_reason: reason } : r
        );
      }
    });
    
    return true;
  } catch (err: any) {
    setError(err.message);
    return false;
  } finally {
    setProcessing(p => ({ ...p, [runId]: false }));
  }
};

  return { queue, gameName, loading, error, processing, verifyRun, setError };
}