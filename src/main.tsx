import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowUpRight,
  ArrowRight,
  Bookmark,
  MapPin,
  Search,
  SlidersHorizontal,
  X,
  Clock,
  Wine,
  Beer,
  Moon,
  Sparkles,
  Map,
} from "lucide-react";
import {
  filterDeals,
  directionsUrl,
  type City,
  type Category,
  type Deal,
} from "./data";
import { VenueMap } from "./components/VenueMap";
import { VenueImage } from "./components/VenueImage";
import { useScreen, type Screen } from "./navigation/useScreen";
import "./style.css";
function readSaved(): number[] {
  try {
    const value = JSON.parse(localStorage.getItem("dusk-saved") || "[]");
    return Array.isArray(value)
      ? value.filter((v: unknown): v is number => typeof v === "number")
      : [];
  } catch {
    return [];
  }
}
export function App() {
  const { screen, navigate } = useScreen();
  const [city, setCity] = useState<City>("Atlantic City"),
    [category, setCategory] = useState<Category>("All spots"),
    [query, setQuery] = useState(""),
    [saved, setSaved] = useState<number[]>(readSaved),
    [mapSavedOnly, setMapSavedOnly] = useState(false),
    [selected, setSelected] = useState<Deal | null>(null),
    [mapOpened, setMapOpened] = useState(screen === "map");
  const savedOnly = screen === "saved" || (screen === "map" && mapSavedOnly);
  useEffect(() => {
    if (screen === "map") setMapOpened(true);
    setSelected(null);
    window.scrollTo(0, 0);
  }, [screen]);
  useEffect(() => {
    if (!selected) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.querySelector<HTMLElement>("[role=dialog]")?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [selected?.id]);
  const visible = useMemo(
    () => filterDeals(city, category, query, savedOnly, saved),
    [city, category, query, savedOnly, saved],
  );
  function toggleSaved(id: number) {
    setSaved((old) => {
      const next = old.includes(id)
        ? old.filter((x) => x !== id)
        : [...old, id];
      try {
        localStorage.setItem("dusk-saved", JSON.stringify(next));
      } catch {
        /* Saving remains available for this session. */
      }
      return next;
    });
  }
  const categories: [Category, typeof Sparkles][] = [
    ["All spots", Sparkles],
    ["$1 drinks", Wine],
    ["Cocktails", Wine],
    ["Beer", Beer],
    ["Late night", Moon],
  ];
  return (
    <>
      <header className="header">
        <a
          className="logo"
          href="#discover"
          aria-label="Dusk home"
          onClick={(event) => {
            event.preventDefault();
            navigate("discover");
            setCategory("All spots");
            setQuery("");
          }}
        >
          <img
            src="/images/dusk-logo-placeholder.svg"
            alt="Temporary DUSK sun-and-crescent logo"
          />
          DUSK<span className="temp-label">TEMP MARK</span>
        </a>
        <div className="city-select">
          <MapPin size={16} />
          <select
            aria-label="Choose city"
            value={city}
            onChange={(e) => {
              setCity(e.target.value as City);
              setSelected(null);
            }}
          >
            <option>Atlantic City</option>
            <option>New York City</option>
          </select>
        </div>
        <span className="age">21+ ONLY</span>
      </header>
      <nav className="app-navigation" aria-label="App navigation">
        {(
          [
            ["discover", "Discover", Sparkles],
            ["map", "Map", Map],
            ["saved", "Saved", Bookmark],
          ] as const
        ).map(([destination, label, Icon]) => (
          <a
            key={destination}
            href={`#${destination}`}
            aria-label={label}
            aria-current={screen === destination ? "page" : undefined}
            onClick={(event) => {
              if (
                event.button === 0 &&
                !event.metaKey &&
                !event.ctrlKey &&
                !event.shiftKey &&
                !event.altKey
              ) {
                event.preventDefault();
                navigate(destination as Screen);
              }
            }}
          >
            <Icon size={21} aria-hidden="true" />
            <span>{label}</span>
            {destination === "saved" && saved.length > 0 && (
              <span
                className="saved-count"
                aria-label={`${saved.length} saved spots`}
              >
                {saved.length}
              </span>
            )}
          </a>
        ))}
      </nav>
      <main>
        <section className="hero" hidden={screen !== "discover"}>
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="dot" /> GOOD NIGHTS START WITH A GOOD FIND
            </div>
            <h1>
              Your night.
              <br />
              Our city.
              <br />
              <em>$1 Drinks.</em>
            </h1>
            <p>
              Discover the $1 Drinks concept and a better night out.
              <br />
              Fictional offers. Non-redeemable previews.
            </p>
            <a className="primary" href="#deals">
              $1 Drinks & more <ArrowUpRight size={20} />
            </a>
            <div className="hero-foot">
              <span className="mini-star">✳</span> Made for the nights you
              didn’t plan.
            </div>
          </div>
          <div className="hero-photo">
            <VenueImage
              src="https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1400&q=85"
              alt="Warmly lit bar with glasses hanging above the counter"
            />
            <div className="photo-shade" />
            <span className="photo-label">OUT OF OFFICE. INTO THE NIGHT.</span>
            <div className="hero-photo-bottom">
              <div>
                <span>YOUR CITY, AFTER DARK</span>
                <strong>A little less ordinary.</strong>
              </div>
              <span className="round-arrow">
                <ArrowUpRight />
              </span>
            </div>
            <div className="sticker">
              GOOD
              <br />
              NIGHTS
              <br />
              <span>AHEAD ↗</span>
            </div>
          </div>
        </section>
        {screen === "discover" && (
          <section className="mobile-intro" aria-label="DUSK deals">
            <span className="eyebrow">YOUR CITY. AFTER DARK.</span>
            <h1>
              <em>$1 Drinks.</em> Better nights.
            </h1>
          </section>
        )}
        <div className="launch-note">
          <p>
            21+ · Fictional, non-redeemable previews. Launch pending local
            regulatory approval.
          </p>
        </div>
        <section
          id="deals"
          className={`discover screen-${screen}`}
          aria-label={`${screen === "map" ? "Map" : screen === "saved" ? "Saved" : "Discover"} deals`}
        >
          <div className="section-heading">
            <div className="eyebrow">A SPOT FOR EVERY KIND OF NIGHT</div>
            <div className="heading-row">
              <h2>
                {screen === "saved"
                  ? "Saved spots"
                  : screen === "map"
                    ? "Map your night."
                    : "Find your kind of night."}
              </h2>
              <span className="city-caption">
                <MapPin size={15} /> {city} <span> / </span> Launch preview
              </span>
            </div>
          </div>
          <div className="tools">
            <div
              className="categories"
              role="group"
              aria-label="Filter by category"
            >
              {categories.map(([label, Icon]) => (
                <button
                  key={label}
                  className={category === label ? "selected" : ""}
                  aria-pressed={category === label}
                  onClick={() => setCategory(label)}
                >
                  <Icon size={16} />
                  {label}
                </button>
              ))}
            </div>
            <label className="search">
              <Search size={17} />
              <input
                aria-label="Search spots"
                placeholder="Search spots or neighborhoods"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
          </div>
          <div className="results-row">
            <span>
              {visible.length} {visible.length === 1 ? "spot" : "spots"} to
              discover <span className="muted">· Demo offers</span>
            </span>
            {screen === "map" && (
              <button
                className="map-saved-filter"
                aria-pressed={mapSavedOnly}
                onClick={() => setMapSavedOnly((value) => !value)}
              >
                <Bookmark size={16} aria-hidden="true" />
                Saved only
              </button>
            )}
          </div>
          {mapOpened && (
            <div hidden={screen !== "map"}>
              <VenueMap
                active={screen === "map"}
                city={city}
                deals={visible}
                onSelect={setSelected}
              />
            </div>
          )}

          <div className="cards">
            {visible.map((deal) => (
              <article className="card" key={deal.id}>
                <div className="card-image">
                  <VenueImage
                    key={deal.image}
                    src={`https://images.unsplash.com/${deal.image}?auto=format&fit=crop&w=700&q=80`}
                    alt={
                      deal.category === "Beer"
                        ? "A drink served at a bar"
                        : "A warmly lit nightlife setting"
                    }
                    loading="lazy"
                  />
                  <span className="demo-badge">NON-REDEEMABLE PREVIEW</span>
                  <button
                    className={`save ${saved.includes(deal.id) ? "is-saved" : ""}`}
                    aria-label={`${saved.includes(deal.id) ? "Unsave" : "Save"} ${deal.name}`}
                    aria-pressed={saved.includes(deal.id)}
                    onClick={() => toggleSaved(deal.id)}
                  >
                    <Bookmark
                      size={18}
                      fill={saved.includes(deal.id) ? "currentColor" : "none"}
                    />
                  </button>
                  <span className="offer-tag">
                    {deal.category === "$1 drinks" ? (
                      <>
                        <span className="dollar">$1</span> HOUSE DRINKS
                      </>
                    ) : (
                      deal.category.toUpperCase()
                    )}
                  </span>
                </div>
                <div className="card-body">
                  <div className="card-kicker">{deal.tag}</div>
                  <button
                    className="card-title"
                    onClick={() => setSelected(deal)}
                  >
                    {deal.name}
                    <ArrowUpRight size={21} />
                  </button>
                  <div className="location">
                    <MapPin size={13} />
                    {deal.neighborhood} · {deal.city}
                  </div>
                  <div className="card-bottom">
                    <span>
                      <Clock size={14} />
                      {deal.time}
                    </span>
                    <button onClick={() => setSelected(deal)}>
                      View spot <ArrowRight size={15} />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
          {visible.length === 0 && (
            <div className="empty">
              <SlidersHorizontal />
              <h3>
                {screen === "saved" && saved.length === 0
                  ? "No saved spots yet."
                  : "No spots here yet."}
              </h3>
              <p>
                {savedOnly
                  ? saved.length === 0
                    ? "Tap the bookmark on any deal to keep it here for your next night out."
                    : "Your saved spots may be in another city or hidden by the current filters."
                  : "Try another category or a different search."}
              </p>
              <button
                className="primary"
                onClick={() => {
                  setQuery("");
                  setCategory("All spots");
                  navigate("discover");
                }}
              >
                Back to Discover <ArrowRight size={16} />
              </button>
            </div>
          )}
        </section>
      </main>
      <footer>
        <a
          className="logo"
          href="#discover"
          onClick={(event) => {
            event.preventDefault();
            navigate("discover");
          }}
        >
          <img
            src="/images/dusk-logo-placeholder.svg"
            alt="Temporary DUSK sun-and-crescent logo"
          />
          DUSK<span className="temp-label">TEMP MARK</span>
        </a>
        <p>Good spots. Better nights.</p>
        <small>
          21+ · Enjoy responsibly. Demo only; offers are not redeemable.
        </small>
        <span>© {new Date().getFullYear()} DUSK</span>
      </footer>

      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="venue-title"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") setSelected(null);
              if (e.key === "Tab") {
                const items = Array.from(
                  e.currentTarget.querySelectorAll<HTMLElement>(
                    "button, iframe, a[href], input, select",
                  ),
                );
                const first = items[0],
                  last = items[items.length - 1];
                if (
                  e.shiftKey &&
                  (document.activeElement === first ||
                    document.activeElement === e.currentTarget)
                ) {
                  e.preventDefault();
                  last?.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                  e.preventDefault();
                  first?.focus();
                }
              }
            }}
            tabIndex={-1}
          >
            <button
              className="close"
              aria-label="Close venue details"
              onClick={() => setSelected(null)}
            >
              <X />
            </button>
            <div className="eyebrow">FICTIONAL VENUE · LAUNCH PREVIEW</div>
            <h2 id="venue-title">{selected.name}</h2>
            <p>{selected.description}</p>
            <h3>{selected.offer}</h3>
            <p>
              <Clock size={15} /> Sample hours: {selected.time}
            </p>
            <div className="detail-warning">
              Demo only. No offer can be purchased or redeemed. Any launch and
              promotion require local regulatory approval and venue
              confirmation. For adults 21+.
            </div>
            <p className="demo-coordinate-note">
              Fictional demo coordinates only — this is not a verified venue
              address.
            </p>
            <a
              className="directions-link"
              href={directionsUrl(selected)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Directions to demo coordinates <ArrowUpRight size={16} />
            </a>
            <button
              className="primary"
              onClick={() => toggleSaved(selected.id)}
            >
              {saved.includes(selected.id)
                ? "Remove from saved"
                : "Save this spot"}
              <Bookmark size={16} />
            </button>
          </section>
        </div>
      )}
    </>
  );
}
const root = document.getElementById("root");
if (root)
  createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
