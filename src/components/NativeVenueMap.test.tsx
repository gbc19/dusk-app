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
