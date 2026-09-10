import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: ["node_modules/**", "static/vendor/**"],
  },
  js.configs.recommended,
  {
    files: ["static/**/*.js"],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ["tools/*.mjs", "eslint.config.js"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
];
