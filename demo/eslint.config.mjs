import tseslint from "typescript-eslint";
import baseConfig from "../eslint.config.mjs";

export default tseslint.config(...baseConfig, {
  ignores: ["lib/", "*.config.{js,cjs,mjs,ts,cts,mts}"],
});
