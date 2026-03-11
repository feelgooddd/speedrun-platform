"use client";
import Link from "next/link";
import StatusMessages from "./StatusMessages";
import LoginRequiredView from "./LoginRequiredView";
import { useAuth } from "../auth/AuthContext";
import { useRunMetadata } from "@/app/lib/hooks/useRunMetadata";

import { useRunnerManagement } from "@/app/lib/hooks/useRunnerManagement";
import { useSubmitRunForm } from "@/app/lib/hooks/useSubmitRunForm";

import TimeInputGroup from "./TimeInputGroup";
import RunnerSearchUI from "./RunnerSearchUI";

export default function SubmitFullGameRun() {
  const { user, loading, token } = useAuth();

  // 1. Metadata Hook (Games, Platforms, Categories, Systems)
  const {
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
    selectedCategoryData,
    selectedPlatformData,
  } = useRunMetadata();

  const isGametime = selectedPlatformData?.timing_method === "gametime";

  // 2. Submission & Form Hook
  const { states, helpers, handleSubmit } = useSubmitRunForm({
    token,
    selectedGame,
    selectedPlatform,
    selectedCategory,
    selectedCategoryData,
    isGametime,
    runners: [], // We will link this to RunnerManagement below
  });

  // 3. Runner Management Hook (Co-op logic)
  const {
    runners,
    runnerSearch,
    setRunnerSearch,
    runnerResults,
    searching,
    addRunner,
    removeRunner,
  } = useRunnerManagement(user, token, helpers.isCoop, helpers.requiredPlayers);

  // Link runners back to form submission (this is why we pass it to the hook or override here)
  const finalHandleSubmit = async (e: React.FormEvent) => {
    // We pass 'runners' from useRunnerManagement here
    const wasSuccessful = await handleSubmit(e, runners);

    if (wasSuccessful) {
      // These setters come from useRunMetadata
      setSelectedGame("");
      setSelectedPlatform("");
      setSelectedCategory("");
    }
  };

  if (loading) return null;
  if (!user) return <LoginRequiredView />;

  return (
    <div className="landing">
      <div className="section" style={{ paddingTop: "6rem" }}>
        <header className="section-header">
          <h1 className="section-title">Submit Run</h1>
          <p className="section-subtitle">
            Submit your speedrun for verification
          </p>
        </header>

        <div style={{ maxWidth: "600px", margin: "0 auto" }}>
          <StatusMessages success={states.success} error={states.error} />

          <form onSubmit={finalHandleSubmit}>
            {/* Game Selection */}
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

            {/* Platform Selection */}
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

            {/* Category Selection */}
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
                  {categories.map((c) => (
                    <option key={c.id} value={c.slug}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Dynamic HP4+ Variables */}
            {helpers.subcategoryVariables.map((v) => (
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

            {/* Legacy HP1-3 Subcategories */}
            {selectedCategoryData?.subcategories &&
              selectedCategoryData.subcategories.length > 0 && (
                <div className="form-group">
                  <label className="form-label">Subcategory *</label>
                  <select
                    value={states.selectedSubcategory}
                    onChange={(e) =>
                      states.setSelectedSubcategory(e.target.value)
                    }
                    required
                    className="auth-input"
                  >
                    <option value="">Select a subcategory</option>
                    {selectedCategoryData.subcategories.map((sub) => (
                      <option key={sub.id} value={sub.slug}>
                        {sub.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

            {/* Co-op UI (Conditional) */}
            {helpers.isCoop && (
              <RunnerSearchUI
                runners={runners}
                results={runnerResults}
                onAdd={addRunner}
                onRemove={removeRunner}
                search={runnerSearch}
                setSearch={setRunnerSearch}
                searching={searching}
                required={helpers.requiredPlayers}
                currentUser={user}
              />
            )}
{/* System Selection */}
{systems.length > 0 && (
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
            {/* Time, Video, and Comments... */}
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
                placeholder="Any additional notes about this run..."
                value={states.comment}
                onChange={(e) => states.setComment(e.target.value)}
                rows={4}
                className="auth-input"
                style={{ resize: "vertical", fontFamily: "inherit" }}
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary btn-full"
              disabled={states.submitting}
            >
              {states.submitting ? "Submitting..." : "Submit Run"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

