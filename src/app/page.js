"use client";

import { useEffect, useState } from "react";

const WHEEL_COLORS = [
  "#f25f5c",
  "#247ba0",
  "#136f63",
  "#f3a712",
  "#8f2d56",
  "#3f88c5",
  "#70c1b3",
  "#ef476f",
  "#118ab2",
  "#ffd166",
];

const MEALS = ["lunch", "dinner"];

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
  const favoriteIndexes = header
    .map((cell, index) => {
      const normalized = cell.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (normalized === "favorites" || /^favorites[1-4]$/.test(normalized)) {
        return index;
      }
      return -1;
    })
    .filter((index) => index !== -1)
    .slice(0, 4);

  const hasHeader = nameIndex !== -1 || categoryIndex !== -1;
  const startIndex = hasHeader ? 1 : 0;
  const resolvedNameIndex = nameIndex !== -1 ? nameIndex : 0;
  const resolvedCategoryIndex = categoryIndex !== -1 ? categoryIndex : 1;

  return rows
    .slice(startIndex)
    .map((cells) => {
      const name = (cells[resolvedNameIndex] || "").trim();
      const category = (cells[resolvedCategoryIndex] || "Uncategorized").trim();
      const favorites = favoriteIndexes
        .map((index) => (cells[index] || "").trim())
        .filter((value) => value.length > 0)
        .slice(0, 4);
      return { name, category: category || "Uncategorized", favorites };
    })
    .filter((restaurant) => restaurant.name.length > 0)
    .slice(0, 15);
}

function toGoogleSheetId(input) {
  const trimmed = input.trim();
  if (!trimmed) {
    return "";
  }

  const idOnlyMatch = trimmed.match(/^[a-zA-Z0-9-_]{20,}$/);
  if (idOnlyMatch) {
    return trimmed;
  }

  const url = new URL(trimmed);
  const idMatch = url.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch) {
    throw new Error("Could not find a spreadsheet ID in that URL.");
  }

  return idMatch[1];
}

function toGoogleCsvUrl(sheetId, tabName) {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;
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
      </svg>
    </div>
  );
}

export default function HomePage() {
  const [restaurantsByMeal, setRestaurantsByMeal] = useState({
    lunch: [],
    dinner: [],
  });
  const [selectedMeal, setSelectedMeal] = useState("lunch");
  const [winnerRestaurant, setWinnerRestaurant] = useState(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);

  const hasConfiguredSheet = DEFAULT_GOOGLE_SHEET_URL.trim().length > 0;
  const restaurants = restaurantsByMeal[selectedMeal] || [];
  const canSpin = restaurants.length >= 2 && !spinning;

  async function loadFromSheet(inputValue) {
    try {
      setLoading(true);
      setStatus("");
      setWinnerRestaurant(null);

      const sheetId = toGoogleSheetId(inputValue);
      if (!sheetId) {
        throw new Error("Paste a Google Sheet URL (or sheet ID) first.");
      }

      const responses = await Promise.all(
        MEALS.map((meal) => fetch(toGoogleCsvUrl(sheetId, meal), { cache: "no-store" })),
      );

      const failedMealIndex = responses.findIndex((response) => !response.ok);
      if (failedMealIndex !== -1) {
        throw new Error(
          `Could not fetch the ${MEALS[failedMealIndex]} tab. Check sharing and tab names (lunch, dinner).`,
        );
      }

      const texts = await Promise.all(responses.map((response) => response.text()));
      const nextByMeal = {
        lunch: parseRestaurants(texts[0]),
        dinner: parseRestaurants(texts[1]),
      };

      if (nextByMeal.lunch.length < 2 || nextByMeal.dinner.length < 2) {
        throw new Error("Both tabs must have at least two restaurants.");
      }

      setRestaurantsByMeal(nextByMeal);
      setStatus(`Loaded ${nextByMeal.lunch.length} lunch and ${nextByMeal.dinner.length} dinner restaurants.`);
    } catch (error) {
      setStatus(error.message || "Could not load sheet.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!hasConfiguredSheet) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      loadFromSheet(DEFAULT_GOOGLE_SHEET_URL);
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [hasConfiguredSheet]);

  function spinWheel() {
    if (!canSpin) {
      return;
    }

    const pickIndex = Math.floor(Math.random() * restaurants.length);
    const segmentAngle = 360 / restaurants.length;
    const centerAngle = pickIndex * segmentAngle + segmentAngle / 2;
    const currentNormalized = ((rotation % 360) + 360) % 360;
    const landingOffset = ((360 - centerAngle - currentNormalized) % 360 + 360) % 360;
    const extraTurns = 360 * (5 + Math.floor(Math.random() * 3));
    const finalRotation = rotation + extraTurns + landingOffset;

    setSpinning(true);
    setWinnerRestaurant(null);
    setRotation(finalRotation);

    window.setTimeout(() => {
      setWinnerRestaurant(restaurants[pickIndex]);
      setSpinning(false);
    }, 3600);
  }

  return (
    <main className="page">
      <header className="hero">
        <p className="eyebrow">Meal Spinner</p>
        <h1>Spin For Your Next Meal</h1>

      </header>

      <section className="panel controls" aria-label="Data source">
        <div className="controls-head">
          <p className="status" aria-live="polite">
            {status || (hasConfiguredSheet
              ? `Ready. ${restaurants.length} ${selectedMeal} restaurants loaded.`
              : "Set NEXT_PUBLIC_GOOGLE_SHEET_URL in app config.")}
          </p>

          <div className="meal-toggle meal-toggle-compact" role="group" aria-label="Meal selection">
            {MEALS.map((meal) => (
              <button
                key={meal}
                type="button"
                className={`btn btn-toggle btn-toggle-compact ${selectedMeal === meal ? "is-active" : ""}`}
                onClick={() => {
                  setSelectedMeal(meal);
                  setWinnerRestaurant(null);
                }}
                disabled={loading || spinning}
              >
                {meal[0].toUpperCase() + meal.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="panel spinner" aria-label="Restaurant spinner">
        <div className="wheel-wrap">
          <div className="pointer" aria-hidden="true" />
          <div className={`wheel-shell ${spinning ? "is-spinning" : ""}`}>
            {restaurants.length > 0 ? (
              <Wheel entries={restaurants} rotation={rotation} />
            ) : (
              <div className="empty-wheel">No restaurants loaded.</div>
            )}
          </div>
          <button type="button" className="btn btn-spin center-spin" onClick={spinWheel} disabled={!canSpin}>
            {spinning ? "..." : "Spin"}
          </button>
        </div>

        <p className="winner" aria-live="polite">
          {winnerRestaurant ? (
            <>Let&rsquo;s Get: <span className="place">{winnerRestaurant.name}!</span></>
          ) : (
            ""
          )}
        </p>

        {winnerRestaurant?.favorites?.length > 0 ? (
          <div className="winner-orders" aria-live="polite">
            <p>Favorites:</p>
            <ul>
              {winnerRestaurant.favorites.map((favorite, index) => (
                <li key={`${winnerRestaurant.name}-favorite-${index}`}>{favorite}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </main>
  );
}
