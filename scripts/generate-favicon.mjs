import { readFile, writeFile } from "node:fs/promises";
// Package the original PNG without recoloring, cropping, tracing, or re-encoding it.
const symbol = await readFile(
  new URL("../src/assets/Dusk Minor.png", import.meta.url),
);
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 432 432"><rect width="432" height="432" fill="#000"/><image x="0" y="38" width="432" height="356" preserveAspectRatio="xMidYMid meet" href="data:image/png;base64,${symbol.toString("base64")}"/></svg>\n`;
await writeFile(new URL("../public/favicon.svg", import.meta.url), favicon);
