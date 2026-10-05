import { readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const asset = async (filename, mime) =>
  `data:${mime};base64,${(await readFile(new URL(`public/assets/${filename}`, root))).toString("base64")}`;

let html = await readFile(new URL("dist/index.html", root), "utf8");
const scriptPath = html.match(/<script[^>]+src="([^"]+)"[^>]*><\/script>/)?.[1];
const stylePath = html.match(/<link[^>]+href="([^"]+\.css)"[^>]*>/)?.[1];
if (!scriptPath || !stylePath) throw new Error("Build output is missing JS or CSS");

let script = await readFile(new URL(`dist${scriptPath}`, root), "utf8");
let style = await readFile(new URL(`dist${stylePath}`, root), "utf8");
for (const name of ["balloon-blue.png", "balloon-purple.png", "balloon-white.png", "corner-bubble.png"]) {
  script = script.replaceAll(`/assets/${name}`, await asset(name, "image/png"));
}

html = html.replace(/<script[^>]+src="[^"]+"[^>]*><\/script>/, () => `<script type="module">${script.replaceAll("</script", "<\\/script")}</script>`);
html = html.replace(/<link[^>]+href="[^"]+\.css"[^>]*>/, () => `<style>${style}</style>`);
await writeFile(new URL("balloons-local.html", root), html);
console.log("Standalone prototype: balloons-local.html");
