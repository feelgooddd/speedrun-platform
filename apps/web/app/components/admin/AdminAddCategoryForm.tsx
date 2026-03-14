"use client";
import { useState } from "react";

interface Platform {
  id: string;
  name: string;
  slug: string;
  timing_method: string;
}

interface Game {
  id: string;
  slug: string;
  name: string;
  platforms: Platform[];
}

interface AdminAddCategoryFormProps {
  games: Game[];
  token: string | null;
}

function slugify(str: string) {
  return str
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export default function AdminAddCategoryForm({
  games,
  token,
}: AdminAddCategoryFormProps) {
  const [form, setForm] = useState({
    game_slug: "",
    platform_slug: "",
    name: "",
    category_slug: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const selectedPlatforms =
    games.find((g) => g.slug === form.game_slug)?.platforms || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/games/${form.game_slug}/${form.platform_slug}/categories`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: form.name,
            category_slug: form.category_slug,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create category");
      setSuccess(`"${data.category.name}" created successfully.`);
      setForm({ game_slug: "", platform_slug: "", name: "", category_slug: "" });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label className="form-label">Game & Platform</label>
        <div className="admin-category-selects">
          <select
            className="auth-input"
            value={form.game_slug}
            onChange={(e) =>
              setForm({ ...form, game_slug: e.target.value, platform_slug: "" })
            }
            required
          >
            <option value="">Select Game</option>
            {games.map((g) => (
              <option key={g.id} value={g.slug}>
                {g.name}
              </option>
            ))}
          </select>
          <select
            className="auth-input"
            value={form.platform_slug}
            onChange={(e) =>
              setForm({ ...form, platform_slug: e.target.value })
            }
            required
            disabled={!form.game_slug}
          >
            <option value="">Select Platform</option>
            {selectedPlatforms.map((p) => (
              <option key={p.id} value={p.slug}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="admin-category-name-row">
        <div className="admin-category-name-field">
          <label className="form-label">Category Name</label>
          <input
            className="auth-input"
            placeholder="e.g. Any%, 100%"
            value={form.name}
            onChange={(e) =>
              setForm({
                ...form,
                name: e.target.value,
                category_slug: slugify(e.target.value),
              })
            }
            required
          />
        </div>
        <div className="admin-category-slug-field">
          <label className="form-label">Slug</label>
          <input
            className="auth-input"
            placeholder="any"
            value={form.category_slug}
            onChange={(e) =>
              setForm({ ...form, category_slug: e.target.value })
            }
            required
          />
        </div>
      </div>
      {error && <p className="auth-error">{error}</p>}
      {success && <p className="auth-success">{success}</p>}
      <button
        className="btn btn-primary btn-full"
        type="submit"
        disabled={submitting}
      >
        {submitting ? "Creating..." : "Create Category"}
      </button>
    </form>
  );
}