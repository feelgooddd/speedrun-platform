"use client";
import { useAuth } from "../auth/AuthContext";
import { useILRunMetadata } from "@/app/lib/hooks/useILRunMetadata";
import { useSubmitRunForm } from "@/app/lib/hooks/useSubmitRunForm";

import StatusMessages from "./StatusMessages";
import TimeInputGroup from "./TimeInputGroup";
import LoginRequiredView from "./LoginRequiredView";

export default function SubmitILRun() {
  const { user, loading, token } = useAuth();

  const {
    games,
    platforms,
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
    levels,
    systems,
    activeLevelCategory,
  } = useILRunMetadata();

  const isGametime = selectedPlatformData?.timing_method === "gametime";

  const { states, handleSubmit, helpers } = useSubmitRunForm({
    token,
    selectedGame,
    selectedPlatform,
    selectedCategory,
    selectedCategoryData: activeLevelCategory as any,
    isGametime,
    runners: user ? [{ id: user.id }] : [],
    isIL: true,
    selectedLevel,
    levels,
  });

  const finalHandleSubmit = async (e: React.FormEvent) => {
    const wasSuccessful = await handleSubmit(e);
    if (wasSuccessful) {
      setSelectedGame("");
      setSelectedPlatform("");
      setSelectedCategory("");
      setSelectedLevel("");
    }
  };

  if (loading) return null;
  if (!user) return <LoginRequiredView />;

  return (
    <div className="landing">
      <div className="section" style={{ paddingTop: "6rem" }}>
        <header className="section-header">
          <h1 className="section-title">Submit Individual Level</h1>
          <p className="section-subtitle">
            Post your best time for a specific level
          </p>
        </header>

        <div style={{ maxWidth: "600px", margin: "0 auto" }}>
          <StatusMessages success={states.success} error={states.error} />

          <form onSubmit={finalHandleSubmit}>
            <div className="form-group">
              <label className="form-label">Game *</label>
              <select
                value={selectedGame}
                onChange={(e) => setSelectedGame(e.target.value)}
                required
                className="auth-input"
              >
                <option value="">Select a game</option>
                {games.map((g) => (
                  <option key={g.id} value={g.slug}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedGame && (
              <div className="form-group">
                <label className="form-label">Platform *</label>
                <select
                  value={selectedPlatform}
                  onChange={(e) => setSelectedPlatform(e.target.value)}
                  required
                  className="auth-input"
                >
                  <option value="">Select a platform</option>
                  {platforms.map((p) => (
                    <option key={p.id} value={p.slug}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {selectedPlatform && (
              <div className="form-group">
                <label className="form-label">Category *</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  required
                  className="auth-input"
                >
                  <option value="">Select a category</option>
                  {uniqueCategories.map((cat) => (
                    <option key={cat.id} value={cat.slug}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {selectedCategory && (
              <div className="form-group">
                <label className="form-label">Level *</label>
                <select
                  value={selectedLevel}
                  onChange={(e) => setSelectedLevel(e.target.value)}
                  required
                  className="auth-input"
                >
                  <option value="">Select a level</option>
                  {availableLevels.map((l) => (
                    <option key={l.id} value={l.slug}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {selectedLevel && helpers.subcategoryVariables.map((v) => (
              <div key={v.id} className="form-group">
                <label className="form-label">{v.name} *</label>
                <select
                  value={states.selectedVariableValues[v.id] || ""}
                  onChange={(e) =>
                    states.setSelectedVariableValues((prev) => ({
                      ...prev,
                      [v.id]: e.target.value,
                    }))
                  }
                  required
                  className="auth-input"
                >
                  <option value="">Select {v.name}</option>
                  {v.values.map((val) => (
                    <option key={val.id} value={val.id}>
                      {val.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}

            {selectedLevel && systems.length > 0 && (
              <div className="form-group">
                <label className="form-label">System *</label>
                <select
                  value={states.selectedSystem}
                  onChange={(e) => states.setSelectedSystem(e.target.value)}
                  required
                  className="auth-input"
                >
                  <option value="">Select a system</option>
                  {systems.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {selectedLevel && (
              <>
{activeLevelCategory?.scoring_type && (
  <div className="form-group">
    <label className="form-label">
      {activeLevelCategory.scoring_type === "highscore" ? "Score *" : "Casts *"}
    </label>
    <input
      type="number"
      value={states.scoreValue}
      onChange={(e) => states.setScoreValue(e.target.value)}
      required
      className="auth-input"
      placeholder={activeLevelCategory.scoring_type === "highscore" ? "Enter score..." : "Enter cast count..."}
    />
  </div>
)}
<TimeInputGroup
  label="Real Time Attack (RTA) *"
  parts={states.rtaParts}
  setParts={states.setRtaParts}
/>
<TimeInputGroup
  label="In-Game Time (IGT)"
  parts={states.igtParts}
  setParts={states.setIgtParts}
  disabled={!isGametime}
/>

                <div className="form-group">
                  <label className="form-label">Video URL *</label>
                  <input
                    type="url"
                    value={states.videoUrl}
                    onChange={(e) => states.setVideoUrl(e.target.value)}
                    required
                    className="auth-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Comment (optional)</label>
                  <textarea
                    value={states.comment}
                    onChange={(e) => states.setComment(e.target.value)}
                    rows={4}
                    className="auth-input"
                    style={{ resize: "vertical" }}
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary btn-full"
                  disabled={states.submitting}
                >
                  {states.submitting ? "Submitting..." : "Submit Run"}
                </button>
              </>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

