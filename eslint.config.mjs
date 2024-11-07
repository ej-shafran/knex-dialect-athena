import tseslint from "typescript-eslint";
import pluginJs from "@eslint/js";
import globals from "globals";

export default tseslint.config(
  { files: ["**/*.{js,cjs,mjs,ts,cts,mts}"] },
  { languageOptions: { globals: globals.node } },
  pluginJs.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    ignores: [
      "lib/",
      "dist/",
      "*.config.{js,cjs,mjs,ts,cts,mts}",
      "*.config.*.{js,cjs,mjs,ts,cts,mts}",
    ],
  },
);
