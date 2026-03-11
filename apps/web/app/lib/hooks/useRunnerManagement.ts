import { useState, useEffect, useRef } from "react";
import { Runner } from "../types/submission"

export function useRunnerManagement(user: any, token: string | null, isCoop: boolean, requiredPlayers: number | null) {
  const [runners, setRunners] = useState<Runner[]>([]);
  const [runnerSearch, setRunnerSearch] = useState("");
  const [runnerResults, setRunnerResults] = useState<Runner[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  // Sync current user to runners list if co-op
  useEffect(() => {
    if (isCoop && user) {
      setRunners(prev => prev.some(r => r.id === user.id) ? prev : [
        { id: user.id, username: user.username, display_name: user.display_name, country: user.country },
        ...prev
      ]);
    } else {
      setRunners([]);
    }
  }, [isCoop, user]);

  // Search Logic
  useEffect(() => {
    if (runnerSearch.length < 2) { setRunnerResults([]); return; }
    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/search?q=${encodeURIComponent(runnerSearch)}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        setRunnerResults((data.users || []).filter((u: Runner) => !runners.some(r => r.id === u.id)));
      } finally {
        setSearching(false);
      }
    }, 300);
  }, [runnerSearch, token, runners]);

  const addRunner = (runner: Runner) => {
    if (requiredPlayers && runners.length >= requiredPlayers) return;
    setRunners(prev => [...prev, runner]);
    setRunnerSearch("");
  };

  const removeRunner = (id: string) => {
    if (id === user?.id) return;
    setRunners(prev => prev.filter(r => r.id !== id));
  };

  return { runners, setRunners, runnerSearch, setRunnerSearch, runnerResults, searching, addRunner, removeRunner };
}