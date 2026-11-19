import { useCallback, useEffect, useState } from "react";
export type Screen = "discover" | "map" | "saved";
function currentScreen(): Screen {
  const hash = window.location.hash.slice(1);
  return hash === "map" || hash === "saved" ? hash : "discover";
}
/** Native, shareable destinations without a router dependency or server rewrites. */
export function useScreen() {
  const [screen, setScreen] = useState<Screen>(currentScreen);
  useEffect(() => {
    const sync = () => setScreen(currentScreen());
    window.addEventListener("popstate", sync);
    window.addEventListener("hashchange", sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("hashchange", sync);
    };
  }, []);
  const navigate = useCallback((next: Screen) => {
    if (currentScreen() === next) {
      window.scrollTo(0, 0);
      return;
    }
    window.history.pushState(null, "", `#${next}`);
    setScreen(next);
  }, []);
  return { screen, navigate };
}
