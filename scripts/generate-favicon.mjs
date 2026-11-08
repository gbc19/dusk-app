import { readFile, writeFile } from "node:fs/promises";
// Preserve the transparent source PNG byte-for-byte, with no recoloring or redraw.
const symbol = await readFile(
  new URL("../src/assets/dusk-logo-new.png", import.meta.url),
);
const width = symbol.readUInt32BE(16);
const height = symbol.readUInt32BE(20);
const side = Math.max(width, height);
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${side} ${side}"><image x="${(side - width) / 2}" y="${(side - height) / 2}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet" href="data:image/png;base64,${symbol.toString("base64")}"/></svg>\n`;
await writeFile(new URL("../public/favicon.svg", import.meta.url), favicon);
