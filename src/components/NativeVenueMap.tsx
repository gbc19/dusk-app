import { createElement, useEffect, useMemo, useRef, useState } from "react";
import type { City, Listing } from "../data";
import { venueMapPosition } from "../domain/catalog";
import { marketForCity } from "../domain/markets";
import { openNativeMap } from "../maps/native";

type NativeMap = NonNullable<Awaited<ReturnType<typeof openNativeMap>>>;
type MapSession = {
  native: NativeMap;
  markers: Map<string, Listing>;
  update: Promise<void>;
  close: () => void;
};
let nextMapId = 0;

export function NativeVenueMap({ city, deals, onSelect }: {
  city: City;
  deals: Listing[];
  onSelect: (listing: Listing) => void;
}) {
  const container = useRef<HTMLElement>(null);
  const session = useRef<MapSession | null>(null);
  const select = useRef(onSelect);
  select.current = onSelect;
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const pins = useMemo(() => deals.flatMap((listing) => {
    const coordinate = venueMapPosition(listing.venue);
    return coordinate ? [{ listing, coordinate }] : [];
  }), [deals]);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    let closed = false;
    let native: NativeMap | null = null;
    let current: MapSession | null = null;
    function close() {
      closed = true;
      if (session.current === current) session.current = null;
      if (native) {
        const { map } = native;
        native = null;
        void (current?.update ?? Promise.resolve()).finally(() => map.destroy()).catch(() => {});
      }
    }
    const timer = window.setTimeout(() => {
      close();
      setStatus("error");
    }, 15000);
    void (async () => {
      try {
        native = await openNativeMap(element, `dusk-venues-${++nextMapId}`, marketForCity(city).center);
        if (closed) {
          close();
          return;
        }
        if (!native) {
          setStatus("missing");
          return;
        }
        const opened: MapSession = { native, markers: new Map(), update: Promise.resolve(), close };
        current = opened;
        await native.map.setOnMarkerClickListener(({ markerId }) => {
          const listing = opened.markers.get(markerId);
          if (!closed && listing) select.current(listing);
        });
        if (closed) return;
        session.current = opened;
        setStatus("ready");
      } catch {
        if (!closed) {
          close();
          setStatus("error");
        }
      } finally {
        window.clearTimeout(timer);
      }
    })();
    return () => {
      window.clearTimeout(timer);
      close();
    };
  }, []);

  useEffect(() => {
    const current = session.current;
    if (status !== "ready" || !current) return;
    let obsolete = false;
    const { native: { map, LatLngBounds }, markers } = current;
    current.update = current.update.then(async () => {
      if (obsolete) return;
      const previous = [...markers.keys()];
      markers.clear();
      if (previous.length) await map.removeMarkers(previous);
      if (obsolete) return;
      if (pins.length) {
        const ids = await map.addMarkers(pins.map(({ coordinate, listing }) => ({
          coordinate,
          title: listing.venue.isDemo ? `${listing.venue.name} — demo location` : listing.venue.name,
        })));
        ids.forEach((id, index) => markers.set(id, pins[index].listing));
      }
      if (obsolete) return;
      if (pins.length > 1) {
        const latitudes = pins.map(({ coordinate }) => coordinate.lat);
        const longitudes = pins.map(({ coordinate }) => coordinate.lng);
        const southwest = { lat: Math.min(...latitudes), lng: Math.min(...longitudes) };
        const northeast = { lat: Math.max(...latitudes), lng: Math.max(...longitudes) };
        const bounds = new LatLngBounds({
          southwest,
          northeast,
          center: {
            lat: (southwest.lat + northeast.lat) / 2,
            lng: (southwest.lng + northeast.lng) / 2,
          },
        });
        await map.fitBounds(bounds, 48);
      } else {
        const center = pins[0]?.coordinate ?? marketForCity(city).center;
        await map.setCamera({ coordinate: center, zoom: pins.length ? 15 : 13 });
      }
    }).catch(() => {
      if (session.current === current) {
        current.close();
        setStatus("error");
      }
    });
    return () => { obsolete = true; };
  }, [city, pins, status]);

  const ready = status === "ready";
  return (
    <section className={`map-panel${ready ? " native-map-ready" : ""}`} aria-label="Venue map">
      <div className="map-info"><strong>Venue map</strong></div>
      {createElement("capacitor-google-map", {
        ref: container,
        className: "map-canvas",
        "aria-label": `${city} venue map`,
        hidden: status === "missing" || status === "error",
      })}
      <p role="status">
        {status === "missing" ? "Map unavailable: no Android Maps key is configured. Browse the venue list below."
          : status === "error" ? "Google Maps could not load. Browse the venue list below."
          : status === "loading" ? "Loading Google Maps… The venue list is available below."
          : `${pins.length} ${pins.length === 1 ? "pin" : "pins"} · Browse matching venues below.`}
      </p>
    </section>
  );
}
