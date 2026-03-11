import { useState, useEffect } from "react";
import { Game, Platform, Category } from "../types/submission"; // Adjust import path

export function useRunMetadata() {
  const [games, setGames] = useState<Game[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [systems, setSystems] = useState<{ id: string; name: string }[]>([]);

  const [selectedGame, setSelectedGame] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");

  const selectedPlatformData = platforms.find(
    (p) => p.slug === selectedPlatform,
  );
  const selectedCategoryData = categories.find(
    (c) => c.slug === selectedCategory,
  );

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  // Initial load
  useEffect(() => {
    fetch(`${apiUrl}/games`)
      .then((res) => res.json())
      .then(setGames);
  }, [apiUrl]);

  // Fetch Platforms
  useEffect(() => {
    if (!selectedGame) {
      setPlatforms([]);
      return;
    }
    fetch(`${apiUrl}/games/${selectedGame}`)
      .then((res) => res.json())
      .then((data) => setPlatforms(data.platforms || []));
  }, [selectedGame, apiUrl]);

  // Fetch Categories & Systems
  useEffect(() => {
    if (!selectedGame || !selectedPlatform) {
      setCategories([]);
      setSystems([]);
      return;
    }
    const baseUrl = `${apiUrl}/games/${selectedGame}/${selectedPlatform}`;

    fetch(`${baseUrl}/categories`)
      .then((res) => res.json())
      .then((data) => setCategories(data.categories || []));
    fetch(`${baseUrl}/systems`)
      .then((res) => res.json())
      .then((data) => setSystems(data.systems || []));
  }, [selectedGame, selectedPlatform, apiUrl]);

  return {
    games,
    platforms,
    categories,
    systems,
    selectedGame,
    setSelectedGame,
    selectedPlatform,
    setSelectedPlatform,
    selectedCategory,
    setSelectedCategory,
    selectedCategoryData, // Add this
    selectedPlatformData, // Add this
  };
}
