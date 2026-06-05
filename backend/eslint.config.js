import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist", "node_modules"]),
  {
    files: ["**/*.ts"],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: { globals: globals.node },
    rules: {
      // `let x = null` defaults that are conditionally reassigned read fine here.
      "no-useless-assignment": "off",
      // Express request extensions (req.session / req.cookies) use `any` deliberately.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
]);
