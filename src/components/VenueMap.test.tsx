import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { App } from "../main";
import { VenueMap } from "./VenueMap";
import { deals } from "../data";
import { loadGoogleMaps } from "../maps/loader";
vi.mock("../maps/loader", () => ({ loadGoogleMaps: vi.fn() }));
let maps: FakeMap[] = [];
let markers: FakeMarker[] = [];
class FakeMap {
  setCenter = vi.fn();
  setZoom = vi.fn();
  fitBounds = vi.fn();
  panTo = vi.fn();
  constructor() {
    maps.push(this);
  }
}
class FakeMarker {
  map: unknown;
  content?: HTMLElement;
  title: string;
  position: unknown;
  constructor(options: {
    map: unknown;
    content?: HTMLElement;
    title: string;
    position: unknown;
  }) {
    Object.assign(this, options);
    this.map = options.map;
    this.title = options.title;
    this.position = options.position;
    markers.push(this);
  }
}
const active = () => markers.filter((marker) => marker.map);
beforeEach(() => {
  maps = [];
  markers = [];
  vi.stubEnv("VITE_GOOGLE_MAPS_API_KEY", "test-key");
  const sdk = {
    maps: {
      ColorScheme: { DARK: "DARK" },
      Map: FakeMap,
      LatLngBounds: class {
        extend = vi.fn();
      },
      marker: { AdvancedMarkerElement: FakeMarker },
    },
  } as unknown as typeof google;
  vi.stubGlobal("google", sdk);
  vi.mocked(loadGoogleMaps).mockResolvedValue(sdk);
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
test("markers follow city, search, category and saved filters and open the offer preview", async () => {
  render(<App />);
  fireEvent.click(screen.getByRole("link", { name: "Map" }));
  await waitFor(() => expect(active()).toHaveLength(4));
  const marker = active().find((marker) => marker.title.includes("Velvet"))!;
  expect(marker.position).toMatchObject({ lat: 39.3543, lng: -74.4335 });
  fireEvent.click(marker.content!);
  expect(screen.getByRole("dialog")).toHaveTextContent("$1 house drinks");
  expect(
    screen.getByRole("link", { name: /Directions to demo coordinates/ }),
  ).toHaveAttribute(
    "href",
    expect.stringContaining("destination=39.3543,-74.4335"),
  );
  fireEvent.click(screen.getByLabelText("Close venue details"));
  fireEvent.click(screen.getByRole("button", { name: "$1 drinks" }));
  expect(active()).toHaveLength(1);
  fireEvent.change(screen.getByLabelText("Search spots"), {
    target: { value: "missing" },
  });
  expect(active()).toHaveLength(0);
  fireEvent.change(screen.getByLabelText("Search spots"), {
    target: { value: "" },
  });
  fireEvent.click(screen.getByRole("button", { name: "All spots" }));
  fireEvent.change(screen.getByLabelText("Choose city"), {
    target: { value: "New York City" },
  });
  expect(active()).toHaveLength(2);
  expect(
    active().every((marker) => /Juniper|Night Shift/.test(marker.title)),
  ).toBe(true);
  fireEvent.click(screen.getByLabelText("Save Juniper & Co."));
  fireEvent.click(screen.getByRole("link", { name: "Saved" }));
  expect(active()).toHaveLength(0);
  fireEvent.click(screen.getByRole("link", { name: "Map" }));
  fireEvent.click(screen.getByRole("button", { name: "Saved only" }));
  expect(active()).toHaveLength(1);
  expect(active()[0].title).toContain("Juniper");
  expect(maps).toHaveLength(1);
  fireEvent.click(screen.getByRole("link", { name: "Discover" }));
  fireEvent.click(screen.getByRole("link", { name: "Map" }));
  expect(maps).toHaveLength(1);
});
test("a failed map leaves the filtered venue list usable", async () => {
  vi.mocked(loadGoogleMaps).mockRejectedValue(new Error("network failure"));
  render(<App />);
  fireEvent.click(screen.getByRole("link", { name: "Map" }));
  expect(await screen.findByText(/Google Maps could not load/)).toBeVisible();
  expect(screen.getByText("The Velvet Room")).toBeVisible();
  fireEvent.change(screen.getByLabelText("Search spots"), {
    target: { value: "Low Tide" },
  });
  expect(screen.getByText("Low Tide Beer Hall")).toBeVisible();
  expect(screen.queryByText("The Velvet Room")).not.toBeInTheDocument();
});
test("authorization failure after load shows fallback", async () => {
  render(
    <VenueMap
      city="Atlantic City"
      deals={deals.slice(0, 4)}
      onSelect={vi.fn()}
      apiKey="test-key"
    />,
  );
  await screen.findByText(/4 filtered demo venue pins/);
  act(() => window.dispatchEvent(new Event("dusk-maps-error")));
  expect(screen.getByText(/Google Maps could not load/)).toBeVisible();
  expect(active()).toHaveLength(0);
});
test("geolocation is opt-in and permission denial leaves browsing available", async () => {
  const getCurrentPosition = vi.fn(
    (_success: unknown, failure: PositionErrorCallback) =>
      failure({ code: 1, message: "Denied" } as GeolocationPositionError),
  );
  vi.stubGlobal(
    "navigator",
    Object.assign(Object.create(navigator), {
      geolocation: { getCurrentPosition },
    }),
  );
  render(
    <VenueMap
      city="Atlantic City"
      deals={deals.slice(0, 4)}
      onSelect={vi.fn()}
      apiKey="test-key"
    />,
  );
  const button = await screen.findByRole("button", { name: "Use my location" });
  expect(getCurrentPosition).not.toHaveBeenCalled();
  fireEvent.click(button);
  expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  expect(screen.getByText(/permission was declined/)).toBeVisible();
  expect(active()).toHaveLength(4);
});
test("successful geolocation centers the existing map without persisting coordinates", async () => {
  const getCurrentPosition = vi.fn((success: PositionCallback) =>
    success({
      coords: { latitude: 39.36, longitude: -74.43 },
    } as GeolocationPosition),
  );
  vi.stubGlobal(
    "navigator",
    Object.assign(Object.create(navigator), {
      geolocation: { getCurrentPosition },
    }),
  );
  render(
    <VenueMap
      city="Atlantic City"
      deals={deals.slice(0, 4)}
      onSelect={vi.fn()}
      apiKey="test-key"
    />,
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Use my location" }),
  );
  expect(maps[0].panTo).toHaveBeenCalledWith({ lat: 39.36, lng: -74.43 });
  expect(localStorage.length).toBe(0);
  expect(maps).toHaveLength(1);
});
