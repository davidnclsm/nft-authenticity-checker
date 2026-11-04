import { fileURLToPath } from "node:url";
import path from "node:path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Projektordner explizit festlegen (contracts/ hat eine eigene package-lock.json)
  turbopack: {
    root: path.dirname(fileURLToPath(import.meta.url)),
  },
  // Erlaubt den Aufruf über http://127.0.0.1:3000 zusätzlich zu http://localhost:3000
  allowedDevOrigins: ["127.0.0.1"],
  agentRules: false,
  // Kein Next.js-Entwicklersymbol unten links (sauberer für die Präsentation)
  devIndicators: false,
};

export default nextConfig;
