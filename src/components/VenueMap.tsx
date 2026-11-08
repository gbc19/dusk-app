import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { venues, type City, type Deal } from "../data";
import { loadGoogleMaps } from "../maps/loader";

export function VenueMap({
  city,
  deals,
  onSelect,
  active = true,
  apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
}: {
  city: City;
  deals: Deal[];
  onSelect: (deal: Deal) => void;
  apiKey?: string;
  active?: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    apiKey ? "loading" : "error",
  );
  const [locationStatus, setLocationStatus] = useState("");
  const [userPosition, setUserPosition] =
    useState<google.maps.LatLngLiteral | null>(null);
  useEffect(() => {
    if (!apiKey) return;
    let cancelled = false;
    const fail = () => {
      if (!cancelled) {
        setStatus("error");
        mapRef.current = null;
      }
    };
    window.addEventListener("dusk-maps-error", fail);
    setStatus("loading");
    loadGoogleMaps(apiKey)
      .then((sdk) => {
        if (cancelled || !container.current) return;
        mapRef.current = new sdk.maps.Map(container.current, {
          center: { lat: 39.3643, lng: -74.4229 },
          zoom: 13,
          colorScheme: sdk.maps.ColorScheme.DARK,
          mapId: "DEMO_MAP_ID",
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: true,
        });
        setStatus("ready");
      })
      .catch(fail);
    return () => {
      cancelled = true;
      window.removeEventListener("dusk-maps-error", fail);
      mapRef.current = null;
    };
  }, [apiKey]);
  useEffect(() => {
    if (!active || status !== "ready" || !mapRef.current) return;
    const map = mapRef.current;
    const markers: google.maps.marker.AdvancedMarkerElement[] = [];
    const bounds = new google.maps.LatLngBounds();
    for (const deal of deals) {
      const venue = venues.find((v) => v.id === deal.venueId)!;
      const position = {
        lat: venue.demoLocation.lat,
        lng: venue.demoLocation.lng,
      };
      const button = document.createElement("button");
      button.type = "button";
      button.className = "venue-marker";
      button.textContent = deal.category === "$1 drinks" ? "$1" : "●";
      button.setAttribute(
        "aria-label",
        `${deal.name}: ${deal.offer}. Demo coordinates. Open venue preview`,
      );
      button.addEventListener("click", () => selectRef.current(deal));
      markers.push(
        new google.maps.marker.AdvancedMarkerElement({
          map,
          position,
          content: button,
          title: `${deal.name} — demo location`,
        }),
      );
      bounds.extend(position);
    }
    if (deals.length === 1) {
      const { lat, lng } = venues.find(
        (v) => v.id === deals[0].venueId,
      )!.demoLocation;
      map.setCenter({ lat, lng });
      map.setZoom(15);
    } else if (deals.length > 1) {
      map.fitBounds(bounds, 60);
    } else {
      map.setCenter(
        city === "Atlantic City"
          ? { lat: 39.3643, lng: -74.4229 }
          : { lat: 40.725, lng: -73.975 },
      );
      map.setZoom(13);
    }
    return () => {
      markers.forEach((marker) => {
        marker.map = null;
      });
    };
  }, [city, deals, status, active]);
  useEffect(() => {
    if (!userPosition || status !== "ready" || !mapRef.current) return;
    const marker = new google.maps.marker.AdvancedMarkerElement({
      map: mapRef.current,
      position: userPosition,
      title: "Your approximate location",
    });
    mapRef.current.panTo(userPosition);
    return () => {
      marker.map = null;
    };
  }, [userPosition, status]);
  function locate() {
    if (!navigator.geolocation) {
      setLocationStatus(
        "Location is unavailable in this browser. You can still browse every spot.",
      );
      return;
    }
    setLocationStatus("Waiting for your browser’s location permission…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserPosition({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocationStatus(
          "Approximate location shown for this session. Your location is not saved.",
        );
      },
      () =>
        setLocationStatus(
          "Location was not available or permission was declined. Browse using the market selector.",
        ),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }
  return (
    <section className="map-panel" aria-label="Venue map">
      <div className="map-info">
        <div>
          <strong>Demo venue map</strong>
          <p>
            All pins use fictional demo coordinates — not verified venue
            addresses. Select a pin or a venue below for its offer.
          </p>
        </div>
      </div>
      <div
        className="map-canvas"
        ref={container}
        aria-label={`${city} venue map`}
        hidden={status === "error"}
      />
      <p role="status">
        {!apiKey
          ? "Map unavailable: no Google Maps key is configured. Browse the venue list below."
          : status === "error"
            ? "Google Maps could not load. Browse the venue list below."
            : status === "loading"
              ? "Loading Google Maps… The venue list is available below."
              : `${deals.length} filtered demo venue pins. The same venues appear in the list below.`}
      </p>
      {status === "ready" && (
        <div className="geolocation">
          <button onClick={locate}>
            <MapPin size={15} /> Use my location
          </button>
          <p>
            Your browser will ask permission. Location is optional, used only in
            this session, and sent to Google Maps to center the map.
          </p>
        </div>
      )}
      {locationStatus && <p role="status">{locationStatus}</p>}
    </section>
  );
}
