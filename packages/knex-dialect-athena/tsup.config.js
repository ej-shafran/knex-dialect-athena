import { defineConfig } from "tsup";

export default defineConfig(() => ({
  format: ["cjs", "esm"],
  dts: true,
  sourcemap: false,
  minify: false,
  clean: true,
}));
