"use client";

import { useMemo, useState } from "react";

const WHEEL_COLORS = [
  "#f25f5c",
  "#247ba0",
  "#70c1b3",
  "#f3a712",
  "#8f2d56",
  "#3f88c5",
  "#136f63",
  "#ef476f",
  "#118ab2",
  "#ffd166",
];

const SAMPLE_RESTAURANTS = [
  { name: "Green Bowl", category: "Healthy" },
  { name: "Mama Roma", category: "Italian" },
  { name: "Burger Drop", category: "Fast Food" },
  { name: "Taco Harbor", category: "Mexican" },
  { name: "Noodle Nest", category: "Asian" },
  { name: "Sunrise Diner", category: "Breakfast" },
  { name: "Spice Route", category: "Indian" },
  { name: "Ocean Grill", category: "Seafood" },
];

const DEFAULT_GOOGLE_SHEET_URL = process.env.NEXT_PUBLIC_GOOGLE_SHEET_URL || "";

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        value += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(value.trim());
      value = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        i += 1;
      }
      row.push(value.trim());
      if (row.some((cell) => cell.length > 0)) {
        rows.push(row);
      }
      row = [];
      value = "";
      continue;
    }

    value += char;
  }

  if (value.length > 0 || row.length > 0) {
    row.push(value.trim());
    if (row.some((cell) => cell.length > 0)) {
      rows.push(row);
    }
  }

  return rows;
}

function parseRestaurants(csvText) {
  const rows = parseCsv(csvText);
  if (!rows.length) {
    return [];
  }

  const header = rows[0].map((cell) => cell.toLowerCase().trim());
  const nameIndex = header.findIndex((cell) =>
    ["restaurant", "restaurants", "name", "place"].includes(cell),
  );
  const categoryIndex = header.findIndex((cell) =>
    ["category", "type", "cuisine"].includes(cell),
  );

  const hasHeader = nameIndex !== -1 || categoryIndex !== -1;
  const startIndex = hasHeader ? 1 : 0;
  const resolvedNameIndex = nameIndex !== -1 ? nameIndex : 0;
  const resolvedCategoryIndex = categoryIndex !== -1 ? categoryIndex : 1;

  return rows
    .slice(startIndex)
    .map((cells) => {
      const name = (cells[resolvedNameIndex] || "").trim();
      const category = (cells[resolvedCategoryIndex] || "Uncategorized").trim();
      return { name, category: category || "Uncategorized" };
    })
    .filter((restaurant) => restaurant.name.length > 0)
    .slice(0, 15);
}

function toGoogleCsvUrl(input) {
  const trimmed = input.trim();
  if (!trimmed) {
    return "";
  }

  if (trimmed.includes("tqx=out:csv")) {
    return trimmed;
  }

  const idOnlyMatch = trimmed.match(/^[a-zA-Z0-9-_]{20,}$/);
  if (idOnlyMatch) {
    return `https://docs.google.com/spreadsheets/d/${trimmed}/gviz/tq?tqx=out:csv&gid=0`;
  }

  const url = new URL(trimmed);
  const idMatch = url.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch) {
    throw new Error("Could not find a spreadsheet ID in that URL.");
  }

  const gid = url.searchParams.get("gid") || "0";
  return `https://docs.google.com/spreadsheets/d/${idMatch[1]}/gviz/tq?tqx=out:csv&gid=${gid}`;
}

function toPoint(cx, cy, radius, angleFromTopDeg) {
  const rad = (angleFromTopDeg * Math.PI) / 180;
  return {
    x: cx + radius * Math.sin(rad),
    y: cy - radius * Math.cos(rad),
  };
}

function Wheel({ entries, rotation }) {
  const segmentAngle = 360 / entries.length;

  return (
    <div className="wheel-rotor" style={{ transform: `rotate(${rotation}deg)` }}>
      <svg viewBox="0 0 100 100" className="wheel-svg" aria-hidden="true">
        <g>
          {entries.map((entry, index) => {
            const start = index * segmentAngle;
            const end = start + segmentAngle;
            const p1 = toPoint(50, 50, 47, start);
            const p2 = toPoint(50, 50, 47, end);
            const largeArcFlag = segmentAngle > 180 ? 1 : 0;
            const path = `M 50 50 L ${p1.x} ${p1.y} A 47 47 0 ${largeArcFlag} 1 ${p2.x} ${p2.y} Z`;

            const labelAngle = start + segmentAngle / 2;
            const labelPoint = toPoint(50, 50, 31, labelAngle);
            const label = entry.name.length > 14 ? `${entry.name.slice(0, 12)}...` : entry.name;

            return (
              <g key={`${entry.name}-${index}`}>
                <path d={path} fill={WHEEL_COLORS[index % WHEEL_COLORS.length]} stroke="#ffffff" strokeWidth="0.6" />
                <text
                  x={labelPoint.x}
                  y={labelPoint.y}
                  className="wheel-label"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  transform={`rotate(${labelAngle} ${labelPoint.x} ${labelPoint.y})`}
                >
                  {label}
                </text>
              </g>
            );
          })}
        </g>
        <circle cx="50" cy="50" r="7" fill="#10131a" />
      </svg>
    </div>
  );
}

