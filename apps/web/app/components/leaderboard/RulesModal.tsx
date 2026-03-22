"use client";
import { useState, useEffect } from "react";
import "../../styles/rules-modal.css";

interface Category {
  id: string;
  name: string;
  slug: string;
  category_type?: string;
  rules?: string | null;
}

interface LevelCategory {
  id: string;
  name: string;
  slug: string;
}

interface Level {
  id: string;
  name: string;
  slug: string;
  order: number;
  level_rules?: string | null;
  level_categories: LevelCategory[];
}

interface ILRulesData {
  category_rules: string | null;
  levels: {
    level_slug: string;
    level_rules: string | null;
  }[];
}

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameSlug: string;
  platformSlug: string;
  platformName: string;
  gameName: string;
  categories: Category[];
  extensionCategories: Category[];
  platformRules: string | null;
  initialTab?: "fullgame" | "il" | "extension";
  initialCategory?: string | null;
}

type NavSelection =
  | { type: "platform" }
  | { type: "fullgame"; categorySlug: string }
  | { type: "il"; categorySlug: string; levelSlug: string }
  | { type: "extension"; categorySlug: string };

export default function RulesModal({
  isOpen,
  onClose,
  gameSlug,
  platformSlug,
  platformName,
  gameName,
  categories,
  extensionCategories,
  platformRules,
  initialTab = "fullgame",
  initialCategory,
}: RulesModalProps) {
  const [levels, setLevels] = useState<Level[]>([]);
  const [loadingLevels, setLoadingLevels] = useState(false);
  const [ilRulesCache, setIlRulesCache] = useState<Record<string, ILRulesData>>({});
  const [loadingILRules, setLoadingILRules] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["fullgame"]),
  );
  const [selected, setSelected] = useState<NavSelection>(() => {
    if (initialCategory && initialTab !== "il") {
      return {
        type: initialTab === "extension" ? "extension" : "fullgame",
        categorySlug: initialCategory,
      };
    }
    return { type: "platform" };
  });

  // Fetch levels when modal opens
  useEffect(() => {
    if (!isOpen || levels.length > 0) return;
    setLoadingLevels(true);
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/games/${gameSlug}/${platformSlug}/levels`)
      .then((r) => r.json())
      .then((data) => setLevels(data.levels ?? []))
      .catch(console.error)
      .finally(() => setLoadingLevels(false));
  }, [isOpen, gameSlug, platformSlug]);

  // Fetch IL rules when an IL category is expanded
  const fetchILRules = async (categorySlug: string) => {
    if (ilRulesCache[categorySlug]) return;
    setLoadingILRules(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/games/${gameSlug}/${platformSlug}/levels/${categorySlug}?page=1&limit=1`
      );
      const data = await res.json();
      setIlRulesCache((prev) => ({
        ...prev,
        [categorySlug]: {
          category_rules: data.category_rules ?? null,
          levels: (data.levels ?? []).map((l: any) => ({
            level_slug: l.level_slug,
            level_rules: l.level_rules ?? null,
          })),
        },
      }));
    } catch (e) {
      console.error("Failed to fetch IL rules:", e);
    } finally {
      setLoadingILRules(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      document.body.classList.add("rules-modal-open");
    } else {
      document.body.classList.remove("rules-modal-open");
    }
    return () => document.body.classList.remove("rules-modal-open");
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (initialCategory && initialTab !== "il") {
      const type = initialTab === "extension" ? "extension" : "fullgame";
      setSelected({ type, categorySlug: initialCategory });
      setExpandedSections(new Set([type]));
    } else {
      setSelected({ type: "platform" });
    }
  }, [isOpen, initialTab, initialCategory]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const toggleILCategory = (categorySlug: string) => {
    toggleSection(`il-cat-${categorySlug}`);
    fetchILRules(categorySlug);
  };

  // Get unique IL categories from levels
  const ilCategories = (() => {
    const seen = new Set<string>();
    const result: LevelCategory[] = [];
    for (const level of levels) {
      for (const cat of level.level_categories) {
        if (!seen.has(cat.slug)) {
          seen.add(cat.slug);
          result.push(cat);
        }
      }
    }
    return result;
  })();

  // Resolve what to display in the content pane
  const getContent = (): { title: string; rules: string | null } => {
    if (selected.type === "platform") {
      return { title: "Platform Rules", rules: platformRules };
    }

if (selected.type === "fullgame") {
  const cat = categories.find((c) => c.slug === selected.categorySlug);
  return {
    title: cat?.name ?? selected.categorySlug,
    rules: cat?.rules ?? null,
  };
}

if (selected.type === "extension") {
  const cat = extensionCategories.find((c) => c.slug === selected.categorySlug);
  return {
    title: cat?.name ?? selected.categorySlug,
    rules: cat?.rules ?? null,
  };
}

    if (selected.type === "il") {
      const ilData = ilRulesCache[selected.categorySlug];
      const levelData = ilData?.levels.find((l) => l.level_slug === selected.levelSlug);
      const level = levels.find((l) => l.slug === selected.levelSlug);
      const catName = ilCategories.find((c) => c.slug === selected.categorySlug)?.name ?? selected.categorySlug;

      return {
        title: `${catName} — ${level?.name ?? selected.levelSlug}`,
        rules: [ilData?.category_rules, levelData?.level_rules]
          .filter(Boolean)
          .join("\n\n") || null,
      };
    }

    return { title: "", rules: null };
  };

  const { title, rules } = getContent();

  if (!isOpen) return null;

  return (
    <div className="rules-modal-overlay" onClick={onClose}>
      <div
        className="rules-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Rules"
      >
        {/* Header */}
        <div className="rules-modal-header">
          <div>
            <div className="rules-modal-game">{gameName}</div>
            <div className="rules-modal-platform">{platformName} Rules</div>
          </div>
          <button
            className="rules-modal-close"
            onClick={onClose}
            aria-label="Close rules"
          >
            ✕
          </button>
        </div>

        <div className="rules-modal-body">
          {/* Left Nav */}
          <nav className="rules-nav">
            {/* Platform Rules */}
            <button
              className={`rules-nav-item rules-nav-top ${selected.type === "platform" ? "active" : ""}`}
              onClick={() => setSelected({ type: "platform" })}
            >
              Platform Rules
            </button>

            {/* Full Game */}
            {categories.length > 0 && (
              <div className="rules-nav-section">
                <button
                  className="rules-nav-section-header"
                  onClick={() => toggleSection("fullgame")}
                >
                  <span>Full Game</span>
                  <span className="rules-nav-chevron">
                    {expandedSections.has("fullgame") ? "▾" : "▸"}
                  </span>
                </button>
                {expandedSections.has("fullgame") && (
                  <div className="rules-nav-children">
                    {categories.map((cat) => (
                      <button
                        key={cat.id}
                        className={`rules-nav-item ${
                          selected.type === "fullgame" && selected.categorySlug === cat.slug ? "active" : ""
                        }`}
                        onClick={() => setSelected({ type: "fullgame", categorySlug: cat.slug })}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Individual Levels */}
            <div className="rules-nav-section">
              <button
                className="rules-nav-section-header"
                onClick={() => toggleSection("il")}
              >
                <span>Individual Levels</span>
                <span className="rules-nav-chevron">
                  {expandedSections.has("il") ? "▾" : "▸"}
                </span>
              </button>
              {expandedSections.has("il") && (
                <div className="rules-nav-children">
                  {loadingLevels ? (
                    <span className="rules-nav-loading">Loading...</span>
                  ) : ilCategories.length === 0 ? (
                    <span className="rules-nav-loading">No IL categories</span>
                  ) : (
                    ilCategories.map((cat) => {
                      const catLevels = levels.filter((l) =>
                        l.level_categories.some((lc) => lc.slug === cat.slug)
                      );
                      const isExpanded = expandedSections.has(`il-cat-${cat.slug}`);
                      return (
                        <div key={cat.id}>
                          <button
                            className={`rules-nav-item ${isExpanded ? "active" : ""}`}
                            onClick={() => toggleILCategory(cat.slug)}
                            style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
                          >
                            <span>{cat.name}</span>
                            <span className="rules-nav-chevron">
                              {isExpanded ? "▾" : "▸"}
                            </span>
                          </button>
                          {isExpanded && (
                            <div className="rules-nav-children">
                              {catLevels.map((level) => (
                                <button
                                  key={level.id}
                                  className={`rules-nav-item rules-nav-item-deep ${
                                    selected.type === "il" &&
                                    selected.categorySlug === cat.slug &&
                                    selected.levelSlug === level.slug
                                      ? "active"
                                      : ""
                                  }`}
                                  onClick={() =>
                                    setSelected({
                                      type: "il",
                                      categorySlug: cat.slug,
                                      levelSlug: level.slug,
                                    })
                                  }
                                >
                                  {level.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* Category Extensions */}
            {extensionCategories.length > 0 && (
              <div className="rules-nav-section">
                <button
                  className="rules-nav-section-header"
                  onClick={() => toggleSection("extension")}
                >
                  <span>Category Extensions</span>
                  <span className="rules-nav-chevron">
                    {expandedSections.has("extension") ? "▾" : "▸"}
                  </span>
                </button>
                {expandedSections.has("extension") && (
                  <div className="rules-nav-children">
                    {extensionCategories.map((cat) => (
                      <button
                        key={cat.id}
                        className={`rules-nav-item ${
                          selected.type === "extension" && selected.categorySlug === cat.slug ? "active" : ""
                        }`}
                        onClick={() => setSelected({ type: "extension", categorySlug: cat.slug })}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </nav>

          {/* Rules Content */}
          <div className="rules-content">
            <h2 className="rules-content-title">{title}</h2>
            <div className="rules-content-divider" />
            {loadingILRules && selected.type === "il" ? (
              <p className="rules-content-text">Loading...</p>
            ) : rules ? (
              <p className="rules-content-text">{rules}</p>
            ) : (
              <p className="rules-content-text" style={{ opacity: 0.5 }}>
                No rules have been set for this category yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}