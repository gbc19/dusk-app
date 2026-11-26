import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "../../src/main";

const root = document.getElementById("catalog-test-root")!;
createRoot(root).render(<App publicCatalog={JSON.parse(root.dataset.catalog!)} />);
