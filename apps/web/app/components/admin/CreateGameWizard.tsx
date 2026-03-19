"use client";
import { useState, useEffect } from "react";
import { useAuth } from "../auth/AuthContext";
import { apiFetch } from "@/app/lib/api";
import "../../styles/creategamewizard.css";

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
  is_subcategory: boolean;
  order: number;
  values: VariableValueDraft[];
}

interface CategoryDraft {
  name: string;
  slug: string;
  category_type: string;
  scoring_type: string;
  variables: VariableDraft[];
}

interface PlatformDraft {
  name: string;
  slug: string;
  timing_method: "realtime" | "gametime";
  systems: string[];
  categories: CategoryDraft[];
}

function slugify(str: string) {
  return str
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

// ----------------------------------------------------------------
// Component
// ----------------------------------------------------------------
export default function CreateGameWizard({
  onDoneAction,
}: {
  onDoneAction: (game: any) => void;
}) {
  const { token } = useAuth();

  const [allSystems, setAllSystems] = useState<SystemOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Game
  const [gameName, setGameName] = useState("");
  const [gameSlug, setGameSlug] = useState("");

  // Platforms
  const [platforms, setPlatforms] = useState<PlatformDraft[]>([]);
  const [platForm, setPlatForm] = useState<{
    name: string;
    slug: string;
    timing_method: "realtime" | "gametime";
  }>({ name: "", slug: "", timing_method: "realtime" });

  // Active platform tab
  const [activePlatIdx, setActivePlatIdx] = useState(0);

  // System input
  const [systemInput, setSystemInput] = useState("");

  // Category form
  const [catForm, setCatForm] = useState({
    name: "",
    slug: "",
    category_type: "full_game",
    scoring_type: "",
  });

  // Variable form per category: keyed by "platIdx-catIdx"
  const [varForms, setVarForms] = useState<
    Record<string, { name: string; slug: string }>
  >({});

  // Value form per variable: keyed by "platIdx-catIdx-varIdx"
  const [valForms, setValForms] = useState<
    Record<
      string,
      { name: string; slug: string; is_coop: boolean; required_players: number }
    >
  >({});

  // Expanded state
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});
  const [expandedVars, setExpandedVars] = useState<Record<string, boolean>>({});

  // Per-category guided decisions: "platIdx-catIdx" -> decisions
  const [catDecisions, setCatDecisions] = useState<
    Record<
      string,
      {
        hasSubcategories: boolean | null;
        hasVariables: boolean | null;
      }
    >
  >({});

  const setCatDecision = (
    platIdx: number,
    catIdx: number,
    key: "hasSubcategories" | "hasVariables",
    value: boolean,
  ) => {
    const dKey = `${platIdx}-${catIdx}`;
    setCatDecisions((prev) => ({
      ...prev,
      [dKey]: {
        ...(prev[dKey] ?? { hasSubcategories: null, hasVariables: null }),
        [key]: value,
      },
    }));
  };

  useEffect(() => {
    apiFetch("/games/systems")
      .then((r) => r.json())
      .then((d) => setAllSystems(d.systems || []))
      .catch(console.error);
  }, []);

  // ----------------------------------------------------------------
  // Platforms
  // ----------------------------------------------------------------
  const addPlatform = () => {
    if (!platForm.name.trim() || !platForm.slug.trim()) return;
    setPlatforms((prev) => [
      ...prev,
      { ...platForm, systems: [], categories: [] },
    ]);
    setPlatForm({ name: "", slug: "", timing_method: "realtime" });
    setActivePlatIdx(platforms.length);
  };

  const removePlatform = (i: number) => {
    setPlatforms((prev) => prev.filter((_, idx) => idx !== i));
    setActivePlatIdx(0);
  };

  // ----------------------------------------------------------------
  // Systems
  // ----------------------------------------------------------------
  const addSystem = (platIdx: number, name: string) => {
    if (!name.trim()) return;
    setPlatforms((prev) =>
      prev.map((p, i) =>
        i === platIdx && !p.systems.includes(name)
          ? { ...p, systems: [...p.systems, name] }
          : p,
      ),
    );
    setSystemInput("");
  };

  const removeSystem = (platIdx: number, name: string) => {
    setPlatforms((prev) =>
      prev.map((p, i) =>
        i === platIdx
          ? { ...p, systems: p.systems.filter((s) => s !== name) }
          : p,
      ),
    );
  };

  // ----------------------------------------------------------------
  // Categories
  // ----------------------------------------------------------------
  const addCategory = (platIdx: number) => {
    if (!catForm.name.trim() || !catForm.slug.trim()) return;
    const newCat: CategoryDraft = {
      name: catForm.name,
      slug: catForm.slug,
      category_type: catForm.category_type,
      scoring_type: catForm.scoring_type,
      variables: [],
    };
    setPlatforms((prev) =>
      prev.map((p, i) =>
        i === platIdx ? { ...p, categories: [...p.categories, newCat] } : p,
      ),
    );
    const catIdx = platforms[platIdx].categories.length;
    setExpandedCats((prev) => ({ ...prev, [`${platIdx}-${catIdx}`]: true }));
    setCatForm({
      name: "",
      slug: "",
      category_type: "full_game",
      scoring_type: "",
    });
  };

  const removeCategory = (platIdx: number, catIdx: number) => {
    setPlatforms((prev) =>
      prev.map((p, i) =>
        i === platIdx
          ? { ...p, categories: p.categories.filter((_, ci) => ci !== catIdx) }
          : p,
      ),
    );
  };

  const toggleCat = (platIdx: number, catIdx: number) => {
    const key = `${platIdx}-${catIdx}`;
    setExpandedCats((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // ----------------------------------------------------------------
  // Variables
  // ----------------------------------------------------------------
  const addVariable = (platIdx: number, catIdx: number) => {
    const key = `${platIdx}-${catIdx}`;
    const form = varForms[key];
    if (!form?.name.trim() || !form?.slug.trim()) return;

    const cat = platforms[platIdx].categories[catIdx];
    const hasSubcatVar = cat.variables.some((v) => v.is_subcategory);
    const newVar: VariableDraft = {
      name: form.name,
      slug: form.slug,
      is_subcategory: !hasSubcatVar, // first variable is subcategory, rest are filters
      order: cat.variables.length,
      values: [],
    };

    setPlatforms((prev) =>
      prev.map((p, pi) =>
        pi !== platIdx
          ? p
          : {
              ...p,
              categories: p.categories.map((c, ci) =>
                ci !== catIdx
                  ? c
                  : { ...c, variables: [...c.variables, newVar] },
              ),
            },
      ),
    );

    const varIdx = cat.variables.length;
    setExpandedVars((prev) => ({
      ...prev,
      [`${platIdx}-${catIdx}-${varIdx}`]: true,
    }));
    setVarForms((prev) => ({ ...prev, [key]: { name: "", slug: "" } }));
  };

  const removeVariable = (platIdx: number, catIdx: number, varIdx: number) => {
    setPlatforms((prev) =>
      prev.map((p, pi) =>
        pi !== platIdx
          ? p
          : {
              ...p,
              categories: p.categories.map((c, ci) =>
                ci !== catIdx
                  ? c
                  : {
                      ...c,
                      variables: c.variables
                        .filter((_, vi) => vi !== varIdx)
                        .map((v, i) => ({ ...v, order: i })),
                    },
              ),
            },
      ),
    );
  };

  const toggleIsSubcategory = (
    platIdx: number,
    catIdx: number,
    varIdx: number,
  ) => {
    const cat = platforms[platIdx].categories[catIdx];
    const targetVar = cat.variables[varIdx];
    if (!targetVar.is_subcategory) {
      // Promoting to subcategory — demote any existing subcategory var
      setPlatforms((prev) =>
        prev.map((p, pi) =>
          pi !== platIdx
            ? p
            : {
                ...p,
                categories: p.categories.map((c, ci) =>
                  ci !== catIdx
                    ? c
                    : {
                        ...c,
                        variables: c.variables.map((v, vi) => ({
                          ...v,
                          is_subcategory: vi === varIdx,
                        })),
                      },
                ),
              },
        ),
      );
    } else {
      // Demoting — just set to false
      setPlatforms((prev) =>
        prev.map((p, pi) =>
          pi !== platIdx
            ? p
            : {
                ...p,
                categories: p.categories.map((c, ci) =>
                  ci !== catIdx
                    ? c
                    : {
                        ...c,
                        variables: c.variables.map((v, vi) =>
                          vi === varIdx ? { ...v, is_subcategory: false } : v,
                        ),
                      },
                ),
              },
        ),
      );
    }
  };

  const toggleVar = (platIdx: number, catIdx: number, varIdx: number) => {
    const key = `${platIdx}-${catIdx}-${varIdx}`;
    setExpandedVars((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // ----------------------------------------------------------------
  // Variable Values
  // ----------------------------------------------------------------
  const addValue = (platIdx: number, catIdx: number, varIdx: number) => {
    const key = `${platIdx}-${catIdx}-${varIdx}`;
    const form = valForms[key];
    if (!form?.name.trim() || !form?.slug.trim()) return;

    setPlatforms((prev) =>
      prev.map((p, pi) =>
        pi !== platIdx
          ? p
          : {
              ...p,
              categories: p.categories.map((c, ci) =>
                ci !== catIdx
                  ? c
                  : {
                      ...c,
                      variables: c.variables.map((v, vi) =>
                        vi !== varIdx
                          ? v
                          : { ...v, values: [...v.values, { ...form }] },
                      ),
                    },
              ),
            },
      ),
    );
    setValForms((prev) => ({
      ...prev,
      [key]: { name: "", slug: "", is_coop: false, required_players: 2 },
    }));
  };

  const removeValue = (
    platIdx: number,
    catIdx: number,
    varIdx: number,
    valIdx: number,
  ) => {
    setPlatforms((prev) =>
      prev.map((p, pi) =>
        pi !== platIdx
          ? p
          : {
              ...p,
              categories: p.categories.map((c, ci) =>
                ci !== catIdx
                  ? c
                  : {
                      ...c,
                      variables: c.variables.map((v, vi) =>
                        vi !== varIdx
                          ? v
                          : {
                              ...v,
                              values: v.values.filter(
                                (_, vli) => vli !== valIdx,
                              ),
                            },
                      ),
                    },
              ),
            },
      ),
    );
  };

  // ----------------------------------------------------------------
  // Submit
  // ----------------------------------------------------------------
  const handleSubmit = async () => {
    if (!gameName.trim() || !gameSlug.trim()) {
      setError("Game name and slug are required");
      return;
    }
    if (platforms.length === 0) {
      setError("Add at least one platform");
      return;
    }

    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const gameRes = await apiFetch("/games", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: gameName, slug: gameSlug }),
      });
      const gameData = await gameRes.json();
      if (!gameRes.ok)
        throw new Error(gameData.error || "Failed to create game");
      const game = gameData.game;

      for (const plat of platforms) {
        const platRes = await apiFetch(`/games/${game.slug}/platforms`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: plat.name,
            platform_slug: plat.slug,
            timing_method: plat.timing_method,
          }),
        });
        const platData = await platRes.json();
        if (!platRes.ok)
          throw new Error(
            platData.error || `Failed to create platform ${plat.name}`,
          );

        for (const sysName of plat.systems) {
          await apiFetch(`/games/${game.slug}/${plat.slug}/systems`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ name: sysName }),
          });
        }

        for (const cat of plat.categories) {
          const catRes = await apiFetch(
            `/games/${game.slug}/${plat.slug}/categories`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                name: cat.name,
                category_slug: cat.slug,
                category_type: cat.category_type,
                scoring_type: cat.scoring_type || null,
              }),
            },
          );
          const catData = await catRes.json();
          if (!catRes.ok)
            throw new Error(
              catData.error || `Failed to create category ${cat.name}`,
            );
          const createdCat = catData.category;

          for (const variable of cat.variables) {
            if (variable.values.length === 0) continue;
            const varRes = await apiFetch(
              `/games/${game.slug}/${plat.slug}/${createdCat.slug}/variables`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                  variable_name: variable.name,
                  variable_slug: variable.slug,
                  is_subcategory: variable.is_subcategory,
                  order: variable.order,
                  values: variable.values.map((v) => ({
                    name: v.name,
                    slug: v.slug,
                    is_coop: v.is_coop,
                    required_players: v.is_coop ? v.required_players : null,
                  })),
                }),
              },
            );
            const varData = await varRes.json();
            if (!varRes.ok)
              throw new Error(
                varData.error || `Failed to create variable ${variable.name}`,
              );
          }
        }
      }

      setSuccess(`"${gameName}" created successfully.`);
      setGameName("");
      setGameSlug("");
      setPlatforms([]);
      onDoneAction(game);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const activePlat = platforms[activePlatIdx];

  // ----------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------
  return (
    <div className="cgw">
      {/* ── Game Details ── */}
      <section className="cgw-section">
        <h3 className="cgw-section-title">Game Details</h3>
        <div className="cgw-row">
          <div className="form-group">
            <label className="form-label">Game Name</label>
            <input
              className="auth-input"
              placeholder="e.g. Harry Potter and the Philosopher's Stone"
              value={gameName}
              onChange={(e) => {
                setGameName(e.target.value);
                setGameSlug(slugify(e.target.value));
              }}
            />
          </div>
          <div className="form-group cgw-slug-group">
            <label className="form-label">Slug</label>
            <input
              className="auth-input"
              placeholder="hp1"
              value={gameSlug}
              onChange={(e) => setGameSlug(e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* ── Platforms ── */}
      <section className="cgw-section">
        <h3 className="cgw-section-title">Platforms</h3>

        {platforms.length > 0 && (
          <div className="cgw-tag-list">
            {platforms.map((p, i) => (
              <span
                key={i}
                className={`cgw-tag ${activePlatIdx === i ? "cgw-tag--active" : ""}`}
                onClick={() => setActivePlatIdx(i)}
              >
                {p.name}
                <span className="cgw-tag-meta">
                  {p.timing_method === "realtime" ? "RTA" : "IGT"}
                </span>
                <button
                  className="cgw-remove"
                  onClick={(e) => {
                    e.stopPropagation();
                    removePlatform(i);
                  }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="cgw-inline-form">
          <input
            className="auth-input"
            placeholder="Name (e.g. PC)"
            value={platForm.name}
            onChange={(e) =>
              setPlatForm({
                ...platForm,
                name: e.target.value,
                slug: slugify(e.target.value),
              })
            }
          />
          <input
            className="auth-input cgw-slug-input"
            placeholder="slug"
            value={platForm.slug}
            onChange={(e) => setPlatForm({ ...platForm, slug: e.target.value })}
          />
          <select
            className="auth-input cgw-timing-select"
            value={platForm.timing_method}
            onChange={(e) =>
              setPlatForm({
                ...platForm,
                timing_method: e.target.value as "realtime" | "gametime",
              })
            }
          >
            <option value="realtime">RTA</option>
            <option value="gametime">IGT</option>
          </select>
          <button
            className="btn btn-primary cgw-add-btn"
            onClick={addPlatform}
            disabled={!platForm.name || !platForm.slug}
          >
            + Add
          </button>
        </div>
      </section>

      {/* ── Per-Platform: Systems + Categories ── */}
      {platforms.length > 0 && (
        <>
          {/* Platform tabs */}
          <div className="cgw-plat-tabs">
            {platforms.map((p, i) => (
              <button
                key={i}
                className={`leaderboard-tab ${activePlatIdx === i ? "active" : ""}`}
                onClick={() => setActivePlatIdx(i)}
              >
                {p.name}
              </button>
            ))}
          </div>

          {activePlat && (
            <>
              {/* Systems */}
              <section className="cgw-section cgw-section--inset">
                <h3 className="cgw-section-title">
                  Systems <span className="cgw-optional">(optional)</span>
                </h3>

                {activePlat.systems.length > 0 && (
                  <div className="cgw-tag-list">
                    {activePlat.systems.map((s) => (
                      <span key={s} className="cgw-tag">
                        {s}
                        <button
                          className="cgw-remove"
                          onClick={() => removeSystem(activePlatIdx, s)}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="cgw-inline-form">
                  <input
                    className="auth-input"
                    list="systems-list"
                    placeholder="Type or pick a system..."
                    value={systemInput}
                    onChange={(e) => setSystemInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addSystem(activePlatIdx, systemInput);
                      }
                    }}
                  />
                  <datalist id="systems-list">
                    {allSystems.map((s) => (
                      <option key={s.id} value={s.name} />
                    ))}
                  </datalist>
                  <button
                    className="btn btn-primary cgw-add-btn"
                    onClick={() => addSystem(activePlatIdx, systemInput)}
                    disabled={!systemInput.trim()}
                  >
                    + Add
                  </button>
                </div>
              </section>

              {/* Categories */}
              <section className="cgw-section cgw-section--inset">
                <h3 className="cgw-section-title">Categories</h3>

                {activePlat.categories.map((cat, ci) => {
                  const catKey = `${activePlatIdx}-${ci}`;
                  const isExpanded = expandedCats[catKey];
                  const hasSubcatVar = cat.variables.some(
                    (v) => v.is_subcategory,
                  );

                  return (
                    <div key={ci} className="cgw-card">
                      {/* Category header */}
                      <div className="cgw-card-header">
                        <button
                          className="cgw-card-toggle"
                          onClick={() => toggleCat(activePlatIdx, ci)}
                        >
                          <span className="cgw-card-name">{cat.name}</span>
                          <span className="cgw-card-slug">/{cat.slug}</span>
                          {cat.variables.length > 0 && (
                            <span className="cgw-card-meta">
                              {cat.variables.length} variable
                              {cat.variables.length !== 1 ? "s" : ""}
                            </span>
                          )}
                          <span className="cgw-chevron">
                            {isExpanded ? "▲" : "▼"}
                          </span>
                        </button>
                        <button
                          className="cgw-remove cgw-remove--lg"
                          onClick={() => removeCategory(activePlatIdx, ci)}
                        >
                          ×
                        </button>
                      </div>

                      {/* Category body */}
                      {isExpanded && (
                        <div className="cgw-card-body">
                          {(() => {
                            const dKey = `${activePlatIdx}-${ci}`;
                            const decision = catDecisions[dKey] ?? {
                              hasSubcategories: null,
                              hasVariables: null,
                            };
                            const subcatVar = cat.variables.find(
                              (v) => v.is_subcategory,
                            );
                            const filterVars = cat.variables.filter(
                              (v) => !v.is_subcategory,
                            );

                            return (
                              <>
                                {/* ── Q1: Does this category have subcategories? ── */}
                                <div className="cgw-question">
                                  <span className="cgw-question-label">
                                    Does this category have subcategories?
                                  </span>
                                  <div className="cgw-yn">
                                    <button
                                      className={`cgw-yn-btn ${decision.hasSubcategories === true ? "cgw-yn-btn--active" : ""}`}
                                      onClick={() =>
                                        setCatDecision(
                                          activePlatIdx,
                                          ci,
                                          "hasSubcategories",
                                          true,
                                        )
                                      }
                                    >
                                      Yes
                                    </button>
                                    <button
                                      className={`cgw-yn-btn ${decision.hasSubcategories === false ? "cgw-yn-btn--active" : ""}`}
                                      onClick={() => {
                                        setCatDecision(
                                          activePlatIdx,
                                          ci,
                                          "hasSubcategories",
                                          false,
                                        );
                                        // Remove subcategory variable if present
                                        if (subcatVar) {
                                          const vi = cat.variables.findIndex(
                                            (v) => v.is_subcategory,
                                          );
                                          if (vi !== -1)
                                            removeVariable(
                                              activePlatIdx,
                                              ci,
                                              vi,
                                            );
                                        }
                                      }}
                                    >
                                      No
                                    </button>
                                  </div>
                                </div>

                                {/* Subcategory variable builder */}
                                {decision.hasSubcategories === true && (
                                  <div className="cgw-guided-section">
                                    {subcatVar ? (
                                      // Show existing subcategory variable
                                      <div className="cgw-var-card">
                                        <div className="cgw-var-header">
                                          <button
                                            className="cgw-card-toggle"
                                            onClick={() =>
                                              toggleVar(
                                                activePlatIdx,
                                                ci,
                                                cat.variables.findIndex(
                                                  (v) => v.is_subcategory,
                                                ),
                                              )
                                            }
                                          >
                                            <span className="cgw-card-name">
                                              {subcatVar.name}
                                            </span>
                                            <span className="cgw-card-slug">
                                              /{subcatVar.slug}
                                            </span>
                                            <span className="cgw-var-type cgw-var-type--sub">
                                              Subcategory
                                            </span>
                                            <span className="cgw-card-meta">
                                              {subcatVar.values.length} values
                                            </span>
                                            <span className="cgw-chevron">
                                              {expandedVars[
                                                `${activePlatIdx}-${ci}-${cat.variables.findIndex((v) => v.is_subcategory)}`
                                              ]
                                                ? "▲"
                                                : "▼"}
                                            </span>
                                          </button>
                                          <button
                                            className="cgw-remove cgw-remove--lg"
                                            onClick={() =>
                                              removeVariable(
                                                activePlatIdx,
                                                ci,
                                                cat.variables.findIndex(
                                                  (v) => v.is_subcategory,
                                                ),
                                              )
                                            }
                                          >
                                            ×
                                          </button>
                                        </div>
                                        {expandedVars[
                                          `${activePlatIdx}-${ci}-${cat.variables.findIndex((v) => v.is_subcategory)}`
                                        ] && (
                                          <div className="cgw-var-body">
                                            {subcatVar.values.length > 0 && (
                                              <div className="cgw-tag-list">
                                                {subcatVar.values.map(
                                                  (val, vli) => (
                                                    <span
                                                      key={vli}
                                                      className="cgw-tag"
                                                    >
                                                      {val.name}
                                                      {val.is_coop && (
                                                        <span className="cgw-tag-meta">
                                                          co-op{" "}
                                                          {val.required_players}
                                                          p
                                                        </span>
                                                      )}
                                                      <button
                                                        className="cgw-remove"
                                                        onClick={() =>
                                                          removeValue(
                                                            activePlatIdx,
                                                            ci,
                                                            cat.variables.findIndex(
                                                              (v) =>
                                                                v.is_subcategory,
                                                            ),
                                                            vli,
                                                          )
                                                        }
                                                      >
                                                        ×
                                                      </button>
                                                    </span>
                                                  ),
                                                )}
                                              </div>
                                            )}
                                            {(() => {
                                              const subVi =
                                                cat.variables.findIndex(
                                                  (v) => v.is_subcategory,
                                                );
                                              const vKey = `${activePlatIdx}-${ci}-${subVi}`;
                                              const vf = valForms[vKey] ?? {
                                                name: "",
                                                slug: "",
                                                is_coop: false,
                                                required_players: 2,
                                              };
                                              return (
                                                <>
                                                  <div className="cgw-inline-form">
                                                    <input
                                                      className="auth-input"
                                                      placeholder="Value name (e.g. Clare)"
                                                      value={vf.name}
                                                      onChange={(e) =>
                                                        setValForms((prev) => ({
                                                          ...prev,
                                                          [vKey]: {
                                                            ...vf,
                                                            name: e.target
                                                              .value,
                                                            slug: slugify(
                                                              e.target.value,
                                                            ),
                                                          },
                                                        }))
                                                      }
                                                    />
                                                    <input
                                                      className="auth-input cgw-slug-input"
                                                      placeholder="slug"
                                                      value={vf.slug}
                                                      onChange={(e) =>
                                                        setValForms((prev) => ({
                                                          ...prev,
                                                          [vKey]: {
                                                            ...vf,
                                                            slug: e.target
                                                              .value,
                                                          },
                                                        }))
                                                      }
                                                    />
                                                  </div>
                                                  <div className="cgw-coop-row">
                                                    <input
                                                      type="checkbox"
                                                      id={`coop-${vKey}`}
                                                      checked={vf.is_coop}
                                                      onChange={(e) =>
                                                        setValForms((prev) => ({
                                                          ...prev,
                                                          [vKey]: {
                                                            ...vf,
                                                            is_coop:
                                                              e.target.checked,
                                                          },
                                                        }))
                                                      }
                                                    />
                                                    <label
                                                      htmlFor={`coop-${vKey}`}
                                                      className="form-label cgw-coop-label"
                                                    >
                                                      Co-op
                                                    </label>
                                                    {vf.is_coop && (
                                                      <input
                                                        type="number"
                                                        className="auth-input cgw-players-input"
                                                        min={2}
                                                        value={
                                                          vf.required_players
                                                        }
                                                        onChange={(e) =>
                                                          setValForms(
                                                            (prev) => ({
                                                              ...prev,
                                                              [vKey]: {
                                                                ...vf,
                                                                required_players:
                                                                  parseInt(
                                                                    e.target
                                                                      .value,
                                                                  ),
                                                              },
                                                            }),
                                                          )
                                                        }
                                                      />
                                                    )}
                                                  </div>
                                                  <button
                                                    className="btn cgw-sm-btn"
                                                    onClick={() =>
                                                      addValue(
                                                        activePlatIdx,
                                                        ci,
                                                        subVi,
                                                      )
                                                    }
                                                    disabled={
                                                      !vf.name || !vf.slug
                                                    }
                                                  >
                                                    + Add Value
                                                  </button>
                                                </>
                                              );
                                            })()}
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      // Add subcategory variable
                                      <>
                                        <p className="cgw-hint">
                                          Name the subcategory split (e.g.
                                          "Path" for Clare / Leon)
                                        </p>
                                        <div className="cgw-inline-form">
                                          <input
                                            className="auth-input"
                                            placeholder="Variable name (e.g. Path)"
                                            value={
                                              varForms[
                                                `${activePlatIdx}-${ci}-sub`
                                              ]?.name ?? ""
                                            }
                                            onChange={(e) =>
                                              setVarForms((prev) => ({
                                                ...prev,
                                                [`${activePlatIdx}-${ci}-sub`]:
                                                  {
                                                    name: e.target.value,
                                                    slug: slugify(
                                                      e.target.value,
                                                    ),
                                                  },
                                              }))
                                            }
                                          />
                                          <input
                                            className="auth-input cgw-slug-input"
                                            placeholder="slug"
                                            value={
                                              varForms[
                                                `${activePlatIdx}-${ci}-sub`
                                              ]?.slug ?? ""
                                            }
                                            onChange={(e) =>
                                              setVarForms((prev) => ({
                                                ...prev,
                                                [`${activePlatIdx}-${ci}-sub`]:
                                                  {
                                                    ...varForms[
                                                      `${activePlatIdx}-${ci}-sub`
                                                    ],
                                                    slug: e.target.value,
                                                  },
                                              }))
                                            }
                                          />
                                          <button
                                            className="btn btn-primary cgw-add-btn"
                                            onClick={() => {
                                              const form =
                                                varForms[
                                                  `${activePlatIdx}-${ci}-sub`
                                                ];
                                              if (!form?.name || !form?.slug)
                                                return;
                                              const newVar: VariableDraft = {
                                                name: form.name,
                                                slug: form.slug,
                                                is_subcategory: true,
                                                order: 0,
                                                values: [],
                                              };
                                              setPlatforms((prev) =>
                                                prev.map((p, pi) =>
                                                  pi !== activePlatIdx
                                                    ? p
                                                    : {
                                                        ...p,
                                                        categories:
                                                          p.categories.map(
                                                            (c, cii) =>
                                                              cii !== ci
                                                                ? c
                                                                : {
                                                                    ...c,
                                                                    variables: [
                                                                      newVar,
                                                                      ...c.variables.filter(
                                                                        (v) =>
                                                                          !v.is_subcategory,
                                                                      ),
                                                                    ],
                                                                  },
                                                          ),
                                                      },
                                                ),
                                              );
                                              const newVi = 0;
                                              setExpandedVars((prev) => ({
                                                ...prev,
                                                [`${activePlatIdx}-${ci}-${newVi}`]: true,
                                              }));
                                              setVarForms((prev) => ({
                                                ...prev,
                                                [`${activePlatIdx}-${ci}-sub`]:
                                                  { name: "", slug: "" },
                                              }));
                                            }}
                                            disabled={
                                              !varForms[
                                                `${activePlatIdx}-${ci}-sub`
                                              ]?.name
                                            }
                                          >
                                            + Set Subcategory Variable
                                          </button>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                )}

                                {/* ── Q2: Does this category have variables? ── */}
                                {decision.hasSubcategories !== null && (
                                  <div className="cgw-question cgw-question--indented">
                                    <span className="cgw-question-label">
                                      Does this category have additional
                                      variables?{" "}
                                      <span className="cgw-question-meta">
                                        (e.g. Players, Platform)
                                      </span>
                                    </span>
                                    <div className="cgw-yn">
                                      <button
                                        className={`cgw-yn-btn ${decision.hasVariables === true ? "cgw-yn-btn--active" : ""}`}
                                        onClick={() =>
                                          setCatDecision(
                                            activePlatIdx,
                                            ci,
                                            "hasVariables",
                                            true,
                                          )
                                        }
                                      >
                                        Yes
                                      </button>
                                      <button
                                        className={`cgw-yn-btn ${decision.hasVariables === false ? "cgw-yn-btn--active" : ""}`}
                                        onClick={() => {
                                          setCatDecision(
                                            activePlatIdx,
                                            ci,
                                            "hasVariables",
                                            false,
                                          );
                                          // Remove all filter variables
                                          filterVars.forEach((_, fvi) => {
                                            const realIdx =
                                              cat.variables.findIndex(
                                                (v, i) =>
                                                  !v.is_subcategory &&
                                                  i === fvi,
                                              );
                                            if (realIdx !== -1)
                                              removeVariable(
                                                activePlatIdx,
                                                ci,
                                                realIdx,
                                              );
                                          });
                                        }}
                                      >
                                        No
                                      </button>
                                    </div>
                                  </div>
                                )}

                                {/* Filter variable builder */}
                                {decision.hasVariables === true && (
                                  <div className="cgw-guided-section">
                                    {/* Existing filter variables */}
                                    {filterVars.map((variable, fvi) => {
                                      const vi = cat.variables.findIndex(
                                        (v, i) =>
                                          !v.is_subcategory &&
                                          cat.variables
                                            .filter((vv) => !vv.is_subcategory)
                                            .indexOf(v) === fvi,
                                      );
                                      const varKey = `${activePlatIdx}-${ci}-${vi}`;
                                      const isVarExpanded =
                                        expandedVars[varKey];
                                      const valForm = valForms[varKey] ?? {
                                        name: "",
                                        slug: "",
                                        is_coop: false,
                                        required_players: 2,
                                      };

                                      return (
                                        <div key={fvi} className="cgw-var-card">
                                          <div className="cgw-var-header">
                                            <button
                                              className="cgw-card-toggle"
                                              onClick={() =>
                                                toggleVar(activePlatIdx, ci, vi)
                                              }
                                            >
                                              <span className="cgw-card-name">
                                                {variable.name}
                                              </span>
                                              <span className="cgw-card-slug">
                                                /{variable.slug}
                                              </span>
                                              <span className="cgw-var-type cgw-var-type--filter">
                                                Filter
                                              </span>
                                              <span className="cgw-card-meta">
                                                {variable.values.length} values
                                              </span>
                                              <span className="cgw-chevron">
                                                {isVarExpanded ? "▲" : "▼"}
                                              </span>
                                            </button>
                                            <button
                                              className="cgw-remove cgw-remove--lg"
                                              onClick={() =>
                                                removeVariable(
                                                  activePlatIdx,
                                                  ci,
                                                  vi,
                                                )
                                              }
                                            >
                                              ×
                                            </button>
                                          </div>
                                          {isVarExpanded && (
                                            <div className="cgw-var-body">
                                              {variable.values.length > 0 && (
                                                <div className="cgw-tag-list">
                                                  {variable.values.map(
                                                    (val, vli) => (
                                                      <span
                                                        key={vli}
                                                        className="cgw-tag"
                                                      >
                                                        {val.name}
                                                        {val.is_coop && (
                                                          <span className="cgw-tag-meta">
                                                            co-op{" "}
                                                            {
                                                              val.required_players
                                                            }
                                                            p
                                                          </span>
                                                        )}
                                                        <button
                                                          className="cgw-remove"
                                                          onClick={() =>
                                                            removeValue(
                                                              activePlatIdx,
                                                              ci,
                                                              vi,
                                                              vli,
                                                            )
                                                          }
                                                        >
                                                          ×
                                                        </button>
                                                      </span>
                                                    ),
                                                  )}
                                                </div>
                                              )}
                                              <div className="cgw-inline-form">
                                                <input
                                                  className="auth-input"
                                                  placeholder="Value name (e.g. 1 Player)"
                                                  value={valForm.name}
                                                  onChange={(e) =>
                                                    setValForms((prev) => ({
                                                      ...prev,
                                                      [varKey]: {
                                                        ...valForm,
                                                        name: e.target.value,
                                                        slug: slugify(
                                                          e.target.value,
                                                        ),
                                                      },
                                                    }))
                                                  }
                                                />
                                                <input
                                                  className="auth-input cgw-slug-input"
                                                  placeholder="slug"
                                                  value={valForm.slug}
                                                  onChange={(e) =>
                                                    setValForms((prev) => ({
                                                      ...prev,
                                                      [varKey]: {
                                                        ...valForm,
                                                        slug: e.target.value,
                                                      },
                                                    }))
                                                  }
                                                />
                                              </div>
                                              <div className="cgw-coop-row">
                                                <input
                                                  type="checkbox"
                                                  id={`coop-${varKey}`}
                                                  checked={valForm.is_coop}
                                                  onChange={(e) =>
                                                    setValForms((prev) => ({
                                                      ...prev,
                                                      [varKey]: {
                                                        ...valForm,
                                                        is_coop:
                                                          e.target.checked,
                                                      },
                                                    }))
                                                  }
                                                />
                                                <label
                                                  htmlFor={`coop-${varKey}`}
                                                  className="form-label cgw-coop-label"
                                                >
                                                  Co-op
                                                </label>
                                                {valForm.is_coop && (
                                                  <input
                                                    type="number"
                                                    className="auth-input cgw-players-input"
                                                    min={2}
                                                    value={
                                                      valForm.required_players
                                                    }
                                                    onChange={(e) =>
                                                      setValForms((prev) => ({
                                                        ...prev,
                                                        [varKey]: {
                                                          ...valForm,
                                                          required_players:
                                                            parseInt(
                                                              e.target.value,
                                                            ),
                                                        },
                                                      }))
                                                    }
                                                  />
                                                )}
                                              </div>
                                              <button
                                                className="btn cgw-sm-btn"
                                                onClick={() =>
                                                  addValue(
                                                    activePlatIdx,
                                                    ci,
                                                    vi,
                                                  )
                                                }
                                                disabled={
                                                  !valForm.name || !valForm.slug
                                                }
                                              >
                                                + Add Value
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}

                                    {/* Add filter variable */}
                                    <div className="cgw-add-var">
                                      <div className="cgw-inline-form">
                                        <input
                                          className="auth-input"
                                          placeholder="Variable name (e.g. Players)"
                                          value={
                                            varForms[
                                              `${activePlatIdx}-${ci}-filter`
                                            ]?.name ?? ""
                                          }
                                          onChange={(e) =>
                                            setVarForms((prev) => ({
                                              ...prev,
                                              [`${activePlatIdx}-${ci}-filter`]:
                                                {
                                                  name: e.target.value,
                                                  slug: slugify(e.target.value),
                                                },
                                            }))
                                          }
                                        />
                                        <input
                                          className="auth-input cgw-slug-input"
                                          placeholder="slug"
                                          value={
                                            varForms[
                                              `${activePlatIdx}-${ci}-filter`
                                            ]?.slug ?? ""
                                          }
                                          onChange={(e) =>
                                            setVarForms((prev) => ({
                                              ...prev,
                                              [`${activePlatIdx}-${ci}-filter`]:
                                                {
                                                  ...varForms[
                                                    `${activePlatIdx}-${ci}-filter`
                                                  ],
                                                  slug: e.target.value,
                                                },
                                            }))
                                          }
                                        />
                                        <button
                                          className="btn btn-primary cgw-add-btn"
                                          onClick={() => {
                                            const form =
                                              varForms[
                                                `${activePlatIdx}-${ci}-filter`
                                              ];
                                            if (!form?.name || !form?.slug)
                                              return;
                                            const newVar: VariableDraft = {
                                              name: form.name,
                                              slug: form.slug,
                                              is_subcategory: false,
                                              order: cat.variables.length,
                                              values: [],
                                            };
                                            const newVi = cat.variables.length;
                                            setPlatforms((prev) =>
                                              prev.map((p, pi) =>
                                                pi !== activePlatIdx
                                                  ? p
                                                  : {
                                                      ...p,
                                                      categories:
                                                        p.categories.map(
                                                          (c, cii) =>
                                                            cii !== ci
                                                              ? c
                                                              : {
                                                                  ...c,
                                                                  variables: [
                                                                    ...c.variables,
                                                                    newVar,
                                                                  ],
                                                                },
                                                        ),
                                                    },
                                              ),
                                            );
                                            setExpandedVars((prev) => ({
                                              ...prev,
                                              [`${activePlatIdx}-${ci}-${newVi}`]: true,
                                            }));
                                            setVarForms((prev) => ({
                                              ...prev,
                                              [`${activePlatIdx}-${ci}-filter`]:
                                                { name: "", slug: "" },
                                            }));
                                          }}
                                          disabled={
                                            !varForms[
                                              `${activePlatIdx}-${ci}-filter`
                                            ]?.name
                                          }
                                        >
                                          + Add Variable
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Add category */}
                <div className="cgw-inline-form cgw-add-cat">
                  <input
                    className="auth-input"
                    placeholder="Category name (e.g. Any%)"
                    value={catForm.name}
                    onChange={(e) =>
                      setCatForm({
                        name: e.target.value,
                        slug: slugify(e.target.value),
                        category_type: catForm.category_type,
                        scoring_type: catForm.scoring_type,
                      })
                    }
                  />
                  <input
                    className="auth-input cgw-slug-input"
                    placeholder="slug"
                    value={catForm.slug}
                    onChange={(e) =>
                      setCatForm({ ...catForm, slug: e.target.value })
                    }
                  />
                  <select
                    className="auth-input"
                    value={catForm.category_type}
                    onChange={(e) =>
                      setCatForm({ ...catForm, category_type: e.target.value })
                    }
                  >
                    <option value="full_game">Full Game</option>
                    <option value="il">Individual Level</option>
                    <option value="extension">Other (CE)</option>
                  </select>
                  <select
                    className="auth-input"
                    value={catForm.scoring_type}
                    onChange={(e) =>
                      setCatForm({ ...catForm, scoring_type: e.target.value })
                    }
                  >
                    <option value="">Time (default)</option>
                    <option value="lowcast">Lowcast</option>
                    <option value="highscore">High Score</option>
                  </select>
                  <button
                    className="btn btn-primary cgw-add-btn"
                    onClick={() => addCategory(activePlatIdx)}
                    disabled={!catForm.name || !catForm.slug}
                  >
                    + Add Category
                  </button>
                </div>
              </section>
            </>
          )}
        </>
      )}

      {/* ── Submit ── */}
      <section className="cgw-section cgw-submit-section">
        {error && <p className="auth-error">{error}</p>}
        {success && <p className="auth-success">{success}</p>}
        <button
          className="btn btn-primary btn-full"
          onClick={handleSubmit}
          disabled={
            submitting || !gameName || !gameSlug || platforms.length === 0
          }
        >
          {submitting ? "Creating..." : "✨ Create Game"}
        </button>
      </section>
    </div>
  );
}
