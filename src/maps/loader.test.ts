import { afterEach, expect, test, vi } from "vitest";
afterEach(() => {
  document
    .querySelectorAll('script[src*="maps.googleapis.com"]')
    .forEach((script) => script.remove());
  delete window.__duskMapsReady;
  delete window.gm_authFailure;
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.resetModules();
});
test("loads Maps once with marker library and no Places or Geocoding", async () => {
  const { loadGoogleMaps } = await import("./loader");
  const sdk = { maps: { marker: { AdvancedMarkerElement: class {} } } };
  vi.stubGlobal("google", sdk);
  const first = loadGoogleMaps("test-key");
  expect(loadGoogleMaps("test-key")).toBe(first);
  const scripts = document.querySelectorAll<HTMLScriptElement>(
    'script[src*="maps.googleapis.com"]',
  );
  expect(scripts).toHaveLength(1);
  const url = new URL(scripts[0].src);
  expect(url.searchParams.get("libraries")).toBe("marker");
  window.__duskMapsReady!();
  await expect(first).resolves.toBe(sdk);
});
test("rejects stalled loads so the UI can fall back", async () => {
  vi.useFakeTimers();
  const { loadGoogleMaps } = await import("./loader");
  const result = expect(loadGoogleMaps("test-key")).rejects.toThrow(
    "could not load",
  );
  await vi.advanceTimersByTimeAsync(15000);
  await result;
});
test("rejects script network failures", async () => {
  const { loadGoogleMaps } = await import("./loader");
  const result = expect(loadGoogleMaps("test-key")).rejects.toThrow(
    "could not load",
  );
  document
    .querySelector('script[src*="maps.googleapis.com"]')!
    .dispatchEvent(new Event("error"));
  await result;
});
