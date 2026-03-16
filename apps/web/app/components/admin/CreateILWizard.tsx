"use client";
import { useState, useEffect } from "react";
import "../../styles/creategamewizard.css";

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

interface LevelCategoryDraft {
  name: string;
  slug: string;
  variables: VariableDraft[];
}

interface LevelDraft {
  name: string;
  slug: string;
  order: number;
  level_categories: LevelCategoryDraft[];
}

interface CatDecision {
  hasSubcategories: boolean | null;
  hasVariables: boolean | null;
}

function slugify(str: string) {
  return str.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export default function CreateILWizard({
  games,
  token,
}: {
  games: Game[];
  token: string | null;
}) {
  const [gameSlug, setGameSlug] = useState("");
  const [platformSlug, setPlatformSlug] = useState("");
  const [levels, setLevels] = useState<LevelDraft[]>([]);
  const [loadingLevels, setLoadingLevels] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Level form
  const [levelForm, setLevelForm] = useState({ name: "", slug: "", order: 0 });

  // Category form keyed by levelIdx
  const [catForms, setCatForms] = useState<Record<number, { name: string; slug: string }>>({});

  // Expanded state
  const [expandedLevels, setExpandedLevels] = useState<Record<number, boolean>>({});
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});
  const [expandedVars, setExpandedVars] = useState<Record<string, boolean>>({});

  // Per-category guided decisions keyed by "levelIdx-catIdx"
  const [catDecisions, setCatDecisions] = useState<Record<string, CatDecision>>({});

  // Variable forms keyed by "levelIdx-catIdx"
  const [varForms, setVarForms] = useState<Record<string, { name: string; slug: string }>>({});

  // Value forms keyed by "levelIdx-catIdx-varIdx"
  const [valForms, setValForms] = useState<Record<string, { name: string; slug: string; is_coop: boolean; required_players: number }>>({});

  const selectedPlatforms = games.find((g) => g.slug === gameSlug)?.platforms || [];

  // Fetch existing levels
  useEffect(() => {
    if (!gameSlug || !platformSlug) { setLevels([]); return; }
    setLoadingLevels(true);
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/games/${gameSlug}/${platformSlug}/levels`)
      .then((r) => r.json())
      .then((d) => {
        const fetched: LevelDraft[] = (d.levels || []).map((l: any) => ({
          name: l.name,
          slug: l.slug,
          order: l.order,
          level_categories: (l.level_categories || []).map((c: any) => ({
            name: c.name,
            slug: c.slug,
            variables: [],
          })),
        }));
        setLevels(fetched);
        setLevelForm((prev) => ({ ...prev, order: fetched.length }));
      })
      .catch(console.error)
      .finally(() => setLoadingLevels(false));
  }, [gameSlug, platformSlug]);

  const setCatDecision = (levelIdx: number, catIdx: number, key: keyof CatDecision, value: boolean) => {
    const dKey = `${levelIdx}-${catIdx}`;
    setCatDecisions((prev) => ({
      ...prev,
      [dKey]: { ...(prev[dKey] ?? { hasSubcategories: null, hasVariables: null }), [key]: value },
    }));
  };

  // ── Levels ──
  const addLevel = () => {
    if (!levelForm.name.trim() || !levelForm.slug.trim()) return;
    const newLevel: LevelDraft = { ...levelForm, level_categories: [] };
    setLevels((prev) => [...prev, newLevel]);
    setExpandedLevels((prev) => ({ ...prev, [levels.length]: true }));
    setLevelForm({ name: "", slug: "", order: levels.length + 1 });
  };

  const removeLevel = (li: number) => {
    setLevels((prev) => prev.filter((_, i) => i !== li));
  };

  // ── Level Categories ──
  const addCategory = (li: number) => {
    const form = catForms[li];
    if (!form?.name.trim() || !form?.slug.trim()) return;
    const newCat: LevelCategoryDraft = { name: form.name, slug: form.slug, variables: [] };
    setLevels((prev) => prev.map((l, i) =>
      i !== li ? l : { ...l, level_categories: [...l.level_categories, newCat] }
    ));
    const catIdx = levels[li].level_categories.length;
    setExpandedCats((prev) => ({ ...prev, [`${li}-${catIdx}`]: true }));
    setCatForms((prev) => ({ ...prev, [li]: { name: "", slug: "" } }));
  };

  const removeCategory = (li: number, ci: number) => {
    setLevels((prev) => prev.map((l, i) =>
      i !== li ? l : { ...l, level_categories: l.level_categories.filter((_, j) => j !== ci) }
    ));
  };

  // ── Variables ──
  const addVariable = (li: number, ci: number, isSubcategory: boolean) => {
    const key = isSubcategory ? `${li}-${ci}-sub` : `${li}-${ci}-filter`;
    const form = varForms[key];
    if (!form?.name.trim() || !form?.slug.trim()) return;
    const cat = levels[li].level_categories[ci];
    const newVar: VariableDraft = {
      name: form.name,
      slug: form.slug,
      is_subcategory: isSubcategory,
      order: cat.variables.length,
      values: [],
    };
    setLevels((prev) => prev.map((l, i) =>
      i !== li ? l : {
        ...l,
        level_categories: l.level_categories.map((c, j) =>
          j !== ci ? c : { ...c, variables: [...c.variables, newVar] }
        ),
      }
    ));
    const varIdx = cat.variables.length;
    setExpandedVars((prev) => ({ ...prev, [`${li}-${ci}-${varIdx}`]: true }));
    setVarForms((prev) => ({ ...prev, [key]: { name: "", slug: "" } }));
  };

  const removeVariable = (li: number, ci: number, vi: number) => {
    setLevels((prev) => prev.map((l, i) =>
      i !== li ? l : {
        ...l,
        level_categories: l.level_categories.map((c, j) =>
          j !== ci ? c : {
            ...c,
            variables: c.variables
              .filter((_, k) => k !== vi)
              .map((v, k) => ({ ...v, order: k })),
          }
        ),
      }
    ));
  };

  // ── Values ──
  const addValue = (li: number, ci: number, vi: number) => {
    const key = `${li}-${ci}-${vi}`;
    const form = valForms[key];
    if (!form?.name.trim() || !form?.slug.trim()) return;
    setLevels((prev) => prev.map((l, i) =>
      i !== li ? l : {
        ...l,
        level_categories: l.level_categories.map((c, j) =>
          j !== ci ? c : {
            ...c,
            variables: c.variables.map((v, k) =>
              k !== vi ? v : { ...v, values: [...v.values, { ...form }] }
            ),
          }
        ),
      }
    ));
    setValForms((prev) => ({ ...prev, [key]: { name: "", slug: "", is_coop: false, required_players: 2 } }));
  };

  const removeValue = (li: number, ci: number, vi: number, vli: number) => {
    setLevels((prev) => prev.map((l, i) =>
      i !== li ? l : {
        ...l,
        level_categories: l.level_categories.map((c, j) =>
          j !== ci ? c : {
            ...c,
            variables: c.variables.map((v, k) =>
              k !== vi ? v : { ...v, values: v.values.filter((_, m) => m !== vli) }
            ),
          }
        ),
      }
    ));
  };

  // ── Submit ──
  const handleSubmit = async () => {
    if (!gameSlug || !platformSlug) { setError("Select a game and platform"); return; }
    if (levels.length === 0) { setError("Add at least one level"); return; }
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      for (const level of levels) {
        // Create level
        const levelRes = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/games/${gameSlug}/${platformSlug}/levels`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ name: level.name, level_slug: level.slug, order: level.order }),
          }
        );
        const levelData = await levelRes.json();
        if (!levelRes.ok) throw new Error(levelData.error || `Failed to create level ${level.name}`);

        for (const cat of level.level_categories) {
          // Create level category
          const catRes = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/games/${gameSlug}/${platformSlug}/levels/${level.slug}/categories`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ name: cat.name, category_slug: cat.slug }),
            }
          );
          const catData = await catRes.json();
          if (!catRes.ok) throw new Error(catData.error || `Failed to create category ${cat.name}`);

          for (const variable of cat.variables) {
            if (variable.values.length === 0) continue;
            const varRes = await fetch(
              `${process.env.NEXT_PUBLIC_API_URL}/games/${gameSlug}/${platformSlug}/${level.slug}/${cat.slug}/level-category-variables`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
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
              }
            );
            const varData = await varRes.json();
            if (!varRes.ok) throw new Error(varData.error || `Failed to create variable ${variable.name}`);
          }
        }
      }
      setSuccess(`${levels.length} level${levels.length !== 1 ? "s" : ""} created successfully.`);
      setLevels([]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="cgw">
      {/* ── Game + Platform ── */}
      <section className="cgw-section">
        <h3 className="cgw-section-title">Game & Platform</h3>
        <div className="cgw-inline-form">
          <select
            className="auth-input"
            value={gameSlug}
            onChange={(e) => { setGameSlug(e.target.value); setPlatformSlug(""); setLevels([]); }}
          >
            <option value="">Select Game</option>
            {games.map((g) => <option key={g.id} value={g.slug}>{g.name}</option>)}
          </select>
          <select
            className="auth-input"
            value={platformSlug}
            onChange={(e) => setPlatformSlug(e.target.value)}
            disabled={!gameSlug}
          >
            <option value="">Select Platform</option>
            {selectedPlatforms.map((p) => <option key={p.id} value={p.slug}>{p.name}</option>)}
          </select>
        </div>
      </section>

      {platformSlug && (
        <>
          {loadingLevels ? (
            <p style={{ opacity: 0.6 }}>Loading existing levels...</p>
          ) : (
            <>
              {/* ── Levels ── */}
              <section className="cgw-section">
                <h3 className="cgw-section-title">Levels</h3>

                {levels.map((level, li) => {
                  const isExpanded = expandedLevels[li];
                  return (
                    <div key={li} className="cgw-card">
                      <div className="cgw-card-header">
                        <button className="cgw-card-toggle" onClick={() => setExpandedLevels((prev) => ({ ...prev, [li]: !prev[li] }))}>
                          <span className="cgw-card-name">{level.name}</span>
                          <span className="cgw-card-slug">/{level.slug}</span>
                          {level.level_categories.length > 0 && (
                            <span className="cgw-card-meta">{level.level_categories.length} categor{level.level_categories.length !== 1 ? "ies" : "y"}</span>
                          )}
                          <span className="cgw-chevron">{isExpanded ? "▲" : "▼"}</span>
                        </button>
                        <button className="cgw-remove cgw-remove--lg" onClick={() => removeLevel(li)}>×</button>
                      </div>

                      {isExpanded && (
                        <div className="cgw-card-body">
                          {/* Level Categories */}
                          {level.level_categories.map((cat, ci) => {
                            const catKey = `${li}-${ci}`;
                            const isCatExpanded = expandedCats[catKey];
                            const decision = catDecisions[catKey] ?? { hasSubcategories: null, hasVariables: null };
                            const subcatVar = cat.variables.find((v) => v.is_subcategory);
                            const filterVars = cat.variables.filter((v) => !v.is_subcategory);

                            return (
                              <div key={ci} className="cgw-card">
                                <div className="cgw-card-header">
                                  <button className="cgw-card-toggle" onClick={() => setExpandedCats((prev) => ({ ...prev, [catKey]: !prev[catKey] }))}>
                                    <span className="cgw-card-name">{cat.name}</span>
                                    <span className="cgw-card-slug">/{cat.slug}</span>
                                    {cat.variables.length > 0 && (
                                      <span className="cgw-card-meta">{cat.variables.length} variable{cat.variables.length !== 1 ? "s" : ""}</span>
                                    )}
                                    <span className="cgw-chevron">{isCatExpanded ? "▲" : "▼"}</span>
                                  </button>
                                  <button className="cgw-remove cgw-remove--lg" onClick={() => removeCategory(li, ci)}>×</button>
                                </div>

                                {isCatExpanded && (
                                  <div className="cgw-card-body">
                                    {/* Q1: Subcategories? */}
                                    <div className="cgw-question">
                                      <span className="cgw-question-label">Does this level category have subcategories?</span>
                                      <div className="cgw-yn">
                                        <button
                                          className={`cgw-yn-btn ${decision.hasSubcategories === true ? "cgw-yn-btn--active" : ""}`}
                                          onClick={() => setCatDecision(li, ci, "hasSubcategories", true)}
                                        >Yes</button>
                                        <button
                                          className={`cgw-yn-btn ${decision.hasSubcategories === false ? "cgw-yn-btn--active" : ""}`}
                                          onClick={() => {
                                            setCatDecision(li, ci, "hasSubcategories", false);
                                            if (subcatVar) {
                                              const vi = cat.variables.findIndex((v) => v.is_subcategory);
                                              if (vi !== -1) removeVariable(li, ci, vi);
                                            }
                                          }}
                                        >No</button>
                                      </div>
                                    </div>

                                    {/* Subcategory variable builder */}
                                    {decision.hasSubcategories === true && (
                                      <div className="cgw-guided-section">
                                        {subcatVar ? (
                                          <div className="cgw-var-card">
                                            <div className="cgw-var-header">
                                              <button className="cgw-card-toggle" onClick={() => {
                                                const vi = cat.variables.findIndex((v) => v.is_subcategory);
                                                setExpandedVars((prev) => ({ ...prev, [`${catKey}-${vi}`]: !prev[`${catKey}-${vi}`] }));
                                              }}>
                                                <span className="cgw-card-name">{subcatVar.name}</span>
                                                <span className="cgw-card-slug">/{subcatVar.slug}</span>
                                                <span className="cgw-var-type cgw-var-type--sub">Subcategory</span>
                                                <span className="cgw-card-meta">{subcatVar.values.length} values</span>
                                                <span className="cgw-chevron">{expandedVars[`${catKey}-${cat.variables.findIndex((v) => v.is_subcategory)}`] ? "▲" : "▼"}</span>
                                              </button>
                                              <button className="cgw-remove cgw-remove--lg" onClick={() => removeVariable(li, ci, cat.variables.findIndex((v) => v.is_subcategory))}>×</button>
                                            </div>
                                            {expandedVars[`${catKey}-${cat.variables.findIndex((v) => v.is_subcategory)}`] && (
                                              <div className="cgw-var-body">
                                                {subcatVar.values.length > 0 && (
                                                  <div className="cgw-tag-list">
                                                    {subcatVar.values.map((val, vli) => {
                                                      const subVi = cat.variables.findIndex((v) => v.is_subcategory);
                                                      return (
                                                        <span key={vli} className="cgw-tag">
                                                          {val.name}
                                                          {val.is_coop && <span className="cgw-tag-meta">co-op {val.required_players}p</span>}
                                                          <button className="cgw-remove" onClick={() => removeValue(li, ci, subVi, vli)}>×</button>
                                                        </span>
                                                      );
                                                    })}
                                                  </div>
                                                )}
                                                {(() => {
                                                  const subVi = cat.variables.findIndex((v) => v.is_subcategory);
                                                  const vKey = `${catKey}-${subVi}`;
                                                  const vf = valForms[vKey] ?? { name: "", slug: "", is_coop: false, required_players: 2 };
                                                  return (
                                                    <>
                                                      <div className="cgw-inline-form">
                                                        <input className="auth-input" placeholder="Value name (e.g. Clare)" value={vf.name} onChange={(e) => setValForms((prev) => ({ ...prev, [vKey]: { ...vf, name: e.target.value, slug: slugify(e.target.value) } }))} />
                                                        <input className="auth-input cgw-slug-input" placeholder="slug" value={vf.slug} onChange={(e) => setValForms((prev) => ({ ...prev, [vKey]: { ...vf, slug: e.target.value } }))} />
                                                      </div>
                                                      <div className="cgw-coop-row">
                                                        <input type="checkbox" id={`coop-${vKey}`} checked={vf.is_coop} onChange={(e) => setValForms((prev) => ({ ...prev, [vKey]: { ...vf, is_coop: e.target.checked } }))} />
                                                        <label htmlFor={`coop-${vKey}`} className="form-label cgw-coop-label">Co-op</label>
                                                        {vf.is_coop && <input type="number" className="auth-input cgw-players-input" min={2} value={vf.required_players} onChange={(e) => setValForms((prev) => ({ ...prev, [vKey]: { ...vf, required_players: parseInt(e.target.value) } }))} />}
                                                      </div>
                                                      <button className="btn cgw-sm-btn" onClick={() => addValue(li, ci, subVi)} disabled={!vf.name || !vf.slug}>+ Add Value</button>
                                                    </>
                                                  );
                                                })()}
                                              </div>
                                            )}
                                          </div>
                                        ) : (
                                          <>
                                            <p className="cgw-hint">Name the subcategory split (e.g. "Path" for Clare / Leon)</p>
                                            <div className="cgw-inline-form">
                                              <input
                                                className="auth-input"
                                                placeholder="Variable name (e.g. Path)"
                                                value={varForms[`${catKey}-sub`]?.name ?? ""}
                                                onChange={(e) => setVarForms((prev) => ({ ...prev, [`${catKey}-sub`]: { name: e.target.value, slug: slugify(e.target.value) } }))}
                                              />
                                              <input
                                                className="auth-input cgw-slug-input"
                                                placeholder="slug"
                                                value={varForms[`${catKey}-sub`]?.slug ?? ""}
                                                onChange={(e) => setVarForms((prev) => ({ ...prev, [`${catKey}-sub`]: { ...varForms[`${catKey}-sub`], slug: e.target.value } }))}
                                              />
                                              <button
                                                className="btn btn-primary cgw-add-btn"
                                                onClick={() => addVariable(li, ci, true)}
                                                disabled={!varForms[`${catKey}-sub`]?.name}
                                              >
                                                + Set Subcategory Variable
                                              </button>
                                            </div>
                                          </>
                                        )}
                                      </div>
                                    )}

                                    {/* Q2: Additional variables? */}
                                    {decision.hasSubcategories !== null && (
                                      <div className="cgw-question cgw-question--indented">
                                        <span className="cgw-question-label">Does this level category have additional variables? <span className="cgw-question-meta">(e.g. Players, Version)</span></span>
                                        <div className="cgw-yn">
                                          <button
                                            className={`cgw-yn-btn ${decision.hasVariables === true ? "cgw-yn-btn--active" : ""}`}
                                            onClick={() => setCatDecision(li, ci, "hasVariables", true)}
                                          >Yes</button>
                                          <button
                                            className={`cgw-yn-btn ${decision.hasVariables === false ? "cgw-yn-btn--active" : ""}`}
                                            onClick={() => {
                                              setCatDecision(li, ci, "hasVariables", false);
                                              filterVars.forEach((_, fvi) => {
                                                const vi = cat.variables.findIndex((v, i) => !v.is_subcategory && cat.variables.filter((vv) => !vv.is_subcategory).indexOf(v) === fvi);
                                                if (vi !== -1) removeVariable(li, ci, vi);
                                              });
                                            }}
                                          >No</button>
                                        </div>
                                      </div>
                                    )}

                                    {/* Filter variable builder */}
                                    {decision.hasVariables === true && (
                                      <div className="cgw-guided-section">
                                        {filterVars.map((variable, fvi) => {
                                          const vi = cat.variables.findIndex((v, i) => !v.is_subcategory && cat.variables.filter((vv) => !vv.is_subcategory).indexOf(v) === fvi);
                                          const varKey = `${catKey}-${vi}`;
                                          const isVarExpanded = expandedVars[varKey];
                                          const valForm = valForms[varKey] ?? { name: "", slug: "", is_coop: false, required_players: 2 };

                                          return (
                                            <div key={fvi} className="cgw-var-card">
                                              <div className="cgw-var-header">
                                                <button className="cgw-card-toggle" onClick={() => setExpandedVars((prev) => ({ ...prev, [varKey]: !prev[varKey] }))}>
                                                  <span className="cgw-card-name">{variable.name}</span>
                                                  <span className="cgw-card-slug">/{variable.slug}</span>
                                                  <span className="cgw-var-type cgw-var-type--filter">Filter</span>
                                                  <span className="cgw-card-meta">{variable.values.length} values</span>
                                                  <span className="cgw-chevron">{isVarExpanded ? "▲" : "▼"}</span>
                                                </button>
                                                <button className="cgw-remove cgw-remove--lg" onClick={() => removeVariable(li, ci, vi)}>×</button>
                                              </div>
                                              {isVarExpanded && (
                                                <div className="cgw-var-body">
                                                  {variable.values.length > 0 && (
                                                    <div className="cgw-tag-list">
                                                      {variable.values.map((val, vli) => (
                                                        <span key={vli} className="cgw-tag">
                                                          {val.name}
                                                          {val.is_coop && <span className="cgw-tag-meta">co-op {val.required_players}p</span>}
                                                          <button className="cgw-remove" onClick={() => removeValue(li, ci, vi, vli)}>×</button>
                                                        </span>
                                                      ))}
                                                    </div>
                                                  )}
                                                  <div className="cgw-inline-form">
                                                    <input className="auth-input" placeholder="Value name (e.g. 1 Player)" value={valForm.name} onChange={(e) => setValForms((prev) => ({ ...prev, [varKey]: { ...valForm, name: e.target.value, slug: slugify(e.target.value) } }))} />
                                                    <input className="auth-input cgw-slug-input" placeholder="slug" value={valForm.slug} onChange={(e) => setValForms((prev) => ({ ...prev, [varKey]: { ...valForm, slug: e.target.value } }))} />
                                                  </div>
                                                  <div className="cgw-coop-row">
                                                    <input type="checkbox" id={`coop-${varKey}`} checked={valForm.is_coop} onChange={(e) => setValForms((prev) => ({ ...prev, [varKey]: { ...valForm, is_coop: e.target.checked } }))} />
                                                    <label htmlFor={`coop-${varKey}`} className="form-label cgw-coop-label">Co-op</label>
                                                    {valForm.is_coop && <input type="number" className="auth-input cgw-players-input" min={2} value={valForm.required_players} onChange={(e) => setValForms((prev) => ({ ...prev, [varKey]: { ...valForm, required_players: parseInt(e.target.value) } }))} />}
                                                  </div>
                                                  <button className="btn cgw-sm-btn" onClick={() => addValue(li, ci, vi)} disabled={!valForm.name || !valForm.slug}>+ Add Value</button>
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
                                              value={varForms[`${catKey}-filter`]?.name ?? ""}
                                              onChange={(e) => setVarForms((prev) => ({ ...prev, [`${catKey}-filter`]: { name: e.target.value, slug: slugify(e.target.value) } }))}
                                            />
                                            <input
                                              className="auth-input cgw-slug-input"
                                              placeholder="slug"
                                              value={varForms[`${catKey}-filter`]?.slug ?? ""}
                                              onChange={(e) => setVarForms((prev) => ({ ...prev, [`${catKey}-filter`]: { ...varForms[`${catKey}-filter`], slug: e.target.value } }))}
                                            />
                                            <button
                                              className="btn btn-primary cgw-add-btn"
                                              onClick={() => addVariable(li, ci, false)}
                                              disabled={!varForms[`${catKey}-filter`]?.name}
                                            >
                                              + Add Variable
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    )}
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
                              value={catForms[li]?.name ?? ""}
                              onChange={(e) => setCatForms((prev) => ({ ...prev, [li]: { name: e.target.value, slug: slugify(e.target.value) } }))}
                            />
                            <input
                              className="auth-input cgw-slug-input"
                              placeholder="slug"
                              value={catForms[li]?.slug ?? ""}
                              onChange={(e) => setCatForms((prev) => ({ ...prev, [li]: { ...catForms[li], slug: e.target.value } }))}
                            />
                            <button
                              className="btn btn-primary cgw-add-btn"
                              onClick={() => addCategory(li)}
                              disabled={!catForms[li]?.name || !catForms[li]?.slug}
                            >
                              + Add Category
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Add level */}
                <div className="cgw-inline-form" style={{ marginTop: "1rem" }}>
                  <input
                    className="auth-input"
                    placeholder="Level name (e.g. Raccoon City)"
                    value={levelForm.name}
                    onChange={(e) => setLevelForm({ ...levelForm, name: e.target.value, slug: slugify(e.target.value) })}
                  />
                  <input
                    className="auth-input cgw-slug-input"
                    placeholder="slug"
                    value={levelForm.slug}
                    onChange={(e) => setLevelForm({ ...levelForm, slug: e.target.value })}
                  />
                  <button
                    className="btn btn-primary cgw-add-btn"
                    onClick={addLevel}
                    disabled={!levelForm.name || !levelForm.slug}
                  >
                    + Add Level
                  </button>
                </div>
              </section>

              {/* ── Submit ── */}
              <section className="cgw-section cgw-submit-section">
                {error && <p className="auth-error">{error}</p>}
                {success && <p className="auth-success">{success}</p>}
                <button
                  className="btn btn-primary btn-full"
                  onClick={handleSubmit}
                  disabled={submitting || levels.length === 0}
                >
                  {submitting ? "Creating..." : "✨ Create ILs"}
                </button>
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}