export default function HomePage() {
  const [sheetUrlInput, setSheetUrlInput] = useState(DEFAULT_GOOGLE_SHEET_URL);
  const [restaurants, setRestaurants] = useState(SAMPLE_RESTAURANTS);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [winner, setWinner] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);

  const categories = useMemo(() => {
    const unique = new Set(restaurants.map((item) => item.category));
    return ["All", ...Array.from(unique)];
  }, [restaurants]);

  const filtered = useMemo(() => {
    if (selectedCategory === "All") {
      return restaurants;
    }
    return restaurants.filter((item) => item.category === selectedCategory);
  }, [restaurants, selectedCategory]);

  const canSpin = filtered.length >= 2 && !spinning;

  async function loadFromSheet() {
    try {
      setLoading(true);
      setStatus("");
      setWinner("");

      const csvUrl = toGoogleCsvUrl(sheetUrlInput);
      if (!csvUrl) {
        throw new Error("Paste a Google Sheet URL (or sheet ID) first.");
      }

      const response = await fetch(csvUrl, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Could not fetch spreadsheet. Check sharing and publish settings.");
      }

      const text = await response.text();
      const parsed = parseRestaurants(text);

      if (parsed.length < 2) {
        throw new Error("Need at least two restaurants in the sheet.");
      }

      setRestaurants(parsed);
      setSelectedCategory("All");
      setStatus(`Loaded ${parsed.length} restaurants.`);
    } catch (error) {
      setStatus(error.message || "Could not load sheet.");
    } finally {
      setLoading(false);
    }
  }

  function useSampleData() {
    setRestaurants(SAMPLE_RESTAURANTS);
    setSelectedCategory("All");
    setWinner("");
    setStatus("Loaded sample data.");
  }

  function spinWheel() {
    if (!canSpin) {
      return;
    }

    const pickIndex = Math.floor(Math.random() * filtered.length);
    const segmentAngle = 360 / filtered.length;
    const centerAngle = pickIndex * segmentAngle + segmentAngle / 2;
    const currentNormalized = ((rotation % 360) + 360) % 360;
    const landingOffset = ((360 - centerAngle - currentNormalized) % 360 + 360) % 360;
    const extraTurns = 360 * (5 + Math.floor(Math.random() * 3));
    const finalRotation = rotation + extraTurns + landingOffset;

    setSpinning(true);
    setWinner("");
    setRotation(finalRotation);

    window.setTimeout(() => {
      setWinner(filtered[pickIndex].name);
      setSpinning(false);
    }, 3600);
  }

  return (
    <main className="page">
      <header className="hero">
        <p className="eyebrow">Foodspinner</p>
        <h1>Spin For Your Next Meal</h1>
        <p className="subtitle">
          Load restaurants from a Google Sheet, filter by category, then spin the wheel.
        </p>
      </header>

      <section className="panel controls" aria-label="Data source and filters">
        <label htmlFor="sheet-url" className="field-label">
          Google Sheet URL or Sheet ID
        </label>
        <div className="row">
          <input
            id="sheet-url"
            type="text"
            className="text-input"
            placeholder="https://docs.google.com/spreadsheets/d/..."
            value={sheetUrlInput}
            onChange={(event) => setSheetUrlInput(event.target.value)}
          />
        </div>
        <div className="row actions">
          <button type="button" className="btn btn-primary" onClick={loadFromSheet} disabled={loading}>
            {loading ? "Loading..." : "Load Sheet"}
          </button>
          <button type="button" className="btn btn-ghost" onClick={useSampleData} disabled={loading}>
            Use Sample Data
          </button>
        </div>

        <div className="row split">
          <label htmlFor="category" className="field-label">
            Category
          </label>
          <select
            id="category"
            className="select"
            value={selectedCategory}
            onChange={(event) => setSelectedCategory(event.target.value)}
          >
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>

        <p className="status" aria-live="polite">
          {status || `Ready. ${restaurants.length} restaurants loaded.`}
        </p>
      </section>

      <section className="panel spinner" aria-label="Restaurant spinner">
        <div className="wheel-wrap">
          <div className="pointer" aria-hidden="true" />
          <div className={`wheel-shell ${spinning ? "is-spinning" : ""}`}>
            {filtered.length > 0 ? (
              <Wheel entries={filtered} rotation={rotation} />
            ) : (
              <div className="empty-wheel">No restaurants in this category.</div>
            )}
          </div>
        </div>

        <button type="button" className="btn btn-spin" onClick={spinWheel} disabled={!canSpin}>
          {spinning ? "Spinning..." : "Spin"}
        </button>

        <p className="winner" aria-live="polite">
          {winner ? `Tonight: ${winner}` : "Spin to pick a restaurant."}
        </p>
      </section>

      <section className="panel list" aria-label="Restaurant list">
        <h2>Restaurants on Wheel ({filtered.length})</h2>
        <ul>
          {filtered.map((item, index) => (
            <li key={`${item.name}-${index}`}>
              <span>{item.name}</span>
              <span>{item.category}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
