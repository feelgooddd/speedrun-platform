"use client";
import { useState, useEffect } from "react";

interface Platform {
  id: string;
  name: string;
  slug: string;
}

interface Game {
  id: string;
  slug: string;
  name: string;
  platforms: Platform[];
}

interface VariableValue {
  id: string;
  name: string;
  slug: string;
  is_coop: boolean;
  hidden_variables: { variable_id: string }[];
}

interface Variable {
  id: string;
  name: string;
  slug: string;
  is_subcategory: boolean;
  values: VariableValue[];
}

interface Category {
  id: string;
  name: string;
  slug: string;
  variables: Variable[];
}

export default function DependencyForm({ games, token }: { games: Game[]; token: string | null }) {
  const [gameSlug, setGameSlug] = useState("");
  const [platformSlug, setPlatformSlug] = useState("");
  const [categorySlug, setCategorySlug] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);

  // Which value is being edited
  const [selectedValueId, setSelectedValueId] = useState<string | null>(null);
  const [hasHidden, setHasHidden] = useState<boolean | null>(null);
  const [selectedVarIds, setSelectedVarIds] = useState<string[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedPlatforms = games.find((g) => g.slug === gameSlug)?.platforms || [];
  const selectedCategory = categories.find((c) => c.slug === categorySlug) ?? null;

  // Fetch categories (with variables + values + hidden_variables) when game+platform selected
  useEffect(() => {
    if (!gameSlug || !platformSlug) { setCategories([]); setCategorySlug(""); return; }
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/games/${gameSlug}/${platformSlug}/categories`)
      .then((r) => r.json())
      .then((d) => setCategories(d.categories || []))
      .catch(console.error);
  }, [gameSlug, platformSlug]);

  // When category changes, reset selection
  useEffect(() => {
    setSelectedValueId(null);
    setHasHidden(null);
    setSelectedVarIds([]);
    setError("");
    setSuccess("");
  }, [categorySlug]);

  const selectValue = (value: VariableValue, allVariables: Variable[], ownerVariableId: string) => {
    setSelectedValueId(value.id);
    setSuccess("");
    setError("");

    const existingHidden = value.hidden_variables?.map((h) => h.variable_id) ?? [];
    setSelectedVarIds(existingHidden);
    setHasHidden(existingHidden.length > 0 ? true : null);
  };

  const toggleVarId = (id: string) => {
    setSelectedVarIds((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    );
  };

  const handleSave = async (ownerVariableId: string) => {
    if (!selectedValueId) return;
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/games/variable-values/${selectedValueId}/hidden-variables`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ variable_ids: hasHidden ? selectedVarIds : [] }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");

      // Update local state so UI reflects saved state without refetch
      setCategories((prev) =>
        prev.map((cat) =>
          cat.slug !== categorySlug ? cat : {
            ...cat,
            variables: cat.variables.map((v) => ({
              ...v,
              values: v.values.map((val) =>
                val.id !== selectedValueId ? val : {
                  ...val,
                  hidden_variables: (hasHidden ? selectedVarIds : []).map((id) => ({ variable_id: id })),
                }
              ),
            })),
          }
        )
      );

      setSuccess("Dependencies saved.");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      {/* Game / Platform / Category selects */}
      <div className="form-group">
        <label className="form-label">Game, Platform & Category</label>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <select
            className="auth-input"
            value={gameSlug}
            onChange={(e) => { setGameSlug(e.target.value); setPlatformSlug(""); setCategorySlug(""); }}
            style={{ flex: 1, minWidth: "120px" }}
          >
            <option value="">Game</option>
            {games.map((g) => <option key={g.id} value={g.slug}>{g.name}</option>)}
          </select>
          <select
            className="auth-input"
            value={platformSlug}
            onChange={(e) => { setPlatformSlug(e.target.value); setCategorySlug(""); }}
            disabled={!gameSlug}
            style={{ flex: 1, minWidth: "100px" }}
          >
            <option value="">Platform</option>
            {selectedPlatforms.map((p) => <option key={p.id} value={p.slug}>{p.name}</option>)}
          </select>
          <select
            className="auth-input"
            value={categorySlug}
            onChange={(e) => setCategorySlug(e.target.value)}
            disabled={!platformSlug}
            style={{ flex: 1, minWidth: "100px" }}
          >
            <option value="">Category</option>
            {categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {/* Variables + Values */}
      {selectedCategory && (
        <div style={{ marginTop: "1rem" }}>
          {selectedCategory.variables.length === 0 && (
            <p style={{ color: "#555", fontSize: "0.85rem" }}>No variables in this category.</p>
          )}

          {selectedCategory.variables.map((variable) => (
            <div
              key={variable.id}
              style={{ marginBottom: "1.25rem", padding: "0.75rem", background: "rgba(255,255,255,0.03)", border: "1px solid var(--card-border)", borderRadius: "4px" }}
            >
              {/* Variable header */}
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                <span style={{ fontFamily: "'Cinzel', serif", fontSize: "0.75rem", letterSpacing: "0.08em", color: "#ddd" }}>{variable.name}</span>
                <span style={{ fontSize: "0.6rem", fontFamily: "'Cinzel', serif", letterSpacing: "0.1em", textTransform: "uppercase", padding: "0.15rem 0.5rem", borderRadius: "2px", border: "1px solid", color: variable.is_subcategory ? "var(--accent)" : "#555", borderColor: variable.is_subcategory ? "var(--accent)" : "#333" }}>
                  {variable.is_subcategory ? "Subcategory" : "Filter"}
                </span>
              </div>

              {/* Values */}
              {variable.values.map((value) => {
                const isSelected = selectedValueId === value.id;
                const existingHiddenCount = value.hidden_variables?.length ?? 0;

                return (
                  <div key={value.id} style={{ marginBottom: "0.5rem" }}>
                    {/* Value row */}
                    <div
                      style={{
                        display: "flex", alignItems: "center", gap: "0.75rem",
                        padding: "0.4rem 0.6rem",
                        background: isSelected ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.02)",
                        border: `1px solid ${isSelected ? "var(--accent)" : "rgba(255,255,255,0.06)"}`,
                        borderRadius: "2px", cursor: "pointer",
                      }}
                      onClick={() => selectValue(value, selectedCategory.variables, variable.id)}
                    >
                      <span style={{ fontFamily: "'Cinzel', serif", fontSize: "0.75rem", color: "#ccc", flex: 1 }}>{value.name}</span>
                      {value.is_coop && <span style={{ fontSize: "0.65rem", color: "#555", fontFamily: "'Cinzel', serif" }}>co-op</span>}
                      {existingHiddenCount > 0 && (
                        <span style={{ fontSize: "0.65rem", color: "var(--accent)", fontFamily: "'Cinzel', serif", letterSpacing: "0.08em" }}>
                          hides {existingHiddenCount} var{existingHiddenCount > 1 ? "s" : ""}
                        </span>
                      )}
                      <span style={{ fontSize: "0.65rem", color: "#444" }}>{isSelected ? "▲" : "▼"}</span>
                    </div>

                    {/* Expanded dependency editor */}
                    {isSelected && (
                      <div style={{ padding: "0.75rem", borderLeft: "2px solid rgba(255,255,255,0.06)", marginLeft: "0.5rem" }}>
                        {/* Yes/No */}
                        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.75rem" }}>
                          <span style={{ fontFamily: "'Cinzel', serif", fontSize: "0.7rem", letterSpacing: "0.08em", color: "#bbb" }}>
                            Does selecting <strong style={{ color: "#fff" }}>{value.name}</strong> hide any variables?
                          </span>
                          <div style={{ display: "flex", gap: "0.35rem" }}>
                            {["Yes", "No"].map((opt) => (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => { setHasHidden(opt === "Yes"); if (opt === "No") setSelectedVarIds([]); }}
                                style={{
                                  background: "none",
                                  border: `1px solid ${hasHidden === (opt === "Yes") ? "var(--accent)" : "#333"}`,
                                  borderRadius: "2px",
                                  cursor: "pointer",
                                  fontFamily: "'Cinzel', serif",
                                  fontSize: "0.65rem",
                                  letterSpacing: "0.1em",
                                  textTransform: "uppercase",
                                  color: hasHidden === (opt === "Yes") ? "var(--accent)" : "#555",
                                  padding: "0.3rem 0.75rem",
                                }}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Variable checklist */}
                        {hasHidden === true && (
                          <div style={{ marginBottom: "0.75rem" }}>
                            <div style={{ fontSize: "0.65rem", fontFamily: "'Cinzel', serif", letterSpacing: "0.1em", textTransform: "uppercase", color: "#555", marginBottom: "0.5rem" }}>
                              Hide these variables:
                            </div>
                            {selectedCategory.variables
                              .filter((v) => v.id !== variable.id)
                              .map((v) => (
                                <label
                                  key={v.id}
                                  style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem", cursor: "pointer" }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedVarIds.includes(v.id)}
                                    onChange={() => toggleVarId(v.id)}
                                  />
                                  <span style={{ fontFamily: "'Cinzel', serif", fontSize: "0.75rem", color: "#ccc" }}>{v.name}</span>
                                  <span style={{ fontSize: "0.65rem", color: "#444" }}>/{v.slug}</span>
                                </label>
                              ))}
                            {selectedCategory.variables.filter((v) => v.id !== variable.id).length === 0 && (
                              <p style={{ fontSize: "0.8rem", color: "#555" }}>No other variables in this category.</p>
                            )}
                          </div>
                        )}

                        {/* Save */}
                        {hasHidden !== null && (
                          <>
                            {error && <p className="auth-error">{error}</p>}
                            {success && <p className="auth-success">{success}</p>}
                            <button
                              type="button"
                              className="btn btn-primary"
                              onClick={() => handleSave(variable.id)}
                              disabled={submitting || (hasHidden && selectedVarIds.length === 0)}
                              style={{ fontSize: "0.8rem", padding: "0.4rem 1rem" }}
                            >
                              {submitting ? "Saving..." : "Save Dependencies"}
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}