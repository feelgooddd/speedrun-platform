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

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface ExistingVariable {
  id: string;
  name: string;
  slug: string;
  is_subcategory: boolean;
  order: number;
}

interface VariableValueDraft {
  name: string;
  slug: string;
  is_coop: boolean;
  required_players: number;
}

function slugify(str: string) {
  return str.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export default function VariableForm({ games, token }: { games: Game[]; token: string | null }) {
  const [gameSlug, setGameSlug] = useState("");
  const [platformSlug, setPlatformSlug] = useState("");
  const [categorySlug, setCategorySlug] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [existingVars, setExistingVars] = useState<ExistingVariable[]>([]);
  const [varName, setVarName] = useState("");
  const [varSlug, setVarSlug] = useState("");
  const [isSubcategory, setIsSubcategory] = useState(false);
  const [order, setOrder] = useState(0);
  const [values, setValues] = useState<VariableValueDraft[]>([]);
  const [valForm, setValForm] = useState({ name: "", slug: "", is_coop: false, required_players: 2 });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const selectedPlatforms = games.find((g) => g.slug === gameSlug)?.platforms || [];

  // Fetch categories when game+platform selected
  useEffect(() => {
    if (!gameSlug || !platformSlug) { setCategories([]); setCategorySlug(""); setExistingVars([]); return; }
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/games/${gameSlug}/${platformSlug}/categories`)
      .then((r) => r.json())
      .then((d) => setCategories(d.categories || []))
      .catch(console.error);
  }, [gameSlug, platformSlug]);

  // Fetch existing variables when category selected
  useEffect(() => {
    if (!gameSlug || !platformSlug || !categorySlug) { setExistingVars([]); return; }
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/games/${gameSlug}/${platformSlug}/categories`)
      .then((r) => r.json())
      .then((d) => {
        const cat = (d.categories || []).find((c: any) => c.slug === categorySlug);
        const vars: ExistingVariable[] = cat?.variables || [];
        setExistingVars(vars);
        setOrder(vars.length); // auto-set order to next available
        // If there's already an is_subcategory var, default new ones to false
        const hasSubcatVar = vars.some((v) => v.is_subcategory);
        setIsSubcategory(!hasSubcatVar);
      })
      .catch(console.error);
  }, [categorySlug]);

  const hasSubcategoryVar = existingVars.some((v) => v.is_subcategory);

  const addValue = () => {
    if (!valForm.name.trim() || !valForm.slug.trim()) return;
    setValues((prev) => [...prev, { ...valForm }]);
    setValForm({ name: "", slug: "", is_coop: false, required_players: 2 });
  };

  const removeValue = (i: number) => setValues((prev) => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!varName || !varSlug) { setError("Variable name and slug are required"); return; }
    if (values.length === 0) { setError("Add at least one value"); return; }
    if (isSubcategory && hasSubcategoryVar) {
      setError(`This category already has a subcategory variable (${existingVars.find(v => v.is_subcategory)?.name}). Only one is allowed.`);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/games/${gameSlug}/${platformSlug}/${categorySlug}/variables`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            variable_name: varName,
            variable_slug: varSlug,
            is_subcategory: isSubcategory,
            order,
            values: values.map((v) => ({
              name: v.name,
              slug: v.slug,
              is_coop: v.is_coop,
              required_players: v.is_coop ? v.required_players : null,
            })),
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create variable");
      setSuccess(`Variable "${data.variable.name}" created with ${data.variable.values.length} values.`);
      setVarName(""); setVarSlug(""); setValues([]);
      // Refresh existing vars
      const updated = [...existingVars, { id: data.variable.id, name: data.variable.name, slug: data.variable.slug, is_subcategory: isSubcategory, order }];
      setExistingVars(updated);
      setOrder(updated.length);
      setIsSubcategory(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Game / Platform / Category selects */}
      <div className="form-group">
        <label className="form-label">Game, Platform & Category</label>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <select
            className="auth-input"
            value={gameSlug}
            onChange={(e) => { setGameSlug(e.target.value); setPlatformSlug(""); setCategorySlug(""); }}
            required
            style={{ flex: 1, minWidth: "120px" }}
          >
            <option value="">Game</option>
            {games.map((g) => <option key={g.id} value={g.slug}>{g.name}</option>)}
          </select>
          <select
            className="auth-input"
            value={platformSlug}
            onChange={(e) => { setPlatformSlug(e.target.value); setCategorySlug(""); }}
            required
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
            required
            disabled={!platformSlug}
            style={{ flex: 1, minWidth: "100px" }}
          >
            <option value="">Category</option>
            {categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {/* Existing variables for this category */}
      {existingVars.length > 0 && (
        <div style={{ marginBottom: "1rem", padding: "0.75rem", background: "rgba(255,255,255,0.03)", borderRadius: "4px" }}>
          <div style={{ fontSize: "0.7rem", fontFamily: "'Cinzel', serif", letterSpacing: "0.1em", textTransform: "uppercase", color: "#555", marginBottom: "0.5rem" }}>
            Existing Variables
          </div>
          {existingVars.map((v) => (
            <div key={v.id} style={{ fontSize: "0.85rem", color: "#888", marginBottom: "0.25rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <span style={{ color: v.is_subcategory ? "var(--accent)" : "#888" }}>
                {v.is_subcategory ? "● Subcategory" : "○ Filter"}
              </span>
              <span>{v.name}</span>
              <span style={{ opacity: 0.4 }}>/{v.slug}</span>
              <span style={{ opacity: 0.4 }}>order: {v.order}</span>
            </div>
          ))}
        </div>
      )}

      {/* Variable name + slug */}
      <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
        <div style={{ flex: 2 }}>
          <label className="form-label">Variable Name</label>
          <input
            className="auth-input"
            placeholder="e.g. Players, Path, Version"
            value={varName}
            onChange={(e) => { setVarName(e.target.value); setVarSlug(slugify(e.target.value)); }}
            required
          />
        </div>
        <div style={{ flex: 1 }}>
          <label className="form-label">Slug</label>
          <input
            className="auth-input"
            placeholder="players"
            value={varSlug}
            onChange={(e) => setVarSlug(e.target.value)}
            required
          />
        </div>
        <div style={{ width: "80px" }}>
          <label className="form-label">Order</label>
          <input
            type="number"
            className="auth-input"
            min={0}
            value={order}
            onChange={(e) => setOrder(parseInt(e.target.value))}
          />
        </div>
      </div>

      {/* is_subcategory toggle */}
      <div style={{ marginBottom: "1rem", padding: "0.75rem", background: "rgba(255,255,255,0.03)", borderRadius: "4px" }}>
        <div style={{ fontSize: "0.7rem", fontFamily: "'Cinzel', serif", letterSpacing: "0.1em", textTransform: "uppercase", color: "#555", marginBottom: "0.5rem" }}>
          Variable Type
        </div>
        <div style={{ display: "flex", gap: "1rem" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: hasSubcategoryVar ? "not-allowed" : "pointer", opacity: hasSubcategoryVar ? 0.4 : 1 }}>
            <input
              type="radio"
              name="var_type"
              checked={isSubcategory}
              onChange={() => setIsSubcategory(true)}
              disabled={hasSubcategoryVar}
            />
            <span style={{ fontSize: "0.85rem" }}>
              <strong>Subcategory</strong> — renders as tabs (e.g. Clare / Leon)
            </span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
            <input
              type="radio"
              name="var_type"
              checked={!isSubcategory}
              onChange={() => setIsSubcategory(false)}
            />
            <span style={{ fontSize: "0.85rem" }}>
              <strong>Filter</strong> — renders as filter buttons (e.g. 1P / 2P)
            </span>
          </label>
        </div>
        {hasSubcategoryVar && (
          <p style={{ fontSize: "0.75rem", color: "#888", marginTop: "0.5rem", marginBottom: 0 }}>
            Subcategory slot taken by <strong>{existingVars.find(v => v.is_subcategory)?.name}</strong>. New variables will be filters.
          </p>
        )}
      </div>

      {/* Values list */}
      {values.length > 0 && (
        <div style={{ marginBottom: "0.75rem" }}>
          {values.map((v, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.3rem 0.6rem", background: "rgba(255,255,255,0.05)", borderRadius: "4px", marginBottom: "0.4rem", fontSize: "0.85rem" }}>
              <span>
                {v.name}<span style={{ opacity: 0.5, marginLeft: "0.4rem" }}>/{v.slug}</span>
                {v.is_coop && <span style={{ opacity: 0.5, marginLeft: "0.5rem" }}>· co-op {v.required_players}p</span>}
              </span>
              <button type="button" onClick={() => removeValue(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ff4444" }}>×</button>
            </div>
          ))}
        </div>
      )}

      {/* Add value */}
      <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: "4px", padding: "0.75rem", marginBottom: "1rem" }}>
        <label className="form-label" style={{ fontSize: "0.75rem", opacity: 0.6 }}>Add Value</label>
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem", flexWrap: "wrap" }}>
          <input
            className="auth-input"
            placeholder="Value name (e.g. 1 Player)"
            style={{ flex: 2, minWidth: "120px", fontSize: "0.85rem" }}
            value={valForm.name}
            onChange={(e) => setValForm({ ...valForm, name: e.target.value, slug: slugify(e.target.value) })}
          />
          <input
            className="auth-input"
            placeholder="slug"
            style={{ flex: 1, minWidth: "70px", fontSize: "0.85rem" }}
            value={valForm.slug}
            onChange={(e) => setValForm({ ...valForm, slug: e.target.value })}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
          <input
            type="checkbox"
            id="vf_coop"
            checked={valForm.is_coop}
            onChange={(e) => setValForm({ ...valForm, is_coop: e.target.checked })}
          />
          <label htmlFor="vf_coop" className="form-label" style={{ margin: 0, fontSize: "0.8rem" }}>Co-op</label>
          {valForm.is_coop && (
            <input
              type="number"
              className="auth-input"
              min={2}
              value={valForm.required_players}
              onChange={(e) => setValForm({ ...valForm, required_players: parseInt(e.target.value) })}
              style={{ width: "80px", fontSize: "0.85rem" }}
            />
          )}
        </div>
        <button
          type="button"
          className="btn"
          onClick={addValue}
          disabled={!valForm.name || !valForm.slug}
          style={{ fontSize: "0.85rem", padding: "0.4rem 0.8rem" }}
        >
          + Add Value
        </button>
      </div>

      {error && <p className="auth-error">{error}</p>}
      {success && <p className="auth-success">{success}</p>}
      <button
        className="btn btn-primary btn-full"
        type="submit"
        disabled={submitting || !categorySlug || values.length === 0}
      >
        {submitting ? "Creating..." : "Create Variable"}
      </button>
    </form>
  );
}
