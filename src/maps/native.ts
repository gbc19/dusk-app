import { registerPlugin } from "@capacitor/core";

const configuration = registerPlugin<{
  getStatus(): Promise<{ configured: boolean }>;
}>("DuskMapsConfig");

export async function openNativeMap(element: HTMLElement, id: string) {
  if (!(await configuration.getStatus()).configured) return null;
  const { GoogleMap, LatLngBounds } = await import("@capacitor/google-maps");
  const map = await GoogleMap.create({
    id,
    element,
    // Android uses the manifest key. The shared plugin signature requires this field.
    apiKey: "",
    config: { center: { lat: 39.3643, lng: -74.4229 }, zoom: 13 },
  });
  return { map, LatLngBounds };
}
