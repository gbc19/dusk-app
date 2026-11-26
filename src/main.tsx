import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
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
  deals,
  knownSavedIds,
  realVenueListings,
  type City,
  type Category,
  type Listing,
  type SavedId,
} from "./data";
import { markets, marketForCity, preferredMarket } from "./domain/markets";
import { venueDirectionsUrl } from "./domain/directions";
import { VenueMap } from "./components/VenueMap";
import { NativeVenueMap } from "./components/NativeVenueMap";
import { VenueImage } from "./components/VenueImage";
import { useScreen, type Screen } from "./navigation/useScreen";
import symbolLogo from "./assets/dusk-logo-new.png";
import "./style.css";
import { readBackendConfig } from './backend/config';
const BackendGate = import.meta.env.MODE === 'native' ? null : React.lazy(() => import('./backend/BackendGate').then(module => ({ default: module.BackendGate })));
function readSaved(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
}
export function App({ publicCatalog }: { publicCatalog?: unknown } = {}) {
  const { screen, navigate } = useScreen();
  const nativeAndroid = Capacitor.getPlatform() === "android";
  const realMode = publicCatalog !== undefined;
  const savedKey = realMode ? "dusk-saved-venues" : "dusk-saved";
  const listings = useMemo(
    () => realMode ? realVenueListings(publicCatalog) : deals,
    [publicCatalog, realMode],
  );
  const [city, setCity] = useState<City>(() => {
    try {
      return preferredMarket(localStorage.getItem("dusk-market")).city;
    } catch {
      return preferredMarket(null).city;
    }
  }),
    [category, setCategory] = useState<Category>("All spots"),
    [query, setQuery] = useState(""),
    [storedSaved, setSaved] = useState<SavedId[]>(() => {
      const raw = readSaved(savedKey);
      // Backend feeds start empty and refresh asynchronously. Do not discard saved identities while loading.
      return realMode && Array.isArray(raw) ? raw.filter((id): id is string => typeof id === 'string') : knownSavedIds(raw, listings);
    }),
    [mapSavedOnly, setMapSavedOnly] = useState(false),
    [selectedId, setSelectedId] = useState<SavedId | null>(null),
    [mapOpened, setMapOpened] = useState(screen === "map");
  const savedOnly = screen === "saved" || (screen === "map" && mapSavedOnly);
  const saved = useMemo(() => knownSavedIds(storedSaved, listings), [storedSaved, listings]);
  const selected = listings.find(({ id }) => id === selectedId);
  useEffect(() => {
    if (selectedId !== null && !listings.some(({ id }) => id === selectedId)) setSelectedId(null);
  }, [listings, selectedId]);
  function setSelected(listing: Listing | null) {
    setSelectedId(listing?.id ?? null);
  }
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
    () => filterDeals(city, category, query, savedOnly, saved, listings),
    [city, category, query, savedOnly, saved, listings],
  );
  function toggleSaved(id: SavedId) {
    setSaved((old) => {
      const next = old.includes(id)
        ? old.filter((x) => x !== id)
        : [...old, id];
      try {
        localStorage.setItem(savedKey, JSON.stringify(next));
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
  const selectedDirections = venueDirectionsUrl(selected?.venue);
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
            className="brand-symbol"
            src={symbolLogo}
            alt="DUSK sun-and-crescent symbol"
            width={1382}
            height={1138}
          />
          <span className="brand-wordmark">DUSK</span>
        </a>
        <div className="city-select">
          <MapPin size={16} />
          <select
            aria-label="Choose city"
            value={city}
            onChange={(e) => {
              const city = e.target.value as City;
              setCity(city);
              try {
                localStorage.setItem("dusk-market", marketForCity(city).id);
              } catch {
                /* Keep the selected market for this session if storage is unavailable. */
              }
              setSelected(null);
            }}
          >
            {markets.map((market) => (
              <option key={market.id} value={market.city}>{market.displayName}</option>
            ))}
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
      <main className={`app-screen-${screen}`}>
        <section className="hero" hidden={screen !== "discover" || realMode}>
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
        {screen === "discover" && !realMode && (
          <section className="mobile-intro" aria-label="DUSK deals">
            <span className="eyebrow">YOUR CITY. AFTER DARK.</span>
            <h1>
              <em>$1 Drinks.</em> Better nights.
            </h1>
          </section>
        )}
        {!realMode && (
          <div className="launch-note">
            <p>
              21+ · Fictional, non-redeemable previews.
              <span className="launch-note-approval">
                {" "}Launch pending local regulatory approval.
              </span>
            </p>
          </div>
        )}
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
                <MapPin size={15} /> {city}{" "}
                <span> / </span> {realMode ? "Verified venue discovery" : "Launch preview"}
              </span>
            </div>
          </div>
          <div className="tools">
            {!realMode && <div
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
            </div>}
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
          {nativeAndroid ? (
            screen === "map" && (
              <div className="map-slot">
                <NativeVenueMap city={city} deals={visible} onSelect={setSelected} />
              </div>
            )
          ) : mapOpened && (
            <div className="map-slot" hidden={screen !== "map"}>
              <VenueMap
                active={screen === "map"}
                preview={!realMode}
                city={city}
                deals={visible}
                onSelect={setSelected}
              />
            </div>
          )}

          <div className="cards">
            {visible.map((deal) => "offer" in deal ? (
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
                    aria-label={`${saved.includes(deal.id) ? "Unsave" : "Save"} ${deal.venue.name}`}
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
                    {deal.venue.name}
                    <ArrowUpRight size={21} />
                  </button>
                  <div className="location">
                    <MapPin size={13} />
                    {deal.venue.neighborhood} · {deal.venue.city}
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
            ) : (
              <article className="card" key={deal.id}>
                <div className="card-body">
                  <button className="card-title" onClick={() => setSelected(deal)}>
                    {deal.venue.name} <ArrowUpRight size={21} />
                  </button>
                  <div className="location"><MapPin size={13} /> {deal.venue.address}</div>
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
                    ? realMode
                      ? "Open a venue and choose Save this spot to find it here later."
                      : "Tap the bookmark on any deal to keep it here for your next night out."
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
            className="brand-symbol"
            src={symbolLogo}
            alt="DUSK sun-and-crescent symbol"
            width={1382}
            height={1138}
          />
          <span className="brand-wordmark">DUSK</span>
        </a>
        <p>Don't Waste The Night.</p>
        <small>
          {realMode
            ? "21+ · Enjoy responsibly. Verified venue discovery."
            : "21+ · Enjoy responsibly. Demo only; offers are not redeemable."}
        </small>
        <span>© 2015-2026 Dusk App LLC</span>
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
            <div className="eyebrow">
              {selected.venue.isDemo ? "FICTIONAL VENUE · LAUNCH PREVIEW" : "VENUE DETAILS"}
            </div>
            <h2 id="venue-title">{selected.venue.name}</h2>
            {"offer" in selected ? (
              <>
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
              </>
            ) : (
              <p>{selected.venue.address}</p>
            )}
            {selectedDirections ? (
              <a
                className="directions-link"
                href={selectedDirections}
                target="_blank"
                rel="noopener noreferrer"
              >
                Directions <ArrowUpRight size={16} />
              </a>
            ) : (
              <p className="directions-unavailable">
                {selected.venue.isDemo ? "Demo location — directions unavailable" : "Directions unavailable"}
              </p>
            )}
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
export function Application() {
  if (!BackendGate) return <App />;
  const native = Capacitor.isNativePlatform();
  try {
    const config = readBackendConfig(import.meta.env, native, import.meta.env.MODE === 'native-local');
    return config.mode === 'demo' ? <App /> : <React.Suspense fallback={<p role="status">Loading local backend…</p>}><BackendGate config={config} native={native}>{catalog => <App publicCatalog={catalog} />}</BackendGate></React.Suspense>;
  } catch {
    return <main className="backend-status"><h1>Backend configuration unavailable</h1><p>No listings or credentials were loaded. Correct the local configuration and restart the build.</p></main>;
  }
}
const root = document.getElementById("root");
if (root)
  createRoot(root).render(
    <React.StrictMode>
      <Application />
    </React.StrictMode>,
  );
