import { useState, useMemo } from "react";
import { Category, VariableValue, TimeParts } from "../types/submission";

interface UseSubmitRunFormProps {
  token: string | null;
  selectedGame: string;
  selectedPlatform: string;
  selectedCategory: string;
  selectedCategoryData: Category | undefined;
  isGametime: boolean;
  runners: { id: string }[];
}

export function useSubmitRunForm({
  token,
  selectedGame,
  selectedPlatform,
  selectedCategory,
  selectedCategoryData,
  isGametime,
  runners,
}: UseSubmitRunFormProps) {
  // --- Basic Input States ---
  const [selectedSubcategory, setSelectedSubcategory] = useState("");
  const [selectedVariableValues, setSelectedVariableValues] = useState<
    Record<string, string>
  >({});
  const [selectedSystem, setSelectedSystem] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [comment, setComment] = useState("");

  // --- Time States ---
  const [rtaParts, setRtaParts] = useState<TimeParts>({
    h: "",
    m: "",
    s: "",
    ms: "",
  });
  const [igtParts, setIgtParts] = useState<TimeParts>({
    h: "",
    m: "",
    s: "",
    ms: "",
  });

  // --- UI States ---
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // --- Derived Logic (The "Brain") ---
  const subcategoryVariables = useMemo(
    () => selectedCategoryData?.variables.filter((v) => v.is_subcategory) ?? [],
    [selectedCategoryData],
  );

  const selectedValueObjects = useMemo(() => {
    return subcategoryVariables
      .map((v) => {
        const valueId = selectedVariableValues[v.id];
        return v.values.find((val) => val.id === valueId);
      })
      .filter((v): v is VariableValue => v !== undefined);
  }, [subcategoryVariables, selectedVariableValues]);

  const isCoop = selectedValueObjects.some((v) => v.is_coop);

  const requiredPlayers = useMemo(
    () =>
      selectedValueObjects
        .filter((v) => v.is_coop && v.required_players)
        .reduce((max, v) => Math.max(max, v.required_players ?? 0), 0) || null,
    [selectedValueObjects],
  );

  // --- Helper Methods ---
  const calculateMs = (parts: TimeParts) => {
    return (
      parseInt(parts.h || "0") * 3600000 +
      parseInt(parts.m || "0") * 60000 +
      parseInt(parts.s || "0") * 1000 +
      parseInt(parts.ms || "0")
    );
  };

  const resetForm = () => {
    setRtaParts({ h: "", m: "", s: "", ms: "" });
    setIgtParts({ h: "", m: "", s: "", ms: "" });
    setVideoUrl("");
    setComment("");
    setSelectedVariableValues({});
    setSelectedSubcategory("");
    setSelectedSystem("");
  };

  // --- Submit Handler ---
  const handleSubmit = async (
    e: React.FormEvent,
    runnersOverride?: { id: string }[],
  ) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    const rta = calculateMs(rtaParts);
    const igt = calculateMs(igtParts);

    const runnersToSubmit = runnersOverride || runners;

    // Basic Validation
    if (rta <= 0) return setError("Please enter a valid RTA time");
    if (!videoUrl) return setError("Video URL is required");
    if (isCoop && requiredPlayers && runnersToSubmit.length !== requiredPlayers) {
      return setError(
        `This category requires exactly ${requiredPlayers} runners`,
      );
    }

    const variable_values = subcategoryVariables
      .filter((v) => selectedVariableValues[v.id])
      .map((v) => ({
        variable_slug: v.slug,
        value_slug: v.values.find(
          (val) => val.id === selectedVariableValues[v.id],
        )?.slug,
      }))
      .filter((v) => v.value_slug);

    const finalIgt = isGametime && igt <= 0 ? rta : igt;

    setSubmitting(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/runs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          game_slug: selectedGame,
          platform_slug: selectedPlatform,
          category_slug: selectedCategory,
          subcategory_slug: selectedSubcategory || undefined,
          variable_values,
          realtime_ms: rta,
          gametime_ms: finalIgt > 0 ? finalIgt : null,
          video_url: videoUrl,
          comment: comment || "",
          system_id: selectedSystem || undefined,
          ...(isCoop && { runner_ids: runnersToSubmit.map((r) => r.id) }),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit run");

      setSuccess(true);
      resetForm();
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  return {
    states: {
      selectedSubcategory,
      setSelectedSubcategory,
      selectedVariableValues,
      setSelectedVariableValues,
      selectedSystem,
      setSelectedSystem,
      videoUrl,
      setVideoUrl,
      comment,
      setComment,
      rtaParts,
      setRtaParts,
      igtParts,
      setIgtParts,
      submitting,
      error,
      success,
    },
    helpers: { isCoop, requiredPlayers, subcategoryVariables },
    handleSubmit,
  };
}
