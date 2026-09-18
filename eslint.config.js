import { defineConfig, globalIgnores } from "eslint/config";
import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default defineConfig([
  globalIgnores(["dist"]),
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
    },
  },
  // ── Token discipline ────────────────────────────────────────────────────
  // Catches the mistake in the editor. scripts/check-tokens.sh is the backstop
  // at build time, because ESLint does not read CSS. See CLAUDE.md.
  {
    files: ["src/components/**/*.{ts,tsx}", "src/views/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/#[0-9a-fA-F]{3,8}/]",
          message:
            "Colour literal. Components read semantic tokens: var(--tl-<role>). See CLAUDE.md.",
        },
        {
          selector: "TemplateElement[value.raw=/#[0-9a-fA-F]{3,8}/]",
          message:
            "Colour literal in a template literal. Use var(--tl-<role>).",
        },
        {
          selector: "Literal[value=/--tl-ref-/]",
          message:
            "Primitive token. Components read semantic roles only (--tl-<role>). See CLAUDE.md.",
        },
        {
          selector: "TemplateElement[value.raw=/--tl-ref-/]",
          message:
            "Primitive token in a template literal. Use a semantic role.",
        },
        // PHASE 5 adds:
        //   { selector: "Literal[value=/--nil-/]",
        //     message: "NIL DS is removed. Use var(--tl-<role>)." }
        // It cannot be enabled yet: the five primitives and NavBar still read
        // --nil-* through inline styles, aliased onto the token layer in
        // src/index.css. Turning it on now fails lint on 56 intentional,
        // documented interim references. Enable it in the same commit that
        // deletes the alias block.
      ],
    },
  },
]);
