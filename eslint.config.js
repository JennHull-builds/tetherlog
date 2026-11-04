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
  // D-031: the whole app is on nil-ds. Components read the kit's semantic roles
  // (var(--nil-color-*) and friends) and never a primitive, and never a colour
  // literal. The old --tl-* colour, type, spacing, radius and border tokens are
  // not read by any screen; only the motion and sound tokens still are, so
  // those four prefixes are the only --tl- reads allowed. GravityField keeps its
  // grid tokens and is exempt from that last rule, because it is unused.
  {
    files: ["src/components/**/*.{ts,tsx}", "src/views/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/#[0-9a-fA-F]{3,8}/]",
          message:
            "Colour literal. Read the kit's semantic role: var(--nil-color-<role>). See AGENTS.md.",
        },
        {
          selector: "TemplateElement[value.raw=/#[0-9a-fA-F]{3,8}/]",
          message: "Colour literal in a template literal. Use a kit role.",
        },
        {
          selector: "Literal[value=/--tl-ref-/]",
          message: "Primitive token. Read the kit's semantic roles only. See AGENTS.md.",
        },
        {
          selector: "TemplateElement[value.raw=/--tl-ref-/]",
          message: "Primitive token in a template literal. Use a kit role.",
        },
        {
          selector: "Literal[value=/--nil-primitive-/]",
          message: "Kit primitive. Read the kit's semantic roles (--nil-color-*) only.",
        },
        {
          selector: "TemplateElement[value.raw=/--nil-primitive-/]",
          message: "Kit primitive in a template literal. Use a semantic role.",
        },
        {
          selector: "Literal[value=/--tl-(?!spring|duration|ease|sound)/]",
          message: "Old token. Colour, type, spacing, radius and border come from the kit (--nil-*). See D-031.",
        },
        {
          selector: "TemplateElement[value.raw=/--tl-(?!spring|duration|ease|sound)/]",
          message: "Old token in a template literal. Use the kit's --nil-* role. See D-031.",
        },
      ],
    },
  },
  {
    files: ["src/components/GravityField.tsx"],
    rules: { "no-restricted-syntax": "off" },
  },
]);
