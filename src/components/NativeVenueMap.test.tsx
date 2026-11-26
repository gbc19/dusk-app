import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { deals } from "../data";
import { openNativeMap } from "../maps/native";
import { NativeVenueMap } from "./NativeVenueMap";

vi.mock("../maps/native", () => ({ openNativeMap: vi.fn() }));
const open = vi.mocked(openNativeMap);
afterEach(() => {
  cleanup();
  open.mockReset();
});

test("native map falls back without a configured key or after initialization fails", async () => {
  open.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error("SDK unavailable"));
  const first = render(<NativeVenueMap city="Atlantic City" deals={[]} onSelect={vi.fn()} />);
  expect(await screen.findByText(/no Android Maps key/)).toBeVisible();
  first.unmount();
  render(<NativeVenueMap city="Atlantic City" deals={[]} onSelect={vi.fn()} />);
  expect(await screen.findByText(/Google Maps could not load.*venue list/)).toBeVisible();
});

test("native markers use filtered venue coordinates and open the original listing", async () => {
  const map = {
    setOnMarkerClickListener: vi.fn(),
    addMarkers: vi.fn().mockResolvedValueOnce(["first", "second"]).mockResolvedValueOnce(["next"]),
    removeMarkers: vi.fn(),
    fitBounds: vi.fn(),
    setCamera: vi.fn(),
    destroy: vi.fn(),
  };
  open.mockResolvedValue({ map, LatLngBounds: class {} } as unknown as NonNullable<Awaited<ReturnType<typeof openNativeMap>>>);
  const select = vi.fn();
  const view = render(<NativeVenueMap city="Atlantic City" deals={deals.slice(0, 2)} onSelect={select} />);
  await waitFor(() => expect(map.fitBounds).toHaveBeenCalled());
  expect(map.addMarkers).toHaveBeenCalledWith([
    expect.objectContaining({ coordinate: deals[0].venue.demoLocation }),
    expect.objectContaining({ coordinate: deals[1].venue.demoLocation }),
  ]);
  const tap = map.setOnMarkerClickListener.mock.calls[0][0];
  tap({ markerId: "first" });
  expect(select).toHaveBeenCalledWith(deals[0]);
  view.rerender(<NativeVenueMap city="Atlantic City" deals={[deals[1]]} onSelect={select} />);
  await waitFor(() => expect(map.setCamera).toHaveBeenCalled());
  expect(map.removeMarkers).toHaveBeenCalledWith(["first", "second"]);
  tap({ markerId: "next" });
  expect(select).toHaveBeenLastCalledWith(deals[1]);
  view.unmount();
  await waitFor(() => expect(map.destroy).toHaveBeenCalledTimes(1));
});


test("native Vegas map uses shared centers and original listings throughout market changes", async () => {
  const vegas = deals.filter((deal) => deal.venue.city === "Las Vegas");
  const map = {
    setOnMarkerClickListener: vi.fn(),
    addMarkers: vi.fn().mockImplementation(async (markers: unknown[]) => markers.map((_, index) => String(index))),
    removeMarkers: vi.fn(), fitBounds: vi.fn(), setCamera: vi.fn(), destroy: vi.fn(),
  };
  open.mockResolvedValue({ map, LatLngBounds: class {} } as unknown as NonNullable<Awaited<ReturnType<typeof openNativeMap>>>);
  const select = vi.fn();
  const view = render(<NativeVenueMap city="Las Vegas" deals={vegas} onSelect={select} />);
  await waitFor(() => expect(map.addMarkers).toHaveBeenCalled());
  expect(open).toHaveBeenCalledWith(expect.any(HTMLElement), expect.any(String), { lat: 36.145, lng: -115.156 });
  expect(map.addMarkers.mock.calls[0][0].map((marker: { coordinate: unknown }) => marker.coordinate))
    .toEqual(vegas.map((deal) => deal.venue.demoLocation));
  map.setOnMarkerClickListener.mock.calls[0][0]({ markerId: "0" });
  expect(select).toHaveBeenLastCalledWith(vegas[0]);
  for (const [city, center] of [
    ["Atlantic City", { lat: 39.3643, lng: -74.4229 }],
    ["New York City", { lat: 40.725, lng: -73.975 }],
    ["Las Vegas", { lat: 36.145, lng: -115.156 }],
  ] as const) {
    view.rerender(<NativeVenueMap city={city} deals={[]} onSelect={select} />);
    await waitFor(() => expect(map.setCamera).toHaveBeenLastCalledWith({ coordinate: center, zoom: 13 }));
  }
  expect(open).toHaveBeenCalledTimes(1);
});
