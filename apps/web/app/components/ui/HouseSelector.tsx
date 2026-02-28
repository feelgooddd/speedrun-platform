"use client";
import { useEffect, useState } from "react";

type House = "gryffindor" | "slytherin" | "ravenclaw" | "hufflepuff";

export const HOUSE_META: Record<House, { badge: string; tagline: string; label: string }> = {
  gryffindor: { badge: "🦁", tagline: "Where daring meets destiny", label: "Gryffindor" },
  slytherin:  { badge: "🐍", tagline: "Cunning runs in our blood",  label: "Slytherin"  },
  ravenclaw:  { badge: "🦅", tagline: "Wit sharpens every second",  label: "Ravenclaw"  },
  hufflepuff: { badge: "🦡", tagline: "Patience breaks every record", label: "Hufflepuff" },
};

export default function HouseSelector() {
  const [house, setHouse] = useState<House>("gryffindor");

  useEffect(() => {
    const saved = localStorage.getItem("house") as House;
    if (saved && HOUSE_META[saved]) setHouse(saved);
  }, []);

useEffect(() => {
  document.documentElement.setAttribute("data-house", house);
}, [house]);

  const selectHouse = (h: House) => {
    setHouse(h);
    localStorage.setItem("house", h);
  };

return (
  <>
    <div className="house-selector">
      {(Object.keys(HOUSE_META) as House[]).map((h) => (
        <button
          key={h}
          className={`house-btn ${house === h ? "active" : ""}`}
          onClick={() => selectHouse(h)}
          style={{
            borderColor: house === h ? "var(--accent)" : "transparent",
            color: house === h ? "var(--accent)" : undefined,
            background: house === h ? "var(--card-bg)" : undefined,
          }}
        >
          {HOUSE_META[h].badge} {HOUSE_META[h].label}
        </button>
      ))}
    </div>
    <p className="hero-tagline">✦ {HOUSE_META[house].tagline} ✦</p>
  </>
);
}