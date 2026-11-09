import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const p = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));

export default defineConfig({
  resolve: { alias: { "@": p("./src"), "server-only": p("./test-stubs/server-only.ts") } },
  test: { include: ["src/**/*.test.ts", "scripts/**/*.test.ts"] },
});
