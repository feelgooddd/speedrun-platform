import { useState, useMemo } from "react";
import { Category, VariableValue, TimeParts, Level } from "../types/submission";

interface UseSubmitRunFormProps {
  token: string | null;
  selectedGame: string;
  selectedPlatform: string;
  selectedCategory: string;
  selectedCategoryData?: Category | undefined;
  isGametime: boolean;
  runners: { id: string }[];
  isIL?: boolean;
  selectedLevel?: string;
  levels?: Level[];
}

export function useSubmitRunForm({
  token,
  selectedGame,
  selectedPlatform,
  selectedCategory,
  selectedCategoryData,
  isGametime,
  runners,
  isIL = false,
  selectedLevel,
  levels = [],
}: UseSubmitRunFormProps) {
  const [selectedSubcategory, setSelectedSubcategory] = useState("");
  const [selectedVariableValues, setSelectedVariableValues] = useState<
    Record<string, string>
  >({});
  const [selectedSystem, setSelectedSystem] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [comment, setComment] = useState("");
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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [scoreValue, setScoreValue] = useState<string>("");

  // All variables for this category
  const allVariables = useMemo(
    () => selectedCategoryData?.variables ?? [],
    [selectedCategoryData],
  );

  // Compute hidden variable IDs based on current selections
  const hiddenVariableIds = useMemo(() => {
    const hidden = new Set<string>();
    for (const variable of allVariables) {
      const selectedValueId = selectedVariableValues[variable.id];

      if (!selectedValueId) {
        // No selection yet — hide any variables that ANY value of this variable would hide
        for (const val of variable.values) {
          for (const h of val.hidden_variables ?? []) {
            hidden.add(h.variable_id);
          }
        }
        continue;
      }

      const activeValue = variable.values.find((v) => v.id === selectedValueId);
      if (!activeValue?.hidden_variables) continue;
      for (const h of activeValue.hidden_variables) {
        hidden.add(h.variable_id);
      }
    }
    return hidden;
  }, [allVariables, selectedVariableValues]);

  // Only show/submit variables that aren't hidden
  const subcategoryVariables = useMemo(
    () => allVariables.filter((v) => !hiddenVariableIds.has(v.id)),
    [allVariables, hiddenVariableIds],
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
    setScoreValue("");
  };

  const handleSubmit = async (
    e: React.FormEvent,
    runnersOverride?: { id: string }[],
  ): Promise<boolean> => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    const rta = calculateMs(rtaParts);
    const igt = calculateMs(igtParts);
    const runnersToSubmit = runnersOverride || runners;

    const isScored = !!scoreValue;
    if (rta <= 0 && !isScored) {
      setError("Please enter a valid RTA time");
      return false;
    }
    if (!videoUrl) {
      setError("Video URL is required");
      return false;
    }
    if (
      isCoop &&
      requiredPlayers &&
      runnersToSubmit.length !== requiredPlayers
    ) {
      setError(`This category requires exactly ${requiredPlayers} runners`);
      return false;
    }

    let levelCategoryId: string | undefined;
    if (isIL && selectedLevel) {
      const level = levels.find((l) => l.slug === selectedLevel);
      levelCategoryId = level?.level_categories.find(
        (c) => c.slug === selectedCategory,
      )?.id;
      if (!levelCategoryId) {
        setError("Could not resolve level category");
        return false;
      }
    }

    const finalIgt = isGametime && igt <= 0 ? rta : igt;

    setSubmitting(true);
    try {
      const payload: any = {
        game_slug: selectedGame,
        platform_slug: selectedPlatform,
        realtime_ms: isScored ? null : rta,
        gametime_ms: isScored ? null : finalIgt > 0 ? finalIgt : null,
        video_url: videoUrl,
        comment: comment || "",
        system_id: selectedSystem || undefined,
        score_value: scoreValue ? parseInt(scoreValue) : null,

        ...(runnersToSubmit.length > 0 && {
          runner_ids: runnersToSubmit.map((r) => r.id),
        }),
      };

      if (isIL) {
        payload.level_category_id = levelCategoryId;
        payload.variable_values = subcategoryVariables
          .filter((v) => selectedVariableValues[v.id])
          .map((v) => ({
            variable_slug: v.slug,
            value_slug: v.values.find(
              (val) => val.id === selectedVariableValues[v.id],
            )?.slug,
          }))
          .filter((v) => v.value_slug);
      } else {
        payload.category_slug = selectedCategory;
        payload.subcategory_slug = selectedSubcategory || undefined;
        // Only submit visible (non-hidden) variables
        payload.variable_values = subcategoryVariables
          .filter((v) => selectedVariableValues[v.id])
          .map((v) => ({
            variable_slug: v.slug,
            value_slug: v.values.find(
              (val) => val.id === selectedVariableValues[v.id],
            )?.slug,
          }))
          .filter((v) => v.value_slug);
      }

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/runs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
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
      scoreValue,
      setScoreValue,
    },
    helpers: { isCoop, requiredPlayers, subcategoryVariables },
    handleSubmit,
  };
}
