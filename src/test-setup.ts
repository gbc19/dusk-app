import "@testing-library/jest-dom/vitest";

import { beforeEach, vi } from "vitest";
beforeEach(() => {
  window.history.replaceState(null, "", "/");
  window.scrollTo = vi.fn();
});
