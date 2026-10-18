// Builds the demo as one self-contained HTML file: preview/dist/spendly.html
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const shim = fileURLToPath(new URL("./next-shim.tsx", import.meta.url));
mkdirSync(`${root}preview/dist`, { recursive: true });

const js = await build({
  entryPoints: [`${root}preview/main.tsx`],
  bundle: true,
  minify: true,
  write: false,
  format: "iife",
  jsx: "automatic",
  target: "es2020",
  alias: { "next/link": shim, "next/navigation": shim },
  define: {
    "process.env.NODE_ENV": '"production"',
    "process.env.NEXT_PUBLIC_SUPABASE_URL": '""',
    "process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY": '""',
  },
  // Spreadsheet import is loaded lazily in the app; bundle it inline here.
  splitting: false,
});

execFileSync("npx", ["@tailwindcss/cli", "-i", "src/app/globals.css", "-o", "preview/dist/app.css", "--minify"], { cwd: root, stdio: "inherit" });
const css = readFileSync(`${root}preview/dist/app.css`, "utf8");
const code = js.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");

const html = `<title>Spendly</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap">
<style>:root{--font-geist-sans:"Geist"}${css}</style>
<div id="root"></div>
<script>${code}</script>
`;
writeFileSync(`${root}preview/dist/spendly.html`, html);
console.log(`preview/dist/spendly.html ${(html.length / 1024).toFixed(0)} KB`);
