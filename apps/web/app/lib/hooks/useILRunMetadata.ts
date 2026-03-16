// @/app/lib/hooks/useILRunMetadata.ts
import { useState, useEffect, useMemo } from "react";
import { Game, Platform, Level, LevelCategory } from "../types/submission";
export function useILRunMetadata() {
  const [games, setGames] = useState<Game[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);

  const [selectedGame, setSelectedGame] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("");

  const [systems, setSystems] = useState<any[]>([]); // note to self: Add systems interface to submission types later/lazy rn.
  const [selectedSystem, setSelectedSystem] = useState("");

  const selectedPlatformData = platforms.find(
    (p) => p.slug === selectedPlatform,
  );

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/games`)
      .then((res) => res.json())
      .then(setGames);
  }, []);
  useEffect(() => {
    // Both are required for this specific route
    if (!selectedGame || !selectedPlatform) {
      setSystems([]);
      return;
    }

    // Match the Full Game route pattern exactly
    fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/games/${selectedGame}/${selectedPlatform}/systems`,
    )
      .then((res) => res.json())
      .then((data) => {
        // Full Game expects data.systems
        setSystems(data.systems || []);
      })
      .catch(console.error);
  }, [selectedGame, selectedPlatform]);

  useEffect(() => {
    if (!selectedGame) return setPlatforms([]);
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/games/${selectedGame}`)
      .then((res) => res.json())
      .then((data) => setPlatforms(data.platforms || []));
  }, [selectedGame]);

  useEffect(() => {
    if (!selectedGame || !selectedPlatform) return setLevels([]);
    fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/games/${selectedGame}/${selectedPlatform}/levels`,
    )
      .then((res) => res.json())
      .then((data) => setLevels(data.levels || []));
  }, [selectedGame, selectedPlatform]);

  const uniqueCategories = useMemo(() => {
    const seen = new Set<string>();
    // Explicitly type the array as LevelCategory[]
    const cats: LevelCategory[] = [];

    levels.forEach((l) => {
      l.level_categories.forEach((c) => {
        if (!seen.has(c.slug)) {
          seen.add(c.slug);
          cats.push(c);
        }
      });
    });
    return cats;
  }, [levels]);

  const activeLevelCategory = useMemo(() => {
    if (!selectedLevel || !selectedCategory) return undefined;
    const level = levels.find((l) => l.slug === selectedLevel);
    return level?.level_categories.find((c) => c.slug === selectedCategory);
  }, [levels, selectedLevel, selectedCategory]);

  const availableLevels = useMemo(
    (): Level[] =>
      levels.filter((l) =>
        l.level_categories.some((c) => c.slug === selectedCategory),
      ),
    [levels, selectedCategory],
  );

  return {
    games,
    platforms,
    levels,
    uniqueCategories,
    availableLevels,
    selectedGame,
    setSelectedGame,
    selectedPlatform,
    setSelectedPlatform,
    selectedCategory,
    setSelectedCategory,
    selectedLevel,
    setSelectedLevel,
    selectedPlatformData,
    systems,
    selectedSystem,
    setSelectedSystem,
    activeLevelCategory,
  };
}
