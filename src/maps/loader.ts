declare global {
  interface Window {
    __duskMapsReady?: () => void;
    gm_authFailure?: () => void;
  }
}
let loading: Promise<typeof google> | undefined;
export function loadGoogleMaps(key: string): Promise<typeof google> {
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    let settled = false;
    const fail = () => {
      window.dispatchEvent(new Event("dusk-maps-error"));
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(new Error("Google Maps could not load"));
      }
    };
    const timer = window.setTimeout(fail, 15000);
    window.gm_authFailure = fail;
    window.__duskMapsReady = () => {
      if (settled) return;
      if (!window.google?.maps?.marker?.AdvancedMarkerElement) {
        fail();
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve(window.google);
    };
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&libraries=marker&callback=__duskMapsReady&loading=async`;
    script.async = true;
    script.onerror = fail;
    document.head.append(script);
  });
  return loading;
}
