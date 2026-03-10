"use client";
import { useState, useEffect } from "react";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "@/app/lib/api";

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------
interface SystemOption {
  id: string;
  name: string;
}

interface VariableValueDraft {
  name: string;
  slug: string;
  is_coop: boolean;
  required_players: number;
}

interface VariableDraft {
  name: string;
  slug: string;
  values: VariableValueDraft[];
}

interface CategoryDraft {
  name: string;
  slug: string;
  variable: VariableDraft | null; // one variable per category (can be expanded later)
}

interface PlatformDraft {
  name: string;
  slug: string;
  timing_method: "realtime" | "gametime";
  systems: string[];
  categories: CategoryDraft[];
}

type Step = "game" | "platforms" | "systems" | "categories" | "confirm";

const STEPS: Step[] = ["game", "platforms", "systems", "categories", "confirm"];
const STEP_LABELS: Record<Step, string> = {
  game: "Game Details",
  platforms: "Platforms",
  systems: "Systems",
  categories: "Categories",
  confirm: "Create",
};

function slugify(str: string) {
  return str.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

// ----------------------------------------------------------------
// Component
// ----------------------------------------------------------------
export default function CreateGameWizard({ onDoneAction }: { onDoneAction: (game: any) => void }) {
  const { token } = useAuth();

  const [step, setStep] = useState<Step>("game");
  const [allSystems, setAllSystems] = useState<SystemOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Step 1
  const [gameName, setGameName] = useState("");
  const [gameSlug, setGameSlug] = useState("");

  // Step 2
  const [platforms, setPlatforms] = useState<PlatformDraft[]>([]);
  const [platForm, setPlatForm] = useState<PlatformDraft>({
    name: "", slug: "", timing_method: "realtime", systems: [], categories: [],
  });

  // Step 3
  const [activePlatIdx, setActivePlatIdx] = useState(0);
  const [systemInput, setSystemInput] = useState("");

  // Step 4
  const [catPlatIdx, setCatPlatIdx] = useState(0);
  const [expandedCatIdx, setExpandedCatIdx] = useState<number | null>(null);
  const [catForm, setCatForm] = useState({ name: "", slug: "" });
  const [varForm, setVarForm] = useState({ name: "", slug: "" });
  const [valForm, setValForm] = useState({ name: "", slug: "", is_coop: false, required_players: 2 });

  useEffect(() => {
    apiFetch("/games/systems")
      .then((r) => r.json())
      .then((d) => setAllSystems(d.systems || []))
      .catch(console.error);
  }, []);

  const currentStepIndex = STEPS.indexOf(step);

  const canAdvance = () => {
    if (step === "game") return gameName.trim() && gameSlug.trim();
    if (step === "platforms") return platforms.length > 0;
    return true;
  };

  const advance = () => { const next = STEPS[currentStepIndex + 1]; if (next) setStep(next); };
  const back = () => { const prev = STEPS[currentStepIndex - 1]; if (prev) setStep(prev); };

  // ----------------------------------------------------------------
  // Platforms
  // ----------------------------------------------------------------
  const addPlatform = () => {
    if (!platForm.name.trim() || !platForm.slug.trim()) return;
    setPlatforms((prev) => [...prev, { ...platForm, systems: [], categories: [] }]);
    setPlatForm({ name: "", slug: "", timing_method: "realtime", systems: [], categories: [] });
  };
  const removePlatform = (i: number) => setPlatforms((prev) => prev.filter((_, idx) => idx !== i));

  // ----------------------------------------------------------------
  // Systems
  // ----------------------------------------------------------------
  const addSystemToPlatform = (platIdx: number, name: string) => {
    if (!name.trim()) return;
    setPlatforms((prev) => prev.map((p, i) => i === platIdx && !p.systems.includes(name) ? { ...p, systems: [...p.systems, name] } : p));
    setSystemInput("");
  };
  const removeSystemFromPlatform = (platIdx: number, name: string) => {
    setPlatforms((prev) => prev.map((p, i) => i === platIdx ? { ...p, systems: p.systems.filter((s) => s !== name) } : p));
  };

  // ----------------------------------------------------------------
  // Categories
  // ----------------------------------------------------------------
  const addCategoryToPlatform = (platIdx: number) => {
    if (!catForm.name.trim() || !catForm.slug.trim()) return;
    setPlatforms((prev) => prev.map((p, i) => i === platIdx ? { ...p, categories: [...p.categories, { name: catForm.name, slug: catForm.slug, variable: null }] } : p));
    setExpandedCatIdx(platforms[platIdx].categories.length);
    setCatForm({ name: "", slug: "" });
    setVarForm({ name: "", slug: "" });
  };
  const removeCategoryFromPlatform = (platIdx: number, catIdx: number) => {
    setPlatforms((prev) => prev.map((p, i) => i === platIdx ? { ...p, categories: p.categories.filter((_, ci) => ci !== catIdx) } : p));
    setExpandedCatIdx(null);
  };

  // ----------------------------------------------------------------
  // Variable (one per category)
  // ----------------------------------------------------------------
  const setVariableOnCategory = (platIdx: number, catIdx: number) => {
    if (!varForm.name.trim() || !varForm.slug.trim()) return;
    setPlatforms((prev) => prev.map((p, pi) => pi !== platIdx ? p : {
      ...p,
      categories: p.categories.map((c, ci) => ci !== catIdx ? c : {
        ...c,
        variable: { name: varForm.name, slug: varForm.slug, values: c.variable?.values ?? [] },
      }),
    }));
  };

  const removeVariable = (platIdx: number, catIdx: number) => {
    setPlatforms((prev) => prev.map((p, pi) => pi !== platIdx ? p : {
      ...p,
      categories: p.categories.map((c, ci) => ci !== catIdx ? c : { ...c, variable: null }),
    }));
    setVarForm({ name: "", slug: "" });
  };

  // ----------------------------------------------------------------
  // Variable Values
  // ----------------------------------------------------------------
  const addValueToVariable = (platIdx: number, catIdx: number) => {
    if (!valForm.name.trim() || !valForm.slug.trim()) return;
    setPlatforms((prev) => prev.map((p, pi) => pi !== platIdx ? p : {
      ...p,
      categories: p.categories.map((c, ci) => {
        if (ci !== catIdx || !c.variable) return c;
        return { ...c, variable: { ...c.variable, values: [...c.variable.values, { ...valForm }] } };
      }),
    }));
    setValForm({ name: "", slug: "", is_coop: false, required_players: 2 });
  };

  const removeValueFromVariable = (platIdx: number, catIdx: number, valIdx: number) => {
    setPlatforms((prev) => prev.map((p, pi) => pi !== platIdx ? p : {
      ...p,
      categories: p.categories.map((c, ci) => {
        if (ci !== catIdx || !c.variable) return c;
        return { ...c, variable: { ...c.variable, values: c.variable.values.filter((_, vi) => vi !== valIdx) } };
      }),
    }));
  };

  // ----------------------------------------------------------------
  // Submit
  // ----------------------------------------------------------------
  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const gameRes = await apiFetch("/games", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: gameName, slug: gameSlug }),
      });
      const gameData = await gameRes.json();
      if (!gameRes.ok) throw new Error(gameData.error || "Failed to create game");
      const game = gameData.game;

      for (const plat of platforms) {
        const platRes = await apiFetch(`/games/${game.slug}/platforms`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ name: plat.name, platform_slug: plat.slug, timing_method: plat.timing_method }),
        });
        const platData = await platRes.json();
        if (!platRes.ok) throw new Error(platData.error || `Failed to create platform ${plat.name}`);

        for (const sysName of plat.systems) {
          await apiFetch(`/games/${game.slug}/${plat.slug}/systems`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ name: sysName }),
          });
        }

        for (const cat of plat.categories) {
          const catRes = await apiFetch(`/games/${game.slug}/${plat.slug}/categories`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ name: cat.name, category_slug: cat.slug }),
          });
          const catData = await catRes.json();
          if (!catRes.ok) throw new Error(catData.error || `Failed to create category ${cat.name}`);
          const createdCat = catData.category;

          if (cat.variable && cat.variable.values.length > 0) {
            const varRes = await apiFetch(`/games/${game.slug}/${plat.slug}/${createdCat.slug}/variables`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({
                variable_name: cat.variable.name,
                variable_slug: cat.variable.slug,
                is_subcategory: true,
                values: cat.variable.values.map((v) => ({
                  name: v.name,
                  slug: v.slug,
                  is_coop: v.is_coop,
                  required_players: v.is_coop ? v.required_players : null,
                })),
              }),
            });
            const varData = await varRes.json();
            if (!varRes.ok) throw new Error(varData.error || `Failed to create variable for ${cat.name}`);
          }
        }
      }

      onDoneAction(game);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // ----------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------
  return (
    <div className="profile-section">
      {/* Step indicator */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "2rem", flexWrap: "wrap" }}>
        {STEPS.map((s, i) => (
          <div key={s} style={{ display: "flex", alignItems: "center", gap: "0.4rem", opacity: i > currentStepIndex ? 0.35 : 1 }}>
            <span style={{ width: "1.5rem", height: "1.5rem", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", fontWeight: "bold", background: s === step ? "var(--accent, #c9a84c)" : i < currentStepIndex ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.1)", color: s === step ? "#000" : "#fff" }}>
              {i < currentStepIndex ? "✓" : i + 1}
            </span>
            <span style={{ fontSize: "0.8rem" }}>{STEP_LABELS[s]}</span>
            {i < STEPS.length - 1 && <span style={{ opacity: 0.3, marginLeft: "0.25rem" }}>›</span>}
          </div>
        ))}
      </div>

      {/* ── Step 1: Game Details ── */}
      {step === "game" && (
        <div>
          <h2 className="profile-section-title">✨ Game Details</h2>
          <div className="form-group">
            <label className="form-label">Game Name</label>
            <input className="auth-input" placeholder="e.g. Harry Potter and the Philosopher's Stone" value={gameName} onChange={(e) => { setGameName(e.target.value); setGameSlug(slugify(e.target.value)); }} />
          </div>
          <div className="form-group">
            <label className="form-label">Slug</label>
            <input className="auth-input" placeholder="hp1" value={gameSlug} onChange={(e) => setGameSlug(e.target.value)} />
          </div>
        </div>
      )}

      {/* ── Step 2: Platforms ── */}
      {step === "platforms" && (
        <div>
          <h2 className="profile-section-title">🎮 Platforms</h2>
          {platforms.length > 0 && (
            <div style={{ marginBottom: "1.5rem" }}>
              {platforms.map((p, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0.75rem", background: "rgba(255,255,255,0.05)", borderRadius: "4px", marginBottom: "0.5rem", fontSize: "0.9rem" }}>
                  <span><strong>{p.name}</strong><span style={{ opacity: 0.5, marginLeft: "0.5rem" }}>/{p.slug}</span><span style={{ opacity: 0.5, marginLeft: "0.75rem", fontSize: "0.8rem" }}>{p.timing_method === "realtime" ? "RTA" : "IGT"}</span></span>
                  <button onClick={() => removePlatform(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ff4444", fontSize: "1rem" }}>×</button>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
            <input className="auth-input" placeholder="Name (e.g. PC)" style={{ flex: 2, minWidth: "140px" }} value={platForm.name} onChange={(e) => setPlatForm({ ...platForm, name: e.target.value, slug: slugify(e.target.value) })} />
            <input className="auth-input" placeholder="slug" style={{ flex: 1, minWidth: "80px" }} value={platForm.slug} onChange={(e) => setPlatForm({ ...platForm, slug: e.target.value })} />
            <select className="auth-input" style={{ flex: 1, minWidth: "100px" }} value={platForm.timing_method} onChange={(e) => setPlatForm({ ...platForm, timing_method: e.target.value as "realtime" | "gametime" })}>
              <option value="realtime">RTA</option>
              <option value="gametime">IGT</option>
            </select>
          </div>
          <button className="btn btn-primary btn-full" onClick={addPlatform} disabled={!platForm.name || !platForm.slug}>+ Add Platform</button>
        </div>
      )}

      {/* ── Step 3: Systems ── */}
      {step === "systems" && (
        <div>
          <h2 className="profile-section-title">🖥️ Systems</h2>
          <p style={{ fontSize: "0.85rem", opacity: 0.6, marginBottom: "1.5rem" }}>Optionally assign hardware systems. Leave empty if not applicable.</p>
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
            {platforms.map((p, i) => (
              <button key={i} className={`leaderboard-tab ${activePlatIdx === i ? "active" : ""}`} onClick={() => { setActivePlatIdx(i); setSystemInput(""); }}>
                {p.name}{p.systems.length > 0 && <span style={{ marginLeft: "0.4rem", opacity: 0.6, fontSize: "0.75rem" }}>({p.systems.length})</span>}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
            {platforms[activePlatIdx]?.systems.length === 0 && <span style={{ fontSize: "0.85rem", opacity: 0.4 }}>None assigned</span>}
            {platforms[activePlatIdx]?.systems.map((s) => (
              <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", padding: "0.25rem 0.6rem", background: "rgba(255,255,255,0.1)", borderRadius: "4px", fontSize: "0.85rem" }}>
                {s}<button onClick={() => removeSystemFromPlatform(activePlatIdx, s)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ff4444", lineHeight: 1 }}>×</button>
              </span>
            ))}
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input className="auth-input" list="systems-list" placeholder="Type or pick a system..." value={systemInput} onChange={(e) => setSystemInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSystemToPlatform(activePlatIdx, systemInput); } }} style={{ flex: 1 }} />
            <datalist id="systems-list">{allSystems.map((s) => <option key={s.id} value={s.name} />)}</datalist>
            <button className="btn btn-primary" onClick={() => addSystemToPlatform(activePlatIdx, systemInput)} disabled={!systemInput.trim()}>Add</button>
          </div>
        </div>
      )}

      {/* ── Step 4: Categories ── */}
      {step === "categories" && (
        <div>
          <h2 className="profile-section-title">🏆 Categories</h2>

          {/* Platform tabs */}
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
            {platforms.map((p, i) => (
              <button key={i} className={`leaderboard-tab ${catPlatIdx === i ? "active" : ""}`} onClick={() => { setCatPlatIdx(i); setCatForm({ name: "", slug: "" }); setExpandedCatIdx(null); }}>
                {p.name}{p.categories.length > 0 && <span style={{ marginLeft: "0.4rem", opacity: 0.6, fontSize: "0.75rem" }}>({p.categories.length})</span>}
              </button>
            ))}
          </div>

          {/* Existing categories */}
          {platforms[catPlatIdx]?.categories.map((c, ci) => (
            <div key={ci} style={{ background: "rgba(255,255,255,0.04)", borderRadius: "6px", marginBottom: "0.75rem", overflow: "hidden" }}>
              {/* Category header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.5rem 0.75rem" }}>
                <button onClick={() => { setExpandedCatIdx(expandedCatIdx === ci ? null : ci); setVarForm({ name: c.variable?.name || "", slug: c.variable?.slug || "" }); setValForm({ name: "", slug: "", is_coop: false, required_players: 2 }); }} style={{ background: "none", border: "none", cursor: "pointer", textAlign: "left", flex: 1, color: "inherit", fontSize: "0.9rem" }}>
                  <strong>{c.name}</strong>
                  <span style={{ opacity: 0.5, marginLeft: "0.5rem" }}>/{c.slug}</span>
                  {c.variable && <span style={{ opacity: 0.5, marginLeft: "0.75rem", fontSize: "0.75rem" }}>{c.variable.name} · {c.variable.values.length} values</span>}
                  <span style={{ opacity: 0.4, marginLeft: "0.5rem", fontSize: "0.75rem" }}>{expandedCatIdx === ci ? "▲" : "▼"}</span>
                </button>
                <button onClick={() => removeCategoryFromPlatform(catPlatIdx, ci)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ff4444", fontSize: "1rem" }}>×</button>
              </div>

              {/* Variable panel */}
              {expandedCatIdx === ci && (
                <div style={{ padding: "0.75rem", borderTop: "1px solid rgba(255,255,255,0.06)" }}>

                  {/* Variable name/slug */}
                  {!c.variable ? (
                    <>
                      <p style={{ fontSize: "0.8rem", opacity: 0.5, marginBottom: "0.75rem" }}>Add a variable to define subcategories (e.g. "Players", "Version")</p>
                      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem", flexWrap: "wrap" }}>
                        <input className="auth-input" placeholder="Variable name (e.g. Players)" style={{ flex: 2, minWidth: "130px", fontSize: "0.85rem" }} value={varForm.name} onChange={(e) => setVarForm({ name: e.target.value, slug: slugify(e.target.value) })} />
                        <input className="auth-input" placeholder="slug" style={{ flex: 1, minWidth: "70px", fontSize: "0.85rem" }} value={varForm.slug} onChange={(e) => setVarForm({ ...varForm, slug: e.target.value })} />
                      </div>
                      <button className="btn btn-primary" onClick={() => setVariableOnCategory(catPlatIdx, ci)} disabled={!varForm.name || !varForm.slug} style={{ fontSize: "0.85rem", padding: "0.4rem 0.8rem" }}>
                        Set Variable
                      </button>
                    </>
                  ) : (
                    <>
                      {/* Variable header */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                        <span style={{ fontSize: "0.85rem", fontWeight: "bold" }}>
                          Variable: {c.variable.name}
                          <span style={{ opacity: 0.5, marginLeft: "0.4rem", fontWeight: "normal" }}>/{c.variable.slug}</span>
                        </span>
                        <button onClick={() => removeVariable(catPlatIdx, ci)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ff4444", fontSize: "0.8rem" }}>Remove</button>
                      </div>

                      {/* Existing values */}
                      {c.variable.values.length === 0 && <p style={{ fontSize: "0.8rem", opacity: 0.4, marginBottom: "0.75rem" }}>No values yet</p>}
                      {c.variable.values.map((val, vi) => (
                        <div key={vi} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.3rem 0.5rem", background: "rgba(255,255,255,0.05)", borderRadius: "4px", marginBottom: "0.4rem", fontSize: "0.8rem" }}>
                          <span>
                            {val.name}<span style={{ opacity: 0.5, marginLeft: "0.4rem" }}>/{val.slug}</span>
                            {val.is_coop && <span style={{ opacity: 0.5, marginLeft: "0.5rem" }}>· co-op {val.required_players}p</span>}
                          </span>
                          <button onClick={() => removeValueFromVariable(catPlatIdx, ci, vi)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ff4444" }}>×</button>
                        </div>
                      ))}

                      {/* Add value form */}
                      <div style={{ marginTop: "0.5rem" }}>
                        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem", flexWrap: "wrap" }}>
                          <input className="auth-input" placeholder="Value name (e.g. 1 Player)" style={{ flex: 2, minWidth: "120px", fontSize: "0.85rem" }} value={valForm.name} onChange={(e) => setValForm({ ...valForm, name: e.target.value, slug: slugify(e.target.value) })} />
                          <input className="auth-input" placeholder="slug" style={{ flex: 1, minWidth: "70px", fontSize: "0.85rem" }} value={valForm.slug} onChange={(e) => setValForm({ ...valForm, slug: e.target.value })} />
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
                          <input type="checkbox" id={`coop-${ci}`} checked={valForm.is_coop} onChange={(e) => setValForm({ ...valForm, is_coop: e.target.checked })} />
                          <label htmlFor={`coop-${ci}`} className="form-label" style={{ margin: 0, fontSize: "0.8rem" }}>Co-op</label>
                          {valForm.is_coop && (
                            <input type="number" className="auth-input" min={2} value={valForm.required_players} onChange={(e) => setValForm({ ...valForm, required_players: parseInt(e.target.value) })} style={{ width: "80px", fontSize: "0.85rem" }} />
                          )}
                        </div>
                        <button className="btn btn-primary" onClick={() => addValueToVariable(catPlatIdx, ci)} disabled={!valForm.name || !valForm.slug} style={{ fontSize: "0.85rem", padding: "0.4rem 0.8rem" }}>
                          + Add Value
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Add category */}
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
            <input className="auth-input" placeholder="Category name (e.g. Any%)" style={{ flex: 2, minWidth: "140px" }} value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value, slug: slugify(e.target.value) })} />
            <input className="auth-input" placeholder="slug" style={{ flex: 1, minWidth: "80px" }} value={catForm.slug} onChange={(e) => setCatForm({ ...catForm, slug: e.target.value })} />
          </div>
          <button className="btn btn-primary btn-full" onClick={() => addCategoryToPlatform(catPlatIdx)} disabled={!catForm.name || !catForm.slug}>+ Add Category</button>
        </div>
      )}

      {/* ── Step 5: Confirm ── */}
      {step === "confirm" && (
        <div>
          <h2 className="profile-section-title">Review & Create</h2>
          <div style={{ marginBottom: "1.5rem", padding: "1rem", background: "rgba(255,255,255,0.04)", borderRadius: "6px" }}>
            <div style={{ marginBottom: "0.75rem" }}>
              <span style={{ opacity: 0.5, fontSize: "0.8rem" }}>GAME</span>
              <div style={{ fontWeight: "bold", fontSize: "1.1rem" }}>{gameName}</div>
              <div style={{ opacity: 0.5, fontSize: "0.85rem" }}>/{gameSlug}</div>
            </div>
            {platforms.map((p, i) => (
              <div key={i} style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ fontWeight: "bold" }}>{p.name}<span style={{ opacity: 0.5, marginLeft: "0.5rem", fontSize: "0.8rem" }}>/{p.slug} · {p.timing_method === "realtime" ? "RTA" : "IGT"}</span></div>
                {p.systems.length > 0 && <div style={{ fontSize: "0.8rem", opacity: 0.6, marginTop: "0.25rem" }}>Systems: {p.systems.join(", ")}</div>}
                {p.categories.length === 0 && <div style={{ fontSize: "0.8rem", opacity: 0.4, marginTop: "0.25rem" }}>No categories</div>}
                {p.categories.map((c, ci) => (
                  <div key={ci} style={{ fontSize: "0.8rem", opacity: 0.6, marginTop: "0.25rem", paddingLeft: "0.75rem" }}>
                    · {c.name}
                    {c.variable && <span style={{ opacity: 0.7 }}> → {c.variable.name}: {c.variable.values.map((v) => v.name).join(", ")}</span>}
                  </div>
                ))}
              </div>
            ))}
          </div>
          {error && <p className="auth-error">{error}</p>}
          <button className="btn btn-primary btn-full" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Creating..." : "✨ Create Game"}
          </button>
        </div>
      )}

      {/* Navigation */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "1.5rem" }}>
        <button className="btn" onClick={back} disabled={step === "game"} style={{ visibility: step === "game" ? "hidden" : "visible" }}>← Back</button>
        {step !== "confirm" && <button className="btn btn-primary" onClick={advance} disabled={!canAdvance()}>Next →</button>}
      </div>
    </div>
  );
}