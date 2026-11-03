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
        // Enabled in Phase 3, in the same change that deleted the alias
        // block from src/index.css. Nothing reads --nil-* any more.
        {
          selector: "Literal[value=/--nil-/]",
          message: "NIL DS is removed. Use var(--tl-<role>). See CLAUDE.md.",
        },
        {
          selector: "TemplateElement[value.raw=/--nil-/]",
          message: "NIL DS is removed. Use var(--tl-<role>). See CLAUDE.md.",
        },
      ],
    },
  },
  // D-030: the files on nil-ds read var(--nil-*) from the kit, so the rule that
  // bans it is lifted for exactly these and nowhere else. Colour literals and
  // --tl-ref-* stay banned here too. Add a file to this list only when its
  // whole screen has moved onto the kit.
  {
    files: [
      "src/views/CaptureView.tsx",
      "src/components/ui/PeekStack.tsx",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/#[0-9a-fA-F]{3,8}/]",
          message:
            "Colour literal. Read a semantic token: var(--tl-<role>) or, on a nil-ds screen, var(--nil-<role>). See AGENTS.md.",
        },
        {
          selector: "TemplateElement[value.raw=/#[0-9a-fA-F]{3,8}/]",
          message: "Colour literal in a template literal. Use a semantic token.",
        },
        {
          selector: "Literal[value=/--tl-ref-/]",
          message:
            "Primitive token. Components read semantic roles only. See AGENTS.md.",
        },
        {
          selector: "TemplateElement[value.raw=/--tl-ref-/]",
          message: "Primitive token in a template literal. Use a semantic role.",
        },
        {
          selector: "Literal[value=/--nil-primitive-/]",
          message: "Kit primitive. Read the kit's semantic roles (--nil-color-*) only.",
        },
        {
          selector: "TemplateElement[value.raw=/--nil-primitive-/]",
          message: "Kit primitive in a template literal. Use a semantic role.",
        },
      ],
    },
  },
]);
